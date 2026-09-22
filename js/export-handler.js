/**
 * Export Handler - Orchestrates various export formats
 */
class ExportHandler {
    // Formats not yet ready for users. The UI disables them; this is the
    // second gate so a saved setting or stale call can't reach them.
    static get COMING_SOON_FORMATS() { return ['workbench']; }

    constructor(core, zoneManager, renderer, imageOverlayManager = null, notificationService = null, coordinateSystem = null) {
        this.core = core;
        this.zoneManager = zoneManager;
        this.renderer = renderer;
        this.imageOverlayManager = imageOverlayManager;
        this.notificationService = notificationService;
        this.coordinateSystem = coordinateSystem;
    }

    export(format, settings = {}) {
        if (ExportHandler.COMING_SOON_FORMATS.includes(format)) {
            this.notificationService?.showAlert(
                'Workbench Plugin export is still in testing and will be enabled in a future release.',
                { title: 'Coming Soon' }
            );
            return;
        }

        const zones = this.zoneManager.getZones();
        const overlays = this.imageOverlayManager?.serializeOverlays?.() || [];
        const needsZoneGeometry = format === 'enfusion' || format === 'json' || format === 'workbench' || format === 'all';
        if (needsZoneGeometry && zones.length === 0) {
            this.notificationService?.showAlert('No zones to export!', { title: 'Nothing to Export' });
            return;
        }
        if (!needsZoneGeometry && zones.length === 0 && overlays.length === 0) {
            this.notificationService?.showAlert('No zones or branding images to export!', { title: 'Nothing to Export' });
            return;
        }

        if (settings.coordinateSystem) {
            this.coordinateSystem?.setSettings(settings.coordinateSystem, { notify: false });
        }
        const transformedZones = zones.map(zone => this.transformZone(zone));

        switch (format) {
            case 'enfusion': this.exportEnfusion(transformedZones); break;
            case 'json': this.exportJSON(transformedZones); break;
            case 'image': this.exportImage(settings); break;
            case 'image_with_map': this.exportImage({ ...settings, includeMap: true, baseName: (settings.baseName || 'map_overlay') + '_full' }); break;
            case 'workbench': this.exportWorkbenchPlugin(transformedZones); break;
            case 'all': this.exportAll(transformedZones, settings); break;
        }
    }

    transformZone(zone) {
        if (!this.coordinateSystem) {
            return { ...zone };
        }
        return this.coordinateSystem.transformZone(zone);
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
        const fmt = settings.imageFormat === 'tiff' ? 'tiff' : 'png';
        const ext = fmt === 'tiff' ? '.tiff' : '.png';
        const filename = `${settings.baseName || 'zone_overlay'}${settings.textureSuffix || '_A'}${ext}`;
        try {
            Utils.downloadCanvas(finalCanvas, filename, fmt);
        } catch (err) {
            this.notificationService?.showAlert(err.message || 'Image export failed.', { title: 'Export Failed', tone: 'danger' });
        }
    }

    exportWorkbenchPlugin(zones) {
        const script = ScriptGenerator.generateWorkbenchPlugin(zones);
        Utils.downloadFile(script, 'ARMOZE_ImportZonesPlugin.c', 'text/plain');
    }

    exportAll(zones, settings = {}) {
        this.exportEnfusion(zones);
        this.exportJSON(zones);
        this.exportImage(settings);
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

    getEnfusionType(id) { return `"${(id || 'custom').replace(/[^A-Za-z0-9_]/g, '_').toLowerCase()}"`; }
    hexToInt(hex) { return parseInt(hex.replace('#', ''), 16); }
    escapeString(str) { return str.replace(/"/g, '\\"').replace(/\n/g, '\\n'); }
}

window.ExportHandler = ExportHandler;
