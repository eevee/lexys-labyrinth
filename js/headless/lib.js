import { opendir, readFile } from 'fs/promises';

import canvas from 'canvas';

import CanvasRenderer from '../renderer-canvas.js';
import * as util from '../util.js';

export class NodeCanvasRenderer extends CanvasRenderer {
    static make_canvas(w, h) {
        return canvas.createCanvas(w, h);
    }
}

export class LocalDirectorySource extends util.FileSource {
    constructor(root) {
        super();
        this.root = root;
        this.files = {};
        this._loaded_promise = this._scan_dir('/');
    }

    async _scan_dir(path) {
        let dir = await opendir(this.root + path);
        for await (let dirent of dir) {
            if (dirent.isDirectory()) {
                await this._scan_dir(path + dirent.name + '/');
            }
            else {
                let filepath = path + dirent.name;
                this.files[filepath.toLowerCase()] = filepath;
                if (this.files.size > 2000)
                    throw `way, way too many files in local directory source ${this.root}`;
            }
        }
    }

    async get(path) {
        let realpath = this.files[path.toLowerCase()];
        if (realpath) {
            return (await readFile(this.root + realpath)).buffer;
        }
        else {
            throw new Error(`No such file: ${path}`);
        }
    }
}


