# FCA

桌面端网页式解谜游戏。

## 浏览器游玩

双击项目根目录的 `index.html`，使用 Edge 或 Chrome 打开即可离线游玩。该文件已内嵌游戏素材，可以单独复制和分享。

若浏览器阻止开场视频自动播放，点击「开始游戏」即可。

游戏更新后，在项目目录运行以下命令，重新生成网页：

```bash
npm install
npm run build:web
```

## 开发启动

在 VS Code 终端中运行：

```bash
npm start
```

当前项目使用 HTML、CSS、JavaScript 和 Electron 进行开发。

`src/index.html` 是 Electron 内部加载的界面入口，不作为玩家或开发者直接双击的启动文件。
