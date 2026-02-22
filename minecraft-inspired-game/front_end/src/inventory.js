import { BLOCKS } from './Chunk.js';
import { DOMElements } from './domElements.js';

export class Inventory {
  constructor(player = null) {
    this.player = player; // Reference to player for multiplayer updates
    this.INVENTORY_SIZE = 36; // 9 hotbar + 27 main
    this.HOTBAR_SIZE = 9;

    // Inventory State
    this.slots = new Array(this.INVENTORY_SIZE).fill(null).map(() => ({ type: BLOCKS.AIR, count: 0 }));
    this.selectedSlot = 0; // 0-8 (Hotbar)
    this.isOpen = false;
    
    // Held Item (for drag & drop)
    this.heldItem = { type: BLOCKS.AIR, count: 0 };
    
    // DOM Elements - Retrieved via DOMElements module
    // Note: These properties will hold the DOM elements. If called before DOM is ready, they might be null.
    // However, in module scripts, this code usually runs after DOM parsing.
    this.hotbarEl = DOMElements.hotbar;
    this.mainInventoryGridEl = DOMElements.mainInventoryGrid;
    this.hotbarInventoryGridEl = DOMElements.hotbarInventoryGrid;
    this.inventoryScreenEl = DOMElements.inventoryScreen;
    this.floatingItemEl = DOMElements.floatingItem;
    
    // Initial items for testing
    this.slots[0] = { type: BLOCKS.GRASS, count: 999 };
    this.slots[1] = { type: BLOCKS.DIRT, count: 999 };
    this.slots[2] = { type: BLOCKS.STONE, count: 999 };
    this.slots[3] = { type: BLOCKS.SNOW, count: 999 };
    this.slots[4] = { type: BLOCKS.WOOD, count: 999 };
    this.slots[5] = { type: BLOCKS.LEAVES, count: 999 };
    
    this.setupEventListeners();
    this.updateUI();
  }

  setupEventListeners() {
    // Mouse Move for Floating Item
    document.addEventListener('mousemove', (e) => {
      if (this.isOpen && this.heldItem.count > 0 && this.floatingItemEl) {
        this.floatingItemEl.style.left = `${e.clientX - 20}px`; // Center on cursor
        this.floatingItemEl.style.top = `${e.clientY - 20}px`;
      }
    });
  }

  getBlockTexture(type) {
    return `url('./textures/${type}.png')`;
  }

  createSlotElement(index, isHotbarDisplay = false) {
    const item = this.slots[index];
    const slot = document.createElement('div');
    slot.className = 'slot';
    
    if (isHotbarDisplay && index === this.selectedSlot) {
      slot.classList.add('selected');
    }

    if (item.count > 0 && item.type !== BLOCKS.AIR) {
      const icon = document.createElement('div');
      icon.className = 'block-icon';
      icon.style.backgroundImage = this.getBlockTexture(item.type);
      slot.appendChild(icon);

      const count = document.createElement('div');
      count.className = 'slot-count';
      count.innerText = item.count;
      slot.appendChild(count);
    }
    
    // Inventory Interaction: Click to Move
    if (!isHotbarDisplay) {
      slot.addEventListener('click', () => {
        this.handleInventoryClick(index);
      });
    }

    return slot;
  }

  handleInventoryClick(index) {
    const slotItem = this.slots[index];

    // Case 1: Holding nothing -> Pick up item
    if (this.heldItem.count === 0) {
      if (slotItem.count > 0) {
        this.heldItem.type = slotItem.type;
        this.heldItem.count = slotItem.count;
        slotItem.type = BLOCKS.AIR;
        slotItem.count = 0;
      }
    } 
    // Case 2: Holding something
    else {
      // Case 2a: Slot is empty -> Place item
      if (slotItem.count === 0) {
        slotItem.type = this.heldItem.type;
        slotItem.count = this.heldItem.count;
        this.heldItem.type = BLOCKS.AIR;
        this.heldItem.count = 0;
      } 
      // Case 2b: Slot has same item -> Stack
      else if (slotItem.type === this.heldItem.type) {
        const space = 999 - slotItem.count;
        const add = Math.min(this.heldItem.count, space);
        slotItem.count += add;
        this.heldItem.count -= add;
        if (this.heldItem.count === 0) this.heldItem.type = BLOCKS.AIR;
      } 
      // Case 2c: Slot has different item -> Swap
      else {
        const tempType = slotItem.type;
        const tempCount = slotItem.count;
        slotItem.type = this.heldItem.type;
        slotItem.count = this.heldItem.count;
        this.heldItem.type = tempType;
        this.heldItem.count = tempCount;
      }
    }

    this.updateUI();
  }

  updateUI() {
    if (!this.hotbarEl) return; // Guard in case DOM not ready

    // 1. Update Hotbar HUD
    this.hotbarEl.innerHTML = '';
    for (let i = 0; i < this.HOTBAR_SIZE; i++) {
      this.hotbarEl.appendChild(this.createSlotElement(i, true));
    }

    // 2. Update Full Inventory Screen (if open)
    if (this.isOpen) {
      this.hotbarEl.style.display = 'none'; // Hide main HUD hotbar
      
      if (this.mainInventoryGridEl) {
        this.mainInventoryGridEl.innerHTML = '';
        // Main inventory (indices 9 to 35)
        for (let i = this.HOTBAR_SIZE; i < this.INVENTORY_SIZE; i++) {
            this.mainInventoryGridEl.appendChild(this.createSlotElement(i));
        }
      }

      if (this.hotbarInventoryGridEl) {
        this.hotbarInventoryGridEl.innerHTML = '';
        // Hotbar row in inventory (indices 0 to 8)
        for (let i = 0; i < this.HOTBAR_SIZE; i++) {
            this.hotbarInventoryGridEl.appendChild(this.createSlotElement(i));
        }
      }

      // 3. Update Floating Item
      if (this.heldItem.count > 0 && this.floatingItemEl) {
        this.floatingItemEl.style.display = 'flex';
        this.floatingItemEl.innerHTML = '';
        
        const icon = document.createElement('div');
        icon.className = 'block-icon';
        icon.style.backgroundImage = this.getBlockTexture(this.heldItem.type);
        this.floatingItemEl.appendChild(icon);

        const count = document.createElement('div');
        count.className = 'slot-count';
        count.innerText = this.heldItem.count;
        this.floatingItemEl.appendChild(count);
      } else if (this.floatingItemEl) {
        this.floatingItemEl.style.display = 'none';
      }
    } else {
      this.hotbarEl.style.display = 'flex'; // Show main HUD hotbar
      if (this.floatingItemEl) this.floatingItemEl.style.display = 'none';
    }
  }

  toggle() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      // Show cursor so player can click inventory slots
      if (this.player?.controls?.unlock) this.player.controls.unlock();
      if (this.inventoryScreenEl) this.inventoryScreenEl.style.display = 'flex';
      this.updateUI();
    } else {
      // Hide cursor again for gameplay
      if (this.player?.controls?.lock) this.player.controls.lock();
      if (this.inventoryScreenEl) this.inventoryScreenEl.style.display = 'none';
      this.updateUI();
    }
    return this.isOpen;
  }

  addItem(type, count = 1) {
    // 1. Try to stack with existing items
    for (let i = 0; i < this.INVENTORY_SIZE; i++) {
      if (this.slots[i].type === type && this.slots[i].count < 999) {
        const space = 999 - this.slots[i].count;
        const add = Math.min(count, space);
        this.slots[i].count += add;
        count -= add;
        if (count === 0) break;
      }
    }

    // 2. Find empty slot
    if (count > 0) {
      for (let i = 0; i < this.INVENTORY_SIZE; i++) {
        if (this.slots[i].count === 0) {
          this.slots[i].type = type;
          this.slots[i].count = count;
          count = 0;
          break;
        }
      }
    }

    this.updateUI();
    return count === 0; // true if fully added
  }

  consumeSelectedItem() {
    const item = this.slots[this.selectedSlot];
    if (item.count > 0) {
      item.count--;
      if (item.count === 0) item.type = BLOCKS.AIR;
      this.updateUI();
      return true;
    }
    return false;
  }

  getSelectedItem() {
    return this.slots[this.selectedSlot];
  }

  selectSlot(index) {
    if (index >= 0 && index < this.HOTBAR_SIZE) {
      this.selectedSlot = index;
      this.updateUI();
    }
  }
}
