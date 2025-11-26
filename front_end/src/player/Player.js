import * as THREE from 'three';
import { Inventory } from '../inventory.js';
import { PlayerSettings } from './Settings.js';
import { PlayerControls } from './Controls.js';
import { PlayerPhysics } from './Physics.js';
import { PlayerInteraction } from './Interaction.js';
import { PlayerUI } from './UI.js';
import { WorldHandler } from './WorldHandler.js';

export class Player {
  constructor(scene, camera, terrain, renderer) {
    this.camera = camera;
    this.terrain = terrain;
    this.renderer = renderer;
    this.scene = scene;

    // State
    this.direction = new THREE.Vector3();
    this.movementState = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sneak: false
    };

    // Keybinds (Default)
    this.keybinds = {
      'forward': 'KeyW',
      'backward': 'KeyS',
      'left': 'KeyA',
      'right': 'KeyD',
      'jump': 'Space',
      'sneak': 'ShiftLeft',
      'inventory': 'KeyE',
      'perspective': 'KeyR'
    };

    // Settings State
    this.sensitivity = 1.0;
    this.enableShadows = true;
    this.showPerformanceChart = false;
    this.maxFps = 0; // 0 = Unlimited

    // Inventory
    this.inventory = new Inventory();

    // Sub-modules
    this.settings = new PlayerSettings(this);
    this.physics = new PlayerPhysics(this);
    this.controlsHandler = new PlayerControls(this); // "controls" property will be the actual controls object
    this.interaction = new PlayerInteraction(this);
    this.ui = new PlayerUI(this);
    this.worldHandler = new PlayerWorldHandler(this); // Wait, I named the class WorldHandler

    // Camera Mode State
    this.cameraMode = 0; // 0: First Person, 1: Third Person Back, 2: Third Person Front
    
    // Player Head (Virtual Object for Physics/Controls)
    this.head = new THREE.Object3D();
    this.head.rotation.order = 'YXZ';
    this.scene.add(this.head);

    // Player Body Mesh (Visuals)
    const bodyGeometry = new THREE.BoxGeometry(0.6, 1.8, 0.6);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x3333ff });
    this.mesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.visible = false; // Hidden in first person initially
    this.scene.add(this.mesh);

    // Load Settings
    this.settings.load();

    // Apply initial settings
    if (this.renderer) {
      this.renderer.shadowMap.enabled = this.enableShadows;
      this.scene.traverse(obj => {
        if (obj.isDirectionalLight) {
          obj.castShadow = this.enableShadows;
        }
      });
    }

    // Setup
    this.controlsHandler.setupCustomControls(); // Sets this.controls
    // Note: Camera is no longer the primary object being controlled, this.head is.
    // But we don't add camera to scene here if we want to manipulate it freely? 
    // Actually main.js might expect it in scene? main.js doesn't add it. 
    // Player.js line 70 added it.
    this.scene.add(this.camera); 
    
    this.controlsHandler.setupInputs();
    this.interaction.setupInteraction();
    this.ui.setupOverlay();
  }

  cycleCameraMode() {
    this.cameraMode = (this.cameraMode + 1) % 3;
    this.mesh.visible = this.cameraMode !== 0;
  }

  updateCamera() {
    // Sync mesh with head
    this.mesh.position.copy(this.head.position);
    this.mesh.position.y -= 0.78; // Offset to center body (Eye height 1.68 - Half Height 0.9 = 0.78 down)
    
    // Only copy Y rotation to mesh (avoid tilting body)
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.setFromQuaternion(this.head.quaternion);
    this.mesh.rotation.y = euler.y;

    // Camera Positioning
    if (this.cameraMode === 0) { // First Person
        this.camera.position.copy(this.head.position);
        this.camera.quaternion.copy(this.head.quaternion);
    } else if (this.cameraMode === 1) { // Third Person Back
        // Calculate position behind head
        const backOffset = new THREE.Vector3(0, 0, 4); // 4 units back
        backOffset.applyQuaternion(this.head.quaternion);
        this.camera.position.copy(this.head.position).add(backOffset);
        this.camera.lookAt(this.head.position);
    } else if (this.cameraMode === 2) { // Third Person Front
        // Calculate position in front of head
        const frontOffset = new THREE.Vector3(0, 0, -4); // 4 units front
        frontOffset.applyQuaternion(this.head.quaternion);
        this.camera.position.copy(this.head.position).add(frontOffset);
        this.camera.lookAt(this.head.position);
    }
  }

  // Delegation for Physics Constants accessed externally (e.g. main.js)
  get STANDING_EYE_HEIGHT() { return this.physics.STANDING_EYE_HEIGHT; }
  get SNEAK_EYE_HEIGHT() { return this.physics.SNEAK_EYE_HEIGHT; }
  get PLAYER_WIDTH() { return this.physics.PLAYER_WIDTH; }
  get STANDING_HEIGHT() { return this.physics.STANDING_HEIGHT; }
  get SNEAK_HEIGHT() { return this.physics.SNEAK_HEIGHT; }

  // Delegate Methods
  update(delta) {
    this.physics.update(delta);
    this.updateCamera();
  }

  updatePerformanceChart(metrics) {
    this.ui.updatePerformanceChart(metrics);
  }
  
  // World Handler Delegations (if accessed externally, though usually via UI)
  loadWorld(id, isNew, customName) {
    this.worldHandler.loadWorld(id, isNew, customName);
  }
  
  saveSettings() {
    this.settings.save();
  }
}

// Helper alias for the import in case I messed up the class name in WorldHandler.js initialization
import { WorldHandler as PlayerWorldHandler } from './WorldHandler.js';
