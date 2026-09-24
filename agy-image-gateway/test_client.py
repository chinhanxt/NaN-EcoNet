#!/usr/bin/env python3
"""
Test client for Agy Image Gateway.
Demonstrates single image generation and batch generation for chatbots/workflows.
"""

import requests
import json
import time

GATEWAY_URL = "http://127.0.0.1:8080"

def test_health():
    print("--- 1. Kiểm tra trạng thái Gateway & 6 Tài khoản ---")
    resp = requests.get(f"{GATEWAY_URL}/health")
    print(json.dumps(resp.json(), indent=2))

def test_generate_single():
    print("\n--- 2. Test Tạo 1 Ảnh & Xóa Session Tự Động ---")
    payload = {
        "prompt": "Futuristic cyberpunk coffee cup glowing in neon night",
        "template_id": "poster-layout-system",
        "style": "Cyberpunk Neon",
        "aspect_ratio": "1:1",
        "account": "auto",
        "return_format": "url"
    }
    print(f"Gửi request: {payload['prompt']}...")
    t0 = time.time()
    resp = requests.post(f"{GATEWAY_URL}/v1/images/generate", json=payload)
    if resp.status_code == 200:
        data = resp.json()
        print(f"✅ Tạo thành công sau {round(time.time() - t0, 1)}s!")
        print(f"🔗 URL Ảnh: {data['url']}")
        print(f"📁 Tên file: {data['filename']}")
        print(f"🧹 Đã xóa Session: {data['session_cleaned']} (Session ID: {data['session_id']})")
        print(f"👤 Tài khoản sử dụng: {data['account_used']}")
    else:
        print(f"❌ Lỗi ({resp.status_code}): {resp.text}")

def test_batch_generate():
    print("\n--- 3. Test Tạo Hàng Loạt (Batch Generation) ---")
    tasks = [
        {"prompt": "A cup of green tea on wooden table", "aspect_ratio": "1:1"},
        {"prompt": "A modern smartphone mockup displaying health app", "template_id": "ui-screenshot-system", "aspect_ratio": "9:16"},
    ]
    for i, t in enumerate(tasks, 1):
        print(f"\n[Batch {i}/{len(tasks)}] Đang tạo: {t['prompt']}...")
        resp = requests.post(f"{GATEWAY_URL}/v1/images/generate", json=t)
        if resp.status_code == 200:
            res = resp.json()
            print(f" -> Thành công! URL: {res['url']} (Session {res['session_id']} cleaned)")
        else:
            print(f" -> Lỗi: {resp.text}")

if __name__ == "__main__":
    test_health()
    # Uncomment to run test:
    # test_generate_single()
