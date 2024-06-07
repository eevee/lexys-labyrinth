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
        mirrored: 'north',
        flipped: 'south',
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
        mirrored: 'south',
        flipped: 'north',
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
        mirrored: 'east',
        flipped: 'west',
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
        mirrored: 'west',
        flipped: 'east',
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
    bowling_ball:       0x0040,  // rolling ball, dynamite

    // Monsters are a little complicated, because some of them have special rules, e.g. fireballs
    // aren't blocked by fire.
    // For a monster's MASK, you should use ONLY ONE of these specific monster bits (if
    // appropriate), OR the generic bit -- DO NOT combine them!
    monster_generic:    0x0100,
    fireball:           0x0200,
    bug:                0x0400,
    yellow_tank:        0x0800,
    rover:              0x1000,
    ghost:              0x8000,
    // For a tile's COLLISION, use one of these bit combinations
    monster_typical:    0x6f00,  // everything but ghost and rover
    monster_any:        0xff00,  // everything including ghost (only used for monster/fire compat flag)

    // Combo masks used for matching
    all_but_ghost:          0xffff & ~0x8000,
    all_but_real_player:    0xffff & ~0x0003,
    all:                    0xffff,
};

// Item pickup priority, which both actors and items have.  An actor will pick up an item if the
// item's priority is greater than or equal to the actor's.
export const PICKUP_PRIORITIES = {
    never: 4,   // cc2 blocks, never pick anything up
    always: 3,  // all actors; blue keys, yellow teleporters (everything picks up except cc2 blocks)
    // TODO is this even necessary?  in cc2 the general rule seems to be that anything stepping on
    // an item picks it up, and collision is used to avoid that most of the time
    normal: 3,  // actors with inventories; most items
    player: 1,  // players and doppelgangers; red keys (ignored by everything else)
    real_player: 0,
};

export const ACTOR_TRAITS = {
    iceproof:           0x0001,
    forceproof:         0x0002,
    fireproof:          0x0004,
    waterproof:         0x0008,
    dirtproof:          0x0010,
    hasty:              0x0020,
    charged:            0x0040,
    trackproof:         0x0080,
    invulnerable:       0x0100,
    foiled:             0x0200,
    adhesive:           0x0400,
    perceptive:         0x0800,
    weightless:         0x1000,
    weighted:           0x2000,
    phasing:            0x4000,
    shockproof:         0x8000,
};

export const COMPAT_RULESET_LABELS = {
    lexy: "Lexy",
    steam: "Steam",
    'steam-strict': "Steam (strict)",
    lynx: "Lynx",
    ms: "Microsoft",
    custom: "Custom",
};
export const COMPAT_RULESET_ORDER = ['lexy', 'steam', 'steam-strict', 'lynx', 'ms', 'custom'];
// FIXME some of the names of the flags themselves kinda suck
// TODO some ms compat things that wouldn't be too hard to add:
// - walkers choose a random /unblocked/ direction, not just a random direction
// - (boosting) player cooldown is /zero/ after ending a slide
// - cleats allow walking through ice corner walls while standing on them
// - blocks can be pushed through thin walls + ice corners
export const COMPAT_FLAG_CATEGORIES = [{
    title: "Level loading",
    flags: [{
        key: 'no_auto_convert_ccl_popwalls',
        label: "Recessed walls under actors are not auto-converted in CCL levels",
        rulesets: new Set(['steam-strict', 'lynx', 'ms']),
    }, {
        key: 'no_auto_convert_ccl_blue_walls',
        label: "Illusory walls under blocks are not auto-converted in CCL levels",
        rulesets: new Set(['steam-strict', 'lynx', 'ms']),
    }, {
        key: 'no_auto_convert_ccl_bombs',
        label: "Mines under actors are not auto-converted in CCL levels",
        rulesets: new Set(['steam-strict', 'lynx', 'ms']),
    }, {
        key: 'no_auto_convert_ccl_items_under_players',
        label: "Players starting on items are not auto-converted in CCL levels",
        rulesets: new Set(['steam-strict', 'lynx', 'ms']),
    }, {
        key: 'no_auto_patches',
        label: "Don't apply individual level patches",
        rulesets: new Set(['steam', 'steam-strict', 'lynx', 'ms']),
    }],
}, {
    title: "Actor behavior",
    flags: [{
        key: 'emulate_60fps',
        label: "Actors update at 60 FPS",
        rulesets: new Set(['steam', 'steam-strict']),
    }, {
        key: 'no_separate_idle_phase',
        label: "Actors teleport immediately after moving",
        rulesets: new Set(['steam', 'steam-strict']),
    }, {
        key: 'allow_simultaneous_movement',
        label: "Two players can move at once, by switching while moving",
        rulesets: new Set(['steam-strict']),
    }, {
        key: 'allow_double_cooldowns',
        label: "Actors may move forwards twice in one tic",
        rulesets: new Set(['steam', 'steam-strict', 'lynx']),
    }, {
        key: 'simulate_teleport_stacking',
        label: "Actors can teleport into occupied blue teleporters",
        rulesets: new Set(['lynx']),
    }, {
        key: 'teleport_every_tic',
        label: "Actors try to teleport as long as they're on a teleporter",
        rulesets: new Set(['lynx']),
    }, {
        key: 'player_moves_last',
        label: "Players always update last",
        rulesets: new Set(['lynx']),
    }, {
        key: 'reuse_actor_slots',
        label: "New actors reuse slots in the actor list",
        rulesets: new Set(['lynx']),
    }, {
        key: 'player_protected_by_items',
        label: "Players can't be trampled while standing on items",
        rulesets: new Set(['lynx']),
    }, {
        key: 'force_lynx_animation_lengths',
        label: "Animations play at their slower Lynx duration",
        rulesets: new Set(['lynx']),
    }, {
        // Note that this requires no_early_push as well
        key: 'player_safe_at_decision_time',
        label: "Players can't be trampled at decision time",
        rulesets: new Set(['lynx', 'ms']),
    }, {
        key: 'bonking_isnt_instant',
        label: "Bonking while sliding doesn't apply instantly",
        rulesets: new Set(['lynx', 'ms']),
    }, {
        key: 'actors_move_instantly',
        label: "Movement is instant",
        rulesets: new Set(['ms']),
    }],
}, {
    title: "Monsters",
    flags: [{
    // TODO ms needs "player doesn't block monsters", but tbh that's kind of how it should work
    // anyway, especially in combination with the ankh
    // TODO? in lynx they ignore the button while in motion too
    // TODO what about in a trap, in every game??
    // TODO what does ms do when a tank is on ice or a ff?  wiki's description is wacky
    // TODO yellow tanks seem to have memory too??
        key: 'blue_tanks_reverse_on_cloners',
        label: "Blue tanks can turn around while on clone machines",
        rulesets: new Set(['steam-strict']),
    }, {
        key: 'tanks_ignore_button_while_moving',
        label: "Blue tanks ignore blue buttons while moving",
        rulesets: new Set(['lynx']),
    }, {
        key: 'blobs_use_tw_prng',
        label: "Blobs use the Lynx RNG",
        rulesets: new Set(['lynx']),
    }, {
        key: 'teeth_target_internal_position',
        label: "Teeth pursue the cell the player is moving into",
        rulesets: new Set(['lynx']),
    }, {
        key: 'teeth_fall_back_to_first_choice',
        label: "Teeth fall back to their first choice of direction when blocked",
        rulesets: new Set(['lynx']),
    }, {
        key: 'blue_tanks_reverse_in_traps',
        label: "Blue tanks can turn around while trapped",
        rulesets: new Set(['lynx', 'ms']),
    }, {
        key: 'rff_blocks_monsters',
        label: "Monsters cannot step on random force floors",
        rulesets: new Set(['ms']),
    }, {
        key: 'fire_allows_most_monsters',
        label: "Monsters can walk into fire, except for bugs and walkers",
        rulesets: new Set(['ms']),
    }],
}, {
    title: "Blocks",
    flags: [{
        key: 'use_legacy_hooking',
        label: "Pulling blocks with the hook happens earlier, and may prevent moving",
        rulesets: new Set(['steam', 'steam-strict']),
    }, {
        key: 'no_directly_pushing_sliding_blocks',
        label: "Pushing sliding blocks queues a move, rather than moving them right away",
        rulesets: new Set(['steam', 'steam-strict']),
    }, {
        key: 'emulate_salmon_run',
        label: "Creative use of a block can let you go the wrong way on force floors (\"salmon run\")",
        rulesets: new Set(['steam', 'steam-strict']),
    }, {
        key: 'emulate_spring_mining',
        label: "Pushing a block off a recessed wall might move you into the resulting wall (\"spring mining\")",
        rulesets: new Set(['steam-strict']),
    }, {
        key: 'allow_repushing_blocks',
        label: "Blocks may be pushed when they have a push already pending",
        rulesets: new Set(['lynx']),
    }, {
        key: 'allow_pushing_blocks_off_faux_walls',
        label: "Blocks may be pushed (\"flicked\") off of illusory and reveal walls",
        rulesets: new Set(['lynx']),
    }, {
        key: 'failed_push_changes_direction',
        label: "Failed push attempts still change a block's direction",
        rulesets: new Set(['lynx']),
    }, {
        key: 'no_early_push',
        label: "Blocks don't move until move time",
        rulesets: new Set(['lynx', 'ms']),
    }, {
        key: 'allow_pushing_blocks_off_all_walls',
        label: "Blocks may be pushed (\"flicked\") off of anything, even walls",
        rulesets: new Set(['ms']),
    }, {
        key: 'use_pgchip_ice_blocks',
        label: "Ice blocks use pgchip rules",
        rulesets: new Set(['ms']),
    }, {
        key: 'block_splashes_dont_block',
        label: "Block splashes don't block the player",
        rulesets: new Set(['ms']),
    }],
}, {
    title: "Terrain",
    flags: [{
        key: 'green_teleports_can_fail',
        label: "Green teleporters sometimes fail",
        rulesets: new Set(['steam-strict']),
    }, {
        key: 'no_backwards_override',
        label: "Players can't override backwards on a force floor",
        rulesets: new Set(['lynx']),
    }, {
        key: 'traps_like_lynx',
        label: "Traps eject faster, and eject when already open",
        rulesets: new Set(['lynx']),
    }, {
        key: 'blue_floors_vanish_on_arrive',
        label: "Illusory floors vanish when stepped on, not when approached",
        rulesets: new Set(['lynx']),
    }, {
        key: 'ignore_starting_on_force_floor',
        label: "Actors that start on force floors aren't initially affected by them",
        rulesets: new Set(['lynx', 'ms']),
    }, {
        // FIXME actually i'm not sure if this happens in cc2.  it never comes up!
        key: 'use_toggle_wall_prediction',
        label: "Toggle floors/walls change immediately",
        rulesets: new Set(['lynx', 'ms']),
    }, {
        key: 'popwalls_pop_on_arrive',
        label: "Recessed walls activate when stepped on",
        rulesets: new Set(['lynx', 'ms']),
    }, {
        key: 'rff_actually_random',
        label: "Random force floors are actually random",
        rulesets: new Set(['ms']),
    }],
}, {
    title: "Items",
    flags: [{
        key: 'cloned_bowling_balls_can_be_lost',
        label: "Bowling balls on cloners are destroyed when fired at point blank",
        rulesets: new Set(['steam-strict']),
    }, {
        // XXX is this necessary, with the addition of the dormant bomb?
        key: 'bombs_immediately_detonate_under_players',
        label: "Mines under players detonate when the level starts",
        rulesets: new Set(['steam-strict']),
    }, {
        key: 'keys_overflow_at_256',
        label: "Key counts overflow at 256",
        rulesets: new Set(['steam-strict', 'lynx']),
    }, {
        key: 'bombs_detonate_on_arrive',
        label: "Mines detonate only when stepped on",
        rulesets: new Set(['lynx', 'ms']),
    }, {
        key: 'monsters_ignore_keys',
        label: "Monsters completely ignore keys",
        rulesets: new Set(['ms']),
    }],
}];


export function compat_flags_for_ruleset(ruleset) {
    let compat = {};
    for (let category of COMPAT_FLAG_CATEGORIES) {
        for (let compatdef of category.flags) {
            if (compatdef.rulesets.has(ruleset)) {
                compat[compatdef.key] = true;
            }
        }
    }
    return compat;
}


// Fixes to the *geometry* of individual levels, identified by a hash of their contents only, that
// make them work under Lexy rules
export const LEVEL_PATCHES = {
    // CC1 #70 Nightmare
    // A contraption in the upper right has the player free a ball from a trap, which then clones a
    // fireball.  It relies on Lynx's forced trap ejection to keep the ball from cloning more than
    // one fireball, but that doesn't work in CC2.  (The Steam release modifies the level.)
    'fef1d27bdca5b16e62b46c7179406b68': [{
        // Same idea, but I don't want to move the red button because it'll mess up the DAT button
        // connections, so instead use a lilypad
        x: 30,
        y: 8,
        tiles: [{ type: 'turtle' }],
    }],
    // CCLXP2 #17 Double Trouble *
    // The player starts next to a glider on a trap, with a ball holding the trap open.  The glider
    // immediately runs the player over.  Under Lynx, the trap doesn't open, because the ball moves
    // off of it before its idle phase.
    '89aeb48274b323acbe0fbcca3b297629': [{
        // Erase the ball holding down the button
        x: 12,
        y: 16,
        tiles: [
            { type: 'button_brown' },
        ],
    }, {
        // Replace the ball one tile south, preserving the contraption but giving the player time to
        // escape before the glider is released
        x: 12,
        y: 17,
        tiles: [
            { type: 'button_red' },
            { type: 'ball', direction: 'north' },
        ],
    }],
    // CCLXP2 #53 Security Breach *
    // The level is based around a contraption that keeps pressing blue buttons at the right time to
    // stop a blue tank from pressing green buttons, which will softlock the level.  It's been
    // adapted to Lynx's goofy trap timing with a convoluted setup part, but ironically it's very
    // close to working without any of that — the only issue is that the ball pressing the brown
    // button needs to be slightly ahead of the ball that gets caught in the trap.
    '485c3f54024a2f41d65076b2a539cb32': [{
        // Drop the setup part, by erasing the extra ball that triggers it
        x: 30,
        y: 1,
        tiles: [{ type: 'floor' }],
    }, {
        // Move the top-left ball...
        x: 0,
        y: 0,
        tiles: [{ type: 'button_blue' }],
    }, {
        // ...to be in the trap from the beginning.
        x: 0,
        y: 2,
        tiles: [{ type: 'trap' }, { type: 'ball', direction: 'north' }],
    }, {
        // Move the central ball...
        x: 10,
        y: 6,
        tiles: [{ type: 'floor' }],
    }, {
        // ...one space down from the brown button, so the first thing it does is open the trap.
        // This will get the balls synchronized, with the upper-left one a tic behind.
        x: 10,
        y: 9,
        tiles: [{ type: 'floor' }, { type: 'ball', direction: 'north' }],
    }, {
        // Finally, move the tank...
        x: 4,
        y: 3,
        tiles: [{ type: 'floor' }],
    }, {
        // ...down one cell, to compensate for the delay.
        x: 4,
        y: 4,
        tiles: [{ type: 'green_floor' }, { type: 'tank_blue', direction: 'north' }],
    }],
    // CCLXP2 #120 Frost Rings LX
    // Uses a "block on a teleporter" trick to make the level only playable on Lynx, not MS.  Alas,
    // that makes it not playable on CC2, either.
    '622bbfefc25be596299ccf1fe59ada30': [{
        // Remove the block!
        x: 11,
        y: 11,
        tiles: [{ type: 'teleport_blue' }],
    }, {
        // And get rid of the spare teleporter that's meant to hold it.  Could erase the teleporter
        // itself, but it feels appropriate to just put the block in its cubby.
        x: 2,
        y: 28,
        tiles: [{ type: 'floor' }, { type: 'dirt_block', direction: 'north' }],
    }],
    // CCLP3 #94 Mistakes
    // There's a small hallway with a ball in it and a red key at one end.  You're supposed to duck
    // in, grab the key, and get out before the ball gets you.  This is just barely possible with
    // Lynx timing rules, but seems impossible under CC2 timing.
    '0177710b3b5807c87449118cdc4c2533': [{
        // Replace a wall with panel walls so the player can get out faster
        x: 14,
        y: 11,
        tiles: [
            { type: 'floor' },
            // The east wall isn't actually necessary, but it looks more deliberate
            { type: 'thin_walls', edges: DIRECTIONS.east.bit | DIRECTIONS.south.bit },
        ],
    }],
    // CCLP4 #50 Secret Underground Society
    // Starts out with a "desync blue tanks on ice" contraption, which of course won't work in CC2.
    '3dad0ce0242228127fe738d960e6320d': [{
        // Just sync the tanks from the start and the level otherwise works fine.
        // Do the second one, so the player still has to hit the button at least once.
        x: 10,
        y: 19,
        tiles: [{ type: 'floor' }, { type: 'tank_blue', direction: 'north' }],
    }],
    // CCLP4 #69 Ball in an Awkward Place
    // Past the two red doors near the beginning is a column of pink balls that spans a trap and
    // some mines.  Pressing the brown button blows two of them up and is /intended/ to jam the
    // other two in the trap and the tile below, but this relies on Lynx's forced ejection.
    // Replacing this with a force floor reversed by a pink button replicates the effect.
    'c7cefa66f2f75f051ff99f1a756f94d3': [{
        x: 11,
        y: 17,
        tiles: [{ type: 'button_pink', wire_directions: DIRECTIONS.north.bit }],
    }, {
        x: 11,
        y: 16,
        tiles: [{ type: 'floor', wire_directions: DIRECTIONS.north.bit | DIRECTIONS.south.bit }],
    }, {
        x: 11,
        y: 15,
        tiles: [{ type: 'floor', wire_directions: DIRECTIONS.north.bit | DIRECTIONS.south.bit }],
    }, {
        // This is the tile with the block and red key
        x: 11,
        y: 14,
        tiles: [
            { type: 'floor', wire_directions: DIRECTIONS.south.bit | DIRECTIONS.west.bit },
            { type: 'key_red' },
            { type: 'dirt_block', direction: 'north' },
        ],
    }, {
        x: 10,
        y: 14,
        tiles: [{ type: 'steel', wire_directions: DIRECTIONS.west.bit | DIRECTIONS.east.bit }],
    }, {
        x: 9,
        y: 14,
        tiles: [{ type: 'force_floor_n' }, { type: 'ball', direction: 'south' }],
    }],
};
