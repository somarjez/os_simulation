import { useEffect, useState } from 'react'
import { Monitor, Palette, HardDrive, Shield, Info, Users, RefreshCw, ChevronRight } from 'lucide-react'
import {
  BUILTIN_WALLPAPER_OPTIONS,
  resolveWallpaperPresentation,
  resolveWallpaperValue,
  loadLocalUiSettingsBase
} from '../utils/personalization.js'

const SECTIONS = [
  { id: 'system',          label: 'System',          icon: Monitor,   desc: 'Display, sound, notifications' },
  { id: 'personalization', label: 'Personalization',  icon: Palette,   desc: 'Background, colors, themes' },
  { id: 'storage',         label: 'Storage',          icon: HardDrive, desc: 'Disk usage, cleanup' },
  { id: 'security',        label: 'Security',         icon: Shield,    desc: 'Permissions, access control' },
  { id: 'accounts',        label: 'Accounts',         icon: Users,     desc: 'Users, sign-in options' },
  { id: 'updates',         label: 'Windows Update',   icon: RefreshCw, desc: 'Updates, restart options' },
  { id: 'about',           label: 'About',            icon: Info,      desc: 'Device specs, version info' },
]

export default function SettingsApp({ initialSection = 'system' }) {
  const [activeSection, setActiveSection] = useState(initialSection)

  const baseSettings = loadLocalUiSettingsBase()
  const [settings, setSettings] = useState({
    theme: baseSettings.theme,
    accentColor: baseSettings.accentColor,
    fontSize: baseSettings.fontSize,
    highContrast: baseSettings.highContrast,
    wallpaper: baseSettings.wallpaperId,
    language: localStorage.getItem('jezos_language') || 'en',
    timeFormat: localStorage.getItem('jezos_time_format') || '12h'
  })

  const [systemInfo, setSystemInfo]     = useState(null)
  const [storageInfo, setStorageInfo]   = useState(null)
  const [users, setUsers]               = useState([])
  const [permissions, setPermissions]   = useState({ fileAccess: true, networkAccess: true, notifications: true })
  const [updateStatus, setUpdateStatus] = useState(null)
  const [updateHistory, setUpdateHistory] = useState([])
  const [updateBusy, setUpdateBusy]     = useState(false)
  const [updateError, setUpdateError]   = useState('')
  const [securityLogs, setSecurityLogs] = useState([])
  const [userRole, setUserRole]         = useState(null)

  useEffect(() => {
    loadSystemInfo(); loadStorageInfo(); loadUsers()
    loadPermissions(); loadUpdateStatus(); loadSecurityData()
  }, [])

  useEffect(() => { if (initialSection) setActiveSection(initialSection) }, [initialSection])
  useEffect(() => { applySettings(settings) }, [settings])

  const wallpaperOptions = BUILTIN_WALLPAPER_OPTIONS

  const hexToRgba = (hex, alpha) => {
    const s = hex.replace('#', '')
    if (s.length !== 6) return `rgba(0,103,192,${alpha})`
    return `rgba(${parseInt(s.slice(0,2),16)},${parseInt(s.slice(2,4),16)},${parseInt(s.slice(4,6),16)},${alpha})`
  }

  const applySettings = (next) => {
    const root = document.documentElement
    const wp = resolveWallpaperPresentation(next.wallpaper)
    root.setAttribute('data-theme', next.theme)
    root.setAttribute('data-font', next.fontSize)
    root.setAttribute('data-contrast', next.highContrast ? 'high' : 'normal')
    root.style.setProperty('--win-accent', next.accentColor)
    root.style.setProperty('--win-accent-soft', hexToRgba(next.accentColor, 0.16))
    root.style.setProperty('--desktop-wallpaper', resolveWallpaperValue(next.wallpaper))
    root.style.setProperty('--desktop-wallpaper-size', wp.size)
    root.style.setProperty('--desktop-wallpaper-position', wp.position)
    root.style.setProperty('--desktop-wallpaper-color', wp.color)
  }

  const loadSystemInfo = async () => {
    try {
      const [pR, rR] = await Promise.all([fetch('http://localhost:8000/process/list'), fetch('http://localhost:8000/system/resources')])
      if (pR.ok && rR.ok) {
        const processes = await pR.json(); const resources = await rR.json()
        setSystemInfo({ os: 'JezOS', version: '1.0.0', kernel: 'FastAPI Backend', uptime: calculateUptime(), processes: processes.filter(p => p.state === 'running').length, memory: resources.usedMemory, maxMemory: resources.maxMemory, cpu: resources.cpuUsage })
      }
    } catch {}
  }

  const loadStorageInfo = async () => {
    try {
      const r = await fetch('http://localhost:8000/system/storage')
      if (r.ok) {
        const d = await r.json()
        setStorageInfo({ total: Math.round(d.total_capacity_bytes/(1024*1024)), used: Math.round(d.used_bytes/(1024*1024)), available: Math.round(d.free_bytes/(1024*1024)), files: d.file_count, directories: d.directory_count, usagePercent: d.usage_percent, byCategory: d.storage_by_category })
      }
    } catch {
      setStorageInfo({ total:100, used:0, available:100, files:0, directories:0, usagePercent:0, byCategory:{} })
    }
  }

  const loadUsers = async () => {
    try { const r = await fetch('http://localhost:8000/user/list'); if (r.ok) setUsers(await r.json()) } catch {}
  }

  const loadPermissions = () => {
    setPermissions({ fileAccess: localStorage.getItem('jezos_perm_files') !== 'false', networkAccess: localStorage.getItem('jezos_perm_network') !== 'false', notifications: localStorage.getItem('jezos_perm_notifications') !== 'false' })
  }

  const loadSecurityData = async () => {
    try {
      const headers = { 'session-token': localStorage.getItem('session_token') || '' }
      const rR = await fetch('http://localhost:8000/security/user-role', { headers })
      if (rR.ok) {
        const rd = await rR.json(); setUserRole(rd.role)
        if (rd.role === 'admin') {
          const lR = await fetch('http://localhost:8000/security/logs?limit=50', { headers })
          if (lR.ok) { const ld = await lR.json(); setSecurityLogs(ld.logs || []) }
        }
      }
    } catch {}
  }

  const loadUpdateStatus = async () => {
    try {
      const r = await fetch('http://localhost:8000/update/status')
      if (r.ok) { const d = await r.json(); setUpdateStatus(d.state || null); setUpdateHistory(d.history || []) }
    } catch { setUpdateError('Failed to load update status') }
  }

  const checkForUpdates = async () => {
    setUpdateBusy(true); setUpdateError('')
    try { const r = await fetch('http://localhost:8000/update/check', { method:'POST' }); if (r.ok) await loadUpdateStatus(); else setUpdateError('Unable to check for updates') }
    catch { setUpdateError('Unable to check for updates') }
    finally { setUpdateBusy(false) }
  }

  const installUpdate = async () => {
    setUpdateBusy(true); setUpdateError('')
    try { const r = await fetch('http://localhost:8000/update/install', { method:'POST' }); if (r.ok) await loadUpdateStatus(); else setUpdateError('Update installation failed') }
    catch { setUpdateError('Update installation failed') }
    finally { setUpdateBusy(false) }
  }

  const completeRestart = () => { setUpdateError(''); window.dispatchEvent(new CustomEvent('jez_os_restart', { detail: { update: true } })) }

  const uninstallUpdate = async () => {
    setUpdateBusy(true); setUpdateError('')
    try { const r = await fetch('http://localhost:8000/update/uninstall', { method:'POST' }); if (r.ok) await loadUpdateStatus(); else setUpdateError('Update uninstall failed') }
    catch { setUpdateError('Update uninstall failed') }
    finally { setUpdateBusy(false) }
  }

  const calculateUptime = () => {
    const start = localStorage.getItem('jezos_boot_time')
    if (!start) return 'Unknown'
    const uptime = Math.floor((Date.now() - parseInt(start)) / 1000)
    return `${Math.floor(uptime/3600)}h ${Math.floor((uptime%3600)/60)}m`
  }

  const updateSetting = (key, value) => {
    const storageKeys = { theme:'jezos_theme', accentColor:'jezos_accent', fontSize:'jezos_font_size', language:'jezos_language', timeFormat:'jezos_time_format', highContrast:'jezos_high_contrast', wallpaper:'jezos_wallpaper' }
    setSettings(prev => ({ ...prev, [key]: value }))
    localStorage.setItem(storageKeys[key] || `jezos_${key}`, typeof value === 'boolean' ? value.toString() : value)
    window.dispatchEvent(new CustomEvent('jezos_settings_updated', { detail: { key, value } }))
  }

  const updatePermission = (key, value) => {
    setPermissions(prev => ({ ...prev, [key]: value }))
    localStorage.setItem(`jezos_perm_${key.replace('Access','').toLowerCase()}`, value.toString())
  }

  const formatDateTime = (value) => {
    if (!value) return 'Never'
    try {
      let s = value
      if (!s.endsWith('Z') && !s.includes('+') && !s.includes('T00:00:00')) s += 'Z'
      const d = new Date(s)
      if (Number.isNaN(d.getTime())) return value
      return d.toLocaleString(undefined, { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })
    } catch { return value }
  }

  const getUpdateStatusLabel = (status) => {
    const map = { available:'Update available', up_to_date:'Up to date', downloading:'Downloading update', applying:'Applying update', installed:'Installed — restart required', rollback_ready:'Rollback ready — restart required' }
    return map[status] || 'Idle'
  }

  // ─────────── Section renderers ───────────

  const renderSection = () => {
    switch (activeSection) {

      case 'system': return (
        <div className="s-content">
          <div className="s-section-hero">
            <Monitor size={28} className="s-section-hero-icon" />
            <div><div className="s-section-hero-title">System</div><div className="s-section-hero-sub">Display · Sound · Notifications · Power</div></div>
          </div>
          {systemInfo ? (
            <>
              <div className="s-card">
                <div className="s-card-title">Performance</div>
                <div className="s-stat-row">
                  <div className="s-stat-block">
                    <div className="s-stat-label">CPU Usage</div>
                    <div className="s-stat-value">{systemInfo.cpu}%</div>
                    <div className="s-bar"><div className="s-bar-fill" style={{width:`${systemInfo.cpu}%`, background: systemInfo.cpu>80?'#ef4444':'#0067c0'}} /></div>
                  </div>
                  <div className="s-stat-block">
                    <div className="s-stat-label">Memory</div>
                    <div className="s-stat-value">{systemInfo.memory} <span className="s-stat-of">/ {systemInfo.maxMemory} MB</span></div>
                    <div className="s-bar"><div className="s-bar-fill" style={{width:`${(systemInfo.memory/systemInfo.maxMemory)*100}%`}} /></div>
                  </div>
                  <div className="s-stat-block">
                    <div className="s-stat-label">Processes</div>
                    <div className="s-stat-value">{systemInfo.processes}</div>
                    <div className="s-stat-sub">running</div>
                  </div>
                  <div className="s-stat-block">
                    <div className="s-stat-label">Uptime</div>
                    <div className="s-stat-value">{systemInfo.uptime}</div>
                    <div className="s-stat-sub">since boot</div>
                  </div>
                </div>
              </div>
              <div className="s-card">
                <div className="s-card-title">System Details</div>
                <div className="s-info-grid">
                  {[
                    ['Operating System', `${systemInfo.os} ${updateStatus?.current_version || systemInfo.version}`],
                    ['Kernel', systemInfo.kernel],
                    ['Device Name', 'JEZ-Workstation'],
                    ['System Type', '64-bit OS, x64-based'],
                    ['Processor', 'JezCore i7-1260U @ 2.10 GHz'],
                    ['Installed RAM', '16.0 GB'],
                    ['Graphics', 'JezOS Iris Xe'],
                    ['Storage', '512 GB NVMe SSD'],
                    ['BIOS', 'JEZEFI v2.3.7 (01/12/2026)'],
                    ['Secure Boot', 'On'],
                    ['Virtualization', 'Enabled'],
                    ['Build', '26.2.105.742 (Canary)'],
                  ].map(([k,v]) => (
                    <div key={k} className="s-info-row">
                      <span className="s-info-key">{k}</span>
                      <span className="s-info-val">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : <div className="s-loading"><div className="s-spinner" /><span>Loading system information…</span></div>}
        </div>
      )

      case 'personalization': return (
        <div className="s-content">
          <div className="s-section-hero">
            <Palette size={28} className="s-section-hero-icon" />
            <div><div className="s-section-hero-title">Personalization</div><div className="s-section-hero-sub">Background · Colors · Themes · Fonts</div></div>
          </div>

          <div className="s-card">
            <div className="s-card-title">Theme</div>
            <div className="s-theme-row">
              {['light','dark'].map(t => (
                <button key={t} type="button" className={`s-theme-btn ${settings.theme===t?'active':''}`} onClick={() => updateSetting('theme', t)}>
                  <div className={`s-theme-thumb ${t}`}>
                    <div className="s-theme-thumb-bar" />
                    <div className="s-theme-thumb-win" />
                  </div>
                  <span>{t.charAt(0).toUpperCase()+t.slice(1)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="s-card">
            <div className="s-card-title">Accent Color</div>
            <div className="s-color-row">
              {['#0067c0','#7c3aed','#db2777','#dc2626','#ea580c','#16a34a','#0891b2','#ca8a04'].map(color => (
                <button key={color} type="button" className={`s-color-dot ${settings.accentColor===color?'active':''}`} style={{background:color}} onClick={() => updateSetting('accentColor', color)}>
                  {settings.accentColor===color && <span className="s-color-check">✓</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="s-card">
            <div className="s-card-title">Background</div>
            <div className="s-wallpaper-grid">
              {wallpaperOptions.map(opt => (
                <button key={opt.id} type="button" className={`s-wallpaper-item ${settings.wallpaper===opt.id?'active':''}`} onClick={() => updateSetting('wallpaper', opt.id)}>
                  <div className="s-wallpaper-thumb" style={opt.value.startsWith('url') ? { backgroundImage:opt.value, backgroundSize:opt.size||'cover', backgroundPosition:opt.position||'center', backgroundColor:opt.color||'transparent' } : { background:opt.value }} />
                  <span className="s-wallpaper-label">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="s-card">
            <div className="s-card-title">Display & Region</div>
            <div className="s-settings-list">
              <div className="s-setting-row">
                <div className="s-setting-info"><div className="s-setting-name">Font Size</div><div className="s-setting-desc">Adjust UI text size</div></div>
                <select className="s-select" value={settings.fontSize} onChange={e => updateSetting('fontSize', e.target.value)}>
                  <option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option>
                </select>
              </div>
              <div className="s-setting-row">
                <div className="s-setting-info"><div className="s-setting-name">Language</div><div className="s-setting-desc">Display language</div></div>
                <select className="s-select" value={settings.language} onChange={e => updateSetting('language', e.target.value)}>
                  <option value="en">English</option><option value="es">Español</option><option value="fr">Français</option><option value="de">Deutsch</option>
                </select>
              </div>
              <div className="s-setting-row">
                <div className="s-setting-info"><div className="s-setting-name">Time Format</div><div className="s-setting-desc">Clock display format</div></div>
                <select className="s-select" value={settings.timeFormat} onChange={e => updateSetting('timeFormat', e.target.value)}>
                  <option value="12h">12-hour</option><option value="24h">24-hour</option>
                </select>
              </div>
              <div className="s-setting-row">
                <div className="s-setting-info"><div className="s-setting-name">High Contrast</div><div className="s-setting-desc">Increase contrast for readability</div></div>
                <label className="s-toggle">
                  <input type="checkbox" checked={settings.highContrast} onChange={e => updateSetting('highContrast', e.target.checked)} />
                  <span className="s-toggle-track"><span className="s-toggle-thumb" /></span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )

      case 'storage': {
        const pct = storageInfo ? (storageInfo.used / storageInfo.total) * 100 : 0
        const warn = pct > 90 ? 'critical' : pct > 75 ? 'warning' : 'ok'
        return (
          <div className="s-content">
            <div className="s-section-hero">
              <HardDrive size={28} className="s-section-hero-icon" />
              <div><div className="s-section-hero-title">Storage</div><div className="s-section-hero-sub">Disk usage · Cleanup · Categories</div></div>
            </div>
            {storageInfo ? (
              <>
                {warn !== 'ok' && (
                  <div className={`s-alert ${warn}`}>
                    <span className="s-alert-icon">{warn==='critical'?'🔴':'🟡'}</span>
                    <div>
                      <div className="s-alert-title">{warn==='critical'?'Critical: Storage Full':'Storage Running Low'}</div>
                      <div className="s-alert-msg">Your storage is {pct.toFixed(1)}% full. {warn==='critical'?'Delete files immediately.':'Consider cleanup soon.'}</div>
                    </div>
                  </div>
                )}
                <div className="s-card s-storage-overview">
                  <div className="s-storage-donut-wrap">
                    <svg viewBox="0 0 120 120" width="120" height="120">
                      <circle cx="60" cy="60" r="50" fill="none" stroke="#e5e7eb" strokeWidth="16"/>
                      <circle cx="60" cy="60" r="50" fill="none"
                        stroke={warn==='critical'?'#ef4444':warn==='warning'?'#f59e0b':'#0067c0'}
                        strokeWidth="16"
                        strokeDasharray={`${(pct/100)*314.16} 314.16`}
                        strokeLinecap="round"
                        transform="rotate(-90 60 60)"
                      />
                      <text x="60" y="55" textAnchor="middle" fontSize="14" fontWeight="700" fill="#111">{pct.toFixed(0)}%</text>
                      <text x="60" y="70" textAnchor="middle" fontSize="9" fill="#888">used</text>
                    </svg>
                  </div>
                  <div className="s-storage-legend">
                    <div className="s-storage-legend-row"><span className="s-legend-dot" style={{background:'#0067c0'}}/><span>{storageInfo.used} MB used</span></div>
                    <div className="s-storage-legend-row"><span className="s-legend-dot" style={{background:'#e5e7eb'}}/><span>{storageInfo.available} MB free</span></div>
                    <div className="s-storage-legend-total">{storageInfo.total} MB total</div>
                  </div>
                  <div className="s-storage-stats">
                    {[['Files', storageInfo.files],['Directories', storageInfo.directories||0]].map(([k,v])=>(
                      <div key={k} className="s-storage-stat-box"><div className="s-storage-stat-val">{v}</div><div className="s-storage-stat-key">{k}</div></div>
                    ))}
                  </div>
                </div>
                {storageInfo.byCategory && Object.keys(storageInfo.byCategory).length > 0 && (
                  <div className="s-card">
                    <div className="s-card-title">Storage by Category</div>
                    <div className="s-cat-list">
                      {Object.entries(storageInfo.byCategory).map(([cat, data]) => {
                        const catPct = ((data.bytes/(storageInfo.used*1024*1024))*100).toFixed(1)
                        return (
                          <div key={cat} className="s-cat-row">
                            <div className="s-cat-header"><span className="s-cat-name">{cat}</span><span className="s-cat-size">{(data.bytes/(1024*1024)).toFixed(2)} MB</span></div>
                            <div className="s-bar"><div className="s-bar-fill" style={{width:`${catPct}%`, background:'#0067c0'}} /></div>
                            <div className="s-cat-files">{data.files} {cat==='Apps'?`app${data.files!==1?'s':''}`:`file${data.files!==1?'s':''}`}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                {warn !== 'ok' && (
                  <div className="s-card">
                    <div className="s-card-title">Cleanup Recommendations</div>
                    <div className="s-cleanup-list">
                      {[['📁','Empty Trash','Permanently delete files from your trash folder'],['🗑️','Remove Temp Files','Clean up temporary and cache files'],['🎬','Delete Large Files','Look for large media files you no longer need'],['📦','Uninstall Apps','Remove applications you no longer use']].map(([icon,title,desc])=>(
                        <div key={title} className="s-cleanup-row">
                          <span className="s-cleanup-icon">{icon}</span>
                          <div><div className="s-cleanup-title">{title}</div><div className="s-cleanup-desc">{desc}</div></div>
                          <ChevronRight size={16} className="s-chevron" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <button className="s-btn" onClick={loadStorageInfo}>↻ Refresh Storage Info</button>
              </>
            ) : <div className="s-loading"><div className="s-spinner"/><span>Loading storage…</span></div>}
          </div>
        )
      }

      case 'security': return (
        <div className="s-content">
          <div className="s-section-hero">
            <Shield size={28} className="s-section-hero-icon" />
            <div><div className="s-section-hero-title">Security & Permissions</div><div className="s-section-hero-sub">Access control · App permissions · Logs</div></div>
          </div>
          <div className="s-card">
            <div className="s-card-title">User Access Control</div>
            <div className="s-role-badge-row">
              <div className={`s-role-badge ${userRole==='admin'?'admin':'user'}`}>
                <span>{userRole==='admin'?'🛡️':'👤'}</span>
                <div>
                  <div className="s-role-name">{userRole==='admin'?'Administrator':'Standard User'}</div>
                  <div className="s-role-desc">{userRole==='admin'?'Full system access':'Limited access'}</div>
                </div>
              </div>
            </div>
          </div>
          <div className="s-card">
            <div className="s-card-title">App Permissions</div>
            <div className="s-settings-list">
              {[
                ['fileAccess','File System Access','Allow apps to read and write files'],
                ['networkAccess','Network Access','Allow apps to connect to the internet'],
                ['notifications','Notifications','Allow apps to show notifications'],
              ].map(([key, name, desc]) => (
                <div key={key} className="s-setting-row">
                  <div className="s-setting-info"><div className="s-setting-name">{name}</div><div className="s-setting-desc">{desc}</div></div>
                  <label className="s-toggle">
                    <input type="checkbox" checked={permissions[key]} onChange={e => updatePermission(key, e.target.checked)} />
                    <span className="s-toggle-track"><span className="s-toggle-thumb" /></span>
                  </label>
                </div>
              ))}
            </div>
          </div>
          {userRole === 'admin' && (
            <div className="s-card">
              <div className="s-card-title">Security Event Log</div>
              {securityLogs.length > 0 ? (
                <div className="s-log-list">
                  {securityLogs.map(log => (
                    <div key={log.id} className="s-log-row">
                      <span className={`s-log-badge ${log.success?'ok':'fail'}`}>{log.event_type}</span>
                      <div className="s-log-body">
                        <div className="s-log-main"><strong>{log.username}</strong> — {log.action}{log.resource&&<span className="s-log-res"> ({log.resource})</span>}</div>
                        {log.details && <div className="s-log-details">{log.details}</div>}
                      </div>
                      <div className="s-log-time">{new Date(log.timestamp).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              ) : <div className="s-empty-state">No security events logged yet.</div>}
            </div>
          )}
        </div>
      )

      case 'accounts': return (
        <div className="s-content">
          <div className="s-section-hero">
            <Users size={28} className="s-section-hero-icon" />
            <div><div className="s-section-hero-title">Accounts</div><div className="s-section-hero-sub">Users · Sign-in · Permissions</div></div>
          </div>
          <div className="s-card">
            <div className="s-card-title">User Accounts</div>
            <div className="s-user-list">
              {users.map(u => (
                <div key={u.id} className="s-user-row">
                  <div className="s-user-avatar">{u.username.charAt(0).toUpperCase()}</div>
                  <div className="s-user-info">
                    <div className="s-user-name">{u.username}</div>
                    <div className="s-user-meta">{u.role} · {u.home_dir}</div>
                  </div>
                  <span className={`s-user-role-chip ${u.role}`}>{u.role}</span>
                </div>
              ))}
              {users.length === 0 && <div className="s-empty-state">No user accounts found.</div>}
            </div>
          </div>
        </div>
      )

      case 'about': return (
        <div className="s-content">
          <div className="s-section-hero">
            <Info size={28} className="s-section-hero-icon" />
            <div><div className="s-section-hero-title">About JezOS</div><div className="s-section-hero-sub">Version · Device specs · System info</div></div>
          </div>
          <div className="s-card s-about-hero-card">
            <div className="s-about-logo-row">
              <div className="s-about-logo-icon">⊞</div>
              <div>
                <div className="s-about-logo-name">JezOS</div>
                <div className="s-about-logo-ver">Version {updateStatus?.current_version || '1.0.0'} · Canary Channel</div>
              </div>
            </div>
            <div className="s-about-pills">
              {['Canary Channel','Build 26.2.105.742','Security: Enhanced'].map(p=><span key={p} className="s-pill">{p}</span>)}
            </div>
            <p className="s-about-desc">JezOS is a modern, simulated desktop OS built with React and FastAPI.</p>
          </div>
          <div className="s-card">
            <div className="s-card-title">Device Specs</div>
            <div className="s-info-grid">
              {[['Device name','JEZ-Workstation'],['System type','64-bit OS, x64-based processor'],['Processor','JezCore i7-1260U @ 2.10 GHz'],['Installed RAM','16.0 GB'],['Graphics','JezOS Iris Xe'],['Storage','512 GB NVMe SSD']].map(([k,v])=>(
                <div key={k} className="s-info-row"><span className="s-info-key">{k}</span><span className="s-info-val">{v}</span></div>
              ))}
            </div>
          </div>
          <div className="s-card">
            <div className="s-card-title">System Info</div>
            <div className="s-info-grid">
              {[['Kernel','JezOS NT 10.0.22631'],['Experience pack','JezOS Shell 8.4.1'],['Device ID','JEZ-9F3A-7B2C-41D6'],['BIOS','JEZEFI v2.3.7 (01/12/2026)'],['Secure Boot','On'],['Virtualization','Enabled'],['Frontend','React + Vite'],['Backend','FastAPI + Python'],['Database','SQLite'],['Install date','01/15/2026'],['Last update','02/04/2026']].map(([k,v])=>(
                <div key={k} className="s-info-row"><span className="s-info-key">{k}</span><span className="s-info-val">{v}</span></div>
              ))}
            </div>
          </div>
        </div>
      )

      case 'updates': return (
        <div className="s-content">
          <div className="s-section-hero">
            <RefreshCw size={28} className="s-section-hero-icon" />
            <div><div className="s-section-hero-title">Windows Update</div><div className="s-section-hero-sub">Updates · Restart · History</div></div>
          </div>
          <div className="s-card">
            <div className="s-card-title">Update Status</div>
            <div className="s-update-status-row">
              <div className={`s-update-status-icon ${updateStatus?.update_available?'pulse':''}`}>
                {updateStatus?.update_available ? '🔵' : '✅'}
              </div>
              <div>
                <div className="s-update-status-label">{getUpdateStatusLabel(updateStatus?.status)}</div>
                <div className="s-update-status-ver">Current version: {updateStatus?.current_version || '1.0.0'} · Channel: {updateStatus?.channel || 'stable'}</div>
                <div className="s-update-status-ver">Last checked: {formatDateTime(updateStatus?.last_checked)}</div>
              </div>
            </div>
            {updateStatus?.progress > 0 && (
              <div className="s-update-progress-wrap">
                <div className="s-bar"><div className="s-bar-fill" style={{width:`${updateStatus.progress}%`}} /></div>
                <span className="s-update-pct">{updateStatus.progress}%</span>
              </div>
            )}
          </div>
          {updateStatus?.update_available && (
            <div className="s-card s-update-avail-card">
              <div className="s-update-avail-header">
                <span className="s-update-avail-dot" />
                <div><div className="s-update-avail-title">Version {updateStatus.latest_version} available</div>
                {updateStatus?.patch_notes && (
                  <ul className="s-update-notes">
                    {updateStatus.patch_notes.split('\n').filter(Boolean).map((note,i)=><li key={i}>{note}</li>)}
                  </ul>
                )}
                </div>
              </div>
            </div>
          )}
          {updateStatus?.restart_required && (
            <div className="s-card">
              <div className="s-card-title">Restart Required</div>
              <p className="s-empty-state" style={{marginBottom:12}}>Finish installing the update by restarting the system.</p>
              <button className="s-btn primary" onClick={completeRestart} disabled={updateBusy}>Complete Restart</button>
            </div>
          )}
          {updateError && <div className="s-alert critical"><span className="s-alert-icon">⚠️</span><div className="s-alert-msg">{updateError}</div></div>}
          <div className="s-update-actions">
            <button className="s-btn secondary" onClick={checkForUpdates} disabled={updateBusy}>{updateBusy?'Checking…':'Check for Updates'}</button>
            <button className="s-btn primary" onClick={installUpdate} disabled={updateBusy||!updateStatus?.update_available}>{updateBusy?'Working…':'Install Update'}</button>
            <button className="s-btn secondary" onClick={uninstallUpdate} disabled={updateBusy||updateHistory.length<2} title={updateHistory.length<2?'Need at least one update to rollback':''}>Uninstall Update</button>
          </div>
          <div className="s-card">
            <div className="s-card-title">Update History</div>
            {updateHistory.length === 0 ? <div className="s-empty-state">No updates installed yet.</div> : (
              <div className="s-update-history-list">
                {updateHistory.map(e => (
                  <div key={e.id} className="s-update-history-row">
                    <div><div className="s-update-history-ver">Version {e.version}</div><div className="s-update-history-date">{formatDateTime(e.applied_at)}</div></div>
                    <span className="s-pill">{e.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )

      default: return null
    }
  }

  return (
    <div className="settings-app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .settings-app {
          font-family: 'Poppins', sans-serif;
          display: flex;
          height: 100%;
          width: 100%;
          background: #f3f3f3;
          overflow: hidden;
          font-size: 13px;
          color: #1a1a1a;
        }

        /* ══════════════════════
           SIDEBAR
        ══════════════════════ */
        .settings-sidebar {
          width: 220px;
          min-width: 220px;
          background: #f8f8f8;
          border-right: 1px solid #e0e0e0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .settings-sidebar-title {
          font-size: 15px;
          font-weight: 700;
          color: #111;
          padding: 18px 18px 12px;
          letter-spacing: -0.01em;
        }

        .settings-nav {
          flex: 1;
          overflow-y: auto;
          padding: 0 8px 12px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .settings-nav::-webkit-scrollbar { width: 4px; }
        .settings-nav::-webkit-scrollbar-thumb { background: #d1d1d1; border-radius: 4px; }

        .settings-nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          border-radius: 6px;
          border: none;
          background: transparent;
          color: #444;
          font-family: 'Poppins', sans-serif;
          font-size: 12.5px;
          font-weight: 400;
          cursor: pointer;
          text-align: left;
          transition: background 0.12s, color 0.12s;
          width: 100%;
        }

        .settings-nav-item:hover { background: #ececec; color: #111; }

        .settings-nav-item.active {
          background: #dce8fb;
          color: #0067c0;
          font-weight: 600;
        }

        .settings-nav-icon { flex-shrink: 0; }

        /* ══════════════════════
           MAIN
        ══════════════════════ */
        .settings-main {
          flex: 1;
          overflow-y: auto;
          background: #f3f3f3;
        }

        .settings-main::-webkit-scrollbar { width: 6px; }
        .settings-main::-webkit-scrollbar-thumb { background: #d1d1d1; border-radius: 6px; }

        /* ══════════════════════
           CONTENT
        ══════════════════════ */
        .s-content {
          padding: 20px 24px 32px;
          max-width: 780px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        /* Section hero */
        .s-section-hero {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 18px;
          background: #fff;
          border-radius: 10px;
          border: 1px solid #e8e8e8;
        }

        .s-section-hero-icon { color: #0067c0; flex-shrink: 0; }

        .s-section-hero-title {
          font-size: 16px;
          font-weight: 700;
          color: #111;
          letter-spacing: -0.01em;
        }

        .s-section-hero-sub {
          font-size: 11px;
          color: #888;
          margin-top: 1px;
          font-weight: 400;
        }

        /* Card */
        .s-card {
          background: #fff;
          border: 1px solid #e8e8e8;
          border-radius: 10px;
          padding: 16px 18px;
        }

        .s-card-title {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: #888;
          margin-bottom: 14px;
        }

        /* ── Info grid ── */
        .s-info-grid { display: flex; flex-direction: column; }

        .s-info-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 12px;
          padding: 8px 0;
          border-bottom: 1px solid #f3f3f3;
        }

        .s-info-row:last-child { border-bottom: none; }

        .s-info-key { font-size: 12px; font-weight: 500; color: #555; white-space: nowrap; }
        .s-info-val { font-size: 12px; color: #111; text-align: right; }

        /* ── Stat row ── */
        .s-stat-row { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; }

        .s-stat-block {
          background: #f8f8f8;
          border: 1px solid #ededed;
          border-radius: 8px;
          padding: 12px 14px;
        }

        .s-stat-label { font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #888; margin-bottom: 4px; }
        .s-stat-value { font-size: 18px; font-weight: 700; color: #111; letter-spacing: -0.02em; }
        .s-stat-of { font-size: 11px; font-weight: 400; color: #888; }
        .s-stat-sub { font-size: 10.5px; color: #aaa; margin-top: 2px; }

        /* ── Progress bar ── */
        .s-bar { height: 5px; background: #ececec; border-radius: 3px; overflow: hidden; margin-top: 8px; }
        .s-bar-fill { height: 100%; background: #0067c0; border-radius: 3px; transition: width 0.6s ease; }

        /* ── Settings list ── */
        .s-settings-list { display: flex; flex-direction: column; }

        .s-setting-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 11px 0;
          border-bottom: 1px solid #f3f3f3;
        }

        .s-setting-row:last-child { border-bottom: none; }
        .s-setting-info { flex: 1; min-width: 0; }
        .s-setting-name { font-size: 13px; font-weight: 500; color: #111; }
        .s-setting-desc { font-size: 11px; color: #888; margin-top: 1px; }

        /* ── Select ── */
        .s-select {
          border: 1px solid #d8d8d8;
          border-radius: 6px;
          background: #f8f8f8;
          color: #111;
          font-family: 'Poppins', sans-serif;
          font-size: 12px;
          font-weight: 500;
          padding: 5px 10px;
          outline: none;
          cursor: pointer;
          flex-shrink: 0;
          transition: border-color 0.12s;
          min-width: 110px;
        }

        .s-select:focus { border-color: #0067c0; }

        /* ── Toggle ── */
        .s-toggle { position: relative; cursor: pointer; flex-shrink: 0; }
        .s-toggle input { position: absolute; opacity: 0; width: 0; height: 0; }

        .s-toggle-track {
          display: block;
          width: 42px;
          height: 22px;
          background: #ccc;
          border-radius: 11px;
          transition: background 0.2s;
          position: relative;
        }

        .s-toggle input:checked ~ .s-toggle-track { background: #0067c0; }

        .s-toggle-thumb {
          position: absolute;
          top: 3px; left: 3px;
          width: 16px; height: 16px;
          background: #fff;
          border-radius: 50%;
          transition: transform 0.2s;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }

        .s-toggle input:checked ~ .s-toggle-track .s-toggle-thumb { transform: translateX(20px); }

        /* ── Theme ── */
        .s-theme-row { display: flex; gap: 12px; }

        .s-theme-btn {
          border: 2px solid #e0e0e0;
          border-radius: 10px;
          background: transparent;
          cursor: pointer;
          padding: 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 7px;
          font-family: 'Poppins', sans-serif;
          font-size: 12px;
          font-weight: 500;
          color: #444;
          transition: all 0.15s;
          min-width: 90px;
        }

        .s-theme-btn:hover { border-color: #0067c0; }
        .s-theme-btn.active { border-color: #0067c0; color: #0067c0; background: #eaf2fd; }

        .s-theme-thumb {
          width: 70px;
          height: 44px;
          border-radius: 5px;
          overflow: hidden;
          position: relative;
        }

        .s-theme-thumb.light { background: #f3f3f3; }
        .s-theme-thumb.dark { background: #202020; }

        .s-theme-thumb-bar {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 10px;
          background: rgba(0,0,0,0.12);
        }

        .s-theme-thumb.dark .s-theme-thumb-bar { background: rgba(255,255,255,0.1); }

        .s-theme-thumb-win {
          position: absolute;
          top: 8px; left: 8px;
          width: 40px;
          height: 22px;
          border-radius: 3px;
          background: rgba(0,103,192,0.25);
        }

        /* ── Accent colors ── */
        .s-color-row { display: flex; gap: 10px; flex-wrap: wrap; }

        .s-color-dot {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: 2.5px solid transparent;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.1s, box-shadow 0.1s;
          font-size: 13px;
          color: #fff;
          font-weight: 700;
        }

        .s-color-dot:hover { transform: scale(1.12); }
        .s-color-dot.active { border-color: #111; box-shadow: 0 0 0 2px #fff, 0 0 0 4px #111; }

        /* ── Wallpaper ── */
        .s-wallpaper-grid { display: flex; flex-wrap: wrap; gap: 10px; }

        .s-wallpaper-item {
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          background: transparent;
          cursor: pointer;
          padding: 0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          width: 90px;
          transition: border-color 0.15s;
        }

        .s-wallpaper-item:hover { border-color: #0067c0; }
        .s-wallpaper-item.active { border-color: #0067c0; }

        .s-wallpaper-thumb {
          width: 100%;
          height: 54px;
          background-size: cover;
          background-position: center;
        }

        .s-wallpaper-label {
          font-family: 'Poppins', sans-serif;
          font-size: 10px;
          font-weight: 500;
          color: #444;
          padding: 4px 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-align: center;
          background: #f8f8f8;
        }

        /* ── Storage donut ── */
        .s-storage-overview { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }
        .s-storage-donut-wrap { flex-shrink: 0; }

        .s-storage-legend { display: flex; flex-direction: column; gap: 8px; }
        .s-storage-legend-row { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #444; }
        .s-legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .s-storage-legend-total { font-size: 12px; color: #888; margin-top: 4px; }

        .s-storage-stats { display: flex; gap: 16px; }
        .s-storage-stat-box { background: #f8f8f8; border: 1px solid #ededed; border-radius: 8px; padding: 12px 16px; text-align: center; }
        .s-storage-stat-val { font-size: 18px; font-weight: 700; color: #111; }
        .s-storage-stat-key { font-size: 10.5px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }

        .s-cat-list { display: flex; flex-direction: column; gap: 10px; }
        .s-cat-row {}
        .s-cat-header { display: flex; justify-content: space-between; margin-bottom: 4px; }
        .s-cat-name { font-size: 12px; font-weight: 500; color: #111; }
        .s-cat-size { font-size: 12px; color: #555; }
        .s-cat-files { font-size: 10.5px; color: #aaa; margin-top: 3px; }

        /* ── Cleanup ── */
        .s-cleanup-list { display: flex; flex-direction: column; }

        .s-cleanup-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 11px 0;
          border-bottom: 1px solid #f3f3f3;
          cursor: pointer;
          transition: background 0.1s;
          border-radius: 4px;
        }

        .s-cleanup-row:last-child { border-bottom: none; }
        .s-cleanup-row:hover { background: #f8f8f8; padding-left: 6px; }

        .s-cleanup-icon { font-size: 20px; flex-shrink: 0; width: 32px; text-align: center; }
        .s-cleanup-title { font-size: 13px; font-weight: 500; color: #111; }
        .s-cleanup-desc { font-size: 11px; color: #888; margin-top: 1px; }
        .s-chevron { color: #aaa; margin-left: auto; flex-shrink: 0; }

        /* ── Alert ── */
        .s-alert {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px 16px;
          border-radius: 8px;
        }

        .s-alert.critical { background: #fef2f2; border: 1px solid #fecaca; }
        .s-alert.warning  { background: #fffbeb; border: 1px solid #fde68a; }

        .s-alert-icon { font-size: 18px; flex-shrink: 0; margin-top: 1px; }
        .s-alert-title { font-size: 13px; font-weight: 600; color: #111; }
        .s-alert-msg { font-size: 12px; color: #555; margin-top: 2px; }

        /* ── Role badge ── */
        .s-role-badge-row { display: flex; }

        .s-role-badge {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 20px;
          background: #f8f8f8;
          border: 1px solid #e8e8e8;
          width: 100%;
        }

        .s-role-badge.admin { background: #eaf2fd; border-color: #bfdbfe; }
        .s-role-name { font-size: 13px; font-weight: 600; color: #111; }
        .s-role-desc { font-size: 11px; color: #888; margin-top: 1px; }

        /* ── Log list ── */
        .s-log-list { display: flex; flex-direction: column; gap: 6px; max-height: 280px; overflow-y: auto; }
        .s-log-list::-webkit-scrollbar { width: 4px; }
        .s-log-list::-webkit-scrollbar-thumb { background: #e0e0e0; border-radius: 4px; }

        .s-log-row { display: flex; align-items: flex-start; gap: 10px; padding: 8px 10px; background: #f8f8f8; border-radius: 7px; border: 1px solid #ededed; }
        .s-log-badge { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 4px; flex-shrink: 0; text-transform: uppercase; letter-spacing: 0.04em; }
        .s-log-badge.ok { background: #dcfce7; color: #16a34a; }
        .s-log-badge.fail { background: #fef2f2; color: #dc2626; }
        .s-log-body { flex: 1; min-width: 0; }
        .s-log-main { font-size: 11.5px; color: #333; }
        .s-log-res { color: #888; }
        .s-log-details { font-size: 10.5px; color: #aaa; margin-top: 2px; }
        .s-log-time { font-size: 10px; color: #aaa; white-space: nowrap; flex-shrink: 0; }

        /* ── Users ── */
        .s-user-list { display: flex; flex-direction: column; gap: 6px; }

        .s-user-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          background: #f8f8f8;
          border: 1px solid #ededed;
          border-radius: 8px;
          transition: background 0.12s;
        }

        .s-user-row:hover { background: #eaf2fd; border-color: #bfdbfe; }

        .s-user-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #0067c0;
          color: #fff;
          font-size: 15px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .s-user-name { font-size: 13px; font-weight: 600; color: #111; }
        .s-user-meta { font-size: 11px; color: #888; margin-top: 1px; }
        .s-user-role-chip { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.04em; margin-left: auto; background: #eaf2fd; color: #0067c0; flex-shrink: 0; }
        .s-user-role-chip.admin { background: #dce8fb; color: #0053a1; }

        /* ── About ── */
        .s-about-hero-card { }

        .s-about-logo-row { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; }
        .s-about-logo-icon { font-size: 36px; }
        .s-about-logo-name { font-size: 20px; font-weight: 700; color: #111; letter-spacing: -0.02em; }
        .s-about-logo-ver { font-size: 11.5px; color: #888; margin-top: 2px; }
        .s-about-pills { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
        .s-about-desc { font-size: 12px; color: #555; line-height: 1.6; }

        .s-pill { font-size: 10.5px; font-weight: 600; padding: 3px 9px; border-radius: 12px; background: #eaf2fd; color: #0067c0; letter-spacing: 0.02em; }

        /* ── Updates ── */
        .s-update-status-row { display: flex; align-items: flex-start; gap: 14px; }
        .s-update-status-icon { font-size: 28px; flex-shrink: 0; }
        .s-update-status-icon.pulse { animation: pulse-dot 2s infinite; }
        .s-update-status-label { font-size: 14px; font-weight: 600; color: #111; }
        .s-update-status-ver { font-size: 11.5px; color: #888; margin-top: 2px; }

        .s-update-progress-wrap { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
        .s-update-pct { font-size: 11.5px; font-weight: 600; color: #0067c0; flex-shrink: 0; }

        .s-update-avail-card { border-color: #bfdbfe; background: #eaf2fd; }
        .s-update-avail-header { display: flex; align-items: flex-start; gap: 10px; }
        .s-update-avail-dot { width: 10px; height: 10px; background: #0067c0; border-radius: 50%; flex-shrink: 0; margin-top: 4px; }
        .s-update-avail-title { font-size: 13px; font-weight: 600; color: #0067c0; margin-bottom: 6px; }
        .s-update-notes { padding-left: 16px; font-size: 12px; color: #444; line-height: 1.7; }

        .s-update-actions { display: flex; gap: 8px; flex-wrap: wrap; }

        .s-update-history-list { display: flex; flex-direction: column; gap: 6px; }
        .s-update-history-row { display: flex; align-items: center; justify-content: space-between; padding: 9px 12px; background: #f8f8f8; border: 1px solid #ededed; border-radius: 7px; }
        .s-update-history-ver { font-size: 12.5px; font-weight: 600; color: #111; }
        .s-update-history-date { font-size: 11px; color: #888; margin-top: 1px; }

        /* ── Buttons ── */
        .s-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 18px;
          border-radius: 6px;
          border: 1px solid #d0d0d0;
          background: #f8f8f8;
          color: #111;
          font-family: 'Poppins', sans-serif;
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.12s;
          white-space: nowrap;
        }

        .s-btn:hover:not(:disabled) { background: #ececec; border-color: #bbb; }
        .s-btn.primary { background: #0067c0; color: #fff; border-color: #0067c0; }
        .s-btn.primary:hover:not(:disabled) { background: #0058a8; }
        .s-btn.secondary { background: #fff; }
        .s-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        /* ── Loading / empty ── */
        .s-loading { display: flex; align-items: center; gap: 10px; padding: 24px; color: #888; font-size: 13px; }

        .s-spinner {
          width: 18px; height: 18px;
          border: 2px solid #e0e0e0;
          border-top-color: #0067c0;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          flex-shrink: 0;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .s-empty-state { font-size: 12px; color: #aaa; padding: 4px 0; font-style: italic; }

        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>

      {/* Sidebar */}
      <div className="settings-sidebar">
        <div className="settings-sidebar-title">Settings</div>
        <nav className="settings-nav">
          {SECTIONS.map(sec => {
            const Icon = sec.icon
            return (
              <button key={sec.id} className={`settings-nav-item ${activeSection === sec.id ? 'active' : ''}`} onClick={() => setActiveSection(sec.id)}>
                <Icon size={17} className="settings-nav-icon" />
                <span>{sec.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Main */}
      <div className="settings-main">
        {renderSection()}
      </div>
    </div>
  )
}