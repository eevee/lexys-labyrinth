import * as util from './format-util.js';
import { TILE_TYPES, CC2_TILE_TYPES } from './tiletypes.js';

const CC1_TILE_ENCODING = {
    0x00: 'floor',
    0x01: 'wall',
    0x02: 'chip',
    0x03: 'water',
    0x04: 'fire',
    // invis wall
    // thin walls...
    0x0a: 'dirt_block',
    0x0b: 'dirt',
    0x0c: 'ice',
    0x0d: 'force_floor_s',
    // cloners
    0x12: 'force_floor_n',
    0x13: 'force_floor_e',
    0x14: 'force_floor_w',
    0x15: 'exit',
    0x16: 'door_blue',
    0x17: 'door_red',
    0x18: 'door_green',
    0x19: 'door_yellow',
    0x1a: 'ice_se',
    0x1b: 'ice_sw',
    0x1c: 'ice_nw',
    0x1d: 'ice_nw',
    // fake blocks
    // 0x20 unused
    // thief
    0x22: 'socket',
    // green button
    // red button
    // green tile
    // more buttons, teleports, bombs, traps
    0x2f: 'clue',

    0x33: 'player_drowned',
    0x34: 'player_burned',
    //0x35: player_burned,  XXX is this burned off a tile or?
    // 0x36 - 0x38 unused
    //0x39: exit_player,
    0x3a: 'exit',
    0x3b: 'exit',  // i think this is for the second frame of the exit animation?
    // FIXME??? 0x3c - 0x3f are player swimming!
    0x40: ['bug', 'north'],
    0x41: ['bug', 'west'],
    0x42: ['bug', 'south'],
    0x43: ['bug', 'east'],

    0x64: 'key_blue',
    0x65: 'key_red',
    0x66: 'key_green',
    0x67: 'key_yellow',
    0x68: 'flippers',
    0x69: 'fire_boots',
    0x6a: 'cleats',
    0x6b: 'suction_boots',
    0x6c: ['player', 'north'],
    0x6d: ['player', 'west'],
    0x6e: ['player', 'south'],
    0x6f: ['player', 'east'],
};
    
function parse_level(buf) {
    let level = new util.StoredLevel;
    // Map size is always fixed as 32x32 in CC1
    level.size_x = 32;
    level.size_y = 32;
    for (let i = 0; i < 1024; i++) {
        level.linear_cells.push(new util.StoredCell);
    }
    level.use_cc1_boots = true;

    let view = new DataView(buf);
    let bytes = new Uint8Array(buf);
    console.log(bytes);

    // Header
    let level_number = view.getUint16(0, true);
    level.time_limit = view.getUint16(2, true);
    level.chips_required = view.getUint16(4, true);

    // Map layout
    let unknown = view.getUint16(6, true);
    // Same structure twice, for the two layers
    let p = 8;
    for (let l = 0; l < 2; l++) {
        let layer_length = view.getUint16(p, true);
        p += 2;
        let c = 0;
        let end = p + layer_length;
        while (p < end) {
            let tile_byte = bytes[p];
            p++;
            let count = 1;
            if (tile_byte === 0xff) {
                // RLE: 0xff, count, tile
                count = bytes[p];
                tile_byte = bytes[p + 1];
                p += 2;
            }

            let name = CC1_TILE_ENCODING[tile_byte];
            // TODO could be more forgiving for goofy levels doing goofy things
            if (! name)
                // TODO doesn't say what level or where in the file, come on
                throw new Error(`Invalid tile byte: 0x${tile_byte.toString(16)}`);

            let direction;
            if (name instanceof Array) {
                [name, direction] = name;
            }
            let tile_type = TILE_TYPES[name];

            let tile = {name: name, direction: direction};
            for (let i = 0; i < count; i++) {
                if (c >= 1024)
                    throw new Error("Too many cells found");

                let cell = level.linear_cells[c];
                c++;

                // FIXME not entirely sure how to handle floor, to be honest; should it just be blank, and blank cells get drawn as floor?  eugh but then it would be drawn under floor tiles too...
                if (name === 'floor' && cell.length > 0) {
                    continue;
                }

                cell.push({name, direction});
            }
        }
        if (c !== 1024)
            throw new Error(`Expected 1024 cells (32x32 map); found ${c}`);
    }

    // Optional metadata fields
    let meta_length = view.getUint16(p, true);
    p += 2;
    let end = p + meta_length;
    while (p < meta_length) {
        // Common header
        let field_type = view.getUint16(p, true);
        let field_length = view.getUint16(p + 2, true);
        p += 4;
        if (field_type === 0x01) {
            // Level time; unnecessary since it's already in the level header
            // TODO check, compare, warn?
        }
        else if (field_type === 0x02) {
            // Chips; unnecessary since it's already in the level header
            // TODO check, compare, warn?
        }
        else if (field_type === 0x03) {
            // Title, including trailing NUL
            level.title = util.string_from_buffer_ascii(buf.slice(p, p + field_length - 1));
        }
        else if (field_type === 0x04) {
            // Trap linkages
            // TODO read this
            // TODO under lynx rules these aren't even used, and they cause bugs in mscc1!
        }
        else if (field_type === 0x05) {
            // Trap linkages
            // TODO read this
            // TODO under lynx rules these aren't even used, and they cause bugs in mscc1!
        }
        else if (field_type === 0x06) {
            // Password, with trailing NUL, and otherwise XORed with 0x99 (?!)
            let password = [];
            for (let i = 0; i < field_length - 1; i++) {
                password.push(view.getUint8(p + i, true) ^ 0x99);
            }
            level.password = String.fromCharCode.apply(null, password);
        }
        else if (field_type === 0x07) {
            // Hint, including trailing NUL, of course
            level.hint = util.string_from_buffer_ascii(buf.slice(p, p + field_length - 1));
        }
        else if (field_type === 0x08) {
            // Password, but not encoded
            // TODO ???
        }
        else if (field_type === 0x0a) {
            // Initial actor order
            // TODO ??? should i...  trust this...
        }
        p += field_length;
    }

    return level;
}

export function parse_game(buf) {
    let game = new util.StoredGame;

    let full_view = new DataView(buf);
    let magic = full_view.getUint32(0, true);
    if (magic === 0x0002aaac) {
        // OK
        // TODO probably use ms rules
    }
    else if (magic === 0x0102aaac) {
        // OK
        // TODO tile world convention, use lynx rules
    }
    else {
        throw new Error(`Unrecognized magic number ${magic.toString(16)}`);
    }

    let level_count = full_view.getUint16(4, true);

    // And now, the levels
    let p = 6;
    for (let l = 1; l <= level_count; l++) {
        console.log('level', l);
        let length = full_view.getUint16(p, true);
        let level_buf = buf.slice(p + 2, p + 2 + length);
        p += 2 + length;

        let level = parse_level(level_buf);
        game.levels.push(level);
        break;
    }

    return game;
}
