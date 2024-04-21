import { DIRECTIONS, LAYERS } from './defs.js';

// Iterates over every terrain tile in the grid that has one of the given types (a Set of type
// names), in linear order, optionally in reverse.  The starting cell is checked last.
// Yields [tile, cell].
export function* find_terrain_linear(levelish, start_cell, type_names, reverse = false) {
    let i = levelish.coords_to_scalar(start_cell.x, start_cell.y);
    while (true) {
        if (reverse) {
            i -= 1;
            if (i < 0) {
                i += levelish.size_x * levelish.size_y;
            }
        }
        else {
            i += 1;
            i %= levelish.size_x * levelish.size_y;
        }

        let cell = levelish.linear_cells[i];
        let tile = cell[LAYERS.terrain];
        if (tile && type_names.has(tile.type.name)) {
            yield [tile, cell];
        }

        if (cell === start_cell)
            return;
    }
}

// Iterates over every terrain tile in the grid that has one of the given types (a Set of type
// names), spreading outward in a diamond pattern.  The starting cell is not included.
// Only used by orange buttons.
// Yields [tile, cell].
export function* find_terrain_diamond(levelish, start_cell, type_names) {
    let max_search_radius = (
        Math.max(start_cell.x, levelish.size_x - start_cell.x) +
        Math.max(start_cell.y, levelish.size_y - start_cell.y));
    for (let dist = 1; dist <= max_search_radius; dist++) {
        // Start east and move counterclockwise
        let sx = start_cell.x + dist;
        let sy = start_cell.y;
        for (let direction of [[-1, -1], [-1, 1], [1, 1], [1, -1]]) {
            for (let i = 0; i < dist; i++) {
                let cell = levelish.cell(sx, sy);
                sx += direction[0];
                sy += direction[1];

                if (! cell)
                    continue;
                let terrain = cell[LAYERS.terrain];
                if (type_names.has(terrain.type.name)) {
                    yield [terrain, cell];
                }
            }
        }
    }
}

// TODO make this guy work generically for orange, red, brown buttons?  others...?
export function find_implicit_connection() {
}

export class Circuit {
    constructor() {
        this.is_powered = null;
        this.tiles = new Map;
        this.inputs = new Map;
    }

    add_tile_edge(tile, edgebits) {
        this.tiles.set(tile, (this.tiles.get(tile) ?? 0) | edgebits);
    }

    add_input_edge(tile, edgebits) {
        this.inputs.set(tile, (this.inputs.get(tile) ?? 0) | edgebits);
    }
}

// Traces a wire circuit and calls the given callbacks when finding either a new wire or an ending.
// actor_mode describes how to handle circuit blocks:
// - still: Actor wires are examined only for actors with a zero cooldown.  (Normal behavior.)
// - always: Actor wires are always examined.  (compat.tiles_react_instantly behavior.)
// - ignore: Skip actors entirely.  (Editor behavior.)
// Returns a Circuit.
export function trace_floor_circuit(levelish, actor_mode, start_cell, start_edge, on_wire, on_dead_end) {
    let is_first = true;
    let pending = [[start_cell, start_edge]];
    let seen_cells = new Map;
    let circuit = new Circuit;
    while (pending.length > 0) {
        let next = [];
        for (let [cell, edge] of pending) {
            let terrain = cell.get_terrain();
            if (! terrain)
                continue;

            let edgeinfo = DIRECTIONS[edge];
            let seen_edges = seen_cells.get(cell) ?? 0;
            if (seen_edges & edgeinfo.bit)
                continue;

            let tile = terrain;
            let actor = cell.get_actor();
            if (actor && actor.type.contains_wire && (
                (actor_mode === 'still' && actor.movement_cooldown === 0) || actor_mode === 'always'))
            {
                tile = actor;
            }

            // The wire comes in from this edge towards the center; see how it connects within this
            // cell, then check for any neighbors
            let connections = edgeinfo.bit;
            let mode = tile.wire_propagation_mode ?? tile.type.wire_propagation_mode;
            if (! is_first && ((tile.wire_directions ?? 0) & edgeinfo.bit) === 0) {
                // There's not actually a wire here, so check for things that respond to receiving
                // power...  but if this is the starting cell, we trust the caller and skip it (XXX why)
                for (let tile2 of cell) {
                    if (! tile2)
                        continue;

                    if (tile2.type.name === 'logic_gate') {
                        // Logic gates are technically not wired, but still attached to
                        // circuits, mostly so blue teleporters can follow them
                        let wire = tile2.type._gate_types[tile2.gate_type][
                            (DIRECTIONS[edge].index - DIRECTIONS[tile2.direction].index + 4) % 4];
                        if (! wire)
                            continue;
                        circuit.add_tile_edge(tile2, DIRECTIONS[edge].bit);
                        if (wire.match(/^out/)) {
                            circuit.add_input_edge(tile2, DIRECTIONS[edge].bit);
                        }
                    }
                    else if (tile2.type.on_power) {
                        circuit.add_tile_edge(tile2, DIRECTIONS[edge].bit);
                    }
                }
                continue;
            }
            else if (mode === 'none') {
                // The wires in this tile never connect to each other
            }
            else if (mode === 'cross' || (mode === 'autocross' && tile.wire_directions === 0x0f)) {
                // This is a cross pattern, so only opposite edges connect
                if (tile.wire_directions & edgeinfo.opposite_bit) {
                    connections |= edgeinfo.opposite_bit;
                }
            }
            else {
                // Everything connects
                connections |= tile.wire_directions;
            }

            seen_cells.set(cell, seen_edges | connections);

            circuit.add_tile_edge(tile, connections);

            if (tile.type.is_power_source) {
                // TODO could just do this in a pass afterwards?
                circuit.add_input_edge(tile, connections);
            }

            for (let [direction, dirinfo] of Object.entries(DIRECTIONS)) {
                // Obviously don't go backwards, but that doesn't apply if this is our first pass
                if (direction === edge && ! is_first)
                    continue;

                if ((connections & dirinfo.bit) === 0)
                    continue;

                let neighbor;
                if ((terrain.wire_tunnel_directions ?? 0) & dirinfo.bit) {
                    // Search in this direction for a matching tunnel
                    // Note that while actors (the fuckin circuit block) can be wired, tunnels ONLY
                    // appear on terrain, and are NOT affected by actors on top
                    neighbor = find_matching_wire_tunnel(levelish, cell.x, cell.y, direction);
                }
                else {
                    neighbor = levelish.get_neighboring_cell(cell, direction);
                }

                /*
                if (! neighbor || (((neighbor.get_terrain().wire_directions ?? 0) & dirinfo.opposite_bit) === 0)) {
                    console.log("bailing here", neighbor, direction);
                    continue;
                }
                */
                if (! neighbor)
                    continue;

                next.push([neighbor, dirinfo.opposite]);
            }
        }
        pending = next;
        is_first = false;
    }

    return circuit;
}

export function find_matching_wire_tunnel(levelish, x, y, direction) {
    let dirinfo = DIRECTIONS[direction];
    let [dx, dy] = dirinfo.movement;
    let nesting = 0;
    while (true) {
        x += dx;
        y += dy;
        let candidate = levelish.cell(x, y);
        if (! candidate)
            return null;

        let neighbor = candidate.get_terrain();
        if (! neighbor)
            continue;

        if ((neighbor.wire_tunnel_directions ?? 0) & dirinfo.opposite_bit) {
            if (nesting === 0) {
                return candidate;
            }
            else {
                nesting -= 1;
            }
        }
        if ((neighbor.wire_tunnel_directions ?? 0) & dirinfo.bit) {
            nesting += 1;
        }
    }
}
