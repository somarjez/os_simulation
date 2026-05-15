import { useEffect, useRef, useState } from 'react'

const SNAP_THRESHOLD = 20
const SNAP_ZONES = {
  LEFT: { x: 0, y: 0, width: '50%', height: '100%' },
  RIGHT: { x: '50%', y: 0, width: '50%', height: '100%' },
  TOP_LEFT: { x: 0, y: 0, width: '50%', height: '50%' },
  TOP_RIGHT: { x: '50%', y: 0, width: '50%', height: '50%' },
  BOTTOM_LEFT: { x: 0, y: '50%', width: '50%', height: '50%' },
  BOTTOM_RIGHT: { x: '50%', y: '50%', width: '50%', height: '50%' },
  MAXIMIZE: { x: 0, y: 0, width: '100%', height: '100%' }
}

export default function Window({
  windowData,
  onClose,
  onMinimize,
  onMaximize = () => {},
  onFocus,
  onMove,
  onResize = () => {},
  onSnap,
  keepMountedWhenMinimized = false,
  touchpadEnabled = true,
  children
}) {
  const { id, title, x, y, width, height, zIndex, minimized, isActive, isMaximized, noMaximize, hideHeader = false, hideTitle = false, minWidth = 300, minHeight = 200 } = windowData
  const windowRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [snapZone, setSnapZone] = useState(null)
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    if (!dragging && !resizing) return
    const handleMove = (event) => {
      if (resizing) {
        const rect = windowRef.current.getBoundingClientRect()
        let newWidth = width
        let newHeight = height
        let newX = x
        let newY = y

        if (resizing.includes('e')) {
          newWidth = event.clientX - rect.left
        }
        if (resizing.includes('s')) {
          newHeight = event.clientY - rect.top
        }
        if (resizing.includes('w')) {
          const deltaX = event.clientX - rect.left
          newWidth = width - deltaX
          newX = x + deltaX
        }
        if (resizing.includes('n')) {
          const deltaY = event.clientY - rect.top
          newHeight = height - deltaY
          newY = y + deltaY
        }

        // Min size constraints
        if (newWidth < minWidth) newWidth = minWidth
        if (newHeight < minHeight) newHeight = minHeight

        onResize(id, newX, newY, newWidth, newHeight)
        return
      }

      const newX = event.clientX - offset.x
      const newY = event.clientY - offset.y
      onMove(id, newX, newY)
      
      // Detect snap zones
      const screenWidth = window.innerWidth
      const screenHeight = window.innerHeight
      const mouseX = event.clientX
      const mouseY = event.clientY
      
      if (mouseX <= SNAP_THRESHOLD && mouseY <= SNAP_THRESHOLD) {
        setSnapZone('TOP_LEFT')
      } else if (mouseX >= screenWidth - SNAP_THRESHOLD && mouseY <= SNAP_THRESHOLD) {
        setSnapZone('TOP_RIGHT')
      } else if (mouseX <= SNAP_THRESHOLD && mouseY >= screenHeight - SNAP_THRESHOLD - 50) {
        setSnapZone('BOTTOM_LEFT')
      } else if (mouseX >= screenWidth - SNAP_THRESHOLD && mouseY >= screenHeight - SNAP_THRESHOLD - 50) {
        setSnapZone('BOTTOM_RIGHT')
      } else if (mouseX <= SNAP_THRESHOLD) {
        setSnapZone('LEFT')
      } else if (mouseX >= screenWidth - SNAP_THRESHOLD) {
        setSnapZone('RIGHT')
      } else if (mouseY <= SNAP_THRESHOLD) {
        setSnapZone('MAXIMIZE')
      } else {
        setSnapZone(null)
      }
    }
    const handleUp = () => {
      if (snapZone && onSnap && !resizing) {
        onSnap(id, SNAP_ZONES[snapZone])
      }
      setDragging(false)
      setResizing(null)
      setSnapZone(null)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [dragging, resizing, id, offset.x, offset.y, x, y, width, height, onMove, onResize, snapZone, onSnap])

  const startDrag = (event) => {
    if (!touchpadEnabled) {
      onFocus(id)
      return
    }

    if (event.button !== 0 || !windowRef.current) return
    const rect = windowRef.current.getBoundingClientRect()
    setOffset({ x: event.clientX - rect.left, y: event.clientY - rect.top })
    setDragging(true)
    onFocus(id)
  }

  const handleMouseDown = (event) => {
    startDrag(event)
  }

  const handleHeaderDoubleClick = () => {
    if (onMaximize) {
      onMaximize(id)
    }
  }

  const handleCustomChromeMouseDownCapture = (event) => {
    if (!event.target.closest('[data-window-drag-handle="true"]')) return
    if (event.target.closest('[data-no-window-drag="true"]')) return
    startDrag(event)
  }

  const handleCustomChromeDoubleClickCapture = (event) => {
    if (!event.target.closest('[data-window-drag-handle="true"]')) return
    if (event.target.closest('[data-no-window-drag="true"]')) return
    handleHeaderDoubleClick()
  }

  const handleResizeMouseDown = (direction) => (event) => {
    if (!touchpadEnabled) return
    event.stopPropagation()
    setResizing(direction)
    onFocus(id)
  }

  if (minimized && !keepMountedWhenMinimized) return null

  return (
    <>
      {dragging && snapZone && (
        <div
          className="snap-preview"
          style={{
            position: 'fixed',
            left: SNAP_ZONES[snapZone].x,
            top: SNAP_ZONES[snapZone].y,
            width: SNAP_ZONES[snapZone].width,
            height: SNAP_ZONES[snapZone].height,
            border: '3px solid rgba(59, 130, 246, 0.7)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            pointerEvents: 'none',
            zIndex: 9999
          }}
        />
      )}
      <div
        ref={windowRef}
        className={`os-window ${minimized ? 'minimized' : ''} ${isActive ? 'active' : ''} ${isMaximized ? 'maximized' : ''} ${isClosing ? 'closing' : ''}`}
        style={{
          width,
          height,
          transform: `translate(${x}px, ${y}px)`,
          zIndex
        }}
        onMouseDown={() => onFocus(id)}
        onMouseDownCapture={hideHeader ? handleCustomChromeMouseDownCapture : undefined}
        onDoubleClickCapture={hideHeader ? handleCustomChromeDoubleClickCapture : undefined}
      >
        {!hideHeader && (
          <div
            className={`os-window-header ${touchpadEnabled ? '' : 'touchpad-disabled'}`}
            onMouseDown={handleMouseDown}
            onDoubleClick={handleHeaderDoubleClick}
          >
            <span className="os-window-title">{hideTitle ? '' : title}</span>
            <div className="os-window-actions">
              <button
                type="button"
                className="os-window-btn"
                aria-label="Minimize"
                title="Minimize"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation()
                  onMinimize(id)
                }}
              >
                <span className="os-window-glyph os-window-glyph-minimize" aria-hidden="true" />
              </button>
              {!noMaximize && (
                <button
                  type="button"
                  className="os-window-btn"
                  aria-label={isMaximized ? 'Restore Down' : 'Maximize'}
                  title={isMaximized ? 'Restore Down' : 'Maximize'}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation()
                    onMaximize(id)
                  }}
                >
                  <span
                    className={`os-window-glyph ${isMaximized ? 'os-window-glyph-restore' : 'os-window-glyph-maximize'}`}
                    aria-hidden="true"
                  />
                </button>
              )}
              <button
                type="button"
                className="os-window-btn close"
                aria-label="Close"
                title="Close"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation()
                  setIsClosing(true)
                  setTimeout(() => onClose(id), 200)
                }}
              >
                <span className="os-window-glyph os-window-glyph-close" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
        <div className={`os-window-body ${hideHeader ? 'headerless' : ''}`}>{children}</div>
        
        {!isMaximized && (
          <>
            <div className={`os-window-resize-handle n ${touchpadEnabled ? '' : 'touchpad-disabled'}`} onMouseDown={handleResizeMouseDown('n')} />
            <div className={`os-window-resize-handle e ${touchpadEnabled ? '' : 'touchpad-disabled'}`} onMouseDown={handleResizeMouseDown('e')} />
            <div className={`os-window-resize-handle s ${touchpadEnabled ? '' : 'touchpad-disabled'}`} onMouseDown={handleResizeMouseDown('s')} />
            <div className={`os-window-resize-handle w ${touchpadEnabled ? '' : 'touchpad-disabled'}`} onMouseDown={handleResizeMouseDown('w')} />
            <div className={`os-window-resize-handle ne ${touchpadEnabled ? '' : 'touchpad-disabled'}`} onMouseDown={handleResizeMouseDown('ne')} />
            <div className={`os-window-resize-handle se ${touchpadEnabled ? '' : 'touchpad-disabled'}`} onMouseDown={handleResizeMouseDown('se')} />
            <div className={`os-window-resize-handle sw ${touchpadEnabled ? '' : 'touchpad-disabled'}`} onMouseDown={handleResizeMouseDown('sw')} />
            <div className={`os-window-resize-handle nw ${touchpadEnabled ? '' : 'touchpad-disabled'}`} onMouseDown={handleResizeMouseDown('nw')} />
          </>
        )}
      </div>
    </>
  )
}
