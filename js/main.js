// TODO bugs and quirks i'm aware of:
// - steam: if a player character starts on a force floor they won't be able to make any voluntary movements until they are no longer on a force floor
import * as fflate from './vendor/fflate.js';

import { COMPAT_FLAGS, COMPAT_RULESET_LABELS, COMPAT_RULESET_ORDER, DIRECTIONS, INPUT_BITS, TICS_PER_SECOND, compat_flags_for_ruleset } from './defs.js';
import * as c2g from './format-c2g.js';
import * as dat from './format-dat.js';
import * as format_base from './format-base.js';
import * as format_tws from './format-tws.js';
import { Level } from './game.js';
import { PrimaryView, Overlay, DialogOverlay, ConfirmOverlay, flash_button, load_json_from_storage, save_json_to_storage } from './main-base.js';
import { Editor } from './main-editor.js';
import CanvasRenderer from './renderer-canvas.js';
import SOUNDTRACK from './soundtrack.js';
import { Tileset, CC2_TILESET_LAYOUT, LL_TILESET_LAYOUT, TILE_WORLD_TILESET_LAYOUT, TILESET_LAYOUTS } from './tileset.js';
import TILE_TYPES from './tiletypes.js';
import { random_choice, mk, mk_svg, promise_event } from './util.js';
import * as util from './util.js';

const PAGE_TITLE = "Lexy's Labyrinth";
// This prefix is LLDEMO in base64, used to be somewhat confident that a string is a valid demo
// (it's 6 characters so it becomes exactly 8 base64 chars with no leftovers to entangle)
const REPLAY_PREFIX = "TExERU1P";

function format_replay_duration(t) {
    return `${t} tics (${util.format_duration(t / TICS_PER_SECOND)})`;
}

function simplify_number(number) {
    if (number < 1e6)
    {
        return number.toString();
    }
    else if (number < 1e9)
    {
        return (number/1e6).toPrecision(4) + "M";
    }
    else if (number < 1e12)
    {
        return (number/1e9).toPrecision(4) + "B";
    }
    else if (number < 1e15)
    {
        return (number/1e12).toPrecision(4) + "T";
    }
    else if (number < 1e18)
    {
        return (number/1e15).toPrecision(4) + "Q";
    }
    else
    {
        return number.toPrecision(2).replace("+","")
    }
}

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
        "water disaster",
        "you sank like a rock",
        "your stack overflowed",
    ],
    burned: [
        "your core temp got too high",
        "your plans went up in smoke",
        "you got roasted",
        "you really blazed through that one",
        "you turned up the heat",
    ],
    slimed: [
        "what an oozefest",
        "quite a sticky situation",
        "you got dunked in the gunk",
        "that'll leave a stain",
        "what a waste",
    ],
    exploded: [
        //"
        "looks like you're having a blast",
        "you tripped over something of mine",
        "you were blown to bits",
        "you will surely be mist",
    ],
    squished: [
        "that block of ram was too much for you",
        "you became two-dimensional",
        "you're a little flat, not too sharp",
        "nice compression ratio",
        //"
    ],
    time: [
        "you tried to overclock",
        "you lost track of time",
        "your speedrun went badly",
        "you're feeling quite alarmed",
        //"
    ],
    electrocuted: [
        "a shocking revelation",
        "danger: high voltage",
        "inadequate insulation",
        "rode the lightning",
    ],
    fell: [
        "some say she's still falling",
        "look before you leap",
        "where's my ladder",
        "it's dark down here",
    ],
    generic: [
        "you had a bad time",
    ],

    // Specific creatures
    ball: [
        "you're having a ball",
        "you'll bounce back from this",
        "should've gone the other way",
        //"
        //"
    ],
    walker: [
        "you let it walk all over you",
        "step into, step over, step out",
        "don't just wander around at random",
        //"
        //"
    ],
    fireball: [
        "you had a meltdown",
        "you haven't been flamed like that since usenet",
        //"
        //"
        //"
    ],
    glider: [
        "your ship came in",
        "don't worry, everything's fin now",
        "should've given it a wider berth",
        "watch out for that skipper",
        //"
    ],
    tank_blue: [
        "you didn't watch where they tread",
        "please and tank blue",
        "should've reversed course",
        "you strayed from the straight and narrow",
        //"
    ],
    tank_yellow: [
        "you let things get out of control",
        "you need more direction in your life",
        "your chances of surviving that were remote",
        //"
        //"
    ],
    bug: [
        "you got ants in your pants",
        "time for some debugging",
        //"
        //"
        //"
    ],
    paramecium: [
        "you got the creepy crawlies",
        "you couldn't wriggle out of that one",
        "you better leg it next time",
        //"
        //"
    ],
    teeth: [
        "you got a mega bite",
        "you got a little nybble",
        "you're quite a mouthful",
        "you passed the taste test",
        //"
    ],
    teeth_timid: [
        "you got a killer byte",
        //"
        "you got a tongue-lashing",
        //"
        //"
    ],
    blob: [
        "gooed job on that one",
        "the rng manipulated you",
        "goo another way next time",
        //"
        //"
    ],
    doppelganger1: [
        "you were outfoxed",
        "sometimes a copy beats the original",
        "better reflect on what went wrong",
        "you've been duped",
        //"
    ],
    doppelganger2: [
        "your plans just didn't gel",
        "bet that makes you hopping mad",
        //"
        //"
        //"
    ],
    rover: [
        "should've given it more roomba",
        "exterminate.  exterminate.",
        "your space was invaded",
        "red rover, red rover, this playthrough is over",
        "defeated by a confused frisbee",
    ],
    ghost: [
        "you were scared to death",
        "that wasn't very friendly",
        "now you're both ghosts",
        //"
        //"
    ],
    floor_mimic: [
        "you never saw that coming",
        "you were absolutely floored",
        "this seems fu-tile",
        "watch your step",
        //"
    ],

    // Misc
    dynamite_lit: [
        "you've got a short fuse",
        "you failed to put the pin back in",
        //"
        //"
        //"
    ],
    rolling_ball: [
        "you were bowled over",
        "you found some head cannon",
        "strike one!",
        "down for the ten-count",
        "watch out, pinhead",
    ],
};
// Helper class used to let the game play sounds without knowing too much about the Player
class SFXPlayer {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext);  // come the fuck on, safari
        this.volume = 1.0;
        this.enabled = true;

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
            // https://jummbus.bitbucket.io/#j3N04dropn100s0k0l00e00t3Mm6a3g00j07i0r1O_U0o2T0v0pL0OaD0Ou00q1d1f4y2z9C0w2c0h0b4p1bGqKHGjner00
            drop: 'sfx/drop.ogg',
            // https://jummbus.bitbucket.io/#j3N0afake-floorn110s0k0l00e00t3Mm2a3g00j07i0r1O_U00o40T0v0zL0OaD0Ou10q0d0f8y0z1C2w2c0Gc0h0T2v05L0OaD0Ou02q1d7f4y1z3C1w1h0b4gp190apu0zzM0
            'fake-floor': 'sfx/fake-floor.ogg',
            // https://jummbus.bitbucket.io/#j3N09get-bonusn100s1k0l00e00t50mba3g00j07i0r1O_U0o4T0v0pL0OaD0Ou00q1d5f8y0z2C1w0c0h8b4p1iFyWAxoHwmacOem8s60
            'get-bonus': 'sfx/get-bonus.ogg',
            // https://jummbus.bitbucket.io/#j3N0aget-bonus2n100s1k0l00e00t50mba3g00j07i0r1O_U0o4T0v0pL0OaD0Ou00q1d5f8y0z2C1w0c0h8b4p1lFyWAxoHwmapK2cOeq6qU0
            'get-bonus2': 'sfx/get-bonus2.ogg',
            // https://jummbus.bitbucket.io/#j2N08get-chipn100s0k0l00e00t3Mmca3g00j07i0r1O_U0o4T0v0zL0OD0Ou00q1d1f6y1z2C0wac0h0b4p1dFyW7czgUK7aw0
            'get-chip': 'sfx/get-chip.ogg',
            // https://jummbus.bitbucket.io/#j3N0eget-chip-extran100s0k0l00e00t3Mmca3g00j07i0r1O_U0o4T0v0zL0OaD0Ou00q1d1f6y1z2C0wac0h0b4p1cFyW6p6xXel00
            'get-chip-extra': 'sfx/get-chip-extra.ogg',
            // https://jummbus.bitbucket.io/#j3N0eget-chip-extran100s0k0l00e00t3Mm5a3g00j07i0r1O_U0o4T0v0zL0OaD0Ou00q1d1f6y1z2C0wac0h0b4p1cFyW6p6xXel00
            'get-chip-last': 'sfx/get-chip-last.ogg',
            // https://jummbus.bitbucket.io/#j2N07get-keyn100s0k0l00e00t3Mmfa3g00j07i0r1O_U0o5T0v0pL0OD0Ou00q1d5f8y0z2C0w1c0h0b4p1dFyW85CbwwzBg0
            'get-key': 'sfx/get-key.ogg',
            // https://jummbus.bitbucket.io/#j3N0jget-stopwatch-bonusn100s1k0l00e00t50mca3g00j07i0r1O_U0o5T0v0pL0OaD0Ou00q0d1f7y1z2C1w4c0h8b4p19FyUsmIVk0
            'get-stopwatch-bonus': 'sfx/get-stopwatch-bonus.ogg',
            // https://jummbus.bitbucket.io/#j3N0lget-stopwatch-penaltyn100s1k0l00e00t50mca3g00j07i0r1O_U0o5T0v0pL0OaD0Ou00q0d1f7y1z2C1w4c0h8b4p19FyWxp8Vk0
            'get-stopwatch-penalty': 'sfx/get-stopwatch-penalty.ogg',
            // https://jummbus.bitbucket.io/#j3N0kget-stopwatch-togglen100s0k0l00e00t50mca3g00j07i0r1O_U0o5T0v0pL0OaD0Ou00q0d1f7y1z2C1w4c0h8b4p19FyWxq3Bg0
            'get-stopwatch-toggle': 'sfx/get-stopwatch-toggle.ogg',
            // https://jummbus.bitbucket.io/#j2N08get-tooln100s0k0l00e00t3Mm6a3g00j07i0r1O_U0o2T0v0pL0OD0Ou00q1d1f4y2z9C0w2c0h0b4p1bGqKNW4isVk0
            'get-tool': 'sfx/get-tool.ogg',
            // https://jummbus.bitbucket.io/#j3N07popwalln110s0k0l00e00t3Mm2a3g00j07i0r1O_U00o40T0v0zL0OaD0Ou10q0d0f8y0z1C2w2c0Gc0h0T2v0aL0OaD0Ou02q1d5f1y0z3C1w1h0b4gp190ap6Ker00
            popwall: 'sfx/popwall.ogg',
            // https://jummbus.bitbucket.io/#j3N04pushn110s0k0l00e00t3Mm3a3g00j07i0r1O_U00o30T5v0pL0OaD0Ou50q1d5f8y1z6C1c0h0H-JJAArrqiih999T2v01L0OaD0Ou02q2d2f6y1zhC0w0h0b4gp1f0bkoUzCcqy1FMo0
            push: 'sfx/push.ogg',
            // https://jummbus.bitbucket.io/#j2N06socketn110s0k0l00e00t3Mm4a3g00j07i0r1O_U00o30T5v0pL0OD0Ou05q1d1f8y1z7C1c0h0HU7000U0006000ET2v0pL0OD0Ou02q1d6f5y3z2C0w0b4gp1xGoKHGhFBcn2FyPkxk0rE2AGcNCQyHwUY0
            socket: 'sfx/socket.ogg',
            // https://jummbus.bitbucket.io/#j2N06splashn110s0k0l00e00t3Mm5a3g00j07i0r1O_U00o20T0v0pL0OD0Ou00q0d0fay0z0C0w9c0h8T2v05L0OD0Ou02q2d6fay0z1C0w0b4gp1lGqKQxw_zzM5F4us60IbM0
            splash: 'sfx/splash.ogg',
            // https://jummbus.bitbucket.io/#j3N0csplash-slimen110s0k0l00e00t3Mm2a3g00j07i0r1O_U00o20T0v0pL0OaD0Ou00q3d7f3y2z1C0w9c3h0T2v01L0OaD0Ou02q2d7f2y1z0C0w0h0b4gp1nJ5nqgGgGusu0J0zjb0i9Hw0
            'splash-slime': 'sfx/splash-slime.ogg',
            // https://jummbus.bitbucket.io/#j3N0bslide-forcen110s1k0l00e00t4Im3a3g00j07i0r1O_U00o40T1v05L0OaD0Ou01q0d7f3y0z1C0c0h0A0F0B0V1Q0000Pff00E0711T2v01L0OaD0Ou02q2d7fay5z1C0w0h0b4gp1bJ8n55isS000
            'slide-force': 'sfx/slide-force.ogg',
            // https://jummbus.bitbucket.io/#j3N09slide-icen110s0k0l00e00t3Mm3a3g00j07i0r1O_U00o50T0v0fL0OaD0Ou00q2d2f8y0z1C0w9c3h0T2v01L0OaD0Ou02q2d3fay5z5C0w0h0b4gp1jGgKb8er0l5mlg84Ddw0
            // https://jummbus.bitbucket.io/#j3N09slide-icen110s1k0l00e00t4Im3a3g00j07i0r1O_U00o50T1v0aL0OaD0Ou01q3d7f5y0z9C0c0h0A9F3B2VdQ5428Paa74E0019T2v01L0OaD0Ou02q2d7fay5z1C0w0h0b4gp1kLwb2HbEBer0l0l509Po0
            'slide-ice': 'sfx/slide-ice.ogg',
            // https://jummbus.bitbucket.io/#j3N09step-firen110s0k0l00e00t3Mm6a3g00j07i0r1O_U00o10T0v05L0OaD0Ou10q0d0f8y0z1C2w2c0Gc0h0T2v0pL0OaD0Ou02q3d7fay3z1C0w1h0b4gp1b0ayH2w40VI0
            'step-fire': 'sfx/step-fire.ogg',
            // https://jummbus.bitbucket.io/#j3N0astep-forcen110s0k0l00e00t3Mm4a3g00j07i0r1O_U00o30T0v0aL0OaD0Ou00q1d1fay2z6C1wdc0h3T2v01L0OaD0zu02q0d1f9y2z1C1w8h0b4gp1mJdlagwgQsu0J5mqhK0qsu0
            'step-force': 'sfx/step-force.ogg',
            // https://jummbus.bitbucket.io/#j2N0astep-floorn100s0k0l00e00t3Mm6a3g00j07i0r1O_U0o1T0v05L0OD0Ou00q0d2f1y1zjC2w0c0h0b4p1aGaKaxqer00
            'step-floor': 'sfx/step-floor.ogg',
            // https://jummbus.bitbucket.io/#j3N0bstep-graveln110s0k0l00e00t3Mm6a3g00j07i0r1O_U00o50T0v05L0OaD0Ou00q0d1f7y4z2C0wic0h0T2v05L0OaD0Ou02q0d2f2y0z0C1w0h0b4gp1lLp719LjCM5EGOEJ3per00
            // https://jummbus.bitbucket.io/#j3N0bstep-graveln110s0k0l00e00t3Mm6a3g00j07i0r1O_U00o50T0v05L0OaD0Ou00q0d1f7y4z2C0wic0h0T2v01L0OaD0zu02q0d1f9y2z1C2w0Gc0h0b4gp1d0bhlCAmxID7w0
            'step-gravel': 'sfx/step-gravel.ogg',
            // https://jummbus.bitbucket.io/#j3N08step-icen100s0k0l00e00t3Mm6a3g00j07i0r1O_U0o5T0v05L0OaD0Ou00q0d1f7y4z2C0wic0h0b4p1aLp719LjCM0
            'step-ice': 'sfx/step-ice.ogg',
            // https://jummbus.bitbucket.io/#j3N0cstep-popdownn100s0k0l00e00t3Mm6a3g00j07i0r1O_U0o1T0v05L0OaD0Ou00q0d1f1y1z2C1wac0h0b4p1aJcnlAkwsS0
            'step-popdown': 'sfx/step-popdown.ogg',
            // https://jummbus.bitbucket.io/#j3N0astep-watern100s0k0l00e00t3Mm2a3g00j07i0r1O_U0o3T0v0kL0OaD0Ou00q1d6f2y0z0C1w9c0h3b4p1dJ5moMMAa16sG0
            'step-water': 'sfx/step-water.ogg',
            // https://jummbus.bitbucket.io/#j2N08teleportn110s1k0l00e00t3Mm7a3g00j07i0r1O_U00o50T0v0pL0OD0Ou00q1d1f8y4z6C2w5c4h0T2v0kL0OD0Ou02q1d7f8y4z3C1w4b4gp1wF2Uzh5wdC18yHH4hhBhHwaATXu0Asds0
            teleport: 'sfx/teleport.ogg',
            // https://jummbus.bitbucket.io/#j2N05thiefn100s1k0l00e00t3Mm3a3g00j07i0r1O_U0o1T0v0pL0OD0Ou00q1d1f5y1z8C2w2c0h0b4p1fFyUBBr9mGkKKds0
            thief: 'sfx/thief.ogg',
            // https://jummbus.bitbucket.io/#j3N0bthief-briben100s1k0l00e00t50mba3g00j07i0r1O_U0o5T0v0pL0OaD0Ou00q1d5fay0z2C1w2c0h3b4p1fF2G7P8YmgeBxNU0
            'thief-bribe': 'sfx/thief-bribe.ogg',
            // https://jummbus.bitbucket.io/#j3N0ctransmogrifyn110s1k0l00e00t3Mm7a3g00j07i0r1O_U00o50T0v0pL0OaD0Ou00q1d0f8y4z6C1w1c1h0T2v05L0OaD0Ou02q1d7f8y4zcC1w4h0b4gp1BINp2j8mhPcn1R8xQSAb8oyUiPt0l9LOYq0qU0
            transmogrify: 'sfx/transmogrify.ogg',

            // handcrafted
            lose: 'sfx/bummer.ogg',
            // https://jummbus.bitbucket.io/#j2N04tickn100s0k0l00e00t3Mmca3g00j07i0r1O_U0o2T0v0pL0OD0Ou00q1d1f7y1ziC0w4c0h4b4p1bKqE6Rtxex00
            tick: 'sfx/tick.ogg',
            // https://jummbus.bitbucket.io/#j2N06timeupn100s0k0l00e00t3Mm4a3g00j07i0r1O_U0o3T1v0pL0OD0Ou01q1d5f4y1z8C1c0A0F0B0V1Q38e0Pa610E0861b4p1dIyfgKPcLucqU0
            timeup: 'sfx/timeup.ogg',
            // https://jummbus.bitbucket.io/#j3N04exitn200s0k0l00e00t2wm9a3g00j07i0r1O_U00o32T0v0uL0OaD0Ou00q1d1f5y1z1C2w1c2Gc0h0T0v0fL0OaD0Ou00q0d1f2y1z2C0w2c3h0b4gp1rFyW4xo2FGNixYe30kOesCnOjwM0
            exit: 'sfx/exit.ogg',
            // https://jummbus.bitbucket.io/#j2N03winn200s0k0l00e00t2wm9a3g00j07i0r1O_U00o32T0v0EL0OD0Ou00q1d1f5y1z1C2w1c2h0T0v0pL0OD0Ou00q0d1f2y1z2C0w2c3h0b4gp1xFyW4xo31pe0MaCHCbwLbM5cFDgapBOyY0
            win: 'sfx/win.ogg',
            //from Ableton Retro Synths
            'revive': 'sfx/revive.ogg',
        };

        for (let [name, path] of Object.entries(this.sound_sources)) {
            this.init_sound(name, path);
        }
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
        if (! this.enabled)
            return;

        let data = this.sounds[name];
        if (! data) {
            // Hasn't loaded yet, not much we can do
            if (! this.sound_sources[name]) {
                console.warn("Tried to play non-existent sound", name);
            }
            return;
        }

        let node = this.ctx.createBufferSource();
        node.buffer = data.audiobuf;

        let volume = this.volume;
        if (cell && this.player_x !== null) {
            // Reduce the volume for further-away sounds
            let dx = cell.x - this.player_x;
            let dy = cell.y - this.player_y;
            let dist = Math.sqrt(dx*dx + dy*dy);
            // x/(x + a) is a common and delightful way to get an easy asymptote and output between
            // 0 and 1.  This arbitrary factor of 2 seems to work nicely in practice, falling off
            // quickly so you don't get drowned in button spam, but still leaving buttons audible
            // even at the far reaches of a 100×100 level.  (Maybe because gain is exponential?)
            volume *= 1 - dist / (dist + 2);
        }
        let gain = this.ctx.createGain();
        gain.gain.value = volume;
        node.connect(gain);
        gain.connect(this.compressor_node);
        node.start(this.ctx.currentTime);
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

        this.level_el = this.root.querySelector('.level');
        this.overlay_message_el = this.root.querySelector('.overlay-message');
        this.hint_el = this.root.querySelector('.player-hint');
        this.chips_el = this.root.querySelector('.chips output');
        this.time_el = this.root.querySelector('.time output');
        this.bonus_el = this.root.querySelector('.bonus output');
        this.inventory_el = this.root.querySelector('.inventory');

        this.music_el = this.root.querySelector('#player-music');
        this.music_audio_el = this.music_el.querySelector('audio');
        this.music_index = null;

        this.turn_based_mode = false;
        this.turn_based_mode_waiting = false;
        this.turn_based_checkbox = this.root.querySelector('.control-turn-based');
        this.turn_based_checkbox.checked = false;
        this.turn_based_checkbox.addEventListener('change', ev => {
            this.turn_based_mode = this.turn_based_checkbox.checked;
        });

        // Bind buttons
        this.pause_button = this.root.querySelector('.control-pause');
        this.pause_button.addEventListener('click', ev => {
            this.toggle_pause();
            ev.target.blur();
        });
        this.restart_button = this.root.querySelector('.control-restart');
        this.restart_button.addEventListener('click', ev => {
            new ConfirmOverlay(this.conductor, "Abandon this attempt and try again?", () => {
                this.restart_level();
            }).open();
            ev.target.blur();
        });
        this.undo_button = this.root.querySelector('.control-undo');
        this.undo_button.addEventListener('click', ev => {
            this.undo_last_move();
            ev.target.blur();
        });
        this.rewind_button = this.root.querySelector('.control-rewind');
        this.rewind_button.addEventListener('click', ev => {
            if (this.state === 'rewinding') {
                this.set_state('playing');
            }
            else if (this.level.has_undo()) {
                this.set_state('rewinding');
            }
        });
        // Game actions
        this.drop_button = this.root.querySelector('#player-actions .action-drop');
        this.drop_button.addEventListener('click', ev => {
            // Use the set of "buttons pressed between tics" because it's cleared automatically;
            // otherwise these will stick around forever
            this.current_keys_new.add('q');
            ev.target.blur();
        });
        this.cycle_button = this.root.querySelector('#player-actions .action-cycle');
        this.cycle_button.addEventListener('click', ev => {
            this.current_keys_new.add('e');
            ev.target.blur();
        });
        this.swap_button = this.root.querySelector('#player-actions .action-swap');
        this.swap_button.addEventListener('click', ev => {
            this.current_keys_new.add('c');
            ev.target.blur();
        });

        this.use_interpolation = true;
        // Default to the LL tileset for safety, but change when we load a level
        // (Note also that this must be created in the constructor so the CC2 timing option can be
        // applied to it)
        this.renderer = new CanvasRenderer(this.conductor.tilesets['ll']);
        this._loaded_tileset = false;
        this.level_el.append(this.renderer.canvas);

        // Populate a skeleton inventory
        this.inventory_key_nodes = {};
        this.inventory_tool_nodes = [];
        for (let key of ['key_red', 'key_blue', 'key_yellow', 'key_green']) {
            let img = mk('img');  // drawn in update_tileset
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
        this.using_touch = false;  // true if using touch controls
        this.current_keys = new Set;  // keys that are currently held
        this.current_keys_new = new Set; // keys that were pressed since input was last read
        // TODO this could all probably be more rigorous but it's fine for now
        key_target.addEventListener('keydown', ev => {
            if (! this.active)
                return;
            this.using_touch = false;

            // Ignore IME composition
            if (ev.isComposing || ev.keyCode === 229)
                return;

            // For key repeat of keys we're listening to, we still want to preventDefault, but we
            // don't actually want to do anything.  That would be really hard except the only keys
            // we care about preventDefaulting are action ones
            // TODO what if a particular browser does something for p/,/.?
            if (ev.repeat) {
                if (this.key_mapping[ev.key]) {
                    ev.preventDefault();
                    ev.stopPropagation();
                }
                return;
            }

            if (ev.key === 'p' || ev.key === 'Pause') {
                this.toggle_pause();
                return;
            }

            // Per-tic navigation; only useful if the game isn't running
            if (ev.key === ',') {
                if (this.state === 'stopped' || this.state === 'paused' || this.turn_based_mode) {
                    this.set_state('paused');
                    this.undo();
                    this.update_ui();
                    this._redraw();
                }
                return;
            }
            if (ev.key === '.') {
                if (this.state === 'waiting' || this.state === 'paused' || this.turn_based_mode) {
                    if (this.state === 'waiting') {
                        if (this.turn_based_mode) {
                            this.set_state('playing');
                        }
                        else {
                            this.set_state('paused');
                        }
                    }
                    if (this.level.update_rate === 1) {
                        if (ev.altKey) {
                            // Advance one frame
                            this.advance_by(1, true, true);
                        }
                        else {
                            // Advance until the next decision frame, when frame_offset === 2
                            this.advance_by((5 - this.level.frame_offset) % 3 || 3, true, true);
                        }
                    }
                    else {
                        // Advance one tic
                        this.advance_by(1, true);
                    }
                    this._redraw();
                }
                return;
            }

            if (ev.key === ' ') {
                // Don't scroll pls
                ev.preventDefault();

                if (this.state === 'waiting') {
                    // Start without moving
                    this.set_state('playing');
                    return;
                }
                else if (this.state === 'paused') {
                    // Turns out I do this an awful lot expecting it to work, so
                    this.set_state('playing');
                    return;
                }
                else if (this.state === 'stopped') {
                    if (this.level.state === 'success') {
                        // Advance to the next level, if any
                        if (this.conductor.level_index < this.conductor.stored_game.level_metadata.length - 1) {
                            this.conductor.change_level(this.conductor.level_index + 1);
                        }
                        else {
                            // TODO for CCLs, by default, this is also at level 144
                            this.set_state('ended');
                            this.update_ui();
                        }
                    }
                    else {
                        // Restart
                        if (!this.current_keys.has(ev.key)) {
                            this.restart_level();
                        }
                    }
                    return;
                }
            }

            if (ev.key === 'z') {
                if (this.level.has_undo() &&
                    (this.state === 'stopped' || this.state === 'playing' || this.state === 'paused'))
                {
                    this.set_state('rewinding');
                }
                return;
            }
            if (ev.key === 'u') {
                if (this.level.has_undo() &&
                    (this.state === 'stopped' || this.state === 'playing' || this.state === 'paused'))
                {
                    this.undo_last_move();
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
        this.touch_restart_delay = new util.DelayTimer;
        let touch_target = this.root.querySelector('#player-game-area');
        let collect_touches = ev => {
            ev.stopPropagation();
            ev.preventDefault();
            this.using_touch = true;

            // If state is anything other than playing/waiting, probably switch to playing, similar
            // to pressing spacebar
            if (ev.type === 'touchstart') {
                if (this.state === 'paused') {
                    this.toggle_pause();
                    return;
                }
                else if (this.state === 'stopped') {
                    if (this.touch_restart_delay.active) {
                        // If it's only been a very short time since the level ended, ignore taps
                        // here, so you don't accidentally mash restart and lose the chance to undo
                    }
                    else if (this.level.state === 'success') {
                        // Advance to the next level
                        // TODO game ending?
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

        this.debug = { enabled: false };

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
        if (this._start_in_debug_mode) {
            this.setup_debug();
        }
    }

    // Link up the debug panel and enable debug features
    // (note that this might be called /before/ setup!)
    setup_debug() {
        document.body.classList.add('--debug');
        document.querySelector('#header-icon').src = 'icon-debug.png';
        let debug_el = this.root.querySelector('#player-debug');
        this.debug = {
            enabled: true,
            time_tics_el: this.root.querySelector('#player-debug-time-tics'),
            time_moves_el: this.root.querySelector('#player-debug-time-moves'),
            time_secs_el: this.root.querySelector('#player-debug-time-secs'),
        };

        let make_button = (label, onclick) => {
            let button = mk('button', {type: 'button'}, label);
            button.addEventListener('click', onclick);
            return button;
        };

        // -- Time --
        // Hook up back/forward buttons
        debug_el.querySelector('.-time-controls').addEventListener('click', ev => {
            let button = ev.target.closest('button.-time-button');
            if (! button)
                return;

            let dt = parseInt(button.getAttribute('data-dt'));
            if (dt > 0) {
                if (this.state === 'stopped') {
                    return;
                }
                this.set_state('paused');

                this.advance_by(dt, true);
            }
            else if (dt < 0) {
                if (this.state === 'waiting') {
                    return;
                }
                this.set_state('paused');

                for (let i = 0; i < -dt; i++) {
                    if (! this.level.has_undo())
                        break;
                    this.undo();
                }
            }
            this._redraw();
            this.update_ui();
        });
        // Add buttons for affecting the clock
        debug_el.querySelector('#player-debug-time-buttons').append(
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
        // Hook up play speed
        debug_el.elements.speed.value = "1";
        debug_el.querySelector('#player-debug-speed').addEventListener('change', ev => {
            let speed = debug_el.elements.speed.value;
            let [numer, denom] = speed.split('/');
            this.play_speed = parseInt(numer, 10) / parseInt(denom ?? '1', 10);
        });

        // -- Inventory --
        // Add a button for every kind of inventory item
        let inventory_el = debug_el.querySelector('.-inventory');
        for (let name of [
            'key_blue', 'key_red', 'key_yellow', 'key_green',
            'xray_eye', 'foil', 'lightning_bolt', 'hook',
            'flippers', 'fire_boots', 'cleats', 'suction_boots',
            'hiking_boots', 'speed_boots', 'railroad_sign', 'helmet',
            'bribe', 'bowling_ball', 'dynamite',
        ]) {
            inventory_el.append(make_button(
                mk('img', {src: this.render_inventory_tile(name)}),
                () => {
                    this.level.give_actor(this.level.player, name);
                    this.update_ui();
                }));
        }
        // Add a button to clear your inventory
        let clear_button = mk('button.-wide', {type: 'button'}, "clear inventory");
        clear_button.addEventListener('click', ev => {
            this.level.take_all_keys_from_actor(this.level.player);
            this.level.take_all_tools_from_actor(this.level.player);
            this.update_ui();
        });
        inventory_el.append(clear_button);

        // -- Replay --
        // Create the input grid
        let input_el = debug_el.querySelector('#player-debug-input');
        this.debug.input_els = {};
        for (let [action, label] of Object.entries({up: 'W', left: 'A', down: 'S', right: 'D', drop: 'Q', cycle: 'E', swap: 'C'})) {
            let el = mk_svg('svg.svg-icon', {viewBox: '0 0 16 16'},
                mk_svg('use', {href: `#svg-icon-${action}`}));
            el.style.gridArea = action;
            this.debug.input_els[action] = el;
            input_el.append(el);
        }
        // There are two replay slots: the (read-only) one baked into the level, and the one you are
        // editing.  You can also transfer them back and forth.
        // This is the level slot
        let extra_replay_elements = [];
        extra_replay_elements.push(mk('hr'));
        this.debug.replay_level_label = mk('p', this.level && this.level.stored_level.has_replay ? "available" : "none");
        extra_replay_elements.push(mk('div.-replay-available', mk('h4', "From level:"), this.debug.replay_level_label));
        this.debug.replay_level_buttons = [
            make_button("Play", () => {
                if (! this.level.stored_level.has_replay)
                    return;
                this.confirm_game_interruption("Restart this level to watch the level's built-in replay?", () => {
                    this.restart_level();
                    let replay = this.level.stored_level.replay;
                    this.install_replay(replay, 'level');
                    this.debug.replay_level_label.textContent = format_replay_duration(replay.duration);
                });
            }),
            make_button("Edit", () => {
                if (! this.level.stored_level.has_replay)
                    return;
                this.debug.custom_replay = this.level.stored_level.replay;
                this._update_replay_ui();
                this.debug.replay_custom_label.textContent = format_replay_duration(this.debug.custom_replay.duration);
            }),
            make_button("Copy", ev => {
                let stored_level = this.level.stored_level;
                if (! stored_level.has_replay)
                    return;

                let data;
                if (stored_level._replay_decoder === c2g.decode_replay) {
                    // No need to decode it just to encode it again
                    data = stored_level._replay_data;
                }
                else {
                    data = c2g.encode_replay(stored_level.replay);
                }
                // This prefix is LLDEMO in base64 (it's 6 characters so it becomes exactly 8 base64
                // chars and won't entangle with any other characters)
                navigator.clipboard.writeText(REPLAY_PREFIX + util.b64encode(data));
                flash_button(ev.target);
            }),
            // TODO delete
            // TODO download entire demo as a file (???)
        ];
        extra_replay_elements.push(mk('div.-buttons', ...this.debug.replay_level_buttons));
        // This is the custom slot, which has rather a few more buttons
        extra_replay_elements.push(mk('hr'));
        this.debug.replay_custom_label = mk('p', "none");
        extra_replay_elements.push(mk('div.-replay-available', mk('h4', "Custom:"), this.debug.replay_custom_label));
        extra_replay_elements.push(mk('div.-buttons',
            make_button("Record new", () => {
                this.confirm_game_interruption("Restart this level to record a replay?", () => {
                    this.restart_level();
                    let replay = new format_base.Replay(
                        this.level.force_floor_direction, this.level._blob_modifier);
                    this.install_replay(replay, 'custom', true);
                    this.debug.custom_replay = replay;
                    this.debug.replay_custom_label.textContent = format_replay_duration(replay.duration);
                    this._update_replay_ui();
                });
            }),
            // TODO load from a file?
            make_button("Paste", async ev => {
                // FIXME firefox doesn't let this fly; provide a textbox instead
                let string = await navigator.clipboard.readText();
                if (string.substring(0, REPLAY_PREFIX.length) !== REPLAY_PREFIX) {
                    alert("Not a valid replay string, sorry!");
                    return;
                }

                let replay = c2g.decode_replay(util.b64decode(string.substring(REPLAY_PREFIX.length)));
                this.debug.custom_replay = replay;
                this.debug.replay_custom_label.textContent = format_replay_duration(replay.duration);
                this._update_replay_ui();
                flash_button(ev.target);
            }),
        ));
        let row1 = [
            make_button("Play", () => {
                if (! this.debug.custom_replay)
                    return;
                this.confirm_game_interruption("Restart this level to watch your custom replay?", () => {
                    this.restart_level();
                    let replay = this.debug.custom_replay;
                    this.install_replay(replay, 'custom');
                    this.debug.replay_custom_label.textContent = format_replay_duration(replay.duration);
                });
            }),
            /*
            make_button("Record from here", () => {
                // TODO this feels poorly thought out i guess
            }),
            */
        ];
        let row2 = [
            make_button("Save to level", () => {
                if (! this.debug.custom_replay)
                    return;

                this.level.stored_level._replay = this.debug.custom_replay.clone();
                this.level.stored_level._replay_data = null;
                this.level.stored_level._replay_decoder = null;
                this.debug.replay_level_label.textContent = format_replay_duration(this.debug.custom_replay.duration);
                this._update_replay_ui();
            }),
            make_button("Copy", ev => {
                if (! this.debug.custom_replay)
                    return;

                let data = c2g.encode_replay(this.debug.custom_replay);
                navigator.clipboard.writeText(REPLAY_PREFIX + util.b64encode(data));
                flash_button(ev.target);
            }),
            // TODO download?  as what?
        ];
        extra_replay_elements.push(mk('div.-buttons', ...row1));
        extra_replay_elements.push(mk('div.-buttons', ...row2));
        this.debug.replay_custom_buttons = [...row1, ...row2];
        // XXX this is an experimental API but it's been supported by The Two Browsers for ages
        debug_el.querySelector('.-replay-columns').after(...extra_replay_elements);
        this._update_replay_ui();

        // Progress bar and whatnot
        let replay_playback_el = debug_el.querySelector('.-replay-status > .-playback');
        this.debug.replay_playback_el = replay_playback_el;
        this.debug.replay_progress_el = replay_playback_el.querySelector('progress');
        this.debug.replay_percent_el = replay_playback_el.querySelector('output');
        this.debug.replay_duration_el = replay_playback_el.querySelector('span');

        // -- Misc --
        // Viewport size
        let viewport_el = this.root.querySelector('#player-debug-viewport');
        viewport_el.value = "default";
        viewport_el.addEventListener('change', ev => {
            let viewport = ev.target.value;
            if (viewport === 'default') {
                this.debug.viewport_size_override = null;
            }
            else if (viewport === 'max') {
                this.debug.viewport_size_override = 'max';
            }
            else {
                this.debug.viewport_size_override = parseInt(viewport, 10);
            }
            this.update_viewport_size();
            this._redraw();
        });
        // Various checkboxes
        let wire_checkbox = (name, onclick) => {
            let checkbox = debug_el.elements[name];
            checkbox.checked = false;  // override browser memory
            checkbox.addEventListener('click', onclick);
        };
        wire_checkbox('show_actor_bboxes', ev => {
            this.renderer.show_actor_bboxes = ev.target.checked;
            this._redraw();
        });
        wire_checkbox('show_actor_order', ev => {
            this.renderer.show_actor_order = ev.target.checked;
            this._redraw();
        });
        wire_checkbox('show_actor_tooltips', ev => {
            if (ev.target.checked) {
                let element = mk('div.player-debug-actor-tooltip');
                let header = mk('h3');
                let dl = mk('dl');
                let props = {};
                for (let key of ['direction', 'movement_speed', 'movement_cooldown', 'slide_mode']) {
                    let dd = mk('dd');
                    props[key] = dd;
                    dl.append(mk('dt', key), dd);
                }
                let inventory = mk('p');
                element.append(header, dl, inventory);
                this.debug.actor_tooltip = {element, header, props, inventory};
                document.body.append(element);
            }
            else if (this.debug.actor_tooltip) {
                this.debug.actor_tooltip.element.remove();
                this.debug.actor_tooltip = null;
            }
        });
        wire_checkbox('disable_interpolation', ev => {
            this.use_interpolation = ! ev.target.checked;
            this._redraw();
        });
        debug_el.querySelector('#player-debug-misc-buttons').append(
            make_button("green button", () => {
                TILE_TYPES['button_green'].do_button(this.level);
                this._redraw();
            }),
            make_button("blue button", () => {
                TILE_TYPES['button_blue'].do_button(this.level);
                this._redraw();
            }),
        );

        // Bind some debug events on the canvas
        this.renderer.canvas.addEventListener('auxclick', ev => {
            if (ev.button !== 1)
                return;

            if (this.state === 'stopped')
                return;
            let [x, y] = this.renderer.cell_coords_from_event(ev);
            this.level.move_to(this.level.player, this.level.cell(x, y));
            if (this.state === 'waiting') {
                this.set_state('paused');
            }
            this._redraw();
        });
        this.renderer.canvas.addEventListener('mousemove', ev => {
            let tooltip = this.debug.actor_tooltip;
            if (! tooltip)
                return;

            // FIXME this doesn't work so well for actors in motion  :S
            // TODO show bounding box for hovered actor?
            let [x, y] = this.renderer.cell_coords_from_event(ev);
            // TODO should update the tooltip if the game advances but the mouse doesn't move
            let cell = this.level.cell(x, y);
            let actor = cell.get_actor();
            tooltip.element.classList.toggle('--visible', actor);
            if (! actor)
                return;

            tooltip.element.style.left = `${ev.clientX}px`;
            tooltip.element.style.top = `${ev.clientY}px`;
            tooltip.header.textContent = actor.type.name;
            for (let [key, element] of Object.entries(tooltip.props)) {
                element.textContent = String(actor[key] ?? "—");
            }

            // TODO it would be cool to use icons and whatever for this, but that would be tricky to
            // do without serious canvas churn
            let inv = [];
            if (actor.keyring) {
                for (let [key, count] of Object.entries(actor.keyring)) {
                    inv.push(`${key} ×${count}`);
                }
            }
            if (actor.toolbelt) {
                for (let tool of actor.toolbelt) {
                    inv.push(tool);
                }
            }
            tooltip.inventory.textContent = inv.join(', ');
        });
        this.renderer.canvas.addEventListener('mouseout', ev => {
            if (this.debug.actor_tooltip) {
                this.debug.actor_tooltip.element.classList.remove('--visible');
            }
        });

        this.adjust_scale();
        if (this.level) {
            this.update_ui();
        }
    }

    _update_replay_ui() {
        if (! this.debug.enabled)
            return;

        let has_level_replay = (this.level && this.level.stored_level.has_replay);
        for (let button of this.debug.replay_level_buttons) {
            button.disabled = ! has_level_replay;
        }

        let has_custom_replay = !! this.debug.custom_replay;
        for (let button of this.debug.replay_custom_buttons) {
            button.disabled = ! has_custom_replay;
        }
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

    reload_options(options) {
        this.music_audio_el.volume = options.music_volume ?? 1.0;
        // TODO hide music info when disabled?
        this.music_enabled = options.music_enabled ?? true;
        this.sfx_player.volume = options.sound_volume ?? 1.0;
        this.sfx_player.enabled = options.sound_enabled ?? true;
        this.renderer.use_cc2_anim_speed = options.use_cc2_anim_speed ?? false;

        if (this.level) {
            this.update_tileset();
            this._redraw();
        }
    }

    update_tileset() {
        if (! this.level)
            return;

        let tileset = this.conductor.choose_tileset_for_level(this.level.stored_level);
        if (tileset === this.renderer.tileset && this._loaded_tileset)
            return;
        this._loaded_tileset = true;

        this.renderer.set_tileset(tileset);
        this.root.style.setProperty('--tile-width', `${tileset.size_x}px`);
        this.root.style.setProperty('--tile-height', `${tileset.size_y}px`);

        this._inventory_tiles = {};  // flush the render_inventory_tile cache
        let floor_tile = this.render_inventory_tile('floor');
        this.inventory_el.style.backgroundImage = `url(${floor_tile})`;
        for (let [key, nodes] of Object.entries(this.inventory_key_nodes)) {
            nodes.img.src = this.render_inventory_tile(key);
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

        this.level = new Level(stored_level, this.conductor.compat);
        this.level.sfx = this.sfx_player;
        this.update_tileset();
        this.renderer.set_level(this.level);
        this.update_viewport_size();
        // TODO base this on a hash of the UA + some identifier for the pack + the level index.  StoredLevel doesn't know its own index atm...
        this.change_music(this.conductor.level_index % SOUNDTRACK.length);
        this._clear_state();

        this._update_replay_ui();
        if (this.debug.enabled) {
            this.debug.replay_level_label.textContent = this.level.stored_level.has_replay ? "available" : "none";
        }
    }

    update_viewport_size() {
        let w, h;
        if (this.debug.enabled && this.debug.viewport_size_override) {
            if (this.debug.viewport_size_override === 'max') {
                w = this.level.size_x;
                h = this.level.size_y;
            }
            else {
                w = h = this.debug.viewport_size_override;
            }
        }
        else {
            w = h = this.conductor.stored_level.viewport_size;
        }
        this.renderer.set_viewport_size(w, h);
        this.renderer.canvas.style.setProperty('--viewport-width', w);
        this.renderer.canvas.style.setProperty('--viewport-height', h);
        // TODO only if the size changed?
        this.adjust_scale();
    }

    restart_level() {
        this.level.restart(this.conductor.compat);
        this._clear_state();
    }

    // Call after loading or restarting a level
    _clear_state() {
        this.set_state('waiting');

        this.turn_based_mode_waiting = false;
        this.last_advance = 0;
        this.current_keyring = {};
        this.current_toolbelt = [];
        this.previous_hint_tile = null;

        this.chips_el.classList.remove('--done');
        this.time_el.classList.remove('--frozen');
        this.time_el.classList.remove('--danger');
        this.time_el.classList.remove('--warning');
        this.hint_el.parentNode.classList.remove('--visible');
        this.root.classList.remove('--replay-playback');
        this.root.classList.remove('--replay-recording');
        this.root.classList.remove('--bonus-visible');
        this.root.classList.toggle('--hide-logic', this.level.stored_level.hide_logic);
        this.root.classList.toggle('--cc1-boots', this.level.stored_level.use_cc1_boots);

        if (this.debug.enabled) {
            this.debug.replay = null;
            this.debug.replay_slot = null;
            this.debug.replay_recording = false;
        }

        // We promise we're updating at 60fps if the level supports it, so tell the renderer
        // (This happens here because we could technically still do 20tps if we wanted, and the
        // renderer doesn't actually have any way to know that)
        this.renderer.update_rate = this.level.update_rate;
        // Likewise, we don't want this automatically read from the level, but we do respect it here
        this.renderer.hide_logic = this.level.stored_level.hide_logic;

        this.update_ui();
        // Force a redraw, which won't happen on its own since the game isn't running
        this._redraw();
    }

    open_level_browser() {
        new LevelBrowserOverlay(this.conductor).open();
    }

    install_replay(replay, slot, record = false) {
        if (! this.debug.enabled)
            return;

        this.debug.replay = replay;
        this.debug.replay_slot = slot;
        this.debug.replay_recording = record;
        this.debug.replay_playback_el.style.display = '';
        let t = replay.duration;
        this.debug.replay_progress_el.setAttribute('max', t);
        this.debug.replay_duration_el.textContent = format_replay_duration(t);

        if (! record) {
            replay.configure_level(this.level);
            // FIXME should probably start playback on first real input
            this.set_state('playing');
        }

        this.root.classList.toggle('--replay-playback', ! record);
        this.root.classList.toggle('--replay-recording', record);
    }

    get_input() {
        let input;
        if (this.debug && this.debug.replay && ! this.debug.replay_recording) {
            input = this.debug.replay.get(this.level.tic_counter);
        }
        else {
            // Convert input keys to actions
            input = 0;
            for (let key of this.current_keys) {
                input |= INPUT_BITS[this.key_mapping[key]];
            }
            for (let key of this.current_keys_new) {
                input |= INPUT_BITS[this.key_mapping[key]];
            }
            this.current_keys_new.clear();
            for (let action of Object.values(this.current_touches)) {
                input |= INPUT_BITS[action];
            }
        }

        if (this.debug.enabled) {
            for (let [action, el] of Object.entries(this.debug.input_els)) {
                el.classList.toggle('--held', (input & INPUT_BITS[action]) !== 0);
            }
        }

        return input;
    }

    advance_by(tics, force = false, use_frames = false) {
        let crossed_tic_boundary = false;
        for (let i = 0; i < tics; i++) {
            // FIXME turn-based mode should be disabled during a replay
            let input = this.get_input();
            // Extract the fake 'wait' bit, if any
            let wait = input & INPUT_BITS['wait'];
            input &= ~wait;

            if (this.debug && this.debug.replay && this.debug.replay_recording) {
                this.debug.replay.set(this.level.tic_counter, input);
            }

            if (this.turn_based_mode) {
                // Turn-based mode is considered assistance, but only if the game actually attempts
                // to progress while it's enabled
                this.level.aid = Math.max(1, this.level.aid);

                // If we're in turn-based mode and could provide input here, but don't have any,
                // then wait until we do
                if (this.level.can_accept_input() && ! input && ! wait && ! force) {
                    this.turn_based_mode_waiting = true;
                    continue;
                }
            }

            this.turn_based_mode_waiting = false;
            if (use_frames) {
                this.level.advance_frame(input);
                if (this.level.frame_offset === 0) {
                    crossed_tic_boundary = true;
                }
            }
            else {
                this.level.advance_tic(input);
                crossed_tic_boundary = true;
            }

            // FIXME don't do this til we would next advance?  or some other way let it play out
            if (this.level.state !== 'playing') {
                // We either won or lost!
                this.set_state('stopped');
                break;
            }
        }

        this.update_ui();
        if (this.debug && this.debug.replay && this.debug.replay_recording) {
            this.debug.replay_custom_label.textContent = format_replay_duration(this.debug.custom_replay.duration);
        }
    }

    // Main driver of the level; advances by one tic, then schedules itself to
    // be called again next tic
    advance() {
        if (this.state !== 'playing' && this.state !== 'rewinding') {
            this._advance_handle = null;
            return;
        }

        this.last_advance = performance.now();

        // If the game is running faster than normal, we cap the timeout between game loops at 10ms
        // and do multiple loops at a time
        // (Note that this is a debug feature so precision is not a huge deal and I don't bother
        // tracking fractional updates, but asking to run at 10× and only getting 2× would suck)
        let num_advances = 1;
        let dt = 1000 / (TICS_PER_SECOND * this.play_speed);
        let use_frames = this.state === 'playing' && this.level.update_rate === 1;
        if (use_frames) {
            dt /= 3;
        }
        if (dt < 10) {
            num_advances = Math.ceil(10 / dt);
            dt = 10;
        }

        // Set the new timeout FIRST, so the time it takes to update the game doesn't count against
        // the framerate
        if (this.state === 'rewinding') {
            // Rewind faster than normal time
            dt *= 0.5;
        }
        this._advance_handle = window.setTimeout(this._advance_bound, dt);

        if (this.state === 'playing') {
            this.advance_by(num_advances, false, use_frames);
        }
        else if (this.state === 'rewinding') {
            if (this.level.has_undo()) {
                // Rewind by undoing one tic every tic
                for (let i = 0; i < num_advances; i++) {
                    this.undo();
                }
                this.update_ui();
            }
            // If there are no undo entries left, freeze in place until the player stops rewinding,
            // which I think is ye olde VHS behavior
            // TODO detect if we hit the start of the level (rather than just running the undo
            // buffer dry) and change to 'waiting' instead?
        }
    }

    undo() {
        this.level.undo();
    }

    undo_last_move() {
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
    }

    // Redraws every frame, unless the game isn't running
    redraw() {
        let update_progress;
        if (this.turn_based_mode_waiting || ! this.use_interpolation) {
            // We're dawdling between tics, so nothing is actually animating, but the clock hasn't
            // advanced yet; pretend whatever's currently animating has finished
            update_progress = 1;
        }
        else {
            // Figure out how far we are between the last game update and the next one, so the
            // renderer can interpolate appropriately.
            let now = performance.now();
            let elapsed = (performance.now() - this.last_advance) / 1000;
            let speed = this.play_speed;
            if (this.state === 'rewinding') {
                speed *= 2;
            }
            update_progress = elapsed * TICS_PER_SECOND * (3 / this.level.update_rate) * speed;
            update_progress = Math.min(1, update_progress);
            if (this.state === 'rewinding') {
                update_progress = 1 - update_progress;
            }
        }

        this._redraw(update_progress);

        // Check for a stopped game *after* drawing, so that when the game ends, we still animate
        // its final tic before stopping the draw loop
        // TODO stop redrawing when waiting on turn-based mode?  but then, when is it restarted
        if (this.state === 'playing' || this.state === 'rewinding' ||
            (this.state === 'stopped' && update_progress < 0.99))
        {
            this._redraw_handle = requestAnimationFrame(this._redraw_bound);
        }
        else {
            this._redraw_handle = null;
        }
    }

    // Actually redraw.  Used to force drawing outside of normal play, in which case we don't
    // interpolate (because we're probably paused)
    _redraw(update_progress = null) {
        if (update_progress === null) {
            // Default to drawing the "end" state of the tic when we're paused; the renderer
            // interpolates backwards, so this will show the actual state of the game
            if (this.state === 'paused') {
                update_progress = 1;
            }
            else {
                update_progress = 0;
            }
        }
        // Never try to draw past the next actual update
        this.renderer.draw(Math.min(0.999, update_progress));
    }

    render_inventory_tile(name) {
        if (! this._inventory_tiles[name]) {
            // TODO reuse the canvas for data urls
            let canvas = this.renderer.draw_single_tile_type(name);
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
        this.swap_button.disabled = ! (this.state === 'playing' && this.level.remaining_players > 1);

        // TODO can we do this only if they actually changed?
        this.chips_el.textContent = this.level.chips_remaining;
        this.chips_el.classList.toggle('--done', this.level.chips_remaining === 0);

        this.time_el.classList.toggle('--frozen', this.level.time_remaining === null || this.level.timer_paused);
        if (this.level.time_remaining === null) {
            this.time_el.textContent = '---';
        }
        else {
            this.time_el.textContent = Math.ceil(this.level.time_remaining / TICS_PER_SECOND);
            this.time_el.classList.toggle('--warning', this.level.time_remaining < 30 * TICS_PER_SECOND);
            this.time_el.classList.toggle('--danger', this.level.time_remaining < 10 * TICS_PER_SECOND);
        }

        this.bonus_el.textContent = simplify_number(this.level.bonus_points);
        if (this.level.bonus_points > 0) {
            this.root.classList.add('--bonus-visible');
        }

        // Check for the player standing on a hint tile; this is slightly invasive but lets us
        // notice exactly when it changes (and anyway it's a UI thing, not gameplay)
        let terrain = this.level.player.cell.get_terrain();
        let hint_tile = null;
        if (terrain.type.is_hint) {
            hint_tile = terrain;
        }
        if (hint_tile !== this.previous_hint_tile) {
            this.previous_hint_tile = hint_tile;
            this.hint_el.textContent = '';
            this.hint_el.parentNode.classList.toggle('--visible', !! hint_tile);
            if (hint_tile) {
                // Parse out %X sequences and replace them with <kbd> elements
                let hint_text = hint_tile.hint_text;
                for (let [i, chunk] of hint_text.split(/%(\w)/).entries()) {
                    if (i % 2 === 0) {
                        this.hint_el.append(chunk);
                    }
                    else {
                        // TODO better place to get these?
                        // TODO 1 through 7 are player 2's inputs in split-screen mode
                        let key = {
                            // up, down, left, right
                            U: 'W', D: 'S', L: 'A', R: 'D',
                            // drop, cycle, swap
                            P: 'Q', C: 'E', S: 'C',
                        }[chunk] ?? "?";
                        this.hint_el.append(mk('kbd', key));
                    }
                }
            }
        }

        this.renderer.set_active_player(this.level.remaining_players > 1 ? this.level.player : null);

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

        this.renderer.perception = (this.level && this.level.player.has_item('xray_eye')) ? 'xray' : 'normal';

        if (this.debug.enabled) {
            let t = this.level.tic_counter;
            let current_tic = String(t);
            if (this.level.frame_offset === 1) {
                current_tic += "⅓";
            }
            else if (this.level.frame_offset === 2) {
                current_tic += "⅔";
            }
            this.debug.time_tics_el.textContent = current_tic;
            this.debug.time_moves_el.textContent = `${Math.floor(t/4)}`;
            this.debug.time_secs_el.textContent = (t / 20).toFixed(2);

            if (this.debug.replay) {
                this.debug.replay_progress_el.setAttribute('value', t);
                this.debug.replay_percent_el.textContent = `${Math.floor((t + 1) / this.debug.replay.duration * 100)}%`;
            }
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
        // Turn-based mode doesn't need this
        if (this.turn_based_mode)
            return;

        this.set_state('paused');
    }

    // waiting: haven't yet pressed a key so the timer isn't going
    // playing: playing normally
    // paused: um, paused
    // rewinding: playing backwards
    // stopped: level has ended one way or another
    // ended: final level has been completed
    set_state(new_state) {
        // Keep going even if we're doing waiting -> waiting, because the overlay contains the level
        // name and author which may have changed
        if (new_state === this.state && new_state !== 'waiting')
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
            let stored_level = this.level.stored_level;
            overlay_top = `#${stored_level.number} ${stored_level.title}`;
            overlay_middle = "Ready!";
            if (stored_level.author) {
                overlay_bottom = `by ${stored_level.author}`;
            }
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
            // Set a timer before tapping the overlay will restart/advance
            this.touch_restart_delay.set(2000);

            if (this.level.state === 'failure') {
                overlay_reason = 'failure';
                overlay_top = "whoops";
                let obits = OBITUARIES[this.level.fail_reason] ?? OBITUARIES['generic'];
                overlay_bottom = random_choice(obits);
                if (this.using_touch) {
                    // TODO touch gesture to rewind?
                    overlay_keyhint = "tap to try again, or use undo/rewind above";
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
                let old_scorecard = savefile.scorecards[level_index];
                if (! this.debug.enabled) {
                    // Merge any improved stats into the old scorecard, and update the totals.  All
                    // four of these stats are tracked independently: least aid, best score, highest
                    // clock, lowest real time
                    let new_scorecard = old_scorecard ? { ...old_scorecard } : {};

                    if (! old_scorecard) {
                        savefile.cleared_levels = (savefile.cleared_levels ?? 0) + 1;
                    }

                    // Aid
                    if (! old_scorecard || scorecard.aid < old_scorecard.aid) {
                        new_scorecard.aid = scorecard.aid;
                        if (scorecard.aid === 0) {
                            savefile.aidless_levels = (savefile.aidless_levels ?? 0) + 1;
                        }
                    }

                    // Score
                    if (! old_scorecard || scorecard.score > old_scorecard.score) {
                        new_scorecard.score = scorecard.score;
                        savefile.total_score = savefile.total_score ?? 0;
                        if (old_scorecard) {
                            savefile.total_score -= old_scorecard.score;
                        }
                        savefile.total_score += scorecard.score;
                    }

                    // Real time
                    if (! old_scorecard || scorecard.abstime < old_scorecard.abstime) {
                        new_scorecard.abstime = scorecard.abstime;
                        savefile.total_abstime = savefile.total_abstime ?? 0;
                        if (old_scorecard) {
                            savefile.total_abstime -= old_scorecard.abstime;
                        }
                        savefile.total_abstime += scorecard.abstime;
                    }

                    // Clock time
                    if (! old_scorecard || scorecard.time > old_scorecard.time) {
                        new_scorecard.time = scorecard.time;
                        // There's no running total of clock times
                    }

                    savefile.total_levels = this.conductor.stored_game.level_metadata.length;
                    savefile.scorecards[level_index] = new_scorecard;
                    this.conductor.save_savefile();
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
                    mk('dt.-component', "base score"),
                    mk('dd.-component', base.toLocaleString()),
                    mk('dt.-component', "time bonus"),
                    mk('dd.-component', `+ ${time.toLocaleString()}`),
                );
                if (this.level.bonus_points) {
                    overlay_middle.append(
                        mk('dt.-component', "score bonus"),
                        mk('dd.-component', `+ ${this.level.bonus_points.toLocaleString()}`),
                    );
                }

                // TODO show your time, time improvement...?
                let score_dd = mk('dd.-sum', scorecard.score.toLocaleString());
                if (scorecard.aid === 0) {
                    score_dd.append(mk('span.-star', "★"));
                }
                overlay_middle.append(mk('dt.-sum', "level score"), score_dd);

                overlay_middle.append(
                    mk('dt.-total', "total score"),
                    mk('dd.-total', savefile.total_score.toLocaleString()),
                );

                if (old_scorecard && old_scorecard.score < scorecard.score) {
                    overlay_middle.append(
                        mk('dd.-total', `(+ ${(scorecard.score - old_scorecard.score).toLocaleString()})`),
                    );
                }
                else {
                    overlay_middle.append(mk('dd', ""));
                }

                overlay_middle.append(
                    mk('dd', ""),
                    mk('dt', "real time"),
                    mk('dd', util.format_duration(scorecard.abstime / TICS_PER_SECOND, 2)),
                    mk('dt.-total', "total time"),
                    mk('dd.-total', util.format_duration(savefile.total_abstime / TICS_PER_SECOND, 2)),
                );

                if (old_scorecard && old_scorecard.abstime > scorecard.abstime) {
                    overlay_middle.append(
                        mk('dd.-total', `(− ${util.format_duration((old_scorecard.abstime - scorecard.abstime) / TICS_PER_SECOND, 2)})`),
                    );
                }
                else {
                    overlay_middle.append(mk('dd', ""));
                }
            }
        }
        else if (this.state === 'ended') {
            // TODO spruce this up considerably!  animate?  what's in the background?  this text is
            // long and clunky?  final score is not interesting.  could show other stats, total
            // time, say something if you skipped levels...
            // TODO disable most of the ui here?  probably??
            overlay_reason = 'ended';
            overlay_middle = "Congratulations!  You solved a whole set of funny escape rooms.  But is that the best score you can manage...?";
            let savefile = this.conductor.current_pack_savefile;
            overlay_bottom = `FINAL SCORE: ${savefile.total_score.toLocaleString()}`;
            // TODO press spacebar to...  restart from level 1??  or what
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

    confirm_game_interruption(question, action) {
        if (this.state === 'playing' || this.state === 'paused' || this.state === 'rewinding') {
            new ConfirmOverlay(this.conductor, question, action).open();
        }
        else {
            action();
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

        let is_portrait = window.matchMedia('(orientation: portrait)').matches;
        // The base size is the size of the canvas, i.e. the viewport size times the tile size --
        // but note that we have 2x4 extra tiles for the inventory depending on layout, plus half a
        // tile's worth of padding around the game area, plus a quarter tile spacing
        let base_x, base_y;
        if (is_portrait) {
            base_x = this.renderer.tileset.size_x * (this.renderer.viewport_size_x + 0.5);
            base_y = this.renderer.tileset.size_y * (this.renderer.viewport_size_y + 2.75);
        }
        else {
            base_x = this.renderer.tileset.size_x * (this.renderer.viewport_size_x + 4.75);
            base_y = this.renderer.tileset.size_y * (this.renderer.viewport_size_y + 0.5);
        }
        // The element hierarchy is: the root is a wrapper that takes up the entire flex cell;
        // within that is the main player element which contains everything; and within that is the
        // game area which is the part we can scale.  The available space is the size of the root,
        // but minus the size of the controls and whatnot placed around it, which are the difference
        // between the player container and the game area
        let player = this.root.querySelector('#player-main');
        let game_area = this.root.querySelector('#player-game-area');
        let avail_x = this.root.offsetWidth - (player.offsetWidth - game_area.offsetWidth);
        let avail_y = this.root.offsetHeight - (player.offsetHeight - game_area.offsetHeight);
        // ...minus the width of the debug panel, if visible
        if (this.debug.enabled) {
            avail_x -= this.root.querySelector('#player-debug').getBoundingClientRect().width;
        }
        // If there's already a scrollbar, the extra scrolled space is unavailable
        avail_x -= Math.max(0, document.body.scrollWidth - document.body.clientWidth);
        avail_y -= Math.max(0, document.body.scrollHeight - document.body.clientHeight);

        let dpr = window.devicePixelRatio || 1.0;
        // Divide to find the biggest scale that still fits.  Leave a LITTLE wiggle room for pixel
        // rounding and breathing (except on small screens, where being too small REALLY hurts), but
        // not too much since there's already a flex gap between the game and header/footer
        let maxfrac = is_portrait ? 1 : 0.99;
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
    path: 'levels/lexys-lessons.zip',
    preview: 'levels/previews/lexys-lessons.png',
    ident: "Lexy's Lessons",
    title: "Lexy's Lessons (WIP)",
    desc: "A set of beginner levels that introduces every mechanic in Chip's Challenge 2, made specifically for Lexy's Labyrinth!",
}, {
    path: 'levels/CC2LP1.zip',
    preview: 'levels/previews/cc2lp1.png',
    ident: 'Chips Challenge 2 Level Pack 1',
    title: "Chip's Challenge 2 Level Pack 1",
    desc: "Thoroughly demonstrates what Chip's Challenge 2 is capable of.  Fair, but doesn't hold your hand; you'd better have at least a passing familiarity with the CC2 elements.",
    url: 'https://wiki.bitbusters.club/Chip%27s_Challenge_2_Level_Pack_1',
}, {
    path: 'levels/CCLP1.ccl',
    preview: 'levels/previews/cclp1.png',
    ident: 'cclp1',
    title: "Chip's Challenge Level Pack 1",
    desc: "Designed like a direct replacement for Chip's Challenge 1, with introductory levels for new players and a gentle difficulty curve.",
    url: 'https://wiki.bitbusters.club/Chip%27s_Challenge_Level_Pack_1',
}, {
    path: 'levels/CCLP4.ccl',
    preview: 'levels/previews/cclp4.png',
    ident: 'cclp4',
    title: "Chip's Challenge Level Pack 4",
    desc: "Moderately difficult, but not unfair.",
    url: 'https://wiki.bitbusters.club/Chip%27s_Challenge_Level_Pack_4',
}, {
    path: 'levels/CCLXP2.ccl',
    preview: 'levels/previews/cclxp2.png',
    ident: 'cclxp2',
    title: "Chip's Challenge Level Pack 2-X",
    desc: "The first community pack released, tricky and rough around the edges.",
    url: 'https://wiki.bitbusters.club/Chip%27s_Challenge_Level_Pack_2_(Lynx)',
}, {
    path: 'levels/CCLP3.ccl',
    preview: 'levels/previews/cclp3.png',
    ident: 'cclp3',
    title: "Chip's Challenge Level Pack 3",
    desc: "A tough challenge, by and for veteran players.",
    url: 'https://wiki.bitbusters.club/Chip%27s_Challenge_Level_Pack_3',
/*
 * TODO: this is tricky.  it's a massive hodgepodge of levels mostly made by individual people...
}, {
    path: 'levels/CCLP3.ccl',
    ident: 'jblp1',
    title: "JBLP1",
    author: 'jb',
    desc: "\"Meant to be simple and straightforward in the spirit of the original game, though the difficulty peak is ultimately a bit higher.\"",
}, {
    path: 'levels/CCLP3.ccl',
    ident: 'cclp3',
    title: "Pit of 100 Tiles",
    author: 'ajmiam',
    desc: "A tough challenge, by and for veteran players.",
}, {
    path: 'levels/CCLP3.ccl',
    ident: 'cclp3',
    title: "The Other 100 Tiles",
    author: 'ajmiam',
    desc: "A tough challenge, by and for veteran players.",
}, {
    path: 'levels/CCLP3.ccl',
    ident: 'cclp3',
    title: "JoshL5",
    desc: "A tough challenge, by and for veteran players.",
}, {
    path: 'levels/CCLP3.ccl',
    ident: 'cclp3',
    title: "JoshL6",
    desc: "A tough challenge, by and for veteran players.",
}, {
    path: 'levels/CCLP3.ccl',
    ident: 'cclp3',
    title: "JoshL7",
    desc: "A tough challenge, by and for veteran players.",
}, {
    path: 'levels/CCLP3.ccl',
    ident: 'cclp3',
    title: "Neverstopgaming",
    desc: "A tough challenge, by and for veteran players.",
}, {
    path: 'levels/CCLP3.ccl',
    ident: 'cclp3',
    title: "Ultimate Chip 4",
    desc: "A tough challenge, by and for veteran players.",
}, {
    path: 'levels/CCLP3.ccl',
    ident: 'cclp3',
    title: "Ultimate Chip 5",
    desc: "A tough challenge, by and for veteran players.",
}, {
    path: 'levels/CCLP3.ccl',
    ident: 'cclp3',
    title: "Ultimate Chip 6",
    desc: "A tough challenge, by and for veteran players.",
}, {
    path: 'levels/CCLP3.ccl',
    ident: 'cclp3',
    title: "Walls of CCLP 1",
    desc: "A tough challenge, by and for veteran players.",
}, {
    path: 'levels/CCLP3.ccl',
    ident: 'cclp3',
    title: "Walls of CCLP 3",
    desc: "A tough challenge, by and for veteran players.",
}, {
    path: 'levels/CCLP3.ccl',
    ident: 'cclp3',
    title: "Walls of CCLP 4",
    desc: "A tough challenge, by and for veteran players.",
}, {
    path: 'levels/CCLP3.ccl',
    ident: 'cclp3',
    title: "TS0",
    desc: "A tough challenge, by and for veteran players.",
}, {
    path: 'levels/CCLP3.ccl',
    ident: 'cclp3',
    title: "TS1",
    desc: "A tough challenge, by and for veteran players.",
}, {
    path: 'levels/CCLP3.ccl',
    ident: 'cclp3',
    title: "TS2",
    desc: "A tough challenge, by and for veteran players.",
}, {
    path: 'levels/CCLP3.ccl',
    ident: 'cclp3',
    title: "Chip56",
    desc: "A tough challenge, by and for veteran players.",
}, {
    path: 'levels/CCLP3.ccl',
    ident: 'cclp3',
    title: "kidsfair",
    desc: "A tough challenge, by and for veteran players.",
    */
}];

class Splash extends PrimaryView {
    constructor(conductor) {
        super(conductor, document.body.querySelector('main#splash'));

        // Populate the list of available level packs
        let stock_pack_list = document.querySelector('#splash-stock-pack-list');
        this.played_pack_elements = {};
        let stock_pack_idents = new Set;
        for (let packdef of BUILTIN_LEVEL_PACKS) {
            stock_pack_idents.add(packdef.ident);
            stock_pack_list.append(this._create_pack_element(packdef.ident, packdef));
            this.update_pack_score(packdef.ident);
        }

        // Populate the list of other packs you've played
        this.custom_pack_list = document.querySelector('#splash-other-pack-list');
        for (let [ident, packinfo] of Object.entries(this.conductor.stash.packs)) {
            if (stock_pack_idents.has(ident))
                continue;
            this.custom_pack_list.append(this._create_pack_element(ident));
            this.update_pack_score(ident);
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
        util.handle_drop(this.root, {
            require_file: true,
            dropzone_class: '--drag-hover',
            on_drop: async ev => {
                // Safari doesn't support .items; the spec doesn't support directories; the WebKit
                // interface /does/ support directories but obviously isn't standard (yet?).
                // Try to make this all work.
                // By the way, if you access .files, it seems .items becomes inaccessible??
                // TODO also, we don't yet support receiving multiple packs
                let files;
                if (ev.dataTransfer.items) {
                    // Prefer the WebKit entry interface, which preserves directory structure, but
                    // fall back to a list of files if we must
                    let entries = [];
                    files = [];
                    for (let item of ev.dataTransfer.items) {
                        if (item.kind !== 'file')
                            continue;

                        files.push(item.getAsFile());
                        if (item.webkitGetAsEntry) {
                            entries.push(item.webkitGetAsEntry());
                        }
                    }

                    // Do NOT try this if we only got a single regular file
                    if (entries.length && ! (entries.length === 1 && ! entries[0].isDirectory)) {
                        await this.search_multi_source(new util.EntryFileSource(entries));
                        return;
                    }
                }
                else {
                    files = ev.dataTransfer.files;
                }

                // If all we have is a list of files, try to open the first one directly (since we
                // can't handle multiple yet)
                // TODO can we detect if a file is actually supposed to be a directory and say the
                // browser doesn't support the experimental interface for this?
                if (files && files.length) {
                    let file = files[0];
                    let buf = await file.arrayBuffer();
                    await this.conductor.parse_and_load_game(buf, null, '/' + file.name);
                    return;
                }
            },
        });
    }

    setup() {
        this.root.querySelector('#splash-fullscreen').addEventListener('click', ev => {
            let html = document.documentElement;
            if (document.fullscreenElement || document.webkitFullscreenElement) {
                (document.exitFullscreen || document.webkitExitFullscreen).call(document);
            }
            else {
                (html.requestFullscreen || html.webkitRequestFullscreen).call(html);
            }
        });

        // Editor interface
        // (this has to be handled here because we need to examine the editor,
        // which hasn't yet been created in our constructor)
        // FIXME add a new one when creating a new pack; update and reorder when saving
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
        let editor_list = mk('ul.played-pack-list');
        editor_section.append(editor_list);
        let next_midnight = new Date;
        if (next_midnight.getHours() >= 4) {
            next_midnight.setDate(next_midnight.getDate() + 1);
        }
        next_midnight.setHours(4);
        next_midnight.setMinutes(0);
        next_midnight.setSeconds(0);
        next_midnight.setMilliseconds(0);
        for (let key of pack_keys) {
            let pack = packs[key];
            let li = mk('li');
            let button = mk('button.button-big', {type: 'button'}, pack.title);
            let modified = new Date(pack.last_modified);
            let days_ago = Math.floor((next_midnight - modified) / (1000 * 60 * 60 * 24));
            let timestamp_text;
            if (days_ago === 0) {
                timestamp_text = "today";
            }
            else if (days_ago === 1) {
                timestamp_text = "yesterday";
            }
            else if (days_ago <= 12) {
                timestamp_text = `${days_ago} days ago`;
            }
            else {
                timestamp_text = modified.toISOString().split('T')[0];
            }
            li.append(
                button,
                mk('div.-editor-status',
                    mk('div.-level-count', pack.level_count === 1 ? "1 level" : `${pack.level_count} levels`),
                    mk('div.-timestamp', "edited " + timestamp_text),
                ),
            );
            // TODO make a container so this can be 1 event
            button.addEventListener('click', ev => {
                this.conductor.editor.load_editor_pack(key);
            });
            editor_list.append(li);
        }
    }

    _create_pack_element(ident, packdef = null) {
        let title = packdef ? packdef.title : ident;
        let button = mk('button.button-big', {type: 'button'}, title);
        if (packdef) {
            button.addEventListener('click', ev => {
                this.conductor.fetch_pack(packdef.path, packdef.title);
            });
        }
        else {
            button.disabled = true;
        }

        let li = mk('li.--unplayed', {'data-ident': ident});
        if (packdef && packdef.preview) {
            li.append(mk('img.-preview', {src: packdef.preview}));
        }
        li.append(button);

        let forget_button = mk('button.-forget', {type: 'button'}, "Forget");
        forget_button.addEventListener('click', ev => {
            new ConfirmOverlay(this.conductor, `Clear all your progress for ${title}?  This can't be undone.`, () => {
                delete this.conductor.stash.packs[ident];
                localStorage.removeItem(STORAGE_PACK_PREFIX + ident);
                this.conductor.save_stash();
                if (packdef) {
                    this.update_pack_score(ident);
                }
                else {
                    li.remove();
                }
            }).open();
        });
        li.append(mk('div.-progress',
            mk('div.-levels'),
            mk('span.-score'),
            mk('span.-time'),
            forget_button,
        ));

        if (packdef) {
            let p = mk('p', packdef.desc);
            if (packdef.url) {
                p.append("  ", mk('a', {href: packdef.url}, "About..."));
            }
            li.append(p);
        }

        this.played_pack_elements[ident] = li;
        return li;
    }

    update_pack_score(ident) {
        let packinfo = this.conductor.stash.packs[ident];
        let li = this.played_pack_elements[ident];

        if (! packinfo) {
            if (li) {
                li.classList.add('--unplayed');
            }
            return;
        }

        if (! li) {
            // This must be a new pack, which we haven't created markup for yet, so do that and
            // stick it at the top of the custom list
            // FIXME feels rather hokey to do this here; should happen when loading a pack, once
            // there's something to indicate currently loaded pack + all available files
            li = this._create_pack_element(ident);
            // FIXME if these are ordered by last played then /any/ opening of a pack should
            // reshuffle this list
            this.custom_pack_list.prepend(li);
        }

        li.classList.remove('--unplayed');
        let progress = li.querySelector('.-progress');

        let score;
        if (packinfo.total_score === null) {
            // Whoops, some NaNs got in here  :(
            score = "computing...";
        }
        else {
            // TODO tack on a star if the game is "beaten"?  what's that mean?  every level
            // beaten i guess?
            score = packinfo.total_score.toLocaleString();
        }
        progress.querySelector('.-score').textContent = score;

        let level_el = progress.querySelector('.-levels');
        if (packinfo.total_levels === undefined) {
            // This stuff isn't available in old saves
            progress.querySelector('.-time').textContent = "???";
            level_el.textContent = "(old save; load pack to fill stats)";
        }
        else {
            progress.querySelector('.-time').textContent = util.format_duration(packinfo.total_abstime / TICS_PER_SECOND, 2);
            let levels = (
                `cleared ${packinfo.cleared_levels} of ${packinfo.total_levels} `
                + `level${packinfo.total_levels === 1 ? "" : "s"}, `
                + `${packinfo.aidless_levels}★ without aid`);
            level_el.textContent = levels;
            level_el.style.setProperty('--cleared', packinfo.cleared_levels / packinfo.total_levels);
            level_el.style.setProperty('--aidless', packinfo.aidless_levels / packinfo.total_levels);
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

const BUILTIN_TILESETS = {
    lexy: {
        name: "Lexy's Labyrinth",
        src: 'tileset-lexy.png',
        layout: 'lexy',
        tile_width: 32,
        tile_height: 32,
    },
};

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

// Options dialog
const TILESET_SLOTS = [{
    ident: 'cc1',
    name: "CC1",
}, {
    ident: 'cc2',
    name: "CC2",
}, {
    ident: 'll',
    name: "LL/editor",
}];
const CUSTOM_TILESET_BUCKETS = ['Custom 1', 'Custom 2', 'Custom 3'];
const CUSTOM_TILESET_PREFIX = "Lexy's Labyrinth custom tileset: ";
class OptionsOverlay extends DialogOverlay {
    constructor(conductor) {
        super(conductor);
        this.root.classList.add('dialog-options');
        this.set_title("options");

        let dl = mk('dl.formgrid');
        this.main.append(dl);

        // Volume options
        dl.append(
            mk('dt', "Music volume"),
            mk('dd.option-volume',
                mk('label', mk('input', {name: 'music-enabled', type: 'checkbox'}), " Enabled"),
                mk('input', {name: 'music-volume', type: 'range', min: 0, max: 1, step: 0.05}),
            ),
            mk('dt', "Sound volume"),
            mk('dd.option-volume',
                mk('label', mk('input', {name: 'sound-enabled', type: 'checkbox'}), " Enabled"),
                mk('input', {name: 'sound-volume', type: 'range', min: 0, max: 1, step: 0.05}),
            ),
            mk('dt'),
            mk('dd', mk('label', mk('input', {name: 'use-cc2-anim-speed', type: 'checkbox'}), " Use CC2 animation speed")),
        );
        // Update volume live, if the player is active and was playing when this dialog was opened
        // (note that it won't auto-pause until open())
        let player = this.conductor.player;
        if (this.conductor.current === player && player.state === 'playing') {
            this.original_music_volume = player.music_audio_el.volume;
            this.original_sound_volume = player.sfx_player.volume;

            this.resume_music_on_open = true;

            // Adjust music volume in realtime
            this.root.elements['music-enabled'].addEventListener('change', ev => {
                if (ev.target.checked) {
                    player.music_audio_el.play();
                }
                else {
                    player.music_audio_el.pause();
                }
            });
            this.root.elements['music-volume'].addEventListener('input', ev => {
                player.music_audio_el.volume = parseFloat(ev.target.value);
            });
            // Play a sound effect after altering volume
            this.root.elements['sound-enabled'].addEventListener('change', ev => {
                if (ev.target.checked) {
                    this._play_random_sfx();
                }
            });
            this.root.elements['sound-volume'].addEventListener('input', ev => {
                player.sfx_player.volume = parseFloat(ev.target.value);
                if (this.root.elements['sound-enabled'].checked) {
                    this._play_random_sfx();
                }
            });
        }

        // Tileset options
        this.tileset_els = {};
        this.renderers = {};
        this.available_tilesets = {};
        for (let [ident, def] of Object.entries(BUILTIN_TILESETS)) {
            let newdef = { ...def, is_builtin: true };
            newdef.ident = ident;
            newdef.tileset = conductor._loaded_tilesets[ident];
            if (! newdef.tileset) {
                let img = new Image;
                // FIXME again, wait, or what?
                img.src = newdef.src;
                newdef.tileset = new Tileset(
                    img, TILESET_LAYOUTS[newdef.layout] ?? 'lexy',
                    newdef.tile_width, newdef.tile_height);
            }
            this.available_tilesets[ident] = newdef;
        }
        for (let bucket of CUSTOM_TILESET_BUCKETS) {
            if (conductor._loaded_tilesets[bucket]) {
                this.available_tilesets[bucket] = {
                    ident: bucket,
                    name: bucket,
                    is_already_stored: true,
                    tileset: conductor._loaded_tilesets[bucket],
                };
            }
        }
        for (let slot of TILESET_SLOTS) {
            let renderer = new CanvasRenderer(conductor.tilesets[slot.ident], 1);
            this.renderers[slot.ident] = renderer;

            let select = mk('select', {name: `tileset-${slot.ident}`});
            for (let [ident, def] of Object.entries(this.available_tilesets)) {
                if (def.tileset.layout['#supported-versions'].has(slot.ident)) {
                    select.append(mk('option', {value: ident}, def.name));
                }
            }
            select.value = conductor.options.tilesets[slot.ident] ?? 'lexy';
            select.addEventListener('change', ev => {
                this.update_selected_tileset(slot.ident);
            });

            let el = mk('dd.option-tileset', select);
            this.tileset_els[slot.ident] = el;
            this.update_selected_tileset(slot.ident);

            dl.append(
                mk('dt', `${slot.name} tileset`),
                el,
            );
        }
        this.custom_tileset_counter = 1;
        dl.append(
            mk('dd',
                "You can also load a custom tileset, which will be saved in browser storage.",
                mk('br'),
                "Supports the Tile World static layout and the Steam layout.",
                mk('br'),
                "(Steam tilesets can be found in ", mk('code', "data/bmp"), " within the game's local files).",
                mk('br'),
                mk('input', {type: 'file', name: 'custom-tileset'}),
                mk('div.option-load-tileset',
                ),
            ),
        );

        // Load current values
        this.root.elements['music-volume'].value = this.conductor.options.music_volume ?? 1.0;
        this.root.elements['music-enabled'].checked = this.conductor.options.music_enabled ?? true;
        this.root.elements['sound-volume'].value = this.conductor.options.sound_volume ?? 1.0;
        this.root.elements['sound-enabled'].checked = this.conductor.options.sound_enabled ?? true;
        this.root.elements['use-cc2-anim-speed'].checked = this.conductor.options.use_cc2_anim_speed ?? false;

        this.root.elements['custom-tileset'].addEventListener('change', ev => {
            this._load_custom_tileset(ev.target.files[0]);
        });

        this.add_button("save", ev => {
            let options = this.conductor.options;
            options.music_volume = parseFloat(this.root.elements['music-volume'].value);
            options.music_enabled = this.root.elements['music-enabled'].checked;
            options.sound_volume = parseFloat(this.root.elements['sound-volume'].value);
            options.sound_enabled = this.root.elements['sound-enabled'].checked;
            options.use_cc2_anim_speed = this.root.elements['use-cc2-anim-speed'].checked;

            // Tileset stuff: slightly more complicated.  Save custom ones to localStorage as data
            // URIs, and /delete/ any custom ones we're not using any more, both of which require
            // knowing which slots we're already using first
            let buckets_in_use = new Set;
            let chosen_tilesets = {};
            for (let slot of TILESET_SLOTS) {
                let tileset_ident = this.root.elements[`tileset-${slot.ident}`].value;
                let tilesetdef = this.available_tilesets[tileset_ident];
                if (! tilesetdef) {
                    tilesetdef = this.available_tilesets['lexy'];
                }

                chosen_tilesets[slot.ident] = tilesetdef;
                if (tilesetdef.is_already_stored) {
                    buckets_in_use.add(tilesetdef.ident);
                }
            }
            // Clear out _loaded_tilesets first so it no longer refers to any custom tilesets we end
            // up deleting
            this.conductor._loaded_tilesets = {};
            for (let [slot_ident, tilesetdef] of Object.entries(chosen_tilesets)) {
                if (tilesetdef.is_builtin || tilesetdef.is_already_stored) {
                    options.tilesets[slot_ident] = tilesetdef.ident;
                }
                else {
                    // This is a newly uploaded one
                    let data_uri = tilesetdef.data_uri ?? tilesetdef.canvas.toDataURL('image/png');
                    let storage_bucket = CUSTOM_TILESET_BUCKETS.find(
                        bucket => ! buckets_in_use.has(bucket));
                    if (! storage_bucket) {
                        console.error("Somehow ran out of storage buckets, this should be impossible??");
                        continue;
                    }
                    buckets_in_use.add(storage_bucket);
                    save_json_to_storage(CUSTOM_TILESET_PREFIX + storage_bucket, {
                        src: data_uri,
                        name: storage_bucket,
                        layout: tilesetdef.layout,
                        tile_width: tilesetdef.tile_width,
                        tile_height: tilesetdef.tile_height,
                    });
                    options.tilesets[slot_ident] = storage_bucket;
                }

                // Update the conductor's loaded tilesets
                this.conductor.tilesets[slot_ident] = tilesetdef.tileset;
                this.conductor._loaded_tilesets[options.tilesets[slot_ident]] = tilesetdef.tileset;
            }
            // Delete old custom set URIs
            for (let bucket of CUSTOM_TILESET_BUCKETS) {
                if (! buckets_in_use.has(bucket)) {
                    window.localStorage.removeItem(CUSTOM_TILESET_PREFIX + bucket);
                }
            }

            this.conductor.save_stash();
            this.conductor.reload_all_options();

            this.close();
        });
        this.add_button("forget it", ev => {
            // Restore the player's music volume just in case
            if (this.original_music_volume !== undefined) {
                this.conductor.player.music_audio_el.volume = this.original_music_volume;
                this.conductor.player.sfx_player.volume = this.original_sound_volume;
            }
            this.close();
        });
    }

    open() {
        super.open();

        // Forcibly start the music player, since opening this dialog auto-pauses the game, and
        // anyway it's hard to gauge music volume if it's not playing
        if (this.resume_music_on_open && this.conductor.player.music_enabled) {
            this.conductor.player.music_audio_el.play();
        }
    }

    _play_random_sfx() {
        let sfx = this.conductor.player.sfx_player;
        // Temporarily force enable it
        let was_enabled = sfx.enabled;
        sfx.enabled = true;
        sfx.play_once(util.random_choice([
            'blocked', 'door', 'get-chip', 'get-key', 'get-tool', 'socket', 'splash',
        ]));
        sfx.enabled = was_enabled;
    }

    async _load_custom_tileset(file) {
        // This is dumb and roundabout, but such is the web
        let reader = new FileReader;
        let reader_loaded = util.promise_event(reader, 'load', 'error');
        reader.readAsDataURL(file);
        await reader_loaded;

        let img = mk('img');
        img.src = reader.result;
        await img.decode();

        // Now we've got an <img> ready to go, and we can guess its layout based on its aspect
        // ratio, hopefully.  Note that the LL layout is currently in progress so we can't
        // really detect that, but there can't really be alternatives to it either
        let result_el = this.root.querySelector('.option-load-tileset');
        let layout;
        // Note: Animated Tile World has a 1px gap between rows to indicate where animations
        // start and also a single extra 1px column on the left, which I super don't support :(
        for (let try_layout of Object.values(TILESET_LAYOUTS)) {
            let [w, h] = try_layout['#dimensions'];
            // XXX this assumes square tiles, but i have written mountains of code that doesn't!
            if (img.naturalWidth * h === img.naturalHeight * w) {
                layout = try_layout;
                break;
            }
        }
        if (! layout) {
            result_el.textContent = '';
            result_el.append("This doesn't look like a tileset layout I understand, sorry!");
            return;
        }

        // Load into a canvas and erase the background, if any
        let canvas = mk('canvas', {width: img.naturalWidth, height: img.naturalHeight});
        let ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        this._erase_background(canvas, ctx, layout);

        let [w, h] = layout['#dimensions'];
        let tw = Math.floor(img.naturalWidth / w);
        let th = Math.floor(img.naturalHeight / h);
        let tileset = new Tileset(canvas, layout, tw, th);
        let renderer = new CanvasRenderer(tileset, 1);
        result_el.textContent = '';
        result_el.append(
            `This looks like a ${layout['#name']} tileset with ${tw}×${th} tiles.`,
            mk('br'),
            renderer.draw_single_tile_type('player'),
            renderer.draw_single_tile_type('chip'),
            renderer.draw_single_tile_type('exit'),
            mk('br'),
        );

        let tileset_ident = `new-custom-${this.custom_tileset_counter}`;
        let tileset_name = `New custom ${this.custom_tileset_counter}`;
        this.custom_tileset_counter += 1;
        for (let slot of TILESET_SLOTS) {
            if (! layout['#supported-versions'].has(slot.ident))
                continue;

            let dd = this.tileset_els[slot.ident];
            let select = dd.querySelector('select');
            select.append(mk('option', {value: tileset_ident}, tileset_name));

            let button = util.mk_button(`Use for ${slot.name}`, ev => {
                select.value = tileset_ident;
                this.update_selected_tileset(slot.ident);
            });
            result_el.append(button);
        }

        this.available_tilesets[tileset_ident] = {
            ident: tileset_ident,
            name: tileset_name,
            canvas: canvas,
            tileset: tileset,
            layout: layout['#ident'],
            tile_width: tw,
            tile_height: th,
        };
    }

    _erase_background(canvas, ctx, layout) {
        let trans = layout['#transparent-color'];
        if (! trans)
            return;

        let image_data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let px = image_data.data;
        if (trans.length === 2) {
            // Read the background color from a pixel
            let i = trans[0] + trans[1] * canvas.width;
            if (px[i + 3] === 0) {
                // Background is already transparent!
                return;
            }
            trans = [px[i], px[i + 1], px[i + 2], px[i + 3]];
        }

        for (let i = 0; i < canvas.width * canvas.height * 4; i += 4) {
            if (px[i] === trans[0] && px[i + 1] === trans[1] &&
                px[i + 2] === trans[2] && px[i + 3] === trans[3])
            {
                px[i] = 0;
                px[i + 1] = 0;
                px[i + 2] = 0;
                px[i + 3] = 0;
            }
        }
        ctx.putImageData(image_data, 0, 0);
    }

    update_selected_tileset(slot_ident) {
        let dd = this.tileset_els[slot_ident];
        let select = dd.querySelector('select');
        let tileset_ident = select.value;

        let renderer = this.renderers[slot_ident];
        renderer.tileset = this.available_tilesets[tileset_ident].tileset;
        for (let canvas of dd.querySelectorAll('canvas')) {
            canvas.remove();
        }
        dd.append(
            // TODO allow me to draw an arbitrary tile to an arbitrary point on a given canvas!
            renderer.draw_single_tile_type('player'),
            renderer.draw_single_tile_type('chip'),
            renderer.draw_single_tile_type('exit'),
        );
    }

    _add_options(root, options) {
        let ul = mk('ul');
        root.append(ul);
        for (let optdef of options) {
            let li = mk('li');
            let label = mk('label.option');
            label.append(mk('input', {type: 'checkbox', name: optdef.key}));
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

    close() {
        // Ensure the player's music is set back how we left it
        this.conductor.player.update_music_playback_state();

        super.close();
    }
}
class CompatOverlay extends DialogOverlay {
    constructor(conductor) {
        super(conductor);
        this.set_title("Compatibility");
        this.root.classList.add('dialog-compat');

        this.main.append(
            mk('p',
                "These are more technical settings, and as such are documented in full on ",
                mk('a', {href: 'https://github.com/eevee/lexys-labyrinth/wiki/Compatibility'}, "the project wiki"),
                "."),
            mk('p', "The short version is: Lexy mode is fine 99% of the time.  If a level doesn't seem to work, try the mode for the game it's designed for.  Microsoft mode is best-effort and nothing is guaranteed."),
            mk('p', "Changes won't take effect until you restart the level or change levels."),
        );

        let button_set = mk('div.radio-faux-button-set');
        for (let ruleset of COMPAT_RULESET_ORDER) {
            button_set.append(mk('label',
                mk('input', {type: 'radio', name: '__ruleset__', value: ruleset}),
                mk('span.-button',
                    mk('img.compat-icon', {src: `icons/compat-${ruleset}.png`}),
                    mk('br'),
                    COMPAT_RULESET_LABELS[ruleset],
                ),
            ));
        }
        button_set.addEventListener('change', ev => {
            let ruleset = this.root.elements['__ruleset__'].value;
            if (ruleset === 'custom')
                return;

            for (let compat of COMPAT_FLAGS) {
                this.set(compat.key, compat.rulesets.has(ruleset));
            }
        });
        this.main.append(button_set);

        let list = mk('ul.compat-flags');
        for (let compat of COMPAT_FLAGS) {
            let label = mk('label',
                mk('input', {type: 'checkbox', name: compat.key}),
                mk('span.-desc', compat.label),
            );
            for (let ruleset of COMPAT_RULESET_ORDER) {
                if (ruleset === 'lexy' || ruleset === 'custom')
                    continue;

                if (compat.rulesets.has(ruleset)) {
                    label.append(mk('img.compat-icon', {src: `icons/compat-${ruleset}.png`}));
                }
                else {
                    label.append(mk('span.compat-icon-gap'));
                }
            }
            list.append(mk('li', label));
        }
        list.addEventListener('change', ev => {
            this.root.elements['__ruleset__'].value = 'custom';
            ev.target.closest('li').classList.toggle('-checked', ev.target.checked);
        });
        this.main.append(list);

        // Populate everything to match the current settings
        this.root.elements['__ruleset__'].value = this.conductor._compat_ruleset ?? 'custom';
        for (let compat of COMPAT_FLAGS) {
            this.set(compat.key, !! this.conductor.compat[compat.key]);
        }

        this.add_button("save permanently", () => {
            this.save();
            this.remember();
            this.close();
        });
        this.add_button("save for this session only", () => {
            this.save();
            this.close();
        });
        this.add_button("cancel", () => {
            this.close();
        });
    }

    set(key, value) {
        this.root.elements[key].checked = value;
        this.root.elements[key].closest('li').classList.toggle('-checked', value);
    }

    save(permanent) {
        let flags = {};
        for (let compat of COMPAT_FLAGS) {
            if (this.root.elements[compat.key].checked) {
                flags[compat.key] = true;
            }
        }

        let ruleset = this.root.elements['__ruleset__'].value;
        this.conductor.set_compat(ruleset, flags);

        // If the player is currently idle at the start of a level, ask it to restart
        if (this.conductor.player.state === 'waiting') {
            this.conductor.player.restart_level();
        }
    }

    remember() {
        let ruleset = this.root.elements['__ruleset__'].value;
        if (ruleset === 'custom') {
            this.conductor.stash.compat = Object.extend({}, this.conductor.compat);
        }
        else {
            this.conductor.stash.compat = ruleset;
        }
        this.conductor.save_stash();
    }
}

class PackTestDialog extends DialogOverlay {
    constructor(conductor) {
        super(conductor);
        this.root.classList.add('packtest-dialog');
        this.set_title("full pack test");
        this.button = mk('button', {type: 'button'}, "Begin test");
        this.button.addEventListener('click', async ev => {
            if (this._handle) {
                this._handle.cancel = true;
                this._handle = null;
                ev.target.textContent = "Start";
            }
            else {
                this._handle = {cancel: false};
                ev.target.textContent = "Abort";
                await this.run(this._handle);
                this._handle = null;
                ev.target.textContent = "Start";
            }
        });

        this.results_summary = mk('ol.packtest-summary.packtest-colorcoded');
        for (let i = 0; i < this.conductor.stored_game.level_metadata.length; i++) {
            this.results_summary.append(mk('li'));
        }

        this.current_status = mk('p', "Ready");

        this.results = mk('table.packtest-results.packtest-colorcoded',
            mk('thead', mk('tr',
                mk('th.-level', "Level"),
                mk('th.-result', "Result"),
                mk('th.-clock', "Play time"),
                mk('th.-delta', "Replay delta"),
                mk('th.-speed', "Run speed"),
            )),
            mk('tbody'),
        );
        this.results.addEventListener('click', ev => {
            let tbody = ev.target.closest('tbody');
            if (! tbody)
                return;
            let index = tbody.getAttribute('data-index');
            if (index === undefined)
                return;
            this.close();
            this.conductor.change_level(parseInt(index, 10));
        });

        let ruleset_dropdown = mk('select', {name: 'ruleset'});
        for (let ruleset of COMPAT_RULESET_ORDER) {
            if (ruleset === 'custom') {
                ruleset_dropdown.append(mk('option', {value: ruleset, selected: 'selected'}, "Current ruleset"));
            }
            else {
                ruleset_dropdown.append(mk('option', {value: ruleset}, COMPAT_RULESET_LABELS[ruleset]));
            }
        }
        this.main.append(
            mk('p', "This will run the replay for every level in the current pack, as fast as possible, and report the results."),
            mk('p', mk('strong', "This is an intensive process and may lag your browser!"), "  Mostly intended for testing LL itself."),
            mk('p', "Note that currently, only C2Ms with embedded replays are supported."),
            mk('p', "(Results will be saved until you change packs.)"),
            mk('hr'),
            this.results_summary,
            mk('div.packtest-row', this.current_status, ruleset_dropdown, this.button),
            this.results,
        );

        this.add_button("close", () => {
            this.close();
        });

        this.renderer = new CanvasRenderer(this.conductor.tilesets['ll'], 16);
    }

    async run(handle) {
        let pack = this.conductor.stored_game;
        let dummy_sfx = {
            set_player_position() {},
            play() {},
            play_once() {},
        };
        let ruleset = this.root.elements['ruleset'].value;
        let compat;
        if (ruleset === 'custom') {
            compat = this.conductor.compat;
        }
        else {
            compat = compat_flags_for_ruleset(ruleset);
        }

        for (let tbody of this.results.querySelectorAll('tbody')) {
            tbody.remove();
        }
        for (let li of this.results_summary.childNodes) {
            li.removeAttribute('data-status');
        }

        let num_levels = pack.level_metadata.length;
        let num_passed = 0;
        let total_tics = 0;
        let t0 = performance.now();
        let last_pause = t0;
        for (let i = 0; i < num_levels; i++) {
            let stored_level, level;
            let status_li = this.results_summary.childNodes[i];
            let level_start_time = performance.now();
            let record_result = (token, short_status, include_canvas, comment) => {
                let level_title = stored_level ? stored_level.title : "???";
                status_li.setAttribute('data-status', token);
                status_li.setAttribute('title', `${short_status} (#${i + 1} ${level_title})`);
                let tbody = mk('tbody', {'data-status': token, 'data-index': i});
                status_li.addEventListener('click', () => {
                    tbody.scrollIntoView();
                });

                let tr = mk('tr',
                    mk('td.-level', `#${i + 1} ${level_title}`),
                    mk('td.-result', short_status),
                );
                if (level) {
                    tr.append(
                        mk('td.-clock', util.format_duration(level.tic_counter / TICS_PER_SECOND)),
                        mk('td.-delta', util.format_duration((level.tic_counter - stored_level.replay.duration) / TICS_PER_SECOND, 2)),
                        mk('td.-speed', ((level.tic_counter / TICS_PER_SECOND) / (performance.now() - level_start_time) * 1000).toFixed(2) + '×'),
                    );
                }
                else {
                    tr.append(mk('td.-clock'), mk('td.-delta'), mk('td.-speed'));
                }
                tbody.append(tr);

                if (comment) {
                    tbody.append(mk('tr', mk('td.-full', {colspan: 5}, comment)));
                }
                if (include_canvas && level) {
                    try {
                        let tileset = this.conductor.choose_tileset_for_level(level.stored_level);
                        this.renderer.set_tileset(tileset);
                        let canvas = mk('canvas', {
                            width: Math.min(this.renderer.canvas.width, level.size_x * tileset.size_x),
                            height: Math.min(this.renderer.canvas.height, level.size_y * tileset.size_y),
                        });
                        this.renderer.set_level(level);
                        this.renderer.set_active_player(level.player);
                        this.renderer.draw();
                        canvas.getContext('2d').drawImage(
                            this.renderer.canvas, 0, 0,
                            this.renderer.canvas.width, this.renderer.canvas.height);
                        tbody.append(mk('tr', mk('td.-full', {colspan: 5}, canvas)));
                    }
                    catch (e) {
                        console.error(e);
                        tbody.append(mk('tr', mk('td.-full', {colspan: 5},
                            `Internal error while trying to capture screenshot: ${e}`)));
                    }
                }
                this.results.append(tbody);

                if (level) {
                    total_tics += level.tic_counter;
                }
            };

            try {
                stored_level = pack.load_level(i);
                if (! stored_level.has_replay) {
                    record_result('no-replay', "No replay");
                    continue;
                }

                this.current_status.textContent = `Testing level ${i + 1}/${num_levels} ${stored_level.title}...`;

                let replay = stored_level.replay;
                level = new Level(stored_level, compat);
                level.sfx = dummy_sfx;
                level.undo_enabled = false; // slight performance boost
                replay.configure_level(level);

                while (true) {
                    let input = replay.get(level.tic_counter);
                    level.advance_tic(input);

                    if (level.state === 'success') {
                        if (level.tic_counter < replay.duration - 10) {
                            // Early exit is dubious (e.g. this happened sometimes before multiple
                            // players were implemented correctly)
                            record_result('early', "Won early", true);
                        }
                        else {
                            record_result('success', "Won");
                        }
                        num_passed += 1;
                        break;
                    }
                    else if (level.state === 'failure') {
                        record_result('failure', "Lost", true);
                        break;
                    }
                    else if (level.tic_counter >= replay.duration + 200) {
                        record_result('short', "Out of input", true);
                        break;
                    }

                    if (level.tic_counter % 20 === 1) {
                        if (handle.cancel) {
                            record_result('interrupted', "Interrupted");
                            this.current_status.textContent = `Interrupted on level ${i + 1}/${num_levels}; ${num_passed} passed`;
                            return;
                        }

                        // Don't run for more than 100ms at a time, to avoid janking the browser...
                        // TOO much.  I mean, we still want it to reflow the stuff we've added, but
                        // we also want to be pretty aggressive so this finishes quickly
                        let now = performance.now();
                        if (now - last_pause > 100) {
                            await util.sleep(4);
                            last_pause = now;
                        }
                    }
                }
            }
            catch (e) {
                console.error(e);
                record_result(
                    'error', "Error", true,
                    `Replay failed due to internal error (see console for traceback): ${e}`);
            }
        }

        let grades = [
            [100, "A+", "grade-A"],
            [93,  "A",  "grade-A"],
            [90,  "A-", "grade-A"],
            [87,  "B+", "grade-B"],
            [83,  "B",  "grade-B"],
            [80,  "B-", "grade-B"],
            [77,  "C+", "grade-C"],
            [73,  "C",  "grade-C"],
            [70,  "C-", "grade-C"],
            [60,  "D",  "grade-D"],
            [50,  "D-", "grade-D"],
            [0,   "F",  "grade-F"],
        ];

        let gradeText = "NaN";
        let gradeClass = "";
        let pass_percentage = Math.floor(num_passed / num_levels * 100.0);
        for (let i = 0; i < grades.length; i++) {
            if (pass_percentage >= grades[i][0]) {
                let _pct;
                [_pct, gradeText, gradeClass] = grades[i];
                break;
            }
        }

        let total_game_time = total_tics / TICS_PER_SECOND;
        let total_wall_time = (performance.now() - t0) / 1000;
        let final_status = `Finished!
Simulated ${util.format_duration(total_game_time)} of play time
in ${util.format_duration(total_wall_time)}
(${(total_game_time / total_wall_time).toFixed(2)}×);
${num_passed}/${num_levels} levels passed`;
        if (num_passed === num_levels) {
            final_status += "!  Congratulations!  🎆";
        } else {
            final_status += '.';
        }
        final_status += "  Grade: ";
        this.current_status.textContent = final_status;
        this.current_status.appendChild(mk("span", {"class": gradeClass}, gradeText));
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
            mk('th.-time', mk('abbr', {
                title: "Time left on the clock when you finished; doesn't exist for untimed levels",
            }, "Best clock")),
            mk('th.-time', mk('abbr', {
                title: "Actual time it took you to play the level, even on untimed levels, and ignoring any CC2 clock altering effects",
            }, "Best real time")),
            mk('th.-score', "Best score"),
            mk('th'),
            mk('th'),
        ));
        let tbody = mk('tbody');
        let table = mk('table.level-browser', thead, tbody);
        this.main.append(table);
        let savefile = conductor.current_pack_savefile;
        let total_abstime = 0, total_score = 0;
        for (let [i, meta] of conductor.stored_game.level_metadata.entries()) {
            let scorecard = savefile.scorecards[i];
            let score = "—", time = "—", abstime = "—", aid = "";
            let button;
            if (scorecard) {
                score = scorecard.score.toLocaleString();
                if (scorecard.aid === 0) {
                    aid = '★';
                }

                // 0 means untimed level
                if (scorecard.time !== 0) {
                    time = String(scorecard.time);
                }

                abstime = util.format_duration(scorecard.abstime / TICS_PER_SECOND, 2);

                total_abstime += scorecard.abstime;
                total_score += scorecard.score;

                button = util.mk_button('forget', ev => {
                    new ConfirmOverlay(this.conductor, "Erase these records?  This cannot be undone!", () => {
                        let savefile = this.conductor.current_pack_savefile;
                        let scorecard = savefile.scorecards[i];
                        if (! scorecard)
                            return;

                        savefile.total_abstime -= scorecard.abstime;
                        savefile.total_score -= scorecard.score;
                        savefile.cleared_levels -= 1;
                        if (savefile.aid === 0) {
                            savefile.aidless_levels -= 1;
                        }
                        savefile.scorecards[i] = null;
                        this.conductor.save_savefile();

                        let tr = ev.target.closest('table.level-browser tr');
                        for (let td of tr.querySelectorAll('td.-time, td.-score')) {
                            td.textContent = "—";
                        }
                        tr.querySelector('td.-aid').textContent = "";
                        tr.querySelector('td.-button').textContent = "";
                        // TODO update totals row?  ugh
                    }).open();
                    ev.stopPropagation();  // don't trigger row click handler
                });
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
                mk('td.-aid', aid),
                mk('td.-button', button ?? ''),
                // TODO show your time?  include 999 times for untimed levels (which i don't know at
                // this point whoops but i guess if the time is zero then that answers that)?  show
                // your wallclock time also?
                // TODO other stats??  num chips, time limit?  don't know that without loading all
                // the levels upfront though, which i currently do but want to stop doing
            );

            if (i === this.conductor.level_index) {
                tr.classList.add('--current');
            }
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

        this.tbody = tbody;

        table.append(mk('tfoot', mk('tr',
            mk('th'),
            mk('th', "Total"),
            mk('th'),
            mk('th.-time', util.format_duration(total_abstime / TICS_PER_SECOND, 2)),
            mk('th.-score', total_score.toLocaleString()),
            mk('th'),
            mk('th'),
        )));

        this.add_button("nevermind", ev => {
            this.close();
        });
    }

    open() {
        super.open();
        this.tbody.childNodes[this.conductor.level_index].scrollIntoView({block: 'center'});
    }
}

// Central dispatcher of what we're doing and what we've got loaded
// We store several kinds of things in localStorage:
// Main storage:
//   packs:
//     total_score
//     total_abstime
//     total_levels
//     cleared_levels
//     aidless_levels
//   options
//   compat: (either a ruleset string or an object of individual flags)
const STORAGE_KEY = "Lexy's Labyrinth";
// Records for a pack that has been played
//   total_score
//   highest_level
//   current_level
//   scorecards: []?
//     time
//     abstime
//     bonus
//     score
//     aid
const STORAGE_PACK_PREFIX = "Lexy's Labyrinth: ";
// Metadata for an edited pack
// - list of the levels they own and basic metadata like name
// Stored individual levels: given dummy names, all indexed on their own
class Conductor {
    constructor() {
        this.stored_game = null;

        this.stash = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
        // TODO more robust way to ensure this is shaped how i expect?
        if (! this.stash) {
            this.stash = {};
        }
        if (! this.stash.options) {
            this.stash.options = {};
        }
        if (! this.stash.options.tilesets) {
            this.stash.options.tilesets = {};
        }
        if (! this.stash.compat) {
            this.stash.compat = 'lexy';
        }
        if (! this.stash.packs) {
            this.stash.packs = {};
        }

        // Handy aliases
        this.options = this.stash.options;
        this.compat = {};
        this._compat_ruleset = 'custom';  // Only used by the compat dialog
        if (typeof this.stash.compat === 'string') {
            this._compat_ruleset = this.stash.compat;
            this.compat = compat_flags_for_ruleset(this.stash.compat);
        }
        else {
            Object.extend(this.compat, this.stash.compat);
        }
        this.set_compat(this._compat_ruleset, this.compat);

        this._loaded_tilesets = {};  // tileset ident => tileset
        this.tilesets = {};  // slot (game type) => tileset
        for (let slot of TILESET_SLOTS) {
            let tileset_ident = this.options.tilesets[slot.ident] ?? 'lexy';
            let tilesetdef;
            if (BUILTIN_TILESETS[tileset_ident]) {
                tilesetdef = BUILTIN_TILESETS[tileset_ident];
            }
            else {
                tilesetdef = load_json_from_storage(CUSTOM_TILESET_PREFIX + tileset_ident);
                if (! tilesetdef) {
                    tileset_ident = 'lexy';
                    tilesetdef = BUILTIN_TILESETS['lexy'];
                }
            }

            if (this._loaded_tilesets[tileset_ident]) {
                this.tilesets[slot.ident] = this._loaded_tilesets[tileset_ident];
                continue;
            }

            let layout = TILESET_LAYOUTS[tilesetdef.layout] ?? 'lexy';
            let img = new Image;
            img.src = tilesetdef.src;
            // FIXME wait on the img to decode (well i can't in a constructor), or what?
            let tileset = new Tileset(img, layout, tilesetdef.tile_width, tilesetdef.tile_height);
            this.tilesets[slot.ident] = tileset;
            this._loaded_tilesets[tileset_ident] = tileset;
        }

        this.splash = new Splash(this);
        this.editor = new Editor(this);
        this.player = new Player(this);
        this.reload_all_options();

        this.loaded_in_editor = false;
        this.loaded_in_player = false;

        // Bind the header buttons
        document.querySelector('#main-options').addEventListener('click', ev => {
            new OptionsOverlay(this).open();
        });
        document.querySelector('#main-compat').addEventListener('click', ev => {
            new CompatOverlay(this).open();
        });
        document.querySelector('#main-compat output').textContent = COMPAT_RULESET_LABELS[this._compat_ruleset ?? 'custom'];

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
        document.querySelector('#main-test-pack').addEventListener('click', ev => {
            if (! this._pack_test_dialog) {
                this._pack_test_dialog = new PackTestDialog(this);
            }
            this._pack_test_dialog.open();
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
            if (this.loaded_in_player) {
                this.player.restart_level();
            }
            this.switch_to_player();
        });

        // Bind the secret debug button: the icon in the lower left
        document.querySelector('#header-icon').addEventListener('click', ev => {
            if (! this.player.debug.enabled) {
                new ConfirmOverlay(this,
                    "Enable debug mode?  This will give you lots of toys to play with, " +
                    "but disable all saving of scores until you reload the page!",
                    () => {
                        this.player.setup_debug();
                    },
                ).open();
            }
        });

        this.update_nav_buttons();
        document.querySelector('#loading').setAttribute('hidden', '');
        this.switch_to_splash();
    }

    switch_to_splash() {
        if (this.current) {
            this.current.deactivate();
        }
        this.current = this.splash;
        document.body.setAttribute('data-mode', 'splash');
        this.splash.activate();
    }

    switch_to_editor() {
        if (this.current) {
            this.current.deactivate();
        }
        if (! this.loaded_in_editor) {
            this.editor.load_level(this.stored_level);
            this.loaded_in_editor = true;
        }
        this.current = this.editor;
        document.body.setAttribute('data-mode', 'editor');
        this.editor.activate();
    }

    switch_to_player() {
        if (this.current) {
            this.current.deactivate();
        }
        if (! this.loaded_in_player) {
            this.player.load_level(this.stored_level);
            this.loaded_in_player = true;
        }
        this.current = this.player;
        document.body.setAttribute('data-mode', 'player');
        // Activate last, so any DOM inspection (ahem, auto-scaling) already sees the effects of
        // data-mode revealing the header
        this.player.activate();
    }

    reload_all_options() {
        this.splash.reload_options(this.options);
        this.player.reload_options(this.options);
        this.editor.reload_options(this.options);
    }

    choose_tileset_for_level(stored_level) {
        if (stored_level.format === 'ccl') {
            return this.tilesets['cc1'];
        }
        if (stored_level.uses_ll_extensions === false) {
            return this.tilesets['cc2'];
        }
        return this.tilesets['ll'];
    }

    load_game(stored_game, identifier = null, level_index = null) {
        this.stored_game = stored_game;
        this._pack_test_dialog = null;

        this._pack_identifier = identifier;
        this.current_pack_savefile = null;
        if (identifier !== null) {
            // TODO again, enforce something about the shape here
            this.current_pack_savefile = JSON.parse(window.localStorage.getItem(STORAGE_PACK_PREFIX + identifier));
            if (this.current_pack_savefile) {
                let changed = false;
                // Do some version upgrades
                if (this.current_pack_savefile.total_score === null) {
                    // Fix some NaNs that slipped in
                    this.current_pack_savefile.total_score = this.current_pack_savefile.scorecards
                        .map(scorecard => scorecard ? scorecard.score : 0)
                        .reduce((a, b) => a + b, 0);
                    changed = true;
                }
                if (! this.current_pack_savefile.__version__) {
                    // Populate some more recently added fields
                    this.current_pack_savefile.total_levels = stored_game.level_metadata.length;
                    this.current_pack_savefile.total_abstime = 0;
                    this.current_pack_savefile.cleared_levels = 0;
                    this.current_pack_savefile.aidless_levels = 0;
                    for (let scorecard of this.current_pack_savefile.scorecards) {
                        if (! scorecard)
                            continue;
                        this.current_pack_savefile.total_abstime += scorecard.abstime;
                        this.current_pack_savefile.cleared_levels += 1;
                        if (scorecard.aid === 0) {
                            this.current_pack_savefile.aidless_levels += 1;
                        }
                    }
                    this.current_pack_savefile.__version__ = 2;
                    changed = true;
                }
                if (this.current_pack_savefile.__version__ <= 1) {
                    // I forgot to count a level as aidless on your first playthrough.  Also,
                    // total_time is not a useful field, since 'time' is just where the clock was
                    delete this.current_pack_savefile.total_time;
                    this.current_pack_savefile.aidless_levels = 0;
                    for (let scorecard of this.current_pack_savefile.scorecards) {
                        if (! scorecard)
                            continue;
                        if (scorecard.aid === 0) {
                            this.current_pack_savefile.aidless_levels += 1;
                        }
                    }
                    this.current_pack_savefile.__version__ = 2;
                }
                if (changed) {
                    this.save_savefile();
                }
            }
        }
        if (! this.current_pack_savefile) {
            this.current_pack_savefile = {
                __version__: 2,
                total_score: 0,
                total_abstime: 0,
                current_level: 1,
                highest_level: 1,
                total_levels: stored_game.level_metadata.length,
                cleared_levels: 0,
                aidless_levels: 0,
                // level scorecard: { time, abstime, bonus, score, aid } or null
                scorecards: [],
            };
        }

        this.player.load_game(stored_game);
        this.editor.load_game(stored_game);

        return this.change_level(level_index ?? (this.current_pack_savefile.current_level ?? 1) - 1);
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

        this.loaded_in_editor = false;
        this.loaded_in_player = false;
        if (this.current === this.player) {
            this.player.load_level(this.stored_level);
            this.loaded_in_player = true;
        }
        if (this.current === this.editor) {
            this.editor.load_level(this.stored_level);
            this.loaded_in_editor = true;
        }
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
        this.nav_next_button.disabled = !this.stored_game || this.level_index >= this.stored_game.level_metadata.length - 1;
    }

    set_compat(ruleset, flags) {
        if (ruleset === 'custom') {
            this._compat_ruleset = null;
        }
        else {
            this._compat_ruleset = ruleset;
        }

        document.querySelector('#main-compat output').textContent = COMPAT_RULESET_LABELS[ruleset];

        this.compat = flags;
    }

    save_stash() {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.stash));
    }

    save_savefile() {
        if (! this._pack_identifier)
            return;

        // Don't save if there's nothing to save
        if (! this.current_pack_savefile.cleared_levels && this.current_pack_savefile.current_level === 1)
            return;

        window.localStorage.setItem(STORAGE_PACK_PREFIX + this._pack_identifier, JSON.stringify(this.current_pack_savefile));

        // Also remember some stats in the stash, if it changed, so we can read it without having to
        // parse every single one of these things
        let packinfo = this.stash.packs[this._pack_identifier];
        if (! packinfo) {
            packinfo = {};
            this.stash.packs[this._pack_identifier] = packinfo;
        }
        let keys = ['total_score', 'total_abstime', 'total_levels', 'cleared_levels', 'aidless_levels'];
        if (keys.some(key => packinfo[key] !== this.current_pack_savefile[key])) {
            for (let key of keys) {
                packinfo[key] = this.current_pack_savefile[key];
            }
            this.save_stash();
            this.splash.update_pack_score(this._pack_identifier);
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
        else if (
            // standard mscc DAT
            magic === '\xac\xaa\x02\x00' ||
            // tile world i think
            magic === '\xac\xaa\x02\x01' ||
            // pgchip, which adds ice blocks
            magic === '\xac\xaa\x03\x00')
        {
            stored_game = dat.parse_game(buf);
        }
        else if (magic === 'PK\x03\x04') {
            // That's the ZIP header
            // FIXME move this here i guess and flesh it out some
            // FIXME if this doesn't find something then we should abort
            await this.splash.search_multi_source(new util.ZipFileSource(buf));
            return;
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

            if (stored_game.identifier) {
                // Migrate any scores saved under the old path-based identifier
                let new_identifier = stored_game.identifier;
                if (this.stash.packs[identifier] && ! this.stash.packs[new_identifier]) {
                    this.stash.packs[new_identifier] = this.stash.packs[identifier];
                    delete this.stash.packs[identifier];
                    this.save_stash();

                    window.localStorage.setItem(
                        STORAGE_PACK_PREFIX + new_identifier,
                        window.localStorage.getItem(STORAGE_PACK_PREFIX + identifier));
                    window.localStorage.removeItem(STORAGE_PACK_PREFIX + identifier);
                }

                identifier = new_identifier;
            }
        }
        else {
            throw new Error("Unrecognized file format");
        }

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

    let conductor = new Conductor();
    window._conductor = conductor;

    // Allow putting us in debug mode automatically if we're in development
    if (local && query.has('debug')) {
        conductor.player._start_in_debug_mode = true;
    }

    // Cheap hack to make sure the tileset(s) have loaded before we go any further
    // FIXME this can wait until we switch, it's not needed for the splash screen!  but it's here
    // for the moment because of ?level, do a better fix
    await Promise.all(Object.values(conductor.tilesets).map(tileset => tileset.image.decode()));

    // Pick a level (set)
    // TODO error handling  :(
    let path = query.get('setpath');
    let b64level = query.get('level');
    if (path && path.match(/^levels[/]/)) {
        conductor.fetch_pack(path);
    }
    else if (b64level) {
        // TODO all the more important to show errors!!
        let buf = util.b64decode(b64level);
        let u8array = new Uint8Array(buf);
        if (u8array[0] === 0x78) {
            // zlib compressed
            buf = fflate.unzlibSync(u8array).buffer;
        }
        await conductor.parse_and_load_game(buf, null, 'shared.c2m', null, "Shared level");
    }
}

(async () => {
    try {
        await main();
    }
    catch (e) {
        if (ll_log_fatal_error) {
            ll_log_fatal_error(e);
        }
        throw e;
    }

    if (ll_successfully_loaded) {
        ll_successfully_loaded();
    }
})();
