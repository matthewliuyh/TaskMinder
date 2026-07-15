const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // 数据库路径
  getDbPath: () => ipcRenderer.invoke('get-db-path'),
  
  // 文件操作
  readFile: (path) => ipcRenderer.invoke('read-file', path),
  writeFile: (path, data) => ipcRenderer.invoke('write-file', path, data),
  
  // 窗口控制
  toggleAlwaysOnTop: (flag) => ipcRenderer.invoke('toggle-always-on-top', flag),
  setDockSide: (side) => ipcRenderer.invoke('set-dock-side', side),
  hideWindow: () => ipcRenderer.invoke('hide-window'),
  showWindow: () => ipcRenderer.invoke('show-window'),
  
  // 自启动
  setAutoStart: (enabled) => ipcRenderer.invoke('set-auto-start', enabled),
  getAutoStart: () => ipcRenderer.invoke('get-auto-start'),
  
  // 提醒
  showReminder: (data) => ipcRenderer.invoke('show-reminder', data),
  closeReminder: (id) => ipcRenderer.invoke('close-reminder', id),
  
  // 抽屉控制
  collapseDrawer: () => ipcRenderer.send('collapse-drawer'),
  expandDrawer: () => ipcRenderer.send('expand-drawer'),
  toggleDrawer: () => ipcRenderer.send('toggle-drawer'),
  moveTab: (deltaY) => ipcRenderer.send('move-tab', deltaY),
  setIgnoreMouseEvents: (ignore) => ipcRenderer.send('set-ignore-mouse-events', ignore),

  // 抽屉状态变更回调
  onDrawerStateChanged: (cb) => {
    ipcRenderer.removeAllListeners('drawer-state-changed')
    ipcRenderer.on('drawer-state-changed', (e, data) => cb(data))
  },

  // 提醒回调（主窗口用）
  onSnoozeReminder: (cb) => {
    ipcRenderer.removeAllListeners('snooze-reminder')
    ipcRenderer.on('snooze-reminder', (e, data) => cb(data))
  },
  onDismissReminder: (cb) => {
    ipcRenderer.removeAllListeners('dismiss-reminder')
    ipcRenderer.on('dismiss-reminder', (e, data) => cb(data))
  },
  onCompleteTask: (cb) => {
    ipcRenderer.removeAllListeners('complete-task')
    ipcRenderer.on('complete-task', (e, data) => cb(data))
  },

  // 提醒窗口用：发送延后/关闭/完成任务事件给主进程
  sendSnoozeReminder: (data) => ipcRenderer.send('snooze-reminder', data),
  sendDismissReminder: (data) => ipcRenderer.send('dismiss-reminder', data),
  sendCompleteTask: (data) => ipcRenderer.send('complete-task', data),
})
