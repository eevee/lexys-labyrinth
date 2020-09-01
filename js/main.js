// TODO bugs and quirks i'm aware of:
// - steam: if a player character starts on a force floor they won't be able to make any voluntary movements until they are no longer on a force floor
import * as c2m from './format-c2m.js';
import * as dat from './format-dat.js';
import * as format_util from './format-util.js';
import TILE_TYPES from './tiletypes.js';
import { Tileset, CC2_TILESET_LAYOUT, TILE_WORLD_TILESET_LAYOUT } from './tileset.js';
import { DIRECTIONS } from './defs.js';

function mk(tag_selector, ...children) {
    let [tag, ...classes] = tag_selector.split('.');
    let el = document.createElement(tag);
    el.classList = classes.join(' ');
    if (children.length > 0) {
        if (!(children[0] instanceof Node) && children[0] !== undefined && typeof(children[0]) !== "string" && typeof(children[0]) !== "number") {
            let [attrs] = children.splice(0, 1);
            for (let [key, value] of Object.entries(attrs)) {
                el.setAttribute(key, value);
            }
        }
        el.append(...children);
    }
    return el;
}

function promise_event(element, success_event, failure_event) {
    let resolve, reject;
    let promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });

    let success_handler = e => {
        element.removeEventListener(success_event, success_handler);
        if (failure_event) {
            element.removeEventListener(failure_event, failure_handler);
        }

        resolve(e);
    };
    let failure_handler = e => {
        element.removeEventListener(success_event, success_handler);
        if (failure_event) {
            element.removeEventListener(failure_event, failure_handler);
        }

        reject(e);
    };

    element.addEventListener(success_event, success_handler);
    if (failure_event) {
        element.addEventListener(failure_event, failure_handler);
    }

    return promise;
}

async function fetch(url) {
    let xhr = new XMLHttpRequest;
    let promise = promise_event(xhr, 'load', 'error');
    xhr.open('GET', url);
    xhr.responseType = 'arraybuffer';
    xhr.send();
    await promise;
    return xhr.response;
}


const PAGE_TITLE = "Lexy's Labyrinth";

class Tile {
    constructor(type, x, y, direction = 'south') {
        this.type = type;
        this.x = x;
        this.y = y;
        this.direction = direction;

        this.slide_mode = null;
        this.movement_cooldown = 0;

        if (type.has_inventory) {
            this.inventory = {};
        }
    }

    static from_template(tile_template, x, y) {
        let type = TILE_TYPES[tile_template.name];
        if (! type) console.error(tile_template.name);
        let tile = new this(type, x, y, tile_template.direction);
        if (type.load) {
            type.load(tile, tile_template);
        }
        return tile;
    }

    blocks(other, direction) {
        if (this.type.blocks)
            return true;

        if (this.type.thin_walls &&
            this.type.thin_walls.has(DIRECTIONS[direction].opposite))
            return true;

        if (other.type.is_player && this.type.blocks_players)
            return true;
        if (other.type.is_monster && this.type.blocks_monsters)
            return true;
        if (other.type.is_block && this.type.blocks_blocks)
            return true;

        return false;
    }

    ignores(name) {
        if (this.type.ignores && this.type.ignores.has(name))
            return true;

        if (this.inventory) {
            for (let [item, count] of Object.entries(this.inventory)) {
                if (count === 0)
                    continue;

                let item_type = TILE_TYPES[item];
                if (item_type.item_ignores && item_type.item_ignores.has(name))
                    return true;
            }
        }

        return false;
    }

    become(name) {
        this.type = TILE_TYPES[name];
        // TODO adjust anything else?
    }

    destroy() {
        this.doomed = true;
    }

    // Inventory stuff
    give_item(name) {
        this.inventory[name] = (this.inventory[name] ?? 0) + 1;
    }

    take_item(name, amount = null) {
        if (this.inventory[name] && this.inventory[name] >= 1) {
            if (amount == null && this.type.infinite_items && this.type.infinite_items[name]) {
                // Some items can't be taken away normally, by which I mean,
                // green keys
                ;
            }
            else {
                this.inventory[name] = Math.max(0, this.inventory[name] - (amount || 1));
            }
            return true;
        }
        else {
            return false;
        }
    }
}

class Cell extends Array {
    constructor() {
        super();
        this.is_dirty = false;
    }

    _add(tile) {
        this.push(tile);
    }

    // DO NOT use me to remove a tile permanently, only to move it!
    // Should only be called from Level, which handles some bookkeeping!
    _remove(tile) {
        let layer = this.indexOf(tile);
        if (layer < 0)
            throw new Error("Asked to remove tile that doesn't seem to exist");

        this.splice(layer, 1);
    }

    each(f) {
        for (let i = this.length - 1; i >= 0; i--) {
            if (f(this[i]) === false)
                break;
        }
        this._gc();
    }

    _gc() {
        let p = 0;
        for (let i = 0, l = this.length; i < l; i++) {
            let cell = this[i];
            if (! cell.doomed) {
                if (p !== i) {
                    this[p] = cell;
                }
                p++;
            }
        }
        this.length = p;
    }
}

class Level {
    constructor(stored_level) {
        this.stored_level = stored_level;
        this.width = stored_level.size_x;
        this.height = stored_level.size_y;
        this.restart();
    }

    restart() {
        // playing: normal play
        // success: has been won
        // failure: died
        // note that pausing is NOT handled here, but by whatever's driving our
        // event loop!
        this.state = 'playing';

        this.cells = [];
        this.player = null;
        this.actors = [];
        this.chips_remaining = this.stored_level.chips_required;
        if (this.stored_level.time_limit === 0) {
            this.time_remaining = null;
        }
        else {
            this.time_remaining = this.stored_level.time_limit;
        }
        this.bonus_points = 0;
        this.tic_counter = 0;

        this.hint_shown = null;
        // TODO in lynx/steam, this carries over between levels; in tile world, you can set it manually
        this.force_floor_direction = 'north';

        let n = 0;
        let connectables = [];
        for (let y = 0; y < this.height; y++) {
            let row = [];
            this.cells.push(row);
            for (let x = 0; x < this.width; x++) {
                let cell = new Cell;
                row.push(cell);

                let stored_cell = this.stored_level.linear_cells[n];
                n++;
                let has_cloner, has_forbidden;

                for (let template_tile of stored_cell) {
                    let tile = Tile.from_template(template_tile, x, y);
                    if (tile.type.is_hint) {
                        // Copy over the tile-specific hint, if any
                        tile.specific_hint = template_tile.specific_hint ?? null;
                    }

                    if (tile.type.name === 'cloner') {
                        has_cloner = true;
                    }

                    if (tile.type.is_player) {
                        // TODO handle multiple players, also chip and melinda both
                        // TODO complain if no chip
                        this.player = tile;
                        // Always put the player at the start of the actor list
                        // (accomplished traditionally with a swap)
                        this.actors.push(this.actors[0]);
                        this.actors[0] = tile;
                    }
                    else if (tile.type.is_actor) {
                        if (has_cloner) {
                            tile.stuck = true;
                        }
                        else {
                            this.actors.push(tile);
                        }
                    }
                    cell.push(tile);

                    if (tile.type.connects_to) {
                        connectables.push(tile);
                    }
                }
            }
        }

        // Connect buttons and teleporters
        let num_cells = this.width * this.height;
        for (let connectable of connectables) {
            let x = connectable.x;
            let y = connectable.y;
            let goal = connectable.type.connects_to;
            let direction = 1;
            if (connectable.type.connect_order == 'backward') {
                direction = -1;
            }
            let found = false;
            for (let i = 0; i < num_cells - 1; i++) {
                x += direction;
                if (x >= this.width) {
                    x -= this.width;
                    y = (y + 1) % this.height;
                }
                else if (x < 0) {
                    x += this.width;
                    y = (y - 1 + this.height) % this.height;
                }

                for (let tile of this.cells[y][x]) {
                    if (tile.type.name === goal) {
                        // TODO should be weak, but you can't destroy cloners so in practice not a concern
                        connectable.connection = tile;
                        found = true;
                    }
                }
                if (found)
                    break;
            }
            // TODO soft warn for e.g. a button with no cloner?  (or a cloner with no button?)
        }
    }

    // Move the game state forwards by one tic
    advance_tic(player_direction) {
        if (this.state !== 'playing') {
            console.warn(`Level.advance_tic() called when state is ${this.state}`);
            return;
        }

        // XXX this entire turn order is rather different in ms rules
        for (let actor of this.actors) {
            // TODO strip these out maybe??
            if (actor.doomed)
                continue;

            if (actor.movement_cooldown > 0) {
                actor.movement_cooldown -= 1;
                if (actor.movement_cooldown > 0)
                    continue;
            }
            // XXX does the cooldown drop while in a trap?  is this even right?
            // TODO should still attempt to move (so chip turns), just will be stuck (but wait, do monsters turn?  i don't think so)
            if (actor.stuck)
                continue;

            let direction_preference;
            // Actors can't make voluntary moves on ice, so they're stuck with
            // whatever they've got
            if (actor.slide_mode === 'ice') {
                direction_preference = [actor.direction];
            }
            else if (actor.slide_mode === 'force') {
                // Only the player can make voluntary moves on a force floor,
                // and only if their previous move was an /involuntary/ move on
                // a force floor.  If they do, it overrides the forced move
                // XXX this in particular has some subtleties in lynx (e.g. you
                // can override forwards??) and DEFINITELY all kinds of stuff
                // in ms
                if (actor === this.player &&
                    player_direction &&
                    actor.last_move_was_force)
                {
                    direction_preference = [player_direction];
                    actor.last_move_was_force = false;
                }
                else {
                    direction_preference = [actor.direction];
                    if (actor === this.player) {
                        actor.last_move_was_force = true;
                    }
                }
            }
            else if (actor === this.player) {
                if (player_direction) {
                    direction_preference = [player_direction];
                    actor.last_move_was_force = false;
                }
            }
            else if (actor.type.movement_mode === 'follow-left') {
                // bug behavior: always try turning as left as possible, and
                // fall back to less-left turns when that fails
                let d = DIRECTIONS[actor.direction];
                direction_preference = [d.left, actor.direction, d.right, d.opposite];
            }
            else if (actor.type.movement_mode === 'follow-right') {
                // paramecium behavior: always try turning as right as
                // possible, and fall back to less-right turns when that fails
                let d = DIRECTIONS[actor.direction];
                direction_preference = [d.right, actor.direction, d.left, d.opposite];
            }
            else if (actor.type.movement_mode === 'turn-left') {
                // glider behavior: preserve current direction; if that doesn't
                // work, turn left, then right, then back the way we came
                let d = DIRECTIONS[actor.direction];
                direction_preference = [actor.direction, d.left, d.right, d.opposite];
            }
            else if (actor.type.movement_mode === 'turn-right') {
                // fireball behavior: preserve current direction; if that doesn't
                // work, turn right, then left, then back the way we came
                let d = DIRECTIONS[actor.direction];
                direction_preference = [actor.direction, d.right, d.left, d.opposite];
            }
            else if (actor.type.movement_mode === 'bounce') {
                // bouncy ball behavior: preserve current direction; if that
                // doesn't work, bounce back the way we came
                let d = DIRECTIONS[actor.direction];
                direction_preference = [actor.direction, d.opposite];
            }
            else if (actor.type.movement_mode === 'forward') {
                // blue tank behavior: keep moving forward
                direction_preference = [actor.direction];
            }

            if (! direction_preference)
                continue;

            let moved = false;
            for (let direction of direction_preference) {
                actor.direction = direction;
                if (this.attempt_step(actor, direction)) {
                    moved = true;
                    break;
                }
            }

            // Only set movement cooldown if we actually moved!
            if (moved) {
                // Speed multiplier is based on the tile we landed /on/.
                let speed_multiplier = 1;
                if (actor.slide_mode !== null) {
                    speed_multiplier = 2;
                }
                actor.movement_cooldown = actor.type.movement_speed / speed_multiplier;
            }

            // TODO do i need to do this more aggressively?
            if (this.state === 'success' || this.state === 'failure')
                break;
        }

        if (this.time_remaining !== null) {
            this.tic_counter++;
            while (this.tic_counter > 20) {
                this.tic_counter -= 20;
                this.time_remaining -= 1;
                if (this.time_remaining <= 0) {
                    this.fail("Time's up!");
                }
            }
        }
    }

    fail(message) {
        this.state = 'failure';
        this.fail_message = message;
    }

    win() {
        this.state = 'success';
    }

    // Try to move the given actor one tile in the given direction and update
    // their cooldown.  Return true if successful.
    attempt_step(actor, direction) {
        let move = DIRECTIONS[direction].movement;
        let goal_x = actor.x + move[0];
        let goal_y = actor.y + move[1];

        let blocked;
        if (goal_x >= 0 && goal_x < this.width && goal_y >= 0 && goal_y < this.height) {
            // Check for a thin wall in our current cell first
            let original_cell = this.cells[actor.y][actor.x];
            original_cell.each(tile => {
                if (tile !== actor && tile.type.thin_walls &&
                    tile.type.thin_walls.has(direction))
                {
                    blocked = true;
                    return;
                }
            });

            // Only bother touching the goal cell if we're not already trapped in this one
            // FIXME actually, this prevents flicking!
            if (! blocked) {
                let goal_cell = this.cells[goal_y][goal_x];
                goal_cell.each(tile => {
                    if (! tile.blocks(actor, direction))
                        return;

                    if (actor.type.pushes && actor.type.pushes[tile.type.name]) {
                        if (this.attempt_step(tile, direction))
                            // It moved out of the way!
                            return;
                    }
                    if (tile.type.on_bump) {
                        tile.type.on_bump(tile, this, actor);
                        if (! tile.blocks(actor, direction))
                            // It became something non-blocking!
                            return;
                    }
                    blocked = true;
                    // XXX should i break here, or bump everything?
                });
            }
        }
        else {
            // Hit the edge
            blocked = true;
        }

        if (blocked) {
            if (actor.slide_mode === 'ice') {
                // Actors on ice turn around when they hit something
                actor.direction = DIRECTIONS[direction].opposite;
            }
            return false;
        }

        // We're clear!
        this.move_to(actor, goal_x, goal_y);
        return true;
    }

    // Move the given actor to the given position and perform any appropriate
    // tile interactions.  Does NOT check for whether the move is actually
    // legal; use attempt_step for that!
    move_to(actor, x, y) {
        if (x === actor.x && y === actor.y)
            return;

        let goal_cell = this.cells[y][x];
        let original_cell = this.cells[actor.y][actor.x];
        original_cell._remove(actor);
        actor.slide_mode = null;
        goal_cell._add(actor);
        actor.x = x;
        actor.y = y;

        original_cell.is_dirty = true;
        goal_cell.is_dirty = true;

        // Announce we're leaving, for the handful of tiles that care about it
        original_cell.each(tile => {
            if (tile === actor)
                return;
            if (actor.ignores(tile.type.name))
                return;

            if (tile.type.on_depart) {
                tile.type.on_depart(tile, this, actor);
            }
        });

        // Step on all the tiles in the new cell
        if (actor === this.player) {
            this.hint_shown = null;
        }
        let teleporter;
        goal_cell.each(tile => {
            if (tile === actor)
                return;
            if (actor.ignores(tile.type.name))
                return;

            if (actor === this.player && tile.type.is_hint) {
                this.hint_shown = tile.specific_hint ?? this.stored_level.hint;
            }

            if (tile.type.is_item && actor.type.has_inventory) {
                actor.give_item(tile.type.name);
                tile.destroy();
            }
            else if (tile.type.is_teleporter) {
                teleporter = tile;
            }
            else if (tile.type.on_arrive) {
                tile.type.on_arrive(tile, this, actor);
            }

            if ((actor.type.is_player && tile.type.is_monster) ||
                (actor.type.is_monster && tile.type.is_player))
            {
                // TODO ooh, obituaries
                this.fail("Oops!  Watch out for creatures!");
            }
        });

        // Handle teleporting, now that the dust has cleared
        let current_cell = goal_cell;
        if (teleporter) {
            let goal = teleporter.connection;
            // TODO in pathological cases this might infinite loop
            while (true) {
                // Physically move the actor to the new teleporter
                // XXX is this right, compare with tile world?  i overhear it's actually implemented as a slide?
                // XXX will probably play badly with undo lol
                let tele_cell = this.cells[goal.y][goal.x];
                current_cell._remove(actor);
                tele_cell._add(actor);
                current_cell = tele_cell;
                actor.x = goal.x;
                actor.y = goal.y;
                if (this.attempt_step(actor, actor.direction))
                    // Success, teleportation complete
                    break;
                if (goal === teleporter)
                    // We've tried every teleporter, including the one they
                    // stepped on, so leave them on it
                    break;

                // Otherwise, try the next one
                goal = goal.connection;
            }
        }
    }

    // -------------------------------------------------------------------------
    // Level alteration methods.  EVERYTHING that changes the state of a level,
    // including the state of a single tile, should do it through one of these
    // for undo/rewind purposes

    collect_chip() {
        if (this.chips_remaining > 0) {
            this.chips_remaining--;
        }
    }

    // Get the next direction a random force floor will use.  They share global
    // state and cycle clockwise.
    get_force_floor_direction() {
        let d = this.force_floor_direction;
        this.force_floor_direction = DIRECTIONS[d].right;
        return d;
    }

    // TODO make a set of primitives for actually altering the level that also
    // record how to undo themselves
    make_slide(actor, mode) {
        actor.slide_mode = mode;
    }
}


// Stackable modal overlay of some kind, usually a dialog
class Overlay {
    constructor(game, root) {
        this.game = game;
        this.root = root;

        // Don't propagate clicks on the root element, so they won't trigger a
        // parent overlay's automatic dismissal
        this.root.addEventListener('click', ev => {
            ev.stopPropagation();
        });
    }

    open() {
        if (this.game.state === 'playing') {
            this.game.set_state('paused');
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
    constructor(game) {
        super(game, mk('div.dialog'));

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
    constructor(game, message, what) {
        super(game);
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

// About dialog
const ABOUT_HTML = `
<p>Welcome to Lexy's Labyrinth, an exciting old-school tile-based puzzle adventure that is compatible with — but legally distinct from — <a href="https://store.steampowered.com/app/346850/Chips_Challenge_1/">Chip's Challenge</a> and its exciting sequel <a href="https://store.steampowered.com/app/348300/Chips_Challenge_2/">Chip's Challenge 2</a>.</p>
<p>This is a reimplementation from scratch of the game and uses none of its original code or assets.  It aims to match the behavior of the Steam releases (sans obvious bugs), since those are now the canonical versions of the game, but compatibility settings aren't off the table.</p>
<p>The default level pack is the community-made <a href="https://wiki.bitbusters.club/Chip%27s_Challenge_Level_Pack_1">Chip's Challenge Level Pack 1</a>, which I had no hand in whatsoever; please follow the link for full attribution.  With any luck, future releases will include other community level packs, the ability to play your own, and even a way to play the original levels once you've purchased them on Steam!</p>
<p>Source code is on <a href="https://github.com/eevee/lexys-labyrinth">GitHub</a>.</p>
<p>Special thanks to the incredibly detailed <a href="https://bitbusters.club/">Bit Busters Club</a> and its associated wiki and Discord, the latter of which is full of welcoming people who've been more than happy to answer all my burning arcane questions about Chip's Challenge mechanics.  Thank you also to <a href="https://tw2.bitbusters.club/">Tile World</a>, an open source Chip's Challenge 1 emulator whose source code was indispensable, and the origin of the default tileset.</p>
`;
class AboutOverlay extends DialogOverlay {
    constructor(game) {
        super(game);
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
class OptionsOverlay extends DialogOverlay {
    constructor(game) {
        super(game);
        this.set_title("options");
        this.main.append(mk('p', "Sorry!  None implemented yet."));
        this.add_button("well alright then", ev => {
            this.close();
        });
    }
}

// List of levels
class LevelBrowserOverlay extends DialogOverlay {
    constructor(game) {
        super(game);
        this.set_title("choose a level");
        let table = mk('table.level-browser');
        this.main.append(table);
        for (let [i, stored_level] of game.stored_game.levels.entries()) {
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
            this.game.load_level(index);
            this.close();
        });

        this.add_button("nevermind", ev => {
            this.close();
        });
    }
}

// TODO:
// - some kinda visual theme i guess lol
// - level password, if any
// - timer!!!!!
// - bonus points (cc2 only, or maybe only if got any so far this level)
// - intro splash with list of available level packs
// - button: quit to splash
// - implement winning and show score for this level
// - show current score so far
// - about, help
const GAME_UI_HTML = `
<header>
    <h1>Lexy's Labyrinth</h1>
    <nav>
        <button class="nav-about" type="button">about</button>
        <button class="nav-help" type="button" disabled>help</button>
        <button class="nav-options" type="button">options</button>
    </nav>
</header>
<main>
    <header>
        <h1 class="level-set">Chip's Challenge Level Pack 1</h1>
        <nav>
            <button class="set-nav-return" type="button" disabled>Change pack</button>
        </nav>
        <h2 class="level-name">Level 1 — Key Pyramid</h2>
        <nav class="nav">
            <button class="nav-prev" type="button">⬅️\ufe0e</button>
            <button class="nav-browse" type="button">Level select</button>
            <button class="nav-next" type="button">➡️\ufe0e</button>
        </nav>
    </header>
    <div class="level"><!-- level canvas and any overlays go here --></div>
    <div class="bummer"></div>
    <div class="message"></div>
    <div class="chips">
        <h3>Chips</h3>
        <output></output>
    </div>
    <div class="time">
        <h3>Time</h3>
        <output></output>
    </div>
    <div class="bonus">
        <h3>Bonus</h3>
        <output></output>
    </div>
    <div class="inventory"></div>
    <div class="controls">
        <button class="control-pause" type="button">Pause</button>
        <button class="control-restart" type="button">Restart</button>
        <button class="control-undo" type="button" disabled>Undo</button>
        <button class="control-rewind" type="button" disabled>Rewind</button>
    </div>
    <div class="demo">
        <h2>Solution demo available</h2>
        <div class="demo-controls">
            <button class="demo-play" type="button">Restart and play</button>
            <button class="demo-step-1" type="button">Step 1 tic</button>
            <button class="demo-step-4" type="button">Step 1 move</button>
            <button class="demo-step-20" type="button">Step 1 second</button>
        </div>
        <div class="input"></div>
    </div>
</main>
`;
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
class Game {
    constructor(stored_game, tileset) {
        this.stored_game = stored_game;
        this.tileset = tileset;
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

        // TODO obey level options; allow overriding
        this.viewport_size_x = 9;
        this.viewport_size_y = 9;

        document.body.innerHTML = GAME_UI_HTML;
        this.container = document.body.querySelector('main');
        this.container.style.setProperty('--tile-width', `${this.tileset.size_x}px`);
        this.container.style.setProperty('--tile-height', `${this.tileset.size_y}px`);
        this.level_el = this.container.querySelector('.level');
        this.level_name_el = this.container.querySelector('.level-name');
        this.message_el = this.container.querySelector('.message');
        this.chips_el = this.container.querySelector('.chips output');
        this.time_el = this.container.querySelector('.time output');
        this.bonus_el = this.container.querySelector('.bonus output');
        this.inventory_el = this.container.querySelector('.inventory');
        this.bummer_el = this.container.querySelector('.bummer');
        this.input_el = this.container.querySelector('.input');
        this.demo_el = this.container.querySelector('.demo');

        // Populate stuff
        let header = document.body.querySelector('body > header');
        header.querySelector('.nav-about').addEventListener('click', ev => {
            new AboutOverlay(this).open();
        });
        header.querySelector('.nav-options').addEventListener('click', ev => {
            new OptionsOverlay(this).open();
        });

        // Populate navigation
        let nav_el = this.container.querySelector('.nav');
        this.nav_prev_button = nav_el.querySelector('.nav-prev');
        this.nav_next_button = nav_el.querySelector('.nav-next');
        this.nav_prev_button.addEventListener('click', ev => {
            // TODO confirm
            if (this.level_index > 0) {
                this.load_level(this.level_index - 1);
            }
            ev.target.blur();
        });
        this.nav_next_button.addEventListener('click', ev => {
            // TODO confirm
            if (this.level_index < this.stored_game.levels.length - 1) {
                this.load_level(this.level_index + 1);
            }
            ev.target.blur();
        });
        nav_el.querySelector('.nav-browse').addEventListener('click', ev => {
            new LevelBrowserOverlay(this).open();
        });

        // Bind buttons
        this.pause_button = this.container.querySelector('.controls .control-pause');
        this.pause_button.addEventListener('click', ev => {
            this.toggle_pause();
            ev.target.blur();
        });
        this.restart_button = this.container.querySelector('.controls .control-restart');
        this.restart_button.addEventListener('click', ev => {
            new ConfirmOverlay(this, "Abandon this attempt and try again?", () => {
                this.restart_level();
            }).open();
            ev.target.blur();
        });
        // Demo playback
        this.container.querySelector('.demo .demo-step-1').addEventListener('click', ev => {
            this.advance_by(1);
        });
        this.container.querySelector('.demo .demo-step-4').addEventListener('click', ev => {
            this.advance_by(4);
        });
        this.container.querySelector('.demo .demo-step-20').addEventListener('click', ev => {
            this.advance_by(20);
        });

        // Populate inventory
        this._inventory_tiles = {};
        let floor_tile = this.render_inventory_tile('floor');
        this.inventory_el.style.backgroundImage = `url(${floor_tile})`;

        this.level_canvas = mk('canvas', {width: tileset.size_x * this.viewport_size_x, height: tileset.size_y * this.viewport_size_y});
        this.level_el.append(this.level_canvas);
        this.level_canvas.setAttribute('tabindex', '-1');
        this.level_canvas.addEventListener('auxclick', ev => {
            if (ev.button !== 1)
                return;

            let rect = this.level_canvas.getBoundingClientRect();
            let x = Math.floor((ev.clientX - rect.x) / 2 / this.tileset.size_x + this.viewport_x);
            let y = Math.floor((ev.clientY - rect.y) / 2 / this.tileset.size_y + this.viewport_y);
            this.level.move_to(this.level.player, x, y);
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
                        this.load_level(this.level_index + 1);
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
        this.input_el = this.container.querySelector('.input');
        this.input_action_elements = {};
        for (let [action, label] of Object.entries(ACTION_LABELS)) {
            let el = mk('span.input-action', {'data-action': action}, label);
            this.input_el.append(el);
            this.input_action_elements[action] = el;
        }

        // Done with UI, now we can load a level
        this.load_level(0);

        if (false && this.level.stored_level.demo) {
            this.demo = this.level.stored_level.demo[Symbol.iterator]();
            // FIXME should probably start playback on first input
            this.set_state('playing');
        }
        else {
            // TODO update these, as appropriate, when loading a level
            this.input_el.style.display = 'none';
            this.demo_el.style.display = 'none';
        }

        // Auto-size the level canvas, both now and on resize
        this.adjust_scale();
        window.addEventListener('resize', ev => {
            this.adjust_scale();
        });

        this.frame = 0;
        this.tic = 0;
        requestAnimationFrame(this.do_frame.bind(this));
    }

    load_level(level_index) {
        // TODO clear out input?  (when restarting, too?)
        this.level_index = level_index;
        this.level = new Level(this.stored_game.levels[level_index]);
        // waiting: haven't yet pressed a key so the timer isn't going
        // playing: playing normally
        // paused: um, paused
        // rewinding: playing backwards
        // stopped: level has ended one way or another
        this.set_state('waiting');

        // FIXME do better
        this.level_name_el.textContent = `Level ${level_index + 1} — ${this.level.stored_level.title}`;

        document.title = `${PAGE_TITLE} - ${this.level.stored_level.title}`;

        this.nav_prev_button.disabled = level_index <= 0;
        this.nav_next_button.disabled = level_index >= this.stored_game.levels.length;
        this.update_ui();
        this.redraw();
    }

    restart_level() {
        this.level.restart();
        this.set_state('waiting');
        this.update_ui();
        this.redraw();
    }

    get_input() {
        if (this.demo) {
            let step = this.demo.next();
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
            this.tic++;

            if (this.level.state !== 'playing') {
                // We either won or lost!
                this.set_state('stopped');
                break;
            }
        }
        this.redraw();
        this.update_ui();
    }

    do_frame() {
        if (this.state === 'playing') {
            this.frame++;
            if (this.frame % 3 === 0) {
                this.advance_by(1);
            }
            this.frame %= 60;
        }

        requestAnimationFrame(this.do_frame.bind(this));
    }

    render_inventory_tile(name) {
        if (! this._inventory_tiles[name]) {
            // TODO reuse the canvas
            let canvas = mk('canvas', {width: this.tileset.size_x, height: this.tileset.size_y});
            this.tileset.draw({type: TILE_TYPES[name]}, canvas.getContext('2d'), 0, 0);
            this._inventory_tiles[name] = canvas.toDataURL();
        }
        return this._inventory_tiles[name];
    }

    update_ui() {
        this.pause_button.disabled = !(this.state === 'playing' || this.state === 'paused');
        this.restart_button.disabled = (this.state === 'waiting');

        // TODO can we do this only if they actually changed?
        this.chips_el.textContent = this.level.chips_remaining;
        if (this.level.time_remaining === null) {
            this.time_el.textContent = '---';
        }
        else {
            this.time_el.textContent = this.level.time_remaining;
        }
        this.bonus_el.textContent = this.level.bonus_points;
        this.message_el.textContent = this.level.hint_shown ?? "";

        this.inventory_el.textContent = '';
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
                let base = (this.level_index + 1) * 500;
                let time = (this.level.time_remaining || 0) * 10;
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
    }

    redraw() {
        let ctx = this.level_canvas.getContext('2d');
        ctx.clearRect(0, 0, this.level_canvas.width, this.level_canvas.height);

        let xmargin = (this.viewport_size_x - 1) / 2;
        let ymargin = (this.viewport_size_y - 1) / 2;
        let x0 = this.level.player.x - xmargin;
        let y0 = this.level.player.y - ymargin;
        x0 = Math.max(0, Math.min(this.level.width - this.viewport_size_x, x0));
        y0 = Math.max(0, Math.min(this.level.height - this.viewport_size_y, y0));
        this.viewport_x = x0;
        this.viewport_y = y0;
        for (let dx = 0; dx < this.viewport_size_x; dx++) {
            for (let dy = 0; dy < this.viewport_size_y; dy++) {
                let cell = this.level.cells[dy + y0][dx + x0];
                /*
                if (! cell.is_dirty)
                    continue;
                */
                cell.is_dirty = false;

                for (let tile of cell) {
                    if (! tile.doomed) {
                        this.tileset.draw(tile, ctx, dx, dy);
                    }
                }
            }
        }
    }

    // Auto-size the game canvas to fit the screen, if possible
    adjust_scale() {
        // TODO make this optional
        // The base size is the size of the canvas, i.e. the viewport size
        // times the tile size
        let base_x = this.tileset.size_x * this.viewport_size_x;
        let base_y = this.tileset.size_y * this.viewport_size_y;
        // The main UI is centered in a flex item with auto margins, so the
        // extra space available is the size of those margins
        let style = window.getComputedStyle(this.container);
        let extra_x = parseFloat(style['margin-left']) + parseFloat(style['margin-right']);
        let extra_y = parseFloat(style['margin-top']) + parseFloat(style['margin-bottom']);
        // The total available space, then, is the current size of the
        // canvas plus the size of the margins
        let total_x = extra_x + this.level_canvas.offsetWidth;
        let total_y = extra_y + this.level_canvas.offsetHeight;
        // Divide to find the biggest scale that still fits.  But don't
        // exceed 90% of the available space, or it'll feel cramped.
        let scale = Math.floor(0.9 * Math.min(total_x / base_x, total_y / base_y));
        if (scale <= 0) {
            scale = 1;
        }
        // FIXME this doesn't take into account the inventory, which is also affected by scale
        this.container.style.setProperty('--scale', scale);
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

    // Pick a level (set)
    // TODO error handling  :(
    let stored_game;
    let path = query.get('setpath');
    if (path && path.match(/^levels[/]/)) {
        let data = await fetch(path);
        if (path.match(/\.(?:dat|ccl)$/i)) {
            stored_game = dat.parse_game(data);
        }
        else {
            stored_game = new format_util.StoredGame;
            stored_game.levels.push(c2m.parse_level(data));
        }
    }
    else {
        // TODO also support tile world's DAC when reading from local??
        // TODO ah, there's more metadata in CCX, crapola
        stored_game = dat.parse_game(await fetch('levels/CCLP1.ccl'));
    }
    let game = new Game(stored_game, tileset);

    if (query.get('debug')) {
        game.debug = true;
    }
}

main();
