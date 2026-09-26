#!/usr/bin/env bash
set -e

# ==============================================================================
# Script tự động tạo các GitHub Issues cho dự án NaN-EcoNet
# Cách dùng:
#   export GITHUB_TOKEN="ghp_your_token_here"
#   ./scripts/create_issues.sh
# ==============================================================================

OWNER="chinhanxt"
REPO="NaN-EcoNet"

if [ -z "$GITHUB_TOKEN" ]; then
  echo "⚠️  Chưa phát hiện biến môi trường GITHUB_TOKEN."
  read -rsp "👉 Vui lòng nhập GitHub Personal Access Token (PAT): " GITHUB_TOKEN
  echo ""
fi

if [ -z "$GITHUB_TOKEN" ]; then
  echo "❌ Token không được để trống!"
  exit 1
fi

create_issue() {
  local title="$1"
  local body="$2"
  local labels="$3"

  echo "📌 Đang tạo issue: $title..."

  payload=$(jq -n \
    --arg title "$title" \
    --arg body "$body" \
    --argjson labels "$labels" \
    '{title: $title, body: $body, labels: $labels}')

  response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    https://api.github.com/repos/$OWNER/$REPO/issues \
    -d "$payload")

  http_code=$(echo "$response" | tail -n1)
  body_res=$(echo "$response" | sed '$d')

  if [ "$http_code" -eq 201 ]; then
    issue_url=$(echo "$body_res" | jq -r '.html_url')
    echo "  ✅ Thành công: $issue_url"
  else
    echo "  ❌ Thất bại (HTTP $http_code): $body_res"
  fi
}

echo "🚀 Bắt đầu tạo 9 Issues cho repo $OWNER/$REPO..."

create_issue \
  "[Architecture] Khởi tạo mô hình điều phối đa phân hệ (Workspace Multi-Service)" \
  "### Mục tiêu\nThiết lập kiến trúc điều phối tập trung cho 5 phân hệ cốt lõi trong hệ sinh thái NaN-EcoNet.\n\n### Nội dung thực hiện\n- [x] Tạo file Makefile điều khiển tập trung\n- [x] Thiết lập .gitignore chuẩn hóa loại trừ node_modules và cache\n- [x] Xây dựng README tổng quan phân hệ và registry cổng mạng\n\n### Phân hệ\nRoot Architecture" \
  '["architecture", "enhancement"]'

create_issue \
  "[EcoPass] Triển khai cơ chế khóa kép thực địa (Dual Phygital Lock: GPS + Tem ly 1-Time Burn)" \
  "### Mục tiêu\nĐảm bảo người dùng thực sự vứt rác tại trạm và ngăn chặn hành vi mang tem về nhà quét lại.\n\n### Nội dung thực hiện\n- [x] Bắt tọa độ GPS trạm quán từ trình duyệt WebApp (client-scanner:3011)\n- [x] Ký số tem ly in nhiệt với cơ chế 1-Time Burn\n- [x] Tích hợp micro-survey 3 giây khảo sát khẩu vị\n\n### Phân hệ\necopass/client-scanner, ecopass/voucher-backend" \
  '["feature", "security", "ecopass"]'

create_issue \
  "[EcoPass] Xây dựng máy POS thu ngân kiểm tra và hủy voucher (Cashier POS)" \
  "### Mục tiêu\nCung cấp giao diện thao tác nhanh dưới 5 giây cho thu ngân F&B tại quầy.\n\n### Nội dung thực hiện\n- [x] Xây dựng giao diện Cashier POS tại cổng 3009\n- [x] Tích hợp quét mã QR voucher trên điện thoại khách hàng\n- [x] Gọi API backend xác thực và burn voucher ngay lập tức\n\n### Phân hệ\necopass/cashier-pos" \
  '["feature", "ecopass"]'

create_issue \
  "[EcoPass] Thiết kế Dashboard nhãn hàng FMCG báo cáo EPR & R&D Khảo sát" \
  "### Mục tiêu\nCung cấp dữ liệu kiểm toán phát thải và báo cáo trách nhiệm mở rộng nhà sản xuất (EPR).\n\n### Nội dung thực hiện\n- [x] Dashboard theo dõi sản lượng vỏ thu hồi theo từng nhãn hàng (Port 3010)\n- [x] Xuất báo cáo dữ liệu khảo sát thị trường từ micro-survey\n- [x] Bổ sung tài liệu bảo vệ mô hình 4-Win vòng chung kết\n\n### Phân hệ\necopass/brand-portal" \
  '["feature", "analytics", "ecopass"]'

create_issue \
  "[AGY-Gateway] Xây dựng cơ chế Caching và điều phối Proxy đa nhà cung cấp AI" \
  "### Mục tiêu\nTối ưu chi phí token và độ trễ khi tạo ảnh AI quy mô lớn.\n\n### Nội dung thực hiện\n- [x] Định tuyến proxy linh hoạt giữa OpenAI, Gemini, Grok\n- [x] Lưu đệm cache kết quả prompt trùng lặp\n- [x] Daemon giám sát tiến trình và tự động phục hồi khi lỗi\n\n### Phân hệ\nagy-image-gateway" \
  '["feature", "backend"]'

create_issue \
  "[GPT-Image-2] Xây dựng thư viện so sánh phong cách trực quan (Side-by-Side Studio)" \
  "### Mục tiêu\nQuản lý và trực quan hóa hàng trăm công thức prompt chuẩn công nghiệp.\n\n### Nội dung thực hiện\n- [x] Phân loại hơn 500+ case mẫu theo danh mục kiến trúc, poster, nhiếp ảnh\n- [x] Bảng điều khiển so sánh tham số render\n- [x] Tích hợp Supabase lưu trữ case yêu thích\n\n### Phân hệ\nawesome-gpt-image-2" \
  '["feature", "ui/ux"]'

create_issue \
  "[NaN-Team] Tự động hóa phân phối nội dung đa kênh TikTok, YouTube Shorts & Facebook" \
  "### Mục tiêu\nLên lịch và xuất bản nội dung tự động lên các kênh truyền thông xã hội.\n\n### Nội dung thực hiện\n- [x] Lập lịch đăng bài và video đa nền tảng qua Postiz engine\n- [x] Tích hợp AI hỗ trợ sinh caption và tiêu đề chuẩn SEO\n- [x] Quản lý đồng bộ cookie và token phiên làm việc tự động\n\n### Phân hệ\nnan-team" \
  '["feature", "automation"]'

create_issue \
  "[BI-Copilot] Tích hợp Trợ lý phân tích dữ liệu điều hành doanh nghiệp (Executive Copilot)" \
  "### Mục tiêu\nHỗ trợ ban lãnh đạo truy vấn số liệu kinh doanh bằng ngôn ngữ tự nhiên.\n\n### Nội dung thực hiện\n- [x] Xây dựng Dashboard phân tích tài chính thời gian thực (Port 3000)\n- [x] Engine chuyển đổi câu hỏi tự nhiên thành truy vấn số liệu (Zero Mock)\n- [x] Tích hợp bộ chuyển đổi giao thức MCP Server\n\n### Phân hệ\nenterprise-bi-copilot" \
  '["feature", "analytics"]'

create_issue \
  "[DevOps] Thiết lập quy trình kiểm thử tự động và đóng gói Docker cho các phân hệ" \
  "### Mục tiêu\nĐảm bảo môi trường triển khai đồng nhất và hỗ trợ máy khác clone về chạy ngay.\n\n### Nội dung thực hiện\n- [ ] Đóng gói Docker Compose cho backend và cơ sở dữ liệu phụ trợ\n- [ ] Kiểm tra tính tương thích chéo giữa các nền tảng OS\n- [ ] Tích hợp CI/CD kiểm tra type và build tự động\n\n### Phân hệ\nWorkspace CI/CD" \
  '["devops", "enhancement"]'

echo "🎉 Hoàn tất quá trình tạo Issues!"
