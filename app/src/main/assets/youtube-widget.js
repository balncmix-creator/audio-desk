(()=>{
"use strict";
const api=window.AudioDesk;
if(typeof api?.openYouTubePage!=="function")return;
const el=id=>document.getElementById(id),widget=el("launcherYouTubeWidget"),toggle=el("youtubeWidgetToggle"),input=el("ytSearchInput");
const key="ad_youtube_widget_v1";
const slot=el("ytFeedSlot"),account=el("ytOpenAccount"),inline=typeof api.layoutYouTubeWidget==="function"&&typeof api.navigateYouTubeWidget==="function";
let raf=0,last="",motionUntil=0;
function schedule(animate=false){
 if(!inline)return;
 if(animate)motionUntil=performance.now()+350;
 if(!raf)raf=requestAnimationFrame(sync);
}
function sync(now){
 raf=0;
 const sized=widget.hasAttribute("data-layout-sized");
 widget.classList.toggle("yt-compact",sized&&widget.clientHeight<245);
 const editing=document.body.classList.contains("widget-dragging")||document.body.classList.contains("widget-layout-editing");
 const modal=(typeof hasLauncherOverlay==="function"&&hasLauncherOverlay())||[...document.querySelectorAll('[role="dialog"],[aria-modal="true"],.customize-overlay')].some(e=>!e.hidden&&e.getClientRects().length&&getComputedStyle(e).visibility!=="hidden");
 const visible=launcherTheme!=="extreme"&&launcherTheme!=="orbit"&&added&&!widget.hidden&&!widget.hasAttribute("data-widget-removed")&&!editing&&!modal&&launcherPage==="home"&&!document.hidden&&window.audioDeskForeground!==false;
 const b=slot.getBoundingClientRect(),w=widget.getBoundingClientRect();
 const style=getComputedStyle(document.documentElement);
 const top=Math.max(w.top,parseFloat(style.getPropertyValue("--status-top"))||0);
 const bottom=Math.min(w.bottom,innerHeight-Math.max(0,parseFloat(style.getPropertyValue("--system-bottom"))||0));
 let right=Math.min(innerWidth,w.right);
 const rail=el("launcherAlphaIndex");
 if(rail&&rail.getClientRects().length&&getComputedStyle(rail).visibility!=="hidden"){
  const r=rail.getBoundingClientRect();if(b.top<r.bottom&&b.bottom>r.top&&r.left>b.left)right=Math.min(right,r.left-2);
 }
 const home=visible&&b.width>=100&&b.height>=100&&b.bottom>top&&b.top<bottom&&b.left<right;
 const payload=JSON.stringify({home,width:innerWidth,x:b.left,y:b.top,w:b.width,h:b.height,left:Math.max(0,w.left),top,right,bottom});
 if(last!==payload){last=payload;api.layoutYouTubeWidget(payload)}
 if(now<motionUntil&&visible)schedule();
}
if(inline){
 slot.hidden=false;account.hidden=false;
 el("ytHome").textContent="Home";
 el("ytSubscriptions").textContent="Subscriptions";
 el("ytWidgetNote").textContent="Official YouTube website · sign in here if Google permits WebView login.";
 account.textContent="Sign in to YouTube";
 account.onclick=()=>open("signin");
 const observer=new MutationObserver(()=>schedule(true));
 observer.observe(widget,{attributes:true,attributeFilter:["hidden","data-widget-removed","data-layout-sized","style"]});
 observer.observe(document.body,{attributes:true,attributeFilter:["class","data-launcher-theme"]});
 for(const id of ["widgetLayoutOverlay","launcherHomeOptions","launcherLetterPanel","launcherShortcutMenu","launcherThemeDialog","launcherWallpaperDialog","launcherClockDialog","gridDetail","agendaOverlay","launcherFolderSheet","musicSpectrumTuningOverlay"]){
  const node=el(id);if(node)observer.observe(node,{attributes:true,attributeFilter:["hidden","class"]});
 }
 if(typeof ResizeObserver==="function"){const ro=new ResizeObserver(()=>schedule(true));ro.observe(widget);ro.observe(slot)}
 for(const event of ["audio-desk-layout-changed","audio-desk-widget-visibility","launcher-page-changed","audio-desk-foreground","audio-desk-theme-changed"])window.addEventListener(event,()=>{last="";schedule(true)});
 window.addEventListener("scroll",()=>schedule(),{passive:true,capture:true});
 window.addEventListener("resize",()=>schedule(true));
 document.addEventListener("visibilitychange",()=>schedule());
}
let added=deskStorage.getItem(key)==="true";
function refresh(){
 widget.hidden=!added;
 toggle.hidden=false;
 const visible=added&&!widget.hasAttribute("data-widget-removed");
 toggle.textContent=visible?"− Hide YouTube widget":"+ Add YouTube widget";
 schedule(true);
}
toggle.onclick=()=>{
 const visible=added&&!widget.hasAttribute("data-widget-removed");
 added=!visible;
 deskStorage.setItem(key,String(added));
 if(added)window.audioDeskRestoreWidget?.(widget.id);
 refresh();
};
function open(destination,query=""){
 if(widget.hidden||widget.hasAttribute("data-widget-removed")||launcherPage!=="home"||window.audioDeskForeground===false)return;
 if(inline)api.navigateYouTubeWidget(destination,query);
 else el("ytWidgetNote").textContent="Embedded YouTube is unavailable in this version.";
}
el("ytHome").onclick=()=>open("home");
el("ytSubscriptions").onclick=()=>open("subscriptions");
el("ytSearchForm").onsubmit=e=>{
 e.preventDefault();
 const query=input.value.trim().slice(0,300);
 if(!query){input.focus();return;}
 input.blur();open("search",query);
};
window.addEventListener("audio-desk-widget-visibility",refresh);
window.addEventListener("launcher-page-changed",()=>{if(launcherPage!=="home")input.blur()});
refresh();
})();