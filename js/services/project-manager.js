/**
 * Project Manager Module
 * Handles saving and loading project files
 */
class ProjectManager {
    constructor(app) {
        this.app = app;
    }

    /**
     * Save the current project to a JSON file
     */
    saveProject() {
        const zones = this.app.zoneManager.getZones();
        const overlays = this.app.imageOverlayManager.serializeOverlays();
        if (zones.length === 0 && overlays.length === 0) {
            alert('No zones or branding images to save.');
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
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const projectData = JSON.parse(event.target.result);
                if (projectData.zones && Array.isArray(projectData.zones)) {
                    const hasExistingState = this.app.zoneManager.getZones().length > 0 || this.app.imageOverlayManager.hasOverlays();
                    if (hasExistingState) {
                        if (!confirm('Loading a project will replace all current zones and branding images. Continue?')) {
                            return;
                        }
                    }
                    this.app.zoneManager.zones = projectData.zones;
                    this.app.imageOverlayManager.setOverlays(projectData.overlays || [], { persist: true, keepSelection: false });
                    this.app.zoneManager.saveToStorage();
                    this.app.zoneManager.selectZone(null);
                    this.app.imageOverlayManager.selectOverlay(null, { render: false });
                    this.app.historyManager.saveHistory();
                    this.app.zoneListUI.updateZoneList();
                    this.app.core.requestRender();
                    this.app.updateUI();
                } else {
                    alert('Invalid project file format.');
                }
            } catch (err) {
                console.error('Error loading project:', err);
                alert('Error parsing project file.');
            }
        };
        reader.readAsText(file);
        // Reset input value so same file can be selected again
        e.target.value = '';
    }
}

// Export for use in other modules
window.ProjectManager = ProjectManager;
