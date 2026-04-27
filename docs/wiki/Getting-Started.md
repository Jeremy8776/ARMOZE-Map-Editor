# Getting Started

## Launching the app

ARMOZE currently runs as an Electron desktop app:

```bash
npm install
npm start
```

## Loading a map

You can start from:

1. A dropped `.png`, `.jpg`, `.dds`, or `.edds` file
2. The file picker on the landing screen
3. The **Map Library** in the side-drawer — every official map is shown as a card with a small preview thumbnail. Click a card (or its install icon) to download it on demand and start working immediately. Installed maps survive app updates.
4. An extractor result imported back into the app as a named map

### About the Map Library

ARMOZE no longer bundles full-resolution maps inside the installer. Instead, `Maps/catalog.json` lists every official map with its size, preview thumbnail, and download URL. Maps are fetched on demand from the permanent `maps-library-v1` GitHub release and stored under `%APPDATA%/ARMOZE/Maps/` (Windows) so they survive updates and can be removed any time via the trash icon on the card. User-imported maps from the file picker or extractor are saved alongside them.

## Navigating the workspace

| Action | Control |
| --- | --- |
| Zoom | Mouse wheel |
| Pan | Pan tool or middle mouse drag |
| Fit View | `F` |
| Toggle snap | `S` |

The workspace is designed as a full-bleed map layer with toolbar, tabs, layers, and the floating properties panel overlaid on top.

## First useful workflow

1. Load a map
2. Draw a rectangle or circle
3. Select it
4. Adjust fill, border, and label styling from the floating panel
5. Save the project or export the result
