"""
Agy Image Gateway Service - FastAPI Main Application.
Provides REST API & Minimalist ChatGPT-like UI for agy CLI image generation,
powered by a True 2-Stage AI Art Director & Generator Pipeline.
"""

import os
import sys
import time
import json
import uuid
import base64
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Add current dir to path
APP_DIR = os.path.dirname(os.path.abspath(__file__))
if APP_DIR not in sys.path:
    sys.path.insert(0, APP_DIR)

from core.account_manager import AccountManager
from core.template_engine import TemplateEngine, REPO_PATH
from core.agy_executor import AgyExecutor, STORAGE_DIR

app = FastAPI(
    title="Agy AI Art Studio & Gateway",
    description="Minimalist 2-Stage AI Art Director & Image Generation Gateway powered by agy CLI & awesome-gpt-image-2.",
    version="3.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount repository image assets (532+ case covers)
REPO_IMAGES_DIR = os.path.join(REPO_PATH, "data", "images")
if os.path.exists(REPO_IMAGES_DIR):
    app.mount("/repo-assets", StaticFiles(directory=REPO_IMAGES_DIR), name="repo-assets")

# Initialize core services
PROXY_PORT = int(os.environ.get("PROXY_PORT", 8899))
account_mgr = AccountManager(port=PROXY_PORT)
template_engine = TemplateEngine()
executor = AgyExecutor(proxy_port=PROXY_PORT)

@app.on_event("startup")
async def startup_event():
    account_mgr.ensure_proxy_running()

# Models
class GenerateRequest(BaseModel):
    prompt: str = Field(..., description="User creative idea / image description")
    aspect_ratio: Optional[str] = Field("auto", description="Aspect ratio (1:1, 16:9, 9:16, 4:3, 3:4) or 'auto'")
    account: Optional[str] = Field("auto", description="Account index (1-6) or email, or 'auto'")
    image_name: Optional[str] = Field(None, description="Custom base name for the image file")
    return_format: str = Field("url", description="'url', 'base64', or 'both'")

class SwitchAccountRequest(BaseModel):
    account: str = Field(..., description="Account index (1-6) or email")

class GenerateContentRequest(BaseModel):
    prompt: str = Field(..., description="Prompt or topic for the post, supports #hinhanh")
    image_urls: Optional[List[str]] = Field(default=[], description="List of image URLs or file paths")
    style: Optional[str] = Field("engaging", description="Style/tone: engaging, sales, storytelling, professional, humorous, concise")
    length: Optional[str] = Field("medium", description="Length: short, medium, long")
    include_emojis: Optional[bool] = Field(True, description="Whether to include emojis")
    include_hashtags: Optional[bool] = Field(True, description="Whether to include hashtags")
    include_cta: Optional[bool] = Field(True, description="Whether to include a call to action")

class ChatCompletionRequest(BaseModel):
    model: Optional[str] = "gemini-3.8-flash-low"
    messages: List[Dict[str, Any]]
    stream: Optional[bool] = False
    tools: Optional[List[Dict[str, Any]]] = None
    temperature: Optional[float] = 0.7

# Endpoints
@app.get("/health")
def health(request: Request):
    proxy_st = account_mgr.get_proxy_status()
    accounts = account_mgr.get_accounts()
    active = account_mgr.get_active_account()
    return {
        "status": "ok",
        "proxy": proxy_st,
        "accounts_count": len(accounts),
        "active_account": active,
        "templates_count": len(template_engine.list_templates()),
        "total_cases": len(template_engine.cases),
        "base_url": str(request.base_url).rstrip("/")
    }

@app.get("/v1/accounts")
def list_accounts():
    accounts = account_mgr.get_accounts()
    active = account_mgr.get_active_account()
    proxy_status = account_mgr.get_proxy_status()
    return {
        "active_account": active,
        "proxy": proxy_status,
        "total_accounts": len(accounts),
        "accounts": accounts
    }

@app.post("/v1/accounts/switch")
def switch_account(req: SwitchAccountRequest):
    res = account_mgr.switch_account(req.account)
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Failed to switch account"))
    return res

@app.get("/v1/templates")
def list_templates():
    return {
        "count": len(template_engine.list_templates()),
        "templates": template_engine.list_templates()
    }

@app.get("/v1/cases")
def list_cases(
    category: Optional[str] = Query(None, description="Category filter"),
    search: Optional[str] = Query(None, description="Search query"),
    limit: int = Query(36, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    return template_engine.get_cases(category=category, search=search, limit=limit, offset=offset)

@app.get("/v1/cases/{case_id}")
def get_case_detail(case_id: int):
    case = template_engine.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case

@app.post("/v1/images/generate")
async def generate_image(req: GenerateRequest, request: Request):
    """
    Quy trình tạo ảnh 2 Lớp (Two-Stage AI Pipeline):
    - Lớp 1: AI Art Director (LLM reasoning) thấu cảm ý đồ, lập chỉ đạo nghệ thuật & biên dịch Master Prompt.
    - Lớp 2: agy CLI generate_image thực thi sinh tác phẩm và tự động xóa sạch session.
    """
    account_mgr.ensure_proxy_running()

    if req.account and req.account.lower() != "auto":
        account_mgr.switch_account(req.account)

    result = await executor.execute_two_stage_pipeline(
        user_prompt=req.prompt,
        override_ratio=req.aspect_ratio,
        image_name=req.image_name
    )

    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Generation failed"))

    filename = result["filename"]
    filepath = result["file_path"]
    base_url = str(request.base_url).rstrip("/")
    image_url = f"{base_url}/images/{filename}"

    b64_data = None
    if req.return_format in ("base64", "both") and os.path.exists(filepath):
        try:
            with open(filepath, "rb") as f:
                b64_data = base64.b64encode(f.read()).decode("utf-8")
        except Exception as e:
            print(f"[Warning] Failed to encode base64: {e}")

    active_email = account_mgr.get_active_account()

    response_data = {
        "status": "success",
        "url": image_url,
        "filename": filename,
        "aspect_ratio": result.get("aspect_ratio"),
        "duration_sec": result.get("duration_sec"),
        "session_id": result.get("session_id"),
        "session_cleaned": True,
        "account_used": active_email,
        "original_prompt": req.prompt,
        "art_director": result.get("art_director") or result.get("stage1_director"),
        "master_prompt": result.get("master_prompt")
    }

    if b64_data:
        response_data["base64"] = b64_data

    return response_data

@app.post("/v1/content/generate")
async def generate_content(req: GenerateContentRequest, request: Request):
    """
    Sinh nội dung bài đăng mạng xã hội (hỗ trợ Vision qua #hinhanh).
    """
    account_mgr.ensure_proxy_running()
    res = await executor.execute_content_generation(
        prompt=req.prompt,
        image_urls=req.image_urls,
        style=req.style or "engaging",
        length=req.length or "medium",
        include_emojis=req.include_emojis if req.include_emojis is not None else True,
        include_hashtags=req.include_hashtags if req.include_hashtags is not None else True,
        include_cta=req.include_cta if req.include_cta is not None else True,
    )
    if not res.get("success"):
        raise HTTPException(status_code=500, detail=res.get("error", "Content generation failed"))
    return res

@app.get("/v1/models")
def list_models():
    """Danh sách các models tương thích OpenAI API."""
    return {
        "object": "list",
        "data": [
            {"id": "gemini-3.8-flash-low", "object": "model", "owned_by": "agy-gateway"},
            {"id": "gemini-3.8-flash", "object": "model", "owned_by": "agy-gateway"},
            {"id": "gpt-4o-mini", "object": "model", "owned_by": "agy-gateway"},
            {"id": "gpt-4.1", "object": "model", "owned_by": "agy-gateway"},
            {"id": "postiz", "object": "model", "owned_by": "agy-gateway"}
        ]
    }

@app.post("/v1/chat/completions")
async def chat_completions(req: ChatCompletionRequest):
    """
    OpenAI-compatible Chat Completions API powered by agy CLI with 6-account rotation.
    Tự động dọn dẹp và xóa sạch toàn bộ session sau mỗi lượt chat hoàn tất.
    """
    account_mgr.ensure_proxy_running()
    result = await executor.execute_chat(
        messages=req.messages,
        tools=req.tools,
        model=req.model or "gemini-3.8-flash-low"
    )

    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Chat execution failed"))

    chat_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"
    created_ts = int(time.time())
    model_name = req.model or "gemini-3.8-flash-low"

    if req.stream:
        async def event_generator():
            if result.get("tool_calls"):
                for tc in result["tool_calls"]:
                    chunk = {
                        "id": chat_id,
                        "object": "chat.completion.chunk",
                        "created": created_ts,
                        "model": model_name,
                        "choices": [
                            {
                                "index": 0,
                                "delta": {
                                    "role": "assistant",
                                    "tool_calls": [
                                        {
                                            "index": 0,
                                            "id": tc["id"],
                                            "type": "function",
                                            "function": tc["function"]
                                        }
                                    ]
                                },
                                "finish_reason": "tool_calls"
                            }
                        ]
                    }
                    yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
            else:
                text = result.get("content", "")
                chunk_payload = {
                    "id": chat_id,
                    "object": "chat.completion.chunk",
                    "created": created_ts,
                    "model": model_name,
                    "choices": [
                        {
                            "index": 0,
                            "delta": {
                                "role": "assistant",
                                "content": text
                            },
                            "finish_reason": "stop"
                        }
                    ]
                }
                yield f"data: {json.dumps(chunk_payload, ensure_ascii=False)}\n\n"

            yield "data: [DONE]\n\n"

        return StreamingResponse(event_generator(), media_type="text/event-stream")

    return {
        "id": chat_id,
        "object": "chat.completion",
        "created": created_ts,
        "model": model_name,
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": result.get("content"),
                    **({"tool_calls": result.get("tool_calls")} if result.get("tool_calls") else {})
                },
                "finish_reason": "tool_calls" if result.get("tool_calls") else "stop"
            }
        ],
        "usage": {
            "prompt_tokens": 100,
            "completion_tokens": 50,
            "total_tokens": 150
        }
    }

@app.post("/v1/responses")
async def responses_endpoint(request: Request):
    """Fallback cho các SDK gọi endpoint /v1/responses của OpenAI."""
    data = await request.json()
    messages = data.get("messages") or []
    if not messages and "input" in data:
        messages = [{"role": "user", "content": str(data["input"])}]
    chat_req = ChatCompletionRequest(
        model=data.get("model", "gemini-3.8-flash-low"),
        messages=messages,
        stream=data.get("stream", False),
        tools=data.get("tools")
    )
    return await chat_completions(chat_req)

@app.api_route("/images/{filename}", methods=["GET", "HEAD"])
def get_image(filename: str):
    safe_name = os.path.basename(filename)
    path = os.path.join(STORAGE_DIR, safe_name)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Image not found")
    media_type = "image/png"
    if safe_name.lower().endswith(".jpg") or safe_name.lower().endswith(".jpeg"):
        media_type = "image/jpeg"
    elif safe_name.lower().endswith(".webp"):
        media_type = "image/webp"
    return FileResponse(path, media_type=media_type)

@app.get("/", response_class=HTMLResponse)
def index_ui():
    """Giao diện tối giản, thanh lịch phong cách ChatGPT / Midjourney."""
    return """<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Agy Studio | AI Art Director</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <style>
        :root {
            --bg-canvas: #090d16;
            --bg-surface: #111827;
            --bg-input: #1a2234;
            --border: #243048;
            --primary: #3b82f6;
            --primary-glow: rgba(59, 130, 246, 0.25);
        }
        body {
            background: var(--bg-canvas);
            color: #f3f4f6;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            min-height: 100vh;
        }
        .nav-link { color: #9ca3af; font-weight: 500; font-size: 14px; }
        .nav-link.active { color: #fff !important; background: transparent !important; border-bottom: 2px solid var(--primary); border-radius: 0; }
        
        /* ChatGPT-style Prominent Bar */
        .prompt-container {
            background: var(--bg-surface);
            border: 1px solid var(--border);
            border-radius: 18px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
            transition: border-color 0.2s, box-shadow 0.2s;
        }
        .prompt-container:focus-within {
            border-color: var(--primary);
            box-shadow: 0 10px 35px var(--primary-glow);
        }
        .prompt-textarea {
            background: transparent;
            border: none;
            color: #fff;
            font-size: 16px;
            line-height: 1.6;
            resize: none;
            outline: none;
            width: 100%;
            padding: 16px 20px 8px 20px;
        }
        .prompt-textarea::placeholder { color: #6b7280; }
        
        .btn-send {
            background: #fff;
            color: #000;
            border-radius: 12px;
            width: 44px;
            height: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            border: none;
            transition: all 0.2s;
        }
        .btn-send:hover { background: #e5e7eb; transform: scale(1.05); }
        .btn-send:disabled { background: #374151; color: #9ca3af; transform: none; }

        .chip-sample {
            background: rgba(31, 41, 55, 0.6);
            border: 1px solid #374151;
            color: #9ca3af;
            border-radius: 20px;
            padding: 6px 14px;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .chip-sample:hover {
            color: #fff;
            border-color: var(--primary);
            background: rgba(59, 130, 246, 0.1);
        }

        .step-pill {
            display: inline-flex;
            align-items: center;
            background: rgba(17, 24, 39, 0.8);
            border: 1px solid var(--border);
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 13px;
        }

        .gallery-card {
            background: var(--bg-surface);
            border: 1px solid var(--border);
            border-radius: 12px;
            overflow: hidden;
            cursor: pointer;
            transition: all 0.2s;
        }
        .gallery-card:hover { transform: translateY(-4px); border-color: var(--primary); box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        .gallery-img { width: 100%; height: 210px; object-fit: cover; background: #000; }
        
        pre { background: #060911; color: #38bdf8; border-radius: 10px; padding: 14px; font-size: 13px; }
    </style>
</head>
<body>

<!-- Top Navigation -->
<nav class="navbar navbar-expand border-bottom border-dark px-4 py-3">
    <div class="container-fluid max-w-6xl">
        <div class="d-flex align-items-center gap-2">
            <span class="fs-4">✨</span>
            <span class="fw-bold fs-5 text-white">Agy Studio</span>
            <span class="badge bg-dark border border-secondary text-secondary ms-2 small">2-Stage AI Art Director</span>
        </div>
        <ul class="nav nav-pills ms-auto gap-3">
            <li class="nav-item">
                <button class="nav-link active" data-bs-toggle="pill" data-bs-target="#tab-canvas"><i class="bi bi-magic me-1"></i> Sáng Tạo</button>
            </li>
            <li class="nav-item">
                <button class="nav-link" data-bs-toggle="pill" data-bs-target="#tab-gallery" onclick="loadGalleryOnce()"><i class="bi bi-grid me-1"></i> 541+ Cases</button>
            </li>
            <li class="nav-item">
                <button class="nav-link" data-bs-toggle="pill" data-bs-target="#tab-accounts"><i class="bi bi-people me-1"></i> 6 Tài Khoản</button>
            </li>
            <li class="nav-item">
                <a href="/docs" target="_blank" class="nav-link text-info"><i class="bi bi-terminal me-1"></i> API Docs</a>
            </li>
        </ul>
    </div>
</nav>

<div class="container max-w-4xl py-5">
    <div class="tab-content">
        <!-- TAB 1: CANVAS SÁNG TẠO (CHATGPT / MIDJOURNEY STYLE) -->
        <div class="tab-pane fade show active" id="tab-canvas">
            
            <!-- Hero Heading -->
            <div class="text-center mb-5">
                <h1 class="fw-bold text-white mb-2" style="font-size: 2.2rem; letter-spacing: -0.5px;">Bạn muốn tạo tác phẩm gì hôm nay?</h1>
                <p class="text-secondary" style="font-size: 15px;">Chỉ cần nhập ý tưởng tự nhiên. Hệ thống sẽ tự động gửi qua Lớp 1 (AI Art Director) để phân tích bối cảnh, ánh sáng, góc máy rồi thực thi vẽ.</p>
            </div>

            <!-- ChatGPT-style Clean Prompt Box -->
            <div class="prompt-container mb-4">
                <textarea id="prompt-input" class="prompt-textarea" rows="3" 
                    placeholder="Mô tả ý tưởng của bạn... (Ví dụ: Bức tranh cô gái áo dài trắng đứng dưới mưa ánh đèn vàng hoài niệm thập niên 90, hoặc Poster quảng cáo nước giải khát chanh tuyết mát lạnh...)"
                    onkeydown="handleKeyDown(event)"></textarea>
                
                <div class="d-flex justify-content-between align-items-center px-3 pb-3 pt-1">
                    <div class="d-flex align-items-center gap-2">
                        <button class="btn btn-sm btn-outline-secondary border-0 text-secondary" type="button" data-bs-toggle="collapse" data-bs-target="#advancedOptions">
                            <i class="bi bi-sliders me-1"></i> Tùy chọn (Tỷ lệ / Acc)
                        </button>
                    </div>
                    <button id="btn-submit" class="btn-send" onclick="submitCreation()" title="Gửi yêu cầu">
                        <i class="bi bi-arrow-up-short"></i>
                    </button>
                </div>

                <!-- Expandable Options (Clean & Hidden by Default) -->
                <div class="collapse px-3 pb-3 border-top border-dark pt-3" id="advancedOptions">
                    <div class="row g-3">
                        <div class="col-md-6">
                            <label class="small text-secondary mb-1">Tỷ lệ khung hình:</label>
                            <select id="ratio-select" class="form-select form-select-sm bg-dark text-light border-secondary">
                                <option value="auto" selected>🤖 Tự động (AI Art Director tự quyết định)</option>
                                <option value="1:1">1:1 (Vuông - Logo/Avatar/Sản phẩm)</option>
                                <option value="16:9">16:9 (Ngang - Điện ảnh/Desktop UI)</option>
                                <option value="9:16">9:16 (Dọc - Mobile UI/Story/TikTok)</option>
                                <option value="3:4">3:4 (Dọc nghệ thuật - Poster/Chân dung)</option>
                                <option value="4:3">4:3 (Ngang cổ điển)</option>
                            </select>
                        </div>
                        <div class="col-md-6">
                            <label class="small text-secondary mb-1">Tài khoản agy:</label>
                            <select id="account-select" class="form-select form-select-sm bg-dark text-light border-secondary">
                                <option value="auto" selected>🤖 Tự động xoay 6 tài khoản</option>
                                <option value="1">Acc 1</option>
                                <option value="2">Acc 2</option>
                                <option value="3">Acc 3</option>
                                <option value="4">Acc 4</option>
                                <option value="5">Acc 5</option>
                                <option value="6">Acc 6</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Suggestion Chips -->
            <div class="d-flex flex-wrap justify-content-center gap-2 mb-5">
                <span class="chip-sample" onclick="setPrompt('Bức tranh người phụ nữ áo dài trắng đứng dưới mưa ánh đèn vàng phố cổ hoài niệm những năm 90')">🏮 Phố cổ mưa đêm 90s</span>
                <span class="chip-sample" onclick="setPrompt('Giao diện mobile app quản lý chi tiêu ngân sách cá nhân Dark Mode phong cách tối giản')">📱 Giao diện Mobile App</span>
                <span class="chip-sample" onclick="setPrompt('Poster giải chạy marathon đêm Hà Nội chữ RUN phát sáng mạnh mẽ phong cách Swiss Typography')">🏃 Poster Marathon Đêm</span>
                <span class="chip-sample" onclick="setPrompt('Chai nước hoa thủy tinh cao cấp đặt trên tảng đá đen nước bắn xung quanh studio lighting')">💎 Chụp sản phẩm cao cấp</span>
                <span class="chip-sample" onclick="setPrompt('Mô hình 3D isometric diorama khu rừng cổ tích phát sáng huyền ảo')">🍄 3D Diorama cổ tích</span>
            </div>

            <!-- Dynamic Workflow Status (Appears when Generating) -->
            <div id="status-card" class="card p-4 mb-4 shadow border-primary d-none">
                <div class="d-flex align-items-center gap-3">
                    <div class="spinner-border text-primary" role="status"></div>
                    <div>
                        <div class="fw-bold text-white fs-6" id="status-step-title">Đang khởi tạo tiến trình...</div>
                        <div class="small text-secondary" id="status-step-desc">Vui lòng đợi giây lát...</div>
                    </div>
                </div>
            </div>

            <!-- Result Showcase (Appears when Done) -->
            <div id="result-card" class="card p-4 shadow-lg border-secondary d-none">
                <div class="text-center mb-4">
                    <img id="res-img" src="" class="img-fluid rounded-4 shadow-lg border border-secondary" style="max-height: 520px;" alt="Masterpiece">
                    <div class="mt-3 d-flex justify-content-center gap-2">
                        <a id="res-dl" href="" target="_blank" class="btn btn-primary px-4 fw-bold"><i class="bi bi-download me-1"></i> Tải ảnh chất lượng cao</a>
                        <button class="btn btn-outline-secondary" onclick="sharePrompt()"><i class="bi bi-clipboard me-1"></i> Sao chép Prompt</button>
                    </div>
                </div>

                <!-- Art Director Inspection (Collapsible) -->
                <div class="border-top border-dark pt-3">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="small text-secondary"><i class="bi bi-shield-check text-success me-1"></i> Session tự động dọn sạch</span>
                        <span class="small text-secondary" id="res-meta-time">--</span>
                    </div>

                    <div class="p-3 rounded bg-dark border border-secondary mb-2">
                        <div class="fw-bold text-info small mb-1"><i class="bi bi-stars me-1"></i> Chỉ đạo mỹ thuật của AI Art Director:</div>
                        <div class="small text-light mb-2" id="res-director-reasoning">--</div>
                        <div class="d-flex gap-2">
                            <span class="badge bg-secondary" id="res-tag-cat">--</span>
                            <span class="badge bg-secondary" id="res-tag-ratio">--</span>
                        </div>
                    </div>

                    <details>
                        <summary class="small text-secondary cursor-pointer">Xem Master Prompt biên dịch bởi AI Art Director</summary>
                        <pre class="mt-2" id="res-master-prompt" style="white-space: pre-wrap; font-size: 12px;"></pre>
                    </details>
                </div>
            </div>
        </div>

        <!-- TAB 2: GALLERY 541+ CASES -->
        <div class="tab-pane fade" id="tab-gallery">
            <div class="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h4 class="fw-bold mb-1">🖼️ Thư Viện 541+ Case Mẫu</h4>
                    <p class="text-secondary small mb-0">Nạp bất kỳ tác phẩm nào từ awesome-gpt-image-2 vào Studio với 1 click.</p>
                </div>
                <input id="gallery-search" type="text" class="form-control bg-dark text-light border-secondary" placeholder="🔍 Tìm case mẫu..." style="width: 260px;" oninput="debounceGallerySearch()">
            </div>

            <div class="row g-3" id="cases-grid">
                <div class="text-center py-5 text-secondary"><span class="spinner-border spinner-border-sm me-2"></span> Đang tải...</div>
            </div>

            <div class="text-center mt-4">
                <button id="btn-load-more" class="btn btn-outline-secondary px-4 d-none" onclick="loadMoreCases()">Xem thêm tác phẩm</button>
            </div>
        </div>

        <!-- TAB 3: ACCOUNTS -->
        <div class="tab-pane fade" id="tab-accounts">
            <div class="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h4 class="fw-bold mb-1">👥 6 Tài Khoản Antigravity AI Pro</h4>
                    <p class="text-secondary small mb-0">Hệ thống proxy 8899 tự động bảo vệ không bị ngắt quãng khi gặp lỗi 429.</p>
                </div>
                <button class="btn btn-sm btn-outline-info" onclick="loadAccounts()"><i class="bi bi-arrow-clockwise me-1"></i> Làm mới</button>
            </div>
            <div class="row g-3" id="accounts-container">
                <div class="text-secondary small">Đang tải...</div>
            </div>
        </div>
    </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
<script>
    let activeMasterPrompt = "";
    let galleryLoaded = false;
    let galleryOffset = 0;
    const GALLERY_LIMIT = 24;
    let searchDebounce = null;

    function handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submitCreation();
        }
    }

    function setPrompt(text) {
        document.getElementById('prompt-input').value = text;
        document.getElementById('prompt-input').focus();
    }

    async function submitCreation() {
        const prompt = document.getElementById('prompt-input').value.trim();
        if (!prompt) return;

        const ratio = document.getElementById('ratio-select').value;
        const account = document.getElementById('account-select').value;

        const btn = document.getElementById('btn-submit');
        const statusCard = document.getElementById('status-card');
        const resultCard = document.getElementById('result-card');
        const stepTitle = document.getElementById('status-step-title');
        const stepDesc = document.getElementById('status-step-desc');

        btn.disabled = true;
        resultCard.classList.add('d-none');
        statusCard.classList.remove('d-none');

        stepTitle.textContent = "🧠 Lớp 1: AI Art Director đang phân tích ý đồ...";
        stepDesc.textContent = "Đang tổng hợp quy chuẩn ánh sáng, chất liệu, bố cục và loại bỏ phế phẩm theo awesome-gpt-image-2...";

        // Simulate transition to Stage 2 after few seconds
        const stageTimer = setTimeout(() => {
            stepTitle.textContent = "🎨 Lớp 2: agy CLI đang render hình ảnh...";
            stepDesc.textContent = "Đang tạo tác phẩm với độ phân giải cao và dọn sạch session...";
        }, 12000);

        try {
            const res = await fetch('/v1/images/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: prompt,
                    aspect_ratio: ratio,
                    account: account,
                    return_format: 'url'
                })
            });

            clearTimeout(stageTimer);
            const data = await res.json();

            if (!res.ok) {
                alert('Lỗi tạo ảnh: ' + (data.detail || JSON.stringify(data)));
                statusCard.classList.add('d-none');
                return;
            }

            statusCard.classList.add('d-none');
            resultCard.classList.remove('d-none');

            document.getElementById('res-img').src = data.url;
            document.getElementById('res-dl').href = data.url;
            activeMasterPrompt = data.master_prompt || "";

            const director = data.art_director || {};
            document.getElementById('res-director-reasoning').textContent = director.art_direction_reasoning || "Đã áp dụng các quy chuẩn mỹ thuật cao cấp.";
            document.getElementById('res-tag-cat').textContent = director.category || "General";
            document.getElementById('res-tag-ratio').textContent = `Tỷ lệ: ${data.aspect_ratio}`;
            document.getElementById('res-meta-time').textContent = `Thời gian thực thi: ${data.duration_sec}s | Acc: ${data.account_used}`;
            document.getElementById('res-master-prompt').textContent = data.master_prompt || "";

            // Smooth scroll to result
            resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch(e) {
            clearTimeout(stageTimer);
            alert('Lỗi kết nối: ' + e);
            statusCard.classList.add('d-none');
        } finally {
            btn.disabled = false;
        }
    }

    function sharePrompt() {
        if (!activeMasterPrompt) return;
        navigator.clipboard.writeText(activeMasterPrompt);
        alert('Đã sao chép Master Prompt vào Clipboard!');
    }

    // GALLERY TAB
    function loadGalleryOnce() {
        if (!galleryLoaded) {
            loadGalleryCases(true);
            galleryLoaded = true;
        }
    }

    function debounceGallerySearch() {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => loadGalleryCases(true), 400);
    }

    async function loadGalleryCases(reset = false) {
        if (reset) {
            galleryOffset = 0;
            document.getElementById('cases-grid').innerHTML = '<div class="text-center py-5 text-secondary"><span class="spinner-border spinner-border-sm me-2"></span> Đang tải...</div>';
        }
        const query = document.getElementById('gallery-search').value.trim();
        try {
            const res = await fetch(`/v1/cases?search=${encodeURIComponent(query)}&limit=${GALLERY_LIMIT}&offset=${galleryOffset}`);
            const data = await res.json();

            const grid = document.getElementById('cases-grid');
            if (reset) grid.innerHTML = '';

            if (!data.items || data.items.length === 0) {
                if (reset) grid.innerHTML = '<div class="text-center py-5 text-secondary">Không tìm thấy case mẫu nào.</div>';
                document.getElementById('btn-load-more').classList.add('d-none');
                return;
            }

            data.items.forEach(c => {
                const col = document.createElement('div');
                col.className = 'col-sm-6 col-md-4 col-xl-3';
                col.innerHTML = `
                    <div class="gallery-card h-100" onclick="useCaseInCanvas('${escapeHtml(c.prompt)}')">
                        <img src="${c.image}" class="gallery-img" loading="lazy" onerror="this.src='/repo-assets/banner.svg'" alt="${c.title}">
                        <div class="p-3">
                            <span class="badge bg-dark border border-secondary text-secondary small mb-1">${c.category || 'General'}</span>
                            <h6 class="fw-bold text-white text-truncate mb-2" title="${c.title}">${c.title}</h6>
                            <button class="btn btn-sm btn-outline-primary w-100"><i class="bi bi-magic me-1"></i> Nạp vào Studio</button>
                        </div>
                    </div>
                `;
                grid.appendChild(col);
            });

            galleryOffset += data.items.length;
            if (galleryOffset >= data.total) {
                document.getElementById('btn-load-more').classList.add('d-none');
            } else {
                document.getElementById('btn-load-more').classList.remove('d-none');
            }
        } catch(e) {
            console.error(e);
        }
    }

    function loadMoreCases() {
        loadGalleryCases(false);
    }

    function useCaseInCanvas(prompt) {
        document.getElementById('prompt-input').value = prompt;
        const canvasTab = new bootstrap.Tab(document.querySelector('button[data-bs-target="#tab-canvas"]'));
        canvasTab.show();
        document.getElementById('prompt-input').focus();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function escapeHtml(text) {
        return (text || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    }

    // ACCOUNTS TAB
    async function loadAccounts() {
        try {
            const res = await fetch('/v1/accounts');
            const data = await res.json();
            const container = document.getElementById('accounts-container');
            container.innerHTML = '';
            data.accounts.forEach(acc => {
                const col = document.createElement('div');
                col.className = 'col-md-6 col-xl-4';
                col.innerHTML = `
                    <div class="card p-3 ${acc.is_active ? 'border-primary' : 'border-secondary'}">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="badge ${acc.is_active ? 'bg-primary' : 'bg-secondary'}">Tài khoản #${acc.index}</span>
                            ${acc.is_active ? '<span class="badge bg-success">Active</span>' : ''}
                            ${acc.in_cooldown ? '<span class="badge bg-danger">429 Cooldown</span>' : ''}
                        </div>
                        <h6 class="fw-bold text-white text-truncate mb-3" title="${acc.email}">${acc.email}</h6>
                        <button class="btn btn-sm ${acc.is_active ? 'btn-secondary disabled' : 'btn-outline-primary'} w-100" onclick="switchAccount(${acc.index})">
                            ${acc.is_active ? 'Đang hoạt động' : 'Chuyển sang tài khoản này'}
                        </button>
                    </div>
                `;
                container.appendChild(col);
            });
        } catch(e) {
            console.error(e);
        }
    }

    async function switchAccount(idx) {
        try {
            const res = await fetch('/v1/accounts/switch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ account: String(idx) })
            });
            const data = await res.json();
            if (res.ok) {
                loadAccounts();
                alert(`Đã chuyển sang tài khoản #${idx}: ${data.email}`);
            }
        } catch(e) {
            alert('Lỗi: ' + e);
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        loadAccounts();
    });
</script>
</body>
</html>
"""
