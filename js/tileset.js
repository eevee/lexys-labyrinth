import { DIRECTIONS } from './defs.js';
import TILE_TYPES from './tiletypes.js';

const _omit_custom_lexy_vfx = {
    teleport_flash: null,
    transmogrify_flash: null,
    puff: null,
};

// TODO move the remaining stuff (arrows, overlay i think, probably force floor thing) into specials
// TODO more explicitly define animations, give them a speed!  maybe fold directions into it
// TODO relatedly, the push animations are sometimes glitchy depending on when you start?
// TODO animate swimming player always
// TODO life might be easier if i used the lynx-style loop with cooldown at the end
// TODO define a draw state object to pass into here; need it for making turtles work right, fixing
// blur with cc2 blobs/walkers, also makes a lot of signatures cleaner (make sure not slower)
// TODO monsters should only animate while moving?  (not actually how cc2 works...)
export const CC2_TILESET_LAYOUT = {
    '#ident': 'cc2',
    '#name': "Chip's Challenge 2",
    '#dimensions': [16, 32],
    '#transparent-color': [0x52, 0xce, 0x6b, 0xff],
    '#supported-versions': new Set(['cc1', 'cc2']),
    '#wire-width': 1/16,

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
    // FIXME this shouldn't be visible with seeing eye (or should it not spawn at all?)
    wall_invisible_revealed: [1, 2],
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
    exit: [
        [6, 2],
        [7, 2],
        [8, 2],
        [9, 2],
    ],
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
    splash_slime: [[0, 5], [1, 5], [2, 5], [3, 5]],
    splash: [[4, 5], [5, 5], [6, 5], [7, 5]],
    flame_jet_off: [8, 5],
    flame_jet_on: [[9, 5], [10, 5], [11, 5]],
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
        north: [[0, 7], [1, 7], [2, 7], [3, 7]],
        east: [[4, 7], [5, 7], [6, 7], [7, 7]],
        south: [[8, 7], [9, 7], [10, 7], [11, 7]],
        west: [[12, 7], [13, 7], [14, 7], [15, 7]],
    },

    tank_blue: {
        north: [[0, 8], [1, 8]],
        east: [[2, 8], [3, 8]],
        south: [[4, 8], [5, 8]],
        west: [[6, 8], [7, 8]],
    },
    glider: {
        north: [[8, 8], [9, 8]],
        east: [[10, 8], [11, 8]],
        south: [[12, 8], [13, 8]],
        west: [[14, 8], [15, 8]],
    },

    green_floor: [[0, 9], [1, 9], [2, 9], [3, 9]],
    purple_floor: [[4, 9], [5, 9], [6, 9], [7, 9]],
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
    // Fireball animation is REALLY FAST, runs roughly twice per move
    fireball: [
        [12, 9], [13, 9], [14, 9], [15, 9],
        [12, 9], [13, 9], [14, 9], [15, 9],
    ],

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
        wired: [[4, 10], [5, 10], [6, 10], [7, 10]],
    },
    popwall: [8, 10],
    popwall2: [8, 10],
    gravel: [9, 10],
    ball: [
        // appropriately, this animation ping-pongs
        [10, 10], [11, 10], [12, 10], [13, 10],
        [14, 10], [13, 10], [12, 10], [11, 10],
        // FIXME the ball bounces so it specifically needs to play its animation every move; this
        // defeats the ½x slowdown.  it's dumb and means this anim as written doesn't match cc2
        [10, 10], [11, 10], [12, 10], [13, 10],
        [14, 10], [13, 10], [12, 10], [11, 10],
    ],
    steel: {
        // Wiring!
        __special__: 'wires',
        base: [15, 10],
        wired: [9, 26],
        wired_cross: [11, 26],
        is_wired_optional: true,
    },

    // TODO should explicitly set the non-moving tile, so we can have the walk tile start with
    // immediate movement?
    // TODO this shouldn't run at half speed, it's already designed to be one step, and when teeth
    // move at half speed it looks clumsy
    teeth: {
        // NOTE: CC2 inexplicably dropped north teeth and just uses the south sprites instead
        north: [[1, 11], [0, 11], [1, 11], [2, 11]],
        east: [[4, 11], [3, 11], [4, 11], [5, 11]],
        south: [[1, 11], [0, 11], [1, 11], [2, 11]],
        west: [[7, 11], [6, 11], [7, 11], [8, 11]],
    },
    swivel_sw: [9, 11],
    swivel_nw: [10, 11],
    swivel_ne: [11, 11],
    swivel_se: [12, 11],
    swivel_floor: [13, 11],
    '#wire-tunnel': [14, 11],
    stopwatch_penalty: [15, 11],
    paramecium: {
        north: [[0, 12], [1, 12], [2, 12]],
        east: [[3, 12], [4, 12], [5, 12]],
        south: [[6, 12], [7, 12], [8, 12]],
        west: [[9, 12], [10, 12], [11, 12]],
    },
    foil: [12, 12],
    turtle: {
        // Turtles draw atop fake water, but don't act like water otherwise
        __special__: 'overlay',
        overlay: [13, 12],  // TODO also 14 + 15, bobbing pseudorandomly
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
        // NOTE: CC2 inexplicably dropped north teeth and just uses the south sprites instead
        // NOTE: it also skimped on timid teeth frames
        north: [[1, 17], [0, 17]],
        east: [[3, 17], [2, 17]],
        south: [[1, 17], [0, 17]],
        west: [[5, 17], [4, 17]],
    },
    bowling_ball: [6, 17],
    rolling_ball: [[6, 17], [7, 17]],
    tank_yellow: {
        north: [[8, 17], [9, 17]],
        east: [[10, 17], [11, 17]],
        south: [[12, 17], [13, 17]],
        west: [[14, 17], [15, 17]],
    },

    rover: {
        __special__: 'rover',
        direction: [10, 18],
        inert: [0, 18],
        teeth: [[0, 18], [8, 18]],
        // cw, slow
        glider: [[0, 18], [1, 18], [2, 18], [3, 18], [4, 18], [5, 18], [6, 18], [7, 18]],
        // ccw, fast
        bug: [
            [7, 18], [6, 18], [5, 18], [4, 18], [3, 18], [2, 18], [1, 18], [0, 18],
            [7, 18], [6, 18], [5, 18], [4, 18], [3, 18], [2, 18], [1, 18], [0, 18],
        ],
        ball: [[0, 18], [4, 18]],
        teeth_timid: [[0, 18], [9, 18]],
        // ccw, slow
        fireball: [[7, 18], [6, 18], [5, 18], [4, 18], [3, 18], [2, 18], [1, 18], [0, 18]],
        // cw, fast
        paramecium: [
            [0, 18], [1, 18], [2, 18], [3, 18], [4, 18], [5, 18], [6, 18], [7, 18],
            [0, 18], [1, 18], [2, 18], [3, 18], [4, 18], [5, 18], [6, 18], [7, 18],
        ],
        walker: [[8, 18], [9, 18]],
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
        base: [0, 19],
        scroll_region: [0, 1],
    },
    force_floor_e: {
        __special__: 'scroll',
        base: [3, 19],
        scroll_region: [-1, 0],
    },
    force_floor_s: {
        __special__: 'scroll',
        base: [1, 20],
        scroll_region: [0, -1],
    },
    force_floor_w: {
        __special__: 'scroll',
        base: [2, 20],
        scroll_region: [1, 0],
    },
    teleport_green: [[4, 19], [5, 19], [6, 19], [7, 19]],
    teleport_yellow: [[8, 19], [9, 19], [10, 19], [11, 19]],
    transmogrifier: {
        __special__: 'visual-state',
        active: [[12, 19], [13, 19], [14, 19], [15, 19]],
        inactive: [12, 19],
    },
    teleport_red: {
        __special__: 'wires',
        base: [0, 2],
        wired: {
            __special__: 'visual-state',
            active: [[4, 20], [5, 20], [6, 20], [7, 20]],
            inactive: [4, 20],
        },
    },
    slime: [[8, 20], [9, 20], [10, 20], [11, 20], [12, 20], [13, 20], [14, 20], [15, 20]],

    force_floor_all: [[0, 21], [1, 21], [2, 21], [3, 21], [4, 21], [5, 21], [6, 21], [7, 21]],
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
            north: [[0, 22], [1, 22], [2, 22], [3, 22], [4, 22], [5, 22], [6, 22], [7, 22]],
            east: [[8, 22], [9, 22], [10, 22], [11, 22], [12, 22], [13, 22], [14, 22], [15, 22]],
            south: [[0, 23], [1, 23], [2, 23], [3, 23], [4, 23], [5, 23], [6, 23], [7, 23]],
            west: [[8, 23], [9, 23], [10, 23], [11, 23], [12, 23], [13, 23], [14, 23], [15, 23]],
        },
        pushing: 'blocked',
        swimming: {
            north: [[0, 24], [1, 24]],
            east: [[2, 24], [3, 24]],
            south: [[4, 24], [5, 24]],
            west: [[6, 24], [7, 24]],
        },
        // The classic CC2 behavior, spinning on ice
        skating: [[0, 22], [8, 22], [0, 23], [8, 23]],
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
    },
    // Do a quick spin I guess??
    player1_exit: [[0, 22], [8, 22], [0, 23], [8, 23]],
    bogus_player_win: {
        __special__: 'overlay',
        overlay: [0, 23],
        base: 'exit',
    },
    bogus_player_swimming: {
        north: [[0, 24], [1, 24]],
        east: [[2, 24], [3, 24]],
        south: [[4, 24], [5, 24]],
        west: [[6, 24], [7, 24]],
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
    water: [
        [12, 24],
        [13, 24],
        [14, 24],
        [15, 24],
    ],

    logic_gate: {
        __special__: 'logic-gate',
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
        blocked: 'pushing',
        moving: {
            north: [[0, 27], [1, 27], [2, 27], [3, 27], [4, 27], [5, 27], [6, 27], [7, 27]],
            south: [[0, 28], [1, 28], [2, 28], [3, 28], [4, 28], [5, 28], [6, 28], [7, 28]],
            west: [[8, 28], [9, 28], [10, 28], [11, 28], [12, 28], [13, 28], [14, 28], [15, 28]],
            east: [[8, 27], [9, 27], [10, 27], [11, 27], [12, 27], [13, 27], [14, 27], [15, 27]],
        },
        pushing: {
            north: [8, 29],
            east: [9, 29],
            south: [10, 29],
            west: [11, 29],
        },
        swimming: {
            north: [[0, 29], [1, 29]],
            east: [[2, 29], [3, 29]],
            south: [[4, 29], [5, 29]],
            west: [[6, 29], [7, 29]],
        },
        // The classic CC2 behavior, spinning on ice
        skating: [[0, 27], [8, 27], [0, 28], [8, 28]],
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
    },
    player2_exit: [[0, 27], [8, 27], [0, 28], [8, 28]],
    fire: [
        [12, 29],
        [13, 29],
        [14, 29],
        [15, 29],
    ],

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

export const LL_TILESET_LAYOUT = Object.assign({}, CC2_TILESET_LAYOUT, {
    '#ident': 'lexy',
    '#name': "Lexy's Labyrinth",
    // TODO dimensions, when this is stable??  might one day rearrange, leave some extra space
    '#supported-versions': new Set(['cc1', 'cc2', 'll']),

    // Completed teeth sprites
    teeth: Object.assign({}, CC2_TILESET_LAYOUT.teeth, {
        north: [[1, 32], [0, 32], [1, 32], [2, 32]],
    }),
    teeth_timid: {
        north: [[7, 32], [6, 32], [7, 32], [8, 32]],
        east:  [[4, 32], [2, 17], [4, 32], [3, 17]],
        south: [[3, 32], [0, 17], [3, 32], [1, 17]],
        west:  [[5, 32], [4, 17], [5, 32], [5, 17]],
    },

    // Extra player sprites
    player: Object.assign({}, CC2_TILESET_LAYOUT.player, {
        __special__: 'visual-state',
        pushing: {
            north: [[8, 24], [0, 34], [8, 24], [1, 34]],
            east: [[9, 24], [2, 34], [9, 24], [3, 34]],
            south: [[10, 24], [4, 34], [10, 24], [5, 34]],
            west: [[11, 24], [6, 34], [11, 24], [7, 34]],
        },
        skating: {
            north: [0, 33],
            east: [1, 33],
            south: [2, 33],
            west: [3, 33],
        },
        forced: 'skating',
        exited: [14, 32],
        burned: {
            north: [4, 33],
            east: [5, 33],
            south: [6, 33],
            west: [7, 33],
        },
        slimed: [1, 38],
    }),
    player2: Object.assign({}, CC2_TILESET_LAYOUT.player2, {
        __special__: 'visual-state',
        pushing: {
            north: [[8, 29], [8, 34], [8, 29], [9, 34]],
            east: [[9, 29], [10, 34], [9, 29], [11, 34]],
            south: [[10, 29], [12, 34], [10, 29], [13, 34]],
            west: [[11, 29], [14, 34], [11, 29], [15, 34]],
        },
        skating: {
            north: [8, 33],
            east: [9, 33],
            south: [10, 33],
            west: [11, 33],
        },
        forced: 'skating',
        exited: [15, 32],
        burned: {
            north: [12, 33],
            east: [13, 33],
            south: [14, 33],
            west: [15, 33],
        },
        slimed: [1, 38],
    }),
    bogus_player_burned_fire: {
        __special__: 'overlay',
        overlay: [6, 33],
        base: 'fire',
    },
    bogus_player_burned: {
        __special__: 'overlay',
        overlay: [6, 33],
        base: 'floor',
    },

    // Custom tiles
    popwall2: [9, 32],
    gift_bow: [10, 32],
    circuit_block: {
        __special__: 'wires',
        base: [13, 32],
        wired: [11, 32],
        wired_cross: [12, 32],
    },

    // Blob and walker in all four directions
    blob: {
        north: [[0, 35], [1, 35], [2, 35], [3, 35], [4, 35], [5, 35], [6, 35], [7, 35]],
        east: [[8, 35], [9, 35], [10, 35], [11, 35], [12, 35], [13, 35], [14, 35], [15, 35]],
        south: [[0, 36], [1, 36], [2, 36], [3, 36], [4, 36], [5, 36], [6, 36], [7, 36]],
        west: [[8, 36], [9, 36], [10, 36], [11, 36], [12, 36], [13, 36], [14, 36], [15, 36]],
    },
    walker: {
        north: [[0, 37], [1, 37], [2, 37], [3, 37]],
        east: [[4, 37], [5, 37], [6, 37], [7, 37]],
        // Same animations but played backwards
        south: [[2, 37], [1, 37], [0, 37], [3, 37]],
        west: [[6, 37], [5, 37], [4, 37], [7, 37]],
    },
    // Pressed buttons
    button_blue: {
        __special__: 'visual-state',
        released: [8, 6],
        pressed: [8, 37],
    },
    button_green: {
        __special__: 'visual-state',
        released: [9, 6],
        pressed: [9, 37],
    },
    button_red: {
        __special__: 'visual-state',
        released: [10, 6],
        pressed: [10, 37],
    },
    button_brown: {
        __special__: 'visual-state',
        released: [11, 6],
        pressed: [11, 37],
    },
    button_pink: {
        __special__: 'wires',
        base: [0, 2],
        wired: {
            __special__: 'visual-state',
            released: [12, 6],
            pressed: [12, 37],
        },
    },
    button_black: {
        __special__: 'wires',
        __special__: 'wires',
        base: [0, 2],
        wired: {
            __special__: 'visual-state',
            released: [13, 6],
            pressed: [13, 37],
        },
    },
    button_orange: {
        __special__: 'visual-state',
        released: [14, 6],
        pressed: [14, 37],
    },
    button_gray: {
        __special__: 'visual-state',
        released: [11, 9],
        pressed: [15, 37],
    },

    // Custom VFX
    splash_slime: [[0, 38], [1, 38], [2, 38], [3, 38]],
    teleport_flash: [[4, 38], [5, 38], [6, 38], [7, 38]],
    chip_extra: {
        __special__: 'perception',
        modes: new Set(['palette', 'editor']),
        hidden: [[11, 3], [0, 39], [1, 39], [0, 39]],
        revealed: [10, 3],
    },
    chip: [[11, 3], [0, 39], [1, 39], [0, 39]],
    green_chip: [[9, 3], [2, 39], [3, 39], [2, 39]],
    player1_exit: [[8, 38], [9, 38], [10, 38], [11, 38]],
    player2_exit: [[12, 38], [13, 38], [14, 38], [15, 38]],
    puff: [[4, 39], [5, 39], [6, 39], [7, 39]],
    transmogrify_flash: [[8, 39], [9, 39], [10, 39], [11, 39], [12, 39], [13, 39], [14, 39], [15, 39]],

    // More custom tiles
    gate_red: [0, 40],
    gate_blue: [1, 40],
    gate_yellow: [2, 40],
    gate_green: [3, 40],

    skeleton_key: [4, 40],

    sand: [10, 41],
});

export const TILESET_LAYOUTS = {
    'tw-static': TILE_WORLD_TILESET_LAYOUT,
    cc2: CC2_TILESET_LAYOUT,
    lexy: LL_TILESET_LAYOUT,
};


// Bundle of arguments for drawing a tile, containing some standard state about the game
export class DrawPacket {
    constructor(tic = 0, perception = 'normal') {
        this.tic = tic;
        this.perception = perception;

        // Distinguishes between interpolation of 20tps and 60fps; 3 means 20tps, 1 means 60fps
        // XXX this isn't actually about update /rate/; it's about how many "frames" of cooldown
        // pass between a decision and the end of a tic
        this.update_rate = 3;
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
        this.animation_slowdown = 2;
    }

    draw(tile, packet) {
        this.draw_type(tile.type.name, tile, packet);
    }

    // Draws a tile type, given by name.  Passing in a tile is optional, but
    // without it you'll get defaults.
    draw_type(name, tile, packet) {
        let drawspec = this.layout[name];
        if (drawspec === null) {
            // This is explicitly never drawn (used for extra visual-only frills that don't exist in
            // some tilesets)
            return;
        }
        if (! drawspec) {
            // This is just missing
            console.error(`Don't know how to draw tile type ${name}!`);
            return;
        }

        this.draw_drawspec(drawspec, name, tile, packet);
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

        // Deal with animation
        if (coords[0] instanceof Array) {
            if (tile && tile.movement_speed) {
                // This tile reports its own animation timing (in frames), so trust that, and use
                // the current tic's fraction.  If we're between tics, interpolate.
                // FIXME if the game ever runs every frame we will have to adjust the interpolation
                let p = tile.movement_progress(packet.tic % 1, packet.update_rate);
                if (this.animation_slowdown > 1 && ! tile.type.ttl) {
                    // The players have full walk animations, but they look very silly when squeezed
                    // into the span of a single step, so instead we only play half at a time.  The
                    // halves alternate, so the player still sees the whole animation when walking
                    // continuously.  To make this work, consider: p, the current progress through
                    // the animation, is in [0, 1).  To play the first half, we want [0, 0.5); to
                    // play the second half, we want [0.5, 1).  Thus we add an integer in [0, 2) to
                    // offset us into which half to play, then divide by 2 to renormalize.
                    // Which half to use is determined by when the animation /started/, as measured
                    // in animation lengths.
                    let start_time = (packet.tic * 3 / tile.movement_speed) - p;
                    // Rounding smooths out float error (assuming the framerate never exceeds 1000)
                    let segment = Math.floor(Math.round(start_time * 1000) / 1000 % this.animation_slowdown);
                    p = (p + segment) / this.animation_slowdown;
                }
                // Lexy runs cooldown from S to 1; CC2 from S-1 to 0.  0 is bad, because p becomes 1
                // and will overflow the cel lookup
                // FIXME handle this better!  it happens even to lexy
                if (p >= 1) {
                    p = 0.999;
                }
                coords = coords[Math.floor(p * coords.length)];
            }
            else if (tile && tile.type.movement_speed) {
                // This is an actor that's not moving, so use the first frame
                coords = coords[0];
            }
            else {
                // This tile animates on a global timer, one cycle every quarter of a second
                coords = coords[Math.floor(packet.tic / this.animation_slowdown % 5 / 5 * coords.length)];
            }
        }

        packet.blit(coords[0], coords[1]);
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
        let duration = 3 * this.animation_slowdown;
        x += drawspec.scroll_region[0] * (packet.tic % duration / duration);
        y += drawspec.scroll_region[1] * (packet.tic % duration / duration);
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
        if (tile && tile.wire_directions) {
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
        if (tile && tile.wire_tunnel_directions) {
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
        let cel = Math.floor(packet.tic / 0.3 * 4) % 4;
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
        let w = 1, h = 1, x = 0, y = 0, reverse = false;
        if (tile.direction === 'north') {
            axis_cels = drawspec.vertical;
            reverse = true;
            h = 2;
        }
        else if (tile.direction === 'south') {
            axis_cels = drawspec.vertical;
            h = 2;
            y = -1;
        }
        else if (tile.direction === 'west') {
            axis_cels = drawspec.horizontal;
            reverse = true;
            w = 2;
        }
        else if (tile.direction === 'east') {
            axis_cels = drawspec.horizontal;
            w = 2;
            x = -1;
        }

        let p = tile.movement_progress(packet.tic % 1, packet.update_rate);
        p = Math.min(p, 0.999);  // FIXME hack for differing movement counters
        let index = Math.floor(p * (axis_cels.length + 1));
        if (index === 0 || index > axis_cels.length) {
            this.draw_drawspec(drawspec.base, name, tile, packet);
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
            if (tile.gate_type === 'not' || tile.gate_type === 'counter') {
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
            packet.blit(0, 3, tile.memory * 0.75, 0, 0.75, 1, 0.125, 0);
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

    draw_drawspec(drawspec, name, tile, packet) {
        if (drawspec.__special__) {
            if (drawspec.__special__ === 'overlay') {
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
            else if (drawspec.__special__ === 'logic-gate') {
                this._draw_logic_gate(drawspec, name, tile, packet);
            }
            else if (drawspec.__special__ === 'railroad') {
                this._draw_railroad(drawspec, name, tile, packet);
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
