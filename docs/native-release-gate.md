# Complete native release acceptance gate

The separate native module is a development target, not a replacement APK. Do not publish it as the finished Audio Desk until all requirements pass, including migration of existing user state.

- [ ] All seven production theme layouts, including the Orbit dial, match existing design and gesture behavior.
- [ ] Native widgets: full home integration, third-party AppWidgetHost, drag, resize, snapping, layout storage, reset, automatic arrangement, theme accents.
- [ ] Existing wallpaper libraries, icon packs, texture and accent handling.
- [ ] Music playback controller and actual spectrum, mic analysis, SPL weightings/calibration, calendar pinning and home widget integration.
- [ ] News source/category/date/search/discovery, source health, bookmarks, automatic updates and data migration.
- [ ] Native file manager, workspace tools, and every previously working feature; document external-service limitations.
- [ ] All production UI surfaces native; no embedded WebView or HTML/CSS/JS in APK.
- [ ] Full parity and device regression tests, especially low-end hardware and Samsung A73.
- [ ] Backward compatible application identity, signing, storage migration and rollback plan.
- [ ] User approval before merge or replacement release.

The migration now reuses the previous genuine audio analysis, notification media session and calendar engines with native Android Views and Canvas. Integration into the exact production home layouts is not finished; do not represent this as parity.

Third-party Android widgets now have a native AppWidgetHost implementation with Android binding/configuration, per-theme dimensions, order and long-press editing. The full freeform snapping/drag system and original theme geometry remain open. No release gate has been waived.

Orbit has an initial native Canvas port with original 334-unit ring geometry, curved clock, independent ring rotation, app fan and long-press. Radial media transports, in-ring native widget preview, exact icon/theme fidelity and real-device verification remain open. Do not publish as a completed release.
