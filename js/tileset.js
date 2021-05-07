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
        __special__: 'thin_walls',
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
    popwall2: [8, 10],
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
        vertical: [[1, 13], [2, 13], [3, 13], [4, 13], [5, 13], [6, 13], [7, 13]],
        horizontal: [[8, 13], [10, 13], [12, 13], [14, 13], [8, 14], [10, 14], [12, 14]],
    },
    helmet: [0, 14],
    stopwatch_toggle: [14, 14],
    stopwatch_bonus: [15, 14],

    blob: {
        __special__: 'double-size-monster',
        base: [0, 15],
        vertical: [[1, 15], [2, 15], [3, 15], [4, 15], [5, 15], [6, 15], [7, 15]],
        horizontal: [[8, 15], [10, 15], [12, 15], [14, 15], [8, 16], [10, 16], [12, 16]],
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
    wall_invisible_revealed: [0, 1],
    // FIXME in cc1 tilesets these are opaque so they should draw at the terrain layer
    thin_walls: {
        __special__: 'thin_walls_cc1',
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
    // FIXME this stuff needs like reveal and whatnot
    fake_wall: [1, 14],
    fake_floor: [1, 15],

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
    trap: {
        __special__: 'visual-state',
        closed: [2, 11],
        open: [2, 11],
    },
    wall_appearing: [2, 12],
    gravel: [2, 13],
    popwall: [2, 14],
    popwall2: [2, 14],
    hint: [2, 15],

    cloner: [3, 1],
    force_floor_all: [3, 2],
    splash: [3, 3],
    bogus_player_drowned: [3, 3],
    bogus_player_burned_fire: [3, 4],
    bogus_player_burned: [3, 5],
    explosion: [3, 6],
    explosion_nb: [3, 6],
    splash_nb: [3, 3],
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
        north: [6, 1],
        east: [6.5, 1],
        south: [6, 1.5],
        west: [6.5, 1.5],
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
    thief_tools: [8, 2],
    thief_keys: [8, 3],
    canopy: {
        __special__: 'perception',
        modes: new Set(['editor', 'xray']),
        hidden: [9, 2],
        revealed: [9, 3],
    },
    cloud: {
        __special__: 'perception_2',
        modes: new Set(['editor', 'xray']),
        hidden: [8, 15],
        revealed: [8, 14],
    },
    cloud_player: {
        __special__: 'perception_2',
        modes: new Set(['editor', 'xray']),
        hidden: [9, 15],
        revealed: [9, 14],
    },
    cloud_block: {
        __special__: 'perception_2',
        modes: new Set(['editor', 'xray']),
        hidden: [10, 15],
        revealed: [10, 14],
    },
    cloud_water: {
        __special__: 'perception_2',
        modes: new Set(['editor', 'xray']),
        hidden: [11, 15],
        revealed: [11, 14],
    },
    cloud_nonplayer: {
        __special__: 'perception_2',
        modes: new Set(['editor', 'xray']),
        hidden: [12, 15],
        revealed: [12, 14],
    },
    cloud_after: {
        __special__: 'perception_2',
        modes: new Set(['editor', 'xray']),
        hidden: [8, 15],
        revealed: [8, 14],
    },
    cloud_player_after: {
        __special__: 'perception_2',
        modes: new Set(['editor', 'xray']),
        hidden: [9, 15],
        revealed: [9, 14],
    },
    cloud_block_after: {
        __special__: 'perception_2',
        modes: new Set(['editor', 'xray']),
        hidden: [10, 15],
        revealed: [10, 14],
    },
    cloud_water_after: {
        __special__: 'perception_2',
        modes: new Set(['editor', 'xray']),
        hidden: [11, 15],
        revealed: [11, 14],
    },
    cloud_nonplayer_after: {
        __special__: 'perception_2',
        modes: new Set(['editor', 'xray']),
        hidden: [12, 15],
        revealed: [12, 14],
    },
    hidden_item: {
        __special__: 'perception_2',
        modes: new Set(['editor', 'xray']),
        hidden: [8, 18],
        revealed: [8, 18],
    },
    hidden_item_robust: {
        __special__: 'perception_2',
        modes: new Set(['editor', 'xray']),
        hidden: [9, 18],
        revealed: [9, 18],
    },
    no_player1_sign: [10, 2],
    no_player2_sign: [10, 3],
    '#active-player-background': [11, 2],
    // TODO dopps can push but i don't think they have any other visuals
    doppelganger1: {
        __special__: 'overlay',
        base: [11, 3],
        overlay: 'player',
    },
    doppelganger2: {
        __special__: 'overlay',
        base: [11, 3],
        overlay: 'player2',
    },
    exit: {
        __special__: 'animated',
        duration: 16,
        all: [[12, 2], [13, 2], [14, 2], [15, 2]],
    },
    socket: [12, 3],

    floor_custom_green: [0, 4],
    floor_custom_pink: [1, 4],
    floor_custom_yellow: [2, 4],
    floor_custom_blue: [3, 4],
    wall_custom_green: [0, 5],
    wall_custom_pink: [1, 5],
    wall_custom_yellow: [2, 5],
    wall_custom_blue: [3, 5],
    sand: [0, 6],
    spikes: [0, 7],
    hole: {
        __special__: 'visual-state',
        north: [1, 6],
        open: [1, 7],
    },
    cracked_floor: [2, 6],
    
    thin_walls: {
        __special__: 'thin_walls',
        thin_walls_ns: [8, 4],
        thin_walls_ew: [8, 5],
    },
    one_way_walls: {
        __special__: 'thin_walls',
        thin_walls_ns: [9, 4],
        thin_walls_ew: [9, 5],
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
    water: {
        __special__: 'animated',
        duration: 36,
        cc2_duration: 20,
        all: [[4, 8], [5, 8], [6, 8], [7, 8]],
    },
    fire: {
        __special__: 'animated',
        duration: 36,
        cc2_duration: 20,
        all: [[4, 9], [5, 9], [6, 9], [7, 9]],
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

    turtle: {
        // Turtles draw atop fake water, but don't act like water otherwise
        __special__: 'overlay',
        overlay: {
            __special__: 'animated',
            duration: 180,
            positionally_hashed: true,
            all: [[8, 8], [9, 8], [10, 8], [9, 8]],
        },
        base: 'water',
    },
    ice: [12, 8],
    cracked_ice: [12, 9],
    ice_se: [13, 8],
    ice_sw: [14, 8],
    ice_ne: [13, 9],
    ice_nw: [14, 9],
    dirt: [15, 8],
    gravel: [15, 9],
    green_floor: {
        __special__: 'animated',
        duration: 24,
        cc2_duration: 16,
        all: [[8, 10], [9, 10], [10, 10], [11, 10]],
    },
    green_wall: {
        __special__: 'animated',
        duration: 24,
        cc2_duration: 16,
        all: [[8, 11], [9, 11], [10, 11], [11, 11]],
    },
    purple_floor: {
        __special__: 'animated',
        duration: 24,
        cc2_duration: 16,
        all: [[12, 10], [13, 10], [14, 10], [15, 10]],
    },
    purple_wall: {
        __special__: 'animated',
        duration: 24,
        cc2_duration: 16,
        all: [[12, 11], [13, 11], [14, 11], [15, 11]],
    },

    // Cool movement tiles
    railroad: {
        __special__: 'railroad',
        base: [15, 9],
        railroad_ties: {
            ne: [0, 12],
            se: [1, 12],
            sw: [2, 12],
            nw: [3, 12],
            ew: [4, 12],
            ns: [5, 12],
        },
        railroad_active: {
            ne: [0, 13],
            se: [1, 13],
            sw: [2, 13],
            nw: [3, 13],
            ew: [4, 13],
            ns: [5, 13],
        },
        railroad_inactive: {
            ne: [0, 14],
            se: [1, 14],
            sw: [2, 14],
            nw: [3, 14],
            ew: [4, 14],
            ns: [5, 14],
        },
        railroad_switch: [6, 12],
    },
    swivel_floor: [7, 12],
    swivel_se: [6, 13],
    swivel_sw: [7, 13],
    swivel_ne: [6, 14],
    swivel_nw: [7, 14],
    dash_floor: {
        __special__: 'animated',
        duration: 24,
        all: [[0, 15], [1, 15], [2, 15], [3, 15], [4, 15], [5, 15], [6, 15], [7, 15]],
    },

    // Items
    flippers: [0, 16],
    fire_boots: [1, 16],
    cleats: [2, 16],
    suction_boots: [3, 16],
    hiking_boots: [4, 16],
    lightning_bolt: [5, 16],
    speed_boots: [6, 16],
    bribe: [7, 16],
    railroad_sign: [0, 17],
    hook: [1, 17],
    foil: [2, 17],
    xray_eye: [3, 17],
    helmet: [4, 17],
    bucket_lava: [5, 17],
    bucket_water: [6, 17],
    bucket_gravel: [7, 17],
    skeleton_key: [0, 18],
    ankh: [1, 18],
    floor_ankh: [2, 18],
    no_sign: [6, 18],
    gift_bow: [7, 18],
    score_10: [0, 19],
    score_100: [1, 19],
    score_1000: [2, 19],
    score_2x: [3, 19],
    score_5x: [4, 19],
    stopwatch_bonus: [5, 19],
    stopwatch_penalty: [6, 19],
    stopwatch_toggle: [7, 19],

    chip: {
        __special__: 'animated',
        duration: 24,
        all: [[8, 16], [9, 16], [10, 16], [9, 16]],
    },
    chip_extra: {
        __special__: 'perception',
        modes: new Set(['palette', 'editor']),
        hidden: {
            __special__: 'animated',
            duration: 24,
            all: [[8, 16], [9, 16], [10, 16], [9, 16]],
        },
        revealed: [8, 19],
    },
    green_chip: {
        __special__: 'animated',
        duration: 24,
        all: [[8, 17], [9, 17], [10, 17], [9, 17]],
    },
    bowling_ball: [9, 19],
    rolling_ball: {
        __special__: 'animated',
        global: false,
        duration: 1,
        north: [[14, 16], [15, 16], [13, 17], [13, 17], [13, 17], [11, 16], [12, 16], [13, 16]],
        east: [[11, 17], [12, 17], [13, 17], [13, 17], [13, 17], [14, 17], [15, 17], [13, 16]],
        south: [[12, 16], [11, 16], [13, 17], [13, 17], [13, 17], [15, 16], [14, 16], [13, 16]],
        west: [[15, 17], [14, 17], [13, 17], [13, 17], [13, 17], [12, 17], [11, 17], [13, 16]],
    },
    // LL bombs aren't animated
    bomb: [11, 18],
    green_bomb: [12, 18],
    dynamite: [10, 19],
    dynamite_lit: {
        __special__: 'visual-state',
        0: [11, 19],
        1: [12, 19],
        2: [13, 19],
        3: [14, 19],
        4: [15, 19],
    },

    // Doors and mechanisms
    key_red: [0, 20],
    key_blue: [0, 21],
    key_yellow: [0, 22],
    key_green: [0, 23],
    door_red: [1, 20],
    door_blue: [1, 21],
    door_yellow: [1, 22],
    door_green: [1, 23],
    gate_red: [2, 20],
    gate_blue: [2, 21],
    gate_yellow: [2, 22],
    gate_green: [2, 23],
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
            inactive: [9, 23],
        },
    },
    teleport_blue: {
        __special__: 'wires',
        base: [0, 2],
        wired: {
            __special__: 'animated',
            duration: 20,
            cc2_duration: 16,
            all: [[4, 21], [5, 21], [6, 21], [7, 21]],
        },
    },
    teleport_yellow: {
        __special__: 'animated',
        duration: 20,
        cc2_duration: 16,
        all: [[4, 22], [5, 22], [6, 22], [7, 22]],
    },
    teleport_green: {
        __special__: 'animated',
        duration: 20,
        cc2_duration: 16,
        all: [[4, 23], [5, 23], [6, 23], [7, 23]],
    },
    teleport_blue_exit: {
        __special__: 'wires',
        base: [0, 2],
        wired: [8, 23],
    },
    transmogrifier: {
        __special__: 'visual-state',
        active: {
            __special__: 'animated',
            duration: 16,
            all: [[8, 20], [9, 20], [10, 20], [11, 20]],
        },
        inactive: [10, 23],
    },
    turntable_cw: {
        __special__: 'wires',
        base: [0, 2],
        wired: {
            __special__: 'animated',
            duration: 12,
            cc2_duration: 16,
            all: [[8, 22], [9, 22], [10, 22], [11, 22]],
        }
    },
    turntable_ccw: {
        __special__: 'wires',
        base: [0, 2],
        wired: {
            __special__: 'animated',
            duration: 12,
            cc2_duration: 16,
            all: [[8, 21], [9, 21], [10, 21], [11, 21]],
        }
    },
    flame_jet_off: [12, 21],
    flame_jet_on: {
        __special__: 'animated',
        duration: 18,
        cc2_duration: 12,
        all: [[13, 21], [14, 21], [15, 21]],
    },
    electrified_floor: {
        __special__: 'visual-state',
        active: {
            __special__: 'animated',
            duration: 18,
            cc2_duration: 12,
            all: [[13, 22], [14, 22], [15, 22]],
        },
        inactive: [12, 22],
    },

    // Buttons
    button_blue: {
        __special__: 'visual-state',
        released: [0, 24],
        pressed: [0, 25],
    },
    button_green: {
        __special__: 'visual-state',
        released: [1, 24],
        pressed: [1, 25],
    },
    button_red: {
        __special__: 'visual-state',
        released: [2, 24],
        pressed: [2, 25],
    },
    button_brown: {
        __special__: 'visual-state',
        released: [3, 24],
        pressed: [3, 25],
    },
    button_pink: {
        __special__: 'wires',
        base: [0, 2],
        wired: {
            __special__: 'visual-state',
            released: [4, 24],
            pressed: [4, 25],
        },
    },
    button_black: {
        __special__: 'wires',
        __special__: 'wires',
        base: [0, 2],
        wired: {
            __special__: 'visual-state',
            released: [5, 24],
            pressed: [5, 25],
        },
    },
    button_orange: {
        __special__: 'visual-state',
        released: [6, 24],
        pressed: [6, 25],
    },
    button_gray: {
        __special__: 'visual-state',
        released: [7, 24],
        pressed: [7, 25],
    },
    light_switch_off: {
        __special__: 'wires',
        base: [15, 25],
        wired: [14, 24],
    },
    light_switch_on: {
        __special__: 'wires',
        base: [15, 25],
        wired: [14, 25],
    },
    button_yellow: [15, 24],

    cloner: [0, 26],  // FIXME arrows at [0, 27]
    trap: {
        __special__: 'visual-state',
        open: [1, 27],
        closed: [1, 26],
    },

    // Wire and logic
    '#unpowered': [2, 28],
    '#powered': [2, 29],
    '#wire-tunnel': [2, 30],
    logic_gate: {
        __special__: 'logic-gate',
        counter_numbers: {
            x: 7,
            y: 1,
            width: 0.75,
            height: 1,
        },
        logic_gate_tiles: {
            counter: [2, 31],
            not: {
                north: [3, 28],
                east: [3, 29],
                south: [3, 30],
                west: [3, 31],
            },
            and: {
                north: [4, 28],
                east: [4, 29],
                south: [4, 30],
                west: [4, 31],
            },
            or: {
                north: [5, 28],
                east: [5, 29],
                south: [5, 30],
                west: [5, 31],
            },
            xor: {
                north: [6, 28],
                east: [6, 29],
                south: [6, 30],
                west: [6, 31],
            },
            nand: {
                north: [7, 28],
                east: [7, 29],
                south: [7, 30],
                west: [7, 31],
            },
            'latch-cw': {
                north: [8, 28],
                east: [8, 29],
                south: [8, 30],
                west: [8, 31],
            },
            'latch-ccw': {
                north: [9, 28],
                east: [9, 29],
                south: [9, 30],
                west: [9, 31],
            },
            diode: {
                north: [10, 28],
                east: [10, 29],
                south: [10, 30],
                west: [10, 31],
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
        exploded: [17, 26],
        failed: [17, 26],
        drowned: [17, 27],
        slimed: [17, 28],
        fell: [17, 29],
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
        exploded: [17, 26],
        failed: [17, 26],
        drowned: [17, 27],
        slimed: [17, 28],
        fell: [17, 29],
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
        north: [29, 8],
        east: [29, 9],
        south: [29, 10],
        west: [29, 11],
    },
    shark: {
        __special__: 'visual-state',
        normal: {
        north: [30, 8],
        east: [30, 9],
        south: [30, 10],
        west: [30, 11],
        },
        killer: [31, 10],
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
        north: [[24, 12], [25, 12], [26, 12], [27, 12]],
        east: [[24, 13], [25, 13], [26, 13], [27, 13]],
        // Same animations but played backwards
        south: [[26, 12], [25, 12], [24, 12], [27, 12]],
        west: [[26, 13], [25, 13], [24, 13], [27, 13]],
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

    // Blocks
    dirt_block: {
        __special__: 'perception',
        modes: new Set(['editor', 'xray']),
        hidden: [16, 20],
        revealed: [16, 21],
    },
    ice_block: {
        __special__: 'perception',
        modes: new Set(['editor', 'xray']),
        hidden: [17, 20],
        revealed: [17, 21],
    },
    frame_block: {
        __special__: 'arrows',
        base: [18, 20],
        arrows: [18, 21],
    },
    glass_block: {
        __special__: 'encased_item',
        base: [19, 21],
    },
    boulder: [20, 20],
    circuit_block: {
        __special__: 'wires',
        base: [16, 22],
        wired: [17, 22],
        wired_cross: [18, 22],
    },
    sokoban_block: {
        __special__: 'visual-state',
        red: [26, 20],
        blue: [26, 21],
        yellow: [26, 22],
        green: [26, 23],
    },
    sokoban_button: {
        __special__: 'visual-state',
        red_released: [28, 20],
        blue_released: [28, 21],
        yellow_released: [28, 22],
        green_released: [28, 23],
        red_pressed: [29, 20],
        blue_pressed: [29, 21],
        yellow_pressed: [29, 22],
        green_pressed: [29, 23],
    },
    sokoban_wall: {
        __special__: 'visual-state',
        red: [30, 20],
        blue: [30, 21],
        yellow: [30, 22],
        green: [30, 23],
    },
    sokoban_floor: {
        __special__: 'visual-state',
        red: [31, 20],
        blue: [31, 21],
        yellow: [31, 22],
        green: [31, 23],
    },

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
    ball: {
        __special__: 'animated',
        global: false,
        duration: 0.5,
        cc2_duration: 1,
        idle_frame_index: 2,
        // appropriately, this animation ping-pongs
        all: [[27, 24], [28, 24], [29, 24], [30, 24], [31, 24], [30, 24], [29, 24], [28, 24]],
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
        revealed: [31, 25],
    },

    // VFX
    explosion: [[16, 26], [17, 26], [18, 26], [19, 26]],
    explosion_nb: [[16, 26], [17, 26], [18, 26], [19, 26]],
    splash: [[16, 27], [17, 27], [18, 27], [19, 27]],
    splash_nb: [[16, 27], [17, 27], [18, 27], [19, 27]],
    splash_slime: [[16, 28], [17, 28], [18, 28], [19, 28]],
    fall: [[16, 29], [17, 29], [18, 29], [19, 29]],
    player1_exit: [[20, 28], [21, 28], [22, 28], [23, 28]],
    player2_exit: [[20, 29], [21, 29], [22, 29], [23, 29]],
    transmogrify_flash: [[24, 26], [25, 26], [26, 26], [27, 26], [28, 26], [29, 26], [30, 26], [31, 26]],
    teleport_flash: [[24, 27], [25, 27], [26, 27], [27, 27]],
    puff: [[24, 28], [25, 28], [26, 28], [27, 28]],
    resurrection: [[23, 28], [22, 28], [21, 28], [20, 28]],
};

export const TILESET_LAYOUTS = {
    'tw-static': TILE_WORLD_TILESET_LAYOUT,
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
        // XXX curiously, i note that .image is never used within this class
        this.image = image;
        this.layout = layout;
        this.size_x = size_x;
        this.size_y = size_y;
    }

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
            coords = coords[(tile && tile.direction) ?? 'south'];
        }

        // Any animation not using the 'animated' special is a dedicated animation tile (like an
        // explosion or splash) and just plays over the course of its lifetime
        if (coords[0] instanceof Array) {
            if (tile && tile.movement_speed) {
                let p = tile.movement_progress(packet.update_progress, packet.update_rate);
                coords = coords[Math.floor(p * coords.length)];
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
        else if (tile && tile.direction) {
            frames = drawspec[tile.direction];
        }
        else {
            frames = drawspec.south;
        }

        let is_global = drawspec.global ?? true;
        let duration = drawspec.duration;
        if (packet.use_cc2_anim_speed && drawspec.cc2_duration) {
            duration = drawspec.cc2_duration;
        }

        let n;
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
            n = Math.floor(p % 1 * frames.length);
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
                p = (p + segment) * duration;
            }
            else if (duration > 1) {
                // Larger durations are much easier; just multiply and mod.
                // (Note that large fractional durations like 2.5 will not work.)
                p = p * duration % 1;
            }
            n = Math.floor(p * frames.length);
        }
        else {
            // This is an actor that's not moving, so use the idle frame
            n = drawspec.idle_frame_index ?? 0;
        }
        if (n < 0) {
            //should never happen, but happens when bulk tests fail for some reason
            n = 0;
        }
        packet.blit(...frames[n]);
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
        let wire_radius = this.layout['#wire-width'] / 2;
        // TODO circuit block with a lightning bolt is always powered
        // TODO circuit block in motion doesn't inherit cell's power
        if (tile && tile.wire_directions && ! packet.hide_logic) {
            // Draw the base tile
            packet.blit(drawspec.base[0], drawspec.base[1]);

            let is_crossed = (tile.wire_directions === 0x0f && drawspec.wired_cross);
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
        let powered = (tile.cell ? tile.powered_edges : 0) & wires;
        if (! tile.cell || powered !== tile.wire_directions) {
            this._draw_fourway_power_underlay(this.layout['#unpowered'], wires, packet);
            if (! tile.cell || powered === 0)
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

        // This is kinda best-effort since the tiles are opaque and not designed to combine
        if (edges === (DIRECTIONS['south'].bit | DIRECTIONS['east'].bit)) {
            packet.blit(...drawspec.southeast);
        }
        else if (edges & DIRECTIONS['north'].bit) {
            packet.blit(...drawspec.north);
        }
        else if (edges & DIRECTIONS['east'].bit) {
            packet.blit(...drawspec.east);
        }
        else if (edges & DIRECTIONS['south'].bit) {
            packet.blit(...drawspec.south);
        }
        else {
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
        // CC2's tileset has double-size art for blobs and walkers that spans the tile they're
        // moving from AND the tile they're moving into.
        // First, of course, this only happens if they're moving at all.
        if (! tile || ! tile.movement_speed) {
            this.draw_drawspec(drawspec.base, name, tile, packet);
            return;
        }

        // They only support horizontal and vertical moves, not all four directions.  The other two
        // directions are simply the animations played in reverse.
        let axis_cels;
        let w = 1, h = 1, x = 0, y = 0, sx = 0, sy = 0, reverse = false;
        if (tile.direction === 'north') {
            axis_cels = drawspec.vertical;
            reverse = true;
            h = 2;
            sy = 1;
        }
        else if (tile.direction === 'south') {
            axis_cels = drawspec.vertical;
            h = 2;
            y = -1;
            sy = -1;
        }
        else if (tile.direction === 'west') {
            axis_cels = drawspec.horizontal;
            reverse = true;
            w = 2;
            sx = 1;
        }
        else if (tile.direction === 'east') {
            axis_cels = drawspec.horizontal;
            w = 2;
            x = -1;
            sx = -1;
        }

        let p = tile.movement_progress(packet.update_progress, packet.update_rate);
        let index = Math.floor(p * (axis_cels.length + 1));
        if (index === 0 || index > axis_cels.length) {
            packet.blit_aligned(...drawspec.base, 0, 0, 1, 1, sx, sy);
        }
        else {
            let cel = reverse ? axis_cels[axis_cels.length - index] : axis_cels[index - 1];
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
        let index = {north: 0, east: 1, west: 2, south: 3}[tile.direction];
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
            if (tile.gate_type === 'not' || tile.gate_type === 'counter' || tile.gate_type === 'diode') {
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
        // All railroads have regular gravel underneath
        // TODO would be nice to disambiguate since it's possible to have nothing visible
        this.draw_drawspec(this.layout['gravel'], name, tile, packet);

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
            this._draw_standard(this.layout[tile.encased_item], tile.encased_item, null, packet);
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
            else if (drawspec.__special__ === 'thin_walls') {
                this._draw_thin_walls(drawspec, name, tile, packet);
            }
            else if (drawspec.__special__ === 'thin_walls_cc1') {
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
            else if (drawspec.__special__ === 'perception_2') {
                if (drawspec.modes.has(packet.perception)) {
                    if (tile.hidden_tile) {
                        this.draw_drawspec(this.layout[tile.hidden_tile.type.name], tile.hidden_tile.type.name, tile, packet);
                    }
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
