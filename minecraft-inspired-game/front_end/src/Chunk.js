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

export class Chunk {
  constructor(cx, cy, cz, parent) {
    this.cx = cx;
    this.cy = cy;
    this.cz = cz;
    this.parent = parent;
    this.blocks = new Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE).fill('air'); // Stores block names
    this.modifiedBlocks = new Map(); // Player modifications: key -> blockName
    this.meshes = {}; // Map<blockName, InstancedMesh>
    this.needsUpdate = true;
  }

  // Returns block name
  getBlockName(lx, ly, lz) {
    if (lx < 0 || lx >= CHUNK_SIZE || ly < 0 || ly >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) {
      const wx = this.cx * CHUNK_SIZE + lx;
      const wy = this.cy * CHUNK_SIZE + ly;
      const wz = this.cz * CHUNK_SIZE + lz;
      return this.parent.getBlockName(wx, wy, wz);
    }

    // Check for player modifications first
    const key = `${lx},${ly},${lz}`;
    if (this.modifiedBlocks.has(key)) {
      return this.modifiedBlocks.get(key);
    }

    // Return cached procedural block
    return this.blocks[lx + ly * CHUNK_SIZE + lz * CHUNK_SIZE * CHUNK_SIZE];
  }

  // Sets block name (for procedural generation)
  setProceduralBlock(lx, ly, lz, blockName) {
    if (lx >= 0 && lx < CHUNK_SIZE && ly >= 0 && ly < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
      this.blocks[lx + ly * CHUNK_SIZE + lz * CHUNK_SIZE * CHUNK_SIZE] = blockName;
      this.needsUpdate = true;
    }
  }

  // Sets modified block (player interaction)
  setModifiedBlock(lx, ly, lz, blockName) {
    if (lx >= 0 && lx < CHUNK_SIZE && ly >= 0 && ly < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
      const key = `${lx},${ly},${lz}`;
      this.modifiedBlocks.set(key, blockName);
      this.needsUpdate = true;
    }
  }

  // Legacy methods for compatibility (deprecated, use new names)
  getBlockId(lx, ly, lz) {
    return this.getBlockName(lx, ly, lz);
  }

  setProceduralBlockId(lx, ly, lz, blockName) {
    this.setProceduralBlock(lx, ly, lz, blockName);
  }

  setModifiedBlockId(lx, ly, lz, blockName) {
    this.setModifiedBlock(lx, ly, lz, blockName);
  }

  setBlockId(lx, ly, lz, blockName) {
    this.setModifiedBlock(lx, ly, lz, blockName);
  }

  buildMesh(materials) {
    if (!this.needsUpdate) return this.meshes;

    // Dispose old meshes
    Object.values(this.meshes).forEach(mesh => {
      if (mesh.parent) mesh.parent.remove(mesh);
      mesh.geometry.dispose();
    });
    this.meshes = {};

    const instanceData = {}; // { blockName: [matrices...] }

    const dummy = new THREE.Object3D();

    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const blockName = this.getBlockName(x, y, z);
          if (blockName === 'air') continue; // Air

          // Check neighbors (using names)
          const neighbors = [
            this.getBlockName(x + 1, y, z),
            this.getBlockName(x - 1, y, z),
            this.getBlockName(x, y + 1, z),
            this.getBlockName(x, y - 1, z),
            this.getBlockName(x, y, z + 1),
            this.getBlockName(x, y, z - 1)
          ];

          if (neighbors.some(nName => nName === 'air')) {
            const wx = this.cx * CHUNK_SIZE + x;
            const wy = this.cy * CHUNK_SIZE + y;
            const wz = this.cz * CHUNK_SIZE + z;

            dummy.position.set(wx, wy, wz);
            dummy.updateMatrix();

            if (!instanceData[blockName]) instanceData[blockName] = [];
            instanceData[blockName].push(dummy.matrix.clone());
          }
        }
      }
    }

    // Create meshes for each block type found
    for (const [blockName, matrices] of Object.entries(instanceData)) {
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
        this.meshes[blockName] = mesh;
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
}

