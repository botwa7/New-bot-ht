# EDWA-MD v2 - WhatsApp Bot

## Overview
A WhatsApp bot by Boss Edwa built with Node.js and the Baileys library. Features a web interface for session generation via pairing code.

## Architecture
- **Runtime:** Node.js (>=16)
- **Main entry:** `index.js` — Express web server + WhatsApp bot logic
- **Port:** 5000 (0.0.0.0)
- **Package manager:** npm

## Key Files
- `index.js` — Main entry point: Express server on port 5000 + Baileys WhatsApp connection
- `config.js` — Bot configuration (name, owner, prefix, feature toggles)
- `index.html` — Session generator web UI (served at `/`)
- `server.js` — Alternative server with Socket.io for QR code display
- `Commands/` — Command handlers loaded dynamically by filename
- `auth/` — Generated at runtime; stores WhatsApp session credentials

## Features
- Session generation via WhatsApp Pairing Code (`/api/pair` endpoint)
- `SESSION_ID` environment variable support for hosted deployments
- Auto-features: status react, anti-view-once, anti-delete, auto-recording
- 21+ commands including group management, moderation, and utility commands

## Running
```bash
npm install
node index.js
```

## Environment Variables
- `SESSION_ID` — Optional base64-encoded WhatsApp session for pre-authenticated deployments (format: `EDWA-MD;;;base64data`)
- `PORT` — Server port (defaults to 5000)

## Deployment
Configured as `vm` target (always-running, needed for persistent WhatsApp connection).
Run command: `node index.js`
