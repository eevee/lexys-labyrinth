import { DIRECTIONS } from './defs.js';

const TILE_TYPES = {
    // Floors and walls
    floor: {
    },
    floor_letter: {
        load(me, template) {
            me.ascii_code = template.modifier;
        },
    },
    wall: {
        blocks: true,
    },
    wall_invisible: {
        // TODO cc2 seems to make these flicker briefly
        blocks: true,
    },
    wall_appearing: {
        blocks: true,
        on_bump(me, level, other) {
            level.transmute_tile(me, 'wall');
        },
    },
    popwall: {
        blocks_monsters: true,
        blocks_blocks: true,
        on_depart(me, level, other) {
            level.transmute_tile(me, 'wall');
        },
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
    thinwall_se: {
        thin_walls: new Set(['south', 'east']),
    },
    fake_wall: {
        blocks: true,
        on_bump(me, level, other) {
            level.transmute_tile(me, 'wall');
        },
    },
    fake_floor: {
        blocks: true,
        on_bump(me, level, other) {
            level.transmute_tile(me, 'floor');
        },
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
        },
    },
    door_blue: {
        blocks: true,
        on_bump(me, level, other) {
            if (other.type.has_inventory && other.take_item('key_blue')) {
                me.type = TILE_TYPES.floor;
            }
        },
    },
    door_yellow: {
        blocks: true,
        on_bump(me, level, other) {
            if (other.type.has_inventory && other.take_item('key_yellow')) {
                me.type = TILE_TYPES.floor;
            }
        },
    },
    door_green: {
        blocks: true,
        on_bump(me, level, other) {
            if (other.type.has_inventory && other.take_item('key_green')) {
                me.type = TILE_TYPES.floor;
            }
        },
    },

    // Terrain
    dirt: {
        blocks_monsters: true,
        blocks_blocks: true,
        // TODO block melinda only without the hiking boots; can't use ignore because then she wouldn't step on it  :S  also ignore doesn't apply to blocks anyway.
        on_arrive(me, level, other) {
            level.transmute_tile(me, 'floor');
        },
    },
    gravel: {
        blocks_monsters: true,
    },

    // Hazards
    fire: {
        on_arrive(me, level, other) {
            if (other.type.is_player) {
                level.fail("Oops!  You can't walk on fire without fire boots!");
                level.transmute_tile(other, 'player_burned');
            }
            else {
                level.remove_tile(other);
            }
        },
    },
    water: {
        on_arrive(me, level, other) {
            // TODO cc1 allows items under water, i think; water was on the upper layer
            if (other.type.name == 'dirt_block' || other.type.name == 'clone_block') {
                level.remove_tile(other);
                level.transmute_tile(me, 'dirt');
            }
            else if (other.type.is_player) {
                level.fail("swimming with the fishes");
                level.transmute_tile(other, 'player_drowned');
            }
            else {
                level.remove_tile(other);
            }
        },
    },
    turtle: {
    },
    ice: {
        slide_mode: 'ice',
    },
    ice_sw: {
        thin_walls: new Set(['south', 'west']),
        slide_mode: 'ice',
        on_arrive(me, level, other) {
            if (other.direction === 'south') {
                other.direction = 'east';
            }
            else {
                other.direction = 'north';
            }
        },
    },
    ice_nw: {
        thin_walls: new Set(['north', 'west']),
        slide_mode: 'ice',
        on_arrive(me, level, other) {
            if (other.direction === 'north') {
                other.direction = 'east';
            }
            else {
                other.direction = 'south';
            }
        },
    },
    ice_ne: {
        thin_walls: new Set(['north', 'east']),
        slide_mode: 'ice',
        on_arrive(me, level, other) {
            if (other.direction === 'north') {
                other.direction = 'west';
            }
            else {
                other.direction = 'south';
            }
        },
    },
    ice_se: {
        thin_walls: new Set(['south', 'east']),
        slide_mode: 'ice',
        on_arrive(me, level, other) {
            if (other.direction === 'south') {
                other.direction = 'west';
            }
            else {
                other.direction = 'north';
            }
        },
    },
    force_floor_n: {
        slide_mode: 'force',
        on_arrive(me, level, other) {
            other.direction = 'north';
        },
    },
    force_floor_e: {
        slide_mode: 'force',
        on_arrive(me, level, other) {
            other.direction = 'east';
        },
    },
    force_floor_s: {
        slide_mode: 'force',
        on_arrive(me, level, other) {
            other.direction = 'south';
        },
    },
    force_floor_w: {
        slide_mode: 'force',
        on_arrive(me, level, other) {
            other.direction = 'west';
        },
    },
    force_floor_all: {
        slide_mode: 'force',
        // TODO ms: this is random, and an acting wall to monsters (!)
        on_arrive(me, level, other) {
            other.direction = level.get_force_floor_direction();
        },
    },
    bomb: {
        // TODO explode
        on_arrive(me, level, other) {
            level.remove_tile(me);
            level.remove_tile(other);
            if (other.type.is_player) {
                level.fail("watch where you step");
            }
        },
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
        },
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
        },
    },
    forbidden: {
    },

    // Mechanisms
    dirt_block: {
        blocks: true,
        is_object: true,
        is_actor: true,
        is_block: true,
        ignores: new Set(['fire']),
    },
    clone_block: {
        // TODO is this in any way distinct from dirt block
        blocks: true,
        is_object: true,
        is_actor: true,
        is_block: true,
        ignores: new Set(['fire']),
    },
    green_floor: {},
    green_wall: {
        blocks: true,
    },
    cloner: {
        blocks: true,
        activate(me, level) {
            let cell = me.cell;
            // Copy, so we don't end up repeatedly cloning the same object
            for (let tile of Array.from(cell)) {
                if (tile !== me && tile.type.is_actor) {
                    // Copy this stuff in case the movement changes it
                    let type = tile.type;
                    let direction = tile.direction;

                    // Unstick and try to move the actor; if it's blocked,
                    // abort the clone
                    level.set_actor_stuck(tile, false);
                    if (level.attempt_step(tile, direction)) {
                        level.actors.push(tile);
                        // FIXME add this underneath, just above the cloner
                        level.add_tile(new tile.constructor(type, direction), cell);
                    }
                    else {
                        level.set_actor_stuck(tile, true);
                    }
                }
            }
        },
    },
    trap: {
        on_arrive(me, level, other) {
            if (! me.open) {
                level.set_actor_stuck(other, true);
            }
        },
    },
    teleport_blue: {
        connects_to: 'teleport_blue',
        connect_order: 'backward',
        is_teleporter: true,
        // TODO to make this work, i need to be able to check if a spot is blocked /ahead of time/
    },
    // Buttons
    button_blue: {
        on_arrive(me, level, other) {
            // Flip direction of all tanks
            for (let actor of level.actors) {
                // TODO generify somehow??
                if (actor.type.name === 'tank_blue') {
                    level.set_actor_direction(actor, DIRECTIONS[actor.direction].opposite);
                }
            }
        },
    },
    button_green: {
        on_arrive(me, level, other) {
            // Swap green floors and walls
            // TODO could probably make this more compact for undo purposes
            for (let row of level.cells) {
                for (let cell of row) {
                    for (let tile of cell) {
                        if (tile.type.name === 'green_floor') {
                            level.transmute_tile(tile, 'green_wall');
                        }
                        else if (tile.type.name === 'green_wall') {
                            level.transmute_tile(tile, 'green_floor');
                        }
                        else if (tile.type.name === 'green_chip') {
                            level.transmute_tile(tile, 'green_bomb');
                        }
                        else if (tile.type.name === 'green_bomb') {
                            level.transmute_tile(tile, 'green_chip');
                        }
                    }
                }
            }
        },
    },
    button_brown: {
        connects_to: 'trap',
        connect_order: 'forward',
        on_arrive(me, level, other) {
            if (me.connection && me.connection.cell) {
                let trap = me.connection;
                trap.open = true;
                for (let tile of trap.cell) {
                    if (tile.stuck) {
                        level.set_actor_stuck(tile, false);
                    }
                }
            }
        },
        on_depart(me, level, other) {
            if (me.connection && me.connection.cell) {
                let trap = me.connection;
                trap.open = false;
                for (let tile of trap.cell) {
                    if (tile.is_actor) {
                        level.set_actor_stuck(tile, true);
                    }
                }
            }
        },
    },
    button_red: {
        connects_to: 'cloner',
        connect_order: 'forward',
        on_arrive(me, level, other) {
            if (me.connection && me.connection.cell) {
                me.connection.type.activate(me.connection, level);
            }
        },
    },

    // Critters
    bug: {
        is_actor: true,
        is_object: true,
        is_monster: true,
        blocks_monsters: true,
        movement_mode: 'follow-left',
        movement_speed: 4,
    },
    paramecium: {
        is_actor: true,
        is_object: true,
        is_monster: true,
        blocks_monsters: true,
        movement_mode: 'follow-right',
        movement_speed: 4,
    },
    ball: {
        is_actor: true,
        is_object: true,
        is_monster: true,
        blocks_monsters: true,
        movement_mode: 'bounce',
        movement_speed: 4,
    },
    walker: {
        is_actor: true,
        is_object: true,
        is_monster: true,
        blocks_monsters: true,
        movement_mode: 'bounce-random',
        movement_speed: 4,
    },
    tank_blue: {
        is_actor: true,
        is_object: true,
        is_monster: true,
        blocks_monsters: true,
        movement_mode: 'forward',
        movement_speed: 4,
    },
    blob: {
        is_actor: true,
        is_object: true,
        is_monster: true,
        blocks_monsters: true,
        movement_mode: 'random',
        movement_speed: 8,
    },
    teeth: {
        is_actor: true,
        is_object: true,
        is_monster: true,
        blocks_monsters: true,
        movement_mode: 'pursue',
        movement_speed: 4,
        uses_teeth_hesitation: true,
    },
    fireball: {
        is_actor: true,
        is_object: true,
        is_monster: true,
        blocks_monsters: true,
        movement_mode: 'turn-right',
        movement_speed: 4,
        ignores: new Set(['fire']),
    },
    glider: {
        is_actor: true,
        is_object: true,
        is_monster: true,
        blocks_monsters: true,
        movement_mode: 'turn-left',
        movement_speed: 4,
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
        item_ignores: new Set(['ice', 'ice_nw', 'ice_ne', 'ice_sw', 'ice_se']),
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
        movement_speed: 4,
        pushes: {
            dirt_block: true,
            clone_block: true,
        },
        // FIXME this prevents thief from taking green key
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
                level.remove_tile(me);
            }
        },
    },
    chip_extra: {
        is_chip: true,
        is_object: true,
        blocks_monsters: true,
        blocks_blocks: true,
        on_arrive(me, level, other) {
            if (other.type.is_player) {
                level.collect_chip();
                level.remove_tile(me);
            }
        },
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
        },
    },
    exit: {
        on_arrive(me, level, other) {
            if (other.type.is_player) {
                level.win();
            }
        },
    },
};

// Tell them all their own names
for (let [name, type] of Object.entries(TILE_TYPES)) {
    type.name = name;
}

export default TILE_TYPES;
