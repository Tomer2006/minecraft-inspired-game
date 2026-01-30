# Netlify Deployment Guide

## Prerequisites
- Your code must be pushed to a GitHub repository
- Your backend should be deployed to Render.com first (to get the WebSocket URL)

## Step-by-Step Deployment

### 1. Prepare Your Code
Make sure all files are committed and pushed to GitHub:
```bash
git add .
git commit -m "Ready for Netlify deployment"
git push
```

### 2. Deploy to Netlify

1. **Go to Netlify**: https://app.netlify.com/
2. **Sign in** with your GitHub account
3. **Click "Add new site"** → **"Import an existing project"**
4. **Authorize Netlify** to access your GitHub repositories
5. **Select your repository** from the list

### 3. Configure Build Settings

In the deployment settings:
- **Base directory**: `front_end`
- **Build command**: (leave empty - no build needed)
- **Publish directory**: `front_end` (or `.` if base directory is already `front_end`)

**OR** if Netlify detects `netlify.toml`, it will use those settings automatically.

### 4. Deploy

- Click **"Deploy site"**
- Wait for deployment to complete (usually 1-2 minutes)
- You'll get a URL like: `https://your-site-name.netlify.app`

### 5. Update Backend URL

**IMPORTANT**: After deploying your backend to Render.com:

1. Get your Render backend URL (e.g., `https://minecraft-backend.onrender.com`)
2. Open `front_end/src/Multiplayer.js`
3. Find line 19: `const PRODUCTION_BACKEND_URL = 'wss://YOUR_RENDER_URL_HERE';`
4. Replace `YOUR_RENDER_URL_HERE` with your Render URL, changing `https://` to `wss://`
   - Example: `const PRODUCTION_BACKEND_URL = 'wss://minecraft-backend.onrender.com';`
5. Commit and push:
   ```bash
   git add front_end/src/Multiplayer.js
   git commit -m "Update backend URL for production"
   git push
   ```
6. Netlify will automatically redeploy with the new settings

## Troubleshooting

### Site shows blank page
- Check browser console for errors
- Verify all file paths are correct (case-sensitive)
- Make sure `index.html` is in the root of `front_end` folder

### WebSocket connection fails
- Verify backend is deployed and running on Render
- Check that you updated `PRODUCTION_BACKEND_URL` in `Multiplayer.js`
- Ensure Render URL uses `wss://` (secure WebSocket) not `ws://`
- Check Render logs to see if backend is receiving connections

### Files not loading
- Check Netlify deploy logs for errors
- Verify `netlify.toml` has correct `publish` directory
- Make sure all assets (textures, CSS) are in the `front_end` folder

## Custom Domain (Optional)

1. Go to your site settings in Netlify
2. Click "Domain settings"
3. Click "Add custom domain"
4. Follow the instructions to configure your domain

