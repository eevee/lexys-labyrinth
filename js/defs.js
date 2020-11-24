export const TICS_PER_SECOND = 20;

export const DIRECTIONS = {
    north: {
        movement: [0, -1],
        bit: 0x01,
        action: 'up',
        left: 'west',
        right: 'east',
        opposite: 'south',
    },
    south: {
        movement: [0, 1],
        bit: 0x04,
        action: 'down',
        left: 'east',
        right: 'west',
        opposite: 'north',
    },
    west: {
        movement: [-1, 0],
        bit: 0x08,
        action: 'left',
        left: 'south',
        right: 'north',
        opposite: 'east',
    },
    east: {
        movement: [1, 0],
        bit: 0x02,
        action: 'right',
        left: 'north',
        right: 'south',
        opposite: 'west',
    },
};

// TODO cc2 order is: swivel, thinwalls, canopy (and yes you can have them all in the same tile)
export const DRAW_LAYERS = {
    terrain: 0,
    item: 1,
    item_mod: 2,
    actor: 3,
    overlay: 4,
    MAX: 5,
};

export const COLLISION = {
    player1:            0x0001,
    player2:            0x0002,
    player:             0x0003,

    block_cc1:          0x0004,
    block_cc2:          0x0008,  // ice + directional

    // NOTE: "monster" does NOT include ghost, because it so rarely overlaps anything else
    monster:            0x0100,
    // Some monsters also have their own extra flag because of weird behavior
    fireball:           0x0200,
    bug:                0x0400,
    rover:              0x1000,
    ghost:              0x8000,

    // Combo masks used for matching
    all_but_ghost:      0xffff & ~0x8000,
    all_but_player:     0xffff & ~0x0003,
    all:                0xffff,
};
