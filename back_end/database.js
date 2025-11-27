import pg from 'pg';
const { Pool } = pg;

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection
export async function testConnection() {
    try {
        const client = await pool.connect();
        console.log('Database connected successfully');
        client.release();
        return true;
    } catch (err) {
        console.error('Database connection failed:', err);
        return false;
    }
}

// Initialize database schema
export async function initializeDatabase() {
    try {
        const client = await pool.connect();
        const schema = `
            -- Players table: stores player position, rotation, and inventory
            CREATE TABLE IF NOT EXISTS players (
                id VARCHAR(255) PRIMARY KEY,
                position_x REAL NOT NULL,
                position_y REAL NOT NULL,
                position_z REAL NOT NULL,
                rotation_x REAL NOT NULL,
                rotation_y REAL NOT NULL,
                inventory JSONB
            );

            -- Time data table: stores game time and last saved timestamp
            CREATE TABLE IF NOT EXISTS time_data (
                id INTEGER PRIMARY KEY DEFAULT 1,
                game_time REAL NOT NULL DEFAULT 300.0,
                last_saved BIGINT NOT NULL DEFAULT 0
            );

            -- World modifications table: stores block changes by chunk
            CREATE TABLE IF NOT EXISTS world_modifications (
                id SERIAL PRIMARY KEY,
                chunk_key VARCHAR(255) NOT NULL,
                local_key VARCHAR(255) NOT NULL,
                block_id INTEGER NOT NULL,
                UNIQUE(chunk_key, local_key)
            );

            -- Index for efficient chunk lookups
            CREATE INDEX IF NOT EXISTS idx_world_modifications_chunk_key ON world_modifications(chunk_key);
        `;

        await client.query(schema);
        console.log('Database schema initialized');
        client.release();
    } catch (err) {
        console.error('Failed to initialize database:', err);
        throw err;
    }
}

// Player data operations
export async function loadPlayerData() {
    try {
        const result = await pool.query('SELECT * FROM players');
        const playerData = {};
        result.rows.forEach(row => {
            playerData[row.id] = {
                position: {
                    x: row.position_x,
                    y: row.position_y,
                    z: row.position_z
                },
                rotation: {
                    x: row.rotation_x,
                    y: row.rotation_y
                },
                inventory: row.inventory
            };
        });
        return playerData;
    } catch (err) {
        console.error('Failed to load player data:', err);
        return {};
    }
}

export async function savePlayerData(playerId, playerData) {
    try {
        const { position, rotation, inventory } = playerData;
        await pool.query(`
            INSERT INTO players (id, position_x, position_y, position_z, rotation_x, rotation_y, inventory)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (id) DO UPDATE SET
                position_x = EXCLUDED.position_x,
                position_y = EXCLUDED.position_y,
                position_z = EXCLUDED.position_z,
                rotation_x = EXCLUDED.rotation_x,
                rotation_y = EXCLUDED.rotation_y,
                inventory = EXCLUDED.inventory
        `, [playerId, position.x, position.y, position.z, rotation.x, rotation.y, inventory]);
    } catch (err) {
        console.error('Failed to save player data:', err);
        throw err;
    }
}

export async function deletePlayerData(playerId) {
    try {
        await pool.query('DELETE FROM players WHERE id = $1', [playerId]);
    } catch (err) {
        console.error('Failed to delete player data:', err);
        throw err;
    }
}

// Time data operations
export async function loadTimeData() {
    try {
        const result = await pool.query('SELECT * FROM time_data WHERE id = 1');
        if (result.rows.length > 0) {
            const row = result.rows[0];
            return {
                gameTime: row.game_time,
                lastSaved: row.last_saved
            };
        }
        return {};
    } catch (err) {
        console.error('Failed to load time data:', err);
        return {};
    }
}

export async function saveTimeData(gameTime, lastSaved) {
    try {
        await pool.query(`
            INSERT INTO time_data (id, game_time, last_saved)
            VALUES (1, $1, $2)
            ON CONFLICT (id) DO UPDATE SET
                game_time = EXCLUDED.game_time,
                last_saved = EXCLUDED.last_saved
        `, [gameTime, lastSaved]);
    } catch (err) {
        console.error('Failed to save time data:', err);
        throw err;
    }
}

// World data operations
export async function loadWorldData() {
    try {
        const result = await pool.query('SELECT * FROM world_modifications');
        const worldData = {};
        result.rows.forEach(row => {
            if (!worldData[row.chunk_key]) {
                worldData[row.chunk_key] = {};
            }
            worldData[row.chunk_key][row.local_key] = row.block_id;
        });
        return worldData;
    } catch (err) {
        console.error('Failed to load world data:', err);
        return {};
    }
}

export async function saveWorldModification(chunkKey, localKey, blockId) {
    try {
        await pool.query(`
            INSERT INTO world_modifications (chunk_key, local_key, block_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (chunk_key, local_key) DO UPDATE SET
                block_id = EXCLUDED.block_id
        `, [chunkKey, localKey, blockId]);
    } catch (err) {
        console.error('Failed to save world modification:', err);
        throw err;
    }
}

export async function deleteWorldModification(chunkKey, localKey) {
    try {
        await pool.query('DELETE FROM world_modifications WHERE chunk_key = $1 AND local_key = $2', [chunkKey, localKey]);
    } catch (err) {
        console.error('Failed to delete world modification:', err);
        throw err;
    }
}

// Migration functions
export async function migratePlayerData(jsonData) {
    try {
        const client = await pool.connect();
        for (const [playerId, data] of Object.entries(jsonData)) {
            await client.query(`
                INSERT INTO players (id, position_x, position_y, position_z, rotation_x, rotation_y, inventory)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (id) DO NOTHING
            `, [
                playerId,
                data.position.x,
                data.position.y,
                data.position.z,
                data.rotation.x,
                data.rotation.y,
                data.inventory || null
            ]);
        }
        client.release();
        console.log(`Migrated ${Object.keys(jsonData).length} players`);
    } catch (err) {
        console.error('Failed to migrate player data:', err);
        throw err;
    }
}

export async function migrateTimeData(jsonData) {
    try {
        await pool.query(`
            INSERT INTO time_data (id, game_time, last_saved)
            VALUES (1, $1, $2)
            ON CONFLICT (id) DO NOTHING
        `, [jsonData.gameTime || 300.0, jsonData.lastSaved || Date.now()]);
        console.log('Migrated time data');
    } catch (err) {
        console.error('Failed to migrate time data:', err);
        throw err;
    }
}

export async function migrateWorldData(jsonData) {
    try {
        const client = await pool.connect();
        let count = 0;
        for (const [chunkKey, modifications] of Object.entries(jsonData)) {
            for (const [localKey, blockId] of Object.entries(modifications)) {
                await client.query(`
                    INSERT INTO world_modifications (chunk_key, local_key, block_id)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (chunk_key, local_key) DO NOTHING
                `, [chunkKey, localKey, blockId]);
                count++;
            }
        }
        client.release();
        console.log(`Migrated ${count} world modifications`);
    } catch (err) {
        console.error('Failed to migrate world data:', err);
        throw err;
    }
}
