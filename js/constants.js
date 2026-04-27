/**
 * Application Constants
 * Centralized configuration values to eliminate magic numbers
 */
const Constants = {
    // ==================== CANVAS ====================
    /** Grid size in pixels for canvas background */
    CANVAS_GRID_SIZE: 50,

    /** Snap grid size in map units */
    SNAP_GRID_SIZE: 100,

    /** Rotation snap increment in degrees when snap mode is enabled */
    SNAP_ROTATION_STEP: 15,

    /** Minimum zoom level */
    MIN_ZOOM: 0.1,

    /** Maximum zoom level */
    MAX_ZOOM: 5,

    /** Fit to view margin (% of container) */
    FIT_VIEW_MARGIN: 0.9,

    // ==================== ZONES ====================
    /** Minimum size for shapes to be created (prevents accidental clicks) */
    MIN_SHAPE_SIZE: 5,

    /** Default zone opacity (0-1) */
    DEFAULT_ZONE_OPACITY: 0.4,

    /** Selection handle size in pixels */
    HANDLE_SIZE: 8,

    /** Handle hit area size (slightly larger for easier clicking) */
    HANDLE_HIT_SIZE: 12,

    /** Offset for duplicate/paste operations */
    DUPLICATE_OFFSET: 20,
    PASTE_OFFSET: 30,

    // ==================== DRAWING ====================
    /** Line thickness for selected shapes */
    LINE_WIDTH_SELECTED: 3,

    /** Line thickness for hovered shapes */
    LINE_WIDTH_HOVERED: 2,

    /** Line thickness for normal shapes */
    LINE_WIDTH_NORMAL: 1.5,

    /** Line hit detection threshold in pixels */
    LINE_HIT_THRESHOLD: 10,

    /** Minimum distance between freehand points (reduces jitter) */
    FREEHAND_MIN_DISTANCE: 3,

    /** Path simplification tolerance for freehand tool */
    PATH_SIMPLIFICATION_TOLERANCE: 2,

    /** Close loop detection threshold in pixels */
    CLOSE_LOOP_THRESHOLD: 10,

    // ==================== LABELS ====================
    /** Label font sizes */
    LABEL_SIZE_SMALL: 10,
    LABEL_SIZE_MEDIUM: 14,
    LABEL_SIZE_LARGE: 18,

    /** Minimum label font size */
    LABEL_MIN_SIZE_RATIO: 0.7,

    /** Default label background opacity */
    DEFAULT_LABEL_BG_OPACITY: 0.7,

    // ==================== UI ====================
    /** Zoom indicator hide delay in ms */
    ZOOM_INDICATOR_HIDE_DELAY: 1500,

    /** Maximum history entries */
    MAX_HISTORY_SIZE: 50,

    /** Endpoint circle radius in pixels */
    LINE_ENDPOINT_RADIUS: 4,

    // ==================== EXPORT ====================
    /** Default texture suffix for Enfusion */
    DEFAULT_TEXTURE_SUFFIX: '_A',

    /** Default export filename */
    DEFAULT_EXPORT_FILENAME: 'zone_overlay',

    /** Export line width (fixed for consistent output) */
    EXPORT_LINE_WIDTH: 2,
    EXPORT_LINE_WIDTH_THICK: 4,

    // ==================== APP INFO ====================
    APP_VERSION: 'v1.6.32 - MODULAR',
    GITHUB_URL: 'https://github.com/Jeremy8776/ARMOZE-Map-Overlay-Zone-Editor'
};

/**
 * Freeze the object to prevent accidental modification
 * This needs to be done after the object is fully defined
 */
Object.freeze(Constants);

// Export for use in other modules
window.Constants = Constants;
