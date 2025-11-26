import { DOMElements } from '../domElements.js';

export class PlayerUI {
  constructor(player) {
    this.player = player;
    this.perfHistory = []; // Buffer for average calculation
  }

  setupInGameUI() {
    // Options UI
    const inpRenderDist = DOMElements.inpRenderDist;
    const valRenderDist = DOMElements.valRenderDist;
    const checkShowFps = DOMElements.checkShowFps;
    const checkShowCoords = DOMElements.checkShowCoords;
    const checkEnableShadows = DOMElements.checkEnableShadows;
    const checkShowPerformance = DOMElements.checkShowPerformance;

    const fpsCounter = DOMElements.fpsCounter;
    const coordsDisplay = DOMElements.coordsDisplay;
    const perfChartContainer = DOMElements.perfChartContainer;

    // Sensitivity UI
    const inpSensitivity = DOMElements.inpSensitivity;
    const valSensitivity = DOMElements.valSensitivity;

    // Max FPS UI
    const inpMaxFps = DOMElements.inpMaxFps;
    const valMaxFps = DOMElements.valMaxFps;

    // Keybinds UI
    const keybindList = DOMElements.keybindList;
    const btnResetKeybinds = DOMElements.btnResetKeybinds;

    // Init In-Game Options
    if (checkShowFps) {
      checkShowFps.addEventListener('change', (e) => {
        fpsCounter.style.display = e.target.checked ? 'block' : 'none';
      });
    }

    if (checkShowCoords) {
      checkShowCoords.addEventListener('change', (e) => {
        coordsDisplay.style.display = e.target.checked ? 'block' : 'none';
      });
    }

    if (checkEnableShadows) {
      checkEnableShadows.checked = this.player.enableShadows;
      checkEnableShadows.addEventListener('change', (e) => {
        this.player.enableShadows = e.target.checked;
        this.player.settings.save();

        if (this.player.renderer) {
          this.player.renderer.shadowMap.enabled = this.player.enableShadows;
          // Shadows often require a materials update or scene graph traversal to take effect dynamically in Three.js
          // toggling castShadow on light is often cleaner
          this.player.scene.traverse(obj => {
            if (obj.isDirectionalLight) {
              obj.castShadow = this.player.enableShadows;
            }
            if (obj.material) {
              obj.material.needsUpdate = true;
            }
          });
        }
      });
    }

    if (checkShowPerformance) {
      checkShowPerformance.checked = this.player.showPerformanceChart;
      checkShowPerformance.addEventListener('change', (e) => {
        this.player.showPerformanceChart = e.target.checked;
        this.player.settings.save();
        perfChartContainer.style.display = e.target.checked ? 'block' : 'none';
      });
    }
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
    const chart = DOMElements.perfPieChart;
    const updateVal = DOMElements.perfUpdateVal;
    const terrainVal = DOMElements.perfTerrainVal;
    const renderVal = DOMElements.perfRenderVal;

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
