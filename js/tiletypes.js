import { find_terrain_linear } from './algorithms.js';
import { ACTOR_TRAITS, COLLISION, DIRECTIONS, DIRECTION_ORDER, LAYERS, TICS_PER_SECOND, PICKUP_PRIORITIES } from './defs.js';

// TODO factor out some repeated stuff: common monster bits, common item bits, repeated collision
// masks
function activate_me(me, level) {
    me.type.activate(me, level);
}

function blocks_leaving_thin_walls(me, level, actor, direction) {
    return me.type.thin_walls.has(direction) && actor.type.name !== 'ghost';
}

// Score bonuses; they're picked up as normal EXCEPT by ghosts, but only a real player can actually
// add to the player's bonus
function _define_bonus(add, mult = 1) {
    return {
        layer: LAYERS.item,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_typical,
        item_priority: PICKUP_PRIORITIES.normal,
        check_toll(me, level, other) {
            return level.bonus_points > 0 && Math.floor(level.bonus_points / mult) >= add;
        },
        take_toll(me, level, other) {
            level.adjust_bonus(-add, 1/mult);
        },
        on_pickup(me, level, other) {
            if (other.type.name === 'ghost')
                return false;
            if (other.type.is_real_player) {
                level.adjust_bonus(add, mult);
                level.sfx.play_once('get-bonus', me.cell);
            }
            return true;
        },
    };
}
function _define_door(key) {
    return {
        layer: LAYERS.terrain,
        // Doors can be opened by ice blocks, but not dirt blocks or monsters
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_typical,
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
        layer: LAYERS.canopy,
        // Unlike doors, anything with the key (or a ghost) can step on them
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
function _define_force_floor(direction, opposite_type) {
    return {
        layer: LAYERS.terrain,
        slide_mode: 'force',
        slide_override_mode: 'player-force',
        speed_factor: 0.5,
        // Used by Lynx to prevent backwards overriding
        force_floor_direction: direction,
        on_stand(me, level, other) {
            if (other.traits & ACTOR_TRAITS.forceproof)
                return;

            level.schedule_actor_slide(other, me.type.slide_mode, direction);
        },
        activate(me, level) {
            level.transmute_tile(me, opposite_type);
        },
        is_gray_button_editor_safe: true,
        on_gray_button: activate_me,
        on_power: activate_me,
    };
}
function _define_ice_corner(dir1, dir2) {
    let direction_map = {};
    for (let direction of Object.keys(DIRECTIONS)) {
        direction_map[direction] = direction;
    }
    direction_map[dir1] = DIRECTIONS[dir2].opposite;
    direction_map[dir2] = DIRECTIONS[dir1].opposite;

    return {
        layer: LAYERS.terrain,
        thin_walls: new Set([dir1, dir2]),
        slide_mode: 'ice',
        speed_factor: 0.5,
        blocks_leaving: blocks_leaving_thin_walls,
        on_arrive(me, level, other) {
            if (other.traits & ACTOR_TRAITS.iceproof)
                return;

            level.schedule_actor_slide(other, me.type.slide_mode);
        },
        on_stand(me, level, other) {
            if (other.traits & ACTOR_TRAITS.iceproof)
                return;

            //level.schedule_actor_slide(other, me.type.slide_mode, direction);
            level._set_tile_prop(other, 'direction', direction_map[other.direction]);
        },
    };
}

function update_wireable(me, level) {
    if (me.is_wired === undefined) {
        //start of the level/first time, then
        me.is_wired = level.is_tile_wired(me, false);
        me.is_active = !me.is_wired;
    }
    else {
        let new_is_wired = level.is_tile_wired(me, false);
        if (new_is_wired && !me.is_wired)
        {
            //connected
            level._set_tile_prop(me, 'is_wired', true);
            //TODO: it'll always get on_power called later if it's wired to something already given power, right?
            level._set_tile_prop(me, 'is_active', false);
        }
        else if (!new_is_wired && me.is_wired)
        {
            //disconnected
            level._set_tile_prop(me, 'is_wired', false);
            level._set_tile_prop(me, 'is_active', true);
        }
    }
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
    if (me.fail_reason === 'burned') {
        return 'burned';
    }
    if (me.fail_reason === 'exploded') {
        return 'exploded';
    }
    if (me.fail_reason === 'slimed') {
        return 'slimed';
    }
    if (me.fail_reason === 'electrocuted') {
        return 'burned';
    }
    if (me.fail_reason === 'fell') {
        return 'fell';
    }
    if (me.fail_reason) {
        return 'failed';
    }
    if (me.exited) {
        return 'exited';
    }
    // This is slightly complicated.  We should show a swimming pose while still in water, or moving
    // away from water (as CC2 does), but NOT when stepping off a lilypad (which will already have
    // been turned into water), and NOT without flippers (which can happen if we start on water)
    if (me.cell && (me.previous_cell || me.cell).has('water') &&
        ! me.not_swimming && (me.traits & ACTOR_TRAITS.waterproof))
    {
        return 'swimming';
    }
    // Rough check for sliding: are we moving faster than normal?
    if (me.movement_speed && me.movement_speed < 12) {
        let terrain = me.cell.get_terrain();
        if (terrain.type.slide_mode === 'ice') {
            return 'skating';
        }
        else if (terrain.type.slide_mode === 'force') {
            return 'forced';
        }
    }
    if (me.is_blocked) {
        return 'blocked';
    }
    if (me.is_pushing) {
        return 'pushing';
    }
    if (me.movement_speed) {
        return 'moving';
    }
    return 'normal';
}

function button_visual_state(me) {
    if (me && me._editor_pressed) {
        return 'pressed';
    }
    if (me && me.cell) {
        let actor = me.cell.get_actor();
        if (actor && ! actor.movement_cooldown) {
            return 'pressed';
        }
    }
    return 'released';
}

// Logic for chasing after the player (or running away); shared by both teeth and mimics
function pursue_player(me, level) {
    // Teeth can only move the first 4 of every 8 tics, and mimics only the first 4 of every 16,
    // though "first" can be adjusted
    if ((level.tic_counter + level.step_parity) % (me.type.movement_parity * 4) >= 4)
        return null;

    let player = level.player;
    let px, py;
    if (level.compat.teeth_target_internal_position) {
        // Lynx: pursue the player's current cell
        px = player.cell.x;
        py = player.cell.y;
    }
    else {
        // CC2: pursue the player's apparent position, not just the cell they're in
        [px, py] = player.visual_position();
    }

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

// Ugh.  Check for can_reveal_walls, but special-casing it for the pgchip ice blocks, where the
// static property is different.  This sux!!
function can_actually_reveal_walls(tile, level) {
    if (level.compat.use_pgchip_ice_blocks && tile.type.name == 'ice_block')
        return false;

    return tile.type.can_reveal_walls;
}

// Chunks of properties that are shared among bunches of tiles
const COMMON_MONSTER = {
    layer: LAYERS.actor,
    is_actor: true,
    is_monster: true,
    collision_mask: COLLISION.monster_generic,
    blocks_collision: COLLISION.all,
    // Despite the name, this means we only pick up items that are always picked up
    item_pickup_priority: PICKUP_PRIORITIES.always,
    movement_speed: 4,
};
const COMMON_TOOL = {
    layer: LAYERS.item,
    is_item: true,
    is_tool: true,
    blocks_collision: COLLISION.block_cc1 | COLLISION.monster_typical,
    item_priority: PICKUP_PRIORITIES.normal,
};
const COMMON_PUSHES = {
    dirt_block: true,
    ice_block: true,
    frame_block: true,
    circuit_block: true,
    boulder: true,
    glass_block: true,
    sokoban_block: true,
};

const TILE_TYPES = {
    // Floors and walls
    floor: {
        layer: LAYERS.terrain,
        contains_wire: true,
        wire_propagation_mode: 'autocross',
        can_be_powered_by_actor: true,
        on_approach(me, level, other) {
            if (other.type.name === 'blob' || other.type.name === 'boulder') {
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
        blocks(me, level, other) {
            return (other.type.name === 'sokoban_block' && other.color !== 'green');
        },
    },
    floor_custom_pink: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.ghost,
        blocks(me, level, other) {
            return (other.type.name === 'sokoban_block' && other.color !== 'red');
        },
    },
    floor_custom_yellow: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.ghost,
        blocks(me, level, other) {
            return (other.type.name === 'sokoban_block' && other.color !== 'yellow');
        },
    },
    floor_custom_blue: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.ghost,
        blocks(me, level, other) {
            return (other.type.name === 'sokoban_block' && other.color !== 'blue');
        },
    },
    wall: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.all_but_ghost,
        on_bumped(me, level, other) {
            if (other.traits & ACTOR_TRAITS.foiled) {
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
            if (can_actually_reveal_walls(other, level)) {
                level.spawn_animation(me.cell, 'wall_invisible_revealed');
            }
        },
    },
    wall_appearing: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.all_but_ghost,
        is_flickable_in_lynx: true,
        on_bumped(me, level, other) {
            if (can_actually_reveal_walls(other, level)) {
                level.transmute_tile(me, 'wall');
            }
        },
    },
    popwall: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_typical,
        on_ready(me, level) {
            if (! level.compat.no_auto_convert_ccl_popwalls &&
                level.stored_level.format === 'ccl' &&
                me.cell.get_actor())
            {
                // CCL: Actors who start on popwalls are not intended to activate them when they
                // leave, so preserve CC2 behavior by changing them to double popwalls
                me.type = TILE_TYPES['popwall2'];
            }
        },
        activate(me, level, other) {
            level.spawn_animation(me.cell, 'puff');
            level.transmute_tile(me, 'wall');
            if (other === level.player) {
                level.sfx.play_once('popwall', me.cell);
            }
        },
        on_arrive(me, level, other) {
            if (other.type.name === 'ghost')
                return;

            // Lynx/MS: These activate on arrival, not departure
            if (level.compat.popwalls_pop_on_arrive) {
                this.activate(me, level, other);
            }
        },
        on_depart(me, level, other) {
            // CC2 quirk: nothing happens if there's still an actor on us (i.e. dynamite)
            if (me.cell.get_actor())
                return;
            if (other.type.name === 'ghost')
                return;

            if (! level.compat.popwalls_pop_on_arrive) {
                this.activate(me, level, other);
            }
        },
    },
    // LL specific tile that can only be stepped on /twice/, originally used to repair differences
    // with popwall behavior between Lynx and Steam
    popwall2: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_typical,
        on_depart(me, level, other) {
            if (other.type.name === 'ghost')
                return;

            level.spawn_animation(me.cell, 'puff');
            level.transmute_tile(me, 'popwall');
        },
    },
    // FIXME in a cc1 tileset, these tiles are opaque  >:S
    thin_walls: {
        layer: LAYERS.thin_wall,
        blocks(me, level, actor, direction) {
            if (actor.type.name === 'ghost')
                return false;
            return (me.edges & DIRECTIONS[direction].opposite_bit) !== 0;
        },
        blocks_leaving(me, level, actor, direction) {
            if (actor.type.name === 'ghost')
                return false;
            return (me.edges & DIRECTIONS[direction].bit) !== 0;
        },
        populate_defaults(me) {
            me.edges = 0;  // bitmask of directions
        },
    },
    // These only support one-way into the tile, so they're pretty much thin walls that can only
    // stop something from leaving
    one_way_walls: {
        layer: LAYERS.thin_wall,
        blocks_leaving(me, level, actor, direction) {
            if (actor.type.name === 'ghost')
                return false;
            return (me.edges & DIRECTIONS[direction].bit) !== 0;
        },
        populate_defaults(me) {
            me.edges = 0;  // bitmask of directions
        },
    },
    fake_wall: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.all_but_ghost,
        is_flickable_in_lynx: true,
        on_ready(me, level) {
            if (! level.compat.no_auto_convert_ccl_blue_walls &&
                level.stored_level.format === 'ccl' &&
                me.cell.get_actor())
            {
                // CCL: Blocks can be pushed off of blue walls in TW Lynx, but we can replicate the
                // behavior with CC2 rules by replacing them with popwalls
                // TODO this also works with invis walls apparently.  maybe only for blocks?
                me.type = TILE_TYPES['popwall'];
            }
        },
        on_bumped(me, level, other) {
            if (can_actually_reveal_walls(other, level)) {
                level.transmute_tile(me, 'wall');
            }
        },
    },
    fake_floor: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_typical,
        reveal(me, level, other) {
            level.spawn_animation(me.cell, 'puff');
            level.transmute_tile(me, 'floor');
            if (other === level.player) {
                level.sfx.play_once('fake-floor', me.cell);
            }
        },
        on_bumped(me, level, other) {
            if (can_actually_reveal_walls(other, level) && ! level.compat.blue_floors_vanish_on_arrive) {
                this.reveal(me, level, other);
            }
        },
        on_arrive(me, level, other) {
            // In Lynx, these disappear only when you step on them
            if (level.compat.blue_floors_vanish_on_arrive) {
                this.reveal(me, level, other);
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
        contains_wire: true,
        wire_propagation_mode: 'autocross',
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
            if (other.type.name === 'ghost')
                return;

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
        is_gray_button_editor_safe: true,
        on_gray_button: activate_me,
        on_power: activate_me,
    },
    swivel_se: {
        layer: LAYERS.swivel,
        thin_walls: new Set(['south', 'east']),
        on_depart(me, level, other) {
            if (other.type.name === 'ghost')
                return;

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
        is_gray_button_editor_safe: true,
        on_gray_button: activate_me,
        on_power: activate_me,
    },
    swivel_sw: {
        layer: LAYERS.swivel,
        thin_walls: new Set(['south', 'west']),
        on_depart(me, level, other) {
            if (other.type.name === 'ghost')
                return;

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
        is_gray_button_editor_safe: true,
        on_gray_button: activate_me,
        on_power: activate_me,
    },
    swivel_nw: {
        layer: LAYERS.swivel,
        thin_walls: new Set(['north', 'west']),
        on_depart(me, level, other) {
            if (other.type.name === 'ghost')
                return;

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
        is_gray_button_editor_safe: true,
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
            // in this direction
            me.entered_direction = 'north';
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
            return ! (other.traits & ACTOR_TRAITS.trackproof) &&
                ! me.type.has_opening(me, DIRECTIONS[direction].opposite);
        },
        blocks_leaving(me, level, other, direction) {
            // FIXME needs the same logic as redirect_exit, so that an illegal entrance can't leave
            // at all
            return ! (other.traits & ACTOR_TRAITS.trackproof) &&
                ! me.type.has_opening(me, direction);
        },
        on_arrive(me, level, other) {
            level._set_tile_prop(me, 'entered_direction', other.direction);
        },
        on_depart(me, level, other) {
            if (me.track_switch === null)
                return;

            // Ghosts never switch tracks
            if (other.type.name === 'ghost')
                return;
            // Wired switches are /only/ controlled by wire
            if (level.is_tile_wired(me, false))
                return;

            // Only switch if both the entering and the leaving are CURRENTLY valid directions
            // (which has some quirky implications for the railroad sign)
            let track = this.track_order[me.track_switch];
            if (track.indexOf(DIRECTIONS[me.entered_direction].opposite) >= 0 && track.indexOf(other.direction) >= 0) {
                me.type._switch_track(me, level);
            }
        },
        on_power(me, level) {
            me.type._switch_track(me, level);
        },
        is_gray_button_editor_safe: true,
        on_gray_button(me, level) {
            me.type._switch_track(me, level);
        },
        redirect_exit(me, other, direction) {
            if (other.traits & ACTOR_TRAITS.trackproof)
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
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_typical,
        blocks(me, level, other) {
            // XXX special-casing this several times feels clumsy, but the only alternative is to
            // give everyone dirtproof by default, OR have a dirt-averse flag that dirtproof
            // /removes/??  (but then i'd still have to check for ghost??)
            return ((other.type.name === 'player2' || other.type.name === 'doppelganger2') &&
                ! (other.traits & ACTOR_TRAITS.dirtproof));
        },
        on_arrive(me, level, other) {
            // CC2 quirk: ghosts don't pack down dirt, /unless/ they have hiking boots
            if (other.type.name === 'ghost' && ! (other.traits & ACTOR_TRAITS.dirtproof))
                return;
            level.transmute_tile(me, 'floor');
            if (other === level.player) {
                level.sfx.play_once('step-dirt', me.cell);
            }
        },
    },
    gravel: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.monster_typical,
        blocks(me, level, other) {
            return ((other.type.name === 'player2' || other.type.name === 'doppelganger2') &&
                ! (other.traits & ACTOR_TRAITS.dirtproof));
        },
    },
    sand: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.block_cc1 | COLLISION.block_cc2,
        speed_factor: 1.5,
    },
    grass: {
        // TODO should bugs leave if they have no other option...?  that seems real hard.
        // TODO teeth move at full speed?  that also seems hard.
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.block_cc1 | COLLISION.block_cc2,
        blocks(me, level, other) {
            // These guys with big wheels can't do grass
            return (
                other.type.name === 'tank_blue' || other.type.name === 'tank_yellow' ||
                other.type.name === 'rover');
        },
        blocks_leaving(me, level, other, direction) {
            // Both kinds of bugs prefer to stay in the grass
            if (other.type.name === 'bug' || other.type.name === 'paramecium') {
                let neighbor = level.get_neighboring_cell(me.cell, direction);
                if (neighbor && neighbor.get_terrain().type.name !== 'grass')
                    return true;
            }
        },
        on_arrive(me, level, other) {
            if (other.type.name === 'fireball') {
                level.transmute_tile(me, 'fire');
                level.spawn_animation(me.cell, 'puff');
            }
        },
    },
    dash_floor: {
        layer: LAYERS.terrain,
        speed_factor: 0.5,
    },
    spikes: {
        layer: LAYERS.terrain,
        blocks(me, level, other) {
            return other.type.is_player && ! (other.traits & ACTOR_TRAITS.dirtproof);
        },
        on_arrive(me, level, other) {
            if (other.type.name === 'glass_block') {
                // FIXME need a glass shatter vfx
                level.kill_actor(other, me, 'explosion');
            }
        },
    },
    turntable_cw: {
        layer: LAYERS.terrain,
        contains_wire: true,
        wire_propagation_mode: 'all',
        slide_mode: 'turntable',
        on_arrive(me, level, other) {
            level.schedule_actor_slide(other, me.type.slide_mode, DIRECTIONS[other.direction].right);
            if (other.type.on_rotate) {
                other.type.on_rotate(other, level, 'right');
            }
        },
        on_stand(me, level, other) {
            level.schedule_actor_slide(other, me.type.slide_mode);
        },
        activate(me, level) {
            level.transmute_tile(me, 'turntable_ccw');
        },
        is_gray_button_editor_safe: true,
        on_gray_button: activate_me,
        on_power: activate_me,
    },
    turntable_ccw: {
        layer: LAYERS.terrain,
        contains_wire: true,
        wire_propagation_mode: 'all',
        slide_mode: 'turntable',
        on_arrive(me, level, other) {
            level.schedule_actor_slide(other, me.type.slide_mode, DIRECTIONS[other.direction].right);
            if (other.type.on_rotate) {
                other.type.on_rotate(other, level, 'left');
            }
        },
        on_stand(me, level, other) {
            level.schedule_actor_slide(other, me.type.slide_mode);
        },
        activate(me, level) {
            level.transmute_tile(me, 'turntable_cw');
        },
        is_gray_button_editor_safe: true,
        on_gray_button: activate_me,
        on_power: activate_me,
    },

    // Hazards
    fire: {
        layer: LAYERS.terrain,
        // Fire blocks most monsters, except in MS where they walk right in and get roasted
        blocks(me, level, other) {
            if (other.type.collision_mask & (COLLISION.fireball | COLLISION.yellow_tank | COLLISION.ghost))
                return false;
            if (other.type.collision_mask & COLLISION.monster_any) {
                if (level.compat.fire_allows_most_monsters && other.type.name !== 'bug' && other.type.name !== 'walker')
                    return false;
                return true;
            }
            return false;
        },
        on_arrive(me, level, other) {
            if (other.type.name === 'ghost') {
                // Ghosts with fire boots erase fire, otherwise are unaffected
                if (other.traits & ACTOR_TRAITS.fireproof) {
                    level.transmute_tile(me, 'floor');
                }
                return;
            }
            else if (other.traits & ACTOR_TRAITS.fireproof) {
                return;
            }
            else if (other.type.name === 'ice_block') {
                level.transmute_tile(other, 'splash');
                level.transmute_tile(me, 'water');
                level.sfx.play_once('splash', me.cell);
            }
            else {
                level.kill_actor(other, me, 'explosion', 'bomb', 'burned');
            }
        },
    },
    water: {
        layer: LAYERS.terrain,
        blocks(me, level, other) {
            // Water blocks ghosts...  unless they have flippers
            if (other.type.name === 'ghost' && ! (other.traits & ACTOR_TRAITS.waterproof))
                return true;
        },
        on_arrive(me, level, other) {
            if (other.traits & ACTOR_TRAITS.waterproof)
                return;

            // TODO cc1 allows items under water, i think; water was on the upper layer
            level.sfx.play_once('splash', me.cell);
            let splash_type = level.compat.block_splashes_dont_block ? 'splash_nb' : 'splash';
            if (other.type.name === 'dirt_block') {
                level.transmute_tile(other, splash_type);
                level.transmute_tile(me, 'dirt');
            }
            else if (other.type.name === 'frame_block') {
                level.transmute_tile(other, splash_type);
                level.transmute_tile(me, 'floor');
            }
            else if (other.type.name === 'glass_block') {
                level.transmute_tile(other, splash_type);
                level.transmute_tile(me, 'floor');
            }
            else if (other.type.name === 'ice_block') {
                level.transmute_tile(other, splash_type);
                level.transmute_tile(me, 'ice');
            }
            else if (other.type.name === 'boulder') {
                level.transmute_tile(other, splash_type);
                level.transmute_tile(me, 'gravel');
            }
            else if (other.type.name === 'circuit_block') {
                level.transmute_tile(me, 'floor');
                level._set_tile_prop(me, 'wire_directions', other.wire_directions);
                level.transmute_tile(other, splash_type);
                level.recalculate_circuitry_next_wire_phase = true;
            }
            else if (other.type.name === 'sokoban_block') {
                level.transmute_tile(me, ({
                    red: 'floor_custom_pink',
                    blue: 'floor_custom_blue',
                    yellow: 'floor_custom_yellow',
                    green: 'floor_custom_green',
                })[other.color]);
                level.transmute_tile(other, splash_type);
            }
            else {
                level.kill_actor(other, me, 'splash', null, 'drowned');
            }
        },
    },
    turtle: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.ghost | COLLISION.fireball,
        on_depart(me, level, other) {
            // CC2 quirk: nothing happens if there's still an actor on us (i.e. dynamite)
            if (me.cell.get_actor())
                return;

            // Gliders don't sink us (but ghosts do)
            if (other.type.name === 'glider')
                return;

            level.transmute_tile(me, 'water');
            level.spawn_animation(me.cell, 'splash');
            level.sfx.play_once('splash', me.cell);
            // Visual property, so the actor knows it's stepping off a lilypad, not swimming out of
            // the water we just turned into
            level._set_tile_prop(other, 'not_swimming', true);
        },
    },
    cracked_ice: {
        layer: LAYERS.terrain,
        slide_mode: 'ice',
        speed_factor: 0.5,
        on_arrive(me, level, other) {
            if (other.traits & ACTOR_TRAITS.iceproof)
                return;

            level.schedule_actor_slide(other, me.type.slide_mode);
        },
        on_depart(me, level, other) {
            // Cerises don't break cracked terrain
            if (other.type.name === 'player2' || other.type.name === 'doppelganger2')
                return;

            level.transmute_tile(me, 'water');
            level.spawn_animation(me.cell, 'splash');
            level.sfx.play_once('splash', me.cell);
        },
    },
    ice: {
        layer: LAYERS.terrain,
        slide_mode: 'ice',
        speed_factor: 0.5,
        on_arrive(me, level, other) {
            if (other.traits & ACTOR_TRAITS.iceproof)
                return;

            level.schedule_actor_slide(other, me.type.slide_mode);
        },
    },
    ice_sw: _define_ice_corner('south', 'west'),
    ice_nw: _define_ice_corner('north', 'west'),
    ice_ne: _define_ice_corner('north', 'east'),
    ice_se: _define_ice_corner('south', 'east'),
    force_floor_n: _define_force_floor('north', 'force_floor_s'),
    force_floor_s: _define_force_floor('south', 'force_floor_n'),
    force_floor_e: _define_force_floor('east', 'force_floor_w'),
    force_floor_w: _define_force_floor('west', 'force_floor_e'),
    force_floor_all: {
        layer: LAYERS.terrain,
        slide_mode: 'force',
        slide_override_mode: 'player-force',
        speed_factor: 0.5,
        blocks(me, level, other) {
            return (level.compat.rff_blocks_monsters &&
                (other.type.collision_mask & COLLISION.monster_typical));
        },
        on_stand(me, level, other) {
            if (other.traits & ACTOR_TRAITS.forceproof)
                return;

            // FIXME this is a kludge to avoid rolling too many RFFs, but i think the real problem
            // is calling on_stand too many times
            if (! other.pending_slide_mode) {
                level.schedule_actor_slide(other, me.type.slide_mode, level.get_force_floor_direction());
            }
        },
    },
    slime: {
        layer: LAYERS.terrain,
        on_arrive(me, level, other) {
            if (other.type.name === 'ghost' || other.type.name === 'blob' || other.type.name === 'boulder') {
                // No effect
                return;
            }

            level.sfx.play_once('splash-slime', me.cell);
            if (other.type.name === 'dirt_block' || other.type.name === 'ice_block') {
                level.transmute_tile(me, 'floor');
            }
            else {
                level.kill_actor(other, me, 'splash_slime', null, 'slimed');
            }
        },
    },
    bomb: {
        layer: LAYERS.item,
        on_ready(me, level) {
            if (! level.compat.no_auto_convert_ccl_bombs &&
                level.stored_level.format === 'ccl' &&
                me.cell.get_actor())
            {
                // CCL: A number of custom levels start an actor on top of a bomb (I guess to
                // conserve space), relying on the CC1 behavior that bombs only detonate when
                // stepped onto.  Replace those with the custom "dormant bomb" tile.
                me.type = TILE_TYPES['dormant_bomb'];
            }
        },
        on_arrive(me, level, other) {
            if (other.type.name === 'ghost')
                return;

            // XXX this crashes if i remove the condition?
            if (level.compat.bombs_detonate_on_arrive) {
                me.type._detonate(me, level, other);
            }
        },
        on_stand(me, level, other) {
            if (other.type.name === 'ghost')
                return;

            // Lynx: Bombs detonate on arrival, not on idle
            // Steam: Bombs detonate when stood on, even if a player starts the level on one.  This
            // is useless in CC2 design and breaks some CC1 levels, so it's off by default
            if (! level.compat.bombs_detonate_on_arrive &&
                ! (level.compat.bombs_immediately_detonate_under_players &&
                    level.tic_counter === 0 && other.type.is_real_player))
            {
                me.type._detonate(me, level, other);
            }
        },
        _detonate(me, level, other) {
            level.remove_tile(me);
            level.kill_actor(other, me, 'explosion', 'bomb', 'exploded');
        },
    },
    // Bomb variant originally added as a CC1 autofix, but which doubles as an experimental item --
    // it's dormant until you drop it and move off of it, at which point it becomes a normal bomb
    dormant_bomb: {
        ...COMMON_TOOL,
        on_depart(me, level, other) {
            // Unlike dynamite, anyone can activate this (important to make it work as CCL compat)
            if (me.cell.get_item_mod())
                return;

            level.transmute_tile(me, 'bomb');
        },
    },
    hole: {
        layer: LAYERS.terrain,
        on_ready(me, level) {
            let one_north = level.cell(me.cell.x, me.cell.y - 1);
            if (one_north === null || one_north.get_terrain().type.name !== 'hole') {
                level._set_tile_prop(me, 'visual_state', 'north');
            }
            else {
                level._set_tile_prop(me, 'visual_state', 'open');
            }
        },
        on_arrive(me, level, other) {
            if (other.type.name === 'ghost')
                return;

            level.kill_actor(other, me, 'fall', null, 'fell');
        },
        visual_state(me) {
            // Default to the version of the tile that actually shows something; otherwise this
            // looks like an error or gap in the editor
            return (me && me.visual_state) ?? 'north';
        },
    },
    cracked_floor: {
        layer: LAYERS.terrain,
        on_depart(me, level, other) {
            // Cerises don't break cracked terrain
            if (other.type.name === 'player2' || other.type.name === 'doppelganger2')
                return;

            level.spawn_animation(me.cell, 'puff');
            if (other === level.player) {
                level.sfx.play_once('popwall', me.cell);
            }

            level.transmute_tile(me, 'hole');
            // Update hole visual state (note that me.type is hole now)
            me.type.on_ready(me, level);
            let one_south = level.get_neighboring_cell(me.cell, 'south');
            if (one_south && one_south.get_terrain().type.name === 'hole') {
                me.type.on_ready(one_south.get_terrain(), level);
            }
        },
    },
    thief_tools: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_typical,
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
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_typical,
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
    // Item modifiers
    no_sign: {
        layer: LAYERS.item_mod,
        item_modifier: 'ignore',
        blocks(me, level, other) {
            let item = me.cell.get_item();
            return item && other.has_item(item.type.name);
        },
    },
    gift_bow: {
        layer: LAYERS.item_mod,
        item_modifier: 'pickup',
    },
    toll_gate: {
        layer: LAYERS.item_mod,
        item_modifier: 'ignore',
        // Most non-inventory items have special (but intuitive) behavior.  Bombs are functionally
        // not items, so although they /can/ be put under here, they'll just block everything.
        // XXX cc2's editor won't let you place a no sign on a chip, and will count the chip (if
        // required), and will also let you pick up the chip if you walk over it.  but this
        // explicitly works with chips, so keep that in mind when fixing that.  also, a chip under
        // here (or a gift bow i guess) shouldn't animate
        blocks(me, level, other) {
            let item = me.cell.get_item();
            if (! item) {
                return false;
            }
            else if (item.type.check_toll) {
                return ! item.type.check_toll(item, level, other);
            }
            else if (other.has_item(item.type.name)) {
                return false;
            }
            else if (item.type.is_key && other.has_item('skeleton_key')) {
                // Special case: the skeleton key works here, too
                return false;
            }
            return true;
        },
        on_arrive(me, level, other) {
            let item = me.cell.get_item();
            if (! item)
                return;

            if (item.type.take_toll) {
                item.type.take_toll(item, level, other);
            }
            else if (item.type.is_tool) {
                level.take_tool_from_actor(other, item.type.name);
            }
            else if (item.type.is_key) {
                if (! level.take_key_from_actor(other, item.type.name, true)) {
                    // Special case: the skeleton key works here, too (but the real key is still
                    // preferred)
                    level.take_tool_from_actor(other, 'skeleton_key');
                }
            }
            else {
                // ???
                return;
            }

            if (other === level.player) {
                level.sfx.play_once('thief', me.cell);
            }
        },
    },

    // Mechanisms
    dirt_block: {
        layer: LAYERS.actor,
        collision_mask: COLLISION.block_cc1,
        blocks_collision: COLLISION.all,
        item_pickup_priority: PICKUP_PRIORITIES.always,
        is_actor: true,
        is_block: true,
        innate_traits: ACTOR_TRAITS.fireproof | ACTOR_TRAITS.shockproof,
        can_reverse_on_railroad: true,
        movement_speed: 4,
    },
    ice_block: {
        layer: LAYERS.actor,
        collision_mask: COLLISION.block_cc2,
        blocked_by(me, level, other) {
            // pgchip's ice blocks followed dirt block collision rules, except for being able to go
            // on dirt
            if (level.compat.use_pgchip_ice_blocks && other.type.name !== 'dirt' &&
                (other.type.blocks_collision & COLLISION.block_cc1))
                return true;
        },
        blocks_collision: COLLISION.all,
        item_pickup_priority: PICKUP_PRIORITIES.never,
        is_actor: true,
        is_block: true,
        can_reveal_walls: true,
        can_reverse_on_railroad: true,
        movement_speed: 4,
        pushes: {
            // Ice blocks specifically cannot push dirt blocks
            ...COMMON_PUSHES,
            dirt_block: false,
        },
        on_after_bumped(me, level, other) {
            // Fireballs melt ice blocks on regular floor FIXME and water!
            // XXX what if i'm in motion?
            if (other.type.name === 'fireball' && ! level.compat.use_pgchip_ice_blocks) {
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
        item_pickup_priority: PICKUP_PRIORITIES.never,
        is_actor: true,
        is_block: true,
        can_reveal_walls: true,
        can_reverse_on_railroad: true,
        movement_speed: 4,
        // TODO why does this have a Set where most things have a bitmask
        allows_push(me, direction) {
            return me.arrows && me.arrows.has(direction);
        },
        pushes: COMMON_PUSHES,
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
    boulder: {
        layer: LAYERS.actor,
        collision_mask: COLLISION.block_cc2,
        blocks_collision: COLLISION.all,
        // XXX?
        item_pickup_priority: PICKUP_PRIORITIES.never,
        is_actor: true,
        is_block: true,
        can_reveal_walls: true,
        // Boulders don't directly push each other; instead on_bumped will propagate the momentum
        // XXX can they not push other kinds of blocks?
        pushes: {
            ice_block: true,
            frame_block: true,
        },
        innate_traits: ACTOR_TRAITS.fireproof | ACTOR_TRAITS.shockproof,
        can_reverse_on_railroad: true,
        movement_speed: 4,
        decide_movement(me, level) {
            if (me.rolling) {
                level._set_tile_prop(me, 'rolling', false);
                return [me.direction, null];
            }
            else {
                return null;
            }
        },
        on_bumped(me, level, other, direction) {
            if (other.type.name === 'boulder') {
                level._set_tile_prop(me, 'rolling', true);
                level._set_tile_prop(me, 'direction', direction);
                level._set_tile_prop(other, 'rolling', false);
            }
        },
        on_starting_move(me, level) {
            if (!me.rolling) {
                level._set_tile_prop(me, 'rolling', true);
            }
        },
    },
    glass_block: {
        layer: LAYERS.actor,
        collision_mask: COLLISION.block_cc2,
        blocks_collision: COLLISION.all,
        item_pickup_priority: PICKUP_PRIORITIES.never,
        is_actor: true,
        is_block: true,
        can_reveal_walls: true,
        can_reverse_on_railroad: true,
        movement_speed: 4,
        try_pickup_item(me, level) {
            // Suck up any item that could be picked up off of the floor, and put it in our
            // encased_item slot (which is, somewhat confusingly, distinct from our inventory -- we
            // cannot actually make use of our encased item)
            if (me.encased_item === null) {
                let item = me.cell.get_item();
                let mod = me.cell.get_item_mod();
                if (mod && mod.type.item_modifier === 'ignore') {
                  return;
                }
                //hmm, actually chips seem to work OK. Alright, why not then?
                if (item /*&& !item.type.is_chip*/ && item.type.item_priority !== undefined) {
                  level._set_tile_prop(me, 'encased_item', item.type.name);
                  level.remove_tile(item);
                }
            }
        },
        on_ready(me, level) {
            level._set_tile_prop(me, 'encased_item', null);
            this.try_pickup_item(me, level);
        },
        on_clone(me, original) {
            me.encased_item = original.encased_item;
        },
        on_finishing_move(me, level) {
            this.try_pickup_item(me, level);
        },
        blocked_by(me, level, other) {
            if (other.type.layer === LAYERS.item && me.encased_item)
                return true;
        },
        on_death(me, level) {
            if (me.encased_item !== null) {
                level._place_dropped_item(me.encased_item, me.cell ?? me.previous_cell, me);
                level._set_tile_prop(me, 'encased_item', null);
            }
        }
    },
    green_floor: {
        layer: LAYERS.terrain,
        green_toggle_counterpart: 'green_wall',
        blocks(me, level, other) {
            // Toggle walls don't toggle until the end of the frame, but the collision takes into
            // account whether a toggle is coming
            return (
                level.pending_green_toggle &&
                (other.type.collision_mask & COLLISION.all_but_ghost));
        },
        activate(me, level) {
            level.transmute_tile(me, 'green_wall');
        },
        is_gray_button_editor_safe: true,
        on_gray_button: activate_me,
        on_power: activate_me,
    },
    green_wall: {
        layer: LAYERS.terrain,
        green_toggle_counterpart: 'green_floor',
        blocks(me, level, other) {
            // Same as above
            return (
                ! level.pending_green_toggle &&
                (other.type.collision_mask & COLLISION.all_but_ghost));
        },
        activate(me, level) {
            level.transmute_tile(me, 'green_floor');
        },
        is_gray_button_editor_safe: true,
        on_gray_button: activate_me,
        on_power: activate_me,
    },
    green_chip: {
        layer: LAYERS.item,
        is_chip: true,
        is_required_chip: true,
        green_toggle_counterpart: 'green_bomb',
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_typical,
        item_priority: PICKUP_PRIORITIES.real_player,
        check_toll(me, level, other) {
            // Increasing the chips-remaining counter is always fine
            return true;
        },
        take_toll(me, level, other) {
            level.uncollect_chip(me);
        },
        on_pickup(me, level, other) {
            level.collect_chip(me);
            return true;
        },
        // Not affected by gray buttons
    },
    green_bomb: {
        layer: LAYERS.item,
        is_required_chip: true,
        green_toggle_counterpart: 'green_chip',
        on_arrive(me, level, other) {
            if (other.type.name === 'ghost')
                return;

            // Unlike regular bombs, these only seem to respond to being stepped on, not stood on
            level.remove_tile(me);
            level.kill_actor(other, me, 'explosion', 'bomb', 'exploded');
        },
        // Not affected by gray buttons
    },
    purple_floor: {
        layer: LAYERS.terrain,
        activate(me, level) {
            level.transmute_tile(me, 'purple_wall');
        },
        is_gray_button_editor_safe: true,
        on_gray_button: activate_me,
        on_power: activate_me,
        on_depower: activate_me,
    },
    purple_wall: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.all_but_ghost,
        activate(me, level) {
            level.transmute_tile(me, 'purple_floor');
        },
        is_gray_button_editor_safe: true,
        on_gray_button: activate_me,
        on_power: activate_me,
        on_depower: activate_me,
    },

    // Sokoban blocks, buttons, and walls -- they each come in four colors, the buttons can be
    // pressed by anything EXCEPT a sokoban block of the WRONG color, and the walls become floors
    // only when ALL the buttons of the corresponding color are pressed
    sokoban_block: {
        layer: LAYERS.actor,
        collision_mask: COLLISION.block_cc1,
        blocks_collision: COLLISION.all,
        item_pickup_priority: PICKUP_PRIORITIES.always,
        is_actor: true,
        is_block: true,
        can_reverse_on_railroad: true,
        movement_speed: 4,
        populate_defaults(me) {
            me.color = 'red';
        },
        on_clone(me, original) {
            me.color = original.color;
        },
        visual_state(me) {
            let color = me.color ?? 'red';
            if (me && me.cell && ! me.movement_cooldown) {
                let terrain = me.cell.get_terrain();
                if (terrain.type.name === 'sokoban_button' && terrain.pressed) {
                    return color + '_matched';
                }
            }
            return color;
        },
    },
    sokoban_button: {
        layer: LAYERS.terrain,
        populate_defaults(me) {
            me.color = 'red';
            me.pressed = false;
        },
        on_ready(me, level) {
            let actor = me.cell.get_actor();
            if (actor && ! (actor.type.name === 'sokoban_block' && actor.color !== me.color)) {
                // Already held down, make sure the level knows
                me.pressed = true;
                level.press_sokoban(me.color);
            }
        },
        on_arrive(me, level, other) {
            if (me.pressed)
                return;
            if (other.type.name === 'sokoban_block' && me.color !== other.color)
                return;
            level._set_tile_prop(me, 'pressed', true);
            level.sfx.play_once('button-press', me.cell);

            level.press_sokoban(me.color);
        },
        on_depart(me, level, other) {
            if (! me.pressed)
                return;
            level._set_tile_prop(me, 'pressed', false);
            level.sfx.play_once('button-release', me.cell);

            level.unpress_sokoban(me.color);
        },
        visual_state(me) {
            return (me.color ?? 'red') + '_' + (me.pressed ? 'pressed' : 'released');
        },
    },
    sokoban_wall: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.all_but_ghost,
        populate_defaults(me) {
            me.color = 'red';
        },
        visual_state(me) {
            return me.color ?? 'red';
        },
    },
    sokoban_floor: {
        layer: LAYERS.terrain,
        populate_defaults(me) {
            me.color = 'red';
        },
        visual_state(me) {
            return me.color ?? 'red';
        },
    },

    // ------------------------------------------------------------------------------------------------
    // Floor mechanisms
    cloner: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.real_player | COLLISION.block_cc1 | COLLISION.monster_typical,
        populate_defaults(me) {
            me.arrows = 0;  // bitmask of glowing arrows (visual, no gameplay impact)
        },
        on_ready(me, level) {
            me.arrows = me.arrows ?? 0;
        },
        traps(me, level, other) {
            return ! other._clone_release;
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
            let cloned = false;
            // Wire activation allows the cloner to try every direction, searching clockwise
            for (let i = 0; i < (aggressive ? 4 : 1); i++) {
                // If the actor successfully moves, replace it with a new clone.  As a special case,
                // bowling balls that immediately destroy something are also considered to have
                // successfully exited
                let success = level.attempt_out_of_turn_step(actor, direction);
                if (! success && actor.type.ttl && ! level.compat.cloned_bowling_balls_can_be_lost) {
                    success = true;
                    if (actor.type.layer === LAYERS.actor) {
                        level.transmute_tile(actor, 'explosion_nb', true);
                    }
                }
                if (success) {
                    // FIXME add this underneath, just above the cloner, so the new actor is on top
                    let new_template = level.make_actor(type, direction);
                    if (type.on_clone) {
                        type.on_clone(new_template, actor);
                    }
                    level.add_tile(new_template, me.cell);
                    level.add_actor(new_template);
                    cloned = true;
                    break;
                }
                direction = DIRECTIONS[direction].right;
            }
            if (aggressive && ! cloned) {
                // Restore original facing
                level.set_actor_direction(actor, direction);
            }
            delete actor._clone_release;
        },
        // Also clones on rising pulse or gray button
        on_power(me, level) {
            me.type.activate(me, level, true);
        },
        is_gray_button_editor_safe: false,
        on_gray_button: activate_me,
    },
    trap: {
        layer: LAYERS.terrain,
        on_ready(me, level) {
            // This may run before or after any pressed buttons, but, that's fine
            if (me.presses === undefined) {
                level._set_tile_prop(me, 'presses', 0);
            }
        },
        add_press_ready(me, level, other) {
            // Same as below, but without ejection
            level._set_tile_prop(me, 'presses', (me.presses ?? 0) + 1);
        },
        add_press(me, level, is_wire = false) {
            level._set_tile_prop(me, 'presses', me.presses + 1);
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
            level._set_tile_prop(me, 'presses', Math.max(0, me.presses - 1));
            if (me._initially_open) {
                level._set_tile_prop(me, '_initially_open', false);
            }
        },
        // FIXME also doesn't trap ghosts, is that a special case???
        traps(me, level, other) {
            if (level.compat.traps_like_lynx) {
                // Lynx traps don't actually track open vs closed; actors are just ejected by force
                // by a separate pass at the end of the tic that checks what's on a brown button.
                // That means a trap held open by a button at level start won't effectively be open
                // if whatever's on the button moves within the first tic, a quirk that CCLXP2 #17
                // Double Trouble critically relies on!
                // To fix this, assume that a trap can never be released on the first turn.
                // FIXME that's not right since a block or immobile mob might be on a button...
                if (level.tic_counter === 0)
                    return true;
            }
            return ! me.presses && ! me._initially_open && other.type.name !== 'ghost';
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

            // Items are only mogrified when inside a glass block
            key_red: 'key_blue',
            key_blue: 'key_red',
            key_yellow: 'key_green',
            key_green: 'key_yellow',

            flippers: 'fire_boots',
            fire_boots: 'flippers',
            cleats: 'suction_boots',
            suction_boots: 'cleats',
            hiking_boots: 'speed_boots',
            speed_boots: 'hiking_boots',
            lightning_bolt: 'railroad_sign',
            railroad_sign: 'lightning_bolt',
            helmet: 'xray_eye',
            xray_eye: 'helmet',
            hook: 'foil',
            foil: 'hook',
            bowling_ball: 'dynamite',
            dynamite: 'bowling_ball',
            bribe: 'skeleton_key',
            skeleton_key: 'bribe',
            stopwatch_bonus: 'stopwatch_penalty',
            stopwatch_penalty: 'stopwatch_bonus',
            green_chip: 'green_bomb',
            green_bomb: 'green_chip',
            chip: 'bomb',
            bomb: 'chip',

            // TODO
            // boulder: 'log',
            // log: 'boulder',
            // ankh: 'phantom_ring',
            // phantom_ring: 'ankh',
        },
        _blob_mogrifications: ['glider', 'paramecium', 'fireball', 'bug', 'walker', 'ball', 'teeth', 'tank_blue', 'teeth_timid'],
        on_begin(me, level) {
            update_wireable(me, level);
        },
        on_arrive(me, level, other) {
            // Note: Transmogrifiers technically contain wires the way teleports do, and CC2 uses
            // the presence and poweredness of those wires to determine whether the transmogrifier
            // should appear to be on or off, but the /functionality/ is controlled entirely by
            // whether an adjoining cell carries current to our edge, like a railroad or cloner.
            // (This probably doesn't matter because the CC2 editor draws wires between cell
            // centers, not from center to edge.  Maybe that's a good idea.)
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
            else if (name === 'glass_block' && other.encased_item) {
                let new_item = me.type._mogrifications[other.encased_item];
                if (new_item) {
                    level._set_tile_prop(other, 'encased_item', new_item);
                }
                else {
                    return;
                }
            }
            else if (name === 'sokoban_block') {
                level._set_tile_prop(other, 'color', ({
                    red: 'blue',
                    blue: 'red',
                    yellow: 'green',
                    green: 'yellow',
                })[other.color]);
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
            return me && me.is_active === false ? 'inactive' : 'active';
        },
    },
    teleport_blue: {
        layer: LAYERS.terrain,
        slide_mode: 'teleport',
        contains_wire: true,
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
                for (let [dest, cell] of find_terrain_linear(
                    level, me.cell, new Set(['teleport_blue', 'teleport_blue_exit']), true))
                {
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
            let circuits = [...level.cells_to_circuits.get(level.cell_to_scalar(me.cell))];
            for (let i = 0; i < circuits.length; i++) {
                let circuit = circuits[i];
                if (! circuit || walked_circuits.has(circuit))
                    continue;
                walked_circuits.add(circuit);

                for (let tile of circuit.tiles.keys()) {
                    if (tile.type === me.type || tile.type.name === 'teleport_blue_exit') {
                        candidate_teleporters.add(tile);
                    }
                    else if (tile.type.name === 'logic_gate' && ! circuit.inputs.get(tile)) {
                        // This logic gate is functioning as an output, so walk through it and also
                        // trace any circuits that treat it as an input (as long as those circuits
                        // are currently powered)
                        for (let subcircuit of level.cells_to_circuits.get(level.cell_to_scalar(tile.cell))) {
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
    teleport_blue_exit: {
        layer: LAYERS.terrain,
        contains_wire: true,
        wire_propagation_mode: 'all',
    },
    teleport_red: {
        layer: LAYERS.terrain,
        slide_mode: 'teleport',
        slide_override_mode: 'player',
        contains_wire: true,
        wire_propagation_mode: 'none',
        on_begin(me, level) {
            // FIXME must be connected to something that can convey current: a wire, a switch, a
            // blue teleporter, etc; NOT nothing, a wall, a transmogrifier, a force floor, etc.
            // this is also how blue teleporters, transmogrifiers, and railroads work!
            update_wireable(me, level);
        },
        *teleport_dest_order(me, level, other) {
            // Wired red teleporters can be turned off, which disconnects them from every other red
            // teleporter (but they still teleport to themselves).
            // A red teleporter is considered wired only if it has wires itself.  However, CC2 also
            // has the bizarre behavior of NOT considering a red teleporter wired if none of its
            // wires are directly connected to another neighboring wire.
            let iterable;
            if (me.is_active) {
                iterable = find_terrain_linear(level, me.cell, new Set(['teleport_red']));
            }
            else {
                iterable = [[me, me.cell]];
            }
            let exit_direction = other.direction;
            for (let [tile, cell] of iterable) {
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
            return me && me.is_active === false ? 'inactive' : 'active';
        },
    },
    teleport_green: {
        layer: LAYERS.terrain,
        slide_mode: 'teleport',
        contains_wire: true,
        wire_propagation_mode: 'all',
        *teleport_dest_order(me, level, other) {
            // The CC2 green teleporter scheme is:
            // 1. Use the PRNG to pick another green teleporter
            // 2. Use the PRNG to pick an exit direction
            // 3. Search the selected exit teleporter for a viable exit direction
            // 4. If that doesn't work, continue searching green teleporters in reading order
            // 5. When we reach the entry teleporter, stop and give up
            // This means that completely blocked green teleporters are skipped, BUT if the only
            // available teleporters are between the entry and chosen exit, they'll never be tried.
            // Also, due to what appears to be a bug, CC2 picks an index from among all other
            // teleporters, but then only iterates over "unclogged" ones (those without actors on
            // them) to find that particular teleporter.  Since the list of unclogged ones includes
            // the source, this means some rolls will fail to teleport entirely, even if the next
            // teleporter in RRO is open.
            // This is clearly buggy as hell, so it's squirrelled away behind a compat option.

            // This iterator starts on the /next/ teleporter, so we appear last, and we can index
            // from zero to the second-to-last element.
            let all = Array.from(find_terrain_linear(level, me.cell, new Set(['teleport_green'])));
            if (all.length <= 1) {
                // If this is the only teleporter, just walk out the other side — and, crucially, do
                // NOT advance the PRNG
                yield [me, other.direction];
                return;
            }
            let start_index = level.prng() % (all.length - 1);
            // Also pick the initial exit direction
            let exit_direction = DIRECTION_ORDER[level.prng() % 4];

            let candidates;
            all = all.map(([tile, cell]) => tile);
            if (level.compat.green_teleports_can_fail) {
                // CC2 bug emulation: only look through "unclogged" exits
                candidates = all.filter(tile => tile === me || ! tile.cell.get_actor());
                start_index %= candidates.length;
            }
            else {
                candidates = all;
            }

            for (let i = 0; i < candidates.length; i++) {
                let index = start_index + i;
                if (index === candidates.length - 1)
                    // This is us, skip for now
                    continue;
                if (level.compat.green_teleports_can_fail) {
                    // CC2: Only check from the selected teleporter to the entrance
                    if (index >= candidates.length)
                        break;
                }
                else {
                    // Lexy: Try them all, only stopping once we loop back to our first choice
                    index %= candidates.length;
                }
                let target = candidates[index];

                // Green teleporters allow exiting in any direction, similar to red
                yield [target, exit_direction];
                yield [target, DIRECTIONS[exit_direction].right];
                yield [target, DIRECTIONS[exit_direction].opposite];
                yield [target, DIRECTIONS[exit_direction].left];
            }

            // We've circled back around to our entry teleporter; give up
            yield [me, other.direction];
            return;
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
            return me && me.is_active === false ? 'inactive' : 'active';
        },
    },
    teleport_yellow: {
        layer: LAYERS.terrain,
        item_priority: PICKUP_PRIORITIES.always,
        slide_mode: 'teleport',
        slide_override_mode: 'player',
        *teleport_dest_order(me, level, other) {
            let exit_direction = other.direction;
            for (let [dest, cell] of find_terrain_linear(level, me.cell, new Set(['teleport_yellow']), true)) {
                yield [dest, exit_direction];
            }
        },
    },
    teleport_rainbow: {
        layer: LAYERS.terrain,
        slide_mode: 'teleport',
        contains_wire: true,
        wire_propagation_mode: 'all',
        *teleport_dest_order(me, level, other) {
            // LOL TODO
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
            return me && me.is_active === false ? 'inactive' : 'active';
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
        is_gray_button_editor_safe: true,
        on_gray_button: activate_me,
        on_power: activate_me,
    },
    flame_jet_on: {
        layer: LAYERS.terrain,
        activate(me, level) {
            level.transmute_tile(me, 'flame_jet_off');
        },
        is_gray_button_editor_safe: true,
        on_gray_button: activate_me,
        on_power: activate_me,
        on_stand(me, level, other) {
            if (other.traits & ACTOR_TRAITS.fireproof)
                return;

            level.kill_actor(other, me, 'explosion', 'bomb', 'burned');
        },
    },
    electrified_floor: {
        layer: LAYERS.terrain,
        wire_propagation_mode: 'all',
        can_be_powered_by_actor: true,
        is_emitting(me, level) {
            // Only count us as a power /source/ if we're activated by a button; otherwise we're
            // just passing along current from elsewhere.  Either way, the wire phase should power
            // all our edges, so we can be checked for actually being active via powered_edges
            return !! me.presses;
        },
        update_power_emission(me, level) {
        },
        // We're also powered by (any number of) cyan buttons, so this is similar to trap code
        on_ready(me, level) {
            level._set_tile_prop(me, 'wire_directions', 15);
            // This may run before or after any pressed buttons, but, that's fine
            if (me.presses === undefined) {
                level._set_tile_prop(me, 'presses', 0);
            }
        },
        add_press(me, level) {
            level._set_tile_prop(me, 'presses', (me.presses ?? 0) + 1);
        },
        remove_press(me, level) {
            level._set_tile_prop(me, 'presses', Math.max(0, me.presses - 1));
        },
        on_stand(me, level, other) {
            if (me.powered_edges && ! (other.traits & ACTOR_TRAITS.shockproof)) {
                level.kill_actor(other, me, 'explosion', 'bomb', 'electrocuted');
            }
        },
        on_death(me, level) {
            // Need to remove our wires since they're an implementation detail
            level._set_tile_prop(me, 'wire_directions', 0);
            level._set_tile_prop(me, 'powered_edges', 0);
            level.recalculate_circuitry_next_wire_phase = true;
        },
        visual_state(me) {
            return me && me.powered_edges ? 'active' : 'inactive';
        },
    },

    // ------------------------------------------------------------------------------------------------
    // Buttons
    button_blue: {
        layer: LAYERS.terrain,
        do_button(level) {
            // Flip direction of all blue tanks
            for (let actor of level.actors) {
                // TODO generify somehow??
                if (actor.type.name !== 'tank_blue')
                    continue;

                if (! level.compat.tanks_always_obey_button &&
                    (actor.slide_mode || actor.cell.has('cloner')))
                {
                    continue;
                }

                level._set_tile_prop(actor, 'pending_reverse', ! actor.pending_reverse);
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
            level.pending_green_toggle = ! level.pending_green_toggle;
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
        connects_to: new Set(['trap']),
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
        connects_to: new Set(['cloner']),
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
    button_cyan: {
        layer: LAYERS.terrain,
        connects_to: new Set(['electrified_floor']),
        connect_order: 'diamond',
        on_ready(me, level) {
            // Inform the floor of any actors that start out holding us down
            let floor = me.connection;
            if (! (floor && floor.cell))
                return;

            if (me.cell.get_actor()) {
                floor.type.add_press_ready(floor, level);
            }
        },
        on_arrive(me, level, other) {
            level.sfx.play_once('button-press', me.cell);

            // Electrified floors are active while at least one connected button is pressed
            let floor = me.connection;
            if (floor && floor.cell && floor.type.name === 'electrified_floor') {
                floor.type.add_press(floor, level);
            }
        },
        on_depart(me, level, other) {
            level.sfx.play_once('button-release', me.cell);
            let floor = me.connection;
            if (floor && floor.cell && floor.type.name === 'electrified_floor') {
                floor.type.remove_press(floor, level);
            }
        },
        visual_state: button_visual_state,
    },
    button_pink: {
        layer: LAYERS.terrain,
        contains_wire: true,
        wire_propagation_mode: 'none',
        is_emitting(me, level) {
            // We emit current as long as there's an actor fully on us
            let actor = me.cell.get_actor();
            return (actor && actor.movement_cooldown === 0);
        },
        update_power_emission(me, level) {
        },
        on_arrive(me, level, other) {
            level.sfx.play_once('button-press', me.cell);
        },
        on_depart(me, level, other) {
            level.sfx.play_once('button-release', me.cell);
        },
        visual_state: button_visual_state,
    },
    button_pink_framed: {
        // TODO on_gray_button
        layer: LAYERS.terrain,
        contains_wire: true,
        wire_propagation_mode: 'none',
        is_emitting(me, level) {
            // We emit current as long as there's an actor fully on us
            let actor = me.cell.get_actor();
            return (actor && actor.movement_cooldown === 0);
        },
        update_power_emission(me, level) {
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
        contains_wire: true,
        wire_propagation_mode: 'cross',
        on_ready(me, level) {
            me.emitting = true;
            me.next_emitting = true;
        },
        is_emitting(me, level) {
            // We emit current as long as there's NOT an actor fully on us
            return me.emitting;
        },
        // CC2 has a single frame delay between an actor stepping on/off of the button and the
        // output changing; it's not clear why, and I can't figure out how this might have happened
        // on accident, but it might be to compensate for logic gates firing quickly...?
        // Same applies to light switches, but NOT pink buttons.
        update_power_emission(me, level) {
            let actor = me.cell.get_actor();
            let ret = me.emitting;
            level._set_tile_prop(me, 'emitting', me.next_emitting);
            level._set_tile_prop(me, 'next_emitting', ! (actor && actor.movement_cooldown === 0));
            return ret;
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
            diode: ['out0', null, 'in0', null],
            delay: ['out0', null, 'in0', null],
            battery: ['out0', null, 'in0', null],
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
            bogus: [null, null, null, null],
        },
        layer: LAYERS.terrain,
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
            else if (me.gate_type === 'delay') {
                me.buffer = 0;
            }
            else if (me.gate_type === 'battery') {
                me.timeout = 0;
            }

            me.in0 = me.in1 = null;
            me.out0 = me.out1 = null;
            let dir = me.direction;
            for (let i = 0; i < 4; i++) {
                let cxn = me.gate_def[i];
                let dirinfo = DIRECTIONS[dir];
                if (cxn === 'in0') {
                    me.in0 = dir;
                }
                else if (cxn === 'in1') {
                    me.in1 = dir;
                }
                else if (cxn === 'out0') {
                    me.out0 = dir;
                }
                else if (cxn === 'out1') {
                    me.out1 = dir;
                }
                dir = dirinfo.right;
            }
        },
        // Returns [in0, in1, out0, out1] as directions
        get_wires(me) {
            let gate_def = me.type._gate_types[me.gate_type];
            let dir = me.direction;
            let ret = [null, null, null, null];
            for (let i = 0; i < 4; i++) {
                let cxn = gate_def[i];
                let dirinfo = DIRECTIONS[dir];
                if (cxn === 'in0') {
                    ret[0] = dir;
                }
                else if (cxn === 'in1') {
                    ret[1] = dir;
                }
                else if (cxn === 'out0') {
                    ret[2] = dir;
                }
                else if (cxn === 'out1') {
                    ret[3] = dir;
                }
                dir = dirinfo.right;
            }
            return ret;
        },
        is_emitting(me, level, edges) {
            return edges & me._output;
        },
        update_power_emission(me, level) {
            // Collect which of our edges are powered, in clockwise order starting from our
            // direction, matching _gate_types
            let input0 = !! (me.in0 && (me.powered_edges & DIRECTIONS[me.in0].bit));
            let input1 = !! (me.in1 && (me.powered_edges & DIRECTIONS[me.in1].bit));
            let output0 = false;
            let output1 = false;

            if (me.gate_type === 'not') {
                output0 = ! input0;
            }
            else if (me.gate_type === 'diode') {
                output0 = input0;
            }
            else if (me.gate_type === 'delay') {
                let buffer = me.buffer;
                buffer <<= 1;
                if (input0) {
                    buffer |= 1;
                }
                output0 = ((buffer & 0x1000) !== 0);
                level._set_tile_prop(me, 'buffer', buffer & 0x0fff);
            }
            else if (me.gate_type === 'battery') {
                if (input0) {
                    level._set_tile_prop(me, 'timeout', 12);
                }
                else if (me.timeout > 0) {
                    level._set_tile_prop(me, 'timeout', me.timeout - 1);
                }
                output0 = (me.timeout > 0);
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
                    mem += 1;
                    if (mem > 9) {
                        mem = 0;
                        output0 = true;
                    }
                }
                else if (dec && ! inc) {
                    mem -= 1;
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

            // This should only need to persist for a tic, and can be recomputed during undo, and
            // also making it undoable would eat a whole lot of undo space
            me._output = (output0 ? DIRECTIONS[me.out0].bit : 0) | (output1 ? DIRECTIONS[me.out1].bit : 0);
        },
        visual_state(me) {
            return me.gate_type;
        },
    },
    // Light switches, kinda like the pink/black buttons but persistent
    light_switch_off: {
        layer: LAYERS.terrain,
        contains_wire: true,
        wire_propagation_mode: 'none',
        on_ready(me, level) {
            me.emitting = false;
        },
        // See button_black's commentary on the timing here
        is_emitting(me, level, edge) {
            return me.emitting;
        },
        update_power_emission(me, level) {
            if (me.is_first_frame) {
                level._set_tile_prop(me, 'emitting', true);
                level._set_tile_prop(me, 'is_first_frame', false);
            }
            else {
                level._set_tile_prop(me, 'emitting', false);
            }
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
        contains_wire: true,
        wire_propagation_mode: 'none',
        on_ready(me, level) {
            me.emitting = true;
        },
        // See button_black's commentary on the timing here
        is_emitting(me, level, edge) {
            return me.emitting;
        },
        update_power_emission(me, level) {
            if (me.is_first_frame) {
                level._set_tile_prop(me, 'emitting', false);
                level._set_tile_prop(me, 'is_first_frame', false);
            }
            else {
                level._set_tile_prop(me, 'emitting', true);
            }
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
        item_pickup_priority: PICKUP_PRIORITIES.never,
        is_actor: true,
        is_block: true,
        contains_wire: true,
        wire_propagation_mode: 'autocross',
        can_reverse_on_railroad: true,
        movement_speed: 4,
        on_clone(me, original) {
            me.wire_directions = original.wire_directions;
        },
        on_starting_move(me, level) {
            level._set_tile_prop(me, 'powered_edges', 0);
            level.recalculate_circuitry_next_wire_phase = true;
        },
        on_finishing_move(me, level) {
            level.recalculate_circuitry_next_wire_phase = true;
        },
    },

    // Time alteration
    stopwatch_bonus: {
        layer: LAYERS.item,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_typical,
        item_priority: PICKUP_PRIORITIES.real_player,
        // Stopwatch bonus toll functions like a stopwatch penalty, except it doesn't go away and
        // blocks you if you don't have at least 10 seconds to spare
        check_toll(me, level, other) {
            return level.time_remaining >= 10 * 20;
        },
        take_toll(me, level, other) {
            level.adjust_timer(-10);
        },
        on_pickup(me, level, other) {
            level.sfx.play_once('get-stopwatch-bonus', me.cell);
            level.adjust_timer(+10);
            return true;
        },
    },
    stopwatch_penalty: {
        layer: LAYERS.item,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_typical,
        item_priority: PICKUP_PRIORITIES.real_player,
        // Stopwatch penalty toll just gives you 10 seconds every time??
        check_toll(me, level, other) {
            return true;
        },
        take_toll(me, level, other) {
            level.adjust_timer(+10);
        },
        on_pickup(me, level, other) {
            level.sfx.play_once('get-stopwatch-penalty', me.cell);
            level.adjust_timer(-10);
            return true;
        },
    },
    stopwatch_toggle: {
        layer: LAYERS.item,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_typical,
        item_priority: PICKUP_PRIORITIES.player,
        // Stopwatch toggle toll wants to unpause the clock as a cost, so it only lets you through
        // if the clock is currently paused
        check_toll(me, level, other) {
            return level.timer_paused;
        },
        take_toll(me, level, other) {
            level.pause_timer();
        },
        on_pickup(me, level, other) {
            if (level.pause_timer()) {
                level.sfx.play_once('get-stopwatch-toggle', me.cell);
            }
            return false;
        },
    },

    // ------------------------------------------------------------------------------------------------
    // Critters
    bug: {
        ...COMMON_MONSTER,
        collision_mask: COLLISION.bug,
        decide_movement(me, level) {
            // always try turning as left as possible, and fall back to less-left turns
            let d = DIRECTIONS[me.direction];
            return [d.left, me.direction, d.right, d.opposite];
        },
    },
    paramecium: {
        ...COMMON_MONSTER,
        decide_movement(me, level) {
            // always try turning as right as possible, and fall back to less-right turns
            let d = DIRECTIONS[me.direction];
            return [d.right, me.direction, d.left, d.opposite];
        },
    },
    ball: {
        ...COMMON_MONSTER,
        decide_movement(me, level) {
            // preserve current direction; if that doesn't work, bounce back the way we came
            let d = DIRECTIONS[me.direction];
            return [me.direction, d.opposite];
        },
    },
    walker: {
        ...COMMON_MONSTER,
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
        ...COMMON_MONSTER,
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
        },
    },
    tank_yellow: {
        ...COMMON_MONSTER,
        collision_mask: COLLISION.yellow_tank,
        pushes: COMMON_PUSHES,
        decide_movement(me, level) {
            if (me.pending_decision) {
                let decision = me.pending_decision;
                level._set_tile_prop(me, 'pending_decision', null);
                // Yellow tanks don't keep trying to move if blocked, but they DO turn regardless
                // XXX consider a compat flag; this is highly unintuitive to me
                level.set_actor_direction(me, decision);
                return [decision, null];
            }
            else {
                return null;
            }
        },
    },
    blob: {
        ...COMMON_MONSTER,
        movement_speed: 8,
        skip_decision_time_collision_check: true,
        decide_movement(me, level) {
            // move completely at random
            let d;
            if (level.compat.blobs_use_tw_prng) {
                d = level.tw_prng_random4();
            }
            else {
                let modifier = level.get_blob_modifier();
                d = (level.prng() + modifier) % 4;
            }
            return [DIRECTION_ORDER[d]];
        },
    },
    teeth: {
        ...COMMON_MONSTER,
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
        ...COMMON_MONSTER,
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
        ...COMMON_MONSTER,
        collision_mask: COLLISION.fireball,
        innate_traits: ACTOR_TRAITS.fireproof,
        decide_movement(me, level) {
            // turn right: preserve current direction; if that doesn't work, turn right, then left,
            // then back the way we came
            let d = DIRECTIONS[me.direction];
            return [me.direction, d.right, d.left, d.opposite];
        },
    },
    glider: {
        ...COMMON_MONSTER,
        // also doesn't cause turtles to disappear, but we don't have a trait for just that
        innate_traits: ACTOR_TRAITS.waterproof,
        decide_movement(me, level) {
            // turn left: preserve current direction; if that doesn't work, turn left, then right,
            // then back the way we came
            let d = DIRECTIONS[me.direction];
            return [me.direction, d.left, d.right, d.opposite];
        },
    },
    ghost: {
        ...COMMON_MONSTER,
        collision_mask: COLLISION.ghost,
        item_pickup_priority: PICKUP_PRIORITIES.normal,
        // Ghosts:
        // - are blocked by steel and custom walls/floors, but very little else
        // - are blocked by water, unless they have flippers
        // - are blocked by lilypads, always
        // - do not activate swivels
        // - do not activate popwalls or set off mines
        // - are not affected by force floors
        // Unfortunately only a tiny bit of this behavior is available as traits.
        innate_traits: ACTOR_TRAITS.iceproof | ACTOR_TRAITS.forceproof | ACTOR_TRAITS.trackproof,
        ignores: new Set([
            'bomb', 'green_bomb',
            'water',
            'ice', 'ice_nw', 'ice_ne', 'ice_sw', 'ice_se', 'cracked_ice',
            //'force_floor_n', 'force_floor_s', 'force_floor_e', 'force_floor_w', 'force_floor_all',
            // Ghosts don't activate swivels or popwalls
            'popwall', 'swivel_nw', 'swivel_ne', 'swivel_se', 'swivel_sw',
            'hole', 'cracked_floor',
        ]),
        decide_movement(me, level) {
            // CC2 quirk: ghosts don't slide on ice, but they can't turn on it, either (and so they
            // get stuck on a steel wall if they have cleats!)
            if (me.cell.get_terrain().type.slide_mode === 'ice') {
                return [me.direction];
            }

            // turn left: preserve current direction; if that doesn't work, turn left, then right,
            // then back the way we came (same as glider)
            let d = DIRECTIONS[me.direction];
            return [me.direction, d.left, d.right, d.opposite];
        },
    },
    floor_mimic: {
        ...COMMON_MONSTER,
        movement_parity: 4,
        decide_movement: pursue_player,
    },
    rover: {
        ...COMMON_MONSTER,
        collision_mask: COLLISION.rover,
        item_pickup_priority: PICKUP_PRIORITIES.normal,
        can_reveal_walls: true,
        movement_speed: 8,
        movement_parity: 2,
        pushes: COMMON_PUSHES,
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
        // Red key is only picked up by players and doppelgangers
        layer: LAYERS.item,
        item_priority: PICKUP_PRIORITIES.player,
        is_item: true,
        is_key: true,
    },
    key_blue: {
        // Blue key is picked up by all actors except CC2 blocks
        layer: LAYERS.item,
        item_priority: PICKUP_PRIORITIES.always,
        is_item: true,
        is_key: true,
    },
    key_yellow: {
        layer: LAYERS.item,
        is_item: true,
        is_key: true,
        // FIXME ok this is ghastly
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_typical,
        item_priority: PICKUP_PRIORITIES.normal,
    },
    key_green: {
        layer: LAYERS.item,
        is_item: true,
        is_key: true,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_typical,
        item_priority: PICKUP_PRIORITIES.normal,
    },
    // Boots
    // TODO note: ms allows blocks to pass over tools
    cleats: {
        ...COMMON_TOOL,
        item_traits: ACTOR_TRAITS.iceproof,
    },
    suction_boots: {
        ...COMMON_TOOL,
        item_traits: ACTOR_TRAITS.forceproof,
    },
    fire_boots: {
        ...COMMON_TOOL,
        item_traits: ACTOR_TRAITS.fireproof,
    },
    flippers: {
        ...COMMON_TOOL,
        item_traits: ACTOR_TRAITS.waterproof,
    },
    hiking_boots: {
        ...COMMON_TOOL,
        item_traits: ACTOR_TRAITS.dirtproof,
    },
    // Other tools
    dynamite: {
        ...COMMON_TOOL,
        on_depart(me, level, other) {
            if (! other.type.is_real_player)
                return;
            if (me.cell.get_item_mod())
                return;

            // Dynamite inherits a copy of the player's inventory, which largely doesn't matter
            // except for suction boots, helmet, lightning bolt, and fire boots; keys can't matter
            // because dynamite is blocked by doors.
            // (Do this before the transmute so that the traits get recomputed.)
            if (other.toolbelt) {
                level._set_tile_prop(me, 'toolbelt', [...other.toolbelt]);
            }
            // XXX wiki just says about 4.3 seconds; more likely this is exactly 255 frames (and
            // there haven't been any compat problems so far...)
            level._set_tile_prop(me, 'timer', 85);
            level.transmute_tile(me, 'dynamite_lit');
            // Actors are expected to have this, so populate it
            level._set_tile_prop(me, 'movement_cooldown', 0);
            level.add_actor(me);
            // Dynamite that lands on a force floor is moved by it, and dynamite that lands on a
            // button holds it down
            // TODO is there anything this should NOT activate?
            level.step_on_cell(me, me.cell);
        },
    },
    dynamite_lit: {
        layer: LAYERS.actor,
        is_actor: true,
        is_monster: true,
        collision_mask: COLLISION.block_cc1,
        blocks_collision: COLLISION.all,
        item_pickup_priority: PICKUP_PRIORITIES.always,
        movement_speed: 4,
        // FIXME especially for buttons, destroyed actors should on_depart -- even cc2 appears to do this!
        decide_movement(me, level) {
            level._set_tile_prop(me, 'timer', me.timer - 1);
            if (me.timer > 0)
                return null;

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

                        // Terrain is transmuted afterwards; VFX are left alone; actors are killed
                        // after the loop (which also allows the glass block to safely drop an item)
                        if (tile.type.layer === LAYERS.terrain ||
                            tile.type.layer === LAYERS.actor ||
                            tile.type.layer === LAYERS.vfx)
                        {
                            continue;
                        }

                        // Anything else is destroyed
                        level.remove_tile(tile);
                        removed_anything = true;

                        // Canopy protects everything else
                        if (tile.type.name === 'canopy') {
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
                        if (terrain.type.name === 'steel' || terrain.type.name === 'socket' ||
                            terrain.type.name === 'logic_gate' || terrain.type.name === 'floor' ||
                            terrain.type.name === 'hole' || terrain.type.name === 'floor_ankh')
                        {
                            // do nothing
                        }
                        else if (terrain.type.name === 'cracked_floor') {
                            level.transmute_tile(terrain, 'hole');
                            removed_anything = true;
                        }
                        else {
                            // Super duper weird special case: both CC2 and LL precompute the wiring
                            // layout, and as a fun side effect, a destroyed blue teleporter becomes
                            // a floor tile that can genuinely conduct in all four directions.
                            // (The red teleporter, similarly, inhibits current.)
                            // This doesn't require any real logic changes, but for readability,
                            // inform the renderer.
                            if (terrain.type.wire_propagation_mode) {
                                level._set_tile_prop(terrain, 'wire_propagation_mode',
                                    terrain.type.wire_propagation_mode);
                            }
                            level.transmute_tile(terrain, 'floor');
                            removed_anything = true;
                        }
                    }

                    if (actor) {
                        level.kill_actor(actor, me, 'explosion');
                    }
                    else if (removed_anything && ! cell.get_actor()) {
                        level.spawn_animation(cell, 'explosion');
                    }
                    else {
                        // Extension: Show the entire blast radius every time
                        level.spawn_animation(cell, 'explosion_nb');
                    }
                }
            }

            return null;
        },
        visual_state(me) {
            // 0 1 2 3 4
            return Math.min(4, Math.max(0, Math.floor((me.timer ?? 0) / TICS_PER_SECOND)));
        },
    },
    bowling_ball: {
        ...COMMON_TOOL,
        on_drop(level) {
            return 'rolling_ball';
        },
    },
    rolling_ball: {
        layer: LAYERS.actor,
        is_actor: true,
        is_monster: true,
        can_reveal_walls: true,
        collision_mask: COLLISION.bowling_ball,
        blocks_collision: COLLISION.bowling_ball,
        item_pickup_priority: PICKUP_PRIORITIES.normal,
        // FIXME do i start moving immediately when dropped, or next turn?
        movement_speed: 4,
        decide_movement(me, level) {
            return [me.direction];
        },
        on_approach(me, level, other) {
            // Blow up anything that runs into us
            level.kill_actor(other, me, 'explosion');
            level.kill_actor(me, me, 'explosion', 'bomb');
        },
        on_blocked(me, level, direction, obstacle) {
            // Blow up anything we run into
            if (obstacle && obstacle.type.is_actor) {
                level.kill_actor(obstacle, me, 'explosion');
            }
            else if (me.current_slide_mode || me._clone_release) {
                // Sliding bowling balls don't blow up if they hit a regular wall, and neither do
                // bowling balls in the process of being released from a cloner
                return;
            }
            level.sfx.play_once('bomb', me.cell);
            level.transmute_tile(me, 'explosion');
        },
    },
    xray_eye: {
        ...COMMON_TOOL,
        item_traits: ACTOR_TRAITS.perceptive,
    },
    helmet: {
        ...COMMON_TOOL,
        item_traits: ACTOR_TRAITS.invulnerable,
    },
    railroad_sign: {
        ...COMMON_TOOL,
        item_traits: ACTOR_TRAITS.trackproof,
    },
    foil: {
        ...COMMON_TOOL,
        item_traits: ACTOR_TRAITS.foiled,
    },
    lightning_bolt: {
        ...COMMON_TOOL,
        item_traits: ACTOR_TRAITS.charged | ACTOR_TRAITS.shockproof,
    },
    speed_boots: {
        ...COMMON_TOOL,
        item_traits: ACTOR_TRAITS.hasty,
    },
    bribe: {
        ...COMMON_TOOL,
    },
    hook: {
        ...COMMON_TOOL,
        item_traits: ACTOR_TRAITS.adhesive,
    },
    skeleton_key: {
        ...COMMON_TOOL,
    },
    ankh: {
        ...COMMON_TOOL,
        on_depart(me, level, other) {
            let terrain = me.cell.get_terrain();
            if (other.type.is_real_player && terrain && terrain.type.name === 'floor' &&
                terrain.wire_directions === 0 && terrain.wire_tunnel_directions === 0)
            {
                if (level.ankh_tile) {
                    level.transmute_tile(level.ankh_tile, 'floor');
                    level.spawn_animation(level.ankh_tile.cell, 'puff');
                }
                level.ankh_tile = terrain;
                level.transmute_tile(terrain, 'floor_ankh');
                // TODO some kinda vfx + sfx
                level.remove_tile(me);
            }
        },
    },
    floor_ankh: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.all_but_real_player,
    },

    // Progression
    player: {
        layer: LAYERS.actor,
        is_actor: true,
        is_player: true,
        is_real_player: true,
        collision_mask: COLLISION.real_player1,
        blocks_collision: COLLISION.all,
        item_pickup_priority: PICKUP_PRIORITIES.real_player,
        can_reveal_walls: true,
        movement_speed: 4,
        pushes: COMMON_PUSHES,
        infinite_items: {
            key_green: true,
        },
        on_ready(me, level) {
            if (! level.compat.no_auto_convert_ccl_items_under_players &&
                level.stored_level.format === 'ccl')
            {
                // CCL: If the player starts out on an item and normal floor, change the floor to
                // dirt so they're protected from monsters.  This preserves the CC1 behavior (items
                // block monsters) in a way that's compatible with CC2 rules.
                // This fixes CCLP4 #142 Stratagem.
                let item = me.cell.get_item();
                let terrain = me.cell.get_terrain();
                if (terrain && terrain.type.name === 'floor' && ! terrain.wire_directions &&
                    item && ((item.type.blocks_collision ?? 0) & COLLISION.monster_typical) &&
                    ! (level.compat.monsters_ignore_keys && item.type.is_key))
                {
                    terrain.type = TILE_TYPES['dirt'];
                }
            }
        },
        visual_state: player_visual_state,
    },
    player2: {
        layer: LAYERS.actor,
        is_actor: true,
        is_player: true,
        is_real_player: true,
        collision_mask: COLLISION.real_player2,
        blocks_collision: COLLISION.all,
        item_pickup_priority: PICKUP_PRIORITIES.real_player,
        can_reveal_walls: true,
        movement_speed: 4,
        innate_traits: ACTOR_TRAITS.iceproof,
        pushes: COMMON_PUSHES,
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
        blocks_collision: COLLISION.all,
        skip_decision_time_collision_check: true,
        item_pickup_priority: PICKUP_PRIORITIES.player,
        can_reveal_walls: true,  // XXX i think?
        movement_speed: 4,
        pushes: COMMON_PUSHES,
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
        blocks_collision: COLLISION.all,
        skip_decision_time_collision_check: true,
        item_pickup_priority: PICKUP_PRIORITIES.player,
        can_reveal_walls: true,  // XXX i think?
        movement_speed: 4,
        innate_traits: ACTOR_TRAITS.iceproof,
        pushes: COMMON_PUSHES,
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
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_typical,
        item_priority: PICKUP_PRIORITIES.real_player,
        check_toll(me, level, other) {
            // Increasing the chips-remaining counter is always fine
            return true;
        },
        take_toll(me, level, other) {
            level.uncollect_chip(me);
        },
        on_pickup(me, level, other) {
            level.collect_chip(me);
            return true;
        },
    },
    chip_extra: {
        layer: LAYERS.item,
        is_chip: true,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_typical,
        item_priority: PICKUP_PRIORITIES.real_player,
        check_toll(me, level, other) {
            // Increasing the chips-remaining counter is always fine
            return true;
        },
        take_toll(me, level, other) {
            level.uncollect_chip(me);
        },
        on_pickup(me, level, other) {
            level.collect_chip(me);
            return true;
        },
    },
    score_10: _define_bonus(10),
    score_100: _define_bonus(100),
    score_1000: _define_bonus(1000),
    score_2x: _define_bonus(0, 2),
    score_5x: _define_bonus(0, 5),

    hint: {
        layer: LAYERS.terrain,
        is_hint: true,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_typical,
        populate_defaults(me) {
            me.hint_text = null;  // optional, may use level's hint instead
        },
    },
    socket: {
        layer: LAYERS.terrain,
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_typical,
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
        blocks_collision: COLLISION.block_cc1 | COLLISION.monster_typical,
        on_arrive(me, level, other) {
            if (other.type.is_real_player) {
                level.remaining_players -= 1;
                if (level.remaining_players > 0) {
                    if (other === level.player) {
                        level.swap_player1 = true;
                    }
                    level.sfx.play_once('exit', me.cell);
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
        // If anything but a player even /considers/ stepping on an animation, it's erased, at
        // decision time!
        on_bumped(me, level, other) {
            if (! other.type.is_real_player) {
                level.remove_tile(me);
            }
        },
    },
    explosion: {
        layer: LAYERS.actor,
        is_actor: true,
        collision_mask: 0,
        blocks_collision: COLLISION.real_player,
        ttl: 16,
        on_bumped(me, level, other) {
            if (! other.type.is_real_player) {
                level.remove_tile(me);
            }
        },
    },
    // Non-blocking splash used for visual effect in MS
    splash_nb: {
        layer: LAYERS.vfx,
        is_actor: true,
        collision_mask: 0,
        ttl: 16,
    },
    // Non-blocking explosion used for better handling edge cases with dynamite and bowling balls,
    // without changing gameplay
    explosion_nb: {
        layer: LAYERS.vfx,
        is_actor: true,
        collision_mask: 0,
        ttl: 16,
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
        on_bumped(me, level, other) {
            if (! other.type.is_real_player) {
                level.remove_tile(me);
            }
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
    fall: {
        layer: LAYERS.vfx,
        is_actor: true,
        collision_mask: 0,
        ttl: 4 * 3 + 1,
    },
    resurrection: {
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

    if (type.is_actor) {
        if (type.collision_mask === undefined)
            console.error(`Tile type ${name} is an actor but has no collision mask`);

        if (type.ttl === undefined && type.item_pickup_priority === undefined)
            console.error(`Tile type ${name} is an actor but has no item pickup priority`);
    }

    if (type.is_item) {
        if (type.item_priority === undefined)
            console.error(`Tile type ${name} is an item but has no item priority`);
    }

    // Add a .connects_from, used only by the editor
    if (type.connects_to) {
        for (let other_name of type.connects_to) {
            let other = TILE_TYPES[other_name];
            if (! other.connects_from) {
                other.connects_from = new Set;
            }
            other.connects_from.add(name);
        }
    }
}

export default TILE_TYPES;
