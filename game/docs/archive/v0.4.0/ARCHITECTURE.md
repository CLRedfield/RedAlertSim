# 工程架构与继续开发

## 运行结构

```
PLAY.html                         独立离线成品，内嵌所有代码 / CSS
web/index.html                    同一构建，房间服务器HTTP入口
web/template.html                 发布HTML模板
web/style.css                     界面样式
web/src/data.js                   数据、国家、科技、地图参数
web/src/sim.js                    无DOM的共享模拟核心
web/src/geometry.js               数学矩阵、程序化网格、模型工厂
web/src/renderer.js               WebGL2、实例渲染、阴影、迷雾、拾取
web/src/app.js                    UI、输入、Worker、音效、存档和网络
server/server.cjs                  Node HTTP / WebSocket权威服务器
tools/build.py                    合并源码为两份发布网页
tests/sim.test.cjs                模拟单元与运行检查
tests/operations.test.cjs         操作机制与规则回归
tests/browser_operations.py       键盘/鼠标/格子/路径/改键检查
tests/network.test.cjs            真实socket房间 / 权限 / 同步测试
tests/browser_smoke.py            完整页面与操作冒烟检查
```

不使用 Babylon.js，也不使用 Three.js。为了本次离线单文件交付而实现原生WebGL2小型渲染层；语言是JavaScript，不是TypeScript。沒有 CDN、构建下载、在线音频或字体依赖。

模拟固定10Hz，渲染按浏览器帧循环插值。浏览器单机将 data.js + sim.js 写入内存Blob Worker。联机Node进程直接加载同一份 data.js + sim.js，客户端只发指令，服务端输出可见快照。

## 主要接口

```javascript
require('./web/src/data.js');
const Sim = require('./web/src/sim.js');
const sim = new Sim({players:8, nation:'yuri', map:'coast'});
sim.command(0, {type:'queue', unit:'y_factory'});
sim.tickStep();
const view = sim.snapshot(0);
const serialized = JSON.stringify(sim.save());
const restored = Sim.load(JSON.parse(serialized));
```

`command()` 返回 `{ok, error?}`。实体id自增，own() / lookup维护所有权。防止客户端直接写位置、资金和伤害。地图是192×192逻辑范围，寻路为96×96网格，视野为64×64采样。

渲染使用正交投影、多部件实例网格、独立炮塔、方向阴影贴图、地形程序化材质。几何由同一网格工厂可重复生成；目前没有外部 glTF 模型管线。

## 构建与测试

```
python tools/build.py
node tests/sim.test.cjs --json
node tests/network.test.cjs
```

浏览器测试另需Python Playwright和Chromium，本包不捆绑测试浏览器。测试使用完整HTML的内存注入，不修改浏览器管理策略。Linux无显示器环境可在自己的测试环境中使用Xvfb；本次测试WebGL使用SwiftShader软件实现，不是RTX4060。

Windows玩离线单机不需要上述开发工具。修改源文件后必须重新build，不能只改了 `web/src` 就期待 `PLAY.html` 自动变化。

## 联机协议摘要

客户端：create / join / ready / start / command / leave / resume。
服务端：welcome / lobby / start / state / commandResult / error / notice。
protocol=3，消息JSON；指令带单调递增seq。创建房间强制sandbox=false；server指定席位，不接受客户端指定任意pid。

当前是完整可见快照同步，尚未做差量压缩、完整延迟插值缓冲、持久化、完整防滥用或8真人压力验证。手写WebSocket帧处理仅覆盖项目需要的有界文本帧，不宣称完整RFC实现。

## 下一轮开发优先顺序

先修复真实试玩反馈，再精确还原规则，而不是继续仅添加图标。请见 NEXT_STEPS.md。

## 0.3.0操作系统

共享data.js导出foundation和placementCheck，客户端预览与服务器放置共用它们。几何网格仅表现，不作为占地规则来源；现有默认占地按模型尺度生成整数格宽。

实体order是当前命令，orderQueue是等待队列；plan在服务端整批验证后应用，append保留旧命令。客户端尚未提交的app.plan不进入模拟；键盘松开或Enter才发送。stop清空当前与等待命令。生产厂用rally/rallyQueue，玩家用primary[role]和readySlots.building/defense。

secondaryProduction由权威模拟解释先暂停再取消，避免双击时用客户端滞后快照重复暂停。place回应id及实际吸附坐标。fogMode单机可切换、联网开局后锁定。snapshot仅发自己的命令状态，并分别处理实时可见单位、静态建筑记忆和矿区记忆。


## 0.4.0本地镜头层

`web/src/camera.js`是独立模块：参数白名单/范围校验、点按与长按状态机、CSS像素到世界位移、时间步滚动、鼠标锚点缩放。`app.js`负责Pointer Events捕获、失焦/取消、界面层阻断、偏好存储与Fullscreen API。`renderer.js`统一syncCamera，避免输入取到上一帧矩阵。

所有镜头操作不进入Sim.command，也不增加网络协议消息。建造/路径/碾压等模拟逻辑与0.3保持同一实现；唯一模拟层调整是显式允许载入结构兼容的0.3存档。协议版本继续为3，发行版本为0.4.0。新模块由tools/build.py内联，用户运行无需安装依赖。
