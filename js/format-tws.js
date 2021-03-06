import { INPUT_BITS } from './defs.js';
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
            // Password is 2–5 but we don't care
            let flags = bytes[p + 6];
            let initial_state = bytes[p + 7];
            let step_parity = initial_state >> 3;
            let initial_rff = ['north', 'west', 'south', 'east'][initial_state & 0x7];
            let initial_rng = view.getUint32(p + 8, true);  // FIXME how is this four bytes??  lynx rng doesn't even have four bytes of STATE
            let total_duration = view.getUint32(p + 12, true);

            // TODO split this off though
            let inputs = [];
            let q = p + 16;
            while (q < p + len) {
                // There are four formats for packing solutions, identified by the lowest two bits,
                // except that format 3 is actually two formats, don't ask
                let fmt = bytes[q] & 0x3;
                let fmt2 = (bytes[q] >> 4) & 0x1;
                if (fmt === 0) {
                    let val = bytes[q];
                    q += 1;
                    let input1 = TW_DIRECTION_TO_INPUT_BITS[(val >> 2) & 0x3];
                    let input2 = TW_DIRECTION_TO_INPUT_BITS[(val >> 4) & 0x3];
                    let input3 = TW_DIRECTION_TO_INPUT_BITS[(val >> 6) & 0x3];
                    inputs.push(
                        0, 0, 0, input1,
                        0, 0, 0, input2,
                        0, 0, 0, input3,
                    );
                }
                else if (fmt === 1 || fmt === 2 || (fmt === 3 && fmt2 === 0)) {
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
                    let duration = val >> 5;
                    for (let i = 0; i < duration; i++) {
                        inputs.push(0);
                    }
                    inputs.push(input);
                }
                else {  // 3-1
                    // variable-size and only needed for ms so let's just hope not
                    throw new Error;
                }
            }

            ret.levels[number - 1] = new format_base.Replay(initial_rff, 0, inputs, step_parity, initial_rng);
        }

        is_first = false;
        p += len;
    }
    return ret;
}
