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
