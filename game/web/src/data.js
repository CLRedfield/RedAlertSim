/* Red Alert 3D Web: original procedural prototype. Gameplay values are provisional, not a verified 1.001 ruleset. */
(function(G){'use strict';
const R=G.RA=G.RA||{};
R.VERSION='1.0.0';R.PROTOCOL=5;R.BUILD='command-100';R.SOURCE_HASH='ccc8fae2b854b750fd82dba0da7a89e9be66a92884683da24df9c578f329f623';R.SIZE=192;R.STEP=0.1;
R.COLORS=['#e34343','#53a9f4','#f6c84e','#b17beb','#58c892','#f18449','#61d7d7','#df8cbf'];
R.NATIONS=[
{id:'usa',name:'美国',faction:'allies',flag:'US',special:'空降伞兵',desc:'盟军科技 · 空军指挥部解锁伞兵支援'},
{id:'uk',name:'英国',faction:'allies',flag:'UK',special:'狙击手',desc:'远距离精确清除敌方步兵'},
{id:'france',name:'法国',faction:'allies',flag:'FR',special:'巨炮',desc:'重型远程基地防御'},
{id:'germany',name:'德国',faction:'allies',flag:'DE',special:'坦克杀手',desc:'专门对付装甲目标的自行反坦克炮'},
{id:'korea',name:'韩国',faction:'allies',flag:'KR',special:'黑鹰战机',desc:'更强的空中精确打击'},
{id:'russia',name:'苏俄',faction:'soviet',flag:'RU',special:'磁能坦克',desc:'移动式磁暴武器'},
{id:'iraq',name:'伊拉克',faction:'soviet',flag:'IQ',special:'辐射工兵',desc:'部署后制造持续辐射区域'},
{id:'cuba',name:'古巴',faction:'soviet',flag:'CU',special:'恐怖分子',desc:'接近目标后实施自爆'},
{id:'libya',name:'利比亚',faction:'soviet',flag:'LY',special:'自爆卡车',desc:'大范围爆破与辐射污染'},
{id:'yuri',name:'尤里',faction:'yuri',flag:'Ψ',special:'心灵控制',desc:'奴隶采矿、心灵控制与异质科技'}];
R.FACTIONS={allies:{name:'盟军',abbr:'ALLIED',theme:'#76c5e9',hq:'a_hq',power:'a_power',barracks:'a_barracks',refinery:'a_refinery',factory:'a_factory',radar:'a_airfield',tech:'a_tech',naval:'a_naval',tank:'grizzly',inf:'gi',miner:'chrono_miner'},soviet:{name:'苏军',abbr:'SOVIET',theme:'#e96056',hq:'s_hq',power:'s_power',barracks:'s_barracks',refinery:'s_refinery',factory:'s_factory',radar:'s_radar',tech:'s_tech',naval:'s_naval',tank:'rhino',inf:'conscript',miner:'war_miner'},yuri:{name:'尤里',abbr:'PSYCHIC',theme:'#bc90e8',hq:'y_hq',power:'y_power',barracks:'y_barracks',refinery:'y_refinery',factory:'y_factory',radar:'y_radar',tech:'y_tech',naval:'y_naval',tank:'lasher',inf:'initiate',miner:'slave_miner'}};
R.MAPS=[
 {id:'valley',name:'双线矿谷',en:'TWIN VEIN',desc:'双侧绕行 · 等价主矿 · 争夺中央宝石',water:false,biome:'temperate',recommended:'2人 / 2v2',tag:'侧翼 / 经济',layout:'valley'},
 {id:'urban',name:'工业交叉口',en:'IRON CROSSING',desc:'驻军街区 · 四座油井 · 步兵争夺路口',water:false,biome:'industrial',recommended:'2–4人',tag:'驻军 / 巷战',layout:'urban'},
 {id:'coast',name:'海岸前线',en:'COASTAL FRONT',desc:'环形海域 · 双侧油田 · 海陆协同',water:true,biome:'temperate',recommended:'4–8人',tag:'海军 / 包抄',layout:'coast'},
 {id:'desert',name:'四角荒原',en:'RED WASTELAND',desc:'分散副矿 · 四角扩张 · 宽阔装甲路线',water:false,biome:'desert',recommended:'4人混战',tag:'扩张 / 混战',layout:'desert'},
 {id:'fortress',name:'双堡垒',en:'TWIN FORTRESS',desc:'两翼绕行 · 驻军防线 · 团队纵深',water:false,biome:'temperate',recommended:'2v2 / 4v4',tag:'团队 / 防守',layout:'fortress'},
 {id:'basin',name:'开放盆地',en:'ASHEN BASIN',desc:'雪地开阔战线 · 六处争夺矿 · 多向交战',water:false,biome:'winter',recommended:'6–8人',tag:'机动 / 大规模',layout:'basin'}
];
// Clockwise rotational symmetry; seat identity is independent of starting location.
R.SPAWNS=[[34,154],[24,96],[38,34],[96,24],[158,38],[168,96],[154,158],[96,168]];
R.getMap=id=>R.MAPS.find(m=>m.id===id)||R.MAPS[0];
R.spawnOrder=count=>count===2?[0,4]:count<=4?[0,2,4,6]:count<=6?[0,2,3,4,6,7]:[0,1,2,3,4,5,6,7];
R.defaultSlots=(count,nation='usa',teams='ffa',network=false)=>Array.from({length:count},(_,i)=>({
 kind:i===0?'human':'ai',human:i===0,nation:i===0?nation:R.NATIONS[(i*3+1)%10].id,
 name:i===0?'指挥官':'电脑 '+i,team:teams==='coop'?(i===0?0:1):teams==='4v4'?(i<Math.ceil(count/2)?0:1):i,
 color:i,spawn:-1,difficulty:'normal'
}));
R.resolveSlots=config=>{
 const count=Math.max(2,Math.min(8,Math.floor(+config.players)||8));
 return Array.from({length:count},(_,i)=>{
  const input=config.slots?.[i], d=R.defaultSlots(count,config.nation,config.teams)[i], slot={...d,...(input||{})};
  if(input&&!input.kind)slot.kind=input.closed?'closed':input.human?'human':'ai';
  slot.difficulty=input?.difficulty||config.difficulty||'normal';
  slot.human=slot.kind==='human';slot.closed=slot.kind==='closed';
  // Explicit teams win. Old saves without explicit teams retain their preset semantics.
  if(!Number.isInteger(input?.team))slot.team=config.teams==='coop'?(slot.human?0:1):config.teams==='4v4'?(i<Math.ceil(count/2)?0:1):i;
  slot.team=Math.max(0,Math.min(7,Math.floor(slot.team)));slot.color=Number.isInteger(slot.color)?Math.max(0,Math.min(7,slot.color)):i;
  slot.spawn=Number.isInteger(slot.spawn)&&slot.spawn>=0&&slot.spawn<8?slot.spawn:-1;
  return slot;
 });
};
R.validateSetup=(cfg,allowEmptyHuman=false)=>{
 const slots=R.resolveSlots(cfg), active=slots.filter(s=>!s.closed), errors=[];
 if(active.length<2&&!cfg.sandbox&&!cfg.training)errors.push('至少需要两个有效参战席位');
 if(new Set(active.map(s=>s.team)).size<2&&!cfg.sandbox&&!cfg.training)errors.push('没有敌对队伍：请添加敌方电脑或更改队伍');
 const colors=active.map(s=>s.color);if(new Set(colors).size!==colors.length)errors.push('玩家颜色不能重复');
 const explicit=active.filter(s=>s.spawn>=0).map(s=>s.spawn);if(new Set(explicit).size!==explicit.length)errors.push('出生位置不能重复');
 if(!allowEmptyHuman&&slots[0]?.closed)errors.push('本地指挥官的席位不能关闭');
 return {ok:errors.length===0,error:errors.join("；"),errors};
};
R.allocateSpawns=slots=>{
 const active=slots.map((s,i)=>({...s,seat:i})).filter(s=>!s.closed), order=R.spawnOrder(active.length), used=new Set(active.filter(s=>s.spawn>=0).map(s=>s.spawn)), result={};
 for(const s of active)if(s.spawn>=0)result[s.seat]=s.spawn;
 let fallback=[...order,...Array.from({length:8},(_,i)=>i)].filter((x,i,a)=>a.indexOf(x)===i);
 const automatic=[...active].sort((a,b)=>a.team-b.team||a.seat-b.seat);
 for(const s of automatic)if(s.spawn<0){const n=fallback.find(i=>!used.has(i));result[s.seat]=n;used.add(n);}
 return result;
};
R.mapObjects=id=>{
 const ores=[],neutrals=[];const ore=(x,z,amount=42000,gem=false)=>ores.push({x,z,amount,gem}),building=(type,x,z)=>neutrals.push({type,x,z});
 // Equal type, volume and rotated distance for every possible starting site.
 for(let i=0;i<8;i++){
  const [x,z]=R.SPAWNS[i],dx=96-x,dz=96-z,l=Math.hypot(dx,dz),ux=dx/l,uz=dz/l;
  ore(x+ux*22-uz*4,z+uz*22+ux*4,36000,false);
  ore(x+ux*28+uz*4,z+uz*28-ux*4,36000,false);
 }
 if(id==='valley'){
  for(const [x,z] of [[79,79],[113,113]])ore(x,z,65000,true);
  for(const [x,z] of [[60,115],[132,77],[77,60],[115,132]])ore(x,z,38000);
  for(const [x,z] of [[64,92],[128,100]])building('oil',x,z);
  for(const [x,z] of [[87,93],[105,99],[99,87],[93,105]])building('civ_building',x,z);
 }else if(id==='urban'){
  for(const [x,z] of [[66,96],[126,96],[96,66],[96,126]])building('oil',x,z);
  for(const x of [78,90,102,114])for(const z of [78,90,102,114])if((x+z)%24===12)building('civ_building',x,z);
  for(const [x,z] of [[60,60],[132,132],[132,60],[60,132]])ore(x,z,50000,true);
 }else if(id==='coast'){
  for(const [x,z] of [[88,88],[104,104]])ore(x,z,65000,true);
  for(const [x,z] of [[48,96],[144,96],[96,48],[96,144]])building('oil',x,z);
  for(const [x,z] of [[70,75],[122,117],[75,122],[117,70]])building('civ_building',x,z);
 }else if(id==='desert'){
  for(const [x,z] of [[62,62],[130,130],[62,130],[130,62]])ore(x,z,55000,true);
  for(const [x,z] of [[85,96],[107,96]])building('oil',x,z);
  for(const [x,z] of [[96,80],[96,112]])building('civ_building',x,z);
 }else if(id==='fortress'){
  for(const z of [65,80,112,127])for(const x of [76,116])building('civ_building',x,z);
  for(const [x,z] of [[96,48],[96,144]])building('oil',x,z);
  for(const [x,z] of [[60,96],[132,96]])ore(x,z,65000,true);
 }else{
  for(let i=0;i<6;i++){const a=i*Math.PI/3;ore(96+Math.cos(a)*29,96+Math.sin(a)*29,42000,i%2===0);}
  for(const [x,z] of [[96,87],[96,105]])building('oil',x,z);
 }
 return {ores:ores.map((o,i)=>({...o,id:i+1})),neutrals};
};
R.D={};
function b(id,name,faction,role,cost,hp,power,opts={}){R.D[id]={id,name,faction,role,cost,hp,power,kind:'building',category:role==='defense'||role==='super'?'defense':'building',size:5.4,range:0,damage:0,cooldown:1.4,sight:22,armor:'building',buildTime:Math.max(5,cost/100),requires:[],model:role,...opts};}
function u(id,name,faction,kind,cost,hp,speed,damage,range,opts={}){R.D[id]={id,name,faction,kind,cost,hp,speed,damage,range,power:0,category:kind==='infantry'?'infantry':'vehicle',size:kind==='infantry'?.8:2.5,cooldown:1.5,sight:kind==='air'?30:21,armor:kind==='infantry'?'infantry':kind==='air'?'air':'heavy',weapon:'cannon',buildTime:Math.max(3,cost/90),requires:[],model:kind==='infantry'?'soldier':'tank',...opts};}
for(const f of ['allies','soviet','yuri']){const a=f==='allies'?'a':f==='soviet'?'s':'y';const F=R.FACTIONS[f];
 b(a+'_hq','建造场',f,'hq',3000,3000,0,{size:8,sight:29,description:'基地核心。提供建筑生产和附近建造范围。'});
 b(a+'_power',f==='allies'?'发电厂':f==='soviet'?'磁能反应炉':'生化反应炉',f,'power',f==='yuri'?600:800,750,f==='yuri'?180:200,{requires:['hq'],size:4.8,capacity:f==='yuri'?5:0,description:f==='yuri'?'提供电力。可装入步兵提高发电量。':'为基地建筑提供电力。'});
 b(a+'_barracks',f==='soviet'?'苏军兵营':f==='yuri'?'尤里兵营':'盟军兵营',f,'barracks',500,900,-10,{requires:['power'],description:'训练步兵，设置集结点后自动前往。'});
 b(a+'_refinery',f==='yuri'?'奴隶采矿站':'矿石精炼厂',f,'refinery',f==='yuri'?1500:2000,1200,-30,{requires:['power'],size:7,description:f==='yuri'?'最多管理五名独立奴隶矿工。矿工采集、返矿；矿站被毁后可以获得自由。':'交付一辆采矿车。矿车自动采集矿石并卸矿。'});
 b(a+'_factory',f==='yuri'?'战车工厂':'战车工厂',f,'factory',2000,1800,-25,{requires:['refinery','barracks'],size:7.2,description:'生产装甲车辆与基地车。'});
 b(F.radar,f==='allies'?'空军指挥部':f==='soviet'?'雷达':'心灵探测器',f,f==='allies'?'airfield':'radar',1000,1000,-50,{requires:['refinery'],size:6,description:'解锁雷达小地图及中级科技。盟军飞机在此补给。'});
 b(a+'_tech',f==='yuri'?'作战实验室':'作战实验室',f,'tech',2000,1100,-100,{requires:['factory','radar'],size:6.3,description:'解锁高级武器、单位和超级武器。'});
 b(a+'_naval',f==='yuri'?'尤里船坞':'造船厂',f,'naval',1000,1600,-25,{requires:['refinery'],size:7,water:true,description:'必须放置在海面，生产海军。'});
 b(a+'_wall','围墙',f,'wall',100,700,0,{size:2,requires:['hq'],buildTime:1.5,description:'阻碍地面通行，使用出售工具拆除。'});
}
b('a_repair','维修厂','allies','repair',800,1000,-25,{requires:['factory'],description:'自动维修附近载具，维修消耗资金。'});
b('s_repair','维修厂','soviet','repair',800,1000,-25,{requires:['factory']});
b('a_pillbox','机枪碉堡','allies','defense',500,800,0,{requires:['barracks'],size:3,weapon:'bullet',range:15,damage:24,cooldown:.65});
b('s_sentry','哨戒炮','soviet','defense',500,800,0,{requires:['barracks'],size:3,weapon:'bullet',range:15,damage:24,cooldown:.65});
b('a_patriot','爱国者飞弹','allies','defense',1000,900,-50,{requires:['barracks'],size:3.5,weapon:'missile',range:28,damage:85,aa:true,airOnly:true});
b('s_flak','防空炮','soviet','defense',1000,900,-50,{requires:['barracks'],size:3.5,weapon:'flak',range:26,damage:50,aa:true,airOnly:true,cooldown:.75});
b('a_prism','光棱塔','allies','defense',1500,1100,-75,{requires:['radar'],weapon:'prism',range:24,damage:125});
b('s_tesla','磁暴线圈','soviet','defense',1500,1100,-75,{requires:['radar'],weapon:'tesla',range:23,damage:150,cooldown:2});
b('y_gattling','盖特机炮','yuri','defense',1000,1000,-50,{requires:['barracks'],weapon:'gattling',range:22,damage:27,cooldown:.36,aa:true});
b('y_psychic','心灵控制塔','yuri','defense',1500,950,-100,{requires:['radar'],weapon:'psi',range:22,damage:0,control:3,cooldown:3});
b('s_bunker','战斗碉堡','soviet','defense',500,1200,0,{requires:['barracks'],size:4,capacity:5,range:21,damage:0,weapon:'bullet'});
b('y_bunker','坦克碉堡','yuri','defense',400,1300,0,{requires:['barracks'],size:4.5,capacity:1,vehicleBunker:true,range:24,damage:0,weapon:'cannon'});
b('a_grand','巨炮','allies','defense',2000,1500,-100,{requires:['radar'],nation:'france',size:5,weapon:'cannon',range:40,damage:210,cooldown:3.6,splash:5});
b('a_gap','裂缝产生器','allies','gap',1000,800,-100,{requires:['tech'],size:4,description:'遮蔽附近单位，敌军靠近才重新发现。'});
b('a_satellite','间谍卫星','allies','satellite',1500,1100,-100,{requires:['tech'],description:'电力正常时揭示全地图。'});
b('a_purifier','矿石精炼器','allies','purifier',2500,1300,-200,{requires:['tech'],size:6,description:'提高己方卸矿收入25%。'});
b('a_robot','控制中心','allies','robotcontrol',600,900,-100,{requires:['factory'],description:'为遥控坦克提供操作信号，失电后遥控坦克停机。'});
b('s_nuclear','核子反应炉','soviet','power',1000,1500,1800,{requires:['tech'],size:6,model:'nuclear',deathBlast:18});
b('s_industry','工业工厂','soviet','industry',2500,1700,-200,{requires:['tech'],size:7,description:'载具生产价格降低25%。'});
b('y_grinder','部队回收厂','yuri','grinder',600,1200,-50,{requires:['factory'],description:'将己方单位送入以回收75%造价。'});
b('y_clone','复制中心','yuri','cloner',2500,1200,-200,{requires:['tech'],description:'兵营完成步兵训练时额外复制一个单位。'});
b('a_weather','天气控制仪','allies','super',5000,1600,-200,{requires:['tech'],size:6,super:'storm',charge:180,description:'充能后在目标区域引发闪电风暴。'});
b('a_chrono','超时空传送仪','allies','super',2500,1300,-150,{requires:['tech'],super:'chrono',charge:120,description:'选中己方地面单位后，点击能力和目标位置传送。'});
b('s_nuke','核弹发射井','soviet','super',5000,1700,-200,{requires:['tech'],size:6,super:'nuke',charge:180});
b('s_iron','铁幕装置','soviet','super',2500,1300,-150,{requires:['tech'],super:'iron',charge:120,description:'使目标区域内己方载具与建筑短暂无敌。'});
b('y_dominator','心灵控制器','yuri','super',5000,1500,-200,{requires:['tech'],size:6,super:'dominator',charge:180});
b('y_genetic','基因突变器','yuri','super',2500,1300,-150,{requires:['tech'],super:'genetic',charge:120});
// Allied units
u('gi','美国大兵','allies','infantry',200,125,4.3,18,12,{weapon:'bullet',cooldown:.8,deploy:'sandbag',description:'反步兵。按D部署沙袋，增加射程与防护。'});
u('ggi','重装大兵','allies','infantry',400,150,3.7,32,13,{weapon:'missile',deploy:'guardian',aa:true,description:'部署后使用反装甲导弹，可对空。'});
u('a_engineer','工程师','allies','infantry',500,90,4,0,1.5,{ability:'engineer',model:'engineer',description:'指令进入敌方或中立建筑可占领，进入受损友军建筑可维修。'});
u('a_dog','警犬','allies','infantry',200,100,8,150,2,{weapon:'bite',model:'dog',infOnly:true,detector:true,cooldown:1});
u('rocketeer','火箭飞行兵','allies','air',600,160,7,22,15,{requires:['radar'],weapon:'bullet',aa:true,model:'jetpack',cooldown:.6});
u('spy','间谍','allies','infantry',1000,100,4.7,0,1.5,{requires:['tech'],ability:'spy',model:'spy',stealth:true});
u('seal','海豹部队','allies','infantry',1000,220,5.2,60,15,{requires:['tech'],weapon:'bullet',amphibious:true,commando:true,model:'commando',cooldown:.55});
u('tanya','谭雅','allies','infantry',1500,350,5.8,85,16,{requires:['tech'],weapon:'bullet',amphibious:true,commando:true,hero:true,model:'commando',cooldown:.4,immune:true});
u('chrono_legion','超时空军团兵','allies','infantry',1500,180,6.5,55,17,{requires:['tech'],weapon:'chrono',teleport:true,immune:true,model:'chrono'});
u('sniper','狙击手','allies','infantry',600,120,4.3,250,32,{nation:'uk',requires:['radar'],weapon:'bullet',infOnly:true,model:'sniper',cooldown:2.2});
u('grizzly','灰熊坦克','allies','vehicle',700,400,7,55,18,{model:'grizzly'});
u('ifv','多功能步兵车','allies','vehicle',600,300,8.8,42,20,{weapon:'missile',aa:true,capacity:1,model:'ifv',description:'载入1名步兵可切换武器；工程师上车后成为维修车。'});
u('chrono_miner','超时空采矿车','allies','vehicle',1400,1100,5.5,0,0,{ability:'miner',cargoMax:600,chronoReturn:true,model:'miner',immune:true});
u('prism_tank','光棱坦克','allies','vehicle',1200,320,5.2,115,29,{requires:['tech'],weapon:'prism',splash:3,cooldown:2.2,model:'prism'});
u('mirage','幻影坦克','allies','vehicle',1000,320,6.4,90,22,{requires:['tech'],weapon:'heat',stealth:true,model:'mirage'});
u('battlefortress','战斗要塞','allies','vehicle',2000,1500,3.7,22,20,{requires:['tech'],weapon:'bullet',capacity:5,fireports:true,model:'fortress',size:4,crush:true});
u('robot_tank','遥控坦克','allies','vehicle',600,300,8,48,18,{requires:['robotcontrol'],amphibious:true,robot:true,immune:true,model:'robot'});
u('tank_destroyer','坦克杀手','allies','vehicle',900,480,5.5,135,23,{nation:'germany',weapon:'ap',model:'destroyer_tank',cooldown:2});
u('a_mcv','盟军基地车','allies','vehicle',3000,1600,3.8,0,0,{requires:['tech'],ability:'mcv',size:4,model:'mcv',immune:true});
u('harrier','入侵者战机','allies','air',1200,250,16,170,23,{requires:['radar'],producer:'airfield',weapon:'missile',model:'jet',ammo:3,cooldown:1.5});
u('black_eagle','黑鹰战机','allies','air',1200,360,17,245,24,{requires:['radar'],nation:'korea',producer:'airfield',weapon:'missile',model:'eagle',ammo:3,cooldown:1.5});
u('a_transport','盟军两栖运输艇','allies','ship',900,1000,6.3,0,0,{amphibious:true,capacity:12,model:'hovercraft',size:4});
u('destroyer','驱逐舰','allies','ship',1000,900,6,85,27,{weapon:'cannon',aa:true,model:'destroyer_ship',size:4.5});
u('aegis','神盾巡洋舰','allies','ship',1200,1000,5.8,80,40,{weapon:'missile',aa:true,airOnly:true,model:'aegis',cooldown:.6,size:4.5});
u('carrier','航空母舰','allies','ship',2000,1500,4,200,58,{requires:['tech'],weapon:'airstrike',model:'carrier',cooldown:4,size:6});
u('dolphin','海豚','allies','ship',500,200,8.3,65,18,{weapon:'sonic',model:'dolphin',navalOnly:true,immune:true});
// Soviet units
u('conscript','动员兵','soviet','infantry',100,125,4.2,17,12,{weapon:'bullet',cooldown:.85});
u('s_engineer','工程师','soviet','infantry',500,90,4,0,1.5,{ability:'engineer',model:'engineer'});
u('s_dog','警犬','soviet','infantry',200,100,8,150,2,{weapon:'bite',model:'dog',infOnly:true,detector:true,cooldown:1});
u('flak_trooper','防空步兵','soviet','infantry',300,140,4,30,19,{weapon:'flak',aa:true,cooldown:.9,model:'flak_soldier'});
u('tesla_trooper','磁暴步兵','soviet','infantry',500,230,3.4,90,15,{weapon:'tesla',model:'tesla_soldier',immune:true});
u('ivan','疯狂伊文','soviet','infantry',600,180,4.7,220,6,{requires:['radar'],weapon:'bomb',splash:4,cooldown:4,model:'ivan'});
u('boris','鲍里斯','soviet','infantry',1500,400,5.4,95,18,{requires:['tech'],hero:true,commando:true,weapon:'bullet',cooldown:.5,model:'commando',immune:true});
u('desolator','辐射工兵','soviet','infantry',600,250,3.5,110,15,{requires:['radar'],nation:'iraq',weapon:'radiation',deploy:'radiation',model:'desolator',immune:true});
u('terrorist','恐怖分子','soviet','infantry',200,100,5,280,2.2,{nation:'cuba',weapon:'bomb',suicide:true,splash:5,model:'ivan'});
u('rhino','犀牛坦克','soviet','vehicle',900,600,6,80,19,{model:'rhino'});
u('flak_track','防空履带车','soviet','vehicle',500,350,8,24,19,{weapon:'flak',aa:true,capacity:5,cooldown:.55,model:'flak_track'});
u('war_miner','武装采矿车','soviet','vehicle',1400,1400,4.6,28,16,{ability:'miner',cargoMax:1000,weapon:'bullet',model:'miner',immune:true});
u('terror_drone','恐怖机器人','soviet','vehicle',500,160,11,42,2,{ability:'infect',weapon:'bite',model:'spider',immune:true,cooldown:.55,size:1.5});
u('v3','V3火箭发射车','soviet','vehicle',800,300,4.5,200,45,{requires:['radar'],weapon:'rocket',splash:5,cooldown:5,model:'v3'});
u('apocalypse','天启坦克','soviet','vehicle',1750,1500,3.8,160,23,{requires:['tech'],aa:true,model:'apocalypse',size:3.4,cooldown:2.3,regen:3});
u('tesla_tank','磁能坦克','soviet','vehicle',1200,600,5.5,140,20,{nation:'russia',requires:['radar'],weapon:'tesla',model:'tesla_tank'});
u('demo_truck','自爆卡车','soviet','vehicle',1500,400,5.8,650,3,{nation:'libya',requires:['radar'],weapon:'bomb',suicide:true,splash:12,radiation:true,model:'demo_truck'});
u('s_mcv','苏军基地车','soviet','vehicle',3000,1800,3.5,0,0,{requires:['tech'],ability:'mcv',size:4,model:'mcv',immune:true});
u('kirov','基洛夫空艇','soviet','air',2000,2200,2.4,200,9,{requires:['tech'],weapon:'bomb',splash:5,cooldown:1.5,model:'kirov',size:5.5,immune:true});
u('siege_chopper','武装直升机','soviet','air',1400,450,9,36,19,{requires:['radar'],weapon:'bullet',deploy:'siege',model:'helicopter',cooldown:.55});
u('s_transport','苏军两栖运输艇','soviet','ship',900,1000,6.3,0,0,{amphibious:true,capacity:12,model:'hovercraft',size:4});
u('typhoon','台风潜艇','soviet','ship',1000,800,6,100,26,{weapon:'torpedo',navalOnly:true,stealth:true,model:'sub',size:4});
u('sea_scorpion','海蝎','soviet','ship',600,600,8,36,25,{weapon:'flak',aa:true,model:'scorpion',cooldown:.6,size:3.4});
u('dreadnought','无畏级战舰','soviet','ship',2000,1700,4,320,62,{requires:['tech'],weapon:'rocket',splash:6,model:'dreadnought',cooldown:5,size:6});
u('squid','巨型乌贼','soviet','ship',1000,650,7.5,85,5,{weapon:'sonic',navalOnly:true,model:'squid',immune:true});
// Yuri units
u('initiate','尤里新兵','yuri','infantry',200,130,4.2,27,13,{weapon:'heat',model:'initiate',cooldown:.9});
u('y_engineer','工程师','yuri','infantry',500,90,4,0,1.5,{ability:'engineer',model:'engineer'});
u('brute','狂兽人','yuri','infantry',500,550,5.2,115,2.5,{weapon:'punch',immune:true,model:'brute',size:1.5});
u('virus','病毒狙击手','yuri','infantry',700,150,4.4,180,30,{requires:['radar'],weapon:'toxin',infOnly:true,model:'sniper',cooldown:2.3,splash:2.5});
u('yuri_clone','尤里复制人','yuri','infantry',800,160,3.9,0,19,{requires:['radar'],weapon:'psi',control:1,immune:true,model:'psychic',cooldown:2.5});
u('yuri_prime','尤里X','yuri','infantry',1500,300,5.3,0,26,{requires:['tech'],weapon:'psi',control:1,controlBuilding:true,amphibious:true,hero:true,immune:true,model:'prime',cooldown:3});
u('lasher','狂风坦克','yuri','vehicle',700,420,7,58,18,{model:'lasher'});
u('gattling_tank','盖特机炮坦克','yuri','vehicle',600,360,7,21,20,{weapon:'gattling',aa:true,cooldown:.4,model:'gattling'});
u('slave_miner','奴隶矿场','yuri','vehicle',1500,1500,4,22,16,{ability:'miner',cargoMax:800,selfMine:true,weapon:'bullet',model:'slave_miner',deploy:'mining',immune:true});
u('magnetron','磁电坦克','yuri','vehicle',1000,380,4.8,70,31,{requires:['radar'],weapon:'magnet',model:'magnetron',cooldown:2,description:'对载具施加抬升与牵引，对建筑造成伤害。'});
u('mastermind','精神控制车','yuri','vehicle',1750,1200,4.2,0,23,{requires:['tech'],weapon:'psi',control:3,overload:true,immune:true,model:'mastermind',cooldown:2.2});
u('chaos_drone','神经突击车','yuri','vehicle',1000,350,7,0,9,{requires:['radar'],weapon:'chaos',immune:true,model:'chaos',cooldown:4});
u('y_mcv','尤里基地车','yuri','vehicle',3000,1700,3.6,0,0,{requires:['tech'],ability:'mcv',size:4,model:'mcv',immune:true});
u('floating_disc','镭射幽浮','yuri','air',1750,900,6.8,100,22,{requires:['tech'],weapon:'laser',aa:true,model:'disc',immune:true,description:'激光攻击，可暂时压制敌方发电设施。'});
u('y_transport','尤里两栖运输艇','yuri','ship',900,1000,6.3,0,0,{amphibious:true,capacity:12,model:'hovercraft',size:4});
u('boomer','雷鸣潜艇','yuri','ship',2000,1300,5.5,220,52,{weapon:'rocket',model:'boomer',stealth:true,cooldown:3.2,splash:4,size:5});
// Explicit sandbox-only additions, not secretly mixed into normal build lists.
u('chrono_commando','超时空突击队','allies','infantry',2000,300,6,100,19,{sandboxOnly:true,weapon:'bullet',commando:true,teleport:true,model:'commando'});
u('chrono_ivan','超时空伊文','soviet','infantry',1750,200,6,300,8,{sandboxOnly:true,weapon:'bomb',teleport:true,splash:5,model:'ivan'});
u('psi_commando','心灵突击队','yuri','infantry',2000,250,5,0,24,{sandboxOnly:true,weapon:'psi',control:1,commando:true,immune:true,model:'psychic'});
u('trex','暴龙','neutral','vehicle',3000,3000,4.8,250,4,{sandboxOnly:true,weapon:'punch',model:'trex',size:5,immune:true});
u('civ_bus','巴士','neutral','vehicle',400,500,6,0,0,{sandboxOnly:true,model:'bus',capacity:10});
b('oil','科技钻油井','neutral','oil',0,1500,0,{size:5,category:'neutral',description:'工程师占领后持续获得资金。'});
b('civ_building','可驻军建筑','neutral','civilian',0,1700,0,{size:6,capacity:6,range:24,damage:0,weapon:'bullet',category:'neutral'});
R.SUPERS={nuke:{name:'核弹打击',symbol:'☢'},storm:{name:'闪电风暴',symbol:'ϟ'},iron:{name:'铁幕防护',symbol:'◈'},chrono:{name:'超时空传送',symbol:'⌁'},dominator:{name:'心灵支配',symbol:'Ψ'},genetic:{name:'基因突变',symbol:'✣'},paradrop:{name:'伞兵支援',symbol:'↓'}};
R.nation=id=>R.NATIONS.find(n=>n.id===id)||R.NATIONS[0];
R.onWater=(map,x,z)=>map==='coast'&&(x<18||x>174||z<18||z>174);
R.available=(d,p)=>!d.sandboxOnly&&d.faction===p.faction&&(!d.nation||d.nation===p.nation)&&d.kind!=='building'&&!['hornet'].includes(d.id);
R.defs=()=>Object.values(R.D);

// Version 0.3: explicit operational metadata, shared by preview and authority.
// Cell dimensions are this 3D project's dimensions, not verified original INI foundations.
R.CELL = 2;
R.FOG_MODES = {double:'双层：黑幕 + 回笼迷雾', single:'单层：探索后持续可见', none:'无迷雾：全图可见'};
R.PRODUCER_ROLES = ['barracks','factory','airfield','naval','cloner'];
for (const d of Object.values(R.D)) {
    if (d.kind === 'building') d.footprint = [Math.ceil(d.size / R.CELL), Math.ceil(d.size / R.CELL)];
    d.crusher = 0;
    d.crushResistance = d.kind === 'infantry' ? 0 : d.kind === 'vehicle' ? 1 : 99;
}
for (const id of ['grizzly','prism_tank','mirage','tank_destroyer','chrono_miner','rhino','apocalypse','tesla_tank','war_miner','lasher','magnetron','gattling_tank','mastermind','slave_miner','a_mcv','s_mcv','y_mcv']) {
    if(R.D[id]) R.D[id].crusher = 1;
}
R.D.battlefortress.crusher = 2;
for (const id of ['brute','tesla_trooper','desolator']) if(R.D[id]) R.D[id].crushResistance = 99;
for (const id of ['battlefortress','a_mcv','s_mcv','y_mcv','trex']) if(R.D[id]) R.D[id].crushResistance = 99;
R.D.ggi.deployedCrushProof = true;
R.fogIndex = (x,z) => Math.max(0,Math.min(63,Math.floor(z/3)))*64 + Math.max(0,Math.min(63,Math.floor(x/3)));
R.foundation = function(d,x,z) {
    const [w,h] = d.footprint || [1,1], cell = R.CELL;
    const gx = Math.round(x/cell-w/2), gz = Math.round(z/cell-h/2);
    return {x:(gx+w/2)*cell,z:(gz+h/2)*cell,gx,gz,w,h,
        left:gx*cell,top:gz*cell,right:(gx+w)*cell,bottom:(gz+h)*cell};
};
R.placementCheck = function(context,d,x,z,options={}) {
    if(!Number.isFinite(x)||!Number.isFinite(z)) return {valid:false,reason:'无效建造坐标',cells:[]};
    const f=R.foundation(d,x,z), entities=context.entities||[], pid=context.player;
    const baseOK=options.noBase || entities.some(e=>e.hp>0&&e.owner===pid&&e.id!==options.ignore&&R.D[e.type].kind==='building'&&!['wall','civilian','oil'].includes(R.D[e.type].role)&&Math.hypot(e.x-f.x,e.z-f.z)<31);
    const cells=[];let first='';
    for(let zc=f.gz;zc<f.gz+f.h;zc++) for(let xc=f.gx;xc<f.gx+f.w;xc++) {
        const cx=(xc+.5)*R.CELL,cz=(zc+.5)*R.CELL;
        let reason='';
        if(xc<0||zc<0||xc>=96||zc>=96) reason='建筑占地超出地图';
        else if(context.fog&&!context.fog[R.fogIndex(cx,cz)]) reason='需要先探索这片区域';
        else if(!!d.water !== R.onWater(context.map,cx,cz)) reason=d.water?'船坞必须完整位于水面':'建筑占地不能跨越水面';
        else for(const e of entities) {
            if(e.id===options.ignore||e.hp<=0||e.inside||R.D[e.type].kind==='air'&&!e.deployed) continue;
            const ed=R.D[e.type];
            if(ed.kind==='building') {
                const ef=R.foundation(ed,e.x,e.z);
                if(xc>=ef.gx&&xc<ef.gx+ef.w&&zc>=ef.gz&&zc<ef.gz+ef.h) {reason='与已有建筑占地重叠';break;}
            } else {
                const nx=Math.max(xc*2,Math.min(xc*2+2,e.x)),nz=Math.max(zc*2,Math.min(zc*2+2,e.z));
                if(Math.hypot(nx-e.x,nz-e.z)<Math.max(.28,ed.size*.35)) {reason='有地面单位占据建造位置';break;}
            }
        }
        if(!reason&&!baseOK) reason='超出己方基地建造范围';
        if(reason&&!first) first=reason;
        cells.push({x:cx,z:cz,valid:!reason,reason});
    }
    return {...f,type:d.id,valid:!first,reason:first||'可以建造',cells};
};
R.DEFAULT_HOTKEYS = {
    focusSelection:'Home', resetZoom:'End',
    buildings:'KeyQ',defenses:'KeyW',infantry:'KeyE',vehicles:'KeyR',base:'KeyH',
    yard:'F2',barracks:'F3',factory:'F4',airfield:'F5',naval:'F6',tech:'F7',
    attackMove:'KeyA',move:'KeyM',stop:'KeyS',deploy:'KeyD',unload:'KeyU',scatter:'KeyX',
    guard:'KeyG',patrol:'KeyJ',waypoints:'KeyZ',same:'KeyT',combatUnits:'KeyP',
    repair:'KeyC',sell:'KeyV',rally:'KeyL',primary:'KeyK',grid:'F9',health:'F10',orders:'F8'
};
R.HOTKEY_NAMES = {
    focusSelection:'镜头定位所选单位', resetZoom:'恢复默认缩放',
    buildings:'建筑栏 / 拿起已就绪建筑',defenses:'防御栏 / 拿起已就绪防御',infantry:'步兵栏',vehicles:'载具栏',
    base:'选中并定位建造场',yard:'循环选建造场',barracks:'循环选兵营',factory:'循环选战车工厂',
    airfield:'循环选机场 / 雷达',naval:'循环选船坞',tech:'循环选实验室',attackMove:'攻击移动',move:'移动',
    stop:'停止并清空路径',deploy:'部署 / 展开',unload:'卸载',scatter:'散开',guard:'驻守警戒',
    patrol:'往返巡逻（扩展）',waypoints:'按住规划路径，松开发送',same:'同类选择 / 双按全图同类',
    combatUnits:'屏幕内作战部队',repair:'维修模式',sell:'出售模式',rally:'集结点',primary:'设为主生产建筑',
    grid:'显示 / 隐藏地面方格',health:'显示 / 隐藏全部血条',orders:'显示 / 隐藏命令连线'
};

// Expanded prototype unit; slave economy is simulated, not cosmetic income.
R.D.y_slave={...R.D.initiate,id:'y_slave',name:'奴隶矿工',cost:0,hp:90,speed:4.8,damage:0,range:0,weapon:'bullet',size:.75,model:'engineer',ability:'slave',sandboxOnly:true,requires:[],description:'独立采矿与搬运。采矿站被摧毁后解除奴役。',crusher:0,crushResistance:0};
R.hashText=text=>{let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return(h>>>0).toString(16).padStart(8,'0');};
R.RULES_HASH=R.hashText(JSON.stringify(R.D)+R.SOURCE_HASH+':tactics060:4');
R.MAP_HASH=R.hashText(JSON.stringify(R.MAPS.map(m=>[m.id,R.mapObjects(m.id)]))+JSON.stringify(R.SPAWNS));
R.CONTENT_HASH=R.hashText(R.VERSION+R.RULES_HASH+R.MAP_HASH);
R.CONTENT_STATUS=R.defs().map(d=>({id:d.id,name:d.name,production:d.sandboxOnly?'沙盒专属':'可生产（原型规则）',mechanics:'基础模拟，未完成原作逐值对照',art:'原创程序化三维',network:'权威模拟，按视野过滤'}));
if(typeof module!=='undefined')module.exports=R;
})(globalThis);
