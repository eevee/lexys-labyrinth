import { readFile, stat } from 'fs/promises';
import { performance } from 'perf_hooks';
import { argv, exit, stderr, stdout } from 'process';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';

import { compat_flags_for_ruleset } from '../defs.js';
import { Level } from '../game.js';
import * as format_c2g from '../format-c2g.js';
import * as format_dat from '../format-dat.js';
import * as format_tws from '../format-tws.js';
import * as util from '../util.js';
import { LocalDirectorySource } from './lib.js';

// TODO arguments:
// - custom pack to test, possibly its solutions, possibly its ruleset (or default to steam-strict/lynx)
// - filter existing packs
// - verbose: ?
// - quiet: hide failure reasons
// - support for xfails somehow?
// TODO use this for a test suite


function pad(s, n) {
    return s.substring(0, n).padEnd(n, " ");
}

const RESULT_TYPES = {
    skipped: {
        color: "\x1b[90m",
        symbol: "-",
    },
    'no-replay': {
        color: "\x1b[90m",
        symbol: "0",
    },
    success: {
        color: "\x1b[92m",
        symbol: ".",
    },
    early: {
        color: "\x1b[96m",
        symbol: "?",
    },
    failure: {
        color: "\x1b[91m",
        symbol: "#",
    },
    'short': {
        color: "\x1b[93m",
        symbol: "#",
    },
    error: {
        color: "\x1b[95m",
        symbol: "X",
    },
};
const ANSI_RESET = "\x1b[39m";
function ansi_cursor_move(dx, dy) {
    if (dx > 0) {
        stdout.write(`\x1b[${dx}C`);
    }
    else if (dx < 0) {
        stdout.write(`\x1b[${-dx}D`);
    }

    if (dy > 0) {
        stdout.write(`\x1b[${dy}B`);
    }
    else if (dy < 0) {
        stdout.write(`\x1b[${-dy}A`);
    }
}

const dummy_sfx = {
    play() {},
    play_once() {},
};

function test_level(stored_level, compat) {
    let level;
    let level_start_time = performance.now();
    let make_result = (type, short_status, include_canvas) => {
        //let result_stuff = RESULT_TYPES[type];
        // XXX stdout.write(result_stuff.color + result_stuff.symbol);
        return {
            type,
            short_status,
            fail_reason: level ? level.fail_reason : null,
            time_elapsed: performance.now() - level_start_time,
            time_simulated: level ? level.tic_counter / 20 : null,
            tics_simulated: level ? level.tic_counter : null,
        };

        // FIXME allegedly it's possible to get a canvas working in node...
        /*
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
        */
    };

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
                return make_result('early', "Won early", true);
            }
            else {
                return make_result('success', "Won");
            }
        }
        else if (level.state === 'failure') {
            return make_result('failure', "Lost", true);
        }
        else if (level.tic_counter >= replay.duration + 220) {
            // This threshold of 11 seconds was scientifically calculated by noticing that
            // the TWS of Southpole runs 11 seconds past its last input
            return make_result('short', "Out of input", true);
        }

        if (level.tic_counter % 20 === 1) {
            // XXX
            /*
            if (handle.cancel) {
                return make_result('interrupted', "Interrupted");
                this.current_status.textContent = `Interrupted on level ${i + 1}/${num_levels}; ${num_passed} passed`;
                return;
            }
            */

            // Don't run for more than 100ms at a time, to avoid janking the browser...
            // TOO much.  I mean, we still want it to reflow the stuff we've added, but
            // we also want to be pretty aggressive so this finishes quickly
            // XXX unnecessary headless
            /*
            let now = performance.now();
            if (now - last_pause > 100) {
                await util.sleep(4);
                last_pause = now;
            }
            */
        }
    }
}

// Stuff that's related to testing a level, but is not actually testing a level
function test_level_wrapper(pack, level_index, level_filter, compat) {
    let result;
    let stored_level;
    if (level_filter && ! level_filter.has(level_index + 1)) {
        result = { type: 'skipped', short_status: "Skipped" };
    }
    else {
        try {
            stored_level = pack.load_level(level_index);
            if (! stored_level.has_replay) {
                result = { type: 'no-replay', short_status: "No replay" };
            }
            else {
                result = test_level(stored_level, compat);
            }
        }
        catch (e) {
            //console.error(e);
            result = {
                type: 'error',
                short_status: "Error",
                time_simulated: null,
                tics_simulated: null,
                exception: e,
            };
        }
    }
    result.level_index = level_index;
    result.time_expected = stored_level && stored_level.has_replay ? stored_level.replay.duration / 20 : null;
    result.title = stored_level ? stored_level.title : "[load error]";
    return result;
}

async function _scan_source(source) {
    // FIXME copied wholesale from Splash.search_multi_source; need a real filesystem + searching api!

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
        if (ext === 'c2g') {
            let buf = await source.get(path);
            //await this.conductor.parse_and_load_game(buf, source, path);
            // FIXME and this is from parse_and_load_game!!
            let dir;
            if (! path.match(/[/]/)) {
                dir = '';
            }
            else {
                dir = path.replace(/[/][^/]+$/, '');
            }
            return await format_c2g.parse_game(buf, source, dir);
        }
    }
    // TODO else...?  complain we couldn't find anything?  list what we did find??  idk
}

async function load_pack(testdef) {
    let pack;
    if ((await stat(testdef.pack_path)).isDirectory()) {
        let source = new LocalDirectorySource(testdef.pack_path);
        pack = await _scan_source(source);
    }
    else {
        let pack_data = await readFile(testdef.pack_path);
        if (testdef.pack_path.match(/[.]zip$/)) {
            let source = new util.ZipFileSource(pack_data.buffer);
            pack = await _scan_source(source);
        }
        else {
            pack = format_dat.parse_game(pack_data.buffer);

            let solutions_data = await readFile(testdef.solutions_path);
            let solutions = format_tws.parse_solutions(solutions_data.buffer);
            pack.level_replays = solutions.levels;
        }
    }

    if (! pack.title) {
        let match = testdef.pack_path.match(/(?:^|\/)([^/.]+)(?:\..*)?\/?$/);
        if (match) {
            pack.title = match[1];
        }
        else {
            pack.title = testdef.pack_path;
        }
    }

    return pack;
}

async function main_worker(testdef) {
    // We have to load the pack separately in every thread
    let pack = await load_pack(testdef);
    let ruleset = testdef.ruleset;
    let level_filter = testdef.level_filter;
    let compat = compat_flags_for_ruleset(ruleset);

    let t = performance.now();
    parentPort.on('message', level_index => {
        //console.log("idled for", (performance.now() - t) / 1000);
        parentPort.postMessage(test_level_wrapper(pack, level_index, level_filter, compat));
        t = performance.now();
    });
}

// the simplest pool in the world
async function* run_in_thread_pool(num_workers, worker_data, items) {
    let next_index = 0;
    let workers = [];
    let result_available_resolve;
    let result_available = new Promise(resolve => {
        result_available_resolve = resolve;
    });
    for (let i = 0; i < num_workers; i++) {
        let worker = new Worker(new URL(import.meta.url), {
            workerData: worker_data,
        });

        let waiting_on_index = null;
        let process_next = () => {
            if (next_index < items.length) {
                let item = items[next_index];
                next_index += 1;
                worker.postMessage(item);
            }
        };
        worker.on('message', result => {
            result_available_resolve(result);
            process_next();
        });
        process_next();

        workers.push(worker);
    }

    try {
        for (let i = 0; i < items.length; i++) {
            let result = await result_available;
            result_available = new Promise(resolve => {
                result_available_resolve = resolve;
            });

            yield result;
        }
    }
    finally {
        for (let worker of workers) {
            worker.terminate();
        }
    }
}


async function test_pack(testdef) {
    let pack = await load_pack(testdef);
    let ruleset = testdef.ruleset;
    let level_filter = testdef.level_filter;
    let compat = compat_flags_for_ruleset(ruleset);

    let num_levels = pack.level_metadata.length;
    let columns = stdout.columns || 80;
    // 20 for title, 1 for space, the dots, 1 for space, 9 for succeeded/total, 1 for padding
    let title_width = 20;
    let dots_per_row = columns - title_width - 1 - 1 - 9 - 1;
    // TODO factor out the common parts maybe?
    stdout.write(pad(`${pack.title} (${ruleset})`, title_width) + " ");
    let d = num_levels;
    let num_dot_lines = 1;
    while (d > 0) {
        let n = Math.min(d, dots_per_row);
        stdout.write("\x1b[90m");
        stdout.write("?".repeat(n));
        d -= n;
        if (d > 0) {
            stdout.write("\n");
            stdout.write(" ".repeat(title_width + 1));
            num_dot_lines += 1;
        }
    }
    ansi_cursor_move(0, -(num_dot_lines - 1));
    stdout.write(`\x1b[${title_width + 2}G`);

    let num_passed = 0;
    let num_missing = 0;
    let total_tics = 0;
    let t0 = performance.now();
    let last_pause = t0;
    let failures = [];
    let promises = [];
    let indices = [...Array(num_levels).keys()];
    for await (let result of run_in_thread_pool(4, testdef, indices)) {
        //let result = test_level_wrapper(pack, i, level_filter, compat);
        let result_stuff = RESULT_TYPES[result.type];
        let col = result.level_index % dots_per_row;
        let row = Math.floor(result.level_index / dots_per_row);
        ansi_cursor_move(col, row);
        stdout.write(result_stuff.color + result_stuff.symbol);
        ansi_cursor_move(-(col + 1), -row);

        if (result.tics_simulated) {
            total_tics += result.tics_simulated;
        }

        if (result.type === 'no-replay') {
            num_missing += 1;
        }
        else if (result.type === 'success' || result.type === 'early') {
            num_passed += 1;
        }
        else {
            failures.push(result);
        }
    }

    let total_real_elapsed = (performance.now() - t0) / 1000;

    ansi_cursor_move(dots_per_row + 1, 0);
    stdout.write(`${ANSI_RESET} ${num_passed}/${num_levels - num_missing}`);
    ansi_cursor_move(0, num_dot_lines - 1);
    stdout.write("\n");
    failures.sort((a, b) => a.level_index - b.level_index);
    for (let failure of failures) {
        let short_status = failure.short_status;
        if (failure.type === 'failure') {
            short_status += ": ";
            short_status += failure.fail_reason;
        }

        let parts = [
            String(failure.level_index + 1).padStart(5),
            pad(failure.title.replace(/[\r\n]+/, " "), 32),
            RESULT_TYPES[failure.type].color + pad(short_status, 20) + ANSI_RESET,
        ];
        if (failure.time_simulated !== null) {
            parts.push("ran for" + util.format_duration(failure.time_simulated).padStart(6, " "));
        }
        if (failure.type === 'failure') {
            parts.push("  with" + util.format_duration(failure.time_expected - failure.time_simulated).padStart(6, " ") + " still to go");
        }
        stdout.write(parts.join(" ") + "\n");
    }

    return {
        num_passed,
        num_missing,
        num_failed: num_levels - num_passed - num_missing,
        // FIXME should maybe count the thread time if we care about actual game speedup
        time_elapsed: total_real_elapsed,
        time_simulated: total_tics / 20,
    };
}

// -------------------------------------------------------------------------------------------------

const USAGE = `\
Usage: bulktest.mjs [OPTION]... [FILE]...
Runs replays for the given level packs and report results.
With no FILE given, default to the built-in copy of CC2LP1.

Arguments may be repeated, and apply to any subsequent pack, so different packs
may be run with different compat modes.
  -c            compatibility mode; one of
                  lexy (default), steam, steam-strict, lynx, ms
  -r            path to a file containing replays; for CCL/DAT packs, which
                  don't support built-in replays, this must be a TWS file
  -l            level range to play back; either 'all' or a string like '1-4,10'
  -f            force the next argument to be interpreted as a file path, if for
                  some perverse reason you have a level file named '-c'
  -h, --help    ignore other arguments and show this message

Supports the same filetypes as Lexy's Labyrinth: DAT/CCL, C2M, or a directory
containing a C2G.
`;
class ArgParseError extends Error {}
function parse_level_range(string) {
    if (string === 'all') {
        return null;
    }

    let res = new Set;
    let parts = string.split(/,/);
    for (let part of parts) {
        let endpoints = part.match(/^(\d+)(?:-(\d+))?$/);
        if (endpoints === null)
            throw new ArgParseError(`Bad syntax in level range: ${part}`);
        let a = parseInt(endpoints[1], 10);
        let b = endpoints[2] === undefined ? a : parseInt(endpoints[2], 10);
        if (a > b)
            throw new ArgParseError(`Backwards span in level range: ${part}`);
        for (let n = a; n <= b; n++) {
            res.add(n);
        }
    }

    return res;
}
function parse_args() {
    // Parse arguments
    let test_template = {
        ruleset: 'lexy',
        solutions_path: null,
        level_filter: null,
    };
    let tests = [];

    try {
        let i;
        let next_arg = () => {
            i += 1;
            if (i >= argv.length)
                throw new ArgParseError(`Missing argument after ${argv[i - 1]}`);
            return argv[i];
        };
        for (i = 2; i < argv.length; i++) {
            let arg = argv[i];
            if (arg === '-h' || arg === '--help') {
                stdout.write(USAGE);
                exit(0);
            }

            if (arg === '-c') {
                let ruleset = next_arg();
                if (['lexy', 'steam', 'steam-strict', 'lynx', 'ms'].indexOf(ruleset) === -1)
                    throw new ArgParseError(`Unrecognized compat mode: ${ruleset}`);
                test_template.ruleset = ruleset;
            }
            else if (arg === '-r') {
                test_template.solutions_path = next_arg();
            }
            else if (arg === '-l') {
                test_template.level_filter = parse_level_range(next_arg());
            }
            else if (arg === '-f') {
                tests.push({ pack_path: next_arg(), ...test_template });
            }
            else {
                tests.push({ pack_path: arg, ...test_template });
            }
        }
    }
    catch (e) {
        if (e instanceof ArgParseError) {
            stderr.write(e.message);
            stderr.write("\n");
            exit(2);
        }
    }

    if (tests.length === 0) {
        tests.push({ pack_path: 'levels/CC2LP1.zip', ...test_template });
    }

    return tests;
}

async function main() {
    let tests = parse_args();

    let overall = {
        num_passed: 0,
        num_missing: 0,
        num_failed: 0,
        time_elapsed: 0,
        time_simulated: 0,
    };
    for (let testdef of tests) {
        let result = await test_pack(testdef);
        for (let key of Object.keys(overall)) {
            overall[key] += result[key];
        }
    }

    let num_levels = overall.num_passed + overall.num_failed + overall.num_missing;
    stdout.write("\n");
    stdout.write(`${overall.num_passed}/${num_levels} = ${(overall.num_passed / num_levels * 100).toFixed(1)}% passed (${overall.num_failed} failed, ${overall.num_missing} missing replay)\n`);
    stdout.write(`Simulated ${util.format_duration(overall.time_simulated)} of game time in ${util.format_duration(overall.time_elapsed)}, speed of ${(overall.time_simulated / overall.time_elapsed).toFixed(1)}×\n`);

}

if (isMainThread) {
    main();
}
else {
    main_worker(workerData);
}
