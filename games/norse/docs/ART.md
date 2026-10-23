# 图像资产与生成记录

`public/portraits.png` 为本次内置 imagegen 生成并由负责人实际查看的2×2原创角色肖像。左上阿斯格尔、右上莉芙、左下鲁娜、右下埃里克。精确从本次返回的 data URL 解码落盘，不按目录最近文件猜测；SHA256：`FC844AF9FCE69CA3531BA2DD15C6CAB089BB25A592E25B36EE75FD4E4FCA0925`。

没有访问外部模型密钥或使用CLI/API后备。生成结果是画像素材，不是游戏界面截图，也不证明真实浏览器布局通过。

完整提示词：

> Use case: stylized-concept. Asset type: four original character portraits for a playable Norse myth narrative tactical CRPG, Saltfjord: Winter of Broken Oaths. Create one 2 by 2 portrait atlas, four equal square quadrants, each a centered head-and-shoulders portrait fully inside its quadrant, exact same scale and dark deep blue background. Top left: Asgeir, middle-aged coastal shield warrior, weathered fair skin, brown beard, short rough hair, wool cloak, iron brooch, restrained bronze trim. Top right: Liv, adult Scandinavian fjord scout, red-brown braided hair, practical dark green hood and leather, alert humane expression, small bow strap. Bottom left: Runa, adult coastal woman who tends injured people and lights for the dead, silver-blond braid, blue-grey wool and modest iron pendant, calm tired eyes, no angel wings. Bottom right: Eirik, adult rune scholar, dark hair tied back, ink-stained fingers holding a slim wood tablet, winter wool cloak, thoughtful imperfect face. Style: refined hand-painted storybook realism, lightly engraved edges and textured paint, cool fjord teal shadows, restrained copper lantern highlights, believable human adults, dignified but not glamorous. Composition: straight-on three-quarter bust, faces at same height in each quadrant, clean 2x2 grid with no gutters, no objects crossing quadrants. No text, letters, numbers, labels, border, UI, watermarks. Avoid horns on helmets, generic metal bikini, magic glowing skin, cinematic franchise characters. This atlas will be used as a background image and cropped into four separate portrait cards in CSS.

两张页面参考的完整提示词、保存纠错和哈希见 [UI.md](UI.md)。代码以这些参考的三栏层次、冷青铜金和羊皮纸叙事板为依据；地图实际为可编辑的CSS格图，并非图片所示写实2.5D渲染器。
