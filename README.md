# Sound Out - Browser Tab Audio Manager

Sound Out automatically manages audio across browser tabs to prevent multiple tabs from playing sound simultaneously. Works in both Firefox and Chrome browsers.

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

### Manual Control Options
Right-click the extension icon to access:
- **Keep muted**: Force a tab to stay muted when it's not being managed
- **Keep unmuted**: Force a tab to stay unmuted when it's not being managed
- **Options**: Access extension settings

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

### Scenario 4: Manual Audio Control
1. Right-click extension icon on an unmanaged tab
2. Select "Keep muted" or "Keep unmuted" to set a fixed state
3. Useful for tabs you want to control independently

## Configuration
- Right-click extension icon → Options
- Switch modes and manage domain lists
- Domain rules include subdomains automatically 

## Browser Support
- Firefox: Install from Firefox Add-ons
- Chrome: Install from Chrome Web Store 