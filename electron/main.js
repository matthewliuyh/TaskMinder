const { app, BrowserWindow, ipcMain, globalShortcut, Tray, Menu, nativeImage, shell } = require('electron')
const path = require('path')
const fs = require('fs')

let mainWindow = null
let tray = null
let reminderWindows = new Map()
let currentDockSide = 'right' // 抽屉吸附方向
let drawerCollapsed = false   // 当前是否收起
let userPinned = false        // 用户设置的置顶状态

const isDev = !app.isPackaged

// 抽屉尺寸常量
const PANEL_WIDTH = 400
const PANEL_HEIGHT = 700
const TAB_WIDTH = 22
const TAB_HEIGHT = 64

// 数据目录
const userDataPath = app.getPath('userData')
const dbPath = path.join(userDataPath, 'taskminder.db')

// 获取屏幕工作区
function getWorkArea() {
  const { screen } = require('electron')
  return screen.getPrimaryDisplay().workAreaSize
}

// 计算窗口位置
function calcWindowPos(collapsed, side) {
  const { width: sw, height: sh } = getWorkArea()
  if (collapsed) {
    // 收起态：标签条贴边
    if (side === 'right') return { x: sw - TAB_WIDTH, y: Math.round((sh - TAB_HEIGHT) / 2) }
    else return { x: 0, y: Math.round((sh - TAB_HEIGHT) / 2) }
  } else {
    // 展开态：面板贴边
    if (side === 'right') return { x: sw - PANEL_WIDTH, y: Math.round((sh - PANEL_HEIGHT) / 2) }
    else return { x: 0, y: Math.round((sh - PANEL_HEIGHT) / 2) }
  }
}

// 切换抽屉收起/展开
function applyDrawerState(collapsed, side) {
  if (!mainWindow) return
  drawerCollapsed = collapsed
  const pos = calcWindowPos(collapsed, side)
  if (collapsed) {
    mainWindow.setSize(TAB_WIDTH, TAB_HEIGHT)
    // 收起时置顶 + 鼠标穿透（悬停到标签时由前端控制恢复点击）
    mainWindow.setAlwaysOnTop(true, 'floating')
    mainWindow.setIgnoreMouseEvents(true, { forward: true })
  } else {
    mainWindow.setSize(PANEL_WIDTH, PANEL_HEIGHT)
    // 展开时恢复用户设置的置顶状态 + 允许鼠标事件
    mainWindow.setAlwaysOnTop(userPinned, 'floating')
    mainWindow.setIgnoreMouseEvents(false)
  }
  mainWindow.setPosition(pos.x, pos.y)
  mainWindow.webContents.send('drawer-state-changed', { collapsed, side })
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    minWidth: PANEL_WIDTH,
    minHeight: PANEL_HEIGHT,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  const distPath = path.join(__dirname, '..', 'dist', 'index.html')
  
  // 打包后 dist 在 asar 内，开发模式在项目目录
  if (app.isPackaged) {
    mainWindow.loadFile(distPath)
  } else if (fs.existsSync(distPath)) {
    mainWindow.loadFile(distPath)
  } else if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  mainWindow.once('ready-to-show', () => {
    const pos = calcWindowPos(false, currentDockSide)
    mainWindow.setPosition(pos.x, pos.y)
    mainWindow.show()
    mainWindow.focus()
  })

  mainWindow.on('close', (e) => {
    if (app.isQuiting) return
    e.preventDefault()
    mainWindow.hide()
  })

  // 失焦时自动收起（可选，先不加，让用户手动控制）
}

function createTray() {
  const trayIcon = path.join(__dirname, '..', 'public', 'tray.png')
  
  let trayImage
  if (fs.existsSync(trayIcon)) {
    trayImage = nativeImage.createFromPath(trayIcon).resize({ width: 16, height: 16 })
  } else {
    // 创建简单的16x16图标 (蓝色小方块)
    const size = 16
    const buf = Buffer.alloc(size * size * 4)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4
        const cx = size / 2, cy = size / 2, r = size / 2 - 1
        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
        if (dist <= r) {
          buf[i] = 79      // R
          buf[i + 1] = 70  // G
          buf[i + 2] = 229 // B
          buf[i + 3] = 255 // A
        } else {
          buf[i] = 0
          buf[i + 1] = 0
          buf[i + 2] = 0
          buf[i + 3] = 0
        }
      }
    }
    trayImage = nativeImage.createFromBuffer(buf, { width: size, height: size })
  }

  tray = new Tray(trayImage)
  const contextMenu = Menu.buildFromTemplate([
    { label: '显示面板', click: () => togglePanel() },
    { type: 'separator' },
    { label: '退出', click: () => { app.isQuiting = true; app.quit() } }
  ])
  tray.setToolTip('任务提醒助手')
  tray.setContextMenu(contextMenu)
  tray.on('click', () => togglePanel())
}

function togglePanel() {
  if (!mainWindow) return
  if (!mainWindow.isVisible()) {
    mainWindow.show()
    mainWindow.focus()
    applyDrawerState(false, currentDockSide)
  } else if (drawerCollapsed) {
    applyDrawerState(false, currentDockSide)
    mainWindow.focus()
  } else {
    applyDrawerState(true, currentDockSide)
  }
}

// ---- IPC 处理 ----
ipcMain.handle('get-db-path', () => dbPath)

ipcMain.handle('read-file', async (e, filePath) => {
  try {
    const data = await fs.promises.readFile(filePath)
    // 返回 base64 编码，避免 ArrayBuffer 传输问题
    return data.toString('base64')
  } catch (e) {
    return null
  }
})

ipcMain.handle('write-file', async (e, filePath, base64Data) => {
  try {
    const buf = Buffer.from(base64Data, 'base64')
    // 确保目录存在
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    await fs.promises.writeFile(filePath, buf)
    return true
  } catch (e) {
    console.error('Write file error:', e)
    return false
  }
})

ipcMain.handle('toggle-always-on-top', (e, flag) => {
  if (mainWindow) {
    userPinned = flag
    // 只在展开态才修改置顶（收起态始终置顶）
    if (!drawerCollapsed) {
      mainWindow.setAlwaysOnTop(flag, 'floating')
    }
    return flag
  }
  return false
})

ipcMain.handle('set-dock-side', (e, side) => {
  currentDockSide = side
  applyDrawerState(drawerCollapsed, side)
  return side
})

ipcMain.handle('show-reminder', (e, taskData) => {
  showReminderWindow(taskData)
})

ipcMain.handle('close-reminder', (e, taskId) => {
  const win = reminderWindows.get(taskId)
  if (win) {
    win.close()
    reminderWindows.delete(taskId)
  }
})

ipcMain.handle('hide-window', () => {
  if (mainWindow) mainWindow.hide()
})

ipcMain.handle('show-window', () => {
  if (mainWindow) {
    mainWindow.show()
    mainWindow.focus()
  }
})

ipcMain.handle('set-auto-start', (e, enabled) => {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: app.getPath('exe')
  })
  return enabled
})

ipcMain.handle('get-auto-start', () => {
  return app.getLoginItemSettings().openAtLogin
})

ipcMain.on('snooze-reminder', (e, data) => {
  if (mainWindow) mainWindow.webContents.send('snooze-reminder', data)
})

ipcMain.on('dismiss-reminder', (e, data) => {
  if (mainWindow) mainWindow.webContents.send('dismiss-reminder', data)
})

ipcMain.on('complete-task', (e, data) => {
  if (mainWindow) mainWindow.webContents.send('complete-task', data)
})

// 抽屉控制：收起/展开
ipcMain.on('collapse-drawer', () => {
  applyDrawerState(true, currentDockSide)
})

ipcMain.on('expand-drawer', () => {
  applyDrawerState(false, currentDockSide)
  mainWindow.focus()
})

ipcMain.on('toggle-drawer', () => {
  togglePanel()
})

// 标签条拖拽：只允许垂直移动
ipcMain.on('move-tab', (e, deltaY) => {
  if (!mainWindow || !drawerCollapsed) return
  const [x, y] = mainWindow.getPosition()
  const { height: sh } = getWorkArea()
  const newY = Math.max(0, Math.min(sh - TAB_HEIGHT, y + deltaY))
  mainWindow.setPosition(x, newY)
})

// 标签条悬停：恢复/移除鼠标穿透
ipcMain.on('set-ignore-mouse-events', (e, ignore) => {
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(ignore, { forward: true })
  }
})

// 提醒弹窗
function showReminderWindow(taskData) {
  const reminderWin = new BrowserWindow({
    width: 360,
    height: 250,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // 使用内联 HTML 来显示提醒
  const html = getReminderHTML(taskData)
  reminderWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

  reminderWin.once('ready-to-show', () => {
    const { screen } = require('electron')
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width, height } = primaryDisplay.workAreaSize
    reminderWin.setPosition(
      Math.round((width - 360) / 2),
      Math.round((height - 230) / 2)
    )
    reminderWin.show()
    reminderWin.focus()
  })

  reminderWindows.set(taskData.id, reminderWin)
  reminderWin.on('closed', () => {
    reminderWindows.delete(taskData.id)
  })
}

function getReminderHTML(task) {
  const typeColors = { key: '#ef4444', daily: '#3b82f6', security: '#f97316', tech: '#22c55e', career: '#a855f7' }
  const typeLabels = { key: '重点任务', daily: '日常维护', security: '安全工作', tech: '科创工作', career: '个人晋升' }
  const borderColor = typeColors[task.type] || '#6b7280'
  const typeName = typeLabels[task.type] || ''
  
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif;background:transparent;padding:8px;overflow:hidden}
.reminder{background:#ffffff;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.15);padding:20px 22px;border-left:4px solid ${borderColor}}
.title{font-size:14px;font-weight:600;color:#1a1a2e;margin-bottom:10px;display:flex;align-items:center;gap:6px}
.type-tag{font-size:10px;padding:1px 6px;border-radius:6px;color:white;background:${borderColor};font-weight:500}
.task-name{font-size:14px;color:#374151;margin-bottom:4px;font-weight:500}
.task-info{font-size:12px;color:#6b7280;margin-bottom:14px}
.remaining{color:#ef4444;font-weight:500}
.actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
select{padding:5px 8px;border:1px solid #e5e7eb;border-radius:6px;font-size:12px;background:white;cursor:pointer;font-family:inherit}
.btn{padding:5px 14px;border:none;border-radius:6px;font-size:12px;cursor:pointer;transition:all .15s;font-family:inherit}
.btn-snooze{background:#f3f4f6;color:#374151}.btn-snooze:hover{background:#e5e7eb}
.btn-complete{background:#22c55e;color:white}.btn-complete:hover{background:#16a34a}
.btn-dismiss{background:#ef4444;color:white}.btn-dismiss:hover{background:#dc2626}
</style></head><body>
<div class="reminder">
  <div class="title">&#x23F0; 任务即将到期 <span class="type-tag">${typeName}</span></div>
  <div class="task-name">${task.title}</div>
  <div class="task-info">截止：${task.deadline || ''}${task.remaining ? ' <span class="remaining">' + task.remaining + '</span>' : ''}</div>
  <div class="actions">
    <select id="snoozeSel">
      <option value="15">15分钟后</option>
      <option value="30" selected>30分钟后</option>
      <option value="60">1小时后</option>
      <option value="1440">1天后</option>
      <option value="custom">自定义...</option>
    </select>
    <button class="btn btn-snooze" id="btnSnooze">延后提醒</button>
    <button class="btn btn-complete" id="btnComplete">完成任务</button>
    <button class="btn btn-dismiss" id="btnDismiss">关闭提醒</button>
  </div>
</div>
<script>
const taskId = ${task.id}
document.getElementById('btnSnooze').onclick = () => {
  const v = document.getElementById('snoozeSel').value
  if (v === 'custom') {
    const m = 60
    window.electronAPI.sendSnoozeReminder({ taskId, minutes: m })
  } else {
    window.electronAPI.sendSnoozeReminder({ taskId, minutes: parseInt(v) })
  }
  window.close()
}
document.getElementById('btnComplete').onclick = () => {
  window.electronAPI.sendCompleteTask({ taskId })
  window.close()
}
document.getElementById('btnDismiss').onclick = () => {
  window.electronAPI.sendDismissReminder({ taskId })
  window.close()
}
<\/script></body></html>`
}

// ---- 启动 ----
app.whenReady().then(() => {
  createMainWindow()
  createTray()
  
  globalShortcut.register('Alt+T', () => {
    togglePanel()
  })
})

app.on('window-all-closed', () => {
  // 保持托盘运行
})

app.on('before-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('activate', () => {
  if (mainWindow) mainWindow.show()
})
