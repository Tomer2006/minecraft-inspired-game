# Minecraft Clone - Frontend

This is the frontend client for the Minecraft-inspired game. It runs in the browser and connects to the backend server for multiplayer functionality.

## Local Development

1. **Start Backend**: Make sure the backend server is running (see `back end/README.md`)

2. **Serve Files**: You can use any static file server:
   - Python: `python -m http.server 8000`
   - Node.js: `npx serve .`
   - VS Code: Use Live Server extension

3. **Open**: Navigate to `http://localhost:8000` (or your chosen port)

## Deployment to Netlify

1. **Push to GitHub**: Make sure your code is pushed to GitHub

2. **Connect Repository**: Go to [Netlify](https://app.netlify.com/) and click **Add new site** -> **Import from Git**

3. **Select Repository**: Choose your GitHub repository

4. **Configure Settings**:
   - **Base directory**: `frontend`
   - **Build command**: (leave empty - no build needed)
   - **Publish directory**: `frontend` (or `.` if base directory is already `frontend`)

5. **Deploy**: Click **Deploy site**

6. **Update Backend URL**: After deploying backend to Render, update `src/Multiplayer.js`:
   - Find: `const PRODUCTION_BACKEND_URL = 'wss://YOUR_RENDER_URL_HERE';`
   - Replace with your Render WebSocket URL (e.g., `wss://minecraft-backend.onrender.com`)

## Files Structure

- `index.html` - Main HTML file
- `styles.css` - Game styles
- `src/` - All game source code
- `textures/` - Block texture images
- `netlify.toml` - Netlify deployment configuration

