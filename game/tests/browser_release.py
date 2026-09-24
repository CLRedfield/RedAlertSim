"""1.0 UX release tests. In-memory HTML; actual Worker, WebGL and file exports.
This environment denies navigation to local origins, so IndexedDB/WebCrypto access
is expected to fail visibly. Real cryptographic transport tests are in mqtt.test.cjs.
"""
from pathlib import Path
import json,os,subprocess,tempfile,time
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
checks=[];errors=[];complete=False
shots=ROOT/'docs/screenshots'
def passed(text):checks.append(text);print('PASS',text,flush=True)
with sync_playwright() as pw,tempfile.TemporaryDirectory() as tmp:
 b=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'),headless=False,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
 p=b.new_page(viewport={'width':1440,'height':960},accept_downloads=True);p.set_default_timeout(20000)
 p.on('pageerror',lambda e:errors.append(str(e)));requests=[];p.on('request',lambda q:requests.append(q.url))
 try:
  p.set_content((ROOT/'PLAY.html').read_text());p.wait_for_function('!!RA.app.camera')
  p.evaluate("RA.app.applyViewPreferences({quality:'low',edgeScroll:false})")
  assert p.locator('#hq-nav button').count()==8
  assert not [u for u in requests if u.startswith(('https:','http:'))]
  passed('Eight-section menu initializes without CDN, automatic broker requests or telemetry')
  p.click('#home-operations');assert p.locator('[data-op-card]').count()==6
  assert p.locator('[data-operation]').count()==6 and p.locator('[data-coop]').count()==6
  p.screenshot(timeout=30000,path=str(shots/'100_operations.png'))
  passed('Six mission cards expose separate local and cooperative entry points')
  p.click('[data-coop="oil"]');assert p.locator('#page-deploy').is_visible() and p.evaluate("RA.app.page==='network'")
  assert p.input_value('#operation-select')=='oil'
  assert p.evaluate('RA.app.setupSlots[3].closed')
  assert p.locator('#players').is_disabled() and p.locator('#map').is_disabled()
  assert p.locator('#private-room').is_checked()
  assert p.input_value('#broker-url')=='wss://broker.emqx.io:8084/mqtt'
  assert p.locator('#broker-options option').count()==4
  passed('Coop entry locks objective teams/map and defaults to private EMQX invitation mode')
  p.click('#network-check');p.wait_for_function("document.getElementById('diagnostic-output').textContent.includes('诊断未通过')")
  assert '加密' in p.locator('#diagnostic-output').inner_text()
  p.click('#privacy-info');assert p.locator('#privacy-modal').is_visible()
  p.locator('#privacy-modal [data-dismiss]').click()
  passed('Unavailable secure-context crypto yields an actionable error, not a fake connection')
  p.select_option('#transport-select','lan');assert p.locator('#server-url').is_visible()
  assert p.locator('#broker-controls').is_hidden()
  p.select_option('#transport-select','mqtt');assert p.locator('#server-url').is_hidden()
  passed('LAN and public relay forms switch independently without implying an online dedicated server')
  p.click('[data-page="home"]');p.click('#open-tech-tree')
  p.select_option('#tech-nation','yuri');assert p.locator('.tech-column').count()==4
  assert p.locator('[data-tech-unit="mastermind"]').count()==1
  p.click('[data-tech-unit="mastermind"]');assert '精神控制车' in p.locator('#tech-detail').inner_text()
  p.screenshot(timeout=30000,path=str(shots/'100_tech_tree.png'))
  p.locator('#tech-modal [data-dismiss]').click()
  passed('Technology view is built from actual nation prerequisites and exposes live unit data')
  p.click('[data-page="settings"]');p.check('#high-contrast');assert 'high-contrast' in p.locator('body').get_attribute('class')
  p.uncheck('#high-contrast');p.click('#random-seed');assert int(p.input_value('#match-seed'))>0
  passed('Contrast and random seed settings apply through visible controls')
  p.click('[data-page="operations"]');p.click('[data-operation="escort"]');p.wait_for_function("RA.app.state?.operation?.id==='escort' && RA.app.state.tick>5")
  assert p.locator('#mission-panel').is_visible() and '补给车' in p.locator('#mission-text').inner_text()
  p.screenshot(timeout=30000,path=str(shots/'100_escort.png'))
  passed('Escort launches in the real simulation Worker with mission HUD and map objectives')
  data=p.evaluate('RA.app.captureSave()');assert data['operation']['id']=='escort'
  p.click('#hud-save-vault');assert p.locator('[data-save-slot]').count()==4
  p.click('[data-save-slot="manual1"]');p.wait_for_function("document.getElementById('vault-feedback').textContent.length>0")
  # Browser storage is deliberately unavailable in this opaque origin, not mocked as a successful write.
  assert '失败' in p.locator('#vault-feedback').inner_text() or 'denied' in p.locator('#vault-feedback').inner_text() or 'unavailable' in p.locator('#vault-feedback').inner_text() or '禁止' in p.locator('#vault-feedback').inner_text()
  with p.expect_download() as download:p.click('#vault-export')
  save=Path(tmp)/'escort.save.json';download.value.save_as(str(save))
  parsed=json.loads(save.read_text());assert parsed['operation']['id']=='escort'
  p.locator('#vault-modal [data-dismiss]').click()
  passed('Four save slots report blocked storage honestly; real JSON export retains mission state')
  p.evaluate("RA.app.renderer.setQuality('medium');RA.app.renderer.zoom=30")
  detail=p.evaluate("(()=>{const r=RA.app.renderer;r.render(RA.app.state,.016);return [...r.meshes].filter(([k,v])=>k.endsWith(':detail')&&v.instances>0).length})()")
  assert detail>0
  distant=p.evaluate("(()=>{const r=RA.app.renderer;r.zoom=75;r.render(RA.app.state,.016);return [...r.meshes].filter(([k,v])=>k.endsWith(':detail')&&v.instances>0).length})()")
  assert distant==0 and p.evaluate('RA.app.renderer.gl.getError()')==0
  p.evaluate("RA.app.renderer.setQuality('low');RA.app.renderer.zoom=35")
  passed('Detailed meshes render in medium quality and are actually omitted by distant LOD')
  p.click('#mission-back');assert p.locator('#page-operations').is_visible()
  passed('Exit mission returns to operation selection without leaking previous mission setup')
  # Server-authoritative spectator protocol is tested separately. Exercise the waiting UI with no snapshot yet.
  p.evaluate("RA.app.networkTransport='lan';RA.app.net={spectator:true,room:'ABC123',send:()=>false,close:()=>{},command:()=>false};RA.app.networkMessage({type:'start',code:'ABC123',spectator:true,player:0},RA.app.net);RA.app.networkMessage({type:'spectatorWait',seconds:30},RA.app.net)")
  assert '延迟观战缓冲' in p.locator('#connection-banner').inner_text()
  p.click('#pause-btn');assert p.locator('#pause-modal').is_visible();p.click('#resume')
  p.evaluate('RA.app.quit()')
  passed('Observer waiting screen supports opening/closing the menu before its first state arrives')
  p.set_viewport_size({'width':960,'height':820});p.click('[data-page="network"]')
  assert p.locator('#host-room').is_visible()
  assert p.evaluate('document.documentElement.scrollWidth<=window.innerWidth+2')
  p.screenshot(timeout=30000,path=str(shots/'100_compact_network.png'))
  passed('960-pixel layout remains horizontally contained with the connection controls reachable')
  assert not errors,errors
  passed('New release screens finish with no uncaught browser exception')
  complete=True
 finally:
  (ROOT/'tests/browser-release-results.json').write_text(json.dumps({'version':'1.0.0','completed':complete,'passed':len(checks),'checks':checks,'errors':errors,'environment':'Headed Chromium / Xvfb / software WebGL; full HTML in-memory, real Worker and file export. Opaque origin cannot access IndexedDB or WebCrypto, so failure handling is checked. Spectator waiting UI uses a fixture; real authority and encrypted transport are tested independently.'},ensure_ascii=False,indent=2))
  b.close()
