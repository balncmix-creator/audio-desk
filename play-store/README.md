# Audio Desk — Play Store preparation

Developer display name requested by the owner: **Ebin Augustin**.

The app is not published. The owner still needs to register and verify a Play
Console developer account at https://play.google.com/console/signup.

## Prepared in this repository

- Android App Bundle release build, targeting Android 16 / API 36.
- A store edition with torrent/warez discovery removed from the bundled HTML,
  feeds, functions and controls. The generated page is covered by browser tests.
- A manually triggered workflow for privately signed bundles. It does not upload
  to Google Play or use the public debug certificate.
- Draft listing and privacy text. These need the owner's review and public
  contact details before submission.

## Private upload signing

Use Play App Signing with a new, private upload key. Never reuse
`app/audio-desk-debug.keystore` for Play. Never commit a private key or passwords,
or paste them in a chat. Keep an encrypted backup controlled by the owner.

Generate the upload key on a trusted machine with `keytool -genkeypair`, using
RSA 2048 or stronger and an appropriate validity period. Let keytool prompt for
the passwords so they do not enter shell history. Keep the keystore outside the
checkout. The new certificate will not update existing debug-signed installations;
testers need a separate install or a planned data migration.

Create a GitHub Actions environment named `play-store`, preferably with an owner
review requirement, and enter these secrets through GitHub Settings:

| Secret | Value |
| --- | --- |
| `PLAY_UPLOAD_KEYSTORE_BASE64` | Base64 encoding of the private upload keystore |
| `PLAY_UPLOAD_STORE_PASSWORD` | Keystore password |
| `PLAY_UPLOAD_KEY_ALIAS` | Upload key alias |
| `PLAY_UPLOAD_KEY_PASSWORD` | Key password |

Run **Build signed Play Store bundle** manually. Download `Audio-Desk-Play-SIGNED`.
The unsigned bundle from ordinary builds is for inspection only and cannot be
submitted. Local signing uses the corresponding `AUDIO_DESK_RELEASE_*` variables
documented in `app/build.gradle.kts`.

## Remaining submission work

1. Complete account registration, fee payment, identity/device verification and
   any account-specific testing requirements shown by Play Console.
2. Create Audio Desk under the verified developer account. The current application
   ID is `com.balnc.audioddesk`; confirm it before the first upload because Play
   package names cannot be changed for an existing app.
3. Supply a public support email and publish the completed privacy policy at a
   stable public HTTPS URL. Add that URL inside the app before submission.
4. Review the store listing, content rating, target audience, ads declaration and
   Data safety responses against the final build and third-party data practices.
   Do not infer those answers solely from the absence of analytics SDKs.
5. Supply the required store icon, feature graphic and screenshots captured from
   the final store edition. No store graphics have been claimed as completed.
6. Upload the privately signed AAB to internal testing, run Play's pre-launch
   report and test installation, navigation, network failures and updates on
   Android devices. Complete any required closed test before production access.
7. Submit the final reviewed listing and release to Google. Approval and timing
   are controlled by Google; preparing an AAB does not publish the app.

Target API policy reference checked during preparation:
https://support.google.com/googleplay/android-developer/answer/11926878
