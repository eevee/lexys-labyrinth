import * as fflate from './vendor/fflate.js';

// Base class for custom errors
export class LLError extends Error {}

// Random choice
export function random_choice(list) {
    return list[Math.floor(Math.random() * list.length)];
}


// DOM stuff
function _mk(el, children) {
    if (children.length > 0) {
        if (!(children[0] instanceof Node) && children[0] !== undefined && typeof(children[0]) !== "string" && typeof(children[0]) !== "number") {
            let [attrs] = children.splice(0, 1);
            for (let [key, value] of Object.entries(attrs)) {
                el.setAttribute(key, value);
            }
        }
        el.append(...children);
    }
    return el;
}

export function mk(tag_selector, ...children) {
    let [tag, ...classes] = tag_selector.split('.');
    let el = document.createElement(tag);
    if (classes.length > 0) {
        el.classList = classes.join(' ');
    }
    return _mk(el, children);
}

export function mk_button(label, onclick) {
    let el = mk('button', {type: 'button'}, label);
    el.addEventListener('click', onclick);
    return el;
}

export const SVG_NS = 'http://www.w3.org/2000/svg';
export function mk_svg(tag_selector, ...children) {
    let [tag, ...classes] = tag_selector.split('.');
    let el = document.createElementNS(SVG_NS, tag);
    if (classes.length > 0) {
        el.classList = classes.join(' ');
    }
    return _mk(el, children);
}

export function handle_drop(element, options) {
    let dropzone_class = options.dropzone_class ?? null;
    let on_drop = options.on_drop;

    let require_file = options.require_file ?? false;
    let is_valid = ev => {
        // TODO this requires files, should make some args for this
        if (options.require_file) {
            let dt = ev.dataTransfer;
            if (! dt || dt.items.length === 0)
                return false;

            // Only test the first item I guess?  If it's a file then they should all be files
            if (dt.items[0].kind !== 'file')
                return false;
        }

        return true;
    };

    let end_drop = () => {
        if (dropzone_class !== null) {
            element.classList.remove(dropzone_class);
        }
    };

    // TODO should have a filter function for when a drag is valid but i forget which of these
    // should have that
    element.addEventListener('dragenter', ev => {
        if (! is_valid(ev))
            return;

        ev.stopPropagation();
        ev.preventDefault();

        if (dropzone_class !== null) {
            element.classList.add(dropzone_class);
        }
    });
    element.addEventListener('dragover', ev => {
        if (! is_valid(ev))
            return;

        ev.stopPropagation();
        ev.preventDefault();
    });
    element.addEventListener('dragleave', ev => {
        if (ev.relatedTarget && element.contains(ev.relatedTarget))
            return;

        end_drop();
    });
    element.addEventListener('drop', ev => {
        if (! is_valid(ev))
            return;

        ev.stopPropagation();
        ev.preventDefault();

        end_drop();
        on_drop(ev);
    });
}

export function sleep(t) {
    return new Promise(res => {
        setTimeout(res, t);
    });
}

export function promise_event(element, success_event, failure_event) {
    let resolve, reject;
    let promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });

    let success_handler = ev => {
        element.removeEventListener(success_event, success_handler);
        if (failure_event) {
            element.removeEventListener(failure_event, failure_handler);
        }

        resolve(ev);
    };
    let failure_handler = ev => {
        element.removeEventListener(success_event, success_handler);
        if (failure_event) {
            element.removeEventListener(failure_event, failure_handler);
        }

        reject(ev);
    };

    element.addEventListener(success_event, success_handler);
    if (failure_event) {
        element.addEventListener(failure_event, failure_handler);
    }

    return promise;
}


export async function fetch(url) {
    let xhr = new XMLHttpRequest;
    let promise = promise_event(xhr, 'load', 'error');
    xhr.open('GET', url);
    xhr.responseType = 'arraybuffer';
    xhr.send();
    await promise;
    if (xhr.status !== 200)
        throw new Error(`Failed to load ${url} -- ${xhr.status} ${xhr.statusText}`);
    return xhr.response;
}

export function string_from_buffer_ascii(buf, start = 0, len) {
    if (ArrayBuffer.isView(buf)) {
        start += buf.byteOffset;
        buf = buf.buffer;
    }
    return String.fromCharCode.apply(null, new Uint8Array(buf, start, len));
}

// Converts a string to a buffer, using NO ENCODING, assuming single-byte characters
export function bytestring_to_buffer(bytestring) {
    return Uint8Array.from(bytestring, c => c.charCodeAt(0)).buffer;
}

export function b64encode(value) {
    if (value instanceof ArrayBuffer || value instanceof Uint8Array) {
        value = string_from_buffer_ascii(value);
    }
    // Make URL-safe and strip trailing padding
    return btoa(value).replace(/[+]/g, '-').replace(/[/]/g, '_').replace(/=+$/, '');
}

export function b64decode(data) {
    return bytestring_to_buffer(atob(data.replace(/-/g, '+').replace(/_/g, '/')));
}

export function format_duration(seconds, places = 0) {
    let sign = '';
    if (seconds < 0) {
        seconds = -seconds;
        sign = '-';
    }
    let mins = Math.floor(seconds / 60);
    let secs = seconds % 60;
    let rounded_secs = secs.toFixed(places);
    // TODO hours?
    return `${sign}${mins}:${parseFloat(rounded_secs) < 10 ? '0' : ''}${rounded_secs}`;
}

export class DelayTimer {
    constructor() {
        this.active = false;
        this._handle = null;
        this._bound_alarm = this._alarm.bind(this);
    }

    set(duration) {
        if (this._handle) {
            window.clearTimeout(this._handle);
        }

        this.active = true;
        this._handle = window.setTimeout(this._bound_alarm, duration);
    }

    _alarm() {
        this._handle = null;
        this.active = false;
    }
}

// Cast a line through a grid and yield every cell it touches
export function* walk_grid(x0, y0, x1, y1, min_a, min_b, max_a, max_b) {
    // TODO if the ray starts outside the grid (extremely unlikely), we should
    // find the point where it ENTERS the grid, otherwise the 'while'
    // conditions below will stop immediately
    let a = Math.floor(x0);
    let b = Math.floor(y0);

    let dx = x1 - x0;
    let dy = y1 - y0;
    if (dx === 0 && dy === 0) {
        // Special case: the ray goes nowhere, so only return this block
        yield [a, b];
        return;
    }

    let goal_x = Math.floor(x1);
    let goal_y = Math.floor(y1);

    // Use a modified Bresenham.  Use mirroring to move everything into the
    // first quadrant, then split it into two octants depending on whether dx
    // or dy increases faster, and call that the main axis.  Track an "error"
    // value, which is the (negative) distance between the ray and the next
    // grid line parallel to the main axis, but scaled up by dx.  Every
    // iteration, we move one cell along the main axis and increase the error
    // value by dy (the ray's slope, scaled up by dx); when it becomes
    // positive, we can subtract dx (1) and move one cell along the minor axis
    // as well.  Since the main axis is the faster one, we'll never traverse
    // more than one cell on the minor axis for one cell on the main axis, and
    // this readily provides every cell the ray hits in order.
    // Based on: http://www.idav.ucdavis.edu/education/GraphicsNotes/Bresenhams-Algorithm/Bresenhams-Algorithm.html

    // Setup: map to the first quadrant.  The "offsets" are the distance
    // between the starting point and the next grid point.
    let step_a = 1;
    let offset_x = 1 - (x0 - a);
    if (dx < 0) {
        dx = -dx;
        step_a = -step_a;
        offset_x = 1 - offset_x;
    }
    else if (offset_x === 0) {
        // Zero offset means we're on a grid line, so we're a full cell away from the next grid line
        // (if we're moving forward; if we're moving backward, the next cell really is 0 away)
        offset_x = 1;
    }
    let step_b = 1;
    let offset_y = 1 - (y0 - b);
    if (dy < 0) {
        dy = -dy;
        step_b = -step_b;
        offset_y = 1 - offset_y;
    }
    else if (offset_y === 0) {
        offset_y = 1;
    }

    let err = dy * offset_x - dx * offset_y;

    if (dx > dy) {
        // Main axis is x/a
        while (min_a <= a && a <= max_a && min_b <= b && b <= max_b) {
            yield [a, b];
            if (a === goal_x && b === goal_y)
                return;

            if (err > 0) {
                err -= dx;
                b += step_b;
                yield [a, b];
                if (a === goal_x && b === goal_y)
                    return;
            }
            err += dy;
            a += step_a;
        }
    }
    else {
        err = -err;
        // Main axis is y/b
        while (min_a <= a && a <= max_a && min_b <= b && b <= max_b) {
            yield [a, b];
            if (a === goal_x && b === goal_y)
                return;

            if (err > 0) {
                err -= dy;
                a += step_a;
                yield [a, b];
                if (a === goal_x && b === goal_y)
                    return;
            }
            err += dx;
            b += step_b;
        }
    }
}

// Root class to indirect over where we might get files from
// - a pool of uploaded in-memory files
// - a single uploaded zip file
// - a local directory provided via the webkit Entry api
// - HTTP (but only for files we choose ourselves, not arbitrary ones, due to CORS)
// Note that where possible, these classes lowercase all filenames, in keeping with C2G's implicit
// requirement that filenames are case-insensitive  :/
export class FileSource {
    constructor() {}

    // Get a file's contents as an ArrayBuffer
    async get(path) {}
}
// Files we have had uploaded one at a time (note that each upload becomes its own source)
export class FileFileSource extends FileSource {
    constructor(files) {
        super();
        this.files = {};
        for (let file of files) {
            this.files[(file.webkitRelativePath ?? file.name).toLowerCase()] = file;
        }
    }

    get(path) {
        let file = this.files[path.toLowerCase()];
        if (file) {
            return file.arrayBuffer();
        }
        else {
            return Promise.reject(new Error(`No such file was provided: ${path}`));
        }
    }
}
// Regular HTTP fetch
export class HTTPFileSource extends FileSource {
    // Should be given a URL object as a root
    constructor(root) {
        super();
        this.root = root;
    }

    get(path) {
        let url = new URL(path, this.root);
        return fetch(url);
    }
}
// WebKit Entry interface
// XXX this does not appear to work if you drag in a link to a directory but that is probably beyond
// my powers to fix
export class EntryFileSource extends FileSource {
    constructor(entries) {
        super();
        this.files = {};
        let file_count = 0;

        let read_directory = async (directory_entry, dir_prefix) => {
            let reader = directory_entry.createReader();
            let all_entries = [];
            while (true) {
                let entries = await new Promise((res, rej) => reader.readEntries(res, rej));
                all_entries.push.apply(all_entries, entries);
                if (entries.length === 0)
                    break;
            }

            await handle_entries(all_entries, dir_prefix);
        };
        let handle_entries = (entries, dir_prefix) => {
            file_count += entries.length;
            if (file_count > 4096)
                throw new LLError("Found way too many files; did you drag in the wrong directory?");

            let dir_promises = [];
            for (let entry of entries) {
                if (entry.isDirectory) {
                    dir_promises.push(read_directory(entry, dir_prefix + entry.name + '/'));
                }
                else {
                    this.files[(dir_prefix + entry.name).toLowerCase()] = entry;
                }
            }

            return Promise.all(dir_promises);
        };

        this._loaded_promise = handle_entries(entries, '');
    }

    async get(path) {
        let entry = this.files[path.toLowerCase()];
        if (! entry)
            throw new LLError(`No such file in local directory: ${path}`);

        let file = await new Promise((res, rej) => entry.file(res, rej));
        return await file.arrayBuffer();
    }
}
// Zip files, using fflate
// TODO somewhat unfortunately fflate only supports unzipping the whole thing at once, not
// individual files as needed, but it's also pretty new so maybe later?
export class ZipFileSource extends FileSource {
    constructor(buf) {
        super();
        // TODO async?  has some setup time but won't freeze browser
        let files = fflate.unzipSync(new Uint8Array(buf));
        this.files = {};
        for (let [path, file] of Object.entries(files)) {
            this.files['/' + path.toLowerCase()] = file;
        }
    }

    async get(path) {
        let file = this.files[path.toLowerCase()];
        if (! file)
            throw new LLError(`No such file in zip: ${path}`);

        return file.buffer;
    }
}
