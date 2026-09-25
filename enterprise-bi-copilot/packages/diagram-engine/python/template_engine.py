"""
Enterprise BI Diagram & Infographic Template Engine.
Integrates with the knowledge base in /home/chinhan/awesome-gpt-image-2:
- 13 Categories
- 22+ Industrial Templates from awesome-gpt-image-2
- 5 Specialized Enterprise Executive BI Blueprints
- 541+ Curated Reference Cases
- Dynamic AI Art Director Prompt Assembly (no hardcoding)
"""

import os
import sys
import json
from typing import Dict, List, Optional, Any

DATA_DIR = "/home/chinhan/awesome-gpt-image-2/data"
STYLE_LIB_PATH = os.path.join(DATA_DIR, "style-library.json")
CASES_PATH = os.path.join(DATA_DIR, "cases.json")

# Specialized Enterprise BI Templates crafted for C-Suite Copilot
ENTERPRISE_TEMPLATES: List[Dict[str, Any]] = [
    {
        "id": "enterprise-dwh-architecture",
        "anchor": "tpl-ent-dwh",
        "title": {
            "en": "Enterprise DWH Architecture & Security Flow",
            "vi": "Sơ đồ Kiến Trúc Data Warehouse & AST Security"
        },
        "category": "Architecture & Systems",
        "aspect_ratio": "16:9",
        "styles": ["Architecture", "Tech"],
        "scenes": ["Tech", "Enterprise"],
        "tags": ["DWH", "PostgreSQL", "Architecture", "Security", "MCP"],
        "useWhen": {
            "en": "Use for data warehouse blueprints, ingestion pipelines, database schemas, and AST security architecture.",
            "vi": "Dùng cho sơ đồ kiến trúc kho dữ liệu, luồng thu thập dữ liệu, cơ sở dữ liệu và bảo mật AST."
        },
        "guidance": {
            "en": [
                "Lay out a 4-tier horizontal pipeline from left to right: (1) Raw Sources: ERP, Billing, CRM -> (2) Ingestion & PostgreSQL 16 DWH (Port 5435) -> (3) Security Interceptor (AST Parser & Row-Level Security) -> (4) MCP Protocol Tools & C-Suite Executive Portal.",
                "Use modern technical blueprint aesthetics: deep navy slate background (#0B1120), glowing cyan (#06B6D4) and emerald (#10B981) data connectors.",
                "Highlight security badges: 'SHA-256 Zero-Mock Seal', 'AST Query Guard', 'MCP Protocol 4 Tools'.",
                "Ensure precise, readable typography with clean sans-serif labels and directional flow arrows."
            ]
        },
        "pitfalls": {
            "en": [
                "Avoid cluttered chaotic wireframes; maintain strict horizontal alignment and spacing.",
                "Never generate garbled, pseudo-random characters; keep text labels concise and legible."
            ]
        },
        "exampleCases": [17, 334]
    },
    {
        "id": "budget-reconciliation-workflow",
        "anchor": "tpl-ent-budget",
        "title": {
            "en": "Budget Reconciliation & Variance Workflow",
            "vi": "Quy Trình Đối Soát Ngân Sách & Variance Matrix"
        },
        "category": "Workflows & Governance",
        "aspect_ratio": "16:9",
        "styles": ["Workflow", "Governance"],
        "scenes": ["Commerce", "Enterprise"],
        "tags": ["Budget", "Reconciliation", "Variance", "Governance", "Excel"],
        "useWhen": {
            "en": "Use for financial reconciliation, budget plans vs actuals comparison, variance analysis, and CFO sign-off workflows.",
            "vi": "Dùng cho quy trình đối soát tài chính, so sánh ngân sách kế hoạch vs thực tế, phân tích chênh lệch và phê duyệt của CFO."
        },
        "guidance": {
            "en": [
                "Illustrate a 5-stage sequential governance workflow: [1. Excel Budget Plan (KeHoach_NganSach_Q3_2026.xlsx)] -> [2. DWH Actuals Query] -> [3. Variance Calculation Engine] -> [4. Risk & Variance Matrix] -> [5. CFO Sign-off & Audit Stamp].",
                "Use clear step cards with status indicators (Completed, Warning, Approval Required).",
                "Incorporate a financial color scheme: Royal Blue (#1D4ED8), Emerald (#059669), and Amber Alert (#D97706).",
                "Show feedback loops between Variance Analysis and Executive Action Items."
            ]
        },
        "pitfalls": {
            "en": [
                "Avoid overcomplicating with more than 6 main steps.",
                "Keep card titles crisp and easily distinguishable."
            ]
        },
        "exampleCases": [334, 1]
    },
    {
        "id": "executive-org-hierarchy",
        "anchor": "tpl-ent-org",
        "title": {
            "en": "C-Suite Governance & Department Hierarchy",
            "vi": "Sơ Đồ Cơ Cấu Tổ Chức & Thẩm Quyền Điều Hành"
        },
        "category": "Organization & Leadership",
        "aspect_ratio": "16:9",
        "styles": ["Hierarchy", "Organization"],
        "scenes": ["Enterprise", "Corporate"],
        "tags": ["HR", "OrgChart", "Leadership", "C-Suite", "Governance"],
        "useWhen": {
            "en": "Use for company organization structure, executive hierarchy, department breakdown, and headcount/payroll allocation.",
            "vi": "Dùng cho sơ đồ cơ cấu tổ chức công ty, phân cấp ban điều hành, phòng ban và phân bổ quỹ lương/nhân sự."
        },
        "guidance": {
            "en": [
                "Create an authoritative corporate tree hierarchy: Top: Board of Directors / CEO -> Middle: C-Suite Officers (CFO Nguyen Van Thanh, CTO Tran Thi Mai, CCO Le Hoang Nam) -> Bottom: 5 Operating Divisions (Enterprise Solutions, AI Cloud, Digital Banking, Operations, Finance).",
                "Display headcount badges and monthly payroll allocations in neat pill badges.",
                "Use premium executive dark-slate styling with clean card borders and subtle drop shadows."
            ]
        },
        "pitfalls": {
            "en": [
                "Avoid overlapping tree branches; keep orthogonal connector lines clean."
            ]
        },
        "exampleCases": [17, 334]
    },
    {
        "id": "omnichannel-copilot-pipeline",
        "anchor": "tpl-ent-omnichannel",
        "title": {
            "en": "Omnichannel Ingress & Copilot Router Pipeline",
            "vi": "Sơ Đồ Luồng Omnichannel & Điều Phối Đa Kênh"
        },
        "category": "Pipelines & Ingress",
        "aspect_ratio": "16:9",
        "styles": ["Pipeline", "Network"],
        "scenes": ["Tech", "Enterprise"],
        "tags": ["Omnichannel", "Zalo", "Telegram", "Chatwoot", "Email", "Gateway"],
        "useWhen": {
            "en": "Use for multi-channel messaging pipelines, webhook ingress, LLM routing, and human-in-the-loop notifications.",
            "vi": "Dùng cho luồng tin nhắn đa kênh, cổng tiếp nhận webhook, điều phối AI và thông báo phê duyệt con người."
        },
        "guidance": {
            "en": [
                "Show multi-channel convergence: Left: Channel icons (Chatwoot, Zalo OA, Telegram, Email) -> Center: Omnichannel Ingress Gateway & Router -> Right: MCP Tools Execution & Executive Notification.",
                "Use vibrant channel brand accents contrasting against a dark slate technical background.",
                "Highlight the Human-in-the-Loop decision gate and real-time SSE streaming path."
            ]
        },
        "pitfalls": {
            "en": [
                "Ensure icons are cleanly separated and labeled with protocol names."
            ]
        },
        "exampleCases": [17, 2]
    },
    {
        "id": "executive-financial-infographic",
        "anchor": "tpl-ent-fin-infographic",
        "title": {
            "en": "Executive Macro Financial Health Infographic",
            "vi": "Infographic Tổng Thể Sức Khỏe Tài Chính Q3/2026"
        },
        "category": "Charts & Infographics",
        "aspect_ratio": "16:9",
        "styles": ["Infographic", "Financial"],
        "scenes": ["Commerce", "Enterprise"],
        "tags": ["Finance", "KPI", "Revenue", "Margin", "Executive"],
        "useWhen": {
            "en": "Use for executive briefings, macro KPI posters, revenue breakdowns, and quarterly financial scorecards.",
            "vi": "Dùng cho báo cáo vĩ mô ban điều hành, tổng hợp chỉ số tài chính, doanh thu và biên lợi nhuận quý."
        },
        "guidance": {
            "en": [
                "Design an award-winning executive briefing poster featuring 4 hero metrics: Net Revenue (10.34B VND), Gross Margin (71.7%), YoY Growth (+24.6%), Closed Deals (16 deals).",
                "Include a miniature horizontal ranking chart for Top Clients (Medicorp, FPT, Vietcombank, Techcombank).",
                "Adhere to Swiss design principles: strict grid, high contrast, elegant typography, generous whitespace, no visual clutter."
            ]
        },
        "pitfalls": {
            "en": [
                "Avoid wall of text; express insights through numerical typography and geometric data cards."
            ]
        },
        "exampleCases": [334, 8]
    }
]

class EnterpriseTemplateEngine:
    def __init__(self, data_dir: str = DATA_DIR):
        self.data_dir = data_dir
        self.style_lib_path = os.path.join(data_dir, "style-library.json")
        self.cases_path = os.path.join(data_dir, "cases.json")
        
        self.categories: List[Dict[str, Any]] = []
        self.styles: List[Dict[str, Any]] = []
        self.scenes: List[Dict[str, Any]] = []
        self.repo_templates: List[Dict[str, Any]] = []
        self.all_templates: List[Dict[str, Any]] = []
        self.cases: List[Dict[str, Any]] = []
        self.cases_dict: Dict[int, Dict[str, Any]] = {}
        
        self.load()

    def load(self):
        """Tải dữ liệu từ awesome-gpt-image-2 và hợp nhất với Enterprise templates."""
        # 1. Load Style Library from awesome-gpt-image-2
        if os.path.exists(self.style_lib_path):
            try:
                with open(self.style_lib_path, "r", encoding="utf-8") as f:
                    sdata = json.load(f)
                    self.categories = sdata.get("categories", [])
                    self.styles = sdata.get("styles", [])
                    self.scenes = sdata.get("scenes", [])
                    self.repo_templates = sdata.get("templates", [])
            except Exception as e:
                print(f"[TemplateEngine] Warning loading {self.style_lib_path}: {e}", file=sys.stderr)

        # 2. Load 541+ Cases from awesome-gpt-image-2
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
                print(f"[TemplateEngine] Warning loading {self.cases_path}: {e}", file=sys.stderr)

        # 3. Combine Enterprise Templates + Repository Templates
        self.all_templates = list(ENTERPRISE_TEMPLATES)
        existing_ids = {t["id"] for t in self.all_templates}
        for rt in self.repo_templates:
            if rt.get("id") not in existing_ids:
                self.all_templates.append(rt)
                existing_ids.add(rt.get("id"))

    def list_templates(self) -> List[Dict[str, Any]]:
        return self.all_templates

    def list_categories(self) -> List[Dict[str, Any]]:
        return self.categories

    def get_template(self, template_id: str) -> Optional[Dict[str, Any]]:
        if not template_id:
            return None
        for t in self.all_templates:
            if t.get("id") == template_id or t.get("anchor") == template_id:
                return t
        return None

    def get_case(self, case_id: int) -> Optional[Dict[str, Any]]:
        return self.cases_dict.get(case_id)

    def build_director_instruction(self) -> str:
        """
        Tạo chỉ dẫn toàn diện cho AI Art Director (agy CLI - Stage 1).
        Chỉ dẫn chứa đầy đủ taxonomy từ awesome-gpt-image-2 và enterprise blueprints
        để Antigravity Gemini suy luận ngữ cảnh sâu sắc mà hoàn toàn KHÔNG CẦN hardcode.
        """
        categories_summary = []
        for cat in self.categories:
            c_val = cat.get("value") or cat.get("id")
            c_desc = cat.get("description", {}).get("en") or ""
            categories_summary.append(f"- {c_val}: {c_desc}")
        categories_str = "\n".join(categories_summary)

        templates_summary = []
        for tpl in self.all_templates:
            tid = tpl.get("id")
            t_title = tpl.get("title", {}).get("en") or tid
            t_cat = tpl.get("category", "")
            t_use = tpl.get("useWhen", {}).get("en") or tpl.get("description", {}).get("en") or ""
            templates_summary.append(f"  * {tid} [{t_cat}]: {t_title} - {t_use}")
        templates_str = "\n".join(templates_summary[:27])  # All 27 templates

        system_instruction = f"""You are the Senior AI Art Director & Master Prompt Engineer of 'awesome-gpt-image-2' integrated with Enterprise BI Copilot.
Your job is to analyze the user's request with deep artistic and architectural understanding (pure AI reasoning, NO hardcoded matching) and select the optimal visual template, aspect ratio, and compile a production-ready Master Prompt.

TAXONOMY & TEMPLATES FROM AWESOME-GPT-IMAGE-2 & ENTERPRISE BLUEPRINTS:
Categories:
{categories_str}

Available Industrial Templates:
{templates_str}

PRODUCTION ART DIRECTOR RULES:
1. Contextual Intent Analysis: Read the user's prompt (Vietnamese or English) and understand whether it asks for a technical architecture, database dataflow, business governance workflow, executive org chart, UI dashboard mockup, macro financial infographic, commercial product shot, corporate leadership portrait, or creative poster.
2. Aspect Ratio Selection:
   - Landscape (16:9): Technical architectures, data flowcharts, dashboards, financial infographics, timeline maps.
   - Portrait (9:16): Mobile UI mockups, smartphone feed screenshots, vertical storyboards.
   - Editorial (3:4 or 4:3): Executive white paper covers, Swiss typography posters, book layouts.
   - Square (1:1): Brand logos, vector emblems, 3D collectible dioramas, product shots.
3. Master Prompt Synthesis:
   - Layout & Composition: Swiss typography grid, clear visual hierarchy, structured modular cards, precise directional connectors.
   - Color Palette & Lighting: Dark technical slate background (#0F172A / #0B1120), glowing data connectors (cyan #06B6D4, emerald #10B981), subtle card borders, elegant volumetric studio light.
   - Text Typography: Lock exact legible titles/labels in double quotes "...", sharp sans-serif font, strictly no garbled pseudo-text.
   - Strict Negative Constraints: Explicitly enforce "NO blurry textures, NO illegible pseudo-text, NO chaotic wireframes, NO plastic CGI gloss, NO distorted geometry".

STRICT OUTPUT FORMAT: Return ONLY a valid JSON object:
{{
  "category": "<Matching category name>",
  "template_id": "<Best matching template_id from above>",
  "aspect_ratio": "<16:9 | 9:16 | 3:4 | 4:3 | 1:1>",
  "art_direction_reasoning": "<1-2 sentences in Vietnamese explaining your artistic vision, layout structure, and palette choices>",
  "master_prompt": "<Comprehensive, award-winning English image prompt detailing subject, composition, typography, materials, lighting, and negative constraints>"
}}"""
        return system_instruction

    def enrich_prompt_with_knowledge_base(
        self,
        user_prompt: str,
        detected_category: str,
        template_id: str,
        aspect_ratio: str,
        art_direction_reasoning: str,
        initial_master_prompt: str
    ) -> Dict[str, Any]:
        """
        Đối chiếu với kho tri thức awesome-gpt-image-2 để kiểm chứng và bổ sung:
        - Guidelines & Pitfalls của template
        - Case mẫu tham khảo từ cases.json
        - Củng cố negative constraints
        """
        tpl = self.get_template(template_id)
        if not tpl:
            # Fallback to general infographic or first template
            tpl = self.get_template("infographic-engine") or (self.all_templates[0] if self.all_templates else None)

        template_title = tpl.get("title", {}).get("vi") or tpl.get("title", {}).get("en") or template_id if tpl else template_id
        
        guidance_items = []
        pitfall_items = []
        if tpl:
            g = tpl.get("guidance", {})
            guidance_items = g.get("en", []) if isinstance(g, dict) else (g if isinstance(g, list) else [])
            p = tpl.get("pitfalls", {})
            pitfall_items = p.get("en", []) if isinstance(p, dict) else (p if isinstance(p, list) else [])

        # Lấy 1-2 case mẫu thực tế từ awesome-gpt-image-2 làm đối chứng
        example_ids = tpl.get("exampleCases", []) if tpl else []
        ref_case_snippets = []
        for cid in example_ids[:2]:
            c = self.get_case(cid)
            if c:
                prompt_snip = c.get("prompt", "").strip()
                if len(prompt_snip) > 250:
                    prompt_snip = prompt_snip[:250] + "..."
                ref_case_snippets.append(f"Case #{cid} ({c.get('title')}): {prompt_snip}")

        # Bổ sung các ràng buộc âm (negative rules) từ awesome-gpt-image-2
        negative_rules = "Negative Constraints: NO blurry textures, NO illegible pseudo-text, NO clutter, NO floating artifacts, NO plastic CGI sheen, NO distorted hands or limbs."

        # Ghép hoặc hoàn thiện master prompt nếu chưa đủ chi tiết
        final_prompt = initial_master_prompt.strip()
        if "NO blurry" not in final_prompt and "negative" not in final_prompt.lower():
            final_prompt = f"{final_prompt} -- {negative_rules}"

        return {
            "category": detected_category or (tpl.get("category") if tpl else "General"),
            "template_id": tpl.get("id", template_id) if tpl else template_id,
            "template_title": template_title,
            "aspect_ratio": aspect_ratio or "16:9",
            "art_direction_reasoning": art_direction_reasoning,
            "master_prompt": final_prompt,
            "guidance": guidance_items,
            "pitfalls": pitfall_items,
            "reference_cases": ref_case_snippets
        }

    def fallback_detect_template(self, prompt: str) -> Dict[str, Any]:
        """Dự phòng nhẹ nhàng nếu mạng hoặc CLI agy gặp sự cố bất khả kháng."""
        p = prompt.lower()
        if any(w in p for w in ["kiến trúc", "dwh", "database", "luồng dữ liệu", "ast", "mcp", "architecture"]):
            tpl = self.get_template("enterprise-dwh-architecture")
            return {
                "category": "Architecture & Systems",
                "template_id": "enterprise-dwh-architecture",
                "aspect_ratio": "16:9",
                "art_direction_reasoning": "Thiết kế kiến trúc hệ thống dữ liệu doanh nghiệp và phân lớp bảo mật AST trên nền Slate tối.",
                "master_prompt": f"Professional technical blueprint of Enterprise Data Warehouse Architecture: \"{prompt}\". 4-tier horizontal pipeline, PostgreSQL 16 DWH, AST Security Interceptor, MCP Protocol Tools, C-Suite Portal, glowing cyan and emerald connectors, dark slate background (#0B1120), crisp typography, 8k resolution. NO blurry textures, NO illegible pseudo-text."
            }

        if any(w in p for w in ["ngân sách", "đối soát", "kế hoạch", "variance", "budget"]):
            tpl = self.get_template("budget-reconciliation-workflow")
            return {
                "category": "Workflows & Governance",
                "template_id": "budget-reconciliation-workflow",
                "aspect_ratio": "16:9",
                "art_direction_reasoning": "Sơ đồ quy trình đối soát ngân sách 5 bước với các thẻ trạng thái và variance matrix.",
                "master_prompt": f"Executive Budget Reconciliation and Variance Workflow: \"{prompt}\". 5-stage sequential governance workflow, Excel Budget Plan, DWH actuals, variance engine, CFO approval stamp, Royal Blue and Emerald accents, clean card layout, 8k. NO blurry textures, NO illegible pseudo-text."
            }

        if any(w in p for w in ["nhân sự", "cơ cấu", "tổ chức", "phòng ban", "lãnh đạo", "c-suite", "org chart"]):
            tpl = self.get_template("executive-org-hierarchy")
            return {
                "category": "Organization & Leadership",
                "template_id": "executive-org-hierarchy",
                "aspect_ratio": "16:9",
                "art_direction_reasoning": "Sơ đồ cây phân cấp ban điều hành C-Suite và 5 khối phòng ban với huy hiệu nhân sự.",
                "master_prompt": f"Corporate Executive Hierarchy and Governance Tree: \"{prompt}\". Top: Board of Directors / CEO, Middle: C-Suite Officers, Bottom: 5 Operating Divisions, clean pill badges for headcount and payroll, elegant dark slate styling, sharp connector lines, 8k. NO blurry textures."
            }

        if any(w in p for w in ["ui", "app", "mobile", "ios", "dashboard", "giao diện"]):
            tpl = self.get_template("ui-screenshot-system")
            ratio = "9:16" if any(w in p for w in ["app", "mobile", "ios", "phone"]) else "16:9"
            return {
                "category": "UI & Interfaces",
                "template_id": "ui-screenshot-system",
                "aspect_ratio": ratio,
                "art_direction_reasoning": "Mô phỏng giao diện người dùng hiện đại, sắc nét với hệ thống màu và typography chuẩn mực.",
                "master_prompt": f"High-fidelity UI Screenshot and Interface Mockup: \"{prompt}\". Modern clean SaaS dashboard / mobile app, dark mode, precise typography, structured widgets, status bars, glossy data charts, 8k resolution. NO blurry text, NO distorted UI."
            }

        # General default
        return {
            "category": "Charts & Infographics",
            "template_id": "infographic-engine",
            "aspect_ratio": "16:9",
            "art_direction_reasoning": "Bố cục infographic 3-5 module rõ ràng, phân cấp thông tin theo phong cách Thụy Sĩ.",
            "master_prompt": f"Professional Corporate Infographic and Visual Diagram: \"{prompt}\". Structured 3-5 modular panels, vector glyphs, high-contrast title typography, clean enterprise palette (Slate, Navy Blue, Emerald), generous whitespace, 8k rendering. NO blurry textures, NO unreadable text."
        }
