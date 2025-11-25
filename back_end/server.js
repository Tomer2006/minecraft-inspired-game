import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 2025;
const WORLD_FILE = 'world-data.json';
const PLAYERS_FILE = 'players-data.json';
const SAVE_INTERVAL = 30000; // 30 seconds

// --- Game Constants (Mirrored from Chunk.js) ---
const CHUNK_SIZE = 16;
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
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
};

// --- Data Storage ---
// World: { "cx,cy,cz": { "lx,ly,lz": blockId } }
let worldData = {};
// Players: { "playerId": { position: {x,y,z}, rotation: {x,y} } }
let playerData = {};

// Load Data
function loadData() {
    if (fs.existsSync(WORLD_FILE)) {
        try {
            const data = fs.readFileSync(WORLD_FILE, 'utf8');
            worldData = JSON.parse(data);
            console.log(`World loaded. ${Object.keys(worldData).length} chunks modified.`);
        } catch (e) {
            console.error('Failed to load world data:', e);
            worldData = {};
        }
    }

    if (fs.existsSync(PLAYERS_FILE)) {
        try {
            const data = fs.readFileSync(PLAYERS_FILE, 'utf8');
            playerData = JSON.parse(data);
            console.log(`Player data loaded. ${Object.keys(playerData).length} known players.`);
        } catch (e) {
            console.error('Failed to load player data:', e);
            playerData = {};
        }
    }
}
loadData();

// Save Data Function
function saveData() {
    try {
        console.log('Saving data...');
        fs.writeFileSync(WORLD_FILE, JSON.stringify(worldData, null, 2));
        fs.writeFileSync(PLAYERS_FILE, JSON.stringify(playerData, null, 2));
        console.log('Data saved.');
    } catch (e) {
        console.error('Failed to save data:', e);
    }
}

// Auto-save loop
setInterval(saveData, SAVE_INTERVAL);

// Save on exit
process.on('SIGINT', () => {
    saveData();
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

    ws.on('message', (message) => {
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
                        rotation: { x: 0, y: 0 }
                    };
                }

                // Add to active session
                activePlayers[id] = {
                    id: id,
                    ws: ws,
                    position: playerData[id].position,
                    rotation: playerData[id].rotation
                };

                // Send Init Packet
                ws.send(JSON.stringify({
                    type: 'init',
                    id: id,
                    position: playerData[id].position, // Send saved position
                    rotation: playerData[id].rotation,
                    players: Object.values(activePlayers).map(p => ({
                        id: p.id,
                        position: p.position,
                        rotation: p.rotation
                    })),
                    world: getInitialWorldState()
                }));

                // Broadcast Join to others
                broadcast({
                    type: 'player-joined',
                    id: id,
                    position: activePlayers[id].position,
                    rotation: activePlayers[id].rotation
                }, ws);

            } else if (data.type === 'update') {
                if (id && activePlayers[id]) {
                    activePlayers[id].position = data.position;
                    activePlayers[id].rotation = data.rotation;
                    
                    // Update persistent storage
                    if (playerData[id]) {
                        playerData[id].position = data.position;
                        playerData[id].rotation = data.rotation;
                    }
                }
            } else if (data.type === 'block-update') {
                // Handle Block Modification
                const { x, y, z, blockName } = data;
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

                    worldData[chunkKey][localKey] = blockId;

                    broadcast({
                        type: 'block-update',
                        x, y, z, blockName
                    }, ws);
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

// Dedicated Server Tick: Broadcast World State
setInterval(() => {
    // Only send necessary data (positions)
    const playerUpdates = {};
    for (const [pid, pData] of Object.entries(activePlayers)) {
        playerUpdates[pid] = {
            id: pData.id,
            position: pData.position,
            rotation: pData.rotation
        };
    }
    
    const snapshot = {
        type: 'state-update',
        players: playerUpdates,
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
