/**
 * Project Manager Module
 * Handles saving and loading project files
 */
class ProjectManager {
    constructor(app) {
        this.app = app;
    }

    normalizeProjectData(projectData) {
        const zones = Array.isArray(projectData?.zones)
            ? projectData.zones
                .filter(zone => zone && typeof zone === 'object' && typeof zone.shape === 'string')
                .map(zone => this.normalizeZone(zone))
            : null;

        if (!zones) {
            return null;
        }

        const overlays = Array.isArray(projectData?.overlays)
            ? projectData.overlays
                .filter(overlay => overlay && typeof overlay === 'object')
                .map(overlay => this.normalizeOverlay(overlay))
            : [];

        return { zones, overlays };
    }

    normalizeZone(zone) {
        return {
            ...zone,
            id: typeof zone.id === 'string' ? zone.id : Utils.generateId(),
            name: typeof zone.name === 'string' ? zone.name : 'Zone',
            profileId: typeof zone.profileId === 'string' ? zone.profileId : 'custom',
            color: typeof zone.color === 'string' ? zone.color : '#00ff88',
            labelText: typeof zone.labelText === 'string' ? zone.labelText : (typeof zone.name === 'string' ? zone.name : 'Zone'),
            labelColor: typeof zone.labelColor === 'string' ? zone.labelColor : '#ffffff',
            labelBgColor: typeof zone.labelBgColor === 'string' ? zone.labelBgColor : '#000000',
            visible: zone.visible !== false,
            showLabel: zone.showLabel !== false,
            points: Array.isArray(zone.points)
                ? zone.points
                    .filter(point => point && Number.isFinite(point.x) && Number.isFinite(point.y))
                    .map(point => ({ x: point.x, y: point.y }))
                : zone.points
        };
    }

    normalizeOverlay(overlay) {
        return {
            ...overlay,
            id: typeof overlay.id === 'string' ? overlay.id : Utils.generateId('overlay'),
            name: typeof overlay.name === 'string' ? overlay.name : 'overlay',
            sourceName: typeof overlay.sourceName === 'string' ? overlay.sourceName : (typeof overlay.name === 'string' ? overlay.name : 'overlay'),
            sourceType: overlay.sourceType === 'svg' ? 'svg' : 'raster',
            src: typeof overlay.src === 'string' ? overlay.src : '',
            svgMarkupOriginal: typeof overlay.svgMarkupOriginal === 'string' ? overlay.svgMarkupOriginal : '',
            tintColor: typeof overlay.tintColor === 'string' ? overlay.tintColor : '#ffffff',
            tintMode: overlay.tintMode === 'vector' ? 'vector' : 'pixel'
        };
    }

    /**
     * Save the current project to a JSON file
     */
    saveProject() {
        const zones = this.app.zoneManager.getZones();
        const overlays = this.app.imageOverlayManager.serializeOverlays();
        if (zones.length === 0 && overlays.length === 0) {
            this.app.notificationService?.showAlert('No zones or branding images to save.', { title: 'Nothing to Save' });
            return;
        }

        const projectData = {
            version: "1.3.2",
            created: new Date().toISOString(),
            zones: zones,
            overlays: overlays
        };

        const json = JSON.stringify(projectData, null, 2);
        Utils.downloadFile(json, 'map_project.json', 'application/json');
    }

    /**
     * Handle loading a project file
     * @param {Event} e - File input change event
     */
    handleProjectLoad(e) {
        const file = e.target.files[0];
        // Reset input value so the same file can be selected again after an async flow.
        e.target.value = '';
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            let projectData;
            try {
                projectData = JSON.parse(event.target.result);
            } catch (err) {
                console.error('Error loading project:', err);
                this.app.notificationService?.showAlert('Error parsing project file.', { title: 'Load Failed', tone: 'danger' });
                return;
            }

            const normalizedProject = this.normalizeProjectData(projectData);
            if (!normalizedProject) {
                this.app.notificationService?.showAlert('Invalid project file format.', { title: 'Load Failed', tone: 'danger' });
                return;
            }

            const hasExistingState = this.app.zoneManager.getZones().length > 0 || this.app.imageOverlayManager.hasOverlays();
            if (hasExistingState) {
                const ok = await this.app.notificationService?.showConfirm(
                    'Loading a project will replace all current zones and branding images. Continue?',
                    { title: 'Replace Current Project?', confirmLabel: 'Replace', tone: 'danger' }
                );
                if (!ok) return;
            }

            this.app.zoneManager.zones = normalizedProject.zones;
            this.app.imageOverlayManager.setOverlays(normalizedProject.overlays, { persist: true, keepSelection: false });
            this.app.zoneManager.saveToStorage();
            this.app.zoneManager.selectZone(null);
            this.app.imageOverlayManager.selectOverlay(null, { render: false });
            this.app.historyManager.saveHistory();
            this.app.zoneListUI.updateZoneList();
            this.app.core.requestRender();
            this.app.updateUI();
        };
        reader.readAsText(file);
    }
}

// Export for use in other modules
window.ProjectManager = ProjectManager;
