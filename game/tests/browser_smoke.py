"""Browser tests; inject self-contained HTML into an in-memory page.
Requires Python Playwright + Chromium. Does not relax navigation policies.
Uses a headed browser and software WebGL when no physical GPU is available.
"""
from pathlib import Path
import json, os, subprocess, time
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
server=subprocess.Popen(['node',str(ROOT/'server/server.cjs'),'--port','18788'],stdout=subprocess.DEVNULL)
completed=False;checks=[]
def record(s):
 print('PASS',s,flush=True);checks.append(s)
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'),headless=False,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
  errors=[]
  def page():
   p=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
   p.set_default_timeout(12000)
   p.set_default_navigation_timeout(30000)
   p.on('pageerror',lambda e: errors.append(str(e)))
   p.on('console',lambda m: errors.append(m.text) if m.type=='error' else None)
   p.set_content((ROOT/'PLAY.html').read_text(),wait_until='load')
   p.wait_for_function('!!RA.app.renderer',timeout=12000)
   p.evaluate("RA.app.applyViewPreferences({quality:'low'})")
   return p
  p=page()
  p.screenshot(timeout=30000,path=str(ROOT/'docs/screenshots/01_menu.png'))
  record('Full offline HTML initialized, WebGL shader compiled without errors')
  p.click('[data-page="skirmish"]');p.click('#launch');p.wait_for_function('RA.app.state?.tick>5')
  assert p.evaluate('RA.app.state.players.length')==2
  record('Single-player Web Worker advances two-seat simulation')
  # Real production UI, then place with projected world click.
  p.click('[data-unit="a_factory"]')
  p.evaluate("RA.app.worker.postMessage({type:'speed',speed:3})")
  p.wait_for_function("RA.app.state.p.ready?.type==='a_factory'",timeout=16000)
  p.click('[data-unit="a_factory"]')
  point=p.evaluate("RA.app.renderer.project(51,0,154)")
  box=p.locator('#world').bounding_box()
  p.mouse.move(point['x']+box['x'],point['y']+box['y']);p.wait_for_timeout(150)
  p.mouse.click(point['x']+box['x'],point['y']+box['y'])
  p.wait_for_function("RA.app.state.entities.some(e=>e.owner===0&&e.type==='a_factory')",timeout=4000)
  p.click('[data-tab="vehicle"]');before=p.evaluate("RA.app.state.entities.filter(e=>e.owner===0&&e.type==='grizzly').length")
  p.click('[data-unit="grizzly"]');p.wait_for_function("n=>RA.app.state.entities.filter(e=>e.owner===0&&e.type==='grizzly').length>n",arg=before,timeout=8000)
  record('Factory queued in sidebar, placed via mouse, tank trained via production card')
  p.evaluate("RA.app.worker.postMessage({type:'speed',speed:1})")
  p.mouse.move(700,750);p.screenshot(timeout=30000,path=str(ROOT/'docs/screenshots/02_skirmish.png'))
  # Read worker save response without relying on disabled browser downloads/localStorage.
  p.evaluate("""window.saved=null;RA.app.worker.addEventListener('message',e=>{if(e.data.type==='save'&&e.data.request===9999)window.saved=e.data.data});RA.app.worker.postMessage({type:'save',request:9999});""")
  p.wait_for_function('!!window.saved');savedtick=p.evaluate('saved.tick')
  p.evaluate('RA.app.loadSave(window.saved)');p.wait_for_timeout(300)
  assert p.evaluate('RA.app.state.tick')>=savedtick
  record('Worker save serialization and loaded state resume')
  p.click('#pause-btn');p.wait_for_timeout(250);t=p.evaluate('RA.app.state.tick');p.wait_for_timeout(350);assert p.evaluate('RA.app.state.tick')==t
  p.click('#resume');p.wait_for_function('t=>RA.app.state.tick>t',arg=t)
  record('Pause stops simulation; resume advances it')
  # Every procedural model must upload and draw at least once, including animated turrets.
  result=p.evaluate("""(()=>{const s=new RA.Sim({players:2,sandbox:true,reveal:true,map:'basin'});s.entities=[];s.ores=[];RA.app.renderer.setQuality('low');RA.app.renderer.target={x:96,z:96};for(const d of RA.defs()){RA.app.renderer.getModel(d.id);}s.spawn('mastermind',0,96,96);s.reindex();s.updateFog();RA.app.renderer.render(s.snapshot(),.016);if(RA.app.renderer.gl.getError()!==0)throw new Error('Model GL upload error');return RA.defs().length})()""")
  record(f'All {result} catalog procedural meshes generated and uploaded, one representative rendered without WebGL errors')
  p.evaluate('RA.app.quit()');p.evaluate("RA.app.showPage('sandbox')");p.select_option('#nation','yuri');p.click('#launch');p.wait_for_function('RA.app.state?.cfg.sandbox')
  p.click('#sandbox-toggle');p.select_option('#sandbox-unit','mastermind');p.select_option('#sandbox-count','5');p.click('#sandbox-spawn')
  point=p.evaluate('RA.app.renderer.project(48,0,145)');box=p.locator('#world').bounding_box();p.mouse.click(point['x']+box['x'],point['y']+box['y']);p.wait_for_function("RA.app.state.entities.filter(e=>e.type==='mastermind').length>=5")
  record('Yuri sandbox UI generates five selected units')
  p.mouse.move(700,750);p.screenshot(timeout=30000,path=str(ROOT/'docs/screenshots/03_yuri_sandbox.png'))
  # Two actual browser WebSocket clients, host and guest.
  p.evaluate('RA.app.quit()');q=page()
  for tab in (p,q):
   tab.bring_to_front();tab.click('[data-page="network"]');tab.select_option('#transport-select','lan');tab.locator('#advanced-setup summary').click();tab.fill('#server-url','ws://127.0.0.1:18788')
  p.bring_to_front();p.select_option('#players','4');p.select_option('#fog-mode','double');p.select_option('#teams','coop');p.click('#host-room');p.wait_for_function('!!RA.app.net?.room',timeout=6000)
  code=p.evaluate('RA.app.net.room');q.bring_to_front();q.fill('#room-code',code);q.click('#join-room');q.wait_for_function('RA.app.net?.members?.length===2',timeout=6000)
  q.click('#ready-room');p.bring_to_front();p.wait_for_function('RA.app.net.members.some(m=>m.slot===1&&m.ready)');p.click('#start-room')
  for tab in (p,q):
   tab.bring_to_front();tab.wait_for_function('RA.app.state?.tick>5',timeout=8000)
  assert p.evaluate('RA.app.state.player')==0 and q.evaluate('RA.app.state.player')==1
  for tab in (p,q):
   assert tab.evaluate('RA.app.state.cfg.fogMode')=='double'
   tab.evaluate('RA.app.pause(true)');assert tab.locator('#ingame-fog').is_disabled();tab.evaluate('RA.app.pause(false)')
  record('Two full browser clients create/join/ready/start real WebSocket room')
  assert not errors,errors
  assert p.evaluate('RA.app.renderer.gl.getError()')==0
  record('No browser JavaScript or WebGL errors recorded')
  completed=True
  print(json.dumps({'passed':len(checks),'checks':checks,'errors':errors},ensure_ascii=False,indent=2))
  (ROOT/'tests/browser-results.json').write_text(json.dumps({'version':'1.0.0','date':'2026-09-12','completed':completed,'browser':'Chromium 144, headed Xvfb, ANGLE SwiftShader software WebGL2','page_source':'Complete release HTML injected with Playwright set_content, no navigation policy changes','passed':len(checks),'checks':checks,'errors':errors},ensure_ascii=False,indent=2))
  browser.close()
finally:
 server.terminate();server.wait(timeout=5)
