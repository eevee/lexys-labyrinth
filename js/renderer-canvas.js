import { DIRECTIONS } from './defs.js';
import { mk } from './util.js';

export class CanvasRenderer {
    constructor(tileset) {
        this.tileset = tileset;
        // Default, unfortunately and arbitrarily, to the CC1 size of 9×9.  We
        // don't know for sure what size to use until the Game loads a level,
        // and it doesn't do that until creating a renderer!  It could be fixed
        // to do so, but then we wouldn't make a canvas so it couldn't be
        // hooked, yadda yadda
        this.viewport_size_x = 10;
        this.viewport_size_y = 10;
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
        let [px, py] = this.level.player.visual_position(tic_offset);
        let x0 = Math.max(0, Math.min(this.level.width - this.viewport_size_x, px - xmargin));
        let y0 = Math.max(0, Math.min(this.level.height - this.viewport_size_y, py - xmargin));
        this.viewport_x = x0;
        this.viewport_y = y0;
        // The viewport might not be aligned to the grid, so split off any fraction
        let xf0 = Math.floor(x0);
        let yf0 = Math.floor(y0);
        let xoff = xf0 - x0;
        let yoff = yf0 - y0;
        let x1 = Math.ceil(x0 + this.viewport_size_x - 1);
        let y1 = Math.ceil(y0 + this.viewport_size_y - 1);
        // Draw in layers, so animated objects aren't overdrawn by neighboring terrain
        let any_drawn = true;
        let i = -1;
        while (any_drawn) {
            i++;
            any_drawn = false;
            for (let x = xf0; x <= x1; x++) {
                for (let y = yf0; y <= y1; y++) {
                    let cell = this.level.cells[y][x];
                    if (! cell) console.error(x, y);
                    let tile = cell[i];
                    if (tile) {
                        any_drawn = true;
                        if (tile.type.is_actor) {
                            // Handle smooth scrolling
                            let [vx, vy] = tile.visual_position(tic_offset);
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
