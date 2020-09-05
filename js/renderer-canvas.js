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
        this.viewport_x = 0;
        this.viewport_y = 0;
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

    draw(tic_offset = 0) {
        if (! this.level) {
            console.warn("CanvasRenderer.draw: No level to render");
            return;
        }

        // FIXME XXX bad dumb hack but man tileset.draw takes a lot of arguments, that'll probably have to change for webgl anyway
        this.level.tic_offset = tic_offset;

        let ctx = this.canvas.getContext('2d');
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

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
        let x0 = Math.max(0, Math.min(this.level.size_x - this.viewport_size_x, px - xmargin));
        let y0 = Math.max(0, Math.min(this.level.size_y - this.viewport_size_y, py - ymargin));
        // Round to the pixel grid
        x0 = Math.floor(x0 * this.tileset.size_x + 0.5) / this.tileset.size_x;
        y0 = Math.floor(y0 * this.tileset.size_y + 0.5) / this.tileset.size_y;
        this.viewport_x = x0;
        this.viewport_y = y0;
        // The viewport might not be aligned to the grid, so split off any fraction
        let xf0 = Math.floor(x0);
        let yf0 = Math.floor(y0);
        let x1 = Math.ceil(x0 + this.viewport_size_x - 1);
        let y1 = Math.ceil(y0 + this.viewport_size_y - 1);
        // Draw one layer at a time, so animated objects aren't overdrawn by
        // neighboring terrain
        // XXX layer count hardcoded here
        for (let layer = 0; layer < 4; layer++) {
            for (let x = xf0; x <= x1; x++) {
                for (let y = yf0; y <= y1; y++) {
                    for (let tile of this.level.cells[y][x]) {
                        let type;
                        if (tile.name) {
                            type = TILE_TYPES[tile.name];
                        }
                        else {
                            type = tile.type;
                        }

                        if (type.draw_layer !== layer)
                            continue;

                        if (! tile.type) {
                            this.tileset.draw_type(tile.name, null, this.level, ctx, x - x0, y - y0);
                        }
                        else if (type.is_actor) {
                            // Handle smooth scrolling
                            let [vx, vy] = tile.visual_position(tic_offset);
                            // Round this to the pixel grid too!
                            vx = Math.floor(vx * this.tileset.size_x + 0.5) / this.tileset.size_x;
                            vy = Math.floor(vy * this.tileset.size_y + 0.5) / this.tileset.size_y;
                            this.tileset.draw(tile, this.level, ctx, vx - x0, vy - y0);
                        }
                        else {
                            // Non-actors can't move
                            this.tileset.draw(tile, this.level, ctx, x - x0, y - y0);
                        }
                    }
                }
            }
        }
    }
}

export default CanvasRenderer;
