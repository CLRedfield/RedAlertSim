# 资产与依赖来源

## 原创 / 沿用上传包

三维网格、基础图标、地图材料与音效由本项目 JavaScript 程序生成。0.6.0在0.4.0上增加样板细节；1.0.0新增art-expanded.js，为116实体提供可独立省略的细节层。没有复制原版游戏安装文件、图片素材、角色语音或歌曲，没有打包系统字体。

## ws

`server/vendor/ws.cjs` 固定为 ws 8.17.1，来源为环境中已安装 Playwright 的第三方 ws 构建闭包，提取必要 CommonJS 模块供无 npm 的运行时使用。`server/vendor/LICENSE-ws.txt` 包含原 MIT 许可证。功能测试包含文本分片、二进制拒绝、过大帧和房间协议；这不是外部安全审计。该版本不宣称最新，公开上线前必须审查安全公告并升级/重新验证。规范上游： https://github.com/websockets/ws 。

## Windows Node 下载

启动器只在没有合适本地 Node 时下载官方 Node 22.22.3 Windows 便携包。二进制没有预先包含在本 ZIP 中。固定版本不是“最新 Node”。校验来源： https://nodejs.org/en/blog/release/v22.22.3 。

| 文件 | SHA-256 |
|---|---|
| node-v22.22.3-win-x64.zip | 6c8d54f635feff4df76c2ca80f45332eb2ff57d25226edce36592e51a177ee33 |
| node-v22.22.3-win-arm64.zip | 00be129a09e8872cd52d3bb8bba12412c5733d2224123a482a2dca4a6fbf2586 |

下载并验证后复制 node.exe 和该发行包 LICENSE 至 runtime，临时下载目录清理。不执行 npm install，不修改系统 PATH。网络不可达或校验失败会停止，不切换到不明镜像。实体 Windows 执行未验证。

## 开发测试工具

浏览器测试需要外部安装 Python Playwright、Chromium 和可用显示环境。容器部署模板引用官方 Node 镜像与 Caddy 镜像，但镜像未随包分发，部署模板未实际执行。本包本身无需联网下载字体、贴图或前端库才能单人游玩。

## 1.0 MQTT实现

mqtt-wire.js与mqtt-room.js为本项目新增原生实现，未打包MQTT.js、Paho或外部加密SDK。使用浏览器/Node内置WebSocket、WebCrypto与压缩流。MQTT3.1.1规范参考：https://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html 。这不是完整MQTT标准认证。
