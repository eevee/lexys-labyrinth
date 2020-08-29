export const CC2_TILESET_LAYOUT = {
    floor: [0, 2],
    floor_letter: [2, 2],
    wall: [1, 2],

    fire: [
        [12, 29],
        [13, 29],
        [14, 29],
        [15, 29],
    ],
    water: [
        [12, 24],
        [13, 24],
        [14, 24],
        [15, 24],
    ],
    ice: [10, 1],
    ice_sw: [12, 1],
    ice_nw: [14, 1],
    ice_ne: [13, 1],
    ice_se: [11, 1],
    force_floor_n: [[0, 19], [0, 20]],
    force_floor_e: [[2, 19], [2, 20]],
    force_floor_s: [[1, 19], [1, 20]],
    force_floor_w: [[3, 19], [3, 20]],
    thief_keys: [15, 21],
    thief_tools: [3, 2],

    // TODO these guys don't have floor underneath.
    swivel_sw: [9, 11],
    swivel_nw: [10, 11],
    swivel_ne: [12, 11],
    swivel_se: [13, 11],
    forbidden: [14, 5],
    turtle: [13, 12],  // TODO also 14 + 15 for sinking
    popwall: [8, 10],
    bomb: [5, 4],


    exit: [
        [6, 2],
        [7, 2],
        [8, 2],
        [9, 2],
    ],

    // TODO moving + swimming + pushing animations
    player: {
        north: [0, 22],
        south: [0, 23],
        west: [8, 23],
        east: [8, 22],
    },
    // TODO these shouldn't loop
    player_drowned: [[4, 5], [5, 5], [6, 5], [7, 5]],
    player_burned: [[0, 5], [1, 5], [2, 5], [3, 5]],
    dirt_block: [8, 1],

    door_red: [0, 1],
    door_blue: [1, 1],
    door_yellow: [2, 1],
    door_green: [3, 1],
    key_red: [4, 1],
    key_blue: [5, 1],
    key_yellow: [6, 1],
    key_green: [7, 1],
    chip: [11, 3],
    chip_extra: [10, 3],
    socket: [4, 2],

    dirt: [4, 31],
    bug: {
        north: [[0, 7], [1, 7], [2, 7], [3, 7]],
        east: [[4, 7], [5, 7], [6, 7], [7, 7]],
        south: [[8, 7], [9, 7], [10, 7], [11, 7]],
        west: [[12, 7], [13, 7], [14, 7], [15, 7]],
    },

    ball: [[10, 10], [11, 10], [12, 10], [13, 10], [14, 10]],

    fireball: [[12, 9], [13, 9], [14, 9], [15, 9]],

    cleats: [2, 6],
    suction_boots: [3, 6],
    fire_boots: [1, 6],
    flippers: [0, 6],

    hint: [5, 2],

    score_10: [14, 1],
    score_100: [13, 1],
    score_1000: [12, 1],
    score_2x: [15, 1],
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

    draw(tile, ctx, x, y) {
        let drawspec = this.layout[tile.type.name];
        let coords = drawspec;
        if (! coords) console.error(tile.type.name);
        if (!(coords instanceof Array)) {
            // Must be an object of directions
            coords = coords[tile.direction ?? 'south'];
        }
        if (coords[0] instanceof Array) {
            coords = coords[0];
        }

        ctx.drawImage(
            this.image,
            coords[0] * this.size_x, coords[1] * this.size_y, this.size_x, this.size_y,
            x * this.size_x, y * this.size_y, this.size_x, this.size_y);
    }
}
