const assert=require('node:assert/strict');
const fs=require('node:fs');
const manifest=fs.readFileSync('app/src/main/AndroidManifest.xml','utf8');
const debug=fs.readFileSync('app/src/debug/AndroidManifest.xml','utf8');
const native=fs.readFileSync('app/src/main/java/com/balnc/audioddesk/SharedStorageSupport.kt','utf8');
const bridge=fs.readFileSync('app/src/main/java/com/balnc/audioddesk/MainActivity.kt','utf8');
const manager=fs.readFileSync('app/src/main/java/com/balnc/audioddesk/RadialFileSupport.kt','utf8');
const ui=fs.readFileSync('app/src/main/assets/radial-files.js','utf8');
assert.doesNotMatch(manifest,/uses-permission[^>]+MANAGE_EXTERNAL_STORAGE/,
 'Play/release manifest must not declare broad file access');
assert.match(debug,/uses-permission[^>]+MANAGE_EXTERNAL_STORAGE/,
 'Only sideloaded debug builds can request all-files permission');
assert.match(manifest,/androidx\.core\.content\.FileProvider/,
 'device files must use content URIs, not file:// Uris');
assert.match(manifest,/android:grantUriPermissions="true"/);
assert.match(native,/ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION/);
assert.match(native,/ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION/);
assert.match(native,/Environment\.isExternalStorageManager\(\)/);
assert.match(native,/requestedPermissions\?\.contains\(android\.Manifest\.permission\.MANAGE_EXTERNAL_STORAGE\)/,
 'release builds must not offer a permission omitted from their manifest');
assert.match(native,/getExternalStorageDirectory\(\)\.canonicalFile/);
assert.match(native,/\bcandidate\.path\b|\bcp\b/,
 'canonical file containment check must run for every operation');
assert.match(native,/equals\("data"/);
assert.match(native,/equals\("obb"/);
assert.match(native,/UUID\.randomUUID/,'web page must receive opaque IDs, not file paths');
assert.match(native,/FileProvider\.getUriForFile/);
assert.doesNotMatch(native,/Uri\.fromFile/);
assert.match(bridge,/fun radialFilesRequestFullAccess\(location: String\)/);
assert.match(bridge,/radialFiles\.onResume\(\)/,
 'permission changes must be checked after returning from Android Settings');
assert.match(manager,/shared\.requestAccess\(location\)/);
assert.match(manager,/shared\.active\)/);
assert.match(ui,/\["root","Device"/);
assert.match(ui,/\["downloads","Downloads"/);
assert.match(ui,/\["folder","Folder"/);
assert.match(ui,/radialFilesRequestFullAccess/);
assert.match(ui,/radialFilesPick/);
console.log('PASS: Debug-only all-files permission, scoped fallback, canonical storage root, protected paths and URI safety');
