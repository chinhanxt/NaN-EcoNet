.PHONY: help install-all dev-ecopass dev-gateway dev-bi dev-image2 dev-mmo status clean

.DEFAULT_GOAL := help

help:
	@echo "================================================================="
	@echo "🚀 NaN-EcoNet Workspace Commands"
	@echo "================================================================="
	@echo "  make dev-ecopass   : Chạy 5 cổng hệ thống EcoPass (3009, 3010, 3011, 3012, 3013)"
	@echo "  make dev-gateway   : Chạy AGY Image Gateway (API Proxy sinh ảnh AI)"
	@echo "  make dev-bi        : Chạy Enterprise BI Copilot (Dashboard phân tích)"
	@echo "  make dev-image2    : Chạy Awesome GPT-Image-2 Studio"
	@echo "  make dev-mmo       : Chạy NaN-Team MMO / Postiz Automation"
	@echo "  make install-all   : Cài đặt dependencies cho toàn bộ dự án"
	@echo "================================================================="

dev-ecopass:
	@$(MAKE) -C ecopass dev

dev-gateway:
	@$(MAKE) -C agy-image-gateway dev

dev-bi:
	@cd enterprise-bi-copilot && pnpm dev

dev-image2:
	@cd awesome-gpt-image-2 && npm run dev

dev-mmo:
	@cd nan-team && pnpm dev
