# Kai Browser Connector ꩜

Connect your browser to Kai — let your AI assistant see and control web pages.

## How It Works

```
┌─────────────────┐                    ┌─────────────────┐
│  Your Chrome    │───── WSS ────────▶│  Relay Server   │
│  + Extension    │                    │  (Railway)      │
└─────────────────┘                    └─────────────────┘
                                              ▲
                                              │ HTTP API
                                              │
                                       ┌──────┴──────┐
                                       │    Kai      │
                                       │  (Mac mini) │
                                       └─────────────┘
```

1. You install the Chrome extension on your laptop
2. Extension connects to the relay server (Railway)
3. Kai sends commands through the server
4. Commands execute in YOUR browser = your IP, your session, your cookies

## Install

1. Go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select this `extension/` folder

## Configure

1. Options page opens automatically after install
2. Enter your token: `kai-ash-e9c3ef45fc434f37`
3. Click "Connect"

## Use

1. Open any webpage you want Kai to access
2. Click the ꩜ extension icon
3. Badge shows "ON" = Kai can now see and control that tab

## What Kai Can Do

Once connected, Kai can:
- Navigate to URLs
- Click buttons and links
- Type text into forms
- Take screenshots
- Read page content
- Run JavaScript

## Security

- All traffic encrypted (WSS/HTTPS)
- Token required for authentication
- YOU control which tabs are attached
- No passwords or credentials stored
- Uses your existing logged-in sessions

## Tokens

Your personal token: `kai-ash-e9c3ef45fc434f37`

Server: `https://sunlight-relay-hub-production.up.railway.app`
