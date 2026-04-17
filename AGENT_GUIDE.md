# ARMOZE - Agent & Developer Context Guide

## 1. Project Overview
**ARMOZE** (Advanced Map Overlay Zone Editor) is a pure, client-side web application designed to create visual map zones for tactical sandbox games. It allows users to load map images, visually draw zones (polygons, circles, rectangles), and export them into industry-standard formats (`.c` EnfusionScript, custom Workbench plugins, or JSON).

## 2. Technology Stack
*   **Core**: Vanilla JavaScript (ES6+ Modules). **No** React, Vue, or other frameworks.
*   **UI**: HTML5 + CSS3 (Variables-based design system).
*   **Graphics**: HTML5 `<canvas>` API for all rendering.
*   **Icons**: [Lucide Icons](https://lucide.dev/).
*   **Dependencies**: `UTIF.js` (for TIFF handling), otherwise zero-dependency.

## 3. Architecture Patterns

The application uses a **Modular Service-Based Architecture**. Global state is minimized, but core services are exposed via `window.app` for inter-module communication when necessary.

### core/
*   **`CanvasCore`**: Handles the low-level HTML5 Canvas context, zoom/pan transforms, and frame rendering loop. It does NOT handle logic, only the view.
*   **`EventHandler`**: Centralized input listener. Captures raw DOM events (mousedown, keydown) and routes them to the active Tool or Manager.

### zones/
*   **`ZoneManager`**: The **Source of Truth**. Manages the array of zone objects, selection state, and CRUD operations.
*   **`ZoneRenderer`**: Purely visual. Iterates over `ZoneManager` data and draws it to the `CanavsCore` context.

### tools/
*   **`ToolManager`**: State machine for the active tool (Select, Pen, Rect, etc.).
*   **`BaseTool`**: (Implicit interface) All tools (`SelectTool`, `ShapeTool`, `PenTool`) implement standard lifecycle methods: `onDown`, `onMove`, `onUp`.

### services/
*   **`HistoryManager`**: Handles Undo/Redo stacks.
*   **`ProjectManager`**: JSON serialization for save/load.
*   **`ExportHandler`**: Logic for converting Zone data into formatted strings (C#, JSON, C++).

## 4. Coding Standards & Best Practices

### State Management
*   **Do not** store state in the DOM.
*   All zone data resides in `ZoneManager.zones`.
*   UI components (`ZonePropertiesUI`, `ZoneListUI`) are "dumb" views that subscribe to data changes or refresh when triggered.

### Canvas rendering
*   **Optimized Rendering**: The canvas only re-renders when `requestRender()` is called. Do not create continuous `requestAnimationFrame` loops unless animating.
*   **Coordinate Spaces**:
    *   **Screen Space**: Raw mouse coordinates from DOM.
    *   **Map Space**: Transformed coordinates (Screen - Pan / Zoom).
    *   **World Space**: Game engine coordinates (often inverted Y-axis).

### CSS & Styling
*   Use CSS Variables (Tokens) defined in `css/base.css` for all colors and spacing.
*   Class naming follows a loosely BEM structure (e.g., `.zone-list`, `.zone-list__item`).
*   **Dark Mode** is the default and only mode.

## 5. Key File Structure
```text
/js
  ├── app.js                 # Entry point, orchestrates service initialization
  ├── constants.js           # Global config and magic numbers
  ├── core/
  │   ├── canvas-core.js     # Canvas context wrapper
  │   └── event-handler.js   # Input routing
  ├── zones/
  │   ├── zone-manager.js    # Data model
  │   └── zone-renderer.js   # Drawing logic
  ├── tools/
  │   ├── tool-manager.js    # Tool switcher
  │   ├── pen-tool.js        # Polygon logic
  │   └── select-tool.js     # Drag/Resize logic
  └── services/              # Export, IO, History
```

## 6. Common Tasks

### Adding a New Zone Type
1.  Add the type string to `index.html` (Select dropdown).
2.  Update `getZoneTypeColor()` in `js/utils.js`.
3.  (Optional) Update `ExportHandler.js` if it triggers specific game logic.

### Adding a New Tool
1.  Create class in `js/tools/`.
2.  Implement `onDown`, `onMove`, `onUp`.
3.  Register in `js/tools/tool-manager.js`.
4.  Add button to `index.html`.

### changing Export Logic
1.  Modify `js/export-handler.js`.
2.  Ensure strings are properly escaped using `escapeString()`.
