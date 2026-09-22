/**
 * Official (pre-baked) map calibration tests.
 *
 * The rules that matter to users: an official calibration seeds a map that has
 * never been calibrated, a user's own calibration is never overwritten, and a
 * mismatched image never silently receives the wrong scale.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadScriptExport(relativePath, exportName, extraContext = {}) {
    const absolutePath = path.join(__dirname, '..', relativePath);
    const source = fs.readFileSync(absolutePath, 'utf8');
    const context = { module: { exports: {} }, exports: {}, require, console, window: {}, ...extraContext };
    vm.runInNewContext(`${source}\nmodule.exports = ${exportName};`, context, { filename: absolutePath });
    return context.module.exports;
}

const OfficialCalibrationService = loadScriptExport(
    'js/services/official-calibration-service.js',
    'OfficialCalibrationService'
);
const ExportHandler = loadScriptExport('js/export-handler.js', 'ExportHandler', {
    ScriptGenerator: {}, UTIF: {}, Utils: {}
});

const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'Maps', 'catalog.json'), 'utf8'));

const BELLEAU = {
    id: 'belleau-wood',
    name: 'Belleau Wood',
    file: 'Belleau.png',
    calibration: {
        status: 'verified',
        imageWidth: 6016, imageHeight: 6016,
        worldWidth: 12032, worldDepth: 12032,
        scale: 2, originX: 0, originZ: 0
    }
};
const UNCALIBRATED = { id: 'uk', name: 'UK', file: 'UK.png', calibration: { status: 'unverified' } };

function makeService(entries = [BELLEAU, UNCALIBRATED]) {
    const service = new OfficialCalibrationService({});
    service.setCatalog({ maps: entries });
    return service;
}

test('shipped catalog is valid and every entry declares a calibration status', () => {
    assert.ok(Array.isArray(catalog.maps) && catalog.maps.length > 0);
    for (const entry of catalog.maps) {
        assert.ok(entry.calibration, `${entry.id} has no calibration block`);
        assert.ok(
            ['verified', 'unverified'].includes(entry.calibration.status),
            `${entry.id} has an unknown calibration status`
        );
        if (entry.calibration.status === 'verified') {
            const { scale, imageWidth, imageHeight, worldWidth, worldDepth } = entry.calibration;
            assert.ok(scale > 0, `${entry.id} verified but has no usable scale`);
            // A verified entry must be internally consistent, or the badge
            // would claim an accuracy the numbers do not support.
            assert.equal(Number((worldWidth / imageWidth).toFixed(6)), Number(scale.toFixed(6)),
                `${entry.id}: worldWidth/imageWidth does not equal the declared scale`);
            assert.equal(Number((worldDepth / imageHeight).toFixed(6)), Number(scale.toFixed(6)),
                `${entry.id}: worldDepth/imageHeight does not equal the declared scale`);
        }
    }
});

test('Belleau Wood ships calibrated at 2 m per pixel', () => {
    const entry = catalog.maps.find(map => map.id === 'belleau-wood');
    assert.ok(entry, 'Belleau Wood must be in the catalog');
    assert.equal(entry.calibration.status, 'verified');
    assert.equal(entry.calibration.scale, 2);
    assert.equal(entry.calibration.imageWidth, 6016);
    assert.equal(entry.calibration.worldWidth, 12032);
    assert.ok(fs.existsSync(path.join(__dirname, '..', entry.thumbnail)), 'thumbnail must be bundled');
});

test('describe() reports a verified map with its terrain size and scale', () => {
    const info = OfficialCalibrationService.describe(BELLEAU);
    assert.equal(info.status, 'verified');
    assert.equal(info.verified, true);
    assert.equal(info.label, 'Calibrated');
    assert.match(info.tooltip, /12 km square/);
    assert.match(info.tooltip, /2 m per pixel/);
});

test('describe() reports an uncalibrated map without claiming accuracy', () => {
    for (const entry of [UNCALIBRATED, {}, null]) {
        const info = OfficialCalibrationService.describe(entry);
        assert.equal(info.verified, false);
        assert.equal(info.label, 'Not calibrated');
        assert.match(info.tooltip, /Calibrate/);
        assert.doesNotMatch(info.tooltip, /per pixel/);
    }
});

test('a verified entry seeds a map that has never been calibrated', () => {
    const settings = makeService().resolveSettings('Belleau.png', 6016, 6016, { hasUserCalibration: false });
    // Spread into this realm: vm-context objects carry a foreign prototype.
    assert.deepEqual({ ...settings }, { scale: 2, originX: 0, originZ: 0 });
});

test("a user's own calibration is never overwritten by the official one", () => {
    const settings = makeService().resolveSettings('Belleau.png', 6016, 6016, { hasUserCalibration: true });
    assert.equal(settings, null);
});

test('an image whose dimensions disagree with the catalog is left alone', () => {
    // A re-export at a different resolution must not inherit 2 m/px.
    const settings = makeService().resolveSettings('Belleau.png', 4096, 4096, { hasUserCalibration: false });
    assert.equal(settings, null);
});

test('unverified and unknown maps yield no settings', () => {
    const service = makeService();
    assert.equal(service.resolveSettings('UK.png', 4096, 4096, {}), null);
    assert.equal(service.resolveSettings('SomeRandomMap.png', 6016, 6016, {}), null);
    assert.equal(service.resolveSettings(null, 6016, 6016, {}), null);
});

test('catalog lookup ignores path and case differences', () => {
    const service = makeService();
    assert.ok(service.findByFile('Belleau.png'));
    assert.ok(service.findByFile('belleau.png'));
    assert.ok(service.findByFile('C:/Users/x/AppData/Roaming/ARMOZE/Maps/Belleau.png'));
    assert.equal(service.findByFile('Everon.png'), null, 'entries not in this catalog must not match');
});

test('applyForLoadedMap writes the official calibration through to both services', () => {
    const applied = [];
    const saved = [];
    const service = new OfficialCalibrationService({
        core: { mapWidth: 6016, mapHeight: 6016 },
        coordinateSystem: { setSettings: (s) => applied.push(s) },
        calibrationService: { getSavedCalibration: () => null, saveCalibration: (s) => saved.push(s) },
        notificationService: { showToast: () => {} }
    });
    service.setCatalog({ maps: [BELLEAU] });

    assert.equal(service.applyForLoadedMap('Belleau.png'), true);
    assert.deepEqual(applied.map(s => ({ ...s })), [{ scale: 2, originX: 0, originZ: 0 }]);
    assert.deepEqual(saved.map(s => ({ ...s })), [{ scale: 2, originX: 0, originZ: 0 }]);
});

test('applyForLoadedMap does nothing when the user already calibrated the map', () => {
    let touched = false;
    const service = new OfficialCalibrationService({
        core: { mapWidth: 6016, mapHeight: 6016 },
        coordinateSystem: { setSettings: () => { touched = true; } },
        calibrationService: { getSavedCalibration: () => ({ scale: 3.5 }), saveCalibration: () => { touched = true; } }
    });
    service.setCatalog({ maps: [BELLEAU] });

    assert.equal(service.applyForLoadedMap('Belleau.png'), false);
    assert.equal(touched, false, "the user's calibration must be left untouched");
});

test('applyForLoadedMap is safe before a map has loaded', () => {
    const service = new OfficialCalibrationService({ core: {} });
    service.setCatalog({ maps: [BELLEAU] });
    assert.equal(service.applyForLoadedMap('Belleau.png'), false);
});

test('Workbench export is gated as coming soon and never produces a file', () => {
    const alerts = [];
    let generated = false;
    const handler = new ExportHandler(
        {},
        { getZones: () => { generated = true; return [{ name: 'Z', shape: 'circle', cx: 1, cy: 1, radius: 1 }]; } },
        {},
        null,
        { showAlert: (msg, opts) => alerts.push({ msg, opts }) }
    );

    handler.export('workbench');
    assert.equal(generated, false, 'no zone data should be read for a gated format');
    assert.equal(alerts.length, 1);
    assert.match(alerts[0].msg, /still in testing/i);
    assert.equal(alerts[0].opts.title, 'Coming Soon');
    assert.ok(ExportHandler.COMING_SOON_FORMATS.includes('workbench'));
});

test('other export formats are not affected by the coming-soon gate', () => {
    let read = false;
    const handler = new ExportHandler(
        {},
        { getZones: () => { read = true; return []; } },
        {},
        null,
        { showAlert: () => {} }
    );
    handler.export('json');
    assert.equal(read, true, 'JSON export must still run');
});
