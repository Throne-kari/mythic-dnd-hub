# 《镜与归路》七张精细地图

新版《归灯之夜》非破坏性复用旧日本地图集。浏览器入口：[七图查看器](index.html)；服务运行时为 `/maps/index.html`。也可从本地文件直接打开index.html，外置JS与图片均保存在同一地图目录，无外网依赖。

这些查看器保存旧版实体山体、树木与房屋，可旋转、缩放、俯视/侧视，按图切换屋顶、地点、GM参考位置、地道或潮位。游戏桌上的互动沙盘负责当前棋子、回合、战斗与同步；本页精细地图不读取或修改房间状态。旧图上的GM棋子只是旧文参考位置，不能当作新版房间中的实时站位。

| 地图 | 新版使用处 | 几何口径 |
| --- | --- | --- |
| [镜守山谷](mirror-valley/mirror-valley.html) | J01、J02、J12 | 示意总览，模型单位不换算移动或射程 |
| [旧藏库](mirror-store/mirror-store.html) | J03 | 40×30尺、内部高15尺；西门10尺 |
| [根下客舍](root-house/root-house.html) | J04、J05 | 80×60尺、房高10尺；地道70尺、宽高3尺 |
| [返灯之坂](return-slope/return-slope.html) | J06–J08 | 60尺直内廊、3尺高低廊、10尺外墙 |
| [内湾路线](tide-coast/tide-coast.html) | J09 | 示意总览，行程依公开文字；非战术比例 |
| [礁池](tide-pool/tide-pool.html) | J10 | 60×40尺，低潮水深12尺、高潮22尺；西台+12尺 |
| [芦湾](reed-bay/reed-bay.html) | J11 | 水面60尺、田埂120尺、渠深6尺；旧桥在图外 |

五张尺寸场景的模型坐标为`[正文x-origin[0], 高度, origin[1]-正文y]`，origin保存在scene.json。山谷总览是早期独立格式，没有这一接口。PNG外边留白不是额外场地，屋顶、墙厚、家具与树形等美术补足不增加规则。新版地形和任务以游戏节点公开文本为准；礁池新增普通回收绳布置，不改旧图模型。

各目录有HTML、PNG多视角、GLB、OBJ、MTL、scene.json、map-manifest.json。复制清单与SHA256在[reuse-manifest.json](reuse-manifest.json)。没有复制ZIP重复包、旧存档、席位、凭据、日志或运行数据；原旧地图未移动、未回写。

为适配本地服务的`script-src 'self'`，新副本的8个HTML内嵌脚本抽成同目录`*.inline-1.js`，不使用unsafe-inline，不修改安全策略。样式和原模型保留。只做语法与静态资源路径核对；没有浏览器实际旋转、WebGL呈现或交互视觉验收，地图PNG属于原地图预览，不能称为新版游戏截图。
