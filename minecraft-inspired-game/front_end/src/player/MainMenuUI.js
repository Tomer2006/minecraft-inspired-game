import * as THREE from 'three';
import { DOMElements } from '../domElements.js';
import { SettingsUI } from './SettingsUI.js';

/**
 * Main Menu UI - handles the main menu screen (title screen)
 * This is separate from the in-game UI and handles main-menu navigation
 * Uses a separate Three.js Scene for 3D menu rendering
 */
export class MainMenuUI {
  constructor(player, singlePlayerUI, multiplayerUI, sharedSettingsUI = null, renderer = null) {
    this.player = player;
    this.singlePlayerUI = singlePlayerUI;
    this.multiplayerUI = multiplayerUI;
    this.renderer = renderer;
    // Use shared settings UI if provided, otherwise create a new one
    this.settingsUI = sharedSettingsUI || new SettingsUI(player);
    // Set custom callback for back button (only used when not in-game)
    this.settingsUI.onBackCallback = () => this.handleSettingsBack();
    // Callback for when user wants to join multiplayer (set by main.js)
    this.onJoinMultiplayer = null;
    
    // Create separate scene for menu
    this.scene = new THREE.Scene();
    this.camera = null;
    this.menuObjects = [];
    this.isVisible = false;
    
    // Animation state
    this.animationTime = 0;
  }

  setup() {
    // Setup Three.js menu scene
    this._setupMenuScene();
    
    // Ensure DOM is ready before accessing elements
    // If elements aren't ready, wait for DOMContentLoaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this._setupEventListeners());
    } else {
      // DOM is already ready
      this._setupEventListeners();
    }
  }

  _setupEventListeners() {
    const menuMain = DOMElements.menuMain;
    const menuPlay = DOMElements.menuPlay;
    const btnPlay = DOMElements.btnPlay;
    const btnOptions = DOMElements.btnOptions;

    // Debug: Log if elements are missing (helps diagnose issues)
    if (!btnPlay) console.warn('MainMenuUI: btnPlay element not found - button will not work');
    if (!btnOptions) console.warn('MainMenuUI: btnOptions element not found - button will not work');

    // Singleplayer button - navigate to world selection
    if (btnPlay) {
      btnPlay.addEventListener('click', () => {
        if (menuMain) menuMain.style.display = 'none';
        if (menuPlay) menuPlay.style.display = 'flex';
        this.isVisible = true; // Keep Scene 0 visible for world selection menu
        const worldListContainer = DOMElements.worldListContainer;
        if (worldListContainer) {
          this.singlePlayerUI.renderWorldList(worldListContainer);
        }
      });
    }

    // Options button - show settings
    if (btnOptions) {
      btnOptions.addEventListener('click', () => {
        if (menuMain) menuMain.style.display = 'none';
        this.settingsUI.show();
      });
    }
  }

  handleSettingsBack() {
    const menuMain = DOMElements.menuMain;
    const menuOptions = DOMElements.menuOptions;
    
    // Hide settings menu
    if (menuOptions) menuOptions.style.display = 'none';
    
    // Show main menu (only if not in a game session)
    const isPlaying = !!this.player.worldHandler?.currentWorldId || 
                      (window.multiplayer && window.multiplayer.isConnected);
    
    if (!isPlaying && menuMain) {
      menuMain.style.display = 'flex';
      this.isVisible = true; // Show 3D menu scene when returning to main menu
    }
  }

  show() {
    const menuMain = DOMElements.menuMain;
    const overlay = DOMElements.overlay;
    
    if (menuMain && overlay) {
      overlay.style.display = 'grid';
      menuMain.style.display = 'flex';
      this.isVisible = true;
    }
  }

  hide() {
    const menuMain = DOMElements.menuMain;
    
    if (menuMain) {
      menuMain.style.display = 'none';
    }
    this.isVisible = false;
  }

  _setupMenuScene() {
    // Create camera for menu scene
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 5, 15);
    this.camera.lookAt(0, 0, 0);

    // Set background color (darker sky blue)
    this.scene.background = new THREE.Color(0x4a90a4);
    this.scene.fog = new THREE.Fog(0x4a90a4, 10, 50);

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    // Add directional light
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 5);
    this.scene.add(dirLight);

    // 3D cubes removed - Scene 0 is now just background and lighting
    // this._createTitle();
    // this._createBackgroundElements();
  }

  _createTitle() {
    // Create a simple 3D title using boxes
    const titleGroup = new THREE.Group();
    
    // Create "MINECRAFT" style title with blocks
    const titleText = "MINECRAFT";
    const blockSize = 0.8;
    const spacing = 1.0;
    
    // Simple representation - you could use a font loader for actual text
    // For now, create a stylized block-based title
    const titleBlock = new THREE.Group();
    
    // Create a large block structure as title
    const geometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
    const materials = [
      new THREE.MeshStandardMaterial({ color: 0x55aa55 }), // grass top
      new THREE.MeshStandardMaterial({ color: 0x8b4513 }), // dirt side
      new THREE.MeshStandardMaterial({ color: 0x8b4513 }),
      new THREE.MeshStandardMaterial({ color: 0x8b4513 }),
      new THREE.MeshStandardMaterial({ color: 0x8b4513 }),
      new THREE.MeshStandardMaterial({ color: 0x8b4513 })
    ];
    
    // Create a simple title structure
    for (let i = 0; i < 5; i++) {
      const block = new THREE.Mesh(geometry, materials);
      block.position.set(i * spacing - 2, 2, 0);
      titleBlock.add(block);
    }
    
    titleGroup.add(titleBlock);
    titleGroup.position.set(0, 3, 0);
    this.scene.add(titleGroup);
    this.menuObjects.push(titleGroup);
  }

  _createBackgroundElements() {
    // Create floating blocks in the background
    const blockGeometry = new THREE.BoxGeometry(1, 1, 1);
    const blockMaterials = [
      new THREE.MeshStandardMaterial({ color: 0x55aa55 }), // grass
      new THREE.MeshStandardMaterial({ color: 0x8b4513 }), // dirt
      new THREE.MeshStandardMaterial({ color: 0x888888 }), // stone
      new THREE.MeshStandardMaterial({ color: 0xffffff }), // snow
    ];

    for (let i = 0; i < 20; i++) {
      const material = blockMaterials[Math.floor(Math.random() * blockMaterials.length)];
      const block = new THREE.Mesh(blockGeometry, material);
      
      // Random position around the scene
      block.position.set(
        (Math.random() - 0.5) * 30,
        Math.random() * 10,
        (Math.random() - 0.5) * 30 - 10
      );
      
      // Random rotation
      block.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      
      // Store original position for animation
      block.userData.originalY = block.position.y;
      block.userData.rotationSpeed = (Math.random() - 0.5) * 0.02;
      block.userData.floatSpeed = Math.random() * 0.01 + 0.005;
      
      this.scene.add(block);
      this.menuObjects.push(block);
    }
  }

  update(delta) {
    if (!this.isVisible) return;

    this.animationTime += delta;

    // 3D cubes removed - no objects to animate
    // Camera movement removed - static camera for clean menu background
    // if (this.camera) {
    //   this.camera.position.x = Math.sin(this.animationTime * 0.3) * 2;
    //   this.camera.position.y = 5 + Math.cos(this.animationTime * 0.2) * 0.5;
    //   this.camera.lookAt(0, 0, 0);
    // }
  }

  render() {
    if (!this.isVisible || !this.renderer || !this.camera) return;
    // Render Scene 0 (menu scene)
    this.renderer.render(this.scene, this.camera);
  }
}
