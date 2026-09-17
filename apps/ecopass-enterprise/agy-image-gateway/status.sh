#!/usr/bin/env bash
python3 /home/chinhan/agy-image-gateway/daemon.py status
echo ""
curl -s http://127.0.0.1:8080/health 2>/dev/null | python3 -m json.tool || true
