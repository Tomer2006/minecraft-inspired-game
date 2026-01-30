# Minecraft Clone - Backend Server

This is the backend server for the Minecraft-inspired game. It handles WebSocket connections for multiplayer functionality.

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

The server will run on `http://localhost:2025` (or the port specified by `PORT` environment variable).

## Deployment to Railway

1. **Connect Repository**: Go to [Railway Dashboard](https://railway.app/) and click **New Project** -> **Deploy from GitHub repo**

2. **Connect GitHub**: Link your GitHub repository and select the minecraft-inspired-game repository

3. **Configure Settings**:
   - **Name**: `minecraft-backend` (or your preferred name)
   - **Root Directory**: `back_end`
   - **Environment Variables**:
     - `NODE_ENV`: `production`
     - `DATABASE_URL`: Will be set automatically when you add a PostgreSQL database
   - Railway will automatically detect this as a Node.js project

4. **Add Database**: In your Railway project, click **Add Plugin** -> **PostgreSQL**
   - Choose a name (e.g., `minecraft-db`)
   - Railway will automatically set the `DATABASE_URL` environment variable

5. **Deploy**: Railway will automatically build and deploy your application

6. **Get WebSocket URL**: Once deployed, go to your project settings and copy the Railway domain (e.g., `minecraft-backend-production.up.railway.app`)

7. **Update Frontend**: Open `front_end/src/Multiplayer.js` and replace `YOUR_RAILWAY_URL_HERE` with your Railway URL (change `https://` to `wss://`)

### Railway vs Render Migration

If you're migrating from Render to Railway:

1. **Database Migration**: Your existing PostgreSQL data can be exported from Render and imported to Railway using Railway's database tools
2. **Environment Variables**: Railway automatically provides `DATABASE_URL` when you add PostgreSQL
3. **Zero-downtime Deployment**: Railway supports multiple environments and easy rollbacks

## Environment Variables

- `PORT`: Server port (defaults to 2025 if not set). Railway automatically sets this.
- `DATABASE_URL`: PostgreSQL connection string (automatically provided by Railway when you add a PostgreSQL database)
- `NODE_ENV`: Set to `production` for Railway deployment

## Files

- `server.js` - Main server file with WebSocket handling
- `players-data.json` - Persistent player data storage
- `world-data.json` - Persistent world modifications storage

