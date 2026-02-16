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

## Troubleshooting

### Badge shows "OFF" or won't connect
1. Click the extension icon → Options → check your token is saved
2. Make sure you're on an actual webpage (not `chrome://` or `about:`)
3. Check the relay server is up: `curl https://sunlight-relay-hub-production.up.railway.app/health`

### "Token rejected" error
Your token isn't registered on the server. Ask Ash to add it to Railway VALID_TOKENS.

### Commands not working
1. Check badge is "ON" on the target tab
2. Only ONE tab can be attached at a time
3. Try clicking the icon to disconnect, then reconnect

### View extension logs
1. Go to `chrome://extensions/`
2. Find "Kai Browser Connector"
3. Click "service worker" link
4. Check Console tab for errors

## Tokens

Your personal token: `kai-ash-e9c3ef45fc434f37`

Server: `https://sunlight-relay-hub-production.up.railway.app`

## See Also

- **Browser Relay Skill:** `~/clawd/skills/browser-relay/SKILL.md` — Full API documentation
- **Sunlight Connector:** Same core, ☀️ branding — for Sunlight AI Chief of Staff clients
