# 部署万神之书

需要 Node.js 24+ 与可写的持久化磁盘。项目没有第三方 npm 依赖，不需要 `npm install` 或前端构建。

## GitHub Pages 与独立联机后端

公开书库入口为 <https://throne-kari.github.io/mythic-dnd-hub/>。Pages 只提供静态书库与资料，不运行 Node、房间状态或 SSE 服务。

`deployment.json` 保存公开后端源地址，不保存任何密钥。当前为：

```json
{ "backendUrl": null }
```

这表示后端尚未连接；静态书库可以发布，但建房和加入入口会明确显示“待连接”。不要把静态站上线等同于联机服务上线。

后端部署成功后，把 `backendUrl` 改为实际 HTTPS 源地址（只含协议、域名和可选端口；不含用户名、密码、子路径、查询串或片段）。执行 `node scripts/build-pages.mjs` 检查静态输出，再提交到 `main`，`.github/workflows/pages.yml` 会发布 `.local/pages/`。仓库 Settings → Pages 的 Source 必须为 **GitHub Actions**。

游戏从书库直接导航到独立后端的 `/play/<游戏ID>/`，使游戏页面、API、席位和 SSE 保持同源，不需要开放跨站写接口。联机服务器必须长期运行，`runtime/` 必须挂载持久盘；不要使用临时隧道或房主电脑作为云端部署的替代。

### 云主机配置清单

- 使用已有 `Dockerfile`（Node 24）；入口 `node server.mjs --public-only`。
- 设置 `HOST=0.0.0.0`、平台提供的 `PORT`、`HUB_MANAGER=0` 和 `HUB_RUNTIME_DIR=/app/runtime`。
- 为 `/app/runtime` 挂载持久卷并验证运行用户可写；副本数保持 **1**，现有房间与 SSE 订阅不支持无状态多副本分流。
- 生成支持 SSE 的 HTTPS 公网域名，并把 `PUBLIC_URL` 设置为该源地址；健康检查为 `/api/health`。
- Railway 的卷默认由 root 挂载；使用此非 root 镜像时，需按[平台卷权限说明](https://docs.railway.com/volumes#permissions)处理权限。不要仅在镜像构建时 `chown` 后就假设运行时挂载卷可写。
- Railway 免费/试用资源受额度及容量限制；连接后应先核对账户额度与限额，不自动升级套餐。Render 免费实例无持久盘，休眠或重启会丢本地存档，不能作为现有存档架构的长期部署。

### 联机验收与限制

在新建、隔离的验收房间中，用两个独立席位验证创建/加入、一次核心操作的状态同步，以及断线后用原席位重连。测试结果应区分“同一云端的独立协议会话”与“真实两设备跨网络浏览器”；不能互相替代。

北欧和凯尔特目前各为单牌桌服务，第二席位由管理者分配；它们的原席位凭据和当前桌面不会在进程重启后自动恢复。持久盘保留存档文件，但不等于所有游戏都具备自动断点恢复。其余游戏的房间恢复也应在选定云主机上实测后再宣称通过。

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

仓库现为公开源码。仓库公开或 Pages 上线本身不创建一台长期运行的游戏服务器。

