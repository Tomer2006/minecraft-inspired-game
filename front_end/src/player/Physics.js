import * as THREE from 'three';
import { BLOCKS } from '../Chunk.js';
import { DOMElements } from '../domElements.js';

export class PlayerPhysics {
  constructor(player) {
    this.player = player;

    // Physics Constants
    this.GRAVITY = 30.0;
    this.JUMP_SPEED = 10.0;
    this.WALK_SPEED = 6.0;
    this.SPRINT_SPEED = 10.0;
    this.SNEAK_SPEED = 2.5;
    this.PLAYER_WIDTH = 0.6;
    this.STANDING_HEIGHT = 1.8;
    this.SNEAK_HEIGHT = 1.5;
    this.STANDING_EYE_HEIGHT = 1.68;
    this.SNEAK_EYE_HEIGHT = 1.5;

    // State
    this.velocity = new THREE.Vector3();
    this.onGround = false;
    this.currentPlayerHeight = this.STANDING_HEIGHT;
    this.currentEyeHeight = this.STANDING_EYE_HEIGHT;
  }

  checkCollision(position) {
    const xStart = Math.round(position.x - this.PLAYER_WIDTH / 2);
    const xEnd = Math.round(position.x + this.PLAYER_WIDTH / 2);
    const yStart = Math.round(position.y);
    const yEnd = Math.round(position.y + this.currentPlayerHeight - 0.1);
    const zStart = Math.round(position.z - this.PLAYER_WIDTH / 2);
    const zEnd = Math.round(position.z + this.PLAYER_WIDTH / 2);

    for (let x = xStart; x <= xEnd; x++) {
      for (let y = yStart; y <= yEnd; y++) {
        for (let z = zStart; z <= zEnd; z++) {
          if (this.player.terrain.getBlock(x, y, z) !== BLOCKS.AIR) {
            return true;
          }
        }
      }
    }
    return false;
  }

  update(delta) {
    const player = this.player;
    
    if (DOMElements.fpsCounter.style.display !== 'none') {
      const fps = Math.round(1 / delta);
      DOMElements.fpsCounter.innerText = `FPS: ${fps}`;
    }

    if (DOMElements.coordsDisplay.style.display !== 'none') {
      const x = Math.round(player.head.position.x);
      const y = Math.round(player.head.position.y);
      const z = Math.round(player.head.position.z);
      DOMElements.coordsDisplay.innerText = `X: ${x} Y: ${y} Z: ${z}`;
    }

    if (player.controls.isLocked) {
      // Sneaking Logic
      const targetEyeHeight = player.movementState.sneak ? this.SNEAK_EYE_HEIGHT : this.STANDING_EYE_HEIGHT;
      const lastEyeHeight = this.currentEyeHeight;
      this.currentEyeHeight += (targetEyeHeight - this.currentEyeHeight) * 10.0 * delta;

      // Adjust head Y to keep feet planted
      player.head.position.y += (this.currentEyeHeight - lastEyeHeight);

      // Update collision height
      this.currentPlayerHeight = player.movementState.sneak ? this.SNEAK_HEIGHT : this.STANDING_HEIGHT;

      // 1. Calculate movement direction from inputs
      // Skip movement processing if chat is open
      if (window.chat && window.chat.isOpen) {
        player.direction.set(0, 0, 0);
      } else {
        player.direction.x = Number(player.movementState.right) - Number(player.movementState.left);
        player.direction.z = Number(player.movementState.forward) - Number(player.movementState.backward);
        player.direction.normalize();
      }

      // 2. Apply movement forces to velocity
      const camDir = new THREE.Vector3();
      const camSide = new THREE.Vector3();
      player.head.getWorldDirection(camDir);
      camDir.negate(); // Fix: Object3D.getWorldDirection returns +Z, we want -Z (forward)
      camDir.y = 0;
      camDir.normalize();
      camSide.crossVectors(player.head.up, camDir).normalize();

      const moveVec = new THREE.Vector3();
      if (!(window.chat && window.chat.isOpen)) {
        if (player.movementState.forward) moveVec.add(camDir);
        if (player.movementState.backward) moveVec.sub(camDir);
        if (player.movementState.left) moveVec.add(camSide);
        if (player.movementState.right) moveVec.sub(camSide);
        moveVec.normalize();
      }

      const speed = player.movementState.sneak ? this.SNEAK_SPEED : this.WALK_SPEED;

      if (moveVec.lengthSq() > 0) {
        moveVec.multiplyScalar(speed);
        this.velocity.x = moveVec.x;
        this.velocity.z = moveVec.z;
      } else {
        this.velocity.x -= this.velocity.x * 10.0 * delta;
        this.velocity.z -= this.velocity.z * 10.0 * delta;
      }

      // 3. Jumping
      if (player.movementState.jump && this.onGround && !(window.chat && window.chat.isOpen)) {
        this.velocity.y = this.JUMP_SPEED;
        this.onGround = false;
      }

      // 4. Apply Gravity
      this.velocity.y -= this.GRAVITY * delta;

      // 5. Collision Resolution
      const originalPos = player.head.position.clone();
      const nextPos = originalPos.clone();

      // Apply X movement
      nextPos.x += this.velocity.x * delta;
      if (this.checkCollision(new THREE.Vector3(nextPos.x, originalPos.y - this.currentEyeHeight, originalPos.z))) {
        this.velocity.x = 0;
        nextPos.x = originalPos.x;
      }

      // Apply Z movement
      nextPos.z += this.velocity.z * delta;
      if (this.checkCollision(new THREE.Vector3(nextPos.x, originalPos.y - this.currentEyeHeight, nextPos.z))) {
        this.velocity.z = 0;
        nextPos.z = originalPos.z;
      }

      // Apply Y movement (Continuous Collision Detection approximation)
      let steps = 1;
      // If falling fast, check multiple steps to avoid tunneling
      if (Math.abs(this.velocity.y * delta) > 0.5) {
        steps = Math.ceil(Math.abs(this.velocity.y * delta) / 0.5);
      }

      let hitY = false;
      const stepY = (this.velocity.y * delta) / steps;

      for (let i = 0; i < steps; i++) {
        nextPos.y += stepY;

        if (this.checkCollision(new THREE.Vector3(nextPos.x, nextPos.y - this.currentEyeHeight, nextPos.z))) {
          if (this.velocity.y < 0) {
            // Falling - hit ground
            this.onGround = true;
            this.velocity.y = 0;
            // Snap to block surface
            const blockY = Math.round(nextPos.y - this.currentEyeHeight - 0.5);
            nextPos.y = blockY + 0.5 + this.currentEyeHeight + 0.001; // Small epsilon
            hitY = true;
            break;
          } else if (this.velocity.y > 0) {
            // Jumping - hit ceiling
            this.velocity.y = 0;
            // Snap to block bottom
            const feetY = nextPos.y - this.currentEyeHeight;
            const blockY = Math.round(feetY + this.currentPlayerHeight);
            nextPos.y = (blockY - 0.5 - this.currentPlayerHeight) + this.currentEyeHeight - 0.001;
            hitY = true;
            break;
          }
        } else {
          // Check if we are stuck inside a block (e.g. spawned inside or glitch)
          // If checking collision at current pos returns true, we are inside.
          // But we already moved.
        }
      }

      if (!hitY && this.velocity.y < 0) {
        this.onGround = false;
      }

      player.head.position.copy(nextPos);
    }
  }
}
