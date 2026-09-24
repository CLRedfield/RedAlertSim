'use strict';
// Behavioral regression tests for the operational upgrade. No rendering stubs.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const R=require('../web/src/data.js'),Sim=require('../web/src/sim.js');
const results=[];
function test(name,fn){const start=performance.now();try{fn();results.push({name,passed:true,ms:+(performance.now()-start).toFixed(2)});console.log('PASS',name);}catch(e){results.push({name,passed:false,error:e.stack});console.error('FAIL',name,e.stack);process.exitCode=1;}}
function scene(cfg={}){const s=new Sim({players:2,sandbox:true,map:'basin',fogMode:'none',...cfg});s.entities=[];s.ores=[];s.effects=[];for(const p of s.players){p.seen.fill(0);p.fog.fill(0);p.memory={};p.oreMemory={};p.primary={};}refresh(s);return s;}
function refresh(s){s.reindex();s.rebuildGrid();s.updatePower();s.updateFog();s.pathBudget=100;}
function step(s,n){for(let i=0;i<n;i++)s.tickStep();}
function cmd(s,c){const r=s.command(0,c);assert.ok(r.ok,r.error);return r;}
function silent(e){e.cooldown=1000;return e;}
const near=(e,x,z,r=2)=>Math.hypot(e.x-x,e.z-z)<r;

test('Normal movement crushes enemy infantry along the swept tank track',()=>{
 const s=scene(),tank=silent(s.spawn('grizzly',0,61,61)),victim=s.spawn('conscript',1,69,61,{stun:100});refresh(s);
 cmd(s,{type:'move',ids:[tank.id],x:79,z:61});step(s,65);assert.ok(victim.hp<=0);assert.equal(s.players[0].kills,1);assert.ok(tank.x>70);
});
test('Force-move crosses an enemy target instead of stopping to shoot',()=>{
 const s=scene(),tank=silent(s.spawn('rhino',0,61,61)),victim=s.spawn('conscript',1,69,61,{stun:100});refresh(s);
 cmd(s,{type:'forceMove',ids:[tank.id],target:victim.id});assert.equal(tank.order.target,undefined);step(s,50);assert.ok(victim.hp<=0);
});
test('Crush immunity: allies, garrison, iron curtain and deployed guardian infantry',()=>{
 const s=scene(),tank=s.spawn('grizzly',0,61,61);
 for(const [type,owner,extra] of [['gi',0,{}],['gi',1,{inside:999}],['conscript',1,{invul:10}],['ggi',1,{deployed:true}],['brute',1,{}],['tesla_trooper',1,{}],['desolator',1,{}]]){const e=s.spawn(type,owner,65,61,extra);assert.equal(s.canCrush(tank,e),false,type);}
 const e=s.spawn('ggi',1,65,61);assert.equal(s.canCrush(tank,e),true);e.deployed=true;assert.equal(s.canCrush(tank,e),false);
});
test('Battle fortress crushes ordinary vehicles, ordinary tanks do not',()=>{
 const s=scene(),fort=s.spawn('battlefortress',0,61,61),tank=s.spawn('grizzly',0,61,65),enemy=s.spawn('rhino',1,66,61);refresh(s);
 assert.equal(s.canCrush(tank,enemy),false);assert.equal(s.canCrush(fort,enemy),true);s.crushAlong(fort,61,61,70,61);assert.ok(enemy.hp<=0);
});
test('Three-node movement plan reaches corners sequentially and drains its queue',()=>{
 const s=scene(),u=s.spawn('grizzly',0,61,61);refresh(s);cmd(s,{type:'plan',ids:[u.id],orders:[{type:'move',x:75,z:61},{type:'move',x:75,z:75},{type:'move',x:61,z:75}]});
 assert.equal(u.orderQueue.length,2);step(s,20);assert.ok(u.x>70&&u.z<65);step(s,150);assert.ok(near(u,61,75));assert.equal(u.order,null);assert.equal(u.orderQueue.length,0);
});
test('Shift-style append preserves active order; normal command replaces the whole route',()=>{
 const s=scene(),u=s.spawn('grizzly',0,61,61);refresh(s);cmd(s,{type:'move',ids:[u.id],x:75,z:61});cmd(s,{type:'move',ids:[u.id],x:75,z:75,append:true});
 assert.equal(u.order.x,75);assert.equal(u.order.z,61);assert.equal(u.orderQueue.length,1);cmd(s,{type:'move',ids:[u.id],x:55,z:55});assert.equal(u.order.x,55);assert.equal(u.orderQueue.length,0);
});
test('Stop cancels active movement and every queued waypoint',()=>{
 const s=scene(),u=s.spawn('grizzly',0,61,61);refresh(s);cmd(s,{type:'plan',ids:[u.id],orders:[{type:'move',x:75,z:61},{type:'move',x:75,z:75}]});step(s,10);cmd(s,{type:'stop',ids:[u.id]});const pos=[u.x,u.z];step(s,40);assert.deepEqual([u.x,u.z],pos);assert.equal(u.order,null);assert.deepEqual(u.orderQueue,[]);
});
test('Invalid plans are rejected atomically, including NaN and more than 64 nodes',()=>{
 const s=scene(),u=s.spawn('grizzly',0,61,61);refresh(s);cmd(s,{type:'move',ids:[u.id],x:75,z:61});const before=JSON.stringify(u.order);
 for(const orders of [[{type:'move',x:85,z:61},{type:'move',x:NaN,z:70}],Array.from({length:65},()=>({type:'move',x:80,z:80})),[{type:'sandbox',x:80,z:80}]]){assert.equal(s.command(0,{type:'plan',ids:[u.id],orders}).ok,false);assert.equal(JSON.stringify(u.order),before);}
});
test('Hidden-target IDs and another player units cannot be ordered',()=>{
 const s=scene({fogMode:'double'}),u=s.spawn('grizzly',0,61,61),enemy=s.spawn('rhino',1,150,150);refresh(s);
 assert.equal(s.command(0,{type:'target',ids:[u.id],target:enemy.id}).ok,false);assert.equal(s.command(0,{type:'move',ids:[enemy.id],x:80,z:80}).ok,false);
});
test('Queue plans survive save/load with deterministic continuation',()=>{
 const s=scene(),u=s.spawn('grizzly',0,61,61);refresh(s);cmd(s,{type:'plan',ids:[u.id],orders:[{type:'move',x:75,z:61},{type:'move',x:75,z:75}]});step(s,5);
 const clone=Sim.load(JSON.parse(JSON.stringify(s.save())));step(s,80);step(clone,80);assert.deepEqual(s.entities,clone.entities);assert.equal(clone.cfg.fogMode,'none');
});
test('Patrol reverses after reaching its endpoint',()=>{
 const s=scene(),u=s.spawn('grizzly',0,61,61);refresh(s);cmd(s,{type:'patrol',ids:[u.id],x:75,z:61});step(s,40);assert.equal(u.order.type,'patrol');assert.equal(u.order.returning,true);assert.ok(u.x<73);step(s,20);assert.equal(u.order.returning,false);
});
test('Guard engages without chasing enemies outside weapon range',()=>{
 const s=scene(),u=s.spawn('grizzly',0,61,61),v=s.spawn('rhino',1,85,61,{stun:100});refresh(s);cmd(s,{type:'guard',ids:[u.id]});step(s,40);assert.deepEqual([u.x,u.z],[61,61]);v.x=66;refresh(s);step(s,20);assert.ok(v.hp<v.maxHp);assert.deepEqual([u.x,u.z],[61,61]);
});
test('Scatter requires no mouse coordinates and produces finite movement orders',()=>{
 const s=scene(),u=s.spawn('grizzly',0,61,61);refresh(s);cmd(s,{type:'scatter',ids:[u.id]});assert.ok(Number.isFinite(u.order.x)&&Number.isFinite(u.order.z));step(s,25);assert.ok(!near(u,61,61,.1));
});
test('Force-fire can damage a friendly target while normal targeting cannot',()=>{
 const s=scene(),u=s.spawn('grizzly',0,61,61),ally=s.spawn('grizzly',0,69,61);refresh(s);cmd(s,{type:'forceAttack',ids:[u.id],target:ally.id});step(s,20);assert.ok(ally.hp<ally.maxHp);
});
test('Ctrl-style ground fire persists at a point and damages units at that point',()=>{
 const s=scene(),u=s.spawn('grizzly',0,61,61),ally=s.spawn('grizzly',0,69,61);refresh(s);cmd(s,{type:'forceAttack',ids:[u.id],x:69,z:61});step(s,20);assert.ok(ally.hp<ally.maxHp);assert.equal(u.order.type,'forceAttack');
});
test('Every building footprint snaps to the same 2-world-unit grid',()=>{
 const s=scene();for(const d of R.defs().filter(d=>d.kind==='building')){const f=R.foundation(d,77.13,89.83);assert.equal(f.left%2,0);assert.equal(f.top%2,0);assert.equal(f.right-f.left,d.footprint[0]*2);const e=s.spawn(d.id,0,77.13,89.83);assert.deepEqual([e.x,e.z],[f.x,f.z]);}
});
test('Foundation placement rejects map edges, occupied cells and blocking infantry',()=>{
 const s=scene();s.spawn('a_hq',0,61,61);refresh(s);assert.equal(s.placement(0,R.D.a_factory,-20,65).valid,false);assert.equal(s.placement(0,R.D.a_factory,61,61).valid,false);
 const check=s.placement(0,R.D.a_factory,77,61);assert.equal(check.valid,true,check.reason);s.spawn('gi',0,check.x,check.z);refresh(s);assert.equal(s.placement(0,R.D.a_factory,77,61).valid,false);
});
test('Placement checks all cells for land/water and denies unexplored ground',()=>{
 const s=scene({map:'coast',fogMode:'double'});s.spawn('a_hq',0,24,60);refresh(s);assert.equal(s.placement(0,R.D.a_factory,18,60).valid,false);assert.equal(s.placement(0,R.D.a_factory,170,150).valid,false);
 s.cfg.fogMode='none';refresh(s);assert.equal(s.placement(0,R.D.a_naval,10,60).valid,true);
});
test('Client preview and authoritative placement agree and share snapped coordinates',()=>{
 const s=scene();s.spawn('a_hq',0,61,61);refresh(s);const snap=s.snapshot(0),a=s.placement(0,R.D.a_factory,78.38,61.6),b=R.placementCheck({player:0,map:snap.map,entities:snap.entities,fog:snap.fog},R.D.a_factory,78.38,61.6);assert.deepEqual(a,b);assert.ok(a.valid);
 s.players[0].readySlots.building={type:'a_factory',cost:2000};const r=cmd(s,{type:'place',unit:'a_factory',x:78.38,z:61.6});assert.deepEqual([r.x,r.z],[a.x,a.z]);assert.equal(s.players[0].ready,null);
});
test('Building and defense production may both wait ready without blocking each other',()=>{
 const s=scene(),p=s.players[0];s.spawn('a_hq',0,61,61);s.spawn('a_power',0,51,61);refresh(s);cmd(s,{type:'queue',unit:'a_power'});cmd(s,{type:'queue',unit:'a_pillbox'});step(s,150);assert.equal(p.readySlots.building.type,'a_power');assert.equal(p.readySlots.defense.type,'a_pillbox');
});
test('Pause, resume and cancellation preserve progress and refund exact queue cost',()=>{
 const s=scene(),p=s.players[0];s.spawn('a_hq',0,61,61);refresh(s);const credits=p.credits;cmd(s,{type:'queue',unit:'a_power'});step(s,3);cmd(s,{type:'pauseQueue',category:'building',paused:true});const progress=p.queues.building[0].progress;step(s,25);assert.equal(p.queues.building[0].progress,progress);cmd(s,{type:'pauseQueue',category:'building',paused:false});step(s,2);assert.ok(p.queues.building[0].progress>progress);cmd(s,{type:'cancel',category:'building',unit:'a_power'});assert.equal(p.credits,credits);
});
test('Primary factory governs spawning and falls back after destruction',()=>{
 const s=scene(),p=s.players[0];s.spawn('a_hq',0,30,30);s.spawn('a_power',0,40,30);const a=s.spawn('a_factory',0,60,60),b=s.spawn('a_factory',0,100,100);refresh(s);cmd(s,{type:'primary',id:b.id});cmd(s,{type:'queue',unit:'grizzly'});step(s,65);const u=s.own(0).find(e=>e.type==='grizzly');assert.ok(u&&near(u,b.x,b.z,16));assert.equal(p.primary.factory,b.id);s.damage(b,999999,null,'blast');refresh(s);assert.equal(s.producer(p,R.D.grizzly).id,a.id);
});
test('Newly trained units inherit the full factory rally route',()=>{
 const s=scene();s.spawn('a_hq',0,30,30);s.spawn('a_power',0,40,30);const f=s.spawn('a_factory',0,60,60);refresh(s);cmd(s,{type:'rally',id:f.id,x:75,z:75});cmd(s,{type:'rally',id:f.id,x:90,z:75,append:true});cmd(s,{type:'queue',unit:'grizzly'});s.updateProduction(s.players[0],100);const u=s.own(0).find(e=>e.type==='grizzly');assert.ok(u);assert.equal(u.orderQueue.length,1);assert.deepEqual(u.orderQueue[0],{type:'move',x:90,z:75});
});
test('Blocked factory exit retains completed purchase until an exit is available',()=>{
 const s=scene(),p=s.players[0];s.spawn('a_hq',0,30,30);s.spawn('a_power',0,40,30);const f=s.spawn('a_factory',0,60,60);const size=R.D.a_factory.size/2+3;
 for(let ring=0;ring<4;ring++)for(const [dx,dz] of [[0,1],[.65,1],[-.65,1],[1,0],[-1,0],[0,-1]])s.spawn('grizzly',0,f.x+dx*(size+ring*2),f.z+dz*(size+ring*2),{stun:100});refresh(s);const blockers=s.own(0).filter(e=>e.type==='grizzly');cmd(s,{type:'queue',unit:'grizzly'});step(s,100);assert.equal(p.queues.vehicle.length,1);assert.match(p.queues.vehicle[0].blocked,/堵塞/);assert.equal(s.own(0).filter(e=>e.type==='grizzly').length,blockers.length);
 for(const b of blockers)b.hp=0;refresh(s);step(s,1);assert.equal(p.queues.vehicle.length,0);assert.equal(s.own(0).filter(e=>e.type==='grizzly').length,1);
});
test('Double fog hides departed enemies, retaining only last-seen building ghosts',()=>{
 const s=scene({fogMode:'double'}),scout=s.spawn('grizzly',0,61,61),enemy=s.spawn('rhino',1,67,61),building=s.spawn('s_factory',1,75,61);refresh(s);assert.ok(s.visible(0,enemy));const last=building.hp;scout.x=25;scout.z=25;building.hp-=100;refresh(s);const snap=s.snapshot(0);assert.equal(snap.fog[R.fogIndex(67,61)],1);assert.ok(!snap.entities.some(e=>e.id===enemy.id));const ghost=snap.entities.find(e=>e.id===building.id);assert.ok(ghost.ghost);assert.equal(ghost.hp,last);
});
test('Single fog permanently reveals explored terrain and moving enemies there',()=>{
 const s=scene({fogMode:'single'}),scout=s.spawn('grizzly',0,61,61),enemy=s.spawn('rhino',1,67,61);refresh(s);scout.x=25;scout.z=25;refresh(s);assert.equal(s.snapshot(0).fog[R.fogIndex(67,61)],2);assert.ok(s.snapshot(0).entities.some(e=>e.id===enemy.id));assert.equal(s.snapshot(0).fog[R.fogIndex(175,175)],0);
});
test('No-fog reveals all terrain but does not disable stealth detection rules',()=>{
 const s=scene(),u=s.spawn('grizzly',0,30,30),enemy=s.spawn('rhino',1,160,160),stealth=s.spawn('mirage',1,150,150);refresh(s);assert.ok(s.snapshot(0).fog.every(x=>x===2));assert.ok(s.visible(0,enemy));assert.equal(s.visible(0,stealth),false);
});
test('Snapshot redacts other players orders, paths, targets and rally destinations',()=>{
 const s=scene(),enemy=s.spawn('s_factory',1,100,100,{rally:{x:50,z:50},rallyQueue:[{x:60,z:50}]}),tank=s.spawn('rhino',1,140,140,{order:{type:'move',x:30,z:30},orderQueue:[{type:'move',x:40,z:40}],target:999});refresh(s);const snap=s.snapshot(0);
 for(const id of [enemy.id,tank.id]){const e=snap.entities.find(e=>e.id===id);for(const key of ['order','orderQueue','rally','rallyQueue','target','path','destination'])assert.equal(e[key],undefined,key);}
});
test('Hidden ore depletion does not leak through the double-fog snapshot',()=>{
 const s=scene({fogMode:'double'}),scout=s.spawn('grizzly',0,61,61);s.ores=[{id:77,x:67,z:61,amount:1000,gem:false}];refresh(s);scout.x=25;scout.z=25;refresh(s);s.ores[0].amount=25;assert.equal(s.snapshot(0).ores[0].amount,1000);
});
test('Network locks fog and sandbox commands; single-player can change all three modes',()=>{
 const s=scene({network:true});assert.equal(s.command(0,{type:'fogMode',mode:'none'}).ok,false);assert.equal(s.command(0,{type:'sandbox',action:'credits'}).ok,false);s.cfg.network=false;
 for(const mode of ['double','single','none']){cmd(s,{type:'fogMode',mode});assert.equal(s.cfg.fogMode,mode);}assert.equal(s.command(0,{type:'fogMode',mode:'bad'}).ok,false);
});

test('Rapid consecutive production right-clicks use server state, not stale client state',()=>{
 const s=scene(),p=s.players[0];s.spawn('a_hq',0,30,30);refresh(s);const credits=p.credits;cmd(s,{type:'queue',unit:'a_power'});
 cmd(s,{type:'secondaryProduction',category:'building',unit:'a_power'});assert.equal(p.queues.building[0].paused,true);
 cmd(s,{type:'secondaryProduction',category:'building',unit:'a_power'});assert.equal(p.queues.building.length,0);assert.equal(p.credits,credits);
});
test('Right-click ready building refunds it; shift-right-click also clears matching waiting items',()=>{
 const s=scene(),p=s.players[0];s.spawn('a_hq',0,30,30);refresh(s);const credits=p.credits;cmd(s,{type:'queue',unit:'a_power',count:3});step(s,100);assert.ok(p.readySlots.building);
 cmd(s,{type:'secondaryProduction',category:'building',unit:'a_power'});assert.equal(p.readySlots.building,null);assert.equal(p.queues.building.length,2);
 step(s,100);assert.ok(p.readySlots.building);cmd(s,{type:'secondaryProduction',category:'building',unit:'a_power',all:true});assert.equal(p.readySlots.building,null);assert.equal(p.queues.building.length,0);assert.equal(p.credits,credits);
});
const passed=results.filter(r=>r.passed).length;console.log(`\n${passed}/${results.length} operational checks passed`);fs.writeFileSync(path.join(__dirname,'operations-results.json'),JSON.stringify({version:R.VERSION,runtime:process.version,date:new Date().toISOString(),passed,total:results.length,results},null,2));
