/**
 * ARMOZE Map Overlay Zone Editor
 * Main Application Logic - Orchestrator
 */

class ZoneEditorApp {
    constructor() {
        this.elements = this.getElements();
        this.initCore();
        this.initServices();
        this.initUI();
        
        this.selectedZoneIds = []; // For multi-select
        this.zoomTimeout = null;
        this.init();
    }

    getElements() {
        return {
            canvasContainer: document.getElementById('canvasContainer'),
            canvas: document.getElementById('mapCanvas'),
            uploadPrompt: document.getElementById('uploadPrompt'),
            btnUpload: document.getElementById('btnUpload'),
            fileInput: document.getElementById('fileInput'),
            overlayImageInput: document.getElementById('overlayImageInput'),
            localMapList: document.getElementById('localMapList'),
            tabBar: document.getElementById('tabBar'),
            coordX: document.getElementById('coordX'),
            coordY: document.getElementById('coordY'),
            mapInfo: document.getElementById('mapInfo'),
            zoomIndicator: document.getElementById('zoomIndicator'),
            btnUndo: document.getElementById('btnUndo'),
            btnRedo: document.getElementById('btnRedo'),
            btnSaveProject: document.getElementById('btnSaveProject'),
            btnLoadProject: document.getElementById('btnLoadProject'),
            projectInput: document.getElementById('projectInput'),
            btnExport: document.getElementById('btnExport'),
            btnAddOverlayImage: document.getElementById('btnAddOverlayImage'),
            btnZoomIn: document.getElementById('btnZoomIn'),
            btnZoomOut: document.getElementById('btnZoomOut'),
            btnFitView: document.getElementById('btnFitView'),
            zoneCount: document.getElementById('zoneCount'),
            zoneList: document.getElementById('zoneList'),
            zoneCoords: document.getElementById('zoneCoords'),
            layersSection: document.getElementById('layersSection'),
            zoneDataSection: document.getElementById('zoneDataSection'),
            zonePanelResizer: document.getElementById('zonePanelResizer'),
            exportModal: document.getElementById('exportModal'),
            btnCloseExport: document.getElementById('btnCloseExport'),
            btnCancelExport: document.getElementById('btnCancelExport'),
            btnConfirmExport: document.getElementById('btnConfirmExport'),
            mapScale: document.getElementById('mapScale'),
            originX: document.getElementById('originX'),
            originY: document.getElementById('originY'),
            textureSuffix: document.getElementById('textureSuffix'),
            resizePow2: document.getElementById('resizePow2'),
            baseName: document.getElementById('baseName'),
            btnToggleSnap: document.getElementById('btnToggleSnap'),
            invertY: document.getElementById('invertY'),
            toolbar: document.querySelector('.toolbar')
        };
    }

    initCore() {
        this.core = new CanvasCore(this.elements.canvas, this.elements.canvasContainer);
        this.zoneManager = new ZoneManager(() => this.requestRender());
        this.imageOverlayManager = new ImageOverlayManager(() => this.requestRender());
        this.imageOverlayManager.hydrateCore(this.core);
        this.toolManager = new ToolManager(this.core, this.zoneManager, this.imageOverlayManager);
        this.eventHandler = new EventHandler(this.core, this.toolManager, this.zoneManager, this.imageOverlayManager);
        this.renderer = new ZoneRenderer(this.core, this.zoneManager, this.imageOverlayManager);
    }

    initServices() {
        this.historyManager = new HistoryManager(
            () => this.getEditorState(),
            (state) => {
                this.zoneManager.zones = state?.zones || [];
                this.zoneManager.selectedZoneId = null;
                this.imageOverlayManager.setOverlays(state?.overlays || [], { persist: true, keepSelection: false });
                this.imageOverlayManager.selectOverlay(null, { render: false });
                this.core.requestRender();
                this.zoneListUI.updateZoneList();
                this.zonePropertiesUI.showZoneProperties(null);
            }
        );
        this.historyManager.onHistoryChanged = () => this.updateUI();

        // NotificationService is constructed before services that may emit dialogs.
        this.notificationService = new NotificationService(this);
        this.projectManager = new ProjectManager(this);
        this.fileHandler = new FileHandler(this);
        this.exportHandler = new ExportHandler(this.core, this.zoneManager, this.renderer, this.imageOverlayManager, this.notificationService);
        this.calibrationService = new CalibrationService(this);
        this.extractorService = new MapExtractorService(this);
        this.hotkeyManager = new HotkeyManager(this);
    }

    initUI() {
        this.tabManager = new TabManager(this);
        this.zoneListUI = new ZoneListUI(this);
        this.zonePropertiesUI = new ZonePropertiesUI(this);
        this.toolbarUI = new ToolbarUI(this, this.elements.toolbar);
        this.mapBrowserUI = new MapBrowserUI(this);
        this.extractorUI = new MapExtractorUI(this);
        this.contextMenu = new ContextMenu(this);
    }

    init() {
        this.tabManager.init(this.elements.tabBar);
        this.zoneListUI.init({
            zoneCount: this.elements.zoneCount,
            zoneList: this.elements.zoneList,
            zoneCoords: this.elements.zoneCoords,
            layersSection: this.elements.layersSection,
            zoneDataSection: this.elements.zoneDataSection,
            zonePanelResizer: this.elements.zonePanelResizer
        });
        this.zonePropertiesUI.init({
            floatingControls: document.getElementById('floatingZoneControls'),
            floatingZoneName: document.getElementById('floatingZoneName'),
            quickZoneColor: document.getElementById('quickZoneColor'),
            btnFloatDuplicate: document.getElementById('btnFloatDuplicate'),
            btnFloatDelete: document.getElementById('btnFloatDelete'),
            btnFloatClose: document.getElementById('btnFloatClose'),
            quickChip: document.getElementById('zoneQuickChip'),
            quickZoneName: document.getElementById('zoneQuickName'),
            btnQuickDuplicate: document.getElementById('btnQuickDuplicate'),
            btnQuickDelete: document.getElementById('btnQuickDelete'),
            btnQuickOpenInspector: document.getElementById('btnQuickOpenInspector')
        });
        this.calibrationService.init({
            calibrationModal: document.getElementById('calibrationModal'),
            btnOpenCalibration: document.getElementById('btnOpenCalibration'),
            btnCloseCalibration: document.getElementById('btnCloseCalibration'),
            btnCancelCalibration: document.getElementById('btnCancelCalibration'),
            btnApplyCalibration: document.getElementById('btnApplyCalibration'),
            calStep1: document.getElementById('calStep1'),
            calStep2: document.getElementById('calStep2'),
            btnPickPoint1: document.getElementById('btnPickPoint1'),
            btnPickPoint2: document.getElementById('btnPickPoint2'),
            pt1Params: document.getElementById('pt1Params'),
            pt2Params: document.getElementById('pt2Params'),
            pt1WorldX: document.getElementById('pt1WorldX'),
            pt1WorldY: document.getElementById('pt1WorldY'),
            pt2WorldX: document.getElementById('pt2WorldX'),
            pt2WorldY: document.getElementById('pt2WorldY')
        });
        this.extractorService.init();
        this.extractorUI.init();
        this.mapBrowserUI.init(this.elements.localMapList);
        this.toolbarUI.init();
        this.toolManager.setTool('select');
        this.toolbarUI.setActiveTool('select');
        this.hotkeyManager.init();

        this.initializeVersion();
        this.setupEventListeners();
        this.setupCallbacks();
        this.fileHandler.setupDragAndDrop(this.elements.canvasContainer, this.elements.uploadPrompt);
        this.updateUI();

        // Check for map parameter in URL
        const urlParams = new URLSearchParams(window.location.search);
        const mapName = urlParams.get('map');
        if (mapName) this.fileHandler.loadLocalMapImage(mapName);
        
        this.setupWindowState();
    }

    setupWindowState() {
        if (window.electronAPI && window.electronAPI.onWindowState) {
            window.electronAPI.onWindowState((state) => {
                document.getElementById('app').classList.toggle('is-maximized', state === 'maximized');
            });
            document.getElementById('app').classList.add('is-maximized');

            if (window.electronAPI.onUpdateAvailable) {
                window.electronAPI.onUpdateAvailable((data) => this.notificationService.showUpdateNotification(data));
            }
        }
    }

    initializeVersion() {
        const versionLink = document.getElementById('appVersionLink');
        if (versionLink && window.Constants) {
            versionLink.textContent = Constants.APP_VERSION;
            versionLink.href = Constants.GITHUB_URL;
        }
    }

    onMapLoaded(image, filename) {
        this.tabManager.createTab(filename, image);
    }

    getEditorState() {
        return {
            zones: this.zoneManager.getZones(),
            overlays: this.imageOverlayManager.serializeOverlays()
        };
    }

    setupCallbacks() {
        this.core.onRender = () => this.render();
        this.zoneManager.onZoneCreated = (zone) => {
            this.historyManager.saveHistory();
            this.zoneListUI.updateZoneList();
            this.toolbarUI.setActiveTool('select');
            this.toolManager.setTool('select');
            this.updateUI();
        };

        this.zoneManager.onZoneSelected = (zone) => {
            if (zone) {
                this.imageOverlayManager.selectOverlay(null, { render: false });
            }
            this.zonePropertiesUI.showZoneProperties(zone);
            this.zoneListUI.updateZoneListSelection();
        };

        this.zoneManager.onZoneUpdated = (zone, options = {}) => {
            this.zonePropertiesUI?.updateZoneDataReadout(zone);

            if (options.live) {
                return;
            }

            this.zoneListUI.updateZoneList();
        };
        this.zoneManager.onZoneDeleted = () => {
            this.zoneListUI.updateZoneList();
            this.updateUI();
        };

        this.imageOverlayManager.onOverlayCreated = () => {
            this.zoneListUI.updateZoneList();
            this.updateUI();
        };
        this.imageOverlayManager.onOverlaySelected = (overlay) => {
            if (overlay) {
                this.zoneManager.selectZone(null);
            }
            this.zoneListUI.updateZoneListSelection();
        };
        this.imageOverlayManager.onOverlayUpdated = (overlay, options = {}) => {
            if (options.live) {
                this.zoneListUI.syncOverlayTintControls?.(overlay);
            } else {
                this.zoneListUI.updateZoneList();
            }
            if (!options.live) {
                this.updateUI();
            }
        };
        this.imageOverlayManager.onOverlayDeleted = () => {
            this.zoneListUI.updateZoneList();
            this.updateUI();
        };

        if (this.toolManager.tools.select) {
            this.toolManager.tools.select.onDragComplete = () => this.historyManager.saveHistory();
        }

        this.elements.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const pos = this.core.getMousePos(e);
            const mapPos = this.core.screenToMap(pos.x, pos.y);
            const zone = this.zoneManager.findZoneAtPoint(mapPos, this.core.zoom);
            if (zone) this.zoneManager.selectZone(zone.id);
            this.contextMenu.showForCanvas(e, zone);
        });

        this.core.onCoordsChanged = (x, y) => {
            this.elements.coordX.textContent = Utils.formatCoord(x);
            this.elements.coordY.textContent = Utils.formatCoord(y);
        };

        this.core.onZoomChanged = (zoomPercent) => {
            this.elements.zoomIndicator.textContent = zoomPercent + '%';
            this.elements.zoomIndicator.classList.add('visible');
            clearTimeout(this.zoomTimeout);
            this.zoomTimeout = setTimeout(() => this.elements.zoomIndicator.classList.remove('visible'), 1500);
        };
    }

    requestRender() { this.core.requestRender(); }

    render() {
        if (this.core.renderBase()) {
            this.renderer.drawZones();
            this.renderer.drawImageOverlays();
            this.renderer.drawSelection();
            const toolState = this.toolManager.getCurrentDrawState();
            this.renderer.drawSnapPreview(toolState.snapPreview);
            this.renderer.drawCurrentShape(
                toolState.toolName,
                toolState.points,
                toolState.tempShape || { closeLoopHover: toolState.closeLoopHover },
                this.core.snapToGrid(this.eventHandler.lastMousePos || { x: 0, y: 0 })
            );
            if (this.zonePropertiesUI) this.zonePropertiesUI.updateFloatingPosition();
        }
    }

    setupEventListeners() {
        this.elements.btnUpload.addEventListener('click', () => this.elements.fileInput.click());
        this.elements.fileInput.addEventListener('change', (e) => this.fileHandler.handleFileSelect(e));
        this.elements.btnAddOverlayImage.addEventListener('click', () => this.elements.overlayImageInput.click());
        this.elements.overlayImageInput.addEventListener('change', (e) => this.fileHandler.handleOverlayImageSelect(e));

        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => {
                const toolName = btn.dataset.tool;
                this.toolManager.setTool(toolName);
                this.toolbarUI?.setActiveTool(toolName);
            });
        });

        this.elements.btnZoomIn.addEventListener('click', () => this.core.setZoom(0.2));
        this.elements.btnZoomOut.addEventListener('click', () => this.core.setZoom(-0.2));
        this.elements.btnFitView.addEventListener('click', () => this.core.fitToView());

        this.elements.btnToggleSnap.addEventListener('click', () => {
            const enabled = this.core.toggleSnap();
            this.elements.btnToggleSnap.classList.toggle('active', enabled);
        });

        this.elements.btnUndo.addEventListener('click', () => this.historyManager.undo());
        this.elements.btnRedo.addEventListener('click', () => this.historyManager.redo());

        this.elements.btnSaveProject.addEventListener('click', () => this.projectManager.saveProject());
        this.elements.btnLoadProject.addEventListener('click', () => this.elements.projectInput.click());
        this.elements.projectInput.addEventListener('change', (e) => this.projectManager.handleProjectLoad(e));

        this.elements.btnExport.addEventListener('click', () => this.showExportModal());
        this.elements.btnCloseExport.addEventListener('click', () => this.hideExportModal());
        this.elements.btnCancelExport.addEventListener('click', () => this.hideExportModal());
        this.elements.btnConfirmExport.addEventListener('click', () => this.handleExport());

        this.elements.exportModal.addEventListener('click', (e) => {
            if (e.target === this.elements.exportModal) this.hideExportModal();
        });
    }

    showUploadScreen(keepTabs = false) {
        if (!keepTabs) this.elements.tabBar.innerHTML = '';
        this.elements.uploadPrompt.style.display = 'flex';
        this.elements.canvas.classList.remove('visible');
        this.elements.mapInfo.textContent = "No map loaded";
        this.imageOverlayManager.selectOverlay(null, { render: false });
        this.updateUI();
    }

    openDocumentation() {
        const docsUrl = new URL('docs.html', window.location.href).toString();
        window.location.href = docsUrl;
    }

    showExportModal() { this.elements.exportModal.classList.add('visible'); }
    hideExportModal() { this.elements.exportModal.classList.remove('visible'); }

    handleExport() {
        const format = document.querySelector('input[name="exportFormat"]:checked').value;
        const settings = {
            mapScale: parseFloat(this.elements.mapScale.value) || 1,
            originX: parseFloat(this.elements.originX.value) || 0,
            originY: parseFloat(this.elements.originY.value) || 0,
            invertY: this.elements.invertY.checked,
            textureSuffix: this.elements.textureSuffix?.value || Constants.DEFAULT_TEXTURE_SUFFIX,
            resizeToPow2: this.elements.resizePow2?.checked ?? true,
            baseName: this.elements.baseName?.value || Constants.DEFAULT_EXPORT_FILENAME
        };
        this.exportHandler.export(format, settings);
        this.hideExportModal();
    }

    updateUI() {
        this.elements.btnUndo.disabled = !this.historyManager.canUndo();
        this.elements.btnRedo.disabled = !this.historyManager.canRedo();
        this.elements.btnExport.disabled = this.zoneManager.getZones().length === 0 && !this.imageOverlayManager.hasOverlays();
        this.elements.btnAddOverlayImage.disabled = !this.core.mapImage;
    }

    duplicateSelectedZone() {
        const zone = this.zoneManager.getSelectedZone();
        if (!zone) return;
        this.historyManager.saveHistory();
        const newZoneData = Utils.deepClone(zone);
        Utils.offsetZone(newZoneData, 20);
        delete newZoneData.id;
        const newZone = this.zoneManager.createZone(zone.shape, newZoneData);
        this.zoneManager.selectZone(newZone.id);
        this.updateUI();
    }
}

document.addEventListener('DOMContentLoaded', () => { window.app = new ZoneEditorApp(); });
