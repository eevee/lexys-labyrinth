import { LAYERS } from './defs.js';
import * as util from './util.js';

export class StoredCell extends Array {
    constructor() {
        super(LAYERS.MAX);
    }
}

export class Replay {
    constructor(initial_force_floor_direction, blob_seed, inputs = null, step_parity = null, tw_seed = 0) {
        this.initial_force_floor_direction = initial_force_floor_direction;
        this.blob_seed = blob_seed;
        this.step_parity = step_parity;
        this.tw_seed = tw_seed;
        this.inputs = inputs ?? new Uint8Array;
        this.duration = this.inputs.length;
        this.cursor = 0;
    }

    configure_level(level) {
        level.force_floor_direction = this.initial_force_floor_direction;
        level._blob_modifier = this.blob_seed;
        level._tw_rng = this.tw_seed;
        if (this.step_parity !== null) {
            level.step_parity = this.step_parity;
        }
    }

    get(t) {
        if (this.duration <= 0) {
            return 0;
        }
        else if (t < this.duration) {
            return this.inputs[t];
        }
        else {
            // Last input is implicitly repeated indefinitely
            return this.inputs[this.duration - 1];
        }
    }

    set(t, input) {
        if (t >= this.inputs.length) {
            let new_inputs = new Uint8Array(this.inputs.length + 1024);
            for (let i = 0; i < this.inputs.length; i++) {
                new_inputs[i] = this.inputs[i];
            }
            this.inputs = new_inputs;
        }
        this.inputs[t] = input;
        if (t >= this.duration) {
            this.duration = t + 1;
        }
    }

    clone() {
        let new_inputs = new Uint8Array(this.duration);
        for (let i = 0; i < this.duration; i++) {
            new_inputs[i] = this.inputs[i];
        }
        return new this.constructor(this.initial_force_floor_direction, this.blob_seed, new_inputs);
    }
}

// Small shared helper methods for navigating a StoredLevel or Level
export class LevelInterface {
    // Expected attributes:
    // .size_x
    // .size_y
    // .linear_cells
    scalar_to_coords(n) {
        return [n % this.size_x, Math.floor(n / this.size_x)];
    }

    coords_to_scalar(x, y) {
        return x + y * this.size_x;
    }

    is_point_within_bounds(x, y) {
        return (x >= 0 && x < this.size_x && y >= 0 && y < this.size_y);
    }

    cell(x, y) {
        if (this.is_point_within_bounds(x, y)) {
            return this.linear_cells[this.coords_to_scalar(x, y)];
        }
        else {
            return null;
        }
    }
}

export class StoredLevel extends LevelInterface {
    constructor(number) {
        super();
        // TODO still not sure this belongs here
        this.number = number;  // one-based
        this.title = '';
        this.author = '';
        this.password = null;
        this.comment = '';
        this.hint = '';  // XXX does this actually belong here, since hints contain the text?  does anything set it?
        // A number is a specified count; the default of null means that the chips are counted on
        // level init, as in CC2
        this.chips_required = null;
        this.time_limit = 0;
        this.viewport_size = 9;
        this.extra_chunks = [];
        this.use_cc1_boots = false;
        // What we were parsed from: 'ccl', 'c2m', or null
        this.format = null;
        // Whether we use LL features that don't exist in CC2; null means we don't know
        this.uses_ll_extensions = null;
        // 0 - deterministic (PRNG + simple convolution)
        // 1 - 4 patterns (default; PRNG + rotating through 0-3)
        // 2 - extra random (like deterministic, but initial seed is "actually" random)
        this.blob_behavior = 1;
        this.hide_logic = false;

        // Lazy-loading that allows for checking existence (see methods below)
        // TODO this needs a better interface, these get accessed too much atm
        this._replay = null;
        this._replay_data = null;
        this._replay_decoder = null;

        this.size_x = 0;
        this.size_y = 0;
        this.linear_cells = [];

        // Maps of button positions to trap/cloner positions, as scalar indexes
        // in the linear cell list
        // TODO merge these imo
        this.has_custom_connections = false;
        this.custom_trap_wiring = {};
        this.custom_cloner_wiring = {};

        // New LL feature: custom camera regions, as lists of {x, y, width, height}
        this.camera_regions = [];
    }

    check() {
    }

    get has_replay() {
        return this._replay || (this._replay_data && this._replay_decoder);
    }

    get replay() {
        if (! this._replay) {
            this._replay = this._replay_decoder(this._replay_data);
        }
        return this._replay;
    }
}

export class StoredPack {
    constructor(identifier, level_loader) {
        this.identifier = identifier;
        this.title = "";
        this._level_loader = level_loader;

        // Simple objects containing keys that are usually:
        // title: level title
        // index: level index, used internally only
        // number: level number (may not match index due to C2G shenanigans)
        // error: any error received while loading the level
        // bytes: Uint8Array of the encoded level data
        this.level_metadata = [];

        // Sparse/optional array of Replays, generally from an ancillary file like a TWS
        // TODO unclear if this is a good API for this
        this.level_replays = [];
    }

    // TODO this may or may not work sensibly when correctly following a c2g
    load_level(index) {
        let meta = this.level_metadata[index];
        if (! meta)
            throw new util.LLError(`No such level number ${index}`);
        if (meta.error)
            throw meta.error;

        if (meta.stored_level) {
            // The editor stores inflated levels at times, so respect that
            return meta.stored_level;
        }

        // Otherwise, attempt to load the level
        let stored_level = this._level_loader(meta);
        if (! stored_level.has_replay && this.level_replays[index]) {
            stored_level._replay = this.level_replays[index];
        }
        return stored_level;
    }
}

export const StoredGame = StoredPack;
