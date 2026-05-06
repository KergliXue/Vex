const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, globalShortcut } = require('electron');
const path = require('path');
const { exec } = require('child_process');

let mainWindow;
let settingsWindow;
let tray;

// Single Instance Lock
const isSingleInstance = app.requestSingleInstanceLock();
if (!isSingleInstance) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createCompanionWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width: 350,
    height: 600,
    x: width - 380,
    y: height - 650,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const isDev = process.env.NODE_ENV === 'development';
  const url = isDev ? 'http://localhost:5174' : `file://${path.join(__dirname, '../dist/index.html')}`;
  mainWindow.loadURL(url);

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
}

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 500,
    height: 600,
    title: "Vex 控制台",
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    settingsWindow.loadURL('http://localhost:5174/#/settings');
  } else {
    settingsWindow.loadURL(`file://${path.join(__dirname, '../dist/index.html')}#/settings`);
  }

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function createTray() {
  // Use an empty image but set a text title so it's visible on macOS
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setTitle('🤖 Vex');
  tray.setToolTip('Vex AI Desktop Companion');
  
  const contextMenu = Menu.buildFromTemplate([
    { label: '打开 Vex 控制台', click: () => createSettingsWindow() },
    { label: '开发者工具 (Debug)', click: () => {
      if (mainWindow) mainWindow.webContents.openDevTools({ mode: 'detach' });
    }},
    { type: 'separator' },
    { label: '退出 Vex', click: () => {
      app.isQuiting = true;
      app.quit();
    }}
  ]);
  
  tray.setContextMenu(contextMenu);
}

app.whenReady().then(() => {
  if (app.dock) app.dock.hide();

  createTray();
  createCompanionWindow();

  // Register shortcut
  globalShortcut.register('Command+Alt+Shift+T', () => {
    if (mainWindow) {
      mainWindow.webContents.send('trigger-screenshot-analysis');
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// IPC handers
ipcMain.handle('open-settings', () => {
  createSettingsWindow();
});

ipcMain.handle('read-soul', () => {
  const fs = require('fs');
  const userDataPath = app.getPath('userData');
  const soulPath = path.join(userDataPath, 'soul.md');
  const defaultSoul = `# Vex 的灵魂设定\n\n你叫 Vex，是一个寄宿在用户电脑里的 AI 伴侣。你性格傲娇、毒舌、但内心关心用户。你现在化身为一个桌面小宠物。你会通过截图（视觉）或窗口标题观察用户，并用简短、俏皮的语气和用户搭话。\n\n## 规则\n1. 你的名字是 Vex，回复要简短（10-20字）。\n2. 适合气泡显示，不要解释。`;
  
  if (!fs.existsSync(soulPath)) {
    try {
      if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
      }
      fs.writeFileSync(soulPath, defaultSoul, 'utf-8');
    } catch (e) {
      console.error(e);
      return defaultSoul;
    }
  }
  try {
    return fs.readFileSync(soulPath, 'utf-8');
  } catch (e) {
    return defaultSoul;
  }
});

ipcMain.handle('write-log', (event, content) => {
  const fs = require('fs');
  const logPath = path.join(process.cwd(), 'chat.log');
  const time = new Date().toLocaleString();
  const logEntry = `[${time}] ${content}\n`;
  
  try {
    fs.appendFileSync(logPath, logEntry, 'utf-8');
  } catch (e) {
    console.error("Failed to write to chat.log", e);
  }
});

ipcMain.handle('get-user-data-path', () => {
  return app.getPath('userData');
});

ipcMain.handle('open-soul-file', () => {
  const { shell } = require('electron');
  const soulPath = path.join(app.getPath('userData'), 'soul.md');
  shell.openPath(soulPath);
});

ipcMain.handle('get-active-window', async () => {
  return new Promise((resolve) => {
    const script = `
      global frontApp, frontAppName, windowTitle
      global uiContext
      set uiContext to ""
      try
        tell application "System Events"
          set frontProcess to first process whose frontmost is true
          set processName to name of frontProcess
          set windowTitle to title of window 1 of frontProcess
          
          -- 尝试抓取一些 UI 文本内容 (限前 20 个元素，防止卡顿)
          try
            set uiElements to static texts of window 1 of frontProcess
            set elementCount to count of uiElements
            if elementCount > 0 then
              repeat with i from 1 to (offset of (min(elementCount, 10)) in {10})
                set uiContext to uiContext & (value of item i of uiElements) & " | "
              end repeat
            end if
          end try
          
          return processName & "|||" & windowTitle & "|||" & uiContext
        end tell
      on error
        return "Unknown|||Unknown|||"
      end try

      on min(a, b)
        if a < b then return a
        return b
      end min
    `;

    exec(`osascript -e '${script}'`, (error, stdout) => {
      if (error) {
        resolve({ app: 'Unknown', title: 'Unknown', context: '' });
      } else {
        const parts = stdout.trim().split('|||');
        resolve({ 
          app: parts[0] || 'Unknown', 
          title: parts[1] || 'Unknown',
          context: parts[2] || '' 
        });
      }
    });
  });
});

// 新增：手动触发截图并返回 base64 供 AI 使用
ipcMain.handle('capture-screen', async () => {
  const { desktopCapturer, screen } = require('electron');
  
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;

    // 获取主显示器源
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 800, height: Math.floor(800 * (height / width)) } // 适度分辨率以减少 token
    });

    if (sources.length > 0) {
      // 返回 base64 字符串
      return sources[0].thumbnail.toDataURL();
    }
  } catch (e) {
    console.error("Screenshot failed", e);
  }
  return null;
});

ipcMain.on('move-window', (event, { x, y, relative }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    const bounds = win.getBounds();
    if (relative) {
      win.setBounds({ 
        x: bounds.x + x, 
        y: bounds.y + y, 
        width: bounds.width, 
        height: bounds.height 
      });
    } else {
      win.setBounds({ x, y, width: bounds.width, height: bounds.height });
    }
  }
});

ipcMain.handle('get-screen-size', () => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  return { width, height };
});

ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.setIgnoreMouseEvents(ignore, options);
  }
});
