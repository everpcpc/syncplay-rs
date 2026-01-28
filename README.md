# Syncplay Tauri

<div>
  <img src="icon.svg" alt="Syncplay Tauri Icon" width="128" height="128">
</div>

A modern, cross-platform Syncplay client built with Tauri (Rust backend + React frontend).

## Overview

Syncplay Tauri is a modern, cross-platform Syncplay client built with Tauri (Rust backend + React frontend). It provides synchronized video playback across multiple users in real time.

### Features

- **Cross-platform**: Windows, macOS, and Linux
- **Modern UI**: React + Tailwind CSS
- **MPV Integration**: JSON IPC support
- **Real-time Sync**: Threshold-based sync + slowdown
- **Chat + Playlist**: Built-in chat and shared playlist

## Quick Start

### Prerequisites

- **Rust**: 1.70 or later
- **Node.js**: 24 or later
- **MPV**: Latest version with JSON IPC support

### Development

```bash
# Install dependencies
make install

# Run in development mode
make run
```

### Building

```bash
# Build for production
make build

# Run tests
make test
```

## Protocol Compatibility

This client is compatible with Syncplay protocol version 1.7.x and can connect to official Syncplay servers.

## License

Apache-2.0

## Acknowledgments

- Original Syncplay project: https://syncplay.pl/
- Tauri framework: https://tauri.app/
- MPV player: https://mpv.io/
