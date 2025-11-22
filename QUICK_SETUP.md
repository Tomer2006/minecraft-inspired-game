# Quick Setup: Local Backend + Netlify Front-End

Follow these steps to get everything running:

## Step 1: Start Backend (Already Running ✅)

Your backend should be running. If not:
```powershell
cd back_end
npm start
```

## Step 2: Start Tunnel

**Open a NEW PowerShell window** and run:

```powershell
lt --port 2025
```

You'll see output like:
```
your url is: https://random-name-12345.loca.lt
```

**IMPORTANT**: 
- Keep this window open!
- Copy the URL (e.g., `https://random-name-12345.loca.lt`)
- First time: You may need to visit the URL in browser to activate

## Step 3: Update Front-End Code

1. Open `front_end/src/Multiplayer.js`
2. Find line 19
3. Replace `wss://YOUR_RENDER_URL_HERE` with your tunnel URL

**Example:**
```javascript
// Change this:
const PRODUCTION_BACKEND_URL = 'wss://YOUR_RENDER_URL_HERE';

// To this (using your tunnel URL):
const PRODUCTION_BACKEND_URL = 'wss://random-name-12345.loca.lt';
```

**Important**: 
- Remove `https://` 
- Use `wss://` instead
- No trailing slash

## Step 4: Deploy to Netlify

1. **Commit and push changes:**
   ```powershell
   git add front_end/src/Multiplayer.js
   git commit -m "Configure for local backend tunnel"
   git push
   ```

2. **Deploy to Netlify:**
   - Go to https://app.netlify.com
   - Sign in with GitHub
   - Click "Add new site" → "Import an existing project"
   - Select your repository
   - Set Base directory: `front_end`
   - Click "Deploy site"

3. **Wait for deployment** (1-2 minutes)

## Step 5: Test!

1. Open your Netlify URL (e.g., `https://your-site.netlify.app`)
2. Open browser console (F12)
3. Click "Online" button
4. Should see: `Connected to multiplayer server`

## Keep Running

You need to keep **TWO things running**:
1. ✅ Backend: `npm start` in `back_end` folder
2. ✅ Tunnel: `lt --port 2025` in separate terminal

## If Tunnel URL Changes

If you restart the tunnel, you'll get a new URL. Update `Multiplayer.js` and redeploy:
```powershell
# 1. Get new tunnel URL
lt --port 2025

# 2. Update Multiplayer.js with new URL

# 3. Commit and push
git add front_end/src/Multiplayer.js
git commit -m "Update tunnel URL"
git push

# 4. Netlify auto-redeploys
```

## Troubleshooting

**Can't connect?**
- Check backend is running: `http://localhost:2025`
- Check tunnel is running (terminal window)
- Verify URL in `Multiplayer.js` uses `wss://` (not `ws://` or `https://`)
- Check browser console for errors

**Tunnel not working?**
- Visit the tunnel URL in browser first (activation)
- Try restarting tunnel
- Check firewall isn't blocking

