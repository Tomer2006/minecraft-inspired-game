import * as THREE from 'three';
import { createNoise2D } from 'https://unpkg.com/simplex-noise@4.0.1/dist/esm/simplex-noise.js';
import { mulberry32, cyrb128 } from './utils.js';
import { Chunk, CHUNK_SIZE, BLOCKS } from './Chunk.js';

export class Terrain {
  constructor({
    renderDistance = 5, // Radius in chunks
    noiseScale = 48,
    amplitude = 20,
    baseHeight = 6,
    blockSize = 1,
    seed = "default"
  } = {}) {
    this.renderDistance = renderDistance;
    this.noiseScale = noiseScale;
    this.amplitude = amplitude;
    this.baseHeight = baseHeight;
    this.blockSize = blockSize;
    this.seed = seed;

    this.chunks = new Map();
    this.pendingModifications = new Map(); // Store modifications for chunks not yet loaded
    this.group = new THREE.Group();
    
    this.initializeNoise();

    // Chunk Loading Queue
    this.chunkQueue = [];
    this.chunksLoading = new Set(); // Set of keys currently in queue

    // Texture Loading
    this.textureLoader = new THREE.TextureLoader();
    this.materials = this.createMaterials();

    // Auto-save system
    this.lastSaveTime = 0;
    this.autoSaveInterval = 30000; // 30 seconds
    this.hasUnsavedChanges = false;
  }
  
  initializeNoise() {
      // Create a seeded PRNG
      const seedInt = cyrb128(String(this.seed));
      
      // Minecraft 1.18+ style multi-octave noise generation
      // Create multiple noise generators with different seeds for different terrain aspects
      // Each noise needs a unique seed offset to generate different patterns
      this.continentalnessNoise = createNoise2D(mulberry32(seedInt + 1000));
      this.erosionNoise = createNoise2D(mulberry32(seedInt + 2000));
      this.weirdnessNoise = createNoise2D(mulberry32(seedInt + 3000));
      
      // Additional octaves for more detail
      this.detailNoise1 = createNoise2D(mulberry32(seedInt + 4000));
      this.detailNoise2 = createNoise2D(mulberry32(seedInt + 5000));
  }
  
  setSeed(seed) {
      this.seed = seed;
      this.initializeNoise();
      // Clear all procedural generation cache
      // When seed changes, the entire world changes.
      // Modified blocks stay in their chunks.
      this.chunks.forEach(chunk => {
        Object.values(chunk.meshes).forEach(mesh => {
            if (mesh.parent) mesh.parent.remove(mesh);
            mesh.geometry.dispose();
        });
      });
      this.chunks.clear();
      this.chunkQueue = [];
      this.chunksLoading.clear();
      this.group.clear();
  }

  createMaterials() {
      const mats = {};
      // Define colors for fallback (if texture fails or pending)
      const colors = {
        'grass': new THREE.Color(0.16, 0.45, 0.22),
        'dirt': new THREE.Color(0.32, 0.56, 0.24),
        'stone': new THREE.Color(0.55, 0.50, 0.38),
        'snow': new THREE.Color(0.92, 0.94, 0.98),
        'wood': new THREE.Color(0.4, 0.25, 0.1),
        'leaves': new THREE.Color(0.2, 0.6, 0.2)
      };

      Object.keys(BLOCKS).forEach(key => {
          const name = BLOCKS[key];
          if (name === 'air') return;

          // Try to load texture
          // We use a fallback to a colored canvas if file not found (browser default 404 is usually just console error + no image)
          // Actually, TextureLoader returns a valid texture object immediately, but image loads async.
          // If image fails, it stays black. We want a color fallback.
          
          // Better approach: Generate a procedural texture first.
          // If user wants custom, they replace the file. But we can't check file existence easily.
          // We will assume textures exist in 'textures/[name].png'. 
          // If they don't, the user sees black blocks? That's bad.
          
          // To be safe: We create a canvas texture with noise + color.
          const canvas = document.createElement('canvas');
          canvas.width = 64;
          canvas.height = 64;
          const ctx = canvas.getContext('2d');
          
          // Fill with base color
          const c = colors[name] || new THREE.Color(1, 0, 1);
          ctx.fillStyle = `#${c.getHexString()}`;
          ctx.fillRect(0, 0, 64, 64);
          
          // Add noise
          for (let i=0; i<200; i++) {
              ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.2})`;
              ctx.fillRect(Math.random()*64, Math.random()*64, 2, 2);
              ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.2})`;
              ctx.fillRect(Math.random()*64, Math.random()*64, 2, 2);
          }
          
          const fallbackTexture = new THREE.CanvasTexture(canvas);
          fallbackTexture.magFilter = THREE.NearestFilter; // Pixelated look

          // Now try to load real texture
          // If we assign map: loadedTexture, and it fails, it might be empty.
          // We'll default to procedural for now to ensure it looks good.
          // Users can replace this logic or we can provide a UI to upload.
          // BUT, to support "custom textures" via file drop, I'll check for a specific path.
          // Since I can't check, I'll just attempt to load.
          
          const texture = this.textureLoader.load(`textures/${name}.png`, 
              // onLoad
              () => {
                  material.map = texture;
                  material.needsUpdate = true;
              },
              // onProgress
              undefined,
              // onError
              () => {
                  // Keep using fallback
                  // Texture not found, using procedural fallback
              }
          );
          texture.magFilter = THREE.NearestFilter;

          const material = new THREE.MeshStandardMaterial({
              map: fallbackTexture, // Start with fallback
              roughness: 1.0,
              metalness: 0.0
          });
          
          mats[name] = material;
      });
      
      return mats;
  }

  getChunkKey(cx, cy, cz) {
    return `${cx},${cy},${cz}`;
  }

  // Internal: Get Block Name
  getBlockName(x, y, z) {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cy = Math.floor(y / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);

    const chunkKey = this.getChunkKey(cx, cy, cz);
    const chunk = this.chunks.get(chunkKey);

    if (!chunk) {
        // Generate procedural block if chunk doesn't exist
        const maxTerrainBlockY = this.baseHeight + this.amplitude + 5;
        if (y > maxTerrainBlockY) return 'air';

        const surfaceHeight = this.getHeightAtWorld(x, z);
        if (y <= surfaceHeight) {
             // Fix: Layers relative to surface
             if (y === surfaceHeight) {
                 return y >= 120 ? 'snow' : 'grass';
             }
             if (y > surfaceHeight - 4) return 'dirt';
             return 'stone';
        }
        return 'air';
    }

    let lx = x % CHUNK_SIZE;
    let ly = y % CHUNK_SIZE;
    let lz = z % CHUNK_SIZE;

    if (lx < 0) lx += CHUNK_SIZE;
    if (ly < 0) ly += CHUNK_SIZE;
    if (lz < 0) lz += CHUNK_SIZE;

    return chunk.getBlockName(lx, ly, lz);
  }

  // Public API: Returns String Name
  getBlock(x, y, z) {
      return this.getBlockName(x, y, z);
  }

  // Public API: Accepts String Name
  setBlock(x, y, z, blockName) {
    // Validate block name
    if (!Object.values(BLOCKS).includes(blockName)) {
        console.warn(`Unknown block type: ${blockName}`);
        return;
    }

    const cx = Math.floor(x / CHUNK_SIZE);
    const cy = Math.floor(y / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);

    const key = this.getChunkKey(cx, cy, cz);
    const chunk = this.chunks.get(key);

    if (chunk) {
        let lx = x % CHUNK_SIZE;
        let ly = y % CHUNK_SIZE;
        let lz = z % CHUNK_SIZE;
        if (lx < 0) lx += CHUNK_SIZE;
        if (ly < 0) ly += CHUNK_SIZE;
        if (lz < 0) lz += CHUNK_SIZE;

        chunk.setModifiedBlock(lx, ly, lz, blockName);
        this.hasUnsavedChanges = true; // Mark that we have unsaved changes

        // Update Meshes
        const meshes = chunk.buildMesh(this.materials);
        Object.values(meshes).forEach(mesh => {
            if (mesh.parent !== this.group) this.group.add(mesh);
        });

        // Update neighbors
        const updateNeighbor = (ncx, ncy, ncz) => {
            const nKey = this.getChunkKey(ncx, ncy, ncz);
            const nChunk = this.chunks.get(nKey);
            if (nChunk) {
                nChunk.needsUpdate = true;
                const nMeshes = nChunk.buildMesh(this.materials);
                Object.values(nMeshes).forEach(mesh => {
                    if (mesh.parent !== this.group) this.group.add(mesh);
                });
            }
        };

        if (lx === 0) updateNeighbor(cx - 1, cy, cz);
        if (lx === CHUNK_SIZE - 1) updateNeighbor(cx + 1, cy, cz);
        if (ly === 0) updateNeighbor(cx, cy - 1, cz);
        if (ly === CHUNK_SIZE - 1) updateNeighbor(cx, cy + 1, cz);
        if (lz === 0) updateNeighbor(cx, cy, cz - 1);
        if (lz === CHUNK_SIZE - 1) updateNeighbor(cx, cy, cz + 1);
    }
  }

  getHeightAtWorld(x, z) {
    // Minecraft 1.18+ style multi-octave noise generation
    // Using Minecraft's actual noise scale values (converted from Minecraft's coordinate system)
    // Minecraft uses xz_scale values typically between 0.1-0.25 for continentalness/erosion/weirdness
    
    // Continentalness: Large-scale landmass shape (Minecraft uses ~0.1-0.15 xz_scale)
    // Converted to block coordinates: ~0.001-0.002 per block
    const continentalnessScale = 0.001953125; // 1/512, similar to Minecraft's continentalness scale
    
    // Erosion: Terrain smoothness and variation (Minecraft uses ~0.2-0.25 xz_scale)  
    // Converted to block coordinates: ~0.002-0.003 per block
    const erosionScale = 0.00390625; // 1/256, similar to Minecraft's erosion scale
    
    // Weirdness: Additional terrain variation (Minecraft uses ~0.15-0.2 xz_scale)
    // Converted to block coordinates: ~0.002 per block
    const weirdnessScale = 0.001953125; // Similar to continentalness
    
    // Detail noise layers for fine-grained variation
    const detailScale1 = 0.0078125; // 1/128, medium detail
    const detailScale2 = 0.015625; // 1/64, fine detail
    
    // Sample noise at different scales (multi-octave)
    const nx = x * continentalnessScale;
    const nz = z * continentalnessScale;
    const continentalness = this.continentalnessNoise(nx, nz);
    
    const ex = x * erosionScale;
    const ez = z * erosionScale;
    const erosion = this.erosionNoise(ex, ez);
    
    const wx = x * weirdnessScale;
    const wz = z * weirdnessScale;
    const weirdness = this.weirdnessNoise(wx, wz);
    
    // Detail noise (higher frequency) - reduced amplitude for subtle variation
    const dx1 = x * detailScale1;
    const dz1 = z * detailScale1;
    const detail1 = this.detailNoise1(dx1, dz1) * 0.25; // Reduced amplitude
    
    const dx2 = x * detailScale2;
    const dz2 = z * detailScale2;
    const detail2 = this.detailNoise2(dx2, dz2) * 0.125; // Even smaller amplitude
    
    // Combine noise layers using Minecraft 1.18+ style weights
    // Continentalness provides the base shape (dominant)
    // Erosion smooths and varies the terrain
    // Weirdness adds unique variation
    // Detail layers add fine-grained variation
    let height = continentalness * 0.6; // Base continental shape (dominant)
    height += erosion * 0.25; // Erosion variation
    height += weirdness * 0.15; // Weirdness variation
    height += detail1; // Medium detail
    height += detail2; // Fine detail
    
    // Normalize to 0-1 range and apply amplitude
    height = (height + 1) * 0.5; // Convert from [-1, 1] to [0, 1]
    
    // Apply base height and amplitude
    // Minecraft 1.18+ uses sea level at Y=63, with terrain typically ranging from ~-64 to ~320
    // For our simplified version, we'll use a reasonable range
    const finalHeight = this.baseHeight + height * this.amplitude;
    
    return Math.floor(finalHeight);
  }

  // Main Update Loop: call this with player X, Y, Z
  update(px, py, pz) {
      const centerCX = Math.floor(px / CHUNK_SIZE);
      const centerCY = Math.floor(py / CHUNK_SIZE);
      const centerCZ = Math.floor(pz / CHUNK_SIZE);

      // Auto-save check
      const now = performance.now();
      if (this.hasUnsavedChanges && (now - this.lastSaveTime) > this.autoSaveInterval) {
        // Note: We can't actually save here as we don't have access to WorldHandler
        // This is just a flag for the UI to show "unsaved changes" indicator
        // Auto-save triggered - unsaved changes detected
      }

      // 1. Identify Missing Chunks in Range
      for (let dx = -this.renderDistance; dx <= this.renderDistance; dx++) {
          for (let dz = -this.renderDistance; dz <= this.renderDistance; dz++) {
              for (let dy = -2; dy <= 2; dy++) { 
                  const cx = centerCX + dx;
                  const cy = centerCY + dy;
                  const cz = centerCZ + dz;
                  
                  const key = this.getChunkKey(cx, cy, cz);
                  if (!this.chunks.has(key) && !this.chunksLoading.has(key)) {
                      this.chunksLoading.add(key);
                      this.chunkQueue.push({ key, cx, cy, cz });
                  }
              }
          }
      }

      // 2. Process Queue (Load 1 chunk per frame)
      this.processChunkQueue(centerCX, centerCY, centerCZ);

      // 3. Remove Distant Chunks
      for (const [key, chunk] of this.chunks.entries()) {
          const distX = Math.abs(chunk.cx - centerCX);
          const distZ = Math.abs(chunk.cz - centerCZ);
          const distY = Math.abs(chunk.cy - centerCY); 

          const inPlayerRange = distX <= this.renderDistance && 
                                distZ <= this.renderDistance && 
                                distY <= 3; 

          if (!inPlayerRange) {
              // Before removing, save any modifications to pending list!
              const mods = chunk.getModifiedBlocks();
              if (mods.length > 0) {
                this.pendingModifications.set(key, mods);
                // Don't mark as unsaved changes here because these are already "saved" in memory,
                // but if we were to save to disk, we need them.
                // Actually, hasUnsavedChanges should track if *any* change happened since last disk save.
                // Unloading a chunk doesn't change that status.
              }

              // Remove mesh
              Object.values(chunk.meshes).forEach(mesh => {
                  if (mesh.parent) mesh.parent.remove(mesh);
                  mesh.geometry.dispose();
              });
              chunk.meshes = {};
              this.chunks.delete(key);
              
              // Also remove from queue if present (optimization)
              // This is tricky because we'd need to search the array. 
              // For now, we'll just let it generate and then be removed next frame if out of range.
          }
      }
  }

  processChunkQueue(centerCX, centerCY, centerCZ) {
      if (this.chunkQueue.length === 0) return;

      // Sort by distance to player (closest first)
      this.chunkQueue.sort((a, b) => {
          const distA = Math.pow(a.cx - centerCX, 2) + Math.pow(a.cy - centerCY, 2) + Math.pow(a.cz - centerCZ, 2);
          const distB = Math.pow(b.cx - centerCX, 2) + Math.pow(b.cy - centerCY, 2) + Math.pow(b.cz - centerCZ, 2);
          return distA - distB;
      });

      // Process 1 chunk per frame to prevent stutter
      const item = this.chunkQueue.shift();
      this.chunksLoading.delete(item.key);
      
      // Check if still within render distance before generating
      const distX = Math.abs(item.cx - centerCX);
      const distZ = Math.abs(item.cz - centerCZ);
      const distY = Math.abs(item.cy - centerCY);
      
      if (distX <= this.renderDistance && distZ <= this.renderDistance && distY <= 3) {
          this.generateChunk(item.cx, item.cy, item.cz);
      }
  }

  generateChunk(cx, cy, cz) {
      const chunk = new Chunk(cx, cy, cz, this);
      this.chunks.set(this.getChunkKey(cx, cy, cz), chunk);

      const maxTerrainBlockY = this.baseHeight + this.amplitude + 5;
      const minChunkBlockY = cy * CHUNK_SIZE;
      
      let skipProcedural = false;
      if (minChunkBlockY > maxTerrainBlockY) {
          skipProcedural = true;
      }

      // Fill chunk data
      for (let x = 0; x < CHUNK_SIZE; x++) {
          for (let z = 0; z < CHUNK_SIZE; z++) {
              const wx = cx * CHUNK_SIZE + x;
              const wz = cz * CHUNK_SIZE + z;
              
              let surfaceHeight = -99999;
              if (!skipProcedural) {
                  surfaceHeight = this.getHeightAtWorld(wx, wz);
              }
              
              for (let y = 0; y < CHUNK_SIZE; y++) {
                  const wy = cy * CHUNK_SIZE + y;
                  
                  // Procedural generation only
                  if (!skipProcedural) {
                      let type = 'air';
                      if (wy <= surfaceHeight) {
                          if (wy === surfaceHeight) {
                              type = wy >= 120 ? 'snow' : 'grass';
                          } else if (wy > surfaceHeight - 4) {
                              type = 'dirt';
                          } else {
                              type = 'stone';
                          }
                      }
                      chunk.setProceduralBlock(x, y, z, type);
                  } else {
                      chunk.setProceduralBlock(x, y, z, 'air');
                  }
              }
          }
      }

      // Apply any pending modifications for this chunk
      const chunkKey = this.getChunkKey(cx, cy, cz);
      const pendingMods = this.pendingModifications.get(chunkKey);
      if (pendingMods) {
        chunk.loadModifiedBlocks(pendingMods);
        this.pendingModifications.delete(chunkKey);
      }

      // Build Mesh
      const meshes = chunk.buildMesh(this.materials);
      Object.values(meshes).forEach(mesh => this.group.add(mesh));

      // Neighbors might need update
      const neighbors = [
          [cx - 1, cy, cz], [cx + 1, cy, cz],
          [cx, cy - 1, cz], [cx, cy + 1, cz],
          [cx, cy, cz - 1], [cx, cy, cz + 1]
      ];
      neighbors.forEach(([nx, ny, nz]) => {
          const nKey = this.getChunkKey(nx, ny, nz);
          const nChunk = this.chunks.get(nKey);
          if (nChunk && !nChunk.needsUpdate) {
              nChunk.needsUpdate = true;
              const nMeshes = nChunk.buildMesh(this.materials);
              Object.values(nMeshes).forEach(mesh => {
                  if (mesh.parent !== this.group) this.group.add(mesh);
              });
          }
      });
  }

  // Save/Load - now delegates to chunks
  getModifiedBlocks() {
    const allModified = {};
    
    // 1. Get modifications from currently loaded chunks
    this.chunks.forEach((chunk, chunkKey) => {
      const chunkMods = chunk.getModifiedBlocks();
      if (chunkMods.length > 0) {
        allModified[chunkKey] = chunkMods;
      }
    });

    // 2. Add modifications from unloaded chunks (stored in pending)
    this.pendingModifications.forEach((mods, chunkKey) => {
      if (mods.length > 0) {
        allModified[chunkKey] = mods;
      }
    });

    return allModified;
  }

  clearModifiedBlocks() {
    // Clear persisted modifications for unloaded chunks.
    this.pendingModifications.clear();

    // Clear modifications for loaded chunks and rebuild meshes where needed.
    this.chunks.forEach((chunk) => {
      if (chunk.modifiedBlocks && chunk.modifiedBlocks.size > 0) {
        chunk.modifiedBlocks.clear();
        chunk.needsUpdate = true;
        const meshes = chunk.buildMesh(this.materials);
        Object.values(meshes).forEach(mesh => {
          if (mesh.parent !== this.group) this.group.add(mesh);
        });
      }
    });

    this.hasUnsavedChanges = false;
    this.lastSaveTime = performance.now();
  }

  loadModifiedBlocks(data, seed) {
    if (seed) {
        this.setSeed(seed);
    }

    // Clear pending modifications and reset flags
    this.pendingModifications.clear();
    this.hasUnsavedChanges = false;

    // Apply modified blocks to existing chunks or store for future chunks
    Object.entries(data).forEach(([chunkKey, modifications]) => {
      const [cx, cy, cz] = chunkKey.split(',').map(Number);
      const chunk = this.chunks.get(chunkKey);

      if (chunk) {
        // Chunk exists, load modifications immediately
        chunk.loadModifiedBlocks(modifications);
        // Rebuild mesh
        const meshes = chunk.buildMesh(this.materials);
        Object.values(meshes).forEach(mesh => {
          if (mesh.parent !== this.group) this.group.add(mesh);
        });
      } else {
        // Chunk not loaded yet, store for when it gets generated
        this.pendingModifications.set(chunkKey, modifications);
      }
    });
  }

  // Get save status for UI indicators
  getSaveStatus() {
    return {
      hasUnsavedChanges: this.hasUnsavedChanges,
      totalModifiedBlocks: Array.from(this.chunks.values()).reduce((total, chunk) =>
        total + chunk.modifiedBlocks.size, 0),
      pendingModifications: this.pendingModifications.size
    };
  }

  // Legacy support (no-op mainly or init)
  generate() {
     this.update(0, 0, 0);
     return this.group;
  }
}

export default Terrain;
