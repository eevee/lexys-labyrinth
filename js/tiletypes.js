import { COLLISION, DIRECTIONS, DRAW_LAYERS } from './defs.js';
import { random_choice } from './util.js';

function on_ready_force_floor(me, level) {
    // At the start of the level, if there's an actor on a force floor:
    // - use on_arrive to set the actor's direction
    // - set the slide_mode (normally done by the main game loop)
    // - item bestowal: if they're being pushed into a wall and standing on an item, pick up the
    //   item, even if they couldn't normally pick items up
    let actor = me.cell.get_actor();
    if (! actor)
        return;

    me.type.on_arrive(me, level, actor);
    if (me.type.slide_mode) {
        actor.slide_mode = me.type.slide_mode;
    }

    // Item bestowal
    // TODO seemingly lynx/cc2 only pick RFF direction at decision time, but that's in conflict with
    // doing this here; decision time hasn't happened yet, but we need to know what direction we're
    // moving to know whether bestowal happens?  so what IS the cause of item bestowal?
    let neighbor = level.get_neighboring_cell(me.cell, actor.direction);
    if (! neighbor)
        return;
    if (! neighbor.blocks_entering(actor, actor.direction, level, true))
        return;
    let item = me.cell.get_item();
    if (! item)
        return;
    if (level.attempt_take(actor, item) && actor.ignores(me.type.name)) {
        // If they just picked up suction boots, they're no longer sliding
        // TODO this feels hacky, shouldn't the slide mode be erased some other way?
        actor.slide_mode = null;
    }
}

function blocks_leaving_thin_walls(me, actor, direction) {
    return me.type.thin_walls.has(direction);
}

function player_visual_state(me) {
    if (! me) {
        return 'normal';
    }

    if (me.fail_reason === 'drowned') {
        return 'drowned';
    }
    else if (me.fail_reason === 'burned') {
        return 'burned';
    }
    else if (me.fail_reason === 'exploded') {
        return 'exploded';
    }
    else if (me.fail_reason === 'slimed') {
        return 'slimed';
    }
    else if (me.fail_reason) {
        return 'failed';
    }
    else if (me.cell && (me.previous_cell || me.cell).some(t => t.type.name === 'water')) {
        // CC2 shows a swimming pose while still in water, or moving away from water
        return 'swimming';
    }
    else if (me.slide_mode === 'ice') {
        return 'skating';
    }
    else if (me.slide_mode === 'force') {
        return 'forced';
    }
    else if (me.is_blocked) {
        return 'blocked';
    }
    else if (me.is_pushing) {
        return 'pushing';
    }
    else if (me.animation_speed) {
        return 'moving';
    }
    else {
        return 'normal';
    }
}

// Logic for chasing after the player (or running away); shared by both teeth and mimics
function pursue_player(me, level) {
    let player = level.player;
    let target_cell = player.cell;
    // CC2 behavior (not Lynx (TODO compat?)): pursue the cell the player is leaving, if
    // they're still mostly in it
    if (player.previous_cell && player.animation_speed &&
        player.animation_progress <= player.animation_speed / 2)
    {
        target_cell = player.previous_cell;
    }

    let dx = me.cell.x - target_cell.x;
    let dy = me.cell.y - target_cell.y;
    let preferred_horizontal, preferred_vertical;
    if (dx > 0) {
        preferred_horizontal = 'west';
    }
    else if (dx < 0) {
        preferred_horizontal = 'east';
    }
    if (dy > 0) {
        preferred_vertical = 'north';
    }
    else if (dy < 0) {
        preferred_vertical = 'south';
    }
    // Chooses the furthest direction, vertical wins ties
    if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal first
        return [preferred_horizontal, preferred_vertical].filter(x => x);
    }
    else {
        // Vertical first
        return [preferred_vertical, preferred_horizontal].filter(x => x);
    }
}

const TILE_TYPES = {
    // Floors and walls
    floor: {
        draw_layer: DRAW_LAYERS.terrain,
    },
    floor_letter: {
        draw_layer: DRAW_LAYERS.terrain,
        populate_defaults(me) {
            me.overlaid_glyph = "?";
        },
    },
    // TODO possibly this should be a single tile
    floor_custom_green: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks_collision: COLLISION.ghost,
    },
    floor_custom_pink: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks_collision: COLLISION.ghost,
    },
    floor_custom_yellow: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks_collision: COLLISION.ghost,
    },
    floor_custom_blue: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks_collision: COLLISION.ghost,
    },
    wall: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks_collision: COLLISION.all_but_ghost,
    },
    wall_custom_green: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks_collision: COLLISION.all,
    },
    wall_custom_pink: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks_collision: COLLISION.all,
    },
    wall_custom_yellow: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks_collision: COLLISION.all,
    },
    wall_custom_blue: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks_collision: COLLISION.all,
    },
    wall_invisible: {
        draw_layer: DRAW_LAYERS.terrain,
        // FIXME cc2 seems to make these flicker briefly
        blocks_collision: COLLISION.all_but_ghost,
    },
    wall_appearing: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks_collision: COLLISION.all_but_ghost,
        on_bump(me, level, other) {
            if (other.type.can_reveal_walls) {
                level.transmute_tile(me, 'wall');
            }
        },
    },
    popwall: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
        on_ready(me, level) {
            if (level.compat.auto_convert_ccl_popwalls &&
                me.cell.some(tile => tile.type.is_actor))
            {
                // Fix blocks and other actors on top of popwalls by turning them into double
                // popwalls, which preserves CC2 popwall behavior
                me.type = TILE_TYPES['popwall2'];
            }
        },
        on_depart(me, level, other) {
            level.transmute_tile(me, 'wall');
        },
    },
    // LL specific tile that can only be stepped on /twice/, originally used to repair differences
    // with popwall behavior between Lynx and Steam
    popwall2: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
        on_depart(me, level, other) {
            level.transmute_tile(me, 'popwall');
        },
    },
    // FIXME in a cc1 tileset, these tiles are opaque  >:S
    thinwall_n: {
        draw_layer: DRAW_LAYERS.overlay,
        thin_walls: new Set(['north']),
        blocks_leaving: blocks_leaving_thin_walls,
    },
    thinwall_s: {
        draw_layer: DRAW_LAYERS.overlay,
        thin_walls: new Set(['south']),
        blocks_leaving: blocks_leaving_thin_walls,
    },
    thinwall_e: {
        draw_layer: DRAW_LAYERS.overlay,
        thin_walls: new Set(['east']),
        blocks_leaving: blocks_leaving_thin_walls,
    },
    thinwall_w: {
        draw_layer: DRAW_LAYERS.overlay,
        thin_walls: new Set(['west']),
        blocks_leaving: blocks_leaving_thin_walls,
    },
    thinwall_se: {
        draw_layer: DRAW_LAYERS.overlay,
        thin_walls: new Set(['south', 'east']),
        blocks_leaving: blocks_leaving_thin_walls,
    },
    fake_wall: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks_collision: COLLISION.all_but_ghost,
        on_ready(me, level) {
            if (level.compat.auto_convert_ccl_blue_walls &&
                me.cell.some(tile => tile.type.is_actor))
            {
                // Blocks can be pushed off of blue walls in TW Lynx, which only works due to a tiny
                // quirk of the engine that I don't want to replicate, so replace them with popwalls
                me.type = TILE_TYPES['popwall'];
            }
        },
        on_bump(me, level, other) {
            if (other.type.can_reveal_walls) {
                level.transmute_tile(me, 'wall');
            }
        },
    },
    fake_floor: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
        on_bump(me, level, other) {
            if (other.type.can_reveal_walls) {
                level.transmute_tile(me, 'floor');
            }
        },
    },
    popdown_wall: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks_collision: COLLISION.all_but_ghost,
    },
    popdown_floor: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks_collision: COLLISION.block_cc1 | COLLISION.block_cc2,
        // FIXME should be on_approach
        on_arrive(me, level, other) {
            // FIXME could probably do this with state?  or, eh
            level.transmute_tile(me, 'popdown_floor_visible');
        },
    },
    popdown_floor_visible: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks_collision: COLLISION.block_cc1 | COLLISION.block_cc2,
        on_depart(me, level, other) {
            // FIXME possibly changes back too fast, not even visible for a tic for me (much like stepping on a button oops)
            level.transmute_tile(me, 'popdown_floor');
        },
    },
    // TODO these also block the corresponding mirror actors
    no_player1_sign: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks_collision: COLLISION.player1,
    },
    no_player2_sign: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks_collision: COLLISION.player2,
    },
    steel: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks_collision: COLLISION.all,
    },
    canopy: {
        draw_layer: DRAW_LAYERS.overlay,
        // TODO augh, blobs will specifically not move from one canopy to another
        blocks_collision: COLLISION.bug | COLLISION.rover,
    },

    // Swivel doors
    swivel_floor: {
        draw_layer: DRAW_LAYERS.terrain,
    },
    swivel_ne: {
        draw_layer: DRAW_LAYERS.overlay,
        thin_walls: new Set(['north', 'east']),
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
        draw_layer: DRAW_LAYERS.overlay,
        thin_walls: new Set(['south', 'east']),
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
        draw_layer: DRAW_LAYERS.overlay,
        thin_walls: new Set(['south', 'west']),
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
        draw_layer: DRAW_LAYERS.overlay,
        thin_walls: new Set(['north', 'west']),
        on_depart(me, level, other) {
            if (other.direction === 'north') {
                level.transmute_tile(me, 'swivel_sw');
            }
            else if (other.direction === 'west') {
                level.transmute_tile(me, 'swivel_ne');
            }
        },
    },

    // Railroad
    railroad: {
        draw_layer: DRAW_LAYERS.terrain,
        track_order: [
            ['north', 'east'],
            ['south', 'east'],
            ['south', 'west'],
            ['north', 'west'],
            ['east', 'west'],
            ['north', 'south'],
        ],
        populate_defaults(me) {
            me.tracks = 0;  // bitmask of bits 0-5, corresponding to track order above
            me.track_switch = null;  // null, or 0-5 indicating the active switched track
            // If there's already an actor on us, it's treated as though it entered the tile moving
            // in this direction, which is given in the save file and defaults to zero i.e. north
            me.entered_direction = 'north';
        },
        // TODO feel like "ignores" was the wrong idea and there should just be some magic flags for
        // particular objects that can be immune to.  or maybe those objects should have their own
        // implementations of immunity
        _is_affected(me, other) {
            if (other.type.name === 'ghost')
                return false;
            if (other.has_item('railroad_sign'))
                return false;
            return true;
        },
        *_iter_tracks(me) {
            let order = me.type.track_order;
            if (me.track_switch !== null) {
                // FIXME what happens if the "top" track is not actually a valid track???
                yield order[me.track_switch];
            }
            else {
                for (let [i, track] of order.entries()) {
                    if (me.tracks & (1 << i)) {
                        yield track;
                    }
                }
            }
        },
        _switch_track(me, level) {
            if (me.track_switch !== null) {
                let current = me.track_switch;
                for (let i = 0, l = me.type.track_order.length; i < l; i++) {
                    current = (current + 1) % l;
                    if (me.tracks & (1 << current))
                        break;
                }
                level._set_tile_prop(me, 'track_switch', current);
            }
        },
        has_opening(me, direction) {
            for (let track of me.type._iter_tracks(me)) {
                if (track.indexOf(direction) >= 0) {
                    return true;
                }
            }
            return false;
        },
        blocks(me, level, other, direction) {
            return me.type._is_affected(me, other) &&
                ! me.type.has_opening(me, DIRECTIONS[direction].opposite);
        },
        blocks_leaving(me, other, direction) {
            // FIXME needs the same logic as redirect_exit, so that an illegal entrance can't leave
            // at all
            return me.type._is_affected(me, other) && ! me.type.has_opening(me, direction);
        },
        on_arrive(me, level, other) {
            // FIXME actually this happens even if you have the sign so it shouldn't ignore!!
            level._set_tile_prop(me, 'entered_direction', other.direction);
        },
        on_depart(me, level, other) {
            if (other.type.name === 'directional_block') {
                // Directional blocks are rotated when they leave
                if (other.direction === DIRECTIONS[me.entered_direction].right) {
                    let new_arrows = new Set;
                    for (let arrow of other.arrows) {
                        new_arrows.add(DIRECTIONS[arrow].right);
                    }
                    level._set_tile_prop(other, 'arrows', new_arrows);
                }
                else if (other.direction === DIRECTIONS[me.entered_direction].left) {
                    let new_arrows = new Set;
                    for (let arrow of other.arrows) {
                        new_arrows.add(DIRECTIONS[arrow].left);
                    }
                    level._set_tile_prop(other, 'arrows', new_arrows);
                }
            }

            // FIXME this only happens if we're unwired, but i don't have a way to check that atm
            me.type._switch_track(me, level);
        },
        on_power(me, level) {
            me.type._switch_track(me, level);
        },
        on_gray_button(me, level) {
            me.type._switch_track(me, level);
        },
        redirect_exit(me, other, direction) {
            if (! me.type._is_affected(me, other))
                return direction;

            let legal_exits = new Set;
            let entered_from = DIRECTIONS[me.entered_direction].opposite;
            for (let track of me.type._iter_tracks(me)) {
                if (track[0] === entered_from) {
                    legal_exits.add(track[1]);
                }
                else if (track[1] === entered_from) {
                    legal_exits.add(track[0]);
                }
            }
            if (legal_exits.has(direction)) {
                return direction;
            }
            if (legal_exits.has(DIRECTIONS[direction].right)) {
                return DIRECTIONS[direction].right;
            }
            if (legal_exits.has(DIRECTIONS[direction].left)) {
                return DIRECTIONS[direction].left;
            }
            if (legal_exits.has(DIRECTIONS[direction].opposite)) {
                return DIRECTIONS[direction].opposite;
            }
            // FIXME i think in this case the actor gets stuck, but, facing which way?
            return direction;
        },
        // FIXME track switches on depart or power or gray button
        // FIXME rotate dir blocks
    },

    // Locked doors
    door_red: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks(me, level, other) {
            // TODO not quite sure if this one is right; there are complex interactions with monsters, e.g. most monsters can eat blue keys but can't actually use them
            return ! (other.type.has_inventory && other.has_item('key_red'));
        },
        on_arrive(me, level, other) {
            if (level.take_key_from_actor(other, 'key_red')) {
                level.sfx.play_once('door', me.cell);
                level.transmute_tile(me, 'floor');
            }
        },
    },
    door_blue: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks(me, level, other) {
            return ! (other.type.has_inventory && other.has_item('key_blue'));
        },
        on_arrive(me, level, other) {
            if (level.take_key_from_actor(other, 'key_blue')) {
                level.sfx.play_once('door', me.cell);
                level.transmute_tile(me, 'floor');
            }
        },
    },
    door_yellow: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks(me, level, other) {
            return ! (other.type.has_inventory && other.has_item('key_yellow'));
        },
        on_arrive(me, level, other) {
            if (level.take_key_from_actor(other, 'key_yellow')) {
                level.sfx.play_once('door', me.cell);
                level.transmute_tile(me, 'floor');
            }
        },
    },
    door_green: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks(me, level, other) {
            return ! (other.type.has_inventory && other.has_item('key_green'));
        },
        on_arrive(me, level, other) {
            if (level.take_key_from_actor(other, 'key_green')) {
                level.sfx.play_once('door', me.cell);
                level.transmute_tile(me, 'floor');
            }
        },
    },

    // Terrain
    dirt: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
        blocks(me, level, other) {
            return (other.type.name === 'player2' && ! other.has_item('hiking_boots'));
        },
        on_arrive(me, level, other) {
            level.transmute_tile(me, 'floor');
        },
    },
    gravel: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks_collision: COLLISION.monster_solid,
        blocks(me, level, other) {
            return (other.type.name === 'player2' && ! other.has_item('hiking_boots'));
        },
    },

    // Hazards
    fire: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks_collision: COLLISION.monster_solid & ~COLLISION.fireball,
        on_arrive(me, level, other) {
            if (other.type.name === 'ice_block') {
                level.remove_tile(other);
                level.transmute_tile(me, 'water');
            }
            else if (other.type.is_player) {
                level.fail('burned');
            }
            else {
                level.remove_tile(other);
            }
        },
    },
    water: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks_collision: COLLISION.ghost,
        on_arrive(me, level, other) {
            // TODO cc1 allows items under water, i think; water was on the upper layer
            level.sfx.play_once('splash', me.cell);
            if (other.type.name === 'dirt_block') {
                level.transmute_tile(other, 'splash');
                level.transmute_tile(me, 'dirt');
            }
            else if (other.type.name === 'directional_block') {
                level.transmute_tile(other, 'splash');
                level.transmute_tile(me, 'floor');
            }
            else if (other.type.name === 'ice_block') {
                level.transmute_tile(other, 'splash');
                level.transmute_tile(me, 'ice');
            }
            else if (other.type.is_player) {
                level.fail('drowned');
            }
            else {
                level.transmute_tile(other, 'splash');
            }
        },
    },
    turtle: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks_collision: COLLISION.ghost | COLLISION.fireball,
        on_depart(me, level, other) {
            level.transmute_tile(me, 'water');
            // TODO feels like we should spawn water underneath us, then transmute ourselves into the splash?
            level.spawn_animation(me.cell, 'splash');
        },
    },
    ice: {
        draw_layer: DRAW_LAYERS.terrain,
        slide_mode: 'ice',
    },
    ice_sw: {
        draw_layer: DRAW_LAYERS.terrain,
        thin_walls: new Set(['south', 'west']),
        slide_mode: 'ice',
        blocks_leaving: blocks_leaving_thin_walls,
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
        draw_layer: DRAW_LAYERS.terrain,
        thin_walls: new Set(['north', 'west']),
        slide_mode: 'ice',
        blocks_leaving: blocks_leaving_thin_walls,
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
        draw_layer: DRAW_LAYERS.terrain,
        thin_walls: new Set(['north', 'east']),
        slide_mode: 'ice',
        blocks_leaving: blocks_leaving_thin_walls,
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
        draw_layer: DRAW_LAYERS.terrain,
        thin_walls: new Set(['south', 'east']),
        slide_mode: 'ice',
        blocks_leaving: blocks_leaving_thin_walls,
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
        draw_layer: DRAW_LAYERS.terrain,
        slide_mode: 'force',
        on_ready: on_ready_force_floor,
        on_arrive(me, level, other) {
            level.set_actor_direction(other, 'north');
        },
        on_gray_button(me, level) {
            level.transmute_tile(me, 'force_floor_s');
        },
        on_power(me, level) {
            level.transmute_tile(me, 'force_floor_s');
        },
    },
    force_floor_e: {
        draw_layer: DRAW_LAYERS.terrain,
        slide_mode: 'force',
        on_ready: on_ready_force_floor,
        on_arrive(me, level, other) {
            level.set_actor_direction(other, 'east');
        },
        on_gray_button(me, level) {
            level.transmute_tile(me, 'force_floor_w');
        },
        on_power(me, level) {
            level.transmute_tile(me, 'force_floor_w');
        },
    },
    force_floor_s: {
        draw_layer: DRAW_LAYERS.terrain,
        slide_mode: 'force',
        on_ready: on_ready_force_floor,
        on_arrive(me, level, other) {
            level.set_actor_direction(other, 'south');
        },
        on_gray_button(me, level) {
            level.transmute_tile(me, 'force_floor_n');
        },
        on_power(me, level) {
            level.transmute_tile(me, 'force_floor_n');
        },
    },
    force_floor_w: {
        draw_layer: DRAW_LAYERS.terrain,
        slide_mode: 'force',
        on_ready: on_ready_force_floor,
        on_arrive(me, level, other) {
            level.set_actor_direction(other, 'west');
        },
        on_gray_button(me, level) {
            level.transmute_tile(me, 'force_floor_e');
        },
        on_power(me, level) {
            level.transmute_tile(me, 'force_floor_e');
        },
    },
    force_floor_all: {
        draw_layer: DRAW_LAYERS.terrain,
        slide_mode: 'force',
        on_ready: on_ready_force_floor,
        // TODO ms: this is random, and an acting wall to monsters (!)
        // TODO lynx/cc2 check this at decision time, which may affect ordering
        on_arrive(me, level, other) {
            level.set_actor_direction(other, level.get_force_floor_direction());
        },
    },
    slime: {
        draw_layer: DRAW_LAYERS.terrain,
        // FIXME kills everything except ghosts, blobs, blocks
        // FIXME blobs spread slime onto floor tiles, even destroying wiring
        on_arrive(me, level, other) {
            if (other.type.name === 'dirt_block' || other.type.name === 'ice_block') {
                level.transmute_tile(me, 'floor');
            }
            else if (other.type.name === 'ghost' || other.type.name === 'blob') {
                // No effect
            }
            else if (other.type.is_player) {
                level.fail('slimed');
            }
            else {
                // FIXME needs a sound effect
                level.sfx.play_once('splash', me.cell);
                level.transmute_tile(other, 'splash_slime');
            }
        },
    },
    bomb: {
        draw_layer: DRAW_LAYERS.item,
        on_arrive(me, level, other) {
            level.remove_tile(me);
            if (other.type.is_player) {
                level.fail('exploded');
            }
            else {
                level.sfx.play_once('bomb', me.cell);
                level.transmute_tile(other, 'explosion');
            }
        },
    },
    thief_tools: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
        on_arrive(me, level, other) {
            if (level.take_tool_from_actor(other, 'bribe')) {
                // TODO bribe sound
                return;
            }

            let lost = level.take_all_tools_from_actor(other);
            if (other.type.is_player) {
                if (level.bonus_points > 0) {
                    lost = true;
                }
                level.adjust_bonus(0, 0.5);
            }
            if (lost && other === level.player) {
                level.sfx.play_once('thief', me.cell);
            }
        },
    },
    thief_keys: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
        on_arrive(me, level, other) {
            if (level.take_tool_from_actor(other, 'bribe')) {
                // TODO bribe sound
                return;
            }

            let lost = level.take_all_keys_from_actor(other);
            if (other.type.is_player) {
                if (level.bonus_points > 0) {
                    lost = true;
                }
                level.adjust_bonus(0, 0.5);
            }
            if (lost && other === level.player) {
                level.sfx.play_once('thief', me.cell);
            }
        },
    },
    no_sign: {
        draw_layer: DRAW_LAYERS.item_mod,
        item_modifier: 'ignore',
        collision_allow: COLLISION.monster_solid,
        blocks(me, level, other) {
            let item;
            for (let tile of me.cell) {
                if (tile.type.is_item) {
                    item = tile.type.name;
                    break;
                }
            }
            return item && other.has_item(item);
        },
    },
    bestowal_bow: {
        draw_layer: DRAW_LAYERS.item_mod,
        item_modifier: 'pickup',
    },

    // Mechanisms
    dirt_block: {
        draw_layer: DRAW_LAYERS.actor,
        collision_mask: COLLISION.block_cc1,
        blocks_collision: COLLISION.all,
        is_actor: true,
        is_block: true,
        ignores: new Set(['fire', 'flame_jet_on']),
        movement_speed: 4,
    },
    ice_block: {
        draw_layer: DRAW_LAYERS.actor,
        collision_mask: COLLISION.block_cc2,
        blocks_collision: COLLISION.all,
        is_actor: true,
        is_block: true,
        can_reveal_walls: true,
        movement_speed: 4,
        pushes: {
            ice_block: true,
            directional_block: true,
        },
    },
    directional_block: {
        // TODO directional, obviously
        // TODO floor in water
        // TODO destroyed in slime
        // TODO rotate on train tracks
        draw_layer: DRAW_LAYERS.actor,
        collision_mask: COLLISION.block_cc2,
        blocks_collision: COLLISION.all,
        is_actor: true,
        is_block: true,
        can_reveal_walls: true,
        movement_speed: 4,
        allows_push(me, direction) {
            return me.arrows && me.arrows.has(direction);
        },
        pushes: {
            dirt_block: true,
            ice_block: true,
            directional_block: true,
        },
    },
    green_floor: {
        draw_layer: DRAW_LAYERS.terrain,
        on_gray_button(me, level) {
            level.transmute_tile(me, 'green_wall');
        },
        on_power(me, level) {
            me.type.on_gray_button(me, level);
        },
    },
    green_wall: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks_collision: COLLISION.all_but_ghost,
        on_gray_button(me, level) {
            level.transmute_tile(me, 'green_floor');
        },
        on_power(me, level) {
            me.type.on_gray_button(me, level);
        },
    },
    green_chip: {
        draw_layer: DRAW_LAYERS.item,
        is_chip: true,
        is_required_chip: true,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
        on_arrive(me, level, other) {
            if (other.type.is_real_player) {
                level.collect_chip();
                level.remove_tile(me);
            }
        },
        // Not affected by gray buttons
    },
    green_bomb: {
        draw_layer: DRAW_LAYERS.item,
        is_required_chip: true,
        on_arrive(me, level, other) {
            level.remove_tile(me);
            if (other.type.is_player) {
                level.fail('exploded');
            }
            else {
                level.sfx.play_once('bomb', me.cell);
                level.transmute_tile(other, 'explosion');
            }
        },
        // Not affected by gray buttons
    },
    purple_floor: {
        draw_layer: DRAW_LAYERS.terrain,
        on_gray_button(me, level) {
            level.transmute_tile(me, 'purple_wall');
        },
        on_power(me, level) {
            me.type.on_gray_button(me, level);
        },
        on_depower(me, level) {
            me.type.on_gray_button(me, level);
        },
    },
    purple_wall: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks_collision: COLLISION.all_but_ghost,
        on_gray_button(me, level) {
            level.transmute_tile(me, 'purple_floor');
        },
        on_power(me, level) {
            me.type.on_gray_button(me, level);
        },
        on_depower(me, level) {
            me.type.on_gray_button(me, level);
        },
    },
    cloner: {
        draw_layer: DRAW_LAYERS.terrain,
        // FIXME can also catch bowling balls
        blocks_collision: COLLISION.player | COLLISION.block_cc1 | COLLISION.monster_solid,
        traps(me, actor) {
            return ! actor._clone_release;
        },
        activate(me, level) {
            let actor = me.cell.get_actor();
            if (! actor)
                return;

            // Copy this stuff in case the movement changes it
            // TODO should anything else be preserved?
            let type = actor.type;
            let direction = actor.direction;

            // Unstick and try to move the actor; if it's blocked, abort the clone.
            // This temporary flag tells us to let it leave; it doesn't need to be undoable, since
            // it doesn't persist for more than a tic
            actor._clone_release = true;
            if (level.attempt_step(actor, direction)) {
                // FIXME add this underneath, just above the cloner
                let new_template = new actor.constructor(type, direction);
                level.add_tile(new_template, me.cell);
                level.add_actor(new_template);
            }
            delete actor._clone_release;
        },
        // Also clones on rising pulse or gray button
        on_power(me, level) {
            me.type.activate(me, level);
        },
        on_gray_button(me, level) {
            me.type.activate(me, level);
        },
    },
    trap: {
        draw_layer: DRAW_LAYERS.terrain,
        add_press_ready(me, level, other) {
            // Same as below, but without ejection
            me.presses = (me.presses ?? 0) + 1;
        },
        // Lynx (not cc2): open traps immediately eject their contents on arrival, if possible
        add_press(me, level) {
            level._set_tile_prop(me, 'presses', (me.presses ?? 0) + 1);
            if (me.presses === 1) {
                // Free everything on us, if we went from 0 to 1 presses (i.e. closed to open)
                for (let tile of Array.from(me.cell)) {
                    if (tile.type.is_actor) {
                        // Forcibly move anything released from a trap, to keep it in sync with
                        // whatever pushed the button
                        level.attempt_step(tile, tile.direction);
                    }
                }
            }
        },
        remove_press(me, level) {
            level._set_tile_prop(me, 'presses', me.presses - 1);
        },
        // FIXME also doesn't trap ghosts, is that a special case???
        traps(me, actor) {
            return ! me.presses;
        },
        on_power(me, level) {
            // Treat being powered or not as an extra kind of brown button press
            me.type.add_press(me, level);
        },
        on_depower(me, level) {
            me.type.remove_press(me, level);
        },
        visual_state(me) {
            if (me && me.presses) {
                return 'open';
            }
            else {
                return 'closed';
            }
        },
    },
    transmogrifier: {
        draw_layer: DRAW_LAYERS.terrain,
        _mogrifications: {
            player: 'player2',
            player2: 'player',
            doppelganger1: 'doppelganger2',
            doppelganger2: 'doppelganger1',

            dirt_block: 'ice_block',
            ice_block: 'dirt_block',

            ball: 'walker',
            walker: 'ball',

            fireball: 'bug',
            bug: 'glider',
            glider: 'paramecium',
            paramecium: 'fireball',

            tank_blue: 'tank_yellow',
            tank_yellow: 'tank_blue',

            teeth: 'teeth_timid',
            teeth_timid: 'teeth',
        },
        _blob_mogrifications: ['ball', 'walker', 'fireball', 'glider', 'paramecium', 'bug', 'tank_blue', 'teeth', 'teeth_timid'],
        // TODO can be wired, in which case only works when powered; other minor concerns, see wiki
        on_arrive(me, level, other) {
            let name = other.type.name;
            if (me.type._mogrifications[name]) {
                level.transmute_tile(other, me.type._mogrifications[name]);
            }
            else if (name === 'blob') {
                // TODO how is this randomness determined?  important for replays!
                let options = me.type._blob_mogrifications;
                level.transmute_tile(other, options[Math.floor(Math.random() * options.length)]);
            }
        },
    },
    teleport_blue: {
        draw_layer: DRAW_LAYERS.terrain,
        teleport_dest_order(me, level, other) {
            return level.iter_tiles_in_reading_order(me.cell, 'teleport_blue', true);
        },
    },
    teleport_red: {
        draw_layer: DRAW_LAYERS.terrain,
        teleport_try_all_directions: true,
        teleport_allow_override: true,
        teleport_dest_order(me, level, other) {
            return level.iter_tiles_in_reading_order(me.cell, 'teleport_red');
        },
    },
    teleport_green: {
        draw_layer: DRAW_LAYERS.terrain,
        teleport_try_all_directions: true,
        teleport_dest_order(me, level, other) {
            let all = Array.from(level.iter_tiles_in_reading_order(me.cell, 'teleport_green'));
            if (all.length <= 1) {
                // If this is the only teleporter, just walk out the other side — and, crucially, do
                // NOT advance the PRNG
                return [me];
            }
            // Note the iterator starts on the /next/ teleporter, so there's an implicit +1 here.
            // The -1 is to avoid spitting us back out of the same teleporter, which will be last in
            // the list
            let target = all[level.prng() % (all.length - 1)];
            // Also set the actor's (initial) exit direction
            level.set_actor_direction(other, ['north', 'east', 'south', 'west'][level.prng() % 4]);
            return [target, me];
        },
    },
    teleport_yellow: {
        draw_layer: DRAW_LAYERS.terrain,
        teleport_allow_override: true,
        teleport_dest_order(me, level, other) {
            return level.iter_tiles_in_reading_order(me.cell, 'teleport_yellow', true);
        },
    },
    // Flame jet rules:
    // - State toggles /while/ an orange button is held or wire current is received
    // - Multiple such inputs cancel each other out
    // - Gray button toggles it permanently
    flame_jet_off: {
        draw_layer: DRAW_LAYERS.terrain,
        activate(me, level) {
            level.transmute_tile(me, 'flame_jet_on');
        },
        on_gray_button(me, level) {
            me.type.activate(me, level);
        },
        on_power(me, level) {
            me.type.activate(me, level);
        },
    },
    flame_jet_on: {
        draw_layer: DRAW_LAYERS.terrain,
        activate(me, level) {
            level.transmute_tile(me, 'flame_jet_off');
        },
        on_gray_button(me, level) {
            me.type.activate(me, level);
        },
        on_power(me, level) {
            me.type.activate(me, level);
        },
        // Kill anything that shows up
        // FIXME every tic, also kills every actor in the cell (mostly matters if you step on with
        // fire boots and then drop them)
        on_arrive(me, level, other) {
            // Note that blocks, fireballs, and anything with fire boots are immune
            // TODO would be neat if this understood "ignores anything with fire immunity" but that
            // might be a bit too high-level for this game
            if (other.type.is_player) {
                level.fail('burned');
            }
            else {
                // TODO should this play a sound?
                level.transmute_tile(other, 'explosion');
            }
        },
    },
    // Buttons
    button_blue: {
        draw_layer: DRAW_LAYERS.terrain,
        on_arrive(me, level, other) {
            level.sfx.play_once('button-press', me.cell);

            // Flip direction of all blue tanks
            for (let actor of level.actors) {
                // TODO generify somehow??
                if (actor.type.name === 'tank_blue') {
                    level._set_tile_prop(actor, 'pending_reverse', ! actor.pending_reverse);
                }
            }
        },
        on_depart(me, level, other) {
            level.sfx.play_once('button-release', me.cell);
        },
    },
    button_yellow: {
        draw_layer: DRAW_LAYERS.terrain,
        on_arrive(me, level, other) {
            level.sfx.play_once('button-press', me.cell);

            // Move all yellow tanks one tile in the direction of the pressing actor
            for (let i = level.actors.length - 1; i >= 0; i--) {
                let actor = level.actors[i];
                // TODO generify somehow??
                if (actor.type.name === 'tank_yellow') {
                    level.attempt_step(actor, other.direction);
                }
            }
        },
        on_depart(me, level, other) {
            level.sfx.play_once('button-release', me.cell);
        },
    },
    button_green: {
        draw_layer: DRAW_LAYERS.terrain,
        on_arrive(me, level, other) {
            level.sfx.play_once('button-press', me.cell);

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
        on_depart(me, level, other) {
            level.sfx.play_once('button-release', me.cell);
        },
    },
    button_brown: {
        draw_layer: DRAW_LAYERS.terrain,
        connects_to: 'trap',
        connect_order: 'forward',
        on_ready(me, level) {
            // Inform the trap of any actors that start out holding us down
            let trap = me.connection;
            if (! (trap && trap.cell))
                return;

            for (let tile of me.cell) {
                if (tile.type.is_actor) {
                    trap.type.add_press_ready(trap, level);
                }
            }
        },
        on_arrive(me, level, other) {
            level.sfx.play_once('button-press', me.cell);

            let trap = me.connection;
            if (trap && trap.cell) {
                trap.type.add_press(trap, level);
            }
        },
        on_depart(me, level, other) {
            level.sfx.play_once('button-release', me.cell);

            let trap = me.connection;
            if (trap && trap.cell) {
                trap.type.remove_press(trap, level);
            }
        },
    },
    button_red: {
        draw_layer: DRAW_LAYERS.terrain,
        connects_to: 'cloner',
        connect_order: 'forward',
        on_arrive(me, level, other) {
            level.sfx.play_once('button-press', me.cell);

            let cloner = me.connection;
            if (cloner && cloner.cell) {
                cloner.type.activate(cloner, level);
            }
        },
        on_depart(me, level, other) {
            level.sfx.play_once('button-release', me.cell);
        },
    },
    button_orange: {
        draw_layer: DRAW_LAYERS.terrain,
        connects_to: new Set(['flame_jet_off', 'flame_jet_on']),
        connect_order: 'diamond',
        // Both stepping on and leaving the button have the same effect: toggle the state of the
        // connected flame jet
        _toggle_flame_jet(me, level, other) {
            let jet = me.connection;
            if (jet && jet.cell) {
                jet.type.activate(jet, level);
            }
        },
        on_arrive(me, level, other) {
            level.sfx.play_once('button-press', me.cell);

            me.type._toggle_flame_jet(me, level, other);
        },
        on_depart(me, level, other) {
            level.sfx.play_once('button-release', me.cell);

            me.type._toggle_flame_jet(me, level, other);
        },
    },
    button_pink: {
        draw_layer: DRAW_LAYERS.terrain,
        is_power_source: true,
        get_emitting_edges(me, level) {
            // We emit current as long as there's an actor fully on us
            if (me.cell.some(tile => tile.type.is_actor && tile.movement_cooldown === 0)) {
                return me.wire_directions;
            }
            else {
                return 0;
            }
        },
        on_arrive(me, level, other) {
            level.sfx.play_once('button-press', me.cell);
        },
        on_depart(me, level, other) {
            level.sfx.play_once('button-release', me.cell);
        },
    },
    button_black: {
        // TODO not implemented
        draw_layer: DRAW_LAYERS.terrain,
        is_power_source: true,
        get_emitting_edges(me, level) {
            // We emit current as long as there's NOT an actor fully on us
            if (! me.cell.some(tile => tile.type.is_actor && tile.movement_cooldown === 0)) {
                return me.wire_directions;
            }
            else {
                return 0;
            }
        },
    },
    button_gray: {
        // TODO only partially implemented
        draw_layer: DRAW_LAYERS.terrain,
        on_arrive(me, level, other) {
            level.sfx.play_once('button-press', me.cell);

            for (let x = Math.max(0, me.cell.x - 2); x <= Math.min(level.width - 1, me.cell.x + 2); x++) {
                for (let y = Math.max(0, me.cell.y - 2); y <= Math.min(level.height - 1, me.cell.y + 2); y++) {
                    let cell = level.cells[y][x];
                    // TODO wait is this right
                    if (cell === me.cell)
                        continue;

                    for (let tile of cell) {
                        if (tile.type.on_gray_button) {
                            tile.type.on_gray_button(tile, level);
                        }
                    }
                }
            }
        },
        on_depart(me, level, other) {
            level.sfx.play_once('button-release', me.cell);
        },
    },
    // Logic gates, all consolidated into a single tile type
    logic_gate: {
        // gate_type: not, and, or, xor, nand, latch-cw, latch-ccw, counter, bogus
        _gate_types: {
            not: ['out0', null, 'in0', null],
            and: ['out0', 'in0', null, 'in1'],
            or: ['out0', 'in0', null, 'in1'],
            xor: ['out0', 'in0', null, 'in1'],
            nand: ['out0', 'in0', null, 'in1'],
            // in0 is the trigger, in1 is the input
            'latch-cw': ['out0', 'in0', null, 'in1'],
            // in0 is the input, in1 is the trigger
            'latch-ccw': ['out0', 'in0', null, 'in1'],
            // inputs: inc, dec; outputs: overflow, underflow
            counter: ['out1', 'in0', 'in1', 'out0'],
        },
        draw_layer: DRAW_LAYERS.terrain,
        is_power_source: true,
        on_ready(me, level) {
            me.gate_def = me.type._gate_types[me.gate_type];
            if (me.gate_type === 'latch-cw' || me.gate_type === 'latch-ccw') {
                me.memory = false;
            }
            else if (me.gate_type === 'counter') {
                me.memory = me.memory ?? 0;
                me.incrementing = false;
                me.decrementing = false;
                me.underflowing = false;
                me.direction = 'north';
            }
        },
        get_emitting_edges(me, level) {
            // Collect which of our edges are powered, in clockwise order starting from our
            // direction, matching _gate_types
            let input0 = false, input1 = false;
            let output0 = false, output1 = false;
            let outbit0 = 0, outbit1 = 0;
            let dir = me.direction;
            for (let i = 0; i < 4; i++) {
                let cxn = me.gate_def[i];
                let dirinfo = DIRECTIONS[dir];
                if (cxn === 'in0') {
                    input0 = (me.cell.powered_edges & dirinfo.bit) !== 0;
                }
                else if (cxn === 'in1') {
                    input1 = (me.cell.powered_edges & dirinfo.bit) !== 0;
                }
                else if (cxn === 'out0') {
                    outbit0 = dirinfo.bit;
                }
                else if (cxn === 'out1') {
                    outbit1 = dirinfo.bit;
                }
                dir = dirinfo.right;
            }

            if (me.gate_type === 'not') {
                output0 = ! input0;
            }
            else if (me.gate_type === 'and') {
                output0 = input0 && input1;
            }
            else if (me.gate_type === 'or') {
                output0 = input0 || input1;
            }
            else if (me.gate_type === 'xor') {
                output0 = input0 !== input1;
            }
            else if (me.gate_type === 'nand') {
                output0 = ! (input0 && input1);
            }
            else if (me.gate_type === 'latch-cw') {
                if (input0) {
                    level._set_tile_prop(me, 'memory', input1);
                }
                output0 = me.memory;
            }
            else if (me.gate_type === 'latch-ccw') {
                if (input1) {
                    level._set_tile_prop(me, 'memory', input0);
                }
                output0 = me.memory;
            }
            else if (me.gate_type === 'counter') {
                let inc = input0 && ! me.incrementing;
                let dec = input1 && ! me.decrementing;
                let mem = me.memory;
                if (inc || dec) {
                    level._set_tile_prop(me, 'underflowing', false);
                }
                if (inc && ! dec) {
                    mem++;
                    if (mem > 9) {
                        mem = 0;
                        output0 = true;
                    }
                }
                else if (dec && ! inc) {
                    mem--;
                    if (mem < 0) {
                        mem = 9;
                        // Underflow is persistent until the next pulse
                        level._set_tile_prop(me, 'underflowing', true);
                    }
                }
                output1 = me.underflowing;
                level._set_tile_prop(me, 'memory', mem);
                level._set_tile_prop(me, 'incrementing', input0);
                level._set_tile_prop(me, 'decrementing', input1);
            }

            return (output0 ? outbit0 : 0) | (output1 ? outbit1 : 0);
        },
        visual_state(me) {
            return me.gate_type;
        },
    },
    // Light switches, kinda like the pink/black buttons but persistent
    light_switch_off: {
        draw_layer: DRAW_LAYERS.terrain,
        is_power_source: true,
        get_emitting_edges(me, level) {
            return 0;
        },
        on_arrive(me, level, other) {
            level.transmute_tile(me, 'light_switch_on');
        },
    },
    light_switch_on: {
        draw_layer: DRAW_LAYERS.terrain,
        is_power_source: true,
        get_emitting_edges(me, level) {
            return me.wire_directions;
        },
        on_arrive(me, level, other) {
            level.transmute_tile(me, 'light_switch_off');
        },
    },

    // Time alteration
    stopwatch_bonus: {
        draw_layer: DRAW_LAYERS.item,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
        on_arrive(me, level, other) {
            if (other.type.is_real_player) {
                level.remove_tile(me);
                level.adjust_timer(+10);
            }
        },
    },
    stopwatch_penalty: {
        draw_layer: DRAW_LAYERS.item,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
        on_arrive(me, level, other) {
            if (other.type.is_real_player) {
                level.remove_tile(me);
                level.adjust_timer(-10);
            }
        },
    },
    stopwatch_toggle: {
        draw_layer: DRAW_LAYERS.item,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
        on_arrive(me, level, other) {
            if (other.type.is_real_player) {
                level.pause_timer();
            }
        },
    },

    // Critters
    bug: {
        draw_layer: DRAW_LAYERS.actor,
        is_actor: true,
        is_monster: true,
        collision_mask: COLLISION.bug,
        blocks_collision: COLLISION.all_but_player,
        movement_speed: 4,
        decide_movement(me, level) {
            // always try turning as left as possible, and fall back to less-left turns
            let d = DIRECTIONS[me.direction];
            return [d.left, me.direction, d.right, d.opposite];
        },
    },
    paramecium: {
        draw_layer: DRAW_LAYERS.actor,
        is_actor: true,
        is_monster: true,
        collision_mask: COLLISION.monster_generic,
        blocks_collision: COLLISION.all_but_player,
        movement_speed: 4,
        decide_movement(me, level) {
            // always try turning as right as possible, and fall back to less-right turns
            let d = DIRECTIONS[me.direction];
            return [d.right, me.direction, d.left, d.opposite];
        },
    },
    ball: {
        draw_layer: DRAW_LAYERS.actor,
        is_actor: true,
        is_monster: true,
        collision_mask: COLLISION.monster_generic,
        blocks_collision: COLLISION.all_but_player,
        movement_speed: 4,
        decide_movement(me, level) {
            // preserve current direction; if that doesn't work, bounce back the way we came
            let d = DIRECTIONS[me.direction];
            return [me.direction, d.opposite];
        },
    },
    walker: {
        draw_layer: DRAW_LAYERS.actor,
        is_actor: true,
        is_monster: true,
        collision_mask: COLLISION.monster_generic,
        blocks_collision: COLLISION.all_but_player,
        movement_speed: 4,
        decide_movement(me, level) {
            // preserve current direction; if that doesn't work, pick a random direction, even the
            // one we failed to move in (but ONLY then; important for RNG sync)
            return [
                me.direction,
                () => {
                    let direction = me.direction;
                    let num_turns = level.prng() % 4;
                    for (let i = 0; i < num_turns; i++) {
                        direction = DIRECTIONS[direction].right;
                    }
                    return direction;
                },
            ];
        },
    },
    tank_blue: {
        draw_layer: DRAW_LAYERS.actor,
        is_actor: true,
        is_monster: true,
        collision_mask: COLLISION.monster_generic,
        blocks_collision: COLLISION.all_but_player,
        movement_speed: 4,
        decide_movement(me, level) {
            // always keep moving forward, but reverse if the flag is set
            let direction = me.direction;
            if (me.pending_reverse) {
                direction = DIRECTIONS[me.direction].opposite;
                level._set_tile_prop(me, 'pending_reverse', false);
            }
            if (me.cell.has('cloner')) {
                // Tanks on cloners should definitely ignore the flag, but we clear it first
                // TODO feels clumsy
                return null;
            }
            return [direction];
        }
    },
    tank_yellow: {
        draw_layer: DRAW_LAYERS.actor,
        is_actor: true,
        is_monster: true,
        collision_mask: COLLISION.monster_generic,
        blocks_collision: COLLISION.all_but_player,
        pushes: {
            dirt_block: true,
            ice_block: true,
            directional_block: true,
        },
        movement_speed: 4,
    },
    blob: {
        draw_layer: DRAW_LAYERS.actor,
        is_actor: true,
        is_monster: true,
        collision_mask: COLLISION.monster_generic,
        blocks_collision: COLLISION.all_but_player,
        movement_speed: 8,
        decide_movement(me, level) {
            // move completely at random
            let modifier = level.get_blob_modifier();
            return [['north', 'east', 'south', 'west'][(level.prng() + modifier) % 4]];
        },
    },
    teeth: {
        draw_layer: DRAW_LAYERS.actor,
        is_actor: true,
        is_monster: true,
        collision_mask: COLLISION.monster_generic,
        blocks_collision: COLLISION.all_but_player,
        movement_speed: 4,
        movement_parity: 2,
        decide_movement(me, level) {
            let preference = pursue_player(me, level);
            if (level.player.type.name === 'player2') {
                // Run away from Cerise
                for (let [i, direction] of preference.entries()) {
                    preference[i] = DIRECTIONS[direction].opposite;
                }
            }
            return preference;
        },
    },
    teeth_timid: {
        draw_layer: DRAW_LAYERS.actor,
        is_actor: true,
        is_monster: true,
        collision_mask: COLLISION.monster_generic,
        blocks_collision: COLLISION.all_but_player,
        movement_speed: 4,
        movement_parity: 2,
        decide_movement(me, level) {
            let preference = pursue_player(me, level);
            if (level.player.type.name === 'player') {
                // Run away from Lexy
                for (let [i, direction] of preference.entries()) {
                    preference[i] = DIRECTIONS[direction].opposite;
                }
            }
            return preference;
        },
    },
    fireball: {
        draw_layer: DRAW_LAYERS.actor,
        is_actor: true,
        is_monster: true,
        collision_mask: COLLISION.fireball,
        blocks_collision: COLLISION.all_but_player,
        movement_speed: 4,
        ignores: new Set(['fire', 'flame_jet_on']),
        decide_movement(me, level) {
            // turn right: preserve current direction; if that doesn't work, turn right, then left,
            // then back the way we came
            let d = DIRECTIONS[me.direction];
            return [me.direction, d.right, d.left, d.opposite];
        },
    },
    glider: {
        draw_layer: DRAW_LAYERS.actor,
        is_actor: true,
        is_monster: true,
        collision_mask: COLLISION.monster_generic,
        blocks_collision: COLLISION.all_but_player,
        movement_speed: 4,
        ignores: new Set(['water']),
        decide_movement(me, level) {
            // turn left: preserve current direction; if that doesn't work, turn left, then right,
            // then back the way we came
            let d = DIRECTIONS[me.direction];
            return [me.direction, d.left, d.right, d.opposite];
        },
    },
    ghost: {
        draw_layer: DRAW_LAYERS.actor,
        is_actor: true,
        is_monster: true,
        collision_mask: COLLISION.ghost,
        blocks_collision: COLLISION.all_but_player,
        has_inventory: true,
        movement_speed: 4,
        // TODO ignores /most/ walls.  collision is basically completely different.  has a regular inventory, except red key.  good grief
        decide_movement(me, level) {
            // turn right: preserve current direction; if that doesn't work, turn right, then left,
            // then back the way we came
            // (same as fireball)
            let d = DIRECTIONS[me.direction];
            return [me.direction, d.right, d.left, d.opposite];
        },
    },
    floor_mimic: {
        draw_layer: DRAW_LAYERS.actor,
        is_actor: true,
        is_monster: true,
        collision_mask: COLLISION.monster_generic,
        blocks_collision: COLLISION.all_but_player,
        movement_speed: 4,
        movement_parity: 4,
        decide_movement: pursue_player,
    },
    rover: {
        // TODO this guy is a nightmare
        // TODO pushes blocks apparently??
        draw_layer: DRAW_LAYERS.actor,
        is_actor: true,
        is_monster: true,
        collision_mask: COLLISION.rover,
        blocks_collision: COLLISION.all_but_player,
        can_reveal_walls: true,
        movement_speed: 4,
    },

    // Keys, whose behavior varies
    key_red: {
        // TODO Red key can ONLY be picked up by players (and doppelgangers), no other actor that
        // has an inventory
        draw_layer: DRAW_LAYERS.item,
        is_item: true,
        is_key: true,
    },
    key_blue: {
        // Blue key is picked up by dirt blocks and all monsters, including those that don't have an
        // inventory normally
        draw_layer: DRAW_LAYERS.item,
        is_item: true,
        is_key: true,
        on_arrive(me, level, other) {
            // Call it...  everything except ice and directional blocks?  These rules are weird.
            // Note that the game itself normally handles picking items up, so we only get here for
            // actors who aren't supposed to have an inventory
            // TODO make this a...  flag?  i don't know?
            // TODO major difference from lynx...
            if (other.type.name !== 'ice_block' && other.type.name !== 'directional_block') {
                level.attempt_take(other, me);
            }
        },
    },
    key_yellow: {
        draw_layer: DRAW_LAYERS.item,
        is_item: true,
        is_key: true,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
    },
    key_green: {
        draw_layer: DRAW_LAYERS.item,
        is_item: true,
        is_key: true,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
    },
    // Boots
    // TODO note: ms allows blocks to pass over tools
    cleats: {
        draw_layer: DRAW_LAYERS.item,
        is_item: true,
        is_tool: true,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
        item_ignores: new Set(['ice', 'ice_nw', 'ice_ne', 'ice_sw', 'ice_se']),
    },
    suction_boots: {
        draw_layer: DRAW_LAYERS.item,
        is_item: true,
        is_tool: true,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
        item_ignores: new Set([
            'force_floor_n',
            'force_floor_s',
            'force_floor_e',
            'force_floor_w',
            'force_floor_all',
        ]),
    },
    fire_boots: {
        draw_layer: DRAW_LAYERS.item,
        is_item: true,
        is_tool: true,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
        item_ignores: new Set(['fire', 'flame_jet_on']),
    },
    flippers: {
        draw_layer: DRAW_LAYERS.item,
        is_item: true,
        is_tool: true,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
        item_ignores: new Set(['water']),
    },
    hiking_boots: {
        draw_layer: DRAW_LAYERS.item,
        is_item: true,
        is_tool: true,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
        // FIXME uhh these "ignore" that dirt and gravel block us, but they don't ignore the on_arrive, so, uhhhh
    },
    // Other tools
    dynamite: {
        draw_layer: DRAW_LAYERS.item,
        is_item: true,
        is_tool: true,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
        // FIXME does a thing when dropped, but that isn't implemented at all yet
    },
    bowling_ball: {
        // TODO not implemented, rolls when dropped, has an inventory, yadda yadda
        draw_layer: DRAW_LAYERS.item,
        is_item: true,
        is_tool: true,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
    },
    xray_eye: {
        // TODO not implemented
        draw_layer: DRAW_LAYERS.item,
        is_item: true,
        is_tool: true,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
    },
    helmet: {
        // TODO not implemented
        draw_layer: DRAW_LAYERS.item,
        is_item: true,
        is_tool: true,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
    },
    railroad_sign: {
        draw_layer: DRAW_LAYERS.item,
        is_item: true,
        is_tool: true,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
    },
    foil: {
        // TODO not implemented
        draw_layer: DRAW_LAYERS.item,
        is_item: true,
        is_tool: true,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
    },
    lightning_bolt: {
        // TODO not implemented
        draw_layer: DRAW_LAYERS.item,
        is_item: true,
        is_tool: true,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
    },
    speed_boots: {
        // TODO not implemented
        draw_layer: DRAW_LAYERS.item,
        is_item: true,
        is_tool: true,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
    },
    bribe: {
        // TODO not implemented
        draw_layer: DRAW_LAYERS.item,
        is_item: true,
        is_tool: true,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
    },
    hook: {
        draw_layer: DRAW_LAYERS.item,
        is_item: true,
        is_tool: true,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
    },

    // Progression
    player: {
        draw_layer: DRAW_LAYERS.actor,
        is_actor: true,
        is_player: true,
        is_real_player: true,
        collision_mask: COLLISION.player1,
        // FIXME does this make us block the doppelgangers??
        blocks_collision: COLLISION.player,
        has_inventory: true,
        can_reveal_walls: true,
        movement_speed: 4,
        pushes: {
            dirt_block: true,
            ice_block: true,
            directional_block: true,
        },
        infinite_items: {
            key_green: true,
        },
        visual_state: player_visual_state,
    },
    player2: {
        draw_layer: DRAW_LAYERS.actor,
        is_actor: true,
        is_player: true,
        is_real_player: true,
        collision_mask: COLLISION.player2,
        blocks_collision: COLLISION.players,
        has_inventory: true,
        can_reveal_walls: true,
        movement_speed: 4,
        ignores: new Set(['ice', 'ice_nw', 'ice_ne', 'ice_sw', 'ice_se']),
        pushes: {
            dirt_block: true,
            ice_block: true,
            directional_block: true,
        },
        infinite_items: {
            key_yellow: true,
        },
        visual_state: player_visual_state,
    },
    doppelganger1: {
        draw_layer: DRAW_LAYERS.actor,
        is_actor: true,
        is_player: true,
        is_monster: true,
        collision_mask: COLLISION.player1,
        blocks_collision: COLLISION.all_but_player,
        has_inventory: true,
        can_reveal_walls: true,  // XXX i think?
        movement_speed: 4,
        pushes: {
            dirt_block: true,
            ice_block: true,
            directional_block: true,
        },
        infinite_items: {
            key_green: true,
        },
        decide_movement(me, level) {
            if (level.player1_move) {
                return [level.player1_move];
            }
            else {
                return null;
            }
        },
        //visual_state: doppelganger_visual_state,
    },
    doppelganger2: {
        draw_layer: DRAW_LAYERS.actor,
        is_actor: true,
        is_player: true,
        is_monster: true,
        collision_mask: COLLISION.player2,
        blocks_collision: COLLISION.all_but_player,
        has_inventory: true,
        can_reveal_walls: true,  // XXX i think?
        movement_speed: 4,
        ignores: new Set(['ice', 'ice_nw', 'ice_ne', 'ice_sw', 'ice_se']),
        pushes: {
            dirt_block: true,
            ice_block: true,
            directional_block: true,
        },
        infinite_items: {
            key_yellow: true,
        },
        decide_movement(me, level) {
            if (level.player2_move) {
                return [level.player2_move];
            }
            else {
                return null;
            }
        },
        //visual_state: doppelganger_visual_state,
    },
    chip: {
        draw_layer: DRAW_LAYERS.item,
        is_chip: true,
        is_required_chip: true,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
        on_arrive(me, level, other) {
            if (other.type.is_real_player) {
                level.collect_chip();
                level.remove_tile(me);
            }
        },
    },
    chip_extra: {
        draw_layer: DRAW_LAYERS.item,
        is_chip: true,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
        on_arrive(me, level, other) {
            if (other.type.is_real_player) {
                level.collect_chip();
                level.remove_tile(me);
            }
        },
    },
    score_10: {
        draw_layer: DRAW_LAYERS.item,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
        on_arrive(me, level, other) {
            if (other.type.is_real_player) {
                level.adjust_bonus(10);
            }
            // TODO turn this into a flag on those types??  idk
            if (other.type.is_player || other.type.name === 'rover' || other.type.name === 'bowling_ball') {
                level.remove_tile(me);
            }
        },
    },
    score_100: {
        draw_layer: DRAW_LAYERS.item,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
        on_arrive(me, level, other) {
            if (other.type.is_real_player) {
                level.adjust_bonus(100);
            }
            if (other.type.is_player || other.type.name === 'rover' || other.type.name === 'bowling_ball') {
                level.remove_tile(me);
            }
        },
    },
    score_1000: {
        draw_layer: DRAW_LAYERS.item,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
        on_arrive(me, level, other) {
            if (other.type.is_real_player) {
                level.adjust_bonus(1000);
            }
            if (other.type.is_player || other.type.name === 'rover' || other.type.name === 'bowling_ball') {
                level.remove_tile(me);
            }
        },
    },
    score_2x: {
        draw_layer: DRAW_LAYERS.item,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
        on_arrive(me, level, other) {
            if (other.type.is_real_player) {
                level.adjust_bonus(0, 2);
            }
            if (other.type.is_player || other.type.name === 'rover' || other.type.name === 'bowling_ball') {
                level.remove_tile(me);
            }
        },
    },

    hint: {
        draw_layer: DRAW_LAYERS.terrain,
        is_hint: true,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
        populate_defaults(me) {
            me.hint_text = null;  // optional, may use level's hint instead
        },
    },
    socket: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks_collision: COLLISION.block_cc1 | COLLISION.block_cc2 | COLLISION.monster_solid,
        blocks(me, level, other) {
            return (level.chips_remaining > 0);
        },
        on_arrive(me, level, other) {
            if (level.chips_remaining === 0) {
                level.sfx.play_once('socket', me.cell);
                level.transmute_tile(me, 'floor');
            }
        },
    },
    exit: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks_collision: COLLISION.block_cc1 | COLLISION.block_cc2 | COLLISION.monster_solid,
        on_arrive(me, level, other) {
            if (other.type.is_player) {
                level.win();
            }
        },
    },

    // VFX
    splash: {
        draw_layer: DRAW_LAYERS.overlay,
        is_actor: true,
        collision_mask: 0,
        blocks_collision: COLLISION.player,
        ttl: 6,
    },
    explosion: {
        draw_layer: DRAW_LAYERS.overlay,
        is_actor: true,
        collision_mask: 0,
        blocks_collision: COLLISION.player,
        ttl: 6,
    },
    // Custom VFX (identical function, but different aesthetic)
    splash_slime: {
        draw_layer: DRAW_LAYERS.overlay,
        is_actor: true,
        collision_mask: 0,
        blocks_collision: COLLISION.player,
        ttl: 6,
    },

    // Invalid tiles that appear in some CCL levels because community level
    // designers love to make nonsense
    bogus_player_win: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks_collision: COLLISION.all,
    },
    bogus_player_swimming: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks_collision: COLLISION.all,
    },
    bogus_player_drowned: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks_collision: COLLISION.all,
    },
    bogus_player_burned_fire: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks_collision: COLLISION.all,
    },
    bogus_player_burned: {
        draw_layer: DRAW_LAYERS.terrain,
        blocks_collision: COLLISION.all,
    },
};

// Tell them all their own names
for (let [name, type] of Object.entries(TILE_TYPES)) {
    type.name = name;

    if (type.draw_layer === undefined ||
        type.draw_layer !== Math.floor(type.draw_layer) ||
        type.draw_layer >= DRAW_LAYERS.MAX)
    {
        console.error(`Tile type ${name} has a bad draw layer`);
    }

    if (type.is_actor && type.collision_mask === undefined) {
        console.error(`Tile type ${name} is an actor but has no collision mask`);
    }
}

export default TILE_TYPES;
