import { DIRECTIONS, LAYERS } from './defs.js';
import * as format_base from './format-base.js';
import TILE_TYPES from './tiletypes.js';
import * as util from './util.js';

const TILE_ENCODING = {
    0x00: 'floor',
    0x01: 'wall',
    0x02: 'chip',
    0x03: 'water',
    0x04: 'fire',
    0x05: 'wall_invisible',
    0x06: ['thin_walls', {edges: DIRECTIONS['north'].bit}],
    0x07: ['thin_walls', {edges: DIRECTIONS['west'].bit}],
    0x08: ['thin_walls', {edges: DIRECTIONS['south'].bit}],
    0x09: ['thin_walls', {edges: DIRECTIONS['east'].bit}],
    // This is MSCC's incomprehensible non-directional dirt block, which needs a direction for Lynx
    // purposes; Tile World defaults it to north
    0x0a: ['dirt_block', 'north'],
    0x0b: 'dirt',
    0x0c: 'ice',
    0x0d: 'force_floor_s',
    // These are the "clone blocks", which for us are just regular blocks
    0x0e: ['dirt_block', 'north'],
    0x0f: ['dirt_block', 'west'],
    0x10: ['dirt_block', 'south'],
    0x11: ['dirt_block', 'east'],
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
    0x30: ['thin_walls', {edges: DIRECTIONS['south'].bit | DIRECTIONS['east'].bit}],
    0x31: 'cloner',
    0x32: 'force_floor_all',
    0x33: 'bogus_player_drowned',
    0x34: 'bogus_player_burned_fire',
    0x35: 'bogus_player_burned',
    0x36: 'wall_invisible',  // unused
    0x37: 'wall_invisible',  // unused
    0x38: 'ice_block',       // unused, but co-opted by pgchip
    0x39: 'bogus_player_win',
    0x3a: 'bogus_player_win',
    0x3b: 'bogus_player_win',
    0x3c: ['bogus_player_swimming', 'north'],
    0x3d: ['bogus_player_swimming', 'west'],
    0x3e: ['bogus_player_swimming', 'south'],
    0x3f: ['bogus_player_swimming', 'east'],
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

const REVERSE_TILE_ENCODING = {};
for (let [tile_byte, spec] of Object.entries(TILE_ENCODING)) {
    tile_byte = parseInt(tile_byte, 10);  // these are keys so they get stringified ugh
    if (0x36 <= tile_byte && tile_byte <= 0x37) {
        // These are unused tiles which get turned into invisible walls; don't encode invisible
        // walls as them!  (0x38 is also "unused", but pgchip turns it into ice block.)
        continue;
    }

    let name, arg;
    if (spec instanceof Array) {
        [name, arg] = spec;
    }
    else {
        name = spec;
        arg = null;
    }

    let rev_spec = REVERSE_TILE_ENCODING[name];
    if (! rev_spec) {
        rev_spec = {};
        REVERSE_TILE_ENCODING[name] = rev_spec;
    }

    if (arg === null || tile_byte === 0x0a) {
        // Special case: 0x0a is MSCC's undirected dirt block, which needs to coexist with the
        // directed "clone" blocks
        rev_spec['all'] = tile_byte;
    }
    else if (typeof arg === 'string') {
        // This is a direction
        rev_spec[arg] = tile_byte;
    }
    else {
        // This is the thin_walls argument structure
        rev_spec[arg.edges] = tile_byte;
    }
}

function decode_password(bytes, start, len) {
    let password = [];
    for (let i = 0; i < len; i++) {
        password.push(bytes[start + i] ^ 0x99);
    }
    return String.fromCharCode.apply(null, password);
}

export function parse_level_metadata(bytes) {
    let meta = {};

    let view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    // Level number; rest of level header is unused
    meta.number = view.getUint16(0, true);

    // Map layout
    // Same structure twice, for the two layers
    let p = 8;
    for (let l = 0; l < 2; l++) {
        let layer_length = view.getUint16(p, true);
        p += 2 + layer_length;
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
        if (field_type === 0x03) {
            // Title, including trailing NUL
            meta.title = util.string_from_buffer_ascii(bytes, p, field_length - 1);
        }
        else if (field_type === 0x06) {
            // Password, with trailing NUL, and XORed with 0x99 (???)
            meta.password = decode_password(bytes, p, field_length - 1);
        }
        p += field_length;
    }

    return meta;
}

function parse_level(bytes, number) {
    let level = new format_base.StoredLevel(number);
    level.only_custom_connections = true;
    level.format = 'ccl';
    level.uses_ll_extensions = false;
    level.chips_required = 0;
    // Map size is always fixed as 32x32 in CC1
    level.size_x = 32;
    level.size_y = 32;
    for (let i = 0; i < 1024; i++) {
        level.linear_cells.push(new format_base.StoredCell);
    }
    level.use_cc1_boots = true;

    let view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    // Header
    let level_number = view.getUint16(0, true);
    level.time_limit = view.getUint16(2, true);
    level.chips_required = view.getUint16(4, true);

    // Map layout
    let unknown = view.getUint16(6, true);
    // Same structure twice, for the two layers
    let p = 8;
    let hint_tiles = [];
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

            let spec = TILE_ENCODING[tile_byte];
            // TODO could be more forgiving for goofy levels doing goofy things
            if (! spec) {
                let [x, y] = level.scalar_to_coords(c);
                throw new Error(`Invalid tile byte 0x${tile_byte.toString(16)} at (${x}, ${y})`);
            }

            let name, extra;
            if (spec instanceof Array) {
                [name, extra] = spec;
                if (typeof extra === 'string') {
                    extra = {direction: extra};
                }
            }
            else {
                name = spec;
                extra = {};
            }
            let tile = {type: TILE_TYPES[name], ...extra};

            for (let i = 0; i < count; i++) {
                if (c >= 1024)
                    throw new Error("Too many cells found");

                let cell = level.linear_cells[c];
                c++;

                // "Floor" and "empty" are interchangeable, which can lead to extra floor under
                // other terrain and other nonsense, so ignore floor entirely and fix it below
                // TODO one particular mscc weirdness is that you can have floor on top of
                // something, i think?  it seems like the two layers are functionally a stack, with
                // implied floor below everything
                if (name === 'floor') {
                    continue;
                }

                // pgchip grants directions to ice blocks on cloners by putting a clone block
                // beneath them instead
                if (l === 1 && 0x0e <= tile_byte && tile_byte <= 0x11 &&
                    cell[LAYERS.actor] && cell[LAYERS.actor].type.name === 'ice_block')
                {
                    cell[LAYERS.actor].direction = extra.direction;
                    let type = TILE_TYPES['cloner'];
                    cell[type.layer] = {type};
                    continue;
                }

                let new_tile = {...tile};
                cell[tile.type.layer] = new_tile;
                if (new_tile.type.name === 'hint') {
                    hint_tiles.push(new_tile);
                }
            }
        }
        if (c !== 1024)
            throw new Error(`Expected 1024 cells (32x32 map); found ${c}`);
    }

    // Fix the "floor/empty" nonsense here by adding floor to any cell with no terrain on bottom
    for (let cell of level.linear_cells) {
        if (! cell[LAYERS.terrain]) {
            cell[LAYERS.terrain] = { type: TILE_TYPES['floor'] };
        }
        // TODO we could also deal with weird cases where there's terrain /on top of/ something
        // else: things underwater, the quirk where a glider will erase the item underneath...
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
            level.title = util.string_from_buffer_ascii(bytes, p, field_length - 1);
        }
        else if (field_type === 0x04) {
            // Trap linkages (MSCC only, not in Lynx or CC2)
            let field_view = new DataView(bytes.buffer, bytes.byteOffset + p, field_length);
            let q = 0;
            while (q < field_length) {
                let button_x = field_view.getUint16(q + 0, true);
                let button_y = field_view.getUint16(q + 2, true);
                let trap_x = field_view.getUint16(q + 4, true);
                let trap_y = field_view.getUint16(q + 6, true);
                // Fifth u16 is always zero, possibly live game state
                q += 10;
                // Connections are ignored if they're on the wrong tiles anyway, and we use a single
                // mapping that's a bit more flexible, so only store valid connections
                let s = level.coords_to_scalar(button_x, button_y);
                let d = level.coords_to_scalar(trap_x, trap_y);
                if (level.linear_cells[s][LAYERS.terrain].type.name === 'button_brown') {
                    level.custom_connections.set(s, d);
                }
            }
        }
        else if (field_type === 0x05) {
            // Cloner linkages (MSCC only, not in Lynx or CC2)
            let field_view = new DataView(bytes.buffer, bytes.byteOffset + p, field_length);
            let q = 0;
            while (q < field_length) {
                let button_x = field_view.getUint16(q + 0, true);
                let button_y = field_view.getUint16(q + 2, true);
                let cloner_x = field_view.getUint16(q + 4, true);
                let cloner_y = field_view.getUint16(q + 6, true);
                q += 8;
                // Connections are ignored if they're on the wrong tiles anyway, and we use a single
                // mapping that's a bit more flexible, so only store valid connections
                let s = level.coords_to_scalar(button_x, button_y);
                let d = level.coords_to_scalar(cloner_x, cloner_y);
                if (level.linear_cells[s][LAYERS.terrain].type.name === 'button_red') {
                    level.custom_connections.set(s, d);
                }
            }
        }
        else if (field_type === 0x06) {
            // Password, with trailing NUL, and otherwise XORed with 0x99 (???)
            level.password = decode_password(bytes, p, field_length - 1);
        }
        else if (field_type === 0x07) {
            // Hint, including trailing NUL, of course
            let hint = util.string_from_buffer_ascii(bytes, p, field_length - 1);
            for (let tile of hint_tiles) {
                tile.hint_text = hint;
            }
        }
        else if (field_type === 0x08) {
            // Password, but not encoded
            // TODO ???
        }
        else if (field_type === 0x09) {
            // EXTENSION: Author, including trailing NUL
            level.author = util.string_from_buffer_ascii(bytes, p, field_length - 1);
        }
        else if (field_type === 0x0a) {
            // Initial actor order
            // TODO ??? should i...  trust this...
        }
        p += field_length;
    }

    return level;
}

// This thin wrapper is passed to StoredGame as the parser function
function _parse_level_from_stored_meta(meta) {
    return parse_level(meta.bytes, meta.number);
}

export function parse_game(buf) {
    let game = new format_base.StoredGame(null, _parse_level_from_stored_meta);

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
    else if (magic === 0x0003aaac) {
        // OK
        // TODO add in ice block i guess???
    }
    else {
        throw new Error(`Unrecognized magic number ${magic.toString(16)}`);
    }

    let level_count = full_view.getUint16(4, true);

    // And now, the levels
    let p = 6;
    for (let l = 1; l <= level_count; l++) {
        let length = full_view.getUint16(p, true);
        let bytes = new Uint8Array(buf, p + 2, length);
        p += 2 + length;

        let meta;
        try {
            meta = parse_level_metadata(bytes);
        }
        catch (e) {
            meta = {error: e};
        }
        meta.index = l - 1;
        meta.bytes = bytes;
        game.level_metadata.push(meta);
    }

    return game;
}

export class CCLEncodingErrors extends util.LLError {
    constructor(errors) {
        super("Failed to encode level as CCL");
        this.errors = errors;
    }
}

export function synthesize_level(stored_level) {
    let errors = [];
    if (stored_level.size_x !== 32) {
        errors.push(`Level width must be 32, not ${stored_level.size_x}`);
    }
    if (stored_level.size_y !== 32) {
        errors.push(`Level width must be 32, not ${stored_level.size_y}`);
    }

    // TODO might also want the tile world "lynx mode" magic number, or pgchip's ice block rules
    let magic = 0x0002aaac;
    let top_layer = [];
    let bottom_layer = [];
    let hint_text = null;
    let trap_cxns = [];
    let cloner_cxns = [];
    let monster_coords = [];
    let error_found_wires = false;
    // TODO i could be a little kinder and support, say, items on terrain; do those work in mscc?  tw lynx?
    for (let [i, cell] of stored_level.linear_cells.entries()) {
        let [x, y] = stored_level.scalar_to_coords(i);
        let actor = null;
        let other = null;
        for (let tile of cell) {
            if (! tile)
                continue;
            if (tile.wire_directions || tile.wire_tunnel_directions) {
                error_found_wires = true;
            }

            if (tile.type.layer === LAYERS.actor) {
                actor = tile;
            }
            else if (tile.type.name === 'floor') {
                // This is the default anyway, so don't count it against the number of tiles
                continue;
            }
            else if (other) {
                errors.push(`A cell can only contain one static tile, but cell (${x}, ${y}) has both ${other.type.name} and ${tile.type.name}`);
            }
            else {
                other = tile;
            }

            if (tile.type.is_monster) {
                monster_coords.push(x, y);
            }
        }

        let actor_byte = null;
        let other_byte = null;
        if (actor) {
            let rev_spec = REVERSE_TILE_ENCODING[actor.type.name];
            if (rev_spec) {
                // Special case: dirt blocks only have a direction when on a cloner
                if (actor.type.name === 'dirt_block' && ! (other && other.type.name === 'cloner')) {
                    actor_byte = rev_spec['all'];
                }
                else {
                    actor_byte = rev_spec[actor.direction];
                }
            }
            else {
                errors.push(`Can't encode tile: ${actor.type.name}`);
            }
        }
        if (other) {
            let rev_spec = REVERSE_TILE_ENCODING[other.type.name];
            if (rev_spec) {
                // Special case: thin walls only come in one of a few configurations
                if (other.type.name === 'thin_walls') {
                    if (other.edges in rev_spec) {
                        other_byte = rev_spec[other.edges];
                    }
                    else {
                        errors.push(`Thin walls may only have one edge, or be a lower-right corner`);
                    }
                }
                else {
                    other_byte = rev_spec['all'];
                }

                if (other.type.name === 'hint') {
                    if (hint_text === null) {
                        hint_text = other.hint_text;
                    }
                    else if (hint_text !== other.hint_text) {
                        errors.push(`All hints must contain the same text`);
                    }
                }

                let cxn_target;
                // FIXME one begins to wonder if the lady doth repeat herself
                if (other.type.name === 'button_red') {
                    cxn_target = 'cloner';
                }
                else if (other.type.name === 'button_brown') {
                    cxn_target = 'trap';
                }
                if (cxn_target && stored_level.custom_connections.has(i)) {
                    let dest = stored_level.custom_connections.get(i);
                    let dest_cell = stored_level.linear_cells[dest];
                    // FIXME these need to be sorted by destination actually
                    if (dest_cell && dest_cell[LAYERS.terrain].type.name === cxn_target) {
                        if (other.type.name === 'button_red') {
                            cloner_cxns.push(x, y, ...stored_level.scalar_to_coords(dest));
                        }
                        else {
                            // Traps have an extra zero!
                            trap_cxns.push(x, y, ...stored_level.scalar_to_coords(dest), 0);
                        }
                    }
                }
            }
            else {
                errors.push(`Can't encode tile: ${other.type.name}`);
            }
        }

        if (other_byte === null) {
            other_byte = 0x00;  // floor
        }

        if (actor_byte === null) {
            top_layer.push(other_byte);
            bottom_layer.push(0x00);
        }
        else {
            top_layer.push(actor_byte);
            bottom_layer.push(other_byte);
        }
    }
    if (error_found_wires) {
        errors.push(`Wires are not supported`);
    }

    // TODO RLE
    let top_layer_bytes = top_layer;
    let bottom_layer_bytes = bottom_layer;

    // Assemble metadata fields.  You'd think this would deserve a little wrapper like I have for
    // the C2M sections, but you're wrong!
    let metadata_blocks = [];
    let metadata_length = 0;
    function add_block(type, contents) {
        let len = 2 + contents.byteLength;
        let bytes = new Uint8Array(len);
        // TODO this copy is annoying
        bytes[0] = type;
        bytes[1] = contents.byteLength;
        bytes.set(new Uint8Array(contents), 2);
        metadata_blocks.push(bytes);
        metadata_length += len;
    }

    // Level name
    // TODO do something with not-ascii; does TW support utf8 or latin1 or anything?
    add_block(3, util.bytestring_to_buffer(stored_level.title.substring(0, 63) + "\0"));
    // Trap and cloner connections
    function encode_connections(cxns) {
        let words = new ArrayBuffer(cxns.length * 2);
        let view = new DataView(words);
        for (let [i, val] of cxns.entries()) {
            view.setUint16(i * 2, val, true);
        }
        return words;
    }
    if (trap_cxns.length > 0) {
        add_block(4, encode_connections(trap_cxns));
    }
    if (cloner_cxns.length > 0) {
        add_block(5, encode_connections(cloner_cxns));
    }
    // Password
    // TODO support this for real lol
    add_block(6, util.bytestring_to_buffer("XXXX\0"));
    // Hint
    // TODO tile world seems to do latin-1 (just sort of, inherently); this will do modulo on
    // anything outside it (yyyyikes!), probably should sub with ? or something
    if (hint_text !== null) {
        add_block(7, util.bytestring_to_buffer(hint_text.substring(0, 127) + "\0"));
    }
    // EXTENSION: Author's name, if present
    if (stored_level.author) {
        add_block(9, util.bytestring_to_buffer(stored_level.author.substring(0, 255) + "\0"));
    }
    // Monster positions (dumb as hell and only used in MS mode)
    if (monster_coords.length > 0) {
        if (monster_coords.length > 256) {
            errors.push(`Level has ${monster_coords.length >> 1} monsters, but MS only supports up to 128`);
            monster_coords.length = 256;
        }
        add_block(10, new Uint8Array(monster_coords).buffer);
    }

    if (errors.length > 0) {
        throw new CCLEncodingErrors(errors);
    }

    // OK, almost done, serialize for real
    let level_length = (
        10 +        // level header
        2 + top_layer_bytes.length +
        2 + bottom_layer_bytes.length +
        2 + metadata_length
    );
    let total_length = (
        6 +             // game header
        level_length
    );
    let ret = new ArrayBuffer(total_length);
    let array = new Uint8Array(ret);
    let view = new DataView(ret);
    view.setUint32(0, magic, true);
    view.setUint16(4, 1, true);  // level count, teehee

    let p = 6;
    view.setUint16(p, level_length - 2, true);  // doesn't include this field
    view.setUint16(p + 2, 1, true);  // level number
    view.setUint16(p + 4, stored_level.time_limit, true);
    view.setUint16(p + 6, stored_level.chips_required || 0, true);  // FIXME
    view.setUint16(p + 8, 1, true);  // always 1?  indicates compressed map data?
    p += 10;

    // Map data
    view.setUint16(p, top_layer_bytes.length, true);
    array.set(new Uint8Array(top_layer_bytes), p + 2);
    p += 2 + top_layer_bytes.length;
    view.setUint16(p, bottom_layer_bytes.length, true);
    array.set(new Uint8Array(bottom_layer_bytes), p + 2);
    p += 2 + bottom_layer_bytes.length;

    // Metadata
    view.setUint16(p, metadata_length, true);
    p += 2;
    for (let block of metadata_blocks) {
        array.set(block, p);
        p += block.byteLength;
    }

    if (p !== total_length) {
        console.error("Something has gone very awry:", total_length, p);
    }

    return ret;
}
