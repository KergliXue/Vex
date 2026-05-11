const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, globalShortcut, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

let mainWindow;
let settingsWindow;
let tray;

const DEFAULT_WINDOW_WIDTH = 350;
const DEFAULT_WINDOW_HEIGHT = 600;
const DEFAULT_LIVE2D_SCALE = 1;
const BASE_CHAT_WIDTH = 360;
const BASE_LIVE2D_STAGE_WIDTH = 420;
const BASE_LIVE2D_STAGE_HEIGHT = 460;
const WINDOW_EDGE_GAP = 20;
const LIVE2D_FRAME_PADDING_X = 24;
const LIVE2D_FRAME_PADDING_TOP = 44;
const LIVE2D_FRAME_PADDING_BOTTOM = 20;
const DEFAULT_ROLE_ID = 'vex-classic';
const ROLE_META_FILE = 'config.json';
const ROLE_SOUL_FILE = 'soul.md';
const ROLE_DEFAULT_IMAGE = 'avatar.png';
const DEFAULT_SOUL = `# Vex 的灵魂设定

你叫 Vex，是一个寄宿在用户电脑里的 AI 伴侣。你性格傲娇、毒舌、但内心关心用户。你现在化身为一个桌面小宠物。你会通过截图（视觉）或窗口标题观察用户，并用简短、俏皮的语气和用户搭话。

## 规则
1. 你的名字是 Vex，回复要简短（10-20字）。
2. 适合气泡显示，不要解释。`;

function getCompanionWindowSize(scale = DEFAULT_LIVE2D_SCALE, hasLive2D = true) {
  if (!hasLive2D) {
    return { width: DEFAULT_WINDOW_WIDTH, height: DEFAULT_WINDOW_HEIGHT };
  }

  const live2dStageWidth = Math.round(BASE_LIVE2D_STAGE_WIDTH * scale);
  const live2dStageHeight = Math.round(BASE_LIVE2D_STAGE_HEIGHT * scale);
  const live2dFramePaddingTop =
    LIVE2D_FRAME_PADDING_TOP + Math.max(0, Math.round((scale - 1) * 140));
  const live2dFrameWidth = live2dStageWidth + LIVE2D_FRAME_PADDING_X * 2;
  const live2dFrameHeight =
    live2dStageHeight + live2dFramePaddingTop + LIVE2D_FRAME_PADDING_BOTTOM;
  const petSafeWidth = live2dFrameWidth;

  return {
    width: BASE_CHAT_WIDTH + petSafeWidth + WINDOW_EDGE_GAP * 3,
    height: Math.max(DEFAULT_WINDOW_HEIGHT, live2dFrameHeight + WINDOW_EDGE_GAP * 2),
  };
}

function getAnchoredBounds(win, nextWidth, nextHeight, anchor = 'bottom-right') {
  const currentBounds = win.getBounds();
  const display = screen.getDisplayMatching(currentBounds);
  const workArea = display.workArea;
  const width = Math.min(Math.round(nextWidth), workArea.width);
  const height = Math.min(Math.round(nextHeight), workArea.height);

  let x = currentBounds.x;
  let y = currentBounds.y;

  if (anchor === 'bottom-right') {
    x = currentBounds.x + currentBounds.width - width;
    y = currentBounds.y + currentBounds.height - height;
  }

  x = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - width));
  y = Math.max(workArea.y, Math.min(y, workArea.y + workArea.height - height));

  return { x, y, width, height };
}

function getRolesRoot() {
  return path.join(app.getPath('userData'), 'roles');
}

function getActiveRoleMarkerPath() {
  return path.join(app.getPath('userData'), 'active-role.txt');
}

function slugifyRoleId(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || `role-${Date.now()}`;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyDirectoryRecursive(sourceDir, targetDir) {
  ensureDir(targetDir);
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryRecursive(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function getMimeTypeForFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

function fileToDataUrl(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }
  const bytes = fs.readFileSync(filePath);
  return `data:${getMimeTypeForFile(filePath)};base64,${bytes.toString('base64')}`;
}

function readRoleConfig(roleDir) {
  const configPath = path.join(roleDir, ROLE_META_FILE);
  const soulPath = path.join(roleDir, ROLE_SOUL_FILE);
  if (!fs.existsSync(configPath) || !fs.existsSync(soulPath)) {
    return null;
  }

  const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const folderId = path.basename(roleDir);
  const imageFileName = typeof rawConfig.image === 'string' ? rawConfig.image : '';
  const imagePath = imageFileName ? path.join(roleDir, imageFileName) : null;

  return {
    id: folderId,
    name: rawConfig.name || folderId,
    description: rawConfig.description || '',
    image: imageFileName || undefined,
    avatarDataUrl: imagePath ? fileToDataUrl(imagePath) : null,
    folderPath: roleDir,
    soulPath,
  };
}

function getActiveRoleId() {
  const markerPath = getActiveRoleMarkerPath();
  if (!fs.existsSync(markerPath)) {
    return DEFAULT_ROLE_ID;
  }
  const value = fs.readFileSync(markerPath, 'utf-8').trim();
  return value || DEFAULT_ROLE_ID;
}

function setActiveRoleId(roleId) {
  fs.writeFileSync(getActiveRoleMarkerPath(), roleId, 'utf-8');
}

function ensureDefaultRole() {
  const rolesRoot = getRolesRoot();
  ensureDir(rolesRoot);

  const defaultRoleDir = path.join(rolesRoot, DEFAULT_ROLE_ID);
  const legacySoulPath = path.join(app.getPath('userData'), 'soul.md');
  const initialSoul = fs.existsSync(legacySoulPath)
    ? fs.readFileSync(legacySoulPath, 'utf-8')
    : DEFAULT_SOUL;

  if (!fs.existsSync(defaultRoleDir)) {
    ensureDir(defaultRoleDir);
    fs.writeFileSync(
      path.join(defaultRoleDir, ROLE_META_FILE),
      JSON.stringify(
        {
          name: 'Vex Classic',
          description: '默认内置角色，继承原有 soul.md 灵魂设定。',
          image: ROLE_DEFAULT_IMAGE,
        },
        null,
        2
      ),
      'utf-8'
    );
    fs.writeFileSync(path.join(defaultRoleDir, ROLE_SOUL_FILE), initialSoul, 'utf-8');
    const defaultAvatarSource = path.join(app.getAppPath(), 'src/assets/hero.png');
    if (fs.existsSync(defaultAvatarSource)) {
      fs.copyFileSync(defaultAvatarSource, path.join(defaultRoleDir, ROLE_DEFAULT_IMAGE));
    }
  }

  if (!fs.existsSync(getActiveRoleMarkerPath())) {
    setActiveRoleId(DEFAULT_ROLE_ID);
  }
}

function listRolesInternal() {
  ensureDefaultRole();
  const rolesRoot = getRolesRoot();
  const activeRoleId = getActiveRoleId();

  return fs
    .readdirSync(rolesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readRoleConfig(path.join(rolesRoot, entry.name)))
    .filter(Boolean)
    .map((role) => ({ ...role, isActive: role.id === activeRoleId }))
    .sort((a, b) => {
      if (a.isActive) return -1;
      if (b.isActive) return 1;
      return a.name.localeCompare(b.name, 'zh-Hans-CN');
    });
}

function getRoleById(roleId) {
  return listRolesInternal().find((role) => role.id === roleId) || null;
}

function ensureValidRolePackage(roleDir) {
  const configPath = path.join(roleDir, ROLE_META_FILE);
  const soulPath = path.join(roleDir, ROLE_SOUL_FILE);
  if (!fs.existsSync(configPath) || !fs.existsSync(soulPath)) {
    throw new Error('角色文件夹必须包含 config.json 和 soul.md');
  }

  const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  if (!rawConfig.name || !rawConfig.description) {
    throw new Error('config.json 必须包含 name 和 description');
  }
  if (rawConfig.image) {
    const imagePath = path.join(roleDir, rawConfig.image);
    if (!fs.existsSync(imagePath)) {
      throw new Error(`config.json 指定的图片不存在: ${rawConfig.image}`);
    }
  }
}

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
  const initialSize = getCompanionWindowSize();

  mainWindow = new BrowserWindow({
    width: initialSize.width,
    height: initialSize.height,
    x: width - initialSize.width - 30,
    y: height - initialSize.height - 30,
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

function broadcastRolesUpdated() {
  const roles = listRolesInternal();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('roles-updated', roles);
  }
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('roles-updated', roles);
  }
}

function showPetContextMenu(win) {
  const roles = listRolesInternal();
  const activeRole = roles.find((role) => role.isActive);

  const roleItems = roles.map((role) => ({
    label: role.name,
    type: 'radio',
    checked: role.isActive,
    click: () => {
      setActiveRoleId(role.id);
      broadcastRolesUpdated();
    },
  }));

  const menu = Menu.buildFromTemplate([
    { label: '打开设置', click: () => createSettingsWindow() },
    { type: 'separator' },
    {
      label: activeRole ? `角色选择（当前：${activeRole.name}）` : '角色选择',
      submenu: roleItems.length > 0 ? roleItems : [{ label: '暂无角色', enabled: false }],
    },
    { type: 'separator' },
    { label: '退出 Vex', click: () => {
      app.isQuiting = true;
      app.quit();
    }},
  ]);

  menu.popup({ window: win });
}

app.whenReady().then(() => {
  if (app.dock) app.dock.hide();

  ensureDefaultRole();
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

ipcMain.on('show-pet-context-menu', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    showPetContextMenu(win);
  }
});

ipcMain.handle('read-soul', () => {
  try {
    const activeRole = listRolesInternal().find((role) => role.isActive) || getRoleById(DEFAULT_ROLE_ID);
    if (!activeRole) {
      return DEFAULT_SOUL;
    }
    return fs.readFileSync(activeRole.soulPath, 'utf-8');
  } catch (e) {
    console.error(e);
    return DEFAULT_SOUL;
  }
});

ipcMain.handle('list-roles', () => {
  return listRolesInternal();
});

ipcMain.handle('set-active-role', (event, roleId) => {
  const role = getRoleById(roleId);
  if (!role) {
    throw new Error('角色不存在');
  }
  setActiveRoleId(roleId);
  broadcastRolesUpdated();
  return listRolesInternal();
});

ipcMain.handle('import-role', async () => {
  const result = await dialog.showOpenDialog({
    title: '导入角色文件夹',
    properties: ['openDirectory'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return listRolesInternal();
  }

  const sourceDir = result.filePaths[0];
  ensureValidRolePackage(sourceDir);

  const rolesRoot = getRolesRoot();
  ensureDir(rolesRoot);

  const baseRoleId = slugifyRoleId(path.basename(sourceDir));
  let targetRoleId = baseRoleId;
  let suffix = 1;
  while (fs.existsSync(path.join(rolesRoot, targetRoleId))) {
    targetRoleId = `${baseRoleId}-${suffix}`;
    suffix += 1;
  }

  copyDirectoryRecursive(sourceDir, path.join(rolesRoot, targetRoleId));
  broadcastRolesUpdated();
  return listRolesInternal();
});

ipcMain.handle('export-role', async (event, roleId) => {
  const role = getRoleById(roleId);
  if (!role) {
    throw new Error('角色不存在');
  }

  const result = await dialog.showOpenDialog({
    title: '选择导出目录',
    properties: ['openDirectory', 'createDirectory'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const destinationParent = result.filePaths[0];
  const destinationDir = path.join(destinationParent, role.id);
  if (fs.existsSync(destinationDir)) {
    throw new Error(`导出目录已存在同名角色: ${role.id}`);
  }

  copyDirectoryRecursive(role.folderPath, destinationDir);
  return { exportedTo: destinationDir };
});

ipcMain.handle('write-log', (event, content) => {
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
  const activeRole = listRolesInternal().find((role) => role.isActive) || getRoleById(DEFAULT_ROLE_ID);
  if (activeRole) {
    shell.openPath(activeRole.soulPath);
  }
});

ipcMain.handle('open-roles-root', () => {
  shell.openPath(getRolesRoot());
});

ipcMain.handle('open-role-folder', (event, roleId) => {
  const role = getRoleById(roleId);
  if (!role) {
    throw new Error('角色不存在');
  }
  shell.openPath(role.folderPath);
});

ipcMain.handle('open-role-soul-file', (event, roleId) => {
  const role = getRoleById(roleId);
  if (!role) {
    throw new Error('角色不存在');
  }
  shell.openPath(role.soulPath);
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

ipcMain.on('resize-companion-window', (event, { width, height, anchor }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || !Number.isFinite(width) || !Number.isFinite(height)) {
    return;
  }

  const bounds = getAnchoredBounds(win, width, height, anchor);
  win.setBounds(bounds);
});

ipcMain.handle('get-window-metrics', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) {
    return null;
  }

  const bounds = win.getBounds();
  const { workArea } = screen.getDisplayMatching(bounds);
  return { bounds, workArea };
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
