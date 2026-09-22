const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('the frameless window ships themed window controls', () => {
    const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
    const preload = fs.readFileSync(path.join(root, 'preload.js'), 'utf8');
    const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
    const controls = fs.readFileSync(path.join(root, 'js/ui/window-controls.js'), 'utf8');
    const layout = fs.readFileSync(path.join(root, 'css/layout.css'), 'utf8');

    // Frameless window with the custom controls replacing native chrome.
    assert.match(main, /frame:\s*false/);
    assert.match(main, /window-is-maximized/);

    // Preload exposes the three window actions plus maximized state.
    assert.match(preload, /windowMinimize/);
    assert.match(preload, /windowMaximize/);
    assert.match(preload, /windowClose/);
    assert.match(preload, /windowIsMaximized/);

    // Renderer wiring: script tag, construction, init, and state sync.
    assert.match(index, /js\/ui\/window-controls\.js/);
    assert.match(app, /new WindowControls/);
    assert.match(app, /windowControls\.init\(\)/);
    assert.match(app, /syncMaximizeState\(state\)/);
    assert.match(controls, /window-control--close/);
    assert.match(controls, /window-control-restore-glyph/);

    // The header drags the window; the controls stay clickable.
    assert.match(layout, /-webkit-app-region:\s*drag/);
    assert.match(layout, /\.window-controls[\s\S]*no-drag/);
    assert.match(layout, /\.window-control--close:hover[\s\S]*rgba\(232, 17, 35/);
});