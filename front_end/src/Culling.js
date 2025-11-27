import * as THREE from 'three';

export class FrustumCulling {
  constructor() {
    this.frustum = new THREE.Frustum();
    this.cameraMatrix = new THREE.Matrix4();
    this.projScreenMatrix = new THREE.Matrix4();
  }

  updateFrustum(camera) {
    // Update the frustum based on current camera
    camera.updateMatrixWorld();
    this.cameraMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.cameraMatrix);
  }

  isChunkVisible(cx, cy, cz, chunkSize = 16) {
    // Create a bounding box for the chunk
    const minX = cx * chunkSize - 0.5;
    const minY = cy * chunkSize - 0.5;
    const minZ = cz * chunkSize - 0.5;
    const maxX = (cx + 1) * chunkSize - 0.5;
    const maxY = (cy + 1) * chunkSize - 0.5;
    const maxZ = (cz + 1) * chunkSize - 0.5;

    // Check if the chunk's bounding box intersects with the frustum
    const box = new THREE.Box3(
      new THREE.Vector3(minX, minY, minZ),
      new THREE.Vector3(maxX, maxY, maxZ)
    );

    return this.frustum.intersectsBox(box);
  }
}

export class OcclusionCulling {
  constructor(terrain) {
    this.terrain = terrain;
    this.occlusionMap = new Map(); // Cache for occlusion results
    this.cacheTimeout = 1000; // Cache results for 1 second
    this.lastCacheClear = 0;
  }

  updateCache() {
    const now = performance.now();
    if (now - this.lastCacheClear > this.cacheTimeout) {
      this.occlusionMap.clear();
      this.lastCacheClear = now;
    }
  }

  isChunkOccluded(cx, cy, cz, cameraPosition, renderDistance) {
    this.updateCache();

    const key = `${cx},${cy},${cz}`;
    if (this.occlusionMap.has(key)) {
      return this.occlusionMap.get(key);
    }

    // Basic occlusion check: if chunk is far and behind terrain
    const chunkCenterX = (cx + 0.5) * 16;
    const chunkCenterY = (cy + 0.5) * 16;
    const chunkCenterZ = (cz + 0.5) * 16;

    const distanceToCamera = Math.sqrt(
      Math.pow(chunkCenterX - cameraPosition.x, 2) +
      Math.pow(chunkCenterY - cameraPosition.y, 2) +
      Math.pow(chunkCenterZ - cameraPosition.z, 2)
    );

    // Only check occlusion for chunks that are more than 2 chunks away
    if (distanceToCamera < 32) {
      this.occlusionMap.set(key, false);
      return false;
    }

    // Check if there's solid terrain between camera and chunk
    // This is a simplified check - in a full implementation, you'd want to raycast
    const directionToChunk = new THREE.Vector3(
      chunkCenterX - cameraPosition.x,
      chunkCenterY - cameraPosition.y,
      chunkCenterZ - cameraPosition.z
    ).normalize();

    // Sample points along the line from camera to chunk
    const steps = Math.max(5, Math.floor(distanceToCamera / 8));
    let occluded = false;

    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const sampleX = Math.round(cameraPosition.x + directionToChunk.x * distanceToCamera * t);
      const sampleY = Math.round(cameraPosition.y + directionToChunk.y * distanceToCamera * t);
      const sampleZ = Math.round(cameraPosition.z + directionToChunk.z * distanceToCamera * t);

      // Check if there's solid terrain at this point
      const blockType = this.terrain.getBlock(sampleX, sampleY, sampleZ);
      if (blockType !== 'air') {
        // There's solid terrain blocking the view
        occluded = true;
        break;
      }
    }

    this.occlusionMap.set(key, occluded);
    return occluded;
  }
}

export class SpatialPartition {
  constructor(cellSize = 64) { // 4 chunks per cell
    this.cellSize = cellSize;
    this.cells = new Map();
  }

  getCellKey(x, z) {
    const cellX = Math.floor(x / this.cellSize);
    const cellZ = Math.floor(z / this.cellSize);
    return `${cellX},${cellZ}`;
  }

  addChunk(chunk) {
    const key = this.getCellKey(chunk.cx * 16, chunk.cz * 16);
    if (!this.cells.has(key)) {
      this.cells.set(key, []);
    }
    this.cells.get(key).push(chunk);
  }

  removeChunk(chunk) {
    const key = this.getCellKey(chunk.cx * 16, chunk.cz * 16);
    const cell = this.cells.get(key);
    if (cell) {
      const index = cell.indexOf(chunk);
      if (index !== -1) {
        cell.splice(index, 1);
        if (cell.length === 0) {
          this.cells.delete(key);
        }
      }
    }
  }

  getChunksInRadius(centerX, centerZ, radius) {
    const chunks = [];
    const minCellX = Math.floor((centerX - radius) / this.cellSize);
    const maxCellX = Math.floor((centerX + radius) / this.cellSize);
    const minCellZ = Math.floor((centerZ - radius) / this.cellSize);
    const maxCellZ = Math.floor((centerZ + radius) / this.cellSize);

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cz = minCellZ; cz <= maxCellZ; cz++) {
        const key = `${cx},${cz}`;
        const cell = this.cells.get(key);
        if (cell) {
          chunks.push(...cell);
        }
      }
    }

    return chunks;
  }

  clear() {
    this.cells.clear();
  }
}

export class CullingManager {
  constructor(terrain) {
    this.terrain = terrain;
    this.frustumCulling = new FrustumCulling();
    this.occlusionCulling = new OcclusionCulling(terrain);
    this.spatialPartition = new SpatialPartition();
    this.enableFrustumCulling = true;
    this.enableOcclusionCulling = true;

    // Cache for culling results
    this.visibilityCache = new Map();
    this.cacheTimeout = 500; // Cache for 500ms
    this.lastCacheClear = 0;
  }

  updateSpatialPartition() {
    this.spatialPartition.clear();
    for (const chunk of this.terrain.chunks.values()) {
      this.spatialPartition.addChunk(chunk);
    }
  }

  clearCache() {
    const now = performance.now();
    if (now - this.lastCacheClear > this.cacheTimeout) {
      this.visibilityCache.clear();
      this.lastCacheClear = now;
    }
  }

  shouldRenderChunk(cx, cy, cz, camera, cameraPosition, renderDistance) {
    // Clear old cache entries
    this.clearCache();

    // Create cache key
    const cacheKey = `${cx},${cy},${cz}`;
    if (this.visibilityCache.has(cacheKey)) {
      return this.visibilityCache.get(cacheKey);
    }

    // Always render chunks very close to the player
    const chunkCenterX = (cx + 0.5) * 16;
    const chunkCenterY = (cy + 0.5) * 16;
    const chunkCenterZ = (cz + 0.5) * 16;

    const distanceSq = Math.pow(chunkCenterX - cameraPosition.x, 2) +
                      Math.pow(chunkCenterY - cameraPosition.y, 2) +
                      Math.pow(chunkCenterZ - cameraPosition.z, 2);

    // Always render chunks within 1 chunk distance
    if (distanceSq < 256) { // 16^2
      this.visibilityCache.set(cacheKey, true);
      return true;
    }

    // Frustum culling
    if (this.enableFrustumCulling) {
      this.frustumCulling.updateFrustum(camera);
      if (!this.frustumCulling.isChunkVisible(cx, cy, cz)) {
        this.visibilityCache.set(cacheKey, false);
        return false;
      }
    }

    // Occlusion culling
    if (this.enableOcclusionCulling) {
      if (this.occlusionCulling.isChunkOccluded(cx, cy, cz, cameraPosition, renderDistance)) {
        this.visibilityCache.set(cacheKey, false);
        return false;
      }
    }

    this.visibilityCache.set(cacheKey, true);
    return true;
  }

  setFrustumCulling(enabled) {
    this.enableFrustumCulling = enabled;
  }

  setOcclusionCulling(enabled) {
    this.enableOcclusionCulling = enabled;
  }
}