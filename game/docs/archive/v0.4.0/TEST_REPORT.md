# 实际测试报告 · 0.4.0 镜头与手感版

发行版本0.4.0，战斗协议3。测试执行时间以各JSON原始记录为准，容器UTC时钟记录在2026-09-05。本报告从本次实际运行结果汇总，不把旧版报告直接改名当新测试。

## 汇总

**136项检查通过：19基础模拟 + 32操作机制 + 12网络 + 27镜头单元检查 + 9整页功能 + 15原有交互 + 22新镜头交互。**

最后完整执行的三个浏览器套件均无记录到的JavaScript异常或WebGL错误。检查总数不是覆盖率，也不是原版1.001精确还原认证。没有宣称在所有硬件、所有单位组合或公网条件下无问题。

发行页 `PLAY.html` 的SHA-256：

```
a909a4ed142a3a1a3024ad038ff92fe1b2cea87cbc92ab7c350f8aa885db0e2f
```

`web/index.html`与它逐字节相同。根目录SHA256SUMS.txt给出完整文件校验，不包含校验表自身。

## 环境与方法

Node.js v22.16.0，Linux容器，AMD EPYC 9V74 80-Core Processor。Chromium 144.0.7559.96，Xvfb显示环境、ANGLE SwiftShader软件WebGL2，没有使用RTX4060。

浏览器通过Playwright `set_content`载入完整发行HTML，实际运行其中的Web Worker、WebGL、Pointer Events、键盘、Fullscreen API和WebSocket。没有用截图替代可运行游戏，也没有把核心规则替换成测试假实现。输入场景通过合法沙盒存档准备有限实体，再使用实际鼠标和键盘驱动界面；少数取消/失焦容错事件明确标注为synthetic。

容器导航策略拒绝直接打开file://，没有关闭或绕过该策略；因此**完整HTML内存页面测试不等于已在Windows双击HTML实测**。相机偏好在同页退出并开启新局后保留已测，浏览器跨刷新localStorage持久化未测；不可存储时的提示路径可正常工作。

网络使用同一机器回环连接，覆盖独立Node WebSocket客户端和两个完整浏览器客户端。镜头测试检查房主拖图后，本地目标坐标改变、网络命令序号不变、客人镜头不变。

**未测：Windows三个旧启动器与新START_DESKTOP.bat实机双击、用户RTX4060、真正两台电脑的局域网、公网、8名真人、恶劣网络与长时间GPU压力。** 新桌面启动器做静态审查，不是已实测的原生EXE。截图里的FPS来自软件渲染，不能映射到用户显卡。

## 本轮重点结论

长按右键或明显拖动可以平移镜头；长按不动也不会在松手时误下令。短按保留经典取消与现代移动；中键继续工作。拖图不取消就绪建筑、不提交未完成路径、不清空当前选择。释放到侧栏、失焦、捕获丢失、弹窗和窗口尺寸变化都有输入清理。

持续滚屏在鼠标固定偏移时仍继续，释放后立即停；边缘滚动使用真实战场边界，底部HUD不再遮住下边缘。滚轮缩放保留鼠标锚点，侧栏滚动不缩放地图。Home/End和全屏入口通过实际键盘/按钮检查。

0.3的碾压、路径、建造、生产、迷雾与联机检查重新运行通过。原0.3代码生成的真实存档夹具可导入新版本并继续模拟，保存为0.4；0.2仍拒绝。

测试开发中发生过相机重构遗漏aspect局部变量，已修复；新联机夹具最初两名真人合作且没有敌人，开局立刻结算导致镜头被结果弹窗阻止，改为自由混战后通过。早期中断和瞬态超时没有计入最终通过数。最终汇总仅使用末次完整脚本结果。

## 全部检查名称

以下名称保留英文，便于从代码定位。

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

### 原有操作机制回归：32项

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

### 镜头数学、手势与兼容性：27项

原始结果：`tests/camera-results.json`。

1. PASS · Camera preferences reject invalid fields, clamp limits and keep defaults
2. PASS · Short right click with small jitter remains a click and does not pan
3. PASS · Long stationary right hold consumes release without moving the camera
4. PASS · Fast deliberate drag promotes before the hold timer elapses
5. PASS · Grab moves the projected ground by the exact CSS pointer displacement
6. PASS · Many pointer moves add up without repeatedly applying the same delta
7. PASS · Drag sensitivity and inverted grab direction apply exactly once
8. PASS · Disabling right dragging restores stationary long-click behavior
9. PASS · Middle drag is immediate even with right dragging disabled
10. PASS · Left selection gestures suppress keys and edges without panning
11. PASS · Continuous-scroll mode keeps moving while pointer stays displaced
12. PASS · Continuous scroll dead zone stops, and releasing adds no drift
13. PASS · Edge scroll respects dwell delay and strength at the playable boundary
14. PASS · HUD hover, outside coordinates and disabled edge scroll do not pan
15. PASS · Fullscreen-only edge setting is enforced
16. PASS · Bottom edge is actionable with a point just inside the canvas
17. PASS · Diagonal keyboard speed is normalized and Shift accelerates
18. PASS · Camera travel is frame-rate independent at 30 and 120 updates per second
19. PASS · Smooth start still stops immediately when the direction is released
20. PASS · Ground under the mouse stays anchored throughout smooth zoom
21. PASS · Center zoom option does not move the camera target
22. PASS · Wheel pixel, line and page modes convert to the same intended distance
23. PASS · Rapid wheel bursts respect zoom and map boundaries
24. PASS · Blur/modal cancellation releases gesture and pending wheel animation
25. PASS · Focus and reset zoom cancel pending motion and sync picking matrices
26. PASS · Camera clamps target at world boundaries without NaN
27. PASS · Current and original v0.3.0 save fixtures load and resave as v0.4.0

### 完整网页功能回归：9项

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

### 原有键鼠交互回归：15项

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

### 新镜头与实际浏览器交互：22项

原始结果：`tests/browser-camera-results.json`。

1. PASS · Held right drag pans real rendered battlefield; release preserves selection and sends no command
2. PASS · Short right click retains classic deselection
3. PASS · Modern short right click moves units; held drag does not generate an extra move
4. PASS · Long stationary hold is consumed safely, without moving or deselecting
5. PASS · Fast deliberate right drag works without waiting for the hold timer
6. PASS · Dragging preserves ready-building placement; a subsequent short right click cancels it
7. PASS · Right drag retains unsubmitted Z waypoints; Z release still submits exactly the planned route
8. PASS · Continuous-scroll preset keeps panning at fixed pointer offset and stops immediately on release
9. PASS · Actual settings controls alter drag direction and sensitivity
10. PASS · Middle-button drag remains immediate with right-button dragging disabled
11. PASS · Edge scroll uses the playable edge and stops while pointer is over production sidebar
12. PASS · Bottom edge is no longer hidden behind HUD, and hovering bottom controls stops edge panning
13. PASS · Arrow movement stops on key release; Home focuses selection and End resets zoom
14. PASS · Actual wheel zoom preserves the world point under the cursor during smooth zoom
15. PASS · Scrolling the production list does not zoom the map or scroll the document
16. PASS · Pointer capture lets a battlefield drag end over UI without click-through or production orders
17. PASS · Synthetic pointercancel/blur and real capture release safely clear dragging without a stale click
18. PASS · Opening a modal mid-gesture safely stops camera input and does not cancel selected units
19. PASS · Trackpad preset and local preferences survive leaving and starting another match in the same page
20. PASS · Real fullscreen button enters/exits fullscreen and camera matrices remain valid
21. PASS · Two real browser clients: right-drag changes only local camera and emits zero network commands
22. PASS · Camera UI and multiplayer integration produce no JavaScript or WebGL errors

## 复跑

```
node tests/sim.test.cjs --json
node tests/operations.test.cjs
node tests/network.test.cjs
node tests/camera.test.cjs
python tests/browser_smoke.py
python tests/browser_operations.py
python tests/browser_camera.py
```

Linux无桌面环境可在Python命令前加 `xvfb-run -a`。浏览器测试需要自行安装Playwright、Chromium和显示环境，测试参数只用于该测试环境；这些不是玩家运行游戏的依赖，更不应抄入游戏启动器关闭浏览器安全功能。

浏览器套件请串行运行，避免两个软件渲染进程争用资源使短暂的队列状态检查失去意义。当前目录下保留本次JSON；上一版报告和旧模拟基准只在docs/archive中作为历史记录，本轮没有重新宣称那些基准是当前GPU性能。

## 实际截图

`screenshots/07_right_drag.png`：真实按住右键拖图中的战场，显示手势原点和松手不下令提示。

`screenshots/08_camera_settings.png`：实际镜头与手感设置面板，包含两种模式、灵敏度、边缘、缩放和全屏。

截图来自完整发行HTML运行，不是生成式效果图。
