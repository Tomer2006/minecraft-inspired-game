import * as THREE from 'three';
import { BLOCKS } from '../Chunk.js';
import { DOMElements } from '../domElements.js';

export class PlayerInteraction {
  constructor(player) {
    this.player = player;
    this.raycaster = new THREE.Raycaster();
  }

  setupInteraction() {
    DOMElements.document.addEventListener('mousedown', (event) => {
      if (this.player.inventory.isOpen) return;
      if (!this.player.controls.isLocked) return;

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
            console.log(`Breaking block type ${blockType} at ${x}, ${y}, ${z}`);
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
              console.log(`Placing block type ${item.type} at ${x}, ${y}, ${z}`);
              this.player.terrain.setBlock(x, y, z, item.type);
              this.player.inventory.consumeSelectedItem();
            }
          }
        }
      }
    });
  }
}
