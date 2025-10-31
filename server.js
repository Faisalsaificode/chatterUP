import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import cors from 'cors';

import Message from './models/Message.js';
import User from './models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- MongoDB connect ---
const { MONGODB_URI, PORT = 3000 } = process.env;

mongoose
  .connect(MONGODB_URI, { dbName: 'chatterup' })
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

// --- Simple API (optional) ---
app.get('/api/messages', async (req, res) => {
  try {
    const msgs = await Message.find().sort({ createdAt: -1 }).limit(50).lean();
    res.json(msgs.reverse());
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Online users (in-memory runtime map) ---
/** Map<socketId, { name, avatar, joinedAt }> */
const online = new Map();

// --- Socket.IO events ---
io.on('connection', (socket) => {
  // Client will immediately emit 'user:join' with { name, avatar }
  socket.on('user:join', async ({ name, avatar }) => {
    // Keep runtime presence
    online.set(socket.id, { name, avatar, joinedAt: Date.now() });

    // Upsert user in DB for consistency / lastSeen
    await User.findOneAndUpdate(
      { name },
      { name, avatar, lastSeen: new Date(), online: true },
      { upsert: true, new: true }
    );

    // Send chat history to the new user (last 50)
    const history = await Message.find().sort({ createdAt: -1 }).limit(50).lean();
    socket.emit('chat:history', history.reverse());

    // Notify all about the new user and refresh user list
    io.emit('user:list', Array.from(online.values()));
    socket.broadcast.emit('user:joined', {
      name,
      avatar,
      count: online.size
    });
  });

  // Incoming message
  socket.on('chat:message', async ({ text }) => {
    const user = online.get(socket.id);
    if (!user || !text?.trim()) return;

    const payload = {
      name: user.name,
      avatar: user.avatar,
      text: text.trim(),
      createdAt: new Date()
    };

    // Persist to DB
    await Message.create(payload);

    // Broadcast to all
    io.emit('chat:message', payload);
  });

  // Typing indicator
  socket.on('user:typing', ({ isTyping }) => {
    const user = online.get(socket.id);
    if (!user) return;
    socket.broadcast.emit('user:typing', {
      name: user.name,
      isTyping: !!isTyping
    });
  });

  socket.on('disconnect', async () => {
    const user = online.get(socket.id);
    if (user) {
      online.delete(socket.id);
      io.emit('user:list', Array.from(online.values()));
      socket.broadcast.emit('user:left', {
        name: user.name,
        count: online.size
      });

      // Update DB lastSeen/online
      await User.findOneAndUpdate(
        { name: user.name },
        { lastSeen: new Date(), online: false }
      );
    }
  });
});

server.listen(PORT, () => {
  console.log(`ChatterUp running at http://localhost:${PORT}`);
});
