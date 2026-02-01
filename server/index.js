import http from 'http';
import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import { LeveldbPersistence } from 'y-leveldb';
import { setupWSConnection, setPersistence } from 'y-websocket/bin/utils';

// ─── Config ───
const PORT = parseInt(process.env.PORT || '4000');
const HOST = process.env.HOST || '0.0.0.0';
const DB_DIR = process.env.DB_DIR || './data/yjs-docs';
const MAX_ROOMS = parseInt(process.env.MAX_ROOMS || '200');

// ─── LevelDB persistence ───
const ldb = new LeveldbPersistence(DB_DIR);

setPersistence({
  bindState: async (docName, ydoc) => {
    const persistedYdoc = await ldb.getYDoc(docName);
    const newUpdates = Y.encodeStateAsUpdate(ydoc);
    ldb.storeUpdate(docName, newUpdates);
    Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(persistedYdoc));
    ydoc.on('update', (update) => {
      ldb.storeUpdate(docName, update);
    });
  },
  writeState: async (_docName, _ydoc) => {
    // Already persisted via update handler above
  },
});

// ─── Track active rooms ───
const activeRooms = new Map(); // roomName -> { connections: number, createdAt }

// ─── HTTP server ───
const server = http.createServer((req, res) => {
  // CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', rooms: activeRooms.size }));
    return;
  }

  if (req.url === '/stats') {
    const rooms = [];
    for (const [name, info] of activeRooms) {
      rooms.push({ name, connections: info.connections, createdAt: info.createdAt });
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      totalRooms: activeRooms.size,
      maxRooms: MAX_ROOMS,
      rooms,
    }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

// ─── WebSocket server ───
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  // Room name comes from the URL path: /roomName
  const url = new URL(req.url, `http://${req.headers.host}`);
  const roomName = decodeURIComponent(url.pathname.slice(1)) || 'default';

  // Enforce room limit
  if (!activeRooms.has(roomName) && activeRooms.size >= MAX_ROOMS) {
    ws.close(4001, 'Server room limit reached');
    console.log(`[REJECTED] Room "${roomName}" — limit of ${MAX_ROOMS} reached`);
    return;
  }

  // Track room
  if (!activeRooms.has(roomName)) {
    activeRooms.set(roomName, { connections: 0, createdAt: new Date().toISOString() });
    console.log(`[ROOM] Created "${roomName}" (${activeRooms.size}/${MAX_ROOMS})`);
  }
  const room = activeRooms.get(roomName);
  room.connections++;
  console.log(`[JOIN] "${roomName}" — ${room.connections} connections`);

  ws.on('close', () => {
    room.connections--;
    console.log(`[LEAVE] "${roomName}" — ${room.connections} connections`);
    if (room.connections <= 0) {
      // Keep room in activeRooms for a bit so reconnects are fast,
      // but data is persisted in LevelDB regardless
      setTimeout(() => {
        const current = activeRooms.get(roomName);
        if (current && current.connections <= 0) {
          activeRooms.delete(roomName);
          console.log(`[ROOM] Cleaned up "${roomName}" (${activeRooms.size}/${MAX_ROOMS})`);
        }
      }, 30_000); // 30s grace period
    }
  });

  setupWSConnection(ws, req, { docName: roomName });
});

// ─── Start ───
server.listen(PORT, HOST, () => {
  console.log(`
  ┌──────────────────────────────────────┐
  │  OrgMath Collaboration Server        │
  │                                      │
  │  WebSocket: ws://${HOST}:${PORT}/{room}  │
  │  Health:    http://${HOST}:${PORT}/health │
  │  Stats:     http://${HOST}:${PORT}/stats  │
  │  Max rooms: ${MAX_ROOMS}                      │
  │  Data dir:  ${DB_DIR}            │
  └──────────────────────────────────────┘
  `);
});
