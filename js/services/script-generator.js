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
// ARMOZE Zone Definitions (${timestamp})
// ============================================\n\n`;

        script += this.getEnfusionHeader();

        for (const zone of zones) {
            const typeName = getEnfusionType(zone.profileId);
            const colorInt = hexToInt(zone.color);
            const opacity = Number.isFinite(zone.opacity) ? zone.opacity : 1;

            script += `        // ${zone.name}\n        {\n`;
            script += `            ZoneDefinition zone = new ZoneDefinition("${escapeString(zone.name)}", ${typeName}, "${zone.shape}");\n`;

            if (zone.shape === 'circle') {
                script += `            zone.Center = Vector(${zone.cx.toFixed(2)}, 0, ${zone.cy.toFixed(2)});\n`;
                script += `            zone.Radius = ${zone.radius.toFixed(2)};\n`;
            } else if (zone.shape === 'rectangle') {
                const corners = [
                    { x: zone.x, y: zone.y },
                    { x: zone.x + zone.width, y: zone.y },
                    { x: zone.x + zone.width, y: zone.y + zone.height },
                    { x: zone.x, y: zone.y + zone.height }
                ];
                corners.forEach(point => {
                    script += `            zone.Points.Insert(Vector(${point.x.toFixed(2)}, 0, ${point.y.toFixed(2)}));\n`;
                });
            } else if (zone.shape === 'line') {
                script += `            zone.Points.Insert(Vector(${zone.x1.toFixed(2)}, 0, ${zone.y1.toFixed(2)}));\n`;
                script += `            zone.Points.Insert(Vector(${zone.x2.toFixed(2)}, 0, ${zone.y2.toFixed(2)}));\n`;
            } else if (zone.points) {
                zone.points.forEach(p => {
                    script += `            zone.Points.Insert(Vector(${p.x.toFixed(2)}, 0, ${p.y.toFixed(2)}));\n`;
                });
            }

            script += `            zone.Color = ${colorInt};\n            zone.Opacity = ${opacity.toFixed(2)};\n`;
            script += `            m_Zones.Insert(zone);\n        }\n\n`;
        }

        script += this.getEnfusionFooter();
        return script;
    }

    static getEnfusionHeader() {
        return `class ZoneDefinition {
    string Name; string Type; string Shape; ref array<vector> Points; vector Center; float Radius; int Color; float Opacity;
    void ZoneDefinition(string name, string type, string shape) { Name = name; Type = type; Shape = shape; Points = new array<vector>(); }
}\n
[ComponentEditorProps(category: "Game Mode", description: "Manages map zones")]
class SCR_ZoneManagerComponent: SCR_BaseGameModeComponent {
    protected ref array<ref ZoneDefinition> m_Zones;

    override void OnPostInit(IEntity owner) {
        super.OnPostInit(owner);
        InitZones();
    }

    protected void InitZones() {
        m_Zones = new array<ref ZoneDefinition>();\n`;
    }

    static getEnfusionFooter() {
        return `    }\n}\n`;
    }

    /**
     * Generate Workbench Plugin Script.
     * Delegates to WorkbenchPluginGenerator, which emits a self-contained
     * plugin against the documented WorldEditorAPI.
     */
    static generateWorkbenchPlugin(zones, options = {}) {
        return WorkbenchPluginGenerator.generate(zones, options);
    }
}

window.ScriptGenerator = ScriptGenerator;
