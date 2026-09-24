'use strict';
// Run serially. Multiple SwiftShader browsers contend for software rendering time.
const {spawnSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');fs.mkdirSync(path.join(__dirname,'logs'),{recursive:true});
for(const name of ['release','operations','camera','upgrade','smoke']){
 console.log('RUN browser_'+name);const log=fs.openSync(path.join(__dirname,'logs','browser-'+name+'.log'),'w');
 const run=spawnSync(process.env.PYTHON||'python',['-u',path.join(__dirname,'browser_'+name+'.py')],{cwd:root,stdio:['ignore',log,log],timeout:300000});fs.closeSync(log);
 console.log(name,run.status,run.error?.message||'');if(run.status!==0){process.exitCode=1;break;}
}
