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

export const TILE_WORLD_TILESET_LAYOUT = {
    floor: [0, 0],
    wall: [0, 1],
    thinwall_n: [0, 6],
    thinwall_w: [0, 7],
    thinwall_s: [0, 8],
    thinwall_e: [0, 9],
    ice: [0, 12],

    ice_sw: [1, 13],
    ice_nw: [1, 10],
    ice_ne: [1, 11],
    ice_se: [1, 12],
    water: [0, 3],
    fire: [0, 4],
    force_floor_n: [1, 2],
    force_floor_e: [1, 3],
    force_floor_s: [0, 13],
    force_floor_w: [1, 4],
    // TODO there are two of these, which seems self-defeating??
    fake_wall: [1, 14],
    fake_floor: [1, 15],

    exit: [[3, 10], [3, 11]],

    player: {
        north: [6, 12],
        south: [6, 14],
        west: [6, 13],
        east: [6, 15],
    },
    cloner: [3, 1],
    player_drowned: [3, 3],
    player_burned: [3, 4],
    // TODO the tileset has several of these...?  why?
    dirt_block: [0, 10],

    door_red: [1, 7],
    door_blue: [1, 6],
    door_yellow: [1, 9],
    door_green: [1, 8],
    key_red: [6, 5],
    key_blue: [6, 4],
    key_yellow: [6, 7],
    key_green: [6, 6],
    chip: [0, 2],
    // XXX can't use for cc2 levels, need to specify that somehow
    //chip_extra: [10, 3],
    socket: [2, 2],

    dirt: [0, 11],
    bug: {
        north: [4, 0],
        east: [4, 3],
        south: [4, 2],
        west: [4, 1],
    },
    fireball: {
        north: [4, 4],
        east: [4, 7],
        south: [4, 6],
        west: [4, 5],
    },
    ball: {
        north: [4, 8],
        east: [4, 11],
        south: [4, 10],
        west: [4, 9],
    },
    tank_blue: {
        north: [4, 12],
        east: [4, 15],
        south: [4, 14],
        west: [4, 5],
    },
    glider: {
        north: [5, 0],
        east: [5, 3],
        south: [5, 2],
        west: [5, 1],
    },
    teeth: {
        north: [5, 4],
        east: [5, 7],
        south: [5, 6],
        west: [5, 5],
    },
    walker: {
        north: [5, 8],
        east: [5, 11],
        south: [5, 10],
        west: [5, 9],
    },
    blob: {
        north: [5, 12],
        east: [5, 15],
        south: [5, 14],
        west: [5, 5],
    },

    paramecium: {
        north: [6, 0],
        east: [6, 3],
        south: [6, 2],
        west: [6, 1],
    },

    cleats: [6, 10],
    suction_boots: [6, 11],
    fire_boots: [6, 9],
    flippers: [6, 8],

    hint: [2, 15],
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
