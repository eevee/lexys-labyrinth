import { DIRECTIONS } from './defs.js';
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
        // Force floor seed can apparently be anything; my best guess, based on the Desert Oasis
        // replay, is that it's just incremented and allowed to overflow, so taking it mod 4 gives
        // the correct starting direction
        this.initial_force_floor_direction = ['north', 'east', 'south', 'west'][this.bytes[1] % 4];
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


let modifier_wire = {
    decode(tile, modifier) {
        tile.wire_directions = modifier & 0x0f;
        tile.wire_tunnel_directions = (modifier & 0xf0) >> 4;
    },
    encode(tile) {
        return tile.wire_directions | (tile.wire_tunnel_directions << 4);
    },
};

let arg_direction = {
    size: 1,
    decode(tile, dirbyte) {
        let direction = ['north', 'east', 'south', 'west'][dirbyte & 0x03];
        tile.direction = direction;
    },
    encode(tile) {
        return {north: 0, east: 1, south: 2, west: 3}[tile.direction];
    },
};

// TODO assert that direction + next match the tile types
const TILE_ENCODING = {
    0x01: {
        name: 'floor',
        modifier: modifier_wire,
    },
    0x02: {
        name: 'wall',
    },
    0x03: {
        name: 'ice',
    },
    0x04: {
        name: 'ice_sw',
    },
    0x05: {
        name: 'ice_nw',
    },
    0x06: {
        name: 'ice_ne',
    },
    0x07: {
        name: 'ice_se',
    },
    0x08: {
        name: 'water',
    },
    0x09: {
        name: 'fire',
    },
    0x0a: {
        name: 'force_floor_n',
    },
    0x0b: {
        name: 'force_floor_e',
    },
    0x0c: {
        name: 'force_floor_s',
    },
    0x0d: {
        name: 'force_floor_w',
    },
    0x0e: {
        name: 'green_wall',
    },
    0x0f: {
        name: 'green_floor',
    },
    0x10: {
        name: 'teleport_red',
        modifier: modifier_wire,
    },
    0x11: {
        name: 'teleport_blue',
        modifier: modifier_wire,
    },
    0x12: {
        name: 'teleport_yellow',
    },
    0x13: {
        name: 'teleport_green',
    },
    0x14: {
        name: 'exit',
    },
    0x15: {
        name: 'slime',
    },
    0x16: {
        name: 'player',
        has_next: true,
        extra_args: [arg_direction],
    },
    0x17: {
        name: 'dirt_block',
        has_next: true,
        extra_args: [arg_direction],
    },
    0x18: {
        name: 'walker',
        has_next: true,
        extra_args: [arg_direction],
    },
    0x19: {
        name: 'glider',
        has_next: true,
        extra_args: [arg_direction],
    },
    0x1a: {
        name: 'ice_block',
        has_next: true,
        extra_args: [arg_direction],
    },
    0x1b: {
        name: 'thinwall_s',
        has_next: true,
    },
    0x1c: {
        name: 'thinwall_e',
        has_next: true,
    },
    0x1d: {
        name: 'thinwall_se',
        has_next: true,
    },
    0x1e: {
        name: 'gravel',
    },
    0x1f: {
        name: 'button_green',
    },
    0x20: {
        name: 'button_blue',
    },
    0x21: {
        name: 'tank_blue',
        has_next: true,
        extra_args: [arg_direction],
    },
    0x22: {
        name: 'door_red',
    },
    0x23: {
        name: 'door_blue',
    },
    0x24: {
        name: 'door_yellow',
    },
    0x25: {
        name: 'door_green',
    },
    0x26: {
        name: 'key_red',
        has_next: true,
    },
    0x27: {
        name: 'key_blue',
        has_next: true,
    },
    0x28: {
        name: 'key_yellow',
        has_next: true,
    },
    0x29: {
        name: 'key_green',
        has_next: true,
    },
    0x2a: {
        name: 'chip',
        has_next: true,
    },
    0x2b: {
        name: 'chip_extra',
        has_next: true,
    },
    0x2c: {
        name: 'socket',
    },
    0x2d: {
        name: 'popwall',
    },
    0x2e: {
        name: 'wall_appearing',
    },
    0x2f: {
        name: 'wall_invisible',
    },
    0x30: {
        name: 'fake_wall',
    },
    0x31: {
        name: 'fake_floor',
    },
    0x32: {
        name: 'dirt',
    },
    0x33: {
        name: 'bug',
        has_next: true,
        extra_args: [arg_direction],
    },
    0x34: {
        name: 'paramecium',
        has_next: true,
        extra_args: [arg_direction],
    },
    0x35: {
        name: 'ball',
        has_next: true,
        extra_args: [arg_direction],
    },
    0x36: {
        name: 'blob',
        has_next: true,
        extra_args: [arg_direction],
    },
    0x37: {
        name: 'teeth',
        has_next: true,
        extra_args: [arg_direction],
    },
    0x38: {
        name: 'fireball',
        has_next: true,
        extra_args: [arg_direction],
    },
    0x39: {
        name: 'button_red',
    },
    0x3a: {
        name: 'button_brown',
    },
    0x3b: {
        name: 'cleats',
        has_next: true,
    },
    0x3c: {
        name: 'suction_boots',
        has_next: true,
    },
    0x3d: {
        name: 'fire_boots',
        has_next: true,
    },
    0x3e: {
        name: 'flippers',
        has_next: true,
    },
    0x3f: {
        name: 'thief_tools',
    },
    0x40: {
        name: 'bomb',
        has_next: true,
    },
    //0x41: Open trap (unused in main levels) : 
    0x42: {
        name: 'trap',
    },
    0x43: {
        name: 'cloner',
    },
    0x44: {
        name: 'cloner',
        // TODO visual directions bitmask, no gameplay impact, possible editor impact
        modifier: null,
    },
    0x45: {
        name: 'hint',
    },
    0x46: {
        name: 'force_floor_all',
    },
    // 0x47: 'button_gray',
    // FIXME swivel floors...  argh...
    0x48: {
        name: 'swivel_sw',
    },
    0x49: {
        name: 'swivel_nw',
    },
    0x4a: {
        name: 'swivel_ne',
    },
    0x4b: {
        name: 'swivel_se',
    },
    0x4c: {
        name: 'stopwatch_bonus',
        has_next: true,
    },
    0x4d: {
        name: 'stopwatch_toggle',
        has_next: true,
    },
    0x4e: {
        name: 'transmogrifier',
        modifier: modifier_wire,
    },
    0x4f: {
        name: 'railroad',
        modifier: {
            decode(tile, mask) {
                // TODO railroad props
            },
            encode(tile) {
                // TODO
                return 0;
            },
        },
    },
    0x50: {
        name: 'steel',
        modifier: modifier_wire,
    },
    0x51: {
        name: 'dynamite',
        has_next: true,
    },
    0x52: {
        name: 'helmet',
        has_next: true,
    },
    0x56: {
        name: 'player2',
        has_next: true,
        extra_args: [arg_direction],
    },
    // 0x57: Timid teeth : '#direction', '#next'
    // 0x58: Explosion animation (unused in main levels) : '#direction', '#next'
    0x59: {
        name: 'hiking_boots',
        has_next: true,
    },
    0x5a: {
        name: 'no_player2_sign',
    },
    0x5b: {
        name: 'no_player1_sign',
    },
    // 0x5c: Inverter gate (N) : Modifier allows other gates, see below
    0x5e: {
        name: 'button_pink',
        modifier: modifier_wire,
    },
    0x5f: {
        name: 'flame_jet_off',
    },
    0x60: {
        name: 'flame_jet_on',
    },
    0x61: {
        name: 'button_orange',
    },
    // 0x62: Lightning bolt : '#next'
    0x63: {
        name: 'tank_yellow',
        has_next: true,
        extra_args: [arg_direction],
    },
    0x64: {
        name: 'button_yellow',
    },
    // 0x65: Mirror Chip : '#direction', '#next'
    // 0x66: Mirror Melinda : '#direction', '#next'
    0x68: {
        name: 'bowling_ball',
        has_next: true,
    },
    0x69: {
        name: 'rover',
        has_next: true,
        extra_args: [arg_direction],
    },
    0x6a: {
        name: 'stopwatch_penalty',
        has_next: true,
    },
    0x6b: {
        name: ['floor_custom_green', 'floor_custom_pink', 'floor_custom_yellow', 'floor_custom_blue'],
    },
    0x6d: {
        // TODO oh this one is probably gonna be hard
        name: '#thinwall/canopy',
        has_next: true,
    },
    0x6f: {
        name: 'railroad_sign',
        has_next: true,
    },
    0x70: {
        name: ['wall_custom_green', 'wall_custom_pink', 'wall_custom_yellow', 'wall_custom_blue'],
    },
    0x71: {
        name: 'floor_letter',
        modifier: {
            decode(tile, ascii_code) {
                tile.ascii_code = ascii_code;
            },
            encode(tile) {
                return tile.ascii_code;
            },
        },
    },
    0x72: {
        name: 'purple_wall',
    },
    0x73: {
        name: 'purple_floor',
    },
    0x76: {
        name: '#mod8',
    },
    0x77: {
        name: '#mod16',
    },
    0x78: {
        name: '#mod32',
    },
    0x7a: {
        name: 'score_10',
        has_next: true,
    },
    0x7b: {
        name: 'score_100',
        has_next: true,
    },
    0x7c: {
        name: 'score_1000',
        has_next: true,
    },
    0x7d: {
        name: 'popdown_wall',
    },
    0x7e: {
        name: 'popdown_floor',
    },
    0x7f: {
        name: 'forbidden',
        has_next: true,
    },
    0x80: {
        name: 'score_2x',
        has_next: true,
    },
    0x81: {
        name: 'directional_block',
        extra_args: [
            arg_direction,
            {
                size: 1,
                decode(tile, mask) {
                    let arrows = new Set;
                    for (let [direction, info] of Object.entries(DIRECTIONS)) {
                        if (mask & info.bit) {
                            arrows.add(direction);
                        }
                    }
                    tile.arrows = arrows;
                },
                encode(tile) {
                    // TODO
                    return 0;
                },
            },
        ],
        has_next: true,
    },
    0x82: {
        name: 'floor_mimic',
        has_next: true,
        extra_args: [arg_direction],
    },
    0x83: {
        name: 'green_bomb',
        has_next: true,
    },
    0x84: {
        name: 'green_chip',
        has_next: true,
    },
    0x87: {
        name: 'button_black',
        modifier: modifier_wire,
    },
    // 0x88: ON/OFF switch (OFF) : 
    // 0x89: ON/OFF switch (ON) : 
    0x8a: {
        name: 'thief_keys',
    },
    0x8b: {
        name: 'ghost',
        has_next: true,
        extra_args: [arg_direction],
    },
    0x8c: {
        name: 'foil',
        has_next: true,
    },
    0x8d: {
        name: 'turtle',
    },
    0x8e: {
        name: 'xray_eye',
        has_next: true,
    },
    // 0x8f: Thief bribe : '#next'
    // 0x90: Speed boots : '#next'
    // 0x92: Hook : '#next' 
};
const REVERSE_TILE_ENCODING = {};
for (let [tile_byte, spec] of Object.entries(TILE_ENCODING)) {
    spec.tile_byte = tile_byte;

    if (spec.name instanceof Array) {
        // Custom floor/wall
        for (let [i, name] of spec.name.entries()) {
            // Copy the spec with a hardcoded modifier
            let new_spec = Object.assign({}, spec);
            new_spec.name = name;
            new_spec.modifier = {
                encode(tile) {
                    return i;
                },
            };
            REVERSE_TILE_ENCODING[name] = new_spec;
        }
    }
    else {
        REVERSE_TILE_ENCODING[spec.name] = spec;
    }
}

// Read 1, 2, or 4 bytes from a DataView
function read_n_bytes(view, start, n) {
    if (n === 1) {
        return view.getUint8(start, true);
    }
    else if (n === 2) {
        return view.getUint16(start, true);
    }
    else if (n === 4) {
        return view.getUint32(start, true);
    }
    else {
        throw new Error(`Can't read ${n} bytes`);
    }
}

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

export function parse_level(buf, number = 1) {
    let level = new util.StoredLevel(number);
    let full_view = new DataView(buf);
    let next_section_start = 0;
    let extra_hints = [];
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
                [level.comment, ...extra_hints] = str.split(/^\[CLUE\]$/mg);
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
            let map_view = new DataView(data);
            let width = bytes[0];
            let height = bytes[1];
            level.size_x = width;
            level.size_y = height;
            let p = 2;

            let n;

            function read_spec() {
                let tile_byte = bytes[p];
                p++;
                if (tile_byte === undefined)
                    throw new Error(`Read past end of file in cell ${n}`);

                let spec = TILE_ENCODING[tile_byte];
                if (! spec)
                    throw new Error(`Unrecognized tile type 0x${tile_byte.toString(16)}`);

                return spec;
            }

            for (n = 0; n < width * height; n++) {
                let cell = new util.StoredCell;
                while (true) {
                    let spec = read_spec();

                    // Deal with modifiers
                    let modifier = 0;  // defaults to zero
                    if (spec.name === '#mod8' || spec.name === '#mod16' || spec.name === '#mod32') {
                        if (spec.name === '#mod8') {
                            modifier = bytes[p];
                            p++;
                        }
                        else if (spec.name === '#mod16') {
                            modifier = map_view.getUint16(p, true);
                            p += 2;
                        }
                        else if (spec.name === '#mod32') {
                            modifier = map_view.getUint32(p, true);
                            p += 4;
                        }
                        spec = read_spec();
                        if (! spec.modifier) {
                            console.warn("Got unexpected modifier for tile:", spec.name);
                        }
                    }

                    let name = spec.name;

                    // Make a tile template, possibly dealing with some special cases
                    // FIXME restore this
                    if (name === '#thinwall/canopy') {
                        // Thin walls and the canopy are combined into a single byte for some
                        // reason; split them apart here.  Which ones we get is determined by a
                        // bitmask
                        let mask = bytes[p];
                        p++;
                        // This order is important; this is the order CC2 draws them in
                        if (mask & 0x10) {
                            cell.push({type: TILE_TYPES['canopy']});
                        }
                        if (mask & 0x08) {
                            cell.push({type: TILE_TYPES['thinwall_w']});
                        }
                        if (mask & 0x04) {
                            cell.push({type: TILE_TYPES['thinwall_s']});
                        }
                        if (mask & 0x02) {
                            cell.push({type: TILE_TYPES['thinwall_e']});
                        }
                        if (mask & 0x01) {
                            cell.push({type: TILE_TYPES['thinwall_n']});
                        }
                        // Skip the rest of the loop.  That means we don't handle any of the other
                        // special behavior below, but neither thin walls nor canopies should use
                        // any of it, so that's fine
                        continue;
                    }
                    else if (name instanceof Array) {
                        // Custom floors and walls are one of several options, chosen by modifier
                        name = name[modifier];
                    }

                    let type = TILE_TYPES[name];
                    if (!type) console.error(name, spec);
                    let tile = {type};
                    cell.push(tile);
                    if (spec.modifier) {
                        spec.modifier.decode(tile, modifier);
                    }

                    if (type.is_required_chip) {
                        level.chips_required++;
                    }
                    if (type.is_hint) {
                        // Remember all the hint tiles (in reading order) so we can map extra hints
                        // to them later.  Don't do it now, since the format doesn't technically
                        // guarantee that the metadata sections appear before the map data!
                        hint_tiles.push(tile);
                    }

                    // Handle extra arguments
                    if (spec.extra_args) {
                        for (let argspec of spec.extra_args) {
                            let arg = read_n_bytes(map_view, p, argspec.size);
                            p += argspec.size;
                            argspec.decode(tile, arg);
                        }
                    }

                    if (! spec.has_next)
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


// Write 1, 2, or 4 bytes to a DataView
function write_n_bytes(view, start, n, value) {
    if (n === 1) {
        view.setUint8(start, value, true);
    }
    else if (n === 2) {
        view.setUint16(start, value, true);
    }
    else if (n === 4) {
        view.setUint32(start, value, true);
    }
    else {
        throw new Error(`Can't write ${n} bytes`);
    }
}


// Compress map data or a replay, using an LZ77-esque scheme
function compress(buf) {
    let bytes = new Uint8Array(buf);
    // Can't be longer than the original; if it is, don't bother compressing!
    let outbytes = new Uint8Array(buf.byteLength);
    // First two bytes are uncompressed size
    new DataView(outbytes.buffer).setUint16(0, buf.byteLength, true);
    let p = 0;
    let q = 2;
    let pending_data_length = 0;
    while (p < buf.byteLength) {
        // Look back through the window (the previous 255 bytes, since that's the furthest back we
        // can look) for a match that matches as much of the upcoming data as possible
        let best_start = null;
        let best_length = 0;
        for (let b = Math.max(0, p - 255); b < p; b++) {
            if (bytes[b] !== bytes[p])
                continue;

            // First byte matches; let's keep going and see how much else does, up to 127 max
            let length = 1;
            while (length < 127 && b + length < buf.byteLength) {
                if (bytes[b + length] === bytes[p + length]) {
                    length++;
                }
                else {
                    break;
                }
            }

            if (length > best_length) {
                best_start = b;
                best_length = length;
            }
        }

        // If we found a match that's worth copying (i.e. shorter than just writing a data block),
        // then do so
        let do_copy = (best_length > 3);
        // Write out any pending data block if necessary -- i.e. if we're about to write a copy
        // block, if we're at the max size of a data block, or if this is the end of the data
        if (pending_data_length > 0 &&
            (do_copy || pending_data_length === 127 || p === buf.byteLength - 1))
        {
            outbytes[q] = pending_data_length;
            q++;
            for (let i = p - pending_data_length; i < p; i++) {
                outbytes[q] = bytes[i];
                q++;
            }
            pending_data_length = 0;
        }

        if (do_copy) {
            outbytes[q] = 0x80 + best_length;
            outbytes[q + 1] = p - best_start;
            q += 2;
            // Update p, noting that we might've done a copy into the future
            p += best_length;
        }
        else {
            // Otherwise, add this to a pending data block
            pending_data_length += 1;
            p++;
        }

        // If we ever exceed the uncompressed length, don't even bother
        if (q > buf.byteLength) {
            return null;
        }
    }
    // FIXME don't love this slice
    return outbytes.buffer.slice(0, q);
}

class C2M {
    constructor() {
        this._sections = [];  // array of [name, arraybuffer]
    }

    add_section(name, buf) {
        if (name.length !== 4) {
            throw new Error(`Section names must be four characters, not '${name}'`);
        }

        if (typeof buf === 'string' || buf instanceof String) {
            let str = buf;
            // C2M also includes the trailing NUL
            buf = new ArrayBuffer(str.length + 1);
            let array = new Uint8Array(buf);
            for (let i = 0, l = str.length; i < l; i++) {
                array[i] = str.charCodeAt(i);
            }
        }

        this._sections.push([name, buf]);
    }

    serialize() {
        let parts = [];
        let total_length = 0;
        for (let [name, buf] of this._sections) {
            total_length += buf.byteLength + 8;
        }

        let ret = new ArrayBuffer(total_length);
        let array = new Uint8Array(ret);
        let view = new DataView(ret);
        let p = 0;
        for (let [name, buf] of this._sections) {
            // Write the header
            for (let i = 0; i < 4; i++) {
                view.setUint8(p + i, name.charCodeAt(i));
            }
            view.setUint32(p + 4, buf.byteLength, true);
            p += 8;

            // Copy in the section contents
            array.set(new Uint8Array(buf), p);
            p += buf.byteLength;
        }

        return ret;
    }
}

export function synthesize_level(stored_level) {
    let c2m = new C2M;
    c2m.add_section('CC2M', '133');

    // FIXME well this will not do
    let map_bytes = new Uint8Array(4096);
    let map_view = new DataView(map_bytes.buffer);
    map_bytes[0] = stored_level.size_x;
    map_bytes[1] = stored_level.size_y;
    let p = 2;
    for (let cell of stored_level.linear_cells) {
        for (let i = cell.length - 1; i >= 0; i--) {
            let tile = cell[i];
            // FIXME does not yet support canopy or thin walls  >:S
            let spec = REVERSE_TILE_ENCODING[tile.type.name];

            if (spec.modifier) {
                let mod = spec.modifier.encode(tile);
                if (mod === 0) {
                    // Zero is optional; do nothing
                }
                else if (mod < 256) {
                    // Encode in one byte
                    map_bytes[p] = REVERSE_TILE_ENCODING['#mod8'].tile_byte;
                    map_bytes[p + 1] = mod;
                    p += 2;
                }
                else if (mod < 65536) {
                    // Encode in two bytes
                    map_bytes[p] = REVERSE_TILE_ENCODING['#mod16'].tile_byte;
                    map_view.setUint16(p + 1, mod, true);
                    p += 3;
                }
                else {
                    // Encode in four (!) bytes
                    map_bytes[p] = REVERSE_TILE_ENCODING['#mod32'].tile_byte;
                    map_view.setUint16(p + 1, mod, true);
                    p += 5;
                }
            }

            map_bytes[p] = spec.tile_byte;
            p++;

            if (spec.extra_args) {
                for (let argspec of spec.extra_args) {
                    let arg = argspec.encode(tile);
                    write_n_bytes(map_view, p, argspec.size, arg);
                    p += argspec.size;
                }
            }

            // TODO assert that the bottom tile has no next, and all the others do
        }
    }

    // FIXME ack, ArrayBuffer.slice makes a copy actually!  and i use it a lot in this file i think!!
    let map_buf = map_bytes.buffer.slice(0, p);
    let compressed_map = compress(map_buf);
    if (compressed_map) {
        c2m.add_section('PACK', compressed_map);
    }
    else {
        c2m.add_section('MAP ', map_buf);
    }

    c2m.add_section('END ', '');

    return c2m.serialize();
}
