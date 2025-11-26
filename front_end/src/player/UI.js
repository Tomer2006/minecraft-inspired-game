import { DOMElements } from '../domElements.js';

export class PlayerUI {
  constructor(player) {
    this.player = player;
    this.perfHistory = []; // Buffer for average calculation
  }

  setupOverlay() {
    const overlay = DOMElements.overlay;

    // Screens
    const menuMain = DOMElements.menuMain;
    const menuIngame = DOMElements.menuIngame;
    const menuPlay = DOMElements.menuPlay;
    const menuOptions = DOMElements.menuOptions;

    // Buttons
    const btnPlay = DOMElements.btnPlay;
    const btnResume = DOMElements.btnResume;
    const btnContinue = DOMElements.btnContinue;
    const btnOptions = DOMElements.btnOptions;
    const btnOptionsIngame = DOMElements.btnOptionsIngame;
    const btnMainMenu = DOMElements.btnMainMenu;
    const btnBackMain = DOMElements.btnBackMain;
    const btnBackMainOpt = DOMElements.btnBackMainOpt;
    const btnCreateWorldMenu = DOMElements.btnCreateWorldMenu;
    const btnFullscreen = DOMElements.btnFullscreen;
    const worldListContainer = DOMElements.worldListContainer;

    // Create World Screen Elements
    const menuCreate = DOMElements.menuCreate;
    const btnConfirmCreate = DOMElements.btnConfirmCreate;
    const btnBackCreate = DOMElements.btnBackCreate;
    const inpWorldName = DOMElements.inpWorldName;

    // Rename World Screen Elements
    const menuRename = DOMElements.menuRename;
    const btnConfirmRename = DOMElements.btnConfirmRename;
    const btnBackRename = DOMElements.btnBackRename;
    const inpRenameWorld = DOMElements.inpRenameWorld;

    let worldIdToRename = null;

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

    // Init Options
    if (inpRenderDist) {
      inpRenderDist.value = this.player.terrain.renderDistance;
      valRenderDist.innerText = this.player.terrain.renderDistance;

      inpRenderDist.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        valRenderDist.innerText = val;
      });

      inpRenderDist.addEventListener('change', (e) => {
        const val = parseInt(e.target.value);
        this.player.terrain.renderDistance = val;
        this.player.settings.save();
      });
    }

    if (inpSensitivity) {
      inpSensitivity.value = this.player.sensitivity;
      valSensitivity.innerText = this.player.sensitivity;

      inpSensitivity.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.player.sensitivity = val;
        valSensitivity.innerText = val;
      });

      inpSensitivity.addEventListener('change', () => {
        this.player.settings.save();
      });
    }

    if (inpMaxFps && valMaxFps) {
      const fpsVal = this.player.maxFps === 0 ? 121 : this.player.maxFps;
      inpMaxFps.value = fpsVal;
      valMaxFps.innerText = this.player.maxFps === 0 ? "Unlimited" : this.player.maxFps;

      inpMaxFps.addEventListener('input', (e) => {
        let val = parseInt(e.target.value);
        // Treat max value (121) as unlimited
        if (val > 120) val = 0;
        
        valMaxFps.innerText = val === 0 ? "Unlimited" : val;
      });

      inpMaxFps.addEventListener('change', (e) => {
        let val = parseInt(e.target.value);
        if (val > 120) val = 0;

        this.player.maxFps = val;
        this.player.settings.save();
      });
    }

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

    const defaultKeybinds = {
      'forward': 'KeyW',
      'backward': 'KeyS',
      'left': 'KeyA',
      'right': 'KeyD',
      'jump': 'Space',
      'sneak': 'ShiftLeft',
      'inventory': 'KeyE',
      'perspective': 'KeyR'
    };

    // Render Keybinds
    const renderKeybinds = () => {
      keybindList.innerHTML = '';
      for (const [action, key] of Object.entries(this.player.keybinds)) {
        const label = document.createElement('div');
        label.innerText = action.charAt(0).toUpperCase() + action.slice(1);
        label.style.color = '#ccc';
        label.style.display = 'flex';
        label.style.alignItems = 'center';

        const controlsDiv = document.createElement('div');
        controlsDiv.style.display = 'flex';
        controlsDiv.style.gap = '5px';

        const btn = document.createElement('button');
        btn.className = 'menu-btn';
        btn.style.padding = '4px 8px';
        btn.style.fontSize = '12px';
        btn.style.minWidth = '80px';
        btn.innerText = key || 'Unbound';
        if (!key) btn.style.color = '#888';

        btn.addEventListener('click', () => {
          btn.innerText = 'Press any key...';
          btn.style.background = '#666';

          const onKey = (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Don't allow Escape to be bound, use it to cancel
            if (e.code === 'Escape') {
              renderKeybinds();
              return;
            }
            this.player.keybinds[action] = e.code;
            this.player.settings.save();
            renderKeybinds();
            document.removeEventListener('keydown', onKey);
          };
          document.addEventListener('keydown', onKey, { once: true });
        });

        const btnResetOne = document.createElement('button');
        btnResetOne.className = 'menu-btn';
        btnResetOne.innerText = '↺'; // Refresh/Reset icon
        btnResetOne.title = 'Reset to Default';
        btnResetOne.style.padding = '4px 8px';
        btnResetOne.style.fontSize = '14px';
        btnResetOne.style.color = '#aaa';
        btnResetOne.style.width = 'auto';

        btnResetOne.addEventListener('click', () => {
          this.player.keybinds[action] = defaultKeybinds[action];
          this.player.settings.save();
          renderKeybinds();
        });

        const btnUnbind = document.createElement('button');
        btnUnbind.className = 'menu-btn';
        btnUnbind.innerText = '×';
        btnUnbind.title = 'Unbind';
        btnUnbind.style.padding = '4px 8px';
        btnUnbind.style.fontSize = '14px';
        btnUnbind.style.color = '#ff6666';
        btnUnbind.style.width = 'auto';

        btnUnbind.addEventListener('click', () => {
          this.player.keybinds[action] = null;
          this.player.settings.save();
          renderKeybinds();
        });

        controlsDiv.appendChild(btn);
        controlsDiv.appendChild(btnResetOne);
        controlsDiv.appendChild(btnUnbind);

        keybindList.appendChild(label);
        keybindList.appendChild(controlsDiv);
      }
    };
    renderKeybinds();

    if (btnResetKeybinds) {
      btnResetKeybinds.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all keybinds to default?')) {
          this.player.keybinds = {
            'forward': 'KeyW',
            'backward': 'KeyS',
            'left': 'KeyA',
            'right': 'KeyD',
            'jump': 'Space',
            'sneak': 'ShiftLeft',
            'inventory': 'KeyE',
            'perspective': 'KeyR'
          };
          this.player.settings.save();
          renderKeybinds();
        }
      });
    }

    // Navigation
    btnPlay.addEventListener('click', () => {
      menuMain.style.display = 'none';
      menuPlay.style.display = 'flex';
      this.renderWorldList(worldListContainer);
    });

    if (btnContinue) {
      btnContinue.addEventListener('click', () => {
        this.player.controls.lock();
      });
    }

    if (btnResume) {
        btnResume.addEventListener('click', () => {
            this.player.controls.lock();
        });
    }

    btnOptions.addEventListener('click', () => {
      menuMain.style.display = 'none';
      menuOptions.style.display = 'flex';
    });

    if (btnOptionsIngame) {
      btnOptionsIngame.addEventListener('click', () => {
        menuIngame.style.display = 'none';
        menuOptions.style.display = 'flex';
      });
    }

    if (btnMainMenu) {
      btnMainMenu.addEventListener('click', () => {
        // Disconnect from multiplayer and return to main menu
        if (window.multiplayer) {
          window.multiplayer.disconnect();
          window.multiplayer = null;
        }

        // Clear current world
        if (this.player.worldHandler.currentWorldId) {
          this.player.worldHandler.unloadWorld();
        }

        // Return to start screen
        menuIngame.style.display = 'none';
        menuMain.style.display = 'flex';
        overlay.style.display = 'grid';
      });
    }

    btnFullscreen.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
          console.log(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
      } else {
        document.exitFullscreen();
      }
    });

    const backToMain = () => {
      menuPlay.style.display = 'none';
      menuOptions.style.display = 'none';
      menuCreate.style.display = 'none';
      menuRename.style.display = 'none';

      // Determine which main menu to show based on game state
      const isPlaying = !!this.player.worldHandler.currentWorldId || (window.multiplayer && window.multiplayer.isConnected);
      if (isPlaying) {
        menuIngame.style.display = 'flex';
        menuMain.style.display = 'none';
      } else {
        menuMain.style.display = 'flex';
        menuIngame.style.display = 'none';
      }
    };

    btnBackMain.addEventListener('click', backToMain);
    btnBackMainOpt.addEventListener('click', backToMain);

    // Create World Flow
    btnCreateWorldMenu.addEventListener('click', () => {
      menuPlay.style.display = 'none';
      menuCreate.style.display = 'flex';
      inpWorldName.value = `World ${Date.now()}`; // Default name
      inpWorldName.select();
    });

    btnBackCreate.addEventListener('click', () => {
      menuCreate.style.display = 'none';
      menuPlay.style.display = 'flex';
    });

    btnConfirmCreate.addEventListener('click', () => {
      const name = inpWorldName.value || `World ${Date.now()}`;
      const id = 'world_' + Date.now();

      // Save current world before creating new one
      if (this.player.worldHandler.currentWorldId) {
          this.player.worldHandler.saveWorld(this.player.worldHandler.currentWorldId);
      }

      this.player.worldHandler.loadWorld(id, true, name);
      // Hide menus handled by loadWorld -> lock
    });

    // Rename World Flow
    this.openRenameMenu = (id, currentName) => {
      worldIdToRename = id;
      menuPlay.style.display = 'none';
      menuRename.style.display = 'flex';
      inpRenameWorld.value = currentName;
      inpRenameWorld.select();
    };

    btnBackRename.addEventListener('click', () => {
      menuRename.style.display = 'none';
      menuPlay.style.display = 'flex';
      worldIdToRename = null;
    });

    btnConfirmRename.addEventListener('click', () => {
      if (worldIdToRename) {
        this.player.worldHandler.renameWorld(worldIdToRename, inpRenameWorld.value || 'Untitled World');
        menuRename.style.display = 'none';
        menuPlay.style.display = 'flex';
        this.renderWorldList(worldListContainer);
        worldIdToRename = null;
      }
    });

    // Pointer Lock Events
    this.player.controls.addEventListener('lock', () => {
      overlay.style.display = 'none';
    });

    this.player.controls.addEventListener('unlock', () => {
      if (this.player.inventory.isOpen) {
        overlay.style.display = 'none';
      } else {
        overlay.style.display = 'grid';

        // Determine if we are in a game session or just starting
        const isPlaying = !!this.player.worldHandler.currentWorldId || (window.multiplayer && window.multiplayer.isConnected);

        if (isPlaying) {
          // In-game Pause State - Show in-game menu
          if (this.player.worldHandler.currentWorldId) {
             this.player.worldHandler.saveWorld(this.player.worldHandler.currentWorldId);
          }

          // Hide start menu, show in-game menu
          menuMain.style.display = 'none';
          menuIngame.style.display = 'flex';
        } else {
          // Title Screen State - Show start menu
          menuMain.style.display = 'flex';
          menuIngame.style.display = 'none';
        }
      }
    });
  }

  renderWorldList(container) {
    // Clear existing world buttons (except "Create New")
    const existing = container.querySelectorAll('.world-select-item');
    existing.forEach(el => el.remove());

    // Load worlds from localStorage
    const worlds = JSON.parse(localStorage.getItem('minecraft_worlds') || '[]');

    worlds.forEach(world => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'menu-btn world-select world-select-item';
      itemDiv.style.cursor = 'default'; // Override button pointer since we have inner clickable areas

      // World Info (Clickable to Load)
      const infoDiv = document.createElement('div');
      infoDiv.className = 'world-info';
      infoDiv.innerText = world.name;
      infoDiv.addEventListener('click', () => {
        // Save current world before switching if needed
        if (this.player.worldHandler.currentWorldId) {
            this.player.worldHandler.saveWorld(this.player.worldHandler.currentWorldId);
        }
        this.player.worldHandler.loadWorld(world.id, false);
      });

      // Actions
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'world-actions';

      // Rename Button
      const btnRename = document.createElement('button');
      btnRename.className = 'icon-btn';
      btnRename.innerText = '✎'; // Pencil icon
      btnRename.title = 'Rename World';
      btnRename.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openRenameMenu(world.id, world.name);
      });

      // Delete Button
      const btnDelete = document.createElement('button');
      btnDelete.className = 'icon-btn delete';
      btnDelete.innerText = '🗑'; // Trash icon
      btnDelete.title = 'Delete World';
      btnDelete.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Are you sure you want to delete "${world.name}"? This cannot be undone.`)) {
          this.player.worldHandler.deleteWorld(world.id);
          this.renderWorldList(container);
        }
      });

      actionsDiv.appendChild(btnRename);
      actionsDiv.appendChild(btnDelete);

      itemDiv.appendChild(infoDiv);
      itemDiv.appendChild(actionsDiv);

      container.appendChild(itemDiv);
    });
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
