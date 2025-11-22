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

## Deployment to Render.com

1. **Connect Repository**: Go to [Render Dashboard](https://dashboard.render.com/) and click **New +** -> **Web Service**

2. **Connect GitHub**: Link your GitHub repository

3. **Configure Settings**:
   - **Name**: `minecraft-backend` (or your preferred name)
   - **Root Directory**: `back end` (or `backend` if you renamed it)
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: Choose Free or Paid plan

4. **Deploy**: Click **Create Web Service** and wait for deployment

5. **Get WebSocket URL**: Once deployed, copy your Render URL (e.g., `https://minecraft-backend.onrender.com`)

6. **Update Frontend**: Open `frontend/src/Multiplayer.js` and replace `YOUR_RENDER_URL_HERE` with your Render URL (change `https://` to `wss://`)

## Environment Variables

- `PORT`: Server port (defaults to 2025 if not set). Render automatically sets this.

## Files

- `server.js` - Main server file with WebSocket handling
- `players-data.json` - Persistent player data storage
- `world-data.json` - Persistent world modifications storage

