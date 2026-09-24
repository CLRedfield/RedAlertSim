# Command Edition 1.0 架构

## 一套模拟，三个执行入口

`data.js`定义国家、实体、席位、地图与版本；`sim.js`定义生产、战斗、寻路、迷雾；`tactics.js`扩展特殊机制、训练、AI和录像基础；`operations.js`实现六任务、友军任务AI、停滞路径恢复与检查点。

单人通过Blob Worker运行Sim。LAN的Node HTTP/WebSocket服务通过`authority.js`的RoomService运行Sim。公共MQTT模式将同一个RoomService放进房主浏览器Worker，以虚拟连接收发消息。客人只接收经过自己视野过滤的状态，不运行权威游戏逻辑。

`mqtt-wire.js`是有界MQTT3.1.1客户端子集；`mqtt-room.js`管理绑定主机公钥的邀请、逐客人的ECDH/HKDF/AES-GCM通道、QoS、分片、重连及目录。详见NETWORK_MQTT.md。没有远程托管的游戏计算服务，没有全局匹配调度。

## 渲染和界面

`geometry.js`、`art.js`及`art-expanded.js`生成基础与细节网格。`renderer.js`使用WebGL2实例绘制，根据画质和镜头距离省略细节层，炮塔细节跟随转向与后坐。`camera.js`保留拖动、缩放与手势边界。所有渲染只读快照。

`app.js`负责核心输入和Worker桥接；`headquarters.js`负责已有部署、生产、训练、结算；`release-ui.js`加入行动、MQTT、观战、存档、科技树和记录。界面仍复用旧原型的部分面板，不是完整组件框架重写。

## 版本和构建

`python tools/build.py`将页面、样式、模块全部内联进相同的PLAY.html与web/index.html。源码身份覆盖规范化data.js以及sim/tactics/operations/wire/authority/mqtt-wire/mqtt-room。规则和地图标识也在协议5连接时核查。共享代码改变后必须重建两端。发布文件全量SHA-256另见根目录清单。

## 保存、录像和观察

存档导入沿用字段白名单和有界树校验，新增任务状态验证。本地IndexedDB提供四手动、两轮换自动槽；重要数据可导出JSON。数据库受浏览器来源、隐私和权限限制，非云保存。

v2录像保存初始状态、接受的命令和每600tick的检查点，最多12个且8MB预算；定位从最近检查点重算，AI不重复记为玩家命令。完整联机录像仅在结束后导出。观察者只收到300tick前的过滤快照，缓存按视角生成；未缓存的视角先等待缓冲。

## 边界

房主Worker暂停可处理其MQTT链路短时中断，无法在房主关闭、断电后将对局迁到另一人。LAN服务重启不持久化房间。没有可信房主反作弊、账号、跨节点路由、数据库运维、真实公网容量与安全审计结论。
