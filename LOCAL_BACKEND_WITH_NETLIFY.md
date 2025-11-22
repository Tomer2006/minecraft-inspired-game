# Running Backend Locally with Netlify Front-End

This guide shows you how to run your backend server on your computer and deploy your front-end to Netlify, connecting them together using a tunneling service.

## Overview

- **Backend**: Runs on your computer (`localhost:2025`)
- **Front-End**: Deployed to Netlify
- **Connection**: Uses a tunnel (ngrok/localtunnel) to expose your local backend to the internet

---

## Step 1: Set Up Backend on Your Computer

### Install Dependencies (if not already done)

```powershell
cd back_end
npm install
```

### Start Backend Server

```powershell
npm start
```

Keep this terminal window open - the server must stay running!

You should see:
```
Server running at http://localhost:2025/
WebSocket Server active on port 2025
```

---

## Step 2: Expose Backend to Internet

You need a tunneling service to make your local backend accessible from the internet. Choose one:

### Option A: ngrok (Recommended - More Reliable)

#### Install ngrok

1. Download from: https://ngrok.com/download
2. Extract `ngrok.exe` to a folder (e.g., `C:\ngrok\`)
3. Add to PATH or use full path

#### Start Tunnel

**In a NEW terminal window** (keep backend running in the first terminal):

```powershell
ngrok http 2025
```

You'll see output like:
```
Forwarding  https://abc123-def456.ngrok-free.app -> http://localhost:2025
```

**Copy the HTTPS URL** (e.g., `https://abc123-def456.ngrok-free.app`)

**Important**: 
- Keep BOTH terminals open (backend + ngrok)
- Free ngrok URLs change each time you restart ngrok
- For permanent URLs, upgrade to ngrok paid plan

### Option B: localtunnel (Free Alternative)

#### Install localtunnel

```powershell
npm install -g localtunnel
```

#### Start Tunnel

**In a NEW terminal window** (keep backend running):

```powershell
lt --port 2025
```

You'll see output like:
```
your url is: https://random-name.loca.lt
```

**Copy the URL** provided

**Note**: localtunnel may ask you to visit a URL in browser to activate (first time only)

---

## Step 3: Update Front-End Configuration

### Get Your Tunnel URL

From Step 2, you should have a URL like:
- `https://abc123-def456.ngrok-free.app` (ngrok)
- `https://random-name.loca.lt` (localtunnel)

### Update Multiplayer.js

1. Open `front_end/src/Multiplayer.js`
2. Find line 19: `const PRODUCTION_BACKEND_URL = 'wss://YOUR_RENDER_URL_HERE';`
3. Replace with your tunnel URL, converting `https://` to `wss://`:

**For ngrok:**
```javascript
const PRODUCTION_BACKEND_URL = 'wss://abc123-def456.ngrok-free.app';
```

**For localtunnel:**
```javascript
const PRODUCTION_BACKEND_URL = 'wss://random-name.loca.lt';
```

**Important**: 
- Remove the `https://` part
- Use `wss://` (secure WebSocket)
- Don't include trailing slashes

### Example Update

```javascript
// Before:
const PRODUCTION_BACKEND_URL = 'wss://YOUR_RENDER_URL_HERE';

// After (ngrok example):
const PRODUCTION_BACKEND_URL = 'wss://abc123-def456.ngrok-free.app';
```

---

## Step 4: Deploy Front-End to Netlify

### Push Changes to GitHub

```powershell
git add front_end/src/Multiplayer.js
git commit -m "Configure front-end to use local backend tunnel"
git push
```

### Deploy to Netlify

1. Go to https://app.netlify.com
2. Sign in with GitHub
3. Click "Add new site" → "Import an existing project"
4. Select your repository
5. Configure:
   - **Base directory**: `front_end`
   - **Build command**: (leave empty)
   - **Publish directory**: `.`
6. Click "Deploy site"
7. Wait for deployment (1-2 minutes)

---

## Step 5: Test Everything

### Before Testing - Make Sure:

✅ Backend is running (`npm start` in `back_end` folder)  
✅ Tunnel is running (ngrok or localtunnel)  
✅ Front-end deployed to Netlify  
✅ `Multiplayer.js` updated with tunnel URL  

### Test Steps:

1. **Open your Netlify URL** (e.g., `https://your-site.netlify.app`)
2. **Open browser console** (F12)
3. **Click "Online"** button in the game
4. **Check console** - should see: `Connected to multiplayer server`
5. **Open game in second browser/incognito** - both players should appear!

---

## Important Notes

### Keep Services Running

You need to keep **THREE things running**:
1. ✅ Backend server (`npm start` in `back_end`)
2. ✅ Tunnel service (ngrok or localtunnel)
3. ✅ Netlify front-end (deployed, stays running automatically)

### Tunnel URL Changes

- **ngrok free**: URL changes every time you restart ngrok
- **localtunnel**: URL changes each time you restart
- **Solution**: Use ngrok paid plan for permanent URLs, or update `Multiplayer.js` and redeploy when URL changes

### When Tunnel URL Changes

If your tunnel URL changes (after restarting ngrok/localtunnel):

1. Get new tunnel URL
2. Update `front_end/src/Multiplayer.js` line 19
3. Commit and push:
   ```powershell
   git add front_end/src/Multiplayer.js
   git commit -m "Update tunnel URL"
   git push
   ```
4. Netlify will auto-redeploy

---

## Troubleshooting

### Front-End Can't Connect

**Check**:
1. Is backend running? (Check terminal for "Server running" message)
2. Is tunnel running? (Check ngrok/localtunnel terminal)
3. Is tunnel URL correct in `Multiplayer.js`? (Use `wss://`, not `ws://` or `https://`)
4. Check browser console for specific error

**Common Errors**:
- `WebSocket connection failed` → Tunnel not running or wrong URL
- `net::ERR_CONNECTION_REFUSED` → Backend not running
- `404 Not Found` → Wrong tunnel URL

### Tunnel Not Working

**ngrok**:
- Make sure you're using HTTPS URL (not HTTP)
- Check ngrok terminal for errors
- Try restarting ngrok

**localtunnel**:
- Visit the activation URL in browser (first time)
- Check for firewall blocking
- Try different port: `lt --port 2025 --subdomain mygame` (if available)

### Backend Not Starting

- Check if port 2025 is in use:
  ```powershell
  netstat -ano | findstr :2025
  ```
- Use different port: `$env:PORT=3000; npm start`
- Update `Multiplayer.js` port if changed

---

## Quick Reference

### Start Everything (3 terminals needed)

**Terminal 1 - Backend:**
```powershell
cd back_end
npm start
```

**Terminal 2 - Tunnel (ngrok):**
```powershell
ngrok http 2025
```

**Terminal 3 - Tunnel (localtunnel alternative):**
```powershell
lt --port 2025
```

### Update Front-End URL

Edit `front_end/src/Multiplayer.js` line 19:
```javascript
const PRODUCTION_BACKEND_URL = 'wss://your-tunnel-url-here';
```

### Deploy to Netlify

1. Commit changes: `git add . && git commit -m "Update" && git push`
2. Netlify auto-deploys from GitHub

---

## Alternative: Use ngrok with Custom Domain (Paid)

If you upgrade ngrok to a paid plan, you can:
1. Get a permanent URL (e.g., `wss://minecraft-backend.ngrok.io`)
2. Set it once in `Multiplayer.js`
3. Never need to update it again

---

## Summary

✅ Backend runs locally on your computer  
✅ Tunnel exposes it to internet  
✅ Front-end on Netlify connects via tunnel  
✅ Everything works together!  

**Remember**: Keep backend and tunnel running whenever you want multiplayer to work!

