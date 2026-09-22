const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadThemedSelect() {
    const source = fs.readFileSync(path.join(__dirname, '..', 'js/ui/themed-select.js'), 'utf8');
    const context = { module: { exports: {} }, window: {}, console };
    vm.runInNewContext(`${source}\nmodule.exports = ThemedSelect;`, context);
    return context.module.exports;
}

test('ThemedSelect keyboard navigation skips disabled options and wraps', () => {
    const ThemedSelect = loadThemedSelect();
    const options = [
        { disabled: false },
        { disabled: true },
        { disabled: false },
        { disabled: false }
    ];

    assert.equal(ThemedSelect.getNextEnabledIndex(options, 0, 1), 2);
    assert.equal(ThemedSelect.getNextEnabledIndex(options, 3, 1), 0);
    assert.equal(ThemedSelect.getNextEnabledIndex(options, 0, -1), 3);
});

test('ThemedSelect typeahead matches visible option labels', () => {
    const ThemedSelect = loadThemedSelect();
    const options = [
        { label: 'Custom (Unsaved)', disabled: false },
        { label: 'BLUFOR', disabled: false },
        { label: 'OPFOR', disabled: false },
        { label: 'Safe Zone', disabled: false }
    ];

    assert.equal(ThemedSelect.findTypeaheadIndex(options, 'bl'), 1);
    assert.equal(ThemedSelect.findTypeaheadIndex(options, 'safe'), 3);
    assert.equal(ThemedSelect.findTypeaheadIndex(options, 'missing'), -1);
});

test('all app dropdowns are routed through the themed select surface', () => {
    const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const app = fs.readFileSync(path.join(__dirname, '..', 'js/app.js'), 'utf8');
    const css = fs.readFileSync(path.join(__dirname, '..', 'css/controls.css'), 'utf8');

    assert.match(index, /css\/controls\.css/);
    assert.match(index, /js\/ui\/themed-select\.js/);
    assert.match(app, /new ThemedSelect/);
    assert.match(app, /themedSelect\.init\(\)/);
    assert.match(css, /\.themed-select__popup/);
    assert.match(css, /\.themed-select__option\.is-selected/);
    assert.match(css, /\.themed-select__native/);
});
