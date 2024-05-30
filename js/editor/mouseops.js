// Types that handle mouse activity for a given tool, whether the mouse button is current held or
// not.  (When the mouse button is /not/ held, then only the operation bound to the left mouse
// button gets events.)
import * as algorithms from '../algorithms.js';
import { DIRECTIONS, LAYERS, COLLISION } from '../defs.js';
import TILE_TYPES from '../tiletypes.js';
import { mk, mk_svg, walk_grid } from '../util.js';

import { SPECIAL_TILE_BEHAVIOR } from './editordefs.js';
import { SVGConnection } from './helpers.js';
import { TILES_WITH_PROPS, CellEditorOverlay } from './tile-overlays.js';

const FORCE_FLOOR_TILES_BY_DIRECTION = {
    north: 'force_floor_n',
    east: 'force_floor_e',
    south: 'force_floor_s',
    west: 'force_floor_w',
};
const FORCE_FLOOR_TILES = new Set(['force_floor_all', ...Object.values(FORCE_FLOOR_TILES_BY_DIRECTION)]);
const ICE_TILES = new Set(['ice', 'ice_ne', 'ice_se', 'ice_sw', 'ice_nw']);

function mouse_move_to_direction(prevx, prevy, x, y) {
    if (x === prevx) {
        if (y > prevy) {
            return 'south';
        }
        else {
            return 'north';
        }
    }
    else {
        if (x > prevx) {
            return 'east';
        }
        else {
            return 'west';
        }
    }
}

// Return whether this point is closer to the center of the cell than the edges
function is_cell_center(frac_cell_x, frac_cell_y) {
    let frac_x = frac_cell_x % 1;
    let frac_y = frac_cell_y % 1;
    return (Math.abs(frac_x - 0.5) <= 0.25 && Math.abs(frac_y - 0.5) <= 0.25);
}

// Returns the edge of the cell that this point is closest to
function get_cell_edge(frac_cell_x, frac_cell_y) {
    let frac_x = frac_cell_x % 1;
    let frac_y = frac_cell_y % 1;
    if (frac_x >= frac_y) {
        if (frac_x >= 1 - frac_y) {
            return 'east';
        }
        else {
            return 'north';
        }
    }
    else {
        if (frac_x <= 1 - frac_y) {
            return 'west';
        }
        else {
            return 'south';
        }
    }
}

// Returns the edge of the cell that this point is closest to, or 'null' if the point is closer to
// the center than the edges
function get_cell_edge_or_center(frac_cell_x, frac_cell_y) {
    if (is_cell_center(frac_cell_x, frac_cell_y)) {
        return null;
    }
    else {
        return get_cell_edge(frac_cell_x, frac_cell_y);
    }
}

// Returns the corner of the cell this point is in, as an integer from 0 to 3 (clockwise, starting
// northeast, matching the order of railroad tracks)
function get_cell_corner(frac_cell_x, frac_cell_y) {
    if (frac_cell_x % 1 >= 0.5) {
        if (frac_cell_y % 1 <= 0.5) {
            return 0;
        }
        else {
            return 1;
        }
    }
    else {
        if (frac_cell_y % 1 >= 0.5) {
            return 2;
        }
        else {
            return 3;
        }
    }
}


function _get_blocked_leaving_directions(cell) {
    let blocked = 0;

    for (let tile of cell) {
        if (! tile)
            continue;

        if (tile.type.name === 'thin_walls' || tile.type.name === 'one_way_walls') {
            // Both regular and one-way walls block leaving
            blocked |= tile.edges;
        }
        else if (tile.type.thin_walls) {
            for (let dir of tile.type.thin_walls) {
                blocked |= DIRECTIONS[dir].bit;
            }
        }
    }

    return blocked;
}

function _get_blocked_entering_directions(cell) {
    let blocked = 0;

    for (let tile of cell) {
        if (! tile)
            continue;

        if (tile.type.name === 'thin_walls') {
            // Only regular thin walls block entering
            blocked |= tile.edges;
        }
        else if (tile.type.thin_walls) {
            for (let dir of tile.type.thin_walls) {
                blocked |= DIRECTIONS[dir].bit;
            }
        }
    }

    return blocked;
}

// FIXME both wand and floodfill want to be able to fill on their actual layer, for different reasons
function floodfill_from(x0, y0, editor, respect_selection) {
    let i0 = editor.coords_to_scalar(x0, y0);
    let stored_level = editor.stored_level;
    let tile = editor.fg_tile;
    // FIXME?  unclear how this oughta work
    let layer = tile.type.layer;
    // Traversability behavior (even for filling with non-terrain tiles): if we start on a
    // traversable tile, flood to all neighboring ones; otherwise, flood to the same terrain
    let is_traversable = terrain_tile => {
        if (terrain_tile.type.name.startsWith('door_'))
            return false;
        return ! terrain_tile.type.blocks_collision ||
            (terrain_tile.type.blocks_collision & COLLISION.real_player) !== COLLISION.real_player;
    };
    let terrain0 = stored_level.linear_cells[i0][LAYERS.terrain] ?? null;
    if (terrain0 && is_traversable(terrain0)) {
        terrain0 = null;
    }
    let tile0 = stored_level.linear_cells[i0][layer] ?? null;
    let type0 = tile0 ? tile0.type : null;

    if (respect_selection && ! editor.selection.contains(x0, y0)) {
        return null;
    }

    // Aaand, floodfill
    let fill_state = new Array(stored_level.linear_cells.length);
    fill_state[i0] = true;
    let pending = [i0];
    let steps = 0;
    while (pending.length > 0) {
        let old_pending = pending;
        pending = [];
        for (let i of old_pending) {
            let [x, y] = stored_level.scalar_to_coords(i);
            let from_cell = stored_level.cell(x, y);
            let blocked_leaving = _get_blocked_leaving_directions(from_cell);

            // Check neighbors
            for (let dirinfo of Object.values(DIRECTIONS)) {
                let [dx, dy] = dirinfo.movement;
                let nx = x + dx;
                let ny = y + dy;
                let j = stored_level.coords_to_scalar(nx, ny)
                if ((blocked_leaving & dirinfo.bit) ||
                    (respect_selection && ! editor.selection.contains(nx, ny)))
                {
                    fill_state[j] = false;
                    continue;
                }

                let cell = editor.cell(nx, ny);
                if (! cell)
                    continue;
                if (fill_state[j] !== undefined)
                    continue;

                let terrain = cell[LAYERS.terrain];
                if (terrain) {
                    if (terrain0) {
                        if (terrain.type !== terrain0.type)
                            continue;
                    }
                    else {
                        if (! is_traversable(terrain))
                            continue;
                    }
                }

                let blocked_entering = _get_blocked_entering_directions(cell);
                if (blocked_entering & DIRECTIONS[dirinfo.opposite].bit)
                    continue;

                let tile = cell[layer] ?? null;
                let type = tile ? tile.type : null;
                if (type === type0) {
                    fill_state[j] = true;
                    pending.push(j);
                }
                else {
                    fill_state[j] = false;
                }
            }
            steps += 1;
            if (steps > 10000) {
                console.error("more steps than should be possible");
                return fill_state;
            }
        }
    }

    return fill_state;
}


// TODO some minor grievances
// - the track overlay doesn't explain "direction" (may not be necessary anyway), allows picking a
// bad initial switch direction
// - track tool should add a switch to a track on right-click, if possible (and also probably delete
// it on ctrl-right-click?)
// - no preview tile with force floor or track tool
// - no ice drawing tool
// - cursor box shows with selection tool which seems inappropriate
// - controls do not exactly stand out and are just plain text
// - set trap as initially open?  feels like a weird hack.  but it does appear in cc2lp1
const MOUSE_BUTTON_MASKS = [1, 4, 2];  // MouseEvent.button/buttons are ordered differently
export class MouseOperation {
    constructor(editor) {
        this.editor = editor;
        this.held_button = null;
        this.alt_mode = false;
        this.ctrl = false;
        this.shift = false;

        // Client coordinates of the previous mouse event
        this.prev_client_x = null;
        this.prev_client_y = null;
        // Cell coordinates
        this.prev_cell_x = null;
        this.prev_cell_y = null;
        // Fractional cell coordinates
        this.prev_frac_cell_x = null;
        this.prev_frac_cell_y = null;

        // Same as above, but for the most recent click (so drag ops know where they started)
        this.click_client_x = null;
        this.click_client_y = null;
        this.click_cell_x = null;
        this.click_cell_y = null;
        this.click_frac_cell_x = null;
        this.click_frac_cell_y = null;

        this.cursor_element = null;
        this.preview_element = null;

        // Assume we're hidden until proven otherwise
        // TODO obviously suboptimal when switching tools with the mouse over the canvas...  maybe
        // editor should send us a fake mousemove in that case, idk
        this.hide();
    }

    // Register an SVG element as the cursor.  This will be automatically shown and hidden when
    // appropriate, and its position will be updated to match the position of the cursor
    set_cursor_element(el) {
        this.cursor_element = el;
        el.setAttribute('data-name', this.constructor.name);
        if (! this.is_hover_visible) {
            el.style.display = 'none';
        }
        this.editor.svg_overlay.append(el);
    }

    // Register an SVG element as the preview.  Similar to the cursor element, but it's assumed to
    // be positioned relative to the whole level, and won't be moved around
    set_preview_element(el) {
        this.preview_element = el;
        el.setAttribute('data-name', this.constructor.name);
        if (! this.is_hover_visible) {
            el.style.display = 'none';
        }
        this.editor.svg_overlay.append(el);
    }

    cell(x, y) {
        return this.editor.cell(Math.floor(x), Math.floor(y));
    }

    do_press(ev) {
        this.held_button = ev.button;
        this.alt_mode = (ev.button === 2);
        this._update_modifiers(ev);

        this.client_x = ev.clientX;
        this.client_y = ev.clientY;
        [this.click_frac_cell_x, this.click_frac_cell_y] = this.editor.renderer.real_cell_coords_from_event(ev);
        this.click_cell_x = Math.floor(this.click_frac_cell_x);
        this.click_cell_y = Math.floor(this.click_frac_cell_y);

        this.prev_client_x = this.client_x;
        this.prev_client_y = this.client_y;
        this.prev_frac_cell_x = this.click_frac_cell_x;
        this.prev_frac_cell_y = this.click_frac_cell_y;
        this.prev_cell_x = this.click_cell_x;
        this.prev_cell_y = this.click_cell_y;

        this.handle_press(this.click_cell_x, this.click_cell_y, ev);
    }

    do_move(ev) {
        this._update_modifiers(ev);
        let [frac_cell_x, frac_cell_y] = this.editor.renderer.real_cell_coords_from_event(ev);
        let cell_x = Math.floor(frac_cell_x);
        let cell_y = Math.floor(frac_cell_y);

        if (this.held_button !== null && (ev.buttons & MOUSE_BUTTON_MASKS[this.held_button]) === 0) {
            this.do_abort();
        }

        if (this.cursor_element) {
            this.cursor_element.setAttribute('transform', `translate(${cell_x} ${cell_y})`);
        }

        if (this.held_button !== null) {
            // Continue a drag even if the mouse goes outside the viewport
            this.handle_drag(ev.clientX, ev.clientY, frac_cell_x, frac_cell_y, cell_x, cell_y);
        }
        else {
            // This is a hover, which has separate behavior for losing track of the mouse.  Note
            // that we can't just check if the cell coordinates are valid; we also need to know that
            // the mouse is actually over the visible viewport (the canvas may have scrolled!)
            let in_bounds = false;
            if (this.editor.is_in_bounds(cell_x, cell_y)) {
                let rect = this.editor.actual_viewport_el.getBoundingClientRect();
                let cx = ev.clientX, cy = ev.clientY;
                if (rect.left <= cx && cx < rect.right && rect.top <= cy && cy < rect.bottom) {
                    in_bounds = true;
                }
            }

            if (in_bounds) {
                this.show();
                this.handle_hover(ev.clientX, ev.clientY, frac_cell_x, frac_cell_y, cell_x, cell_y);
            }
            else {
                this.hide();
                this.handle_leave();
            }
        }

        this.prev_client_x = ev.clientX;
        this.prev_client_y = ev.clientY;
        this.prev_frac_cell_x = frac_cell_x;
        this.prev_frac_cell_y = frac_cell_y;
        this.prev_cell_x = cell_x;
        this.prev_cell_y = cell_y;
    }

    rehover() {
        this.handle_hover(null, null, this.prev_frac_cell_x, this.prev_frac_cell_y, this.prev_cell_x, this.prev_cell_y);
    }

    do_leave() {
        this.hide();
    }

    show() {
        if (! this.is_hover_visible) {
            this.is_hover_visible = true;
            if (this.cursor_element) {
                this.cursor_element.style.display = '';
            }
            if (this.preview_element) {
                this.preview_element.style.display = '';
            }
        }
    }

    hide() {
        if (this.is_hover_visible) {
            this.is_hover_visible = false;
            if (this.cursor_element) {
                this.cursor_element.style.display = 'none';
            }
            if (this.preview_element) {
                this.preview_element.style.display = 'none';
            }
        }
    }

    _update_modifiers(ev) {
        this.ctrl = ev.ctrlKey;
        this.shift = ev.shiftKey;
        this.alt = ev.altKey;
    }

    clear_modifiers() {
        this.ctrl = false;
        this.shift = false;
        this.alt = false;
    }

    do_commit() {
        if (this.held_button === null)
            return;

        this.commit_press();
        this.cleanup_press();
        this.alt_mode = false;
        this.held_button = null;
    }

    do_abort() {
        if (this.held_button === null)
            return;

        this.abort_press();
        this.cleanup_press();
        this.alt_mode = false;
        this.held_button = null;
    }

    do_destroy() {
        this.do_abort();

        if (this.cursor_element) {
            this.cursor_element.remove();
        }
        if (this.preview_element) {
            this.preview_element.remove();
        }
    }

    *iter_touched_cells(frac_cell_x, frac_cell_y) {
        for (let pt of walk_grid(
            this.prev_frac_cell_x, this.prev_frac_cell_y, frac_cell_x, frac_cell_y,
            // Bound the grid walk to one cell beyond the edges of the level, so that dragging the
            // mouse in from outside the actual edges still works reliably
            -1, -1, this.editor.stored_level.size_x, this.editor.stored_level.size_y))
        {
            if (this.editor.is_in_bounds(...pt)) {
                yield pt;
            }
        }
    }

    // -- Implement these --

    // Called when the mouse button is first pressed
    handle_press(x, y, ev) {}
    // Called when the mouse is moved while the button is held down
    handle_drag(client_x, client_y, frac_cell_x, frac_cell_y, cell_x, cell_y) {}
    // Called when releasing the mouse button
    commit_press() {}
    // Called when aborting a held mouse, e.g. by pressing Esc or losing focus
    abort_press() {}
    // Called after either of the above cases
    cleanup_press() {}

    // Called when the mouse is moved while the button is NOT held down
    handle_hover(client_x, client_y, frac_cell_x, frac_cell_y, cell_x, cell_y) {}
    // Called when the foreground or background tile changes (after it's been redrawn)
    handle_tile_updated(is_bg = false) {}
    // Called when the mouse leaves the level or viewport while the button is NOT held down
    handle_leave() {}
    // Called when any hover state should be thrown away, due to some external change, just before
    // handle_drag or handle_hover is called
    handle_refresh() {}
}

export class PanOperation extends MouseOperation {
    handle_drag(client_x, client_y) {
        let target = this.editor.actual_viewport_el;
        let dx = this.prev_client_x - client_x;
        let dy = this.prev_client_y - client_y;
        target.scrollLeft += dx;
        target.scrollTop += dy;
    }
}

// FIXME handle moving the mouse while the button is down; should continuously eyedrop
// FIXME also the pencil cursor doesn't move when right-dragging, because it's not active and
// doesn't receive events any more whoops?  but wait, panning DOES hide the cursor, so what the hell
export class EyedropOperation extends MouseOperation {
    constructor(...args) {
        super(...args);
        // Last coordinates we clicked on
        // FIXME whoops, storing this state locally doesn't work since we're destroyed between
        // clicks lol!  clean fix is to make an op immediately and persist it even when mouse isn't
        // down?  then the hover stuff could be rolled into the tool too?  kind of a big change tho
        // so for now let's cheat and hack it onto the editor itself
        this.last_eyedropped_coords = null;
        this.last_layer = null;
    }

    eyedrop(x, y) {
        let cell = this.cell(x, y);
        if (! cell) {
            this.last_eyedropped_coords = null;
            return;
        }
        let n = this.editor.coords_to_scalar(x, y);

        // If we're picking the background, we always use the terrain
        if (this.ctrl) {
            this.editor.select_background_tile(cell[LAYERS.terrain], n);
            return;
        }

        // Pick the topmost thing, unless we're clicking on a cell repeatedly, in which case we
        // continue from below the last thing we picked
        let layer_offset = 0;
        if (this.last_eyedropped_coords &&
            this.last_eyedropped_coords[0] === x && this.last_eyedropped_coords[1] === y)
        {
            layer_offset = this.last_layer;
        }
        for (let l = LAYERS.MAX - 1; l >= 0; l--) {
            // This scheme means we'll cycle back around after hitting the bottom
            let layer = (l + layer_offset) % LAYERS.MAX;

            if (! this.editor.is_layer_selected(layer))
                continue;

            let tile = cell[layer];
            if (! tile)
                continue;

            this.editor.select_foreground_tile(tile, n);
            this.last_eyedropped_coords = [x, y];
            this.last_layer = layer;
            return;
        }
    }

    handle_press(x, y) {
        this.eyedrop(x, y);
    }
    handle_drag(x, y) {
        // FIXME should only re-eyedrop if we enter a new cell or click again
        this.eyedrop(x, y);
    }
}


export class PencilOperation extends MouseOperation {
    constructor(...args) {
        super(...args);

        // Our cursor has two parts, so it's really a group
        this.tile_element = mk_svg('image', {
            id: 'svg-editor-preview-tile',
            x: 0,
            y: 0,
            width: 1,
            height: 1,
            opacity: 0.5,
        });
        this.set_cursor_element(mk_svg('g',
            this.tile_element,
            mk_svg('rect.overlay-pencil-cursor', {x: 0, y: 0, width: 1, height: 1}),
        ));
        this.handle_tile_updated();
    }

    // Hover: draw the tile in the pointed-to cell
    handle_tile_updated(is_bg = false) {
        if (is_bg)
            return;
        this.tile_element.setAttribute('href', this.editor.fg_tile_el.toDataURL());
    }

    handle_press(x, y) {
        this.draw_in_cell(x, y);
    }
    handle_drag(client_x, client_y, frac_cell_x, frac_cell_y, cell_x, cell_y) {
        for (let [x, y] of this.iter_touched_cells(frac_cell_x, frac_cell_y)) {
            this.draw_in_cell(x, y);
        }
    }

    draw_in_cell(x, y) {
        let template = this.editor.fg_tile;
        let cell = this.cell(x, y);
        if (this.ctrl) {
            // Erase
            if (this.shift) {
                // Wipe the whole cell
                let new_cell = this.editor.make_blank_cell(x, y);
                this.editor.replace_cell(cell, new_cell);
            }
            else if (template) {
                // Erase whatever's on the same layer as the fg tile
                this.editor.erase_tile(cell);
            }
        }
        else {
            // Draw
            if (! template)
                return;
            if (this.shift) {
                // Aggressive mode: replace whatever's already in the cell
                let new_cell = this.editor.make_blank_cell(x, y);
                new_cell[template.type.layer] = {...template};
                this.editor.replace_cell(cell, new_cell);
            }
            else {
                // Default operation: only replace whatever's on the same layer
                this.editor.place_in_cell(cell, template);
            }
        }
    }

    cleanup_press() {
        this.editor.commit_undo();
    }
}


class BigDrawOperation extends MouseOperation {
    constructor(...args) {
        super(...args);
        this.set_cursor_element(mk_svg('image', {
            x: 0,
            y: 0,
            width: 1,
            height: 1,
            opacity: 0.5,
        }));
        this.set_preview_element(mk_svg('g'));
        this.points = [];
        this.handle_tile_updated();
    }

    handle_tile_updated(is_bg = false) {
        if (is_bg)
            return;
        let url = this.editor.fg_tile_el.toDataURL();
        this.cursor_element.setAttribute('href', url);
        for (let image of this.preview_element.childNodes) {
            image.setAttribute('href', url);
        }
    }

    handle_press(x, y) {
        this.update_drawn_points([[x, y]]);
    }
    update_drawn_points(iterable) {
        let existing_nodes = this.preview_element.childNodes;
        let i = 0;
        for (let [x, y] of iterable) {
            if (! this.editor.is_in_bounds(x, y))
                continue;

            this.points[i] = [x, y];
            let node = existing_nodes[i];
            if (! node) {
                node = mk_svg('image', {
                    width: 1,
                    height: 1,
                    opacity: 0.5,
                    href: this.editor.fg_tile_el.toDataURL(),
                });
                this.preview_element.append(node);
            }
            node.setAttribute('x', x);
            node.setAttribute('y', y);
            i += 1;
        }

        this.points.splice(i);
        for (; i < existing_nodes.length; i++) {
            existing_nodes[i].remove();
        }
    }

    commit_press() {
        for (let [x, y] of this.points) {
            this.editor.place_in_cell(this.cell(x, y), this.editor.fg_tile);
        }
        this.editor.commit_undo();
    }
    cleanup_press() {
        this.points = [];
        this.preview_element.textContent = '';
    }
}

export class LineOperation extends BigDrawOperation {
    // Technically the cursor should be hidden while dragging, but in practice it highlights the
    // endpoint of the line (by drawing it twice), which I kind of like
    handle_drag(client_x, client_y, frac_cell_x, frac_cell_y, cell_x, cell_y) {
        if (this.shift) {
            // Force lines at "nice" angles -- orthogonal, 1:1, or 1:2
            let dx = cell_x - this.click_cell_x;
            let dy = cell_y - this.click_cell_y;
            // If either delta is zero, we're already orthogonal, nothing to do
            if (dx !== 0 && dy !== 0) {
                let ratio = Math.abs(dx / dy);
                let small_ratio = ratio < 1 ? ratio : 1 / ratio;
                // We're either between ortho and 1:2, or between 1:2 and 1:1.  Could do some clever
                // geometry to figure out the closer one but fuck it, just compare the absolute
                // difference in ratios: are we closer to 0, 0.5, or 1?
                // As for actually figuring out the new endpoint: keep the resulting line within the
                // bbox established by the mouse.
                let snapped_ratio;
                if (small_ratio <= 0.25) {
                    // Snap to orthogonal
                    snapped_ratio = 0;
                }
                else if (small_ratio < 0.75) {
                    // Snap to 1:2
                    snapped_ratio = 0.5;
                }
                else {
                    // Snap to 1:2
                    snapped_ratio = 1;
                }

                if (ratio < 1) {
                    // Keep x, shrink y to match
                    cell_x = this.click_cell_x + snapped_ratio * Math.abs(dy) * Math.sign(dx);
                }
                else {
                    cell_y = this.click_cell_y + snapped_ratio * Math.abs(dx) * Math.sign(dy);
                }
            }
        }

        this.update_drawn_points(walk_grid(
            this.click_cell_x + 0.5, this.click_cell_y + 0.5, cell_x + 0.5, cell_y + 0.5,
            -1, -1, this.editor.stored_level.size_x, this.editor.stored_level.size_y));
    }
}


export class RectangleOperation extends BigDrawOperation {
    *_iter_rectangle_outline(x0, y0, x1, y1) {
        // Top
        for (let x = x0; x <= x1; x++) {
            yield [x, y0];
        }
        if (y0 !== y1) {
            // Bottom
            for (let x = x0; x <= x1; x++) {
                yield [x, y1];
            }
        }

        // Left
        for (let y = y0 + 1; y < y1; y++) {
            yield [x0, y];
        }
        if (x0 !== x1) {
            for (let y = y0 + 1; y < y1; y++) {
                yield [x1, y];
            }
        }
    }
    *_iter_rectangle_fill(x0, y0, x1, y1) {
        for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
                yield [x, y];
            }
        }
    }
    handle_drag(client_x, client_y, frac_cell_x, frac_cell_y, cell_x, cell_y) {
        let x0 = Math.min(this.click_cell_x, cell_x);
        let x1 = Math.max(this.click_cell_x, cell_x);
        let y0 = Math.min(this.click_cell_y, cell_y);
        let y1 = Math.max(this.click_cell_y, cell_y);

        if (this.shift) {
            // Force a square, with the added wrinkle that we need to shrink towards the cursor
            if (x1 - x0 < y1 - y0) {
                let size = x1 - x0;
                if (y0 === this.click_cell_y) {
                    y1 = y0 + size;
                }
                else {
                    y0 = y1 - size;
                }
            }
            else if (y1 - y0 < x1 - x0) {
                let size = y1 - y0;
                if (x0 === this.click_cell_x) {
                    x1 = x0 + size;
                }
                else {
                    x0 = x1 - size;
                }
            }
        }

        if (this.ctrl) {
            // Fill
            this.update_drawn_points(this._iter_rectangle_fill(x0, y0, x1, y1));
        }
        else {
            // Outline
            this.update_drawn_points(this._iter_rectangle_outline(x0, y0, x1, y1));
        }
    }
}


// FIXME still to do on this:
// - doesn't know to update canvas size or erase results when a new level is loaded OR when the
// level size changes (and for that matter the selection tool doesn't either)
// - hold shift to replace all of the same tile in the whole level?  (need to know when shift is
// toggled)
// - right-click to pick, same logic as pencil (which needs improving)
// - ctrl-click to erase
// - wait, no.  ctrl to like, fill the terrain layer regardless of the current tile's layer?  atm
// you can't flood with an item usefully, it just fills the whole level
// - reset the preview after a fill?  is that ever necessary?
export class FillOperation extends MouseOperation {
    constructor(...args) {
        super(...args);
        let renderer = this.editor.renderer;
        this.canvas = mk('canvas', {
            width: renderer.canvas.width,
            height: renderer.canvas.height,
        });
        this.set_preview_element(mk_svg('foreignObject', {
            x: 0, y: 0,
            width: this.canvas.width, height: this.canvas.height,
            transform: `scale(${1/renderer.tileset.size_x} ${1/renderer.tileset.size_y})`,
            opacity: 0.5,
        }, this.canvas));

        // array of (true: in flood, false: definitely not), or null if not yet populated
        this.fill_state = null;
        // Last coordinates we updated from
        // FIXME probably not necessary now?
        this.last_known_coords = null;
        // Palette tile we last flooded with
        this.last_known_tile = this.editor.fg_tile;
    }

    handle_hover(_mx, _my, _gxf, _gyf, cell_x, cell_y) {
        this.last_known_coords = [cell_x, cell_y];
        this.last_known_tile = this.editor.fg_tile;
        this._floodfill_from(cell_x, cell_y);
    }
    _floodfill_from(x0, y0) {
        let i0 = this.editor.coords_to_scalar(x0, y0);
        if (this.fill_state && this.fill_state[i0]) {
            // This cell is already part of the pending fill, so there's nothing to do
            return;
        }

        this.fill_state = floodfill_from(x0, y0, this.editor, true);

        this._redraw();
    }

    _redraw() {
        // Draw all the good tiles
        let ctx = this.canvas.getContext('2d');
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (! this.fill_state)
            return;

        let stored_level = this.editor.stored_level;
        let tileset = this.editor.renderer.tileset;
        let source = this.editor.fg_tile_el;
        for (let [i, ok] of this.fill_state.entries()) {
            if (! ok)
                continue;

            let [x, y] = stored_level.scalar_to_coords(i);
            ctx.drawImage(source, x * tileset.size_x, y * tileset.size_y);
        }
    }

    handle_tile_updated(is_bg = false) {
        if (is_bg)
            // TODO
            return;

        // Figure out whether the floodfill results changed.  If the new tile is on the same layer
        // as the old tile, we can reuse the results and just redraw.  If not, recompute everything
        // (unless we're hidden, in which case blow it away and just do nothing).
        if (this.editor.fg_tile.type.layer === this.last_known_tile.type.layer) {
            if (this.fill_state) {
                this._redraw();
            }
        }
        else {
            this.fill_state = null;
            if (this.last_known_coords && ! this.hidden) {
                this._floodfill_from(...this.last_known_coords);
            }
        }
    }

    handle_press() {
        // Filling is a single-click thing, and all the work was done while hovering
        if (! this.fill_state) {
            // Something has gone terribly awry (or they clicked outside the level)
            return;
        }

        let stored_level = this.editor.stored_level;
        let template = this.editor.fg_tile;
        for (let [i, ok] of this.fill_state.entries()) {
            if (! ok)
                continue;

            let cell = this.editor.cell(...stored_level.scalar_to_coords(i));
            this.editor.place_in_cell(cell, template);
        }
        this.editor.commit_undo();
    }
}


// TODO also, delete?  there's no delete??
// FIXME don't show the box or overlay text until has_moved
// TODO cursor: 'cell' by default...?
// FIXME possible to start dragging from outside the level bounds, augh
class BaseSelectOperation extends MouseOperation {
    handle_press() {
        this.has_moved = false;
        if (! this.shift && ! this.editor.selection.is_empty &&
            this.editor.selection.contains(this.click_cell_x, this.click_cell_y))
        {
            // Move existing selection
            this.mode = 'float';
            this.make_copy = this.ctrl;
        }
        else {
            this.start_selection();
        }
    }

    drag_floating_selection(cell_x, cell_y) {
        if (this.has_moved) {
            this.editor.selection.move_by(Math.floor(cell_x - this.prev_cell_x), Math.floor(cell_y - this.prev_cell_y));
            return;
        }

        if (this.make_copy) {
            if (this.editor.selection.is_floating) {
                // Stamp the floating selection but keep it floating
                this.editor.selection.stamp_float(true);
            }
            else {
                this.editor.selection.enfloat(true);
            }
        }
        else if (! this.editor.selection.is_floating) {
            this.editor.selection.enfloat();
        }
    }

    handle_drag(client_x, client_y, frac_cell_x, frac_cell_y, cell_x, cell_y) {
        if (this.mode === 'float') {
            this.drag_floating_selection(cell_x, cell_y);
        }
        else {
            this.continue_selection();
        }
        this.has_moved = true;
    }

    commit_press() {
        if (this.mode === 'float') {
            // Make selection move undoable
            let dx = Math.floor(this.prev_cell_x - this.click_cell_x);
            let dy = Math.floor(this.prev_cell_y - this.click_cell_y);
            if (dx || dy) {
                this.editor._done(
                    () => this.editor.selection.move_by(dx, dy),
                    () => this.editor.selection.move_by(-dx, -dy),
                );
            }
        }
        else {  // create/extend
            this.finish_selection();
        }
        this.editor.commit_undo();
    }
    abort_press() {
        if (this.mode === 'float') {
            // FIXME revert the move?
        }
        else {
            this.pending_selection.discard();
        }
    }

    do_destroy() {
        // Don't let a floating selection persist when switching tools
        this.editor.selection.commit_floating();
        this.editor.commit_undo();
        super.do_destroy();
    }
}

export class BoxSelectOperation extends BaseSelectOperation {
    start_selection() {
        if (this.shift) {
            this.mode = 'select';
            if (this.ctrl) {
                // Subtract from selection (the normal way is ctrl, but ctrl-shift works even to
                // start dragging inside an existing selection)
                this.pending_selection = this.editor.selection.create_pending('subtract');
            }
            else {
                // Extend selection
                this.pending_selection = this.editor.selection.create_pending('add');
            }
            this._update_pending_selection();
        }
        else {
            this.mode = 'select';
            if (this.ctrl) {
                // Subtract from selection (must initiate click outside selection, or it'll float)
                this.pending_selection = this.editor.selection.create_pending('subtract');
            }
            else {
                // Create new selection
                this.pending_selection = this.editor.selection.create_pending('new');
            }
            this._update_pending_selection();
        }
    }

    continue_selection() {
        this._update_pending_selection();
    }

    finish_selection() {
        if (this.has_moved) {
            // Drag either creates or extends the selection
            // If there's an existing floating selection (which isn't what we're operating on),
            // commit it before doing anything else
            this.editor.selection.commit_floating();

            this.pending_selection.commit();
        }
        else {
            // Plain click clears selection.  But first, if there's a floating selection and
            // it's moved, commit that movement as a separate undo entry
            if (this.editor.selection.is_floating) {
                let float_moved = this.editor.selection.has_moved;
                if (float_moved) {
                    this.editor.commit_undo();
                }
                this.editor.selection.commit_floating();
            }

            this.pending_selection.discard();
            this.editor.selection.clear();
        }
    }

    _update_pending_selection() {
        this.pending_selection.set_extrema(
            Math.max(0, Math.min(this.editor.stored_level.size_x - 1, this.click_cell_x)),
            Math.max(0, Math.min(this.editor.stored_level.size_y - 1, this.click_cell_y)),
            Math.max(0, Math.min(this.editor.stored_level.size_x - 1, this.prev_cell_x)),
            Math.max(0, Math.min(this.editor.stored_level.size_y - 1, this.prev_cell_y)));
    }
}

export class WandSelectOperation extends BaseSelectOperation {
    start_selection() {
        let filled_cells = floodfill_from(this.click_cell_x, this.click_cell_y, this.editor, false);
        let cells = new Set;
        if (filled_cells) {
            for (let [i, filled] of filled_cells.entries()) {
                if (filled) {
                    cells.add(i);
                }
            }
        }

        if (this.shift) {
            this.mode = 'select';
            if (this.ctrl) {
                // Subtract from selection
                this.editor.selection.remove_points(cells);
            }
            else {
                // Add to selection
                this.editor.selection.add_points(cells);
            }
        }
        else {
            this.mode = 'select';
            if (this.ctrl) {
                // Subtract from selection
                this.editor.selection.remove_points(cells);
            }
            else {
                // Replace selection
                this.editor.selection.clear();
                this.editor.selection.add_points(cells);
            }
        }
    }

    continue_selection() {
        // Nothing to do here; moving the mouse doesn't affect the floodfill
    }

    finish_selection() {
        // uhhhhh
    }
}


// -------------------------------------------------------------------------------------------------
// FORCE FLOORS

export class ForceFloorOperation extends MouseOperation {
    handle_press(x, y) {
        // Begin by placing an all-way force floor under the mouse
        this.editor.place_in_cell(this.cell(x, y), {type: TILE_TYPES.force_floor_all});
    }
    handle_drag(client_x, client_y, frac_cell_x, frac_cell_y) {
        // Walk the mouse movement and change each we touch to match the direction we
        // crossed the border
        // FIXME occasionally i draw a tetris S kinda shape and both middle parts point
        // the same direction, but shouldn't
        let i = 0;
        let prevx, prevy;
        for (let [x, y] of this.iter_touched_cells(frac_cell_x, frac_cell_y)) {
            i += 1;
            // The very first cell is the one the mouse was already in, and we don't
            // have a movement direction yet, so leave that alone
            if (i === 1) {
                prevx = x;
                prevy = y;
                continue;
            }
            let name = FORCE_FLOOR_TILES_BY_DIRECTION[mouse_move_to_direction(prevx, prevy, x, y)];

            // The second cell tells us the direction to use for the first, assuming it
            // had some kind of force floor
            if (i === 2) {
                let prevcell = this.editor.cell(prevx, prevy);
                if (prevcell[LAYERS.terrain].type.name.startsWith('force_floor_')) {
                    this.editor.place_in_cell(prevcell, {type: TILE_TYPES[name]});
                }
            }

            // Drawing a loop with force floors creates ice (but not in the previous
            // cell, obviously)
            let cell = this.editor.cell(x, y);
            if (cell[LAYERS.terrain].type.name.startsWith('force_floor_') &&
                cell[LAYERS.terrain].type.name !== name)
            {
                name = 'ice';
            }
            this.editor.place_in_cell(cell, {type: TILE_TYPES[name]});

            prevx = x;
            prevy = y;
        }
    }
    cleanup_press() {
        this.editor.commit_undo();
    }
}


// -------------------------------------------------------------------------------------------------
// ICE

// This is sort of like a combination of the force floor tool and track tool
export class IceOperation extends MouseOperation {
    handle_press(x, y) {
        // Begin by placing regular ice
        this.editor.place_in_cell(this.cell(x, y), {type: TILE_TYPES.ice});
        this.entry_direction = null;
    }
    handle_drag(client_x, client_y, frac_cell_x, frac_cell_y) {
        // Walk the mouse movement.  For tiles we enter, turn them to ice.  For tiles we leave, if
        // the mouse crossed two adjacent edges on its way in and out, change it to a corner
        let prevx = null;
        let prevy = null;
        for (let [x, y] of this.iter_touched_cells(frac_cell_x, frac_cell_y)) {
            let cell = this.cell(x, y);
            let terrain = cell[LAYERS.terrain];
            if (terrain && ! ICE_TILES.has(terrain.type.name)) {
                this.editor.place_in_cell(cell, { type: TILE_TYPES['ice'] });
            }

            if (prevx === null) {
                prevx = x;
                prevy = y;
                continue;
            }

            let exit_direction = mouse_move_to_direction(prevx, prevy, x, y);

            if (this.entry_direction !== null) {
                let leftmost_direction = null;
                if (DIRECTIONS[this.entry_direction].right === exit_direction) {
                    leftmost_direction = this.entry_direction;
                }
                else if (DIRECTIONS[this.entry_direction].left === exit_direction) {
                    leftmost_direction = exit_direction;
                }

                let ice_type;
                if (leftmost_direction) {
                    ice_type = {
                        north: 'ice_sw',
                        east: 'ice_nw',
                        south: 'ice_ne',
                        west: 'ice_se',
                    }[leftmost_direction];
                }
                else {
                    ice_type = 'ice';
                }

                let prev_cell = this.cell(prevx, prevy);
                let prev_terrain = prev_cell[LAYERS.terrain];
                if (ice_type !== prev_terrain.type.name) {
                    this.editor.place_in_cell(prev_cell, { type: TILE_TYPES[ice_type] });
                }
            }

            prevx = x;
            prevy = y;
            this.entry_direction = DIRECTIONS[exit_direction].opposite;
        }
    }
    cleanup_press() {
        this.editor.commit_undo();
    }
}


// -------------------------------------------------------------------------------------------------
// TRACKS

// TODO entered cell should get blank railroad?
// TODO maybe place a straight track in the new cell so it looks like we're doing something, then
// fix it if it wasn't there?
// TODO gonna need an ice tool too, so maybe i can merge all three with some base thing that tracks
// the directions the mouse is moving?  or is FF tool too different?
// TODO would be nice if i could add or remove individual tracks with a single click, too.
// and/or pop open the track editor bubble thing?
export class TrackOperation extends MouseOperation {
    handle_press() {
        // Do nothing to start; we only lay track when the mouse leaves a cell
        this.entry_direction = null;

        // ...unless...
        let tri_x = Math.floor((this.click_frac_cell_x - this.click_cell_x) * 3);
        let tri_y = Math.floor((this.click_frac_cell_y - this.click_cell_y) * 3);
        // TODO add or remove track on the edge clicked here?  hover preview?
        // TODO ctrl-mouse2 for the popup?
    }
    handle_drag(client_x, client_y, frac_cell_x, frac_cell_y) {
        // Walk the mouse movement and, for every tile we LEAVE, add a railroad track matching the
        // two edges of it that we crossed.
        let prevx = null, prevy = null;
        for (let [x, y] of this.iter_touched_cells(frac_cell_x, frac_cell_y)) {
            if (prevx === null || prevy === null) {
                prevx = x;
                prevy = y;
                continue;
            }

            // Figure out which way we're leaving the tile
            let exit_direction = mouse_move_to_direction(prevx, prevy, x, y);

            // If the entry direction is missing or bogus, lay straight track
            if (this.entry_direction === null || this.entry_direction === exit_direction) {
                this.entry_direction = DIRECTIONS[exit_direction].opposite;
            }

            // Get the corresponding bit
            let bit = null;
            for (let [i, track] of TILE_TYPES['railroad'].track_order.entries()) {
                if ((track[0] === this.entry_direction && track[1] === exit_direction) ||
                    (track[1] === this.entry_direction && track[0] === exit_direction))
                {
                    bit = 1 << i;
                    break;
                }
            }

            if (bit === null)
                continue;

            // Update the cell we just left
            let cell = this.cell(prevx, prevy);
            let terrain = cell[0];
            if (terrain.type.name === 'railroad') {
                let new_terrain = {...terrain};
                if (this.ctrl) {
                    // Erase
                    // TODO fix track switch?
                    // TODO if this leaves tracks === 0, replace with floor?
                    new_terrain.tracks &= ~bit;
                }
                else {
                    // Draw
                    new_terrain.tracks |= bit;
                }
                this.editor.place_in_cell(cell, new_terrain);
            }
            else if (! this.ctrl) {
                terrain = { type: TILE_TYPES['railroad'] };
                terrain.type.populate_defaults(terrain);
                terrain.tracks |= bit;
                this.editor.place_in_cell(cell, terrain);
            }

            prevx = x;
            prevy = y;
            this.entry_direction = DIRECTIONS[exit_direction].opposite;
        }
    }
    cleanup_press() {
        this.editor.commit_undo();
    }
}


// -------------------------------------------------------------------------------------------------
// TEXT

export class TextOperation extends MouseOperation {
    constructor(...args) {
        super(...args);
        this.initial_cursor_x = null;
        this.cursor_x = null;
        this.cursor_y = null;

        this.text_cursor = mk_svg('rect.overlay-text-cursor.overlay-transient', {
            x: 0,
            y: 0,
            width: 1,
            height: 1,
        });
        this.editor.svg_overlay.append(this.text_cursor);
    }

    handle_press(x, y) {
        this.initial_cursor_x = x;
        this.place_cursor(x, y);
    }
    handle_drag(client_x, client_y, frac_cell_x, frac_cell_y, cell_x, cell_y) {
        this.initial_cursor_x = cell_x;
        this.place_cursor(cell_x, cell_y);
    }

    // TODO handle ctrl-z?
    handle_key(key) {
        if (key.length === 1) {
            key = key.toUpperCase();
            let code = key.codePointAt(0);
            if (32 <= code && code < 96) {
                let cell = this.cell(this.cursor_x, this.cursor_y);
                this.editor.place_in_cell(cell, {
                    type: TILE_TYPES['floor_letter'],
                    overlaid_glyph: key,
                });
                this.place_cursor(this.cursor_x + 1, this.cursor_y);
                return true;
            }
        }

        if (key === 'Escape') {
            this.hide_cursor();
            return true;
        }
        else if (key === 'ArrowUp') {
            this.place_cursor(this.cursor_x, this.cursor_y - 1);
        }
        else if (key === 'ArrowDown') {
            this.place_cursor(this.cursor_x, this.cursor_y + 1);
        }
        else if (key === 'ArrowLeft') {
            this.place_cursor(this.cursor_x - 1, this.cursor_y);
        }
        else if (key === 'ArrowRight') {
            this.place_cursor(this.cursor_x + 1, this.cursor_y);
        }
        else if (key === 'Return' || key === 'Enter') {
            this.place_cursor(this.initial_cursor_x, this.cursor_y + 1);
        }
        else if (key === 'Backspace') {
            this.place_cursor(this.cursor_x - 1, this.cursor_y);
            let cell = this.cell(this.cursor_x, this.cursor_y);
            this.editor.place_in_cell(cell, { type: TILE_TYPES['floor'] });
        }
        else if (key === 'Delete') {
            let cell = this.cell(this.cursor_x, this.cursor_y);
            this.editor.place_in_cell(cell, { type: TILE_TYPES['floor'] });
        }
        else if (key === 'Home') {
            this.place_cursor(0, this.cursor_y);
        }
        else if (key === 'End') {
            this.place_cursor(this.editor.stored_level.size_x - 1, this.cursor_y);
        }
        else if (key === 'PageUp') {
            this.place_cursor(this.cursor_x, 0);
        }
        else if (key === 'PageDown') {
            this.place_cursor(this.cursor_x, this.editor.stored_level.size_y - 1);
        }
    }

    place_cursor(x, y) {
        this.cursor_x = Math.max(0, Math.min(this.editor.stored_level.size_x - 1, x));
        this.cursor_y = Math.max(0, Math.min(this.editor.stored_level.size_y - 1, y));
        this.text_cursor.classList.add('--visible');
        this.text_cursor.setAttribute('x', this.cursor_x);
        this.text_cursor.setAttribute('y', this.cursor_y);
        this.editor.redirect_keys_to_tool = true;
    }
    hide_cursor() {
        this.editor.redirect_keys_to_tool = false;
        this.editor.commit_undo();
    }

    do_destroy() {
        this.editor.redirect_keys_to_tool = false;
    }
}


// -------------------------------------------------------------------------------------------------
// THIN WALLS

export class ThinWallOperation extends MouseOperation {
    handle_press() {
        // On initial click, place/erase a thin wall on the nearest edge
        let edge = get_cell_edge(this.click_frac_cell_x, this.click_frac_cell_y);
        let cell = this.cell(this.click_cell_x, this.click_cell_y);
        this.affect_cell_edge(cell, edge);
    }
    handle_drag(client_x, client_y, frac_cell_x, frac_cell_y) {
        // Drawing should place a thin wall any time we cross the center line of a cell, either
        // horizontally or vertically.  Walk a double-size grid to find when this happens
        let prevhx = null, prevhy = null;
        for (let [hx, hy] of walk_grid(
            this.prev_frac_cell_x * 2, this.prev_frac_cell_y * 2, frac_cell_x * 2, frac_cell_y * 2,
            -1, -1, this.editor.stored_level.size_x * 2, this.editor.stored_level.size_y * 2))
        {
            let phx = prevhx;
            let phy = prevhy;
            prevhx = hx;
            prevhy = hy;

            if (phx === null || phy === null)
                continue;

            // 0 1 2 correspond to real grid lines 0 ½ 1, where only crossing the ½ is interesting
            let x, y, edge;
            if (hx === phx) {
                // Vertical move
                let crossed_y = Math.max(hy, phy);
                if (crossed_y % 2 === 0)
                    continue;

                x = Math.floor(hx / 2);
                y = Math.floor(crossed_y / 2);
                if (hx % 2 === 0) {
                    edge = 'west';
                }
                else {
                    edge = 'east';
                }
            }
            else {
                // Horizontal move
                let crossed_x = Math.max(hx, phx);
                if (crossed_x % 2 === 0)
                    continue;

                x = Math.floor(crossed_x / 2);
                y = Math.floor(hy / 2);
                if (hy % 2 === 0) {
                    edge = 'north';
                }
                else {
                    edge = 'south';
                }
            }

            this.affect_cell_edge(this.cell(x, y), edge);
        }
    }

    affect_cell_edge(cell, edge) {
        let bit = DIRECTIONS[edge].bit;
        let thin_wall = cell[LAYERS.thin_wall];
        console.log(cell, edge, thin_wall);
        if (this.ctrl) {
            // Erase -- mouse button doesn't matter
            if (thin_wall) {
                if (thin_wall.edges === bit) {
                    // Last edge, so erase it entirely
                    this.editor.erase_tile(cell, thin_wall);
                }
                else {
                    this.editor.place_in_cell(cell, {...thin_wall, edges: thin_wall.edges & ~bit});
                }
            }
        }
        else {
            // Place -- either a thin wall or a one-way wall, depending on mouse button
            let type = TILE_TYPES[this.alt_mode ? 'one_way_walls' : 'thin_walls'];
            if (thin_wall) {
                this.editor.place_in_cell(cell, { ...thin_wall, type, edges: thin_wall.edges | bit });
            }
            else {
                this.editor.place_in_cell(cell, { type, edges: bit });
            }
        }
    }

    cleanup_press() {
        this.editor.commit_undo();
    }
}


// -------------------------------------------------------------------------------------------------
// CONNECT

export class ConnectOperation extends MouseOperation {
    constructor(...args) {
        super(...args);

        // This is the SVGConnection structure but with only the source circle
        this.source_circle = mk_svg('circle.-source', {cx: 0.5, cy: 0.5, r: 0.5});
        this.source_cursor = mk_svg('g.overlay-connection.overlay-transient.--cursor', this.source_circle);
        this.target_square = mk_svg('rect.-target', {x: 0, y: 0, width: 1, height: 1});
        this.target_cursor = mk_svg('g.overlay-connection.overlay-transient.--cursor', this.target_square);
        this.editor.svg_overlay.append(this.source_cursor, this.target_cursor);
    }

    handle_hover(client_x, client_y, frac_cell_x, frac_cell_y, cell_x, cell_y) {
        if (cell_x === this.prev_cell_x && cell_y === this.prev_cell_y && ! this.hover_stale)
            return;

        this.hover_stale = false;
        let cell = this.cell(cell_x, cell_y);
        let terrain = cell[LAYERS.terrain];
        if (terrain.type.connects_to) {
            this.source_cursor.classList.add('--visible');
            this.source_cursor.setAttribute('transform', `translate(${cell_x} ${cell_y})`);
            this.target_cursor.classList.remove('--visible');
        }
        else {
            this.pending_sources = [];
            this.pending_cxns = [];
            let pt = this.editor.coords_to_scalar(cell_x, cell_y);
            this.pending_original_target = pt;
            for (let [src, dest] of this.editor.stored_level.custom_connections) {
                if (dest === pt) {
                    // Just take an arbitrary type as pending I guess
                    this.pending_type = this.editor.stored_level.linear_cells[src][LAYERS.terrain].type.name;
                    this.pending_sources.push(src);
                    this.pending_cxns.push(this.editor.connections_arrows.get(src));
                }
            }

            this.source_cursor.classList.remove('--visible');
            if (this.pending_sources.length > 0) {
                this.target_cursor.classList.add('--visible');
                this.target_cursor.setAttribute('transform', `translate(${cell_x} ${cell_y})`);
            }
            else {
                this.target_cursor.classList.remove('--visible');
            }
        }
    }

    handle_press(x, y) {
        // TODO restrict to button/cloner unless holding shift
        // TODO what do i do when you erase a button/cloner?  can i detect if you're picking it up?
        let pt = this.editor.coords_to_scalar(x, y);
        let cell = this.cell(x, y);
        let terrain = cell[LAYERS.terrain];
        if (this.alt_mode) {
            // Auto connect using Lynx rules
            // TODO just use the editor's existing implicits for this?
            let other = null;
            let swap = false;
            if (terrain.type.name === 'button_red') {
                other = this.search_for(cell, 'cloner', 1);
            }
            else if (terrain.type.name === 'cloner') {
                other = this.search_for(cell, 'button_red', -1);
                swap = true;
            }
            else if (terrain.type.name === 'button_brown') {
                other = this.search_for(cell, 'trap', 1);
            }
            else if (terrain.type.name === 'trap') {
                other = this.search_for(cell, 'button_brown', -1);
                swap = true;
            }

            if (other !== null) {
                if (swap) {
                    this.editor.set_custom_connection(other, pt);
                }
                else {
                    this.editor.set_custom_connection(pt, other);
                }
                this.editor.commit_undo();
            }
            return;
        }

        // Otherwise, this is the start of a drag, which could be one of two things...
        if (terrain.type.connects_to) {
            // This is a source, and we're dragging to a destination
            let cxn = new SVGConnection(x, y, x, y);
            this.pending_cxns = [cxn];
            this.pending_sources = [pt];
            this.pending_type = terrain.type.name;
            this.pending_original_target = null;
            this.editor.svg_overlay.append(cxn.element);
        }
        else {
            // This /might/ be a destination (or a stack of them)
            if (this.pending_sources.length === 0)
                return;
        }

        if (this.ctrl) {
            // Forget the drag, delete whatever was clicked
            for (let src of this.pending_sources) {
                this.editor.set_custom_connection(src, null);
            }
            this.editor.commit_undo();
            this.cleanup_press();
            return;
        }

        // Hide the normal cursors for the duration
        this.source_cursor.classList.remove('--visible');
        this.target_cursor.classList.remove('--visible');
    }
    search_for(start_cell, name, dir) {
        for (let [_, cell] of algorithms.find_terrain_linear(
            this.editor.stored_level, start_cell, new Set([name]), dir < 0))
        {
            return this.editor.coords_to_scalar(cell.x, cell.y);
        }
        return null;
    }
    handle_drag(client_x, client_y, frac_cell_x, frac_cell_y, cell_x, cell_y) {
        if (this.pending_cxns.length === 0)
            return;

        for (let cxn of this.pending_cxns) {
            cxn.set_dest(cell_x, cell_y);
        }

        let cell = this.cell(cell_x, cell_y);
        if (this.shift ||
            TILE_TYPES[this.pending_type].connects_to.has(cell[LAYERS.terrain].type.name))
        {
            this.pending_target = this.editor.coords_to_scalar(cell_x, cell_y);
            for (let cxn of this.pending_cxns) {
                cxn.element.style.opacity = '';
            }
        }
        else {
            this.pending_target = null;
            for (let cxn of this.pending_cxns) {
                cxn.element.style.opacity = 0.25;
            }
        }
    }
    commit_press() {
        if (this.pending_cxns.length === 0)
            return;

        if (this.pending_target === null) {
            this.abort_press();
            return;
        }

        for (let src of this.pending_sources) {
            this.editor.set_custom_connection(src, this.pending_target);
        }
        this.editor.commit_undo();
        if (this.pending_original_target !== null) {
            // If we were moving a target, then the connections we were altering were real ones, so
            // we need to clear them here to avoid having them removed in cleanup
            this.pending_cxns = [];
        }
    }
    abort_press() {
        if (this.pending_original_target !== null) {
            // If we were moving a target, then the connections we were altering were real ones, so
            // set them back to where they were
            let [x, y] = this.editor.scalar_to_coords(this.pending_original_target);
            for (let cxn of this.pending_cxns) {
                cxn.element.style.opacity = '';
                cxn.set_dest(x, y);
            }
            this.pending_cxns = [];
        }
    }
    cleanup_press() {
        for (let cxn of this.pending_cxns) {
            cxn.element.remove();
        }
        this.pending_cxns = [];

        this.hover_stale = true;
        this.rehover();
    }

    handle_refresh() {
        this.hover_stale = true;
    }

    do_destroy() {
        this.source_cursor.remove();
        this.target_cursor.remove();
        super.do_destroy();
    }
}


// -------------------------------------------------------------------------------------------------
// WIRE

export class WireOperation extends MouseOperation {
    constructor(...args) {
        super(...args);

        this.circuitry_g = mk_svg('g.overlay-circuitry', {'data-source': 'WireOperation'});
        this.editor.svg_overlay.append(this.circuitry_g);
    }

    handle_hover(client_x, client_y, frac_cell_x, frac_cell_y, cell_x, cell_y) {
        let edge = get_cell_edge(frac_cell_x, frac_cell_y);
        let edgebit = DIRECTIONS[edge].bit;
        let cell = this.cell(cell_x, cell_y);
        // Wire can only be in terrain or the circuit block, and this tool ignores circuit
        // blocks for circuit-tracing purposes
        let terrain = cell[LAYERS.terrain];
        // If this cell has no wire where we're aiming, do nothing, which includes leaving any
        // existing circuit alone
        if (! terrain.wire_directions || ! (terrain.wire_directions & edgebit))
            return;

        // If we're hovering a wire that's already part of the highlighted circuit, there's
        // nothing new to do
        if (this.circuit) {
            let edges = this.circuit.tiles.get(terrain);
            if (edges && (edges & DIRECTIONS[edge].bit))
                return;
        }

        // Otherwise, clear the current circuit and trace a new one
        // TODO what do we do when hovering a *cell* that touches multiple circuits?  like a
        // button?
        // TODO trace this through logic gates, at least one level?
        this.circuitry_g.textContent = '';

        let circuit = algorithms.trace_floor_circuit(this.editor.stored_level, 'ignore', cell, edge);
        // TODO uhoh, this is in terms of tiles and i don't have a way to get those at the moment
        let tiles_to_cells = new Map;
        for (let cell of this.editor.stored_level.linear_cells) {
            tiles_to_cells.set(cell[LAYERS.terrain], cell);
        }
        let wire_data = [];
        let tunnel_data = [];
        // TODO it would be convenient to reduce the number of wires happening here
        for (let [tile, edges] of circuit.tiles) {
            let cell = tiles_to_cells.get(tile);
            for (let [direction, dirinfo] of Object.entries(DIRECTIONS)) {
                if (edges & dirinfo.bit) {
                    let d = `M ${cell.x + 0.5},${cell.y + 0.5} l ${dirinfo.movement[0] * 0.5},${dirinfo.movement[1] * 0.5}`;
                    if (tile.wire_tunnel_directions & dirinfo.bit) {
                        tunnel_data.push(d);
                    }
                    else {
                        wire_data.push(d);
                    }
                }
            }
            if (! tile.wire_directions) {
                // This is an output tile, like a trap or flame jet, so mark it
                this.circuitry_g.append(mk_svg('circle.overlay-circuit-output', {
                    cx: cell.x + 0.5,
                    cy: cell.y + 0.5,
                    r: 0.1875,
                }));
            }
        }
        this.circuitry_g.append(
            mk_svg('path.overlay-circuit-wires', {d: wire_data.join(' ')}),
            mk_svg('path.overlay-circuit-tunnels', {d: tunnel_data.join(' ')}),
        );
        for (let [tile, edges] of circuit.inputs) {
            let cell = tiles_to_cells.get(tile);
            this.circuitry_g.append(mk_svg('circle.overlay-circuit-input', {
                cx: cell.x + 0.5,
                cy: cell.y + 0.5,
                r: 0.1875,
            }));
        }
    }

    handle_press() {
        if (this.alt_mode) {
            // Place or remove wire tunnels
            // TODO this could just be a separate tool now
            let cell = this.cell(this.click_frac_cell_x, this.click_frac_cell_y);
            if (! cell)
                return;

            let direction = get_cell_edge(this.click_frac_cell_x, this.click_frac_cell_y);
            let bit = DIRECTIONS[direction].bit;

            let terrain = cell[LAYERS.terrain];
            if (terrain.type.name === 'floor') {
                terrain = {...terrain};
                // TODO if this ever supports drag, remember whether we're adding or removing
                // initially
                if (terrain.wire_tunnel_directions & bit) {
                    terrain.wire_tunnel_directions &= ~bit;
                }
                else {
                    terrain.wire_tunnel_directions |= bit;
                }
                this.editor.place_in_cell(cell, terrain);
                this.editor.commit_undo();
            }
        }
        else {
            // A single click affects the edge of the touched cell
            this.affect_cell_edge(this.click_cell_x, this.click_cell_y,
                get_cell_edge(this.click_frac_cell_x, this.click_frac_cell_y));
        }
    }
    handle_drag(client_x, client_y, frac_cell_x, frac_cell_y) {
        if (this.alt_mode) {
            // Wire tunnels don't support dragging
            // TODO but maybe they should??  makes erasing a lot of them easier at least
            return;
        }

        // Wire is interesting.  Consider this diagram.
        // +-------+
        // | . A . |
        // |...A...|
        // | . A . |
        // |BBB+CCC|
        // | . D . |
        // |...D...|
        // | . D . |
        // +-------+
        // In order to know which of the four wire pieces in a cell (A, B, C, D) someone is trying
        // to draw over, we use a quarter-size grid, indicated by the dots.  Then any mouse movement
        // that crosses the first horizontal grid line means we should draw wire A.
        // Drawing across a cell border fills in the wire on BOTH sides of the border, and drawing
        // across a wire perpendicularly fills in both parts of the wire in that direction.
        // TODO maybe i should just have a walk_grid variant that yields line crossings, christ
        let prevqx = null, prevqy = null;
        for (let [qx, qy] of walk_grid(
            this.prev_frac_cell_x * 4, this.prev_frac_cell_y * 4, frac_cell_x * 4, frac_cell_y * 4,
            // See comment in iter_touched_cells
            -1, -1, this.editor.stored_level.size_x * 4, this.editor.stored_level.size_y * 4))
        {
            let pqx = prevqx;
            let pqy = prevqy;
            prevqx = qx;
            prevqy = qy;

            if (pqx === null || pqy === null)
                continue;

            // Figure out which grid line we've crossed; direction doesn't matter, so we just get
            // the index of the line, which matches the coordinate of the cell to the right/bottom
            // FIXME if you trace around just the outside of a tile, you'll get absolute nonsense:
            // +---+---+
            // |   |   |
            // |   |.+ |
            // |   |.| |
            // +---+.--+
            // | ....  |
            // | +-|   |
            // |   |   |
            // +---+---+
            if (qx === pqx) {
                // Vertical
                let x = Math.floor(qx / 4);
                let y0 = Math.floor(pqy / 4);
                let y1 = Math.floor(qy / 4);
                if (y0 !== y1) {
                    // We crossed a cell boundary, so draw the wire on both sides
                    this.affect_cell_edge(x, Math.min(y0, y1), 'south');
                    this.affect_cell_edge(x, Math.max(y0, y1), 'north');
                    continue;
                }

                let line = Math.max(qy, pqy);
                // Even crossings don't correspond to a wire
                if (line % 2 === 0)
                    continue;

                let y = Math.floor(line / 4);
                if (line % 4 === 1) {
                    // Consult the diagram!
                    this.affect_cell_edge(x, y, 'north');
                }
                else {
                    this.affect_cell_edge(x, y, 'south');
                }
            }
            else {
                // Horizontal; same as above
                let x0 = Math.floor(pqx / 4);
                let x1 = Math.floor(qx / 4);
                let y = Math.floor(qy / 4);
                if (x0 !== x1) {
                    this.affect_cell_edge(Math.min(x0, x1), y, 'east');
                    this.affect_cell_edge(Math.max(x0, x1), y, 'west');
                    continue;
                }

                let line = Math.max(qx, pqx);
                // Even crossings don't correspond to a wire
                if (line % 2 === 0)
                    continue;

                let x = Math.floor(line / 4);
                if (line % 4 === 1) {
                    // Consult the diagram!
                    this.affect_cell_edge(x, y, 'west');
                }
                else {
                    this.affect_cell_edge(x, y, 'east');
                }
            }
        }
    }

    affect_cell_edge(x, y, edge) {
        let cell = this.cell(x, y);
        if (! cell)
            return;

            for (let tile of Array.from(cell).reverse()) {
                // TODO probably a better way to do this
                if (! tile)
                    continue;
                if (! tile.type.contains_wire)
                    continue;

                tile = {...tile};
                tile.wire_directions = tile.wire_directions ?? 0;
                if (this.ctrl) {
                    // Erase
                    tile.wire_directions &= ~DIRECTIONS[edge].bit;
                }
                else {
                    // Draw
                    tile.wire_directions |= DIRECTIONS[edge].bit;
                }
                this.editor.place_in_cell(cell, tile);
                break;
            }
    }
    cleanup_press() {
        this.editor.commit_undo();
    }

    do_destroy() {
        this.circuitry_g.remove();
        super.do_destroy();
    }
}


// -------------------------------------------------------------------------------------------------
// ROTATE

// TODO hmm there's no way to rotate the wires on a circuit block without rotating the block itself
// TODO this highlights blocks even though they don't usually show their direction...
// maybe put a pencil-like preview tile on here that highlights the tile being targeted, and also
// forces showing the arrow on blocks?
export class RotateOperation extends MouseOperation {
    constructor(...args) {
        super(...args);
        this.hovered_layer = null;

        this.set_cursor_element(mk_svg('circle.overlay-transient.overlay-adjust-cursor', {
            cx: 0.5,
            cy: 0.5,
            r: 0.75,
        }));
        // TODO better preview
        /*
        let renderer = this.editor.renderer;
        this.canvas = mk('canvas', {
            width: renderer.tileset.size_x,
            height: renderer.tileset.size_y,
        });
        // Need an extra <g> here so the translate transform doesn't clobber the scale on the
        // foreignObject
        this.set_cursor_element(mk_svg('g.overlay-transient',
            mk_svg('foreignObject', {
                x: 0,
                y: 0,
                width: this.canvas.width,
                height: this.canvas.height,
                transform: `scale(${1/renderer.tileset.size_x} ${1/renderer.tileset.size_y})`,
                opacity: 0.75,
            }, this.canvas),
        ));
        */
    }

    _find_target_tile(cell) {
        for (let layer = LAYERS.MAX - 1; layer >= 0; layer--) {
            if (! this.editor.is_layer_selected(layer))
                continue;

            let tile = cell[layer];
            if (! tile)
                continue;

            // Detecting if a tile is rotatable is, uhh, a little, complicated
            if (tile.type.is_actor) {
                return layer;
            }
            // The counter doesn't actually rotate
            if (tile.type.name === 'logic_gate' && tile.gate_type === 'counter') {
                continue;
            }
            let behavior = SPECIAL_TILE_BEHAVIOR[tile.type.name];
            if (behavior && behavior.rotate_left) {
                return layer;
            }

            if (tile.wire_directions || tile.wire_tunnel_directions) {
                return layer;
            }
        }

        return null;
    }

    handle_hover(client_x, client_y, frac_cell_x, frac_cell_y, cell_x, cell_y) {
        // TODO hrmm if we undo without moving the mouse then this becomes wrong (even without the
        // stuff here)
        // TODO uhhh that's true for all kinds of kb shortcuts actually, even for pressing/releasing
        // ctrl or shift to change the target.  dang

        let cell = this.cell(cell_x, cell_y);
        let layer = this._find_target_tile(cell);
        this.hovered_layer = layer;

        if (layer === null) {
            this.cursor_element.classList.remove('--visible');
            return;
        }

        this.cursor_element.classList.add('--visible');
        if (layer === LAYERS.terrain) {
            this.cursor_element.setAttribute('data-layer', 'terrain');
        }
        else if (layer === LAYERS.item) {
            this.cursor_element.setAttribute('data-layer', 'item');
        }
        else if (layer === LAYERS.actor) {
            this.cursor_element.setAttribute('data-layer', 'actor');
        }
        else if (layer === LAYERS.thin_wall) {
            this.cursor_element.setAttribute('data-layer', 'thin-wall');
        }
    }

    handle_press() {
        let cell = this.cell(this.prev_cell_x, this.prev_cell_y);
        if (this.hovered_layer === null)
            return;
        let tile = cell[this.hovered_layer];
        if (! tile)
            return;

        let rotated;
        tile = {...tile}; // TODO little inefficient
        if (this.alt_mode) {
            // Reverse, go counterclockwise
            rotated = this.editor.rotate_tile_left(tile);
        }
        else {
            rotated = this.editor.rotate_tile_right(tile);
        }
        if (rotated) {
            this.editor.place_in_cell(cell, tile);
            this.editor.commit_undo();
            return;
        }
    }

    // Rotate tool doesn't support dragging
    // TODO should it?
}


// -------------------------------------------------------------------------------------------------
// ADJUST

// This tool does a lot of things:
// Toggles tile types:
// - Most actors and items get transmogrified
// - Custom walls/floors get recolored
// - Force floors get flipped
// - etc
// Custom in-map tile editing
// - Toggles individual edges of thin walls (either kind)
// - Sets swivel direction
// - Toggles individual track pieces
// - Toggles individual frame block arrows
// Pops open tile overlays
// - Edit letter tile
// - Edit hint text
// - (NOT edit frame block; that's custom)
// - (NOT edit track; that's custom)
// Presses buttons:
// - Gray button (with preview)
// - Green button
// Previews things:
// - Monster pathing
// - Force floor/ice pathing



// Tiles the "adjust" tool will turn into each other
const ADJUST_TILE_TYPES = {};
const ADJUST_GATE_TYPES = {};
{
    // Try to make these intuitive, the kind of things someone would naturally want to alter in a
    // very small way.  The "other one".
    for (let [verb, ...cycle] of [
        ["Swap",    'player', 'player2'],
        ["Swap",    'chip', 'chip_extra'],
        // TODO shouldn't this convert regular walls into regular floors then?  or...  steel, if it
        // has wires in it...?
        // TODO annoying that there are two obvious kinds of change to make here
        ["Recolor", 'floor_custom_pink', 'floor_custom_blue', 'floor_custom_yellow', 'floor_custom_green'],
        ["Recolor", 'wall_custom_pink', 'wall_custom_blue', 'wall_custom_yellow', 'wall_custom_green'],
        ["Recolor", 'door_red', 'door_blue', 'door_yellow', 'door_green'],
        ["Recolor", 'key_red', 'key_blue', 'key_yellow', 'key_green'],
        ["Recolor", 'teleport_red', 'teleport_blue', 'teleport_yellow', 'teleport_green'],
        ["Recolor", 'gate_red', 'gate_blue', 'gate_yellow', 'gate_green'],
        ["Toggle",  'green_floor', 'green_wall'],
        ["Toggle",  'green_bomb', 'green_chip'],
        ["Toggle",  'purple_floor', 'purple_wall'],
        ["Swap",    'fake_floor', 'fake_wall'],
        ["Swap",    'popdown_floor', 'popdown_wall'],
        ["Swap",    'wall_invisible', 'wall_appearing'],
        ["Swap",    'thief_keys', 'thief_tools'],
        /*
        ['swivel_nw', 'swivel_ne', 'swivel_se', 'swivel_sw'],
        ['ice_nw', 'ice_ne', 'ice_se', 'ice_sw'],
        ['force_floor_n', 'force_floor_e', 'force_floor_s', 'force_floor_w'],
        */
        /*
        ["Flip",    'force_floor_n', 'force_floor_s'],
        ["Flip",    'force_floor_e', 'force_floor_w'],
        */
        ["Swap",    'water', 'turtle'],
        ["Swap",    'no_player1_sign', 'no_player2_sign'],
        ["Toggle",  'flame_jet_off', 'flame_jet_on'],
        ["Flip",    'light_switch_off', 'light_switch_on'],
        ["Swap",    'stopwatch_bonus', 'stopwatch_penalty'],
        ["Swap",    'turntable_cw', 'turntable_ccw'],
        ["Swap",    'score_10', 'score_100', 'score_1000'],
        ["Swap",    'dirt_block', 'ice_block'],

        ["Swap",    'doppelganger1', 'doppelganger2'],
        ["Swap",    'ball', 'tank_blue'],
        ["Swap",    'fireball', 'glider'],
        ["Swap",    'bug', 'paramecium'],
        ["Swap",    'walker', 'blob'],
        ["Swap",    'teeth', 'teeth_timid'],
    ])
    {
        for (let [i, type] of cycle.entries()) {
            ADJUST_TILE_TYPES[type] = {
                verb,
                next: cycle[(i + 1) % cycle.length],
                prev: cycle[(i - 1 + cycle.length) % cycle.length],
            };
        }
    }

    for (let cycle of [
        ['not', 'diode'],
        ['and', 'or', 'xor', 'nand'],
        ['latch-cw', 'latch-ccw'],
    ])
    {
        for (let [i, type] of cycle.entries()) {
            ADJUST_GATE_TYPES[type] = {
                next: cycle[(i + 1) % cycle.length],
                prev: cycle[(i - 1 + cycle.length) % cycle.length],
            };
        }
    }
}
// Little wrapper that allows calling (simple) callbacks on tile types from the editor.
// Note that editor tiles don't even have .cell, so we have to fake that too
class DummyRunningLevel {
    constructor(editor, tile, cell) {
        this.editor = editor;
        this.tile = tile;
        this.cell = cell;
    }

    _set_tile_prop(tile, key, value) {
        if (tile !== this.tile) {
            console.error("DummyRunningLevel._set_tile_prop called on an unknown tile:", tile, "expected:", this.tile);
            return;
        }

        this.editor.place_in_cell(this.cell, {...tile, key: value});
    }

    transmute_tile(tile, type_name) {
        if (tile !== this.tile) {
            console.error("DummyRunningLevel.transmute_tile called on an unknown tile:", tile, "expected:", this.tile);
            return;
        }
        let type = TILE_TYPES[type_name];
        if (! type) {
            console.error("DummyRunningLevel.transmute_tile called with bad type:", type_name);
            return;
        }
        if (tile.type.layer !== type.layer) {
            console.error("DummyRunningLevel.transmute_tile refusing to change tile layers:", tile, type_name);
            return;
        }

        this.editor.place_in_cell(this.cell, {...tile, type});
    }
}
// Tiles with special behavior when clicked
const ADJUST_SPECIAL = {
    button_blue(editor) {
        // Flip blue tanks
        editor._do(
            () => ADJUST_SPECIAL._button_blue(editor),
            () => ADJUST_SPECIAL._button_blue(editor),
        );
        // TODO play button sound?
    },
    _button_blue(editor) {
        for (let cell of editor.stored_level.linear_cells) {
            let actor = cell[LAYERS.actor];
            if (actor && actor.type.name === 'tank_blue') {
                actor.direction = DIRECTIONS[actor.direction].opposite;
                editor.mark_cell_dirty(cell);
            }
        }
    },
    button_green(editor) {
        // Toggle green objects
        editor._do(
            () => ADJUST_SPECIAL._button_green(editor),
            () => ADJUST_SPECIAL._button_green(editor),
        );
        // TODO play button sound?
    },
    _button_green(editor) {
        for (let cell of editor.stored_level.linear_cells) {
            for (let tile of cell) {
                if (tile && tile.type.green_toggle_counterpart) {
                    tile.type = TILE_TYPES[tile.type.green_toggle_counterpart];
                    editor.mark_cell_dirty(cell);
                }
            }
        }
    },
    button_gray(editor, tile, cell) {
        // Toggle gray objects...  er...  objects affected by gray buttons
        // TODO right-click should allow toggling backwards!
        for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
                if (dx === 0 && dy === 0)
                    continue;
                let other_cell = editor.cell(cell.x + dx, cell.y + dy);
                if (! other_cell)
                    continue;

                for (let other of other_cell) {
                    if (other && other.type.on_gray_button && other.type.is_gray_button_editor_safe) {
                        other.type.on_gray_button(other, new DummyRunningLevel(editor, other, other_cell));
                    }
                }
            }
        }
    },

    button_pink(editor, tile, cell) {
    },
};
// FIXME the preview is not very good because the hover effect becomes stale, pressing ctrl/shift
// leaves it stale, etc
export class AdjustOperation extends MouseOperation {
    constructor(...args) {
        super(...args);

        this.gray_button_preview = mk_svg('g.overlay-transient', {'data-source': 'AdjustOperation'});
        this.gray_button_bounds_rect = mk_svg('rect.overlay-adjust-gray-button-radius', {
            x: -2,
            y: -2,
            width: 5,
            height: 5,
        });
        this.gray_button_preview.append(this.gray_button_bounds_rect);
        this.editor.svg_overlay.append(this.gray_button_preview);

        // Cool octagon
        /*
        this.set_cursor_element(mk_svg('path.overlay-transient.overlay-adjust-cursor', {
            //d: 'M -0.25,-0.25 L 0.5,-0.5 L 1.25,-0.25 L 1.5,0.5' +
            //    'L 1.25,1.25 L 0.5,1.5 L -0.25,1.25 L -0.5,0.5 z',
            //d: 'M 0.5,0.5 m 0.75,-0.75 l 0.75,-0.25 l 0.75,0.25 l 0.25,0.75' +
            //    'l -0.25,0.75 l -0.75,0.25 l -0.75,-0.25 l -0.25,-0.75 z',
            d: 'M 0.5,0.5 m -0.5,-0.5 l 0.5,-0.125 l 0.5,0.125 l 0.125,0.5' +
                'l -0.125,0.5 l -0.5,0.125 l -0.5,-0.125 l -0.125,-0.5 z',
        }));
        */
        // The cursor is the tile being targeted, drawn with high opacity atop the rest of the cell,
        // to hopefully make it clear which layer we're looking at
        let renderer = this.editor.renderer;
        this.canvas = mk('canvas', {
            width: renderer.tileset.size_x,
            height: renderer.tileset.size_y,
        });
        // Need an extra <g> here so the translate transform doesn't clobber the scale on the
        // foreignObject
        this.set_cursor_element(mk_svg('g.overlay-transient',
            mk_svg('foreignObject', {
                x: 0,
                y: 0,
                width: this.canvas.width,
                height: this.canvas.height,
                transform: `scale(${1/renderer.tileset.size_x} ${1/renderer.tileset.size_y})`,
                opacity: 0.75,
            }, this.canvas),
        ));

        this.click_hint = mk_svg('text.overlay-adjust-hint.overlay-transient');
        this.editor.svg_overlay.append(this.click_hint);

        this.hovered_layer = null;
    }

    // The real work happens on hover, since we need to actually adjust the tile in order to preview
    // it anyway; clicking just commits it.
    handle_hover(client_x, client_y, frac_cell_x, frac_cell_y, cell_x, cell_y) {
        // TODO hrmm if we undo without moving the mouse then this becomes wrong (even without the
        // stuff here)
        // TODO uhhh that's true for all kinds of kb shortcuts actually, even for pressing/releasing
        // ctrl or shift to change the target.  dang
        /*
         * XXX this is wrong for e.g. ice corners
        if (cell_x === this.prev_cell_x && cell_y === this.prev_cell_y &&
            (! this.hovered_edge || this.hovered_edge === get_cell_edge(frac_cell_x, frac_cell_y)) &&
            ! this.hover_stale)
        {
            return;
        }
        */

        let cell = this.cell(cell_x, cell_y);

        // Find our target tile, and in most cases, adjust it
        this.hover_stale = false;
        this.adjusted_tile = null;
        this.hovered_edge = null;
        for (let layer = LAYERS.MAX - 1; layer >= 0; layer--) {
            if (! this.editor.is_layer_selected(layer))
                continue;

            let tile = cell[layer];
            if (! tile)
                continue;

            // This is where the real work happens, and thus it's a list of everything the adjust
            // tool can possibly do

            // Transmogrify tiles
            if (ADJUST_TILE_TYPES[tile.type.name]) {
                // Toggle between related tile types
                let adjustment = ADJUST_TILE_TYPES[tile.type.name];
                //verb = adjustment.verb;
                this.adjusted_tile = {...tile, type: TILE_TYPES[adjustment.next]};
                break;
            }
            // Transmogrify logic gates
            if (tile.type.name === 'logic_gate' && ADJUST_GATE_TYPES[tile.gate_type]) {
                // Also toggle between related logic gate types
                //verb = "Change";
                this.adjusted_tile = {...tile, gate_type: ADJUST_GATE_TYPES[tile.gate_type].next};
                break;
            }

            // Set swivel corner
            if (layer === LAYERS.swivel) {
                let corner = get_cell_corner(frac_cell_x, frac_cell_y);
                let swivel_type = ['swivel_ne', 'swivel_se', 'swivel_sw', 'swivel_nw'][corner];
                this.adjusted_tile = {...tile, type: TILE_TYPES[swivel_type]};
                break;
            }

            // Place or delete individual thin walls
            // FIXME uhhh need to erase the tile on mouse move or on right-click
            if (layer === LAYERS.thin_wall) {
                let edge = get_cell_edge(frac_cell_x, frac_cell_y);
                this.hovered_edge = edge;
                this.adjusted_tile = {...tile};
                this.adjusted_tile.edges ^= DIRECTIONS[edge].bit;
                break;
            }

            // Change the direction of force floors
            if (FORCE_FLOOR_TILES.has(tile.type.name)) {
                let edge = get_cell_edge_or_center(frac_cell_x, frac_cell_y);
                if (edge === null) {
                    this.adjusted_tile = {...tile, type: TILE_TYPES['force_floor_all']};
                }
                else {
                    this.adjusted_tile = {...tile, type: TILE_TYPES[FORCE_FLOOR_TILES_BY_DIRECTION[edge]]};
                }
                break;
            }

            // Change the direction of ice corners
            if (ICE_TILES.has(tile.type.name)) {
                let ice_type;
                if (is_cell_center(frac_cell_x, frac_cell_y)) {
                    ice_type = 'ice';
                }
                else {
                    let corner = get_cell_corner(frac_cell_x, frac_cell_y);
                    ice_type = ['ice_ne', 'ice_se', 'ice_sw', 'ice_nw'][corner];
                }

                this.adjusted_tile = {...tile, type: TILE_TYPES[ice_type]};
                break;
            }

            // Edit railroad tiles
            if (tile.type.name === 'railroad') {
                // Locate the cursor on a 3×3 grid
                let tri_x = Math.floor(frac_cell_x % 1 * 3);
                let tri_y = Math.floor(frac_cell_y % 1 * 3);
                let tri = tri_x + 3 * tri_y;
                let segment = [3, 5, 0, 4, null, 4, 2, 5, 1][tri];
                this.adjusted_tile = {...tile};
                if (segment === null) {
                    // Toggle track switch
                    if (tile.track_switch === null) {
                        // Add it.  Select the first extant track switch, or default to 0
                        this.adjusted_tile.track_switch = 0;
                        for (let i = 0; i < tile.type.track_order.length; i++) {
                            if (tile.tracks & (1 << i)) {
                                this.adjusted_tile.track_switch = i;
                                break;
                            }
                        }
                    }
                    else {
                        // Remove it
                        this.adjusted_tile.track_switch = null;
                    }
                }
                else {
                    let bit = 1 << segment;
                    // Toggle the presence of a track segment
                    if (tile.track_switch === null) {
                        if (tile.tracks & bit) {
                            this.adjusted_tile.tracks &= ~bit;
                        }
                        else {
                            this.adjusted_tile.tracks |= bit;
                        }
                    }
                    else {
                        // If there's a track switch...
                        if (tile.track_switch === segment) {
                            // Clicking an active segment removes it and cycles the switch
                            this.adjusted_tile.tracks &= ~(1 << segment);
                            for (let i = 0; i < tile.type.track_order.length; i++) {
                                let s = (segment + i) % tile.type.track_order.length;
                                if (tile.tracks & (1 << s)) {
                                    this.adjusted_tile.track_switch = s;
                                    break;
                                }
                            }
                        }
                        else if (tile.tracks & bit) {
                            // Clicking a present but inactive segment makes it active
                            this.adjusted_tile.track_switch = segment;
                        }
                        else {
                            // Clicking a missing segment adds it
                            this.adjusted_tile.tracks |= bit;
                        }
                    }
                }
                break;
            }

            // Do faux-rotation: alter letter tiles, counter gates
            // TODO can i do this backwards?
            let behavior = SPECIAL_TILE_BEHAVIOR[tile.type.name];
            if (behavior && behavior.adjust_forward) {
                //verb = "Adjust";
                this.adjusted_tile = {...tile};
                behavior.adjust_forward(this.adjusted_tile);
                break;
            }

            // Place or delete individual frame block arrows
            if (tile.type.name === 'frame_block') {
                // TODO this kinda obviates the need for a frame block editor
                this.adjusted_tile = {...tile, arrows: new Set(tile.arrows)};
                let edge = get_cell_edge(frac_cell_x, frac_cell_y);
                this.hovered_edge = edge;
                if (this.adjusted_tile.arrows.has(edge)) {
                    this.adjusted_tile.arrows.delete(edge);
                }
                else {
                    this.adjusted_tile.arrows.add(edge);
                }
                break;
            }

            // Press certain buttons
            if (tile.type.name === 'button_gray' || tile.type.name === 'button_green' || tile.type.name === 'button_blue' ||
                tile.type.name === 'button_pink' || tile.type.name === 'button_black')
            {
                this.adjusted_tile = {...tile, _editor_pressed: ! tile._editor_pressed};
                break;
            }

            // These are
            // TODO need a single-click thing to do for 

            // TODO hmm. what do i do with these
            /*
            if (TILES_WITH_PROPS[tile.type.name]) {
                // Open special tile editors
                return [layer, "Edit"];
            }

            if (ADJUST_SPECIAL[tile.type.name]) {
                return [layer, "Press"];
            }
            */
        }
        /*
        if (hint === null) {
            this.click_hint.classList.remove('--visible');
        }
        else {
            this.click_hint.classList.add('--visible');
            this.click_hint.setAttribute('x', cell_x + 0.5);
            this.click_hint.setAttribute('y', cell_y - 0.125);
            this.click_hint.textContent = hint;
        }
        */

        if (! this.adjusted_tile) {
            this.cursor_element.classList.remove('--visible');
            this.gray_button_preview.classList.remove('--visible');
            return;
        }

        // Draw the altered tile on top of everything else
        this.cursor_element.classList.add('--visible');
        let ctx = this.canvas.getContext('2d');
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.adjusted_tile.type.layer !== LAYERS.terrain) {
            this.editor.renderer.draw_single_tile_type('floor', null, this.canvas);
        }
        this.editor.renderer.draw_single_tile_type(
            this.adjusted_tile.type.name, this.adjusted_tile, this.canvas);

        // Special previewing behavior
        if (this.adjusted_tile.type.name === 'button_gray') {
            this.gray_button_preview.classList.add('--visible');
            let gx0 = Math.max(0, cell_x - 2);
            let gy0 = Math.max(0, cell_y - 2);
            let gx1 = Math.min(this.editor.stored_level.size_x - 1, cell_x + 2);
            let gy1 = Math.min(this.editor.stored_level.size_y - 1, cell_y + 2);

            this.gray_button_bounds_rect.setAttribute('x', gx0);
            this.gray_button_bounds_rect.setAttribute('y', gy0);
            this.gray_button_bounds_rect.setAttribute('width', gx1 - gx0 + 1);
            this.gray_button_bounds_rect.setAttribute('height', gy1 - gy0 + 1);
            for (let el of this.gray_button_preview.querySelectorAll('rect.overlay-adjust-gray-button-shroud')) {
                el.remove();
            }
            // The easiest way I can find to preview this is to slap an overlay on everything NOT
            // affected by the button.  Try to consolidate some of the resulting rectangles though
            for (let y = gy0; y <= gy1; y++) {
                let last_rect, last_x;
                for (let x = gx0; x <= gx1; x++) {
                    let target = this.cell(x, y);
                    if (target && (target === cell || target[LAYERS.terrain].type.on_gray_button))
                        continue;

                    if (last_rect && last_x === x - 1) {
                        last_rect.setAttribute('width', 1 + parseInt(last_rect.getAttribute('width'), 10));
                    }
                    else {
                        last_rect = mk_svg('rect.overlay-adjust-gray-button-shroud', {
                            x: x,
                            y: y,
                            width: 1,
                            height: 1,
                        });
                        this.gray_button_preview.append(last_rect);
                    }
                    last_x = x;
                }
            }
        }
        else {
            this.gray_button_preview.classList.remove('--visible');
        }
    }

    handle_press() {
        let cell = this.cell(this.prev_cell_x, this.prev_cell_y);

        // Right-click: open an overlay showing every tile in the cell
        if (this.alt_mode) {
            let overlay = new CellEditorOverlay(this.editor.conductor);
            overlay.edit_cell(cell);
            overlay.open_balloon(this.editor.renderer.get_cell_rect(cell.x, cell.y));
            return;
        }

        if (! this.adjusted_tile)
            return;

        if (this.adjusted_tile && this.adjusted_tile.type.name === 'button_pink') {
            // FIXME this is just a rough first attempt it's not very good
            this.editor.place_in_cell(cell, this.adjusted_tile);
            for (let [direction, dirinfo] of Object.entries(DIRECTIONS)) {
                if (! (this.adjusted_tile.wire_directions & dirinfo.bit))
                    continue;
                let circuit = algorithms.trace_floor_circuit(
                    this.editor.stored_level, 'ignore', cell, direction);
                for (let [tile, edges] of circuit.tiles) {
                    //this.editor.mark_cell_dirty(tile.cell);
                    tile.powered_edges |= edges;
                    console.log(tile, tile.powered_edges);
                }
            }
            this.editor.redraw_entire_level();
            this.editor.commit_undo();
            this.handle_refresh();
            this.rehover();
        }
        else if (ADJUST_SPECIAL[this.adjusted_tile.type.name]) {
            ADJUST_SPECIAL[this.adjusted_tile.type.name](this.editor, this.adjusted_tile, cell);
            this.editor.commit_undo();
        }
        // Don't actually press buttons!
        else if (this.adjusted_tile && ! this.adjusted_tile._editor_pressed) {
            this.editor.place_in_cell(cell, this.adjusted_tile);
            this.editor.commit_undo();
            // The tile has changed, so invalidate our hover
            // TODO should the editor do this automatically, since the cell changed?
            this.handle_refresh();
            this.rehover();
        }
        /*
        else if (TILES_WITH_PROPS[tile.type.name]) {
            // Open special tile editors -- this is a last resort, which is why right-click does it
            // explicitly
            this.editor.open_tile_prop_overlay(
                tile, cell, this.editor.renderer.get_cell_rect(cell.x, cell.y));
        }
        */
    }

    handle_refresh() {
        this.hover_stale = true;
    }

    // Adjust tool doesn't support dragging
    // TODO should it?
    // TODO if it does then it should end as soon as you spawn a popup
    do_destroy() {
        this.gray_button_preview.remove();
        this.click_hint.remove();
        super.do_destroy();
    }
}


// -------------------------------------------------------------------------------------------------
// CAMERA

// FIXME currently allows creating outside the map bounds and moving beyond the right/bottom, sigh
// FIXME undo
// TODO view is not especially visible
export class CameraOperation extends MouseOperation {
    handle_press(x, y, ev) {
        this.offset_x = 0;
        this.offset_y = 0;
        this.resize_x = 0;
        this.resize_y = 0;

        let cursor;

        this.target = ev.target.closest('.overlay-camera');
        if (! this.target) {
            // Clicking in empty space creates a new camera region
            this.mode = 'create';
            cursor = 'move';
            this.region = new DOMRect(this.click_cell_x, this.click_cell_y, 1, 1);
            this.target = mk_svg('rect.overlay-camera', {
                x: this.click_cell_x, y: this.prev_cell_y, width: 1, height: 1,
                'data-region-index': this.editor.stored_level.camera_regions.length,
            });
            this.editor.connections_g.append(this.target);
        }
        else {
            this.region = this.editor.stored_level.camera_regions[parseInt(this.target.getAttribute('data-region-index'), 10)];

            // If we're grabbing an edge, resize it
            let rect = this.target.getBoundingClientRect();
            let grab_left = (this.click_client_x < rect.left + 16);
            let grab_right = (this.click_client_x > rect.right - 16);
            let grab_top = (this.click_client_y < rect.top + 16);
            let grab_bottom = (this.click_client_y > rect.bottom - 16);
            if (grab_left || grab_right || grab_top || grab_bottom) {
                this.mode = 'resize';

                if (grab_left) {
                    this.resize_edge_x = -1;
                }
                else if (grab_right) {
                    this.resize_edge_x = 1;
                }
                else {
                    this.resize_edge_x = 0;
                }

                if (grab_top) {
                    this.resize_edge_y = -1;
                }
                else if (grab_bottom) {
                    this.resize_edge_y = 1;
                }
                else {
                    this.resize_edge_y = 0;
                }

                if ((grab_top && grab_left) || (grab_bottom && grab_right)) {
                    cursor = 'nwse-resize';
                }
                else if ((grab_top && grab_right) || (grab_bottom && grab_left)) {
                    cursor = 'nesw-resize';
                }
                else if (grab_top || grab_bottom) {
                    cursor = 'ns-resize';
                }
                else {
                    cursor = 'ew-resize';
                }
            }
            else {
                this.mode = 'move';
                cursor = 'move';
            }
        }

        this.editor.viewport_el.style.cursor = cursor;

        // Create a text element to show the size while editing
        this.size_text = mk_svg('text.overlay-edit-tip');
        this._update_size_text();
        this.editor.svg_overlay.append(this.size_text);
    }
    _update_size_text() {
        this.size_text.setAttribute('x', this.region.x + this.offset_x + (this.region.width + this.resize_x) / 2);
        this.size_text.setAttribute('y', this.region.y + this.offset_y + (this.region.height + this.resize_y) / 2);
        this.size_text.textContent = `${this.region.width + this.resize_x} × ${this.region.height + this.resize_y}`;
    }
    handle_drag(client_x, client_y, frac_cell_x, frac_cell_y, cell_x, cell_y) {
        // FIXME not right if we zoom, should use frac_cell_x
        let dx = Math.floor((client_x - this.click_client_x) / this.editor.renderer.tileset.size_x + 0.5);
        let dy = Math.floor((client_y - this.click_client_y) / this.editor.renderer.tileset.size_y + 0.5);

        let stored_level = this.editor.stored_level;
        if (this.mode === 'create') {
            // Just make the new region span between the original click and the new position
            this.region.x = Math.min(cell_x, this.click_cell_x);
            this.region.y = Math.min(cell_y, this.click_cell_y);
            this.region.width = Math.max(cell_x, this.click_cell_x) + 1 - this.region.x;
            this.region.height = Math.max(cell_y, this.click_cell_y) + 1 - this.region.y;
        }
        else if (this.mode === 'move') {
            // Keep it within the map!
            this.offset_x = Math.max(- this.region.x, Math.min(stored_level.size_x - this.region.width, dx));
            this.offset_y = Math.max(- this.region.y, Math.min(stored_level.size_y - this.region.height, dy));
        }
        else {
            // Resize, based on the edge we originally grabbed
            if (this.resize_edge_x < 0) {
                // Left
                dx = Math.max(-this.region.x, Math.min(this.region.width - 1, dx));
                this.resize_x = -dx;
                this.offset_x = dx;
            }
            else if (this.resize_edge_x > 0) {
                // Right
                dx = Math.max(-(this.region.width - 1), Math.min(stored_level.size_x - this.region.right, dx));
                this.resize_x = dx;
                this.offset_x = 0;
            }

            if (this.resize_edge_y < 0) {
                // Top
                dy = Math.max(-this.region.y, Math.min(this.region.height - 1, dy));
                this.resize_y = -dy;
                this.offset_y = dy;
            }
            else if (this.resize_edge_y > 0) {
                // Bottom
                dy = Math.max(-(this.region.height - 1), Math.min(stored_level.size_y - this.region.bottom, dy));
                this.resize_y = dy;
                this.offset_y = 0;
            }
        }

        this.target.setAttribute('x', this.region.x + this.offset_x);
        this.target.setAttribute('y', this.region.y + this.offset_y);
        this.target.setAttribute('width', this.region.width + this.resize_x);
        this.target.setAttribute('height', this.region.height + this.resize_y);
        this._update_size_text();
    }
    commit_press() {
        if (this.mode === 'create') {
            // Region is already updated, just add it to the level
            this.editor.stored_level.camera_regions.push(this.region);
        }
        else {
            // Actually edit the underlying region
            this.region.x += this.offset_x;
            this.region.y += this.offset_y;
            this.region.width += this.resize_x;
            this.region.height += this.resize_y;
        }
    }
    abort_press() {
        if (this.mode === 'create') {
            // The element was fake, so delete it
            this.target.remove();
        }
        else {
            // Move the element back to its original location
            this.target.setAttribute('x', this.region.x);
            this.target.setAttribute('y', this.region.y);
            this.target.setAttribute('width', this.region.width);
            this.target.setAttribute('height', this.region.height);
        }
    }
    cleanup_press() {
        this.editor.viewport_el.style.cursor = '';
        this.size_text.remove();
    }
}

export class CameraEraseOperation extends MouseOperation {
    handle_press(x, y, ev) {
        let target = ev.target.closest('.overlay-camera');
        if (target) {
            let index = parseInt(target.getAttribute('data-region-index'), 10);
            target.remove();
            this.editor.stored_level.camera_regions.splice(index, 1);
        }
    }
}
