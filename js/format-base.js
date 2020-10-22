import * as util from './util.js';

export class StoredCell extends Array {
}

export class StoredLevel {
    constructor(number) {
        // TODO still not sure this belongs here
        this.number = number;  // one-based
        this.title = '';
        this.password = null;
        this.hint = '';
        this.chips_required = 0;
        this.time_limit = 0;
        this.viewport_size = 9;
        this.extra_chunks = [];
        this.use_cc1_boots = false;
        this.use_ccl_compat = false;

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

    scalar_to_coords(n) {
        return [n % this.size_x, Math.floor(n / this.size_x)];
    }

    coords_to_scalar(x, y) {
        return x + y * this.size_x;
    }

    check() {
    }
}

export class StoredGame {
    constructor(identifier, level_loader) {
        this.identifier = identifier;
        this._level_loader = level_loader;

        // Simple objects containing keys:
        // title: level title
        // index: level index, used internally only
        // number: level number (may not match index due to C2G shenanigans)
        // error: any error received while loading the level
        // bytes: Uint8Array of the encoded level data
        this.level_metadata = [];
    }

    // TODO this may or may not work sensibly when correctly following a c2g
    load_level(index) {
        let meta = this.level_metadata[index];
        if (! meta)
            throw new util.LLError(`No such level number ${index}`);
        if (meta.error)
            throw meta.error;

        // The editor stores inflated levels at times, so respect that
        if (meta.stored_level)
            return meta.stored_level;

        // Otherwise, attempt to load the level
        return this._level_loader(meta.bytes);
    }
}
