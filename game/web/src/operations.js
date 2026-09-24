/* 1.0 cooperative operations, deterministic replay checkpoints and congestion recovery.
 * Objective rules live here, not in the UI, and run identically on all authority hosts. */
(function(G){'use strict';const R=G.RA,D=R.D,P=R.Sim.prototype,copy=o=>JSON.parse(JSON.stringify(o)),distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
R.OPERATIONS=[
 {id:'holdout',name:'钢铁守夜',map:'fortress',tag:'防守 / 1–2人',description:'共同守住南部基地，消灭八波逐渐加强的进攻部队。',objective:'守住任一盟友基地，清除第八波的全部增援。',par:450,limit:900},
 {id:'oil',name:'黑金争夺',map:'urban',tag:'据点 / 1–2人',description:'工程师争夺三座前线油井，占领至少两座累计90秒。',objective:'同时控制至少两座任务油井，累计90秒；失去多数控制时计时暂停。',par:330,limit:720},
 {id:'escort',name:'漫长公路',map:'valley',tag:'护送 / 1–2人',description:'护送装甲补给车穿过五处路标。友军护卫靠近时车队才会前进。',objective:'保护补给车通过五处路标。护卫需保持在20格范围内，补给车被毁即失败。',par:420,limit:840},
 {id:'blackout',name:'静默频段',map:'basin',tag:'突袭 / 1–2人',description:'八分钟内关闭三座敌方雷达站，突破岗哨和巡逻增援。',objective:'摧毁或占领三座任务雷达站；倒计时归零前必须完成。',par:330,limit:480},
 {id:'siege',name:'心灵要塞',map:'desert',tag:'攻坚 / 1–2人',description:'合兵突破尤里防线，摧毁或夺取中央心灵信标。',objective:'击破中央信标及其防御体系。侧翼矿区可支持长期消耗。',par:480,limit:900},
 {id:'extraction',name:'归航信号',map:'coast',tag:'营救 / 1–2人',description:'地面部队接近三处被困小队后，再护住南部撤离区30秒。',objective:'靠近三处营救点8格完成接应，再以至少两支地面战斗单位控制撤离区30秒。',par:420,limit:840}
];
R.operationConfig=(id,options={})=>{const o=R.OPERATIONS.find(x=>x.id===id);if(!o)throw Error('未知合作任务');const nations=[options.nation||'usa','russia',id==='siege'?'yuri':'russia','korea'];const slots=Array.from({length:4},(_,i)=>({kind:i===0?'human':i===3?'closed':'ai',human:i===0,closed:i===3,nation:nations[i],name:i===0?'指挥官':i===1?'友军指挥官':'敌军指挥部',team:i<2?0:1,color:i,spawn:[0,6,3,4][i],difficulty:options.difficulty||'normal'}));return {...options,seed:options.seed??260912,operation:id,map:o.map,players:4,teams:'coop',startBase:true,sandbox:false,training:null,challenge:null,fogMode:options.fogMode||'double',credits:18000,slots};};
const init=P.initTactics;
P.initTactics=function(){init.call(this);this.operation=null;this._checkpoints=[];this._checkpointBytes=0;this._lastCheckpoint=0;
 const spec=R.OPERATIONS.find(o=>o.id===this.cfg.operation);if(!spec)return;
 const allies=this.players.filter(p=>!p.closed&&p.team===this.players[0].team),enemies=this.players.filter(p=>!p.closed&&p.team!==this.players[0].team);if(!enemies.length)return;
 const enemy=enemies[0].id,base=this.own(0,'hq')[0]||this.own(0)[0];this.operation={id:spec.id,name:spec.name,objective:spec.objective,team:this.players[0].team,enemy,started:0,limit:spec.limit,par:spec.par,targets:[],points:[],progress:0,total:1,wave:0,nextWave:40,completed:false,failed:false,stars:0};const o=this.operation;
 for(const p of enemies)p.ai=spec.id==='siege';
 for(const p of allies){const F=R.FACTIONS[p.faction],hq=this.own(p.id,'hq')[0];if(hq){let spot=this.freeSpot(D[F.factory],hq.x,hq.z-26);this.spawn(F.factory,p.id,spot.x,spot.z);spot=this.freeSpot(D[F.radar],hq.x+16,hq.z-12);this.spawn(F.radar,p.id,spot.x,spot.z);for(let i=0;i<2;i++){const q=this.freeSpot(D[F.tank],hq.x+9+i*4,hq.z-9);this.spawn(F.tank,p.id,q.x,q.z);}const engineer=p.faction==='allies'?'a_engineer':p.faction==='soviet'?'s_engineer':'y_engineer';if(D[engineer])this.spawn(engineer,p.id,hq.x+5,hq.z-5);}}
 const target=(type,owner,x,z)=>{const e=this.spawn(type,owner,x,z,{objective:true});if(e){o.targets.push(e.id);o.points.push({id:e.id,x:e.x,z:e.z});}return e;};
 if(spec.id==='holdout'){o.total=8;o.nextWave=35;}
 if(spec.id==='oil'){o.total=90;for(const x of [67,96,125])target('oil',-1,x,94);}
 if(spec.id==='escort'){o.total=5;o.route=[{x:54,z:136},{x:65,z:115},{x:96,z:96},{x:122,z:73},{x:140,z:50}];o.waypoint=0;const car=target('a_mcv',0,base.x+10,base.z-6);if(car){car.hp=car.maxHp=1800;car.convoy=true;}o.nextWave=30;}
 if(spec.id==='blackout'){o.total=3;for(const [x,z]of [[58,69],[96,54],[134,69]]){target('s_radar',enemy,x,z);this.spawn('s_sentry',enemy,x+6,z+9);}o.nextWave=45;}
 if(spec.id==='siege'){o.total=1;target('y_dominator',enemy,96,63);for(const [x,z]of [[79,72],[114,72],[86,84],[107,84]])this.spawn('y_gattling',enemy,x,z);this.spawn('y_power',enemy,83,54);this.spawn('y_power',enemy,109,54);o.nextWave=60;}
 if(spec.id==='extraction'){o.total=3;for(const [x,z]of [[63,105],[97,76],[131,105]])target('gi',-1,x,z);o.rescued=[];o.extraction={x:96,z:153,r:12};o.hold=0;o.nextWave=40;}
 this.reindex();this.rebuildGrid();this.updatePower();this.updateFog();this._initialSave=copy(this.save());
};
P.operationWave=function(){const o=this.operation;if(!o)return;const candidates=this.players.filter(p=>p.alive&&p.team===o.team),targetPlayer=candidates[o.wave%candidates.length];if(!targetPlayer)return;let target=this.own(targetPlayer.id,'hq')[0]||this.own(targetPlayer.id)[0];if(o.id==='oil')target={x:96,z:94};if(o.id==='escort')target=this.lookup.get(o.targets[0])||target;if(o.id==='extraction'&&o.progress>=3)target=o.extraction;if(!target)return;
 o.wave++;const side=o.wave%2===0?-1:1,spawn=o.id==='holdout'?{x:96+side*48,z:56}:o.id==='escort'?{x:Math.max(18,Math.min(174,target.x+side*35)),z:Math.max(18,target.z-30)}:{x:96+side*45,z:52};
 const count=Math.min(16,3+o.wave*2),ids=[];for(let i=0;i<count;i++){const type=i%4===0&&o.wave>=4?'apocalypse':i%2===0?'rhino':'conscript';const p=this.freeSpot(D[type],spawn.x+(i%4)*2,spawn.z+Math.floor(i/4)*2);const e=this.spawn(type,o.enemy,p.x,p.z,{operationUnit:true,operationWave:o.wave});if(e)ids.push(e.id);}
 const flag=this._inAI;this._inAI=true;try{this.command(o.enemy,{type:'attackMove',ids,x:target.x,z:target.z});}finally{this._inAI=flag;}
 this.emit('alert',target.x,target.z,{owner:targetPlayer.id,life:2});o.nextWave=this.time+(o.id==='holdout'?42:55);this.reindex();
};
P.finishOperation=function(success,reason){const o=this.operation;if(!o||o.completed||o.failed)return;o.completed=success;o.failed=!success;o.reason=reason;o.finished=this.time;o.stars=success?1+(this.time<=o.par?1:0)+(this.players.filter(p=>p.team===o.team).reduce((s,p)=>s+p.lost,0)<=25?1:0):0;this.winner=success?o.team:this.players[o.enemy].team;};
P.tickOperation=function(){const o=this.operation;if(!o||o.completed||o.failed)return;
 const friendly=e=>e.hp>0&&e.owner>=0&&this.players[e.owner]?.team===o.team,combat=e=>friendly(e)&&!e.inside&&['infantry','vehicle'].includes(D[e.type].kind)&&D[e.type].damage>0;
 if(!this.entities.some(e=>friendly(e)&&(D[e.type].kind==='building'||D[e.type].ability==='mcv')&&!e.convoy))return this.finishOperation(false,'全部友军基地失守');
 if(this.time>=o.limit)return this.finishOperation(false,'行动时限已到');
 if(this.time>=o.nextWave&&(o.id!=='holdout'||o.wave<8)&&this.entities.filter(e=>e.hp>0&&e.operationUnit).length<100)this.operationWave();
 if(o.id==='holdout'){o.progress=o.wave;if(o.wave===8&&!this.entities.some(e=>e.hp>0&&e.operationUnit&&this.players[e.owner]?.team!==o.team))this.finishOperation(true,'八波进攻均已被击退');}
 if(o.id==='oil'){o.controlled=o.targets.filter(id=>{const e=this.lookup.get(id);return e&&friendly(e);}).length;if(o.controlled>=2)o.progress=Math.min(90,o.progress+1);if(o.progress>=90)this.finishOperation(true,'关键油田的持续控制已建立');}
 if(o.id==='blackout'||o.id==='siege'){o.progress=o.targets.filter(id=>{const e=this.lookup.get(id);return !e||e.hp<=0||friendly(e);}).length;if(o.progress>=o.total)this.finishOperation(true,o.id==='siege'?'心灵信标已被解除':'全部雷达站已被关闭');}
 if(o.id==='escort'){const car=this.lookup.get(o.targets[0]);if(!car||car.hp<=0)return this.finishOperation(false,'装甲补给车已被摧毁');const next=o.route[o.waypoint];o.escortPresent=this.entities.some(e=>combat(e)&&distance(e,car)<20);o.convoyHealth=Math.max(0,car.hp/car.maxHp);if(next&&distance(car,next)<6){o.waypoint++;o.progress=o.waypoint;}if(o.waypoint>=o.route.length)return this.finishOperation(true,'装甲补给车安全通过全部路标');car.order=o.escortPresent?{type:'move',...o.route[o.waypoint]}:null;car.stopped=!o.escortPresent;}
 if(o.id==='extraction'){for(const id of o.targets){if(o.rescued.includes(id))continue;const e=this.lookup.get(id);if(!e||e.hp<=0)return this.finishOperation(false,'被困小队遭到歼灭');if(this.entities.some(u=>combat(u)&&distance(u,e)<8)){o.rescued.push(id);e.owner=0;e.invul=5;const old=this._inAI;this._inAI=true;try{this.command(0,{type:'move',ids:[id],x:o.extraction.x,z:o.extraction.z});}finally{this._inAI=old;}}}o.progress=o.rescued.length;
  if(o.progress===3){const guards=this.entities.filter(e=>combat(e)&&distance(e,o.extraction)<=o.extraction.r),enemies=this.entities.some(e=>e.hp>0&&e.owner>=0&&this.players[e.owner]?.team!==o.team&&distance(e,o.extraction)<15);if(guards.length>=2&&!enemies)o.hold++;if(o.hold>=30)this.finishOperation(true,'全部小队完成撤离');}}
};
const checkWin=P.checkWin;P.checkWin=function(){if(this.operation){this.tickOperation();return;}return checkWin.call(this);};
// checkWin runs every two seconds in the base engine; use a dedicated one-second cadence.
const oldTick=P.tickStep;P.tickStep=function(){const before=this.tick;oldTick.call(this);if(this.tick===before)return;if(this.operation&&this.tick%10===0&&this._opTick!==this.tick){this._opTick=this.tick;this.tickOperation();}
 if(this._recording&&this.tick>0&&this.tick%600===0&&this.tick!==this._lastCheckpoint){this._lastCheckpoint=this.tick;const state=copy(this.save()),size=JSON.stringify(state).length;this._checkpoints??=[];this._checkpointBytes??=0;if(size<4*1024*1024){this._checkpoints.push({tick:this.tick,index:this._journal.length,state,size});this._checkpointBytes+=size;while(this._checkpoints.length>12||this._checkpointBytes>8*1024*1024){this._checkpointBytes-=this._checkpoints.shift().size;}}}
};
// Base checkWin may run on the same tick; exactly one objective evaluation per second.
const opTick=P.tickOperation;P.tickOperation=function(){if(this.tick%10!==0||this._opEvaluated===this.tick)return;this._opEvaluated=this.tick;return opTick.call(this);};
const command=P.command;P.command=function(pid,c){if(this.operation?.id==='escort'&&c?.ids?.some(id=>this.lookup.get(id)?.convoy))return {ok:false,error:'补给车按任务路标行驶；请派战斗单位靠近护送'};return command.call(this,pid,c);};
const move=P.move;P.move=function(e,x,z,dt,stop=1){const ox=e.x,oz=e.z,result=move.call(this,e,x,z,dt,stop);if(D[e.type].kind==='air'||e.deployed||e.stun>0||result)return result;
 if(Math.hypot(e.x-ox,e.z-oz)<.005&&Math.hypot(x-e.x,z-e.z)>stop+2){e.stallTime=(e.stallTime||0)+dt;if(e.stallTime>2){e.path=[];e.pathIndex=0;e.repath=0;e.stallTime=0;e.recoveryCount=(e.recoveryCount||0)+1;}}else e.stallTime=0;return result;};
// Friendly AI keeps its economy but follows the public mission brief rather than
// selecting an unrelated enemy HQ. Objective waypoints are public to both allies.
const normalAI=P.ai;P.ai=function(p){const operation=this.operation,cooperating=operation&&p.team===operation.team;
 if(cooperating){p.aiScout=Math.max(p.aiScout||0,this.time+12);p.aiAttack=Math.max(p.aiAttack||0,this.time+12);}
 normalAI.call(this,p);if(!cooperating||this.time<(p.operationNext||0)||operation.completed||operation.failed)return;p.operationNext=this.time+5;this.operationAllyAI(p);
};
P.operationAllyAI=function(p){const o=this.operation;if(!o||!p.ai||p.team!==o.team)return;const own=this.own(p.id),army=own.filter(e=>e.hp>0&&!e.inside&&['infantry','vehicle'].includes(D[e.type].kind)&&D[e.type].damage>0&&D[e.type].ability!=='miner'&&(e.retreatUntil||0)<=this.time);let target=null;
 const old=this._inAI;this._inAI=true;try{
 if(o.id==='oil'){const unclaimed=o.targets.map(id=>this.lookup.get(id)).filter(e=>e&&e.hp>0&&(e.owner<0||this.players[e.owner]?.team!==o.team));const engineers=own.filter(e=>D[e.type].ability==='engineer');for(const e of engineers){const t=unclaimed.slice().sort((a,b)=>distance(a,e)-distance(b,e))[0];if(t&&e.order?.type!=='capture'){if(this.visible(p.id,t))this.command(p.id,{type:'target',ids:[e.id],target:t.id,x:t.x,z:t.z});else if(!e.order||e.order.type!=='move')this.command(p.id,{type:'move',ids:[e.id],x:t.x,z:t.z});}}
  const eng=p.faction==='allies'?'a_engineer':p.faction==='soviet'?'s_engineer':'y_engineer';if(unclaimed.length&&!engineers.length&&!p.queues.infantry.some(q=>q.type===eng))this.command(p.id,{type:'queue',unit:eng});target=unclaimed[0]||o.points[p.id%o.points.length];
 }else if(o.id==='escort')target=this.lookup.get(o.targets[0]);
 else if(o.id==='blackout'||o.id==='siege')target=o.targets.map(id=>this.lookup.get(id)).find(e=>e&&e.hp>0&&(e.owner<0||this.players[e.owner]?.team!==o.team));
 else if(o.id==='extraction')target=o.points.find(t=>!o.rescued.includes(t.id))||o.extraction;
 else{const base=this.own(p.id,'hq')[0];target=this.entities.find(e=>e.hp>0&&e.owner>=0&&this.players[e.owner]?.team!==o.team&&this.visible(p.id,e)&&base&&distance(e,base)<45)|| (base?{x:base.x,z:Math.max(10,base.z-13)}:null);}
 if(target&&army.length>=2)this.command(p.id,{type:'attackMove',ids:army.map(e=>e.id),x:target.x,z:target.z});
 }finally{this._inAI=old;}
};
const save=P.save;P.save=function(){return {...save.call(this),operation:this.operation||null};};
const load=R.Sim.load;R.Sim.load=function(source){const sim=load.call(this,source);for(let i=0;i<sim.players.length;i++)Object.assign(sim.players[i],copy(source.players[i]));if(source.operation){const o=source.operation;if(!R.OPERATIONS.some(s=>s.id===o.id)||!Array.isArray(o.targets)||o.targets.length>12||!Number.isFinite(o.progress)||!Number.isInteger(o.enemy)||o.enemy<0||o.enemy>=sim.players.length)throw Error('合作任务存档不合法');sim.operation=copy(o);}else sim.operation=null;sim._checkpoints=[];sim._checkpointBytes=0;sim._lastCheckpoint=sim.tick;sim._opEvaluated=sim.tick;sim._initialSave=copy(sim.save());return sim;};
const snapshot=P.snapshot;P.snapshot=function(pid=0){const s=snapshot.call(this,pid);s.operation=this.operation?copy(this.operation):null;if(s.operation){s.operation.nextWaveIn=Math.max(0,Math.ceil(s.operation.nextWave-this.time));delete s.operation.nextWave;s.operation.remaining=Math.max(0,Math.ceil(s.operation.limit-this.time));}return s;};
const oldReplay=P.exportReplay;P.exportReplay=function(){const data=oldReplay.call(this);data.format='ra3d-replay-v2';data.checkpoints=(this._checkpoints||[]).map(c=>({tick:c.tick,index:c.index,state:copy(c.state)}));return data;};
const BaseReplay=R.Replay;
R.Replay=class extends BaseReplay{
 constructor(source){const v2=source?.format==='ra3d-replay-v2';if(v2){if(!Array.isArray(source.checkpoints)||source.checkpoints.length>12)throw Error('录像检查点数量无效');if(JSON.stringify(source).length>20*1024*1024)throw Error('录像超过20MB导入限制');}super(v2?{...source,format:'ra3d-replay-v1',checkpoints:undefined}:source);this.data.format=v2?'ra3d-replay-v2':'ra3d-replay-v1';this.checkpoints=[];let last=this.data.initial.tick;for(const c of source.checkpoints||[]){if(!Number.isInteger(c.tick)||c.tick<=last||c.tick>this.data.endTick||!Number.isInteger(c.index)||c.index<0||c.index>this.data.commands.length||c.state?.tick!==c.tick)throw Error('录像检查点索引无效');if(c.index>0&&this.data.commands[c.index-1].tick>=c.tick||c.index<this.data.commands.length&&this.data.commands[c.index].tick<c.tick)throw Error('录像检查点与指令时序不一致');R.Sim.load(c.state);this.checkpoints.push(copy(c));last=c.tick;}}
 seek(tick){const target=Math.max(this.data.initial.tick,Math.min(this.data.endTick,Math.floor(Number(tick)||0))),cp=this.checkpoints?.findLast(c=>c.tick<=target);if(cp){this.sim=R.Sim.load(copy(cp.state));this.sim._recording=false;this.sim._journal=[];this.index=cp.index;this.done=false;}else this.reset();this.seekOrigin=this.sim.tick;let guard=0;while(this.sim.tick<target&&!this.done&&guard++<360001)this.step();return this.sim.snapshot(0);}
};
})(globalThis);
