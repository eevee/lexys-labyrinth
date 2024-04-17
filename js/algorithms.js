import { DIRECTIONS } from './defs.js';

export function trace_floor_circuit(level, start_cell, start_edge, on_wire, on_dead_end) {
    let is_first = true;
    let pending = [[start_cell, start_edge]];
    let seen_cells = new Map;
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
                actor.movement_cooldown === 0 || level.compat.tiles_react_instantly))
            {
                tile = actor;
            }

            // The wire comes in from this edge towards the center; see how it connects within this
            // cell, then check for any neighbors
            let connections = edgeinfo.bit;
            let mode = tile.wire_propagation_mode ?? tile.type.wire_propagation_mode;
            if (! is_first && ((tile.wire_directions ?? 0) & edgeinfo.bit) === 0) {
                // There's not actually a wire here (but not if this is our starting cell, in which
                // case we trust the caller)
                if (on_dead_end) {
                    on_dead_end(cell, edge);
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

            if (on_wire) {
                on_wire(tile, connections);
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
                    neighbor = find_matching_wire_tunnel(level, cell.x, cell.y, direction);
                }
                else {
                    neighbor = level.get_neighboring_cell(cell, direction);
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
}

export function find_matching_wire_tunnel(level, x, y, direction) {
    let dirinfo = DIRECTIONS[direction];
    let [dx, dy] = dirinfo.movement;
    let nesting = 0;
    while (true) {
        x += dx;
        y += dy;
        let candidate = level.cell(x, y);
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

// TODO make this guy work generically for orange, red, brown buttons?  others...?
export function find_implicit_connection() {
}

// Iterates over a grid in a diamond pattern, spreading out from the given start cell (but not
// including it).  Only used for connecting orange buttons.
export function* iter_cells_in_diamond(levelish, x0, y0) {
    let max_search_radius = Math.max(levelish.size_x, levelish.size_y) + 1;
    for (let dist = 1; dist <= max_search_radius; dist++) {
        // Start east and move counterclockwise
        let sx = x0 + dist;
        let sy = y0;
        for (let direction of [[-1, -1], [-1, 1], [1, 1], [1, -1]]) {
            for (let i = 0; i < dist; i++) {
                let cell = levelish.cell(sx, sy);
                if (cell) {
                    yield cell;
                }
                sx += direction[0];
                sy += direction[1];
            }
        }
    }
}
