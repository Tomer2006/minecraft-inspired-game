#!/bin/bash

# Railway Setup Script for Minecraft Clone
# This script helps configure Railway project programmatically

echo "🚀 Setting up Minecraft Clone on Railway..."
echo "Make sure you have Railway CLI installed: npm install -g @railway/cli"
echo ""

# Login to Railway (if not already logged in)
echo "📝 Logging into Railway..."
railway login

# Create new project
echo "📁 Creating Railway project..."
railway init minecraft-inspired-game

# Navigate to backend directory
cd back_end

# Add environment variables
echo "🔧 Configuring environment variables..."
railway variables set NODE_ENV production

# Add PostgreSQL database
echo "🐘 Adding PostgreSQL database..."
railway add postgres

# Deploy the backend
echo "🚀 Deploying backend..."
railway up

echo ""
echo "✅ Railway setup complete!"
echo ""
echo "📋 Manual steps you still need to do:"
echo "1. Go to Railway dashboard and enable public networking for your backend service"
echo "2. Copy the public URL and update front_end/src/Multiplayer.js"
echo "3. Deploy frontend to Netlify or Railway"
echo ""
echo "🎮 Your Minecraft multiplayer server will be ready once database initializes!"