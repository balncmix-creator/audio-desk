const fs=require('node:fs');
const assert=require('node:assert/strict');
const xml=fs.readFileSync('app/src/main/AndroidManifest.xml','utf8');
assert.match(xml,/<category android:name="android.intent.category.HOME"\s*\/>/,'eligible as Android Home app');
assert.match(xml,/<category android:name="android.intent.category.DEFAULT"\s*\/>/);
assert.match(xml,/<category android:name="android.intent.category.LAUNCHER"\s*\/>/);
assert.match(xml,/<queries>[\s\S]*android.intent.category.LAUNCHER[\s\S]*<\/queries>/);
assert.doesNotMatch(xml,/android.permission.QUERY_ALL_PACKAGES/,'do not request broad app visibility');
assert.doesNotMatch(xml,/android.permission.PACKAGE_USAGE_STATS/,'no intrusive usage permission');
assert.match(xml,/android.permission.SET_WALLPAPER/,'global Android wallpaper requires permission');
assert.match(xml,/android.permission.ACCESS_NETWORK_STATE/,'pixel Wi-Fi status uses the public network API');
assert.doesNotMatch(xml,/<uses-permission[^>]*android\.permission\.(?:READ_PHONE_STATE|ACCESS_FINE_LOCATION|BIND_NOTIFICATION_LISTENER_SERVICE)/,
 'pixel status bar must not request broad telephony, location or notification privileges');
assert.match(xml,/<service[^>]*AudioDeskMediaAccessService[\s\S]*?android\.permission\.BIND_NOTIFICATION_LISTENER_SERVICE/,
 'music session discovery is an optional user-granted Notification Listener service');
const media=fs.readFileSync('app/src/main/java/com/balnc/audioddesk/MediaWidgetSupport.kt','utf8');
assert.match(media,/getActiveSessions\(component\)/);
assert.match(media,/ACTION_SKIP_TO_NEXT/,'skip obeys player-reported available actions');
assert.match(media,/ACTION_NOTIFICATION_LISTENER_SETTINGS/,'user must explicitly grant media session access');
assert.doesNotMatch(media,/skipAds|bypassAds|adBlock/,'no false universal ad bypass claims');
const systemWall=fs.readFileSync('app/src/main/java/com/balnc/audioddesk/SystemWallpaperInstaller.kt','utf8');
assert.match(systemWall,/WallpaperManager\.getInstance/);
assert.match(systemWall,/WallpaperManager\.FLAG_SYSTEM/);
assert.match(systemWall,/if \(lock\) \{/,'lock changes respect the saved Home-only choice');
assert.match(systemWall,/manager\.setBitmap\(bitmap, crop, false, WallpaperManager\.FLAG_LOCK\)/,
 'Android Lock wallpaper is written independently when matching is enabled');
assert.match(systemWall,/worker\.execute/,'wallpaper updates run outside the UI thread');
assert.match(systemWall,/decodeBounded/);
const bridge=fs.readFileSync('app/src/main/java/com/balnc/audioddesk/MainActivity.kt','utf8');
assert.match(bridge,/fun setStatusBarTheme\([\s\S]*?window\.statusBarColor = Color\.TRANSPARENT/,
 'all Home themes use a transparent native status bar');
assert.match(bridge,/controller\.hide\(WindowInsetsCompat\.Type\.statusBars\(\)\)/,
 'hide only Android status bar on pixel Home, not the navigation gestures');
assert.match(bridge,/controller\.show\(WindowInsetsCompat\.Type\.statusBars\(\)\)/,
 'restore genuine Android status bar when leaving pixel Home');
assert.match(bridge,/pixelHomeThemeRequested = theme == "pixel"/,
 'custom status UI only appears in the 8-bit Home theme');
assert.match(bridge,/pixelBarSuspended = true[\s\S]*applyPixelStatusMode\(\)/,
 'leaving the app restores the normal system bar');
const pixelStatus=fs.readFileSync('app/src/main/java/com/balnc/audioddesk/PixelStatusBar.kt','utf8');
assert.match(pixelStatus,/class PixelStatusBar\(context: Context\) : View\(context\)/,
 'custom status bar is a native Android View, not HTML');
assert.match(pixelStatus,/fonts\/silkscreen-bold\.ttf/,'pixel clock loads bundled retro typeface');
assert.match(pixelStatus,/DateFormat\.format\(/,'time comes from the device');
assert.match(pixelStatus,/Intent\.ACTION_BATTERY_CHANGED/,'battery percentage comes from Android');
assert.match(pixelStatus,/NetworkCapabilities\.TRANSPORT_WIFI/,'Wi-Fi indicator is based on real network state');
assert.match(pixelStatus,/registerDefaultNetworkCallback/,'network changes update the pixel status bar');
assert.match(pixelStatus,/stopUpdates\(\)/,'updates stop while the launcher is hidden');
assert.doesNotMatch(pixelStatus,/notificationManager|NotificationListenerService|fabricatedNotification/,
 'do not fake Android notification icons');
for(const symbol of ['requestLauncherApps','launchExternalApp','requestDefaultLauncher','launcherOnResume',
 'setSystemWallpaperBundled','setSystemWallpaperCustom','audioDeskWallpaperResult'])
 assert.ok(bridge.includes(symbol),'missing bridge '+symbol);
const native=fs.readFileSync('app/src/main/java/com/balnc/audioddesk/HomeLauncherSupport.kt','utf8');
const iconDesigner=fs.readFileSync('app/src/main/java/com/balnc/audioddesk/ThemeIconRenderer.kt','utf8');
assert.match(native,/fun icon\(/,'launcher resolves only visible icons lazily');
assert.match(native,/knownApps\.none/,'icon API accepts only already-discovered launchable apps');
assert.match(iconDesigner,/getActivityIcon/,'the engine uses the app-defined Android icon');
assert.match(iconDesigner,/getApplicationIcon/,'fallback to Android application icons');
assert.match(iconDesigner,/cacheDir/,'native rendered icons cache privately without a network');
assert.match(iconDesigner,/6L \* 1024 \* 1024/,'disk icon cache has a size limit');
assert.match(iconDesigner,/theme == "pixel"/,'8-bit style renders from actual icons');
assert.match(bridge,/fun requestLauncherIcon\(/,'JavaScript can request icons on demand');
assert.doesNotMatch(native,/makeIcon\(resolve\.loadIcon\(pm\)\)/,'never decode thousands of icons during app list scan');
assert.match(native,/getShortcuts\(/,'app shortcuts use LauncherApps');
assert.match(native,/hasShortcutHostPermission/,'shortcut access checks host permission');
assert.match(native,/startShortcut\(/,'shortcuts launch through official Android API');
assert.doesNotMatch(native,/makeIcon\(resolve\.loadIcon\(pm\)\)/,'no eager icon bitmap decode');
const license=fs.readFileSync('app/src/main/assets/pixel-icons/LICENSE.txt','utf8');
assert.match(license,/MIT License/);
console.log('PASS: Android HOME, published app shortcuts with permission checks, lightweight installed-app icons and MIT-licensed pixel artwork');
