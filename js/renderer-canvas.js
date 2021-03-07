import { DIRECTIONS, LAYERS } from './defs.js';
import { mk } from './util.js';
import { DrawPacket } from './tileset.js';
import TILE_TYPES from './tiletypes.js';

class CanvasRendererDrawPacket extends DrawPacket {
    constructor(renderer, ctx, tic, perception) {
        super(tic, perception);
        this.renderer = renderer;
        this.ctx = ctx;
        // Canvas position of the cell being drawn
        this.x = 0;
        this.y = 0;
        // Offset within the cell, for actors in motion
        this.offsetx = 0;
        this.offsety = 0;
        // Compatibility settings
        this.use_cc2_anim_speed = renderer.use_cc2_anim_speed;
    }

    blit(tx, ty, mx = 0, my = 0, mw = 1, mh = mw, mdx = mx, mdy = my) {
        this.renderer.blit(this.ctx,
            tx + mx, ty + my,
            this.x + this.offsetx + mdx, this.y + this.offsety + mdy,
            mw, mh);
    }

    blit_aligned(tx, ty, mx = 0, my = 0, mw = 1, mh = mw, mdx = mx, mdy = my) {
        this.renderer.blit(this.ctx,
            tx + mx, ty + my,
            this.x + mdx, this.y + mdy,
            mw, mh);
    }
}

export class CanvasRenderer {
    constructor(tileset, fixed_size = null) {
        this.tileset = tileset;
        // Default, unfortunately and arbitrarily, to the CC1 size of 9×9.  We
        // don't know for sure what size to use until the Game loads a level,
        // and it doesn't do that until creating a renderer!  It could be fixed
        // to do so, but then we wouldn't make a canvas so it couldn't be
        // hooked, yadda yadda
        if (fixed_size) {
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
        this.canvas.style.setProperty('--tile-width', `${tileset.size_x}px`);
        this.canvas.style.setProperty('--tile-height', `${tileset.size_y}px`);
        this.ctx = this.canvas.getContext('2d');
        this.viewport_x = 0;
        this.viewport_y = 0;
        this.viewport_dirty = false;
        this.show_actor_bboxes = false;
        this.show_actor_order = false;
        this.use_rewind_effect = false;
        this.perception = 'normal';  // normal, xray, editor, palette
        this.use_cc2_anim_speed = false;
        this.active_player = null;
    }

    set_level(level) {
        this.level = level;
        // TODO update viewport size...  or maybe Game should do that since you might be cheating
    }

    set_active_player(actor) {
        this.active_player = actor;
    }

    // Change the viewport size.  DOES NOT take effect until the next redraw!
    set_viewport_size(x, y) {
        this.viewport_size_x = x;
        this.viewport_size_y = y;
        this.viewport_dirty = true;
    }

    set_tileset(tileset) {
        this.tileset = tileset;
        this.viewport_dirty = true;
    }

    get_cell_rect(x, y) {
        let rect = this.canvas.getBoundingClientRect();
        let scale_x = rect.width / this.canvas.width;
        let scale_y = rect.height / this.canvas.height;
        let tile_w = scale_x * this.tileset.size_x;
        let tile_h = scale_y * this.tileset.size_y;
        return new DOMRect(
            rect.x + (x - this.viewport_x) * tile_w,
            rect.y + (y - this.viewport_y) * tile_h,
            tile_w, tile_h);
    }

    cell_coords_from_event(ev) {
        let rect = this.canvas.getBoundingClientRect();
        let scale_x = rect.width / this.canvas.width;
        let scale_y = rect.height / this.canvas.height;
        let x = Math.floor((ev.clientX - rect.x) / scale_x / this.tileset.size_x + this.viewport_x);
        let y = Math.floor((ev.clientY - rect.y) / scale_y / this.tileset.size_y + this.viewport_y);
        return [x, y];
    }

    real_cell_coords_from_event(ev) {
        let rect = this.canvas.getBoundingClientRect();
        let scale_x = rect.width / this.canvas.width;
        let scale_y = rect.height / this.canvas.height;
        let x = (ev.clientX - rect.x) / scale_x / this.tileset.size_x + this.viewport_x;
        let y = (ev.clientY - rect.y) / scale_y / this.tileset.size_y + this.viewport_y;
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

    _adjust_viewport_if_dirty() {
        if (! this.viewport_dirty)
            return;

        this.viewport_dirty = false;
        this.canvas.setAttribute('width', this.tileset.size_x * this.viewport_size_x);
        this.canvas.setAttribute('height', this.tileset.size_y * this.viewport_size_y);
        this.canvas.style.setProperty('--viewport-width', this.viewport_size_x);
        this.canvas.style.setProperty('--viewport-height', this.viewport_size_y);
        this.canvas.style.setProperty('--tile-width', `${this.tileset.size_x}px`);
        this.canvas.style.setProperty('--tile-height', `${this.tileset.size_y}px`);
    }

    draw(tic_offset = 0) {
        if (! this.level) {
            console.warn("CanvasRenderer.draw: No level to render");
            return;
        }

        this._adjust_viewport_if_dirty();

        let tic = (this.level.tic_counter ?? 0) + tic_offset;
        let packet = new CanvasRendererDrawPacket(this, this.ctx, tic, this.perception);
        packet.update_rate = this.level.compat.emulate_60fps ? 1 : 3;

        let tw = this.tileset.size_x;
        let th = this.tileset.size_y;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // TODO only recompute if the player moved?
        // TODO what about levels smaller than the viewport...?  shrink the canvas in set_level?
        let xmargin = (this.viewport_size_x - 1) / 2;
        let ymargin = (this.viewport_size_y - 1) / 2;
        let [px, py] = this.level.player.visual_position(tic_offset, packet.update_rate);
        // Figure out where to start drawing
        // TODO support overlapping regions better
        let x0 = px - xmargin;
        let y0 = py - ymargin;
        for (let region of this.level.stored_level.camera_regions) {
            if (px >= region.left && px < region.right &&
                py >= region.top && py < region.bottom)
            {
                x0 = Math.max(region.left, Math.min(region.right - this.viewport_size_x, x0));
                y0 = Math.max(region.top, Math.min(region.bottom - this.viewport_size_y, y0));
            }
        }
        // Always keep us within the map bounds
        x0 = Math.max(0, Math.min(this.level.size_x - this.viewport_size_x, x0));
        y0 = Math.max(0, Math.min(this.level.size_y - this.viewport_size_y, y0));
        // Round to the pixel grid
        x0 = Math.floor(x0 * tw + 0.5) / tw;
        y0 = Math.floor(y0 * th + 0.5) / th;
        this.viewport_x = x0;
        this.viewport_y = y0;
        // The viewport might not be aligned to the grid, so split off any fractional part.
        let xf0 = Math.floor(x0);
        let yf0 = Math.floor(y0);
        // We need to draw one cell beyond the viewport, or we'll miss objects partway through
        // crossing the border moving away from us
        if (xf0 > 0) {
            xf0 -= 1;
        }
        if (yf0 > 0) {
            yf0 -= 1;
        }
        // Find where to stop drawing.  As with above, if we're aligned to the grid, we need to
        // include the tiles just outside it, so we allow this fencepost problem to fly
        let x1 = Math.min(this.level.size_x - 1, Math.ceil(x0 + this.viewport_size_x));
        let y1 = Math.min(this.level.size_y - 1, Math.ceil(y0 + this.viewport_size_y));
        // Tiles in motion (i.e., actors) don't want to be overdrawn by neighboring tiles' terrain,
        // so draw in three passes: everything below actors, actors, and everything above actors
        // neighboring terrain
        for (let x = xf0; x <= x1; x++) {
            for (let y = yf0; y <= y1; y++) {
                let cell = this.level.cell(x, y);
                for (let layer = 0; layer < LAYERS.actor; layer++) {
                    let tile = cell[layer];
                    if (! tile)
                        continue;

                    packet.x = x - x0;
                    packet.y = y - y0;
                    this.tileset.draw(tile, packet);
                }
            }
        }
        for (let x = xf0; x <= x1; x++) {
            for (let y = yf0; y <= y1; y++) {
                let cell = this.level.cell(x, y);
                let actor = cell[LAYERS.actor];
                if (! actor)
                    continue;

                // Handle smooth scrolling
                let [vx, vy] = actor.visual_position(tic_offset, packet.update_rate);
                // Round this to the pixel grid too!
                vx = Math.floor(vx * tw + 0.5) / tw;
                vy = Math.floor(vy * th + 0.5) / th;

                // For blocks, perception only applies if there's something of interest underneath
                if (this.perception !== 'normal' && actor.type.is_block &&
                    ! cell.some(t => t && t.type.layer < LAYERS.actor && ! (
                        t.type.name === 'floor' && (t.wire_directions | t.wire_tunnel_directions) === 0)))
                {
                    packet.perception = 'normal';
                }
                else {
                    packet.perception = this.perception;
                }

                packet.x = x - x0;
                packet.y = y - y0;
                packet.offsetx = vx - x;
                packet.offsety = vy - y;

                // Draw the active player background
                if (actor === this.active_player) {
                    this.tileset.draw_type('#active-player-background', null, packet);
                }

                this.tileset.draw(actor, packet);
            }
        }
        packet.perception = this.perception;
        packet.offsetx = 0;
        packet.offsety = 0;
        for (let x = xf0; x <= x1; x++) {
            for (let y = yf0; y <= y1; y++) {
                let cell = this.level.cell(x, y);
                for (let layer = LAYERS.actor + 1; layer < LAYERS.MAX; layer++) {
                    let tile = cell[layer];
                    if (! tile)
                        continue;

                    packet.x = x - x0;
                    packet.y = y - y0;
                    this.tileset.draw(tile, packet);
                }
            }
        }

        if (this.use_rewind_effect) {
            this.draw_rewind_effect(tic);
        }

        // Debug overlays
        if (this.show_actor_bboxes) {
            this.ctx.fillStyle = '#f004';
            for (let x = xf0; x <= x1; x++) {
                for (let y = yf0; y <= y1; y++) {
                    let actor = this.level.cell(x, y).get_actor();
                    if (! actor)
                        continue;
                    let [vx, vy] = actor.visual_position(tic_offset, packet.update_rate);
                    // Don't round to the pixel grid; we want to know if the bbox is misaligned!
                    this.ctx.fillRect((vx - x0) * tw, (vy - y0) * th, 1 * tw, 1 * th);
                }
            }
        }
        if (this.show_actor_order) {
            this.ctx.fillStyle = '#fff';
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 3;
            this.ctx.font = '16px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            for (let [n, actor] of this.level.actors.entries()) {
                let cell = actor.cell;
                if (! cell)
                    continue;
                if (cell.x < xf0 || cell.x > x1 || cell.y < yf0 || cell.y > y1)
                    continue;

                let [vx, vy] = actor.visual_position(tic_offset, packet.update_rate);
                let x = (vx + 0.5 - x0) * tw;
                let y = (vy + 0.5 - y0) * th;
                let label = String(this.level.actors.length - 1 - n);
                this.ctx.strokeText(label, x, y);
                this.ctx.fillText(label, x, y);
            }
        }
    }

    draw_rewind_effect(tic) {
        // Shift several rows over in a recurring pattern, like a VHS, whatever that is
        let rewind_start = tic / 20 % 1;
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

    // Used by the editor and map previews.  Draws a region of the level (probably a StoredLevel),
    // assuming nothing is moving.
    draw_static_region(x0, y0, x1, y1, destx = x0, desty = y0) {
        this._adjust_viewport_if_dirty();

        let packet = new CanvasRendererDrawPacket(this, this.ctx, 0.0, this.perception);
        for (let x = x0; x <= x1; x++) {
            for (let y = y0; y <= y1; y++) {
                let cell = this.level.cell(x, y);
                if (! cell)
                    continue;

                let seen_anything_interesting;
                for (let tile of cell) {
                    if (! tile)
                        continue;

                    // For actors (i.e., blocks), perception only applies if there's something
                    // of potential interest underneath
                    if (this.perception !== 'normal' && tile.type.is_block && ! seen_anything_interesting) {
                        packet.perception = 'normal';
                    }
                    else {
                        packet.perception = this.perception;
                    }

                    if (tile.type.layer < LAYERS.actor && ! (
                        tile.type.name === 'floor' && (tile.wire_directions | tile.wire_tunnel_directions) === 0))
                    {
                        seen_anything_interesting = true;
                    }

                    packet.x = destx + x - x0;
                    packet.y = desty + y - y0;
                    this.tileset.draw(tile, packet);
                }
            }
        }
    }

    create_tile_type_canvas(name, tile = null) {
        let canvas = mk('canvas', {width: this.tileset.size_x, height: this.tileset.size_y});
        let ctx = canvas.getContext('2d');

        // Individual tile types always reveal what they are
        let packet = new CanvasRendererDrawPacket(this, ctx, 0.0, 'palette');
        this.tileset.draw_type(name, tile, packet);
        return canvas;
    }
}

export default CanvasRenderer;
