# 运维模板，未部署

**本目录不是正在运行的公共服务器。** 没有云资源、域名、证书、账号授权或运营承诺，也没有在本环境执行 Docker build / compose。本目录仅用于可选的专用权威服务器模式。1.0公共MQTT中转模式不需要部署本目录，但它也不等于已有国内专用服务器。

## 未来维护者的前置条件

取得明确授权的实际主机、域名和运维负责人；处理适用的发布/运营手续；确认预算、保留期限和告警责任。安全审查必须包含固定 ws 8.17.1 依赖、消息权限、慢客户端、真实 IP 代理信任链和单房 CPU 预算。部署示例不是安全审计报告。

## 配置顺序

1. 全部源码重新 `python tools/build.py`，确认客户端/服务端内容哈希一致。
2. 审查并更新 WebSocket 依赖后跑完整测试，不能只修改版本号。生产容器镜像应固定经审查的 digest；本模板仅固定 Node 发布版本，Caddy 镜像标签仍需运营方进一步固定。
3. 在 deploy 中将 .env.example 复制为 .env，填写自己授权的实际 DOMAIN。未填写时 Compose 拒绝启动。
4. 由运营方把域名指向真实主机并配置 TLS 所需的入口。模板仅将 80/443 暴露到外部；游戏 8787 留在容器内部。
5. 运行 `docker compose --env-file .env up -d --build`。检查服务日志、HTTPS `/health`、两浏览器建房、WSS、断线恢复和结算。
6. 在已确认的地址上运行根目录工具：`node tools/configure-online.cjs --url wss://实际域名/ws --name 实际节点名`，然后重新发布 web/online.json 或重新构建容器。该工具只写配置，不验证节点在线或兼容。
7. 做中国不同运营商、不同地域与 2/4/8 人完整局测试，记录丢包/断线/CPU/内存/带宽/结算。通过后才把“未部署”状态改为真正的已验收线上服务说明。

## 重要限制

当前源码按 socket.remoteAddress 做单 IP 配额。通过 Caddy 反向代理时，多人可能共享代理来源的 20 连接上限，而不是各自的真实 IP。不能简单信任任意 X-Forwarded-For 来绕过配额；应为严格限定的代理链设计并测试真实 IP 提取，再讨论扩容。这个模板未完成生产规模验证。

游戏房间在内存中，重启/更新会中断进行中的比赛。模板没有数据库、备份、排空升级、跨节点路由、监控告警或 DDoS 防护。16 房间/128 连接是保护上限，不是本次负载能力承诺。日志不要包含恢复 token，不要记录聊天正文作为无告知的分析数据。

八个虚拟本地客户端测试不等于中国公网八人验收。完成真实部署之后仍必须明确服务可用期限和维护人，不能把服务端程序文件等同于长期运营能力。

## 参考文档

- Caddy WebSocket/反向代理：https://caddyserver.com/docs/caddyfile/directives/reverse_proxy
- Compose 必填环境变量：https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/
- Node 固定版本来源：https://nodejs.org/en/blog/release/v22.22.3
