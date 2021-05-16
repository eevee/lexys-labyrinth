// Small helper classes used by the editor, often with their own UI for the SVG overlay.
import { mk, mk_svg } from '../util.js';

export class SVGConnection {
    constructor(sx, sy, dx, dy) {
        this.source = mk_svg('circle.-source', {r: 0.5});
        this.line = mk_svg('line.-arrow', {});
        this.dest = mk_svg('rect.-dest', {width: 1, height: 1});
        this.element = mk_svg('g.overlay-connection', this.source, this.line, this.dest);
        this.set_source(sx, sy);
        this.set_dest(dx, dy);
    }

    set_source(sx, sy) {
        this.sx = sx;
        this.sy = sy;
        this.source.setAttribute('cx', sx + 0.5);
        this.source.setAttribute('cy', sy + 0.5);
        this.line.setAttribute('x1', sx + 0.5);
        this.line.setAttribute('y1', sy + 0.5);
    }

    set_dest(dx, dy) {
        this.dx = dx;
        this.dy = dy;
        this.line.setAttribute('x2', dx + 0.5);
        this.line.setAttribute('y2', dy + 0.5);
        this.dest.setAttribute('x', dx);
        this.dest.setAttribute('y', dy);
    }
}


// TODO probably need to combine this with Selection somehow since it IS one, just not committed yet
export class PendingSelection {
    constructor(owner) {
        this.owner = owner;
        this.element = mk_svg('rect.overlay-pending-selection');
        this.owner.svg_group.append(this.element);
        this.rect = null;
    }

    set_extrema(x0, y0, x1, y1) {
        this.rect = new DOMRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x0 - x1) + 1, Math.abs(y0 - y1) + 1);
        this.element.classList.add('--visible');
        this.element.setAttribute('x', this.rect.x);
        this.element.setAttribute('y', this.rect.y);
        this.element.setAttribute('width', this.rect.width);
        this.element.setAttribute('height', this.rect.height);
    }

    commit() {
        this.owner.set_from_rect(this.rect);
        this.element.remove();
    }

    discard() {
        this.element.remove();
    }
}

export class Selection {
    constructor(editor) {
        this.editor = editor;

        this.svg_group = mk_svg('g');
        this.editor.svg_overlay.append(this.svg_group);

        this.rect = null;
        this.element = mk_svg('rect.overlay-selection.overlay-transient');
        this.svg_group.append(this.element);

        this.floated_cells = null;
        this.floated_element = null;
        this.floated_canvas = null;
    }

    get is_empty() {
        return this.rect === null;
    }

    get is_floating() {
        return !! this.floated_cells;
    }

    contains(x, y) {
        // Empty selection means everything is selected?
        if (this.rect === null)
            return true;

        return this.rect.left <= x && x < this.rect.right && this.rect.top <= y && y < this.rect.bottom;
    }

    create_pending() {
        return new PendingSelection(this);
    }

    set_from_rect(rect) {
        let old_rect = this.rect;
        this.editor._do(
            () => this._set_from_rect(rect),
            () => {
                if (old_rect) {
                    this._set_from_rect(old_rect);
                }
                else {
                    this._clear();
                }
            },
            false,
        );
    }

    _set_from_rect(rect) {
        this.rect = rect;
        this.element.classList.add('--visible');
        this.element.setAttribute('x', this.rect.x);
        this.element.setAttribute('y', this.rect.y);
        this.element.setAttribute('width', this.rect.width);
        this.element.setAttribute('height', this.rect.height);

        if (this.floated_element) {
            let tileset = this.editor.renderer.tileset;
            this.floated_canvas.width = rect.width * tileset.size_x;
            this.floated_canvas.height = rect.height * tileset.size_y;
            let foreign_obj = this.floated_element.querySelector('foreignObject');
            foreign_obj.setAttribute('width', this.floated_canvas.width);
            foreign_obj.setAttribute('height', this.floated_canvas.height);
        }
    }

    move_by(dx, dy) {
        if (! this.rect)
            return;

        this.rect.x += dx;
        this.rect.y += dy;
        this.element.setAttribute('x', this.rect.x);
        this.element.setAttribute('y', this.rect.y);

        if (! this.floated_element)
            return;

        let bbox = this.rect;
        this.floated_element.setAttribute('transform', `translate(${bbox.x} ${bbox.y})`);
    }

    clear() {
        let rect = this.rect;
        if (! rect)
            return;

        this.editor._do(
            () => this._clear(),
            () => this._set_from_rect(rect),
            false,
        );
    }

    _clear() {
        this.rect = null;
        this.element.classList.remove('--visible');
    }

    *iter_coords() {
        if (! this.rect)
            return;

        let stored_level = this.editor.stored_level;
        for (let y = this.rect.top; y < this.rect.bottom; y++) {
            for (let x = this.rect.left; x < this.rect.right; x++) {
                let n = stored_level.coords_to_scalar(x, y);
                yield [x, y, n];
            }
        }
    }

    // Convert this selection into a floating selection, plucking all the selected cells from the
    // level and replacing them with blank cells.
    enfloat(copy = false) {
        if (this.floated_cells)
            console.error("Trying to float a selection that's already floating");

        let floated_cells = [];
        let tileset = this.editor.renderer.tileset;
        let stored_level = this.editor.stored_level;
        let bbox = this.rect;
        let canvas = mk('canvas', {width: bbox.width * tileset.size_x, height: bbox.height * tileset.size_y});
        let ctx = canvas.getContext('2d');
        ctx.drawImage(
            this.editor.renderer.canvas,
            bbox.x * tileset.size_x, bbox.y * tileset.size_y, bbox.width * tileset.size_x, bbox.height * tileset.size_y,
            0, 0, bbox.width * tileset.size_x, bbox.height * tileset.size_y);
        for (let [x, y, n] of this.iter_coords()) {
            let cell = stored_level.linear_cells[n];
            if (copy) {
                floated_cells.push(cell.map(tile => tile ? {...tile} : null));
            }
            else {
                floated_cells.push(cell);
                this.editor.replace_cell(cell, this.editor.make_blank_cell(x, y));
            }
        }
        let floated_element = mk_svg('g', mk_svg('foreignObject', {
            x: 0, y: 0,
            width: canvas.width, height: canvas.height,
            transform: `scale(${1/tileset.size_x} ${1/tileset.size_y})`,
        }, canvas));
        floated_element.setAttribute('transform', `translate(${bbox.x} ${bbox.y})`);

        // FIXME far more memory efficient to recreate the canvas in the redo, rather than hold onto
        // it forever
        this.editor._do(
            () => {
                this.floated_canvas = canvas;
                this.floated_element = floated_element;
                this.floated_cells = floated_cells;
                this.svg_group.append(floated_element);
            },
            () => this._defloat(),
        );
    }

    stamp_float(copy = false) {
        if (! this.floated_element)
            return;

        let stored_level = this.editor.stored_level;
        let i = 0;
        for (let [x, y, n] of this.iter_coords()) {
            let cell = this.floated_cells[i];
            if (copy) {
                cell = cell.map(tile => tile ? {...tile} : null);
            }
            cell.x = x;
            cell.y = y;
            this.editor.replace_cell(stored_level.linear_cells[n], cell);
            i += 1;
        }
    }

    defloat() {
        if (! this.floated_element)
            return;

        this.stamp_float();

        let element = this.floated_element;
        let canvas = this.floated_canvas;
        let cells = this.floated_cells;
        this.editor._do(
            () => this._defloat(),
            () => {
                this.floated_cells = cells;
                this.floated_canvas = canvas;
                this.floated_element = element;
                this.svg_group.append(element);
            },
            false,
        );
    }

    _defloat() {
        this.floated_element.remove();
        this.floated_element = null;
        this.floated_canvas = null;
        this.floated_cells = null;
    }

    // Redraw the selection canvas from scratch
    redraw() {
        if (! this.floated_canvas)
            return;

        // FIXME uhoh, how do i actually do this?  we have no renderer of our own, we have a
        // separate canvas, and all the renderer stuff expects to get ahold of a level.  i guess
        // refactor it to draw a block of cells?
        this.editor.renderer.draw_static_generic({
            x0: 0, y0: 0,
            x1: this.rect.width, y1: this.rect.height,
            cells: this.floated_cells,
            width: this.rect.width,
            ctx: this.floated_canvas.getContext('2d'),
        });
    }

    // TODO allow floating/dragging, ctrl-dragging to copy, anchoring...
    // TODO make more stuff respect this (more things should go through Editor for undo reasons anyway)
}

