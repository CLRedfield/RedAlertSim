/* 1.0 procedural detailing. Separate detail meshes are omitted at low quality
 * or wide zoom, retaining the original silhouette and turret animation.
 * All shapes are authored here; no extracted commercial game assets. */
(function(G){'use strict';const R=G.RA,Geo=R.Geo,base=R.makeModel;
const COLORS={allies:[.46,.53,.44],soviet:[.43,.34,.26],yuri:[.37,.31,.44]},dark=[.11,.145,.16],steel=[.61,.64,.59],glass=[.28,.62,.67],warning=[.73,.58,.28];
R.ART_PROFILE={version:'1.0.0',detailMesh:true,lodZoom:52,authored:'procedural-original',counts:{}};
R.makeModel=function(d){const m=base(d),g=new Geo(),t=new Geo(),p=COLORS[d.faction]||[.47,.48,.4],light=d.faction==='yuri'?[.64,.41,.77]:glass,sz=d.size||1;
 const band=(x,y,z,w,n=4)=>{for(let i=0;i<n;i++)g.box(x+(i-(n-1)/2)*w/n,y,z,w/n*.48,.035,.22,i%2?warning:dark,0,0,.35);};
 const vent=(x,y,z,w,l,n=6)=>{g.box(x,y-.02,z,w+.14,.1,l+.14,p);for(let i=0;i<n;i++)g.box(x,y+.04,z+(i-(n-1)/2)*l/n,w,.025,l/n*.45,dark);};
 const pipe=(x,y,z,h,r=.06)=>{g.cyl(x,y,z,r,h,steel,0,7);g.cyl(x,y-h*.36,z,r*1.4,.06,dark,0,7);};
 if(d.kind==='building'&&d.role!=='wall'){
  const h=sz*.5,sc=sz/6;
  for(const x of[-1,1])for(const z of[-1,1]){g.box(x*(h-.35),.34,z*(h-.35),.40,.13,.40,steel);g.cyl(x*(h-.35),.46,z*(h-.35),.09,.1,dark,0,6);}
  if(!['defense','oil','civilian'].includes(d.role)){
   // Foundation curb, cable duct and a small team-colored identity panel.
   g.box(-h+.14,.24,0,.14,.14,sz-.9,steel);g.box(h-.14,.24,0,.14,.14,sz-.9,steel);
   for(let i=0;i<3;i++)g.box(-h+.65+i*.75,.3,h-.27,.46,.025,.16,warning);
   g.box(h-.38,.62,-h+.55,.34,.47,.55,dark);g.box(h-.39,.83,-h+.26,.23,.11,.02,light);
   g.box(0,.57,h-.16,1.1,.37,.05,p,.84);
  }
  if(d.role==='power'){
   for(const x of[-1,1]){pipe(x*1.6*sc,.94*sc,1.3*sc,1.25*sc,.075);g.box(x*1.63*sc,.65*sc,1.62*sc,.43*sc,.48*sc,.32*sc,dark);}
   if(d.faction==='soviet'){g.cyl(.4*sc,3.6*sc,0,.12*sc,1.1*sc,steel,0,8);g.cyl(.4*sc,4.15*sc,0,.18*sc,.09*sc,warning,0,8);}
   if(d.faction==='yuri'){for(let i=0;i<4;i++)g.cyl(0,(1.12+i*.36)*sc,0,1.0*sc,.035*sc,light,0,14);}
  }
  if(d.role==='factory'||d.role==='industry'){
   vent(-.6*sc,3.13*sc,-.85*sc,1.75*sc,.85*sc,6);for(const x of[-2,2]){g.box(x*sc,1.16*sc,2.45*sc,.13*sc,1.6*sc,.12*sc,steel);g.box(x*sc,2.04*sc,2.46*sc,.18*sc,.09*sc,.15*sc,light);}
   for(let i=0;i<7;i++)g.box(-1.65*sc+i*.55*sc,.35*sc,2.72*sc,.27*sc,.03,.47*sc,i%2?warning:dark,0,0,.32);
   g.box(2.36*sc,1.3*sc,-1.3*sc,.20*sc,1.6*sc,.13*sc,steel);for(let i=0;i<7;i++)g.box(2.51*sc,(.58+i*.23)*sc,-1.3*sc,.1,.07,.51*sc,steel);
  }
  if(d.role==='refinery'){
   for(let i=0;i<5;i++)g.box(1.15*sc,.48*sc,(.25+i*.48)*sc,1.57*sc,.06,.065*sc,steel);
   band(1.05*sc,.52*sc,2.82*sc,2.3*sc,7);pipe(-2.5*sc,1.4*sc,-1.5*sc,2.45*sc,.09);
   g.cyl(1.8*sc,3.83*sc,-1.3*sc,.76*sc,.11*sc,dark,0,14);for(let i=0;i<5;i++)g.box(-2.57*sc,(.6+i*.29)*sc,-1.5*sc,.42*sc,.06,.12,steel);
  }
  if(['radar','airfield','satellite','gap'].includes(d.role)){
   vent(-1.1*sc,2.05*sc,-1.6*sc,1.45*sc,.56*sc,5);g.box(-2.68*sc,.7*sc,-.65*sc,.15,1.0*sc,1.75*sc,dark);for(let i=0;i<4;i++)g.box(-2.8*sc,(.44+i*.2)*sc,-.65*sc,.06,.06,1.4*sc,steel);
   if(d.role==='airfield')for(const x of[-.7,2.35])for(const z of[.35,2.65])g.cyl(x*sc,.42*sc,z*sc,.055,.07,light,0,6);
   for(let i=0;i<8;i++){const a=i*Math.PI/4;t.box(Math.cos(a)*1.15*sc,.22*sc,Math.sin(a)*1.15*sc,.06,.055,.44*sc,steel,0,0,-a);}
  }
  if(d.role==='barracks'){
   g.box(0,.35*sc,2.65*sc,2.1*sc,.13,.36*sc,steel);g.box(0,.42*sc,2.40*sc,1.8*sc,.13,.30*sc,steel);for(const x of[-1,1]){g.box(x*2.05*sc,1.65*sc,1.4*sc,.3*sc,.55*sc,.07,light);g.box(x*1.85*sc,.73*sc,2.4*sc,.5*sc,.6*sc,.35*sc,p);}
  }
  if(['tech','cloner','robotcontrol','purifier'].includes(d.role)){
   for(const x of[-2.25,2.25]){pipe(x*sc,1.25*sc,1.7*sc,1.7*sc,.09);g.cyl(x*sc,2.17*sc,1.7*sc,.19*sc,.1,light,0,8);}
   for(let i=0;i<4;i++){const x=(-1.3+i*.85)*sc;g.box(x,1.12*sc,2.52*sc,.48*sc,.54*sc,.05,light);g.box(x,.80*sc,2.56*sc,.57*sc,.07,.13,steel);}
   band(0,.32*sc,2.8*sc,3.2*sc,8);
  }
  if(d.role==='naval'){
   for(const x of[-2.5,2.5])for(let i=0;i<4;i++){g.cyl(x*sc,.46*sc,(-1.8+i*1.2)*sc,.13*sc,.29,steel,0,8);g.box(x*sc,.62*sc,(-1.8+i*1.2)*sc,.45,.1,.1,dark);}
   g.box(-2.5*sc,1.03*sc,-2.1*sc,.24,1.1*sc,.4,warning);g.box(-2.5*sc,1.53*sc,-2.1*sc,.29,.1,.48,light);
  }
  if(d.role==='defense'){
   for(const x of[-.8,.8])g.box(x*sc,.28,1.42*sc,.44*sc,.17,.35*sc,steel);g.box(-1.2*sc,.63,.52*sc,.24,.3,.12,light);g.box(1.1*sc,.33,0,.14,.12,1.55*sc,warning);
   if(d.id==='a_prism'||d.id==='s_tesla'||d.id==='y_psychic')for(let i=0;i<4;i++)g.cyl(0,(.55+i*.34)*sc,0,.86*sc,.045,steel,0,12);
  }
  if(d.role==='super'){
   for(let i=0;i<12;i++){const a=i*Math.PI/6;g.box(Math.cos(a)*2.55*sc,.38,Math.sin(a)*2.55*sc,.36,.10,.16,i%2?warning:dark,0,0,-a);}
   for(const x of[-2.3,2.3]){pipe(x*sc,1.38*sc,1.6*sc,1.7*sc,.065);g.cyl(x*sc,2.29*sc,1.6*sc,.12,.15,light,0,8);}
  }
  if(d.role==='oil'){for(const x of[-1,1]){g.box(x*1.6,.9,-1.3,.12,1.2,.12,steel);g.box(x*1.6,1.5,-.7,.12,.12,1.35,warning);}for(let i=0;i<5;i++)g.box(-1.6,.5+i*.2,-.7,.45,.065,.1,steel);}
  if(d.role==='civilian'){for(const side of[-1,1])for(let j=0;j<4;j++)g.box(side*2.36,1+j*.73,.5,.07,.39,.87,glass);vent(.3,4.55,-1,1.2,.8,6);}
 }
 if(d.kind==='vehicle'&&!['trex','spider','chaos'].includes(d.model)){
  // Universal minor fittings remain separate from the baseline track silhouette.
  const s=d.model==='mcv'?1.3:1;for(const x of[-1,1]){g.box(x*1.08*s,1.03,1.25*s,.05,.13,.34,steel,.8);g.box(x*.91*s,1.43,-1.25*s,.21,.19,.39,p);}
  if(['apocalypse','fortress'].includes(d.model)){const w=d.model==='fortress'?1.48:1.33;for(const side of[-1,1])for(let i=0;i<5;i++){g.box(side*w,1.22,-1.53+i*.7,.14,.5,.51,p,.02);g.box(side*(w+.08),1.18,-1.53+i*.7,.025,.08,.21,steel);}vent(0,d.model==='fortress'?2.38:1.5,-1.48,1.15,.6,5);}
  if(d.id==='apocalypse'){for(const x of[-.66,.66]){t.box(x,.64,-.18,.20,.43,1.05,p);t.box(x,.80,.43,.24,.10,.31,light);t.cyl(x,.82,-.71,.13,.18,dark,0,8);}t.cyl(0,.76,-.36,.25,.08,steel,0,10);}
  if(d.id==='battlefortress'){for(const x of[-1,1]){g.box(x*1.27,2.16,-.05,.1,.2,2.52,steel,.04);g.box(x*1.35,2.02,-1.59,.14,.12,.30,light);}g.box(0,1.13,-2.05,1.65,.7,.08,dark);for(let i=0;i<4;i++)g.box(0,.94+i*.16,-2.105,1.48,.055,.03,steel);}
  if(d.id==='ifv'){for(const side of[-1,1]){g.box(side*.68,1.57,-.48,.33,.20,.60,steel);t.box(side*.51,.48,.1,.22,.26,.79,p);for(const x of[-.055,.055])t.cyl(side*.51+x,.47,.55,.035,.08,dark,0,6,.035,Math.PI/2);}t.box(0,.76,-.3,.2,.19,.18,light);}
  if(d.id==='prism_tank'){for(const x of[-.48,.48]){t.box(x,.56,0,.07,.43,.30,steel);t.cyl(x,.68,-.12,.11,.22,light,0,6);}for(let i=0;i<4;i++)g.box(-.55+i*.35,1.48,-.55,.15,.055,.18,light);}
  if(d.id==='mirage'){for(const x of[-1,1])for(let i=0;i<4;i++)g.box(x*.92,1.44,-.7+i*.5,.19,.17,.31,i%2?[.31,.43,.26]:p,0,0,.3*x);t.box(0,.81,-.08,.42,.08,.65,[.31,.43,.26]);}
  if(d.id==='v3'){for(const side of[-1,1]){g.box(side*.9,1.57,-.8,.12,.55,1.8,steel);g.box(side*.86,1.87,-1.48,.34,.12,.58,warning);}for(let i=0;i<3;i++)g.box(.03,1.59,-.92+i*.52,.7,.08,.10,dark);}
  if(d.id==='tesla_tank'){for(const x of[-.48,.48])for(let i=0;i<3;i++)t.box(x,.57+i*.25,.18,.17,.09,.17,light);g.box(0,1.48,-.65,.7,.22,.6,dark);}
  if(d.id==='magnetron'){for(const x of[-.55,.55])for(let i=0;i<4;i++)t.box(x,.52+i*.20,-.31,.28,.055,.36,steel);t.box(0,.38,-.4,.6,.10,.13,light);}
  if(d.id==='mastermind'){for(let i=0;i<12;i++){const a=i*Math.PI/6;t.cyl(Math.cos(a)*.79,.43,Math.sin(a)*.79,.045,.35,steel,0,5);t.box(Math.cos(a)*.96,.65,Math.sin(a)*.96,.08,.1,.1,light);}g.box(0,1.51,-1.12,.52,.10,.27,light);}
  if(d.model==='gattling'||d.model==='flak_track'){for(const x of[-.63,.63]){t.cyl(x,.63,-.45,.23,.35,dark,0,10,.23,0,0,Math.PI/2);t.cyl(x,.64,-.44,.11,.40,warning,0,8,.11,0,0,Math.PI/2);}}
  if(['miner','slave_miner'].includes(d.model)){for(const side of[-1,1])for(let i=0;i<4;i++)g.box(side*.99,1.92,-1.59+i*.5,.09,.39,.10,steel);g.box(-.68,2.34,.69,.30,.12,.22,warning);pipe(.84,2.2,-1.56,.58,.045);}
  if(d.model==='mcv'){for(const side of[-1,1]){g.box(side*1.55,1.76,-1.5,.12,1.0,.08,steel);for(let i=0;i<4;i++)g.box(side*1.64,1.35+i*.25,-1.5,.09,.075,.62,steel);}g.box(.58,3.48,-1.65,.18,.25,.18,light);}
 }
 if(d.kind==='infantry'&&!['dog','brute','prime'].includes(d.model)){
  g.box(0,1.2,-.35,.34,.44,.15,dark);for(const x of[-.18,.18])g.box(x,1.22,.30,.1,.18,.08,p);g.box(-.44,1.31,.16,.035,.09,.10,steel,.9);
  if(d.model==='engineer'){g.box(.54,.90,.15,.24,.37,.36,warning);g.box(.54,1.12,.15,.18,.05,.13,dark);g.box(0,1.93,.06,.06,.1,.4,steel);}
  if(d.model==='commando'){g.box(0,1.88,.1,.46,.08,.12,d.faction==='soviet'?[.53,.16,.14]:dark);g.box(-.27,1.39,.31,.08,.2,.12,steel);}
  if(d.model==='desolator'){g.box(0,1.69,.23,.3,.12,.1,dark);for(const x of[-.21,.21])g.cyl(x,1.19,-.51,.07,.65,light,0,6);}
  if(['psychic','initiate'].includes(d.model)){g.box(0,1.40,.27,.08,.2,.035,light);for(const x of[-.48,.48])g.box(x,1.44,.24,.13,.075,.16,steel);}
 }
 if(d.kind==='air'){
  if(['jet','eagle'].includes(d.model)){for(const side of[-1,1]){g.box(side*1.11,.12,-.38,.26,.10,.64,steel,.65);g.cyl(side*.75,-.18,-1.0,.20,.28,dark,0,10,.20,Math.PI/2);g.cyl(side*.75,-.18,-1.17,.14,.03,warning,0,10,.14,Math.PI/2);}g.box(0,.2,-1.32,.12,.12,.65,steel,.8);}
  if(d.model==='kirov'){for(const side of[-1,1]){g.cyl(side*1.58,-.58,-1.5,.28,.68,steel,0,10,.28,Math.PI/2);g.box(side*1.58,-.57,-1.92,.65,.08,.025,dark);}for(const x of[-.37,.37])g.box(x,-1.41,.79,.16,.21,.06,glass);g.box(0,-1.25,1.0,.38,.14,.04,dark);}
  if(d.model==='helicopter'){for(const side of[-1,1]){g.box(side*.55,-.39,-.07,.1,.11,1.8,steel);g.box(side*.69,-.12,.72,.12,.10,.24,light);}g.cyl(0,.95,0,.11,.15,steel,0,9);}
  if(d.model==='disc'){for(let i=0;i<16;i++){const a=i*Math.PI/8;g.box(Math.cos(a)*1.25,-.13,Math.sin(a)*1.25,.22,.09,.09,light,0,0,-a);}g.cyl(0,-.33,0,.44,.10,dark,0,16);}
 }
 if(d.kind==='ship'&&!['dolphin','squid'].includes(d.model)){
  const sub=['sub','boomer'].includes(d.model),s=sz/4.5,w=sub?.76:1.15,l=sub?2.05:2.42;
  for(const side of[-1,1])for(let i=0;i<6;i++){g.box(side*w*s,.76,(-l+i*l*.4)*s,.04,.15,.045,steel);if(!sub&&i<5)g.box(side*w*s,.84,(-l+.2*l+i*l*.4)*s,.04,.04,l*.4*s,steel);}
  if(d.model==='carrier'){for(let i=0;i<9;i++)g.box(-.65,1.1,-3.3+i*.76,.11,.025,.4,warning);g.box(.74,1.93,-.6,.10,.27,.13,light);}
  if(d.model==='dreadnought'){for(const x of[-.62,.62]){g.box(x,1.02,-.25,.30,.14,2.55,dark);g.box(x,1.16,1.13,.32,.08,.16,warning);}}
  if(sub){pipe(0,1.32,-.38,.6,.045);g.cyl(0,1.63,-.38,.09,.08,steel,0,6);}
 }
 if(g.v.length)m.detail=g;if(t.v.length&&m.turret)m.turretDetail=t;
 R.ART_PROFILE.counts[d.id]={body:m.body.v.length/30,detail:g.v.length/30,turretDetail:t.v.length/30};return m;
};
})(globalThis);
