# 实际测试报告 · 0.3.0 操作增强版

日期：2026-09-05。协议：3。本文只记录已执行的检查，不把功能目标、源码条目数或人工预期写成测试结果。

## 汇总

**87项检查通过：19项基础模拟 + 32项操作机制 + 12项网络 + 9项整页浏览器 + 15项新增交互。**

两个浏览器测试套件的最后一次完整执行均未记录JavaScript异常或WebGL错误。这表示下列测试场景通过，不是对全部单位、全部规则、每种平台或长局稳定性的全面保证。

发行页 `PLAY.html` 的SHA-256：

```
9550a16b4fafc42e5d8c152a125361e5c651d9d68fa478a2802fa0229fff37cb
```

`web/index.html` 与上述文件逐字节相同。完整文件校验表位于根目录 `SHA256SUMS.txt`。

## 环境和方法

- Linux容器，Node.js v22.16.0，CPU：INTEL(R) XEON(R) PLATINUM 8573C。
- Chromium 144，Xvfb显示环境，ANGLE SwiftShader软件WebGL2；没有使用物理RTX4060。
- Playwright把完整发行HTML通过 `set_content` 注入内存页面，未放宽浏览器导航策略。实际执行发行代码、Web Worker、WebGL和WebSocket，不是用静态图替代游戏。
- 操作套件通过确定性沙盒存档准备各个场景，再使用真实鼠标和键盘输入测试；不替换生产、移动、碾压、渲染或命令实现。
- 输入测试等待实际相机矩阵和权威状态就绪。软件图形环境下初始化容许30秒等待；生产暂停测试使用足够长的订单，避免测试工具点击间隔超过订单剩余时间。
- 网络测试使用本机回环地址，包含独立Node WebSocket客户端，以及两个完整浏览器页面。模拟层相同时间步的位置一致性由网络测试校验。

**未测试：Windows启动器实际双击、用户电脑、RTX4060硬件帧率、真实两台电脑的局域网、公网、8名真人、恶劣网络和长时间GPU压力。** 本地自包含HTML的内存页面验证也不等于穷举所有浏览器的 `file://` 存储策略。

## 本轮重点验证结果

碾压通过移动轨迹实际触发，并检查普通坦克、战斗要塞、友军、驻军、无敌和部署重装步兵等代表性例外。不是只增加一个Alt提示文字。

路径点检查了规划时不发送新命令、按顺序执行、Shift追加、停止清队列、撤回/取消、存档继续、服务端同步和隐藏敌方命令。既有旧命令在规划期间继续，不被偷偷暂停。

建造检查统一格子吸附、占地逐格检查、海陆地形、视野、建筑/单位占位、客户端预览和服务端合法场景判定。当前足迹数据来自本工程尺寸，并非已经核实的原版建筑足迹。

生产检查主工厂选择、工厂毁坏回退、集结路线继承、出口堵塞保留订单、双就绪槽、暂停/恢复/退款及连续右键的权威状态处理。

迷雾检查双层回笼、旧建筑记忆、隐藏矿区变化、单层已探索可见、无迷雾仍保留反隐规则，以及房间开局后锁定同一模式。浏览器联机回归也检查两端实际接收双层配置，局内选项禁用。

## 按脚本记录的全部检查

以下标题保留测试脚本中的英文名称，以便逐项复跑定位。PASS只对应该测试覆盖的场景。

### 基础模拟回归：19项

原始结果：`tests/sim-results.json`。

1. PASS · 10 nations and all catalog definitions have finite core data
2. PASS · All nation starts: eight seats, headquarters and worker
3. PASS · Real economy: ore depletion and deposited credits
4. PASS · Production, placement validation and factory spawn
5. PASS · Production cancel refunds exactly before simulation
6. PASS · MCV deployment with no initial headquarters
7. PASS · Ownership enforcement and sandbox authorization
8. PASS · Fog-filtered client state does not expose remote enemy army
9. PASS · Path following actually moves land units
10. PASS · Mind control ownership, controller death and overload
11. PASS · Engineer captures neutral oil and generates income
12. PASS · Neutral garrison, unloading and transport vehicle passengers
13. PASS · Superweapon damages targets and consumes charge
14. PASS · Save/load fixed-state consistency and continuing simulation
15. PASS · Seed determinism: independent eight-seat simulation
16. PASS · Victory and surrender reach a result
17. PASS · Sandbox AI switch and vacant host slot
18. PASS · Every catalog definition can run in an isolated sandbox
19. PASS · Eight-seat 600-second match with finite state and AI combat

### 本轮操作与规则：32项

原始结果：`tests/operations-results.json`。

1. PASS · Normal movement crushes enemy infantry along the swept tank track
2. PASS · Force-move crosses an enemy target instead of stopping to shoot
3. PASS · Crush immunity: allies, garrison, iron curtain and deployed guardian infantry
4. PASS · Battle fortress crushes ordinary vehicles, ordinary tanks do not
5. PASS · Three-node movement plan reaches corners sequentially and drains its queue
6. PASS · Shift-style append preserves active order; normal command replaces the whole route
7. PASS · Stop cancels active movement and every queued waypoint
8. PASS · Invalid plans are rejected atomically, including NaN and more than 64 nodes
9. PASS · Hidden-target IDs and another player units cannot be ordered
10. PASS · Queue plans survive save/load with deterministic continuation
11. PASS · Patrol reverses after reaching its endpoint
12. PASS · Guard engages without chasing enemies outside weapon range
13. PASS · Scatter requires no mouse coordinates and produces finite movement orders
14. PASS · Force-fire can damage a friendly target while normal targeting cannot
15. PASS · Ctrl-style ground fire persists at a point and damages units at that point
16. PASS · Every building footprint snaps to the same 2-world-unit grid
17. PASS · Foundation placement rejects map edges, occupied cells and blocking infantry
18. PASS · Placement checks all cells for land/water and denies unexplored ground
19. PASS · Client preview and authoritative placement agree and share snapped coordinates
20. PASS · Building and defense production may both wait ready without blocking each other
21. PASS · Pause, resume and cancellation preserve progress and refund exact queue cost
22. PASS · Primary factory governs spawning and falls back after destruction
23. PASS · Newly trained units inherit the full factory rally route
24. PASS · Blocked factory exit retains completed purchase until an exit is available
25. PASS · Double fog hides departed enemies, retaining only last-seen building ghosts
26. PASS · Single fog permanently reveals explored terrain and moving enemies there
27. PASS · No-fog reveals all terrain but does not disable stealth detection rules
28. PASS · Snapshot redacts other players orders, paths, targets and rally destinations
29. PASS · Hidden ore depletion does not leak through the double-fog snapshot
30. PASS · Network locks fog and sandbox commands; single-player can change all three modes
31. PASS · Rapid consecutive production right-clicks use server state, not stale client state
32. PASS · Right-click ready building refunds it; shift-right-click also clears matching waiting items

### 权威服务端与网络：12项

原始结果：`tests/network-results.json`。

1. PASS · HTTP /health and offline client served
2. PASS · Two independent clients join one 8-seat room
3. PASS · Non-host cannot start the room
4. PASS · Authoritative start, two humans plus six AI
5. PASS · Foreign unit and sandbox commands rejected
6. PASS · Movement synchronized at matching tick on both clients
7. PASS · Waypoint command acknowledged and synchronized without exposing ally order queue
8. PASS · Room fog mode is authoritative and cannot change after the start
9. PASS · Network stop clears the active command and pending waypoints
10. PASS · Replayed command sequence rejected
11. PASS · Protocol-level token recovery retains seat (no auto-reconnect UI)
12. PASS · Incompatible protocol rejected

### 整页浏览器回归：9项

原始结果：`tests/browser-results.json`。

1. PASS · Full offline HTML initialized, WebGL shader compiled without errors
2. PASS · Single-player Web Worker advances 8-seat simulation
3. PASS · Factory queued in sidebar, placed via mouse, tank trained via production card
4. PASS · Worker save serialization and loaded state resume
5. PASS · Pause stops simulation; resume advances it
6. PASS · All 128 catalog procedural meshes generated and uploaded, one representative rendered without WebGL errors
7. PASS · Yuri sandbox UI generates five selected units
8. PASS · Two full browser clients create/join/ready/start real WebSocket room
9. PASS · No browser JavaScript or WebGL errors recorded

### 新增鼠标与键盘操作：15项

原始结果：`tests/browser-operations-results.json`。

1. PASS · Setup exposes all three fog modes and starts the selected mode in the Worker
2. PASS · F4 cycles and focuses existing factories; K switches the authoritative primary factory
3. PASS · Q/W pick ready buildings; cell preview and actual placement use identical grid snapping
4. PASS · Grid, health and order overlay toggles work; occupied foundations display an invalid preview
5. PASS · Holding Z draws two numbered waypoints without moving; key release submits the real route
6. PASS · Shift-click appends movement and S cancels every pending waypoint
7. PASS · Persistent waypoint tool supports undo, cancel and Enter confirmation
8. PASS · Double-click selects visible same-type units; control groups, double-tap focus and global T selection work
9. PASS · Held-key repeat does not cycle buildings repeatedly; double-click sets primary production
10. PASS · E and Alt+1 initiate GI production; Tanya card pauses, resumes and cancels using real right/left clicks
11. PASS · Attack-move can be issued from the radar minimap
12. PASS · Keyboard settings rebind an actual building shortcut and restore all defaults
13. PASS · Single-player pause menu changes all three fog rules in the simulation, not only in the renderer
14. PASS · Alt plus real world click produces force-movement and crushes enemy infantry in the Worker
15. PASS · Operational UI completed without JavaScript exceptions or WebGL errors

## 连续模拟与模型检查的边界

基础回归运行8席位6000个逻辑步，即600秒游戏时间。该次加速模拟结束时有129个实体、339次击杀，尚未自然结束整场比赛。另有独立投降与胜负状态测试通过。不能把600秒加速模拟描述为10分钟持续实时GPU渲染。

128项模型检查生成并上传了当前目录全部程序化模型，并实际绘制一个代表模型；不表示128个对象的所有动画、特殊机制和网络组合均已逐一验证。本轮操作版没有新完成高精度美术。

## 短时纯模拟基准

这不是FPS测试。场景是八方密集、无敌单位维持数量的合成作战，各100步。没有GPU渲染、网络发送、建筑布局或完整AI经济负担；单视角快照大小也不是实际带宽保证。不同进程负载和运行轮次会影响时间。

| 单位数 | 结束数 | 逻辑步 | 平均每步毫秒 | P95毫秒 | 单视角快照字节 |
| --- | --- | --- | --- | --- | --- |
| 100 | 100 | 100 | 1.008 | 5.075 | 54489 |
| 300 | 300 | 100 | 1.508 | 3.375 | 142918 |
| 600 | 600 | 100 | 2.276 | 3.989 | 275762 |

基准原始时间戳：`2026-09-05T14:04:34.260Z`。结果位于 `tests/benchmark-results.json`。不得换算成用户RTX4060的帧率。

## 发行版实际截图

`screenshots/01_menu.png`：发行主菜单与三种迷雾设置。

`screenshots/02_skirmish.png`：通过右侧生产栏建造战车工厂、实际生产坦克的单机场景。

`screenshots/03_yuri_sandbox.png`：沙盒批量生成精神控制车。

`screenshots/04_grid_placement.png`：格子占地、绿色放置预览与主生产建筑标记。

`screenshots/05_waypoint_planning.png`：按住Z规划两个节点，画面中可见编号路线。

`screenshots/06_hotkeys.png`：实际键位设置页面。

这些图片均来自正在运行的发行HTML，不是参考图或生成式概念图。截图帧率来自软件渲染环境，不代表RTX4060表现。

## 重跑

从完整文件夹根目录运行：

```sh
python tools/build.py
node tests/sim.test.cjs --json
node tests/operations.test.cjs
node tests/network.test.cjs
node tests/benchmark.cjs
python tests/browser_smoke.py
python tests/browser_operations.py
```

模拟与网络测试仅依赖Node标准库；构建只用Python标准库。浏览器测试需要自行安装Playwright、Chromium和可用显示环境，可用 `CHROMIUM` 环境变量指定浏览器路径。这些测试工具不是单机游玩的依赖。两个浏览器套件应串行执行，以免切换焦点干扰按住Z的测试。

## 交付范围

本报告不证明原版1.001规则精准性、全内容完成或任意8方复杂对局无错误。原版差异、未完特殊单位/建筑组合、地形及美术范围见 `KNOWN_DIFFERENCES.md` 和 `OPERATIONS_AUDIT.md`。

版本升级改变了命令与存档结构。0.2.0客户端和存档不兼容0.3.0；请从新目录启动本次完整包。
