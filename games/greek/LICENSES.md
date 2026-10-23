# 素材与依赖说明

本游戏故事、人物、虚构城邦、中文文案、规则代码、界面、地图与棋子为本独立项目制作。未使用《博德之门》的美术、对白、地图或专有数据。D&D 仅作为用户指定的深度与 d20 机制参考，实际有限规则范围见 README。

运行核心使用 Node.js 标准库，不安装第三方 npm 依赖。`public/art.js` 的 SVG 插画、图标、棋子与地图装饰是本项目内联矢量内容。`design/game-ref.png`、`design/workshop-ref.png` 和 `public/assets/limestone.png` 使用内置 imagegen 生成；前两张是设计参考，后一张是实际界面纹理。没有从其他游戏抓取素材。

研究页面只保留链接和自行撰写的短中文转述，未把现代原典译文全文打包；详见 docs/SOURCES.md。开发时只读参考的旧房间模板不作为发行依赖，`reference-base/` 不进入成品包。

测试与文档渲染使用本机已有 Node/Python/PyMuPDF/Pillow；这些工具本身不打包为游戏依赖。没有字体文件打包，界面使用电脑自带中文与衬线字体。
