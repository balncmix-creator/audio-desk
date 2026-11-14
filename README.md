# Audio Desk

**A retro-styled Android news desk for people who make sound.** Follow what is happening in film and TV audio post, REAPER, sound design, DAWs and audio plug-ins, sample libraries, studio technology and more.

[**Download Audio Desk v1.23 APK**](https://github.com/balncmix-creator/audio-desk/releases/download/v1.23/Audio-Desk-v1.23.apk) · [Browse releases](https://github.com/balncmix-creator/audio-desk/releases) · [Report an issue](https://github.com/balncmix-creator/audio-desk/issues)

> **Android test release:** The direct APK uses a stable **debug signing key**, not a private production key or Play Store signing. Install only if you trust this repository and its published builds.

## Screenshots

| Latest headlines | Post Production | Offline mode |
|:--:|:--:|:--:|
| ![Audio Desk news reader showing audio news cards](docs/screenshots/news-feed.png) | ![The single Post Production news category](docs/screenshots/post-production.png) | ![Audio Desk offline screen with broken-down desk illustration](docs/screenshots/offline.png) |

*Genuine captures of the app's HTML interface at a phone-sized viewport, rendered in Chromium. The headlines and thumbnail artwork are **illustrative demo content**, not live news; Android system chrome and fonts may differ.*

## What can Audio Desk do?

- **Audio industry headlines:** Browse REAPER, **Post Production**, DAWs & plug-ins, plug-in releases, Sample Pack News, Sound Design, Hardware, Production and Videos.
- **Film/TV post-production radar:** Discover coverage of dialogue editorial, ADR, Foley, Atmos, immersive mixing, restoration, broadcast delivery and related tools in one unified category.
- **Subtle image color accents:** Dark grey article cards remain neutral without an image and receive a restrained color tint when an article has an image.
- **Offline reading:** Previously fetched and saved stories stay visible without a connection; the familiar desk becomes a broken-down offline illustration.
- **Customizable sources and bookmarks:** Add or remove RSS feeds and save stories for later.
- **Discovery tools:** Search news sources and explore relevant REAPER and audio-software developments.

## Install on Android

1. Open the [v1.22 APK download](https://github.com/balncmix-creator/audio-desk/releases/download/v1.23/Audio-Desk-v1.23.apk) on your Android phone. **This is an APK, not a ZIP.**
2. Open the downloaded file and, if Android asks, allow installations from the browser or file manager you used.
3. Launch **Audio Desk**. Network access is used to refresh headlines, while saved items remain locally available.

Requires Android 6.0 (API 23) or later. The app currently targets Android 16 (API 36).

## Developing

The Android app is in `app/`; the WebView interface is `app/src/main/assets/index.html`. Automated browser tests cover news filters, bookmarks, cached/offline behavior, image accents and the Play review variant.

```bash
npm ci
npx playwright install chromium
npm test
node scripts/capture-readme-screenshots.cjs
```

The last command captures the app's interface into `docs/screenshots/` with labeled fictional example content. Tests and browser screenshots are not substitutes for physical-device testing.

## Changelog

### Version 1.23
- Add direct audio industry coverage from Rekkerd, A Sound Effect and Bedroom Producers Blog.
- Add targeted searches for Mix, postPerspective, Sonic State, Gearspace, Reapertips, Sample Library Review and VI-Control.
- Correct The REAPER Blog to the REAPER category, and remove the inactive Pro Audio Files news feed.
- Automatically scan ten curated publisher sites weekly for new RSS/Atom feed links (or on demand); native Android verifies same-publisher HTTPS feeds and RSS2JSON readability before adding them.
- Persist discovered sources, respect user-removed sources, and avoid duplicate entries. This expands coverage of monitored publishers but cannot find every unknown website across the internet.


### Version 1.21
- Merge the duplicate Post-production and POST PRODUCTION filters into **one** Post Production feed; normalize sources and migrate cached and saved article categories.
- Remove the repeated Production Expert RSS source.
- Add visitor-focused documentation and reproducible real-UI screenshots.

## Version 1.20

- Replace the Android launcher artwork in both legacy and adaptive icon slots with the approved polished Audio Desk artwork.
- Use the identical metallic desk image for native pull-to-refresh branding and as the in-app masthead fallback.
- Maintain the existing genuine 3D rotating desk for the active masthead, now with graduated metallic face shading.
- Package the shared image in both debug and Play review asset editions and test its presence.
- Preserve the offline illustration, sample categories and image-tinted article cards.

## Version 1.19

- Replace the flat SVG Y-axis flip in the masthead with a true three-dimensional rotating desk.
- Model a tabletop with thickness, multiple sides and four legs; keep a fixed orthographic rendering scale and a waveform on the tabletop.
- Rotate around the vertical axis only: no floating, stretching, shrinking or waveform-pulsing animation.
- Pause animation when the app is hidden and honor reduced-motion accessibility settings.

## Version 1.18

- Add the animated isometric Audio Desk icon beside the app title in the masthead.
- Use the same canonical tabletop, apron, sides, legs and projected waveform as the launcher icon.
- Animate slow rotation, gentle floating motion and waveform pulsing; disable animation when reduced-motion is requested.
- Keep the existing headline categories, grey/image-based accent cards, and offline broken-desk state.

## Version 1.17

- Route sample packs, sound libraries, construction kits and other sample products to a dedicated **Sample Pack News** filter, never to DAWs & plugins.
- Keep the existing sample-pack source directory separate from the news feed.
- Migrate locally cached and bookmarked article categories, even when offline.
- Exclude generic "release" and "update" words from DAW/plugin detection to avoid misleading classifications.
- Add browser regression tests for sample headlines, plugin articles, cached category migration, and saved news.

## Version 1.16

- Restore consistent physical thickness to the front edge of the isometric desk launcher and refresh logo.
- Show a broken-down rendition of the desk when offline or all news feeds cannot be reached; keep cached headlines visible.
- Keep neutral grey article cards and subtle image-derived accents (12% surface, 22% border).

## Version 1.15

- Keep neutral grey cards by default; image cards receive a subtle sampled colour tint.
- Sample publisher images natively when browser canvas access is restricted.
- Keep monochrome, missing and unreadable images neutral, without hiding valid thumbnails.

## Version 1.14

- Use the isometric desk and correctly projected waveform as the launcher icon.
- Reveal the same desk during pull-to-refresh; only the waveform oscillates.
- Stop motion after refresh, on timeout, while hidden, or when animations are disabled.
- Share canonical logo geometry between launcher, native loader and preview.
- Cover pull thresholds, cancellation, scroll and horizontal gestures with Android unit tests.

## Version 1.13

- Replace teal article cards and image-derived tints with subtle grey panels.

## Version 1.12

- Keep cached headlines when feed requests fail or the device is offline.
- Store saved article details independently of the rolling headline cache.
- Remember removed sources across restarts; adding the same URL restores it.
- Wire the release radar refresh and date controls, display watchlist scan results,
  and limit radar/watchlist requests to nine seconds.

## Regression checks

Run `npm install`, `npx playwright install chromium`, then `npm test`.
To use an existing Chromium installation, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.
The checks run both editions at a phone-sized viewport with mocked feed responses,
including network failures. They do not replace Android device testing.

## APK builds and signing

GitHub Actions builds an installable debug APK and an unsigned Play review bundle
on pushes to `main`. Download the `Audio-Desk-APK` artifact from the successful
build. Version 1.23 uses version code 24 and targets Android 16 / API 36.

Release builds generate a separate asset bundle with torrent/warez discovery UI,
feed definitions and code removed. The ordinary debug APK retains its existing
feature set. `npm run prepare:play` regenerates the store page; do not edit it.

The existing debug certificate is retained so this update can install over older
Audio Desk builds. Its key is public and must not be used for trusted production
distribution. A production signing key must be generated privately and stored
outside this repository. Switching certificates for existing installations requires
a planned migration; simply deleting the public key does not revoke it.

See [Play Store preparation](play-store/README.md) for private signing and the
remaining developer-account requirements. No Play upload is performed by CI.
