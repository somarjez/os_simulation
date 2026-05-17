"""Application installation and management router."""


from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import JSONResponse
import httpx
from datetime import datetime
from database import get_db_connection

router = APIRouter(prefix="/app", tags=["apps"])

# Proxy DuckDuckGo search (CORS bypass)
@router.get("/search/duckduckgo")
async def duckduckgo_search(q: str):
    """Proxy DuckDuckGo Instant Answer API to bypass CORS."""
    url = f"https://api.duckduckgo.com/?q={q}&format=json&no_redirect=1&no_html=0"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url)
        return JSONResponse(content=resp.json())

# Default built-in apps that ship with the OS
DEFAULT_APPS = [
    {
        "id": "terminal",
        "name": "Terminal",
        "version": "1.0.0",
        "description": "Command line interface",
        "icon": "Terminal",
        "category": "System",
        "builtin": True,
        "permissions": ["filesystem", "process"],
        "storage_size_mb": 45
    },
    {
        "id": "files",
        "name": "File Explorer",
        "version": "1.0.0",
        "description": "Browse files and folders",
        "icon": "Folder",
        "category": "System",
        "builtin": True,
        "permissions": ["filesystem"],
        "storage_size_mb": 32
    },
    {
        "id": "notes",
        "name": "Notes",
        "version": "1.0.0",
        "description": "Text editor and notes",
        "icon": "FileText",
        "category": "Productivity",
        "builtin": True,
        "permissions": ["filesystem"],
        "storage_size_mb": 12
    },
    {
        "id": "settings",
        "name": "Settings",
        "version": "1.0.0",
        "description": "System configuration",
        "icon": "Settings",
        "category": "System",
        "builtin": True,
        "permissions": ["system"],
        "storage_size_mb": 8
    },
    {
        "id": "monitor",
        "name": "System Monitor",
        "version": "1.0.0",
        "description": "View system resources",
        "icon": "Activity",
        "category": "System",
        "builtin": True,
        "permissions": ["system"],
        "storage_size_mb": 25
    },
    {
        "id": "localfiles",
        "name": "Local Files",
        "version": "1.0.0",
        "description": "Access local computer files",
        "icon": "HardDrive",
        "category": "System",
        "builtin": True,
        "permissions": ["filesystem"],
        "storage_size_mb": 18
    },
    {
        "id": "appstore",
        "name": "App Store",
        "version": "1.0.0",
        "description": "Install and manage applications",
        "icon": "Package",
        "category": "System",
        "builtin": True,
        "permissions": ["system"],
        "storage_size_mb": 56
    },
    {
        "id": "eventviewer",
        "name": "Event Viewer",
        "version": "1.0.0",
        "description": "View system events and logs",
        "icon": "AlertCircle",
        "category": "System",
        "builtin": True,
        "permissions": ["system"],
        "storage_size_mb": 20
    },
    {
        "id": "diagnostics",
        "name": "System Diagnostics",
        "version": "1.0.0",
        "description": "Diagnose system issues",
        "icon": "Stethoscope",
        "category": "System",
        "builtin": True,
        "permissions": ["system"],
        "storage_size_mb": 30
    },
    {
        "id": "calculator",
        "name": "Calculator",
        "version": "1.0.0",
        "description": "Basic calculator with standard operations",
        "icon": "Calculator",
        "category": "Productivity",
        "builtin": True,
        "permissions": [],
        "storage_size_mb": 8
    },
    {
        "id": "camera",
        "name": "Camera",
        "version": "1.0.0",
        "description": "Take photos and record videos",
        "icon": "Camera",
        "category": "Multimedia",
        "builtin": True,
        "permissions": ["camera", "filesystem"],
        "storage_size_mb": 35
    },
    {
        "id": "clock",
        "name": "Clock",
        "version": "1.0.0",
        "description": "Timer and stopwatch",
        "icon": "Clock",
        "category": "Productivity",
        "builtin": True,
        "permissions": [],
        "storage_size_mb": 10
    },
    {
        "id": "calendar",
        "name": "Calendar",
        "version": "1.0.0",
        "description": "View and navigate calendar dates",
        "icon": "Calendar",
        "category": "Productivity",
        "builtin": True,
        "permissions": [],
        "storage_size_mb": 12
    },
    {
        "id": "tips",
        "name": "Tips & Getting Started",
        "version": "1.0.0",
        "description": "Learn how to use JezOS",
        "icon": "Lightbulb",
        "category": "System",
        "builtin": True,
        "permissions": [],
        "storage_size_mb": 5
    },
    {
        "id": "webbrowser",
        "name": "Web Browser",
        "version": "1.0.0",
        "description": "Browse the web and download files",
        "icon": "Package",
        "category": "Internet",
        "builtin": True,
        "permissions": ["filesystem", "network"],
        "storage_size_mb": 22
    },
    {
        "id": "minesweeper",
        "name": "Minesweeper",
        "version": "1.0.0",
        "description": "Classic mine detection puzzle game",
        "icon": "Bomb",
        "category": "Games",
        "builtin": True,
        "permissions": [],
        "storage_size_mb": 2
    },
    {
        "id": "solitaire",
        "name": "Solitaire",
        "version": "1.0.0",
        "description": "Classic Klondike card game",
        "icon": "Spade",
        "category": "Games",
        "builtin": True,
        "permissions": [],
        "storage_size_mb": 2
    }
]


def init_apps_table():
    """Initialize apps table if not exists."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS apps (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            version TEXT NOT NULL,
            description TEXT,
            icon TEXT,
            category TEXT,
            builtin INTEGER DEFAULT 0,
            installed INTEGER DEFAULT 1,
            permissions TEXT,
            storage_size_mb INTEGER DEFAULT 0,
            installed_at TEXT,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.commit()
    
    # Install default apps if not already installed
    for app in DEFAULT_APPS:
        cursor.execute("SELECT 1 FROM apps WHERE id = ?", (app["id"],))
        if cursor.fetchone() is None:
            cursor.execute(
                """
                INSERT INTO apps 
                (id, name, version, description, icon, category, builtin, installed, permissions, storage_size_mb, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    app["id"],
                    app["name"],
                    app["version"],
                    app["description"],
                    app["icon"],
                    app["category"],
                    1,  # builtin
                    1,  # installed
                    ",".join(app.get("permissions", [])),
                    app.get("storage_size_mb", 0),
                    datetime.utcnow().isoformat()
                )
            )
    conn.commit()
    conn.close()


@router.get("/list")
def list_apps(category: str = Query(None)):
    """List all installed apps, optionally filtered by category."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if category:
        cursor.execute(
            "SELECT * FROM apps WHERE installed = 1 AND category = ? ORDER BY name",
            (category,)
        )
    else:
        cursor.execute("SELECT * FROM apps WHERE installed = 1 ORDER BY category, name")
    
    rows = cursor.fetchall()

    # If no apps are installed, initialize defaults and retry
    if not rows:
        conn.close()
        init_apps_table()
        conn = get_db_connection()
        cursor = conn.cursor()
        if category:
            cursor.execute(
                "SELECT * FROM apps WHERE installed = 1 AND category = ? ORDER BY name",
                (category,)
            )
        else:
            cursor.execute("SELECT * FROM apps WHERE installed = 1 ORDER BY category, name")
        rows = cursor.fetchall()
        conn.close()
    else:
        conn.close()
    
    apps = []
    for row in rows:
        app_dict = dict(row)
        app_dict["permissions"] = app_dict["permissions"].split(",") if app_dict["permissions"] else []
        apps.append(app_dict)
    
    return apps


@router.get("/categories")
def get_categories():
    """Get list of available app categories."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT category FROM apps WHERE installed = 1 ORDER BY category")
    rows = cursor.fetchall()
    conn.close()
    return [row["category"] for row in rows]


@router.post("/install")
def install_app(app_manifest: dict):
    """Install a new application.
    
    Expected payload:
    {
        "id": "myapp",
        "name": "My App",
        "version": "1.0.0",
        "description": "...",
        "icon": "AppIcon",
        "category": "Productivity",
        "permissions": ["filesystem", "network"]
    }
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    app_id = app_manifest.get("id")
    if not app_id:
        raise HTTPException(status_code=400, detail="App ID is required")
    
    # Validate required fields
    required = ["name", "version", "category"]
    for field in required:
        if field not in app_manifest:
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")

    # Check for existing row (covers re-install after uninstall)
    cursor.execute("SELECT installed, builtin FROM apps WHERE id = ?", (app_id,))
    existing = cursor.fetchone()

    if existing is not None:
        if existing["installed"]:
            conn.close()
            raise HTTPException(status_code=409, detail="App already installed")
        # Row exists but was previously uninstalled — just re-enable it
        cursor.execute(
            "UPDATE apps SET installed = 1, installed_at = ? WHERE id = ?",
            (datetime.utcnow().isoformat(), app_id)
        )
    else:
        # Fresh install
        cursor.execute(
            """
            INSERT INTO apps
            (id, name, version, description, icon, category, builtin, installed, permissions, installed_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                app_id,
                app_manifest["name"],
                app_manifest["version"],
                app_manifest.get("description", ""),
                app_manifest.get("icon", "Box"),
                app_manifest["category"],
                0,  # not builtin
                1,  # installed
                ",".join(app_manifest.get("permissions", [])),
                datetime.utcnow().isoformat(),
                datetime.utcnow().isoformat()
            )
        )
    conn.commit()
    conn.close()
    
    return {
        "success": True,
        "message": f"App {app_manifest['name']} installed successfully",
        "app_id": app_id
    }


@router.delete("/uninstall")
def uninstall_app(app_id: str = Query(...)):
    """Uninstall an application.
    
    Cannot uninstall built-in apps.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if app exists and is currently installed
    cursor.execute("SELECT * FROM apps WHERE id = ? AND installed = 1", (app_id,))
    app = cursor.fetchone()

    if app is None:
        conn.close()
        raise HTTPException(status_code=404, detail="App not found")

    # Prevent uninstalling built-in apps
    if app["builtin"]:
        conn.close()
        raise HTTPException(status_code=403, detail="Cannot uninstall built-in applications")
    
    # Mark as uninstalled instead of deleting
    cursor.execute("UPDATE apps SET installed = 0 WHERE id = ?", (app_id,))
    conn.commit()
    conn.close()
    
    return {
        "success": True,
        "message": f"App {app_id} uninstalled successfully"
    }


@router.get("/info/{app_id}")
def get_app_info(app_id: str):
    """Get detailed information about an app."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM apps WHERE id = ?", (app_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row is None:
        raise HTTPException(status_code=404, detail="App not found")
    
    app_dict = dict(row)
    app_dict["permissions"] = app_dict["permissions"].split(",") if app_dict["permissions"] else []
    
    return app_dict


@router.get("/store")
def get_app_store():
    """Get available apps for installation (simulated app store).
    
    Returns apps that are not yet installed.
    """
    available = [
        {
            "id": "calculator",
            "name": "Calculator",
            "version": "1.0.0",
            "description": "Simple calculator for basic math operations",
            "icon": "Calculator",
            "category": "Utilities",
            "builtin": False,
            "permissions": []
        },
        {
            "id": "paint",
            "name": "Paint",
            "version": "1.0.0",
            "description": "Simple drawing application",
            "icon": "Palette",
            "category": "Creativity",
            "builtin": False,
            "permissions": ["filesystem"]
        },
        {
            "id": "clock",
            "name": "Clock",
            "version": "1.0.0",
            "description": "World clock and alarm application",
            "icon": "Clock",
            "category": "Utilities",
            "builtin": False,
            "permissions": []
        },
        {
            "id": "notepad++",
            "name": "Notepad++",
            "version": "1.0.0",
            "description": "Advanced text editor with syntax highlighting",
            "icon": "Code",
            "category": "Productivity",
            "builtin": False,
            "permissions": ["filesystem"]
        }
    ]
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Filter out already installed apps
    filtered = []
    for app in available:
        cursor.execute("SELECT 1 FROM apps WHERE id = ? AND installed = 1", (app["id"],))
        if cursor.fetchone() is None:
            filtered.append(app)
    
    conn.close()
    return filtered
