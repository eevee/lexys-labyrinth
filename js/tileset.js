export const CC2_TILESET_LAYOUT = {
    floor: [0, 2],
    wall: [1, 2],
    ice: [10, 1],
    ice_sw: [12, 1],
    ice_nw: [14, 1],
    ice_ne: [13, 1],
    ice_se: [11, 1],
    water: [
        [12, 24],
        [13, 24],
        [14, 24],
        [15, 24],
    ],
    fire: [
        [12, 29],
        [13, 29],
        [14, 29],
        [15, 29],
    ],
    force_floor_n: [[0, 19], [0, 20]],
    force_floor_e: [[2, 19], [2, 20]],
    force_floor_s: [[1, 19], [1, 20]],
    force_floor_w: [[3, 19], [3, 20]],

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

    cleats: [2, 6],
    suction_boots: [3, 6],
    fire_boots: [1, 6],
    flippers: [0, 6],

    clue: [5, 2],
};

export const TILE_WORLD_TILESET_LAYOUT = {
    floor: [0, 0],
    wall: [0, 1],
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

    exit: [[3, 10], [3, 11]],

    player: {
        north: [6, 12],
        south: [6, 14],
        west: [6, 13],
        east: [6, 15],
    },
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

    cleats: [6, 10],
    suction_boots: [6, 11],
    fire_boots: [6, 9],
    flippers: [6, 8],

    clue: [2, 15],
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
