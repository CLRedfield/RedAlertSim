# 升级报告逐项交付对照 · 1.0.0

本版将0.8的合作/观战/回放内容与1.0整合交付。36项原报告任务逐项保留状态，不以版本号代替验收。用户新增的公共MQTT方案已实现，但它不等于原报告的“中国专用服务器实际部署”。

**已实现公共节点客户端、浏览器房主与加密协议；没有进行真实公共节点跨网验收，也没有部署中国专用服务。** 实体LAN、Windows首启和全部原版资产/机制认证仍有明确剩余范围。

|编号|任务|本版状态|交付范围与剩余|证据入口|
|---|---|---|---|---|
|F01|出生映射|已实现，局部验证|2/4/6/8 自动点位、手动点位、关闭席位、按队伍分组；实体地图长局平衡待测|data.js; upgrade.test.cjs|
|F02|矿区公平性|部分完成|八候选位置起始矿类型/容量/距离等价；未完成所有采矿路径收益基准|data.js; upgrade.test.cjs|
|F03|队伍合法性|已实现并测试|没有敌方/重复颜色/重复点位拦截；训练沙盒按模式豁免|data.js; sim.js; network.test.cjs|
|F04|规则与地图标识|已实现并测试|协议5，规范化数据与实际共享模拟、任务、权威房间、MQTT源码共同构建SHA-256身份；所有参与者需使用同一发布包|tools/build.py; network.test.cjs; mqtt.test.cjs|
|F05|恢复统一校验|已实现并本机测试|LAN与MQTT复用随机恢复凭据、版本检查和命令序号；观察者单独恢复；房主中转断线暂停并恢复原席位|authority.js; mqtt-room.js; release.test.cjs; mqtt.test.cjs|
|F06|配额与攻击面|已实现边界，未外部审计|共享16KB命令限制、频率/席位权限、MQTT分片/解压/积压边界与加密重放检查；不是完整安全认证|authority.js; mqtt-wire.js; mqtt-room.js; SECURITY.md|
|F07|断线前端状态|已实现并测试|连接恢复提示、断线不发命令、不默默切为本地模拟|net.js; app.js; browser_upgrade.py|
|U01|界面分层|已实现|八区指挥中心；新增合作行动、连接方式、私密口令、观战缓冲、科技树、现场存档和行动记录；保留原有战斗输入|release-ui.js; release.css; browser_release.py|
|U02|逐席位配置|已实现并测试|人类/电脑/关闭、国家/队伍/点位/颜色/难度；房主与自己席位权限限制|headquarters.js; server/server.cjs|
|U03|地图预览|已实现|六图预览显示真实资源与候选出生点；地形仍是当前平面/海域近似|data.js; headquarters.js|
|U04|生产队列信息|部分完成|沿用并集成数量、暂停/取消、前置/费用/建造提示；未完成所有单位出口阻塞诊断样式|app.js; operations.test.cjs|
|U05|选择/乘员/状态|已实现，组合边界仍待扩测|分类型选择、独立乘员卸载和状态延续；只读观察者不显示可执行操作，任务HUD显示真实目标进度|headquarters.js; release-ui.js; tactics.js|
|U06|警报与反馈|部分完成|保留事件并增加有界日志、定位与队友标记；不是全量新事件/声音分类系统|headquarters.js; app.js|
|U07|键位与镜头|已回归|沿用并测试拖图、路径、键位、弹窗和生产快捷键；修复新面板 Escape 空引用|browser_camera.py; browser_operations.py|
|U08|结算与再战|已实现并测试|统计/曲线/换边、原房重开、投降结果立即刷新|headquarters.js; network.test.cjs|
|L01|便携 LAN 启动器|部分完成，Windows 待验收|无 npm；使用已有 Node 或首次官方下载校验；未内置二进制，也未验证干净 Windows 离线启动|tools/launch.ps1|
|L02|真实 LAN 验证|未完成|只做同机真实进程/浏览器协议；没有实体双机/多网卡断外网 4/8 人记录|docs/TEST_REPORT.md|
|L03|发现/邀请/诊断|已实现邀请与诊断，非广播发现|LAN链接、MQTT完整加密邀请、节点选择、握手/订阅诊断与房间目录；无LAN广播发现|release-ui.js; mqtt-room.js; NETWORK_MQTT.md|
|G01|状态矩阵|已实现内容表，非原版认证|129实体按实际代码导出属性、前置、116个细节层与网格预算；原版逐项行为对照仍未完成|CONTENT_STATUS.json; tools/audit-content.cjs|
|G02|阵营机制样板|部分完成|奴隶/IFV/充能/磁电/伊万/航空有独立状态和测试；不是原版全部例外或全组合联机验收|tactics.js; upgrade.test.cjs|
|G03|独立地图|部分完成|六图独立资源/中立物/道路；无完整高低地/桥梁；所有人数路径与经济长测未完成|data.js; renderer.js|
|G04|公平 AI 感知|改进并专项验证|延续侦察/记忆AI；友军会跟随护送、占点、营救与攻坚，保留生产维修；工程师接近公开目标后仍需看见才能捕获|operations.js; release.test.cjs|
|G05|拥堵与混编|新增停滞恢复，未极限验收|停滞超过约2秒清理路径缓存重算，不传送单位；大型混编与全部地形的拥堵边界仍待实战|operations.js; operations.test.cjs|
|G06|五训练/沙盒|主要实现|五实际行为判定目标，可重开，六波挑战；可保存本地场景，复杂中途恢复未全面验证|tactics.js; upgrade.test.cjs|
|A01|九对象完整样板|扩展程序化细节与LOD|九基准模型延续；116实体新增独立细节层，中高画质近景显示、低画质或远景省略；非全套PBR/独立图标/原版高精度重制|art-expanded.js; renderer.js; release.test.cjs; browser_release.py|
|A02|表现事件/音效|部分完成|后坐、步行、烟尘等；沿用生成音效和事件，未建立全量音频分层|renderer.js; app.js|
|N01|成熟网络层|双传输实现并测试，需安全复核|LAN延续ws 8.17.1；新增原生MQTT3.1.1 QoS0/1子集，无外部前端SDK，使用WSS与应用层独立加密通道|mqtt-wire.js; mqtt.test.cjs; SECURITY.md|
|N02|真实公网部署|按新需求完成公共中转接入；真实公网未验收|默认EMQX及用户候选地址，浏览器房主运行共享规则。不是部署国内专用服务，不保证节点可达或持续可用；测试为独立本机MQTT服务|mqtt-room.js; NETWORK_MQTT.md; mqtt.test.cjs|
|N03|目录/邀请码/路由|已实现单节点目录与私密邀请|仅明确公开时发布目录；RA1口令绑定节点、房间密钥、主机公钥；不支持跨节点统一匹配或全网搜索|mqtt-room.js; release-ui.js; mqtt.test.cjs|
|N04|增量协议|已实现并本机测试|视野过滤后ACK增量；MQTT增加压缩、加密、有界分片；拥堵丢弃冗余状态并请求重同步，实际跨网带宽目标未验收|wire.js; mqtt-room.js; mqtt.test.cjs|
|N05|自动重连 UI|已实现本机恢复|访客保留原席位恢复；主机中转掉线暂停模拟、重连恢复；主动主机退出通知访客。关闭主机页面不能无缝迁移|mqtt-room.js; net.js; mqtt.test.cjs|
|N06|压力/负面测试|扩大负面/八客户端测试，非生产压测|身份、越权、重放、密文损坏、大消息、八加密客户端、主机故障和延迟观战；未做公网恶意流量审计|release.test.cjs; mqtt.test.cjs; network.test.cjs|
|N07|跨运营商八人|未完成|八虚拟客户端同机测试不能代替中国跨运营商完整局|docs/TEST_REPORT.md|
|R01|录像/检查点|已实现检查点录像|v2录像按60秒保存检查点，最多12个且8MB预算；按最近检查点定位，保留命令记录；同内容版本确定性验证|operations.js; release.test.cjs; browser_upgrade.py|
|R02|观战/合作/挑战|已实现六合作任务与实时延迟观察|六任务有真实胜负条件、友军AI、单人/双人入口；最多4观察者，30秒模拟时间延迟、只读、禁向参战者聊天|operations.js; authority.js; release-ui.js; release.test.cjs; mqtt.test.cjs|
|R03|批量扩展|已扩展程序化资产与任务管线；非全部原版完成|116细节层通过有限网格预算，六任务共用模拟/存档/回放/联机；仍有原版机制例外、海陆地形、美术精度与全组合验证缺口|art-expanded.js; operations.js; CONTENT_STATUS.json|

`已实现`表示代码存在且按列明范围检查；测试数量、实际环境和未验收项以TEST_REPORT.md为准。旧版矩阵归档于archive/v0.6.0，不应当作本版现状。
