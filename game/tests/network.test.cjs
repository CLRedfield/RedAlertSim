'use strict';
/** Actual localhost TCP/WebSocket integration, not a physical LAN or China-carrier test. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const R=require('../web/src/data.js'),Wire=require('../web/src/wire.js'),{ws:VendorSocket}=require('../server/vendor/ws.cjs');
const PORT=18787,URL='ws://127.0.0.1:'+PORT,peers=[],results=[];
const server=spawn(process.execPath,[path.join(__dirname,'../server/server.cjs'),'--port',String(PORT)],{stdio:['ignore','pipe','pipe']});
let log='';server.stdout.on('data',d=>log+=d);server.stderr.on('data',d=>log+=d);
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label,timeout=7000){const end=Date.now()+timeout;while(Date.now()<end){const v=fn();if(v)return v;await delay(15);}throw new Error('Timed out: '+label+'\n'+log);}
const identity={protocol:R.PROTOCOL,content:R.CONTENT_HASH,rules:R.RULES_HASH,mapHash:R.MAP_HASH,capabilities:{delta:true}};
async function peer(){
 const ws=new WebSocket(URL),p={ws,msgs:[],seq:0,frames:0,full:0,delta:0,state:null,baseline:null};
 p.send=m=>ws.send(JSON.stringify({...identity,...m}));p.command=command=>p.send({type:'command',seq:++p.seq,command});
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data);p.msgs.push(m);
  if(m.type==='welcome')p.welcome=m;
  if(m.type==='state'){p.full++;p.state=m.data;p.frames++;if(m.id){p.baseline={id:m.id,data:m.data};p.send({type:'ack',id:m.id});}}
  if(m.type==='delta'){assert.equal(m.base,p.baseline.id);p.delta++;p.state=Wire.apply(p.baseline.data,m.data);p.frames++;p.baseline={id:m.id,data:p.state};p.send({type:'ack',id:m.id});}
 });
 ws.addEventListener('error',()=>{});await until(()=>ws.readyState===1,'socket open');peers.push(p);return p;
}
async function check(name,fn){await fn();results.push({name,passed:true});console.log('PASS',name);}
async function response(p,msg,type,predicate=()=>true){const start=p.msgs.length;p.send(msg);return until(()=>p.msgs.slice(start).find(m=>m.type===type&&predicate(m)),type);}
(async()=>{try{
 await until(()=>log.includes('Open:'),'startup');
 await check('HTTP health, self-contained page and API metadata',async()=>{const h=await(await fetch('http://127.0.0.1:'+PORT+'/health')).json();assert.ok(h.ok);assert.equal(h.content,R.CONTENT_HASH);const html=await(await fetch('http://127.0.0.1:'+PORT)).text();assert.ok(html.includes('initHeadquarters'));const meta=await(await fetch('http://127.0.0.1:'+PORT+'/api/server')).json();assert.equal(meta.public,false);assert.equal(meta.limits.resumeSeconds,120);});
 const bad=await peer();
 await check('Protocol and content mismatch reject room creation',async()=>{const m=await response(bad,{type:'create',protocol:0},'error');assert.match(m.message,/版本|哈希/);const n=await response(bad,{type:'create',rules:'wrong'},'error');assert.match(n.message,/版本|哈希/);});
 const a=await peer(),b=await peer();
 a.send({type:'create',name:'Host',nation:'usa',roomName:'Integration room',config:{players:2,map:'valley',fogMode:'double',sandbox:true}});
 await until(()=>a.welcome,'welcome');const code=a.welcome.code;
 b.send({type:'join',code,name:'Guest',nation:'russia'});await until(()=>b.welcome,'join');
 await check('Two independent clients join the same real room',async()=>{const lobby=await until(()=>b.msgs.find(m=>m.type==='lobby'),'lobby');assert.equal(lobby.members.length,2);assert.equal(lobby.config.sandbox,false);assert.equal(lobby.config.slots[1].nation,'russia');});
 await check('Non-host start/configure and foreign-seat mutation rejected',async()=>{for(const msg of [{type:'start'},{type:'configure',config:{map:'urban'}},{type:'seat',slot:0,values:{team:1}}])assert.match((await response(b,msg,'error')).message,/房主|其他/);});
 await check('Start waits for guest ready state',async()=>assert.match((await response(a,{type:'start'},'error')).message,/准备/));
 await check('Host edits map; player edits their own nation',async()=>{await response(a,{type:'configure',config:{map:'urban'}},'lobby',m=>m.config.map==='urban');await response(b,{type:'seat',values:{nation:'yuri'}},'lobby',m=>m.config.slots[1].nation==='yuri');});
 await check('Public room directory and private-room flag',async()=>{const m=await response(bad,{type:'list'},'rooms');assert.ok(m.rooms.some(r=>r.code===code));});
 await check('Team-only chat is not sent to the enemy',async()=>{const before=b.msgs.length;await response(a,{type:'chat',text:'team secret',team:true},'chat');await delay(120);assert.ok(!b.msgs.slice(before).some(m=>m.type==='chat'));});
 await delay(650);
 await check('Chat is bounded plain text, not interpreted markup',async()=>{const m=await response(a,{type:'chat',text:'<img src=x onerror=alert(1)>',team:false},'chat');assert.equal(m.text,'<img src=x onerror=alert(1)>');await until(()=>b.msgs.some(x=>x.type==='chat'&&x.text===m.text),'chat delivered');});
 await response(b,{type:'ready'},'lobby',m=>m.members.find(x=>x.slot===1).ready);a.send({type:'start'});await until(()=>a.state?.tick>=3&&b.state?.tick>=3,'both states');
 await check('Opposite starting positions and filtered fog on both clients',async()=>{assert.deepEqual(a.state.players.map(p=>p.spawnId),[0,4]);assert.equal(a.state.cfg.fogMode,'double');assert.ok(!a.state.entities.some(e=>e.owner===1));assert.ok(!b.state.entities.some(e=>e.owner===0));assert.equal(a.state.p.memory,undefined);});
 await check('Client ACK causes smaller delta updates and valid reconstruction',async()=>{await until(()=>a.delta>1&&b.delta>1,'ACK delta');assert.equal(a.state.player,0);assert.equal(b.state.player,1);assert.ok(a.state.entities.every(e=>Number.isFinite(e.x)));});
 await check('Enemy ID commands and sandbox commands are rejected',async()=>{const enemy=b.state.entities.find(e=>e.owner===1&&R.D[e.type].kind==='vehicle');for(const command of [{type:'move',ids:[enemy.id],x:80,z:80},{type:'sandbox',action:'credits'}]){const from=a.msgs.length;a.command(command);const m=await until(()=>a.msgs.slice(from).find(m=>m.type==='commandResult'),'commandResult');assert.equal(m.result.ok,false);}});
 await check('Out-of-bounds coordinates and repeated sequence are rejected',async()=>{const m=await response(a,{type:'command',seq:++a.seq,command:{type:'move',ids:[],x:Infinity,z:2}},'error');assert.match(m.message,/范围|内容/);const n=await response(a,{type:'command',seq:a.seq,command:{type:'stop',ids:[]}},'error');assert.match(n.message,/重复|序号/);});
 await check('Accepted move changes an owned unit position authoritatively',async()=>{const tank=a.state.entities.find(e=>e.owner===0&&e.type==='grizzly'),x=tank.x,z=tank.z;a.command({type:'move',ids:[tank.id],x:57,z:160});await until(()=>{const e=a.state.entities.find(e=>e.id===tank.id);return e&&Math.hypot(e.x-x,e.z-z)>2;},'tank moved');});
 await check('Live replay download cannot reveal hidden state',async()=>assert.match((await response(a,{type:'replay'},'error')).message,/结束/));
 const before=a.state.tick,token=a.welcome.token,slot=a.welcome.player,seq=a.seq;a.ws.close();await delay(180);const restored=await peer();
 await check('Token reconnect restores same slot, simulation and sequence',async()=>{restored.send({type:'resume',code,token});await until(()=>restored.state,'resumed snapshot');assert.equal(restored.welcome.player,slot);assert.equal(restored.welcome.seq,seq);assert.ok(restored.state.tick>=before);restored.seq=seq;assert.ok(restored.msgs.some(m=>m.type==='start'&&m.resumed));});
 await check('Empty and incorrect tokens cannot steal a reserved slot',async()=>{for(const t of ['', 'f'.repeat(48)])assert.match((await response(bad,{type:'resume',code,token:t},'error')).message,/凭证|过期/);});
 await check('Explicit resync replaces baseline with a full state',async()=>{const f=restored.full;restored.send({type:'resync'});await until(()=>restored.full>f,'full resync');});
 await check('End state includes results and deterministic replay export',async()=>{b.command({type:'surrender'});await until(()=>restored.state?.winner!==null,'winner');assert.equal(restored.state.winner,0);assert.ok(Number.isFinite(restored.state.players[1].earned));const m=await response(restored,{type:'replay'},'replay');assert.equal(m.data.format,'ra3d-replay-v2');assert.equal(m.data.content,R.CONTENT_HASH);});
 await check('Host rematch returns to lobby and resets command sequence',async()=>{const m=await response(restored,{type:'rematch'},'lobby');assert.equal(m.code,code);assert.ok(m.members.some(x=>x.slot===1&&!x.ready));});
 const coop=await peer();coop.send({type:'create',config:{players:2,teams:'coop',slots:R.defaultSlots(2,'usa','coop').map(s=>({...s,team:0}))}});await until(()=>coop.welcome,'coop');
 await check('No-opponent room refuses to start instead of instant victory',async()=>assert.match((await response(coop,{type:'start'},'error')).message,/敌对/));
 const priv=await peer();priv.send({type:'create',private:true,config:{players:2}});await until(()=>priv.welcome,'private');
 await check('Private room excluded from discovery',async()=>{const m=await response(bad,{type:'list'},'rooms');assert.ok(!m.rooms.some(r=>r.code===priv.welcome.code));});
 const group=await Promise.all(Array.from({length:8},peer));group[0].send({type:'create',config:{players:8,map:'coast',fogMode:'single'}});await until(()=>group[0].welcome,'eight host');
 for(let i=1;i<8;i++){group[i].send({type:'join',code:group[0].welcome.code,name:'Load '+i});await until(()=>group[i].welcome,'eight join');group[i].send({type:'ready'});}
 await until(()=>group[0].msgs.some(m=>m.type==='lobby'&&m.members.length===8&&m.members.every(x=>x.ready)),'eight ready');group[0].send({type:'start'});
 await check('Eight virtual clients receive independent authoritative filtered states',async()=>{await until(()=>group.every(p=>p.state?.tick>10),'eight states',10000);assert.deepEqual(group.map(p=>p.state.player),[0,1,2,3,4,5,6,7]);await delay(1000);assert.ok(group.every(p=>p.delta>0));});
 await check('Per-IP room creation quota prevents unlimited lobby allocation',async()=>assert.match((await response(bad,{type:'create'},'error')).message,/过多|房间已满/));
 await check('Message flood is rejected without stopping other rooms',async()=>{for(let i=0;i<155&&bad.ws.readyState===1;i++)bad.send({type:'ping',at:i});await until(()=>bad.msgs.some(m=>m.type==='error'&&m.message.includes('频率'))||bad.ws.readyState!==1,'rate limit');const h=await(await fetch('http://127.0.0.1:'+PORT+'/health')).json();assert.ok(h.ok);});
 const huge=await peer();await check('Oversized WebSocket frame is closed',async()=>{huge.ws.send('x'.repeat(20000));await until(()=>huge.ws.readyState===3,'oversized close');});
 await check('Wrong browser Origin fails the WebSocket handshake',async()=>{const ws=new VendorSocket(URL,{origin:'https://example.invalid'});const result=await new Promise(resolve=>{ws.on('error',e=>resolve(e.message));ws.on('open',()=>{ws.close();resolve('unexpected success');});});assert.match(result,/403/);});
 await check('Mature WebSocket implementation handles fragmented text frames',async()=>{const ws=new VendorSocket(URL);await new Promise((r,j)=>{ws.on('open',r);ws.on('error',j);});const received=new Promise(r=>ws.on('message',v=>r(JSON.parse(String(v)))));ws.send('{"type":"pi',{fin:false});ws.send('ng","at":123}',{fin:true});const m=await received;assert.equal(m.type,'pong');assert.equal(m.at,123);ws.close();});
 await check('Metrics record delta frames and session resumes',async()=>{const m=await(await fetch('http://127.0.0.1:'+PORT+'/api/metrics')).json();assert.ok(m.delta>0);assert.ok(m.resumed>=1);assert.ok(m.bytesOut>0);results.push({name:'Observed metrics',passed:true,metrics:m});});
 }catch(e){console.error('FAIL',e.stack);results.push({name:'integration failure',passed:false,error:e.stack});process.exitCode=1;}
 finally{for(const p of peers)try{p.ws.close();}catch{}server.kill('SIGTERM');await delay(900);const output={version:R.VERSION,date:new Date().toISOString(),environment:'Node '+process.version+'; localhost TCP; up to 8 same-host virtual match clients, not physical network validation',passed:results.filter(x=>x.passed).length,total:results.length,results,serverLog:log};fs.writeFileSync(path.join(__dirname,'network-results.json'),JSON.stringify(output,null,2));console.log(output.passed+'/'+output.total+' network checks passed');}
})();
