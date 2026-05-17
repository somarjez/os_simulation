import { useState, useEffect } from 'react'
import { Download, Trash2, X } from 'lucide-react'
import appStoreButtonArrowUrl from '../assets/app-store/app-store-button-arrow.svg'
import appStoreHeroUrl from '../assets/app-store/app-store-hero.svg'
import appStoreClockUrl from '../assets/app-store/app-store-clock.svg'
import appStorePaintUrl from '../assets/app-store/paint-icon.svg'
import appStoreNotepadPlusPlusUrl from '../assets/app-store/notepad-plus-plus-icon.svg'

const APP_STORE_ICON_SOURCES = {
  terminal: '/desktop-icons/terminal.png',
  files: '/desktop-icons/files.png',
  localfiles: '/desktop-icons/localfiles.png',
  notes: '/desktop-icons/notes.png',
  settings: '/desktop-icons/settings-exact.svg',
  monitor: '/desktop-icons/monitor.png',
  appstore: '/desktop-icons/appstore.png',
  eventviewer: '/desktop-icons/eventviewer.png',
  diagnostics: '/desktop-icons/diagnostics.png',
  calculator: '/desktop-icons/calculator.png',
  camera: '/desktop-icons/camera.png',
  clock: '/desktop-icons/clock.png',
  paint: appStorePaintUrl,
  'notepad++': appStoreNotepadPlusPlusUrl,
  calendar: '/desktop-icons/calendar.png',
  tips: '/desktop-icons/tips.png',
  webbrowser: '/desktop-icons/webbrowser.png',
  armourycrate: '/desktop-icons/armourycrate.png',
  minesweeper: '/desktop-icons/minesweeper.svg',
  solitaire: '/desktop-icons/solitaire.svg'
}

export default function AppStore() {
  const [installedApps, setInstalledApps] = useState([])
  const [availableApps, setAvailableApps] = useState([])
  const [activeTab, setActiveTab] = useState('installed')
  const [loading, setLoading] = useState(true)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadApps()
  }, [])

  const loadApps = async () => {
    try {
      const [installed, available] = await Promise.all([
        fetch('http://localhost:8000/app/list').then(r => r.json()),
        fetch('http://localhost:8000/app/store').then(r => r.json())
      ])
      setInstalledApps(installed)
      setAvailableApps(available)
    } catch (error) {
      setMessage('Failed to load apps')
    } finally {
      setLoading(false)
    }
  }

  const handleInstallClick = (app) => {
    setInstallPrompt({
      ...app,
      permissionsText: app.permissions?.length > 0
        ? app.permissions.join(', ')
        : 'No special permissions required'
    })
  }

  const confirmInstall = async (app) => {
    try {
      const response = await fetch('http://localhost:8000/app/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: app.id,
          name: app.name,
          version: app.version,
          description: app.description,
          icon: app.icon,
          category: app.category,
          permissions: app.permissions || []
        })
      })

      if (response.ok) {
        setMessage(`${app.name} installed successfully!`)
        setInstallPrompt(null)
        loadApps()
      } else {
        setMessage('Installation failed')
      }
    } catch (error) {
      setMessage('Installation error: ' + error.message)
    }
  }

  const handleUninstall = async (appId, appName) => {
    if (!confirm(`Uninstall ${appName}?`)) return

    try {
      const response = await fetch(`http://localhost:8000/app/uninstall?app_id=${encodeURIComponent(appId)}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setMessage(`${appName} uninstalled successfully`)
        loadApps()
      } else {
        const error = await response.json()
        setMessage(`Error: ${error.detail || 'Uninstall failed'}`)
      }
    } catch (error) {
      setMessage('Uninstall error: ' + error.message)
    }
  }

  if (loading) {
    return (
      <div className="app-store">
        <div className="app-store-loading">Loading apps...</div>
      </div>
    )
  }

  return (
    <div className="app-store">
      {message && (
        <div className="app-store-message">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="app-store-message-close" aria-label="Dismiss message">
            <X size={14} />
          </button>
        </div>
      )}

      <section className="app-store-hero" aria-label="App Store welcome">
        <img className="app-store-hero-art" src={appStoreHeroUrl} alt="" aria-hidden="true" />
        <div className="app-store-hero-copy">
          <div className="app-store-eyebrow">
            <span>Explore the App Store</span>
            <span className="app-store-eyebrow-dot" aria-hidden="true" />
            <span>Your apps, One place</span>
            <span className="app-store-eyebrow-dot" aria-hidden="true" />
          </div>
          <h1>Discover Apps for your Workspace</h1>
          <p>Install tools, games, and utilities to personalize your desktop experience.</p>
          <button className="app-store-hero-button" onClick={() => setActiveTab('available')}>
            Browse Apps
            <img src={appStoreButtonArrowUrl} alt="" aria-hidden="true" />
          </button>
        </div>
      </section>

      <section className="app-store-panel">
        <div className="app-store-tabs">
          <button
            className={`app-store-tab ${activeTab === 'installed' ? 'active' : ''}`}
            onClick={() => setActiveTab('installed')}
          >
            Installed ({installedApps.length})
          </button>
          <button
            className={`app-store-tab ${activeTab === 'available' ? 'active' : ''}`}
            onClick={() => setActiveTab('available')}
          >
            App Store ({availableApps.length})
          </button>
        </div>

        <div className="app-store-content">
          {activeTab === 'installed' ? (
            <AppGrid
              apps={installedApps}
              emptyText="No apps installed"
              renderAction={(app) => (
                app.builtin ? (
                  <div className="app-store-badge">Built in</div>
                ) : (
                  <button
                    className="app-store-uninstall"
                    onClick={() => handleUninstall(app.id, app.name)}
                    title="Uninstall"
                  >
                    <Trash2 size={12} />
                    Uninstall
                  </button>
                )
              )}
            />
          ) : (
            <AppGrid
              apps={availableApps}
              emptyText="All apps are already installed"
              renderAction={(app) => (
                <button
                  className="app-store-install"
                  onClick={() => handleInstallClick(app)}
                >
                  <Download size={12} />
                  Install
                </button>
              )}
            />
          )}
        </div>
      </section>

      {installPrompt && (
        <div className="app-store-prompt-overlay">
          <div className="app-store-prompt">
            <button
              className="app-store-prompt-close"
              onClick={() => setInstallPrompt(null)}
              aria-label="Close install prompt"
            >
              <X size={20} />
            </button>

            <div className="app-store-prompt-icon">
              <img src={getAppIconSrc(installPrompt)} alt="" />
            </div>
            <h2 className="app-store-prompt-title">Install {installPrompt.name}?</h2>
            <p className="app-store-prompt-description">{installPrompt.description}</p>

            <div className="app-store-prompt-section">
              <h3 className="app-store-prompt-label">Permissions Required:</h3>
              <div className="app-store-permissions">
                {installPrompt.permissions?.length > 0 ? (
                  <ul>
                    {installPrompt.permissions.map(perm => (
                      <li key={perm}>{perm}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No special permissions required</p>
                )}
              </div>
            </div>

            <div className="app-store-prompt-actions">
              <button
                className="app-store-prompt-cancel"
                onClick={() => setInstallPrompt(null)}
              >
                Cancel
              </button>
              <button
                className="app-store-prompt-confirm"
                onClick={() => confirmInstall(installPrompt)}
              >
                Install
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AppGrid({ apps, emptyText, renderAction }) {
  if (apps.length === 0) {
    return <div className="app-store-empty">{emptyText}</div>
  }

  return (
    <div className="app-store-grid">
      {apps.map(app => (
        <article key={app.id} className="app-store-item">
          <div className="app-store-icon">
            <img src={getAppIconSrc(app)} alt="" />
          </div>
          <div className="app-store-info">
            <div className="app-store-name">{app.name}</div>
            <div className="app-store-version">v{app.version}</div>
            <div className="app-store-description">{app.description}</div>
            {app.storage_size_mb && (
              <div className="app-store-storage">{app.storage_size_mb} mb</div>
            )}
            {!app.storage_size_mb && app.category && (
              <div className="app-store-category">{app.category}</div>
            )}
          </div>
          {renderAction(app)}
        </article>
      ))}
    </div>
  )
}

function getAppIconSrc(app) {
  return APP_STORE_ICON_SOURCES[app.id] || app.iconSrc || app.desktopIconSrc || appStoreClockUrl
}
