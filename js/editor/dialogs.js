import * as c2g from '../format-c2g.js';
import { DialogOverlay, AlertOverlay, flash_button } from '../main-base.js';
import CanvasRenderer from '../renderer-canvas.js';
import { mk, mk_button } from '../util.js';
import * as util from '../util.js';

export class EditorPackMetaOverlay extends DialogOverlay {
    constructor(conductor, stored_pack) {
        super(conductor);
        this.set_title("pack properties");
        let dl = mk('dl.formgrid');
        this.main.append(dl);

        dl.append(
            mk('dt', "Title"),
            mk('dd', mk('input', {name: 'title', type: 'text', value: stored_pack.title})),
        );
        // TODO...?  what else is a property of the pack itself

        this.add_button("save", () => {
            let els = this.root.elements;

            let title = els.title.value;
            if (title !== stored_pack.title) {
                stored_pack.title = title;
                this.conductor.update_level_title();
            }

            this.close();
        });
        this.add_button("nevermind", () => {
            this.close();
        });
    }
}

export class EditorLevelMetaOverlay extends DialogOverlay {
    constructor(conductor, stored_level) {
        super(conductor);
        this.set_title("level properties");
        let dl = mk('dl.formgrid');
        this.main.append(dl);

        let time_limit_input = mk('input', {name: 'time_limit', type: 'number', min: 0, max: 65535, value: stored_level.time_limit});
        let time_limit_output = mk('output');
        let update_time_limit = () => {
            let time_limit = parseInt(time_limit_input.value, 10);
            // FIXME need a change event for this tbh?
            // FIXME handle NaN; maybe block keydown of not-numbers
            time_limit = Math.max(0, Math.min(65535, time_limit));
            time_limit_input.value = time_limit;

            let text;
            if (time_limit === 0) {
                text = "No time limit";
            }
            else {
                text = util.format_duration(time_limit);
            }
            time_limit_output.textContent = text;
        };
        update_time_limit();
        time_limit_input.addEventListener('input', update_time_limit);

        let make_size_input = (name) => {
            let input = mk('input', {name: name, type: 'number', min: 10, max: 100, value: stored_level[name]});
            // TODO maybe block keydown of non-numbers too?
            // Note that this is a change event, not an input event, so we don't prevent them from
            // erasing the whole value to type a new one
            input.addEventListener('change', ev => {
                let value = parseInt(ev.target.value, 10);
                if (isNaN(value)) {
                    ev.target.value = stored_level[name];
                }
                else if (value < 1) {
                    // Smaller than 10×10 isn't supported by CC2, but LL doesn't mind, so let it
                    // through if they try it manually
                    ev.target.value = 1;
                }
                else if (value > 100) {
                    ev.target.value = 100;
                }
            });
            return input;
        };

        dl.append(
            mk('dt', "Title"),
            mk('dd.-one-field', mk('input', {name: 'title', type: 'text', value: stored_level.title})),
            mk('dt', "Author"),
            mk('dd.-one-field', mk('input', {name: 'author', type: 'text', value: stored_level.author})),
            mk('dt', "Comment"),
            mk('dd.-textarea', mk('textarea', {name: 'comment', rows: 4, cols: 20}, stored_level.comment)),
            mk('dt', "Time limit"),
            mk('dd.-with-buttons',
                mk('div.-left',
                    time_limit_input,
                    " ",
                    time_limit_output,
                ),
                mk('div.-right',
                    mk_button("None", () => {
                        this.root.elements['time_limit'].value = 0;
                        update_time_limit();
                    }),
                    mk_button("−30s", () => {
                        this.root.elements['time_limit'].value = Math.max(0,
                            parseInt(this.root.elements['time_limit'].value, 10) - 30);
                        update_time_limit();
                    }),
                    mk_button("+30s", () => {
                        this.root.elements['time_limit'].value = Math.min(999,
                            parseInt(this.root.elements['time_limit'].value, 10) + 30);
                        update_time_limit();
                    }),
                    mk_button("Max", () => {
                        this.root.elements['time_limit'].value = 999;
                        update_time_limit();
                    }),
                ),
            ),
            mk('dt', "Size"),
            mk('dd.-with-buttons',
                mk('div.-left', make_size_input('size_x'), " × ", make_size_input('size_y')),
                mk('div.-right', ...[10, 32, 50, 100].map(size =>
                    mk_button(`${size}²`, () => {
                        this.root.elements['size_x'].value = size;
                        this.root.elements['size_y'].value = size;
                    }),
                )),
            ),
            mk('dt', "Viewport"),
            mk('dd',
                mk('label',
                    mk('input', {name: 'viewport', type: 'radio', value: '10'}),
                    " 10×10 (Chip's Challenge 2 size)"),
                mk('br'),
                mk('label',
                    mk('input', {name: 'viewport', type: 'radio', value: '9'}),
                    " 9×9 (Chip's Challenge 1 size)"),
                mk('br'),
                mk('label',
                    mk('input', {name: 'viewport', type: 'radio', value: '', disabled: 'disabled'}),
                    " Split 10×10 (not yet supported)"),
            ),
            mk('dt', "Blob behavior"),
            mk('dd',
                mk('label',
                    mk('input', {name: 'blob_behavior', type: 'radio', value: '0'}),
                    " Deterministic (PRNG + simple convolution)"),
                mk('br'),
                mk('label',
                    mk('input', {name: 'blob_behavior', type: 'radio', value: '1'}),
                    " 4 patterns (CC2 default; PRNG + rotating offset)"),
                mk('br'),
                mk('label',
                    mk('input', {name: 'blob_behavior', type: 'radio', value: '2'}),
                    " Extra random (LL default; initial seed is truly random)"),
            ),
            mk('dt', "Options"),
            mk('dd', mk('label',
                mk('input', {name: 'hide_logic', type: 'checkbox'}),
                " Hide wires and logic gates (warning: CC2 also hides pink/black buttons!)")),
            mk('dd', mk('label',
                mk('input', {name: 'use_cc1_boots', type: 'checkbox'}),
                " Use CC1-style inventory (can only pick up the four classic boots; can't drop or cycle)")),
        );
        this.root.elements['viewport'].value = stored_level.viewport_size;
        this.root.elements['blob_behavior'].value = stored_level.blob_behavior;
        this.root.elements['hide_logic'].checked = stored_level.hide_logic;
        this.root.elements['use_cc1_boots'].checked = stored_level.use_cc1_boots;
        // TODO:
        // - chips?
        // - password???
        // - comment
        // - use CC1 tools
        // - hide logic
        // - "unviewable", "read only"

        this.add_button("save", () => {
            let els = this.root.elements;

            let title = els.title.value;
            if (title !== stored_level.title) {
                stored_level.title = title;
                this.conductor.stored_game.level_metadata[this.conductor.level_index].title = title;
                this.conductor.update_level_title();
            }
            let author = els.author.value;
            if (author !== stored_level.author) {
                stored_level.author = author;
            }

            // FIXME gotta deal with NaNs here too, sigh, might just need a teeny tiny form library
            stored_level.time_limit = Math.max(0, Math.min(65535, parseInt(els.time_limit.value, 10)));

            let size_x = Math.max(1, Math.min(100, parseInt(els.size_x.value, 10)));
            let size_y = Math.max(1, Math.min(100, parseInt(els.size_y.value, 10)));
            if (size_x !== stored_level.size_x || size_y !== stored_level.size_y) {
                this.conductor.editor.crop_level(0, 0, size_x, size_y);
            }

            stored_level.blob_behavior = parseInt(els.blob_behavior.value, 10);
            stored_level.hide_logic = els.hide_logic.checked;
            stored_level.use_cc1_boots = els.use_cc1_boots.checked;
            let viewport_size = parseInt(els.viewport.value, 10);
            if (viewport_size !== 9 && viewport_size !== 10) {
                viewport_size = 10;
            }
            stored_level.viewport_size = viewport_size;
            this.conductor.player.update_viewport_size();

            this.close();
        });
        this.add_button("nevermind", () => {
            this.close();
        });
    }
}

// List of levels, used in the player
export class EditorLevelBrowserOverlay extends DialogOverlay {
    constructor(conductor) {
        super(conductor);
        this.set_title("choose a level");

        // Set up some infrastructure to lazily display level renders
        // FIXME should this use the tileset appropriate for the particular level?
        this.renderer = new CanvasRenderer(this.conductor.tilesets['ll'], 32);
        this.awaiting_renders = [];
        this.observer = new IntersectionObserver((entries, _observer) => {
                let any_new = false;
                let to_remove = new Set;
                for (let entry of entries) {
                    if (entry.target.classList.contains('--rendered'))
                        continue;

                    let index = this._get_index(entry.target);
                    if (entry.isIntersecting) {
                        this.awaiting_renders.push(index);
                        any_new = true;
                    }
                    else {
                        to_remove.add(index);
                    }
                }

                this.awaiting_renders = this.awaiting_renders.filter(index => ! to_remove.has(index));
                if (any_new) {
                    this.schedule_level_render();
                }
            },
            { root: this.main },
        );
        this.list = mk('ol.editor-level-browser');
        this.selection = this.conductor.level_index;
        for (let [i, meta] of conductor.stored_game.level_metadata.entries()) {
            this.list.append(this._make_list_item(i, meta));
        }
        this.list.childNodes[this.selection].classList.add('--selected');
        this.main.append(
            mk('p', "Drag to rearrange.  Changes are immediate!"),
            this.list,
        );

        this.list.addEventListener('click', ev => {
            let index = this._get_index(ev.target);
            if (index === null)
                return;
            this._select(index);
        });
        this.list.addEventListener('dblclick', ev => {
            let index = this._get_index(ev.target);
            if (index !== null && this.conductor.change_level(index)) {
                this.close();
            }
        });

        this.sortable = new Sortable(this.list, {
            group: 'editor-levels',
            onEnd: ev => {
                if (ev.oldIndex === ev.newIndex)
                    return;

                this._move_level(ev.oldIndex, ev.newIndex);

                this.undo_stack.push(() => {
                    this.list.insertBefore(
                        this.list.childNodes[ev.newIndex],
                        this.list.childNodes[ev.oldIndex + (ev.oldIndex < ev.newIndex ? 0 : 1)]);
                    this._move_level(ev.newIndex, ev.oldIndex);
                });
                this.undo_button.disabled = false;
            },
        });

        // FIXME ring buffer?
        this.undo_stack = [];

        // Left buttons
        this.undo_button = this.add_button("undo", () => {
            if (! this.undo_stack.length)
                return;

            let undo = this.undo_stack.pop();
            undo();
            this.undo_button.disabled = ! this.undo_stack.length;
        });
        this.undo_button.disabled = true;
        this.add_button("create", () => {
            let index = this.selection + 1;
            let stored_level = this.conductor.editor._make_empty_level(index + 1, 32, 32);
            this.conductor.editor.move_level(stored_level, index);
            this._after_insert_level(stored_level, index);

            this.undo_stack.push(() => {
                this._delete_level(index);
            });
            this.undo_button.disabled = false;
        });
        this.add_button("duplicate", () => {
            let index = this.selection + 1;
            let stored_level = this.conductor.editor.duplicate_level(this.selection);
            this._after_insert_level(stored_level, index);

            this.undo_stack.push(() => {
                this._delete_level(index);
            });
            this.undo_button.disabled = false;
        });
        this.delete_button = this.add_button("delete", () => {
            let index = this.selection;
            if (index === this.conductor.level_index) {
                new AlertOverlay(this.conductor, "You can't delete the level you have open.").open();
                return;
            }

            // Snag a copy of the serialized level for undo purposes
            // FIXME can't undo deleting a corrupt level
            let meta = this.conductor.stored_game.level_metadata[index];
            let serialized_level = window.localStorage.getItem(meta.key);

            this._delete_level(index);

            this.undo_stack.push(() => {
                let stored_level = meta.stored_level ?? c2g.parse_level(
                    util.bytestring_to_buffer(serialized_level), index + 1);
                this.conductor.editor.move_level(stored_level, index);
                if (this.selection >= index) {
                    this.selection += 1;
                }
                this._after_insert_level(stored_level, index);
            });
            this.undo_button.disabled = false;
        });
        this._update_delete_button();

        // Right buttons
        this.add_button_gap();
        this.add_button("open", () => {
            if (this.selection === this.conductor.level_index || this.conductor.change_level(this.selection)) {
                this.close();
            }
        });
        this.add_button("nevermind", () => {
            this.close();
        });
    }

    _make_list_item(index, meta) {
        let li = mk('li',
            {'data-index': index},
            mk('div.-preview'),
            mk('div.-number', {}, meta.number),
            mk('div.-title', {}, meta.error ? "(error!)" : meta.title),
        );

        if (meta.error) {
            li.classList.add('--error');
        }
        else {
            this.observer.observe(li);
        }

        return li;
    }

    renumber_levels(start_index, end_index = null) {
        end_index = end_index ?? this.conductor.stored_game.level_metadata.length - 1;
        for (let i = start_index; i <= end_index; i++) {
            let li = this.list.childNodes[i];
            let meta = this.conductor.stored_game.level_metadata[i];
            li.setAttribute('data-index', i);
            li.querySelector('.-number').textContent = meta.number;
        }
    }

    _get_index(element) {
        let li = element.closest('li');
        if (! li)
            return null;

        return parseInt(li.getAttribute('data-index'), 10);
    }

    _select(index) {
        this.list.childNodes[this.selection].classList.remove('--selected');
        this.selection = index;
        this.list.childNodes[this.selection].classList.add('--selected');
        this._update_delete_button();
    }

    _update_delete_button() {
        this.delete_button.disabled = !! (this.selection === this.conductor.level_index);
    }

    schedule_level_render() {
        if (this._handle)
            return;
        this._handle = setTimeout(() => { this.render_level() }, 50);
    }

    render_level() {
        this._handle = null;

        let t0 = performance.now();
        while (true) {
            if (this.awaiting_renders.length === 0)
                return;

            let index = this.awaiting_renders.shift();
            let element = this.list.childNodes[index];
            // FIXME levels may have been renumbered since this was queued, whoops
            let stored_level = this.conductor.stored_game.load_level(index);
            this.renderer.set_level(stored_level);
            this.renderer.set_viewport_size(stored_level.size_x, stored_level.size_y);
            this.renderer.draw_static_region(0, 0, stored_level.size_x, stored_level.size_y);
            let canvas = mk('canvas', {
                width: stored_level.size_x * this.renderer.tileset.size_x / 4,
                height: stored_level.size_y * this.renderer.tileset.size_y / 4,
            });
            canvas.getContext('2d').drawImage(this.renderer.canvas, 0, 0, canvas.width, canvas.height);
            element.querySelector('.-preview').append(canvas);
            element.classList.add('--rendered');

            if (performance.now() - t0 > 10)
                break;
        }

        this.schedule_level_render();
    }

    expire(index) {
        let li = this.list.childNodes[index];
        li.classList.remove('--rendered');
        li.querySelector('.-preview').textContent = '';
    }

    _after_insert_level(stored_level, index) {
        this.list.insertBefore(
            this._make_list_item(index, this.conductor.stored_game.level_metadata[index]),
            this.list.childNodes[index]);
        this._select(index);
        this.renumber_levels(index + 1);
    }

    _delete_level(index) {
        let num_levels = this.conductor.stored_game.level_metadata.length;
        this.conductor.editor.move_level(index, null);

        this.list.childNodes[this.selection].classList.remove('--selected');
        this.list.childNodes[index].remove();
        if (index === num_levels - 1) {
            this.selection -= 1;
        }
        else {
            this.renumber_levels(index);
        }
        this.list.childNodes[this.selection].classList.add('--selected');
    }

    _move_level(from_index, to_index) {
        this.conductor.editor.move_level(from_index, to_index);

        let selection = this.selection;
        if (from_index < to_index) {
            this.renumber_levels(from_index, to_index);
            if (from_index < selection && selection <= to_index) {
                selection -= 1;
            }
        }
        else {
            this.renumber_levels(to_index, from_index);
            if (to_index <= selection && selection < from_index) {
                selection += 1;
            }
        }

        if (this.selection === from_index) {
            this.selection = to_index;
        }
        else {
            this.selection = selection;
        }
        this._update_delete_button();
    }
}

export class EditorShareOverlay extends DialogOverlay {
    constructor(conductor, url) {
        super(conductor);
        this.set_title("give this to friends");
        this.main.append(mk('p', "Give this URL out to let others try your level:"));
        this.main.append(mk('p.editor-share-url', {}, url));
        let copy_button = mk('button', {type: 'button'}, "Copy to clipboard");
        copy_button.addEventListener('click', ev => {
            flash_button(ev.target);
            navigator.clipboard.writeText(url);
        });
        this.main.append(copy_button);

        let ok = mk('button', {type: 'button'}, "neato");
        ok.addEventListener('click', () => {
            this.close();
        });
        this.footer.append(ok);
    }
}

export class EditorExportFailedOverlay extends DialogOverlay {
    constructor(conductor, errors, _warnings) {
        // TODO support warnings i guess
        super(conductor);
        this.set_title("export didn't go so well");
        this.main.append(mk('p', "Whoops!  I tried very hard to export your level, but it didn't work out.  Sorry."));
        let ul = mk('ul.editor-export-errors');
        // TODO structure the errors better and give them names out here, also reduce duplication,
        // also be clear about which are recoverable or not
        for (let error of errors) {
            ul.append(mk('li', error));
        }
        this.main.append(ul);
        this.add_button("oh well", () => {
            this.close();
        });
    }
}
