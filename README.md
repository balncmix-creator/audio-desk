# audio-desk
8-bit audio industry news reader and REAPER discovery hub

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
build. Version 1.18 uses version code 19 and targets Android 16 / API 36.

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
