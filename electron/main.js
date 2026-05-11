/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, shell, session } = require("electron/main");
const path = require("path");
const http = require("http");
const net = require("net");
const { spawn } = require("child_process");

let nextServerProcess = null;
let cachedServerUrl = null;

function getFreePort() {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function waitForServer(url, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeout;
    const attempt = () => {
      if (Date.now() > deadline) { reject(new Error("Server start timeout")); return; }
      http.get(url, () => resolve()).on("error", () => setTimeout(attempt, 300));
    };
    attempt();
  });
}

async function getServerUrl() {
  if (cachedServerUrl) return cachedServerUrl;

  if (!app.isPackaged) {
    cachedServerUrl = process.env.ELECTRON_START_URL || "http://127.0.0.1:3000";
    return cachedServerUrl;
  }

  const port = await getFreePort();
  const serverScript = path.join(process.resourcesPath, "app", "server.js");

  nextServerProcess = spawn(process.execPath, [serverScript], {
    cwd: path.dirname(serverScript),
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
    },
    stdio: "ignore",
  });

  nextServerProcess.on("error", (err) => console.error("Next.js server error:", err));

  const url = `http://127.0.0.1:${port}`;
  await waitForServer(url);
  cachedServerUrl = url;
  return url;
}

function applySecurityHeaders() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self';" +
          " script-src 'self' 'unsafe-eval' 'unsafe-inline';" +
          " style-src 'self' 'unsafe-inline';" +
          " font-src 'self' data:;" +
          " connect-src 'self' https://api.openai.com https://graph.microsoft.com https://www.googleapis.com https://accounts.google.com;" +
          " img-src 'self' data: blob:;" +
          " media-src 'self' blob:;",
        ],
      },
    });
  });
}

function createWindow(url) {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1120,
    minHeight: 760,
    title: "Taplo",
    backgroundColor: "#FAFAF8",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.loadURL(url);

  mainWindow.webContents.on("did-fail-load", (_event, _errorCode, _errorDescription, validatedUrl) => {
    if (validatedUrl !== url) return;
    setTimeout(() => {
      if (!mainWindow.isDestroyed()) mainWindow.loadURL(url);
    }, 1000);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: openUrl }) => {
    shell.openExternal(openUrl);
    return { action: "deny" };
  });

  if (!app.isPackaged && process.env.ELECTRON_OPEN_DEVTOOLS === "1") {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

function killServer() {
  if (nextServerProcess) {
    nextServerProcess.kill();
    nextServerProcess = null;
  }
}

app.whenReady().then(async () => {
  applySecurityHeaders();
  const url = await getServerUrl();
  createWindow(url);

  if (app.isPackaged) {
    const { autoUpdater } = require("electron-updater");
    autoUpdater.checkForUpdatesAndNotify();
  }
});

app.on("window-all-closed", () => {
  killServer();
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const url = await getServerUrl();
    createWindow(url);
  }
});

app.on("before-quit", killServer);
