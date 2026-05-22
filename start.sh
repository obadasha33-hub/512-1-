#!/bin/bash
# Start Our Sanctuary app
cd /home/z/my-project

# Kill any existing processes
fuser -k 3000/tcp 2>/dev/null
fuser -k 3003/tcp 2>/dev/null
sleep 1

# Start Next.js production server
nohup npx next start -p 3000 > /tmp/next.log 2>&1 &
echo "Starting Next.js on port 3000..."

# Start Socket.IO chat service
cd /home/z/my-project/mini-services/chat-service
nohup bun --hot index.ts > /tmp/chat.log 2>&1 &
echo "Starting Chat Service on port 3003..."

cd /home/z/my-project
sleep 3
echo "App is running!"
echo "Next.js: http://localhost:3000"
echo "Chat: http://localhost:3003"
