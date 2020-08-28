import * as util from './format-util.js';
import { TILE_TYPES, CC2_TILE_TYPES } from './tiletypes.js';

// Decompress the little ad-hoc compression scheme used for both map data and
// solution playback
function decompress(buf) {
    let decompressed_length = new DataView(buf).getUint16(0, true);
    let out = new ArrayBuffer(decompressed_length);
    let outbytes = new Uint8Array(out);
    let bytes = new Uint8Array(buf);
    let p = 2;
    let q = 0;
    while (p < buf.byteLength) {
        let len = bytes[p];
        p++;
        if (len < 0x80) {
            // Data block
            outbytes.set(new Uint8Array(buf.slice(p, p + len)), q);
            p += len;
            q += len;
        }
        else {
            // Back-reference block
            len -= 0x80;
            let offset = bytes[p];
            p++;
            // Can't use set + slice here because the copy can overlap and that
            // doesn't work so great, so just do a regular loop and let the JIT
            // deal with it
            let start = q - offset;
            for (let i = 0; i < len; i++) {
                outbytes[q] = outbytes[start + i];
                q++;
            }
        }
    }
    if (q !== decompressed_length)
        throw new Error(`Expected to decode ${decompressed_length} bytes but got ${q} instead`);
    return out;
}

export function parse_level(buf) {
    let level = new util.StoredLevel;
    let full_view = new DataView(buf);
    let next_section_start = 0;
    while (next_section_start < buf.byteLength) {
        // Read section header and length
        let section_start = next_section_start;
        let section_type = util.string_from_buffer_ascii(buf.slice(section_start, section_start + 4));
        let section_length = full_view.getUint32(section_start + 4, true);
        next_section_start = section_start + 8 + section_length;
        if (next_section_start > buf.byteLength)
            throw new Error(`Section at byte ${section_start} of type '${section_type}' extends ${buf.length - next_section_start} bytes past the end of the file`);

        if (section_type === 'CC2M' || section_type === 'LOCK' || section_type === 'TITL' || section_type === 'AUTH' || section_type === 'VERS' || section_type === 'CLUE' || section_type === 'NOTE') {
            // These are all singular strings (with a terminating NUL, for some reason)
            // XXX character encoding??
            // FIXME assign to appropriate fields
            let field = section_type;
            if (section_type === 'TITL') {
                field = 'title';
            }
            else if (section_type === 'AUTH') {
                field = 'author';
            }
            /*
            else if (section_type === 'CLUE') {
                field = 'hint';
            }
            */
            level[field] = util.string_from_buffer_ascii(buf.slice(section_start + 8, next_section_start - 1)).replace(/\r\n/g, "\n");
            continue;
        }

        let section_buf = buf.slice(section_start + 8, next_section_start);
        let section_view = new DataView(buf, section_start + 8, section_length);

        if (section_type === 'OPTN') {
            // Level options, which may be truncated at any point
            // TODO implement most of these
            level.time_limit = section_view.getUint16(0, true);

            // TODO 0 - 10x10, 1 - 9x9, 2 - split, otherwise unknown which needs handling
            let viewport = section_view.getUint8(2, true);
            if (viewport === 0) {
                level.viewport_size = 10;
            }
            else if (viewport === 1) {
                level.viewport_size = 9;
            }
            else if (viewport === 2) {
                // FIXME this is split
                level.viewport_size = 10;
            }
            else {
                throw new Error(`Unrecognized viewport size option ${viewport}`);
            }

            if (section_view.byteLength <= 3)
                continue;
            //options.has_solution = section_view.getUint8(3, true);

            if (section_view.byteLength <= 4)
                continue;
            //options.show_map_in_editor = section_view.getUint8(4, true);

            if (section_view.byteLength <= 5)
                continue;
            //options.is_editable = section_view.getUint8(5, true);

            if (section_view.byteLength <= 6)
                continue;
            //options.solution_hash = util.string_from_buffer_ascii(buf.slice(
                //section_start + 6, section_start + 22));

            if (section_view.byteLength <= 22)
                continue;
            //options.hide_logic = section_view.getUint8(22, true);

            if (section_view.byteLength <= 23)
                continue;
            level.use_cc1_boots = section_view.getUint8(23, true);

            if (section_view.byteLength <= 24)
                continue;
            //level.blob_behavior = section_view.getUint8(24, true);
        }
        else if (section_type === 'MAP ' || section_type === 'PACK') {
            let data = section_buf;
            if (section_type === 'PACK') {
                data = decompress(data);
            }
            let bytes = new Uint8Array(data);
            let width = bytes[0];
            let height = bytes[1];
            level.size_x = width;
            level.size_y = height;
            let p = 2;
            for (let n = 0; n < width * height; n++) {
                let cell = new util.StoredCell;
                while (true) {
                    let tile_byte = bytes[p];
                    p++;
                    let tile_name = CC2_TILE_TYPES[tile_byte];
                    if (! tile_name)
                        throw new Error(`Unrecognized tile type 0x${tile_byte.toString(16)}`);

                    let tile = {name: tile_name};
                    cell.push(tile);
                    let tiledef = TILE_TYPES[tile_name];
                    if (tiledef.is_required_chip) {
                        level.chips_required++;
                    }
                    if (tiledef.is_player) {
                        // TODO handle multiple starts
                        level.player_start_x = n % width;
                        level.player_start_y = Math.floor(n / width);
                    }
                    if (tiledef.has_direction) {
                        let dirbyte = bytes[p];
                        p++;
                        let direction = ['north', 'east', 'south', 'west'][dirbyte];
                        if (! direction) {
                            console.warn(`'${tile_name}' tile at ${n % width}, ${Math.floor(n / width)} has bogus direction byte ${dirbyte}; defaulting to south`);
                            direction = 'south';
                        }
                        tile.direction = direction;
                    }
                    if (! tiledef.is_top_layer)
                        break;
                }
                level.linear_cells.push(cell);
            }
        }
        else if (section_type === 'KEY ') {
        }
        else if (section_type === 'REPL') {
        }
        else if (section_type === 'PRPL') {
        }
        else if (section_type === 'RDNY') {
        }
        else if (section_type === 'END ') {
        }
        else {
            console.warn(`Unrecognized section type '${section_type}' at offset ${section_start}`);
            // TODO save it, persist when editing level
        }
    }
    console.log(level);
    return level;
}
