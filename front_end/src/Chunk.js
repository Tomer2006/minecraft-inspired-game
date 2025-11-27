import * as THREE from 'three';

export const CHUNK_SIZE = 16;

// --- Block Registry System ---

export const BLOCKS = {
  AIR: 'air',
  GRASS: 'grass',
  DIRT: 'dirt',
  STONE: 'stone',
  SNOW: 'snow',
  WOOD: 'wood',
  LEAVES: 'leaves'
};

// Internal Numeric IDs for Storage
export const BLOCK_IDS = {
  'air': 0,
  'grass': 1,
  'dirt': 2,
  'stone': 3,
  'snow': 4,
  'wood': 5,
  'leaves': 6
};

// Inverse Mapping (ID -> Name)
export const BLOCK_NAMES = Object.entries(BLOCK_IDS).reduce((acc, [name, id]) => {
  acc[id] = name;
  return acc;
}, {});

export class Chunk {
  constructor(cx, cy, cz, parent) {
    this.cx = cx;
    this.cy = cy;
    this.cz = cz;
    this.parent = parent;
    this.blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE); // Stores numeric IDs
    this.modifiedBlocks = new Map(); // Player modifications: key -> id
    this.meshes = {}; // Map<BlockID, InstancedMesh>
    this.needsUpdate = true;

    // Visibility tracking for culling
    this.isVisible = true;
    this.wasVisible = true;
    this.visibilityChanged = false;
  }

  // Returns numeric ID
  getBlockId(lx, ly, lz) {
    if (lx < 0 || lx >= CHUNK_SIZE || ly < 0 || ly >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) {
      const wx = this.cx * CHUNK_SIZE + lx;
      const wy = this.cy * CHUNK_SIZE + ly;
      const wz = this.cz * CHUNK_SIZE + lz;
      return this.parent.getBlockId(wx, wy, wz);
    }

    // Check for player modifications first
    const key = `${lx},${ly},${lz}`;
    if (this.modifiedBlocks.has(key)) {
      return this.modifiedBlocks.get(key);
    }

    // Return cached procedural block
    return this.blocks[lx + ly * CHUNK_SIZE + lz * CHUNK_SIZE * CHUNK_SIZE];
  }

  // Sets numeric ID (for procedural generation)
  setProceduralBlockId(lx, ly, lz, id) {
    if (lx >= 0 && lx < CHUNK_SIZE && ly >= 0 && ly < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
      this.blocks[lx + ly * CHUNK_SIZE + lz * CHUNK_SIZE * CHUNK_SIZE] = id;
      this.needsUpdate = true;
    }
  }

  // Sets modified block (player interaction)
  setModifiedBlockId(lx, ly, lz, id) {
    if (lx >= 0 && lx < CHUNK_SIZE && ly >= 0 && ly < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
      const key = `${lx},${ly},${lz}`;
      this.modifiedBlocks.set(key, id);
      this.needsUpdate = true;
    }
  }

  // Legacy method for compatibility
  setBlockId(lx, ly, lz, id) {
    this.setModifiedBlockId(lx, ly, lz, id);
  }

  buildMesh(materials) {
    if (!this.needsUpdate) return this.meshes;

    // Dispose old meshes
    Object.values(this.meshes).forEach(mesh => {
      if (mesh.parent) mesh.parent.remove(mesh);
      mesh.geometry.dispose();
    });
    this.meshes = {};

    const instanceData = {}; // { blockID: [matrices...] }

    const dummy = new THREE.Object3D();

    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const id = this.getBlockId(x, y, z);
          if (id === 0) continue; // Air

          // Check neighbors (using IDs)
          const neighbors = [
            this.getBlockId(x + 1, y, z),
            this.getBlockId(x - 1, y, z),
            this.getBlockId(x, y + 1, z),
            this.getBlockId(x, y - 1, z),
            this.getBlockId(x, y, z + 1),
            this.getBlockId(x, y, z - 1)
          ];

          if (neighbors.some(nId => nId === 0)) {
            const wx = this.cx * CHUNK_SIZE + x;
            const wy = this.cy * CHUNK_SIZE + y;
            const wz = this.cz * CHUNK_SIZE + z;

            dummy.position.set(wx, wy, wz);
            dummy.updateMatrix();

            if (!instanceData[id]) instanceData[id] = [];
            instanceData[id].push(dummy.matrix.clone());
          }
        }
      }
    }

    // Create meshes for each block type found
    for (const [idStr, matrices] of Object.entries(instanceData)) {
      const id = parseInt(idStr);
      const blockName = BLOCK_NAMES[id];
      const material = materials[blockName];

      if (matrices.length > 0 && material) {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);

        for (let i = 0; i < matrices.length; i++) {
          mesh.setMatrixAt(i, matrices[i]);
        }

        // Fix: Z-Fighting (Bias)
        // Since chunks overlap exactly at boundaries or faces, we rely on culling.
        // But shadow mapping can cause artifacts (shadow acne).
        // We can improve this by enabling proper shadow bias on the light, not here.
        // However, if faces are overlapping (duplicate geometry), that is the issue.
        // The current "neighbor check" culls hidden faces between blocks, 
        // but it does NOT cull faces between chunks.
        // For a simple voxel engine, reducing camera near clip can help depth precision.

        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.instanceMatrix.needsUpdate = true;
        this.meshes[id] = mesh;
      }
    }

    this.needsUpdate = false;
    return this.meshes;
  }

  // Save/Load methods for chunk persistence
  getModifiedBlocks() {
    return Array.from(this.modifiedBlocks.entries());
  }

  loadModifiedBlocks(data) {
    this.modifiedBlocks = new Map(data);
    this.needsUpdate = true;
  }

  // Visibility management for culling
  setVisibility(visible) {
    this.wasVisible = this.isVisible;
    this.isVisible = visible;
    this.visibilityChanged = (this.wasVisible !== this.isVisible);
  }

  updateVisibilityInScene(sceneGroup) {
    if (!this.visibilityChanged) return;

    Object.values(this.meshes).forEach(mesh => {
      if (this.isVisible) {
        if (!mesh.parent) {
          sceneGroup.add(mesh);
        }
      } else {
        if (mesh.parent) {
          mesh.parent.remove(mesh);
        }
      }
    });

    this.visibilityChanged = false;
  }

  // Get chunk bounds for culling calculations
  getBounds() {
    return {
      minX: this.cx * CHUNK_SIZE,
      minY: this.cy * CHUNK_SIZE,
      minZ: this.cz * CHUNK_SIZE,
      maxX: (this.cx + 1) * CHUNK_SIZE,
      maxY: (this.cy + 1) * CHUNK_SIZE,
      maxZ: (this.cz + 1) * CHUNK_SIZE
    };
  }
}

