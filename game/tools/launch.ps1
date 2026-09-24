param([ValidateSet('lan','desktop')][string]$Mode='lan')
$ErrorActionPreference='Stop'
$Root=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Root
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding
$Host.UI.RawUI.WindowTitle='Red Alert 3D | Command Edition 1.0.0'
function Open-Desktop {
    $Uri=([System.Uri](Join-Path $Root 'PLAY.html')).AbsoluteUri
    $Candidates=@(
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
    )
    foreach($Browser in $Candidates) {
        if(Test-Path -LiteralPath $Browser) {
            Start-Process -FilePath $Browser -ArgumentList @("--app=`"$Uri`"",'--window-size=1440,900')
            return
        }
    }
    Start-Process -FilePath (Join-Path $Root 'PLAY.html')
}
function Get-NodeRuntime {
    $Version='22.22.3'
    $Arch='x64'
    $Sha='6c8d54f635feff4df76c2ca80f45332eb2ff57d25226edce36592e51a177ee33'
    if($env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64') {
        $Arch='arm64';$Sha='00be129a09e8872cd52d3bb8bba12412c5733d2224123a482a2dca4a6fbf2586'
    }
    $Name="node-v$Version-win-$Arch"
    $Destination=Join-Path $Root "runtime\$Name"
    $Exe=Join-Path $Destination 'node.exe'
    if(Test-Path -LiteralPath $Exe) { return $Exe }
    $Existing=Get-Command node -ErrorAction SilentlyContinue
    if($Existing) {
        $v=(& $Existing.Source --version 2>$null)
        if($v -match '^v(\d+)\.' -and [int]$Matches[1] -ge 22) {return $Existing.Source}
    }
    Write-Host ''
    Write-Host '首次联机需要 Node 运行环境，将从 nodejs.org 下载官方便携包。' -ForegroundColor Yellow
    Write-Host '不安装 npm、不修改 PATH、不申请管理员权限。下载后验证固定 SHA-256。'
    Write-Host '单人游戏不需要下载任何运行时，可直接打开 PLAY.html。'
    Write-Host ''
    $Runtime=Join-Path $Root 'runtime'
    New-Item -ItemType Directory -Path $Runtime -Force | Out-Null
    $Work=Join-Path $Runtime ('download-'+[System.Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $Work | Out-Null
    $Zip=Join-Path $Work 'node.zip'
    try {
        [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
        $ProgressPreference='SilentlyContinue'
        Invoke-WebRequest -UseBasicParsing -Uri "https://nodejs.org/dist/v$Version/$Name.zip" -OutFile $Zip -TimeoutSec 180
        $Actual=(Get-FileHash -Algorithm SHA256 -LiteralPath $Zip).Hash.ToLowerInvariant()
        if($Actual -ne $Sha) {throw '运行时校验失败。已停止，未运行下载内容。'}
        Expand-Archive -LiteralPath $Zip -DestinationPath $Work -Force
        New-Item -ItemType Directory -Path $Destination -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path $Work "$Name\node.exe") -Destination $Exe -Force
        Copy-Item -LiteralPath (Join-Path $Work "$Name\LICENSE") -Destination (Join-Path $Destination 'LICENSE') -Force
        Write-Host '官方运行环境已准备完成。' -ForegroundColor Green
        return $Exe
    } finally {
        if(Test-Path -LiteralPath $Work) {Remove-Item -LiteralPath $Work -Recurse -Force}
    }
}
try {
    if($Mode -eq 'desktop') {Open-Desktop;exit 0}
    $Node=Get-NodeRuntime
    $Port=0
    foreach($Candidate in 8787..8797) {
        $Listener=[System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any,$Candidate)
        try {$Listener.Start();$Port=$Candidate;break} catch {} finally {$Listener.Stop()}
    }
    if($Port -eq 0) {throw '8787-8797 端口都不可用，请关闭重复启动的服务器后再试。'}
    Write-Host ''
    Write-Host '局域网服务启动中，浏览器将自动打开。' -ForegroundColor Green
    Write-Host '保持此窗口开启。创建房间后，在大厅复制邀请链接发给朋友。'
    Write-Host '若防火墙提示，仅允许你信任的专用网络。不要关闭整个防火墙。'
    Write-Host '本包没有已部署的中国公共服务器，在线入口不会偷偷连接第三方。'
    Write-Host ''
    & $Node (Join-Path $Root 'server\server.cjs') --host 0.0.0.0 --port $Port --open
    if($LASTEXITCODE -ne 0) {throw "服务退出，代码：$LASTEXITCODE"}
} catch {
    Write-Host ('启动失败：'+$_.Exception.Message) -ForegroundColor Red
    Write-Host '检查解压目录是否可写、网络是否可访问官方站点。详见 README_先读我.md。'
    Read-Host '按 Enter 关闭'
    exit 1
}
