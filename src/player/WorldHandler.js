import { BLOCKS } from '../Chunk.js';

export class WorldHandler {
  constructor(player) {
    this.player = player;
    this.currentWorldId = null;
  }

  deleteWorld(id) {
    // 1. Remove from index
    let worlds = JSON.parse(localStorage.getItem('minecraft_worlds') || '[]');
    worlds = worlds.filter(w => w.id !== id);
    localStorage.setItem('minecraft_worlds', JSON.stringify(worlds));

    // 2. Remove data
    localStorage.removeItem('minecraft_save_' + id);

    console.log(`Deleted world: ${id}`);
  }

  renameWorld(id, newName) {
    let worlds = JSON.parse(localStorage.getItem('minecraft_worlds') || '[]');
    const world = worlds.find(w => w.id === id);
    if (world) {
      world.name = newName;
      localStorage.setItem('minecraft_worlds', JSON.stringify(worlds));
      console.log(`Renamed world: ${id} to ${newName}`);
    }
  }

  loadWorld(id, isNew, customName = null) {
    // 0. Auto-save current world if exists and modifications were made
    if (this.currentWorldId && this.player.terrain.hasUnsavedChanges) {
        this.saveWorld(this.currentWorldId);
    }
    
    console.log(`Loading world: ${id} (New: ${isNew})`);
    this.currentWorldId = id;

    // 1. Register world in list if new
    if (isNew) {
      const worlds = JSON.parse(localStorage.getItem('minecraft_worlds') || '[]');
      const name = customName || `World ${worlds.length + 1}`;
      worlds.push({ id, name, created: Date.now() });
      localStorage.setItem('minecraft_worlds', JSON.stringify(worlds));
    }

    // 2. Load Terrain Data
    const savedData = localStorage.getItem('minecraft_save_' + id);
    if (savedData) {
      const data = JSON.parse(savedData);

      // Restore Player
      if (data.player) {
        this.player.head.position.set(data.player.x, data.player.y, data.player.z);
        // rotation restore is tricky with PointerLockControls, usually ignored for simplicity
        if (data.inventory) {
          this.player.inventory.slots = data.inventory;
          this.player.inventory.updateUI();
        }
      } else {
        // Reset player for new world (or old save format)
        this.resetPlayer();
      }

      // Restore Terrain
      if (data.terrain) {
        this.player.terrain.loadModifiedBlocks(data.terrain, data.seed || id);
      } else {
        // Reset terrain if no terrain data found (unlikely)
        this.player.terrain.loadModifiedBlocks([], data.seed || id);
      }
    } else {
      // Brand new world
      this.resetPlayer();
      // For new worlds, we use the ID as the seed for now
      this.player.terrain.loadModifiedBlocks([], id);
    }

    // 3. Start Game
    this.player.controls.lock();
  }

  saveWorld(id) {
    console.log(`Saving world: ${id}`);
    const data = {
      player: {
        x: this.player.head.position.x,
        y: this.player.head.position.y,
        z: this.player.head.position.z
      },
      inventory: this.player.inventory.slots,
      terrain: this.player.terrain.getModifiedBlocks(),
      seed: this.player.terrain.seed
    };
    localStorage.setItem('minecraft_save_' + id, JSON.stringify(data));

    // Mark that changes have been saved
    this.player.terrain.hasUnsavedChanges = false;
    this.player.terrain.lastSaveTime = performance.now();

    console.log(`World saved successfully with ${Object.keys(data.terrain).length} modified chunks`);
  }

  resetPlayer() {
    const physics = this.player.physics;
    const eyeHeight = physics.STANDING_EYE_HEIGHT;
    const h = this.player.terrain.getHeightAtWorld(0, 0);
    this.player.head.position.set(0, h + eyeHeight + 5, 0);
    physics.velocity.set(0, 0, 0);
    // Reset inventory? Maybe keep it? Let's reset.
    this.player.inventory.slots.forEach(s => { s.type = BLOCKS.AIR; s.count = 0; });
    // Give starter items
    this.player.inventory.addItem(BLOCKS.GRASS, 999);
    this.player.inventory.addItem(BLOCKS.DIRT, 999);
    this.player.inventory.addItem(BLOCKS.STONE, 999);
    this.player.inventory.addItem(BLOCKS.SNOW, 999);
  }
}

