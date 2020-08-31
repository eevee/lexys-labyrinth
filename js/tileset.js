export const CC2_TILESET_LAYOUT = {
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

    floor: [0, 2],
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
    // ice block, xray
    score_10: [14, 2],
    score_100: [13, 2],
    score_1000: [12, 2],
    score_2x: [15, 2],

    // LCD digit font
    green_chip: [10, 3],
    chip_extra: [10, 3],
    chip: [11, 3],
    // bribe
    // mercury boot
    // canopy, xray

    // tnt
    bomb: [5, 4],
    green_bomb: [6, 4],
    // ??? tiny fireworks
    // custom floors
    // custom walls

    // explosion
    // splash
    // flame jet
    // green walls...?
    forbidden: [14, 5],
    // directional block frame, i think?

    flippers: [0, 6],
    fire_boots: [1, 6],
    cleats: [2, 6],
    suction_boots: [3, 6],
    hiking_boots: [4, 6],
    // speed boots...?  not boots though
    // weird translucent spiral
    // weird translucent red
    button_blue: [8, 6],
    button_green: [9, 6],
    button_red: [10, 6],
    button_brown: [11, 6],
    button_pink: [12, 6],
    button_black: [13, 6],
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
    // TODO state (10 is closed)
    trap: [9, 9],
    button_gray: [11, 9],
    fireball: [[12, 9], [13, 9], [14, 9], [15, 9]],

    fake_wall: [0, 10],
    fake_floor: [0, 10],
    // TODO thin walls are built piecemeal, sigh
    // TODO directional block arrows
    teleport_blue: [[4, 10], [5, 10], [6, 10], [7, 10]],
    popwall: [8, 10],
    gravel: [9, 10],
    ball: [[10, 10], [11, 10], [12, 10], [13, 10], [14, 10]],
    steel: [15, 10],

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
    // TODO some kinda four-edges thing again
    // TODO stopwatch with a - sign??
    paramecium: {
        north: [[0, 12], [1, 12], [2, 12]],
        east: [[3, 12], [4, 12], [5, 12]],
        south: [[6, 12], [7, 12], [8, 12]],
        west: [[9, 12], [10, 12], [11, 12]],
    },
    foil: [12, 12],
    turtle: [13, 12],  // TODO also 14 + 15 for sinking

    walker: [0, 13],
    // TODO walker animations span multiple tiles, rgh
    helmet: [0, 14],
    // 14: stopwatch
    // 15: stopwatch with +

    blob: [0, 15],
    // TODO blob animations also span multiple tiles
    // TODO [0, 16] some kinda red/blue outline
    mimic: [14, 16],
    // TODO [15, 16] some kinda yellow/black outline

    // timid teeth
    // bowling ball
    tank_yellow: {
        north: [[8, 17], [9, 17]],
        east: [[10, 17], [11, 17]],
        south: [[12, 17], [13, 17]],
        west: [[14, 17], [15, 17]],
    },

    // TODO saucer, has layers and moves and stuff
    eyeball: [11, 18],
    ghost: {
        north: [12, 18],
        east: [13, 18],
        south: [14, 18],
        west: [15, 18],
    },

    force_floor_n: [[0, 19], [0, 20]],
    force_floor_e: [[2, 19], [3, 19]],
    force_floor_s: [[1, 19], [1, 20]],
    force_floor_w: [[2, 20], [3, 20]],
    teleport_green: [[4, 19], [5, 19], [6, 19], [7, 19]],
    teleport_yellow: [[8, 19], [9, 19], [10, 19], [11, 19]],
    // TODO round, thing, not sure what
    teleport_red: [[4, 20], [5, 20], [6, 20], [7, 20]],
    slime: [[8, 20], [9, 20], [10, 20], [11, 20], [12, 20], [13, 20], [14, 20], [15, 20]],

    force_floor_all: [[0, 21], [1, 21], [2, 21], [3, 21], [4, 21], [5, 21], [6, 21], [7, 21]],
    // latches
    // switch
    thief_keys: [15, 21],

    // TODO moving + swimming + pushing animations
    player: {
        north: [0, 22],
        south: [0, 23],
        west: [8, 23],
        east: [8, 22],
    },
    water: [
        [12, 24],
        [13, 24],
        [14, 24],
        [15, 24],
    ],

    // TODO melinda, same layout as chip
    fire: [
        [12, 29],
        [13, 29],
        [14, 29],
        [15, 29],
    ],

    // TODO these shouldn't loop and also seem to be more general
    player_drowned: [[4, 5], [5, 5], [6, 5], [7, 5]],
    player_burned: [[0, 5], [1, 5], [2, 5], [3, 5]],

    // train tracks, which are layered...
    dirt: [4, 31],
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
    dirt_block: [0, 10],
    dirt: [0, 11],
    ice: [0, 12],
    force_floor_s: [0, 13],
    // These are "moving blocks", the ones used by cloners
    // TODO uhh which should i use here.
    /*
    dirt_block: {
        north: [0, 14],
        west: [0, 15],
        south: [1, 0],
        east: [1, 1],
    },
    */

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
    trap: [2, 11],
    wall_appearing: [2, 12],
    gravel: [2, 13],
    popwall: [2, 14],
    hint: [2, 15],

    thinwall_se: [3, 0],
    cloner: [3, 1],
    force_floor_all: [3, 2],
    player_drowned: [3, 3],
    player_burned: [3, 4],
    player_bombed: [3, 5],
    explosion_bomb: [3, 6],
    explosion_other: [3, 7],
    // 3, 8 unused
    player_exiting: [3, 9],
    // 3, 10 and 11 are "exit_extra_{1,2}" 
    // TODO player swimming is 3, 12-15

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
        north: [6, 12],
        south: [6, 14],
        west: [6, 13],
        east: [6, 15],
    },
};

export class Tileset {
    constructor(image, layout, size_x, size_y) {
        this.image = image;
        this.layout = layout;
        this.size_x = size_x;
        this.size_y = size_y;
    }

    // Helper to draw to a canvas using tile coordinates
    blit(ctx, sx, sy, dx, dy, scale = 1) {
        let w = this.size_x * scale;
        let h = this.size_y * scale;
        ctx.drawImage(
            this.image,
            sx * this.size_x, sy * this.size_y, w, h,
            dx * this.size_x, dy * this.size_y, w, h);
    }

    draw(tile, ctx, x, y) {
        let name = tile.type.name;
        let drawspec = this.layout[name];
        let coords = drawspec;
        if (! coords) console.error(name);

        let overlay;
        if (coords.overlay) {
            // Goofy overlay thing used for green/purple toggle tiles
            overlay = coords.overlay;
            coords = this.layout[coords.base];
        }

        if (!(coords instanceof Array)) {
            // Must be an object of directions
            coords = coords[tile.direction ?? 'south'];
        }
        if (coords[0] instanceof Array) {
            coords = coords[0];
        }

        this.blit(ctx, coords[0], coords[1], x, y);
        if (overlay) {
            this.blit(ctx, overlay[0], overlay[1], x, y);
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
            this.blit(
                ctx, sx, sy,
                x + offset, y + offset, scale);
        }
    }
}
