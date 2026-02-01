# OrgMath

Collaborative math editor with Org-mode style editing, inline LaTeX rendering, and real-time collaboration.

![OrgMath](https://img.shields.io/badge/status-prototype-orange)

## Features

- **Org-mode editing** — `*`/`**`/`***` headings, folding, TODO/DONE cycling, promote/demote
- **Inline LaTeX math** — `$...$`, `$$...$$`, `\begin{align}`, `\begin{equation}`, and more
- **Live preview** — equations render inline, click to edit source (Obsidian-style)
- **Org tables** — `|` syntax with Tab navigation and auto-alignment
- **Real-time collaboration** — see other users' cursors, shared editing via WebSocket
- **Persistent documents** — rooms survive browser refreshes, stored server-side in LevelDB
- **Export** — download any room as `.org` file

## Quick Start (Local)

### 1. Start the server

```bash
cd server
npm install
npm run dev
```

Server runs at `ws://localhost:4000`. Check health at `http://localhost:4000/health`.

### 2. Open the frontend

Just open `public/index.html` in a browser. It connects to `ws://localhost:4000` by default.

Or serve it:

```bash
npx serve public
```

### 3. Collaborate

Open the same room name in multiple tabs or browsers. Documents sync in real-time and persist on the server.

## Deploy

### Docker

```bash
docker compose up -d
```

The server runs on port 4000. Mount the `orgmath-data` volume for persistence.

### Railway

1. Push this repo to GitHub
2. Connect to [Railway](https://railway.app)
3. Railway auto-detects the `Dockerfile`
4. Add a volume mounted at `/app/data` for persistence
5. Your server URL will be something like `wss://orgmath-server-production-xxxx.up.railway.app`

### Render

1. Push to GitHub
2. Create a new Web Service on [Render](https://render.com)
3. It reads `render.yaml` automatically
4. Add a 1GB disk at `/app/data`

### Fly.io

```bash
fly launch
fly volumes create orgmath_data --size 1
# Add [mounts] to fly.toml:
#   source = "orgmath_data"
#   destination = "/app/data"
fly deploy
```

### Any VPS

```bash
git clone <this-repo>
cd orgmath
docker compose up -d
```

Then point a reverse proxy (nginx/caddy) at port 4000 with WebSocket upgrade support.

**Caddy example** (automatic HTTPS):

```
orgmath.yourdomain.com {
    reverse_proxy localhost:4000
}
```

**Nginx example:**

```nginx
server {
    server_name orgmath.yourdomain.com;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

### Frontend hosting

The `public/index.html` file is fully static — host it anywhere:

- **GitHub Pages** — push `public/` as the root, enable Pages
- **Netlify/Vercel** — point at the `public/` directory
- **Same server** — serve with nginx/caddy alongside the WebSocket server

When deploying the frontend, update the default server URL either:
- Via the "Server settings" section in the join modal
- Via URL parameter: `https://your-frontend.com?server=wss://your-server.com`
- Or edit the `DEFAULT_SERVER` constant in `index.html`

## Architecture

```
Browser (static HTML)          Server (Node.js)
┌────────────────────┐        ┌──────────────────────┐
│  CodeMirror 6      │ ◄──►  │  y-websocket          │
│  KaTeX rendering   │  WS   │  LevelDB persistence  │
│  Yjs (CRDT)        │        │  Room management      │
│  Org-mode plugins  │        │  Health/stats API     │
└────────────────────┘        └──────────────────────┘
```

- **Yjs** — CRDT for conflict-free collaborative editing
- **y-websocket** — syncs Yjs documents over WebSocket
- **LevelDB** — stores document state on disk
- **CodeMirror 6** — editor with custom plugins for Org syntax + math
- **KaTeX** — fast LaTeX rendering

## Configuration

Server environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | HTTP/WebSocket port |
| `HOST` | `0.0.0.0` | Bind address |
| `DB_DIR` | `./data/yjs-docs` | LevelDB storage path |
| `MAX_ROOMS` | `200` | Maximum concurrent rooms |

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | `{"status":"ok","rooms":N}` |
| `GET /stats` | Room list with connection counts |
| `WS /{roomName}` | Yjs WebSocket sync for a room |

## License

MIT
