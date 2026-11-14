const fs=require('node:fs');
const assert=require('node:assert/strict');
const xml=fs.readFileSync('app/src/main/AndroidManifest.xml','utf8');
assert.match(xml,/<category android:name="android.intent.category.HOME"\s*\/>/,'eligible as Android Home app');
assert.match(xml,/<category android:name="android.intent.category.DEFAULT"\s*\/>/);
assert.match(xml,/<category android:name="android.intent.category.LAUNCHER"\s*\/>/);
assert.match(xml,/<queries>[\s\S]*android.intent.category.LAUNCHER[\s\S]*<\/queries>/);
assert.doesNotMatch(xml,/android.permission.QUERY_ALL_PACKAGES/,'do not request broad app visibility');
assert.doesNotMatch(xml,/android.permission.PACKAGE_USAGE_STATS/,'no intrusive usage permission');
const bridge=fs.readFileSync('app/src/main/java/com/balnc/audioddesk/MainActivity.kt','utf8');
for(const symbol of ['requestLauncherApps','launchExternalApp','requestDefaultLauncher','launcherOnResume'])
 assert.ok(bridge.includes(symbol),'missing bridge '+symbol);
console.log('PASS: HOME intent, selectable default, launchable-app visibility without privileged permissions');
