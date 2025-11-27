import * as THREE from 'three';
import { DOMElements } from '../domElements.js';

export class PlayerControls {
  constructor(player) {
    this.player = player;
  }

  setupCustomControls() {
    // Mimic PointerLockControls but with sensitivity support
    this.player.controls = {
      isLocked: false,
      lock: () => {
        DOMElements.body.requestPointerLock();
      },
      unlock: () => {
        DOMElements.document.exitPointerLock();
      },
      getObject: () => this.player.head,
      addEventListener: (type, listener) => {
        // Simple event system
        if (!this.player.controls.listeners) this.player.controls.listeners = {};
        if (!this.player.controls.listeners[type]) this.player.controls.listeners[type] = [];
        this.player.controls.listeners[type].push(listener);
      },
      dispatchEvent: (event) => {
        if (this.player.controls.listeners && this.player.controls.listeners[event.type]) {
          this.player.controls.listeners[event.type].forEach(cb => cb(event));
        }
      }
    };

    // Add event listeners for pointer lock state
    const onPointerlockChange = () => {
      if (DOMElements.document.pointerLockElement === DOMElements.body) {
        this.player.controls.isLocked = true;
        this.player.controls.dispatchEvent({ type: 'lock' });
      } else {
        this.player.controls.isLocked = false;
        this.player.controls.dispatchEvent({ type: 'unlock' });
      }
    };
    DOMElements.document.addEventListener('pointerlockchange', onPointerlockChange);

    // Handle Mouse Look
    const onMouseMove = (event) => {
      if (!this.player.controls.isLocked) return;
      // If chat is open, don't process mouse movement
      if (window.chat && window.chat.isOpen) return;

      const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
      const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

      const euler = new THREE.Euler(0, 0, 0, 'YXZ');
      euler.setFromQuaternion(this.player.head.quaternion);

      // Apply Sensitivity (0.002 is standard base speed)
      euler.y -= movementX * 0.002 * this.player.sensitivity;
      euler.x -= movementY * 0.002 * this.player.sensitivity;

      // Clamp vertical look
      euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));

      this.player.head.quaternion.setFromEuler(euler);
    };
    DOMElements.document.addEventListener('mousemove', onMouseMove);
  }

  setupInputs() {
    const onKeyDown = (event) => {
      // If chat is open, don't process any controls
      if (window.chat && window.chat.isOpen) {
        return;
      }

      // Inventory Toggle
      if (event.code === this.player.keybinds.inventory) {
        if (this.player.inventory.toggle()) {
          this.player.controls.unlock();
        } else {
          this.player.controls.lock();
        }
        return;
      }

      // Perspective Toggle
      if (event.code === this.player.keybinds.perspective) {
        this.player.cycleCameraMode();
        return;
      }

      // Hotbar Selection (1-9)
      if (event.key >= '1' && event.key <= '9') {
        this.player.inventory.selectSlot(parseInt(event.key) - 1);
        return;
      }

      if (this.player.inventory.isOpen) return;

      switch (event.code) {
        case this.player.keybinds.forward:
        case 'ArrowUp':
          this.player.movementState.forward = true;
          break;
        case this.player.keybinds.backward:
        case 'ArrowDown':
          this.player.movementState.backward = true;
          break;
        case this.player.keybinds.left:
        case 'ArrowLeft':
          this.player.movementState.left = true;
          break;
        case this.player.keybinds.right:
        case 'ArrowRight':
          this.player.movementState.right = true;
          break;
        case this.player.keybinds.jump:
          this.player.movementState.jump = true;
          break;
        case this.player.keybinds.sneak:
          this.player.movementState.sneak = true;
          break;
      }
    };

    const onKeyUp = (event) => {
      // If chat is open, don't process any controls
      if (window.chat && window.chat.isOpen) {
        return;
      }

      switch (event.code) {
        case this.player.keybinds.forward:
        case 'ArrowUp':
          this.player.movementState.forward = false;
          break;
        case this.player.keybinds.backward:
        case 'ArrowDown':
          this.player.movementState.backward = false;
          break;
        case this.player.keybinds.left:
        case 'ArrowLeft':
          this.player.movementState.left = false;
          break;
        case this.player.keybinds.right:
        case 'ArrowRight':
          this.player.movementState.right = false;
          break;
        case this.player.keybinds.jump:
          this.player.movementState.jump = false;
          break;
        case this.player.keybinds.sneak:
          this.player.movementState.sneak = false;
          break;
      }
    };

    DOMElements.document.addEventListener('keydown', onKeyDown);
    DOMElements.document.addEventListener('keyup', onKeyUp);
  }
}
