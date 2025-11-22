# Local Backend Setup Guide

This guide will help you run the backend server on your computer for local development and testing.

## Quick Start

### 1. Install Dependencies

Open a terminal in the `back_end` folder and run:

```bash
cd back_end
npm install
```

This will install the required `ws` (WebSocket) package.

### 2. Start the Backend Server

```bash
npm start
```

The server will start on `http://localhost:2025` (or the port specified by the `PORT` environment variable).

You should see:
```
Server running at http://localhost:2025/
WebSocket Server active on port 2025
```

### 3. Test Locally

1. **Start the backend** (keep it running in the terminal)
2. **Open the front-end** in your browser:
   - If you have a local server running, open `http://localhost:8000` (or your port)
   - Or use VS Code Live Server, Python's `python -m http.server`, etc.
3. **Click "Online"** in the game menu
4. **Check browser console** - you should see: `Connected to multiplayer server`

The front-end automatically detects when it's running on `localhost` and connects to `ws://localhost:2025`.

---

## Running Backend in Background (Windows PowerShell)

If you want to keep the backend running while doing other things:

```powershell
# Start backend in background
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\back_end'; npm start"
```

Or use a separate terminal window and keep it open.

---

## Changing the Port

If port 2025 is already in use, you can change it:

### Option 1: Environment Variable (Recommended)

**Windows PowerShell:**
```powershell
$env:PORT=3000
npm start
```

**Windows CMD:**
```cmd
set PORT=3000
npm start
```

**Linux/Mac:**
```bash
PORT=3000 npm start
```

### Option 2: Edit server.js

You can change the default port in `back_end/server.js`:
```javascript
const PORT = process.env.PORT || 3000; // Change 2025 to your preferred port
```

**Important**: If you change the port, also update `front_end/src/Multiplayer.js` line 27:
```javascript
const port = 3000; // Match your backend port
```

---

## Testing Multiplayer Locally

1. **Start backend server** (keep it running)
2. **Open front-end in two browser windows**:
   - Window 1: `http://localhost:8000`
   - Window 2: `http://localhost:8000` (or incognito)
3. **Both click "Online"**
4. **You should see both players** in the game world!

---

## Troubleshooting

### Port Already in Use

**Error**: `Error: listen EADDRINUSE: address already in use :::2025`

**Solution**:
- Find what's using port 2025:
  ```powershell
  netstat -ano | findstr :2025
  ```
- Kill the process or use a different port (see "Changing the Port" above)

### Cannot Connect to Backend

**Check**:
1. Is the backend server running? (Check terminal for "Server running" message)
2. Is it running on the correct port? (Check terminal output)
3. Open browser console (F12) - what error do you see?
4. Try accessing `http://localhost:2025` in browser - should show connection attempt

### WebSocket Connection Failed

**Common causes**:
- Backend not running
- Wrong port number
- Firewall blocking connection
- Front-end trying to connect to wrong URL

**Fix**:
- Verify backend is running: `http://localhost:2025`
- Check `Multiplayer.js` line 27 has correct port
- Check browser console for exact error message

---

## Exposing Local Backend to Internet (Optional)

If you want your Netlify-deployed front-end to connect to your local backend, you'll need a tunneling service.

### Using ngrok (Recommended)

1. **Install ngrok**: https://ngrok.com/download
2. **Start your backend** on port 2025
3. **In a new terminal**, run:
   ```bash
   ngrok http 2025
   ```
4. **Copy the HTTPS URL** (e.g., `https://abc123.ngrok.io`)
5. **Update `front_end/src/Multiplayer.js`**:
   ```javascript
   const PRODUCTION_BACKEND_URL = 'wss://abc123.ngrok.io';
   ```
6. **Redeploy front-end** to Netlify

**Note**: Free ngrok URLs change each time you restart ngrok. For permanent URLs, upgrade to a paid plan.

### Using localtunnel (Free Alternative)

1. **Install localtunnel**:
   ```bash
   npm install -g localtunnel
   ```
2. **Start your backend** on port 2025
3. **In a new terminal**, run:
   ```bash
   lt --port 2025
   ```
4. **Copy the URL** provided (e.g., `https://random-name.loca.lt`)
5. **Update `front_end/src/Multiplayer.js`** with the URL (use `wss://`)

---

## File Structure

```
back_end/
├── server.js          # Main server file
├── package.json       # Dependencies
├── players-data.json  # Player data (created automatically)
└── world-data.json    # World data (created automatically)
```

---

## Stopping the Server

- **In terminal**: Press `Ctrl + C`
- The server will save data before exiting

---

## Data Persistence

The backend saves:
- **Player positions** → `players-data.json`
- **World modifications** → `world-data.json`

Data is saved:
- Every 30 seconds automatically
- When you stop the server (Ctrl+C)

---

## Next Steps

- ✅ Backend running locally
- ✅ Front-end connecting to local backend
- ✅ Testing multiplayer with multiple browser windows
- 🔄 (Optional) Expose backend to internet for Netlify front-end
- 🔄 (Optional) Deploy backend to cloud service later

---

## Quick Reference

**Start Backend:**
```bash
cd back_end
npm install  # First time only
npm start
```

**Default Port:** 2025

**Local WebSocket URL:** `ws://localhost:2025`

**Test URL:** `http://localhost:2025` (should attempt connection)

