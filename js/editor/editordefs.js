import { DIRECTIONS } from '../defs.js';
import TILE_TYPES from '../tiletypes.js';

import * as mouseops from './mouseops.js';

export const TOOLS = {
    pencil: {
        icon: 'icons/tool-pencil.png',
        name: "Pencil",
        desc: "Place, erase, and select tiles.\nLeft click: draw\nCtrl: erase\nShift: replace all layers\nRight click: pick foreground tile\nCtrl-right click: pick background tile",
        uses_palette: true,
        op1: mouseops.PencilOperation,
        op2: mouseops.EyedropOperation,
        shortcut: 'b',
    },
    line: {
        // TODO not implemented
        icon: 'icons/tool-line.png',
        name: "Line",
        desc: "Draw straight lines",
        uses_palette: true,
        shortcut: 'l',
    },
    box: {
        // TODO not implemented
        icon: 'icons/tool-box.png',
        name: "Box",
        desc: "Fill a rectangular area with tiles",
        uses_palette: true,
        shortcut: 'u',
    },
    fill: {
        icon: 'icons/tool-fill.png',
        name: "Fill",
        desc: "Flood-fill an area with tiles",
        uses_palette: true,
        op1: mouseops.FillOperation,
        op2: mouseops.EyedropOperation,
        shortcut: 'g',
    },
    select_box: {
        icon: 'icons/tool-select-box.png',
        name: "Box select",
        desc: "Select and manipulate rectangles.",
        affects_selection: true,
        op1: mouseops.SelectOperation,
        shortcut: 'm',
    },
    'force-floors': {
        icon: 'icons/tool-force-floors.png',
        name: "Force floors",
        desc: "Draw force floors following the cursor.",
        op1: mouseops.ForceFloorOperation,
    },
    tracks: {
        icon: 'icons/tool-tracks.png',
        name: "Tracks",
        desc: "Draw tracks following the cursor.\nLeft click: Lay tracks\nCtrl-click: Erase tracks\nRight click: Toggle track switch",
        op1: mouseops.TrackOperation,
        op2: mouseops.TrackOperation,
    },
    adjust: {
        icon: 'icons/tool-adjust.png',
        name: "Adjust",
        desc: "Edit existing tiles.\nLeft click: rotate actor or toggle terrain\nRight click: rotate or toggle in reverse\nShift: always target terrain\nCtrl-click: edit properties of complex tiles\n(wires, railroads, hints, etc.)",
        op1: mouseops.AdjustOperation,
        op2: mouseops.AdjustOperation,
        shortcut: 'a',
    },
    connect: {
        icon: 'icons/tool-connect.png',
        name: "Connect",
        // XXX shouldn't you be able to drag the destination?
        // TODO mod + right click for RRO or diamond alg?  ah but we only have ctrl available
        // ok lemme think then
        // left drag: create a new connection (supported connections only)
        // ctrl-click: erase all connections
        // shift-drag: create a new connection (arbitrary cells)
        // right drag: move a connection endpoint
        // ctrl-right drag: move the other endpoint (if a cell is both source and dest)
        desc: "Set up CC1-style clone and trap connections.\n(WIP)\nNOTE: Not supported in CC2!\nRight click: auto link using Lynx rules",
        //desc: "Set up CC1-style clone and trap connections.\nNOTE: Not supported in CC2!\nLeft drag: link button with valid target\nCtrl-click: erase link\nRight click: auto link using Lynx rules",
        op1: mouseops.ConnectOperation,
        op2: mouseops.ConnectOperation,
    },
    wire: {
        icon: 'icons/tool-wire.png',
        name: "Wire",
        desc: "Edit CC2 wiring.\nLeft click: draw wires\nCtrl-click: erase wires\nRight click: toggle tunnels (floor only)",
        op1: mouseops.WireOperation,
        op2: mouseops.WireOperation,
    },
    camera: {
        icon: 'icons/tool-camera.png',
        name: "Camera",
        desc: "Draw and edit custom camera regions",
        help: "Draw and edit camera regions.\n(LL only.  When the player is within a camera region,\nthe camera stays locked inside it.)\nLeft click: create or edit a region\nRight click: erase a region",
        op1: mouseops.CameraOperation,
        op2: mouseops.CameraEraseOperation,
    },
    // TODO text tool; thin walls tool; ice tool; map generator?; subtools for select tool (copy, paste, crop)
    // TODO interesting option: rotate an actor as you draw it by dragging?  or hold a key like in
    // slade when you have some selected?
    // TODO ah, railroads...
};
export const TOOL_ORDER = ['pencil', 'select_box', 'fill', 'adjust', 'force-floors', 'tracks', 'connect', 'wire', 'camera'];
export const TOOL_SHORTCUTS = {};
for (let [tool, tooldef] of Object.entries(TOOLS)) {
    if (tooldef.shortcut) {
        TOOL_SHORTCUTS[tooldef.shortcut] = tool;
    }
}

// TODO this MUST use a LL tileset!
export const PALETTE = [{
    title: "Basics",
    tiles: [
        'player', 'player2', 'hint',
        'floor', 'wall', 'thin_walls/south',
        'chip', 'chip_extra', 'socket', 'exit',
    ],
}, {
    title: "Terrain",
    tiles: [
        'popwall',
        'steel',
        'wall_invisible',
        'wall_appearing',
        'fake_floor',
        'fake_wall',
        'popdown_floor',
        'popdown_wall',

        'floor_letter',
        'gravel',
        'dirt',
        'slime',
        'thief_keys',
        'thief_tools',
        'no_player1_sign',
        'no_player2_sign',

        'floor_custom_green', 'floor_custom_pink', 'floor_custom_yellow', 'floor_custom_blue',
        'wall_custom_green', 'wall_custom_pink', 'wall_custom_yellow', 'wall_custom_blue',

        'door_blue', 'door_red', 'door_yellow', 'door_green',
        'swivel_nw',
        'railroad/straight',
        'railroad/curve',
        'railroad/switch',

        'water', 'turtle', 'fire',
        'ice', 'ice_nw',
        'force_floor_s', 'force_floor_all',
        'canopy',
    ],
}, {
    title: "Items",
    tiles: [
        'key_blue', 'key_red', 'key_yellow', 'key_green',
        'flippers', 'fire_boots', 'cleats', 'suction_boots',
        'hiking_boots', 'speed_boots', 'lightning_bolt', 'railroad_sign',
        'helmet', 'foil', 'hook', 'xray_eye',
        'bribe', 'bowling_ball', 'dynamite', 'no_sign',
        'score_10', 'score_100', 'score_1000', 'score_2x',
    ],
}, {
    title: "Creatures",
    tiles: [
        'tank_blue',
        'tank_yellow',
        'ball',
        'walker',
        'fireball',
        'glider',
        'bug',
        'paramecium',

        'doppelganger1',
        'doppelganger2',
        'teeth',
        'teeth_timid',
        'floor_mimic',
        'ghost',
        'rover',
        'blob',
    ],
}, {
    title: "Mechanisms",
    tiles: [
        'dirt_block',
        'ice_block',
        'frame_block/0',
        'frame_block/1',
        'frame_block/2a',
        'frame_block/2o',
        'frame_block/3',
        'frame_block/4',

        'green_floor',
        'green_wall',
        'green_chip',
        'green_bomb',
        'button_green',
        'button_blue',
        'button_yellow',
        'bomb',

        'button_red', 'cloner',
        'button_brown', 'trap',
        'button_orange', 'flame_jet_off', 'flame_jet_on',
        'transmogrifier',

        'teleport_blue',
        'teleport_red',
        'teleport_green',
        'teleport_yellow',
        'stopwatch_bonus',
        'stopwatch_penalty',
        'stopwatch_toggle',
    ],
    // TODO missing:
    // - wires, wire tunnels        probably a dedicated tool, placing tunnels like a tile makes no sense
    // - canopy                     normal tile; layering problem
    // - thin walls                 special rotate logic, like force floors; layering problem
    // TODO should tiles that respond to wiring and/or gray buttons be highlighted, highlightable?
}, {
    title: "Logic",
    tiles: [
        'logic_gate/not',
        'logic_gate/and',
        'logic_gate/or',
        'logic_gate/xor',
        'logic_gate/nand',
        'logic_gate/latch-cw',
        'logic_gate/latch-ccw',
        'logic_gate/counter',
        'button_pink',
        'button_black',
        'light_switch_off',
        'light_switch_on',
        'purple_floor',
        'purple_wall',
        'button_gray',
    ],
}, {
    title: "Experimental",
    tiles: [
        'circuit_block/xxx',
        'gift_bow',
        'skeleton_key',
        'gate_red',
        'gate_blue',
        'gate_yellow',
        'gate_green',
        'sand',
        'dash_floor',
        'spikes',
        'cracked_ice',
        'hole',
        'cracked_floor',
        'turntable_cw',
        'turntable_ccw',
        'teleport_blue_exit',
        'electrified_floor',
        'ankh',
        'score_5x',
        'boulder',
        'glass_block',
        'logic_gate/diode',
        'sokoban_block/red',
        'sokoban_button/red',
        'sokoban_wall/red',
        'sokoban_block/blue',
        'sokoban_button/blue',
        'sokoban_wall/blue',
        'sokoban_block/green',
        'sokoban_button/green',
        'sokoban_wall/green',
        'sokoban_block/yellow',
        'sokoban_button/yellow',
        'sokoban_wall/yellow',
        'one_way_walls/south',
    ],
}];

// Palette entries that aren't names of real tiles, but pre-configured ones.  The faux tile names
// listed here should generally be returned from the real tile's pick_palette_entry()
export const SPECIAL_PALETTE_ENTRIES = {
    'thin_walls/south':     { name: 'thin_walls', edges: DIRECTIONS['south'].bit },
    'frame_block/0':        { name: 'frame_block', direction: 'south', arrows: new Set },
    'frame_block/1':        { name: 'frame_block', direction: 'north', arrows: new Set(['north']) },
    'frame_block/2a':       { name: 'frame_block', direction: 'north', arrows: new Set(['north', 'east']) },
    'frame_block/2o':       { name: 'frame_block', direction: 'south', arrows: new Set(['north', 'south']) },
    'frame_block/3':        { name: 'frame_block', direction: 'south', arrows: new Set(['north', 'east', 'south']) },
    'frame_block/4':        { name: 'frame_block', direction: 'south', arrows: new Set(['north', 'east', 'south', 'west']) },
    // FIXME need to handle entered_direction intelligently, but also allow setting it explicitly
    'railroad/straight':    { name: 'railroad', tracks: 1 << 5, track_switch: null, entered_direction: 'north' },
    'railroad/curve':       { name: 'railroad', tracks: 1 << 0, track_switch: null, entered_direction: 'north' },
    'railroad/switch':      { name: 'railroad', tracks: 0, track_switch: 0, entered_direction: 'north' },
    'logic_gate/not':       { name: 'logic_gate', direction: 'north', gate_type: 'not' },
    'logic_gate/diode':     { name: 'logic_gate', direction: 'north', gate_type: 'diode' },
    'logic_gate/and':       { name: 'logic_gate', direction: 'north', gate_type: 'and' },
    'logic_gate/or':        { name: 'logic_gate', direction: 'north', gate_type: 'or' },
    'logic_gate/xor':       { name: 'logic_gate', direction: 'north', gate_type: 'xor' },
    'logic_gate/nand':      { name: 'logic_gate', direction: 'north', gate_type: 'nand' },
    'logic_gate/latch-cw':  { name: 'logic_gate', direction: 'north', gate_type: 'latch-cw' },
    'logic_gate/latch-ccw': { name: 'logic_gate', direction: 'north', gate_type: 'latch-ccw' },
    'logic_gate/counter':   { name: 'logic_gate', direction: 'north', gate_type: 'counter', memory: 0 },
    'circuit_block/xxx':    { name: 'circuit_block', direction: 'south', wire_directions: 0xf },
    'sokoban_block/red':    { name: 'sokoban_block', color: 'red' },
    'sokoban_button/red':   { name: 'sokoban_button', color: 'red' },
    'sokoban_wall/red':     { name: 'sokoban_wall', color: 'red' },
    'sokoban_block/blue':   { name: 'sokoban_block', color: 'blue' },
    'sokoban_button/blue':  { name: 'sokoban_button', color: 'blue' },
    'sokoban_wall/blue':    { name: 'sokoban_wall', color: 'blue' },
    'sokoban_block/yellow': { name: 'sokoban_block', color: 'yellow' },
    'sokoban_button/yellow':{ name: 'sokoban_button', color: 'yellow' },
    'sokoban_wall/yellow':  { name: 'sokoban_wall', color: 'yellow' },
    'sokoban_block/green':  { name: 'sokoban_block', color: 'green' },
    'sokoban_button/green': { name: 'sokoban_button', color: 'green' },
    'sokoban_wall/green':   { name: 'sokoban_wall', color: 'green' },
    'one_way_walls/south':  { name: 'one_way_walls', edges: DIRECTIONS['south'].bit },
};

// Editor-specific tile properties.  Every tile has a help entry, but some complex tiles have extra
// editor behavior as well
export const TILE_DESCRIPTIONS = {
    // Basics
    player: {
        name: "Lexy",
        cc2_name: "Chip",
        desc: "The player, a fox girl who enjoys puzzles.  Slides on ice.  Can walk on dirt and gravel.  Reuses green keys.",
    },
    player2: {
        name: "Cerise",
        cc2_name: "Melinda",
        desc: "The player, a gel rabbat who enjoys Lexy.  Walks on ice.  Stopped by dirt and gravel.  Reuses yellow keys.",
        min_version: 2,
    },
    hint: {
        name: "Hint",
        desc: "Shows a hint or message of the level designer's choosing.  Stops dirt blocks and monsters.",
    },
    floor: {
        name: "Floor",
        desc: "Plain floor.  No effect.  May contain wires; conducts power in all directions, except that two crossed wires are independent.  May contain wire tunnels, which conduct power across long distances.",
    },
    wall: {
        name: "Wall",
        desc: "Plain wall.  Stops almost everything.",
    },
    thin_walls: {
        name: "Thin wall",
        desc: "Similar to a wall, but squeezed into the edges.",
    },
    chip: {
        name: "Heart",
        cc2_name: "Chip",
        desc: "Goal of most levels.  Must be collected to open the heart socket.  Stops dirt blocks and most monsters, except rovers.",
    },
    chip_extra: {
        name: "Extra heart",
        cc2_name: "Extra chip",
        desc: "Appears and acts like a heart, but doesn't contribute to the level's required heart count.",
    },
    socket: {
        name: "Socket",
        desc: "Can only be opened when the required number of hearts has been collected.  Stops dirt blocks and most monsters, except rovers, but can be opened by anything else.  Not affected by ghosts.",
    },
    exit: {
        name: "Exit",
        desc: "All players must step on one to clear the level.  Stops dirt blocks and most monsters, except rovers.",
    },

    // Terrain
    popwall: {
        name: "Popwall",
        desc: "Turns into a wall when something steps off of it.  Stops dirt blocks and monsters.",
    },
    steel: {
        name: "Steel wall",
        desc: "Stops everything, even ghosts.  May contain wires; conducts power the same way as floor.",
    },
    wall_invisible: {
        name: "Invisible wall",
        desc: "Reveals briefly when bumped, then disappears again.",
    },
    wall_appearing: {
        name: "Reveal wall",
        desc: "Turns into a normal wall when bumped.",
    },
    fake_floor: {
        name: "Illusory floor",
        desc: "Looks like an illusory wall, but turns to floor when bumped.  Stops dirt blocks and monsters.",
    },
    fake_wall: {
        name: "Illusory wall",
        desc: "Turns to wall when bumped.",
    },
    popdown_floor: {
        name: "Popdown floor",
        desc: "Presses down into floor while something's on it.  Stops all blocks.",
    },
    popdown_wall: {
        name: "Fake popdown floor",
        desc: "Looks like a popdown floor, but acts like a normal wall.",
    },
    floor_letter: {
        name: "Letter tile",
        desc: "Acts like a normal floor.  May contain a single letter, number, arrow, or symbol.",
    },
    gravel: {
        name: "Gravel",
        desc: "Stops monsters.  Stops Cerise (and Doppel-Cerise) unless she has hiking boots.",
    },
    dirt: {
        name: "Dirt",
        desc: "Stops monsters.  Stops Cerise (and Doppel-Cerise) unless she has hiking boots.  Turns to floor when stepped on.",
    },
    slime: {
        name: "Slime",
        desc: "Destroys almost everything.  Blobs are unaffected and spread it to neighboring floor.  Cleared by blocks (except frame blocks, which are destroyed) without harming the block.",
    },
    thief_keys: {
        name: "Key thief",
        desc: "Steals all colored keys from a player that steps on it, and cuts bonus points in half.  Prefers to take a bribe, and will take one from anything.",
    },
    thief_tools: {
        name: "Tool thief",
        desc: "Steals all boots and other tools from a player that steps on it, and cuts bonus points in half.  Prefers to take a bribe, and will take one from anything.",
    },
    no_player1_sign: {
        name: "'No foxes' sign",
        desc: "Stops Lexy (and Doppel-Lexy).  No other effect.",
    },
    no_player2_sign: {
        name: "'No bunnies' sign",
        desc: "Stops Cerise (and Doppel-Cerise).  No other effect.",
    },
    floor_custom_green: {
        name: "Custom floor",
        desc: "Decorative.  Acts like normal floor, but stops ghosts.",
    },
    floor_custom_red: {
        name: "Custom floor",
        desc: "Decorative.  Acts like normal floor, but stops ghosts.",
    },
    floor_custom_yellow: {
        name: "Custom floor",
        desc: "Decorative.  Acts like normal floor, but stops ghosts.",
    },
    floor_custom_blue: {
        name: "Custom floor",
        desc: "Decorative.  Acts like normal floor, but stops ghosts.",
    },
    wall_custom_green: {
        name: "Custom wall",
        desc: "Decorative.  Acts like normal wall, but stops ghosts.",
    },
    wall_custom_red: {
        name: "Custom wall",
        desc: "Decorative.  Acts like normal wall, but stops ghosts.",
    },
    wall_custom_yellow: {
        name: "Custom wall",
        desc: "Decorative.  Acts like normal wall, but stops ghosts.",
    },
    wall_custom_blue: {
        name: "Custom wall",
        desc: "Decorative.  Acts like normal wall, but stops ghosts.",
    },
    door_blue: {
        name: "Blue door",
        desc: "Requires a blue key.  Turns to floor when opened.  Stops dirt blocks and monsters that don't normally collect items, even if they have a key.",
    },
    door_red: {
        name: "Red door",
        desc: "Requires a red key.  Turns to floor when opened.  Stops dirt blocks and monsters that don't normally collect items, even if they have a key.",
    },
    door_yellow: {
        name: "Yellow door",
        desc: "Requires a yellow key.  Turns to floor when opened.  Stops dirt blocks and monsters that don't normally collect items, even if they have a key.",
    },
    door_green: {
        name: "Green door",
        desc: "Requires a green key.  Turns to floor when opened.  Stops dirt blocks and monsters that don't normally collect items, even if they have a key.",
    },
    swivel_nw: {
        name: "Swivel door",
        desc: "Cannot be entered from the barred sides.  Rotates when something leaves through a barred side.",
    },
    railroad: {
        name: "Railroad track",
        desc: "Anything on it may move at its leisure, but only in legal directions along the track, unless it has a railroad crossing sign.  Only blocks may go back the way they came.  Attempts to move in illegal directions will be redirected.  May contain multiple track pieces, allowing a choice of which way to go.  With a track switch, only one track piece may be used at a time, and the active piece will change every time something leaves the track.  If connected to wire, the track will instead only switch when receiving a pulse.  Gray buttons can switch the track either way.",
    },
    water: {
        name: "Water",
        desc: "Drowns players and most monsters, unless they have a mermaid tail.  Turns dirt blocks into dirt, ice blocks into ice, and frame blocks into floor.  Gliders may pass freely.  Stops ghosts, unless they have a mermaid tail.",
    },
    turtle: {
        name: "Lilypad",
        cc2_name: "Turtle",
        desc: "May be passed safely, but turns to water when something steps off of it.  Stops ghosts.",
    },
    fire: {
        name: "Fire",
        desc: "Destroys players, unless they have fire boots.  Stops most monsters, even with fire boots.  No effect on fireballs.  Erased by ghosts with fire boots.  Turns ice blocks to water.",
    },
    ice: {
        name: "Ice",
        desc: "Causes anything that steps on it to slide uncontrollably, unless it has ice cleats.  Anything that hits an obstacle while on ice will turn around and slide back the other way.  No effect on Cerise (or Doppel-Cerise).",
    },
    ice_nw: {
        name: "Ice corner",
        desc: "Acts like ice, but turns anything sliding on it around the corner.  Edges act like thin walls.",
    },
    force_floor_n: {
        name: "Force floor",
        desc: "Slides anything on it in the indicated direction, unless it has suction boots.  Players may attempt to step off, but not on their first slide.  No effect on ghosts.",
    },
    force_floor_all: {
        name: "All-way force floor",
        desc: "Acts like force floor, but cycles clockwise through directions.  This cycle is shared between every all-way force floor in the level.",
    },
    canopy: {
        name: "Canopy",
        desc: "Hides everything beneath it from view, unless the player has the x-ray glasses.  Stops beetles and rovers.  Blobs under a canopy may not move to an adjacent canopy.",
    },

    // Items
    key_blue: {
        name: "Blue key",
        desc: "Opens blue locks.  Picked up by monsters and dirt blocks.",
    },
    key_red: {
        name: "Red key",
        desc: "Opens red locks.  Never picked up by anything besides a player.",
    },
    key_yellow: {
        name: "Yellow key",
        desc: "Opens yellow locks.  Stops dirt blocks and monsters (except rovers).",
    },
    key_green: {
        name: "Green key",
        desc: "Opens green locks.  Stops dirt blocks and monsters (except rovers).",
    },
    flippers: {
        name: "Mermaid tail",
        cc2_name: "Flippers",
        desc: "Allows safe passage through water.",
    },
    fire_boots: {
        name: "Fire boots",
        desc: "Allows safe passage through fire.",
    },
    cleats: {
        name: "Ice cleats",
        desc: "Allows walking normally on ice.",
    },
    suction_boots: {
        name: "Suction boots",
        desc: "Allows walking normally on force floors.",
    },
    hiking_boots: {
        name: "Hiking boots",
        desc: "Allows Cerise to walk on gravel and dirt.  Causes ghosts to turn dirt to floor.  No effect for other monsters.",
    },
    speed_boots: {
        name: "Speed boots",
        desc: "Causes the owner to move at double speed.",
    },
    lightning_bolt: {
        name: "Lightning boots",
        desc: "Powers any wires the owner is standing on.",
    },
    railroad_sign: {
        name: "RR crossing sign",
        desc: "Allows free movement on railroad tracks.",
    },
    helmet: {
        name: "Helmet",
        desc: "Prevents monsters or sliding blocks from hitting a player, or a player from walking into a monster.",
    },
    foil: {
        name: "Steel foil",
        desc: "Causes the owner to turn walls into steel walls when bumping them.",
    },
    hook: {
        name: "Hook",
        desc: "Causes the owner to pull blocks when moving directly away from them.",
    },
    xray_eye: {
        name: "X-ray glasses",
        cc2_name: "Secret eye",
        desc: "Reveals invisible walls, reveal walls, fake floors, popdown floors, floor mimics, and anything underneath dirt blocks, ice blocks, or canopies to the player.  No effect for anything else.",
    },
    bribe: {
        name: "Bribe",
        desc: "Stolen by thieves instead of anything else.",
    },
    bowling_ball: {
        name: "Bowling ball",
        desc: "When dropped, rolls in a straight line until it hits something.  Destroys objects it hits.  Picks up items it encounters.",
    },
    dynamite: {
        name: "Time bomb",
        cc2_name: "Dynamite",
        desc: "Can only be lit by a player.  A few seconds after being dropped, destroys everything in a 5×5 circle around it.  Canopies protect anything underneath; objects protect the floor they're on (including objects on a clone machine); steel walls, sockets, and logic gates cannot be destroyed; anything else becomes fire.",
    },
    no_sign: {
        name: "'No' sign",
        desc: "When placed over an item, stops anything holding that item.  When empty, has no effect, but an item may be dropped beneath it.",
    },
    score_10: {
        name: "+10 bonus",
        desc: "Grants the player 10 bonus points.  Can be collected by doppelgangers, rovers, and bowling balls, but will not grant bonus points.",
    },
    score_100: {
        name: "+100 bonus",
        desc: "Grants the player 100 bonus points.  Can be collected by doppelgangers, rovers, and bowling balls, but will not grant bonus points.",
    },
    score_1000: {
        name: "+1000 bonus",
        desc: "Grants the player 1000 bonus points.  Can be collected by doppelgangers, rovers, and bowling balls, but will not grant bonus points.",
    },
    score_2x: {
        name: "×2 bonus",
        desc: "Doubles the player's current bonus points.  Can be collected by doppelgangers, rovers, and bowling balls, but will not grant bonus points.",
    },

    // Creatures
    tank_blue: {
        name: "Blue tank",
        desc: "Only moves forwards.  Reverses direction when a blue button is pressed.",
    },
    tank_yellow: {
        name: "Yellow tank",
        desc: "Idles.  Moves one step in the corresponding direction when a yellow d-pad is pressed.",
    },
    ball: {
        name: "Bouncy ball",
        desc: "Turns around when it hits something.",
    },
    walker: {
        name: "Walker",
        desc: "Turns in a random direction when it hits something.",
    },
    fireball: {
        name: "Fireball",
        cc2_name: "Fire box",
        desc: "Turns right when it hits something.  Can safely pass through fire and flame jets.  Melts ice blocks.",
    },
    glider: {
        name: "Glider",
        cc2_name: "Ship",
        desc: "Turns left when it hits something.  Can safely cross water.",
    },
    bug: {
        name: "Beetle",
        cc2_name: "Ant",
        desc: "Follows the left wall.",
    },
    paramecium: {
        name: "Millipede",
        cc2_name: "Centipede",
        desc: "Follows the right wall.",
    },
    doppelganger1: {
        name: "Doppel-Lexy",
        cc2_name: "Mirror Chip",
        desc: "Copies Lexy's movements.  Does almost anything Lexy can do: collect items, push blocks, pass through tiles that block monsters, etc.  Cannot collect hearts.",
    },
    doppelganger2: {
        name: "Doppel-Cerise",
        cc2_name: "Mirror Melinda",
        desc: "Copies Cerise's movements.  Does almost anything Cerise can do: collect items, push blocks, walk normally on ice, pass through tiles that block monsters (but not dirt or gravel), etc.  Cannot collect hearts.",
    },
    teeth: {
        name: "Red chomper",
        cc2_name: "Angry teeth",
        desc: "Chases after Lexy.  Runs away from Cerise.  Pauses after each step.",
    },
    teeth_timid: {
        name: "Blue chomper",
        cc2_name: "Timid teeth",
        desc: "Chases after Cerise.  Runs away from Lexy.  Pauses after each step.",
    },
    floor_mimic: {
        name: "Floor mimic",
        desc: "Looks just like floor, except when moving.  Chases after the player.  Pauses after each step.",
    },
    ghost: {
        name: "Ghost",
        desc: "Turns left when it hits something.  Passes freely through almost all obstacles except blocks and other monsters, steel walls, water, lilypads, and custom floors/walls.  Does not set off mines.  Collects items and opens doors.  With fire boots, erases fire it steps on.  With flippers, can pass through water, but not lilypads.  Can only be destroyed by flame jets, bowling balls, and dynamite.",
    },
    rover: {
        name: "Rover",
        desc: "Cycles through the behavior of other monsters.  Collects items and pushes blocks.  Moves at half speed.",
    },
    blob: {
        name: "Blob",
        desc: "Moves in a random direction with every step.  Moves at half speed.",
    },

    // Mechanisms
    dirt_block: {
        name: "Dirt block",
        desc: "Can be pushed, but only one at a time.  Resists fire.  Turns to dirt in water.",
    },
    ice_block: {
        name: "Ice block",
        desc: "Can be pushed.  Pushes any ice block or frame block ahead of it.  Turns to water in fire.  Turns to ice in water.",
    },
    frame_block: {
        name: "Frame block",
        desc: "Can be pushed, but only in the directions given by the arrows.  Pushes any other kind of block ahead of it.  Can be moved in other directions by ice, force floors, etc.  Rotates when moved along a curved railroad track.",
    },
    green_floor: {
        name: "Toggle floor",
        desc: "Acts like a normal floor.  Becomes toggle wall when a green button is pressed.",
    },
    green_wall: {
        name: "Toggle wall",
        desc: "Acts like a normal wall.  Becomes toggle floor when a green button is pressed.",
    },
    green_chip: {
        name: "Toggle heart",
        cc2_name: "Toggle chip",
        desc: "Acts like a normal heart.  Counts toward the level's required hearts.  Becomes a toggle mine when a green button is pressed.",
    },
    green_bomb: {
        name: "Toggle mine",
        cc2_name: "Toggle bomb",
        desc: "Acts like a normal mine.  Counts toward the level's required hearts.  Becomes a toggle heart when a green button is pressed.",
    },
    button_green: {
        name: "Green button",
        desc: "Exchanges toggle floors with toggle walls, and toggle hearts with toggle mines.",
    },
    button_blue: {
        name: "Blue button",
        desc: "Reverses the direction of blue tanks.",
    },
    button_yellow: {
        name: "Yellow d-pad",
        cc2_name: "Yellow button",
        desc: "Moves yellow tanks one step in the direction it was stepped on.",
    },
    bomb: {
        name: "Mine",
        cc2_name: "Red bomb",
        desc: "Detonates and destroys anything that steps on it.",
    },
    button_red: {
        name: "Red button",
        desc: "Activates the nearest clone machine, searching left to right, top to bottom.",
    },
    cloner: {
        name: "Clone machine",
        desc: "When activated, creates a duplicate of whatever's on it.  Activated by a red button or a wire pulse.  If activated by wire and something's in the way, tries cloning in other directions.  When empty, can be populated by blocks (except dirt blocks), doppelgängers, ghosts, or rolling bowling balls.",
    },
    button_brown: {
        name: "Brown button",
        desc: "Opens the nearest trap while held down, searching left to right, top to bottom.  Anything freed is immediately spat out in the direction it's facing.",
    },
    trap: {
        name: "Trap",
        desc: "Prevents anything from leaving unless held open.  May be held open by a brown button or wire current.  Trapped monsters cannot turn, but a trapped player can.",
    },
    button_orange: {
        name: "Orange button",
        desc: "Toggles the state of the nearest flame jet while held down, searching outwards in a diamond pattern.",
    },
    flame_jet_off: {
        name: "Flame jet (off)",
        desc: "No effect.  Turned on while a linked orange button is held.  Toggled permanently by a pulse or a gray button.",
    },
    flame_jet_on: {
        name: "Flame jet (on)",
        desc: "Destroys almost anything that passes over it, except dirt blocks, fireballs, and anything wearing fire boots.  Turned off while a linked orange button is held.  Toggled permanently by a pulse or a gray button.",
    },
    transmogrifier: {
        name: "Transmogrifier",
        desc: "Changes most objects into corresponding opposites: Lexy ↔ Cerise, Doppel-Lexy ↔ Doppel-Cerise, dirt block ↔ ice block, bouncy ball ↔ walker, fireball → beetle → glider → millipede → fireball, blue tank ↔ yellow tank, red chomper ↔ blue chomper, blob → one of most monsters chosen at random.  If connected to wire, only functions while receiving power.",
    },
    teleport_blue: {
        name: "Blue teleporter",
        desc: "Teleports a traveller to the nearest available blue teleporter, searching right to left, bottom to top.  Only searches for exits in the direction the traveller entered.  If connected to wire, will only consider other teleporters on the same circuit (searching one-way through logic gates).  May contain wires; conducts power in all four directions.",
    },
    teleport_red: {
        name: "Red teleporter",
        desc: "Teleports a traveller to the nearest available red teleporter, searching left to right, top to bottom.  Searches for exits in any direction.  Allows players to exit in a direction of their choice.  If connected to wire, will only connect to other red teleporters while receiving power.  May contain wires, but does not conduct power.",
    },
    teleport_yellow: {
        name: "Yellow teleporter",
        desc: "Teleports a traveller to the nearest available yellow teleporter, searching right to left, bottom to top.  Only searches for exits in the direction the traveller entered.  Allows players to exit in a direction of their choice.  If no exit is available, will be picked up like an item, and can be dropped on any floor tile.",
    },
    teleport_green: {
        name: "Green teleporter",
        desc: "Teleports a traveller to a green teleporter chosen at random.  Chooses an available exit direction at random, but if the chosen destination has none, the teleport will fail.",
    },
    stopwatch_bonus: {
        name: "Time bonus",
        desc: "Adds ten seconds to the clock.  An untimed level becomes timed, with ten seconds remaining.",
    },
    stopwatch_penalty: {
        name: "Time penalty",
        desc: "Subtracts ten seconds from the clock.  If less than ten seconds remain, the clock will be reduced to its minimum, and the player will fail immediately if the clock is not paused.  An untimed level becomes timed and fails immediately.",
    },
    stopwatch_toggle: {
        name: "Stopwatch",
        desc: "Pauses or unpauses the clock.  No effect on untimed levels.",
    },

    // Logic
    'logic_gate/not': {
        name: "NOT gate",
        desc: "Emits power only when not receiving power.",
    },
    'logic_gate/diode': {
        name: "Diode",
        desc: "Emits power only when receiving power. (Effectively, this delays power by one frame.)",
    },
    'logic_gate/and': {
        name: "AND gate",
        desc: "Emits power while both inputs are receiving power.",
    },
    'logic_gate/or': {
        name: "OR gate",
        desc: "Emits power while at least one input is receiving power.",
    },
    'logic_gate/xor': {
        name: "XOR gate",
        desc: "Emits power while exactly one input is receiving power.",
    },
    'logic_gate/nand': {
        name: "NAND gate",
        desc: "Emits power while fewer than two inputs are receiving power.",
    },
    'logic_gate/latch-cw': {
        name: "Latch (clockwise)",
        desc: "Remembers its input and produces output to match.  Input is remembered while the chevron input is receiving power, ignored otherwise.",
    },
    'logic_gate/latch-ccw': {
        name: "Latch (counter clockwise)",
        desc: "Remembers its input and produces output to match.  Input is remembered while the chevron input is receiving power, ignored otherwise.",
    },
    'logic_gate/counter': {
        name: "Counter",
        desc: "Remembers and displays a single decimal digit.  Counts up by 1 when it receives a pulse on its right edge; if it wraps around to 0, emits a brief pulse out its left edge.  Counts down by 1 when it receives a pulse on its bottom edge; if it wraps around to 9, emits power from its top edge until it next receives power on its right or bottom edge.  Cannot be rotated.",
    },
    button_pink: {
        name: "Pink button",
        desc: "Emits power while held down.  May contain wires, but does not conduct power.",
    },
    button_black: {
        name: "Black button",
        desc: "Emits power while not held down.  May contain wires; conducts power separately along horizontal and vertical wires.",
    },
    light_switch_off: {
        name: "Light switch (off)",
        desc: "No effect.  Turns on when stepped on.  May contain wires.",
    },
    light_switch_on: {
        name: "Light switch (on)",
        desc: "Emits power.  Turns off when stepped on.  May contain wires.",
    },
    purple_floor: {
        name: "Switch floor",
        desc: "Acts like a normal floor.  Becomes switch wall while receiving power, or permanently when affected by a gray button.",
    },
    purple_wall: {
        name: "Switch wall",
        desc: "Acts like a normal wall.  Becomes switch floor while receiving power, or permanently when affected by a gray button.",
    },
    button_gray: {
        name: "Gray button",
        desc: "Permanently toggles the state of tiles in a surrounding 5×5 square.  Rotates swivels clockwise; switches railroad tracks; flips force floors; exchanges toggle walls/floors (but not hearts/mines); exchanges switch walls/floors; activates cloners as if by a red button; and toggles flame jets.",
    },

    // Experimental
    circuit_block: {
        name: "Circuit block",
        desc: "May contain wires, which will connect to any adjacent wires and conduct power as normal. When pushed into water, turns into floor with the same wires.",
    },
    gift_bow: {
        name: "Gift bow",
        desc: "When placed atop an item, anything may step on the item and will pick it up, even if it normally could not do so.  When placed alone, has no effect, but an item may be dropped beneath it.",
    },
    skeleton_key: {
        name: "Skeleton key",
        desc: "Counts as a tool, not a key.  Opens any color lock if the owner lacks a matching key.",
    },
    gate_red: {
        name: "Red gate",
        desc: "Requires a red key.  Unlike doors, may be placed on top of other terrain, and any actor with the key may unlock it.",
    },
    sand: {
        name: "Sand",
        desc: "Anything walking on it moves at half speed.  Stops all blocks.",
    },
    ankh: {
        name: "Ankh",
        desc: "When dropped on empty floor by a player, inscribes a sacred symbol which will save a player's life once.",
    },
    turntable_cw: {
        name: "Turntable (clockwise)",
        desc: "Rotates anything entering this tile clockwise. Frame blocks are rotated too. If connected to wire, only functions while receiving power.",
    },
    turntable_ccw: {
        name: "Turntable (counterclockwise)",
        desc: "Rotates anything entering this tile counterclockwise. Frame blocks are rotated too. If connected to wire, only functions while receiving power.",
    },
    electrified_floor: {
        name: "Electrified floor",
        desc: "Conducts power (like a 4-way wire). While powered, destroys anything not wearing lightning boots (except dirt blocks).",
    },
    hole: {
        name: "Hole",
        desc: "A bottomless pit. Destroys everything (except ghosts).",
    },
    cracked_floor: {
        name: "Cracked floor",
        desc: "Turns into a hole when something steps off of it (except ghosts).",
    },
    cracked_ice: {
        name: "Cracked ice",
        desc: "Turns into water when something steps off of it (except ghosts).",
    },
    score_5x: {
        name: "×5 bonus",
        desc: "Quintuples the player's current bonus points.  Can be collected by doppelgangers, rovers, and bowling balls, but will not grant bonus points.",
    },
    spikes: {
        name: "Spikes",
        desc: "Stops players (and doppelgangers) unless they have hiking boots. Everything else can pass.",
    },
    boulder: {
        name: "Boulder",
        desc: "Similar to a dirt block, but rolls when pushed. Boulders transfer momentum to each other. Has ice block/frame block collision. Turns into gravel in water. Spreads slime.",
    },
    dash_floor: {
        name: "Dash floor",
        desc: "Anything walking on it moves at double speed. Stacks with speed shoes!",
    },
    teleport_blue_exit: {
        name: "Blue teleporter exit",
        desc: "A blue teleporter for all intents and purposes except it can only be exited, not entered.",
    },
    glass_block: {
        name: "Glass block",
        desc: "Similar to a dirt block, but stores the first item it moves over, dropping it when destroyed and cloning it in a cloning machine. Has ice block/frame block collision. Turns into floor in water. Doesn't have dirt block immunities.",
    },
    sokoban_block: {
        name: "Sokoban block",
        desc: "Similar to a dirt block.  Turns to colored floor in water.  Can't pass over colored floor of a different color.  Has no effect on sokoban buttons of a different color.",
    },
    sokoban_button: {
        name: "Sokoban button",
        desc: "Changes sokoban walls of the same color to floor, but only while all buttons of the same color are held.  Not affected by sokoban blocks of a different color.",
    },
    sokoban_wall: {
        name: "Sokoban wall",
        desc: "Acts like wall.  Turns to floor while all sokoban buttons of the same color are pressed.",
    },
};


export function transform_direction_bitmask(bits, dirprop) {
    let new_bits = 0;
    for (let dirinfo of Object.values(DIRECTIONS)) {
        if (bits & dirinfo.bit) {
            new_bits |= DIRECTIONS[dirinfo[dirprop]].bit;
        }
    }
    return new_bits;
}

// Editor-specific tile properties.
// - pick_palette_entry: given a tile, return the palette key to select when it's eyedropped
// - adjust_forward, adjust_backward: alterations that can be made with the adjust tool or ,/. keys,
//   but that aren't real rotations (and thus aren't used for rotate/flip/etc)
// - rotate_left, rotate_right, flip, mirror: transform a tile
// - combine_draw, combine_erase: special handling for composite tiles, when drawing or erasing
//   using a 'pristine' tile chosen from the palette
// All the tile modification functions edit in-place with no undo support; that's up to the caller.
export const SPECIAL_TILE_BEHAVIOR = {
    floor_letter: {
        _arrows: ["⬆", "➡", "⬇", "⬅"],
        adjust_backward(tile) {
            // Rotate through arrows and ASCII separately
            let arrow_index = this._arrows.indexOf(tile.overlaid_glyph);
            if (arrow_index >= 0) {
                tile.overlaid_glyph = this._arrows[(arrow_index + 3) % 4];
                return;
            }

            let cp = tile.overlaid_glyph.charCodeAt(0);
            cp -= 1;
            if (cp < 32) {
                cp = 95;
            }
            tile.overlaid_glyph = String.fromCharCode(cp);
        },
        adjust_forward(tile) {
            let arrow_index = this._arrows.indexOf(tile.overlaid_glyph);
            if (arrow_index >= 0) {
                tile.overlaid_glyph = this._arrows[(arrow_index + 1) % 4];
                return;
            }

            let cp = tile.overlaid_glyph.charCodeAt(0);
            cp += 1;
            if (cp > 95) {
                cp = 32;
            }
            tile.overlaid_glyph = String.fromCharCode(cp);
        },
        // TODO rotate arrows at least
    },
    thin_walls: {
        pick_palette_entry() {
            return 'thin_walls/south';
        },
        rotate_left(tile) {
            tile.edges = transform_direction_bitmask(tile.edges, 'left');
        },
        rotate_right(tile) {
            tile.edges = transform_direction_bitmask(tile.edges, 'right');
        },
        mirror(tile) {
            tile.edges = transform_direction_bitmask(tile.edges, 'mirrored');
        },
        flip(tile) {
            tile.edges = transform_direction_bitmask(tile.edges, 'flipped');
        },
        combine_draw(palette_tile, existing_tile) {
            existing_tile.edges |= palette_tile.edges;
        },
        combine_erase(palette_tile, existing_tile) {
            existing_tile.edges &= ~palette_tile.edges;
            if (existing_tile.edges === 0)
                return true;
        },
    },
    frame_block: {
        pick_palette_entry(tile) {
            if (tile.arrows.size === 2) {
                let [a, b] = tile.arrows.keys();
                if (a === DIRECTIONS[b].opposite) {
                    return 'frame_block/2o';
                }
                else {
                    return 'frame_block/2a';
                }
            }
            else {
                return `frame_block/${tile.arrows.size}`;
            }
        },
        _transform(tile, dirprop) {
            tile.direction = DIRECTIONS[tile.direction][dirprop];
            tile.arrows = new Set(Array.from(tile.arrows, arrow => DIRECTIONS[arrow][dirprop]));
        },
        rotate_left(tile) {
            this._transform(tile, 'left');
        },
        rotate_right(tile) {
            this._transform(tile, 'right');
        },
        mirror(tile) {
            this._transform(tile, 'mirrored');
        },
        flip(tile) {
            this._transform(tile, 'flipped');
        },
    },
    logic_gate: {
        pick_palette_entry(tile) {
            return `logic_gate/${tile.gate_type}`;
        },
        adjust_backward(tile) {
            if (tile.gate_type === 'counter') {
                tile.memory = (tile.memory + 9) % 10;
            }
            else {
                tile.direction = DIRECTIONS[tile.direction].left;
            }
        },
        adjust_forward(tile) {
            if (tile.gate_type === 'counter') {
                tile.memory = (tile.memory + 1) % 10;
            }
            else {
                tile.direction = DIRECTIONS[tile.direction].right;
            }
        },
        // Note that the counter gate can neither rotate nor flip
        rotate_left(tile) {
            if (tile.gate_type !== 'counter') {
                tile.direction = DIRECTIONS[tile.direction].left;
            }
        },
        rotate_right(tile) {
            if (tile.gate_type !== 'counter') {
                tile.direction = DIRECTIONS[tile.direction].right;
            }
        },
        mirror(tile) {
            if (tile.gate_type === 'counter')
                return;

            if (tile.gate_type === 'latch_cw') {
                tile.gate_type = 'latch_ccw';
            }
            else if (tile.gate_type === 'latch_ccw') {
                tile.gate_type = 'latch_cw';
            }

            tile.direction = DIRECTIONS[tile.direction].mirrored;
        },
        flip(tile) {
            if (tile.gate_type === 'counter')
                return;

            if (tile.gate_type === 'latch_cw') {
                tile.gate_type = 'latch_ccw';
            }
            else if (tile.gate_type === 'latch_ccw') {
                tile.gate_type = 'latch_cw';
            }

            tile.direction = DIRECTIONS[tile.direction].flipped;
        },
    },
    railroad: {
        pick_palette_entry(tile) {
            // This is a little fuzzy, since railroads are compound, but we just go with the first
            // one that matches and fall back to the switch if it's empty
            if (tile.tracks & 0x30) {
                return 'railroad/straight';
            }
            if (tile.tracks) {
                return 'railroad/curve';
            }
            return 'railroad/switch';
        },
        // track order: 0 NE, 1 SE, 2 SW, 3 NW, 4 EW, 5 NS
        _tracks_left: [3, 0, 1, 2, 5, 4],
        _tracks_right: [1, 2, 3, 0, 5, 4],
        _tracks_mirror: [3, 2, 1, 0, 4, 5],
        _tracks_flip: [1, 0, 3, 2, 4, 5],
        _transform_tracks(tile, track_mapping) {
            let new_tracks = 0;
            for (let i = 0; i < 6; i++) {
                if (tile.tracks & (1 << i)) {
                    new_tracks |= 1 << track_mapping[i];
                }
            }
            tile.tracks = new_tracks;

            if (tile.track_switch !== null) {
                tile.track_switch = track_mapping[tile.track_switch];
            }
        },
        rotate_left(tile) {
            this._transform_tracks(tile, this._tracks_left);

            if (tile.entered_direction) {
                tile.entered_direction = DIRECTIONS[tile.entered_direction].left;
            }
        },
        rotate_right(tile) {
            this._transform_tracks(tile, this._tracks_right);

            if (tile.entered_direction) {
                tile.entered_direction = DIRECTIONS[tile.entered_direction].right;
            }
        },
        mirror(tile) {
            this._transform_tracks(tile, this._tracks_mirror);

            if (tile.entered_direction) {
                tile.entered_direction = DIRECTIONS[tile.entered_direction].mirrored;
            }
        },
        flip(tile) {
            this._transform_tracks(tile, this._tracks_flip);

            if (tile.entered_direction) {
                tile.entered_direction = DIRECTIONS[tile.entered_direction].flipped;
            }
        },
        combine_draw(palette_tile, existing_tile) {
            existing_tile.tracks |= palette_tile.tracks;
            // If we have a switch already, the just-placed track becomes the current one
            if (existing_tile.track_switch !== null) {
                for (let i = 0; i < 6; i++) {
                    if (palette_tile.tracks & (1 << i)) {
                        existing_tile.track_switch = i;
                        break;
                    }
                }
            }

            if (palette_tile.track_switch !== null && existing_tile.track_switch === null) {
                // The palette's switch is just an indication that we should have one, not what it
                // ought to be
                existing_tile.track_switch = palette_tile.track_switch;
                for (let i = 0; i < 6; i++) {
                    if (existing_tile.tracks & (1 << i)) {
                        existing_tile.track_switch = i;
                        break;
                    }
                }
            }
        },
        combine_erase(palette_tile, existing_tile) {
            existing_tile.tracks &= ~palette_tile.tracks;

            // If there are no track pieces left, remove the railroad.  It's technically possible to
            // have a railroad with no tracks, but you're very unlikely to want it, and if you
            // really do then you can do it yourself
            if (existing_tile.tracks === 0)
                return true;

            if (palette_tile.track_switch !== null) {
                existing_tile.track_switch = null;
            }

            // Fix the track switch if necessary
            if (existing_tile.track_switch !== null) {
                let num_tracks = 0;
                for (let i = 0; i < 6; i++) {
                    if (existing_tile.tracks & (1 << i)) {
                        num_tracks += 1;
                        if (! (existing_tile.tracks & (1 << existing_tile.track_switch))) {
                            existing_tile.track_switch = i;
                        }
                    }
                }

                // Remove the switch if there's nothing to switch
                if (num_tracks <= 1) {
                    existing_tile.track_switch = null;
                }
            }
        },
    },
    circuit_block: {
        pick_palette_entry() {
            return 'circuit_block/xxx';
        },
    },
    sokoban_block: {
        pick_palette_entry(tile) {
            return 'sokoban_block/' + (tile.color ?? 'red');
        },
    },
    sokoban_button: {
        pick_palette_entry(tile) {
            return 'sokoban_button/' + (tile.color ?? 'red');
        },
    },
    sokoban_wall: {
        pick_palette_entry(tile) {
            return 'sokoban_wall/' + (tile.color ?? 'red');
        },
    },
    one_way_walls: {
        pick_palette_entry() {
            return 'one_way_walls/south';
        },
    },
};
SPECIAL_TILE_BEHAVIOR['one_way_walls'] = {
    ...SPECIAL_TILE_BEHAVIOR['thin_walls'],
    ...SPECIAL_TILE_BEHAVIOR['one_way_walls'],
};
// Fill in some special behavior that boils down to rotating tiles which happen to be encoded as
// different tile types
function add_special_tile_cycle(rotation_order, mirror_mapping, flip_mapping) {
    let names = new Set(rotation_order);

    // Make the flip and mirror mappings symmetrical
    for (let map of [mirror_mapping, flip_mapping]) {
        for (let [key, value] of Object.entries(map)) {
            names.add(key);
            names.add(value);
            if (! (value in map)) {
                map[value] = key;
            }
        }
    }

    for (let name of names) {
        let behavior = {};

        let i = rotation_order.indexOf(name);
        if (i >= 0) {
            let left = rotation_order[(i - 1 + rotation_order.length) % rotation_order.length];
            let right = rotation_order[(i + 1) % rotation_order.length];
            behavior.rotate_left = function rotate_left(tile) {
                tile.type = TILE_TYPES[left];
            };
            behavior.rotate_right = function rotate_right(tile) {
                tile.type = TILE_TYPES[right];
            };
        }

        if (name in mirror_mapping) {
            let mirror = mirror_mapping[name];
            behavior.mirror = function mirror(tile) {
                tile.type = TILE_TYPES[mirror];
            };
        }

        if (name in flip_mapping) {
            let flip = flip_mapping[name];
            behavior.flip = function flip(tile) {
                tile.type = TILE_TYPES[flip];
            };
        }

        SPECIAL_TILE_BEHAVIOR[name] = behavior;
    }
}

add_special_tile_cycle(
    ['force_floor_n', 'force_floor_e', 'force_floor_s', 'force_floor_w'],
    {force_floor_e: 'force_floor_w'},
    {force_floor_n: 'force_floor_s'},
);
add_special_tile_cycle(
    ['ice_nw', 'ice_ne', 'ice_se', 'ice_sw'],
    {ice_nw: 'ice_ne', ice_sw: 'ice_se'},
    {ice_nw: 'ice_sw', ice_ne: 'ice_se'},
);
add_special_tile_cycle(
    ['swivel_nw', 'swivel_ne', 'swivel_se', 'swivel_sw'],
    {swivel_nw: 'swivel_ne', swivel_sw: 'swivel_se'},
    {swivel_nw: 'swivel_sw', swivel_ne: 'swivel_se'},
);
add_special_tile_cycle(
    [],  // turntables don't rotate, but they do flip/mirror
    {turntable_cw: 'turntable_ccw'},
    {turntable_cw: 'turntable_ccw'},
);
