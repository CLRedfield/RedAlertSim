'use strict';
require('../web/src/data.js');const Sim=require('../web/src/sim.js'),os=require('node:os'),fs=require('node:fs'),path=require('node:path');
// Simulation-only synthetic stress scene, not a GPU/FPS or actual network test.
const rows=[];
for(const count of [100,300,600]){
 const s=new Sim({players:8,map:'basin',sandbox:true,reveal:true});s.entities=[];s.ores=[];s.reindex();s.rebuildGrid();
 for(let i=0;i<count;i++){const owner=i%8,x=32+(i%25)*5,z=32+Math.floor(i/25)*5;s.spawn(['grizzly','rhino','lasher'][i%3],owner,x,z,{invul:999,order:{type:'attackMove',x:96,z:96}});}
 s.reindex();s.rebuildGrid();s.updateFog();const times=[];for(let i=0;i<100;i++){const t=performance.now();s.tickStep();times.push(performance.now()-t);}const sort=[...times].sort((a,b)=>a-b);rows.push({initialUnits:count,steps:100,simulatedSeconds:10,remainingUnits:s.entities.length,meanStepMs:+(times.reduce((a,b)=>a+b)/times.length).toFixed(3),p95StepMs:+sort[94].toFixed(3),snapshotBytes:Buffer.byteLength(JSON.stringify(s.snapshot(0)))});
}
const report={date:new Date().toISOString(),runtime:process.version,cpu:os.cpus()[0]?.model,scope:'Synthetic simulation only; dense eight-owner combat with invulnerability to hold entity count constant; excludes rendering, GPU and network transfer. This is NOT RTX 4060 frame-rate evidence.',rows};
fs.writeFileSync(path.join(__dirname,'benchmark-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
