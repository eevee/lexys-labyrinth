import * as algorithms from './algorithms.js';
import { ACTOR_TRAITS, DIRECTIONS, DIRECTION_ORDER, LAYERS, INPUT_BITS, PICKUP_PRIORITIES, TICS_PER_SECOND } from './defs.js';
import { LevelInterface } from './format-base.js';
import TILE_TYPES from './tiletypes.js';

export class Tile {
    constructor(type, direction = 'south') {
        this.type = type;
        if (type.is_actor) {
            this.direction = direction;
            this.traits = this.compute_traits();
        }
        this.cell = null;

        // Pre-seed actors who are expected to have inventories, with one
        // TODO do i need this at all?
        if (type.item_pickup_priority <= PICKUP_PRIORITIES.normal) {
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

    compute_traits() {
        let traits = this.type.innate_traits ?? 0;
        if (this.toolbelt) {
            for (let tool_name of this.toolbelt) {
                traits |= (TILE_TYPES[tool_name].item_traits ?? 0);
            }
        }
        return traits;
    }

    movement_progress(update_progress, update_rate) {
        return (this.movement_speed - this.movement_cooldown + update_rate * (update_progress - 1)) / this.movement_speed;
    }

    // Gives the effective position of an actor in motion, given smooth scrolling
    visual_position(update_progress = 0, update_rate = 0) {
        if (! this.previous_cell || this.movement_speed === null || this.moves_instantly) {
            return [this.cell.x, this.cell.y];
        }

        let cell = this.destination_cell ?? this.cell;
        // For a movement speed of N, the cooldown is set to N - R at the end of the frame/tic an
        // actor starts moving, and we interpolate it from N to that
        let p = this.movement_progress(update_progress, update_rate);
        return [
            (1 - p) * this.previous_cell.x + p * cell.x,
            (1 - p) * this.previous_cell.y + p * cell.y,
        ];
    }

    // TODO don't love that the arg order is different here vs tile type, but also don't love that
    // the name is the same?
    blocks(other, direction, level) {
        // This can happen occasionally, like when testing teleports, where the actor's movement is
        // being tested from a cell it's not actually in
        if (this === other)
            return false;

        // Special case: item layer collision is ignored if the cell has an item mod
        if (this.type.layer === LAYERS.item && this.cell.get_item_mod())
            return false;

        // Extremely niche interaction: monsters can enter cells with items by killing a player
        // who's revived by an ankh
        if (this.type.is_item && other.temp_ignore_item_collision)
            return false;

        if (level.compat.monsters_ignore_keys && this.type.is_key)
            // MS: Monsters are never blocked by keys
            return false;

        // Special override
        if (other.type.blocked_by) {
            let blocked = other.type.blocked_by(other, level, this);
            if (blocked !== undefined) {
                return blocked;
            }
        }

        // Normal collision check
        if (this.type.blocks_collision & other.type.collision_mask)
            return true;

        // Blocks being pulled are blocked by their pullers (which are, presumably, the only things
        // they can be moving towards)
        if (this.type.is_actor && other.type.is_block && other.is_pulled)
            return true;

        // FIXME get this out of here
        if (this.type.thin_walls &&
            this.type.thin_walls.has(DIRECTIONS[direction].opposite) &&
            other.type.name !== 'ghost')
            return true;

        if (this.type.blocks && this.type.blocks(this, level, other, direction))
            return true;

        return false;
    }

    can_push(tile, direction, level) {
        // This tile already has a push queued, sorry
        if (tile.pending_push && ! level.compat.allow_repushing_blocks)
            return false;

        if (! (this.type.pushes && this.type.pushes[tile.type.name] &&
            (! tile.type.allows_push || tile.type.allows_push(tile, direction))))
        {
            return false;
        }

        // CC2 quirk about stuck sliding blocks:
        // - The player CAN push a sliding block, whether it's stuck or tic-aligned or not
        // - A rover CAN push a sliding block, whether it's stuck or tic-aligned or not
        // - A block CANNOT push a sliding ice/frame block, whether it's stuck or tic-aligned or not
        //   ...EXCEPT that a frame block CAN push a sliding dirt block.
        if (this.type.is_block && tile.current_slide_mode &&
            ! (this.type.name === 'frame_block' && tile.type.name === 'dirt_block'))
        {
            return false;
        }

        // Trapped blocks can't be pushed
        let terrain = tile.cell.get_terrain();
        if (terrain.type.traps && terrain.type.traps(terrain, level, tile) &&
            // Lynx: Blocks literally in traps /can/ be pushed, and it changes their direction
            ! (level.compat.traps_like_lynx && terrain.type.name === 'trap'))
        {
            return false;
        }

        return true;
    }

    can_pull(tile, direction) {
        // FIXME starting to think fx should not count as actors
        if (tile.type.ttl)
            return false;

        // FIXME i don't actually know the precise rules here.  dirt blocks and ghosts can pull
        // other blocks even though they can't usually push them.  given the existence of monster
        // hooking, i suspect /anything/ can be hooked but on monsters it has a weird effect?
        // figure this out?
        return (! tile.type.allows_push || tile.type.allows_push(tile, direction));
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

    // Custom console.log output for the bulk tester (i.e. node), where a full dump of a tile is not
    // especially useful
    [Symbol.for('nodejs.util.inspect.custom')](_depth, _options, _inspect) {
        let where = this.cell ? `(${this.cell.x}, ${this.cell.y})` : "nowhere";
        return `Tile{${this.type.name} at ${where}}`;
    }
}
Object.assign(Tile.prototype, {
    // Wire stuff, to avoid a lot of boring checks in circuit code
    emitting_edges: 0,
    powered_edges: 0,
    wire_directions: 0,
    wire_tunnel_directions: 0,
    // Actor defaults
    traits: 0,  // bitmask of flags in ACTOR_TRAITS
    movement_cooldown: 0,
    movement_speed: null,
    previous_cell: null,
    // Indicates the actor's next decision is a compulsory slide of this type
    pending_slide_mode: null,
    current_slide_mode: null,  // if our current move is the result of an actual slide
    can_override_force_floor: false,
    is_blocked: false,
    is_pushing: false,
    pending_push: null,
    destination_cell: null,
    // Weird edge cases
    is_making_failure_move: false,
    temp_ignore_item_collision: false,
    is_detached: false,
});


export class Cell extends Array {
    constructor(x, y) {
        super(LAYERS.MAX);
        this.x = x;
        this.y = y;
    }

    _add(tile) {
        let index = tile.type.layer;
        if (this[index]) {
            if (index !== LAYERS.vfx) {
                console.error("ATTEMPTING TO ADD", tile, "TO CELL", this, "WHICH ERASES EXISTING TILE", this[index]);
            }
        }
        this[index] = tile;
    }

    // DO NOT use me to remove a tile permanently, only to move it!
    // Should only be called from Level, which handles some bookkeeping!
    _remove(tile) {
        let index = tile.type.layer;
        if (this[index] !== tile) {
            console.error("Asked to remove tile that doesn't seem to exist:", tile, "(actually found:)", this[index]);
        }

        this[index] = null;
    }

    get_wired_tile() {
        let ret = null;
        for (let tile of this) {
            if (tile && (tile.wire_directions || tile.wire_tunnel_directions) && ! tile.movement_cooldown) {
                ret = tile;
                // Don't break; we want the topmost tile!
            }
        }
        return ret;
    }

    get_terrain() {
        return this[LAYERS.terrain] ?? null;
    }

    get_actor() {
        return this[LAYERS.actor] ?? null;
    }

    get_item() {
        return this[LAYERS.item] ?? null;
    }

    get_item_mod() {
        return this[LAYERS.item_mod] ?? null;
    }

    // XXX whoa i should either use this way more or way less
    has(name) {
        let current = this[TILE_TYPES[name].layer];
        return current && current.type.name === name;
    }
}


class UndoEntry {
    constructor() {
        this.tile_changes = new Map;
        this.sokoban_changes = null;
        this.level_props = {};
        this.actor_splices = [];
        this.toggle_green_tiles = false;
        this.circuit_power_changes = null;
    }

    tile_changes_for(tile) {
        let changes = this.tile_changes.get(tile);
        if (! changes) {
            changes = {};
            this.tile_changes.set(tile, changes);
        }
        return changes;
    }

    preserve_sokoban(color, count) {
        if (! this.sokoban_changes) {
            this.sokoban_changes = {};
        }
        if (! (color in this.sokoban_changes)) {
            this.sokoban_changes[color] = count;
        }
    }

    estimate_size() {
        // Based VERY roughly on Chromium's measurements; tends to overestimate by ~5%
        let size = 112;  // base size of an entry
        size += 16 * Object.keys(this.level_props).length;
        for (let [_, changes] of this.tile_changes) {
            size += 64 + 32 * Object.entries(changes).length;
        }
        size += 96 + 32 * this.actor_splices.length;

        if (this.circuit_power_changes) {
            size += 24 * this.circuit_power_changes.size;
        }

        this.size = size;
        return size;
    }
}

class UndoBuffer {
    constructor(min_count, max_size) {
        this.min_count = min_count;
        this.max_size = max_size;
        // Number of blank entries to add when the buffer is full
        this.chunk_size = TICS_PER_SECOND * 5;

        this.entries = new Array(this.min_count);
        this.entries.fill(null);

        this.approx_size = 0;
        // Index where a new entry should be written
        this.head = 0;
        // Index of the oldest entry; if this points to null, there are no entries
        this.tail = 0;
    }

    get num_entries() {
        let n = (this.head - this.tail + this.entries.length) % this.entries.length;
        if (n === 0 && ! this.is_empty) {
            n += this.entries.length;
        }
        return n;
    }

    get is_empty() {
        return this.entries[this.tail] === null;
    }

    forget_oldest() {
        if (! this.entries[this.tail])
            return;

        this.approx_size -= this.entries[this.tail].size;
        this.entries[this.tail] = null;
        this.tail = (this.tail + 1) % this.entries.length;
    }

    push(entry) {
        this.approx_size += entry.size;
        // (This uses >= because the approx size counts the new entry, but the count doesn't)
        while (this.approx_size > this.max_size && this.num_entries >= this.min_count) {
            this.forget_oldest();
        }

        if (this.head >= this.entries.length && this.entries[0] === null) {
            this.head = 0;
        }
        if (this.head >= this.entries.length || this.entries[this.head]) {
            // The head is already occupied (which means it should be the tail), or it's aiming past
            // the end; either way, splice in some extra space
            let space = new Array(this.chunk_size);
            space.fill(null);
            this.entries.splice(this.head, 0, ...space);
            if (this.tail >= this.head) {
                this.tail += this.chunk_size;
            }
        }
        this.entries[this.head] = entry;

        // If we go off the end of the array, let the head point there for now, and decide whether
        // to wrap later
        this.head += 1;
    }

    pop() {
        this.head = (this.head - 1 + this.entries.length) % this.entries.length;
        let entry = this.entries[this.head];
        this.approx_size -= entry.size;
        this.entries[this.head] = null;
        return entry;
    }
}


// The CC1 inventory has a fixed boot order
const CC1_INVENTORY_ORDER = ['cleats', 'suction_boots', 'fire_boots', 'flippers'];
export class Level extends LevelInterface {
    constructor(stored_level, compat = {}, patches = null) {
        super();
        this.stored_level = stored_level;
        this.restart(compat, patches);
    }

    get update_rate() {
        if (this.compat.emulate_60fps) {
            return 1;
        }
        else {
            return 3;
        }
    }

    // Level setup ------------------------------------------------------------------------------------

    restart(compat, patches) {
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
        this.chips_remaining = this.stored_level.chips_required ?? 0;
        this.bonus_points = 0;
        this.aid = 0;

        // Time
        this.done_on_begin = false;
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
        // 0 to 2, counting which frame within a tic we're on in CC2
        this.frame_offset = 0;
        // 0 to 7, indicating the first tic that teeth can move on.
        // 0 is equivalent to even step; 4 is equivalent to odd step.
        // 5 is the default in CC2.  Lynx can use any of the 8.  MSCC uses
        // either 0 or 4, and defaults to 0, but which you get depends on the
        // global clock which doesn't get reset between levels (!).
        this.step_parity = 5;

        // TODO in lynx/steam, this carries over between levels; in tile world, you can set it manually
        this.force_floor_direction = 'north';
        // PRNG is initialized to zero
        this._rng1 = 0;
        this._rng2 = 0;
        this._tw_rng = Math.floor(Math.random() * 0x80000000);
        if (this.stored_level.blob_behavior === 0) {
            this._blob_modifier = 0x55;
        }
        else {
            // The other two modes are initialized to a random seed
            this._blob_modifier = Math.floor(Math.random() * 256);
        }

        // The undo stack is implemented with a variable-size ring buffer, one entry per tic.
        // It lasts at least 30 seconds, but tries not to exceed 10 MB
        this.undo_buffer = new UndoBuffer(TICS_PER_SECOND * 30, 10_000_000);
        this.pending_undo = new UndoEntry;
        // If undo_enabled is false, we won't create any undo entries.  Undo is only disabled during
        // bulk testing, where a) no one will ever undo and b) the overhead is significant.
        this.undo_enabled = true;

        // Order in which actors try to collide with tiles.
        // Subtleties ahoy!  This is **EXTREMELY** sensitive to ordering.  Consider:
        // - An actor with foil MUST NOT bump a wall on the other side of a thin wall.
        // - A ghost with foil MUST bump a wall (even on the other side of a thin wall) and be
        //   deflected by the resulting steel.
        // - An actor with foil MUST NOT bump a wall under a "no foil" sign.
        // - A bowling ball MUST NOT destroy an actor on the other side of a thin wall, or on top of
        //   a regular wall.
        // - A fireball MUST melt an ice block AND ALSO still be deflected by it, even if the ice
        //   block is on top of an item (which blocks the fireball), but NOT one on the other side
        //   of a thin wall.
        // - A rover MUST NOT bump walls underneath a canopy (which blocks it).
        // It seems the order is thus: canopy + thin wall + item mod (indistinguishable); terrain;
        // actor; item.  In other words, some physically logical sense of "outer" to "inner".
        // (In Lynx, however, everything was on the same layer, so actors must come last.)
        this.layer_collision_order = [
            LAYERS.canopy, LAYERS.thin_wall, LAYERS.item_mod, LAYERS.terrain, LAYERS.swivel];
        if (this.compat.player_protected_by_items) {
            this.layer_collision_order.push(LAYERS.item, LAYERS.actor);
        }
        else {
            this.layer_collision_order.push(LAYERS.actor, LAYERS.item);
        }

        let n = 0;
        if (this.compat.no_auto_patches) {
            patches = null;
        }
        let connectables = [];
        this.power_sources = [];
        this.remaining_players = 0;
        this.ankh_tile = null;
        // If there's exactly one yellow teleporter when the level loads, it cannot be picked up
        let yellow_teleporter_count = 0;
        this.allow_taking_yellow_teleporters = false;
        // Sokoban buttons function as a group
        this.sokoban_unpressed = { red: 0, blue: 0, yellow: 0, green: 0 };
        this.sokoban_satisfied = { red: true, blue: true, yellow: true, green: true };
        for (let y = 0; y < this.height; y++) {
            let row = [];
            for (let x = 0; x < this.width; x++) {
                let cell = new Cell(x, y);
                row.push(cell);
                this.linear_cells.push(cell);

                let stored_cell = this.stored_level.linear_cells[n];
                if (patches && patches.has(n)) {
                    stored_cell = patches.get(n);
                }
                n += 1;
                for (let template_tile of stored_cell) {
                    if (! template_tile)
                        continue;

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
                    if (tile.type.is_required_chip && this.stored_level.chips_required === null) {
                        this.chips_remaining += 1;
                    }
                    if (tile.type.is_actor) {
                        this.actors.push(tile);
                        if (this.compat.actors_move_instantly) {
                            tile.moves_instantly = true;
                        }
                    }
                    cell._add(tile);
                    tile.cell = cell;

                    if (tile.type.connects_to) {
                        connectables.push(tile);
                    }

                    if (tile.type.update_power_emission) {
                        this.power_sources.push(tile);
                    }

                    if (tile.type.name === 'teleport_yellow' && ! this.allow_taking_yellow_teleporters) {
                        yellow_teleporter_count += 1;
                        if (yellow_teleporter_count > 1) {
                            this.allow_taking_yellow_teleporters = true;
                        }
                    }
                    else if (tile.type.name === 'sokoban_button') {
                        this.sokoban_unpressed[tile.color] += 1;
                        this.sokoban_satisfied[tile.color] = false;
                    }
                }
            }
        }
        if (this.compat.player_moves_last) {
            let i = this.actors.indexOf(this.player);
            if (i > 0) {
                [this.actors[0], this.actors[i]] = [this.actors[i], this.actors[0]];
            }
        }
        // TODO complain if no player
        // Used for doppelgängers
        this.player1_move = null;
        this.player2_move = null;

        // Connect buttons and teleporters
        for (let connectable of connectables) {
            this.connect_button(connectable);
        }

        // Let all tiles do custom init behavior...  but backwards, to match actor order
        for (let i = this.linear_cells.length - 1; i >= 0; i--) {
            let cell = this.linear_cells[i];
            for (let tile of cell) {
                if (! tile)
                    continue;
                if (tile.type.on_ready) {
                    tile.type.on_ready(tile, this);
                }
            }
        }
        // Erase undo, in case any on_ready added to it (we don't want to undo initialization!)
        this.pending_undo = new UndoEntry;

        // And finally, build circuits
        this.recalculate_circuitry_next_wire_phase = false;
        this.recalculate_circuitry(true);
    }

    connect_button(connectable) {
        let cell = connectable.cell;
        let x = cell.x;
        let y = cell.y;
        let goals = connectable.type.connects_to;

        // Check for custom wiring, for MSCC .DAT levels
        // TODO would be neat if this applied to orange buttons too
        // TODO RAINBOW TELEPORTER, ARBITRARY TILE TARGET HAHA
        if (this.stored_level.custom_connections.size > 0) {
            let n = this.stored_level.coords_to_scalar(x, y);
            let target_cell_n = this.stored_level.custom_connections.get(n) ?? null;
            if (target_cell_n !== null && target_cell_n < this.width * this.height) {
                let [tx, ty] = this.stored_level.scalar_to_coords(target_cell_n);
                for (let tile of this.cell(tx, ty)) {
                    if (tile && goals.has(tile.type.name)) {
                        connectable.connection = tile;
                        break;
                    }
                }
            }
        }
        if (this.stored_level.only_custom_connections)
            return;

        // Orange buttons do a really weird diamond search
        if (connectable.type.connect_order === 'diamond') {
            for (let [tile, _cell] of algorithms.find_terrain_diamond(this, cell, goals)) {
                connectable.connection = tile;
                break;
            }
            return;
        }

        // Otherwise, look in reading order
        for (let [tile, _cell] of algorithms.find_terrain_linear(this, cell, goals)) {
            // TODO ideally this should be a weak connection somehow, since dynamite can destroy
            // empty cloners and probably traps too
            connectable.connection = tile;
            // Just grab the first
            break;
        }
    }

    recalculate_circuitry(first_time = false) {
        // Build circuits out of connected wires
        // TODO document this idea
        // TODO moving a circuit block should only need to invalidate the circuits it touches

        this.circuits = [];
        let wired_outputs = new Set;
        let seen_edges = new Map;
        for (let cell of this.linear_cells) {
            // We're interested in static circuitry, which means terrain
            // OR circuit blocks on top
            let terrain = cell.get_terrain();
            if (! terrain)  // ?!
                continue;

            let actor = cell.get_actor();
            let wire_directions = terrain.wire_directions;
            if (actor && actor.contains_wire &&
                (actor.movement_cooldown === 0 || this.compat.actors_move_instantly))
            {
                wire_directions = actor.wire_directions;
            }

            if (! wire_directions && ! terrain.wire_tunnel_directions) {
                // No wires, not interesting...  unless it's a logic gate, which defines its own
                // wires!  We only care about outgoing ones here, on the off chance that they point
                // directly into a non-wired tile, in which case a wire scan won't find them
                if (terrain.type.name === 'logic_gate') {
                    let dir = terrain.direction;
                    let cxns = terrain.type._gate_types[terrain.gate_type];
                    if (! cxns) {
                        // Voodoo tile
                        continue;
                    }
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

                if ((seen_edges.get(terrain) ?? 0) & dirinfo.bit)
                    continue;

                // At last, a wired cell edge we have not yet handled.  Floodfill from here
                let circuit = algorithms.trace_floor_circuit(
                    this, this.compat.actors_move_instantly ? 'always' : 'still',
                    terrain.cell, direction,
                );
                this.circuits.push(circuit);

                // Search the circuit for tiles that act as outputs, so we can check whether to
                // update them during each wire phase
                for (let [tile, edges] of circuit.tiles) {
                    seen_edges.set(tile, (seen_edges.get(tile) ?? 0) | edges);
                    if (tile.type.on_power) {
                        wired_outputs.add(tile);
                    }
                }
            }
        }

        // Make an index of cell indices to the circuits they belong to
        this.cells_to_circuits = new Map;
        for (let circuit of this.circuits) {
            // Also, all wires are explicitly off when the level starts
            // TODO what does this mean for recomputing due to circuit blocks?  might we send a
            // pulse despite the wires never visibly turning off??
            if (first_time) {
                circuit.is_powered = false;
            }

            for (let tile of circuit.tiles.keys()) {
                let n = this.cell_to_scalar(tile.cell);
                let set = this.cells_to_circuits.get(n);
                if (! set) {
                    set = new Set;
                    this.cells_to_circuits.set(n, set);
                }
                set.add(circuit);
            }
        }

        this.wired_outputs = Array.from(wired_outputs);
        this.wired_outputs.sort((a, b) => this.coords_to_scalar(b.cell.x, b.cell.y) - this.coords_to_scalar(a.cell.x, a.cell.y));

        if (! first_time) {
            // Update wireables
            for (let i = 0; i < this.width; i++) {
                for (let j = 0; j < this.height; j++) {
                    let terrain = this.cell(i, j).get_terrain();
                    if (terrain.is_wired !== undefined) {
                        // XXX begin?  if it's NOT the first time??
                        terrain.type.on_begin(terrain, this);
                    }
                }
            }
        }
    }

    can_accept_input() {
        // We can accept input anytime the player can move, i.e. when they're not already moving and
        // not in an un-overrideable slide
        if (this.player.movement_cooldown > 0)
            return false;
        if (! this.player.pending_slide_mode)
            return true;
        if (! this.player.can_override_force_floor)
            return false;

        let terrain = this.player.cell.get_terrain();
        if (terrain.type.slide_override_mode)
            return true;
        return false;
    }

    // Randomness -------------------------------------------------------------------------------------

    // Lynx PRNG, used unchanged in CC2
    prng() {
        let n = (this._rng1 >> 2) - this._rng1;
        if (!(this._rng1 & 0x02)) {
            n -= 1;
        }
        this._rng1 = ((this._rng1 >> 1) | (this._rng2 & 0x80)) & 0xff;
        this._rng2 = ((this._rng2 << 1) | (n & 0x01)) & 0xff;
        return this._rng1 ^ this._rng2;
    }

    // Tile World's PRNG, used for blobs in Tile World Lynx
    _advance_tw_prng() {
        this._tw_rng = ((Math.imul(this._tw_rng, 1103515245) & 0x7fffffff) + 12345) & 0x7fffffff;
    }
    tw_prng_random4() {
        this._advance_tw_prng();
        return this._tw_rng >> 29;
    }

    // Weird thing done by CC2 to make blobs...  more...  random
    get_blob_modifier() {
        let mod = this._blob_modifier;

        if (this.stored_level.blob_behavior === 1) {
            // "4 patterns" just increments by 1 every time
            mod = (mod + 1) % 4;
        }
        else {
            // Other modes do this curious operation
            mod *= 2;
            if (mod < 255) {
                mod ^= 0x1d;
            }
            mod &= 0xff;
        }

        this._blob_modifier = mod;
        return mod;
    }

    // Main loop --------------------------------------------------------------------------------------

    // Move the game state forwards by one tic.
    // Input is a bit mask of INPUT_BITS.
    advance_tic(p1_input) {
        if (this.state !== 'playing') {
            console.warn(`Attempting to advance game when state is ${this.state}`);
            return;
        }

        // If someone is mixing tics and frames, run in frames until the end of the tic
        if (this.frame_offset > 0) {
            for (let i = this.frame_offset; i < 3; i++) {
                this.advance_frame(p1_input);
            }
            return;
        }

        this.do_init_phase();
        this._set_p1_input(p1_input);

        if (this.compat.emulate_60fps) {
            this._advance_tic_lynx60();
        }
        else {
            this._advance_tic_lynx();
        }
    }

    // Lynx/Lexy loop: 20 tics per second
    _advance_tic_lynx() {
        // Under CC2 rules, each full tic has two wire phases before the player can move, then one
        // afterwards.  Even at 20 tps, wire should run at the same rate...  but in order to render
        // the latest state of the wire, all the wire phases should happen at the end of the tic.
        // To keep timing the same, the first tic still needs two early wire phases.
        if (this.tic_counter === 0) {
            this.do_wire_phase();
            this.do_wire_phase();
        }

        this.do_decision_phase();
        this.do_action_phase(3);

        // Wire updates every frame, which means thrice per tic
        this.do_wire_phase();
        // This is where the third CC2 frame would normally end
        this.do_wire_phase();
        this.do_wire_phase();

        this.do_cleanup_phase();
    }

    // CC2 loop: similar to the Lynx loop, but run three times per tic, and non-forced decisions can
    // only be made every third frame
    _advance_tic_lynx60() {
        this.do_decision_phase(true);
        this.do_action_phase(1);
        this.do_wire_phase();

        this.frame_offset = 1;
        this.do_decision_phase(true);
        this.do_action_phase(1);
        this.do_wire_phase();

        this.frame_offset = 2;
        this.do_decision_phase();
        this.do_action_phase(1);
        this.do_wire_phase();

        this.frame_offset = 0;
        this.do_cleanup_phase();
    }

    // Attempt to advance by one FRAME at a time.  Primarily useful for running 60 FPS mode at,
    // well, 60 FPS.
    advance_frame(p1_input) {
        if (this.compat.emulate_60fps) {
            // CC2
            if (this.frame_offset === 0) {
                this.do_init_phase(p1_input);
            }
            this._set_p1_input(p1_input);
            let is_decision_frame = this.frame_offset === 2;

            this.do_decision_phase(! is_decision_frame);
            this.do_action_phase(1);
            this.do_wire_phase();

            if (this.frame_offset === 2) {
                this.do_cleanup_phase();
            }
        }
        else {
            // We're running at 20 tps, which means only one update on the first frame
            if (this.frame_offset === 0) {
                this.advance_tic(p1_input);
            }
        }

        this.frame_offset = (this.frame_offset + 1) % 3;
    }

    _set_p1_input(p1_input) {
        this.p1_input = p1_input;
        this.p1_released |= ~p1_input;  // Action keys released since we last checked them
    }

    do_init_phase() {
        // At the beginning of the very first tic, some tiles want to do initialization that's not
        // appropriate to do before the game begins
        // FIXME this was originally added for bomb, which no longer uses it, so, god i would like
        // to get rid of this
        if (! this.done_on_begin) {
            // Run backwards, to match actor order
            for (let i = this.linear_cells.length - 1; i >= 0; i--) {
                let cell = this.linear_cells[i];
                for (let tile of cell) {
                    if (tile && tile.type.on_begin) {
                        tile.type.on_begin(tile, this);
                    }
                }
            }
            // It's not possible to rewind to before this happened, so clear undo and permanently
            // set a flag
            this.pending_undo = new UndoEntry;
            this.done_on_begin = true;
        }

        if (this.undo_enabled) {
            // Store some current level state in the undo entry.  (These will often not be modified, but
            // they only take a few bytes each so that's fine.)
            for (let key of [
                    '_rng1', '_rng2', '_blob_modifier', '_tw_rng', 'force_floor_direction',
                    'tic_counter', 'frame_offset', 'time_remaining', 'timer_paused',
                    'chips_remaining', 'bonus_points', 'state', 'fail_reason', 'ankh_tile',
                    'player1_move', 'player2_move', 'remaining_players', 'player',
            ]) {
                this.pending_undo.level_props[key] = this[key];
            }
        }

        this.pending_green_toggle = false;
    }

    // Decision phase: all actors decide on their movement "simultaneously"
    do_decision_phase(forced_only = false) {
        for (let i = this.actors.length - 1; i >= 0; i--) {
            let actor = this.actors[i];

            // Clear any old decisions ASAP.  Note that this prop is only used internally within a
            // single tic, so it doesn't need to be undoable
            actor.decision = null;
            // This is a renderer prop and only exists between two loops
            if (actor.destination_cell) {
                this.set_tile_prop(actor, 'destination_cell', null);
            }
            // This is only used for killing an ankh'd player on an item
            if (actor.temp_ignore_item_collision) {
                this.set_tile_prop(actor, 'temp_ignore_item_collision', false);
            }

            if (! actor.cell)
                continue;

            if (actor.type.ttl) {
                // Animations, bizarrely, do their cooldown at decision time, so they're removed
                // early on the tic that they expire
                this.do_actor_cooldown(actor, this.update_rate);
                continue;
            }

            if (actor.movement_cooldown > 0)
                continue;

            // Erase old traces of movement now
            if (actor.movement_speed) {
                this.set_tile_prop(actor, 'previous_cell', null);
                this.set_tile_prop(actor, 'movement_speed', null);
                if (actor.is_pulled) {
                    this.set_tile_prop(actor, 'is_pulled', false);
                }
                if (actor.not_swimming) {
                    this.set_tile_prop(actor, 'not_swimming', false);
                }
            }

            // Make decisions
            if (actor === this.player) {
                this.make_player_decision(actor, this.p1_input, forced_only);
            }
            else {
                this.make_actor_decision(actor, forced_only);
            }

            // If we're on a force floor, remember its direction, so Lynx can prevent backwards
            // moves on it later
            if (actor.pending_slide_mode === 'force') {
                actor._force_floor_direction = actor.direction;
            }

            // Pending slides only last until a decision is made
            this.set_tile_prop(actor, 'pending_slide_mode', null);

            // Note that pending_push is only cleared when we actually move, both to prevent being
            // pushed a second time when we're already in mid-push, and to avoid a pending push
            // leaking over into the tic /after/ this one when it's made between our own decision
            // and movement phases.  (That can happen with the hook, which pulls both during the
            // holder's decision phase and then again when they move.)
            // TODO turn pending_push into pending_slide_direction?  not sure if that would actually
            // work, since i think pushing out of a slide is ok but a second push is ignored?  i
            // guess the slide mode could be changed to 'push'
        }
    }

    do_action_phase(cooldown) {
        if (this.compat.no_separate_idle_phase) {
            this._do_combined_action_phase(cooldown);
        }
        else {
            this._do_separated_action_phase(cooldown);
        }

        // Post-action stuff
        if (this.remaining_players <= 0) {
            this.win();
        }

        this.do_post_actor_phase();
    }

    // Lynx + Lexy action phase: move and cool down in one loop, idle in another
    _do_separated_action_phase(cooldown) {
        for (let i = this.actors.length - 1; i >= 0; i--) {
            let actor = this.actors[i];
            if (! actor.cell)
                continue;

            this.do_actor_movement(actor);
            if (actor.type.ttl)
                continue;

            this.do_actor_cooldown(actor, cooldown);
            this.do_actor_trap_ejection(actor);
        }
        for (let i = this.actors.length - 1; i >= 0; i--) {
            let actor = this.actors[i];
            if (! actor.cell)
                continue;
            if (actor.type.ttl)
                continue;

            this.do_actor_idle(actor);
        }
    }

    // CC2 action phase: move, cool down, and idle all in one loop
    _do_combined_action_phase(cooldown) {
        for (let i = this.actors.length - 1; i >= 0; i--) {
            let actor = this.actors[i];
            if (! actor.cell)
                continue;

            this.do_actor_movement(actor);
            if (actor.type.ttl)
                continue;

            this.do_actor_cooldown(actor, cooldown);
            this.do_actor_trap_ejection(actor);
            this.do_actor_idle(actor);
        }
    }

    // Have an actor attempt to move
    do_actor_movement(actor) {
        // Check this again, since an earlier pass may have caused us to start moving
        if (actor.movement_cooldown > 0)
            return;

        let direction = actor.decision;
        if (! direction)
            return true;

        // Actor is allowed to move, so do so
        let success = this.attempt_step(actor, direction);

        // If we're blocked (and didn't become an animation, which no longer moves), we might bonk
        if (! success && ! actor.type.ttl) {
            success = this._possibly_bonk(actor, direction);
        }

        // Track when the player is blocked for visual effect
        if (actor === this.player && ! success && ! actor.is_making_failure_move) {
            this.set_tile_prop(actor, 'is_blocked', true);
            if (actor.last_blocked_direction !== actor.direction) {
                // This is only used for checking when to play the mmf sound, doesn't need undoing;
                // it's cleared when we make a successful move or a null decision
                actor.last_blocked_direction = actor.direction;
                if (this.player.type.name === 'player') {
                    this.sfx.play_once('blocked1', actor.cell);
                }
                else {
                    this.sfx.play_once('blocked2', actor.cell);
                }
            }
        }

        return success;
    }

    _possibly_bonk(actor, direction) {
        // TODO this assumes the slide comes from the terrain, which is always the case atm
        let terrain = actor.cell.get_terrain();
        if (terrain.type.slide_mode === 'force') {
            // Force floor quirks:
            // - Force floors cause actors to slide, passively, every frame.  (I'm guessing this was
            //   done to make flipping force floors with wire actually work.)  An actor starting on
            //   a force floor is thus made to slide on the very first frame, before it even has a
            //   chance to move.  (This is what causes a player to be stuck when starting on a force
            //   floor loop; they move immediately, but in such a way that they never finish a move
            //   on the same frame that they're allowed to make a decision.)
            // - Bonking on a force floor causes an actor to immediately step on the entire cell
            //   again, then try to move again.  We know this for two reasons: one, it's visible
            //   from the timing of the RFF cycle when something bonks on an RFF; and two, monsters
            //   that begin on a force floor *and an item* will pick up the item ("item bestowal"),
            //   implying that they "notice" they've stepped on the item due to the bonk.  Monsters
            //   aren't intended to pick up items, of course, but they're usually blocked by items.
            // - Item bestowal still happens if the actor is a player with suction boots, standing
            //   on an item they've just dropped and deliberately pushing against a wall!  So the
            //   actor doesn't have to be sliding at all, just standing on a sliding tile.  (But
            //   note that most monsters will notice when they're blocked at decision time and try
            //   to avoid making a blocked move.)

            // So first, immediately pretend it stepped on the cell again
            this.step_on_cell(actor, actor.cell);

            // Bonking on a force floor immediately grants us override
            if (actor.type.is_real_player && ! this.compat.bonking_isnt_instant) {
                this.set_tile_prop(actor, 'can_override_force_floor', true);
            }

            // If the actor changed direction, immediately try to move again
            if (actor.direction !== direction && ! this.compat.bonking_isnt_instant) {
                // CC1: Wait until next tic to start moving again, actually
                return this.attempt_step(actor, actor.direction);
            }
        }
        else if (terrain.type.slide_mode === 'ice') {
            // Ice quirks:
            // - It's fundamentally built around turning around, so directing the actor is slightly
            //   more complicated.
            // - Item bestowal doesn't happen on ice, EXCEPT for Cerise (and doppel-Cerise) when NOT
            //   wearing cleats.  It's not clear to me how this could have happened by accident, and
            //   it's too obscure to be deliberate, so I've just special-cased this here.
            // - Ghosts turn around when they bonk on ice, even though they're otherwise not
            //   affected by it.  If they have cleats, they instead get stuck in place forever.
            //   I strongly suspect this is deliberate (except for the cleats part) -- the game
            //   would HAVE to force ghosts to ignore their normal decision-time collision check to
            //   force a bonk in the first place, or they'd simply turn left instead.  The cleats
            //   issue is a natural side effect of that: cleats prevent bonking, and bonking is what
            //   causes the turnaround, so a ghost with cleats will charge into the wall forever.
            // - An actor that starts out on an ice corner will oscillate between the two open
            //   directions, every frame, which suggests that the corner's direction-changing behavior
            //   happens on_stand, but the ice sliding effect itself happens on arrive.
            //   (TODO this part isn't done, but seems very unlikely to have gameplay impact)

            if (actor.has_item('cleats')) {
                // Don't do anything special; we're still blocked
                return false;
            }
            else if (actor.type.name === 'player2' || actor.type.name === 'doppelganger2') {
                // Cerise behavior: Bonk like it's a force floor, do nothing else
                this.step_on_cell(actor, actor.cell);
                return false;
            }
            else {
                // Normal bonking behavior: Turn around, step on /only the terrain/ (to get the
                // turnaround effect)
                this.set_actor_direction(actor, DIRECTIONS[direction].opposite);

                if (terrain.type.on_arrive) {
                    terrain.type.on_arrive(terrain, this, actor);
                }
                if (terrain.type.on_stand) {
                    terrain.type.on_stand(terrain, this, actor, true);
                }

                // Immediately try moving again, since we're guaranteed to have changed direction
                if (! this.compat.bonking_isnt_instant) {
                    // CC1: Wait until next tic to start moving again
                    return this.attempt_step(actor, actor.direction);
                }
            }
        }
        else if (actor.current_slide_mode === 'teleport-forever' &&
            ! actor.cell.get_terrain().is_active)
        {
            // Teleport slides do not bonk, with one oddball special case for red teleporters:
            // if you pass through a wired but inactive one, you keep sliding indefinitely, until
            // the teleporter becomes active again
            this.schedule_actor_slide(actor, 'teleport-forever');
        }
        else {
            // Other kinds of slides (i.e. normal teleporting) just expire normally
            this.set_tile_prop(actor, 'current_slide_mode', null);
        }

        return false;
    }

    do_actor_cooldown(actor, cooldown = 3) {
        if (actor.movement_cooldown <= 0) {
            if (actor.is_making_failure_move) {
                // For actors that are causing the game to end with an attempted move, and which
                // aren't actually moving, give them a cooldown /as if/ they were moving into the
                // deadly cell (which should have already been fudged with .destination_cell)
                let speed = actor.type.movement_speed * 3;
                this.set_tile_prop(actor, 'movement_cooldown', speed - cooldown);
                this.set_tile_prop(actor, 'movement_speed', speed);
            }
            return;
        }

        if (actor.last_extra_cooldown_tic === this.tic_counter)
            return;

        this.set_tile_prop(actor, 'movement_cooldown', Math.max(0, actor.movement_cooldown - cooldown));

        if (actor.movement_cooldown <= 0) {
            if (actor.type.ttl) {
                // This is an animation that just finished, so destroy it
                this.remove_tile(actor);
                return;
            }

            if (this.render_direction) {
                this.set_tile_prop(actor, 'render_direction', null);
            }

            if (actor === this.player) {
                // Play step sound when the player completes a move
                this._play_footstep(actor);
                // And erase any remembered move, until we make a new one
                this.remember_player_move(null);
            }

            if (! this.compat.actors_move_instantly) {
                this.step_on_cell(actor, actor.cell);
            }
            this.set_tile_prop(actor, 'current_slide_mode', null);

            // Note that we don't erase the movement bookkeeping until next decision phase, because
            // the renderer interpolates back in time and needs to know to draw us finishing the
            // move; this should be fine since everything checks for "in motion" by looking at
            // movement_cooldown, which is already zero.  (Also saves some undo budget, since
            // movement_speed is never null for an actor in constant motion.)
        }
    }

    _play_footstep(actor) {
        let terrain = actor.cell.get_terrain();
        if (terrain.type.slide_mode === 'ice' && ! (actor.traits & ACTOR_TRAITS.iceproof)) {
            this.sfx.play_once('slide-ice');
        }
        else if (terrain.type.slide_mode === 'force' && ! (actor.traits & ACTOR_TRAITS.forceproof)) {
            this.sfx.play_once('slide-force');
        }
        else if (terrain.type.name === 'popdown_floor') {
            this.sfx.play_once('step-popdown');
        }
        else if (terrain.type.name === 'gravel' || terrain.type.name === 'railroad' ||
            terrain.type.name === 'sand' || terrain.type.name === 'grass')
        {
            this.sfx.play_once('step-gravel');
        }
        else if (terrain.type.name === 'water') {
            if (actor.traits & ACTOR_TRAITS.waterproof) {
                this.sfx.play_once('step-water');
            }
        }
        else if (terrain.type.name === 'fire') {
            if (actor.traits & ACTOR_TRAITS.fireproof) {
                this.sfx.play_once('step-fire');
            }
        }
        else if (terrain.type.slide_mode === 'force') {
            this.sfx.play_once('step-force');
        }
        else if (terrain.type.slide_mode === 'ice') {
            this.sfx.play_once('step-ice');
        }
        else {
            if (actor.type.name === 'player') {
                this.sfx.play_once('step-floor1');
            }
            else {
                this.sfx.play_once('step-floor2');
            }
        }
    }

    // Lynx: Actors standing on brown buttons perform trap ejection immediately after their
    // cooldown, in actor order.  This causes a lot of double movement and there's not really any
    // way to simulate it other than to just do this awkward pseudo-phase
    do_actor_trap_ejection(actor) {
        if (! this.compat.traps_like_lynx)
            return;
        if (actor.movement_cooldown > 0)
            return;

        let terrain = actor.cell.get_terrain();
        if (terrain.type.name === 'button_brown' && terrain.connection) {
            let trapped = terrain.connection.cell.get_actor();
            if (trapped) {
                if (trapped.movement_cooldown === 0) {
                    // This flag lets the trap know it's ejecting; it acts closed at all other times
                    terrain.connection._lynx_ejecting = true;
                    this.attempt_out_of_turn_step(trapped, trapped.direction);
                    terrain.connection._lynx_ejecting = false;
                }
                else {
                    // Lynx does a cooldown regardless of whether it could move (and whether it was
                    // stationary), which is why things walking into traps move at double speed
                    this.do_extra_cooldown(trapped);
                }
            }
        }
    }

    do_actor_idle(actor) {
        if (actor._force_floor_direction) {
            // This only exists for one tic, for Lynx purposes
            actor._force_floor_direction = null;
        }

        if (actor.movement_cooldown <= 0) {
            let terrain = actor.cell.get_terrain();
            if (terrain.type.on_stand) {
                terrain.type.on_stand(terrain, this, actor);
            }
            // You might think a loop would be good here but this is unbelievably faster and the
            // only non-terrain tile with an on_stand is the bomb anyway
            let item = actor.cell.get_item();
            if (item && item.type.on_stand) {
                item.type.on_stand(item, this, actor);
            }

            if (this.compat.teleport_every_tic && terrain.type.teleport_dest_order) {
                // Lynx: Actors try to teleport for as long as they remain on a teleporter, most
                // notably (for CCLP purposes) when starting the level already on one
                actor.just_stepped_on_teleporter = terrain;
            }
        }

        if (actor.just_stepped_on_teleporter) {
            this.attempt_teleport(actor);
        }
    }

    // This is consistently called 'swap' only because 'switch' is a keyword.
    swap_players() {
        // FIXME cc2 has very poor interactions between this feature and cloners; come up with some
        // better rules as a default

        // Reset the set of keys released since last tic (but not the swap key, or holding it
        // will swap us endlessly)
        // FIXME this doesn't even quite work, it just swaps less aggressively?  wtf
        this.p1_released = 0xff & ~INPUT_BITS.swap;
        // Clear remembered moves
        this.player1_move = null;
        this.player2_move = null;

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
                if (this.compat.player_moves_last && i !== 0) {
                    [this.actors[0], this.actors[i]] = [this.actors[i], this.actors[0]];
                }
                break;
            }
        }
    }

    do_post_actor_phase() {
        if (this.pending_green_toggle) {
            // Swap green objects
            this._toggle_green_tiles();
            this.pending_green_toggle = false;

            if (this.undo_enabled) {
                this.pending_undo.toggle_green_tiles = true;
            }
        }

        this._check_sokoban_buttons();
    }

    _toggle_green_tiles() {
        // This is NOT undo-safe; it's undone by calling it again!
        // Assumes:
        // 1. Green tile types come in pairs, which toggle into one another
        // 2. A pair of green tile types appear on the same layer
        for (let cell of this.linear_cells) {
            let terrain = cell.get_terrain();
            if (terrain.type.green_toggle_counterpart) {
                terrain.type = TILE_TYPES[terrain.type.green_toggle_counterpart];
            }

            let item = cell.get_item();
            if (item && item.type.green_toggle_counterpart) {
                item.type = TILE_TYPES[item.type.green_toggle_counterpart];
            }
        }
    }

    // Check for changes to sokoban buttons, and swap the appropriate floors/walls if necessary.
    // NOT undo-safe; this is undone by calling it again after an undo.
    _check_sokoban_buttons() {
        for (let [color, was_satisfied] of Object.entries(this.sokoban_satisfied)) {
            let is_satisfied = this.sokoban_unpressed[color] === 0;
            if (was_satisfied !== is_satisfied) {
                this.sokoban_satisfied[color] = is_satisfied;
                let new_type = TILE_TYPES[is_satisfied ? 'sokoban_floor' : 'sokoban_wall'];
                for (let cell of this.linear_cells) {
                    let terrain = cell.get_terrain();
                    if ((terrain.type.name === 'sokoban_wall' || terrain.type.name === 'sokoban_floor') &&
                        terrain.color === color)
                    {
                        terrain.type = new_type;
                    }
                }
            }
        }
    }

    do_cleanup_phase() {
        // Lynx compat: Any blue tank that still has the reversal flag set here, but is in motion,
        // should ignore it.  Unfortunately this has to be done as its own pass (as it is in Lynx!)
        // because of acting order issues
        if (this.compat.tanks_ignore_button_while_moving) {
            for (let actor of this.actors) {
                if (actor.cell && actor.pending_reverse && actor.movement_cooldown > 0) {
                    this.set_tile_prop(actor, 'pending_reverse', false);
                }
            }
        }

        // Strip out any destroyed actors from the acting order
        // FIXME this is O(n), where n is /usually/ small, but i still don't love it.  not strictly
        // necessary, either; maybe only do it every few tics?
        let p = 0;
        for (let i = 0, l = this.actors.length; i < l; i++) {
            let actor = this.actors[i];
            if (actor.cell || actor.is_detached || (
                // Don't strip out actors under Lynx, where slots were reused -- unless they're VFX,
                // which aren't in the original game and thus are exempt
                this.compat.reuse_actor_slots && actor.type.layer !== LAYERS.vfx))
            {
                if (p !== i) {
                    this.actors[p] = actor;
                }
                p += 1;
            }
            else if (this.undo_enabled) {
                this.pending_undo.actor_splices.push([p, 0, actor]);
            }
        }
        this.actors.length = p;

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

    // Actor decision-making --------------------------------------------------------------------------

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
        // (This is also why inactive players stay frozen pushing, which I like)
        this.set_tile_prop(actor, 'is_pushing', false);
        // This effect only lasts one tic, after which we can move again
        if (! forced_only) {
            this.set_tile_prop(actor, 'is_blocked', false);
        }

        // TODO player in a cloner can't move (but player in a trap can still turn)

        let try_direction = (direction, push_mode) => {
            return !! this.check_movement(actor, actor.cell, direction, push_mode);
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
        // TODO feels weird that the slide mode is on the player but the override mode isn't
        let may_move = ! forced_only && (
            ! actor.pending_slide_mode ||
            terrain.type.slide_override_mode === 'player' ||
            (terrain.type.slide_override_mode === 'player-force' && actor.can_override_force_floor));
        let [dir1, dir2] = this._extract_player_directions(input);

        // Check for special player actions, which can only happen at decision time.  Dropping can
        // only be done when the player is allowed to make a move (i.e. override), but the other two
        // can be done freely while sliding.
        // FIXME cc2 seems to rely on key repeat for this; if you have four bowling balls and hold
        // Q, you'll throw the first, wait a second or so, then release the rest rapid-fire.  absurd
        if (! forced_only) {
            let new_input = input & this.p1_released;
            if (new_input & INPUT_BITS.cycle) {
                this.p1_released &= ~INPUT_BITS.cycle;
                this.cycle_inventory(actor);
            }
            if ((new_input & INPUT_BITS.drop) && may_move) {
                this.p1_released &= ~INPUT_BITS.drop;
                if (this.drop_item(actor)) {
                    this.sfx.play_once('drop');
                }
            }
            if (new_input & INPUT_BITS.swap) {
                this.p1_released &= ~INPUT_BITS.swap;
                this.swap_players();

                if (! this.compat.allow_simultaneous_movement) {
                    // Lexy: Input is only given to the first player to read it; a conscious swap
                    // erases all input before the swapped-to player can read it
                    this.p1_input = 0;
                }
            }
        }

        if (actor.pending_slide_mode && ! (may_move && dir1)) {
            // This is a forced move and we're not overriding it, so we're done
            actor.decision = actor.direction;
            this.remember_player_move(actor.decision);
            this.set_tile_prop(actor, 'current_slide_mode', actor.pending_slide_mode);

            // Any kind of "soft" slide enables us to override a future force floor, which is all
            // slides except ice and green/yellow teleporters
            if (actor.pending_slide_mode !== 'ice' && actor.pending_slide_mode !== 'teleport-hard') {
                this.set_tile_prop(actor, 'can_override_force_floor', true);
            }
        }
        else if (forced_only) {
            // Not allowed to move, so do nothing
        }
        else if (dir1 === null) {
            // Not attempting to move, so do nothing, but remember it
            this.remember_player_move(null);
        }
        else {
            // At this point, we have exactly 1 or 2 directions, and deciding between them requires
            // checking which ones are blocked.  Note that we do this even if only one direction is
            // requested, meaning that we get to push blocks before anything else has moved!

            let push_mode = this.compat.no_early_push ? 'slap' : 'push';
            let open;
            if (dir2 === null) {
                // Only one direction is held, but for consistency, "check" it anyway
                open = try_direction(dir1, push_mode);
                actor.decision = dir1;
            }
            else {
                // Resolve two directions.
                // Note that if this is an override, then the forced direction is still used to
                // interpret our input!
                // FIXME lynx only checks horizontal?
                let open1 = try_direction(dir1, push_mode);
                let open2 = try_direction(dir2, push_mode);
                if (open1 && open2 && (dir1 === actor.direction || dir2 === actor.direction)) {
                    // Both directions are open, but one of them is the way we're already moving, so
                    // stick with that
                    actor.decision = actor.direction;
                    open = true;
                }
                else if (open1 !== open2) {
                    // Only one direction is open, so use it.
                    actor.decision = open1 ? dir1 : dir2;
                    open = true;
                }
                else {
                    // If we got here, both directions are equally (in)accessible, and we have no
                    // reason to prefer one over the other, so prefer the horizontal.
                    if (dir1 === 'east' || dir1 === 'west') {
                        actor.decision = dir1;
                        open = open1;
                    }
                    else {
                        actor.decision = dir2;
                        open = open2;
                    }
                }
            }

            // Doppelgangers copy our /attempted/ move, including a failed override
            this.remember_player_move(actor.decision);

            if (actor.pending_slide_mode === 'force' && ! open &&
                ! this.compat.bonking_isnt_instant)
            {
                // Bonking at decision time grants us override, just like a normal bonk
                this.set_tile_prop(actor, 'can_override_force_floor', true);

                if (! this.compat.emulate_salmon_run) {
                    // Lexy: If we bonked *already*, switch our decision back to the forced move.
                    // This prevents a salmon run, although it doesn't actually work in Lexy mode
                    // anyway -- blocks are synchronized with your movement, so you never bonk!
                    actor.decision = actor.direction;
                }
            }
            else {
                // Otherwise this is 100% a conscious move, so we lose override
                this.set_tile_prop(actor, 'can_override_force_floor', false);
            }
        }

        if (actor.decision === null && ! forced_only) {
            actor.last_blocked_direction = null;
        }
    }

    make_actor_decision(actor, forced_only = false) {
        if (actor.pending_push) {
            // Blocks that were pushed while sliding will move in the push direction as soon as
            // they can make a decision, even if they're still sliding or are off-tic.  Also used
            // for hooking.  (Note that if the block is on a force floor and is blocked in the push
            // direction, under CC2 rules it'll then try the force floor; see attempt_step.)
            // This isn't cleared until the block actually attempts a move; see do_actor_movement.
            actor.decision = actor.pending_push;
            return;
        }

        let direction_preference;
        let terrain = actor.cell.get_terrain();
        if (actor.pending_slide_mode) {
            // Actors can't make voluntary moves while sliding; they just, ah, slide.
            actor.decision = actor.direction;
            this.set_tile_prop(actor, 'current_slide_mode', actor.pending_slide_mode);
            return;
        }
        else if (actor.type.name === 'ghost' && terrain.type.slide_mode === 'ice') {
            // TODO weird cc2 quirk/bug: ghosts bonk on ice even though they don't slide on it
            // FIXME and if they have cleats, they get stuck instead (?!)
            actor.decision = actor.direction;
            return;
        }
        if (forced_only)
            return;
        // Trapped actors don't even attempt to turn
        if (terrain.type.traps && terrain.type.traps(terrain, this, actor) &&
            // CC1: Blue tanks do still turn around, so let them go through their decision process
            // and then just fail to move later
            ! (this.compat.blue_tanks_reverse_in_traps &&
                actor.type.name === 'tank_blue' && actor.pending_reverse))
        {
            return;
        }
        if (actor.type.decide_movement) {
            direction_preference = actor.type.decide_movement(actor, this);
        }
        if (! direction_preference)
            return;

        // In CC2, some monsters can only ever have one direction to choose from, so they don't
        // bother checking collision at all.  (Unfortunately, this causes spring mining.)
        // TODO compat flag for this
        if (actor.type.skip_decision_time_collision_check) {
            actor.decision = direction_preference[0] ?? null;
            return;
        }

        // Check which of those directions we *can*, probably, move in
        let push_mode = this.compat.no_early_push ? 'slap' : 'push';
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

            if (this.check_movement(actor, actor.cell, direction, push_mode)) {
                // We found a good direction!  Stop here
                actor.decision = direction;
                break;
            }

            // If every other preference be blocked, actors unconditionally try the last one
            // (and might even be able to move that way by the time their turn comes!)
            if (i === direction_preference.length - 1) {
                actor.decision = direction;
            }
        }
    }

    // Actor movement ---------------------------------------------------------------------------------

    // Returns a direction or null -- this is where railroads redirect movement!
    can_actor_leave_cell(actor, cell, direction, push_mode) {
        // The only tiles that can trap us are thin walls and terrain, so for perf (this is very hot
        // code), only bother checking those)
        let terrain = cell[LAYERS.terrain];
        let thin_walls = cell[LAYERS.thin_wall];

        let blocked = (blocker) => {
            if (push_mode === 'push' && actor.type.on_blocked) {
                actor.type.on_blocked(actor, this, direction, blocker);
            }
            return null;
        };

        if (thin_walls && thin_walls.type.blocks_leaving && thin_walls.type.blocks_leaving(thin_walls, this, actor, direction)) {
            return blocked(thin_walls);
        }
        if (terrain.type.traps && terrain.type.traps(terrain, this, actor)) {
            return blocked(terrain);
        }
        // This is where railroad redirection happens.  push_mode check is very important since the
        // redirection also calls us again
        if (push_mode !== null && terrain.type.redirect_exit) {
            direction = terrain.type.redirect_exit(terrain, this, actor, direction);
        }
        if (terrain.type.blocks_leaving && terrain.type.blocks_leaving(terrain, this, actor, direction)) {
            return blocked(terrain);
        }

        return direction;
    }

    // Check if this actor can move this direction into this cell.  Returns true on success.  May
    // have side effects, depending on the value of push_mode:
    // - null: Default.  Do not impact game state.  Treat pushable objects as blocking.
    // - 'bump': Fire bump triggers.  Don't move pushable objects, but do check whether they /could/
    //   be pushed, recursively if necessary.  Only used for teleporting.
    // - 'slap': Like 'bump', but also sets the 'decision' of pushable objects.  Only used with the
    //   no_early_push Lynx compat flag.
    // - 'push': Fire bump triggers.  Attempt to move pushable objects out of the way immediately.
    // FIXME there are way too many weird-ass extraneous bits here for what's gotta be hot code
    can_actor_enter_cell(actor, cell, direction, push_mode = null) {
        let pushable_tiles = [];
        let deferred_blocked = false;
        let allow_item_mining = false;
        for (let layer of this.layer_collision_order) {
            let tile = cell[layer];
            if (! tile)
                continue;

            let original_type = tile.type;
            if (tile.type.on_bumped) {
                tile.type.on_bumped(tile, this, actor, direction);
                // If that destroyed the tile (e.g. by erasing an animation), skip the rest of this
                if (! tile.cell) {
                    allow_item_mining = true;
                    continue;
                }
            }

            // Lynx + MS: Players can't die at decision time, but they don't block movement either
            let ignore_player = (this.compat.player_safe_at_decision_time && push_mode !== 'push');
            // If this is a monster and the tile is a player, we can just ignore it now; if the
            // other way around, the player might still e.g. slap a block
            if (ignore_player && tile.type.is_real_player)
                continue;

            // Death happens here: if a monster or block even thinks about moving into a player, or
            // a player thinks about moving into a monster, the player dies.  A player standing on a
            // wall is only saved by the wall being checked first.  This is also why standing on an
            // item won't save you: actors are checked before items!
            // TODO merge this with player_protected_by_items?  seems like they don't make sense independently
            if (layer === LAYERS.actor && ! ignore_player &&
                // If we've already given up on this cell and are just waiting to see if we can do a
                // flick, definitely don't try to kill a player
                ! deferred_blocked &&
                this._check_for_player_death(actor, tile))
            {
                // Actors can't move into each other's cells, so monsters aren't allowed to actually
                // step on the player (or vice versa) -- however, to make it LOOK like that's what's
                // happening in the final frame, use the 'destination_cell' (originally meant for
                // teleporters) property to pretend this movement happens.
                // But first -- this implies that if a player is standing on an item, and a monster
                // kills the player, AND the player has an inscribed ankh, then the monster should
                // be able to continue on into the cell despite the item!  So make that happen too.
                if (tile.type.is_real_player && tile.cell !== cell) {
                    this.set_tile_prop(actor, 'temp_ignore_item_collision', true);
                    return true;
                }
                else {
                    this.set_tile_prop(actor, 'previous_cell', actor.cell);
                    this.set_tile_prop(actor, 'destination_cell', cell);
                    this.set_tile_prop(actor, 'is_making_failure_move', true);
                    this.set_tile_prop(actor, 'render_direction', direction);
                }
            }

            if (! tile.blocks(actor, direction, this))
                // Not blocking, move on
                continue;

            if (layer !== LAYERS.actor && (
                this.compat.allow_pushing_blocks_off_all_walls ||
                (this.compat.allow_pushing_blocks_off_faux_walls &&
                    original_type.is_flickable_in_lynx)))
            {
                // MS: blocks can be pushed off of *anything*, so defer being stopped until after we
                // check for pushable tiles
                // Lynx: blocks can be pushed off of blue walls and reveal walls
                deferred_blocked = true;
                continue;
            }

            if (layer === LAYERS.item && allow_item_mining) {
                // CC2 quirk: If an actor bumps a cell containing an item and an animation (or a
                // block it can push), it will erase the animation (or push the block), even if it
                // can't move onto the item.  If the actor is sliding, it will move into the cell
                // despite the item!
                // So if we see an item and there's been a pushable block, defer it, based on
                // whether we're sliding.
                // TODO this doesn't quite fix Bumper Cars
                // TODO this is jank-ass behavior.  compat flag?  but it's necessary for some types
                // of bestowal.  urrgh
                deferred_blocked = ! actor.current_slide_mode;
                continue;
            }

            // If we reach this point, we're blocked, but we may still need to do our push behavior
            // XXX this is only used for fireballs hitting ice blocks, to make them also bounce off;
            // could just return true from on_bumped to indicate definitely still blocking
            if (tile.type.on_after_bumped) {
                tile.type.on_after_bumped(tile, this, actor);
            }

            if (push_mode === null)
                return false;

            if (actor.can_push(tile, direction, this) || (
                this.compat.use_pgchip_ice_blocks && tile.type.name === 'ice_block' &&
                (actor.type.name === 'teeth' || actor.type.name === 'teeth_timid' || actor.type.name === 'tank_blue')
            )) {
                // Collect pushables for later, so we don't inadvertently push through a wall
                pushable_tiles.push(tile);
                allow_item_mining = true;
            }
            else {
                // It's in our way and we can't push it, so we're done here
                if (push_mode === 'push') {
                    if (actor.type.on_blocked) {
                        actor.type.on_blocked(actor, this, direction, tile);
                    }
                }
                return false;
            }
        }

        // If we got this far, all that's left is to deal with pushables, if any
        if (pushable_tiles.length === 0) {
            return ! deferred_blocked;
        }

        for (let tile of pushable_tiles) {
            if (tile._being_pushed)
                return false;

            // This flag (and the try/finally to ensure it's immediately cleared) detects recursive
            // push attempts, which can happen with a row of ice clogged by stuck sliding ice blocks
            try {
                tile._being_pushed = true;

                if (this.compat.failed_push_changes_direction &&
                    push_mode !== null && tile.movement_cooldown === 0)
                {
                    // Lynx: A pushed stationary block changes direction in any mode regardless of
                    // whether the push succeeds, most notably if it's in a trap
                    this.set_tile_prop(tile, 'direction', direction);
                }

                if (push_mode === 'bump' || push_mode === 'slap') {
                    if (tile.movement_cooldown > 0)
                        return false;

                    if (! this.check_movement(tile, tile.cell, direction, push_mode))
                        return false;

                    if (push_mode === 'slap') {
                        if (actor === this.player) {
                            this.set_tile_prop(actor, 'is_pushing', true);
                            this.sfx.play_once('push');
                        }
                        // FIXME we get here for monsters in lynx mode!  check this is actually
                        // possible
                        tile.decision = direction;
                    }
                }
                else if (push_mode === 'push') {
                    if (actor === this.player) {
                        this.set_tile_prop(actor, 'is_pushing', true);
                    }

                    // We can (and in CC2, must!) do a pending push for blocks that are in motion,
                    // or that are currently sliding (which might include blocks jammed in place).
                    // However, this ONLY works for blocks on sliding tiles -- a block moving onto a
                    // teleporter can be pending-pushed, a block moving onto floor is just a wall.
                    let must_pending_push = (tile.movement_cooldown || tile.current_slide_mode) &&
                        tile.cell.get_terrain().type.slide_mode;

                    if (this.compat.no_directly_pushing_sliding_blocks && must_pending_push) {
                        // CC2: Can't directly push a sliding block, even one on a force floor
                        // that's stuck on a wall (and thus not moving).  Such a push ALWAYS becomes
                        // a pending push, so it won't happen until next tic, and we remain blocked
                        this.set_tile_prop(tile, 'pending_push', direction);
                        // If the block already had its decision phase this turn, override it
                        tile.decision = direction;
                        return false;
                    }

                    // Lexy/Lynx(?) behavior: try to push the block first, then resort to pending if
                    // the push fails
                    if (this.attempt_out_of_turn_step(tile, direction)) {
                        if (actor === this.player) {
                            this.sfx.play_once('push');
                        }
                    }
                    else {
                        if (! this.compat.no_directly_pushing_sliding_blocks && must_pending_push) {
                            // If the push failed, remember this as the next move it'll make
                            this.set_tile_prop(tile, 'pending_push', direction);
                            tile.decision = direction;
                        }
                        return false;
                    }
                }
            }
            finally {
                delete tile._being_pushed;
            }
        }

        // In push mode, check one last time for being blocked, in case we e.g. pushed a block off
        // of a recessed wall.
        // This is the check that prevents spring mining, the phenomenon where (a) actor pushes a
        // block off of a recessed wall or lilypad, (b) the wall/lilypad becomes blocking as a
        // result, (c) the actor moves into the cell anyway.  In most cases this is prevented on
        // accident, because pushes happen at decision time during the collision check, and then the
        // actual movement happens later with a second collision check.
        // There's one exception: CC2 does seem to have spring mining prevention when pushing a
        // /row/ of ice blocks, so we keep the check if we're in the middle of push-recursing.
        // See CC2 #163 BLOX replay; without this, ice blocks spring mine around 61.9s.
        // *Also*, this prevents yellow tanks from being bestowed items by pushing blocks, which is
        // a real mechanic people design around, so skip the check for items specifically here.
        if ((! this.compat.emulate_spring_mining || actor._being_pushed) &&
            push_mode === 'push' && cell.some(tile =>
                tile && tile.type.layer !== LAYERS.item && tile.blocks(actor, direction, this)))
        {
            return false;
        }

        return ! deferred_blocked;
    }

    _check_for_player_death(actor, tile) {
        if ((actor.traits | tile.traits) & ACTOR_TRAITS.invulnerable) {
            // Helmet disables this, do nothing.  In most cases, normal collision will kick
            // in.  Note that this doesn't protect you from bowling balls, which aren't
            // blocked by anything.
        }
        else if (tile.type.is_real_player) {
            if (actor.is_pulled) {
                // We can't be killed by something we're pulling.  Even if that thing is a monster,
                // which is not something we can pull!  See CC2LP1 #110 Hoopla
                return false;
            }
            else if (actor.type.is_monster) {
                this.kill_actor(tile, actor);
                return true;
            }
            else if (actor.type.is_block) {
                this.kill_actor(tile, actor, null, null, 'squished');
                return true;
            }
        }
        else if (actor.type.is_real_player && tile.type.is_monster) {
            this.kill_actor(actor, tile);
            return true;
        }
    }

    // Can cause redirection (via railroads), so returns the movement direction on success, null on
    // failure.
    // XXX set_direction feels rather jank but it's awkward to express otherwise
    check_movement(actor, orig_cell, direction, push_mode, set_direction) {
        if (set_direction) {
            this.set_tile_prop(actor, 'direction', direction);
        }

        // Lynx: Nothing can move backwards on force floors, and it functions like blocking, but
        // does NOT act like a bonk (hence why it's here)
        if (this.compat.no_backwards_override &&
            actor._force_floor_direction === DIRECTIONS[direction].opposite)
        {
            return null;
        }

        let original_direction = direction;
        direction = this.can_actor_leave_cell(actor, orig_cell, direction, push_mode);
        if (set_direction && direction) {
            this.set_tile_prop(actor, 'direction', direction);

            // Some tiles (ahem, frame blocks) rotate when their attempted direction is redirected,
            // even if the movement ultimately fails, so it can only happen here
            if (direction !== original_direction && actor.type.on_rotate) {
                // FIXME there's a weird case involving thin walls where a block doesn't rotate as
                // expected, but i can't quite work out where or why it happens
                let turn = ['right', 'left', 'opposite'].filter(t => {
                    return DIRECTIONS[original_direction][t] === direction;
                })[0];
                actor.type.on_rotate(actor, this, turn);
            }
        }
        if (! direction)
            return null;

        let dest_cell = this.get_neighboring_cell(orig_cell, direction);
        if (! dest_cell) {
            if (push_mode === 'push') {
                if (actor.type.on_blocked) {
                    actor.type.on_blocked(actor, this, direction, null);
                }
            }
            return null;
        }

        if (! this.can_actor_enter_cell(actor, dest_cell, direction, push_mode))
            return null;

        // If we succeeded, but became an animation in there somewhere (e.g. because we walked into
        // a bowling ball), stop here anyway
        if (actor.type.ttl)
            return null;

        // If we have the hook, pull anything behind us, now that we're out of the way.
        // In CC2, this has to happen here to make hook slapping work and allow hooking a moving
        // block to stop us, and it has to use pending decisions rather than an immediate move
        // because we're still in the way (so the block can't move) and also to prevent a block from
        // being able to follow us through a swivel (which we haven't swiveled at decision time).
        if (this.compat.use_legacy_hooking && (actor.traits & ACTOR_TRAITS.adhesive)) {
            let behind_cell = this.get_neighboring_cell(orig_cell, DIRECTIONS[direction].opposite);
            if (behind_cell) {
                let behind_actor = behind_cell.get_actor();
                if (behind_actor && actor.can_pull(behind_actor, direction)) {
                    if (behind_actor.movement_cooldown) {
                        return null;
                    }
                    else if (push_mode === 'push') {
                        // Only blocks can actually be moved via pulling, but monsters can still
                        // count as pulled, which stops them from killing us
                        this.set_tile_prop(behind_actor, 'is_pulled', true);
                        if (behind_actor.type.is_block) {
                            this.set_tile_prop(behind_actor, 'pending_push', direction);
                            behind_actor.decision = direction;
                        }
                    }
                }
            }
        }

        return direction;
    }

    // Try to move the given actor one tile in the given direction and update their cooldown.
    // Return true if successful.
    attempt_step(actor, direction) {
        // In mid-movement, we can't even change direction!
        if (actor.movement_cooldown > 0)
            return false;

        // Once we try to move, this expires
        this.set_tile_prop(actor, 'pending_push', null);

        // Grab speed /first/, in case the movement or on_blocked turns us into an animation
        // immediately (and then we won't have a speed!)
        // FIXME that's a weird case actually since the explosion ends up still moving
        let speed = actor.type.movement_speed;

        direction = this.check_movement(actor, actor.cell, direction, 'push', true);
        if (! direction)
            return false;

        // We're clear!  Move us
        let goal_cell = this.get_neighboring_cell(actor.cell, direction);
        let orig_cell = actor.cell;
        this.set_tile_prop(actor, 'previous_cell', orig_cell);
        this.move_to(actor, goal_cell);

        // Now that we know whether we're sliding (generally set by the terrain's on_approach),
        // compute our speed
        let terrain = goal_cell.get_terrain();
        // FIXME ah this is kind of a fucking mess huh
        if (terrain.type.speed_factor && ! (
            // Don't take the speed into account for sliding tiles that we're immune to
            (terrain.type.slide_mode === 'force' && (actor.traits & ACTOR_TRAITS.forceproof)) ||
            (terrain.type.slide_mode === 'ice' && (actor.traits & ACTOR_TRAITS.iceproof))
        ))
        {
            speed *= terrain.type.speed_factor;
        }
        else if (actor.traits & ACTOR_TRAITS.hasty) {
            // Speed boots speed us up, UNLESS we're about to speed up /due to a slide/ — notably
            // they still take effect when teleporting or walking on sand
            speed /= 2;
        }
        let duration = speed * 3;
        this.set_tile_prop(actor, 'movement_cooldown', duration);
        this.set_tile_prop(actor, 'movement_speed', duration);

        // Do Lexy-style hooking here: only attempt to pull things just after we've actually moved
        // successfully, which means the hook can never stop us from moving and hook slapping is not
        // a thing, and also make them a real move rather than a weird pending thing
        if (! this.compat.use_legacy_hooking && (actor.traits & ACTOR_TRAITS.adhesive)) {
            let behind_cell = this.get_neighboring_cell(orig_cell, DIRECTIONS[direction].opposite);
            if (behind_cell) {
                let behind_actor = behind_cell.get_actor();
                if (behind_actor && actor.can_pull(behind_actor, direction) && behind_actor.type.is_block) {
                    this.set_tile_prop(behind_actor, 'is_pulled', true);
                    this.attempt_out_of_turn_step(behind_actor, direction);
                }
            }
        }

        if (actor === this.player) {
            actor.last_blocked_direction = null;
        }

        return true;
    }

    attempt_out_of_turn_step(actor, direction) {
        // FIXME is_sliding doesn't even exist any more
        if (actor.is_sliding && actor.cell.get_terrain().type.slide_mode === 'turntable') {
            // FIXME where should this be?  should a block on a turntable ignore pushes?  but then
            // if it gets blocked it's stuck, right?
            // FIXME ok that is already the case, oops
            // Something is (e.g.) pushing a block that just landed on a turntable and is waiting to
            // slide out of it.  Ignore the push direction and move in its current direction;
            // otherwise a player will push a block straight through, then turn, which sucks
            direction = actor.direction;
        }
        let success = this.attempt_step(actor, direction);
        if (success) {
            this.do_extra_cooldown(actor);
        }
        return success;
    }

    do_extra_cooldown(actor) {
        this.do_actor_cooldown(actor, this.update_rate);
        // Only Lexy has double-cooldown protection
        if (! this.compat.allow_double_cooldowns) {
            this.set_tile_prop(actor, 'last_extra_cooldown_tic', this.tic_counter);
        }
    }

    // Move the given actor to the given position and perform any appropriate
    // tile interactions.  Does NOT check for whether the move is actually
    // legal; use attempt_step for that!
    move_to(actor, goal_cell) {
        if (actor.cell === goal_cell)
            return;

        this.set_tile_prop(actor, 'pending_slide_mode', null);

        if (actor.type.on_starting_move) {
            actor.type.on_starting_move(actor, this);
        }

        let original_cell = actor.cell;
        // Physically remove the actor first, so that it won't get in the way of e.g. a splash
        // spawned from stepping off of a lilypad
        this.remove_tile(actor);

        // Announce we're leaving, for the handful of tiles that care about it.  Do so from the top
        // down, specifically so dynamite becomes lit before a lilypad tries to splash
        for (let l = original_cell.length - 1; l >= 0; l--) {
            let tile = original_cell[l];
            if (! tile)
                continue;
            if (tile === actor)
                continue;

            if (tile.type.on_depart) {
                tile.type.on_depart(tile, this, actor);
            }
        }

        // Announce we're approaching
        for (let tile of goal_cell) {
            if (! tile)
                continue;
            if (tile === actor)
                continue;

            if (tile.type.on_approach) {
                tile.type.on_approach(tile, this, actor);
            }
        }

        // If there's an animation in the way, this is our last chance to erase it.  Usually it gets
        // erased by on_bumped, but that's not always the case for e.g. pushing off a lilypad
        let blocking_actor = goal_cell.get_actor();
        if (blocking_actor) {
            if (blocking_actor.type.ttl) {
                this.remove_tile(blocking_actor);
            }
            else {
                // Uh oh.  This shouldn't happen.  Put them back??
                console.error("Actor", blocking_actor, "in the way of our movement", actor);
                this.add_tile(actor, original_cell);
                return;
            }
        }
        this.add_tile(actor, goal_cell);

        if (this.compat.actors_move_instantly) {
            this.step_on_cell(actor, actor.cell);
        }
    }

    // Step on every tile in a cell we just arrived in
    step_on_cell(actor, cell) {
        if (actor.type.on_finishing_move) {
            actor.type.on_finishing_move(actor, this);
        }

        // Step on topmost things first -- notably, it's safe to step on water with flippers on top
        // TODO is there a custom order here similar to collision checking?
        for (let layer = LAYERS.MAX - 1; layer >= 0; layer--) {
            let tile = cell[layer];
            if (! tile)
                continue;
            if (tile === actor)
                continue;

            if (tile.type.teleport_dest_order) {
                // This is used by an extra pass just after our caller, so it doesn't need to undo.
                // It DOES need to happen before items, though, or yellow teleporters never work!
                actor.just_stepped_on_teleporter = tile;
            }
            else if (tile.type.item_priority !== undefined) {
                // Possibly try to pick items up
                // TODO maybe this should be a method
                let mod = cell.get_item_mod();
                let try_pickup = (
                    tile.type.item_priority >= actor.type.item_pickup_priority ||
                    (mod && mod.type.item_modifier === 'pickup'));
                if (this.compat.monsters_ignore_keys && tile.type.is_key && actor.type.is_monster) {
                    // MS: Monsters never try to pick up keys
                    try_pickup = false;
                }
                if (try_pickup && this.attempt_take(actor, tile)) {
                    if (tile.type.is_key) {
                        this.sfx.play_once('get-key', cell);
                    }
                    else if (tile.type.is_item) {
                        this.sfx.play_once('get-tool', cell);
                    }
                    continue;
                }
            }
            else if (tile.type.on_arrive) {
                // It seems that CC2's recursive push prevention is a little more zealous than mine:
                // a block that's just now pressing a clone machine button cannot be pushed by the
                // output of that clone machine
                // TODO just hoist this to the right place so you don't have to do it in multiple
                // places?
                actor._being_pushed = true;
                tile.type.on_arrive(tile, this, actor);
                actor._being_pushed = false;
            }

            // XXX this does seem to be correct by CC2 rules, but it's very weird -- this will
            // usually happen anyway during the actor's idle phase.  it also requires random force
            // floors to have a clumsy check that you aren't already about to slide
            // TODO maybe don't do this for lynx?  i don't really grok the implications
            if (tile.type.on_stand) {
                tile.type.on_stand(tile, this, actor, true);
            }
        }
    }

    attempt_teleport(actor) {
        let teleporter = actor.just_stepped_on_teleporter;
        delete actor.just_stepped_on_teleporter;

        // We're about to abruptly move the actor, and the renderer needs to know to interpolate its
        // movement towards the teleporter it just stepped on, not the teleporter it's moved to
        this.set_tile_prop(actor, 'destination_cell', actor.cell);

        // Lynx teleporting has a serious bug, at least according to Tile World.  Cells remember
        // whether they contain an actor (other than the player) with just a flag, and the actor
        // list is otherwise separate.  As an actor tries to teleport, it physically moves between
        // each candidate exit teleporter, and if it can't leave that teleporter, it'll move to the
        // next one.  But it doesn't check whether the teleporter is already occupied, *and* if it
        // can't exit, it clears the cell's "occupied" flag when it departs for the next candidate,
        // even if the cell already contained an actor!  This mostly only comes up when teleporters
        // are blocked, or when two actors enter teleporters at the same time, but the upshot is
        // that an arbitrary number of monsters can occupy a single teleporter.
        // The "actor" flag is also used for non-player collision, so an occupied-but-unflagged
        // teleporter mostly acts empty, EXCEPT that the player can still push blocks out of it.
        // The effect is contained to just the teleporter tile, since taking a step out of the
        // teleporter will flag the monster's new cell as normal...  but it can linger between tics.
        // We simulate this with an `is_detached` flag on actors, which allows an actor to have a
        // .cell property without actually being in the cell's actor layer.
        // Yes this comment is very long but it's complicated.  See `teleportcreature` in lxlogic.c.
        // Classic example: https://www.youtube.com/watch?v=eKoKZwFj3rM
        // Level: https://c.eev.ee/lexys-labyrinth/#level=eJxzdjbyZWJgYDBnCPEM8eEHskrzSjJLclJTFHJSy1JzGPwDQvwkgcK4AJOff4grI4gV4Ojs7QikxVmYFRQY_zMub2AVZ2IUZGpn-58y-z8jU8tcRvHWFbNUWEQE7cXmHm11m_uMU5KhAqTVxfLM__8-_0__B4L-_65-LgpgEwFLDyYv
        // TODO put that in a lynx testcases file maybe
        // FIXME the player can't push blocks out once they become detached.  can i fudge this with
        // an intermediate flag that makes everything but players ignore it??  whoof
        let may_stack = this.compat.simulate_teleport_stacking && teleporter.type.name === 'teleport_blue';

        let dest, direction, success;
        for ([dest, direction] of teleporter.type.teleport_dest_order(teleporter, this, actor)) {
            // Teleporters already containing an actor are blocked and unusable
            let clog = dest.cell.get_actor();
            if (dest !== teleporter && clog) {
                if (may_stack) {
                    // Lynx: detach any non-player actor here...
                    if (! actor.type.is_real_player) {
                        this.detach_actor(clog);
                    }
                    // ...and move on, except that other actors *can* teleport onto the player,
                    // because the player's cell isn't considered occupied
                    if (! clog.type.is_real_player)
                        continue;
                }
                else {
                    continue;
                }
            }

            if (dest === teleporter &&
                teleporter.type.item_priority !== undefined &&
                teleporter.type.item_priority >= actor.type.item_pickup_priority &&
                this.allow_taking_yellow_teleporters)
            {
                // Super duper special yellow teleporter failure behavior: you pick it the fuck up
                if (this.attempt_take(actor, teleporter)) {
                    if (actor === this.player) {
                        this.sfx.play_once('get-tool', teleporter.cell);
                    }
                    return;
                }
            }

            // Note that this uses 'bump' even for players; it would be very bad if we could
            // initiate movement in this pass (in Lexy rules, anyway), because we might try to push
            // something that's still waiting to teleport itself!
            if (this.check_movement(actor, dest.cell, direction, 'bump')) {
                success = true;
                break;
            }
        }

        // Teleport slides happen when coming out of a teleporter, but not other times when standing
        // on a teleporter, so they need to be performed explicitly here.
        // Inactive red teleporters also have a slightly different kind of slide that lingers like
        // ice or force floors, so they get a different slide mode
        // TODO is this set by a teleporter's on_arrive, maybe...?
        if (teleporter.type.name === 'teleport_red' && ! teleporter.is_active) {
            this.schedule_actor_slide(actor, 'teleport-forever');
        }
        else {
            this.schedule_actor_slide(actor, teleporter.type.slide_mode);
        }

        this.set_actor_direction(actor, direction);

        if (success) {
            // The player's position changes while the sound is playing, so play it BOTH from the
            // origin and the destination (unless they're the same)
            this.sfx.play_once('teleport', teleporter.cell);
            if (dest.cell !== teleporter.cell) {
                this.sfx.play_once('teleport', dest.cell);
            }

            this.spawn_animation(actor.cell, 'teleport_flash');
            if (dest.cell !== actor.cell) {
                this.spawn_animation(dest.cell, 'teleport_flash');
            }

            // Now physically move the actor, but their movement waits until next decision phase
            this.remove_tile(actor);
            let clog = dest.cell.get_actor();
            if (may_stack && clog) {
                // Lynx: To avoid erasing the existing actor, set the /traveller/ as detached.  This
                // isn't quite right, but it's extremely likely to be cleared next tic when we move,
                // and it smooths out Lynx's odd special handling of the player.
                // (Might diverge if they become blocked before they get to move, though.)
                this.set_tile_prop(actor, 'is_detached', true);
                this.set_tile_prop(actor, 'cell', dest.cell);
            }
            else {
                // Normal behavior: just place them
                this.add_tile(actor, dest.cell);
            }

            // Erase this to prevent tail-biting through a teleport
            this.set_tile_prop(actor, 'previous_cell', null);
        }
    }

    remember_player_move(direction) {
        if (this.player.type.name === 'player') {
            this.player1_move = direction;
            this.player2_move = null;
        }
        else {
            this.player1_move = null;
            this.player2_move = direction;
        }
    }

    // Inventory handling -----------------------------------------------------------------------------

    cycle_inventory(actor) {
        if (this.stored_level.use_cc1_boots)
            return;
        if (actor.movement_cooldown > 0)
            return;

        // Cycle leftwards, i.e., the oldest item moves to the end of the list
        if (actor.toolbelt && actor.toolbelt.length > 1) {
            this._stash_toolbelt(actor);
            actor.toolbelt.push(actor.toolbelt.shift());
        }
    }

    drop_item(actor) {
        if (this.stored_level.use_cc1_boots)
            return false;
        if (actor.movement_cooldown > 0)
            return false;
        if (! actor.toolbelt || actor.toolbelt.length === 0)
            return false;

        // Drop the oldest item, i.e. the first one
        let name = actor.toolbelt[0];
        if (this._place_dropped_item(name, actor.cell, actor)) {
            this._stash_toolbelt(actor);
            actor.toolbelt.shift();
            this.recompute_traits(actor);
            return true;
        }
        return false;
    }

    // Attempt to place an item in the world, as though dropped by an actor
    _place_dropped_item(name, cell, dropping_actor) {
        let type = TILE_TYPES[name];
        if (type.layer === LAYERS.terrain) {
            // Terrain items (i.e., yellow teleports) can only be dropped on regular floor
            let terrain = cell.get_terrain();
            if (terrain.type.name !== 'floor')
                return false;

            this.transmute_tile(terrain, name);
        }
        else {
            // Note that we can't drop a bowling ball if there's already an item, even though a
            // dropped bowling ball is really an actor
            if (cell.get_item())
                return false;

            if (type.on_drop) {
                // FIXME quirky things happen if a dropped bowling ball can't enter the facing cell
                // (mostly it disappears) (also arguably a bug)
                // FIXME does this even need to be a function lol
                name = type.on_drop(this, cell);
                if (name === null) {
                    // The item disappears on drop, so there's nothing to do
                    return true;
                }

                type = TILE_TYPES[name];
            }
            let tile = new Tile(type);
            if (type.is_actor) {
                // This is tricky -- the item has become an actor, but whatever dropped it is
                // already in this cell's actor layer.  But we also know for sure that there's no
                // item in this cell, so we'll cheat a little: remove the dropping actor, set the
                // item moving, then put the dropping actor back before anyone notices.
                this.remove_tile(dropping_actor);
                this.add_tile(tile, cell);
                if (! this.attempt_out_of_turn_step(tile, dropping_actor.direction)) {
                    // It was unable to move; if it exploded, we have a special non-blocking VFX for
                    // that, but otherwise there's nothing we can do but erase it (as CC2 does)
                    if (tile.type.name === 'explosion') {
                        this.transmute_tile(tile, 'explosion_nb', true);
                    }
                    else {
                        this.remove_tile(tile);
                    }
                }
                if (tile.cell) {
                    this.add_actor(tile);
                }
                this.add_tile(dropping_actor, cell);
            }
            else {
                this.add_tile(tile, cell);
            }
        }

        return true;
    }

    // Wiring -----------------------------------------------------------------------------------------

    do_wire_phase() {
        if (this.recalculate_circuitry_next_wire_phase) {
            // This property doesn't tend to last beyond a single tic, but if we recalculate now, we
            // also need to recalculate if we undo beyond this point.  So set it as a level prop,
            // which after an undo, will then cause us to recalculate the next time we advance
            if (this.undo_enabled) {
                this.pending_undo.level_props.recalculate_circuitry_next_wire_phase = true;
                // Since we're about to invalidate a bunch of circuitry, be safe and store ALL the
                // power states
                this.pending_undo.circuit_power_changes = new Map(
                    this.circuits.map(circuit => [circuit, circuit.is_powered]));
            }

            this.recalculate_circuitry();
            this.recalculate_circuitry_next_wire_phase = false;
        }

        if (this.circuits.length === 0)
            return;

        for (let circuit of this.circuits) {
            circuit._was_powered = circuit.is_powered;
            circuit.is_powered = false;
        }

        // Update the state of any tiles that can generate power.  First, static power sources
        for (let tile of this.power_sources) {
            if (tile.type.update_power_emission) {
                tile.type.update_power_emission(tile, this);
            }
        }

        // Next, actors who are standing still, on floor/electrified, and holding a lightning bolt
        for (let actor of this.actors) {
            if (! actor.cell)
                continue;

            if (actor.movement_cooldown === 0 && (actor.traits & ACTOR_TRAITS.charged)) {
                let wired_tile = actor.cell.get_wired_tile();
                if (wired_tile && (wired_tile === actor || wired_tile.type.can_be_powered_by_actor)) {
                    for (let circuit of this.cells_to_circuits.get(this.cell_to_scalar(wired_tile.cell))) {
                        circuit.is_powered = true;
                    }
                }
            }
        }

        for (let tile of this.wired_outputs) {
            // This is only used within this function, no need to undo
            // TODO if this can overlap with power_sources then this is too late?
            tile._prev_powered_edges = tile.powered_edges;
        }

        // Go through every circuit and recompute whether it's powered
        let circuit_changes = this.pending_undo?.circuit_power_changes ?? new Map;
        for (let circuit of this.circuits) {
            if (! circuit.is_powered) {
                for (let [input_tile, edges] of circuit.inputs.entries()) {
                    if (input_tile.type.is_emitting && input_tile.type.is_emitting(input_tile, this, edges)) {
                        circuit.is_powered = true;
                        break;
                    }
                }
            }

            if (this.undo_enabled && circuit.is_powered !== circuit._was_powered &&
                ! circuit_changes.has(circuit))
            {
                circuit_changes.set(circuit, circuit._was_powered);
            }
        }

        this._apply_circuit_power_to_tiles();
        if (this.undo_enabled && circuit_changes.size > 0) {
            this.pending_undo.circuit_power_changes = circuit_changes;
        }

        // Finally, inform every tile of power changes, if any
        for (let tile of this.wired_outputs) {
            if (tile.powered_edges && ! tile._prev_powered_edges && tile.type.on_power) {
                tile.type.on_power(tile, this);
            }
            else if (! tile.powered_edges && tile._prev_powered_edges && tile.type.on_depower) {
                tile.type.on_depower(tile, this);
            }
        }
    }

    // Recompute which tiles (across the whole level) are powered, based on the power status of the
    // circuits.  NOT undo-safe; instead, changes to circuit power are undone, and then this is
    // called again to make everything consistent.  This also does NOT call on_power or on_depower;
    // any effects from those are done (and undone) by the caller.
    _apply_circuit_power_to_tiles() {
        for (let circuit of this.circuits) {
            for (let [tile, edges] of circuit.tiles.entries()) {
                if (circuit.is_powered) {
                    tile.powered_edges |= edges;
                }
                else {
                    tile.powered_edges &= ~edges;
                }
            }
        }
    }

    // Level inspection -------------------------------------------------------------------------------

    // FIXME require_stub should really just care whether we ourselves /can/ contain wire, and also
    // we should check that on our neighbor
    is_tile_wired(tile, require_stub = true) {
        for (let [direction, dirinfo] of Object.entries(DIRECTIONS)) {
            if (require_stub && (tile.wire_directions & dirinfo.bit) === 0)
                continue;

            let neighbor = this.get_neighboring_cell(tile.cell, direction);
            if (! neighbor)
                continue;

            let terrain = neighbor.get_terrain();
            if (terrain.type.name === 'logic_gate' &&
                terrain.type.get_wires(terrain).includes(dirinfo.opposite))
            {
                return true;
            }

            let wired = neighbor.get_wired_tile();
            if (! wired)
                continue;

            if ((wired.wire_propagation_mode ?? wired.type.wire_propagation_mode) === 'none' &&
                ! wired.type.update_power_emission)
            {
                // Being next to e.g. a red teleporter doesn't count (but pink button is ok)
                continue;
            }

            if ((wired.wire_directions & dirinfo.opposite_bit) &&
                ! (wired.wire_tunnel_directions & dirinfo.opposite_bit))
            {
                return true;
            }
        }
        return false;
    }

    // Undo/redo --------------------------------------------------------------------------------------

    has_undo() {
        return ! this.undo_buffer.is_empty;
    }

    commit() {
        if (! this.undo_enabled)
            return;

        // Any level props that haven't changed can be safely deleted
        for (let [key, prop] of Object.entries(this.pending_undo.level_props)) {
            if (prop === this[key]) {
                delete this.pending_undo.level_props[key];
            }
        }

        this.pending_undo.estimate_size();
        this.undo_buffer.push(this.pending_undo);
        this.pending_undo = new UndoEntry;
    }

    undo() {
        this.aid = Math.max(1, this.aid);

        // In turn-based mode, we might still be in mid-tic with a partial undo stack; do that first
        this._undo_entry(this.pending_undo);
        this.pending_undo = new UndoEntry;

        let entry = this.undo_buffer.pop();
        if (entry) {
            this._undo_entry(entry);
        }
    }

    // Reverse a single undo entry
    _undo_entry(entry) {
        if (! entry) {
            return;
        }

        // Undo in reverse order!  There's no redo, so it's okay to use the destructive reverse().
        // These toggles go first, since they're the last things to happen in a tic
        if (entry.toggle_green_tiles) {
            this._toggle_green_tiles();
        }
        if (entry.sokoban_changes) {
            Object.assign(this.sokoban_unpressed, entry.sokoban_changes);
            this._check_sokoban_buttons();
        }

        entry.actor_splices.reverse();
        for (let args of entry.actor_splices) {
            this.actors.splice(...args);
        }

        let needs_readding = [];
        for (let [tile, changes] of entry.tile_changes) {
            // If a tile's cell or layer changed, it needs to be removed and then added -- but to
            // avoid ordering problems when a tile leaves a cell and a different tile enters that
            // cell on the same tic, we can't add back any tiles until they've all been removed
            //let do_cell_dance = (Object.hasOwn(changes, 'cell') || (
            //    Object.hasOwn(changes, 'type') && tile.type.layer !== changes.type.layer));
            // Fucking Safari
            let do_cell_dance = (Object.prototype.hasOwnProperty.call(changes, 'cell') || (
                Object.prototype.hasOwnProperty.call(changes, 'type') && tile.type.layer !== changes.type.layer));
            if (do_cell_dance && tile.cell && ! tile.is_detached) {
                tile.cell._remove(tile);
            }
            Object.assign(tile, changes);
            if (do_cell_dance && tile.cell && ! tile.is_detached) {
                needs_readding.push(tile);
            }
        }
        for (let tile of needs_readding) {
            tile.cell._add(tile);
        }

        if (entry.circuit_power_changes) {
            for (let [circuit, is_powered] of entry.circuit_power_changes.entries()) {
                circuit.is_powered = is_powered;
            }
            // FIXME ah the power state doesn't undo correctly because the circuits are different
            this._apply_circuit_power_to_tiles();
        }

        for (let [key, value] of Object.entries(entry.level_props)) {
            this[key] = value;
        }
    }

    // Level alteration -------------------------------------------------------------------------------
    // EVERYTHING that changes the state of a level, including the state of a single tile, should do
    // it through one of these for undo/rewind purposes

    set_tile_prop(tile, key, val) {
        if (Number.isNaN(val))
            throw new Error(`got a NaN for ${key} on ${tile.type.name} at ${tile.cell.x}, ${tile.cell.y}`);
        if (! this.undo_enabled) {
            tile[key] = val;
            return;
        }
        if (tile[key] === val)
            return;

        let changes = this.pending_undo.tile_changes_for(tile);

        // If we haven't yet done so, log the original value
        //if (! Object.hasOwn(changes, key)) {
        // Fucking Safari
        if (! Object.prototype.hasOwnProperty.call(changes, key)) {
            changes[key] = tile[key];
        }
        // If there's an original value already logged, and it's the value we're about to change
        // back to, then delete the change
        else if (changes[key] === val) {
            delete changes[key];
        }

        tile[key] = val;
    }

    _stash_toolbelt(actor) {
        if (! this.undo_enabled)
            return;

        let changes = this.pending_undo.tile_changes_for(actor);
        if (! ('toolbelt' in changes)) {
            changes.toolbelt = Array.from(actor.toolbelt);
        }
    }

    _stash_keyring(actor) {
        if (! this.undo_enabled)
            return;

        let changes = this.pending_undo.tile_changes_for(actor);
        if (! ('keyring' in changes)) {
            changes.keyring = {...actor.keyring};
        }
    }

    collect_chip(actor) {
        if (this.chips_remaining > 0) {
            if (this.chips_remaining > 1) {
                this.sfx.play_once('get-chip', actor.cell);
            }
            else {
                this.sfx.play_once('get-chip-last', actor.cell);
            }
            this.chips_remaining -= 1;
        }
        else {
            this.sfx.play_once('get-chip-extra', actor.cell);
        }
    }

    uncollect_chip(actor) {
        this.chips_remaining += 1;
        // TODO sfx
    }

    adjust_bonus(add, mult = 1) {
        this.bonus_points = Math.floor(this.bonus_points * mult) + add;
    }

    pause_timer() {
        if (this.time_remaining === null)
            return false;

        this.timer_paused = ! this.timer_paused;
        return true;
    }

    adjust_timer(dt) {
        // Untimed levels become timed levels with 0 seconds remaining
        this.time_remaining = Math.max(0, (this.time_remaining ?? 0) + dt * 20);
        if (this.time_remaining <= 0) {
            // If the timer isn't paused, this will kill the player at the end of the tic
            this.time_remaining = 1;
        }
    }

    do_gray_button(origin) {
        for (let x = Math.max(0, origin.x - 2); x <= Math.min(this.width - 1, origin.x + 2); x++) {
            for (let y = Math.max(0, origin.y - 2); y <= Math.min(this.height - 1, origin.y + 2); y++) {
                let cell = this.cell(x, y);
                for (let tile of cell) {
                    if (tile && tile.type.on_gray_button) {
                        tile.type.on_gray_button(tile, this);
                    }
                }
            }
        }
    }

    press_sokoban(color) {
        if (this.undo_enabled) {
            this.pending_undo.preserve_sokoban(color, this.sokoban_unpressed[color]);
        }

        this.sokoban_unpressed[color] -= 1;
    }

    unpress_sokoban(color) {
        if (this.undo_enabled) {
            this.pending_undo.preserve_sokoban(color, this.sokoban_unpressed[color]);
        }

        this.sokoban_unpressed[color] += 1;
    }

    kill_actor(actor, killer, animation_name = null, sfx = null, fail_reason = null) {
        if (actor.type.is_real_player) {
            // Resurrect using the ankh tile, if possible
            if (this.ankh_tile) {
                let ankh_cell = this.ankh_tile.cell;
                let existing_actor = ankh_cell.get_actor();
                if (! existing_actor) {
                    this.sfx.play_once('revive');

                    let cell = actor.cell;
                    this.set_tile_prop(actor, 'movement_cooldown', null);
                    this.set_tile_prop(actor, 'movement_speed', null);
                    this.set_tile_prop(actor, 'pending_slide_mode', null);
                    this.set_tile_prop(actor, 'current_slide_mode', null);
                    this.move_to(actor, ankh_cell);

                    if (sfx) {
                        this.sfx.play_once(sfx, cell);
                    }
                    // Have to do this after moving the player, or there's no room for the animation
                    if (animation_name) {
                        this.spawn_animation(cell, animation_name);
                    }

                    this.transmute_tile(this.ankh_tile, 'floor');
                    this.spawn_animation(ankh_cell, 'resurrection');
                    this.ankh_tile = null;
                    return;
                }
            }

            // Otherwise, lose the game
            this.fail(fail_reason || killer.type.name, killer, actor);
            return;
        }

        // Only used for glass block atm
        if (actor.type.on_death) {
            actor.type.on_death(actor, this);
        }

        if (sfx) {
            this.sfx.play_once(sfx, actor.cell);
        }
        if (animation_name) {
            this.transmute_tile(actor, animation_name);
        }
        else {
            this.remove_tile(actor);
        }
    }

    fail(reason, killer = null, player = null) {
        if (this.state !== 'playing')
            return;

        if (player === null) {
            player = this.player;
        }

        if (reason === 'time') {
            this.sfx.play_once('timeup');
        }
        else {
            this.sfx.play_once('lose');
        }

        this.state = 'failure';
        this.fail_reason = reason;
        if (player) {
            this.set_tile_prop(player, 'fail_reason', reason);
        }
        if (killer) {
            this.set_tile_prop(killer, 'is_killer', true);
        }
    }

    win() {
        if (this.state !== 'playing')
            return;

        this.sfx.play_once('win');
        this.state = 'success';
        this.set_tile_prop(this.player, 'exited', true);
    }

    get_scorecard() {
        if (this.state !== 'success') {
            return null;
        }

        // FIXME should probably remember tics here, not just seconds?
        let time = Math.ceil((this.time_remaining ?? 0) / TICS_PER_SECOND);
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
        if (this.compat.rff_actually_random) {
            return DIRECTION_ORDER[this.prng() % 4];
        }

        let d = this.force_floor_direction;
        this.force_floor_direction = DIRECTIONS[d].right;
        return d;
    }

    // Tile stuff in particular

    remove_tile(tile) {
        // Detached tiles aren't in the cell in the first place, so they don't need to be removed
        if (tile.is_detached) {
            this.set_tile_prop(tile, 'is_detached', false);
        }
        else {
            tile.cell._remove(tile);
        }
        this.set_tile_prop(tile, 'cell', null);
    }

    add_tile(tile, cell) {
        this.set_tile_prop(tile, 'cell', cell);
        cell._add(tile);
    }

    detach_actor(actor) {
        // FIXME draw detached actors; i guess this would need a sub-array on Cell eugh?  unless the
        // renderer just reads the actor list, but that seems, dubious
        this.set_tile_prop(actor, 'is_detached', true);
        actor.cell[LAYERS.actor] = null;
    }

    make_actor(type, direction = 'south') {
        return new Tile(type, direction);
    }

    add_actor(actor) {
        if (this.compat.actors_move_instantly) {
            actor.moves_instantly = true;
        }

        if (this.compat.reuse_actor_slots && actor.type.layer !== LAYERS.vfx) {
            // Lynx: New actors go in the first available "dead" slot.  VFX are exempt, since those
            // are LL additions and shouldn't affect gameplay
            for (let i = 0, l = this.actors.length; i < l; i++) {
                let old_actor = this.actors[i];
                if (old_actor !== this.player && ! old_actor.cell) {
                    this.actors[i] = actor;
                    if (this.undo_enabled) {
                        this.pending_undo.actor_splices.push([i, 1, old_actor]);
                    }
                    return;
                }
            }
        }

        this.actors.push(actor);
        if (this.undo_enabled) {
            this.pending_undo.actor_splices.push([this.actors.length - 1, 1]);
        }
    }

    _init_animation(tile) {
        // Co-opt movement_cooldown/speed for these despite that they aren't moving, since those
        // properties are also used to animate everything else anyway.  Decrement the cooldown
        // immediately, as Lynx does; note that Lynx also ticks /and destroys/ animations early in
        // the decision phase, but this seems to work out just as well
        let duration = tile.type.ttl;
        if (this.compat.force_lynx_animation_lengths) {
            // Lynx animation duration is 12 tics, but it drops one if necessary to make the
            // animation end on an odd tic (???) and that takes step parity into account
            // because I guess it uses the global clock (?????????????????).  Also, unlike CC2, Lynx
            // animations are removed once their cooldown goes BELOW zero, so to simulate that we
            // make the animation one tic longer.
            // XXX wait am i sure that cc2 doesn't work that way too?
            duration = (12 + (this.tic_counter + this.step_parity) % 2) * 3;
        }
        this.set_tile_prop(tile, 'movement_speed', duration);
        this.set_tile_prop(tile, 'movement_cooldown', duration);
        this.do_extra_cooldown(tile);
    }

    spawn_animation(cell, name) {
        let type = TILE_TYPES[name];
        // Spawned VFX silently erase any existing VFX
        if (type.layer === LAYERS.vfx) {
            let vfx = cell[type.layer];
            if (vfx) {
                this.remove_tile(vfx);
            }
        }
        let tile = new Tile(type);
        this._init_animation(tile);
        // Note that newly-spawned animations don't have their cooldown decremented right away, and
        // in the case of lilypads, this has gameplay implications.  I can't just not tick them down
        // or the renderer will break, so cheat by extending the duration by a tic
        this.set_tile_prop(tile, 'movement_speed', tile.movement_speed + 3);
        this.set_tile_prop(tile, 'movement_cooldown', tile.movement_cooldown + 3);
        this.add_tile(tile, cell);
        this.add_actor(tile);
    }

    transmute_tile(tile, name, force = false) {
        if (tile.type.ttl && ! force) {
            // If this is already an animation, don't turn it into a different one; this can happen
            // if a block is pushed onto a cell containing both a mine and slime, both of which try
            // to destroy it
            return;
        }

        // Only used for electrified floor atm
        if (tile.type.on_death && !tile.type.is_actor) {
            tile.type.on_death(tile, this);
        }

        let old_type = tile.type;
        let new_type = TILE_TYPES[name];
        if (old_type.layer !== new_type.layer) {
            // Move it to the right layer!
            // (No need to handle undo specially here; undoing the 'type' prop automatically does
            // this same remove/add dance)
            if (tile.cell[new_type.layer] && new_type.layer === LAYERS.vfx) {
                this.remove_tile(tile.cell[new_type.layer]);
            }
            tile.cell._remove(tile);
            this.set_tile_prop(tile, 'type', new_type);
            tile.cell._add(tile);
        }
        else {
            this.set_tile_prop(tile, 'type', new_type);
        }

        if (old_type.is_actor || new_type.is_actor) {
            this.recompute_traits(tile);
        }

        // For transmuting into an animation, set up the timer immediately
        if (tile.type.ttl) {
            // FIXME should be able to keep the position here while still animating
            if (! old_type.is_actor) {
                console.warn("Transmuting a non-actor into an animation!");
            }
            // This is effectively a completely new object, so remove double cooldown prevention;
            // the initial cooldown MUST happen, because the renderer can't handle cooldown == speed
            if (tile.last_extra_cooldown_tic) {
                this.set_tile_prop(tile, 'last_extra_cooldown_tic', null);
            }
            this._init_animation(tile);
            this.set_tile_prop(tile, 'previous_cell', null);
            this.set_tile_prop(tile, 'pending_slide_mode', null);
            this.set_tile_prop(tile, 'current_slide_mode', null);
        }
    }

    // Have an actor try to pick up a particular tile; it's prevented if there's a no sign, and the
    // tile is removed if successful
    // FIXME do not allow overflow dropping before picking up the new item
    attempt_take(actor, tile) {
        let cell = tile.cell;
        let mod = cell.get_item_mod();
        if (mod && mod.type.item_modifier === 'ignore')
            return false;

        // Some faux items have custom pickup behavior, e.g. chips and bonuses
        if (tile.type.on_pickup) {
            if (tile.type.on_pickup(tile, this, actor)) {
                this.remove_tile(tile);
                return true;
            }
            else {
                return false;
            }
        }

        // Handling a full inventory is a teeny bit complicated.  We want the following:
        // - At no point are two items in the same cell
        // - A yellow teleporter cannot be dropped in exchange for another yellow teleporter
        // - If the oldest item can't be dropped, the pickup fails
        // Thus we have to check whether dropping is possible FIRST, but only place the dropped item
        // AFTER the pickup.
        let dropped_item;
        if (! tile.type.is_key && ! this.stored_level.use_cc1_boots &&
            actor.toolbelt && actor.toolbelt.length >= 4)
        {
            let oldest_item_type = TILE_TYPES[actor.toolbelt[0]];
            if (oldest_item_type.layer === LAYERS.terrain && cell.get_terrain().type.name !== 'floor') {
                // This is a yellow teleporter, and we are not standing on floor; abort!
                return false;
            }
            // Otherwise, it's either an item or a yellow teleporter we're allowed to drop, so steal
            // it out of their inventory to be dropped later
            this._stash_toolbelt(actor);
            dropped_item = actor.toolbelt.shift();
            this.recompute_traits(actor);
        }

        if (this.give_actor(actor, tile.type.name)) {
            if (tile.type.layer === LAYERS.terrain) {
                // This should only happen for the yellow teleporter
                this.transmute_tile(tile, 'floor');
            }
            else {
                this.remove_tile(tile);
            }
            if (mod && mod.type.item_modifier === 'pickup') {
                this.remove_tile(mod);
            }

            // Drop any overflowed item
            if (dropped_item) {
                // TODO what if this fails??
                this._place_dropped_item(dropped_item, cell, actor);
            }

            return true;
        }
        // TODO what happens to the dropped item if the give fails somehow?
        return false;
    }

    // Give an item to an actor, even if it's not supposed to have an inventory
    give_actor(actor, name) {
        if (! actor.type.is_actor)
            return false;

        let type = TILE_TYPES[name];
        if (type.is_key) {
            if (! actor.keyring) {
                actor.keyring = {};
            }
            this._stash_keyring(actor);
            actor.keyring[name] = (actor.keyring[name] ?? 0) + 1;

            if (this.compat.keys_overflow_at_256) {
                // CC2 + Lynx: Key counts are stored in a u8 and overflow because C
                actor.keyring[name] %= 256;
            }
        }
        else {
            // tool, presumably
            if (! actor.toolbelt) {
                actor.toolbelt = [];
            }

            if (this.stored_level.use_cc1_boots) {
                // CC1's boot inventory is different; it has fixed slots, and duplicate items are
                // silently ignored.  CC2 items cannot be picked up.
                let i = CC1_INVENTORY_ORDER.indexOf(name);
                if (i < 0)
                    return false;

                this._stash_toolbelt(actor);
                actor.toolbelt[i] = name;
            }
            else {
                // "Normal" (CC2) inventory mode.
                // Nothing can hold more than four items, so try to drop one first.  Note that
                // normally, this should already have happened in attempt_take, so this should only
                // come up when forcibly given an item via debug tools
                if (actor.toolbelt.length >= 4) {
                    if (! this.drop_item(actor))
                        return false;
                }

                this._stash_toolbelt(actor);
                actor.toolbelt.push(name);
            }

            if (type.item_traits) {
                this.set_tile_prop(actor, 'traits', actor.traits | type.item_traits);
            }
        }
        return true;
    }

    take_key_from_actor(actor, name, ignore_infinity = false) {
        if (actor.keyring && (actor.keyring[name] ?? 0) > 0) {
            if (!ignore_infinity && actor.type.infinite_items && actor.type.infinite_items[name]) {
                // Some items can't be taken away normally, by which I mean, green or yellow keys
                return true;
            }

            this._stash_keyring(actor);
            actor.keyring[name] -= 1;
            return true;
        }

        return false;
    }

    // Note that this doesn't support CC1 mode, but only CC2 and LL tools are individually taken
    take_tool_from_actor(actor, name) {
        if (actor.toolbelt) {
            let index = actor.toolbelt.indexOf(name);
            if (index >= 0) {
                this._stash_toolbelt(actor);
                actor.toolbelt.splice(index, 1);
                this.recompute_traits(actor);
                return true;
            }
        }

        return false;
    }

    take_all_keys_from_actor(actor) {
        if (actor.keyring && Object.values(actor.keyring).some(n => n > 0)) {
            this._stash_keyring(actor);
            actor.keyring = {};
            return true;
        }
    }

    take_all_tools_from_actor(actor) {
        if (actor.toolbelt && actor.toolbelt.length > 0) {
            this._stash_toolbelt(actor);
            actor.toolbelt = [];
            this.recompute_traits(actor);
            return true;
        }
    }

    recompute_traits(actor) {
        this.set_tile_prop(actor, 'traits', actor.compute_traits());
    }

    // Change an actor's direction
    set_actor_direction(actor, direction) {
        this.set_tile_prop(actor, 'direction', direction);
    }

    schedule_actor_slide(actor, mode, direction = null) {
        if (direction) {
            this.set_actor_direction(actor, direction);
        }
        this.set_tile_prop(actor, 'pending_slide_mode', mode);
    }
}
