# Deployment Checklist

Use this checklist to ensure you complete all deployment steps correctly.

## Pre-Deployment

- [ ] Code is committed and pushed to GitHub
- [ ] Backend dependencies are listed in `back_end/package.json`
- [ ] Front-end files are in `front_end` folder
- [ ] `netlify.toml` exists in `front_end` folder

## Step 1: Deploy Backend

### Render.com
- [ ] Created Render account
- [ ] Created new Web Service
- [ ] Set Root Directory to `back_end`
- [ ] Set Build Command to `npm install`
- [ ] Set Start Command to `npm start`
- [ ] Deployed successfully
- [ ] Copied backend URL (e.g., `https://minecraft-backend.onrender.com`)

### OR Railway.app
- [ ] Created Railway account
- [ ] Created new project from GitHub
- [ ] Set Root Directory to `back_end`
- [ ] Generated domain
- [ ] Copied backend URL (e.g., `https://minecraft-backend.up.railway.app`)

## Step 2: Update Front-End

- [ ] Opened `front_end/src/Multiplayer.js`
- [ ] Updated line 19 with backend URL
- [ ] Changed `https://` to `wss://` in URL
- [ ] Committed and pushed changes

## Step 3: Deploy Front-End

- [ ] Created Netlify account
- [ ] Connected GitHub repository
- [ ] Set Base Directory to `front_end`
- [ ] Verified Build Command is empty
- [ ] Verified Publish Directory is `.`
- [ ] Deployed successfully
- [ ] Copied front-end URL (e.g., `https://your-site.netlify.app`)

## Step 4: Testing

- [ ] Front-end loads correctly
- [ ] Singleplayer mode works
- [ ] Browser console shows no errors
- [ ] Clicked "Online" button
- [ ] WebSocket connects successfully (check console)
- [ ] Opened game in second browser/incognito
- [ ] Both players visible in game
- [ ] Block placement syncs between players
- [ ] Backend logs show connection messages

## Troubleshooting Checklist

If something doesn't work:

- [ ] Checked browser console for errors
- [ ] Checked Netlify deploy logs
- [ ] Checked Render/Railway backend logs
- [ ] Verified backend URL uses `wss://` (not `ws://`)
- [ ] Verified backend is running (not spun down)
- [ ] Tested backend URL directly (should show connection)
- [ ] Verified all file paths are correct
- [ ] Cleared browser cache and retested

## Post-Deployment

- [ ] Bookmarked both URLs
- [ ] Shared URLs with friends for testing
- [ ] Considered upgrading backend plan (if needed)
- [ ] Set up monitoring/alerts (optional)

---

## Quick Links

- **Netlify Dashboard**: https://app.netlify.com
- **Render Dashboard**: https://dashboard.render.com
- **Railway Dashboard**: https://railway.app/dashboard

## Your Deployment URLs

Fill these in after deployment:

- **Front-End (Netlify)**: `https://____________________.netlify.app`
- **Back-End (Render/Railway)**: `wss://____________________`

