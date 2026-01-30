# PostgreSQL Migration Guide

This guide explains how to migrate your Minecraft-inspired game from JSON file storage to Railway or Render's Managed PostgreSQL database.

## Quick Start

For experienced users:

1. Create Railway PostgreSQL database (or Render PostgreSQL database)
2. Set `DATABASE_URL` environment variable (automatically done on Railway)
3. Run `npm install && npm run migrate`
4. Deploy to Railway (or Render) with `DATABASE_URL` set
5. Backup and remove JSON files

See detailed steps below.

## Prerequisites

1. A Railway account with PostgreSQL database provisioned (or Render account with PostgreSQL)
2. Node.js environment with npm
3. Existing JSON data files (players-data.json, time-data.json, world-data.json)

## Step 1: Set up PostgreSQL Database

### Option A: Railway (Recommended)

1. Log into your Railway dashboard
2. Create a new project or use an existing one
3. Add a PostgreSQL database:
   - Click "Add Plugin" → "PostgreSQL"
   - Choose a name (e.g., `minecraft-db`)
   - Railway will automatically create the database and set the `DATABASE_URL` environment variable
4. The database will be provisioned automatically with no additional configuration needed

### Option B: Render

1. Log into your Render dashboard
2. Create a new PostgreSQL database:
   - Go to "New" → "PostgreSQL"
   - Choose a name (e.g., `minecraft-db`)
   - Select a region close to your users
   - Choose the free tier or paid plan as needed
3. Wait for the database to be provisioned
4. Copy the `DATABASE_URL` from the database settings

## Step 2: Install Dependencies

Run the following command in the `back_end` directory:

```bash
npm install
```

This will install the `pg` (PostgreSQL client) dependency.

## Step 3: Set Environment Variables

Set the `DATABASE_URL` environment variable to point to your Render PostgreSQL database:

### For local development:
```bash
export DATABASE_URL="postgresql://username:password@host:port/database"
```

### For Railway deployment:
Railway automatically sets the `DATABASE_URL` environment variable when you add a PostgreSQL database.

### For Render deployment:
Add the `DATABASE_URL` environment variable in your Render web service settings.

## Step 4: Test Locally (Optional but Recommended)

Before deploying, test the migration locally:

1. **Set up a local PostgreSQL database** (optional):
   ```bash
   # Using Docker (recommended for testing)
   docker run --name postgres-minecraft -e POSTGRES_PASSWORD=mypassword -e POSTGRES_DB=minecraft -p 5432:5432 -d postgres:15

   # Set DATABASE_URL for local testing
   export DATABASE_URL="postgresql://postgres:mypassword@localhost:5432/minecraft"
   ```

2. **Test the migration**:
   ```bash
   npm run migrate
   ```

3. **Test the server**:
   ```bash
   npm start
   ```
   Verify that players can join, move, and modify blocks, and that data persists.

## Step 5: Run Migration

Migrate your existing JSON data to PostgreSQL:

```bash
npm run migrate
```

**Important Notes:**
- The migration script is **idempotent** - it can be run multiple times safely
- Existing data will not be overwritten; new data will be added alongside existing data
- The script creates all necessary tables and indexes automatically

This will:
- Connect to your PostgreSQL database
- Create the necessary tables (players, time_data, world_modifications)
- Import all existing data from the JSON files
- Preserve your current game state

## Step 6: Deploy to Railway or Render

### For Railway:
1. Deploy your updated backend to Railway (it will automatically detect the PostgreSQL database)
2. Railway will automatically set the `DATABASE_URL` environment variable
3. Your server will now use PostgreSQL instead of JSON files

### For Render:
1. Deploy your updated backend to Render
2. Ensure the `DATABASE_URL` environment variable is set in your Render service
3. Your server will now use PostgreSQL instead of JSON files

## Step 7: Backup and Cleanup (Optional)

After confirming the migration was successful:

1. **Backup your JSON files** (recommended):
   ```bash
   cp players-data.json players-data.json.backup
   cp time-data.json time-data.json.backup
   cp world-data.json world-data.json.backup
   ```

2. **Remove the JSON files** (optional, but recommended for production):
   ```bash
   rm players-data.json time-data.json world-data.json
   ```

## Database Schema

The migration creates three tables with optimized indexes:

### `players`
- `id` (VARCHAR(255), Primary Key) - Player ID
- `position_x`, `position_y`, `position_z` (REAL) - Player position coordinates
- `rotation_x`, `rotation_y` (REAL) - Player rotation angles
- `inventory` (JSONB) - Player inventory as JSON array

### `time_data`
- `id` (INTEGER, Primary Key, default: 1) - Always 1 (single row table)
- `game_time` (REAL) - Current game time in seconds
- `last_saved` (BIGINT) - Timestamp of last save (milliseconds since epoch)

### `world_modifications`
- `id` (SERIAL, Primary Key) - Auto-incrementing ID
- `chunk_key` (VARCHAR(255)) - Chunk coordinates (e.g., "1,2,3")
- `local_key` (VARCHAR(255)) - Local block coordinates within chunk (e.g., "5,7,10")
- `block_id` (INTEGER) - Block type ID (0=air, 1=grass, 2=dirt, etc.)

**Indexes:**
- `idx_world_modifications_chunk_key` on `world_modifications(chunk_key)` for fast chunk queries
- Primary key indexes on all tables

## Troubleshooting

### Connection Issues
- **Verify DATABASE_URL format**: Should be `postgresql://user:password@host:port/database`
- **SSL Configuration**: Automatically handled for production (Render)
- **Local Development**: For local testing, ensure PostgreSQL is running and accessible
- **Firewall**: Render databases may restrict IP access; use Render's connection pooling for external access

### Migration Failures
- **JSON Files**: Ensure `players-data.json`, `time-data.json`, and `world-data.json` exist and contain valid JSON
- **Database Permissions**: Verify the database user has CREATE, INSERT, UPDATE permissions
- **Duplicate Data**: Migration is idempotent; existing data won't be overwritten
- **Large Datasets**: For very large worlds, migration may take time; monitor server logs

### Performance Issues
- **Auto-save Frequency**: Player positions saved every 30 seconds; inventory changes saved immediately
- **World Modifications**: Saved incrementally on each block change
- **Database Indexes**: Optimized for chunk-based queries
- **Connection Pooling**: Database connections are automatically pooled for efficiency

### Common Errors

**"Connection terminated unexpectedly"**
- Check DATABASE_URL format and credentials
- Verify database is running and accessible

**"Relation 'players' does not exist"**
- Run migration script first: `npm run migrate`
- Ensure database user has table creation permissions

**"SSL connection error"**
- For local development, the connection automatically disables SSL
- For Render, SSL is required and automatically configured

### Monitoring Database Usage

Render provides database metrics in your dashboard:
- **Connection Count**: Monitor active connections
- **Storage Usage**: Track database size growth
- **Query Performance**: Check slow query logs if available

For local testing with Docker:
```bash
# Check container logs
docker logs postgres-minecraft

# Access PostgreSQL shell
docker exec -it postgres-minecraft psql -U postgres -d minecraft
```

## Database Maintenance

### Backups
Render automatically backs up your PostgreSQL database, but consider additional backups:

1. **Manual Export** (for development/testing):
   ```bash
   # Export players
   docker exec postgres-minecraft pg_dump -U postgres -d minecraft -t players > players_backup.sql

   # Export all tables
   docker exec postgres-minecraft pg_dump -U postgres -d minecraft > full_backup.sql
   ```

2. **Data Export to JSON** (emergency fallback):
   ```javascript
   // Run this in Node.js to export current data to JSON
   import { loadPlayerData, loadTimeData, loadWorldData } from './database.js';
   import fs from 'fs';

   const players = await loadPlayerData();
   const timeData = await loadTimeData();
   const worldData = await loadWorldData();

   fs.writeFileSync('players-export.json', JSON.stringify(players, null, 2));
   fs.writeFileSync('time-export.json', JSON.stringify(timeData, null, 2));
   fs.writeFileSync('world-export.json', JSON.stringify(worldData, null, 2));
   ```

### Scaling Considerations
- **Free Tier Limits**: Render's free PostgreSQL has 750MB storage limit
- **Connection Limits**: Monitor concurrent connections (free tier: 5 max)
- **Performance**: For high-traffic games, consider upgrading to paid plans

## Reverting to JSON Files

If you need to revert to JSON files:

1. **Stop the server**
2. **Export current data** (see Database Maintenance section above)
3. **Restore original server.js**:
   - Comment out PostgreSQL imports
   - Uncomment the original JSON-based loadData() and saveData() functions
   - Remove async/await from WebSocket handlers
4. **Restore JSON files** from your backups
5. **Remove PostgreSQL dependency**:
   ```bash
   npm uninstall pg
   ```
6. **Test thoroughly** before deploying

## Support

### Getting Help

If you encounter issues:

1. **Check Logs**: Server logs contain detailed error information
   ```bash
   # View recent logs
   npm start 2>&1 | tail -50
   ```

2. **Verify Configuration**:
   - `DATABASE_URL` format and accessibility
   - Environment variables in Render dashboard
   - Database permissions and connection limits

3. **Test Incrementally**:
   - Test migration locally first
   - Verify each component (connection, schema creation, data import)
   - Test with a small dataset before full migration

4. **Database Debugging**:
   ```bash
   # Check table contents
   docker exec -it postgres-minecraft psql -U postgres -d minecraft -c "SELECT COUNT(*) FROM players;"
   docker exec -it postgres-minecraft psql -U postgres -d minecraft -c "SELECT * FROM time_data;"
   ```

### Migration Checklist

- [ ] PostgreSQL database created on Render
- [ ] `DATABASE_URL` environment variable set
- [ ] Dependencies installed (`npm install`)
- [ ] Migration script tested locally (optional)
- [ ] Migration completed successfully (`npm run migrate`)
- [ ] Server tested with database connection
- [ ] JSON files backed up
- [ ] Deployment successful on Render

### Performance Benchmarks

Expected performance with default settings:
- **Player Joins**: < 100ms database response time
- **Block Updates**: < 50ms for individual block changes
- **Auto-save**: Completes within 5 seconds for typical player counts
- **Memory Usage**: ~50MB additional RAM for connection pooling
