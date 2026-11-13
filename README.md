# audio-desk
8-bit audio industry news reader and REAPER discovery hub

## Version 1.12

- Keep cached headlines when feed requests fail or the device is offline.
- Store saved article details independently of the rolling headline cache.
- Remember removed sources across restarts; adding the same URL restores it.
- Wire the release radar refresh and date controls, display watchlist scan results,
  and limit radar/watchlist requests to nine seconds.

## Regression checks

Run `npm install`, `npx playwright install chromium`, then `npm test`.
To use an existing Chromium installation, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.
The checks run the bundled page at a phone-sized viewport with mocked feed responses,
including network failures. They do not replace Android device testing.

## APK builds and signing

GitHub Actions builds an installable debug APK on pushes to `main`. Download the
`Audio-Desk-APK` artifact from the successful build. Version 1.12 uses version code 13.

The existing debug certificate is retained so this update can install over older
Audio Desk builds. Its key is public and must not be used for trusted production
distribution. A production signing key must be generated privately and stored
outside this repository. Switching certificates for existing installations requires
a planned migration; simply deleting the public key does not revoke it.
