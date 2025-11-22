import * as THREE from 'three';

export class Multiplayer {
    constructor(scene, player) {
        this.scene = scene;
        this.localPlayer = player;
        this.remotePlayers = {};
        this.ws = null;
        this.id = null;
        this.lastUpdate = 0;
        this.isConnected = false;
        
        this.connect();
    }

    connect() {
        // Configuration: Set this to your Render backend URL after deployment
        // Example: 'wss://my-minecraft-clone.onrender.com'
        const PRODUCTION_BACKEND_URL = 'wss://YOUR_RENDER_URL_HERE'; 

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
                id: savedId || null
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
                    for (const p of data.players) {
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
                break;
            case 'block-update':
                // Apply remote block update
                // We pass "true" as the last argument to indicate it's a remote update
                // This prevents the main.js hook from sending it back to the server
                // Check if the setBlock method accepts the extra argument (it does implicitly in JS)
                // The hook in main.js will check the 5th argument.
                if (this.localPlayer.terrain) {
                    // terrain.setBlock(x, y, z, blockName, isRemote)
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
        
        this.remotePlayers[id] = {
            mesh: mesh,
            targetPosition: data.position ? new THREE.Vector3(data.position.x, data.position.y, data.position.z) : new THREE.Vector3(),
            rotation: data.rotation || { x: 0, y: 0 }
        };
    }

    removePlayer(id) {
        if (this.remotePlayers[id]) {
            this.scene.remove(this.remotePlayers[id].mesh);
            // Dispose geometry/material to avoid leaks
            this.remotePlayers[id].mesh.geometry.dispose();
            this.remotePlayers[id].mesh.material.dispose();
            delete this.remotePlayers[id];
        }
    }

    updatePlayers(playersData) {
        for (const id in playersData) {
            if (id === this.id) continue;

            if (!this.remotePlayers[id]) {
                this.addPlayer(id, playersData[id]);
            } else {
                const p = this.remotePlayers[id];
                if (playersData[id].position) {
                    p.targetPosition.set(
                        playersData[id].position.x,
                        playersData[id].position.y,
                        playersData[id].position.z
                    );
                }
                if (playersData[id].rotation) {
                    p.rotation = playersData[id].rotation;
                }
            }
        }
    }

    update(delta) {
        // Send update to server (20 times per second max)
        const now = performance.now();
        if (now - this.lastUpdate > 50 && this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'update',
                position: this.localPlayer.head.position, 
                rotation: { x: this.localPlayer.head.rotation.x, y: this.localPlayer.head.rotation.y }
            }));
            this.lastUpdate = now;
        }

        // Interpolate remote players
        for (const id in this.remotePlayers) {
            const p = this.remotePlayers[id];
            
            // Determine where the mesh should be visually (offset from head position)
            const targetBodyPos = p.targetPosition.clone();
            targetBodyPos.y -= 0.78; 

            // Smoothly move mesh
            p.mesh.position.lerp(targetBodyPos, 10 * delta);
            
            // Update rotation (only Y is visible on body usually)
            // We don't smooth rotation here for simplicity, but could
            p.mesh.rotation.y = p.rotation.y;
        }
    }
}
