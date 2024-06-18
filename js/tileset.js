import { DIRECTIONS } from './defs.js';
import TILE_TYPES from './tiletypes.js';

const _omit_custom_lexy_vfx = {
    teleport_flash: null,
    transmogrify_flash: null,
    puff: null,
    fall: null,
};

export const CC2_TILESET_LAYOUT = {
    '#ident': 'cc2',
    '#name': "Chip's Challenge 2",
    '#dimensions': [16, 32],
    '#transparent-color': [0, 0],
    '#supported-versions': new Set(['cc1', 'cc2']),
    '#wire-width': 1/16,
    '#editor-arrows': {
        north: [14, 31],
        east: [14.5, 31],
        south: [15, 31],
        west: [15.5, 31],
    },

    door_red: [0, 1],
    door_blue: [1, 1],
    door_yellow: [2, 1],
    door_green: [3, 1],
    key_red: [4, 1],
    key_blue: [5, 1],
    key_yellow: [6, 1],
    key_green: [7, 1],
    dirt_block: {
        __special__: 'perception',
        modes: new Set(['editor', 'xray']),
        hidden: [8, 1],
        revealed: [9, 1],
    },
    ice: [10, 1],
    ice_se: [11, 1],
    ice_sw: [12, 1],
    ice_ne: [13, 1],
    ice_nw: [14, 1],
    cloner: [15, 1],

    floor: {
        // Wiring!
        __special__: 'wires',
        base: [0, 2],
        wired: [8, 26],
        wired_cross: [10, 26],
        is_wired_optional: true,
    },
    wall_invisible: {
        __special__: 'perception',
        modes: new Set(['palette', 'editor', 'xray']),
        hidden: [0, 2],
        revealed: [9, 31],
    },
    wall_invisible_revealed: {
        // This is specifically /invisible/ when you have the xray glasses
        __special__: 'perception',
        modes: new Set(['xray']),
        hidden: [1, 2],
        revealed: null,
    },
    wall_appearing: {
        __special__: 'perception',
        modes: new Set(['palette', 'editor', 'xray']),
        hidden: [0, 2],
        revealed: [11, 31],
    },
    wall: [1, 2],
    floor_letter: {
        __special__: 'letter',
        base: [2, 2],
        letter_glyphs: {
            // Arrows
            "⬆": [14, 31],
            "➡": [14.5, 31],
            "⬇": [15, 31],
            "⬅": [15.5, 31],
        },
        letter_ranges: [{
            // ASCII text (only up through uppercase)
            range: [32, 96],
            x0: 0,
            y0: 0,
            w: 0.5,
            h: 0.5,
            columns: 32,
        }],
    },
    thief_tools: [3, 2],
    socket: [4, 2],
    hint: [5, 2],
    exit: {
        __special__: 'animated',
        duration: 16,
        all: [[6, 2], [7, 2], [8, 2], [9, 2]],
    },
    ice_block: {
        __special__: 'perception',
        modes: new Set(['editor', 'xray']),
        hidden: [10, 2],
        revealed: [11, 2],
    },
    score_1000: [12, 2],
    score_100: [13, 2],
    score_10: [14, 2],
    score_2x: [15, 2],

    // LCD digit font
    green_chip: [9, 3],
    chip_extra: {
        __special__: 'perception',
        modes: new Set(['palette', 'editor']),
        hidden: [11, 3],
        revealed: [10, 3],
    },
    chip: [11, 3],
    bribe: [12, 3],
    speed_boots: [13, 3],
    canopy: {
        __special__: 'perception',
        modes: new Set(['editor', 'xray']),
        hidden: [14, 3],
        revealed: [15, 3],
    },

    dynamite: [0, 4],
    dynamite_lit: {
        __special__: 'visual-state',
        0: [0, 4],
        1: [1, 4],
        2: [2, 4],
        3: [3, 4],
        4: [4, 4],
    },
    bomb: {
        __special__: 'bomb-fuse',
        bomb: [5, 4],
        fuse: [7, 4],
    },
    dormant_bomb: [5, 4],  // compat tile, so needs a fallback
    green_bomb: {
        __special__: 'bomb-fuse',
        bomb: [6, 4],
        fuse: [7, 4],
    },
    floor_custom_green: [8, 4],
    floor_custom_pink: [9, 4],
    floor_custom_yellow: [10, 4],
    floor_custom_blue: [11, 4],
    wall_custom_green: [12, 4],
    wall_custom_pink: [13, 4],
    wall_custom_yellow: [14, 4],
    wall_custom_blue: [15, 4],

    explosion: [[0, 5], [1, 5], [2, 5], [3, 5]],
    explosion_nb: [[0, 5], [1, 5], [2, 5], [3, 5]],
    splash_slime: [[0, 5], [1, 5], [2, 5], [3, 5]],
    splash: [[4, 5], [5, 5], [6, 5], [7, 5]],
    splash_nb: [[4, 5], [5, 5], [6, 5], [7, 5]],
    flame_jet_off: [8, 5],
    flame_jet_on: {
        __special__: 'animated',
        duration: 12,
        all: [[9, 5], [10, 5], [11, 5]],
    },
    popdown_wall: [12, 5],
    popdown_floor: {
        __special__: 'perception',
        modes: new Set(['palette', 'editor', 'xray']),
        hidden: {
            __special__: 'visual-state',
            depressed: [13, 5],
            normal: [12, 5],
        },
        revealed: [13, 5],
    },
    no_sign: [14, 5],
    frame_block: {
        __special__: 'arrows',
        base: [15, 5],
        arrows: [3, 10],
    },

    flippers: [0, 6],
    fire_boots: [1, 6],
    cleats: [2, 6],
    suction_boots: [3, 6],
    hiking_boots: [4, 6],
    lightning_bolt: [5, 6],
    '#active-player-background': [6, 6],
    // TODO dopps can push but i don't think they have any other visuals
    doppelganger1: {
        __special__: 'overlay',
        base: [7, 6],
        overlay: 'player',
    },
    doppelganger2: {
        __special__: 'overlay',
        base: [7, 6],
        overlay: 'player2',
    },
    button_blue: [8, 6],
    button_green: [9, 6],
    button_red: [10, 6],
    button_brown: [11, 6],
    button_pink: {
        __special__: 'wires',
        base: [0, 2],
        wired: [12, 6],
    },
    button_black: {
        __special__: 'wires',
        base: [0, 2],
        wired: [13, 6],
    },
    button_orange: [14, 6],
    button_yellow: [15, 6],

    // TODO moving
    bug: {
        __special__: 'animated',
        global: false,
        duration: 1,
        north: [[0, 7], [1, 7], [2, 7], [3, 7]],
        east: [[4, 7], [5, 7], [6, 7], [7, 7]],
        south: [[8, 7], [9, 7], [10, 7], [11, 7]],
        west: [[12, 7], [13, 7], [14, 7], [15, 7]],
    },

    tank_blue: {
        __special__: 'animated',
        duration: 20,
        cc2_duration: 32,
        north: [[0, 8], [1, 8]],
        east: [[2, 8], [3, 8]],
        south: [[4, 8], [5, 8]],
        west: [[6, 8], [7, 8]],
    },
    glider: {
        __special__: 'animated',
        duration: 10,
        cc2_duration: 8,
        north: [[8, 8], [9, 8]],
        east: [[10, 8], [11, 8]],
        south: [[12, 8], [13, 8]],
        west: [[14, 8], [15, 8]],
    },

    green_floor: {
        __special__: 'animated',
        duration: 24,
        cc2_duration: 16,
        all: [[0, 9], [1, 9], [2, 9], [3, 9]],
    },
    purple_floor: {
        __special__: 'animated',
        duration: 24,
        cc2_duration: 16,
        all: [[4, 9], [5, 9], [6, 9], [7, 9]],
    },
    green_wall: {
        __special__: 'overlay',
        base: 'green_floor',
        overlay: [8, 9],
    },
    purple_wall: {
        __special__: 'overlay',
        base: 'purple_floor',
        overlay: [8, 9],
    },
    trap: {
        __special__: 'visual-state',
        closed: [9, 9],
        open: [10, 9],
    },
    button_gray: [11, 9],
    fireball: {
        __special__: 'animated',
        duration: 12,
        cc2_duration: 4,
        all: [[12, 9], [13, 9], [14, 9], [15, 9]],
    },

    fake_wall: [0, 10],
    fake_floor: {
        __special__: 'perception',
        modes: new Set(['palette', 'editor', 'xray']),
        hidden: [0, 10],
        revealed: [10, 31],
    },
    // Thin walls are built piecemeal from two tiles; the first is N/S, the second is E/W
    thin_walls: {
        __special__: 'thin-walls',
        thin_walls_ns: [1, 10],
        thin_walls_ew: [2, 10],
    },
    teleport_blue: {
        __special__: 'wires',
        base: [0, 2],
        wired: {
            __special__: 'animated',
            duration: 20,
            cc2_duration: 16,
            all: [[4, 10], [5, 10], [6, 10], [7, 10]],
        },
    },
    popwall: [8, 10],
    popwall2: [8, 10],  // compat tile, so needs a fallback
    gravel: [9, 10],
    ball: {
        __special__: 'animated',
        global: false,
        duration: 0.5,
        cc2_duration: 1,
        idle_frame_index: 2,
        // appropriately, this animation ping-pongs
        all: [[10, 10], [11, 10], [12, 10], [13, 10], [14, 10], [13, 10], [12, 10], [11, 10]],
    },
    steel: {
        // Wiring!
        __special__: 'wires',
        base: [15, 10],
        wired: [9, 26],
        wired_cross: [11, 26],
        is_wired_optional: true,
    },

    teeth: {
        __special__: 'animated',
        global: false,
        duration: 1,
        idle_frame_index: 1,
        // NOTE: CC2 inexplicably dropped north teeth and just uses the south sprites instead
        north: [[0, 11], [1, 11], [2, 11], [1, 11]],
        east: [[3, 11], [4, 11], [5, 11], [4, 11]],
        south: [[0, 11], [1, 11], [2, 11], [1, 11]],
        west: [[6, 11], [7, 11], [8, 11], [7, 11]],
    },
    swivel_sw: [9, 11],
    swivel_nw: [10, 11],
    swivel_ne: [11, 11],
    swivel_se: [12, 11],
    swivel_floor: [13, 11],
    '#wire-tunnel': [14, 11],
    stopwatch_penalty: [15, 11],
    paramecium: {
        __special__: 'animated',
        global: false,
        duration: 1,
        north: [[0, 12], [1, 12], [2, 12]],
        east: [[3, 12], [4, 12], [5, 12]],
        south: [[6, 12], [7, 12], [8, 12]],
        west: [[9, 12], [10, 12], [11, 12]],
    },
    foil: [12, 12],
    turtle: {
        // Turtles draw atop fake water, but don't act like water otherwise
        __special__: 'overlay',
        overlay: {
            __special__: 'animated',
            duration: 256,
            positionally_hashed: true,
            all: [[13, 12], [14, 12], [15, 12], [14, 12]],
        },
        base: 'water',
    },

    walker: {
        __special__: 'double-size-monster',
        base: [0, 13],
        vertical: [null, [1, 13], [2, 13], [3, 13], [4, 13], [5, 13], [6, 13], [7, 13]],
        horizontal: [null, [8, 13], [10, 13], [12, 13], [14, 13], [8, 14], [10, 14], [12, 14]],
    },
    helmet: [0, 14],
    stopwatch_toggle: [14, 14],
    stopwatch_bonus: [15, 14],

    blob: {
        __special__: 'double-size-monster',
        base: [0, 15],
        vertical: [null, [1, 15], [2, 15], [3, 15], [4, 15], [5, 15], [6, 15], [7, 15]],
        horizontal: [null, [8, 15], [10, 15], [12, 15], [14, 15], [8, 16], [10, 16], [12, 16]],
    },
    // (cc2 editor copy/paste outline)
    floor_mimic: {
        __special__: 'perception',
        modes: new Set(['palette', 'editor', 'xray']),
        hidden: [0, 2],
        revealed: [14, 16],
    },
    // (cc2 editor cursor outline)

    // timid teeth
    teeth_timid: {
        __special__: 'animated',
        global: false,
        duration: 1,
        idle_frame_index: 1,
        // NOTE: CC2 inexplicably dropped north teeth and just uses the south sprites instead
        // NOTE: it also skimped on timid teeth frames
        north: [[1, 17], [0, 17]],
        east: [[3, 17], [2, 17]],
        south: [[1, 17], [0, 17]],
        west: [[5, 17], [4, 17]],
    },
    bowling_ball: [6, 17],
    rolling_ball: {
        __special__: 'animated',
        global: false,
        duration: 2,
        all: [[6, 17], [7, 17]],
    },
    tank_yellow: {
        __special__: 'animated',
        duration: 20,
        cc2_duration: 32,
        north: [[8, 17], [9, 17]],
        east: [[10, 17], [11, 17]],
        south: [[12, 17], [13, 17]],
        west: [[14, 17], [15, 17]],
    },

    rover: {
        __special__: 'rover',
        direction: [10, 18],
        inert: [0, 18],
        teeth: {
            __special__: 'animated',
            duration: 16,
            all: [[0, 18], [8, 18]],
        },
        // cw, slow
        glider: {
            __special__: 'animated',
            duration: 32,
            all: [[0, 18], [1, 18], [2, 18], [3, 18], [4, 18], [5, 18], [6, 18], [7, 18]],
        },
        // ccw, fast
        bug: {
            __special__: 'animated',
            duration: 16,
            all: [[7, 18], [6, 18], [5, 18], [4, 18], [3, 18], [2, 18], [1, 18], [0, 18]],
        },
        ball: {
            __special__: 'animated',
            duration: 16,
            all: [[0, 18], [4, 18]],
        },
        teeth_timid: {
            __special__: 'animated',
            duration: 16,
            all: [[0, 18], [9, 18]],
        },
        // ccw, slow
        fireball: {
            __special__: 'animated',
            duration: 32,
            all: [[7, 18], [6, 18], [5, 18], [4, 18], [3, 18], [2, 18], [1, 18], [0, 18]],
        },
        // cw, fast
        paramecium: {
            __special__: 'animated',
            duration: 16,
            all: [[0, 18], [1, 18], [2, 18], [3, 18], [4, 18], [5, 18], [6, 18], [7, 18]],
        },
        walker: {
            __special__: 'animated',
            duration: 16,
            all: [[8, 18], [9, 18]],
        },
    },
    xray_eye: [11, 18],
    ghost: {
        north: [12, 18],
        east: [13, 18],
        south: [14, 18],
        west: [15, 18],
    },

    force_floor_n: {
        __special__: 'scroll',
        duration: 24,
        cc2_duration: 8,
        base: [0, 19],
        scroll_region: [0, 1],
    },
    force_floor_e: {
        __special__: 'scroll',
        duration: 24,
        cc2_duration: 8,
        base: [3, 19],
        scroll_region: [-1, 0],
    },
    force_floor_s: {
        __special__: 'scroll',
        duration: 24,
        cc2_duration: 8,
        base: [1, 20],
        scroll_region: [0, -1],
    },
    force_floor_w: {
        __special__: 'scroll',
        duration: 24,
        cc2_duration: 8,
        base: [2, 20],
        scroll_region: [1, 0],
    },
    teleport_green: {
        __special__: 'animated',
        duration: 20,
        cc2_duration: 16,
        // Nice little touch: green teleporters aren't animated in sync
        positionally_hashed: true,
        all: [[4, 19], [5, 19], [6, 19], [7, 19]],
    },
    teleport_yellow: {
        __special__: 'animated',
        duration: 20,
        cc2_duration: 16,
        all: [[8, 19], [9, 19], [10, 19], [11, 19]],
    },
    transmogrifier: {
        __special__: 'visual-state',
        active: {
            __special__: 'animated',
            duration: 16,
            all: [[12, 19], [13, 19], [14, 19], [15, 19]],
        },
        inactive: [12, 19],
    },
    teleport_red: {
        __special__: 'wires',
        base: [0, 2],
        wired: {
            __special__: 'visual-state',
            active: {
                __special__: 'animated',
                duration: 20,
                cc2_duration: 16,
                all: [[4, 20], [5, 20], [6, 20], [7, 20]],
            },
            inactive: [4, 20],
        },
    },
    slime: {
        __special__: 'animated',
        duration: 60,
        all: [[8, 20], [9, 20], [10, 20], [11, 20], [12, 20], [13, 20], [14, 20], [15, 20]],
    },

    force_floor_all: {
        __special__: 'animated',
        duration: 24,
        cc2_duration: 8,
        all: [[0, 21], [1, 21], [2, 21], [3, 21], [4, 21], [5, 21], [6, 21], [7, 21]],
    },
    // latches
    light_switch_off: {
        __special__: 'wires',
        base: [14, 21],
        wired: [12, 21],
    },
    light_switch_on: {
        __special__: 'wires',
        base: [14, 21],
        wired: [13, 21],
    },
    thief_keys: [15, 21],

    player: {
        __special__: 'visual-state',
        normal: {
            north: [0, 22],
            south: [0, 23],
            west: [8, 23],
            east: [8, 22],
        },
        blocked: {
            north: [8, 24],
            east: [9, 24],
            south: [10, 24],
            west: [11, 24],
        },
        moving: {
            __special__: 'animated',
            global: false,
            duration: 0.5,
            cc2_duration: 1,
            north: [[0, 22], [1, 22], [2, 22], [3, 22], [4, 22], [5, 22], [6, 22], [7, 22]],
            east: [[8, 22], [9, 22], [10, 22], [11, 22], [12, 22], [13, 22], [14, 22], [15, 22]],
            south: [[0, 23], [1, 23], [2, 23], [3, 23], [4, 23], [5, 23], [6, 23], [7, 23]],
            west: [[8, 23], [9, 23], [10, 23], [11, 23], [12, 23], [13, 23], [14, 23], [15, 23]],
        },
        pushing: 'blocked',
        swimming: {
            __special__: 'animated',
            global: false,
            duration: 1,
            north: [[0, 24], [1, 24]],
            east: [[2, 24], [3, 24]],
            south: [[4, 24], [5, 24]],
            west: [[6, 24], [7, 24]],
        },
        // The classic CC2 behavior, spinning/slipping on ice
        skating: {
            __special__: 'animated',
            global: false,
            duration: 0.5,
            all: [
                [0, 22], [1, 22], [2, 22], [8, 22], [9, 22], [10, 22],
                [0, 23], [1, 23], [2, 23], [8, 23], [9, 23], [10, 23],
            ],
        },
        // TODO i don't know what CC2 does
        forced: {
            north: [2, 22],
            east: [10, 22],
            south: [2, 23],
            west: [10, 23],
        },
        exited: 'normal',
        // These are frames from the splash/explosion animations
        drowned: [5, 5],
        slimed: [5, 5],
        burned: [1, 5],
        exploded: [1, 5],
        failed: [1, 5],
        fell: [5, 39],
    },
    // Do a quick spin I guess??
    player1_exit: [[0, 22], [8, 22], [0, 23], [8, 23]],
    bogus_player_win: {
        __special__: 'overlay',
        overlay: [0, 23],
        base: 'exit',
    },
    bogus_player_swimming: {
        north: [0, 24],
        east: [2, 24],
        south: [4, 24],
        west: [6, 24],
    },
    bogus_player_drowned: {
        __special__: 'overlay',
        overlay: [5, 5],  // splash
        base: 'water',
    },
    bogus_player_burned_fire: {
        __special__: 'overlay',
        overlay: [2, 5],  // explosion frame 3
        base: 'fire',
    },
    bogus_player_burned: {
        __special__: 'overlay',
        overlay: [2, 5],  // explosion frame 3
        base: 'floor',
    },
    water: {
        __special__: 'animated',
        duration: 36,
        cc2_duration: 20,
        all: [[12, 24], [13, 24], [14, 24], [15, 24]],
    },

    logic_gate: {
        __special__: 'logic-gate',
        counter_numbers: {
            x: 0,
            y: 3,
            width: 0.75,
            height: 1,
        },
        logic_gate_tiles: {
            'latch-ccw': {
                north: [8, 21],
                east: [9, 21],
                south: [10, 21],
                west: [11, 21],
            },
            not: {
                north: [0, 25],
                east: [1, 25],
                south: [2, 25],
                west: [3, 25],
            },
            and: {
                north: [4, 25],
                east: [5, 25],
                south: [6, 25],
                west: [7, 25],
            },
            or: {
                north: [8, 25],
                east: [9, 25],
                south: [10, 25],
                west: [11, 25],
            },
            xor: {
                north: [12, 25],
                east: [13, 25],
                south: [14, 25],
                west: [15, 25],
            },
            'latch-cw': {
                north: [0, 26],
                east: [1, 26],
                south: [2, 26],
                west: [3, 26],
            },
            nand: {
                north: [4, 26],
                east: [5, 26],
                south: [6, 26],
                west: [7, 26],
            },
            counter: [14, 26],
        },
    },

    '#unpowered': [13, 26],
    '#powered': [15, 26],

    player2: {
        __special__: 'visual-state',
        normal: {
            north: [0, 27],
            south: [0, 28],
            west: [8, 28],
            east: [8, 27],
        },
        blocked: {
            north: [8, 29],
            east: [9, 29],
            south: [10, 29],
            west: [11, 29],
        },
        moving: {
            __special__: 'animated',
            global: false,
            duration: 0.5,
            cc2_duration: 1,
            north: [[0, 27], [1, 27], [2, 27], [3, 27], [4, 27], [5, 27], [6, 27], [7, 27]],
            south: [[0, 28], [1, 28], [2, 28], [3, 28], [4, 28], [5, 28], [6, 28], [7, 28]],
            west: [[8, 28], [9, 28], [10, 28], [11, 28], [12, 28], [13, 28], [14, 28], [15, 28]],
            east: [[8, 27], [9, 27], [10, 27], [11, 27], [12, 27], [13, 27], [14, 27], [15, 27]],
        },
        pushing: 'blocked',
        swimming: {
            __special__: 'animated',
            global: false,
            duration: 1,
            north: [[0, 29], [1, 29]],
            east: [[2, 29], [3, 29]],
            south: [[4, 29], [5, 29]],
            west: [[6, 29], [7, 29]],
        },
        // The classic CC2 behavior, spinning on ice (which can never happen but)
        skating: {
            __special__: 'animated',
            global: false,
            duration: 0.5,
            all: [
                [0, 27], [1, 27], [2, 27], [8, 27], [9, 27], [10, 27],
                [0, 28], [1, 28], [2, 28], [8, 28], [9, 28], [10, 28],
            ],
        },
        // TODO i don't know what CC2 does
        forced: {
            north: [2, 27],
            east: [10, 27],
            south: [2, 28],
            west: [10, 28],
        },
        exited: 'normal',
        // These are frames from the splash/explosion animations
        drowned: [5, 5],
        slimed: [5, 5],
        burned: [1, 5],
        exploded: [1, 5],
        failed: [1, 5],
        fell: [5, 39],
    },
    player2_exit: [[0, 27], [8, 27], [0, 28], [8, 28]],
    fire: {
        __special__: 'animated',
        duration: 36,
        cc2_duration: 20,
        all: [[12, 29], [13, 29], [14, 29], [15, 29]],
    },

    railroad: {
        __special__: 'railroad',
        base: [9, 10],
        railroad_ties: {
            ne: [0, 30],
            se: [1, 30],
            sw: [2, 30],
            nw: [3, 30],
            ew: [4, 30],
            ns: [5, 30],
        },
        railroad_switch: [6, 30],
        railroad_inactive: {
            ne: [7, 30],
            se: [8, 30],
            sw: [9, 30],
            nw: [10, 30],
            ew: [11, 30],
            ns: [12, 30],
        },
        railroad_active: {
            ne: [13, 30],
            se: [14, 30],
            sw: [15, 30],
            nw: [0, 31],
            ew: [1, 31],
            ns: [2, 31],
        },
    },
    railroad_sign: [3, 31],
    dirt: [4, 31],
    no_player2_sign: [5, 31],
    no_player1_sign: [6, 31],
    hook: [7, 31],
    // misc other stuff

    ..._omit_custom_lexy_vfx,
};

// (This is really the MSCC layout, but often truncated in such a way that only TW can use it)
export const TILE_WORLD_TILESET_LAYOUT = {
    '#ident': 'tw-static',
    '#name': "Tile World (static)",
    '#dimensions': [7, 16],
    '#transparent-color': [0xff, 0x00, 0xff, 0xff],
    '#supported-versions': new Set(['cc1']),
    floor: [0, 0],
    wall: [0, 1],
    chip: [0, 2],
    water: [0, 3],
    fire: [0, 4],
    wall_invisible: [0, 5],
    wall_invisible_revealed: {
        // This is specifically /invisible/ when you have the xray glasses
        __special__: 'perception',
        modes: new Set(['xray']),
        hidden: [0, 1],
        revealed: null,
    },
    // FIXME in cc1 tilesets these are opaque so they should draw at the terrain layer
    thin_walls: {
        __special__: 'thin-walls-cc1',
        north: [0, 6],
        west: [0, 7],
        south: [0, 8],
        east: [0, 9],
        southeast: [3, 0],
    },
    // This is the non-directed dirt block, which we don't have
    // dirt_block: [0, 10],
    dirt: [0, 11],
    ice: [0, 12],
    force_floor_s: [0, 13],
    dirt_block: {
        north: [0, 14],
        west: [0, 15],
        south: [1, 0],
        east: [1, 1],
    },

    force_floor_n: [1, 2],
    force_floor_e: [1, 3],
    force_floor_w: [1, 4],
    exit: [1, 5],
    door_blue: [1, 6],
    door_red: [1, 7],
    door_green: [1, 8],
    door_yellow: [1, 9],
    ice_nw: [1, 10],
    ice_ne: [1, 11],
    ice_se: [1, 12],
    ice_sw: [1, 13],
    fake_floor: {
        __special__: 'perception',
        modes: new Set(['palette', 'editor', 'xray']),
        hidden: [1, 15],
        revealed: [1, 14],
    },
    fake_wall: [1, 15],

    // TODO overlay buffer?? [2, 0]
    thief_tools: [2, 1],
    socket: [2, 2],
    button_green: [2, 3],
    button_red: [2, 4],
    green_wall: [2, 5],
    green_floor: [2, 6],
    button_brown: [2, 7],
    button_blue: [2, 8],
    teleport_blue: [2, 9],
    bomb: [2, 10],
    dormant_bomb: [2, 10],  // compat tile, so needs a fallback
    trap: {
        __special__: 'visual-state',
        closed: [2, 11],
        open: [2, 11],
    },
    wall_appearing: [2, 12],
    gravel: [2, 13],
    popwall: [2, 14],
    popwall2: [2, 14],  // compat tile, so needs a fallback
    hint: [2, 15],

    cloner: [3, 1],
    force_floor_all: [3, 2],
    splash: [3, 3],
    splash_nb: [3, 3],
    bogus_player_drowned: [3, 3],
    bogus_player_burned_fire: [3, 4],
    bogus_player_burned: [3, 5],
    explosion: [3, 6],
    explosion_nb: [3, 6],
    explosion_other: [3, 7],  // TODO ???
    // 3, 8 unused
    bogus_player_win: [3, 9],  // TODO 10 and 11 too?  does this animate?
    bogus_player_swimming: {
        north: [3, 12],
        west: [3, 13],
        south: [3, 14],
        east: [3, 15],
    },

    bug: {
        north: [4, 0],
        west: [4, 1],
        south: [4, 2],
        east: [4, 3],
    },
    fireball: {
        north: [4, 4],
        west: [4, 5],
        south: [4, 6],
        east: [4, 7],
    },
    ball: {
        north: [4, 8],
        west: [4, 9],
        south: [4, 10],
        east: [4, 11],
    },
    tank_blue: {
        north: [4, 12],
        west: [4, 13],
        south: [4, 14],
        east: [4, 15],
    },

    glider: {
        north: [5, 0],
        west: [5, 1],
        south: [5, 2],
        east: [5, 3],
    },
    teeth: {
        north: [5, 4],
        west: [5, 5],
        south: [5, 6],
        east: [5, 7],
    },
    walker: {
        north: [5, 8],
        west: [5, 9],
        south: [5, 10],
        east: [5, 11],
    },
    blob: {
        north: [5, 12],
        west: [5, 13],
        south: [5, 14],
        east: [5, 15],
    },

    paramecium: {
        north: [6, 0],
        west: [6, 1],
        south: [6, 2],
        east: [6, 3],
    },
    key_blue: [6, 4],
    key_red: [6, 5],
    key_green: [6, 6],
    key_yellow: [6, 7],
    flippers: [6, 8],
    fire_boots: [6, 9],
    cleats: [6, 10],
    suction_boots: [6, 11],
    player: {
        __special__: 'visual-state',
        normal: {
            north: [6, 12],
            south: [6, 14],
            west: [6, 13],
            east: [6, 15],
        },
        moving: 'normal',
        pushing: 'normal',
        blocked: 'normal',
        swimming: {
            north: [3, 12],
            west: [3, 13],
            south: [3, 14],
            east: [3, 15],
        },
        skating: 'normal',
        forced: 'normal',
        drowned: [3, 3],
        burned: [3, 4],  // TODO TW's lynx mode doesn't use this!  it uses the generic failed
        exploded: [3, 6],
        failed: [3, 7],
    },

    ..._omit_custom_lexy_vfx,
};

export const LL_TILESET_LAYOUT = {
    '#ident': 'lexy',
    '#name': "Lexy's Labyrinth",
    '#dimensions': [32, 32],
    '#supported-versions': new Set(['cc1', 'cc2', 'll']),
    '#wire-width': 1/16,
    '#editor-arrows': {
        north: [25, 31],
        east: [25.5, 31],
        south: [25, 31.5],
        west: [25.5, 31.5],
    },

    // ------------------------------------------------------------------------------------------------
    // Left side: tiles

    // Terrain
    floor: {
        // Wiring!
        __special__: 'wires',
        base: [0, 2],
        wired: [0, 28],
        wired_cross: [1, 28],
        is_wired_optional: true,
    },
    wall: [0, 3],
    floor_letter: {
        __special__: 'letter',
        base: [1, 2],
        letter_glyphs: {
            // Arrows
            "⬆": [6, 1],
            "➡": [6.5, 1],
            "⬇": [6, 1.5],
            "⬅": [6.5, 1.5],
        },
        letter_ranges: [{
            // ASCII text (only up through uppercase)
            range: [32, 96],
            x0: 0,
            y0: 0,
            w: 0.5,
            h: 0.5,
            columns: 32,
        }],
    },
    steel: {
        // Wiring!
        __special__: 'wires',
        base: [1, 3],
        wired: [0, 29],
        wired_cross: [1, 29],
        is_wired_optional: true,
    },
    hint: [2, 2],
    wall_invisible: {
        __special__: 'perception',
        modes: new Set(['palette', 'editor', 'xray']),
        hidden: [0, 2],
        revealed: [3, 2],
    },
    wall_invisible_revealed: {
        // This is specifically /invisible/ when you have the xray glasses
        __special__: 'perception',
        modes: new Set(['xray']),
        hidden: [0, 3],
        revealed: null,
    },
    wall_appearing: {
        __special__: 'perception',
        modes: new Set(['palette', 'editor', 'xray']),
        hidden: [0, 2],
        revealed: [3, 3],
    },
    wall_invisible_overlay: {
        __special__: 'perception',
        modes: new Set(['palette', 'editor', 'xray']),
        hidden: [0, 1],
        revealed: [2, 3],
    },
    wall_invisible_overlay_revealed: {
        // This is specifically /invisible/ when you have the xray glasses
        __special__: 'perception',
        modes: new Set(['xray']),
        hidden: [0, 3],
        revealed: null,
    },
    popwall: [4, 2],
    popwall2: [4, 3],
    fake_floor: {
        __special__: 'perception',
        modes: new Set(['palette', 'editor', 'xray']),
        hidden: [5, 3],
        revealed: [5, 2],
    },
    fake_wall: [5, 3],
    popdown_floor: {
        __special__: 'perception',
        modes: new Set(['palette', 'editor', 'xray']),
        hidden: {
            __special__: 'visual-state',
            depressed: [6, 2],
            normal: [6, 3],
        },
        revealed: [6, 2],
    },
    popdown_wall: [6, 3],
    canopy: {
        __special__: 'perception',
        modes: new Set(['editor', 'xray']),
        hidden: [7, 2],
        revealed: [7, 3],
    },
    dirt: [8, 2],
    gravel: [8, 3],
    sand: [9, 2],
    spikes: [9, 3],
    grass: [10, 2],
    //snow: [11, 2],
    hole: {
        __special__: 'visual-state',
        north: [12, 2],
        open: [12, 3],
    },
    cracked_floor: [13, 2],

    exit: {
        __special__: 'animated',
        duration: 16,
        all: [[0, 4], [1, 4], [2, 4], [3, 4]],
    },
    '#active-player-background': {
        __special__: 'animated',
        duration: 120,
        all: [[0, 5], [1, 5]],
    },
    // TODO dopps can push but i don't think they have any other visuals
    doppelganger1: {
        __special__: 'overlay',
        base: [2, 5],
        overlay: 'player',
    },
    doppelganger2: {
        __special__: 'overlay',
        base: [2, 5],
        overlay: 'player2',
    },
    '#killer-indicator': [3, 5],
    socket: [4, 4],
    no_player1_sign: [5, 4],
    no_player2_sign: [5, 5],
    thief_tools: [6, 4],
    thief_keys: [6, 5],
    thief_lock: [7, 4],
    floor_custom_green: [8, 4],
    floor_custom_pink: [9, 4],
    floor_custom_yellow: [10, 4],
    floor_custom_blue: [11, 4],
    wall_custom_green: [8, 5],
    wall_custom_pink: [9, 5],
    wall_custom_yellow: [10, 5],
    wall_custom_blue: [11, 5],
    thin_walls: {
        __special__: 'thin-walls',
        thin_walls_ns: [12, 4],
        thin_walls_ew: [12, 5],
    },
    one_way_walls: {
        __special__: 'thin-walls',
        thin_walls_ns: [13, 4],
        thin_walls_ew: [13, 5],
    },

    water: {
        __special__: 'animated',
        duration: 36,
        cc2_duration: 20,
        all: [[0, 6], [1, 6], [2, 6], [3, 6]],
    },
    fire: {
        __special__: 'animated',
        duration: 36,
        cc2_duration: 20,
        all: [[0, 7], [1, 7], [2, 7], [3, 7]],
    },
    turtle: {
        // Turtles draw atop fake water, but don't act like water otherwise
        __special__: 'overlay',
        overlay: {
            __special__: 'animated',
            duration: 180,
            positionally_hashed: true,
            all: [[4, 6], [5, 6], [6, 6], [5, 6]],
        },
        base: 'water',
    },
    ice: {
        __special__: 'animated',
        duration: 60 * 15,
        positionally_hashed: true,
        all: new Array(252).fill([4, 7]).concat([
            [4, 9], [5, 9], [6, 9], [7, 9],
        ]),
        _distinct: [[4, 7], [4, 9], [5, 9], [6, 9], [7, 9]],
    },
    cracked_ice: [5, 7],
    ice_se: [6, 7],
    ice_sw: [7, 7],
    ice_ne: [6, 8],
    ice_nw: [7, 8],
    green_floor: {
        __special__: 'animated',
        duration: 24,
        cc2_duration: 16,
        all: [[8, 6], [9, 6], [10, 6], [11, 6]],
    },
    green_wall: {
        __special__: 'animated',
        duration: 24,
        cc2_duration: 16,
        all: [[8, 7], [9, 7], [10, 7], [11, 7]],
    },
    purple_floor: {
        __special__: 'animated',
        duration: 24,
        cc2_duration: 16,
        all: [[12, 6], [13, 6], [14, 6], [15, 6]],
    },
    purple_wall: {
        __special__: 'animated',
        duration: 24,
        cc2_duration: 16,
        all: [[12, 7], [13, 7], [14, 7], [15, 7]],
    },

    force_floor_n: {
        __special__: 'scroll',
        duration: 24,
        cc2_duration: 8,
        base: [0, 8],
        scroll_region: [0, 1],
    },
    force_floor_e: {
        __special__: 'scroll',
        duration: 24,
        cc2_duration: 8,
        base: [3, 8],
        scroll_region: [-1, 0],
    },
    force_floor_s: {
        __special__: 'scroll',
        duration: 24,
        cc2_duration: 8,
        base: [1, 9],
        scroll_region: [0, -1],
    },
    force_floor_w: {
        __special__: 'scroll',
        duration: 24,
        cc2_duration: 8,
        base: [2, 9],
        scroll_region: [1, 0],
    },
    force_floor_all: {
        __special__: 'animated',
        duration: 24,
        cc2_duration: 8,
        all: [[0, 10], [1, 10], [2, 10], [3, 10], [4, 10], [5, 10], [6, 10], [7, 10]],
    },
    slime: {
        __special__: 'animated',
        duration: 60,
        all: [[0, 11], [1, 11], [2, 11], [3, 11], [4, 11], [5, 11], [6, 11], [7, 11]],
    },
    railroad: {
        __special__: 'railroad',
        base: [15, 3],
        railroad_ties: {
            ne: [8, 8],
            se: [9, 8],
            sw: [10, 8],
            nw: [11, 8],
            ew: [12, 8],
            ns: [13, 8],
        },
        railroad_active: {
            ne: [8, 9],
            se: [9, 9],
            sw: [10, 9],
            nw: [11, 9],
            ew: [12, 9],
            ns: [13, 9],
        },
        railroad_inactive: {
            ne: [8, 10],
            se: [9, 10],
            sw: [10, 10],
            nw: [11, 10],
            ew: [12, 10],
            ns: [13, 10],
        },
        railroad_switch: [14, 8],
    },
    swivel_floor: [15, 8],
    swivel_se: [14, 9],
    swivel_sw: [15, 9],
    swivel_ne: [14, 10],
    swivel_nw: [15, 10],
    dash_floor: {
        __special__: 'animated',
        duration: 24,
        all: [[8, 11], [9, 11], [10, 11], [11, 11], [12, 11], [13, 11], [14, 11], [15, 11]],
    },

    // Items
    chip: {
        __special__: 'animated',
        duration: 24,
        all: [[0, 12], [1, 12], [2, 12], [1, 12]],
    },
    chip_extra: {
        __special__: 'perception',
        modes: new Set(['palette', 'editor']),
        hidden: {
            __special__: 'animated',
            duration: 24,
            all: [[0, 12], [1, 12], [2, 12], [1, 12]],
        },
        revealed: [3, 12],
    },
    green_chip: {
        __special__: 'animated',
        duration: 24,
        all: [[0, 13], [1, 13], [2, 13], [1, 13]],
    },
    green_bomb: [3, 13],
    score_10: [0, 14],
    score_100: [1, 14],
    score_1000: [2, 14],
    score_2x: [3, 14],
    stopwatch_bonus: [0, 15],
    stopwatch_penalty: [1, 15],
    stopwatch_toggle: [2, 15],
    score_5x: [3, 15],

    flippers: [4, 12],
    fire_boots: [5, 12],
    cleats: [6, 12],
    suction_boots: [7, 12],
    hiking_boots: [4, 13],
    lightning_bolt: [5, 13],
    speed_boots: [6, 13],
    bribe: [7, 13],
    railroad_sign: [4, 14],
    hook: [5, 14],
    foil: [6, 14],
    xray_eye: [7, 14],
    helmet: [4, 15],
    bowling_ball: [5, 15],
    dynamite: [6, 15],
    bomb: [7, 15],  // LL bombs aren't animated

    no_sign: [8, 12],
    gift_bow: [9, 12],
    toll_gate: [10, 12],
    dormant_bomb: [11, 12],
    skeleton_key: [8, 13],
    ankh: [9, 13],
    floor_ankh: [10, 13],
    phantom_ring: [11, 13],
    feather: [8, 14],
    dumbbell: [9, 14],
    remote_gray: [10, 14],
    remote_green: [11, 14],
    bucket_water: [8, 15],
    bucket_fire: [9, 15],

    conveyor_n: {
        __special__: 'animated',
        duration: 24,
        all: [[12, 12], [13, 12], [14, 12], [15, 12]],
    },
    conveyor_e: {
        __special__: 'animated',
        duration: 24,
        all: [[12, 13], [13, 13], [14, 13], [15, 13]],
    },
    conveyor_s: {
        __special__: 'animated',
        duration: 24,
        all: [[12, 14], [13, 14], [14, 14], [15, 14]],
    },
    conveyor_w: {
        __special__: 'animated',
        duration: 24,
        all: [[12, 15], [13, 15], [14, 15], [15, 15]],
    },

    // Doors and mechanisms
    key_red: [0, 16],
    key_blue: [0, 17],
    key_yellow: [0, 18],
    key_green: [0, 19],
    door_red: [1, 16],
    door_blue: [1, 17],
    door_yellow: [1, 18],
    door_green: [1, 19],
    gate_red: [2, 16],
    gate_blue: [2, 17],
    gate_yellow: [2, 18],
    gate_green: [2, 19],
    teleport_red: {
        __special__: 'wires',
        base: [0, 2],
        wired: {
            __special__: 'visual-state',
            active: {
                __special__: 'animated',
                duration: 20,
                cc2_duration: 16,
                all: [[4, 16], [5, 16], [6, 16], [7, 16]],
            },
            inactive: [9, 19],
        },
    },
    teleport_blue: {
        __special__: 'wires',
        base: [0, 2],
        wired: {
            __special__: 'animated',
            duration: 16,
            cc2_duration: 16,
            all: [[4, 17], [5, 17], [6, 17], [7, 17]],
        },
    },
    teleport_yellow: {
        __special__: 'animated',
        duration: 16,
        cc2_duration: 16,
        all: [[4, 18], [5, 18], [6, 18], [7, 18]],
    },
    teleport_green: {
        // Note that wired green teleporters are an LL extension
        __special__: 'wires',
        base: [0, 2],
        wired: {
            __special__: 'visual-state',
            active: {
                __special__: 'animated',
                duration: 16,
                cc2_duration: 16,
                // Nice little touch: green teleporters aren't animated in sync
                positionally_hashed: true,
                all: [[4, 19], [5, 19], [6, 19], [7, 19]],
            },
            inactive: [11, 19],
        },
    },
    teleport_blue_exit: {
        __special__: 'wires',
        base: [0, 2],
        wired: [8, 19],
    },
    transmogrifier: {
        __special__: 'visual-state',
        active: {
            __special__: 'animated',
            duration: 16,
            all: [[8, 16], [9, 16], [10, 16], [11, 16]],
        },
        inactive: [10, 19],
    },
    turntable_cw: {
        __special__: 'wires',
        base: [0, 2],
        wired: {
            __special__: 'animated',
            duration: 12,
            cc2_duration: 16,
            all: [[8, 18], [9, 18], [10, 18], [11, 18]],
        }
    },
    turntable_ccw: {
        __special__: 'wires',
        base: [0, 2],
        wired: {
            __special__: 'animated',
            duration: 12,
            cc2_duration: 16,
            all: [[8, 17], [9, 17], [10, 17], [11, 17]],
        }
    },
    teleport_rainbow: {
        __special__: 'wires',
        base: [0, 2],
        wired: {
            __special__: 'visual-state',
            active: {
                __special__: 'animated',
                duration: 16,
                all: [[12, 16], [13, 16], [14, 16], [15, 16]],
            },
            inactive: [12, 19],
        },
    },
    flame_jet_off: [12, 17],
    flame_jet_on: {
        __special__: 'animated',
        duration: 18,
        cc2_duration: 12,
        all: [[13, 17], [14, 17], [15, 17]],
    },
    electrified_floor: {
        __special__: 'visual-state',
        active: {
            __special__: 'animated',
            duration: 18,
            cc2_duration: 12,
            all: [[13, 18], [14, 18], [15, 18]],
        },
        inactive: [12, 18],
    },
    nega_chip: {
        __special__: 'animated',
        duration: 48,
        all: [[13, 19], [14, 19], [15, 19], [14, 19]],
    },

    // Buttons
    button_blue: {
        __special__: 'visual-state',
        released: [0, 20],
        pressed: [0, 21],
    },
    button_green: {
        __special__: 'visual-state',
        released: [1, 20],
        pressed: [1, 21],
    },
    button_red: {
        __special__: 'visual-state',
        released: [2, 20],
        pressed: [2, 21],
    },
    button_brown: {
        __special__: 'visual-state',
        released: [3, 20],
        pressed: [3, 21],
    },
    button_pink: {
        __special__: 'wires',
        base: [0, 2],
        wired: {
            __special__: 'visual-state',
            released: [4, 20],
            pressed: [4, 21],
        },
    },
    button_black: {
        __special__: 'wires',
        base: [0, 2],
        wired: {
            __special__: 'visual-state',
            released: [5, 20],
            pressed: [5, 21],
        },
    },
    button_orange: {
        __special__: 'visual-state',
        released: [6, 20],
        pressed: [6, 21],
    },
    button_gray: {
        __special__: 'visual-state',
        released: [7, 20],
        pressed: [7, 21],
    },
    cloner: [0, 22],  // FIXME arrows at [0, 27]
    trap: {
        __special__: 'visual-state',
        open: [1, 23],
        closed: [1, 22],
    },
    scanner: [2, 22],
    button_cyan: {
        __special__: 'visual-state',
        released: [5, 22],
        pressed: [5, 23],
    },
    light_switch_off: {
        __special__: 'wires',
        base: [7, 23],
        wired: [6, 22],
    },
    light_switch_on: {
        __special__: 'wires',
        base: [7, 23],
        wired: [6, 23],
    },
    button_yellow: [7, 22],

    sokoban_block: {
        __special__: 'perception',
        modes: new Set(['editor', 'xray']),
        hidden: {
            __special__: 'visual-state',
            red: [10, 20],
            blue: [10, 21],
            yellow: [10, 22],
            green: [10, 23],
            red_matched: [11, 20],
            blue_matched: [11, 21],
            yellow_matched: [11, 22],
            green_matched: [11, 23],
        },
        revealed: {
            __special__: 'visual-state',
            red: [9, 20],
            blue: [9, 21],
            yellow: [9, 22],
            green: [9, 23],
            red_matched: [9, 20],
            blue_matched: [9, 21],
            yellow_matched: [9, 22],
            green_matched: [9, 23],
        },
    },
    sokoban_button: {
        __special__: 'visual-state',
        red_released: [12, 20],
        blue_released: [12, 21],
        yellow_released: [12, 22],
        green_released: [12, 23],
        red_pressed: [13, 20],
        blue_pressed: [13, 21],
        yellow_pressed: [13, 22],
        green_pressed: [13, 23],
    },
    sokoban_wall: {
        __special__: 'visual-state',
        red: [14, 20],
        blue: [14, 21],
        yellow: [14, 22],
        green: [14, 23],
    },
    sokoban_floor: {
        __special__: 'visual-state',
        red: [15, 20],
        blue: [15, 21],
        yellow: [15, 22],
        green: [15, 23],
    },

    // Blocks
    dirt_block: {
        __special__: 'perception',
        modes: new Set(['editor', 'xray']),
        hidden: [0, 24],
        revealed: [0, 25],
    },
    ice_block: {
        __special__: 'perception',
        modes: new Set(['editor', 'xray']),
        hidden: [1, 24],
        revealed: [1, 25],
    },
    frame_block: {
        __special__: 'arrows',
        base: [2, 24],
        arrows: [2, 25],
    },
    boulder: {
        __special__: 'animated',
        duration: 4,
        global: false,
        idle: [4, 24],
        north: [[5, 25], [6, 25], [7, 25]],
        east: [[5, 24], [6, 24], [7, 24]],
        south: [[7, 25], [6, 25], [5, 25]],
        west: [[7, 24], [6, 24], [5, 24]],
    },
    burr: [4, 25],
    circuit_block: {
        __special__: 'wires',
        base: [0, 26],
        wired: [1, 26],
        wired_cross: [2, 26],
    },
    glass_block: {
        __special__: 'encased_item',
        base: [3, 26],
    },
    green_block: {
        north: [0, 27],
        east: [1, 27],
        south: [2, 27],
        west: [3, 27],
    },
    log: {
        __special__: 'visual-state',
        standing: [8, 24],
        laying_ns: [12, 25],
        laying_ew: [12, 24],
        toppling: {
            north: [[9, 24], [10, 24], [11, 24], [12, 25]],
            east: [[9, 25], [10, 25], [11, 25], [12, 24]],
            south: [[9, 26], [10, 26], [11, 26], [12, 25]],
            west: [[9, 27], [10, 27], [11, 27], [12, 26]],
        },
        rolling: {
            north: [[13, 24], [14, 24], [15, 24]],
            east: [[13, 25], [14, 25], [15, 25]],
            south: [[15, 24], [14, 24], [13, 24]],
            west: [[15, 25], [14, 25], [13, 25]],
        },
    },

    // Wire and logic
    '#wire-tunnel': [2, 28],
    '#wire-frame': [3, 28],
    '#unpowered': [0, 31],
    '#powered': [1, 31],
    logic_gate: {
        __special__: 'logic-gate',
        counter_numbers: {
            x: 7,
            y: 1,
            width: 0.75,
            height: 1,
        },
        logic_gate_tiles: {
            bogus: [2, 31],
            counter: [3, 31],
            not: {
                north: [4, 28],
                east: [4, 29],
                south: [4, 30],
                west: [4, 31],
            },
            and: {
                north: [5, 28],
                east: [5, 29],
                south: [5, 30],
                west: [5, 31],
            },
            or: {
                north: [6, 28],
                east: [6, 29],
                south: [6, 30],
                west: [6, 31],
            },
            xor: {
                north: [7, 28],
                east: [7, 29],
                south: [7, 30],
                west: [7, 31],
            },
            nand: {
                north: [8, 28],
                east: [8, 29],
                south: [8, 30],
                west: [8, 31],
            },
            'latch-cw': {
                north: [9, 28],
                east: [9, 29],
                south: [9, 30],
                west: [9, 31],
            },
            'latch-ccw': {
                north: [10, 28],
                east: [10, 29],
                south: [10, 30],
                west: [10, 31],
            },
            diode: {
                north: [11, 28],
                east: [11, 29],
                south: [11, 30],
                west: [11, 31],
            },
            delay: {
                north: [12, 28],
                east: [12, 29],
                south: [12, 30],
                west: [12, 31],
            },
            battery: {
                north: [13, 28],
                east: [13, 29],
                south: [13, 30],
                west: [13, 31],
            },
        },
    },

    // ------------------------------------------------------------------------------------------------
    // Right side: actors

    player: {
        __special__: 'visual-state',
        normal: {
            north: [16, 0],
            east: [16, 1],
            south: [16, 2],
            west: [16, 3],
        },
        moving: {
            __special__: 'animated',
            global: false,
            duration: 0.5,
            cc2_duration: 1,
            north: [[16, 0], [17, 0], [18, 0], [19, 0], [20, 0], [21, 0], [22, 0], [23, 0]],
            east: [[16, 1], [17, 1], [18, 1], [19, 1], [20, 1], [21, 1], [22, 1], [23, 1]],
            south: [[16, 2], [17, 2], [18, 2], [19, 2], [20, 2], [21, 2], [22, 2], [23, 2]],
            west: [[16, 3], [17, 3], [18, 3], [19, 3], [20, 3], [21, 3], [22, 3], [23, 3]],
        },
        swimming: {
            __special__: 'animated',
            global: false,
            duration: 1,
            north: [[24, 0], [25, 0]],
            east: [[24, 1], [25, 1]],
            south: [[24, 2], [25, 2]],
            west: [[24, 3], [25, 3]],
        },
        pushing: {
            __special__: 'animated',
            global: false,
            duration: 0.5,
            cc2_duration: 1,
            north: [[26, 0], [27, 0], [28, 0], [27, 0]],
            east: [[26, 1], [27, 1], [28, 1], [27, 1]],
            south: [[26, 2], [27, 2], [28, 2], [27, 2]],
            west: [[26, 3], [27, 3], [28, 3], [27, 3]],
        },
        blocked: {
            north: [27, 0],
            east: [27, 1],
            south: [27, 2],
            west: [27, 3],
        },
        skating: {
            north: [29, 0],
            east: [29, 1],
            south: [29, 2],
            west: [29, 3],
        },
        forced: 'skating',
        burned: {
            north: [30, 0],
            east: [30, 1],
            south: [30, 2],
            west: [30, 3],
        },
        // These are frames from the splash/explosion animations
        exploded: [17, 28],
        failed: [17, 28],
        drowned: [17, 29],
        slimed: [17, 30],
        fell: [17, 31],
        exited: [31, 0],
    },
    bogus_player_win: {
        __special__: 'overlay',
        overlay: [16, 2],
        base: 'exit',
    },
    bogus_player_swimming: {
        north: [24, 0],
        east: [24, 1],
        south: [24, 2],
        west: [24, 3],
    },
    bogus_player_drowned: {
        __special__: 'overlay',
        overlay: [17, 27],  // splash
        base: 'water',
    },
    bogus_player_burned_fire: {
        __special__: 'overlay',
        overlay: [17, 26],  // explosion
        base: 'fire',
    },
    bogus_player_burned: {
        __special__: 'overlay',
        overlay: [17, 26],  // explosion
        base: 'floor',
    },

    player2: {
        __special__: 'visual-state',
        normal: {
            north: [16, 4],
            east: [16, 5],
            south: [16, 6],
            west: [16, 7],
        },
        moving: {
            __special__: 'animated',
            global: false,
            duration: 0.5,
            cc2_duration: 1,
            north: [[16, 4], [17, 4], [18, 4], [19, 4], [20, 4], [21, 4], [22, 4], [23, 4]],
            east: [[16, 5], [17, 5], [18, 5], [19, 5], [20, 5], [21, 5], [22, 5], [23, 5]],
            south: [[16, 6], [17, 6], [18, 6], [19, 6], [20, 6], [21, 6], [22, 6], [23, 6]],
            west: [[16, 7], [17, 7], [18, 7], [19, 7], [20, 7], [21, 7], [22, 7], [23, 7]],
        },
        swimming: {
            __special__: 'animated',
            global: false,
            duration: 1,
            north: [[24, 4], [25, 4]],
            east: [[24, 5], [25, 5]],
            south: [[24, 6], [25, 6]],
            west: [[24, 7], [25, 7]],
        },
        pushing: {
            __special__: 'animated',
            global: false,
            duration: 0.5,
            cc2_duration: 1,
            north: [[26, 4], [27, 4], [28, 4], [27, 4]],
            east: [[26, 5], [27, 5], [28, 5], [27, 5]],
            south: [[26, 6], [27, 6], [28, 6], [27, 6]],
            west: [[26, 7], [27, 7], [28, 7], [27, 7]],
        },
        blocked: {
            north: [27, 4],
            east: [27, 5],
            south: [27, 6],
            west: [27, 7],
        },
        skating: {
            north: [29, 4],
            east: [29, 5],
            south: [29, 6],
            west: [29, 7],
        },
        forced: 'skating',
        burned: {
            north: [30, 4],
            east: [30, 5],
            south: [30, 6],
            west: [30, 7],
        },
        // These are frames from the splash/explosion animations
        exploded: [17, 28],
        failed: [17, 28],
        drowned: [17, 29],
        slimed: [17, 30],
        fell: [17, 31],
        exited: [31, 4],
    },

    tank_blue: {
        __special__: 'animated',
        duration: 20,
        cc2_duration: 32,
        north: [[16, 8], [17, 8]],
        east: [[16, 9], [17, 9]],
        south: [[16, 10], [17, 10]],
        west: [[16, 11], [17, 11]],
    },
    tank_yellow: {
        __special__: 'animated',
        duration: 20,
        cc2_duration: 32,
        north: [[18, 8], [19, 8]],
        east: [[18, 9], [19, 9]],
        south: [[18, 10], [19, 10]],
        west: [[18, 11], [19, 11]],
    },
    bug: {
        __special__: 'animated',
        global: false,
        duration: 1,
        north: [[20, 8], [21, 8], [22, 8], [23, 8]],
        east: [[20, 9], [21, 9], [22, 9], [23, 9]],
        south: [[20, 10], [21, 10], [22, 10], [23, 10]],
        west: [[20, 11], [21, 11], [22, 11], [23, 11]],
    },
    paramecium: {
        __special__: 'animated',
        global: false,
        duration: 1,
        north: [[24, 8], [25, 8], [26, 8], [25, 8]],
        east: [[24, 9], [25, 9], [26, 9], [25, 9]],
        south: [[24, 10], [25, 10], [26, 10], [25, 10]],
        west: [[24, 11], [25, 11], [26, 11], [25, 11]],
    },
    glider: {
        __special__: 'animated',
        duration: 10,
        cc2_duration: 8,
        north: [[27, 8], [28, 8]],
        east: [[27, 9], [28, 9]],
        south: [[27, 10], [28, 10]],
        west: [[27, 11], [28, 11]],
    },
    ghost: {
        __special__: 'animated',
        global: false,
        duration: 1,
        north: [[29, 8], [30, 8], [31, 8]],
        east: [[29, 9], [30, 9], [31, 9]],
        south: [[29, 10], [30, 10], [31, 10]],
        west: [[29, 11], [30, 11], [31, 11]],
    },

    blob: {
        __special__: 'animated',
        global: false,
        duration: 1,
        north: [[16, 12], [17, 12], [18, 12], [19, 12], [20, 12], [21, 12], [22, 12], [23, 12]],
        east: [[16, 13], [17, 13], [18, 13], [19, 13], [20, 13], [21, 13], [22, 13], [23, 13]],
        south: [[16, 14], [17, 14], [18, 14], [19, 14], [20, 14], [21, 14], [22, 14], [23, 14]],
        west: [[16, 15], [17, 15], [18, 15], [19, 15], [20, 15], [21, 15], [22, 15], [23, 15]],
    },
    walker: {
        __special__: 'animated',
        global: false,
        duration: 1,
        north: [[24, 12], [24, 13], [24, 14], [24, 15]],
        east: [[25, 12], [25, 13], [25, 14], [25, 15]],
        // Same animations but played backwards
        south: [[24, 14], [24, 13], [24, 12], [24, 15]],
        west: [[25, 14], [25, 13], [25, 12], [25, 15]],
    },

    teeth: {
        __special__: 'animated',
        global: false,
        duration: 1,
        idle_frame_index: 1,
        north: [[16, 16], [17, 16], [18, 16], [17, 16]],
        east: [[16, 17], [17, 17], [18, 17], [17, 17]],
        south: [[16, 18], [17, 18], [18, 18], [17, 18]],
        west: [[16, 19], [17, 19], [18, 19], [17, 19]],
    },
    teeth_timid: {
        __special__: 'animated',
        global: false,
        duration: 1,
        idle_frame_index: 1,
        north: [[19, 16], [20, 16], [21, 16], [20, 16]],
        east: [[19, 17], [20, 17], [21, 17], [20, 17]],
        south: [[19, 18], [20, 18], [21, 18], [20, 18]],
        west: [[19, 19], [20, 19], [21, 19], [20, 19]],
    },

    bear: {
        north: [26, 12],
        east: [26, 13],
        south: [26, 14],
        west: [26, 15],
    },
    bull: [29, 14],
    green_twister: [30, 13],
    glint: {
        __special__: 'visual-state',
        uncharged: {
            __special__: 'animated',
            global: false,
            duration: 1,
            north: [[22, 16], [23, 16], [24, 16]],
            east: [[22, 17], [23, 17], [24, 17]],
            south: [[22, 18], [23, 18], [24, 18]],
            west: [[22, 19], [23, 19], [24, 19]],
        },
        charged: {
            __special__: 'animated',
            global: false,
            duration: 1,
            north: [[25, 16], [26, 16], [27, 16]],
            east: [[25, 17], [26, 17], [27, 17]],
            south: [[25, 18], [26, 18], [27, 18]],
            west: [[25, 19], [26, 19], [27, 19]],
        },
    },
    shark: [31, 13],

    rover: {
        __special__: 'rover',
        direction: [26, 24],
        inert: [16, 24],
        teeth: {
            __special__: 'animated',
            duration: 16,
            all: [[16, 24], [24, 24]],
        },
        // cw, slow
        glider: {
            __special__: 'animated',
            duration: 32,
            all: [[16, 24], [17, 24], [18, 24], [19, 24], [20, 24], [21, 24], [22, 24], [23, 24]],
        },
        // ccw, fast
        bug: {
            __special__: 'animated',
            duration: 16,
            all: [[23, 24], [22, 24], [21, 24], [20, 24], [19, 24], [18, 24], [17, 24], [16, 24]],
        },
        ball: {
            __special__: 'animated',
            duration: 16,
            all: [[16, 24], [20, 24]],
        },
        teeth_timid: {
            __special__: 'animated',
            duration: 16,
            all: [[16, 24], [25, 24]],
        },
        // ccw, slow
        fireball: {
            __special__: 'animated',
            duration: 32,
            all: [[23, 24], [22, 24], [21, 24], [20, 24], [19, 24], [18, 24], [17, 24], [16, 24]],
        },
        // cw, fast
        paramecium: {
            __special__: 'animated',
            duration: 16,
            all: [[16, 24], [17, 24], [18, 24], [19, 24], [20, 24], [21, 24], [22, 24], [23, 24]],
        },
        walker: {
            __special__: 'animated',
            duration: 16,
            all: [[24, 24], [25, 24]],
        },
    },
    fireball: {
        __special__: 'animated',
        duration: 12,
        cc2_duration: 4,
        all: [[16, 25], [17, 25], [18, 25], [19, 25]],
    },
    floor_mimic: {
        __special__: 'perception',
        modes: new Set(['palette', 'editor', 'xray']),
        hidden: [0, 2],
        revealed: [16, 26],
    },
    ball: {
        __special__: 'animated',
        global: false,
        duration: 0.5,
        cc2_duration: 1,
        idle_frame_index: 2,
        // appropriately, this animation ping-pongs
        all: [[27, 24], [28, 24], [29, 24], [30, 24], [31, 24], [30, 24], [29, 24], [28, 24]],
    },
    rolling_ball: {
        __special__: 'animated',
        global: false,
        duration: 1,
        north: [[27, 25], [28, 25], [26, 26], [26, 26], [26, 26], [24, 25], [25, 25], [26, 25]],
        east: [[24, 26], [25, 26], [26, 26], [26, 26], [26, 26], [27, 26], [28, 26], [26, 25]],
        south: [[25, 25], [24, 25], [26, 26], [26, 26], [26, 26], [28, 25], [27, 25], [26, 25]],
        west: [[28, 26], [27, 26], [26, 26], [26, 26], [26, 26], [25, 26], [24, 26], [26, 25]],
    },
    dynamite_lit: {
        __special__: 'visual-state',
        0: [27, 27],
        1: [28, 27],
        2: [29, 27],
        3: [30, 27],
        4: [31, 27],
    },

    // VFX
    explosion: [[16, 28], [17, 28], [18, 28], [19, 28]],
    explosion_nb: [[16, 28], [17, 28], [18, 28], [19, 28]],
    splash: [[16, 29], [17, 29], [18, 29], [19, 29]],
    splash_nb: [[16, 29], [17, 29], [18, 29], [19, 29]],
    splash_slime: [[16, 30], [17, 30], [18, 30], [19, 30]],
    fall: [[16, 31], [17, 31], [18, 31], [19, 31]],
    transmogrify_flash: [[20, 28], [21, 28], [24, 28], [23, 28], [24, 28], [25, 28], [26, 28], [27, 28]],
    teleport_flash: [[20, 29], [21, 29], [22, 29], [23, 29]],
    puff: [[24, 29], [25, 29], [26, 29], [27, 29]],
    player1_exit: [[28, 28], [29, 28], [30, 28], [31, 28]],
    player2_exit: [[28, 29], [29, 29], [30, 29], [31, 29]],
    resurrection: [[28, 30], [29, 30], [30, 30], [31, 30]],
};

export const TILESET_LAYOUTS = {
    // MS layout, either abbreviated or full
    'tw-static': TILE_WORLD_TILESET_LAYOUT,
    // "Large" (and dynamic, so not actually defined here) TW layout
    'tw-animated': {
        '#ident': 'tw-animated',
        '#name': "Tile World (animated)",
        '#supported-versions': new Set(['cc1']),
        ..._omit_custom_lexy_vfx,
    },
    cc2: CC2_TILESET_LAYOUT,
    lexy: LL_TILESET_LAYOUT,
};


// Bundle of arguments for drawing a tile, containing some standard state about the game
export class DrawPacket {
    constructor(perception = 'normal', hide_logic = false, clock = 0, update_progress = 0, update_rate = 3) {
        this.perception = perception;
        this.hide_logic = hide_logic && perception === 'normal';
        this.use_cc2_anim_speed = false;
        this.clock = clock;
        this.update_progress = update_progress;
        this.update_rate = update_rate;
        this.show_facing = false;
        // this.x
        // this.y
    }

    // Draw a tile (or region) from the tileset.  The caller is presumed to know where the tile
    // goes, so the arguments here are only about how to find the tile on the sheet.
    // tx, ty: Tile coordinates (from the tileset, measured in cells)
    // mx, my, mw, mh: Optional mask to use for drawing a subset of a tile (or occasionally tiles)
    // mdx, mdy: Where to draw the masked part; defaults to drawing aligned with the tile
    blit(tx, ty, mx = 0, my = 0, mw = 1, mh = mw, mdx = mx, mdy = my) {}

    // Same, but do not interpolate the position of an actor in motion; always draw it exactly in
    // the cell it claims to be in
    blit_aligned(tx, ty, mx = 0, my = 0, mw = 1, mh = mw, mdx = mx, mdy = my) {}
}

export class Tileset {
    constructor(image, layout, size_x, size_y) {
        this.image = image;
        this.layout = layout;
        this.size_x = size_x;
        this.size_y = size_y;
    }

    // Draw to a canvas using tile coordinates
    blit_to_canvas(ctx, sx, sy, dx, dy, w = 1, h = w) {
        ctx.drawImage(
            this.image,
            sx * this.size_x, sy * this.size_y, w * this.size_x, h * this.size_y,
            dx * this.size_x, dy * this.size_y, w * this.size_x, h * this.size_y);
    }

    // Everything from here on uses the DrawPacket API

    draw(tile, packet) {
        this.draw_type(tile.type.name, tile, packet);
    }

    // Draws a tile type, given by name.  Passing in a tile is optional, but
    // without it you'll get defaults.
    draw_type(name, tile, packet) {
        let drawspec = this.layout[name];
        if (drawspec === undefined) {
            // This is just missing
            console.error(`Don't know how to draw tile type ${name}!`);
            return;
        }

        this.draw_drawspec(drawspec, name, tile, packet);

        if (packet.show_facing) {
            this._draw_facing(name, tile, packet);
        }
    }

    // Draw the facing direction of a tile (generally used by the editor)
    _draw_facing(name, tile, packet) {
        if (! (tile && tile.direction && TILE_TYPES[name].is_actor))
            return;

        // These are presumed to be half-size tiles
        let drawspec = this.layout['#editor-arrows'];
        if (! drawspec)
            return;

        let coords = drawspec[tile.direction];
        let dirinfo = DIRECTIONS[tile.direction];

        packet.blit(
            ...coords, 0, 0, 0.5, 0.5,
            0.25 + dirinfo.movement[0] * 0.25,
            0.25 + dirinfo.movement[1] * 0.25);
    }

    // Draw a "standard" drawspec, which is either:
    // - a single tile: [x, y]
    // - an animation: [[x0, y0], [x1, y1], ...]
    // - a directional tile: { north: T, east: T, ... } where T is either of the above
    _draw_standard(drawspec, name, tile, packet) {
        // If we have an object, it must be a table of directions
        let coords = drawspec;
        if (!(coords instanceof Array)) {
            coords = coords[tile?.render_direction ?? tile?.direction ?? 'south'];
        }

        // Any animation not using the 'animated' special is a dedicated animation tile (like an
        // explosion or splash) and just plays over the course of its lifetime
        if (coords[0] instanceof Array) {
            if (tile && tile.movement_speed) {
                let p = tile.movement_progress(packet.update_progress, packet.update_rate);
                // XXX don't like needing this `max` again but a negative p showed up after an undo (cooldown == speed)
                coords = coords[Math.floor(Math.max(0, p) * coords.length)];
            }
            else  {
                coords = coords[0];
            }
        }

        packet.blit(coords[0], coords[1]);
    }

    _draw_animated(drawspec, name, tile, packet) {
        let frames;
        if (drawspec.all) {
            frames = drawspec.all;
        }
        else {
            frames = drawspec[tile?.render_direction ?? tile?.direction ?? 'south'];
        }

        let is_global = drawspec.global ?? true;
        let duration = drawspec.duration;
        if (packet.use_cc2_anim_speed && drawspec.cc2_duration) {
            duration = drawspec.cc2_duration;
        }

        let frame;
        if (is_global) {
            // This tile animates on a global timer, looping every 'duration' frames
            let p = packet.clock * 3 / duration;
            // Lilypads bob at pseudo-random.  CC2 has a much simpler approach to this, but it looks
            // kind of bad with big patches of lilypads.  It's 202x so let's use that CPU baby
            if (drawspec.positionally_hashed) {
                // This is the 32-bit FNV-1a hash algorithm, if you're curious
                let h = 0x811c9dc5;
                h = Math.imul(h ^ packet.x, 0x01000193);
                h = Math.imul(h ^ packet.y, 0x01000193);
                p += (h & 63) / 64;
            }
            frame = frames[Math.floor(p % 1 * frames.length)];
        }
        else if (tile && tile.movement_speed) {
            // This tile is in motion and its animation runs 'duration' times each move.
            let p = tile.movement_progress(packet.update_progress, packet.update_rate);
            duration = duration ?? 1;
            if (duration < 1) {
                // The 'duration' may be fractional; for example, the player's walk cycle is two
                // steps, so its duration is 0.5 and each move plays half of the full animation.
                // Consider: p, the current progress through the animation, is in [0, 1).  To play
                // the first half, we want [0, 0.5); to play the second half, we want [0.5, 1).
                // Thus we add an integer in [0, 2) to offset us into which half to play, then
                // divide by 2 to renormalize.  Which half to use is determined by when the
                // animation /started/, as measured in animation lengths.
                let start_time = (packet.clock * 3 / tile.movement_speed) - p;
                // Rounding smooths out float error (assuming the framerate never exceeds 1000)
                let chunk_size = 1 / duration;
                let segment = Math.floor(Math.round(start_time * 1000) / 1000 % chunk_size);
                // It's possible for the segment to be negative here in very obscure cases (notably,
                // if an actor in Lynx mode starts out on an open trap, it'll be artificially
                // accelerated and will appear to have started animating before the first tic)
                if (segment < 0) {
                    segment += chunk_size;
                }
                p = (p + segment) * duration;
            }
            else if (duration > 1) {
                // Larger durations are much easier; just multiply and mod.
                // (Note that large fractional durations like 2.5 will not work.)
                p = p * duration % 1;
            }
            frame = frames[Math.floor(p * frames.length)];
        }
        else {
            // This is an actor that's not moving, so use the idle frame
            frame = drawspec.idle ?? frames[drawspec.idle_frame_index ?? 0];
        }

        if (drawspec.triple) {
            // Lynx-style big splashes and explosions
            packet.blit(...frame, 0, 0, 3, 3, -1, -1);
        }
        else {
            packet.blit(...frame);
        }
    }

    // Simple overlaying used for green/purple toggle tiles and doppelgangers.  Draw the base (a
    // type name or drawspec), then draw the overlay (either a type name or a regular draw spec).
    _draw_overlay(drawspec, name, tile, packet) {
        // TODO chance of infinite recursion here
        if (typeof drawspec.base === 'string') {
            this.draw_type(drawspec.base, tile, packet);
        }
        else {
            this.draw_drawspec(drawspec.base, name, tile, packet);
        }
        if (typeof drawspec.overlay === 'string') {
            this.draw_type(drawspec.overlay, tile, packet);
        }
        else {
            this.draw_drawspec(drawspec.overlay, name, tile, packet);
        }
    }

    // Scrolling region, used for force floors
    _draw_scroll(drawspec, name, tile, packet) {
        let [x, y] = drawspec.base;
        let duration = drawspec.duration;
        if (packet.use_cc2_anim_speed && drawspec.cc2_duration) {
            duration = drawspec.cc2_duration;
        }
        x += drawspec.scroll_region[0] * (packet.clock * 3 / duration % 1);
        y += drawspec.scroll_region[1] * (packet.clock * 3 / duration % 1);
        // Round to pixels
        x = Math.floor(x * this.size_x + 0.5) / this.size_x;
        y = Math.floor(y * this.size_y + 0.5) / this.size_y;
        packet.blit(x, y);
    }

    _draw_wires(drawspec, name, tile, packet) {
        // This /should/ match CC2's draw order exactly, based on experimentation
        // TODO circuit block with a lightning bolt is always powered
        // TODO circuit block in motion doesn't inherit cell's power
        if (tile && tile.wire_directions && ! packet.hide_logic) {
            // Draw the base tile
            packet.blit(drawspec.base[0], drawspec.base[1]);

            let mode = tile.wire_propagation_mode ?? TILE_TYPES[name].wire_propagation_mode;
            let is_crossed = drawspec.wired_cross && (
                mode === 'cross' || (mode === 'autocross' && tile.wire_directions === 0x0f));
            if (is_crossed && tile.powered_edges && tile.powered_edges !== 0x0f) {
                // For crossed wires with different power, order matters; horizontal is on top
                // TODO note that this enforces the CC2 wire order
                let vert = tile.powered_edges & 0x05, horiz = tile.powered_edges & 0x0a;
                this._draw_fourway_power_underlay(
                    vert ? this.layout['#powered'] : this.layout['#unpowered'], 0x05, packet);
                this._draw_fourway_power_underlay(
                    horiz ? this.layout['#powered'] : this.layout['#unpowered'], 0x0a, packet);
            }
            else {
                this._draw_fourway_tile_power(tile, tile.wire_directions, packet);
            }
            // Then draw the wired tile on top of it all
            this.draw_drawspec(is_crossed ? drawspec.wired_cross : drawspec.wired, name, tile, packet);

            if (drawspec.wired_cross && mode === 'none') {
                // Extremely weird case: this tile was /designed/ to be drawn crossed, but something
                // has happened and it doesn't propagate current at all.  (This is usually because
                // e.g. a red teleporter was destroyed, leaving floor in a weird mode.)
                // Show the wires are disconnected by drawing a chunk of the base tile in the center
                packet.blit(drawspec.base[0], drawspec.base[1], 0.375, 0.375, 0.25, 0.25);
            }
        }
        else {
            // There's no wiring here, so just draw the base and then draw the wired part on top
            // as normal.  If the wired part is optional (as is the case for flooring in the CC2
            // tileset), draw the base as normal instead.
            if (drawspec.is_wired_optional) {
                this.draw_drawspec(drawspec.base, name, tile, packet);
            }
            else {
                packet.blit(drawspec.base[0], drawspec.base[1]);
                this.draw_drawspec(drawspec.wired, name, tile, packet);
            }
        }

        // Wired tiles may also have tunnels, drawn on top of everything else
        if (tile && tile.wire_tunnel_directions && ! packet.hide_logic) {
            let tunnel_coords = this.layout['#wire-tunnel'];
            let tunnel_width = 6/32;
            let tunnel_length = 12/32;
            let tunnel_offset = (1 - tunnel_width) / 2;
            if (tile.wire_tunnel_directions & DIRECTIONS['north'].bit) {
                packet.blit(tunnel_coords[0], tunnel_coords[1],
                    tunnel_offset, 0, tunnel_width, tunnel_length);
            }
            if (tile.wire_tunnel_directions & DIRECTIONS['south'].bit) {
                packet.blit(tunnel_coords[0], tunnel_coords[1],
                    tunnel_offset, 1 - tunnel_length, tunnel_width, tunnel_length);
            }
            if (tile.wire_tunnel_directions & DIRECTIONS['west'].bit) {
                packet.blit(tunnel_coords[0], tunnel_coords[1],
                    0, tunnel_offset, tunnel_length, tunnel_width);
            }
            if (tile.wire_tunnel_directions & DIRECTIONS['east'].bit) {
                packet.blit(tunnel_coords[0], tunnel_coords[1],
                    1 - tunnel_length, tunnel_offset, tunnel_length, tunnel_width);
            }
        }
    }

    _draw_fourway_tile_power(tile, wires, packet) {
        // Draw the unpowered tile underneath, if any edge is unpowered (and in fact if /none/ of it
        // is powered then we're done here)
        let powered = (tile.powered_edges ?? 0) & wires;
        if (powered !== tile.wire_directions) {
            this._draw_fourway_power_underlay(this.layout['#unpowered'], wires, packet);
            if (powered === 0)
                return;
        }

        this._draw_fourway_power_underlay(this.layout['#powered'], powered, packet);
    }

    _draw_fourway_power_underlay(drawspec, bits, packet) {
        // Draw the part as a single rectangle, initially just a small dot in the center, but
        // extending out to any edge that has a bit present
        let wire_radius = this.layout['#wire-width'] / 2;
        let x0 = 0.5 - wire_radius;
        let x1 = 0.5 + wire_radius;
        let y0 = 0.5 - wire_radius;
        let y1 = 0.5 + wire_radius;
        if (bits & DIRECTIONS['north'].bit) {
            y0 = 0;
        }
        if (bits & DIRECTIONS['east'].bit) {
            x1 = 1;
        }
        if (bits & DIRECTIONS['south'].bit) {
            y1 = 1;
        }
        if (bits & DIRECTIONS['west'].bit) {
            x0 = 0;
        }
        packet.blit(drawspec[0], drawspec[1], x0, y0, x1 - x0, y1 - y0);
    }


    _draw_letter(drawspec, name, tile, packet) {
        this.draw_drawspec(drawspec.base, name, tile, packet);

        let glyph = tile ? tile.overlaid_glyph : "?";
        if (drawspec.letter_glyphs[glyph]) {
            let [x, y] = drawspec.letter_glyphs[glyph];
            // XXX size is hardcoded here, but not below, meh
            packet.blit(x, y, 0, 0, 0.5, 0.5, 0.25, 0.25);
        }
        else {
            // Look for a range
            let u = glyph.charCodeAt(0);
            for (let rangedef of drawspec.letter_ranges) {
                if (rangedef.range[0] <= u && u < rangedef.range[1]) {
                    let t = u - rangedef.range[0];
                    let x = rangedef.x0 + rangedef.w * (t % rangedef.columns);
                    let y = rangedef.y0 + rangedef.h * Math.floor(t / rangedef.columns);
                    packet.blit(x, y, 0, 0, rangedef.w, rangedef.h,
                        (1 - rangedef.w) / 2, (1 - rangedef.h) / 2);
                    break;
                }
            }
        }
    }

    _draw_thin_walls(drawspec, name, tile, packet) {
        let edges = tile ? tile.edges : 0x0f;

        // TODO it would be /extremely/ cool to join corners diagonally, but i can't do that without
        // access to the context, which defeats the whole purpose of this scheme.  damn
        if (edges & DIRECTIONS['north'].bit) {
            packet.blit(...drawspec.thin_walls_ns, 0, 0, 1, 0.5);
        }
        if (edges & DIRECTIONS['east'].bit) {
            packet.blit(...drawspec.thin_walls_ew, 0.5, 0, 0.5, 1);
        }
        if (edges & DIRECTIONS['south'].bit) {
            packet.blit(...drawspec.thin_walls_ns, 0, 0.5, 1, 0.5);
        }
        if (edges & DIRECTIONS['west'].bit) {
            packet.blit(...drawspec.thin_walls_ew, 0, 0, 0.5, 1);
        }
    }

    _draw_thin_walls_cc1(drawspec, name, tile, packet) {
        let edges = tile ? tile.edges : 0x0f;

        // This is kinda best-effort since the tiles are not designed to combine
        if ((edges & DIRECTIONS['south'].bit) && (edges & DIRECTIONS['east'].bit)) {
            packet.blit(...drawspec.southeast);
        }
        else if (edges & DIRECTIONS['south'].bit) {
            packet.blit(...drawspec.south);
        }
        else if (edges & DIRECTIONS['east'].bit) {
            packet.blit(...drawspec.east);
        }

        if (edges & DIRECTIONS['north'].bit) {
            packet.blit(...drawspec.north);
        }

        if (edges & DIRECTIONS['west'].bit) {
            packet.blit(...drawspec.west);
        }
    }

    _draw_bomb_fuse(drawspec, name, tile, packet) {
        // Draw the base bomb
        this.draw_drawspec(drawspec.bomb, name, tile, packet);

        // The fuse is made up of four quarter-tiles and animates...  um...  at a rate.  I cannot
        // tell.  I have spent over an hour poring over this and cannot find a consistent pattern.
        // It might be random!  I'm gonna say it loops every 0.3 seconds = 18 frames, so 4.5 frames
        // per cel, I guess.  No one will know.  (But...  I'll know.)
        // Also it's drawn in the upper right, that's important.
        let cel = Math.floor(packet.clock / 0.3 * 4) % 4;
        packet.blit(...drawspec.fuse, 0.5 * (cel % 2), 0.5 * Math.floor(cel / 2), 0.5, 0.5, 0.5, 0);
    }

    // Frame blocks have an arrow overlay
    _draw_arrows(drawspec, name, tile, packet) {
        this.draw_drawspec(drawspec.base, name, tile, packet);

        if (tile && tile.arrows) {
            let [x, y] = drawspec.arrows;
            let x0 = 0.25, y0 = 0.25, x1 = 0.75, y1 = 0.75;
            if (tile.arrows.has('north')) {
                y0 = 0;
            }
            if (tile.arrows.has('east')) {
                x1 = 1;
            }
            if (tile.arrows.has('south')) {
                y1 = 1;
            }
            if (tile.arrows.has('west')) {
                x0 = 0;
            }
            packet.blit(x, y, x0, y0, x1 - x0, y1 - y0);
        }
    }

    _draw_visual_state(drawspec, name, tile, packet) {
        // Apply custom per-type visual states
        // Note that these accept null, too, and return a default
        let state = TILE_TYPES[name].visual_state(tile);
        // If it's a string, that's an alias for another state
        if (typeof drawspec[state] === 'string') {
            state = drawspec[state];
        }
        if (! drawspec[state]) {
            console.warn("No such state", state, "for tile", name, tile);
        }

        this.draw_drawspec(drawspec[state], name, tile, packet);
    }

    _draw_double_size_monster(drawspec, name, tile, packet) {
        // CC2 and Lynx have double-size art for blobs and walkers that spans the tile they're
        // moving from AND the tile they're moving into.
        // CC2 also has an individual 1×1 static tile, used in all four directions.
        if ((! tile || ! tile.movement_speed) && drawspec.base) {
            this.draw_drawspec(drawspec.base, name, tile, packet);
            return;
        }

        // CC2 only supports horizontal and vertical moves, not all four directions.  The other two
        // directions are the animations played in reverse.  TW's large layout supports all four.
        let direction = tile?.render_direction ?? tile?.direction ?? 'south';
        let axis_cels = drawspec[direction];
        let w = 1, h = 1, x = 0, y = 0, sx = 0, sy = 0, reverse = false;
        if (direction === 'north') {
            if (! axis_cels) {
                axis_cels = drawspec.vertical;
                reverse = true;
            }
            h = 2;
        }
        else if (direction === 'south') {
            if (! axis_cels) {
                axis_cels = drawspec.vertical;
            }
            h = 2;
            y = -1;
            sy = -1;
        }
        else if (direction === 'west') {
            if (! axis_cels) {
                axis_cels = drawspec.horizontal;
                reverse = true;
            }
            w = 2;
        }
        else if (direction === 'east') {
            if (! axis_cels) {
                axis_cels = drawspec.horizontal;
            }
            w = 2;
            x = -1;
            sx = -1;
        }

        let index;
        if (tile && tile.movement_speed) {
            let p = tile.movement_progress(packet.update_progress, packet.update_rate);
            index = Math.floor(p * axis_cels.length);
        }
        else {
            index = drawspec.idle_frame_index ?? 0;
        }
        let cel = reverse ? axis_cels[axis_cels.length - index - 1] : axis_cels[index];

        if (cel === null) {
            // null means use the 1x1 "base" tile instead
            packet.blit_aligned(...drawspec.base, 0, 0, 1, 1, sx, sy);
        }
        else {
            packet.blit_aligned(...cel, 0, 0, w, h, x, y);
        }
    }

    _draw_rover(drawspec, name, tile, packet) {
        // Rovers draw fairly normally (with their visual_state giving the monster they're copying),
        // but they also have an overlay indicating their direction
        let state = tile ? tile.type.visual_state(tile) : 'inert';
        this.draw_drawspec(drawspec[state], name, tile, packet);

        if (! tile)
            return;

        // The direction overlay is one of four quarter-tiles, drawn about in the center of the
        // rover but shifted an eighth of a tile in the direction in question
        let overlay_position = this._rotate(tile.direction, 0.25, 0.125, 0.75, 0.625);
        let index = {north: 0, east: 1, west: 2, south: 3}[tile.render_direction ?? tile.direction];
        if (index === undefined)
            return;
        packet.blit(
            ...drawspec.direction,
            0.5 * (index % 2), 0.5 * Math.floor(index / 2), 0.5, 0.5,
            overlay_position[0], overlay_position[1]);
    }

    _draw_logic_gate(drawspec, name, tile, packet) {
        // Layer 1: wiring state
        // Always draw the unpowered wire base
        let unpowered_coords = this.layout['#unpowered'];
        let powered_coords = this.layout['#powered'];
        packet.blit(...unpowered_coords);
        if (tile && tile.cell) {
            // What goes on top varies a bit...
            let r = this.layout['#wire-width'] / 2;
            if (['not', 'diode', 'delay', 'battery', 'counter'].includes(tile.gate_type)) {
                this._draw_fourway_tile_power(tile, 0x0f, packet);
            }
            else {
                if (tile.powered_edges & DIRECTIONS[tile.direction].bit) {
                    // Output (on top)
                    let [x0, y0, x1, y1] = this._rotate(tile.direction, 0.5 - r, 0, 0.5 + r, 0.5);
                    packet.blit(powered_coords[0], powered_coords[1], x0, y0, x1 - x0, y1 - y0);
                }
                if (tile.powered_edges & DIRECTIONS[DIRECTIONS[tile.direction].right].bit) {
                    // Right input, which includes the middle
                    // This actually covers the entire lower right corner, for bent inputs.
                    let [x0, y0, x1, y1] = this._rotate(tile.direction, 0.5 - r, 0.5 - r, 1, 1);
                    packet.blit(powered_coords[0], powered_coords[1], x0, y0, x1 - x0, y1 - y0);
                }
                if (tile.powered_edges & DIRECTIONS[DIRECTIONS[tile.direction].left].bit) {
                    // Left input, which does not include the middle
                    // This actually covers the entire lower left corner, for bent inputs.
                    let [x0, y0, x1, y1] = this._rotate(tile.direction, 0, 0.5 - r, 0.5 - r, 1);
                    packet.blit(powered_coords[0], powered_coords[1], x0, y0, x1 - x0, y1 - y0);
                }
            }
        }

        // Layer 2: the tile itself
        this.draw_drawspec(drawspec.logic_gate_tiles[tile.gate_type], name, tile, packet);

        // Layer 3: counter number
        if (tile.gate_type === 'counter') {
            let nums = drawspec.counter_numbers;
            packet.blit(
                nums.x, nums.y, tile.memory * nums.width, 0,
                nums.width, nums.height, (1 - nums.width) / 2, (1 - nums.height) / 2);
        }
    }

    _draw_railroad(drawspec, name, tile, packet) {
        this.draw_drawspec(drawspec.base, name, tile, packet);

        // FIXME what do i draw if there's no tile?
        let part_order = ['ne', 'se', 'sw', 'nw', 'ew', 'ns'];
        let visible_parts = [];
        let topmost_part = null;
        for (let [i, part] of part_order.entries()) {
            if (tile && (tile.tracks & (1 << i))) {
                if (tile.track_switch === i) {
                    topmost_part = part;
                }
                visible_parts.push(part);
            }
        }

        let has_switch = (tile && tile.track_switch !== null);
        for (let part of visible_parts) {
            this.draw_drawspec(drawspec.railroad_ties[part], name, tile, packet);
        }
        let tracks = has_switch ? drawspec.railroad_inactive : drawspec.railroad_active;
        for (let part of visible_parts) {
            if (part !== topmost_part) {
                this.draw_drawspec(tracks[part], name, tile, packet);
            }
        }

        if (topmost_part) {
            this.draw_drawspec(drawspec.railroad_active[topmost_part], name, tile, packet);
        }
        if (has_switch) {
            this.draw_drawspec(drawspec.railroad_switch, name, tile, packet);
        }
    }
    
    _draw_encased_item(drawspec, name, tile, packet) {
        //draw the encased item
        if (tile !== null && tile.encased_item !== undefined && tile.encased_item !== null) {
            this.draw_drawspec(this.layout[tile.encased_item], tile.encased_item, null, packet);
        }
        //then draw the glass block
        this._draw_standard(drawspec.base, name, tile, packet);
    }
    

    draw_drawspec(drawspec, name, tile, packet) {
        if (drawspec === null)
            // This is explicitly never drawn (used for extra visual-only frills that don't exist in
            // some tilesets)
            return;
        if (drawspec.__special__) {
            if (drawspec.__special__ === 'animated') {
                this._draw_animated(drawspec, name, tile, packet);
            }
            else if (drawspec.__special__ === 'overlay') {
                this._draw_overlay(drawspec, name, tile, packet);
            }
            else if (drawspec.__special__ === 'scroll') {
                this._draw_scroll(drawspec, name, tile, packet);
            }
            else if (drawspec.__special__ === 'wires') {
                this._draw_wires(drawspec, name, tile, packet);
            }
            else if (drawspec.__special__ === 'letter') {
                this._draw_letter(drawspec, name, tile, packet);
            }
            else if (drawspec.__special__ === 'thin-walls') {
                this._draw_thin_walls(drawspec, name, tile, packet);
            }
            else if (drawspec.__special__ === 'thin-walls-cc1') {
                this._draw_thin_walls_cc1(drawspec, name, tile, packet);
            }
            else if (drawspec.__special__ === 'bomb-fuse') {
                this._draw_bomb_fuse(drawspec, name, tile, packet);
            }
            else if (drawspec.__special__ === 'arrows') {
                this._draw_arrows(drawspec, name, tile, packet);
            }
            else if (drawspec.__special__ === 'visual-state') {
                this._draw_visual_state(drawspec, name, tile, packet);
            }
            else if (drawspec.__special__ === 'double-size-monster') {
                this._draw_double_size_monster(drawspec, name, tile, packet);
            }
            else if (drawspec.__special__ === 'rover') {
                this._draw_rover(drawspec, name, tile, packet);
            }
            else if (drawspec.__special__ === 'perception') {
                if (drawspec.modes.has(packet.perception)) {
                    this.draw_drawspec(drawspec.revealed, name, tile, packet);
                }
                else {
                    this.draw_drawspec(drawspec.hidden, name, tile, packet);
                }
            }
            else if (drawspec.__special__ === 'logic-gate') {
                if (packet.hide_logic) {
                    this.draw_type('floor', tile, packet);
                }
                else {
                    this._draw_logic_gate(drawspec, name, tile, packet);
                }
            }
            else if (drawspec.__special__ === 'railroad') {
                this._draw_railroad(drawspec, name, tile, packet);
            }
            else if (drawspec.__special__ === 'encased_item') {
                this._draw_encased_item(drawspec, name, tile, packet);
            }
            else {
                console.error(`No such special ${drawspec.__special__} for ${name}`);
            }
            return;
        }

        this._draw_standard(drawspec, name, tile, packet);
    }

    _rotate(direction, x0, y0, x1, y1) {
        if (direction === 'east') {
            return [1 - y1, x0, 1 - y0, x1];
        }
        else if (direction === 'south') {
            return [1 - x1, 1 - y1, 1 - x0, 1 - y0];
        }
        else if (direction === 'west') {
            return [y0, 1 - x1, y1, 1 - x0];
        }
        else {
            return [x0, y0, x1, y1];
        }
    }
}


const TILE_WORLD_LARGE_TILE_ORDER = [
    'floor',
    'force_floor_n', 'force_floor_w', 'force_floor_s', 'force_floor_e', 'force_floor_all',
    'ice', 'ice_se', 'ice_sw', 'ice_ne', 'ice_nw',
    'gravel', 'dirt', 'water', 'fire', 'bomb', 'trap', 'thief_tools', 'hint',
    'button_blue', 'button_green', 'button_red', 'button_brown',
    'teleport_blue', 'wall',
    '#thin_walls/north', '#thin_walls/west', '#thin_walls/south', '#thin_walls/east', '#thin_walls/southeast',
    'fake_wall', 'green_floor', 'green_wall', 'popwall', 'cloner',
    'door_red', 'door_blue', 'door_yellow', 'door_green',
    'socket', 'exit', 'chip',
    'key_red', 'key_blue', 'key_yellow', 'key_green',
    'cleats', 'suction_boots', 'fire_boots', 'flippers',
    // Bogus tiles
    'bogus_exit_1', 'bogus_exit_2',
    'bogus_player_burned_fire', 'bogus_player_burned', 'bogus_player_win', 'bogus_player_drowned',
    'player1_swimming_n', 'player1_swimming_w', 'player1_swimming_s', 'player1_swimming_e',
    // Actors
    '#player1-moving', '#player1-pushing', 'dirt_block',
    'tank_blue', 'ball', 'glider', 'fireball', 'bug', 'paramecium', 'teeth', 'blob', 'walker',
    // Animations, which can be 3×3
    'splash', 'explosion', 'disintegrate',
];
export function parse_tile_world_large_tileset(canvas) {
    let ctx = canvas.getContext('2d');
    let tw = null;
    let layout = {
        ...TILESET_LAYOUTS['tw-animated'],
        player: {
            __special__: 'visual-state',
            normal: 'moving',
            blocked: 'pushing',
            moving: {},
            pushing: {},
            swimming: 'moving',
            // TODO in tile world, skating and forced both just slide the static sprite
            skating: 'moving',
            forced: 'moving',
            exited: 'normal',
            // FIXME really these should play to completion, like lynx...
            drowned: null,
            // slimed: n/a
            burned: null,
            exploded: null,
            failed: null,
            // fell: n/a
        },
        thin_walls: {
            __special__: 'thin-walls-cc1',
        },
    };
    let image_data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let px = image_data.data;  // 🙄

    let uses_alpha;
    let is_transparent;
    if (px[7] === 0) {
        uses_alpha = true;
        // FIXME does tile world actually support this?  and handle it like this?  probably find out
        is_transparent = i => {
            return px[i + 3] === 0;
        };
    }
    else {
        uses_alpha = false;
        let r = px[4];
        let g = px[5];
        let b = px[6];
        is_transparent = i => {
            return px[i] === r && px[i + 1] === g && px[i + 2] === b;
        };
    }

    // Scan out the rows first so we know them ahead of time
    let th = null;
    let prev_y = null;
    let row_heights = {};  // first row => height in tiles
    for (let y = 0; y < canvas.height; y++) {
        let i = y * canvas.width * 4;
        if (is_transparent(i))
            continue;

        if (prev_y !== null) {
            let row_height = y - prev_y - 1;  // fencepost
            if (th === null) {
                th = row_height;
                if (th < 4)
                    throw new Error(`Bad tile height ${th}, this may not be a TW large tileset`);
            }
            if (row_height % th !== 0) {
                console.warn("Tile height seems to be", th, "but row between", prev_y, "and", y,
                    "is not an integral multiple");
            }
            row_heights[prev_y] = row_height / th;
        }
        prev_y = y;
    }

    let i = 0;
    let t = 0;
    for (let y = 0; y < canvas.height; y++) {
        let is_divider_row = false;
        let prev_x = null;
        for (let x = 0; x < canvas.width; x++) {
            let trans = is_transparent(i);
            if (trans && ! uses_alpha) {
                px[i] = px[i + 1] = px[i + 2] = px[i + 3] = 0;
            }
            i += 4;

            if (x === 0) {
                is_divider_row = ! trans;
                prev_x = x;
                continue;
            }
            if (! (is_divider_row && ! trans))
                continue;
            if (t >= TILE_WORLD_LARGE_TILE_ORDER.length)
                continue;

            // This is an opaque pixel in a divider row, which marks the end of a tile
            if (tw === null) {
                tw = x - prev_x;
                if (tw < 4)
                    throw new Error(`Bad tile width ${tw}, this may not be a TW large tileset`);
            }

            let name = TILE_WORLD_LARGE_TILE_ORDER[t];
            let spec;
            let num_columns = (x - prev_x) / tw;
            let num_rows = row_heights[y];
            if (num_rows === 0 || num_columns === 0)
                throw new Error(`Bad row/column count (${num_rows}, ${num_columns}) at ${x}, ${y}`);
            let x0 = (prev_x + 1) / tw;
            let y0 = (y + 1) / th;
            if (num_rows === 1 && num_columns === 1) {
                spec = [x0, y0];
            }
            else if (59 <= t && t <= 71) {
                // Actors have special layouts, one of several options
                if (num_rows === 1 && num_columns === 2) {
                    // NS, EW
                    spec = {
                        north: [x0, y0],
                        south: [x0, y0],
                        east: [x0 + 1, y0],
                        west: [x0 + 1, y0],
                    };
                }
                else if (num_rows === 1 && num_columns === 4) {
                    // N, W, S, E
                    spec = {
                        north: [x0, y0],
                        west: [x0 + 1, y0],
                        south: [x0 + 2, y0],
                        east: [x0 + 3, y0],
                    };
                }
                else if (num_rows === 2 && num_columns === 1) {
                    // NS; EW
                    spec = {
                        north: [x0, y0],
                        south: [x0, y0],
                        east: [x0, y0 + 1],
                        west: [x0, y0 + 1],
                    };
                }
                else if (num_rows === 2 && num_columns === 2) {
                    // N, W; S, E
                    spec = {
                        north: [x0, y0],
                        west: [x0 + 1, y0],
                        south: [x0, y0 + 1],
                        east: [x0 + 1, y0 + 1],
                    };
                }
                else if (num_rows === 2 && num_columns === 8) {
                    // N N N N, W W W W; S S S S, E E E E
                    spec = {
                        __special__: 'animated',
                        // FIXME when global?
                        global: false,
                        duration: 1,
                        idle_frame_index: 1,
                        north: [[x0, y0], [x0 + 1, y0], [x0 + 2, y0], [x0 + 3, y0]],
                        west: [[x0 + 4, y0], [x0 + 5, y0], [x0 + 6, y0], [x0 + 7, y0]],
                        south: [[x0, y0 + 1], [x0 + 1, y0 + 1], [x0 + 2, y0 + 1], [x0 + 3, y0 + 1]],
                        east: [[x0 + 4, y0 + 1], [x0 + 5, y0 + 1], [x0 + 6, y0 + 1], [x0 + 7, y0 + 1]],
                    };
                }
                else if (num_rows === 2 && num_columns === 16) {
                    // Double-tile arranged as:
                    // NNNN SSSS WWWWWWWW
                    // NNNN SSSS EEEEEEEE
                    spec = {
                        __special__: 'double-size-monster',
                        idle_frame_index: 3,
                        north: [[x0, y0], [x0 + 1, y0], [x0 + 2, y0], [x0 + 3, y0]],
                        south: [[x0 + 4, y0], [x0 + 5, y0], [x0 + 6, y0], [x0 + 7, y0]],
                        west: [[x0 + 8, y0], [x0 + 10, y0], [x0 + 12, y0], [x0 + 14, y0]],
                        east: [[x0 + 8, y0 + 1], [x0 + 10, y0 + 1], [x0 + 12, y0 + 1], [x0 + 14, y0 + 1]],
                    };
                }
                else {
                    throw new Error(`Invalid layout for ${name}: ${num_columns} tiles wide by ${num_rows} tiles tall`);
                }
            }
            else if (t >= 72) {
                // One of the explosion animations; should be a single row, must be 6 or 12 frames,
                // BUT is allowed to be triple size
                spec = {
                    __special__: 'animated',
                    global: false,
                    duration: 1,
                    all: [],
                };
                for (let f = 0; f < num_columns; f += num_rows) {
                    spec['all'].push([x0 + f, y0]);
                }

                if (num_rows === 3) {
                    spec.triple = true;
                }
            }
            else {
                // Everyone else is a static tile, automatically animated
                // TODO enforce only one row
                spec = {
                    __special__: 'animated',
                    duration: 3 * num_columns,  // one tic per frame
                    all: [],
                };
                for (let f = 0; f < num_columns; f++) {
                    spec['all'].push([x0 + f, y0]);
                }
            }

            // Handle some special specs
            if (name === '#player1-moving') {
                layout['player']['moving'] = spec;
            }
            else if (name === '#player1-pushing') {
                layout['player']['pushing'] = spec;
            }
            else if (name.startsWith('#thin_walls/')) {
                let direction = name.match(/\/(\w+)$/)[1];
                layout['thin_walls'][direction] = spec;

                // Erase the floor
                for (let f = 0; f < num_columns; f += 1) {
                    erase_thin_wall_floor(
                        image_data, prev_x + 1 + f * tw, y + 1,
                        layout['floor'][0] * tw, layout['floor'][1] * th,
                        tw, th);
                }
            }
            else {
                layout[name] = spec;

                if (name === 'floor') {
                    layout['wall_appearing'] = spec;
                    layout['wall_invisible'] = spec;
                }
                else if (name === 'wall') {
                    // This is specifically /invisible/ when you have the xray glasses
                    layout['wall_invisible_revealed'] = {
                        __special__: 'perception',
                        modes: new Set(['xray']),
                        hidden: spec,
                        revealed: null,
                    };
                }
                else if (name === 'fake_wall') {
                    layout['fake_floor'] = spec;
                }
                else if (name === 'splash' || name === 'explosion') {
                    let n = Math.floor(0.25 * spec['all'].length);
                    let cel = spec['all'][n];
                    if (spec.triple) {
                        cel = [cel[0] + 1, cel[1] + 1];
                    }
                    // TODO remove these sometime
                    if (name === 'splash') {
                        layout['player']['drowned'] = cel;
                    }
                    else if (name === 'explosion') {
                        layout['player']['burned'] = cel;
                        layout['player']['exploded'] = cel;
                        layout['player']['failed'] = cel;
                    }
                }
            }

            prev_x = x;
            t += 1;
        }
    }
    ctx.putImageData(image_data, 0, 0);

    // These are compat tiles, which need to have a fallback
    layout['popwall2'] = layout['popwall'];
    layout['dormant_bomb'] = layout['bomb'];

    return new Tileset(canvas, layout, tw, th);
}

// MSCC repeats all the actor columns three times: once for an actor on top of normal floor (which
// we don't use because we expect everything transparent), once for the actor on a solid background,
// and once for a mask used to cut it out.  Combine (3) with (2) and write it atop (1).
function apply_mscc_mask(canvas) {
    let ctx = canvas.getContext('2d');
    let image_data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let px = image_data.data;
    let tw = canvas.width / 13;
    let dest_x0 = tw * 4;
    let src_x0 = tw * 7;
    let mask_x0 = tw * 10;
    for (let y = 0; y < canvas.height; y++) {
        let dest_i = (y * canvas.width + dest_x0) * 4;
        let src_i = (y * canvas.width + src_x0) * 4;
        let mask_i = (y * canvas.width + mask_x0) * 4;
        for (let dx = 0; dx < tw * 3; dx++) {
            px[dest_i + 0] = px[src_i + 0];
            px[dest_i + 1] = px[src_i + 1];
            px[dest_i + 2] = px[src_i + 2];
            px[dest_i + 3] = px[mask_i];

            dest_i += 4;
            src_i += 4;
            mask_i += 4;
        }
    }

    // Resizing the canvas clears it, so do that first
    canvas.width = canvas.height / 16 * 7;
    ctx.putImageData(image_data, 0, 0);
}

// CC1 considered thin walls to be a floor tile, but CC2 makes them a transparent overlay.  LL is
// designed to work like CC2, so to make a CC1 tileset work, try erasing the floor out from under a
// thin wall.  This is extremely best-effort; it won't work very well if the wall has a shadow or
// happens to share some pixels with the floor below.
function erase_thin_wall_floor(image_data, wall_x0, wall_y0, floor_x0, floor_y0, tile_width, tile_height) {
    let px = image_data.data;
    for (let dy = 0; dy < tile_height; dy++) {
        let wall_i = ((wall_y0 + dy) * image_data.width + wall_x0) * 4;
        let floor_i = ((floor_y0 + dy) * image_data.width + floor_x0) * 4;
        for (let dx = 0; dx < tile_width; dx++) {
            if (px[wall_i + 3] > 0 && px[wall_i] === px[floor_i] &&
                px[wall_i + 1] === px[floor_i + 1] && px[wall_i + 2] === px[floor_i + 2])
            {
                px[wall_i + 3] = 0;
            }
            wall_i += 4;
            floor_i += 4;
        }
    }
}
function erase_mscc_thin_wall_floors(image_data, layout, tw, th) {
    let floor_spec = layout['floor'];
    let floor_x = floor_spec[0] * tw;
    let floor_y = floor_spec[1] * th;
    for (let direction of ['north', 'south', 'east', 'west', 'southeast']) {
        let spec = layout['thin_walls'][direction];
        erase_thin_wall_floor(image_data, spec[0] * tw, spec[1] * th, floor_x, floor_y, tw, th);
    }
}

function erase_tileset_background(image_data, layout) {
    let trans = layout['#transparent-color'];
    if (! trans)
        return;

    let px = image_data.data;
    if (trans.length === 2) {
        // Read the background color from a pixel
        let i = trans[0] + trans[1] * image_data.width;
        if (px[i + 3] === 0) {
            // Background is already transparent!
            return;
        }
        trans = [px[i], px[i + 1], px[i + 2], px[i + 3]];
    }

    for (let i = 0; i < image_data.width * image_data.height * 4; i += 4) {
        if (px[i] === trans[0] && px[i + 1] === trans[1] &&
            px[i + 2] === trans[2] && px[i + 3] === trans[3])
        {
            px[i] = 0;
            px[i + 1] = 0;
            px[i + 2] = 0;
            px[i + 3] = 0;
        }
    }

    return true;
}

export function infer_tileset_from_image(img, make_canvas) {
    // 99% of the time, we'll need a canvas anyway, so might as well create it now
    let canvas = make_canvas(img.naturalWidth, img.naturalHeight);
    let ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    // Determine the layout from the image dimensions.  Try the usual suspects first
    let aspect_ratio = img.naturalWidth / img.naturalHeight;
    // Special case: the "full" MS layout, which MSCC uses internally; it's the same layout as TW's
    // abbreviated one, but it needs its "mask" columns converted to a regular alpha channel
    if (aspect_ratio === 13/16) {
        apply_mscc_mask(canvas);
        aspect_ratio = 7/16;
    }

    for (let layout of Object.values(TILESET_LAYOUTS)) {
        if (! ('#dimensions' in layout))
            continue;
        let [w, h] = layout['#dimensions'];
        // XXX this assumes square tiles, but i have written mountains of code that doesn't!
        if (w / h === aspect_ratio) {
            let image_data = ctx.getImageData(0, 0, canvas.width, canvas.height);
            let did_anything = erase_tileset_background(image_data, layout);
            let tw = Math.floor(canvas.width / w);
            let th = Math.floor(canvas.height / h);
            if (layout['#ident'] === 'tw-static') {
                did_anything = true;
                erase_mscc_thin_wall_floors(image_data, layout, tw, th);
            }
            if (did_anything) {
                ctx.putImageData(image_data, 0, 0);
            }
            return new Tileset(canvas, layout, tw, th);
        }
    }

    // Anything else could be Tile World's "large" layout, which has no fixed dimensions
    return parse_tile_world_large_tileset(canvas);
}


// -------------------------------------------------------------------------------------------------
// Tileset conversion

// Copy tiles from a source image/canvas to a context.  The specs should be either a flat list
// (static coordinates) or a list of lists (animation).
function blit_tile_between_layouts(tileset, old_spec, new_spec, ctx) {
    // First fix the nesting to be consistent both ways
    if (! (old_spec[0] instanceof Array)) {
        old_spec = [old_spec];
    }
    if (! (new_spec[0] instanceof Array)) {
        new_spec = [new_spec];
    }

    // Now blit each frame of the new spec's animation, picking the closest frame from the original
    for (let [i, dest] of new_spec.entries()) {
        let src = old_spec[Math.floor(i * old_spec.length / new_spec.length)];
        tileset.blit_to_canvas(ctx, ...src, ...dest);
    }
}

const DOUBLE_SIZE_FALLBACK = {
    horizontal: 'east',
    vertical: 'south',
    north: 'vertical',
    south: 'vertical',
    west: 'horizontal',
    east: 'horizontal',
};

// TODO:
// bombs
// vfx collision
// no enemy underlay
// no green/purple block overlay
// wrong double-recessed wall, somehow??
// no turtles
// missing base for double-size
// missing editor cursors
// timid teeth uses different frames, huh.
// inactive red tele + trans are here and shouldn't be
// sliding player is drawn over walking player
// no wire icon
// no clone arrows
function convert_drawspec(tileset, old_spec, new_spec, ctx) {
    // If the new spec is null, the tile doesn't exist there, which is fine
    if (! new_spec)
        return;

    let recurse = (...keys) => {
        for (let key of keys) {
            convert_drawspec(tileset, old_spec[key], new_spec[key], ctx);
        }
    };

    if (new_spec instanceof Array && old_spec instanceof Array) {
        // Simple frames
        // TODO what if old_spec is *not* an array??
        blit_tile_between_layouts(tileset, old_spec, new_spec, ctx);
    }
    else if ((new_spec.__special__ ?? 'animated') === (old_spec.__special__ ?? 'animated')) {
        if (! new_spec.__special__ || new_spec.__special__ === 'animated') {
            // Actor facings
            if (old_spec instanceof Array) {
                old_spec = {all: old_spec};
            }
            if (new_spec instanceof Array) {
                new_spec = {all: new_spec};
            }

            if (old_spec.all && new_spec.all) {
                recurse('all');
            }
            else if (! old_spec.all && ! new_spec.all) {
                recurse('north', 'south', 'east', 'west');
            }
            else if (old_spec.all && ! new_spec.all) {
                convert_drawspec(tileset, old_spec.all, new_spec.north, ctx);
                convert_drawspec(tileset, old_spec.all, new_spec.south, ctx);
                convert_drawspec(tileset, old_spec.all, new_spec.east, ctx);
                convert_drawspec(tileset, old_spec.all, new_spec.west, ctx);
            }
            else {  // ! old_spec.all && new_spec.all
                convert_drawspec(tileset, old_spec.south, new_spec.all, ctx);
            }
        }
        else if (new_spec.__special__ === 'arrows') {
            recurse('base', 'arrows');
        }
        else if (new_spec.__special__ === 'double-size-monster') {
            convert_drawspec(tileset, old_spec.base, new_spec.base, ctx);
            for (let [direction, fallback] of Object.entries(DOUBLE_SIZE_FALLBACK)) {
                convert_drawspec(
                    tileset, old_spec[direction] ?? old_spec[fallback], new_spec[direction], ctx);
            }
        }
        else if (new_spec.__special__ === 'letter') {
            recurse('base');
            // Technically this doesn't work for two layouts with letters laid out differently, but
            // no two such layouts exist, so, whatever
            for (let [glyph, new_coords] of Object.entries(new_spec.letter_glyphs)) {
                let old_coords = old_spec.letter_glyphs[glyph];
                tileset.blit_to_canvas(ctx, ...old_coords, ...new_coords, 0.5, 0.5);
            }
            for (let [i, new_range] of new_spec.letter_ranges.entries()) {
                let old_range = old_spec.letter_ranges[i];
                tileset.blit_to_canvas(ctx,
                    old_range.x0, old_range.y0, new_range.x0, new_range.y0,
                    new_range.columns * new_range.w,
                    Math.ceil((new_range.range[1] - new_range.range[0]) / new_range.columns) * new_range.h);
            }
        }
        else if (new_spec.__special__ === 'logic-gate') {
            tileset.blit_to_canvas(ctx,
                old_spec.counter_numbers.x, old_spec.counter_numbers.y,
                new_spec.counter_numbers.x, new_spec.counter_numbers.y,
                old_spec.counter_numbers.width * 12, old_spec.counter_numbers.height);
            for (let gate_type of ['not', 'and', 'or', 'xor', 'nand', 'latch-ccw', 'latch-cw', 'counter']) {
                convert_drawspec(
                    tileset, old_spec.logic_gate_tiles[gate_type], new_spec.logic_gate_tiles[gate_type], ctx);
            }
        }
        else if (new_spec.__special__ === 'perception') {
            recurse('hidden', 'revealed');
        }
        else if (new_spec.__special__ === 'railroad') {
            recurse('base', 'railroad_switch');
            for (let key of ['railroad_ties', 'railroad_inactive', 'railroad_active']) {
                for (let dir of ['ne', 'se', 'sw', 'nw', 'ew', 'ns']) {
                    convert_drawspec(tileset, old_spec[key][dir], new_spec[key][dir], ctx);
                }
            }
        }
        else if (new_spec.__special__ === 'rover') {
            // No one is ever gonna come up with an alternate rover so just copy enough to hit all
            // of CC2's frames
            recurse('glider', 'walker', 'direction');
        }
        else if (new_spec.__special__ === 'scroll') {
            let sx = old_spec.base[0] + Math.min(0, old_spec.scroll_region[0]);
            let sy = old_spec.base[1] + Math.min(0, old_spec.scroll_region[1]);
            let dx = new_spec.base[0] + Math.min(0, new_spec.scroll_region[0]);
            let dy = new_spec.base[1] + Math.min(0, new_spec.scroll_region[1]);
            tileset.blit_to_canvas(
                ctx, sx, sy, dx, dy,
                Math.abs(old_spec.scroll_region[0]) + 1,
                Math.abs(old_spec.scroll_region[1]) + 1);
        }
        else if (new_spec.__special__ === 'thin-walls') {
            recurse('thin_walls_ns', 'thin_walls_ew');
        }
        else if (new_spec.__special__ === 'thin-walls-cc1') {
            recurse('north', 'south', 'east', 'west', 'southeast');
        }
        else if (new_spec.__special__ === 'visual-state') {
            for (let key of Object.keys(new_spec)) {
                if (key === '__special__')
                    continue;

                let old_state = old_spec[key];
                let new_state = new_spec[key];
                // These might be strings, meaning aliases...
                if (typeof new_state === 'string') {
                    // New tileset doesn't have dedicated space for this, so nothing to do
                    continue;
                }
                else if (typeof old_state === 'string') {
                    // New tileset wants it, but old tileset aliases it, so deref
                    old_state = old_spec[old_state];
                }
                convert_drawspec(tileset, old_state, new_state, ctx);
            }
        }
        else if (new_spec.__special__ === 'wires') {
            recurse('base', 'wired', 'wired_cross');
        }
        /*
            else if (drawspec.__special__ === 'overlay') {
                this._draw_overlay(drawspec, name, tile, packet);
            }
            else if (drawspec.__special__ === 'scroll') {
                this._draw_scroll(drawspec, name, tile, packet);
            }
            else if (drawspec.__special__ === 'bomb-fuse') {
                this._draw_bomb_fuse(drawspec, name, tile, packet);
            }
            else if (drawspec.__special__ === 'double-size-monster') {
                this._draw_double_size_monster(drawspec, name, tile, packet);
            }
            else if (drawspec.__special__ === 'rover') {
                this._draw_rover(drawspec, name, tile, packet);
            }
            else if (drawspec.__special__ === 'railroad') {
                this._draw_railroad(drawspec, name, tile, packet);
            }
            else if (drawspec.__special__ === 'encased_item') {
                this._draw_encased_item(drawspec, name, tile, packet);
            }
            else {
                console.error(`No such special ${drawspec.__special__} for ${name}`);
            }
        */
        else {
            return false;
        }
    }
    else if (new_spec.__special__ === 'double-size-monster') {
        // Converting an old single-size monster to a new double-size one is relatively easy; we can
        // just draw the small one offset within the double-size space.  Unfortunately for layouts
        // like CC2 we can only show one vertical and one horizontal direction...

        for (let [direction, fallback] of Object.entries(DOUBLE_SIZE_FALLBACK)) {
            let new_frames = new_spec[direction];
            if (! new_frames)
                continue;
            let old_frames = old_spec[direction] ?? old_spec[fallback];
            for (let [i, dest] of new_frames.entries()) {
                if (dest === null)
                    // This means "use the base sprite"
                    continue;
                let src = old_frames[Math.floor(i * old_frames.length / new_frames.length)];
                let [dx, dy] = dest;
                if (direction === 'horizontal' || fallback === 'horizontal') {
                    dx += i / new_frames.length;
                }
                else {
                    dy += i / new_frames.length;
                }
                tileset.blit_to_canvas(ctx, ...src, dx, dy);
            }
        }
    }
    // TODO the other way, yikes
    // Convert buttons to/from LL, which adds depressed states
    else if (! old_spec.__special__ && new_spec.__special__ === 'visual-state') {
        // Draw the static tile to every state in the new tileset
        for (let [key, subspec] of Object.entries(new_spec)) {
            if (key === '__special__' || typeof subspect === 'string')
                continue;
            convert_drawspec(tileset, old_spec, subspec, ctx);
        }
    }
    else if (! new_spec.__special__ && old_spec.__special__ === 'visual-state') {
        // Draw the most fundamental state as the static tile
        let representative_spec = (
            old_spec.open  // trap
            || old_spec.released  // button
            || old_spec.normal  // player i guess??
        );
        convert_drawspec(tileset, representative_spec, new_spec, ctx);
    }
    else {
        return false;
    }
}

export function convert_tileset_to_tile_world_animated(tileset) {
}

export function convert_tileset_to_layout(tileset, layout_ident) {
    if (layout_ident === tileset.layout['#ident']) {
        return tileset.image;
    }
    if (layout_ident === 'tw-animated') {
        return convert_tileset_to_tile_world_animated(tileset);
    }

    let layout = TILESET_LAYOUTS[layout_ident];
    let canvas = document.createElement('canvas');
    canvas.width = layout['#dimensions'][0] * tileset.size_x;
    canvas.height = layout['#dimensions'][1] * tileset.size_y;
    let ctx = canvas.getContext('2d');

    let comparison = {};
    let summarize = spec => {
        if (! spec) {
            return null;
        }
        else if (spec instanceof Array) {
            return '-';
        }
        else {
            return spec.__special__;
        }
    };

    for (let [name, spec] of Object.entries(layout)) {
        // These things aren't tiles
        if (name === '#ident' || name === '#name' || name === '#dimensions' ||
            name === '#supported-versions' || name === '#wire-width')
        {
            continue;
        }

        // These sequences only really exist in LL and were faked with other tiles in other tilesets
        // TODO so include the fake in LL, right?
        if (name === 'player1_exit' || name === 'player2_exit') {
            continue;
        }

        let old_spec = tileset.layout[name];
        if (! old_spec)
            // Guess we can't, uh, do much about this?
            // TODO warn?  dummy tiles?
            continue;

        // Manually adjust some incompatible tilesets
        // LL's tileset adds animation for ice, which others don't have, and it's difficult to
        // convert directly because it repeats its tiles a lot
        if (name === 'ice' && layout_ident === 'lexy') {
            // To convert TO LL, copy a lone ice tile to every position
            for (let coords of spec._distinct) {
                tileset.blit_to_canvas(ctx, ...old_spec, ...coords);
            }
            continue;
        }
        else if (name === 'ice' && tileset.layout['#ident'] === 'lexy') {
            // To convert FROM LL, pretend it only has its one tile
            tileset.blit_to_canvas(ctx, ...old_spec._distinct[0], ...spec);
            continue;
        }

        // OK, do the automatic thing
        if (convert_drawspec(tileset, old_spec, spec, ctx) === false) {
            comparison[name] = {
                old: summarize(old_spec),
                'new': summarize(spec),
            };
        }
    }
    console.table(comparison);

    console.log(canvas);
    console.log('%c ', `
        display: inline-block;
        font-size: 1px;
        padding: ${canvas.width}px ${canvas.height}px;
        background: url(${canvas.toDataURL()});
    `);
    console.log(canvas.toDataURL());
    return canvas;
}
