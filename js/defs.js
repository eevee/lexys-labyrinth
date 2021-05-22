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
export const COMPAT_FLAGS = [
// Level loading
// TODO? /strictly/ speaking, these should be turned on for lynx+ms/lynx respectively, but then i'd
// have to also alter the behavior of the corresponding terrain, which seems kind of silly
{
    key: 'no_auto_convert_ccl_popwalls',
    label: "Recessed walls under actors in CCL levels are left alone",
    rulesets: new Set(['steam-strict']),
}, {
    key: 'no_auto_convert_ccl_blue_walls',
    label: "Blue walls under blocks in CCL levels are left alone",
    rulesets: new Set(['steam-strict']),
},

// Core
{
    key: 'allow_double_cooldowns',
    label: "Actors may cooldown twice in one tic",
    rulesets: new Set(['steam', 'steam-strict', 'lynx']),
}, {
    key: 'no_separate_idle_phase',
    label: "Actors teleport immediately after moving",
    rulesets: new Set(['steam', 'steam-strict']),
}, {
    key: 'player_moves_last',
    label: "Player always moves last",
    rulesets: new Set(['lynx', 'ms']),
}, {
    key: 'player_protected_by_items',
    label: "Players can't be trampled when standing on items",
    rulesets: new Set(['lynx']),
}, {
    // Note that this requires no_early_push as well
    key: 'player_safe_at_decision_time',
    label: "Players can't be trampled at decision time",
    rulesets: new Set(['lynx']),
}, {
    key: 'emulate_60fps',
    label: "Game runs at 60 FPS",
    rulesets: new Set(['steam', 'steam-strict']),
}, {
    key: 'reuse_actor_slots',
    label: "Game reuses slots in the actor list",
    rulesets: new Set(['lynx']),
}, {
    key: 'force_lynx_animation_lengths',
    label: "Animations use Lynx duration",
    rulesets: new Set(['lynx']),
},

// Tiles
{
    // XXX this is goofy
    key: 'tiles_react_instantly',
    label: "Tiles react when approached",
    rulesets: new Set(['ms']),
}, {
    key: 'rff_actually_random',
    label: "Random force floors are actually random",
    rulesets: new Set(['ms']),
}, {
    key: 'no_backwards_override',
    label: "Player can't override backwards on a force floor",
    rulesets: new Set(['lynx']),
}, {
    key: 'force_floors_inert_on_first_tic',
    label: "Force floors don't trigger on the first tic",
    rulesets: new Set(['lynx', 'ms']),
}, {
    key: 'traps_like_lynx',
    label: "Traps eject faster, and even when already open",
    rulesets: new Set(['lynx']),
}, {
    key: 'blue_floors_vanish_on_arrive',
    label: "Fake blue walls vanish on arrival",
    rulesets: new Set(['lynx']),
}, {
    key: 'green_teleports_can_fail',
    label: "Green teleporters sometimes fail",
    rulesets: new Set(['steam-strict']),
},

// Items
{
    key: 'no_immediate_detonate_bombs',
    label: "Mines under non-player actors don't explode at level start",
    rulesets: new Set(['lynx', 'ms']),
}, {
    key: 'detonate_bombs_under_players',
    label: "Mines under players explode at level start",
    rulesets: new Set(['steam', 'steam-strict']),
}, {
    key: 'cloned_bowling_balls_can_be_lost',
    label: "Bowling balls on cloners are destroyed when fired at point blank",
    rulesets: new Set(['steam-strict']),
}, {
    key: 'monsters_ignore_keys',
    label: "Monsters completely ignore keys",
    rulesets: new Set(['ms']),
},

// Blocks
{
    key: 'no_early_push',
    label: "Pushing blocks happens at move time",
    rulesets: new Set(['lynx', 'ms']),
}, {
    key: 'use_legacy_hooking',
    label: "Pulling blocks with the hook happens at decision time",
    rulesets: new Set(['steam', 'steam-strict']),
}, {
    // FIXME this is kind of annoying, there are some collision rules too
    key: 'tanks_teeth_push_ice_blocks',
    label: "Ice blocks emulate pgchip rules",
    rulesets: new Set(['ms']),
}, {
    key: 'allow_pushing_blocks_off_faux_walls',
    label: "Blocks may be pushed off of blue (fake), invisible, and revealing walls",
    rulesets: new Set(['lynx']),
}, {
    key: 'emulate_spring_mining',
    label: "Spring mining is possible",
    rulesets: new Set(['steam-strict']),
/* XXX not implemented
}, {
    key: 'emulate_flicking',
    label: "Flicking is possible",
    rulesets: new Set(['ms']),
*/
},

// Monsters
{
    // TODO? in lynx they ignore the button while in motion too
    // TODO what about in a trap, in every game??
    // TODO what does ms do when a tank is on ice or a ff?  wiki's description is wacky
    // TODO yellow tanks seem to have memory too??
    key: 'tanks_always_obey_button',
    label: "Blue tanks always obey blue buttons",
    rulesets: new Set(['steam-strict']),
}, {
    key: 'tanks_ignore_button_while_moving',
    label: "Blue tanks ignore blue buttons while moving",
    rulesets: new Set(['lynx']),
}, {
    key: 'blobs_use_tw_prng',
    label: "Blobs use the Tile World RNG",
    rulesets: new Set(['lynx']),
}, {
    key: 'teeth_target_internal_position',
    label: "Teeth target the player's internal position",
    rulesets: new Set(['lynx']),
}, {
    key: 'rff_blocks_monsters',
    label: "Random force floors block monsters",
    rulesets: new Set(['ms']),
}, {
    key: 'bonking_isnt_instant',
    label: "Bonking while sliding doesn't apply instantly",
    rulesets: new Set(['lynx', 'ms']),
}, {
    key: 'fire_allows_monsters',
    label: "Fire doesn't block monsters",
    rulesets: new Set(['ms']),
},
];

export function compat_flags_for_ruleset(ruleset) {
    let compat = {};
    for (let compatdef of COMPAT_FLAGS) {
        if (compatdef.rulesets.has(ruleset)) {
            compat[compatdef.key] = true;
        }
    }
    return compat;
}
