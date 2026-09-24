# 本版操作回归

原版 0.4 的操作规范继续保留，快捷键见 CONTROLS.md。新增界面通过复用既有输入层，避免创建第二套战斗命令系统。

Node 层：operations.test.cjs、camera.test.cjs。
浏览器层：browser_operations.py、browser_camera.py，使用实际鼠标、键盘、Worker；夹具只负责构造可重现的场景。

按键长按、生产右键、放置队列、Z 路径、强制移动碾压、迷雾切换、摄像机拖动和弹窗输入边界都应持续回归。具体本次通过与失败状态见 tests/*results.json，不引用旧版截图作为新结果。
