// TODO bugs and quirks i'm aware of:
// - steam: if a player character starts on a force floor they won't be able to make any voluntary movements until they are no longer on a force floor
import { DIRECTIONS, TICS_PER_SECOND } from './defs.js';
import * as c2m from './format-c2m.js';
import * as dat from './format-dat.js';
import * as format_util from './format-util.js';
import { Level } from './game.js';
import CanvasRenderer from './renderer-canvas.js';
import { Tileset, CC2_TILESET_LAYOUT, TILE_WORLD_TILESET_LAYOUT } from './tileset.js';
import TILE_TYPES from './tiletypes.js';
import { mk, promise_event, fetch, walk_grid } from './util.js';

const PAGE_TITLE = "Lexy's Labyrinth";
// Stackable modal overlay of some kind, usually a dialog
class Overlay {
    constructor(conductor, root) {
        this.conductor = conductor;
        this.root = root;

        // Don't propagate clicks on the root element, so they won't trigger a
        // parent overlay's automatic dismissal
        this.root.addEventListener('click', ev => {
            ev.stopPropagation();
        });
    }

    open() {
        // FIXME ah, but keystrokes can still go to the game, including
        // spacebar to begin it if it was waiting.  how do i completely disable
        // an entire chunk of the page?
        if (this.conductor.player.state === 'playing') {
            this.conductor.player.set_state('paused');
        }

        let overlay = mk('div.overlay', this.root);
        document.body.append(overlay);

        // Remove the overlay when clicking outside the element
        overlay.addEventListener('click', ev => {
            this.close();
        });
    }

    close() {
        this.root.closest('.overlay').remove();
    }
}

// Overlay styled like a dialog box
class DialogOverlay extends Overlay {
    constructor(conductor) {
        super(conductor, mk('div.dialog'));

        this.root.append(
            this.header = mk('header'),
            this.main = mk('section'),
            this.footer = mk('footer'),
        );
    }

    set_title(title) {
        this.header.textContent = '';
        this.header.append(mk('h1', {}, title));
    }

    add_button(label, onclick) {
        let button = mk('button', {type: 'button'}, label);
        button.addEventListener('click', onclick);
        this.footer.append(button);
    }
}

// Yes/no popup dialog
class ConfirmOverlay extends DialogOverlay {
    constructor(conductor, message, what) {
        super(conductor);
        this.set_title("just checking");
        this.main.append(mk('p', {}, message));
        let yes = mk('button', {type: 'button'}, "yep");
        let no = mk('button', {type: 'button'}, "nope");
        yes.addEventListener('click', ev => {
            this.close();
            what();
        });
        no.addEventListener('click', ev => {
            this.close();
        });
        this.footer.append(yes, no);
    }
}


// -------------------------------------------------------------------------------------------------
// Main display...  modes

class PrimaryView {
    constructor(conductor, root) {
        this.conductor = conductor;
        this.root = root;
        this.active = false;
    }

    activate() {
        this.root.removeAttribute('hidden');
        this.active = true;
    }

    deactivate() {
        this.root.setAttribute('hidden', '');
        this.active = false;
    }
}


// TODO:
// - some kinda visual theme i guess lol
// - level password, if any
// - bonus points (cc2 only, or maybe only if got any so far this level)
// - intro splash with list of available level packs
// - button: quit to splash
// - implement winning and show score for this level
// - show current score so far
// - about, help
const ACTION_LABELS = {
    up: '⬆️\ufe0f',
    down: '⬇️\ufe0f',
    left: '⬅️\ufe0f',
    right: '➡️\ufe0f',
    drop: '🚮',
    cycle: '🔄',
    swap: '👫',
};
const ACTION_DIRECTIONS = {
    up: 'north',
    down: 'south',
    left: 'west',
    right: 'east',
};
class Player extends PrimaryView {
    constructor(conductor) {
        super(conductor, document.body.querySelector('main#player'));

        this.key_mapping = {
            ArrowLeft: 'left',
            ArrowRight: 'right',
            ArrowUp: 'up',
            ArrowDown: 'down',
            w: 'up',
            a: 'left',
            s: 'down',
            d: 'right',
            q: 'drop',
            e: 'cycle',
            c: 'swap',
        };

        this.scale = 1;

        this.compat = {
            tiles_react_instantly: false,
        };

        this.root.style.setProperty('--tile-width', `${this.conductor.tileset.size_x}px`);
        this.root.style.setProperty('--tile-height', `${this.conductor.tileset.size_y}px`);
        this.level_el = this.root.querySelector('.level');
        this.message_el = this.root.querySelector('.message');
        this.chips_el = this.root.querySelector('.chips output');
        this.time_el = this.root.querySelector('.time output');
        this.bonus_el = this.root.querySelector('.bonus output');
        this.inventory_el = this.root.querySelector('.inventory');
        this.bummer_el = this.root.querySelector('.bummer');
        this.input_el = this.root.querySelector('.input');
        this.demo_el = this.root.querySelector('.demo');

        // Bind buttons
        this.pause_button = this.root.querySelector('.controls .control-pause');
        this.pause_button.addEventListener('click', ev => {
            this.toggle_pause();
            ev.target.blur();
        });
        this.restart_button = this.root.querySelector('.controls .control-restart');
        this.restart_button.addEventListener('click', ev => {
            new ConfirmOverlay(this.conductor, "Abandon this attempt and try again?", () => {
                this.restart_level();
            }).open();
            ev.target.blur();
        });
        this.undo_button = this.root.querySelector('.controls .control-undo');
        this.undo_button.addEventListener('click', ev => {
            let player_cell = this.level.player.cell;
            // Keep undoing until (a) we're on another cell and (b) we're not
            // sliding, i.e. we're about to make a conscious move
            let moved = false;
            while (this.level.undo_stack.length > 0 &&
                ! (moved && this.level.player.slide_mode === null))
            {
                this.level.undo();
                if (player_cell !== this.level.player.cell) {
                    moved = true;
                }
            }
            // TODO set back to waiting if we hit the start of the level?  but
            // the stack trims itself so how do we know that
            if (this.state === 'stopped') {
                // Be sure to undo any success or failure
                this.set_state('playing');
            }
            this.update_ui();
            this._redraw();
            ev.target.blur();
        });
        // Demo playback
        this.root.querySelector('.demo-controls .demo-play').addEventListener('click', ev => {
            if (this.state === 'playing' || this.state === 'paused' || this.state === 'rewinding') {
                new ConfirmOverlay(this.conductor, "Abandon your progress and watch the replay?", () => {
                    this.play_demo();
                });
            }
            else {
                this.play_demo();
            }
        });
        this.root.querySelector('.demo-controls .demo-step-1').addEventListener('click', ev => {
            this.advance_by(1);
            this._redraw();
        });
        this.root.querySelector('.demo-controls .demo-step-4').addEventListener('click', ev => {
            this.advance_by(4);
            this._redraw();
        });

        // Populate inventory
        this._inventory_tiles = {};
        let floor_tile = this.render_inventory_tile('floor');
        this.inventory_el.style.backgroundImage = `url(${floor_tile})`;

        this.renderer = new CanvasRenderer(this.conductor.tileset);
        this.level_el.append(this.renderer.canvas);
        this.renderer.canvas.addEventListener('auxclick', ev => {
            if (ev.button !== 1)
                return;

            let [x, y] = this.renderer.cell_coords_from_event(ev);
            this.level.move_to(this.level.player, this.level.cells[y][x], 1);
        });

        let last_key;
        this.pending_player_move = null;
        this.next_player_move = null;
        this.player_used_move = false;
        let key_target = document.body;
        this.previous_input = new Set;  // actions that were held last tic
        this.previous_action = null;  // last direction we were moving, if any
        this.current_keys = new Set;  // keys that are currently held
        // TODO this could all probably be more rigorous but it's fine for now
        key_target.addEventListener('keydown', ev => {
            if (ev.key === 'p' || ev.key === 'Pause') {
                this.toggle_pause();
                return;
            }

            if (ev.key === ' ') {
                if (this.state === 'waiting') {
                    // Start without moving
                    this.set_state('playing');
                }
                else if (this.state === 'stopped') {
                    if (this.level.state === 'success') {
                        // Advance to the next level
                        // TODO game ending?
                        this.conductor.change_level(this.conductor.level_index + 1);
                    }
                    else {
                        // Restart
                        this.restart_level();
                    }
                    return;
                }
                // Don't scroll pls
                ev.preventDefault();
            }

            if (this.key_mapping[ev.key]) {
                this.current_keys.add(ev.key);
                ev.stopPropagation();
                ev.preventDefault();

                if (this.state === 'waiting') {
                    this.set_state('playing');
                }
            }
        });
        key_target.addEventListener('keyup', ev => {
            if (this.key_mapping[ev.key]) {
                this.current_keys.delete(ev.key);
                ev.stopPropagation();
                ev.preventDefault();
            }
        });

        // Populate input debugger
        this.input_el = this.root.querySelector('.input');
        this.input_action_elements = {};
        for (let [action, label] of Object.entries(ACTION_LABELS)) {
            let el = mk('span.input-action', {'data-action': action}, label);
            this.input_el.append(el);
            this.input_action_elements[action] = el;
        }

        // Auto pause when we lose focus
        window.addEventListener('blur', ev => {
            if (this.state === 'playing' || this.state === 'rewinding') {
                this.set_state('paused');
            }
        });

        this._advance_bound = this.advance.bind(this);
        this._redraw_bound = this.redraw.bind(this);
        // Used to determine where within a tic we are, for animation purposes
        this.tic_offset = 0;
        this.last_advance = 0;  // performance.now timestamp

        // Auto-size the level canvas, both now and on resize
        this.adjust_scale();
        window.addEventListener('resize', ev => {
            this.adjust_scale();
        });
    }

    activate() {
        // We can't resize when we're not visible, so do it now
        super.activate();
        this.adjust_scale();
    }

    deactivate() {
        // End the level when going away; the easiest way is by restarting it
        // TODO could throw the level away entirely and create a new one on activate?
        super.deactivate();
        if (this.state !== 'waiting') {
            this.restart_level();
        }
    }

    load_game(stored_game) {
    }

    load_level(stored_level) {
        this.level = new Level(stored_level, this.compat);
        this.renderer.set_level(this.level);
        // waiting: haven't yet pressed a key so the timer isn't going
        // playing: playing normally
        // paused: um, paused
        // rewinding: playing backwards
        // stopped: level has ended one way or another
        this.set_state('waiting');

        this.tic_offset = 0;
        this.last_advance = 0;

        this.demo_faucet = null;
        this.root.classList.toggle('--has-demo', !!this.level.stored_level.demo);

        this.update_ui();
        // Force a redraw, which won't happen on its own since the game isn't running
        this._redraw();
    }

    restart_level() {
        this.level.restart(this.compat);
        this.set_state('waiting');

        this.chips_el.classList.remove('--done');
        this.time_el.classList.remove('--frozen');
        this.time_el.classList.remove('--danger');
        this.time_el.classList.remove('--warning');
        this.root.classList.remove('--bonus-visible');

        this.update_ui();
        this._redraw();
    }

    play_demo() {
        this.demo_faucet = this.level.stored_level.demo[Symbol.iterator]();
        this.restart_level();
        this.level.force_floor_direction = this.level.stored_level.demo.initial_force_floor_direction;
        // FIXME should probably start playback on first real input
        this.set_state('playing');
    }

    get_input() {
        if (this.demo_faucet) {
            let step = this.demo_faucet.next();
            if (step.done) {
                return new Set;
            }
            else {
                return step.value;
            }
        }
        else {
            // Convert input keys to actions.  This is only done now
            // because there might be multiple keys bound to one
            // action, and it still counts as pressed as long as at
            // least one key is held
            let input = new Set;
            for (let key of this.current_keys) {
                input.add(this.key_mapping[key]);
            }
            return input;
        }
    }

    advance_by(tics) {
        for (let i = 0; i < tics; i++) {
            let input = this.get_input();
            let current_input = input;
            if (! input.has('up') && ! input.has('down') && ! input.has('left') && ! input.has('right')) {
                //input = this.previous_input;
            }

            // Choose the movement direction based on the held keys.  A
            // newly pressed action takes priority; in the case of a tie,
            // um, XXX ????
            let chosen_action = null;
            let any_action = null;
            for (let action of ['up', 'down', 'left', 'right']) {
                if (input.has(action)) {
                    if (this.previous_input.has(action)) {
                        chosen_action = action;
                    }
                    any_action = action;
                }
            }
            if (! chosen_action) {
                // No keys are new, so check whether we were previously
                // holding a key and are still doing it
                if (this.previous_action && input.has(this.previous_action)) {
                    chosen_action = this.previous_action;
                }
                else {
                    // No dice, so use an arbitrary action
                    chosen_action = any_action;
                }
            }

            let player_move = chosen_action ? ACTION_DIRECTIONS[chosen_action] : null;
            this.previous_action = chosen_action;
            this.previous_input = current_input;

            this.level.advance_tic(player_move);

            if (this.level.state !== 'playing') {
                // We either won or lost!
                this.set_state('stopped');
                break;
            }
        }
        this.update_ui();
    }

    // Main driver of the level; advances by one tic, then schedules itself to
    // be called again next tic
    advance() {
        if (this.state !== 'playing' && this.state !== 'rewinding') {
            this._advance_handle = null;
            return;
        }

        this.last_advance = performance.now();
        this.advance_by(1);
        this._advance_handle = window.setTimeout(this._advance_bound, 1000 / TICS_PER_SECOND);
    }

    // Redraws every frame, unless the game isn't running
    redraw() {
        if (this.state !== 'playing' && this.state !== 'rewinding') {
            this._redraw_handle = null;
            return;
        }

        // Calculate this here, not in _redraw, because that's called at weird
        // times when the game might not have actually advanced at all yet
        // TODO this is not gonna be right while pausing lol
        // TODO i'm not sure it'll be right when rewinding either
        // TODO or if the game's speed changes.  wow!
        this.tic_offset = Math.min(0.9999, (performance.now() - this.last_advance) / 1000 / (1 / TICS_PER_SECOND));

        this._redraw();
        this._redraw_handle = requestAnimationFrame(this._redraw_bound);
    }

    // Actually redraw.  Used to force drawing outside of normal play
    _redraw() {
        this.renderer.draw(this.tic_offset);
    }

    render_inventory_tile(name) {
        if (! this._inventory_tiles[name]) {
            // TODO put this on the renderer
            // TODO reuse the canvas for data urls
            let canvas = mk('canvas', {width: this.conductor.tileset.size_x, height: this.conductor.tileset.size_y});
            this.conductor.tileset.draw({type: TILE_TYPES[name]}, null, canvas.getContext('2d'), 0, 0);
            this._inventory_tiles[name] = canvas.toDataURL();
        }
        return this._inventory_tiles[name];
    }

    update_ui() {
        this.pause_button.disabled = !(this.state === 'playing' || this.state === 'paused');
        this.restart_button.disabled = (this.state === 'waiting');

        // TODO can we do this only if they actually changed?
        this.chips_el.textContent = this.level.chips_remaining;
        if (this.level.chips_remaining === 0) {
            this.chips_el.classList.add('--done');
        }

        this.time_el.classList.toggle('--frozen', this.level.time_remaining === null || this.level.timer_paused);
        if (this.level.time_remaining === null) {
            this.time_el.textContent = '---';
        }
        else {
            this.time_el.textContent = Math.ceil(this.level.time_remaining / 20);
            this.time_el.classList.toggle('--warning', this.level.time_remaining < 30 * 20);
            this.time_el.classList.toggle('--danger', this.level.time_remaining < 10 * 20);
        }

        this.bonus_el.textContent = this.level.bonus_points;
        if (this.level.bonus_points > 0) {
            this.root.classList.add('--bonus-visible');
        }
        this.message_el.textContent = this.level.hint_shown ?? "";

        this.inventory_el.textContent = '';
        // FIXME why does this stuff run when opening the /editor/
        for (let [name, count] of Object.entries(this.level.player.inventory)) {
            if (count > 0) {
                this.inventory_el.append(mk('img', {src: this.render_inventory_tile(name)}));
            }
        }

        for (let action of Object.keys(ACTION_LABELS)) {
            this.input_action_elements[action].classList.toggle('--pressed', this.previous_input.has(action));
        }
    }

    toggle_pause() {
        if (this.state === 'paused') {
            this.set_state('playing');
        }
        else if (this.state === 'playing') {
            this.set_state('paused');
        }
    }

    set_state(new_state) {
        if (new_state === this.state)
            return;

        this.state = new_state;

        if (this.state === 'waiting') {
            this.bummer_el.textContent = "Ready!";
        }
        else if (this.state === 'playing' || this.state === 'rewinding') {
            this.bummer_el.textContent = "";
        }
        else if (this.state === 'paused') {
            this.bummer_el.textContent = "/// paused ///";
        }
        else if (this.state === 'stopped') {
            if (this.level.state === 'failure') {
                this.bummer_el.textContent = this.level.fail_message;
            }
            else {
                this.bummer_el.textContent = "";
                let base = (this.conductor.level_index + 1) * 500;
                let time = Math.ceil((this.level.time_remaining ?? 0) / 20) * 10;
                this.bummer_el.append(
                    mk('p', "go bit buster!"),
                    mk('dl.score-chart',
                        mk('dt', "base score"),
                        mk('dd', base),
                        mk('dt', "time bonus"),
                        mk('dd', `+ ${time}`),
                        mk('dt', "score bonus"),
                        mk('dd', `+ ${this.level.bonus_points}`),
                        mk('dt.-sum', "level score"),
                        mk('dd.-sum', base + time + this.level.bonus_points),
                        mk('dt', "improvement"),
                        mk('dd', "(TODO)"),
                        mk('dt', "total score"),
                        mk('dd', "(TODO)"),
                    ),
                );
            }
        }

        // The advance and redraw methods run in a loop, but they cancel
        // themselves if the game isn't running, so restart them here
        if (this.state === 'playing' || this.state === 'rewinding') {
            if (! this._advance_handle) {
                this.advance();
            }
            if (! this._redraw_handle) {
                this.redraw();
            }
        }
    }

    // Auto-size the game canvas to fit the screen, if possible
    adjust_scale() {
        // TODO make this optional
        // The base size is the size of the canvas, i.e. the viewport size
        // times the tile size
        let base_x = this.conductor.tileset.size_x * this.renderer.viewport_size_x;
        let base_y = this.conductor.tileset.size_y * this.renderer.viewport_size_y;
        // The main UI is centered in a flex item with auto margins, so the
        // extra space available is the size of those margins
        let style = window.getComputedStyle(this.root);
        let extra_x = parseFloat(style['margin-left']) + parseFloat(style['margin-right']);
        let extra_y = parseFloat(style['margin-top']) + parseFloat(style['margin-bottom']);
        // The total available space, then, is the current size of the
        // canvas plus the size of the margins
        let total_x = extra_x + this.renderer.canvas.offsetWidth;
        let total_y = extra_y + this.renderer.canvas.offsetHeight;
        // Divide to find the biggest scale that still fits.  But don't
        // exceed 90% of the available space, or it'll feel cramped.
        let scale = Math.floor(0.9 * Math.min(total_x / base_x, total_y / base_y));
        if (scale <= 0) {
            scale = 1;
        }

        // FIXME the above logic doesn't take into account the inventory, which is also affected by scale
        this.scale = scale;
        this.root.style.setProperty('--scale', scale);
    }
}


const EDITOR_TOOLS = [{
    mode: 'pencil',
    icon: 'icons/tool-pencil.png',
    name: "Pencil",
    desc: "Draw individual tiles",
}, {
    mode: 'line',
    icon: 'icons/tool-line.png',
    name: "Line",
    desc: "Draw straight lines",
}, {
    mode: 'box',
    icon: 'icons/tool-box.png',
    name: "Box",
    desc: "Fill a rectangular area with tiles",
}, {
    mode: 'fill',
    icon: 'icons/tool-fill.png',
    name: "Fill",
    desc: "Flood-fill an area with tiles",
}, {
    mode: 'force-floors',
    icon: 'icons/tool-force-floors.png',
    name: "Force floors",
    desc: "Draw force floors in the direction you draw",
}, {
    mode: 'adjust',
    icon: 'icons/tool-adjust.png',
    name: "Adjust",
    desc: "Toggle blocks and rotate actors",
}, {
    mode: 'connect',
    icon: 'icons/tool-connect.png',
    name: "Connect",
    desc: "Set up CC1 clone and trap connections",
}, {
    mode: 'wire',
    icon: 'icons/tool-wire.png',
    name: "Wire",
    desc: "Draw CC2 wiring",
    // TODO text tool; thin walls tool; ice tool; map generator?; subtools for select tool (copy, paste, crop)
}];
// Tiles the "adjust" tool will turn into each other
const EDITOR_ADJUST_TOGGLES = {
    floor: 'wall',
    wall: 'floor',
    floor_custom_green: 'wall_custom_green',
    floor_custom_pink: 'wall_custom_pink',
    floor_custom_yellow: 'wall_custom_yellow',
    floor_custom_blue: 'wall_custom_blue',
    wall_custom_green: 'floor_custom_green',
    wall_custom_pink: 'floor_custom_pink',
    wall_custom_yellow: 'floor_custom_yellow',
    wall_custom_blue: 'floor_custom_blue',
    fake_floor: 'fake_wall',
    fake_wall: 'fake_floor',
    wall_invisible: 'wall_appearing',
    wall_appearing: 'wall_invisible',
    green_floor: 'green_wall',
    green_wall: 'green_floor',
    green_bomb: 'green_chip',
    green_chip: 'green_bomb',
    purple_floor: 'purple_wall',
    purple_wall: 'purple_floor',
    thief_keys: 'thief_tools',
    thief_tools: 'thief_keys',
};
// TODO this MUST use a cc2 tileset!
const EDITOR_PALETTE = [{
    title: "Basics",
    tiles: [
        'player',
        'chip', 'chip_extra',
        'floor', 'wall', 'hint', 'socket', 'exit',
    ],
}, {
    title: "Terrain",
    tiles: [
        'popwall',
        'fake_floor', 'fake_wall',
        'wall_invisible', 'wall_appearing',
        'gravel',
        'dirt',
        'door_blue', 'door_red', 'door_yellow', 'door_green',
        'water', 'turtle', 'fire',
        'ice', 'ice_nw', 'ice_ne', 'ice_sw', 'ice_se',
        'force_floor_n', 'force_floor_s', 'force_floor_w', 'force_floor_e', 'force_floor_all',
    ],
}, {
    title: "Items",
    tiles: [
        'key_blue', 'key_red', 'key_yellow', 'key_green',
        'flippers', 'fire_boots', 'cleats', 'suction_boots',
    ],
}, {
    title: "Creatures",
    tiles: [
        'tank_blue',
        'ball',
        'fireball',
        'glider',
        'bug',
        'paramecium',
        'walker',
        'teeth',
        'blob',
    ],
}, {
    title: "Mechanisms",
    tiles: [
        'bomb',
        'dirt_block',
        'button_blue',
        'button_red', 'cloner',
        'button_brown', 'trap',
    ],
}];
class Editor extends PrimaryView {
    constructor(conductor) {
        super(conductor, document.body.querySelector('main#editor'));
        // FIXME don't hardcode size here, convey this to renderer some other way
        this.renderer = new CanvasRenderer(this.conductor.tileset, 32);

        // Level canvas and mouse handling
        this.root.querySelector('.level').append(this.renderer.canvas);
        this.mouse_mode = null;
        this.mouse_button = null;
        this.mouse_cell = null;
        this.renderer.canvas.addEventListener('mousedown', ev => {
            if (ev.button === 0) {
                // Left button: draw
                this.mouse_mode = 'draw';
                this.mouse_button = ev.button;
                this.mouse_coords = [ev.clientX, ev.clientY];

                let [x, y] = this.renderer.cell_coords_from_event(ev);
                this.mouse_cell = [x, y];

                if (this.current_tool === 'pencil') {
                    this.place_in_cell(x, y, this.palette_selection);
                }
                else if (this.current_tool === 'force-floors') {
                    // Begin by placing an all-way force floor under the mouse
                    this.place_in_cell(x, y, 'force_floor_all');
                }
                else if (this.current_tool === 'adjust') {
                    let cell = this.stored_level.cells[y][x];
                    for (let tile of cell) {
                        // Toggle tiles that go in obvious pairs
                        let other = EDITOR_ADJUST_TOGGLES[tile.name];
                        if (other) {
                            tile.name = other;
                        }

                        // Rotate actors
                        if (TILE_TYPES[tile.name].is_actor) {
                            tile.direction = DIRECTIONS[tile.direction].right;
                        }
                    }
                }
                this.renderer.draw();
            }
            else if (ev.button === 1) {
                // Middle button: pan
                this.mouse_mode = 'pan';
                this.mouse_button = ev.button;
                this.mouse_coords = [ev.clientX, ev.clientY];
                ev.preventDefault();
            }
        });
        this.renderer.canvas.addEventListener('mousemove', ev => {
            if (this.mouse_mode === null)
                return;
            // TODO check for the specific button we're holding
            if ((ev.buttons & (2 << this.mouse_button)) === 0) {
                this.mouse_mode = null;
                return;
            }

            if (this.mouse_mode === 'draw') {
                // FIXME also fill in a trail between previous cell and here, mousemove is not fired continuously
                let [x, y] = this.renderer.cell_coords_from_event(ev);
                if (x === this.mouse_cell[0] && y === this.mouse_cell[1])
                    return;

                // TODO do a pixel-perfect draw too
                if (this.current_tool === 'pencil') {
                    for (let [cx, cy] of walk_grid(this.mouse_cell[0], this.mouse_cell[1], x, y)) {
                        this.place_in_cell(cx, cy, this.palette_selection);
                    }
                }
                else if (this.current_tool === 'force-floors') {
                    // Walk the mouse movement and change each we touch to match the direction we
                    // crossed the border
                    let i = 0;
                    let prevx, prevy;
                    for (let [cx, cy] of walk_grid(this.mouse_cell[0], this.mouse_cell[1], x, y)) {
                        i++;
                        // The very first cell is the one the mouse was already in, and we don't
                        // have a movement direction yet, so leave that alone
                        if (i === 1) {
                            prevx = cx;
                            prevy = cy;
                            continue;
                        }
                        let name;
                        let cell = this.stored_level.cells[cy][cx];
                        if (cell[0].name.startsWith('force_floor_')) {
                            // Drawing a loop with force floors creates ice
                            name = 'ice';
                        }
                        else if (cx === prevx) {
                            if (cy > prevy) {
                                name = 'force_floor_s';
                            }
                            else {
                                name = 'force_floor_n';
                            }
                        }
                        else {
                            if (cx > prevx) {
                                name = 'force_floor_e';
                            }
                            else {
                                name = 'force_floor_w';
                            }
                        }
                        this.place_in_cell(cx, cy, name);

                        // The second cell tells us the direction to use for the first, assuming it
                        // had an RFF marking it
                        if (i === 2) {
                            let prevcell = this.stored_level.cells[prevy][prevx];
                            if (prevcell[0].name === 'force_floor_all') {
                                prevcell[0].name = name;
                            }
                        }
                        prevx = cx;
                        prevy = cy;
                    }
                }
                else if (this.current_tool === 'adjust') {
                    // Adjust tool doesn't support dragging
                    // TODO should it
                }
                this.renderer.draw();

                this.mouse_cell = [x, y];
            }
            else if (this.mouse_mode === 'pan') {
                let dx = ev.clientX - this.mouse_coords[0];
                let dy = ev.clientY - this.mouse_coords[1];
                this.renderer.canvas.parentNode.scrollLeft -= dx;
                this.renderer.canvas.parentNode.scrollTop -= dy;
                this.mouse_coords = [ev.clientX, ev.clientY];
            }
        });
        this.renderer.canvas.addEventListener('mouseup', ev => {
            this.mouse_mode = null;
        });
        window.addEventListener('blur', ev => {
            // Unbind the mouse if the page loses focus
            this.mouse_mode = null;
        });

        // Toolbox
        let toolbox = mk('div.icon-button-set')
        this.root.querySelector('.controls').append(toolbox);
        this.tool_button_els = {};
        for (let tooldef of EDITOR_TOOLS) {
            let button = mk(
                'button', {
                    type: 'button',
                    'data-tool': tooldef.mode,
                },
                mk('img', {
                    src: tooldef.icon,
                    alt: tooldef.name,
                    title: `${tooldef.name}: ${tooldef.desc}`,
                }),
            );
            this.tool_button_els[tooldef.mode] = button;
            toolbox.append(button);
        }
        this.current_tool = 'pencil';
        this.tool_button_els['pencil'].classList.add('-selected');
        toolbox.addEventListener('click', ev => {
            let button = ev.target.closest('.icon-button-set button');
            if (! button)
                return;

            this.select_tool(button.getAttribute('data-tool'));
        });

        // Tile palette
        let palette_el = this.root.querySelector('.palette');
        this.palette = {};  // name => element
        for (let sectiondef of EDITOR_PALETTE) {
            let section_el = mk('section');
            palette_el.append(mk('h2', sectiondef.title), section_el);
            for (let name of sectiondef.tiles) {
                let entry = mk('canvas.palette-entry', {
                    width: this.conductor.tileset.size_x,
                    height: this.conductor.tileset.size_y,
                    'data-tile-name': name,
                });
                let ctx = entry.getContext('2d');
                this.conductor.tileset.draw_type(name, null, null, ctx, 0, 0);
                this.palette[name] = entry;
                section_el.append(entry);
            }
        }
        palette_el.addEventListener('click', ev => {
            let entry = ev.target.closest('canvas.palette-entry');
            if (! entry)
                return;

            this.select_palette(entry.getAttribute('data-tile-name'));
        });
        this.palette_selection = null;
        this.select_palette('floor');
    }

    activate() {
        super.activate();
        this.renderer.draw();
    }

    load_game(stored_game) {
    }

    load_level(stored_level) {
        // TODO support a game too i guess
        this.stored_level = stored_level;

        // XXX need this for renderer compat.  but i guess it's nice in general idk
        this.stored_level.cells = [];
        let row;
        for (let [i, cell] of this.stored_level.linear_cells.entries()) {
            if (i % this.stored_level.size_x === 0) {
                row = [];
                this.stored_level.cells.push(row);
            }
            row.push(cell);
        }

        this.renderer.set_level(stored_level);
        if (this.active) {
            this.renderer.draw();
        }
    }

    select_tool(tool) {
        if (tool === this.current_tool)
            return;
        if (! this.tool_button_els[tool])
            return;

        this.tool_button_els[this.current_tool].classList.remove('-selected');
        this.current_tool = tool;
        this.tool_button_els[this.current_tool].classList.add('-selected');
    }

    select_palette(name) {
        if (name === this.palette_selection)
            return;

        if (this.palette_selection) {
            this.palette[this.palette_selection].classList.remove('--selected');
        }
        this.palette_selection = name;
        if (this.palette_selection) {
            this.palette[this.palette_selection].classList.add('--selected');
        }

        // Some tools obviously don't work with a palette selection, in which case changing tiles
        // should default you back to the pencil
        if (this.current_tool === 'adjust') {
            this.select_tool('pencil');
        }
    }

    place_in_cell(x, y, name) {
        // TODO weird api?
        if (! name)
            return;

        let type = TILE_TYPES[name];
        let cell = this.stored_level.cells[y][x];
        // For terrain tiles, erase the whole cell.  For other tiles, only
        // replace whatever's on the same layer
        // TODO probably not the best heuristic yet, since i imagine you can
        // combine e.g. the tent with thin walls
        if (type.draw_layer === 0) {
            cell.length = 0;
            cell.push({name});
        }
        else {
            for (let i = cell.length - 1; i >= 0; i--) {
                if (TILE_TYPES[cell[i].name].draw_layer === type.draw_layer) {
                    cell.splice(i, 1);
                }
            }
            cell.push({name});
            cell.sort((a, b) => TILE_TYPES[b.name].draw_layer - TILE_TYPES[a.name].draw_layer);
        }
    }
}


const BUILTIN_LEVEL_PACKS = [{
    path: 'levels/CCLP1.ccl',
    title: "Chip's Challenge Level Pack 1",
    desc: "Intended as an introduction to Chip's Challenge 1 for new players.  Recommended.",
}, {
    path: 'levels/CCLP3.ccl',
    title: "Chip's Challenge Level Pack 3",
    desc: "Another community level pack.",
}];

class Splash extends PrimaryView {
    constructor(conductor) {
        super(conductor, document.body.querySelector('main#splash'));

        // Populate the list of available level packs
        let pack_list = document.querySelector('#level-pack-list');
        for (let packdef of BUILTIN_LEVEL_PACKS) {
            let li = mk('li',
                mk('h3', packdef.title),
                mk('p', packdef.desc),
            );
            li.addEventListener('click', ev => {
                this.fetch_pack(packdef.path, packdef.title);
            });
            pack_list.append(li);
        }

        // Bind to file upload control
        let upload_el = this.root.querySelector('#splash-upload');
        // Clear it out in case of refresh
        upload_el.value = '';
        upload_el.addEventListener('change', async ev => {
            let file = ev.target.files[0];
            let buf = await file.arrayBuffer();
            this.load_file(buf);
            // TODO get title out of C2G when it's supported
            this.conductor.level_pack_name_el.textContent = file.name;
        });

        // Bind to "create level" button
        this.root.querySelector('#splash-create-level').addEventListener('click', ev => {
            let stored_level = new format_util.StoredLevel;
            stored_level.size_x = 32;
            stored_level.size_y = 32;
            for (let i = 0; i < 1024; i++) {
                let cell = new format_util.StoredCell;
                cell.push({name: 'floor'});
                stored_level.linear_cells.push(cell);
            }
            stored_level.linear_cells[0].push({name: 'player'});

            let stored_game = new format_util.StoredGame;
            stored_game.levels.push(stored_level);
            this.conductor.load_game(stored_game);

            this.conductor.switch_to_editor();
        });
    }

    async fetch_pack(path, title) {
        // TODO indicate we're downloading something
        // TODO handle errors
        // TODO cancel a download if we start another one?
        let buf = await fetch(path);
        let stored_game;
        this.load_file(buf);
        // TODO get title out of C2G when it's supported
        this.conductor.level_pack_name_el.textContent = title || path;
    }

    load_file(buf) {
        // TODO also support tile world's DAC when reading from local??
        // TODO ah, there's more metadata in CCX, crapola
        let magic = String.fromCharCode.apply(null, new Uint8Array(buf.slice(0, 4)));
        let stored_game;
        if (magic === 'CC2M' || magic === 'CCS ') {
            stored_game = new format_util.StoredGame;
            stored_game.levels.push(c2m.parse_level(buf));
        }
        else if (magic === '\xac\xaa\x02\x00' || magic == '\xac\xaa\x02\x01') {
            stored_game = dat.parse_game(buf);
        }
        else {
            throw new Error("Unrecognized file format");
        }
        this.conductor.load_game(stored_game);
        this.conductor.switch_to_player();
    }
}


// -------------------------------------------------------------------------------------------------
// Central controller, thingy

// About dialog
const ABOUT_HTML = `
<p>Welcome to Lexy's Labyrinth, an exciting old-school tile-based puzzle adventure that is compatible with — but legally distinct from — <a href="https://store.steampowered.com/app/346850/Chips_Challenge_1/">Chip's Challenge</a> and its exciting sequel <a href="https://store.steampowered.com/app/348300/Chips_Challenge_2/">Chip's Challenge 2</a>.</p>
<p>This is a reimplementation from scratch of the game and uses none of its original code or assets.  It aims to match the behavior of the Steam releases (sans obvious bugs), since those are now the canonical versions of the game, but compatibility settings aren't off the table.</p>
<p>The default level pack is the community-made <a href="https://wiki.bitbusters.club/Chip%27s_Challenge_Level_Pack_1">Chip's Challenge Level Pack 1</a>, which I had no hand in whatsoever; please follow the link for full attribution.  With any luck, future releases will include other community level packs, the ability to play your own, and even a way to play the original levels once you've purchased them on Steam!</p>
<p>Source code is on <a href="https://github.com/eevee/lexys-labyrinth">GitHub</a>.</p>
<p>Special thanks to the incredibly detailed <a href="https://bitbusters.club/">Bit Busters Club</a> and its associated wiki and Discord, the latter of which is full of welcoming people who've been more than happy to answer all my burning arcane questions about Chip's Challenge mechanics.  Thank you also to <a href="https://tw2.bitbusters.club/">Tile World</a>, an open source Chip's Challenge 1 emulator whose source code was indispensable, and the origin of the default tileset.</p>
`;
class AboutOverlay extends DialogOverlay {
    constructor(conductor) {
        super(conductor);
        this.set_title("about");
        this.main.innerHTML = ABOUT_HTML;
        this.add_button("cool", ev => {
            this.close();
        });
    }
}

// Options dialog
// functionality?:
// - store local levels and tilesets in localstorage?  (will duplicate space but i'll be able to remember them)
// aesthetics:
// - tileset
// - animations on or off
// compat:
// - flicking
// - that cc2 hook wrapping thing
// - that cc2 thing where a brown button sends a 1-frame pulse to a wired trap
// - cc2 something about blue teleporters at 0, 0 forgetting they're looking for unwired only
// - monsters go in fire
// - rff blocks monsters
// - rff truly random
// - all manner of fucking bugs
// TODO distinguish between deliberately gameplay changes and bugs, though that's kind of an arbitrary line
const AESTHETIC_OPTIONS = [{
    key: 'anim_half_speed',
    label: "Animate at half speed",
    default: true,
    note: "CC2 plays animations at utterly ludicrous speeds and it looks very bad.  This option plays them at half speed (except for explosions and splashes, which have a fixed duration), which is objectively better in every way.",
}, {
    key: 'offset_actors',
    label: "Offset some actors",
    default: true,
    note: "Chip's Challenge typically draws everything in a grid, which looks a bit funny for tall skinny objects like...  the player.  And teeth.  This option draws both of them raised up slightly, so they'll break the grid and add a slight 3D effect.  May not work for all tilesets.",
}];
const COMPAT_OPTIONS = [{
    key: 'tiles_react_instantly',
    label: "Tiles react instantly",
    impls: ['lynx', 'ms'],
    note: "In classic CC, actors moved instantly from one tile to another, so tiles would react (e.g., buttons would become pressed) instantly as well.  CC2 made actors slide smoothly between tiles, and it made more sense visually for the reactions to only happen once the sliding animation had finished.  That's technically a gameplay change, since it delays a lot of tile behavior for 4 tics (the time it takes most actors to move), so here's a compat option.  Works best in conjunction with disabling smooth scrolling; otherwise you'll see strange behavior like completing a level before actually stepping onto the exit.",
}];
const COMPAT_IMPLS = {
    lynx: "Lynx, the original version",
    ms: "Microsoft's Windows port",
    cc2bug: "Bug present in CC2",
};
const OPTIONS_TABS = [{
    name: 'aesthetic',
    label: "Aesthetics",
}, {
    name: 'compat',
    label: "Compatibility",
}];
class OptionsOverlay extends DialogOverlay {
    constructor(conductor) {
        super(conductor);
        this.root.classList.add('dialog-options');
        this.set_title("options");
        this.add_button("well alright then", ev => {
            this.close();
        });

        this.main.append(mk('p', "Sorry!  This stuff doesn't actually work yet."));

        let tab_strip = mk('nav.tabstrip');
        this.main.append(tab_strip);
        this.tab_links = {};
        this.tab_blocks = {};
        this.current_tab = 'aesthetic';
        for (let tabdef of OPTIONS_TABS) {
            let link = mk('a', {href: 'javascript:', 'data-tab': tabdef.name}, tabdef.label);
            link.addEventListener('click', ev => {
                ev.preventDefault();
                this.switch_tab(ev.target.getAttribute('data-tab'));
            });
            tab_strip.append(link);
            this.tab_links[tabdef.name] = link;
            let block = mk('section.tabblock');
            this.main.append(block);
            this.tab_blocks[tabdef.name] = block;

            if (tabdef.name === this.current_tab) {
                link.classList.add('--selected');
                block.classList.add('--selected');
            }
        }

        // Aesthetic tab
        this._add_options(this.tab_blocks['aesthetic'], AESTHETIC_OPTIONS);

        // Compat tab
        this.tab_blocks['compat'].append(
            mk('p', "If you don't know what any of these are for, you can pretty safely ignore them."),
            mk('p', "Changes won't take effect until you restart the level."),
        );
        this._add_options(this.tab_blocks['compat'], COMPAT_OPTIONS);
    }

    _add_options(root, options) {
        let ul = mk('ul');
        root.append(ul);
        for (let optdef of options) {
            let li = mk('li');
            let label = mk('label.option');
            label.append(mk('input', {type: 'checkbox', name: optdef.key}));
            if (optdef.impls) {
                for (let impl of optdef.impls) {
                    label.append(mk('img.compat-icon', {src: `icons/compat-${impl}.png`}));
                }
            }
            label.append(mk('span.option-label', optdef.label));
            let help_icon = mk('img.-help', {src: 'icons/help.png'});
            label.append(help_icon);
            let help_text = mk('p.option-help', optdef.note);
            li.append(label);
            li.append(help_text);
            ul.append(li);
            help_icon.addEventListener('click', ev => {
                help_text.classList.toggle('--visible');
            });
        }
    }

    switch_tab(tab) {
        if (this.current_tab === tab)
            return;

        this.tab_links[this.current_tab].classList.remove('--selected');
        this.tab_blocks[this.current_tab].classList.remove('--selected');
        this.current_tab = tab;
        this.tab_links[this.current_tab].classList.add('--selected');
        this.tab_blocks[this.current_tab].classList.add('--selected');
    }
}

// List of levels
class LevelBrowserOverlay extends DialogOverlay {
    constructor(conductor) {
        super(conductor);
        this.set_title("choose a level");
        let table = mk('table.level-browser');
        this.main.append(table);
        for (let [i, stored_level] of conductor.stored_game.levels.entries()) {
            table.append(mk('tr',
                {'data-index': i},
                mk('td', i + 1),
                mk('td', stored_level.title),
                // TODO score?
                // TODO other stats??
                mk('td', '▶'),
            ));
        }

        table.addEventListener('click', ev => {
            let tr = ev.target.closest('table.level-browser tr');
            if (! tr)
                return;

            let index = parseInt(tr.getAttribute('data-index'), 10);
            this.conductor.change_level(index);
            this.close();
        });

        this.add_button("nevermind", ev => {
            this.close();
        });
    }
}

// Central dispatcher of what we're doing and what we've got loaded
class Conductor {
    constructor(tileset) {
        this.stored_game = null;
        this.tileset = tileset;
        // TODO options and whatnot should go here too

        this.splash = new Splash(this);
        this.editor = new Editor(this);
        this.player = new Player(this);

        // Bind the header buttons
        document.querySelector('#main-about').addEventListener('click', ev => {
            new AboutOverlay(this).open();
        });
        document.querySelector('#main-options').addEventListener('click', ev => {
            new OptionsOverlay(this).open();
        });

        // Bind to the navigation headers, which list the current level pack
        // and level
        this.level_pack_name_el = document.querySelector('#level-pack-name');
        this.level_name_el = document.querySelector('#level-name');
        this.nav_prev_button = document.querySelector('#main-prev-level');
        this.nav_next_button = document.querySelector('#main-next-level');
        this.nav_choose_level_button = document.querySelector('#main-choose-level');
        this.nav_prev_button.addEventListener('click', ev => {
            // TODO confirm
            if (this.stored_game && this.level_index > 0) {
                this.change_level(this.level_index - 1);
            }
            ev.target.blur();
        });
        this.nav_next_button.addEventListener('click', ev => {
            // TODO confirm
            if (this.stored_game && this.level_index < this.stored_game.levels.length - 1) {
                this.change_level(this.level_index + 1);
            }
            ev.target.blur();
        });
        this.nav_choose_level_button.addEventListener('click', ev => {
            if (this.stored_game) {
                new LevelBrowserOverlay(this).open();
            }
            ev.target.blur();
        });
        document.querySelector('#main-change-pack').addEventListener('click', ev => {
            // TODO confirm
            this.switch_to_splash();
        });
        document.querySelector('#player-edit').addEventListener('click', ev => {
            // TODO should be able to jump to editor if we started in the
            // player too!  but should disable score tracking, have a revert
            // button, not be able to save over it, have a warning about
            // cheating...
            this.switch_to_editor();
        });
        document.querySelector('#editor-play').addEventListener('click', ev => {
            // Restart the level to ensure it takes edits into account
            // TODO need to finish thinking out the exact flow between editor/player and what happens when...
            this.player.restart_level();
            this.switch_to_player();
        });

        this.update_nav_buttons();
        this.switch_to_splash();
    }

    switch_to_splash() {
        if (this.current) {
            this.current.deactivate();
        }
        this.splash.activate();
        this.current = this.splash;
        document.body.setAttribute('data-mode', 'splash');
    }

    switch_to_editor() {
        if (this.current) {
            this.current.deactivate();
        }
        this.editor.activate();
        this.current = this.editor;
        document.body.setAttribute('data-mode', 'editor');
    }

    switch_to_player() {
        if (this.current) {
            this.current.deactivate();
        }
        this.player.activate();
        this.current = this.player;
        document.body.setAttribute('data-mode', 'player');
    }

    load_game(stored_game) {
        this.stored_game = stored_game;

        this.player.load_game(stored_game);
        this.editor.load_game(stored_game);

        this.change_level(0);
    }

    change_level(level_index) {
        this.level_index = level_index;
        this.stored_level = this.stored_game.levels[level_index];

        // FIXME do better
        this.level_name_el.textContent = `Level ${level_index + 1} — ${this.stored_level.title}`;

        document.title = `${PAGE_TITLE} - ${this.stored_level.title}`;
        this.update_nav_buttons();

        this.player.load_level(this.stored_level);
        this.editor.load_level(this.stored_level);
    }

    update_nav_buttons() {
        this.nav_choose_level_button.disabled = !this.stored_game;
        this.nav_prev_button.disabled = !this.stored_game || this.level_index <= 0;
        this.nav_next_button.disabled = !this.stored_game || this.level_index >= this.stored_game.levels.length;
    }
}


async function main() {
    let query = new URLSearchParams(location.search);

    // Pick a tileset
    // These alternative ones only exist locally for me at the moment, since
    // they're part of the commercial games!
    let tilesheet = new Image();
    let tilesize;
    let tilelayout;
    if (query.get('tileset') === 'ms') {
        tilesheet.src = 'tileset-ms.png';
        tilesize = 32;
        tilelayout = CC2_TILESET_LAYOUT;
    }
    else if (query.get('tileset') === 'steam') {
        tilesheet.src = 'tileset-steam.png';
        tilesize = 32;
        tilelayout = CC2_TILESET_LAYOUT;
    }
    else if (query.get('tileset') === 'lexy') {
        tilesheet.src = 'tileset-lexy.png';
        tilesize = 32;
        tilelayout = CC2_TILESET_LAYOUT;
    }
    else {
        tilesheet.src = 'tileset-tworld.png';
        tilesize = 48;
        tilelayout = TILE_WORLD_TILESET_LAYOUT;
    }
    await tilesheet.decode();
    let tileset = new Tileset(tilesheet, tilelayout, tilesize, tilesize);

    let conductor = new Conductor(tileset);
    window._conductor = conductor;

    // Pick a level (set)
    // TODO error handling  :(
    let path = query.get('setpath');
    if (path && path.match(/^levels[/]/)) {
        conductor.splash.fetch_pack(path);
    }
}

main();
