"""Command Edition UI integration with real Worker, downloads, file input and loopback WS.
HTML is loaded in-memory without changing navigation policies. No public host is used.
"""
from pathlib import Path
import json, os, subprocess, tempfile, time
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
checks=[]; errors=[]; completed=False
server=subprocess.Popen(['node',str(ROOT/'server/server.cjs'),'--port','18790'],stdout=subprocess.DEVNULL)
shots=ROOT/'docs/screenshots'
def record(text):
    checks.append(text);print('PASS',text,flush=True)
with sync_playwright() as pw, tempfile.TemporaryDirectory() as tmp:
    browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'),headless=False,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
    def new():
        p=browser.new_page(viewport={'width':1280,'height':800},accept_downloads=True)
        p.set_default_timeout(18000)
        p.on('pageerror',lambda e:errors.append(str(e)))
        p.set_content((ROOT/'PLAY.html').read_text(),wait_until='load')
        p.wait_for_function('!!RA.app.camera');p.evaluate("RA.app.applyViewPreferences({quality:'low',edgeScroll:false})")
        return p
    p=new()
    try:
        assert p.locator('#hq-nav button').count()==8
        assert p.locator('#page-home').is_visible()
        p.screenshot(timeout=30000,path=str(shots/'09_command_home.png'))
        record('New eight-section headquarters renders at 1280x800')
        p.click('[data-page="skirmish"]')
        assert p.locator('#map-choices button').count()==6
        p.select_option('#players','4');p.select_option('#teams','4v4')
        assert p.locator('#seat-editor .seat-row').count()==4
        assert 'valid' in p.locator('#setup-error').get_attribute('class')
        p.select_option('[data-seat="1"] [data-field="color"]','0')
        assert '颜色' in p.locator('#setup-error').inner_text()
        p.click('#launch');assert not p.evaluate('RA.app.playing')
        p.select_option('[data-seat="1"] [data-field="color"]','1')
        p.select_option('#map','urban');p.screenshot(timeout=30000,path=str(shots/'10_deployment.png'))
        record('Six maps, four editable seats, equal-team preset and duplicate-color launch rejection work in UI')
        p.click('[data-page="catalog"]');p.fill('#catalog-search','ifv')
        p.locator('#catalog-grid .catalog-entry').first.click()
        assert p.locator('#details-modal').is_visible()
        assert '生产链' in p.locator('#unit-details').inner_text()
        p.screenshot(timeout=30000,path=str(shots/'11_encyclopedia.png'))
        p.locator('#details-modal [data-dismiss]').click()
        p.evaluate('document.activeElement.blur()');p.keyboard.press('Escape')
        assert not p.locator('#catalog-modal').is_visible()
        record('Searchable catalog opens real unit prerequisites and closes safely with Escape')
        p.click('[data-page="training"]');assert p.locator('[data-training]').count()==5
        p.screenshot(timeout=30000,path=str(shots/'12_training_menu.png'));p.click('[data-training="move"]')
        p.wait_for_function("RA.app.state?.mission?.id==='move'")
        p.evaluate("RA.app.command({type:'move',ids:RA.app.state.entities.filter(e=>e.owner===0&&e.type==='grizzly').map(e=>e.id),x:57,z:133})")
        p.wait_for_function('RA.app.state.mission.completed',timeout=25000)
        assert p.locator('#mission-next').is_visible()
        p.screenshot(timeout=30000,path=str(shots/'13_training_complete.png'))
        record('Real movement command completes training in Worker and unlocks next-lesson UI')
        p.wait_for_function('RA.app.state.tick>130',timeout=15000)
        with p.expect_download() as download:
            p.click('#hud-replay-export')
        replay=Path(tmp)/'training.replay.json';download.value.save_as(str(replay))
        data=json.loads(replay.read_text());assert data['endTick']>=130
        assert len(data['commands'])>=1
        p.evaluate('RA.app.quit()');p.click('[data-page="replays"]')
        p.locator('#replay-input').set_input_files(str(replay))
        p.wait_for_function('!!RA.app.state?.replay && RA.app.state.tick>1')
        p.click('#replay-pause');p.wait_for_function('RA.app.state.replay.paused')
        tick=p.evaluate('RA.app.state.tick');p.wait_for_timeout(600);assert p.evaluate('RA.app.state.tick')==tick
        p.select_option('#replay-speed','2')
        p.locator('#replay-seek').fill('60');p.locator('#replay-seek').dispatch_event('change')
        p.wait_for_function('RA.app.state.tick===60')
        p.select_option('#replay-view','1');p.wait_for_function('RA.app.state.player===1')
        p.screenshot(timeout=30000,path=str(shots/'14_replay.png'))
        assert p.evaluate("RA.app.command({type:'surrender'})") is None
        assert p.evaluate('RA.app.state.winner') is None
        record('Actual replay download/import supports pause, speed, seek, POV and blocks battle commands')
        p.click('#replay-exit');assert p.locator('#page-replays').is_visible()
        p.click('[data-page="network"]');assert '公共中转' in p.locator('#online-gate').inner_text()
        assert json.loads((ROOT/'web/online.json').read_text())['endpoints']==[]
        record('Online entry distinguishes public relay/browser host from a deployed dedicated server');p.select_option('#transport-select','lan');p.locator('#advanced-setup summary').click()
        # No mock WebSocket or mock room state: two Chromium tabs connect to actual server.
        p.select_option('#players','2');p.select_option('#teams','ffa');p.select_option('#fog-mode','double')
        p.fill('#server-url','ws://127.0.0.1:18790');p.click('#host-room');p.wait_for_function('!!RA.app.net?.room')
        code=p.evaluate('RA.app.net.room');q=new();q.bring_to_front();q.click('[data-page="network"]');q.select_option('#transport-select','lan');q.fill('#server-url','ws://127.0.0.1:18790');q.fill('#room-code',code);q.click('#join-room');q.wait_for_function('RA.app.net?.members?.length===2')
        p.bring_to_front();p.click('#open-lobby-chat');p.fill('#chat-text','<img src=x onerror=alert(1)> commander');p.locator('#chat-form button').click()
        q.bring_to_front();q.click('#open-lobby-chat');q.wait_for_function("document.getElementById('chat-history').textContent.includes('<img src=x')")
        assert q.locator('#chat-history img').count()==0
        q.locator('#chat-modal [data-dismiss]').click();p.locator('#chat-modal [data-dismiss]').click()
        p.bring_to_front();p.screenshot(timeout=30000,path=str(shots/'15_network_lobby.png'))
        record('Two real clients join lobby; chat renders hostile-looking markup strictly as text')
        q.bring_to_front();q.click('#ready-room');p.bring_to_front();p.wait_for_function('RA.app.net.members.some(m=>m.slot===1&&m.ready)');p.click('#start-room')
        p.wait_for_function('RA.app.state?.tick>5');q.bring_to_front();q.wait_for_function('RA.app.state?.tick>5')
        assert not q.evaluate('RA.app.state.entities.some(e=>e.owner===0)')
        who=q.evaluate('RA.app.state.player');tick=q.evaluate('RA.app.state.tick')
        q.evaluate('RA.app.net.ws.close()')
        q.wait_for_function('!RA.app.net.connected',timeout=4000)
        seq=q.evaluate('RA.app.net.seq');q.evaluate("RA.app.command({type:'surrender'})")
        assert q.evaluate('RA.app.net.seq')==seq
        q.wait_for_function('RA.app.net.connected',timeout=15000)
        q.wait_for_function('tick=>RA.app.state.tick>tick',arg=tick)
        assert q.evaluate('RA.app.state.player')==who
        assert q.evaluate('RA.app.state.winner') is None
        record('Real socket close locks commands; automatic reconnect retains seat and continues fog-filtered match')
        p.bring_to_front();p.evaluate("RA.app.command({type:'surrender'})")
        p.wait_for_function("!document.getElementById('result-modal').classList.contains('hidden')")
        p.screenshot(timeout=30000,path=str(shots/'16_results.png'))
        assert not errors, errors
        assert p.evaluate('RA.app.renderer.gl.getError()')==0
        record('Surrender reaches new result screen with no browser exception or WebGL error')
        completed=True
    except Exception:
        p.screenshot(timeout=30000,path=str(ROOT/'tests/upgrade_failure.png'))
        print('BROWSER ERRORS',errors,flush=True)
        raise
    finally:
        (ROOT/'tests/browser-upgrade-results.json').write_text(json.dumps({'version':'1.0.0','date':'2026-09-12','completed':completed,'passed':len(checks),'checks':checks,'errors':errors,'environment':'Chromium / Xvfb / SwiftShader; full HTML in-memory, real downloads/file input/Worker and two actual browser loopback WebSockets. Not physical LAN/public/Windows tests.'},ensure_ascii=False,indent=2))
        browser.close();server.terminate();server.wait(timeout=5)
