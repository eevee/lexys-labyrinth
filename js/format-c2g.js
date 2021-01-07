import { DIRECTIONS, DIRECTION_ORDER, LAYERS } from './defs.js';
import * as format_base from './format-base.js';
import TILE_TYPES from './tiletypes.js';
import * as util from './util.js';

export function decode_replay(bytes) {
    if (bytes instanceof ArrayBuffer) {
        bytes = new Uint8Array(bytes);
    }

    // byte 0 is unknown, always 0?
    // Force floor seed can apparently be anything; my best guess, based on the Desert Oasis
    // replay, is that it's just incremented and allowed to overflow, so taking it mod 4 gives
    // the correct starting direction
    let initial_force_floor_direction = DIRECTION_ORDER[bytes[1] % 4];
    let blob_seed = bytes[2];

    // Add up the total length
    let duration = 0;
    let l = bytes.length ?? bytes.byteLength;
    if (l % 2 === 0) {
        l--;
    }
    for (let p = 3; p < l; p += 2) {
        let delay = bytes[p];
        if (delay === 0xff)
            break;
        duration += delay;
    }
    duration = Math.floor(duration / 3) + 1;  // leave room for final input

    // Inflate the replay into an array of byte-per-tic
    let inputs = new Uint8Array(duration);
    let i = 0;
    let t = 0;
    let input = 0;
    for (let p = 3; p < l; p += 2) {
        // The first byte measures how long the /previous/ input remains
        // valid, so yield that first.  Note that this is measured in 60Hz
        // frames, so we need to convert to 20Hz tics by subtracting 3
        // frames at a time.
        let delay = bytes[p];
        if (delay === 0xff)
            break;

        t += delay;
        while (t >= 3) {
            t -= 3;
            inputs[i] = input;
            i++;
        }

        input = bytes[p + 1];
        let is_player_2 = ((input & 0x80) !== 0);
        // TODO handle player 2
        if (is_player_2)
            continue;
    }
    inputs[i] = input;

    return new format_base.Replay(initial_force_floor_direction, blob_seed, inputs);
}

export function encode_replay(replay, stored_level = null) {
    let out = new Uint8Array(1024);
    out[0] = 0;
    out[1] = DIRECTIONS[replay.initial_force_floor_direction].index;
    out[2] = replay.blob_seed;
    let p = 3;
    let prev_input = null;
    let count = 0;
    for (let i = 0; i < replay.duration; i++) {
        if (p >= out.length - 4) {
            let new_out = new Uint8Array(Math.floor(out.length * 1.5));
            for (let j = 0; j < out.length; j++) {
                new_out[j] = out[j];
            }
            out = new_out;
        }

        let input = replay.inputs[i];
        if (input !== prev_input || count >= 252 - 2) {
            out[p] = count;
            out[p + 1] = input;
            p += 2;
            count = 3;
            prev_input = input;
        }
        else {
            count += 3;
        }
    }
    out[p] = 0xff;
    p += 1;
    out[p] = 0x00;
    p += 1;
    out = out.subarray(0, p);
    // TODO stick it on the level if given?
    return out;
}


let modifier_wire = {
    decode(tile, modifier) {
        tile.wire_directions = modifier & 0x0f;
        // TODO wait, what happens if you use wire tunnels on steel or something other than floor?
        tile.wire_tunnel_directions = (modifier & 0xf0) >> 4;
    },
    encode(tile) {
        return tile.wire_directions | (tile.wire_tunnel_directions << 4);
    },
};

let arg_direction = {
    size: 1,
    decode(tile, dirbyte) {
        let direction = DIRECTION_ORDER[dirbyte & 0x03];
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
        // CC1 south thin wall
        name: 'thin_walls',
        has_next: true,
        modifier: {
            dummy: true,
            decode(tile, mod) {
                tile.edges = DIRECTIONS['south'].bit;
            },
            encode(tile) {
                return 0;
            },
        },
    },
    0x1c: {
        // CC1 east thin wall
        name: 'thin_walls',
        has_next: true,
        modifier: {
            dummy: true,
            decode(tile, mod) {
                tile.edges = DIRECTIONS['east'].bit;
            },
            encode(tile) {
                return 0;
            },
        },
    },
    0x1d: {
        // CC1 southeast thin wall
        name: 'thin_walls',
        has_next: true,
        modifier: {
            dummy: true,
            decode(tile, mod) {
                tile.edges = DIRECTIONS['south'].bit | DIRECTIONS['east'].bit;
            },
            encode(tile) {
                return 0;
            },
        },
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
    0x41: {
        name: 'trap',
        // Not actually a modifier, just using this for hax
        // FIXME round-trip this, maybe expose it in the editor (sigh)
        modifier: {
            dummy: true,
            decode(tile, mod) {
                tile._initially_open = true;
            },
            encode(tile) {
                return 0;
            },
        },
    },
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
    0x47: {
        name: 'button_gray',
    },
    0x48: {
        name: 'swivel_sw',
        dummy_terrain: 'swivel_floor',
    },
    0x49: {
        name: 'swivel_nw',
        dummy_terrain: 'swivel_floor',
    },
    0x4a: {
        name: 'swivel_ne',
        dummy_terrain: 'swivel_floor',
    },
    0x4b: {
        name: 'swivel_se',
        dummy_terrain: 'swivel_floor',
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
            _parts: ['ne', 'se', 'sw', 'ne', 'ew', 'ns'],
            decode(tile, mask) {
                // Leave the track parts alone as a bitmask; the type has a list of them
                tile.tracks = mask & 0x3f;
                // Check for a switch, which is a bit number in the above mask
                if (mask & 0x40) {
                    tile.track_switch = (mask >> 8) & 0x0f;
                }
                else {
                    tile.track_switch = null;
                }
                // Initial actor facing is in the highest nybble
                tile.entered_direction = DIRECTION_ORDER[(mask >> 12) & 0x03];
            },
            encode(tile) {
                let ret = tile.tracks & 0x3f;
                if (tile.track_switch !== null) {
                    ret |= 0x40;
                    ret |= tile.track_switch << 8;
                }
                if (tile.entered_direction) {
                    ret |= DIRECTION_ORDER.indexOf(tile.entered_direction) << 12;
                }
                return ret;
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
    0x57: {
        name: 'teeth_timid',
        has_next: true,
        extra_args: [arg_direction],
    },
    0x58: {
        // TODO??? unused in main levels -- name: '',
        has_next: true,
        extra_args: [arg_direction],
        error: "Explosion animation is not implemented, sorry!",
    },
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
    0x5c: {
        name: 'logic_gate',
        modifier: {
            decode(tile, modifier) {
                if (modifier >= 0x1e && modifier <= 0x27) {
                    // Counter, which can't be rotated
                    tile.direction = 'north';
                    tile.gate_type = 'counter';
                    tile.memory = modifier - 0x1e;
                }
                else {
                    tile.direction = DIRECTION_ORDER[modifier & 0x03];
                    let type = modifier >> 2;
                    if (type < 6) {
                        tile.gate_type = ['not', 'and', 'or', 'xor', 'latch-cw', 'nand'][type];
                    }
                    else if (type === 16) {
                        tile.gate_type = 'latch-ccw';
                    }
                    else {
                        tile.gate_type = 'bogus';
                    }
                }
            },
            encode(tile) {
                let direction_offset = DIRECTIONS[tile.direction].index;
                if (tile.gate_type === 'not') {
                    return 0 + direction_offset;
                }
                else if (tile.gate_type === 'and') {
                    return 4 + direction_offset;
                }
                else if (tile.gate_type === 'or') {
                    return 8 + direction_offset;
                }
                else if (tile.gate_type === 'xor') {
                    return 12 + direction_offset;
                }
                else if (tile.gate_type === 'latch-cw') {
                    return 16 + direction_offset;
                }
                else if (tile.gate_type === 'nand') {
                    return 20 + direction_offset;
                }
                else if (tile.gate_type === 'counter') {
                    return 30 + tile.memory;
                }
                else if (tile.gate_type === 'latch-ccw') {
                    return 64 + direction_offset;
                }
                else {
                    return 0xff;
                }
            },
        },
    },
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
    0x62: {
        name: 'lightning_bolt',
        has_next: true,
    },
    0x63: {
        name: 'tank_yellow',
        has_next: true,
        extra_args: [arg_direction],
    },
    0x64: {
        name: 'button_yellow',
    },
    0x65: {
        name: 'doppelganger1',
        has_next: true,
        extra_args: [arg_direction],
    },
    0x66: {
        name: 'doppelganger2',
        has_next: true,
        extra_args: [arg_direction],
    },
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
                if (ascii_code < 28 || ascii_code >= 96) {
                    // Invalid
                    tile.overlaid_glyph = "?";
                }
                else if (ascii_code < 32) {
                    // Arrows are stored goofily
                    tile.overlaid_glyph = ["⬆", "➡", "⬇", "⬅"][ascii_code - 28];
                }
                else {
                    tile.overlaid_glyph = String.fromCharCode(ascii_code);
                }
            },
            encode(tile) {
                let arrow_index = ["⬆", "➡", "⬇", "⬅"].indexOf(tile.overlaid_glyph);
                if (arrow_index >= 0) {
                    return arrow_index + 28;
                }

                return tile.overlaid_glyph.charCodeAt(0);
            },
        },
    },
    0x72: {
        name: 'purple_floor',
    },
    0x73: {
        name: 'purple_wall',
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
        name: 'no_sign',
        has_next: true,
    },
    0x80: {
        name: 'score_2x',
        has_next: true,
    },
    0x81: {
        name: 'frame_block',
        has_next: true,
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
                    let bits = 0;
                    for (let direction of tile.arrows) {
                        bits |= DIRECTIONS[direction].bit;
                    }
                    return bits;
                },
            },
        ],
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
    0x88: {
        name: 'light_switch_off',
        modifier: modifier_wire,
    },
    0x89: {
        name: 'light_switch_on',
        modifier: modifier_wire,
    },
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
    0x8f: {
        name: 'bribe',
        has_next: true,
    },
    0x90: {
        name: 'speed_boots',
        has_next: true,
    },
    0x92: {
        name: 'hook',
        has_next: true,
    },

    // LL-specific tiles
    0xe0: {
        name: 'gift_bow',
        has_next: true,
        is_extension: true,
    },
    0xe1: {
        name: 'circuit_block',
        has_next: true,
        modifier: modifier_wire,
        extra_args: [arg_direction],
        is_extension: true,
    },
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

// Decompress the little ad-hoc compression scheme used for both map data and solution playback
function decompress(bytes) {
    let decompressed_length = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(0, true);
    let outbytes = new Uint8Array(decompressed_length);
    let p = 2;
    let q = 0;
    while (p < bytes.length) {
        let len = bytes[p];
        p++;
        if (len < 0x80) {
            // Data block
            outbytes.set(new Uint8Array(bytes.buffer, bytes.byteOffset + p, len), q);
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
    return outbytes;
}

// Iterates over a C2M file and yields: [section type, uint8 array view of the section]
function* read_c2m_sections(buf) {
    let full_view = new DataView(buf);
    let next_section_start = 0;
    while (next_section_start < buf.byteLength) {
        // Read section header and length
        let section_start = next_section_start;
        let section_type = util.string_from_buffer_ascii(buf, section_start, 4);
        let section_length = full_view.getUint32(section_start + 4, true);
        next_section_start = section_start + 8 + section_length;
        if (next_section_start > buf.byteLength)
            throw new util.LLError(`Section at byte ${section_start} of type '${section_type}' extends ${buf.length - next_section_start} bytes past the end of the file`);

        // This chunk marks the end of the file, full stop; a lot of canonical files have garbage
        // newlines afterwards and will fail to continue to parse beyond this point
        if (section_type === 'END ')
            return;

        yield [section_type, new Uint8Array(buf, section_start + 8, section_length)];
    }
}

export function parse_level_metadata(buf) {
    let meta = {
        title: null,
    };
    for (let [type, bytes] of read_c2m_sections(buf)) {
        if (type === 'TITL') {
            meta.title = util.string_from_buffer_ascii(bytes, 0, bytes.length - 1).replace(/\r\n/g, "\n");
            // TODO anything else we want for now?
            break;
        }
    }
    return meta;
}

export function parse_level(buf, number = 1) {
    if (ArrayBuffer.isView(buf)) {
        buf = buf.buffer;
    }

    let level = new format_base.StoredLevel(number);
    level.format = 'c2m';
    level.uses_ll_extensions = false;  // we'll update this if it changes
    let extra_hints = [];
    let hint_tiles = [];
    for (let [type, bytes] of read_c2m_sections(buf)) {
        if (type === 'CC2M' || type === 'LOCK' || type === 'VERS' ||
            type === 'TITL' || type === 'AUTH' ||
            type === 'CLUE' || type === 'NOTE')
        {
            // These are all singular strings (with a terminating NUL, for some reason)
            // XXX character encoding??
            let str = util.string_from_buffer_ascii(bytes, 0, bytes.length - 1).replace(/\r\n/g, "\n");

            // TODO store more of this, at least for idempotence, maybe
            if (type === 'CC2M') {
                // File version, doesn't seem interesting
            }
            else if (type === 'LOCK') {
                // Unclear, seems to be a comment about the editor...?
            }
            else if (type === 'VERS') {
                // Editor version which created this level
            }
            else if (type === 'TITL') {
                // Level title
                level.title = str;
            }
            else if (type === 'AUTH') {
                // Author's name
                level.author = str;
            }
            else if (type === 'CLUE') {
                // Level hint
                level.hint = str;
            }
            else if (type === 'NOTE') {
                // Author's comments...  but might also include multiple hints for levels with
                // multiple hint tiles, delineated by [CLUE] (anywhere in the line (!)).
                // LL treats extra hints as tile properties, so store them for later
                [level.comment, ...extra_hints] = str.split(/\n?^.*\[CLUE\].*$\n?/mg);
            }
            continue;
        }

        let view = new DataView(buf, bytes.byteOffset, bytes.byteLength);

        if (type === 'OPTN') {
            // Level options, which may be truncated at any point
            // TODO implement most of these
            level.time_limit = view.getUint16(0, true);

            // TODO 0 - 10x10, 1 - 9x9, 2 - split, otherwise unknown which needs handling
            // FIXME does this default to 0 if no OPTN block is present?
            let viewport = view.getUint8(2, true);
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

            if (view.byteLength <= 3)
                continue;
            //options.has_solution = view.getUint8(3, true);

            if (view.byteLength <= 4)
                continue;
            //options.show_map_in_editor = view.getUint8(4, true);

            if (view.byteLength <= 5)
                continue;
            //options.is_editable = view.getUint8(5, true);

            if (view.byteLength <= 6)
                continue;
            //options.solution_hash = format_base.string_from_buffer_ascii(buf.slice(
                //section_start + 6, section_start + 22));

            if (view.byteLength <= 22)
                continue;
            //options.hide_logic = view.getUint8(22, true);

            if (view.byteLength <= 23)
                continue;
            level.use_cc1_boots = view.getUint8(23, true);

            if (view.byteLength <= 24)
                continue;
            level.blob_behavior = view.getUint8(24, true);
        }
        else if (type === 'MAP ' || type === 'PACK') {
            if (type === 'PACK') {
                bytes = decompress(bytes);
            }
            let map_view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
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
                    throw new util.LLError(`Read past end of file in cell ${n}`);

                let spec = TILE_ENCODING[tile_byte];
                if (! spec)
                    throw new util.LLError(`Invalid tile type 0x${tile_byte.toString(16)}`);
                if (spec.error)
                    throw new util.LLError(spec.error);

                return spec;
            }

            for (n = 0; n < width * height; n++) {
                let cell = new format_base.StoredCell;
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
                        if (! spec.modifier && ! (spec.name instanceof Array)) {
                            console.warn("Got unexpected modifier for tile:", spec.name);
                        }
                    }

                    if (spec.is_extension) {
                        level.uses_ll_extensions = true;
                    }

                    let name = spec.name;

                    // Make a tile template, possibly dealing with some special cases
                    if (name === '#thinwall/canopy') {
                        // Thin walls and the canopy are combined into a single byte for some
                        // reason; split them apart here.  Which ones we get is determined by a
                        // bitmask
                        let mask = bytes[p];
                        p++;
                        if (mask & 0x10) {
                            let type = TILE_TYPES['canopy'];
                            cell[type.layer] = {type};
                        }
                        if (mask & 0x0f) {
                            let type = TILE_TYPES['thin_walls'];
                            cell[type.layer] = {type, edges: mask & 0x0f};
                        }
                        // Skip the rest of the loop.  That means we don't handle any of the other
                        // special behavior below, but neither thin walls nor canopies should use
                        // any of it, so that's fine
                        continue;
                    }
                    else if (name instanceof Array) {
                        // Custom floors and walls are one of several options, chosen by modifier
                        name = name[modifier % name.length];
                    }

                    let type = TILE_TYPES[name];
                    if (!type) console.error(name, spec);
                    let tile = {type};
                    cell[type.layer] = tile;
                    if (spec.modifier) {
                        spec.modifier.decode(tile, modifier);
                    }

                    // Swivels come with their own specific flooring
                    // TODO this should go on the bottom
                    // TODO we should sort and also only allow one thing per layer
                    if (spec.dummy_terrain) {
                        let type = TILE_TYPES[spec.dummy_terrain];
                        cell[type.layer] = {type};
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
                level.linear_cells.push(cell);
            }
        }
        else if (type === 'KEY ') {
        }
        else if (type === 'REPL' || type === 'PRPL') {
            // "Replay", i.e. demo solution
            if (type === 'PRPL') {
                // TODO is even this necessary though
                bytes = decompress(bytes);
            }
            level._replay_data = bytes;
            level._replay_decoder = decode_replay;
        }
        else if (type === 'RDNY') {
        }
        // TODO LL custom chunks, should distinguish somehow
        else if (type === 'LXCM') {
            // Camera regions
            if (bytes.length % 4 !== 0)
                throw new Error(`Expected LXCM chunk to be a multiple of 4 bytes; got ${bytes.length}`);

            let p = 0;
            while (p < bytes.length) {
                let x = bytes[p + 0];
                let y = bytes[p + 1];
                let w = bytes[p + 2];
                let h = bytes[p + 3];
                // TODO validate?  must be smaller than map?
                level.camera_regions.push(new DOMRect(x, y, w, h));
                p += 4;
            }
        }
        else {
            console.warn(`Unrecognized section type '${type}' at offset ${bytes.byteOffset}`, view);
            // TODO save it, persist when editing level
        }
    }

    // Connect extra hints
    for (let [i, tile] of hint_tiles.entries()) {
        if (i < extra_hints.length) {
            tile.hint_text = extra_hints[i];
        }
        else {
            // Fall back to regular hint
            tile.hint_text = null;
        }
    }

    return level;
}

// This thin wrapper is passed to StoredGame as the parser function
function _parse_level_from_stored_meta(meta) {
    return parse_level(meta.bytes, meta.number);
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

        // If we're not copying, add this byte to a pending data block /now/, so the next block can
        // catch it if it happens to be the last byte
        if (! do_copy) {
            pending_data_length += 1;
            p++;
        }

        // Write out any pending data block if necessary -- i.e. if we're about to write a copy
        // block, if we're at the max size of a data block, or if this is the end of the data
        if (pending_data_length > 0 &&
            (do_copy || pending_data_length === 127 || p >= buf.byteLength))
        {
            outbytes[q] = pending_data_length;
            q++;
            for (let i = p - pending_data_length; i < p; i++) {
                outbytes[q] = bytes[i];
                q++;
            }
            pending_data_length = 0;
        }

        // Finally, do a copy
        if (do_copy) {
            outbytes[q] = 0x80 + best_length;
            outbytes[q + 1] = p - best_start;
            q += 2;
            // Update p, noting that we might've done a copy into the future
            p += best_length;
        }

        // If we ever exceed the uncompressed length, don't even bother
        if (q > buf.byteLength) {
            return null;
        }
    }
    return outbytes.subarray(0, q);
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
    c2m.add_section('CC2M', '7');  // latest version
    // TODO add in a VERS (editor version) section?  some other indication LL produced it?  not for
    // url sharing though, should make that as small as possible

    if (stored_level.title) {
        c2m.add_section('TITL', stored_level.title);
    }
    if (stored_level.author) {
        c2m.add_section('AUTH', stored_level.author);
    }

    // Options block
    let options = new Uint8Array(3);
    new DataView(options.buffer).setUint16(0, stored_level.time_limit, true);
    if (stored_level.viewport_size === 10) {
        options[2] = 0;
    }
    else if (stored_level.viewport_size === 9) {
        options[2] = 1;
    }
    // TODO split
    // TODO for size purposes, omit the block entirely if all options are defaults?
    c2m.add_section('OPTN', options);

    // Store camera regions
    // TODO LL feature, should be distinguished somehow
    if (stored_level.camera_regions.length > 0) {
        let bytes = new Uint8Array(4 * stored_level.camera_regions.length);
        let p = 0;
        for (let region of stored_level.camera_regions) {
            bytes[p + 0] = region.x;
            bytes[p + 1] = region.y;
            bytes[p + 2] = region.width;
            bytes[p + 3] = region.height;
            p += 4;
        }
        c2m.add_section('LXCM', bytes.buffer);
    }

    let map_bytes = new Uint8Array(1024);
    let map_view = new DataView(map_bytes.buffer);
    map_bytes[0] = stored_level.size_x;
    map_bytes[1] = stored_level.size_y;
    let hints = [];
    let p = 2;
    for (let cell of stored_level.linear_cells) {
        // If we're in danger of running out of room in our buffer, add another kilobyte and copy
        if (p >= map_bytes.length - 64) {
            let new_bytes = new Uint8Array(map_bytes.length + 1024);
            for (let i = 0; i < map_bytes.length; i++) {
                new_bytes[i] = map_bytes[i];
            }
            map_bytes = new_bytes;
            map_view = new DataView(map_bytes.buffer);
        }

        let dummy_terrain_tile = null;
        let handled_thin_walls = false;
        for (let i = LAYERS.MAX - 1; i >= 0; i--) {
            let tile = cell[i];
            if (! tile)
                continue;

            if (tile.type.name === 'canopy' || tile.type.name === 'thin_walls') {
                // These two tiles are encoded together despite being on different layers.  If we
                // see the canopy first, then find the thin wall tile (if any) and set a flag so we
                // don't try to encode it again
                if (handled_thin_walls)
                    continue;
                handled_thin_walls = true;

                let canopy, thin_walls;
                if (tile.type.name === 'canopy') {
                    canopy = tile;
                    thin_walls = cell[LAYERS.thin_wall];
                }
                else {
                    thin_walls = tile;
                }

                let arg = 0;
                if (canopy) {
                    arg |= 0x10;
                }
                if (thin_walls) {
                    arg |= thin_walls.edges;
                }

                map_bytes[p] = REVERSE_TILE_ENCODING['#thinwall/canopy'].tile_byte;
                map_bytes[p + 1] = arg;
                p += 2;
                continue;
            }

            let spec = REVERSE_TILE_ENCODING[tile.type.name];

            // Handle the swivel, a tile that draws as an overlay but is stored like terrain.  In a
            // level, it has two parts: the swivel itself, and a dummy swivel_floor terrain which is
            // unencodable.  To encode that, we notice when we hit a swivel (which happens first),
            // save it until we reach the terrain layer, and then sub it in instead.
            // TODO if i follow in tyler's footsteps and give swivel its own layer then i'll need to
            // complicate this somewhat
            if (tile.type.layer === LAYERS.terrain && dummy_terrain_tile) {
                tile = dummy_terrain_tile;
                spec = REVERSE_TILE_ENCODING[tile.type.name];
            }
            else if (spec.dummy_terrain) {
                // This is a swivel, a tile that draws as an overlay but is stored like terrain, so
                // wait until we hit terrain and store it then
                dummy_terrain_tile = tile;
                continue;
            }

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

            if (tile.type.name === 'hint') {
                hints.push(tile.hint_text);
            }

            // TODO assert that the bottom tile has no next, and all the others do
        }
    }
    map_bytes = map_bytes.subarray(0, p);

    // Collect hints first so we can put them in the comment field
    // FIXME this does not respect global hint, but then, neither does the editor.
    hints = hints.map(hint => hint ?? '');
    hints.push('');
    hints.unshift('');
    // Must use Windows linebreaks here  🙄
    c2m.add_section('NOTE', hints.join('\r\n[CLUE]\r\n'));

    let compressed_map = compress(map_bytes);
    if (compressed_map) {
        c2m.add_section('PACK', compressed_map);
    }
    else {
        c2m.add_section('MAP ', map_bytes);
    }

    // Add the replay, if any
    if (stored_level.has_replay) {
        let replay_bytes;
        if (stored_level._replay_data && stored_level._replay_decoder === decode_replay) {
            replay_bytes = stored_level._replay_data;
        }
        else {
            replay_bytes = encode_replay(stored_level.replay, stored_level);
        }

        let compressed_replay = compress(replay_bytes);
        if (compressed_replay) {
            c2m.add_section('PRPL', compressed_replay);
        }
        else {
            c2m.add_section('REPL', replay_bytes);
        }
    }

    c2m.add_section('END ', '');

    return c2m.serialize();
}


////////////////////////////////////////////////////////////////////////////////////////////////////
// C2G, the text format that stitches levels together into a game

// NOTE: C2G is surprisingly complicated for a game layout format, and most of its features are not
// currently supported.  Most of them have also never been used in practice, so that's fine.

// TODO this is not quite right yet; the architect has more specific lexing documentation

// Split a statement into a number of tokens.  This is, thankfully, relatively easy, due to the
// minimal syntax and the lack of string escapes (so we don't have to check for " vs \" vs \\").
// The tokens seem to be one of:
// - a bareword (could be a variable or keyword)
// - an operator
// - a literal number
// - a quoted string
// - a label
// - a comment
// And that's it!  So here's a regex to find all of them, and then we just use matchAll.
const TOKENIZE_RX = RegExp(
    // Eat any leading horizontal whitespace
    '[ \\t]*(?:' +
        // 1: Catch newlines as their own thing, since they are (sigh) important, sometimes
        '(\\n)' +
        // 2: Comments are preceded by ; or // for some reason and run to the end of the line
        '|(?:;|//)(.*)' +
        // 3: Strings are double-quoted (only!) and contain no escapes
        '|"([^"]*?)"' +
        // 4: Labels are indicated by a #, including when used with 'goto'
        // (the exact set of allowed characters is unclear and i'm fudging it here)
        '|#(\\w+)' +
        // 5: Only decimal integers are allowed
        '|(\\d+)' +
        // 6: Operators are part of a fixed set
        '|(==|<=|>=|!=|&&|\\|\\||[-+*/<>=&|&^])' +
        // 7: Barewords appear to allow literally fucking anything as long as they start with a
        // letter -- the official playcc2 contains `really?'"` as an accidental unquoted string and
        // it's accepted but ignored, so I can only assume it's treated as a variable
        // TODO i really don't like this, it's beyond error-prone
        '|([a-zA-Z]\\S*)' +
        // 8: Anything else is an error
        '|(\\S+)' +
    ')', 'g');
const DIRECTIVES = {
    // Important stuff
    'chdir': ['string'],
    'do': 'statement',  // special
    'game': ['string'],
    'goto': ['label'],
    'map': ['string'],
    'music': ['string'],
    'script': 'script',  // special
    // Weird stuff
    'edit': [],
    // Seemingly unused, or at least not understood
    'art': ['string'],
    'chain': ['string'],
    'dlc': ['string'],
    'end': [],
    'main': [],  // allegedly jumps to playcc2.c2g??
    'wav': ['string'],
};
const OPERATORS = {
    '==': {
        argc: 2,
    },
    '<=': {
    },
    '>=': {
    },
    '!=': {
    },
    '<': {
    },
    '>': {
    },
    '=': {
    },
    '*': {
    },
    '/': {
    },
    '+': {
    },
    '-': {
    },
    '&&': {
    },
    '||': {
    },
    '&': {
    },
    '|': {
    },
    '%': {
    },
    '^': {
    },
};

function* tokenize(statement) {
    for (let match of statement.matchAll(TOKENIZE_RX)) {
        if (match[1] !== undefined) {
            // Newline(s)
            yield {type: 'newline'};
        }
        else if (match[2] !== undefined) {
            // Comment, do nothing
        }
        else if (match[3] !== undefined) {
            // String
            yield {type: 'string', value: match[3]};
        }
        else if (match[4] !== undefined) {
            // Label
            yield {type: 'label', value: match[4].toLowerCase()};
        }
        else if (match[5] !== undefined) {
            // Number
            yield {type: 'number', value: parseInt(match[5], 10)};
        }
        else if (match[6] !== undefined) {
            // Operator
            yield {type: 'op', value: match[6]};
        }
        else if (match[7] !== undefined) {
            // Bareword; either a directive or a variable name
            let word = match[7].toLowerCase();
            if (DIRECTIVES[word] !== undefined) {
                yield {type: 'directive', value: word};
            }
            else {
                yield {type: 'variable', value: word};
            }
        }
        else {
            yield {type: 'error', value: match[8]};
        }
    }
}

class ParseError extends Error {
    constructor(message, parser) {
        super(`${message} at line ${parser.lineno}`);
    }
}

class Parser {
    constructor(string) {
        this.string = string;
        this.lexer = tokenize(string);
        this.lineno = 1;
        this.done = false;
        this._peek = null;
    }

    peek() {
        if (this._peek === null) {
            let next = this.lexer.next();
            if (! next.done) {
                this._peek = next.value;
                if (this._peek.type === 'error')
                    throw new ParseError(`Bad syntax: ${this._peek.value}`, this);
            }
        }

        return this._peek;
    }

    advance() {
        if (this.done)
            return null;

        let token;
        if (this._peek !== null) {
            token = this._peek;
            this._peek = null;
        }
        else {
            let next = this.lexer.next();
            if (next.done) {
                this.done = true;
                return null;
            }

            token = next.value;
            if (token.type === 'error')
                throw new ParseError(`Bad syntax: ${token.value}`, this);
        }

        if (token && token.type === 'newline') {
            this.lineno++;
        }
        return token;
    }

    advance_ignore_newlines() {
        if (this.done)
            return null;

        let token = this.advance();
        while (token && token.type === 'newline') {
            token = this.advance();
        }

        return token;
    }

    parse_statement() {
        let token = this.advance_ignore_newlines();
        if (! token)
            return null;

        // Check for a directive and handle it separately
        if (token.type === 'directive') {
            return this.parse_directive(token.value);
        }

        // A string (outside of a script block) doesn't seem to do anything?
        if (token.type === 'string') {
            return {
                kind: 'noop',
                tokens: [token],
            };
        }

        // A lone label is a label declaration
        if (token.type === 'label') {
            return {
                kind: 'label',
                name: token.value,
            };
        }

        // An operator is not a valid start; this uses RPN so values must come first
        if (token.type === 'op')
            throw new ParseError(`Unexpected operator: ${token.value}`, this);

        // Otherwise (number, bareword presumed to be a variable), we have an RPN expression; keep
        // consuming tokens until we finish the expression
        let branches = [token];
        while (true) {
            let next = this.peek();
            if (! next) {
                break;
            }
            else if (next.type === 'number' || next.type === 'variable') {
                let token = this.advance();
                branches.push(token);
            }
            else if (next.type === 'op') {
                let token = this.advance();
                if (! token || token.type === 'newline')
                    break;

                // All operators are binary, so pop the last two expressions
                if (branches.length < 2)
                    throw new ParseError(`Not enough arguments for operator: ${token.value}`, this);
                let a = branches.pop();
                let b = branches.pop();
                branches.push({
                    op: token.value,
                    left: a,
                    right: b,
                });

                // TODO return now if we just did an =?
            }
            else {
                break;
            }
        }

        return {
            kind: 'expression',
            trees: branches,
        };
    }

    parse_directive(name) {
        let argspec = DIRECTIVES[name];
        if (argspec === 'statement') {
            // TODO implement this for real
            // eat the rest of the line for now
            while (true) {
                let token = this.advance();
                if (! token || token.type === 'newline') {
                    break;
                }
            }
        }
        else if (argspec === 'script') {
            // Script mode; expect a newline, then sequences of [string, values..., newline]
            let lines = [];
            let newline = this.advance();
            if (newline && newline.type !== 'newline')
                throw new ParseError(`Expected a newline after 'script' directive`, this);
            while (true) {
                let next = this.peek();
                while (next && next.type === 'newline') {
                    this.advance();
                    next = this.peek();
                }
                if (! next)
                    break;

                // If this is a string, we're still in script mode; eat the whole line
                if (next.type === 'string') {
                    let string = this.advance();
                    let args = [];
                    // TODO can args be expressions??
                    while (true) {
                        let arg = this.advance();
                        if (! arg || arg.type === 'newline') {
                            break;
                        }
                        else if (arg.type === 'number' || arg.type === 'variable') {
                            args.push(arg);
                        }
                        else {
                            throw new ParseError(`Unexpected ${arg.type} token found in script mode: ${arg.value}`, this);
                        }
                    }
                    lines.push({
                        string: string,
                        args: args,
                    });
                }
                // If not a string, script mode is over
                else {
                    break;
                }
            }

            return {
                kind: 'script',
                lines: lines,
            };
        }
        else {
            // Normal arguments
            let args = [];
            for (let argtype of argspec) {
                let token = this.advance();
                if (! token || token.type === 'newline') {
                    // If we're cut off early, the whole directive is ignored
                    return {
                        kind: 'noop',
                        directive: name,
                        tokens: args,
                    };
                }
                else if (token.type === argtype) {
                    args.push(token);
                }
                else {
                    throw new ParseError(`Directive ${name} expected a ${argtype} token but got ${token.type}`, this);
                }
            }
            return {
                kind: 'directive',
                name: name,
                args: args,
            };
        }
    }
}

// C2G is a Chip's Challenge 2 format that describes the structure of a level set, which is helpful
// since CC2 levels are all stored in separate files
// XXX observations i have made about this hell format:
// - newlines are optional, except after: do, map, script, goto
// - `1 level = music "+Intro"` crashes the game
// - `map\n"path"` is completely ignored, and in fact newlines between a directive and its arguments
//   in general seem to separate them
const MAX_SIMULTANEOUS_REQUESTS = 5;
/*async*/ export function parse_game(buf, source, base_path) {
    // TODO maybe do something with this later
    let warn = () => {};

    let resolve;
    let promise = new Promise((res, rej) => { resolve = res });

    let game = new format_base.StoredGame(undefined, _parse_level_from_stored_meta);
    let parser;
    let active_map_fetches = new Set;
    let pending_map_fetches = [];
    let _fetch_map = (path, n) => {
        let promise = source.get(base_path + '/' + path);
        active_map_fetches.add(promise);

        let meta = {
            // TODO this will not always fly, the slot is not the same as the number
            index: n - 1,
            number: n,
        };
        game.level_metadata[meta.index] = meta;

        promise.then(buf => {
            meta.bytes = new Uint8Array(buf);
            Object.assign(meta, parse_level_metadata(buf));
        })
        .then(null, err => {
            // TODO should have: what level, what file, position, etc attached to errors
            console.error(err);
            meta.error = err;
        })
        .then(() => {
            // Always remove our promise and start a new map load if any are waiting
            active_map_fetches.delete(promise);
            if (active_map_fetches.size < MAX_SIMULTANEOUS_REQUESTS && pending_map_fetches.length > 0) {
                _fetch_map(...pending_map_fetches.shift());
            }
            else if (active_map_fetches.size === 0 && pending_map_fetches.length === 0 && parser.done) {
                // FIXME this is a bit of a mess
                resolve(game);
            }
        });
    };
    let fetch_map = (path, n) => {
        if (active_map_fetches.size >= MAX_SIMULTANEOUS_REQUESTS) {
            pending_map_fetches.push([path, n]);
            return;
        }

        _fetch_map(path, n);
    };
    
    // FIXME and right off the bat we have an Issue: this is a text format so i want a string, not
    // an arraybuffer!
    let contents = util.string_from_buffer_ascii(buf);
    parser = new Parser(contents);
    let statements = [];
    let level_number = 1;
    while (! parser.done) {
        let stmt = parser.parse_statement();
        if (stmt === null)
            break;

        // TODO search 'do' as well
        if (stmt.kind === 'directive' && stmt.name === 'map') {
            let path = stmt.args[0].value;
            path = path.replace(/\\/, '/');
            fetch_map(path, level_number);
            level_number++;
        }
        else if (stmt.kind === 'directive' && stmt.name === 'game') {
            // TODO apparently cc2 lets you change this mid-game and will then use a different save
            // slot (?!), but i can't even consider that until i actually execute these things in
            // order
            if (game.identifier === undefined) {
                let title = stmt.args[0].value;
                game.identifier = title;
                game.title = title;
            }
        }
        statements.push(stmt);
    }

    // FIXME grody
    if (active_map_fetches.size === 0 && pending_map_fetches.length === 0) {
        resolve(game);
    }

    return promise;
}

// Individual levels don't make sense on their own, but we can wrap them in a dummy one-level game
export function wrap_individual_level(buf) {
    let game = new format_base.StoredGame(undefined, _parse_level_from_stored_meta);
    let meta = {
        index: 0,
        number: 1,
        bytes: new Uint8Array(buf),
    };
    try {
        Object.assign(meta, parse_level_metadata(buf));
    }
    catch (e) {
        meta.error = e;
    }
    game.level_metadata.push(meta);
    return game;
}
