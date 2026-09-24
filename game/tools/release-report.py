#!/usr/bin/env python3
"""Aggregate actual test outputs. Run only after all suites finish successfully."""
from pathlib import Path
import datetime,hashlib,json,subprocess
r=Path(__file__).resolve().parents[1]
specs=[('基础模拟','sim-results.json','node'),('生产与操作逻辑','operations-results.json','node'),('相机数学/状态','camera-results.json','node'),('既有升级机制/录像','upgrade-results.json','node'),('六任务/检查点/观战/模型','release-results.json','node'),('真实Node房间协议','network-results.json','node'),('加密MQTT/八客户端/主机恢复','mqtt-results.json','node'),('完整页面/WebGL冒烟','browser-results.json','browser'),('生产与键鼠操作','browser-operations-results.json','browser'),('镜头/联机输入','browser-camera-results.json','browser'),('训练/录像/房间/重连','browser-upgrade-results.json','browser'),('1.0任务/存档导出/科技/LOD','browser-release-results.json','browser')]
identity=json.loads(subprocess.check_output(['node','-e',"require('./web/src/data.js');console.log(JSON.stringify({release:RA.VERSION,protocol:RA.PROTOCOL,content:RA.CONTENT_HASH,rules:RA.RULES_HASH,map:RA.MAP_HASH,source:RA.SOURCE_HASH}))"],cwd=r))
suites=[]
for name,file,kind in specs:
 p=r/'tests'/file;d=json.loads(p.read_text());ok=d.get('completed',d.get('passed')==d.get('total',d.get('passed'))) and d.get('failed',0)==0 and not d.get('errors') and not d.get('failures')
 if d.get('version')!=identity['release']:raise RuntimeError('Wrong release: '+file)
 if d.get('content') and d['content']!=identity['content']:raise RuntimeError('Content identity mismatch: '+file)
 if not ok:raise RuntimeError('Suite incomplete/failed: '+file)
 suites.append({'name':name,'file':file,'kind':kind,'passed':d['passed'],'completed':bool(ok),'result_sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
n=sum(s['passed'] for s in suites if s['kind']=='node');b=sum(s['passed'] for s in suites if s['kind']=='browser')
limits=['Real public MQTT connection, mainland-China reachability, cross-ISP eight-human full matches','Windows launcher download/firewall and physical multi-machine LAN','Browser file/localhost navigation: blocked by environment policy','Real-origin IndexedDB, cross-browser-restart persistence and WebCrypto in a browser origin','GPU / RTX4060 frame rate: browser uses software WebGL','Full original-game mechanics/assets and human mission-balance playthrough','External security audit, updated ws dependency, long-term broker service operation','Dedicated cloud service deployment / Docker build; no seamless host migration']
summary={**identity,'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'allReportItemsCompleted':False,'publicMqttRelayImplemented':True,'publicMqttExternalConnectivityVerified':False,'publicServerDeployed':False,'windowsRuntimeBundled':False,'checks_passed':n+b,'node_checks':n,'browser_checks':b,'suites':suites,'play_html_sha256':hashlib.sha256((r/'PLAY.html').read_bytes()).hexdigest(),'unverified':limits}
(r/'tests/RELEASE_SUMMARY.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
md=f'''# 发布测试报告 · Command Edition {identity['release']}

记录时间：{summary['checkedAt']}。**{n}项逻辑/协议检查＋{b}项浏览器检查，共{n+b}项通过。** 数量是断言组，不是实体设备数、不同游戏数量或人工整局数量。

|测试组|通过|完成|结果文件|
|---|---:|---|---|
'''
for s in suites:md+=f"|{s['name']}|{s['passed']}|是|tests/{s['file']}|\n"
md+='''
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
'''
bench=json.loads((r/'tests/benchmark-results.json').read_text())
for row in bench['rows']:md+=f"|{row['initialUnits']}|{row['meanStepMs']}|{row['p95StepMs']}|{row['snapshotBytes']}|\n"
md+='\n处理器：'+bench['cpu']+'。基准原始记录：tests/benchmark-results.json。\n\n## 未取得的验收证据\n\n'
md+='真实公共节点和国内跨运营商质量、实体Windows首启和双机LAN、稳定来源的IndexedDB跨重启、真实GPU帧率、原版全内容认证、安全审计和长期运营均未验证。没有上线中国专用游戏服务，也没有将“1.0”解释为原报告36项全部完成。\n'
md+='\n## 重跑\n\n```sh\npython tools/build.py\nnpm test\nxvfb-run -a node tests/run-browser.cjs\nnode tests/benchmark.cjs\nnode tools/audit-content.cjs\npython tools/release-report.py\n```\n\n浏览器回归需要本机Python Playwright与Chromium；串行执行以减少软件渲染争用。正常游玩不需要这些开发依赖。日志位于tests/logs/，构建身份与结果文件哈希在tests/RELEASE_SUMMARY.json。\n'
(r/'docs/TEST_REPORT.md').write_text(md)
print(f'{n+b} passed = {n} node + {b} browser; identity '+identity['content'])
