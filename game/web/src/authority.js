/* Shared room authority: native WebSocket server and browser-hosted MQTT use the same rules. */
(function(G){'use strict';const R=G.RA,Sim=R.Sim,Wire=R.Wire;
R.RoomService=class {
 constructor(options={}){
 const rooms=new Map(),peers=new Set(),ips=new Map(),PUBLIC=!!options.public;
 const log=options.log||(()=>{});
 const crypto={randomBytes(n){const a=new Uint8Array(n);G.crypto.getRandomValues(a);return{toString(){return Array.from(a,x=>x.toString(16).padStart(2,'0')).join('');}};}};
const LIMITS={rooms:16,connections:128,perIP:20,payload:16384,commands:80,resumeMs:120000,pendingMs:900000,gameMs:7200000,...options.limits};
const metrics={created:0,messages:0,bytesOut:0,full:0,delta:0,rejected:0,resumed:0};
const clean=(v,max=24)=>String(v??'').replace(/[\x00-\x1f\x7f]/g,'').slice(0,max);
const error=(p,message)=>{metrics.rejected++;send(p,{type:'error',message});};
function send(p,msg){if(!p||p.closed||p.ws.readyState!==1)return false;if(p.ws.bufferedAmount>2000000){p.ws.close(1013,'Slow client');return false;}const text=JSON.stringify(msg);metrics.bytesOut+=new TextEncoder().encode(text).length;p.ws.send(text);return true;}
const broadcast=(room,msg,filter=()=>true)=>{for(const m of room.members.values())if(m.peer&&filter(m))send(m.peer,msg);if(!['marker','chat'].includes(msg.type))for(const w of room.watchers?.values()||[])if(w.peer)send(w.peer,msg);};
function identity(msg){return msg.protocol===R.PROTOCOL&&msg.content===R.CONTENT_HASH&&msg.rules===R.RULES_HASH&&msg.mapHash===R.MAP_HASH;}
function cleanConfig(c={}){
 const count=[2,4,6,8].includes(+c.players)?+c.players:8;
 const out={seed:Number.isInteger(c.seed)?c.seed>>>0:260905,operation:R.OPERATIONS?.some(o=>o.id===c.operation)?c.operation:null,map:R.getMap(c.map).id,players:count,nation:R.nation(c.nation).id,teams:['ffa','coop','4v4'].includes(c.teams)?c.teams:'ffa',difficulty:['easy','normal','hard'].includes(c.difficulty)?c.difficulty:'normal',credits:Math.max(5000,Math.min(30000,+c.credits||10000)),startBase:c.startBase!==false,fogMode:R.FOG_MODES[c.fogMode]?c.fogMode:'single',sandbox:false,network:true};
 out.slots=R.resolveSlots({...out,slots:Array.isArray(c.slots)?c.slots.slice(0,count):undefined}).map((s,i)=>({...s,name:clean(s.name||('电脑 '+(i+1))),difficulty:['easy','normal','hard'].includes(s.difficulty)?s.difficulty:out.difficulty}));
 return out;
}
function publicRooms(){return[...rooms.values()].filter(r=>!r.private).map(r=>({code:r.code,name:r.name,map:r.config.map,players:r.members.size,seats:r.config.slots.filter(s=>!s.closed).length,created:r.created,started:r.started,watchers:r.watchers?.size||0}));}
function lobby(room){for(const w of room.watchers?.values()||[])if(w.peer)send(w.peer,{type:'lobby',code:room.code,name:room.name,config:room.config,you:-1,host:room.host,members:[...room.members.values()].map(m=>({slot:m.slot,name:m.name,nation:m.nation,ready:m.ready,connected:!!m.peer})),spectator:true});const members=[...room.members.values()].map(m=>({slot:m.slot,name:m.name,nation:m.nation,ready:m.ready,connected:!!m.peer}));for(const m of room.members.values())if(m.peer)send(m.peer,{type:'lobby',code:room.code,name:room.name,config:room.config,you:m.slot,host:room.host,members,private:room.private});}
function attach(p,room,slot,m){p.room=room.code;p.slot=slot;m.peer=p;m.disconnected=null;room.members.set(slot,m);room.emptySince=null;p.delta=!!p.capabilities?.delta;p.base=null;p.pending=null;p.frame=0;p.lastFull=0;send(p,{type:'welcome',code:room.code,token:m.token,player:slot,protocol:R.PROTOCOL,content:R.CONTENT_HASH,seq:m.lastSeq,resumeSeconds:LIMITS.resumeMs/1000});}
function watchState(p,room,force=false){
 if(!room.sim)return;const view=p.view??0,sim=room.sim;
 if(sim.winner!==null)return send(p,{type:'state',data:{...sim.snapshot(view),spectator:true,delay:0}});
 let h=room.watchHistory?.get(view);const frame=h?.findLast(f=>f.tick<=sim.tick-300);
 if(!frame){if(force||Date.now()-(p.waitAt||0)>2000){send(p,{type:'spectatorWait',seconds:Math.max(1,30-Math.floor((sim.tick-(h?.[0]?.tick??sim.tick))/10)),view});p.waitAt=Date.now();}return;}
 if(force||p.watchTick!==frame.tick){p.watchTick=frame.tick;send(p,{type:'state',data:{...frame.data,spectator:true,delay:Math.round((sim.tick-frame.tick)/10)}});}
}
function attachWatcher(p,room,w){
 p.room=room.code;p.slot=-1;p.spectator=true;p.watchToken=w.token;p.view=w.view??0;w.peer=p;w.disconnected=null;
 send(p,{type:'welcome',code:room.code,token:w.token,player:-1,spectator:true,seq:0});
 if(room.started){send(p,{type:'start',code:room.code,player:p.view,spectator:true});watchState(p,room,true);}else lobby(room);
}
function state(p,sim,force=false){
 if(p.spectator)return watchState(p,rooms.get(p.room),force);
 if(!p.delta){send(p,{type:'state',data:sim.snapshot(p.slot)});return;}
 const now=Date.now();if(p.pending&&!force&&now-p.pending.at<1500)return;
 const next=Wire.pack(sim.snapshot(p.slot));const id=++p.frame;
 if(!force&&p.base&&now-p.lastFull<5000){const d=Wire.delta(p.base.data,next),message={type:'delta',id,base:p.base.id,data:d};if(JSON.stringify(message).length<JSON.stringify(next).length*.85){send(p,message);metrics.delta++;}else{send(p,{type:'state',id,data:next});metrics.full++;p.lastFull=now;}}
 else{send(p,{type:'state',id,data:next});metrics.full++;p.lastFull=now;}
 p.pending={id,data:next,at:now};
}
function begin(room){
 let cfg=cleanConfig(room.config);if(cfg.operation){const op=R.operationConfig(cfg.operation,cfg);cfg={...op,slots:cfg.slots.map((s,i)=>({...op.slots[i],nation:s.nation,name:s.name,color:s.color,difficulty:s.difficulty}))};}
 for(let i=0;i<cfg.slots.length;i++){const s=cfg.slots[i],m=room.members.get(i);if(m){s.human=true;s.closed=false;s.kind='human';s.nation=m.nation;s.name=m.name;}else if(s.kind==='human'){s.kind='ai';s.human=false;s.name='电脑 '+(i+1);}}
 const valid=R.validateSetup(cfg,true);if(!valid.ok)return valid.error;
 room.config=cfg;room.sim=new Sim(cfg);room.started=true;room.startedAt=Date.now();room.lastBroadcast=-1;room.watchHistory=new Map();
 for(const w of room.watchers.values())if(w.peer){send(w.peer,{type:'start',code:room.code,player:w.peer.view??0,spectator:true});watchState(w.peer,room,true);}
 for(const m of room.members.values())if(m.peer){m.peer.base=null;m.peer.pending=null;send(m.peer,{type:'start',code:room.code,player:m.slot});state(m.peer,room.sim,true);}
 log(`[room ${room.code}] started ${room.members.size} humans`);return null;
}
function sendReplay(p,room){const replay=room.sim.exportReplay();while(JSON.stringify(replay).length>10*1024*1024&&replay.checkpoints?.length){replay.checkpoints.shift();replay.reducedCheckpoints=true;}if(JSON.stringify(replay).length>10*1024*1024)return error(p,'本局录像超出在线导出上限，房主可导出本机备份');return send(p,{type:'replay',data:replay});}
function validCommand(c,depth=0){
 if(depth>4)return false;
 if(!c||typeof c!=='object'||Array.isArray(c)||typeof c.type!=='string')return false;
 if(c.ids!==undefined&&(!Array.isArray(c.ids)||c.ids.length>300||c.ids.some(x=>!Number.isSafeInteger(x)||x<0)))return false;
 for(const k of ['x','z'])if(c[k]!==undefined&&(!Number.isFinite(c[k])||c[k]<0||c[k]>R.SIZE))return false;
 if(c.plan!==undefined&&(!Array.isArray(c.plan)||c.plan.length>64))return false;
 if(c.orders!==undefined&&(!Array.isArray(c.orders)||c.orders.length>64))return false;
 for(const k of ['orders','plan'])if(Array.isArray(c[k])&&c[k].some(q=>!validCommand(q,depth+1)))return false;
 return true;
}
function handle(p,msg){
 if(!msg||typeof msg!=='object'||Array.isArray(msg))return error(p,'无法解析消息');
 const now=Date.now();metrics.messages++;if(now-p.rateStart>=1000){p.rateStart=now;p.rate=0;}if(++p.rate>LIMITS.commands+25){if(p.rate>LIMITS.commands+60)p.ws.close(1008,'Rate limit');return error(p,'指令频率过高');}
 let room=rooms.get(p.room);
 if(msg.type==='hello'){if(!identity(msg))return error(p,'客户端内容版本不匹配，请使用同一完整包');p.capabilities=msg.capabilities||{};return send(p,{type:'hello',version:R.VERSION,content:R.CONTENT_HASH,public:PUBLIC});}
 if(msg.type==='ping')return send(p,{type:'pong',at:msg.at,server:now});
 if(msg.type==='list'){if(!identity(msg))return error(p,'客户端与服务器版本不匹配');return send(p,{type:'rooms',rooms:publicRooms(),public:PUBLIC});}
 if(['create','join','watch','resume'].includes(msg.type)){
  if(!identity(msg))return error(p,'客户端与服务器版本或内容哈希不匹配');
  p.capabilities=msg.capabilities||p.capabilities||{};
  if(p.room)return error(p,'请先离开当前房间');
  if(msg.type==='resume'){
   const r=rooms.get(clean(msg.code,6).toUpperCase());if(!r)return error(p,'房间已结束或恢复窗口已过期');
   const token=clean(msg.token,64);if(!/^[a-f0-9]{48}$/.test(token))return error(p,'恢复凭证无效或已过期');const w=r.watchers.get(token);if(w){if(w.disconnected&&now-w.disconnected>LIMITS.resumeMs)return error(p,'观战恢复窗口已过期');if(w.peer){const old=w.peer;w.peer=null;old.ws.close(1000,'Session replaced');}attachWatcher(p,r,w);return;}const m=[...r.members.values()].find(x=>x.token===token);
   if(!m||m.disconnected&&now-m.disconnected>LIMITS.resumeMs)return error(p,'恢复凭证无效或已过期');
   if(m.peer){const old=m.peer;m.peer=null;old.ws.close(1000,'Session replaced');}
   attach(p,r,m.slot,m);metrics.resumed++;
   if(r.started){send(p,{type:'start',code:r.code,player:m.slot,resumed:true});state(p,r.sim,true);}else lobby(r);
   broadcast(r,{type:'notice',message:m.name+' 已重新连接。'});return;
  }
  const name=clean(msg.name||'指挥官'),nation=R.nation(msg.nation).id;
  if(msg.type==='create'){
   if(rooms.size>=LIMITS.rooms)return error(p,'服务器房间已满');
   if([...rooms.values()].filter(r=>r.ownerIP===p.ip).length>=4)return error(p,'同一网络创建的房间过多，请等待旧房间释放');
   const cfg=cleanConfig(msg.config),chosen=cfg.slots[0];chosen.kind='human';chosen.human=true;chosen.closed=false;chosen.nation=nation;chosen.name=name;
   let code;do{code=crypto.randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(code));
   const r={code,ownerIP:p.ip,name:clean(msg.roomName||name+' 的房间',40),config:cfg,members:new Map(),watchers:new Map(),watchHistory:new Map(),host:0,started:false,sim:null,emptySince:null,created:now,private:!!msg.private};rooms.set(code,r);metrics.created++;
   attach(p,r,0,{slot:0,name,nation,ready:true,token:crypto.randomBytes(24).toString('hex'),lastSeq:0});lobby(r);return;
  }
  const r=rooms.get(clean(msg.code,6).toUpperCase());if(!r)return error(p,'房间不存在，请检查房间码');if(msg.type==='watch'){
   if(r.watchers.size>=4)return error(p,'观战席已满（最多4位）');const token=crypto.randomBytes(24).toString('hex'),w={token,name,view:0,peer:null};r.watchers.set(token,w);attachWatcher(p,r,w);return;
  }if(r.started)return error(p,'对局已经开始，请选择延迟观战');
  const slot=r.config.slots.findIndex((s,i)=>!s.closed&&!r.members.has(i)&&(!r.config.operation||i<2));if(slot<0)return error(p,'房间已满');
  Object.assign(r.config.slots[slot],{kind:'human',human:true,nation,name});
  if(r.config.teams==='coop')r.config.slots[slot].team=0;
  attach(p,r,slot,{slot,name,nation,ready:false,token:crypto.randomBytes(24).toString('hex'),lastSeq:0});lobby(r);return;
 }
 if(!room)return error(p,'请先创建或加入房间');
 if(p.spectator){
  const w=room.watchers.get(p.watchToken);if(!w||w.peer!==p)return error(p,'观战身份无效');
  if(msg.type==='leave'){p.leaving=true;p.ws.close(1000,'Left spectator');return;}
  if(msg.type==='resync'){watchState(p,room,true);return;}
  if(msg.type==='ack')return;
  if(msg.type==='spectateView'){
   if(!Number.isInteger(msg.player)||!room.config.slots[msg.player]||room.config.slots[msg.player].closed)return error(p,'观察视角无效');
   p.view=msg.player;w.view=p.view;p.watchTick=-1;watchState(p,room,true);return;
  }
  if(msg.type==='replay'&&room.sim?.winner!==null&&room.sim)return sendReplay(p,room);
  return error(p,'观战为只读模式，不能下令、修改席位或向参战玩家聊天');
 }
 const member=room.members.get(p.slot);if(!member||member.peer!==p)return error(p,'无效席位');
 if(msg.type==='ack'){if(p.pending&&msg.id===p.pending.id){p.base={id:p.pending.id,data:p.pending.data};p.pending=null;}return;}
 if(msg.type==='resync'){if(room.sim)state(p,room.sim,true);return;}
 if(msg.type==='leave'){p.leaving=true;p.ws.close(1000,'Left room');return;}
 if(msg.type==='ready'&&!room.started){member.ready=!member.ready;lobby(room);return;}
 if(msg.type==='configure'&&!room.started){
  if(p.slot!==room.host)return error(p,'只有房主可以修改房间设置');const c=cleanConfig({...room.config,...msg.config});
  if([...room.members.keys()].some(i=>i>=c.players))return error(p,'请先让多余席位的玩家离开');
  for(const m of room.members.values()){Object.assign(c.slots[m.slot],{kind:'human',human:true,closed:false,name:m.name,nation:m.nation});m.ready=m.slot===room.host;}
  room.config=c;lobby(room);return;
 }
 if(msg.type==='seat'&&!room.started){
  const target=Number.isInteger(msg.slot)?msg.slot:p.slot;if(target<0||target>=room.config.players)return error(p,'无效席位');
  if(target!==p.slot&&p.slot!==room.host)return error(p,'不能修改其他玩家席位');const seat=room.config.slots[target],m=room.members.get(target),v=msg.values||{};
  if(m&&target!==p.slot&&v.nation!==undefined)return error(p,'国家由对应玩家选择');
  if(v.nation!==undefined){seat.nation=R.nation(v.nation).id;if(m)m.nation=seat.nation;}
  if(Number.isInteger(v.team)&&v.team>=0&&v.team<8)seat.team=v.team;
  if(Number.isInteger(v.color)&&v.color>=0&&v.color<8)seat.color=v.color;
  if(Number.isInteger(v.spawn)&&v.spawn>=-1&&v.spawn<8)seat.spawn=v.spawn;
  if(!m&&['ai','closed','human'].includes(v.kind)){seat.kind=v.kind;seat.closed=v.kind==='closed';seat.human=false;}
  if(['easy','normal','hard'].includes(v.difficulty))seat.difficulty=v.difficulty;
  for(const x of room.members.values())x.ready=x.slot===room.host;lobby(room);return;
 }
 if(msg.type==='chat'){
  if(now-(p.chatAt||0)<600)return error(p,'聊天发送过快');p.chatAt=now;const text=clean(msg.text,180).trim();if(!text)return;
  broadcast(room,{type:'chat',slot:p.slot,name:member.name,text,at:now,team:!!msg.team},m=>!msg.team||room.config.slots[m.slot].team===room.config.slots[p.slot].team);return;
 }
 if(msg.type==='marker'&&room.started){if(now-(p.markerAt||0)<1500)return;p.markerAt=now;if(!Number.isFinite(msg.x)||!Number.isFinite(msg.z)||msg.x<0||msg.z<0||msg.x>R.SIZE||msg.z>R.SIZE)return;broadcast(room,{type:'marker',slot:p.slot,x:msg.x,z:msg.z,at:now},m=>room.sim.players[m.slot].team===room.sim.players[p.slot].team);return;}
 if(msg.type==='start'){
  if(p.slot!==room.host)return error(p,'只有房主能开始对局');if(room.started)return;
  if([...room.members.values()].some(m=>!m.peer||m.slot!==room.host&&!m.ready))return error(p,'请等待所有玩家连接并准备');
  const e=begin(room);if(e)error(p,e);return;
 }
 if(msg.type==='rematch'){
  if(p.slot!==room.host)return error(p,'只有房主可以发起再战');if(!room.started||room.sim.winner===null)return error(p,'请先完成当前对局');
  room.sim=null;room.started=false;room.watchHistory.clear();for(const m of room.members.values()){m.ready=m.slot===room.host;m.lastSeq=0;if(m.peer){m.peer.base=null;m.peer.pending=null;}}
  broadcast(room,{type:'rematch'});lobby(room);return;
 }
 if(msg.type==='replay'){if(!room.started||room.sim.winner===null)return error(p,'联机回放仅在对局结束后开放');return sendReplay(p,room);}
 if(msg.type==='command'){
  if(!room.started)return error(p,'对局尚未开始');
  if(!Number.isSafeInteger(msg.seq)||msg.seq<=member.lastSeq)return error(p,'重复或无效指令序号');member.lastSeq=msg.seq;
  if(!validCommand(msg.command))return error(p,'指令内容或范围无效');
  const result=room.sim.command(p.slot,msg.command);if(result.ok){room.lastBroadcast=-1;if(room.sim.winner!==null)room.forceState=true;}if(!result.ok)error(p,result.error);send(p,{type:'commandResult',command:msg.command.type,result,seq:msg.seq});return;
 }
 error(p,'未知消息类型');
}
function left(p){
 if(p.cleaned)return;p.cleaned=true;p.closed=true;peers.delete(p);ips.set(p.ip,Math.max(0,(ips.get(p.ip)||1)-1));
 const room=rooms.get(p.room);if(p.spectator){const w=room?.watchers.get(p.watchToken);if(w?.peer===p){w.peer=null;w.disconnected=Date.now();if(p.leaving)room.watchers.delete(p.watchToken);}return;}const m=room?.members.get(p.slot);if(!m||m.peer!==p)return;m.peer=null;m.disconnected=Date.now();
 if(p.leaving&&!room.started){room.members.delete(p.slot);const s=room.config.slots[p.slot];s.kind='ai';s.human=false;s.name='电脑 '+(p.slot+1);if(room.host===p.slot)room.host=room.members.keys().next().value??0;}
 if(p.leaving&&room.started)m.token='';
 broadcast(room,{type:'notice',message:m.name+' 已断线，保留席位两分钟。'});if(!room.started)lobby(room);
 if(![...room.members.values()].some(x=>x.peer))room.emptySince=Date.now();
}

 this.rooms=rooms;this.peers=peers;this.ips=ips;this.metrics=metrics;this.limits=LIMITS;
 this.publicRooms=publicRooms;this.cleanConfig=cleanConfig;this.validCommand=validCommand;
 this.send=send;this.error=error;this.left=left;
 this.add=ws=>{const p={ws,ip:ws.ip||'local',closed:false,room:null,slot:null,rateStart:Date.now(),rate:0,lastAlive:Date.now()};if(peers.size>=LIMITS.connections)throw Error('连接数超出限制');peers.add(p);ips.set(p.ip,(ips.get(p.ip)||0)+1);return p;};
 this.handle=(p,msg)=>{try{if(!p||p.closed)return;if(new TextEncoder().encode(JSON.stringify(msg)).length>LIMITS.payload){error(p,'消息超过16KB限制');return;}p.lastAlive=Date.now();handle(p,msg);}catch(e){error(p,'无法解析指令');log(e.message);}};
 this.advance=()=>{for(const room of rooms.values())if(room.started&&room.sim&&!room.emptySince){try{room.sim.tickStep();}catch(e){room.sim.paused=true;broadcast(room,{type:'error',message:'模拟异常，房间已安全暂停'});log(e.stack);}}};
 this.flush=()=>{for(const room of rooms.values()){
  if(!room.started||room.sim.tick===room.lastBroadcast&&!room.forceState)continue;room.lastBroadcast=room.sim.tick;
  const views=new Set([...room.watchers.values()].filter(w=>w.peer).map(w=>w.peer.view??0));
  for(const [view]of room.watchHistory)if(!views.has(view))room.watchHistory.delete(view);
  for(const view of views){let h=room.watchHistory.get(view);if(!h){h=[];room.watchHistory.set(view,h);}if(!h.length||room.sim.tick-h[h.length-1].tick>=10){h.push({tick:room.sim.tick,data:Wire.pack(room.sim.snapshot(view))});while(h.length>33)h.shift();}}
  for(const w of room.watchers.values())if(w.peer)watchState(w.peer,room);
  const force=!!room.forceState;room.forceState=false;for(const m of room.members.values())if(m.peer)state(m.peer,room.sim,force);
 }};
 this.sweep=()=>{
 const now=Date.now();for(const p of peers)if(now-p.lastAlive>65000){p.ws.close(1001,'Timeout');left(p);}
 for(const r of rooms.values()){
  for(const [token,w]of r.watchers)if(!w.peer&&now-(w.disconnected||now)>LIMITS.resumeMs)r.watchers.delete(token);
  for(const m of [...r.members.values()])if(!m.peer&&m.disconnected&&now-m.disconnected>LIMITS.resumeMs){m.token='';if(!r.started){r.members.delete(m.slot);Object.assign(r.config.slots[m.slot],{kind:'ai',human:false,name:'电脑 '+(m.slot+1)});}else if(r.sim.players[m.slot]?.alive&&!m.takenOver){m.takenOver=true;r.sim.players[m.slot].ai=true;broadcast(r,{type:'notice',message:m.name+' 超时离线，由电脑接管。'});}}
  if(!r.members.get(r.host)?.peer){const connected=[...r.members.values()].find(m=>m.peer);if(connected&&(!r.members.get(r.host)||now-(r.members.get(r.host).disconnected||now)>30000)){r.host=connected.slot;broadcast(r,{type:'notice',message:connected.name+' 成为房间管理员'});if(!r.started)lobby(r);}}
  if(r.emptySince&&now-r.emptySince>LIMITS.resumeMs||!r.started&&now-r.created>LIMITS.pendingMs||r.started&&now-r.startedAt>LIMITS.gameMs){broadcast(r,{type:'error',message:'房间已到期关闭'});for(const m of [...r.members.values(),...r.watchers.values()])m.peer?.ws.close(1001,'Room expired');rooms.delete(r.code);}
 }
 };
 }
};if(typeof module!=='undefined')module.exports=R.RoomService;
})(globalThis);
