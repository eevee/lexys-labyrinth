import { mk, mk_svg, walk_grid } from './util.js';

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
}

// Stackable modal overlay of some kind, usually a dialog
export class Overlay {
    constructor(conductor, root) {
        this.conductor = conductor;
        this.root = root;

        // Don't propagate clicks on the root element, so they won't trigger a
        // parent overlay's automatic dismissal
        this.root.addEventListener('click', ev => {
            ev.stopPropagation();
        });
    }

    open() {
        // FIXME ah, but keystrokes can still go to the game, including
        // spacebar to begin it if it was waiting.  how do i completely disable
        // an entire chunk of the page?
        if (this.conductor.player.state === 'playing') {
            this.conductor.player.set_state('paused');
        }

        let overlay = mk('div.overlay', this.root);
        document.body.append(overlay);

        // Remove the overlay when clicking outside the element
        overlay.addEventListener('click', ev => {
            this.close();
        });
    }

    close() {
        this.root.closest('.overlay').remove();
    }
}

// Overlay styled like a dialog box
export class DialogOverlay extends Overlay {
    constructor(conductor) {
        super(conductor, mk('div.dialog'));

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
    }
}

// Yes/no popup dialog
export class ConfirmOverlay extends DialogOverlay {
    constructor(conductor, message, what) {
        super(conductor);
        this.set_title("just checking");
        this.main.append(mk('p', {}, message));
        let yes = mk('button', {type: 'button'}, "yep");
        let no = mk('button', {type: 'button'}, "nope");
        yes.addEventListener('click', ev => {
            this.close();
            what();
        });
        no.addEventListener('click', ev => {
            this.close();
        });
        this.footer.append(yes, no);
    }
}
