# Testing & Review Workflow

## Overview

This repo does not have a traditional unit-test suite or build verification pipeline. Validation is mostly a mix of local browser smoke testing, linting, structural checks, and change-focused review.

## Core Commands

### Static site

```bash
cd E:\dev\spacerust\cojmar\night-vibe-online
npx serve . -l tcp://0.0.0.0:3000
```

### Local multiplayer server

```bash
cd E:\dev\spacerust\cojmar\ws-server
npm start
```

### Linting

```bash
npx eslint app
```

### Structural checks

```bash
ast-grep scan --config .ast-grep.yml
```

## Recommended Review Order

The repo's own guidance is:

1. code-review-graph minimal context
2. code-review-graph change detection / impact analysis
3. `npx eslint app`
4. `ast-grep scan --config .ast-grep.yml`
5. optional graphify refresh when architecture/docs changed

## Manual Smoke Tests

Because there is no browser automation checked into this repo, these manual checks carry most of the confidence:

| Scenario | Why it matters |
|---|---|
| Open app locally with WS server running | Validates auth path and online boot |
| Open app locally without WS server | Validates offline fallback instead of stuck loader |
| Start a run from menu | Validates menu-to-match transition and HUD visibility |
| Rebirth path | Validates progression reset and persistent stat carryover |
| Inventory modal | Validates local item/equipment persistence |
| Config editor open, edit, export/import | Validates metadata-driven editor path |
| Mobile portrait and landscape | Validates `index.html` layout plus `updateLayout()` |

## High-Risk Files

When changes touch these files, add extra manual verification:

- `index.html`
- `app/main.js`
- `app/game.js`
- `app/ui.js`
- `app/config.js`
- `app/network.js`

Those are the files where startup, layout, host sync, and persistent state all intersect.

## Practical Note

Local and hosted behavior are not identical because the WebSocket endpoint differs by hostname. If a change is sensitive to startup or network state, test both localhost and the hosted path when possible.

## See also

- [Getting Started](getting-started.md)
- [Runtime Bootstrap](runtime-bootstrap.md)
- [Mobile Layout & Input](mobile-layout-and-input.md)