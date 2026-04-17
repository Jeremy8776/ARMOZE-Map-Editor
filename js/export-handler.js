/**
 * Export Handler - Orchestrates various export formats
 */
class ExportHandler {
    constructor(core, zoneManager, renderer) {
        this.core = core;
        this.zoneManager = zoneManager;
        this.renderer = renderer;
    }

    export(format, settings = {}) {
        const zones = this.zoneManager.getZones();
        if (zones.length === 0) return alert('No zones to export!');

        const scale = settings.mapScale || 1;
        const oX = settings.originX || 0;
        const oY = settings.originY || 0;
        const transformedZones = zones.map(z => this.transformZone(z, scale, oX, oY, settings.invertY));

        switch (format) {
            case 'enfusion': this.exportEnfusion(transformedZones); break;
            case 'json': this.exportJSON(transformedZones); break;
            case 'image': this.exportImage(settings); break;
            case 'image_with_map': this.exportImage({ ...settings, includeMap: true, baseName: (settings.baseName || 'map_overlay') + '_full' }); break;
            case 'tiff': this.exportTIFF(settings); break;
            case 'workbench': this.exportWorkbenchPlugin(transformedZones); break;
            case 'all': this.exportAll(transformedZones, settings); break;
        }
    }

    transformZone(zone, scale, oX, oY, invY = false) {
        const t = { ...zone };
        const trY = (y) => invY ? oY - (y * scale) : (y * scale) + oY;

        if (t.cx !== undefined) {
            t.cx = (t.cx * scale) + oX;
            t.cy = trY(t.cy);
            t.radius *= scale;
        } else if (t.x !== undefined) {
            t.x = (t.x * scale) + oX;
            t.y = trY(t.y);
            t.width *= scale;
            t.height *= scale;
        }

        if (t.points) {
            t.points = t.points.map(p => ({ x: (p.x * scale) + oX, y: trY(p.y) }));
        }
        return t;
    }

    exportEnfusion(zones) {
        const script = ScriptGenerator.generateEnfusionManager(zones, this.getEnfusionType, this.hexToInt, this.escapeString);
        Utils.downloadFile(script, 'SCR_ZoneManagerComponent.c', 'text/plain');
    }

    exportJSON(zones) {
        const data = { version: "1.3.2", generated: new Date().toISOString(), zones: zones.map(z => ({...z, bounds: z.points ? Utils.getPolygonBounds(z.points) : null})) };
        Utils.downloadFile(JSON.stringify(data, null, 2), 'zones.json', 'application/json');
    }

    exportImage(settings = {}) {
        const canvas = this.renderer.exportAsImage(settings);
        if (!canvas) return;
        const finalCanvas = settings.resizeToPow2 !== false ? this.resizeToPowerOf2(canvas) : canvas;
        Utils.downloadCanvas(finalCanvas, `${settings.baseName || 'zone_overlay'}${settings.textureSuffix || '_A'}.png`);
    }

    exportTIFF(settings = {}) {
        const canvas = this.renderer.exportAsImage(settings);
        if (!canvas) return;
        const finalCanvas = settings.resizeToPow2 !== false ? this.resizeToPowerOf2(canvas) : canvas;
        const imageData = finalCanvas.getContext('2d').getImageData(0, 0, finalCanvas.width, finalCanvas.height);
        const tiffData = UTIF.encodeImage(imageData.data, finalCanvas.width, finalCanvas.height);
        Utils.downloadFile(new Blob([tiffData], { type: 'image/tiff' }), `${settings.baseName || 'zone_overlay'}${settings.textureSuffix || '_A'}.tiff`, 'image/tiff');
    }

    exportWorkbenchPlugin(zones) {
        const script = ScriptGenerator.generateWorkbenchPlugin(zones, this.escapeString, Utils.getPolygonBounds);
        Utils.downloadFile(script, 'ImportZonesPlugin.c', 'text/plain');
    }

    exportAll(zones, settings = {}) {
        this.exportEnfusion(zones);
        setTimeout(() => this.exportJSON(zones), 500);
        setTimeout(() => this.exportImage(settings), 1000);
    }

    resizeToPowerOf2(canvas) {
        const nextPow2 = (n) => Math.pow(2, Math.ceil(Math.log2(n)));
        const w = nextPow2(canvas.width), h = nextPow2(canvas.height);
        if (w === canvas.width && h === canvas.height) return canvas;
        const res = document.createElement('canvas');
        res.width = w; res.height = h;
        res.getContext('2d').drawImage(canvas, 0, 0, w, h);
        return res;
    }

    getEnfusionType(id) { return `EZoneType.${(id || 'CUSTOM').replace(/[^A-Za-z0-9_]/g, '_').toUpperCase()}`; }
    hexToInt(hex) { return parseInt(hex.replace('#', ''), 16); }
    escapeString(str) { return str.replace(/"/g, '\\"').replace(/\n/g, '\\n'); }
}

window.ExportHandler = ExportHandler;
