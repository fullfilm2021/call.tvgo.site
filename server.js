const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const PORT = process.env.PORT || 3005;

// Security Middleware: Explicitly block server-level files and markdown docs
app.use((req, res, next) => {
    const p = req.path.toLowerCase();
    if (
        p.includes('.env') || 
        p.startsWith('/.') || 
        p === '/server.js' || 
        p === '/ecosystem.config.js' || 
        p === '/package.json' || 
        p === '/package-lock.json' || 
        p.endsWith('.md') ||
        p.includes('node_modules')
    ) {
        return res.status(403).send('Forbidden');
    }
    next();
});

// Serve static assets from public folder
app.use(express.static(path.join(__dirname, 'public')));

// Any direct room link (e.g., /room/room-123) serves index.html
app.get('/room/:roomId', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'WebRTC P2P Voice & Video Call Server',
        timestamp: new Date().toISOString()
    });
});

// Track active rooms and participants: roomId -> Set of socket IDs
const rooms = new Map();

io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);
    let currentRoom = null;

    socket.on('join-room', ({ roomId, userId }) => {
        currentRoom = roomId;
        socket.join(roomId);

        if (!rooms.has(roomId)) {
            rooms.set(roomId, new Set());
        }
        const roomPeers = rooms.get(roomId);

        // Send existing room members to newly joined peer
        const existingPeers = Array.from(roomPeers);
        socket.emit('existing-peers', { peers: existingPeers });

        roomPeers.add(socket.id);
        console.log(`[P2P] ${socket.id} (${userId || 'User'}) joined room "${roomId}". Total participants: ${roomPeers.size}`);

        // Broadcast to other peers in the room
        socket.to(roomId).emit('peer-joined', {
            socketId: socket.id,
            userId: userId || 'User-' + socket.id.slice(-4)
        });
    });

    socket.on('offer', (payload) => {
        io.to(payload.target).emit('offer', {
            sdp: payload.sdp,
            sender: socket.id
        });
    });

    socket.on('answer', (payload) => {
        io.to(payload.target).emit('answer', {
            sdp: payload.sdp,
            sender: socket.id
        });
    });

    socket.on('ice-candidate', (payload) => {
        io.to(payload.target).emit('ice-candidate', {
            candidate: payload.candidate,
            sender: socket.id
        });
    });

    socket.on('disconnect', () => {
        console.log(`[Socket] Disconnected: ${socket.id}`);
        if (currentRoom && rooms.has(currentRoom)) {
            const roomPeers = rooms.get(currentRoom);
            roomPeers.delete(socket.id);
            if (roomPeers.size === 0) {
                rooms.delete(currentRoom);
            } else {
                socket.to(currentRoom).emit('peer-left', { socketId: socket.id });
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`WebRTC Voice & Video Call Server`);
    console.log(`Running on http://localhost:${PORT}`);
    console.log(`===============================================`);
});
