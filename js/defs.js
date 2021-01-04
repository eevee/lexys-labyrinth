export const TICS_PER_SECOND = 20;

export const DIRECTIONS = {
    north: {
        movement: [0, -1],
        bit: 0x01,
        opposite_bit: 0x04,
        index: 0,
        action: 'up',
        left: 'west',
        right: 'east',
        opposite: 'south',
    },
    south: {
        movement: [0, 1],
        bit: 0x04,
        opposite_bit: 0x01,
        index: 2,
        action: 'down',
        left: 'east',
        right: 'west',
        opposite: 'north',
    },
    west: {
        movement: [-1, 0],
        bit: 0x08,
        opposite_bit: 0x02,
        index: 3,
        action: 'left',
        left: 'south',
        right: 'north',
        opposite: 'east',
    },
    east: {
        movement: [1, 0],
        bit: 0x02,
        opposite_bit: 0x08,
        index: 1,
        action: 'right',
        left: 'north',
        right: 'south',
        opposite: 'west',
    },
};
// Should match the bit ordering above, and CC2's order
export const DIRECTION_ORDER = ['north', 'east', 'south', 'west'];

export const INPUT_BITS = {
    drop:   0x01,
    down:   0x02,
    left:   0x04,
    right:  0x08,
    up:     0x10,
    swap:   0x20,
    cycle:  0x40,
    // Not real input; used to force advancement for turn-based mode
    wait:   0x8000,
};

export const LAYERS = {
    terrain: 0,
    item: 1,
    item_mod: 2,
    actor: 3,
    vfx: 4,
    swivel: 5,
    thin_wall: 6,
    canopy: 7,

    MAX: 8,
};

export const COLLISION = {
    real_player1:       0x0001,
    real_player2:       0x0002,
    real_player:        0x0003,
    doppel1:            0x0004,
    doppel2:            0x0008,
    doppel:             0x000c,
    playerlike1:        0x0005,
    playerlike2:        0x000a,
    playerlike:         0x000f,

    block_cc1:          0x0010,
    block_cc2:          0x0020,  // ice + frame (+ circuit, etc)
    dropped_item:       0x0040,  // rolling ball, dynamite

    // Monsters are a little complicated, because some of them have special rules, e.g. fireballs
    // aren't blocked by fire.
    // For a monster's MASK, you should use ONLY ONE of these specific monster bits (if
    // appropriate), OR the generic bit -- DO NOT combine them!
    monster_generic:    0x0100,
    fireball:           0x0200,
    bug:                0x0400,
    rover:              0x1000,
    ghost:              0x8000,
    // For a tile's COLLISION, use one of these bit combinations
    monster_solid:      0x7f00,  // everything but ghost
    monster_any:        0xff00,  // everything including ghost

    // Combo masks used for matching
    all_but_ghost:          0xffff & ~0x8000,
    all_but_real_player:    0xffff & ~0x0003,
    all:                    0xffff,
};
