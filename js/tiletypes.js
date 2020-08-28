export const TILE_TYPES = {
    floor: {
        cc2_byte: 0x01,
    },
    wall: {
        cc2_byte: 0x02,
        blocks: true,
    },
    ice: {
        cc2_byte: 0x03,
    },
    ice_sw: {
        cc2_byte: 0x04,
        thin_walls: {
            south: true,
            west: true,
        },
    },
    ice_nw: {
        cc2_byte: 0x05,
        thin_walls: {
            north: true,
            west: true,
        },
    },
    ice_ne: {
        cc2_byte: 0x06,
        thin_walls: {
            north: true,
            east: true,
        },
    },
    ice_se: {
        cc2_byte: 0x07,
        thin_walls: {
            south: true,
            east: true,
        },
    },
    water: {
        cc2_byte: 0x08,
        on_arrive(me, level, other) {
            // TODO cc1 allows items under water, i think; water was on the upper layer
            if (other.type.name == 'dirt_block') {
                other.destroy();
                me.become('dirt');
            }
            else if (other.type.is_player) {
                level.fail("Oops!  You can't swim without flippers!");
                other.become('player_drowned');
            }
            else {
                other.destroy();
            }
        }
    },
    fire: {
        cc2_byte: 0x09,
        on_arrive(me, level, other) {
            if (other.type.is_player) {
                level.fail("Oops!  You can't walk on fire without fire boots!");
                other.become('player_burned');
            }
            else {
                other.destroy();
            }
        }
    },
    force_floor_n: {
        cc2_byte: 0x0a,
        on_arrive(me, level, other) {
            other.direction = 'north';
            other.is_sliding = true;
        }
    },
    force_floor_e: {
        cc2_byte: 0x0b,
        on_arrive(me, level, other) {
            other.direction = 'east';
            other.is_sliding = true;
        }
    },
    force_floor_s: {
        cc2_byte: 0x0c,
        on_arrive(me, level, other) {
            other.direction = 'south';
            other.is_sliding = true;
        }
    },
    force_floor_w: {
        cc2_byte: 0x0d,
        on_arrive(me, level, other) {
            other.direction = 'west';
            other.is_sliding = true;
        }
    },

    exit: {
        cc2_byte: 0x14,
    },

    player: {
        cc2_byte: 0x16,
        is_actor: true,
        is_player: true,
        has_inventory: true,
        has_direction: true,
        is_top_layer: true,
        pushes: {
            dirt_block: true,
        },
        infinite_items: {
            key_green: true,
        },
    },
    player_drowned: {
        cc2_byte: null,
    },
    player_burned: {
        cc2_byte: null,
    },
    dirt_block: {
        cc2_byte: 0x17,
        blocks: true,
        has_direction: true,
        is_top_layer: true,
    },

    door_red: {
        cc2_byte: 0x22,
        blocks: true,
        on_bump(me, level, other) {
            if (other.type.has_inventory && other.take_item('key_red')) {
                me.type = TILE_TYPES.floor;
            }
        }
    },
    door_blue: {
        cc2_byte: 0x23,
        blocks: true,
        on_bump(me, level, other) {
            if (other.type.has_inventory && other.take_item('key_blue')) {
                me.type = TILE_TYPES.floor;
            }
        }
    },
    door_yellow: {
        cc2_byte: 0x24,
        blocks: true,
        on_bump(me, level, other) {
            if (other.type.has_inventory && other.take_item('key_yellow')) {
                me.type = TILE_TYPES.floor;
            }
        }
    },
    door_green: {
        cc2_byte: 0x25,
        blocks: true,
        on_bump(me, level, other) {
            if (other.type.has_inventory && other.take_item('key_green')) {
                me.type = TILE_TYPES.floor;
            }
        }
    },
    key_red: {
        cc2_byte: 0x26,
        is_top_layer: true,
        is_item: true,
    },
    key_blue: {
        cc2_byte: 0x27,
        is_top_layer: true,
        is_item: true,
    },
    key_yellow: {
        cc2_byte: 0x28,
        is_top_layer: true,
        is_item: true,
    },
    key_green: {
        cc2_byte: 0x29,
        is_top_layer: true,
        is_item: true,
    },
    chip: {
        cc2_byte: 0x2a,
        is_top_layer: true,
        is_chip: true,
        is_required_chip: true,
        on_arrive(me, level, other) {
            if (other.type.is_player) {
                level.collect_chip();
                me.destroy();
            }
        }
    },
    chip_extra: {
        cc2_byte: 0x2b,
        is_chip: true,
        is_top_layer: true,
    },
    socket: {
        cc2_byte: 0x2c,
        blocks: true,
        on_bump(me, level, other) {
            if (other.type.is_player && level.chips_remaining === 0) {
                me.type = TILE_TYPES.floor;
            }
        }
    },

    dirt: {
        cc2_byte: 0x32,
        // TODO block monsters, and melinda only without the hiking boots
        on_arrive(me, level, other) {
            me.become('floor');
        }
    },
    bug: {
        cc2_byte: 0x33,
        is_actor: true,
        has_direction: true,
        is_top_layer: true,
    },

    cleats: {
        cc2_byte: 0x3b,
        is_top_layer: true,
        is_item: true,
        item_ignores: new Set(['ice']),
    },
    suction_boots: {
        cc2_byte: 0x3c,
        is_top_layer: true,
        is_item: true,
        item_ignores: new Set([
            'force_floor_n',
            'force_floor_s',
            'force_floor_e',
            'force_floor_w',
        ]),
    },
    fire_boots: {
        cc2_byte: 0x3d,
        is_top_layer: true,
        is_item: true,
        item_ignores: new Set(['fire']),
    },
    flippers: {
        cc2_byte: 0x3e,
        is_top_layer: true,
        is_item: true,
        item_ignores: new Set(['water']),
    },

    clue: {
        cc2_byte: 0x45,
    },
};


export const CC2_TILE_TYPES = new Array(256);
CC2_TILE_TYPES.fill(null);
for (let [name, tiledef] of Object.entries(TILE_TYPES)) {
    tiledef.name = name;

    if (tiledef.cc2_byte === null)
        continue;

    let existing = CC2_TILE_TYPES[tiledef.cc2_byte];
    if (existing)
        throw new Error(`Duplicate CC2 byte: ${tiledef.cc2_byte} is both '${existing}' and '${name}'`);

    CC2_TILE_TYPES[tiledef.cc2_byte] = name;
}
