import { DOMElements } from './domElements.js';

export class MainMenuUI {
  constructor(player) {
    this.player = player;
  }

  setupOverlay() {
    const overlay = DOMElements.overlay;

    // Screens
    const menuMain = DOMElements.menuMain;
    const menuPlay = DOMElements.menuPlay;
    const menuOptions = DOMElements.menuOptions;

    // Buttons
    const btnPlay = DOMElements.btnPlay;
    const btnResume = DOMElements.btnResume;
    const btnContinue = DOMElements.btnContinue;
    const btnOptions = DOMElements.btnOptions;
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
      menuMain.style.display = 'flex';
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

    // Pointer Lock Events for main menu logic
    this.player.controls.addEventListener('unlock', () => {
      if (this.player.inventory.isOpen) {
        overlay.style.display = 'none';
      } else {
        overlay.style.display = 'grid';

        // Determine if we are in a game session or just starting
        const isPlaying = !!this.player.worldHandler.currentWorldId || (window.multiplayer && window.multiplayer.isConnected);

        if (isPlaying) {
          // In-game Pause State
          if (this.player.worldHandler.currentWorldId) {
             this.player.worldHandler.saveWorld(this.player.worldHandler.currentWorldId);
          }

          if (btnContinue) btnContinue.style.display = 'none'; // Hide old button if present
          if (btnResume) btnResume.style.display = 'block'; // Show new Resume button

          // Don't change the text of Singleplayer button, just show Continue
        } else {
          // Title Screen State
          if (btnContinue) btnContinue.style.display = 'none';
          if (btnResume) btnResume.style.display = 'none';
        }

        backToMain();
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
}
