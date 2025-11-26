import * as THREE from 'three';

export class Multiplayer {
    constructor(scene, player, username) {
        this.scene = scene;
        this.localPlayer = player;
        this.username = username;
        this.remotePlayers = {};
        this.ws = null;
        this.id = null;
        this.lastUpdate = 0;
        this.isConnected = false;

        // Add key listener for changing username (N key)
        document.addEventListener('keydown', (event) => {
            if (event.key === 'n' || event.key === 'N') {
                this.changeUsername();
            }
        });
        
        // Time synchronization
        this.serverGameTime = null; // Server's authoritative game time
        this.lastServerTimeUpdate = 0; // Timestamp when we received server time
        this.useServerTime = false; // Flag to use server time instead of local
        
        this.connect();
    }

    connect() {
        // Configuration: Your Render backend URL
        const PRODUCTION_BACKEND_URL = 'wss://minecraft-inspired-game.onrender.com'; 

        let socketUrl;
        
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            // Local development
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.hostname;
            const port = 2025;
            socketUrl = `${protocol}//${host}:${port}`;
        } else {
            // Production (Netlify)
            socketUrl = PRODUCTION_BACKEND_URL;
            if (socketUrl.includes('YOUR_RENDER_URL_HERE')) {
                console.error('Please update PRODUCTION_BACKEND_URL in src/Multiplayer.js with your Render WebSocket URL');
            }
        }
        
        console.log(`Connecting to multiplayer server at ${socketUrl}`);
        this.ws = new WebSocket(socketUrl);

        this.ws.onopen = () => {
            console.log('Connected to multiplayer server');
            this.isConnected = true;
            
            // Try to restore previous session ID
            const savedId = localStorage.getItem('multiplayer_id');
            this.ws.send(JSON.stringify({
                type: 'join',
                id: savedId || null,
                username: this.username
            }));
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (e) {
                console.error('Error parsing multiplayer message:', e);
            }
        };

        this.ws.onclose = () => {
            console.log('Disconnected from server');
            this.isConnected = false;
        };
        
        this.ws.onerror = (err) => {
            console.error('Multiplayer WebSocket error:', err);
            this.isConnected = false;
        };
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
        
        // Remove all remote players
        for (const id in this.remotePlayers) {
            this.removePlayer(id);
        }
        this.remotePlayers = {};
    }

    handleMessage(data) {
        switch (data.type) {
            case 'init':
                this.id = data.id;
                console.log('My Player ID:', this.id);
                localStorage.setItem('multiplayer_id', this.id); // Save ID for future sessions
                
                // Set initial position from server if provided (persistent location)
                if (data.position) {
                    console.log('Restoring position:', data.position);
                    this.localPlayer.head.position.set(data.position.x, data.position.y, data.position.z);
                    this.localPlayer.head.rotation.set(data.rotation.x, data.rotation.y, 0);
                    // Sync physics body
                    this.localPlayer.physics.velocity.set(0, 0, 0);
                }

                // Initialize existing players
                if (data.players) {
                    // Check if it's array (old format/init) or object (new update format)
                    // Init usually sends array
                    const playersList = Array.isArray(data.players) ? data.players : Object.values(data.players);
                    for (const p of playersList) {
                        if (p.id !== this.id) {
                            this.addPlayer(p.id, p);
                        }
                    }
                }
                // Initialize World
                if (data.world) {
                    console.log('Received initial world state');
                    this.localPlayer.terrain.loadModifiedBlocks(data.world);
                }
                
                // Initialize synchronized game time
                if (typeof data.gameTime === 'number') {
                    this.serverGameTime = data.gameTime;
                    this.lastServerTimeUpdate = Date.now();
                    this.useServerTime = true;
                    console.log('Synchronized to server time:', this.serverGameTime);
                }
                break;
            case 'player-joined':
                if (data.id !== this.id) {
                    this.addPlayer(data.id, data);
                }
                break;
            case 'player-left':
                this.removePlayer(data.id);
                break;
            case 'state-update':
                this.updatePlayers(data.players);
                
                // Update synchronized game time
                if (typeof data.gameTime === 'number') {
                    this.serverGameTime = data.gameTime;
                    this.lastServerTimeUpdate = Date.now();
                }
                break;
            case 'username-update':
                // Handle username change from another player
                if (this.remotePlayers[data.id]) {
                    this.remotePlayers[data.id].username = data.username;
                    // Update label sprite
                    const canvas = document.createElement('canvas');
                    canvas.width = 256;
                    canvas.height = 64;
                    const context = canvas.getContext('2d');
                    context.font = 'Bold 20px Arial';
                    context.fillStyle = 'white';
                    context.strokeStyle = 'black';
                    context.lineWidth = 3;
                    context.strokeText(data.username, 128, 32);
                    context.fillText(data.username, 128, 32);
                    this.remotePlayers[data.id].labelSprite.material.map = new THREE.CanvasTexture(canvas);
                    this.remotePlayers[data.id].labelSprite.material.needsUpdate = true;
                }
                break;
            case 'block-update':
                // Apply remote block update
                if (this.localPlayer.terrain) {
                    this.localPlayer.terrain.setBlock(data.x, data.y, data.z, data.blockName, true);
                }
                break;
        }
    }

    sendBlockUpdate(x, y, z, blockName) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'block-update',
                x, y, z, blockName
            }));
        }
    }

    addPlayer(id, data) {
        if (this.remotePlayers[id]) return;

        // Create mesh similar to Player.js
        const bodyGeometry = new THREE.BoxGeometry(0.6, 1.8, 0.6);
        const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xff3333 }); // Red for other players
        const mesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        // Initial position
        if (data.position) {
            mesh.position.set(data.position.x, data.position.y, data.position.z);
            mesh.position.y -= 0.78; // Adjust offset same as local player logic
        }
        
        this.scene.add(mesh);
        
        // Create username label
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const context = canvas.getContext('2d');
        context.font = 'Bold 20px Arial';
        context.fillStyle = 'white';
        context.strokeStyle = 'black';
        context.lineWidth = 3;
        context.strokeText(data.username || 'Player', 128, 32);
        context.fillText(data.username || 'Player', 128, 32);

        const texture = new THREE.CanvasTexture(canvas);
        const labelMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const labelSprite = new THREE.Sprite(labelMaterial);
        labelSprite.position.set(0, 2.5, 0); // Above player head
        labelSprite.scale.set(2, 0.5, 1);
        mesh.add(labelSprite);

        this.remotePlayers[id] = {
            mesh: mesh,
            username: data.username || 'Player',
            labelSprite: labelSprite,
            rotation: data.rotation || { x: 0, y: 0 },
            positionBuffer: [] // Buffer for interpolation
        };

        // Initialize buffer
        if (data.position) {
            this.remotePlayers[id].positionBuffer.push({
                timestamp: Date.now(),
                position: data.position,
                rotation: data.rotation || { x: 0, y: 0 }
            });
        }
    }

    removePlayer(id) {
        if (this.remotePlayers[id]) {
            this.scene.remove(this.remotePlayers[id].mesh);
            this.remotePlayers[id].mesh.geometry.dispose();
            this.remotePlayers[id].mesh.material.dispose();
            delete this.remotePlayers[id];
        }
    }

    updatePlayers(playersData) {
        const now = Date.now();
        for (const id in playersData) {
            if (id === this.id) continue;

            if (!this.remotePlayers[id]) {
                this.addPlayer(id, playersData[id]);
            } else {
                const p = this.remotePlayers[id];

                // Update username if changed
                if (playersData[id].username && playersData[id].username !== p.username) {
                    p.username = playersData[id].username;
                    // Update label sprite
                    const canvas = document.createElement('canvas');
                    canvas.width = 256;
                    canvas.height = 64;
                    const context = canvas.getContext('2d');
                    context.font = 'Bold 20px Arial';
                    context.fillStyle = 'white';
                    context.strokeStyle = 'black';
                    context.lineWidth = 3;
                    context.strokeText(p.username, 128, 32);
                    context.fillText(p.username, 128, 32);
                    p.labelSprite.material.map = new THREE.CanvasTexture(canvas);
                    p.labelSprite.material.needsUpdate = true;
                }

                // Add to buffer
                if (playersData[id].position) {
                    p.positionBuffer.push({
                        timestamp: now,
                        position: playersData[id].position,
                        rotation: playersData[id].rotation
                    });
                    
                    // Keep buffer size manageable
                    while (p.positionBuffer.length > 20) {
                        p.positionBuffer.shift();
                    }
                }
            }
        }
    }

    update(delta) {
        // Send update to server (20 times per second max)
        const now = performance.now();
        if (now - this.lastUpdate > 50 && this.ws && this.ws.readyState === WebSocket.OPEN) {
            // Explicitly serialize position as plain object to ensure consistency
            const pos = this.localPlayer.head.position;
            this.ws.send(JSON.stringify({
                type: 'update',
                position: { x: pos.x, y: pos.y, z: pos.z },
                rotation: { x: this.localPlayer.head.rotation.x, y: this.localPlayer.head.rotation.y }
            }));
            this.lastUpdate = now;
        }

        // Interpolate remote players
        const renderTimestamp = Date.now() - 100; // 100ms delay for smooth interpolation

        for (const id in this.remotePlayers) {
            const p = this.remotePlayers[id];
            const buffer = p.positionBuffer;
            
            if (buffer.length < 1) continue;

            // Find the two frames surrounding renderTimestamp
            let p1 = buffer[0];
            let p2 = buffer[0];
            
            // Attempt to find the interval
            // If we have future data, find the interpolation spot
            if (buffer.length >= 2 && buffer[buffer.length - 1].timestamp >= renderTimestamp) {
                 for (let i = 0; i < buffer.length - 1; i++) {
                    if (buffer[i].timestamp <= renderTimestamp && buffer[i+1].timestamp >= renderTimestamp) {
                        p1 = buffer[i];
                        p2 = buffer[i+1];
                        break;
                    }
                 }
            } else {
                // We are lagging behind server updates or packet loss
                // Use the latest data
                p1 = buffer[buffer.length - 1];
                p2 = p1;
            }

            let targetPos = new THREE.Vector3();
            let targetRotY = 0;

            if (p1 === p2) {
                targetPos.set(p1.position.x, p1.position.y, p1.position.z);
                targetRotY = p1.rotation ? p1.rotation.y : 0;
            } else {
                const total = p2.timestamp - p1.timestamp;
                const current = renderTimestamp - p1.timestamp;
                const t = total > 0 ? current / total : 0;

                targetPos.set(p1.position.x, p1.position.y, p1.position.z);
                const pos2 = new THREE.Vector3(p2.position.x, p2.position.y, p2.position.z);
                targetPos.lerp(pos2, t);

                // Interpolate rotation (linear)
                const r1 = p1.rotation ? p1.rotation.y : 0;
                const r2 = p2.rotation ? p2.rotation.y : 0;
                
                // Shortest path angle interpolation
                let diff = r2 - r1;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                
                targetRotY = r1 + diff * t;
            }
            
            // Apply offset (visual mesh is offset from head position)
            targetPos.y -= 0.78;

            // Update mesh
            p.mesh.position.copy(targetPos);
            p.mesh.rotation.y = targetRotY;
        }
    }
    
    // Get synchronized game time (server time + elapsed time since last update)
    getGameTime() {
        if (!this.useServerTime || this.serverGameTime === null) {
            return null; // Not synchronized yet
        }
        
        // Calculate elapsed time since last server update (in seconds)
        const elapsedSeconds = (Date.now() - this.lastServerTimeUpdate) / 1000;
        
        // Add elapsed time to server time
        let currentTime = this.serverGameTime + elapsedSeconds;
        
        // Wrap around if exceeding day duration
        const DAY_DURATION = 1200; // 20 minutes
        while (currentTime > DAY_DURATION) {
            currentTime -= DAY_DURATION;
        }
        
        return currentTime;
    }

    // Change username (cosmetic only) - disabled for now since we don't have an in-game UI for this
    changeUsername() {
        // For now, just show a message. Could add an in-game UI later
        console.log('Username changing is not available in-game yet. Join with a different name instead.');
    }
}
