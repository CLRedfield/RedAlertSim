"""Exercise the shipped UI with actual keyboard/pointer input and a running Worker.
A deterministic sandbox save only supplies each fixture; controls remain unmodified.
Requires Playwright, headed Chromium and DISPLAY. No remote downloads.
"""
from pathlib import Path
import json, os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
completed=False;checks=[]; errors=[]
def record(s):
 print('PASS',s,flush=True);checks.append(s)
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'),headless=False,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
 p=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
 p.set_default_timeout(7000)
 p.on('pageerror',lambda e:errors.append(str(e)))
 p.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 try:
  p.set_content((ROOT/'PLAY.html').read_text(),wait_until='load');p.wait_for_function('!!RA.app.renderer')
  p.evaluate("RA.app.applyViewPreferences({quality:'low'})")
  assert p.locator('#fog-mode option').count()==3
  p.evaluate("RA.app.showPage('sandbox')");p.select_option('#fog-mode','double');p.click('#launch');p.wait_for_function('RA.app.state?.tick>3')
  assert p.evaluate('RA.app.state.cfg.fogMode')=='double'
  record('Setup exposes all three fog modes and starts the selected mode in the Worker')
  def fixture():
   p.evaluate("""(()=>{
    const s=new RA.Sim({players:2,sandbox:true,map:'basin',fogMode:'none'});s.entities=[];s.ores=[];s.effects=[];
    const h=s.spawn('a_hq',0,40,122);s.spawn('a_power',0,30,126);s.spawn('a_barracks',0,49,123);
    const a=s.spawn('a_factory',0,60,122),b=s.spawn('a_factory',0,72,122);s.spawn('a_airfield',0,40,136);
    const t=s.spawn('grizzly',0,57,103,{cooldown:1000}),u=s.spawn('grizzly',0,61,103,{cooldown:1000});
    s.spawn('grizzly',0,165,160);s.spawn('s_hq',1,165,30);s.reindex();s.rebuildGrid();s.updatePower();s.updateFog();
    s.players[0].readySlots.building={type:'a_power',cost:800};s.players[0].readySlots.defense={type:'a_pillbox',cost:500};s.syncReady(s.players[0]);
    window.fixtureIds={tank:t.id,other:u.id,factory:a.id,factory2:b.id,hq:h.id};RA.app.loadSave(JSON.parse(JSON.stringify(s.save())));
   })()""")
   p.wait_for_function("RA.app.state?.cfg.map==='basin'&&RA.app.state.entities.some(e=>e.id===fixtureIds.tank&&e.type==='grizzly')")
   p.wait_for_timeout(300)
   p.evaluate("RA.app.worker.postMessage({type:'speed',speed:1});RA.app.edge=false;RA.app.renderer.setQuality('low');RA.app.renderer.target={x:61,z:116};RA.app.selected=new Set([fixtureIds.tank]);document.activeElement.blur();")
   camera_settled()
  def camera_settled():
   p.wait_for_function("(()=>{const r=RA.app.renderer,c=r.project(r.target.x,0,r.target.z);return Math.abs(c.x-r.width/2)<.6&&Math.abs(c.y-r.height/2)<.6})()",timeout=12000)
  def at(x,z):
   camera_settled()
   pt=p.evaluate('([x,z])=>RA.app.renderer.project(x,0,z)',[x,z]);box=p.locator('#world').bounding_box();return(pt['x']+box['x'],pt['y']+box['y'])
  def ground(x,z,button='left'):
   p.mouse.click(*at(x,z),button=button)
  def entity(which,clicks=1):
   camera_settled()  # wait for rendered camera state, rather than assuming a GPU frame time
   pos=p.evaluate("which=>{const e=RA.app.state.entities.find(e=>e.id===fixtureIds[which]);return RA.app.renderer.project(e.x,1.3,e.z)}",which);box=p.locator('#world').bounding_box();p.mouse.click(pos['x']+box['x'],pos['y']+box['y'],click_count=clicks,delay=80 if clicks>1 else 0)
  fixture()
  p.keyboard.press('F4');first=p.evaluate('[...RA.app.selected][0]');p.keyboard.press('F4');second=p.evaluate('[...RA.app.selected][0]');assert first!=second
  assert p.evaluate('[fixtureIds.factory,fixtureIds.factory2].includes([...RA.app.selected][0])')
  p.keyboard.press('k');p.wait_for_function('RA.app.state.p.primary.factory===[...RA.app.selected][0]')
  record('F4 cycles and focuses existing factories; K switches the authoritative primary factory')
  p.keyboard.press('q');assert p.evaluate('RA.app.cursor?.unit')=='a_power'
  p.mouse.move(*at(64,139));p.wait_for_timeout(220);placement=p.evaluate('RA.app.placement()');assert placement['valid'],placement
  assert len(placement['cells'])==9
  p.screenshot(timeout=30000,path=str(ROOT/'docs/screenshots/04_grid_placement.png'))
  p.mouse.click(*at(64,139));p.wait_for_function('RA.app.state.p.readySlots.building===null')
  assert p.evaluate("RA.app.state.entities.some(e=>e.type==='a_power'&&e.x===65&&e.z===139)")
  p.keyboard.press('w');assert p.evaluate('RA.app.cursor?.unit')=='a_pillbox'
  p.keyboard.press('Escape');assert p.evaluate('RA.app.cursor') is None
  record('Q/W pick ready buildings; cell preview and actual placement use identical grid snapping')
  # Overlay toggles and a blocked preview are real rendering paths.
  p.keyboard.press('F9');assert p.evaluate('RA.app.showGrid')
  p.keyboard.press('F10');assert p.evaluate('RA.app.showHealth')
  p.keyboard.press('F8');assert not p.evaluate('RA.app.showOrders');p.keyboard.press('F8')
  p.keyboard.press('w');p.mouse.move(*at(60,122));p.wait_for_timeout(150);assert not p.evaluate('RA.app.placement().valid');p.keyboard.press('Escape')
  record('Grid, health and order overlay toggles work; occupied foundations display an invalid preview')
  fixture()
  # Held path planning: no simulation command before key release.
  before=p.evaluate('(()=>{const e=RA.app.state.entities.find(e=>e.id===fixtureIds.tank);return[e.x,e.z]})()')
  p.keyboard.down('z');ground(77,103);ground(77,89);p.wait_for_timeout(500)
  assert p.evaluate('RA.app.plan.orders.length')==2
  assert p.evaluate('(()=>{const e=RA.app.state.entities.find(e=>e.id===fixtureIds.tank);return[e.x,e.z]})()')==before
  assert p.evaluate('RA.app.state.entities.find(e=>e.id===fixtureIds.tank).order') is None
  p.screenshot(timeout=30000,path=str(ROOT/'docs/screenshots/05_waypoint_planning.png'))
  p.keyboard.up('z');p.wait_for_function('RA.app.state.entities.find(e=>e.id===fixtureIds.tank).orderQueue.length===1')
  p.wait_for_function('RA.app.state.entities.find(e=>e.id===fixtureIds.tank).x>60')
  assert p.evaluate('RA.app.plan') is None
  record('Holding Z draws two numbered waypoints without moving; key release submits the real route')
  p.keyboard.down('Shift');ground(64,89);p.keyboard.up('Shift');p.wait_for_function('RA.app.state.entities.find(e=>e.id===fixtureIds.tank).orderQueue.length>=2')
  p.keyboard.press('s');p.wait_for_function('RA.app.state.entities.find(e=>e.id===fixtureIds.tank).stopped')
  assert p.evaluate('RA.app.state.entities.find(e=>e.id===fixtureIds.tank).orderQueue.length')==0
  record('Shift-click appends movement and S cancels every pending waypoint')
  p.click('#waypoint-tool');ground(74,98);ground(72,92);p.keyboard.press('Backspace');assert p.evaluate('RA.app.plan.orders.length')==1
  p.keyboard.press('Escape');assert p.evaluate('RA.app.plan') is None
  p.click('#waypoint-tool');ground(74,98);ground(72,92);p.keyboard.press('Enter');p.wait_for_function('RA.app.state.entities.find(e=>e.id===fixtureIds.tank).orderQueue.length===1')
  p.keyboard.press('s');p.wait_for_function('RA.app.state.entities.find(e=>e.id===fixtureIds.tank).stopped')
  record('Persistent waypoint tool supports undo, cancel and Enter confirmation')
  fixture()
  # Double-click same type and numbered control-group commands.
  p.evaluate('RA.app.selected.clear()');entity('tank',2);assert p.evaluate('RA.app.selected.size')==2
  p.keyboard.press('Control+1');p.evaluate('RA.app.selected.clear()');p.keyboard.press('1');assert p.evaluate('RA.app.selected.size')==2
  p.evaluate('RA.app.renderer.target={x:140,z:140}');p.keyboard.press('1');assert p.evaluate('RA.app.renderer.target.x')<80
  p.keyboard.press('t');p.keyboard.press('t');assert p.evaluate('RA.app.selected.size')==3
  record('Double-click selects visible same-type units; control groups, double-tap focus and global T selection work')
  fixture()
  # Repeated DOM keydown must not accidentally cycle twice.
  p.keyboard.press('F4');selected=p.evaluate('[...RA.app.selected][0]')
  p.evaluate("window.dispatchEvent(new KeyboardEvent('keydown',{code:'F4',key:'F4',repeat:true,bubbles:true,cancelable:true}))")
  assert p.evaluate('[...RA.app.selected][0]')==selected
  entity('factory2',2);p.wait_for_function('RA.app.state.p.primary.factory===fixtureIds.factory2')
  record('Held-key repeat does not cycle buildings repeatedly; double-click sets primary production')
  # A short GI order exercises the numbered hotkey; a longer real Tanya order
  # makes the pause/resume lifecycle independent of software-GPU click latency.
  p.evaluate("RA.app.worker.postMessage({type:'speed',speed:.25})");p.keyboard.press('e');p.keyboard.press('Alt+1');p.wait_for_function('RA.app.state.p.queues.infantry.length===1')
  p.wait_for_function("RA.app.state.entities.some(e=>e.owner===0&&e.type==='gi')",timeout=14000)
  p.locator('[data-unit="tanya"]').click();p.wait_for_function("RA.app.state.p.queues.infantry[0]?.type==='tanya'")
  p.locator('[data-unit="tanya"]').click(button='right');p.wait_for_function('RA.app.state.p.queues.infantry[0]?.paused')
  progress=p.evaluate('RA.app.state.p.queues.infantry[0].progress');p.wait_for_timeout(450);assert p.evaluate('RA.app.state.p.queues.infantry[0].progress')==progress
  p.locator('[data-unit="tanya"]').click();p.wait_for_function('RA.app.state.p.queues.infantry[0]?.paused===false')
  p.locator('[data-unit="tanya"]').click(button='right');p.wait_for_function('RA.app.state.p.queues.infantry[0]?.paused')
  p.locator('[data-unit="tanya"]').click(button='right');p.wait_for_function('RA.app.state.p.queues.infantry.length===0')
  record('E and Alt+1 initiate GI production; Tanya card pauses, resumes and cancels using real right/left clicks')
  # Map command should not just pan the camera.
  fixture();p.keyboard.press('a');mini=p.locator('#minimap').bounding_box();p.mouse.click(mini['x']+mini['width']*.45,mini['y']+mini['height']*.55)
  p.wait_for_function("RA.app.state.entities.find(e=>e.id===fixtureIds.tank).order?.type==='attackMove'")
  p.keyboard.press('s');record('Attack-move can be issued from the radar minimap')
  # Real keyboard rebinding, no fixture modification of hotkey map.
  p.click('#pause-btn');p.click('#hotkeys-open');p.locator('[data-action="factory"]').click();p.keyboard.press('b');assert p.evaluate('RA.app.hotkeys.factory')=='KeyB'
  p.keyboard.press('Escape');p.click('#resume');p.keyboard.press('b');assert p.evaluate('RA.D[RA.app.state.entities.find(e=>e.id===[...RA.app.selected][0]).type].role')=='factory'
  p.click('#pause-btn');p.click('#hotkeys-open');p.screenshot(timeout=30000,path=str(ROOT/'docs/screenshots/06_hotkeys.png'));p.click('#hotkeys-reset');assert p.evaluate('RA.app.hotkeys.factory')=='F4';p.keyboard.press('Escape')
  record('Keyboard settings rebind an actual building shortcut and restore all defaults')
  for mode in ['double','single','none']:
   p.select_option('#ingame-fog',mode);p.wait_for_function('mode=>RA.app.state.cfg.fogMode===mode',arg=mode)
  p.click('#resume');assert p.locator('#fog-badge').inner_text()=='无迷雾'
  record('Single-player pause menu changes all three fog rules in the simulation, not only in the renderer')
  # Alt must drive the actual unit through the infantry, not merely change the cursor.
  fixture();p.evaluate("RA.app.command({type:'sandbox',action:'spawn',unit:'conscript',owner:1,count:1,x:69,z:103})")
  p.wait_for_function("RA.app.state.entities.some(e=>e.type==='conscript'&&e.owner===1)")
  victim=p.evaluate("RA.app.state.entities.find(e=>e.type==='conscript'&&e.owner===1).id")
  p.keyboard.down('Alt');ground(79,103);p.keyboard.up('Alt')
  p.wait_for_function("RA.app.state.entities.find(e=>e.id===fixtureIds.tank).order?.type==='forceMove'")
  p.wait_for_function("id=>!RA.app.state.entities.some(e=>e.id===id)",arg=victim,timeout=12000)
  assert p.evaluate('RA.app.state.p.kills')==1
  record('Alt plus real world click produces force-movement and crushes enemy infantry in the Worker')
  assert not errors,errors
  assert p.evaluate('RA.app.renderer.gl.getError()')==0
  record('Operational UI completed without JavaScript exceptions or WebGL errors')
  completed=True
 except Exception:
  print('STATE AT FAILURE',p.evaluate("({tick:RA.app.state?.tick,queues:RA.app.state?.p.queues,tab:RA.app.tab,cursor:RA.app.cursor,selected:[...RA.app.selected],primary:RA.app.state?.p.primary,ids:window.fixtureIds})"),flush=True)
  raise
 finally:
  if errors:print('ERRORS',errors,flush=True)
  (ROOT/'tests/browser-operations-results.json').write_text(json.dumps({'version':'1.0.0','date':'2026-09-12','completed':completed,'passed':len(checks),'checks':checks,'errors':errors,'environment':'Chromium 144 / Xvfb / ANGLE SwiftShader. Fixture saves, real keyboard+pointer+Worker execution. No physical GPU or Windows test.'},ensure_ascii=False,indent=2))
  browser.close()
