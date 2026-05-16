import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowUp,
  ChevronRight,
  ClipboardCopy,
  ClipboardPaste,
  FilePlus,
  FileText,
  Folder,
  FolderPlus,
  Info,
  Pencil,
  Scissors,
  Trash2,
  Search,
  Home,
  Download,
  FileImage,
  Music,
  Video,
  HardDrive,
  Network,
  X,
  Terminal,
  Settings,
  Activity,
  Package,
  AlertCircle,
  Stethoscope,
  Printer,
  RotateCcw,
  Star,
  ChevronDown,
  FileCode,
  FileAudio,
  FileVideo,
  Archive,
} from 'lucide-react'

import PrintPreviewDialog from '../components/PrintPreviewDialog'
import { enqueuePrintJob } from '../utils/printJobs'

const APP_SHORTCUT_ICONS = {
  terminal: Terminal,
  files: Folder,
  localfiles: HardDrive,
  notes: FileText,
  settings: Settings,
  monitor: Activity,
  appstore: Package,
  eventviewer: AlertCircle,
  diagnostics: Stethoscope,
}

const RECYCLE_BIN_PATH = '/home/user/.recycle_bin'

const getFileIcon = (name = '', isDir = false) => {
  if (isDir) return { Icon: Folder, color: '#e8a020' }
  const ext = name.toLowerCase().split('.').pop()
  if (['jpg','jpeg','png','gif','webp','bmp','svg'].includes(ext)) return { Icon: FileImage, color: '#0ea5e9' }
  if (['mp4','webm','mov','avi','mkv'].includes(ext))               return { Icon: FileVideo,  color: '#8b5cf6' }
  if (['mp3','wav','ogg','flac','aac'].includes(ext))               return { Icon: FileAudio,  color: '#10b981' }
  if (['js','ts','jsx','tsx','py','go','rs','json','css','html','xml'].includes(ext)) return { Icon: FileCode, color: '#f59e0b' }
  if (['zip','tar','gz','rar','7z'].includes(ext))                  return { Icon: Archive,    color: '#64748b' }
  if (['txt','md'].includes(ext))                                   return { Icon: FileText,   color: '#0067c0' }
  if (['lnk'].includes(ext))                                        return { Icon: FileText,   color: '#0067c0' }
  return { Icon: FileText, color: '#64748b' }
}

export default function FileExplorer({ onWindowTitleChange }) {
  const [currentPath, setCurrentPath] = useState('/home/user')
  const [entries, setEntries] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [error, setError] = useState('')
  const [apiBase, setApiBase] = useState('http://127.0.0.1:8000')
  const [clipboard, setClipboard] = useState(null)
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, targetPath: null })
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [renameTarget, setRenameTarget] = useState(null)
  const [renameName, setRenameName] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [showPropertiesDialog, setShowPropertiesDialog] = useState(false)
  const [propertiesData, setPropertiesData] = useState(null)
  const [addressBarEdit, setAddressBarEdit] = useState(false)
  const [addressBarValue, setAddressBarValue] = useState(currentPath)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [fileContent, setFileContent] = useState(null)
  const [isLoadingFile, setIsLoadingFile] = useState(false)
  const [thumbnails, setThumbnails] = useState({})
  const [showPrintPreview, setShowPrintPreview] = useState(false)
  const [printPreviewData, setPrintPreviewData] = useState(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const quickAccessItems = [
    { name: 'Home',        path: '/home/user',             icon: Home,      group: 'quick' },
    { name: 'Desktop',     path: '/home/user/Desktop',     icon: Home,      group: 'quick' },
    { name: 'Downloads',   path: '/home/user/Downloads',   icon: Download,  group: 'quick' },
    { name: 'Documents',   path: '/home/user/Documents',   icon: FileText,  group: 'quick' },
    { name: 'Pictures',    path: '/home/user/Pictures',    icon: FileImage, group: 'quick' },
    { name: 'Music',       path: '/home/user/Music',       icon: Music,     group: 'quick' },
    { name: 'Videos',      path: '/home/user/Videos',      icon: Video,     group: 'quick' },
    { name: 'Recycle Bin', path: RECYCLE_BIN_PATH,         icon: Trash2,    group: 'this-pc' },
    { name: 'This PC',     path: '/',                      icon: HardDrive, group: 'this-pc' },
    { name: 'Network',     path: '/network',               icon: Network,   group: 'this-pc' },
  ]

  useEffect(() => { loadDirectory(currentPath); setSearchQuery(''); setIsSearching(false) }, [currentPath])
  useEffect(() => { setAddressBarValue(currentPath) }, [currentPath])
  useEffect(() => {
    const pathToOpen = localStorage.getItem('files_open_path')
    if (pathToOpen) { setCurrentPath(pathToOpen); localStorage.removeItem('files_open_path') }
  }, [])
  useEffect(() => { onWindowTitleChange?.(getWindowTitleFromPath(currentPath)) }, [currentPath, onWindowTitleChange])
  useEffect(() => {
    if (searchQuery.trim()) performSearch()
    else { setIsSearching(false); setSearchResults([]) }
  }, [searchQuery])
  useEffect(() => {
    const entriesToPreview = (isSearching ? searchResults : entries).filter(e => e.type !== 'dir').slice(0, 24)
    entriesToPreview.forEach(entry => {
      const name = entry.path.split('/').pop()
      if (!isImageFile(name) && !isVideoFile(name)) return
      if (thumbnails[entry.path]) return
      loadThumbnail(entry.path, name)
    })
  }, [entries, searchResults, isSearching])
  useEffect(() => {
    return () => {
      Object.values(thumbnails).forEach(thumb => { if (thumb?.url?.startsWith('blob:')) URL.revokeObjectURL(thumb.url) })
      if (fileContent?.mediaUrl?.startsWith('blob:')) URL.revokeObjectURL(fileContent.mediaUrl)
    }
  }, [])

  const fetchApi = async (path, options = {}) => {
    const bases = [apiBase, 'http://127.0.0.1:8000', 'http://localhost:8000']
    const tried = new Set()
    for (const base of bases) {
      if (tried.has(base)) continue
      tried.add(base)
      try {
        const response = await fetch(`${base}${path}`, options)
        if (base !== apiBase) setApiBase(base)
        return response
      } catch { continue }
    }
    throw new Error('network')
  }

  const loadDirectory = async (path) => {
    setError(''); setSearchQuery(''); setIsSearching(false); setFileContent(null)
    try {
      const endpoint = path === RECYCLE_BIN_PATH ? '/fs/recycle/list' : `/fs/list?path=${encodeURIComponent(path)}`
      const response = await fetchApi(endpoint)
      if (response.ok) { const data = await response.json(); setEntries(data.nodes || []) }
      else setError('Failed to load directory')
    } catch { setError('System service unavailable') }
  }

  const performSearch = async () => {
    if (!searchQuery.trim()) return
    setIsSearching(true); setError('')
    const filtered = entries.filter(entry => entry.path.toLowerCase().includes(searchQuery.toLowerCase()))
    setSearchResults(filtered)
  }

  const clearSearch = () => { setSearchQuery(''); setIsSearching(false); setSearchResults([]) }

  const handleNavigate = (path) => { setCurrentPath(path); setSelectedFile(null); setFileContent(null) }
  const handleGoUp = () => {
    if (currentPath === '/') return
    const parts = currentPath.split('/').filter(Boolean); parts.pop()
    setCurrentPath('/' + parts.join('/'))
  }

  const handleFileClick = async (entry) => {
    if (entry.type === 'dir') { handleNavigate(entry.path); return }
    setSelectedFile(entry)
    if (isAppShortcut(entry)) await launchAppFromShortcut(entry.path)
    else if (entry.path.endsWith('.txt')) await openInNotesApp(entry.path)
    else await loadFileContent(entry.path)
  }

  const launchAppFromShortcut = async (shortcutPath) => {
    try { window.dispatchEvent(new CustomEvent('launchAppShortcut', { detail: { path: shortcutPath } })) }
    catch { setError('Failed to launch app from shortcut') }
  }

  const openInNotesApp = async (filePath) => {
    try {
      localStorage.setItem('notes_open_file', filePath)
      window.dispatchEvent(new CustomEvent('openFileInApp', { detail: { appId: 'notes', filePath } }))
    } catch { await loadFileContent(filePath) }
  }

  const loadFileContent = async (filePath) => {
    setIsLoadingFile(true); setError('')
    try {
      const response = await fetchApi('/fs/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: filePath }) })
      if (response.ok) {
        const data = await response.json()
        if (fileContent?.mediaUrl?.startsWith('blob:')) URL.revokeObjectURL(fileContent.mediaUrl)
        const name = filePath.split('/').pop()
        const mediaUrl = isImageFile(name) || isVideoFile(name) ? createMediaUrl(name, data.content) : null
        setFileContent({ path: filePath, content: data.content, name, mediaUrl })
      } else {
        setError(response.status === 404 ? 'File not found' : 'Failed to read file')
        setFileContent(null)
      }
    } catch { setError('Failed to read file'); setFileContent(null) }
    finally { setIsLoadingFile(false) }
  }

  const closeFileViewer = () => {
    if (fileContent?.mediaUrl?.startsWith('blob:')) URL.revokeObjectURL(fileContent.mediaUrl)
    setFileContent(null); setSelectedFile(null)
  }

  const getExtension = (name = '') => name.toLowerCase().split('.').pop()
  const isImageFile = (name = '') => ['jpg','jpeg','png','gif','webp'].includes(getExtension(name))
  const isVideoFile = (name = '') => ['mp4','webm','mov'].includes(getExtension(name))

  const getMimeType = (name = '') => {
    const ext = getExtension(name)
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
    if (ext === 'png') return 'image/png'
    if (ext === 'gif') return 'image/gif'
    if (ext === 'webp') return 'image/webp'
    if (ext === 'mp4') return 'video/mp4'
    if (ext === 'webm') return 'video/webm'
    if (ext === 'mov') return 'video/quicktime'
    return 'text/plain'
  }

  const createMediaUrl = (name, base64) => {
    if (!base64) return ''
    try {
      const mimeType = getMimeType(name).split(';')[0]
      let cleanBase64 = base64
      if (base64.startsWith('data:')) cleanBase64 = base64.split(',')[1] || ''
      if (!cleanBase64 || cleanBase64.length < 10) return ''
      const byteCharacters = atob(cleanBase64)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i)
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType })
      return URL.createObjectURL(blob)
    } catch { return '' }
  }

  const loadThumbnail = async (path, name) => {
    try {
      const response = await fetchApi('/fs/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }) })
      if (!response.ok) return
      const data = await response.json()
      const url = createMediaUrl(name, data.content)
      if (url) setThumbnails(prev => ({ ...prev, [path]: { url, type: isVideoFile(name) ? 'video' : 'image' } }))
    } catch { /* silent */ }
  }

  const getBreadcrumbs = () => {
    const parts = currentPath.split('/').filter(Boolean)
    const crumbs = [{ name: 'This PC', path: '/' }]
    let build = ''
    parts.forEach(p => { build += '/' + p; crumbs.push({ name: p, path: build }) })
    return crumbs
  }

  const getWindowTitleFromPath = (path) => {
    if (path === RECYCLE_BIN_PATH) return 'Recycle Bin'
    if (path === '/') return 'This PC'
    if (path === '/home/user') return 'Home'
    const parts = path.split('/').filter(Boolean)
    return parts.length === 0 ? 'File Explorer' : parts[parts.length - 1]
  }

  const handleContextMenu = (event, entry) => {
    event.preventDefault(); event.stopPropagation()
    let x = event.clientX, y = event.clientY
    if (x + 220 > window.innerWidth) x = window.innerWidth - 220
    if (y + 280 > window.innerHeight) y = window.innerHeight - 280
    setContextMenu({ visible: true, x, y, targetPath: entry.path, targetType: entry.type })
  }

  const handleCopy = (e) => {
    e.stopPropagation()
    if (contextMenu.targetPath) { setClipboard({ action: 'copy', path: contextMenu.targetPath }); setContextMenu({ visible: false, x: 0, y: 0, targetPath: null }) }
  }
  const handleCut = (e) => {
    e.stopPropagation()
    if (contextMenu.targetPath) { setClipboard({ action: 'cut', path: contextMenu.targetPath }); setContextMenu({ visible: false, x: 0, y: 0, targetPath: null }) }
  }

  const handlePaste = async (e) => {
    if (e) e.stopPropagation()
    if (!clipboard) return
    const fileName = clipboard.path.split('/').pop()
    const targetPath = currentPath + '/' + fileName
    try {
      const readRes = await fetchApi('/fs/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: clipboard.path }) })
      if (readRes.ok) {
        const { content } = await readRes.json()
        const createRes = await fetchApi('/fs/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: targetPath, node_type: 'file', content }) })
        if (createRes.status === 409) await fetchApi('/fs/write', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: targetPath, content }) })
        if (clipboard.action === 'cut') await fetchApi('/fs/delete?path=' + encodeURIComponent(clipboard.path), { method: 'DELETE' })
        loadDirectory(currentPath); setClipboard(null)
      }
    } catch { setError('Paste failed') }
    setContextMenu({ visible: false, x: 0, y: 0, targetPath: null })
  }

  const handleRename = (e) => {
    e.stopPropagation()
    if (contextMenu.targetPath) {
      setRenameTarget(contextMenu.targetPath)
      setRenameName(contextMenu.targetPath.split('/').pop())
      setShowRenameDialog(true)
    }
    setContextMenu({ visible: false, x: 0, y: 0, targetPath: null })
  }

  const confirmRename = async () => {
    if (!renameName.trim()) return
    const parts = renameTarget.split('/'); parts[parts.length - 1] = renameName
    try {
      const response = await fetchApi('/fs/rename', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ old_path: renameTarget, new_path: parts.join('/') }) })
      if (response.ok) loadDirectory(currentPath)
      else setError('Rename failed')
    } catch { setError('Rename failed') }
    setShowRenameDialog(false); setRenameTarget(null)
  }

  const handleDelete = (e) => {
    e.stopPropagation()
    if (contextMenu.targetPath) { setDeleteTarget(contextMenu.targetPath); setShowDeleteConfirm(true) }
    setContextMenu({ visible: false, x: 0, y: 0, targetPath: null })
  }

  const confirmDelete = async () => {
    try {
      const permanent = currentPath === RECYCLE_BIN_PATH
      const response = await fetchApi(`/fs/delete?path=${encodeURIComponent(deleteTarget)}${permanent ? '&permanent=true' : ''}`, { method: 'DELETE' })
      if (response.ok) loadDirectory(currentPath)
      else setError('Delete failed')
    } catch { setError('Delete failed') }
    setShowDeleteConfirm(false); setDeleteTarget(null)
  }

  const handlePrint = async (e) => {
    e.stopPropagation()
    if (contextMenu.targetPath) {
      const targetPath = contextMenu.targetPath
      const fileName = targetPath.split('/').pop()
      let content = `Preview unavailable for ${fileName}`
      try {
        const response = await fetchApi('/fs/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: targetPath }) })
        if (response.ok) { const data = await response.json(); if (typeof data.content === 'string' && data.content.length > 0) content = data.content }
      } catch { /* keep fallback */ }
      const pages = Math.max(1, Math.ceil(content.length / 800))
      setPrintPreviewData({ fileName, content, pages })
      setShowPrintPreview(true)
    }
    setContextMenu({ visible: false, x: 0, y: 0, targetPath: null })
  }

  const handleSubmitPrint = (printSettings) => {
    if (!printPreviewData) return
    const jobName = printPreviewData.fileName.replace(/\.[^/.]+$/, '')
    const copies = Math.max(1, Number(printSettings.copies) || 1)
    for (let i = 0; i < copies; i++) {
      const job = enqueuePrintJob({ jobName, pages: printPreviewData.pages, pid: 1, fileName: printPreviewData.fileName, colorMode: printSettings.colorMode, paperSize: printSettings.paperSize, orientation: printSettings.orientation, timestamp: printSettings.timestamp, copyIndex: i + 1, copies })
      window.dispatchEvent(new CustomEvent('submit-print-job', { detail: job }))
    }
    setError(`Print job submitted: ${printPreviewData.fileName} (${printPreviewData.pages} pages × ${copies} ${copies === 1 ? 'copy' : 'copies'})`)
    setShowPrintPreview(false); setPrintPreviewData(null)
  }

  const handleShowProperties = async (e) => {
    e.stopPropagation()
    if (contextMenu.targetPath) {
      try {
        const response = await fetchApi(`/fs/properties?path=${encodeURIComponent(contextMenu.targetPath)}`)
        if (response.ok) setPropertiesData(await response.json())
        else setPropertiesData({ path: contextMenu.targetPath, type: contextMenu.targetType, name: contextMenu.targetPath.split('/').pop(), error: 'Failed to load properties' })
      } catch { setPropertiesData({ path: contextMenu.targetPath, type: contextMenu.targetType, name: contextMenu.targetPath.split('/').pop(), error: 'Failed to load properties' }) }
      setShowPropertiesDialog(true)
    }
    setContextMenu({ visible: false, x: 0, y: 0, targetPath: null })
  }

  const handleAddressBarSubmit = () => {
    if (addressBarValue.trim()) { handleNavigate(addressBarValue); setAddressBarEdit(false) }
  }

  const handleNewFolder = async () => {
    const folderName = prompt('New folder name:'); if (!folderName) return
    try {
      const response = await fetchApi('/fs/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: currentPath + '/' + folderName, node_type: 'dir', content: '' }) })
      if (response.ok) loadDirectory(currentPath)
      else setError('Failed to create folder')
    } catch { setError('Failed to create folder') }
  }

  const handleNewFile = async () => {
    const fileName = prompt('New file name:'); if (!fileName) return
    try {
      const response = await fetchApi('/fs/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: currentPath + '/' + fileName, node_type: 'file', content: '' }) })
      if (response.ok) loadDirectory(currentPath)
      else setError('Failed to create file')
    } catch { setError('Failed to create file') }
  }

  const restoreRecycleItem = async (pathToRestore) => {
    if (!pathToRestore) return
    try {
      const response = await fetchApi(`/fs/recycle/restore?recycle_path=${encodeURIComponent(pathToRestore)}`, { method: 'POST' })
      if (response.ok) { setError('Item restored'); setSelectedFile(null); loadDirectory(currentPath) }
      else setError('Restore failed')
    } catch { setError('Restore failed') }
  }

  const emptyRecycleBin = async () => {
    if (!window.confirm('Permanently delete all items in Recycle Bin?')) return
    try {
      const response = await fetchApi('/fs/recycle/empty', { method: 'DELETE' })
      if (response.ok) { setSelectedFile(null); setError('Recycle Bin emptied'); loadDirectory(currentPath) }
      else setError('Failed to empty Recycle Bin')
    } catch { setError('Failed to empty Recycle Bin') }
  }

  const isAppShortcut = (entry) => entry.type === 'file' && entry.path.endsWith('.lnk')
  const isTextFile = (entry) => entry.type === 'file' && entry.path.endsWith('.txt')

  const getShortcutIcon = (entry) => {
    const name = entry.path.split('/').pop().replace('.lnk', '').toLowerCase()
    for (const [key, Icon] of Object.entries(APP_SHORTCUT_ICONS)) {
      if (name.includes(key)) return Icon
    }
    return FileText
  }

  useEffect(() => {
    if (!contextMenu.visible) return
    const handleDocClick = (event) => {
      if (event.target.closest('.fe-ctx-menu')) return
      setContextMenu({ visible: false, x: 0, y: 0, targetPath: null })
    }
    document.addEventListener('mousedown', handleDocClick)
    return () => document.removeEventListener('mousedown', handleDocClick)
  }, [contextMenu.visible])

  const breadcrumbs = getBreadcrumbs()
  const displayEntries = isSearching ? searchResults : entries
  const isRecycleBin = currentPath === RECYCLE_BIN_PATH

  return (
    <div className="fe-root">

      {/* ── Command bar ── */}
      <div className="fe-commandbar">
        <button className="fe-cmd-btn" onClick={handleGoUp} title="Up">
          <ArrowUp size={15} />
          <span>Up</span>
        </button>
        <div className="fe-cmd-sep" />
        <button className="fe-cmd-btn" onClick={handleNewFolder} title="New folder">
          <FolderPlus size={15} />
          <span>New folder</span>
        </button>
        <button className="fe-cmd-btn" onClick={handleNewFile} title="New file">
          <FilePlus size={15} />
          <span>New file</span>
        </button>
        <div className="fe-cmd-sep" />
        <button className="fe-cmd-btn" onClick={() => { if (selectedFile) setClipboard({ action: 'cut', path: selectedFile.path }) }} disabled={!selectedFile} title="Cut">
          <Scissors size={15} />
          <span>Cut</span>
        </button>
        <button className="fe-cmd-btn" onClick={() => { if (selectedFile) setClipboard({ action: 'copy', path: selectedFile.path }) }} disabled={!selectedFile} title="Copy">
          <ClipboardCopy size={15} />
          <span>Copy</span>
        </button>
        <button className={`fe-cmd-btn ${clipboard ? 'fe-cmd-btn--active' : ''}`} onClick={handlePaste} disabled={!clipboard} title="Paste">
          <ClipboardPaste size={15} />
          <span>Paste</span>
        </button>
        <div className="fe-cmd-sep" />
        <button className="fe-cmd-btn" onClick={() => { if (selectedFile) { setRenameTarget(selectedFile.path); setRenameName(selectedFile.path.split('/').pop()); setShowRenameDialog(true) } }} disabled={!selectedFile} title="Rename">
          <Pencil size={15} />
          <span>Rename</span>
        </button>
        <button className="fe-cmd-btn fe-cmd-btn--danger" onClick={() => { if (selectedFile) { setDeleteTarget(selectedFile.path); setShowDeleteConfirm(true) } }} disabled={!selectedFile} title="Delete">
          <Trash2 size={15} />
          <span>Delete</span>
        </button>
        {isRecycleBin && (
          <>
            <div className="fe-cmd-sep" />
            <button className="fe-cmd-btn" onClick={() => restoreRecycleItem(selectedFile?.path)} disabled={!selectedFile} title="Restore">
              <RotateCcw size={15} />
              <span>Restore</span>
            </button>
            <button className="fe-cmd-btn fe-cmd-btn--danger" onClick={emptyRecycleBin} title="Empty Recycle Bin">
              <Trash2 size={15} />
              <span>Empty</span>
            </button>
          </>
        )}
      </div>

      {/* ── Navigation bar (address + search) ── */}
      <div className="fe-navbar">
        {/* Breadcrumb address bar */}
        <div className="fe-addressbar" onClick={() => !addressBarEdit && setAddressBarEdit(true)}>
          {addressBarEdit ? (
            <input
              className="fe-addressbar-input"
              value={addressBarValue}
              onChange={e => setAddressBarValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddressBarSubmit(); if (e.key === 'Escape') setAddressBarEdit(false) }}
              onBlur={() => setAddressBarEdit(false)}
              autoFocus
            />
          ) : (
            <div className="fe-breadcrumbs">
              {breadcrumbs.map((crumb, i) => (
                <span key={crumb.path} className="fe-breadcrumb-item">
                  <button
                    className="fe-breadcrumb-btn"
                    onClick={e => { e.stopPropagation(); handleNavigate(crumb.path) }}
                  >
                    {crumb.name}
                  </button>
                  {i < breadcrumbs.length - 1 && <ChevronRight size={12} className="fe-breadcrumb-sep" />}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="fe-searchbar">
          <Search size={14} className="fe-search-icon" />
          <input
            className="fe-search-input"
            placeholder="Search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="fe-search-clear" onClick={clearSearch}><X size={13} /></button>
          )}
        </div>
      </div>

      {/* ── Body (sidebar + content) ── */}
      <div className="fe-body">

        {/* Sidebar */}
        <nav className="fe-sidebar">
          <div className="fe-sidebar-group">
            <div className="fe-sidebar-label">
              <Star size={11} />
              Quick access
            </div>
            {quickAccessItems.filter(i => i.group === 'quick').map(item => {
              const Icon = item.icon
              return (
                <button
                  key={item.path}
                  className={`fe-sidebar-item ${currentPath === item.path ? 'fe-sidebar-item--active' : ''}`}
                  onClick={() => handleNavigate(item.path)}
                >
                  <Icon size={15} className="fe-sidebar-icon" />
                  <span>{item.name}</span>
                </button>
              )
            })}
          </div>
          <div className="fe-sidebar-group">
            <div className="fe-sidebar-label">
              <HardDrive size={11} />
              This PC
            </div>
            {quickAccessItems.filter(i => i.group === 'this-pc').map(item => {
              const Icon = item.icon
              return (
                <button
                  key={item.path}
                  className={`fe-sidebar-item ${currentPath === item.path ? 'fe-sidebar-item--active' : ''}`}
                  onClick={() => handleNavigate(item.path)}
                >
                  <Icon size={15} className="fe-sidebar-icon" />
                  <span>{item.name}</span>
                </button>
              )
            })}
          </div>
        </nav>

        {/* Content area */}
        <div className="fe-content">
          {/* Status strips */}
          {error && (
            <div className="fe-strip fe-strip--error">
              <span>{error}</span>
              <button onClick={() => setError('')}><X size={13} /></button>
            </div>
          )}
          {currentPath === '/home/user/Desktop' && (
            <div className="fe-strip fe-strip--info">
              <Home size={13} />
              <span>Desktop — app shortcuts and files</span>
            </div>
          )}
          {isSearching && searchQuery && (
            <div className="fe-strip fe-strip--search">
              <Search size={13} />
              <span>{searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{searchQuery}"</span>
            </div>
          )}

          {/* File grid */}
          <div className="fe-grid" onClick={() => setSelectedFile(null)}>
            {displayEntries.length === 0 ? (
              <div className="fe-empty">
                <Folder size={48} style={{ color: 'var(--win-border)', marginBottom: 12 }} />
                <p>{isSearching ? 'No results found' : 'This folder is empty'}</p>
              </div>
            ) : (
              displayEntries.map(entry => {
                const entryName = entry.path.split('/').pop()
                const isShortcut = isAppShortcut(entry)
                const thumb = thumbnails[entry.path]
                const { Icon, color } = getFileIcon(entryName, entry.type === 'dir')
                const ShortcutIcon = isShortcut ? getShortcutIcon(entry) : null

                return (
                  <div
                    key={entry.path}
                    className={`fe-item ${selectedFile?.path === entry.path ? 'fe-item--selected' : ''} ${isShortcut ? 'fe-item--shortcut' : ''}`}
                    onClick={e => { e.stopPropagation(); handleFileClick(entry) }}
                    onContextMenu={e => handleContextMenu(e, entry)}
                    title={entryName}
                  >
                    <div className="fe-item-icon-wrap">
                      {thumb ? (
                        <div className="fe-thumb">
                          {thumb.type === 'image'
                            ? <img src={thumb.url} alt={entryName} />
                            : <video src={thumb.url} muted playsInline loop autoPlay preload="metadata" />
                          }
                        </div>
                      ) : isShortcut && ShortcutIcon ? (
                        <ShortcutIcon size={36} style={{ color: '#0067c0' }} />
                      ) : (
                        <Icon size={36} style={{ color }} />
                      )}
                      {isShortcut && <div className="fe-shortcut-badge" />}
                    </div>
                    <div className="fe-item-label">{entryName}</div>
                    <div className="fe-item-type">
                      {entry.type === 'dir' ? 'Folder' : isShortcut ? 'Shortcut' : entryName.split('.').pop().toUpperCase()}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Status bar ── */}
      <div className="fe-statusbar">
        <span>{displayEntries.length} item{displayEntries.length !== 1 ? 's' : ''}</span>
        {selectedFile && <span className="fe-statusbar-sep">·</span>}
        {selectedFile && <span>{selectedFile.path.split('/').pop()} selected</span>}
      </div>

      {/* ── File viewer modal ── */}
      {fileContent && (
        <div className="fe-viewer-overlay" onClick={closeFileViewer}>
          <div className="fe-viewer" onClick={e => e.stopPropagation()}>
            <div className="fe-viewer-header">
              <div className="fe-viewer-title">
                {(() => { const { Icon, color } = getFileIcon(fileContent.name); return <Icon size={16} style={{ color }} /> })()}
                <span>{fileContent.name}</span>
              </div>
              <button className="fe-viewer-close" onClick={closeFileViewer}><X size={16} /></button>
            </div>
            <div className="fe-viewer-body">
              {isLoadingFile ? (
                <div className="fe-viewer-loading">Loading…</div>
              ) : isImageFile(fileContent.name) ? (
                <img className="fe-viewer-media" src={fileContent.mediaUrl} alt={fileContent.name} />
              ) : isVideoFile(fileContent.name) ? (
                <video className="fe-viewer-media" src={fileContent.mediaUrl} controls preload="metadata" playsInline />
              ) : (
                <pre className="fe-viewer-text">{fileContent.content || '(Empty file)'}</pre>
              )}
            </div>
            <div className="fe-viewer-footer">
              <span className="fe-viewer-path">{fileContent.path}</span>
              <span>{fileContent.content ? `${fileContent.content.length} chars` : '0 bytes'}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Context menu ── */}
      {contextMenu.visible && createPortal(
        <div className="fe-ctx-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
          <button className="fe-ctx-item" onClick={handleCopy}><ClipboardCopy size={14} />Copy</button>
          <button className="fe-ctx-item" onClick={handleCut}><Scissors size={14} />Cut</button>
          <button className="fe-ctx-item" onClick={handlePaste} disabled={!clipboard}><ClipboardPaste size={14} />Paste</button>
          <div className="fe-ctx-sep" />
          <button className="fe-ctx-item" onClick={handleRename}><Pencil size={14} />Rename</button>
          <button className="fe-ctx-item fe-ctx-item--danger" onClick={handleDelete}><Trash2 size={14} />Delete</button>
          {isRecycleBin && (
            <button className="fe-ctx-item" onClick={() => { restoreRecycleItem(contextMenu.targetPath); setContextMenu({ visible: false, x: 0, y: 0, targetPath: null }) }}>
              <RotateCcw size={14} />Restore
            </button>
          )}
          <div className="fe-ctx-sep" />
          <button className="fe-ctx-item" onClick={handlePrint}><Printer size={14} />Print</button>
          <button className="fe-ctx-item" onClick={handleShowProperties}><Info size={14} />Properties</button>
        </div>,
        document.body
      )}

      {/* ── Rename dialog ── */}
      {showRenameDialog && (
        <div className="fe-overlay" onClick={() => setShowRenameDialog(false)}>
          <div className="fe-dialog" onClick={e => e.stopPropagation()}>
            <div className="fe-dialog-header">Rename</div>
            <input
              className="fe-dialog-input"
              value={renameName}
              onChange={e => setRenameName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') setShowRenameDialog(false) }}
              autoFocus
            />
            <div className="fe-dialog-footer">
              <button className="fe-dialog-btn fe-dialog-btn--primary" onClick={confirmRename}>Rename</button>
              <button className="fe-dialog-btn" onClick={() => setShowRenameDialog(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm dialog ── */}
      {showDeleteConfirm && (
        <div className="fe-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="fe-dialog" onClick={e => e.stopPropagation()}>
            <div className="fe-dialog-header">
              {isRecycleBin ? 'Delete permanently' : 'Move to Recycle Bin'}
            </div>
            <p className="fe-dialog-body">
              {isRecycleBin
                ? `"${deleteTarget?.split('/').pop()}" will be permanently deleted.`
                : `"${deleteTarget?.split('/').pop()}" will be moved to the Recycle Bin.`}
            </p>
            <div className="fe-dialog-footer">
              <button className="fe-dialog-btn fe-dialog-btn--danger" onClick={confirmDelete}>
                {isRecycleBin ? 'Delete' : 'Move to Recycle Bin'}
              </button>
              <button className="fe-dialog-btn" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Properties dialog ── */}
      {showPropertiesDialog && propertiesData && (
        <div className="fe-overlay" onClick={() => setShowPropertiesDialog(false)}>
          <div className="fe-dialog fe-dialog--wide" onClick={e => e.stopPropagation()}>
            <div className="fe-dialog-header">Properties — {propertiesData.name}</div>
            <div className="fe-props">
              {propertiesData.error ? (
                <div className="fe-prop-row"><span className="fe-prop-label">Error</span><span>{propertiesData.error}</span></div>
              ) : (
                <>
                  <div className="fe-prop-row"><span className="fe-prop-label">Name</span><span>{propertiesData.name}</span></div>
                  <div className="fe-prop-row"><span className="fe-prop-label">Location</span><span className="fe-prop-mono">{propertiesData.path}</span></div>
                  <div className="fe-prop-row"><span className="fe-prop-label">Type</span><span>{propertiesData.type}</span></div>
                  {propertiesData.type !== 'Directory' && (
                    <div className="fe-prop-row"><span className="fe-prop-label">Size</span><span>{propertiesData.size_display} ({propertiesData.size_bytes} bytes)</span></div>
                  )}
                  <div className="fe-prop-row"><span className="fe-prop-label">Owner</span><span>{propertiesData.owner}</span></div>
                  <div className="fe-prop-row"><span className="fe-prop-label">Computer</span><span>{propertiesData.computer}</span></div>
                  <div className="fe-prop-row"><span className="fe-prop-label">Created</span><span>{new Date(propertiesData.created).toLocaleString()}</span></div>
                  <div className="fe-prop-row"><span className="fe-prop-label">Modified</span><span>{new Date(propertiesData.modified).toLocaleString()}</span></div>
                  <div className="fe-prop-row"><span className="fe-prop-label">Attributes</span><span>{propertiesData.attributes}</span></div>
                </>
              )}
            </div>
            <div className="fe-dialog-footer">
              <button className="fe-dialog-btn fe-dialog-btn--primary" onClick={() => setShowPropertiesDialog(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Print preview ── */}
      {showPrintPreview && printPreviewData && (
        <PrintPreviewDialog
          content={printPreviewData.content}
          fileName={printPreviewData.fileName}
          pages={printPreviewData.pages}
          onPrint={handleSubmitPrint}
          onCancel={() => { setShowPrintPreview(false); setPrintPreviewData(null) }}
        />
      )}
    </div>
  )
}
