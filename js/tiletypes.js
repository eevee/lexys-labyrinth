const TILE_TYPES = {
    // Floors and walls
    floor: {
    },
    floor_letter: {
        load(me, template) {
            me.ascii_code = template.modifier;
        }
    },
    wall: {
        blocks: true,
    },
    wall_invisible: {
        blocks: true,
    },
    wall_appearing: {
        blocks: true,
        on_bump(me, level, other) {
            me.become('wall');
        }
    },
    popwall: {
        on_depart(me, level, other) {
            me.become('wall');
        }
    },
    thinwall_n: {
        thin_walls: new Set(['north']),
    },
    thinwall_s: {
        thin_walls: new Set(['south']),
    },
    thinwall_e: {
        thin_walls: new Set(['east']),
    },
    thinwall_w: {
        thin_walls: new Set(['west']),
    },
    fake_wall: {
        blocks: true,
        on_bump(me, level, other) {
            me.become('wall');
        }
    },
    fake_floor: {
        blocks: true,
        on_bump(me, level, other) {
            me.become('floor');
        }
    },

    // Swivel doors
    swivel_floor: {},
    swivel_ne: {
        thin_walls: new Set(['north', 'east']),
    },
    swivel_se: {
        thin_walls: new Set(['south', 'east']),
    },
    swivel_sw: {
        thin_walls: new Set(['south', 'west']),
    },
    swivel_nw: {
        thin_walls: new Set(['north', 'west']),
    },

    // Locked doors
    door_red: {
        blocks: true,
        on_bump(me, level, other) {
            if (other.type.has_inventory && other.take_item('key_red')) {
                me.type = TILE_TYPES.floor;
            }
        }
    },
    door_blue: {
        blocks: true,
        on_bump(me, level, other) {
            if (other.type.has_inventory && other.take_item('key_blue')) {
                me.type = TILE_TYPES.floor;
            }
        }
    },
    door_yellow: {
        blocks: true,
        on_bump(me, level, other) {
            if (other.type.has_inventory && other.take_item('key_yellow')) {
                me.type = TILE_TYPES.floor;
            }
        }
    },
    door_green: {
        blocks: true,
        on_bump(me, level, other) {
            if (other.type.has_inventory && other.take_item('key_green')) {
                me.type = TILE_TYPES.floor;
            }
        }
    },

    // Terrain
    dirt: {
        blocks_monsters: true,
        blocks_blocks: true,
        // TODO block melinda only without the hiking boots; can't use ignore because then she wouldn't step on it  :S  also ignore doesn't apply to blocks anyway.
        on_arrive(me, level, other) {
            me.become('floor');
        }
    },
    gravel: {
        blocks_monsters: true,
    },

    // Hazards
    fire: {
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
    water: {
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
    turtle: {
    },
    ice: {
        on_arrive(me, level, other) {
            level.make_slide(other, 'ice');
        }
    },
    ice_sw: {
        thin_walls: new Set(['south', 'west']),
        on_arrive(me, level, other) {
            if (other.direction === 'south') {
                other.direction = 'east';
            }
            else {
                other.direction = 'north';
            }
            level.make_slide(other, 'ice');
        }
    },
    ice_nw: {
        thin_walls: new Set(['north', 'west']),
        on_arrive(me, level, other) {
            if (other.direction === 'north') {
                other.direction = 'east';
            }
            else {
                other.direction = 'south';
            }
            level.make_slide(other, 'ice');
        }
    },
    ice_ne: {
        thin_walls: new Set(['north', 'east']),
        on_arrive(me, level, other) {
            if (other.direction === 'north') {
                other.direction = 'west';
            }
            else {
                other.direction = 'south';
            }
            level.make_slide(other, 'ice');
        }
    },
    ice_se: {
        thin_walls: new Set(['south', 'east']),
        on_arrive(me, level, other) {
            if (other.direction === 'south') {
                other.direction = 'west';
            }
            else {
                other.direction = 'north';
            }
            level.make_slide(other, 'ice');
        }
    },
    force_floor_n: {
        on_arrive(me, level, other) {
            other.direction = 'north';
            level.make_slide(other, 'push');
        }
    },
    force_floor_e: {
        on_arrive(me, level, other) {
            other.direction = 'east';
            level.make_slide(other, 'push');
        }
    },
    force_floor_s: {
        on_arrive(me, level, other) {
            other.direction = 'south';
            level.make_slide(other, 'push');
        }
    },
    force_floor_w: {
        on_arrive(me, level, other) {
            other.direction = 'west';
            level.make_slide(other, 'push');
        }
    },
    bomb: {
    },
    thief_tools: {
        on_arrive(me, level, other) {
            if (other.inventory) {
                for (let [name, count] of Object.entries(other.inventory)) {
                    if (count > 0 && TILE_TYPES[name].is_tool) {
                        other.take_item(name, count);
                    }
                }
            }
        }
    },
    thief_keys: {
        on_arrive(me, level, other) {
            if (other.inventory) {
                for (let [name, count] of Object.entries(other.inventory)) {
                    if (count > 0 && TILE_TYPES[name].is_key) {
                        other.take_item(name, count);
                    }
                }
            }
        }
    },
    forbidden: {
    },

    // Mechanisms
    cloner: {
        blocks: true,
    },
    dirt_block: {
        blocks: true,
        is_object: true,
        is_block: true,
    },

    // Critters
    bug: {
        is_actor: true,
        is_object: true,
        is_monster: true,
        movement_mode: 'follow-left',
    },
    paramecium: {
        is_actor: true,
        is_object: true,
        is_monster: true,
        movement_mode: 'follow-right',
    },
    ball: {
        is_actor: true,
        is_object: true,
        is_monster: true,
    },
    blob: {
        is_actor: true,
        is_object: true,
        is_monster: true,
    },
    teeth: {
        is_actor: true,
        is_object: true,
        is_monster: true,
    },
    fireball: {
        is_actor: true,
        is_object: true,
        is_monster: true,
        movement_mode: 'turn-right',
        ignores: new Set(['fire']),
    },
    glider: {
        is_actor: true,
        is_object: true,
        is_monster: true,
        movement_mode: 'turn-left',
        ignores: new Set(['water']),
    },

    // Keys
    key_red: {
        is_object: true,
        is_item: true,
        is_key: true,
    },
    key_blue: {
        is_object: true,
        is_item: true,
        is_key: true,
    },
    key_yellow: {
        is_object: true,
        is_item: true,
        is_key: true,
    },
    key_green: {
        is_object: true,
        is_item: true,
        is_key: true,
    },
    // Tools
    cleats: {
        is_object: true,
        is_item: true,
        is_tool: true,
        item_ignores: new Set(['ice']),
    },
    suction_boots: {
        is_object: true,
        is_item: true,
        is_tool: true,
        item_ignores: new Set([
            'force_floor_n',
            'force_floor_s',
            'force_floor_e',
            'force_floor_w',
        ]),
    },
    fire_boots: {
        is_object: true,
        is_item: true,
        is_tool: true,
        item_ignores: new Set(['fire']),
    },
    flippers: {
        is_object: true,
        is_item: true,
        is_tool: true,
        item_ignores: new Set(['water']),
    },

    // Progression
    player: {
        is_actor: true,
        is_player: true,
        has_inventory: true,
        is_object: true,
        pushes: {
            dirt_block: true,
        },
        infinite_items: {
            key_green: true,
        },
    },
    player_drowned: {
    },
    player_burned: {
    },
    chip: {
        is_object: true,
        is_chip: true,
        is_required_chip: true,
        blocks_monsters: true,
        blocks_blocks: true,
        on_arrive(me, level, other) {
            if (other.type.is_player) {
                level.collect_chip();
                me.destroy();
            }
        }
    },
    chip_extra: {
        is_chip: true,
        is_object: true,
    },
    score_10: {
        is_object: true,
    },
    score_100: {
        is_object: true,
    },
    score_1000: {
        is_object: true,
    },
    score_2x: {
        is_object: true,
    },

    hint: {
        is_hint: true,
    },
    socket: {
        blocks: true,
        on_bump(me, level, other) {
            if (other.type.is_player && level.chips_remaining === 0) {
                me.type = TILE_TYPES.floor;
            }
        }
    },
    exit: {
    },
};

// Tell them all their own names
for (let [name, type] of Object.entries(TILE_TYPES)) {
    type.name = name;
}

export default TILE_TYPES;
