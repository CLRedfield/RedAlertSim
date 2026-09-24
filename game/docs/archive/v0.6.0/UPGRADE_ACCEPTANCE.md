# 升级报告逐项交付验收 · 0.6.0

这是报告的 36 项任务对照，而不是“全部已完成”证明。状态同时说明实现范围和测试边界。Node/浏览器最终结果见 TEST_REPORT.md；源文件简称位于 web/src 或 tests 中。

**公网 N02 与跨运营商 N07 未完成，便携运行时 L01 只完成首次下载引导，L02 实体 LAN 未验收。**

| 编号 | 任务 | 状态 | 已交付与剩余 | 证据入口 |
|---|---|---|---|---|
| F01 | 出生映射 | 已实现，局部验证 | 2/4/6/8 自动点位、手动点位、关闭席位、按队伍分组；实体地图长局平衡待测 | data.js; upgrade.test.cjs |
| F02 | 矿区公平性 | 部分完成 | 八候选位置起始矿类型/容量/距离等价；未完成所有采矿路径收益基准 | data.js; upgrade.test.cjs |
| F03 | 队伍合法性 | 已实现并测试 | 没有敌方/重复颜色/重复点位拦截；训练沙盒按模式豁免 | data.js; sim.js; network.test.cjs |
| F04 | 规则与地图标识 | 已实现并测试 | 实际共享源码 SHA-256 派生版本，规则/地图哈希检查 | tools/build.py; network.test.cjs |
| F05 | 恢复统一校验 | 已实现并测试 | 恢复同样验证版本、随机 token、席位、命令序号；空 token 拒绝 | server/server.cjs; network.test.cjs |
| F06 | 配额与攻击面 | 部分完成 | 连接、房间、实体、消息、队列、积压、进程资源模板有保护；无外部审计/全量极限负载验收 | server/server.cjs; sim.js; deploy/ |
| F07 | 断线前端状态 | 已实现并测试 | 连接恢复提示、断线不发命令、不默默切为本地模拟 | net.js; app.js; browser_upgrade.py |
| U01 | 界面分层 | 已实现，范围有限 | 主菜单分区、部署/训练/联机/录像/设置；沿用部分旧暂停和生产 UI，非全面组件化重写 | headquarters.js; command.css |
| U02 | 逐席位配置 | 已实现并测试 | 人类/电脑/关闭、国家/队伍/点位/颜色/难度；房主与自己席位权限限制 | headquarters.js; server/server.cjs |
| U03 | 地图预览 | 已实现 | 六图预览显示真实资源与候选出生点；地形仍是当前平面/海域近似 | data.js; headquarters.js |
| U04 | 生产队列信息 | 部分完成 | 沿用并集成数量、暂停/取消、前置/费用/建造提示；未完成所有单位出口阻塞诊断样式 | app.js; operations.test.cjs |
| U05 | 选择/乘员/状态 | 已实现，边界待扩测 | 分类型选择、逐乘员卸载、IFV/充能/炸弹/飞行状态 | headquarters.js; tactics.js |
| U06 | 警报与反馈 | 部分完成 | 保留事件并增加有界日志、定位与队友标记；不是全量新事件/声音分类系统 | headquarters.js; app.js |
| U07 | 键位与镜头 | 已回归 | 沿用并测试拖图、路径、键位、弹窗和生产快捷键；修复新面板 Escape 空引用 | browser_camera.py; browser_operations.py |
| U08 | 结算与再战 | 已实现并测试 | 统计/曲线/换边、原房重开、投降结果立即刷新 | headquarters.js; network.test.cjs |
| L01 | 便携 LAN 启动器 | 部分完成，Windows 待验收 | 无 npm；使用已有 Node 或首次官方下载校验；未内置二进制，也未验证干净 Windows 离线启动 | tools/launch.ps1 |
| L02 | 真实 LAN 验证 | 未完成 | 只做同机真实进程/浏览器协议；没有实体双机/多网卡断外网 4/8 人记录 | docs/TEST_REPORT.md |
| L03 | 发现/邀请/诊断 | 部分完成 | 复制邀请、地址诊断、目录；无广播发现，多网卡可能需选正确地址 | headquarters.js; server/server.cjs |
| G01 | 状态矩阵 | 已实现，核验待完善 | 129 定义列实现/资产/验证状态；没有完成原版逐项数值与场景对照 | docs/CONTENT_STATUS.json |
| G02 | 阵营机制样板 | 部分完成 | 奴隶/IFV/充能/磁电/伊万/航空有独立状态和测试；不是原版全部例外或全组合联机验收 | tactics.js; upgrade.test.cjs |
| G03 | 独立地图 | 部分完成 | 六图独立资源/中立物/道路；无完整高低地/桥梁；所有人数路径与经济长测未完成 | data.js; renderer.js |
| G04 | 公平 AI 感知 | 部分完成 | 战略目标依据自身可见/记忆，困难奖励披露；旧战斗自动目标等近似仍需核验 | tactics.js; upgrade.test.cjs |
| G05 | 拥堵与混编 | 沿用基础，未专项升级完成 | 保留原寻路、出口等待与混编命令；没有新的全局拥堵恢复方案和极限验证 | sim.js; operations.test.cjs |
| G06 | 五训练/沙盒 | 主要实现 | 五实际行为判定目标，可重开，六波挑战；可保存本地场景，复杂中途恢复未全面验证 | tactics.js; upgrade.test.cjs |
| A01 | 九对象完整样板 | 部分完成 | 九对象程序细节/部分动作；无全套独立图标/PBR/LOD/美术管线 | art.js; renderer.js |
| A02 | 表现事件/音效 | 部分完成 | 后坐、步行、烟尘等；沿用生成音效和事件，未建立全量音频分层 | renderer.js; app.js |
| N01 | 成熟网络层 | 已替换并测试，需安全复核 | ws 8.17.1 随包，无手写帧解析；不是最新依赖或安全审计结论 | server/vendor/; network.test.cjs |
| N02 | 真实公网部署 | 未完成，外部资源依赖 | 无实际中国节点/资源授权/域名/运维承诺；online.json 空，模板未运行 | web/online.json; deploy/README.md |
| N03 | 目录/邀请码/路由 | 部分完成 | 单服务器目录、房间码、私密房；无跨节点路由或全球匹配 | server/server.cjs; headquarters.js |
| N04 | 增量协议 | 主要实现 | ACK 基线、视野先过滤、恢复全量、量化副本；未完成真实公网带宽目标验收 | wire.js; network.test.cjs |
| N05 | 自动重连 UI | 已实现并本机验证 | 两分钟恢复、会话/序号、输入锁、强制全量；系统网络切换待实体测试 | net.js; browser_upgrade.py |
| N06 | 压力/负面测试 | 部分完成 | 畸形/大小/频率/越权/版本/刷房/分片测试；非公网慢连接与极限压力全覆盖 | network.test.cjs |
| N07 | 跨运营商八人 | 未完成 | 八虚拟客户端同机测试不能代替中国跨运营商完整局 | docs/TEST_REPORT.md |
| R01 | 录像/检查点 | 部分完成 | 版本、命令、固定种子回放与 seek；从初始状态重算，非优化检查点系统 | tactics.js; browser_upgrade.py |
| R02 | 观战/合作/挑战 | 部分完成 | 六波挑战、合作队伍校验、回放切视角；没有实时旁观席或延迟观战 | tactics.js; headquarters.js |
| R03 | 批量扩展 | 未完成 | 新增样板机制和程序细节；未完成全量原版机制/资产流水线扩展 | docs/CONTENT_STATUS.md |
