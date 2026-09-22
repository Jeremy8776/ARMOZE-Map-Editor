const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadGridSettingsService() {
    const source = fs.readFileSync(path.join(__dirname, '..', 'js/services/grid-settings-service.js'), 'utf8');
    const context = { module: { exports: {} }, console, window: {}, document: { getElementById: () => null } };
    vm.runInNewContext(`${source}\nmodule.exports = GridSettingsService;`, context);
    return context.module.exports;
}

test('GridSettingsService normalizes independent display and snap settings', () => {
    const GridSettingsService = loadGridSettingsService();
    assert.deepEqual(JSON.parse(JSON.stringify(GridSettingsService.normalizeSettings({
        enabled: true,
        snapEnabled: false,
        gridSize: '250',
        majorColor: '#112233',
        minorColor: '#445566',
        labelColor: '#778899'
    }))), {
        enabled: true,
        snapEnabled: false,
        gridSize: 250,
        majorColor: '#112233',
        minorColor: '#445566',
        labelColor: '#778899'
    });
});

test('GridSettingsService applies grid visibility, spacing, snapping and colours separately', () => {
    const GridSettingsService = loadGridSettingsService();
    const calls = [];
    const app = {
        core: {
            setGridEnabled: value => calls.push(['grid', value]),
            setSnapEnabled: value => calls.push(['snap', value]),
            setGridSize: value => calls.push(['size', value]),
            setGridColors: (value, options) => calls.push(['colors', value, options]),
            requestRender: () => calls.push(['render'])
        },
        elements: { btnOpenGridSettings: { classList: { toggle: () => {} }, title: '' } }
    };
    const service = new GridSettingsService(app);
    service.applySettings({
        enabled: true,
        snapEnabled: false,
        gridSize: 500,
        majorColor: '#123456',
        minorColor: '#234567',
        labelColor: '#345678'
    }, { persist: false, sync: false });

    assert.deepEqual(JSON.parse(JSON.stringify(calls.slice(0, 4))), [
        ['grid', true],
        ['snap', false],
        ['size', 500],
        ['colors', { major: '#123456', minor: '#234567', label: '#345678' }, { persist: false }]
    ]);
});

test('grid settings have a dedicated modal and are no longer calibration controls', () => {
    const template = fs.readFileSync(path.join(__dirname, '..', 'js/ui/ui-templates.js'), 'utf8');
    const calibrationBlock = (template.split('CALIBRATION_MODAL:')[1] || '').split('GRID_SETTINGS_MODAL:')[0];
    const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

    assert.match(template, /GRID_SETTINGS_MODAL/);
    assert.match(template, /id="gridEnabled"/);
    assert.match(template, /id="gridSnapEnabled"/);
    assert.match(template, /id="gridSize"/);
    assert.doesNotMatch(calibrationBlock, /gridMajorColor|gridMinorColor|gridLabelColor/);
    assert.match(index, /grid-settings-service\.js/);
    assert.match(index, /UITemplates\.GRID_SETTINGS_MODAL/);
});
