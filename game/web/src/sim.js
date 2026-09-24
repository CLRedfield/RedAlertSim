/* Shared, renderer-independent fixed-step simulation. Used unmodified by Worker and Node server. */
(function(G){'use strict';const R=G.RA,D=R.D,SIZE=R.SIZE,CELL=2,N=96,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
class Sim{
 constructor(config={}){this.cfg={seed:260905,map:'coast',players:8,nation:'usa',difficulty:'normal',credits:10000,startBase:true,sandbox:false,teams:'ffa',speed:1,fogMode:'single',...config};this.cfg.fogMode=R.FOG_MODES[this.cfg.fogMode]?this.cfg.fogMode:'single';this.cfg.slots=R.resolveSlots(this.cfg);this.spawnAssignments=R.allocateSpawns(this.cfg.slots);this.seed=this.cfg.seed>>>0;this.tick=0;this.time=0;this.nextId=1;this.fxId=1;this.entities=[];this.effects=[];this.projectiles=[];this.ores=[];this.players=[];this.winner=null;this.paused=false;this.dirty=true;this.grid=new Uint8Array(N*N);this.lookup=new Map();this.hash=new Map();this.pathBudget=0;
 for(let i=0;i<clamp(+this.cfg.players||8,2,8);i++){const nn=R.nation(this.cfg.slots?.[i]?.nation||(i===0?this.cfg.nation:R.NATIONS[(i*3+1)%10].id));const t=this.cfg.slots[i].team;this.players.push({id:i,name:this.cfg.slots?.[i]?.name||(i===0?'指挥官':'电脑 '+i),nation:nn.id,faction:nn.faction,color:R.COLORS[this.cfg.slots[i].color],colorIndex:this.cfg.slots[i].color,spawnId:this.spawnAssignments[i]??0,closed:this.cfg.slots[i].closed,team:t,ai:!((this.cfg.slots?!!this.cfg.slots[i]?.human:i===0)),credits:this.cfg.sandbox&&i===0?999999:+this.cfg.credits||10000,power:0,drain:0,blackout:0,queues:{building:[],defense:[],infantry:[],vehicle:[]},ready:null,readySlots:{building:null,defense:null},primary:{},oreMemory:{},seen:Array(4096).fill(0),fog:Array(4096).fill(0),memory:{},alive:!this.cfg.slots[i].closed,kills:0,lost:0,earned:0,spent:0,aiNext:5+i,aiAttack:50+i*6,paradrop:0,unlocks:[]});}
 this.initialTeams=[...new Set(this.players.filter(p=>p.alive).map(p=>p.team))];this.createMap();for(const p of this.players)if(p.alive)this.startPlayer(p);this.reindex();this.rebuildGrid();this.updateFog();this.updatePower();this.initTactics?.(); }
 rand(){let x=this.seed;x^=x<<13;x^=x>>>17;x^=x<<5;this.seed=x>>>0;return(this.seed||1)/4294967296;}
 createMap(){const objects=R.mapObjects(this.cfg.map);this.ores=objects.ores;for(const e of objects.neutrals)this.spawn(e.type,-1,e.x,e.z);}
 startPlayer(p){
  const [x,z]=R.SPAWNS[p.spawnId],F=R.FACTIONS[p.faction];
  // Rotate the whole starting base as well as resource geometry, preserving equal travel times.
  const angle=Math.atan2(96-x,96-z)-Math.atan2(62,-58),co=Math.cos(angle),si=Math.sin(angle);
  const put=(type,dx,dz)=>this.spawn(type,p.id,x+dx*co+dz*si,z-dx*si+dz*co,{angle,aim:angle});
  if(this.cfg.startBase){put(F.hq,0,0);put(F.power,-9,3);put(F.barracks,8,-1);put(F.refinery,1,-12);put(F.miner,3,-19);}
  else put(p.faction==='allies'?'a_mcv':p.faction==='soviet'?'s_mcv':'y_mcv',0,0);
  for(let i=0;i<3;i++)put(F.inf,-4+i*2,-6);for(let i=0;i<2;i++)put(F.tank,5+i*3,8);
 }
 spawn(type,owner,x,z,extra={}){const d=D[type];if(!d)return null;if(this.entities.length>=3000)return null;if(d.kind==='building'){const f=R.foundation(d,x,z);x=f.x;z=f.z;}let e={id:this.nextId++,type,owner,x:clamp(x,1,191),z:clamp(z,1,191),hp:d.hp,maxHp:d.hp,angle:Math.PI/2,aim:Math.PI/2,cooldown:0,order:null,orderQueue:[],stopped:false,path:[],pathIndex:0,repath:0,target:null,deployed:false,cargo:0,passengers:[],xp:0,rank:0,invul:0,stun:0,berserk:0,infection:0,controlledBy:null,originalOwner:null,ammo:d.ammo||0,reload:0,charge:0,moving:false,born:this.time,rally:null,...extra};this.entities.push(e);this.lookup.set(e.id,e);if(d.kind==='building')this.dirty=true;return e;}
 reindex(){this.lookup=new Map(this.entities.filter(e=>e.hp>0).map(e=>[e.id,e]));this.hash=new Map();for(const e of this.entities){if(e.hp<=0||e.inside)continue;const k=((e.x/10)|0)+','+((e.z/10)|0);let list=this.hash.get(k);if(!list)this.hash.set(k,list=[]);list.push(e);}}
 near(x,z,r){const out=[];for(let a=Math.floor((x-r)/10);a<=Math.floor((x+r)/10);a++)for(let b=Math.floor((z-r)/10);b<=Math.floor((z+r)/10);b++){const v=this.hash.get(a+','+b);if(v)out.push(...v);}return out;}
 own(p,role){return this.entities.filter(e=>e.hp>0&&e.owner===p&&(!role||D[e.type].role===role));}
 has(p,role){if(role==='radar')return this.own(p).some(e=>['radar','airfield'].includes(D[e.type].role));return this.own(p,role).length>0;}
 price(p,d){return Math.round(d.cost*(d.kind!=='building'&&d.kind!=='infantry'&&this.has(p.id,'industry')?.75:1));}
 requirements(p,d){if(this.cfg.sandbox&&p.id===0)return true;return(d.requires||[]).every(r=>this.has(p.id,r));}
 canBuild(p,type){const d=D[type];if(!d||d.faction!==p.faction||d.sandboxOnly||d.role==='hq'||d.nation&&d.nation!==p.nation)return false;if(!this.requirements(p,d))return false;if(d.kind==='building')return this.has(p.id,'hq')&&(!d.water||this.cfg.map==='coast');if(d.kind==='infantry')return this.has(p.id,'barracks');if(d.kind==='ship')return this.has(p.id,'naval');if(d.producer==='airfield')return this.has(p.id,'airfield');return this.has(p.id,'factory');}
 emit(type,x,z,extra={}){this.effects.push({id:this.fxId++,type,x,z,life:type==='explosion'?1.2:.5,age:0,...extra});}
 visible(player,e){if(e.owner===player||e.owner>=0&&this.players[e.owner]?.team===this.players[player]?.team)return true;const p=this.players[player];if(!p)return false;const idx=clamp(Math.floor(e.z/3),0,63)*64+clamp(Math.floor(e.x/3),0,63);if(!p.fog[idx])return false;const d=D[e.type];if((d.stealth&&!e.moving&&!e.recentFire||this.near(e.x,e.z,16).some(t=>t.owner===e.owner&&D[t.type].role==='gap'&&this.players[t.owner]?.power>=this.players[t.owner]?.drain))&&!this.near(e.x,e.z,13).some(t=>t.owner===player&&dist(e,t)<(D[t.type].detector?20:11)))return false;return true;}
 enemy(a,b){if(a.owner<0||b.owner<0)return false;if(a.berserk>0)return a.id!==b.id;return this.players[a.owner]?.team!==this.players[b.owner]?.team;}
 command(pid,c) {
    const p=this.players[pid], fail=error=>({ok:false,error});
    if(!p||!p.alive||!c||typeof c!=='object') return fail('无法执行指令');
    const type=c.type;
    if(type==='fogMode') {
        if(this.cfg.network) return fail('联机迷雾规则由房主在开局前设置，开局后锁定');
        if(!R.FOG_MODES[c.mode]) return fail('未知迷雾模式');
        this.cfg.fogMode=c.mode;this.cfg.reveal=false;this.updateFog();return {ok:true};
    }
    if(type==='queue') {
        if(this.entities.length>=2950)return fail('战区实体容量已满，请减少单位');
        const d=D[c.unit];if(!this.canBuild(p,c.unit))return fail('缺少科技前置或生产设施');
        const q=p.queues[d.category];if(!q||q.length>=24)return fail('生产队列已满');
        if(d.hero&&(this.own(pid).some(e=>e.type===d.id)||q.some(e=>e.type===d.id)))return fail('英雄单位只能拥有一个');
        const count=d.hero?1:clamp(Math.floor(c.count)||1,1,5);let n=0;
        for(let i=0;i<count;i++){const cost=this.price(p,d);if(p.credits<cost||q.length>=24)break;
            p.credits-=cost;p.spent+=cost;q.push({type:d.id,progress:0,total:d.buildTime,cost,paused:false});n++;}
        return n?{ok:true}:fail('资金不足');
    }
    if(type==='secondaryProduction') {
        const d=D[c.unit];if(!d||d.category!==c.category)return fail('无效生产图标');
        const slot=Object.keys(p.readySlots).find(k=>p.readySlots[k]?.type===c.unit);
        if(slot&&!c.all){p.credits+=p.readySlots[slot].cost;p.readySlots[slot]=null;this.syncReady(p);return {ok:true};}
        const item=p.queues[c.category]?.[0];
        if(!c.all&&item?.type===c.unit&&!item.paused){item.paused=true;return {ok:true};}
        return this.command(pid,{type:'cancel',category:c.category,unit:c.unit,all:!!c.all});
    }
    if(type==='cancel') {
        const q=p.queues[c.category];if(!q)return fail('无效队列');
        let i=q[0]?.type===c.unit?0:q.map(v=>v.type).lastIndexOf(c.unit);
        if(c.all){for(let j=q.length-1;j>=0;j--)if(q[j].type===c.unit){p.credits+=q[j].cost;q.splice(j,1);}for(const slot of Object.keys(p.readySlots))if(p.readySlots[slot]?.type===c.unit){p.credits+=p.readySlots[slot].cost;p.readySlots[slot]=null;}}
        else if(i>=0){p.credits+=q[i].cost;q.splice(i,1);}
        else {const slot=Object.keys(p.readySlots).find(k=>p.readySlots[k]?.type===c.unit);if(slot){p.credits+=p.readySlots[slot].cost;p.readySlots[slot]=null;}}
        this.syncReady(p);return {ok:true};
    }
    if(type==='pauseQueue') {
        const q=p.queues[c.category];if(!q?.[0]||c.unit&&q[0].type!==c.unit)return fail('没有对应的进行中生产');
        q[0].paused=typeof c.paused==='boolean'?c.paused:!q[0].paused;return {ok:true};
    }
    if(type==='place') {
        const slot=c.unit?Object.keys(p.readySlots).find(k=>p.readySlots[k]?.type===c.unit):p.readySlots.building?'building':'defense';
        const item=p.readySlots[slot];if(!item)return fail('没有对应的待放置建筑');
        const d=D[item.type],check=this.placement(pid,d,c.x,c.z);
        if(!check.valid)return fail(check.reason);
        const e=this.spawn(d.id,pid,check.x,check.z);p.readySlots[slot]=null;this.syncReady(p);this.onBuilt(e);
        return {ok:true,id:e.id,x:e.x,z:e.z};
    }
    if(type==='sell'||type==='repair') {
        const e=this.lookup.get(+c.id);if(!e||e.owner!==pid||D[e.type].kind!=='building')return fail('请选择己方建筑');
        if(type==='sell'){p.credits+=Math.floor(D[e.type].cost*.5*e.hp/e.maxHp);e.sold=true;e.hp=0;this.destroy(e);}
        else e.repairing=!e.repairing;return {ok:true};
    }
    if(type==='primary') {
        const e=this.lookup.get(+c.id),role=e&&D[e.type].role;
        if(!e||e.owner!==pid||!R.PRODUCER_ROLES.includes(role))return fail('选择己方兵营、工厂、机场或船坞');
        p.primary[role]=e.id;return {ok:true};
    }
    if(type==='rally') {
        const e=this.lookup.get(+c.id);
        if(!e||e.owner!==pid||!R.PRODUCER_ROLES.includes(D[e.type].role))return fail('只有生产建筑可以设置集结点');
        if(c.clear){e.rally=null;e.rallyQueue=[];return {ok:true};}
        if(!Number.isFinite(c.x)||!Number.isFinite(c.z))return fail('无效集结点');
        const point={type:'move',x:clamp(c.x,1,191),z:clamp(c.z,1,191)};
        if(c.append&&e.rally){if((e.rallyQueue||[]).length>=63)return fail('集结路径已满');(e.rallyQueue??=[]).push(point);}
        else {e.rally=point;e.rallyQueue=[];}return {ok:true};
    }
    if(type==='super')return this.useSuper(p,c);
    if(type==='sandbox') {
        if(!this.cfg.sandbox||pid!==0||this.cfg.network)return fail('正式对局禁止沙盒指令');
        if(c.action==='credits'){p.credits=999999;return {ok:true};}
        if(c.action==='charge'){for(const e of this.own(pid))e.charge=999;return {ok:true};}
        if(c.action==='reveal'){this.cfg.reveal=!this.cfg.reveal;this.updateFog();return {ok:true};}
        if(c.action==='ai'){this.cfg.sandboxAI=!this.cfg.sandboxAI;for(const pp of this.players)if(pp.id!==0)pp.ai=this.cfg.sandboxAI;return {ok:true};}
        if(c.action==='spawn'&&this.entities.length<2900&&D[c.unit]&&Number.isFinite(c.x)&&Number.isFinite(c.z)) {
            const owner=clamp(Number(c.owner)||0,0,this.players.length-1);
            for(let i=0;i<clamp(+c.count||1,1,20);i++){const pos=this.freeSpot(D[c.unit],c.x+(i%5)*3,c.z+Math.floor(i/5)*3);this.spawn(c.unit,owner,pos.x,pos.z);}
            return {ok:true};
        }
        return fail('未知或无效沙盒命令');
    }
    if(type==='surrender'){for(const e of this.own(pid))e.hp=0;p.alive=false;this.checkWin();return {ok:true};}
    if(!Array.isArray(c.ids)||c.ids.length>1024)return fail('无效选择');
    const selected=[...new Set(c.ids)].map(id=>this.lookup.get(+id)).filter(e=>e&&e.hp>0&&e.owner===pid&&!e.inside);
    if(!selected.length)return fail('没有选择己方单位');
    if(type==='deploy'){let ok=false;for(const e of selected)ok=this.deploy(e)||ok;return ok?{ok:true}:fail('无法部署：检查占地、地形或单位能力');}
    if(type==='unload'){for(const e of selected)this.unload(e);return {ok:true};}
    if(type==='stop'){for(const e of selected){e.order=null;e.orderQueue=[];e.path=[];e.target=null;e.moving=false;e.stopped=true;}return {ok:true};}
    const validTypes=['move','attackMove','target','forceMove','forceAttack','scatter','guard','patrol','harvest'];
    let orders=type==='plan'?c.orders:[c];
    if(!Array.isArray(orders)||!orders.length||orders.length>64)return fail('路径需要1至64个节点');
    // Validate the entire plan before mutating any unit, also on the authoritative server.
    for(const o of orders) {
        if(!o||!validTypes.includes(o.type))return fail('不支持的路径指令');
        if(o.target!=null){const t=this.lookup.get(+o.target);if(!t||!this.visible(pid,t))return fail('目标不在视野内');}
        if(o.type==='target'&&o.target==null)return fail('缺少目标');
        if(!['scatter','guard'].includes(o.type)&&o.target==null&&(!Number.isFinite(o.x)||!Number.isFinite(o.z)))return fail('无效坐标');
    }
    if(c.append&&selected.some(e=>(e.orderQueue?.length||0)+orders.length>64))return fail('命令队列已满（最多64个等待节点）');
    let changed=0;
    selected.forEach((e,i)=>{
        if(D[e.type].kind==='building')return;
        const built=orders.map(o=>this.makeOrder(e,o,i,selected.length)).filter(Boolean);if(!built.length)return;
        if(c.append&&e.order)(e.orderQueue??=[]).push(...built);
        else {e.order=built.shift();e.orderQueue=built;e.path=[];e.target=null;e.repath=0;e.destination=null;}
        e.stopped=false;if(D[e.type].deploy&&e.deployed)e.deployed=false;changed++;
    });
    return changed?{ok:true}:fail('所选单位不能执行这个指令');
}
syncReady(p){p.ready=p.readySlots.building||p.readySlots.defense||null;}
makeOrder(e,c,index,count) {
    const d=D[e.type],target=this.lookup.get(+c.target);
    const cols=Math.min(5,count),rows=Math.ceil(count/cols),spacing=d.kind==='infantry'?1.3:2.7;
    const scatterAngle=c.type==='scatter'?this.rand()*Math.PI*2:0,scatterRadius=c.type==='scatter'?4+this.rand()*4:0;
    let x=target?target.x:c.type==='guard'?e.x:c.type==='scatter'?e.x+Math.cos(scatterAngle)*scatterRadius:c.x;
    let z=target?target.z:c.type==='guard'?e.z:c.type==='scatter'?e.z+Math.sin(scatterAngle)*scatterRadius:c.z;
    if(!target&&count>1&&!['guard','scatter','forceAttack','harvest'].includes(c.type)) {
        x+=(index%cols-(cols-1)/2)*spacing;z+=(Math.floor(index/cols)-(rows-1)/2)*spacing;
    }
    x=clamp(x,1,191);z=clamp(z,1,191);
    let type=c.type==='scatter'?'move':c.type;
    if(c.type==='target') {
        if(d.ability==='engineer'&&D[target.type].kind==='building')type='capture';
        else if(d.ability==='spy'&&D[target.type].kind==='building'&&target.owner!==e.owner)type='infiltrate';
        else if(d.ability==='miner'&&D[target.type].role==='refinery'&&target.owner===e.owner)type='unloadOre';
        else if((target.owner===e.owner||target.owner<0&&D[target.type].role==='civilian')&&(D[target.type].capacity||D[target.type].role==='grinder')) {
            if(target.id===e.id||target.passengers.length>=D[target.type].capacity&&D[target.type].role!=='grinder')return null;
            const td=D[target.type];
            if(td.vehicleBunker?d.kind!=='vehicle':td.model==='hovercraft'?!['vehicle','infantry'].includes(d.kind):d.kind!=='infantry')return null;
            type='load';
        }
        else if(this.enemy(e,target)||target.owner<0&&this.weapon(e).damage>0)type='attack';
        else type='move';
    }
    if(type==='harvest') {
        if(d.ability!=='miner')return null;
        const ore=this.ores.find(o=>o.id===c.ore&&o.amount>0&&this.players[e.owner].fog[R.fogIndex(o.x,o.z)]);
        if(!ore)return null;return {type:'harvest',ore:ore.id,x:ore.x,z:ore.z};
    }
    if(type==='patrol')return {type,x,z,fromX:e.x,fromZ:e.z,returning:false};
    if(type==='forceAttack'&&!this.weapon(e).damage)return null;
    return {type,x,z,...(target&&type!=='forceMove'?{target:target.id}:{} )};
}
finishOrder(e) {
    e.order=e.orderQueue?.shift()||null;e.target=null;e.path=[];e.repath=0;e.destination=null;e.blocked=false;
}
placement(pid,d,x,z,options={}) {
    const p=this.players[pid];return R.placementCheck({player:pid,map:this.cfg.map,entities:this.entities,fog:p?.fog.map((v,i)=>v||p.seen[i])},d,x,z,options);
}

 onBuilt(e){const d=D[e.type];this.emit('build',e.x,e.z,{owner:e.owner,life:1});if(d.role==='refinery'&&d.faction!=='yuri'){const f=R.FACTIONS[d.faction],v=this.freeSpot(D[f.miner],e.x,e.z+7);this.spawn(f.miner,e.owner,v.x,v.z);} }
 validPlace(pid,d,x,z){return this.placement(pid,d,x,z).valid;}

 freeSpot(d,x,z){if(!this.dirty&&this.walkable(x,z,d))return{x:clamp(x,2,190),z:clamp(z,2,190)};for(let r=0;r<24;r+=2)for(let a=0;a<Math.PI*2;a+=.5){let xx=clamp(x+Math.cos(a)*r,2,190),zz=clamp(z+Math.sin(a)*r,2,190);if(this.walkable(xx,zz,d))return{x:xx,z:zz};}return{x:clamp(x,2,190),z:clamp(z,2,190)};}
 rebuildGrid() {
    this.grid.fill(0);
    for(const e of this.entities){if(e.hp<=0||D[e.type].kind!=='building')continue;
        const f=R.foundation(D[e.type],e.x,e.z);
        for(let z=Math.max(0,f.gz);z<Math.min(N,f.gz+f.h);z++)for(let x=Math.max(0,f.gx);x<Math.min(N,f.gx+f.w);x++)this.grid[z*N+x]=1;
    }
    this.dirty=false;
}

 walkable(x,z,d){if(x<1||z<1||x>191||z>191)return false;if(d.kind==='air'&&!d.deployed)return true;if(this.grid[Math.floor(z/2)*N+Math.floor(x/2)])return false;if(d.amphibious)return true;const water=R.onWater(this.cfg.map,x,z);return d.kind==='ship'?water:!water;}
 pathTo(e,x,z){const d=D[e.type];if(d.kind==='air')return[{x,z}];if(this.pathBudget<=0)return null;this.pathBudget--;let end=this.freeSpot(d,x,z),sx=clamp(Math.floor(e.x/2),0,95),sz=clamp(Math.floor(e.z/2),0,95),ex=clamp(Math.floor(end.x/2),0,95),ez=clamp(Math.floor(end.z/2),0,95),start=sz*N+sx,goal=ez*N+ex;if(start===goal)return[end];
 const g=new Float32Array(N*N);g.fill(1e9);g[start]=0;const prev=new Int32Array(N*N);prev.fill(-1);const closed=new Uint8Array(N*N),heap=[];const h=(a,b)=>Math.hypot(a-ex,b-ez);const push=(id,f)=>{let i=heap.length;heap.push([id,f]);while(i>0){const p=(i-1)>>1;if(heap[p][1]<=f)break;heap[i]=heap[p];i=p;}heap[i]=[id,f];};const pop=()=>{const root=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let ch=i*2+1;if(ch+1<heap.length&&heap[ch+1][1]<heap[ch][1])ch++;if(last[1]<=heap[ch][1])break;heap[i]=heap[ch];i=ch;}heap[i]=last;}return root[0];};push(start,h(sx,sz));let found=false,steps=0;
 while(heap.length&&steps++<5500){let id=pop();if(closed[id])continue;closed[id]=1;if(id===goal){found=true;break;}const ix=id%N,iz=(id/N)|0;for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){if(!a&&!b)continue;const nx=ix+a,nz=iz+b,ni=nz*N+nx;if(nx<0||nz<0||nx>=N||nz>=N||closed[ni]||!this.walkable(nx*2+1,nz*2+1,d))continue;if(a&&b&&(!this.walkable(ix*2+1,nz*2+1,d)||!this.walkable(nx*2+1,iz*2+1,d)))continue;let ng=g[id]+(a&&b?1.414:1);if(ng<g[ni]){g[ni]=ng;prev[ni]=id;push(ni,ng+h(nx,nz));}}}
 if(!found)return[];const path=[];let id=goal;while(id!==start&&id>=0){path.push({x:(id%N)*2+1,z:((id/N)|0)*2+1});id=prev[id];}return path.reverse();}
 move(e,x,z,dt,stop=1){const d=D[e.type];if(e.deployed||e.stun>0||d.robot&&(!this.has(e.owner,'robotcontrol')||this.players[e.owner].power<this.players[e.owner].drain))return false;const distance=Math.hypot(x-e.x,z-e.z);if(distance<stop){e.moving=false;return true;}
 if(d.kind==='air'){e.path=[{x,z}];e.pathIndex=0;}else if(!e.path?.length||e.repath<=0&&(Math.abs((e.destination?.x||0)-x)>5||Math.abs((e.destination?.z||0)-z)>5)){const path=this.pathTo(e,x,z);if(path!==null){e.path=path;e.pathIndex=0;e.repath=2;e.destination={x,z};}}
 const t=e.path?.[e.pathIndex];if(!t)return false;let dx=t.x-e.x,dz=t.z-e.z,len=Math.hypot(dx,dz);if(len<.8){e.pathIndex++;if(e.pathIndex>=e.path.length){e.path=[];e.repath=0;}return false;}let speed=d.speed*(1+e.rank*.06)*(e.infection?.8:1),step=Math.min(len,speed*dt),nx=e.x+dx/len*step,nz=e.z+dz/len*step;
 if(d.kind!=='air'){let rx=0,rz=0;for(const other of this.near(e.x,e.z,4)){if(other===e||other.hp<=0||other.inside||D[other.type].kind==='air'||D[other.type].kind==='building'||this.canCrush(e,other))continue;const ll=dist(e,other),sep=(d.size+D[other.type].size)*.34;if(ll>0.01&&ll<sep){rx+=(e.x-other.x)/ll*(sep-ll)*.15;rz+=(e.z-other.z)/ll*(sep-ll)*.15;}}
 if(this.walkable(nx+rx,nz+rz,d)){nx+=rx;nz+=rz;}if(!this.walkable(nx,nz,d)){if(this.walkable(nx,e.z,d))nz=e.z;else if(this.walkable(e.x,nz,d))nx=e.x;else{e.path=[];e.repath=0;e.moving=false;return false;}}}
 const ox=e.x,oz=e.z;e.angle=Math.atan2(nx-e.x,nz-e.z);e.x=nx;e.z=nz;e.moving=true;this.crushAlong(e,ox,oz,nx,nz);return false;}
 canCrush(e,t) {
    const d=D[e.type],td=D[t.type];
    return !!(d.crusher&&e.hp>0&&t.hp>0&&!t.inside&&!t.invul&&this.enemy(e,t)&&
        td.kind!=='building'&&td.kind!=='air'&&td.kind!=='ship'&&
        !(td.deployedCrushProof&&t.deployed)&&d.crusher>td.crushResistance);
}
crushAlong(e,x1,z1,x2,z2) {
    const dx=x2-x1,dz=z2-z1,ll=dx*dx+dz*dz;
    if(ll<1e-10)return;
    for(const t of this.near((x1+x2)/2,(z1+z2)/2,Math.sqrt(ll)+5)) {
        if(!this.canCrush(e,t))continue;
        const along=clamp(((t.x-x1)*dx+(t.z-z1)*dz)/ll,0,1);
        const radius=D[e.type].size*.33+D[t.type].size*.20;
        if(Math.hypot(t.x-x1-dx*along,t.z-z1-dz*along)>radius)continue;
        this.emit('crush',t.x,t.z,{owner:e.owner,radius:D[t.type].size,life:.8});
        this.damage(t,t.maxHp*100,e,'crush');
    }
}
deploy(e) {
    const d=D[e.type];
    if(d.ability==='mcv') {
        const h=R.FACTIONS[this.players[e.owner].faction].hq;
        const f=this.placement(e.owner,D[h],e.x,e.z,{ignore:e.id,noBase:true});
        if(!f.valid)return false;
        e.type=h;e.x=f.x;e.z=f.z;e.maxHp=D[h].hp;e.hp=Math.min(e.maxHp,e.hp*2);
        e.order=null;e.orderQueue=[];e.path=[];e.target=null;this.dirty=true;this.emit('build',e.x,e.z);return true;
    }
    if(d.deploy){e.deployed=!e.deployed;e.order=null;e.orderQueue=[];e.path=[];e.target=null;return true;}
    if(d.capacity){this.unload(e);return true;}return false;
}

 unload(e){let index=0;for(const id of [...e.passengers]){const t=this.lookup.get(id);if(!t)continue;const a=index++*1.2,pos=this.freeSpot(D[t.type],e.x+Math.sin(a)*(D[e.type].size+3),e.z+Math.cos(a)*(D[e.type].size+3));t.inside=null;t.x=pos.x;t.z=pos.z;t.order=null;}e.passengers=[];}
 updatePower(){for(const p of this.players){p.power=0;p.drain=0;for(const e of this.own(p.id)){const d=D[e.type];if(d.kind!=='building')continue;let power=d.power;if(power>0&&e.disabled>0)continue;if(power>0)p.power+=power+(d.role==='power'?e.passengers.length*100:0);else p.drain-=power;}if(p.blackout>0)p.power=0;}}
 updateFog() {
    for(const p of this.players) {
        p.fog.fill(0);
        const reveal=this.cfg.fogMode==='none'||this.cfg.reveal&&p.id===0||this.has(p.id,'satellite')&&p.power>=p.drain;
        if(reveal){p.fog.fill(2);p.seen.fill(1);}
        else {
            for(const e of this.entities){if(e.hp<=0||e.inside||e.owner<0||this.players[e.owner]?.team!==p.team)continue;
                const rad=D[e.type].sight/3,cx=e.x/3,cz=e.z/3;
                for(let z=Math.max(0,Math.floor(cz-rad));z<=Math.min(63,Math.ceil(cz+rad));z++)for(let x=Math.max(0,Math.floor(cx-rad));x<=Math.min(63,Math.ceil(cx+rad));x++)
                    if((x-cx)**2+(z-cz)**2<rad*rad){p.fog[z*64+x]=2;p.seen[z*64+x]=1;}
            }
            if(this.cfg.fogMode==='single')for(let i=0;i<4096;i++)if(p.seen[i])p.fog[i]=2;
        }
        for(const e of this.entities)if(e.hp>0&&D[e.type].kind==='building'&&this.visible(p.id,e))
            p.memory[e.id]={id:e.id,type:e.type,owner:e.owner,x:e.x,z:e.z,hp:e.hp,maxHp:e.maxHp,angle:e.angle,ghost:true};
        for(const [id,e] of Object.entries(p.memory))if(p.fog[R.fogIndex(e.x,e.z)]&&!this.lookup.has(+id))delete p.memory[id];
        p.oreMemory??={};for(const o of this.ores)if(p.fog[R.fogIndex(o.x,o.z)])p.oreMemory[o.id]={...o};
    }
}

 producer(p,d) {
    const role=d.kind==='infantry'?'barracks':d.kind==='ship'?'naval':d.producer||'factory';
    const primary=this.lookup.get(p.primary?.[role]);
    if(primary?.owner===p.id&&primary.hp>0&&D[primary.type].role===role)return primary;
    const fallback=this.own(p.id,role)[0];if(fallback)p.primary[role]=fallback.id;else delete p.primary[role];
    return fallback;
}
exitSpot(pr,d) {
    if(this.dirty)this.rebuildGrid();
    const size=D[pr.type].size/2+3;
    for(let ring=0;ring<4;ring++)for(const [dx,dz] of [[0,1],[.65,1],[-.65,1],[1,0],[-1,0],[0,-1]]) {
        const x=pr.x+dx*(size+ring*2),z=pr.z+dz*(size+ring*2);
        if(!this.walkable(x,z,d))continue;
        if(this.entities.some(e=>e.hp>0&&!e.inside&&e.id!==pr.id&&D[e.type].kind!=='building'&&
            (D[e.type].kind==='air')===(d.kind==='air')&&dist(e,{x,z})<(D[e.type].size+d.size)*.38))continue;
        return {x,z};
    }
    return null;
}
updateProduction(p,dt) {
    p.readySlots??={building:p.ready?.type&&D[p.ready.type].category==='building'?p.ready:null,defense:p.ready?.type&&D[p.ready.type].category==='defense'?p.ready:null};p.primary??={};
    for(const cat of ['building','defense','infantry','vehicle']) {
        const q=p.queues[cat];if(!q.length)continue;const item=q[0],d=D[item.type];item.blocked='';
        if(item.paused)continue;
        if(d.kind==='building'&&p.readySlots[cat]){item.blocked='等待放置就绪建筑';continue;}
        if(d.kind==='building'?!this.has(p.id,'hq'):!this.producer(p,d)){item.blocked='生产设施已失去';continue;}
        item.progress=Math.min(item.total,item.progress+dt*(p.power<p.drain?.45:1)*(this.cfg.sandbox&&p.id===0?3:1));
        if(item.progress+1e-8<item.total)continue;
        if(d.kind==='building') {
            q.shift();p.readySlots[cat]=item;this.syncReady(p);this.emit('ready',R.SPAWNS[p.spawnId??p.id][0],R.SPAWNS[p.spawnId??p.id][1],{owner:p.id});
        } else {
            const pr=this.producer(p,d),pos=pr&&this.exitSpot(pr,d);
            if(!pos){item.blocked='生产出口被堵塞';continue;}
            q.shift();const e=this.spawn(d.id,p.id,pos.x,pos.z);
            if(pr.rally){e.order={...pr.rally};e.orderQueue=(pr.rallyQueue||[]).map(o=>({...o}));}
            if(d.kind==='infantry'&&this.has(p.id,'cloner')) {
                const cp=this.own(p.id,'cloner')[0],pos2=this.exitSpot(cp,d);if(pos2)this.spawn(d.id,p.id,pos2.x,pos2.z);
            }
            this.emit('trained',e.x,e.z,{owner:p.id});
        }
    }
    this.syncReady(p);
}

 tickStep(){if(this.paused||this.winner!==null&&!this.cfg.sandbox)return;const dt=R.STEP;this.tick++;this.time+=dt;this.pathBudget=10;if(this.dirty)this.rebuildGrid();this.reindex();if(this.tick%2===0){this.updatePower();this.updateFog();}
 for(const p of this.players){if(!p.alive)continue;p.blackout=Math.max(0,p.blackout-dt);if(p.nation==='usa'&&this.has(p.id,'airfield')&&p.power>=p.drain)p.paradrop+=dt;this.updateProduction(p,dt);if(p.ai&&!this.cfg.sandbox)this.ai(p);else if(p.ai&&this.cfg.sandbox&&this.cfg.sandboxAI)this.ai(p);}
 for(const e of [...this.entities]){if(e.hp<=0||e.inside)continue;const d=D[e.type],p=this.players[e.owner];e.cooldown-=dt;e.repath-=dt;e.invul=Math.max(0,e.invul-dt);e.stun=Math.max(0,e.stun-dt);e.berserk=Math.max(0,e.berserk-dt);e.disabled=Math.max(0,(e.disabled||0)-dt);e.recentFire=Math.max(0,(e.recentFire||0)-dt);e.moving=false;
 if(e.controlledBy&&!this.lookup.has(e.controlledBy)){e.owner=e.originalOwner;e.originalOwner=null;e.controlledBy=null;e.order=null;}
 if(d.overload){const count=this.entities.filter(o=>o.hp>0&&o.controlledBy===e.id).length;if(count>3)this.damage(e,18*(count-3)*dt,null,'overload');}
 if(e.infection>0){e.infection-=dt;this.damage(e,15*dt,null,'parasite');}
 if(d.regen||e.rank>=2)e.hp=Math.min(e.maxHp,e.hp+(d.regen||1.5)*dt);
 if(d.kind==='building'){if(d.role==='civilian'&&!e.passengers.length)e.owner=-1;if(d.super&&p&&p.power>=p.drain)e.charge+=dt;if(e.repairing&&p&&e.hp<e.maxHp&&p.credits>1){const heal=Math.min(30*dt,e.maxHp-e.hp);e.hp+=heal;p.credits-=heal*.25;}if(d.role==='oil'&&p){p.credits+=6*dt;p.earned+=6*dt;}
 if(d.role==='repair'&&p&&p.credits>1)for(const t of this.near(e.x,e.z,12))if(t.owner===e.owner&&D[t.type].kind==='vehicle'&&dist(e,t)<12&&t.hp<t.maxHp){t.hp=Math.min(t.maxHp,t.hp+25*dt);t.infection=0;p.credits=Math.max(0,p.credits-3*dt);}
 if(d.range&&(!d.power||e.charged||p&&p.power>=p.drain))this.combat(e,dt);continue;}
 if(e.stun>0||e.lifted>0)continue;if(d.ability==='slave'&&e.master){this.tickSlave?.(e,dt);continue;}if(d.robot&&(!p||p.power<p.drain||!this.has(e.owner,'robotcontrol')))continue;
 if(d.ammo&&this.reloadAircraft(e,dt))continue;
 if(d.ability==='miner'&&!e.order&&!e.stopped){this.mine(e,dt);if(d.damage&&e.cooldown<=0)this.combat(e,dt,true);continue;}
 if(d.deploy==='radiation'&&e.deployed){if(this.tick%10===0){for(const t of this.near(e.x,e.z,14))if(this.enemy(e,t)&&dist(e,t)<14&&D[t.type].kind!=='air')this.damage(t,D[t.type].kind==='infantry'?90:35,e,'radiation');this.emit('radiation',e.x,e.z,{life:1.1,radius:14});}continue;}
 if(!e.order&&e.orderQueue?.length)this.finishOrder(e);
 if(e.order?.type==='harvest'){const o=this.ores.find(o=>o.id===e.order.ore&&o.amount>0);if(!o){this.finishOrder(e);continue;}e.ore=o.id;this.mine(e,dt);continue;}
 if(e.order&&['load','capture','infiltrate','unloadOre'].includes(e.order.type)){this.interaction(e,dt);continue;}
 this.combat(e,dt);
 }
 for(const p of this.projectiles){p.remaining-=dt;if(p.remaining<=0){const target=this.lookup.get(p.target),source=this.lookup.get(p.source);if(target&&target.hp>0){this.damage(target,p.damage,source,p.weapon);this.splash(target.x,target.z,p.splash,p.damage*.55,source,target.id);}this.emit('explosion',target?.x||p.x,target?.z||p.z,{radius:p.splash||1.6,life:.6,weapon:p.weapon});}}
 this.projectiles=this.projectiles.filter(p=>p.remaining>0);for(const f of this.effects)f.age+=dt;this.effects=this.effects.filter(f=>f.age<f.life);for(const e of this.entities)if(e.hp<=0&&!e.dead)this.destroy(e);this.entities=this.entities.filter(e=>e.hp>0);if(this.tick%20===0)this.checkWin();}
 interaction(e,dt) {
    const o=e.order,t=this.lookup.get(o.target),d=D[e.type];
    if(!t||t.hp<=0){this.finishOrder(e);return;}
    const td=D[t.type];
    // Check relationships again at arrival: queued actions must not enter an enemy transport after a capture.
    if(o.type==='load'&&!(t.owner===e.owner||t.owner<0&&td.role==='civilian')||
       o.type==='capture'&&d.ability!=='engineer'||o.type==='infiltrate'&&d.ability!=='spy'||
       o.type==='unloadOre'&&(d.ability!=='miner'||t.owner!==e.owner||td.role!=='refinery')){this.finishOrder(e);return;}
    if(!this.visible(e.owner,t)){this.finishOrder(e);return;}
    if(dist(e,t)>td.size*.6+1.5){this.move(e,t.x,t.z,dt,td.size*.6+1.5);return;}
    const p=this.players[e.owner];
    if(o.type==='load') {
        if(td.role==='grinder'){p.credits+=d.cost*.75;e.sold=true;e.hp=0;}
        else if(t.passengers.length<(td.capacity||0)&&(td.vehicleBunker?d.kind==='vehicle':td.model==='hovercraft'?['vehicle','infantry'].includes(d.kind):d.kind==='infantry')) {
            if(t.owner<0)t.owner=e.owner;t.passengers.push(e.id);e.inside=t.id;e.order=null;e.orderQueue=[];
        } else this.finishOrder(e);
    }
    if(o.type==='capture') {
        if(t.owner===e.owner){t.hp=t.maxHp;e.sold=true;e.hp=0;}
        else {t.owner=e.owner;t.controlledBy=null;t.originalOwner=null;t.target=null;t.order=null;t.orderQueue=[];t.rally=null;t.rallyQueue=[];
            t.hp=Math.max(t.hp,t.maxHp*.5);e.sold=true;e.hp=0;this.emit('capture',t.x,t.z,{owner:e.owner});}
    }
    if(o.type==='infiltrate') {
        const victim=this.players[t.owner];if(victim&&t.owner!==e.owner) {
            if(td.role==='refinery'){const money=victim.credits*.5;victim.credits-=money;p.credits+=money;}
            else if(td.role==='power')victim.blackout=30;else p.unlocks.push(td.role);
        }
        e.sold=true;e.hp=0;this.emit('capture',t.x,t.z,{owner:e.owner});
    }
    if(o.type==='unloadOre'){this.deposit(e,t);this.finishOrder(e);}
}

 mine(e,dt){const d=D[e.type],p=this.players[e.owner];if(!p)return;if(d.selfMine&&e.deployed)return;
 if(e.cargo>=d.cargoMax||e.mineReturn){const refs=this.own(e.owner,'refinery');if(!refs.length){e.mineReturn=false;return;}refs.sort((a,b)=>dist(e,a)-dist(e,b));const ref=refs[0];e.mineReturn=true;if(d.chronoReturn&&dist(e,ref)>9){const pos=this.freeSpot(d,ref.x,ref.z+8);this.emit('chrono',e.x,e.z);e.x=pos.x;e.z=pos.z;this.emit('chrono',e.x,e.z);}if(dist(e,ref)<10){this.deposit(e,ref);e.mineReturn=false;e.path=[];}else this.move(e,ref.x,ref.z+6,dt,6);return;}
 let ore=this.ores.find(o=>o.id===e.ore&&o.amount>0);if(!ore){ore=[...this.ores].filter(o=>o.amount>0).sort((a,b)=>dist(e,a)-dist(e,b))[0];e.ore=ore?.id;e.path=[];}if(!ore)return;if(dist(e,ore)<5){const amount=Math.min(ore.amount,(ore.gem?150:100)*dt,d.cargoMax-e.cargo);ore.amount-=amount;e.cargo+=amount;if(d.selfMine&&e.cargo>=d.cargoMax){p.credits+=e.cargo;p.earned+=e.cargo;e.cargo=0;}}else this.move(e,ore.x,ore.z,dt,4);}
 deposit(e,ref){const p=this.players[e.owner];if(!p)return;const value=e.cargo*(this.has(e.owner,'purifier')?1.25:1);p.credits+=value;p.earned+=value;e.cargo=0;}
 reloadAircraft(e,dt){const d=D[e.type];if(e.ammo>0&&!e.returning)return false;e.returning=true;const p=this.own(e.owner,'airfield')[0];if(!p)return false;if(dist(e,p)>4)this.move(e,p.x,p.z,dt,3);else{e.reload+=dt;if(e.reload>=6){e.reload=0;e.ammo=d.ammo;e.returning=false;}}return true;}
 weapon(e){const d=D[e.type];let w={damage:d.damage,range:d.range,cooldown:d.cooldown,weapon:d.weapon||'cannon',aa:d.aa,splash:d.splash||0};if(e.deployed&&d.deploy){if(d.deploy==='sandbag'){w.range=19;w.damage*=1.7;}if(d.deploy==='guardian'){w.range=25;w.damage=95;}if(d.deploy==='siege'){w.range=42;w.damage=160;w.weapon='cannon';w.cooldown=3;}}
 if(e.passengers?.length){const passenger=this.lookup.get(e.passengers[0]),pd=passenger?D[passenger.type]:null;if(d.id==='ifv'&&pd){w={...w,weapon:pd.weapon||'bullet',damage:pd.ability==='engineer'?0:pd.damage*1.5||25,range:Math.max(20,pd.range),aa:pd.aa||pd.weapon==='missile'};if(pd.control)w.control=1;}else for(const id of e.passengers){const pp=this.lookup.get(id);if(pp)w.damage+=(D[pp.type].damage||20)*.65;}}
 return w;}
 legalTarget(e,t,w,force=false) {
    const d=D[e.type],td=D[t.type];
    if(t.hp<=0||t.inside||e.id===t.id||!force&&!this.enemy(e,t)&&!(t.owner<0&&e.order?.target===t.id)||!this.visible(e.owner,t))return false;
    if(d.infOnly&&td.kind!=='infantry'||d.navalOnly&&td.kind!=='ship'||d.airOnly&&!(td.kind==='air'&&!t.deployed)||td.kind==='air'&&!t.deployed&&!w.aa)return false;
    if((d.control||w.control)&&(td.immune||td.kind==='air'||td.kind==='ship'||td.kind==='building'&&!d.controlBuilding))return false;
    return true;
}
combat(e,dt,stationary=false) {
    const d=D[e.type],w=this.weapon(e),order=e.order;
    if(d.id==='ifv'&&e.passengers.length){const p=this.lookup.get(e.passengers[0]);if(p&&D[p.type].ability==='engineer'){
        for(const t of this.near(e.x,e.z,10))if(t.owner===e.owner&&D[t.type].kind==='vehicle'&&dist(e,t)<10){t.hp=Math.min(t.maxHp,t.hp+22*dt);t.infection=0;}
        if(order&&['move','forceMove','attackMove'].includes(order.type)&&this.move(e,order.x,order.z,dt,1.3))this.finishOrder(e);
        return;
    }}
    if(order&&d.teleport&&['move','forceMove','attackMove'].includes(order.type)&&!stationary) {
        if(this.walkable(order.x,order.z,d)){this.emit('chrono',e.x,e.z);e.x=order.x;e.z=order.z;e.stun=1.5;this.emit('chrono',e.x,e.z);this.finishOrder(e);}return;
    }
    if(order?.type==='forceAttack'&&!order.target) {
        e.aim=Math.atan2(order.x-e.x,order.z-e.z);
        if(dist(e,order)>w.range){if(!stationary&&d.kind!=='building')this.move(e,order.x,order.z,dt,Math.max(1,w.range*.85));return;}
        if(e.cooldown<=0&&w.damage>0&&(!d.ammo||e.ammo>0)) {
            e.cooldown=w.cooldown;e.recentFire=2;if(d.ammo)e.ammo--;
            this.emit('shot',e.x,e.z,{tx:order.x,tz:order.z,y:1.8,ty:.2,weapon:w.weapon,owner:e.owner,life:.35});
            const radius=Math.max(1.25,w.splash||0);
            for(const t of this.near(order.x,order.z,radius+5))if(t.id!==e.id&&t.hp>0&&!t.inside&&D[t.type].kind!=='air'&&dist(t,order)<radius)
                this.damage(t,w.damage,e,w.weapon);
        }
        return;
    }
    const force=order?.type==='forceAttack';
    let t=this.lookup.get(e.target||order?.target);
    if(t&&!this.legalTarget(e,t,w,force)){t=null;e.target=null;}
    const mayAuto=!order||!['move','forceMove','forceAttack'].includes(order.type);
    if(!t&&mayAuto&&(this.tick+e.id)%4===0&&(w.damage||d.control||w.control||d.weapon==='chaos')) {
        let best=1e9;
        for(const o of this.near(e.x,e.z,Math.max(w.range,17))){const dd=dist(e,o);
            if(order?.type==='guard'&&dd>w.range)continue;
            if(dd<best&&dd<Math.max(w.range,17)&&this.legalTarget(e,o,w)){t=o;best=dd;}}
        if(t)e.target=t.id;
    }
    if(t) {
        const range=w.range+(D[t.type].kind==='building'?D[t.type].size*.38:0);e.aim=Math.atan2(t.x-e.x,t.z-e.z);
        if(dist(e,t)<=range){if(e.cooldown<=0)this.fire(e,t,w);return;}
        if(order?.type==='guard'){e.target=null;return;}
        if(!stationary&&d.kind!=='building'&&!e.deployed){this.move(e,t.x,t.z,dt,range*.85);return;}
    }
    if(!stationary&&order&&['move','forceMove','attackMove','attack','forceAttack','patrol'].includes(order.type)) {
        if((order.type==='attack'||force)&&order.target&&!t){this.finishOrder(e);return;}
        const x=order.type==='patrol'&&order.returning?order.fromX:order.x,z=order.type==='patrol'&&order.returning?order.fromZ:order.z;
        if(this.move(e,x,z,dt,1.3)) {
            if(order.type==='patrol'){order.returning=!order.returning;e.path=[];e.repath=0;}
            else this.finishOrder(e);
        }
    }
}

 fire(e,t,w){const d=D[e.type],td=D[t.type];e.cooldown=w.cooldown/(1+e.rank*.12);e.recentFire=2;if(d.ammo){if(e.ammo<=0)return;e.ammo--;}
 const sourceY=d.kind==='air'&&!e.deployed?9:1.5,targetY=td.kind==='air'&&!t.deployed?9:1.5;this.emit('shot',e.x,e.z,{tx:t.x,tz:t.z,y:sourceY,ty:targetY,weapon:w.weapon,owner:e.owner,life:['rocket','airstrike'].includes(w.weapon)?.9:.26});
 if(d.control||w.control){const controlled=this.entities.filter(o=>o.controlledBy===e.id);if(controlled.length>=(d.control||w.control)&&!d.overload)return;t.originalOwner=t.owner;t.owner=e.owner;t.controlledBy=e.id;t.order=null;t.orderQueue=[];t.path=[];t.target=null;this.emit('psi',t.x,t.z,{life:1.4});return;}
 if(d.weapon==='chaos'){for(const o of this.near(e.x,e.z,11))if(this.enemy(e,o)&&dist(e,o)<11&&!D[o.type].immune&&D[o.type].kind!=='building')o.berserk=9;this.emit('chaos',e.x,e.z,{life:1.4,radius:11});return;}
 
 if(d.ability==='infect'&&td.kind==='vehicle'&&!td.immune){t.infection=35;e.sold=true;e.hp=0;return;}
 if(w.weapon==='magnet'&&td.kind==='vehicle'){t.stun=1.6;const dx=e.x-t.x,dz=e.z-t.z,ll=Math.hypot(dx,dz);if(ll>8){const nx=t.x+dx/ll*3,nz=t.z+dz/ll*3;if(this.walkable(nx,nz,td)){t.x=nx;t.z=nz;}}}
 if(d.id==='floating_disc'&&td.role==='power'){t.disabled=12;this.players[t.owner].blackout=4;}
 let damage=w.damage;if(d.commando&&td.kind==='building')damage=240;if(d.weapon==='gattling'){e.spin=Math.min(2,(e.spin||0)+.15);damage*=1+e.spin;}
 if(['rocket','airstrike','missile'].includes(w.weapon)){this.projectiles.push({target:t.id,source:e.id,remaining:Math.min(1.8,dist(e,t)/40),x:t.x,z:t.z,damage,weapon:w.weapon,splash:w.splash});}else{this.damage(t,damage,e,w.weapon);this.splash(t.x,t.z,w.splash,damage*.55,e,t.id);}
 if(d.suicide){this.splash(e.x,e.z,d.splash,d.damage,e,null);if(d.radiation)this.emit('radiation',e.x,e.z,{radius:12,life:8});e.hp=0;}
 }
 damage(t,amount,source,weapon){if(t.hp<=0||t.invul>0)return;const td=D[t.type];let mult=1;if(['bullet','gattling'].includes(weapon))mult=td.kind==='infantry'?1.2:td.kind==='building'?.2:.35;else if(weapon==='ap')mult=td.kind==='infantry'?.12:td.kind==='building'?.35:1.6;else if(weapon==='cannon')mult=td.kind==='infantry'?.5:1;else if(weapon==='radiation')mult=td.kind==='infantry'?1.4:.6;if(t.deployed&&td.kind==='infantry')mult*=.65;if(td.immune&&['radiation','toxin'].includes(weapon))mult*=.2;t.hp-=amount*mult*(1+(source?.rank||0)*.15);if(source&&t.owner>=0&&source.owner!==t.owner&&D[t.type].kind==='building'&&(this.tick+t.id)%17===0)this.emit('alert',t.x,t.z,{owner:t.owner,life:1});if(t.hp<=0){if(source){source.xp+=td.cost||100;source.rank=Math.min(3,Math.floor(source.xp/Math.max(500,D[source.type].cost*1.5)));const p=this.players[source.owner];if(p)p.kills++;}this.destroy(t);}}
 splash(x,z,r,damage,source,except){if(!r)return;for(const t of this.near(x,z,r+5))if(t.id!==except&&t.hp>0&&dist(t,{x,z})<r&&(!source||this.enemy(source,t)))this.damage(t,damage*(1-dist(t,{x,z})/r*.5),source,'blast');}
 destroy(e){if(e.dead)return;e.dead=true;const d=D[e.type];if(!e.sold)this.emit('explosion',e.x,e.z,{radius:d.size*(d.kind==='building'?1.8:1),life:1.2,owner:e.owner});if(e.owner>=0)this.players[e.owner].lost++;for(const id of e.passengers){const p=this.lookup.get(id);if(p)p.hp=0;}for(const t of this.entities)if(t.controlledBy===e.id){t.owner=t.originalOwner;t.originalOwner=null;t.controlledBy=null;t.order=null;t.orderQueue=[];t.path=[];t.target=null;}
 if(d.kind==='building')this.dirty=true;this.lookup.delete(e.id);if(d.deathBlast&&!e.sold)this.splash(e.x,e.z,d.deathBlast,400,null,e.id);}
 useSuper(p,c){let kind=c.ability,b;if(kind==='paradrop'){if(p.nation!=='usa'||p.paradrop<100||!this.has(p.id,'airfield'))return{ok:false,error:'伞兵尚未就绪'};}else{b=this.own(p.id).find(e=>D[e.type].super===kind&&e.charge>=D[e.type].charge);if(!b)return{ok:false,error:'超级武器尚未就绪'};if(p.power<p.drain)return{ok:false,error:'电力不足'};}
 const x=Number(c.x),z=Number(c.z);if(!Number.isFinite(x)||!Number.isFinite(z)||x<0||z<0||x>192||z>192)return{ok:false,error:'无效目标'};if(kind==='paradrop'){p.paradrop=0;for(let i=0;i<6;i++){const pos=this.freeSpot(D.gi,x+(i%3)*2,z+Math.floor(i/3)*2);this.spawn('gi',p.id,pos.x,pos.z,{stun:1.5});}this.emit('chrono',x,z,{life:1.5});return{ok:true};}
 if(kind==='chrono'){const units=(c.ids||[]).map(id=>this.lookup.get(id)).filter(e=>e&&e.owner===p.id&&['vehicle','ship'].includes(D[e.type].kind)).slice(0,9);if(!units.length)return{ok:false,error:'先选择需要传送的己方载具'};units.forEach((e,i)=>{const pos=this.freeSpot(D[e.type],x+(i%3)*3,z+Math.floor(i/3)*3);e.x=pos.x;e.z=pos.z;e.path=[];e.order=null;e.orderQueue=[];e.stun=1;});}
 else if(kind==='iron'){for(const e of this.near(x,z,14))if(e.owner===p.id&&D[e.type].kind!=='infantry'&&dist(e,{x,z})<14)e.invul=20;}
 else if(kind==='genetic'){for(const e of [...this.near(x,z,20)])if(e.owner!==p.id&&D[e.type].kind==='infantry'&&!D[e.type].immune&&dist(e,{x,z})<20){this.spawn('brute',p.id,e.x,e.z);e.sold=true;e.hp=0;}}
 else if(kind==='dominator'){for(const e of this.near(x,z,22)){if(dist(e,{x,z})>=22)continue;const dd=D[e.type];if(dd.kind==='building')this.damage(e,500,b,'blast');else if(!dd.immune&&e.owner!==p.id){e.owner=p.id;e.controlledBy=null;e.originalOwner=null;e.order=null;e.orderQueue=[];e.path=[];e.target=null;}}}
 else{const radius=kind==='nuke'?24:28;for(const e of this.near(x,z,radius+4))if(dist(e,{x,z})<radius)this.damage(e,(kind==='nuke'?1700:1300)*(1-dist(e,{x,z})/radius*.65),b,'blast');}
 b.charge=0;this.emit(kind,x,z,{life:kind==='nuke'?4:3,radius:24,owner:p.id});return{ok:true};}
 ai(p){if(this.time>=p.aiNext){p.aiNext=this.time+(this.cfg.difficulty==='hard'?2:4)+this.rand();const F=R.FACTIONS[p.faction];const mcv=this.own(p.id).find(e=>D[e.type].ability==='mcv');if(mcv)this.deploy(mcv);
 if(p.ready){const d=D[p.ready.type],h=this.own(p.id,'hq')[0]||this.own(p.id)[0];if(h)for(let k=0;k<100;k++){const r=10+this.rand()*22,a=this.rand()*Math.PI*2,x=h.x+Math.cos(a)*r,z=h.z+Math.sin(a)*r;if(this.validPlace(p.id,d,x,z)){this.command(p.id,{type:'place',x,z});break;}}}
 const plan=[F.power,F.refinery,F.barracks,F.factory,F.radar,F.tech];let desired=plan.find(id=>!this.own(p.id).some(e=>e.type===id));if(p.power<p.drain+70)desired=F.power;if(!desired&&false)desired=F.power;
 if(desired&&!p.queues.building.length&&!p.ready)this.command(p.id,{type:'queue',unit:desired});
 if(!p.queues.defense.length&&this.has(p.id,'radar')&&this.own(p.id,'defense').length<3){const id=p.faction==='allies'?'a_prism':p.faction==='soviet'?'s_tesla':'y_psychic';this.command(p.id,{type:'queue',unit:id});}
 if(this.has(p.id,'tech')&&!p.queues.defense.length&&!this.own(p.id,'super').length&&p.credits>6500)this.command(p.id,{type:'queue',unit:p.faction==='allies'?'a_weather':p.faction==='soviet'?'s_nuke':'y_dominator'});
 if(this.has(p.id,'factory')&&p.queues.vehicle.length<2){let candidates=R.defs().filter(d=>d.faction===p.faction&&d.kind==='vehicle'&&d.damage&&d.ability!=='miner'&&!d.suicide&&this.canBuild(p,d.id));if(this.has(p.id,'radar')&&p.faction==='yuri')candidates.push(D.yuri_clone);if(!candidates.length)candidates=[D[F.tank]];let id=candidates[Math.floor(this.rand()*candidates.length)].id;if(this.own(p.id).filter(e=>D[e.type].ability==='miner').length<2&&p.faction!=='yuri')id=F.miner;this.command(p.id,{type:'queue',unit:id});}
 if(this.has(p.id,'barracks')&&p.queues.infantry.length<2&&this.own(p.id).filter(e=>D[e.type].kind==='infantry').length<15)this.command(p.id,{type:'queue',unit:F.inf});
 if(this.cfg.difficulty==='hard'){p.credits+=90;p.earned+=90;}for(const e of this.own(p.id))if(D[e.type].kind==='building'&&e.hp<e.maxHp*.7&&p.credits>500)e.repairing=true;
 }
 if(this.time>=p.aiAttack){p.aiAttack=this.time+(this.cfg.difficulty==='easy'?60:this.cfg.difficulty==='hard'?28:40)+this.rand()*10;const h=this.own(p.id,'hq')[0];if(!h)return;const enemies=this.entities.filter(e=>e.owner>=0&&this.players[e.owner].alive&&this.players[e.owner].team!==p.team&&D[e.type].role==='hq');enemies.sort((a,b)=>dist(a,h)-dist(b,h));const target=enemies[0];if(!target)return;const army=this.own(p.id).filter(e=>D[e.type].kind!=='building'&&D[e.type].ability!=='miner'&&D[e.type].ability!=='mcv'&&!e.inside);this.command(p.id,{type:'attackMove',ids:army.map(e=>e.id),x:target.x,z:target.z});for(const e of this.own(p.id))if(D[e.type].super&&e.charge>=D[e.type].charge)this.useSuper(p,{ability:D[e.type].super,x:target.x,z:target.z,ids:army.map(e=>e.id)});}
 }
 checkWin(){if(this.cfg.sandbox||this.cfg.training||this.initialTeams?.length<2)return;for(const p of this.players)if(p.alive&&!this.entities.some(e=>e.hp>0&&e.owner===p.id&&(D[e.type].kind==='building'||D[e.type].ability==='mcv'))){p.alive=false;for(const e of this.own(p.id))e.hp=0;this.emit('defeat',R.SPAWNS[p.spawnId??p.id][0],R.SPAWNS[p.spawnId??p.id][1],{owner:p.id,life:2});}
 const teams=[...new Set(this.players.filter(p=>p.alive).map(p=>p.team))];if(teams.length<=1){this.winner=teams[0]??-1;}}
 snapshot(pid=0) {
    const p=this.players[pid];
    const units=this.entities.filter(e=>e.hp>0&&!e.inside&&this.visible(pid,e)).map(e=>{
        const out={...e};delete out.path;delete out.destination;delete out.repath;
        if(e.owner!==pid){for(const key of ['order','orderQueue','rally','rallyQueue','target','ore','mineReturn','stopped'])delete out[key];}
        return out;
    });
    const ids=new Set(units.map(e=>e.id));
    for(const e of Object.values(p.memory))if(!ids.has(e.id)&&!p.fog[R.fogIndex(e.x,e.z)])units.push({...e});
    const ores=this.ores.map(o=>p.fog[R.fogIndex(o.x,o.z)]?{...o}:p.oreMemory?.[o.id]).filter(Boolean);
    return {version:R.VERSION,tick:this.tick,time:this.time,seed:this.cfg.seed,map:this.cfg.map,cfg:this.cfg,player:pid,
        players:this.players.map(pp=>({id:pp.id,name:pp.name,nation:pp.nation,faction:pp.faction,color:pp.color,colorIndex:pp.colorIndex,spawnId:pp.spawnId,closed:pp.closed,team:pp.team,alive:pp.alive,kills:pp.kills,lost:pp.lost,ai:pp.ai,earned:this.winner!==null?pp.earned:undefined,spent:this.winner!==null?pp.spent:undefined})),
        p:{...p,seen:undefined,fog:undefined,memory:undefined,oreMemory:undefined},fog:p.fog.map((v,i)=>v||p.seen[i]),entities:units,ores,
        effects:this.effects.filter(e=>(e.owner===pid||p.fog[R.fogIndex(e.x,e.z)]===2)&&(!Number.isFinite(e.tx)||p.fog[R.fogIndex(e.tx,e.tz)]===2)),winner:this.winner,paused:this.paused};
}

 save(){return{version:R.VERSION,cfg:this.cfg,seed:this.seed,tick:this.tick,time:this.time,nextId:this.nextId,fxId:this.fxId,entities:this.entities,players:this.players,ores:this.ores,effects:[],projectiles:this.projectiles,winner:this.winner};}
 static load(source){
  // Import only data fields. Never assign an untrusted object onto a live simulator.
  const invalid=message=>{throw new Error('存档无效：'+message);};let nodes=0;
  function checkTree(value,depth=0){
   if(++nodes>650000||depth>48)invalid('数据超出限制');
   if(value===null||typeof value==='boolean')return;
   if(typeof value==='number'){if(!Number.isFinite(value))invalid('含非有限数值');return;}
   if(typeof value==='string'){if(value.length>200000)invalid('文本过长');return;}
   if(typeof value!=='object')invalid('只接受 JSON 数据');
   if(Array.isArray(value)){if(value.length>50000)invalid('数组过长');for(const x of value)checkTree(x,depth+1);return;}
   for(const [k,v] of Object.entries(value)){if(['__proto__','prototype','constructor'].includes(k))invalid('包含不安全字段');checkTree(v,depth+1);}
  }
  checkTree(source);const s=JSON.parse(JSON.stringify(source));
  if(![R.VERSION,'0.6.0','0.4.0','0.3.0'].includes(s?.version)||!Array.isArray(s.entities)||!Array.isArray(s.players))invalid('版本不兼容或格式损坏');
  if(s.entities.length>3000||s.players.length<2||s.players.length>8)invalid('单位或玩家数量越界');
  if(!s.cfg||!R.MAPS.some(m=>m.id===s.cfg.map))invalid('地图不存在');
  const integer=(v,a,b)=>Number.isSafeInteger(v)&&v>=a&&v<=b,number=(v,a,b)=>Number.isFinite(v)&&v>=a&&v<=b;
  if(!integer(s.tick,0,10000000)||!number(s.time,0,1000000)||!integer(s.seed,0,4294967295))invalid('时间或随机种子错误');
  const ids=new Set();for(const e of s.entities){
   if(!integer(e.id,1,2147483646)||ids.has(e.id)||!D[e.type]||!integer(e.owner,-1,s.players.length-1)||!number(e.x,0,192)||!number(e.z,0,192)||!number(e.hp,-1e9,1e9)||!number(e.maxHp,1,1e9))invalid('实体字段错误');
   if(!Array.isArray(e.passengers)||e.passengers.length>100||!Array.isArray(e.path)||e.path.length>10000)invalid('实体列表错误');ids.add(e.id);
  }
  for(let i=0;i<s.players.length;i++){
   const p=s.players[i];if(p.id!==i||!integer(p.team,0,7)||!R.FACTIONS[p.faction]||!R.NATIONS.some(n=>n.id===p.nation)||!number(p.credits,0,1e12))invalid('玩家字段错误');
   for(const k of ['fog','seen'])if(!Array.isArray(p[k])||p[k].length!==4096||p[k].some(v=>!integer(v,0,2)))invalid('迷雾数据错误');
   if(!p.queues||!p.memory||Object.keys(p.memory).length>3000)invalid('玩家资料不完整');
   for(const k of ['building','defense','infantry','vehicle'])if(!Array.isArray(p.queues[k])||p.queues[k].length>24||p.queues[k].some(q=>!D[q.type]||!number(q.total,.01,1e6)||!number(q.progress,0,1e6)))invalid('生产队列错误');
  }
  if(!Array.isArray(s.ores)||s.ores.length>2048||s.ores.some(o=>!number(o.x,0,192)||!number(o.z,0,192)||!number(o.amount,0,1e12)))invalid('矿区数据错误');
  if(!Array.isArray(s.projectiles)||s.projectiles.length>5000)invalid('弹道数据错误');
  if(s.winner!==null&&!integer(s.winner,-1,7))invalid('胜负结果错误');
  const sim=new Sim({...s.cfg,players:s.players.length});
  for(const key of ['seed','tick','time','entities','players','ores','projectiles','winner'])sim[key]=s[key];
  sim.nextId=Math.max(integer(s.nextId,1,2147483647)?s.nextId:1,...s.entities.map(e=>e.id+1));sim.fxId=integer(s.fxId,1,2147483647)?s.fxId:1;
  sim.mission=s.mission||null;sim.wave=s.wave||null;
  sim.initialTeams=Array.isArray(s.initialTeams)?s.initialTeams:[...new Set(sim.players.filter(p=>!p.closed).map(p=>p.team))];
  for(const p of sim.players){p.colorIndex??=p.id;p.spawnId??=sim.spawnAssignments[p.id]??p.id;p.closed??=false;p.history??=[];p.aiPlan??=['harass','expand','combined','defend'][p.id%4];p.built??=0;p.aiScout??=sim.time+8;}
  sim.effects=[];sim.paused=false;sim.dirty=true;sim.reindex();sim.rebuildGrid();sim.updatePower();sim.updateFog();sim._journal=[];sim._recording=true;sim._initialSave=JSON.parse(JSON.stringify(sim.save()));return sim;
 }
}
R.Sim=Sim;if(typeof module!=='undefined')module.exports=Sim;
})(globalThis);

if(typeof module!=='undefined'&&module.exports)require('./tactics.js');
if(typeof module!=='undefined'&&module.exports)require('./operations.js');
