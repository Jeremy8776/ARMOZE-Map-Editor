# ARMOZE - Advanced Map Overlay Zone Editor

<div align="center">
  <img src="logo.svg" alt="ARMOZE Logo" width="120" height="auto">
  <br><br>
</div>

---

## What ARMOZE does

ARMOZE is an Electron desktop editor for building map overlays and gameplay zones for tactical games. It gives you a visual workflow for:

1. Loading a map image or downloading one on-demand from the built-in Map Library
2. Drawing zones directly on the map
3. Styling borders, fills, labels, and integrated markings
4. Saving projects and reopening them later
5. Exporting to script and overlay formats (PNG, TIFF, JSON, EnfusionScript, Workbench Plugin)

## Current feature set

### Map workflow
- Desktop-first Electron app with `npm start`
- Drag-and-drop map loading for `.png`, `.jpg`, `.dds`, and `.edds`
- **Map Library** with bundled preview thumbnails — official maps download on demand from a permanent GitHub release and live in `%APPDATA%/ARMOZE/Maps/` (Windows) so they survive app updates
- Multiple map tabs with preserved zoom and pan state
- Built-in map extractor and import flow for desktop assets
- One-click in-app updates via electron-updater

### Drawing and editing
- Select, pan, rectangle, circle, line, pen, and freehand tools
- Snap-to-grid toggle with visual snap feedback
- Move, resize, duplicate, delete, and hide zones
- Floating zone properties panel anchored to the selected zone
- Live zone data readout in the layers panel

### Styling
- Zone style profiles with save/delete support
- Border, fill, and pattern controls
- Label text, font, size, bold, italic, color, background, and shadow controls
- Border-integrated and pattern-integrated label modes
- Drag-to-position floating labels
- Section-specific recent colors for zone, label text, and label background

### Export and project management
- EnfusionScript export
- Workbench Plugin export
- PNG / TIFF overlay export (image overlay or map + overlay composite)
- JSON config export
- Coordinate foundation controls with origin offset, map scale, invert-Y, and calibration
- Save/load full projects as JSON

## Running locally

```bash
npm install
npm start
```

This launches the Electron desktop app.

## Main shortcuts

| Action | Shortcut |
| --- | --- |
| Select tool | `V` |
| Rectangle tool | `R` |
| Circle tool | `C` |
| Line tool | `L` |
| Pen tool | `P` |
| Freehand tool | `D` |
| Toggle snap | `S` |
| Fit view | `F` |
| Open extractor | `Ctrl + Shift + T` |
| Open documentation | `?` |
| Export | `Ctrl + E` |
| Undo | `Ctrl + Z` |
| Redo | `Ctrl + Y` |
| Delete selected zone | `Delete` / `Backspace` |

## Documentation

- In-app: click the help button under the extractor button in the left toolbar
- Local docs page: [docs.html](docs.html)
- Wiki pages:
  - [Home](docs/wiki/Home.md)
  - [Getting Started](docs/wiki/Getting-Started.md)
  - [Drawing Tools](docs/wiki/Drawing-Tools.md)
  - [Exporting](docs/wiki/Exporting.md)
  - [Project Management](docs/wiki/Project-Management.md)

## Repo notes

- App version constant: [js/constants.js](js/constants.js)
- Main app entry: [js/app.js](js/app.js)
- Toolbar wiring: [js/ui/toolbar-ui.js](js/ui/toolbar-ui.js)
- Documentation page: [docs.html](docs.html)

## License

MIT
