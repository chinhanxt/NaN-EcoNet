# =============================================================================
# ENTERPRISE EXECUTIVE COPILOT - AUTOMATED ORCHESTRATION MAKEFILE
# Complete Orchestration for Real Analytics, PostgreSQL 16 & C-Suite Portal
# =============================================================================

.DEFAULT_GOAL := dev
SHELL := /bin/bash

# Configuration
DB_CONTAINER := enterprise-copilot-postgres
DB_PORT      := 5435
DB_NAME      := enterprise_dwh
DB_USER      := postgres
DB_PASS      := PostgresAdmin2026!
BACKEND_PORT := 4000
FRONTEND_PORT:= 5173
OLLAMA_PORT  := 11434
AGY_PROXY_PORT := 8899

.PHONY: help install dev restart dev-fe dev-be db-start db-stop db-restart db-seed db-status db-logs mcp-status mcp-stdio build test status check stop clean

## help: Hiển thị bảng hướng dẫn và toàn bộ các lệnh khả dụng
help:
	@echo "=========================================================================="
	@echo " 🏛️  ENTERPRISE EXECUTIVE COPILOT — MANAGEMENT CONSOLE"
	@echo "=========================================================================="
	@echo " 🚀 Khởi chạy hệ thống:"
	@echo "   make dev         - Khởi động TẤT CẢ (PostgreSQL, Backend:4000, Frontend:5173)"
	@echo "   make restart     - Dừng và khởi động lại toàn bộ dịch vụ"
	@echo "   make dev-fe      - Chỉ chạy Frontend Portal (Vite Dev Server: 5173)"
	@echo "   make dev-be      - Chỉ chạy Backend Server (Agent Server: 4000)"
	@echo "   make stop        - Dừng toàn bộ tiến trình đang chiếm port 4000 & 5173"
	@echo ""
	@echo " 🗄️ Quản lý Cơ sở dữ liệu (PostgreSQL 16 Enterprise DWH):"
	@echo "   make db-start    - Khởi động Docker container PostgreSQL 16 (Port $(DB_PORT))"
	@echo "   make db-stop     - Tạm dừng container PostgreSQL"
	@echo "   make db-restart  - Khởi động lại container PostgreSQL"
	@echo "   make db-seed     - Nạp lại 16 giao dịch thực tế & cấu hình RLS"
	@echo "   make db-status   - Kiểm tra kết nối & số lượng bản ghi trong database"
	@echo "   make db-logs     - Xem log thời gian thực của PostgreSQL container"
	@echo ""
	@echo " 🔍 Kiểm định & Chất lượng (Zero-Mock):"
	@echo "   make status      - Kiểm tra trạng thái các port (5435, 4000, 5173, 8899)"
	@echo "   make check       - Kiểm tra tổng thể liveness của DB, Email và Services"
	@echo "   make test        - Chạy toàn bộ 46 tests tự động (Zero-Mock Verification)"
	@echo "   make build       - Biên dịch toàn bộ monorepo (Core, Packages, Apps)"
	@echo "   make mcp-status  - Kiểm tra trạng thái Model Context Protocol (MCP) Server"
	@echo "   make mcp-stdio   - Chạy MCP Stdio Runner cho Claude Desktop / MCP Inspector"
	@echo ""
	@echo " 🛠️ Bảo trì:"
	@echo "   make install     - Cài đặt dependencies qua pnpm"
	@echo "   make clean       - Dọn dẹp các thư mục dist/ và build caches"
	@echo "=========================================================================="

## install: Cài đặt toàn bộ dependencies cho monorepo qua pnpm
install:
	@echo "==> Cài đặt dependencies cho monorepo qua pnpm..."
	@pnpm install

## db-start: Đảm bảo PostgreSQL 16 container đang chạy trên port 5435
db-start:
	@if [ ! "$$(docker ps -q -f name=$(DB_CONTAINER))" ]; then \
		if [ "$$(docker ps -aq -f status=exited -f name=$(DB_CONTAINER))" ]; then \
			echo "==> Đang khởi động lại container $(DB_CONTAINER)..."; \
			docker start $(DB_CONTAINER); \
		else \
			echo "==> Tạo mới và chạy container $(DB_CONTAINER) trên port $(DB_PORT)..."; \
			docker run -d --name $(DB_CONTAINER) \
				-e POSTGRES_USER=$(DB_USER) \
				-e POSTGRES_PASSWORD=$(DB_PASS) \
				-e POSTGRES_DB=$(DB_NAME) \
				-p $(DB_PORT):5432 \
				postgres:16-alpine; \
			sleep 3; \
			$(MAKE) db-seed; \
		fi \
	else \
		echo "==> PostgreSQL container $(DB_CONTAINER) đang chạy trên port $(DB_PORT) (OK)."; \
	fi

## db-stop: Dừng container PostgreSQL
db-stop:
	@echo "==> Đang dừng container $(DB_CONTAINER)..."
	@docker stop $(DB_CONTAINER) 2>/dev/null || true
	@echo "==> Container đã dừng."

## db-restart: Khởi động lại container PostgreSQL
db-restart: db-stop db-start

## db-seed: Nạp lại dữ liệu thực tế và cấu hình phân quyền RLS
db-seed:
	@echo "==> Đang nạp schema và 16 giao dịch thực tế vào database $(DB_NAME)..."
	@PGPASSWORD="$(DB_PASS)" psql -h 127.0.0.1 -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) -f database/init.sql
	@echo "==> Hoàn tất nạp dữ liệu thật và cấu hình RLS!"

## db-status: Kiểm tra kết nối database
db-status:
	@echo "==> Kiểm tra kết nối database $(DB_NAME) (Port $(DB_PORT)):"
	@PGPASSWORD="ExecReaderSecret2026!" psql -h 127.0.0.1 -p $(DB_PORT) -U executive_reader -d $(DB_NAME) -c "SELECT COUNT(*) as total_transactions FROM revenue_transactions;"

## db-logs: Xem log container
db-logs:
	@docker logs -f $(DB_CONTAINER)

## mcp-status: Kiểm tra trạng thái Model Context Protocol (MCP) Server
mcp-status:
	@echo "==> Kiểm tra trạng thái MCP Server:"
	@curl -s http://localhost:$(BACKEND_PORT)/api/health | jq . || curl -s http://localhost:$(FRONTEND_PORT)/api/health

## mcp-stdio: Khởi chạy MCP Server qua Stdio Transport cho external MCP clients
mcp-stdio: build
	@echo "==> Khởi chạy Enterprise MCP Server qua Stdio..."
	@node apps/agent-server/dist/src/mcp-stdio-runner.js

## build: Biên dịch toàn bộ các packages và frontend
build:
	@echo "==> Đang biên dịch toàn bộ monorepo..."
	@pnpm build
	@echo "==> Biên dịch thành công 100%!"

## test: Chạy toàn bộ 46 tests tự động (Zero-Mock Enforced)
test: db-start
	@echo "==> Đang chạy bộ kiểm thử toàn diện (46/46 tests)..."
	@pnpm test

## dev: KHỞI CHẠY TOÀN BỘ HỆ THỐNG (Database, Backend, Frontend)
dev: db-start
	@echo "==> Tự động giải phóng cổng $(BACKEND_PORT) và $(FRONTEND_PORT) nếu đang bị chiếm dụng..."
	@fuser -k $(BACKEND_PORT)/tcp 2>/dev/null || true
	@fuser -k $(FRONTEND_PORT)/tcp 2>/dev/null || true
	@sleep 1
	@echo "==> Kiểm tra Antigravity CLI Engine (Gemini Pro/Flash & Proxy $(AGY_PROXY_PORT))..."
	@if curl -s http://127.0.0.1:$(AGY_PROXY_PORT)/health >/dev/null 2>&1 || nc -zv 127.0.0.1 $(AGY_PROXY_PORT) >/dev/null 2>&1; then \
		echo "    🟢 Antigravity Proxy đang trực chiến trên port $(AGY_PROXY_PORT) (6 Tài khoản xoay vòng)."; \
	else \
		echo "    ℹ️ Antigravity Proxy port $(AGY_PROXY_PORT) sẽ được tự động kích hoạt khi có yêu cầu."; \
	fi
	@echo "==> Đang biên dịch các gói lõi (Shared Types, Security, Budget, Diagram Engine, Omnichannel, Server)..."
	@pnpm --filter "!@enterprise/web-portal" build
	@echo ""
	@echo "=========================================================================="
	@echo " 🚀 ENTERPRISE EXECUTIVE COPILOT ĐANG CHẠY:"
	@echo " • Giao diện Web Portal:   http://localhost:$(FRONTEND_PORT)"
	@echo " • API Server Runtime:     http://localhost:$(BACKEND_PORT)"
	@echo " • Cơ sở dữ liệu DWH:      127.0.0.1:$(DB_PORT) ($(DB_NAME))"
	@echo " • Hộp thư Email (All):    cfo@enterprise.vn (Đã nạp 4 email C-Suite)"
	@echo " • Kênh Telegram Bot:      Long-Polling API Sẵn Sàng"
	@echo " • Chuẩn xác thực:         Zero-Mock Enforced (SHA-256 Signatures)"
	@echo "=========================================================================="
	@echo " (Nhấn Ctrl+C để dừng đồng thời cả Backend và Frontend sạch sẽ)"
	@echo ""
	@trap 'echo -e "\n==> Đang dừng toàn bộ dịch vụ..."; fuser -k $(BACKEND_PORT)/tcp 2>/dev/null || true; fuser -k $(FRONTEND_PORT)/tcp 2>/dev/null || true; kill 0 2>/dev/null || true' INT TERM EXIT; \
	(cd apps/agent-server && pnpm start) & \
	(cd apps/web-portal && pnpm dev --port $(FRONTEND_PORT) --host 0.0.0.0) & \
	wait

## restart: Dừng và khởi động lại toàn bộ hệ thống
restart: stop dev

## dev-fe: Chỉ chạy Frontend Web Portal
dev-fe:
	@fuser -k $(FRONTEND_PORT)/tcp 2>/dev/null || true
	@echo "==> Khởi chạy Vite Dev Server cho Web Portal trên port $(FRONTEND_PORT)..."
	@cd apps/web-portal && pnpm dev --port $(FRONTEND_PORT) --host 0.0.0.0

## dev-be: Chỉ chạy Backend Server
dev-be: db-start
	@fuser -k $(BACKEND_PORT)/tcp 2>/dev/null || true
	@echo "==> Khởi chạy Agent Server trên port $(BACKEND_PORT)..."
	@pnpm --filter "!@enterprise/web-portal" build
	@cd apps/agent-server && pnpm start

## status: Kiểm tra trạng thái các cổng dịch vụ
status:
	@echo "=== KIỂM TRA TRẠNG THÁI DỊCH VỤ ==="
	@echo -n "• PostgreSQL 16 (Port $(DB_PORT)): "
	@nc -zv 127.0.0.1 $(DB_PORT) 2>&1 >/dev/null && echo "🟢 ĐANG CHẠY" || echo "🔴 DỪNG"
	@echo -n "• Backend API   (Port $(BACKEND_PORT)): "
	@nc -zv 127.0.0.1 $(BACKEND_PORT) 2>&1 >/dev/null && echo "🟢 ĐANG CHẠY" || echo "⚪ CHƯA CHẠY"
	@echo -n "• Frontend UI   (Port $(FRONTEND_PORT)): "
	@nc -zv 127.0.0.1 $(FRONTEND_PORT) 2>&1 >/dev/null && echo "🟢 ĐANG CHẠY" || echo "⚪ CHƯA CHẠY"
	@echo -n "• Agy Proxy 8899 (Port $(AGY_PROXY_PORT)): "
	@nc -zv 127.0.0.1 $(AGY_PROXY_PORT) 2>&1 >/dev/null && echo "🟢 ĐANG CHẠY (Multi-Account Ready)" || echo "⚪ CHƯA BẬT (Tự động kích hoạt khi gọi)"

## check: Kiểm tra sức khỏe toàn diện
check: status
	@echo ""
	@echo "=== HEALTHCHECK CHI TIẾT ==="
	@if curl -s http://localhost:$(BACKEND_PORT)/api/health >/dev/null 2>&1; then \
		curl -s http://localhost:$(BACKEND_PORT)/api/health | jq .; \
	else \
		echo "Backend API chưa chạy trên port $(BACKEND_PORT). Hãy chạy 'make dev' để khởi động."; \
	fi
	@echo ""
	@echo "=== EMAIL MAILBOX STATUS ==="
	@curl -s http://localhost:$(BACKEND_PORT)/api/omnichannel/email/status | jq . 2>/dev/null || echo "Chưa lấy được trạng thái email."

## stop: Dừng các tiến trình dev đang chiếm port 4000 hoặc 5173
stop:
	@echo "==> Đang dừng các tiến trình đang chiếm port $(BACKEND_PORT) và $(FRONTEND_PORT)..."
	@fuser -k $(BACKEND_PORT)/tcp 2>/dev/null || true
	@fuser -k $(FRONTEND_PORT)/tcp 2>/dev/null || true
	@echo "==> Đã giải phóng các port!"

## clean: Xóa các thư mục build dist/
clean:
	@echo "==> Dọn dẹp thư mục dist/..."
	@rm -rf packages/*/dist apps/*/dist
	@echo "==> Dọn dẹp hoàn tất."
