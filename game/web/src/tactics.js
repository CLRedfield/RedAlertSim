/* Command Edition systems. Shared by the browser worker and the authoritative server. */
(function(G){'use strict';
const R=G.RA,D=R.D,P=R.Sim.prototype,dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),copy=o=>JSON.parse(JSON.stringify(o));
R.TRAINING=[
 {id:'move',title:'01 / 机动与编队',nation:'usa',objective:'选中起始坦克，移动到标记区域。至少两辆坦克抵达。',tip:'拖动框选后按 M，再点击目标；现代模式可以直接右键。',target:{x:57,z:133,radius:9}},
 {id:'build',title:'02 / 装甲生产线',nation:'usa',objective:'建造并放置战车工厂，然后训练一辆灰熊坦克。',tip:'Q 建筑栏 → 战车工厂 → 等待完成 → 再次点击放置；R 切到载具。'},
 {id:'capture',title:'03 / 油田控制',nation:'usa',objective:'把工程师送进附近的中立油井，取得持续收入。',tip:'选择工程师，左键点击油井；现代模式使用右键。',target:{x:59,z:149,radius:7}},
 {id:'ifv',title:'04 / 多功能步兵车',nation:'usa',objective:'工程师进入多功能步兵车，修复附近受损的灰熊坦克。',tip:'工程师上车后自动切换维修模式。靠近受损载具即可修理。'},
 {id:'control',title:'05 / 心灵控制',nation:'yuri',objective:'使用尤里复制人控制标记附近的敌方犀牛坦克。',tip:'选择尤里复制人后攻击目标。控制者被击杀时，目标恢复原归属。',target:{x:57,z:149,radius:8}}
];
P.initTactics=function(){
 this._journal=[];this._recording=true;this._commandDepth=0;this.mission=null;this.wave=null;
 for(const p of this.players){p.built=0;p.history=[];p.aiPlan=['harass','expand','combined','defend'][p.id%4];p.aiScout=8+p.id*2;}
 if(this.cfg.training){
  const spec=R.TRAINING.find(t=>t.id===this.cfg.training);
  if(spec){
   this.mission={...copy(spec),completed:false,progress:0,started:0};for(const p of this.players)p.ai=false;
   this.entities=this.entities.filter(e=>e.owner!==1||D[e.type].kind==='building');this.reindex();
   const add=(type,owner,x,z,extra)=>this.spawn(type,owner,x,z,extra);
   if(spec.id==='capture'){this.mission.unit=add('a_engineer',0,47,150).id;this.mission.subject=add('oil',-1,59,149).id;}
   if(spec.id==='ifv'){
    this.mission.unit=add('a_engineer',0,48,144).id;this.mission.car=add('ifv',0,53,146).id;
    this.mission.subject=add('grizzly',0,57,149,{hp:90}).id;
   }
   if(spec.id==='control'){
    this.mission.unit=add('yuri_clone',0,46,149).id;
    this.mission.subject=add('rhino',1,57,149,{stun:600,order:{type:'guard',x:57,z:149}}).id;
   }
   this.mission.initialTanks=this.own(0).filter(e=>e.type==='grizzly').length;
  }
 }
 if(this.cfg.challenge==='survival'){
  for(const p of this.players)if(p.id!==0)p.ai=false;
  this.wave={number:0,next:45,total:6,completed:false};this.players[0].credits=18000;
  this.spawn(R.FACTIONS[this.players[0].faction].factory,0,47,143);this.spawn(R.FACTIONS[this.players[0].faction].radar,0,30,138);
 }
 this.ensureSlaves();this.reindex();this.updateFog();this._initialSave=copy(this.save());
};
P.ensureSlaves=function(){
 for(const master of [...this.entities]){
  const d=D[master.type];
  if(master.hp<=0||master.owner<0||!(d.role==='refinery'&&d.faction==='yuri'||d.selfMine&&master.deployed))continue;
  const slaves=this.entities.filter(e=>e.hp>0&&e.master===master.id);
  if(master.nextSlave>this.time)continue;
  if(slaves.length<5&&this.entities.length<2900){
   const i=slaves.length,pos=this.freeSpot(D.y_slave,master.x+5+(i%2)*1.2,master.z+2+Math.floor(i/2));
   this.spawn('y_slave',master.owner,pos.x,pos.z,{master:master.id,cargo:0});master.nextSlave=this.time+2;
  }
 }
};
P.tickSlave=function(e,dt){
 const master=this.lookup.get(e.master);
 if(!master||master.hp<=0){e.master=null;return;}
 if(master.owner!==e.owner)e.owner=master.owner;
 if(D[master.type].selfMine&&!master.deployed){
  if(dist(e,master)>5)this.move(e,master.x,master.z,dt,4);return;
 }
 if(e.cargo>=45){
  if(dist(e,master)<D[master.type].size*.65+1){const p=this.players[e.owner];if(p){p.credits+=e.cargo;p.earned+=e.cargo;}e.cargo=0;e.path=[];}
  else this.move(e,master.x,master.z,dt,D[master.type].size*.65+1);
 }else{
  let ore=this.ores.find(o=>o.id===e.slaveOre&&o.amount>0&&dist(o,master)<38);
  if(!ore)ore=this.ores.filter(o=>o.amount>0&&dist(o,master)<38).sort((a,b)=>dist(a,master)-dist(b,master))[0];
  if(!ore)return;e.slaveOre=ore.id;
  if(dist(e,ore)<4){const n=Math.min(45-e.cargo,ore.amount,(ore.gem?23:15)*dt);e.cargo+=n;ore.amount-=n;}
  else this.move(e,ore.x,ore.z,dt,3.6);
 }
};
const oldCommand=P.command;
P.command=function(pid,c){
 // Do not record nested secondary-production / AI calls twice.
 const outer=!this._commandDepth;this._commandDepth=(this._commandDepth||0)+1;let result;
 try{
  if(c?.type==='unloadOne'){
   const carrier=this.lookup.get(+c.carrier),unit=this.lookup.get(+c.id);
   if(!carrier||carrier.owner!==pid||!unit||unit.inside!==carrier.id||!carrier.passengers.includes(unit.id))return{ok:false,error:'乘员或载具无效'};
   const pos=this.freeSpot(D[unit.type],carrier.x+D[carrier.type].size+2,carrier.z+2);
   unit.inside=null;unit.x=pos.x;unit.z=pos.z;unit.order=null;carrier.passengers=carrier.passengers.filter(id=>id!==unit.id);result={ok:true};
  }else result=oldCommand.call(this,pid,c);
 }finally{this._commandDepth--;}
 if(outer&&result?.ok&&this._recording&&!this._inAI){
  if((this._journal?.length||0)<30000)(this._journal??=[]).push({tick:this.tick,player:pid,command:copy(c)});else this.recordingTruncated=true;
 }
 return result;
};
const oldTick=P.tickStep;
P.tickStep=function(){
 if(this.paused||this.winner!==null&&!this.cfg.sandbox)return;
 if(this.tick%10===0){
  this.ensureSlaves();
  for(const e of this.entities)if(e.type==='s_tesla'){
   e.chargers=this.entities.filter(t=>t.hp>0&&t.owner===e.owner&&t.type==='tesla_trooper'&&!t.inside&&dist(e,t)<8&&!t.moving).slice(0,3).map(t=>t.id);
   e.charged=e.chargers.length>=2;
  }
 }
 for(const e of this.entities){
  if(e.lifted>0)e.lifted=Math.max(0,e.lifted-R.STEP);
  if(e.bomb){e.bomb.time-=R.STEP;if(e.bomb.time<=0){const b=e.bomb;e.bomb=null;const source=this.lookup.get(b.source);this.damage(e,b.damage,source,'blast');this.splash(e.x,e.z,4,b.damage*.45,source,e.id);this.emit('explosion',e.x,e.z,{radius:5,life:1.3});}}
 }
 oldTick.call(this);
 if(this.tick%10===0){this.updateMission();this.updateWaves();}
 if(this.tick%100===0)for(const p of this.players){p.history??=[];p.history.push({t:Math.round(this.time),credits:Math.floor(p.credits),earned:Math.floor(p.earned),army:this.own(p.id).filter(e=>!e.inside&&D[e.type].kind!=='building').length});if(p.history.length>1500)p.history.shift();}
};
P.updateMission=function(){
 const m=this.mission;if(!m||m.completed)return;
 if(m.id==='move'){m.progress=this.own(0).filter(e=>D[e.type].kind==='vehicle'&&D[e.type].damage>0&&dist(e,m.target)<m.target.radius).length;m.completed=m.progress>=2;}
 if(m.id==='build'){m.progress=(this.has(0,'factory')?1:0)+(this.own(0).filter(e=>e.type==='grizzly').length>m.initialTanks?1:0);m.completed=m.progress>=2;}
 if(m.id==='capture'){m.completed=this.lookup.get(m.subject)?.owner===0;m.progress=m.completed?1:0;}
 if(m.id==='ifv'){const car=this.lookup.get(m.car);if(car?.passengers.includes(m.unit))m.loaded=true;const t=this.lookup.get(m.subject);m.progress=t?Math.round(t.hp/t.maxHp*100):0;m.completed=!!m.loaded&&!!t&&t.hp>=t.maxHp*.96;}
 if(m.id==='control'){const t=this.lookup.get(m.subject);m.completed=t?.owner===0&&t.controlledBy===m.unit;m.progress=m.completed?1:0;}
 if(m.completed){m.finished=this.time;this.emit('ready',34,154,{owner:0,life:1});}
};
P.updateWaves=function(){
 const w=this.wave;if(!w||w.completed)return;
 const target=this.own(0,'hq')[0]||this.own(0)[0];if(!target)return;
 if(this.time>=w.next&&w.number<w.total){
  w.number++;w.next=this.time+55;
  for(let i=0;i<4+w.number*2;i++){
   const type=w.number>=4&&i%4===0?'apocalypse':i%3===0?'conscript':'rhino';
   const pos=this.freeSpot(D[type],82+(i%4)*3,99+Math.floor(i/4)*3);
   const e=this.spawn(type,1,pos.x,pos.z,{waveUnit:true});
   this._inAI=true;this.command(1,{type:'attackMove',ids:[e.id],x:target.x,z:target.z});this._inAI=false;
  }
  this.emit('alert',82,99,{owner:0,life:2});
 }
 if(w.number===w.total&&!this.entities.some(e=>e.hp>0&&e.waveUnit)){w.completed=true;this.winner=this.players[0].team;}
};
// Separate lifted and disabled states. A magnet pulse must not erase another debuff.
const oldMove=P.move;
P.move=function(e,x,z,dt,stop=1){if(e.lifted>0)return false;return oldMove.call(this,e,x,z,dt,stop);};
const oldWeapon=P.weapon;
P.weapon=function(e){
 let w=oldWeapon.call(this,e);
 if(e.type==='s_tesla'&&e.chargers?.length){w.damage*=1+Math.min(3,e.chargers.length)*.2;w.range+=2;}
 if(e.type==='ifv'&&e.passengers.length){
  const passenger=this.lookup.get(e.passengers[0]),pd=passenger&&D[passenger.type];
  if(pd){
   w.infOnly=!!pd.infOnly;w.control=pd.control?1:undefined;w.aa=!!pd.aa||pd.weapon==='missile';
   if(pd.ability==='engineer')w.mode='维修';
   else if(pd.control)w.mode='心灵控制';
   else if(pd.infOnly)w.mode='狙击';
   else if(pd.weapon==='tesla'){w.mode='磁暴';w.weapon='tesla';w.damage=110;w.range=21;}
   else if(pd.weapon==='prism'||pd.weapon==='chrono'){w.mode='能量';w.weapon=pd.weapon;}
   else w.mode='载员火力';
   if(pd.ability==='engineer')w.damage=0;
   e.weaponMode=w.mode;
  }
 }else if(e.type==='ifv')e.weaponMode='防空导弹';
 return w;
};
const oldLegal=P.legalTarget;
P.legalTarget=function(e,t,w,force=false){
 if(w.infOnly&&D[t.type].kind!=='infantry')return false;
 if((D[e.type].control||w.control)&&t.controlledBy===e.id)return false;
 return oldLegal.call(this,e,t,w,force);
};
const oldFire=P.fire;
P.fire=function(e,t,w){
 if(['ivan','chrono_ivan'].includes(e.type)){
  e.cooldown=w.cooldown;e.recentFire=1;
  if(!t.bomb){t.bomb={source:e.id,time:7,damage:w.damage};this.emit('capture',t.x,t.z,{owner:e.owner,life:.8});}
  return;
 }
 if(w.weapon==='magnet'&&D[t.type].kind==='vehicle'){
  e.cooldown=w.cooldown;e.recentFire=2;t.lifted=2.6;
  const dx=e.x-t.x,dz=e.z-t.z,l=Math.hypot(dx,dz)||1;
  if(l>9){const nx=t.x+dx/l*2,nz=t.z+dz/l*2;if(this.walkable(nx,nz,D[t.type])){t.x=nx;t.z=nz;t.path=[];}}
  this.emit('shot',e.x,e.z,{tx:t.x,tz:t.z,y:3,ty:5,weapon:'magnet',owner:e.owner,life:.5});return;
 }
 const oldOwner=t.owner;oldFire.call(this,e,t,w);
 if(t.owner!==oldOwner&&t.controlledBy===e.id){
  for(const id of t.passengers||[]){const u=this.lookup.get(id);if(u){u.originalOwner=u.owner;u.owner=t.owner;u.passengerController=t.id;}}
 }
};
const oldDamage=P.damage;
P.damage=function(t,amount,source,weapon){
 if(source)t.lastAttacker=source.owner;oldDamage.call(this,t,amount,source,weapon);
};
const oldDestroy=P.destroy;
P.destroy=function(e){
 if(e.dead)return;
 for(const slave of this.entities.filter(s=>s.master===e.id&&s.hp>0)){
  slave.master=null;slave.freed=true;slave.order=null;slave.path=[];
  slave.owner=Number.isInteger(e.lastAttacker)&&e.lastAttacker>=0&&e.lastAttacker!==e.owner?e.lastAttacker:-1;
 }
 for(const carrier of this.entities.filter(t=>t.controlledBy===e.id))for(const id of carrier.passengers||[]){const u=this.lookup.get(id);if(u?.passengerController===carrier.id){u.owner=u.originalOwner??carrier.originalOwner;u.originalOwner=null;u.passengerController=null;}}
 oldDestroy.call(this,e);
};
// Aircraft reserve real pads rather than all reloading simultaneously at a single point.
P.reloadAircraft=function(e,dt){
 const d=D[e.type];if(e.ammo>0&&!e.returning){e.flightPhase='combat';return false;}
 e.returning=true;const fields=this.own(e.owner,'airfield').sort((a,b)=>dist(e,a)-dist(e,b));
 let field=this.lookup.get(e.airfield);
 if(!field||field.owner!==e.owner||field.hp<=0)field=fields[0];
 if(!field){e.flightPhase='no-airfield';e.airfield=null;e.reload=0;return true;}
 e.airfield=field.id;
 const docked=this.entities.filter(t=>t.id!==e.id&&t.hp>0&&t.airfield===field.id&&t.flightPhase==='rearming');
 if(dist(e,field)>7){e.flightPhase='returning';this.move(e,field.x,field.z,dt,6);return true;}
 const used=new Set(docked.map(t=>t.pad));let pad=e.flightPhase==='rearming'&&!used.has(e.pad)?e.pad:[0,1,2,3].find(i=>!used.has(i));
 if(pad===undefined){e.flightPhase='holding';return true;}
 e.pad=pad;e.flightPhase='rearming';e.x=field.x+(pad%2?2:-2);e.z=field.z+(pad<2?2:-2);e.reload+=dt;
 if(e.reload>=6){e.reload=0;e.ammo=d.ammo;e.returning=false;e.flightPhase='combat';e.airfield=null;}
 return true;
};
// Fair AI chooses targets from visible or previously discovered data, never live hidden HQ positions.
P.ai=function(p){
 this._inAI=true;
 try{
  const F=R.FACTIONS[p.faction],base=this.own(p.id,'hq')[0],difficulty=this.cfg.slots?.[p.id]?.difficulty||this.cfg.difficulty;
  if(this.time>=p.aiNext){
   p.aiNext=this.time+(difficulty==='hard'?2.2:difficulty==='easy'?6:4)+this.rand();
   const mcv=this.own(p.id).find(e=>D[e.type].ability==='mcv');if(mcv)this.deploy(mcv);
   for(const slot of ['building','defense'])if(p.readySlots[slot]){
    const item=p.readySlots[slot],d=D[item.type],h=base||this.own(p.id)[0];
    if(h){let center=h;
     if(d.role==='refinery'&&this.has(p.id,'refinery')){const candidate=this.ores.filter(o=>o.amount>5000&&p.seen[R.fogIndex(o.x,o.z)]&&dist(o,h)<38).sort((a,b)=>dist(b,h)-dist(a,h))[0];if(candidate)center=candidate;}
     for(let k=0;k<80;k++){const r=8+this.rand()*25,a=this.rand()*Math.PI*2,x=center.x+Math.cos(a)*r,z=center.z+Math.sin(a)*r;if(this.validPlace(p.id,d,x,z)){this.command(p.id,{type:'place',unit:d.id,x,z});break;}}
    }
   }
   const buildPlan=[F.power,F.refinery,F.barracks,F.factory,F.radar,F.tech];
   let desired=buildPlan.find(id=>!this.own(p.id).some(e=>e.type===id));if(p.power<p.drain+70)desired=F.power;
   if(!desired&&p.aiPlan==='expand'&&this.own(p.id,'refinery').length<2&&p.credits>3500)desired=F.refinery;
   if(desired&&!p.queues.building.length&&!p.readySlots.building)this.command(p.id,{type:'queue',unit:desired});
   if(!p.queues.defense.length&&!p.readySlots.defense&&this.has(p.id,'radar')&&this.own(p.id,'defense').length<3)
    this.command(p.id,{type:'queue',unit:p.faction==='allies'?'a_prism':p.faction==='soviet'?'s_tesla':'y_psychic'});
   if(this.has(p.id,'tech')&&!p.queues.defense.length&&!this.own(p.id,'super').length&&p.credits>7000)
    this.command(p.id,{type:'queue',unit:p.faction==='allies'?'a_weather':p.faction==='soviet'?'s_nuke':'y_dominator'});
   const visible=this.entities.filter(e=>e.owner>=0&&this.players[e.owner]?.team!==p.team&&e.hp>0&&!e.inside&&this.visible(p.id,e));
   if(this.has(p.id,'factory')&&p.queues.vehicle.length<2){
    let choices=[F.tank,F.tank];
    if(this.has(p.id,'tech'))choices.push(...(p.faction==='allies'?['prism_tank','mirage']:p.faction==='soviet'?['apocalypse','v3']:['mastermind','magnetron']));
    if(visible.some(e=>D[e.type].kind==='air'))choices=[p.faction==='allies'?'ifv':p.faction==='soviet'?'flak_track':'gattling_tank'];
    choices=choices.filter(id=>D[id]&&this.canBuild(p,id));
    if(choices.length){let id=choices[Math.floor(this.rand()*choices.length)];if(this.own(p.id).filter(e=>D[e.type].ability==='miner').length<2)id=F.miner;this.command(p.id,{type:'queue',unit:id});}
   }
   if(this.has(p.id,'barracks')&&p.queues.infantry.length<2&&this.own(p.id).filter(e=>D[e.type].kind==='infantry'&&!D[e.type].sandboxOnly).length<16){
    const oil=visible.find(e=>D[e.type].role==='oil');
    const neutralOil=this.entities.find(e=>e.owner<0&&D[e.type].role==='oil'&&this.visible(p.id,e));
    const eng=p.faction==='allies'?'a_engineer':p.faction==='soviet'?'s_engineer':'y_engineer';
    this.command(p.id,{type:'queue',unit:neutralOil&&!this.own(p.id).some(e=>D[e.type].ability==='engineer')&&D[eng]?eng:F.inf});
   }
   for(const e of this.own(p.id)){
    const d=D[e.type];
    if(d.kind==='building'&&e.hp<e.maxHp*.7&&p.credits>500)e.repairing=true;
    if(d.selfMine&&!e.deployed)this.deploy(e);
    if(d.ability==='engineer'&&!e.order){const oil=this.entities.filter(t=>D[t.type].role==='oil'&&t.owner<0&&this.visible(p.id,t)).sort((a,b)=>dist(a,e)-dist(b,e))[0];if(oil)this.command(p.id,{type:'target',ids:[e.id],target:oil.id,x:oil.x,z:oil.z});}
    if(d.kind==='vehicle'&&d.damage>0&&e.hp<e.maxHp*.23&&base&&dist(e,base)>24){this.command(p.id,{type:'move',ids:[e.id],x:base.x+8,z:base.z+9});e.retreatUntil=this.time+16;}
   }
   // This option is deliberately labeled in the UI; normal/easy have no economy bonus.
   if(difficulty==='hard'){p.credits+=90;p.earned+=90;}
   if(base){const attackers=visible.filter(e=>D[e.type].damage>0&&dist(e,base)<38);if(attackers.length){const army=this.own(p.id).filter(e=>D[e.type].kind!=='building'&&D[e.type].damage>0&&D[e.type].ability!=='miner'&&!e.inside);this.command(p.id,{type:'attackMove',ids:army.map(e=>e.id),x:attackers[0].x,z:attackers[0].z});}}
  }
  if(this.time>=(p.aiScout||8)){
   p.aiScout=this.time+28;
   const scout=this.own(p.id).find(e=>D[e.type].kind!=='building'&&D[e.type].damage>0&&D[e.type].ability!=='miner'&&!e.inside&&e.hp>e.maxHp*.6);
   // Starting seats are public lobby information, not live hidden enemy intelligence.
   const occupied=this.players.filter(q=>!q.closed&&q.team!==p.team).map(q=>R.SPAWNS[q.spawnId]).filter(Boolean);
   const unknown=occupied.map(([x,z])=>({x,z})).filter(o=>!p.seen[R.fogIndex(o.x,o.z)]);
   const points=unknown.length?unknown:R.SPAWNS.map(([x,z])=>({x,z})).filter(o=>!p.seen[R.fogIndex(o.x,o.z)]);
   if(scout&&points.length){const target=points[Math.floor(this.rand()*points.length)];this.command(p.id,{type:'move',ids:[scout.id],...target});}
  }
  if(this.time>=p.aiAttack){
   p.aiAttack=this.time+(difficulty==='easy'?62:difficulty==='hard'?30:43)+this.rand()*10;
   if(!base)return;
   const intel=Object.values(p.memory).filter(e=>e.owner>=0&&this.players[e.owner]?.team!==p.team&&['hq','refinery','factory'].includes(D[e.type].role));
   intel.sort((a,b)=>dist(a,base)-dist(b,base));
   const target=(p.aiPlan==='harass'?intel.find(e=>D[e.type].role==='refinery'):null)||intel[0];
   const army=this.own(p.id).filter(e=>D[e.type].kind!=='building'&&D[e.type].ability!=='miner'&&D[e.type].ability!=='mcv'&&D[e.type].ability!=='slave'&&(D[e.type].damage>0||D[e.type].control)&&!e.inside&&(e.retreatUntil||0)<this.time);
   if(target&&army.length>=3){this.command(p.id,{type:'attackMove',ids:army.map(e=>e.id),x:target.x,z:target.z});
    for(const e of this.own(p.id))if(D[e.type].super&&e.charge>=D[e.type].charge)this.useSuper(p,{ability:D[e.type].super,x:target.x,z:target.z,ids:army.map(e=>e.id)});
   }
  }
 }finally{this._inAI=false;}
};
const oldSnapshot=P.snapshot;
P.snapshot=function(pid=0){
 const s=oldSnapshot.call(this,pid);s.mission=this.mission?copy(this.mission):null;s.wave=this.wave?copy(this.wave):null;
 s.content={build:R.BUILD,rules:R.RULES_HASH,map:R.MAP_HASH};
 // Passenger names and health are only exposed to their current controller.
 for(const e of s.entities)if(e.owner===pid&&e.passengers?.length)e.manifest=e.passengers.map(id=>this.lookup.get(id)).filter(Boolean).map(u=>({id:u.id,type:u.type,hp:u.hp,maxHp:u.maxHp}));
 delete s.p.aiPlan;delete s.p.aiNext;delete s.p.aiScout;delete s.p.aiAttack;
 return s;
};
const oldSave=P.save;
P.save=function(){return{...oldSave.call(this),mission:this.mission,wave:this.wave,initialTeams:this.initialTeams};};
P.exportReplay=function(){return{format:'ra3d-replay-v1',version:R.VERSION,content:R.CONTENT_HASH,rules:R.RULES_HASH,map:R.MAP_HASH,initial:this._initialSave||copy(this.save()),commands:copy(this._journal||[]),endTick:this.tick,winner:this.winner,truncated:!!this.recordingTruncated};};
R.Replay=class{
 constructor(data){
  if(data?.format!=='ra3d-replay-v1'||data.content!==R.CONTENT_HASH)throw new Error('录像格式或规则版本不兼容');
  if(!Array.isArray(data.commands)||data.commands.length>30000||!Number.isInteger(data.endTick)||data.endTick>360000||data.endTick<0)throw new Error('录像超出允许范围');
  if(data.truncated)throw new Error('录像记录达到上限，不能保证完整重放');
  let last=-1;for(const c of data.commands){if(!Number.isInteger(c.tick)||c.tick<last||c.tick>data.endTick||!Number.isInteger(c.player))throw new Error('录像指令时间或身份无效');last=c.tick;}
  this.data=copy(data);this.reset();
 }
 reset(){this.sim=R.Sim.load(copy(this.data.initial));this.sim._recording=false;this.sim._journal=[];this.index=0;this.done=false;}
 step(){
  while(this.index<this.data.commands.length&&this.data.commands[this.index].tick<=this.sim.tick){const c=this.data.commands[this.index++];this.sim.command(c.player,c.command);}
  if(this.sim.tick>=this.data.endTick){this.done=true;return;}
  const tick=this.sim.tick;this.sim.tickStep();if(this.sim.tick===tick)this.done=true;
 }
 seek(tick){this.reset();const end=Math.max(this.sim.tick,Math.min(this.data.endTick,Math.floor(tick)));while(this.sim.tick<end&&!this.done)this.step();return this.sim.snapshot(0);}
};
})(globalThis);
