import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, FileText, Folder, HardDrive, Settings, Terminal, Bell, Package, AlertCircle, Stethoscope, Calculator, Camera, Clock, Calendar as CalendarIcon, Lightbulb, Shield, LayoutGrid, ArrowUpDown, RefreshCw, PlusCircle, Monitor, Palette, Ellipsis, Bomb, Spade } from 'lucide-react'
import AppLauncher from '../app-management/AppLauncher.jsx'
import ContextMenu from '../ui/ContextMenu.jsx'
import StartMenu from './StartMenu.jsx'
import Taskbar from './Taskbar.jsx'
import Window from './Window.jsx'
import Toast from '../ui/Toast.jsx'
import NotificationCenter from '../system/NotificationCenter.jsx'
import ActionCenter from '../system/ActionCenter.jsx'
import Calendar from '../ui/Calendar.jsx'
import AppSwitcher from '../app-management/AppSwitcher.jsx'
import TerminalApp from '../../apps/TerminalApp.jsx'
import FileExplorer from '../../apps/FileExplorer.jsx'
import NotesApp from '../../apps/NotesApp.jsx'
import SettingsApp from '../../apps/SettingsApp.jsx'
import SystemMonitor from '../../apps/SystemMonitor.jsx'
import LocalFilesApp from '../../apps/LocalFilesApp.jsx'
import AppStore from '../../apps/AppStore.jsx'
import EventViewer from '../../apps/EventViewer.jsx'
import SystemDiagnostics from '../../apps/SystemDiagnostics.jsx'
import CalculatorApp from '../../apps/CalculatorApp.jsx'
import CameraApp from '../../apps/CameraApp.jsx'
import ClockApp from '../../apps/ClockApp.jsx'
import CalendarViewerApp from '../../apps/CalendarViewerApp.jsx'
import TipsApp from '../../apps/TipsApp.jsx'
import WebBrowserApp from '../../apps/WebBrowserApp.jsx'
import ArmouryCrateApp from '../../apps/ArmouryCrateApp.jsx'
import MinesweeperApp from '../../apps/MinesweeperApp.jsx'
import SolitaireApp from '../../apps/SolitaireApp.jsx'

const RECYCLE_BIN_PATH = '/home/user/.recycle_bin'
const ARMOURY_DEVICE_SETTINGS_STORAGE_KEY = 'jezos_armoury_device_settings'
const ARMOURY_DISPLAY_SETTINGS_STORAGE_KEY = 'jezos_armoury_display_settings_state'
const DESKTOP_VIEW_SETTINGS_STORAGE_KEY = 'jez_os_desktop_view_settings'
const RECYCLE_BIN_DESKTOP_ITEM = {
  path: RECYCLE_BIN_PATH,
  type: 'dir',
  synthetic: true
}

const DEFAULT_ARMOURY_DISPLAY_SETTINGS = {
  gameVisualEnabled: true,
  selectedPreset: 'default',
  colorTemperature: 50,
  osdEnabled: true,
  lastUserSelectionAt: null
}

const DEFAULT_DESKTOP_VIEW_SETTINGS = {
  iconSize: 'medium',
  autoArrangeIcons: false,
  alignIconsToGrid: true,
  showDesktopIcons: true
}

function loadDesktopViewSettings() {
  try {
    const saved = localStorage.getItem(DESKTOP_VIEW_SETTINGS_STORAGE_KEY)
    if (!saved) return DEFAULT_DESKTOP_VIEW_SETTINGS

    const parsed = JSON.parse(saved)
    return {
      iconSize: ['large', 'medium', 'small'].includes(parsed?.iconSize) ? parsed.iconSize : DEFAULT_DESKTOP_VIEW_SETTINGS.iconSize,
      autoArrangeIcons: typeof parsed?.autoArrangeIcons === 'boolean' ? parsed.autoArrangeIcons : DEFAULT_DESKTOP_VIEW_SETTINGS.autoArrangeIcons,
      alignIconsToGrid: typeof parsed?.alignIconsToGrid === 'boolean' ? parsed.alignIconsToGrid : DEFAULT_DESKTOP_VIEW_SETTINGS.alignIconsToGrid,
      showDesktopIcons: typeof parsed?.showDesktopIcons === 'boolean' ? parsed.showDesktopIcons : DEFAULT_DESKTOP_VIEW_SETTINGS.showDesktopIcons
    }
  } catch (error) {
    console.warn('Failed to load desktop view settings:', error)
    return DEFAULT_DESKTOP_VIEW_SETTINGS
  }
}

function normalizeDesktopViewSettings(settings) {
  return {
    iconSize: ['large', 'medium', 'small'].includes(settings?.iconSize) ? settings.iconSize : DEFAULT_DESKTOP_VIEW_SETTINGS.iconSize,
    autoArrangeIcons: Boolean(settings?.autoArrangeIcons),
    alignIconsToGrid: settings?.alignIconsToGrid !== false,
    showDesktopIcons: settings?.showDesktopIcons !== false
  }
}

// Component mapping for built-in apps
const APP_COMPONENTS = {
  'terminal': TerminalApp,
  'files': FileExplorer,
  'localfiles': LocalFilesApp,
  'notes': NotesApp,
  'settings': SettingsApp,
  'monitor': SystemMonitor,
  'appstore': AppStore,
  'eventviewer': EventViewer,
  'diagnostics': SystemDiagnostics,
  'calculator': CalculatorApp,
  'camera': CameraApp,
  'clock': ClockApp,
  'calendar': CalendarViewerApp,
  'tips': TipsApp,
  'webbrowser': WebBrowserApp,
  'armourycrate': ArmouryCrateApp,
  'minesweeper': MinesweeperApp,
  'solitaire': SolitaireApp
}

// Icon mapping for all apps
const APP_ICONS = {
  'terminal': Terminal,
  'files': Folder,
  'localfiles': HardDrive,
  'notes': FileText,
  'settings': Settings,
  'monitor': Activity,
  'appstore': Package,
  'eventviewer': AlertCircle,
  'diagnostics': Stethoscope,
  'calculator': Calculator,
  'camera': Camera,
  'clock': Clock,
  'calendar': CalendarIcon,
  'tips': Lightbulb,
  'webbrowser': Package, // You can replace with a browser icon if available
  'armourycrate': Shield,
  'minesweeper': Bomb,
  'solitaire': Spade
}

const APP_ICON_SOURCES = {
  'armourycrate': '/armoury-crate-icon.png'
}

const APP_DESKTOP_ICON_SOURCES = {
  'terminal': '/desktop-icons/terminal.png',
  'files': '/desktop-icons/files.png',
  'localfiles': '/desktop-icons/localfiles.png',
  'notes': '/desktop-icons/notes.png',
  'settings': '/desktop-icons/settings-exact.svg',
  'monitor': '/desktop-icons/monitor.png',
  'appstore': '/desktop-icons/appstore.png',
  'eventviewer': '/desktop-icons/eventviewer.png',
  'diagnostics': '/desktop-icons/diagnostics.png',
  'calculator': '/desktop-icons/calculator.png',
  'camera': '/desktop-icons/camera.png',
  'clock': '/desktop-icons/clock.png',
  'calendar': '/desktop-icons/calendar.png',
  'tips': '/desktop-icons/tips.png',
  'webbrowser': '/desktop-icons/webbrowser.png',
  'armourycrate': '/desktop-icons/armourycrate.png',
  'minesweeper': '/desktop-icons/minesweeper.svg',
  'solitaire': '/desktop-icons/solitaire.svg'
}

const WINDOW_DEFAULTS = {
  width: 420,
  height: 280,
  x: 120,
  y: 120
}

const DESKTOP_GRID_COLUMNS = 5
const DESKTOP_SORT_MODES = {
  name: 'name',
  size: 'size',
  type: 'type',
  modified: 'modified'
}

const APP_CATEGORY_SORT_ORDER = {
  System: 0,
  Productivity: 1,
  Multimedia: 2,
  Internet: 3
}

// Apps that should open maximized by default, similar to common desktop UX.
const MAXIMIZED_BY_DEFAULT_APP_IDS = new Set([
  'files',
  'localfiles',
  'notes',
  'settings',
  'monitor',
  'webbrowser',
  'appstore',
  'eventviewer',
  'diagnostics',
  'armourycrate'
])

const SESSION_PERSISTENT_APP_IDS = new Set([
  'armourycrate'
])

function getActiveWindowsStorageKey() {
  try {
    const deviceId = localStorage.getItem('jez_os_device_id') || 'device-guest'
    return `jez_os_active_windows:${deviceId}`
  } catch {
    return 'jez_os_active_windows:device-guest'
  }
}

export default function Desktop({ user, onLogout, onLock, onRestart, onShutdown, onSleep, isSleeping = false }) {
  const [appRegistry, setAppRegistry] = useState([])
  const [desktopFiles, setDesktopFiles] = useState([])
  const [windows, setWindows] = useState([])
  const [zCounter, setZCounter] = useState(2)
  const [activeWindowId, setActiveWindowId] = useState(null)
  const zeroKeyPressed = useRef(false)
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0 })
  const [contextMenuItems, setContextMenuItems] = useState([])
  const [showStartMenu, setShowStartMenu] = useState(false)
  const [showNotificationCenter, setShowNotificationCenter] = useState(false)
  const [showActionCenter, setShowActionCenter] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [showAppSwitcher, setShowAppSwitcher] = useState(false)
  const [appSwitcherIndex, setAppSwitcherIndex] = useState(0)
  const [toasts, setToasts] = useState([])
  const [recentApps, setRecentApps] = useState([])
  const [taskbarSearchQuery, setTaskbarSearchQuery] = useState('')
  const [updateStatus, setUpdateStatus] = useState(null)
  const [desktopSortMode, setDesktopSortMode] = useState(DESKTOP_SORT_MODES.name)
  const [isRefreshingDesktop, setIsRefreshingDesktop] = useState(false)
  const [desktopViewSettings, setDesktopViewSettings] = useState(() => loadDesktopViewSettings())
  const [armouryDeviceSettings, setArmouryDeviceSettings] = useState(() => loadArmouryDeviceSettings())
  const [armouryDisplaySettings, setArmouryDisplaySettings] = useState(() => loadArmouryDisplaySettings())
  const [pinnedAppIds, setPinnedAppIds] = useState(() => {
    try {
      const saved = localStorage.getItem('jez_os_pinned_apps')
      const parsed = saved ? JSON.parse(saved) : []
      return Array.isArray(parsed) ? parsed : []
    } catch (error) {
      console.warn('Failed to load pinned apps:', error)
      return []
    }
  })
  const [iconPositions, setIconPositions] = useState(() => {
    try {
      const saved = localStorage.getItem('jez_os_icon_positions')
      if (!saved) return {}
      const parsed = JSON.parse(saved)
      // If webbrowser icon is missing, force reset
      if (!Object.keys(parsed).includes('webbrowser')) {
        localStorage.removeItem('jez_os_icon_positions');
        return {};
      }
      // Validate positions - ensure row and col are valid numbers
      const validated = {}
      Object.entries(parsed).forEach(([id, pos]) => {
        if (pos && typeof pos.row === 'number' && typeof pos.col === 'number' && 
            pos.row >= 0 && pos.col >= 0 && pos.col < 5) {
          validated[id] = pos
        }
      })
      return validated
    } catch (error) {
      console.warn('Failed to load icon positions from localStorage:', error)
      return {}
    }
  })
  const refreshAnimationTimeoutRef = useRef(null)
  const syncedShortcutPayloadsRef = useRef(new Map())
  const pendingWindowPidsRef = useRef(new Map())
  
  const resetDesktopLayout = () => {
    localStorage.removeItem('jez_os_icon_positions')
    // Create new positions for current appRegistry
    setAppRegistry((prev) => {
      const newPositions = {}
      prev.forEach((app, index) => {
        newPositions[app.id] = {
          row: Math.floor(index / DESKTOP_GRID_COLUMNS),
          col: index % DESKTOP_GRID_COLUMNS
        }
      })
      setIconPositions(newPositions)
      return prev
    })
  }

  useEffect(() => {
    return () => {
      if (refreshAnimationTimeoutRef.current) {
        clearTimeout(refreshAnimationTimeoutRef.current)
      }
      syncedShortcutPayloadsRef.current.clear()
      pendingWindowPidsRef.current.clear()
    }
  }, [])

  const pulseDesktopRefreshAnimation = () => {
    if (refreshAnimationTimeoutRef.current) {
      clearTimeout(refreshAnimationTimeoutRef.current)
    }

    setIsRefreshingDesktop(true)
    refreshAnimationTimeoutRef.current = setTimeout(() => {
      setIsRefreshingDesktop(false)
    }, 220)
  }

  const parseDateValue = (value) => {
    if (!value) return 0
    const timestamp = Date.parse(value)
    return Number.isFinite(timestamp) ? timestamp : 0
  }

  const getDesktopSortableEntries = () => {
    const appEntries = appRegistry.map((app, index) => ({
      id: app.id,
      label: app.title,
      kind: 'app',
      size: Number(app.storage_size_mb ?? app.storageSizeMb ?? 0),
      modifiedAt: parseDateValue(app.installed_at || app.created_at || app.createdAt),
      typeRank: APP_CATEGORY_SORT_ORDER[app.category] ?? 99,
      originalIndex: index
    }))

    const fileEntries = desktopFiles
      .filter((file) => !file.path.endsWith('.lnk'))
      .map((file, index) => {
        const isRecycleBin = file.path === RECYCLE_BIN_PATH
        const isFolder = file.type === 'dir'
        const label = isRecycleBin ? 'Recycle Bin' : file.path.split('/').pop()
        return {
          id: `file-${file.path}`,
          label,
          kind: 'file',
          size: Number(file.size || 0),
          modifiedAt: parseDateValue(file.modified_at || file.modifiedAt || file.created_at || file.createdAt || file.deleted_at),
          typeRank: isFolder ? 1 : 2,
          originalIndex: appEntries.length + index,
          itemType: isFolder ? 'Folder' : 'File'
        }
      })

    return [...appEntries, ...fileEntries]
  }

  const applyDesktopSort = (sortMode) => {
    const entries = getDesktopSortableEntries()
    const compareByName = (left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' })

    const comparators = {
      name: (left, right) => compareByName(left, right),
      size: (left, right) => (left.size - right.size) || compareByName(left, right),
      type: (left, right) => (left.typeRank - right.typeRank) || compareByName(left, right),
      modified: (left, right) => (right.modifiedAt - left.modifiedAt) || compareByName(left, right)
    }

    const comparator = comparators[sortMode] || comparators.name
    const ordered = [...entries].sort(comparator)
    setDesktopSortMode(sortMode)
    setIconPositions((prev) => {
      const next = { ...prev }
      ordered.forEach((entry, index) => {
        next[entry.id] = {
          row: Math.floor(index / DESKTOP_GRID_COLUMNS),
          col: index % DESKTOP_GRID_COLUMNS
        }
      })
      return next
    })
  }

  const arrangeDesktopIcons = () => {
    const orderedEntries = [
      ...appRegistry.map((app) => ({ id: app.id, label: app.title })),
      ...desktopFiles
        .filter((file) => !file.path.endsWith('.lnk'))
        .map((file) => {
          const isRecycleBin = file.path === RECYCLE_BIN_PATH
          const fileName = isRecycleBin ? 'Recycle Bin' : file.path.split('/').pop()
          return {
            id: `file-${file.path}`,
            label: fileName
          }
        })
    ]

    setIconPositions((prev) => {
      const next = { ...prev }
      orderedEntries.forEach((entry, index) => {
        next[entry.id] = {
          row: Math.floor(index / DESKTOP_GRID_COLUMNS),
          col: index % DESKTOP_GRID_COLUMNS
        }
      })
      return next
    })
  }

  const updateDesktopViewSettings = (patch) => {
    setDesktopViewSettings((previous) => {
      const next = normalizeDesktopViewSettings({ ...previous, ...patch })
      try {
        localStorage.setItem(DESKTOP_VIEW_SETTINGS_STORAGE_KEY, JSON.stringify(next))
      } catch (error) {
        console.warn('Failed to save desktop view settings:', error)
      }
      return next
    })
  }
  
  // Load apps from backend on mount
  useEffect(() => {
    const loadApps = async () => {
      const defaultRegistry = [
        { id: 'terminal', title: 'Terminal', icon: Terminal, desktopIconSrc: APP_DESKTOP_ICON_SOURCES.terminal, component: TerminalApp, category: 'System', storage_size_mb: 45, created_at: '2026-01-01T00:00:00Z' },
        { id: 'files', title: 'Files', icon: Folder, desktopIconSrc: APP_DESKTOP_ICON_SOURCES.files, component: FileExplorer, category: 'System', storage_size_mb: 32, created_at: '2026-01-02T00:00:00Z' },
        { id: 'localfiles', title: 'Local Files', icon: HardDrive, desktopIconSrc: APP_DESKTOP_ICON_SOURCES.localfiles, component: LocalFilesApp, category: 'System', storage_size_mb: 18, created_at: '2026-01-03T00:00:00Z' },
        { id: 'notes', title: 'Notes', icon: FileText, desktopIconSrc: APP_DESKTOP_ICON_SOURCES.notes, component: NotesApp, category: 'Productivity', storage_size_mb: 12, created_at: '2026-01-04T00:00:00Z' },
        { id: 'settings', title: 'Settings', icon: Settings, desktopIconSrc: APP_DESKTOP_ICON_SOURCES.settings, component: SettingsApp, category: 'System', storage_size_mb: 8, created_at: '2026-01-05T00:00:00Z' },
        { id: 'monitor', title: 'System Monitor', icon: Activity, desktopIconSrc: APP_DESKTOP_ICON_SOURCES.monitor, component: SystemMonitor, category: 'System', storage_size_mb: 25, created_at: '2026-01-06T00:00:00Z' },
        { id: 'webbrowser', title: 'Web Browser', icon: Package, desktopIconSrc: APP_DESKTOP_ICON_SOURCES.webbrowser, component: WebBrowserApp, category: 'Internet', storage_size_mb: 22, created_at: '2026-01-07T00:00:00Z' },
        { id: 'appstore', title: 'App Store', icon: Package, desktopIconSrc: APP_DESKTOP_ICON_SOURCES.appstore, component: AppStore, category: 'System', storage_size_mb: 56, created_at: '2026-01-08T00:00:00Z' },
        { id: 'eventviewer', title: 'Event Viewer', icon: AlertCircle, desktopIconSrc: APP_DESKTOP_ICON_SOURCES.eventviewer, component: EventViewer, category: 'System', storage_size_mb: 20, created_at: '2026-01-09T00:00:00Z' },
        { id: 'diagnostics', title: 'System Diagnostics', icon: Stethoscope, desktopIconSrc: APP_DESKTOP_ICON_SOURCES.diagnostics, component: SystemDiagnostics, category: 'System', storage_size_mb: 30, created_at: '2026-01-10T00:00:00Z' },
        {
          id: 'armourycrate',
          title: 'Armoury Crate',
          icon: Shield,
          iconSrc: APP_ICON_SOURCES.armourycrate,
          desktopIconSrc: APP_DESKTOP_ICON_SOURCES.armourycrate,
          component: ArmouryCrateApp,
          category: 'System',
          storage_size_mb: 0,
          created_at: '2026-01-11T00:00:00Z'
        },
        { id: 'minesweeper', title: 'Minesweeper', icon: Bomb, desktopIconSrc: APP_DESKTOP_ICON_SOURCES.minesweeper, component: MinesweeperApp, category: 'Games', storage_size_mb: 2, created_at: '2026-01-12T00:00:00Z' },
        { id: 'solitaire', title: 'Solitaire', icon: Spade, desktopIconSrc: APP_DESKTOP_ICON_SOURCES.solitaire, component: SolitaireApp, category: 'Games', storage_size_mb: 2, created_at: '2026-01-13T00:00:00Z' }
      ]

      try {
        const response = await fetch('http://localhost:8000/app/list')
        if (!response.ok) {
          throw new Error('Failed to fetch app list')
        }
        const apps = await response.json()
        if (!Array.isArray(apps) || apps.length === 0) {
          setAppRegistry(defaultRegistry)
          setIconPositions((prev) => {
            const updated = { ...prev }
            defaultRegistry.forEach((app, index) => {
              if (!updated[app.id]) {
                updated[app.id] = {
                  row: Math.floor(index / 5),
                  col: index % 5
                }
              }
            })
            return updated
          })
          return
        }
        
        // Convert API response to app registry format
        let registry = apps.map(app => ({
          id: app.id,
          title: app.name,
          icon: APP_ICONS[app.id] || Package,
          iconSrc: APP_ICON_SOURCES[app.id] || null,
          desktopIconSrc: APP_DESKTOP_ICON_SOURCES[app.id] || APP_ICON_SOURCES[app.id] || null,
          component: APP_COMPONENTS[app.id] || AppStore,
          installed: app.installed,
          category: app.category || 'System',
          storage_size_mb: app.storage_size_mb || 0,
          created_at: app.created_at || app.installed_at || null
        }))

        // Ensure critical system apps are always present
        if (!registry.some((app) => app.id === 'appstore')) {
          registry = [
            ...registry,
            {
              id: 'appstore',
              title: 'App Store',
              icon: Package,
              desktopIconSrc: APP_DESKTOP_ICON_SOURCES.appstore,
              component: AppStore,
              installed: 1,
              category: 'System',
              storage_size_mb: 56,
              created_at: '2026-01-08T00:00:00Z'
            }
          ]
        }
        
        if (!registry.some((app) => app.id === 'eventviewer')) {
          registry = [
            ...registry,
            {
              id: 'eventviewer',
              title: 'Event Viewer',
              icon: AlertCircle,
              desktopIconSrc: APP_DESKTOP_ICON_SOURCES.eventviewer,
              component: EventViewer,
              installed: 1,
              category: 'System',
              storage_size_mb: 20,
              created_at: '2026-01-09T00:00:00Z'
            }
          ]
        }

        if (!registry.some((app) => app.id === 'diagnostics')) {
          registry = [
            ...registry,
            {
              id: 'diagnostics',
              title: 'System Diagnostics',
              icon: Stethoscope,
              desktopIconSrc: APP_DESKTOP_ICON_SOURCES.diagnostics,
              component: SystemDiagnostics,
              installed: 1,
              category: 'System',
              storage_size_mb: 30,
              created_at: '2026-01-10T00:00:00Z'
            }
          ]
        }

        if (!registry.some((app) => app.id === 'armourycrate')) {
          registry = [
            ...registry,
            {
              id: 'armourycrate',
              title: 'Armoury Crate',
              icon: Shield,
              iconSrc: APP_ICON_SOURCES.armourycrate,
              desktopIconSrc: APP_DESKTOP_ICON_SOURCES.armourycrate,
              component: ArmouryCrateApp,
              installed: 1,
              category: 'System',
              storage_size_mb: 0,
              created_at: '2026-01-11T00:00:00Z'
            }
          ]
        }

        if (!registry.some((app) => app.id === 'minesweeper')) {
          registry = [
            ...registry,
            {
              id: 'minesweeper',
              title: 'Minesweeper',
              icon: Bomb,
              desktopIconSrc: APP_DESKTOP_ICON_SOURCES.minesweeper,
              component: MinesweeperApp,
              installed: 1,
              category: 'Games',
              storage_size_mb: 2,
              created_at: '2026-01-12T00:00:00Z'
            }
          ]
        }

        if (!registry.some((app) => app.id === 'solitaire')) {
          registry = [
            ...registry,
            {
              id: 'solitaire',
              title: 'Solitaire',
              icon: Spade,
              desktopIconSrc: APP_DESKTOP_ICON_SOURCES.solitaire,
              component: SolitaireApp,
              installed: 1,
              category: 'Games',
              storage_size_mb: 2,
              created_at: '2026-01-13T00:00:00Z'
            }
          ]
        }
        
        setAppRegistry(registry)
        
        // Update icon positions for any new apps that don't have saved positions
        setIconPositions((prev) => {
          const updated = { ...prev }
          registry.forEach((app, index) => {
            if (!updated[app.id]) {
              updated[app.id] = {
                row: Math.floor(index / 5),
                col: index % 5
              }
            }
          })
          return updated
        })
      } catch (error) {
        console.error('Failed to load apps:', error)
        // Fallback to default apps if backend fails
        setAppRegistry(defaultRegistry)
        
        // Update positions for fallback apps
        setIconPositions((prev) => {
          const updated = { ...prev }
          defaultRegistry.forEach((app, index) => {
            if (!updated[app.id]) {
              updated[app.id] = {
                row: Math.floor(index / 5),
                col: index % 5
              }
            }
          })
          return updated
        })
      }
    }
    
    loadApps()
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(DESKTOP_VIEW_SETTINGS_STORAGE_KEY, JSON.stringify(desktopViewSettings))
    } catch (error) {
      console.warn('Failed to persist desktop view settings:', error)
    }
  }, [desktopViewSettings])

  useEffect(() => {
    if (desktopViewSettings.autoArrangeIcons) {
      arrangeDesktopIcons()
    }
  }, [desktopViewSettings.autoArrangeIcons, appRegistry, desktopFiles])

  useEffect(() => {
    const syncArmouryDeviceSettings = (event) => {
      if (event?.detail) {
        setArmouryDeviceSettings((previous) => ({ ...previous, ...event.detail }))
        return
      }

      setArmouryDeviceSettings(loadArmouryDeviceSettings())
    }

    window.addEventListener('jezos_armoury_device_settings_updated', syncArmouryDeviceSettings)
    return () => window.removeEventListener('jezos_armoury_device_settings_updated', syncArmouryDeviceSettings)
  }, [])

  useEffect(() => {
    const syncArmouryDisplaySettings = (event) => {
      if (event?.detail) {
        setArmouryDisplaySettings(normalizeArmouryDisplaySettings(event.detail))
        return
      }

      setArmouryDisplaySettings(loadArmouryDisplaySettings())
    }

    window.addEventListener('jezos_armoury_display_settings_updated', syncArmouryDisplaySettings)
    window.addEventListener('storage', syncArmouryDisplaySettings)

    return () => {
      window.removeEventListener('jezos_armoury_display_settings_updated', syncArmouryDisplaySettings)
      window.removeEventListener('storage', syncArmouryDisplaySettings)
    }
  }, [])

  useEffect(() => {
    let intervalId = null
    const loadUpdateStatus = async () => {
      try {
        const response = await fetch('http://localhost:8000/update/status')
        if (response.ok) {
          const data = await response.json()
          setUpdateStatus(data.state || null)
        }
      } catch (error) {
        // ignore
      }
    }

    loadUpdateStatus()
    intervalId = setInterval(loadUpdateStatus, 8000)

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [])

  // Save icon positions to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('jez_os_icon_positions', JSON.stringify(iconPositions))
    } catch (error) {
      console.warn('Failed to save icon positions:', error)
    }
  }, [iconPositions])

  // Load desktop files from filesystem
  useEffect(() => {
    const loadDesktopFiles = async () => {
      try {
        const response = await fetch('http://localhost:8000/fs/list?path=%2Fhome%2Fuser%2FDesktop')
        if (response.ok) {
          const data = await response.json()
          console.log('Desktop files:', data.nodes)
          const nodes = Array.isArray(data.nodes) ? data.nodes : []
          const hasRecycleBin = nodes.some((node) => node.path === RECYCLE_BIN_PATH)
          setDesktopFiles(hasRecycleBin ? nodes : [RECYCLE_BIN_DESKTOP_ITEM, ...nodes])
        } else {
          console.error('Failed to load desktop files')
        }
      } catch (error) {
        console.error('Failed to load desktop files:', error)
      }
    }

    // Load on mount and then every 5 seconds to catch changes
    loadDesktopFiles()
    const interval = setInterval(loadDesktopFiles, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const emitWindowSnapshot = () => {
      const mapped = windows.map((win) => ({
        id: Number(win.id),
        title: win.title,
        appId: win.appId,
        memory: Number(win.memory) || 12,
        minimized: Boolean(win.minimized)
      }))

      window.__jezOsDesktopWindows = mapped
      try {
        localStorage.setItem(getActiveWindowsStorageKey(), JSON.stringify(mapped))
      } catch (error) {
        console.warn('Failed to persist active windows snapshot:', error)
      }

      window.dispatchEvent(new CustomEvent('desktop-windows-changed', { detail: { windows: mapped } }))
    }

    const handleWindowsRequest = () => emitWindowSnapshot()

    emitWindowSnapshot()
    window.addEventListener('desktop-windows-request', handleWindowsRequest)
    return () => window.removeEventListener('desktop-windows-request', handleWindowsRequest)
  }, [windows])

  // Handle opening desktop files
  useEffect(() => {
    const handleOpenFile = (event) => {
      console.log('Custom event received:', event.detail)
      openDesktopFile(event.detail)
    }

    const handleLaunchShortcut = (event) => {
      console.log('Launch shortcut event received:', event.detail)
      launchShortcut(event.detail.path)
    }

    const handleOpenFileInApp = (event) => {
      console.log('[Desktop] openFileInApp event received:', event.detail)
      const { appId, filePath } = event.detail
      // Find the app in registry
      const app = appRegistry.find(a => a.id === appId)
      if (app) {
        console.log('[Desktop] Launching app:', app.title)
        launchApp(app)
      } else {
        console.error('[Desktop] App not found:', appId)
      }
    }
    
    window.addEventListener('openDesktopFile', handleOpenFile)
    window.addEventListener('launchAppShortcut', handleLaunchShortcut)
    window.addEventListener('openFileInApp', handleOpenFileInApp)
    return () => {
      window.removeEventListener('openDesktopFile', handleOpenFile)
      window.removeEventListener('launchAppShortcut', handleLaunchShortcut)
      window.removeEventListener('openFileInApp', handleOpenFileInApp)
    }
  }, [appRegistry])

  // Sync desktop apps to filesystem
  useEffect(() => {
    const syncDesktopToFilesystem = async () => {
      try {
        const desktopShortcutPaths = new Set(
          desktopFiles
            .filter((file) => file?.path?.endsWith('.lnk'))
            .map((file) => file.path)
        )

        // Get apps that should be on desktop (those with icon positions)
        const desktopApps = appRegistry.filter(app => iconPositions[app.id])
        
        for (const app of desktopApps) {
          const shortcutPath = `/home/user/Desktop/${app.title}.lnk`
          const shortcutContent = JSON.stringify({
            type: 'app-shortcut',
            appId: app.id,
            appTitle: app.title,
            position: iconPositions[app.id]
          })
          const previousPayload = syncedShortcutPayloadsRef.current.get(shortcutPath)

          if (desktopShortcutPaths.has(shortcutPath) && previousPayload === shortcutContent) {
            continue
          }

          try {
            const response = await fetch('http://localhost:8000/fs/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                path: shortcutPath,
                node_type: 'file',
                content: shortcutContent
              })
            })
            
            if (response.ok) {
              syncedShortcutPayloadsRef.current.set(shortcutPath, shortcutContent)
              continue
            }

            if (response.status === 409) {
              const writeResponse = await fetch('http://localhost:8000/fs/write', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  path: shortcutPath,
                  content: shortcutContent
                })
              })

              if (writeResponse.ok) {
                syncedShortcutPayloadsRef.current.set(shortcutPath, shortcutContent)
                continue
              }
            }

            if (!response.ok) {
              console.error('Failed to sync shortcut:', shortcutPath)
            }
          } catch (err) {
            console.error('Failed to sync shortcut:', shortcutPath, err)
          }
        }
      } catch (error) {
        console.error('Failed to sync desktop to filesystem:', error)
      }
    }
    
    if (appRegistry.length > 0 && desktopFiles.length >= 0) {
      syncDesktopToFilesystem()
    }
  }, [appRegistry, iconPositions, desktopFiles])

  useEffect(() => {
    try {
      localStorage.setItem('jez_os_pinned_apps', JSON.stringify(pinnedAppIds))
    } catch (error) {
      console.warn('Failed to save pinned apps:', error)
    }
  }, [pinnedAppIds])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event) => {
      console.log('Key pressed:', event.key, 'Zero pressed:', zeroKeyPressed.current, 'Active window:', activeWindowId)

      if (event.key === 'F5') {
        event.preventDefault()
        handleDesktopRefresh()
        return
      }
      
      // Track when '0' is pressed
      if (event.key === '0') {
        zeroKeyPressed.current = true
        console.log('Zero key activated')
        return
      }
      
      // 0 + Plus for app switching
      if (zeroKeyPressed.current && (event.key === '+' || event.key === '=')) {
        event.preventDefault()
        console.log('App switcher triggered')
        const visibleWindows = windows.filter(w => !w.minimized)
        
        if (visibleWindows.length === 0) return
        
        if (!showAppSwitcher) {
          setShowAppSwitcher(true)
          setAppSwitcherIndex(0)
        } else {
          setAppSwitcherIndex((prev) => (prev + 1) % visibleWindows.length)
        }
      }
      
      // 0 + Arrow keys for window snapping
      if (zeroKeyPressed.current && activeWindowId) {
        const screenWidth = window.innerWidth
        const screenHeight = window.innerHeight - 50
        
        let snapZone = null
        
        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          console.log('Snapping left')
          snapZone = { x: 0, y: 0, width: screenWidth / 2, height: screenHeight }
        } else if (event.key === 'ArrowRight') {
          event.preventDefault()
          console.log('Snapping right')
          snapZone = { x: screenWidth / 2, y: 0, width: screenWidth / 2, height: screenHeight }
        } else if (event.key === 'ArrowUp') {
          event.preventDefault()
          console.log('Maximizing')
          snapZone = { x: 0, y: 0, width: screenWidth, height: screenHeight }
        }
        
        if (snapZone) {
          snapWindow(activeWindowId, snapZone)
        }
      }
    }
    
    const handleKeyUp = (event) => {
      // Close app switcher when '0' is released
      if (event.key === '0') {
        zeroKeyPressed.current = false
        if (showAppSwitcher) {
          const visibleWindows = windows.filter(w => !w.minimized)
          if (visibleWindows.length > 0 && appSwitcherIndex < visibleWindows.length) {
            const selectedWindow = visibleWindows[appSwitcherIndex]
            focusWindow(selectedWindow.id)
            if (selectedWindow.minimized) {
              toggleMinimize(selectedWindow.id)
            }
          }
          setShowAppSwitcher(false)
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [windows, showAppSwitcher, appSwitcherIndex, activeWindowId])

  const toggleStartMenu = () => {
    setShowStartMenu(!showStartMenu)
  }

  const closeStartMenu = () => {
    setShowStartMenu(false)
    setTaskbarSearchQuery('')
  }

  const handleTaskbarSearchChange = (value) => {
    setTaskbarSearchQuery(value)
    if (value.trim()) {
      setShowStartMenu(true)
    }
  }

  const handleIconMove = (appId, gridPos) => {
    setIconPositions((prev) => {
      const updated = {
        ...prev,
        [appId]: gridPos
      }
      // Save to localStorage
      try {
        localStorage.setItem('jez_os_icon_positions', JSON.stringify(updated))
      } catch (error) {
        console.error('Failed to save icon positions:', error)
      }
      return updated
    })
  }

  const handleTogglePin = (appId) => {
    setPinnedAppIds((prev) =>
      prev.includes(appId) ? prev.filter((id) => id !== appId) : [...prev, appId]
    )
  }

  const handleLaunchPinned = (appId) => {
    const app = appRegistry.find((entry) => entry.id === appId)
    if (app) {
      launchApp(app)
    }
  }

  const restoreWindowFromSession = (pid) => {
    setActiveWindowId(pid)
    setWindows((prev) =>
      prev.map((win) =>
        win.id === pid
          ? {
              ...win,
              minimized: false,
              zIndex: zCounter
            }
          : win
      )
    )
    setZCounter((prev) => prev + 1)
  }

  const showToast = (title, message, type = 'info', duration = 5000) => {
    const id = Date.now()
    const notification = { title, message, type, duration }
    setToasts((prev) => [...prev, { id, ...notification }])
  }

  const closeToast = (id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }


  const openDesktopFile = async (file) => {
    console.log('Opening desktop file:', file)
    
    if (file.type === 'dir') {
      // Open Files app and navigate to folder
      const filesApp = appRegistry.find(app => app.id === 'files')
      if (filesApp) {
        // Store the path to open
        localStorage.setItem('files_open_path', file.path)
        const windowTitle = file.path === RECYCLE_BIN_PATH ? 'Recycle Bin' : filesApp.title
        launchApp(filesApp, { windowTitle })
      }
    } else if (file.path.endsWith('.txt')) {
      // Open text file in Notes
      localStorage.setItem('notes_open_file', file.path)
      const notesApp = appRegistry.find(app => app.id === 'notes')
      if (notesApp) {
        launchApp(notesApp)
      }
    } else if (file.path.endsWith('.lnk')) {
      // Launch app shortcut
      await launchShortcut(file.path)
    } else {
      // Open other files in Files app
      const filesApp = appRegistry.find(app => app.id === 'files')
      if (filesApp) {
        launchApp(filesApp)
      }
    }
  }

  const launchShortcut = async (shortcutPath) => {
    try {
      const response = await fetch('http://localhost:8000/fs/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: shortcutPath })
      })
      
      if (response.ok) {
        const data = await response.json()
        const shortcutData = JSON.parse(data.content)
        
        const targetApp = appRegistry.find(app => app.id === shortcutData.appId)
        if (targetApp) {
          launchApp(targetApp)
        }
      }
    } catch (err) {
      console.error('Failed to open shortcut:', err)
    }
  }

  const launchApp = async (app, options = {}) => {
    const shouldReuseSessionWindow = SESSION_PERSISTENT_APP_IDS.has(app.id)
    const existingWindow = shouldReuseSessionWindow
      ? windows.find((win) => win.appId === app.id)
      : null

    if (existingWindow) {
      restoreWindowFromSession(existingWindow.id)
      return
    }

    const memory = Math.floor(Math.random() * 20) + 8
    let pid = Date.now()
    
    // Check memory limit
    try {
      const checkResponse = await fetch('http://localhost:8000/system/resources')
      if (checkResponse.ok) {
        const resources = await checkResponse.json()
        if (resources.usedMemory + memory > resources.maxMemory) {
          alert(`Cannot launch ${app.title}: Insufficient memory (${resources.usedMemory + memory}/${resources.maxMemory} MB)`)
          return
        }
      }
    } catch (error) {
      // Continue if resource check fails
    }
    
    try {
      const response = await fetch('http://localhost:8000/process/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app: app.title, memory })
      })
      if (response.ok) {
        const data = await response.json()
        pid = data.pid
        pendingWindowPidsRef.current.set(Number(pid), Date.now())
        
        // Check if we need to kill background processes
        if (data.killed_processes && data.killed_processes.length > 0) {
          console.log('Auto-killed background processes:', data.killed_processes)
          const killedSet = new Set(data.killed_processes.map((killedPid) => Number(killedPid)))
          setWindows((prev) => prev.filter((win) => !killedSet.has(Number(win.id))))
        }
      } else {
        const errorData = await response.json()
        alert(errorData.detail || 'Failed to launch app')
        return
      }
    } catch (error) {
      alert('Failed to launch app')
      return
    }

    setWindows((prev) => {
      const defaultX = WINDOW_DEFAULTS.x + prev.length * 24
      const defaultY = WINDOW_DEFAULTS.y + prev.length * 24
      const screenWidth = window.innerWidth
      const screenHeight = window.innerHeight - 50
      const shouldStartMaximized =
        options.startMaximized ?? MAXIMIZED_BY_DEFAULT_APP_IDS.has(app.id)

      const defaultWidth =
        app.id === 'calculator'
          ? 384
          : app.id === 'clock'
            ? 1280
            : app.id === 'solitaire'
              ? 920
              : app.id === 'minesweeper'
                ? 980
            : WINDOW_DEFAULTS.width
      const defaultHeight =
        app.id === 'calculator'
          ? 620
          : app.id === 'clock'
            ? 760
            : app.id === 'solitaire'
              ? 640
              : app.id === 'minesweeper'
                ? 760
            : WINDOW_DEFAULTS.height

      const windowEntry = {
        id: pid,
        appId: app.id,
        component: app.component,
        title: options.windowTitle || app.title,
        appProps: options.appProps || {},
        icon: app.icon,
        iconSrc: app.iconSrc || app.desktopIconSrc || null,
        desktopIconSrc: app.desktopIconSrc || null,
        memory,
        minimized: false,
        isMaximized: shouldStartMaximized,
        zIndex: zCounter,
        x: shouldStartMaximized ? 0 : defaultX,
        y: shouldStartMaximized ? 0 : defaultY,
        width: shouldStartMaximized ? screenWidth : defaultWidth,
        height: shouldStartMaximized ? screenHeight : defaultHeight,
        prevX: defaultX,
        prevY: defaultY,
        prevWidth: defaultWidth,
        prevHeight: defaultHeight,
        hideHeader: app.id === 'webbrowser' || app.id === 'camera' || app.id === 'calculator' || app.id === 'clock',
        noMaximize: false,
        minWidth: app.id === 'calculator' ? 384 : app.id === 'clock' ? 860 : app.id === 'solitaire' ? 760 : app.id === 'minesweeper' ? 820 : undefined,
        minHeight: app.id === 'calculator' ? 620 : app.id === 'clock' ? 560 : app.id === 'solitaire' ? 520 : app.id === 'minesweeper' ? 620 : undefined
      }

      return [
      ...prev,
      windowEntry
    ]
    })
    setActiveWindowId(pid)
    setZCounter((prev) => prev + 1)
    window.dispatchEvent(new CustomEvent('window-opened', { detail: { pid, appId: app.id } }))

    // Track recent apps (keep last 5)
    setRecentApps((prev) => {
      const filtered = prev.filter((a) => a.id !== app.id)
      return [app, ...filtered].slice(0, 5)
    })
  }

  const closeWindow = async (pid) => {
    const numericPid = Number(pid)
    pendingWindowPidsRef.current.delete(numericPid)
    setWindows((prev) => prev.filter((win) => win.id !== pid))
    window.dispatchEvent(new CustomEvent('window-closed', { detail: { pid } }))
    try {
      const response = await fetch(`http://localhost:8000/process/kill?pid=${pid}`, { method: 'POST' })
      if (!response.ok && response.status !== 404) {
        // Silently fail for missing processes
      }
      window.dispatchEvent(new CustomEvent('process-terminated', { detail: { pid } }))
    } catch (error) {
      // Silently fail if process close fails
    }
  }

  const minimizeWindow = (pid) => {
    let nextActiveWindowId = null

    setWindows((prev) => {
      const updated = prev.map((win) => (
        win.id === pid
          ? { ...win, minimized: true }
          : win
      ))

      const nextWindow = updated
        .filter((win) => win.id !== pid && !win.minimized)
        .sort((a, b) => b.zIndex - a.zIndex)[0]
      nextActiveWindowId = nextWindow?.id ?? null

      return updated
    })

    setActiveWindowId(nextActiveWindowId)
  }

  const restoreWindow = (pid) => {
    setWindows((prev) =>
      prev.map((win) => (
        win.id === pid
          ? { ...win, minimized: false, zIndex: zCounter }
          : win
      ))
    )
    setActiveWindowId(pid)
    setZCounter((prev) => prev + 1)
  }

  const toggleMinimize = (pid) => {
    const targetWindow = windows.find((win) => win.id === pid)
    if (!targetWindow) return

    if (targetWindow.minimized) {
      restoreWindow(pid)
      return
    }

    minimizeWindow(pid)
  }

  const focusWindow = (pid) => {
    setActiveWindowId(pid)
    setWindows((prev) =>
      prev.map((win) => (win.id === pid ? { ...win, zIndex: zCounter } : win))
    )
    setZCounter((prev) => prev + 1)
  }

  const moveWindow = (pid, x, y) => {
    setWindows((prev) =>
      prev.map((win) => (win.id === pid ? { ...win, x, y } : win))
    )
  }

  const snapWindow = (pid, snapZone) => {
    const screenWidth = window.innerWidth
    const screenHeight = window.innerHeight - 50 // Account for taskbar
    
    const parseValue = (value, max) => {
      if (typeof value === 'string' && value.includes('%')) {
        return (parseFloat(value) / 100) * max
      }
      return parseFloat(value) || 0
    }
    
    setWindows((prev) =>
      prev.map((win) => {
        if (win.id === pid) {
          return {
            ...win,
            x: parseValue(snapZone.x, screenWidth),
            y: parseValue(snapZone.y, screenHeight),
            width: parseValue(snapZone.width, screenWidth),
            height: parseValue(snapZone.height, screenHeight),
            isMaximized: false
          }
        }
        return win
      })
    )
  }

  const maximizeWindow = (pid) => {
    setWindows((prev) =>
      prev.map((win) => {
        if (win.id === pid) {
          if (win.isMaximized) {
            // Restore to previous size
            return {
              ...win,
              x: win.prevX || WINDOW_DEFAULTS.x,
              y: win.prevY || WINDOW_DEFAULTS.y,
              width: win.prevWidth || WINDOW_DEFAULTS.width,
              height: win.prevHeight || WINDOW_DEFAULTS.height,
              isMaximized: false
            }
          } else {
            // Maximize
            const screenWidth = window.innerWidth
            const screenHeight = window.innerHeight - 50
            return {
              ...win,
              prevX: win.x,
              prevY: win.y,
              prevWidth: win.width,
              prevHeight: win.height,
              x: 0,
              y: 0,
              width: screenWidth,
              height: screenHeight,
              isMaximized: true
            }
          }
        }
        return win
      })
    )
  }

  const resizeWindow = (pid, newX, newY, newWidth, newHeight) => {
    setWindows((prev) =>
      prev.map((win) => {
        if (win.id === pid) {
          return {
            ...win,
            x: newX,
            y: newY,
            width: newWidth,
            height: newHeight,
            isMaximized: false
          }
        }
        return win
      })
    )
  }

  const updateWindowTitle = (pid, title) => {
    if (!title) return
    setWindows((prev) =>
      prev.map((win) => (win.id === pid ? { ...win, title } : win))
    )
  }

  const launchAppById = (appId, options = {}) => {
    const app = appRegistry.find((entry) => entry.id === appId)
    if (app) {
      launchApp(app, options)
    }
  }

  const createDesktopItem = async (nodeType) => {
    const isFolder = nodeType === 'dir'
    const defaultName = isFolder ? 'New Folder' : 'New Text Document.txt'
    const itemName = window.prompt(isFolder ? 'New folder name:' : 'New file name:', defaultName)
    if (!itemName) return

    const itemPath = `/home/user/Desktop/${itemName}`

    try {
      const response = await fetch('http://localhost:8000/fs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: itemPath,
          node_type: nodeType,
          content: ''
        })
      })

      if (!response.ok && response.status !== 409) {
        throw new Error(`Failed to create ${isFolder ? 'folder' : 'file'}`)
      }

      const now = new Date().toISOString()
      setDesktopFiles((previous) => {
        if (previous.some((entry) => entry.path === itemPath)) {
          return previous
        }
        return [
          ...previous,
          {
            path: itemPath,
            type: nodeType,
            size: 0,
            created_at: now,
            modified_at: now
          }
        ]
      })
    } catch (error) {
      console.error('Failed to create desktop item:', error)
      alert(`Failed to create ${isFolder ? 'folder' : 'file'}`)
    }
  }

  const handleDesktopRefresh = async () => {
    pulseDesktopRefreshAnimation()

    const refreshTasks = []

    refreshTasks.push((async () => {
      const response = await fetch('http://localhost:8000/fs/list?path=%2Fhome%2Fuser%2FDesktop')
      if (!response.ok) {
        throw new Error('Failed to refresh desktop files')
      }

      const data = await response.json()
      const nodes = Array.isArray(data.nodes) ? data.nodes : []
      const hasRecycleBin = nodes.some((node) => node.path === RECYCLE_BIN_PATH)
      setDesktopFiles(hasRecycleBin ? nodes : [RECYCLE_BIN_DESKTOP_ITEM, ...nodes])
    })())

    try {
      await Promise.all(refreshTasks)
    } catch (error) {
      console.error('Desktop refresh failed:', error)
    }
  }

  const closeAllMenus = () => {
    // Submenus are now handled internally by ContextMenu component
    // No need to close them separately
  }

  const viewMenuItems = useMemo(() => [
    {
      label: 'Large icons',
      icon: LayoutGrid,
      checked: desktopViewSettings.iconSize === 'large',
      shortcut: 'Ctrl+Shift+2',
      onClick: () => updateDesktopViewSettings({ iconSize: 'large' })
    },
    {
      label: 'Medium icons',
      icon: LayoutGrid,
      checked: desktopViewSettings.iconSize === 'medium',
      shortcut: 'Ctrl+Shift+3',
      onClick: () => updateDesktopViewSettings({ iconSize: 'medium' })
    },
    {
      label: 'Small icons',
      icon: LayoutGrid,
      checked: desktopViewSettings.iconSize === 'small',
      shortcut: 'Ctrl+Shift+4',
      onClick: () => updateDesktopViewSettings({ iconSize: 'small' })
    },
    { separator: true },
    {
      label: 'Auto arrange icons',
      icon: RefreshCw,
      checked: desktopViewSettings.autoArrangeIcons,
      onClick: () => {
        const nextValue = !desktopViewSettings.autoArrangeIcons
        updateDesktopViewSettings({ autoArrangeIcons: nextValue })
        if (nextValue) {
          arrangeDesktopIcons()
        }
      }
    },
    {
      label: 'Align icons to grid',
      icon: Monitor,
      checked: desktopViewSettings.alignIconsToGrid,
      onClick: () => updateDesktopViewSettings({ alignIconsToGrid: !desktopViewSettings.alignIconsToGrid })
    },
    { separator: true },
    {
      label: 'Show desktop icons',
      icon: desktopViewSettings.showDesktopIcons ? Monitor : LayoutGrid,
      checked: desktopViewSettings.showDesktopIcons,
      onClick: () => updateDesktopViewSettings({ showDesktopIcons: !desktopViewSettings.showDesktopIcons })
    }
  ], [desktopViewSettings])

  const sortMenuItems = useMemo(() => [
    {
      label: 'Name',
      checked: desktopSortMode === DESKTOP_SORT_MODES.name,
      onClick: () => applyDesktopSort(DESKTOP_SORT_MODES.name)
    },
    {
      label: 'Size',
      checked: desktopSortMode === DESKTOP_SORT_MODES.size,
      onClick: () => applyDesktopSort(DESKTOP_SORT_MODES.size)
    },
    {
      label: 'Item type',
      checked: desktopSortMode === DESKTOP_SORT_MODES.type,
      onClick: () => applyDesktopSort(DESKTOP_SORT_MODES.type)
    },
    {
      label: 'Date modified',
      checked: desktopSortMode === DESKTOP_SORT_MODES.modified,
      onClick: () => applyDesktopSort(DESKTOP_SORT_MODES.modified)
    }
  ], [desktopSortMode, applyDesktopSort])

  const newMenuItems = useMemo(() => [
    {
      label: 'Folder',
      icon: Folder,
      onClick: () => createDesktopItem('dir')
    },
    {
      label: 'Text Document',
      icon: FileText,
      onClick: () => createDesktopItem('file')
    }
  ], [createDesktopItem])

  const desktopScreenStyle = useMemo(() => getDesktopScreenStyle(armouryDisplaySettings), [armouryDisplaySettings])

  const handleContextMenu = (event) => {
    event.preventDefault()
    closeAllMenus()
    const items = [
      {
        label: 'View',
        icon: LayoutGrid,
        hasSubmenu: true,
        submenu: viewMenuItems
      },
      {
        label: 'Sort by',
        icon: ArrowUpDown,
        hasSubmenu: true,
        submenu: sortMenuItems
      },
      {
        label: 'Refresh',
        icon: RefreshCw,
        onClick: handleDesktopRefresh
      },
      { separator: true },
      {
        label: 'New',
        icon: PlusCircle,
        hasSubmenu: true,
        submenu: newMenuItems
      },
      { separator: true },
      {
        label: 'Display settings',
        icon: Monitor,
        onClick: () => launchAppById('settings', { windowTitle: 'Display settings', appProps: { initialSection: 'system' } })
      },
      {
        label: 'Personalize',
        icon: Palette,
        onClick: () => launchAppById('settings', { windowTitle: 'Personalize', appProps: { initialSection: 'personalization' } })
      },
      { separator: true },
      {
        label: 'Open in Terminal',
        icon: Terminal,
        onClick: () => launchAppById('terminal', { startMaximized: false })
      }
    ]
    setContextMenuItems(items)
    setContextMenu({ visible: true, x: event.clientX, y: event.clientY })
  }

  const handleAppContextMenu = (event, app) => {
    event.preventDefault()
    event.stopPropagation()

    const isAlreadyPinned = pinnedAppIds.includes(app.id)
    setContextMenuItems([
      {
        label: `Open ${app.title}`,
        onClick: () => launchApp(app)
      },
      {
        label: isAlreadyPinned ? 'Unpin from taskbar' : 'Pin to taskbar',
        onClick: () => handleTogglePin(app.id)
      }
    ])
    setContextMenu({ visible: true, x: event.clientX, y: event.clientY })
  }

  const closeContextMenu = () => {
    setContextMenu((prev) => ({ ...prev, visible: false }))
    closeAllMenus()
  }

  const closeAllPanels = () => {
    closeStartMenu()  // This also clears the search
    setShowNotificationCenter(false)
    setShowActionCenter(false)
    setShowCalendar(false)
  }

  const handleDesktopClick = (event) => {
    // Close context menu when clicking desktop
    closeContextMenu()
    
    // Check if clicking on any panel content
    const isClickingPanel = 
      event.target.closest('.start-menu') ||
      event.target.closest('.notification-center-panel') ||
      event.target.closest('.action-center') ||
      event.target.closest('.calendar-widget')
    
    // Only close panels if clicking on the wallpaper/desktop content (not panels)
    if ((event.target.classList.contains('desktop-wallpaper') || 
         event.target.classList.contains('desktop-content')) &&
        !isClickingPanel) {
      closeAllPanels()
    }
  }

  return (
    <div className="desktop" onContextMenu={handleContextMenu} onClick={handleDesktopClick}>
      <div className="desktop-screen" style={desktopScreenStyle}>
        <div className="desktop-wallpaper" />
        <div className="desktop-display-overlay" aria-hidden="true" />
        <div className="desktop-content">
          <AppLauncher 
            apps={appRegistry} 
            desktopFiles={desktopFiles}
            onLaunch={launchApp}
            iconPositions={iconPositions}
            onIconMove={handleIconMove}
            onAppContextMenu={handleAppContextMenu}
            touchpadEnabled={armouryDeviceSettings['touch-pad'] !== false}
            iconSize={desktopViewSettings.iconSize}
            showDesktopIcons={desktopViewSettings.showDesktopIcons}
            autoArrangeIcons={desktopViewSettings.autoArrangeIcons}
            alignIconsToGrid={desktopViewSettings.alignIconsToGrid}
            isRefreshing={isRefreshingDesktop}
          />
        </div>

        {windows.map((win) => {
          const matchedApp = appRegistry.find((app) => (
            app.id === win.appId ||
            app.title === win.title ||
            (win.title === 'Recycle Bin' && app.id === 'files')
          ))
          const AppComponent =
            APP_COMPONENTS[win.appId] ||
            win.component ||
            matchedApp?.component ||
            (win.title === 'Recycle Bin' ? FileExplorer : null)
          return (
            <Window
              key={win.id}
              windowData={{ ...win, hideTitle: win.appId === 'diagnostics' ? false : win.hideTitle, isActive: win.id === activeWindowId }}
              onClose={closeWindow}
              onMinimize={minimizeWindow}
              onMaximize={maximizeWindow}
              onFocus={focusWindow}
              onMove={moveWindow}
              onResize={resizeWindow}
              onSnap={snapWindow}
              keepMountedWhenMinimized={SESSION_PERSISTENT_APP_IDS.has(win.appId)}
              touchpadEnabled={armouryDeviceSettings['touch-pad'] !== false}
            >
              {AppComponent ? <AppComponent
                {...(win.appProps || {})}
                onWindowTitleChange={(title) => updateWindowTitle(win.id, title)}
                windowControls={{
                  isMaximized: win.isMaximized,
                  canMaximize: !win.noMaximize,
                  onMinimize: () => minimizeWindow(win.id),
                  onMaximize: () => maximizeWindow(win.id),
                  onClose: () => closeWindow(win.id)
                }}
              /> : (
                <div className="window-placeholder">
                  <div className="window-placeholder-title">{win.title}</div>
                  <div className="window-placeholder-body">
                    App content for {win.title} will go here.
                  </div>
                </div>
              )}
            </Window>
          )
        })}

        <ContextMenu
          visible={contextMenu.visible}
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={closeContextMenu}
        />

        <StartMenu
          visible={showStartMenu}
          onClose={closeStartMenu}
          apps={appRegistry}
          onLaunch={launchApp}
          onLock={onLock}
          onLogout={onLogout}
          onRestart={onRestart}
          onShutdown={onShutdown}
          onSleep={onSleep}
          updateStatus={updateStatus}
          recentApps={recentApps}
          searchQuery={taskbarSearchQuery}
          onSearchQueryChange={handleTaskbarSearchChange}
        />

        <div className="toast-container">
          {toasts.map((toast) => (
            <Toast
              key={toast.id}
              id={toast.id}
              notification={toast}
              onClose={closeToast}
            />
          ))}
        </div>

        {showNotificationCenter && (
          <NotificationCenter onClose={() => setShowNotificationCenter(false)} />
        )}

        {showCalendar && (
          <Calendar onClose={() => setShowCalendar(false)} />
        )}

        {showActionCenter && (
          <ActionCenter onClose={() => setShowActionCenter(false)} />
        )}

        {showAppSwitcher && (
          <AppSwitcher
            windows={windows.filter(w => !w.minimized)}
            selectedIndex={appSwitcherIndex}
            onSelect={(index) => {
              const visibleWindows = windows.filter(w => !w.minimized)
              if (index < visibleWindows.length) {
                setAppSwitcherIndex(index)
              }
            }}
            onClose={() => setShowAppSwitcher(false)}
          />
        )}

        <Taskbar 
          windows={windows} 
          activeWindowId={activeWindowId}
          onToggleMinimize={toggleMinimize}
          onFocusWindow={focusWindow}
          user={user}
          onLogout={onLogout}
          onLock={onLock}
          onSleep={onSleep}
          onStartClick={toggleStartMenu}
          onNotificationClick={() => setShowNotificationCenter(!showNotificationCenter)}
          onActionCenterClick={() => setShowActionCenter(!showActionCenter)}
          onCalendarClick={() => setShowCalendar(!showCalendar)}
          pinnedApps={appRegistry.filter((app) => pinnedAppIds.includes(app.id))}
          onTogglePin={handleTogglePin}
          onLaunchPinned={handleLaunchPinned}
          isPinned={(appId) => pinnedAppIds.includes(appId)}
          searchQuery={taskbarSearchQuery}
          onSearchChange={handleTaskbarSearchChange}
          isSleeping={isSleeping}
        />
      </div>
    </div>
  )
}

function loadArmouryDeviceSettings() {
  try {
    const savedSettings = localStorage.getItem(ARMOURY_DEVICE_SETTINGS_STORAGE_KEY)
    if (!savedSettings) return { 'touch-pad': true, 'win-key': true }

    const parsed = JSON.parse(savedSettings)
    return {
      'touch-pad': true,
      'win-key': true,
      ...parsed
    }
  } catch (error) {
    console.warn('Failed to load Armoury Crate device settings in Desktop:', error)
    return { 'touch-pad': true, 'win-key': true }
  }
}

function loadArmouryDisplaySettings() {
  try {
    const savedSettings = localStorage.getItem(ARMOURY_DISPLAY_SETTINGS_STORAGE_KEY)
    if (!savedSettings) return DEFAULT_ARMOURY_DISPLAY_SETTINGS

    return normalizeArmouryDisplaySettings(JSON.parse(savedSettings))
  } catch (error) {
    console.warn('Failed to load Armoury Crate display settings in Desktop:', error)
    return DEFAULT_ARMOURY_DISPLAY_SETTINGS
  }
}

function normalizeArmouryDisplaySettings(value) {
  const selectedPreset = normalizeArmouryDisplayPreset(value?.selectedPreset)

  const colorTemperature = Number(value?.colorTemperature)

  return {
    ...DEFAULT_ARMOURY_DISPLAY_SETTINGS,
    ...value,
    selectedPreset,
    colorTemperature: Number.isFinite(colorTemperature) ? Math.min(100, Math.max(0, colorTemperature)) : DEFAULT_ARMOURY_DISPLAY_SETTINGS.colorTemperature,
    gameVisualEnabled: value?.gameVisualEnabled ?? DEFAULT_ARMOURY_DISPLAY_SETTINGS.gameVisualEnabled
  }
}

function normalizeArmouryDisplayPreset(value) {
  const normalizedValue = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
  const presetMap = {
    default: 'default',
    racing: 'racing',
    scenery: 'scenery',
    'rts-rpg': 'rts-rpg',
    'rts/rpg': 'rts-rpg',
    fps: 'fps',
    cinema: 'cinema',
    eyecare: 'eyecare',
    'eye-care': 'eyecare',
    vivid: 'vivid',
    'e-reading': 'e-reading',
    ereading: 'e-reading'
  }

  return presetMap[normalizedValue] || DEFAULT_ARMOURY_DISPLAY_SETTINGS.selectedPreset
}

function getDesktopScreenStyle(displaySettings) {
  const presetId = displaySettings.gameVisualEnabled ? displaySettings.selectedPreset : 'default'
  const presetFilterMap = {
    default: 'none',
    racing: 'brightness(1.05) contrast(1.08) saturate(0.94)',
    scenery: 'brightness(1.08) contrast(1.04) saturate(1.2)',
    'rts-rpg': 'brightness(1.03) contrast(1.12) saturate(0.98)',
    fps: 'brightness(1.1) contrast(1.18) saturate(0.9)',
    cinema: 'brightness(0.99) contrast(1.16) saturate(1.18)',
    eyecare: 'brightness(1.02) contrast(0.97) saturate(0.88) sepia(0.12)',
    vivid: 'brightness(1.1) contrast(1.08) saturate(1.34)',
    'e-reading': 'brightness(1.03) contrast(0.94) saturate(0.78) sepia(0.22)'
  }
  const safeColorTemperature = Number.isFinite(Number(displaySettings.colorTemperature))
    ? Math.min(100, Math.max(0, Number(displaySettings.colorTemperature)))
    : DEFAULT_ARMOURY_DISPLAY_SETTINGS.colorTemperature
  const temperatureDelta = (safeColorTemperature - 50) / 50
  const tintColor = getDisplayTemperatureTint(displaySettings.colorTemperature)
  const tintStrength = Math.abs(temperatureDelta) * 0.34
  const wallpaperTemperatureFilter =
    temperatureDelta < 0
      ? `sepia(${(Math.abs(temperatureDelta) * 0.32).toFixed(3)}) saturate(${(1 + Math.abs(temperatureDelta) * 0.18).toFixed(3)})`
      : `brightness(${(1 + Math.abs(temperatureDelta) * 0.04).toFixed(3)}) saturate(${(1 - Math.abs(temperatureDelta) * 0.1).toFixed(3)}) hue-rotate(${(temperatureDelta * 8).toFixed(2)}deg)`

  return {
    '--desktop-screen-filter': presetFilterMap[presetId] || presetFilterMap.default,
    '--desktop-screen-tint': tintColor,
    '--desktop-screen-tint-opacity': tintStrength.toFixed(3),
    '--desktop-wallpaper-temperature-filter': wallpaperTemperatureFilter
  }
}

function getDisplayTemperatureTint(value) {
  if (value <= 40) return '#ff9f4a'
  if (value >= 60) return '#8fdcf9'
  return '#efe9de'
}
