const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('design sweep replaces native title bubbles with the ARMOZE tooltip surface', () => {
    const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
    const tooltip = fs.readFileSync(path.join(root, 'js/ui/themed-tooltip.js'), 'utf8');
    const controls = fs.readFileSync(path.join(root, 'css/controls.css'), 'utf8');

    assert.match(index, /js\/ui\/themed-tooltip\.js/);
    assert.match(app, /new ThemedTooltip/);
    assert.match(app, /themedTooltip\.init\(\)/);
    assert.match(tooltip, /removeAttribute\(['"]title['"]\)/);
    assert.match(controls, /\.themed-tooltip/);
});

test('design sweep contains no broad transition-all declarations', () => {
    const cssFiles = [
        ...fs.readdirSync(path.join(root, 'css')).filter(name => name.endsWith('.css')).map(name => path.join(root, 'css', name)),
        path.join(root, 'index.css')
    ];
    const offenders = cssFiles.filter(file => /transition\s*:\s*all\b/i.test(fs.readFileSync(file, 'utf8')));
    assert.deepEqual(offenders, []);
});
