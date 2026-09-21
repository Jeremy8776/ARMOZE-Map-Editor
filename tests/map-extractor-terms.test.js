const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadMapExtractorUI() {
    const sourcePath = path.join(__dirname, '..', 'js', 'ui', 'map-extractor-ui.js');
    const source = fs.readFileSync(sourcePath, 'utf8');
    const context = {
        module: { exports: {} },
        exports: {},
        console,
        window: {},
        localStorage: {}
    };

    vm.runInNewContext(`${source}\nmodule.exports = MapExtractorUI;`, context, {
        filename: sourcePath
    });

    return context.module.exports;
}

function loadMapExtractorView() {
    const sourcePath = path.join(__dirname, '..', 'js', 'ui', 'map-extractor-view.js');
    const source = fs.readFileSync(sourcePath, 'utf8');
    const context = {
        module: { exports: {} },
        exports: {},
        console,
        window: {}
    };

    vm.runInNewContext(`${source}\nmodule.exports = MapExtractorView;`, context, {
        filename: sourcePath
    });

    return context.module.exports;
}

function createStorage() {
    const values = new Map();
    return {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value))
    };
}

const MapExtractorUI = loadMapExtractorUI();
const MapExtractorView = loadMapExtractorView();

test('extractor terms use the current liability acknowledgement version', () => {
    assert.equal(MapExtractorUI.getTermsVersion(), '2026-09-21-v2');
});

test('extractor terms state no warranty, no provider indemnity, user indemnity, and lawful liability limits', () => {
    const markup = MapExtractorView.buildTermsModalMarkup();

    assert.match(markup, /provided as-is/i);
    assert.match(markup, /does not indemnify/i);
    assert.match(markup, /indemnify and hold harmless ARMOZE/i);
    assert.match(markup, /liability that cannot lawfully be excluded/i);
});

test('extractor terms modal keeps header and actions fixed while the body scrolls', () => {
    const cssPath = path.join(__dirname, '..', 'css', 'extractor-terms.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.match(css, /\.extractor-terms-modal\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s);
    assert.match(css, /\.extractor-terms-body\s*\{[^}]*flex:\s*1\s+1\s+auto;[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;/s);
    assert.match(css, /\.extractor-terms-modal\s+\.modal-header,[\s\S]*\.extractor-terms-actions\s*\{[^}]*flex:\s*0\s+0\s+auto;/s);
});

test('opening extractor terms starts at the top without focus scrolling the body', () => {
    const sourcePath = path.join(__dirname, '..', 'js', 'ui', 'map-extractor-ui.js');
    const source = fs.readFileSync(sourcePath, 'utf8');

    assert.match(source, /termsBody\.scrollTop\s*=\s*0;/);
    assert.match(source, /closeButton\?\.focus\(\{\s*preventScroll:\s*true\s*\}\)/);
    assert.doesNotMatch(source, /setTimeout\(\(\)\s*=>\s*checkbox\?\.focus\(\)/);
});

test('extractor terms remain gated until the current terms version is accepted', () => {
    const storage = createStorage();

    assert.equal(MapExtractorUI.hasAcceptedTerms(storage), false);

    MapExtractorUI.recordTermsAcceptance(storage);

    assert.equal(MapExtractorUI.hasAcceptedTerms(storage), true);
});

test('an acknowledgement for an older extractor terms version is rejected', () => {
    const storage = createStorage();
    storage.setItem(MapExtractorUI.getTermsStorageKey(), 'outdated-version');

    assert.equal(MapExtractorUI.hasAcceptedTerms(storage), false);
});
