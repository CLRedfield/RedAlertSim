'use strict';
// Export current data and finite-mesh evidence, preserving disclosed behavior notes.
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
require('../web/src/data.js');require('../web/src/geometry.js');require('../web/src/art.js');require('../web/src/art-expanded.js');
const R=globalThis.RA,previous=JSON.parse(fs.readFileSync(path.join(root,'docs/CONTENT_STATUS.json'),'utf8'));
const old=new Map(previous.definitions.map(d=>[d.id,d]));
const defs=R.defs().map(d=>{const m=R.makeModel(d);const parts=[m.body,m.turret,m.detail,m.turretDetail,...(m.parts||[]).map(p=>p.geo)].filter(Boolean);const triangles=parts.reduce((a,g)=>a+g.v.length/30,0);if(!parts.every(g=>g.v.every(Number.isFinite)))throw Error(d.id+' invalid vertices');return {...d,originalRulesVerified:false,availability:old.get(d.id)?.availability||'see-game-data',behaviorStatus:old.get(d.id)?.behaviorStatus||'本项目近似实现，非原版逐项认证',verificationStatus:old.get(d.id)?.verificationStatus||'shared simulation tests only',assetStatus:m.detail?'1.0 original procedural detail layer with quality/distance LOD':'baseline procedural geometry; no added detail layer',detailLayer:!!m.detail,triangles,triangleBudget:3000,finiteMesh:true};});
const out={version:R.VERSION,contentHash:R.CONTENT_HASH,definitionCount:defs.length,originalRulesVerified:false,detailLayerCount:defs.filter(d=>d.detailLayer).length,definitions:defs};
fs.writeFileSync(path.join(root,'docs/CONTENT_STATUS.json'),JSON.stringify(out,null,2));
let md=`# 内容完成度 · ${R.VERSION}\n\n实际代码导出${defs.length}个实体定义，其中${out.detailLayerCount}个含独立近景细节层。包括建筑、中立、系统生成和沙盒对象，不是相同数量的可生产战斗单位。没有宣称原版逐项验证完成。\n\n网格数字是该定义基础体、炮塔、附加部件和细节层的总三角面数；远景/低画质省略细节，非PBR纹理或高精度原版认证。\n\n|ID|名称|可用方式|行为状态|细节层|三角面|\n|---|---|---|---|---|---|\n`;
for(const d of defs)md+=`|${d.id}|${d.name}|${d.availability}|${d.behaviorStatus}|${d.detailLayer?'有，支持LOD':'沿用基础'}|${d.triangles}|\n`;
md+='\n完整数值、前置和机器可读属性见CONTENT_STATUS.json。重新生成：node tools/audit-content.cjs。机制回归见upgrade/release/operations测试；全目录网格验证不是全单位机制认证。\n';
fs.writeFileSync(path.join(root,'docs/CONTENT_STATUS.md'),md);console.log(defs.length+' definitions, '+out.detailLayerCount+' detail layers');
