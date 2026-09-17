"""
Account Manager module for Agy Image Gateway.
Coordinates 6 Antigravity accounts and the local auto-rotation proxy.
"""

import sys
import os
import time
from typing import List, Dict, Any, Optional

SWITCHER_DIR = "/home/chinhan/antigravity-switcher"
if SWITCHER_DIR not in sys.path:
    sys.path.insert(0, SWITCHER_DIR)

try:
    import proxy
    import switcher
except ImportError:
    proxy = None
    switcher = None

CONFIG_DIR = os.path.expanduser("~/.config/antigravity-switcher")
ACCOUNTS_FILE = os.path.join(CONFIG_DIR, "accounts.json")

class AccountManager:
    def __init__(self, port: int = 8899):
        self.port = port
        self.pool = proxy.AccountPool(ACCOUNTS_FILE) if proxy else None

    def ensure_proxy_running(self) -> bool:
        """Kiểm tra và tự khởi động Local Rotation Proxy nếu chưa chạy."""
        if not proxy:
            return False
        status = proxy.get_proxy_status(port=self.port)
        if not status.get("running"):
            try:
                proxy.start_proxy_background(port=self.port)
                time.sleep(0.5)
                return True
            except Exception as e:
                print(f"[AccountManager] Failed to start proxy: {e}")
                return False
        return True

    def get_accounts(self) -> List[Dict[str, Any]]:
        """Lấy danh sách 6 tài khoản kèm thông tin cơ bản."""
        if self.pool:
            self.pool.refresh_accounts()
            accounts = self.pool.accounts
        elif switcher:
            accounts = switcher.load_accounts()
        else:
            accounts = []

        active_email = self.get_active_account()
        res = []
        for idx, acc in enumerate(accounts):
            email = acc.get("email", "")
            is_active = (email == active_email)
            in_cooldown = self.pool.is_in_cooldown(email) if self.pool else False
            res.append({
                "index": idx + 1,
                "id": acc.get("id", ""),
                "email": email,
                "is_active": is_active,
                "in_cooldown": in_cooldown,
                "added_at": acc.get("addedAt")
            })
        return res

    def get_active_account(self) -> Optional[str]:
        """Lấy email của tài khoản đang active."""
        if switcher:
            try:
                return switcher.get_active_account_email()
            except Exception:
                pass
        return None

    def switch_account(self, identifier: str) -> Dict[str, Any]:
        """Chuyển sang tài khoản theo index (1-6) hoặc email."""
        if not switcher:
            return {"success": False, "error": "Switcher module not loaded"}

        accounts = switcher.load_accounts()
        target = None

        if identifier.isdigit():
            idx = int(identifier) - 1
            if 0 <= idx < len(accounts):
                target = accounts[idx]
        else:
            for acc in accounts:
                if acc.get("email", "").lower() == identifier.lower():
                    target = acc
                    break

        if not target:
            return {"success": False, "error": f"Account '{identifier}' not found"}

        try:
            switcher.switch_to_account(target, restart_ide=False, is_interactive=False, notify_desktop=False)
            return {"success": True, "email": target.get("email")}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_proxy_status(self) -> Dict[str, Any]:
        """Lấy trạng thái proxy."""
        if proxy:
            return proxy.get_proxy_status(port=self.port)
        return {"running": False, "port": self.port}
