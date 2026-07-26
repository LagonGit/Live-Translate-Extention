# Changelog

All notable changes to this project are documented here.
This project follows [Semantic Versioning](https://semver.org/).

## [1.4.0] — 2026-07-26

### Changed

- **Renamed to "Live Translate."** The product name no longer carries a
  third-party model name, avoiding any suggestion of an official endorsement.
- **The entire interface is now in English.** Every user-facing string was
  converted: the extension name, description and toolbar tooltip, the settings
  page, the subtitle overlay statuses, and all error messages raised by the
  service worker and the offscreen document.
- The settings page now declares `lang="en"`, so screen readers use the correct
  pronunciation.
- Added `homepage_url` pointing at the project repository.

### Documentation

- README rewritten in English, with a permissions rationale table, the full list
  of available settings, and a project-structure overview.
- Added an MIT license.

## [1.3.0]

Initial public release.

- One-click real-time translation of the audio playing in the active tab, with a
  spoken translation plus subtitles showing both the translation and the original
  transcript.
- 70+ target languages.
- Selectable playback smoothness (`fast` / `balanced` / `smooth`) backed by an
  adaptive jitter buffer that grows on network instability and shrinks again once
  the connection is steady.
- Optional verbatim echo when the source audio is already in the target language.
- Automatic reconnection, up to four attempts.
