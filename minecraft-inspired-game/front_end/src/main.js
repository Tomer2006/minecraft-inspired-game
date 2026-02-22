// Entry point: sets up Three.js, controls, and terrain

import * as THREE from 'three';
import { Terrain } from './Terrain.js';
import { Player } from './player/Player.js';
import { Multiplayer } from './Multiplayer.js';
import { Chat } from './Chat.js';
import { DOMElements } from './domElements.js';

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: false, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Scenes Array
// Scene 0: Menu scene (main menu + world selection)
// Scene 1: Game scene
const scenes = [];

// Scene 0: Menu Scene
scenes[0] = new THREE.Scene();
scenes[0].background = new THREE.Color(0x4a90a4);
scenes[0].fog = new THREE.Fog(0x4a90a4, 10, 50);

// Scene 1: Game Scene
scenes[1] = new THREE.Scene();
scenes[1].background = new THREE.Color(0x87CEEB);
scenes[1].fog = new THREE.Fog(0x87CEEB, 80, 220);

// Expose scenes globally for access by UI components
window.scenes = scenes;

// Use scene[1] as the main game scene (backward compatibility)
const scene = scenes[1];

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
// Reduce shadow map size
dirLight.shadow.mapSize.set(1024, 1024); // From 2048x2048
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
const player = new Player(scenes[1], camera, terrain, renderer);

// Multiplayer
let multiplayer = null;

// Chat (available in both singleplayer and multiplayer)
let chat = new Chat(player, null); // Initialize with player and null multiplayer initially
// Expose chat globally so controls can check if it's open
window.chat = chat;

// Set up multiplayer join callback for MainMenuUI
// MainMenuUI handles the UI, but main.js handles the actual multiplayer connection logic
if (player.ui && player.ui.mainMenuUI) {
    player.ui.mainMenuUI.onJoinMultiplayer = (displayName) => {
        // Set Shared Seed for consistent world
        terrain.setSeed("multiplayer-shared-world-v1");

        // Initialize Multiplayer with username
        if (!multiplayer) {
            multiplayer = new Multiplayer(scenes[1], player, displayName);

            // Update chat with multiplayer instance
            chat.setMultiplayer(multiplayer);

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
            window.chat = chat;

        } else {
            // Re-connect if needed or just reuse
            if (!multiplayer.ws || multiplayer.ws.readyState !== WebSocket.OPEN) {
                multiplayer.connect();
            }
        }

        // Lock controls to start game
        player.controls.lock();
        DOMElements.menuMain.style.display = 'none';
        // Hide Scene 0 and switch to Scene 1 (game) when joining multiplayer
        if (player.ui && player.ui.mainMenuUI) {
          player.ui.mainMenuUI.isVisible = false;
        }
    };
}

// Handle chat keybind (configurable) - must be before controls setup
document.addEventListener('keydown', (event) => {
    const isSinglePlayer = !!player.worldHandler?.currentWorldId;
    const isMultiplayer = !!(window.multiplayer && window.multiplayer.isConnected);
    const isPlaying = isSinglePlayer || isMultiplayer;

    if (!isPlaying) {
        return;
    }

    // Handle chat keybind when not in menus
    if (player && player.keybinds && event.code === (player.keybinds.chat || 'KeyT') && !event.repeat) {
        // Don't trigger if typing in an input field
        if (event.target.tagName !== 'INPUT') {
            event.preventDefault();
            event.stopImmediatePropagation(); // Stop other listeners
            if (chat) {
                chat.openChat();
            }
            return false; // Prevent further processing
        }
    }
}, true); // Use capture phase to run before other listeners

// Handle Back Button (Disconnect Multiplayer)
DOMElements.btnBackMain.addEventListener('click', () => {
    if (multiplayer) {
        multiplayer.disconnect();
        // multiplayer = null; // Don't nullify, just disconnect so we can reuse or reconnect cleanly
        // Actually, if we disconnect, we might want to reset the object to ensure fresh state
        multiplayer = null;
        window.multiplayer = null;
    }
    if (chat) {
        chat.setMultiplayer(null); // Clear multiplayer reference
        chat.closeChat();
    }
    
    // Show Scene 0 (menu scene) when returning to main menu
    const menuMain = DOMElements.menuMain;
    const menuPlay = DOMElements.menuPlay;
    if (menuPlay) menuPlay.style.display = 'none';
    if (menuMain) {
        menuMain.style.display = 'flex';
        if (player.ui && player.ui.mainMenuUI) {
            player.ui.mainMenuUI.isVisible = true;
        }
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

// Performance optimization: Separate update frequencies for different components
let lastTimePhase = -1; // 0: day, 1: sunset, 2: night
let lastSunY = 0;
let lastSunAngle = 0;
let lastSunVisible = true; // Cache sun/moon visibility to avoid redundant updates

// Reduced update frequencies for better performance
const LIGHTING_UPDATE_THRESHOLD = 0.16; // Sun Y position change over ~30s at max speed
const POSITION_UPDATE_THRESHOLD = 0.02; // Less frequent position updates (was 0.005)

// Further reduce update frequency
const DAY_NIGHT_TICK_RATE = 0.5; // From 2 - update once per second instead of twice
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

  // Performance optimization: Update celestial positions more frequently than lighting
  if (Math.abs(angle - lastSunAngle) > POSITION_UPDATE_THRESHOLD) {
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

    // Show/hide based on time of day (only update when state changes)
    const shouldShowSun = sunY > -0.1;
    if (shouldShowSun !== lastSunVisible) {
        lastSunVisible = shouldShowSun;
        sunMesh.visible = shouldShowSun;
        moonMesh.visible = !shouldShowSun;
    }
  }

  // Performance optimization: Update lighting less frequently using position threshold
  const needsLightingUpdate = (Math.abs(sunY - lastSunY) > LIGHTING_UPDATE_THRESHOLD);

  if (needsLightingUpdate) {
    lastSunY = sunY;

    // Update sky and lighting based on sun position
    if (sunY > 0.2) {
        // Day - pure daylight
        scene.background.copy(SKY_COLOR_DAY);
        scene.fog.color.copy(SKY_COLOR_DAY);
        dirLight.color.setHex(0xffffff);
        dirLight.intensity = 1.0;
        hemiLight.intensity = 0.6;
    } else if (sunY > -0.2) {
        // Sunrise/Sunset transition zone - smooth interpolation
        const transitionProgress = (sunY + 0.2) / 0.4; // 0 to 1 across transition zone

        if (sunY > 0) {
            // Day to Sunset transition
            const dayToSunsetMix = sunY / 0.2; // 1 at day, 0 at sunset
            scene.background.copy(SKY_COLOR_SUNSET).lerp(SKY_COLOR_DAY, dayToSunsetMix);
            scene.fog.color.copy(SKY_COLOR_SUNSET).lerp(SKY_COLOR_DAY, dayToSunsetMix);
            dirLight.intensity = 0.5 + 0.5 * dayToSunsetMix;
            dirLight.color.setHex(0xffdcb5); // Warm orange tint
        } else {
            // Sunset to Night transition
            const sunsetToNightMix = (sunY + 0.2) / 0.2; // 1 at sunset, 0 at night
            scene.background.copy(SKY_COLOR_NIGHT).lerp(SKY_COLOR_SUNSET, sunsetToNightMix);
            scene.fog.color.copy(SKY_COLOR_NIGHT).lerp(SKY_COLOR_SUNSET, sunsetToNightMix);
            dirLight.intensity = 0.5 * sunsetToNightMix;
            dirLight.color.setHex(0xffdcb5); // Warm tint fading to darkness
        }
        hemiLight.intensity = 0.2 + 0.4 * transitionProgress;
    } else {
        // Night - pure darkness
        scene.background.copy(SKY_COLOR_NIGHT);
        scene.fog.color.copy(SKY_COLOR_NIGHT);
        dirLight.intensity = 0.0; // No direct sunlight at night
        hemiLight.intensity = 0.1; // Minimal ambient light
    }
  }

  const dayNightEnd = performance.now();

  const t1 = performance.now();

  // Always update Terrain Generation (Infinite World) - game continues even when menu is open
  terrain.update(camera.position.x, camera.position.y, camera.position.z);

  const t2 = performance.now();

  // Always update Player (Physics, Input) - game never pauses
  // Movement is disabled when controls are unlocked, but physics continue
  player.update(delta);

  // Always update multiplayer - other players continue moving even when menu is open
  if (multiplayer) multiplayer.update(delta);

  const t3 = performance.now();

  // Fix: Shadows follow player
  // Use sunOffset calculated from cycle
  dirLight.position.copy(camera.position).add(sunOffset);
  dirLight.target.position.copy(camera.position);

  const t3_5 = performance.now();
  dirLight.target.updateMatrixWorld();

  const t4 = performance.now();
  
  // Check if menu is visible - render scene 0 (menu) or scene 1 (game)
  // Note: menuIngame and menuOptions (when in-game) use Scene 1 so player can see the game behind the menu
  const menuMain = DOMElements.menuMain;
  const menuPlay = DOMElements.menuPlay;
  const menuCreate = DOMElements.menuCreate;
  const menuRename = DOMElements.menuRename;
  const menuOptions = DOMElements.menuOptions;
  const menuIngame = DOMElements.menuIngame;
  const hotbar = DOMElements.hotbar;
  const coordsDisplay = DOMElements.coordsDisplay;
  const chatContainer = DOMElements.chatContainer;
  
  // Determine if player is in-game
  const isSinglePlayer = !!player.worldHandler?.currentWorldId;
  const isMultiplayer = window.multiplayer && window.multiplayer.isConnected;
  const isPlaying = isSinglePlayer || isMultiplayer;
  
  // Check if options menu is visible and if it's accessed from in-game
  const optionsVisible = menuOptions && (menuOptions.style.display === 'flex' || menuOptions.style.display === 'grid');
  const optionsFromGame = optionsVisible && isPlaying;
  
  const isMenuVisible = (menuMain && (menuMain.style.display === 'flex' || menuMain.style.display === 'grid')) ||
                        (menuPlay && (menuPlay.style.display === 'flex' || menuPlay.style.display === 'grid')) ||
                        (menuCreate && (menuCreate.style.display === 'flex' || menuCreate.style.display === 'grid')) ||
                        (menuRename && (menuRename.style.display === 'flex' || menuRename.style.display === 'grid')) ||
                        (optionsVisible && !optionsFromGame); // Only include options in Scene 0 if NOT from in-game
  // menuIngame and menuOptions (when from in-game) are NOT included here - they use Scene 1

  // Hide gameplay HUD while in main menu screens (without overriding display logic from inventory/settings)
  const shouldHideGameplayHud = isMenuVisible;
  if (hotbar) {
    hotbar.style.visibility = shouldHideGameplayHud ? 'hidden' : 'visible';
  }
  if (coordsDisplay) {
    coordsDisplay.style.visibility = shouldHideGameplayHud ? 'hidden' : 'visible';
  }
  if (chatContainer) {
    chatContainer.style.visibility = shouldHideGameplayHud ? 'hidden' : 'visible';
  }
  
  if (isMenuVisible) {
    // Render Scene 0: Menu Scene
    // Update menu scene animation
    if (player.ui && player.ui.mainMenuUI && player.ui.mainMenuUI.update) {
      player.ui.mainMenuUI.update(delta);
    }
    // Render menu scene (scene 0)
    if (player.ui && player.ui.mainMenuUI && player.ui.mainMenuUI.render) {
      player.ui.mainMenuUI.render();
    } else {
      // Fallback: render scene 0 directly if MainMenuUI doesn't have render method
      const menuCamera = player.ui && player.ui.mainMenuUI ? player.ui.mainMenuUI.camera : camera;
      renderer.render(scenes[0], menuCamera || camera);
    }
  } else {
    // Render Scene 1: Game Scene
    renderer.render(scenes[1], camera);
  }
  
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
}

animate();
