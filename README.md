# RedAlertSim

RedAlert3D Command Edition 1.0.0 的 GitHub 发布仓库。

## 首次发布

本仓库包含自动导入、测试、构建和 GitHub Pages 发布流程。**只有工作流成功导入游戏包并完成部署后，游戏网址才可使用。**

1. 在 [Pages 设置](https://github.com/CLRedfield/RedAlertSim/settings/pages) 中，把 **Build and deployment → Source** 设为 **GitHub Actions**。不要选择旧说明里的 Deploy from a branch。
2. 在 [上传文件页面](https://github.com/CLRedfield/RedAlertSim/upload/main) 上传原始 `RedAlert3D_Command_v1.0.0_Full(2).zip`，也可以上传内容相同的 `RedAlertSim-upload.zip`，并提交到 `main`。不用解压，不用上传上百个散文件。
3. 查看 [Actions](https://github.com/CLRedfield/RedAlertSim/actions)。`Import, test and deploy` 会校验压缩包、把完整项目导入 `game/`、运行自动测试、构建并发布。

部署成功后的游戏地址：**https://clredfield.github.io/RedAlertSim/**

如果没有 `game/` 目录，说明游戏本体尚未导入。仅有本 README 或一次空的初始化检查，不代表游戏已经上线。

## 与朋友联机

双方打开同一个游戏网址，进入联机大厅，选择 **公共 MQTT 中转**。房主创建私密房间后点击 **复制网页邀请链接**，朋友打开链接，点击加入、准备，再由房主开始。

也可以复制完整的 `RA1.` 加密邀请口令给朋友，在大厅中粘贴加入。六位内部房间码不能替代公共中转模式的完整邀请。

GitHub Pages 只托管网页；现有游戏代码使用公共 MQTT 节点转发消息，由房主浏览器运行对局模拟。房主必须保持页面和电脑运行，没有主机迁移。公共测试节点不提供长期运营保证，实际连接情况取决于双方网络。默认保留私密房间，不要公开分享邀请。

## 项目结构

- `game/`：导入后保留完整游戏项目，包括源码、测试、文档、程序生成的素材和原有截图。
- `scripts/`：校验导入和静态网页构建脚本。
- `site/`：网页邀请链接适配，不改游戏规则。
- `.github/workflows/`：自动导入、测试和发布。

首次导入只接受指定原始包的 SHA-256：`baf95b95f08674006ad16fedd41b140f2d02f7e983dd0718bc2a7ad1a0d5be36`。导入后的常规更新直接修改 `game/` 源码即可；后续运行不会用旧 ZIP 覆盖源码修改。

## 本地运行

导入后，进入 `game/`，双击 `PLAY.html` 可打开原始离线版。安装 Node.js 22 后，可运行 `npm test` 检查项目，运行 `npm start` 启动本地服务。

本次检查结果与未验证事项见 [VALIDATION.md](VALIDATION.md)。

本仓库是非官方原型。游戏原始许可见导入后的 `game/LICENSE.txt`，不授予任何第三方商标或原作知识产权。
