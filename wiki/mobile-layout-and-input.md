# Mobile Layout & Input

## Overview

Mobile behavior is split between `index.html` and `app/game.js`.

- `index.html` defines the full-page layout, responsive menu stacking, and touch-oriented CSS rules.
- `Game.updateLayout()` scales the canvas to the viewport and translates browser-space input into game-space coordinates.

Most mobile regressions are presentation or viewport issues, not combat-system issues.

## Layout Model

The page uses a single full-screen container with responsive flex layout.

- `body` is full-viewport and disables overscroll/user selection.
- `.container` fills the page and hosts both menu and gameplay surfaces.
- `.menu-grid` switches from row layout to stacked columns below `900px` width.
- CSS uses `100svh`, `100dvh`, and `100vh` style fallbacks to cope with mobile browser viewport changes.

## Canvas Scaling

`Game.updateLayout()` uses a height-locked scaling strategy:

- canvas backing size follows parent width/height and device pixel ratio
- view scale is derived from `screenHeight / GAME_H`
- if the scaled game width exceeds the screen width, the world is left-aligned and side scrolling handles the rest
- otherwise the world is centered horizontally

This is why layout changes in the outer DOM can immediately affect camera feel and apparent touch accuracy.

## Input Model

| Input | Behavior |
|---|---|
| Desktop left click | Move or target enemy |
| Desktop right click / hold | Charge S2 |
| Mobile tap | Move or target enemy |
| Mobile long press | Charge S2 |
| Mobile release | Fire charged skill |
| Orientation / resize | Triggers `updateLayout()` |

`touch-action: none` is enabled at the page level so the browser does not treat gameplay gestures as scroll or zoom operations.

## Runtime Hooks That Matter

`app/game.js` ties layout updates to:

- `ResizeObserver`
- `window.resize`
- `window.orientationchange`
- match start and match teardown

If mobile presentation looks wrong after a seemingly unrelated change, inspect those hooks along with the HTML/CSS shell before touching gameplay logic.

## Practical Debugging Rule

If the bug is “things render in the wrong place” or “controls feel offset,” start with `index.html` and `Game.updateLayout()`.

If the bug is “combat or state is wrong after tapping,” then move into `Game` and `Player` input handling.

## See also

- [UI, HUD & Menu Flow](ui-hud-and-menu-flow.md)
- [Runtime Bootstrap](runtime-bootstrap.md)
- [FAQ](FAQ.md)