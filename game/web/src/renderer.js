/* Dependency-free WebGL 2 renderer: instancing, directional shadow mapping, procedural terrain and fog. */
(function(G){'use strict';const R=G.RA,M=R.Math;
const VS=`#version 300 es
precision highp float;
layout(location=0)in vec3 aPos;layout(location=1)in vec3 aNormal;layout(location=2)in vec4 aColor;
layout(location=3)in vec4 i0;layout(location=4)in vec4 i1;layout(location=5)in vec4 i2;layout(location=6)in vec4 i3;layout(location=7)in vec4 iTint;
uniform mat4 uVP;uniform mat4 uLight;out vec3 vPos;out vec3 vNormal;out vec3 vColor;out vec4 vShadow;out float vAlpha;
void main(){mat4 model=mat4(i0,i1,i2,i3);vec4 world=model*vec4(aPos,1.);vPos=world.xyz;vNormal=mat3(model)*aNormal;vColor=mix(aColor.rgb,iTint.rgb,aColor.a);vAlpha=iTint.a;vShadow=uLight*world;gl_Position=uVP*world;}`;
const FS=`#version 300 es
precision highp float;
in vec3 vPos;in vec3 vNormal;in vec3 vColor;in vec4 vShadow;in float vAlpha;
uniform sampler2D uShadow;uniform sampler2D uFog;uniform float uUseShadow;uniform float uTime;uniform int uType;uniform int uBiome;uniform int uCoast;uniform int uLayout;uniform vec3 uEye;
out vec4 outColor;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
float shadow(vec3 n){if(uUseShadow<.5)return 1.;vec3 p=vShadow.xyz/vShadow.w*.5+.5;if(p.x<0.||p.x>1.||p.y<0.||p.y>1.||p.z>1.)return 1.;float bias=max(.0003,.0011*(1.-dot(n,normalize(vec3(-.6,1.,.45)))));vec2 texel=1./vec2(textureSize(uShadow,0));float lit=0.;for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)lit+=(p.z-bias>texture(uShadow,p.xy+vec2(float(x),float(y))*texel).r)?.36:1.;return lit/9.;}
void main(){vec3 color=vColor,n=normalize(vNormal);if(!gl_FrontFacing)n=-n;
if(uType==1){float grain=noise(vPos.xz*2.8),variation=noise(vPos.xz*.065)*.6+noise(vPos.xz*.27)*.4;
vec3 base=uBiome==2?vec3(.46,.355,.23):uBiome==1?vec3(.46,.48,.455):vec3(.34,.395,.27);color=base*(.84+variation*.3)+(grain-.5)*.058;
float road=min(min(abs(vPos.x-96.),abs(vPos.z-96.)),min(min(abs(vPos.x-33.),abs(vPos.x-159.)),min(abs(vPos.z-33.),abs(vPos.z-159.))));
if(uLayout==1){road=min(min(abs(vPos.x-96.),abs(vPos.z-96.)),min(min(abs(vPos.x-66.),abs(vPos.x-126.)),min(abs(vPos.z-66.),abs(vPos.z-126.))));color=mix(color,vec3(.29,.32,.31)+variation*.065,.58);}
if(uLayout==2)road=min(abs(vPos.z-96.),min(abs(vPos.x-60.),abs(vPos.x-132.)));
if(uLayout==3)road=min(abs(vPos.x-vPos.z),abs(vPos.x+vPos.z-192.))*.707;
float mask=1.-smoothstep(2.2,3.3,road);color=mix(color,vec3(.235,.25,.225)+grain*.037,mask*.92);
float lane=(1.-smoothstep(.06,.13,road))*(step(.55,fract((vPos.x+vPos.z)*.15)));color=mix(color,vec3(.61,.57,.39),lane*.27);
float edge=min(min(vPos.x,192.-vPos.x),min(vPos.z,192.-vPos.z));if(uCoast==1){float shore=1.-smoothstep(18.,23.,edge);color=mix(color,vec3(.53,.5,.35),shore);if(edge<18.){float wave=sin(vPos.x*.6+uTime*.9)*sin(vPos.z*.8-uTime*.7)*.5+.5;float foam=(1.-smoothstep(0.,1.4,abs(edge-17.4)))*(.5+.5*wave);color=mix(vec3(.10,.245,.255),vec3(.22,.39,.34),smoothstep(2.,18.,edge));color+=wave*.025+foam*.16;n=normalize(vec3(sin(vPos.x*.4+uTime)*.045,1.,cos(vPos.z*.6+uTime)*.06));}}}
float nd=max(dot(n,normalize(vec3(-.6,1.,.45))),0.);float ao=.84+min(vPos.y*.08,.16);vec3 lit=color*(vec3(.46,.50,.51)+vec3(.68,.61,.47)*nd*shadow(n))*ao;
if(uType==2)lit=color*1.2;
float fog=texture(uFog,clamp(vPos.xz/192.,vec2(0),vec2(1))).r;lit=mix(vec3(.019,.027,.029),lit,pow(fog,.75));
vec3 view=normalize(uEye-vPos);float spec=pow(max(dot(reflect(-normalize(vec3(-.6,1.,.45)),n),view),0.),28.);if(uType==0)lit+=spec*.055*fog;
lit=pow(max(lit,vec3(0)),vec3(.85));outColor=vec4(lit,vAlpha);
}`;
const DEPTHFS=`#version 300 es
precision highp float;void main(){}`;
function program(gl,vs,fs){const compile=(kind,src)=>{const sh=gl.createShader(kind);gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));return sh;};let v=compile(gl.VERTEX_SHADER,vs),f=compile(gl.FRAGMENT_SHADER,fs),p=gl.createProgram();gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));gl.deleteShader(v);gl.deleteShader(f);return p;}
function rgb(hex){return[parseInt(hex.slice(1,3),16)/255,parseInt(hex.slice(3,5),16)/255,parseInt(hex.slice(5,7),16)/255];}
class Renderer{
 constructor(canvas,overlay){this.canvas=canvas;this.overlay=overlay;this.ctx=overlay.getContext('2d');this.gl=canvas.getContext('webgl2',{antialias:true,alpha:false,powerPreference:'high-performance'});if(!this.gl)throw new Error('浏览器未能创建 WebGL 2。请启用浏览器硬件加速。');this.target={x:42,z:142};this.zoom=37;this.yaw=Math.PI/4;this.pitch=.92;this.quality='high';this.meshes=new Map();this.models=new Map();this.cache=new Map();this.cameraVP=M.identity();this.invVP=M.identity();this.eye=[0,0,0];this.totalTime=0;this.projections=[];this.frame=0;this.fps=0;this.props=[];this.lastFogTick=-1;
 const gl=this.gl;this.program=program(gl,VS,FS);this.depthProgram=program(gl,VS,DEPTHFS);this.u={};for(const n of['VP','Light','Shadow','Fog','UseShadow','Time','Type','Biome','Coast','Layout','Eye'])this.u[n]=gl.getUniformLocation(this.program,'u'+n);this.du={VP:gl.getUniformLocation(this.depthProgram,'uVP'),Light:gl.getUniformLocation(this.depthProgram,'uLight')};
 this.fog=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.fog);gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,64,64,0,gl.RED,gl.UNSIGNED_BYTE,new Uint8Array(4096).fill(255));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 this.makeShadow(2048);this.lightVP=M.mul(M.ortho(-148,148,-148,148,1,400),M.look([-24,205,186],[96,0,96]));
 const ground=new R.Geo();ground.quad([0,-.06,192],[192,-.06,192],[192,-.06,0],[0,-.06,0],[.4,.45,.3]);this.addMesh('ground',ground,1);this.addMesh('pine',R.makeTree(true));this.addMesh('tree',R.makeTree(false));let rock=new R.Geo();rock.sphere(0,.5,0,1.4,.7,1.1,[.38,.4,.38],0,8);this.addMesh('rock',rock);let ore=new R.Geo();ore.cyl(0,.55,0,.32,1.1,[.7,.47,.14],0,5,.03);this.addMesh('ore',ore);let gem=new R.Geo();gem.cyl(0,.7,0,.36,1.4,[.34,.69,.68],0,5,.015);this.addMesh('gem',gem);
 let flame=new R.Geo();flame.sphere(0,0,0,1,1,1,[1,.55,.12],1,10);this.addMesh('flame',flame,2);let ring=new R.Geo();ring.cyl(0,0,0,1,.015,[1,.6,.25],1,32);this.addMesh('ring',ring,2);let beam=new R.Geo();beam.box(0,0,0,.06,.06,1,[1,.7,.3],1);this.addMesh('beam',beam,2);let sand=new R.Geo();for(let i=0;i<8;i++){let a=i*Math.PI/4;sand.box(Math.cos(a)*.8,.25,Math.sin(a)*.8,.65,.35,.3,[.48,.43,.28],0,0,-a);}this.addMesh('sandbag',sand);
 gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);this.resize();this.generateProps(260905,'coast'); }
 addMesh(id,geo,type=0){const gl=this.gl,vao=gl.createVertexArray();gl.bindVertexArray(vao);let buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(geo.v),gl.STATIC_DRAW);for(const[loc,size,offset]of[[0,3,0],[1,3,12],[2,4,24]]){gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,40,offset);}let ib=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,ib);gl.bufferData(gl.ARRAY_BUFFER,80,gl.DYNAMIC_DRAW);for(let i=0;i<5;i++){gl.enableVertexAttribArray(3+i);gl.vertexAttribPointer(3+i,4,gl.FLOAT,false,80,i*16);gl.vertexAttribDivisor(3+i,1);}gl.bindVertexArray(null);let mesh={vao,buffer,ib,count:geo.v.length/10,data:[],instances:0,type};this.meshes.set(id,mesh);return mesh;}
 makeShadow(size){const gl=this.gl;if(this.shadowTex)gl.deleteTexture(this.shadowTex);if(this.shadowFB)gl.deleteFramebuffer(this.shadowFB);this.shadowSize=size;this.shadowTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.shadowTex);gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,size,size,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);this.shadowFB=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,this.shadowFB);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,this.shadowTex,0);gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);this.shadowOK=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;gl.bindFramebuffer(gl.FRAMEBUFFER,null);}
 resize(){const rect=this.canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,this.quality==='low'?1:1.5);let w=Math.round(rect.width*dpr),h=Math.round(rect.height*dpr);if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;this.overlay.width=w;this.overlay.height=h;}this.width=rect.width;this.height=rect.height;this.dpr=dpr;this.syncCamera();}
 setQuality(q){this.quality=q;this.makeShadow(q==='high'?2048:1024);this.resize();}
 generateProps(seed,map){this.props=[];let n=seed>>>0;const rnd=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};const objects=R.mapObjects(map);for(let i=0;i<(map==='urban'?430:650);i++){const x=8+rnd()*176,z=8+rnd()*176;if(R.onWater(map,x,z)||R.SPAWNS.some(p=>Math.hypot(x-p[0],z-p[1])<20)||objects.neutrals.some(p=>Math.hypot(x-p.x,z-p.z)<6)||objects.ores.some(p=>Math.hypot(x-p.x,z-p.z)<6))continue;const road=map==='urban'?Math.min(...[66,96,126].flatMap(v=>[Math.abs(x-v),Math.abs(z-v)])):map==='fortress'?Math.min(Math.abs(x-60),Math.abs(x-132),Math.abs(z-96)):map==='valley'?Math.min(Math.abs(x-z),Math.abs(x+z-192))*.707:Math.min(Math.abs(x-96),Math.abs(z-96),Math.abs(x-33),Math.abs(z-33),Math.abs(x-159),Math.abs(z-159));if(road<5)continue;this.props.push({x,z,scale:.6+rnd()*.75,angle:rnd()*6.28,type:map==='desert'?rnd()<.85?'rock':'tree':rnd()<.19?'rock':rnd()<.8?'pine':'tree'});}this.map=map;this.propSeed=seed;this.cache.clear();this.lastFogTick=-1;}
 project(x,y,z){const p=M.point(this.cameraVP,x,y,z);return{x:(p[0]/p[3]*.5+.5)*this.width,y:(.5-p[1]/p[3]*.5)*this.height,depth:p[2]/p[3]};}
 groundAt(px,py){const x=px/this.width*2-1,y=1-py/this.height*2,a=M.point(this.invVP,x,y,-1),b=M.point(this.invVP,x,y,1);for(let i=0;i<3;i++){a[i]/=a[3];b[i]/=b[3];}const t=-a[1]/(b[1]-a[1]);return{x:a[0]+(b[0]-a[0])*t,z:a[2]+(b[2]-a[2])*t};}
 syncCamera(){
  if(!this.width||!this.height)return;
  const aspect=this.width/this.height,r=140;
  this.eye=[this.target.x+Math.sin(this.yaw)*Math.cos(this.pitch)*r,Math.sin(this.pitch)*r,this.target.z+Math.cos(this.yaw)*Math.cos(this.pitch)*r];
  this.cameraVP=M.mul(M.ortho(-this.zoom*aspect,this.zoom*aspect,-this.zoom,this.zoom,1,350),M.look(this.eye,[this.target.x,0,this.target.z]));
  this.invVP=M.invert(this.cameraVP);
 }
 pan(dx,dz){if(!Number.isFinite(dx)||!Number.isFinite(dz))return;this.target.x=Math.max(1,Math.min(191,this.target.x+dx));this.target.z=Math.max(1,Math.min(191,this.target.z+dz));this.syncCamera();}
 screenPan(dx,dy){const speed=this.zoom/this.height*2;this.pan((Math.cos(this.yaw)*dx+Math.sin(this.yaw)*dy/Math.sin(this.pitch))*speed,(-Math.sin(this.yaw)*dx+Math.cos(this.yaw)*dy/Math.sin(this.pitch))*speed);}
 instance(id,mat,tint=[.7,.3,.3],alpha=1){const mesh=this.meshes.get(id);if(!mesh)return;mesh.data.push(...mat,tint[0],tint[1],tint[2],alpha);}
 getModel(type){if(this.models.has(type))return this.models.get(type);const model=R.makeModel(R.D[type]);this.addMesh(type,model.body);if(model.detail)this.addMesh(type+':detail',model.detail);if(model.turretDetail)this.addMesh(type+':tdetail',model.turretDetail);if(model.turret&&model.turret.v.length)this.addMesh(type+':t',model.turret);if(model.parts)model.parts.forEach((p,i)=>this.addMesh(type+':part'+i,p.geo));this.models.set(type,model);return model;}
 entity(e,dt,ghost=false){const d=R.D[e.type];if(!d)return;const model=this.getModel(e.type);let v=this.cache.get(e.id);if(!v||v.type!==e.type){v={x:e.x,z:e.z,angle:e.angle||0,aim:e.aim||e.angle||0,type:e.type};this.cache.set(e.id,v);}let smooth=1-Math.exp(-18*dt);if(Math.hypot(v.x-e.x,v.z-e.z)>15)smooth=1;v.x+=(e.x-v.x)*smooth;v.z+=(e.z-v.z)*smooth;const turn=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));v.angle+=turn(v.angle,e.angle||0)*smooth;v.aim+=turn(v.aim,e.aim||e.angle||0)*smooth;
 let y=d.kind==='air'&&!e.deployed?8+(d.model==='kirov'?2:0)+Math.sin(this.totalTime*1.3+e.id)*.13:0;if(d.kind==='ship')y+=Math.sin(this.totalTime+e.id)*.045;if(e.flightPhase==='rearming')y=.45;if(e.lifted>0)y+=Math.sin(Math.min(e.lifted,1)*Math.PI*.5)*3.2;if(d.kind==='infantry'&&e.moving&&!e.deployed)y+=Math.sin(this.totalTime*14+e.id)*.025;v.y=v.y??y;v.y+=(y-v.y)*(1-Math.exp(-5*dt));y=v.y;let scale=1;if(d.kind==='building'&&this.state.time-e.born<1.2)scale=Math.max(.05,(this.state.time-e.born)/1.2);let tint=e.owner>=0?rgb(this.state.players[e.owner]?.color||R.COLORS[e.owner]):[.55,.54,.43];if(e.invul>0)tint=[.8,.12,.08];if(e.berserk>0)tint=[.98,.69,.13];const alpha=e.ghost?.38:ghost?.45:1;
 this.instance(e.type,M.transform(v.x,y,v.z,v.angle,1,scale,1),tint,alpha);const detailOn=this.quality!=='low'&&this.zoom<(R.ART_PROFILE?.lodZoom||52);if(detailOn&&model.detail)this.instance(e.type+':detail',M.transform(v.x,y,v.z,v.angle,1,scale,1),tint,alpha);if(model.parts)model.parts.forEach((part,i)=>{const [x,py,z]=part.pivot,pitch=e.moving&&!e.deployed?Math.sin(this.totalTime*13+e.id+part.phase)*.52:0;const base=M.transform(v.x+x*Math.cos(v.angle)+z*Math.sin(v.angle),y+py,v.z-x*Math.sin(v.angle)+z*Math.cos(v.angle),v.angle);this.instance(e.type+':part'+i,M.mul(base,M.pitch(pitch)),tint,alpha);});if(e.recentFire>(v.recentFire||0)+.3)v.recoil=.18;v.recentFire=e.recentFire;v.recoil=Math.max(0,(v.recoil||0)-dt*.9);if(model.turret){const angle=model.spin?this.totalTime*(d.model==='helicopter'?22:.5):v.aim;let tx=model.turretX||0,tz=(model.turretZ||0)-(d.kind==='vehicle'?(v.recoil||0):0);this.instance(e.type+':t',M.transform(v.x+tx*Math.cos(v.angle)+tz*Math.sin(v.angle),y+(model.turretY||0),v.z-tx*Math.sin(v.angle)+tz*Math.cos(v.angle),angle),tint,alpha);if(detailOn&&model.turretDetail)this.instance(e.type+':tdetail',M.transform(v.x+tx*Math.cos(v.angle)+tz*Math.sin(v.angle),y+(model.turretY||0),v.z-tx*Math.sin(v.angle)+tz*Math.cos(v.angle),angle),tint,alpha);}
 if(e.moving&&d.kind==='vehicle'&&this.quality!=='low'){for(let i=0;i<2;i++){const phase=(this.totalTime*1.8+e.id*.137+i*.5)%1;this.instance('flame',M.transform(v.x-Math.sin(v.angle)*(1.4+phase),.18+phase*.5,v.z-Math.cos(v.angle)*(1.4+phase),0,.18+phase*.48),[.32,.31,.25],.22*(1-phase));}}
 if(e.deployed&&d.kind==='infantry')this.instance('sandbag',M.transform(v.x,0,v.z),tint);
 if(e.controlledBy){const source=this.state.entities.find(x=>x.id===e.controlledBy);if(source)this.beam(source.x,2,source.z,v.x,1.3,v.z,[.7,.28,.95],.65,.035);}
 if(e.hp<e.maxHp*.4&&!e.ghost&&Math.sin(this.totalTime*5+e.id)>.3){const t=(this.totalTime+e.id)%1;this.instance('flame',M.transform(v.x+.3,y+1.1+t*1.2,v.z,.1,.2+t*.4),[.12,.13,.12],.36*(1-t));}
 const pos=this.project(v.x,y+(d.kind==='building'?d.size*.65:d.kind==='infantry'?2.1:2.9),v.z);this.projections.push({id:e.id,e,x:pos.x,y:pos.y,ground:this.project(v.x,y,v.z),worldX:v.x,worldZ:v.z,depth:pos.depth,radius:Math.max(9,d.size*this.height/(this.zoom*2)*.52)});}
 beam(x,y,z,tx,ty,tz,color,alpha=1,width=.08){const dx=tx-x,dy=ty-y,dz=tz-z,l=Math.hypot(dx,dy,dz)||1;let right=[dz/l,0,-dx/l],rl=Math.hypot(...right)||1;right=right.map(v=>v/rl);let dir=[dx/l,dy/l,dz/l],up=[dir[1]*right[2]-dir[2]*right[1],dir[2]*right[0]-dir[0]*right[2],dir[0]*right[1]-dir[1]*right[0]],s=width/.06;this.instance('beam',new Float32Array([right[0]*s,right[1]*s,right[2]*s,0,up[0]*s,up[1]*s,up[2]*s,0,dx,dy,dz,0,(x+tx)/2,(y+ty)/2,(z+tz)/2,1]),color,alpha);}
 effect(f){let t=f.age/f.life,a=Math.max(0,1-t);if(f.type==='crush'){this.instance('ring',M.transform(f.x,.1,f.z,0,.6+t*2),[.58,.51,.35],a*.48);for(let i=0;i<3;i++)this.instance('flame',M.transform(f.x+Math.sin(i*2)*t,f.age*.5+.2,f.z+Math.cos(i*2)*t,0,.16+t*.3),[.45,.43,.35],a*.36);return;}if(f.type==='shot'){const col=['psi','magnet','chrono'].includes(f.weapon)?[.72,.35,1]:['prism','tesla','laser','sonic'].includes(f.weapon)?[.36,.82,1]:f.weapon==='radiation'?[.48,.95,.22]:[1,.7,.3];if(['rocket','airstrike','missile'].includes(f.weapon)){const xx=f.x+(f.tx-f.x)*t,zz=f.z+(f.tz-f.z)*t,yy=(f.y||1)+(f.ty-f.y)*t+Math.sin(t*Math.PI)*6;this.instance('flame',M.transform(xx,yy,zz,0,.25),[1,.67,.27],1);this.beam(xx,yy,zz,xx-(f.tx-f.x)*.045,yy-.3,zz-(f.tz-f.z)*.045,[.62,.6,.48],a,.16);}else this.beam(f.x,f.y||1.4,f.z,f.tx,f.ty||1.4,f.tz,col,a,f.weapon==='bullet'?.04:.14);return;}
 if(['ready','trained','alert','defeat'].includes(f.type))return;
 let radius=(f.radius||2),color=f.type==='radiation'?[.36,.65,.16]:['psi','dominator','genetic','chrono','chaos'].includes(f.type)?[.66,.32,.95]:f.type==='storm'?[.4,.73,1]:[1,.48,.14];if(['radiation','chrono','psi','chaos','iron','build','capture'].includes(f.type)){this.instance('ring',M.transform(f.x,.09,f.z,0,radius*(.4+t)),color,a*.25);return;}
 if(f.type==='nuke'){this.instance('flame',M.transform(f.x,3+t*15,f.z,0,2+t*11,3+t*4,2+t*11),[.95,.55,.2],a*.75);this.instance('ring',M.transform(f.x,.12,f.z,0,8+t*25),[1,.62,.3],a*.3);}else if(f.type==='storm'){for(let i=0;i<6;i++){let x=f.x+Math.sin(i*17+f.id)*16,z=f.z+Math.cos(i*13+f.id)*16;this.beam(x+2,22,z-2,x,.5,z,[.6,.8,1],a,.23);}}else if(['dominator','genetic'].includes(f.type)){this.instance('ring',M.transform(f.x,.3,f.z,0,8+t*18),color,a*.2);this.instance('flame',M.transform(f.x,6,f.z,0,3+t*10),color,a*.22);}else{this.instance('flame',M.transform(f.x,.7+t*1.8,f.z,0,(.3+t*.7)*radius),color,a*.72);this.instance('ring',M.transform(f.x,.1,f.z,0,(.3+t*1.6)*radius),[.5,.36,.2],a*.18);}}
 updateFog(state){if(state.tick===this.lastFogTick)return;this.lastFogTick=state.tick;const gl=this.gl,data=new Uint8Array(state.fog?.map(v=>v===2?255:v===1?92:0)||Array(4096).fill(255));gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.fog);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,64,64,gl.RED,gl.UNSIGNED_BYTE,data);}
 render(state,dt,selection=new Set(),hover=null,placement=null,selectionRect=null){this.state=state;this.totalTime+=dt;this.frame++;this.fps=this.fps*.94+Math.min(1/Math.max(dt,.001),240)*.06;this.resize();if(this.map!==state.map||this.propSeed!==state.seed)this.generateProps(state.seed,state.map);this.updateFog(state);const gl=this.gl,aspect=this.width/this.height;this.syncCamera();for(const mesh of this.meshes.values())mesh.data=[];this.projections=[];this.instance('ground',M.identity(),[.5,.5,.5]);
 const viewRadius=this.zoom*aspect+35;for(const prop of this.props)if(Math.hypot(prop.x-this.target.x,prop.z-this.target.z)<viewRadius)this.instance(prop.type,M.transform(prop.x,0,prop.z,prop.angle,prop.scale),[.4,.4,.4]);
 for(const o of state.ores){if(o.amount<=0||Math.hypot(o.x-this.target.x,o.z-this.target.z)>viewRadius)continue;for(let i=0;i<20;i++){let a=i*2.399,r=Math.sqrt(i)*.85,x=o.x+Math.cos(a)*r,z=o.z+Math.sin(a)*r;this.instance(o.gem?'gem':'ore',M.transform(x,0,z,a,.5+(i%3)*.23),[.5,.5,.5]);}}
 const activeIds=new Set();for(const e of state.entities){activeIds.add(e.id);if(Math.hypot(e.x-this.target.x,e.z-this.target.z)<viewRadius)this.entity(e,dt);}for(const id of this.cache.keys())if(!activeIds.has(id))this.cache.delete(id);
 if(placement){const d=R.D[placement.type],model=this.getModel(placement.type);const tint=placement.valid?[.27,.92,.45]:[1,.2,.16];this.instance(placement.type,M.transform(placement.x,.1,placement.z),tint,.6);if(model.turret)this.instance(placement.type+':t',M.transform(placement.x,(model.turretY||1)+.1,placement.z),tint,.6);}
 for(const f of state.effects||[])this.effect(f);
 for(const mesh of this.meshes.values()){mesh.instances=mesh.data.length/20;if(mesh.instances){gl.bindBuffer(gl.ARRAY_BUFFER,mesh.ib);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(mesh.data),gl.DYNAMIC_DRAW);}}
 const shadows=this.quality!=='low'&&this.shadowOK;
 if(shadows){gl.bindFramebuffer(gl.FRAMEBUFFER,this.shadowFB);gl.viewport(0,0,this.shadowSize,this.shadowSize);gl.clear(gl.DEPTH_BUFFER_BIT);gl.useProgram(this.depthProgram);gl.uniformMatrix4fv(this.du.VP,false,this.lightVP);gl.uniformMatrix4fv(this.du.Light,false,this.lightVP);gl.disable(gl.BLEND);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1.8,3);for(const [id,m]of this.meshes){if(!m.instances||m.type!==0)continue;gl.bindVertexArray(m.vao);gl.drawArraysInstanced(gl.TRIANGLES,0,m.count,m.instances);}gl.disable(gl.POLYGON_OFFSET_FILL);}
 gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clearColor(.028,.038,.04,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);gl.uniformMatrix4fv(this.u.VP,false,this.cameraVP);gl.uniformMatrix4fv(this.u.Light,false,this.lightVP);gl.uniform1f(this.u.Time,this.totalTime);gl.uniform1f(this.u.UseShadow,shadows?1:0);gl.uniform3fv(this.u.Eye,this.eye);gl.uniform1i(this.u.Biome,state.map==='desert'?2:state.map==='basin'?1:0);gl.uniform1i(this.u.Coast,state.map==='coast'?1:0);gl.uniform1i(this.u.Layout,state.map==='urban'?1:state.map==='fortress'?2:state.map==='valley'?3:0);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.shadowTex);gl.uniform1i(this.u.Shadow,0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.fog);gl.uniform1i(this.u.Fog,1);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
 for(const type of[1,0,2]){gl.uniform1i(this.u.Type,type);if(type===2)gl.depthMask(false);for(const m of this.meshes.values()){if(!m.instances||m.type!==type)continue;gl.bindVertexArray(m.vao);gl.drawArraysInstanced(gl.TRIANGLES,0,m.count,m.instances);}}gl.depthMask(true);gl.bindVertexArray(null);this.drawOverlay(state,selection,hover,placement,selectionRect);this.drawMarkers(state);}
 drawOverlay(state,selected,hover,placement,rect){const c=this.ctx;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,this.width,this.height);const own=state.player;this.drawOperations(state,selected,placement);
 for(const p of this.projections){const e=p.e,d=R.D[e.type];if(p.x<-50||p.x>this.width+50||p.y<-50||p.y>this.height+80||e.ghost)continue;const sel=selected.has(e.id);if(sel||hover===e.id){c.strokeStyle=e.owner===own?'#7fefa2':e.owner<0?'#dbc67b':'#ff6558';c.lineWidth=1.3;c.beginPath();c.ellipse(p.ground.x,p.ground.y,Math.max(9,p.radius),Math.max(4,p.radius*.47),0,0,Math.PI*2);c.stroke();}
 if(this.showHealth||sel||hover===e.id||e.hp<e.maxHp*.98){const w=d.kind==='building'?Math.min(72,p.radius*1.9):Math.min(42,p.radius*1.8+8);c.fillStyle='rgba(4,10,10,.8)';c.fillRect(p.x-w/2-1,p.y-6,w+2,5);c.fillStyle=e.hp/e.maxHp>.6?'#7fc68c':e.hp/e.maxHp>.3?'#d3b65d':'#e36756';c.fillRect(p.x-w/2,p.y-5,w*Math.max(0,e.hp/e.maxHp),3);if(e.rank){c.fillStyle='#eac15c';c.font='10px sans-serif';c.fillText('★'.repeat(e.rank),p.x-w/2,p.y-11);}}
 if(sel&&d.ability==='miner'){c.fillStyle='#daa952';c.fillRect(p.x-14,p.y+1,28*Math.min(1,e.cargo/d.cargoMax),2);}if(e.passengers?.length&&sel){c.fillStyle='#e5c57a';c.font='11px sans-serif';c.fillText('▣ '+e.passengers.length,p.x+12,p.y-10);}}

 if(placement){
     for(const cell of placement.cells||[]) {
         const pts=[[-1,-1],[1,-1],[1,1],[-1,1]].map(a=>this.project(cell.x+a[0],.13,cell.z+a[1]));
         c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();
         c.strokeStyle=cell.valid?'#a9edb0':'#f47567';c.fillStyle=cell.valid?'rgba(94,210,133,.25)':'rgba(239,80,69,.28)';c.lineWidth=1;c.fill();c.stroke();
         if(!cell.valid){const p=this.project(cell.x,.15,cell.z);c.fillStyle='#ffb9a5';c.font='11px sans-serif';c.textAlign='center';c.fillText('×',p.x,p.y+3);}
     }
     const top=this.project(placement.x,3,placement.z);c.textAlign='center';c.font='12px sans-serif';
     const label=placement.w+' × '+placement.h+' 格',width=c.measureText(label).width+16;
     c.fillStyle='#0d1914dc';c.fillRect(top.x-width/2,top.y-18,width,20);c.fillStyle=placement.valid?'#c1eabb':'#ffa896';c.fillText(label,top.x,top.y-4);c.textAlign='left';
 }

 if(rect){c.fillStyle='rgba(105,194,156,.10)';c.strokeStyle='#83cba5';c.lineWidth=1;c.fillRect(rect.x,rect.y,rect.w,rect.h);c.strokeRect(rect.x+.5,rect.y+.5,rect.w,rect.h);}
 }
 drawMarkers(state){
  const c=this.ctx;c.save();const markers=[];if(state.operation&&!state.operation.completed&&!state.operation.failed){const o=state.operation;for(const [i,p]of(o.points||[]).entries()){if(o.rescued?.includes(p.id))continue;const e=state.entities.find(e=>e.id===p.id);markers.push({...p,...(o.id==='escort'&&e?{x:e.x,z:e.z}:{}),radius:5,label:o.id==='escort'?'补给车':'行动目标 '+(i+1),color:'#e5c57f'});}if(o.id==='escort'&&o.route?.[o.waypoint])markers.push({...o.route[o.waypoint],radius:6,label:'下一个路标',color:'#8adbc9'});if(o.extraction)markers.push({...o.extraction,radius:o.extraction.r,label:'撤离区',color:'#8adbc9'});}if(state.mission?.target&&!state.mission.completed)markers.push({...state.mission.target,label:'训练目标',color:'#edd194'});
  const app=R.app;if(app?.pings){app.pings=app.pings.filter(p=>p.expires>performance.now());for(const p of app.pings)markers.push({...p,radius:4,label:'队友标记',color:'#8dd6e0'});}
  for(const m of markers){const p=this.project(m.x,.15,m.z),q=this.project(m.x+(m.radius||5),.15,m.z),radius=Math.max(12,Math.hypot(q.x-p.x,q.y-p.y));c.strokeStyle=m.color;c.lineWidth=1.8;c.setLineDash([7,5]);c.beginPath();c.ellipse(p.x,p.y,radius,radius*.48,0,0,Math.PI*2);c.stroke();c.setLineDash([]);c.font='12px sans-serif';c.textAlign='center';c.fillStyle='#0e1b25c9';c.fillRect(p.x-42,p.y-radius*.5-28,84,22);c.fillStyle=m.color;c.fillText(m.label,p.x,p.y-radius*.5-13);}
  c.restore();
 }
 drawOperations(state,selected,placement) {
     const c=this.ctx,project=(x,z,y=.17)=>this.project(x,y,z),path=(pts,color,dashed=false,labels=false)=>{
         if(!pts.length)return;c.save();c.strokeStyle=color;c.lineWidth=1.5;c.setLineDash(dashed?[6,5]:[]);c.beginPath();
         pts.forEach((p,i)=>{const q=project(p.x,p.z);i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y);});c.stroke();c.setLineDash([]);
         pts.slice(1).forEach((p,i)=>{const q=project(p.x,p.z);c.beginPath();c.arc(q.x,q.y,labels?8:3,0,Math.PI*2);c.fillStyle='#102119e0';c.fill();c.stroke();
             if(labels){c.fillStyle=color;c.font='10px monospace';c.textAlign='center';c.fillText(String(i+1),q.x,q.y+3);}});c.restore();
     };
     if(this.showGrid||placement) {
         const radius=placement?19:Math.min(85,this.zoom*(this.width/this.height)+8),center=placement||this.target;
         const minX=Math.max(0,Math.floor((center.x-radius)/2)),maxX=Math.min(95,Math.ceil((center.x+radius)/2)),minZ=Math.max(0,Math.floor((center.z-radius)/2)),maxZ=Math.min(95,Math.ceil((center.z+radius)/2));
         c.save();c.lineWidth=.65;c.strokeStyle=placement?'rgba(156,189,151,.25)':'rgba(176,201,165,.2)';c.beginPath();
         for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++) {
             if(!state.fog[R.fogIndex(x*2+1,z*2+1)])continue;
             const a=project(x*2,z*2,.08),b=project(x*2+2,z*2,.08),d=project(x*2,z*2+2,.08);
             if(a.x<-80||a.x>this.width+80||a.y<-80||a.y>this.height+80)continue;
             c.moveTo(b.x,b.y);c.lineTo(a.x,a.y);c.lineTo(d.x,d.y);
         }c.stroke();c.restore();
     }
     const units=state.entities.filter(e=>selected.has(e.id)&&e.owner===state.player&&!e.ghost);
     if(placement) {
         c.save();c.strokeStyle='#a9ba7955';c.setLineDash([4,6]);c.lineWidth=1;
         for(const e of state.entities.filter(e=>e.owner===state.player&&R.D[e.type].kind==='building'&&!['wall','civilian','oil'].includes(R.D[e.type].role))) {
             if(Math.hypot(e.x-placement.x,e.z-placement.z)>45)continue;
             c.beginPath();for(let i=0;i<=48;i++){const a=i*Math.PI/24,q=project(e.x+Math.sin(a)*31,e.z+Math.cos(a)*31);i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y);}c.stroke();
         }c.restore();
     }
     if(this.showOrders)units.slice(0,16).forEach((e,index)=>{
         if(e.rally) {
             const points=[e,e.rally,...(e.rallyQueue||[])];path(points,'#e5cb80',true,index===0);
             const q=project(e.rally.x,e.rally.z);c.save();c.strokeStyle='#e6cb7e';c.lineWidth=2;c.beginPath();c.moveTo(q.x,q.y);c.lineTo(q.x,q.y-22);c.stroke();c.fillStyle='#dcc178';c.beginPath();c.moveTo(q.x,q.y-22);c.lineTo(q.x+12,q.y-18);c.lineTo(q.x,q.y-14);c.fill();c.restore();
         }
         if(e.order&&Number.isFinite(e.order.x)&&e.order.type!=='guard') {
             path([e,e.order,...(e.orderQueue||[])],'#9ec7be',false,index===0);
             if(e.order.type==='patrol')path([e.order,{x:e.order.fromX,z:e.order.fromZ}],'#dbbb80',true,false);
         }
     });
     if(this.plan) {
         const first=state.entities.find(e=>e.id===this.plan.ids[0]);
         if(first)path([first,...this.plan.orders],'#ffdc81',true,true);
     }
     for(const e of units) {
         const d=R.D[e.type];if(d.kind!=='building')continue;
         const q=project(e.x,e.z,d.size*.7);c.font='11px sans-serif';c.fillStyle='#f3d477';c.textAlign='center';
         if(state.p.primary?.[d.role]===e.id)c.fillText('★ 主生产',q.x,q.y-16);
         if(e.repairing){c.fillStyle='#a6e2c6';c.fillText('维修中',q.x,q.y-31);}c.textAlign='left';
     }
     if(this.commandMarker&&performance.now()-this.commandMarker.time<800&&Number.isFinite(this.commandMarker.x)) {
         const q=project(this.commandMarker.x,this.commandMarker.z),t=(performance.now()-this.commandMarker.time)/800;
         c.save();c.strokeStyle=this.commandMarker.type==='forceAttack'?'#ff8575':'#f0d29a';c.globalAlpha=1-t;c.lineWidth=2;c.beginPath();c.ellipse(q.x,q.y,9+t*14,5+t*7,0,0,Math.PI*2);c.stroke();c.restore();
     }
 }

 pick(px,py){let best=null,score=1e9;for(const p of this.projections){if(p.e.ghost)continue;const d=R.D[p.e.type],cx=(p.x+p.ground.x)/2,cy=(p.y+p.ground.y)/2,r=Math.max(12,p.radius);const dx=(px-cx)/r,dy=(py-cy)/Math.max(12,(p.ground.y-p.y)/2+r*.3);if(dx*dx+dy*dy<1.5){let s=dx*dx+dy*dy+p.depth*.01;if(s<score){best=p.e;score=s;}}}return best;}
}
R.Renderer=Renderer;R.rgb=rgb;
})(globalThis);
