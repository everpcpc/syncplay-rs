# Syncplay Tauri

A modern, cross-platform Syncplay client built with Tauri (Rust backend + React frontend).

## Overview

Syncplay Tauri is a complete rewrite of the Syncplay client using modern technologies. It provides synchronized video playback across multiple users, allowing you to watch videos together in real-time.

### Features

- **Cross-platform**: Works on Windows, macOS, and Linux
- **Modern UI**: Clean, responsive interface built with React and Tailwind CSS
- **MPV Integration**: Full support for MPV player via JSON IPC
- **Real-time Sync**: Smart synchronization algorithm with configurable thresholds
- **Chat System**: Built-in chat with command support
- **Playlist Management**: Shared playlist with navigation controls
- **Configuration**: Persistent settings with JSON-based storage
- **Notifications**: Real-time error and status notifications

## Quick Start

### Prerequisites

- **Rust**: 1.70 or later
- **Node.js**: 18 or later
- **MPV**: Latest version with JSON IPC support

### Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev
```

### Building

```bash
npm run tauri build
```

## Usage

### Connecting to a Server

1. Click "Connect" in the header
2. Enter server details (default: syncplay.pl:8999)
3. Provide username and room name
4. Click "Connect"

### Chat Commands

- `/room <name>` - Change room
- `/list` - List users
- `/help` - Show commands
- `/ready` - Mark as ready
- `/unready` - Mark as not ready

## Configuration

Settings are stored in JSON format at platform-specific locations:
- **Linux**: `~/.config/syncplay-tauri/config.json`
- **macOS**: `~/Library/Application Support/com.syncplay.syncplay-tauri/config.json`
- **Windows**: `%APPDATA%\syncplay\syncplay-tauri\config\config.json`

## Architecture

```
React Frontend (TypeScript)
    ↓ Tauri IPC
Rust Backend (Tokio)
    ↓ JSON IPC
MPV Player
```

## Development Status

**90% Complete** - All core features implemented and tested.

- ✅ Phase 1: Project Setup
- ✅ Phase 2: Network Layer
- ✅ Phase 3: MPV Integration
- ✅ Phase 4: Core Client Logic
- ✅ Phase 5: Playlist Management
- ✅ Phase 6: Chat System
- ✅ Phase 7: Tauri Commands
- ✅ Phase 8: React Frontend
- ✅ Phase 9: Configuration
- 🔄 Phase 10: Polish & Testing

### Statistics

- **Lines of Code**: ~4,500+
- **Test Coverage**: 31 unit tests (100% passing)
- **Modules**: 21 implemented

## License

Apache-2.0

## Acknowledgments

- Original Syncplay: https://syncplay.pl/
- Tauri: https://tauri.app/
- MPV: https://mpv.io/
