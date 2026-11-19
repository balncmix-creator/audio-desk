(()=>{
"use strict";
const api=window.AudioDesk;
if(typeof api?.openYouTubePage!=="function")return;
const el=id=>document.getElementById(id),widget=el("launcherYouTubeWidget"),toggle=el("youtubeWidgetToggle"),input=el("ytSearchInput");
const key="ad_youtube_widget_v1";
let added=deskStorage.getItem(key)==="true";
function refresh(){
 widget.hidden=!added;
 toggle.hidden=false;
 const visible=added&&!widget.hasAttribute("data-widget-removed");
 toggle.textContent=visible?"− Hide YouTube widget":"+ Add YouTube widget";
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
 api.openYouTubePage(destination,query);
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