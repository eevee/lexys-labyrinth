export function string_from_buffer_ascii(buf) {
    return String.fromCharCode.apply(null, new Uint8Array(buf));
}

export class StoredCell extends Array {
}

export class StoredLevel {
    constructor() {
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

        this.player_start_x = 0;
        this.player_start_y = 0;

        // Maps of button positions to trap/cloner positions, as scalar indexes
        // in the linear cell list
        this.custom_trap_wiring = {};
        this.custom_cloner_wiring = {};
    }

    check() {
    }
}

export class StoredGame {
    constructor() {
        this.levels = [];
    }
}
