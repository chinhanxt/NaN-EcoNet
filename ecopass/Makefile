.PHONY: dev start stop restart status url logs open install build clean help

# Mặc định khi chỉ gõ "make" sẽ tự động chạy "make dev"
.DEFAULT_GOAL := dev

# 1. Khởi chạy toàn bộ hệ thống ở chế độ Interactive Dev (Foreground)
# Tự động kích hoạt:
# - Cổng 3011: App Sinh Viên & CSDL API
# - Cổng 3010: Cổng Nhãn Hàng Brand
# - Cổng 3013: Cổng Cửa Hàng Highlands (Quản lý tem ly)
# - Cổng 3012: Cổng Đối Tác Căn Tin
# - Cổng 3009: Máy POS Thu Ngân Highlands
# - Cloudflare Tunnel: Public Web URL cho điện thoại
dev:
	@./scripts/dev.sh

# 2. Khởi chạy ở chế độ chạy ngầm (Background Daemon)
start:
	@./scripts/start.sh

# 3. Dừng toàn bộ 5 cổng và giải phóng tài nguyên
stop:
	@./scripts/stop.sh

# 4. Khởi động lại toàn bộ hệ thống
restart: stop dev

# 5. Kiểm tra trạng thái hoạt động của các cổng và đường truyền
status:
	@./scripts/status.sh

# 6. Hiển thị đường dẫn Public Web cho điện thoại
url:
	@./scripts/url.sh

# 7. Mở các cổng chính trên trình duyệt máy tính
open:
	@echo "🌐 Đang mở các cổng trên trình duyệt..."
	@(which xdg-open >/dev/null 2>&1 && xdg-open http://localhost:3013/temlynuoc >/dev/null 2>&1 || true) &
	@(which xdg-open >/dev/null 2>&1 && xdg-open http://localhost:3010 >/dev/null 2>&1 || true) &
	@(which xdg-open >/dev/null 2>&1 && xdg-open http://localhost:3011/vi >/dev/null 2>&1 || true) &

# 8. Xem log theo dõi thời gian thực
logs:
	@tail -f logs/*.log

# 9. Cài đặt toàn bộ dependencies cho cả 5 phân hệ
install:
	@echo "📦 Đang cài đặt dependencies cho toàn bộ 5 phân hệ..."
	@export PATH="/home/chinhan/.bun/bin:$$PATH" && \
	(cd client-scanner && bun install) && \
	(cd brand-portal && bun install) && \
	(cd merchant-portal && bun install) && \
	(cd partner-portal && bun install) && \
	(cd cashier-pos && bun install)
	@echo "✓ Cài đặt hoàn tất!"

# 10. Build kiểm tra toàn bộ 5 phân hệ
build:
	@echo "🔨 Build kiểm tra mã nguồn 5 phân hệ..."
	@export PATH="/home/chinhan/.bun/bin:$$PATH" && \
	(cd client-scanner && bun run build) && \
	(cd brand-portal && bun run build) && \
	(cd merchant-portal && bun run build) && \
	(cd partner-portal && bun run build) && \
	(cd cashier-pos && bun run build)
	@echo "✓ Build hoàn tất!"

# 11. Dọn dẹp logs và cache
clean:
	@echo "🧹 Dọn dẹp logs và cache tạm..."
	@rm -rf logs/*.log logs/pids.txt
	@rm -rf client-scanner/.next brand-portal/dist merchant-portal/dist partner-portal/dist cashier-pos/dist
	@echo "✓ Đã dọn dẹp xong."

# 12. Bảng hướng dẫn lệnh
help:
	@echo "======================================================================"
	@echo "                   🌿 ECOPASS - HỆ THỐNG ĐIỀU HÀNH 🌿                 "
	@echo "======================================================================"
	@echo "  make (hoặc make dev) : Khởi chạy 5 cổng + Public Web cho điện thoại"
	@echo "  make start           : Chạy ngầm toàn bộ hệ thống (background daemon)"
	@echo "  make stop            : Dừng toàn bộ 5 cổng và tắt Cloudflare tunnel"
	@echo "  make restart         : Khởi động lại toàn bộ hệ thống"
	@echo "  make status          : Kiểm tra trạng thái ONLINE/OFFLINE các cổng"
	@echo "  make url             : Lấy lại đường dẫn Public Web cho điện thoại"
	@echo "  make open            : Mở các trang quản trị trên trình duyệt"
	@echo "  make logs            : Theo dõi log hoạt động các cổng theo thời gian thực"
	@echo "  make install         : Cài đặt dependencies cho 5 phân hệ bằng bun"
	@echo "  make build           : Build kiểm tra mã nguồn cả 5 phân hệ"
	@echo "  make clean           : Dọn dẹp logs và build cache"
	@echo "======================================================================"
