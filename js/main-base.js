import { mk } from './util.js';

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
        overlay.addEventListener('click', ev => {
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

        return overlay;
    }

    _remove_global_event_handlers() {
        window.removeEventListener('focusin', this.focusin_handler);
        window.removeEventListener('keydown', this.keydown_handler, true);
    }

    close() {
        this._remove_global_event_handlers();
        this.root.closest('.overlay').remove();
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

    add_button(label, onclick) {
        let button = mk('button', {type: 'button'}, label);
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
        this.add_button("a'ight", ev => {
            this.close();
        });
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
        });
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

export function load_json_from_storage(key) {
    return JSON.parse(window.localStorage.getItem(key));
}

export function save_json_to_storage(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
}
