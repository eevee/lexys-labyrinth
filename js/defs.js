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
        label: "Blue walls under blocks are not auto-converted in CCL levels",
        rulesets: new Set(['steam-strict', 'lynx', 'ms']),
    }, {
        key: 'no_auto_convert_ccl_bombs',
        label: "Mines under actors are not auto-converted in CCL levels",
        rulesets: new Set(['steam-strict', 'lynx', 'ms']),
    }, {
        key: 'no_auto_convert_ccl_items_under_players',
        label: "Players starting on items are not auto-converted in CCL levels",
        rulesets: new Set(['steam-strict', 'lynx', 'ms']),
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
        key: 'tanks_always_obey_button',
        label: "Blue tanks obey blue buttons even on clone machines",
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
        key: 'emulate_spring_mining',
        label: "Pushing a block off a recessed wall might move you into the resulting wall (\"spring mining\")",
        rulesets: new Set(['steam-strict']),
    }, {
        key: 'no_early_push',
        label: "Pushing blocks happens at move time (block slapping is disabled)",
        // XXX uhhhh
        // 1. this does not disable block slapping
        // 2. actually nothing disables block slapping for ms currently
        // 3. it shouldn't disable block slapping bc it's a lynx compat flag
        rulesets: new Set(['lynx', 'ms']),
    }, {
        key: 'allow_pushing_blocks_off_faux_walls',
        label: "Blocks may be pushed (\"flicked\") off of illusory and reveal walls",
        rulesets: new Set(['lynx']),
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
        label: "Fake blue walls vanish when stepped on",
        rulesets: new Set(['lynx']),
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
