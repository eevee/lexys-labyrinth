import { readFile, writeFile } from 'fs/promises';
import * as process from 'process';

import canvas from 'canvas';
import minimist from 'minimist';

import * as format_c2g from '../format-c2g.js';
import { infer_tileset_from_image } from '../tileset.js';
import { NodeCanvasRenderer } from './lib.js';


const USAGE = `\
Usage: render.mjs [OPTION]... LEVELFILE OUTFILE
Renders the level contained in LEVELFILE to a PNG and saves it to OUTFILE.

Arguments:
  -t FILE       path to a tileset to use
  -e            render in editor mode: use the revealed forms of tiles and
                  show facing directions
  -l NUM        choose the level number to render, if LEVELFILE is a pack
                  [default: 1]
  -r REGION     specify the region to render; see below

REGION may be one of:
  initial       an area the size of the level's viewport, centered on the
                  player's initial position
  all           the entire level
  WxH           an area W by H, centered on the player's initial position
  ...etc...
`;
async function main() {
    let args = minimist(process.argv.slice(2), {
        alias: {
            tileset: ['t'],
        },
    });
    // assert _.length is 2
    let [pack_path, dest_path] = args._;

    // TODO i need a more consistent and coherent way to turn a path into a level pack, currently
    // this is only a single c2m
    let pack_data = await readFile(pack_path);
    let stored_level = format_c2g.parse_level(pack_data.buffer);

    let img = await canvas.loadImage(args.tileset ?? 'tileset-lexy.png');
    let tileset = infer_tileset_from_image(img);
    let renderer = new NodeCanvasRenderer(tileset);
    renderer.set_level(stored_level);

    let i = stored_level.linear_cells.findIndex(cell => cell.some(tile => tile && tile.type.is_real_player));
    if (i < 0) {
        console.log("???");
        process.stderr.write("error: no players in this level\n");
        process.exit(1);
    }

    let [x, y] = stored_level.scalar_to_coords(i);
    let w = stored_level.viewport_size;
    let h = w;

    // TODO this is probably duplicated from the renderer, and could also be reused in the editor
    // TODO handle a map smaller than the viewport
    let x0 = Math.max(0, x - w / 2);
    let y0 = Math.max(0, y - h / 2);
    renderer.draw_static_region(x0, y0, x0 + w, y0 + h);

    await writeFile(dest_path, renderer.canvas.toBuffer());
}

main();
