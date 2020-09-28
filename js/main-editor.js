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

const EDITOR_TOOLS = [{
    mode: 'pencil',
    icon: 'icons/tool-pencil.png',
    name: "Pencil",
    desc: "Draw individual tiles",
/* TODO not implemented
}, {
    mode: 'line',
    icon: 'icons/tool-line.png',
    name: "Line",
    desc: "Draw straight lines",
}, {
    mode: 'box',
    icon: 'icons/tool-box.png',
    name: "Box",
    desc: "Fill a rectangular area with tiles",
}, {
    mode: 'fill',
    icon: 'icons/tool-fill.png',
    name: "Fill",
    desc: "Flood-fill an area with tiles",
*/
}, {
    mode: 'force-floors',
    icon: 'icons/tool-force-floors.png',
    name: "Force floors",
    desc: "Draw force floors in the direction you draw",
}, {
    mode: 'adjust',
    icon: 'icons/tool-adjust.png',
    name: "Adjust",
    desc: "Toggle blocks and rotate actors",
/* TODO not implemented
}, {
    mode: 'connect',
    icon: 'icons/tool-connect.png',
    name: "Connect",
    desc: "Set up CC1 clone and trap connections",
}, {
    mode: 'wire',
    icon: 'icons/tool-wire.png',
    name: "Wire",
    desc: "Draw CC2 wiring",
    // TODO text tool; thin walls tool; ice tool; map generator?; subtools for select tool (copy, paste, crop)
    // TODO interesting option: rotate an actor as you draw it by dragging?  or hold a key like in
    // slade when you have some selected?
    // TODO ah, railroads...
*/
}];
// Tiles the "adjust" tool will turn into each other
const EDITOR_ADJUST_TOGGLES = {
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
// TODO this MUST use a cc2 tileset!
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
        this.root.querySelector('.level').append(
            this.renderer.canvas,
            this.svg_overlay);
        this.mouse_mode = null;
        this.mouse_button = null;
        this.mouse_cell = null;
        this.renderer.canvas.addEventListener('mousedown', ev => {
            if (ev.button === 0) {
                // Left button: draw
                this.mouse_mode = 'draw';
                this.mouse_button_mask = 1;
                this.mouse_coords = [ev.clientX, ev.clientY];

                let [x, y] = this.renderer.cell_coords_from_event(ev);
                this.mouse_cell = [x, y];

                if (this.current_tool === 'pencil') {
                    this.place_in_cell(x, y, this.palette_selection);
                }
                else if (this.current_tool === 'force-floors') {
                    // Begin by placing an all-way force floor under the mouse
                    this.place_in_cell(x, y, 'force_floor_all');
                }
                else if (this.current_tool === 'adjust') {
                    let cell = this.stored_level.cells[y][x];
                    for (let tile of cell) {
                        // Toggle tiles that go in obvious pairs
                        let other = EDITOR_ADJUST_TOGGLES[tile.type.name];
                        if (other) {
                            tile.type = TILE_TYPES[other];
                        }

                        // Rotate actors
                        if (TILE_TYPES[tile.type.name].is_actor) {
                            tile.direction = DIRECTIONS[tile.direction ?? 'south'].right;
                        }
                    }
                }
                this.renderer.draw();
            }
            else if (ev.button === 1) {
                // Middle button: pan
                this.mouse_mode = 'pan';
                this.mouse_button_mask = 4;
                this.mouse_coords = [ev.clientX, ev.clientY];
                ev.preventDefault();
            }
        });
        this.renderer.canvas.addEventListener('mousemove', ev => {
            if (this.mouse_mode === null)
                return;
            // TODO check for the specific button we're holding
            if ((ev.buttons & this.mouse_button_mask) === 0) {
                this.mouse_mode = null;
                return;
            }

            if (this.mouse_mode === 'draw') {
                // FIXME also fill in a trail between previous cell and here, mousemove is not fired continuously
                let [x, y] = this.renderer.cell_coords_from_event(ev);
                if (x === this.mouse_cell[0] && y === this.mouse_cell[1])
                    return;

                // TODO do a pixel-perfect draw too
                if (this.current_tool === 'pencil') {
                    for (let [cx, cy] of walk_grid(this.mouse_cell[0], this.mouse_cell[1], x, y)) {
                        this.place_in_cell(cx, cy, this.palette_selection);
                    }
                }
                else if (this.current_tool === 'force-floors') {
                    // Walk the mouse movement and change each we touch to match the direction we
                    // crossed the border
                    // FIXME occasionally i draw a tetris S kinda shape and both middle parts point
                    // the same direction, but shouldn't
                    let i = 0;
                    let prevx, prevy;
                    for (let [cx, cy] of walk_grid(this.mouse_cell[0], this.mouse_cell[1], x, y)) {
                        i++;
                        // The very first cell is the one the mouse was already in, and we don't
                        // have a movement direction yet, so leave that alone
                        if (i === 1) {
                            prevx = cx;
                            prevy = cy;
                            continue;
                        }
                        let name;
                        if (cx === prevx) {
                            if (cy > prevy) {
                                name = 'force_floor_s';
                            }
                            else {
                                name = 'force_floor_n';
                            }
                        }
                        else {
                            if (cx > prevx) {
                                name = 'force_floor_e';
                            }
                            else {
                                name = 'force_floor_w';
                            }
                        }

                        // The second cell tells us the direction to use for the first, assuming it
                        // had some kind of force floor
                        if (i === 2) {
                            let prevcell = this.stored_level.cells[prevy][prevx];
                            if (prevcell[0].type.name.startsWith('force_floor_')) {
                                prevcell[0].type = TILE_TYPES[name];
                            }
                        }

                        // Drawing a loop with force floors creates ice (but not in the previous
                        // cell, obviously)
                        let cell = this.stored_level.cells[cy][cx];
                        if (cell[0].type.name.startsWith('force_floor_') &&
                            cell[0].type.name !== name)
                        {
                            name = 'ice';
                        }
                        this.place_in_cell(cx, cy, name);

                        prevx = cx;
                        prevy = cy;
                    }
                }
                else if (this.current_tool === 'adjust') {
                    // Adjust tool doesn't support dragging
                    // TODO should it
                }
                this.renderer.draw();

                this.mouse_cell = [x, y];
            }
            else if (this.mouse_mode === 'pan') {
                let dx = ev.clientX - this.mouse_coords[0];
                let dy = ev.clientY - this.mouse_coords[1];
                this.renderer.canvas.parentNode.scrollLeft -= dx;
                this.renderer.canvas.parentNode.scrollTop -= dy;
                this.mouse_coords = [ev.clientX, ev.clientY];
            }
        });
        this.renderer.canvas.addEventListener('mouseup', ev => {
            this.mouse_mode = null;
        });
        window.addEventListener('blur', ev => {
            // Unbind the mouse if the page loses focus
            this.mouse_mode = null;
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
        for (let tooldef of EDITOR_TOOLS) {
            let button = mk(
                'button', {
                    type: 'button',
                    'data-tool': tooldef.mode,
                },
                mk('img', {
                    src: tooldef.icon,
                    alt: tooldef.name,
                    title: `${tooldef.name}: ${tooldef.desc}`,
                }),
            );
            this.tool_button_els[tooldef.mode] = button;
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
}


