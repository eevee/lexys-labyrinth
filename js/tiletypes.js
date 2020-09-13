import { DIRECTIONS } from './defs.js';

// Draw layers
const LAYER_TERRAIN = 0;
const LAYER_ITEM = 1;
const LAYER_ACTOR = 2;
const LAYER_OVERLAY = 3;
// TODO cc2 order is: swivel, thinwalls, canopy (and yes you can have them all in the same tile)

const TILE_TYPES = {
    // Floors and walls
    floor: {
        draw_layer: LAYER_TERRAIN,
    },
    floor_letter: {
        draw_layer: LAYER_TERRAIN,
        load(me, template) {
            me.ascii_code = template.modifier;
        },
    },
    floor_custom_green: {
        draw_layer: LAYER_TERRAIN,
    },
    floor_custom_pink: {
        draw_layer: LAYER_TERRAIN,
    },
    floor_custom_yellow: {
        draw_layer: LAYER_TERRAIN,
    },
    floor_custom_blue: {
        draw_layer: LAYER_TERRAIN,
    },
    wall: {
        draw_layer: LAYER_TERRAIN,
        blocks_all: true,
    },
    wall_custom_green: {
        draw_layer: LAYER_TERRAIN,
        blocks_all: true,
    },
    wall_custom_pink: {
        draw_layer: LAYER_TERRAIN,
        blocks_all: true,
    },
    wall_custom_yellow: {
        draw_layer: LAYER_TERRAIN,
        blocks_all: true,
    },
    wall_custom_blue: {
        draw_layer: LAYER_TERRAIN,
        blocks_all: true,
    },
    wall_invisible: {
        draw_layer: LAYER_TERRAIN,
        // FIXME cc2 seems to make these flicker briefly
        blocks_all: true,
    },
    wall_appearing: {
        draw_layer: LAYER_TERRAIN,
        blocks_all: true,
        on_bump(me, level, other) {
            level.transmute_tile(me, 'wall');
        },
    },
    popwall: {
        draw_layer: LAYER_TERRAIN,
        blocks_monsters: true,
        blocks_blocks: true,
        on_depart(me, level, other) {
            level.transmute_tile(me, 'wall');
        },
    },
    // FIXME these should be OVERLAY by cc2 rules, but the cc1 tiles are opaque and cover everything else
    thinwall_n: {
        draw_layer: LAYER_TERRAIN,
        thin_walls: new Set(['north']),
    },
    thinwall_s: {
        draw_layer: LAYER_TERRAIN,
        thin_walls: new Set(['south']),
    },
    thinwall_e: {
        draw_layer: LAYER_TERRAIN,
        thin_walls: new Set(['east']),
    },
    thinwall_w: {
        draw_layer: LAYER_TERRAIN,
        thin_walls: new Set(['west']),
    },
    thinwall_se: {
        draw_layer: LAYER_TERRAIN,
        thin_walls: new Set(['south', 'east']),
    },
    fake_wall: {
        draw_layer: LAYER_TERRAIN,
        blocks_all: true,
        on_bump(me, level, other) {
            level.transmute_tile(me, 'wall');
        },
    },
    fake_floor: {
        draw_layer: LAYER_TERRAIN,
        blocks_all: true,
        on_bump(me, level, other) {
            level.transmute_tile(me, 'floor');
        },
    },
    popdown_wall: {
        draw_layer: LAYER_TERRAIN,
        blocks_all: true,
    },
    popdown_floor: {
        draw_layer: LAYER_TERRAIN,
        on_arrive(me, level, other) {
            // FIXME could probably do this with state?  or, eh
            level.transmute_tile(me, 'popdown_floor_visible');
        },
    },
    popdown_floor_visible: {
        draw_layer: LAYER_TERRAIN,
        on_depart(me, level, other) {
            // FIXME possibly changes back too fast, not even visible for a tic for me (much like stepping on a button oops)
            level.transmute_tile(me, 'popdown_floor');
        },
    },
    steel: {
        draw_layer: LAYER_TERRAIN,
        blocks_all: true,
    },
    canopy: {
        draw_layer: LAYER_OVERLAY,
    },

    // Swivel doors
    swivel_floor: {
        draw_layer: LAYER_TERRAIN,
    },
    swivel_ne: {
        draw_layer: LAYER_OVERLAY,
        thin_walls: new Set(['north', 'east']),
        is_swivel: true,
        on_depart(me, level, other) {
            if (other.direction === 'north') {
                level.transmute_tile(me, 'swivel_se');
            }
            else if (other.direction === 'east') {
                level.transmute_tile(me, 'swivel_nw');
            }
        },
    },
    swivel_se: {
        draw_layer: LAYER_OVERLAY,
        thin_walls: new Set(['south', 'east']),
        is_swivel: true,
        on_depart(me, level, other) {
            if (other.direction === 'south') {
                level.transmute_tile(me, 'swivel_ne');
            }
            else if (other.direction === 'east') {
                level.transmute_tile(me, 'swivel_sw');
            }
        },
    },
    swivel_sw: {
        draw_layer: LAYER_OVERLAY,
        thin_walls: new Set(['south', 'west']),
        is_swivel: true,
        on_depart(me, level, other) {
            if (other.direction === 'south') {
                level.transmute_tile(me, 'swivel_nw');
            }
            else if (other.direction === 'west') {
                level.transmute_tile(me, 'swivel_se');
            }
        },
    },
    swivel_nw: {
        draw_layer: LAYER_OVERLAY,
        thin_walls: new Set(['north', 'west']),
        is_swivel: true,
        on_depart(me, level, other) {
            if (other.direction === 'north') {
                level.transmute_tile(me, 'swivel_ne');
            }
            else if (other.direction === 'west') {
                level.transmute_tile(me, 'swivel_ne');
            }
        },
    },

    // Locked doors
    door_red: {
        draw_layer: LAYER_TERRAIN,
        blocks(me, level, other) {
            // TODO not quite sure if this one is right; there are complex interactions with monsters, e.g. most monsters can eat blue keys but can't actually use them
            return ! (other.type.has_inventory && other.has_item('key_red'));
        },
        on_arrive(me, level, other) {
            if (other.type.has_inventory && other.take_item('key_red')) {
                level.transmute_tile(me, 'floor');
            }
        },
    },
    door_blue: {
        draw_layer: LAYER_TERRAIN,
        blocks(me, level, other) {
            return ! (other.type.has_inventory && other.has_item('key_blue'));
        },
        on_arrive(me, level, other) {
            if (other.type.has_inventory && other.take_item('key_blue')) {
                level.transmute_tile(me, 'floor');
            }
        },
    },
    door_yellow: {
        draw_layer: LAYER_TERRAIN,
        blocks(me, level, other) {
            return ! (other.type.has_inventory && other.has_item('key_yellow'));
        },
        on_arrive(me, level, other) {
            if (other.type.has_inventory && other.take_item('key_yellow')) {
                level.transmute_tile(me, 'floor');
            }
        },
    },
    door_green: {
        draw_layer: LAYER_TERRAIN,
        blocks(me, level, other) {
            return ! (other.type.has_inventory && other.has_item('key_green'));
        },
        on_arrive(me, level, other) {
            if (other.type.has_inventory && other.take_item('key_green')) {
                level.transmute_tile(me, 'floor');
            }
        },
    },

    // Terrain
    dirt: {
        draw_layer: LAYER_TERRAIN,
        blocks_monsters: true,
        blocks_blocks: true,
        blocks(me, level, other) {
            return (other.type.name === 'player2' && ! other.has_item('hiking_boots'));
        },
        on_arrive(me, level, other) {
            level.transmute_tile(me, 'floor');
        },
    },
    gravel: {
        draw_layer: LAYER_TERRAIN,
        blocks_monsters: true,
        blocks(me, level, other) {
            return (other.type.name === 'player2' && ! other.has_item('hiking_boots'));
        },
    },

    // Hazards
    fire: {
        draw_layer: LAYER_TERRAIN,
        blocks_monsters: true,
        on_arrive(me, level, other) {
            if (other.type.name === 'ice_block') {
                level.remove_tile(other);
                level.transmute_tile(me, 'water');
            }
            else if (other.type.is_player) {
                level.fail("Oops!  You can't walk on fire without fire boots!");
                level.transmute_tile(other, 'player_burned');
            }
            else {
                level.remove_tile(other);
            }
        },
    },
    water: {
        draw_layer: LAYER_TERRAIN,
        on_arrive(me, level, other) {
            // TODO cc1 allows items under water, i think; water was on the upper layer
            if (other.type.name === 'dirt_block' || other.type.name === 'clone_block') {
                level.remove_tile(other);
                level.transmute_tile(me, 'dirt');
            }
            else if (other.type.name === 'ice_block') {
                level.remove_tile(other);
                level.transmute_tile(me, 'ice');
            }
            else if (other.type.is_player) {
                level.fail("swimming with the fishes");
                level.transmute_tile(other, 'player_drowned');
            }
            else {
                level.remove_tile(other);
            }
            level.spawn_animation(me.cell, 'splash');
        },
    },
    turtle: {
        draw_layer: LAYER_TERRAIN,
        on_depart(me, level, other) {
            level.transmute_tile(me, 'water');
            level.spawn_animation(me.cell, 'splash');
        },
    },
    ice: {
        draw_layer: LAYER_TERRAIN,
        slide_mode: 'ice',
    },
    ice_sw: {
        draw_layer: LAYER_TERRAIN,
        thin_walls: new Set(['south', 'west']),
        slide_mode: 'ice',
        on_arrive(me, level, other) {
            if (other.direction === 'south') {
                level.set_actor_direction(other, 'east');
            }
            else {
                level.set_actor_direction(other, 'north');
            }
        },
    },
    ice_nw: {
        draw_layer: LAYER_TERRAIN,
        thin_walls: new Set(['north', 'west']),
        slide_mode: 'ice',
        on_arrive(me, level, other) {
            if (other.direction === 'north') {
                level.set_actor_direction(other, 'east');
            }
            else {
                level.set_actor_direction(other, 'south');
            }
        },
    },
    ice_ne: {
        draw_layer: LAYER_TERRAIN,
        thin_walls: new Set(['north', 'east']),
        slide_mode: 'ice',
        on_arrive(me, level, other) {
            if (other.direction === 'north') {
                level.set_actor_direction(other, 'west');
            }
            else {
                level.set_actor_direction(other, 'south');
            }
        },
    },
    ice_se: {
        draw_layer: LAYER_TERRAIN,
        thin_walls: new Set(['south', 'east']),
        slide_mode: 'ice',
        on_arrive(me, level, other) {
            if (other.direction === 'south') {
                level.set_actor_direction(other, 'west');
            }
            else {
                level.set_actor_direction(other, 'north');
            }
        },
    },
    force_floor_n: {
        draw_layer: LAYER_TERRAIN,
        slide_mode: 'force',
        on_arrive(me, level, other) {
            level.set_actor_direction(other, 'north');
        },
    },
    force_floor_e: {
        draw_layer: LAYER_TERRAIN,
        slide_mode: 'force',
        on_arrive(me, level, other) {
            level.set_actor_direction(other, 'east');
        },
    },
    force_floor_s: {
        draw_layer: LAYER_TERRAIN,
        slide_mode: 'force',
        on_arrive(me, level, other) {
            level.set_actor_direction(other, 'south');
        },
    },
    force_floor_w: {
        draw_layer: LAYER_TERRAIN,
        slide_mode: 'force',
        on_arrive(me, level, other) {
            level.set_actor_direction(other, 'west');
        },
    },
    force_floor_all: {
        draw_layer: LAYER_TERRAIN,
        slide_mode: 'force',
        // TODO ms: this is random, and an acting wall to monsters (!)
        on_arrive(me, level, other) {
            level.set_actor_direction(other, level.get_force_floor_direction());
        },
    },
    slime: {
        draw_layer: LAYER_TERRAIN,
        // FIXME kills everything except ghosts, blobs, blocks
        // FIXME blobs spread slime onto floor tiles, even destroying wiring
        on_arrive(me, level, other) {
            if (other.type.name === 'dirt_block' || other.type.name === 'clone_block' || other.type.name === 'ice_block') {
                level.transmute_tile(me, 'floor');
            }
        },
    },
    bomb: {
        draw_layer: LAYER_ITEM,
        // TODO explode
        on_arrive(me, level, other) {
            let cell = me.cell;
            level.remove_tile(me);
            level.remove_tile(other);
            level.spawn_animation(cell, 'explosion');
            if (other.type.is_player) {
                level.fail("watch where you step");
            }
        },
    },
    thief_tools: {
        draw_layer: LAYER_TERRAIN,
        blocks_monsters: true,
        blocks_blocks: true,
        on_arrive(me, level, other) {
            if (other.inventory) {
                for (let [name, count] of Object.entries(other.inventory)) {
                    if (count > 0 && TILE_TYPES[name].is_tool) {
                        other.take_item(name, count);
                    }
                }
            }
            if (other.type.is_player) {
                level.adjust_bonus(0, 0.5);
            }
        },
    },
    thief_keys: {
        draw_layer: LAYER_TERRAIN,
        blocks_monsters: true,
        blocks_blocks: true,
        on_arrive(me, level, other) {
            if (other.inventory) {
                for (let [name, count] of Object.entries(other.inventory)) {
                    if (count > 0 && TILE_TYPES[name].is_key) {
                        other.take_item(name, count);
                    }
                }
            }
            if (other.type.is_player) {
                level.adjust_bonus(0, 0.5);
            }
        },
    },
    forbidden: {
        draw_layer: LAYER_TERRAIN,
    },

    // Mechanisms
    dirt_block: {
        draw_layer: LAYER_ACTOR,
        blocks_all: true,
        is_actor: true,
        is_block: true,
        ignores: new Set(['fire']),
        movement_speed: 4,
    },
    clone_block: {
        draw_layer: LAYER_ACTOR,
        // TODO is this in any way distinct from dirt block
        blocks_all: true,
        is_actor: true,
        is_block: true,
        ignores: new Set(['fire']),
        movement_speed: 4,
    },
    ice_block: {
        draw_layer: LAYER_ACTOR,
        blocks_all: true,
        is_actor: true,
        is_block: true,
        movement_speed: 4,
        pushes: {
            ice_block: true,
        },
    },
    green_floor: {
        draw_layer: LAYER_TERRAIN,
    },
    green_wall: {
        draw_layer: LAYER_TERRAIN,
        blocks_all: true,
    },
    green_chip: {
        draw_layer: LAYER_ITEM,
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
    green_bomb: {
        draw_layer: LAYER_ITEM,
        on_arrive(me, level, other) {
            // TODO explode
            level.remove_tile(me);
            level.remove_tile(other);
            if (other.type.is_player) {
                level.fail("watch where you step");
            }
        },
    },
    cloner: {
        draw_layer: LAYER_TERRAIN,
        blocks_all: true,
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
                        let new_tile = new tile.constructor(type, direction);
                        level.add_tile(new_tile, cell);
                        level.set_actor_stuck(new_tile, true);
                    }
                    else {
                        level.set_actor_stuck(tile, true);
                    }
                }
            }
        },
    },
    trap: {
        draw_layer: LAYER_TERRAIN,
        on_arrive(me, level, other) {
            if (! me.open) {
                level.set_actor_stuck(other, true);
            }
        },
    },
    teleport_blue: {
        draw_layer: LAYER_TERRAIN,
        connects_to: 'teleport_blue',
        connect_order: 'backward',
        is_teleporter: true,
    },
    teleport_red: {
        draw_layer: LAYER_TERRAIN,
        connects_to: 'teleport_red',
        connect_order: 'forward',
        is_teleporter: true,
    },
    teleport_green: {
        draw_layer: LAYER_TERRAIN,
        // connects_to: 'teleport_red',
        // connect_order: 'forward',
        // is_teleporter: true,
        // FIXME completely different behavior from other teleporters
    },
    teleport_yellow: {
        draw_layer: LAYER_TERRAIN,
        connects_to: 'teleport_yellow',
        connect_order: 'backward',
        is_teleporter: true,
        // FIXME special pickup behavior
    },
    // FIXME do i want these as separate objects?  what would they do, turn into each other?  or should it be one with state?
    flame_jet_off: {
        draw_layer: LAYER_TERRAIN,
    },
    flame_jet_on: {
        draw_layer: LAYER_TERRAIN,
        // FIXME every tic, kills every actor in the cell
    },
    // Buttons
    button_blue: {
        draw_layer: LAYER_TERRAIN,
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
        draw_layer: LAYER_TERRAIN,
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
        draw_layer: LAYER_TERRAIN,
        connects_to: 'trap',
        connect_order: 'forward',
        on_arrive(me, level, other) {
            if (me.connection && me.connection.cell) {
                let trap = me.connection;
                level._set_prop(trap, 'open', true);
                for (let tile of trap.cell) {
                    if (tile.type.is_actor) {
                        if (tile.stuck) {
                            level.set_actor_stuck(tile, false);
                        }
                        // Forcibly move anything released from a trap, to keep
                        // it in sync with whatever pushed the button
                        level.attempt_step(tile, tile.direction);
                    }
                }
            }
        },
        on_depart(me, level, other) {
            if (me.connection && me.connection.cell) {
                let trap = me.connection;
                level._set_prop(trap, 'open', false);
                for (let tile of trap.cell) {
                    if (tile.type.is_actor) {
                        level.set_actor_stuck(tile, true);
                    }
                }
            }
        },
    },
    button_red: {
        draw_layer: LAYER_TERRAIN,
        connects_to: 'cloner',
        connect_order: 'forward',
        on_arrive(me, level, other) {
            if (me.connection && me.connection.cell) {
                me.connection.type.activate(me.connection, level);
            }
        },
    },
    button_orange: {
        draw_layer: LAYER_TERRAIN,
        // FIXME toggles flame jets, connected somehow, ???
    },

    // Time alteration
    stopwatch_bonus: {
        draw_layer: LAYER_ITEM,
        blocks_monsters: true,
        blocks_blocks: true,
        on_arrive(me, level, other) {
            if (other.type.is_player) {
                level.remove_tile(me);
                level.adjust_timer(+10);
            }
        },
    },
    stopwatch_penalty: {
        draw_layer: LAYER_ITEM,
        blocks_monsters: true,
        blocks_blocks: true,
        on_arrive(me, level, other) {
            if (other.type.is_player) {
                level.remove_tile(me);
                level.adjust_timer(-10);
            }
        },
    },
    stopwatch_toggle: {
        draw_layer: LAYER_ITEM,
        blocks_monsters: true,
        blocks_blocks: true,
        on_arrive(me, level, other) {
            if (other.type.is_player) {
                level.pause_timer();
            }
        },
    },

    // Critters
    bug: {
        draw_layer: LAYER_ACTOR,
        is_actor: true,
        is_monster: true,
        blocks_monsters: true,
        blocks_blocks: true,
        movement_mode: 'follow-left',
        movement_speed: 4,
    },
    paramecium: {
        draw_layer: LAYER_ACTOR,
        is_actor: true,
        is_monster: true,
        blocks_monsters: true,
        blocks_blocks: true,
        movement_mode: 'follow-right',
        movement_speed: 4,
    },
    ball: {
        draw_layer: LAYER_ACTOR,
        is_actor: true,
        is_monster: true,
        blocks_monsters: true,
        blocks_blocks: true,
        movement_mode: 'bounce',
        movement_speed: 4,
    },
    walker: {
        draw_layer: LAYER_ACTOR,
        is_actor: true,
        is_monster: true,
        blocks_monsters: true,
        blocks_blocks: true,
        movement_mode: 'bounce-random',
        movement_speed: 4,
    },
    tank_blue: {
        draw_layer: LAYER_ACTOR,
        is_actor: true,
        is_monster: true,
        blocks_monsters: true,
        blocks_blocks: true,
        movement_mode: 'forward',
        movement_speed: 4,
    },
    blob: {
        draw_layer: LAYER_ACTOR,
        is_actor: true,
        is_monster: true,
        blocks_monsters: true,
        blocks_blocks: true,
        movement_mode: 'random',
        movement_speed: 8,
    },
    teeth: {
        draw_layer: LAYER_ACTOR,
        is_actor: true,
        is_monster: true,
        blocks_monsters: true,
        blocks_blocks: true,
        movement_mode: 'pursue',
        movement_speed: 4,
        uses_teeth_hesitation: true,
    },
    fireball: {
        draw_layer: LAYER_ACTOR,
        is_actor: true,
        is_monster: true,
        blocks_monsters: true,
        blocks_blocks: true,
        movement_mode: 'turn-right',
        movement_speed: 4,
        ignores: new Set(['fire']),
    },
    glider: {
        draw_layer: LAYER_ACTOR,
        is_actor: true,
        is_monster: true,
        blocks_monsters: true,
        blocks_blocks: true,
        movement_mode: 'turn-left',
        movement_speed: 4,
        ignores: new Set(['water']),
    },

    // Keys
    // Note that red and blue keys do NOT block monsters, but yellow and green DO
    key_red: {
        draw_layer: LAYER_ITEM,
        is_item: true,
        is_key: true,
    },
    key_blue: {
        draw_layer: LAYER_ITEM,
        is_item: true,
        is_key: true,
    },
    key_yellow: {
        draw_layer: LAYER_ITEM,
        is_item: true,
        is_key: true,
        blocks_monsters: true,
        blocks_blocks: true,
    },
    key_green: {
        draw_layer: LAYER_ITEM,
        is_item: true,
        is_key: true,
        blocks_monsters: true,
        blocks_blocks: true,
    },
    // Boots
    // TODO note: ms allows blocks to pass over tools
    cleats: {
        draw_layer: LAYER_ITEM,
        is_item: true,
        is_tool: true,
        blocks_monsters: true,
        blocks_blocks: true,
        item_ignores: new Set(['ice', 'ice_nw', 'ice_ne', 'ice_sw', 'ice_se']),
    },
    suction_boots: {
        draw_layer: LAYER_ITEM,
        is_item: true,
        is_tool: true,
        blocks_monsters: true,
        blocks_blocks: true,
        item_ignores: new Set([
            'force_floor_n',
            'force_floor_s',
            'force_floor_e',
            'force_floor_w',
            'force_floor_all',
        ]),
    },
    fire_boots: {
        draw_layer: LAYER_ITEM,
        is_item: true,
        is_tool: true,
        blocks_monsters: true,
        blocks_blocks: true,
        item_ignores: new Set(['fire']),
    },
    flippers: {
        draw_layer: LAYER_ITEM,
        is_item: true,
        is_tool: true,
        blocks_monsters: true,
        blocks_blocks: true,
        item_ignores: new Set(['water']),
    },
    hiking_boots: {
        draw_layer: LAYER_ITEM,
        is_item: true,
        is_tool: true,
        blocks_monsters: true,
        blocks_blocks: true,
        // FIXME uhh these "ignore" that dirt and gravel block us, but they don't ignore the on_arrive, so, uhhhh
    },
    // Other tools
    dynamite: {
        draw_layer: LAYER_ITEM,
        is_item: true,
        is_tool: true,
        blocks_monsters: true,
        blocks_blocks: true,
        // FIXME does a thing when dropped, but that isn't implemented at all yet
    },

    // Progression
    player: {
        draw_layer: LAYER_ACTOR,
        is_actor: true,
        is_player: true,
        has_inventory: true,
        movement_speed: 4,
        pushes: {
            dirt_block: true,
            clone_block: true,
            ice_block: true,
        },
        infinite_items: {
            key_green: true,
        },
    },
    player2: {
        draw_layer: LAYER_ACTOR,
        is_actor: true,
        is_player: true,
        has_inventory: true,
        movement_speed: 4,
        ignores: new Set(['ice', 'ice_nw', 'ice_ne', 'ice_sw', 'ice_se']),
        pushes: {
            dirt_block: true,
            clone_block: true,
            ice_block: true,
        },
        infinite_items: {
            key_yellow: true,
        },
    },
    player_drowned: {
        draw_layer: LAYER_ACTOR,
    },
    player_burned: {
        draw_layer: LAYER_ACTOR,
    },
    chip: {
        draw_layer: LAYER_ITEM,
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
        draw_layer: LAYER_ITEM,
        is_chip: true,
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
        draw_layer: LAYER_ITEM,
        blocks_monsters: true,
        blocks_blocks: true,
        on_arrive(me, level, other) {
            if (other.type.is_player) {
                level.adjust_bonus(10);
            }
            level.remove_tile(me);
        },
    },
    score_100: {
        draw_layer: LAYER_ITEM,
        blocks_monsters: true,
        blocks_blocks: true,
        on_arrive(me, level, other) {
            if (other.type.is_player) {
                level.adjust_bonus(100);
            }
            level.remove_tile(me);
        },
    },
    score_1000: {
        draw_layer: LAYER_ITEM,
        blocks_monsters: true,
        blocks_blocks: true,
        on_arrive(me, level, other) {
            if (other.type.is_player) {
                level.adjust_bonus(1000);
            }
            level.remove_tile(me);
        },
    },
    score_2x: {
        draw_layer: LAYER_ITEM,
        blocks_monsters: true,
        blocks_blocks: true,
        on_arrive(me, level, other) {
            if (other.type.is_player) {
                level.adjust_bonus(0, 2);
            }
            level.remove_tile(me);
        },
    },

    hint: {
        draw_layer: LAYER_TERRAIN,
        is_hint: true,
        blocks_monsters: true,
        blocks_blocks: true,
    },
    socket: {
        draw_layer: LAYER_TERRAIN,
        blocks_monsters: true,
        blocks_blocks: true,
        blocks(me, level, other) {
            return (level.chips_remaining > 0);
        },
        on_arrive(me, level, other) {
            if (other.type.is_player && level.chips_remaining === 0) {
                level.transmute_tile(me, 'floor');
            }
        },
    },
    exit: {
        draw_layer: LAYER_TERRAIN,
        on_arrive(me, level, other) {
            if (other.type.is_player) {
                level.win();
            }
        },
    },

    // VFX
    splash: {
        draw_layer: LAYER_OVERLAY,
        is_actor: true,
        blocks_players: true,
        ttl: 6,
    },
    explosion: {
        draw_layer: LAYER_OVERLAY,
        is_actor: true,
        blocks_players: true,
        ttl: 6,
    },
};

// Tell them all their own names
for (let [name, type] of Object.entries(TILE_TYPES)) {
    type.name = name;

    if (type.draw_layer === undefined ||
        type.draw_layer !== Math.floor(type.draw_layer) ||
        type.draw_layer >= 4)
    {
        console.error(`Tile type ${name} has a bad draw layer`);
    }
}

export default TILE_TYPES;
