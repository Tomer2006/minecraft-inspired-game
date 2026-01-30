import { DOMElements } from '../domElements.js';
import { SettingsUI } from './SettingsUI.js';

/**
 * Multiplayer UI - handles all multiplayer specific menus
 * (username modal, in-game menu for multiplayer)
 */
export class MultiplayerUI {
  constructor(player, sharedSettingsUI = null) {
    this.player = player;
    // Use shared settings UI if provided, otherwise create a new one
    this.settingsUI = sharedSettingsUI || new SettingsUI(player);
    // Set custom callback for back button (only used when not in-game)
    this.settingsUI.onBackCallback = () => this.handleSettingsBack();
  }

  setup() {
    const overlay = DOMElements.overlay;
    const menuMain = DOMElements.menuMain;
    const menuIngame = DOMElements.menuIngame;
    const btnMultiplayer = DOMElements.btnMultiplayer;
    const btnResume = DOMElements.btnResume;
    const btnOptionsIngame = DOMElements.btnOptionsIngame;
    const btnMainMenu = DOMElements.btnMainMenu;
    const usernameModal = DOMElements.usernameModal;
    const btnJoinMultiplayer = DOMElements.btnJoinMultiplayer;
    const btnCancelUsername = DOMElements.btnCancelUsername;
    const inpUsername = DOMElements.inpUsername;

    // Note: Settings UI setup is handled by PlayerUI.setupOverlay() to ensure it's only called once

    // Multiplayer button - handled in main.js, but we can set up the modal here
    if (btnResume) {
      btnResume.addEventListener('click', () => {
        this.player.controls.lock();
      });
    }

    if (btnOptionsIngame) {
      btnOptionsIngame.addEventListener('click', () => {
        menuIngame.style.display = 'none';
        this.settingsUI.show();
      });
    }

    if (btnMainMenu) {
      btnMainMenu.addEventListener('click', () => {
        // Completely exit game and return to main menu
        // This is handled by PlayerUI.exitToMainMenu() which resets all game state
        if (this.player.ui) {
          this.player.ui.exitToMainMenu();
        }
      });
    }

    // Note: Pointer lock events (lock/unlock) are handled centrally by PlayerUI.setupUnlockHandler()
    // to determine which menu to show based on game mode (single player vs multiplayer)
  }

  handleSettingsBack() {
    const menuMain = DOMElements.menuMain;
    const menuOptions = DOMElements.menuOptions;
    
    // Hide settings menu
    if (menuOptions) menuOptions.style.display = 'none';
    
    // Show main menu (only if not in a game session)
    // Note: When in-game, SettingsUI.onBack() automatically shows in-game menu instead
    const isPlaying = window.multiplayer && window.multiplayer.isConnected;
    
    if (!isPlaying && menuMain) {
      menuMain.style.display = 'flex';
      // Show menu scene when returning to main menu (Scene 0)
      if (this.player.ui && this.player.ui.mainMenuUI) {
        this.player.ui.mainMenuUI.isVisible = true;
      }
    }
  }

}
