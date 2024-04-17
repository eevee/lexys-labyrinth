// Types that handle mouse activity for a given tool, whether the mouse button is current held or
// not.  (When the mouse button is /not/ held, then only the operation bound to the left mouse
// button gets events.)
import { DIRECTIONS, LAYERS } from '../defs.js';
import TILE_TYPES from '../tiletypes.js';
import { mk, mk_svg, walk_grid } from '../util.js';

import { SVGConnection } from './helpers.js';
import { TILES_WITH_PROPS } from './tile-overlays.js';

// TODO some minor grievances
// - the track overlay doesn't explain "direction" (may not be necessary anyway), allows picking a
// bad initial switch direction
// - track tool should add a switch to a track on right-click, if possible (and also probably delete
// it on ctrl-right-click?)
// - no preview tile with force floor or track tool
// - no ice drawing tool
// - cursor box shows with selection tool which seems inappropriate
// - controls do not exactly stand out and are just plain text
const MOUSE_BUTTON_MASKS = [1, 4, 2];  // MouseEvent.button/buttons are ordered differently
export class MouseOperation {
    constructor(editor, physical_button) {
        this.editor = editor;
        this.is_held = false;
        this.physical_button = physical_button;
        this.alt_mode = physical_button !== 0;
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
    }

    cell(x, y) {
        return this.editor.cell(Math.floor(x), Math.floor(y));
    }

    do_press(ev) {
        this.is_held = true;
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

        if (this.is_held && (ev.buttons & MOUSE_BUTTON_MASKS[this.physical_button]) === 0) {
            this.do_abort();
        }

        if (this.is_held) {
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

    do_leave() {
        this.hide();
    }

    // XXX uhhh seems weird to control a shared resource like this????
    // XXX also it's visible initially until you move the mouse over the canvas lol
    show() {
        if (! this.is_hover_visible) {
            this.is_hover_visible = true;
            this.editor.preview_g.style.display = '';
        }
    }

    hide() {
        if (this.is_hover_visible) {
            this.is_hover_visible = false;
            this.editor.preview_g.style.display = 'none';
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
        if (! this.is_held)
            return;

        this.commit_press();
        this.cleanup_press();
        this.is_held = false;
    }

    do_abort() {
        if (! this.is_held)
            return;

        this.abort_press();
        this.cleanup_press();
        this.is_held = false;
    }

    do_destroy() {
        this.do_abort();
        this.cleanup_hover();
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
    // Called when the hover ends??
    cleanup_hover() {}
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
// (seems like that /should/ work...)
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

        // If we're picking the background, we always use the terrain
        if (this.ctrl) {
            this.editor.select_background_tile(cell[LAYERS.terrain]);
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
            let tile = cell[layer];
            if (! tile)
                continue;

            this.editor.select_foreground_tile(tile);
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

        this.image = mk_svg('image', {
            id: 'svg-editor-preview-tile',
            x: 0,
            y: 0,
            width: 1,
            height: 1,
        });
        this.editor.preview_g.append(this.image);
        this.handle_tile_updated();
    }

    // Hover: draw the tile in the pointed-to cell
    handle_tile_updated(is_bg = false) {
        if (is_bg)
            return;
        this.image.setAttribute('href', this.editor.fg_tile_el.toDataURL());
    }
    handle_hover(_mx, _my, _cxf, _cyf, cell_x, cell_y) {
        this.image.setAttribute('x', cell_x);
        this.image.setAttribute('y', cell_y);
    }
    cleanup_hover() {
        this.image.remove();
    }

    handle_press(x, y) {
        this.draw_in_cell(x, y);
    }
    handle_drag(client_x, client_y, frac_cell_x, frac_cell_y, cell_x, cell_y) {
        for (let [x, y] of this.iter_touched_cells(frac_cell_x, frac_cell_y)) {
            this.draw_in_cell(x, y);
        }

        // Also update the preview tile position
        this.handle_hover(client_x, client_y, frac_cell_x, frac_cell_y, cell_x, cell_y);
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
        this.foreign_object = mk_svg('foreignObject', {
            x: 0, y: 0,
            width: this.canvas.width, height: this.canvas.height,
            transform: `scale(${1/renderer.tileset.size_x} ${1/renderer.tileset.size_y})`,
        }, this.canvas);
        this.editor.preview_g.append(this.foreign_object);

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
        let i0 = this.editor.stored_level.coords_to_scalar(x0, y0);
        if (this.fill_state && this.fill_state[i0]) {
            // This cell is already part of the pending fill, so there's nothing to do
            return;
        }

        let stored_level = this.editor.stored_level;
        let tile = this.editor.fg_tile;
        let layer = tile.type.layer;
        let tile0 = stored_level.linear_cells[i0][layer] ?? null;
        let type0 = tile0 ? tile0.type : null;

        if (! this.editor.selection.contains(x0, y0)) {
            this.fill_state = null;
            this._redraw();
            return;
        }

        // Aaand, floodfill
        this.fill_state = new Array(stored_level.linear_cells.length);
        this.fill_state[i0] = true;
        let pending = [i0];
        let steps = 0;
        while (pending.length > 0) {
            let old_pending = pending;
            pending = [];
            for (let i of old_pending) {
                let [x, y] = stored_level.scalar_to_coords(i);

                // Check neighbors
                for (let dirinfo of Object.values(DIRECTIONS)) {
                    let [dx, dy] = dirinfo.movement;
                    let nx = x + dx;
                    let ny = y + dy;
                    let j = stored_level.coords_to_scalar(nx, ny)
                    if (! this.editor.selection.contains(nx, ny)) {
                        this.fill_state[j] = false;
                        continue;
                    }

                    let cell = this.editor.cell(nx, ny);
                    if (cell) {
                        if (this.fill_state[j] !== undefined)
                            continue;

                        let tile = cell[layer] ?? null;
                        let type = tile ? tile.type : null;
                        if (type === type0) {
                            this.fill_state[j] = true;
                            pending.push(j);
                        }
                        else {
                            this.fill_state[j] = false;
                        }
                    }
                }
                steps += 1;
                if (steps > 10000) {
                    console.error("more steps than should be possible");
                    return;
                }
            }
        }

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

    cleanup_hover() {
        this.foreign_object.remove();
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


// TODO also, delete
// FIXME i broke transforms
// FIXME don't show the overlay text until has_moved
// FIXME hide the god damn cursor
export class SelectOperation extends MouseOperation {
    handle_press() {
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
            this.update_pending_selection();
        }
        else if (! this.editor.selection.is_empty &&
            this.editor.selection.contains(this.click_cell_x, this.click_cell_y))
        {
            // Move existing selection
            this.mode = 'float';
            this.make_copy = this.ctrl;
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
            this.update_pending_selection();
        }
        this.has_moved = false;
    }
    handle_drag(client_x, client_y, frac_cell_x, frac_cell_y, cell_x, cell_y) {
        if (this.mode === 'float') {
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
        else {
            this.update_pending_selection();
        }
        this.has_moved = true;
    }

    update_pending_selection() {
        this.pending_selection.set_extrema(this.click_cell_x, this.click_cell_y, this.prev_cell_x, this.prev_cell_y);
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
            let name;
            if (x === prevx) {
                if (y > prevy) {
                    name = 'force_floor_s';
                }
                else {
                    name = 'force_floor_n';
                }
            }
            else {
                if (x > prevx) {
                    name = 'force_floor_e';
                }
                else {
                    name = 'force_floor_w';
                }
            }

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

// TODO entered cell should get blank railroad?
// TODO maybe place a straight track in the new cell so it looks like we're doing something, then
// fix it if it wasn't there?
// TODO gonna need an ice tool too, so maybe i can merge all three with some base thing that tracks
// the directions the mouse is moving?  or is FF tool too different?
export class TrackOperation extends MouseOperation {
    handle_press() {
        // Do nothing to start; we only lay track when the mouse leaves a cell
        this.entry_direction = null;
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
            let exit_direction;
            if (x === prevx) {
                if (y > prevy) {
                    exit_direction = 'south';
                }
                else {
                    exit_direction = 'north';
                }
            }
            else {
                if (x > prevx) {
                    exit_direction = 'east';
                }
                else {
                    exit_direction = 'west';
                }
            }

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

export class ConnectOperation extends MouseOperation {
    handle_press(x, y) {
        // TODO restrict to button/cloner unless holding shift
        // TODO what do i do when you erase a button/cloner?  can i detect if you're picking it up?
        let src = this.editor.stored_level.coords_to_scalar(x, y);
        if (this.alt_mode) {
            // Auto connect using Lynx rules
            let cell = this.cell(x, y);
            let terrain = cell[LAYERS.terrain];
            let other = null;
            let swap = false;
            if (terrain.type.name === 'button_red') {
                other = this.search_for(src, 'cloner', 1);
            }
            else if (terrain.type.name === 'cloner') {
                other = this.search_for(src, 'button_red', -1);
                swap = true;
            }
            else if (terrain.type.name === 'button_brown') {
                other = this.search_for(src, 'trap', 1);
            }
            else if (terrain.type.name === 'trap') {
                other = this.search_for(src, 'button_brown', -1);
                swap = true;
            }

            if (other !== null) {
                if (swap) {
                    this.editor.set_custom_connection(other, src);
                }
                else {
                    this.editor.set_custom_connection(src, other);
                }
                this.editor.commit_undo();
            }
            return;
        }
        this.pending_cxn = new SVGConnection(x, y, x, y);
        this.editor.svg_overlay.append(this.pending_cxn.element);
    }
    // FIXME this is hella the sort of thing that should be on Editor, or in algorithms
    search_for(i0, name, dir) {
        let l = this.editor.stored_level.linear_cells.length;
        let i = i0;
        while (true) {
            i += dir;
            if (i < 0) {
                i += l;
            }
            else if (i >= l) {
                i -= l;
            }
            if (i === i0)
                return null;

            let cell = this.editor.stored_level.linear_cells[i];
            let tile = cell[LAYERS.terrain];
            if (tile.type.name === name) {
                return i;
            }
        }
    }
    handle_drag(client_x, client_y, frac_cell_x, frac_cell_y, cell_x, cell_y) {
    }
    commit_press() {
    }
    abort_press() {
        this.pending_cxn.element.remove();
    }
    cleanup_press() {
    }
}
export class WireOperation extends MouseOperation {
    handle_press() {
        if (this.alt_mode) {
            // Place or remove wire tunnels
            // TODO this could just be a separate tool now
            let cell = this.cell(this.click_frac_cell_x, this.click_frac_cell_y);
            if (! cell)
                return;

            let direction;
            // Use the offset from the center to figure out which edge of the tile to affect
            let xoff = this.click_frac_cell_x % 1 - 0.5;
            let yoff = this.click_frac_cell_y % 1 - 0.5;
            if (Math.abs(xoff) > Math.abs(yoff)) {
                if (xoff > 0) {
                    direction = 'east';
                }
                else {
                    direction = 'west';
                }
            }
            else {
                if (yoff > 0) {
                    direction = 'south';
                }
                else {
                    direction = 'north';
                }
            }
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
        // (Note that crossing either a tile boundary or the middle of a cell doesn't mean anything;
        // for example, dragging the mouse horizontally across the A wire is meaningless.)
        // TODO maybe i should just have a walk_grid variant that yields line crossings, christ
        let prevqx = null, prevqy = null;
        for (let [qx, qy] of walk_grid(
            this.prev_frac_cell_x * 4, this.prev_frac_cell_y * 4, frac_cell_x * 4, frac_cell_y * 4,
            // See comment in iter_touched_cells
            -1, -1, this.editor.stored_level.size_x * 4, this.editor.stored_level.size_y * 4))
        {
            if (prevqx === null || prevqy === null) {
                prevqx = qx;
                prevqy = qy;
                continue;
            }

            // Figure out which grid line we've crossed; direction doesn't matter, so we just get
            // the index of the line, which matches the coordinate of the cell to the right/bottom
            // FIXME 'continue' means we skip the update of prevs, solution is really annoying
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
            let wire_direction;
            let x, y;
            if (qx === prevqx) {
                // Vertical
                let line = Math.max(qy, prevqy);
                // Even crossings don't correspond to a wire
                if (line % 2 === 0) {
                    prevqx = qx;
                    prevqy = qy;
                    continue;
                }

                // Convert to real coordinates
                x = Math.floor(qx / 4);
                y = Math.floor(line / 4);

                if (line % 4 === 1) {
                    // Consult the diagram!
                    wire_direction = 'north';
                }
                else {
                    wire_direction = 'south';
                }
            }
            else {
                // Horizontal; same as above
                let line = Math.max(qx, prevqx);
                if (line % 2 === 0) {
                    prevqx = qx;
                    prevqy = qy;
                    continue;
                }

                x = Math.floor(line / 4);
                y = Math.floor(qy / 4);

                if (line % 4 === 1) {
                    wire_direction = 'west';
                }
                else {
                    wire_direction = 'east';
                }
            }

            if (! this.editor.is_in_bounds(x, y)) {
                prevqx = qx;
                prevqy = qy;
                continue;
            }

            let cell = this.cell(x, y);
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
                    tile.wire_directions &= ~DIRECTIONS[wire_direction].bit;
                }
                else {
                    // Draw
                    tile.wire_directions |= DIRECTIONS[wire_direction].bit;
                }
                this.editor.place_in_cell(cell, tile);
                break;
            }

            prevqx = qx;
            prevqy = qy;
        }
    }
    cleanup_press() {
        this.editor.commit_undo();
    }
}

// Tiles the "adjust" tool will turn into each other
const ADJUST_TOGGLES_CW = {};
const ADJUST_TOGGLES_CCW = {};
{
    for (let cycle of [
        ['chip', 'chip_extra'],
        // TODO shouldn't this convert regular walls into regular floors then?
        ['floor_custom_green', 'wall_custom_green'],
        ['floor_custom_pink', 'wall_custom_pink'],
        ['floor_custom_yellow', 'wall_custom_yellow'],
        ['floor_custom_blue', 'wall_custom_blue'],
        ['fake_floor', 'fake_wall'],
        ['popdown_floor', 'popdown_wall'],
        ['wall_invisible', 'wall_appearing'],
        ['green_floor', 'green_wall'],
        ['green_bomb', 'green_chip'],
        ['purple_floor', 'purple_wall'],
        ['thief_keys', 'thief_tools'],
        ['swivel_nw', 'swivel_ne', 'swivel_se', 'swivel_sw'],
        ['ice_nw', 'ice_ne', 'ice_se', 'ice_sw'],
        ['force_floor_n', 'force_floor_e', 'force_floor_s', 'force_floor_w'],
        ['ice', 'force_floor_all'],
        ['water', 'turtle'],
        ['no_player1_sign', 'no_player2_sign'],
        ['flame_jet_off', 'flame_jet_on'],
        ['light_switch_off', 'light_switch_on'],
        ['stopwatch_bonus', 'stopwatch_penalty'],
        ['turntable_cw', 'turntable_ccw'],
    ])
    {
        for (let [i, tile] of cycle.entries()) {
            let other = cycle[(i + 1) % cycle.length];
            ADJUST_TOGGLES_CW[tile] = other;
            ADJUST_TOGGLES_CCW[other] = tile;
        }
    }
}
export class AdjustOperation extends MouseOperation {
    handle_press() {
        let cell = this.cell(this.prev_cell_x, this.prev_cell_y);
        if (this.ctrl) {
            for (let tile of cell) {
                if (tile && TILES_WITH_PROPS[tile.type.name] !== undefined) {
                    this.editor.open_tile_prop_overlay(
                        tile, cell, this.editor.renderer.get_cell_rect(cell.x, cell.y));
                    break;
                }
            }
            return;
        }
        let start_layer = this.shift ? 0 : LAYERS.MAX - 1;
        for (let layer = start_layer; layer >= 0; layer--) {
            let tile = cell[layer];
            if (! tile)
                continue;

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
                break;
            }

            // Toggle tiles that go in obvious pairs
            let other = (this.alt_mode ? ADJUST_TOGGLES_CCW : ADJUST_TOGGLES_CW)[tile.type.name];
            if (other) {
                tile.type = TILE_TYPES[other];
                this.editor.place_in_cell(cell, tile);
                this.editor.commit_undo();
                break;
            }
        }
    }
    // Adjust tool doesn't support dragging
    // TODO should it?
    // TODO if it does then it should end as soon as you spawn a popup
}

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
