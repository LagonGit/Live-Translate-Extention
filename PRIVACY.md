# Privacy Policy — Live Translate

**Last updated: 26 July 2026**

Live Translate is a Chrome extension that translates the audio playing in a
browser tab in real time. This policy states exactly what data the extension
touches, where it goes, and what it never does.

## Summary

The developer of Live Translate operates no servers and receives no data of any
kind. Nothing you do with this extension is visible to the developer.

## What the extension handles

**Your API key.** You supply your own Google AI Studio API key. It is stored
locally in your browser through `chrome.storage.local` and never leaves your
machine except in requests sent directly to Google's API endpoint over TLS.

**Tab audio.** While a translation session is active, the audio of the tab you
explicitly activated is captured and streamed directly from your browser to
Google's Live Translate API so it can be translated. Audio is processed in memory
only. It is never written to disk, never retained after the session ends, and
never sent anywhere other than Google.

**Transcripts.** The translated text and the original transcript are shown as
subtitles in the tab. They are held in memory only and are discarded when you
stop the session or close the tab.

**Your settings.** Target language, playback smoothness, and the verbatim-echo
option are stored locally in `chrome.storage.local`.

## What the extension does not do

- No analytics, telemetry, crash reporting, or usage tracking
- No advertising and no advertising identifiers
- No developer-operated server or intermediary of any kind
- No selling or transferring of data to third parties
- No use of data for creditworthiness or lending purposes
- No use of data for any purpose unrelated to translation
- No remotely hosted or dynamically executed code
- No scripts injected into pages you merely browse; the subtitle overlay is added
  only to the specific tab where you clicked the extension icon

## Third-party processing by Google

Translation is performed by Google's Live Translate API. While a session is
running, your tab audio is transmitted to Google and is subject to Google's own
terms and privacy practices:

- [Google Privacy Policy](https://policies.google.com/privacy)
- [Gemini API Additional Terms of Service](https://ai.google.dev/gemini-api/terms)

**Important:** on Google's free tier, Google may use submitted content to improve
its products. If your audio is confidential, do not use this extension on the
free tier. This is a property of Google's service, not of this extension.

## Permissions and why they are required

| Permission | Purpose |
|---|---|
| `tabCapture` | Captures the audio of the tab you explicitly activate. This is the extension's core function. |
| `offscreen` | Audio capture and playback require `AudioContext`, which service workers cannot use. |
| `storage` | Saves your API key and preferences locally. |
| `activeTab` | Restricts page access to the single tab you act on, instead of requesting access to all sites. |
| `scripting` | Injects the subtitle overlay into that one tab, on demand. |

## Data retention and deletion

Your API key and settings remain in your browser's local storage until you clear
them or remove the extension. Uninstalling the extension deletes them. Audio and
transcripts are never persisted, so there is nothing further to delete.

## Children

This extension is not directed at children and collects no personal information
from anyone.

## Changes

Any material change to this policy will be published at this address with an
updated date.

## Contact

Questions about this policy: nplagon1@gmail.com
