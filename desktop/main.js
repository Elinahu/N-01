const { app, BrowserWindow, session } = require("electron");
const path = require("path");

function createGameWindow() {
  const gameWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    autoHideMenuBar: true,
    backgroundColor: "#0b0b0b",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      autoplayPolicy: "no-user-gesture-required"
    }
  });

  gameWindow.loadFile(path.join(__dirname, "../src/index.html"));
}

app.whenReady().then(() => {
  // 目前仅允许游戏本地页面申请摄像头权限。
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    const isGamePage = webContents.getURL().startsWith("file://");
    return permission === "media" && isGamePage;
  });

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const isGamePage = webContents.getURL().startsWith("file://");
    callback(permission === "media" && isGamePage);
  });

  createGameWindow();
});

app.on("window-all-closed", () => app.quit());
