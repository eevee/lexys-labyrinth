import * as util from './format-util.js';
import TILE_TYPES from './tiletypes.js';

const CC2_DEMO_INPUT_MASK = {
    drop:   0x01,
    down:   0x02,
    left:   0x04,
    right:  0x08,
    up:     0x10,
    swap:   0x20,
    cycle:  0x40,
};

class CC2Demo {
    constructor(buf) {
        this.buf = buf;
        this.bytes = new Uint8Array(buf);

        // byte 0 is unknown, always 0?
        this.force_floor_seed = this.bytes[1];
        this.blob_seed = this.bytes[2];
    }

    *[Symbol.iterator]() {
        let l = this.bytes.length;
        if (l % 2 === 0) {
            l--;
        }
        let input = new Set;
        let t = 0;
        for (let p = 3; p < l; p += 2) {
            // The first byte measures how long the /previous/ input remains
            // valid, so yield that first.  Note that this is measured in 60Hz
            // frames, so we need to convert to 20Hz tics by subtracting 3
            // frames at a time.
            let delay = this.bytes[p];
            if (delay === 0xff)
                break;

            t += delay;
            while (t >= 3) {
                t -= 3;
                yield input;
            }

            let input_mask = this.bytes[p + 1];
            let is_player_2 = ((input_mask & 0x80) !== 0);
            // TODO handle player 2
            if (is_player_2)
                continue;

            for (let [action, bit] of Object.entries(CC2_DEMO_INPUT_MASK)) {
                if ((input_mask & bit) === 0) {
                    input.delete(action);
                }
                else {
                    input.add(action);
                }
            }
        }
    }
}

// TODO assert that direction + next match the tile types
const TILE_ENCODING = {
    0x01: 'floor',
    0x02: 'wall',
    0x03: 'ice',
    0x04: 'ice_sw',
    0x05: 'ice_nw',
    0x06: 'ice_ne',
    0x07: 'ice_se',
    0x08: 'water',
    0x09: 'fire',
    0x0a: 'force_floor_n',
    0x0b: 'force_floor_e',
    0x0c: 'force_floor_s',
    0x0d: 'force_floor_w',
    0x0e: 'green_wall',
    0x0f: 'green_floor',
    //0x10: 'teleport_red',
    0x11: 'teleport_blue',
    //0x12: 'teleport_yellow',
    //0x13: 'teleport_green',
    0x14: 'exit',
    //0x15: 'slime',
    0x16: ['player', '#direction', '#next'],
    0x17: ['dirt_block', '#direction', '#next'],
    0x18: ['walker', '#direction', '#next'],
    0x19: ['glider', '#direction', '#next'],
    0x1a: ['ice_block', '#direction', '#next'],
    0x1b: ['thinwall_s', '#next'],
    0x1c: ['thinwall_e', '#next'],
    0x1d: ['thinwall_se', '#next'],
    0x1e: 'gravel',
    0x1f: 'button_green',
    0x20: 'button_blue',
    0x21: ['tank_blue', '#direction', '#next'],
    0x22: 'door_red',
    0x23: 'door_blue',
    0x24: 'door_yellow',
    0x25: 'door_green',
    0x26: ['key_red', '#next'],
    0x27: ['key_blue', '#next'],
    0x28: ['key_yellow', '#next'],
    0x29: ['key_green', '#next'],
    0x2a: ['chip', '#next'],
    0x2b: ['chip_extra', '#next'],
    0x2c: 'socket',
    0x2d: 'popwall',
    0x2e: 'wall_appearing',
    0x2f: 'wall_invisible',
    0x30: 'fake_wall',
    0x31: 'fake_floor',
    0x32: 'dirt',
    0x33: ['bug', '#direction', '#next'],
    0x34: ['paramecium', '#direction', '#next'],
    0x35: ['ball', '#direction', '#next'],
    0x36: ['blob', '#direction', '#next'],
    0x37: ['teeth', '#direction', '#next'],
    0x38: ['fireball', '#direction', '#next'],
    0x39: 'button_red',
    0x3a: 'button_brown',
    0x3b: ['cleats', '#next'],
    0x3c: ['suction_boots', '#next'],
    0x3d: ['fire_boots', '#next'],
    0x3e: ['flippers', '#next'],
    0x3f: 'thief_tools',
    0x40: ['bomb', '#next'],
    //0x41: Open trap (unused in main levels) : 
    0x42: 'trap',
    0x43: 'cloner',
    //0x44: Clone machine : Modifier required, see below
    0x45: 'hint',
    //0x46: 'force_floor_all',
    // 0x47: 'button_gray',
    0x48: ['swivel_sw', 'swivel_floor'],
    0x49: ['swivel_nw', 'swivel_floor'],
    0x4a: ['swivel_ne', 'swivel_floor'],
    0x4b: ['swivel_se', 'swivel_floor'],
    // 0x4c: Time bonus : '#next'
    // 0x4d: Stopwatch : '#next'
    // 0x4e: Transmogrifier : 
    // 0x4f: Railroad track (Modifier required, see section below) : 
    // 0x50: Steel wall : 
    // 0x51: Time bomb : '#next'
    // 0x52: Helmet : '#next'
    // 0x53: (Unused) : '#direction', '#next'
    // 0x54: (Unused) : 
    // 0x55: (Unused) : 
    // 0x56: Melinda : '#direction', '#next'
    // 0x57: Timid teeth : '#direction', '#next'
    // 0x58: Explosion animation (unused in main levels) : '#direction', '#next'
    // 0x59: Hiking boots : '#next'
    // 0x5a: Male-only sign : 
    // 0x5b: Female-only sign : 
    // 0x5c: Inverter gate (N) : Modifier allows other gates, see below
    // 0x5d: (Unused) : '#direction', '#next'
    // 0x5e: Logic switch (ON) : 
    // 0x5f: Flame jet (OFF) : 
    // 0x60: Flame jet (ON) : 
    // 0x61: Orange button : 
    // 0x62: Lightning bolt : '#next'
    // 0x63: Yellow tank : '#direction', '#next'
    // 0x64: Yellow tank button : 
    // 0x65: Mirror Chip : '#direction', '#next'
    // 0x66: Mirror Melinda : '#direction', '#next'
    // 0x67: (Unused) : 
    // 0x68: Bowling ball : '#next'
    // 0x69: Rover : '#direction', '#next'
    // 0x6a: Time penalty : '#next'
    // 0x6b: Custom floor (green) : Modifier allows other styles, see below
    // 0x6c: (Unused) : 
    // 0x6d: Thin wall / Canopy : Panel/Canopy bitmask (see below), '#next'
    // 0x6e: (Unused) : 
    // 0x6f: Railroad sign : '#next'
    // 0x70: Custom wall (green) : Modifier allows other styles, see below
    0x71: ['#mod8', 'floor_letter'],
    // 0x72: Purple toggle wall : 
    // 0x73: Purple toggle floor : 
    // 0x74: (Unused) : 
    // 0x75: (Unused) : 
    0x76: ['#mod8', '#next'],
    // 0x77: 16-bit Modifier (see Modifier section below) : 2 modifier bytes, Tile Specification for affected tile
    // 0x78: 32-bit Modifier (see Modifier section below) : 4 modifier bytes, Tile Specification for affected tile
    // 0x79: (Unused) : '#direction', '#next'
    0x7a: ['score_10', '#next'],
    0x7b: ['score_100', '#next'],
    0x7c: ['score_1000', '#next'],
    // 0x7d: Solid green wall : 
    // 0x7e: False green wall : 
    0x7f: ['forbidden', '#next'],
    0x80: ['score_2x', '#next'],
    // 0x81: Directional block : '#direction', Directional Arrows Bitmask, '#next'
    // 0x82: Floor mimic : '#direction', '#next'
    // 0x83: Green bomb : '#next'
    // 0x84: Green chip : '#next'
    // 0x85: (Unused) : '#next'
    // 0x86: (Unused) : '#next'
    // 0x87: Black button : 
    // 0x88: ON/OFF switch (OFF) : 
    // 0x89: ON/OFF switch (ON) : 
    0x8a: 'thief_keys',
    // 0x8b: Ghost : '#direction', '#next'
    // 0x8c: Steel foil : '#next'
    0x8d: ['turtle', 'water'],
    // 0x8e: Secret eye : '#next'
    // 0x8f: Thief bribe : '#next'
    // 0x90: Speed boots : '#next'
    // 0x91: (Unused) : 
    // 0x92: Hook : '#next' 
};

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
    let extra_hints;
    let hint_tiles = [];
    while (next_section_start < buf.byteLength) {
        // Read section header and length
        let section_start = next_section_start;
        let section_type = util.string_from_buffer_ascii(buf.slice(section_start, section_start + 4));
        let section_length = full_view.getUint32(section_start + 4, true);
        next_section_start = section_start + 8 + section_length;
        if (next_section_start > buf.byteLength)
            throw new Error(`Section at byte ${section_start} of type '${section_type}' extends ${buf.length - next_section_start} bytes past the end of the file`);

        // This chunk marks the end of the file regardless
        if (section_type === 'END ')
            break;

        if (section_type === 'CC2M' || section_type === 'LOCK' || section_type === 'VERS' ||
            section_type === 'TITL' || section_type === 'AUTH' ||
            section_type === 'CLUE' || section_type === 'NOTE')
        {
            // These are all singular strings (with a terminating NUL, for some reason)
            // XXX character encoding??
            let str = util.string_from_buffer_ascii(buf.slice(section_start + 8, next_section_start - 1)).replace(/\r\n/g, "\n");

            // TODO store more of this, at least for idempotence, maybe
            if (section_type === 'CC2M') {
                // File version, doesn't seem interesting
            }
            else if (section_type === 'LOCK') {
                // Unclear, seems to be a comment about the editor...?
            }
            else if (section_type === 'VERS') {
                // Editor version which created this level
            }
            else if (section_type === 'TITL') {
                // Level title
                level.title = str;
            }
            else if (section_type === 'AUTH') {
                // Author's name
                level.author = str;
            }
            else if (section_type === 'CLUE') {
                // Level hint
                level.hint = str;
            }
            else if (section_type === 'NOTE') {
                // Author's comments...  but might also include multiple hints
                // for levels with multiple hint tiles, delineated by [CLUE].
                // For my purposes, extra hints are associated with the
                // individual tiles, so we'll map those later
                [level.comment, ...extra_hints] = str.split(/(?<=^|\n)\[CLUE\]\n/g);
            }
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

            function read_spec() {
                let tile_byte = bytes[p];
                p++;
                if (tile_byte >= 0x77 && tile_byte <= 0x78) {
                    // XXX handle these modifier "tiles"
                    p += tile_byte - 0x75;
                    return [];
                }
                let spec = TILE_ENCODING[tile_byte];
                if (! spec)
                    throw new Error(`Unrecognized tile type 0x${tile_byte.toString(16)}`);

                let name;
                let args = [];
                if (spec instanceof Array) {
                    return spec;
                }
                else {
                    return [spec];
                }
            }

            for (let n = 0; n < width * height; n++) {
                let cell = new util.StoredCell;
                while (true) {
                    let [name, ...args] = read_spec();
                    if (name === undefined) continue;  // XXX modifier skip hack

                    let modifier;
                    if (name === '#mod8') {
                        if (args[0] !== '#next')
                            throw new Error(`Tile requires a preceding modifier`);

                        modifier = bytes[p];
                        p++;
                        let mod_marker;
                        [mod_marker, name, ...args] = read_spec();
                        if (mod_marker !== '#mod8')
                            throw new Error(`Expected a tile requiring a modifier`);
                    }

                    let tile = {name, modifier};
                    cell.push(tile);
                    let type = TILE_TYPES[name];
                    if (!type) console.error(name);
                    if (type.is_required_chip) {
                        level.chips_required++;
                    }
                    if (type.is_player) {
                        // TODO handle multiple starts
                        level.player_start_x = n % width;
                        level.player_start_y = Math.floor(n / width);
                    }
                    if (type.is_hint) {
                        // Remember all the hint tiles (in reading order) so we
                        // can map extra hints to them later.  Don't do it now,
                        // since the format doesn't technically guarantee that
                        // the metadata sections appear before the map data!
                        hint_tiles.push(tile);
                    }

                    // Handle extra arguments
                    let has_next = false;
                    for (let arg of args) {
                        if (arg === '#direction') {
                            let dirbyte = bytes[p];
                            p++;
                            let direction = ['north', 'east', 'south', 'west'][dirbyte];
                            if (! direction) {
                                console.warn(`'${name}' tile at ${n % width}, ${Math.floor(n / width)} has bogus direction byte ${dirbyte}; defaulting to south`);
                                direction = 'south';
                            }
                            tile.direction = direction;
                        }
                        else if (arg === '#next') {
                            has_next = true;
                        }
                        else {
                            // Anything else is an implicit next tile, e.g.
                            // turtles imply water underneath
                            cell.push({name: arg});
                        }
                    }

                    if (! has_next)
                        break;
                }
                cell.reverse();
                level.linear_cells.push(cell);
            }
        }
        else if (section_type === 'KEY ') {
        }
        else if (section_type === 'REPL' || section_type === 'PRPL') {
            // "Replay", i.e. demo solution
            let data = section_buf;
            if (section_type === 'PRPL') {
                data = decompress(data);
            }
            level.demo = new CC2Demo(data);
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

    // Connect extra hints
    let h = 0;
    for (let tile of hint_tiles) {
        if (h > extra_hints.length)
            break;

        tile.specific_hint = extra_hints[h];
        h++;
    }

    return level;
}
