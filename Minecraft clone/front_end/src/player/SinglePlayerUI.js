import { DOMElements } from '../domElements.js';
import { SettingsUI } from './SettingsUI.js';

/**
 * Single Player UI - handles all single player specific menus
 * (world selection, world creation, world management)
 */
export class SinglePlayerUI {
  constructor(player, sharedSettingsUI = null) {
    this.player = player;
    // Use shared settings UI if provided, otherwise create a new one
    this.settingsUI = sharedSettingsUI || new SettingsUI(player);
    // Set custom callback for back button (only used when not in-game)
    this.settingsUI.onBackCallback = () => this.handleSettingsBack();
  }

  setup() {
    const menuPlay = DOMElements.menuPlay;
    const menuCreate = DOMElements.menuCreate;
    const menuRename = DOMElements.menuRename;
    const btnCreateWorldMenu = DOMElements.btnCreateWorldMenu;
    const btnConfirmCreate = DOMElements.btnConfirmCreate;
    const btnBackCreate = DOMElements.btnBackCreate;
    const btnBackMain = DOMElements.btnBackMain;
    const btnConfirmRename = DOMElements.btnConfirmRename;
    const btnBackRename = DOMElements.btnBackRename;
    const inpWorldName = DOMElements.inpWorldName;
    const inpRenameWorld = DOMElements.inpRenameWorld;

    // Create New World button - show create world menu
    if (btnCreateWorldMenu) {
      btnCreateWorldMenu.addEventListener('click', () => {
        if (menuPlay) menuPlay.style.display = 'none';
        if (menuCreate) menuCreate.style.display = 'flex';
        if (inpWorldName) {
          inpWorldName.value = '';
          inpWorldName.focus();
        }
      });
    }

    // Confirm Create World button
    if (btnConfirmCreate) {
      btnConfirmCreate.addEventListener('click', () => {
        const worldName = inpWorldName ? inpWorldName.value.trim() : '';
        const finalName = worldName || `World ${Date.now()}`;
        const worldId = 'world_' + Date.now();
        
        // Load the new world
        this.player.worldHandler.loadWorld(worldId, true, finalName);
        
        // Hide menus
        if (menuCreate) menuCreate.style.display = 'none';
        if (menuPlay) menuPlay.style.display = 'none';
        const menuMain = DOMElements.menuMain;
        if (menuMain) menuMain.style.display = 'none';
        // Hide Scene 0 and switch to Scene 1 (game) when starting a new world
        if (this.player.ui && this.player.ui.mainMenuUI) {
          this.player.ui.mainMenuUI.isVisible = false;
        }
      });
    }

    // Back from Create World menu
    if (btnBackCreate) {
      btnBackCreate.addEventListener('click', () => {
        if (menuCreate) menuCreate.style.display = 'none';
        if (menuPlay) menuPlay.style.display = 'flex';
        // Keep Scene 0 visible when returning to world selection
        if (this.player.ui && this.player.ui.mainMenuUI) {
          this.player.ui.mainMenuUI.isVisible = true;
        }
        // Re-render world list in case a new world was created
        const worldListContainer = DOMElements.worldListContainer;
        if (worldListContainer) {
          this.renderWorldList(worldListContainer);
        }
      });
    }

    // Back to Main Menu button
    if (btnBackMain) {
      btnBackMain.addEventListener('click', () => {
        if (menuPlay) menuPlay.style.display = 'none';
        const menuMain = DOMElements.menuMain;
        if (menuMain) menuMain.style.display = 'flex';
        // Show 3D menu scene when returning to main menu
        if (this.player.ui && this.player.ui.mainMenuUI) {
          this.player.ui.mainMenuUI.isVisible = true;
        }
      });
    }

    // Confirm Rename World button
    if (btnConfirmRename) {
      btnConfirmRename.addEventListener('click', () => {
        const newName = inpRenameWorld ? inpRenameWorld.value.trim() : '';
        if (newName && this.renamingWorldId) {
          this.player.worldHandler.renameWorld(this.renamingWorldId, newName);
          
          // Hide rename menu and show world list
          if (menuRename) menuRename.style.display = 'none';
          if (menuPlay) menuPlay.style.display = 'flex';
          // Keep Scene 0 visible when returning to world selection
          if (this.player.ui && this.player.ui.mainMenuUI) {
            this.player.ui.mainMenuUI.isVisible = true;
          }
          
          // Re-render world list
          const worldListContainer = DOMElements.worldListContainer;
          if (worldListContainer) {
            this.renderWorldList(worldListContainer);
          }
          
          this.renamingWorldId = null;
        }
      });
    }

    // Cancel Rename World button
    if (btnBackRename) {
      btnBackRename.addEventListener('click', () => {
        if (menuRename) menuRename.style.display = 'none';
        if (menuPlay) menuPlay.style.display = 'flex';
        this.renamingWorldId = null;
      });
    }

    // Handle Enter key in world name input
    if (inpWorldName) {
      inpWorldName.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && btnConfirmCreate) {
          btnConfirmCreate.click();
        }
      });
    }

    // Handle Enter key in rename input
    if (inpRenameWorld) {
      inpRenameWorld.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && btnConfirmRename) {
          btnConfirmRename.click();
        }
      });
    }
  }

  renderWorldList(container) {
    if (!container) return;

    // Clear existing world items (but keep the "Create New World" button)
    const createBtn = container.querySelector('#btn-create-world-menu');
    container.innerHTML = '';
    if (createBtn) {
      container.appendChild(createBtn);
    }

    // Get saved worlds from localStorage
    const worlds = JSON.parse(localStorage.getItem('minecraft_worlds') || '[]');
    
    // Sort by creation date (newest first)
    worlds.sort((a, b) => (b.created || 0) - (a.created || 0));

    // Create world items
    worlds.forEach(world => {
      const worldItem = document.createElement('div');
      worldItem.className = 'menu-btn world-select-item';
      
      const worldInfo = document.createElement('div');
      worldInfo.className = 'world-info';
      worldInfo.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 4px;">${this.escapeHtml(world.name)}</div>
        <div style="font-size: 12px; color: #aaa;">
          Created: ${new Date(world.created || Date.now()).toLocaleDateString()}
        </div>
      `;
      
      const worldActions = document.createElement('div');
      worldActions.className = 'world-actions';
      
      // Play button
      const playBtn = document.createElement('button');
      playBtn.className = 'icon-btn';
      playBtn.textContent = 'Play';
      playBtn.addEventListener('click', () => {
        this.player.worldHandler.loadWorld(world.id, false);
        const menuPlay = DOMElements.menuPlay;
        const menuMain = DOMElements.menuMain;
        if (menuPlay) menuPlay.style.display = 'none';
        if (menuMain) menuMain.style.display = 'none';
        // Hide Scene 0 and switch to Scene 1 (game) when starting a world
        if (this.player.ui && this.player.ui.mainMenuUI) {
          this.player.ui.mainMenuUI.isVisible = false;
        }
      });
      
      // Rename button
      const renameBtn = document.createElement('button');
      renameBtn.className = 'icon-btn';
      renameBtn.textContent = 'Rename';
      renameBtn.addEventListener('click', () => {
        this.renamingWorldId = world.id;
        const menuRename = DOMElements.menuRename;
        const menuPlay = DOMElements.menuPlay;
        const inpRenameWorld = DOMElements.inpRenameWorld;
        if (menuPlay) menuPlay.style.display = 'none';
        if (menuRename) menuRename.style.display = 'flex';
        // Keep Scene 0 visible for rename menu
        if (this.player.ui && this.player.ui.mainMenuUI) {
          this.player.ui.mainMenuUI.isVisible = true;
        }
        if (inpRenameWorld) {
          inpRenameWorld.value = world.name;
          inpRenameWorld.focus();
          inpRenameWorld.select();
        }
      });
      
      // Delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'icon-btn delete';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => {
        if (confirm(`Are you sure you want to delete "${world.name}"?`)) {
          this.player.worldHandler.deleteWorld(world.id);
          // Re-render the list
          this.renderWorldList(container);
        }
      });
      
      worldActions.appendChild(playBtn);
      worldActions.appendChild(renameBtn);
      worldActions.appendChild(deleteBtn);
      
      worldItem.appendChild(worldInfo);
      worldItem.appendChild(worldActions);
      
      container.appendChild(worldItem);
    });

    // If no worlds exist, show a message
    if (worlds.length === 0) {
      const noWorldsMsg = document.createElement('div');
      noWorldsMsg.style.cssText = 'text-align: center; color: #888; padding: 20px; font-style: italic;';
      noWorldsMsg.textContent = 'No saved worlds. Create a new world to get started!';
      container.appendChild(noWorldsMsg);
    }
  }

  handleSettingsBack() {
    const menuPlay = DOMElements.menuPlay;
    const menuOptions = DOMElements.menuOptions;
    
    // Hide settings menu
    if (menuOptions) menuOptions.style.display = 'none';
    
    // Show world selection menu (only if not in a game session)
    const isPlaying = !!this.player.worldHandler?.currentWorldId;
    
    if (!isPlaying && menuPlay) {
      menuPlay.style.display = 'flex';
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
