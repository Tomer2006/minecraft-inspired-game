# Railway Setup Guide - What to Configure

## 🎯 UI Configuration (Must Do in Railway Dashboard)

### 1. Add PostgreSQL Database
```
Railway Dashboard → Your Project → Add Plugin → PostgreSQL
```
- **Name**: `minecraft-db`
- Railway automatically creates `DATABASE_URL`

### 2. Enable Public Networking
```
Service Settings → Public Networking → Enable
```
- This gives you: `https://your-project-name-production.up.railway.app`
- **Copy this URL** - you'll need it for frontend

### 3. Verify Environment Variables
```
Service → Variables Tab
```
Should show:
- `DATABASE_URL` ✅ (Auto-set by Railway)
- `NODE_ENV=production` ✅ (Auto-set by Railway)
- `PORT` ✅ (Auto-set by Railway)

## 🔧 Code Configuration (Already Done)

### Files Already Configured:
- ✅ `railway.json` - Deployment settings
- ✅ `database.js` - Railway-optimized connection
- ✅ `server.js` - Railway-compatible server
- ✅ Health check endpoint `/health`

### Environment Variables (Set Automatically):
- `DATABASE_URL` → Railway internal PostgreSQL
- `NODE_ENV` → production
- `PORT` → 8080 (or Railway-assigned)

## 🚀 Deployment Process

### Automatic (Code-Handled):
1. ✅ Railway detects Node.js app
2. ✅ Installs dependencies (`npm install`)
3. ✅ Runs migration (`npm run migrate`)
4. ✅ Starts server (`npm start`)
5. ✅ Health checks every 5 minutes

### Manual Steps Required:
1. **Add PostgreSQL plugin** (UI)
2. **Enable public networking** (UI)
3. **Copy public URL** (UI)
4. **Update frontend** with public URL

## 📊 Expected Railway Logs

After setup, you should see:
```
Starting data migration to PostgreSQL...
DATABASE_URL: Set
NODE_ENV: production
✅ Database connected successfully
✅ Database schema initialized
🎮 Database initialization complete - Minecraft server ready!
```

## 🎮 Final Result

- **Backend**: `https://your-project-production.up.railway.app`
- **Health Check**: `https://your-project-production.up.railway.app/health`
- **WebSocket**: `wss://your-project-production.up.railway.app`
- **Database**: PostgreSQL with persistent storage

## 🆘 Troubleshooting

**If database connection fails:**
1. Check PostgreSQL plugin is added
2. Verify DATABASE_URL is set in Variables tab
3. Check Railway service logs for connection errors

**If deployment fails:**
1. Check build logs for errors
2. Verify package.json scripts are correct
3. Check railway.json configuration