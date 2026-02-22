import { DOMElements } from '../domElements.js';

/**
 * Shared Settings UI - handles the options menu that is shared between
 * single player and multiplayer modes
 */
export class SettingsUI {
  constructor(player) {
    this.player = player;
    this._isSetup = false;
    this._customOnBack = null; // Custom callback for back button (only used when not in-game)
  }

  setup() {
    // Only setup once, even if called multiple times
    if (this._isSetup) {
      return;
    }
    this._isSetup = true;

    // Options UI Elements
    const menuOptions = DOMElements.menuOptions;
    const inpRenderDist = DOMElements.inpRenderDist;
    const valRenderDist = DOMElements.valRenderDist;
    const checkShowFps = DOMElements.checkShowFps;
    const checkShowCoords = DOMElements.checkShowCoords;
    const checkEnableShadows = DOMElements.checkEnableShadows;
    const checkShowPerformance = DOMElements.checkShowPerformance;
    const fpsCounter = DOMElements.fpsCounter;
    const coordsDisplay = DOMElements.coordsDisplay;
    const perfChartContainer = DOMElements.perfChartContainer;
    const inpSensitivity = DOMElements.inpSensitivity;
    const valSensitivity = DOMElements.valSensitivity;
    const inpMaxFps = DOMElements.inpMaxFps;
    const valMaxFps = DOMElements.valMaxFps;
    const keybindList = DOMElements.keybindList;
    const btnResetKeybinds = DOMElements.btnResetKeybinds;
    const btnFullscreen = DOMElements.btnFullscreen;
    const btnBackMainOpt = DOMElements.btnBackMainOpt;

    // Init Options
    if (inpRenderDist && valRenderDist) {
      inpRenderDist.value = this.player.terrain.renderDistance;
      valRenderDist.innerText = this.player.terrain.renderDistance;

      inpRenderDist.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        valRenderDist.innerText = val;
      });

      inpRenderDist.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10);
        this.player.terrain.renderDistance = val;
        this.player.settings.save();
      });
    }

    if (inpSensitivity && valSensitivity) {
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
      valMaxFps.innerText = this.player.maxFps === 0 ? 'Unlimited' : this.player.maxFps;

      inpMaxFps.addEventListener('input', (e) => {
        let val = parseInt(e.target.value, 10);
        // Treat max value (121) as unlimited
        if (val > 120) val = 0;
        valMaxFps.innerText = val === 0 ? 'Unlimited' : val;
      });

      inpMaxFps.addEventListener('change', (e) => {
        let val = parseInt(e.target.value, 10);
        if (val > 120) val = 0;
        this.player.maxFps = val;
        this.player.settings.save();
      });
    }

    if (checkShowFps && fpsCounter) {
      checkShowFps.addEventListener('change', (e) => {
        fpsCounter.style.display = e.target.checked ? 'block' : 'none';
      });
    }

    if (checkShowCoords && coordsDisplay) {
      // Set initial state - coordinates are visible by default
      checkShowCoords.checked = true;
      coordsDisplay.style.display = 'block';

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
          this.player.scene.traverse((obj) => {
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

    if (checkShowPerformance && perfChartContainer) {
      checkShowPerformance.checked = this.player.showPerformanceChart;
      checkShowPerformance.addEventListener('change', (e) => {
        this.player.showPerformanceChart = e.target.checked;
        this.player.settings.save();
        perfChartContainer.style.display = e.target.checked ? 'block' : 'none';
      });
    }

    const defaultKeybinds = {
      forward: 'KeyW',
      backward: 'KeyS',
      left: 'KeyA',
      right: 'KeyD',
      jump: 'Space',
      sneak: 'ShiftLeft',
      inventory: 'KeyE',
      perspective: 'KeyR',
      chat: 'KeyT'
    };

    // Render Keybinds
    const renderKeybinds = () => {
      if (!keybindList) return;
      keybindList.innerHTML = '';

      for (const [action, key] of Object.entries(this.player.keybinds)) {
        const label = document.createElement('div');
        label.className = 'keybind-label';
        label.innerText = action.charAt(0).toUpperCase() + action.slice(1);

        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'keybind-controls';

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
        btnResetOne.innerText = 'Reset';
        btnResetOne.title = 'Reset to Default';
        btnResetOne.style.padding = '4px 8px';
        btnResetOne.style.fontSize = '12px';
        btnResetOne.style.color = '#aaa';
        btnResetOne.style.width = 'auto';

        btnResetOne.addEventListener('click', () => {
          this.player.keybinds[action] = defaultKeybinds[action];
          this.player.settings.save();
          renderKeybinds();
        });

        const btnUnbind = document.createElement('button');
        btnUnbind.className = 'menu-btn';
        btnUnbind.innerText = 'X';
        btnUnbind.title = 'Unbind';
        btnUnbind.style.padding = '4px 8px';
        btnUnbind.style.fontSize = '12px';
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
            forward: 'KeyW',
            backward: 'KeyS',
            left: 'KeyA',
            right: 'KeyD',
            jump: 'Space',
            sneak: 'ShiftLeft',
            inventory: 'KeyE',
            perspective: 'KeyR',
            chat: 'KeyT'
          };
          this.player.settings.save();
          renderKeybinds();
        }
      });
    }

    if (btnFullscreen) {
      btnFullscreen.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {
            // Handle fullscreen error silently
          });
        } else {
          document.exitFullscreen();
        }
      });
    }

    // Back button - delegates to parent UI to determine where to go
    if (btnBackMainOpt) {
      btnBackMainOpt.addEventListener('click', () => {
        this.onBack();
      });
    }
  }

  /**
   * Called when back button is clicked in options menu
   * Checks current game state to determine where to navigate back to
   * If in-game, returns to in-game menu. Otherwise, calls custom callback if set.
   */
  onBack() {
    const menuOptions = DOMElements.menuOptions;
    const menuMain = DOMElements.menuMain;
    const menuIngame = DOMElements.menuIngame;

    if (menuOptions) menuOptions.style.display = 'none';

    // Determine which menu to show based on game state
    // Check both single player (worldHandler) and multiplayer states
    const isPlaying = !!this.player.worldHandler?.currentWorldId || (window.multiplayer && window.multiplayer.isConnected);

    if (isPlaying) {
      // In-game: return to in-game menu (Scene 1)
      if (menuIngame) menuIngame.style.display = 'flex';
      if (menuMain) menuMain.style.display = 'none';
      // Hide menu scene when showing in-game menu (uses Scene 1)
      if (this.player.ui && this.player.ui.mainMenuUI) {
        this.player.ui.mainMenuUI.isVisible = false;
      }
    } else {
      // Not in-game: use custom callback if set, otherwise show main menu
      if (this._customOnBack) {
        this._customOnBack();
      } else {
        if (menuMain) menuMain.style.display = 'flex';
        if (menuIngame) menuIngame.style.display = 'none';
        // Show menu scene when returning to main menu (Scene 0)
        if (this.player.ui && this.player.ui.mainMenuUI) {
          this.player.ui.mainMenuUI.isVisible = true;
        }
      }
    }
  }

  /**
   * Setter for custom back button callback (only used when not in-game)
   * This allows different UI components to customize navigation behavior
   */
  set onBackCallback(callback) {
    this._customOnBack = callback;
  }

  /**
   * Show the options menu
   */
  show() {
    const menuOptions = DOMElements.menuOptions;
    if (menuOptions) {
      menuOptions.style.display = 'flex';
    }
  }

  /**
   * Hide the options menu
   */
  hide() {
    const menuOptions = DOMElements.menuOptions;
    if (menuOptions) {
      menuOptions.style.display = 'none';
    }
  }
}
