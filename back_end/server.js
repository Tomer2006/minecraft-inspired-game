import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 2025;
const SAVE_INTERVAL = 30000; // 30 seconds

// --- Game Constants (Mirrored from Chunk.js) ---
const CHUNK_SIZE = 16;
// Day/Night Cycle Constants (Mirrored from main.js)
const DAY_DURATION = 1200; // 20 minutes in seconds
const DAY_NIGHT_TICK_RATE = 20; // Update 20 times per second (every 50ms)
const DAY_NIGHT_STEP = 1000 / DAY_NIGHT_TICK_RATE;
const BLOCK_IDS = {
  'air': 0,
  'grass': 1,
  'dirt': 2,
  'stone': 3,
  'snow': 4,
  'wood': 5,
  'leaves': 6
};

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.png': 'image/png'
};

// --- Data Storage ---
// World: { "cx,cy,cz": { "lx,ly,lz": blockId } }
let worldData = {};
// Players: { "playerId": { position: {x,y,z}, rotation: {x,y} } }
let playerData = {};
// Time: { "gameTime": number, "lastSaved": timestamp }
let timeData = {};
// Game Time (Authoritative server time)
let gameTime = DAY_DURATION * 0.25; // Start at noon
let dayNightAccumulator = 0;

// Load Data from Database
async function loadData() {
    try {
        console.log('Connecting to Railway PostgreSQL database...');

        // Test database connection first
        const { testConnection } = await import('./database.js');
        const connected = await testConnection();
        if (!connected) {
            throw new Error('Failed to connect to Railway PostgreSQL database');
        }
        console.log('✅ Database connection successful');

        // Initialize database connection and schema
        const { initializeDatabase } = await import('./database.js');
        await initializeDatabase();
        console.log('✅ Database schema initialized');

        // Load world data
        const { loadWorldData } = await import('./database.js');
        worldData = await loadWorldData();
        console.log(`✅ World loaded. ${Object.keys(worldData).length} chunks modified.`);

        // Load player data
        const { loadPlayerData } = await import('./database.js');
        playerData = await loadPlayerData();
        console.log(`✅ Player data loaded. ${Object.keys(playerData).length} known players.`);

        // Load time data
        const { loadTimeData } = await import('./database.js');
        timeData = await loadTimeData();
        if (timeData.gameTime !== undefined) {
            gameTime = timeData.gameTime;
            console.log(`✅ Time data loaded. Game time: ${gameTime.toFixed(2)}s`);
        } else {
            console.log('ℹ️ Time data loaded but no gameTime found, using default.');
        }

        console.log('🎮 Database initialization complete - Minecraft server ready!');
    } catch (e) {
        console.error('❌ Failed to load data from Railway database:', e);
        console.error('💡 Make sure PostgreSQL is added to your Railway project');
        // Fallback to empty data structures
        worldData = {};
        playerData = {};
        timeData = {};
        // Don't exit - let the server start with empty data
        console.log('⚠️ Starting server with empty data structures');
    }
}
await loadData();

// Save Data Function
// Helper function to validate and clean player data
function validatePlayerData(data) {
    if (!data.position || typeof data.position.x !== 'number' ||
        typeof data.position.y !== 'number' || typeof data.position.z !== 'number') {
        console.error('Invalid position data:', data.position);
        return null;
    }

    if (!data.rotation || typeof data.rotation.x !== 'number' ||
        typeof data.rotation.y !== 'number') {
        console.error('Invalid rotation data:', data.rotation);
        return null;
    }

    // Validate and clean inventory
    let inventory = data.inventory;
    if (inventory === null || inventory === undefined) {
        inventory = [];
    } else if (typeof inventory === 'string') {
        try {
            inventory = JSON.parse(inventory);
        } catch (e) {
            console.error('Failed to parse inventory JSON in saveData:', e);
            inventory = [];
        }
    }

    if (Array.isArray(inventory)) {
        // Ensure each item is an object with type and count
        inventory = inventory.map(item => {
            if (typeof item === 'string') {
                try {
                    return JSON.parse(item);
                } catch (e) {
                    console.error('Failed to parse inventory item in saveData:', item);
                    return { type: 'air', count: 0 };
                }
            }
            // Ensure item has required properties
            if (!item || typeof item !== 'object') {
                return { type: 'air', count: 0 };
            }
            return {
                type: item.type || 'air',
                count: typeof item.count === 'number' ? item.count : 0
            };
        });
    } else {
        console.error('Invalid inventory format in saveData:', inventory);
        inventory = [];
    }

    return {
        position: data.position,
        rotation: data.rotation,
        inventory: inventory
    };
}

async function saveData() {
    try {
        console.log('💾 Saving data to Railway PostgreSQL database...');

        const { savePlayerData, saveTimeData } = await import('./database.js');

        // Save all player data with validation
        let savedCount = 0;
        for (const [playerId, data] of Object.entries(playerData)) {
            const validatedData = validatePlayerData(data);
            if (validatedData) {
                try {
                    await savePlayerData(playerId, validatedData);
                    savedCount++;
                } catch (playerErr) {
                    console.error(`❌ Failed to save player ${playerId}:`, playerErr);
                }
            } else {
                console.error(`❌ Skipping invalid player data for ${playerId}`);
            }
        }
        console.log(`✅ Saved ${savedCount} players`);

        // Save time data
        await saveTimeData(gameTime, Date.now());
        console.log('✅ Saved game time data');

        // Note: World data is saved incrementally when modifications occur

        console.log(`🎮 Data saved successfully. Game time: ${gameTime.toFixed(2)}s`);
    } catch (e) {
        console.error('❌ Failed to save data to Railway database:', e);
        // Don't crash the server on save failures
    }
}

// Auto-save loop
setInterval(() => {
    saveData().catch(err => console.error('Auto-save failed:', err));
}, SAVE_INTERVAL);

// Save on exit
process.on('SIGINT', async () => {
    await saveData();
    process.exit();
});


const server = http.createServer((req, res) => {
    // Serve files from front_end directory
    let filePath = path.join(__dirname, '..', 'front_end', req.url === '/' ? 'index.html' : req.url);
    
    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if(error.code == 'ENOENT') {
                const notFoundPath = path.join(__dirname, '..', 'front_end', '404.html');
                fs.readFile(notFoundPath, (error, content) => {
                    res.writeHead(404, { 'Content-Type': 'text/html' });
                    res.end(content || '404 Not Found', 'utf-8');
                });
            }
            else {
                res.writeHead(500);
                res.end('Sorry, check with the site admin for error: '+error.code+' ..\n');
            }
        }
        else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// --- Multiplayer Logic ---
const wss = new WebSocketServer({ server });

const activePlayers = {}; // Current active WebSocket connections

function getChunkKey(cx, cy, cz) {
    return `${cx},${cy},${cz}`;
}

// Prepare initial world data for client
function getInitialWorldState() {
    const exportData = {};
    for (const [chunkKey, modifications] of Object.entries(worldData)) {
        exportData[chunkKey] = Object.entries(modifications).map(([key, id]) => [key, id]);
    }
    return exportData;
}

wss.on('connection', (ws) => {
    // Temporary ID until client sends their stored ID or we assign a new one
    let id = null; 

    console.log(`New connection attempt...`);

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'join') {
                // Client requesting to join, potentially with an existing ID
                const requestedId = data.id;
                
                if (requestedId && playerData[requestedId]) {
                    id = requestedId;
                    console.log(`Player rejoined: ${id}`);
                } else {
                    id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
                    console.log(`New player joined: ${id}`);
                    // Initialize new player record
                    playerData[id] = {
                        position: { x: 0, y: 20, z: 0 },
                        rotation: { x: 0, y: 0 },
                        inventory: null // Will be set when client sends initial data
                    };
                }

                // Add to active session
                activePlayers[id] = {
                    id: id,
                    ws: ws,
                    position: playerData[id].position,
                    rotation: playerData[id].rotation,
                    username: data.username || `Player${Math.floor(Math.random() * 1000)}`
                };

                // If no saved inventory, initialize with starter items
                if (!playerData[id].inventory) {
                    playerData[id].inventory = [
                        { type: 'grass', count: 999 },
                        { type: 'dirt', count: 999 },
                        { type: 'stone', count: 999 },
                        { type: 'snow', count: 999 },
                        { type: 'air', count: 0 }, // 4
                        { type: 'air', count: 0 }, // 5
                        { type: 'air', count: 0 }, // 6
                        { type: 'air', count: 0 }, // 7
                        { type: 'air', count: 0 }, // 8
                        // Rest of inventory slots are air
                        ...Array(27).fill({ type: 'air', count: 0 })
                    ];
                }

                // Send Init Packet
                ws.send(JSON.stringify({
                    type: 'init',
                    id: id,
                    position: {
                        x: playerData[id].position.x,
                        y: playerData[id].position.y,
                        z: playerData[id].position.z
                    },
                    rotation: {
                        x: playerData[id].rotation.x,
                        y: playerData[id].rotation.y
                    },
                    inventory: playerData[id].inventory,
                    players: Object.values(activePlayers).map(p => ({
                        id: p.id,
                        username: p.username,
                        position: { x: p.position.x, y: p.position.y, z: p.position.z },
                        rotation: { x: p.rotation.x, y: p.rotation.y }
                    })),
                    world: getInitialWorldState(),
                    gameTime: gameTime // Send synchronized game time
                }));

                // Broadcast Join to others
                broadcast({
                    type: 'player-joined',
                    id: id,
                    username: activePlayers[id].username,
                    position: {
                        x: activePlayers[id].position.x,
                        y: activePlayers[id].position.y,
                        z: activePlayers[id].position.z
                    },
                    rotation: {
                        x: activePlayers[id].rotation.x,
                        y: activePlayers[id].rotation.y
                    }
                }, ws);

            } else if (data.type === 'update') {
                if (id && activePlayers[id]) {
                    // Validate position data structure
                    if (data.position && typeof data.position.x === 'number' && 
                        typeof data.position.y === 'number' && typeof data.position.z === 'number') {
                        activePlayers[id].position = {
                            x: data.position.x,
                            y: data.position.y,
                            z: data.position.z
                        };
                        
                        // Update persistent storage
                        if (playerData[id]) {
                            playerData[id].position = { ...activePlayers[id].position };
                        }
                    }
                    
                    // Validate rotation data structure
                    if (data.rotation && typeof data.rotation.x === 'number' && 
                        typeof data.rotation.y === 'number') {
                        activePlayers[id].rotation = {
                            x: data.rotation.x,
                            y: data.rotation.y
                        };
                        
                        // Update persistent storage
                        if (playerData[id]) {
                            playerData[id].rotation = { ...activePlayers[id].rotation };
                        }
                    }
                }
            } else if (data.type === 'username-change') {
                // Handle cosmetic username change
                if (id && activePlayers[id]) {
                    activePlayers[id].username = data.username || `Player${Math.floor(Math.random() * 1000)}`;
                    // Broadcast username change to all other players
                    broadcast({
                        type: 'username-update',
                        id: id,
                        username: activePlayers[id].username
                    }, ws);
                }
            } else if (data.type === 'inventory-update') {
                // Handle inventory update from client
                if (id && playerData[id] && data.inventory) {
                    // Ensure inventory is properly formatted as array of objects
                    let inventory = data.inventory;
                    if (typeof inventory === 'string') {
                        try {
                            inventory = JSON.parse(inventory);
                        } catch (e) {
                            console.error('Failed to parse inventory JSON:', e);
                            return;
                        }
                    }

                    // Validate inventory structure
                    if (Array.isArray(inventory)) {
                        // Ensure each item is an object with type and count
                        inventory = inventory.map(item => {
                            if (typeof item === 'string') {
                                try {
                                    return JSON.parse(item);
                                } catch (e) {
                                    console.error('Failed to parse inventory item:', item);
                                    return { type: 'air', count: 0 };
                                }
                            }
                            return item;
                        });
                        playerData[id].inventory = inventory;
                    } else {
                        console.error('Invalid inventory format received:', inventory);
                        return;
                    }

                    // Save inventory update to database immediately (critical data)
                    const { savePlayerData } = await import('./database.js');
                    await savePlayerData(id, playerData[id]);
                    console.log(`🎒 Inventory saved for player: ${id}`);
                }
            } else if (data.type === 'chat-message') {
                // Handle Chat Message
                const { message } = data;

                // Validate chat message data
                if (typeof message !== 'string' || message.trim().length === 0 || message.length > 256) {
                    console.warn('Invalid chat message:', data);
                    return;
                }

                // Get sender's username
                const senderUsername = activePlayers[id]?.username || 'Unknown';

                // Broadcast chat message to all clients
                broadcast({
                    type: 'chat-message',
                    sender: senderUsername,
                    message: message.trim(),
                    timestamp: Date.now()
                });

                console.log(`Chat: ${senderUsername}: ${message.trim()}`);
            } else if (data.type === 'block-update') {
                // Handle Block Modification (including air/removal)
                const { x, y, z, blockName } = data;

                // Validate block update data
                if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number' ||
                    typeof blockName !== 'string') {
                    console.warn('Invalid block-update data:', data);
                    return;
                }

                const blockId = BLOCK_IDS[blockName];

                if (blockId !== undefined) {
                    const cx = Math.floor(x / CHUNK_SIZE);
                    const cy = Math.floor(y / CHUNK_SIZE);
                    const cz = Math.floor(z / CHUNK_SIZE);

                    let lx = x % CHUNK_SIZE;
                    let ly = y % CHUNK_SIZE;
                    let lz = z % CHUNK_SIZE;
                    if (lx < 0) lx += CHUNK_SIZE;
                    if (ly < 0) ly += CHUNK_SIZE;
                    if (lz < 0) lz += CHUNK_SIZE;

                    const chunkKey = getChunkKey(cx, cy, cz);
                    const localKey = `${lx},${ly},${lz}`;

                    if (!worldData[chunkKey]) {
                        worldData[chunkKey] = {};
                    }

                    // Store block update (including air blocks for removal)
                    worldData[chunkKey][localKey] = blockId;

                    // Save to database
                    const { saveWorldModification } = await import('./database.js');
                    await saveWorldModification(chunkKey, localKey, blockId);
                    console.log(`🧱 Block update saved: ${chunkKey}[${localKey}] = ${blockId}`);

                    // If block is air, we can optionally clean up the entry, but keeping it
                    // ensures we track that this block was explicitly removed

                    // Broadcast to all other clients
                    broadcast({
                        type: 'block-update',
                        x, y, z, blockName
                    }, ws);
                } else {
                    console.warn(`Unknown block name: ${blockName}`);
                }
            }
        } catch (e) {
            console.error('Error processing message:', e);
        }
    });

    ws.on('close', () => {
        if (id) {
            console.log(`Player disconnected: ${id}`);
            delete activePlayers[id];
            broadcast({
                type: 'player-left',
                id: id
            });
        }
    });
});

function broadcast(data, excludeWs) {
    const msg = JSON.stringify(data);
    wss.clients.forEach((client) => {
        if (client !== excludeWs && client.readyState === 1) { // WebSocket.OPEN
            client.send(msg);
        }
    });
}

// Server Tick: Update Game Time (Authoritative)
setInterval(() => {
    dayNightAccumulator += DAY_NIGHT_STEP;
    
    // Update game time using fixed time step
    while (dayNightAccumulator >= DAY_NIGHT_STEP) {
        gameTime += (DAY_NIGHT_STEP / 1000); // Add fixed step in seconds
        if (gameTime > DAY_DURATION) gameTime -= DAY_DURATION;
        dayNightAccumulator -= DAY_NIGHT_STEP;
    }
}, DAY_NIGHT_STEP);

// Dedicated Server Tick: Broadcast World State
setInterval(() => {
    // Only send necessary data (positions)
    const playerUpdates = {};
    for (const [pid, pData] of Object.entries(activePlayers)) {
        // Ensure we send plain objects, not references
        playerUpdates[pid] = {
            id: pData.id,
            username: pData.username,
            position: {
                x: pData.position.x,
                y: pData.position.y,
                z: pData.position.z
            },
            rotation: {
                x: pData.rotation.x,
                y: pData.rotation.y
            }
        };
    }
    
    const snapshot = {
        type: 'state-update',
        players: playerUpdates,
        gameTime: gameTime, // Include synchronized game time
        timestamp: Date.now()
    };
    
    wss.clients.forEach((client) => {
        if (client.readyState === 1) {
            client.send(JSON.stringify(snapshot));
        }
    });
}, 50);

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    console.log(`WebSocket Server active on port ${PORT}`);
});
