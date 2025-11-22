# Complete Deployment Guide

This guide will help you deploy both the **front-end** (to Netlify) and **back-end** (to Render or Railway) of your Minecraft-inspired game.

## Important Note

**Netlify cannot host WebSocket servers.** Your backend uses WebSocket for real-time multiplayer, so it needs to be deployed to a service that supports persistent connections. We'll use:
- **Front-end**: Netlify (free static hosting)
- **Back-end**: Render.com or Railway.app (both support WebSocket)

---

## Part 1: Deploy Backend First

You need to deploy the backend first to get its URL, which you'll then use in the front-end.

### Option A: Deploy to Render.com (Recommended - Free Tier Available)

1. **Create a Render Account**
   - Go to https://render.com
   - Sign up with GitHub (recommended)

2. **Create a New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select your repository

3. **Configure the Service**
   - **Name**: `minecraft-backend` (or any name you like)
   - **Region**: Choose closest to you
   - **Branch**: `main` (or your default branch)
   - **Root Directory**: `back_end`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (or paid if you need more resources)

4. **Environment Variables** (if needed)
   - `PORT`: Render will set this automatically, but your code uses `process.env.PORT || 2025` which is fine

5. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment (5-10 minutes on free tier)
   - Once deployed, you'll get a URL like: `https://minecraft-backend.onrender.com`

6. **Important**: Render free tier spins down after 15 minutes of inactivity. The first request after spin-down takes ~30 seconds. Consider upgrading to paid plan for always-on service.

### Option B: Deploy to Railway.app (Alternative)

1. **Create a Railway Account**
   - Go to https://railway.app
   - Sign up with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Configure Service**
   - Railway will auto-detect Node.js
   - Set **Root Directory** to `back_end`
   - Railway will automatically detect `package.json` and run `npm start`

4. **Deploy**
   - Railway will deploy automatically
   - Once deployed, click on the service → Settings → Generate Domain
   - You'll get a URL like: `https://minecraft-backend.up.railway.app`

---

## Part 2: Update Front-End with Backend URL

After your backend is deployed, update the front-end to use the backend URL:

1. **Get your backend URL** from Render or Railway
   - Example: `https://minecraft-backend.onrender.com`
   - Or: `https://minecraft-backend.up.railway.app`

2. **Update Multiplayer.js**
   - Open `front_end/src/Multiplayer.js`
   - Find line 19: `const PRODUCTION_BACKEND_URL = 'wss://YOUR_RENDER_URL_HERE';`
   - Replace with your backend URL, converting `https://` to `wss://`
   - Example: `const PRODUCTION_BACKEND_URL = 'wss://minecraft-backend.onrender.com';`
   - **Note**: Remove the `https://` part, just use the domain with `wss://`

3. **Commit and Push**
   ```bash
   git add front_end/src/Multiplayer.js
   git commit -m "Update backend URL for production"
   git push
   ```

---

## Part 3: Deploy Front-End to Netlify

1. **Push Code to GitHub** (if not already done)
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push
   ```

2. **Go to Netlify**
   - Visit https://app.netlify.com
   - Sign in with GitHub

3. **Create New Site**
   - Click "Add new site" → "Import an existing project"
   - Authorize Netlify to access your GitHub repositories
   - Select your repository

4. **Configure Build Settings**
   Netlify should auto-detect `netlify.toml`, but verify:
   - **Base directory**: `front_end`
   - **Build command**: (leave empty - no build needed)
   - **Publish directory**: `.` (or `front_end` if base directory is empty)

   If `netlify.toml` exists, Netlify will use those settings automatically.

5. **Deploy**
   - Click "Deploy site"
   - Wait 1-2 minutes for deployment
   - You'll get a URL like: `https://your-site-name.netlify.app`

6. **Test**
   - Open your Netlify URL
   - Open browser console (F12)
   - Click "Online" button
   - Check console for WebSocket connection messages
   - You should see: "Connected to multiplayer server"

---

## Part 4: Verify Everything Works

1. **Test Front-End**
   - Visit your Netlify URL
   - Singleplayer should work immediately
   - Check browser console for errors

2. **Test Multiplayer**
   - Click "Online" button
   - Check console for connection status
   - Open the same URL in another browser/incognito window
   - You should see both players in the game

3. **Check Backend Logs**
   - Render: Go to your service → Logs tab
   - Railway: Go to your service → Deployments → View Logs
   - You should see connection messages when players join

---

## Troubleshooting

### Front-End Issues

**Problem**: Site shows blank page
- **Solution**: 
  - Check browser console for errors
  - Verify `index.html` is in `front_end` folder
  - Check Netlify deploy logs for errors
  - Ensure all file paths are correct (case-sensitive)

**Problem**: WebSocket connection fails
- **Solution**:
  - Verify backend URL in `Multiplayer.js` uses `wss://` (not `ws://`)
  - Check that backend is deployed and running
  - For Render free tier: First connection may take 30 seconds (spin-up time)
  - Check browser console for specific error messages
  - Verify CORS settings (if applicable)

**Problem**: Files not loading (404 errors)
- **Solution**:
  - Check Netlify deploy logs
  - Verify `netlify.toml` has correct `publish` directory
  - Ensure all assets (textures, CSS) are in `front_end` folder

### Backend Issues

**Problem**: Backend won't start
- **Solution**:
  - Check Render/Railway logs for errors
  - Verify `package.json` has correct `start` script
  - Ensure `server.js` is in `back_end` folder
  - Check that all dependencies are in `package.json`

**Problem**: WebSocket connections timeout
- **Solution**:
  - Render free tier: Service may have spun down (wait 30 seconds)
  - Check backend logs for connection attempts
  - Verify PORT environment variable (Render sets this automatically)
  - For Railway: Check that port is correctly configured

**Problem**: World/player data not persisting
- **Solution**:
  - Render/Railway use ephemeral filesystem (data resets on redeploy)
  - Consider using a database (MongoDB Atlas, PostgreSQL) for persistence
  - Or use Render Disk for persistent storage (paid feature)

---

## Advanced: Using Environment Variables

Instead of hardcoding the backend URL, you can use Netlify environment variables:

1. **In Netlify Dashboard**:
   - Go to Site Settings → Environment Variables
   - Add: `REACT_APP_BACKEND_URL` = `wss://your-backend-url.com`

2. **Update Multiplayer.js**:
   ```javascript
   const PRODUCTION_BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'wss://your-backend-url.com';
   ```

   Note: For ES modules, you may need to use a different approach or build tool.

---

## Cost Summary

- **Netlify**: Free (100GB bandwidth/month, unlimited sites)
- **Render**: Free tier available (spins down after inactivity) or $7/month for always-on
- **Railway**: $5/month for hobby plan (includes $5 credit)

---

## Next Steps

- Set up a custom domain (optional)
- Add database for persistent world/player data
- Set up CI/CD for automatic deployments
- Monitor performance and errors
- Consider upgrading backend plan for better performance

---

## Quick Reference

**Backend URL Format**:
- Render: `wss://your-service-name.onrender.com`
- Railway: `wss://your-service-name.up.railway.app`

**Front-End URL Format**:
- Netlify: `https://your-site-name.netlify.app`

**Important Files**:
- `front_end/src/Multiplayer.js` - Backend URL configuration
- `front_end/netlify.toml` - Netlify deployment config
- `back_end/server.js` - Backend server
- `back_end/package.json` - Backend dependencies

