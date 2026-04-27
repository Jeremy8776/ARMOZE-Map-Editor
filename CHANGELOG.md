# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.1] - 2026-04-27

### Fixed
- **Auto-Updater Diagnosability**: Wired `autoUpdater.logger = console` so update events are logged to `%APPDATA%/ARMOZE/logs/main.log` and the renderer console. Makes it possible to diagnose why electron-updater might fall back to the manual GitHub-API path on a given build.
- **Update Banner Copy**: The update banner now states explicitly whether it's offering a one-click in-app install or just opening the GitHub release page, so it's obvious which code path fired.

## [1.6.2] - 2026-04-27

### Added
- **Map Library (Catalog System)**: Maps are no longer bundled inside the installer. The new `Maps/catalog.json` lists all official maps and the side-drawer renders each as a card with `Available` / `Downloading` / `Installed` states. Click any uninstalled map (or its install icon) to download it on demand from a permanent `maps-library-v1` GitHub release. Installed maps live in `%APPDATA%/ARMOZE/Maps/` so they survive app updates.
- **Per-card download progress**: a live progress bar + percentage badge during install.
- **Remove from PC**: trash icon on installed cards reclaims disk; re-installable any time.
- **GitHub Actions Release Pipeline** (`.github/workflows/release.yml`): pushing a `v*` tag (or manual dispatch) builds the Windows NSIS installer and publishes it + `latest.yml` to GitHub Releases via electron-builder, using the workflow's built-in `GITHUB_TOKEN`. No more local `npm run release`.
- **Auto-Updater Diagnosability**: `autoUpdater.logger = console` so update events land in `%APPDATA%/ARMOZE/logs/main.log` and the renderer console. The update banner copy now states explicitly whether the click does a one-click in-app install or just opens the GitHub release page.

### Changed
- **Installer Size**: Dropping all bundled map PNGs cuts the unpacked install from ~349 MB → ~165 MB. The 87 MB Zimnitrita map (and every other official map) is downloaded only when the user opts in.
- **Imported Maps Path**: Map Extractor / file-picker imports now write to `%APPDATA%/ARMOZE/Maps/` instead of the install directory. They show up in the side-drawer as catalog "Extras" and aren't wiped by app updates.
- **Map Side-Drawer**: rebuilt around the catalog. Backwards-compatible with user-imported maps that aren't in the catalog (still listed as extras).

### Removed
- **`Maps/maps.js`** manifest — replaced by `Maps/catalog.json` (a structured manifest with download URLs and sizes).
- **Bundled map PNGs** — moved to the `maps-library-v1` release as downloadable assets.

## [1.6.0] - 2026-04-26

### Added
- **In-App Auto-Updates**: Packaged builds now download and install updates in one click via `electron-updater`. The toast banner walks through Available → Downloading (with progress bar) → Restart & Install. Older releases without electron-updater metadata gracefully fall back to opening the GitHub release page.
- **TIFF Image Export**: New "Image Format" selector in the Export modal — both *Image Overlay* and *Map + Overlay* outputs can now be saved as TIFF in addition to PNG.
- **electron-builder Pipeline**: Added `npm run pack` / `dist` / `release` scripts and a `build` config (NSIS target, GitHub publish provider) so installers and `latest.yml` artifacts are produced and published in one command.

### Fixed
- **Map Extractor IDs**: Re-aligned the extractor handler with the actual DOM IDs in `map-extractor-view.js` (`extractorSearchTerm`, `extractorFilterExtension`, `searchTermGroup`, `filterExtensionGroup`, `extractorStatus`, `extractorResultMessage`) — the extractor was previously broken due to stale ID references. Also wired the missing `btnCancelExtractor` listener.
- **PowerShell Extraction Tools**: Fixed invalid `(Read-Host) -or (default)` pattern in `ExtractTexture.ps1` (the `-or` operator is boolean, not coalesce) and replaced unsupported `return if (...) {} else {}` syntax in `LibExtract.psm1` (parse error in Windows PowerShell 5.1).
- **PAK Filtered Extraction**: `Expand-PakFile` now tries multiple path-separator variants of filtered extraction before giving up, instead of falling back to a slow full-PAK extract.
- **Dead TIFF Code**: The previous `exportTIFF` referenced `UTIF` but the library was never loaded; UTIF is now loaded in `index.html`.

### Changed
- **Launcher Robustness**: `Launch ARMOZE.bat` now checks `.electron-runner` first before falling through to `node_modules/.bin/electron.cmd`, with a clearer error message pointing users at `npm install`.

## [1.5.0] - 2026-02-05

### Added
- **Map Extractor Improvements**:
    - **Open Output Folder**: Added a button to instantly open the destination folder after a successful extraction.
    - **Native Clipboard**: Implemented robust "Copy to Clipboard" functionality for extraction commands using Electron's native API.
    - **Smart Defaults**: Extractor now automatically defaults to the user's `Downloads` folder if no output directory is set.

### Fixed
- **Extraction Detection**: Fixed regex patterns to correctly identify successful extractions from the PowerShell script output.
- **Path Handling**: Improved handling of file paths with spaces in the "Open Folder" feature.

## [1.4.0] - 2026-01-23

### Added
- **Zone Fill Patterns**: Added support for custom fill patterns for zones (Solid, Diagonal, Vertical, Horizontal, Grid, Dots, Crosshatch).
- **Documentation Wiki**: Added comprehensive wiki documentation (Home, Getting Started, Drawing Tools, Project Management, Exporting).
- **Map Asset**: Added separate `Ruha_map.png` for cleaner map handling.

### Fixed
- **Git Ignoring**: Correctly ignored `Maps/temp_extract/` directory to prevent repository bloat.

## [1.3.2] - 2026-01-23

### Added
- **SEO Optimization**: Comprehensive search engine optimization including Open Graph tags, Twitter Cards, and JSON-LD structured data
- **Documentation**: Completely overhauled README.md with better structure, badges, and keyword optimization

## [1.3.1] - 2026-01-23

### Fixed
- **Deprecated API**: Replaced deprecated `substr()` with `substring()` for future browser compatibility
- **Null Safety**: Added defensive null-coalescing operators in zone coordinate formatting to prevent potential runtime errors
- **Code Cleanup**: Removed unused `dashMove` variable in ZoneRenderer
- **Code Cleanup**: Removed duplicate JSDoc comment block in ExportHandler
- **CSS Variable Typo**: Fixed `--text-muted` to `--color-text-muted` in calibration section
- **Comment Clarity**: Clarified confusing comment about `invertY` default value

## [1.3.0] - 2026-01-23

### Added
- **Modular Architecture**: Major refactoring to improve code maintainability and testability:
    - **UI Modules**: `TabManager`, `ZoneListUI`, `ZonePropertiesUI` for cleaner separation of concerns
    - **Service Modules**: `HistoryManager`, `ProjectManager`, `CalibrationService`, `FileHandler`
    - **Constants Module**: Centralized configuration values to eliminate magic numbers
- **Utils.offsetZone()**: New utility function for zone offset operations

### Fixed
- **Critical: Keyboard delete now saves history** - Deleting zones via Delete/Backspace key now properly saves to undo history
- **DDS Parser Logic**: Fixed incorrect rejection of valid uncompressed DDS files
- **Context Menu Integration**: Updated to use new modular methods

### Changed
- **app.js refactored**: Reduced from 1205 lines to ~420 lines by extracting modules
- All modules now have consistent `window.` exports for better interoperability
- Removed unused `render()` method from `ZoneRenderer` class
- Improved JSDoc documentation across all modules

## [1.2.0] - 2026-01-21

### Added
- **Right-Click Context Menu**: Right-click on zones (in list or canvas) for quick actions:
    - Rename, Duplicate, Copy, Paste, Delete, Toggle Visibility
- **Multi-Select Support**: Hold Shift and click to select multiple zone items in the layer list
- **Copy/Paste Zones**: Use Ctrl+C to copy and Ctrl+V to paste zones
- **Duplicate Shortcut**: Use Ctrl+D to quickly duplicate selected zone
- **Advanced Map Markers**: Added 20+ military and tactical marker types:
    - **Military**: Infantry, Motorized, Armor, Recon, Artillery, Mortar, Machine Gun, Anti-Tank, Anti-Air, Sniper, Medical, Supply, Maintenance, Headquarters
    - **Tactical**: Flag, Warning, Waypoint, Rally Point, Attack, Defend
- **Grid Snap Keyboard Shortcut**: Press `S` to toggle grid snapping (was documented but missing)
- **Label Styling Controls**: Full customization of zone label appearance:
    - Show/Hide label toggle
    - Custom label text color
    - Backdrop color with adjustable opacity
    - Label size (Small, Medium, Large)
    - Text shadow toggle for better readability

### Fixed
- **Critical: Rectangle zones now render correctly** (was missing rendering case)
- **Critical: Keyboard shortcuts no longer trigger while typing in input fields**
    - Backspace no longer deletes zones when editing zone name
    - Letter keys (V, R, C, L, P, D) no longer switch tools while typing
- **Critical: Image/TIFF export no longer crashes** (fixed missing renderer reference)
- **Critical: Calibration point picker now works correctly** (fixed property name mismatch)
- **Undo/Redo now captures zone drag and resize operations**
- Rectangle zones now fully supported: click detection, selection handles, resizing, dragging
- Rectangle coordinates now show in properties panel (Position and Size)
- Removed leftover development comments from code
- Added standard `appearance` CSS property for cross-browser compatibility

## [1.1.0] - 2026-01-21

### Added
- **Coordinate System Support**: Added "Invert Y Axis" option to support tactical coordinate systems (North = +Z) seamlessly.
- **Improved Calibration**: Updated the calibration tool to automatically calculate scale and origin with the new axis inversion logic.

### Fixed
- Addressed coordinate mismatch between Canvas (Y down) and Game World (Z up).

## [1.0.0] - 2026-01-21

### Added
- **Visual Zone Editor**:
    - Draw zones on custom map overlays using geometric shapes (Circle, Rectangle) or the Pen tool for complex polygons.
    - Support for multiple zone types: Safe, Restricted, PvP, Spawn, Objective, and Custom.
    - Visual styling options for zones (colors, dashed/dotted borders).
    - Grid snapping (`S` hotkey) and coordinate tracking.
    - Freehand drawing tool.
- **Export Capabilities**:
    - **Workbench Plugin**: Export directly to a `.c` script that acts as a generic Workbench Plugin, automating the creation of Trigger Entities in the World Editor.
    - **Game Mode Component**: Export to `SCR_ZoneManagerComponent.c` for direct code integration into game modes.
    - **Map Overlay**: Export the map canvas as a high-quality `.tiff` image.
    - **JSON Project**: Save and load project state to `.json` files.
- **Tools & UI**:
    - Undo/Redo functionality.
    - Loop closing with visual feedback for the Pen tool.
    - Interactive map navigation (Pan, Zoom, Fit View).
    - Dark mode, tactical aesthetic UI.
- **Documentation**:
    - Comprehensive `docs.html` guide included in the application.
    - Branded `README.md` with usage instructions.

### Changed
- Rebranded application to **ARMOZE** (Advanced Map Overlay Zone Editor).
- Updated logo to a vector-based tactical hex design.
