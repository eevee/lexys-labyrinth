# Lexy's Labyrinth

This is a reimplementation of [**Chip's Challenge®**](https://wiki.bitbusters.club/Chip%27s_Challenge), that puzzle game you might remember from the early 90s (and its long-awaited [sequel](https://wiki.bitbusters.club/Chip%27s_Challenge_2)).

It's free; runs in a browser; has completely new artwork, sounds, and music; comes with hundreds of quality fan-made levels built in; and can load the original levels from a copy of the commercial game!

Documentation is underway on the [wiki](https://github.com/eevee/lexys-labyrinth/wiki).

## My lawyer is telling me to say this

To be absolutely clear: this is a ***fan project*** and is not affiliated with, sponsored by, endorsed by, or in any way approved of by Bridgestone Multimedia Group LLC.  **Chip's Challenge** is a registered trademark of Bridgestone Multimedia Group LLC, and is used here for identification purposes only.

Despite the names, the built-in "Chip's Challenge Level Packs" are community creations and have no relation to the commercial games or their levels.

## Play online

Give it a try, I guess!  [https://c.eev.ee/lexys-labyrinth/](https://c.eev.ee/lexys-labyrinth/)

## Current status

- Fully compatible with Chip's Challenge 1 levels...  barring a few obscure rule changes
- Fully compatible with Chip's Challenge 2 levels...  barring a few obscure bugs
- Completely original tileset, sound effects, and music
- Compatible with MS Chip's Challenge DAT/CCL files, Steam Chip's Challenge C2G/C2M files, and ZIP files
- Can load one of its built-in level packs, the original levels, or anything you've got lying around
- Able to record and play back demos (replays) from Steam-format levels
- Lets you rewind your mistakes, up to 30 seconds back
- Lets you take the pressure off by switching from real-time to turn-based mode, where nothing moves until you do
- Contains a completely usable level editor with support for every tile in Chip's Challenge 2
- Works on touchscreens too
- Has compatibility settings for opting into behavior (or bugs) from particular implementations
- Debug mode (click the logo in the lower left)

### Planned features

- Load levels directly from the BBC set list
- Mouse support

## For developers

It's all static JS; there's no build system.  If you want to run it locally, just throw your favorite HTTP server at a checkout and open a browser.  (Browsers won't allow XHR from `file:///` URLs, alas.  If you don't have a favorite HTTP server, try `python -m http.server`.)

If you have Node installed, you can test the solutions included with the bundled level packs without needing a web browser:

```
node js/headless/bulktest.mjs
```

Note that solution playback is still not perfect, so don't be alarmed if you don't get 100% — only if you make a change and something regresses.

## Special thanks

- The incredible nerds who put together the [Chip Wiki](https://wiki.bitbusters.club/) and also reside on the Bit Busters Discord, including:
  - ruben for documenting the CC2 PRNG
  - The Architect for documenting the CC2 C2G parser
- Everyone who worked on [Chip's Challenge Level Pack 1](https://wiki.bitbusters.club/Chip%27s_Challenge_Level_Pack_1), the default set of levels
- [Tile World](https://wiki.bitbusters.club/Tile_World) for being an incredible reference on Lynx mechanics
- Everyone who contributed music — see [`js/soundtrack.js`](js/soundtrack.js) for a list!
