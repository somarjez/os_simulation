import { useState, useEffect, useMemo } from 'react'
import { Clock3, FileText, FolderOpen, Plus, Printer, Save, Search, StickyNote, Trash2 } from 'lucide-react'

import PrintPreviewDialog from '../components/PrintPreviewDialog'
import { enqueuePrintJob } from '../utils/printJobs'

export default function NotesApp() {
  const [content, setContent] = useState('')
  const [currentNote, setCurrentNote] = useState(null)
  const [notesList, setNotesList] = useState([])
  const [status, setStatus] = useState('')
  const [notesDir] = useState('/home/user/notes')
  const [isModified, setIsModified] = useState(false)
  const [newNoteName, setNewNoteName] = useState('')
  const [showNewNoteDialog, setShowNewNoteDialog] = useState(false)
  const [showHistoryPanel, setShowHistoryPanel] = useState(false)
  const [historyEntries, setHistoryEntries] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [viewMode, setViewMode] = useState('notes')
  const [trashNotes, setTrashNotes] = useState([])
  const [showPrintPreview, setShowPrintPreview] = useState(false)
  const [printJobDetails, setPrintJobDetails] = useState(null)
  const [noteSearch, setNoteSearch] = useState('')
  const [editorFocused, setEditorFocused] = useState(false)

  useEffect(() => {
    loadNotesList()
    loadTrashNotes()
    checkForFileToOpen().catch(err => {
      console.error('Error checking for file to open:', err)
      setStatus('Failed to open file')
    })
  }, [])

  useEffect(() => {
    if (currentNote && content !== currentNote.originalContent) {
      setIsModified(true)
    } else {
      setIsModified(false)
    }
  }, [content, currentNote])

  const checkForFileToOpen = async () => {
    const fileToOpen = localStorage.getItem('notes_open_file')
    if (fileToOpen) {
      localStorage.removeItem('notes_open_file')
      try {
        const response = await fetchApi('/fs/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: fileToOpen })
        })
        if (response.ok) {
          const data = await response.json()
          setContent(data.content)
          setCurrentNote({ path: fileToOpen, type: 'file', originalContent: data.content })
          loadNoteHistory(fileToOpen)
          setStatus('File opened')
          setIsModified(false)
          setTimeout(() => loadNotesList(), 100)
        } else {
          setStatus('Failed to open file: ' + response.status)
        }
      } catch (error) {
        setStatus('Failed to open file: ' + error.message)
      }
    }
  }

  const fetchApi = async (path, options = {}) => {
    const bases = ['http://localhost:8000', 'http://127.0.0.1:8000']
    for (const base of bases) {
      try {
        const response = await fetch(`${base}${path}`, options)
        return response
      } catch (err) { continue }
    }
    throw new Error('System service unavailable')
  }

  const loadNotesList = async () => {
    try {
      await fetchApi('/fs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: notesDir, node_type: 'dir', content: '' })
      })
      const response = await fetchApi(`/fs/list?path=${encodeURIComponent(notesDir)}`)
      if (response.ok) {
        const data = await response.json()
        const txtFiles = (data.nodes || []).filter(node => node.type === 'file' && node.path.endsWith('.txt'))
        setNotesList(txtFiles)
        if (currentNote && !currentNote.path.startsWith(notesDir)) {
          setNotesList(prev => [{ path: currentNote.path, type: 'file' }, ...prev])
        }
      }
    } catch (error) { setStatus('Failed to load notes') }
  }

  const loadTrashNotes = async () => {
    try {
      const response = await fetchApi('/fs/recycle/list')
      if (!response.ok) { setTrashNotes([]); return }
      const data = await response.json()
      const notesTrash = (data.nodes || []).filter(node => {
        const originalPath = node.original_path || ''
        return originalPath.startsWith(`${notesDir}/`) && originalPath.endsWith('.txt')
      })
      setTrashNotes(notesTrash)
    } catch { setTrashNotes([]) }
  }

  const loadNoteHistory = async (notePath) => {
    if (!notePath) { setHistoryEntries([]); return }
    setHistoryLoading(true)
    try {
      const response = await fetchApi(`/fs/history?path=${encodeURIComponent(notePath)}`)
      if (response.ok) {
        const data = await response.json()
        setHistoryEntries(data.versions || [])
      } else { setHistoryEntries([]) }
    } catch { setHistoryEntries([]) }
    finally { setHistoryLoading(false) }
  }

  const handleSelectNote = async (note) => {
    if (isModified) {
      const confirm = window.confirm('You have unsaved changes. Do you want to continue?')
      if (!confirm) return
    }
    try {
      const response = await fetchApi('/fs/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: note.path })
      })
      if (response.ok) {
        const data = await response.json()
        setContent(data.content)
        setCurrentNote({ ...note, originalContent: data.content })
        loadNoteHistory(note.path)
        setStatus('Note loaded')
        setIsModified(false)
      } else { setStatus('Failed to load note') }
    } catch (error) { setStatus('System service unavailable') }
  }

  const handleSave = async () => {
    if (!currentNote) { setStatus('No note selected'); return }
    setStatus('Saving...')
    try {
      const response = await fetchApi('/fs/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentNote.path, content })
      })
      if (response.ok) {
        setStatus('Saved successfully')
        setCurrentNote({ ...currentNote, originalContent: content })
        setIsModified(false)
        loadNoteHistory(currentNote.path)
        try {
          await fetchApi('/notification/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Notes', message: 'Note saved successfully', type: 'success', app_id: 'notes' })
          })
        } catch (error) {}
      } else { setStatus('Failed to save') }
    } catch (error) { setStatus('System service unavailable') }
  }

  const handlePrintClick = () => {
    if (!currentNote) return
    const fileName = currentNote.path.split('/').pop()
    const pages = Math.max(1, Math.ceil(content.length / 500))
    setPrintJobDetails({ fileName, pages, content })
    setShowPrintPreview(true)
  }

  const handleSubmitPrint = (printSettings) => {
    if (!printJobDetails) return
    const fileName = printJobDetails.fileName
    const jobName = fileName.replace(/\.[^/.]+$/, '')
    const copies = Math.max(1, Number(printSettings.copies) || 1)
    for (let i = 0; i < copies; i++) {
      const job = enqueuePrintJob({ jobName, pages: printJobDetails.pages, pid: 1, fileName, colorMode: printSettings.colorMode, paperSize: printSettings.paperSize, orientation: printSettings.orientation, timestamp: printSettings.timestamp, copyIndex: i + 1, copies })
      window.dispatchEvent(new CustomEvent('submit-print-job', { detail: job }))
    }
    setStatus(`Print job submitted: ${fileName} (${printJobDetails.pages} pages x ${copies} ${copies === 1 ? 'copy' : 'copies'})`)
    setShowPrintPreview(false)
    setPrintJobDetails(null)
  }

  const handleNewNote = () => {
    if (isModified) {
      const confirm = window.confirm('You have unsaved changes. Do you want to continue?')
      if (!confirm) return
    }
    setNewNoteName('')
    setShowNewNoteDialog(true)
  }

  const createNewNote = async () => {
    if (!newNoteName.trim()) { setStatus('Please enter a note name'); return }
    const fileName = newNoteName.endsWith('.txt') ? newNoteName : `${newNoteName}.txt`
    const notePath = `${notesDir}/${fileName}`
    try {
      const response = await fetchApi('/fs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: notePath, node_type: 'file', content: '' })
      })
      if (response.ok) {
        setContent('')
        setCurrentNote({ path: notePath, type: 'file', originalContent: '' })
        setHistoryEntries([])
        setShowHistoryPanel(false)
        setIsModified(false)
        setStatus('New note created')
        setShowNewNoteDialog(false)
        loadNotesList()
      } else { setStatus('Failed to create note') }
    } catch (error) { setStatus('System service unavailable') }
  }

  const handleDeleteNote = async (note, e) => {
    e.stopPropagation()
    const confirm = window.confirm(`Are you sure you want to delete "${note.path.split('/').pop()}"?`)
    if (!confirm) return
    try {
      const response = await fetchApi(`/fs/delete?path=${encodeURIComponent(note.path)}`, { method: 'DELETE' })
      if (response.ok) {
        setStatus('Note moved to Trash')
        if (currentNote?.path === note.path) {
          setContent(''); setCurrentNote(null); setHistoryEntries([]); setShowHistoryPanel(false); setIsModified(false)
        }
        loadNotesList(); loadTrashNotes()
        try {
          await fetchApi('/notification/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Notes', message: 'Note deleted', type: 'info', app_id: 'notes' })
          })
        } catch (error) {}
      } else { setStatus('Failed to delete note') }
    } catch (error) { setStatus('System service unavailable') }
  }

  const restoreDeletedNote = async (trashNote, e) => {
    e.stopPropagation()
    try {
      const response = await fetchApi(`/fs/recycle/restore?recycle_path=${encodeURIComponent(trashNote.path)}`, { method: 'POST' })
      if (response.ok) { setStatus('Note restored from Trash'); loadNotesList(); loadTrashNotes() }
      else { setStatus('Failed to restore note') }
    } catch { setStatus('Failed to restore note') }
  }

  const permanentlyDeleteNote = async (trashNote, e) => {
    e.stopPropagation()
    const confirm = window.confirm('Permanently delete this note from Trash?')
    if (!confirm) return
    try {
      const response = await fetchApi(`/fs/delete?path=${encodeURIComponent(trashNote.path)}&permanent=true`, { method: 'DELETE' })
      if (response.ok) { setStatus('Note permanently deleted'); loadTrashNotes() }
      else { setStatus('Failed to permanently delete note') }
    } catch { setStatus('Failed to permanently delete note') }
  }

  const restoreHistoryVersion = async (versionId) => {
    if (!currentNote) return
    try {
      const response = await fetchApi(`/fs/history/restore?path=${encodeURIComponent(currentNote.path)}&version_id=${versionId}`, { method: 'POST' })
      if (!response.ok) { setStatus('Failed to restore version'); return }
      const readResponse = await fetchApi('/fs/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: currentNote.path }) })
      if (readResponse.ok) {
        const data = await readResponse.json()
        setContent(data.content)
        setCurrentNote({ ...currentNote, originalContent: data.content })
        setIsModified(false)
        setStatus('Version restored')
        loadNoteHistory(currentNote.path)
      }
    } catch { setStatus('Failed to restore version') }
  }

  const filteredNotes = useMemo(() => {
    const searchTerm = noteSearch.trim().toLowerCase()
    if (!searchTerm) return notesList
    return notesList.filter(note => {
      const noteName = note.path.split('/').pop().replace('.txt', '').toLowerCase()
      return noteName.includes(searchTerm) || note.path.toLowerCase().includes(searchTerm)
    })
  }, [noteSearch, notesList])

  const currentFileName = currentNote?.path.split('/').pop() || ''
  const activeNoteTitle = currentFileName ? currentFileName.replace('.txt', '') : 'Untitled note'
  const sidebarCountText = viewMode === 'notes'
    ? `${filteredNotes.length} ${filteredNotes.length === 1 ? 'note' : 'notes'}`
    : `${trashNotes.length} deleted`
  const noteToneCount = 5

  // Pastel accent colors per note
  const noteAccents = ['#f9a8d4','#fcd34d','#6ee7b7','#93c5fd','#c4b5fd','#fb923c','#a7f3d0','#fda4af']

  return (
    <div className="app-notes">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Lora:ital,wght@0,400;0,600;1,400&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .app-notes {
          font-family: 'Poppins', sans-serif;
          height: 100%;
          width: 100%;
          background: #f5f0e8;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .notes-container {
          display: flex;
          height: 100%;
          overflow: hidden;
        }

        /* ═══════════════════════════════
           SIDEBAR
        ═══════════════════════════════ */
        .notes-sidebar {
          width: 230px;
          min-width: 230px;
          background: #1c1917;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border-right: none;
          position: relative;
        }

        /* Titlebar */
        .notes-app-titlebar {
          padding: 14px 16px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .notes-window-dots {
          display: flex;
          gap: 5px;
        }

        .notes-window-dots span {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: rgba(255,255,255,0.15);
        }

        .notes-window-dots span:nth-child(1) { background: #ef4444; }
        .notes-window-dots span:nth-child(2) { background: #f59e0b; }
        .notes-window-dots span:nth-child(3) { background: #22c55e; }

        .notes-app-identity {
          display: flex;
          align-items: center;
          gap: 9px;
          color: rgba(255,255,255,0.9);
        }

        .notes-app-identity svg {
          color: #f59e0b;
          flex-shrink: 0;
        }

        .notes-app-identity div {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .notes-app-identity strong {
          font-size: 13px;
          font-weight: 700;
          color: #fafaf9;
          letter-spacing: 0.01em;
        }

        .notes-app-identity span {
          font-size: 10px;
          color: rgba(255,255,255,0.35);
          font-weight: 400;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        /* Sidebar header */
        .notes-sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px 6px;
          gap: 6px;
        }

        .notes-sidebar-modes {
          display: flex;
          gap: 4px;
          background: rgba(255,255,255,0.05);
          border-radius: 7px;
          padding: 3px;
          flex: 1;
        }

        .notes-mode-btn {
          flex: 1;
          border: none;
          background: transparent;
          color: rgba(255,255,255,0.4);
          font-family: 'Poppins', sans-serif;
          font-size: 10.5px;
          font-weight: 500;
          padding: 4px 6px;
          border-radius: 5px;
          cursor: pointer;
          transition: all 0.18s;
          white-space: nowrap;
        }

        .notes-mode-btn.active {
          background: #f59e0b;
          color: #1c1917;
          font-weight: 600;
        }

        .notes-sidebar-btn {
          width: 28px;
          height: 28px;
          border-radius: 7px;
          border: none;
          background: rgba(245,158,11,0.15);
          color: #f59e0b;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s;
          flex-shrink: 0;
        }

        .notes-sidebar-btn:hover:not(:disabled) {
          background: #f59e0b;
          color: #1c1917;
        }

        .notes-sidebar-btn:disabled { opacity: 0.3; cursor: not-allowed; }

        /* Search */
        .notes-sidebar-tools {
          padding: 0 14px 8px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .notes-search {
          display: flex;
          align-items: center;
          gap: 7px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          padding: 6px 10px;
          color: rgba(255,255,255,0.4);
          transition: border-color 0.15s;
        }

        .notes-search:focus-within {
          border-color: rgba(245,158,11,0.4);
          color: rgba(255,255,255,0.6);
        }

        .notes-search input {
          background: transparent;
          border: none;
          outline: none;
          color: #fafaf9;
          font-family: 'Poppins', sans-serif;
          font-size: 11.5px;
          font-weight: 400;
          width: 100%;
        }

        .notes-search input::placeholder { color: rgba(255,255,255,0.25); }
        .notes-search input:disabled { opacity: 0.4; }

        .notes-sidebar-count {
          font-size: 10px;
          color: rgba(255,255,255,0.25);
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding: 0 2px;
        }

        /* Notes list */
        .notes-list {
          flex: 1;
          overflow-y: auto;
          padding: 4px 10px 10px;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .notes-list::-webkit-scrollbar { width: 4px; }
        .notes-list::-webkit-scrollbar-track { background: transparent; }
        .notes-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

        .notes-list-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border-radius: 9px;
          cursor: pointer;
          transition: all 0.15s;
          position: relative;
          border: 1px solid transparent;
          group: true;
        }

        .notes-list-item:hover { background: rgba(255,255,255,0.06); }

        .notes-list-item.active {
          background: rgba(245,158,11,0.12);
          border-color: rgba(245,158,11,0.25);
        }

        .notes-note-tab {
          position: absolute;
          left: 0; top: 25%; bottom: 25%;
          width: 2px;
          border-radius: 2px;
          background: transparent;
          transition: background 0.15s;
        }

        .notes-list-item.active .notes-note-tab { background: #f59e0b; }

        .notes-list-icon { color: rgba(255,255,255,0.3); flex-shrink: 0; }
        .notes-list-item.active .notes-list-icon { color: #f59e0b; }

        .notes-list-text {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .notes-list-name {
          font-size: 12px;
          font-weight: 500;
          color: rgba(255,255,255,0.7);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          transition: color 0.15s;
        }

        .notes-list-item.active .notes-list-name { color: #fef3c7; }

        .notes-list-path {
          font-size: 9.5px;
          color: rgba(255,255,255,0.25);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .notes-mini-save-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #f59e0b;
          flex-shrink: 0;
          animation: pulse-dot 2s infinite;
        }

        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .notes-list-delete {
          width: 22px;
          height: 22px;
          border-radius: 5px;
          border: none;
          background: transparent;
          color: rgba(255,255,255,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          opacity: 0;
          transition: all 0.15s;
          flex-shrink: 0;
        }

        .notes-list-item:hover .notes-list-delete {
          opacity: 1;
        }

        .notes-list-delete:hover {
          background: rgba(239,68,68,0.2);
          color: #ef4444;
        }

        /* Trash items */
        .trash-item { flex-wrap: wrap; }

        .notes-trash-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .notes-trash-date {
          font-size: 9.5px;
          color: rgba(255,255,255,0.25);
        }

        .notes-list-action {
          border: 1px solid rgba(245,158,11,0.3);
          background: transparent;
          color: #f59e0b;
          font-family: 'Poppins', sans-serif;
          font-size: 10px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 5px;
          cursor: pointer;
          transition: all 0.15s;
          flex-shrink: 0;
        }

        .notes-list-action:hover { background: rgba(245,158,11,0.15); }

        /* Empty states */
        .notes-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          padding: 36px 16px;
          text-align: center;
          color: rgba(255,255,255,0.25);
        }

        .notes-empty-icon { opacity: 0.3; }

        .notes-empty p {
          font-size: 12px;
          font-weight: 500;
          color: rgba(255,255,255,0.3);
        }

        .notes-empty-btn {
          margin-top: 4px;
          border: 1px solid rgba(245,158,11,0.3);
          background: transparent;
          color: #f59e0b;
          font-family: 'Poppins', sans-serif;
          font-size: 11px;
          font-weight: 600;
          padding: 6px 14px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .notes-empty-btn:hover { background: rgba(245,158,11,0.12); }

        /* ═══════════════════════════════
           EDITOR AREA
        ═══════════════════════════════ */
        .notes-editor-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: #faf8f3;
          position: relative;
        }

        /* Subtle ruled-paper texture */
        .notes-editor-area::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: repeating-linear-gradient(
            transparent,
            transparent 27px,
            rgba(180,160,120,0.09) 27px,
            rgba(180,160,120,0.09) 28px
          );
          pointer-events: none;
          z-index: 0;
        }

        /* Toolbar */
        .notes-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 18px;
          border-bottom: 1px solid rgba(0,0,0,0.07);
          background: rgba(250,248,243,0.95);
          backdrop-filter: blur(8px);
          position: relative;
          z-index: 2;
          gap: 12px;
        }

        .notes-toolbar-left {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          flex: 1;
        }

        .notes-toolbar-file-icon {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          background: rgba(245,158,11,0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .notes-toolbar-icon { color: #d97706; }

        .notes-file-heading {
          display: flex;
          flex-direction: column;
          gap: 1px;
          min-width: 0;
        }

        .notes-current-file {
          font-size: 13px;
          font-weight: 600;
          color: #1c1917;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-family: 'Lora', serif;
        }

        .notes-current-path {
          font-size: 10px;
          color: #a8a29e;
          font-weight: 400;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .notes-no-file {
          font-size: 13px;
          color: #a8a29e;
          font-style: italic;
          font-family: 'Lora', serif;
        }

        .notes-modified-indicator {
          font-size: 10px;
          font-weight: 600;
          color: #d97706;
          background: rgba(245,158,11,0.1);
          border: 1px solid rgba(245,158,11,0.2);
          border-radius: 5px;
          padding: 2px 7px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          flex-shrink: 0;
          animation: pulse-dot 2s infinite;
        }

        .notes-toolbar-actions {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }

        .notes-toolbar-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 6px 12px;
          border-radius: 8px;
          border: 1px solid rgba(0,0,0,0.1);
          background: #fff;
          color: #57534e;
          font-family: 'Poppins', sans-serif;
          font-size: 11.5px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }

        .notes-toolbar-btn:hover:not(:disabled) {
          background: #1c1917;
          color: #fafaf9;
          border-color: #1c1917;
        }

        .notes-toolbar-btn.active {
          background: #1c1917;
          color: #fafaf9;
          border-color: #1c1917;
        }

        .notes-toolbar-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        /* Status banner */
        .notes-status {
          background: rgba(245,158,11,0.08);
          border-bottom: 1px solid rgba(245,158,11,0.15);
          padding: 6px 18px;
          font-size: 11.5px;
          font-weight: 500;
          color: #92400e;
          position: relative;
          z-index: 2;
          letter-spacing: 0.01em;
        }

        /* Hero kicker */
        .notes-editor-hero {
          padding: 12px 22px 0;
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .notes-editor-kicker {
          font-size: 10px;
          font-weight: 600;
          color: #a8a29e;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          background: rgba(0,0,0,0.04);
          border-radius: 5px;
          padding: 3px 8px;
        }

        /* History panel */
        .notes-history-panel {
          margin: 0 18px;
          border-radius: 10px;
          background: #fff;
          border: 1px solid rgba(0,0,0,0.08);
          overflow: hidden;
          position: relative;
          z-index: 1;
        }

        .notes-history-title {
          padding: 10px 14px;
          font-size: 11px;
          font-weight: 700;
          color: #57534e;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          border-bottom: 1px solid rgba(0,0,0,0.06);
          background: #fafaf9;
        }

        .notes-history-empty {
          padding: 16px 14px;
          font-size: 12px;
          color: #a8a29e;
          text-align: center;
          font-style: italic;
        }

        .notes-history-list {
          max-height: 160px;
          overflow-y: auto;
        }

        .notes-history-list::-webkit-scrollbar { width: 4px; }
        .notes-history-list::-webkit-scrollbar-thumb { background: #e7e5e4; border-radius: 4px; }

        .notes-history-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 14px;
          border-bottom: 1px solid rgba(0,0,0,0.04);
          gap: 10px;
          transition: background 0.12s;
        }

        .notes-history-item:hover { background: #fafaf9; }

        .notes-history-meta { flex: 1; min-width: 0; }

        .notes-history-date {
          font-size: 11px;
          font-weight: 600;
          color: #57534e;
        }

        .notes-history-preview {
          font-size: 10.5px;
          color: #a8a29e;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .notes-history-restore {
          border: 1px solid rgba(0,0,0,0.12);
          background: transparent;
          color: #57534e;
          font-family: 'Poppins', sans-serif;
          font-size: 10px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 5px;
          cursor: pointer;
          transition: all 0.15s;
          flex-shrink: 0;
        }

        .notes-history-restore:hover {
          background: #1c1917;
          color: #fafaf9;
          border-color: #1c1917;
        }

        /* ── Textarea ── */
        .notes-editor {
          flex: 1;
          padding: 16px 22px 12px;
          background: transparent;
          border: none;
          outline: none;
          resize: none;
          font-family: 'Lora', serif;
          font-size: 14.5px;
          font-weight: 400;
          line-height: 1.85;
          color: #292524;
          position: relative;
          z-index: 1;
          transition: color 0.15s;
        }

        .notes-editor::placeholder {
          color: #c4bfbb;
          font-style: italic;
        }

        .notes-editor:disabled {
          color: #c4bfbb;
          cursor: not-allowed;
        }

        /* Footer */
        .notes-editor-footer {
          display: flex;
          align-items: center;
          padding: 8px 18px;
          border-top: 1px solid rgba(0,0,0,0.07);
          background: rgba(250,248,243,0.9);
          position: relative;
          z-index: 2;
        }

        .notes-footer-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 500;
          color: #a8a29e;
        }

        .notes-footer-item svg { opacity: 0.6; }

        /* ═══════════════════════════════
           DIALOG
        ═══════════════════════════════ */
        .notes-dialog-overlay {
          position: fixed;
          inset: 0;
          background: rgba(28,25,23,0.5);
          backdrop-filter: blur(4px);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.15s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .notes-dialog {
          background: #faf8f3;
          border-radius: 16px;
          padding: 28px;
          width: 320px;
          box-shadow: 0 24px 60px rgba(0,0,0,0.25);
          display: flex;
          flex-direction: column;
          gap: 16px;
          animation: slideUp 0.18s ease;
          border: 1px solid rgba(0,0,0,0.08);
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .notes-dialog h3 {
          display: flex;
          align-items: center;
          gap: 9px;
          font-family: 'Lora', serif;
          font-size: 16px;
          font-weight: 600;
          color: #1c1917;
        }

        .notes-dialog h3 svg { color: #d97706; }

        .notes-dialog-input {
          border: 1.5px solid rgba(0,0,0,0.12);
          border-radius: 9px;
          padding: 10px 13px;
          font-family: 'Poppins', sans-serif;
          font-size: 13px;
          font-weight: 400;
          color: #1c1917;
          background: #fff;
          outline: none;
          transition: border-color 0.15s;
          width: 100%;
        }

        .notes-dialog-input:focus { border-color: #f59e0b; }
        .notes-dialog-input::placeholder { color: #c4bfbb; }

        .notes-dialog-buttons {
          display: flex;
          gap: 8px;
        }

        .notes-dialog-btn {
          flex: 1;
          border-radius: 9px;
          border: 1.5px solid rgba(0,0,0,0.1);
          background: #fff;
          color: #57534e;
          font-family: 'Poppins', sans-serif;
          font-size: 13px;
          font-weight: 600;
          padding: 9px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .notes-dialog-btn.primary {
          background: #1c1917;
          color: #fef3c7;
          border-color: #1c1917;
        }

        .notes-dialog-btn:hover:not(.primary) { background: #f5f0e8; }
        .notes-dialog-btn.primary:hover { background: #292524; }
      `}</style>

      <div className="notes-container">
        {/* Notes List Sidebar */}
        <div className="notes-sidebar">
          <div className="notes-app-titlebar">
            <div className="notes-window-dots" aria-hidden="true">
              <span></span><span></span><span></span>
            </div>
            <div className="notes-app-identity">
              <StickyNote size={18} />
              <div>
                <strong>Notes</strong>
                <span>Personal notebook</span>
              </div>
            </div>
          </div>

          <div className="notes-sidebar-header">
            <div className="notes-sidebar-modes">
              <button type="button" className={`notes-mode-btn ${viewMode === 'notes' ? 'active' : ''}`} onClick={() => setViewMode('notes')}>
                My Notes
              </button>
              <button type="button" className={`notes-mode-btn ${viewMode === 'trash' ? 'active' : ''}`} onClick={() => { setViewMode('trash'); loadTrashNotes() }}>
                Trash ({trashNotes.length})
              </button>
            </div>
            <button type="button" className="notes-sidebar-btn" onClick={handleNewNote} title="New Note" disabled={viewMode !== 'notes'}>
              <Plus size={16} />
            </button>
          </div>

          <div className="notes-sidebar-tools">
            <label className="notes-search">
              <Search size={14} />
              <input
                type="search"
                value={noteSearch}
                onChange={(e) => setNoteSearch(e.target.value)}
                placeholder="Search notes"
                disabled={viewMode !== 'notes'}
              />
            </label>
            <div className="notes-sidebar-count">{sidebarCountText}</div>
          </div>

          <div className="notes-list">
            {viewMode === 'notes' && notesList.length === 0 ? (
              <div className="notes-empty">
                <FileText size={30} className="notes-empty-icon" />
                <p>No notes yet</p>
                <button type="button" className="notes-empty-btn" onClick={handleNewNote}>Create your first note</button>
              </div>
            ) : viewMode === 'notes' && filteredNotes.length === 0 ? (
              <div className="notes-empty compact">
                <Search size={26} className="notes-empty-icon" />
                <p>No matching notes</p>
              </div>
            ) : viewMode === 'notes' ? (
              filteredNotes.map((note, i) => {
                const isExternal = !note.path.startsWith(notesDir)
                const noteName = note.path.split('/').pop().replace('.txt', '')
                const toneClass = `tone-${noteName.length % noteToneCount}`
                return (
                  <div
                    key={note.path}
                    className={`notes-list-item ${toneClass} ${currentNote?.path === note.path ? 'active' : ''} ${isExternal ? 'external' : ''}`}
                    onClick={() => handleSelectNote(note)}
                    title={isExternal ? note.path : ''}
                  >
                    <span className="notes-note-tab" aria-hidden="true"></span>
                    <FileText size={14} className="notes-list-icon" />
                    <div className="notes-list-text">
                      <span className="notes-list-name">{noteName}</span>
                      {isExternal && <span className="notes-list-path">Opened from File Explorer</span>}
                    </div>
                    {currentNote?.path === note.path && isModified && (
                      <span className="notes-mini-save-dot" title="Unsaved changes"></span>
                    )}
                    {!isExternal && (
                      <button type="button" className="notes-list-delete" onClick={(e) => handleDeleteNote(note, e)} title="Delete note">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                )
              })
            ) : trashNotes.length === 0 ? (
              <div className="notes-empty">
                <Trash2 size={30} className="notes-empty-icon" />
                <p>Trash is empty</p>
              </div>
            ) : (
              trashNotes.map((note) => {
                const noteName = (note.original_path || note.path).split('/').pop().replace('.txt', '')
                return (
                  <div key={note.path} className="notes-list-item trash-item">
                    <span className="notes-note-tab" aria-hidden="true"></span>
                    <FileText size={14} className="notes-list-icon" />
                    <div className="notes-trash-info">
                      <span className="notes-list-name">{noteName}</span>
                      <span className="notes-trash-date">Deleted: {new Date(note.deleted_at).toLocaleString()}</span>
                    </div>
                    <button type="button" className="notes-list-action" onClick={(e) => restoreDeletedNote(note, e)} title="Restore note">Restore</button>
                    <button type="button" className="notes-list-delete" onClick={(e) => permanentlyDeleteNote(note, e)} title="Delete permanently"><Trash2 size={13} /></button>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Editor Area */}
        <div className="notes-editor-area">
          <div className="notes-toolbar">
            <div className="notes-toolbar-left">
              {currentNote ? (
                <>
                  <span className="notes-toolbar-file-icon">
                    <FolderOpen size={15} className="notes-toolbar-icon" />
                  </span>
                  <div className="notes-file-heading">
                    <span className="notes-current-file">{activeNoteTitle}</span>
                    <span className="notes-current-path">{currentFileName}</span>
                  </div>
                  {isModified && <span className="notes-modified-indicator">Unsaved</span>}
                </>
              ) : (
                <span className="notes-no-file">No note selected</span>
              )}
            </div>

            <div className="notes-toolbar-actions">
              <button
                type="button"
                className={`notes-toolbar-btn ${showHistoryPanel ? 'active' : ''}`}
                onClick={() => {
                  const next = !showHistoryPanel
                  setShowHistoryPanel(next)
                  if (next && currentNote) loadNoteHistory(currentNote.path)
                }}
                disabled={!currentNote}
                title="Version History"
              >
                History
              </button>
              <button type="button" className="notes-toolbar-btn" onClick={handleSave} disabled={!currentNote || !isModified} title="Save">
                <Save size={14} />
                Save
              </button>
              <button type="button" className="notes-toolbar-btn" onClick={handlePrintClick} disabled={!currentNote} title="Print">
                <Printer size={14} />
                Print
              </button>
            </div>
          </div>

          {status && <div className="notes-status">{status}</div>}

          {currentNote && (
            <div className="notes-editor-hero">
              <div>
                <span className="notes-editor-kicker">{editorFocused ? 'Writing now' : 'Ready to edit'}</span>
              </div>
            </div>
          )}

          {showHistoryPanel && currentNote && (
            <div className="notes-history-panel">
              <div className="notes-history-title">Version History</div>
              {historyLoading ? (
                <div className="notes-history-empty">Loading history...</div>
              ) : historyEntries.length === 0 ? (
                <div className="notes-history-empty">No saved versions yet</div>
              ) : (
                <div className="notes-history-list">
                  {historyEntries.map((version) => (
                    <div key={version.id} className="notes-history-item">
                      <div className="notes-history-meta">
                        <div className="notes-history-date">{new Date(version.created_at).toLocaleString()}</div>
                        <div className="notes-history-preview">{version.preview}</div>
                      </div>
                      <button type="button" className="notes-history-restore" onClick={() => restoreHistoryVersion(version.id)}>Restore</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <textarea
            className={`notes-editor ${editorFocused ? 'is-focused' : ''}`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={() => setEditorFocused(true)}
            onBlur={() => setEditorFocused(false)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault()
                if (currentNote && isModified) handleSave()
              }
            }}
            placeholder={currentNote ? "Write something gentle here..." : "Select or create a note to begin"}
            disabled={!currentNote}
          />

          <div className="notes-editor-footer">
            <div className="notes-footer-item">
              <Clock3 size={13} />
              {isModified ? 'Changes waiting to be saved' : currentNote ? 'Saved and up to date' : 'No active note'}
            </div>
          </div>
        </div>
      </div>

      {/* New Note Dialog */}
      {showNewNoteDialog && (
        <div className="notes-dialog-overlay" onClick={() => setShowNewNoteDialog(false)}>
          <div className="notes-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>
              <StickyNote size={18} />
              Create New Note
            </h3>
            <input
              type="text"
              className="notes-dialog-input"
              value={newNoteName}
              onChange={(e) => setNewNoteName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createNewNote()
                if (e.key === 'Escape') setShowNewNoteDialog(false)
              }}
              placeholder="Note name (e.g., My Note)"
              autoFocus
            />
            <div className="notes-dialog-buttons">
              <button type="button" className="notes-dialog-btn primary" onClick={createNewNote}>Create</button>
              <button type="button" className="notes-dialog-btn" onClick={() => setShowNewNoteDialog(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showPrintPreview && printJobDetails && (
        <PrintPreviewDialog
          content={printJobDetails.content}
          fileName={printJobDetails.fileName}
          pages={printJobDetails.pages}
          onPrint={handleSubmitPrint}
          onCancel={() => { setShowPrintPreview(false); setPrintJobDetails(null) }}
        />
      )}
    </div>
  )
}