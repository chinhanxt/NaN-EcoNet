# ==============================================================================
# NAN-TEAM MMO DEVELOPMENT & ORCHESTRATION MAKEFILE
# Native development without container tooling.
# ==============================================================================

SHELL := /bin/bash
.DEFAULT_GOAL := help

# Colors for terminal output
BOLD    := \033[1m
GREEN   := \033[32m
CYAN    := \033[36m
YELLOW  := \033[33m
RED     := \033[31m
RESET   := \033[0m

.PHONY: help dev stop restart restart-app restart-fe restart-be restart-orch logs status ps db-shell clean test-health warmup

## help: Show this help message
help:
	@echo -e ""
	@echo -e "$(BOLD)$(GREEN)NaN-Team Native Dev Stack$(RESET)"
	@echo -e "Usage: $(CYAN)make$(RESET) $(YELLOW)<target>$(RESET)"
	@echo -e ""
	@echo -e "$(BOLD)Available Commands:$(RESET)"
	@sed -n 's/^## //p' $(MAKEFILE_LIST) | awk -F ':' '{ printf "  $(CYAN)%-16s$(RESET) %s\n", $$1, $$2 }'
	@echo -e ""

## dev: Start the native dev stack in foreground (Ctrl+C to stop)
dev:
	@bash config/dev-native.sh dev

## stop: Stop the native dev stack and free all ports
stop:
	@bash config/dev-native.sh stop

## restart: Restart the full native dev stack cleanly
restart:
	@bash config/dev-native.sh stop
	@sleep 1
	@bash config/dev-native.sh dev

## restart-app: Restart the native frontend, backend, and worker
restart-app:
	@bash config/dev-native.sh restart-app

## restart-fe: Restart the native Next.js frontend
restart-fe:
	@bash config/dev-native.sh restart-frontend

## restart-be: Restart the native NestJS backend (auto-builds if needed)
restart-be:
	@bash config/dev-native.sh restart-backend

## restart-orch: Restart the native Orchestrator worker (auto-builds if needed)
restart-orch:
	@bash config/dev-native.sh restart-orchestrator

## build: Rebuild both Backend and Orchestrator
build:
	@pnpm --filter ./apps/backend run build
	@pnpm --filter ./apps/orchestrator run build

## build-be: Rebuild NestJS Backend
build-be:
	@pnpm --filter ./apps/backend run build

## build-orch: Rebuild Orchestrator Worker
build-orch:
	@pnpm --filter ./apps/orchestrator run build

## prisma-gen: Generate Prisma Client from schema
prisma-gen:
	@pnpm prisma-generate

## logs: View native service logs
logs:
	@tail -n 100 -f $(HOME)/.local/share/postiz-dev/logs/*.log

## status: Check native dev endpoints and services
status:
	@$(MAKE) test-health

## ps: Alias for 'status'
ps: status

## db-shell: Open the native PostgreSQL dev database
db-shell:
	@psql -h 127.0.0.1 -p 5433 -U postiz-dev -d postiz-dev

## test-health: Test HTTP and database connectivity
test-health:
	@echo -e "$(CYAN)--> Checking NaN-Team Dev services...$(RESET)"
	@pg_isready -q -h 127.0.0.1 -p 5433 && echo -e "    $(GREEN)✔ PostgreSQL dev database (:5433)$(RESET)" || echo -e "    $(RED)✘ PostgreSQL (:5433)$(RESET)"
	@bash config/dev-native.sh status-redis 2>/dev/null && echo -e "    $(GREEN)✔ Redis server (:6380)$(RESET)" || echo -e "    $(RED)✘ Redis (:6380)$(RESET)"
	@curl -fsS -o /dev/null http://127.0.0.1:3000/ && echo -e "    $(GREEN)✔ Backend API (:3000)$(RESET)" || echo -e "    $(RED)✘ Backend API (:3000)$(RESET)"
	@curl -fsS -o /dev/null http://127.0.0.1:3002/health/status && echo -e "    $(GREEN)✔ Worker / Orchestrator (:3002)$(RESET)" || echo -e "    $(RED)✘ Worker (:3002)$(RESET)"
	@curl -fsS -o /dev/null http://127.0.0.1:4200/auth && echo -e "    $(GREEN)✔ Frontend Next.js (:4200)$(RESET)" || echo -e "    $(RED)✘ Frontend (:4200)$(RESET)"
	@curl -fsS -o /dev/null http://127.0.0.1:8233/ && echo -e "    $(GREEN)✔ Temporal UI (:8233)$(RESET)" || echo -e "    $(RED)✘ Temporal UI (:8233)$(RESET)"
	@curl -fsS -o /dev/null http://127.0.0.1:8080/health && echo -e "    $(GREEN)✔ Agy AI Gateway (:8080)$(RESET)" || echo -e "    $(YELLOW)⚠ Agy AI Gateway (:8080) stopped$(RESET)"

## start-gateway: Start Agy Image Gateway service (:8080)
start-gateway:
	@bash /home/chinhan/agy-image-gateway/start.sh

## stop-gateway: Stop Agy Image Gateway service
stop-gateway:
	@bash /home/chinhan/agy-image-gateway/stop.sh

## restart-gateway: Restart Agy Image Gateway service
restart-gateway: stop-gateway start-gateway

## warmup: Precompile the main frontend tabs on demand
warmup:
	@bash config/warmup-native.sh

## login-fb: Open Chrome with Facebook profile to log in visually on screen
login-fb:
	@rm -f /home/chinhan/.config/postiz-fb-profile/Singleton*
	@google-chrome --user-data-dir=/home/chinhan/.config/postiz-fb-profile "https://business.facebook.com/latest/composer" &

## login-yt: Open Chrome with YouTube profile to log in visually on screen
login-yt:
	@rm -f /home/chinhan/.config/postiz-youtube-profile/Singleton*
	@google-chrome --user-data-dir=/home/chinhan/.config/postiz-youtube-profile "https://studio.youtube.com" &

## login-tiktok: Open Chrome with TikTok profile to log in visually on screen
login-tiktok:
	@rm -f /home/chinhan/.config/postiz-tiktok-profile/Singleton*
	@google-chrome --user-data-dir=/home/chinhan/.config/postiz-tiktok-profile "https://www.tiktok.com/tiktokstudio/upload" &

## sync-cookies: Sync cookies from Chrome profiles to database
sync-cookies:
	@NODE_PATH=node_modules:apps/orchestrator/node_modules node scripts/sync-profile-cookies.js

## clean: Stop the native dev stack
clean: stop
