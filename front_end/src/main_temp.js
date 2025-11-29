
import * as THREE from 'three';
import { Terrain } from './Terrain.js';
import { Player } from './player/Player.js';
import { Multiplayer } from './Multiplayer.js';
import { DOMElements } from './domElements.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 80, 220);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const hemiLight = new THREE.HemisphereLight(0xcfe8ff, 0x202a2e, 0.8);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(50, 100, -30);
dirLight.castShadow = true;
dirLight.shadow.bias = -0.0005;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 400;
dirLight.shadow.mapSize.set(2048, 2048);
const d = 100;
dirLight.shadow.camera.left = -d;
dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d;
dirLight.shadow.camera.bottom = -d;
scene.add(dirLight);
scene.add(dirLight.target);

const terrain = new Terrain({
  renderDistance: 5,
  noiseScale: 48,
  amplitude: 20,
  baseHeight: 6,
  blockSize: 1
});
const terrainMesh = terrain.generate();
scene.add(terrainMesh);

const player = new Player(scene, camera, terrain, renderer);

let multiplayer = null;

DOMElements.btnMultiplayer.addEventListener('click', () => {
    const SHARED_WORLD_SEED = "multiplayer-shared-world-v1";

    if (!multiplayer) {
        multiplayer = new Multiplayer(scene, player, SHARED_WORLD_SEED);
        
        const originalSetBlock = terrain.setBlock.bind(terrain);
        
        terrain.setBlock = function(x, y, z, blockName, isRemote = false) {
            originalSetBlock(x, y, z, blockName);
            
            if (!isRemote && multiplayer && multiplayer.isConnected) {
                multiplayer.sendBlockUpdate(x, y, z, blockName);
            }
        };
        
        window.multiplayer = multiplayer;
        
    } else {
        if (!multiplayer.ws || multiplayer.ws.readyState !== WebSocket.OPEN) {
            multiplayer.connect();
        }
    }

    player.controls.lock();
    DOMElements.menuMain.style.display = 'none';
    
    DOMElements.btnResume.style.display = 'block';
});

DOMElements.btnBackMain.addEventListener('click', () => {
    if (multiplayer) {
        multiplayer.disconnect();
        multiplayer = null;
        window.multiplayer = null;
        
        DOMElements.btnResume.style.display = 'none';
    }
});

const eyeHeight = player.STANDING_EYE_HEIGHT;
player.head.position.set(0, terrain.getHeightAtWorld(0, 0) + eyeHeight + 5, 8);

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onWindowResize);

document.addEventListener('contextmenu', (event) => {
    event.preventDefault();
});

const DAY_DURATION = 1200;
let gameTime = DAY_DURATION * 0.25;
const sunOffset = new THREE.Vector3();

const SKY_COLOR_DAY = new THREE.Color(0x87CEEB);
const SKY_COLOR_NIGHT = new THREE.Color(0x050510);
const SKY_COLOR_SUNSET = new THREE.Color(0xfd5e53);

let lastSunY = 0;
let lastSunAngle = 0;
// Update sky/sun/lighting roughly every 30 seconds
// DAY_DURATION = 1200s, full cycle = 2π radians
// 30s = (30/1200) * 2π = π/20 ≈ 0.157 radians
const UPDATE_THRESHOLD = Math.PI / 20;
const ANGLE_THRESHOLD = Math.PI / 20;

const DAY_NIGHT_TICK_RATE = 20;
const DAY_NIGHT_STEP = 1000 / DAY_NIGHT_TICK_RATE;
let dayNightAccumulator = 0;

let lastFrameTime = performance.now();
let fpsLimitAccumulator = 0;

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const rawDelta = now - lastFrameTime;
  
  if (player.maxFps > 0) {
      const frameInterval = 1000 / player.maxFps;
      
      if (rawDelta < frameInterval) {
          return;
      }
      
      fpsLimitAccumulator = rawDelta % frameInterval;
      lastFrameTime = now - fpsLimitAccumulator;
  } else {
      lastFrameTime = now;
  }

  const deltaMs = Math.min(rawDelta, 100); 
  const delta = deltaMs / 1000;

  const dayNightStart = performance.now();
  
  let currentGameTime = gameTime;
  if (multiplayer && multiplayer.isConnected) {
    const serverTime = multiplayer.getGameTime();
    if (serverTime !== null) {
      currentGameTime = serverTime;
    } else {
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
  
  const timeProgress = currentGameTime / DAY_DURATION;
  const angle = timeProgress * Math.PI * 2;

  const sunX = Math.cos(angle);
  const sunY = Math.sin(angle);
  const sunZ = Math.sin(angle * 0.5) * 0.2;

  if (Math.abs(sunY - lastSunY) > UPDATE_THRESHOLD) {
    lastSunY = sunY;

    // Update sky colors and lighting roughly every 30 seconds
    if (sunY > 0.2) {
        scene.background.copy(SKY_COLOR_DAY);
        scene.fog.color.copy(SKY_COLOR_DAY);
        dirLight.color.setHex(0xffffff);
        dirLight.intensity = 1.0;
        hemiLight.intensity = 0.6;
    } else if (sunY > -0.2) {
        const t = (sunY + 0.2) / 0.4;

        if (sunY > 0) {
            const mix = sunY / 0.2;
            scene.background.copy(SKY_COLOR_SUNSET).lerp(SKY_COLOR_DAY, mix);
            scene.fog.color.copy(SKY_COLOR_SUNSET).lerp(SKY_COLOR_DAY, mix);
            dirLight.intensity = 0.5 + 0.5 * mix;
            dirLight.color.setHex(0xffdcb5);
        } else {
            const mix = (sunY + 0.2) / 0.2;
            scene.background.copy(SKY_COLOR_NIGHT).lerp(SKY_COLOR_SUNSET, mix);
            scene.fog.color.copy(SKY_COLOR_NIGHT).lerp(SKY_COLOR_SUNSET, mix);
            dirLight.intensity = 0.5 * mix;
            dirLight.color.setHex(0xffdcb5);
        }
        hemiLight.intensity = 0.2 + 0.4 * t;
    } else {
        scene.background.copy(SKY_COLOR_NIGHT);
        scene.fog.color.copy(SKY_COLOR_NIGHT);
        dirLight.intensity = 0;
        hemiLight.intensity = 0.1;
    }
  }

  if (Math.abs(angle - lastSunAngle) > ANGLE_THRESHOLD) {
    lastSunAngle = angle;
    sunOffset.set(sunX, sunY, sunZ).normalize().multiplyScalar(100);
  }

  const dayNightEnd = performance.now();

  if (player.controls.isLocked) {
    const t1 = performance.now();

    terrain.update(camera.position.x, camera.position.y, camera.position.z);

    const t2 = performance.now();

    player.update(delta);
    if (multiplayer) multiplayer.update(delta);

    const t3 = performance.now();

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
            lighting: t3_5 - t3,
            shadows: t4 - t3_5,
            render: t5 - t4,
            dayNight: dayNightEnd - dayNightStart
        });
    }
  } else {
      renderer.render(scene, camera);
  }
}

animate();
