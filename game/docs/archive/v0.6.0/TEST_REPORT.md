# 发布测试报告 · Command Edition 0.6.0

**144 项 Node 逻辑/网络检查通过，55 项浏览器场景检查通过。合计 199 项。** 这是所列自动化用例结果，不代表报告全部任务已完成，也不是无缺陷保证。

| 测试组 | 通过项 | 结果文件 |
|---|---:|---|
| 基础模拟 | 19 | tests/sim-results.json |
| 生产/操作逻辑 | 32 | tests/operations-results.json |
| 相机数学与状态 | 27 | tests/camera-results.json |
| 新增玩法/录像/存档 | 36 | tests/upgrade-results.json |
| 真实服务端网络 | 30 | tests/network-results.json |
| 浏览器完整页面 | 9 | tests/browser-results.json |
| 浏览器生产与键鼠 | 15 | tests/browser-operations-results.json |
| 浏览器相机与联机 | 22 | tests/browser-camera-results.json |
| 新界面/录像/重连 | 9 | tests/browser-upgrade-results.json |

## 实际运行环境

Node v22.16.0，Linux；Chromium Chromium 144.0.7559.96 built on Debian GNU/Linux 13 (trixie), Xvfb, ANGLE SwiftShader。浏览器真实运行完整内联 HTML、Web Worker、键盘鼠标、文件下载与导入；网络测试运行真实 Node WebSocket 服务器，不是 mock 协议。

浏览器的导航受环境策略限制，因此通过 Playwright set_content 加载完整 HTML，不修改策略、不绕过拦截。单人离线设计不依赖在线素材，但直接 file URL 和 Windows 引导程序仍未在相应用户环境验收。

## 重点覆盖

对角与关闭席位，等分队伍与冲突拦截，等量主矿，六地图布局，奴隶真实采矿，IFV/充能/磁电/炸弹/航空停机位，五训练目标，第一波生存敌军，公平 AI 初始情报，存档恶意字段/方法覆盖拒绝，1200 tick 四人录像精确一致，ACK 增量恢复和视野隔离。

真实网络测试包含建房/加入/准备/开始、八个虚拟客户端、队伍聊天隔离、令牌重连、重复指令与越权拒绝、投降结算/再战、版本不符、过大消息、刷房/刷指令、Origin 拒绝和 WebSocket 文本分片。八客户端均在同一 Linux 主机上运行。

浏览器测试实际执行生产/建造/碾压、Z 与 Shift 路径、编队/快捷键、右键拖图与短按分流、设置/全屏、实际下载录像再导入、暂停/定位/切视角、真实聊天 DOM 转义与断线重连。鼠标帧等待使用状态条件以适应软件渲染，不作为硬件性能基准。

## 回归过程中修复

新 Escape 面板列表引用不存在的节点导致取消失效；右下工具按钮与相机按钮重叠；等分队伍预设仍被旧代码强制变为八人；投降停止模拟后结果未广播；空恢复 token 可错误匹配被释放席位；存档导入可能覆盖模拟方法。对应最终源码和测试已更新。

## 仍未验证

Windows 首次下载/校验/运行及防火墙；实体双机断外网 LAN、多网卡邀请地址；真正八台电脑或国内跨运营商比赛；公网域名/TLS/运维；Docker 镜像构建；浏览器重启存储；RTX 4060 或其他实际 GPU 帧率；极端规模长时间稳定性与第三方安全审计。

## 如何重跑

```sh
python tools/build.py
npm test
xvfb-run -a python tests/browser_smoke.py
xvfb-run -a python tests/browser_operations.py
xvfb-run -a python tests/browser_camera.py
xvfb-run -a python tests/browser_upgrade.py
```

浏览器测试需要另行安装 Playwright、Chromium 与 Xvfb，应用/服务器运行本身不需要这些测试工具。完整原始日志位于 tests/logs/。

## 版本身份

- 内容：`57ef8a2b`
- 规则：`fae04218`
- 地图：`80438c90`
- 共享源码：`55f5d5b56a335b8f4306d606ee72b86b29652808324af5a0122a68cef5f2e2f5`

所有发布文件以根目录 SHA256SUMS.txt 为准。
