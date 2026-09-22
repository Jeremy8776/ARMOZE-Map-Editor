const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadScriptExport(relativePath, exportName, extraContext = {}) {
    const absolutePath = path.join(__dirname, '..', relativePath);
    const source = fs.readFileSync(absolutePath, 'utf8');
    const context = {
        module: { exports: {} },
        exports: {},
        require,
        console,
        window: {},
        ...extraContext
    };

    vm.runInNewContext(`${source}\nmodule.exports = ${exportName};`, context, {
        filename: absolutePath
    });

    return context.module.exports;
}

const Utils = loadScriptExport('js/utils.js', 'Utils');
const ExportHandler = loadScriptExport('js/export-handler.js', 'ExportHandler', {
    ScriptGenerator: {},
    UTIF: {},
    Utils
});
const ScriptGenerator = loadScriptExport('js/services/script-generator.js', 'ScriptGenerator');
const CalibrationService = loadScriptExport('js/services/calibration-service.js', 'CalibrationService', {
    document: { getElementById: () => null }
});
const LayerOrderService = loadScriptExport('js/services/layer-order-service.js', 'LayerOrderService');
const InspectorLayoutService = loadScriptExport('js/services/inspector-layout-service.js', 'InspectorLayoutService');
const TabManager = loadScriptExport('js/ui/tab-manager.js', 'TabManager', { window: {} });
const FileHandler = loadScriptExport('js/services/file-handler.js', 'FileHandler');
const MapBrowserUI = loadScriptExport('js/ui/map-browser-ui.js', 'MapBrowserUI', { window: {}, btoa: (value) => Buffer.from(value).toString('base64') });
const MapTokenTooltip = loadScriptExport('js/ui/map-token-tooltip.js', 'MapTokenTooltip');
const CanvasCore = loadScriptExport('js/core/canvas-core.js', 'CanvasCore', {
    window: { addEventListener: () => {}, requestAnimationFrame: (callback) => callback() },
    Constants: { SNAP_GRID_SIZE: 100 }
});
const LucideIconUtils = loadScriptExport('js/ui/lucide-icon-utils.js', 'LucideIconUtils');
const ZoneCoordinateEditor = loadScriptExport('js/ui/zone-coordinate-editor.js', 'ZoneCoordinateEditor');

function toPlainJson(value) {
    return JSON.parse(JSON.stringify(value));
}

test('Utils.deepClone creates an isolated copy', () => {
    const original = {
        name: 'Zone 1',
        points: [{ x: 10, y: 20 }],
        meta: { visible: true }
    };

    const clone = Utils.deepClone(original);
    clone.points[0].x = 99;
    clone.meta.visible = false;

    assert.equal(original.points[0].x, 10);
    assert.equal(original.meta.visible, true);
});

test('Utils.getFourCCString decodes little-endian DDS identifiers', () => {
    const fourCC = 0x31545844;
    assert.equal(Utils.getFourCCString(fourCC), 'DXT1');
});

test('Utils.formatCoord preserves signed Workbench precision', () => {
    assert.equal(Utils.formatCoord(123.456), '123.46');
    assert.equal(Utils.formatCoord(-5.2), '-5.20');
});

test('CoordinateSystemService matches Enfusion X/Z coordinates', () => {
    const CoordinateSystemService = loadScriptExport(
        'js/services/coordinate-system-service.js',
        'CoordinateSystemService'
    );
    const service = new CoordinateSystemService({ mapHeight: 1000 });

    assert.deepEqual(toPlainJson(service.mapToWorld({ x: 0, y: 0 })), { x: 0, z: 1000 });
    assert.deepEqual(toPlainJson(service.mapToWorld({ x: 250, y: 1000 })), { x: 250, z: 0 });

    service.setSettings({ scale: 2, originX: 100, originZ: -50 });
    assert.deepEqual(toPlainJson(service.mapToWorld({ x: 10, y: 20 })), { x: 120, z: 1910 });
    assert.deepEqual(toPlainJson(service.worldToMap({ x: 120, z: 1910 })), { x: 10, y: 20 });
});

test('ZoneCoordinateEditor pins a circle to exact Workbench X/Z and radius', () => {
    const CoordinateSystemService = loadScriptExport(
        'js/services/coordinate-system-service.js',
        'CoordinateSystemService'
    );
    const service = new CoordinateSystemService({ mapHeight: 4096 });

    const updates = ZoneCoordinateEditor.getMapUpdates('circle', {
        centerX: 1191.721,
        centerZ: 212.598,
        radius: 1000
    }, service);

    assert.deepEqual(toPlainJson(updates), {
        cx: 1191.721,
        cy: 3883.402,
        radius: 1000
    });
    const world = service.transformZone({ shape: 'circle', ...updates });
    assert.equal(world.cx, 1191.721);
    assert.equal(world.cy, 212.59799999999996);
    assert.equal(world.radius, 1000);
});

test('ZoneCoordinateEditor converts exact rectangle and line coordinates into map geometry', () => {
    const CoordinateSystemService = loadScriptExport(
        'js/services/coordinate-system-service.js',
        'CoordinateSystemService'
    );
    const service = new CoordinateSystemService({ mapHeight: 2048 });
    service.setSettings({ scale: 2, originX: 100, originZ: -50 });

    assert.deepEqual(toPlainJson(ZoneCoordinateEditor.getMapUpdates('rectangle', {
        minX: 300,
        minZ: 450,
        width: 1000,
        depth: 500
    }, service)), {
        x: 100,
        y: 1548,
        width: 500,
        height: 250
    });

    assert.deepEqual(toPlainJson(ZoneCoordinateEditor.getMapUpdates('line', {
        startX: 300,
        startZ: 450,
        endX: 500,
        endZ: 650
    }, service)), {
        x1: 100,
        y1: 1798,
        x2: 200,
        y2: 1698
    });
});

test('CalibrationService world-size quick setup derives metres per pixel from terrain dimensions', () => {
    // 6016 x 6016 px image of a 12800 x 12800 m terrain.
    assert.deepEqual(
        toPlainJson(CalibrationService.getWorldSizeSettings(6016, 6016, 12800, 12800)),
        { scale: 12800 / 6016, originX: 0, originZ: 0 }
    );

    // A Workbench corner at (1191.721, 1448.443) must land on the image.
    const CoordinateSystemService = loadScriptExport(
        'js/services/coordinate-system-service.js',
        'CoordinateSystemService'
    );
    const service = new CoordinateSystemService({ mapHeight: 6016 });
    service.setSettings(CalibrationService.getWorldSizeSettings(6016, 6016, 12800, 12800));
    const mapPoint = service.worldToMap({ x: 1191.721, z: 1448.443 });
    assert.equal(mapPoint.x > 0 && mapPoint.x < 6016, true);
    assert.equal(mapPoint.y > 0 && mapPoint.y < 6016, true);

    // Aspect-ratio mismatch is rejected instead of silently skewing the map.
    assert.throws(
        () => CalibrationService.getWorldSizeSettings(6016, 6016, 12800, 6400),
        /aspect ratio/
    );
});

test('CalibrationService saves and restores calibration per map size', () => {
    const store = {};
    const fakeApp = {
        core: { mapWidth: 6016, mapHeight: 6016 },
        coordinateSystem: {
            settings: null,
            setSettings(settings) { this.settings = { ...settings }; return { ...settings }; }
        },
        notificationService: { showToast: () => {}, showAlert: () => {} },
        tabManager: { markActiveTabDirty: () => {} },
        hideExportModal: () => {},
        showExportModal: () => {}
    };
    const elements = {
        worldSizeWidth: { value: '12800' },
        worldSizeDepth: { value: '12800' },
        btnApplyWorldSize: { addEventListener: () => {} },
        btnOpen: { addEventListener: () => {} },
        btnClose: { addEventListener: () => {} },
        btnCancel: { addEventListener: () => {} },
        modal: { classList: { add: () => {}, remove: () => {} } }
    };
    const service = new CalibrationService(fakeApp);
    service.init(elements);
    // Swap in a localStorage-like store.
    service.getStorage = () => store;
    service.getStorageKey = () => 'mapOverlay_map_calibration';

    service.applyWorldSize();

    assert.deepEqual(
        toPlainJson(store['6016x6016']),
        { scale: 12800 / 6016, originX: 0, originZ: 0 }
    );
    assert.equal(service.getSavedCalibration().scale, 12800 / 6016);
    assert.equal(service.restoreSavedCalibration(), true);
    assert.equal(fakeApp.coordinateSystem.settings.scale, 12800 / 6016);
});

test('CanvasCore stores and restores user grid colours', () => {
    const canvas = {
        getContext: () => ({}),
        classList: { add: () => {}, remove: () => {} }
    };
    const container = { getBoundingClientRect: () => ({ width: 800, height: 600 }) };
    const core = new CanvasCore(canvas, container);

    // Defaults match the original yellow grid.
    assert.equal(core.getGridColors().major, 'rgba(255, 230, 109, 0.42)');
    assert.equal(core.getGridColors().minor, 'rgba(255, 230, 109, 0.18)');

    // Custom hex colours convert to translucent rgba for line drawing.
    core.setGridColors({ major: '#00ff88', minor: '#0066ff', label: '#ffffff' });
    assert.equal(core.getGridColors().major, 'rgba(0, 255, 136, 0.5)');
    assert.equal(core.getGridColors().minor, 'rgba(0, 102, 255, 0.28)');
    assert.equal(core.getGridColors().label, 'rgba(255, 255, 255, 0.9)');

    // Invalid values are ignored rather than corrupting the grid.
    core.setGridColors({ major: 'not-a-color' });
    assert.equal(core.getGridColors().major, 'rgba(0, 255, 136, 0.5)');
});

test('CoordinateSystemService transforms rectangle bounds from canvas top-left to Enfusion minimum X/Z', () => {
    const CoordinateSystemService = loadScriptExport(
        'js/services/coordinate-system-service.js',
        'CoordinateSystemService'
    );
    const service = new CoordinateSystemService({ mapHeight: 100 });
    service.setSettings({ scale: 2, originX: 5, originZ: 7 });

    assert.deepEqual(
        toPlainJson(service.transformZone({ x: 10, y: 20, width: 30, height: 40, shape: 'rectangle' })),
        { x: 25, y: 87, width: 60, height: 80, shape: 'rectangle' }
    );
});

test('CoordinateSystemService transforms polygon and line points into Enfusion X/Z', () => {
    const CoordinateSystemService = loadScriptExport(
        'js/services/coordinate-system-service.js',
        'CoordinateSystemService'
    );
    const service = new CoordinateSystemService({ mapHeight: 50 });
    service.setSettings({ scale: 10, originX: 100, originZ: 500 });

    const polygon = service.transformZone({
        shape: 'polygon',
        points: [
            { x: 1, y: 2 },
            { x: 3, y: 4 }
        ]
    });
    assert.deepEqual(toPlainJson(polygon.points), [
        { x: 110, y: 980 },
        { x: 130, y: 960 }
    ]);

    const line = service.transformZone({ shape: 'line', x1: 2, y1: 5, x2: 4, y2: 10 });
    assert.deepEqual(toPlainJson(line), {
        shape: 'line',
        x1: 120,
        y1: 950,
        x2: 140,
        y2: 900
    });
});

test('CoordinateSystemService calibrates a north-up Enfusion map from two references', () => {
    const CoordinateSystemService = loadScriptExport(
        'js/services/coordinate-system-service.js',
        'CoordinateSystemService'
    );
    const service = new CoordinateSystemService({ mapHeight: 1000 });

    const settings = service.calibrate(
        { x: 100, y: 900 },
        { x: 1200, z: 2200 },
        { x: 600, y: 400 },
        { x: 2200, z: 3200 }
    );

    assert.deepEqual(toPlainJson(settings), { scale: 2, originX: 1000, originZ: 2000 });
});

test('ExportHandler delegates all zone geometry to the Enfusion coordinate system', () => {
    const zones = [{ id: 'zone-a', shape: 'circle', cx: 10, cy: 20, radius: 5 }];
    const transformed = [{ id: 'zone-a', shape: 'circle', cx: 110, cy: 980, radius: 50 }];
    const calls = [];
    const handler = new ExportHandler(
        null,
        { getZones: () => zones },
        null,
        null,
        null,
        { transformZone: zone => { calls.push(zone); return transformed[0]; } }
    );
    handler.exportJSON = exported => calls.push(exported);

    handler.export('json');

    assert.equal(calls[0], zones[0]);
    assert.deepEqual(toPlainJson(calls[1]), transformed);
});

test('ScriptGenerator emits exact Enfusion X/Z corners for rectangles', () => {
    const script = ScriptGenerator.generateEnfusionManager([
        {
            name: 'Exact Box',
            profileId: 'custom',
            shape: 'rectangle',
            color: '#00ff88',
            opacity: 0.4,
            x: 100,
            y: 200,
            width: 30,
            height: 40
        }
    ], value => value, () => 0, value => value);

    assert.match(script, /Vector\(100\.00, 0, 200\.00\)/);
    assert.match(script, /Vector\(130\.00, 0, 200\.00\)/);
    assert.match(script, /Vector\(130\.00, 0, 240\.00\)/);
    assert.match(script, /Vector\(100\.00, 0, 240\.00\)/);
});

test('CanvasCore switches between 1 km and 100 m Reforger grid levels by zoom', () => {
    const canvas = {
        getContext: () => ({}),
        classList: { add: () => {}, remove: () => {} }
    };
    const container = { getBoundingClientRect: () => ({ width: 800, height: 600 }) };
    const core = new CanvasCore(canvas, container);
    const CoordinateSystemService = loadScriptExport(
        'js/services/coordinate-system-service.js',
        'CoordinateSystemService'
    );
    core.mapHeight = 1000;
    core.coordinateSystem = new CoordinateSystemService(core);
    core.coordinateSystem.setSettings({ scale: 1, originX: 0, originZ: 0 });

    core.zoom = 0.05;
    assert.equal(core.getVisibleGridSize(), 1000);
    core.snapEnabled = true;
    assert.deepEqual(toPlainJson(core.snapToGrid({ x: 440, y: 560 })), { x: 0, y: 1000 });

    core.zoom = 0.2;
    assert.equal(core.getVisibleGridSize(), 100);
});

test('CanvasCore snaps map points on the Enfusion world grid', () => {
    const canvas = {
        getContext: () => ({}),
        classList: { add: () => {}, remove: () => {} }
    };
    const container = { getBoundingClientRect: () => ({ width: 800, height: 600 }) };
    const core = new CanvasCore(canvas, container);
    const CoordinateSystemService = loadScriptExport(
        'js/services/coordinate-system-service.js',
        'CoordinateSystemService'
    );
    core.mapHeight = 100;
    core.coordinateSystem = new CoordinateSystemService(core);
    core.coordinateSystem.setSettings({ scale: 2, originX: 5, originZ: 7 });
    core.snapEnabled = true;

    assert.deepEqual(toPlainJson(core.snapToGrid({ x: 48, y: 57 })), { x: 47.5, y: 53.5 });
});

test('CanvasCore grid visibility is controlled independently from snap to grid', () => {
    let gridDraws = 0;
    const context = {
        clearRect: () => {}, save: () => {}, restore: () => {},
        translate: () => {}, scale: () => {}, drawImage: () => {}
    };
    const canvas = {
        width: 800,
        height: 600,
        getContext: () => context,
        classList: { add: () => {}, remove: () => {} }
    };
    const container = { getBoundingClientRect: () => ({ width: 800, height: 600 }) };
    const core = new CanvasCore(canvas, container);
    core.mapImage = { width: 1000, height: 1000 };
    core.drawGrid = () => { gridDraws++; };

    core.gridEnabled = true;
    core.snapEnabled = false;
    core.renderBase();
    assert.equal(gridDraws, 1, 'enabled grid must draw even when snapping is off');

    core.gridEnabled = false;
    core.snapEnabled = true;
    core.renderBase();
    assert.equal(gridDraws, 1, 'snap must not force the visual grid on');
});

test('CanvasCore applies a user-defined grid spacing to display and snapping', () => {
    const canvas = {
        getContext: () => ({}),
        classList: { add: () => {}, remove: () => {} }
    };
    const container = { getBoundingClientRect: () => ({ width: 800, height: 600 }) };
    const core = new CanvasCore(canvas, container);
    const CoordinateSystemService = loadScriptExport(
        'js/services/coordinate-system-service.js',
        'CoordinateSystemService'
    );
    core.mapHeight = 2000;
    core.coordinateSystem = new CoordinateSystemService(core);
    core.coordinateSystem.setSettings({ scale: 1, originX: 0, originZ: 0 });
    core.zoom = 0.2;
    core.setGridSize(250);
    core.snapEnabled = true;

    assert.equal(core.getVisibleGridSize(), 250);
    assert.deepEqual(toPlainJson(core.snapToGrid({ x: 360, y: 1640 })), { x: 250, y: 1750 });
});

test('LayerOrderService treats legacy overlays as above legacy zones', () => {
    const zones = [{ id: 'zone-a' }, { id: 'zone-b' }];
    const overlays = [{ id: 'overlay-a' }];
    const service = new LayerOrderService(
        {
            getZones: () => zones,
            saveToStorage: () => {}
        },
        {
            getOverlays: () => overlays,
            saveToStorage: () => {}
        },
        () => {}
    );

    assert.deepEqual(toPlainJson(service.getLayers({ order: 'bottom-first' }).map(layer => layer.id)), [
        'zone-a',
        'zone-b',
        'overlay-a'
    ]);
    assert.deepEqual(toPlainJson(service.getLayers({ order: 'top-first' }).map(layer => layer.id)), [
        'overlay-a',
        'zone-b',
        'zone-a'
    ]);
});

test('LayerOrderService moves layers across zones and overlays', () => {
    const zones = [{ id: 'zone-a' }, { id: 'zone-b' }];
    const overlays = [{ id: 'overlay-a' }];
    let zonePersistCount = 0;
    let overlayPersistCount = 0;
    let renderCount = 0;
    const service = new LayerOrderService(
        {
            getZones: () => zones,
            saveToStorage: () => { zonePersistCount++; }
        },
        {
            getOverlays: () => overlays,
            saveToStorage: () => { overlayPersistCount++; }
        },
        () => { renderCount++; }
    );

    assert.equal(service.moveLayer('overlay', 'overlay-a', 'down'), true);

    assert.deepEqual(toPlainJson(service.getLayers({ order: 'top-first' }).map(layer => `${layer.kind}:${layer.id}`)), [
        'zone:zone-b',
        'overlay:overlay-a',
        'zone:zone-a'
    ]);
    assert.equal(zonePersistCount > 0, true);
    assert.equal(overlayPersistCount > 0, true);
    assert.equal(renderCount, 1);
});

test('LayerOrderService reorders a dragged layer to a visible top-first index', () => {
    const zones = [{ id: 'zone-a' }, { id: 'zone-b' }];
    const overlays = [{ id: 'overlay-a' }];
    const service = new LayerOrderService(
        {
            getZones: () => zones,
            saveToStorage: () => {}
        },
        {
            getOverlays: () => overlays,
            saveToStorage: () => {}
        },
        () => {}
    );

    assert.equal(service.moveLayerToTopIndex('zone', 'zone-a', 0), true);

    assert.deepEqual(toPlainJson(service.getLayers({ order: 'top-first' }).map(layer => `${layer.kind}:${layer.id}`)), [
        'zone:zone-a',
        'overlay:overlay-a',
        'zone:zone-b'
    ]);
});

test('InspectorLayoutService maps pinned edges to adaptive panel layouts', () => {
    assert.equal(InspectorLayoutService.getModeForEdge('bottom'), 'floating');
    assert.equal(InspectorLayoutService.getModeForEdge('top'), 'floating');
    assert.equal(InspectorLayoutService.getModeForEdge('left'), 'side-panel');
    assert.equal(InspectorLayoutService.getModeForEdge('right'), 'side-panel');
    assert.equal(InspectorLayoutService.getModeForEdge(null), 'floating');
});

test('InspectorLayoutService clamps panel sizes for static layout insets', () => {
    assert.deepEqual(toPlainJson(InspectorLayoutService.getInsetForEdge('right', 420)), {
        top: 0,
        right: 420,
        bottom: 0,
        left: 0
    });
    assert.deepEqual(toPlainJson(InspectorLayoutService.getInsetForEdge('bottom', 420)), {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
    });
    assert.equal(InspectorLayoutService.clampSize('bottom', 900), 392);
    assert.equal(InspectorLayoutService.clampSize('left', 120), 280);
});

test('InspectorLayoutService only reserves inset for visible pinned inspectors', () => {
    assert.equal(InspectorLayoutService.shouldReserveInset({ edge: 'bottom', hidden: false, collapsed: false }), false);
    assert.equal(InspectorLayoutService.shouldReserveInset({ edge: 'bottom', hidden: true, collapsed: false }), false);
    assert.equal(InspectorLayoutService.shouldReserveInset({ edge: 'right', hidden: false, collapsed: true }), false);
    assert.equal(InspectorLayoutService.shouldReserveInset({ edge: 'left', hidden: false, collapsed: false }), true);
    assert.equal(InspectorLayoutService.shouldReserveInset({ edge: null, hidden: false, collapsed: false }), false);
});

test('InspectorLayoutService only allows side pinning', () => {
    assert.equal(InspectorLayoutService.normalizePinnedEdge('left'), 'left');
    assert.equal(InspectorLayoutService.normalizePinnedEdge('right'), 'right');
    assert.equal(InspectorLayoutService.normalizePinnedEdge('bottom'), null);
    assert.equal(InspectorLayoutService.normalizePinnedEdge('top'), null);
});

test('InspectorLayoutService restores a compact floating rect when unpinning a side panel', () => {
    const rect = InspectorLayoutService.getFloatingRestoreRect(
        'right',
        { left: 780, top: 72, width: 420, height: 828 },
        { width: 1200, height: 900 }
    );

    assert.equal(rect.width, 392);
    assert.equal(rect.height, 420);
    assert.equal(rect.left < 780, true);
    assert.equal(rect.top > 64, true);
});

test('InspectorLayoutService toggles accordions as a single-open stack', () => {
    assert.deepEqual(toPlainJson(InspectorLayoutService.getAccordionStates(
        ['border', 'pattern', 'label'],
        'border',
        null
    )), {
        border: true,
        pattern: false,
        label: false
    });

    assert.deepEqual(toPlainJson(InspectorLayoutService.getAccordionStates(
        ['border', 'pattern', 'label'],
        'pattern',
        'border'
    )), {
        border: false,
        pattern: true,
        label: false
    });

    assert.deepEqual(toPlainJson(InspectorLayoutService.getAccordionStates(
        ['border', 'pattern', 'label'],
        'pattern',
        'pattern'
    )), {
        border: false,
        pattern: false,
        label: false
    });
});

test('TabManager renders dirty tab titles with a save marker', () => {
    assert.equal(TabManager.getTabTitleText({ name: 'ArlandRasterize', dirty: false }), 'ArlandRasterize');
    assert.equal(TabManager.getTabTitleText({ name: 'ArlandRasterize', dirty: true }), 'ArlandRasterize *');
});

test('LucideIconUtils hydrates only raw icon placeholders', () => {
    const calls = [];
    const rawIcon = { tagName: 'I', getAttribute: () => 'save' };
    const svgIcon = { tagName: 'svg', getAttribute: () => 'save' };
    const scope = {
        querySelectorAll: () => [rawIcon, svgIcon]
    };
    const lucide = {
        createIcons: (options) => calls.push(options)
    };

    assert.equal(LucideIconUtils.hydrate(scope, lucide), true);
    assert.equal(calls.length, 1);
    assert.equal(Array.isArray(calls[0].icons), false);
    assert.equal(calls[0].nameAttr, 'data-lucide');
});

test('TabManager tab controls use inline svg icons without lucide hydration', () => {
    const closeIcon = TabManager.getTabIconSvg('close');
    const plusIcon = TabManager.getTabIconSvg('plus');

    assert.equal(closeIcon.includes('<svg'), true);
    assert.equal(plusIcon.includes('<svg'), true);
    assert.equal(closeIcon.includes('data-lucide'), false);
    assert.equal(plusIcon.includes('data-lucide'), false);
});

test('TabManager tab action buttons use css-drawn control icons', () => {
    const closeIcon = TabManager.getTabControlIconMarkup('close');
    const plusIcon = TabManager.getTabControlIconMarkup('plus');

    assert.equal(closeIcon.includes('tab-control-icon-close'), true);
    assert.equal(plusIcon.includes('tab-control-icon-plus'), true);
    assert.equal(closeIcon.includes('<svg'), false);
    assert.equal(plusIcon.includes('data-lucide'), false);
});

test('FileHandler asks to persist uploaded and converted map files', () => {
    assert.equal(FileHandler.shouldOfferMapPersistence({ name: 'custom-map.png' }, { source: 'upload' }), true);
    assert.equal(FileHandler.shouldOfferMapPersistence({ name: 'terrain.edds' }, { source: 'conversion' }), true);
    assert.equal(FileHandler.shouldOfferMapPersistence({ name: 'Arland.png' }, { source: 'library' }), false);
});

test('FileHandler stores converted texture maps as png library assets', () => {
    assert.equal(FileHandler.getPersistentMapFileName('world_texture.edds', { converted: true }), 'world_texture.png');
    assert.equal(FileHandler.getPersistentMapFileName('world_texture.dds', { converted: true }), 'world_texture.png');
    assert.equal(FileHandler.getPersistentMapFileName('uploaded-map.jpeg'), 'uploaded-map.jpeg');
});

test('FileHandler detects stale main-process save handlers and upload fallback eligibility', () => {
    assert.equal(FileHandler.isMissingIpcHandlerError(new Error("Error invoking remote method 'save-map-asset-data-url': Error: No handler registered for 'save-map-asset-data-url'")), true);
    assert.equal(FileHandler.canUsePathImportFallback({ path: 'C:\\Maps\\custom.png' }, { source: 'upload' }), true);
    assert.equal(FileHandler.canUsePathImportFallback({ path: 'C:\\Maps\\terrain.dds' }, { source: 'conversion', converted: true }), false);
    assert.equal(FileHandler.canUsePathImportFallback({ name: 'custom.png' }, { source: 'upload' }), false);
});

test('FileHandler treats drops on the upload prompt as new maps, not overlays', () => {
    assert.equal(FileHandler.shouldLoadDroppedFileAsMap({ extension: 'png', hasMap: true, uploadPromptVisible: true }), true);
    assert.equal(FileHandler.shouldLoadDroppedFileAsMap({ extension: 'png', hasMap: true, uploadPromptVisible: false }), false);
    assert.equal(FileHandler.shouldLoadDroppedFileAsMap({ extension: 'dds', hasMap: true, uploadPromptVisible: false }), true);
    assert.equal(FileHandler.shouldLoadDroppedFileAsMap({ extension: 'png', hasMap: false, uploadPromptVisible: false }), true);
});

test('MapBrowserUI appends saved custom maps after catalog maps', () => {
    const extras = MapBrowserUI.getCustomInstalledAssets(
        [{ file: 'official.png' }],
        [
            { file: 'custom.png', name: 'Custom' },
            { file: 'official.png', name: 'Official' }
        ]
    );

    assert.deepEqual(toPlainJson(extras), [{ file: 'custom.png', name: 'Custom' }]);
});

test('MapBrowserUI only allows permanent delete for user-saved custom maps', () => {
    assert.equal(MapBrowserUI.canDeleteCustomAsset({ file: 'uploaded.png', source: 'user' }), true);
    assert.equal(MapBrowserUI.canDeleteCustomAsset({ file: 'bundled-extra.png', source: 'bundled' }), false);
    assert.equal(MapBrowserUI.canDeleteCustomAsset({ file: 'unknown.png' }), false);
});

test('MapBrowserUI uses permanent delete copy for uploaded maps', () => {
    const message = MapBrowserUI.getDeleteConfirmationMessage({ name: 'RUS (4)', file: 'RUS (4).png' }, { permanent: true });
    assert.equal(message.includes('Permanently delete RUS (4)'), true);
    assert.equal(message.includes('future use'), true);
});

test('toolbar buttons suppress the native persistent focus ring', () => {
    const layoutCss = fs.readFileSync(path.join(__dirname, '..', 'css/layout.css'), 'utf8');
    assert.match(layoutCss, /\.tool-btn:focus[\s\S]*outline:\s*none/);
    assert.match(layoutCss, /\.tool-btn\.active/);
});

test('MapBrowserUI uses compact icon tokens with designed tooltip content', () => {
    assert.deepEqual(toPlainJson(MapBrowserUI.describeCatalogStatus({ installed: true })), {
        state: 'installed',
        icon: 'check',
        text: '',
        tooltipTitle: 'Map installed',
        tooltip: 'Stored locally and ready to open.',
        tooltipTone: 'success'
    });
    assert.deepEqual(toPlainJson(MapBrowserUI.describeCalibrationToken({
        calibration: { status: 'verified', scale: 2, worldWidth: 12032, worldDepth: 12032 }
    })), {
        state: 'verified',
        icon: 'crosshair',
        tooltipTitle: 'Calibration ready',
        tooltip: 'Officially calibrated: 12 km square terrain at 2 m per pixel. Coordinates and exports are ready to use.',
        tooltipTone: 'success'
    });
    assert.deepEqual(toPlainJson(MapBrowserUI.describeCalibrationToken({
        calibration: { status: 'unverified' }
    })), {
        state: 'unverified',
        icon: 'crosshair',
        tooltipTitle: 'Calibration required',
        tooltip: 'Open Map Calibration and enter the terrain size. ARMOZE will remember it for this map.',
        tooltipTone: 'attention'
    });
});

test('MapTokenTooltip positions beside the token and flips at the viewport edge', () => {
    assert.deepEqual(toPlainJson(MapTokenTooltip.getPosition(
        { left: 20, right: 44, top: 30, bottom: 54, width: 24, height: 24 },
        { width: 260, height: 90 },
        { width: 900, height: 600 }
    )), { left: 54, top: 30, placement: 'right' });

    assert.deepEqual(toPlainJson(MapTokenTooltip.getPosition(
        { left: 760, right: 784, top: 560, bottom: 584, width: 24, height: 24 },
        { width: 260, height: 90 },
        { width: 900, height: 600 }
    )), { left: 490, top: 498, placement: 'left' });
});

test('map token tooltips replace native title notifications and load before the map browser', () => {
    const browserSource = fs.readFileSync(path.join(__dirname, '..', 'js/ui/map-browser-ui.js'), 'utf8');
    const indexSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const tooltipIndex = indexSource.indexOf('js/ui/map-token-tooltip.js');
    const browserIndex = indexSource.indexOf('js/ui/map-browser-ui.js');

    assert.equal(tooltipIndex >= 0, true);
    assert.equal(browserIndex > tooltipIndex, true);
    assert.match(browserSource, /tokenTooltip\?\.attach/);
    assert.doesNotMatch(browserSource, /badge\.title\s*=\s*.*tooltip/);
});

test('MapBrowserUI keeps size and download progress legible without verbose status labels', () => {
    assert.deepEqual(toPlainJson(MapBrowserUI.describeCatalogStatus({ sizeLabel: '2.8 MB' })), {
        state: 'available',
        icon: null,
        text: '2.8 MB',
        tooltipTitle: 'Download map',
        tooltip: '2.8 MB download',
        tooltipTone: 'neutral'
    });
    assert.deepEqual(toPlainJson(MapBrowserUI.describeCatalogStatus({ downloading: true, percent: 37 })), {
        state: 'downloading',
        icon: null,
        text: '37%',
        tooltipTitle: 'Downloading map',
        tooltip: '37% complete',
        tooltipTone: 'accent'
    });
});

test('CanvasCore clearMap resets loaded-map state after the last tab closes', () => {
    let renderCount = 0;
    const canvas = {
        width: 0,
        height: 0,
        classList: { add: () => {}, remove: () => {} },
        getContext: () => ({ clearRect: () => {} })
    };
    const container = { getBoundingClientRect: () => ({ width: 800, height: 600 }) };
    const core = new CanvasCore(canvas, container);
    core.onRender = () => { renderCount++; };
    core.mapImage = { width: 1024, height: 1024 };
    core.mapWidth = 1024;
    core.mapHeight = 1024;
    core.zoom = 0.5;
    core.panX = 20;
    core.panY = 30;

    core.clearMap();

    assert.equal(core.mapImage, null);
    assert.equal(core.mapWidth, 0);
    assert.equal(core.mapHeight, 0);
    assert.equal(core.zoom, 1);
    assert.equal(core.panX, 0);
    assert.equal(core.panY, 0);
    assert.equal(renderCount > 0, true);
});
