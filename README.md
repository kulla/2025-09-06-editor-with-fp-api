# Editor prototype

A collaborative rich text editor built with React, Rsbuild, and Yjs CRDT.

## Features

- ✨ Rich text editing with paragraphs and multiple choice exercises
- 🤝 Real-time collaborative editing (via Yjs WebSocket)
- 🎨 Modern UI with Tailwind CSS and DaisyUI
- 🔍 Debug panel for inspecting editor state
- ⚡ Fast build with Rsbuild

## Setup

1. Clone the repository
2. Install the dependencies via `bun install` or `npm install`

## Get started

### Development Mode

Start the dev server:

```bash
bun dev
# or
npm run dev
```

### Collaborative Editing

To enable real-time collaboration between multiple users, start the WebSocket server:

```bash
./start_server.sh
# or manually:
PORT=1234 npx y-websocket-server
```

Then open multiple browser windows at `http://localhost:3000/2025-09-06-editor-with-fp-api/` to see collaborative editing in action!

### Production

Build the app for production:

```bash
bun run build
# or
npm run build
```

Preview the production build locally:

```bash
bun preview
# or
npm run preview
```

## Maintenance

Update dependencies:

```bash
bun update
# or
npm update
```

## Architecture

See [MIGRATION.md](MIGRATION.md) for details about the migration from the old `hackathoern-collab-oer-editor` repository and architectural decisions.
