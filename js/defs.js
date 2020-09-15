export const TICS_PER_SECOND = 20;

export const DIRECTIONS = {
    north: {
        movement: [0, -1],
        bit: 0x01,
        left: 'west',
        right: 'east',
        opposite: 'south',
    },
    south: {
        movement: [0, 1],
        bit: 0x04,
        left: 'east',
        right: 'west',
        opposite: 'north',
    },
    west: {
        movement: [-1, 0],
        bit: 0x08,
        left: 'south',
        right: 'north',
        opposite: 'east',
    },
    east: {
        movement: [1, 0],
        bit: 0x02,
        left: 'north',
        right: 'south',
        opposite: 'west',
    },
};
