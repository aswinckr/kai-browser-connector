// Kai Browser Connector - Direct to Server
const DEFAULT_SERVER = 'wss://sunlight-relay-hub-production.up.railway.app/ws'

const BADGE = {
  on: { text: 'ON', color: '#8b5cf6' },
  off: { text: '', color: '#000000' },
  connecting: { text: '…', color: '#a78bfa' },
  error: { text: '!', color: '#DC2626' },
}

/** @type {WebSocket|null} */
let serverWs = null
/** @type {Promise<void>|null} */
let serverConnectPromise = null

let debuggerListenersInstalled = false
let nextSession = 1

/** @type {Map<number, {state:'connecting'|'connected', sessionId?:string, targetId?:string}>} */
const tabs = new Map()
/** @type {Map<string, number>} */
const tabBySession = new Map()
/** @type {Map<string, number>} */
const childSessionToTab = new Map()
/** @type {Map<number, {resolve:(v:any)=>void, reject:(e:Error)=>void}>} */
const pending = new Map()

async function getServerUrl() {
  const stored = await chrome.storage.local.get(['serverUrl'])
  return stored.serverUrl || DEFAULT_SERVER
}

async function getClientToken() {
  const stored = await chrome.storage.local.get(['clientToken'])
  return stored.clientToken || ''
}

function setBadge(tabId, kind) {
  const cfg = BADGE[kind]
  void chrome.action.setBadgeText({ tabId, text: cfg.text })
  void chrome.action.setBadgeBackgroundColor({ tabId, color: cfg.color })
  void chrome.action.setBadgeTextColor({ tabId, color: '#FFFFFF' }).catch(() => {})
}

async function ensureServerConnection() {
  if (serverWs && serverWs.readyState === WebSocket.OPEN) return
  if (serverConnectPromise) return await serverConnectPromise

  serverConnectPromise = (async () => {
    const serverUrl = await getServerUrl()
    const clientToken = await getClientToken()

    if (!clientToken) {
      throw new Error('No token configured. Open extension options to set your token.')
    }

    console.log('[kai] Connecting to', serverUrl)
    const ws = new WebSocket(serverUrl)
    serverWs = ws

    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('WebSocket connect timeout')), 10000)
      ws.onopen = () => {
        clearTimeout(t)
        // Authenticate immediately
        ws.send(JSON.stringify({ 
          id: 0,
          method: 'auth', 
          params: { token: clientToken } 
        }))
        resolve()
      }
      ws.onerror = () => {
        clearTimeout(t)
        reject(new Error('WebSocket connect failed'))
      }
      ws.onclose = (ev) => {
        clearTimeout(t)
        reject(new Error(`WebSocket closed (${ev.code} ${ev.reason || 'no reason'})`))
      }
    })

    ws.onmessage = (event) => void onServerMessage(String(event.data || ''))
    ws.onclose = () => onServerClosed('closed')
    ws.onerror = () => onServerClosed('error')

    if (!debuggerListenersInstalled) {
      debuggerListenersInstalled = true
      chrome.debugger.onEvent.addListener(onDebuggerEvent)
      chrome.debugger.onDetach.addListener(onDebuggerDetach)
    }
    
    console.log('[kai] Connected and authenticated!')
  })()

  try {
    await serverConnectPromise
  } finally {
    serverConnectPromise = null
  }
}

function onServerClosed(reason) {
  console.log('[kai] Disconnected:', reason)
  serverWs = null
  
  for (const [id, p] of pending.entries()) {
    pending.delete(id)
    p.reject(new Error(`Server disconnected (${reason})`))
  }

  for (const tabId of tabs.keys()) {
    void chrome.debugger.detach({ tabId }).catch(() => {})
    setBadge(tabId, 'error')
    void chrome.action.setTitle({
      tabId,
      title: 'Kai: disconnected (click to reconnect)',
    })
  }
  tabs.clear()
  tabBySession.clear()
  childSessionToTab.clear()
}

function sendToServer(payload) {
  const ws = serverWs
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error('Server not connected')
  }
  ws.send(JSON.stringify(payload))
}

async function maybeOpenOptionsOnce() {
  try {
    const stored = await chrome.storage.local.get(['optionsShown'])
    if (stored.optionsShown === true) return
    await chrome.storage.local.set({ optionsShown: true })
    await chrome.runtime.openOptionsPage()
  } catch {}
}

async function onServerMessage(text) {
  let msg
  try {
    msg = JSON.parse(text)
  } catch {
    return
  }

  // Handle ping
  if (msg?.method === 'ping') {
    try { sendToServer({ method: 'pong' }) } catch {}
    return
  }

  // Handle response to our requests
  if (msg && typeof msg.id !== 'undefined' && (msg.result !== undefined || msg.error !== undefined)) {
    const p = pending.get(msg.id)
    if (p) {
      pending.delete(msg.id)
      if (msg.error) p.reject(new Error(String(msg.error.message || msg.error)))
      else p.resolve(msg.result)
    }
    return
  }

  // Handle CDP command from server
  if (msg && typeof msg.id !== 'undefined' && msg.method === 'cdp') {
    try {
      const result = await handleCdpCommand(msg)
      sendToServer({ 
        method: 'cdp.response', 
        params: { id: msg.id, result } 
      })
    } catch (err) {
      sendToServer({ 
        method: 'cdp.response', 
        params: { id: msg.id, error: { message: err instanceof Error ? err.message : String(err) } }
      })
    }
  }
}

function getTabBySessionId(sessionId) {
  const direct = tabBySession.get(sessionId)
  if (direct) return { tabId: direct, kind: 'main' }
  const child = childSessionToTab.get(sessionId)
  if (child) return { tabId: child, kind: 'child' }
  return null
}

function getTabByTargetId(targetId) {
  for (const [tabId, tab] of tabs.entries()) {
    if (tab.targetId === targetId) return tabId
  }
  return null
}

async function attachTab(tabId) {
  const debuggee = { tabId }
  await chrome.debugger.attach(debuggee, '1.3')
  await chrome.debugger.sendCommand(debuggee, 'Page.enable').catch(() => {})

  const info = await chrome.debugger.sendCommand(debuggee, 'Target.getTargetInfo')
  const targetInfo = info?.targetInfo
  const targetId = String(targetInfo?.targetId || '').trim()
  if (!targetId) {
    throw new Error('Target.getTargetInfo returned no targetId')
  }

  const sessionId = `sl-tab-${nextSession++}`

  tabs.set(tabId, { state: 'connected', sessionId, targetId })
  tabBySession.set(sessionId, tabId)
  
  void chrome.action.setTitle({
    tabId,
    title: 'Kai: connected (click to disconnect)',
  })

  // Notify server about attached tab
  sendToServer({
    method: 'attach',
    params: { tabId, sessionId, targetId, targetInfo }
  })

  setBadge(tabId, 'on')
  return { sessionId, targetId }
}

async function detachTab(tabId, reason) {
  const tab = tabs.get(tabId)
  if (tab?.sessionId) {
    try {
      sendToServer({
        method: 'detach',
        params: { sessionId: tab.sessionId, reason }
      })
    } catch {}
    tabBySession.delete(tab.sessionId)
  }
  tabs.delete(tabId)

  for (const [childSessionId, parentTabId] of childSessionToTab.entries()) {
    if (parentTabId === tabId) childSessionToTab.delete(childSessionId)
  }

  try {
    await chrome.debugger.detach({ tabId })
  } catch {}

  setBadge(tabId, 'off')
  void chrome.action.setTitle({
    tabId,
    title: 'Kai Connector (click to connect)',
  })
}

async function connectOrToggleForActiveTab() {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true })
  const tabId = active?.id
  if (!tabId) return

  const existing = tabs.get(tabId)
  if (existing?.state === 'connected') {
    await detachTab(tabId, 'toggle')
    return
  }

  tabs.set(tabId, { state: 'connecting' })
  setBadge(tabId, 'connecting')
  void chrome.action.setTitle({
    tabId,
    title: 'Kai: connecting...',
  })

  try {
    await ensureServerConnection()
    await attachTab(tabId)
  } catch (err) {
    tabs.delete(tabId)
    setBadge(tabId, 'error')
    const message = err instanceof Error ? err.message : String(err)
    void chrome.action.setTitle({
      tabId,
      title: `Kai: ${message}`,
    })
    void maybeOpenOptionsOnce()
    console.error('[kai] attach failed:', message)
  }
}

async function handleCdpCommand(msg) {
  const method = String(msg?.params?.method || '').trim()
  const params = msg?.params?.params || undefined
  const sessionId = typeof msg?.params?.sessionId === 'string' ? msg.params.sessionId : undefined

  const bySession = sessionId ? getTabBySessionId(sessionId) : null
  const targetId = typeof params?.targetId === 'string' ? params.targetId : undefined
  
  const tabId =
    bySession?.tabId ||
    (targetId ? getTabByTargetId(targetId) : null) ||
    (() => {
      for (const [id, tab] of tabs.entries()) {
        if (tab.state === 'connected') return id
      }
      return null
    })()

  if (!tabId) throw new Error(`No attached tab for method ${method}`)

  const debuggee = { tabId }

  // Special handling for some methods
  if (method === 'Target.createTarget') {
    const url = typeof params?.url === 'string' ? params.url : 'about:blank'
    const tab = await chrome.tabs.create({ url, active: false })
    if (!tab.id) throw new Error('Failed to create tab')
    await new Promise((r) => setTimeout(r, 100))
    const attached = await attachTab(tab.id)
    return { targetId: attached.targetId }
  }

  if (method === 'Target.closeTarget') {
    const target = typeof params?.targetId === 'string' ? params.targetId : ''
    const toClose = target ? getTabByTargetId(target) : tabId
    if (!toClose) return { success: false }
    try { await chrome.tabs.remove(toClose) } catch {}
    return { success: true }
  }

  if (method === 'Target.activateTarget') {
    const target = typeof params?.targetId === 'string' ? params.targetId : ''
    const toActivate = target ? getTabByTargetId(target) : tabId
    if (!toActivate) return {}
    const tab = await chrome.tabs.get(toActivate).catch(() => null)
    if (!tab) return {}
    if (tab.windowId) {
      await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {})
    }
    await chrome.tabs.update(toActivate, { active: true }).catch(() => {})
    return {}
  }

  const tabState = tabs.get(tabId)
  const mainSessionId = tabState?.sessionId
  const debuggerSession =
    sessionId && mainSessionId && sessionId !== mainSessionId
      ? { ...debuggee, sessionId }
      : debuggee

  return await chrome.debugger.sendCommand(debuggerSession, method, params)
}

function onDebuggerEvent(source, method, params) {
  const tabId = source.tabId
  if (!tabId) return
  const tab = tabs.get(tabId)
  if (!tab?.sessionId) return

  if (method === 'Target.attachedToTarget' && params?.sessionId) {
    childSessionToTab.set(String(params.sessionId), tabId)
  }

  if (method === 'Target.detachedFromTarget' && params?.sessionId) {
    childSessionToTab.delete(String(params.sessionId))
  }

  try {
    sendToServer({
      method: 'cdp.event',
      params: {
        sessionId: source.sessionId || tab.sessionId,
        method,
        params,
      },
    })
  } catch {}
}

function onDebuggerDetach(source, reason) {
  const tabId = source.tabId
  if (!tabId) return
  if (!tabs.has(tabId)) return
  void detachTab(tabId, reason)
}

chrome.action.onClicked.addListener(() => void connectOrToggleForActiveTab())

chrome.runtime.onInstalled.addListener(() => {
  void chrome.runtime.openOptionsPage()
})
