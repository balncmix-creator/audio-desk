/* Audio Desk app organization: Home folders, Android app management, app
   grid/list, opacity options and explicit News→Home swipe. */
(()=>{
"use strict";
const byId=id=>document.getElementById(id);
const folderKey="ad_home_folders_v1",gridKey="ad_apps_layout_v1",glassKey=()=>"ad_glass_v1_"+launcherTheme;
const safe=String,folderIcon='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>';
function loadFolders(){
 try{const f=JSON.parse(deskStorage.getItem(folderKey)||"[]");
  return Array.isArray(f)?f.filter(v=>v&&typeof v.id==="string"&&
   typeof v.name==="string"&&Array.isArray(v.keys)).slice(0,30):[];
 }catch{return[]}
}
let folders=loadFolders(),selectedFolder=null,folderHeld=null,appHeld=null,clickBlockedUntil=0,folderCancelUntil=0;
function persistFolders(){deskStorage.setItem(folderKey,JSON.stringify(folders))}
function folderMarkup(f){
 const icon=launcherTheme==="pixel"?
  '<img src="pixel-icons/folder.svg" alt="" width="24" height="24">':folderIcon;
 return '<button type="button" class="launcher-folder-tile" data-folder-id="'+esc(f.id)+
  '" aria-label="Open folder '+esc(f.name)+'">'+
  '<span class="folder-icon">'+icon+'</span>'+
  '<span class="folder-title">'+esc(f.name)+'</span>'+
  '<span class="folder-count">'+f.keys.length+'</span></button>';
}
const baseRenderHome=renderLauncherHome;
renderLauncherHome=function(){
 baseRenderHome();
 const host=launcherTheme==="windows"?byId("launcherFavorites"):byId("launcherRecentQuick");
 for(const item of host.querySelectorAll("[data-folder-id]"))item.remove();
 if(!folders.length)return;
 host.insertAdjacentHTML("afterbegin",folders.map(folderMarkup).join(""));
 const recent=byId("launcherRecentStrip");
 if(launcherTheme!=="windows")recent.hidden=false;
};
const folderSheet=document.createElement("div");
folderSheet.id="launcherFolderSheet";folderSheet.hidden=true;
folderSheet.setAttribute("role","dialog");folderSheet.setAttribute("aria-modal","true");
folderSheet.setAttribute("aria-label","App folders");
folderSheet.innerHTML='<div class="folder-dialog">'+
 '<div class="folder-heading"><h3 id="folderDialogTitle">App folder</h3>'+
 '<button type="button" data-folder-action="close" aria-label="Close folder">×</button></div>'+
 '<div id="folderDialogBody"></div></div>';
document.body.appendChild(folderSheet);
function closeFolder(){folderSheet.hidden=true;selectedFolder=null}
function findApp(key){return launcherApps.find(a=>launcherAppKey(a)===key)}
function folderName(id){return folders.find(f=>f.id===id)}
function folderOpen(id){
 const f=folderName(id);if(!f)return;
 selectedFolder=f.id;folderSheet.hidden=false;
 byId("folderDialogTitle").textContent=f.name;
 const body=byId("folderDialogBody");
 const items=f.keys.map(findApp).filter(Boolean);
 body.innerHTML='<p>'+items.length+" apps · Hold this folder on Home to edit its contents."+'</p>'+
 items.map(a=>'<div class="folder-item"><button type="button" data-folder-launch="'+esc(launcherAppKey(a))+'">'+
 launcherIcon(a)+' <span>'+esc(a.label)+'</span></button></div>').join("")+
 (!items.length?'<p>No apps yet. Choose Edit to add some.</p>':"")+
 '<div class="folder-actions"><button type="button" data-folder-action="edit">Edit folder</button>'+
 '<button type="button" data-folder-action="close">Close</button></div>';
}
function folderEdit(id){
 const f=folderName(id)||{id:"",name:"",keys:[]};
 selectedFolder=f.id||null;folderSheet.hidden=false;
 byId("folderDialogTitle").textContent=id?"Edit folder":"Create folder";
 const body=byId("folderDialogBody");
 body.innerHTML='<label for="folderNameInput">Folder name</label>'+
 '<input id="folderNameInput" type="text" maxlength="36" placeholder="Games, Music, Tools…" value="'+esc(f.name)+'">'+
 '<p>Search for apps to add to this folder. Selection remains saved on this phone.</p>'+
 '<input id="folderAppSearch" type="text" placeholder="Find installed apps" aria-label="Filter apps in folder chooser">'+
 '<div id="folderAppChoices" class="folder-apps"></div>'+
 '<div class="folder-actions">'+(id?'<button type="button" data-folder-action="delete">Delete folder</button>':"")+
 '<button type="button" data-folder-action="cancel">Cancel</button>'+
 '<button type="button" class="primary" data-folder-action="save">Save folder</button></div>';
 const picks=new Set(f.keys);
 body.__folderPicks=picks;
 function renderChoices(){
  const q=byId("folderAppSearch").value.toLocaleLowerCase().trim();
  const list=launcherApps.filter(a=>!q||
   (a.label+" "+a.pkg).toLocaleLowerCase().includes(q)).slice(0,220);
  byId("folderAppChoices").innerHTML=list.map(a=>{
   const k=launcherAppKey(a);
   return '<label class="folder-app-choice"><input type="checkbox" data-folder-key="'+esc(k)+
    '" '+(picks.has(k)?"checked":"")+'><span>'+esc(a.label)+'</span></label>';
  }).join("");
 }
 byId("folderAppSearch").oninput=renderChoices;
 byId("folderAppChoices").onchange=e=>{
  const key=e.target.closest("[data-folder-key]")?.dataset.folderKey;
  if(!key)return;
  if(e.target.checked)picks.add(key);else picks.delete(key);
 };
 renderChoices();byId("folderNameInput").focus();
}
folderSheet.addEventListener("click",e=>{
 if(e.target===folderSheet){closeFolder();return}
 const launch=e.target.closest("[data-folder-launch]")?.dataset.folderLaunch;
 if(launch){
  const a=findApp(launch);if(a)window.AudioDesk?.launchExternalApp?.(a.pkg,a.activity);
  closeFolder();return;
 }
 const act=e.target.closest("[data-folder-action]")?.dataset.folderAction;
 if(!act)return;
 if(act==="close"||act==="cancel"){closeFolder();return}
 if(act==="edit"){folderEdit(selectedFolder);return}
 if(act==="delete"){
  folders=folders.filter(f=>f.id!==selectedFolder);persistFolders();
  closeFolder();renderLauncherHome();return;
 }
 if(act==="save"){
  const name=byId("folderNameInput").value.trim().slice(0,36);
  if(!name){byId("folderNameInput").focus();return}
  const keys=[...byId("folderDialogBody").__folderPicks].filter(k=>!!findApp(k));
  if(selectedFolder){
   const f=folderName(selectedFolder);if(f){f.name=name;f.keys=keys}
  }else{
   folders.push({id:"folder-"+Date.now().toString(36),name,keys});
  }
  persistFolders();closeFolder();renderLauncherHome();
 }
});
byId("launcherHomePage").addEventListener("click",e=>{
 const folder=e.target.closest("[data-folder-id]");if(!folder)return;
 e.preventDefault();e.stopPropagation();
 if(Date.now()<folderCancelUntil)return;
 folderOpen(folder.dataset.folderId);
});
byId("launcherHomePage").addEventListener("pointerdown",e=>{
 const folder=e.target.closest("[data-folder-id]");
 if(!folder||e.button!==0)return;
 const id=folder.dataset.folderId;
 const x=e.clientX,y=e.clientY;
 clearTimeout(folderHeld?.timer);
 folderHeld={id,x,y,pointerId:e.pointerId,timer:setTimeout(()=>{
  folderHeld=null;folderCancelUntil=Date.now()+800;folderEdit(id);
 },560)};
});
byId("launcherHomePage").addEventListener("pointermove",e=>{
 if(!folderHeld||folderHeld.pointerId!==e.pointerId)return;
 if(Math.hypot(e.clientX-folderHeld.x,e.clientY-folderHeld.y)>10){
  clearTimeout(folderHeld.timer);folderHeld=null;
 }
});
for(const type of ["pointerup","pointercancel","pointerleave"])
 byId("launcherHomePage").addEventListener(type,()=>{
  if(folderHeld){clearTimeout(folderHeld.timer);folderHeld=null}
 });

/* Folder creation and mode settings live in the same quick-actions sheet. */
const quick=byId("launcherOptionsSheet");
const folderCreate=document.createElement("button");
folderCreate.id="launcherFolderCreate";folderCreate.type="button";
folderCreate.className="launcher-options-action";folderCreate.textContent="Create app folder";
const choice=document.createElement("label");choice.id="glassStyleControl";
choice.innerHTML='<span>Widget appearance</span>'+
 '<select id="launcherGlassMode" aria-label="Widget transparency">'+
 '<option value="opaque">Opaque</option>'+
 '<option value="liquid">Liquid Glass</option>'+
 '<option value="aero">Aero Glass</option>'+
 '<option value="mica">Windows 11 Mica</option></select>';
byId("launcherFavoritesEdit").after(folderCreate,choice);
folderCreate.onclick=()=>{closeHomeOptions(true);folderEdit(null)};
function glassApply(){
 const saved=deskStorage.getItem(glassKey())||"opaque";
 document.body.dataset.glassMode=["opaque","liquid","aero","mica"].includes(saved)?saved:"opaque";
 byId("launcherGlassMode").value=document.body.dataset.glassMode;
}
byId("launcherGlassMode").onchange=e=>{
 deskStorage.setItem(glassKey(),e.target.value);glassApply();
};
const oldTheme=setLauncherTheme;
setLauncherTheme=function(theme){
 oldTheme(theme);glassApply();
};
glassApply();

/* List view remains default. The user can switch to a compact, readable grid. */
let appsLayout=deskStorage.getItem(gridKey)==="grid"?"grid":"list";
const controls=document.createElement("div");
controls.id="appsLayoutControls";controls.setAttribute("role","group");
controls.setAttribute("aria-label","App list layout");
controls.innerHTML='<button type="button" data-apps-layout="list">☰ List</button>'+
 '<button type="button" data-apps-layout="grid">▦ Grid</button>';
byId("launcherAppSearch").before(controls);
function updateGrid(){
 document.body.dataset.appLayout=appsLayout;
 for(const b of controls.querySelectorAll("button"))
  b.setAttribute("aria-pressed",String(b.dataset.appsLayout===appsLayout));
}
controls.onclick=e=>{
 const mode=e.target.closest("[data-apps-layout]")?.dataset.appsLayout;
 if(mode!=="grid"&&mode!=="list")return;
 appsLayout=mode;deskStorage.setItem(gridKey,mode);updateGrid();
};
updateGrid();

/* Hold an installed app anywhere to see genuine Android management links.
   Android Settings owns cache clearing / force-stop; neither is done silently. */
const manager=document.createElement("div");
manager.id="appManageSheet";manager.hidden=true;
manager.setAttribute("role","dialog");manager.setAttribute("aria-modal","true");
manager.setAttribute("aria-label","App management");
manager.innerHTML='<div class="app-manage-card">'+
 '<div class="folder-heading"><h3 id="appManageTitle">App settings</h3>'+
 '<button type="button" data-manage="close" aria-label="Close app management">×</button></div>'+
 '<p>Android system settings are required for storage and force-stop controls.</p>'+
 '<div class="manage-actions">'+
 '<button type="button" data-manage="info">App info</button>'+
 '<button type="button" data-manage="storage">Storage & clear cache</button>'+
 '<button type="button" data-manage="force-stop">Force stop (Settings)</button>'+
 '<button type="button" data-manage="settings">App settings</button></div></div>';
document.body.appendChild(manager);
let managed=null;
function appManage(pkg,activity){
 managed=launcherApps.find(a=>a.pkg===pkg&&a.activity===activity)||
  launcherRecents.find(a=>a.pkg===pkg&&a.activity===activity);
 if(!managed)return;
 byId("appManageTitle").textContent=managed.label;
 manager.hidden=false;
}
function closeManage(){manager.hidden=true;managed=null}
manager.onclick=e=>{
 if(e.target===manager){closeManage();return}
 const action=e.target.closest("[data-manage]")?.dataset.manage;
 if(!action)return;
 if(action==="close"){closeManage();return}
 if(!managed)return;
 window.AudioDesk?.openAppSettings?.(managed.pkg,action);
 closeManage();
};
document.addEventListener("pointerdown",e=>{
 const a=e.target.closest("#launcherAppsGrid .launcher-app,#launcherFavorites .launcher-app,#launcherRecentQuick .launcher-app");
 if(!a||e.button!==0||!manager.hidden)return;
 clearTimeout(appHeld?.timer);
 const {clientX:x,clientY:y,pointerId}=e;
 appHeld={pkg:a.dataset.launchPkg,activity:a.dataset.launchActivity,x,y,pointerId,
  timer:setTimeout(()=>{
   if(!appHeld)return;
   const h=appHeld;appHeld=null;
   clickBlockedUntil=Date.now()+850;
   // Suppress the native app-open tap after the long press.
   blockAppClickUntil=Date.now()+850;
   appManage(h.pkg,h.activity);
  },560)};
},true);
document.addEventListener("pointermove",e=>{
 if(!appHeld||appHeld.pointerId!==e.pointerId)return;
 if(Math.hypot(e.clientX-appHeld.x,e.clientY-appHeld.y)>12){
  clearTimeout(appHeld.timer);appHeld=null;
 }
},true);
for(const ev of ["pointerup","pointercancel"])
 document.addEventListener(ev,()=>{if(appHeld){clearTimeout(appHeld.timer);appHeld=null}},true);
document.addEventListener("click",e=>{
 if(Date.now()<clickBlockedUntil&&e.target.closest(".launcher-app")){
  e.preventDefault();e.stopImmediatePropagation();
 }
},true);
document.addEventListener("keydown",e=>{
 if(e.key==="Escape"){
  if(!folderSheet.hidden)closeFolder();
  if(!manager.hidden)closeManage();
 }
},true);
window.addEventListener("launcher-page-changed",()=>{closeFolder();closeManage()});
/* Expose a small debug/test API; no sensitive native data. */
window.audioDeskFolderCreate=()=>folderEdit(null);
window.audioDeskSetAppLayout=mode=>{if(["grid","list"].includes(mode)){appsLayout=mode;deskStorage.setItem(gridKey,mode);updateGrid()}};
renderLauncherHome();
})();
