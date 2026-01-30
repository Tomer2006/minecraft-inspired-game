import * as THREE from 'three';
import { BLOCKS } from '../Chunk.js';
import { DOMElements } from '../domElements.js';

export class PlayerInteraction {
  constructor(player) {
    this.player = player;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 4.5; // Set block interaction range to 4.5 blocks
    
    // Create outline mesh for block highlighting
    const boxGeometry = new THREE.BoxGeometry(1.001, 1.001, 1.001); // Slightly larger to avoid z-fighting
    const edgesGeometry = new THREE.EdgesGeometry(boxGeometry);
    const outlineMaterial = new THREE.LineBasicMaterial({ 
      color: 0x000000,
      linewidth: 1,
      depthTest: true, // Enable depth test for proper rendering
      depthWrite: false,
      opacity: 1.0,
      transparent: false
    });
    this.outlineMesh = new THREE.LineSegments(edgesGeometry, outlineMaterial);
    this.outlineMesh.visible = false;
    this.outlineMesh.renderOrder = 999; // Render on top
    player.scene.add(this.outlineMesh);
    
    // Track current highlighted block
    this.currentBlock = null;
  }

  setupInteraction() {
    DOMElements.document.addEventListener('mousedown', (event) => {
      if (this.player.inventory.isOpen) return;
      if (!this.player.controls.isLocked) return;
      // Disable block interaction when chat is open
      if (window.chat && window.chat.isOpen) return;

      this.raycaster.setFromCamera({ x: 0, y: 0 }, this.player.camera);
      const intersects = this.raycaster.intersectObjects(this.player.terrain.group.children);

      if (intersects.length > 0) {
        const hit = intersects[0];
        const point = hit.point;
        const normal = hit.face.normal;

        if (event.button === 0) { // Left click: Break
          const target = point.clone().sub(normal.clone().multiplyScalar(0.01));
          const x = Math.round(target.x);
          const y = Math.round(target.y);
          const z = Math.round(target.z);

          const blockType = this.player.terrain.getBlock(x, y, z);
          if (blockType !== BLOCKS.AIR) {
            this.player.terrain.setBlock(x, y, z, BLOCKS.AIR);
            this.player.inventory.addItem(blockType, 1);
          }
        } else if (event.button === 2) { // Right click: Place
          const target = point.clone().add(normal.clone().multiplyScalar(0.01));
          const x = Math.round(target.x);
          const y = Math.round(target.y);
          const z = Math.round(target.z);

          // Check overlap
          const physics = this.player.physics;
          const playerMinX = this.player.head.position.x - physics.PLAYER_WIDTH / 2;
          const playerMaxX = this.player.head.position.x + physics.PLAYER_WIDTH / 2;
          const playerMinY = this.player.head.position.y - physics.currentEyeHeight;
          const playerMaxY = this.player.head.position.y - physics.currentEyeHeight + physics.currentPlayerHeight;
          const playerMinZ = this.player.head.position.z - physics.PLAYER_WIDTH / 2;
          const playerMaxZ = this.player.head.position.z + physics.PLAYER_WIDTH / 2;

          const blockMinX = x - 0.5;
          const blockMaxX = x + 0.5;
          const blockMinY = y - 0.5;
          const blockMaxY = y + 0.5;
          const blockMinZ = z - 0.5;
          const blockMaxZ = z + 0.5;

          const intersectsPlayer = (
            playerMinX < blockMaxX && playerMaxX > blockMinX &&
            playerMinY < blockMaxY && playerMaxY > blockMinY &&
            playerMinZ < blockMaxZ && playerMaxZ > blockMinZ
          );

          if (!intersectsPlayer) {
            const item = this.player.inventory.getSelectedItem();
            if (item.count > 0 && item.type !== BLOCKS.AIR) {
              this.player.terrain.setBlock(x, y, z, item.type);
              this.player.inventory.consumeSelectedItem();
            }
          }
        }
      }
    });
  }

  update() {
    // Only show outline when controls are locked (in game)
    if (!this.player.controls.isLocked || this.player.inventory.isOpen) {
      this.outlineMesh.visible = false;
      this.currentBlock = null;
      return;
    }
    // Don't show block outline when chat is open
    if (window.chat && window.chat.isOpen) {
      this.outlineMesh.visible = false;
      this.currentBlock = null;
      return;
    }

    // Cast ray from camera center
    this.raycaster.setFromCamera({ x: 0, y: 0 }, this.player.camera);
    const intersects = this.raycaster.intersectObjects(this.player.terrain.group.children);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const point = hit.point;
      const normal = hit.face.normal;

      // Calculate block position (the block being looked at)
      const target = point.clone().sub(normal.clone().multiplyScalar(0.01));
      const x = Math.round(target.x);
      const y = Math.round(target.y);
      const z = Math.round(target.z);

      // Check if this is a new block
      const blockKey = `${x},${y},${z}`;
      if (this.currentBlock !== blockKey) {
        this.currentBlock = blockKey;
        
        // Check if block exists and is not air
        const blockType = this.player.terrain.getBlock(x, y, z);
        if (blockType !== BLOCKS.AIR) {
          // Show outline at block position
          this.outlineMesh.position.set(x, y, z);
          this.outlineMesh.visible = true;
        } else {
          this.outlineMesh.visible = false;
        }
      }
    } else {
      // Not looking at any block
      this.outlineMesh.visible = false;
      this.currentBlock = null;
    }
  }
}
