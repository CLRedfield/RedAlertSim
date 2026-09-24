'use strict';
/** Loopback-only MQTT test fixture, NOT a deployment server or a full MQTT broker.
 * Parses MQTT independently of the game's codec. No external service is contacted. */
const {wsServer:WebSocketServer}=require('../../server/vendor/ws.cjs');
const enc=s=>{const b=Buffer.from(s);return Buffer.concat([Buffer.from([b.length>>8,b.length&255]),b]);};
function packet(h,b=Buffer.alloc(0)){let n=b.length,bytes=[];do{let x=n%128;n=Math.floor(n/128);if(n)x|=128;bytes.push(x);}while(n);return Buffer.concat([Buffer.from([h,...bytes]),b]);}
function match(filter,topic){const f=filter.split('/'),t=topic.split('/');return f.every((v,i)=>v==='#'||v==='+'&&i<t.length||v===t[i])&&(f.at(-1)==='#'||f.length===t.length);}
class TestBroker{
 constructor(port=18884){this.port=port;this.clients=new Set();this.retained=new Map();this.messages=[];this.packetId=1;this.server=new WebSocketServer({host:'127.0.0.1',port,maxPayload:1024*1024,perMessageDeflate:false});this.ready=new Promise((resolve,reject)=>{this.server.once('listening',resolve);this.server.once('error',reject);});this.server.on('connection',ws=>{const c={ws,subs:new Set(),buffer:Buffer.alloc(0),clean:false};this.clients.add(c);ws.on('error',()=>{});ws.on('message',(data)=>{try{c.buffer=Buffer.concat([c.buffer,Buffer.from(data)]);while(c.buffer.length>=2){let i=1,n=0,m=1,v;do{if(i>=c.buffer.length)return;v=c.buffer[i++];n+=(v&127)*m;m*=128;if(i>5)throw Error('Malformed MQTT');}while(v&128);if(c.buffer.length<i+n)return;const h=c.buffer[0],body=c.buffer.subarray(i,i+n);c.buffer=c.buffer.subarray(i+n);this.handle(c,h,body);}}catch{ws.close(1002);}});ws.on('close',()=>{this.clients.delete(c);if(c.will&&!c.clean)this.publish(c.will.topic,c.will.payload,true);});});}
 handle(c,h,b){const type=h>>4;const readString=pos=>{const n=b.readUInt16BE(pos);if(pos+2+n>b.length)throw Error('Length');return[b.subarray(pos+2,pos+2+n).toString(),pos+2+n];};
  if(type===1){const [protocol,pos]=readString(0);if(protocol!=='MQTT'||b[pos]!==4)throw Error('Version');let [,end]=readString(pos+4);const flags=b[pos+1];if(flags&4){let topic;[topic,end]=readString(end);let payload;[payload,end]=readString(end);c.will={topic,payload};}c.connected=true;c.ws.send(packet(0x20,Buffer.from([0,0])));return;}
  if(!c.connected)throw Error('CONNECT required');
  if(type===8){let pos=2,topics=[];while(pos<b.length){let topic;[topic,pos]=readString(pos);const qos=b[pos++];if(qos>1)throw Error('QoS');topics.push(topic);c.subs.add(topic);}c.ws.send(packet(0x90,Buffer.from([b[0],b[1],...topics.map(()=>1)])));for(const [topic,payload]of this.retained)if(topics.some(f=>match(f,topic)))this.deliver(c,topic,payload,true);return;}
  if(type===3){let [topic,pos]=readString(0);const qos=(h>>1)&3;if(qos===1){c.ws.send(packet(0x40,b.subarray(pos,pos+2)));pos+=2;}else if(qos>1)throw Error('QoS');this.publish(topic,b.subarray(pos),!!(h&1));return;}
  if(type===4)return;if(type===12){c.ws.send(packet(0xd0));return;}if(type===14){c.clean=true;c.ws.close();return;}throw Error('Unsupported fixture packet');
 }
 publish(topic,payload,retained=false){payload=Buffer.from(payload);this.messages.push({topic,payload:payload.toString(),at:Date.now()});if(this.messages.length>10000)this.messages.shift();if(retained){if(payload.length)this.retained.set(topic,payload);else this.retained.delete(topic);}for(const c of this.clients)if([...c.subs].some(f=>match(f,topic)))this.deliver(c,topic,payload,retained);}
 deliver(c,topic,payload,retained=false){if(c.ws.readyState!==1)return;const id=this.packetId++%65535+1;c.ws.send(packet(0x32|(retained?1:0),Buffer.concat([enc(topic),Buffer.from([id>>8,id&255]),Buffer.from(payload)])));}
 async close(){for(const c of this.clients){c.clean=true;c.ws.terminate();}return new Promise(r=>this.server.close(r));}
}
module.exports={TestBroker,packet,enc,match};
if(require.main===module){const b=new TestBroker(Number(process.argv[2]||18884));b.ready.then(()=>console.log('Loopback test broker ready on '+b.port));process.on('SIGTERM',()=>b.close().then(()=>process.exit()));}
