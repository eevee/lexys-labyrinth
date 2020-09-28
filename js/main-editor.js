import { DIRECTIONS, TICS_PER_SECOND } from './defs.js';
import { PrimaryView, DialogOverlay } from './main-base.js';
import CanvasRenderer from './renderer-canvas.js';
import TILE_TYPES from './tiletypes.js';
import { mk, mk_svg, walk_grid } from './util.js';

class EditorShareOverlay extends DialogOverlay {
    constructor(conductor, url) {
        super(conductor);
        this.set_title("give this to friends");
        this.main.append(mk('p', "Give this URL out to let others try your level:"));
        this.main.append(mk('p.editor-share-url', {}, url));
        let copy_button = mk('button', {type: 'button'}, "Copy to clipboard");
        copy_button.addEventListener('click', ev => {
            navigator.clipboard.writeText(url);
            // TODO feedback?
        });
        this.main.append(copy_button);

        let ok = mk('button', {type: 'button'}, "neato");
        ok.addEventListener('click', ev => {
            this.close();
        });
        this.footer.append(ok);
    }
}

// Stores and controls what the mouse is doing during a movement, mostly by dispatching to functions
// defined for the individual tools
const MOUSE_BUTTON_MASKS = [1, 4, 2];  // MouseEvent.button/buttons are ordered differently
class MouseOperation {
    constructor(editor, ev, target = null) {
        this.editor = editor;
        this.target = target;
        this.button_mask = MOUSE_BUTTON_MASKS[ev.button];

        // Client coordinates of the initial click
        this.mx0 = ev.clientX;
        this.my0 = ev.clientY;

        // Client coordinates of the previous mouse position
        this.mx1 = ev.clientX;
        this.my1 = ev.clientY;
        // Cell coordinates of the previous mouse position
        [this.gx1, this.gy1] = this.editor.renderer.cell_coords_from_event(ev);
        // Real cell coordinates (i.e. including fractional position within a cell) of etc
        [this.gx1f, this.gy1f] = this.editor.renderer.real_cell_coords_from_event(ev);

        this.start();
    }

    cell(gx, gy) {
        return this.editor.stored_level.cells[Math.floor(gy)][Math.floor(gx)];
    }

    do_mousemove(ev) {
        let [gx1f, gy1f] = this.editor.renderer.real_cell_coords_from_event(ev);

        this.step(ev.clientX, ev.clientY, gx1f, gy1f);

        // Client coordinates of the previous mouse position
        this.mx1 = ev.clientX;
        this.my1 = ev.clientY;
        // Cell coordinates of the previous mouse position
        [this.gx1, this.gy1] = this.editor.renderer.cell_coords_from_event(ev);
        // Real cell coordinates (i.e. including fractional position within a cell) of etc
        this.gx1f = gx1f;
        this.gy1f = gy1f;
    }

    do_commit() {
        this.commit();
    }

    do_abort() {
        this.abort();
    }

    // Implement these
    start() {}
    step(x, y) {}
    commit() {}
    abort() {}
}

class PanOperation extends MouseOperation {
    step(mx, my) {
        this.editor.viewport_el.scrollLeft -= mx - this.mx1;
        this.editor.viewport_el.scrollTop -= my - this.my1;
    }
}

class DrawOperation extends MouseOperation {
}

class PencilOperation extends DrawOperation {
    start() {
        this.editor.place_in_cell(this.gx1, this.gy1, this.editor.palette_selection);
    }
    step(mx, my, gx, gy) {
        for (let [x, y] of walk_grid(this.gx1f, this.gy1f, gx, gy)) {
            this.editor.place_in_cell(x, y, this.editor.palette_selection);
        }
    }
}

class ForceFloorOperation extends DrawOperation {
    start() {
        // Begin by placing an all-way force floor under the mouse
        this.editor.place_in_cell(x, y, 'force_floor_all');
    }
    step(mx, my, gx, gy) {
        // Walk the mouse movement and change each we touch to match the direction we
        // crossed the border
        // FIXME occasionally i draw a tetris S kinda shape and both middle parts point
        // the same direction, but shouldn't
        let i = 0;
        let prevx, prevy;
        for (let [x, y] of walk_grid(this.gx1f, this.gy1f, gx, gy)) {
            i++;
            // The very first cell is the one the mouse was already in, and we don't
            // have a movement direction yet, so leave that alone
            if (i === 1) {
                prevx = x;
                prevy = y;
                continue;
            }
            let name;
            if (x === prevx) {
                if (y > prevy) {
                    name = 'force_floor_s';
                }
                else {
                    name = 'force_floor_n';
                }
            }
            else {
                if (x > prevx) {
                    name = 'force_floor_e';
                }
                else {
                    name = 'force_floor_w';
                }
            }

            // The second cell tells us the direction to use for the first, assuming it
            // had some kind of force floor
            if (i === 2) {
                let prevcell = this.editor.stored_level.cells[prevy][prevx];
                if (prevcell[0].type.name.startsWith('force_floor_')) {
                    prevcell[0].type = TILE_TYPES[name];
                }
            }

            // Drawing a loop with force floors creates ice (but not in the previous
            // cell, obviously)
            let cell = this.editor.stored_level.cells[y][x];
            if (cell[0].type.name.startsWith('force_floor_') &&
                cell[0].type.name !== name)
            {
                name = 'ice';
            }
            this.editor.place_in_cell(x, y, name);

            prevx = x;
            prevy = y;
        }
    }
}

// Tiles the "adjust" tool will turn into each other
const ADJUST_TOGGLES = {
    floor_custom_green: 'wall_custom_green',
    floor_custom_pink: 'wall_custom_pink',
    floor_custom_yellow: 'wall_custom_yellow',
    floor_custom_blue: 'wall_custom_blue',
    wall_custom_green: 'floor_custom_green',
    wall_custom_pink: 'floor_custom_pink',
    wall_custom_yellow: 'floor_custom_yellow',
    wall_custom_blue: 'floor_custom_blue',
    fake_floor: 'fake_wall',
    fake_wall: 'fake_floor',
    wall_invisible: 'wall_appearing',
    wall_appearing: 'wall_invisible',
    green_floor: 'green_wall',
    green_wall: 'green_floor',
    green_bomb: 'green_chip',
    green_chip: 'green_bomb',
    purple_floor: 'purple_wall',
    purple_wall: 'purple_floor',
    thief_keys: 'thief_tools',
    thief_tools: 'thief_keys',
};
class AdjustOperation extends MouseOperation {
    start() {
        let cell = this.editor.stored_level.cells[this.gy1][this.gx1];
        for (let tile of cell) {
            // Toggle tiles that go in obvious pairs
            let other = ADJUST_TOGGLES[tile.type.name];
            if (other) {
                tile.type = TILE_TYPES[other];
            }

            // Rotate actors
            if (TILE_TYPES[tile.type.name].is_actor) {
                tile.direction = DIRECTIONS[tile.direction ?? 'south'].right;
            }
        }
    }
    // Adjust tool doesn't support dragging
    // TODO should it?
}

class CameraOperation extends MouseOperation {
    start() {
        this.region = this.editor.stored_level.camera_regions[0];

        // TODO allow resizing it too
        let rect = this.target.getBoundingClientRect();
        if (this.mx0 < rect.left + 16 || this.mx0 > rect.right - 16) {
            this.mode = 'resize';
        }
        else if (this.my0 < rect.top + 16 || this.my0 > rect.bottom - 16) {
            this.mode = 'resize';
        }
        else {
            this.mode = 'move';
        }

        this.offset_x = 0;
        this.offset_y = 0;
    }
    step(mx, my) {
        let dx = (mx - this.mx0) / this.editor.conductor.tileset.size_x;
        let dy = (my - this.my0) / this.editor.conductor.tileset.size_y;
        this.offset_x = Math.floor(dx + 0.5);
        this.offset_y = Math.floor(dy + 0.5);

        // Keep it within the map!
        let stored_level = this.editor.stored_level;
        this.offset_x = Math.max(- this.region.x, Math.min(stored_level.size_x - this.region.width, this.offset_x));
        this.offset_y = Math.max(- this.region.y, Math.min(stored_level.size_y - this.region.height, this.offset_y));

        this.target.setAttribute('x', this.region.x + this.offset_x);
        this.target.setAttribute('y', this.region.y + this.offset_y);
    }
    commit() {
        // Actually edit the underlying region
        this.region.x += this.offset_x;
        this.region.y += this.offset_y;
    }
    abort() {
        // Move the element back to its original location
        this.target.setAttribute('x', this.region.x);
        this.target.setAttribute('y', this.region.y);
    }
}
CameraOperation.TARGET_SELECTOR = '.overlay-camera';

const EDITOR_TOOLS = {
    pencil: {
        icon: 'icons/tool-pencil.png',
        name: "Pencil",
        desc: "Draw individual tiles",
        op1: PencilOperation,
        //op2: EraseOperation,
    },
    line: {
        // TODO not implemented
        icon: 'icons/tool-line.png',
        name: "Line",
        desc: "Draw straight lines",
    },
    box: {
        // TODO not implemented
        icon: 'icons/tool-box.png',
        name: "Box",
        desc: "Fill a rectangular area with tiles",
    },
    fill: {
        // TODO not implemented
        icon: 'icons/tool-fill.png',
        name: "Fill",
        desc: "Flood-fill an area with tiles",
    },
    'force-floors': {
        icon: 'icons/tool-force-floors.png',
        name: "Force floors",
        desc: "Draw force floors in the direction you draw",
        op1: ForceFloorOperation,
    },
    adjust: {
        icon: 'icons/tool-adjust.png',
        name: "Adjust",
        desc: "Toggle blocks and rotate actors",
        op1: AdjustOperation,
    },
    connect: {
        // TODO not implemented
        icon: 'icons/tool-connect.png',
        name: "Connect",
        desc: "Set up CC1 clone and trap connections",
    },
    wire: {
        // TODO not implemented
        icon: 'icons/tool-wire.png',
        name: "Wire",
        desc: "Draw CC2 wiring",
    },
    camera: {
        icon: 'icons/tool-camera.png',
        name: "Camera",
        desc: "Draw and edit custom camera bounds",
        help: "Draw and edit camera bounds.  When the player is within a camera region, the camera will avoid showing anything outside that region.  LL only.",
        op1: CameraOperation,
    },
    // TODO text tool; thin walls tool; ice tool; map generator?; subtools for select tool (copy, paste, crop)
    // TODO interesting option: rotate an actor as you draw it by dragging?  or hold a key like in
    // slade when you have some selected?
    // TODO ah, railroads...
};
const EDITOR_TOOL_ORDER = ['pencil', 'force-floors', 'adjust', 'camera'];

// TODO this MUST use a LL tileset!
const EDITOR_PALETTE = [{
    title: "Basics",
    tiles: [
        'player',
        'chip', 'chip_extra',
        'floor', 'wall', 'hint', 'socket', 'exit',
    ],
}, {
    title: "Terrain",
    tiles: [
        'popwall',
        'fake_floor', 'fake_wall',
        'wall_invisible', 'wall_appearing',
        'gravel',
        'dirt',
        'door_blue', 'door_red', 'door_yellow', 'door_green',
        'water', 'turtle', 'fire',
        'ice', 'ice_nw', 'ice_ne', 'ice_sw', 'ice_se',
        'force_floor_n', 'force_floor_s', 'force_floor_w', 'force_floor_e', 'force_floor_all',
    ],
}, {
    title: "Items",
    tiles: [
        'key_blue', 'key_red', 'key_yellow', 'key_green',
        'flippers', 'fire_boots', 'cleats', 'suction_boots',
    ],
}, {
    title: "Creatures",
    tiles: [
        'tank_blue',
        'ball',
        'fireball',
        'glider',
        'bug',
        'paramecium',
        'walker',
        'teeth',
        'blob',
    ],
}, {
    title: "Mechanisms",
    tiles: [
        'bomb',
        'dirt_block',
        'ice_block',
        'button_blue',
        'button_red', 'cloner',
        'button_brown', 'trap',
        'teleport_blue',
        'teleport_red',
        'teleport_green',
        'teleport_yellow',
    ],
}];

export class Editor extends PrimaryView {
    constructor(conductor) {
        super(conductor, document.body.querySelector('main#editor'));

        this.viewport_el = this.root.querySelector('.level');

        // FIXME don't hardcode size here, convey this to renderer some other way
        this.renderer = new CanvasRenderer(this.conductor.tileset, 32);

        // FIXME need this in load_level which is called even if we haven't been setup yet
        this.connections_g = mk_svg('g');
    }

    setup() {
        // Level canvas and mouse handling
        // This SVG draws vectors on top of the editor, like monster paths and button connections
        // FIXME change viewBox in load_level, can't right now because order of ops
        this.svg_overlay = mk_svg('svg.level-editor-overlay', {viewBox: '0 0 32 32'}, this.connections_g);
        this.viewport_el.append(this.renderer.canvas, this.svg_overlay);
        this.mouse_op = null;
        this.viewport_el.addEventListener('mousedown', ev => {
            this.cancel_mouse_operation();

            if (ev.button === 0) {
                // Left button: activate tool
                let op_type = EDITOR_TOOLS[this.current_tool].op1;
                if (! op_type)
                    return;

                let target;
                if (op_type.TARGET_SELECTOR) {
                    target = ev.target.closest(op_type.TARGET_SELECTOR);
                    if (! target)
                        return;
                }
                this.mouse_op = new op_type(this, ev, target);
                ev.preventDefault();
                ev.stopPropagation();

                this.renderer.draw();
            }
            else if (ev.button === 1) {
                // Middle button: always pan
                this.mouse_op = new PanOperation(this, ev);

                ev.preventDefault();
                ev.stopPropagation();
            }
        });
        this.viewport_el.addEventListener('mousemove', ev => {
            if (! this.mouse_op)
                return;
            if ((ev.buttons & this.mouse_op.button_mask) === 0) {
                this.cancel_mouse_operation();
                return;
            }

            this.mouse_op.do_mousemove(ev);

            this.renderer.draw();
        });
        // TODO should this happen for a mouseup anywhere?
        this.viewport_el.addEventListener('mouseup', ev => {
            if (this.mouse_op) {
                this.mouse_op.do_commit();
                this.mouse_op = null;
            }
        });
        window.addEventListener('blur', ev => {
            this.cancel_mouse_operation();
        });

        // Toolbar buttons
        this.root.querySelector('#editor-share-url').addEventListener('click', ev => {
            let buf = c2m.synthesize_level(this.stored_level);
            // FIXME Not ideal, but btoa() wants a string rather than any of the myriad binary types
            let stringy_buf = Array.from(new Uint8Array(buf)).map(n => String.fromCharCode(n)).join('');
            // Make URL-safe and strip trailing padding
            let data = btoa(stringy_buf).replace(/[+]/g, '-').replace(/[/]/g, '_').replace(/=+$/, '');
            let url = new URL(location);
            url.searchParams.delete('level');
            url.searchParams.delete('setpath');
            url.searchParams.append('level', data);
            new EditorShareOverlay(this.conductor, url.toString()).open();
        });

        // Toolbox
        let toolbox = mk('div.icon-button-set')
        this.root.querySelector('.controls').append(toolbox);
        this.tool_button_els = {};
        for (let toolname of EDITOR_TOOL_ORDER) {
            let tooldef = EDITOR_TOOLS[toolname];
            let button = mk(
                'button', {
                    type: 'button',
                    'data-tool': toolname,
                },
                mk('img', {
                    src: tooldef.icon,
                    alt: tooldef.name,
                    title: `${tooldef.name}: ${tooldef.desc}`,
                }),
            );
            this.tool_button_els[toolname] = button;
            toolbox.append(button);
        }
        this.current_tool = 'pencil';
        this.tool_button_els['pencil'].classList.add('-selected');
        toolbox.addEventListener('click', ev => {
            let button = ev.target.closest('.icon-button-set button');
            if (! button)
                return;

            this.select_tool(button.getAttribute('data-tool'));
        });

        // Tile palette
        let palette_el = this.root.querySelector('.palette');
        this.palette = {};  // name => element
        for (let sectiondef of EDITOR_PALETTE) {
            let section_el = mk('section');
            palette_el.append(mk('h2', sectiondef.title), section_el);
            for (let name of sectiondef.tiles) {
                let entry = this.renderer.create_tile_type_canvas(name);
                entry.setAttribute('data-tile-name', name);
                entry.classList = 'palette-entry';
                this.palette[name] = entry;
                section_el.append(entry);
            }
        }
        palette_el.addEventListener('click', ev => {
            let entry = ev.target.closest('canvas.palette-entry');
            if (! entry)
                return;

            this.select_palette(entry.getAttribute('data-tile-name'));
        });
        this.palette_selection = null;
        this.select_palette('floor');
    }

    activate() {
        super.activate();
        this.renderer.draw();
    }

    load_game(stored_game) {
    }

    load_level(stored_level) {
        // TODO support a game too i guess
        this.stored_level = stored_level;

        // XXX need this for renderer compat.  but i guess it's nice in general idk
        this.stored_level.cells = [];
        let row;
        for (let [i, cell] of this.stored_level.linear_cells.entries()) {
            if (i % this.stored_level.size_x === 0) {
                row = [];
                this.stored_level.cells.push(row);
            }
            row.push(cell);
        }

        // Load connections
        this.connections_g.textContent = '';
        for (let [src, dest] of Object.entries(this.stored_level.custom_trap_wiring)) {
            let [sx, sy] = this.stored_level.scalar_to_coords(src);
            let [dx, dy] = this.stored_level.scalar_to_coords(dest);
            this.connections_g.append(
                mk_svg('rect.overlay-cxn', {x: sx, y: sy, width: 1, height: 1}),
                mk_svg('line.overlay-cxn', {x1: sx + 0.5, y1: sy + 0.5, x2: dx + 0.5, y2: dy + 0.5}),
            );
        }
        this.stored_level.camera_regions.push(new DOMRect(0, 0, 10, 10));
        for (let [i, region] of this.stored_level.camera_regions.entries()) {
            let el = mk_svg('rect.overlay-camera', {x: region.x, y: region.y, width: region.width, height: region.height});
            this.connections_g.append(el);
        }

        this.renderer.set_level(stored_level);
        if (this.active) {
            this.renderer.draw();
        }
    }

    select_tool(tool) {
        if (tool === this.current_tool)
            return;
        if (! this.tool_button_els[tool])
            return;

        this.tool_button_els[this.current_tool].classList.remove('-selected');
        this.current_tool = tool;
        this.tool_button_els[this.current_tool].classList.add('-selected');
    }

    select_palette(name) {
        if (name === this.palette_selection)
            return;

        if (this.palette_selection) {
            this.palette[this.palette_selection].classList.remove('--selected');
        }
        this.palette_selection = name;
        if (this.palette_selection) {
            this.palette[this.palette_selection].classList.add('--selected');
        }

        // Some tools obviously don't work with a palette selection, in which case changing tiles
        // should default you back to the pencil
        if (this.current_tool === 'adjust') {
            this.select_tool('pencil');
        }
    }

    place_in_cell(x, y, name) {
        // TODO weird api?
        if (! name)
            return;

        let type = TILE_TYPES[name];
        let cell = this.stored_level.cells[y][x];
        // For terrain tiles, erase the whole cell.  For other tiles, only
        // replace whatever's on the same layer
        // TODO probably not the best heuristic yet, since i imagine you can
        // combine e.g. the tent with thin walls
        if (type.draw_layer === 0) {
            cell.length = 0;
            cell.push({type});
        }
        else {
            for (let i = cell.length - 1; i >= 0; i--) {
                if (cell[i].type.draw_layer === type.draw_layer) {
                    cell.splice(i, 1);
                }
            }
            cell.push({type});
            cell.sort((a, b) => a.type.draw_layer - b.type.draw_layer);
        }
    }

    cancel_mouse_operation() {
        if (this.mouse_op) {
            this.mouse_op.do_abort();
            this.mouse_op = null;
        }
    }
}


