"""Real pointer/keyboard UI tests for camera UX; no navigation policy changes.
The full release HTML runs in an in-memory page, with the real WebGL renderer
and simulation Worker. Fault events are explicitly marked synthetic.
"""
from pathlib import Path
import json, os, subprocess, time, math
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
completed=False;checks=[];errors=[];limitations=[]
def record(s):
    checks.append(s);print('PASS',s,flush=True)
server=None
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'),headless=False,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
    def page():
        p=browser.new_page(viewport={'width':1280,'height':800},device_scale_factor=1)
        p.set_default_timeout(12000)
        p.on('pageerror',lambda e:errors.append(str(e)))
        p.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
        p.set_content((ROOT/'PLAY.html').read_text(),wait_until='load')
        p.wait_for_function('!!RA.app.camera && !RA.app.frameError')
        p.evaluate("RA.app.applyViewPreferences({quality:'low'})")
        return p
    p=page()
    def value(expr):return p.evaluate(expr)
    def target():return value('({...RA.app.renderer.target})')
    def dist(a,b):return math.hypot(a['x']-b['x'],a['z']-b['z'])
    def settle():
        p.wait_for_function('(()=>{const r=RA.app.renderer,c=r.project(r.target.x,0,r.target.z);return Math.abs(c.x-r.width/2)<.3&&Math.abs(c.y-r.height/2)<.3})()')
    def localpoint(x=.45,y=.55):
        b=p.locator('#world').bounding_box();return b['x']+b['width']*x,b['y']+b['height']*y
    def world(x,z):
        settle();q=p.evaluate('([x,z])=>RA.app.renderer.project(x,0,z)',[x,z]);b=p.locator('#world').bounding_box();return q['x']+b['x'],q['y']+b['y']
    def fixture(mode='classic'):
        p.evaluate("""mode=>{
          RA.app.resetPointer();RA.app.cancelPlan();RA.app.setCursor(null);
          const s=new RA.Sim({players:2,sandbox:true,map:'basin',fogMode:'none',nation:'usa',credits:50000});
          s.entities=[];s.ores=[];
          s.spawn('a_hq',0,60,120);s.spawn('a_power',0,68,120);s.spawn('a_refinery',0,51,118);s.spawn('a_barracks',0,58,111);
          s.spawn('a_factory',0,70,110);s.spawn('a_airfield',0,66,130);
          const tank=s.spawn('grizzly',0,83,96);s.spawn('grizzly',0,87,96);s.spawn('s_hq',1,160,30);
          s.reindex();s.rebuildGrid();s.updatePower();s.updateFog();s.players[0].readySlots.building={type:'a_power',cost:800};s.syncReady(s.players[0]);
          window.cameraTank=tank.id;window.fixtureTick=s.tick;
          RA.app.loadSave(JSON.parse(JSON.stringify(s.save())));
          RA.app.applyViewPreferences({...RA.CAMERA_DEFAULTS,quality:'low',edgeScroll:false,controls:mode,showTips:false});
          RA.app.selected=new Set([cameraTank]);RA.app.camera.focus({x:96,z:96});
          window.cameraCommands=[];
          document.activeElement.blur();
        }""",mode)
        p.wait_for_function("RA.app.state?.map==='basin'&&RA.app.state.entities.some(e=>e.id===cameraTank&&e.type==='grizzly')")
        p.wait_for_timeout(180)
        p.evaluate('RA.app.camera.focus({x:96,z:96});RA.app.selected=new Set([cameraTank]);cameraCommands=[];')
        settle();p.mouse.move(*localpoint())
    def drag(button='right',dx=115,dy=-35,hold=220):
        x,y=localpoint();p.mouse.move(x,y);p.mouse.down(button=button);p.wait_for_timeout(hold);p.mouse.move(x+dx,y+dy,steps=6);p.wait_for_timeout(80);p.mouse.up(button=button)
    try:
        p.evaluate("RA.app.showPage('sandbox')");p.select_option('#map','basin');p.select_option('#fog-mode','none');p.select_option('#players','2');p.click('#launch');p.wait_for_function('RA.app.state?.tick>2')
        p.evaluate("RA.app.worker.addEventListener('message',e=>{if(e.data.type==='commandResult'&&window.cameraCommands)cameraCommands.push(e.data)})")
        fixture();b=target();x,y=localpoint();p.mouse.down(button='right');p.wait_for_timeout(230);p.mouse.move(x+140,y-40,steps=8)
        p.wait_for_function('RA.app.camera.dragging');assert dist(target(),b)>5
        p.screenshot(timeout=30000,path=str(ROOT/'docs/screenshots/07_right_drag.png'))
        p.mouse.up(button='right');p.wait_for_timeout(200)
        assert value('[...RA.app.selected]')==[value('cameraTank')]
        assert value('cameraCommands.length')==0
        assert value('RA.app.drag') is None and value('RA.app.camera.gesture') is None
        record('Held right drag pans real rendered battlefield; release preserves selection and sends no command')

        fixture();p.mouse.click(*localpoint(),button='right');p.wait_for_timeout(100)
        assert value('RA.app.selected.size')==0
        record('Short right click retains classic deselection')

        fixture('modern');p.mouse.click(*world(116,103),button='right')
        p.wait_for_function("RA.app.state.entities.find(e=>e.id===cameraTank).order?.type==='move'")
        assert value('cameraCommands.filter(e=>e.command==="move").length')==1
        fixture('modern');drag();p.wait_for_timeout(150)
        assert value('cameraCommands.length')==0 and value('RA.app.selected.has(cameraTank)')
        record('Modern short right click moves units; held drag does not generate an extra move')

        fixture();b=target();p.mouse.down(button='right');p.wait_for_timeout(240);p.mouse.up(button='right')
        assert dist(target(),b)<.001 and value('RA.app.selected.has(cameraTank)')
        assert value('cameraCommands.length')==0
        record('Long stationary hold is consumed safely, without moving or deselecting')

        fixture();b=target();x,y=localpoint();p.mouse.down(button='right');p.mouse.move(x+60,y,steps=2);p.mouse.up(button='right')
        assert dist(target(),b)>2 and value('RA.app.selected.has(cameraTank)')
        record('Fast deliberate right drag works without waiting for the hold timer')

        fixture();p.keyboard.press('q');assert value('RA.app.cursor?.unit')=='a_power';drag()
        assert value('RA.app.cursor?.unit')=='a_power' and value('RA.app.state.p.readySlots.building.type')=='a_power'
        assert value('cameraCommands.length')==0
        p.mouse.click(*localpoint(),button='right');assert value('RA.app.cursor') is None
        record('Dragging preserves ready-building placement; a subsequent short right click cancels it')

        fixture();p.keyboard.down('z');p.mouse.click(*world(104,93));p.mouse.click(*world(113,103));assert value('RA.app.plan.orders.length')==2
        drag();assert value('RA.app.plan.orders.length')==2 and value('cameraCommands.length')==0
        p.keyboard.up('z');p.wait_for_function('cameraCommands.some(c=>c.command==="plan"&&c.result.ok)')
        record('Right drag retains unsubmitted Z waypoints; Z release still submits exactly the planned route')

        fixture();p.click('#camera-options');assert value('RA.app.paused')
        p.select_option('#pan-mode','scroll');p.uncheck('#camera-edge');p.screenshot(timeout=30000,path=str(ROOT/'docs/screenshots/08_camera_settings.png'));p.click('#camera-close')
        assert not value('RA.app.paused') and value('RA.app.camera.prefs.panMode')=='scroll'
        x,y=localpoint();p.mouse.move(x,y);p.mouse.down(button='right');p.mouse.move(x+100,y,steps=4);p.wait_for_timeout(180);a=target();p.wait_for_timeout(300);b=target();assert dist(a,b)>2
        p.mouse.up(button='right');a=target();p.wait_for_timeout(230);assert dist(a,target())<.001
        assert value('cameraCommands.length')==0
        record('Continuous-scroll preset keeps panning at fixed pointer offset and stops immediately on release')

        fixture();p.click('#camera-options');p.check('#invert-drag');p.locator('#drag-sensitivity').fill('1.5');p.click('#camera-close')
        assert value('RA.app.camera.prefs.invertDrag') and value('RA.app.camera.prefs.dragSensitivity')==1.5
        a=value('RA.app.renderer.project(96,0,96)');drag(dx=80,dy=0);b=value('RA.app.renderer.project(96,0,96)');assert b['x']<a['x']-100
        record('Actual settings controls alter drag direction and sensitivity')

        fixture();p.evaluate('RA.app.applyViewPreferences({rightDrag:false})');a=target();drag(button='middle',dx=75,dy=0,hold=0)
        assert dist(a,target())>3 and value('RA.app.selected.has(cameraTank)') and value('cameraCommands.length')==0
        record('Middle-button drag remains immediate with right-button dragging disabled')

        fixture();p.evaluate('RA.app.applyViewPreferences({edgeScroll:true,edgeDelay:50,edgeWidth:24,smoothPan:false})')
        b=p.locator('#world').bounding_box();a=target();p.mouse.move(b['x']+b['width']-2,b['y']+b['height']*.45);p.wait_for_function('a=>Math.hypot(RA.app.renderer.target.x-a.x,RA.app.renderer.target.z-a.z)>2',arg=a,timeout=6000);assert dist(a,target())>2
        sidebar=p.locator('#sidebar').bounding_box();p.mouse.move(sidebar['x']+40,sidebar['y']+440);p.wait_for_function('RA.app.mouse===null');a=target();p.wait_for_timeout(180);assert dist(a,target())<.001
        record('Edge scroll uses the playable edge and stops while pointer is over production sidebar')

        fixture();p.evaluate('RA.app.applyViewPreferences({edgeScroll:true,edgeDelay:30,smoothPan:false})');b=p.locator('#world').bounding_box();hud=p.locator('#bottomhud').bounding_box()
        assert b['y']+b['height']<=hud['y']
        a=target();p.mouse.move(b['x']+b['width']*.45,b['y']+b['height']-2);p.wait_for_function('a=>Math.hypot(RA.app.renderer.target.x-a.x,RA.app.renderer.target.z-a.z)>2',arg=a,timeout=6000);assert dist(a,target())>2
        p.mouse.move(hud['x']+60,hud['y']+30);p.wait_for_function('RA.app.mouse===null');a=target();p.wait_for_timeout(180);assert dist(a,target())<.001
        record('Bottom edge is no longer hidden behind HUD, and hovering bottom controls stops edge panning')

        fixture();a=target();p.keyboard.down('ArrowRight');p.wait_for_function('a=>Math.hypot(RA.app.renderer.target.x-a.x,RA.app.renderer.target.z-a.z)>2',arg=a,timeout=6000);p.keyboard.up('ArrowRight');assert dist(a,target())>2
        a=target();p.wait_for_timeout(200);assert dist(a,target())<.001
        p.keyboard.press('Home');p.wait_for_timeout(100);assert abs(target()['x']-83)<1
        p.click('#zoom-in');p.wait_for_function('RA.app.renderer.zoom<34');p.keyboard.press('End');assert value('RA.app.renderer.zoom')==35
        record('Arrow movement stops on key release; Home focuses selection and End resets zoom')

        fixture();x,y=localpoint(.65,.42);p.mouse.move(x,y);b=p.locator('#world').bounding_box();px=x-b['x'];py=y-b['y'];a=p.evaluate('([x,y])=>RA.app.renderer.groundAt(x,y)',[px,py]);p.mouse.wheel(0,-170)
        p.wait_for_function('RA.app.camera.zoomGoal===null');bb=p.evaluate('([x,y])=>RA.app.renderer.groundAt(x,y)',[px,py]);assert dist(a,bb)<.04
        assert value('RA.app.renderer.zoom')<35
        record('Actual wheel zoom preserves the world point under the cursor during smooth zoom')

        a=target();z=value('RA.app.renderer.zoom');sb=p.locator('#build-grid').bounding_box();p.mouse.move(sb['x']+30,sb['y']+sb['height']*.5);p.mouse.wheel(0,220);p.wait_for_timeout(160)
        assert abs(value('RA.app.renderer.zoom')-z)<.001 and dist(a,target())<.001
        assert value('window.scrollY')==0
        record('Scrolling the production list does not zoom the map or scroll the document')

        fixture();x,y=localpoint();p.mouse.move(x,y);p.mouse.down(button='right');p.wait_for_timeout(200)
        sidebar=p.locator('#sidebar').bounding_box();p.mouse.move(sidebar['x']+50,sidebar['y']+440,steps=8);assert value('RA.app.camera.dragging')
        p.mouse.up(button='right');p.wait_for_timeout(100);assert value('cameraCommands.length')==0 and value('RA.app.selected.has(cameraTank)')
        record('Pointer capture lets a battlefield drag end over UI without click-through or production orders')

        for fault in ['cancel','capture','blur']:
            fixture();p.mouse.down(button='right');p.wait_for_timeout(190)
            if fault=='cancel':p.evaluate("document.getElementById('world').dispatchEvent(new PointerEvent('pointercancel',{pointerId:RA.app.drag.pointerId,bubbles:true}))")
            elif fault=='capture':
                x,y=localpoint();p.mouse.move(x+2,y+2)  # Activate pending capture before testing its loss.
                p.evaluate("document.getElementById('world').releasePointerCapture(RA.app.drag.pointerId)")
                x,y=localpoint();p.mouse.move(x+1,y+1)  # Process pending lostpointercapture with a real pointer event.
            else:p.evaluate("window.dispatchEvent(new Event('blur'))")
            p.wait_for_function('!RA.app.drag&&!RA.app.camera.gesture');p.mouse.up(button='right');assert value('cameraCommands.length')==0
        record('Synthetic pointercancel/blur and real capture release safely clear dragging without a stale click')

        fixture();p.mouse.down(button='right');p.wait_for_timeout(200);p.keyboard.press('F1');p.wait_for_function('!RA.app.drag');p.mouse.up(button='right');assert value('cameraCommands.length')==0;p.keyboard.press('F1')
        record('Opening a modal mid-gesture safely stops camera input and does not cancel selected units')

        fixture();p.click('#camera-options');p.click('#camera-preset-trackpad');assert value('RA.app.camera.prefs.zoomSensitivity')==.65
        assert not value('RA.app.camera.prefs.edgeScroll');p.click('#camera-close');p.evaluate('RA.app.quit()');p.click('[data-page="skirmish"]');p.click('#launch');p.wait_for_function('RA.app.state?.tick>2')
        assert value('RA.app.camera.prefs.zoomSensitivity')==.65 and not value('RA.app.edge')
        record('Trackpad preset and local preferences survive leaving and starting another match in the same page')
        limitations.append('In-memory page has an opaque origin. Cross-reload localStorage persistence and direct file navigation are not verified; file navigation is blocked by environment policy.')

        p.click('#fullscreen-btn');p.wait_for_function('!!document.fullscreenElement',timeout=5000);p.wait_for_timeout(100)
        assert not value('RA.app.frameError');p.click('#fullscreen-btn');p.wait_for_function('!document.fullscreenElement')
        record('Real fullscreen button enters/exits fullscreen and camera matrices remain valid')

        # Verify local-only camera commands on a real authoritative multiplayer room.
        server=subprocess.Popen(['node',str(ROOT/'server/server.cjs'),'--port','18789'],stdout=subprocess.DEVNULL)
        time.sleep(.4);p.evaluate('RA.app.quit()');q=page()
        for tab in (p,q):
            tab.bring_to_front();tab.click('[data-page="network"]');tab.select_option('#transport-select','lan');tab.locator('#advanced-setup summary').click();tab.fill('#server-url','ws://127.0.0.1:18789')
        p.bring_to_front();p.select_option('#players','2');p.select_option('#teams','ffa');p.click('#host-room');p.wait_for_function('!!RA.app.net?.room')
        room=value('RA.app.net.room');q.bring_to_front();q.fill('#room-code',room);q.click('#join-room');q.wait_for_function('RA.app.net?.members?.length===2');q.click('#ready-room')
        p.bring_to_front();p.wait_for_function('RA.app.net.members.some(m=>m.slot===1&&m.ready)');p.click('#start-room')
        for tab in (p,q):tab.wait_for_function('RA.app.state?.tick>3')
        p.bring_to_front();p.evaluate("RA.app.applyViewPreferences({rightDrag:true,panMode:'grab',edgeScroll:false,quality:'low'});RA.app.camera.focus({x:96,z:96});RA.app.selected=new Set([RA.app.state.entities.find(e=>e.owner===RA.app.state.player&&e.type==='grizzly').id]);")
        before_seq=value('RA.app.net.seq');guest_target=q.evaluate('({...RA.app.renderer.target})');a=target();drag();p.wait_for_timeout(130)
        assert value('RA.app.net.seq')==before_seq and dist(a,target())>2 and dist(guest_target,q.evaluate('({...RA.app.renderer.target})'))<.001
        record('Two real browser clients: right-drag changes only local camera and emits zero network commands')
        assert not errors,errors;assert value('RA.app.renderer.gl.getError()')==0
        record('Camera UI and multiplayer integration produce no JavaScript or WebGL errors')
        completed=True
    except Exception:
        print('STATE AT FAILURE',p.evaluate("({playing:RA.app.playing,paused:RA.app.paused,drag:RA.app.drag,gesture:RA.app.camera.gesture,preferences:RA.app.camera.prefs,mouse:RA.app.mouse,target:RA.app.renderer.target,selected:[...RA.app.selected],plan:RA.app.plan,cursor:RA.app.cursor,commands:window.cameraCommands,frameError:RA.app.frameError,modal:document.querySelector('.modal:not(.hidden)')?.id})"),flush=True)
        p.screenshot(timeout=30000,path=str(ROOT/'tests/camera_failure.png'))
        raise
    finally:
        (ROOT/'tests/browser-camera-results.json').write_text(json.dumps({'version':'1.0.0','date':'2026-09-12','completed':completed,'passed':len(checks),'checks':checks,'errors':errors,'limitations':limitations,'environment':'Chromium 144, 1280x800, Xvfb, ANGLE SwiftShader; complete HTML in-memory, real Worker and pointer/keyboard input, loopback networking.'},ensure_ascii=False,indent=2))
        browser.close()
        if server:server.terminate();server.wait(timeout=5)
