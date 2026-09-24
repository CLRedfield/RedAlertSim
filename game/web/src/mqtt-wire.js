/* Bounded MQTT 3.1.1 transport over the browser's native WebSocket implementation.
 * Only QoS 0/1, clean sessions and WSS are used by the game. No CDN or npm runtime.
 * Protocol reference: OASIS MQTT 3.1.1, sections 2, 3.1, 3.3, 3.8 and 3.12.
 * WebSocket framing/TLS are provided by the browser, never implemented here. */
(function(G){'use strict';const R=G.RA||(G.RA={}),utf=new TextEncoder(),text=new TextDecoder('utf-8',{fatal:true});
const join=(...parts)=>{const a=new Uint8Array(parts.reduce((s,b)=>s+b.length,0));let o=0;for(const p of parts){a.set(p,o);o+=p.length;}return a;};
const u16=n=>new Uint8Array([n>>8,n&255]);
const str=s=>{const b=utf.encode(s);if(b.length>65535||s.includes('\0'))throw Error('MQTT 字符串超出范围');return join(u16(b.length),b);};
const packet=(header,body=new Uint8Array())=>{let n=body.length,len=[];do{let v=n%128;n=Math.floor(n/128);if(n)v|=128;len.push(v);}while(n);return join(new Uint8Array([header,...len]),body);};
class Parser{
 constructor(emit,max=262144){this.emit=emit;this.max=max;this.buffer=new Uint8Array();}
 push(bytes){if(!(bytes instanceof Uint8Array))bytes=new Uint8Array(bytes);if(this.buffer.length+bytes.length>this.max*2)throw Error('MQTT 接收缓存超限');this.buffer=join(this.buffer,bytes);let offset=0;
 while(this.buffer.length-offset>=2){let pos=offset+1,len=0,mul=1,count=0,done=false;while(pos<this.buffer.length&&count<4){const v=this.buffer[pos++];len+=(v&127)*mul;mul*=128;count++;if(!(v&128)){done=true;break;}}if(!done){if(count===4)throw Error('MQTT 长度字段无效');break;}if(len>this.max)throw Error('MQTT 消息过大');if(pos+len>this.buffer.length)break;this.emit(this.buffer[offset],this.buffer.slice(pos,pos+len));offset=pos+len;}
 if(offset)this.buffer=this.buffer.slice(offset);
 }
}
R.MQTTCodec={join,u16,str,packet,Parser};
R.MQTTWire=class{
 constructor(url,options={}){this.url=url;this.options=options;this.connected=false;this.id=0;this.pending=new Map();this.bytesIn=0;this.bytesOut=0;this.closed=false;this.generation=0;}
 async connect(){
  const u=new URL(this.url);if(!['ws:','wss:'].includes(u.protocol)||u.username||u.password||u.hash)throw Error('无效的 MQTT WebSocket 地址');
  if(u.protocol==='ws:'&&!['127.0.0.1','localhost','[::1]'].includes(u.hostname))throw Error('公共联机必须使用 wss:// 加密连接');
  this.closed=false;const gen=++this.generation;
  return new Promise((resolve,reject)=>{
   const ws=this.ws=new WebSocket(u.href,'mqtt');ws.binaryType='arraybuffer';let ready=false;
   const fail=e=>{if(!ready){reject(e);ready=true;}this.options.error?.(e);try{ws.close();}catch{}};
   const timeout=setTimeout(()=>fail(Error('节点连接超时：'+u.hostname)),this.options.timeout||7500);
   const parser=new Parser((h,b)=>{try{
    const kind=h>>4;if(kind!==3&&(h&15)!==0)throw Error('MQTT 固定头无效');
    if(kind===2){if(b.length!==2||b[0]&254||b[1]!==0)throw Error('MQTT 拒绝连接：'+b[1]);if(ready)return;ready=true;clearTimeout(timeout);this.connected=true;this.lastReceive=Date.now();resolve(this);return;}
    if(!this.connected)throw Error('MQTT 未确认连接');
    if(kind===3){const qos=(h>>1)&3;if(qos>1||b.length<2)throw Error('不支持的 MQTT 消息质量等级');const len=(b[0]<<8)|b[1];if(len<1||2+len+(qos?2:0)>b.length)throw Error('MQTT 发布报文损坏');const topic=text.decode(b.subarray(2,len+2));let pos=2+len;
     if(qos){const id=(b[pos]<<8)|b[pos+1];if(!id)throw Error('MQTT 标识无效');pos+=2;this.raw(packet(0x40,u16(id)));}
     this.options.message?.(topic,b.subarray(pos),{retained:!!(h&1),duplicate:!!(h&8)});return;
    }
    if(kind===4||kind===9||kind===11){if(b.length<2)throw Error('MQTT 确认报文损坏');const id=(b[0]<<8)|b[1],p=this.pending.get(id);if(!p)return;if(kind===9&&Array.from(b.subarray(2)).some(c=>c===128)){p.reject?.(Error('节点拒绝订阅'));}else p.resolve?.();this.pending.delete(id);return;}
    if(kind===13){if(b.length)throw Error('MQTT 心跳格式错误');return;}
    if(kind===14){ws.close();return;}
    throw Error('节点发送了不支持的 MQTT 报文');
   }catch(e){fail(e);}});
   ws.onopen=()=>{if(gen!==this.generation)return ws.close();const client='ra100'+Array.from(crypto.getRandomValues(new Uint8Array(8)),x=>x.toString(16).padStart(2,'0')).join('');let flags=2,extra=[];
    if(this.options.will){flags|=4|(1<<3)|32;extra=[str(this.options.will.topic),str(this.options.will.payload||'')];}
    this.raw(packet(0x10,join(str('MQTT'),new Uint8Array([4,flags,0,25]),str(client),...extra)));
   };
   ws.onmessage=e=>{if(gen!==this.generation)return;try{this.bytesIn+=e.data.byteLength||0;this.lastReceive=Date.now();parser.push(e.data);}catch(error){fail(error);}};
   ws.onerror=()=>fail(Error('无法连接 MQTT 节点：'+u.hostname));
   ws.onclose=()=>{clearTimeout(timeout);clearInterval(this.clock);if(gen!==this.generation)return;this.connected=false;for(const p of this.pending.values())p.reject?.(Error('连接中断'));this.pending.clear();if(!ready){ready=true;reject(Error('MQTT 连接已关闭'));}this.options.close?.();};
   clearInterval(this.clock);this.clock=setInterval(()=>{
    if(!this.connected)return;const now=Date.now();if(now-(this.lastReceive||now)>42000)return ws.close();if(now-(this.lastPing||0)>10000){this.raw(packet(0xc0));this.lastPing=now;}
    for(const [id,p]of this.pending)if(now-p.at>5000){if(p.retries++>=2){this.pending.delete(id);p.reject?.(Error('MQTT 确认超时'));ws.close();break;}p.at=now;const b=p.packet.slice();if(b[0]>>4===3)b[0]|=8;this.raw(b);}
   },1000);
  });
 }
 raw(bytes){if(this.closed||this.ws?.readyState!==1||this.ws.bufferedAmount>1048576)return false;this.ws.send(bytes);this.bytesOut+=bytes.length;return true;}
 nextId(){if(this.pending.size>=128)throw Error('MQTT 发送积压');do{this.id=this.id%65535+1;}while(this.pending.has(this.id));return this.id;}
 subscribe(topics){if(typeof topics==='string')topics=[topics];if(!this.connected)return Promise.reject(Error('节点尚未连接'));if(!topics.length||topics.length>16)return Promise.reject(Error('订阅数量无效'));const id=this.nextId(),b=packet(0x82,join(u16(id),...topics.flatMap(t=>[str(t),new Uint8Array([1])])));return new Promise((resolve,reject)=>{this.pending.set(id,{packet:b,at:Date.now(),retries:0,resolve,reject});if(!this.raw(b)){this.pending.delete(id);reject(Error('订阅发送失败'));}});}
 publish(topic,payload,qos=0,retained=false){if(!this.connected||this.closed)return false;if(/[+#\0]/.test(topic))throw Error('发布主题无效');if(typeof payload==='string')payload=utf.encode(payload);if(payload.length>245760)return false;let id;if(qos)id=this.nextId();const b=packet(0x30|(qos?2:0)|(retained?1:0),join(str(topic),...(qos?[u16(id)]:[]),payload));if(!this.raw(b))return false;if(qos)this.pending.set(id,{packet:b,at:Date.now(),retries:0});return true;}
 close(){if(this.connected)this.raw(packet(0xe0));this.closed=true;this.connected=false;clearInterval(this.clock);for(const p of this.pending.values())p.reject?.(Error('已断开'));this.pending.clear();try{this.ws?.close();}catch{}}
};
})(globalThis);
