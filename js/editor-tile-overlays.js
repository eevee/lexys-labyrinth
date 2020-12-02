import { TransientOverlay } from './main-base.js';
import { mk } from './util.js';

// FIXME could very much stand to have a little animation when appearing
class TileEditorOverlay extends TransientOverlay {
    constructor(conductor) {
        let root = mk('form.editor-popup-tile-editor');
        root.append(mk('span.popup-chevron'));
        super(conductor, root);
        this.editor = conductor.editor;
        this.tile = null;
    }

    edit_tile(tile) {
        this.tile = tile;
    }

    static configure_tile_defaults(tile) {
        // FIXME maybe this should be on the tile type, so it functions as documentation there?
    }
}

class LetterTileEditor extends TileEditorOverlay {
    constructor(conductor) {
        super(conductor);

        let list = mk('ol.editor-letter-tile-picker');
        this.root.append(list);
        this.glyph_elements = {};
        for (let c = 32; c < 128; c++) {
            let glyph = String.fromCharCode(c);
            let input = mk('input', {type: 'radio', name: 'glyph', value: glyph});
            this.glyph_elements[glyph] = input;
            let item = mk('li', mk('label', input, mk('span.-glyph', glyph)));
            list.append(item);
        }

        list.addEventListener('change', ev => {
            let glyph = this.root.elements['glyph'].value;
            if (this.tile) {
                this.tile.ascii_code = glyph.charCodeAt(0);
                // FIXME should be able to mark tiles as dirty, also this is sure a mouthful
                this.conductor.editor.renderer.draw();
            }
        });
    }

    edit_tile(tile) {
        super.edit_tile(tile);
        this.root.elements['glyph'].value = String.fromCharCode(tile.ascii_code);
    }

    static configure_tile_defaults(tile) {
        tile.ascii_code = 32;
    }
}

class HintTileEditor extends TileEditorOverlay {
    constructor(conductor) {
        super(conductor);

        this.text = mk('textarea.editor-hint-tile-text');
        this.root.append(this.text);
        this.text.addEventListener('input', ev => {
            if (this.tile) {
                this.tile.specific_hint = this.text.value;
            }
        });
    }

    edit_tile(tile) {
        super.edit_tile(tile);
        this.text.value = tile.specific_hint ?? "";
    }

    static configure_tile_defaults(tile) {
        tile.specific_hint = "";
    }
}


export const TILES_WITH_PROPS = {
    floor_letter: LetterTileEditor,
    hint: HintTileEditor,
    // TODO various wireable tiles
    // TODO initial value of counter
    // TODO cloner arrows
    // TODO railroad parts
    // TODO later, custom floor/wall selection
};
