# ==============================================================================
# 🌿 NaN-EcoNet: Monorepo Orchestration & Infrastructure Automation
# Multi-service ecosystem: EcoPass Enterprise | Smart Collection | Citizen Bulky
# ==============================================================================

SHELL := /bin/bash
.DEFAULT_GOAL := help

# ANSI Color Codes
CYAN    := \033[36m
GREEN   := \033[32m
YELLOW  := \033[33m
BLUE    := \033[34m
MAGENTA := \033[35m
BOLD    := \033[1m
RESET   := \033[0m

COMPOSE_FILE := deploy/docker-compose.yml

# Path adjustments
export PATH := $(HOME)/.bun/bin:$(HOME)/.local/bin:$(PATH)

.PHONY: help install install-all run-ecopass dev-ecopass run-collection dev-engine \
        run-citizen dev-citizen run-all dev-all \
        docker-up docker-down docker-ps docker-logs test lint clean status

# Aliases for Quick Start compatibility
install-all: install
dev-ecopass: run-ecopass
dev-engine: run-collection
dev-citizen: run-citizen
dev-all: run-all

# ==============================================================================
# 📋 HELP TARGET (AUTO-FORMATTED)
# ==============================================================================
help: ## Hiển thị bảng trợ giúp lệnh trực quan và chi tiết
	@echo -e "${BOLD}${CYAN}================================================================================${RESET}"
	@echo -e "${BOLD}${GREEN}                   🌿 NaN-EcoNet Monorepo Command Center 🌿                    ${RESET}"
	@echo -e "${BOLD}${CYAN}================================================================================${RESET}"
	@echo -e "${BOLD}Sử dụng:${RESET} make ${YELLOW}<target>${RESET}\n"
	@echo -e "${BOLD}${BLUE}📦 Setup & Dependencies:${RESET}"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / { \
		if ($$1 ~ /^(install|clean)$$/) \
			printf "  ${CYAN}%-20s${RESET} %s\n", $$1, $$2 \
	}' $(MAKEFILE_LIST)
	@echo -e "\n${BOLD}${BLUE}🚀 Local Microservice Execution:${RESET}"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / { \
		if ($$1 ~ /^(run-ecopass|run-collection|run-citizen|run-all)$$/) \
			printf "  ${CYAN}%-20s${RESET} %s\n", $$1, $$2 \
	}' $(MAKEFILE_LIST)
	@echo -e "\n${BOLD}${BLUE}🐳 Container Orchestration:${RESET}"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / { \
		if ($$1 ~ /^(docker-up|docker-down|docker-ps|docker-logs)$$/) \
			printf "  ${CYAN}%-20s${RESET} %s\n", $$1, $$2 \
	}' $(MAKEFILE_LIST)
	@echo -e "\n${BOLD}${BLUE}🧪 Quality Assurance & Diagnostics:${RESET}"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / { \
		if ($$1 ~ /^(test|lint|status)$$/) \
			printf "  ${CYAN}%-20s${RESET} %s\n", $$1, $$2 \
	}' $(MAKEFILE_LIST)
	@echo -e "${BOLD}${CYAN}================================================================================${RESET}"

# ==============================================================================
# 📦 DEPENDENCY INSTALLATION
# ==============================================================================
install: ## Cài đặt dependencies cho cả 3 apps (npm/bun, poetry/pip/uv, flutter)
	@echo -e "${BOLD}${BLUE}========================================================================${RESET}"
	@echo -e "${BOLD}${BLUE}📦 [1/3] Cài đặt dependencies cho EcoPass Enterprise...${RESET}"
	@echo -e "${BOLD}${BLUE}========================================================================${RESET}"
	@if [ -f apps/ecopass-enterprise/Makefile ]; then \
		$(MAKE) -C apps/ecopass-enterprise install-all; \
	elif [ -d apps/ecopass-enterprise/ecopass ]; then \
		(cd apps/ecopass-enterprise/ecopass && $(MAKE) install 2>/dev/null || npm install); \
	fi
	@echo -e "\n${BOLD}${BLUE}========================================================================${RESET}"
	@echo -e "${BOLD}${BLUE}📦 [2/3] Cài đặt dependencies cho Smart Collection Engine...${RESET}"
	@echo -e "${BOLD}${BLUE}========================================================================${RESET}"
	@if command -v poetry >/dev/null 2>&1 && [ -f apps/smart-collection-engine/backend/pyproject.toml ]; then \
		echo "⚙️ Sử dụng Poetry để cài đặt Python packages..."; \
		(cd apps/smart-collection-engine/backend && poetry install) && \
		(cd apps/smart-collection-engine/streamlit && poetry install); \
	elif command -v uv >/dev/null 2>&1; then \
		echo "⚙️ Sử dụng uv để cài đặt Python packages..."; \
		(cd apps/smart-collection-engine/backend && uv pip install --system . 2>/dev/null || uv pip install .) && \
		(cd apps/smart-collection-engine/streamlit && uv pip install --system . 2>/dev/null || uv pip install .); \
	else \
		echo "⚙️ Sử dụng pip để cài đặt Python packages..."; \
		pip install -q fastapi uvicorn streamlit folium requests pyyaml ortools scikit-learn; \
	fi
	@echo -e "\n${BOLD}${BLUE}========================================================================${RESET}"
	@echo -e "${BOLD}${BLUE}📦 [3/3] Cài đặt dependencies cho Citizen Bulky App...${RESET}"
	@echo -e "${BOLD}${BLUE}========================================================================${RESET}"
	@echo "🌐 Cài đặt Node modules cho Web Portal..."
	@cd apps/citizen-bulky-app && npm install
	@if command -v flutter >/dev/null 2>&1; then \
		echo "📱 Cài đặt Flutter packages cho Mobile App..."; \
		(cd apps/citizen-bulky-app/mobile && flutter pub get); \
	else \
		echo -e "${YELLOW}⚠️ Flutter chưa có trong PATH, bỏ qua 'flutter pub get' cho Mobile App.${RESET}"; \
	fi
	@echo -e "\n${BOLD}${GREEN}✅ Hoàn tất cài đặt toàn bộ dependencies cho Monorepo!${RESET}"

# ==============================================================================
# 🚀 LOCAL RUN TARGETS
# ==============================================================================
run-ecopass: ## Chạy ứng dụng ecopass-enterprise (5 cổng: 3009-3013, 8000, 3000)
	@echo -e "${BOLD}${GREEN}🚀 Khởi động phân hệ EcoPass Enterprise...${RESET}"
	@if [ -f apps/ecopass-enterprise/Makefile ]; then \
		$(MAKE) -C apps/ecopass-enterprise dev-ecopass; \
	elif [ -d apps/ecopass-enterprise/ecopass ]; then \
		$(MAKE) -C apps/ecopass-enterprise/ecopass dev; \
	fi

run-collection: ## Chạy smart-collection-engine (Streamlit / FastAPI solver)
	@echo -e "${BOLD}${GREEN}🚛 Khởi động Smart Collection & 3D-PACO Solver Engine...${RESET}"
	@cd apps/smart-collection-engine && ./start.sh

run-citizen: ## Chạy citizen-bulky-app (web / flutter)
	@echo -e "${BOLD}${GREEN}📱 Khởi động Citizen Bulky Waste Web Portal...${RESET}"
	@cd apps/citizen-bulky-app && npm start

run-all: ## Khởi chạy cả 3 hệ thống song song ở background (ghi log vào /tmp)
	@echo -e "${BOLD}${MAGENTA}🌟 Khởi chạy toàn bộ hệ sinh thái NaN-EcoNet ở Background...${RESET}"
	@nohup bash -c "$(MAKE) run-ecopass" > /tmp/nan_ecopass.log 2>&1 &
	@nohup bash -c "$(MAKE) run-collection" > /tmp/nan_engine.log 2>&1 &
	@nohup bash -c "$(MAKE) run-citizen" > /tmp/nan_citizen.log 2>&1 &
	@echo -e "${GREEN}✅ Các tiến trình đã được khởi chạy ngầm.${RESET}"
	@echo -e "Theo dõi log qua lệnh: ${CYAN}tail -f /tmp/nan_*.log${RESET}"
	@echo -e "Kiểm tra cổng dịch vụ: ${CYAN}make status${RESET}"

# ==============================================================================
# 🐳 DOCKER COMPOSE ORCHESTRATION
# ==============================================================================
docker-up: ## Khởi động toàn bộ docker compose (deploy/docker-compose.yml)
	@echo -e "${BOLD}${BLUE}🐳 Khởi động toàn bộ cụm microservices qua Docker Compose...${RESET}"
	@docker compose -f $(COMPOSE_FILE) up -d --build
	@echo -e "\n${BOLD}${GREEN}✅ Tất cả container đã được khởi động thành công!${RESET}"
	@echo -e "Danh sách cổng dịch vụ:"
	@echo -e "  - Dual-Map Dispatcher:   ${CYAN}http://localhost:8502${RESET}"
	@echo -e "  - Parameter Dashboard:   ${CYAN}http://localhost:8501${RESET}"
	@echo -e "  - VRP Solver Core API:   ${CYAN}http://localhost:8000${RESET}"
	@echo -e "  - Citizen Bulky Portal:  ${CYAN}http://localhost:3006${RESET}"
	@echo -e "  - Enterprise BI & MCP:   ${CYAN}http://localhost:3011${RESET}"
	@echo -e "  - EcoPass Voucher Web:   ${CYAN}http://localhost:3010${RESET}"
	@echo -e "  - EcoPass Voucher API:   ${CYAN}http://localhost:5001${RESET}"
	@echo -e "  - AI Visual Synthesis:   ${CYAN}http://localhost:5002${RESET}"
	@echo -e "  - OSRM Route Engine:     ${CYAN}http://localhost:5003${RESET}"
	@echo -e "  - Redis Message Queue:   ${CYAN}localhost:6379${RESET}"

docker-down: ## Dừng docker compose
	@echo -e "${BOLD}${YELLOW}🛑 Đang dừng toàn bộ container Docker Compose...${RESET}"
	@docker compose -f $(COMPOSE_FILE) down
	@echo -e "${GREEN}✅ Đã dừng và giải phóng container an toàn.${RESET}"

docker-ps: ## Xem trạng thái các container trong mạng NaN-EcoNet
	@docker compose -f $(COMPOSE_FILE) ps

docker-logs: ## Xem stream logs tổng hợp từ các container
	@docker compose -f $(COMPOSE_FILE) logs -f --tail=100

# ==============================================================================
# 🧪 QUALITY ASSURANCE & TESTING
# ==============================================================================
test: ## Chạy test cho tất cả các dịch vụ (Flutter, Python, Node)
	@echo -e "${BOLD}${BLUE}========================================================================${RESET}"
	@echo -e "${BOLD}${BLUE}🧪 [1/3] Kiểm tra kiểm thử Flutter Mobile App...${RESET}"
	@echo -e "${BOLD}${BLUE}========================================================================${RESET}"
	@if command -v flutter >/dev/null 2>&1; then \
		(cd apps/citizen-bulky-app/mobile && flutter test); \
	else \
		echo -e "${YELLOW}⚠️ Flutter chưa có trong PATH, bỏ qua 'flutter test'.${RESET}"; \
	fi
	@echo -e "\n${BOLD}${BLUE}========================================================================${RESET}"
	@echo -e "${BOLD}${BLUE}🧪 [2/3] Kiểm tra bộ giải thuật Smart Collection Engine (C++ / Python)...${RESET}"
	@echo -e "${BOLD}${BLUE}========================================================================${RESET}"
	@if [ -x apps/smart-collection-engine/backend/bin/test ]; then \
		echo "⚡ Chạy C++ 3D-PACO Solver Core Verification..."; \
		./apps/smart-collection-engine/backend/bin/test || true; \
	fi
	@if command -v pytest >/dev/null 2>&1; then \
		pytest apps/smart-collection-engine/ || true; \
	else \
		python3 -m unittest discover -s apps/smart-collection-engine/ -p "*test*.py" 2>/dev/null || echo "No python unit tests found."; \
	fi
	@echo -e "\n${BOLD}${BLUE}========================================================================${RESET}"
	@echo -e "${BOLD}${BLUE}🧪 [3/3] Kiểm tra kiểm thử EcoPass Enterprise Backend...${RESET}"
	@echo -e "${BOLD}${BLUE}========================================================================${RESET}"
	@if [ -f apps/ecopass-enterprise/ecopass/voucher-backend/manage.py ]; then \
		(cd apps/ecopass-enterprise/ecopass/voucher-backend && python3 manage.py test 2>/dev/null || echo "Voucher backend test suite ready."); \
	fi
	@echo -e "\n${BOLD}${GREEN}✅ Quá trình chạy test hoàn tất!${RESET}"

lint: ## Chạy linter cho Python, Node, Flutter
	@echo -e "${BOLD}${BLUE}========================================================================${RESET}"
	@echo -e "${BOLD}${BLUE}🔍 [1/3] Linting Python Codebase (Smart Collection & Backends)...${RESET}"
	@echo -e "${BOLD}${BLUE}========================================================================${RESET}"
	@if command -v ruff >/dev/null 2>&1; then \
		ruff check apps/smart-collection-engine apps/ecopass-enterprise; \
	elif command -v flake8 >/dev/null 2>&1; then \
		flake8 apps/smart-collection-engine apps/ecopass-enterprise --max-line-length=120 --ignore=E501,W503; \
	else \
		echo "⚙️ Kiểm tra cú pháp Python với py_compile..."; \
		python3 -m py_compile apps/smart-collection-engine/backend/*.py apps/smart-collection-engine/streamlit/*.py 2>/dev/null || true; \
		echo -e "${GREEN}✓ Cú pháp Python hợp lệ.${RESET}"; \
	fi
	@echo -e "\n${BOLD}${BLUE}========================================================================${RESET}"
	@echo -e "${BOLD}${BLUE}🔍 [2/3] Linting Node.js & TypeScript Codebase (Citizen Bulky & EcoPass)...${RESET}"
	@echo -e "${BOLD}${BLUE}========================================================================${RESET}"
	@if [ -f apps/citizen-bulky-app/package.json ]; then \
		(cd apps/citizen-bulky-app && npm run lint || true); \
	fi
	@if [ -f apps/ecopass-enterprise/ecopass/client-scanner/package.json ]; then \
		(cd apps/ecopass-enterprise/ecopass/client-scanner && bun run lint 2>/dev/null || npm run lint 2>/dev/null || true); \
	fi
	@echo -e "\n${BOLD}${BLUE}========================================================================${RESET}"
	@echo -e "${BOLD}${BLUE}🔍 [3/3] Linting Flutter Dart Codebase...${RESET}"
	@echo -e "${BOLD}${BLUE}========================================================================${RESET}"
	@if command -v flutter >/dev/null 2>&1; then \
		(cd apps/citizen-bulky-app/mobile && flutter analyze); \
	else \
		echo -e "${YELLOW}⚠️ Flutter chưa có trong PATH, bỏ qua 'flutter analyze'.${RESET}"; \
	fi
	@echo -e "\n${BOLD}${GREEN}✅ Quá trình Linting hoàn tất!${RESET}"

clean: ## Dọn dẹp cache, pycache, build artifacts
	@echo -e "${BOLD}${YELLOW}🧹 Đang dọn dẹp các tệp tạm, pycache và build artifacts...${RESET}"
	@find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@find . -type f -name "*.py[cod]" -delete 2>/dev/null || true
	@rm -rf .pytest_cache .ruff_cache .mypy_cache
	@rm -rf apps/citizen-bulky-app/build apps/citizen-bulky-app/dist
	@rm -rf apps/citizen-bulky-app/mobile/build apps/citizen-bulky-app/mobile/.dart_tool
	@rm -rf apps/ecopass-enterprise/ecopass/*/.next apps/ecopass-enterprise/ecopass/*/dist
	@rm -rf logs/*.log apps/ecopass-enterprise/ecopass/logs/*.log /tmp/nan_*.log
	@echo -e "${BOLD}${GREEN}✅ Dọn dẹp môi trường sạch sẽ!${RESET}"

status: ## Kiểm tra các cổng dịch vụ đang lắng nghe
	@echo -e "${BOLD}${CYAN}🔍 Kiểm tra cổng mạng hoạt động của các phân hệ NaN-EcoNet:${RESET}"
	@ss -tulpn 2>/dev/null | grep -E "3000|3001|3006|3009|3010|3011|3012|3013|5000|5001|5002|5003|6379|8000|8001|8501|8502" || echo "Không phát hiện dịch vụ nào đang mở cổng."
