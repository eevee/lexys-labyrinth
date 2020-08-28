import * as util from './format-util.js';
import { TILE_TYPES, CC2_TILE_TYPES } from './tiletypes.js';

const CC1_TILE_ENCODING = {
    0x00: 'floor',
    0x01: 'wall',
    0x02: 'chip',
    0x03: 'water',
    0x04: 'fire',
    0x05: 'wall_invisible',
    0x06: 'thinwall_n',
    0x07: 'thinwall_w',
    0x08: 'thinwall_s',
    0x09: 'thinwall_e',
    0x0a: 'dirt_block',
    0x0b: 'dirt',
    0x0c: 'ice',
    0x0d: 'force_floor_s',
    0x0e: ['clone_block', 'north'],
    0x0f: ['clone_block', 'west'],
    0x10: ['clone_block', 'south'],
    0x11: ['clone_block', 'east'],
    0x12: 'force_floor_n',
    0x13: 'force_floor_e',
    0x14: 'force_floor_w',
    0x15: 'exit',
    0x16: 'door_blue',
    0x17: 'door_red',
    0x18: 'door_green',
    0x19: 'door_yellow',
    0x1a: 'ice_nw',
    0x1b: 'ice_ne',
    0x1c: 'ice_se',
    0x1d: 'ice_sw',
    0x1e: 'fake_floor',
    0x1f: 'fake_wall',
    0x20: 'wall_invisible',  // unused
    0x21: 'thief_tools',
    0x22: 'socket',
    0x23: 'button_green',
    0x24: 'button_red',
    0x25: 'green_wall',
    0x26: 'green_floor',
    0x27: 'button_brown',
    0x28: 'button_blue',
    0x29: 'teleport_blue',
    0x2a: 'bomb',
    0x2b: 'trap',
    0x2c: 'wall_appearing',
    0x2d: 'gravel',
    0x2e: 'popwall',
    0x2f: 'hint',
    0x30: 'thinwall_se',
    0x31: 'cloner',
    0x32: 'force_floor_all',
    0x33: 'player_drowned',
    0x34: 'player_burned',
    //0x35: player_burned,  XXX is this burned off a tile or?
    0x36: 'wall_invisible',  // unused
    0x37: 'wall_invisible',  // unused
    0x38: 'wall_invisible',  // unused
    //0x39: exit_player,
    0x3a: 'exit',
    0x3b: 'exit',  // i think this is for the second frame of the exit animation?
    // FIXME??? 0x3c - 0x3f are player swimming!
    0x40: ['bug', 'north'],
    0x41: ['bug', 'west'],
    0x42: ['bug', 'south'],
    0x43: ['bug', 'east'],
    0x44: ['fireball', 'north'],
    0x45: ['fireball', 'west'],
    0x46: ['fireball', 'south'],
    0x47: ['fireball', 'east'],
    0x48: ['ball', 'north'],
    0x49: ['ball', 'west'],
    0x4a: ['ball', 'south'],
    0x4b: ['ball', 'east'],
    0x4c: ['tank_blue', 'north'],
    0x4d: ['tank_blue', 'west'],
    0x4e: ['tank_blue', 'south'],
    0x4f: ['tank_blue', 'east'],
    0x50: ['glider', 'north'],
    0x51: ['glider', 'west'],
    0x52: ['glider', 'south'],
    0x53: ['glider', 'east'],
    0x54: ['teeth', 'north'],
    0x55: ['teeth', 'west'],
    0x56: ['teeth', 'south'],
    0x57: ['teeth', 'east'],
    0x58: ['walker', 'north'],
    0x59: ['walker', 'west'],
    0x5a: ['walker', 'south'],
    0x5b: ['walker', 'east'],
    0x5c: ['blob', 'north'],
    0x5d: ['blob', 'west'],
    0x5e: ['blob', 'south'],
    0x5f: ['blob', 'east'],
    0x60: ['paramecium', 'north'],
    0x61: ['paramecium', 'west'],
    0x62: ['paramecium', 'south'],
    0x63: ['paramecium', 'east'],
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
    while (p < end) {
        // Common header
        let field_type = view.getUint8(p, true);
        let field_length = view.getUint8(p + 1, true);
        p += 2;
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
        let length = full_view.getUint16(p, true);
        let level_buf = buf.slice(p + 2, p + 2 + length);
        p += 2 + length;

        let level = parse_level(level_buf);
        game.levels.push(level);
    }

    return game;
}
