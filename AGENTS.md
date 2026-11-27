# Audio Desk engineering rules
These instructions apply to every change in this repository. They are development requirements, not evidence that a particular release has passed.
## Before editing
- Read the current branch, recent changes, relevant tests, prior defect reports and actual app architecture. Reproduce the issue or explicitly record why reproduction is unavailable.
- For any reported defect, trace the shared code, inputs, outputs, persistence, permissions, platform variants, and related user flows. Look for sibling defects; fix the root cause and directly related regressions, not only the example. Do not silently expand into unrelated features.
- Keep unreviewed changes on a dedicated branch. Preserve user settings, bookmarks, signing identity, theme behavior, and stable main unless an explicit approved release requires otherwise.
## Implementation and verification
- Prefer shared, deterministic logic with clear data contracts. Do not rely on source labels alone, fixed theme colors, or optimistic UI states where underlying data can disagree.
- Add a regression that fails for the reported defect before claiming it fixed. Include normal, adversarial, boundary, stale-cache, offline, failure and restart cases as applicable. Do not weaken or bypass tests to obtain green CI.
- Check both sideload/debug and Play packaging, local asset registration, Android bridge contracts and upgrade behavior. New capabilities need integration tests in the actual entry path, not only isolated function tests.
- For UI changes, inspect the actual generated screenshots for all affected themes, narrow/wide sizes, large fonts, contrast, touch targets, gesture conflicts and clipping. Explicitly test Samsung A73/One UI insets when affected. A generated screenshot is not proof of physical-device testing.
- Review performance, battery, network cancellation, privacy and permissions when relevant. Never add hidden background behavior or collect data unnecessarily.
- Run the complete regression suite and inspect failing logs. CI must pass on the exact delivered commit; check the actual APK artifact and edition before offering a download. Do not describe queued builds as complete.
## Release and communication
- Use docs/qa/development-gate.md to prepare evidence and disclose blocked or unverified checks. Separate code implemented, simulated/browser verified, native compilation verified, and real-device verified.
- A green automated build is a test candidate, not a guarantee of correctness. No stable claim without device acceptance evidence; report remaining limitations and incomplete scope.
- Keep public release/main separate until authorized. Prefer direct APK delivery for test builds; never send a guessed artifact link or an older APK as an update.
- When the user reports one issue, own investigation of related defects. Do not make the user the primary QA tester.
