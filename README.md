# 🎧 Live Translate

**Translate the audio of any Chrome tab in real time — one click, no setup rituals.**

Watching a Coursera lecture, sitting in a Zoom Web meeting, or catching a webinar in a language you don't speak? Click the extension icon once. You will hear a spoken translation and see live subtitles at the bottom of the page, within about a second.

- ⚡ **One click** — no model picker, no tab-sharing dialog, no per-session configuration
- 🗣️ **Listen and read** — synthesized speech plus subtitles showing both the translation and the original transcript
- 🌍 **70+ target languages** — Vietnamese by default, changeable at any time
- 🎚️ **Tunable latency** — trade delay against smoothness to match your connection
- 💸 **Free to run** — uses Google's free tier; no credit card required
- 🔒 **No data collection** — no analytics, no intermediary server, no third parties

Powered by the Live Translate API from Google AI Studio.

> **Note on language:** the extension's own interface is currently in Vietnamese. Everything in this document is in English.

---

## 📥 Installation (about 3 minutes)

### Step 1 — Download the extension

Click **Code → Download ZIP** at the top of this page, then **extract** the archive.

> Keep the extracted folder. Chrome loads the extension directly from that location — deleting or moving it will break the extension.

### Step 2 — Load it into Chrome

1. Open a new tab and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked** and select the extracted folder
4. Pin the extension to your toolbar for quick access (🧩 icon → pin)

### Step 3 — Get a free API key

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and click **Create API key**. Signing in with a Google account is all it takes — **no payment method required**.
2. Copy the key.
3. Click the extension icon. The settings page opens automatically on first run. Paste the key, verify it, and save.

That's it. 🎉

---

## ▶️ Usage

| Action | How |
|---|---|
| **Start translating** | Open the tab that is playing audio, then **click the extension icon**. The badge reads `ON`, the original audio is muted, and the translated speech plays with subtitles. |
| **Stop** | **Click the icon again.** The original audio returns to normal. |
| **Switch tabs** | Just click the icon in the new tab — the previous session stops on its own. |
| **Change settings** | Right-click the icon → **Options**. |

### Available settings

| Setting | What it does |
|---|---|
| **API key** | Your Google AI Studio key. Includes a built-in check so you can confirm the key works before saving. |
| **Target language** | 70+ languages. Defaults to Vietnamese. |
| **Playback smoothness** | Three profiles — *fast* (lowest delay, more prone to dropouts on a weak connection), *balanced* (recommended), and *smooth* (roughly one extra second of buffer, fewest interruptions). |
| **Echo matching audio** | When the source audio is already in your target language, choose whether to re-read it verbatim or stay silent (silent by default). |

---

## 💰 Cost

The Live Translate model has a **free tier that costs nothing and requires no credit card** — the same tier you get using [aistudio.google.com/live](https://aistudio.google.com/live) directly.

Charges (~$0.037 per minute of audio) apply only if you have enabled billing on your Google Cloud account **and** exceed the free-tier quota.

⚠️ **Free-tier caveat:** Google may use free-tier data to improve its products. Do not use this extension for confidential material.

---

## 🔒 Privacy

- Your API key is stored **only on your machine** via `chrome.storage.local`, and is transmitted only to Google's API endpoint over TLS.
- The extension does **not** run scripts on the pages you browse. Subtitles are injected solely into the tab where you clicked the icon, using the narrowly scoped `activeTab` permission.
- No analytics, no remotely hosted code, no third-party services. The complete source is in this repository and is short enough to audit yourself.

### Permissions and why they are needed

| Permission | Purpose |
|---|---|
| `tabCapture` | Captures the audio stream of the tab you explicitly activate. This is the extension's core function. |
| `offscreen` | Audio capture and playback require `AudioContext`, which service workers cannot use. An offscreen document handles PCM processing. |
| `storage` | Persists your API key and preferences locally. |
| `activeTab` | Limits page access to the single tab you act on, avoiding broad host permissions. |
| `scripting` | Injects the subtitle overlay into that one tab, on demand. |

---

## 🛠️ Troubleshooting

| Symptom | Fix |
|---|---|
| Badge shows `ERR` | Browser-internal pages (`chrome://`, the Chrome Web Store) cannot be captured. Try an ordinary website. |
| Connection error asking you to re-check the API key | Open the settings page and run the key check. Create a new key if it fails. |
| Subtitles appear but no translated speech | Check your system volume, then click the icon twice (stop, then start again). |
| Subtitles vanish after navigating within the tab | Audio translation continues. Click the icon twice to restore the overlay. |
| Repeated reconnection messages | An unstable network. The extension retries automatically, up to four times. |
| Choppy or dropped words | Open **Options** and switch playback smoothness to *smooth*. |

---

## 🧑‍💻 Development

```bash
./build.sh          # produces dist/live-translate-v<version>.zip
```

**Requirements:** Chrome 116 or later (Manifest V3, `offscreen`, `tabCapture`).

### Project structure

| File | Role |
|---|---|
| `manifest.json` | Manifest V3 declaration |
| `background.js` | Service worker — toolbar action, session lifecycle, offscreen document management |
| `offscreen.js` | Audio capture, resampling to 16 kHz PCM, WebSocket session, playback scheduling |
| `pcm-worklet.js` | `AudioWorklet` processor that emits captured PCM frames |
| `content.js` / `content.css` | Subtitle overlay injected into the active tab |
| `options.*` | Settings page |

---

## License

[MIT](LICENSE) — free to use, modify, and distribute. Copyright © 2026 Long Lagon.
