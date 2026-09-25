"""
CLI Runner for Enterprise Diagram Engine and Agy LLM Service.
Bridge between TypeScript Node.js server and Python execution runtime.
Integrates 2-Stage AI Art Director with knowledge base from awesome-gpt-image-2.
"""

import sys
import os
import json

# Ensure python package is in sys.path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from account_manager import AccountManager
from template_engine import EnterpriseTemplateEngine
from agy_executor import EnterpriseAgyExecutor, sweep_orphaned_sessions
from text_reasoner import EnterpriseTextReasoner

def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "Missing command argument. Valid: detect_intent, generate_diagram, generate_commentary, generate_chat, list_templates, list_categories, health, auto_purge"
        }))
        sys.exit(1)

    cmd = sys.argv[1]

    # Read input payload from stdin if available, or argv[2]
    payload = {}
    if len(sys.argv) > 2 and sys.argv[2]:
        try:
            payload = json.loads(sys.argv[2])
        except Exception:
            payload = {"prompt": sys.argv[2]}
    elif not sys.stdin.isatty():
        try:
            stdin_data = sys.stdin.read().strip()
            if stdin_data:
                payload = json.loads(stdin_data)
        except Exception as e:
            print(json.dumps({"error": f"Failed to parse stdin JSON: {e}"}))
            sys.exit(1)

    account_mgr = AccountManager()
    tpl_engine = EnterpriseTemplateEngine()
    storage_dir = payload.get("storage_dir")
    executor = EnterpriseAgyExecutor(storage_dir=storage_dir)
    reasoner = EnterpriseTextReasoner(executor=executor)

    # 1. Healthcheck
    if cmd == "health":
        account_mgr.ensure_proxy_running()
        status = {
            "status": "OK",
            "proxy": account_mgr.get_proxy_status(),
            "accounts_count": len(account_mgr.get_accounts()),
            "active_account": account_mgr.get_active_account(),
            "templates_count": len(tpl_engine.list_templates()),
            "categories_count": len(tpl_engine.list_categories()),
            "storage_dir": executor.storage_dir
        }
        print(json.dumps(status))
        return

    # 2. List Templates
    if cmd == "list_templates":
        print(json.dumps({
            "templates": tpl_engine.list_templates()
        }))
        return

    # 3. List Categories
    if cmd == "list_categories":
        print(json.dumps({
            "categories": tpl_engine.list_categories()
        }))
        return

    # 4. Stage 1 Only: Detect Intent via agy CLI (No Image Render)
    if cmd == "detect_intent":
        prompt = payload.get("prompt", "")
        if not prompt:
            print(json.dumps({"success": False, "error": "Missing prompt"}))
            sys.exit(1)

        template_id = payload.get("template_id", "auto")
        aspect_ratio = payload.get("aspect_ratio", "auto")

        account_mgr.ensure_proxy_running()

        detection = executor.stage1_art_director(
            user_prompt=prompt,
            override_template=template_id,
            override_ratio=aspect_ratio
        )
        print(json.dumps({
            "success": True,
            "detection": detection
        }))
        return

    # 5. Full 2-Stage Pipeline: Detect & Generate Diagram Image
    if cmd == "generate_diagram":
        prompt = payload.get("prompt", "")
        if not prompt:
            print(json.dumps({"success": False, "error": "Missing prompt"}))
            sys.exit(1)

        template_id = payload.get("template_id", "auto")
        aspect_ratio = payload.get("aspect_ratio", "auto")
        image_name = payload.get("image_name")

        account_mgr.ensure_proxy_running()

        res = executor.generate_diagram_two_stage(
            user_prompt=prompt,
            template_id=template_id,
            aspect_ratio=aspect_ratio,
            image_name=image_name
        )

        if res.get("success"):
            output = {
                "success": True,
                "filename": res["filename"],
                "filePath": res["file_path"],
                "relativeUrl": res["relative_url"],
                "aspectRatio": res["aspect_ratio"],
                "durationSec": res["duration_sec"],
                "category": res.get("category"),
                "templateId": res.get("template_id"),
                "templateTitle": res.get("template_title"),
                "artDirectorReasoning": res.get("art_direction_reasoning"),
                "originalPrompt": prompt,
                "masterPrompt": res.get("master_prompt"),
                "guidance": res.get("guidance", []),
                "referenceCases": res.get("reference_cases", [])
            }
            print(json.dumps(output))
        else:
            print(json.dumps({
                "success": False,
                "error": res.get("error", "Diagram generation failed"),
                "details": res
            }))
        return

    # 6. Generate Executive Commentary
    if cmd == "generate_commentary":
        prompt = payload.get("prompt", "")
        context = payload.get("context", "")
        commentary = reasoner.generate_executive_commentary(prompt, context)
        print(json.dumps({"success": True, "commentary": commentary}))
        return

    # 7. Generate Conversational Chat
    if cmd == "generate_chat":
        prompt = payload.get("prompt", "")
        reply = reasoner.generate_conversational_response(prompt)
        print(json.dumps({"success": True, "reply": reply}))
        return

    # 8. Neural Intent Classification
    if cmd == "classify_intent":
        prompt = payload.get("prompt", "")
        account_mgr.ensure_proxy_running()
        decision = reasoner.classify_intent(prompt)
        print(json.dumps({"success": True, "decision": decision}))
        return

    # 9. Auto Purge Orphaned CLI Sessions
    if cmd == "auto_purge":
        purged = sweep_orphaned_sessions()
        print(json.dumps({"success": True, "purgedCount": len(purged), "purged": list(purged)}))
        return

    print(json.dumps({"error": f"Unknown command '{cmd}'"}))
    sys.exit(1)

if __name__ == "__main__":
    main()
