/* Filter first, then encode. Deltas always refer to a client-acknowledged state. */
(function(G){'use strict';const R=G.RA||(G.RA={});
const clone=o=>JSON.parse(JSON.stringify(o));
function equal(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function pack(snapshot){
 const s=clone(snapshot);
 // Quantization is visual only. The authoritative simulation retains full precision.
 for(const e of s.entities||[])for(const k of ['x','z','angle','turret','hp','stun','lifted','charge','cargo'])if(typeof e[k]==='number')e[k]=Math.round(e[k]*100)/100;
 for(const p of [s.p,...(s.players||[])])if(p){delete p.memory;delete p.visible;delete p.explored;delete p.aiPlan;delete p.scout;delete p.built;}
 return s;
}
function delta(base,next){
 const changes={},removed=[];
 for(const k of Object.keys(next))if(k!=='entities'&&k!=='fog'&&!equal(base[k],next[k]))changes[k]=next[k];
 for(const k of Object.keys(base))if(!(k in next))removed.push(k);
 const old=new Map((base.entities||[]).map(e=>[e.id,e])),entities=[],gone=[];
 for(const e of next.entities||[]){const o=old.get(e.id);if(!o){entities.push({id:e.id,full:e});continue;}old.delete(e.id);let patch={},del=[];for(const k of Object.keys(e))if(!equal(o[k],e[k]))patch[k]=e[k];for(const k of Object.keys(o))if(!(k in e))del.push(k);if(Object.keys(patch).length||del.length)entities.push({id:e.id,patch,del});}
 gone.push(...old.keys());let fog=null;
 if(Array.isArray(next.fog)){if(!Array.isArray(base.fog)||base.fog.length!==next.fog.length)fog={full:next.fog};else{const cells=[];for(let i=0;i<next.fog.length;i++)if(next.fog[i]!==base.fog[i])cells.push(i,next.fog[i]);if(cells.length)fog=cells.length>next.fog.length?{full:next.fog}:{cells};}}
 else if(!equal(base.fog,next.fog))changes.fog=next.fog;
 return{changes,removed,entities,gone,fog};
}
function apply(base,d){
 if(!base||!d||!Array.isArray(d.entities)||!Array.isArray(d.gone))throw Error('缺少同步基线');
 const s=clone(base);Object.assign(s,d.changes);for(const k of d.removed||[])delete s[k];
 const em=new Map(s.entities.map(e=>[e.id,e]));for(const id of d.gone)em.delete(id);
 for(const e of d.entities){if(e.full){em.set(e.id,clone(e.full));continue;}const item=em.get(e.id);if(!item)throw Error('增量状态缺少实体');Object.assign(item,e.patch);for(const k of e.del||[])delete item[k];}s.entities=[...em.values()];
 if(d.fog?.full)s.fog=d.fog.full.slice();else if(d.fog?.cells){for(let i=0;i<d.fog.cells.length;i+=2)s.fog[d.fog.cells[i]]=d.fog.cells[i+1];}
 return s;
}
R.Wire={pack,delta,apply};if(typeof module!=='undefined')module.exports=R.Wire;
})(globalThis);
