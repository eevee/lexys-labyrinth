import { DIRECTIONS, INPUT_BITS } from './defs.js';
import * as format_base from './format-base.js';


const TW_DIRECTION_TO_INPUT_BITS = [
    INPUT_BITS.up,
    INPUT_BITS.left,
    INPUT_BITS.down,
    INPUT_BITS.right,
    INPUT_BITS.up | INPUT_BITS.left,
    INPUT_BITS.down | INPUT_BITS.left,
    INPUT_BITS.up | INPUT_BITS.right,
    INPUT_BITS.down | INPUT_BITS.right,
];

// doc: http://www.muppetlabs.com/~breadbox/software/tworld/tworldff.html#3
export function parse_solutions(bytes) {
    let buf;
    if (bytes.buffer) {
        buf = bytes.buffer;
    }
    else {
        buf = bytes;
        bytes = new Uint8Array(buf);
    }
    let view = new DataView(buf);
    let magic = view.getUint32(0, true);
    if (magic !== 0x999b3335)
        return;

    // 1 for lynx, 2 for ms; also extended to 3 for cc2, 4 for ll
    let ruleset = bytes[4];
    let extra_bytes = bytes[7];

    let ret = {
        ruleset: ruleset,
        levels: [],
    };

    let p = 8 + extra_bytes;
    let is_first = true;
    while (p < buf.byteLength) {
        let len = view.getUint32(p, true);
        p += 4;
        if (len === 0xffffffff)
            break;

        if (len === 0) {
            // Empty, do nothing
        }
        else if (len < 6) {
            // This should never happen
            // TODO gripe?
        }
        else if (bytes[p] === 0 && bytes[p + 1] === 0 && bytes[p + 2] === 0 &&
            bytes[p + 3] === 0 && bytes[p + 5] === 0 && bytes[p + 6] === 0)
        {
            // This record is special and contains the name of the set; it's optional but, if present, must be first
            if (! is_first) {
                // TODO gripe?
            }
        }
        else if (len === 6) {
            // Short record; password only, no replay
        }
        else {
            // Long record
            let number = view.getUint16(p, true);
            // 2-5: password, don't care
            // 6: flags, always zero
            let initial_state = bytes[p + 7];
            let step_parity = initial_state >> 3;
            let initial_rff = ['north', 'west', 'south', 'east'][initial_state & 0x7];
            // In CC2 replays, the initial RFF direction is the one you'll actually start with;
            // however, in Lynx, the direction is rotated BEFORE it takes effect, so to compensate
            // we have to rotate this once ahead of time
            initial_rff = DIRECTIONS[initial_rff].right;
            let initial_rng = view.getUint32(p + 8, true);
            let total_duration = view.getUint32(p + 12, true);

            // TODO split this off though
            let inputs = [];
            let q = p + 16;
            let add_move = (input, duration) => {
                // duration is how long it's been since the *previous* input, so pad first
                for (let t = 0; t < duration; t++) {
                    inputs.push(0);
                }
                inputs.push(input);
            };
            while (q < p + len) {
                // There are four formats for packing solutions, identified by the lowest two bits,
                // except that format 3 is actually two formats.  Be aware that the documentation
                // refers to them in a different order than suggested by the identifying nybble.
                let fmt = bytes[q] & 0x3;
                let fmt2 = (bytes[q] >> 4) & 0x1;
                if (fmt === 0) {
                    // "Third format": three consecutive moves packed into one byte
                    let val = bytes[q];
                    q += 1;
                    let input1 = TW_DIRECTION_TO_INPUT_BITS[(val >> 2) & 0x3];
                    let input2 = TW_DIRECTION_TO_INPUT_BITS[(val >> 4) & 0x3];
                    let input3 = TW_DIRECTION_TO_INPUT_BITS[(val >> 6) & 0x3];
                    add_move(input1, 3);  // actually 4 but duration is one less than
                    add_move(input2, 3);
                    add_move(input3, 3);
                }
                else if (fmt === 1 || fmt === 2 || (fmt === 3 && fmt2 === 0)) {
                    // "First format" and "second format": one, two, or four bytes containing a
                    // direction and a number of tics
                    let val;
                    if (fmt === 1) {
                        val = bytes[q];
                        q += 1;
                    }
                    else if (fmt === 2) {
                        val = view.getUint16(q, true);
                        q += 2;
                    }
                    else {
                        val = view.getUint32(q, true);
                        q += 4;
                    }
                    let input = TW_DIRECTION_TO_INPUT_BITS[(val >> 2) & 0x7];
                    // This is supposed to only be 23 bits, but some tools (e.g. SuCC) use the spare
                    // bits for other stuff, so mask them off
                    let duration = (val >> 5) & 0x7fffff;
                    add_move(input, duration);
                }
                else {  // low nybble is 3, and bit 4 is set
                    // "Fourth format": 2 to 5 bytes, containing an exceptionally long direction
                    // field and time field, mostly used for MSCC mouse moves
                    let n = ((bytes[q] >> 2) & 0x3) + 2;
                    if (q + n - 1 >= bytes.length)
                        throw new Error(`Malformed TWS file: expected ${n} bytes starting at ${q}, but only found ${bytes.length - q}`);

                    // Up to 5 bytes is an annoying amount, but we can cut it down to 1-4 by
                    // extracting the direction first
                    let duration = bytes[q + 1] >> 6;
                    for (let i = 3; i <= n; i++) {
                        duration |= bytes[q + i - 1] << (2 + (i - 3) * 8);
                    }

                    // Mouse moves are encoded as 16 + ((y + 9) * 19) + (x + 9), but I extremely do
                    // not support them at the moment (and may never).  The low four bits are an
                    // undocumented bitfield of directions
                    let tw_input = (bytes[q] >> 5) | ((bytes[q + 1] & 0x3f) << 3);
                    let input = 0;
                    if (tw_input & 1) {
                        input |= INPUT_BITS.up;
                    }
                    if (tw_input & 2) {
                        input |= INPUT_BITS.left;
                    }
                    if (tw_input & 4) {
                        input |= INPUT_BITS.down;
                    }
                    if (tw_input & 8) {
                        input |= INPUT_BITS.right;
                    }

                    add_move(input, duration);

                    q += n;
                }
            }

            ret.levels[number - 1] = new format_base.Replay(initial_rff, 0, inputs, step_parity, initial_rng);
        }

        is_first = false;
        p += len;
    }
    return ret;
}
