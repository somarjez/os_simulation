import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import { Check, ChevronRight } from 'lucide-react'

const SUBMENU_CLOSE_DELAY = 150
const SUBMENU_GAP = 4
const FALLBACK_SUBMENU_WIDTH = 240
const MENU_PADDING = 8

export default function ContextMenu({ x, y, visible, items, onClose }) {
  const [activeSubmenuIndex, setActiveSubmenuIndex] = useState(null)
  const [submenuPosition, setSubmenuPosition] = useState({ left: 0, top: 0, side: 'right' })
  const [menuPosition, setMenuPosition] = useState({ left: x, top: y })
  const menuRef = useRef(null)
  const submenuRef = useRef(null)
  const itemRefs = useRef(new Map())
  const submenuTimeoutRef = useRef(null)

  const clearSubmenuTimer = () => {
    if (submenuTimeoutRef.current) {
      clearTimeout(submenuTimeoutRef.current)
      submenuTimeoutRef.current = null
    }
  }

  const setItemRef = (index) => (node) => {
    if (node) {
      itemRefs.current.set(index, node)
    } else {
      itemRefs.current.delete(index)
    }
  }

  /**
   * Calculate the submenu's fixed viewport coordinates.
   *
   * We measure the visible space to the right of the main menu before we commit
   * the submenu to its final position. If the submenu would fit in that space,
   * it is placed flush to the menu's right edge; otherwise it mirrors to the
   * left side. The left-flip uses the clamped main menu edge as the anchor so
   * the submenu cannot drift into the main menu and overlap its row content.
   */
  const calculateSubmenuPosition = (itemIndex) => {
    const menuElement = menuRef.current
    const itemElement = itemRefs.current.get(itemIndex)

    if (!menuElement || !itemElement) {
      return { left: 0, top: 0, side: 'right' }
    }

    const menuRect = menuElement.getBoundingClientRect()
    const itemRect = itemElement.getBoundingClientRect()
    const submenuWidth = submenuRef.current?.offsetWidth || FALLBACK_SUBMENU_WIDTH
    const mainMenuLeft = menuPosition.left
    const mainMenuRight = mainMenuLeft + menuRect.width

    // Measure only the space to the right of the menu edge. If there is enough
    // room for the submenu width plus the fixed gap, keep it on the right.
    const availableSpaceOnRight = window.innerWidth - mainMenuRight
    const openOnRight = availableSpaceOnRight >= submenuWidth + SUBMENU_GAP

    return {
      left: openOnRight
        ? mainMenuRight + SUBMENU_GAP
        : Math.max(SUBMENU_GAP, mainMenuLeft - submenuWidth - SUBMENU_GAP),
      top: itemRect.top,
      side: openOnRight ? 'right' : 'left'
    }
  }

  /**
   * Open submenu immediately on hover. Closing is delayed instead so small
   * pointer drifts do not collapse the menu as the cursor crosses the gap.
   */
  const handleItemHover = (item, index) => {
    clearSubmenuTimer()

    if (!item.hasSubmenu) {
      setActiveSubmenuIndex(null)
      return
    }

    setSubmenuPosition(calculateSubmenuPosition(index))
    setActiveSubmenuIndex(index)
  }

  /**
   * Delay the close briefly so the submenu remains stable while the pointer
   * crosses the 4px gap or re-enters the trigger row.
   */
  const handleItemLeave = () => {
    clearSubmenuTimer()
    submenuTimeoutRef.current = setTimeout(() => {
      setActiveSubmenuIndex(null)
    }, SUBMENU_CLOSE_DELAY)
  }

  /**
   * Keep the submenu open while the pointer is inside it.
   */
  const handleSubmenuHover = () => {
    clearSubmenuTimer()
  }

  useEffect(() => {
    if (activeSubmenuIndex == null) return

    const nextPosition = calculateSubmenuPosition(activeSubmenuIndex)
    setSubmenuPosition((previous) => {
      if (
        previous.left === nextPosition.left &&
        previous.top === nextPosition.top &&
        previous.side === nextPosition.side
      ) {
        return previous
      }
      return nextPosition
    })
  }, [activeSubmenuIndex, menuPosition.left, menuPosition.top])

  const calculateMenuPosition = () => {
    const menuElement = menuRef.current

    if (!menuElement) {
      return { left: x, top: y }
    }

    const menuRect = menuElement.getBoundingClientRect()
    const maxLeft = Math.max(MENU_PADDING, window.innerWidth - menuRect.width - MENU_PADDING)
    const maxTop = Math.max(MENU_PADDING, window.innerHeight - menuRect.height - MENU_PADDING)

    return {
      left: Math.min(Math.max(x, MENU_PADDING), maxLeft),
      top: Math.min(Math.max(y, MENU_PADDING), maxTop)
    }
  }

  useEffect(() => {
    return () => {
      clearSubmenuTimer()
    }
  }, [])

  useEffect(() => {
    if (!visible) return

    setMenuPosition(calculateMenuPosition())

    const handleResize = () => setMenuPosition(calculateMenuPosition())
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [visible, x, y])

  /**
   * Close menu when clicking outside
   */
  useEffect(() => {
    if (!visible) return

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target) && !submenuRef.current?.contains(event.target)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [visible, onClose])

  if (!visible) return null

  const activeMenuItem = activeSubmenuIndex != null ? items[activeSubmenuIndex] : null
  const activeSubmenu = activeMenuItem?.submenu
  const bridgeHeight = Math.max(1, (activeSubmenu?.length || 1) * 44)
  const submenuPortal = activeMenuItem && activeSubmenu && activeSubmenu.length > 0
    ? createPortal(
        <>
          <div
            className="context-menu-hover-bridge"
            style={(() => {
              const menuWidth = menuRef.current?.offsetWidth || 0
              const submenuWidth = submenuRef.current?.offsetWidth || FALLBACK_SUBMENU_WIDTH
              const bridgeLeft = submenuPosition.side === 'right'
                ? menuPosition.left + menuWidth
                : submenuPosition.left + submenuWidth

              return submenuPosition.side === 'right'
                ? {
                    left: `${bridgeLeft}px`,
                    top: `${submenuPosition.top}px`,
                    width: `${SUBMENU_GAP}px`,
                    height: `${bridgeHeight}px`
                  }
                : {
                    left: `${bridgeLeft}px`,
                    top: `${submenuPosition.top}px`,
                    width: `${SUBMENU_GAP}px`,
                    height: `${bridgeHeight}px`
                  }
            })()}
            onMouseEnter={handleSubmenuHover}
            onMouseLeave={handleItemLeave}
            aria-hidden="true"
          />
          <div
            className={`context-submenu context-submenu-${submenuPosition.side}`}
            style={{
              left: `${submenuPosition.left}px`,
              top: `${submenuPosition.top}px`
            }}
            ref={submenuRef}
            onMouseEnter={handleSubmenuHover}
            onMouseLeave={handleItemLeave}
            role="menu"
            aria-label={`${activeMenuItem.label} submenu`}
          >
            {activeSubmenu.map((subitem, subindex) => {
              if (subitem.separator) {
                return (
                  <div
                    key={`subseparator-${subindex}`}
                    className="context-menu-separator"
                    role="separator"
                  />
                )
              }

              const SubIcon = subitem.icon
              return (
                <button
                  key={`${subitem.label}-${subindex}`}
                  type="button"
                  className="context-menu-item"
                  disabled={subitem.disabled}
                  onClick={(event) => {
                    event.stopPropagation()
                    if (subitem.disabled) return
                    subitem.onClick()
                    if (!subitem.keepOpen) {
                      onClose()
                    }
                  }}
                  role="menuitem"
                >
                  <span className="context-menu-item-left">
                    {subitem.checked ? (
                      <Check className="context-menu-item-check" />
                    ) : SubIcon ? (
                      <SubIcon className="context-menu-item-icon" />
                    ) : (
                      <span
                        className="context-menu-item-icon-placeholder"
                        aria-hidden="true"
                      />
                    )}
                    <span className="context-menu-item-label">
                      {subitem.label}
                    </span>
                  </span>
                  <span className="context-menu-item-right">
                    {subitem.shortcut ? (
                      <span className="context-menu-item-shortcut">
                        {subitem.shortcut}
                      </span>
                    ) : null}
                  </span>
                </button>
              )
            })}
          </div>
        </>,
        document.body
      )
    : null

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: menuPosition.left, top: menuPosition.top }}
      role="menu"
      aria-label="Context menu"
    >
      {items.map((item, index) => {
        if (item.separator) {
          return (
            <div
              key={`separator-${index}`}
              className="context-menu-separator"
              role="separator"
            />
          )
        }

        const Icon = item.icon
        const isSubmenuActive = activeSubmenuIndex === index

        return (
          <div key={`${item.label}-${index}`} className="context-menu-item-wrapper">
            <button
              ref={setItemRef(index)}
              type="button"
              className={`context-menu-item ${isSubmenuActive ? 'has-active-submenu' : ''}`}
              disabled={item.disabled}
              onMouseEnter={() => handleItemHover(item, index)}
              onMouseLeave={handleItemLeave}
              onClick={(event) => {
                event.stopPropagation()
                if (item.disabled || item.hasSubmenu) return
                item.onClick()
                if (!item.keepOpen) {
                  onClose()
                }
              }}
              role="menuitem"
              aria-haspopup={item.hasSubmenu}
            >
              <span className="context-menu-item-left">
                {item.checked ? (
                  <Check className="context-menu-item-check" />
                ) : Icon ? (
                  <Icon className="context-menu-item-icon" />
                ) : (
                  <span
                    className="context-menu-item-icon-placeholder"
                    aria-hidden="true"
                  />
                )}
                <span className="context-menu-item-label">{item.label}</span>
              </span>
              <span className="context-menu-item-right">
                {item.shortcut ? (
                  <span className="context-menu-item-shortcut">
                    {item.shortcut}
                  </span>
                ) : null}
                {item.hasSubmenu ? (
                  <ChevronRight className="context-menu-item-chevron" />
                ) : null}
              </span>
            </button>
          </div>
        )
      })}
      {submenuPortal}
    </div>
  )
}
