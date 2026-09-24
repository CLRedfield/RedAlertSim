#!/usr/bin/env node
'use strict';
// Operator-only configuration writer; it never claims that an endpoint is deployed.
const fs=require('node:fs'),path=require('node:path');
const args=process.argv.slice(2),get=(key)=>{const i=args.indexOf(key);return i<0?null:args[i+1];};
try {
 const raw=get('--url');if(!raw)throw Error('Usage: node tools/configure-online.cjs --url wss://YOUR-AUTHORIZED-DOMAIN/ws --name NAME');
 const u=new URL(raw);
 if(u.protocol!=='wss:'||u.username||u.password||u.hash||u.search||!u.hostname||['localhost','127.0.0.1','::1'].includes(u.hostname))throw Error('Expected a credential-free public wss URL with no query or fragment.');
 const name=(get('--name')||'Project server').replace(/[\x00-\x1f\x7f]/g,'').slice(0,48);
 const out={version:1,status:'operator_configured_not_verified',endpoints:[{name,url:u.href,enabled:true}],note:'Configured by operator. Reachability, authorization and mainland-China availability are not verified by this tool.'};
 const dest=path.join(__dirname,'../web/online.json');fs.writeFileSync(dest,JSON.stringify(out,null,2)+'\n');
 console.log('Configuration written to '+dest+'; no deployment or connectivity validation performed.');
} catch(e) {console.error(e.message);process.exitCode=1;}
