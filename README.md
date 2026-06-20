# ScribeAI — AI Writing Assistant for macOS

> Improve your writing anywhere on your Mac — Notion, Slack, Notes, Gmail, Word — in one keystroke.

ScribeAI is a lightweight macOS desktop app that pops up whenever you select text and press **⌘ + Option + S**. It rewrites, refines, expands, or shortens your text using AI, then replaces your selection seamlessly.

---

## Features

- ✍️ **5 tone modes** — Professional, Casual, Improve, Concise, Expand
- 🎯 **Custom prompt** — add any extra instruction before rewriting
- ⚡ **Global shortcut** — works in every native macOS app (no browser tab needed)
- 🔒 **Privacy-first** — your text is sent only to the AI provider you choose
- 🔄 **Auto-updater** — silent background updates via GitHub Releases
- 🌐 **Multiple AI providers** — built-in (free), or bring your own Gemini API key

---

## Installation

1. Download the latest `.dmg` from [Releases](https://github.com/Anirudh3434/scribeai/releases)
2. Open the DMG and drag **ScribeAI** to your Applications folder
3. Launch ScribeAI — the onboarding wizard will automatically register the global shortcut
4. Grant **Accessibility** permission when prompted (required for text replacement)

---

## How to Use

1. Select any text in any app (Notion, Slack, Notes, Gmail…)
2. Press **⌘ + Option + S** (or right-click → Services → ScribeAI)
3. Choose a tone, optionally add a custom instruction
4. Click **Improve Writing**
5. Click **Insert Text** — your selection is replaced instantly

---

## AI Providers

| Provider | Cost | Setup |
|----------|------|-------|
| **Built-in** (default) | Free | None — works out of the box |
| **Your own Gemini key** | Pay-as-you-go | Paste your key in Settings |
| **Offline (WebGPU)** | Free | Download ~390MB model once |

---

## Development

```bash
# Install dependencies
cd desktop
npm install

# Run in development
npm start

# Build macOS DMG
npm run dist
```

### Environment Variables

Create `desktop/.env` for local development:
```
GH_TOKEN=your_github_token_for_auto_updater
```

> ⚠️ Never commit `.env` — it is gitignored.

### Deploy the API Proxy (Supabase Edge Function)

```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Link your project
supabase link --project-ref pqcqtpvmgziejnauidsu

# Set the Gemini API key as a secret (never in source code)
supabase secrets set GEMINI_API_KEY=your_gemini_key_here

# Deploy the proxy function
supabase functions deploy proxy-gemini --no-verify-jwt
```

---

## Project Structure

```
extension/
├── desktop/              # Electron macOS app
│   ├── main.js           # Main process (IPC, auto-updater, API proxy calls)
│   ├── renderer.js       # UI logic
│   ├── index.html        # App UI
│   ├── setup-shortcut.js # Auto-registers macOS Services shortcut
│   └── package.json
├── supabase/
│   └── functions/
│       └── proxy-gemini/ # Edge Function — holds API key server-side
├── website/              # Landing page
└── manifest.json         # Chrome extension manifest
```

---

## License

MIT — see [LICENSE](LICENSE)