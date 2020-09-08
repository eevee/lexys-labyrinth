// TODO really need to specify this format more concretely, whoof
// XXX special kinds of drawing i know this has for a fact:
// - letter tiles draw from a block of half-tiles onto the center of the base
// - slime and walkers have double-size tiles when moving
// - wired tiles are a whole thing
// - thin walls are packed into just two tiles
// - saucer has a half-tile overlay for its direction?
// - railroad tracks overlay a Lot
// - directional blocks have arrows in an awkward layout, not 4x4 grid but actually positioned on the edges
// - green and purple toggle walls use an overlay
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
    clone_block: [8, 1],
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
    trap: {
        closed: [9, 9],
        open: [10, 9],
    },
    button_gray: [11, 9],
    fireball: [[12, 9], [13, 9], [14, 9], [15, 9]],

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
    turtle: {
        // Turtles draw atop fake water, but don't act like water otherwise
        overlay: [13, 12],  // TODO also 14 + 15 for sinking
        base: 'water',
    },

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
        moving: {
            north: [[0, 22], [1, 22], [2, 22], [3, 22], [4, 22], [5, 22], [6, 22], [7, 22]],
            south: [[0, 23], [1, 23], [2, 23], [3, 23], [4, 23], [5, 23], [6, 23], [7, 23]],
            west: [[8, 23], [9, 23], [10, 23], [11, 23], [12, 23], [13, 23], [14, 23], [15, 23]],
            east: [[8, 22], [9, 22], [10, 22], [11, 22], [12, 22], [13, 22], [14, 22], [15, 22]],
        },
        standing: {
            north: [0, 22],
            south: [0, 23],
            west: [8, 23],
            east: [8, 22],
        },
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
    clone_block: {
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
    blit(ctx, sx, sy, dx, dy, scale_x = 1, scale_y = scale_x) {
        let w = this.size_x * scale_x;
        let h = this.size_y * scale_y;
        ctx.drawImage(
            this.image,
            sx * this.size_x, sy * this.size_y, w, h,
            dx * this.size_x, dy * this.size_y, w, h);
    }

    draw(tile, level, ctx, x, y) {
        this.draw_type(tile.type.name, tile, level, ctx, x, y);
    }

    // Draws a tile type, given by name.  Passing in a tile is optional, but
    // without it you'll get defaults.
    draw_type(name, tile, level, ctx, x, y) {
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
            this.draw_type(drawspec.base, tile, level, ctx, x, y);
            if (typeof drawspec.overlay === 'string') {
                this.draw_type(drawspec.overlay, tile, level, ctx, x, y);
                return;
            }
            else {
                drawspec = drawspec.overlay;
            }
        }

        let coords = drawspec;
        if (drawspec.mask) {
            // Some tiles (OK, just the thin walls) don't actually draw a full
            // tile, so some adjustments are needed; see below
            coords = drawspec.tile;
        }

        // Unwrap animations etc.
        if (!(coords instanceof Array)) {
            // Must be an object of either tile-specific state, or directions
            if (name === 'trap') {
                if (tile && tile.open) {
                    coords = coords.open;
                }
                else {
                    coords = coords.closed;
                }
            }
            else {
                // TODO this is getting really ad-hoc and clumsy lol, maybe
                // have tiles expose a single 'state' prop or something
                if (coords.moving) {
                    if (tile && tile.animation_speed) {
                        coords = coords.moving;
                    }
                    else {
                        coords = coords.standing;
                    }
                }
                coords = coords[(tile && tile.direction) ?? 'south'];
            }
        }
        if (coords[0] instanceof Array) {
            if (level) {
                if (tile && tile.animation_speed) {
                    coords = coords[Math.floor((tile.animation_progress + level.tic_offset) / tile.animation_speed * coords.length)];
                }
                else {
                    // FIXME tic_counter doesn't exist on stored levels...
                    coords = coords[Math.floor(((level.tic_counter ?? 0) % 5 + level.tic_offset) / 5 * coords.length)];
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
            this.blit(
                ctx,
                coords[0] + x0,
                coords[1] + y0,
                x + x0,
                y + y0,
                w, h);
        }
        else {
            this.blit(ctx, coords[0], coords[1], x, y);
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
