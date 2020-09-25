export function string_from_buffer_ascii(buf) {
    return String.fromCharCode.apply(null, new Uint8Array(buf));
}

export class StoredCell extends Array {
}

export class StoredLevel {
    constructor(number) {
        this.number = number;  // one-based
        this.title = '';
        this.password = null;
        this.hint = '';
        this.chips_required = 0;
        this.time_limit = 0;
        this.viewport_size = 9;
        this.extra_chunks = [];
        this.use_cc1_boots = false;

        this.size_x = 0;
        this.size_y = 0;
        this.linear_cells = [];

        // Maps of button positions to trap/cloner positions, as scalar indexes
        // in the linear cell list
        this.custom_trap_wiring = {};
        this.custom_cloner_wiring = {};
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
    constructor(identifier) {
        this.identifier = identifier;
        this.levels = [];
    }
}
