.DEFAULT_GOAL := dev

SHELL := /bin/bash
PYTHON := python3
PORT ?= 8080
PROXY_PORT ?= 8899
GATEWAY_DIR := $(shell pwd)

# ANSI Color codes
BOLD  := \033[1m
GREEN := \033[32m
CYAN  := \033[36m
YELLOW:= \033[33m
RED   := \033[31m
RESET := \033[0m

.PHONY: dev start stop restart status logs test clean install help

## dev: Chạy Gateway ở chế độ Development (Hot Reloading + Foreground)
dev:
	@echo -e "$(CYAN)$(BOLD)🚀 Khởi động Agy Image Studio & Gateway (Dev Mode)...$(RESET)"
	@# Dừng background daemon nếu đang chạy để tránh xung đột cổng
	@if [ -f gateway.pid ]; then \
		PID=$$(cat gateway.pid 2>/dev/null); \
		if kill -0 $$PID 2>/dev/null; then \
			echo -e "$(YELLOW)⚠️  Đang tắt background daemon (PID: $$PID) để giải phóng port $(PORT)...$(RESET)"; \
			$(PYTHON) daemon.py stop > /dev/null 2>&1 || true; \
		fi; \
		rm -f gateway.pid; \
	fi
	@echo -e "$(GREEN)🌐 Web Studio:$(RESET)   $(BOLD)http://localhost:$(PORT)$(RESET)"
	@echo -e "$(GREEN)📚 Swagger Docs:$(RESET) $(BOLD)http://localhost:$(PORT)/docs$(RESET)"
	@echo -e "$(CYAN)⚡ Hot-reload kích hoạt: Tự động tải lại khi sửa code.$(RESET)"
	@echo -e "$(YELLOW)Nhấn Ctrl+C để dừng server.$(RESET)\n"
	@$(PYTHON) -m uvicorn main:app --host 0.0.0.0 --port $(PORT) --reload --app-dir $(GATEWAY_DIR)

## start: Chạy Gateway chạy ngầm (Background Daemon)
start:
	@echo -e "$(GREEN)🚀 Khởi chạy daemon chạy ngầm...$(RESET)"
	@$(PYTHON) daemon.py start

## stop: Dừng Gateway chạy ngầm
stop:
	@echo -e "$(RED)🛑 Dừng daemon chạy ngầm...$(RESET)"
	@$(PYTHON) daemon.py stop

## restart: Khởi động lại Gateway chạy ngầm
restart:
	@echo -e "$(CYAN)🔄 Khởi động lại daemon...$(RESET)"
	@$(PYTHON) daemon.py restart

## status: Kiểm tra trạng thái Gateway, Proxy và Accounts
status:
	@$(PYTHON) daemon.py status
	@echo ""
	@if curl -s http://127.0.0.1:$(PORT)/health > /dev/null 2>&1; then \
		echo -e "$(GREEN)✅ API Health Check:$(RESET)"; \
		curl -s http://127.0.0.1:$(PORT)/health | jq . 2>/dev/null || curl -s http://127.0.0.1:$(PORT)/health; \
	else \
		echo -e "$(RED)❌ Không thể kết nối tới http://127.0.0.1:$(PORT)$(RESET)"; \
	fi

## logs: Xem log thời gian thực của Gateway
logs:
	@tail -f gateway.log

## test: Chạy script kiểm thử tạo ảnh & gọi API
test:
	@echo -e "$(CYAN)🧪 Đang chạy kiểm thử API...$(RESET)"
	@$(PYTHON) test_client.py

## install: Cài đặt thư viện Python cần thiết
install:
	@echo -e "$(CYAN)📦 Đang cài đặt thư viện cần thiết...$(RESET)"
	@pip install -q -r requirements.txt
	@echo -e "$(GREEN)✅ Cài đặt hoàn tất.$(RESET)"

## clean: Dọn dẹp cache Python và session tạm
clean:
	@echo -e "$(YELLOW)🧹 Dọn dẹp file rác và __pycache__...$(RESET)"
	@find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@find . -type f -name "*.pyc" -delete 2>/dev/null || true
	@rm -f gateway.pid
	@echo -e "$(GREEN)✅ Dọn dẹp xong.$(RESET)"

## help: Hiển thị danh sách các lệnh make hỗ trợ
help:
	@echo -e "$(BOLD)Agy AI Studio & Image Gateway - Makefile Commands:$(RESET)"
	@echo ""
	@grep -E '^## ' $(MAKEFILE_LIST) | sed -e 's/## //' | while IFS=':' read -r cmd desc; do \
		printf "  $(CYAN)make %-12s$(RESET) %s\n" "$$cmd" "$$desc"; \
	done
	@echo ""
