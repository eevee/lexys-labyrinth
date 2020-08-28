// TODO bugs and quirks i'm aware of:
// - steam: if a player character starts on a force floor they won't be able to make any voluntary movements until they are no longer on a force floor
import * as c2m from './format-c2m.js';
import * as dat from './format-dat.js';
import { TILE_TYPES, CC2_TILE_TYPES } from './tiletypes.js';
import { Tileset, CC2_TILESET_LAYOUT, TILE_WORLD_TILESET_LAYOUT } from './tileset.js';

function mk(tag_selector, ...children) {
    let [tag, ...classes] = tag_selector.split('.');
    let el = document.createElement(tag);
    el.classList = classes.join(' ');
    if (children.length > 0) {
        if (!(children[0] instanceof Node) && typeof(children[0]) !== "string" && typeof(children[0]) !== "number") {
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


class Tile {
    constructor(type, x, y, direction = null) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.direction = direction;
        if (type.has_direction && ! direction) {
            this.direction = 'south';
        }

        this.slide_mode = null;

        if (type.has_inventory) {
            this.inventory = {};
        }
    }

    static from_template(tile_template, x, y) {
        return new this(TILE_TYPES[tile_template.name], x, y, tile_template.direction);
    }

    ignores(name) {
        if (this.type.ignores && this.type.ignores.has(name))
            return true;

        for (let [item, count] of Object.entries(this.inventory)) {
            if (count === 0)
                continue;

            let item_type = TILE_TYPES[item];
            if (item_type.item_ignores && item_type.item_ignores.has(name))
                return true;
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

    take_item(name) {
        if (this.inventory[name] && this.inventory[name] >= 1) {
            if (!(this.type.infinite_items && this.type.infinite_items[name])) {
                this.inventory[name]--;
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

const DIRECTIONS = {
    north: {
        movement: [0, -1],
        left: 'west',
        right: 'east',
    },
    south: {
        movement: [0, 1],
        left: 'east',
        right: 'west',
    },
    west: {
        movement: [-1, 0],
        left: 'south',
        right: 'north',
    },
    east: {
        movement: [1, 0],
        left: 'north',
        right: 'south',
    },
};

class Level {
    constructor(stored_level) {
        this.stored_level = stored_level;
        this.width = stored_level.size_x;
        this.height = stored_level.size_y;
        this.restart();

        // playing: normal play
        // success: has been won
        // failure: died
        // paused: paused
        this.state = 'playing';
    }

    restart() {
        this.cells = [];
        this.player = null;
        this.actors = [];
        this.chips_remaining = this.stored_level.chips_required;

        this.hint_shown = null;

        let n = 0;
        for (let y = 0; y < this.height; y++) {
            let row = [];
            this.cells.push(row);
            for (let x = 0; x < this.width; x++) {
                let cell = new Cell;
                row.push(cell);

                let template_cell = this.stored_level.linear_cells[n];
                n++;
                
                for (let template_tile of template_cell) {
                    let tile = Tile.from_template(template_tile, x, y);
                    if (tile.type.is_player) {
                        // TODO handle multiple players, also chip and melinda both
                        // TODO complain if no chip
                        this.player = tile;
                    }
                    if (tile.type.is_actor) {
                        this.actors.push(tile);
                    }
                    cell.push(tile);
                }
                // Make the bottom tile be /first/
                cell.reverse();
            }
        }
    }

    halftic() {
        if (this.state !== 'playing') {
            console.warn(`Level.halftic() called when state is ${this.state}`);
            return;
        }

        for (let actor of this.actors) {
            if (actor.slide_mode !== null) {
                // TODO do we stop sliding if we hit something, too?
                this.attempt_step(actor, actor.direction);
            }

            if (this.state === 'success' || this.state === 'failure')
                break;
        }
    }

    advance(player_direction) {
        if (this.state !== 'playing') {
            console.warn(`Level.advance() called when state is ${this.state}`);
            return;
        }

        for (let actor of this.actors) {
            // TODO skip doomed?  strip them out?  hm
            if (actor.slide_mode === 'ice') {
                // Actors can't make voluntary moves on ice
                continue;
            }
            if (actor === this.player) {
                if (player_direction) {
                    actor.direction = player_direction;
                    this.attempt_step(actor, player_direction);
                }
            }
            else {
                // bug behavior: always try turning as left as possible, and
                // fall back to less-left turns when that fails
                let direction = DIRECTIONS[actor.direction].left;
                for (let i = 0; i < 4; i++) {
                    if (this.attempt_step(actor, direction)) {
                        actor.direction = direction;
                        break;
                    }
                    direction = DIRECTIONS[direction].right;
                }
            }

            // TODO do i need to do this more aggressively?
            if (this.state === 'success' || this.state === 'failure')
                break;
        }
    }

    fail(message) {
        this.state = 'failure';
        this.fail_message = message;
    }

    attempt_step(actor, direction) {
        let move = DIRECTIONS[direction].movement;
        let goal_x = actor.x + move[0];
        let goal_y = actor.y + move[1];
        let goal_cell = this.cells[goal_y][goal_x];

        let blocks;
        goal_cell.each(tile => {
            if (tile !== actor && tile.type.blocks) {
                if (actor.type.pushes && actor.type.pushes[tile.type.name]) {
                    if (this.attempt_step(tile, direction))
                        // It moved out of the way!
                        return;
                }
                if (tile.type.on_bump) {
                    tile.type.on_bump(tile, this, actor);
                    if (! tile.type.blocks)
                        // It became something non-blocking!
                        return;
                }
                blocks = true;
                // XXX should i break here, or bump everything?
            }
        });

        if (blocks) {
            if (actor.slide_mode === 'ice') {
                // Actors on ice turn around when they hit something
                actor.direction = DIRECTIONS[DIRECTIONS[direction].left].left;
            }
            return false;
        }

        // We're clear!
        this.move_to(actor, goal_x, goal_y);
        return true;
    }

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

        // Step on all the tiles in the new cell
        if (actor === this.player) {
            this.hint_shown = null;
        }
        goal_cell.each(tile => {
            if (tile === actor)
                return;
            if (actor.ignores(tile.type.name))
                return;

            if (actor === this.player && tile.type.name === 'hint') {
                this.hint_shown = this.stored_level.hint;
            }

            if (tile.type.is_item && actor.type.has_inventory) {
                actor.give_item(tile.type.name);
                tile.destroy();
            }
            else if (tile.type.on_arrive) {
                tile.type.on_arrive(tile, this, actor);
            }
        });
    }

    collect_chip() {
        if (this.chips_remaining > 0) {
            this.chips_remaining--;
        }
    }

    // TODO make a set of primitives for actually altering the level that also
    // record how to undo themselves
    make_slide(actor, mode) {
        actor.slide_mode = mode;
    }
}

const GAME_UI_HTML = `
<main>
    <div class="level"><!-- level canvas and any overlays go here --></div>
    <div class="meta"></div>
    <div class="nav">
        <button class="nav-prev" type="button">«</button>
        <button class="nav-browse" type="button">Choose level...</button>
        <button class="nav-next" type="button">»</button>
    </div>
    <div class="hint"></div>
    <div class="chips"></div>
    <div class="time"></div>
    <div class="inventory"></div>
    <div class="bummer"></div>
</main>
`;
class Game {
    constructor(stored_game, tileset) {
        this.stored_game = stored_game;
        this.tileset = tileset;

        // TODO obey level options; allow overriding
        this.camera_size_x = 9;
        this.camera_size_y = 9;

        this.container = document.body;
        this.container.innerHTML = GAME_UI_HTML;
        this.level_el = this.container.querySelector('.level');
        this.meta_el = this.container.querySelector('.meta');
        this.nav_el = this.container.querySelector('.nav');
        this.hint_el = this.container.querySelector('.hint');
        this.chips_el = this.container.querySelector('.chips');
        this.time_el = this.container.querySelector('.time');
        this.inventory_el = this.container.querySelector('.inventory');
        this.bummer_el = this.container.querySelector('.bummer');

        this.nav_prev_button = this.nav_el.querySelector('.nav-prev');
        this.nav_next_button = this.nav_el.querySelector('.nav-next');
        this.nav_prev_button.addEventListener('click', ev => {
            // TODO confirm
            if (this.level_index > 0) {
                this.load_level(this.level_index - 1);
            }
        });
        this.nav_next_button.addEventListener('click', ev => {
            // TODO confirm
            if (this.level_index < this.stored_game.levels.length - 1) {
                this.load_level(this.level_index + 1);
            }
        });

        this.load_level(0);

        this.level_canvas = mk('canvas', {width: tileset.size_x * this.camera_size_x, height: tileset.size_y * this.camera_size_y});
        this.level_el.append(this.level_canvas);
        this.level_canvas.setAttribute('tabindex', '-1');

        let last_key;
        this.pending_player_move = null;
        this.next_player_move = null;
        this.player_used_move = false;
        let key_target = this.container;
        // TODO this could all probably be more rigorous but it's fine for now
        key_target.addEventListener('keydown', ev => {
            let direction;
            if (ev.key === 'ArrowDown') {
                direction = 'south';
            }
            else if (ev.key === 'ArrowUp') {
                direction = 'north';
            }
            else if (ev.key === 'ArrowLeft') {
                direction = 'west';
            }
            else if (ev.key === 'ArrowRight') {
                direction = 'east';
            }
            
            if (! direction)
                return;
            ev.stopPropagation();
            ev.preventDefault();

            last_key = ev.key;
            this.pending_player_move = direction;
            this.next_player_move = direction;
            this.player_used_move = false;
        });
        key_target.addEventListener('keyup', ev => {
            if (ev.key === last_key) {
                last_key = null;
                this.pending_player_move = null;
                if (this.player_used_move) {
                    this.next_player_move = null;
                }
            }
        });

        this.redraw();

        this.frame = 0;
        this.tick++;
        requestAnimationFrame(this.do_frame.bind(this));
    }

    load_level(level_index) {
        this.level_index = level_index;
        this.level = new Level(this.stored_game.levels[level_index]);
        // FIXME do better
        this.meta_el.textContent = this.level.stored_level.title;

        this.nav_prev_button.disabled = level_index <= 0;
        this.nav_next_button.disabled = level_index >= this.stored_game.levels.length;
        this.update_ui();
    }

    do_frame() {
        if (this.level.state === 'playing') {
            this.frame++;
            if (this.frame % 6 === 0) {
                this.level.halftic();
            }
            if (this.frame % 12 === 0) {
                this.level.advance(this.next_player_move);
                this.next_player_move = this.pending_player_move;
                this.player_used_move = true;
            }
            if (this.frame % 6 === 0) {
                this.redraw();
            }
            this.frame %= 60;

            this.update_ui();
        }

        requestAnimationFrame(this.do_frame.bind(this));
    }

    update_ui() {
        // TODO can we do this only if they actually changed?
        this.chips_el.textContent = this.level.chips_remaining;
        this.hint_el.textContent = this.level.hint_shown ?? '';

        if (this.level.state === 'failure') {
            this.bummer_el.textContent = this.level.fail_message;
        }
        else {
            this.bummer_el.textContent = '';
        }
    }
        
    redraw() {
        let ctx = this.level_canvas.getContext('2d');
        ctx.clearRect(0, 0, this.level_canvas.width, this.level_canvas.height);

        let camera_x = this.level.player.x - (this.camera_size_x - 1) / 2;
        let camera_y = this.level.player.y - (this.camera_size_y - 1) / 2;
        for (let dx = 0; dx < this.camera_size_x; dx++) {
            for (let dy = 0; dy < this.camera_size_y; dy++) {
                let cell = this.level.cells[dy + camera_y][dx + camera_x];
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
}

async function load_level(url) {
    let xhr = new XMLHttpRequest;
    let promise = promise_event(xhr, 'load', 'error');
    xhr.open('GET', url);
    xhr.responseType = 'arraybuffer';
    xhr.send();
    await promise;
    let data = xhr.response;
    return c2m.parse(data);
}

async function load_game(url) {
    let xhr = new XMLHttpRequest;
    let promise = promise_event(xhr, 'load', 'error');
    xhr.open('GET', url);
    xhr.responseType = 'arraybuffer';
    xhr.send();
    await promise;
    let data = xhr.response;
    return dat.parse_game(data);
}



async function main() {
    //let game = new Game;
    let tiles = new Image();
    //tiles.src = 'tileset-ms.png';
    tiles.src = 'tileset-tworld.png';
    //tiles.src = 'tileset-lexy.png';
    //await promise_event(tiles, 'load', 'error');
    await tiles.decode();
    //let tileset = new Tileset(tiles, CC2_TILESET_LAYOUT, TILE_SIZE_X, TILE_SIZE_Y);
    let tileset = new Tileset(tiles, TILE_WORLD_TILESET_LAYOUT, 48, 48);

    let level_file = '001-020/map001.c2m';
    if (location.search) {
        level_file = '001-020/' + location.search.substring(1);
    }
    // TODO error handling, yadda
    //let stored_level = await load_level(level_file);
    // TODO also support tile world's DAC when reading from local??
    // TODO ah, there's more metadata in CCX, crapola
    let stored_game = await load_game('levels/CCLP1.ccl');
    let game = new Game(stored_game, tileset);
}

main();
