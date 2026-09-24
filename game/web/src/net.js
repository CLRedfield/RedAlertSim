(function(G){'use strict';const R=G.RA;
R.netIdentity=()=>({protocol:R.PROTOCOL,content:R.CONTENT_HASH,rules:R.RULES_HASH,mapHash:R.MAP_HASH,capabilities:{delta:true}});
R.RoomClient=class {
 constructor(url,action,payload,receive,status){this.url=url;this.action=action;this.payload=payload;this.receive=receive;this.status=status;this.seq=0;this.intentional=false;this.room=null;this.token=null;this.retry=0;this.connected=false;this.baseline=null;this.connect();}
 connect(){
  let u;try{u=new URL(this.url);if(!['ws:','wss:'].includes(u.protocol)||u.username||u.password)throw Error('使用 ws:// 或 wss:// 服务器地址');if(location.protocol==='https:'&&u.protocol!=='wss:')throw Error('HTTPS 页面只能连接 WSS 服务器');}catch(e){this.status(e.message,'error');return;}
  this.status(this.retry?'连接中断，正在恢复席位…':'正在连接房间服务…','connecting');
  const ws=this.ws=new WebSocket(u.href);let openTimer=setTimeout(()=>{if(ws.readyState===0)ws.close();},7000);
  ws.onopen=()=>{clearTimeout(openTimer);if(this.intentional)return ws.close();this.connected=true;this.baseline=null;this.status('已连接，正在校验内容…','connected');this.send({type:'hello'});this.send(this.token?{type:'resume',code:this.room,token:this.token}:{type:this.action,...this.payload});clearInterval(this.heartbeat);this.heartbeat=setInterval(()=>this.send({type:'ping',at:Date.now()}),6000);};
  ws.onmessage=e=>{
   let m;try{m=JSON.parse(e.data);}catch{this.status('收到损坏的网络消息','error');return;}
   if(m.type==='welcome'){this.token=m.token;this.room=m.code;this.player=m.player;this.spectator=!!m.spectator;this.seq=Math.max(this.seq,m.seq||0);this.retry=0;this.disconnectedAt=null;try{sessionStorage.setItem('ra3d-resume',JSON.stringify({url:this.url,code:this.room,token:this.token,seq:this.seq,at:Date.now()}));}catch{}this.status('已连接 · 席位 '+(m.player+1),'connected');}
   if(m.type==='pong'&&this.token)try{sessionStorage.setItem('ra3d-resume',JSON.stringify({url:this.url,code:this.room,token:this.token,seq:this.seq,at:Date.now()}));}catch{}
   if(m.type==='pong'){this.ping=Math.max(0,Date.now()-m.at);this.receive({type:'latency',ping:this.ping},this);return;}
   if(m.type==='state'&&m.id){this.baseline={id:m.id,data:m.data};this.send({type:'ack',id:m.id});}
   if(m.type==='delta'){try{if(!this.baseline||m.base!==this.baseline.id)throw Error('基线不一致');const s=R.Wire.apply(this.baseline.data,m.data);this.baseline={id:m.id,data:s};this.send({type:'ack',id:m.id});m={type:'state',data:s,id:m.id};}catch{this.baseline=null;this.send({type:'resync'});return;}}
   if(m.type==='error'&&/凭证|过期|版本|哈希|房间已结束/.test(m.message)){this.token=null;this.status(m.message,'error');try{sessionStorage.removeItem('ra3d-resume');}catch{}}
   this.receive(m,this);
  };
  ws.onerror=()=>this.status('无法连接。请检查启动器、服务器地址和系统防火墙。','error');
  ws.onclose=()=>{clearTimeout(openTimer);clearInterval(this.heartbeat);this.connected=false;if(this.intentional)return;
   if(this.token){this.disconnectedAt=this.disconnectedAt||Date.now();if(Date.now()-this.disconnectedAt<110000){this.retry++;this.status('网络中断，自动重连 '+this.retry+'；暂时禁止下令','reconnecting');this.timer=setTimeout(()=>this.connect(),Math.min(5000,700*Math.pow(1.6,this.retry)));return;}}
   this.status('连接已关闭。请重新进入房间。','error');
  };
 }
 send(m){if(this.ws?.readyState!==1||this.intentional)return false;this.ws.send(JSON.stringify({...R.netIdentity(),...m}));return true;}
 command(c){if(!this.connected||this.spectator||this.ws?.readyState!==1)return false;return this.send({type:'command',seq:++this.seq,command:c});}
 resume(info){this.token=info.token;this.room=info.code;this.seq=info.seq||0;}
 close(){this.intentional=true;clearTimeout(this.timer);clearInterval(this.heartbeat);this.send({type:'leave'});try{this.ws?.send(JSON.stringify({type:'leave'}));this.ws?.close();}catch{}this.connected=false;try{sessionStorage.removeItem('ra3d-resume');}catch{}}
};
})(globalThis);
