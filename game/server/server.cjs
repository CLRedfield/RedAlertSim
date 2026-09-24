#!/usr/bin/env node
'use strict';
/** Authoritative room service. No account, tracking or external runtime dependencies.
 * LAN by default. For Internet use configure PUBLIC_MODE, ORIGINS and a TLS proxy.
 * This code is not a claim that a public service has been deployed. */
const http=require('node:http'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {wsServer:WebSocketServer}=require('./vendor/ws.cjs');
require('../web/src/data.js');const Sim=require('../web/src/sim.js'),Wire=require('../web/src/wire.js'),R=globalThis.RA;
const args=process.argv.slice(2),option=(k,f)=>{const i=args.indexOf(k);return i>=0?args[i+1]:f;};
const HOST=option('--host',process.env.HOST||'127.0.0.1'),PORT=Number(option('--port',process.env.PORT||8787));
const PUBLIC=process.env.PUBLIC_MODE==='1',ORIGINS=new Set((process.env.ORIGINS||'').split(',').filter(Boolean));
if(PUBLIC&&!ORIGINS.size){console.error('PUBLIC_MODE requires explicit ORIGINS and a TLS reverse proxy.');process.exit(1);}
if(!Number.isInteger(PORT)||PORT<1||PORT>65535)throw Error('Invalid port');
const root=path.resolve(__dirname,'../web');
require('../web/src/authority.js');
const service=new R.RoomService({public:PUBLIC,log:console.log}),{rooms,peers,ips,metrics,limits:LIMITS,publicRooms,handle,send,error,left}=service;
const clean=(v,max=24)=>String(v??'').replace(/[\x00-\x1f\x7f]/g,'').slice(0,max);
const addresses=()=>Object.values(os.networkInterfaces()).flat().filter(n=>n.family==='IPv4'&&!n.internal).map(n=>'http://'+n.address+':'+PORT);
const server=http.createServer((req,res)=>{
 let decoded;try{decoded=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);return res.end('Bad URL');}
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
 const json=value=>{res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
 if(decoded==='/health')return json({ok:true,version:R.VERSION,protocol:R.PROTOCOL,content:R.CONTENT_HASH,rooms:rooms.size,connected:peers.size,uptime:Math.floor(process.uptime())});
 if(decoded==='/api/server')return json({version:R.VERSION,protocol:R.PROTOCOL,content:R.CONTENT_HASH,public:PUBLIC,name:clean(process.env.SERVER_NAME||'私人局域网服务器',48),addresses:PUBLIC?[]:addresses(),limits:{rooms:LIMITS.rooms,resumeSeconds:LIMITS.resumeMs/1000}});
 if(decoded==='/api/rooms')return json({rooms:publicRooms()});
 if(decoded==='/api/metrics'&&!PUBLIC&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))return json(metrics);
 const file=path.resolve(root,'.'+(decoded==='/'?'/index.html':decoded));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end('Forbidden');}
 fs.stat(file,(err,stat)=>{if(err||!stat.isFile()){res.writeHead(404);return res.end('Not found');}const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.json':'application/json'}[path.extname(file)]||'application/octet-stream';res.writeHead(200,{'Content-Type':mime,'Content-Length':stat.size,'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache','Referrer-Policy':'no-referrer','X-Frame-Options':'SAMEORIGIN'});if(req.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res);});
});
server.headersTimeout=10000;server.requestTimeout=15000;server.maxHeadersCount=32;
const wss=new WebSocketServer({noServer:true,maxPayload:LIMITS.payload,perMessageDeflate:false,clientTracking:false});
server.on('upgrade',(req,socket,head)=>{
 const ip=req.socket.remoteAddress||'unknown';const reject=(code,text)=>{socket.end(`HTTP/1.1 ${code} ${text}\r\nConnection: close\r\n\r\n`);};
 if(peers.size>=LIMITS.connections||(ips.get(ip)||0)>=LIMITS.perIP)return reject(503,'Busy');
 if(!['/','/ws'].includes(req.url.split('?')[0]))return reject(404,'Not Found');
 const origin=req.headers.origin;
 if(PUBLIC){if(!ORIGINS.has(origin))return reject(403,'Forbidden');}
 else if(origin&&origin!=='null'){try{if(new URL(origin).host!==req.headers.host)return reject(403,'Forbidden');}catch{return reject(403,'Forbidden');}}
 wss.handleUpgrade(req,socket,head,ws=>{
  ws.ip=ip;const p=service.add(ws);
  ws.on('message',(buf,binary)=>{p.lastAlive=Date.now();if(binary)return ws.close(1003,'Text only');try{handle(p,JSON.parse(buf.toString('utf8')));}catch(e){console.error('Rejected message:',e.message);error(p,'无法解析指令');}});
  ws.on('pong',()=>p.lastAlive=Date.now());ws.on('error',()=>{});ws.on('close',()=>left(p));
 });
});
let previous=performance.now(),acc=0;
const tickTimer=setInterval(()=>{const now=performance.now();acc+=Math.min(.5,(now-previous)/1000);previous=now;let n=0;while(acc>=R.STEP&&n++<5){service.advance();acc-=R.STEP;}service.flush();},50);
const sweepTimer=setInterval(()=>{for(const p of peers)if(p.ws.readyState===1)p.ws.ping();service.sweep();},15000);
server.on('error',e=>{console.error('Server failed:',e.message);process.exit(1);});
server.listen(PORT,HOST,()=>{console.log('\nRED ALERT 3D / COMMAND EDITION '+R.VERSION);console.log('Open: http://127.0.0.1:'+PORT);if(HOST==='0.0.0.0')for(const a of addresses())console.log('LAN:  '+a);console.log('Content: '+R.CONTENT_HASH+' | Ctrl+C stops this server.\n');if(args.includes('--open')){const u='http://127.0.0.1:'+PORT;const cp=require('node:child_process');const cmd=process.platform==='win32'?['cmd',['/c','start','',u]]:process.platform==='darwin'?['open',[u]]:['xdg-open',[u]];const child=cp.spawn(cmd[0],cmd[1],{stdio:'ignore'});child.on('error',()=>{});}});
function shutdown(){clearInterval(tickTimer);clearInterval(sweepTimer);for(const p of peers)p.ws.close(1001,'Server shutdown');server.close(()=>process.exit());setTimeout(()=>process.exit(),800).unref();}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
