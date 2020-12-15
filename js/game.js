import { DIRECTIONS, DIRECTION_ORDER, INPUT_BITS, TICS_PER_SECOND } from './defs.js';
import TILE_TYPES from './tiletypes.js';

export class Tile {
    constructor(type, direction = 'south') {
        this.type = type;
        if (type.is_actor) {
            this.direction = direction;
        }
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
        if (! this.previous_cell || this.movement_speed === null) {
            return [x, y];
        }
        else {
            // For a movement speed of N, the cooldown is set to N during the tic an actor starts
            // moving, and we interpolate it from there to N - 1 over the course of the duration
            let p = ((this.movement_speed - this.movement_cooldown) + tic_offset) / this.movement_speed;
            return [
                (1 - p) * this.previous_cell.x + p * x,
                (1 - p) * this.previous_cell.y + p * y,
            ];
        }
    }

    // TODO don't love that the arg order is different here vs tile type, but also don't love that
    // the name is the same?
    blocks(other, direction, level) {
        // Extremely awkward special case: items don't block monsters if the cell also contains an
        // item modifier (i.e. "no" sign) or a real player
        // TODO would love to get this outta here
        // FIXME i think this can be removed if monster/player interaction stops being a literal
        // collision and starts being a result of even attempting to move
        if (this.type.is_item &&
            this.cell.some(tile => tile.type.item_modifier || tile.type.is_real_player))
            return false;

        if (this.type.blocks_collision & other.type.collision_mask)
            return true;

        // FIXME bowling ball isn't affected by helmet?  also not sure bowling ball is stopped by
        // helmet?
        if (this.has_item('helmet') || (this.type.is_actor && other.has_item('helmet')))
            return true;

        // FIXME get this out of here
        if (this.type.thin_walls &&
            this.type.thin_walls.has(DIRECTIONS[direction].opposite) &&
            other.type.name !== 'ghost')
            return true;

        if (this.type.blocks)
            return this.type.blocks(this, level, other, direction);

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

    can_push(tile, direction) {
        if (! (this.type.pushes && this.type.pushes[tile.type.name] &&
            (! tile.type.allows_push || tile.type.allows_push(tile, direction))))
        {
            return false;
        }

        // Obey railroad curvature
        direction = tile.cell.redirect_exit(tile, direction);
        // Need to explicitly check this here, otherwise you could /attempt/ to push a block,
        // which would fail, but it would still change the block's direction
        return ! tile.cell.blocks_leaving(tile, direction);
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
Tile.prototype.emitting_edges = 0;

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

    get_wired_tile() {
        let ret = null;
        for (let tile of this) {
            if (tile.wire_directions || tile.wire_tunnel_directions) {
                ret = tile;
                // Don't break; we want the topmost tile!
            }
        }
        return ret;
    }

    get_terrain() {
        for (let tile of this) {
            if (tile.type.draw_layer === 0)
                return tile;
        }
        return null;
    }

    get_actor() {
        for (let tile of this) {
            if (tile.type.is_actor)
                return tile;
        }
        return null;
    }

    get_item() {
        for (let tile of this) {
            if (tile.type.is_item)
                return tile;
        }
        return null;
    }

    get_item_mod() {
        for (let tile of this) {
            if (tile.type.item_modifier)
                return tile;
        }
        return null;
    }

    has(name) {
        return this.some(tile => tile.name === name);
    }

    blocks_leaving(actor, direction) {
        for (let tile of this) {
            if (tile === actor)
                continue;

            if (tile.type.traps && tile.type.traps(tile, actor))
                return true;

            if (tile.type.blocks_leaving && tile.type.blocks_leaving(tile, actor, direction))
                return true;
        }
        return false;
    }

    // Check if this actor can move this direction into this cell.  May have side effects, depending
    // on the value of push_mode:
    // - null: Default.  Treat pushable objects as blocking.
    // - 'ignore': Treat pushable objects as nonblocking.
    // - 'trace': Don't try to move pushable objects, but do check whether they could be pushed,
    //   recursively if necessary.
    // - 'move': Attempt to move pushable objects out of the way immediately.
    blocks_entering(actor, direction, level, push_mode = null) {
        let pushable_tiles = [];
        let blocked = false;
        for (let tile of this) {
            if (! tile.blocks(actor, direction, level))
                continue;

            if (push_mode === null)
                return true;

            if (! actor.can_push(tile, direction)) {
                if (push_mode === 'move') {
                    // Track this instead of returning immediately, because 'move' mode also bumps
                    // every tile in the cell
                    blocked = true;
                }
                else {
                    return true;
                }
            }

            if (push_mode === 'ignore')
                continue;

            if (push_mode === 'move') {
                if (actor.type.on_bump) {
                    actor.type.on_bump(actor, level, tile);
                }
                if (tile.type.on_bumped) {
                    tile.type.on_bumped(tile, level, actor);
                }
            }

            // Collect pushables for later, so we don't inadvertently push through a wall
            pushable_tiles.push(tile);
        }

        if (blocked)
            return true;

        // If we got this far, all that's left is to deal with pushables
        if (pushable_tiles.length > 0) {
            let neighbor_cell = level.get_neighboring_cell(this, direction);
            if (! neighbor_cell)
                return true;

            for (let tile of pushable_tiles) {
                if (push_mode === 'trace') {
                    if (neighbor_cell.blocks_entering(tile, direction, level, push_mode))
                        return true;
                }
                else if (push_mode === 'move') {
                    if (! level.attempt_step(tile, direction))
                        return true;
                }
            }
        }

        return false;
    }

    // Special railroad ability: change the direction we attempt to leave
    redirect_exit(actor, direction) {
        for (let tile of this) {
            if (tile.type.redirect_exit) {
                return tile.type.redirect_exit(tile, actor, direction);
            }
        }
        return direction;
    }
}
Cell.prototype.prev_powered_edges = 0;
Cell.prototype.powered_edges = 0;

// The undo stack is implemented with a ring buffer, and this is its size.  One entry per tic.
// Based on Chrome measurements made against the pathological level CCLP4 #40 (Periodic Lasers) and
// sitting completely idle, undo consumes about 2 MB every five seconds, so this shouldn't go beyond
// 12 MB for any remotely reasonable level.
const UNDO_BUFFER_SIZE = TICS_PER_SECOND * 30;
export class Level {
    constructor(stored_level, compat = {}) {
        this.stored_level = stored_level;
        this.restart(compat);
    }

    restart(compat) {
        this.compat = compat;

        // playing: normal play
        // success: has been won
        // failure: died
        // note that pausing is NOT handled here, but by whatever's driving our
        // event loop!
        this.state = 'playing';

        this.width = this.stored_level.size_x;
        this.height = this.stored_level.size_y;
        this.size_x = this.stored_level.size_x;
        this.size_y = this.stored_level.size_y;

        this.cells = [];
        this.player = null;
        this.previous_input = 0;
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
        this.timer_paused = false;
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
        // PRNG is initialized to zero
        this._rng1 = 0;
        this._rng2 = 0;
        if (this.stored_level.blob_behavior === 0) {
            this._blob_modifier = 0x55;
        }
        else {
            // The other two modes are initialized to a random seed
            this._blob_modifier = Math.floor(Math.random() * 256);
        }

        this.undo_buffer = new Array(UNDO_BUFFER_SIZE);
        for (let i = 0; i < UNDO_BUFFER_SIZE; i++) {
            this.undo_buffer[i] = null;
        }
        this.undo_buffer_index = 0;
        this.pending_undo = this.create_undo_entry();

        let n = 0;
        let connectables = [];
        this.power_sources = [];
        this.players = [];
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

                for (let template_tile of stored_cell) {
                    let tile = Tile.from_template(template_tile);
                    if (tile.type.is_hint) {
                        // Copy over the tile-specific hint, if any
                        tile.hint_text = template_tile.hint_text ?? null;
                    }

                    if (tile.type.is_power_source) {
                        this.power_sources.push(tile);
                    }

                    if (tile.type.is_real_player) {
                        this.players.push(tile);
                    }
                    if (tile.type.is_actor) {
                        this.actors.push(tile);
                    }
                    cell._add(tile);

                    if (tile.type.connects_to) {
                        connectables.push(tile);
                    }
                }
            }
        }
        // TODO complain if no player
        // FIXME this is not how multiple players works
        this.player = this.players[0];
        this.player_index = 0;
        // Used for doppelgangers
        this.player1_move = null;
        this.player2_move = null;

        // Connect buttons and teleporters
        let num_cells = this.width * this.height;
        for (let connectable of connectables) {
            let cell = connectable.cell;
            let x = cell.x;
            let y = cell.y;
            // FIXME this is a single string for red/brown buttons (to match iter_tiles_in_RO) but a
            // set for orange buttons (because flame jet states are separate tiles), which sucks ass
            let goals = connectable.type.connects_to;

            // Check for custom wiring, for MSCC .DAT levels
            // TODO would be neat if this applied to orange buttons too
            if (this.stored_level.has_custom_connections) {
                let n = this.stored_level.coords_to_scalar(x, y);
                let target_cell_n = null;
                if (connectable.type.name === 'button_brown') {
                    target_cell_n = this.stored_level.custom_trap_wiring[n] ?? null;
                }
                else if (connectable.type.name === 'button_red') {
                    target_cell_n = this.stored_level.custom_cloner_wiring[n] ?? null;
                }
                if (target_cell_n && target_cell_n < this.width * this.height) {
                    let [tx, ty] = this.stored_level.scalar_to_coords(target_cell_n);
                    for (let tile of this.cells[ty][tx]) {
                        if (goals === tile.type.name) {
                            connectable.connection = tile;
                            break;
                        }
                    }
                }
                continue;
            }

            // Orange buttons do a really weird diamond search
            if (connectable.type.connect_order === 'diamond') {
                for (let cell of this.iter_cells_in_diamond(connectable.cell)) {
                    let target = null;
                    for (let tile of cell) {
                        if (goals.has(tile.type.name)) {
                            target = tile;
                            break;
                        }
                    }
                    if (target !== null) {
                        connectable.connection = target;
                        break;
                    }
                }
                continue;
            }

            // Otherwise, look in reading order
            for (let tile of this.iter_tiles_in_reading_order(cell, goals)) {
                // TODO ideally this should be a weak connection somehow, since dynamite can destroy
                // empty cloners and probably traps too
                connectable.connection = tile;
                // Just grab the first
                break;
            }
        }

        // Finally, let all tiles do any custom init behavior
        for (let row of this.cells) {
            for (let cell of row) {
                for (let tile of cell) {
                    if (tile.type.on_ready) {
                        tile.type.on_ready(tile, this);
                    }
                    if (cell === this.player.cell && tile.type.is_hint) {
                        this.hint_shown = tile.hint_text ?? this.stored_level.hint;
                    }
                }
            }
        }
        // Erase undo, in case any on_ready added to it (we don't want to undo initialization!)
        this.pending_undo = this.create_undo_entry();
    }

    can_accept_input() {
        // We can accept input anytime the player can move, i.e. when they're not already moving and
        // not in an un-overrideable slide.
        // Note that this only makes sense in the middle of a tic; at the beginning of one, the
        // player's movement cooldown may very well be 1, but it'll be decremented before they
        // attempt to move
        return this.player.movement_cooldown === 0 && (this.player.slide_mode === null || (
            this.player.slide_mode === 'force' && this.player.last_move_was_force));
    }

    // Lynx PRNG, used unchanged in CC2
    prng() {
        let n = (this._rng1 >> 2) - this._rng1;
        if (!(this._rng1 & 0x02)) --n;
        this._rng1 = (this._rng1 >> 1) | (this._rng2 & 0x80);
        this._rng2 = (this._rng2 << 1) | (n & 0x01);
        let ret = (this._rng1 ^ this._rng2) & 0xff;
        return ret;
    }

    // Weird thing done by CC2 to make blobs...  more...  random
    get_blob_modifier() {
        let mod = this._blob_modifier;

        if (this.stored_level.blob_behavior === 1) {
            // "4 patterns" just increments by 1 every time (but /after/ returning)
            //this._blob_modifier = (this._blob_modifier + 1) % 4;
            mod = (mod + 1) % 4;
            this._blob_modifier = mod;
        }
        else {
            // Other modes do this curious operation
            mod *= 2;
            if (mod < 255) {
                mod ^= 0x1d;
            }
            mod &= 0xff;
            this._blob_modifier = mod;
        }

        return mod;
    }

    // Move the game state forwards by one tic.
    // Input is a bit mask of INPUT_BITS.
    advance_tic(p1_input) {
        if (this.state !== 'playing') {
            console.warn(`Level.advance_tic() called when state is ${this.state}`);
            return;
        }

        this.begin_tic(p1_input);
        this.finish_tic(p1_input);
    }

    begin_tic(p1_input) {
        // Store some current level state in the undo entry.  (These will often not be modified, but
        // they only take a few bytes each so that's fine.)
        for (let key of [
                '_rng1', '_rng2', '_blob_modifier', 'force_floor_direction',
                'tic_counter', 'time_remaining', 'timer_paused',
                'chips_remaining', 'bonus_points', 'hint_shown', 'state',
                'player1_move', 'player2_move',
        ]) {
            this.pending_undo.level_props[key] = this[key];
        }

        // Used for various tic-local effects; don't need to be undoable
        // TODO maybe this should be undone anyway so rewind looks better?
        this.player.is_blocked = false;

        this.sfx.set_player_position(this.player.cell);

        // CC2 wiring runs every frame, not every tic, so we need to do it three times, but dealing
        // with it is delicate.  We want the result of a button press to draw, but not last longer
        // than intended, so we only want one update between the end of the cooldown pass and the
        // end of the tic.  That means the other two have to go here.  When a level starts, there
        // are only two wiring updates before everything gets its first chance to move, so we skip
        // the very first one here.
        if (this.tic_counter !== 0) {
            this.update_wiring();
        }
        this.update_wiring();

        // FIRST PASS: actors tick their cooldowns, finish their movement, and possibly step on
        // cells they were moving into.  This has a few advantages: it makes rendering interpolation
        // much easier, and doing it as a separate pass from /starting/ movement (unlike Lynx)
        // improves the illusion that everything is happening simultaneously.
        // Note that, as far as I can tell, CC2 actually runs this pass every /frame/.  We do not!
        // Also Note that we iterate in reverse order, DESPITE keeping dead actors around with null
        // cells, to match the Lynx and CC2 behavior.  This is actually important in some cases;
        // check out the start of CCLP3 #54, where the gliders will eat the blue key immediately if
        // they act in forward order!  (More subtly, even the decision pass does things like
        // advance the RNG, so for replay compatibility it needs to be in reverse order too.)
        for (let i = this.actors.length - 1; i >= 0; i--) {
            let actor = this.actors[i];
            // Actors with no cell were destroyed
            if (! actor.cell)
                continue;

            if (actor.movement_cooldown <= 0)
                continue;

            if (actor.cooldown_delay_hack) {
                // See the extensive comment in attempt_out_of_turn_step
                actor.cooldown_delay_hack += 1;
                continue;
            }

            this._set_tile_prop(actor, 'movement_cooldown', Math.max(0, actor.movement_cooldown - 1));

            if (actor.movement_cooldown <= 0) {
                if (actor.type.ttl) {
                    // This is an animation that just finished, so destroy it
                    this.remove_tile(actor);
                    continue;
                }

                if (! this.compat.tiles_react_instantly) {
                    this.step_on_cell(actor, actor.cell);
                }
                // Erase any trace of being in mid-movement, however:
                // - This has to happen after stepping on cells, because some effects care about
                // the cell we're arriving from
                // - Don't do it if stepping on the cell caused us to move again
                if (actor.movement_cooldown <= 0) {
                    this._set_tile_prop(actor, 'previous_cell', null);
                    this._set_tile_prop(actor, 'movement_speed', null);
                }
            }
        }

        // Mini extra pass: deal with teleporting separately.  Otherwise, actors may have been in
        // the way of the teleporter but finished moving away during the above loop; this is
        // particularly bad when it happens with a block you're pushing.
        for (let i = this.actors.length - 1; i >= 0; i--) {
            let actor = this.actors[i];
            if (! actor.cell)
                continue;

            if (actor.just_stepped_on_teleporter) {
                this.attempt_teleport(actor);
            }
        }

        // Here's the third.
        this.update_wiring();
    }

    finish_tic(p1_input) {
        // SECOND PASS: actors decide their upcoming movement simultaneously
        for (let i = this.actors.length - 1; i >= 0; i--) {
            let actor = this.actors[i];

            // Clear any old decisions ASAP.  Note that this prop is only used internally within a
            // single tic, so it doesn't need to be undoable
            actor.decision = null;

            if (! actor.cell)
                continue;

            if (actor.movement_cooldown > 0)
                continue;

            if (actor === this.player) {
                this.make_player_decision(actor, p1_input);
            }
            else {
                this.make_actor_decision(actor);
            }
        }

        // THIRD PASS: everyone actually moves
        let swap_player1 = false;
        for (let i = this.actors.length - 1; i >= 0; i--) {
            let actor = this.actors[i];
            if (! actor.cell)
                continue;

            if (actor.type.on_tic) {
                actor.type.on_tic(actor, this);
            }

            // Check this again, since an earlier pass may have caused us to start moving
            if (actor.movement_cooldown > 0)
                continue;

            // Check for special player actions, which can only happen when not moving
            if (actor === this.player) {
                let new_input = p1_input & ~this.previous_input;
                if (new_input & INPUT_BITS.cycle) {
                    this.cycle_inventory(this.player);
                }
                if (new_input & INPUT_BITS.drop) {
                    this.drop_item(this.player);
                }
                if (new_input & INPUT_BITS.swap) {
                    // This is delayed until the end of the tic to avoid screwing up anything
                    // checking this.player
                    swap_player1 = true;
                }
            }

            if (! actor.decision)
                continue;

            // Actor is allowed to move, so do so
            let old_cell = actor.cell;
            let success = this.attempt_step(actor, actor.decision);

            if (! success && actor.slide_mode === 'ice') {
                this._handle_slide_bonk(actor);
                success = this.attempt_step(actor, actor.decision);
            }

            // Track whether the player is blocked, for visual effect
            if (actor === this.player && actor.decision && ! success) {
                this.sfx.play_once('blocked');
                actor.is_blocked = true;
            }
        }

        // In the event that the player is sliding (and thus not deliberately moving) or has
        // stopped, remember their current movement direction here, too.
        // This is hokey, and doing it here is even hokier, but it seems to match CC2 behavior.
        if (this.player.movement_cooldown > 0) {
            this.remember_player_move(this.player.direction);
        }

        // Strip out any destroyed actors from the acting order
        // FIXME this is O(n), where n is /usually/ small, but i still don't love it.  not strictly
        // necessary, either; maybe only do it every few tics?
        let p = 0;
        for (let i = 0, l = this.actors.length; i < l; i++) {
            let actor = this.actors[i];
            // While we're here, delete this guy
            delete actor.cooldown_delay_hack;

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

        // Possibly switch players
        // FIXME not correct
        if (swap_player1) {
            this.player_index += 1;
            this.player_index %= this.players.length;
            this.player = this.players[this.player_index];
        }

        this.previous_input = p1_input;

        // Advance the clock
        // TODO i suspect cc2 does this at the beginning of the tic, but even if you've won?  if you
        // step on a penalty + exit you win, but you see the clock flicker 1 for a single frame
        this.tic_counter += 1;
        if (this.time_remaining !== null && ! this.timer_paused) {
            this.time_remaining -= 1;
            if (this.time_remaining <= 0) {
                this.fail('time');
            }
            else if (this.time_remaining % 20 === 0 && this.time_remaining < 30 * 20) {
                this.sfx.play_once('tick');
            }
        }

        this.commit();
    }

    make_player_decision(actor, input) {
        // Only reset the player's is_pushing between movement, so it lasts for the whole push
        this._set_tile_prop(actor, 'is_pushing', false);

        // TODO player in a cloner can't move (but player in a trap can still turn)

        // Extract directions from the input mask
        let dir1 = null, dir2 = null;
        if (((input & INPUT_BITS['up']) && (input & INPUT_BITS['down'])) ||
            ((input & INPUT_BITS['left']) && (input & INPUT_BITS['right'])))
        {
            // If two opposing directions are held at the same time, all input is ignored, so we
            // can't end up with more than 2 directions
        }
        else {
            for (let [direction, dirinfo] of Object.entries(DIRECTIONS)) {
                if (input & INPUT_BITS[dirinfo.action]) {
                    if (dir1 === null) {
                        dir1 = direction;
                    }
                    else {
                        dir2 = direction;
                        break;
                    }
                }
            }
        }

        let try_direction = (direction, push_mode) => {
            direction = actor.cell.redirect_exit(actor, direction);
            let dest_cell = this.get_neighboring_cell(actor.cell, direction);
            return (dest_cell &&
                ! actor.cell.blocks_leaving(actor, direction) &&
                // FIXME if the player steps into a monster cell here, they die instantly!  but only
                // if the cell doesn't block them??
                ! dest_cell.blocks_entering(actor, direction, this, push_mode));
        };

        // The player is unusual in several ways.
        // - Only the current player can override a force floor (and only if their last move was an
        //   involuntary force floor slide, perhaps before some number of ice slides).
        // - The player "block slaps", a phenomenon where they physically attempt to make both of
        //   their desired movements, having an impact on the world if appropriate, before deciding
        //   which of them to use.
        // - These two properties combine in a subtle way.  If we're on a force floor sliding right
        //   under a row of blue walls, then if we hold up, we will bump every wall along the way.
        //   If we hold up /and right/, we will only bump every other wall.  That is, if we're on a
        //   force floor and attempt to override but /fail/, it's not held against us -- but if we
        //   succeed, even if overriding in the same direction we're already moving, that does count
        //   as an override.
        let xxx_overriding = false;
        if (actor.slide_mode && ! (
            actor.slide_mode === 'force' &&
            dir1 !== null && actor.last_move_was_force))
        {
            // This is a forced move, in which case we don't even check it
            actor.decision = actor.direction;

            if (actor.slide_mode === 'force') {
                this._set_tile_prop(actor, 'last_move_was_force', true);
            }
            else if (actor.slide_mode === 'ice') {
                // A sliding player that bonks into a wall still needs to turn around, but in this
                // case they do NOT start pushing blocks early
                if (! try_direction(actor.direction, 'trace')) {
                    this._handle_slide_bonk(actor);
                }
            }
        }
        else if (dir1 === null) {
            // Not attempting to move, so do nothing
        }
        else {
            // At this point, we have exactly 1 or 2 directions, and deciding between them requires
            // checking which ones are blocked.  Note that we do this even if only one direction is
            // requested, meaning that we get to push blocks before anything else has moved!
            let open;
            if (dir2 === null) {
                // Only one direction is held, but for consistency, "check" it anyway
                open = try_direction(dir1, 'move');
                actor.decision = dir1;
            }
            else {
                // We have two directions.  If one of them is our current facing, we prefer that
                // one, UNLESS it's blocked AND the other isn't
                if (dir1 === actor.direction || dir2 === actor.direction) {
                    let other_direction = dir1 === actor.direction ? dir2 : dir1;
                    let curr_open = try_direction(actor.direction, 'move');
                    let other_open = try_direction(other_direction, 'move');
                    if (! curr_open && other_open) {
                        actor.decision = other_direction;
                        open = true;
                    }
                    else {
                        actor.decision = actor.direction;
                        open = curr_open;
                    }
                }
                else {
                    // Neither direction is the way we're moving, so try both and prefer horizontal
                    // FIXME i'm told cc2 prefers orthogonal actually, but need to check on that
                    // FIXME lynx only checks horizontal, what about cc2?  it must check both
                    // because of the behavior where pushing into a corner always pushes horizontal
                    let open1 = try_direction(dir1, 'move');
                    let open2 = try_direction(dir2, 'move');
                    if (open1 && ! open2) {
                        actor.decision = dir1;
                        open = true;
                    }
                    else if (! open1 && open2) {
                        actor.decision = dir2;
                        open = true;
                    }
                    else if (dir1 === 'east' || dir1 === 'west') {
                        actor.decision = dir1;
                        open = open1;
                    }
                    else {
                        actor.decision = dir2;
                        open = open2;
                    }
                }
            }

            // If we're overriding a force floor but the direction we're moving in is blocked, the
            // force floor takes priority (and we've already bumped the wall(s))
            if (actor.slide_mode === 'force' && ! open) {
                actor.decision = actor.direction;
                this._set_tile_prop(actor, 'last_move_was_force', true);
                // Be sure to invoke this hack if we're standing on an RFF
                this._handle_slide_bonk(actor);
            }
            else {
                // Otherwise this is 100% a conscious move so we lose our override power next tic
                this._set_tile_prop(actor, 'last_move_was_force', false);
            }
        }

        // Remember our choice for the sake of doppelgangers
        // FIXME still a bit unclear on how they handle secondary direction, but i'm not sure that's
        // even a real concept in lynx, so maybe this is right??
        this.remember_player_move(actor.decision);
    }

    make_actor_decision(actor) {
        // Compat flag for blue tanks
        if (this.compat.sliding_tanks_ignore_button &&
            actor.slide_mode && actor.pending_reverse)
        {
            this._set_tile_prop(actor, 'pending_reverse', false);
        }

        if (actor.pending_push) {
            // Blocks that were pushed while sliding will move in the push direction as soon as
            // they stop sliding, regardless of what they landed on
            actor.decision = actor.pending_push;
            this._set_tile_prop(actor, 'pending_push', null);
            return;
        }

        let direction_preference;
        if (actor.slide_mode) {
            // Actors can't make voluntary moves while sliding; they just, ah, slide.
            actor.decision = actor.direction;
            return;
        }
        else if (actor.cell.some(tile => tile.type.traps && tile.type.traps(tile, actor))) {
            // An actor in a cloner or a closed trap can't turn
            // TODO because of this, if a tank is trapped when a blue button is pressed, then
            // when released, it will make one move out of the trap and /then/ turn around and
            // go back into the trap.  this is consistent with CC2 but not ms/lynx
            return;
        }
        else if (actor.type.decide_movement) {
            direction_preference = actor.type.decide_movement(actor, this);
        }

        // Check which of those directions we *can*, probably, move in
        if (! direction_preference)
            return;
        let all_blocked = true;
        for (let [i, direction] of direction_preference.entries()) {
            if (typeof direction === 'function') {
                // Lazy direction calculation (used for walkers)
                direction = direction();
            }

            direction = actor.cell.redirect_exit(actor, direction);

            if (this.is_move_allowed(actor, direction, 'trace')) {
                // We found a good direction!  Stop here
                actor.decision = direction;
                all_blocked = false;
                break;
            }

            // If every other preference be blocked, actors unconditionally try the last one
            // (and might even be able to move that way by the time their turn comes!)
            if (i === direction_preference.length - 1) {
                actor.decision = direction;
            }
        }
    }

    // FIXME can probably clean this up a decent bit now
    _handle_slide_bonk(actor) {
        if (actor.slide_mode === 'ice') {
            // Actors on ice turn around when they hit something
            actor.decision = DIRECTIONS[actor.direction].opposite;
            this.set_actor_direction(actor, actor.decision);
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
            actor.decision = actor.direction;
        }
    }

    // FIXME make this interact with railroads correctly and use it for players and in attempt_step
    is_move_allowed(actor, direction, push_mode) {
        let dest_cell = this.get_neighboring_cell(actor.cell, direction);
        return (dest_cell &&
            ! actor.cell.blocks_leaving(actor, direction) &&
            ! dest_cell.blocks_entering(actor, direction, this, push_mode));
    }

    // Try to move the given actor one tile in the given direction and update their cooldown.
    // Return true if successful.
    attempt_step(actor, direction) {
        // In mid-movement, we can't even change direction!
        if (actor.movement_cooldown > 0)
            return false;

        direction = actor.cell.redirect_exit(actor, direction);
        this.set_actor_direction(actor, direction);

        // Record our speed, and halve it below if we're stepping onto a sliding tile
        let speed = actor.type.movement_speed;
        let double_speed = false;

        let move = DIRECTIONS[direction].movement;
        let goal_cell = this.get_neighboring_cell(actor.cell, direction);

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
                // FIXME this can probably reuse blocks_entering now
                // Try to move into the cell.  This is usually a simple check of whether we can
                // enter it (similar to Cell.blocks_entering), but if the only thing blocking us is
                // a pushable object, we have to do two more passes: one to push anything pushable,
                // then one to check whether we're blocked again.
                let blocked_by_pushable = false;
                for (let tile of goal_cell) {
                    if (tile.blocks(actor, direction, this)) {
                        if (actor.can_push(tile, direction)) {
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
                        double_speed = true;
                    }

                    // Bump tiles that we're even attempting to move into; this mostly reveals
                    // invisible walls, blue floors, etc.
                    // XXX how to guarantee this only happens once...
                    if (actor.type.on_bump) {
                        if (actor.type.on_bump(actor, this, tile) === false)
                            return;
                    }
                    if (tile.type.on_bumped) {
                        tile.type.on_bumped(tile, this, actor);
                    }
                }

                // If the only thing blocking us can be pushed, give that a shot
                if (! blocked && blocked_by_pushable) {
                    // This time make a copy, since we're modifying the contents of the cell
                    for (let tile of Array.from(goal_cell)) {
                        if (! actor.can_push(tile, direction))
                            continue;

                        if (! this.attempt_out_of_turn_step(tile, direction) &&
                            tile.slide_mode !== null && tile.movement_cooldown !== 0)
                        {
                            // If the push failed and the obstacle is in the middle of a slide,
                            // remember this as the next move it'll make
                            this._set_tile_prop(tile, 'pending_push', direction);
                        }
                        if (actor === this.player) {
                            this._set_tile_prop(actor, 'is_pushing', true);
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
            return false;
        }

        // We're clear!
        if (double_speed || actor.has_item('speed_boots')) {
            speed /= 2;
        }

        this._set_tile_prop(actor, 'previous_cell', actor.cell);
        this._set_tile_prop(actor, 'movement_cooldown', speed);
        this._set_tile_prop(actor, 'movement_speed', speed);
        this.move_to(actor, goal_cell, speed);

        return true;
    }

    attempt_out_of_turn_step(actor, direction) {
        if (this.attempt_step(actor, direction)) {
            // Here's the problem.
            // In CC2, cooldown is measured in frames, not tics, and it decrements every frame, not
            // every tic.  You usually don't notice because actors can only initiate moves every
            // three frames (= 1 tic), so the vast majority of the game is tic-aligned.
            // This is where it leaks.  If actor X's cooldown causes them to press a button which
            // then initiates an out-of-turn move (i.e. the forced move from a clone or trap
            // ejection) for actor Y, and actor Y comes later in the actor order, then actor Y will
            // decrement its cooldown during that same cooldown phase, putting it /between/ tics.
            // If I copy this behavior and decrement by an entire tic, then actor Y will stay a full
            // tic ahead indefinitely, whereas in CC2 it would only be a frame ahead and would
            // eventually have to wait a frame before it could move again.  If I ignore this
            // behavior wholesale and don't let actor Y decrement at all, then a player being
            // ejected from a trap could still have her tail bitten.  So here's the compromise: I
            // set this turn-local flag on actor Y; then if they do have a cooldown later, it's
            // ignored BUT the flag is incremented; and then if the flag is 2, the actor is exempt
            // from tail-biting.  (I am reasonably confident that tail-biting is the only possible
            // side effect here, since actor Y has left the cell even if they haven't visibly moved
            // yet, and tail-biting is the sole effect that looks "back in time".)
            // XXX that's still not perfect; if actor X is tic-misaligned, like if there's a chain
            // of 3 or more actors cloning directly onto red buttons for other cloners, then this
            // cannot possibly work
            actor.cooldown_delay_hack = 1;
            return true;
        }
        else {
            return false;
        }
    }

    // Move the given actor to the given position and perform any appropriate
    // tile interactions.  Does NOT check for whether the move is actually
    // legal; use attempt_step for that!
    move_to(actor, goal_cell, speed) {
        if (actor.cell === goal_cell)
            return;

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
        if (actor === this.player) {
            this.hint_shown = null;
        }
        for (let tile of goal_cell) {
            if (actor.type.is_real_player && tile.type.is_monster) {
                this.fail(tile.type.name);
            }
            else if (actor.type.is_monster && tile.type.is_real_player) {
                this.fail(actor.type.name);
            }
            else if (actor.type.is_block && tile.type.is_real_player) {
                this.fail('squished');
            }

            if (tile.type.slide_mode && ! actor.ignores(tile.type.name)) {
                this.make_slide(actor, tile.type.slide_mode);
            }

            if (actor === this.player && tile.type.is_hint) {
                this.hint_shown = tile.hint_text ?? this.stored_level.hint;
            }
        }

        // If we're stepping directly on the player, that kills them too; the player and a monster
        // must be at least 5 tics apart
        // TODO the rules in lynx might be slightly different?
        if (actor.type.is_monster && goal_cell === this.player.previous_cell &&
            // Player has decided to leave their cell, but hasn't actually taken a step yet
            this.player.movement_cooldown === this.player.movement_speed &&
            // See the extensive comment in attempt_out_of_turn_step
            this.player.cooldown_delay_hack !== 2)
        {
            this.fail(actor.type.name);
        }

        if (actor === this.player && goal_cell[0].type.name === 'floor') {
            this.sfx.play_once('step-floor');
        }

        // Announce we're approaching
        for (let tile of Array.from(actor.cell)) {
            if (tile === actor)
                continue;
            if (actor.ignores(tile.type.name))
                continue;

            if (tile.type.on_approach) {
                tile.type.on_approach(tile, this, actor);
            }
        }

        if (this.compat.tiles_react_instantly) {
            this.step_on_cell(actor, actor.cell);
        }
    }

    // Step on every tile in a cell we just arrived in
    step_on_cell(actor, cell) {
        // Step on topmost things first -- notably, it's safe to step on water with flippers on top
        for (let tile of Array.from(cell).reverse()) {
            if (tile === actor)
                continue;
            if (actor.ignores(tile.type.name))
                continue;

            if (tile.type.is_item &&
                (actor.type.has_inventory ||
                    cell.some(t => t.type.item_modifier === 'pickup')) &&
                this.attempt_take(actor, tile))
            {
                if (tile.type.is_key) {
                    this.sfx.play_once('get-key', cell);
                }
                else {
                    this.sfx.play_once('get-tool', cell);
                }
            }
            else if (tile.type.teleport_dest_order) {
                // This is used by an extra pass just after our caller, so it doesn't need to undo
                actor.just_stepped_on_teleporter = tile;
            }
            else if (tile.type.on_arrive) {
                tile.type.on_arrive(tile, this, actor);
            }
        }
    }

    attempt_teleport(actor) {
        let teleporter = actor.just_stepped_on_teleporter;
        actor.just_stepped_on_teleporter = null;

        // Handle teleporting, now that the dust has cleared
        // FIXME something funny happening here, your input isn't ignored while walking out of it?
        let original_direction = actor.direction;
        let success = false;
        for (let dest of teleporter.type.teleport_dest_order(teleporter, this, actor)) {
            // Teleporters already containing an actor are blocked and unusable
            // FIXME should check collision?
            if (dest.cell.some(tile => tile.type.is_actor && tile !== actor))
                continue;

            // Physically move the actor to the new teleporter
            // XXX lynx treats this as a slide and does it in a pass in the main loop
            // XXX not especially undo-efficient
            // FIXME the new aggressive move checker could help here!
            this.remove_tile(actor);
            this.add_tile(actor, dest.cell);

            // FIXME teleport overrides...  also allow block slapping...  seems like horizontal
            // wins...

            // Red and green teleporters attempt to spit you out in every direction before
            // giving up on a destination (but not if you return to the original).
            // Note that we use actor.direction here (rather than original_direction) because
            // green teleporters modify it in teleport_dest_order, to randomize the exit
            // direction
            let direction = actor.direction;
            let num_directions = 1;
            if (teleporter.type.teleport_try_all_directions && dest !== teleporter) {
                num_directions = 4;
            }
            // FIXME bleugh hardcode
            if (dest === teleporter && teleporter.type.name === 'teleport_yellow') {
                break;
            }
            for (let i = 0; i < num_directions; i++) {
                if (this.attempt_out_of_turn_step(actor, direction)) {
                    success = true;
                    // Sound plays from the origin cell simply because that's where the sfx player
                    // thinks the player is currently; position isn't updated til next turn
                    this.sfx.play_once('teleport', teleporter.cell);
                    break;
                }
                else {
                    direction = DIRECTIONS[direction].right;
                }
            }

            if (success) {
                break;
            }
            else if (num_directions === 4) {
                // Restore our original facing before continuing
                // (For red teleports, we try every possible destination in our original
                // movement direction, so this is correct.  For green teleports, we only try one
                // destination and then fall back to walking through the source in our original
                // movement direction, so this is still correct.)
                this.set_actor_direction(actor, original_direction);
            }
        }

        if (! success && actor.type.has_inventory && teleporter.type.name === 'teleport_yellow') {
            // Super duper special yellow teleporter behavior: you pick it the fuck up
            // FIXME not if there's only one in the level?
            this.attempt_take(actor, teleporter);
            if (actor === this.player) {
                this.sfx.play_once('get-tool', teleporter.cell);
            }
        }
    }

    remember_player_move(direction) {
        if (this.player.type.name === 'player') {
            this.player1_move = direction;
        }
        else {
            this.player2_move = direction;
        }
    }

    cycle_inventory(actor) {
        if (this.stored_level.use_cc1_boots)
            return;
        if (actor.movement_cooldown > 0)
            return;

        // Cycle leftwards, i.e., the oldest item moves to the end of the list
        if (actor.toolbelt && actor.toolbelt.length > 1) {
            actor.toolbelt.push(actor.toolbelt.shift());
            this.pending_undo.push(() => actor.toolbelt.unshift(actor.toolbelt.pop()));
        }
    }

    drop_item(actor, force = false) {
        if (this.stored_level.use_cc1_boots)
            return;
        if (actor.movement_cooldown > 0)
            return;

        // Drop the oldest item, i.e. the first one
        if (actor.toolbelt && actor.toolbelt.length > 0 && (force || ! actor.cell.get_item())) {
            let name = actor.toolbelt[0];
            if (name === 'teleport_yellow') {
                // We can only be dropped on regular floor
                let terrain = actor.cell.get_terrain();
                if (terrain.type.name !== 'floor')
                    return;

                this.transmute_tile(terrain, 'teleport_yellow');
            }
            else {
                let type = TILE_TYPES[name];
                if (type.on_drop) {
                    name = type.on_drop(this, actor);
                    if (name) {
                        type = TILE_TYPES[name];
                    }
                }
                let tile = new Tile(type);
                if (type.is_actor) {
                    tile.direction = actor.direction;
                    this.add_actor(tile);
                }
                this.add_tile(tile, actor.cell);
            }

            actor.toolbelt.shift();
            this.pending_undo.push(() => actor.toolbelt.unshift(name));
        }
    }

    // Update the state of all wired tiles in the game.
    // XXX need to be clear on the order of events here.  say everything starts out unpowered.
    // then:
    // 1. you step on a pink button, which flags itself as going to be powered next frame
    // 2. this pass happens.  every unpowered-but-wired cell is inspected.  if a powered one is
    // found, floodfill from there
    // FIXME can probably skip this if we know there are no wires at all, like in a CCL, or just an
    // unwired map
    // FIXME this feels inefficient.  most of the time none of the inputs have changed so none of
    // this needs to happen at all
    // FIXME none of this is currently undoable
    update_wiring() {
        // FIXME:
        // - make this undoable  :(
        // - blue tele, red tele, and pink button have different connections
        // - would like to reuse the walk for blue teles
        // - currently doesn't notice when circuit block moves sometimes

        // Gather every tile that's emitting power.  Along the way, check whether any of them have
        // changed since last tic, so we can skip this work entirely if none did
        let neighbors = [];
        let any_changed = false;
        for (let tile of this.power_sources) {
            if (! tile.cell)
                continue;
            let emitting = tile.type.get_emitting_edges(tile, this);
            if (emitting) {
                neighbors.push([tile.cell, emitting]);
            }
            if (emitting !== tile.emitting_edges) {
                any_changed = true;
                tile.emitting_edges = emitting;
            }
        }
        // Also check actors, since any of them might be holding a lightning bolt (argh)
        for (let actor of this.actors) {
            if (! actor.cell)
                continue;
            // Only count when they're on a floor tile AND not in transit!
            let emitting = 0;
            if (actor.movement_cooldown === 0 && actor.has_item('lightning_bolt')) {
                let wired_tile = actor.cell.get_wired_tile();
                if (wired_tile && wired_tile.type.name === 'floor') {
                    emitting = true;
                    neighbors.push([actor.cell, wired_tile.wire_directions]);
                }
            }
            if (emitting !== actor.emitting_edges) {
                any_changed = true;
                actor.emitting_edges = emitting;
            }
        }
        // If none changed, we're done
        if (! any_changed)
            return;

        // Turn off power to every cell
        // TODO wonder if i need a linear cell list, or even a flat list of all tiles (that sounds
        // like hell to keep updated though)
        for (let row of this.cells) {
            for (let cell of row) {
                cell.prev_powered_edges = cell.powered_edges;
                cell.powered_edges = 0;
            }
        }

        // Iterate over emitters and flood-fill outwards one edge at a time
        // propagated it via flood-fill through neighboring wires
        while (neighbors.length > 0) {
            let [cell, source_direction] = neighbors.shift();
            let wire = cell.get_wired_tile();

            // Power this cell
            if (typeof(source_direction) === 'number') {
                // This cell is emitting power itself, and the source direction is actually a
                // bitmask of directions
                cell.powered_edges = source_direction;
            }
            else {
                let bit = DIRECTIONS[source_direction].bit;
                if (wire === null || (wire.wire_directions & bit) === 0) {
                    // No wire on this side, so the power doesn't actually propagate, but it DOES
                    // stay on this edge (so if this is e.g. a purple tile, it'll be powered)
                    cell.powered_edges |= bit;
                    continue;
                }

                // Common case: power entering a wired edge and propagating outwards.  There are a
                // couple special cases:
                if (wire.type.wire_propagation_mode === 'none') {
                    // This tile type has wires, but none of them connect to each other
                    cell.powered_edges |= bit;
                    continue;
                }
                else if (wire.wire_directions === 0x0f && wire.type.wire_propagation_mode !== 'all') {
                    // If all four wires are present, they don't actually make a four-way
                    // connection, but two straight wires that don't connect to each other (with the
                    // exception of blue teleporters)
                    cell.powered_edges |= bit;
                    cell.powered_edges |= DIRECTIONS[DIRECTIONS[source_direction].opposite].bit;
                }
                else {
                    cell.powered_edges = wire.wire_directions;
                }
            }

            // Propagate current to neighbors
            for (let [direction, dirinfo] of Object.entries(DIRECTIONS)) {
                if (direction === source_direction)
                    continue;
                if ((cell.powered_edges & dirinfo.bit) === 0)
                    continue;

                let neighbor, neighbor_wire;
                let opposite_bit = DIRECTIONS[dirinfo.opposite].bit;
                if (wire && (wire.wire_tunnel_directions & dirinfo.bit)) {
                    // Search in the given direction until we find a matching tunnel
                    // FIXME these act like nested parens!
                    let x = cell.x;
                    let y = cell.y;
                    let nesting = 0;
                    while (true) {
                        x += dirinfo.movement[0];
                        y += dirinfo.movement[1];
                        if (! this.is_point_within_bounds(x, y))
                            break;

                        let candidate = this.cells[y][x];
                        neighbor_wire = candidate.get_wired_tile();
                        if (neighbor_wire && ((neighbor_wire.wire_tunnel_directions ?? 0) & opposite_bit)) {
                            neighbor = candidate;
                            break;
                        }
                    }
                }
                else {
                    // No tunnel; this is easy
                    neighbor = this.get_neighboring_cell(cell, direction);
                    if (neighbor) {
                        neighbor_wire = neighbor.get_wired_tile();
                    }
                }

                if (neighbor && (neighbor.powered_edges & opposite_bit) === 0 &&
                    // Unwired tiles are OK; they might be something activated by power.
                    // Wired tiles that do NOT connect to us are ignored.
                    (! neighbor_wire || neighbor_wire.wire_directions & opposite_bit))
                {
                    neighbors.push([neighbor, dirinfo.opposite]);
                }
            }
        }

        // Inform any affected cells of power changes
        for (let row of this.cells) {
            for (let cell of row) {
                if ((cell.prev_powered_edges === 0) !== (cell.powered_edges === 0)) {
                    let method = cell.powered_edges ? 'on_power' : 'on_depower';
                    for (let tile of cell) {
                        if (tile.type[method]) {
                            tile.type[method](tile, this);
                        }
                    }
                }
            }
        }
    }

    // Performs a depth-first search for connected wires and wire objects, extending out from the
    // given starting cell
    *follow_circuit(cell) {
    }

    // -------------------------------------------------------------------------
    // Board inspection

    is_point_within_bounds(x, y) {
        return (x >= 0 && x < this.width && y >= 0 && y < this.height);
    }

    cell(x, y) {
        if (this.is_point_within_bounds(x, y)) {
            return this.cells[y][x];
        }
        else {
            return null;
        }
    }

    get_neighboring_cell(cell, direction) {
        let move = DIRECTIONS[direction].movement;
        let goal_x = cell.x + move[0];
        let goal_y = cell.y + move[1];
        if (this.is_point_within_bounds(goal_x, goal_y)) {
            return this.cells[goal_y][goal_x];
        }
        else {
            return null;
        }
    }

    // Iterates over the grid in (reverse?) reading order and yields all tiles with the given name.
    // The starting cell is iterated last.
    *iter_tiles_in_reading_order(start_cell, name, reverse = false) {
        let x = start_cell.x;
        let y = start_cell.y;
        while (true) {
            if (reverse) {
                x -= 1;
                if (x < 0) {
                    x = this.width - 1;
                    y = (y - 1 + this.height) % this.height;
                }
            }
            else {
                x += 1;
                if (x >= this.width) {
                    x = 0;
                    y = (y + 1) % this.height;
                }
            }

            let cell = this.cells[y][x];
            for (let tile of cell) {
                if (tile.type.name === name) {
                    yield tile;
                }
            }

            if (cell === start_cell)
                return;
        }
    }

    // Iterates over the grid in a diamond pattern, spreading out from the given start cell (but not
    // including it).  Only used for connecting orange buttons.
    *iter_cells_in_diamond(start_cell) {
        let max_search_radius = Math.max(this.size_x, this.size_y);
        for (let dist = 1; dist <= max_search_radius; dist++) {
            // Start east and move counterclockwise
            let sx = start_cell.x + dist;
            let sy = start_cell.y;
            for (let direction of [[-1, -1], [-1, 1], [1, 1], [1, -1]]) {
                for (let i = 0; i < dist; i++) {
                    if (this.is_point_within_bounds(sx, sy)) {
                        yield this.cells[sy][sx];
                    }
                    sx += direction[0];
                    sy += direction[1];
                }
            }
        }
    }

    is_cell_wired(cell) {
        for (let direction of Object.keys(DIRECTIONS)) {
            let neighbor = this.get_neighboring_cell(cell, direction);
            if (! neighbor)
                continue;

            let wired = neighbor.get_wired_tile();
            if (! wired)
                continue;

            if (wired.wire_directions & DIRECTIONS[DIRECTIONS[direction].opposite].bit)
                return true;
        }
        return false;
    }

    // -------------------------------------------------------------------------
    // Undo handling

    create_undo_entry() {
        let entry = [];
        entry.tile_changes = new Map;
        entry.level_props = {};
        return entry;
    }

    has_undo() {
        let prev_index = this.undo_buffer_index - 1;
        if (prev_index < 0) {
            prev_index += UNDO_BUFFER_SIZE;
        }

        return this.undo_buffer[prev_index] !== null;
    }

    commit() {
        this.undo_buffer[this.undo_buffer_index] = this.pending_undo;
        this.pending_undo = this.create_undo_entry();

        this.undo_buffer_index += 1;
        this.undo_buffer_index %= UNDO_BUFFER_SIZE;
    }

    undo() {
        this.aid = Math.max(1, this.aid);

        // In turn-based mode, we might still be in mid-tic with a partial undo stack; do that first
        this._undo_entry(this.pending_undo);
        this.pending_undo = this.create_undo_entry();

        this.undo_buffer_index -= 1;
        if (this.undo_buffer_index < 0) {
            this.undo_buffer_index += UNDO_BUFFER_SIZE;
        }
        this._undo_entry(this.undo_buffer[this.undo_buffer_index]);
        this.undo_buffer[this.undo_buffer_index] = null;
    }

    // Reverse a single undo entry
    _undo_entry(entry) {
        if (! entry) {
            return;
        }

        // Undo in reverse order!  There's no redo, so it's okay to destroy this
        entry.reverse();
        for (let undo of entry) {
            undo();
        }
        for (let [tile, changes] of entry.tile_changes) {
            for (let [key, value] of changes) {
                tile[key] = value;
            }
        }
        for (let [key, value] of Object.entries(entry.level_props)) {
            this[key] = value;
        }
    }

    // -------------------------------------------------------------------------
    // Level alteration methods.  EVERYTHING that changes the state of a level,
    // including the state of a single tile, should do it through one of these
    // for undo/rewind purposes

    _set_tile_prop(tile, key, val) {
        if (tile[key] === val)
            return;

        let changes = this.pending_undo.tile_changes.get(tile);
        if (! changes) {
            changes = new Map;
            this.pending_undo.tile_changes.set(tile, changes);
        }

        // If we haven't yet done so, log the original value
        if (! changes.has(key)) {
            changes.set(key, tile[key]);
        }
        // If there's an original value already logged, and it's the value we're about to change
        // back to, then delete the change
        else if (changes.get(key) === val) {
            changes.delete(key);
        }

        tile[key] = val;
    }

    collect_chip() {
        if (this.chips_remaining > 0) {
            this.sfx.play_once('get-chip');
            this.chips_remaining--;
        }
    }

    adjust_bonus(add, mult = 1) {
        this.bonus_points = Math.ceil(this.bonus_points * mult) + add;
    }

    pause_timer() {
        if (this.time_remaining === null)
            return;

        this.timer_paused = ! this.timer_paused;
    }

    adjust_timer(dt) {
        // Untimed levels become timed levels with 0 seconds remaining
        this.time_remaining = Math.max(0, (this.time_remaining ?? 0) + dt * 20);
        if (this.time_remaining <= 0) {
            // If the timer isn't paused, this will kill the player at the end of the tic
            this.time_remaining = 1;
        }
    }

    fail(reason) {
        if (this.state !== 'playing')
            return;

        if (reason === 'time') {
            this.sfx.play_once('timeup');
        }
        else {
            this.sfx.play_once('lose');
        }

        this.pending_undo.push(() => {
            this.fail_reason = null;
            this.player.fail_reason = null;
        });
        this.state = 'failure';
        this.fail_reason = reason;
        this.player.fail_reason = reason;
    }

    win() {
        if (this.state !== 'playing')
            return;

        this.sfx.play_once('win');
        this.state = 'success';
        this._set_tile_prop(this.player, 'exited', true);
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
    // TODO should add in the right layer?  maybe?  hard to say what that is when mscc levels might
    // have things stacked in a weird order though
    // TODO would be nice to make these not be closures but order matters much more here

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
        // Co-opt movement_cooldown/speed for these despite that they aren't moving, since they're
        // also used to animate everything else.  Decrement the cooldown immediately, to match the
        // normal actor behavior of decrementing one's own cooldown at the end of one's turn
        this._set_tile_prop(tile, 'movement_speed', tile.type.ttl);
        this._set_tile_prop(tile, 'movement_cooldown', tile.type.ttl - 1);
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
            this._set_tile_prop(tile, 'previous_cell', null);
            this._set_tile_prop(tile, 'movement_speed', tile.type.ttl);
            this._set_tile_prop(tile, 'movement_cooldown', tile.type.ttl - 1);
        }
    }

    // Have an actor try to pick up a particular tile; it's prevented if there's a no sign, and the
    // tile is removed if successful
    attempt_take(actor, tile) {
        let mod = tile.cell.get_item_mod();
        if (mod && mod.type.item_modifier === 'ignore')
            return false;

        if (this.give_actor(actor, tile.type.name)) {
            if (tile.type.draw_layer === 0) {
                // This should only happen for the yellow teleporter
                this.transmute_tile(tile, 'floor');
            }
            else {
                this.remove_tile(tile);
            }
            if (mod && mod.type.item_modifier === 'pickup') {
                this.remove_tile(mod);
            }
            return true;
        }
        return false;
    }

    // Give an item to an actor, even if it's not supposed to have an inventory
    give_actor(actor, name) {
        // TODO support use_cc1_boots here -- silently consume dupes, only do cc1 items
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

            // Nothing can hold more than four items
            if (actor.toolbelt.length > 4) {
                this.drop_item(actor, true);
            }
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

    take_tool_from_actor(actor, name) {
        if (actor.toolbelt) {
            let index = actor.toolbelt.indexOf(name);
            if (index >= 0) {
                actor.toolbelt.splice(index, 1);
                this.pending_undo.push(() => actor.toolbelt.splice(index, 0, name));
                return true;
            }
        }

        return false;
    }

    take_all_keys_from_actor(actor) {
        if (actor.keyring && Object.values(actor.keyring).some(n => n > 0)) {
            let keyring = actor.keyring;
            this.pending_undo.push(() => actor.keyring = keyring);
            actor.keyring = {};
            return true;
        }
    }

    take_all_tools_from_actor(actor) {
        if (actor.toolbelt && actor.toolbelt.length > 0) {
            let toolbelt = actor.toolbelt;
            this.pending_undo.push(() => actor.toolbelt = toolbelt);
            actor.toolbelt = [];
            return true;
        }
    }

    // Mark an actor as sliding
    make_slide(actor, mode) {
        this._set_tile_prop(actor, 'slide_mode', mode);
    }

    // Change an actor's direction
    set_actor_direction(actor, direction) {
        this._set_tile_prop(actor, 'direction', direction);
    }
}
