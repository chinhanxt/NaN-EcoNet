#!/usr/bin/env python3
"""
Daemon launcher for Agy Image Gateway.
Starts or stops the service in the background cleanly with start_new_session=True.
"""

import os
import sys
import time
import signal
import subprocess

GATEWAY_DIR = "/home/chinhan/agy-image-gateway"
PID_FILE = os.path.join(GATEWAY_DIR, "gateway.pid")
LOG_FILE = os.path.join(GATEWAY_DIR, "gateway.log")

def is_running(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except (OSError, ProcessLookupError):
        return False

def start(port: int = 8080):
    if os.path.exists(PID_FILE):
        try:
            with open(PID_FILE, "r") as f:
                pid = int(f.read().strip())
            if is_running(pid):
                print(f"⚠️ Agy Image Gateway already running with PID {pid} on port {port}.")
                return pid
        except Exception:
            pass

    cmd = [
        sys.executable, "-m", "uvicorn", "main:app",
        "--host", "0.0.0.0", "--port", str(port),
        "--app-dir", GATEWAY_DIR
    ]

    with open(LOG_FILE, "a", encoding="utf-8") as f:
        proc = subprocess.Popen(
            cmd,
            stdout=f,
            stderr=f,
            cwd=GATEWAY_DIR,
            start_new_session=True
        )

    with open(PID_FILE, "w", encoding="utf-8") as f:
        f.write(str(proc.pid))

    time.sleep(1.5)
    if is_running(proc.pid):
        print(f"✅ Agy Image Gateway started successfully (PID: {proc.pid}).")
        print(f"🌐 Web UI & Swagger Docs available at: http://localhost:{port} (or http://127.0.0.1:{port}/docs)")
        return proc.pid
    else:
        print(f"❌ Failed to start. Check {LOG_FILE} for details.")
        return None

def stop():
    if not os.path.exists(PID_FILE):
        print("Gateway is not running (no PID file found).")
        return

    try:
        with open(PID_FILE, "r") as f:
            pid = int(f.read().strip())
    except Exception:
        pid = None

    if pid and is_running(pid):
        print(f"🛑 Stopping Agy Image Gateway (PID: {pid})...")
        try:
            os.kill(pid, signal.SIGTERM)
            for _ in range(20):
                time.sleep(0.2)
                if not is_running(pid):
                    break
            else:
                os.kill(pid, signal.SIGKILL)
        except Exception as e:
            print(f"Error stopping process: {e}")
        print("✅ Agy Image Gateway stopped.")
    else:
        print("⚠️ Gateway process not running. Cleaning up stale PID file.")

    if os.path.exists(PID_FILE):
        os.remove(PID_FILE)

def status(port: int = 8080):
    running = False
    pid = None
    if os.path.exists(PID_FILE):
        try:
            with open(PID_FILE, "r") as f:
                pid = int(f.read().strip())
            running = is_running(pid)
        except Exception:
            pass

    if running:
        print(f"🟢 Gateway Status: RUNNING (PID: {pid}) on port {port}")
    else:
        print("🔴 Gateway Status: STOPPED")

if __name__ == "__main__":
    action = sys.argv[1] if len(sys.argv) > 1 else "status"
    port = int(os.environ.get("PORT", 8080))
    if action == "start":
        start(port)
    elif action == "stop":
        stop()
    elif action == "status":
        status(port)
    else:
        print("Usage: daemon.py [start|stop|status]")
