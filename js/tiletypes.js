import { COLLISION, DIRECTIONS, DIRECTION_ORDER, LAYERS, TICS_PER_SECOND } from './defs.js';
import { random_choice } from './util.js';

function activate_me(me, level) {
    me.type.activate(me, level);
}

function on_begin_force_floor(me, level) {
    // At the start of the level, if there's an actor on a force floor:
    // - use on_arrive to set the actor's direction
    // - set the slide_mode (normally done by the main game loop)
    // - item bestowal: if they're being pushed into a wall and standing on an item, pick up the
    //   item, even if they couldn't normally pick items up
    // FIXME get rid of this
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
    if (neighbor.try_entering(actor, actor.direction, level))
        return;
    let item = me.cell.get_item();
    if (! item)
        return;
    if (item.type.name === 'key_red')
        return;
    if (level.attempt_take(actor, item) && actor.ignores(me.type.name)) {
        // If they just picked up suction boots, they're no longer sliding
        // TODO this feels hacky, shouldn't the slide mode be erased some other way?
        actor.slide_mode = null;
    }
}

function blocks_leaving_thin_walls(me, actor, direction) {
    return me.type.thin_walls.has(direction) && actor.type.name !== 'ghost';
}

function _define_door(key) {
    return {
        layer: LAYERS.terrain,
        // Doors can be opened by ice blocks, but not dirt blocks or monsters
        blocks_collision: COLLISION.block_cc1 | (COLLISION.monster_solid & ~COLLISION.rover),
        blocks(me, level, other) {
            if (other.type.name === 'ghost')
                return false;
            return ! ((other.has_item(key) || other.has_item('skeleton_key')));
        },
        on_arrive(me, level, other) {
            if (level.take_key_from_actor(other, key) ||
                level.take_tool_from_actor(other, 'skeleton_key'))
            {
                level.sfx.play_once('door', me.cell);
                level.spawn_animation(me.cell, 'puff');
                level.transmute_tile(me, 'floor');
            }
        },
    };
}
function _define_gate(key) {
    return {
        layer: LAYERS.item,
        // Doors can be opened by ice blocks, but not dirt blocks or monsters
        blocks_collision: COLLISION.block_cc1 | (COLLISION.monster_solid & ~COLLISION.rover),
        blocks(me, level, other) {
            if (other.type.name === 'ghost')
                return false;
            return ! ((other.has_item(key) || other.has_item('skeleton_key')));
        },
        on_arrive(me, level, other) {
            if (level.take_key_from_actor(other, key) ||
                level.take_tool_from_actor(other, 'skeleton_key'))
            {
                level.sfx.play_once('door', me.cell);
                level.spawn_animation(me.cell, 'puff');
                level.remove_tile(me);
            }
        },
    };
}

function player_visual_state(me) {
    if (! me) {
        return 'normal';
    }

    // FIXME fail reason gets attached to the wrong player if there's a swap at the same time as a
    // player gets hit
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
    else if (me.exited) {
        return 'exited';
    }
    else if (me.cell && (me.previous_cell || me.cell).has('water')) {
        // CC2 shows a swimming pose while still in water, or moving away from water
        // FIXME this also shows in some cases when we don't have flippers, e.g. when starting in water
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
    else if (me.movement_speed) {
        return 'moving';
    }
    else {
        return 'normal';
    }
}

function button_visual_state(me) {
    if (me && me.cell) {
        let actor = me.cell.get_actor();
        if (actor && ! actor.movement_cooldown) {
            return 'pressed';
        }
    }
    return 'released';
};

// Logic for chasing after the player (or running away); shared by both teeth and mimics
function pursue_player(me, level) {
    // Teeth can only move the first 4 of every 8 tics, and mimics only the first 4 of every 16,
    // though "first" can be adjusted
    if ((level.tic_counter + level.step_parity) % (me.type.movement_parity * 4) >= 4)
        return null;

    let player = level.player;
    // CC2 behavior (not Lynx (TODO compat?)): pursue the player's apparent position, not just the
    // cell they're in
    let [px, py] = player.visual_position();

    let dx = me.cell.x - px;
    let dy = me.cell.y - py;
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
        layer: LAYERS.terrain,
        on_approach(me, level, other) {
            if (other.type.name === 'blob') {
                // Blobs spread slime onto floor
                if (other.previous_cell && other.previous_cell.has('slime')) {
                    level.transmute_tile(me, 'slime');
                    level.sfx.play_once('splash-slime', me.cell);
                }
            }
        },
    },
    floor_letter: {
        layer: LAYERS.terrain,
        populate_defaults(me) {
            me.overlaid_glyph = "?";
        },
    },
    // TODO possibly this should be a single tile
    floor_custom_green: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.ghost,
    },
    floor_custom_pink: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.ghost,
    },
    floor_custom_yellow: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.ghost,
    },
    floor_custom_blue: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.ghost,
    },
    wall: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.all_but_ghost,
        on_bumped(me, level, other) {
            if (other.has_item('foil')) {
                level.transmute_tile(me, 'steel');
            }
        },
    },
    wall_custom_green: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.all,
    },
    wall_custom_pink: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.all,
    },
    wall_custom_yellow: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.all,
    },
    wall_custom_blue: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.all,
    },
    wall_invisible: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.all_but_ghost,
        on_bumped(me, level, other) {
            if (other.type.can_reveal_walls) {
                level.spawn_animation(me.cell, 'wall_invisible_revealed');
            }
        },
    },
    wall_appearing: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.all_but_ghost,
        on_bumped(me, level, other) {
            if (other.type.can_reveal_walls) {
                level.transmute_tile(me, 'wall');
            }
        },
    },
    popwall: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.block_cc1 | (COLLISION.monster_solid & ~COLLISION.rover),
        on_ready(me, level) {
            if (! level.compat.no_auto_convert_ccl_popwalls &&
                level.stored_level.format === 'ccl' &&
                me.cell.get_actor())
            {
                // Fix blocks and other actors on top of popwalls by turning them into double
                // popwalls, which preserves CC2 popwall behavior
                me.type = TILE_TYPES['popwall2'];
            }
        },
        on_depart(me, level, other) {
            level.spawn_animation(me.cell, 'puff');
            level.transmute_tile(me, 'wall');
            if (other === level.player) {
                level.sfx.play_once('popwall', me.cell);
            }
        },
    },
    // LL specific tile that can only be stepped on /twice/, originally used to repair differences
    // with popwall behavior between Lynx and Steam
    popwall2: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
        on_depart(me, level, other) {
            level.spawn_animation(me.cell, 'puff');
            level.transmute_tile(me, 'popwall');
        },
    },
    // FIXME in a cc1 tileset, these tiles are opaque  >:S
    thin_walls: {
        layer: LAYERS.thin_wall,
        blocks(me, level, actor, direction) {
            return ((me.edges & DIRECTIONS[direction].opposite_bit) !== 0) && actor.type.name !== 'ghost';
        },
        blocks_leaving(me, actor, direction) {
            return ((me.edges & DIRECTIONS[direction].bit) !== 0) && actor.type.name !== 'ghost';
        },
        populate_defaults(me) {
            me.edges = 0;  // bitmask of directions
        },
    },
    fake_wall: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.all_but_ghost,
        on_ready(me, level) {
            if (! level.compat.no_auto_convert_ccl_blue_walls &&
                level.stored_level.format === 'ccl' &&
                me.cell.get_actor())
            {
                // Blocks can be pushed off of blue walls in TW Lynx, which only works due to a tiny
                // quirk of the engine that I don't want to replicate, so replace them with popwalls
                me.type = TILE_TYPES['popwall'];
            }
        },
        on_bumped(me, level, other) {
            if (other.type.can_reveal_walls) {
                level.transmute_tile(me, 'wall');
            }
        },
    },
    fake_floor: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.block_cc1 | (COLLISION.monster_solid & ~COLLISION.rover),
        on_bumped(me, level, other) {
            if (other.type.can_reveal_walls) {
                level.spawn_animation(me.cell, 'puff');
                level.transmute_tile(me, 'floor');
                if (other === level.player) {
                    level.sfx.play_once('fake-floor', me.cell);
                }
            }
        },
    },
    popdown_wall: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.all_but_ghost,
    },
    popdown_floor: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.block_cc1 | COLLISION.block_cc2,
        visual_state(me) {
            if (me && me.cell && (me.cell.get_item() || me.cell.get_actor())) {
                return 'depressed';
            }
            return 'normal';
        },
    },
    no_player1_sign: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.playerlike1,
    },
    no_player2_sign: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.playerlike2,
    },
    steel: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.all,
    },
    canopy: {
        layer: LAYERS.canopy,
        blocks_collision: COLLISION.bug | COLLISION.rover,
        blocks(me, level, other, direction) {
            // Blobs will specifically not move from one canopy to another
            if (other.type.name === 'blob' && other.cell.has('canopy'))
                return true;
        },
    },

    // Swivel doors
    swivel_floor: {
        layer: LAYERS.terrain,
    },
    swivel_ne: {
        layer: LAYERS.swivel,
        thin_walls: new Set(['north', 'east']),
        on_depart(me, level, other) {
            if (other.direction === 'north') {
                level.transmute_tile(me, 'swivel_se');
            }
            else if (other.direction === 'east') {
                level.transmute_tile(me, 'swivel_nw');
            }
        },
        activate(me, level) {
            level.transmute_tile(me, 'swivel_se');
        },
        on_gray_button: activate_me,
        on_power: activate_me,
    },
    swivel_se: {
        layer: LAYERS.swivel,
        thin_walls: new Set(['south', 'east']),
        on_depart(me, level, other) {
            if (other.direction === 'south') {
                level.transmute_tile(me, 'swivel_ne');
            }
            else if (other.direction === 'east') {
                level.transmute_tile(me, 'swivel_sw');
            }
        },
        activate(me, level) {
            level.transmute_tile(me, 'swivel_sw');
        },
        on_gray_button: activate_me,
        on_power: activate_me,
    },
    swivel_sw: {
        layer: LAYERS.swivel,
        thin_walls: new Set(['south', 'west']),
        on_depart(me, level, other) {
            if (other.direction === 'south') {
                level.transmute_tile(me, 'swivel_nw');
            }
            else if (other.direction === 'west') {
                level.transmute_tile(me, 'swivel_se');
            }
        },
        activate(me, level) {
            level.transmute_tile(me, 'swivel_nw');
        },
        on_gray_button: activate_me,
        on_power: activate_me,
    },
    swivel_nw: {
        layer: LAYERS.swivel,
        thin_walls: new Set(['north', 'west']),
        on_depart(me, level, other) {
            if (other.direction === 'north') {
                level.transmute_tile(me, 'swivel_sw');
            }
            else if (other.direction === 'west') {
                level.transmute_tile(me, 'swivel_ne');
            }
        },
        activate(me, level) {
            level.transmute_tile(me, 'swivel_ne');
        },
        on_gray_button: activate_me,
        on_power: activate_me,
    },

    // Railroad
    railroad: {
        layer: LAYERS.terrain,
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
            // FIXME it's possible to have a switch but no tracks...
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
            level._set_tile_prop(me, 'entered_direction', other.direction);
        },
        on_depart(me, level, other) {
            if (! level.is_tile_wired(me, false)) {
                // Only switch if both the entering and the leaving are CURRENTLY valid directions
                // (which has some quirky implications for the railroad sign)
                if (me.track_switch === null)
                    return;

                let track = this.track_order[me.track_switch];
                if (track.indexOf(DIRECTIONS[me.entered_direction].opposite) >= 0 && track.indexOf(other.direction) >= 0) {
                    me.type._switch_track(me, level);
                }
            }
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
            if (other.type.can_reverse_on_railroad) {
                legal_exits.add(entered_from);
            }
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
    },

    // Locked doors
    door_red: _define_door('key_red'),
    door_blue: _define_door('key_blue'),
    door_yellow: _define_door('key_yellow'),
    door_green: _define_door('key_green'),
    gate_red: _define_gate('key_red'),
    gate_blue: _define_gate('key_blue'),
    gate_yellow: _define_gate('key_yellow'),
    gate_green: _define_gate('key_green'),

    // Terrain
    dirt: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.block_cc1 | (COLLISION.monster_solid & ~COLLISION.rover),
        blocks(me, level, other) {
            return ((other.type.name === 'player2' || other.type.name === 'doppelganger2') &&
                ! other.has_item('hiking_boots'));
        },
        on_arrive(me, level, other) {
            // Bizarre interaction
            if (other.type.name === 'ghost' && ! other.has_item('hiking_boots'))
                return;
            level.transmute_tile(me, 'floor');
            if (other === level.player) {
                level.sfx.play_once('step-gravel', me.cell);
            }
        },
    },
    gravel: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.monster_solid & ~COLLISION.rover,
        blocks(me, level, other) {
            return ((other.type.name === 'player2' || other.type.name === 'doppelganger2') &&
                ! other.has_item('hiking_boots'));
        },
    },
    sand: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.block_cc1 | COLLISION.block_cc2,
        speed_factor: 0.5,
    },

    // Hazards
    fire: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.monster_solid & ~COLLISION.fireball,
        on_arrive(me, level, other) {
            if (other.type.name === 'ghost') {
                // Ghosts with fire boots erase fire, otherwise are unaffected
                if (other.has_item('fire_boots')) {
                    level.transmute_tile(me, 'floor');
                }
            }
            else if (other.has_item('fire_boots')) {
                return;
            }
            else if (other.type.name === 'ice_block') {
                level.transmute_tile(other, 'splash');
                level.transmute_tile(me, 'water');
                level.sfx.play_once('splash', me.cell);
            }
            else if (other.type.is_real_player) {
                level.fail('burned', other);
            }
            else {
                level.transmute_tile(other, 'explosion');
                level.sfx.play_once('bomb', me.cell);
            }
        },
    },
    water: {
        layer: LAYERS.terrain,
        blocks(me, level, other) {
            // Water blocks ghosts...  unless they have flippers
            if (other.type.name === 'ghost' && ! other.has_item('flippers'))
                return true;
        },
        on_arrive(me, level, other) {
            // TODO cc1 allows items under water, i think; water was on the upper layer
            level.sfx.play_once('splash', me.cell);
            if (other.type.name === 'dirt_block') {
                level.transmute_tile(other, 'splash');
                level.transmute_tile(me, 'dirt');
            }
            else if (other.type.name === 'frame_block') {
                level.transmute_tile(other, 'splash');
                level.transmute_tile(me, 'floor');
            }
            else if (other.type.name === 'ice_block') {
                level.transmute_tile(other, 'splash');
                level.transmute_tile(me, 'ice');
            }
            else if (other.type.is_real_player) {
                level.fail('drowned', other);
            }
            else {
                level.transmute_tile(other, 'splash');
            }
        },
    },
    turtle: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.ghost | COLLISION.fireball,
        on_depart(me, level, other) {
            level.transmute_tile(me, 'water');
            level.spawn_animation(me.cell, 'splash');
            level.sfx.play_once('splash', me.cell);
        },
    },
    ice: {
        layer: LAYERS.terrain,
        slide_mode: 'ice',
        speed_factor: 2,
    },
    ice_sw: {
        layer: LAYERS.terrain,
        thin_walls: new Set(['south', 'west']),
        slide_mode: 'ice',
        speed_factor: 2,
        blocks_leaving: blocks_leaving_thin_walls,
        on_arrive(me, level, other) {
            if (other.direction === 'south') {
                level.set_actor_direction(other, 'east');
            }
            else if (other.direction === 'west') {
                level.set_actor_direction(other, 'north');
            }
        },
    },
    ice_nw: {
        layer: LAYERS.terrain,
        thin_walls: new Set(['north', 'west']),
        slide_mode: 'ice',
        speed_factor: 2,
        blocks_leaving: blocks_leaving_thin_walls,
        on_arrive(me, level, other) {
            if (other.direction === 'north') {
                level.set_actor_direction(other, 'east');
            }
            else if (other.direction === 'west') {
                level.set_actor_direction(other, 'south');
            }
        },
    },
    ice_ne: {
        layer: LAYERS.terrain,
        thin_walls: new Set(['north', 'east']),
        slide_mode: 'ice',
        speed_factor: 2,
        blocks_leaving: blocks_leaving_thin_walls,
        on_arrive(me, level, other) {
            if (other.direction === 'north') {
                level.set_actor_direction(other, 'west');
            }
            else if (other.direction === 'east') {
                level.set_actor_direction(other, 'south');
            }
        },
    },
    ice_se: {
        layer: LAYERS.terrain,
        thin_walls: new Set(['south', 'east']),
        slide_mode: 'ice',
        speed_factor: 2,
        blocks_leaving: blocks_leaving_thin_walls,
        on_arrive(me, level, other) {
            if (other.direction === 'south') {
                level.set_actor_direction(other, 'west');
            }
            else if (other.direction === 'east') {
                level.set_actor_direction(other, 'north');
            }
        },
    },
    force_floor_n: {
        layer: LAYERS.terrain,
        slide_mode: 'force',
        speed_factor: 2,
        on_begin: on_begin_force_floor,
        on_arrive(me, level, other) {
            level.set_actor_direction(other, 'north');
        },
        activate(me, level) {
            level.transmute_tile(me, 'force_floor_s');
            let actor = me.cell.get_actor();
            if (actor && actor.movement_cooldown <= 0) {
                level.set_actor_direction(actor, 'south');
                // If we're using the Lynx loop, then decisions have already happened, and the new
                // direction will be overwritten if this actor has yet to move
                if (actor.decision && ! actor.ignores(me.type.name)) {
                    actor.decision = actor.direction;
                }
            }
        },
        on_gray_button: activate_me,
        on_power: activate_me,
    },
    force_floor_e: {
        layer: LAYERS.terrain,
        slide_mode: 'force',
        speed_factor: 2,
        on_begin: on_begin_force_floor,
        on_arrive(me, level, other) {
            level.set_actor_direction(other, 'east');
        },
        activate(me, level) {
            level.transmute_tile(me, 'force_floor_w');
            let actor = me.cell.get_actor();
            if (actor && actor.movement_cooldown <= 0) {
                level.set_actor_direction(actor, 'west');
                if (actor.decision && ! actor.ignores(me.type.name)) {
                    actor.decision = actor.direction;
                }
            }
        },
        on_gray_button: activate_me,
        on_power: activate_me,
    },
    force_floor_s: {
        layer: LAYERS.terrain,
        slide_mode: 'force',
        speed_factor: 2,
        on_begin: on_begin_force_floor,
        on_arrive(me, level, other) {
            level.set_actor_direction(other, 'south');
        },
        activate(me, level) {
            level.transmute_tile(me, 'force_floor_n');
            let actor = me.cell.get_actor();
            if (actor && actor.movement_cooldown <= 0) {
                level.set_actor_direction(actor, 'north');
                if (actor.decision && ! actor.ignores(me.type.name)) {
                    actor.decision = actor.direction;
                }
            }
        },
        on_gray_button: activate_me,
        on_power: activate_me,
    },
    force_floor_w: {
        layer: LAYERS.terrain,
        slide_mode: 'force',
        speed_factor: 2,
        on_begin: on_begin_force_floor,
        on_arrive(me, level, other) {
            level.set_actor_direction(other, 'west');
        },
        activate(me, level) {
            level.transmute_tile(me, 'force_floor_e');
            let actor = me.cell.get_actor();
            if (actor && actor.movement_cooldown <= 0) {
                level.set_actor_direction(actor, 'east');
                if (actor.decision && ! actor.ignores(me.type.name)) {
                    actor.decision = actor.direction;
                }
            }
        },
        on_gray_button: activate_me,
        on_power: activate_me,
    },
    force_floor_all: {
        layer: LAYERS.terrain,
        slide_mode: 'force',
        speed_factor: 2,
        on_begin: on_begin_force_floor,
        // TODO ms: this is random, and an acting wall to monsters (!)
        on_arrive(me, level, other) {
            level.set_actor_direction(other, level.get_force_floor_direction());
        },
    },
    slime: {
        layer: LAYERS.terrain,
        on_arrive(me, level, other) {
            if (other.type.name === 'ghost' || other.type.name === 'blob') {
                // No effect
                return;
            }

            level.sfx.play_once('splash-slime', me.cell);
            if (other.type.name === 'dirt_block' || other.type.name === 'ice_block') {
                level.transmute_tile(me, 'floor');
            }
            else if (other.type.is_real_player) {
                level.fail('slimed', other);
            }
            else {
                level.transmute_tile(other, 'splash_slime');
            }
        },
    },
    bomb: {
        layer: LAYERS.item,
        on_begin(me, level) {
            if (level.compat.no_immediate_detonate_bombs)
                return;

            // In CC2, actors on a bomb (but not a green one) are immediately blown up
            let actor = me.cell.get_actor();
            if (actor && ! actor.ignores(this.name)) {
                if (actor.type.is_real_player && ! level.compat.detonate_bombs_under_players)
                    return;
                this.on_arrive(me, level, actor);
            }
        },
        on_arrive(me, level, other) {
            level.remove_tile(me);
            if (other.type.is_real_player) {
                level.fail('exploded', other);
            }
            else {
                level.sfx.play_once('bomb', me.cell);
                level.transmute_tile(other, 'explosion');
            }
        },
    },
    thief_tools: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
        on_arrive(me, level, other) {
            if (level.take_tool_from_actor(other, 'bribe')) {
                if (other === level.player) {
                    level.sfx.play_once('thief-bribe', me.cell);
                }
                return;
            }
            if (! other.type.is_real_player)
                return;

            let lost = level.take_all_tools_from_actor(other);
            if (level.bonus_points > 0) {
                lost = true;
            }
            level.adjust_bonus(0, 0.5);
            if (lost && other === level.player) {
                level.sfx.play_once('thief', me.cell);
            }
        },
    },
    thief_keys: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
        on_arrive(me, level, other) {
            if (level.take_tool_from_actor(other, 'bribe')) {
                if (other === level.player) {
                    level.sfx.play_once('thief-bribe', me.cell);
                }
                return;
            }
            if (! other.type.is_real_player)
                return;

            let lost = level.take_all_keys_from_actor(other);
            if (level.bonus_points > 0) {
                lost = true;
            }
            level.adjust_bonus(0, 0.5);
            if (lost && other === level.player) {
                level.sfx.play_once('thief', me.cell);
            }
        },
    },
    no_sign: {
        layer: LAYERS.item_mod,
        item_modifier: 'ignore',
        collision_allow: COLLISION.monster_solid,
        blocks(me, level, other) {
            let item = me.cell.get_item();
            return item && other.has_item(item.type.name);
        },
    },
    gift_bow: {
        layer: LAYERS.item_mod,
        item_modifier: 'pickup',
    },

    // Mechanisms
    dirt_block: {
        layer: LAYERS.actor,
        collision_mask: COLLISION.block_cc1,
        blocks_collision: COLLISION.all,
        is_actor: true,
        is_block: true,
        ignores: new Set(['fire', 'flame_jet_on']),
        can_reverse_on_railroad: true,
        movement_speed: 4,
    },
    ice_block: {
        layer: LAYERS.actor,
        collision_mask: COLLISION.block_cc2,
        blocks_collision: COLLISION.all,
        is_actor: true,
        is_block: true,
        can_reveal_walls: true,
        can_reverse_on_railroad: true,
        movement_speed: 4,
        pushes: {
            ice_block: true,
            frame_block: true,
        },
        on_bumped(me, level, other) {
            // Fireballs melt ice blocks on regular floor FIXME and water!
            // XXX what if i'm in motion?
            if (other.type.name === 'fireball') {
                let terrain = me.cell.get_terrain();
                if (terrain.type.name === 'floor') {
                    level.transmute_tile(me, 'splash');
                    level.transmute_tile(terrain, 'water');
                    level.sfx.play_once('splash', me.cell);
                }
            }
        },
    },
    frame_block: {
        layer: LAYERS.actor,
        collision_mask: COLLISION.block_cc2,
        blocks_collision: COLLISION.all,
        is_actor: true,
        is_block: true,
        can_reveal_walls: true,
        can_reverse_on_railroad: true,
        movement_speed: 4,
        allows_push(me, direction) {
            return me.arrows && me.arrows.has(direction);
        },
        pushes: {
            dirt_block: true,
            ice_block: true,
            frame_block: true,
        },
        on_clone(me, original) {
            me.arrows = new Set(original.arrows);
        },
        on_rotate(me, level, turn) {
            // We rotate when turned on railroads
            let new_arrows = new Set;
            for (let arrow of me.arrows) {
                new_arrows.add(DIRECTIONS[arrow][turn]);
            }
            level._set_tile_prop(me, 'arrows', new_arrows);
        },
    },
    glass_block: {
        layer: LAYERS.actor,
        collision_mask: COLLISION.block_cc2,
        blocks_collision: COLLISION.all,
        is_actor: true,
        is_block: true,
        can_reveal_walls: true,
        can_reverse_on_railroad: true,
        movement_speed: 4,
        allows_push(me, direction) {
            return me.arrows && me.arrows.has(direction);
        },
        pushes: {
            dirt_block: true,
            ice_block: true,
            frame_block: true,
        },
        on_clone(me, original) {
            me.arrows = new Set(original.arrows);
        },
        on_rotate(me, level, turn) {
            // We rotate when turned on railroads
            let new_arrows = new Set;
            for (let arrow of me.arrows) {
                new_arrows.add(DIRECTIONS[arrow][turn]);
            }
            level._set_tile_prop(me, 'arrows', new_arrows);
        },
    },
    green_floor: {
        layer: LAYERS.terrain,
        on_gray_button(me, level) {
            level.transmute_tile(me, 'green_wall');
        },
        on_power(me, level) {
            me.type.on_gray_button(me, level);
        },
    },
    green_wall: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.all_but_ghost,
        on_gray_button(me, level) {
            level.transmute_tile(me, 'green_floor');
        },
        on_power(me, level) {
            me.type.on_gray_button(me, level);
        },
    },
    green_chip: {
        layer: LAYERS.item,
        is_chip: true,
        is_required_chip: true,
        blocks_collision: COLLISION.block_cc1 | (COLLISION.monster_solid & ~COLLISION.rover),
        on_arrive(me, level, other) {
            if (other.type.is_real_player) {
                level.collect_chip();
                level.remove_tile(me);
            }
        },
        // Not affected by gray buttons
    },
    green_bomb: {
        layer: LAYERS.item,
        is_required_chip: true,
        on_arrive(me, level, other) {
            level.remove_tile(me);
            if (other.type.is_real_player) {
                level.fail('exploded', other);
            }
            else {
                level.sfx.play_once('bomb', me.cell);
                level.transmute_tile(other, 'explosion');
            }
        },
        // Not affected by gray buttons
    },
    purple_floor: {
        layer: LAYERS.terrain,
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
        layer: LAYERS.terrain,
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
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.real_player | COLLISION.block_cc1 | COLLISION.monster_solid,
        traps(me, actor) {
            return ! actor._clone_release;
        },
        activate(me, level, aggressive = false) {
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
            // Wire activation allows the cloner to try every direction, searching clockwise
            for (let i = 0; i < (aggressive ? 4 : 1); i++) {
                if (level.attempt_out_of_turn_step(actor, direction)) {
                    // Surprising edge case: if the actor immediately killed the player, do NOT
                    // spawn a new template, since the move was actually aborted
                    // FIXME this is inconsistent.  the move was aborted because of an emergency
                    // failure handling case in move_to, but that doesn't make the step count as a
                    // failure.  would this be fixed by making the player block all other actors?
                    if (level.state === 'failure')
                        break;

                    // FIXME add this underneath, just above the cloner, so the new actor is on top
                    let new_template = new actor.constructor(type, direction);
                    // TODO maybe make a type method for this
                    if (type.on_clone) {
                        type.on_clone(new_template, actor);
                    }
                    level.add_tile(new_template, me.cell);
                    level.add_actor(new_template);
                    break;
                }
                direction = DIRECTIONS[direction].right;
            }
            delete actor._clone_release;
        },
        // Also clones on rising pulse or gray button
        on_power(me, level) {
            me.type.activate(me, level, true);
        },
        on_gray_button(me, level) {
            me.type.activate(me, level);
        },
    },
    trap: {
        layer: LAYERS.terrain,
        add_press_ready(me, level, other) {
            // Same as below, but without ejection
            me.presses = (me.presses ?? 0) + 1;
        },
        // Lynx (not cc2): open traps immediately eject their contents on arrival, if possible
        add_press(me, level, is_wire = false) {
            level._set_tile_prop(me, 'presses', (me.presses ?? 0) + 1);
            // TODO weird cc2 case that may or may not be a bug: actors aren't ejected if the trap
            // opened because of wiring
            if (me.presses === 1 && ! is_wire) {
                // Free any actor on us, if we went from 0 to 1 presses (i.e. closed to open)
                let actor = me.cell.get_actor();
                if (actor) {
                    // Forcibly move anything released from a trap, which keeps it in sync with
                    // whatever pushed the button
                    level.attempt_out_of_turn_step(actor, actor.direction);
                }
            }
        },
        remove_press(me, level) {
            level._set_tile_prop(me, 'presses', me.presses - 1);
            if (me._initially_open) {
                level._set_tile_prop(me, '_initially_open', false);
            }
        },
        // FIXME also doesn't trap ghosts, is that a special case???
        traps(me, actor) {
            return ! me.presses && ! me._initially_open && actor.type.name !== 'ghost';
        },
        on_power(me, level) {
            // Treat being powered or not as an extra kind of brown button press
            me.type.add_press(me, level, true);
        },
        on_depower(me, level) {
            me.type.remove_press(me, level);
        },
        visual_state(me) {
            if (me && (me.presses || me._initially_open)) {
                return 'open';
            }
            else {
                return 'closed';
            }
        },
    },
    transmogrifier: {
        layer: LAYERS.terrain,
        // C2M technically supports wires in transmogrifiers, but they don't do anything
        wire_propagation_mode: 'none',
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
        _blob_mogrifications: ['glider', 'paramecium', 'fireball', 'bug', 'walker', 'ball', 'teeth', 'tank_blue', 'teeth_timid'],
        on_begin(me, level) {
            // TODO if wire destruction is ever allowed, this will need to update somehow
            me.is_wired = level.is_tile_wired(me, false);
            me.is_active = ! me.is_wired;
        },
        on_arrive(me, level, other) {
            // Note: Transmogrifiers technically contain wires the way teleports do, and CC2 uses
            // the presence and poweredness of those wires to determine whether the transmogrifier
            // should appear to be on or off, but the /functionality/ is controlled entirely by
            // whether an adjoining cell carries current to our edge, like a railroad or cloner
            if (! me.is_active)
                return;
            let name = other.type.name;
            if (me.type._mogrifications[name]) {
                level.transmute_tile(other, me.type._mogrifications[name]);
            }
            else if (name === 'blob') {
                let options = me.type._blob_mogrifications;
                level.transmute_tile(other, options[level.prng() % options.length]);
            }
            else {
                return;
            }
            level.spawn_animation(me.cell, 'transmogrify_flash');
            level.sfx.play_once('transmogrify', me.cell);
        },
        on_power(me, level) {
            if (me.is_wired) {
                level._set_tile_prop(me, 'is_active', true);
            }
        },
        on_depower(me, level) {
            if (me.is_wired) {
                level._set_tile_prop(me, 'is_active', false);
            }
        },
        visual_state(me) {
            return ! me || me.is_active ? 'active' : 'inactive';
        },
    },
    teleport_blue: {
        layer: LAYERS.terrain,
        slide_mode: 'teleport',
        wire_propagation_mode: 'all',
        *teleport_dest_order(me, level, other) {
            let exit_direction = other.direction;
            // Note that unlike other tiles that care about whether they're wired, a blue teleporter
            // considers itself part of a network if it contains any wires at all, regardless of
            // whether they connect to anything
            if (! me.wire_directions) {
                // TODO cc2 has a bug where, once it wraps around to the bottom right, it seems to
                // forget that it was ever looking for an unwired teleport and will just grab the
                // first one it sees
                for (let dest of level.iter_tiles_in_reading_order(me.cell, 'teleport_blue', true)) {
                    if (! dest.wire_directions) {
                        yield [dest, exit_direction];
                    }
                }
                return;
            }

            // Wired blue teleports form an isolated network, so we have to walk the circuit we're
            // on, collect a list of all possible blue teleports, and then sort them so we can try
            // them in the right order.
            // Complicating this somewhat, logic gates act as diodes: we can walk through a logic
            // gate if we're connected to one of its inputs AND its output is enabled, but we can't
            // walk "backwards" through it.
            // (In CC2, this is even worse; if the game searches the circuit and ONLY finds a logic
            // gate, it seems to recurse from there, breaking the expected order.  Worse, if it then
            // can't find a destination teleporter, it teleports the actor "INTO" the logic gate
            // itself; if a destination later presents itself, the actor will immediately appear,
            // but if not, it might linger THROUGH A RESTART OR EVEN EDIT OF THE LEVEL, possibly
            // appearing on a later playthrough or possibly crashing the game.  Suffice to say, this
            // behavior is not and will never be emulated.  No level in CC2 or even CC2LP1 uses blue
            // teleporters wired into logic gates, so even the ordering is not interesting imo.)
            // Anyway, let's do a breadth-first search for teleporters.
            let walked_circuits = new Set;
            let candidate_teleporters = new Set;
            let circuits = me.circuits;
            for (let i = 0; i < circuits.length; i++) {
                let circuit = circuits[i];
                if (! circuit || walked_circuits.has(circuit))
                    continue;
                walked_circuits.add(circuit);

                for (let [tile, edges] of circuit.tiles.entries()) {
                    if (tile.type === me.type) {
                        candidate_teleporters.add(tile);
                    }
                    else if (tile.type.name === 'logic_gate' && ! circuit.inputs.get(tile)) {
                        // This logic gate is functioning as an output, so walk through it and also
                        // trace any circuits that treat it as an input (as long as those circuits
                        // are currently powered)
                        for (let subcircuit of tile.circuits) {
                            if (subcircuit && subcircuit.is_powered && subcircuit.inputs.get(tile)) {
                                circuits.push(subcircuit);
                            }
                        }
                    }
                }
            }

            // Now that we have a set of candidate destinations, sort it in reverse reading order,
            // starting from ourselves.  Easiest way to do this is to make a map of cell indices,
            // shifted so that we're at zero, then sort in reverse
            let dest_indices = new Map;
            let our_index = me.cell.x + me.cell.y * level.size_x;
            let level_size = level.size_x * level.size_y;
            for (let dest of candidate_teleporters) {
                dest_indices.set(dest, (
                    (dest.cell.x + dest.cell.y * level.size_x)
                    - our_index + level_size
                ) % level_size);
            }
            let found = Array.from(candidate_teleporters);
            found.sort((a, b) => dest_indices.get(b) - dest_indices.get(a));
            for (let dest of found) {
                yield [dest, exit_direction];
            }
        },
    },
    teleport_red: {
        layer: LAYERS.terrain,
        slide_mode: 'teleport',
        wire_propagation_mode: 'none',
        teleport_allow_override: true,
        on_begin(me, level) {
            // TODO if wire destruction is ever allowed, this will need to update somehow
            // FIXME must be connected to something that can convey current: a wire, a switch, a
            // blue teleporter, etc; NOT nothing, a wall, a transmogrifier, a force floor, etc.
            // this is also how blue teleporters, transmogrifiers, and railroads work!
            me.is_wired = level.is_tile_wired(me);
            me.is_active = ! me.is_wired;
        },
        *teleport_dest_order(me, level, other) {
            // Wired red teleporters can be turned off, which disconnects them from every other red
            // teleporter (but they still teleport to themselves).
            // A red teleporter is considered wired only if it has wires itself.  However, CC2 also
            // has the bizarre behavior of NOT considering a red teleporter wired if none of its
            // wires are directly connected to another neighboring wire.
            let iterable;
            if (me.is_active) {
                iterable = level.iter_tiles_in_reading_order(me.cell, 'teleport_red');
            }
            else {
                iterable = [me];
            }
            let exit_direction = other.direction;
            for (let tile of iterable) {
                // Red teleporters allow exiting in any direction, searching clockwise, except for
                // the teleporter you entered
                if (tile === me) {
                    yield [tile, exit_direction];
                }
                else if (tile.is_active) {
                    yield [tile, exit_direction];
                    yield [tile, DIRECTIONS[exit_direction].right];
                    yield [tile, DIRECTIONS[exit_direction].opposite];
                    yield [tile, DIRECTIONS[exit_direction].left];
                }
            }
        },
        on_power(me, level) {
            if (me.is_wired) {
                level._set_tile_prop(me, 'is_active', true);
            }
        },
        on_depower(me, level) {
            if (me.is_wired) {
                level._set_tile_prop(me, 'is_active', false);
            }
        },
        visual_state(me) {
            return ! me || me.is_active ? 'active' : 'inactive';
        },
    },
    teleport_green: {
        layer: LAYERS.terrain,
        slide_mode: 'teleport',
        teleport_dest_order(me, level, other) {
            let all = Array.from(level.iter_tiles_in_reading_order(me.cell, 'teleport_green'));
            if (all.length <= 1) {
                // If this is the only teleporter, just walk out the other side — and, crucially, do
                // NOT advance the PRNG
                return [[me, other.direction]];
            }
            // Note the iterator starts on the /next/ teleporter, so there's an implicit +1 here.
            // The -1 is to avoid spitting us back out of the same teleporter, which will be last in
            // the list
            let target = all[level.prng() % (all.length - 1)];
            // Also pick the actor's exit direction
            let exit_direction = DIRECTION_ORDER[level.prng() % 4];
            return [
                // Green teleporters allow exiting in any direction, similar to red, but only on the
                // one they found; if that fails, you walk straight across the one you entered
                [target, exit_direction],
                [target, DIRECTIONS[exit_direction].right],
                [target, DIRECTIONS[exit_direction].opposite],
                [target, DIRECTIONS[exit_direction].left],
                [me, other.direction],
            ];
        },
    },
    teleport_yellow: {
        layer: LAYERS.terrain,
        slide_mode: 'teleport',
        teleport_allow_override: true,
        *teleport_dest_order(me, level, other) {
            let exit_direction = other.direction;
            for (let dest of level.iter_tiles_in_reading_order(me.cell, 'teleport_yellow', true)) {
                yield [dest, exit_direction];
            }
        },
    },
    // Flame jet rules:
    // - State toggles /while/ an orange button is held or wire current is received
    // - Multiple such inputs cancel each other out
    // - Gray button toggles it permanently
    flame_jet_off: {
        layer: LAYERS.terrain,
        activate(me, level) {
            level.transmute_tile(me, 'flame_jet_on');
            // Do NOT immediately nuke anything on us, or it'd be impossible to push a block off an
            // adjacent orange button; this is probably why flame jets kill on tics
        },
        on_gray_button(me, level) {
            me.type.activate(me, level);
        },
        on_power(me, level) {
            me.type.activate(me, level);
        },
        // This is a silly hack to get us flagged as a static tile, so when we're turned on, that
        // tile's on_tic will still run
        on_tic() {},
    },
    flame_jet_on: {
        layer: LAYERS.terrain,
        activate(me, level) {
            level.transmute_tile(me, 'flame_jet_off');
        },
        on_gray_button(me, level) {
            me.type.activate(me, level);
        },
        on_power(me, level) {
            me.type.activate(me, level);
        },
        on_tic(me, level) {
            let actor = me.cell.get_actor();
            if (actor && actor.movement_cooldown <= 0 && ! actor.ignores(me.type.name)) {
                // Note that (dirt?) blocks, fireballs, and anything with fire boots are immune
                // TODO would be neat if this understood "ignores anything with fire immunity" but that
                // might be a bit too high-level for this game
                if (actor.type.is_real_player) {
                    level.fail('burned', actor);
                }
                else {
                    level.sfx.play_once('bomb', me.cell);
                    level.transmute_tile(actor, 'explosion');
                }
            }
        },
    },
    // Buttons
    button_blue: {
        layer: LAYERS.terrain,
        do_button(level) {
            // Flip direction of all blue tanks
            for (let actor of level.actors) {
                // TODO generify somehow??
                if (actor.type.name === 'tank_blue') {
                    if (level.compat.cloner_tanks_react_button || ! actor.cell.has('cloner')) {
                        level._set_tile_prop(actor, 'pending_reverse', ! actor.pending_reverse);
                    }
                }
            }
        },
        on_arrive(me, level, other) {
            level.sfx.play_once('button-press', me.cell);
            me.type.do_button(level);
        },
        on_depart(me, level, other) {
            level.sfx.play_once('button-release', me.cell);
        },
        visual_state: button_visual_state,
    },
    button_yellow: {
        layer: LAYERS.terrain,
        on_arrive(me, level, other) {
            level.sfx.play_once('button-press', me.cell);
            for (let actor of level.actors) {
                if (actor.type.name === 'tank_yellow') {
                    level._set_tile_prop(actor, 'pending_decision', other.direction);
                }
            }
        },
        on_depart(me, level, other) {
            level.sfx.play_once('button-release', me.cell);
        },
    },
    button_green: {
        layer: LAYERS.terrain,
        do_button(level) {
            // Swap green floors and walls
            // TODO could probably make this more compact for undo purposes
            for (let cell of level.linear_cells) {
                let terrain = cell.get_terrain();
                if (terrain.type.name === 'green_floor') {
                    level.transmute_tile(terrain, 'green_wall');
                }
                else if (terrain.type.name === 'green_wall') {
                    level.transmute_tile(terrain, 'green_floor');
                }

                let item = cell.get_item();
                if (item && item.type.name === 'green_chip') {
                    level.transmute_tile(item, 'green_bomb');
                }
                else if (item && item.type.name === 'green_bomb') {
                    level.transmute_tile(item, 'green_chip');
                }
            }
        },
        on_arrive(me, level, other) {
            level.sfx.play_once('button-press', me.cell);
            this.do_button(level);
        },
        on_depart(me, level, other) {
            level.sfx.play_once('button-release', me.cell);
        },
        visual_state: button_visual_state,
    },
    button_brown: {
        layer: LAYERS.terrain,
        connects_to: 'trap',
        connect_order: 'forward',
        on_ready(me, level) {
            // Inform the trap of any actors that start out holding us down
            let trap = me.connection;
            if (! (trap && trap.cell))
                return;

            if (me.cell.get_actor()) {
                trap.type.add_press_ready(trap, level);
            }
        },
        on_arrive(me, level, other) {
            level.sfx.play_once('button-press', me.cell);

            let trap = me.connection;
            if (trap && trap.cell && trap.type.name === 'trap') {
                trap.type.add_press(trap, level);
            }
        },
        on_depart(me, level, other) {
            level.sfx.play_once('button-release', me.cell);

            let trap = me.connection;
            if (trap && trap.cell && trap.type.name === 'trap') {
                trap.type.remove_press(trap, level);
            }
        },
        visual_state: button_visual_state,
    },
    button_red: {
        layer: LAYERS.terrain,
        connects_to: 'cloner',
        connect_order: 'forward',
        on_arrive(me, level, other) {
            level.sfx.play_once('button-press', me.cell);

            let cloner = me.connection;
            if (cloner && cloner.cell && cloner.type.name === 'cloner') {
                cloner.type.activate(cloner, level);
            }
        },
        on_depart(me, level, other) {
            level.sfx.play_once('button-release', me.cell);
        },
        visual_state: button_visual_state,
    },
    button_orange: {
        layer: LAYERS.terrain,
        connects_to: new Set(['flame_jet_off', 'flame_jet_on']),
        connect_order: 'diamond',
        // Both stepping on and leaving the button have the same effect: toggle the state of the
        // connected flame jet
        _toggle_flame_jet(me, level, other) {
            let jet = me.connection;
            if (jet && jet.cell && (
                jet.type.name === 'flame_jet_off' || jet.type.name === 'flame_jet_on'))
            {
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
        visual_state: button_visual_state,
    },
    button_pink: {
        layer: LAYERS.terrain,
        is_power_source: true,
        wire_propagation_mode: 'none',
        get_emitting_edges(me, level) {
            // We emit current as long as there's an actor fully on us
            let actor = me.cell.get_actor();
            if (actor && actor.movement_cooldown === 0) {
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
        visual_state: button_visual_state,
    },
    button_black: {
        layer: LAYERS.terrain,
        is_power_source: true,
        wire_propagation_mode: 'cross',
        get_emitting_edges(me, level) {
            // We emit current as long as there's NOT an actor fully on us
            let actor = me.cell.get_actor();
            if (actor && actor.movement_cooldown === 0) {
                return 0;
            }
            else {
                return me.wire_directions;
            }
        },
        on_arrive(me, level, other) {
            level.sfx.play_once('button-press', me.cell);
        },
        on_depart(me, level, other) {
            level.sfx.play_once('button-release', me.cell);
        },
        visual_state: button_visual_state,
    },
    button_gray: {
        layer: LAYERS.terrain,
        on_arrive(me, level, other) {
            level.sfx.play_once('button-press', me.cell);

            for (let x = Math.max(0, me.cell.x - 2); x <= Math.min(level.width - 1, me.cell.x + 2); x++) {
                for (let y = Math.max(0, me.cell.y - 2); y <= Math.min(level.height - 1, me.cell.y + 2); y++) {
                    let cell = level.cell(x, y);
                    // TODO wait is this right
                    if (cell === me.cell)
                        continue;

                    for (let tile of cell) {
                        if (tile && tile.type.on_gray_button) {
                            tile.type.on_gray_button(tile, level);
                        }
                    }
                }
            }
        },
        on_depart(me, level, other) {
            level.sfx.play_once('button-release', me.cell);
        },
        visual_state: button_visual_state,
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
        layer: LAYERS.terrain,
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
                    input0 = (me.powered_edges & dirinfo.bit) !== 0;
                }
                else if (cxn === 'in1') {
                    input1 = (me.powered_edges & dirinfo.bit) !== 0;
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
        layer: LAYERS.terrain,
        is_power_source: true,
        get_emitting_edges(me, level) {
            // TODO this is inconsistent with the pink/black buttons, but cc2 has a single-frame
            // delay here!
            if (me.is_first_frame) {
                level._set_tile_prop(me, 'is_first_frame', false);
                return me.wire_directions;
            }
            return 0;
        },
        on_arrive(me, level, other) {
            // TODO distinct sfx?  more clicky?
            level.sfx.play_once('button-press', me.cell);
            level.transmute_tile(me, 'light_switch_on');
            level._set_tile_prop(me, 'is_first_frame', true);
        },
    },
    light_switch_on: {
        layer: LAYERS.terrain,
        is_power_source: true,
        get_emitting_edges(me, level) {
            // TODO this is inconsistent with the pink/black buttons, but cc2 has a single-frame
            // delay here!
            if (me.is_first_frame) {
                level._set_tile_prop(me, 'is_first_frame', false);
                return 0;
            }
            return me.wire_directions;
        },
        on_arrive(me, level, other) {
            level.sfx.play_once('button-press', me.cell);
            level.transmute_tile(me, 'light_switch_off');
            level._set_tile_prop(me, 'is_first_frame', true);
        },
    },
    // LL tile: circuit block, overrides the wiring on the floor below (if any)
    circuit_block: {
        layer: LAYERS.actor,
        collision_mask: COLLISION.block_cc2,
        blocks_collision: COLLISION.all,
        is_actor: true,
        is_block: true,
        can_reverse_on_railroad: true,
        movement_speed: 4,
    },

    // Time alteration
    stopwatch_bonus: {
        layer: LAYERS.item,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
        on_arrive(me, level, other) {
            if (other.type.is_real_player) {
                level.remove_tile(me);
                level.adjust_timer(+10);
            }
        },
    },
    stopwatch_penalty: {
        layer: LAYERS.item,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
        on_arrive(me, level, other) {
            if (other.type.is_real_player) {
                level.remove_tile(me);
                level.adjust_timer(-10);
            }
        },
    },
    stopwatch_toggle: {
        layer: LAYERS.item,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
        on_arrive(me, level, other) {
            if (other.type.is_real_player) {
                level.pause_timer();
            }
        },
    },

    // Critters
    bug: {
        layer: LAYERS.actor,
        is_actor: true,
        is_monster: true,
        collision_mask: COLLISION.bug,
        blocks_collision: COLLISION.all_but_real_player,
        movement_speed: 4,
        decide_movement(me, level) {
            // always try turning as left as possible, and fall back to less-left turns
            let d = DIRECTIONS[me.direction];
            return [d.left, me.direction, d.right, d.opposite];
        },
    },
    paramecium: {
        layer: LAYERS.actor,
        is_actor: true,
        is_monster: true,
        collision_mask: COLLISION.monster_generic,
        blocks_collision: COLLISION.all_but_real_player,
        movement_speed: 4,
        decide_movement(me, level) {
            // always try turning as right as possible, and fall back to less-right turns
            let d = DIRECTIONS[me.direction];
            return [d.right, me.direction, d.left, d.opposite];
        },
    },
    ball: {
        layer: LAYERS.actor,
        is_actor: true,
        is_monster: true,
        collision_mask: COLLISION.monster_generic,
        blocks_collision: COLLISION.all_but_real_player,
        movement_speed: 4,
        decide_movement(me, level) {
            // preserve current direction; if that doesn't work, bounce back the way we came
            let d = DIRECTIONS[me.direction];
            return [me.direction, d.opposite];
        },
    },
    walker: {
        layer: LAYERS.actor,
        is_actor: true,
        is_monster: true,
        collision_mask: COLLISION.monster_generic,
        blocks_collision: COLLISION.all_but_real_player,
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
        layer: LAYERS.actor,
        is_actor: true,
        is_monster: true,
        collision_mask: COLLISION.monster_generic,
        blocks_collision: COLLISION.all_but_real_player,
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
        layer: LAYERS.actor,
        is_actor: true,
        is_monster: true,
        collision_mask: COLLISION.monster_generic,
        blocks_collision: COLLISION.all_but_real_player,
        pushes: {
            dirt_block: true,
            ice_block: true,
            frame_block: true,
            circuit_block: true,
        },
        movement_speed: 4,
        decide_movement(me, level) {
            if (me.pending_decision) {
                let decision = me.pending_decision;
                level._set_tile_prop(me, 'pending_decision', null);
                // Yellow tanks don't keep trying to move if blocked
                return [decision, null];
            }
            else {
                return null;
            }
        }
    },
    blob: {
        layer: LAYERS.actor,
        is_actor: true,
        is_monster: true,
        collision_mask: COLLISION.monster_generic,
        blocks_collision: COLLISION.all_but_real_player,
        movement_speed: 8,
        decide_movement(me, level) {
            // move completely at random
            let modifier = level.get_blob_modifier();
            return [DIRECTION_ORDER[(level.prng() + modifier) % 4]];
        },
    },
    teeth: {
        layer: LAYERS.actor,
        is_actor: true,
        is_monster: true,
        collision_mask: COLLISION.monster_generic,
        blocks_collision: COLLISION.all_but_real_player,
        movement_speed: 4,
        movement_parity: 2,
        decide_movement(me, level) {
            let preference = pursue_player(me, level);
            if (preference && level.player.type.name === 'player2') {
                // Run away from Cerise
                for (let [i, direction] of preference.entries()) {
                    preference[i] = DIRECTIONS[direction].opposite;
                }
            }
            return preference;
        },
    },
    teeth_timid: {
        layer: LAYERS.actor,
        is_actor: true,
        is_monster: true,
        collision_mask: COLLISION.monster_generic,
        blocks_collision: COLLISION.all_but_real_player,
        movement_speed: 4,
        movement_parity: 2,
        decide_movement(me, level) {
            let preference = pursue_player(me, level);
            if (preference && level.player.type.name === 'player') {
                // Run away from Lexy
                for (let [i, direction] of preference.entries()) {
                    preference[i] = DIRECTIONS[direction].opposite;
                }
            }
            return preference;
        },
    },
    fireball: {
        layer: LAYERS.actor,
        is_actor: true,
        is_monster: true,
        collision_mask: COLLISION.fireball,
        blocks_collision: COLLISION.all_but_real_player,
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
        layer: LAYERS.actor,
        is_actor: true,
        is_monster: true,
        collision_mask: COLLISION.monster_generic,
        blocks_collision: COLLISION.all_but_real_player,
        movement_speed: 4,
        ignores: new Set(['water', 'turtle']),  // doesn't cause turtles to disappear
        decide_movement(me, level) {
            // turn left: preserve current direction; if that doesn't work, turn left, then right,
            // then back the way we came
            let d = DIRECTIONS[me.direction];
            return [me.direction, d.left, d.right, d.opposite];
        },
    },
    ghost: {
        layer: LAYERS.actor,
        is_actor: true,
        is_monster: true,
        collision_mask: COLLISION.ghost,
        blocks_collision: COLLISION.all_but_real_player,
        has_inventory: true,
        ignores: new Set([
            'bomb',
            'water',
            'ice', 'ice_nw', 'ice_ne', 'ice_sw', 'ice_se',
            'force_floor_n', 'force_floor_s', 'force_floor_e', 'force_floor_w', 'force_floor_all',
            // Ghosts don't activate swivels or popwalls
            'popwall', 'swivel_nw', 'swivel_ne', 'swivel_se', 'swivel_sw',
        ]),
        movement_speed: 4,
        // TODO ignores /most/ walls.  collision is basically completely different.  has a regular inventory, except red key.  good grief
        decide_movement(me, level) {
            // turn left: preserve current direction; if that doesn't work, turn left, then right,
            // then back the way we came (same as glider)
            // TODO weird cc2 quirk: ghosts can't turn on ice, and FIXME they stop if they have cleats
            if (me.cell.get_terrain().type.slide_mode === 'ice') {
                return [me.direction];
            }
            let d = DIRECTIONS[me.direction];
            return [me.direction, d.left, d.right, d.opposite];
        },
    },
    floor_mimic: {
        layer: LAYERS.actor,
        is_actor: true,
        is_monster: true,
        collision_mask: COLLISION.monster_generic,
        blocks_collision: COLLISION.all_but_real_player,
        movement_speed: 4,
        movement_parity: 4,
        decide_movement: pursue_player,
    },
    rover: {
        // TODO pushes blocks apparently??
        layer: LAYERS.actor,
        is_actor: true,
        is_monster: true,
        has_inventory: true,
        collision_mask: COLLISION.rover,
        blocks_collision: COLLISION.all_but_real_player,
        can_reveal_walls: true,
        movement_speed: 8,
        movement_parity: 2,
        // FIXME basically everyone has this same set of objects listed?
        pushes: {
            dirt_block: true,
            ice_block: true,
            frame_block: true,
            circuit_block: true,
        },
        on_ready(me, level) {
            me.current_emulatee = 0;
            me.attempted_moves = 0;
        },
        on_clone(me, original) {
            me.current_emulatee = 0;
            me.attempted_moves = 0;
        },
        _emulatees: ['teeth', 'glider', 'bug', 'ball', 'teeth_timid', 'fireball', 'paramecium', 'walker'],
        decide_movement(me, level) {
            level._set_tile_prop(me, 'attempted_moves', me.attempted_moves + 1);
            if (me.attempted_moves >= 32) {
                level._set_tile_prop(me, 'attempted_moves', 0);
                level._set_tile_prop(me, 'current_emulatee', (me.current_emulatee + 1) % me.type._emulatees.length);
            }

            let emulatee = me.type._emulatees[me.current_emulatee];
            return TILE_TYPES[emulatee].decide_movement(me, level);
        },
        visual_state(me) {
            if (me && me.current_emulatee !== undefined) {
                return me.type._emulatees[me.current_emulatee];
            }
            else {
                return 'inert';
            }
        },
    },

    // Keys, whose behavior varies
    key_red: {
        // TODO Red key can ONLY be picked up by players (and doppelgangers), no other actor that
        // has an inventory
        layer: LAYERS.item,
        is_item: true,
        is_key: true,
    },
    key_blue: {
        // Blue key is picked up by dirt blocks and all monsters, including those that don't have an
        // inventory normally
        layer: LAYERS.item,
        is_item: true,
        is_key: true,
        on_arrive(me, level, other) {
            // Call it...  everything except ice and directional blocks?  These rules are weird.
            // Note that the game itself normally handles picking items up, so we only get here for
            // actors who aren't supposed to have an inventory
            // TODO make this a...  flag?  i don't know?
            // TODO major difference from lynx...
            if (other.type.name !== 'ice_block' && other.type.name !== 'frame_block' && ! level.compat.blue_keys_not_edible) {
                level.attempt_take(other, me);
            }
        },
    },
    key_yellow: {
        layer: LAYERS.item,
        is_item: true,
        is_key: true,
        // FIXME ok this is ghastly
        blocks_collision: COLLISION.block_cc1 | (COLLISION.monster_solid & ~COLLISION.rover),
    },
    key_green: {
        layer: LAYERS.item,
        is_item: true,
        is_key: true,
        blocks_collision: COLLISION.block_cc1 | (COLLISION.monster_solid & ~COLLISION.rover),
    },
    // Boots
    // TODO note: ms allows blocks to pass over tools
    cleats: {
        layer: LAYERS.item,
        is_item: true,
        is_tool: true,
        blocks_collision: COLLISION.block_cc1 | (COLLISION.monster_solid & ~COLLISION.rover),
        item_ignores: new Set(['ice', 'ice_nw', 'ice_ne', 'ice_sw', 'ice_se']),
    },
    suction_boots: {
        layer: LAYERS.item,
        is_item: true,
        is_tool: true,
        blocks_collision: COLLISION.block_cc1 | (COLLISION.monster_solid & ~COLLISION.rover),
        item_ignores: new Set([
            'force_floor_n',
            'force_floor_s',
            'force_floor_e',
            'force_floor_w',
            'force_floor_all',
        ]),
    },
    fire_boots: {
        layer: LAYERS.item,
        is_item: true,
        is_tool: true,
        blocks_collision: COLLISION.block_cc1 | (COLLISION.monster_solid & ~COLLISION.rover),
        // Note that these do NOT ignore fire because of the ghost interaction
        // XXX starting to wonder if this is even useful really
        item_ignores: new Set(['flame_jet_on']),
    },
    flippers: {
        layer: LAYERS.item,
        is_item: true,
        is_tool: true,
        blocks_collision: COLLISION.block_cc1 | (COLLISION.monster_solid & ~COLLISION.rover),
        item_ignores: new Set(['water']),
    },
    hiking_boots: {
        layer: LAYERS.item,
        is_item: true,
        is_tool: true,
        blocks_collision: COLLISION.block_cc1 | (COLLISION.monster_solid & ~COLLISION.rover),
        item_ignores: new Set(['sand']),
        // FIXME uhh these "ignore" that dirt and gravel block us, but they don't ignore the on_arrive, so, uhhhh
    },
    // Other tools
    dynamite: {
        layer: LAYERS.item,
        is_item: true,
        is_tool: true,
        blocks_collision: COLLISION.block_cc1 | (COLLISION.monster_solid & ~COLLISION.rover),
        on_depart(me, level, other) {
            if (other.type.is_real_player && ! me.cell.get_item_mod()) {
                level._set_tile_prop(me, 'timer', 85);  // FIXME??  wiki just says about 4.3 seconds what
                level.transmute_tile(me, 'dynamite_lit');
                // Actors are expected to have this, so populate it
                level._set_tile_prop(me, 'movement_cooldown', 0);
                level.add_actor(me);
            }
        },
    },
    dynamite_lit: {
        layer: LAYERS.actor,
        is_actor: true,
        is_monster: true,
        collision_mask: COLLISION.dropped_item,
        blocks_collision: COLLISION.all_but_real_player,
        // FIXME inherits a copy of player's inventory!
        // FIXME holds down buttons, so needs an on_arrive
        // FIXME speaking of buttons, destroyed actors should on_depart (behind compat flag)
        // FIXME wait couldn't this just be a decide_movement?
        on_tic(me, level) {
            // FIXME When Chip or Melinda leaves a tile with a time bomb and no no sign on it, the
            // time bomb will count down for about 4.3 seconds before exploding; it does not matter
            // whether the player dropped the item (e.g. if the player teleported)????
            if (me.slide_mode || me.movement_cooldown)
                return;

            level._set_tile_prop(me, 'timer', me.timer - 1);
            if (me.timer > 0)
                return;

            // Kaboom!  Blow up a 5x5 square
            level.sfx.play_once('bomb', me.cell);
            let x = me.cell.x, y = me.cell.y;
            for (let dx = -2; dx <= 2; dx++) {
                for (let dy = -2; dy <= 2; dy++) {
                    // Exclude the far corners
                    if (Math.abs(dx) + Math.abs(dy) >= 4)
                        continue;

                    let cell = level.cell(x + dx, y + dy);
                    if (! cell)
                        continue;

                    let actor = cell.get_actor();
                    let terrain = cell.get_terrain();
                    let removed_anything;
                    for (let layer = LAYERS.MAX - 1; layer >= 0; layer--) {
                        let tile = cell[layer];
                        if (! tile)
                            continue;

                        if (tile.type.layer === LAYERS.terrain) {
                            // Terrain gets transmuted afterwards
                        }
                        else if (tile.type.is_real_player) {
                            // TODO it would be nice if i didn't have to special-case this every
                            // time
                            level.fail(me.type.name, tile);
                        }
                        else {
                            // Everything else is destroyed
                            level.remove_tile(tile);
                            removed_anything = true;
                        }

                        if (tile.type.name === 'canopy') {
                            // Canopy protects everything else
                            actor = null;
                            terrain = null;
                            break;
                        }
                    }

                    if (actor) {
                        // Actors protect terrain, but floor becomes fire
                        if (terrain && terrain.type.name === 'floor') {
                            if (actor.type.name === 'ice_block') {
                                level.transmute_tile(terrain, 'water');
                            }
                            else {
                                level.transmute_tile(terrain, 'fire');
                            }
                        }
                    }
                    else if (terrain) {
                        // Anything other than these babies gets blown up and turned into floor
                        if (!(
                            terrain.type.name === 'steel' || terrain.type.name === 'socket' || terrain.type.name === 'logic_gate' || terrain.type.name === 'floor'))
                        {
                            level.transmute_tile(terrain, 'floor');
                            removed_anything = true;
                        }
                    }

                    // TODO maybe add a vfx nonblocking explosion
                    if (removed_anything && ! cell.get_actor()) {
                        level.spawn_animation(cell, 'explosion');
                    }
                }
            }
        },
        visual_state(me) {
            // 0 1 2 3 4
            return Math.min(4, Math.max(0, Math.floor((me.timer ?? 0) / TICS_PER_SECOND)));
        },
    },
    bowling_ball: {
        layer: LAYERS.item,
        is_item: true,
        is_tool: true,
        blocks_collision: COLLISION.block_cc1 | (COLLISION.monster_solid & ~COLLISION.rover),
        on_drop(level) {
            return 'rolling_ball';
        },
    },
    rolling_ball: {
        layer: LAYERS.actor,
        is_actor: true,
        is_monster: true,
        has_inventory: true,
        can_reveal_walls: true,
        collision_mask: COLLISION.dropped_item,
        // FIXME do i start moving immediately when dropped, or next turn?
        movement_speed: 4,
        decide_movement(me, level) {
            return [me.direction];
        },
        on_approach(me, level, other) {
            // Blow up anything that runs into us...  unless we're on a cloner
            // FIXME there are other cases where this won't be right; this shouldn't happen if the
            // cell blocks the actor, but i don't have a callback for that?
            if (me.cell.has('cloner'))
                return;
            if (other.type.is_real_player) {
                level.fail(me.type.name, other);
            }
            else {
                level.transmute_tile(other, 'explosion');
            }
            level.sfx.play_once('bomb', me.cell);
            level.transmute_tile(me, 'explosion');
        },
        on_blocked(me, level, direction, obstacle) {
            // Blow up anything we run into
            if (obstacle && obstacle.type.is_actor) {
                if (obstacle.type.is_real_player) {
                    level.fail(me.type.name, obstacle);
                }
                else {
                    level.transmute_tile(obstacle, 'explosion');
                }
            }
            else if (me.slide_mode) {
                // Sliding bowling balls don't blow up if they hit a regular wall
                return;
            }
            level.sfx.play_once('bomb', me.cell);
            level.transmute_tile(me, 'explosion');
            // Remove our slide mode so we don't attempt to bounce if on ice
            level.make_slide(me, null);
        },
    },
    xray_eye: {
        // TODO not implemented
        layer: LAYERS.item,
        is_item: true,
        is_tool: true,
        blocks_collision: COLLISION.block_cc1 | (COLLISION.monster_solid & ~COLLISION.rover),
    },
    helmet: {
        // TODO not implemented
        layer: LAYERS.item,
        is_item: true,
        is_tool: true,
        blocks_collision: COLLISION.block_cc1 | (COLLISION.monster_solid & ~COLLISION.rover),
    },
    railroad_sign: {
        layer: LAYERS.item,
        is_item: true,
        is_tool: true,
        blocks_collision: COLLISION.block_cc1 | (COLLISION.monster_solid & ~COLLISION.rover),
    },
    foil: {
        layer: LAYERS.item,
        is_item: true,
        is_tool: true,
        blocks_collision: COLLISION.block_cc1 | (COLLISION.monster_solid & ~COLLISION.rover),
    },
    lightning_bolt: {
        layer: LAYERS.item,
        is_item: true,
        is_tool: true,
        blocks_collision: COLLISION.block_cc1 | (COLLISION.monster_solid & ~COLLISION.rover),
    },
    speed_boots: {
        layer: LAYERS.item,
        is_item: true,
        is_tool: true,
        blocks_collision: COLLISION.block_cc1 | (COLLISION.monster_solid & ~COLLISION.rover),
    },
    bribe: {
        layer: LAYERS.item,
        is_item: true,
        is_tool: true,
        blocks_collision: COLLISION.block_cc1 | (COLLISION.monster_solid & ~COLLISION.rover),
    },
    hook: {
        layer: LAYERS.item,
        is_item: true,
        is_tool: true,
        blocks_collision: COLLISION.block_cc1 | (COLLISION.monster_solid & ~COLLISION.rover),
    },
    skeleton_key: {
        layer: LAYERS.item,
        is_item: true,
        is_tool: true,
        blocks_collision: COLLISION.block_cc1 | (COLLISION.monster_solid & ~COLLISION.rover),
    },

    // Progression
    player: {
        layer: LAYERS.actor,
        is_actor: true,
        is_player: true,
        is_real_player: true,
        collision_mask: COLLISION.real_player1,
        blocks_collision: COLLISION.real_player,
        has_inventory: true,
        can_reveal_walls: true,
        movement_speed: 4,
        pushes: {
            dirt_block: true,
            ice_block: true,
            frame_block: true,
            circuit_block: true,
        },
        infinite_items: {
            key_green: true,
        },
        visual_state: player_visual_state,
    },
    player2: {
        layer: LAYERS.actor,
        is_actor: true,
        is_player: true,
        is_real_player: true,
        collision_mask: COLLISION.real_player2,
        blocks_collision: COLLISION.real_player,
        has_inventory: true,
        can_reveal_walls: true,
        movement_speed: 4,
        ignores: new Set(['ice', 'ice_nw', 'ice_ne', 'ice_sw', 'ice_se']),
        pushes: {
            dirt_block: true,
            ice_block: true,
            frame_block: true,
            circuit_block: true,
        },
        infinite_items: {
            key_yellow: true,
        },
        visual_state: player_visual_state,
    },
    doppelganger1: {
        layer: LAYERS.actor,
        is_actor: true,
        is_player: true,
        is_monster: true,
        collision_mask: COLLISION.doppel1,
        blocks_collision: COLLISION.all_but_real_player,
        has_inventory: true,
        can_reveal_walls: true,  // XXX i think?
        movement_speed: 4,
        pushes: {
            dirt_block: true,
            ice_block: true,
            frame_block: true,
            circuit_block: true,
        },
        infinite_items: {
            key_green: true,
        },
        decide_movement(me, level) {
            return level.player1_move ? [level.player1_move] : null;
        },
        //visual_state: doppelganger_visual_state,
    },
    doppelganger2: {
        layer: LAYERS.actor,
        is_actor: true,
        is_player: true,
        is_monster: true,
        collision_mask: COLLISION.doppel2,
        blocks_collision: COLLISION.all_but_real_player,
        has_inventory: true,
        can_reveal_walls: true,  // XXX i think?
        movement_speed: 4,
        ignores: new Set(['ice', 'ice_nw', 'ice_ne', 'ice_sw', 'ice_se']),
        pushes: {
            dirt_block: true,
            ice_block: true,
            frame_block: true,
            circuit_block: true,
        },
        infinite_items: {
            key_yellow: true,
        },
        decide_movement(me, level) {
            return level.player2_move ? [level.player2_move] : null;
        },
        //visual_state: doppelganger_visual_state,
    },
    chip: {
        layer: LAYERS.item,
        is_chip: true,
        is_required_chip: true,
        blocks_collision: COLLISION.block_cc1 | (COLLISION.monster_solid & ~COLLISION.rover),
        on_arrive(me, level, other) {
            if (other.type.is_real_player) {
                level.collect_chip();
                level.remove_tile(me);
            }
        },
    },
    chip_extra: {
        layer: LAYERS.item,
        is_chip: true,
        blocks_collision: COLLISION.block_cc1 | (COLLISION.monster_solid & ~COLLISION.rover),
        on_arrive(me, level, other) {
            if (other.type.is_real_player) {
                level.collect_chip();
                level.remove_tile(me);
            }
        },
    },
    score_10: {
        layer: LAYERS.item,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
        on_arrive(me, level, other) {
            if (other.type.is_real_player) {
                level.adjust_bonus(10);
                level.sfx.play_once('get-bonus', me.cell);
            }
            // TODO turn this into a flag on those types??  idk
            if (other.type.is_player || other.type.name === 'rover' || other.type.name === 'bowling_ball') {
                level.remove_tile(me);
            }
        },
    },
    score_100: {
        layer: LAYERS.item,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
        on_arrive(me, level, other) {
            if (other.type.is_real_player) {
                level.adjust_bonus(100);
                level.sfx.play_once('get-bonus', me.cell);
            }
            if (other.type.is_player || other.type.name === 'rover' || other.type.name === 'bowling_ball') {
                level.remove_tile(me);
            }
        },
    },
    score_1000: {
        layer: LAYERS.item,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
        on_arrive(me, level, other) {
            if (other.type.is_real_player) {
                level.adjust_bonus(1000);
                level.sfx.play_once('get-bonus', me.cell);
            }
            if (other.type.is_player || other.type.name === 'rover' || other.type.name === 'bowling_ball') {
                level.remove_tile(me);
            }
        },
    },
    score_2x: {
        layer: LAYERS.item,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
        on_arrive(me, level, other) {
            if (other.type.is_real_player) {
                level.adjust_bonus(0, 2);
                level.sfx.play_once('get-bonus2', me.cell);
            }
            if (other.type.is_player || other.type.name === 'rover' || other.type.name === 'bowling_ball') {
                level.remove_tile(me);
            }
        },
    },

    hint: {
        layer: LAYERS.terrain,
        is_hint: true,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid,
        populate_defaults(me) {
            me.hint_text = null;  // optional, may use level's hint instead
        },
    },
    socket: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.block_cc1 | (COLLISION.monster_solid & ~COLLISION.rover),
        blocks(me, level, other) {
            return ! (other.type.name === 'ghost' || level.chips_remaining <= 0);
        },
        on_arrive(me, level, other) {
            if (level.chips_remaining === 0) {
                level.sfx.play_once('socket', me.cell);
                level.spawn_animation(me.cell, 'puff');
                level.transmute_tile(me, 'floor');
            }
        },
    },
    exit: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_solid & ~COLLISION.rover,
        on_arrive(me, level, other) {
            if (other.type.is_real_player) {
                level.remaining_players -= 1;
                if (level.remaining_players > 0) {
                    if (other === level.player) {
                        level.swap_player1 = true;
                    }
                    level.transmute_tile(other, other.type.name === 'player' ? 'player1_exit' : 'player2_exit');
                }
            }
        },
    },

    // VFX
    splash: {
        layer: LAYERS.actor,
        is_actor: true,
        collision_mask: 0,
        blocks_collision: COLLISION.real_player,
        ttl: 16,
        // If anything else even begins to step on an animation, it's erased
        // FIXME possibly erased too fast; cc2 shows it briefly?  could i get away with on_arrive here?
        on_approach(me, level, other) {
            level.remove_tile(me);
        },
    },
    explosion: {
        layer: LAYERS.actor,
        is_actor: true,
        collision_mask: 0,
        blocks_collision: COLLISION.real_player,
        ttl: 16,
        on_approach(me, level, other) {
            level.remove_tile(me);
        },
    },
    // Used as an easy way to show an invisible wall when bumped
    wall_invisible_revealed: {
        layer: LAYERS.vfx,
        is_actor: true,
        collision_mask: 0,
        blocks_collision: 0,
        // determined experimentally
        ttl: 36,
    },
    // Custom VFX (identical function, but different aesthetic)
    splash_slime: {
        layer: LAYERS.actor,
        is_actor: true,
        collision_mask: 0,
        blocks_collision: COLLISION.real_player,
        ttl: 16,
        on_approach(me, level, other) {
            level.remove_tile(me);
        },
    },
    // New VFX (not in CC2, so they don't block to avoid altering gameplay)
    // Note that these need to NOT have a duration that's an even number of tics, or the last frame
    // will be skipped when playing at 20fps; the cooldown will be 3, then decremented to 0, and the
    // tile will immediately be removed!
    player1_exit: {
        layer: LAYERS.vfx,
        is_actor: true,
        collision_mask: 0,
        ttl: 8 * 3 + 1,
    },
    player2_exit: {
        layer: LAYERS.vfx,
        is_actor: true,
        collision_mask: 0,
        ttl: 8 * 3 + 1,
    },
    teleport_flash: {
        layer: LAYERS.vfx,
        is_actor: true,
        collision_mask: 0,
        ttl: 8 * 3 + 1,
    },
    transmogrify_flash: {
        layer: LAYERS.vfx,
        is_actor: true,
        collision_mask: 0,
        ttl: 4 * 3 + 1,
    },
    puff: {
        layer: LAYERS.vfx,
        is_actor: true,
        collision_mask: 0,
        ttl: 4 * 3 + 1,
    },

    // Invalid tiles that appear in some CCL levels because community level
    // designers love to make nonsense
    bogus_player_win: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.all,
    },
    bogus_player_swimming: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.all,
    },
    bogus_player_drowned: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.all,
    },
    bogus_player_burned_fire: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.all,
    },
    bogus_player_burned: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.all,
    },
};

// Tell them all their own names
for (let [name, type] of Object.entries(TILE_TYPES)) {
    type.name = name;

    if (type.layer === undefined ||
        type.layer !== Math.floor(type.layer) ||
        type.layer >= LAYERS.MAX)
    {
        console.error(`Tile type ${name} has a bad layer`);
    }

    if (type.is_actor && type.collision_mask === undefined) {
        console.error(`Tile type ${name} is an actor but has no collision mask`);
    }
}

export default TILE_TYPES;
