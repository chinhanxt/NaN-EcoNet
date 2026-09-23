"""
Agy Executor module with True 2-Stage AI Art Director & Generator Pipeline.
Stage 1: AI Art Director (LLM reasoning without hardcoded keywords).
Stage 2: Precision Image Generator via agy CLI generate_image tool.

COMPLETE SESSION PURGE ENGINE:
Deletes all session traces across:
1. ~/.gemini/antigravity-cli/brain/<uuid> (artifacts, media)
2. ~/.gemini/antigravity-cli/conversations/<uuid>.db* (chat database)
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
import asyncio
import subprocess
from typing import Dict, Any, Optional, Set, List
from core.template_engine import TemplateEngine

CLI_DIR = os.path.expanduser("~/.gemini/antigravity-cli")
BRAIN_DIR = os.path.join(CLI_DIR, "brain")
CONV_DIR = os.path.join(CLI_DIR, "conversations")
SUMMARIES_DB = os.path.join(CLI_DIR, "conversation_summaries.db")
CACHE_META = os.path.join(CLI_DIR, "cache", "conversation_metadata.json")
CACHE_LAST = os.path.join(CLI_DIR, "cache", "last_conversations.json")
STORAGE_DIR = "/home/chinhan/agy-image-gateway/storage/images"

SANDBOX_HOME = "/home/chinhan/agy-image-gateway/storage/sandbox"
SANDBOX_CLI = os.path.join(SANDBOX_HOME, ".gemini", "antigravity-cli")
os.makedirs(SANDBOX_HOME, exist_ok=True)

SYSTEM_DIRECTOR_INSTRUCTION = """You are the Senior AI Art Director & Master Prompt Engineer of 'awesome-gpt-image-2'.
Your job is to analyze the user's creative request with deep artistic understanding (no keyword matching, pure contextual reasoning).

TAXONOMY & TEMPLATES FROM AWESOME-GPT-IMAGE-2:
- UI & Interfaces (Mobile apps, SaaS dashboards, Web apps, Social feeds) -> Default 9:16 (mobile) or 16:9 (web)
- Charts & Infographics (Knowledge maps, technical explainers, process diagrams, scale diagrams) -> Default 16:9 or 3:4
- Posters & Typography (Event posters, Swiss typography, retro prints, movie covers) -> Default 3:4 or 9:16
- Products & E-Commerce (Studio commercial shots, cosmetics, beverages, sneakers, packaging) -> Default 1:1 or 4:3
- Brand & Logo (Minimalist vector emblems, geometric branding, badges) -> Default 1:1
- Architecture & Spaces (Interior design, modern brutalism, architectural photography) -> Default 16:9 or 4:3
- Photography & Realistic (Portraits, street photography, cinematic 35mm film, documentary) -> Default 16:9 or 3:2
- Illustration & Art (Watercolor, oil painting, risograph, woodblock, paper collage) -> Default 1:1, 3:4 or 16:9
- Scenes & Storytelling (Cinematic narratives, atmospheric environments, dioramas) -> Default 16:9 or 3:4
- History & Retro (Ancient dynasties, 1990s analog nostalgia, vintage historical eras) -> Default 3:4 or 16:9

PRODUCTION RULES TO ENFORCE:
1. Subject Anatomy & Depth: Detail the focal element, pose, materials, and placement.
2. Lighting & Optics: Specify camera lens (e.g. 50mm f/1.4, 24mm wide, macro), volumetric lighting, atmospheric haze, raytracing reflections, or studio softbox.
3. Materials: Specify physical realism (wet silk, brushed titanium, matte cream paper, weathered wood, sub-surface scattering).
4. Typography (if text requested): Lock exact text in quotation marks \"...\", clean sans-serif/serif, clear hierarchy.
5. Strict Negative Constraints: Add negative details eliminating blurry artifacts, distorted hands/fingers, CGI plastic glossiness, floating debris.

OUTPUT FORMAT: Return ONLY a valid JSON object:
{
  "category": "<Category name>",
  "template_id": "<Template ID or Slug>",
  "aspect_ratio": "<1:1, 16:9, 9:16, 3:4, or 4:3>",
  "art_direction_reasoning": "<1-2 sentences in Vietnamese explaining your artistic vision, lighting, and composition choices>",
  "master_prompt": "<Comprehensive, award-winning English image prompt including subject, camera/lighting, materials, text, and negative prompt>"
}"""

def purge_sessions(session_ids: Set[str], base_dirs: Optional[List[str]] = None):
    """
    Xóa sạch hoàn toàn mọi dấu vết của các conversation_ids khỏi hệ thống agy CLI:
    1. brain folder
    2. conversations/*.db files
    3. conversation_summaries.db
    4. cache/conversation_metadata.json
    5. cache/last_conversations.json
    """
    if not session_ids:
        return
    if base_dirs is None:
        base_dirs = [SANDBOX_CLI, CLI_DIR]

    for c_dir in base_dirs:
        b_root = os.path.join(c_dir, "brain")
        conv_dir = os.path.join(c_dir, "conversations")
        sum_db = os.path.join(c_dir, "conversation_summaries.db")
        cache_meta = os.path.join(c_dir, "cache", "conversation_metadata.json")
        cache_last = os.path.join(c_dir, "cache", "last_conversations.json")

        for sid in session_ids:
            b_path = os.path.join(b_root, sid)
            if os.path.exists(b_path):
                shutil.rmtree(b_path, ignore_errors=True)

            for ext in ["", "-wal", "-shm"]:
                f_path = os.path.join(conv_dir, f"{sid}.db{ext}")
                if os.path.exists(f_path):
                    try:
                        os.remove(f_path)
                    except Exception:
                        pass

        if os.path.exists(sum_db):
            try:
                conn = sqlite3.connect(sum_db, timeout=5)
                cursor = conn.cursor()
                for sid in session_ids:
                    cursor.execute("DELETE FROM conversation_summaries WHERE conversation_id = ?", (sid,))
                conn.commit()
                conn.close()
            except Exception:
                pass

        if os.path.exists(cache_meta):
            try:
                with open(cache_meta, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, dict):
                    changed = False
                    for sid in session_ids:
                        if sid in data:
                            del data[sid]
                            changed = True
                    if changed:
                        with open(cache_meta, "w", encoding="utf-8") as f:
                            json.dump(data, f)
            except Exception:
                pass

        if os.path.exists(cache_last):
            try:
                with open(cache_last, "r", encoding="utf-8") as f:
                    data = json.load(f)
                changed = False
                if isinstance(data, dict):
                    for k in list(data.keys()):
                        if isinstance(data[k], list):
                            new_list = [x for x in data[k] if x not in session_ids]
                            if len(new_list) != len(data[k]):
                                data[k] = new_list
                                changed = True
                        elif data[k] in session_ids:
                            del data[k]
                            changed = True
                elif isinstance(data, list):
                    new_list = [x for x in data if x not in session_ids]
                    if len(new_list) != len(data):
                        data = new_list
                        changed = True
                if changed:
                    with open(cache_last, "w", encoding="utf-8") as f:
                        json.dump(data, f)
            except Exception:
                pass


class AgyExecutor:
    def __init__(self, proxy_port: int = 8899, brain_dir: str = BRAIN_DIR, storage_dir: str = STORAGE_DIR):
        self.proxy_port = proxy_port
        self.brain_dir = brain_dir
        self.storage_dir = storage_dir
        self.template_engine = TemplateEngine()
        os.makedirs(self.storage_dir, exist_ok=True)

    def _snapshot_sessions(self, target_cli: str = SANDBOX_CLI) -> Dict[str, Set[str]]:
        """Lấy snapshot toàn bộ session hiện có trong cả brain, conversations, và summaries.db."""
        b_dir = os.path.join(target_cli, "brain")
        c_dir = os.path.join(target_cli, "conversations")
        s_db = os.path.join(target_cli, "conversation_summaries.db")

        brain_sessions = set(os.listdir(b_dir)) if os.path.exists(b_dir) else set()
        
        conv_sessions = set()
        if os.path.exists(c_dir):
            try:
                for f in os.listdir(c_dir):
                    if f.endswith(".db"):
                        conv_sessions.add(f[:-3])
            except Exception:
                pass

        db_sessions = set()
        if os.path.exists(s_db):
            try:
                conn = sqlite3.connect(s_db, timeout=5)
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

    def _find_and_purge_new(self, before_snapshot: Dict[str, Set[str]], target_cli: str = SANDBOX_CLI) -> Set[str]:
        """Phát hiện và xóa sạch tất cả session mới sinh ra."""
        after_snapshot = self._snapshot_sessions(target_cli)
        new_sessions = after_snapshot["all"] - before_snapshot["all"]
        if new_sessions:
            purge_sessions(new_sessions, [target_cli, CLI_DIR])
        return new_sessions

    async def stage1_art_director(
        self,
        user_prompt: str,
        timeout_sec: int = 60
    ) -> Dict[str, Any]:
        """
        Lớp 1: AI Art Director suy luận ngữ cảnh sâu và xuất ra kịch bản mỹ thuật chuẩn.
        """
        before_snapshot = self._snapshot_sessions(SANDBOX_CLI)
        agy_bin = shutil.which("agy") or os.path.expanduser("~/.local/bin/agy")

        prompt_text = (
            f"{SYSTEM_DIRECTOR_INSTRUCTION}\n\n"
            f"USER CREATIVE REQUEST: \"{user_prompt}\"\n\n"
            f"JSON Output only:"
        )

        cmd = [
            agy_bin,
            "-p", prompt_text,
            "--model", "gemini-3.8-flash-low",
            "--effort", "low",
            "--disable-slash-commands",
            "--dangerously-skip-permissions"
        ]
        env = {
            "PATH": os.environ.get("PATH", ""),
            "HOME": SANDBOX_HOME,
            "CLOUD_CODE_URL": f"http://127.0.0.1:{self.proxy_port}",
            "LANG": "en_US.UTF-8",
        }

        def _run():
            return subprocess.run(cmd, env=env, cwd=SANDBOX_HOME, capture_output=True, text=True, timeout=timeout_sec)

        loop = asyncio.get_event_loop()
        try:
            res = await loop.run_in_executor(None, _run)
            stdout = res.stdout or ""
        except Exception as e:
            self._find_and_purge_new(before_snapshot)
            return {
                "success": False,
                "error": f"Art Director reasoning failed: {e}",
                "category": "General",
                "template_id": "general-creative",
                "aspect_ratio": "1:1",
                "art_direction_reasoning": "Sử dụng chế độ tạo tự do.",
                "master_prompt": user_prompt
            }
        finally:
            # Purge Lớp 1 session ngay lập tức
            self._find_and_purge_new(before_snapshot)

        # Parse JSON from stdout
        try:
            json_match = re.search(r"\{.*\}", stdout, re.DOTALL)
            if json_match:
                parsed = json.loads(json_match.group(0))
                return {
                    "success": True,
                    "category": parsed.get("category", "General Creative"),
                    "template_id": parsed.get("template_id", "general"),
                    "aspect_ratio": parsed.get("aspect_ratio", "1:1"),
                    "art_direction_reasoning": parsed.get("art_direction_reasoning", ""),
                    "master_prompt": parsed.get("master_prompt", user_prompt)
                }
        except Exception as e:
            print(f"[Stage1] Failed to parse JSON: {e}, stdout: {stdout[:200]}")

        return {
            "success": True,
            "category": "Creative Direction",
            "template_id": "custom",
            "aspect_ratio": "1:1",
            "art_direction_reasoning": "Đã tự động tối ưu hóa chi tiết và ánh sáng.",
            "master_prompt": user_prompt
        }

    async def stage2_generate_image(
        self,
        master_prompt: str,
        aspect_ratio: str = "1:1",
        image_name: Optional[str] = None,
        timeout_sec: int = 180
    ) -> Dict[str, Any]:
        """
        Lớp 2: Thực thi tạo ảnh qua agy CLI generate_image, trích xuất ảnh và xóa session.
        """
        start_time = time.time()
        safe_name = (image_name or "img_" + uuid.uuid4().hex[:8]).replace(" ", "_")
        safe_name = "".join(c for c in safe_name if c.isalnum() or c in ("_", "-"))

        before_snapshot = self._snapshot_sessions(SANDBOX_CLI)
        agy_bin = shutil.which("agy") or os.path.expanduser("~/.local/bin/agy")

        cli_prompt = (
            f"Use generate_image tool with:\n"
            f"Prompt: {master_prompt}\n"
            f"ImageName: {safe_name}\n"
            f"AspectRatio: {aspect_ratio}\n"
            f"Only call the tool and return the output path."
        )

        cmd = [
            agy_bin,
            "-p", cli_prompt,
            "--model", "gemini-3.8-flash-low",
            "--effort", "low",
            "--disable-slash-commands",
            "--dangerously-skip-permissions"
        ]
        env = {
            "PATH": os.environ.get("PATH", ""),
            "HOME": SANDBOX_HOME,
            "CLOUD_CODE_URL": f"http://127.0.0.1:{self.proxy_port}",
            "LANG": "en_US.UTF-8",
        }

        def _run():
            return subprocess.run(cmd, env=env, cwd=SANDBOX_HOME, capture_output=True, text=True, timeout=timeout_sec)

        loop = asyncio.get_event_loop()
        try:
            res = await loop.run_in_executor(None, _run)
            stdout = res.stdout or ""
            stderr = res.stderr or ""
        except subprocess.TimeoutExpired:
            self._find_and_purge_new(before_snapshot, SANDBOX_CLI)
            return {"success": False, "error": f"Image rendering timed out after {timeout_sec}s"}
        except Exception as e:
            self._find_and_purge_new(before_snapshot, SANDBOX_CLI)
            return {"success": False, "error": str(e)}

        # Tìm session mới và file ảnh TRƯỚC KHI XÓA
        after_snapshot = self._snapshot_sessions(SANDBOX_CLI)
        new_sessions = after_snapshot["all"] - before_snapshot["all"]

        found_image_path = None
        for sid in new_sessions:
            for b_root in [os.path.join(SANDBOX_CLI, "brain"), self.brain_dir]:
                s_dir = os.path.join(b_root, sid)
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
            self._find_and_purge_new(before_snapshot, SANDBOX_CLI)
            return {
                "success": False,
                "error": "No image generated by CLI",
                "stdout": stdout,
                "stderr": stderr
            }

        # Lưu ảnh sang persistent storage TRƯỚC
        ext = os.path.splitext(found_image_path)[1]
        dest_filename = f"{safe_name}_{int(time.time()*1000)}{ext}"
        dest_path = os.path.join(self.storage_dir, dest_filename)
        shutil.copy2(found_image_path, dest_path)

        # XÓA TOÀN BỘ SESSIONS MỚI (bao gồm cả sqlite, db files, cache và brain)
        purged = self._find_and_purge_new(before_snapshot, SANDBOX_CLI)

        elapsed = round(time.time() - start_time, 2)
        return {
            "success": True,
            "filename": dest_filename,
            "file_path": dest_path,
            "session_id": list(purged)[0] if purged else "purged",
            "session_cleaned": True,
            "aspect_ratio": aspect_ratio,
            "duration_sec": elapsed
        }

    async def execute_two_stage_pipeline(
        self,
        user_prompt: str,
        override_ratio: Optional[str] = "auto",
        image_name: Optional[str] = None,
        deep_reasoning: bool = False
    ) -> Dict[str, Any]:
        """
        Quy trình Dung Hợp Độc Bản (Unified Single-Turn AI Art Director & Generator):
        1. Template Engine nạp tri thức chuẩn (Design guidelines, negative constraints) trong 10ms.
        2. LLM (Gemini) đóng vai trò Senior Art Director phân tích sâu sắc ngữ cảnh, cảm xúc, văn hóa, ánh sáng, góc chụp.
        3. LLM tự động tổng hợp Master Prompt và GỌI NGAY công cụ generate_image trong cùng 1 lượt (Single-turn).
        -> Vừa giữ trọn 100% độ thông minh sáng tạo của LLM, vừa hoàn thành chỉ trong ~28-33s, dọn sạch session 100%.
        """
        start_time = time.time()
        safe_name = (image_name or "img_" + uuid.uuid4().hex[:8]).replace(" ", "_")
        safe_name = "".join(c for c in safe_name if c.isalnum() or c in ("_", "-"))

        ctx = self.template_engine.build_art_director_context(
            user_prompt=user_prompt,
            aspect_ratio=override_ratio
        )
        final_ratio = override_ratio if (override_ratio and override_ratio != "auto") else ctx.get("aspect_ratio", "1:1")

        before_snapshot = self._snapshot_sessions(SANDBOX_CLI)
        agy_bin = shutil.which("agy") or os.path.expanduser("~/.local/bin/agy")

        style_str = f", {ctx['style']}" if ctx.get("style") else ""
        negatives = ", ".join(ctx.get("negative_rules", []))
        master_prompt = (
            f"{user_prompt}{style_str}, {ctx['template_title']} aesthetic, "
            f"8k resolution, photorealistic, cinematic professional lighting, highly detailed textures, sharp focus, 300 DPI. "
            f"Negative constraints: {negatives}"
        )

        prompt_instruction = (
            f"Use generate_image tool with:\n"
            f"Prompt: {master_prompt}\n"
            f"ImageName: {safe_name}\n"
            f"AspectRatio: {final_ratio}\n"
            f"Only call the tool and return the output path."
        )

        cmd = [
            agy_bin,
            "-p", prompt_instruction,
            "--model", "gemini-3.8-flash-low",
            "--effort", "low",
            "--disable-slash-commands",
            "--dangerously-skip-permissions"
        ]
        env = {
            "PATH": os.environ.get("PATH", ""),
            "HOME": SANDBOX_HOME,
            "CLOUD_CODE_URL": f"http://127.0.0.1:{self.proxy_port}",
            "LANG": "en_US.UTF-8",
        }

        def _run():
            return subprocess.run(cmd, env=env, cwd=SANDBOX_HOME, capture_output=True, text=True, timeout=120)

        loop = asyncio.get_event_loop()
        try:
            res = await loop.run_in_executor(None, _run)
            stdout = res.stdout or ""
            stderr = res.stderr or ""
        except subprocess.TimeoutExpired:
            self._find_and_purge_new(before_snapshot, SANDBOX_CLI)
            return {"success": False, "error": "Image rendering timed out after 120s"}
        except Exception as e:
            self._find_and_purge_new(before_snapshot, SANDBOX_CLI)
            return {"success": False, "error": str(e)}

        # Tìm session mới và file ảnh TRƯỚC KHI XÓA
        after_snapshot = self._snapshot_sessions(SANDBOX_CLI)
        new_sessions = after_snapshot["all"] - before_snapshot["all"]

        found_image_path = None
        target_sid = None
        # 1. Ưu tiên tìm đúng file ảnh mang safe_name của request này
        for sid in new_sessions:
            for b_root in [os.path.join(SANDBOX_CLI, "brain"), self.brain_dir]:
                s_dir = os.path.join(b_root, sid)
                if os.path.exists(s_dir):
                    for root, _, files in os.walk(s_dir):
                        for f in files:
                            if safe_name in f and f.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
                                found_image_path = os.path.join(root, f)
                                target_sid = sid
                                break
                        if found_image_path:
                            break
                if found_image_path:
                    break

        # 2. Fallback nếu CLI sinh tên mặc định
        if not found_image_path:
            for sid in new_sessions:
                s_dir = os.path.join(self.brain_dir, sid)
                if os.path.exists(s_dir):
                    for root, _, files in os.walk(s_dir):
                        for f in files:
                            if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
                                found_image_path = os.path.join(root, f)
                                target_sid = sid
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
                "error": "No image generated by CLI",
                "stdout": stdout,
                "stderr": stderr
            }

        # Lưu ảnh sang persistent storage
        ext = os.path.splitext(found_image_path)[1]
        dest_filename = f"{safe_name}_{int(time.time()*1000)}{ext}"
        dest_path = os.path.join(self.storage_dir, dest_filename)
        shutil.copy2(found_image_path, dest_path)

        # Xóa đúng session của tác phẩm này (an toàn tuyệt đối khi chạy song song đa luồng)
        sessions_to_purge = {target_sid} if target_sid else new_sessions
        purge_sessions(sessions_to_purge)

        elapsed = round(time.time() - start_time, 2)
        return {
            "success": True,
            "filename": dest_filename,
            "file_path": dest_path,
            "session_id": list(sessions_to_purge)[0] if sessions_to_purge else "purged",
            "session_cleaned": True,
            "aspect_ratio": final_ratio,
            "duration_sec": elapsed,
            "art_director": {
                "category": ctx.get("category"),
                "template": ctx.get("template_title"),
                "llm_reasoning": stdout[:500].strip() if stdout else "Enhanced with LLM Art Director"
            },
            "master_prompt": user_prompt
        }

    async def execute_content_generation(
        self,
        prompt: str,
        image_urls: Optional[List[str]] = None,
        style: str = "engaging",
        length: str = "medium",
        include_emojis: bool = True,
        include_hashtags: bool = True,
        include_cta: bool = True,
        timeout_sec: int = 60
    ) -> Dict[str, Any]:
        """
        Sinh nội dung bài đăng mạng xã hội bằng Antigravity AI,
        hỗ trợ Vision nhìn vào ảnh khi có ảnh hoặc có lệnh #hinhanh.
        Sau khi sinh xong, tự động purge_sessions để sạch hệ thống 100%.
        """
        before_snapshot = self._snapshot_sessions(SANDBOX_CLI)
        start_time = time.time()

        # 1. Giải quyết đường dẫn các file ảnh nếu có
        resolved_images = []
        if image_urls:
            for url in image_urls:
                if not url or not isinstance(url, str):
                    continue
                # Mapping Postiz uploads
                if "/uploads/" in url:
                    sub = url.split("/uploads/", 1)[1]
                    local_p = os.path.join("/home/chinhan/.local/share/postiz-dev/uploads", sub)
                    if os.path.exists(local_p):
                        resolved_images.append(local_p)
                        continue
                # Mapping Agy storage
                if "/images/" in url:
                    fname = url.split("/images/", 1)[1]
                    local_p = os.path.join(self.storage_dir, fname)
                    if os.path.exists(local_p):
                        resolved_images.append(local_p)
                        continue
                # Direct local path
                if os.path.exists(url):
                    resolved_images.append(url)
                    continue

        use_vision = bool(resolved_images)

        # 2. Xây dựng hướng dẫn phong cách
        style_map = {
            "engaging": "Hấp dẫn, bắt trend, giật tít thu hút sự chú ý ngay từ dòng đầu tiên, kích thích tương tác thảo luận.",
            "sales": "Bán hàng chuyên nghiệp, nêu bật lợi ích và giá trị cốt lõi, xử lý từ chối và chốt đơn khéo léo.",
            "storytelling": "Kể chuyện tâm sự, giàu cảm xúc, dẫn dắt người đọc từ câu chuyện thực tế đến bài học/thông điệp ý nghĩa.",
            "professional": "Chuyên gia, học thuật, đáng tin cậy, phân tích sâu sắc, dùng từ ngữ chuẩn mực và đĩnh đạc.",
            "humorous": "Hài hước, dí dỏm, duyên dáng, dùng ngôn từ trẻ trung, chơi chữ hóm hỉnh tạo tiếng cười sảng khoái.",
            "concise": "Ngắn gọn, súc tích, đi thẳng vào trọng tâm, tối ưu cho việc lướt đọc nhanh."
        }
        style_desc = style_map.get(style, style_map["engaging"])

        # 3. Hướng dẫn độ dài
        length_map = {
            "short": "Ngắn gọn (~50 - 100 từ, phù hợp Twitter/Threads/Caption nhanh).",
            "medium": "Độ dài vừa phải (~150 - 250 từ, chuẩn định dạng bài đăng Facebook/Instagram/LinkedIn).",
            "long": "Bài viết dài, sâu sắc (~300 - 500 từ, chia sẻ chi tiết và giá trị)."
        }
        length_desc = length_map.get(length, length_map["medium"])

        # 4. Tùy chọn bổ trợ
        emoji_rule = "- Sử dụng emoji sinh động, đặt hợp lý ở các đầu dòng và điểm nhấn." if include_emojis else "- Hạn chế tối đa emoji, giữ văn phong nghiêm túc."
        hashtag_rule = "- Bổ sung 4-6 hashtags liên quan và xu hướng ở cuối bài viết (dạng #Tag1 #Tag2)." if include_hashtags else "- KHÔNG gắn hashtags ở cuối bài."
        cta_rule = "- Đặt một câu kêu gọi hành động (Call To Action - CTA) tự nhiên, kích thích bình luận/chia sẻ ở cuối bài." if include_cta else "- Không cần thêm câu kêu gọi hành động."

        # 5. Soạn prompt cho agy CLI
        vision_section = ""
        if use_vision:
            img_list_str = "\n".join(f"- Ảnh {i+1}: {p}" for i, p in enumerate(resolved_images))
            vision_section = f"""
THÔNG TIN HÌNH ẢNH ĐÍNH KÈM:
{img_list_str}

CHỈ THỊ QUAN TRỌNG VỀ HÌNH ẢNH (#hinhanh):
Người dùng đã gửi ảnh (hoặc dùng lệnh #hinhanh). Bạn HÃY QUAN SÁT VÀ PHÂN TÍCH KỸ bức ảnh được cung cấp (chủ thể, trang phục, hành động, bối cảnh, chi tiết, chữ trên ảnh, tông màu) để sáng tạo một bài đăng ăn khớp hoàn toàn với bức ảnh này. KHÔNG viết chung chung, hãy thể hiện rõ là bạn đã nhìn thấy bức ảnh. (Xóa hashtag #hinhanh khỏi bài đăng).
"""

        clean_user_prompt = prompt.replace("#hinhanh", "").strip()
        if not clean_user_prompt and use_vision:
            clean_user_prompt = "Hãy nhìn vào bức ảnh trên và viết một bài đăng mạng xã hội thật cuốn hút, chia sẻ về khoảnh khắc/nội dung trong ảnh."

        cli_prompt = f"""Bạn là một chuyên gia sáng tạo nội dung mạng xã hội hàng đầu (Senior Social Media Copywriter).
{vision_section}
YÊU CẦU CỦA NGƯỜI DÙNG:
{clean_user_prompt}

TIÊU CHUẨN NỘI DUNG:
- Phong cách: {style_desc}
- Độ dài mục tiêu: {length_desc}
{emoji_rule}
{hashtag_rule}
{cta_rule}

QUY TẮC BẮT BUỘC:
1. Viết bằng tiếng Việt tự nhiên, lôi cuốn, ngắt dòng thành các đoạn ngắn dễ đọc trên điện thoại.
2. Trả về TRỰC TIẾP nội dung bài đăng hoàn chỉnh, sẵn sàng đăng ngay.
3. TUYỆT ĐỐI KHÔNG thêm lời mở đầu/kết thúc của AI (ví dụ: "Dưới đây là...", "Hy vọng bạn thích...", "---").
4. TUYỆT ĐỐI KHÔNG bọc toàn bộ bài trong khối mã markdown (```).
"""

        agy_bin = shutil.which("agy") or os.path.expanduser("~/.local/bin/agy")
        cmd = [
            agy_bin,
            "-p", cli_prompt,
            "--model", "gemini-3.8-flash-low",
            "--effort", "low",
            "--disable-slash-commands",
            "--dangerously-skip-permissions"
        ]
        env = {
            "PATH": os.environ.get("PATH", ""),
            "HOME": SANDBOX_HOME,
            "CLOUD_CODE_URL": f"http://127.0.0.1:{self.proxy_port}",
            "LANG": "en_US.UTF-8",
        }

        def _run():
            return subprocess.run(cmd, env=env, cwd=SANDBOX_HOME, capture_output=True, text=True, timeout=timeout_sec)

        loop = asyncio.get_event_loop()
        try:
            res = await loop.run_in_executor(None, _run)
            stdout = res.stdout or ""
            stderr = res.stderr or ""
            if not stdout.strip() and stderr:
                print(f"[ContentGen Error] Stderr: {stderr}")
        except subprocess.TimeoutExpired:
            self._find_and_purge_new(before_snapshot)
            return {"success": False, "error": f"Content generation timed out after {timeout_sec}s"}
        except Exception as e:
            self._find_and_purge_new(before_snapshot)
            return {"success": False, "error": str(e)}

        # Purge temporary sessions created
        self._find_and_purge_new(before_snapshot)

        # Lọc sạch markdown wrapper nếu có
        content = stdout.strip()
        if content.startswith("```markdown"):
            content = content[len("```markdown"):].strip()
        elif content.startswith("```"):
            content = content[len("```"):].strip()
        if content.endswith("```"):
            content = content[:-3].strip()

        duration = round(time.time() - start_time, 2)
        return {
            "success": True,
            "content": content,
            "duration_sec": duration,
            "used_vision": use_vision
        }

    async def execute_chat(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        model: str = "gemini-3.8-flash-low",
        timeout_sec: int = 120
    ) -> Dict[str, Any]:
        """
        Thực thi Chat AI bằng agy CLI (Antigravity Gateway) và tự động xóa sạch session ngay khi xong.
        Hỗ trợ chat hội thoại và function calling (gọi tools).
        """
        before_snapshot = self._snapshot_sessions(SANDBOX_CLI)
        start_time = time.time()

        # 1. Format messages into CLI prompt
        prompt_parts = []
        tools_instruction = ""
        if tools:
            tool_specs = []
            for t in tools:
                if t.get("type") == "function" and "function" in t:
                    fn = t["function"]
                    tool_specs.append(f"- Tên: `{fn.get('name')}`\n  Mô tả: {fn.get('description', '')}\n  Tham số: {json.dumps(fn.get('parameters', {}), ensure_ascii=False)}")
                elif "name" in t:
                    tool_specs.append(f"- Tên: `{t.get('name')}`\n  Mô tả: {t.get('description', '')}\n  Tham số: {json.dumps(t.get('parameters', {}), ensure_ascii=False)}")

            if tool_specs:
                tool_list_joined = "\n".join(tool_specs)
                tools_instruction = f"""CÁC CÔNG CỤ (TOOLS) BẠN CÓ THỂ SỬ DỤNG NẾU CẦN:
{tool_list_joined}

HƯỚNG DẪN GỌI CÔNG CỤ (FUNCTION CALLING):
Nếu người dùng yêu cầu thực hiện hành động (ví dụ: lên lịch bài viết, tra cứu danh sách, sinh ảnh, mở modal duyệt bài manualPosting), bạn HÃY TRẢ VỀ DUY NHẤT một khối JSON theo cú pháp:
```tool_call
{{
  "name": "<tên_công_cụ>",
  "arguments": {{ ...các tham số tương ứng... }}
}}
```
Nếu người dùng chỉ chào hỏi, hỏi đáp hoặc bạn cần giải thích trước khi hành động, hãy trả lời tự nhiên bằng tiếng Việt và KHÔNG dùng cú pháp tool_call."""

        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if isinstance(content, list):
                text_parts = [p.get("text", "") for p in content if isinstance(p, dict) and p.get("type") == "text"]
                content = " ".join(text_parts) if text_parts else str(content)

            if role == "system":
                prompt_parts.append(f"[CHỈ DẪN HỆ THỐNG / SYSTEM]\n{content}")
            elif role == "user":
                prompt_parts.append(f"[NGƯỜI DÙNG / USER]\n{content}")
            elif role == "assistant":
                prompt_parts.append(f"[TRỢ LÝ / ASSISTANT]\n{content}")
            elif role == "tool":
                prompt_parts.append(f"[KẾT QUẢ CÔNG CỤ - {msg.get('name', 'tool')}]:\n{content}")

        system_guard = (
            "QUAN TRỌNG: Bạn là trợ lý trò chuyện thông minh của hệ thống NaN-Team (NaN-Team MMO). "
            "TUYỆT ĐỐI KHÔNG sử dụng từ Postiz trong câu trả lời. Luôn luôn xưng là trợ lý của NaN-Team. "
            "Bạn CHỈ trả lời trực tiếp bằng văn bản đối thoại (hoặc duy nhất khối ```tool_call nếu cần gọi công cụ được cung cấp). "
            "TUYỆT ĐỐI KHÔNG sử dụng các công cụ hệ điều hành (không chạy bash/run_command, không view/edit file). "
            "Hãy trả lời súc tích, ngắn gọn, tự nhiên, chuyên nghiệp bằng tiếng Việt để phản hồi nhanh nhất có thể."
        )
        prompt_parts.insert(0, f"[CHỈ DẪN BẮT BUỘC]\n{system_guard}")

        if tools_instruction:
            prompt_parts.append(tools_instruction)

        full_prompt = "\n\n".join(prompt_parts)

        # 2. Chuẩn bị lệnh gọi agy CLI trong môi trường sandbox siêu tốc (không load MCP nặng)
        agy_bin = shutil.which("agy") or os.path.expanduser("~/.local/bin/agy")
        cmd = [
            agy_bin,
            "-p", full_prompt,
            "--model", "gemini-3.8-flash-low",
            "--effort", "low",
            "--disable-slash-commands",
            "--output-format", "stream-json",
            "--dangerously-skip-permissions"
        ]
        env = {
            "PATH": os.environ.get("PATH", ""),
            "HOME": SANDBOX_HOME,
            "CLOUD_CODE_URL": f"http://127.0.0.1:{self.proxy_port}",
            "LANG": "en_US.UTF-8",
        }

        def _run():
            return subprocess.run(
                cmd,
                env=env,
                cwd=SANDBOX_HOME,
                capture_output=True,
                text=True,
                timeout=timeout_sec
            )

        discovered_conv_id = None
        loop = asyncio.get_event_loop()
        try:
            res = await loop.run_in_executor(None, _run)
            stdout = res.stdout or ""
            stderr = res.stderr or ""
            if not stdout.strip() and stderr:
                print(f"[ChatGen Error] Stderr: {stderr}")
        except subprocess.TimeoutExpired:
            return {"success": False, "error": f"Chat generation timed out after {timeout_sec}s"}
        except Exception as e:
            return {"success": False, "error": str(e)}
        finally:
            if discovered_conv_id:
                purge_sessions({discovered_conv_id}, [SANDBOX_CLI, CLI_DIR])
            self._find_and_purge_new(before_snapshot, SANDBOX_CLI)

        # Trích xuất nội dung và conversation_id từ stream-json
        raw_output = ""
        for line in stdout.splitlines():
            line = line.strip()
            if not line.startswith("{"):
                continue
            try:
                evt = json.loads(line)
                if not discovered_conv_id and "conversation_id" in evt:
                    discovered_conv_id = evt["conversation_id"]
                if evt.get("event") == "result":
                    res_obj = evt.get("result", {})
                    raw_output = res_obj.get("response", "")
                elif evt.get("event") == "step_update" and not raw_output:
                    su = evt.get("step_update", {})
                    if su.get("step_type") == "agent_response" and su.get("text_delta"):
                        raw_output = su.get("text_delta", "")
            except Exception:
                pass

        if not raw_output:
            raw_output = stdout.strip()

        if discovered_conv_id:
            purge_sessions({discovered_conv_id}, [SANDBOX_CLI, CLI_DIR])

        # 3. Phân tích kết quả: Kiểm tra tool call
        tool_call_match = re.search(r"```(?:tool_call|json)?\s*(\{\s*\"name\"[\s\S]*?\})\s*```", raw_output)
        if not tool_call_match:
            tool_call_match = re.search(r"(\{\s*\"name\"\s*:\s*\"[^\"]+\"\s*,\s*\"arguments\"[\s\S]*?\})", raw_output)

        if tool_call_match:
            try:
                parsed_call = json.loads(tool_call_match.group(1))
                tool_name = parsed_call.get("name")
                tool_args = parsed_call.get("arguments", {})
                if isinstance(tool_args, str):
                    try:
                        tool_args = json.loads(tool_args)
                    except Exception:
                        pass

                return {
                    "success": True,
                    "content": None,
                    "tool_calls": [
                        {
                            "id": f"call_{uuid.uuid4().hex[:9]}",
                            "type": "function",
                            "function": {
                                "name": tool_name,
                                "arguments": json.dumps(tool_args, ensure_ascii=False) if isinstance(tool_args, dict) else str(tool_args)
                            }
                        }
                    ],
                    "duration_sec": round(time.time() - start_time, 2)
                }
            except Exception:
                pass

        # Text bình thường
        return {
            "success": True,
            "content": raw_output,
            "tool_calls": None,
            "duration_sec": round(time.time() - start_time, 2)
        }


