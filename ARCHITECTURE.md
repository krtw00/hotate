# Architecture

Hotate is a small browser-based SSH client. The codebase is intentionally narrow and should stay easy to reason about.

## Runtime Shape

```
Browser (xterm.js)
  <-> HTTP / WebSocket
Node.js (Express + ws)
  <-> SSH2
Remote SSH server
```

## Main Components

- `server/index.js`
  Starts Express, serves static assets, applies Basic auth, and upgrades WebSocket connections.
- `server/auth.js`
  Handles Basic auth for HTTP and WebSocket upgrade requests.
- `server/config.js`
  Persists host profiles in `data/hosts.json` and validates create/update payloads.
- `server/ssh-session.js`
  Bridges WebSocket traffic to SSH, handles PTY resize, and runs a restricted tmux helper flow.
- `public/js/app.js`
  Owns host CRUD UI, connection lifecycle, reconnect behavior, and tmux tab state.
- `public/js/terminal.js`
  Wraps xterm.js and terminal-specific input, selection, clipboard, and scroll behavior.
- `public/js/input.js`
  Handles IME-aware text input and special key sending.

## Data and State

- Host profiles are stored in `data/hosts.json`.
- Password-auth hosts may persist passwords in that file. This is convenient but security-sensitive.
- SSH private keys are read from the server-side filesystem through the mounted `SSH_KEY_DIR`.

## Important Boundaries

- No build step. Frontend code is plain static JS/CSS/HTML.
- The tmux helper API is typed and server-built. Clients must not send arbitrary shell commands.
- PWA install/offline behavior is currently disabled. `public/sw.js` only exists to clean up old registrations.
- Production is containerized and fronted by a reverse proxy. The app itself listens on port `3000`.

## What To Keep Updated

- If the runtime topology changes, update this file.
- If only copy or UI details change, prefer updating `README.md` or the code comments instead.
