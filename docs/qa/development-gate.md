# Development and release quality gate
## Required sequence
1. Establish the baseline: commit, affected modules, reproduction, expected behavior, existing failure and scope.
2. Map impact: callers, data contracts, cache migrations, themes, gestures, native bridges, debug and Play assets, accessibility, performance and permissions as relevant.
3. Repair shared logic. Add failing regression first when practical, then show that it passes after the fix. Preserve user data and previous behavior.
4. Try to break the result using invalid inputs, empty state, large datasets, concurrent actions, interrupted network, restart, upgrade and offline scenarios. Inspect real rendered UI where applicable.
5. Run all existing tests plus new regressions, native tests, package verification and screenshot review. Resolve failures; do not skip gates. Record evidence and limitations.
6. Deliver only a verified artifact from the tested commit. Keep development previews separate from stable releases. Physical-device acceptance must not be inferred from Chromium or Robolectric.
## Domain coverage
| Domain | Required scenarios when affected |
| --- | --- |
| News | Actual article intent vs misleading publisher labels, GitHub/ReaScript discovery, ambiguous keywords, unrelated topics, duplicates across providers, saved/cache reclassification, date/time zones, invalid/future dates, search periods, offline, removal during refresh |
| Launcher/UI | All themes including Orbit, layout snapping, resize handles on every edge, collisions, widget moves, safe insets, font scale, icon fallback, wallpaper/accent contrast, gesture interruptions, state persistence |
| Android integrations | Permission granted/denied/revoked, native callback failures, app background/resume, low RAM, correct manifest and both editions |
| Workspace | Empty/invalid records, data retention, calculations and boundaries, references, navigation, export, upgrade, theme readability |
| Build | Test registration, asset inclusion, exact APK and AAB, version/signing identity, screenshot review, CI logs, device acceptance status |
## Per-change evidence (complete in PR before release)
- Commit / branch:
- Reported defect or requested feature:
- Reproduction and root cause:
- Related systems investigated and findings:
- Tests added (failure before / pass after, if available):
- Automated suite / native build / packaged edition links and status:
- Screenshot review (themes, sizes, findings):
- Real-device testing (model, Android version, actions, results; or not run):
- Known limitations, deferred items, risks:
- Artifact name, version and exact commit:
- Release decision: development candidate / stable approved / blocked.
Never mark an unchecked item as passed. Use not applicable with a reason. The automated registration and package checks are safeguards, not substitutes for engineering review.

## Explicit legacy exception
The unused `app-icon-engine.js`, `app-icon-engine.css` and historical `tests/app-icon-engine.cjs` are superseded by the active `native-icons` modules and regression. The coverage gate excludes only these exact names and rejects runtime references to the retired assets; they must be restored to coverage or removed if reactivated. All other shared top-level JavaScript/CSS files and executable test files are checked.
