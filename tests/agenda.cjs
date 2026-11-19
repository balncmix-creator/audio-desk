const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const serve=require('./serve-assets.cjs');
const origin='https://appassets.androidplatform.net/assets/';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:393,height:852},hasTouch:true,isMobile:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.agendaRequests=0;window.agendaPermissionRequests=0;window.openedAgenda=[];window.createdAgenda=[];
   window.AudioDesk={
    requestAgenda(){window.agendaRequests++;window.receiveAudioDeskAgenda?.({state:'permission'})},
    enableAgenda(){window.agendaPermissionRequests++},
    openAgendaEvent(...args){window.openedAgenda.push(args)},
    newAgendaEvent(begin){window.createdAgenda.push(begin)},
    requestLauncherApps(){window.receiveLauncherApps?.([],[],true)},
    requestMediaState(){},setStatusBarTheme(){},setWallpaperTone(){},setRefreshEnabled(){},isDefaultLauncher(){return true}
   };
  });
  await page.route('**/*',route=>{
   const u=route.request().url();
   if(u===origin+'index.html')return route.fulfill({contentType:'text/html',body:fs.readFileSync('app/src/main/assets/index.html')});
   const local=serve(route);if(local)return local;
   if(u.includes('github.com')||u.includes('rss2json.com'))return route.fulfill({json:{status:'ok',items:[]}});
   return route.abort();
  });
  await page.goto(origin+'index.html');
  await page.waitForFunction(()=>!!window.audioDeskAgenda);
  const widget=page.locator('#launcherAgendaWidget');
  assert.equal(await widget.isVisible(),true);
  assert.equal(await page.evaluate(()=>window.agendaPermissionRequests),0,'no unsolicited calendar permission prompt');
  await widget.locator('.agenda-permission').click();
  assert.equal(await page.evaluate(()=>window.agendaPermissionRequests),1);
  const data=await page.evaluate(()=>{
   const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);tomorrow.setHours(14,0,0,0);
   const next=new Date(tomorrow);next.setDate(next.getDate()+2);
   const utc=Date.UTC(next.getFullYear(),next.getMonth(),next.getDate());
   return [{id:'11',begin:+tomorrow,end:+tomorrow+3600000,title:'Studio session',allDay:false,location:'Studio A',color:'#42aaff'},
    {id:'12',begin:+next,end:+next+7200000,title:'Mix review',allDay:false,location:'',color:'#dd8833'},
    {id:'13',begin:utc,end:utc+86400000,title:'Birthday',allDay:true,location:'',color:'#ffffff'}];
  });
  await page.evaluate(data=>{
   window.AudioDesk.requestAgenda=()=>{window.agendaRequests++;window.receiveAudioDeskAgenda({state:'ready',events:data})};
   window.AudioDesk.requestAgenda();
  },data);
  assert.match(await widget.locator('.agenda-event-title').textContent(),/Studio session/);
  await page.locator('#agendaNext').click();
  assert.match(await widget.locator('.agenda-event-title').textContent(),/Birthday|Mix review/);
  await page.locator('#agendaOpen').click();
  const dialog=page.locator('#agendaOverlay');
  assert.equal(await dialog.isVisible(),true);
  assert.match(await dialog.textContent(),/Studio A/);
  assert.match(await dialog.textContent(),/Tomorrow/);
  assert.match(await dialog.textContent(),/All day/);
  await dialog.getByRole('button',{name:'Pin Mix review',exact:true}).click();
  assert.match(await dialog.locator('.agenda-date-heading').first().textContent(),/Pinned events/);
  assert.equal((await page.evaluate(()=>window.audioDeskAgenda.pins())).length,1);
  await dialog.locator('.agenda-event-body').filter({hasText:'Mix review'}).click();
  assert.equal((await page.evaluate(()=>window.openedAgenda)).at(-1)[0],'12');
  await page.locator('#agendaAdd').click();
  assert.equal((await page.evaluate(()=>window.createdAgenda)).length,1);
  await page.evaluate(()=>window.launcherBack());
  assert.equal(await dialog.isVisible(),false);
  for(const theme of ['minimal','warm','pixel','windows']){
   await page.evaluate(theme=>setLauncherTheme(theme),theme);
   assert.equal(await widget.isVisible(),true,theme+' agenda visible');
   assert.equal(await widget.getAttribute('data-widget-resizable'),'true');
   const fit=await widget.evaluate(el=>{
    const b=el.getBoundingClientRect(),n=el.querySelector('.agenda-widget-nav').getBoundingClientRect();
    return b.width>150&&b.right<=innerWidth+1&&n.bottom<=b.bottom+1;
   });
   assert.ok(fit,theme+' widget controls remain inside bounds');
  }
  assert.equal(await page.evaluate(()=>window.audioDeskBeginWidgetResize('launcherAgendaWidget')),true);
  await page.locator('#widgetLayoutOverlay [data-layout-control="done"]').click();
  await page.locator('#launcherSettingsToggle').click();
  await page.locator('#agendaWidgetVisibility').click();
  assert.equal(await widget.isVisible(),false);
  await page.locator('#agendaWidgetVisibility').click();
  assert.equal(await widget.isVisible(),true);
  await page.locator('#launcherOptionsClose').click();
  // Remove via long-press editor, restore without deleting event pins, and
  // verify the preference is isolated to the selected theme.
  assert.equal(await page.evaluate(()=>window.audioDeskBeginWidgetResize('launcherAgendaWidget')),true);
  await page.locator('#widgetLayoutOverlay [data-layout-control="remove"]').click();
  assert.equal(await widget.isVisible(),false);
  await page.evaluate(()=>setLauncherTheme('minimal'));
  assert.equal(await widget.isVisible(),true,'removal is specific to the edited theme');
  await page.evaluate(()=>setLauncherTheme('windows'));
  assert.equal(await widget.isVisible(),false,'returning to the theme retains removal');
  await page.reload();await page.waitForFunction(()=>!!window.audioDeskAgenda);
  assert.equal(await widget.isVisible(),false,'removed state survives restart');
  await page.locator('#launcherSettingsToggle').click();
  await page.locator('#widgetRestoreToggle').click();
  await page.locator('[data-restore-widget="launcherAgendaWidget"]').click();
  assert.equal(await widget.isVisible(),true,'restore works without changing calendar pins');
  await page.locator('#launcherOptionsClose').click();
  await page.reload();await page.waitForFunction(()=>!!window.audioDeskAgenda);
  assert.equal((await page.evaluate(()=>window.audioDeskAgenda.pins())).length,1,'pin persists');
  await page.evaluate(()=>window.receiveAudioDeskAgenda({state:'permission'}));
  assert.equal(await widget.locator('.agenda-event-title').count(),0,'revoking permission clears private events');
  assert.deepEqual(errors,[]);
  console.log('PASS: calendar consent, grouped agenda, event pinning, carousel, native actions, four themes, resize and persistence');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
