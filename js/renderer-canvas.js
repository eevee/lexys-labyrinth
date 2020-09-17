import { DIRECTIONS } from './defs.js';
import { mk } from './util.js';
import TILE_TYPES from './tiletypes.js';

export class CanvasRenderer {
    constructor(tileset, fixed_size = null) {
        this.tileset = tileset;
        // Default, unfortunately and arbitrarily, to the CC1 size of 9×9.  We
        // don't know for sure what size to use until the Game loads a level,
        // and it doesn't do that until creating a renderer!  It could be fixed
        // to do so, but then we wouldn't make a canvas so it couldn't be
        // hooked, yadda yadda
        if (fixed_size) {
            this.viewport_is_fixed = true;
            this.viewport_size_x = fixed_size;
            this.viewport_size_y = fixed_size;
        }
        else {
            this.viewport_size_x = 9;
            this.viewport_size_y = 9;
        }
        this.canvas = mk('canvas', {width: tileset.size_x * this.viewport_size_x, height: tileset.size_y * this.viewport_size_y});
        this.canvas.style.setProperty('--viewport-width', this.viewport_size_x);
        this.canvas.style.setProperty('--viewport-height', this.viewport_size_y);
        this.ctx = this.canvas.getContext('2d');
        this.viewport_x = 0;
        this.viewport_y = 0;
        this.use_rewind_effect = false;
    }

    set_level(level) {
        this.level = level;
        // TODO update viewport size...  or maybe Game should do that since you might be cheating
    }

    cell_coords_from_event(ev) {
        let rect = this.canvas.getBoundingClientRect();
        let scale_x = rect.width / this.canvas.width;
        let scale_y = rect.height / this.canvas.height;
        let x = Math.floor((ev.clientX - rect.x) / scale_x / this.tileset.size_x + this.viewport_x);
        let y = Math.floor((ev.clientY - rect.y) / scale_y / this.tileset.size_y + this.viewport_y);
        return [x, y];
    }

    // Draw to a canvas using tile coordinates
    blit(ctx, sx, sy, dx, dy, w = 1, h = w) {
        let tw = this.tileset.size_x;
        let th = this.tileset.size_y;
        ctx.drawImage(
            this.tileset.image,
            sx * tw, sy * th, w * tw, h * th,
            dx * tw, dy * th, w * tw, h * th);
    }

    draw(tic_offset = 0) {
        if (! this.level) {
            console.warn("CanvasRenderer.draw: No level to render");
            return;
        }

        // TODO StoredLevel may not have a tic_counter
        let tic = (this.level.tic_counter ?? 0) + tic_offset;
        let tw = this.tileset.size_x;
        let th = this.tileset.size_y;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // TODO only recompute if the player moved?
        // TODO what about levels smaller than the viewport...?  shrink the canvas in set_level?
        let xmargin = (this.viewport_size_x - 1) / 2;
        let ymargin = (this.viewport_size_y - 1) / 2;
        let px, py;
        // FIXME editor vs player
        if (this.level.player) {
            [px, py] = this.level.player.visual_position(tic_offset);
        }
        else {
            [px, py] = [0, 0];
        }
        // Figure out where to start drawing
        let x0 = Math.max(0, Math.min(this.level.size_x - this.viewport_size_x, px - xmargin));
        let y0 = Math.max(0, Math.min(this.level.size_y - this.viewport_size_y, py - ymargin));
        // Round to the pixel grid
        x0 = Math.floor(x0 * tw + 0.5) / tw;
        y0 = Math.floor(y0 * th + 0.5) / th;
        this.viewport_x = x0;
        this.viewport_y = y0;
        // The viewport might not be aligned to the grid, so split off any fractional part.
        let xf0 = Math.floor(x0);
        let yf0 = Math.floor(y0);
        // Note that when the viewport is exactly aligned to the grid, we need to draw the cells
        // just outside of it, or we'll miss objects partway through crossing the border
        if (xf0 === x0 && xf0 > 0) {
            xf0 -= 1;
        }
        if (yf0 === y0 && yf0 > 0) {
            yf0 -= 1;
        }
        // Find where to stop drawing.  As with above, if we're aligned to the grid, we need to
        // include the tiles just outside it, so we allow this fencepost problem to fly
        let x1 = Math.min(this.level.size_x - 1, Math.ceil(x0 + this.viewport_size_x));
        let y1 = Math.min(this.level.size_y - 1, Math.ceil(y0 + this.viewport_size_y));
        // Draw one layer at a time, so animated objects aren't overdrawn by
        // neighboring terrain
        // XXX layer count hardcoded here
        for (let layer = 0; layer < 4; layer++) {
            for (let x = xf0; x <= x1; x++) {
                for (let y = yf0; y <= y1; y++) {
                    for (let tile of this.level.cells[y][x]) {
                        if (tile.type.draw_layer !== layer)
                            continue;

                        if (tile.type.is_actor &&
                            // FIXME kind of a hack for the editor, which uses bare tile objects
                            tile.visual_position)
                        {
                            // Handle smooth scrolling
                            let [vx, vy] = tile.visual_position(tic_offset);
                            // Round this to the pixel grid too!
                            vx = Math.floor(vx * tw + 0.5) / tw;
                            vy = Math.floor(vy * th + 0.5) / th;
                            this.tileset.draw(tile, tic, (sx, sy, dx = 0, dy = 0, w = 1, h = w) =>
                                this.blit(this.ctx, sx, sy, vx - x0 + dx, vy - y0 + dy, w, h));
                        }
                        else {
                            // Non-actors can't move
                            this.tileset.draw(tile, tic, (sx, sy, dx = 0, dy = 0, w = 1, h = w) =>
                                this.blit(this.ctx, sx, sy, x - x0 + dx, y - y0 + dy, w, h));
                        }
                    }
                }
            }
        }

        if (this.use_rewind_effect) {
            this.draw_rewind_effect(tic);
        }
    }

    draw_rewind_effect(tic) {
        // Shift several rows over
        let rewind_start = 1 - tic / 20 % 1;
        for (let chunk = 0; chunk < 4; chunk++) {
            let y = Math.floor(this.canvas.height * (chunk + rewind_start) / 4);
            for (let dy = 1; dy < 5; dy++) {
                this.ctx.drawImage(
                    this.canvas,
                    0, y + dy, this.canvas.width, 1,
                    -dy * dy, y + dy, this.canvas.width, 1);
            }
        }
    }

    create_tile_type_canvas(name) {
        let canvas = mk('canvas', {width: this.tileset.size_x, height: this.tileset.size_y});
        let ctx = canvas.getContext('2d');
        this.tileset.draw_type(name, null, 0, (sx, sy, dx = 0, dy = 0, w = 1, h = w) =>
            this.blit(ctx, sx, sy, dx, dy, w, h));
        return canvas;
    }
}

export default CanvasRenderer;
