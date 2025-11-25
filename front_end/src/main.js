// Entry point: sets up Three.js, controls, and terrain

import * as THREE from 'three';
import { Terrain } from './Terrain.js';
import { Player } from './player/Player.js';
import { Multiplayer } from './Multiplayer.js';
import { DOMElements } from './domElements.js';

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 80, 220);

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// Lights
const hemiLight = new THREE.HemisphereLight(0xcfe8ff, 0x202a2e, 0.8);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(50, 100, -30);
dirLight.castShadow = true;
dirLight.shadow.bias = -0.0005; // Fix: Reduce shadow acne/z-fighting
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 400;
dirLight.shadow.mapSize.set(2048, 2048);
// Fix: Expand shadow camera frustum
const d = 100;
dirLight.shadow.camera.left = -d;
dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d;
dirLight.shadow.camera.bottom = -d;
scene.add(dirLight);
scene.add(dirLight.target); // Needed to move target

// Sun and Moon (Celestial Bodies)
const sunGeometry = new THREE.SphereGeometry(8, 16, 16);
const sunMaterial = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    emissive: 0xffaa00,
    emissiveIntensity: 0.3
});
const sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
sunMesh.position.set(0, 100, 0); // Initial position
scene.add(sunMesh);

const moonGeometry = new THREE.SphereGeometry(6, 16, 16);
const moonMaterial = new THREE.MeshBasicMaterial({
    color: 0xcccccc,
    emissive: 0x444444,
    emissiveIntensity: 0.1
});
const moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
moonMesh.position.set(0, -100, 0); // Initial position (opposite side)
scene.add(moonMesh);

// Terrain
const terrain = new Terrain({
  renderDistance: 5, // Radius in chunks
  noiseScale: 48,
  amplitude: 20,
  baseHeight: 6,
  blockSize: 1
});
const terrainMesh = terrain.generate(); // Initializes initial chunks
scene.add(terrainMesh);

// Player (Controls, Physics, Inventory)
const player = new Player(scene, camera, terrain, renderer);

// Multiplayer
let multiplayer = null;

// Handle Multiplayer Button
DOMElements.btnMultiplayer.addEventListener('click', () => {
    // Set Shared Seed for consistent world
    terrain.setSeed("multiplayer-shared-world-v1");
    
    // Initialize Multiplayer
    if (!multiplayer) {
        multiplayer = new Multiplayer(scene, player);
        
        // Hook into Terrain.setBlock to send updates
        // We wrap the original setBlock method
        const originalSetBlock = terrain.setBlock.bind(terrain);
        
        terrain.setBlock = function(x, y, z, blockName, isRemote = false) {
            // Call original logic to update local world
            originalSetBlock(x, y, z, blockName);
            
            // If it's a local action (isRemote is false or undefined), send to server
            if (!isRemote && multiplayer && multiplayer.isConnected) {
                multiplayer.sendBlockUpdate(x, y, z, blockName);
            }
        };
        
        // Expose globally for UI
        window.multiplayer = multiplayer;
        
    } else {
        // Re-connect if needed or just reuse
        if (!multiplayer.ws || multiplayer.ws.readyState !== WebSocket.OPEN) {
            multiplayer.connect();
        }
    }

    // Lock controls to start game
    player.controls.lock();
    DOMElements.menuMain.style.display = 'none';
    
    // Show Resume button for multiplayer
    DOMElements.btnResume.style.display = 'block';
});

// Handle Back Button (Disconnect Multiplayer)
DOMElements.btnBackMain.addEventListener('click', () => {
    if (multiplayer) {
        multiplayer.disconnect();
        // multiplayer = null; // Don't nullify, just disconnect so we can reuse or reconnect cleanly
        // Actually, if we disconnect, we might want to reset the object to ensure fresh state
        multiplayer = null;
        window.multiplayer = null;
        
        // Hide Resume button when disconnecting from multiplayer
        DOMElements.btnResume.style.display = 'none';
    }
});

// Camera initial position
// Note: Player constructor sets up controls, but we need to set initial position.
// Player class uses player.head.position for physics/controls now.
const eyeHeight = player.STANDING_EYE_HEIGHT;
player.head.position.set(0, terrain.getHeightAtWorld(0, 0) + eyeHeight + 5, 8);
// Camera will sync to head in the first update loop

// Resize handling
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onWindowResize);

// Prevent context menu
document.addEventListener('contextmenu', (event) => {
    event.preventDefault();
});

// Day/Night Cycle
const DAY_DURATION = 1200; // 20 minutes in seconds
let gameTime = DAY_DURATION * 0.25; // Start at noon
const sunOffset = new THREE.Vector3();

const SKY_COLOR_DAY = new THREE.Color(0x87CEEB);
const SKY_COLOR_NIGHT = new THREE.Color(0x050510);
const SKY_COLOR_SUNSET = new THREE.Color(0xfd5e53);

// Cache for performance - avoid updating every frame
let lastTimePhase = -1; // 0: day, 1: sunset, 2: night
let lastSunY = 0;
let lastSunAngle = 0;
const UPDATE_THRESHOLD = 0.02; // Only update if sunY changes by this much (increased for better performance)
const ANGLE_THRESHOLD = 0.05; // Only update sun position if angle changes significantly

// Fixed Time Step for Day/Night Cycle
const DAY_NIGHT_TICK_RATE = 20; // Update 20 times per second (every 50ms)
const DAY_NIGHT_STEP = 1000 / DAY_NIGHT_TICK_RATE;
let dayNightAccumulator = 0;

// Animation loop
let lastFrameTime = performance.now();
let fpsLimitAccumulator = 0;

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const rawDelta = now - lastFrameTime;
  
  // FPS Limiting Logic
  if (player.maxFps > 0) {
      const frameInterval = 1000 / player.maxFps;
      
      if (rawDelta < frameInterval) {
          return; // Skip frame
      }
      
      // Smooth out the timing for the next frame
      fpsLimitAccumulator = rawDelta % frameInterval;
      lastFrameTime = now - fpsLimitAccumulator;
  } else {
      lastFrameTime = now;
  }

  // Cap delta to prevent spiral of death on lag spikes
  // (e.g. if tab was hidden for 5 seconds, don't simulate 5 seconds at once)
  const deltaMs = Math.min(rawDelta, 100); 
  const delta = deltaMs / 1000;

  // Day/Night Cycle Logic - Optimized to use Fixed Time Step
  const dayNightStart = performance.now();
  
  // Use synchronized server time in multiplayer mode, otherwise use local time
  let currentGameTime = gameTime;
  if (multiplayer && multiplayer.isConnected) {
    const serverTime = multiplayer.getGameTime();
    if (serverTime !== null) {
      // Use server time (already synchronized)
      currentGameTime = serverTime;
    } else {
      // Server time not available yet, continue with local time
      dayNightAccumulator += deltaMs;
      let steps = 0;
      while (dayNightAccumulator >= DAY_NIGHT_STEP && steps < 5) {
        gameTime += (DAY_NIGHT_STEP / 1000);
        if (gameTime > DAY_DURATION) gameTime -= DAY_DURATION;
        dayNightAccumulator -= DAY_NIGHT_STEP;
        steps++;
      }
      currentGameTime = gameTime;
    }
  } else {
    // Single player mode - use local time
    // Accumulate time for fixed update using the clamped delta
    dayNightAccumulator += deltaMs;

    // Only run day/night logic if enough time has passed (20 ticks/sec)
    // Limit max steps per frame to prevent hanging
    let steps = 0;
    while (dayNightAccumulator >= DAY_NIGHT_STEP && steps < 5) {
      gameTime += (DAY_NIGHT_STEP / 1000); // Add fixed step in seconds
      if (gameTime > DAY_DURATION) gameTime -= DAY_DURATION;
      dayNightAccumulator -= DAY_NIGHT_STEP;
      steps++;
    }
    currentGameTime = gameTime;
  }
  
  // Calculate time progress and sun position from current game time
  const timeProgress = currentGameTime / DAY_DURATION;
  const angle = timeProgress * Math.PI * 2; // 0 to 2PI

  // Sun rotates around Z axis (rises in X+, sets in X-)
  // Noon: Y+, Sunrise: X+, Sunset: X-, Midnight: Y-
  const sunX = Math.cos(angle);
  const sunY = Math.sin(angle);
  const sunZ = Math.sin(angle * 0.5) * 0.2; // Slight wobble

  // Only update lighting if sun position changed significantly
  if (Math.abs(sunY - lastSunY) > UPDATE_THRESHOLD) {
    lastSunY = sunY;

    // Determine Cycle Phase
    let currentTimePhase;
    if (sunY > 0.2) {
        currentTimePhase = 0; // Day
    } else if (sunY > -0.2) {
        currentTimePhase = 1; // Sunrise/Sunset
    } else {
        currentTimePhase = 2; // Night
    }

    // Only update scene properties if phase changed or first time
    if (currentTimePhase !== lastTimePhase || lastTimePhase === -1) {
      lastTimePhase = currentTimePhase;

      if (sunY > 0.2) {
          // Day
          scene.background.copy(SKY_COLOR_DAY);
          scene.fog.color.copy(SKY_COLOR_DAY);
          dirLight.color.setHex(0xffffff);
          dirLight.intensity = 1.0;
          hemiLight.intensity = 0.6;
      } else if (sunY > -0.2) {
          // Sunrise/Sunset
          const t = (sunY + 0.2) / 0.4; // Normalized 0 to 1 for transition zone

          if (sunY > 0) {
              // Day <-> Sunset
              const mix = sunY / 0.2; // 1 (Day) to 0 (Sunset)
              scene.background.copy(SKY_COLOR_SUNSET).lerp(SKY_COLOR_DAY, mix);
              scene.fog.color.copy(SKY_COLOR_SUNSET).lerp(SKY_COLOR_DAY, mix);
              dirLight.intensity = 0.5 + 0.5 * mix;
              dirLight.color.setHex(0xffdcb5); // Orange tint
          } else {
              // Sunset <-> Night
              const mix = (sunY + 0.2) / 0.2; // 1 (Sunset) to 0 (Night)
              scene.background.copy(SKY_COLOR_NIGHT).lerp(SKY_COLOR_SUNSET, mix);
              scene.fog.color.copy(SKY_COLOR_NIGHT).lerp(SKY_COLOR_SUNSET, mix);
              dirLight.intensity = 0.5 * mix; // Fade out
              dirLight.color.setHex(0xffdcb5);
          }
          hemiLight.intensity = 0.2 + 0.4 * t;
      } else {
          // Night
          scene.background.copy(SKY_COLOR_NIGHT);
          scene.fog.color.copy(SKY_COLOR_NIGHT);
          dirLight.intensity = 0; // No sun at night
          hemiLight.intensity = 0.1; // Dark
      }
    }
  }

  // Update Light Position (relative to player) - only when angle changes significantly
  if (Math.abs(angle - lastSunAngle) > ANGLE_THRESHOLD) {
    lastSunAngle = angle;
    sunOffset.set(sunX, sunY, sunZ).normalize().multiplyScalar(100);

    // Update Sun position (follows the sun light)
    sunMesh.position.copy(camera.position).add(sunOffset.clone().multiplyScalar(0.8));

    // Update Moon position (opposite to sun)
    const moonAngle = angle + Math.PI; // 180 degrees opposite
    const moonX = Math.cos(moonAngle);
    const moonY = Math.sin(moonAngle);
    const moonZ = Math.sin(moonAngle * 0.5) * 0.2;
    const moonOffset = new THREE.Vector3(moonX, moonY, moonZ).normalize().multiplyScalar(100);
    moonMesh.position.copy(camera.position).add(moonOffset);

    // Show/hide based on time of day
    if (sunY > -0.1) { // Show sun during day/dawn
        sunMesh.visible = true;
        moonMesh.visible = false;
    } else { // Show moon during night/dusk
        sunMesh.visible = false;
        moonMesh.visible = true;
    }
  }

  const dayNightEnd = performance.now();

  if (player.controls.isLocked) {
    const t1 = performance.now();

    // Update Terrain Generation (Infinite World)
    terrain.update(camera.position.x, camera.position.y, camera.position.z);

    const t2 = performance.now();

    // Update Player (Physics, Input)
    player.update(delta);
    if (multiplayer) multiplayer.update(delta);

    const t3 = performance.now();

    // Fix: Shadows follow player
    // Use sunOffset calculated from cycle
    dirLight.position.copy(camera.position).add(sunOffset);
    dirLight.target.position.copy(camera.position);

    const t3_5 = performance.now();
    dirLight.target.updateMatrixWorld();

    const t4 = performance.now();
    renderer.render(scene, camera);
    const t5 = performance.now();

    if (player.showPerformanceChart && player.updatePerformanceChart) {
        player.updatePerformanceChart({
            terrain: t2 - t1,
            physics: t3 - t2,
            lighting: t3_5 - t3, // Shadow light position updates
            shadows: t4 - t3_5,  // Shadow matrix calculations
            render: t5 - t4,     // Actual rendering
            dayNight: dayNightEnd - dayNightStart // Day/night cycle timing
        });
    }
  } else {
      renderer.render(scene, camera);
  }
}

animate();
