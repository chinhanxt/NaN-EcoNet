"""
Template Engine module for Agy Image Gateway.
Loads and applies prompt schemas, 541+ cases & templates from awesome-gpt-image-2.
Includes Agent Auto-Detection and Elite Art Director Prompt Compilation.
"""

import json
import os
import re
from typing import Dict, List, Optional, Any, Tuple

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
if not os.path.exists(DATA_DIR):
    DATA_DIR = "/home/chinhan/awesome-gpt-image-2/data"

REPO_PATH = BASE_DIR
STYLE_LIB_PATH = os.path.join(DATA_DIR, "style-library.json")
CASES_PATH = os.path.join(DATA_DIR, "cases.json")

class TemplateEngine:
    def __init__(self, style_lib_path: str = STYLE_LIB_PATH, cases_path: str = CASES_PATH):
        self.style_lib_path = style_lib_path
        self.cases_path = cases_path
        self.data: Dict[str, Any] = {}
        self.templates: List[Dict[str, Any]] = []
        self.categories: List[Dict[str, Any]] = []
        self.styles: List[str] = []
        self.scenes: List[str] = []
        self.cases: List[Dict[str, Any]] = []
        self.cases_dict: Dict[int, Dict[str, Any]] = {}
        self.load()

    def load(self):
        # 1. Load Style Library
        if os.path.exists(self.style_lib_path):
            try:
                with open(self.style_lib_path, "r", encoding="utf-8") as f:
                    self.data = json.load(f)
                    self.templates = self.data.get("templates", [])
                    self.categories = self.data.get("categories", [])
                    self.styles = self.data.get("styles", [])
                    self.scenes = self.data.get("scenes", [])
            except Exception as e:
                print(f"[TemplateEngine] Error loading {self.style_lib_path}: {e}")

        # 2. Load 541+ Cases
        if os.path.exists(self.cases_path):
            try:
                with open(self.cases_path, "r", encoding="utf-8") as f:
                    cdata = json.load(f)
                    self.cases = cdata.get("cases", []) if isinstance(cdata, dict) else cdata
                    for c in self.cases:
                        cid = c.get("id")
                        if cid is not None:
                            self.cases_dict[cid] = c
            except Exception as e:
                print(f"[TemplateEngine] Error loading {self.cases_path}: {e}")

    def list_templates(self) -> List[Dict[str, Any]]:
        return self.templates

    def list_categories(self) -> List[Dict[str, Any]]:
        return self.categories

    def list_styles(self) -> List[str]:
        return self.styles

    def get_template(self, template_id: str) -> Optional[Dict[str, Any]]:
        for t in self.templates:
            if t.get("id") == template_id or t.get("anchor") == template_id:
                return t
        return None

    def get_cases(
        self,
        category: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Dict[str, Any]:
        """Lọc và phân trang danh sách 541+ cases."""
        filtered = self.cases
        if category and category.lower() != "all":
            filtered = [
                c for c in filtered 
                if c.get("category") == category or c.get("categoryAnchor") == category
            ]

        if search:
            q = search.lower().strip()
            def match(c):
                text = " ".join([
                    str(c.get("title", "")),
                    str(c.get("prompt", "")),
                    str(c.get("category", "")),
                    " ".join(c.get("tags", []))
                ]).lower()
                return q in text
            filtered = [c for c in filtered if match(c)]

        total = len(filtered)
        paginated = filtered[offset : offset + limit]

        items = []
        for c in paginated:
            img = c.get("image", "")
            if img.startswith("/images/"):
                img = "/repo-assets/" + img[len("/images/"):]
            item = dict(c)
            item["image"] = img
            items.append(item)

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "items": items
        }

    def get_case(self, case_id: int) -> Optional[Dict[str, Any]]:
        c = self.cases_dict.get(case_id)
        if c:
            item = dict(c)
            img = item.get("image", "")
            if img.startswith("/images/"):
                item["image"] = "/repo-assets/" + img[len("/images/"):]
            return item
        return None

    def agent_auto_detect(self, prompt: str) -> Dict[str, Any]:
        """
        AI Agent tự động phân tích prompt của người dùng:
        - Nhận diện thể loại
        - Chọn Template công nghiệp tối ưu từ repo awesome-gpt-image-2
        - Đề xuất Aspect Ratio chuẩn
        """
        p_lower = prompt.lower()

        intent = "general"
        template_id = "poster-layout-system"
        category_name = "General Creative"
        recommended_ratio = "1:1"
        style_rec = "High Quality Digital Art"
        reasoning = "Ý tưởng sáng tạo tự do."

        # 1. UI / Mobile / Web
        if any(w in p_lower for w in [
            "ui", "ux", "app", "mobile", "ios", "android", "dashboard", 
            "giao diện", "màn hình", "web", "website", "chat", "saas", 
            "screenshot", "bảng điều khiển", "iphone"
        ]):
            intent = "ui"
            template_id = "ui-screenshot-system"
            category_name = "UI & Interfaces"
            recommended_ratio = "9:16" if any(w in p_lower for w in ["app", "mobile", "ios", "android", "điện thoại", "iphone"]) else "16:9"
            style_rec = "Modern Clean UI, Dark/Light Mode, Precise Typography"
            reasoning = "Phát hiện từ khóa giao diện ứng dụng/web. Áp dụng template 'UI Screenshot System' với tỷ lệ tối ưu và layout chuẩn mực."

        # 2. Infographic / Sơ đồ / Biểu đồ
        elif any(w in p_lower for w in [
            "infographic", "sơ đồ", "biểu đồ", "quy trình", "flowchart", 
            "diagram", "mindmap", "kiến trúc", "giải thích", "chart", 
            "timeline", "bản đồ", "kiến thức"
        ]):
            intent = "infographic"
            template_id = "infographic-engine"
            category_name = "Charts & Infographics"
            recommended_ratio = "16:9" if "ngang" in p_lower else "3:4"
            style_rec = "Structured Infographic, Vector Glyphs, Clear Information Hierarchy"
            reasoning = "Phát hiện nhu cầu trực quan hóa thông tin. Chọn 'Infographic Engine' với 3-5 module rõ ràng, hạn chế đoạn văn dài."

        # 3. Poster / Typography / Banner / Sale
        elif any(w in p_lower for w in [
            "poster", "áp phích", "banner", "chữ", "typography", "sự kiện", 
            "quảng cáo", "sale", "cover", "bìa", "triển lãm", "typography art"
        ]):
            intent = "poster"
            template_id = "poster-layout-system"
            category_name = "Posters & Typography"
            recommended_ratio = "3:4"
            style_rec = "Swiss Typography, Bold Headline, Strict Grid Layout"
            reasoning = "Phát hiện mục tiêu poster/quảng cáo. Áp dụng 'Poster Layout System' với tương phản chữ - hình mạnh mẽ, tránh bố cục rác."

        # 4. Sản phẩm / E-commerce / Mockup
        elif any(w in p_lower for w in [
            "sản phẩm", "chai", "hộp", "giày", "bao bì", "product", "bottle", 
            "packaging", "sneaker", "mockup", "thương mại", "mỹ phẩm", "nước hoa", "đồ uống"
        ]):
            intent = "product"
            template_id = "product-commercial-shot"
            category_name = "Products & E-Commerce"
            recommended_ratio = "1:1" if "vuông" in p_lower else "4:3"
            style_rec = "Commercial Studio Lighting, Soft Reflections, Crisp Product Rendering"
            reasoning = "Phát hiện ảnh chụp sản phẩm thương mại. Cấu hình ánh sáng studio mềm và độ phản chiếu vật liệu chân thực."

        # 5. Logo / Brand / Icon
        elif any(w in p_lower for w in [
            "logo", "biểu trưng", "nhận diện", "brand", "icon", "vector logo", 
            "minimal logo", "brandmark", "huy hiệu"
        ]):
            intent = "brand"
            template_id = "brand-identity-system"
            category_name = "Brand & Logo"
            recommended_ratio = "1:1"
            style_rec = "Minimalist Vector, Geometric Precision, Scalable Emblem"
            reasoning = "Phát hiện thiết kế logo/nhận diện. Áp dụng chuẩn tối giản hình khối vectơ, đường nét dứt khoát."

        # 6. Nhiếp ảnh chân thực / Điện ảnh
        elif any(w in p_lower for w in [
            "chân dung", "portrait", "nhiếp ảnh", "photo", "camera", "chụp", 
            "điện ảnh", "cinematic", "realistic", "ảnh chụp", "street photography"
        ]):
            intent = "photo"
            template_id = "cinematic-photography"
            category_name = "Photography & Portraits"
            recommended_ratio = "16:9" if "điện ảnh" in p_lower or "cinematic" in p_lower else "3:2"
            style_rec = "Cinematic 35mm film shot, 8k resolution, authentic skin texture"
            reasoning = "Phát hiện phong cách nhiếp ảnh chân thực. Cấu hình tiêu cự ống kính, khẩu độ xóa phông và ánh sáng tự nhiên."

        # 7. 3D / Diorama / Cắt giấy
        elif any(w in p_lower for w in [
            "3d", "diorama", "paper cut", "giấy cắt", "miniature", "isometric", 
            "mô hình", "clay", "đất sét", "origami"
        ]):
            intent = "diorama"
            template_id = "3d-diorama-system"
            category_name = "3D & Dioramas"
            recommended_ratio = "1:1"
            style_rec = "Layered Paper Cutout, Volumetric Depth, Miniature Lighting"
            reasoning = "Phát hiện phong cách không gian 3D/Diorama thủ công độc đáo với hiệu ứng phân lớp chiều sâu."

        return {
            "intent": intent,
            "template_id": template_id,
            "category": category_name,
            "recommended_ratio": recommended_ratio,
            "recommended_style": style_rec,
            "reasoning": reasoning
        }

    def build_art_director_context(
        self,
        user_prompt: str,
        template_id: Optional[str] = None,
        style: Optional[str] = None,
        aspect_ratio: Optional[str] = "auto"
    ) -> Dict[str, Any]:
        """
        Xây dựng toàn bộ chỉ dẫn của một Senior Art Director dựa trên kho tri thức awesome-gpt-image-2:
        - Rules & Guidance từ template
        - Pitfalls (Lỗi sai cần tránh triệt để)
        - Reference Case Prompts thực tế từ 541+ cases
        """
        detection = self.agent_auto_detect(user_prompt)
        if not template_id or template_id == "auto":
            template_id = detection.get("template_id")
        if not style:
            style = detection.get("recommended_style")
        if not aspect_ratio or aspect_ratio == "auto":
            aspect_ratio = detection.get("recommended_ratio", "1:1")

        tpl = self.get_template(template_id)
        if not tpl and self.templates:
            tpl = self.templates[0]

        tpl_title = tpl.get("title", {}).get("en") or tpl.get("id") if tpl else "Custom Visual Engine"
        category = tpl.get("category", "General") if tpl else "General"
        tags = ", ".join(tpl.get("tags", [])) if tpl else ""
        guidance_list = tpl.get("guidance", {}).get("en", []) if tpl else []
        pitfalls_list = tpl.get("pitfalls", {}).get("en", []) if tpl else []
        # Quét nhanh 541+ cases trong bộ nhớ RAM theo độ tương đồng ngữ cảnh (chỉ mất ~1ms)
        best_cases = []
        p_words = set(re.findall(r"\w+", user_prompt.lower()))
        scored = []
        for c in self.cases:
            score = 0
            if category and c.get("category") == category:
                score += 1
            c_text = (c.get("title", "") + " " + " ".join(c.get("tags", [])) + " " + c.get("prompt", "")[:120]).lower()
            for w in p_words:
                if len(w) > 2 and w in c_text:
                    score += 2
            if score > 1:
                scored.append((score, c))
        scored.sort(key=lambda x: x[0], reverse=True)
        if scored:
            best_cases = [c for _, c in scored[:2]]
        else:
            cat_cases = [c for c in self.cases if c.get("category") == category]
            best_cases = cat_cases[:2] if cat_cases else self.cases[:2]

        ref_cases_snippets = []
        for c in best_cases:
            prompt_snip = c.get("prompt", "").strip()
            if len(prompt_snip) > 350:
                prompt_snip = prompt_snip[:350] + "..."
            ref_cases_snippets.append(f"Case #{c.get('id')} ({c.get('title')}):\n{prompt_snip}")

        # Thêm các quy tắc Negative Constraints bắt buộc từ repo
        negative_rules = [
            "NO blurry or smudged textures",
            "NO garbled, unreadable or random pseudo-letters",
            "NO anatomical distortion, extra fingers, or misaligned limbs",
            "NO generic AI slop, floating artifacts, or plastic CGI sheen",
            "STRICTLY adhere to requested text inside double quotes \"...\""
        ]

        # Lập cấu trúc chỉ thị cho agy CLI
        guidance_text = "\n".join(f"- {g}" for g in guidance_list) if guidance_list else "- Ensure clear focal point and professional lighting."
        pitfalls_text = "\n".join(f"- {p}" for p in pitfalls_list) if pitfalls_list else "- Avoid messy composition and redundant text."
        ref_cases_text = "\n\n".join(ref_cases_snippets) if ref_cases_snippets else "Follow modern design standards."
        negatives_text = "\n".join(f"- {n}" for n in negative_rules)

        master_instruction = f"""[Awesome-GPT-Image-2 Art Director Blueprint]
USER CONCEPT: {user_prompt}
TEMPLATE: {tpl_title} ({category}) | TAGS: {tags} | TARGET RATIO: {aspect_ratio}

DESIGN GUIDELINES TO ENFORCE:
{guidance_text}

CRITICAL PITFALLS TO ELIMINATE:
{pitfalls_text}

REFERENCE GOLD-STANDARD CASE PATTERNS:
{ref_cases_text}

NEGATIVE CONSTRAINTS:
{negatives_text}

DIRECTIVE: Synthesize the above rules into an authoritative, award-winning, production-grade image prompt. Specify subject anatomy, camera optics, studio/volumetric lighting, physical textures, and exact legible typography."""

        return {
            "template_id": template_id,
            "template_title": tpl_title,
            "category": category,
            "style": style,
            "aspect_ratio": aspect_ratio,
            "guidance": guidance_list,
            "pitfalls": pitfalls_list,
            "negative_rules": negative_rules,
            "reference_cases": ref_cases_snippets,
            "master_instruction": master_instruction,
            "detection": detection
        }
