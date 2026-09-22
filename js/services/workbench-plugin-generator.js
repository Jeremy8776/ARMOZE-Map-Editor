/**
 * Workbench Plugin Generator
 *
 * Emits an Enfusion Workbench plugin (.c) that recreates the drawn zones as
 * real trigger entities in the World Editor, so gameplay events can fire on
 * the same areas that were authored on the map.
 *
 * Invariants:
 * - The emitted file must compile as Enforce script on its own. Every function
 *   it calls is either defined in the file or is a documented Workbench API
 *   member (verified against BohemiaInteractive/Arma-Reforger-Script-Diff:
 *   WorldEditorAPI.c, SCR_ImportShapefilePlugin.c).
 * - Zone coordinates arrive already transformed into Enfusion world metres by
 *   CoordinateSystemService: `x`/`cx` are world X, `y`/`cy` and point `.y` are
 *   world Z. Elevation is resolved at import time from the terrain.
 * - Enfusion triggers are spheres (BaseGameTriggerEntity.SetSphereRadius), so
 *   only circles map exactly. Every other shape gets an enclosing-sphere
 *   trigger PLUS a PolylineShapeEntity tracing the true outline, and the
 *   approximation is stated in the generated file rather than hidden.
 */
class WorkbenchPluginGenerator {
    static get TRIGGER_CLASS() { return 'SCR_BaseTriggerEntity'; }
    static get OUTLINE_CLASS() { return 'PolylineShapeEntity'; }

    /**
     * @param {Array} zones  World-space zones (already coordinate-transformed).
     * @param {Object} options
     * @param {string} [options.triggerClass]  Entity class to spawn per zone.
     * @returns {string} Enforce source for an ARMOZE import plugin.
     */
    static generate(zones = [], options = {}) {
        const triggerClass = options.triggerClass || this.TRIGGER_CLASS;
        const shapes = zones.map(zone => this.describeZone(zone)).filter(Boolean);
        const approximated = shapes.filter(shape => shape.approximate).length;

        const lines = [];
        lines.push('// =============================================================');
        lines.push('// ARMOZE zone import plugin');
        lines.push(`// Generated ${new Date().toISOString()}`);
        lines.push(`// Zones: ${shapes.length}${approximated ? ` (${approximated} approximated as spheres, outlines included)` : ''}`);
        lines.push('//');
        lines.push('// Place this file in your mod under Scripts/WorkbenchGame/ and');
        lines.push('// run it from the World Editor: Plugins > ARMOZE: Import Zones.');
        lines.push('// Each zone becomes a trigger entity on the current entity layer.');
        lines.push('// =============================================================');
        lines.push('');
        lines.push('#ifdef WORKBENCH');
        lines.push('[WorkbenchPluginAttribute(');
        lines.push('\tname: "ARMOZE: Import Zones",');
        lines.push('\tdescription: "Recreate map-authored zones as trigger entities.",');
        lines.push('\tshortcut: "Ctrl+Shift+I",');
        lines.push('\twbModules: { "WorldEditor" },');
        lines.push('\tawesomeFontCode: 0xF5EE)]');
        lines.push('class ARMOZE_ImportZonesPlugin : WorkbenchPlugin');
        lines.push('{');
        lines.push(`\tprotected static const string TRIGGER_CLASS = "${this.escape(triggerClass)}";`);
        lines.push(`\tprotected static const string OUTLINE_CLASS = "${this.OUTLINE_CLASS}";`);
        lines.push('');
        lines.push('\toverride void Run()');
        lines.push('\t{');
        lines.push('\t\tWorldEditor worldEditor = Workbench.GetModule(WorldEditor);');
        lines.push('\t\tif (!worldEditor)');
        lines.push('\t\t{');
        lines.push('\t\t\tPrint("ARMOZE: open a world in the World Editor first.", LogLevel.ERROR);');
        lines.push('\t\t\treturn;');
        lines.push('\t\t}');
        lines.push('');
        lines.push('\t\tWorldEditorAPI api = worldEditor.GetApi();');
        lines.push('\t\tif (!api || api.UndoOrRedoIsRestoring())');
        lines.push('\t\t\treturn;');
        lines.push('');
        lines.push('\t\tint layerId = api.GetCurrentEntityLayerId();');
        lines.push('\t\tint created = 0;');
        lines.push('');
        lines.push('\t\tapi.BeginEntityAction("ARMOZE zone import");');
        lines.push('');

        if (shapes.length === 0) {
            lines.push('\t\t// No zones were present at export time.');
        }
        for (const shape of shapes) {
            lines.push(...this.emitZone(shape));
        }

        lines.push('');
        lines.push('\t\tapi.EndEntityAction("ARMOZE zone import");');
        lines.push(`\t\tPrint("ARMOZE: imported " + created.ToString() + " of ${shapes.length} zone(s).", LogLevel.NORMAL);`);
        lines.push('\t}');
        lines.push('');
        lines.push(...this.emitCreateTrigger());
        lines.push('');
        lines.push(...this.emitCreateOutline());
        lines.push('}');
        lines.push('#endif // WORKBENCH');
        lines.push('');

        return lines.join('\n');
    }

    /**
     * Normalize a zone into { name, x, z, radius, points[], approximate }.
     * Returns null when the zone carries no usable geometry, so a silent
     * placeholder at the world origin can never be emitted.
     */
    static describeZone(zone) {
        if (!zone) return null;
        const name = this.entityName(zone);
        const comment = typeof zone.name === 'string' && zone.name.trim() ? zone.name.trim() : name;

        if (this.isFinitePair(zone.cx, zone.cy) && Number.isFinite(zone.radius)) {
            return { name, comment, x: zone.cx, z: zone.cy, radius: Math.abs(zone.radius), points: null, approximate: false };
        }

        const points = this.outlinePoints(zone);
        if (!points || points.length < 2) return null;

        const xs = points.map(p => p.x);
        const zs = points.map(p => p.z);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minZ = Math.min(...zs), maxZ = Math.max(...zs);
        const x = (minX + maxX) / 2;
        const z = (minZ + maxZ) / 2;
        const radius = Math.max(
            Math.hypot(maxX - minX, maxZ - minZ) / 2,
            0.5
        );

        return { name, comment, x, z, radius, points, approximate: true };
    }

    /** World-space outline for any non-circular shape, or null. */
    static outlinePoints(zone) {
        if (Array.isArray(zone.points) && zone.points.length >= 2) {
            const mapped = zone.points
                .filter(p => this.isFinitePair(p?.x, p?.y))
                .map(p => ({ x: p.x, z: p.y }));
            return mapped.length >= 2 ? mapped : null;
        }

        if (this.isFinitePair(zone.x1, zone.y1) && this.isFinitePair(zone.x2, zone.y2)) {
            return [{ x: zone.x1, z: zone.y1 }, { x: zone.x2, z: zone.y2 }];
        }

        if (this.isFinitePair(zone.x, zone.y) && Number.isFinite(zone.width) && Number.isFinite(zone.height)) {
            const x2 = zone.x + zone.width;
            const z2 = zone.y + zone.height;
            return [
                { x: zone.x, z: zone.y },
                { x: x2, z: zone.y },
                { x: x2, z: z2 },
                { x: zone.x, z: z2 },
                { x: zone.x, z: zone.y }
            ];
        }

        return null;
    }

    static emitZone(shape) {
        const lines = [];
        lines.push(`\t\t// ${this.commentSafe(shape.comment)}${shape.approximate ? ' (sphere approximates the drawn outline)' : ''}`);
        lines.push(`\t\tif (CreateZoneTrigger(api, layerId, "${this.escape(shape.name)}", ${this.num(shape.x)}, ${this.num(shape.z)}, "${this.num(shape.radius)}"))`);
        lines.push('\t\t\tcreated++;');
        if (shape.points) {
            const args = shape.points.map(p => `{ ${this.num(p.x)}, ${this.num(p.z)} }`).join(', ');
            lines.push(`\t\tCreateZoneOutline(api, layerId, "${this.escape(shape.name)}_outline", { ${args} });`);
        }
        lines.push('');
        return lines;
    }

    static emitCreateTrigger() {
        return [
            '\t//! Create one sphere trigger on the terrain at world X/Z.',
            '\tprotected bool CreateZoneTrigger(WorldEditorAPI api, int layerId, string name, float x, float z, string radius)',
            '\t{',
            '\t\tfloat y;',
            '\t\tif (!api.TryGetTerrainSurfaceY(x, z, y))',
            '\t\t{',
            '\t\t\tPrint("ARMOZE: " + name + " lies outside the terrain, skipped.", LogLevel.WARNING);',
            '\t\t\treturn false;',
            '\t\t}',
            '',
            '\t\tIEntitySource entity = api.CreateEntity(TRIGGER_CLASS, name, layerId, null, Vector(x, y, z), vector.Zero);',
            '\t\tif (!entity)',
            '\t\t{',
            '\t\t\tPrint("ARMOZE: could not create " + name + " (is " + TRIGGER_CLASS + " available?)", LogLevel.ERROR);',
            '\t\t\treturn false;',
            '\t\t}',
            '',
            '\t\tapi.SetVariableValue(entity, null, "SphereRadius", radius);',
            '\t\tapi.SetVariableValue(entity, null, "DrawShape", "1");',
            '\t\treturn true;',
            '\t}'
        ];
    }

    static emitCreateOutline() {
        return [
            '\t//! Trace the drawn zone outline so the approximation stays visible.',
            '\tprotected void CreateZoneOutline(WorldEditorAPI api, int layerId, string name, notnull array<ref array<float>> points)',
            '\t{',
            '\t\tif (points.IsEmpty())',
            '\t\t\treturn;',
            '',
            '\t\tarray<vector> worldPoints = {};',
            '\t\tvector origin = vector.Zero;',
            '\t\tforeach (array<float> point : points)',
            '\t\t{',
            '\t\t\tfloat y;',
            '\t\t\tif (!api.TryGetTerrainSurfaceY(point[0], point[1], y))',
            '\t\t\t\tcontinue;',
            '',
            '\t\t\tvector world = Vector(point[0], y, point[1]);',
            '\t\t\tworldPoints.Insert(world);',
            '\t\t\torigin = origin + world;',
            '\t\t}',
            '',
            '\t\tif (worldPoints.Count() < 2)',
            '\t\t\treturn;',
            '',
            '\t\torigin = origin / worldPoints.Count();',
            '',
            '\t\tIEntitySource outline = api.CreateEntity(OUTLINE_CLASS, name, layerId, null, origin, vector.Zero);',
            '\t\tif (!outline)',
            '\t\t\treturn;',
            '',
            '\t\tfor (int i = 0; i < worldPoints.Count(); i++)',
            '\t\t{',
            '\t\t\tapi.CreateObjectArrayVariableMember(outline, null, "Points", "ShapePoint", i);',
            '\t\t\tapi.SetVariableValue(outline, { new ContainerIdPathEntry("Points", i) }, "Position", (worldPoints[i] - origin).ToString(false));',
            '\t\t}',
            '\t}'
        ];
    }

    /** Enforce entity names: letters, digits and underscores only. */
    static entityName(zone) {
        const base = (typeof zone.name === 'string' ? zone.name : '').trim() || 'Zone';
        const cleaned = base.replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
        const safe = cleaned || 'Zone';
        return /^[0-9]/.test(safe) ? `Zone_${safe}` : safe;
    }

    static isFinitePair(a, b) {
        return Number.isFinite(a) && Number.isFinite(b);
    }

    static num(value) {
        return Number(value).toFixed(2);
    }

    static escape(value) {
        return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }

    static commentSafe(value) {
        return String(value).replace(/[\r\n]+/g, ' ');
    }
}

if (typeof window !== 'undefined') {
    window.WorkbenchPluginGenerator = WorkbenchPluginGenerator;
}
