#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    testConnection,
    initializeDatabase,
    migratePlayerData,
    migrateTimeData,
    migrateWorldData
} from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// File paths
const PLAYERS_FILE = 'players-data.json';
const TIME_FILE = 'time-data.json';
const WORLD_FILE = 'world-data.json';

async function loadJsonFile(filename) {
    try {
        if (fs.existsSync(filename)) {
            const data = fs.readFileSync(filename, 'utf8');
            return JSON.parse(data);
        }
        return {};
    } catch (e) {
        console.error(`Failed to load ${filename}:`, e);
        return {};
    }
}

async function migrateData() {
    console.log('Starting data migration to PostgreSQL...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'NOT SET');
    console.log('NODE_ENV:', process.env.NODE_ENV);

    // Test database connection
    const connected = await testConnection();
    if (!connected) {
        console.error('Cannot connect to database. Please check your DATABASE_URL environment variable.');
        process.exit(1);
    }

    // Initialize database schema
    console.log('Initializing database schema...');
    await initializeDatabase();

    // Load existing JSON data
    console.log('Loading existing JSON data...');
    const playerData = await loadJsonFile(PLAYERS_FILE);
    const timeData = await loadJsonFile(TIME_FILE);
    const worldData = await loadJsonFile(WORLD_FILE);

    // Migrate data
    console.log('Migrating player data...');
    await migratePlayerData(playerData);

    console.log('Migrating time data...');
    await migrateTimeData(timeData);

    console.log('Migrating world data...');
    await migrateWorldData(worldData);

    console.log('Migration completed successfully!');
    console.log('You can now update your server.js to use the database instead of JSON files.');
    console.log('Remember to set the DATABASE_URL environment variable in your Render deployment.');
}

// Run migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    migrateData().catch(err => {
        console.error('Migration failed:', err);
        process.exit(1);
    });
}

export { migrateData };
