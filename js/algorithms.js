import { DIRECTIONS, DIRECTION_ORDER } from './defs.js';

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
                
            let actor = cell.get_actor();
            let wire_directions = terrain.wire_directions;
            if ((actor?.wire_directions ?? null !== null) && (actor.movement_cooldown === 0 || level.compat.tiles_react_instantly))
            {
                wire_directions = actor.wire_directions;
            }

            // The wire comes in from this edge towards the center; see how it connects within this
            // cell, then check for any neighbors
            let connections = edgeinfo.bit;
            if (! is_first && ((wire_directions ?? 0) & edgeinfo.bit) === 0) {
                // There's not actually a wire here (but not if this is our starting cell, in which
                // case we trust the caller)
                if (on_dead_end) {
                    on_dead_end(terrain.cell, edge);
                }
                continue;
            }
            else if (terrain.type.wire_propagation_mode === 'none') {
                // The wires in this tile never connect to each other
            }
            else if (terrain.type.wire_propagation_mode === 'cross' ||
                (wire_directions === 0x0f && terrain.type.wire_propagation_mode !== 'all'))
            {
                // This is a cross pattern, so only opposite edges connect
                if (wire_directions & edgeinfo.opposite_bit) {
                    connections |= edgeinfo.opposite_bit;
                }
            }
            else {
                // Everything connects
                connections |= wire_directions;
            }

            seen_cells.set(cell, seen_edges | connections);

            if (on_wire) {
                on_wire(terrain, connections);
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
