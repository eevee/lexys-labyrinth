import * as algorithms from './algorithms.js';
import { DIRECTIONS, DIRECTION_ORDER, INPUT_BITS, TICS_PER_SECOND } from './defs.js';
import { LevelInterface } from './format-base.js';
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
            let p = ((this.movement_speed - this.movement_cooldown) + tic_offset * 3) / this.movement_speed;
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
        return tile.cell.try_leaving(tile, direction);
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
Tile.prototype.powered_edges = 0;
Tile.prototype.wire_directions = 0;
Tile.prototype.wire_tunnel_directions = 0;

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
            if ((tile.wire_directions || tile.wire_tunnel_directions) && ! tile.movement_cooldown) {
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
        return this.some(tile => tile.type.name === name);
    }

    try_leaving(actor, direction) {
        for (let tile of this) {
            if (tile === actor)
                continue;

            if (tile.type.traps && tile.type.traps(tile, actor))
                return false;

            if (tile.type.blocks_leaving && tile.type.blocks_leaving(tile, actor, direction))
                return false;
        }
        return true;
    }

    // Check if this actor can move this direction into this cell.  Returns true on success.  May
    // have side effects, depending on the value of push_mode:
    // - null: Default.  Do not impact game state.  Treat pushable objects as blocking.
    // - 'bump': Fire bump triggers.  Don't move pushable objects, but do check whether they /could/
    //   be pushed, recursively if necessary.
    // - 'push': Fire bump triggers.  Attempt to move pushable objects out of the way immediately.
    try_entering(actor, direction, level, push_mode = null) {
        let pushable_tiles = [];
        let blocked = false;
        // (Note that here, and anywhere else that has any chance of altering the cell's contents,
        // we iterate over a copy of the cell to insulate ourselves from tiles appearing or
        // disappearing mid-iteration.)
        for (let tile of Array.from(this)) {
            // TODO check ignores here?
            if (actor.type.on_bump) {
                actor.type.on_bump(actor, level, tile, direction);
            }
            if (tile.type.on_bumped) {
                tile.type.on_bumped(tile, level, actor);
            }

            if (! tile.blocks(actor, direction, level))
                continue;

            if (push_mode === null)
                return false;

            if (! actor.can_push(tile, direction)) {
                if (push_mode === 'push') {
                    // Track this instead of returning immediately, because 'push' mode also bumps
                    // every tile in the cell
                    blocked = true;
                }
                else {
                    return false;
                }
            }

            // Collect pushables for later, so we don't inadvertently push through a wall
            pushable_tiles.push(tile);
        }

        if (blocked)
            return false;

        // If we got this far, all that's left is to deal with pushables
        if (pushable_tiles.length > 0) {
            // This ends recursive push attempts, which can happen with a row of ice clogged by ice
            // blocks that are trying to slide
            actor._trying_to_push = true;
            try {
                for (let tile of pushable_tiles) {
                    if (tile._trying_to_push)
                        return false;
                    if (push_mode === 'bump') {
                        // FIXME this doesn't take railroad curves into account, e.g. it thinks a
                        // rover can't push a block through a curve
                        if (! level.check_movement(tile, tile.cell, direction, push_mode))
                            return false;
                    }
                    else if (push_mode === 'push') {
                        if (actor === level.player) {
                            level._set_tile_prop(actor, 'is_pushing', true);
                        }
                        if (! level.attempt_out_of_turn_step(tile, direction)) {
                            if (tile.slide_mode !== null && tile.movement_cooldown > 0) {
                                // If the push failed and the obstacle is in the middle of a slide,
                                // remember this as the next move it'll make
                                level._set_tile_prop(tile, 'pending_push', direction);
                            }
                            return false;
                        }
                    }
                }
            }
            finally {
                delete actor._trying_to_push;
            }

            // In push mode, check one last time for being blocked, in case we e.g. pushed a block
            // off of a recessed wall
            // TODO unclear if this is the right way to emulate spring mining, but without the check
            // for a player, it happens /too/ often; try allowing for ann actors and running the 163
            // BLOX replay, and right at the end ice blocks spring mine each other.  also, the wiki
            // suggests something about another actor moving away at the same time?
            if (! (level.compat.emulate_spring_mining && actor.type.is_real_player) &&
                push_mode === 'push' && this.some(tile => tile.blocks(actor, direction, level)))
                return false;
        }

        return true;
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

// The undo stack is implemented with a ring buffer, and this is its size.  One entry per tic.
// Based on Chrome measurements made against the pathological level CCLP4 #40 (Periodic Lasers) and
// sitting completely idle, undo consumes about 2 MB every five seconds, so this shouldn't go beyond
// 12 MB for any remotely reasonable level.
const UNDO_BUFFER_SIZE = TICS_PER_SECOND * 30;
export class Level extends LevelInterface {
    constructor(stored_level, compat = {}) {
        super();
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

        this.linear_cells = [];
        this.player = null;
        this.p1_input = 0;
        this.p1_released = 0xff;
        this.actors = [];
        this.chips_remaining = this.stored_level.chips_required;
        this.bonus_points = 0;
        this.aid = 0;

        this.yellow_tank_decision = null;

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
        // If undo_enabled is false, we won't create any undo entries.
        // Undo is only disabled during bulk testing, where a) there's no
        // possibility of needing to undo and b) the overhead is noticable.
        this.undo_enabled = true;

        let n = 0;
        let connectables = [];
        this.remaining_players = 0;
        // Speedup for flame jets, which aren't actors but do a thing every tic
        // TODO this won't notice if a new tile with an on_tic is created, but that's impossible
        // atm...  or, at least, it's hacked to still work with flame_jet_off
        this.static_on_tic_tiles = [];
        for (let y = 0; y < this.height; y++) {
            let row = [];
            for (let x = 0; x < this.width; x++) {
                let cell = new Cell(x, y);
                row.push(cell);
                this.linear_cells.push(cell);

                let stored_cell = this.stored_level.linear_cells[n];
                n++;

                for (let template_tile of stored_cell) {
                    let tile = Tile.from_template(template_tile);
                    if (tile.type.is_hint) {
                        // Copy over the tile-specific hint, if any
                        tile.hint_text = template_tile.hint_text ?? null;
                    }

                    if (tile.type.is_real_player) {
                        this.remaining_players += 1;
                        if (this.player === null) {
                            this.player = tile;
                        }
                    }
                    if (tile.type.is_actor) {
                        this.actors.push(tile);
                    }
                    else if (tile.type.on_tic) {
                        this.static_on_tic_tiles.push(tile);
                    }
                    cell._add(tile);

                    if (tile.type.connects_to) {
                        connectables.push(tile);
                    }
                }
            }
        }
        // TODO complain if no player

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
                    for (let tile of this.cell(tx, ty)) {
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

        // Build circuits out of connected wires
        // TODO document this idea
        this.circuits = [];
        this.power_sources = [];
        let wired_outputs = new Set;
        this.wired_outputs = [];
        let add_to_edge_map = (map, item, edges) => {
            map.set(item, (map.get(item) ?? 0) | edges);
        };
        for (let cell of this.linear_cells) {
            // We're interested in static circuitry, which means terrain
            let terrain = cell.get_terrain();
            if (! terrain)  // ?!
                continue;

            if (terrain.type.is_power_source) {
                this.power_sources.push(terrain);
            }

            let wire_directions = terrain.wire_directions;
            if (! wire_directions && ! terrain.wire_tunnel_directions) {
                // No wires, not interesting...  unless it's a logic gate, which defines its own
                // wires!  We only care about outgoing ones here, on the off chance that they point
                // directly into a non-wired tile, in which case a wire scan won't find them
                if (terrain.type.name === 'logic_gate') {
                    let dir = terrain.direction;
                    let cxns = terrain.type._gate_types[terrain.gate_type];
                    for (let i = 0; i < 4; i++) {
                        let cxn = cxns[i];
                        if (cxn && cxn.match(/^out/)) {
                            wire_directions |= DIRECTIONS[dir].bit;
                        }
                        dir = DIRECTIONS[dir].right;
                    }
                }
                else {
                    continue;
                }
            }

            for (let [direction, dirinfo] of Object.entries(DIRECTIONS)) {
                if (! ((wire_directions | terrain.wire_tunnel_directions) & dirinfo.bit))
                    continue;

                if (terrain.circuits && terrain.circuits[dirinfo.index])
                    continue;

                let circuit = {
                    is_powered: false,
                    tiles: new Map,
                    inputs: new Map,
                };
                this.circuits.push(circuit);
                // At last, a wired cell edge we have not yet handled.  Floodfill from here
                algorithms.trace_floor_circuit(
                    this, terrain.cell, direction,
                    // Wire handling
                    (tile, edges) => {
                        if (! tile.circuits) {
                            tile.circuits = [null, null, null, null];
                        }
                        for (let [direction, dirinfo] of Object.entries(DIRECTIONS)) {
                            if (edges & dirinfo.bit) {
                                tile.circuits[dirinfo.index] = circuit;
                            }
                        }
                        add_to_edge_map(circuit.tiles, tile, edges);

                        if (tile.type.is_power_source) {
                            // TODO could just do this in a pass afterwards
                            add_to_edge_map(circuit.inputs, tile, edges);
                        }
                    },
                    // Dead end handling (potentially logic gates, etc.)
                    (cell, edge) => {
                        for (let tile of cell) {
                            if (tile.type.name === 'logic_gate') {
                                // Logic gates are the one non-wired tile that get attached to circuits,
                                // mostly so blue teleporters can follow them
                                if (! tile.circuits) {
                                    tile.circuits = [null, null, null, null];
                                }
                                tile.circuits[DIRECTIONS[edge].index] = circuit;

                                let wire = tile.type._gate_types[tile.gate_type][
                                    (DIRECTIONS[edge].index - DIRECTIONS[tile.direction].index + 4) % 4];
                                if (! wire)
                                    return;
                                add_to_edge_map(circuit.tiles, tile, DIRECTIONS[edge].bit);
                                if (wire.match(/^out/)) {
                                    add_to_edge_map(circuit.inputs, tile, DIRECTIONS[edge].bit);
                                }
                            }
                            else if (tile.type.on_power) {
                                add_to_edge_map(circuit.tiles, tile, DIRECTIONS[edge].bit);
                                wired_outputs.add(tile);
                            }
                        }
                    },
                );
            }
        }
        this.wired_outputs = Array.from(wired_outputs);
        this.wired_outputs.sort((a, b) => this.coords_to_scalar(a.cell.x, a.cell.y) - this.coords_to_scalar(b.cell.x, b.cell.y));

        // Finally, let all tiles do any custom init behavior
        for (let cell of this.linear_cells) {
            for (let tile of cell) {
                if (tile.type.on_ready) {
                    tile.type.on_ready(tile, this);
                }
                if (cell === this.player.cell && tile.type.is_hint) {
                    this.hint_shown = tile.hint_text ?? this.stored_level.hint;
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
        this.finish_tic();
    }

    // FIXME a whole bunch of these comments are gonna be wrong or confusing now
    begin_tic(p1_input) {
        if (this.undo_enabled) {
            // Store some current level state in the undo entry.  (These will often not be modified, but
            // they only take a few bytes each so that's fine.)
            for (let key of [
                    '_rng1', '_rng2', '_blob_modifier', 'force_floor_direction',
                    'tic_counter', 'time_remaining', 'timer_paused',
                    'chips_remaining', 'bonus_points', 'hint_shown', 'state',
                    'remaining_players', 'player',
            ]) {
                this.pending_undo.level_props[key] = this[key];
            }
        }
        this.p1_input = p1_input;
        this.p1_released |= ~p1_input;  // Action keys released since we last checked them
        this.swap_player1 = false;

        this.sfx.set_player_position(this.player.cell);

        if (this.compat.use_lynx_loop) {
            if (this.compat.emulate_60fps) {
                this._begin_tic_lynx60();
            }
            else {
                this._begin_tic_lynx();
            }
        }
        else {
            this._begin_tic_lexy();
        }
    }

    // Only the Lexy-style loop has a notion of "finishing" a tic, since (unlike the Lynx loop) the
    // decision phase happens in the /middle/
    finish_tic() {
        if (this.compat.use_lynx_loop) {
            return;
        }

        this._do_decision_phase();

        // Lexy's separate movement loop
        for (let i = this.actors.length - 1; i >= 0; i--) {
            let actor = this.actors[i];
            if (! actor.cell)
                continue;

            this._do_actor_movement(actor, actor.decision);
        }

        this._do_cleanup_phase();
    }

    // Lexy-style loop, the one I stumbled upon accidentally.  Here, cooldowns happen /first/ as
    // their own phase, then decisions are made, then movement happens.  This approach has several
    // advantages: there's no cooldown on the same tic that movement begins, which lets the renderer
    // interpolate between tics more easily; there's no jitter when pushing a block, as is seen in
    // CC2; and generally more things happen in parallel, which improves the illusion that all the
    // game objects are acting simultaneously.
    _begin_tic_lexy() {
        // CC2 wiring runs every frame, not every tic, so we need to do it three times, but dealing
        // with it is delicate.  We want the result of a button press to draw, but not last longer
        // than intended, so we only want one update between the end of the cooldown pass and the
        // end of the tic.  That means the other two have to go here.  When a level starts, there
        // are only two wiring updates before everything gets its first chance to move, so we skip
        // the very first one here.
        if (this.tic_counter !== 0) {
            this._do_wire_phase();
        }
        this._do_wire_phase();

        // Advance everyone's cooldowns
        // Note that we iterate in reverse order, DESPITE keeping dead actors around with null
        // cells, to match the Lynx and CC2 behavior.  This is actually important in some cases;
        // check out the start of CCLP3 #54, where the gliders will eat the blue key immediately if
        // they act in forward order!  (More subtly, even the decision pass does things like
        // advance the RNG, so for replay compatibility it needs to be in reverse order too.)
        for (let i = this.actors.length - 1; i >= 0; i--) {
            let actor = this.actors[i];
            // Actors with no cell were destroyed
            if (! actor.cell)
                continue;

            this._do_actor_cooldown(actor, 3);
        }

        // Mini extra pass: deal with teleporting separately.  Otherwise, actors may have been in
        // the way of the teleporter but finished moving away during the above loop; this is
        // particularly bad when it happens with a block you're pushing.  (CC2 doesn't need to do
        // this because blocks you're pushing are always a frame ahead of you anyway.)
        for (let i = this.actors.length - 1; i >= 0; i--) {
            let actor = this.actors[i];
            if (! actor.cell)
                continue;

            if (actor.just_stepped_on_teleporter) {
                this.attempt_teleport(actor);
            }
        }

        this._do_wire_phase();
        // TODO should this also happen three times?
        this._do_static_phase();
    }

    // Lynx-style loop: everyone decides, then everyone moves/cools.
    _begin_tic_lynx() {
        this._do_decision_phase();
        this._do_combined_action_phase(3);
        this._do_wire_phase();
        this._do_static_phase();

        this._do_cleanup_phase();
    }

    // Same as above, but split up to run at 60fps, where only every third frame allows for
    // decisions.  This is how CC2 works.
    _begin_tic_lynx60() {
        this._do_decision_phase(true);
        this._do_combined_action_phase(1, true);
        this._do_wire_phase();
        this._do_static_phase();

        this._do_decision_phase(true);
        this._do_combined_action_phase(1, true);
        this._do_wire_phase();
        this._do_static_phase();

        this._do_decision_phase();
        this._do_combined_action_phase(1);
        this._do_wire_phase();
        this._do_static_phase();

        this._do_cleanup_phase();
    }

    // Decision phase: all actors decide on their movement "simultaneously"
    _do_decision_phase(forced_only = false) {
        for (let i = this.actors.length - 1; i >= 0; i--) {
            let actor = this.actors[i];

            // Clear any old decisions ASAP.  Note that this prop is only used internally within a
            // single tic, so it doesn't need to be undoable
            actor.decision = null;

            if (! actor.cell)
                continue;

            if (actor.movement_cooldown > 0)
                continue;

            if (! forced_only && actor.type.on_tic) {
                actor.type.on_tic(actor, this);
                if (! actor.cell)
                    continue;
            }

            if (actor === this.player) {
                this.make_player_decision(actor, this.p1_input, forced_only);
            }
            else {
                this.make_actor_decision(actor, forced_only);
            }
        }

        // This only persists for a single decision phase
        if (! forced_only) {
            this.yellow_tank_decision = null;
        }
    }

    // Lynx's combined action phase: each actor attempts to move, then cools down, in order
    _do_combined_action_phase(cooldown, forced_only = false) {
        for (let i = this.actors.length - 1; i >= 0; i--) {
            let actor = this.actors[i];
            if (! actor.cell)
                continue;

            this._do_actor_movement(actor, actor.decision);
            this._do_actor_cooldown(actor, cooldown);
            if (actor.just_stepped_on_teleporter) {
                this.attempt_teleport(actor);
            }
        }
    }

    // Have an actor attempt to move
    _do_actor_movement(actor, direction) {
        // Check this again, since an earlier pass may have caused us to start moving
        if (actor.movement_cooldown > 0)
            return;

        if (! direction)
            return true;

        // Actor is allowed to move, so do so
        let success = this.attempt_step(actor, direction);

        // CC2 handles bonking for all kinds of sliding here -- bonking on ice causes an immediate
        // turnaround, and bonking on an RFF rolls a new direction and tries again
        // TODO this assumes the slide comes from the terrain, which is always the case atm
        if (! success) {
            let terrain = actor.cell.get_terrain();
            if (terrain && (
                (terrain.type.slide_mode === 'ice' || terrain.type.name === 'force_floor_all') &&
                (actor.slide_mode && ! actor.ignores(terrain.type.name)) ||
                // TODO weird cc2 quirk/bug: ghosts bonk on ice even though they don't slide on it
                // FIXME and if they have cleats, they get stuck instead (?!)
                (actor.type.name === 'ghost' && terrain.type.slide_mode === 'ice')))
            {
                // Turn the actor around (so ice corners bonk correctly), pretend they stepped on
                // the tile again (so RFFs roll again), and try moving again
                this.set_actor_direction(actor, DIRECTIONS[direction].opposite);
                if (terrain.type.on_arrive) {
                    terrain.type.on_arrive(terrain, this, actor);
                }
                success = this.attempt_step(actor, actor.direction);
            }
        }

        // Track whether the player is blocked, both for visual effect and for doppelgangers
        if (actor === this.player && ! success) {
            this.sfx.play_once('blocked');
            this._set_tile_prop(actor, 'is_blocked', true);
        }

        return success;
    }

    _do_actor_cooldown(actor, cooldown = 3) {
        if (actor.movement_cooldown <= 0)
            return;

        if (actor.cooldown_delay_hack) {
            // See the extensive comment in attempt_out_of_turn_step
            actor.cooldown_delay_hack += 1;
            return;
        }

        this._set_tile_prop(actor, 'movement_cooldown', Math.max(0, actor.movement_cooldown - cooldown));

        if (actor.movement_cooldown <= 0) {
            if (actor.type.ttl) {
                // This is an animation that just finished, so destroy it
                this.remove_tile(actor);
                return;
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
                if (actor.is_pulled) {
                    this._set_tile_prop(actor, 'is_pulled', false);
                }
            }
        }
    }

    _do_cleanup_phase() {
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
                this._push_pending_undo(() => this.actors.splice(local_p, 0, actor));
            }
        }
        this.actors.length = p;

        // Possibly switch players
        // FIXME cc2 has very poor interactions between this feature and cloners; come up with some
        // better rules as a default
        if (this.swap_player1) {
            // Reset the set of keys released since last tic
            this.p1_released = 0xff;

            // Iterate backwards over the actor list looking for a viable next player to control
            let i0 = this.actors.indexOf(this.player);
            if (i0 < 0) {
                i0 = 0;
            }
            let i = i0;
            while (true) {
                i -= 1;
                if (i < 0) {
                    i += this.actors.length;
                }
                if (i === i0)
                    break;

                let actor = this.actors[i];
                if (! actor.cell)
                    continue;

                if (actor.type.is_real_player) {
                    this.player = actor;
                    break;
                }
            }
        }

        if (this.remaining_players <= 0) {
            this.win();
        }

        // Advance the clock
        // TODO i suspect cc2 does this at the beginning of the tic, but even if you've won?  if you
        // step on a penalty + exit you win, but you see the clock flicker 1 for a single frame.
        // maybe the win check happens at the start of the frame too?
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

    _extract_player_directions(input) {
        // Extract directions from an input mask
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
        return [dir1, dir2];
    }

    make_player_decision(actor, input, forced_only = false) {
        // Only reset the player's is_pushing between movement, so it lasts for the whole push
        this._set_tile_prop(actor, 'is_pushing', false);
        // This effect only lasts one tic, after which we can move again.  Note that this one has
        // gameplay impact -- doppelgangers use it to know if they should copy your facing direction
        // even if you're not moving
        if (! forced_only) {
            this._set_tile_prop(actor, 'is_blocked', false);
        }

        // If the game has already been won (or lost), don't bother with a move; it'll misalign the
        // player from their actual position and not accomplish anything gameplay-wise.
        // (Note this is only necessary because our update order is inverted from CC2, and because
        // we don't erase the last player when they exit.)
        // TODO might not be good enough if something else tries to step on us later this tic!
        if (this.state !== 'playing' || this.remaining_players <= 0)
            return null;

        // TODO player in a cloner can't move (but player in a trap can still turn)

        let try_direction = (direction, push_mode) => {
            direction = actor.cell.redirect_exit(actor, direction);
            // FIXME if the player steps into a monster cell here, they die instantly!  but only
            // if the cell doesn't block them??
            return this.check_movement(actor, actor.cell, direction, push_mode);
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
        let terrain = actor.cell.get_terrain();
        let may_move = ! forced_only && (
            ! actor.slide_mode ||
            (actor.slide_mode === 'force' && actor.last_move_was_force) ||
            (actor.slide_mode === 'teleport' && actor.cell.get_terrain().type.teleport_allow_override));
        let [dir1, dir2] = this._extract_player_directions(input);

        // Check for special player actions, which can only happen at decision time.  Dropping can
        // only be done when the player is allowed to make a move (i.e. override), but the other two
        // can be done freely while sliding.
        // FIXME cc2 seems to rely on key repeat for this; if you have four bowling balls and hold
        // Q, you'll throw the first, wait a second or so, then release the rest rapid-fire.  absurd
        if (! forced_only) {
            let new_input = input & this.p1_released;
            this.p1_released = 0xff;
            if (new_input & INPUT_BITS.cycle) {
                this.cycle_inventory(this.player);
                this.p1_released &= ~INPUT_BITS.cycle;
            }
            if ((new_input & INPUT_BITS.drop) && may_move) {
                this.drop_item(this.player);
                this.p1_released &= ~INPUT_BITS.drop;
            }
            if ((new_input & INPUT_BITS.swap) && this.remaining_players > 1) {
                // This is delayed until the end of the tic to avoid screwing up anything
                // checking this.player
                this.swap_player1 = true;
                this.p1_released &= ~INPUT_BITS.swap;
            }
        }

        if (actor.slide_mode && ! (may_move && dir1)) {
            // This is a forced move and we're not overriding it, so we're done
            actor.decision = actor.direction;

            if (actor.slide_mode === 'force') {
                this._set_tile_prop(actor, 'last_move_was_force', true);
            }
        }
        else if (dir1 === null || forced_only) {
            // Not attempting to move, so do nothing
        }
        else {
            // At this point, we have exactly 1 or 2 directions, and deciding between them requires
            // checking which ones are blocked.  Note that we do this even if only one direction is
            // requested, meaning that we get to push blocks before anything else has moved!
            let open;
            if (dir2 === null) {
                // Only one direction is held, but for consistency, "check" it anyway
                open = try_direction(dir1, 'push');
                actor.decision = dir1;
            }
            else {
                // We have two directions.  If one of them is our current facing, we prefer that
                // one, UNLESS it's blocked AND the other isn't.
                // Note that if this is an override, then the forced direction is still used to
                // interpret our input!
                if (dir1 === actor.direction || dir2 === actor.direction) {
                    let other_direction = dir1 === actor.direction ? dir2 : dir1;
                    let curr_open = try_direction(actor.direction, 'push');
                    let other_open = try_direction(other_direction, 'push');
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
                    let open1 = try_direction(dir1, 'push');
                    let open2 = try_direction(dir2, 'push');
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
                this._set_tile_prop(actor, 'last_move_was_force', true);
                actor.decision = actor.direction;
            }
            else {
                // Otherwise this is 100% a conscious move so we lose our override power next tic
                // TODO how does this interact with teleports
                this._set_tile_prop(actor, 'last_move_was_force', false);
            }
        }
    }

    make_actor_decision(actor, forced_only = false) {
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
        let terrain = actor.cell.get_terrain();
        if (actor.slide_mode ||
            // TODO weird cc2 quirk/bug: ghosts bonk on ice even though they don't slide on it
            // FIXME and if they have cleats, they get stuck instead (?!)
            (actor.type.name === 'ghost' && terrain.type.slide_mode === 'ice'))
        {
            // Actors can't make voluntary moves while sliding; they just, ah, slide.
            actor.decision = actor.direction;
            return;
        }
        if (forced_only)
            return;
        if (actor.cell.some(tile => tile.type.traps && tile.type.traps(tile, actor))) {
            // An actor in a cloner or a closed trap can't turn
            // TODO because of this, if a tank is trapped when a blue button is pressed, then
            // when released, it will make one move out of the trap and /then/ turn around and
            // go back into the trap.  this is consistent with CC2 but not ms/lynx
            return;
        }
        if (actor.type.decide_movement) {
            direction_preference = actor.type.decide_movement(actor, this);
        }

        // Check which of those directions we *can*, probably, move in
        if (! direction_preference)
            return;
        let all_blocked = true;
        for (let [i, direction] of direction_preference.entries()) {
            if (! direction) {
                // This actor is giving up!  Alas.
                actor.decision = null;
                break;
            }
            if (typeof direction === 'function') {
                // Lazy direction calculation (used for walkers)
                direction = direction();
            }

            direction = actor.cell.redirect_exit(actor, direction);

            if (this.check_movement(actor, actor.cell, direction, 'bump')) {
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

    check_movement(actor, orig_cell, direction, push_mode) {
        let dest_cell = this.get_neighboring_cell(orig_cell, direction);
        return (dest_cell &&
            orig_cell.try_leaving(actor, direction) &&
            dest_cell.try_entering(actor, direction, this, push_mode));
    }

    // Try to move the given actor one tile in the given direction and update their cooldown.
    // Return true if successful.
    attempt_step(actor, direction) {
        // In mid-movement, we can't even change direction!
        if (actor.movement_cooldown > 0)
            return false;

        let redirected_direction = actor.cell.redirect_exit(actor, direction);
        if (direction !== redirected_direction) {
            // Some tiles (ahem, frame blocks) rotate when their attempted direction is redirected
            if (actor.type.on_rotate) {
                let turn = ['right', 'left', 'opposite'].filter(t => {
                    return DIRECTIONS[direction][t] === redirected_direction;
                })[0];
                actor.type.on_rotate(actor, this, turn);
            }

            direction = redirected_direction;
        }
        this.set_actor_direction(actor, direction);

        // Grab speed /first/, in case the movement or on_blocked turns us into an animation
        // immediately (and then we won't have a speed!)
        // FIXME that's a weird case actually since the explosion ends up still moving
        let speed = actor.type.movement_speed;

        let move = DIRECTIONS[direction].movement;
        if (! this.check_movement(actor, actor.cell, direction, 'push')) {
            if (actor.type.on_blocked) {
                actor.type.on_blocked(actor, this, direction);
            }
            return false;
        }

        // We're clear!  Compute our speed and move us
        // FIXME this feels clunky
        let goal_cell = this.get_neighboring_cell(actor.cell, direction);
        let terrain = goal_cell.get_terrain();
        if (actor.has_item('speed_boots')) {
            speed /= 2;
        }
        else if (terrain && terrain.type.speed_factor && ! actor.ignores(terrain.type.name)) {
            speed /= terrain.type.speed_factor;
        }

        let orig_cell = actor.cell;
        this._set_tile_prop(actor, 'previous_cell', orig_cell);
        this._set_tile_prop(actor, 'movement_cooldown', speed * 3);
        this._set_tile_prop(actor, 'movement_speed', speed * 3);
        this.move_to(actor, goal_cell, speed);

        // If we have the hook, pull anything behind us, now that we're out of the way
        if (actor.has_item('hook')) {
            let behind_cell = this.get_neighboring_cell(orig_cell, DIRECTIONS[direction].opposite);
            if (behind_cell) {
                let behind_actor = behind_cell.get_actor();
                if (behind_actor && ! behind_actor.movement_cooldown &&
                    actor.can_push(behind_actor, direction))
                {
                    this._set_tile_prop(behind_actor, 'is_pulled', true);
                    this.attempt_out_of_turn_step(behind_actor, direction);
                }
                // TODO this feels like it might be too late, because hook slapping is a thing, but
                // when this code was in check_movement, it allowed pulling blocks through a swivel
                // but prevented pulling blocks with a helmet.  how on earth does slapping work??
            }
        }

        return true;
    }

    attempt_out_of_turn_step(actor, direction) {
        if (this.compat.use_lynx_loop) {
            let success = this._do_actor_movement(actor, direction);
            this._do_actor_cooldown(actor, this.compat.emulate_60fps ? 1 : 3);
            return success;
        }

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
            // FIXME this could go in on_approach now
            if (actor === this.player && tile.type.is_hint) {
                this.hint_shown = tile.hint_text ?? this.stored_level.hint;
            }
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

            // Possibly kill a player
            if (actor.has_item('helmet') || tile.has_item('helmet')) {
                // Helmet disables this, do nothing
            }
            else if (actor.type.is_real_player && tile.type.is_monster) {
                this.fail(tile.type.name);
            }
            else if (actor.type.is_monster && tile.type.is_real_player) {
                this.fail(actor.type.name);
            }
            else if (actor.type.is_block && tile.type.is_real_player && ! actor.is_pulled) {
                // Note that blocks squish players if they move for ANY reason, even if pushed by
                // another player!  The only exception is being pulled
                this.fail('squished');
            }

            if (tile.type.on_approach) {
                tile.type.on_approach(tile, this, actor);
            }
        }

        // If we're a monster stepping on the player's tail, that also kills her immediately; the
        // player and a monster must be strictly more than 4 tics apart
        // FIXME this only works for the /current/ player but presumably applies to all of them,
        // though i'm having trouble coming up with a test
        // TODO the rules in lynx might be slightly different?
        if (actor.type.is_monster && goal_cell === this.player.previous_cell &&
            // Player has decided to leave their cell, but hasn't actually taken a step yet
            this.player.movement_cooldown === this.player.movement_speed &&
            ! actor.has_item('helmet') && ! this.player.has_item('helmet') &&
            // See the extensive comment in attempt_out_of_turn_step
            this.player.cooldown_delay_hack !== 2)
        {
            this.fail(actor.type.name);
        }

        if (this.compat.tiles_react_instantly) {
            this.step_on_cell(actor, actor.cell);
        }
    }

    // Step on every tile in a cell we just arrived in
    step_on_cell(actor, cell) {
        // Also reset slide here, since slide mode is differently important for forced moves
        this.make_slide(actor, null);

        // Step on topmost things first -- notably, it's safe to step on water with flippers on top
        for (let tile of Array.from(cell).reverse()) {
            if (tile === actor)
                continue;
            if (actor.ignores(tile.type.name))
                continue;

            if (tile.type.is_item &&
                // FIXME implement item priority i'm begging you
                ((actor.type.has_inventory && ! (tile.type.name === 'key_red' && ! actor.type.is_player)) ||
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
            if (tile.type.slide_mode) {
                this.make_slide(actor, tile.type.slide_mode);
            }
        }
    }

    attempt_teleport(actor) {
        let teleporter = actor.just_stepped_on_teleporter;
        delete actor.just_stepped_on_teleporter;

        let original_direction = actor.direction;
        let success = false;
        let dest, direction;
        for ([dest, direction] of teleporter.type.teleport_dest_order(teleporter, this, actor)) {
            // Teleporters already containing an actor are blocked and unusable
            // FIXME should check collision?
            if (dest.cell.some(tile => tile.type.is_actor && tile !== actor))
                continue;

            // XXX lynx treats this as a slide and does it in a pass in the main loop

            // FIXME bleugh hardcode
            if (dest === teleporter && teleporter.type.name === 'teleport_yellow') {
                break;
            }
            // Note that this uses 'bump' even for players; it would be very bad if we could
            // initiate movement in this pass (in Lexy rules, anyway), because we might try to push
            // something that's still waiting to teleport itself!
            // XXX is this correct?  it does mean you won't try to teleport to a teleporter that's
            // "blocked" by a block that won't be there anyway by the time you try to move, but that
            // seems very obscure and i haven't run into a case with it yet.  offhand i don't think
            // it can even come up under cc2 rules, since teleporting is done after an actor cools
            // down and before the next actor even gets a chance to act
            if (this.check_movement(actor, dest.cell, direction, 'bump')) {
                success = true;
                // Sound plays from the origin cell simply because that's where the sfx player
                // thinks the player is currently; position isn't updated til next turn
                this.sfx.play_once('teleport', teleporter.cell);
                break;
            }
        }

        if (success) {
            this.set_actor_direction(actor, direction);
            this.make_slide(actor, 'teleport');

            // Now physically move the actor, but their movement waits until next decision phase
            this.remove_tile(actor);
            this.add_tile(actor, dest.cell);
        }
        else {
            // Be sure to remove the slide_mode or they'll be stuck forever
            // TODO: in cc2, if you're on a /disabled/ red teleporter, you'll continue to be pushed
            // in this direction??  is this a bug, is this the only such case?
            if (! (teleporter.type.name === 'teleport_red' && ! teleporter.type._is_active(teleporter, this))) {
                this.make_slide(actor, null);
            }

            if (actor.type.has_inventory && teleporter.type.name === 'teleport_yellow') {
                // Super duper special yellow teleporter behavior: you pick it the fuck up
                // FIXME not if there's only one in the level?
                this.attempt_take(actor, teleporter);
                if (actor === this.player) {
                    this.sfx.play_once('get-tool', teleporter.cell);
                }
            }
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
            this._push_pending_undo(() => actor.toolbelt.unshift(actor.toolbelt.pop()));
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
                this.add_tile(tile, actor.cell);
                if (type.is_actor) {
                    this.add_actor(tile);
                    this.attempt_out_of_turn_step(tile, actor.direction);
                }
            }

            actor.toolbelt.shift();
            this._push_pending_undo(() => actor.toolbelt.unshift(name));
        }
    }

    _do_wire_phase() {
        if (this.circuits.length === 0)
            return;

        // Prepare a big slab of undo.  The only thing we directly change here (aside from
        // emitting_edges, a normal tile property) is Tile.powered_edges, which tends to change for
        // large numbers of tiles at a time, so store it all in one map and undo it in one shot.
        let powered_edges_changes = new Map;
        let _set_edges = (tile, new_edges) => {
            if (this.undo_enabled) {
                if (powered_edges_changes.has(tile)) {
                    if (powered_edges_changes.get(tile) === new_edges) {
                        powered_edges_changes.delete(tile);
                    }
                }
                else {
                    powered_edges_changes.set(tile, tile.powered_edges);
                }
            }
            tile.powered_edges = new_edges;
        };
        let power_edges = (tile, edges) => {
            let new_edges = tile.powered_edges | edges;
            _set_edges(tile, new_edges);
        };
        let depower_edges = (tile, edges) => {
            let new_edges = tile.powered_edges & ~edges;
            _set_edges(tile, new_edges);
        };

        // Update the state of any tiles that can generate power.  If none of them changed since
        // last wiring update, stop here.  First, static power sources.
        let any_changed = false;
        for (let tile of this.power_sources) {
            if (! tile.cell)
                continue;
            let emitting = tile.type.get_emitting_edges(tile, this);
            if (emitting !== tile.emitting_edges) {
                any_changed = true;
                this._set_tile_prop(tile, 'emitting_edges', emitting);
            }
        }
        // Next, actors who are standing still, on floor, and holding a lightning bolt
        let externally_powered_circuits = new Set;
        for (let actor of this.actors) {
            if (! actor.cell)
                continue;
            let emitting = 0;
            if (actor.movement_cooldown === 0 && actor.has_item('lightning_bolt')) {
                let wired_tile = actor.cell.get_wired_tile();
                if (wired_tile && (wired_tile === actor || wired_tile.type.name === 'floor')) {
                    emitting = wired_tile.wire_directions;
                    for (let circuit of wired_tile.circuits) {
                        if (circuit) {
                            externally_powered_circuits.add(circuit);
                        }
                    }
                }
            }
            if (emitting !== actor.emitting_edges) {
                any_changed = true;
                this._set_tile_prop(actor, 'emitting_edges', emitting);
            }
        }

        if (! any_changed)
            return;

        for (let tile of this.wired_outputs) {
            // This is only used within this function, no need to undo
            // TODO if this can overlap with power_sources then this is too late?
            tile._prev_powered_edges = tile.powered_edges;
        }

        // Now go through every circuit, compute whether it's powered, and if that changed, inform
        // its outputs
        let circuit_changes = new Map;
        for (let circuit of this.circuits) {
            let is_powered = false;

            if (externally_powered_circuits.has(circuit)) {
                is_powered = true;
            }
            else {
                for (let [input_tile, edges] of circuit.inputs.entries()) {
                    if (input_tile.emitting_edges & edges) {
                        is_powered = true;
                        break;
                    }
                }
            }

            let was_powered = circuit.is_powered;
            if (is_powered === was_powered)
                continue;

            circuit.is_powered = is_powered;
            if (this.undo_enabled) {
                circuit_changes.set(circuit, was_powered);
            }

            for (let [tile, edges] of circuit.tiles.entries()) {
                if (is_powered) {
                    power_edges(tile, edges);
                }
                else {
                    depower_edges(tile, edges);
                }
            }
        }

        for (let tile of this.wired_outputs) {
            if (tile.powered_edges && ! tile._prev_powered_edges && tile.type.on_power) {
                tile.type.on_power(tile, this);
            }
            else if (! tile.powered_edges && tile._prev_powered_edges && tile.type.on_depower) {
                tile.type.on_depower(tile, this);
            }
        }

        this._push_pending_undo(() => {
            for (let [tile, edges] of powered_edges_changes.entries()) {
                tile.powered_edges = edges;
            }
            for (let [circuit, is_powered] of circuit_changes.entries()) {
                circuit.is_powered = is_powered;
            }
        });
    }

    // Some non-actor tiles still want to act every tic.  Note that this should happen AFTER wiring.
    _do_static_phase() {
        for (let tile of this.static_on_tic_tiles) {
            tile.type.on_tic(tile, this);
        }
    }

    // -------------------------------------------------------------------------
    // Board inspection

    get_neighboring_cell(cell, direction) {
        let move = DIRECTIONS[direction].movement;
        let goal_x = cell.x + move[0];
        let goal_y = cell.y + move[1];
        return this.cell(cell.x + move[0], cell.y + move[1]);
    }

    // Iterates over the grid in (reverse?) reading order and yields all tiles with the given name.
    // The starting cell is iterated last.
    *iter_tiles_in_reading_order(start_cell, name, reverse = false) {
        let i = this.coords_to_scalar(start_cell.x, start_cell.y);
        while (true) {
            if (reverse) {
                i -= 1;
                if (i < 0) {
                    i += this.size_x * this.size_y;
                }
            }
            else {
                i += 1;
                i %= this.size_x * this.size_y;
            }

            let cell = this.linear_cells[i];
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
        let max_search_radius = Math.max(this.size_x, this.size_y) + 1;
        for (let dist = 1; dist <= max_search_radius; dist++) {
            // Start east and move counterclockwise
            let sx = start_cell.x + dist;
            let sy = start_cell.y;
            for (let direction of [[-1, -1], [-1, 1], [1, 1], [1, -1]]) {
                for (let i = 0; i < dist; i++) {
                    let cell = this.cell(sx, sy);
                    if (cell) {
                        yield cell;
                    }
                    sx += direction[0];
                    sy += direction[1];
                }
            }
        }
    }

    // FIXME require_stub should really just care whether we ourselves /can/ contain wire, and also
    // we should check that on our neighbor
    is_tile_wired(tile, require_stub = true) {
        for (let [direction, dirinfo] of Object.entries(DIRECTIONS)) {
            if (require_stub && (tile.wire_directions & dirinfo.bit) === 0)
                continue;

            let neighbor = this.get_neighboring_cell(tile.cell, direction);
            if (! neighbor)
                continue;

            let wired = neighbor.get_wired_tile();
            if (! wired)
                continue;

            if (wired.type.wire_propagation_mode === 'none' && ! wired.type.is_power_source)
                // Being next to e.g. a red teleporter doesn't count (but pink button is ok)
                continue;

            if (wired.wire_directions & dirinfo.opposite_bit)
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
        if (! this.undo_enabled) {
            return;
        }
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

    _push_pending_undo(thunk) {
        if (this.undo_enabled) {
            this.pending_undo.push(thunk)
        }
    }

    // -------------------------------------------------------------------------
    // Level alteration methods.  EVERYTHING that changes the state of a level,
    // including the state of a single tile, should do it through one of these
    // for undo/rewind purposes

    _set_tile_prop(tile, key, val) {
        if (! this.undo_enabled) {
            tile[key] = val;
            return;
        }
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

        this._push_pending_undo(() => {
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
        this._push_pending_undo(() => cell._add(tile, index));
    }

    add_tile(tile, cell, index = null) {
        cell._add(tile, index);
        this._push_pending_undo(() => cell._remove(tile));
    }

    add_actor(actor) {
        this.actors.push(actor);
        this._push_pending_undo(() => this.actors.pop());
    }

    spawn_animation(cell, name) {
        let type = TILE_TYPES[name];
        let tile = new Tile(type);
        // Co-opt movement_cooldown/speed for these despite that they aren't moving, since those
        // properties are also used to animate everything else anyway.  Decrement the cooldown
        // immediately, as Lynx does; note that Lynx also ticks /and destroys/ animations early in
        // the decision phase, but this seems to work out just as well
        this._set_tile_prop(tile, 'movement_speed', tile.type.ttl);
        this._set_tile_prop(tile, 'movement_cooldown', tile.type.ttl - 1);
        cell._add(tile);
        this.actors.push(tile);
        this._push_pending_undo(() => {
            this.actors.pop();
            cell._remove(tile);
        });
    }

    transmute_tile(tile, name) {
        let current = tile.type.name;
        this._push_pending_undo(() => tile.type = TILE_TYPES[current]);
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
            this._push_pending_undo(() => actor.keyring[name] -= 1);
        }
        else {
            // tool, presumably
            if (! actor.toolbelt) {
                actor.toolbelt = [];
            }
            actor.toolbelt.push(name);
            this._push_pending_undo(() => actor.toolbelt.pop());

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

            this._push_pending_undo(() => actor.keyring[name] += 1);
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
                this._push_pending_undo(() => actor.toolbelt.splice(index, 0, name));
                return true;
            }
        }

        return false;
    }

    take_all_keys_from_actor(actor) {
        if (actor.keyring && Object.values(actor.keyring).some(n => n > 0)) {
            let keyring = actor.keyring;
            this._push_pending_undo(() => actor.keyring = keyring);
            actor.keyring = {};
            return true;
        }
    }

    take_all_tools_from_actor(actor) {
        if (actor.toolbelt && actor.toolbelt.length > 0) {
            let toolbelt = actor.toolbelt;
            this._push_pending_undo(() => actor.toolbelt = toolbelt);
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
