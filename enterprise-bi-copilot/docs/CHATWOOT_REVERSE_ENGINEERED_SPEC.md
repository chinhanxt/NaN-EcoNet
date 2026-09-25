# Bóc Tách Kỹ Thuật Đầy Đủ Chatwoot (Reverse Engineering Specification)

> **Mục tiêu**: Bóc tách 100% bản chất kiến trúc và các cơ chế cốt lõi của Chatwoot (đã nghiên cứu từ kho mã nguồn `chatwoot/chatwoot`) để hiện thực hóa độc lập bằng TypeScript / Node.js trong hệ sinh thái Enterprise Copilot, không dùng phụ thuộc mã nguồn Ruby on Rails.

---

## 1. Cấu Trúc Dữ Liệu Cốt Lõi (Entity Relational Blueprint)

Chatwoot tổ chức theo mô hình phân cấp chặt chẽ:

```
[Account (Tenant)]
   ├── [Inboxes (Kênh liên lạc)] ─── [Channelable (WebWidget / Telegram / FB / API)]
   │      └── [Conversations (Cuộc trò chuyện)]
   │             ├── [Contact (Khách hàng)]
   │             ├── [Assignee (Agent người hoặc AI Bot)]
   │             └── [Messages (Chuỗi tin nhắn thời gian thực)]
   └── [Users (Quản trị viên / Nhân viên)]
```

### Chi Tiết Chuẩn Hóa Tin Nhắn (Polymorphic Message Normalization)
Trong `app/models/message.rb`, tin nhắn được chuẩn hóa theo các thuộc tính:
- `sender_type`: `'Contact'` (Khách hàng) | `'User'` (Nhân viên) | `'AgentBot'` (AI)
- `message_type`:
  - `0`: `incoming` (Khách gửi vào)
  - `1`: `outgoing` (Nhân viên hoặc Bot gửi ra)
  - `2`: `activity` (Tin hệ thống ghi nhận sự kiện: Handoff, Đổi trạng thái)
  - `3`: `template` (Tin nhắn mẫu WhatsApp/Zalo)
- `private`: `boolean` (Nếu `true`: Private Note - chỉ nội bộ nhân viên và AI thấy, không bao giờ gửi ra cho khách hàng).
- `content_type`: `text`, `input_select`, `cards`, `form`, `article`.
- `content_attributes`: Metadata nguồn (External ID, webhook receipt, message_id gốc).

---

## 2. Cỗ Máy Trạng Thái & Cơ Chế Handoff (State Machine & Human-In-The-Loop)

Chatwoot định nghĩa vòng đời cuộc hội thoại qua 4 trạng thái trong `app/models/conversation.rb`:

| Trạng thái | Ý nghĩa | AI Bot có quyền trả lời? | Nhân viên có nhận thông báo? |
| :--- | :--- | :---: | :---: |
| `BOT_PENDING` (`pending`) | AI Bot đang phụ trách trực tiếp | **CÓ** | Không (ở chế độ theo dõi) |
| `HUMAN_OPEN` (`open`) | Nhân viên thật tiếp quản | **KHÔNG** | **CÓ** (Chuông reo) |
| `SNOOZED` (`snoozed`) | Tạm hoãn chờ khách phản hồi | Không | Không |
| `RESOLVED` (`resolved`) | Đã giải quyết xong phiên chat | Không | Không |

### Quy Tắc Chuyển Giao Quyền Lực (Handoff Invariants):
1. **Quy tắc Can Thiệp Tức Thời (Interrupt-on-Human-Type)**:
   - Bất cứ khi nào một `User` (Con người) gửi một tin nhắn ra cuộc trò chuyện (hoặc bấm nút "Tiếp quản"):
   - Hệ thống tự động kích hoạt:
     ```ruby
     conversation.bot_handoff!
     ```
   - Hành động này:
     - Gỡ bỏ `ai_assignee = nil`.
     - Chuyển `status = 'open'`.
     - Bắn sự kiện `CONVERSATION_BOT_HANDOFF`.
     - Kể từ thời điểm này, mọi tin nhắn của khách đến sẽ **bỏ qua AI Bot**, chỉ thông báo cho người.

2. **Quy tắc AI Tự Leo Thang (Escalation on Intent / Low Confidence)**:
   - Khi AI phân tích thấy khách yêu cầu gặp người thật hoặc không giải quyết được vấn đề (Confidence < Ngưỡng an toàn):
   - AI gửi kèm cờ `handoff_required: true`.
   - Hệ thống chuyển `status` sang `open` và chèn 1 tin nhắn `private: true` ghi chú: *"AI đã chuyển giao cho nhân viên: Khách hàng cần hỗ trợ chuyên sâu."*

---

## 3. Kiến Trúc Bộ Điều Phối Sự Kiện (Event-Driven Dispatcher)

Chatwoot tách biệt tuyệt đối việc nhận tin và xử lý AI thông qua PubSub:
1. `MessageIngress` nhận webhook từ các kênh ➔ Chuẩn hóa thành `UnifiedMessage` ➔ Lưu DB.
2. `Dispatcher.dispatch(MESSAGE_CREATED, message)`.
3. `AgentBotListener` nhận sự kiện:
   - Kiểm tra `conversation.status == 'BOT_PENDING'`.
   - Đẩy payload sang AI Engine (LLM Worker) để sinh phản hồi.
4. `ActionCableListener` (WebSocket):
   - Pushes tin nhắn về giao diện Dashboard của nhân viên.
   - Pushes tin nhắn về Web Widget của khách hàng (loại trừ các tin `private: true`).

---

## 4. Thiết Kế Channel Drivers (Đa Nền Tảng)

Mỗi kênh (Web, Telegram, Zalo, WhatsApp) triển khai giao diện:
- `parseIncoming(rawPayload)`: Trích xuất `senderId`, `content`, `externalMessageId`.
- `sendOutgoing(conversationMeta, message)`: Gọi API tương ứng của kênh (ví dụ: `sendMessage` của Telegram Bot API hoặc WebSocket của Web Widget).
