# Hotate

Mobile-first web-based SSH client with full IME (Input Method Editor) support. Connect to your servers from any browser, including mobile devices, with proper Japanese/CJK input handling.

## Features

- **IME-aware input** -- Composition events are tracked so multibyte text is sent only after conversion is confirmed
- **xterm.js terminal** -- Full-featured terminal emulation in the browser
- **Special key toolbar** -- Tab, Ctrl+C, Ctrl+D, arrow keys, Esc, and more, accessible on touch screens
- **Host management** -- Save, edit, and delete SSH connection profiles (password or SSH key auth)
- **Touch scroll & select** -- Scroll and select text in the terminal on mobile
- **Copy & paste** -- Clipboard integration for both desktop and mobile
- **PWA support** -- Add to home screen for a native app-like experience
- **Basic auth gate** -- Protect the app with a username/password
- **No build step** -- Vanilla JS + CDN; edit and reload

## Screenshots

<!-- TODO: Add screenshots -->

## Quick Start

```bash
cp .env.example .env
# Edit .env to set HOTATE_USER / HOTATE_PASS

# Standalone (direct port)
docker compose -f docker-compose.standalone.yml up -d

# Or with Traefik reverse proxy
docker compose up -d
```

Open `http://localhost:3000` (standalone) or your configured domain.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `HOTATE_USER` | `admin` | Basic auth username |
| `HOTATE_PASS` | `changeme` | Basic auth password |
| `PORT` | `3000` | Server listen port |
| `APP_DOMAIN` | `hotate.example.com` | Domain for Traefik TLS (docker-compose.yml only) |
| `SSH_KEY_DIR` | `~/.ssh` | Host directory to mount as SSH keys |

## Development

```bash
npm install
cp .env.example .env
npm run dev   # starts with --watch for auto-reload
```

## License

[MIT](LICENSE)
