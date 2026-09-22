const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadPicker() {
    const source = fs.readFileSync(path.join(__dirname, '..', 'js/ui/themed-color-picker.js'), 'utf8');
    const context = { module: { exports: {} }, window: {}, console };
    vm.runInNewContext(`${source}\nmodule.exports = ThemedColorPicker;`, context);
    return context.module.exports;
}

test('ThemedColorPicker converts between ARMOZE hex and HSV values', () => {
    const ThemedColorPicker = loadPicker();
    const hsv = ThemedColorPicker.hexToHsv('#00ff88');
    assert.equal(Math.round(hsv.h), 152);
    assert.equal(hsv.s, 1);
    assert.equal(hsv.v, 1);
    assert.equal(ThemedColorPicker.hsvToHex(hsv), '#00ff88');
    assert.equal(ThemedColorPicker.normalizeHex('#f08'), '#ff0088');
});

test('ThemedColorPicker clamps RGB field values into a valid hex colour', () => {
    const ThemedColorPicker = loadPicker();
    assert.equal(ThemedColorPicker.rgbToHex({ r: 300, g: -20, b: 90 }), '#ff005a');
    assert.deepEqual(JSON.parse(JSON.stringify(ThemedColorPicker.hexToRgb('#7b2cff'))), {
        r: 123,
        g: 44,
        b: 255
    });
});

test('the themed picker replaces native colour popovers and number spinners', () => {
    const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const app = fs.readFileSync(path.join(__dirname, '..', 'js/app.js'), 'utf8');
    const css = fs.readFileSync(path.join(__dirname, '..', 'css/color-picker.css'), 'utf8');

    assert.match(index, /css\/color-picker\.css/);
    assert.match(index, /js\/ui\/themed-color-picker\.js/);
    assert.match(app, /new ThemedColorPicker/);
    assert.match(app, /themedColorPicker\.init\(\)/);
    assert.match(css, /input\[type="number"\]::-webkit-inner-spin-button/);
    assert.match(css, /\.themed-color-picker/);
});
