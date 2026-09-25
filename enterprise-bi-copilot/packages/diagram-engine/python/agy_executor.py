"""
Agy Executor module for Enterprise BI Copilot.
Implements the 2-Stage AI Art Director & Generator Pipeline:
Stage 1: AI Art Director (Deep contextual intent detection via agy CLI using awesome-gpt-image-2 taxonomy).
Stage 2: Precision Visual Generator via agy CLI generate_image tool.

COMPLETE SESSION PURGE ENGINE:
Deletes all session traces across:
1. ~/.gemini/antigravity-cli/brain/<uuid> (artifacts, media)
2. ~/.gemini/antigravity-cli/conversations/<uuid>.db* (chat databases)
3. ~/.gemini/antigravity-cli/conversation_summaries.db (SQLite summary table)
4. ~/.gemini/antigravity-cli/cache/conversation_metadata.json (metadata cache)
5. ~/.gemini/antigravity-cli/cache/last_conversations.json (recent conversations cache)
"""

import os
import sys
import time
import uuid
import json
import re
import shutil
import sqlite3
import subprocess
import signal
from typing import Dict, Any, Optional, Set

from template_engine import EnterpriseTemplateEngine

CLI_DIR = os.path.expanduser("~/.gemini/antigravity-cli")
BRAIN_DIR = os.path.join(CLI_DIR, "brain")
CONV_DIR = os.path.join(CLI_DIR, "conversations")
SUMMARIES_DB = os.path.join(CLI_DIR, "conversation_summaries.db")
CACHE_META = os.path.join(CLI_DIR, "cache", "conversation_metadata.json")
CACHE_LAST = os.path.join(CLI_DIR, "cache", "last_conversations.json")

PROTECTED_CONV_IDS = {
    "a970b004-a927-4ac9-ade0-db25cb975baa",
    "cb4a5585-defa-4799-80ce-248a6e73fd79",
}

ACTIVE_SESSIONS_UNDER_EXECUTION: Set[str] = set()

def _sig_handler(signum, frame):
    """Bắt tín hiệu SIGTERM / SIGINT để dọn sạch mọi session đang thực thi trước khi tiến trình tắt."""
    if ACTIVE_SESSIONS_UNDER_EXECUTION:
        purge_sessions(ACTIVE_SESSIONS_UNDER_EXECUTION)
    sweep_orphaned_sessions()
    sys.exit(0)

try:
    signal.signal(signal.SIGTERM, _sig_handler)
    signal.signal(signal.SIGINT, _sig_handler)
except Exception:
    pass

def purge_sessions(session_ids: Set[str]):
    """
    Xóa sạch hoàn toàn mọi dấu vết của các conversation_ids khỏi hệ thống agy CLI:
    1. brain folder (~/.gemini/antigravity-cli/brain/<sid>)
    2. conversations/*.db files (~/.gemini/antigravity-cli/conversations/<sid>.db*)
    3. conversation_summaries.db (kèm PRAGMA wal_checkpoint TRUNCATE)
    4. cache/conversation_metadata.json
    5. cache/last_conversations.json
    6. annotations/*<sid>*
    7. presence/*<sid>*
    8. history.jsonl
    """
    safe_ids = {sid for sid in session_ids if sid and sid not in PROTECTED_CONV_IDS}
    if not safe_ids:
        return

    # 1. Brain folders
    for sid in safe_ids:
        b_path = os.path.join(BRAIN_DIR, sid)
        if os.path.exists(b_path):
            try:
                shutil.rmtree(b_path, ignore_errors=True)
            except Exception:
                pass

    # 2. Conversations DB files (.db, .db-wal, .db-shm)
    for sid in safe_ids:
        for ext in ["", "-wal", "-shm"]:
            f_path = os.path.join(CONV_DIR, f"{sid}.db{ext}")
            if os.path.exists(f_path):
                try:
                    os.remove(f_path)
                except Exception:
                    pass

    # 3. SQLite conversation_summaries.db + WAL checkpoint truncate
    if os.path.exists(SUMMARIES_DB):
        try:
            conn = sqlite3.connect(SUMMARIES_DB, timeout=10)
            cursor = conn.cursor()
            for sid in safe_ids:
                cursor.execute("DELETE FROM conversation_summaries WHERE conversation_id = ?", (sid,))
            conn.commit()
            cursor.execute("PRAGMA wal_checkpoint(TRUNCATE)")
            conn.close()
        except Exception as e:
            print(f"[Purge] Error cleaning conversation_summaries.db: {e}", file=sys.stderr)

    # 4. cache/conversation_metadata.json
    if os.path.exists(CACHE_META):
        try:
            with open(CACHE_META, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict):
                changed = False
                for sid in safe_ids:
                    if sid in data:
                        del data[sid]
                        changed = True
                if changed:
                    with open(CACHE_META, "w", encoding="utf-8") as f:
                        json.dump(data, f)
        except Exception:
            pass

    # 5. cache/last_conversations.json
    if os.path.exists(CACHE_LAST):
        try:
            with open(CACHE_LAST, "r", encoding="utf-8") as f:
                data = json.load(f)
            changed = False
            if isinstance(data, dict):
                for k in list(data.keys()):
                    if isinstance(data[k], list):
                        new_list = [x for x in data[k] if x not in safe_ids]
                        if len(new_list) != len(data[k]):
                            data[k] = new_list
                            changed = True
                    elif data[k] in safe_ids:
                        del data[k]
                        changed = True
            elif isinstance(data, list):
                new_list = [x for x in data if x not in safe_ids]
                if len(new_list) != len(data):
                    data = new_list
                    changed = True
            if changed:
                with open(CACHE_LAST, "w", encoding="utf-8") as f:
                    json.dump(data, f)
        except Exception:
            pass

    # 6. annotations/*<sid>*
    annot_dir = os.path.join(CLI_DIR, "annotations")
    if os.path.exists(annot_dir):
        try:
            for f in os.listdir(annot_dir):
                if any(sid in f for sid in safe_ids):
                    try:
                        os.remove(os.path.join(annot_dir, f))
                    except Exception:
                        pass
        except Exception:
            pass

    # 7. presence/*<sid>*
    presence_dir = os.path.join(CLI_DIR, "presence")
    if os.path.exists(presence_dir):
        try:
            for f in os.listdir(presence_dir):
                if any(sid in f for sid in safe_ids):
                    try:
                        os.remove(os.path.join(presence_dir, f))
                    except Exception:
                        pass
        except Exception:
            pass

    # 8. history.jsonl
    history_file = os.path.join(CLI_DIR, "history.jsonl")
    if os.path.exists(history_file):
        try:
            with open(history_file, "r", encoding="utf-8") as f:
                lines = f.readlines()
            clean_lines = [l for l in lines if not any(sid in l for sid in safe_ids)]
            if len(clean_lines) != len(lines):
                with open(history_file, "w", encoding="utf-8") as f:
                    f.writelines(clean_lines)
        except Exception:
            pass

def sweep_orphaned_sessions() -> Set[str]:
    """
    Tự động quét và dọn sạch vĩnh viễn toàn bộ session rác / tạm thời / bot mồ côi:
    1. Bất kỳ session nào có workspace là tmp hoặc chạy trong thư mục /tmp.
    2. Bất kỳ session ngắn (step_count <= 8) sinh ra bởi các lệnh bot prompt tự động:
       - 'Starting A New Chat', 'Monthly Revenue...', 'Render...', 'Generate...', 'Empty...', v.v.
    3. Tuyệt đối bảo vệ:
       - PROTECTED_CONV_IDS (phiên chat người dùng hiện tại và phiên làm việc chính thức).
       - Các session lập trình thật của người dùng (step_count lớn, workspace thật /home/chinhan).
    """
    if not os.path.exists(SUMMARIES_DB):
        return set()

    orphaned = set()
    try:
        conn = sqlite3.connect(SUMMARIES_DB, timeout=10)
        cursor = conn.cursor()
        cursor.execute("SELECT conversation_id, title, workspace_uris, step_count FROM conversation_summaries")
        rows = cursor.fetchall()
        conn.close()

        for cid, title, ws, steps in rows:
            if not cid or cid in PROTECTED_CONV_IDS:
                continue

            # 1. Thư mục tạm tmp
            if "tmp" in str(ws).lower():
                orphaned.add(cid)
                continue

            # 2. Các prompt tự động hoặc session mồ côi với số bước ngắn
            if steps <= 8:
                lower_title = (title or "").lower().strip()
                if not lower_title or lower_title in [
                    "starting a new chat",
                    "empty message input",
                    "blank conversation starter",
                    "empty conversation start",
                    "generate coffee cup image",
                    "render kpi gauge json",
                    "monthly revenue chart request",
                    "initial test message",
                    "system connection test",
                    "testing the system",
                    "simple ping request"
                ]:
                    orphaned.add(cid)
                    continue

                if any(lower_title.startswith(prefix) for prefix in [
                    "generate ", "render ", "monthly revenue", "biến thiên", "biểu đồ",
                    "dòng tiền", "kpi ", "sơ đồ", "test ", "trắc nghiệm", "bài tập", "đáp án"
                ]):
                    orphaned.add(cid)
                    continue

                if ws == "" or ws == "[]":
                    orphaned.add(cid)
                    continue

    except Exception as e:
        print(f"[Sweep] Error querying summaries db: {e}", file=sys.stderr)

    if orphaned:
        purge_sessions(orphaned)

    return orphaned

class EnterpriseAgyExecutor:
    def __init__(self, proxy_port: int = 8899, storage_dir: Optional[str] = None):
        self.proxy_port = proxy_port
        default_storage = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "../../../apps/agent-server/storage/diagrams")
        )
        self.storage_dir = storage_dir or default_storage
        os.makedirs(self.storage_dir, exist_ok=True)
        self.template_engine = EnterpriseTemplateEngine()
        # Tự động quét dọn session mồ côi ngay khi khởi tạo
        try:
            sweep_orphaned_sessions()
        except Exception:
            pass

    def _snapshot_sessions(self) -> Dict[str, Set[str]]:
        brain_sessions = set(os.listdir(BRAIN_DIR)) if os.path.exists(BRAIN_DIR) else set()
        conv_sessions = set()
        if os.path.exists(CONV_DIR):
            try:
                for f in os.listdir(CONV_DIR):
                    if f.endswith(".db"):
                        conv_sessions.add(f[:-3])
            except Exception:
                pass

        db_sessions = set()
        if os.path.exists(SUMMARIES_DB):
            try:
                conn = sqlite3.connect(SUMMARIES_DB, timeout=5)
                cursor = conn.cursor()
                cursor.execute("SELECT conversation_id FROM conversation_summaries")
                db_sessions = {r[0] for r in cursor.fetchall()}
                conn.close()
            except Exception:
                pass

        return {
            "brain": brain_sessions,
            "conv": conv_sessions,
            "db": db_sessions,
            "all": brain_sessions | conv_sessions | db_sessions
        }

    def _find_and_purge_new(self, before_snapshot: Dict[str, Set[str]], passes: int = 2) -> Set[str]:
        all_purged: Set[str] = set()
        delays = [0.05, 0.1]
        for p in range(passes):
            delay = delays[p] if p < len(delays) else 0.05
            time.sleep(delay)
            after_snapshot = self._snapshot_sessions()
            new_sessions = (after_snapshot["all"] - before_snapshot["all"])
            new_sessions = {s for s in new_sessions if s and s not in PROTECTED_CONV_IDS}
            if new_sessions:
                purge_sessions(new_sessions)
                all_purged.update(new_sessions)
        return all_purged

    def stage1_art_director(
        self,
        user_prompt: str,
        override_template: Optional[str] = None,
        override_ratio: Optional[str] = None,
        timeout_sec: int = 60
    ) -> Dict[str, Any]:
        """
        Lớp 1: AI Art Director suy luận ngữ cảnh sâu qua agy CLI.
        Nhìn vào kho tri thức awesome-gpt-image-2 để nhận diện thể loại, template, aspect ratio,
        và biên dịch Master Prompt đỉnh cao (HOÀN TOÀN KHÔNG HARDCODE).
        Xóa sạch session Lớp 1 ngay sau khi nhận kết quả.
        """
        before_snapshot = self._snapshot_sessions()
        agy_bin = shutil.which("agy") or os.path.expanduser("~/.local/bin/agy")

        system_instruction = self.template_engine.build_director_instruction()
        
        constraints = []
        if override_template and override_template != "auto":
            constraints.append(f"CONSTRAIN TO TEMPLATE ID: \"{override_template}\"")
        if override_ratio and override_ratio != "auto":
            constraints.append(f"CONSTRAIN TO ASPECT RATIO: \"{override_ratio}\"")
        constraint_str = "\n".join(constraints)

        full_prompt = (
            f"{system_instruction}\n\n"
            f"USER REQUEST: \"{user_prompt}\"\n"
            f"{constraint_str}\n\n"
            f"Respond with ONLY valid JSON object:"
        )

        cmd = [
            agy_bin,
            "-p", full_prompt,
            "--model", "gemini-3.8-flash-low",
            "--disable-slash-commands",
            "--output-format", "json",
            "--dangerously-skip-permissions"
        ]
        env = os.environ.copy()
        env["CLOUD_CODE_URL"] = f"http://127.0.0.1:{self.proxy_port}"

        created_conv_id = None
        stdout = ""
        try:
            res = subprocess.run(cmd, env=env, cwd="/tmp", capture_output=True, text=True, timeout=timeout_sec)
            raw_stdout = (res.stdout or "").strip()
            try:
                cli_data = json.loads(raw_stdout)
                if isinstance(cli_data, dict):
                    created_conv_id = cli_data.get("conversation_id")
                    stdout = cli_data.get("response", "")
            except Exception:
                stdout = raw_stdout
        except Exception as e:
            print(f"[Stage1 Director] CLI invocation failed: {e}. Using knowledge base fallback.", file=sys.stderr)
            fallback = self.template_engine.fallback_detect_template(user_prompt)
            return self.template_engine.enrich_prompt_with_knowledge_base(
                user_prompt=user_prompt,
                detected_category=fallback["category"],
                template_id=fallback["template_id"],
                aspect_ratio=fallback["aspect_ratio"],
                art_direction_reasoning=fallback["art_direction_reasoning"],
                initial_master_prompt=fallback["master_prompt"]
            )
        finally:
            if created_conv_id and created_conv_id not in PROTECTED_CONV_IDS:
                purge_sessions({created_conv_id})
            self._find_and_purge_new(before_snapshot)

        # Parse JSON from stdout
        try:
            # Extract JSON block
            json_match = re.search(r"\{[\s\S]*\}", stdout)
            if json_match:
                parsed = json.loads(json_match.group(0))
                category = parsed.get("category", "Charts & Infographics")
                template_id = parsed.get("template_id", "infographic-engine")
                aspect_ratio = parsed.get("aspect_ratio", "16:9")
                art_direction_reasoning = parsed.get("art_direction_reasoning", "Tối ưu hóa bố cục trực quan hóa thông tin doanh nghiệp.")
                master_prompt = parsed.get("master_prompt", user_prompt)

                # Kiểm tra override nếu có
                if override_ratio and override_ratio != "auto":
                    aspect_ratio = override_ratio
                if override_template and override_template != "auto":
                    template_id = override_template

                # Đối chiếu và củng cố bằng kho tri thức awesome-gpt-image-2
                enriched = self.template_engine.enrich_prompt_with_knowledge_base(
                    user_prompt=user_prompt,
                    detected_category=category,
                    template_id=template_id,
                    aspect_ratio=aspect_ratio,
                    art_direction_reasoning=art_direction_reasoning,
                    initial_master_prompt=master_prompt
                )
                return enriched
        except Exception as e:
            print(f"[Stage1 Director] JSON parse error: {e}, raw stdout: {stdout[:250]}", file=sys.stderr)

        # Fallback if parsing failed
        fallback = self.template_engine.fallback_detect_template(user_prompt)
        return self.template_engine.enrich_prompt_with_knowledge_base(
            user_prompt=user_prompt,
            detected_category=fallback["category"],
            template_id=fallback["template_id"],
            aspect_ratio=fallback["aspect_ratio"],
            art_direction_reasoning=fallback["art_direction_reasoning"],
            initial_master_prompt=fallback["master_prompt"]
        )

    def stage2_generate_image(
        self,
        master_prompt: str,
        aspect_ratio: str = "16:9",
        image_name: Optional[str] = None,
        timeout_sec: int = 180
    ) -> Dict[str, Any]:
        """
        Lớp 2: Thực thi render ảnh qua agy CLI generate_image tool, trích xuất ảnh và xóa sạch session.
        """
        start_time = time.time()
        safe_name = (image_name or "diag_" + uuid.uuid4().hex[:8]).replace(" ", "_")
        safe_name = "".join(c for c in safe_name if c.isalnum() or c in ("_", "-"))

        before_snapshot = self._snapshot_sessions()
        agy_bin = shutil.which("agy") or os.path.expanduser("~/.local/bin/agy")

        cli_prompt = (
            f"Use generate_image tool with:\n"
            f"Prompt: {master_prompt}\n"
            f"ImageName: {safe_name}\n"
            f"AspectRatio: {aspect_ratio}\n"
            f"Only call the tool and return the output path."
        )

        cmd = [agy_bin, "-p", cli_prompt, "--dangerously-skip-permissions"]
        env = os.environ.copy()
        env["CLOUD_CODE_URL"] = f"http://127.0.0.1:{self.proxy_port}"

        try:
            res = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=timeout_sec)
            stdout = res.stdout or ""
            stderr = res.stderr or ""
        except subprocess.TimeoutExpired:
            self._find_and_purge_new(before_snapshot)
            return {"success": False, "error": f"Diagram rendering timed out after {timeout_sec}s"}
        except Exception as e:
            self._find_and_purge_new(before_snapshot)
            return {"success": False, "error": str(e)}

        # Tìm ảnh được sinh ra trong các session mới hoặc trong stdout
        after_snapshot = self._snapshot_sessions()
        new_sessions = after_snapshot["all"] - before_snapshot["all"]

        found_image_path = None
        for sid in new_sessions:
            s_dir = os.path.join(BRAIN_DIR, sid)
            if os.path.exists(s_dir):
                for root, _, files in os.walk(s_dir):
                    for f in files:
                        if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
                            found_image_path = os.path.join(root, f)
                            break
                    if found_image_path:
                        break
            if found_image_path:
                break

        if not found_image_path:
            matches = re.findall(r"file://([^\s\)\'\"]+)", stdout)
            for m in matches:
                if m.lower().endswith((".png", ".jpg", ".jpeg", ".webp")) and os.path.exists(m):
                    found_image_path = m
                    break

        if not found_image_path:
            self._find_and_purge_new(before_snapshot)
            return {
                "success": False,
                "error": "No diagram image generated by agy CLI",
                "stdout": stdout,
                "stderr": stderr
            }

        # Lưu ảnh sang persistent storage
        ext = os.path.splitext(found_image_path)[1] or ".png"
        dest_filename = f"{safe_name}_{int(time.time()*1000)}{ext}"
        dest_path = os.path.join(self.storage_dir, dest_filename)
        shutil.copy2(found_image_path, dest_path)

        # Xóa sạch toàn bộ session rác
        purged = self._find_and_purge_new(before_snapshot)
        elapsed = round(time.time() - start_time, 2)

        return {
            "success": True,
            "filename": dest_filename,
            "file_path": dest_path,
            "relative_url": f"/diagrams/{dest_filename}",
            "aspect_ratio": aspect_ratio,
            "duration_sec": elapsed,
            "session_id": list(purged)[0] if purged else "purged",
            "session_cleaned": True
        }

    def generate_diagram_two_stage(
        self,
        user_prompt: str,
        template_id: Optional[str] = "auto",
        aspect_ratio: Optional[str] = "auto",
        image_name: Optional[str] = None,
        timeout_sec: int = 180
    ) -> Dict[str, Any]:
        """
        Quy trình khép kín 2 giai đoạn:
        Giai đoạn 1: AI Art Director suy luận ngữ cảnh sâu và chọn template từ awesome-gpt-image-2 qua agy CLI.
        Giai đoạn 2: Tạo ảnh chất lượng cao và dọn sạch session 100%.
        """
        start_all = time.time()

        # 1. Giai đoạn 1: AI Art Director nhận diện yêu cầu qua agy CLI
        director_res = self.stage1_art_director(
            user_prompt=user_prompt,
            override_template=template_id,
            override_ratio=aspect_ratio
        )

        chosen_ratio = director_res.get("aspect_ratio", "16:9")
        master_prompt = director_res.get("master_prompt", user_prompt)

        # 2. Giai đoạn 2: Precision Image Generator
        render_res = self.stage2_generate_image(
            master_prompt=master_prompt,
            aspect_ratio=chosen_ratio,
            image_name=image_name,
            timeout_sec=timeout_sec
        )

        total_elapsed = round(time.time() - start_all, 2)

        if not render_res.get("success"):
            return {
                "success": False,
                "error": render_res.get("error", "Image generation failed"),
                "stage1_director": director_res
            }

        return {
            "success": True,
            "filename": render_res["filename"],
            "file_path": render_res["file_path"],
            "relative_url": render_res["relative_url"],
            "aspect_ratio": render_res["aspect_ratio"],
            "duration_sec": total_elapsed,
            "session_cleaned": True,
            "category": director_res.get("category"),
            "template_id": director_res.get("template_id"),
            "template_title": director_res.get("template_title"),
            "art_direction_reasoning": director_res.get("art_direction_reasoning"),
            "master_prompt": master_prompt,
            "original_prompt": user_prompt,
            "guidance": director_res.get("guidance", []),
            "reference_cases": director_res.get("reference_cases", [])
        }

    def execute_text_prompt(self, prompt: str, timeout_sec: int = 45) -> str:
        """Thực thi prompt văn bản qua agy CLI và xóa session ngay lập tức."""
        before_snapshot = self._snapshot_sessions()
        agy_bin = shutil.which("agy") or os.path.expanduser("~/.local/bin/agy")

        cmd = [
            agy_bin,
            "-p", prompt,
            "--model", "gemini-3.8-flash-low",
            "--disable-slash-commands",
            "--output-format", "json",
            "--dangerously-skip-permissions"
        ]
        env = os.environ.copy()
        env["CLOUD_CODE_URL"] = f"http://127.0.0.1:{self.proxy_port}"

        created_conv_id = None
        try:
            res = subprocess.run(cmd, env=env, cwd="/tmp", capture_output=True, text=True, timeout=timeout_sec)
            raw_stdout = (res.stdout or "").strip()
            try:
                cli_data = json.loads(raw_stdout)
                if isinstance(cli_data, dict):
                    created_conv_id = cli_data.get("conversation_id")
                    response_text = cli_data.get("response", "")
                    return response_text
            except Exception:
                pass
            return raw_stdout
        except Exception as e:
            print(f"[AgyExecutor] execute_text_prompt failed: {e}", file=sys.stderr)
            return ""
        finally:
            if created_conv_id and created_conv_id not in PROTECTED_CONV_IDS:
                purge_sessions({created_conv_id})
            self._find_and_purge_new(before_snapshot)
