const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'app/src/main/assets/index.html'), 'utf8');
function replace(pattern, replacement) {
  if (!pattern.test(html)) throw new Error(`Play asset source changed: ${pattern}`);
  html = html.replace(pattern, replacement);
}

// Remove the feature's markup, feed definitions, functions and event bindings
// from the store artifact, rather than hiding a working feature with CSS.
replace(/^    <div id="torrentControls"[\s\S]*?^    <\/div>\n/m, '');
replace(/^    <div id="watchlistTools"[\s\S]*?^    <\/div>\n/m, '');
replace(/<button data-filter="Torrent Monitor">[^<]*<\/button>/g, '');
replace(/<button data-view="torrents">[^<]*<\/button>/g, '');
replace(/^.*"cat":"Torrent Monitor".*\n/gm, '');
replace(/^ if\(feed.cat==="Torrent Monitor"\).*\n/m, '');
replace(/const torrentResources = \[[\s\S]*?\];\n/, '');
replace(/let torrentMonitorItems=\[\];[\s\S]*?(?=function renderResourceDirectory\()/, '');
replace(/const data=activeView==="torrents"\?torrentResources:sampleResources;/, 'const data=sampleResources;');
replace(/\$\("resourceHeading"\).textContent=activeView==="torrents"\?"Audio Torrent Monitor":"Sample pack directory";/, '$("resourceHeading").textContent="Sample pack directory";');
replace(/^.*\$\("(?:watchlistTools|torrentControls)"\).*\n/gm, '');
replace(/^.*\$\("resourceCategory"\).parentElement.hidden=.*\n/gm, '');
replace(/\$\("resourceIntro"\).textContent=activeView==="torrents"[\s\S]*?:"(A separate directory[^"\n]*)";/, '$("resourceIntro").textContent="$1";');
replace(/view==="torrents"\?"Search torrent sources…":/, '');
replace(/if\(!news\)\{if\(view==="torrents"\)loadTorrentMonitor\(\);else renderResourceDirectory\(\);\}/, 'if(!news)renderResourceDirectory();');
replace(/else if\(activeView==="torrents"\)renderTorrentMonitor\(\);/g, '');
replace(/if\(activeView==="torrents"\)renderTorrentMonitor\(\);else /g, '');
replace(/^.*\$\("(?:scanWatchlist|pluginWatchlist|refreshTorrent|torrentPeriod)"\).*\n/gm, '');

if (/torrent|warez|audioz|rutracker|1337x|keygen|crack/i.test(html)) {
  throw new Error('Restricted discovery feature remains in Play assets');
}
// AGP assigns its own generated-source directory when wiring the task.
const out = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'app/build/generated/playAssets');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log('Prepared Play assets at ' + out + ': news, saved articles and licensed sample directory');
