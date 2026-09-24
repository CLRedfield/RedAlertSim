'use strict';
const assert=require('node:assert/strict'), fs=require('node:fs'),path=require('node:path');
require('../web/src/data.js');require('../web/src/geometry.js');require('../web/src/renderer.js');require('../web/src/camera.js');require('../web/src/sim.js');
const R=globalThis.RA,results=[];
function test(name,fn){try{fn();results.push({name,passed:true});console.log('PASS',name);}catch(e){results.push({name,passed:false,error:e.stack});console.error('FAIL',name,e);process.exitCode=1;}}
function fixture(prefs={}){const r=Object.create(R.Renderer.prototype);Object.assign(r,{target:{x:96,z:96},zoom:35,yaw:Math.PI/4,pitch:.92,width:1200,height:738});r.syncCamera();return [r,new R.CameraController(r,prefs)];}
const close=(a,b,eps=.003)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const input=(extra={})=>({allowed:true,keys:new Set(),edgeEnabled:true,...extra});
test('Camera preferences reject invalid fields, clamp limits and keep defaults',()=>{
 const p=R.normalizeCameraPrefs({holdMs:-9,scrollSpeed:Infinity,panMode:'bad',rightDrag:'false',volume:9,__proto__:{zoomSensitivity:77}});
 assert.equal(p.holdMs,80);assert.equal(p.scrollSpeed,680);assert.equal(p.panMode,'grab');assert.equal(p.rightDrag,true);assert.equal(p.volume,1);assert.equal(p.zoomSensitivity,1);
 assert.deepEqual(R.normalizeCameraPrefs(null),R.CAMERA_DEFAULTS);
});
test('Short right click with small jitter remains a click and does not pan',()=>{
 const[r,c]=fixture(),before={...r.target};c.begin(2,{x:500,y:350},0);c.move({x:501,y:351},50);const g=c.end({x:501,y:351},80);assert.equal(g.active,false);close(distance(before,r.target),0);
});
test('Long stationary right hold consumes release without moving the camera',()=>{
 const[r,c]=fixture(),before={...r.target};c.begin(2,{x:500,y:350},0);c.update(.016,170,input());assert.ok(c.dragging);const g=c.end({x:500,y:350},190);assert.ok(g.active);close(distance(before,r.target),0);
});
test('Fast deliberate drag promotes before the hold timer elapses',()=>{
 const[r,c]=fixture();c.begin(2,{x:500,y:350},0);c.move({x:520,y:350},25);assert.ok(c.dragging);assert.ok(distance({x:96,z:96},r.target)>0);
});
test('Grab moves the projected ground by the exact CSS pointer displacement',()=>{
 const[r,c]=fixture(),before=r.project(96,0,96);c.begin(2,{x:500,y:350},0);c.move({x:620,y:300},30);const after=r.project(96,0,96);close(after.x-before.x,120);close(after.y-before.y,-50);
});
test('Many pointer moves add up without repeatedly applying the same delta',()=>{
 const[r,c]=fixture(),before=r.project(96,0,96);c.begin(2,{x:500,y:350},0);for(let i=1;i<=20;i++)c.move({x:500+i*5,y:350+i},i*5);for(let i=0;i<20;i++)c.update(.016,200+i*16,input());const after=r.project(96,0,96);close(after.x-before.x,100);close(after.y-before.y,20);
});
test('Drag sensitivity and inverted grab direction apply exactly once',()=>{
 const[r,c]=fixture({dragSensitivity:1.5,invertDrag:true}),b=r.project(96,0,96);c.begin(2,{x:500,y:350},0);c.move({x:550,y:350},20);close(r.project(96,0,96).x-b.x,-75);
});
test('Disabling right dragging restores stationary long-click behavior',()=>{
 const[r,c]=fixture({rightDrag:false});c.begin(2,{x:500,y:350},0);assert.equal(c.end({x:500,y:350},900).active,false);close(r.target.x,96);
});
test('Middle drag is immediate even with right dragging disabled',()=>{
 const[r,c]=fixture({rightDrag:false,panMode:'scroll'}),b=r.project(96,0,96);c.begin(1,{x:500,y:350},0);c.move({x:504,y:350},1);close(r.project(96,0,96).x-b.x,4);assert.ok(c.end({x:504,y:350},2).active);
});
test('Left selection gestures suppress keys and edges without panning',()=>{
 const[r,c]=fixture();c.begin(0,{x:500,y:350},0);c.move({x:700,y:390},20);c.update(.04,999,input({mouse:{x:1199,y:500},keys:new Set(['ArrowRight'])}));close(r.target.x,96);assert.equal(c.end({x:700,y:390},1000).active,false);
});
test('Continuous-scroll mode keeps moving while pointer stays displaced',()=>{
 const[r,c]=fixture({panMode:'scroll',smoothPan:false});c.begin(2,{x:500,y:350},0);c.move({x:600,y:350},30);for(let i=0;i<20;i++)c.update(.02,50+i*20,input());const first={...r.target};for(let i=0;i<20;i++)c.update(.02,500+i*20,input());assert.ok(distance(first,r.target)>4);
});
test('Continuous scroll dead zone stops, and releasing adds no drift',()=>{
 const[r,c]=fixture({panMode:'scroll'});c.begin(2,{x:500,y:350},0);c.move({x:590,y:350},30);c.update(.04,200,input());c.move({x:503,y:350},300);const b={...r.target};c.update(.04,320,input());close(distance(b,r.target),0);c.end({x:503,y:350},350);for(let i=0;i<10;i++)c.update(.04,400+i*40,input());close(distance(b,r.target),0);
});
test('Edge scroll respects dwell delay and strength at the playable boundary',()=>{
 const[r,c]=fixture({smoothPan:false,edgeDelay:100});const i=input({mouse:{x:1199,y:350}});c.update(.02,0,i);c.update(.02,90,i);close(r.target.x,96);c.update(.02,120,i);assert.ok(r.target.x>96);
});
test('HUD hover, outside coordinates and disabled edge scroll do not pan',()=>{
 for(const patch of[{mouse:null},{mouse:{x:1201,y:350}},{mouse:{x:1199,y:350},edgeEnabled:false}]){
 const[r,c]=fixture({edgeDelay:0});for(let i=0;i<10;i++)c.update(.03,i*30,input(patch));close(r.target.x,96);
 }
});
test('Fullscreen-only edge setting is enforced',()=>{
 const[r,c]=fixture({edgeFullscreenOnly:true,edgeDelay:0,smoothPan:false});const i=input({mouse:{x:1199,y:350}});c.update(.03,0,i);close(r.target.x,96);c.update(.03,30,{...i,fullscreen:true});assert.ok(r.target.x>96);
});
test('Bottom edge is actionable with a point just inside the canvas',()=>{
 const[r,c]=fixture({edgeDelay:0,smoothPan:false});c.update(.03,0,input({mouse:{x:600,y:737}}));assert.ok(r.target.x>96&&r.target.z>96);
});
test('Diagonal keyboard speed is normalized and Shift accelerates',()=>{
 const[r,c]=fixture({smoothPan:false}),[r2,c2]=fixture({smoothPan:false});c.update(.04,0,input({keys:new Set(['ArrowRight'])}));c2.update(.04,0,input({keys:new Set(['ArrowRight','ArrowDown'])}));const p=r.project(96,0,96),q=r2.project(96,0,96);close(Math.hypot(p.x-600,p.y-369),Math.hypot(q.x-600,q.y-369));
 const[r3,c3]=fixture({smoothPan:false});c3.update(.04,0,input({keys:new Set(['ArrowRight','ShiftLeft'])}));close(distance(r3.target,{x:96,z:96})/distance(r.target,{x:96,z:96}),1.75);
});
test('Camera travel is frame-rate independent at 30 and 120 updates per second',()=>{
 const[r,c]=fixture({smoothPan:false,scrollSpeed:240}),[r2,c2]=fixture({smoothPan:false,scrollSpeed:240});for(let i=0;i<30;i++)c.update(1/30,i*1000/30,input({keys:new Set(['ArrowRight'])}));for(let i=0;i<120;i++)c2.update(1/120,i*1000/120,input({keys:new Set(['ArrowRight'])}));close(distance(r.target,r2.target),0,.0001);
});
test('Smooth start still stops immediately when the direction is released',()=>{
 const[r,c]=fixture();for(let i=0;i<10;i++)c.update(.016,i*16,input({keys:new Set(['ArrowRight'])}));const b={...r.target};c.update(.016,180,input());close(distance(b,r.target),0);assert.equal(c.velocity.x,0);
});
test('Ground under the mouse stays anchored throughout smooth zoom',()=>{
 const[r,c]=fixture(),point={x:850,y:320},b=r.groundAt(point.x,point.y);c.zoomBy(-150,point);for(let i=0;i<40;i++)c.update(.016,i*16,input());const a=r.groundAt(point.x,point.y);close(distance(a,b),0,.008);assert.ok(r.zoom<35);
});
test('Center zoom option does not move the camera target',()=>{
 const[r,c]=fixture({zoomToCursor:false,smoothZoom:false});c.zoomBy(-150,{x:850,y:320});close(r.target.x,96);close(r.target.z,96);assert.ok(r.zoom<35);
});
test('Wheel pixel, line and page modes convert to the same intended distance',()=>{
 assert.equal(R.wheelPixels({deltaY:80,deltaMode:0},800),80);assert.equal(R.wheelPixels({deltaY:5,deltaMode:1},800),80);assert.equal(R.wheelPixels({deltaY:.1,deltaMode:2},800),80);assert.equal(R.wheelPixels({deltaY:NaN},800),0);
});
test('Rapid wheel bursts respect zoom and map boundaries',()=>{
 const[r,c]=fixture({smoothZoom:false});for(let i=0;i<30;i++)c.zoomBy(-800,{x:900,y:500});assert.equal(r.zoom,14);for(let i=0;i<30;i++)c.zoomBy(800,{x:900,y:500});assert.equal(r.zoom,78);assert.ok(r.target.x>=1&&r.target.x<=191&&r.target.z>=1&&r.target.z<=191);
});
test('Blur/modal cancellation releases gesture and pending wheel animation',()=>{
 const[r,c]=fixture();c.zoomBy(-300,{x:500,y:350});c.begin(2,{x:500,y:350},0);c.move({x:560,y:350},50);c.update(.02,80,{allowed:false});assert.equal(c.gesture,null);assert.equal(c.zoomGoal,null);assert.equal(c.velocity.x,0);
});
test('Focus and reset zoom cancel pending motion and sync picking matrices',()=>{
 const[r,c]=fixture();c.zoomBy(-100,null);c.focus({x:140,z:80});assert.equal(c.zoomGoal,null);const pt=r.project(140,0,80);close(pt.x,600);close(pt.y,369);r.zoom=22;c.resetZoom();assert.equal(r.zoom,35);close(r.groundAt(600,369).x,140);
});
test('Camera clamps target at world boundaries without NaN',()=>{
 const[r,c]=fixture();c.begin(2,{x:500,y:350},0);c.move({x:100000,y:-100000},40);for(const v of Object.values(r.target))assert.ok(v>=1&&v<=191&&Number.isFinite(v));
});
test('Current and original v0.3.0 save fixtures load and resave as the current release',()=>{
 const current=new R.Sim({players:2,sandbox:true});assert.equal(R.Sim.load(JSON.parse(JSON.stringify(current.save()))).save().version,R.VERSION);
 const old=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/v030-save.json'),'utf8'));
 assert.equal(old.version,'0.3.0');const loaded=R.Sim.load(old);assert.equal(loaded.tick,old.tick);loaded.tickStep();assert.equal(loaded.save().version,R.VERSION);
 assert.throws(()=>R.Sim.load({...old,version:'0.2.0'}));
});
const output={version:R.VERSION,date:'2026-09-05',passed:results.filter(r=>r.passed).length,total:results.length,results,environment:'Node.js '+process.version+'. Camera math and input state, not physical mouse/GPU performance.'};
fs.writeFileSync(path.join(__dirname,'camera-results.json'),JSON.stringify(output,null,2));console.log(`${output.passed}/${output.total} camera checks passed`);
