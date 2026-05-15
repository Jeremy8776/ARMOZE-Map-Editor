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
const LayerOrderService = loadScriptExport('js/services/layer-order-service.js', 'LayerOrderService');
const InspectorLayoutService = loadScriptExport('js/services/inspector-layout-service.js', 'InspectorLayoutService');
const TabManager = loadScriptExport('js/ui/tab-manager.js', 'TabManager', { window: {} });
const FileHandler = loadScriptExport('js/services/file-handler.js', 'FileHandler');
const MapBrowserUI = loadScriptExport('js/ui/map-browser-ui.js', 'MapBrowserUI', { window: {}, btoa: (value) => Buffer.from(value).toString('base64') });
const CanvasCore = loadScriptExport('js/core/canvas-core.js', 'CanvasCore', {
    window: { addEventListener: () => {}, requestAnimationFrame: (callback) => callback() },
    Constants: { SNAP_GRID_SIZE: 100 }
});
const LucideIconUtils = loadScriptExport('js/ui/lucide-icon-utils.js', 'LucideIconUtils');

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

test('ExportHandler.transformZone scales and offsets rectangles', () => {
    const handler = new ExportHandler(null, null, null, null, null);
    const transformed = handler.transformZone(
        { x: 10, y: 20, width: 30, height: 40, shape: 'rectangle' },
        2,
        5,
        7,
        false
    );

    assert.deepEqual(
        toPlainJson(transformed),
        { x: 25, y: 47, width: 60, height: 80, shape: 'rectangle' }
    );
});

test('ExportHandler.transformZone inverts Y coordinates for polygons', () => {
    const handler = new ExportHandler(null, null, null, null, null);
    const transformed = handler.transformZone(
        {
            shape: 'polygon',
            points: [
                { x: 1, y: 2 },
                { x: 3, y: 4 }
            ]
        },
        10,
        100,
        500,
        true
    );

    assert.deepEqual(toPlainJson(transformed.points), [
        { x: 110, y: 480 },
        { x: 130, y: 460 }
    ]);
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
