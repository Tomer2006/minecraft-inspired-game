/**
 * Centralized collection of DOM element references used throughout the application.
 * Uses lazy loading to ensure elements are retrieved only when needed and cached.
 */

const cache = {};

const get = (id) => {
    if (!cache[id]) {
        const el = document.getElementById(id);
        if (el) {
            cache[id] = el;
        } else {
            return null;
        }
    }
    return cache[id];
};

export const DOMElements = {
    // Global
    get document() { return document; },
    get body() { return document.body; },
    get documentElement() { return document.documentElement; },

    // Overlay & Menus
    get overlay() { return get('overlay'); },
    get menuMain() { return get('menu-main'); },
    get menuIngame() { return get('menu-ingame'); },
    get menuPlay() { return get('menu-play'); },
    get menuOptions() { return get('menu-options'); },
    get menuCreate() { return get('menu-create'); },
    get menuRename() { return get('menu-rename'); },
    get usernameModal() { return get('username-modal'); },

    // Buttons
    get btnResume() { return get('btn-resume'); },
    get btnOptions() { return get('btn-options'); },
    get btnOptionsIngame() { return get('btn-options-ingame'); },
    get btnMainMenu() { return get('btn-main-menu'); },
    get btnBackMain() { return get('btn-back-main'); },
    get btnBackMainOpt() { return get('btn-back-main-opt'); },
    get btnCreateWorldMenu() { return get('btn-create-world-menu'); },
    get btnFullscreen() { return get('btn-fullscreen'); },
    get btnConfirmCreate() { return get('btn-confirm-create'); },
    get btnBackCreate() { return get('btn-back-create'); },
    get btnConfirmRename() { return get('btn-confirm-rename'); },
    get btnBackRename() { return get('btn-back-rename'); },
    get btnResetKeybinds() { return get('btn-reset-keybinds'); },
    get btnJoinMultiplayer() { return get('btn-join-multiplayer'); },
    get btnCancelUsername() { return get('btn-cancel-username'); },

    // Inputs
    get inpWorldName() { return get('inp-world-name'); },
    get inpRenameWorld() { return get('inp-rename-world'); },
    get inpUsername() { return get('inp-username'); },
    get inpRenderDist() { return get('opt-render-dist'); },
    get inpSensitivity() { return get('opt-sensitivity'); },
    get inpMaxFps() { return get('opt-max-fps'); },

    // Value Displays
    get valRenderDist() { return get('val-render-dist'); },
    get valSensitivity() { return get('val-sensitivity'); },
    get valMaxFps() { return get('val-max-fps'); },

    // Checkboxes
    get checkShowFps() { return get('opt-show-fps'); },
    get checkShowCoords() { return get('opt-show-coords'); },
    get checkEnableShadows() { return get('opt-enable-shadows'); },
    get checkShowPerformance() { return get('opt-show-performance'); },

    // HUD / Displays
    get fpsCounter() { return get('fps-counter'); },
    get coordsDisplay() { return get('coords-display'); },
    get worldListContainer() { return get('world-list-container'); },
    get keybindList() { return get('keybind-list'); },

    // Performance Chart
    get perfChartContainer() { return get('perf-chart-container'); },
    get perfPieChart() { return get('perf-pie-chart'); },
    get perfUpdateVal() { return get('perf-update-val'); },
    get perfTerrainVal() { return get('perf-terrain-val'); },
    get perfLightingVal() { return get('perf-lighting-val'); },
    get perfShadowsVal() { return get('perf-shadows-val'); },
    get perfRenderVal() { return get('perf-render-val'); },
    get perfDayNightVal() { return get('perf-daynight-val'); },
    get perfAvgChart() { return get('perf-avg-chart'); },
    get perfAvgUpdate() { return get('perf-avg-update'); },
    get perfAvgTerrain() { return get('perf-avg-terrain'); },
    get perfAvgRender() { return get('perf-avg-render'); },

    // Inventory
    get hotbar() { return get('hotbar'); },
    get mainInventoryGrid() { return get('main-inventory-grid'); },
    get hotbarInventoryGrid() { return get('hotbar-inventory-grid'); },
    get inventoryScreen() { return get('inventory-screen'); },
    get floatingItem() { return get('floating-item'); },
};
