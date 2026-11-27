# Native migration: preview 1

No embedded browser engine, HTML layout, CSS or JavaScript in the new native-launcher module. XML is used for the Android manifest only. The existing hybrid module is left intact for reference and to prevent a regression-heavy upgrade. The native module has a separate package ID and can be installed next to it.

Implemented: native Home, package discovery, app search/list, app launching, favourites, local launch-history recents, native long-press management, simple appearance presets, native RSS/Atom reader with manual feed addition, saved headlines and source status. External Google searches and articles open in the user's browser. No external page is rendered inside the launcher.

Not equivalent to the current app yet: Orbit radial geometry, exact theme layouts, app icon packs, wallpaper and texture selection, widget host/resize/reposition, music/spectrum/SPL, calendar, file manager, workspace, YouTube embedded feed, automatic Google result scanning, background news, dynamic GitHub repository discovery, existing data migration and comprehensive classification parity. The current native news parser/classifier is a first port, not verified against live publishers. The preview does not include torrent-monitor feeds. Do not distribute this as an in-place upgrade.

Release gate: no HTML/CSS/JS packaged, no embedded browser engine, native tests, full feature parity matrix, settings/data migration, actual Android-device regression and performance tests. No main merge or replacement release until explicitly approved.
