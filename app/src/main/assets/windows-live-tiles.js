/* Windows Phone-style Live Tiles, using only real locally available data.
 * Calendar/date and Audio Desk headlines work without extra permissions.
 * Notification BADGE COUNTS are opt-in, privacy-preserving and never represent
 * unread messages. Music uses user-authorized Android MediaSession metadata.
 * No dummy headlines, fabricated unread numbers or notification body copying. */
(()=>{
"use strict";
const byId=id=>document.getElementById(id);
const fav=byId("launcherFavorites"),tiles=byId("launcherLiveTiles");
if(!fav||!tiles)return;
const storageKey="ad_windows_tile_notification_counts_v1";
let notificationsOn=deskStorage.getItem(storageKey)==="true";
let activeCounts={},notificationAccess=false,media={available:false};
const fit=text=>String(text||"").replace(/\s+/g," ").trim().slice(0,100);
function iconClass(app){
 const identity=(app.label+" "+app.pkg).toLocaleLowerCase();
 if(/calendar|agenda/.test(identity))return"calendar";
 if(/\bclock\b|alarm|timer/.test(identity))return"clock";
 if(/music|spotify|soundcloud|audio player|youtube music|poweramp|vlc/.test(identity))return"music";
 if(/(?:^|\b)audio desk(?:\b|$)/.test(identity))return"news";
 return"app";
}
function latestHeadline(){
 if(!Array.isArray(items))return"";
 const story=items.filter(x=>x&&typeof x.title==="string"&&x.title.trim()&&
   typeof x.link==="string"&&/^https:\/\//.test(x.link))
  .sort((a,b)=>(Date.parse(b.date)||0)-(Date.parse(a.date)||0))[0];
 return story?fit(story.title):"";
}
function today(){return new Date()}
function appData(pkg){
 return launcherApps.find(a=>a.pkg===pkg)||launcherRecents.find(a=>a.pkg===pkg);
}
function tileInfo(app){
 const kind=iconClass(app),now=today(),count=Math.min(99,Math.max(0,Number(activeCounts[app.pkg])||0));
 if(count>0)return{type:"count",primary:String(count),detail:count===1?"ACTIVE NOTIFICATION":"ACTIVE NOTIFICATIONS"};
 if(media.available&&media.app===app.pkg&&fit(media.title))
  return{type:"music",primary:fit(media.title),detail:fit(media.artist||"NOW PLAYING")};
 if(kind==="calendar")
  return{type:"date",primary:String(now.getDate()),detail:now.toLocaleDateString([],{weekday:"short",month:"short"}).toUpperCase()};
 if(kind==="clock")
  return{type:"time",primary:now.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",hour12:false}),detail:"LOCAL TIME"};
 if(kind==="news"){
  const headline=latestHeadline();
  if(headline)return{type:"headline",primary:headline,detail:"AUDIO DESK NEWS"};
 }
 return null;
}
function element(tag,cls,text){
 const e=document.createElement(tag);e.className=cls;
 if(text!==undefined)e.textContent=text;
 return e;
}
function decorate(){
 if(launcherTheme!=="windows")return;
 for(const button of fav.querySelectorAll(".n-app-row .launcher-app")){
  if(button.classList.contains("win-live-app"))continue;
  const icon=button.querySelector(".ad-icon-shell,.warm-line-icon,.pixel-icon");
  const label=button.querySelector(".app-name");
  if(!icon||!label)continue;
  const front=element("span","win-tile-front");
  const title=element("span","win-tile-title");
  label.classList.add("win-app-label");
  title.append(label);
  front.append(icon,title);
  front.append(element("span","win-tile-badge"));
  const back=element("span","win-tile-back");
  back.append(element("span","win-tile-back-kicker"),element("strong","win-tile-back-primary"),
   element("span","win-tile-back-detail"),element("span","win-tile-back-label",label.textContent));
  button.replaceChildren(front,back);
  button.classList.add("win-live-app");
  const stamp=button.closest(".n-app-row")?.querySelector(".tile-activity");
  stamp?.remove();
 }
 update();
}
function update(){
 if(launcherTheme!=="windows"||launcherPage!=="home")return;
 for(const button of fav.querySelectorAll(".win-live-app")){
  const app=appData(button.dataset.launchPkg);
  if(!app)continue;
  const info=tileInfo(app),count=Number(activeCounts[app.pkg])||0;
  const back=button.querySelector(".win-tile-back");
  const badge=button.querySelector(".win-tile-badge");
  badge.textContent=count>0?String(Math.min(99,count)):"";
  badge.hidden=count<=0;
  button.classList.toggle("win-tile-animated",!!info);
  button.dataset.tileInfo=info?.type||"";
  if(!info)continue;
  back.querySelector(".win-tile-back-kicker").textContent=
   info.type==="count"?"NOTIFICATIONS":
   info.type==="music"?"NOW PLAYING":
   info.type==="date"?"TODAY":info.type==="time"?"CLOCK":"LATEST";
  back.querySelector(".win-tile-back-primary").textContent=info.primary;
  back.querySelector(".win-tile-back-detail").textContent=info.detail;
 }
}
let lastTilePoll=0;
function poll(){
 if(!notificationsOn||launcherTheme!=="windows"||launcherPage!=="home"||document.hidden||window.audioDeskForeground===false||fav.hasAttribute("data-widget-removed"))return;
 if(Date.now()-lastTilePoll<15000)return;
 lastTilePoll=Date.now();
 const packages=[...new Set(launcherSuggestedApps().map(a=>a.pkg))].slice(0,20);
 try{window.AudioDesk?.requestLiveTileCounts?.(JSON.stringify(packages))}catch{}
}
window.receiveAudioDeskLiveTileCounts=data=>{
 if(!notificationsOn)return;
 notificationAccess=!!data?.enabled;
 activeCounts=notificationAccess&&data.counts&&typeof data.counts==="object"?data.counts:{};
 update();updateSetting();
};
const existingMedia=window.receiveAudioDeskMedia;
window.receiveAudioDeskMedia=function(data){
 existingMedia?.(data);
 media=data&&typeof data==="object"?data:{available:false};
 update();
};
function updateSetting(){
 const input=byId("windowsTileCountToggle"),hint=byId("windowsTilePermissionHint");
 if(!input||!hint)return;
 input.checked=notificationsOn;
 hint.textContent=!notificationsOn?
  "Off by default. Enables local counts of active Android notifications only; no message text or senders.":
  !notificationAccess?
  "Enabled. Grant Audio Desk notification access in Android Settings to show counts (music access uses the same permission).":
  "Enabled. Shows active notification cards by app, not unread-message totals. Never reads their text.";
}
const container=element("label","windows-live-setting");
container.id="windowsLiveTileSetting";
const input=document.createElement("input");
input.id="windowsTileCountToggle";input.type="checkbox";
const caption=element("span","windows-live-setting-label","Live Tile notification badges");
container.append(input,caption);
const note=element("small","windows-live-setting-note");
note.id="windowsTilePermissionHint";
byId("glassStyleControl")?.after(container,note);
input.addEventListener("change",()=>{
 notificationsOn=input.checked;
 deskStorage.setItem(storageKey,String(notificationsOn));
 notificationAccess=false;activeCounts={};lastTilePoll=0;
 update();updateSetting();
 if(notificationsOn){
  poll();
  // User explicitly opts into enabling the Android permission gateway.
  window.AudioDesk?.requestMediaAccess?.();
 }
});
updateSetting();
// Windows places live content ahead of app tiles. Other editions retain
// their original widget arrangement and saved per-theme layout positions.
function arrange(){
 const music=byId("launcherMusicWidget");
 if(launcherTheme==="windows"){
  fav.before(tiles);
  fav.after(music);
 }else{
  byId("launcherTilesSearch").before(music);
  byId("launcherRecentStrip").after(tiles);
 }
}
const originalRender=renderLauncherHome;
renderLauncherHome=function(){originalRender();arrange();decorate();poll()};
const originalTheme=setLauncherTheme;
setLauncherTheme=function(theme){originalTheme(theme);arrange();decorate();poll()};
window.addEventListener("audio-desk-news-updated",update);
window.addEventListener("launcher-page-changed",()=>{decorate();poll()});
window.addEventListener("focus",poll);
window.addEventListener("visibilitychange",()=>{if(!document.hidden)poll()});
const oldResume=window.launcherOnResume;
window.launcherOnResume=function(){oldResume?.();poll();update()};
const motion=window.matchMedia?.("(prefers-reduced-motion: reduce)");
if(motion?.matches)document.body.classList.add("win-static-motion");
setInterval(()=>{
 if(document.hidden||window.audioDeskForeground===false||launcherPage!=="home"||launcherTheme!=="windows")return;
 updateLauncherLiveTiles();
 update();poll();
},60000);
arrange();decorate();poll();
window.audioDeskWindowsTiles={refresh:update,optedIn:()=>notificationsOn};
})();
