import { useEffect, useState } from 'react'
import { Monitor, Palette, HardDrive, Shield, Info, Users, RefreshCw } from 'lucide-react'
import {
  BUILTIN_WALLPAPER_OPTIONS,
  resolveWallpaperPresentation,
  resolveWallpaperValue,
  loadLocalUiSettingsBase
} from '../utils/personalization.js'

const SECTIONS = [
  { id: 'system', label: 'System', icon: Monitor },
  { id: 'personalization', label: 'Personalization', icon: Palette },
  { id: 'storage', label: 'Storage', icon: HardDrive },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'accounts', label: 'Accounts', icon: Users },
  { id: 'updates', label: 'Updates', icon: RefreshCw },
  { id: 'about', label: 'About', icon: Info }
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

  const [systemInfo, setSystemInfo] = useState(null)
  const [storageInfo, setStorageInfo] = useState(null)
  const [users, setUsers] = useState([])
  const [permissions, setPermissions] = useState({
    fileAccess: true,
    networkAccess: true,
    notifications: true
  })
  const [updateStatus, setUpdateStatus] = useState(null)
  const [updateHistory, setUpdateHistory] = useState([])
  const [updateBusy, setUpdateBusy] = useState(false)
  const [updateError, setUpdateError] = useState('')
  const [securityLogs, setSecurityLogs] = useState([])
  const [userRole, setUserRole] = useState(null)

  useEffect(() => {
    loadSystemInfo()
    loadStorageInfo()
    loadUsers()
    loadPermissions()
    loadUpdateStatus()
    loadSecurityData()
  }, [])

  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection)
    }
  }, [initialSection])

  useEffect(() => {
    applySettings(settings)
  }, [settings])

  const wallpaperOptions = BUILTIN_WALLPAPER_OPTIONS

  // Helper: allow Enter/Space to activate non-button elements (used for theme cards, color swatches)
  const handleKeyActivate = (e, cb) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      cb()
    }
  }

  const hexToRgba = (hex, alpha) => {
    const sanitized = hex.replace('#', '')
    if (sanitized.length !== 6) return `rgba(0, 103, 192, ${alpha})`
    const r = parseInt(sanitized.slice(0, 2), 16)
    const g = parseInt(sanitized.slice(2, 4), 16)
    const b = parseInt(sanitized.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  const applySettings = (next) => {
    const root = document.documentElement
    const wallpaperPresentation = resolveWallpaperPresentation(next.wallpaper)
    root.setAttribute('data-theme', next.theme)
    root.setAttribute('data-font', next.fontSize)
    root.setAttribute('data-contrast', next.highContrast ? 'high' : 'normal')
    root.style.setProperty('--win-accent', next.accentColor)
    root.style.setProperty('--win-accent-soft', hexToRgba(next.accentColor, 0.16))
    root.style.setProperty('--desktop-wallpaper', resolveWallpaperValue(next.wallpaper))
    root.style.setProperty('--desktop-wallpaper-size', wallpaperPresentation.size)
    root.style.setProperty('--desktop-wallpaper-position', wallpaperPresentation.position)
    root.style.setProperty('--desktop-wallpaper-color', wallpaperPresentation.color)
  }

  const loadSystemInfo = async () => {
    try {
      const [processRes, resourceRes] = await Promise.all([
        fetch('http://localhost:8000/process/list'),
        fetch('http://localhost:8000/system/resources')
      ])
      
      if (processRes.ok && resourceRes.ok) {
        const processes = await processRes.json()
        const resources = await resourceRes.json()
        setSystemInfo({
          os: 'JezOS',
          version: '1.0.0',
          kernel: 'FastAPI Backend',
          uptime: calculateUptime(),
          processes: processes.filter(p => p.state === 'running').length,
          memory: resources.usedMemory,
          maxMemory: resources.maxMemory,
          cpu: resources.cpuUsage
        })
      }
    } catch (error) {
      console.error('Failed to load system info')
    }
  }

  const loadStorageInfo = async () => {
    try {
      const response = await fetch('http://localhost:8000/system/storage')
      if (response.ok) {
        const data = await response.json()
        setStorageInfo({
          total: Math.round(data.total_capacity_bytes / (1024 * 1024)),
          used: Math.round(data.used_bytes / (1024 * 1024)),
          available: Math.round(data.free_bytes / (1024 * 1024)),
          files: data.file_count,
          directories: data.directory_count,
          usagePercent: data.usage_percent,
          byCategory: data.storage_by_category
        })
      }
    } catch (error) {
      console.error('Failed to load storage info:', error)
      setStorageInfo({
        total: 100,
        used: 0,
        available: 100,
        files: 0,
        directories: 0,
        usagePercent: 0,
        byCategory: {}
      })
    }
  }

  const loadUsers = async () => {
    try {
      const response = await fetch('http://localhost:8000/user/list')
      if (response.ok) {
        setUsers(await response.json())
      }
    } catch (error) {
      console.error('Failed to load users')
    }
  }

  const loadPermissions = () => {
    setPermissions({
      fileAccess: localStorage.getItem('jezos_perm_files') !== 'false',
      networkAccess: localStorage.getItem('jezos_perm_network') !== 'false',
      notifications: localStorage.getItem('jezos_perm_notifications') !== 'false'
    })
  }

  const loadSecurityData = async () => {
    try {
      const roleResponse = await fetch('http://localhost:8000/security/user-role', {
        headers: {
          'session-token': localStorage.getItem('session_token') || ''
        }
      })
      if (roleResponse.ok) {
        const roleData = await roleResponse.json()
        setUserRole(roleData.role)
        
        if (roleData.role === 'admin') {
          const logsResponse = await fetch('http://localhost:8000/security/logs?limit=50', {
            headers: {
              'session-token': localStorage.getItem('session_token') || ''
            }
          })
          if (logsResponse.ok) {
            const logsData = await logsResponse.json()
            setSecurityLogs(logsData.logs || [])
          }
        }
      }
    } catch (error) {
      console.error('Failed to load security data:', error)
    }
  }

  const loadUpdateStatus = async () => {
    try {
      const response = await fetch('http://localhost:8000/update/status')
      if (response.ok) {
        const data = await response.json()
        setUpdateStatus(data.state || null)
        setUpdateHistory(data.history || [])
      }
    } catch (error) {
      setUpdateError('Failed to load update status')
    }
  }

  const checkForUpdates = async () => {
    setUpdateBusy(true)
    setUpdateError('')
    try {
      const response = await fetch('http://localhost:8000/update/check', { method: 'POST' })
      if (response.ok) {
        await loadUpdateStatus()
      } else {
        setUpdateError('Unable to check for updates')
      }
    } catch (error) {
      setUpdateError('Unable to check for updates')
    } finally {
      setUpdateBusy(false)
    }
  }

  const installUpdate = async () => {
    setUpdateBusy(true)
    setUpdateError('')
    try {
      const response = await fetch('http://localhost:8000/update/install', { method: 'POST' })
      if (response.ok) {
        await loadUpdateStatus()
      } else {
        setUpdateError('Update installation failed')
      }
    } catch (error) {
      setUpdateError('Update installation failed')
    } finally {
      setUpdateBusy(false)
    }
  }

  const completeRestart = () => {
    setUpdateError('')
    window.dispatchEvent(new CustomEvent('jez_os_restart', { detail: { update: true } }))
  }

  const uninstallUpdate = async () => {
    setUpdateBusy(true)
    setUpdateError('')
    try {
      const response = await fetch('http://localhost:8000/update/uninstall', { method: 'POST' })
      if (response.ok) {
        await loadUpdateStatus()
      } else {
        setUpdateError('Update uninstall failed')
      }
    } catch (error) {
      setUpdateError('Update uninstall failed')
    } finally {
      setUpdateBusy(false)
    }
  }

  const calculateUptime = () => {
    const start = localStorage.getItem('jezos_boot_time')
    if (!start) return 'Unknown'
    const uptime = Math.floor((Date.now() - parseInt(start)) / 1000)
    const hours = Math.floor(uptime / 3600)
    const minutes = Math.floor((uptime % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  const updateSetting = (key, value) => {
    const storageKeys = {
      theme: 'jezos_theme',
      accentColor: 'jezos_accent',
      fontSize: 'jezos_font_size',
      language: 'jezos_language',
      timeFormat: 'jezos_time_format',
      highContrast: 'jezos_high_contrast',
      wallpaper: 'jezos_wallpaper'
    }

    setSettings(prev => ({ ...prev, [key]: value }))
    const storedValue = typeof value === 'boolean' ? value.toString() : value
    localStorage.setItem(storageKeys[key] || `jezos_${key}`, storedValue)
    window.dispatchEvent(new CustomEvent('jezos_settings_updated', { detail: { key, value } }))
  }

  const updatePermission = (key, value) => {
    setPermissions(prev => ({ ...prev, [key]: value }))
    localStorage.setItem(`jezos_perm_${key.replace('Access', '').toLowerCase()}`, value.toString())
  }

  const formatDateTime = (value) => {
    if (!value) return 'Never'
    try {
      let isoString = value
      if (!isoString.endsWith('Z') && !isoString.includes('+') && !isoString.includes('T00:00:00')) {
        isoString = isoString + 'Z'
      }
      const date = new Date(isoString)
      if (Number.isNaN(date.getTime())) return value
      return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return value
    }
  }

  const getUpdateStatusLabel = (status) => {
    switch (status) {
      case 'available': return 'Update available'
      case 'up_to_date': return 'Up to date'
      case 'downloading': return 'Downloading update'
      case 'applying': return 'Applying update'
      case 'installed': return 'Installed - restart required'
      case 'rollback_ready': return 'Rollback ready - restart required'
      default: return 'Idle'
    }
  }

  const renderSection = () => {
    switch (activeSection) {
      case 'system':
        return (
          <div className="settings-content">
            <h2 className="settings-content-title">System Information</h2>
            {systemInfo ? (
              <div className="settings-grid">
                <div className="settings-info-card">
                  <div className="settings-info-label">Operating System</div>
                  <div className="settings-info-value">{systemInfo.os} {updateStatus?.current_version || systemInfo.version}</div>
                </div>
                <div className="settings-info-card">
                  <div className="settings-info-label">Kernel</div>
                  <div className="settings-info-value">{systemInfo.kernel}</div>
                </div>
                <div className="settings-info-card">
                  <div className="settings-info-label">Uptime</div>
                  <div className="settings-info-value">{systemInfo.uptime}</div>
                </div>
                <div className="settings-info-card">
                  <div className="settings-info-label">Active Processes</div>
                  <div className="settings-info-value">{systemInfo.processes}</div>
                </div>
                <div className="settings-info-card">
                  <div className="settings-info-label">Memory Usage</div>
                  <div className="settings-info-value">{systemInfo.memory} / {systemInfo.maxMemory} MB</div>
                  <div className="settings-progress-bar">
                    <div className="settings-progress-fill" style={{ width: `${(systemInfo.memory / systemInfo.maxMemory) * 100}%` }} />
                  </div>
                </div>
                <div className="settings-info-card">
                  <div className="settings-info-label">CPU Usage</div>
                  <div className="settings-info-value">{systemInfo.cpu}%</div>
                  <div className="settings-progress-bar">
                    <div className="settings-progress-fill" style={{ width: `${systemInfo.cpu}%` }} />
                  </div>
                </div>
                <div className="settings-info-card">
                  <div className="settings-info-label">Device Name</div>
                  <div className="settings-info-value">JEZ-Workstation</div>
                </div>
                <div className="settings-info-card">
                  <div className="settings-info-label">System Type</div>
                  <div className="settings-info-value">64-bit OS, x64-based processor</div>
                </div>
                <div className="settings-info-card">
                  <div className="settings-info-label">Processor</div>
                  <div className="settings-info-value">JezCore i7-1260U @ 2.10 GHz</div>
                </div>
                <div className="settings-info-card">
                  <div className="settings-info-label">Installed RAM</div>
                  <div className="settings-info-value">16.0 GB</div>
                </div>
                <div className="settings-info-card">
                  <div className="settings-info-label">Graphics</div>
                  <div className="settings-info-value">JezOS Iris Xe</div>
                </div>
                <div className="settings-info-card">
                  <div className="settings-info-label">Storage</div>
                  <div className="settings-info-value">512 GB NVMe SSD</div>
                </div>
                <div className="settings-info-card">
                  <div className="settings-info-label">BIOS</div>
                  <div className="settings-info-value">JEZEFI v2.3.7 (01/12/2026)</div>
                </div>
                <div className="settings-info-card">
                  <div className="settings-info-label">Secure Boot</div>
                  <div className="settings-info-value">On</div>
                </div>
                <div className="settings-info-card">
                  <div className="settings-info-label">Virtualization</div>
                  <div className="settings-info-value">Enabled</div>
                </div>
                <div className="settings-info-card">
                  <div className="settings-info-label">Build</div>
                  <div className="settings-info-value">26.2.105.742 (JezOS Canary)</div>
                </div>
              </div>
            ) : (
              <div className="settings-loading">Loading system information...</div>
            )}
          </div>
        )

      case 'personalization':
        return (
          <div className="settings-content">
            <h2 className="settings-content-title">Personalization</h2>
            
            <div className="settings-group">
              <h3 className="settings-group-title">Theme</h3>
              <div className="settings-theme-options">
                <div
                  className={`settings-theme-card ${settings.theme === 'light' ? 'active' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={settings.theme === 'light'}
                  onClick={() => updateSetting('theme', 'light')}
                  onKeyDown={(e) => handleKeyActivate(e, () => updateSetting('theme', 'light'))}
                >
                  <div className="settings-theme-preview light-preview"></div>
                  <div className="settings-theme-name">Light</div>
                </div>
                <div
                  className={`settings-theme-card ${settings.theme === 'dark' ? 'active' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={settings.theme === 'dark'}
                  onClick={() => updateSetting('theme', 'dark')}
                  onKeyDown={(e) => handleKeyActivate(e, () => updateSetting('theme', 'dark'))}
                >
                  <div className="settings-theme-preview dark-preview"></div>
                  <div className="settings-theme-name">Dark</div>
                </div>
              </div>
            </div>

            <div className="settings-group">
              <h3 className="settings-group-title">Accent Color</h3>
              <div className="settings-color-options">
                {['#2563eb', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#16a34a', '#0891b2'].map(color => (
                  <div
                    key={color}
                    role="button"
                    tabIndex={0}
                    aria-label={`Accent color ${color}`}
                    aria-pressed={settings.accentColor === color}
                    className={`settings-color-option ${settings.accentColor === color ? 'active' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => updateSetting('accentColor', color)}
                    onKeyDown={(e) => handleKeyActivate(e, () => updateSetting('accentColor', color))}
                  />
                ))}
              </div>
            </div>

            <div className="settings-group">
              <h3 className="settings-group-title">Background</h3>
              <div className="settings-wallpaper-options">
                {wallpaperOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`settings-wallpaper-card ${settings.wallpaper === option.id ? 'active' : ''}`}
                    onClick={() => updateSetting('wallpaper', option.id)}
                    aria-pressed={settings.wallpaper === option.id}
                    aria-label={`Set wallpaper ${option.label}`}
                  >
                    <div
                      className="settings-wallpaper-preview"
                      style={
                        option.value.startsWith('url')
                          ? {
                              backgroundImage: option.value,
                              backgroundSize: option.size || 'cover',
                              backgroundPosition: option.position || 'center',
                              backgroundColor: option.color || 'transparent'
                            }
                          : { background: option.value }
                      }
                    />
                    <div className="settings-wallpaper-name">{option.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-group">
              <h3 className="settings-group-title">Display</h3>
              <div className="settings-item">
                <label className="settings-label">Font Size</label>
                <select
                  className="settings-select"
                  value={settings.fontSize}
                  onChange={(e) => updateSetting('fontSize', e.target.value)}
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>
            </div>

            <div className="settings-group">
              <h3 className="settings-group-title">Accessibility</h3>
              <div className="settings-permissions-list">
                <div className="settings-permission-item">
                  <div className="settings-permission-info">
                    <div className="settings-permission-name">High Contrast</div>
                    <div className="settings-permission-desc">Increase contrast for better readability</div>
                  </div>
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={settings.highContrast}
                      onChange={(e) => updateSetting('highContrast', e.target.checked)}
                    />
                    <span className="settings-toggle-slider"></span>
                  </label>
                </div>
              </div>
            </div>

            <div className="settings-group">
              <h3 className="settings-group-title">Language & Region</h3>
              <div className="settings-item">
                <label className="settings-label">Language</label>
                <select
                  className="settings-select"
                  value={settings.language}
                  onChange={(e) => updateSetting('language', e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                </select>
              </div>
              <div className="settings-item">
                <label className="settings-label">Time Format</label>
                <select
                  className="settings-select"
                  value={settings.timeFormat}
                  onChange={(e) => updateSetting('timeFormat', e.target.value)}
                >
                  <option value="12h">12-hour</option>
                  <option value="24h">24-hour</option>
                </select>
              </div>
            </div>
          </div>
        )

      case 'storage':
        const storagePercent = storageInfo ? (storageInfo.used / storageInfo.total) * 100 : 0
        const storageWarning = storagePercent > 90
          ? 'critical'
          : storagePercent > 75
            ? 'warning'
            : 'normal'

        return (
          <div className="settings-content">
            <h2 className="settings-content-title">Storage</h2>
            {storageInfo ? (
              <>
                {storageWarning === 'critical' && (
                  <div className="settings-alert settings-alert-critical">
                    <div className="settings-alert-icon">⚠️</div>
                    <div className="settings-alert-content">
                      <div className="settings-alert-title">Critical Storage Alert</div>
                      <div className="settings-alert-message">
                        Your storage is {storagePercent.toFixed(1)}% full. Please delete unnecessary files immediately to avoid issues.
                      </div>
                    </div>
                  </div>
                )}
                {storageWarning === 'warning' && (
                  <div className="settings-alert settings-alert-warning">
                    <div className="settings-alert-icon">⚠️</div>
                    <div className="settings-alert-content">
                      <div className="settings-alert-title">Storage Running Low</div>
                      <div className="settings-alert-message">
                        Your storage is {storagePercent.toFixed(1)}% full. Consider cleaning up unnecessary files soon.
                      </div>
                    </div>
                  </div>
                )}
                <div className="settings-storage-overview">
                  <div className="settings-storage-chart">
                    <svg viewBox="0 0 200 200" className="settings-storage-pie">
                      <circle cx="100" cy="100" r="80" fill="none" stroke="#e5e7eb" strokeWidth="40" />
                      <circle
                        cx="100" cy="100" r="80" fill="none"
                        stroke={storageWarning === 'critical' ? '#dc2626' : storageWarning === 'warning' ? '#f59e0b' : '#2563eb'}
                        strokeWidth="40"
                        strokeDasharray={`${(storageInfo.used / storageInfo.total) * 502} 502`}
                        transform="rotate(-90 100 100)"
                      />
                    </svg>
                    <div className="settings-storage-label">
                      <div className="settings-storage-used">{storageInfo.used} MB</div>
                      <div className="settings-storage-total">of {storageInfo.total} MB</div>
                      <div className="settings-storage-percent">{storagePercent.toFixed(1)}%</div>
                    </div>
                  </div>
                </div>
                <div className="settings-grid">
                  <div className="settings-info-card">
                    <div className="settings-info-label">Used Space</div>
                    <div className="settings-info-value">{storageInfo.used} MB</div>
                  </div>
                  <div className="settings-info-card">
                    <div className="settings-info-label">Available Space</div>
                    <div className="settings-info-value">{storageInfo.available} MB</div>
                  </div>
                  <div className="settings-info-card">
                    <div className="settings-info-label">Total Files</div>
                    <div className="settings-info-value">{storageInfo.files}</div>
                  </div>
                  <div className="settings-info-card">
                    <div className="settings-info-label">Directories</div>
                    <div className="settings-info-value">{storageInfo.directories || 0}</div>
                  </div>
                </div>
                {storageWarning !== 'normal' && (
                  <div className="settings-section">
                    <h3 className="settings-section-title">Storage Cleanup Recommendations</h3>
                    <div className="settings-cleanup-suggestions">
                      <div className="settings-cleanup-item">
                        <div className="settings-cleanup-icon">📁</div>
                        <div className="settings-cleanup-text">
                          <strong>Empty Trash</strong>
                          <p>Permanently delete files from your trash folder</p>
                        </div>
                      </div>
                      <div className="settings-cleanup-item">
                        <div className="settings-cleanup-icon">🗑️</div>
                        <div className="settings-cleanup-text">
                          <strong>Remove Temporary Files</strong>
                          <p>Clean up temporary and cache files that are no longer needed</p>
                        </div>
                      </div>
                      <div className="settings-cleanup-item">
                        <div className="settings-cleanup-icon">🎬</div>
                        <div className="settings-cleanup-text">
                          <strong>Delete Large Files</strong>
                          <p>Look for large media files and videos you no longer need</p>
                        </div>
                      </div>
                      <div className="settings-cleanup-item">
                        <div className="settings-cleanup-icon">📦</div>
                        <div className="settings-cleanup-text">
                          <strong>Uninstall Apps</strong>
                          <p>Remove applications you no longer use</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {storageInfo.byCategory && Object.keys(storageInfo.byCategory).length > 0 && (
                  <div className="settings-section">
                    <h3 className="settings-section-title">Storage by Category</h3>
                    <div className="settings-storage-categories">
                      {Object.entries(storageInfo.byCategory).map(([category, data]) => (
                        <div key={category} className="settings-storage-category">
                          <div className="settings-storage-category-header">
                            <span className="settings-storage-category-name">{category}</span>
                            <span className="settings-storage-category-size">
                              {(data.bytes / (1024 * 1024)).toFixed(2)} MB
                            </span>
                          </div>
                          <div className="settings-storage-category-bar">
                            <div
                              className="settings-storage-category-fill"
                              style={{ width: `${((data.bytes / (storageInfo.used * 1024 * 1024)) * 100).toFixed(1)}%` }}
                            />
                          </div>
                          <div className="settings-storage-category-files">
                            {category === 'Apps'
                              ? `${data.files} ${data.files === 1 ? 'app' : 'apps'}`
                              : `${data.files} ${data.files === 1 ? 'file' : 'files'}`
                            }
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <button
                  className="settings-button"
                  onClick={loadStorageInfo}
                  aria-label="Refresh storage information"
                  style={{ marginTop: '12px' }}
                >
                  Refresh Storage Info
                </button>
              </>
            ) : (
              <div className="settings-loading">Loading storage information...</div>
            )}
          </div>
        )

      case 'security':
        return (
          <div className="settings-content">
            <h2 className="settings-content-title">Security & Permissions</h2>
            <div className="settings-section">
              <h3 className="settings-section-title">User Access Control</h3>
              <div className="settings-info-card">
                <div className="settings-info-row">
                  <span className="settings-info-label">Current Role:</span>
                  <span className="settings-info-value">
                    {userRole === 'admin' ? '🛡️ Administrator' : '👤 Standard User'}
                  </span>
                </div>
                <div className="settings-info-text">
                  {userRole === 'admin'
                    ? 'You have full access to system files and settings.'
                    : 'Some operations require administrator privileges.'}
                </div>
              </div>
            </div>
            <div className="settings-section">
              <h3 className="settings-section-title">App Permissions</h3>
              <div className="settings-permissions-list">
                <div className="settings-permission-item">
                  <div className="settings-permission-info">
                    <div className="settings-permission-name">File System Access</div>
                    <div className="settings-permission-desc">Allow apps to read and write files</div>
                  </div>
                  <label className="settings-toggle">
                    <input type="checkbox" checked={permissions.fileAccess} onChange={(e) => updatePermission('fileAccess', e.target.checked)} />
                    <span className="settings-toggle-slider"></span>
                  </label>
                </div>
                <div className="settings-permission-item">
                  <div className="settings-permission-info">
                    <div className="settings-permission-name">Network Access</div>
                    <div className="settings-permission-desc">Allow apps to connect to the internet</div>
                  </div>
                  <label className="settings-toggle">
                    <input type="checkbox" checked={permissions.networkAccess} onChange={(e) => updatePermission('networkAccess', e.target.checked)} />
                    <span className="settings-toggle-slider"></span>
                  </label>
                </div>
                <div className="settings-permission-item">
                  <div className="settings-permission-info">
                    <div className="settings-permission-name">Notifications</div>
                    <div className="settings-permission-desc">Allow apps to show notifications</div>
                  </div>
                  <label className="settings-toggle">
                    <input type="checkbox" checked={permissions.notifications} onChange={(e) => updatePermission('notifications', e.target.checked)} />
                    <span className="settings-toggle-slider"></span>
                  </label>
                </div>
              </div>
            </div>
            {userRole === 'admin' && (
              <div className="settings-section">
                <h3 className="settings-section-title">Security Event Log</h3>
                {securityLogs.length > 0 ? (
                  <div className="settings-security-logs">
                    {securityLogs.map((log) => (
                      <div key={log.id} className="settings-security-log-item">
                        <div className="settings-security-log-header">
                          <span className={`settings-security-log-type ${log.success ? 'success' : 'failed'}`}>
                            {log.event_type}
                          </span>
                          <span className="settings-security-log-time">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div className="settings-security-log-body">
                          <div className="settings-security-log-row">
                            <strong>{log.username}</strong> - {log.action}
                            {log.resource && <span className="settings-security-log-resource"> ({log.resource})</span>}
                          </div>
                          {log.details && (
                            <div className="settings-security-log-details">{log.details}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="settings-info-text">No security events logged yet.</div>
                )}
              </div>
            )}
          </div>
        )

      case 'accounts':
        return (
          <div className="settings-content">
            <h2 className="settings-content-title">User Accounts</h2>
            <div className="settings-users-list">
              {users.map((user) => (
                <div key={user.id} className="settings-user-card">
                  <div className="settings-user-avatar">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="settings-user-info">
                    <div className="settings-user-name">{user.username}</div>
                    <div className="settings-user-role">{user.role}</div>
                    <div className="settings-user-home">{user.home_dir}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )

      case 'about':
        return (
          <div className="settings-content">
            <h2 className="settings-content-title">About JezOS</h2>
            <div className="settings-about">
              <div className="settings-about-header">
                <div className="settings-about-hero">
                  <div className="settings-about-logo">JezOS</div>
                  <div className="settings-about-version">Version {updateStatus?.current_version || '1.0.0'}</div>
                  <div className="settings-about-desc">
                    JezOS is a modern, simulated desktop OS built with React and FastAPI.
                  </div>
                  <div className="settings-about-pills">
                    <span className="settings-about-pill">Canary Channel</span>
                    <span className="settings-about-pill">Build 26.2.105.742</span>
                    <span className="settings-about-pill">Security: Enhanced</span>
                  </div>
                </div>
                <div className="settings-about-card">
                  <div className="settings-about-card-title">Device specs</div>
                  <div className="settings-about-specs">
                    <div className="settings-about-item"><strong>Device name:</strong> JEZ-Workstation</div>
                    <div className="settings-about-item"><strong>System type:</strong> 64-bit OS, x64-based processor</div>
                    <div className="settings-about-item"><strong>Processor:</strong> JezCore i7-1260U @ 2.10 GHz</div>
                    <div className="settings-about-item"><strong>Installed RAM:</strong> 16.0 GB</div>
                    <div className="settings-about-item"><strong>Graphics:</strong> JezOS Iris Xe</div>
                    <div className="settings-about-item"><strong>Storage:</strong> 512 GB NVMe SSD</div>
                  </div>
                </div>
              </div>
              <div className="settings-about-card">
                <div className="settings-about-card-title">System info</div>
                <div className="settings-about-info">
                  <div className="settings-about-item"><strong>Kernel:</strong> JezOS NT 10.0.22631</div>
                  <div className="settings-about-item"><strong>Experience pack:</strong> JezOS Shell 8.4.1</div>
                  <div className="settings-about-item"><strong>Device ID:</strong> JEZ-9F3A-7B2C-41D6</div>
                  <div className="settings-about-item"><strong>System SKU:</strong> JEZOS-SLIM-1620</div>
                  <div className="settings-about-item"><strong>BIOS:</strong> JEZEFI v2.3.7 (01/12/2026)</div>
                  <div className="settings-about-item"><strong>Secure Boot:</strong> On</div>
                  <div className="settings-about-item"><strong>Virtualization:</strong> Enabled</div>
                  <div className="settings-about-item"><strong>Uptime:</strong> 3 days, 4 hours</div>
                  <div className="settings-about-item"><strong>Frontend:</strong> React + Vite</div>
                  <div className="settings-about-item"><strong>Backend:</strong> FastAPI + Python</div>
                  <div className="settings-about-item"><strong>Database:</strong> SQLite</div>
                  <div className="settings-about-item"><strong>Install date:</strong> 01/15/2026</div>
                  <div className="settings-about-item"><strong>Last update:</strong> 02/04/2026</div>
                </div>
              </div>
            </div>
          </div>
        )

      case 'updates':
        return (
          <div className="settings-content">
            <h2 className="settings-content-title">System Updates</h2>
            <div className="settings-update-card">
              <div className="settings-update-row">
                <div className="settings-update-label">Current version</div>
                <div className="settings-update-value">{updateStatus?.current_version || '1.0.0'}</div>
              </div>
              <div className="settings-update-row">
                <div className="settings-update-label">Update channel</div>
                <div className="settings-update-value">{updateStatus?.channel || 'stable'}</div>
              </div>
              <div className="settings-update-row">
                <div className="settings-update-label">Last checked</div>
                <div className="settings-update-value">{formatDateTime(updateStatus?.last_checked)}</div>
              </div>
              <div className="settings-update-row">
                <div className="settings-update-label">Status</div>
                <div className={`settings-update-status ${updateStatus?.update_available ? 'available' : updateStatus?.restart_required ? 'restart' : 'up-to-date'}`}>
                  {getUpdateStatusLabel(updateStatus?.status)}
                </div>
              </div>
              {updateStatus?.progress > 0 && (
                <div className="settings-update-progress">
                  <div className="settings-update-progress-bar">
                    <div className="settings-update-progress-fill" style={{ width: `${updateStatus.progress}%` }} />
                  </div>
                  <div className="settings-update-progress-text">{updateStatus.progress}%</div>
                </div>
              )}
            </div>
            {updateStatus?.update_available && (
              <div className="settings-update-card">
                <div className="settings-update-heading">Update available</div>
                <div className="settings-update-version">Version {updateStatus.latest_version}</div>
                {updateStatus?.patch_notes && (
                  <ul className="settings-update-notes">
                    {updateStatus.patch_notes.split('\n').filter(Boolean).map((note, index) => (
                      <li key={`${note}-${index}`}>{note}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {updateStatus?.restart_required && (
              <div className="settings-update-card">
                <div className="settings-update-heading">Restart required</div>
                <div className="settings-update-desc">Finish installing the update by restarting the system.</div>
                <button type="button" className="settings-button" onClick={completeRestart} disabled={updateBusy}>
                  Complete restart
                </button>
              </div>
            )}
            {updateError && <div className="settings-update-error">{updateError}</div>}
            <div className="settings-update-actions">
              <button
                type="button"
                className="settings-button secondary"
                onClick={checkForUpdates}
                disabled={updateBusy}
                aria-busy={updateBusy}
                aria-label="Check for updates"
              >
                {updateBusy ? 'Checking...' : 'Check for updates'}
              </button>
              <button
                type="button"
                className="settings-button"
                onClick={installUpdate}
                disabled={updateBusy || !updateStatus?.update_available}
                aria-busy={updateBusy}
                aria-label="Install update"
              >
                {updateBusy ? 'Working...' : 'Install update'}
              </button>
              <button
                type="button"
                className="settings-button secondary"
                onClick={uninstallUpdate}
                disabled={updateBusy || updateHistory.length < 2}
                title={updateHistory.length < 2 ? 'Need at least one update installed to rollback' : 'Rollback to previous version'}
                aria-busy={updateBusy}
                aria-label="Uninstall update"
              >
                Uninstall update
              </button>
            </div>
            <div className="settings-update-history">
              <div className="settings-update-heading">Update history</div>
              {updateHistory.length === 0 ? (
                <div className="settings-update-empty">No updates installed yet.</div>
              ) : (
                <div className="settings-update-history-list">
                  {updateHistory.map((entry) => (
                    <div key={entry.id} className="settings-update-history-item">
                      <div>
                        <div className="settings-update-history-version">Version {entry.version}</div>
                        <div className="settings-update-history-date">{formatDateTime(entry.applied_at)}</div>
                      </div>
                      <div className="settings-update-history-status">{entry.status}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="settings-app">
      <div className="settings-sidebar">
        <div className="settings-sidebar-title">Settings</div>
        <nav className="settings-nav">
          {SECTIONS.map(section => {
            const Icon = section.icon
            return (
              <button
                key={section.id}
                className={`settings-nav-item ${activeSection === section.id ? 'active' : ''}`}
                onClick={() => setActiveSection(section.id)}
                aria-current={activeSection === section.id ? 'page' : undefined}
                aria-label={`${section.label} settings`}
              >
                <Icon size={20} className="settings-nav-icon" />
                <span className="settings-nav-label">{section.label}</span>
              </button>
            )
          })}
        </nav>
      </div>
      <div className="settings-main">
        {renderSection()}
      </div>
    </div>
  )
}