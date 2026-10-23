# 部署万神之书

需要 Node.js 24+ 与可写的持久化磁盘。项目没有第三方 npm 依赖，不需要 `npm install` 或前端构建。

## 本机与局域网

```sh
npm start
```

网站默认监听 `0.0.0.0:4780`，同一局域网的朋友可用主机的局域网地址访问。作者台只监听 `127.0.0.1:4781`，本机入口为 `http://127.0.0.1:4781/manage/`。没有为本项目自动修改防火墙规则。

游戏由网关按需启动，内部端口自动分配，全部只监听回环地址。外部只需要网站的一个端口。

## 环境配置

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `HOST` | `0.0.0.0` | 网站监听地址 |
| `PORT` | `4780` | 网站端口 |
| `MANAGER_PORT` | `4781` | 本机管理端口 |
| `HUB_MANAGER` | `1` | 设为 `0` 禁用作者台 |
| `HUB_RUNTIME_DIR` | `runtime` | 运行数据；相对路径以仓库根目录为基准 |
| `PUBLIC_URL` | 本机网站地址 | 作者台“打开大厅”的地址，可设置为实际 HTTPS 网址 |

复制 `.env.example` 为 `.env` 后，`npm start` 会自动读取，系统环境变量优先。也可以使用 Node 内置环境文件支持：

```sh
node --env-file=.env server.mjs
```

## 服务器运行

```sh
HOST=0.0.0.0 PORT=4780 HUB_MANAGER=0 node server.mjs --public-only
```

以上环境变量写法用于 Linux / macOS。PowerShell 写法：

```powershell
$env:HOST = '0.0.0.0'
$env:PORT = '4780'
$env:HUB_MANAGER = '0'
node server.mjs --public-only
```

长期运行可由主机现有进程管理器托管。应把 `runtime/` 放在持久化磁盘，不能在每次发布时重新生成。每次升级保留此目录，关闭旧服务后再启动新版本。

## Docker

```sh
docker build -t mythic-dnd-hub .
docker volume create mythic-dnd-data
docker run -d --name mythic-dnd --restart unless-stopped \
  -p 4780:4780 \
  -v mythic-dnd-data:/app/runtime \
  mythic-dnd-hub
```

镜像仅运行网站，作者台关闭。原稿目录、本机映射、存档和 `.env` 不进入镜像。需要实际公网域名时，可传入 `-e PUBLIC_URL=https://你的域名`。

## HTTPS 反向代理

把域名根路径完整转发至 `127.0.0.1:4780`，保留原始 `Host`，允许 SSE 长连接，关闭响应缓冲。例如使用已有 Nginx 的站点配置：

```nginx
location / {
    proxy_pass http://127.0.0.1:4780;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_buffering off;
    proxy_read_timeout 3600s;
}
```

TLS 证书和 DNS 由现有主机环境配置。不要把作者台的 4781 端口或各游戏的内部端口映射到公网。游戏邀请链接应从公网入口的游戏页面生成。

## 存档备份与恢复

作者台可按游戏下载备份。完整迁移时先停止服务，再复制 `runtime/`；恢复到同版本目录后启动。备份包含房间状态及可能的席位凭据，应作为私人文件保存。

本次交付目标是完整源码与 GitHub 私有仓库。仓库上传本身不创建一台长期运行的游戏服务器。

