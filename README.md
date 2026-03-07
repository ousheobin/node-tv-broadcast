# TV Broadcast

A desktop application for broadcasting m3u8 live streams to TV via DLNA, supporting both command-line and graphical interfaces.

## Features

- **DLNA Casting**: Automatically discover DLNA devices on your local network and cast with one click
- **Multi-Source Management**: Configure multiple m3u8 sources and switch between them anytime
- **Channel Speed Test**: Pre-testing feature that automatically detects channel connection quality and sorts by speed
- **Local Preview**: Preview channels locally before casting
- **Cross-Platform**: Supports macOS, Windows, and Linux

## Installation

```bash
git clone https://github.com/ousheobin/node-tv-broadcast.git
cd node-tv-broadcast
yarn install
```

## Usage

### Graphical Interface (Electron)

```bash
yarn start
# or
npm run electron
```

Interface features:
- Device dropdown (top-right): Select DLNA casting device
- Refresh Device button: Re-scan for DLNA devices
- Refresh Channels button: Reload channel list from current source
- Cast button: Start casting to selected device
- Channel Gallery: Display all channels with search and speed-based sorting
- Source Management: Click "Manage Sources" to add, remove, or switch m3u8 sources

### Command Line (CLI)

```bash
node index.js
# or after global installation
npm install -g
tv-broadcast
```

Menu options:
- Select Channel: Choose a live channel to play
- Cast: Select a DLNA device and start casting
- Manage m3u8 Sources: Add, remove, or switch sources

## Configuration

Config file location: `~/.tvbBoardcast/settings.json`

An empty configuration is created automatically on first run. You need to manually add m3u8 sources.

Configuration format:
```json
{
  "sources": [
    {
      "id": "xxx",
      "name": "Source Name",
      "url": "https://example.com/playlist.m3u",
      "enabled": true
    }
  ],
  "currentSourceId": "xxx"
}
```

## Development

```bash
# Install dependencies
yarn install

# Development mode (hot reload)
yarn dev

# Build application
yarn build

# Package for distribution
yarn dist
```

## Tech Stack

- Node.js
- Electron
- DLNA/UPnP
- m3u8-parser
- Tailwind CSS

## Acknowledgements

Thanks to [fanmingming/live](https://github.com/fanmingming/live) for providing live stream source references.

## License

MIT
