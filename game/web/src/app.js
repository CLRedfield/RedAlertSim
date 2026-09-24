(function(G){'use strict';const R=G.RA,D=R.D,$=id=>document.getElementById(id),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Math.floor(n||0).toLocaleString('en-US'),clock=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;
function workerBody(){
 let sim=null,replay=null,view=0,last=performance.now(),acc=0,lastPost=0,speed=1,paused=false;
 const state=()=>{if(!sim)return;const data=sim.snapshot(view);if(replay)data.replay={tick:sim.tick,end:replay.data.endTick,paused,speed,view};postMessage({type:'state',data});};
 self.onmessage=event=>{try{const m=event.data;
  if(m.type==='start'){sim=new RA.Sim(m.config);replay=null;view=0;paused=false;last=performance.now();acc=0;speed=1;state();}
  if(m.type==='command'&&sim&&!replay){const result=sim.command(0,m.command);postMessage({type:'commandResult',command:m.command.type,result});state();if(!result.ok)postMessage({type:'notice',text:result.error});}
  if(m.type==='pause'&&sim){paused=m.paused;sim.paused=paused;acc=0;last=performance.now();state();}
  if(m.type==='speed')speed=Math.max(.25,Math.min(3,m.speed||1));
  if(m.type==='save'&&sim&&!replay)postMessage({type:'save',request:m.request,data:sim.save()});
  if(m.type==='exportReplay'&&sim)postMessage({type:'replay',data:replay?replay.data:sim.exportReplay()});
  if(m.type==='replay'){replay=new RA.Replay(m.data);sim=replay.sim;view=0;paused=false;last=performance.now();acc=0;state();}
  if(m.type==='seekReplay'&&replay){paused=true;replay.seek(Math.max(0,Math.min(replay.data.endTick,m.tick|0)));sim=replay.sim;sim.paused=true;acc=0;state();}
  if(m.type==='replayView'&&replay){view=Math.max(0,Math.min(sim.players.length-1,m.player|0));state();}
  if(m.type==='load'){sim=RA.Sim.load(m.data);sim._initialSave=JSON.parse(JSON.stringify(sim.save()));sim._journal=[];replay=null;view=0;paused=false;last=performance.now();acc=0;postMessage({type:'loaded'});state();}
 }catch(e){postMessage({type:'error',text:e.message,stack:e.stack});}};
 setInterval(()=>{if(sim&&!replay&&!paused&&sim.winner===null)postMessage({type:'autosave',data:sim.save()});},60000);
 setInterval(()=>{const now=performance.now(),delta=Math.min(.3,(now-last)/1000);last=now;if(!sim)return;acc+=delta*speed;if(paused||sim.paused){acc=0;return;}let work=0;while(acc>=RA.STEP&&work++<8){if(replay){if(sim.tick>=replay.data.endTick){paused=true;state();break;}replay.step();}else sim.tickStep();acc-=RA.STEP;}if(now-lastPost>90){state();lastPost=now;}},20);
}
function icon(d,big=false){const color=d.faction==='allies'?'#a7b5a0':d.faction==='soviet'?'#b9a590':d.faction==='yuri'?'#b1a0bf':'#aaa895',shade='#55614c',dark='#202d22',accent=d.faction==='yuri'?'#a591b8':d.faction==='soviet'?'#b2785e':'#89a7ac';let shape='';
 if(d.kind==='building'){shape=`<path d="M15 42 42 50 70 36 43 28Z" fill="${dark}"/><path d="M19 23 43 30 43 46 19 38Z" fill="${shade}"/><path d="M43 30 68 20 68 36 43 46Z" fill="${color}"/><path d="M19 23 42 14 68 20 43 30Z" fill="#879479"/>`;if(d.role==='power')shape+=`<path d="M27 25V12L34 9 41 12V29M49 27V12L56 9 62 12V22" fill="${color}" stroke="#293b2d" stroke-width="2"/><path d="m44 16-6 10h6l-3 10 12-14h-7l3-6Z" fill="#d4be78"/>`;else if(d.role==='defense'||d.role==='super')shape+=`<path d="M42 31V14M36 20h14" stroke="${accent}" stroke-width="7"/><path d="M43 17 68 9" stroke="#c2c7a5" stroke-width="4"/>`;else if(['radar','airfield','satellite'].includes(d.role))shape+=`<path d="M43 23V9" stroke="#b4c1a0" stroke-width="2"/><path d="M28 9Q46 28 56 3Z" fill="${color}" stroke="#263826"/>`;else if(['tech','cloner','robotcontrol'].includes(d.role))shape+=`<ellipse cx="44" cy="20" rx="14" ry="9" fill="${accent}"/><path d="M30 20H57M44 12v17" stroke="#c0cfb0" opacity=".7"/>`;else shape+=`<path d="M27 32v7M34 35v6M50 32v6M57 29v6" stroke="#29382a" stroke-width="3"/><path d="M21 19 64 8" stroke="${accent}" stroke-width="3"/>`;}
 else if(d.kind==='infantry'){shape=`<ellipse cx="44" cy="50" rx="19" ry="5" fill="#132319"/><path d="M35 49 40 32 48 34 53 50" stroke="${color}" stroke-width="8" fill="none"/><path d="M34 20 47 18 55 32 39 37Z" fill="${color}"/><path d="m36 23-9 12 10 4M49 21l11 8 5-9" fill="none" stroke="${shade}" stroke-width="6"/><circle cx="42" cy="12" r="7" fill="#c3b090"/><path d="M33 11q8-12 18 0" fill="${accent}"/><path d="M52 27 72 16" stroke="#b7c4a0" stroke-width="3"/>`;if(d.weapon==='psi')shape+=`<text x="65" y="17" fill="#d4abe4" font-size="18">Ψ</text>`;if(d.model==='dog')shape=`<path d="M23 29h27l9-14 12 8-10 12H33L25 46M53 33l6 13M26 32 13 25" stroke="${color}" stroke-width="7" fill="none"/>`;}
 else if(d.kind==='air'){if(d.model==='kirov')shape=`<ellipse cx="44" cy="26" rx="31" ry="15" fill="${color}" transform="rotate(-16 44 26)"/><path d="m22 36 8 11 18-4 3-9" fill="${shade}"/><path d="M19 16 24 28 11 29Z" fill="${accent}"/>`;else if(d.model==='disc')shape=`<ellipse cx="44" cy="30" rx="31" ry="11" fill="${color}"/><ellipse cx="44" cy="25" rx="13" ry="11" fill="${accent}"/><path d="M21 35h47" stroke="#a3ca91" stroke-width="3"/>`;else shape=`<path d="M43 4 51 25 76 37 71 43 50 35 49 45 57 50 54 54 43 50 32 54 29 50 37 45 36 35 14 43 9 37 35 25Z" fill="${color}"/><path d="M43 15v29" stroke="${shade}" stroke-width="3"/>`;}
 else if(d.kind==='ship'){shape=`<path d="m10 36 37 15 36-22-13-5-5-11-21-5-4 13Z" fill="${color}"/><path d="m11 39 25 14 39-24" stroke="#546753" stroke-width="4" fill="none"/><path d="m31 24 13 5 15-8-14-5Z" fill="${shade}"/><path d="M45 21V7M39 10h13" stroke="#c2c7b0" stroke-width="2"/><path d="m9 48 9 4m41-8 12-5" stroke="#7c9a90" fill="none"/>`;}
 else{shape=`<path d="M13 34 34 45 72 31 49 20Z" fill="${dark}" stroke="#74806a" stroke-width="2"/><path d="M18 26 35 36 70 22 49 12Z" fill="${color}"/><path d="M18 26v9l17 10v-9M35 36 70 22v10L35 45" fill="${shade}"/><path d="M29 18 44 25 58 19 43 12Z" fill="${accent}"/><path d="M48 17 72 7" stroke="#c9c9a8" stroke-width="4"/><path d="M22 34 31 39M41 39 47 36M52 35 58 32M62 30 67 28" stroke="#1b291c" stroke-width="3"/>`;if(d.ability==='miner')shape+=`<path d="M19 17 34 8 52 16 36 24Z" fill="#bda567"/><path d="M19 17v10l17 9V24" fill="#807346"/>`;if(d.weapon==='psi')shape+=`<ellipse cx="42" cy="19" rx="13" ry="9" fill="#b79abb"/><text x="37" y="22" fill="#e2d0de" font-size="12">Ψ</text>`;}
 return `<svg viewBox="0 0 86 60" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M0 48 86 14M0 28 86 54" stroke="#829570" opacity=".13"/><path d="M4 4h10M4 4v8M82 56H72M82 56v-8" stroke="#a3b78a" opacity=".32"/>${shape}</svg>`;}
class Sound{constructor(){this.volume=.3;this.ctx=null;this.last=0;}init(){if(this.ctx){this.ctx.resume();return;}try{this.ctx=new (G.AudioContext||G.webkitAudioContext)();this.master=this.ctx.createGain();this.master.gain.value=this.volume;this.master.connect(this.ctx.destination);const len=this.ctx.sampleRate*.4;this.noise=this.ctx.createBuffer(1,len,this.ctx.sampleRate);const a=this.noise.getChannelData(0);for(let i=0;i<len;i++)a[i]=(Math.random()*2-1)*(1-i/len);}catch(e){}}
 set(v){this.volume=v;if(this.master)this.master.gain.value=v;}
 play(kind='click'){if(!this.ctx||this.volume===0)return;const now=this.ctx.currentTime;if(kind==='shot'&&now-this.last<.11)return;if(kind==='explosion'&&now-this.last<.07)return;this.last=now;const gain=this.ctx.createGain();gain.connect(this.master);if(['shot','explosion'].includes(kind)){let src=this.ctx.createBufferSource();src.buffer=this.noise;const f=this.ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=kind==='explosion'?320:1600;src.connect(f);f.connect(gain);gain.gain.setValueAtTime(kind==='explosion'?.5:.09,now);gain.gain.exponentialRampToValueAtTime(.001,now+(kind==='explosion'?.35:.1));src.start();src.stop(now+.4);}else{const osc=this.ctx.createOscillator();osc.type='sine';osc.frequency.setValueAtTime(kind==='error'?190:kind==='ready'?710:480,now);osc.frequency.exponentialRampToValueAtTime(kind==='error'?110:kind==='ready'?1030:660,now+.09);gain.gain.setValueAtTime(.16,now);gain.gain.exponentialRampToValueAtTime(.001,now+.15);osc.connect(gain);osc.start();osc.stop(now+.16);}}}
const app=R.app={renderer:null,state:null,worker:null,net:null,mode:'skirmish',playing:false,paused:false,selected:new Set(),tab:'building',cursor:null,hover:null,mouse:null,drag:null,keys:new Set(),groups:{},lastFX:0,controls:'classic',sound:new Sound(),lastAlert:null,edge:true,guide:true,uiLast:0,request:0,pending:new Map(),ended:false};
let menuState=null,lastFrame=performance.now(),lastMinimap=0,cardCache='';
function createWorker(){if(app.worker)app.worker.terminate();const source=$('data-source').textContent+'\n'+$('sim-source').textContent+'\n('+workerBody.toString()+')();';let url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));const w=new Worker(url);URL.revokeObjectURL(url);w.onmessage=ev=>{const m=ev.data;if(m.type==='state')receiveState(m.data);if(m.type==='replay')app.onReplay?.(m.data);if(m.type==='commandResult')commandResult(m);if(m.type==='notice')toast(m.text,true);if(m.type==='error')toast('模拟错误：'+m.text,true);if(m.type==='autosave')app.onAutosave?.(m.data);if(m.type==='save'){const fn=app.pending.get(m.request);if(fn){fn(m.data);app.pending.delete(m.request);}}if(m.type==='loaded'){app.paused=false;$('pause-modal').classList.add('hidden');toast('存档已恢复');app.ended=false;$('result-modal').classList.add('hidden');}};w.onerror=e=>toast('工作线程错误：'+e.message,true);app.worker=w;return w;}
function config(){const teams=$('teams').value;const c={seed:Number.isInteger(app.matchSeed)?app.matchSeed:260912,map:$('map').value,players:+$('players').value,nation:$('nation').value,difficulty:$('difficulty').value,credits:+$('credits').value,startBase:$('startBase').value==='true',sandbox:app.mode==='sandbox',fogMode:$('fog-mode').value,teams};if(app.setupSlots)c.slots=JSON.parse(JSON.stringify(app.setupSlots));if(app.operationId){const op=R.operationConfig(app.operationId,c);if(c.slots?.length===4)op.slots=c.slots;return op;}return c;}
function beginView(){app.resetPointer?.();cancelPlan();app.keys.clear();app.lastKeyTimes={};app.pendingPlace=false;app.sound.init();app.playing=true;app.ended=false;app.paused=false;app.selected.clear();app.cursor=null;app.hover=null;app.groups={};app.lastFX=0;app.guide=app.camera.prefs.showTips;app.controls=$('controls').value;$('ingame-controls').value=app.controls;document.body.classList.add('playing');$('menu').classList.add('hidden');$('hud').classList.remove('hidden');$('hint').classList.toggle('hidden',!app.guide);$('result-modal').classList.add('hidden');$('sandbox-ui').classList.add('hidden');$('production-ui').style.display='contents';$('tooltip').classList.add('hidden');app.renderer.zoom=35;app.renderer.cache.clear();app.renderer.lastFogTick=-1;cardCache='';$('speed').value='1';setTab('building');}
function startLocal(override){const cfg=override&&typeof override==='object'&&override.map?override:config();const valid=R.validateSetup(cfg);if(!valid.ok){toast(valid.error,true);if($('setup-error'))$('setup-error').textContent=valid.error;return false;}if(app.net)disconnect();app.replayMode=false;app.lastConfig=JSON.parse(JSON.stringify(cfg));beginView();app.state=null;app.renderer.target={x:R.SPAWNS[0][0]+3,z:R.SPAWNS[0][1]-7};$('sandbox-toggle').classList.toggle('hidden',!cfg.sandbox);createWorker().postMessage({type:'start',config:cfg});$('netbadge').textContent='LOCAL / WORKER';if(cfg.sandbox)toast('沙盒已启动：右上角打开工具，可生成双方单位。');else toast(app.controls==='classic'?'经典操作：左键指令，右键取消。F1查看完整手册。':'现代操作：左键选择，右键指令。');return true;}
function receiveState(s){const first=!app.state||app.state.player!==s.player||s.tick<app.state.tick;app.state=s;if(app.cursor?.type==='place'&&!Object.values(s.p.readySlots||{legacy:s.p.ready}).some(i=>i?.type===app.cursor.unit)){setCursor(null);app.pendingPlace=false;}if(first){const spawn=R.SPAWNS[s.p.spawnId??s.player];app.renderer.target={x:spawn[0]+3,z:spawn[1]-7};const h=s.entities.find(e=>e.owner===s.player&&(D[e.type].role==='hq'||D[e.type].ability==='mcv'));if(h)app.selected.add(h.id);app.renderer.lastFogTick=-1;}
 for(const id of app.selected)if(!s.entities.some(e=>e.id===id))app.selected.delete(id);for(const f of s.effects||[]){if(f.id<=app.lastFX)continue;app.lastFX=Math.max(app.lastFX,f.id);if(f.type==='ready'&&f.owner===s.player){toast('建筑已就绪。点击生产图标，然后在基地附近放置。');app.sound.play('ready');}if(f.type==='alert'&&f.owner===s.player){app.lastAlert={x:f.x,z:f.z};toast('基地遭到攻击！按空格前往。',true);}if(f.type==='defeat'&&f.owner!==s.player)toast((s.players[f.owner]?.name||'一名指挥官')+' 已被击败');if(f.type==='crush'&&f.owner===s.player)app.sound.play('explosion');if(['shot','explosion'].includes(f.type)&&Math.hypot(f.x-app.renderer.target.x,f.z-app.renderer.target.z)<50)app.sound.play(f.type);}
 if(!app.ended&&!app.replayMode&&!s.cfg.sandbox&&(s.winner!==null||!app.net?.spectator&&!s.p.alive)){app.ended=true;showResult();}updateUI();}
function command(c){if(!app.playing||app.replayMode||app.net?.spectator)return;if(app.net){if(!app.net.command(c))toast('正在恢复网络连接，指令未发送',true);return;}if(app.worker)app.worker.postMessage({type:'command',command:c});}
function toast(text,error=false){const el=document.createElement('div');el.className='toast-item'+(error?' error':'');el.textContent=text;$('toast').appendChild(el);while($('toast').children.length>4)$('toast').firstChild.remove();setTimeout(()=>el.remove(),4700);if(error)app.sound.play('error');app.logNotice?.(text,error);}
function own(role){return app.state?.entities.filter(e=>e.owner===app.state.player&&!e.ghost&&(!role||D[e.type].role===role))||[];}
function has(role){return role==='radar'?own().some(e=>['radar','airfield'].includes(D[e.type].role)):own(role).length>0;}
function allowed(d){const s=app.state;if(!s)return false;const p=s.p;if(!s.cfg.sandbox&&d.requires.some(r=>!has(r)))return false;if(d.kind==='building')return has('hq')&&(!d.water||s.map==='coast');if(d.kind==='infantry')return has('barracks');if(d.kind==='ship')return has('naval');return has(d.producer||'factory');}
function setTab(tab){app.tab=tab;cardCache='';document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));if(app.state)renderCards();}
function renderCards() {
    const s=app.state;if(!s)return;
    const list=R.defs().filter(d=>d.faction===s.p.faction&&d.category===app.tab&&!d.sandboxOnly&&d.role!=='hq'&&(!d.nation||d.nation===s.p.nation));
    const stamp=s.p.faction+s.p.nation+app.tab;
    if(stamp!==cardCache) {
        $('build-grid').innerHTML='';
        list.forEach((d,index)=>{
            const btn=document.createElement('button');btn.className='build-card';btn.dataset.unit=d.id;
            btn.setAttribute('aria-label',`${d.name}，${d.cost}资金`);
            btn.innerHTML=`<div class="thumb">${icon(d)}</div>${index<10?`<span class="slot-key">Alt+${(index+1)%10}</span>`:''}<span class="unit-name">${esc(d.name)}</span><span class="cost">$ ${fmt(d.cost)}</span><span class="number hidden"></span><div class="progress hidden"></div><div class="ready hidden">就 绪</div><span class="pause-label hidden">暂 停</span><span class="lock hidden">×</span>`;
            btn.onclick=e=>activateCard(d,e.shiftKey);
            btn.oncontextmenu=e=>{e.preventDefault();command({type:'secondaryProduction',category:d.category,unit:d.id,all:e.shiftKey});};
            btn.onmouseenter=e=>tooltip(d,e.clientY);btn.onmouseleave=hideTooltip;$('build-grid').appendChild(btn);
        });cardCache=stamp;
    }
    const q=s.p.queues[app.tab]||[];
    for(const btn of $('build-grid').children) {
        const id=btn.dataset.unit,d=D[id],locked=!allowed(d),items=q.filter(i=>i.type===id),ready=readyFor(d.category)?.type===id;
        const active=q[0]?.type===id,paused=active&&q[0].paused;
        btn.classList.toggle('locked',locked&&!ready);btn.title=locked?(app.lockReason?.(d)||'科技前置未满足'):ready?'建造完成，点击放置':s.p.credits<d.cost?'资金不足时生产会等待资金':d.name;btn.classList.toggle('paused',!!paused);
        btn.querySelector('.lock').classList.toggle('hidden',!locked||ready);
        btn.querySelector('.ready').classList.toggle('hidden',!ready);
        btn.querySelector('.pause-label').classList.toggle('hidden',!paused);
        btn.querySelector('.number').classList.toggle('hidden',!items.length);btn.querySelector('.number').textContent=items.length;
        const prog=btn.querySelector('.progress');prog.classList.toggle('hidden',!active);
        prog.style.height=active?Math.min(100,q[0].progress/q[0].total*100)+'%':'0%';
        const cost=has('industry')&&d.kind!=='building'&&d.kind!=='infantry'?d.cost*.75:d.cost;btn.querySelector('.cost').textContent='$ '+fmt(cost);
    }
    document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('has-ready',!!readyFor(b.dataset.tab)));
    const item=q[0];
    $('queue-status').textContent=item?`${D[item.type].name} · ${item.paused?'已暂停':item.blocked||Math.floor(item.progress/item.total*100)+'%'+(s.p.power<s.p.drain?' 低电力':'')}`:readyFor(app.tab)?'建造完成 · 按类别快捷键拿起':'生产线待命';
    $('queue-pause').disabled=!item;$('queue-cancel').disabled=!item;
    $('queue-pause').textContent=item?.paused?'▶':'Ⅱ';
}
function tooltip(d,clientY){const req=d.requires.map(r=>({hq:'建造场',power:'发电设施',barracks:'兵营',refinery:'采矿设施',factory:'战车工厂',radar:'雷达 / 空军指挥部',tech:'作战实验室',robotcontrol:'控制中心'}[r]||r)).join(' / ')||'基础生产设施';$('tooltip').innerHTML=`<strong>${esc(d.name)}</strong><div class="tag">${esc(R.FACTIONS[d.faction]?.abbr||'NEUTRAL')} · $${fmt(d.cost)} · ${d.hp} HP</div>${esc(d.description||d.kind==='building'?'':'')}<div>${esc(d.description||({psi:'心灵控制有效目标。',magnet:'牵引与短暂抬升目标。',prism:'光棱武器，擅长远程火力支援。',bullet:'常规火力，以反步兵为主。',missile:'导弹火力。',cannon:'装甲战斗与火力支援。',chaos:'制造区域混乱，使单位失去阵营识别。'}[d.weapon]||'使用独立三维模型的可玩原型单位。'))}</div><div style="margin-top:7px;color:#c6bb91">前置：${esc(req)}</div><div style="font-size:10px;margin-top:5px">左键生产 / 恢复 · Shift批量 · 右键先暂停，再取消</div>`;$('tooltip').classList.remove('hidden');$('tooltip').style.left=Math.max(8,innerWidth-parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sidebar'))-257)+'px';$('tooltip').style.top=clamp(clientY-65,52,innerHeight-$('tooltip').offsetHeight-15)+'px';}
function hideTooltip(){$('tooltip').classList.add('hidden');}
function updateUI(){const s=app.state;if(!s||!app.playing)return;$('credits-value').textContent=fmt(s.p.credits);$('clock').textContent=clock(s.time);const F=R.FACTIONS[s.p.faction];$('faction-name').textContent=F.name+' / '+R.nation(s.p.nation).name;$('faction-abbr').textContent=F.abbr+' COMMAND';$('map-name').textContent=(R.MAPS.find(m=>m.id===s.map)?.name||s.map)+' · '+s.players.filter(p=>!p.closed).length+'方';$('power-text').textContent=`${Math.floor(s.p.power)}/${Math.floor(s.p.drain)}`;$('power-fill').style.width=clamp(s.p.drain/Math.max(s.p.power,1)*100,5,100)+'%';$('power-track').classList.toggle('low',s.p.power<s.p.drain);$('radar-locked').classList.toggle('hidden',has('radar')&&s.p.power>=s.p.drain||s.cfg.sandbox);renderCards();selectionUI();superUI();updateGuide();updateOperationalUI();app.upgradeUI?.(s);}
function selectionUI(){const s=app.state;if(!s)return;const units=s.entities.filter(e=>app.selected.has(e.id)),d=units[0]?D[units[0].type]:null;const sig=units.map(e=>e.type).join(',');if($('selection-portrait').dataset.sig!==sig){$('selection-portrait').innerHTML=d?icon(d,true):'<span style="font:30px monospace;color:#6e865c">⌖</span>';$('selection-portrait').dataset.sig=sig;}if(!d){$('selection-name').textContent='选择作战单位';$('selection-detail').textContent='点选 / 拖动框选单位';$('selection-extra').textContent='H 返回基地 · F1 操作手册';$('selection-hp').style.width='0%';return;}const e=units[0];$('selection-name').textContent=units.length>1?units.length+' 个单位已选择':d.name;$('selection-detail').textContent=units.length>1?[...new Set(units.map(t=>D[t.type].name))].slice(0,3).join(' / '):`${Math.ceil(e.hp)} / ${e.maxHp}  ·  ${e.owner<0?'中立':s.players[e.owner].name}`;$('selection-hp').style.width=clamp(units.reduce((sum,e)=>sum+e.hp,0)/units.reduce((sum,e)=>sum+e.maxHp,0)*100,0,100)+'%';$('selection-extra').textContent=e.deployed?'已部署 · D 收起':d.ability==='mcv'?'D 展开基地车':e.passengers?.length?'载员 '+e.passengers.length+' / '+d.capacity+' · U 卸载':d.ability==='miner'?'矿载 '+Math.round(e.cargo)+' / '+d.cargoMax:d.kind==='building'?'右侧工具：维修 / 出售 / 集结点':`${d.range?'射程 '+d.range+' · ':''}${d.damage?'攻击 '+d.damage+' · ':''}${d.control?'心灵控制':''}${e.rank?'★'.repeat(e.rank):''}`;}
function superUI(){const s=app.state,list=own().filter(e=>D[e.type].super);if(s.p.nation==='usa'&&has('airfield'))list.push({id:'paradrop',type:null,charge:s.p.paradrop});const stamp=list.map(e=>e.id).join(',');if($('superbar').dataset.stamp!==stamp){$('superbar').innerHTML='';for(const e of list){let k=e.type?D[e.type].super:'paradrop',btn=document.createElement('button');btn.dataset.id=e.id;btn.onclick=()=>{setCursor({type:'super',ability:k});};$('superbar').appendChild(btn);}$('superbar').dataset.stamp=stamp;}for(const e of list){let d=e.type?D[e.type]:null,k=d?.super||'paradrop',max=d?.charge||100,ready=e.charge>=max,b=$('superbar').querySelector(`[data-id="${e.id}"]`);b.classList.toggle('ready',ready);b.disabled=!ready;b.innerHTML=`${R.SUPERS[k].symbol} ${R.SUPERS[k].name}<span>${ready?'就绪':clock(max-e.charge)}</span>`;}}
function updateGuide(){if(!app.guide||!app.state)return;const s=app.state;let title,body;if(s.cfg.sandbox){title='沙盒：自由部署试验';body='点击右上「沙盒工具」，选择对象、所属方和数量，然后在战场放置。';}else if(!has('hq')){title='展开你的基地车';body='选择基地车，按D或下方「部署」按钮，开始建设基地。';}else if(!has('factory')){title='建立装甲生产线';body='在「建筑」栏建造战车工厂。完成后再次点击图标，在基地附近放置。';}else if(!has('radar')){title='接通战术雷达';body='建造空军指挥部 / 雷达 / 心灵探测器。电力充足时会开启小地图。';}else if(!has('tech')){title='推进高级科技';body='建造作战实验室，解锁重型单位与超级武器。组建装甲部队向中央推进。';}else{title='掌握战场主动权';body='工程师可以占领中央油井。按A后点击敌方方向，部队将在行进中接敌。';}$('hint-title').textContent=title;$('hint-body').textContent=body;}
function setCursor(c) {
    app.cursor=c;$('tooltip').classList.add('hidden');
    const label=c?c.type==='place'?'放置 '+D[c.unit].name+' · 短按右键取消，长按拖图':c.type==='super'?R.SUPERS[c.ability].name+' · 点击目标位置':c.type==='sandboxSpawn'?'沙盒生成 '+D[c.unit].name+' · 短按右键取消，长按拖图':({attackMove:'攻击移动 · 点击目标位置',move:'移动指令 · 点击目标位置',forceMove:'强制移动 / 碾压 · 点击位置',forceAttack:'强制攻击 · 点击目标或地面',patrol:'往返巡逻 · 点击终点',repair:'维修工具 · 点击己方建筑',sell:'出售工具 · 点击己方建筑',rally:'集结点 · 点击位置，Shift追加路径'}[c.type]||'选择目标'):'';
    $('cursor-mode').textContent=label;$('cursor-mode').classList.toggle('hidden',!c);
    for(const id of ['repair','sell','rally'])$(id+'-tool').classList.toggle('active',c?.type===id);
}
function placement() {
    if(!app.cursor||app.cursor.type!=='place'||!app.mouse||!app.state||app.camera?.dragging)return null;
    const world=app.renderer.groundAt(app.mouse.x,app.mouse.y),d=D[app.cursor.unit];
    const f=R.placementCheck({player:app.state.player,map:app.state.map,entities:app.state.entities,fog:app.state.fog},d,world.x,world.z);
    const text=`${d.name} · ${f.w}×${f.h}格 · ${f.valid?'左键放置':f.reason} · 右键取消`;
    if($('cursor-mode').textContent!==text)$('cursor-mode').textContent=text;
    return f;
}
function clickWorld(button,point,shift=false,ctrl=false,alt=false) {
    if(!app.state||app.paused)return;
    const hit=app.renderer.pick(point.x,point.y),w=app.renderer.groundAt(point.x,point.y),s=app.state,ids=[...app.selected];
    if(button===2&&app.plan){cancelPlan();return;}
    if(button===2&&app.cursor){setCursor(null);return;}
    const gesture=alt?'forceMove':ctrl&&shift?'attackMove':ctrl?'forceAttack':null;
    if(app.plan&&button===0) {
        const type=gesture||app.cursor?.type||(hit&&hit.owner!==s.player?'target':'move');
        const c={type,x:w.x,z:w.z};if(hit&&['target','forceAttack'].includes(type))c.target=hit.id;
        issueOrder(c,shift);return;
    }
    if(app.cursor&&button===0) {
        const c=app.cursor;
        if(c.type==='place') {
            const f=placement();if(f?.valid){if(!app.pendingPlace){app.pendingPlace=true;command({type:'place',unit:c.unit,x:f.x,z:f.z});}}
            else toast(f?.reason||'此处无法建造',true);
        } else if(c.type==='sandboxSpawn'){command({type:'sandbox',action:'spawn',unit:c.unit,owner:c.owner,count:c.count,x:w.x,z:w.z});if(!shift)setCursor(null);}
        else if(c.type==='super'){command({type:'super',ability:c.ability,ids,x:w.x,z:w.z});setCursor(null);}
        else if(['repair','sell'].includes(c.type)){if(hit)command({type:c.type,id:hit.id});}
        else if(c.type==='rally'){setRally(w,shift);if(!shift)setCursor(null);}
        else {issueOrder({type:gesture||c.type,x:w.x,z:w.z,...(hit&&(gesture==='forceAttack'||c.type==='forceAttack')?{target:hit.id}:{})},shift&&!ctrl);setCursor(null);}
        app.sound.play();return;
    }
    if(button===0&&shift&&hit?.owner===s.player&&!gesture) {
        if(app.selected.has(hit.id))app.selected.delete(hit.id);else app.selected.add(hit.id);selectionUI();return;
    }
    if(button===2&&app.controls==='classic'){app.selected.clear();selectionUI();return;}
    const orderClick=button===2&&app.controls==='modern'||button===0&&app.controls==='classic'&&ids.length>0||button===0&&!!gesture;
    if(orderClick) {
        const selected=own().filter(e=>app.selected.has(e.id));
        if(gesture&&selected.length){issueOrder({type:gesture,x:w.x,z:w.z,...(hit?{target:hit.id}:{})},shift&&!ctrl);return;}
        const canLoad=hit&&(hit.owner===s.player||hit.owner<0&&D[hit.type].role==='civilian')&&(D[hit.type].capacity||D[hit.type].role==='grinder')&&selected.some(e=>e.id!==hit.id&&D[e.type].kind!=='building');
        const canCapture=hit&&D[hit.type].kind==='building'&&selected.some(e=>['engineer','spy'].includes(D[e.type].ability));
        if((!hit||hit.owner!==s.player||canLoad||canCapture)&&selected.length) {
            if(selected.every(e=>D[e.type].kind==='building'))setRally(w,shift);
            else {
                const ore=!hit&&s.ores.find(o=>o.amount>0&&Math.hypot(o.x-w.x,o.z-w.z)<5);
                if(ore&&selected.every(e=>D[e.type].ability==='miner'))issueOrder({type:'harvest',ore:ore.id,x:ore.x,z:ore.z},shift);
                else issueOrder(hit?{type:'target',target:hit.id,x:hit.x,z:hit.z}:{type:'move',x:w.x,z:w.z},shift);
            }
            return;
        }
    }
    if(button===0){if(!shift)app.selected.clear();if(hit)app.selected.add(hit.id);selectionUI();app.sound.play();}
}
function drawMinimap(){const s=app.state;if(!s)return;const canvas=$('minimap'),c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;c.fillStyle='#15261c';c.fillRect(0,0,w,h);if(s.map==='coast'){c.fillStyle='#142e2c';c.fillRect(0,0,w,h);c.fillStyle=s.map==='desert'?'#4d4930':'#33452b';c.fillRect(w*18/192,h*18/192,w*156/192,h*156/192);}c.strokeStyle='#536043';c.lineWidth=2;c.beginPath();c.moveTo(w/2,0);c.lineTo(w/2,h);c.moveTo(0,h/2);c.lineTo(w,h/2);c.stroke();for(const o of s.ores)if(o.amount>0){c.fillStyle=o.gem?'#78bda3':'#baab5e';c.fillRect(o.x/192*w-2,o.z/192*h-2,4,4);}for(let z=0;z<64;z++)for(let x=0;x<64;x++){const v=s.fog[z*64+x];if(v===2)continue;c.fillStyle=v===1?'#08130ccc':'#060d09';c.fillRect(x/64*w,z/64*h,Math.ceil(w/64),Math.ceil(h/64));}
 for(const e of s.entities){c.fillStyle=e.owner<0?'#9b9872':R.COLORS[e.owner];const size=D[e.type].kind==='building'?4:2;c.globalAlpha=e.ghost?.35:1;c.fillRect(e.x/192*w-size/2,e.z/192*h-size/2,size,size);}c.globalAlpha=1;c.strokeStyle='#d2d2a6bb';c.lineWidth=1;c.beginPath();for(const [i,p]of[[0,[0,0]],[1,[app.renderer.width,0]],[2,[app.renderer.width,app.renderer.height]],[3,[0,app.renderer.height]]]){const v=app.renderer.groundAt(...p);i?c.lineTo(v.x/192*w,v.z/192*h):c.moveTo(v.x/192*w,v.z/192*h);}c.closePath();c.stroke();}
function pause(show){if(!app.playing)return;app.resetPointer?.();app.keys.clear();if(show)cancelPlan();app.paused=show;$('pause-modal').classList.toggle('hidden',!show);$('pause-note').textContent=app.net?'联机对局继续运行，菜单不会暂停服务器。':'单机模拟已暂停。';$('speed').disabled=!!app.net;$('ingame-fog').disabled=!!app.net;$('ingame-fog').value=app.state?.cfg?.fogMode||'double';for(const id of['save-quick','load-quick','save-file','load-file'])$(id).disabled=!!app.net;if(app.worker)app.worker.postMessage({type:'pause',paused:show});hideTooltip();}
function save(mode){if(!app.worker)return toast('联机不支持单机存档',true);const id=++app.request;app.pending.set(id,data=>{if(mode==='quick'){try{localStorage.setItem('ra3d-save',JSON.stringify(data));toast('快速存档已保存到本浏览器');}catch(e){toast('浏览器存储不可用，请导出存档文件',true);}}else{download('RA3D_save_'+Math.floor(data.time)+'s.json',JSON.stringify(data),'application/json');toast('已导出存档文件');}});app.worker.postMessage({type:'save',request:id});}
function download(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function loadSave(data){if(!app.worker)return;app.resetPointer?.();cancelPlan();try{const test=R.Sim.load(data);if(!test)throw new Error('无效存档');app.worker.postMessage({type:'load',data});app.selected.clear();app.renderer.cache.clear();app.lastFX=data.fxId||0;cardCache='';}catch(e){toast('读取失败：'+e.message,true);}}
function quit(){app.resetPointer?.();cancelPlan();app.keys.clear();if(app.worker){app.worker.terminate();app.worker=null;}disconnect();app.playing=false;app.paused=false;app.state=null;app.selected.clear();setCursor(null);document.body.classList.remove('playing');$('hud').classList.add('hidden');$('menu').classList.remove('hidden');document.querySelectorAll('.modal').forEach(e=>e.classList.add('hidden'));app.renderer.target={x:48,z:142};app.renderer.zoom=35;app.renderer.generateProps(260905,'coast');app.renderer.lastFogTick=-1;hideTooltip();app.replayMode=false;app.returnHome?.();}
function showResult(){app.resetPointer?.();app.keys.clear();const s=app.state,win=s.winner===s.p.team;$('result-title').textContent=win?'战场已控制':'基地已失守';$('result-description').textContent=win?'敌方作战体系已被摧毁。':'失去全部建筑与基地车，指挥权终止。';$('result-stats').innerHTML=`<div><b>${s.p.kills}</b><small>摧毁目标</small></div><div><b>${s.p.lost}</b><small>己方损失</small></div><div><b>${clock(s.time)}</b><small>作战时长</small></div>`;$('result-modal').classList.remove('hidden');app.sound.play(win?'ready':'error');app.afterResult?.(s);}
function mode(mode){app.mode=mode;document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));$('network-ui').classList.toggle('hidden',mode!=='network');$('local-launch').classList.toggle('hidden',mode==='network');$('launch').textContent=mode==='sandbox'?'开启试验场　↗':'部署战场　↗';$('mode-description').innerHTML=mode==='network'?'需要运行压缩包内的联机服务器。<br>同一局域网通过服务器IP访问；异地需要可达的服务器地址。':mode==='sandbox'?'自由生成目录中的单位与建筑，测试不同阵营的交互。<br>沙盒默认不启动AI进攻，可使用工具开启。':'经典左键下达指令，右键取消选择。<br>初次试玩建议保留「战备基地」，快速体验建造与交战。';}
function nationInfo(){const n=R.nation($('nation').value);$('nation-info').innerHTML=`<b>${esc(n.special)} / ${R.FACTIONS[n.faction].name}</b><span>${esc(n.desc)}</span>`;}
function catalog(filter=''){const q=filter.toLowerCase();$('catalog-grid').innerHTML=R.defs().filter(d=>!q||`${d.name} ${d.id} ${R.FACTIONS[d.faction]?.name} ${d.description||''}`.toLowerCase().includes(q)).map(d=>`<div class="catalog-entry">${icon(d)}<div><b>${esc(d.name)}</b><small>${esc(R.FACTIONS[d.faction]?.name||'中立')} · $${fmt(d.cost)}</small><small>${d.hp} HP${d.sandboxOnly?' · 沙盒专属':''}</small></div></div>`).join('');}
function disconnect(){if(app.net){app.net.close();app.net=null;}$('lobby').classList.add('hidden');$('net-status').textContent='';app.netStatus?.('未连接','offline');}
function connect(action,extra={}){
 disconnect();const mqtt=app.networkTransport==='mqtt',url=mqtt?($('broker-url')?.value.trim()||R.DEFAULT_BROKER):$('server-url').value.trim()||'ws://127.0.0.1:8787';
 const payload={config:config(),code:mqtt?$('room-code').value.trim():$('room-code').value.trim().toUpperCase(),name:$('nickname')?.value.trim()||'指挥官',nation:$('nation').value,roomName:$('room-name')?.value,private:$('private-room')?.checked,...extra};
 const net=new (mqtt?R.MqttRoomClient:R.RoomClient)(url,action,payload,networkMessage,(text,status)=>{$('net-status').textContent=text;app.netStatus?.(text,status);});app.net=net;
 if(action==='resume'&&!mqtt){net.token=extra.token;net.room=extra.code;net.seq=extra.seq||0;}
}
function networkMessage(m,net){
 if(app.net!==net)return;
 if(m.type==='commandResult'){commandResult(m);return;}
 if(m.type==='error'){toast(m.message,true);$('net-status').textContent=m.message;return;}
 if(m.type==='lobby'){
  net.spectator=!!m.spectator;net.room=m.code;net.player=m.you;net.host=m.host;net.members=m.members;net.config=m.config;$('fog-mode').value=m.config.fogMode;
  $('lobby').classList.remove('hidden');$('lobby-code').textContent=m.code;$('room-code').value=net.transport==='mqtt'?(net.invite||''):m.code;$('net-status').textContent='已连接 · '+R.FOG_MODES[m.config.fogMode];
  $('lobby-members').innerHTML=m.members.map(p=>`<div class="lobby-member"><span>${p.slot+1}. ${esc(p.name)}</span><small>${!p.connected?'掉线保留':p.ready?'已准备':'等待准备'}</small></div>`).join('');
  $('start-room').disabled=m.you!==m.host||net.spectator;$('ready-room').disabled=net.spectator;$('ready-room').textContent=m.members.find(p=>p.slot===m.you)?.ready?'取消准备':'准备';app.onLobby?.(m);return;
 }
 if(m.type==='start'){
  net.spectator=!!m.spectator;const restore=!!m.resumed&&app.playing;if(!restore){if(app.worker){app.worker.terminate();app.worker=null;}app.replayMode=false;beginView();app.state=null;}
  net.room=m.code;app.renderer.lastFogTick=-1;$('sandbox-toggle').classList.add('hidden');$('netbadge').textContent='ONLINE / '+m.code;toast(restore?'连接恢复，已同步最新战场':'联机对局已开始。房间 '+m.code);app.netStatus?.('连接正常','connected');return;
 }
 if(m.type==='state'){receiveState(m.data);$('netbadge').textContent='ONLINE / '+net.room+' · '+(net.ping??'?')+' ms';}
 if(m.type==='notice')toast(m.message,true);
 if(m.type==='replay')app.onReplay?.(m.data);
 if(m.type==='rematch'){app.playing=false;app.ended=false;app.state=null;app.paused=false;document.body.classList.remove('playing');$('hud').classList.add('hidden');$('menu').classList.remove('hidden');$('result-modal').classList.add('hidden');net.seq=0;app.showPage?.('network');}
 app.onNetwork?.(m);
}

// Input state, waypoint planning and UI operations are separate from the shared simulation.
function readyFor(category){return app.state?.p.readySlots?.[category]||((D[app.state?.p.ready?.type]?.category===category)?app.state.p.ready:null);}
function commandResult(m){if(m.command==='place'){app.pendingPlace=false;if(m.result.ok&&app.cursor?.type==='place')setCursor(null);}}
function activateCard(d,batch=false) {
    app.sound.init();const ready=readyFor(d.category),current=app.state.p.queues[d.category]?.[0];
    if(ready?.type===d.id){cancelPlan();setCursor({type:'place',unit:d.id});return;}
    if(current?.type===d.id&&current.paused){command({type:'pauseQueue',category:d.category,unit:d.id,paused:false});return;}
    if(!allowed(d)){toast(app.lockReason?.(d)||'科技前置或生产设施未满足',true);return;}
    command({type:'queue',unit:d.id,count:batch?5:1});app.sound.play();
}
function selectCategory(category) {
    setTab(category);const ready=readyFor(category);
    if(ready){cancelPlan();setCursor({type:'place',unit:ready.type});}
}
function selectBuilding(role) {
    const list=own().filter(e=>D[e.type].kind==='building'&&(D[e.type].role===role||role==='airfield'&&D[e.type].role==='radar')).sort((a,b)=>a.id-b.id);
    if(!list.length){toast('尚未拥有这种建筑',true);return;}
    const current=list.findIndex(e=>app.selected.has(e.id)),e=list[(current+1)%list.length];
    cancelPlan();setCursor(null);app.selected=new Set([e.id]);app.camera.focus({x:e.x,z:e.z});selectionUI();app.sound.play();
}
function onScreen(e){return app.renderer.projections.some(p=>p.id===e.id&&p.x>=0&&p.y>=0&&p.x<=app.renderer.width&&p.y<=app.renderer.height);}
function selectSame(all=false,seed=null) {
    const selected=seed||own().find(e=>app.selected.has(e.id));if(!selected)return;
    app.selected=new Set(own().filter(e=>e.type===selected.type&&(all||onScreen(e))).map(e=>e.id));selectionUI();
}
function setRally(point,append=false) {
    const list=own().filter(e=>app.selected.has(e.id)&&R.PRODUCER_ROLES.includes(D[e.type].role));
    if(!list.length){toast('先选择生产建筑',true);return;}
    for(const e of list)command({type:'rally',id:e.id,x:point.x,z:point.z,append});
    app.commandMarker={x:point.x,z:point.z,time:performance.now(),type:'rally'};app.sound.play();
}
function setPrimary() {
    const e=own().find(e=>app.selected.has(e.id)&&R.PRODUCER_ROLES.includes(D[e.type].role));
    if(!e){toast('先选兵营、战车工厂、机场或船坞',true);return;}
    command({type:'primary',id:e.id});toast(D[e.type].name+'已设为主生产建筑');
}
function beginPlan(held=false,code='KeyZ') {
    if(app.plan)return;
    const units=own().filter(e=>app.selected.has(e.id));
    const buildings=units.length&&units.every(e=>R.PRODUCER_ROLES.includes(D[e.type].role));
    const ids=units.filter(e=>D[e.type].kind!=='building'||buildings).map(e=>e.id);
    if(!ids.length){toast('先选部队或生产建筑，再规划路径',true);return;}
    if(app.cursor?.type==='place')setCursor(null);
    app.plan={ids,orders:[],held,code,buildings,append:false};updatePlanUI();
}
function cancelPlan() {
    app.plan=null;
    if($('route-panel'))$('route-panel').classList.add('hidden');
    if($('waypoint-tool'))$('waypoint-tool').classList.remove('active');
}
function finishPlan() {
    const p=app.plan;if(!p)return;
    if(p.orders.length) {
        if(p.buildings)for(const id of p.ids)p.orders.forEach((o,i)=>command({type:'rally',id,x:o.x,z:o.z,append:i>0||p.append}));
        else command({type:'plan',ids:p.ids,orders:p.orders,append:p.append});
        const last=p.orders.at(-1);app.commandMarker={x:last.x,z:last.z,time:performance.now(),type:'plan'};
        toast((p.buildings?'集结路线':'部队路线')+'已下达 · '+p.orders.length+'个节点');
    }
    cancelPlan();setCursor(null);
}
function issueOrder(o,append=false) {
    if(app.plan){if(app.plan.orders.length>=64){toast('最多64个路径节点',true);return;}
        if(!app.plan.orders.length)app.plan.append=append;
        app.plan.orders.push({...o});updatePlanUI();app.sound.play();return;}
    command({...o,ids:[...app.selected],append});
    app.commandMarker={x:o.x,z:o.z,time:performance.now(),type:o.type};app.sound.play();
}
function updatePlanUI() {
    const p=app.plan;$('route-panel').classList.toggle('hidden',!p);$('waypoint-tool').classList.toggle('active',!!p);if(!p)return;
    $('route-title').textContent=p.buildings?'集结路线规划':'部队路径规划';$('route-count').textContent=p.orders.length+' / 64';
    $('route-description').textContent=p.held?'左键逐个放点，松开 '+displayKey(p.code)+' 执行':'左键逐个放点 · Enter执行 · 右键取消';
}
function keyToken(e){return(e.ctrlKey?'Ctrl+':'')+(e.altKey?'Alt+':'')+(e.shiftKey?'Shift+':'')+e.code;}
function displayKey(key){return String(key).replaceAll('Key','').replaceAll('Digit','').replace('Space','空格');}
function saveKeyBindings(){try{localStorage.setItem('ra3d-hotkeys-v3',JSON.stringify(app.hotkeys));}catch{}}
function updateHotkeyLabels() {
    const key=a=>displayKey(app.hotkeys[a]);
    $('camera-focus').title=key('focusSelection')+'：定位所选单位';
    $('camera-zoom').title=key('resetZoom')+'：恢复默认缩放';
    document.querySelectorAll('[data-command]').forEach(b=>{const t=b.querySelector('small');if(t)t.textContent=key(b.dataset.command);});
    $('waypoint-tool').querySelector('small').textContent=key('waypoints');
    for(const [a,label] of [['repair','⚒ 维修'],['sell','$ 出售'],['rally','⚑ 集结']])$(a+'-tool').textContent=label+' '+key(a);
    for(const [tab,action] of Object.entries({building:'buildings',defense:'defenses',infantry:'infantry',vehicle:'vehicles'})) {
        const b=document.querySelector('[data-tab="'+tab+'"]');b.title=key(action)+' '+R.HOTKEY_NAMES[action];
        let badge=b.querySelector('.tab-key');if(!badge){badge=document.createElement('small');badge.className='tab-key';b.appendChild(badge);}badge.textContent=key(action);
    }
}
function renderHotkeys() {
    updateHotkeyLabels();
    $('hotkey-list').innerHTML='';
    for(const [action,label] of Object.entries(R.HOTKEY_NAMES)) {
        const row=document.createElement('div');row.className='hotkey-row';const span=document.createElement('span');span.textContent=label;
        const button=document.createElement('button');button.textContent=displayKey(app.hotkeys[action]);button.dataset.action=action;
        button.classList.toggle('listening',app.rebinding===action);
        button.onclick=()=>{app.rebinding=action;renderHotkeys();$('binding-status').textContent='正在绑定「'+label+'」：请按新键，Esc取消。';};
        row.append(span,button);$('hotkey-list').appendChild(row);
    }
}
function rebind(e) {
    e.preventDefault();if(e.code==='Escape'){app.rebinding=null;renderHotkeys();return;}
    if(['ControlLeft','ControlRight','AltLeft','AltRight','ShiftLeft','ShiftRight','MetaLeft','MetaRight'].includes(e.code))return;
    const token=keyToken(e);
    if(e.metaKey||['F1','Tab','Space','Backspace','Enter'].includes(e.code)||e.code.startsWith('Arrow')||/^Digit/.test(e.code)||['Ctrl+KeyS','Ctrl+KeyR','Ctrl+KeyW','Ctrl+KeyT','Ctrl+KeyN','Ctrl+KeyL','Alt+Enter','Alt+F4'].includes(token)) {
        $('binding-status').textContent='这是保留组合，请使用其他键。';return;
    }
    const duplicate=Object.entries(app.hotkeys).find(([a,k])=>a!==app.rebinding&&k===token);
    if(duplicate){$('binding-status').textContent='这个键已经用于「'+R.HOTKEY_NAMES[duplicate[0]]+'」，请换一个。';return;}
    app.hotkeys[app.rebinding]=token;app.rebinding=null;saveKeyBindings();renderHotkeys();$('binding-status').textContent='键位已保存。';
}
function runHotkey(action,e={}) {
    if(action==='focusSelection')return focusSelection();
    if(action==='resetZoom')return app.camera.resetZoom();
    const categories={buildings:'building',defenses:'defense',infantry:'infantry',vehicles:'vehicle'};
    if(categories[action])return selectCategory(categories[action]);
    if(['base','yard','barracks','factory','airfield','naval','tech'].includes(action))return selectBuilding(['base','yard'].includes(action)?'hq':action);
    if(['stop','deploy','unload','scatter','guard'].includes(action)){if(action==='stop')cancelPlan();command({type:action,ids:[...app.selected]});return;}
    if(['move','attackMove','patrol','repair','sell','rally'].includes(action)){setCursor(app.cursor?.type===action?null:{type:action});return;}
    if(action==='waypoints'){beginPlan(true,e.code||'KeyZ');return;}
    if(action==='primary')return setPrimary();
    if(action==='same'){const now=performance.now(),all=now-(app.lastSameTime||0)<380;app.lastSameTime=now;selectSame(all);return;}
    if(action==='combatUnits'){app.selected=new Set(own().filter(e=>D[e.type].kind!=='building'&&(D[e.type].damage||D[e.type].control)&&D[e.type].ability!=='miner'&&onScreen(e)).map(e=>e.id));selectionUI();return;}
    if(['grid','health','orders'].includes(action)) {
        const key={grid:'showGrid',health:'showHealth',orders:'showOrders'}[action];app[key]=!app[key];
        $({grid:'show-grid',health:'show-health',orders:'show-orders'}[action]).checked=app[key];
    }
}
function updateOperationalUI() {
    if(!app.state)return;
    const mode=app.state.cfg.fogMode||'single';$('fog-badge').textContent=mode==='double'?'双层迷雾':mode==='none'?'无迷雾':'单层迷雾';
    $('fog-badge').title=R.FOG_MODES[mode];$('ingame-fog').value=mode;
    const e=own().find(e=>app.selected.has(e.id));if(!e)return;
    if(D[e.type].kind==='building') {
        const [w,h]=D[e.type].footprint,primary=app.state.p.primary?.[D[e.type].role]===e.id;
        $('selection-extra').textContent=`${w}×${h}格${e.repairing?' · 维修中':''}${primary?' · ★ 主生产':''}${R.PRODUCER_ROLES.includes(D[e.type].role)?' · K设主厂 / L集结':''}`;
    } else if(e.orderQueue?.length||e.order?.type==='patrol'||e.order?.type==='guard') {
        $('selection-extra').textContent=(e.order?.type==='patrol'?'往返巡逻':e.order?.type==='guard'?'驻守警戒':'执行命令')+' · 待执行 '+(e.orderQueue?.length||0)+' · S取消';
    }
}
function updateOperationalOverlay() {
    const r=app.renderer;if(!r)return;r.showGrid=app.playing&&app.showGrid;r.showHealth=app.playing&&app.showHealth;r.showOrders=app.playing&&app.showOrders;
    r.plan=app.plan;r.commandMarker=app.commandMarker;
    $('context-hint').classList.toggle('hidden',!app.playing||!app.mouse||app.paused||!!app.cursor||!!app.plan||app.camera?.dragging);
    if(!app.playing)return;
    const alt=app.keys.has('AltLeft')||app.keys.has('AltRight'),ctrl=app.keys.has('ControlLeft')||app.keys.has('ControlRight');
    const hit=app.state?.entities.find(e=>e.id===app.hover),d=hit&&D[hit.type];
    const text=alt?'强制移动 / 碾压 · 点击敌军所在位置':ctrl?'强制攻击 · 可攻击地面及友军':hit?`${d.name} · ${hit.owner===app.state.player?'己方':hit.owner<0?'中立':'敌方'}${d.kind==='building'?' · 方格占地 '+d.footprint.join('×'):''}`:'按住右键拖图 · Z 规划路径 · Alt 强制移动 / 碾压';
    if($('context-hint').textContent!==text)$('context-hint').textContent=text;
    $('world').style.cursor=app.camera?.dragging?'grabbing':app.cursor||app.plan||alt||ctrl?'crosshair':hit?'pointer':'default';
}

// Camera preferences belong to the local client, never to room/game rules.
const VIEW_STORAGE='ra3d-view-v4';
function saveViewPreferences() {
    let saved=true;
    try { localStorage.setItem(VIEW_STORAGE,JSON.stringify(app.camera.prefs)); }
    catch { saved=false; }
    $('camera-storage-status').textContent=saved?'设置已保存在此浏览器；不修改战斗规则。':'此环境不允许本地存储，设置仅在本次打开期间有效。';
}
function applyViewPreferences(patch={},persist=true) {
    app.resetPointer?.();
    const p=app.camera.configure(patch);
    app.edge=p.edgeScroll;app.controls=p.controls;
    $('controls').value=p.controls;$('ingame-controls').value=p.controls;
    $('edge-scroll').checked=p.edgeScroll;
    $('quality').value=p.quality;if(app.renderer.quality!==p.quality)app.renderer.setQuality(p.quality);
    $('volume').value=p.volume;app.sound.set(p.volume);
    for(const el of document.querySelectorAll('[data-camera-pref]')) {
        const value=p[el.dataset.cameraPref];
        if(el.type==='checkbox')el.checked=value;else el.value=value;
        const output=$('value-'+el.dataset.cameraPref);
        if(output)output.textContent=el.dataset.unit==='ms'?value+' ms':el.dataset.unit==='px'?value+' px':el.dataset.unit==='pps'?value+' px/s':Number(value).toFixed(2)+'×';
    }
    if(app.playing){app.guide=p.showTips;$('hint').classList.toggle('hidden',!p.showTips);}
    if(persist)saveViewPreferences();
}
function openCameraOptions() {
    app.cameraReturnToPause=app.playing&&app.paused;
    if(app.playing)pause(true);
    $('pause-modal').classList.add('hidden');
    app.keys.clear();app.resetPointer?.();
    $('camera-modal').classList.remove('hidden');
}
function closeCameraOptions() {
    $('camera-modal').classList.add('hidden');
    if(app.playing)pause(!!app.cameraReturnToPause);
}
async function toggleFullscreen() {
    app.resetPointer?.();
    try {
        if(document.fullscreenElement)await document.exitFullscreen();
        else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();
        else throw new Error('Fullscreen API unavailable');
    } catch {
        const msg='浏览器未允许全屏，请直接使用浏览器 F11，或桌面窗口启动器。';
        if(app.playing)toast(msg,true);$('camera-storage-status').textContent=msg;
    }
}
function focusSelection() {
    const list=app.state?.entities.filter(e=>app.selected.has(e.id)&&!e.ghost)||[];
    if(!list.length){toast('先选中单位，再定位镜头',true);return;}
    app.camera.focus({x:list.reduce((v,e)=>v+e.x,0)/list.length,z:list.reduce((v,e)=>v+e.z,0)/list.length});
}
function updateCameraIndicator() {
    const g=app.camera.gesture,active=app.playing&&!app.paused&&!!g?.active&&!anyModal();
    $('pan-state').classList.toggle('hidden',!active);$('pan-origin').classList.toggle('hidden',!active);
    if(active){
        const scroll=g.button===2&&app.camera.prefs.panMode==='scroll';
        $('pan-state').textContent=scroll?'持续滚屏 · 偏移越远越快 · 松手即停':(g.button===2?'右键':'中键')+'拖图 · 松手即停，不下达单位命令';
        const rect=$('world').getBoundingClientRect();
        $('pan-origin').style.left=(rect.left+g.x)+'px';$('pan-origin').style.top=(rect.top+g.y)+'px';
        $('pan-origin').textContent=scroll?'↔':'✥';
    }
    $('camera-zoom').textContent=Math.round(35/app.renderer.zoom*100)+'%';
}
function initCameraUX() {
    let saved={};try{saved=JSON.parse(localStorage.getItem(VIEW_STORAGE)||'{}');}catch{}
    app.camera=new R.CameraController(app.renderer,saved);
    applyViewPreferences({},false);
    for(const el of document.querySelectorAll('[data-camera-pref]'))el.addEventListener(el.type==='range'?'input':'change',()=>{
        const value=el.type==='checkbox'?el.checked:el.type==='range'?+el.value:el.value;
        applyViewPreferences({[el.dataset.cameraPref]:value});
    });
    for(const id of ['menu-camera','camera-options','camera-settings-open'])$(id).onclick=openCameraOptions;
    $('camera-close').onclick=closeCameraOptions;
    $('camera-reset-prefs').onclick=()=>applyViewPreferences(R.CAMERA_DEFAULTS);
    $('camera-preset-grab').onclick=()=>applyViewPreferences({rightDrag:true,panMode:'grab',dragSensitivity:1,invertDrag:false,edgeScroll:true,scrollSpeed:680,holdMs:160});
    $('camera-preset-scroll').onclick=()=>applyViewPreferences({rightDrag:true,panMode:'scroll',edgeScroll:false,scrollSpeed:800,holdMs:160});
    $('camera-preset-trackpad').onclick=()=>applyViewPreferences({rightDrag:true,panMode:'grab',edgeScroll:false,zoomSensitivity:.65,holdMs:200});
    for(const id of ['fullscreen-btn','menu-fullscreen','camera-fullscreen'])$(id).onclick=toggleFullscreen;
    $('camera-focus').onclick=focusSelection;
    $('camera-zoom').onclick=()=>app.camera.resetZoom();
    $('zoom-in').onclick=()=>app.camera.zoomBy(-100,null);
    $('zoom-out').onclick=()=>app.camera.zoomBy(100,null);
    $('edge-scroll').onchange=()=>applyViewPreferences({edgeScroll:$('edge-scroll').checked});
    $('ingame-controls').onchange=()=>applyViewPreferences({controls:$('ingame-controls').value});
    $('controls').onchange=()=>applyViewPreferences({controls:$('controls').value});
    $('quality').onchange=()=>applyViewPreferences({quality:$('quality').value});
    $('volume').oninput=()=>applyViewPreferences({volume:+$('volume').value});
    $('hint-close').onclick=()=>applyViewPreferences({showTips:false});
    document.addEventListener('fullscreenchange',()=>{
        app.resetPointer?.();app.keys.clear();app.renderer.resize();
        const active=!!document.fullscreenElement;
        $('fullscreen-btn').textContent=active?'退出全屏':'⛶ 全屏';
        $('camera-fullscreen').textContent=active?'退出全屏':'进入全屏';
    });
    window.addEventListener('resize',()=>{app.resetPointer?.();app.renderer.resize();});
    app.applyViewPreferences=applyViewPreferences;app.focusSelection=focusSelection;
}

function anyModal(){return !!document.querySelector('.modal:not(.hidden)');}
function bindInputs() {
    app.hotkeys={...R.DEFAULT_HOTKEYS};app.showGrid=false;app.showHealth=false;app.showOrders=true;app.plan=null;app.pendingPlace=false;
    app.lastKeyTimes={};
    try{const saved=JSON.parse(localStorage.getItem('ra3d-hotkeys-v3')||'{}');for(const a of Object.keys(app.hotkeys))if(typeof saved[a]==='string'&&saved[a].length<40)app.hotkeys[a]=saved[a];}catch{}
    updateHotkeyLabels();
    $('ingame-fog').onchange=()=>{command({type:'fogMode',mode:$('ingame-fog').value});app.renderer.lastFogTick=-1;};
    $('show-grid').onchange=()=>app.showGrid=$('show-grid').checked;
    $('show-health').onchange=()=>app.showHealth=$('show-health').checked;
    $('show-orders').onchange=()=>app.showOrders=$('show-orders').checked;
    $('hotkeys-open').onclick=()=>{app.rebinding=null;renderHotkeys();$('hotkeys-modal').classList.remove('hidden');};
    $('hotkeys-reset').onclick=()=>{app.hotkeys={...R.DEFAULT_HOTKEYS};app.rebinding=null;saveKeyBindings();renderHotkeys();};
    $('route-confirm').onclick=finishPlan;$('route-cancel').onclick=cancelPlan;
    $('route-undo').onclick=()=>{app.plan?.orders.pop();updatePlanUI();};
    $('waypoint-tool').onclick=()=>app.plan?finishPlan():beginPlan(false);
    $('queue-pause').onclick=()=>command({type:'pauseQueue',category:app.tab});
    $('queue-cancel').onclick=()=>{const q=app.state.p.queues[app.tab];if(q?.[0])command({type:'cancel',category:app.tab,unit:q[0].type});};
    document.querySelectorAll('[data-command]').forEach(b=>b.onclick=()=>runHotkey(b.dataset.command));
    const canvas=$('world'),mini=$('minimap');let miniDrag=false;
    const pos=e=>{const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
    const inside=p=>p.x>=0&&p.y>=0&&p.x<=canvas.clientWidth&&p.y<=canvas.clientHeight;
    const inputOK=()=>app.playing&&!!app.state&&!app.paused&&!anyModal()&&!document.hidden;
    function resetPointer() {
        const id=app.drag?.pointerId;
        app.drag=null;app.mouse=null;app.hover=null;miniDrag=false;app.camera.cancel();
        if(id!==undefined&&canvas.hasPointerCapture?.(id)){try{canvas.releasePointerCapture(id);}catch{}}
    }
    app.resetPointer=resetPointer;
    canvas.oncontextmenu=e=>e.preventDefault();
    canvas.addEventListener('pointerdown',e=>{
        if(!inputOK()||![0,1,2].includes(e.button)||app.drag)return;
        const expected=e.button===0?1:e.button===1?4:2;
        if(e.buttons!==expected)return;
        // A select/range clicked in a HUD must not keep swallowing arrow keys.
        if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
        app.sound.init();const p=pos(e);
        app.renderer.syncCamera();
        app.camera.begin(e.button,p,performance.now());
        app.mouse=p;
        app.drag={x:p.x,y:p.y,lastX:p.x,lastY:p.y,button:e.button,pointerId:e.pointerId,shift:e.shiftKey,ctrl:e.ctrlKey,alt:e.altKey,moved:false};
        try{canvas.setPointerCapture(e.pointerId);}catch{}
        e.preventDefault();
    });
    canvas.addEventListener('pointermove',e=>{
        if(!inputOK()){resetPointer();return;}
        const p=pos(e);app.mouse=p;
        const d=app.drag;
        if(d){
            if(e.pointerId!==d.pointerId)return;
            const expected=d.button===0?1:d.button===1?4:2;
            if(e.buttons!==expected){resetPointer();return;}
            if(Math.hypot(p.x-d.x,p.y-d.y)>6)d.moved=true;
            app.camera.move(p,performance.now());
            d.lastX=p.x;d.lastY=p.y;app.hover=null;
        }else app.hover=app.renderer.pick(p.x,p.y)?.id||null;
    });
    canvas.addEventListener('pointerup',e=>{
        const d=app.drag;
        if(!d||e.pointerId!==d.pointerId)return;
        const p=pos(e),g=app.camera.end(p,performance.now());
        app.drag=null;
        if(canvas.hasPointerCapture?.(e.pointerId)){try{canvas.releasePointerCapture(e.pointerId);}catch{}}
        // Releasing over UI, losing focus or changing buttons must not click through.
        app.mouse=inside(p)?p:null;
        if(!inputOK()||e.button!==d.button||e.buttons!==0||!inside(p))return;
        if(g?.active||d.button===1)return;
        if(Math.hypot(p.x-d.x,p.y-d.y)>6)d.moved=true;
        if(d.moved&&d.button===0&&!app.cursor&&!app.plan){
            if(!d.shift)app.selected.clear();
            for(const o of app.renderer.projections)if(o.e.owner===app.state.player&&!o.e.ghost&&D[o.e.type].kind!=='building'&&o.ground.x>=Math.min(d.x,p.x)&&o.ground.x<=Math.max(d.x,p.x)&&o.ground.y>=Math.min(d.y,p.y)&&o.ground.y<=Math.max(d.y,p.y))app.selected.add(o.id);
            selectionUI();app.sound.play();
        }else if(!d.moved)clickWorld(d.button,p,d.shift,d.ctrl,d.alt);
    });
    canvas.addEventListener('dblclick',e=>{
        if(!inputOK()||app.cursor||app.plan||e.button!==0)return;
        const p=pos(e),hit=app.renderer.pick(p.x,p.y);if(!hit||hit.owner!==app.state.player)return;
        if(R.PRODUCER_ROLES.includes(D[hit.type].role)){app.selected=new Set([hit.id]);setPrimary();}
        else if(D[hit.type].kind!=='building')selectSame(false,hit);
    });
    canvas.addEventListener('pointercancel',resetPointer);
    canvas.addEventListener('lostpointercapture',e=>{if(app.drag?.pointerId===e.pointerId)resetPointer();});
    canvas.addEventListener('pointerleave',()=>{if(!app.drag){app.mouse=null;app.hover=null;app.camera.stopMotion();}});
    canvas.addEventListener('wheel',e=>{
        if(!inputOK())return;
        e.preventDefault();
        if(app.drag)return;
        app.camera.zoomBy(R.wheelPixels(e,app.renderer.height),pos(e));
    },{passive:false});
    const radarOK=()=>app.playing&&!app.paused&&!anyModal()&&(app.state.cfg.sandbox||has('radar')&&app.state.p.power>=app.state.p.drain);
    const miniPoint=e=>{const r=mini.getBoundingClientRect();return{x:clamp((e.clientX-r.left)/r.width*192,1,191),z:clamp((e.clientY-r.top)/r.height*192,1,191)};};
    mini.addEventListener('pointerdown',e=>{
        e.preventDefault();if(!radarOK())return;mini.setPointerCapture(e.pointerId);const w=miniPoint(e);
        if(app.cursor?.type==='place'||app.cursor?.type==='sandboxSpawn'){toast('请在主战场放置',true);return;}
        if(app.cursor?.type==='super'){command({type:'super',ability:app.cursor.ability,ids:[...app.selected],...w});setCursor(null);return;}
        if(app.plan||['move','attackMove','forceMove','forceAttack','patrol','rally'].includes(app.cursor?.type)||e.button===2) {
            const type=e.altKey?'forceMove':e.ctrlKey&&e.shiftKey?'attackMove':e.ctrlKey?'forceAttack':app.cursor?.type||'move';
            if(type==='rally'||own().filter(e=>app.selected.has(e.id)).every(e=>D[e.type].kind==='building')&&!app.plan)setRally(w,e.shiftKey);
            else issueOrder({type,...w},e.shiftKey&&!e.ctrlKey);
            if(!app.plan&&!e.shiftKey)setCursor(null);
        } else if(e.button===0){app.camera.focus(w);app.mouse=null;miniDrag=true;}
    });
    mini.addEventListener('pointermove',e=>{if(miniDrag&&radarOK())app.camera.focus(miniPoint(e));});
    mini.addEventListener('pointerup',()=>miniDrag=false);mini.addEventListener('pointercancel',()=>miniDrag=false);mini.addEventListener('lostpointercapture',()=>miniDrag=false);mini.oncontextmenu=e=>e.preventDefault();
    window.addEventListener('keydown',e=>{
        if(app.rebinding&&!$('hotkeys-modal').classList.contains('hidden')){rebind(e);return;}
        if(e.isComposing||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||e.target.isContentEditable)return;
        if(e.altKey&&e.code==='Enter'){e.preventDefault();if(!e.repeat)toggleFullscreen();return;}
        if(e.code==='F1'){e.preventDefault();if(!e.repeat)$('help-modal').classList.toggle('hidden');app.keys.clear();return;}
        if(!app.playing&&e.code==='Escape'&&!$('camera-modal').classList.contains('hidden')){e.preventDefault();closeCameraOptions();return;}
        if(!app.playing){if(e.code==='Escape'){const top=[...document.querySelectorAll('.modal:not(.hidden)')].at(-1);if(top){e.preventDefault();top.classList.add('hidden');app.rebinding=null;}}return;}
        if(e.code==='Escape') {
            e.preventDefault();if(e.repeat)return;
            if(!$('camera-modal').classList.contains('hidden')){closeCameraOptions();return;}
            if(app.drag){app.resetPointer();return;}
            for(const id of ['details-modal','about-modal','chat-modal','alerts-modal','hotkeys-modal','catalog-modal','help-modal'])if($(id)&&!$(id).classList.contains('hidden')){$(id).classList.add('hidden');app.rebinding=null;return;}
            if(app.plan)cancelPlan();else if(app.cursor)setCursor(null);else pause(!app.paused);return;
        }
        if(app.paused||anyModal())return;
        app.keys.add(e.code);if(e.code.startsWith('Arrow')||e.code.startsWith('Alt')||e.code==='Space')e.preventDefault();
        if(e.repeat){if(app.hotkeys&&Object.values(app.hotkeys).includes(keyToken(e)))e.preventDefault();return;}
        if(e.ctrlKey&&e.code==='KeyS'){e.preventDefault();save('quick');return;}
        if(app.plan&&e.code==='Enter'){e.preventDefault();finishPlan();return;}
        if(app.plan&&e.code==='Backspace'){e.preventDefault();app.plan.orders.pop();updatePlanUI();return;}
        if(/^Digit[0-9]$/.test(e.code)) {
            e.preventDefault();const n=e.code.slice(-1);
            if(e.altKey&&!e.ctrlKey){const list=[...$('build-grid').children],index=n==='0'?9:+n-1;if(list[index])activateCard(D[list[index].dataset.unit],e.shiftKey);return;}
            const valid=ids=>(ids||[]).filter(id=>own().some(o=>o.id===id));
            if(e.ctrlKey){app.groups[n]=[...new Set([...(e.shiftKey?valid(app.groups[n]):[]),...valid([...app.selected])])];toast('编队 '+n+' · '+app.groups[n].length+'个单位');}
            else if(app.groups[n]) {
                const group=valid(app.groups[n]);app.groups[n]=group;
                app.selected=new Set([...(e.shiftKey?valid([...app.selected]):[]),...group]);
                const now=performance.now();if(now-(app.lastKeyTimes[n]||0)<360){const units=own().filter(o=>app.selected.has(o.id));if(units.length)app.camera.focus({x:units.reduce((v,o)=>v+o.x,0)/units.length,z:units.reduce((v,o)=>v+o.z,0)/units.length});}
                app.lastKeyTimes[n]=now;selectionUI();
            }return;
        }
        if(e.code==='Space'){if(app.lastAlert)app.camera.focus(app.lastAlert);return;}
        if(e.code==='Tab'){e.preventDefault();const list=['building','defense','infantry','vehicle'];setTab(list[(list.indexOf(app.tab)+1)%4]);return;}
        const action=Object.keys(app.hotkeys).find(a=>app.hotkeys[a]===keyToken(e));
        if(action){e.preventDefault();runHotkey(action,e);}
    });
    window.addEventListener('keyup',e=>{app.keys.delete(e.code);if(app.playing&&e.code.startsWith('Alt'))e.preventDefault();if(app.plan?.held&&app.plan.code===e.code){if(app.paused||anyModal()||document.hidden)cancelPlan();else finishPlan();}});
    window.addEventListener('blur',()=>{app.keys.clear();resetPointer();if(app.plan)cancelPlan();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){app.keys.clear();resetPointer();if(app.plan)cancelPlan();}});
}

function init(){try{for(const n of R.NATIONS)$('nation').add(new Option(n.name+' · '+R.FACTIONS[n.faction].name,n.id));for(const m of R.MAPS)$('map').add(new Option(m.name+' / '+m.en,m.id));for(const d of R.defs())$('sandbox-unit').add(new Option((R.FACTIONS[d.faction]?.name||'中立')+' · '+d.name,d.id));for(let i=0;i<8;i++)$('sandbox-owner').add(new Option(i===0?'己方':'电脑 '+i,i));$('sandbox-unit').value='apocalypse';$('server-url').value=location.protocol==='http:'||location.protocol==='https:'?`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}`:'ws://127.0.0.1:8787';nationInfo();
 app.renderer=new R.Renderer($('world'),$('overlay'));const demo=new R.Sim({players:2,startBase:true,credits:30000,map:'coast'});demo.spawn('a_factory',0,47,143);demo.spawn('a_airfield',0,32,137);demo.spawn('a_prism',0,24,140);demo.spawn('a_tech',0,45,157);demo.spawn('harrier',0,56,142);demo.spawn('prism_tank',0,50,135);demo.spawn('grizzly',0,53,151);demo.reindex();demo.updateFog();menuState=demo.snapshot(0);menuState.fog.fill(2);menuState.entities=demo.entities;menuState.time=4;app.renderer.target={x:48,z:144};
 $('launch').onclick=startLocal;$('nation').onchange=nationInfo;document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>mode(b.dataset.mode));document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));$('hint-close').onclick=()=>{app.guide=false;$('hint').classList.add('hidden');};$('pause-btn').onclick=()=>pause(true);$('resume').onclick=()=>pause(false);$('quality').onchange=()=>app.renderer.setQuality($('quality').value);$('volume').oninput=()=>app.sound.set(+$('volume').value);$('speed').onchange=()=>app.worker?.postMessage({type:'speed',speed:+$('speed').value});$('edge-scroll').onchange=()=>app.edge=$('edge-scroll').checked;$('ingame-controls').onchange=()=>{app.controls=$('ingame-controls').value;$('controls').value=app.controls;};$('save-quick').onclick=()=>save('quick');$('save-file').onclick=()=>save('file');$('load-quick').onclick=()=>{try{const v=localStorage.getItem('ra3d-save');if(v)loadSave(JSON.parse(v));else toast('此浏览器尚无快速存档',true);}catch(e){toast('存档读取失败',true);}};$('load-file').onclick=()=>$('save-input').click();$('save-input').onchange=async()=>{try{const f=$('save-input').files[0];if(f&&f.size<10000000)loadSave(JSON.parse(await f.text()));else toast('存档过大或无效',true);}catch(e){toast('存档格式错误',true);}$('save-input').value='';};$('quit').onclick=quit;$('result-menu').onclick=quit;
 for(const id of['menu-help','help-btn'])$(id).onclick=()=>$('help-modal').classList.remove('hidden');$('menu-catalog').onclick=()=>{catalog();$('catalog-modal').classList.remove('hidden');};$('catalog-search').oninput=()=>catalog($('catalog-search').value);document.querySelectorAll('.close-modal').forEach(b=>b.onclick=()=>b.closest('.modal').classList.add('hidden'));
 for(const type of['repair','sell','rally'])$(type+'-tool').onclick=()=>setCursor(app.cursor?.type===type?null:{type});document.querySelectorAll('[data-command]').forEach(b=>b.onclick=()=>{const type=b.dataset.command;if(['stop','deploy','unload'].includes(type))command({type,ids:[...app.selected]});else setCursor({type});});$('sandbox-toggle').onclick=()=>{const opened=!$('sandbox-ui').classList.contains('hidden');$('sandbox-ui').classList.toggle('hidden',opened);$('production-ui').style.display=opened?'contents':'none';};document.querySelectorAll('[data-sandbox]').forEach(b=>b.onclick=()=>{command({type:'sandbox',action:b.dataset.sandbox});toast('沙盒指令：'+b.textContent);});$('sandbox-spawn').onclick=()=>setCursor({type:'sandboxSpawn',unit:$('sandbox-unit').value,owner:+$('sandbox-owner').value,count:+$('sandbox-count').value});
 $('host-room').onclick=()=>connect('create');$('join-room').onclick=()=>connect('join');$('ready-room').onclick=()=>app.net?.ws.send(JSON.stringify({type:'ready'}));$('start-room').onclick=()=>app.net?.ws.send(JSON.stringify({type:'start'}));$('leave-room').onclick=disconnect;
 initCameraUX();
 bindInputs();
 app.command=command;app.startLocal=startLocal;app.quit=quit;app.save=save;app.loadSave=loadSave;app.setCursor=setCursor;app.setTab=setTab;app.icon=icon;app.setMode=mode;app.config=config;app.pause=pause;app.beginPlan=beginPlan;app.finishPlan=finishPlan;app.cancelPlan=cancelPlan;app.issueOrder=issueOrder;app.placement=placement;app.clickWorld=clickWorld;app.selectBuilding=selectBuilding;app.runHotkey=runHotkey;app.receiveState=receiveState;app.createWorker=createWorker;app.beginView=beginView;app.connect=connect;app.disconnect=disconnect;app.catalog=catalog;app.toast=toast;app.download=download;app.own=own;app.selectionUI=selectionUI;app.showResult=showResult;app.networkMessage=networkMessage;R.initHeadquarters?.();R.initRelease?.();
 $('loading').classList.add('hidden');requestAnimationFrame(frame);
 }catch(e){console.error(e);$('loading').innerHTML='<div id="fatal"><strong>启动遇到问题</strong><br>'+esc(e.message)+'<br>请在桌面版 Chrome 或 Edge 打开，开启硬件加速后重试。<br>详细信息：'+esc(e.stack||'')+'</div>';}}
function frame(now) {
    const dt=clamp((now-lastFrame)/1000,.001,.1);lastFrame=now;
    try {
        const state=app.playing?app.state:menuState;
        if(state) {
            app.renderer.resize();
            if(!app.playing){menuState.time+=dt;menuState.tick++;app.renderer.yaw=Math.PI/4+Math.sin(now*.00004)*.07;}
            else {
                app.renderer.yaw=Math.PI/4;
                const allowed=!app.paused&&!anyModal()&&!document.hidden;
                if(!allowed&&app.drag)app.resetPointer?.();
                app.camera.update(dt,now,{allowed,keys:app.keys,mouse:app.mouse,edgeEnabled:app.edge,fullscreen:!!document.fullscreenElement});
            }
            app.renderer.syncCamera();updateOperationalOverlay();updateCameraIndicator();
            let rect=null;
            if(app.drag?.moved&&app.drag.button===0&&!app.cursor&&app.mouse)rect={x:Math.min(app.drag.x,app.mouse.x),y:Math.min(app.drag.y,app.mouse.y),w:Math.abs(app.drag.x-app.mouse.x),h:Math.abs(app.drag.y-app.mouse.y)};
            app.renderer.render(state,dt,app.playing?app.selected:new Set(),app.hover,placement(),rect);
            if(now-lastMinimap>160&&app.playing){drawMinimap();app.drawMissionMinimap?.();$('performance').textContent=Math.round(app.renderer.fps)+' FPS · '+state.entities.filter(e=>!e.ghost).length+' VIS';lastMinimap=now;}
        }
    }catch(e){console.error('Frame',e);if(!app.frameError){app.frameError=e.message;toast('渲染异常：'+e.message,true);}}
    requestAnimationFrame(frame);
}
init();
})(globalThis);
