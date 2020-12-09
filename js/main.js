// TODO bugs and quirks i'm aware of:
// - steam: if a player character starts on a force floor they won't be able to make any voluntary movements until they are no longer on a force floor
import { DIRECTIONS, TICS_PER_SECOND } from './defs.js';
import * as c2g from './format-c2g.js';
import * as dat from './format-dat.js';
import * as format_base from './format-base.js';
import { Level } from './game.js';
import { PrimaryView, Overlay, DialogOverlay, ConfirmOverlay } from './main-base.js';
import { Editor } from './main-editor.js';
import CanvasRenderer from './renderer-canvas.js';
import SOUNDTRACK from './soundtrack.js';
import { Tileset, CC2_TILESET_LAYOUT, LL_TILESET_LAYOUT, TILE_WORLD_TILESET_LAYOUT } from './tileset.js';
import TILE_TYPES from './tiletypes.js';
import { random_choice, mk, mk_svg, promise_event } from './util.js';
import * as util from './util.js';

const PAGE_TITLE = "Lexy's Labyrinth";

// TODO:
// - level password, if any
const ACTION_LABELS = {
    up: '⬆️\ufe0f',
    down: '⬇️\ufe0f',
    left: '⬅️\ufe0f',
    right: '➡️\ufe0f',
    drop: '🚮',
    cycle: '🔄',
    swap: '👫',
};
const ACTION_DIRECTIONS = {
    up: 'north',
    down: 'south',
    left: 'west',
    right: 'east',
};
const OBITUARIES = {
    drowned: [
        "you tried out water cooling",
        "you fell into the c",
    ],
    burned: [
        "your core temp got too high",
        "your plans went up in smoke",
    ],
    exploded: [
        "watch where you step",
        "looks like you're having a blast",
        "you tripped over something of mine",
        "you were blown to bits",
    ],
    squished: [
        "that block of ram was too much for you",
        "you became two-dimensional",
    ],
    time: [
        "you tried to overclock",
        "your time ran out",
        "your speedrun went badly",
    ],
    generic: [
        "you had a bad time",
    ],

    // Specific creatures
    ball: [
        "you're having a ball",
        "you'll bounce back from this",
    ],
    walker: [
        "you let it walk all over you",
        "step into, step over, step out",
    ],
    fireball: [
        "you had a meltdown",
        "you haven't been flamed like that since usenet",
    ],
    glider: [
        "your ship came in",
        "don't worry, everything's fin now",
    ],
    tank_blue: [
        "you didn't watch where they tread",
        "please and tank blue",
    ],
    tank_yellow: [
        "you let things get out of control",
        "you need more direction in your life",
        "your chances of surviving that were remote",
    ],
    bug: [
        "you got ants in your pants",
        "there's a bug in your code",
        "time for some debugging",
    ],
    paramecium: [
        "you got the creepy crawlies",
        "you couldn't wriggle out of that one",
    ],
    teeth: [
        "you got a mega bite",
        "you got a little nybble",
        "you're quite a mouthful",
        "if it helps, apparently you're delicious",
    ],
    blob: [
        "gooed job there",
        "blame the rng for that one",
        "goo another way next time",
    ],
};
// Helper class used to let the game play sounds without knowing too much about the Player
class SFXPlayer {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext);  // come the fuck on, safari
        // This automatically reduces volume when a lot of sound effects are playing at once
        this.compressor_node = this.ctx.createDynamicsCompressor();
        this.compressor_node.threshold.value = -40;
        this.compressor_node.ratio.value = 16;
        this.compressor_node.connect(this.ctx.destination);

        this.player_x = null;
        this.player_y = null;
        this.sounds = {};
        this.sound_sources = {
            // handcrafted
            blocked: 'sfx/mmf.ogg',
            // https://jummbus.bitbucket.io/#j2N04bombn110s0k0l00e00t3Mm4a3g00j07i0r1O_U00o30T0v0pL0OD0Ou00q1d1f8y0z2C0w2c0h2T2v0kL0OD0Ou02q1d1f6y1z2C1w1b4gp1b0aCTFucgds0
            bomb: 'sfx/bomb.ogg',
            // https://jummbus.bitbucket.io/#j2N0cbutton-pressn100s0k0l00e00t3Mm1a3g00j07i0r1O_U0o3T0v0pL0OD0Ou00q1d1f3y1z1C2w0c0h0b4p1bJdn51eMUsS0
            'button-press': 'sfx/button-press.ogg',
            // https://jummbus.bitbucket.io/#j2N0ebutton-releasen100s0k0l00e00t3Mm1a3g00j07i0r1O_U0o3T0v0pL0OD0Ou00q1d1f3y1z1C2w0c0h0b4p1aArdkga4sG0
            'button-release': 'sfx/button-release.ogg',
            // https://jummbus.bitbucket.io/#j2N04doorn110s0k0l00e00t3Mmfa3g00j07i0r1O_U00o30T0v0zL0OD0Ou00q0d1f8y0z2C0w2c0h0T2v0pL0OD0Ou02q0d1f8y3ziC0w1b4gp1f0aqEQ0lCNzrYUY0
            door: 'sfx/door.ogg',
            // https://jummbus.bitbucket.io/#j2N08get-chipn100s0k0l00e00t3Mmca3g00j07i0r1O_U0o4T0v0zL0OD0Ou00q1d1f6y1z2C0wac0h0b4p1dFyW7czgUK7aw0
            'get-chip': 'sfx/get-chip.ogg',
            // https://jummbus.bitbucket.io/#j2N07get-keyn100s0k0l00e00t3Mmfa3g00j07i0r1O_U0o5T0v0pL0OD0Ou00q1d5f8y0z2C0w1c0h0b4p1dFyW85CbwwzBg0
            'get-key': 'sfx/get-key.ogg',
            // https://jummbus.bitbucket.io/#j2N08get-tooln100s0k0l00e00t3Mm6a3g00j07i0r1O_U0o2T0v0pL0OD0Ou00q1d1f4y2z9C0w2c0h0b4p1bGqKNW4isVk0
            'get-tool': 'sfx/get-tool.ogg',
            // https://jummbus.bitbucket.io/#j2N06socketn110s0k0l00e00t3Mm4a3g00j07i0r1O_U00o30T5v0pL0OD0Ou05q1d1f8y1z7C1c0h0HU7000U0006000ET2v0pL0OD0Ou02q1d6f5y3z2C0w0b4gp1xGoKHGhFBcn2FyPkxk0rE2AGcNCQyHwUY0
            socket: 'sfx/socket.ogg',
            // https://jummbus.bitbucket.io/#j2N06splashn110s0k0l00e00t3Mm5a3g00j07i0r1O_U00o20T0v0pL0OD0Ou00q0d0fay0z0C0w9c0h8T2v05L0OD0Ou02q2d6fay0z1C0w0b4gp1lGqKQy02gUY1qh7D1wb2Y0
            // https://jummbus.bitbucket.io/#j2N06splashn110s0k0l00e00t3Mm5a3g00j07i0r1O_U00o20T0v0pL0OD0Ou00q0d0fay0z0C0w9c0h8T2v05L0OD0Ou02q2d6fay0z1C0w0b4gp1lGqKQxw_zzM5F4us60IbM0
            splash: 'sfx/splash.ogg',
            // https://jummbus.bitbucket.io/#j2N0astep-floorn100s0k0l00e00t3Mm6a3g00j07i0r1O_U0o1T0v05L0OD0Ou00q0d2f1y1zjC2w0c0h0b4p1aGaKaxqer00
            'step-floor': 'sfx/step-floor.ogg',
            // https://jummbus.bitbucket.io/#j2N08teleportn110s1k0l00e00t3Mm7a3g00j07i0r1O_U00o50T0v0pL0OD0Ou00q1d1f8y4z6C2w5c4h0T2v0kL0OD0Ou02q1d7f8y4z3C1w4b4gp1wF2Uzh5wdC18yHH4hhBhHwaATXu0Asds0
            teleport: 'sfx/teleport.ogg',
            // https://jummbus.bitbucket.io/#j2N05thiefn100s1k0l00e00t3Mm3a3g00j07i0r1O_U0o1T0v0pL0OD0Ou00q1d1f5y1z8C2w2c0h0b4p1fFyUBBr9mGkKKds0
            thief: 'sfx/thief.ogg',

            // handcrafted
            lose: 'sfx/bummer.ogg',
            // https://jummbus.bitbucket.io/#j2N04tickn100s0k0l00e00t3Mmca3g00j07i0r1O_U0o2T0v0pL0OD0Ou00q1d1f7y1ziC0w4c0h4b4p1bKqE6Rtxex00
            tick: 'sfx/tick.ogg',
            // https://jummbus.bitbucket.io/#j2N06timeupn100s0k0l00e00t3Mm4a3g00j07i0r1O_U0o3T1v0pL0OD0Ou01q1d5f4y1z8C1c0A0F0B0V1Q38e0Pa610E0861b4p1dIyfgKPcLucqU0
            timeup: 'sfx/timeup.ogg',
            // https://jummbus.bitbucket.io/#j2N03winn200s0k0l00e00t2wm9a3g00j07i0r1O_U00o32T0v0EL0OD0Ou00q1d1f5y1z1C2w1c2h0T0v0pL0OD0Ou00q0d1f2y1z2C0w2c3h0b4gp1xFyW4xo31pe0MaCHCbwLbM5cFDgapBOyY0
            win: 'sfx/win.ogg',
        };

        for (let [name, path] of Object.entries(this.sound_sources)) {
            this.init_sound(name, path);
        }

        this.mmf_cooldown = 0;
    }

    async init_sound(name, path) {
        let buf = await util.fetch(path);
        let audiobuf = await this.ctx.decodeAudioData(buf);
        this.sounds[name] = {
            buf: buf,
            audiobuf: audiobuf,
        };
    }

    set_player_position(cell) {
        this.player_x = cell.x;
        this.player_y = cell.y;
    }

    play_once(name, cell = null) {
        let data = this.sounds[name];
        if (! data) {
            // Hasn't loaded yet, not much we can do
            if (! this.sound_sources[name]) {
                console.warn("Tried to play non-existent sound", name);
            }
            return;
        }

        // "Mmf" can technically play every tic since bumping into something doesn't give a movement
        // cooldown, so give it our own sound cooldown
        if (name === 'blocked' && this.player_x !== null) {
            if (this.mmf_cooldown > 0) {
                return;
            }
            else {
                this.mmf_cooldown = 4;
            }
        }

        let node = this.ctx.createBufferSource();
        node.buffer = data.audiobuf;

        if (cell && this.player_x !== null) {
            // Reduce the volume for further-away sounds
            let dx = cell.x - this.player_x;
            let dy = cell.y - this.player_y;
            let dist = Math.sqrt(dx*dx + dy*dy);
            let gain = this.ctx.createGain();
            // x/(x + a) is a common and delightful way to get an easy asymptote and output between
            // 0 and 1.  Here, the result is above 2/3 for almost everything on screen; drops down
            // to 1/3 for things 20 tiles away (which is, roughly, the periphery when standing in
            // the center of a CC1 map), and bottoms out at 1/15 for standing in one corner of a
            // CC2 map of max size and hearing something on the far opposite corner.
            gain.gain.value = 1 - dist / (dist + 10);
            node.connect(gain);
            gain.connect(this.compressor_node);
        }
        else {
            // Play at full volume
            node.connect(this.compressor_node);
        }
        node.start(this.ctx.currentTime);
    }

    // Reduce cooldowns
    advance_tic() {
        if (this.mmf_cooldown > 0) {
            this.mmf_cooldown -= 1;
        }
    }
}
class Player extends PrimaryView {
    constructor(conductor) {
        super(conductor, document.body.querySelector('main#player'));

        this.key_mapping = {
            ArrowLeft: 'left',
            ArrowRight: 'right',
            ArrowUp: 'up',
            ArrowDown: 'down',
            Spacebar: 'wait',
            " ": 'wait',
            w: 'up',
            a: 'left',
            s: 'down',
            d: 'right',
            q: 'drop',
            e: 'cycle',
            c: 'swap',
        };

        this.scale = 1;

        this.play_speed = 1;
        this.compat = {
            popwalls_react_on_arrive: false,
            auto_convert_ccl_popwalls: true,
            auto_convert_ccl_blue_walls: true,
            sliding_tanks_ignore_button: true,
            tiles_react_instantly: false,
            allow_flick: false,
        };

        this.root.style.setProperty('--tile-width', `${this.conductor.tileset.size_x}px`);
        this.root.style.setProperty('--tile-height', `${this.conductor.tileset.size_y}px`);
        this.level_el = this.root.querySelector('.level');
        this.overlay_message_el = this.root.querySelector('.overlay-message');
        this.message_el = this.root.querySelector('.message');
        this.chips_el = this.root.querySelector('.chips output');
        this.time_el = this.root.querySelector('.time output');
        this.bonus_el = this.root.querySelector('.bonus output');
        this.inventory_el = this.root.querySelector('.inventory');
        this.input_el = this.root.querySelector('.input');
        this.demo_el = this.root.querySelector('.demo');

        this.music_el = this.root.querySelector('#player-music');
        this.music_audio_el = this.music_el.querySelector('audio');
        this.music_index = null;
        let volume_el = this.music_el.querySelector('#player-music-volume');
        this.music_audio_el.volume = this.conductor.options.music_volume ?? 1.0;
        volume_el.value = this.music_audio_el.volume;
        volume_el.addEventListener('input', ev => {
            let volume = ev.target.value;
            this.conductor.options.music_volume = volume;
            this.conductor.save_stash();

            this.music_audio_el.volume = ev.target.value;
        });
        let enabled_el = this.music_el.querySelector('#player-music-unmute');
        this.music_enabled = this.conductor.options.music_enabled ?? true;
        enabled_el.checked = this.music_enabled;
        enabled_el.addEventListener('change', ev => {
            this.music_enabled = ev.target.checked;
            this.conductor.options.music_enabled = this.music_enabled;
            this.conductor.save_stash();

            // TODO also hide most of the music stuff
            if (this.music_enabled) {
                this.update_music_playback_state();
            }
            else {
                this.music_audio_el.pause();
            }
        });

        // 0: normal realtime mode
        // 1: turn-based mode, and the next tic starts at the beginning
        // 2: turn-based mode, and we're in mid-tic waiting for input
        this.turn_mode = 0;
        this.turn_based_checkbox = this.root.querySelector('.controls .control-turn-based');
        this.turn_based_checkbox.checked = false;
        this.turn_based_checkbox.addEventListener('change', ev => {
            if (this.turn_based_checkbox.checked) {
                // If we're leaving real-time mode then we're between tics
                this.turn_mode = 1;
            }
            else {
                if (this.turn_mode === 2) {
                    // Finish up the tic with dummy input
                    this.level.advance_tic({primary: null, secondary: null}, 2);
                    this.advance_by(1);
                }
                this.turn_mode = 0;
            }
        });

        // Bind buttons
        this.pause_button = this.root.querySelector('.controls .control-pause');
        this.pause_button.addEventListener('click', ev => {
            this.toggle_pause();
            ev.target.blur();
        });
        this.restart_button = this.root.querySelector('.controls .control-restart');
        this.restart_button.addEventListener('click', ev => {
            new ConfirmOverlay(this.conductor, "Abandon this attempt and try again?", () => {
                this.restart_level();
            }).open();
            ev.target.blur();
        });
        this.undo_button = this.root.querySelector('.controls .control-undo');
        this.undo_button.addEventListener('click', ev => {
            let player_cell = this.level.player.cell;
            // Keep undoing until (a) we're on another cell and (b) we're not sliding, i.e. we're
            // about to make a conscious move.  Note that this means undoing all the way through
            // force floors, even if you could override them!
            let moved = false;
            while (this.level.has_undo() &&
                ! (moved && this.level.player.slide_mode === null))
            {
                this.undo();
                if (player_cell !== this.level.player.cell) {
                    moved = true;
                }
            }
            // TODO set back to waiting if we hit the start of the level?  but
            // the stack trims itself so how do we know that
            if (this.state === 'stopped') {
                // Be sure to undo any success or failure
                this.set_state('playing');
            }
            this.update_ui();
            this._redraw();
            ev.target.blur();
        });
        this.rewind_button = this.root.querySelector('.controls .control-rewind');
        this.rewind_button.addEventListener('click', ev => {
            if (this.state === 'rewinding') {
                this.set_state('playing');
            }
            else if (this.level.has_undo()) {
                this.set_state('rewinding');
            }
        });
        // Game actions
        // TODO do these need buttons??  feel like they're not discoverable otherwise
        this.drop_button = this.root.querySelector('.actions .action-drop');
        this.drop_button.addEventListener('click', ev => {
            // Use the set of "buttons pressed between tics" because it's cleared automatically;
            // otherwise these will stick around forever
            this.current_keys_new.add('q');
            ev.target.blur();
        });
        this.cycle_button = this.root.querySelector('.actions .action-cycle');
        this.cycle_button.addEventListener('click', ev => {
            this.current_keys_new.add('e');
            ev.target.blur();
        });
        this.swap_button = this.root.querySelector('.actions .action-swap');
        this.swap_button.addEventListener('click', ev => {
            this.current_keys_new.add('c');
            ev.target.blur();
        });
        // Demo playback
        this.root.querySelector('.demo-controls .demo-play').addEventListener('click', ev => {
            if (this.state === 'playing' || this.state === 'paused' || this.state === 'rewinding') {
                new ConfirmOverlay(this.conductor, "Abandon your progress and watch the replay?", () => {
                    this.play_demo();
                });
            }
            else {
                this.play_demo();
            }
        });
        // FIXME consolidate these into debug controls
        /*
        this.root.querySelector('.demo-controls .demo-step-1').addEventListener('click', ev => {
            this.advance_by(1);
            this._redraw();
        });
        this.root.querySelector('.demo-controls .demo-step-4').addEventListener('click', ev => {
            this.advance_by(4);
            this._redraw();
        });
        */

        this.use_interpolation = true;
        this.renderer = new CanvasRenderer(this.conductor.tileset);
        this.level_el.append(this.renderer.canvas);
        this.renderer.canvas.addEventListener('auxclick', ev => {
            if (ev.button !== 1)
                return;
            if (! this.debug.enabled)
                return;

            let [x, y] = this.renderer.cell_coords_from_event(ev);
            this.level.move_to(this.level.player, this.level.cells[y][x], 1);
            // TODO this behaves a bit weirdly when paused (doesn't redraw even with a force), i
            // think because we're still claiming a speed of 1 so time has to pass before the move
            // actually "happens"
        });

        // Populate inventory
        this._inventory_tiles = {};
        let floor_tile = this.render_inventory_tile('floor');
        this.inventory_el.style.backgroundImage = `url(${floor_tile})`;
        this.inventory_key_nodes = {};
        this.inventory_tool_nodes = [];
        for (let key of ['key_red', 'key_blue', 'key_yellow', 'key_green']) {
            let img = mk('img', {src: this.render_inventory_tile(key)});
            let count = mk('span.-count');
            let root = mk('span', img, count);
            this.inventory_key_nodes[key] = {root, img, count};
            this.inventory_el.append(root);
        }
        for (let i = 0; i < 4; i++) {
            let img = mk('img');
            this.inventory_tool_nodes.push(img);
            this.inventory_el.append(img);
        }

        let last_key;
        this.pending_player_move = null;
        this.next_player_move = null;
        this.player_used_move = false;
        let key_target = document.body;
        this.previous_input = new Set;  // actions that were held last tic
        this.previous_action = null;  // last direction we were moving, if any
        this.using_touch = false;  // true if using touch controls
        this.current_keys = new Set;  // keys that are currently held
        this.current_keys_new = new Set; // keys that were pressed since input was last read
        // TODO this could all probably be more rigorous but it's fine for now
        key_target.addEventListener('keydown', ev => {
            if (! this.active)
                return;

            if (ev.key === 'p' || ev.key === 'Pause') {
                this.toggle_pause();
                return;
            }

            if (ev.key === ' ') {
                if (this.state === 'waiting') {
                    // Start without moving
                    this.set_state('playing');
                }
                else if (this.state === 'stopped') {
                    if (this.level.state === 'success') {
                        // Advance to the next level
                        // TODO game ending?
                        this.conductor.change_level(this.conductor.level_index + 1);
                    }
                    else {
                        // Restart
                        if (!this.current_keys.has(ev.key)) {
                            this.restart_level();
                        }
                    }
                    return;
                }
                // Don't scroll pls
                ev.preventDefault();
            }

            if (ev.key === 'z') {
                if (this.level.has_undo() &&
                    (this.state === 'stopped' || this.state === 'playing' || this.state === 'paused'))
                {
                    this.set_state('rewinding');
                }
            }

            if (this.key_mapping[ev.key]) {
                this.current_keys.add(ev.key);
                this.current_keys_new.add(ev.key);
                ev.stopPropagation();
                ev.preventDefault();

                // TODO for demo compat, this should happen as part of input reading?
                if (this.state === 'waiting') {
                    this.set_state('playing');
                }
            }
        });
        key_target.addEventListener('keyup', ev => {
            if (! this.active)
                return;

            if (ev.key === 'z') {
                if (this.state === 'rewinding') {
                    this.set_state('playing');
                }
            }

            if (this.key_mapping[ev.key]) {
                this.current_keys.delete(ev.key);
                ev.stopPropagation();
                ev.preventDefault();
            }
        });
        // Similarly, grab touch events and translate them to directions
        this.current_touches = {};  // ident => action
        let touch_target = this.root.querySelector('.-main-area');
        let collect_touches = ev => {
            ev.stopPropagation();
            ev.preventDefault();

            // If state is anything other than playing/waiting, probably switch to playing, similar
            // to pressing spacebar
            if (ev.type === 'touchstart') {
                if (this.state === 'paused') {
                    this.toggle_pause();
                    return;
                }
                else if (this.state === 'stopped') {
                    if (this.level.state === 'success') {
                        // Advance to the next level
                        // TODO game ending?
                        // TODO this immediately begins it too, not sure why
                        this.conductor.change_level(this.conductor.level_index + 1);
                    }
                    else {
                        // Restart
                        this.restart_level();
                    }
                    return;
                }
            }

            // Figure out where these touches are, relative to the game area
            // TODO allow starting a level without moving?
            let rect = this.level_el.getBoundingClientRect();
            for (let touch of ev.changedTouches) {
                // Normalize touch coordinates to [-1, 1]
                let rx = (touch.clientX - rect.left) / rect.width * 2 - 1;
                let ry = (touch.clientY - rect.top) / rect.height * 2 - 1;
                // Divine a direction from the results
                let action;
                if (Math.abs(rx) > Math.abs(ry)) {
                    if (rx < 0) {
                        action = 'left';
                    }
                    else {
                        action = 'right';
                    }
                }
                else {
                    if (ry < 0) {
                        action = 'up';
                    }
                    else {
                        action = 'down';
                    }
                }
                this.current_touches[touch.identifier] = action;
            }

            // TODO for demo compat, this should happen as part of input reading?
            if (this.state === 'waiting') {
                this.set_state('playing');
            }
        };
        touch_target.addEventListener('touchstart', collect_touches);
        touch_target.addEventListener('touchmove', collect_touches);
        let dismiss_touches = ev => {
            for (let touch of ev.changedTouches) {
                delete this.current_touches[touch.identifier];
            }
        };
        touch_target.addEventListener('touchend', dismiss_touches);
        touch_target.addEventListener('touchcancel', dismiss_touches);

        // When we lose focus, act as though every key was released, and pause the game
        window.addEventListener('blur', ev => {
            this.current_keys.clear();
            this.current_touches = {};

            if (this.state === 'playing' || this.state === 'rewinding') {
                this.autopause();
            }
        });
        // Same when the window becomes hidden (especially important on phones, where this covers
        // turning the screen off!)
        document.addEventListener('visibilitychange', ev => {
            if (document.visibilityState === 'hidden') {
                this.current_keys.clear();
                this.current_touches = {};

                if (this.state === 'playing' || this.state === 'rewinding') {
                    this.autopause();
                }
            }
        });

        // Populate input debugger
        this.debug = { enabled: false };
        this.input_el = this.root.querySelector('.input');
        this.input_action_elements = {};
        for (let [action, label] of Object.entries(ACTION_LABELS)) {
            let el = mk('span.input-action', {'data-action': action}, label);
            this.input_el.append(el);
            this.input_action_elements[action] = el;
        }

        this._advance_bound = this.advance.bind(this);
        this._redraw_bound = this.redraw.bind(this);
        // Used to determine where within a tic we are, for animation purposes
        this.last_advance = 0;  // performance.now timestamp

        // Auto-size the level canvas on resize
        window.addEventListener('resize', ev => {
            this.adjust_scale();
        });

        // TODO yet another thing that should be in setup, but can't be because load_level is called
        // first
        this.sfx_player = new SFXPlayer;
    }

    setup() {
    }

    // Link up the debug panel and enable debug features
    // (note that this might be called /before/ setup!)
    setup_debug() {
        this.root.classList.add('--debug');
        let debug_el = this.root.querySelector('#player-debug');
        this.debug = {
            enabled: true,
            time_tics_el: this.root.querySelector('#player-debug-time-tics'),
            time_moves_el: this.root.querySelector('#player-debug-time-moves'),
            time_secs_el: this.root.querySelector('#player-debug-time-secs'),
        };
        // Add a button for every kind of inventory item
        let inventory_el = debug_el.querySelector('.-inventory');
        let make_button = (label, onclick) => {
            let button = mk('button', {type: 'button'}, label);
            button.addEventListener('click', onclick);
            return button;
        };
        for (let name of [
            'key_blue', 'key_red', 'key_yellow', 'key_green',
            'flippers', 'fire_boots', 'cleats', 'suction_boots',
            'bribe', 'railroad_sign', 'hiking_boots', 'speed_boots',
            'xray_eye', 'helmet', 'foil', 'lightning_bolt',
        ]) {
            inventory_el.append(make_button(
                mk('img', {src: this.render_inventory_tile(name)}),
                () => {
                    this.level.give_actor(this.level.player, name);
                    this.update_ui();
                }));
        }
        let clear_button = mk('button.-wide', {type: 'button'}, "clear inventory");
        clear_button.addEventListener('click', ev => {
            this.level.take_all_keys_from_actor(this.level.player);
            this.level.take_all_tools_from_actor(this.level.player);
            this.update_ui();
        });
        inventory_el.append(clear_button);

        debug_el.querySelector('.-time-controls').addEventListener('click', ev => {
            let button = ev.target.closest('button.-time-button');
            if (! button)
                return;

            let dt = parseInt(button.getAttribute('data-dt'));
            if (dt > 0) {
                this.advance_by(dt);
            }
            else if (dt < 0) {
                for (let i = 0; i < -dt; i++) {
                    if (! this.level.has_undo())
                        break;
                    this.undo();
                }
            }
            this._redraw();
            this.update_ui();
        });

        let speed_el = debug_el.elements.speed;
        speed_el.value = "1";
        speed_el.addEventListener('change', ev => {
            let speed = ev.target.value;
            let [numer, denom] = speed.split('/');
            this.play_speed = parseInt(numer, 10) / parseInt(denom ?? '1', 10);
        });

        debug_el.querySelector('.-buttons').append(
            make_button("green button", () => {
                TILE_TYPES['button_green'].do_button(this.level);
                this._redraw();
            }),
            make_button("blue button", () => {
                TILE_TYPES['button_blue'].do_button(this.level);
                this._redraw();
            }),
            make_button("toggle clock", () => {
                this.level.pause_timer();
                this.update_ui();
            }),
            make_button("+10s", () => {
                this.level.adjust_timer(+10);
                this.update_ui();
            }),
            make_button("−10s", () => {
                this.level.adjust_timer(-10);
                this.update_ui();
            }),
            make_button("stop clock", () => {
                this.level.time_remaining = null;
                this.update_ui();
            }),
        );

        // Link up some options checkboxes
        let wire_checkbox = (name, onclick) => {
            let checkbox = debug_el.elements[name];
            checkbox.checked = false;  // override browser memory
            checkbox.addEventListener('click', onclick);
        };
        wire_checkbox('show_actor_bboxes', ev => {
            this.renderer.show_actor_bboxes = ev.target.checked;
            this._redraw();
        });
        wire_checkbox('disable_interpolation', ev => {
            this.use_interpolation = ! ev.target.checked;
            this._redraw();
        });

        this.update_ui();
    }

    activate() {
        // We can't resize when we're not visible, so do it now
        super.activate();
        this.adjust_scale();
    }

    deactivate() {
        // End the level when going away; the easiest way is by restarting it
        // TODO could throw the level away entirely and create a new one on activate?
        super.deactivate();
        if (this.state !== 'waiting') {
            this.restart_level();
        }
    }

    load_game(stored_game) {
    }

    load_level(stored_level) {
        // Do this here because we care about the latest level played, not the latest level opened
        // in the editor or whatever
        let savefile = this.conductor.current_pack_savefile;
        savefile.current_level = stored_level.number;
        if (savefile.highest_level < stored_level.number) {
            savefile.highest_level = stored_level.number;
        }
        this.conductor.save_savefile();

        this.level = new Level(stored_level, this.gather_compat_options(stored_level));
        this.level.sfx = this.sfx_player;
        this.renderer.set_level(this.level);
        this.update_viewport_size();
        this.root.classList.toggle('--has-demo', !!this.level.stored_level.demo);
        // TODO base this on a hash of the UA + some identifier for the pack + the level index.  StoredLevel doesn't know its own index atm...
        this.change_music(this.conductor.level_index % SOUNDTRACK.length);
        this._clear_state();
    }

    update_viewport_size() {
        let size = this.conductor.stored_level.viewport_size;
        this.renderer.set_viewport_size(size, size);
        this.renderer.canvas.style.setProperty('--viewport-width', size);
        this.renderer.canvas.style.setProperty('--viewport-height', size);
    }

    restart_level() {
        this.level.restart(this.gather_compat_options(this.level.stored_level));
        this._clear_state();
    }

    gather_compat_options(stored_level) {
        let ret = {};
        if (stored_level.use_ccl_compat) {
            for (let [key, value] of Object.entries(this.compat)) {
                ret[key] = value;
            }
        }
        return ret;
    }

    // Call after loading or restarting a level
    _clear_state() {
        this.set_state('waiting');

        this.turn_mode = this.turn_based_checkbox.checked ? 1 : 0;
        this.last_advance = 0;
        this.demo_faucet = null;
        this.current_keyring = {};
        this.current_toolbelt = [];

        this.chips_el.classList.remove('--done');
        this.time_el.classList.remove('--frozen');
        this.time_el.classList.remove('--danger');
        this.time_el.classList.remove('--warning');
        this.root.classList.remove('--bonus-visible');

        this.update_ui();
        // Force a redraw, which won't happen on its own since the game isn't running
        this._redraw();
    }

    open_level_browser() {
        new LevelBrowserOverlay(this.conductor).open();
    }

    play_demo() {
        this.restart_level();
        let demo = this.level.stored_level.demo;
        this.demo_faucet = demo[Symbol.iterator]();
        this.level.force_floor_direction = demo.initial_force_floor_direction;
        this.level._blob_modifier = demo.blob_seed;
        // FIXME should probably start playback on first real input
        this.set_state('playing');
    }

    get_input() {
        if (this.demo_faucet) {
            let step = this.demo_faucet.next();
            if (step.done) {
                return new Set;
            }
            else {
                return step.value;
            }
        }
        else {
            // Convert input keys to actions.  This is only done now
            // because there might be multiple keys bound to one
            // action, and it still counts as pressed as long as at
            // least one key is held
            let input = new Set;
            for (let key of this.current_keys) {
                input.add(this.key_mapping[key]);
            }
            for (let key of this.current_keys_new) {
                input.add(this.key_mapping[key]);
            }
            this.current_keys_new.clear();
            for (let action of Object.values(this.current_touches)) {
                input.add(action);
            }
            return input;
        }
    }

    advance_by(tics) {
        for (let i = 0; i < tics; i++) {
            let input = this.get_input();

            // Replica of CC2 input handling, based on experimentation
            // FIXME unclear how this should interact with undo when playing normally, and
            // definitely wrong when playing a replay; should this be in Level??
            if ((input.has('up') && input.has('down')) || (input.has('left') && input.has('right'))) {
                // If opposing keys are ever held, stop moving and forget our state
                this.primary_action = null;
                this.secondary_action = null;
            }
            else if (this.primary_action && input.has(this.primary_action)) {
                // Our primary action is locked in as long as it's held down, but check for a
                // newly pressed secondary action; remember, there can't be two opposing keys held,
                // because we already checked for that above, so this is only necessary if there's
                // not already a secondary action
                if (this.secondary_action && ! input.has(this.secondary_action)) {
                    this.secondary_action = null;
                }
                if (! this.secondary_action) {
                    for (let action of ['down', 'left', 'right', 'up']) {
                        if (action !== this.primary_action &&
                            input.has(action) && ! this.previous_input.has(action))
                        {
                            this.secondary_action = action;
                            break;
                        }
                    }
                }
            }
            else {
                // Either we weren't holding any keys, or we let go of our primary action; either
                // way, act like we're starting from scratch and check keys in priority order
                // TODO actually i'm not sure these are necessary if we check the player's facing
                // first?
                this.primary_action = null;
                this.secondary_action = null;

                // As a tiebreaker, first check if we're holding the key corresponding to the
                // player's facing direction
                let player_facing_action = DIRECTIONS[this.level.player.direction].action;
                if (input.has(player_facing_action)) {
                    this.primary_action = player_facing_action;
                }

                for (let action of ['down', 'left', 'right', 'up']) {
                    if (! input.has(action))
                        continue;

                    if (! this.primary_action) {
                        this.primary_action = action;
                    }
                    else if (action !== this.primary_action) {
                        // Note that because of the opposing keys check, there can never be more
                        // than two keys held down here
                        this.secondary_action = action;
                        break;
                    }
                }
            }

            let player_actions = {
                primary: this.primary_action ? ACTION_DIRECTIONS[this.primary_action] : null,
                secondary: this.secondary_action ? ACTION_DIRECTIONS[this.secondary_action] : null,
                cycle: input.has('cycle') && ! this.previous_input.has('cycle'),
                drop: input.has('drop') && ! this.previous_input.has('drop'),
                swap: input.has('swap') && ! this.previous_input.has('swap'),
            }

            this.previous_input = input;

            this.sfx_player.advance_tic();

            // Turn-based mode is considered assistance, but only if the game actually attempts to
            // progress while it's enabled
            if (this.turn_mode > 0) {
                this.level.aid = Math.max(1, this.level.aid);
            }

            let has_input = input.has('wait') || Object.values(player_actions).some(x => x);
            // Turn-based mode complicates this slightly; it aligns us to the middle of a tic
            if (this.turn_mode === 2) {
                if (has_input) {
                    // Finish the current tic, then continue as usual.  This means the end of the
                    // tic doesn't count against the number of tics to advance -- because it already
                    // did, the first time we tried it
                    this.level.advance_tic(player_actions, 2);
                    this.turn_mode = 1;
                }
                else {
                    continue;
                }
            }

            // We should now be at the start of a tic
            this.level.advance_tic(player_actions, 1);
            if (this.turn_mode > 0 && this.level.can_accept_input() && ! has_input) {
                // If we're in turn-based mode and could provide input here, but don't have any,
                // then wait until we do
                this.turn_mode = 2;
            }
            else {
                this.level.advance_tic(player_actions, 2);
            }

            if (this.level.state !== 'playing') {
                // We either won or lost!
                this.set_state('stopped');
                break;
            }
        }
        this.update_ui();
    }

    // Main driver of the level; advances by one tic, then schedules itself to
    // be called again next tic
    advance() {
        if (this.state !== 'playing' && this.state !== 'rewinding') {
            this._advance_handle = null;
            return;
        }

        this.last_advance = performance.now();

        if (this.state === 'playing') {
            this.advance_by(1);
        }
        else if (this.state === 'rewinding') {
            if (this.level.has_undo()) {
                // Rewind by undoing one tic every tic
                this.undo();
                this.update_ui();
            }
            // If there are no undo entries left, freeze in place until the player stops rewinding,
            // which I think is ye olde VHS behavior
            // TODO detect if we hit the start of the level (rather than just running the undo
            // buffer dry) and change to 'waiting' instead?
        }

        let dt = 1000 / (TICS_PER_SECOND * this.play_speed);
        if (this.state === 'rewinding') {
            // Rewind faster than normal time
            dt *= 0.5;
        }
        this._advance_handle = window.setTimeout(this._advance_bound, dt);
    }

    undo() {
        this.level.undo();
        // Undo always returns to the start of a tic
        if (this.turn_mode === 2) {
            this.turn_mode = 1;
        }
    }

    // Redraws every frame, unless the game isn't running
    redraw() {
        // Calculate this here, not in _redraw, because that's called at weird
        // times when the game might not have actually advanced at all yet
        // TODO this is not gonna be right while pausing lol
        // TODO i'm not sure it'll be right when rewinding either
        // TODO or if the game's speed changes.  wow!
        let tic_offset;
        if (this.turn_mode === 2) {
            // We're frozen in mid-tic, so the clock hasn't advanced yet, but everything has already
            // finished moving; pretend we're already on the next tic
            tic_offset = 1;
        }
        else if (this.use_interpolation) {
            tic_offset = Math.min(0.9999, (performance.now() - this.last_advance) / 1000 * TICS_PER_SECOND * this.play_speed);
            if (this.state === 'rewinding') {
                tic_offset = 1 - tic_offset;
            }
        }
        else {
            tic_offset = 0;
        }

        this._redraw(tic_offset);

        // Check for a stopped game *after* drawing, so that if the game ends, we still draw its
        // final result before stopping the draw loop
        // TODO for bonus points, also finish the player animation (but don't advance the game any further)
        if (this.state === 'playing' || this.state === 'rewinding') {
            this._redraw_handle = requestAnimationFrame(this._redraw_bound);
        }
        else {
            this._redraw_handle = null;
        }
    }

    // Actually redraw.  Used to force drawing outside of normal play, in which case we don't
    // interpolate (because we're probably paused)
    _redraw(tic_offset = 0) {
        this.renderer.draw(tic_offset);
    }

    render_inventory_tile(name) {
        if (! this._inventory_tiles[name]) {
            // TODO reuse the canvas for data urls
            let canvas = this.renderer.create_tile_type_canvas(name);
            this._inventory_tiles[name] = canvas.toDataURL();
        }
        return this._inventory_tiles[name];
    }

    update_ui() {
        this.pause_button.disabled = ! (this.state === 'playing' || this.state === 'paused' || this.state === 'rewinding');
        this.restart_button.disabled = (this.state === 'waiting');
        this.undo_button.disabled = ! this.level.has_undo();
        this.rewind_button.disabled = ! (this.level.has_undo() || this.state === 'rewinding');

        this.drop_button.disabled = ! (
            this.state === 'playing' && ! this.level.stored_level.use_cc1_boots &&
            this.level.player.toolbelt && this.level.player.toolbelt.length > 0);
        this.cycle_button.disabled = ! (
            this.state === 'playing' && ! this.level.stored_level.use_cc1_boots &&
            this.level.player.toolbelt && this.level.player.toolbelt.length > 1);
        this.swap_button.disabled = ! (this.state === 'playing' && this.level.players.length > 1);

        // TODO can we do this only if they actually changed?
        this.chips_el.textContent = this.level.chips_remaining;
        if (this.level.chips_remaining === 0) {
            this.chips_el.classList.add('--done');
        }

        this.time_el.classList.toggle('--frozen', this.level.time_remaining === null || this.level.timer_paused);
        if (this.level.time_remaining === null) {
            this.time_el.textContent = '---';
        }
        else {
            this.time_el.textContent = Math.ceil(this.level.time_remaining / TICS_PER_SECOND);
            this.time_el.classList.toggle('--warning', this.level.time_remaining < 30 * TICS_PER_SECOND);
            this.time_el.classList.toggle('--danger', this.level.time_remaining < 10 * TICS_PER_SECOND);
        }

        this.bonus_el.textContent = this.level.bonus_points;
        if (this.level.bonus_points > 0) {
            this.root.classList.add('--bonus-visible');
        }
        this.message_el.textContent = this.level.hint_shown ?? "";

        // Keys appear in a consistent order
        for (let [key, nodes] of Object.entries(this.inventory_key_nodes)) {
            let count = this.level.player.keyring[key] ?? 0;
            if (this.current_keyring[key] === count)
                continue;

            nodes.root.classList.toggle('--hidden', count <= 0);
            nodes.count.classList.toggle('--hidden', count <= 1);
            nodes.count.textContent = count;

            this.current_keyring[key] = count;
        }
        // Tools are whatever order we picked them up
        for (let [i, node] of this.inventory_tool_nodes.entries()) {
            let tool = this.level.player.toolbelt[i] ?? null;
            if (this.current_toolbelt[i] === tool)
                continue;

            node.classList.toggle('--hidden', tool === null);
            if (tool) {
                node.src = this.render_inventory_tile(tool);
            }

            this.current_toolbelt[i] = tool;
        }

        for (let action of Object.keys(ACTION_LABELS)) {
            this.input_action_elements[action].classList.toggle('--pressed', this.previous_input.has(action));
        }

        if (this.debug.enabled) {
            let t = this.level.tic_counter;
            this.debug.time_tics_el.textContent = `${t}`;
            this.debug.time_moves_el.textContent = `${Math.floor(t/4)}`;
            this.debug.time_secs_el.textContent = (t / 20).toFixed(2);
        }
    }

    toggle_pause() {
        if (this.state === 'paused') {
            this.set_state('playing');
        }
        else if (this.state === 'playing' || this.state === 'rewinding') {
            this.set_state('paused');
        }
    }

    autopause() {
        this.set_state('paused');
    }

    // waiting: haven't yet pressed a key so the timer isn't going
    // playing: playing normally
    // paused: um, paused
    // rewinding: playing backwards
    // stopped: level has ended one way or another
    set_state(new_state) {
        if (new_state === this.state)
            return;

        this.state = new_state;

        // Drop any "new" keys when switching into playing, since they accumulate freely as long as
        // the game isn't actually running
        if (new_state === 'playing') {
            this.current_keys_new.clear();
        }

        // Populate the overlay
        let overlay_reason = '';
        let overlay_top = '';
        let overlay_middle = null;
        let overlay_bottom = '';
        let overlay_keyhint = '';
        if (this.state === 'waiting') {
            overlay_reason = 'waiting';
            overlay_middle = "Ready!";
        }
        else if (this.state === 'paused') {
            overlay_reason = 'paused';
            overlay_bottom = "/// paused ///";
            if (this.using_touch) {
                overlay_keyhint = "tap to resume";
            }
            else {
                overlay_keyhint = "press P to resume";
            }
        }
        else if (this.state === 'stopped') {
            if (this.level.state === 'failure') {
                overlay_reason = 'failure';
                overlay_top = "whoops";
                let obits = OBITUARIES[this.level.fail_reason] ?? OBITUARIES['generic'];
                overlay_bottom = random_choice(obits);
                if (this.using_touch) {
                    // TODO touch gesture to rewind?
                    overlay_keyhint = "tap to try again, or tap undo/rewind above";
                }
                else {
                    overlay_keyhint = "press space to try again, or Z to rewind";
                }
            }
            else {
                // We just beat the level!  Hey, that's cool.
                // Let's save the score while we're here.
                let level_number = this.level.stored_level.number;
                let level_index = level_number - 1;
                let scorecard = this.level.get_scorecard();
                let savefile = this.conductor.current_pack_savefile;
                let old_scorecard;
                if (! this.debug.enabled) {
                    if (! savefile.scorecards[level_index] ||
                        savefile.scorecards[level_index].score < scorecard.score ||
                        (savefile.scorecards[level_index].score === scorecard.score &&
                            savefile.scorecards[level_index].aid > scorecard.aid))
                    {
                        old_scorecard = savefile.scorecards[level_index];

                        // Adjust the total score
                        savefile.total_score = savefile.total_score ?? 0;
                        if (old_scorecard) {
                            savefile.total_score -= old_scorecard.score;
                        }
                        savefile.total_score += scorecard.score;

                        savefile.scorecards[level_index] = scorecard;
                        this.conductor.save_savefile();
                    }
                }

                overlay_reason = 'success';
                let base = level_number * 500;
                let time = scorecard.time * 10;
                // Pick a success message
                // TODO done on first try; took many tries
                let time_left_fraction = null;
                if (this.level.time_remaining !== null && this.level.stored_level.time_limit !== null) {
                    time_left_fraction = this.level.time_remaining / TICS_PER_SECOND / this.level.stored_level.time_limit;
                }

                if (this.level.chips_remaining > 0) {
                    overlay_top = random_choice([
                        "socket to em!", "go bug blaster!",
                    ]);
                }
                else if (this.level.time_remaining && this.level.time_remaining < 200) {
                    overlay_top = random_choice([
                        "in the nick of time!", "cutting it close!",
                    ]);
                }
                else if (time_left_fraction !== null && time_left_fraction > 1) {
                    overlay_top = random_choice([
                        "faster than light!", "impossible speed!", "pipelined!",
                    ]);
                }
                else if (time_left_fraction !== null && time_left_fraction > 0.75) {
                    overlay_top = random_choice([
                        "lightning quick!", "nice speedrun!", "eagerly evaluated!",
                    ]);
                }
                else {
                    overlay_top = random_choice([
                        "you did it!", "nice going!", "great job!", "good work!",
                        "onwards!", "tubular!", "yeehaw!", "hot damn!",
                        "alphanumeric!", "nice dynamic typing!",
                    ]);
                }
                if (this.using_touch) {
                    overlay_keyhint = "tap to move on";
                }
                else {
                    overlay_keyhint = "press space to move on";
                }

                overlay_middle = mk('dl.score-chart',
                    mk('dt', "base score"),
                    mk('dd', base),
                    mk('dt', "time bonus"),
                    mk('dd', `+ ${time}`),
                );
                // It should be impossible to ever have a bonus and then drop back to 0 with CC2
                // rules; thieves can halve it, but the amount taken is rounded down.
                // That is to say, I don't need to track whether we ever got a score bonus
                if (this.level.bonus_points) {
                    overlay_middle.append(
                        mk('dt', "score bonus"),
                        mk('dd', `+ ${this.level.bonus_points}`),
                    );
                }
                else {
                    overlay_middle.append(mk('dt', ""), mk('dd', ""));
                }

                // TODO show your time, bold time...?
                overlay_middle.append(
                    mk('dt.-sum', "level score"),
                    mk('dd.-sum', `${scorecard.score} ${scorecard.aid === 0 ? '★' : ''}`),
                );

                if (old_scorecard) {
                    overlay_middle.append(
                        mk('dt', "improvement"),
                        mk('dd', `+ ${scorecard.score - old_scorecard.score}`),
                    );
                }
                else {
                    overlay_middle.append(mk('dt', ""), mk('dd', ""));
                }

                overlay_middle.append(
                    mk('dt', "total score"),
                    mk('dd', savefile.total_score),
                );
            }
        }
        this.overlay_message_el.setAttribute('data-reason', overlay_reason);
        this.overlay_message_el.querySelector('.-top').textContent = overlay_top;
        this.overlay_message_el.querySelector('.-bottom').textContent = overlay_bottom;
        this.overlay_message_el.querySelector('.-keyhint').textContent = overlay_keyhint;
        let middle = this.overlay_message_el.querySelector('.-middle');
        middle.textContent = '';
        if (overlay_middle) {
            middle.append(overlay_middle);
        }

        // Ask the renderer to apply a rewind effect only when rewinding, or when paused from
        // rewinding
        if (this.state === 'rewinding') {
            this.renderer.use_rewind_effect = true;
        }
        else if (this.state !== 'paused') {
            this.renderer.use_rewind_effect = false;
        }

        this.update_music_playback_state();

        // The advance and redraw methods run in a loop, but they cancel
        // themselves if the game isn't running, so restart them here
        if (this.state === 'playing' || this.state === 'rewinding') {
            if (! this._advance_handle) {
                this.advance();
            }
            if (! this._redraw_handle) {
                this.redraw();
            }
        }
    }

    // Music stuff

    change_music(index) {
        if (index === this.music_index)
            return;
        this.music_index = index;

        let track = SOUNDTRACK[index];
        this.music_audio_el.src = track.path;

        let title_el = this.music_el.querySelector('#player-music-title');
        title_el.textContent = track.title;
        if (track.beepbox) {
            title_el.setAttribute('href', track.beepbox);
        }
        else {
            title_el.removeAttribute('href');
        }

        let author_el = this.music_el.querySelector('#player-music-author');
        author_el.textContent = track.author;
        if (track.url) {
            author_el.setAttribute('href', track.url);
        }
        else if (track.twitter) {
            author_el.setAttribute('href', 'https://twitter.com/' + track.twitter);
        }
        else {
            author_el.removeAttribute('href');
        }
    }

    update_music_playback_state() {
        if (! this.music_enabled)
            return;

        // Audio tends to match the game state
        // TODO rewind audio when rewinding the game?  would need to use the audio api, so high effort low reward
        if (this.state === 'waiting') {
            this.music_audio_el.pause();
            this.music_audio_el.currentTime = 0;
        }
        if (this.state === 'playing' || this.state === 'rewinding') {
            this.music_audio_el.play();
        }
        else if (this.state === 'paused') {
            this.music_audio_el.pause();
        }
        else if (this.state === 'stopped') {
            this.music_audio_el.pause();
        }
    }

    // Auto-size the game canvas to fit the screen, if possible
    adjust_scale() {
        // TODO make this optional
        let style = window.getComputedStyle(this.root);
        // If we're not visible, no layout information is available and this is impossible
        if (style['display'] === 'none')
            return;

        let is_portrait = !! style.getPropertyValue('--is-portrait');
        // The base size is the size of the canvas, i.e. the viewport size times the tile size --
        // but note that we have 2x4 extra tiles for the inventory depending on layout
        let base_x, base_y;
        if (is_portrait) {
            base_x = this.conductor.tileset.size_x * this.renderer.viewport_size_x;
            base_y = this.conductor.tileset.size_y * (this.renderer.viewport_size_y + 2);
        }
        else {
            base_x = this.conductor.tileset.size_x * (this.renderer.viewport_size_x + 4);
            base_y = this.conductor.tileset.size_y * this.renderer.viewport_size_y;
        }
        // Unfortunately, finding the available space is a little tricky.  The container is a CSS
        // flex item, and the flex cell doesn't correspond directly to any element, so there's no
        // way for us to query its size directly.  We also have various stuff up top and down below
        // that shouldn't count as available space.  So instead we take a rough guess by adding up:
        // - the space currently taken up by the canvas
        let avail_x = this.renderer.canvas.offsetWidth;
        let avail_y = this.renderer.canvas.offsetHeight;
        // - the space currently taken up by the inventory, depending on orientation
        if (is_portrait) {
            avail_y += this.inventory_el.offsetHeight;
        }
        else {
            avail_x += this.inventory_el.offsetWidth;
        }
        // - the difference between the size of the play area and the size of our root (which will
        //   add in any gap around the player, e.g. if the controls stretch the root to be wider)
        let root_rect = this.root.getBoundingClientRect();
        let player_rect = this.root.querySelector('.-main-area').getBoundingClientRect();
        avail_x += root_rect.width - player_rect.width;
        avail_y += root_rect.height - player_rect.height;
        // - the margins around our root, which consume all the extra space
        let margin_x = parseFloat(style['margin-left']) + parseFloat(style['margin-right']);
        let margin_y = parseFloat(style['margin-top']) + parseFloat(style['margin-bottom']);
        avail_x += margin_x;
        avail_y += margin_y;
        // If those margins are zero, by the way, we risk being too big for the viewport already,
        // and we need to subtract any extra scroll on the body
        if (margin_x === 0 || margin_y === 0) {
            avail_x -= document.body.scrollWidth - document.body.clientWidth;
            avail_y -= document.body.scrollHeight - document.body.clientHeight;
        }

        let dpr = window.devicePixelRatio || 1.0;
        // Divide to find the biggest scale that still fits.  But don't exceed 90% of the available
        // space, or it'll feel cramped (except on small screens, where being too small HURTS).
        let maxfrac = is_portrait ? 1 : 0.9;
        let scale = Math.floor(maxfrac * dpr * Math.min(avail_x / base_x, avail_y / base_y));
        if (scale <= 1) {
            scale = 1;
        }
        // High DPI support: scale the canvas down by the inverse of the device
        // pixel ratio, thus matching the canvas's resolution to the screen
        // resolution and giving us nice, clean pixels.
        scale /= dpr;

        this.scale = scale;
        this.root.style.setProperty('--scale', scale);
    }
}


const BUILTIN_LEVEL_PACKS = [{
    path: 'levels/CCLP1.ccl',
    ident: 'cclp1',
    title: "Chip's Challenge Level Pack 1",
    desc: "Designed and recommended for new players, starting with gentle introductory levels.  A prequel to the other packs.",
}, {
    path: 'levels/CCLP4.ccl',
    ident: 'cclp4',
    title: "Chip's Challenge Level Pack 4",
    desc: "Moderately difficult, but not unfair.",
}, {
    path: 'levels/CCLXP2.ccl',
    ident: 'cclxp2',
    title: "Chip's Challenge Level Pack 2-X",
    desc: "The first community pack released, tricky and rough around the edges.",
}, {
    path: 'levels/CCLP3.ccl',
    ident: 'cclp3',
    title: "Chip's Challenge Level Pack 3",
    desc: "A tough challenge, by and for veteran players.",
}];

class Splash extends PrimaryView {
    constructor(conductor) {
        super(conductor, document.body.querySelector('main#splash'));

        // Populate the list of available level packs
        let pack_list = document.querySelector('#splash-stock-levels');
        for (let packdef of BUILTIN_LEVEL_PACKS) {
            let score;
            let packinfo = conductor.stash.packs[packdef.ident];
            if (packinfo && packinfo.total_score !== undefined) {
                if (packinfo.total_score === null) {
                    // Whoops, some NaNs got in here  :(
                    score = "computing...";
                }
                else {
                    // TODO tack on a star if the game is "beaten"?  what's that mean?  every level
                    // beaten i guess?
                    score = packinfo.total_score.toLocaleString();
                }
            }
            else {
                score = "unplayed";
            }

            let button = mk('button.button-big.level-pack-button',
                mk('h3', packdef.title),
                mk('p', packdef.desc),
                mk('span.-score', score),
            );
            button.addEventListener('click', ev => {
                this.conductor.fetch_pack(packdef.path, packdef.title);
            });
            pack_list.append(button);
        }

        // File loading: allow providing either a single file, multiple files, OR an entire
        // directory (via the hokey WebKit Entry interface)
        let upload_file_el = this.root.querySelector('#splash-upload-file');
        let upload_dir_el = this.root.querySelector('#splash-upload-dir');
        // Clear out the file controls in case of refresh
        upload_file_el.value = '';
        upload_dir_el.value = '';
        this.root.querySelector('#splash-upload-file-button').addEventListener('click', ev => {
            upload_file_el.click();
        });
        this.root.querySelector('#splash-upload-dir-button').addEventListener('click', ev => {
            upload_dir_el.click();
        });
        upload_file_el.addEventListener('change', async ev => {
            if (upload_file_el.files.length === 0)
                return;

            // TODO throw up a 'loading' overlay
            // FIXME handle multiple files!  but if there's only one, explicitly load /that/ one
            let file = ev.target.files[0];
            let buf = await file.arrayBuffer();
            await this.conductor.parse_and_load_game(buf, new util.FileFileSource(ev.target.files), file.name);
        });
        upload_dir_el.addEventListener('change', async ev => {
            // TODO throw up a 'loading' overlay
            // The directory selector populates 'files' with every single file, recursively, which
            // is kind of wild but also /much/ easier to deal with
            let files = upload_dir_el.files;
            if (files.length > 4096)
                throw new util.LLError("Got way too many files; did you upload the right directory?");

            await this.search_multi_source(new util.FileFileSource(files));
        });
        // Allow loading a local directory onto us, via the WebKit
        // file entry interface
        // TODO? this always takes a moment to register, not sure why...
        // FIXME as written this won't correctly handle CCLs
        util.handle_drop(this.root, {
            require_file: true,
            dropzone_class: '--drag-hover',
            on_drop: async ev => {
                // TODO for now, always use the entry interface, but if these are all files then
                // they can just be loaded normally
                let entries = [];
                for (let item of ev.dataTransfer.items) {
                    entries.push(item.webkitGetAsEntry());
                }
                await this.search_multi_source(new util.EntryFileSource(entries));
            },
        });
    }

    setup() {
        // Editor interface
        // (this has to be handled here because we need to examine the editor,
        // which hasn't yet been created in our constructor)
        // Bind to "create" buttons
        this.root.querySelector('#splash-create-pack').addEventListener('click', ev => {
            this.conductor.editor.create_pack();
        });
        this.root.querySelector('#splash-create-level').addEventListener('click', ev => {
            this.conductor.editor.create_scratch_level();
        });
        // Add buttons for any existing packs
        let packs = this.conductor.editor.stash.packs;
        let pack_keys = Object.keys(packs);
        pack_keys.sort((a, b) => packs[b].last_modified - packs[a].last_modified);
        let editor_section = this.root.querySelector('#splash-your-levels');
        let editor_list = editor_section;
        for (let key of pack_keys) {
            let pack = packs[key];
            let button = mk('button.button-big.level-pack-button', {type: 'button'},
                mk('h3', pack.title),
                // TODO whether it's yours or not?
                // TODO number of levels?
            );
            // TODO make a container so this can be 1 event
            button.addEventListener('click', ev => {
                this.conductor.editor.load_editor_pack(key);
            });
            editor_list.append(button);
        }
    }

    // Look for something we can load, and load it
    async search_multi_source(source) {
        // TODO not entiiirely kosher, but not sure if we should have an api for this or what
        if (source._loaded_promise) {
            await source._loaded_promise;
        }

        let paths = Object.keys(source.files);
        // TODO should handle having multiple candidates, but this is good enough for now
        paths.sort((a, b) => a.length - b.length);
        for (let path of paths) {
            let m = path.match(/[.]([^./]+)$/);
            if (! m)
                continue;

            let ext = m[1];
            // TODO this can't load an individual c2m, hmmm
            if (ext === 'c2g' || ext === 'dat' || ext === 'ccl') {
                let buf = await source.get(path);
                await this.conductor.parse_and_load_game(buf, source, path);
                break;
            }
        }
        // TODO else...?  complain we couldn't find anything?  list what we did find??  idk
    }
}


// -------------------------------------------------------------------------------------------------
// Central controller, thingy

// Report an error when a level fails to load
class LevelErrorOverlay extends DialogOverlay {
    constructor(conductor, error) {
        super(conductor);
        this.set_title("bummer");
        this.main.append(
            mk('p', "Whoopsadoodle!  I seem to be having some trouble loading this level.  I got this error, which may or may not be useful:"),
            mk('pre.error', error.toString()),
            mk('p',
                "It's probably entirely my fault, and I'm very sorry.  ",
                "Unless you're doing something weird and it's actually your fault, I guess.  ",
                "This is just a prerecorded message, so it's hard for me to tell!  ",
                "But if it's my fault and you're feeling up to it, you can let me know by ",
                mk('a', {href: 'https://github.com/eevee/lexys-labyrinth/issues'}, "filing an issue on GitHub"),
                " or finding me on Discord or Twitter or whatever.",
            ),
            mk('p', "In the more immediate future, you can see if any other levels work by jumping around manually with the 'level select' button.  Unless this was the first level of a set, in which case you're completely out of luck."),
        );
        this.add_button("welp, you get what you pay for", ev => {
            this.close();
        });
    }
}

// About dialog
const ABOUT_HTML = `
<p>Welcome to Lexy's Labyrinth, an exciting old-school tile-based puzzle adventure that is compatible with — but legally distinct from! — <a href="https://store.steampowered.com/app/346850/Chips_Challenge_1/">Chip's Challenge</a> and its long-awaited sequel <a href="https://store.steampowered.com/app/348300/Chips_Challenge_2/">Chip's Challenge 2</a>.</p>
<p>This is a reimplementation from scratch of the game and uses none of its original code or assets.  It aims to match the behavior of the Steam releases (sans obvious bugs), since those are now the canonical versions of the game, but compatibility settings aren't off the table.</p>
<p>The default level pack is the community-made <a href="https://wiki.bitbusters.club/Chip%27s_Challenge_Level_Pack_1">Chip's Challenge Level Pack 1</a>, which I had no hand in whatsoever; please follow the link for full attribution.</p>
<p>Source code is on <a href="https://github.com/eevee/lexys-labyrinth">GitHub</a>.</p>
<p>Special thanks to:</p>
<ul class="normal-list">
    <li>The lovingly maintained <a href="https://bitbusters.club/">Bit Busters Club</a>, its incredibly detailed <a href="https://wiki.bitbusters.club/Main_Page">wiki</a>, and its <a href="https://discord.gg/Xd4dUY9">Discord</a> full of welcoming and patient folks who've been more than happy to playtest this thing and answer all kinds of arcane questions about Chip's Challenge mechanics.</li>
    <li><a href="https://tw2.bitbusters.club/">Tile World</a>, the original Chip's Challenge 1 emulator whose source code was indispensable.</li>
    <li>Everyone who contributed to the soundtrack, without whom there would still only be one song.</li>
    <li>Chuck Somerville, for creating the original game!</li>
</ul>
<p>Not affiliated with, endorsed by, aided by, or done with the permission of Chuck Somerville, Niffler Inc., or Alpha Omega Productions.</p>
`;
class AboutOverlay extends DialogOverlay {
    constructor(conductor) {
        super(conductor);
        this.set_title("about");
        this.main.innerHTML = ABOUT_HTML;
        this.add_button("cool", ev => {
            this.close();
        });
    }
}

// Options dialog
// functionality?:
// - store local levels and tilesets in localstorage?  (will duplicate space but i'll be able to remember them)
// aesthetics:
// - tileset
// - animations on or off
// compat:
// - flicking
// - that cc2 hook wrapping thing
// - that cc2 thing where a brown button sends a 1-frame pulse to a wired trap
// - cc2 something about blue teleporters at 0, 0 forgetting they're looking for unwired only
// - monsters go in fire
// - rff blocks monsters
// - rff truly random
// - all manner of fucking bugs
// TODO distinguish between deliberately gameplay changes and bugs, though that's kind of an arbitrary line
const AESTHETIC_OPTIONS = [{
    key: 'anim_half_speed',
    label: "Animate at half speed",
    default: true,
    note: "CC2 plays animations at utterly ludicrous speeds and it looks very bad.  This option plays them at half speed (except for explosions and splashes, which have a fixed duration), which is objectively better in every way.",
}, {
    key: 'offset_actors',
    label: "Offset some actors",
    default: true,
    note: "Chip's Challenge typically draws everything in a grid, which looks a bit funny for tall skinny objects like...  the player.  And teeth.  This option draws both of them raised up slightly, so they'll break the grid and add a slight 3D effect.  May not work for all tilesets.",
}];
const COMPAT_OPTIONS = [{
    key: 'popwalls_react_on_arrive',
    label: "Recessed walls trigger when stepped on",
    impls: ['lynx', 'ms'],
    note: "This was the behavior in both versions of CC1, but CC2 changed them to trigger when stepped off of (probably to match the behavior of turtles).  Some CCLP levels depend on the old behavior.  See the next option for a more conservative solution.",
}, {
    key: 'auto_convert_ccl_popwalls',
    label: "Fix loaded recessed walls",
    impls: ['lynx', 'ms'],
    note: "This is a more conservative solution to the problem with recessed walls.  It replaces recessed walls with a new tile, \"doubly recessed walls\", only if they begin the level with something on top of them.  This should resolve compatibility issues without changing the behavior of recessed walls.",
}, {
    key: 'auto_convert_ccl_blue_walls',
    label: "Fix loaded blue walls",
    impls: ['lynx'],
    note: "Generally, you can only push a block if it's in a space you could otherwise move into, but Tile World Lynx allows pushing blocks off of blue walls.  (Unclear whether this is a Tile World bug, or a Lynx bug that Tile World is replicating.)  The same effect can be achieved in Steam by using a recessed wall instead, so this replaces such walls with recessed walls.  Note that this fix may have unintended side effects in conjunction with the recessed wall compat option.",
}, {
    key: 'sliding_tanks_ignore_button',
    label: "Blue tanks ignore blue buttons while sliding",
    impls: ['lynx'],
    note: "In Lynx, due to what is almost certainly a bug, blue tanks would simply not react at all if a blue button were pressed while they were in mid-movement.  Steam fixed this, but it also made blue tanks \"remember\" a button press if they were in the middle of a slide and then turn around once they were finished, and this subtle change broke at least one CCLP level.  (There is no compat option for ignoring a button press while moving normally, as that makes the game worse for no known benefit.)",
}, {
    key: 'tiles_react_instantly',
    label: "Tiles react instantly",
    impls: ['ms'],
    note: "CC originally had objects slide smoothly from one tile to another, so most tiles only responded when the movement completed.  In the Microsoft port, though, everything moves instantly (and then waits before moving again), so tiles respond right away.",
}, {
    key: 'allow_flick',
    label: "Allow flicking",
    impls: ['ms'],
    note: "Generally, you can only push a block if it's in a space you could otherwise move into.  Due to a bug, the Microsoft port allows pushing blocks that are on top of walls, thin walls, ice corners, etc., and this maneuver is called a \"flick\".",
}];
const COMPAT_IMPLS = {
    lynx: "Lynx, the original version",
    ms: "Microsoft's Windows port",
    steam: "The canonical Steam version, but off by default because it's considered a bug",
};
const OPTIONS_TABS = [{
    name: 'aesthetic',
    label: "Aesthetics",
}, {
    name: 'compat',
    label: "Compatibility",
}];
class OptionsOverlay extends DialogOverlay {
    constructor(conductor) {
        super(conductor);
        this.root.classList.add('dialog-options');
        this.set_title("options");
        this.add_button("well alright then", ev => {
            this.close();
        });

        this.main.append(mk('p', "Sorry!  This stuff doesn't actually work yet."));

        let tab_strip = mk('nav.tabstrip');
        this.main.append(tab_strip);
        this.tab_links = {};
        this.tab_blocks = {};
        this.current_tab = 'aesthetic';
        for (let tabdef of OPTIONS_TABS) {
            let link = mk('a', {href: 'javascript:', 'data-tab': tabdef.name}, tabdef.label);
            link.addEventListener('click', ev => {
                ev.preventDefault();
                this.switch_tab(ev.target.getAttribute('data-tab'));
            });
            tab_strip.append(link);
            this.tab_links[tabdef.name] = link;
            let block = mk('section.tabblock');
            this.main.append(block);
            this.tab_blocks[tabdef.name] = block;

            if (tabdef.name === this.current_tab) {
                link.classList.add('--selected');
                block.classList.add('--selected');
            }
        }

        // Aesthetic tab
        this._add_options(this.tab_blocks['aesthetic'], AESTHETIC_OPTIONS);

        // Compat tab
        this.tab_blocks['compat'].append(
            mk('p', "Revert to:", mk('button', "Default"), mk('button', "Lynx"), mk('button', "Microsoft"), mk('button', "Steam")),
            mk('p', "These settings are for compatibility with player-created levels, which sometimes relied on subtle details of the Microsoft or Lynx games and no longer work with the now-canonical Steam rules.  The default is to follow the Steam rules as closely as possible (except for bugs), but make a few small tweaks to keep CCL-format levels working."),
            mk('p', "Changes won't take effect until you restart the level or change levels."),
            mk('p', "Please note that Microsoft had a number of subtle but complex bugs that Lexy's Labyrinth cannot ever reasonably emulate.  The Microsoft settings here are best-effort and not intended to be 100% compatible."),
        );
        this._add_options(this.tab_blocks['compat'], COMPAT_OPTIONS);
    }

    _add_options(root, options) {
        let ul = mk('ul');
        root.append(ul);
        for (let optdef of options) {
            let li = mk('li');
            let label = mk('label.option');
            label.append(mk('input', {type: 'checkbox', name: optdef.key}));
            if (optdef.impls) {
                for (let impl of optdef.impls) {
                    label.append(mk('img.compat-icon', {src: `icons/compat-${impl}.png`}));
                }
            }
            label.append(mk('span.option-label', optdef.label));
            let help_icon = mk('img.-help', {src: 'icons/help.png'});
            label.append(help_icon);
            let help_text = mk('p.option-help', optdef.note);
            li.append(label);
            li.append(help_text);
            ul.append(li);
            help_icon.addEventListener('click', ev => {
                help_text.classList.toggle('--visible');
            });
        }
    }

    switch_tab(tab) {
        if (this.current_tab === tab)
            return;

        this.tab_links[this.current_tab].classList.remove('--selected');
        this.tab_blocks[this.current_tab].classList.remove('--selected');
        this.current_tab = tab;
        this.tab_links[this.current_tab].classList.add('--selected');
        this.tab_blocks[this.current_tab].classList.add('--selected');
    }
}

// List of levels, used in the player
class LevelBrowserOverlay extends DialogOverlay {
    constructor(conductor) {
        super(conductor);
        this.set_title("choose a level");
        let thead = mk('thead', mk('tr',
            mk('th', ""),
            mk('th', "Level"),
            mk('th', "Your time"),
            mk('th', mk('abbr', {
                title: "Actual time it took you to play the level, even on untimed levels, and ignoring any CC2 clock altering effects",
            }, "Real time")),
            mk('th', "Your score"),
        ));
        let tbody = mk('tbody');
        let table = mk('table.level-browser', thead, tbody);
        this.main.append(table);
        let savefile = conductor.current_pack_savefile;
        // TODO if i stop eagerloading everything in a .DAT then this will not make sense any more
        for (let [i, meta] of conductor.stored_game.level_metadata.entries()) {
            let scorecard = savefile.scorecards[i];
            let score = "—", time = "—", abstime = "—";
            if (scorecard) {
                score = scorecard.score.toLocaleString();
                if (scorecard.aid === 0) {
                    score += '★';
                }

                if (scorecard.time === 0) {
                    // This level is untimed
                    time = "n/a";
                }
                else {
                    time = String(scorecard.time);
                }

                // Express absolute time as mm:ss, with two decimals on the seconds (which should be
                // able to exactly count a number of tics)
                let absmin = Math.floor(scorecard.abstime / TICS_PER_SECOND / 60);
                let abssec = scorecard.abstime / TICS_PER_SECOND % 60;
                abstime = `${absmin}:${abssec < 10 ? '0' : ''}${abssec.toFixed(2)}`;
            }

            let title = meta.title;
            if (meta.error) {
                title = '[failed to load]';
            }
            else if (! title) {
                title = '(untitled)';
            }

            let tr = mk('tr',
                {'data-index': i},
                mk('td.-number', meta.number),
                mk('td.-title', title),
                mk('td.-time', time),
                mk('td.-time', abstime),
                mk('td.-score', score),
                // TODO show your time?  include 999 times for untimed levels (which i don't know at
                // this point whoops but i guess if the time is zero then that answers that)?  show
                // your wallclock time also?
                // TODO other stats??  num chips, time limit?  don't know that without loading all
                // the levels upfront though, which i currently do but want to stop doing
            );

            // TODO sigh, does not actually indicate visited in C2G world
            if (i >= savefile.highest_level) {
                tr.classList.add('--unvisited');
            }
            if (meta.error) {
                tr.classList.add('--error');
            }

            tbody.append(tr);
        }

        tbody.addEventListener('click', ev => {
            let tr = ev.target.closest('table.level-browser tr');
            if (! tr)
                return;

            let index = parseInt(tr.getAttribute('data-index'), 10);
            if (this.conductor.change_level(index)) {
                this.close();
            }
        });

        this.add_button("nevermind", ev => {
            this.close();
        });
    }
}

// Central dispatcher of what we're doing and what we've got loaded
// We store several kinds of things in localStorage:
// Main storage:
//   packs
//   options
const STORAGE_KEY = "Lexy's Labyrinth";
// Records for playing a pack
const STORAGE_PACK_PREFIX = "Lexy's Labyrinth: ";
// Metadata for an edited pack
// - list of the levels they own and basic metadata like name
// Stored individual levels: given dummy names, all indexed on their own
class Conductor {
    constructor(tileset) {
        this.stored_game = null;
        this.tileset = tileset;

        this.stash = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
        // TODO more robust way to ensure this is shaped how i expect?
        if (! this.stash) {
            this.stash = {};
        }
        if (! this.stash.options) {
            this.stash.options = {};
        }
        if (! this.stash.packs) {
            this.stash.packs = {};
        }
        // Handy aliases
        this.options = this.stash.options;

        this.splash = new Splash(this);
        this.editor = new Editor(this);
        this.player = new Player(this);

        // Bind the header buttons
        document.querySelector('#main-about').addEventListener('click', ev => {
            new AboutOverlay(this).open();
        });
        document.querySelector('#main-options').addEventListener('click', ev => {
            new OptionsOverlay(this).open();
        });

        // Bind to the navigation headers, which list the current level pack
        // and level
        this.level_pack_name_el = document.querySelector('#level-pack-name');
        this.level_name_el = document.querySelector('#level-name');
        this.nav_prev_button = document.querySelector('#main-prev-level');
        this.nav_next_button = document.querySelector('#main-next-level');
        this.nav_choose_level_button = document.querySelector('#main-choose-level');
        this.nav_prev_button.addEventListener('click', ev => {
            // TODO confirm
            if (this.stored_game && this.level_index > 0) {
                this.change_level(this.level_index - 1);
            }
            ev.target.blur();
        });
        this.nav_next_button.addEventListener('click', ev => {
            // TODO confirm
            if (this.stored_game && this.level_index < this.stored_game.level_metadata.length - 1) {
                this.change_level(this.level_index + 1);
            }
            ev.target.blur();
        });
        this.nav_choose_level_button.addEventListener('click', ev => {
            if (! this.stored_game)
                return;

            this.current.open_level_browser();
            ev.target.blur();
        });
        document.querySelector('#main-change-pack').addEventListener('click', ev => {
            // TODO confirm
            this.switch_to_splash();
        });
        document.querySelector('#player-edit').addEventListener('click', ev => {
            // TODO should be able to jump to editor if we started in the
            // player too!  but should disable score tracking, have a revert
            // button, not be able to save over it, have a warning about
            // cheating...
            this.switch_to_editor();
        });
        document.querySelector('#editor-play').addEventListener('click', ev => {
            // Restart the level to ensure it takes edits into account
            // TODO need to finish thinking out the exact flow between editor/player and what happens when...
            this.player.restart_level();
            this.switch_to_player();
        });

        // Bind the secret debug button: the icon in the lower left
        document.querySelector('#header-icon').addEventListener('auxclick', ev => {
            if (ev.button === 1 && ! this.player.debug.enabled) {
                new ConfirmOverlay(this,
                    "Enable debug mode in the player?  This will give you lots of toys to play with, " +
                    "but disable all saving of scores until you reload the page!",
                    () => {
                        this.player.setup_debug();
                        ev.target.src = '/icon-debug.png';
                    },
                ).open();
            }
        });

        this.update_nav_buttons();
        this.switch_to_splash();
    }

    switch_to_splash() {
        if (this.current) {
            this.current.deactivate();
        }
        this.splash.activate();
        this.current = this.splash;
        document.body.setAttribute('data-mode', 'splash');
    }

    switch_to_editor() {
        if (this.current) {
            this.current.deactivate();
        }
        this.editor.activate();
        this.current = this.editor;
        document.body.setAttribute('data-mode', 'editor');
    }

    switch_to_player() {
        if (this.current) {
            this.current.deactivate();
        }
        this.player.activate();
        this.current = this.player;
        document.body.setAttribute('data-mode', 'player');
    }

    load_game(stored_game, identifier = null) {
        this.stored_game = stored_game;

        this._pack_identifier = identifier;
        this.current_pack_savefile = null;
        if (identifier !== null) {
            // TODO again, enforce something about the shape here
            this.current_pack_savefile = JSON.parse(window.localStorage.getItem(STORAGE_PACK_PREFIX + identifier));
            if (this.current_pack_savefile && this.current_pack_savefile.total_score === null) {
                // Fix some NaNs that slipped in
                this.current_pack_savefile.total_score = this.current_pack_savefile.scorecards
                    .map(scorecard => scorecard ? scorecard.score : 0)
                    .reduce((a, b) => a + b, 0);
                this.save_savefile();
            }
        }
        if (! this.current_pack_savefile) {
            this.current_pack_savefile = {
                total_score: 0,
                current_level: 1,
                highest_level: 1,
                // level scorecard: { time, abstime, bonus, score, aid } or null
                scorecards: [],
            };
        }

        this.player.load_game(stored_game);
        this.editor.load_game(stored_game);

        return this.change_level(0);
    }

    change_level(level_index) {
        // FIXME handle errors here
        try {
            this.stored_level = this.stored_game.load_level(level_index);
        }
        catch (e) {
            console.error(e);
            new LevelErrorOverlay(this, e).open();
            return false;
        }

        this.level_index = level_index;

        this.update_level_title();
        this.update_nav_buttons();

        this.player.load_level(this.stored_level);
        this.editor.load_level(this.stored_level);
        return true;
    }

    update_level_title() {
        this.level_pack_name_el.textContent = this.stored_game.title;
        this.level_name_el.textContent = `Level ${this.stored_level.number} — ${this.stored_level.title}`;

        document.title = `${this.stored_level.title} [#${this.stored_level.number}] — ${this.stored_game.title} — ${PAGE_TITLE}`;
    }

    update_nav_buttons() {
        this.nav_choose_level_button.disabled = !this.stored_game;
        this.nav_prev_button.disabled = !this.stored_game || this.level_index <= 0;
        this.nav_next_button.disabled = !this.stored_game || this.level_index >= this.stored_game.level_metadata.length;
    }

    save_stash() {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.stash));
    }

    save_savefile() {
        if (! this._pack_identifier)
            return;

        window.localStorage.setItem(STORAGE_PACK_PREFIX + this._pack_identifier, JSON.stringify(this.current_pack_savefile));

        // Also remember the total score in the stash, if it changed, so we can read it without
        // having to parse every single one of these things
        let packinfo = this.stash.packs[this._pack_identifier];
        if (! packinfo || packinfo.total_score !== this.current_pack_savefile.total_score) {
            if (! packinfo) {
                packinfo = {};
                this.stash.packs[this._pack_identifier] = packinfo;
            }
            packinfo.total_score = this.current_pack_savefile.total_score;
            this.save_stash();
        }
    }

    // ------------------------------------------------------------------------------------------------
    // File loading

    extract_identifier_from_path(path) {
        let ident = path.match(/^(?:.*\/)?[.]*([^.]+)(?:[.]|$)/)[1];
        if (ident) {
            return ident.toLowerCase();
        }
        else {
            return null;
        }
    }

    async fetch_pack(path, title) {
        // TODO indicate we're downloading something
        // TODO handle errors
        // TODO cancel a download if we start another one?
        let buf = await util.fetch(path);
        await this.parse_and_load_game(buf, new util.HTTPFileSource(new URL(location)), path, undefined, title);
    }

    async parse_and_load_game(buf, source, path, identifier, title) {
        if (identifier === undefined) {
            identifier = this.extract_identifier_from_path(path);
        }

        // TODO also support tile world's DAC when reading from local??
        // TODO ah, there's more metadata in CCX, crapola
        let magic = String.fromCharCode.apply(null, new Uint8Array(buf.slice(0, 4)));
        let stored_game;
        if (magic === 'CC2M' || magic === 'CCS ') {
            // This is an individual level, so concoct a fake game for it, and don't save anything
            stored_game = c2g.wrap_individual_level(buf);
            identifier = null;
        }
        else if (magic === '\xac\xaa\x02\x00' || magic == '\xac\xaa\x02\x01') {
            stored_game = dat.parse_game(buf);
        }
        else if (magic.toLowerCase() === 'game') {
            // TODO this isn't really a magic number and isn't required to be first, so, maybe
            // this one should just go by filename
            let dir;
            if (! path.match(/[/]/)) {
                dir = '';
            }
            else {
                dir = path.replace(/[/][^/]+$/, '');
            }
            stored_game = await c2g.parse_game(buf, source, dir);
        }
        else {
            throw new Error("Unrecognized file format");
        }

        // TODO load title for a C2G
        if (! stored_game.title) {
            stored_game.title = title ?? identifier ?? "Untitled pack";
        }

        if (this.load_game(stored_game, identifier)) {
            this.switch_to_player();
        }
    }
}


async function main() {
    let local = !! location.host.match(/localhost/);
    let query = new URLSearchParams(location.search);

    // Pick a tileset
    // These alternative ones only work locally for me for testing purposes, since they're part of
    // the commercial games!
    let tilesheet = new Image();
    let tilesize;
    let tilelayout;
    if (local && query.get('tileset') === 'ms') {
        tilesheet.src = 'tileset-ms.png';
        tilesize = 32;
        tilelayout = CC2_TILESET_LAYOUT;
    }
    else if (local && query.get('tileset') === 'steam') {
        tilesheet.src = 'tileset-steam.png';
        tilesize = 32;
        tilelayout = CC2_TILESET_LAYOUT;
    }
    else if (query.get('tileset') === 'tworld') {
        tilesheet.src = 'tileset-tworld.png';
        tilesize = 48;
        tilelayout = TILE_WORLD_TILESET_LAYOUT;
    }
    else {
        // Default to Lexy's Labyrinth tileset
        tilesheet.src = 'tileset-lexy.png';
        tilesize = 32;
        tilelayout = LL_TILESET_LAYOUT;
    }
    // TODO would be fabulous to not wait on this before creating conductor
    await tilesheet.decode();
    let tileset = new Tileset(tilesheet, tilelayout, tilesize, tilesize);

    let conductor = new Conductor(tileset);
    window._conductor = conductor;

    // Pick a level (set)
    // TODO error handling  :(
    let path = query.get('setpath');
    let b64level = query.get('level');
    if (path && path.match(/^levels[/]/)) {
        conductor.fetch_pack(path);
    }
    else if (b64level) {
        // TODO all the more important to show errors!!
        // FIXME Not ideal, but atob() returns a string rather than any of the myriad binary types
        let stringy_buf = atob(b64level.replace(/-/g, '+').replace(/_/g, '/'));
        let buf = Uint8Array.from(stringy_buf, c => c.charCodeAt(0)).buffer;
        await conductor.parse_and_load_game(buf, null, 'shared.c2m', null, "Shared level");
    }
}

main();
