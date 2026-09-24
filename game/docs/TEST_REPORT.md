# 发布测试报告 · Command Edition 1.0.0

记录时间：2026-09-12T11:24:49.886271+00:00。**195项逻辑/协议检查＋69项浏览器检查，共264项通过。** 数量是断言组，不是实体设备数、不同游戏数量或人工整局数量。

|测试组|通过|完成|结果文件|
|---|---:|---|---|
|基础模拟|19|是|tests/sim-results.json|
|生产与操作逻辑|32|是|tests/operations-results.json|
|相机数学/状态|27|是|tests/camera-results.json|
|既有升级机制/录像|36|是|tests/upgrade-results.json|
|六任务/检查点/观战/模型|33|是|tests/release-results.json|
|真实Node房间协议|30|是|tests/network-results.json|
|加密MQTT/八客户端/主机恢复|18|是|tests/mqtt-results.json|
|完整页面/WebGL冒烟|9|是|tests/browser-results.json|
|生产与键鼠操作|15|是|tests/browser-operations-results.json|
|镜头/联机输入|22|是|tests/browser-camera-results.json|
|训练/录像/房间/重连|9|是|tests/browser-upgrade-results.json|
|1.0任务/存档导出/科技/LOD|14|是|tests/browser-release-results.json|

## 实际测试环境

Node 22原生WebSocket/WebCrypto；Linux同机独立MQTT协议服务与真实客户端；MQTT测试加载交付的客户端和房主Worker源代码，worker_threads只作为运行适配。不是公网上的EMQX/Mosquitto服务，未用假加密或假快照替换实际协议。

浏览器为headed Chromium、Xvfb、SwiftShader。环境策略禁止file与localhost导航，故使用in-memory完整HTML，真实WebGL、Blob Worker、鼠标/键盘和下载。没有关闭或绕过环境策略。opaque来源无法使用IndexedDB/WebCrypto：浏览器检查明确验证错误提示与JSON导出，加密功能由独立Node协议测试验证；不能据此声称实体浏览器安全来源持久化已经验收。

browser_release中的无初始快照观战界面使用只读UI夹具；真实30秒延迟、只读权限、恢复和八客户端状态隔离在authority/MQTT协议中验证。任务成功条件使用可重现状态夹具，不等于玩家人工完成六个行动或证明难度平衡。

## 本次新增边界检查

逐客人ECDH密钥、AAD绑定、重放拒绝、篡改密文拒绝、长消息分片、私密房间不进公开目录；八加密客户端独立视野；客人恢复原席位、主机掉线模拟冻结、主机恢复与主动退出通知。

合作任务真实目标、超时失败、基地失败、工程师占领、护送等待与五路标、营救与撤离区敌人阻断；友军任务AI；检查点定位确定性；全部129定义有限网格、116个近景细节层及真实远景省略。

## 合成性能基准

这是CPU模拟测试，不含GPU渲染、真实网络传输。八所有者高密度对抗，保持单位数的测试夹具；每组100tick，模拟10秒。不是实际长局承诺。

|初始单位数|平均每tick ms|P95 ms|一次全量快照字节|
|---:|---:|---:|---:|
|100|1.222|1.697|58768|
|300|1.734|2.792|152267|
|600|4.312|9.403|292561|

处理器：INTEL(R) XEON(R) PLATINUM 8573C。基准原始记录：tests/benchmark-results.json。

## 未取得的验收证据

真实公共节点和国内跨运营商质量、实体Windows首启和双机LAN、稳定来源的IndexedDB跨重启、真实GPU帧率、原版全内容认证、安全审计和长期运营均未验证。没有上线中国专用游戏服务，也没有将“1.0”解释为原报告36项全部完成。

## 重跑

```sh
python tools/build.py
npm test
xvfb-run -a node tests/run-browser.cjs
node tests/benchmark.cjs
node tools/audit-content.cjs
python tools/release-report.py
```

浏览器回归需要本机Python Playwright与Chromium；串行执行以减少软件渲染争用。正常游玩不需要这些开发依赖。日志位于tests/logs/，构建身份与结果文件哈希在tests/RELEASE_SUMMARY.json。
