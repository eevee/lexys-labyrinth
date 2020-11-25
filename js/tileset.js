import { DIRECTIONS } from './defs.js';
import TILE_TYPES from './tiletypes.js';

// TODO really need to specify this format more concretely, whoof
// XXX special kinds of drawing i know this has for a fact:
// - letter tiles draw from a block (one of two blocks!) of half-tiles onto the center of the base
// - force floors are cropped from a double-size tile
// - wired tiles are a whole thing (floor)
// - thin walls are packed into just two tiles
// - directional blocks have arrows in an awkward layout, not 4x4 grid but actually positioned on the edges
// - green and purple toggle walls use an overlay
// - turtles use an overlay, seem to pick a tile at random every so often
// - animations are common, should maybe have configurable timing??
// - custom floors and walls /should/ be consolidated into a single tile probably
// - thin walls should probably be consolidated?
// - traps have a state

// special features i currently have
// - directions for actors, can be used anywhere
// - arrows: for directional blocks
// - mask: for thin walls (though the idea is useful in many more places)
// - wired: for wired tiles
// - overlay: for green/purple walls mostly, also some bogus cc1 tiles

// things that are currently NOT handled
// - bomb is supposed to have a fuse
// - critters should only animate when moving
// - rover animation depends on behavior, also has a quarter-tile overlay for its direction
// - slime and walkers have double-size tiles when moving
// - logic gates draw over the stuff underneath them
// - railroad tracks overlay a Lot
// - canopy, at all
// - swivel's floor (eugh)
// - xray vision
// - editor vision
export const CC2_TILESET_LAYOUT = {
    '#wire-width': 1/16,

    door_red: [0, 1],
    door_blue: [1, 1],
    door_yellow: [2, 1],
    door_green: [3, 1],
    key_red: [4, 1],
    key_blue: [5, 1],
    key_yellow: [6, 1],
    key_green: [7, 1],
    dirt_block: [8, 1],
    // xray
    ice: [10, 1],
    ice_se: [11, 1],
    ice_sw: [12, 1],
    ice_ne: [13, 1],
    ice_nw: [14, 1],
    cloner: [15, 1],

    floor: {
        // Wiring!
        base: [0, 2],
        wired: [8, 26],
        wired_cross: [10, 26],
        is_wired_optional: true,
    },
    wall_invisible: [0, 2],
    wall_appearing: [0, 2],
    wall: [1, 2],
    floor_letter: [2, 2],
    'floor_letter#ascii': {
        x0: 0,
        y0: 0,
        width: 16,
        height: 1,
    },
    'floor_letter#arrows': {
        north: [14, 31],
        east: [14.5, 31],
        south: [15, 31],
        west: [15.5, 31],
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
    ice_block: [10, 2],
    // TODO ice block xray
    score_1000: [12, 2],
    score_100: [13, 2],
    score_10: [14, 2],
    score_2x: [15, 2],

    // LCD digit font
    green_chip: [9, 3],
    chip_extra: [10, 3],
    chip: [11, 3],
    bribe: [12, 3],
    speed_boots: [13, 3],
    // canopy, xray

    // TODO lit
    dynamite: [0, 4],
    bomb: [5, 4],
    green_bomb: [6, 4],
    // TODO bomb fuse tile, ugh
    floor_custom_green: [8, 4],
    floor_custom_pink: [9, 4],
    floor_custom_yellow: [10, 4],
    floor_custom_blue: [11, 4],
    wall_custom_green: [12, 4],
    wall_custom_pink: [13, 4],
    wall_custom_yellow: [14, 4],
    wall_custom_blue: [15, 4],

    explosion: [[0, 5], [1, 5], [2, 5], [3, 5]],
    splash: [[4, 5], [5, 5], [6, 5], [7, 5]],
    flame_jet_off: [8, 5],
    flame_jet_on: [[9, 5], [10, 5], [11, 5]],
    popdown_wall: [12, 5],
    popdown_floor: [12, 5],
    popdown_floor_visible: [13, 5],
    no_sign: [14, 5],
    directional_block: {
        base: [15, 5],
        arrows: [3, 10],
    },

    flippers: [0, 6],
    fire_boots: [1, 6],
    cleats: [2, 6],
    suction_boots: [3, 6],
    hiking_boots: [4, 6],
    lightning_bolt: [5, 6],
    // weird translucent spiral
    // weird translucent red
    button_blue: [8, 6],
    button_green: [9, 6],
    button_red: [10, 6],
    button_brown: [11, 6],
    button_pink: {
        base: [0, 2],
        wired: [12, 6],
    },
    button_black: {
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
        base: 'green_floor',
        overlay: [8, 9],
    },
    purple_wall: {
        base: 'purple_floor',
        overlay: [8, 9],
    },
    trap: {
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
    fake_floor: [0, 10],
    // Thin walls are built piecemeal from these two tiles; the first is N/S,
    // the second is E/W
    thinwall_n: {
        tile: [1, 10],
        mask: [0, 0, 1, 0.5],
    },
    thinwall_s: {
        tile: [1, 10],
        mask: [0, 0.5, 1, 0.5],
    },
    thinwall_w: {
        tile: [2, 10],
        mask: [0, 0, 0.5, 1],
    },
    thinwall_e: {
        tile: [2, 10],
        mask: [0.5, 0, 0.5, 1],
    },
    thinwall_se: {
        base: 'thinwall_s',
        overlay: 'thinwall_e',
    },
    // TODO directional block arrows
    teleport_blue: {
        base: [0, 2],
        wired: [[4, 10], [5, 10], [6, 10], [7, 10]],
    },
    popwall: [8, 10],
    popwall2: [8, 10],
    gravel: [9, 10],
    ball: [[10, 10], [11, 10], [12, 10], [13, 10], [14, 10]],
    steel: {
        // Wiring!
        base: [15, 10],
        wired: [9, 26],
        wired_cross: [11, 26],
        is_wired_optional: true,
    },

    // TODO only animates while moving
    teeth: {
        // NOTE: CC2 inexplicably dropped north teeth and just uses the south
        // sprites instead
        north: [[0, 11], [1, 11], [2, 11]],
        east: [[3, 11], [4, 11], [5, 11]],
        south: [[0, 11], [1, 11], [2, 11]],
        west: [[6, 11], [7, 11], [8, 11]],
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
        overlay: [13, 12],  // TODO also 14 + 15 for sinking
        base: 'water',
    },

    walker: [0, 13],
    // TODO walker animations span multiple tiles, rgh
    helmet: [0, 14],
    stopwatch_toggle: [14, 14],
    stopwatch_bonus: [15, 14],

    blob: [0, 15],
    // TODO blob animations also span multiple tiles
    // TODO [0, 16] some kinda red/blue outline
    floor_mimic: [0, 2],  // TODO [14, 16] with xray
    // TODO [15, 16] some kinda yellow/black outline

    // timid teeth
    bowling_ball: [6, 17],  // TODO also +18 when rolling
    tank_yellow: {
        north: [[8, 17], [9, 17]],
        east: [[10, 17], [11, 17]],
        south: [[12, 17], [13, 17]],
        west: [[14, 17], [15, 17]],
    },

    // TODO rover has layers and moves and stuff
    rover: [0, 18],
    xray_eye: [11, 18],
    ghost: {
        north: [12, 18],
        east: [13, 18],
        south: [14, 18],
        west: [15, 18],
    },

    force_floor_n: {
        base: [0, 19],
        animate_height: 1,
    },
    force_floor_e: {
        base: [3, 19],
        animate_width: -1,
    },
    force_floor_s: {
        base: [1, 20],
        animate_height: -1,
    },
    force_floor_w: {
        base: [2, 20],
        animate_width: 1,
    },
    teleport_green: [[4, 19], [5, 19], [6, 19], [7, 19]],
    teleport_yellow: [[8, 19], [9, 19], [10, 19], [11, 19]],
    transmogrifier: [[12, 19], [13, 19], [14, 19], [15, 19]],
    teleport_red: {
        base: [0, 2],
        wired: [[4, 20], [5, 20], [6, 20], [7, 20]],
    },
    slime: [[8, 20], [9, 20], [10, 20], [11, 20], [12, 20], [13, 20], [14, 20], [15, 20]],

    force_floor_all: [[0, 21], [1, 21], [2, 21], [3, 21], [4, 21], [5, 21], [6, 21], [7, 21]],
    // latches
    light_switch_off: {
        base: [14, 21],
        wired: [12, 21],
    },
    light_switch_on: {
        base: [14, 21],
        wired: [13, 21],
    },
    thief_keys: [15, 21],

    player: {
        normal: {
            north: [0, 22],
            south: [0, 23],
            west: [8, 23],
            east: [8, 22],
        },
        blocked: 'pushing',
        moving: {
            north: [[0, 22], [1, 22], [2, 22], [3, 22], [4, 22], [5, 22], [6, 22], [7, 22]],
            east: [[8, 22], [9, 22], [10, 22], [11, 22], [12, 22], [13, 22], [14, 22], [15, 22]],
            south: [[0, 23], [1, 23], [2, 23], [3, 23], [4, 23], [5, 23], [6, 23], [7, 23]],
            west: [[8, 23], [9, 23], [10, 23], [11, 23], [12, 23], [13, 23], [14, 23], [15, 23]],
        },
        pushing: {
            north: [8, 24],
            east: [9, 24],
            south: [10, 24],
            west: [11, 24],
        },
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
        // These are frames from the splash/explosion animations
        drowned: [5, 5],
        burned: [1, 5],
        exploded: [1, 5],
        failed: [1, 5],
    },
    bogus_player_win: {
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
        overlay: [5, 5],  // splash
        base: 'water',
    },
    bogus_player_burned_fire: {
        overlay: [2, 5],  // explosion frame 3
        base: 'fire',
    },
    bogus_player_burned: {
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
        special: 'logic-gate',
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
        // These are frames from the splash/explosion animations
        drowned: [5, 5],
        burned: [1, 5],
        exploded: [1, 5],
        failed: [1, 5],
    },
    fire: [
        [12, 29],
        [13, 29],
        [14, 29],
        [15, 29],
    ],

    // TODO handle train tracks!  this is gonna be complicated.
    railroad: [9, 10],
    railroad_sign: [4, 31],
    dirt: [4, 31],
    no_player2_sign: [5, 31],
    no_player1_sign: [6, 31],
    // misc other stuff
};

// XXX need to specify that you can't use this for cc2 levels, somehow
export const TILE_WORLD_TILESET_LAYOUT = {
    floor: [0, 0],
    wall: [0, 1],
    chip: [0, 2],
    water: [0, 3],
    fire: [0, 4],
    wall_invisible: [0, 5],
    thinwall_n: [0, 6],
    thinwall_w: [0, 7],
    thinwall_s: [0, 8],
    thinwall_e: [0, 9],
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
        closed: [2, 11],
        open: [2, 11],
    },
    wall_appearing: [2, 12],
    gravel: [2, 13],
    popwall: [2, 14],
    popwall2: [2, 14],
    hint: [2, 15],

    thinwall_se: [3, 0],
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
};

export const LL_TILESET_LAYOUT = Object.assign({}, CC2_TILESET_LAYOUT, {
    // Completed teeth sprites
    teeth: Object.assign({}, CC2_TILESET_LAYOUT.teeth, {
        north: [[0, 32], [1, 32], [2, 32], [1, 32]],
    }),

    // Extra player sprites
    player: Object.assign({}, CC2_TILESET_LAYOUT.player, {
        skating: {
            north: [0, 33],
            east: [1, 33],
            south: [2, 33],
            west: [3, 33],
        },
        forced: 'skating',
        burned: {
            north: [4, 33],
            east: [5, 33],
            south: [6, 33],
            west: [7, 33],
        },
    }),
    // TODO player2 equivalents
    bogus_player_burned_fire: {
        overlay: [6, 33],
        base: 'fire',
    },
    bogus_player_burned: {
        overlay: [6, 33],
        base: 'floor',
    },

    // Custom tiles
    popwall2: [9, 32],
    bestowal_bow: [10, 32],
});

export class Tileset {
    constructor(image, layout, size_x, size_y) {
        this.image = image;
        this.layout = layout;
        this.size_x = size_x;
        this.size_y = size_y;
        this.animation_slowdown = 2;
    }

    draw(tile, tic, blit) {
        this.draw_type(tile.type.name, tile, tic, blit);
    }

    // Draw a "standard" drawspec, which is either:
    // - a single tile: [x, y]
    // - an animation: [[x0, y0], [x1, y1], ...]
    // - a directional tile: { north: T, east: T, ... } where T is either of the above
    _draw_standard(drawspec, tile, tic, blit, mask = []) {
        // If we have an object, it must be a table of directions
        let coords = drawspec;
        if (!(coords instanceof Array)) {
            coords = coords[(tile && tile.direction) ?? 'south'];
        }

        // Deal with animation
        if (coords[0] instanceof Array) {
            if (tic !== null) {
                if (tile && tile.animation_speed) {
                    // This tile reports its own animation timing (in tics), so trust that, and just
                    // use the current tic's fraction.
                    // That said: adjusting animation speed complicates this slightly.  Consider the
                    // player's walk animation, which takes 4 tics to complete, during which time we
                    // cycle through 8 frames.  Playing that at half speed means only half the
                    // animation actually plays, but if the player continues walking, then on the
                    // NEXT four tics, we should play the other half.  To make this work, use the
                    // tic as a global timer as well: if the animation started on tics 0-4, play the
                    // first half; if it started on tics 5-8, play the second half.  They could get
                    // out of sync if the player hesitates, but no one will notice that, and this
                    // approach minimizes storing extra state.
                    let i = (tile.animation_progress + tic % 1) / tile.animation_speed;
                    // But do NOT do this for explosions or splashes, which have a fixed duration
                    // and only play once
                    if (this.animation_slowdown > 1 && ! tile.type.ttl) {
                        // i ranges from [0, 1), but a slowdown of N means we'll only play the first
                        // 1/N of it before the game ends (or loops) the animation.
                        // So increase by [0..N-1] to get it in some other range, then divide by N
                        // to scale back down to [0, 1)
                        i += Math.floor(tic / tile.animation_speed % this.animation_slowdown);
                        i /= this.animation_slowdown;
                    }
                    coords = coords[Math.floor(i * coords.length)];
                }
                else {
                    // This tile animates on a global timer, one cycle every quarter of a second
                    coords = coords[Math.floor(tic / this.animation_slowdown % 5 / 5 * coords.length)];
                }
            }
            else {
                coords = coords[0];
            }
        }

        blit(coords[0], coords[1], ...mask);
    }

    _draw_logic_gate(drawspec, tile, tic, blit) {
        // Layer 1: wiring state
        // Always draw the unpowered wire base
        let unpowered_coords = this.layout['#unpowered'];
        let powered_coords = this.layout['#powered'];
        blit(...unpowered_coords);
        if (tile && tile.cell) {
            // What goes on top varies a bit...
            // FIXME implement for NOT and counter!
            let r = this.layout['#wire-width'] / 2;
            if (tile.cell.powered_edges & DIRECTIONS[tile.direction].bit) {
                // Output (on top)
                let [x0, y0, x1, y1] = this._rotate(tile.direction, 0.5 - r, 0, 0.5 + r, 0.5);
                blit(powered_coords[0], powered_coords[1], x0, y0, x1 - x0, y1 - y0);
            }
            if (tile.cell.powered_edges & DIRECTIONS[DIRECTIONS[tile.direction].right].bit) {
                // Right input, which includes the middle
                let [x0, y0, x1, y1] = this._rotate(tile.direction, 0.5 - r, 0.5 - r, 1, 1);
                blit(powered_coords[0], powered_coords[1], x0, y0, x1 - x0, y1 - y0);
            }
            if (tile.cell.powered_edges & DIRECTIONS[DIRECTIONS[tile.direction].left].bit) {
                // Left input, which does not include the middle
                let [x0, y0, x1, y1] = this._rotate(tile.direction, 0, 0.5 - r, 0.5 - r, 1);
                blit(powered_coords[0], powered_coords[1], x0, y0, x1 - x0, y1 - y0);
            }
        }

        // Layer 2: the tile itself
        this._draw_standard(drawspec.logic_gate_tiles[tile.gate_type], tile, tic, blit);

        // Layer 3: counter number
        if (tile.gate_type === 'counter') {
            blit(0, 3, tile.memory * 0.75, 0, 0.75, 1, 0.125, 0);
        }
    }

    // Draws a tile type, given by name.  Passing in a tile is optional, but
    // without it you'll get defaults.
    draw_type(name, tile, tic, blit) {
        let drawspec = this.layout[name];
        if (! drawspec) {
            console.error(`Don't know how to draw tile type ${name}!`);
            return;
        }

        if (drawspec.overlay) {
            // Goofy overlay thing used for green/purple toggle tiles and
            // southeast thin walls.  Draw the base (a type name), then draw
            // the overlay (either a type name or a regular draw spec).
            // TODO chance of infinite recursion here
            this.draw_type(drawspec.base, tile, tic, blit);
            if (typeof drawspec.overlay === 'string') {
                this.draw_type(drawspec.overlay, tile, tic, blit);
                return;
            }
            else {
                drawspec = drawspec.overlay;
            }
        }

        // TODO shift everything to use this style, this is ridiculous
        if (drawspec.special) {
            if (drawspec.special === 'logic-gate') {
                this._draw_logic_gate(drawspec, tile, tic, blit);
                return;
            }
        }

        let coords = drawspec;
        if (drawspec.mask) {
            // Some tiles (OK, just the thin walls) don't actually draw a full
            // tile, so some adjustments are needed; see below
            coords = drawspec.tile;
        }
        else if (drawspec.wired) {
            // This /should/ match CC2's draw order exactly, based on experimentation
            let wire_radius = this.layout['#wire-width'] / 2;
            if (tile && tile.wire_directions === 0x0f) {
                // This is a wired tile with crossing wires, which acts a little differently
                // Draw the base tile
                blit(drawspec.base[0], drawspec.base[1]);

                // Draw the two wires as separate rectangles, NS then EW
                let wire_inset = 0.5 - wire_radius;
                let wire_coords_ns = this.layout[
                    tile.cell && tile.cell.powered_edges & DIRECTIONS['north'].bit ? '#powered' : '#unpowered'];
                let wire_coords_ew = this.layout[
                    tile.cell && tile.cell.powered_edges & DIRECTIONS['east'].bit ? '#powered' : '#unpowered'];
                blit(wire_coords_ns[0], wire_coords_ns[1], wire_inset, 0, wire_radius * 2, 1);
                blit(wire_coords_ew[0], wire_coords_ew[1], 0, wire_inset, 1, wire_radius * 2);

                // Draw the cross tile on top
                coords = drawspec.wired_cross ?? drawspec.wired;
            }
            else if (tile && tile.wire_directions) {
                // Draw the base tile
                blit(drawspec.base[0], drawspec.base[1]);

                // Draw the wire part as a single rectangle, initially just a small dot in the
                // center, but extending out to any edge that has a wire present
                let x0 = 0.5 - wire_radius;
                let x1 = 0.5 + wire_radius;
                let y0 = 0.5 - wire_radius;
                let y1 = 0.5 + wire_radius;
                if (tile.wire_directions & DIRECTIONS['north'].bit) {
                    y0 = 0;
                }
                if (tile.wire_directions & DIRECTIONS['east'].bit) {
                    x1 = 1;
                }
                if (tile.wire_directions & DIRECTIONS['south'].bit) {
                    y1 = 1;
                }
                if (tile.wire_directions & DIRECTIONS['west'].bit) {
                    x0 = 0;
                }
                let wire_coords = this.layout[tile.cell && tile.cell.powered_edges ? '#powered' : '#unpowered'];
                blit(wire_coords[0], wire_coords[1], x0, y0, x1 - x0, y1 - y0);

                // Then draw the wired tile on top of it all
                coords = drawspec.wired;
            }
            else {
                // There's no wiring here, so just draw the base and then draw the wired part on top
                // as normal.  If the wired part is optional (as is the case for flooring in the CC2
                // tileset), draw the base as normal instead.
                if (drawspec.is_wired_optional) {
                    coords = drawspec.base;
                }
                else {
                    blit(drawspec.base[0], drawspec.base[1]);
                    coords = drawspec.wired;
                }
            }
        }
        else if (drawspec.arrows) {
            // Directional blocks have a specific overlay, but draw the base first
            coords = drawspec.base;
        }
        else if (drawspec.animate_width) {
            // Force floors animate their...  cutout, I guess?
            let [x, y] = drawspec.base;
            let duration = 3 * this.animation_slowdown;
            x += drawspec.animate_width * (tic % duration / duration);
            // Round to tile width
            x = Math.floor(x * this.size_x + 0.5) / this.size_x;
            coords = [x, y];
        }
        else if (drawspec.animate_height) {
            // Same, but along the other axis
            let [x, y] = drawspec.base;
            let duration = 3 * this.animation_slowdown;
            y += drawspec.animate_height * (tic % duration / duration);
            // Round to tile height
            y = Math.floor(y * this.size_y + 0.5) / this.size_y;
            coords = [x, y];
        }

        // Apply custom per-type visual states
        if (TILE_TYPES[name] && TILE_TYPES[name].visual_state) {
            // Note that these accept null, too, and return a default
            let state = TILE_TYPES[name].visual_state(tile);
            // If it's a string, that's an alias for another state
            if (typeof coords[state] === 'string') {
                coords = coords[coords[state]];
            }
            else {
                coords = coords[state];
            }

            if (! coords) {
                console.warn("No such state", state, "for tile", name, tile);
            }
        }

        // Generic sprite definitions from here on!
        // If we still have an object, it must be a table of directions
        if (!(coords instanceof Array)) {
            coords = coords[(tile && tile.direction) ?? 'south'];
        }

        // Deal with animation
        if (coords[0] instanceof Array) {
            if (tic !== null) {
                if (tile && tile.animation_speed) {
                    // This tile reports its own animation timing (in tics), so trust that, and just
                    // use the current tic's fraction.
                    // That said: adjusting animation speed complicates this slightly.  Consider the
                    // player's walk animation, which takes 4 tics to complete, during which time we
                    // cycle through 8 frames.  Playing that at half speed means only half the
                    // animation actually plays, but if the player continues walking, then on the
                    // NEXT four tics, we should play the other half.  To make this work, use the
                    // tic as a global timer as well: if the animation started on tics 0-4, play the
                    // first half; if it started on tics 5-8, play the second half.  They could get
                    // out of sync if the player hesitates, but no one will notice that, and this
                    // approach minimizes storing extra state.
                    let i = (tile.animation_progress + tic % 1) / tile.animation_speed;
                    // But do NOT do this for explosions or splashes, which have a fixed duration
                    // and only play once
                    if (this.animation_slowdown > 1 && ! tile.type.ttl) {
                        // i ranges from [0, 1), but a slowdown of N means we'll only play the first
                        // 1/N of it before the game ends (or loops) the animation.
                        // So increase by [0..N-1] to get it in some other range, then divide by N
                        // to scale back down to [0, 1)
                        i += Math.floor(tic / tile.animation_speed % this.animation_slowdown);
                        i /= this.animation_slowdown;
                    }
                    coords = coords[Math.floor(i * coords.length)];
                }
                else {
                    // This tile animates on a global timer, one cycle every quarter of a second
                    coords = coords[Math.floor(tic / this.animation_slowdown % 5 / 5 * coords.length)];
                }
            }
            else {
                coords = coords[0];
            }
        }

        if (drawspec.mask) {
            // Continue on with masking
            coords = drawspec.tile;
            let [x0, y0, w, h] = drawspec.mask;
            blit(coords[0], coords[1], x0, y0, w, h);
        }
        else {
            if (!coords) console.error(name, tile);
            blit(coords[0], coords[1]);
        }

        // Wired tiles may also have tunnels, drawn on top of everything else
        if (drawspec.wired && tile && tile.wire_tunnel_directions) {
            let tunnel_coords = this.layout['#wire-tunnel'];
            let tunnel_width = 6/32;
            let tunnel_length = 12/32;
            let tunnel_offset = (1 - tunnel_width) / 2;
            if (tile.wire_tunnel_directions & DIRECTIONS['north'].bit) {
                blit(tunnel_coords[0], tunnel_coords[1],
                    tunnel_offset, 0, tunnel_width, tunnel_length);
            }
            if (tile.wire_tunnel_directions & DIRECTIONS['south'].bit) {
                blit(tunnel_coords[0], tunnel_coords[1],
                    tunnel_offset, 1 - tunnel_length, tunnel_width, tunnel_length);
            }
            if (tile.wire_tunnel_directions & DIRECTIONS['west'].bit) {
                blit(tunnel_coords[0], tunnel_coords[1],
                    0, tunnel_offset, tunnel_length, tunnel_width);
            }
            if (tile.wire_tunnel_directions & DIRECTIONS['east'].bit) {
                blit(tunnel_coords[0], tunnel_coords[1],
                    1 - tunnel_length, tunnel_offset, tunnel_length, tunnel_width);
            }
        }

        // Directional blocks have arrows drawn on top
        // TODO does cc2 draw even if there are no arrows?
        if (drawspec.arrows && tile && tile.arrows) {
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
            blit(x, y, x0, y0, x1 - x0, y1 - y0);
        }

        // Special behavior for special objects
        // TODO? hardcode this less?
        if (name === 'floor_letter') {
            let n = tile.ascii_code - 32;
            let scale = 0.5;
            let sx, sy;
            if (n < 0) {
                // Arrows
                if (n < -4) {
                    // Default to south
                    n = -2;
                }

                let direction = ['north', 'east', 'south', 'west'][n + 4];
                [sx, sy] = this.layout['floor_letter#arrows'][direction];
            }
            else {
                // ASCII text (only up through uppercase)
                let letter_spec = this.layout['floor_letter#ascii'];
                if (n > letter_spec.width / scale * letter_spec.height / scale) {
                    n = 0;
                }
                let w = letter_spec.width / scale;
                sx = (letter_spec.x0 + n % w) * scale;
                sy = (letter_spec.y0 + Math.floor(n / w)) * scale;
            }
            let offset = (1 - scale) / 2;
            blit(sx, sy, 0, 0, 0.5, 0.5, offset, offset);
        }
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
