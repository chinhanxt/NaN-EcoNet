import { describe, it } from 'node:test';
import assert from 'node:assert';
import { 
  HandoffOrchestrator, 
  WebWidgetDriver, 
  TelegramDriver, 
  GenericWebhookDriver,
  ConversationStateMachine
} from '../src/index.js';

describe('Omnichannel Core & Human-in-the-loop Architecture', () => {
  it('1. Chuẩn hóa đa kênh (Normalization): Web Widget, Telegram và Webhook về cùng 1 định dạng', async () => {
    const orchestrator = new HandoffOrchestrator();
    orchestrator.registerDriver(new WebWidgetDriver());
    orchestrator.registerDriver(new TelegramDriver());
    orchestrator.registerDriver(new GenericWebhookDriver());

    // Ingress 1: Web Widget
    const resWeb = await orchestrator.processIncoming('web_widget', {
      sessionToken: 'sess_12345',
      senderName: 'Nguyễn Văn A',
      text: 'Xin chào, tôi cần hỏi về bảng giá'
    });
    assert.strictEqual(resWeb.message.senderName, 'Nguyễn Văn A');
    assert.strictEqual(resWeb.message.content, 'Xin chào, tôi cần hỏi về bảng giá');
    assert.strictEqual(resWeb.conversation.status, 'BOT_PENDING');

    // Ingress 2: Telegram Update
    const resTg = await orchestrator.processIncoming('telegram', {
      update_id: 9988,
      message: {
        message_id: 101,
        from: { id: 778899, is_bot: false, first_name: 'Trần', last_name: 'B' },
        chat: { id: 778899, type: 'private' },
        text: 'Hợp đồng Q3 đã đối soát chưa?',
        date: Math.floor(Date.now() / 1000)
      }
    });
    assert.strictEqual(resTg.message.senderName, 'Trần B');
    assert.strictEqual(resTg.message.content, 'Hợp đồng Q3 đã đối soát chưa?');
    assert.strictEqual(resTg.conversation.contact.identifier, '778899');
  });

  it('2. AI Auto-Pilot: Tự động trả lời khi hội thoại ở trạng thái BOT_PENDING', async () => {
    const orchestrator = new HandoffOrchestrator();
    orchestrator.registerDriver(new WebWidgetDriver());

    // Cắm bộ não AI
    orchestrator.setAiHandler(async (_conv, msg) => {
      return {
        replyText: `Chào bạn, AI đã nhận câu hỏi: "${msg.content}". Doanh thu Q3 đang vượt 108% kế hoạch.`,
        needsHandoff: false
      };
    });

    const res = await orchestrator.processIncoming('web_widget', {
      sessionToken: 'sess_client_99',
      senderName: 'Lê C',
      text: 'Doanh thu Q3 thế nào?'
    });

    assert.strictEqual(res.botReplied, true);
    
    // Kiểm tra tin nhắn trong kho lưu trữ
    const messages = await orchestrator.store.getMessages(res.conversation.id);
    assert.strictEqual(messages.length, 2); // 1 tin của khách + 1 tin trả lời của AI Bot
    assert.strictEqual(messages[0].senderType, 'CUSTOMER');
    assert.strictEqual(messages[1].senderType, 'AI_BOT');
    assert.match(messages[1].content, /Doanh thu Q3 đang vượt 108%/);
  });

  it('3. Human-in-the-loop: Nhân viên nhắn tin ➔ Tức thời tước quyền AI (Interrupt on Type)', async () => {
    const orchestrator = new HandoffOrchestrator();
    orchestrator.registerDriver(new WebWidgetDriver());

    let aiCallCount = 0;
    orchestrator.setAiHandler(async () => {
      aiCallCount++;
      return { replyText: 'Bot response', needsHandoff: false };
    });

    // Khách nhắn tin lần 1 ➔ Bot trả lời
    const res = await orchestrator.processIncoming('web_widget', {
      sessionToken: 'sess_vip_1',
      senderName: 'Khách VIP',
      text: 'Tôi cần hỗ trợ kỹ thuật gấp'
    });
    assert.strictEqual(aiCallCount, 1);
    assert.strictEqual(res.conversation.status, 'BOT_PENDING');

    // NHÂN VIÊN CAN THIỆP: Gửi tin nhắn tiếp quản
    await orchestrator.sendHumanReply(
      res.conversation.id,
      'agent_007',
      'Chí Nhân (Admin)',
      'Chào bạn, tôi là Quản trị viên. Tôi đang tiếp quản cuộc gọi này để hỗ trợ trực tiếp.'
    );

    // Kiểm tra trạng thái đã chuyển sang HUMAN_OPEN chưa
    const updatedConv = await orchestrator.store.getConversation(res.conversation.id);
    assert.strictEqual(updatedConv?.status, 'HUMAN_OPEN');
    assert.strictEqual(updatedConv?.assignedAgentId, 'agent_007');

    // Khách nhắn tin lần 2 ➔ AI PHẢI IM LẶNG TUYỆT ĐỐI (aiCallCount không được tăng)!
    const res2 = await orchestrator.processIncoming('web_widget', {
      sessionToken: 'sess_vip_1',
      senderName: 'Khách VIP',
      text: 'Dạ vâng, cảm ơn anh Nhân!'
    });

    assert.strictEqual(res2.botReplied, false); // Bot KHÔNG được rep!
    assert.strictEqual(aiCallCount, 1);          // Số lần gọi AI vẫn là 1!
  });

  it('4. AI Chủ động Escalation: Tự phát hiện ca khó và kích hoạt Handoff', async () => {
    const orchestrator = new HandoffOrchestrator();
    orchestrator.registerDriver(new WebWidgetDriver());

    // AI nhận diện câu hỏi đòi gặp sếp
    orchestrator.setAiHandler(async (_conv, msg) => {
      if (msg.content.includes('gặp giám đốc')) {
        return {
          needsHandoff: true,
          handoffReason: 'Khách hàng có khiếu nại mức độ cao, yêu cầu làm việc với Giám Đốc.'
        };
      }
      return { replyText: 'Bình thường', needsHandoff: false };
    });

    const res = await orchestrator.processIncoming('web_widget', {
      sessionToken: 'sess_escalate',
      senderName: 'Khách Khó Tính',
      text: 'Tôi muốn gặp giám đốc điều hành ngay!'
    });

    assert.strictEqual(res.conversation.status, 'HUMAN_OPEN');
    
    // Kiểm tra tin nhắn Activity / Private note ghi nhận handoff
    const allMessages = await orchestrator.store.getMessages(res.conversation.id, true);
    const activity = allMessages.find(m => m.messageType === 'ACTIVITY');
    assert.ok(activity);
    assert.match(activity.content, /yêu cầu làm việc với Giám Đốc/);
  });

  it('5. Private Notes: Ghi chú nội bộ chỉ nhân viên thấy, khách không bao giờ thấy', async () => {
    const orchestrator = new HandoffOrchestrator();
    orchestrator.registerDriver(new WebWidgetDriver());

    const res = await orchestrator.processIncoming('web_widget', {
      sessionToken: 'sess_client_private',
      senderName: 'Khách D',
      text: 'Báo giá cho tôi gói Enterprise'
    });

    // Nhân viên để lại ghi chú nội bộ (isPrivate = true)
    await orchestrator.sendHumanReply(
      res.conversation.id,
      'agent_sales',
      'Trần Sales',
      'Khách này đã ký hợp đồng 500tr năm ngoái, áp dụng chính sách chiết khấu 10%.',
      true // isPrivate = true
    );

    // Khách lấy tin nhắn (includePrivate = false) -> Không thấy ghi chú
    const customerView = await orchestrator.store.getMessages(res.conversation.id, false);
    assert.strictEqual(customerView.some(m => m.content.includes('chiết khấu 10%')), false);

    // Nội bộ lấy tin nhắn (includePrivate = true) -> Thấy đầy đủ
    const internalView = await orchestrator.store.getMessages(res.conversation.id, true);
    assert.strictEqual(internalView.some(m => m.content.includes('chiết khấu 10%')), true);
  });

  it('6. Email Channel: Chuẩn hóa email từ khách hàng thành UnifiedMessage', async () => {
    const { EmailDriver } = await import('../src/channels/email-driver.js');
    const orchestrator = new HandoffOrchestrator();
    orchestrator.registerDriver(new EmailDriver());

    const res = await orchestrator.processIncoming('email', {
      from: 'Nguyen Van A <nguyenvana@gmail.com>',
      to: 'hotro@doanhnghiep.vn',
      subject: 'Yêu cầu báo giá giải pháp chuyển đổi số',
      text: 'Chào công ty, chúng tôi muốn tích hợp bot gom tin nhắn cho 3 chi nhánh.'
    });

    assert.strictEqual(res.conversation.contact.name, 'Nguyen Van A');
    assert.strictEqual(res.conversation.contact.email, 'nguyenvana@gmail.com');
    assert.match(res.message.content, /Yêu cầu báo giá giải pháp/);
    assert.match(res.message.content, /Chào công ty/);
    assert.strictEqual(res.message.metadata?.source, 'email');
  });

  it('7. Quản lý trạng thái và tự động phát hiện kênh khi nhân viên trả lời', async () => {
    const { EmailDriver } = await import('../src/channels/email-driver.js');
    const orchestrator = new HandoffOrchestrator();
    orchestrator.registerDriver(new EmailDriver());

    const res = await orchestrator.processIncoming('email', {
      from: 'khach@congty.com',
      subject: 'Hỏi thông tin',
      text: 'Cần gặp tư vấn viên'
    });

    // Cập nhật trạng thái sang RESOLVED
    await orchestrator.updateConversationStatus(res.conversation.id, 'RESOLVED');
    const convResolved = await orchestrator.store.getConversation(res.conversation.id);
    assert.strictEqual(convResolved?.status, 'RESOLVED');

    // Nhân viên gửi phản hồi, tự động dùng email driver
    const reply = await orchestrator.sendHumanReply(
      res.conversation.id,
      'admin_01',
      'Chí Nhân',
      'Đã gửi báo giá chi tiết qua email của bạn.'
    );
    assert.strictEqual(reply.metadata?.channelType, 'email');
  });
});
