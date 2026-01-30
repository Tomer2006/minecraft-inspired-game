import { DOMElements } from '../domElements.js';
import { SinglePlayerUI } from './SinglePlayerUI.js';
import { MultiplayerUI } from './MultiplayerUI.js';
import { MainMenuUI } from './MainMenuUI.js';
import { SettingsUI } from './SettingsUI.js';

export class PlayerUI {
  constructor(player, renderer = null) {
    this.player = player;
    this.renderer = renderer;
    this.perfHistory = []; // Buffer for average calculation
    
    // Create shared settings UI instance that all UIs will use
    const sharedSettingsUI = new SettingsUI(player);
    
    // Create separate UI objects for single player and multiplayer
    // Both share the same settings UI instance so settings are consistent
    this.singlePlayerUI = new SinglePlayerUI(player, sharedSettingsUI);
    this.multiplayerUI = new MultiplayerUI(player, sharedSettingsUI);
    
    // Create main menu UI (separate from in-game UI) with renderer for 3D scene
    // Use Scene 0 (menu scene) if available globally, otherwise let it create its own
    const menuScene = window.scenes && window.scenes[0] ? window.scenes[0] : null;
    this.mainMenuUI = new MainMenuUI(player, this.singlePlayerUI, this.multiplayerUI, sharedSettingsUI, renderer, menuScene);
  }

  setupOverlay() {
    // Setup shared settings UI first (only once)
    // The settings UI is shared between all UIs
    if (this.singlePlayerUI.settingsUI) {
      this.singlePlayerUI.settingsUI.setup();
    }
    
    // Setup main menu UI (handles title screen)
    this.mainMenuUI.setup();
    
    // Setup both in-game UI systems
    this.singlePlayerUI.setup();
    this.multiplayerUI.setup();
    
    // Setup unified unlock handler that determines which menu to show
    this.setupUnlockHandler();
    
    // Show main menu scene initially
    this.mainMenuUI.show();
  }

  setupUnlockHandler() {
    const overlay = DOMElements.overlay;
    const menuMain = DOMElements.menuMain;
    const menuIngame = DOMElements.menuIngame;

    // Unified unlock handler - shows menu when controls unlock
    this.player.controls.addEventListener('lock', () => {
      overlay.style.display = 'none';
    });

    this.player.controls.addEventListener('unlock', () => {
      if (this.player.inventory.isOpen) {
        overlay.style.display = 'none';
        return;
      }

      overlay.style.display = 'grid';

      // Determine game mode
      const isSinglePlayer = !!this.player.worldHandler?.currentWorldId;
      const isMultiplayer = window.multiplayer && window.multiplayer.isConnected;
      const isPlaying = isSinglePlayer || isMultiplayer;

      // Check if main menu is already being shown (e.g., from Main Menu button click)
      const mainMenuVisible = menuMain.style.display === 'flex' || menuMain.style.display === 'grid';

      if (isPlaying && !mainMenuVisible) {
        // In-game Menu State - Show in-game menu (game continues running)
        // Save world if in single player mode
        if (isSinglePlayer && this.player.worldHandler.currentWorldId) {
          this.player.worldHandler.saveWorld(this.player.worldHandler.currentWorldId);
        }

        // Hide main menu, show in-game menu
        menuMain.style.display = 'none';
        menuIngame.style.display = 'flex';
      } else if (!isPlaying || mainMenuVisible) {
        // Title Screen State - Show main menu (or keep main menu if already shown)
        menuMain.style.display = 'flex';
        menuIngame.style.display = 'none';
      }
    });
  }

  /**
   * Completely exit the game and return to main menu
   * This resets all game state including world, multiplayer, terrain, player position, etc.
   */
  exitToMainMenu() {
    const overlay = DOMElements.overlay;
    const menuMain = DOMElements.menuMain;
    const menuIngame = DOMElements.menuIngame;

    // 1. Unload single player world if exists
    if (this.player.worldHandler?.currentWorldId) {
      this.player.worldHandler.unloadWorld();
    }

    // 2. Disconnect multiplayer if connected
    if (window.multiplayer) {
      window.multiplayer.disconnect();
      window.multiplayer = null;
    }

    // 3. Clear chat
    if (window.chat) {
      window.chat.setMultiplayer(null);
      window.chat.closeChat();
    }

    // 4. Close inventory if open
    if (this.player.inventory.isOpen) {
      this.player.inventory.toggle();
    }

    // 5. Reset terrain to default state (clear all chunks and reset seed)
    if (this.player.terrain) {
      this.player.terrain.setSeed("default");
      this.player.terrain.clearModifiedBlocks();
      this.player.terrain.hasUnsavedChanges = false;
      this.player.terrain.lastSaveTime = 0;
    }

    // 6. Reset player position to spawn area
    const eyeHeight = this.player.physics.STANDING_EYE_HEIGHT;
    const spawnHeight = this.player.terrain.getHeightAtWorld(0, 0);
    this.player.head.position.set(0, spawnHeight + eyeHeight + 5, 8);
    this.player.physics.velocity.set(0, 0, 0);

    // 7. Unlock controls if locked
    if (this.player.controls.isLocked) {
      this.player.controls.unlock();
    }

    // 8. Show main menu
    overlay.style.display = 'grid';
    menuIngame.style.display = 'none';
    menuMain.style.display = 'flex';
    
    // Show Scene 0 (menu scene) when returning to main menu
    if (this.mainMenuUI) {
      this.mainMenuUI.isVisible = true;
    }
  }

  // Delegate renderWorldList to single player UI
  renderWorldList(container) {
    return this.singlePlayerUI.renderWorldList(container);
  }

  updatePerformanceChart(metrics) {
    if (!this.player.showPerformanceChart) return;

    const now = performance.now();
    this.perfHistory.push({ time: now, metrics });

    // Remove entries older than 60 seconds (60000 ms)
    const cutoff = now - 60000;
    while (this.perfHistory.length > 0 && this.perfHistory[0].time < cutoff) {
      this.perfHistory.shift();
    }

    // --- Update Live Chart ---
    const liveChart = DOMElements.perfPieChart;
    const liveTerrainVal = DOMElements.perfTerrainVal;
    const livePhysicsVal = DOMElements.perfUpdateVal;
    const liveLightingVal = DOMElements.perfLightingVal;
    const liveShadowsVal = DOMElements.perfShadowsVal;
    const liveRenderVal = DOMElements.perfRenderVal;
    const liveDayNightVal = DOMElements.perfDayNightVal;

    if (liveChart && liveTerrainVal && livePhysicsVal && liveLightingVal && liveShadowsVal && liveRenderVal && liveDayNightVal) {
      const tTerrain = metrics.terrain || 0;
      const tPhysics = metrics.physics || 0;
      const tLighting = metrics.lighting || 0;
      const tShadows = metrics.shadows || 0;
      const tRender = metrics.render || 0;
      const tDayNight = metrics.dayNight || 0;
      const total = tTerrain + tPhysics + tLighting + tShadows + tRender + tDayNight;

      if (total > 0) {
        const pTerrain = (tTerrain / total) * 100;
        const pPhysics = (tPhysics / total) * 100;
        const pLighting = (tLighting / total) * 100;
        const pShadows = (tShadows / total) * 100;
        const pRender = (tRender / total) * 100;
        const pDayNight = (tDayNight / total) * 100;

        // Create conic gradient with 6 categories
        const stops = [
          { color: '#66ff66', start: 0, end: pTerrain },                          // Green: Terrain
          { color: '#ff6666', start: pTerrain, end: pTerrain + pPhysics },          // Red: Physics
          { color: '#ffaa00', start: pTerrain + pPhysics, end: pTerrain + pPhysics + pLighting }, // Orange: Lighting
          { color: '#aa6600', start: pTerrain + pPhysics + pLighting, end: pTerrain + pPhysics + pLighting + pShadows }, // Brown: Shadows
          { color: '#6666ff', start: pTerrain + pPhysics + pLighting + pShadows, end: pTerrain + pPhysics + pLighting + pShadows + pRender }, // Blue: Render
          { color: '#ff66ff', start: pTerrain + pPhysics + pLighting + pShadows + pRender, end: 100 } // Magenta: Day/Night
        ];

        const gradientParts = stops.map(stop =>
          `${stop.color} ${stop.start}% ${stop.end}%`
        ).join(', ');

        liveChart.style.background = `conic-gradient(${gradientParts})`;

        // Update display values with proper formatting
        liveTerrainVal.innerText = tTerrain.toFixed(2);
        livePhysicsVal.innerText = tPhysics.toFixed(2);
        liveLightingVal.innerText = tLighting.toFixed(2);
        liveShadowsVal.innerText = tShadows.toFixed(2);
        liveRenderVal.innerText = tRender.toFixed(2);
        liveDayNightVal.innerText = tDayNight.toFixed(2);
      }
    }

    // --- Update Average Chart (throttle to once every 30 frames or 500ms to save perf) ---
    // Just doing it every frame for now but only iterating if history exists
    if (this.perfHistory.length > 0) {
      const avgChart = DOMElements.perfAvgChart;
      const avgUpdateVal = DOMElements.perfAvgUpdate;
      const avgTerrainVal = DOMElements.perfAvgTerrain;
      const avgRenderVal = DOMElements.perfAvgRender;

      if (avgChart && avgUpdateVal && avgTerrainVal && avgRenderVal) {
        let sumTerrain = 0;
        let sumPhysics = 0;
        let sumLighting = 0;
        let sumShadows = 0;
        let sumRender = 0;
        let sumDayNight = 0;

        for (const entry of this.perfHistory) {
          sumTerrain += entry.metrics.terrain || 0;
          sumPhysics += entry.metrics.physics || 0;
          sumLighting += entry.metrics.lighting || 0;
          sumShadows += entry.metrics.shadows || 0;
          sumRender += entry.metrics.render || 0;
          sumDayNight += entry.metrics.dayNight || 0;
        }

        const count = this.perfHistory.length;
        const avgTerrain = sumTerrain / count;
        const avgPhysics = sumPhysics / count;
        const avgLighting = sumLighting / count;
        const avgShadows = sumShadows / count;
        const avgRender = sumRender / count;
        const avgDayNight = sumDayNight / count;
        const avgTotal = avgTerrain + avgPhysics + avgLighting + avgShadows + avgRender + avgDayNight;

        if (avgTotal > 0) {
          const apTerrain = (avgTerrain / avgTotal) * 100;
          const apPhysics = (avgPhysics / avgTotal) * 100;
          const apLighting = (avgLighting / avgTotal) * 100;
          const apShadows = (avgShadows / avgTotal) * 100;
          const apRender = (avgRender / avgTotal) * 100;
          const apDayNight = (avgDayNight / avgTotal) * 100;

          // Create conic gradient with 6 categories for average chart
          const stops = [
            { color: '#66ff66', start: 0, end: apTerrain },
            { color: '#ff6666', start: apTerrain, end: apTerrain + apPhysics },
            { color: '#ffaa00', start: apTerrain + apPhysics, end: apTerrain + apPhysics + apLighting },
            { color: '#aa6600', start: apTerrain + apPhysics + apLighting, end: apTerrain + apPhysics + apLighting + apShadows },
            { color: '#6666ff', start: apTerrain + apPhysics + apLighting + apShadows, end: apTerrain + apPhysics + apLighting + apShadows + apRender },
            { color: '#ff66ff', start: apTerrain + apPhysics + apLighting + apShadows + apRender, end: 100 }
          ];

          const gradientParts = stops.map(stop =>
            `${stop.color} ${stop.start}% ${stop.end}%`
          ).join(', ');

          avgChart.style.background = `conic-gradient(${gradientParts})`;

          // Update average display values (keeping old element names for compatibility)
          avgUpdateVal.innerText = avgPhysics.toFixed(2);
          avgTerrainVal.innerText = avgTerrain.toFixed(2);
          avgRenderVal.innerText = avgRender.toFixed(2);
        }
      }
    }
  }
}
