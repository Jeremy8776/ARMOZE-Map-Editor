/**
 * Script Generator Service
 * Handles generation of complex Enfusion and Workbench strings.
 */
class ScriptGenerator {
    /**
     * Generate EnfusionScript Manager Component
     */
    static generateEnfusionManager(zones, getEnfusionType, hexToInt, escapeString) {
        const timestamp = new Date().toISOString();
        let script = `// ============================================
// Arma Reforger Zone Definitions (${timestamp})
// ============================================\n\n`;

        script += this.getEnfusionHeader();

        for (const zone of zones) {
            const typeEnum = getEnfusionType(zone.profileId);
            const colorInt = hexToInt(zone.color);

            script += `        // ${zone.name}\n        {\n`;
            script += `            ZoneDefinition zone = new ZoneDefinition("${escapeString(zone.name)}", ${typeEnum}, "${zone.shape}");\n`;

            if (zone.shape === 'circle') {
                script += `            zone.Center = Vector(${zone.cx.toFixed(2)}, 0, ${zone.cy.toFixed(2)});\n`;
                script += `            zone.Radius = ${zone.radius.toFixed(2)};\n`;
            } else if (zone.points) {
                zone.points.forEach(p => {
                    script += `            zone.Points.Insert(Vector(${p.x.toFixed(2)}, 0, ${p.y.toFixed(2)}));\n`;
                });
            }

            script += `            zone.Color = ${colorInt};\n            zone.Opacity = ${zone.opacity.toFixed(2)};\n`;
            script += `            m_Zones.Insert(zone);\n        }\n\n`;
        }

        script += this.getEnfusionFooter();
        return script;
    }

    static getEnfusionHeader() {
        return `enum EZoneType { SAFE, RESTRICTED, PVP, SPAWN, OBJECTIVE, CUSTOM }\n
class ZoneDefinition {
    string Name; EZoneType Type; string Shape; ref array<vector> Points; vector Center; float Radius; int Color; float Opacity;
    void ZoneDefinition(string name, EZoneType type, string shape) { Name = name; Type = type; Shape = shape; Points = new array<vector>(); }
}\n
[ComponentEditorProps(category: "Game Mode", description: "Manages map zones")]
class SCR_ZoneManagerComponent: SCR_BaseGameModeComponent {
    protected ref array<ref ZoneDefinition> m_Zones;
    protected void InitZones() {
        m_Zones = new array<ref ZoneDefinition>();\n`;
    }

    static getEnfusionFooter() {
        return `    }\n}\n`;
    }

    /**
     * Generate Workbench Plugin Script
     */
    static generateWorkbenchPlugin(zones, escapeString, getPolygonBounds) {
        let script = `[WorkbenchPluginAttribute(name: "Import Zones", shortcut: "Ctrl+Shift+I", icon: "infopoint")]
class ImportZonesPlugin : WorkbenchPlugin {
    override void Run() {
        WorldEditorAPI api = GenericComponent.GetWorldEditorAPI();
        if (!api) return;
        api.BeginEntityAction("ImportZones");\n`;

        for (const zone of zones) {
            let cx = 0, cy = 0, r = 1, w = 2, h = 2, type = "box", pts = "null";
            
            if (zone.shape === 'circle') {
                cx = zone.cx; cy = zone.cy; r = zone.radius; type = "circle";
            } else {
                const bounds = zone.points ? getPolygonBounds(zone.points) : (zone.shape === 'rectangle' ? {x:zone.x, y:zone.y, width:zone.width, height:zone.height} : null);
                if (bounds) {
                    cx = bounds.x + bounds.width/2; cy = bounds.y + bounds.height/2;
                    w = bounds.width; h = bounds.height; r = Math.max(w, h)/2;
                }
                type = zone.shape === 'rectangle' ? "box" : "spline";
                if (zone.points) pts = `"${zone.points.map(p => `${p.x.toFixed(2)},0,${p.y.toFixed(2)}`).join('|')}"`;
            }

            script += `        CreateZone(api, "${escapeString(zone.name)}", "${type}", ${cx.toFixed(2)}, ${cy.toFixed(2)}, ${r.toFixed(2)}, ${w.toFixed(2)}, ${h.toFixed(2)}, "${(zone.profileId || 'custom').toUpperCase()}", ${pts});\n`;
        }

        script += `        api.EndEntityAction();\n    }\n}\n`;
        return script;
    }
}

window.ScriptGenerator = ScriptGenerator;
