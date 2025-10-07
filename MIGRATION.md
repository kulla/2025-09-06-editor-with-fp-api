# Migration from hackathoern-collab-oer-editor

This document explains the migration from the old `hackathoern-collab-oer-editor` repository to this new architecture.

## Architecture Changes

The new repository uses a fundamentally different and more modern architecture:

### Old Architecture
- Custom state management system
- Explicit command pattern for all editing operations
- Manual keyboard event handling
- Type system based on string literals

### New Architecture
- **Yjs CRDT** for state management and collaborative editing
- **Native contentEditable** with browser's built-in editing
- **Functional programming patterns** with type-safe composition
- **Transaction-based updates** for atomic operations

## Features Migrated

✅ **UI Controls**
- "Add Multiple Choice" button
- "Add Paragraph" button
- Icon support with feather-icons

✅ **Content Types**
- Paragraph nodes
- Text nodes
- Multiple Choice Exercise nodes
- Document structure

✅ **Styling**
- Tailwind CSS with DaisyUI
- Typography support
- Multiple choice exercise styling
- Editor border and layout

✅ **Debug Panel**
- HTML representation
- JSON representation
- Internal store inspection
- Cursor tracking

## Features NOT Migrated (Intentionally)

### Command System
**Why not migrated:** The old repository used an explicit command pattern for text editing operations (insertText, deleteBackward, deleteForward, etc.). The new architecture leverages:
- Native browser contentEditable behavior
- Yjs text editing which is more robust
- Automatic CRDT conflict resolution
- Better performance and maintainability

**Result:** Text editing "just works" without custom command handlers.

### State Manager Pattern
**Why not migrated:** The old custom state management (`StateManager`, `WritableState`) has been replaced with:
- Yjs Documents for state storage
- Transaction-based updates
- Built-in collaborative editing support
- WebSocket synchronization via y-websocket

### Manual Selection/Cursor Management
**Why not migrated:** The old repository manually tracked and set selection/cursor. The new architecture:
- Uses browser's native selection API
- Syncs with Yjs cursors
- Handles selection automatically through contentEditable

## Benefits of New Architecture

1. **Collaborative Editing**: Built-in support via Yjs CRDT
2. **Type Safety**: Stronger TypeScript types with functional composition
3. **Maintainability**: Less custom code, leveraging proven libraries
4. **Performance**: Yjs handles conflicts and updates efficiently
5. **Scalability**: CRDT architecture scales to multiple users

## Summary

All user-facing features from the old repository have been successfully migrated. The internal architecture has been modernized to use industry-standard tools (Yjs) and patterns (functional programming, CRDTs) which provide better performance, maintainability, and built-in collaborative editing support.

The old repository can now be safely archived.
