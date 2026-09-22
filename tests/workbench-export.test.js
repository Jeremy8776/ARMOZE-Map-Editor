/**
 * Workbench plugin + EnfusionScript export tests.
 *
 * These assert the STRUCTURE of the generated Enforce source, not just the
 * coordinate maths. The previous generator produced output that could never
 * compile (it called a CreateZone function it never defined, and emitted enum
 * members that were not declared), and the coordinate-only tests passed
 * throughout. Anything asserted here is checkable without Workbench.
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

const WorkbenchPluginGenerator = loadScriptExport(
    'js/services/workbench-plugin-generator.js',
    'WorkbenchPluginGenerator'
);
const ScriptGenerator = loadScriptExport('js/services/script-generator.js', 'ScriptGenerator', {
    WorkbenchPluginGenerator
});
const Utils = loadScriptExport('js/utils.js', 'Utils');
const ExportHandler = loadScriptExport('js/export-handler.js', 'ExportHandler', {
    ScriptGenerator,
    UTIF: {},
    Utils
});

// The app's shipped default profiles (js/ui/zone-profile-manager.js).
const DEFAULT_PROFILE_IDS = ['blufor', 'opfor', 'safe', 'restricted'];

const CIRCLE = { name: 'Red Base', profileId: 'opfor', shape: 'circle', cx: 1200, cy: 3400, radius: 250, color: '#ff0000', opacity: 0.4 };
const RECT = { name: 'Blue Base', profileId: 'blufor', shape: 'rectangle', x: 100, y: 200, width: 400, height: 300, color: '#0066ff', opacity: 0.4 };
const LINE = { name: 'MSR Wolf', profileId: 'safe', shape: 'line', x1: 0, y1: 0, x2: 800, y2: 600, color: '#00ff88', opacity: 1 };
const POLY = { name: 'Patrol Sector', profileId: 'restricted', shape: 'polygon', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], color: '#ff4757', opacity: 0.2 };

/** Collect `Identifier(` call sites from generated Enforce source. */
function calledFunctions(script) {
    const ignored = new Set(['if', 'for', 'foreach', 'while', 'switch', 'return', 'Vector', 'Print', 'super']);
    return [...new Set([...script.matchAll(/(?:^|[\s=!(])([A-Za-z_]\w*)\s*\(/gm)].map(m => m[1]))]
        .filter(name => !ignored.has(name));
}

/** Collect method names defined inside the generated plugin class. */
function definedMethods(script) {
    return [...script.matchAll(/^\t(?:protected\s+|override\s+)*(?:void|bool|int|float|string|vector)\s+(\w+)\s*\(/gm)]
        .map(m => m[1]);
}

test('Workbench plugin defines every function it calls', () => {
    const script = WorkbenchPluginGenerator.generate([CIRCLE, RECT, LINE, POLY]);
    // Print/Vector are engine globals; everything else must be defined here.
    const engineGlobals = new Set(['Print', 'Vector']);
    const defined = new Set([...definedMethods(script), 'Run']);
    // Members invoked on the api/entity objects are qualified (api.X), so the
    // bare call sites must all resolve to methods in this file.
    const bare = [...script.matchAll(/^\t\t\t?(?:if \()?([A-Za-z_]\w*)\(/gm)].map(m => m[1]);
    for (const name of bare) {
        if (engineGlobals.has(name)) continue;
        assert.ok(defined.has(name), `generated plugin calls ${name}() but never defines it`);
    }
    assert.ok(defined.has('CreateZoneTrigger'), 'expected a CreateZoneTrigger helper');
});

test('Workbench plugin only calls documented WorldEditorAPI members', () => {
    // Verified against BohemiaInteractive/Arma-Reforger-Script-Diff:
    // scripts/Core/generated/WorkbenchAPI/WorldEditorAPI.c
    const documented = new Set([
        'BeginEntityAction', 'EndEntityAction', 'UndoOrRedoIsRestoring',
        'GetCurrentEntityLayerId', 'CreateEntity', 'SetVariableValue',
        'CreateObjectArrayVariableMember', 'TryGetTerrainSurfaceY', 'GetApi'
    ]);
    const script = WorkbenchPluginGenerator.generate([CIRCLE, POLY]);
    const apiCalls = [...new Set([...script.matchAll(/\bapi\.(\w+)\s*\(/g)].map(m => m[1]))];
    assert.ok(apiCalls.length > 0, 'expected the plugin to use the WorldEditorAPI');
    for (const call of apiCalls) {
        assert.ok(documented.has(call), `api.${call}() is not a documented WorldEditorAPI member`);
    }
    assert.match(script, /Workbench\.GetModule\(WorldEditor\)/, 'must acquire the API via Workbench.GetModule');
    assert.doesNotMatch(script, /GenericComponent\.GetWorldEditorAPI/, 'GenericComponent.GetWorldEditorAPI is not a real API');
});

test('Workbench plugin places a circle zone at its exact world X/Z and radius', () => {
    const script = WorkbenchPluginGenerator.generate([CIRCLE]);
    assert.match(script, /CreateZoneTrigger\(api, layerId, "Red_Base", 1200\.00, 3400\.00, "250\.00"\)/);
    assert.match(script, /SetVariableValue\(entity, null, "SphereRadius", radius\)/);
});

test('Workbench plugin never emits placeholder geometry for a line zone', () => {
    // Regression: lines have no points and no width/height, so the old
    // generator fell through to a radius-1 zone at the world origin.
    const script = WorkbenchPluginGenerator.generate([LINE]);
    const call = script.match(/CreateZoneTrigger\(api, layerId, "MSR_Wolf", ([-\d.]+), ([-\d.]+), "([\d.]+)"\)/);
    assert.ok(call, 'expected the line zone to be emitted');
    const [, x, z, radius] = call;
    assert.equal(Number(x), 400, 'trigger should sit at the line midpoint X');
    assert.equal(Number(z), 300, 'trigger should sit at the line midpoint Z');
    assert.ok(Number(radius) > 100, `radius ${radius} must enclose the line, not be a placeholder`);
    assert.match(script, /CreateZoneOutline\(api, layerId, "MSR_Wolf_outline"/, 'line must keep its true outline');
});

test('Workbench plugin traces rectangle and polygon outlines through every corner', () => {
    const rect = WorkbenchPluginGenerator.generate([RECT]);
    const outline = rect.match(/CreateZoneOutline\(api, layerId, "Blue_Base_outline", \{ (.+) \}\);/);
    assert.ok(outline, 'rectangle should emit an outline');
    const corners = [...outline[1].matchAll(/\{ ([-\d.]+), ([-\d.]+) \}/g)].map(m => [Number(m[1]), Number(m[2])]);
    assert.equal(corners.length, 5, 'rectangle outline should close back on itself');
    assert.deepEqual(corners[0], [100, 200]);
    assert.deepEqual(corners[2], [500, 500]);

    const poly = WorkbenchPluginGenerator.generate([POLY]);
    const polyOutline = poly.match(/CreateZoneOutline\(api, layerId, "Patrol_Sector_outline", \{ (.+) \}\);/);
    assert.ok(polyOutline, 'polygon should emit an outline');
    assert.equal([...polyOutline[1].matchAll(/\{ /g)].length, 3, 'all polygon points must survive');
});

test('Workbench plugin sanitises zone names into valid Enforce identifiers', () => {
    const script = WorkbenchPluginGenerator.generate([
        { ...CIRCLE, name: 'Base "Alpha" / 1' },
        { ...CIRCLE, name: '2nd Line' },
        { ...CIRCLE, name: '   ' }
    ]);
    const names = [...script.matchAll(/CreateZoneTrigger\(api, layerId, "([^"]*)"/g)].map(m => m[1]);
    for (const name of names) {
        assert.match(name, /^[A-Za-z_]\w*$/, `${name} is not a valid Enforce identifier`);
    }
    assert.ok(names.includes('Base_Alpha_1'));
    assert.ok(names.includes('Zone_2nd_Line'), 'a leading digit must be prefixed');
});

test('Workbench plugin skips zones with no usable geometry instead of inventing them', () => {
    const script = WorkbenchPluginGenerator.generate([
        { name: 'Broken', shape: 'circle', cx: undefined, cy: undefined, radius: undefined },
        { name: 'Empty Poly', shape: 'polygon', points: [] },
        CIRCLE
    ]);
    // Count call sites only, not the helper's own definition.
    const triggers = [...script.matchAll(/CreateZoneTrigger\(api,/g)].length;
    assert.equal(triggers, 1, 'only the valid zone should be emitted');
    assert.doesNotMatch(script, /"Broken"/);
});

test('Workbench plugin is guarded for Workbench-only compilation and is empty-safe', () => {
    const script = WorkbenchPluginGenerator.generate([]);
    assert.match(script, /^\/\/ =+\n\/\/ ARMOZE zone import plugin/);
    assert.match(script, /#ifdef WORKBENCH/);
    assert.match(script, /#endif \/\/ WORKBENCH/);
    assert.match(script, /class ARMOZE_ImportZonesPlugin : WorkbenchPlugin/);
    assert.match(script, /wbModules: \{ "WorldEditor" \}/);
    // Braces must balance or the file cannot compile.
    assert.equal((script.match(/\{/g) || []).length, (script.match(/\}/g) || []).length);
});

test('Workbench export wraps every entity creation in a single undo action', () => {
    const script = WorkbenchPluginGenerator.generate([CIRCLE, RECT]);
    const begin = script.indexOf('BeginEntityAction');
    const end = script.indexOf('EndEntityAction');
    assert.ok(begin > -1 && end > begin, 'entity creation must sit inside one undo action');
    const body = script.slice(begin, end);
    assert.equal((body.match(/CreateZoneTrigger\(api/g) || []).length, 2);
});

test('EnfusionScript export declares every zone type it uses', () => {
    // Regression: the enum was hardcoded to SAFE/RESTRICTED/PVP/SPAWN/
    // OBJECTIVE/CUSTOM, so the shipped blufor and opfor profiles (and every
    // user-created profile) emitted undeclared enum members.
    const handler = new ExportHandler(null, null, null);
    const zones = DEFAULT_PROFILE_IDS.map((profileId, index) => ({
        ...CIRCLE, name: `Zone ${index}`, profileId
    }));
    const script = ScriptGenerator.generateEnfusionManager(
        zones, handler.getEnfusionType, handler.hexToInt, handler.escapeString
    );
    assert.doesNotMatch(script, /EZoneType/, 'zone types must not depend on a fixed enum');
    for (const profileId of DEFAULT_PROFILE_IDS) {
        assert.ok(script.includes(`"${profileId}"`), `profile ${profileId} must survive export`);
    }
});

test('EnfusionScript export tolerates a zone with no opacity and initialises itself', () => {
    const handler = new ExportHandler(null, null, null);
    const script = ScriptGenerator.generateEnfusionManager(
        [{ ...CIRCLE, opacity: undefined }], handler.getEnfusionType, handler.hexToInt, handler.escapeString
    );
    assert.match(script, /zone\.Opacity = 1\.00;/);
    assert.match(script, /override void OnPostInit\(IEntity owner\)/, 'InitZones must actually be called');
    assert.match(script, /InitZones\(\);/);
    assert.equal((script.match(/\{/g) || []).length, (script.match(/\}/g) || []).length);
});
