import { mk, mk_svg } from './util.js';

// Superclass for the main display modes: the player, the editor, and the splash screen
export class PrimaryView {
    constructor(conductor, root) {
        this.conductor = conductor;
        this.root = root;
        this.active = false;
        this._done_setup = false;
    }

    setup() {}

    activate() {
        this.root.removeAttribute('hidden');
        this.active = true;
        if (! this._done_setup) {
            this.setup();
            this._done_setup = true;
        }
    }

    deactivate() {
        this.root.setAttribute('hidden', '');
        this.active = false;
    }

    reload_options(options) {}
}

// Stackable modal overlay of some kind, usually a dialog
export class Overlay {
    constructor(conductor, root) {
        this.conductor = conductor;
        this.root = root;
        // Make the dialog itself focusable; this makes a lot of stuff easier, like ensuring that
        // pressing Esc always has a viable target
        this.root.tabIndex = 0;

        // Don't propagate clicks on the root element, so they won't trigger a parent overlay's
        // automatic dismissal
        this.root.addEventListener('click', ev => {
            ev.stopPropagation();
        });
        // Don't propagate keys, either.  This is only a partial solution (for when something within
        // the dialog has focus), but open() adds another handler to block keys more aggressively
        this.root.addEventListener('keydown', ev => {
            ev.stopPropagation();

            if (ev.key === 'Escape') {
                this.close();
            }
        });
    }

    open() {
        if (this.root.isConnected) {
            this.close();
        }

        if (this.conductor.player.state === 'playing') {
            this.conductor.player.set_state('paused');
        }

        let overlay = mk('div.overlay', this.root);
        document.body.append(overlay);

        // Remove the overlay when clicking outside the element
        // FIXME would like mouseup here so right click dismisses too, but then opening a popup with
        // right mouse button is impossible oops
        overlay.addEventListener('click', () => {
            this.close();
        });

        // Start with the overlay itself focused
        this.root.focus();

        // While this dialog is open, keys should not reach the rest of the document, and you should
        // not be able to tab your way out of it.  This is a rough implementation of that.
        // Note that focusin bubbles, but focus doesn't.  Also, focusin happens /just before/ an
        // element receives focus, not afterwards, but that doesn't seem to affect this.
        this.focusin_handler = ev => {
            // If we're no longer visible at all, remove this event handler
            if (! this.root.isConnected) {
                this._remove_global_event_handlers();
                return;
            }
            // If we're not the topmost overlay, do nothing
            if (this.root.parentNode.nextElementSibling)
                return;

            // No problem if the focus is within the dialog, OR on the root <html> element
            if (ev.target === document.documentElement || this.root.contains(ev.target)) {
                this.last_focused = ev.target;
                return;
            }

            // Otherwise, focus is trying to escape!  Put a stop to that.
            // Focus was probably moved with tab or shift-tab.  We should be the last element in the
            // document, so tabbing off the end of us should go to browser UI.  Shift-tabbing back
            // beyond the start of a document usually goes to the root (and after that, browser UI
            // again).  Thus, there are only two common cases here: if the last valid focus was on
            // the document root, they must be tabbing forwards, so focus our first element; if the
            // last valid focus was within us, they must be tabbing backwards, so focus the root.
            if (this.last_focused === document.documentElement) {
                this.root.focus();
                this.last_focused = this.root;
            }
            else {
                document.documentElement.focus();
                this.last_focused = document.documentElement;
            }
        };
        window.addEventListener('focusin', this.focusin_handler);

        // Block any keypresses attempting to go to an element outside the dialog
        this.keydown_handler = ev => {
            // If we're no longer visible at all, remove this event handler
            if (! this.root.isConnected) {
                this._remove_global_event_handlers();
                return;
            }
            // If we're not the topmost overlay, do nothing
            if (this.root.parentNode.nextElementSibling)
                return;

            // Note that if the target is the window itself, contains() will explode
            if (! (ev.target instanceof Node && this.root.contains(ev.target))) {
                ev.stopPropagation();
            }
        };
        // Use capture, which runs before any other event handler
        window.addEventListener('keydown', this.keydown_handler, true);

        // Block mouse movement as well
        overlay.addEventListener('mousemove', ev => {
            ev.stopPropagation();
        });

        // Disable context menu -- this fixes using mouse2 to open a popup, because the shield is
        // under the mouse by the time mouseup happens
        overlay.addEventListener('contextmenu', ev => {
            ev.preventDefault();
        });

        return overlay;
    }

    _remove_global_event_handlers() {
        window.removeEventListener('focusin', this.focusin_handler);
        window.removeEventListener('keydown', this.keydown_handler, true);
    }

    close() {
        this._remove_global_event_handlers();
        this.root.closest('.overlay').remove();
        if (document.activeElement) {
            // The active element is almost certainly either the dialog or a control within it,
            // which is useless as a focus target, so blur it and let the page have focus
            document.activeElement.blur();
        }
    }
}

// Overlay styled like a popup of some sort
export class TransientOverlay extends Overlay {
    open() {
        // TODO i don't like how vaguely arbitrary this feels.
        let overlay = super.open();
        overlay.classList.add('--transient');
        return overlay;
    }

    // Open relative to an arbitrary rectangle.  Used by the editor's TileEditorOverlay classes.
    open_balloon(rect) {
        this.open();

        // Fixed-size balloon positioning
        let root = this.root;
        root.classList.add('--balloon');
        let spacing = 2;
        // Vertical position: either above or below, preferring the side that has more space
        if (rect.top - 0 > document.body.clientHeight - rect.bottom) {
            // Above
            root.classList.add('--above');
            root.style.top = `${rect.top - root.offsetHeight - spacing}px`;
        }
        else {
            // Below
            root.classList.remove('--above');
            root.style.top = `${rect.bottom + spacing}px`;
        }
        // Horizontal position: centered, but kept within the screen
        let left;
        let margin = 8;  // prefer to not quite touch the edges
        if (document.body.clientWidth < root.offsetWidth + margin * 2) {
            // It doesn't fit on the screen at all, so there's nothing we can do; just center it
            left = (document.body.clientWidth - root.offsetWidth) / 2;
        }
        else {
            left = Math.max(margin, Math.min(document.body.clientWidth - root.offsetWidth - margin,
                (rect.left + rect.right - root.offsetWidth) / 2));
        }
        root.style.left = `${left}px`;
        root.style.setProperty('--chevron-offset', `${(rect.left + rect.right) / 2 - left}px`);
    }

    close() {
        if (this.root.classList.contains('--balloon')) {
            this.root.classList.add('--vanishing');
            // Force the animation to play again
            this.root.style.animation = 'none';
            this.root.offsetHeight;  // force reflow
            this.root.style.animation = null;

            window.setTimeout(() => {
                super.close();
            }, 100);
        }
        else {
            super.close();
        }
    }
}

export class MenuOverlay extends TransientOverlay {
    constructor(conductor, items, make_label, onclick) {
        super(conductor, mk('ol.popup-menu'));
        for (let [i, item] of items.entries()) {
            if (item === null) {
                this.root.append(mk('li.-separator', {'data-index': i}));
                continue;
            }
            let [label, shortcut] = make_label(item).split(/\t/);
            let li = mk('li', {'data-index': i}, label);
            if (shortcut) {
                let span = mk('span.-shortcut');
                for (let [_, literal, key] of shortcut.matchAll(/(.*?)(?:\[(.+?)\]|$)/gs)) {
                    span.append(literal);
                    if (key) {
                        span.append(mk('kbd', key));
                    }
                }
                li.append(span);
            }
            this.root.append(li);
        }

        this.root.addEventListener('click', ev => {
            let li = ev.target.closest('li');
            if (! li || ! this.root.contains(li))
                return;

            let i = parseInt(li.getAttribute('data-index'), 10);
            let item = items[i];
            if (! item)
                return;

            onclick(item);
            this.close();
        });
    }

    open_relative_to(relto) {
        this.open();

        let anchor = relto.getBoundingClientRect();
        let rect = this.root.getBoundingClientRect();

        // Prefer left anchoring, but use right if that would go off the screen
        if (anchor.left + rect.width > document.body.clientWidth) {
            this.root.style.right = `${document.body.clientWidth - anchor.right}px`;
        }
        else {
            this.root.style.left = `${anchor.left}px`;
        }

        // Open vertically in whichever direction has more space (with a slight bias towards opening
        // downwards).  If we would then run off the screen, also set the other anchor to constrain
        // the height.
        let top_space = anchor.top - 0;
        let bottom_space = document.body.clientHeight - anchor.bottom;
        if (top_space > bottom_space) {
            this.root.style.bottom = `${document.body.clientHeight - anchor.top}px`;
            if (rect.height > top_space) {
                this.root.style.top = `${0}px`;
            }
        }
        else {
            this.root.style.top = `${anchor.bottom}px`;
            if (rect.height > bottom_space) {
                this.root.style.bottom = `${0}px`;
            }
        }
    }
}

// Overlay styled like a dialog box
export class DialogOverlay extends Overlay {
    constructor(conductor) {
        super(conductor, mk('form.dialog'));

        this.root.append(
            this.header = mk('header'),
            this.main = mk('section'),
            this.footer = mk('footer'),
        );
    }

    set_title(title) {
        this.header.textContent = '';
        this.header.append(mk('h1', {}, title));
    }

    add_button(label, onclick, is_default) {
        let button = mk('button', {type: 'button'}, label);
        if (is_default) {
            button.classList.add('button-bright');
        }
        button.addEventListener('click', onclick);
        this.footer.append(button);
        return button;
    }

    add_button_gap() {
        this.footer.append(mk('div.-spacer'));
    }
}

// Informational popup dialog
export class AlertOverlay extends DialogOverlay {
    constructor(conductor, message, title = "heads up") {
        super(conductor);
        this.set_title(title);
        this.main.append(mk('p', {}, message));
        this.add_button("a'ight", () => {
            this.close();
        }, true);
    }
}

// Yes/no popup dialog
export class ConfirmOverlay extends DialogOverlay {
    constructor(conductor, message, what) {
        super(conductor);
        this.set_title("just checking");
        this.main.append(mk('p', {}, message));
        this.add_button("yep", ev => {
            this.close();
            what();
        }, true);
        this.add_button("nope", ev => {
            this.close();
        });
    }
}

export function flash_button(button) {
    button.classList.add('--button-glow-ok');
    window.setTimeout(() => {
        button.classList.add('--button-glow');
        button.classList.remove('--button-glow-ok');
    }, 10);
    window.setTimeout(() => {
        button.classList.remove('--button-glow');
    }, 500);
}

export function svg_icon(name) {
    return mk_svg(
        'svg.svg-icon',
        {viewBox: '0 0 16 16'},
        mk_svg('use', {href: `#svg-icon-${name}`}));
}

export function load_json_from_storage(key) {
    return JSON.parse(window.localStorage.getItem(key));
}

export function save_json_to_storage(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
}
