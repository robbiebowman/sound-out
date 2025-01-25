# Sound Out - Browser Tab Audio Manager

Sound Out automatically manages audio across browser tabs to prevent multiple tabs from playing sound simultaneously.

## Features

- Automatically mutes background tabs while keeping active tab unmuted
- Preserves manual mute settings for excluded tabs
- Two operating modes:
  - **Exclusion Mode (Default)**: Manages all tabs except specified domains
  - **Inclusion Mode**: Only manages specified domains

### Quick Toggle & Visual Feedback
- Click extension icon to toggle management for current tab
- Orange icon: tab is managed
- Grey icon: tab is unmanaged

## Usage Examples

### Scenario 1: Music While Browsing (spotify.com)
1. Enable Exclusion Mode
2. Add `spotify.com` to exclusion list
3. Play music and browse freely - Spotify won't be muted when switching tabs

### Scenario 2: Managing Video Sites (youtube.com, twitch.tv)
1. Enable Inclusion Mode
2. Add `youtube.com` and `twitch.tv` to inclusion list
3. Only these sites will be muted when inactive
4. Other sites remain unaffected

### Scenario 3: Temporary Exceptions
1. Click extension icon to toggle management
2. Perfect for temporarily keeping a video playing while browsing
3. Tab returns to normal management when closed

## Configuration
- Right-click extension icon → Options
- Switch modes and manage domain lists
- Domain rules include subdomains automatically 