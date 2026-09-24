/* Original procedural art pass: faction materials, nine reference models and articulated legs. */
(function(G){'use strict';const R=G.RA,Geo=R.Geo,original=R.makeModel;
const palettes={allies:[.43,.50,.40],soviet:[.45,.38,.30],yuri:[.33,.30,.41]};
function repaint(g,d){if(!g)return;const base=palettes[d.faction];if(!base)return;for(let i=0;i<g.v.length;i+=10){const team=g.v[i+9];if(team>0){for(let j=0;j<3;j++)g.v[i+6+j]=g.v[i+6+j]*.35+base[j]*.65;g.v[i+9]=Math.min(.17,team*.24);}}}
R.makeModel=function(d){
 const model=original(d);repaint(model.body,d);repaint(model.turret,d);
 const g=model.body,p=palettes[d.faction]||[.4,.45,.43],dark=[.10,.15,.17],steel=[.54,.59,.57],glass=d.faction==='yuri'?[.54,.36,.67]:[.25,.57,.63],brass=[.73,.55,.29];
 if(['grizzly','rhino','lasher'].includes(d.id)){
  const width=d.id==='rhino'?1.19:1.13;
  // Side skirts, fastening plates, asymmetric gear and narrow team flashes.
  for(const side of [-1,1]){
   for(let i=0;i<4;i++){g.box(side*width,.88,-1.15+i*.77,.10,.44,.61,p,.06);g.cyl(side*(width+.065),.99,-1.15+i*.77,.045,.035,steel,0,6,.045,0,0,Math.PI/2);}
   g.box(side*width,1.19,.85,.115,.16,.66,steel,.9);
   g.box(side*.84,1.3,-1.0,.3,.27,.75,[.34,.39,.3],.08);
  }
  g.box(0,1.23,1.63,.84,.12,.08,brass);
  g.cyl(.62,1.55,-1.22,.19,.21,steel,0,10);g.cyl(.64,2.18,-1.2,.018,1.25,dark,0,5);
  if(model.turret){const t=model.turret;t.cyl(-.28,.51,-.24,.26,.09,steel,0,12);t.box(-.28,.58,-.24,.1,.07,.28,dark);t.box(.34,.45,-.1,.11,.13,.20,glass);
   if(d.id==='rhino'){for(const x of[-.55,.55])t.box(x,.24,.15,.20,.24,1.05,p,.07);for(const x of[-.35,.35])t.cyl(x,.7,-.4,.085,.25,dark,0,6,.085,Math.PI/2);}
   if(d.id==='grizzly'){t.box(0,.38,-.73,.86,.29,.31,steel,.13);for(const x of[-.43,.43])t.cyl(x,.5,.08,.07,.21,dark,0,6,.07,Math.PI/2);}
   if(d.id==='lasher'){for(const x of[-.57,.57])t.box(x,.54,-.15,.08,.19,.70,glass,.3,0,0,x*.1);t.cyl(0,.72,-.30,.20,.19,glass,0,6,.12);}
  }
 }
 if(['a_hq','s_hq','y_hq'].includes(d.id)){
  for(const side of[-1,1]){
   g.box(side*3.65,.21,0,.25,.13,7.8,steel);
   for(let k=0;k<6;k++)g.box(side*3.58,.30,-2.8+k*.85,.38,.05,.29,k%2?dark:brass,0,0,.4);
   g.box(side*3.30,1.25,2.5,.35,1.9,.45,p,.08);g.box(side*3.30,2.25,2.5,.4,.12,.5,glass);
  }
  g.box(0,.26,3.4,5.8,.09,.72,dark);for(let i=0;i<7;i++)g.box(-2.3+i*.77,.32,3.4,.40,.035,.56,brass,0,0,.4);
  for(let j=0;j<4;j++){g.box(-2.65+j*1.55,1.65,3.11,.72,.4,.06,glass);g.box(-2.65+j*1.55,1.44,3.16,.82,.05,.12,steel);}
  g.cyl(3.02,3.75,-2.9,.07,5.9,steel,0,6);g.box(3.58,5.82,-2.9,1.1,.64,.04,p,.96);
  g.box(-3.06,.8,-2.7,.7,1.1,.6,p);for(let i=0;i<4;i++)g.box(-3.065,.45+i*.21,-2.365,.50,.07,.03,dark);
  if(d.faction==='soviet'){g.box(0,2.68,3.1,1.5,.5,.06,[.5,.17,.13],.05);g.box(0,2.68,3.15,.12,.37,.04,brass);g.box(0,2.68,3.17,.6,.09,.04,brass);}
  if(d.faction==='allies'){g.box(0,2.66,3.10,1.6,.48,.06,[.14,.27,.32]);g.box(0,2.66,3.15,.65,.09,.04,steel,0,0,0,.25);g.box(0,2.66,3.17,.65,.09,.04,steel,0,0,0,-.25);}
  if(d.faction==='yuri'){for(const x of[-2.6,2.6]){g.cyl(x,3.4,-2.6,.14,3,steel,0,8);for(let i=0;i<4;i++)g.cyl(x,2.3+i*.45,-2.6,.35,.09,glass,0,10);}g.sphere(0,3.42,2.9,.48,.35,.15,glass,0,10);}
 }
 if(['gi','conscript','initiate'].includes(d.id)){
  g.box(0,1.26,.245,.49,.41,.11,p,.15);for(const x of[-.15,.15])g.box(x,1.12,.33,.13,.19,.12,[.43,.42,.32]);g.box(-.45,1.35,.10,.04,.12,.18,steel,.9);
  if(d.id==='gi'){g.box(0,1.37,-.37,.45,.50,.21,[.32,.4,.33]);g.box(0,1.83,.23,.38,.10,.10,dark);}
  if(d.id==='conscript'){g.box(0,1.04,.33,.08,.10,.04,brass);g.box(.0,1.43,-.32,.39,.19,.16,[.46,.4,.33]);}
  if(d.id==='initiate'){g.cyl(0,1.86,0,.26,.12,[.53,.40,.55],0,10);g.box(0,1.42,.28,.08,.14,.03,glass);}
 }
 // Articulated lower limbs, excluding quadrupeds, floating primes and giant mutations.
 if(d.kind==='infantry'&&!['dog','prime','brute'].includes(d.model)){
  const body=new Geo(),legs=[new Geo(),new Geo()];
  for(let i=0;i<g.v.length;i+=30){const tri=g.v.slice(i,i+30),cy=(tri[1]+tri[11]+tri[21])/3,cx=(tri[0]+tri[10]+tri[20])/3;
   if(cy<.89){const side=cx<0?0:1,px=side===0?-.17:.17;for(let j=0;j<30;j+=10){tri[j]-=px;tri[j+1]-=.85;}legs[side].v.push(...tri);}else body.v.push(...tri);
  }
  model.body=body;model.parts=legs.map((geo,i)=>({geo,pivot:[i===0?-.17:.17,.85,0],phase:i*Math.PI}));
 }
 return model;
};
R.Math.pitch=(angle)=>new Float32Array([1,0,0,0,0,Math.cos(angle),Math.sin(angle),0,0,-Math.sin(angle),Math.cos(angle),0,0,0,0,1]);
})(globalThis);
