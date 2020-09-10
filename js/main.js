// TODO bugs and quirks i'm aware of:
// - steam: if a player character starts on a force floor they won't be able to make any voluntary movements until they are no longer on a force floor
import { DIRECTIONS, TICS_PER_SECOND } from './defs.js';
import * as c2m from './format-c2m.js';
import * as dat from './format-dat.js';
import * as format_util from './format-util.js';
import CanvasRenderer from './renderer-canvas.js';
import { Tileset, CC2_TILESET_LAYOUT, TILE_WORLD_TILESET_LAYOUT } from './tileset.js';
import TILE_TYPES from './tiletypes.js';
import { mk, promise_event, fetch, walk_grid } from './util.js';

const PAGE_TITLE = "Lexy's Labyrinth";

class Tile {
    constructor(type, direction = 'south') {
        this.type = type;
        this.direction = direction;
        this.cell = null;

        this.slide_mode = null;
        this.movement_cooldown = 0;

        if (type.has_inventory) {
            this.inventory = {};
        }
    }

    static from_template(tile_template) {
        let type = TILE_TYPES[tile_template.name];
        if (! type) console.error(tile_template.name);
        let tile = new this(type, tile_template.direction);
        if (type.load) {
            type.load(tile, tile_template);
        }
        return tile;
    }

    // Gives the effective position of an actor in motion, given smooth scrolling
    visual_position(tic_offset = 0) {
        let x = this.cell.x;
        let y = this.cell.y;
        if (! this.previous_cell) {
            return [x, y];
        }
        else {
            let p = (this.animation_progress + tic_offset) / this.animation_speed;
            return [
                (1 - p) * this.previous_cell.x + p * x,
                (1 - p) * this.previous_cell.y + p * y,
            ];
        }
    }

    blocks(other, direction) {
        if (this.type.blocks_all)
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
    constructor(x, y) {
        super();
        this.x = x;
        this.y = y;
    }

    _add(tile, index = null) {
        if (index === null) {
            this.push(tile);
        }
        else {
            this.splice(index, 0, tile);
        }
        tile.cell = this;
    }

    // DO NOT use me to remove a tile permanently, only to move it!
    // Should only be called from Level, which handles some bookkeeping!
    _remove(tile) {
        let index = this.indexOf(tile);
        if (index < 0)
            throw new Error("Asked to remove tile that doesn't seem to exist");

        this.splice(index, 1);
        tile.cell = null;
        return index;
    }
}

class Level {
    constructor(stored_level, compat = {}) {
        this.stored_level = stored_level;
        this.width = stored_level.size_x;
        this.height = stored_level.size_y;
        this.size_x = stored_level.size_x;
        this.size_y = stored_level.size_y;
        this.restart(compat);
    }

    restart(compat) {
        this.compat = {};

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
        // 0 to 7, indicating the first tic that teeth can move on.
        // 0 is equivalent to even step; 4 is equivalent to odd step.
        // 5 is the default in CC2.  Lynx can use any of the 8.  MSCC uses
        // either 0 or 4, and defaults to 0, but which you get depends on the
        // global clock which doesn't get reset between levels (!).
        this.step_parity = 5;

        this.hint_shown = null;
        // TODO in lynx/steam, this carries over between levels; in tile world, you can set it manually
        this.force_floor_direction = 'north';

        this.undo_stack = [];
        this.pending_undo = [];

        let n = 0;
        let connectables = [];
        // FIXME handle traps correctly:
        // - if an actor is in the cell, set the trap to open and unstick everything in it
        for (let y = 0; y < this.height; y++) {
            let row = [];
            this.cells.push(row);
            for (let x = 0; x < this.width; x++) {
                let cell = new Cell(x, y);
                row.push(cell);

                let stored_cell = this.stored_level.linear_cells[n];
                n++;
                let has_cloner, has_trap, has_forbidden;

                for (let template_tile of stored_cell) {
                    let tile = Tile.from_template(template_tile);
                    if (tile.type.is_hint) {
                        // Copy over the tile-specific hint, if any
                        tile.specific_hint = template_tile.specific_hint ?? null;
                    }

                    // TODO well this is pretty special-casey.  maybe come up
                    // with a specific pass at the beginning of the level?
                    // TODO also assumes a specific order...
                    if (tile.type.name === 'cloner') {
                        has_cloner = true;
                    }
                    if (tile.type.name === 'trap') {
                        has_trap = true;
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
                            if (has_trap) {
                                // FIXME wait, not if the trap is open!  crap
                                tile.stuck = true;
                            }
                            this.actors.push(tile);
                        }
                    }
                    cell._add(tile);

                    if (tile.type.connects_to) {
                        connectables.push(tile);
                    }
                }
            }
        }

        // Connect buttons and teleporters
        let num_cells = this.width * this.height;
        for (let connectable of connectables) {
            let cell = connectable.cell;
            let x = cell.x;
            let y = cell.y;
            let goal = connectable.type.connects_to;
            let found = false;

            // Check for custom wiring, for MSCC .DAT levels
            let n = x + y * this.width;
            let target_cell_n = null;
            if (goal === 'trap') {
                target_cell_n = this.stored_level.custom_trap_wiring[n] ?? null;
            }
            else if (goal === 'cloner') {
                target_cell_n = this.stored_level.custom_cloner_wiring[n] ?? null;
            }
            if (target_cell_n) {
                // TODO this N could be outside the map bounds
                let target_cell_x = target_cell_n % this.width;
                let target_cell_y = Math.floor(target_cell_n / this.width);
                for (let tile of this.cells[target_cell_y][target_cell_x]) {
                    if (tile.type.name === goal) {
                        connectable.connection = tile;
                        found = true;
                        break;
                    }
                }
                if (found)
                    continue;
            }

            // Otherwise, look in reading order
            let direction = 1;
            if (connectable.type.connect_order === 'backward') {
                direction = -1;
            }
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
                        break;
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
        // FIXME OK, do a pass to make everyone decide their movement, and then actually do it.  the question iiis, where does that fit in with animation
        for (let actor of this.actors) {
            // Actors with no cell were destroyed
            if (! actor.cell)
                continue;

            // Decrement the cooldown here, but don't check it quite yet,
            // because stepping on cells in the next block might reset it
            if (actor.movement_cooldown > 0) {
                this._set_prop(actor, 'movement_cooldown', actor.movement_cooldown - 1);
            }

            if (actor.animation_speed) {
                // Deal with movement animation
                actor.animation_progress += 1;
                if (actor.animation_progress >= actor.animation_speed) {
                    if (actor.type.ttl) {
                        // This is purely an animation so it disappears once it's played
                        this.remove_tile(actor);
                        continue;
                    }
                    actor.previous_cell = null;
                    actor.animation_progress = null;
                    actor.animation_speed = null;
                    if (! this.compat.tiles_react_instantly) {
                        this.step_on_cell(actor);
                        // May have been destroyed here, too!
                        if (! actor.cell)
                            continue;
                    }
                }
            }

            if (actor.movement_cooldown > 0)
                continue;

            // XXX does the cooldown drop while in a trap?  is this even right?
            // TODO should still attempt to move (so chip turns), just will be stuck (but wait, do monsters turn?  i don't think so)
            if (actor.stuck)
                continue;

            // Teeth can only move the first 4 of every 8 tics, though "first"
            // can be adjusted
            if (actor.type.uses_teeth_hesitation && (this.tic_counter + this.step_parity) % 8 >= 4)
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
                    direction_preference = [player_direction, actor.direction];
                    this._set_prop(actor, 'last_move_was_force', false);
                }
                else {
                    direction_preference = [actor.direction];
                    if (actor === this.player) {
                        this._set_prop(actor, 'last_move_was_force', true);
                    }
                }
            }
            else if (actor === this.player) {
                if (player_direction) {
                    direction_preference = [player_direction];
                    this._set_prop(actor, 'last_move_was_force', false);
                }
            }
            else if (actor.type.movement_mode === 'forward') {
                // blue tank behavior: keep moving forward
                direction_preference = [actor.direction];
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
            else if (actor.type.movement_mode === 'bounce-random') {
                // walker behavior: preserve current direction; if that
                // doesn't work, pick a random direction, even the one we
                // failed to move in
                // TODO unclear if this is right in cc2 as well.  definitely not in ms, which chooses a legal move
                direction_preference = [actor.direction, ['north', 'south', 'east', 'west'][Math.floor(Math.random() * 4)]];
            }
            else if (actor.type.movement_mode === 'pursue') {
                // teeth behavior: always move towards the player
                let dx = actor.cell.x - this.player.cell.x;
                let dy = actor.cell.y - this.player.cell.y;
                let preferred_horizontal, preferred_vertical;
                if (dx > 0) {
                    preferred_horizontal = 'west';
                }
                else if (dx < 0) {
                    preferred_horizontal = 'east';
                }
                if (dy > 0) {
                    preferred_vertical = 'north';
                }
                else if (dy < 0) {
                    preferred_vertical = 'south';
                }
                // Chooses the furthest direction, vertical wins ties
                if (Math.abs(dx) > Math.abs(dy)) {
                    // Horizontal first
                    direction_preference = [preferred_horizontal, preferred_vertical].filter(x => x);
                }
                else {
                    // Vertical first
                    direction_preference = [preferred_vertical, preferred_horizontal].filter(x => x);
                }
            }
            else if (actor.type.movement_mode === 'random') {
                // blob behavior: move completely at random
                // TODO cc2 has twiddles for how this works per-level, as well as the initial seed for demo playback
                direction_preference = [['north', 'south', 'east', 'west'][Math.floor(Math.random() * 4)]];
            }

            if (! direction_preference)
                continue;

            let moved = false;
            for (let direction of direction_preference) {
                this.set_actor_direction(actor, direction);
                if (this.attempt_step(actor, direction)) {
                    moved = true;
                    break;
                }
            }

            // TODO do i need to do this more aggressively?
            if (this.state === 'success' || this.state === 'failure')
                break;
        }

        // Pass time
        let tic_counter = this.tic_counter;
        let time_remaining = this.time_remaining;
        this.tic_counter++;
        if (this.time_remaining !== null && this.tic_counter % 20 === 0) {
            // 20 tics means one second!  Tic that time down
            this.pending_undo.push(() => {
                this.tic_counter = tic_counter;
                this.time_remaining = time_remaining;
            });

            this.time_remaining -= 1;
            if (this.time_remaining <= 0) {
                this.fail("Time's up!");
            }
        }
        else {
            this.pending_undo.push(() => {
                this.tic_counter = tic_counter;
            });
        }

        // Strip out any destroyed actors from the acting order
        let p = 0;
        for (let i = 0, l = this.actors.length; i < l; i++) {
            let actor = this.actors[i];
            if (actor.cell) {
                if (p !== i) {
                    this.actors[p] = actor;
                }
                p++;
            }
        }
        this.actors.length = p;

        // Commit the undo state at the end of each tic
        this.commit();
    }

    // Try to move the given actor one tile in the given direction and update
    // their cooldown.  Return true if successful.
    attempt_step(actor, direction, speed = null) {
        if (actor.stuck)
            return false;

        // If speed is given, we're being pushed by something so we're using
        // its speed.  Otherwise, use our movement speed.  If we're moving onto
        // a sliding tile, we'll halve it later
        let check_for_slide = false;
        if (speed === null) {
            speed = actor.type.movement_speed;
            check_for_slide = true;
        }

        let move = DIRECTIONS[direction].movement;
        let original_cell = actor.cell;
        if (!original_cell) console.error(actor);
        let goal_x = original_cell.x + move[0];
        let goal_y = original_cell.y + move[1];

        let blocked;
        if (goal_x >= 0 && goal_x < this.width && goal_y >= 0 && goal_y < this.height) {
            // Check for a thin wall in our current cell first
            for (let tile of original_cell) {
                if (tile !== actor &&
                    ! tile.type.is_swivel && tile.type.thin_walls &&
                    tile.type.thin_walls.has(direction))
                {
                    blocked = true;
                    break;
                }
            }

            // Only bother touching the goal cell if we're not already trapped
            // in this one
            // (Note that here, and anywhere else that has any chance of
            // altering the cell's contents, we iterate over a copy of the cell
            // to insulate ourselves from tiles appearing or disappearing
            // mid-iteration.)
            // FIXME actually, this prevents flicking!
            if (! blocked) {
                let goal_cell = this.cells[goal_y][goal_x];
                // FIXME splashes should block you (e.g. pushing a block off a
                // turtle) but currently do not because of this copy; we don't
                // notice a new thing was added to the tile  :(
                for (let tile of Array.from(goal_cell)) {
                    if (check_for_slide && tile.type.slide_mode && ! actor.ignores(tile.type.name)) {
                        check_for_slide = false;
                        speed /= 2;
                    }

                    if (actor.ignores(tile.type.name))
                        continue;
                    if (! tile.blocks(actor, direction))
                        continue;

                    if (actor.type.pushes && actor.type.pushes[tile.type.name] && ! tile.stuck) {
                        this.set_actor_direction(tile, direction);
                        if (this.attempt_step(tile, direction, speed))
                            // It moved out of the way!
                            continue;
                    }
                    if (tile.type.on_bump) {
                        tile.type.on_bump(tile, this, actor);
                        if (! tile.blocks(actor, direction))
                            // It became something non-blocking!
                            continue;
                    }
                    blocked = true;
                    // XXX should i break here, or bump everything?
                }
            }
        }
        else {
            // Hit the edge
            blocked = true;
        }

        if (blocked) {
            if (actor.slide_mode === 'ice') {
                // Actors on ice turn around when they hit something
                this.set_actor_direction(actor, DIRECTIONS[direction].opposite);
                // Somewhat clumsy hack: step on the ice tile again, so if it's
                // a corner, it'll turn us in the correct direction
                for (let tile of original_cell) {
                    if (tile.type.slide_mode === 'ice' && tile.type.on_arrive) {
                        tile.type.on_arrive(tile, this, actor);
                    }
                }
            }
            return false;
        }

        // We're clear!
        this.move_to(actor, goal_x, goal_y, speed);

        // Set movement cooldown since we just moved
        this._set_prop(actor, 'movement_cooldown', speed);
        return true;
    }

    // Move the given actor to the given position and perform any appropriate
    // tile interactions.  Does NOT check for whether the move is actually
    // legal; use attempt_step for that!
    move_to(actor, x, y, speed) {
        let original_cell = actor.cell;
        if (x === original_cell.x && y === original_cell.y)
            return;

        actor.previous_cell = actor.cell;
        actor.animation_speed = speed;
        actor.animation_progress = 0;

        let goal_cell = this.cells[y][x];
        this.remove_tile(actor);
        this.make_slide(actor, null);
        this.add_tile(actor, goal_cell);

        // Announce we're leaving, for the handful of tiles that care about it
        for (let tile of Array.from(original_cell)) {
            if (tile === actor)
                continue;
            if (actor.ignores(tile.type.name))
                continue;

            if (tile.type.on_depart) {
                tile.type.on_depart(tile, this, actor);
            }
        }

        // Check for a couple effects that always apply immediately
        // TODO i guess this covers blocks too
        // TODO do blocks smash monsters?
        for (let tile of goal_cell) {
            if (tile.type.slide_mode && ! actor.ignores(tile.type.name)) {
                this.make_slide(actor, tile.type.slide_mode);
            }
            if ((actor.type.is_player && tile.type.is_monster) ||
                (actor.type.is_monster && tile.type.is_player))
            {
                // TODO ooh, obituaries
                this.fail("Oops!  Watch out for creatures!");
                return;
            }
            if (actor.type.is_block && tile.type.is_player) {
                // TODO ooh, obituaries
                this.fail("squish");
                return;
            }
        }

        if (this.compat.tiles_react_instantly) {
            this.step_on_cell(actor);
        }
    }

    // Step on every tile in a cell we just arrived in
    step_on_cell(actor) {
        if (actor === this.player) {
            this._set_prop(this, 'hint_shown', null);
        }
        let teleporter;
        for (let tile of Array.from(actor.cell)) {
            if (tile === actor)
                continue;
            if (actor.ignores(tile.type.name))
                continue;

            if (actor === this.player && tile.type.is_hint) {
                this._set_prop(this, 'hint_shown', tile.specific_hint ?? this.stored_level.hint);
            }

            if (tile.type.is_item && this.give_actor(actor, tile.type.name)) {
                this.remove_tile(tile);
            }
            else if (tile.type.is_teleporter) {
                teleporter = tile;
            }
            else if (tile.type.on_arrive) {
                tile.type.on_arrive(tile, this, actor);
            }
        }

        // Handle teleporting, now that the dust has cleared
        // FIXME something funny happening here, your input isn't ignore while walking out of it?
        let current_cell = actor.cell;
        if (teleporter) {
            let goal = teleporter.connection;
            // TODO in pathological cases this might infinite loop
            while (true) {
                // Physically move the actor to the new teleporter
                // XXX is this right, compare with tile world?  i overhear it's actually implemented as a slide?
                // XXX will probably play badly with undo lol
                let tele_cell = goal.cell;
                current_cell._remove(actor);
                tele_cell._add(actor);
                current_cell = tele_cell;
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
    // Undo handling

    commit() {
        this.undo_stack.push(this.pending_undo);
        this.pending_undo = [];

        // Limit the stack to, idk, 200 tics (10 seconds)
        if (this.undo_stack.length > 200) {
            this.undo_stack.splice(0, this.undo_stack.length - 200);
        }
    }

    undo() {
        let entry = this.undo_stack.pop();
        // Undo in reverse order!  There's no redo, so it's okay to destroy this
        entry.reverse();
        for (let undo of entry) {
            undo();
        }
    }

    // -------------------------------------------------------------------------
    // Level alteration methods.  EVERYTHING that changes the state of a level,
    // including the state of a single tile, should do it through one of these
    // for undo/rewind purposes

    _set_prop(obj, key, val) {
        let old_val = obj[key];
        if (val === old_val)
            return;
        this.pending_undo.push(() => obj[key] = old_val);
        obj[key] = val;
    }

    collect_chip() {
        let current = this.chips_remaining;
        if (current > 0) {
            this.pending_undo.push(() => this.chips_remaining = current);
            this.chips_remaining--;
        }
    }

    fail(message) {
        this.pending_undo.push(() => {
            this.state = 'playing';
            this.fail_message = null;
        });
        this.state = 'failure';
        this.fail_message = message;
    }

    win() {
        this.pending_undo.push(() => this.state = 'playing');
        this.state = 'success';
    }

    // Get the next direction a random force floor will use.  They share global
    // state and cycle clockwise.
    get_force_floor_direction() {
        let d = this.force_floor_direction;
        this.force_floor_direction = DIRECTIONS[d].right;
        return d;
    }

    // Tile stuff in particular
    // TODO should add in the right layer?  maybe?

    remove_tile(tile) {
        let cell = tile.cell;
        let index = cell._remove(tile);
        this.pending_undo.push(() => cell._add(tile, index));
    }

    add_tile(tile, cell, index = null) {
        cell._add(tile, index);
        this.pending_undo.push(() => cell._remove(tile));
    }

    spawn_animation(cell, name) {
        let type = TILE_TYPES[name];
        let tile = new Tile(type);
        tile.animation_speed = type.ttl;
        tile.animation_progress = 0;
        cell._add(tile);
        this.actors.push(tile);
        this.pending_undo.push(() => {
            this.actors.pop();
            cell._remove(tile);
        });
    }

    transmute_tile(tile, name) {
        let current = tile.type.name;
        this.pending_undo.push(() => tile.type = TILE_TYPES[current]);
        tile.type = TILE_TYPES[name];
        // TODO adjust anything else?
    }

    give_actor(actor, name) {
        if (! actor.type.has_inventory)
            return false;

        let current = actor.inventory[name];
        this.pending_undo.push(() => actor.inventory[name] = current);
        actor.inventory[name] = (current ?? 0) + 1;
        return true;
    }

    // Mark an actor as sliding
    make_slide(actor, mode) {
        let current = actor.slide_mode;
        this.pending_undo.push(() => actor.slide_mode = current);
        actor.slide_mode = mode;
    }

    // Change an actor's direction
    set_actor_direction(actor, direction) {
        let current = actor.direction;
        this.pending_undo.push(() => actor.direction = current);
        actor.direction = direction;
    }

    set_actor_stuck(actor, is_stuck) {
        let current = actor.stuck;
        if (current === is_stuck)
            return;
        this.pending_undo.push(() => actor.stuck = current);
        actor.stuck = is_stuck;
    }
}


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
        this.update_ui();
        this._redraw();
    }

    play_demo() {
        this.demo_faucet = this.level.stored_level.demo[Symbol.iterator]();
        this.restart_level();
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
        if (this.level.time_remaining === null) {
            this.time_el.textContent = '---';
        }
        else {
            this.time_el.textContent = this.level.time_remaining;
        }
        this.bonus_el.textContent = this.level.bonus_points;
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


class Editor extends PrimaryView {
    constructor(conductor) {
        super(conductor, document.body.querySelector('main#editor'));
        // FIXME don't hardcode size here, convey this to renderer some other way
        this.renderer = new CanvasRenderer(this.conductor.tileset, 32);

        // Level canvas and mouse handling
        this.root.querySelector('.level').append(this.renderer.canvas);
        this.mouse_mode = null;
        this.mouse_cell = null;
        this.renderer.canvas.addEventListener('mousedown', ev => {
            this.mouse_mode = 'draw';

            let [x, y] = this.renderer.cell_coords_from_event(ev);
            this.mouse_cell = [x, y];

            this.place_in_cell(x, y, this.palette_selection);
            this.renderer.draw();
        });
        this.renderer.canvas.addEventListener('mousemove', ev => {
            if (this.mouse_mode === null)
                return;

            if (this.mouse_mode === 'draw') {
                // FIXME also fill in a trail between previous cell and here, mousemove is not fired continuously
                let [x, y] = this.renderer.cell_coords_from_event(ev);
                if (x === this.mouse_cell[0] && y === this.mouse_cell[1])
                    return;

                // TODO do a pixel-perfect draw too
                for (let [cx, cy] of walk_grid(this.mouse_cell[0], this.mouse_cell[1], x, y)) {
                    this.place_in_cell(cx, cy, this.palette_selection);
                }
                this.renderer.draw();

                this.mouse_cell = [x, y];
            }
        });
        this.renderer.canvas.addEventListener('mouseup', ev => {
            this.mouse_mode = null;
        });
        window.addEventListener('blur', ev => {
            // Unbind the mouse if the page loses focus
            this.mouse_mode = null;
        });

        // Tile palette
        let palette_el = this.root.querySelector('.palette');
        this.palette = {};  // name => element
        for (let name of [
            // Terrain
            'floor', 'wall', 'hint', 'socket', 'exit',
            'popwall',
            'fake_floor', 'fake_wall',
            'water', 'fire', 'ice', 'force_floor_all',
            // TODO ice curves
            // Items
            'chip', // 'chip_extra', -- XXX doesn't exist in TW tileset!
            'key_blue', 'key_red', 'key_yellow', 'key_green',
            // Creatures
            'ball', 'player',
            'dirt_block',
            'clone_block',
            'cloner',
            'bomb',
            'button_red',
            'tank_blue',
            'turtle',
        ])
        {
            let entry = mk('canvas.palette-entry', {
                width: this.conductor.tileset.size_x,
                height: this.conductor.tileset.size_y,
                'data-tile-name': name,
            });
            let ctx = entry.getContext('2d');
            this.conductor.tileset.draw_type(name, null, null, ctx, 0, 0);
            this.palette[name] = entry;
            palette_el.append(entry);
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
        this.set_title("options");
        this.add_button("well alright then", ev => {
            this.close();
        });

        let tab_strip = mk('nav.tabstrip');
        this.main.append(tab_strip);
        this.tab_links = {};
        this.tab_blocks = {};
        for (let tabdef of OPTIONS_TABS) {
            let link = mk('a', {href: 'javascript:', 'data-tab': tabdef.name}, tabdef.label);
            tab_strip.append(link);
            this.tab_links[tabdef.name] = link;
            let block = mk('section');
            this.main.append(block);
            this.tab_blocks[tabdef.name] = block;
        }

        // Compat tab
        this.tab_blocks['compat'].append(
            mk('p', "If you don't know what any of these are for, you can pretty safely ignore them."),
            mk('p', "Changes won't take effect until you restart the level."),
        );
        let ul = mk('ul');
        this.tab_blocks['compat'].append(ul);
        for (let optdef of COMPAT_OPTIONS) {
            let li = mk('li');
            let label = mk('label');
            li.append(label);
            label.append(mk('input', {type: 'checkbox', name: optdef.key}));
            for (let impl of optdef.impls) {
                label.append(mk(`img.compat-icon`, {src: `compat-${impl}.png`}));
            }
            label.append(optdef.label);
            li.append(mk('p', optdef.note));
            ul.append(li);
        }

        this.main.append(mk('p', "Sorry!  This stuff doesn't actually work yet."));
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
