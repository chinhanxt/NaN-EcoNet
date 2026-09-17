"""
Account Manager module for Enterprise Copilot Diagram & Agy Engine.
Coordinates Antigravity accounts and the local auto-rotation proxy on port 8899.
Completely standalone and self-contained within enterprise-bi-copilot.
"""

import sys
import os
import time
from typing import List, Dict, Any, Optional

SWITCHER_DIR = "/home/chinhan/antigravity-switcher"
if os.path.exists(SWITCHER_DIR) and SWITCHER_DIR not in sys.path:
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
        self.pool = proxy.AccountPool(ACCOUNTS_FILE) if proxy and os.path.exists(ACCOUNTS_FILE) else None

    def ensure_proxy_running(self) -> bool:
        """Kiểm tra và tự khởi động Local Rotation Proxy nếu chưa chạy."""
        if not proxy:
            return False
        try:
            status = proxy.get_proxy_status(port=self.port)
            if not status.get("running"):
                proxy.start_proxy_background(port=self.port)
                time.sleep(0.5)
                return True
            return True
        except Exception as e:
            print(f"[AccountManager] Warning checking proxy: {e}", file=sys.stderr)
            return False

    def get_accounts(self) -> List[Dict[str, Any]]:
        """Lấy danh sách tài khoản kèm trạng thái."""
        if self.pool:
            try:
                self.pool.refresh_accounts()
                accounts = self.pool.accounts
            except Exception:
                accounts = switcher.load_accounts() if switcher else []
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

    def get_proxy_status(self) -> Dict[str, Any]:
        """Lấy trạng thái proxy."""
        if proxy:
            try:
                return proxy.get_proxy_status(port=self.port)
            except Exception:
                pass
        return {"running": False, "port": self.port}
