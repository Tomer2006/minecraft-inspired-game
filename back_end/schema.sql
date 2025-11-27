-- Database schema for Minecraft-inspired game
-- Run this SQL script to create the necessary tables

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
-- Only one row with id=1
CREATE TABLE IF NOT EXISTS time_data (
    id INTEGER PRIMARY KEY DEFAULT 1,
    game_time REAL NOT NULL,
    last_saved BIGINT NOT NULL
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
