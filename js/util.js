import * as fflate from './vendor/fflate.js';

// Base class for custom errors
export class LLError extends Error {}

// Random choice
export function random_range(a, b = null) {
    if (b === null) {
        b = a;
        a = 0;
    }
    return a + Math.floor(Math.random() * (b - a));
}

export function random_choice(list) {
    return list[Math.floor(Math.random() * list.length)];
}

export function random_shuffle(list) {
    // Knuth–Fisher–Yates, of course
    for (let i = list.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
    }
}

export function setdefault(map, key, defaulter) {
    if (map.has(key)) {
        return map.get(key);
    }
    else {
        let value = defaulter();
        map.set(key, value);
        return value;
    }
}


// -------------------------------------------------------------------------------------------------
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

export function trigger_local_download(filename, blob) {
    let url = URL.createObjectURL(blob);
    // To download a file, um, make an <a> and click it.  Not kidding
    let a = mk('a', {
        href: url,
        download: filename,
    });
    document.body.append(a);
    a.click();
    // Absolutely no idea when I'm allowed to revoke this, but surely a minute is safe
    window.setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
    }, 60 * 1000);
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


export const is_likely_mac = globalThis.window && /mac|iPhone|iPad|iPod/i.test(window.navigator.platform);

// On macOS it’s more natural to use the Command key for shortcuts.
export function has_ctrl_key(ev) {
  return is_likely_mac ? ev.metaKey : ev.ctrlKey;
}


// -------------------------------------------------------------------------------------------------
// Promises and networking

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


export async function fetch(url, response_type = 'arraybuffer') {
    let xhr = new XMLHttpRequest;
    let promise = promise_event(xhr, 'load', 'error');
    xhr.open('GET', url);
    xhr.responseType = response_type;
    xhr.send();
    await promise;
    if (xhr.status !== 200)
        throw new Error(`Failed to load ${url} -- ${xhr.status} ${xhr.statusText}`);
    return xhr.response;
}


// -------------------------------------------------------------------------------------------------
// Data

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

    // Use a modified Bresenham.  Use mirroring to move everything into the first quadrant, then
    // split it into two octants depending on whether dx or dy increases faster, and call that the
    // main axis.  Track an "error" value, which is the (negative) distance between the ray and the
    // next grid line parallel to the main axis, but scaled up by dx.  Every iteration, we move one
    // cell along the main axis and increase the error value by dy (the ray's slope, scaled up by
    // dx); when it becomes positive, we can subtract dx (1) and move one cell along the minor axis
    // as well.  Since the main axis is the faster one, we'll never traverse more than one cell on
    // the minor axis for one cell on the main axis, and this readily provides every cell the ray
    // hits in order.
    // Based on: http://www.idav.ucdavis.edu/education/GraphicsNotes/Bresenhams-Algorithm/Bresenhams-Algorithm.html

    // Setup: map to the first quadrant.  The "offsets" are the distance between the starting point
    // and the next grid point.
    let step_a = 1;
    let offset_x = 1 - (x0 - a);
    if (offset_x === 0) {
        // Zero offset means we're on a grid line, so we're a full cell away from the next grid line
        offset_x = 1;
    }
    if (dx < 0) {
        dx = -dx;
        step_a = -step_a;
        offset_x = 1 - offset_x;
    }
    let step_b = 1;
    let offset_y = 1 - (y0 - b);
    if (offset_y === 0) {
        offset_y = 1;
    }
    if (dy < 0) {
        dy = -dy;
        step_b = -step_b;
        offset_y = 1 - offset_y;
    }

    let err = dy * offset_x - dx * offset_y;

    if (dx > dy) {
        // Main axis is x/a
        while (min_a <= a && a <= max_a && min_b <= b && b <= max_b) {
            if (a === goal_x && b === goal_y) {
                yield [a, b];
                return;
            }
            // When we go exactly through a corner, we cross two grid lines, but between them we
            // enter a cell the line doesn't actually pass through.  That happens here, when err ===
            // dx, because it was 0 last loop
            if (err !== dy) {
                yield [a, b];
            }

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
            if (a === goal_x && b === goal_y) {
                yield [a, b];
                return;
            }
            if (err !== dx) {
                yield [a, b];
            }

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


// Baby's first bit vector
export class BitVector {
    constructor(size) {
        this.array = new Uint32Array(Math.ceil(size / 32));
    }

    get(bit) {
        let i = Math.floor(bit / 32);
        let b = bit % 32;
        return (this.array[i] & (1 << b)) !== 0;
    }

    set(bit) {
        let i = Math.floor(bit / 32);
        let b = bit % 32;
        this.array[i] |= (1 << b);
    }

    clear(bit) {
        let i = Math.floor(bit / 32);
        let b = bit % 32;
        this.array[i] &= ~(1 << b);
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

    // Get a list of all files under here, recursively
    // async *iter_all_files() {}
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

    iter_all_files() {
        return Object.keys(this.files);
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
// Regular HTTP fetch, but for a directory structure from nginx's index module
export class HTTPNginxDirectorySource extends FileSource {
    // Should be given a URL object as a root
    constructor(root) {
        super();
        this.root = root;
        if (! this.root.pathname.endsWith('/')) {
            this.root.pathname += '/';
        }
    }

    get(path) {
        // TODO should strip off multiple of these
        // TODO and canonicalize, and disallow going upwards
        if (path.startsWith('/')) {
            path = path.substring(1);
        }
        let url = new URL(path, this.root);
        return fetch(url);
    }

    async *iter_all_files() {
        let fetch_count = 0;
        let paths = [''];
        while (paths.length > 0) {
            let next_paths = [];
            for (let path of paths) {
                if (fetch_count >= 50) {
                    throw new Error("Too many subdirectories to fetch one at a time; is this really a single CC2 set?");
                }
                let response = await fetch(new URL(path, this.root), 'text');
                fetch_count += 1;
                let doc = document.implementation.createHTMLDocument();
                doc.write(response);
                doc.close();
                for (let link of doc.querySelectorAll('a')) {
                    let subpath = link.getAttribute('href');
                    if (subpath === '../') {
                        continue;
                    }
                    else if (subpath.endsWith('/')) {
                        next_paths.push(path + subpath);
                    }
                    else {
                        yield path + subpath;
                    }
                }
            }
            paths = next_paths;
        }
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

    async iter_all_files() {
        await this._loaded_promise;
        return Object.keys(this.files);
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

    iter_all_files() {
        return Object.keys(this.files);
    }
}


// MD5 hash, based on code by Paul Johnston and Greg Holt.
// Modified to take a Uint8Array.
export function md5(bytes) {
    let hc="0123456789abcdef";
    function rh(n) {let j,s="";for(j=0;j<=3;j++) s+=hc.charAt((n>>(j*8+4))&0x0F)+hc.charAt((n>>(j*8))&0x0F);return s;}
    function ad(x,y) {let l=(x&0xFFFF)+(y&0xFFFF);let m=(x>>16)+(y>>16)+(l>>16);return (m<<16)|(l&0xFFFF);}
    function rl(n,c)            {return (n<<c)|(n>>>(32-c));}
    function cm(q,a,b,x,s,t)    {return ad(rl(ad(ad(a,q),ad(x,t)),s),b);}
    function ff(a,b,c,d,x,s,t)  {return cm((b&c)|((~b)&d),a,b,x,s,t);}
    function gg(a,b,c,d,x,s,t)  {return cm((b&d)|(c&(~d)),a,b,x,s,t);}
    function hh(a,b,c,d,x,s,t)  {return cm(b^c^d,a,b,x,s,t);}
    function ii(a,b,c,d,x,s,t)  {return cm(c^(b|(~d)),a,b,x,s,t);}
    function sb(x) {
        let i;let nblk=((x.length+8)>>6)+1;let blks=new Uint32Array(nblk*16);
        for(i=0;i<x.length;i++) blks[i>>2]|=x[i]<<((i%4)*8);
        blks[i>>2]|=0x80<<((i%4)*8);blks[nblk*16-2]=x.length*8;return blks;
    }
    let i,x=sb(bytes),a=1732584193,b=-271733879,c=-1732584194,d=271733878,olda,oldb,oldc,oldd;
    for(i=0;i<x.length;i+=16) {olda=a;oldb=b;oldc=c;oldd=d;
        a=ff(a,b,c,d,x[i+ 0], 7, -680876936);d=ff(d,a,b,c,x[i+ 1],12, -389564586);c=ff(c,d,a,b,x[i+ 2],17,  606105819);
        b=ff(b,c,d,a,x[i+ 3],22,-1044525330);a=ff(a,b,c,d,x[i+ 4], 7, -176418897);d=ff(d,a,b,c,x[i+ 5],12, 1200080426);
        c=ff(c,d,a,b,x[i+ 6],17,-1473231341);b=ff(b,c,d,a,x[i+ 7],22,  -45705983);a=ff(a,b,c,d,x[i+ 8], 7, 1770035416);
        d=ff(d,a,b,c,x[i+ 9],12,-1958414417);c=ff(c,d,a,b,x[i+10],17,     -42063);b=ff(b,c,d,a,x[i+11],22,-1990404162);
        a=ff(a,b,c,d,x[i+12], 7, 1804603682);d=ff(d,a,b,c,x[i+13],12,  -40341101);c=ff(c,d,a,b,x[i+14],17,-1502002290);
        b=ff(b,c,d,a,x[i+15],22, 1236535329);a=gg(a,b,c,d,x[i+ 1], 5, -165796510);d=gg(d,a,b,c,x[i+ 6], 9,-1069501632);
        c=gg(c,d,a,b,x[i+11],14,  643717713);b=gg(b,c,d,a,x[i+ 0],20, -373897302);a=gg(a,b,c,d,x[i+ 5], 5, -701558691);
        d=gg(d,a,b,c,x[i+10], 9,   38016083);c=gg(c,d,a,b,x[i+15],14, -660478335);b=gg(b,c,d,a,x[i+ 4],20, -405537848);
        a=gg(a,b,c,d,x[i+ 9], 5,  568446438);d=gg(d,a,b,c,x[i+14], 9,-1019803690);c=gg(c,d,a,b,x[i+ 3],14, -187363961);
        b=gg(b,c,d,a,x[i+ 8],20, 1163531501);a=gg(a,b,c,d,x[i+13], 5,-1444681467);d=gg(d,a,b,c,x[i+ 2], 9,  -51403784);
        c=gg(c,d,a,b,x[i+ 7],14, 1735328473);b=gg(b,c,d,a,x[i+12],20,-1926607734);a=hh(a,b,c,d,x[i+ 5], 4,    -378558);
        d=hh(d,a,b,c,x[i+ 8],11,-2022574463);c=hh(c,d,a,b,x[i+11],16, 1839030562);b=hh(b,c,d,a,x[i+14],23,  -35309556);
        a=hh(a,b,c,d,x[i+ 1], 4,-1530992060);d=hh(d,a,b,c,x[i+ 4],11, 1272893353);c=hh(c,d,a,b,x[i+ 7],16, -155497632);
        b=hh(b,c,d,a,x[i+10],23,-1094730640);a=hh(a,b,c,d,x[i+13], 4,  681279174);d=hh(d,a,b,c,x[i+ 0],11, -358537222);
        c=hh(c,d,a,b,x[i+ 3],16, -722521979);b=hh(b,c,d,a,x[i+ 6],23,   76029189);a=hh(a,b,c,d,x[i+ 9], 4, -640364487);
        d=hh(d,a,b,c,x[i+12],11, -421815835);c=hh(c,d,a,b,x[i+15],16,  530742520);b=hh(b,c,d,a,x[i+ 2],23, -995338651);
        a=ii(a,b,c,d,x[i+ 0], 6, -198630844);d=ii(d,a,b,c,x[i+ 7],10, 1126891415);c=ii(c,d,a,b,x[i+14],15,-1416354905);
        b=ii(b,c,d,a,x[i+ 5],21,  -57434055);a=ii(a,b,c,d,x[i+12], 6, 1700485571);d=ii(d,a,b,c,x[i+ 3],10,-1894986606);
        c=ii(c,d,a,b,x[i+10],15,   -1051523);b=ii(b,c,d,a,x[i+ 1],21,-2054922799);a=ii(a,b,c,d,x[i+ 8], 6, 1873313359);
        d=ii(d,a,b,c,x[i+15],10,  -30611744);c=ii(c,d,a,b,x[i+ 6],15,-1560198380);b=ii(b,c,d,a,x[i+13],21, 1309151649);
        a=ii(a,b,c,d,x[i+ 4], 6, -145523070);d=ii(d,a,b,c,x[i+11],10,-1120210379);c=ii(c,d,a,b,x[i+ 2],15,  718787259);
        b=ii(b,c,d,a,x[i+ 9],21, -343485551);a=ad(a,olda);b=ad(b,oldb);c=ad(c,oldc);d=ad(d,oldd);
    }
    return rh(a)+rh(b)+rh(c)+rh(d);
}
