import { DIRECTIONS } from './defs.js';
import TILE_TYPES from './tiletypes.js';

export class Tile {
    constructor(type, direction = 'south') {
        this.type = type;
        this.direction = direction;
        this.cell = null;

        if (type.is_actor) {
            this.slide_mode = null;
            this.movement_cooldown = 0;
        }

        if (type.has_inventory) {
            this.keyring = {};
            this.toolbelt = [];
        }
    }

    static from_template(tile_template) {
        let type = tile_template.type;
        if (! type) console.error(tile_template);
        let tile = new this(type, tile_template.direction);
        // Copy any extra properties in verbatim
        return Object.assign(tile, tile_template);
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

    blocks(other, direction, level) {
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

        if (this.type.blocks)
            return this.type.blocks(this, level, other);

        return false;
    }

    ignores(name) {
        if (this.type.ignores && this.type.ignores.has(name))
            return true;

        if (this.toolbelt) {
            for (let item of this.toolbelt) {
                let item_type = TILE_TYPES[item];
                if (item_type.item_ignores && item_type.item_ignores.has(name))
                    return true;
            }
        }

        return false;
    }

    can_push(tile) {
        return (
            this.type.pushes && this.type.pushes[tile.type.name] &&
            tile.movement_cooldown === 0 &&
            ! tile.stuck);
    }

    // Inventory stuff
    has_item(name) {
        if (TILE_TYPES[name].is_key) {
            return this.keyring && (this.keyring[name] ?? 0) > 0;
        }
        else {
            return this.toolbelt && this.toolbelt.some(item => item === name);
        }
    }
}

export class Cell extends Array {
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

    blocks_leaving(actor, direction) {
        for (let tile of this) {
            if (tile !== actor &&
                ! tile.type.is_swivel && tile.type.thin_walls &&
                tile.type.thin_walls.has(direction))
            {
                return true;
            }
        }
        return false;
    }

    blocks_entering(actor, direction, level, ignore_pushables = false) {
        for (let tile of this) {
            if (tile.blocks(actor, direction, level) &&
                ! (ignore_pushables && actor.can_push(tile)))
            {
                return true;
            }
        }
        return false;
    }
}

class GameEnded extends Error {}

export class Level {
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
        this.bonus_points = 0;
        this.aid = 0;

        // Time
        if (this.stored_level.time_limit === 0) {
            this.time_remaining = null;
        }
        else {
            this.time_remaining = this.stored_level.time_limit * 20;
        }
        this.timer_paused = false
        // Note that this clock counts *up*, even on untimed levels, and is unaffected by CC2's
        // clock alteration shenanigans
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

    player_awaiting_input() {
        return this.player.movement_cooldown === 0 && (this.player.slide_mode === null || (this.player.slide_mode === 'force' && this.player.last_move_was_force))
    }

    // Move the game state forwards by one tic
    // split into two parts for turn-based mode: first part is the consequences of the previous tick, second part depends on the player's input
    advance_tic(p1_primary_direction, p1_secondary_direction, pass) {
        if (this.state !== 'playing') {
            console.warn(`Level.advance_tic() called when state is ${this.state}`);
            return;
        }

        try {
            if (pass == 1)
            {
                this._advance_tic_part1(p1_primary_direction, p1_secondary_direction);
            }
            else if (pass == 2)
            {
                this._advance_tic_part2(p1_primary_direction, p1_secondary_direction);
            }
            else
            {
                console.warn(`What pass is this?`);
            }
        }
        catch (e) {
            if (e instanceof GameEnded) {
                // Do nothing, the game ended and we just wanted to skip the rest
            }
            else {
                throw e;
            }
        }

        // Commit the undo state at the end of each tic (pass 2)
        if (pass == 2) {
            this.commit();
        }
    }

    _advance_tic_part1(p1_primary_direction, p1_secondary_direction) {
        // Player's secondary direction is set immediately; it applies on arrival to cells even if
        // it wasn't held the last time the player started moving
        this._set_prop(this.player, 'secondary_direction', p1_secondary_direction);

        // Used to check for a monster chomping the player's tail
        this.player_leaving_cell = this.player.cell;
        // Used for visual effect and updated later; don't need to be undoable
        // because they only apply while holding a key down anyway
        // TODO but maybe they should be undone anyway so rewind looks better
        this.player.is_blocked = false;

        this.sfx.set_player_position(this.player.cell);

        // First pass: tick cooldowns and animations; have actors arrive in their cells.  We do the
        // arrival as its own mini pass, for one reason: if the player dies (which will end the game
        // immediately), we still want every time's animation to finish, or it'll look like some
        // objects move backwards when the death screen appears!
        let cell_steppers = [];
        for (let actor of this.actors) {
            // Actors with no cell were destroyed
            if (! actor.cell)
                continue;

            // Clear any old decisions ASAP.  Note that this prop is only used internally within a
            // single tic, so it doesn't need to be undoable
            actor.decision = null;

            // Decrement the cooldown here, but don't check it quite yet,
            // because stepping on cells in the next block might reset it
            if (actor.movement_cooldown > 0) {
                this._set_prop(actor, 'movement_cooldown', actor.movement_cooldown - 1);
            }

            if (actor.animation_speed) {
                // Deal with movement animation
                this._set_prop(actor, 'animation_progress', actor.animation_progress + 1);
                if (actor.animation_progress >= actor.animation_speed) {
                    if (actor.type.ttl) {
                        // This is purely an animation so it disappears once it's played
                        this.remove_tile(actor);
                        continue;
                    }
                    this._set_prop(actor, 'previous_cell', null);
                    this._set_prop(actor, 'animation_progress', null);
                    this._set_prop(actor, 'animation_speed', null);
                    if (! this.compat.tiles_react_instantly) {
                        // We need to track the actor AND the cell explicitly, because it's possible
                        // that one actor's step will cause another actor to start another move, and
                        // then they'd end up stepping on the new cell they're moving to instead of
                        // the one they just landed on!
                        cell_steppers.push([actor, actor.cell]);
                    }
                }
            }
        }
        for (let [actor, cell] of cell_steppers) {
            this.step_on_cell(actor, cell);
        }

        // Only reset the player's is_pushing between movement, so it lasts for the whole push
        if (this.player.movement_cooldown <= 0) {
            this.player.is_pushing = false;
        }

        // Second pass: actors decide their upcoming movement simultaneously
        // (we'll do the player's decision in part 2!)
        for (let actor of this.actors) {
            if (actor != this.player)
            {
                this.actor_decision(actor, p1_primary_direction);
            }
        }
    }
    
    
    _advance_tic_part2(p1_primary_direction, p1_secondary_direction) {
        //player now makes a decision based on input
        this.actor_decision(this.player, p1_primary_direction);
        
        // Third pass: everyone actually moves
        for (let actor of this.actors) {
            if (! actor.cell)
                continue;

            // Check this again, because one actor's movement might caused a later actor to move
            // (e.g. by pressing a red or brown button)
            if (actor.movement_cooldown > 0)
                continue;

            if (! actor.decision)
                continue;

            let old_cell = actor.cell;
            let success = this.attempt_step(actor, actor.decision);

            // Track whether the player is blocked, for visual effect
            if (actor === this.player && p1_primary_direction && ! success) {
                this.sfx.play_once('blocked');
                actor.is_blocked = true;
            }

            // Players can also bump the tiles in the cell next to the one they're leaving
            let dir2 = actor.secondary_direction;
            if (actor.type.is_player && dir2 &&
                ! old_cell.blocks_leaving(actor, dir2))
            {
                let neighbor = this.cell_with_offset(old_cell, dir2);
                if (neighbor) {
                    let could_push = ! neighbor.blocks_entering(actor, dir2, this, true);
                    for (let tile of Array.from(neighbor)) {
                        if (tile.type.on_bump) {
                            tile.type.on_bump(tile, this, actor);
                        }
                        if (could_push && actor.can_push(tile)) {
                            // Block slapping: you can shove a block by walking past it sideways
                            // TODO i think cc2 uses the push pose and possibly even turns you here?
                            this.attempt_step(tile, dir2);
                        }
                    }
                }
            }
        }

        // Strip out any destroyed actors from the acting order
        // FIXME this is O(n), where n is /usually/ small, but i still don't love it
        let p = 0;
        for (let i = 0, l = this.actors.length; i < l; i++) {
            let actor = this.actors[i];
            if (actor.cell) {
                if (p !== i) {
                    this.actors[p] = actor;
                }
                p++;
            }
            else {
                let local_p = p;
                this.pending_undo.push(() => this.actors.splice(local_p, 0, actor));
            }
        }
        this.actors.length = p;

        // Advance the clock
        let tic_counter = this.tic_counter;
        this.tic_counter += 1;
        if (this.time_remaining !== null && ! this.timer_paused) {
            let time_remaining = this.time_remaining;
            this.pending_undo.push(() => {
                this.tic_counter = tic_counter;
                this.time_remaining = time_remaining;
            });

            this.time_remaining -= 1;
            if (this.time_remaining <= 0) {
                this.fail('time');
            }
            else if (this.time_remaining % 20 === 0 && this.time_remaining < 30 * 20) {
                this.sfx.play_once('tick');
            }
        }
        else {
            this.pending_undo.push(() => {
                this.tic_counter = tic_counter;
            });
        }
    }
    
    actor_decision(actor, p1_primary_direction) {
        if (! actor.cell)
            return;

        if (actor.movement_cooldown > 0)
            return;

        // XXX does the cooldown drop while in a trap?  is this even right?
        if (actor.stuck && ! actor.type.is_player)
            return;

        // Teeth can only move the first 4 of every 8 tics, though "first"
        // can be adjusted
        if (actor.slide_mode == null &&
            actor.type.uses_teeth_hesitation &&
            (this.tic_counter + this.step_parity) % 8 >= 4)
        {
            return;
        }

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
                p1_primary_direction &&
                actor.last_move_was_force)
            {
                if (p1_primary_direction != null)
                {
                    direction_preference = [p1_primary_direction];
                    this._set_prop(actor, 'last_move_was_force', false);
                }
            }
            else {
                direction_preference = [actor.direction];
                if (actor === this.player) {
                    this._set_prop(actor, 'last_move_was_force', true);
                }
            }
        }
        else if (actor === this.player) {
            if (p1_primary_direction) {
                direction_preference = [p1_primary_direction];
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
            let target_cell = this.player.cell;
            // CC2 behavior (not Lynx (TODO compat?)): pursue the cell the player is leaving, if
            // they're still mostly in it
            if (this.player.previous_cell && this.player.animation_speed &&
                this.player.animation_progress <= this.player.animation_speed / 2)
            {
                target_cell = this.player.previous_cell;
            }
            let dx = actor.cell.x - target_cell.x;
            let dy = actor.cell.y - target_cell.y;
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

        // Check which of those directions we *can*, probably, move in
        // TODO i think player on force floor will still have some issues here
        if (direction_preference) {
            // Players and sliding actors always move the way they want, even if blocked
            if (actor.type.is_player || actor.slide_mode) {
                actor.decision = direction_preference[0];
                return;
            }

            for (let direction of direction_preference) {
                let dest_cell = this.cell_with_offset(actor.cell, direction);
                if (! dest_cell)
                    continue;

                if (! actor.cell.blocks_leaving(actor, direction) &&
                    ! dest_cell.blocks_entering(actor, direction, this, true))
                {
                    // We found a good direction!  Stop here
                    actor.decision = direction;
                    break;
                }
            }
        }
    }

    // Try to move the given actor one tile in the given direction and update
    // their cooldown.  Return true if successful.
    attempt_step(actor, direction) {
        // In mid-movement, we can't even change direction!
        if (actor.movement_cooldown > 0)
            return false;

        this.set_actor_direction(actor, direction);

        if (actor.stuck)
            return false;

        // Record our speed, and halve it below if we're stepping onto a sliding tile
        let speed = actor.type.movement_speed;

        let move = DIRECTIONS[direction].movement;
        if (!actor.cell) console.error(actor);
        let goal_cell = this.cell_with_offset(actor.cell, direction);

        // TODO this could be a lot simpler if i could early-return!  should ice bumping be
        // somewhere else?
        let blocked;
        if (goal_cell) {
            // Only bother touching the goal cell if we're not already trapped in this one
            if (actor.cell.blocks_leaving(actor, direction)) {
                blocked = true;
            }

            // (Note that here, and anywhere else that has any chance of
            // altering the cell's contents, we iterate over a copy of the cell
            // to insulate ourselves from tiles appearing or disappearing
            // mid-iteration.)
            // FIXME actually, this prevents flicking!
            if (! blocked) {
                // Try to move into the cell.  This is usually a simple check of whether we can
                // enter it (similar to Cell.blocks_entering), but if the only thing blocking us is
                // a pushable object, we have to do two more passes: one to push anything pushable,
                // then one to check whether we're blocked again.
                let has_slide_tile = false;
                let blocked_by_pushable = false;
                for (let tile of goal_cell) {
                    if (tile.blocks(actor, direction, this)) {
                        if (actor.can_push(tile)) {
                            blocked_by_pushable = true;
                        }
                        else {
                            blocked = true;
                            // Don't break here, because we might still want to bump other tiles
                        }
                    }

                    if (actor.ignores(tile.type.name))
                        continue;

                    if (tile.type.slide_mode) {
                        has_slide_tile = true;
                    }

                    // Bump tiles that we're even attempting to move into; this mostly reveals
                    // invisible walls, blue floors, etc.
                    if (tile.type.on_bump) {
                        tile.type.on_bump(tile, this, actor);
                    }
                }

                if (has_slide_tile) {
                    speed /= 2;
                }

                // If the only thing blocking us can be pushed, give that a shot
                if (! blocked && blocked_by_pushable) {
                    // This time make a copy, since we're modifying the contents of the cell
                    for (let tile of Array.from(goal_cell)) {
                        if (actor.can_push(tile)) {
                            this.attempt_step(tile, direction);
                            if (actor === this.player) {
                                actor.is_pushing = true;
                            }
                        }
                    }

                    // Now check if we're still blocked
                    blocked = goal_cell.blocks_entering(actor, direction, this);
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
            }
            if (actor.slide_mode !== null) {
                // Somewhat clumsy hack: if an actor is sliding and hits something, step on the
                // relevant tile again.  This fixes two problems: if it was on an ice corner then it
                // needs to turn a second time even though it didn't move; and if it was a player
                // overriding a force floor into a wall, then their direction needs to be set back
                // to the force floor direction.
                // (For random force floors, this does still match CC2 behavior: after an override,
                // CC2 will try to force you in the /next/ RFF direction.)
                // FIXME now overriding into a wall doesn't show you facing that way at all!  lynx
                // only changes your direction at decision time by examining the floor tile...
                for (let tile of actor.cell) {
                    if (tile.type.slide_mode === actor.slide_mode && tile.type.on_arrive) {
                        tile.type.on_arrive(tile, this, actor);
                    }
                }
            }
            return false;
        }

        // We're clear!
        this.move_to(actor, goal_cell, speed);

        // Set movement cooldown since we just moved
        this._set_prop(actor, 'movement_cooldown', speed);
        return true;
    }

    // Move the given actor to the given position and perform any appropriate
    // tile interactions.  Does NOT check for whether the move is actually
    // legal; use attempt_step for that!
    move_to(actor, goal_cell, speed) {
        if (actor.cell === goal_cell)
            return;

        this._set_prop(actor, 'previous_cell', actor.cell);
        this._set_prop(actor, 'animation_speed', speed);
        this._set_prop(actor, 'animation_progress', 0);

        let original_cell = actor.cell;
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
        // TODO do blocks smash monsters?
        if (actor === this.player) {
            this._set_prop(this, 'hint_shown', null);
        }
        for (let tile of goal_cell) {
            if (actor.type.is_player && tile.type.is_monster) {
                this.fail(tile.type.name);
            }
            else if (actor.type.is_monster && tile.type.is_player) {
                this.fail(actor.type.name);
            }
            else if (actor.type.is_block && tile.type.is_player) {
                this.fail('squished');
            }

            if (tile.type.slide_mode && ! actor.ignores(tile.type.name)) {
                this.make_slide(actor, tile.type.slide_mode);
            }

            if (actor === this.player && tile.type.is_hint) {
                this._set_prop(this, 'hint_shown', tile.specific_hint ?? this.stored_level.hint);
            }
        }

        // If we're stepping directly on the player, that kills them too
        // TODO this only works because i have the player move first; in lynx the check is the other
        // way around
        if (actor.type.is_monster && goal_cell === this.player_leaving_cell) {
            this.fail(actor.type.name);
        }

        if (actor === this.player && goal_cell[0].type.name === 'floor') {
            this.sfx.play_once('step-floor');
        }

        if (this.compat.tiles_react_instantly) {
            this.step_on_cell(actor, actor.cell);
        }
    }

    // Step on every tile in a cell we just arrived in
    step_on_cell(actor, cell) {
        let teleporter;
        for (let tile of Array.from(cell)) {
            if (tile === actor)
                continue;
            if (actor.ignores(tile.type.name))
                continue;

            // TODO some actors can pick up some items...
            if (actor.type.is_player && tile.type.is_item && this.give_actor(actor, tile.type.name)) {
                if (tile.type.is_key) {
                    this.sfx.play_once('get-key', cell);
                }
                else {
                    this.sfx.play_once('get-tool', cell);
                }
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
        if (teleporter) {
            let goal = teleporter;
            // TODO in pathological cases this might infinite loop
            while (true) {
                goal = goal.connection;

                // Teleporters already containing an actor are blocked and unusable
                if (goal.cell.some(tile => tile.type.is_actor && tile !== actor))
                    continue;

                // Physically move the actor to the new teleporter
                // XXX is this right, compare with tile world?  i overhear it's actually implemented as a slide?
                // XXX not especially undo-efficient
                this.remove_tile(actor);
                this.add_tile(actor, goal.cell);
                if (this.attempt_step(actor, actor.direction)) {
                    // Success, teleportation complete
                    // Sound plays from the origin cell simply because that's where the sfx player
                    // thinks the player is currently
                    this.sfx.play_once('teleport', cell);
                    break;
                }
                if (goal === teleporter)
                    // We've tried every teleporter, including the one they
                    // stepped on, so leave them on it
                    break;

                // Otherwise, try the next one
            }
        }
    }

    cell_with_offset(cell, direction) {
        let move = DIRECTIONS[direction].movement;
        let goal_x = cell.x + move[0];
        let goal_y = cell.y + move[1];
        if (goal_x >= 0 && goal_x < this.width && goal_y >= 0 && goal_y < this.height) {
            return this.cells[goal_y][goal_x];
        }
        else {
            return null;
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
        this.pending_undo = [];
        this.aid = Math.max(1, this.aid);

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
            this.sfx.play_once('get-chip');
            this.pending_undo.push(() => this.chips_remaining = current);
            this.chips_remaining--;
        }
    }

    adjust_bonus(add, mult = 1) {
        let current = this.bonus_points;
        this.pending_undo.push(() => this.bonus_points = current);
        this.bonus_points = Math.ceil(this.bonus_points * mult) + add;
    }

    pause_timer() {
        if (this.time_remaining === null)
            return;

        this.pending_undo.push(() => this.timer_paused = ! this.timer_paused);
        this.timer_paused = ! this.timer_paused;
    }

    adjust_timer(dt) {
        let current = this.time_remaining;
        this.pending_undo.push(() => this.time_remaining = current);

        // Untimed levels become timed levels with 0 seconds remaining
        this.time_remaining = Math.max(0, (this.time_remaining ?? 0) + dt * 20);
        if (this.time_remaining <= 0) {
            if (this.timer_paused) {
                this.time_remaining = 1;
            }
            else {
                this.fail('time');
            }
        }
    }

    fail(reason) {
        if (reason === 'time') {
            this.sfx.play_once('timeup');
        }
        else {
            this.sfx.play_once('lose');
        }

        this.pending_undo.push(() => {
            this.state = 'playing';
            this.fail_reason = null;
            this.player.fail_reason = null;
        });
        this.state = 'failure';
        this.fail_reason = reason;
        this.player.fail_reason = reason;
        throw new GameEnded;
    }

    win() {
        this.sfx.play_once('win');
        this.pending_undo.push(() => this.state = 'playing');
        this.state = 'success';
        throw new GameEnded;
    }

    get_scorecard() {
        if (this.state !== 'success') {
            return null;
        }

        let time = Math.ceil((this.time_remaining ?? 0) / 20);
        return {
            time: time,
            abstime: this.tic_counter,
            bonus: this.bonus_points,
            score: this.stored_level.number * 500 + time * 10 + this.bonus_points,
            aid: this.aid,
        };
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

    add_actor(actor) {
        this.actors.push(actor);
        this.pending_undo.push(() => this.actors.pop());
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

        // For transmuting into an animation, set up the timer immediately
        if (tile.type.ttl) {
            if (! TILE_TYPES[current].is_actor) {
                console.warn("Transmuting a non-actor into an animation!");
            }
            this._set_prop(tile, 'animation_speed', tile.type.ttl);
            this._set_prop(tile, 'animation_progress', 0);
        }
    }

    give_actor(actor, name) {
        if (! actor.type.is_actor)
            return false;

        let type = TILE_TYPES[name];
        if (type.is_key) {
            if (! actor.keyring) {
                actor.keyring = {};
            }
            actor.keyring[name] = (actor.keyring[name] ?? 0) + 1;
            this.pending_undo.push(() => actor.keyring[name] -= 1);
        }
        else {
            // tool, presumably
            if (! actor.toolbelt) {
                actor.toolbelt = [];
            }
            actor.toolbelt.push(name);
            this.pending_undo.push(() => actor.toolbelt.pop());
        }
        return true;
    }

    take_key_from_actor(actor, name) {
        if (actor.keyring && (actor.keyring[name] ?? 0) > 0) {
            if (actor.type.infinite_items && actor.type.infinite_items[name]) {
                // Some items can't be taken away normally, by which I mean, green or yellow keys
                return true;
            }

            this.pending_undo.push(() => actor.keyring[name] += 1);
            actor.keyring[name] -= 1;
            return true;
        }

        return false;
    }

    take_all_keys_from_actor(actor) {
        if (actor.keyring) {
            let keyring = actor.keyring;
            this.pending_undo.push(() => actor.keyring = keyring);
            actor.keyring = {};
        }
    }

    take_all_tools_from_actor(actor) {
        if (actor.toolbelt) {
            let toolbelt = actor.toolbelt;
            this.pending_undo.push(() => actor.toolbelt = toolbelt);
            actor.toolbelt = [];
        }
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
