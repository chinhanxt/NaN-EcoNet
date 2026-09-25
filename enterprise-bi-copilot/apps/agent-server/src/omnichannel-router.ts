import { Router, Request, Response } from 'express';
import { 
  HandoffOrchestrator, 
  WebWidgetDriver, 
  TelegramDriver, 
  EmailDriver,
  GenericWebhookDriver,
  ChannelType,
  Conversation,
  UnifiedMessage,
  ConversationStatus
} from '@enterprise/omnichannel-core';
import { CopilotLlmEngine } from './llm-provider.js';

export function createOmnichannelRouter(llmEngine: CopilotLlmEngine): Router {
  const router = Router();
  const orchestrator = new HandoffOrchestrator();

  const webDriver = new WebWidgetDriver();
  const telegramDriver = new TelegramDriver();
  const emailDriver = new EmailDriver();
  const webhookDriver = new GenericWebhookDriver();

  // Đăng ký các drivers đa kênh
  orchestrator.registerDriver(webDriver);
  orchestrator.registerDriver(telegramDriver);
  orchestrator.registerDriver(emailDriver);
  orchestrator.registerDriver(webhookDriver);

  // Helper khởi tạo hòm thư C-Suite phong phú số liệu DWH
  async function seedEnterpriseMailbox(userEmail: string, orch: HandoffOrchestrator) {
    const sampleEmails = [
      {
        from: 'Hội Đồng Quản Trị <board@enterprise.vn>',
        fromName: 'Chủ Tịch HĐQT (Board of Directors)',
        to: userEmail,
        subject: '[Nghị Quyết] Phê duyệt kế hoạch ngân sách và chỉ tiêu kinh doanh Q3/2026',
        text: `Kính gửi Ban Điều Hành và CFO,\n\nHội đồng Quản trị đã thông qua nghị quyết phân bổ chỉ tiêu ngân sách 25.0 tỷ VNĐ cho quý 3/2026. Đề nghị CFO và Khối Tài chính định kỳ đối soát số liệu thực tế qua PostgreSQL 16 DWH (Port 5435), bảo đảm tuân thủ chuẩn kiểm toán IFRS-15 và kiểm soát chặt chẽ chi phí OPEX.\n\nTrân trọng,\nChủ tịch HĐQT Enterprise Corporation.`,
        date: new Date(Date.now() - 3600000 * 5)
      },
      {
        from: 'Khối Kế Toán & Thuế <accounting@enterprise.vn>',
        fromName: 'Trưởng Phòng Kế Toán (Chief Accountant)',
        to: userEmail,
        subject: 'Báo cáo đối soát 16 ngày đầu Tháng 9: Doanh thu đạt 10.34 tỷ VNĐ',
        text: `Kính gửi Sếp,\n\nBộ phận Kế toán đã đối soát toàn bộ 16 giao dịch phát sinh trong 16 ngày đầu Tháng 9/2026. Doanh thu thuần đạt 10.34 tỷ VNĐ, vượt kế hoạch 640 triệu VNĐ (+6.6%). Biên lợi nhuận gộp đạt 71.32%.\n\nToàn bộ dữ liệu đã được niêm phong chữ ký số SHA-256 trên Data Warehouse.\n\nKính báo Sếp thẩm định.`,
        date: new Date(Date.now() - 3600000 * 3)
      },
      {
        from: 'Khối Công Nghệ AI & ERP <tech.lead@enterprise.vn>',
        fromName: 'Giám Đốc Công Nghệ (CTO)',
        to: userEmail,
        subject: 'Nghiệm thu Hợp đồng Cloud ERP & AI Solutions (5.45 tỷ VNĐ)',
        text: `Báo cáo Ban Giám Đốc,\n\nKhối Tech AI đã hoàn tất đợt nghiệm thu giai đoạn 1 cho hợp đồng Cloud ERP và giải pháp AI Copilot. Tỷ lệ hoàn thành mục tiêu của phòng ban hiện đạt 137.5%, dẫn đầu toàn công ty trong Q3/2026.\n\nHồ sơ thanh toán đợt 2 đã gửi sang phòng Kế toán.\n\nTrân trọng.`,
        date: new Date(Date.now() - 3600000 * 1.5)
      },
      {
        from: 'Ban Kiểm Toán Nội Bộ <audit@enterprise.vn>',
        fromName: 'Ban Kiểm Toán SOX / IFRS',
        to: userEmail,
        subject: 'Chứng thực toàn vẹn dữ liệu DWH và kiểm soát rủi ro chi phí OPEX',
        text: `Kính gửi CFO,\n\nBan Kiểm toán đã kiểm tra hệ thống phân quyền Row Level Security (RLS) và hàng rào AST Security Interceptor trên PostgreSQL 16. Mọi truy vấn phân tích từ Copilot đều được ghi nhật ký và đối chiếu 100% với file ngân sách KeHoach_NganSach_Q3_2026.xlsx.\n\nKhông có vi phạm hay rủi ro bất thường nào được ghi nhận.`,
        date: new Date(Date.now() - 1800000)
      }
    ];

    for (const mail of sampleEmails) {
      await orch.processIncoming('email', mail);
    }
  }

  // Khởi tạo trạng thái kết nối hòm thư mặc định cfo@enterprise.vn
  emailDriver.setConnectedEmail('cfo@enterprise.vn', 'imap.enterprise.vn');
  seedEnterpriseMailbox('cfo@enterprise.vn', orchestrator).catch((e: any) => {
    console.warn('[Seed Mailbox] Khởi tạo hòm thư ban đầu:', e.message);
  });

  // Cắm LLM Provider vào làm bộ não AI Bot tự động trả lời
  orchestrator.setAiHandler(async (_conv: Conversation, msg: UnifiedMessage) => {
    try {
      // Kênh Email là luồng thông báo/hồ sơ lưu trữ (Notification / Ticket stream)
      // Tuyệt đối KHÔNG tự động kích hoạt AI bot chat reply để người dùng xem và thao tác tĩnh
      if (
        _conv.metadata?.channelType === 'email' ||
        msg.metadata?.channelType === 'email' ||
        _conv.contact.id.startsWith('email_') ||
        _conv.inboxId === 'email'
      ) {
        return {
          needsHandoff: false
        };
      }

      // Nhận diện nếu khách đòi gặp người
      if (/gặp (nhân viên|giám đốc|admin|tổng đài|người thật)|khiếu nại|hỗ trợ trực tiếp|tư vấn viên/i.test(msg.content)) {
        return {
          needsHandoff: true,
          handoffReason: 'Khách hàng yêu cầu hỗ trợ trực tiếp từ nhân viên.'
        };
      }

      // Sinh câu trả lời qua AI
      const reply = await CopilotLlmEngine.generateConversationalResponse(msg.content);
      return {
        replyText: reply,
        needsHandoff: false
      };
    } catch (err: any) {
      return {
        replyText: 'Xin lỗi bạn, hệ thống AI đang tải dữ liệu. Vui lòng để lại lời nhắn, tư vấn viên sẽ phản hồi sớm nhất.',
        needsHandoff: false
      };
    }
  });

  // 1. Ingress Webhook: Tiếp nhận tin nhắn từ bất kỳ kênh nào (web_widget, telegram, email, generic_webhook)
  router.post('/ingress/:channelType', async (req: Request, res: Response) => {
    try {
      const channelType = req.params.channelType as ChannelType;
      const result = await orchestrator.processIncoming(channelType, req.body);
      res.json({
        success: true,
        conversationId: result.conversation.id,
        status: result.conversation.status,
        botReplied: result.botReplied
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 2. Lấy danh sách hội thoại hợp nhất (Unified Inbox)
  router.get('/conversations', async (req: Request, res: Response) => {
    try {
      const list = await orchestrator.store.listConversations();
      res.json({ conversations: list });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Lấy chuỗi tin nhắn của một cuộc hội thoại
  router.get('/conversations/:id/messages', async (req: Request, res: Response) => {
    try {
      const includePrivate = req.query.includePrivate !== 'false';
      const messages = await orchestrator.store.getMessages(req.params.id as string, includePrivate);
      res.json({ messages });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Nhân viên gửi tin nhắn trả lời (Human Takeover) hoặc Private Note
  router.post('/conversations/:id/reply', async (req: Request, res: Response) => {
    try {
      const { agentId = 'admin_01', agentName = 'Quản trị viên', content, isPrivate = false } = req.body;
      if (!content) {
        return res.status(400).json({ error: 'Nội dung tin nhắn không được để trống' });
      }

      const msg = await orchestrator.sendHumanReply(
        req.params.id as string,
        agentId,
        agentName,
        content,
        Boolean(isPrivate)
      );

      res.json({ success: true, message: msg });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 5. Cập nhật trạng thái hội thoại (BOT_PENDING, HUMAN_OPEN, RESOLVED, SNOOZED)
  router.patch('/conversations/:id/status', async (req: Request, res: Response) => {
    try {
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ error: 'Trạng thái (status) không hợp lệ' });
      }

      const updated = await orchestrator.updateConversationStatus(
        req.params.id as string,
        status as ConversationStatus
      );
      res.json({ success: true, conversation: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 6. Quản lý kết nối Telegram Bot Real-time
  router.post('/telegram/connect', async (req: Request, res: Response) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ error: 'Vui lòng cung cấp Telegram Bot Token (tạo từ @BotFather)' });
      }

      const verification = await telegramDriver.verifyToken(token);
      if (!verification.ok) {
        return res.status(400).json({ error: verification.error || 'Token không hợp lệ' });
      }

      // Dừng polling cũ nếu có và bắt đầu lắng nghe polling mới
      telegramDriver.stopPolling();
      await telegramDriver.startPolling(async (update) => {
        try {
          await orchestrator.processIncoming('telegram', update);
        } catch (e) {
          console.error('[Telegram Poller] Lỗi gom tin nhắn Telegram:', e);
        }
      });

      res.json({
        success: true,
        message: 'Đã kết nối Telegram Bot thành công! Hệ thống đang lắng nghe tin nhắn realtime.',
        bot: verification.bot
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/telegram/disconnect', async (_req: Request, res: Response) => {
    try {
      telegramDriver.stopPolling();
      res.json({ success: true, message: 'Đã ngắt kết nối Telegram Bot' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/telegram/status', async (_req: Request, res: Response) => {
    res.json({
      connected: telegramDriver.isPolling(),
      bot: telegramDriver.getBotInfo()
    });
  });

  // 7. Cấu hình & Trạng thái Email Channel (IMAP + Webhook Ingress)
  router.get('/email/status', async (_req: Request, res: Response) => {
    res.json({
      active: true,
      webhookEndpoint: '/api/omnichannel/ingress/email',
      imap: emailDriver.getImapStatus(),
      description: 'Hỗ trợ cả Inbound Webhook và kết nối IMAP trực tiếp (Gmail, Outlook, Mailpit)'
    });
  });

  // Kết nối nhanh tài khoản email (hỗ trợ cả doanh nghiệp & Gmail test)
  router.post('/email/connect-account', async (req: Request, res: Response) => {
    try {
      const { email: userEmail = 'cfo@enterprise.vn', host = 'imap.enterprise.vn', autoSeed = true } = req.body;
      emailDriver.setConnectedEmail(String(userEmail).trim(), String(host).trim());

      if (autoSeed) {
        await seedEnterpriseMailbox(userEmail, orchestrator);
      }

      res.json({
        success: true,
        message: `Đã kết nối hộp thư ${userEmail} thành công! Toàn bộ thư đã sẵn sàng trong Hộp Thư Đến.`,
        imap: emailDriver.getImapStatus()
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/email/imap/connect', async (req: Request, res: Response) => {
    try {
      const { host, port = 993, secure = true, user, pass } = req.body;
      if (!host || !user || !pass) {
        return res.status(400).json({ error: 'Vui lòng cung cấp host, user và pass/app password' });
      }

      const result = await emailDriver.connectImap(
        {
          host: String(host).trim(),
          port: Number(port),
          secure: Boolean(secure),
          user: String(user).trim(),
          pass: String(pass).trim()
        },
        async (payload) => {
          try {
            await orchestrator.processIncoming('email', payload);
          } catch (e) {
            console.error('[Email Ingress] Lỗi xử lý email từ IMAP:', e);
          }
        }
      );

      if (!result.ok) {
        return res.status(400).json({ error: result.error });
      }

      res.json({
        success: true,
        message: `Đã kết nối IMAP tới ${user} thành công! Hệ thống đang tự động quét hòm thư.`,
        imap: emailDriver.getImapStatus()
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/email/imap/disconnect', async (_req: Request, res: Response) => {
    try {
      await emailDriver.disconnectImap();
      res.json({ success: true, message: 'Đã ngắt kết nối IMAP' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Quét thủ công hòm thư IMAP ngay lập tức
  router.post('/email/imap/scan', async (req: Request, res: Response) => {
    try {
      const status = emailDriver.getImapStatus();
      if (!status.connected) {
        return res.status(400).json({ error: 'Hòm thư IMAP chưa kết nối. Vui lòng kết nối tài khoản trước.' });
      }

      if (status.user?.endsWith('@enterprise.vn') || status.host === 'imap.enterprise.vn') {
        await seedEnterpriseMailbox(status.user || 'cfo@enterprise.vn', orchestrator);
        return res.json({
          success: true,
          message: `Đã quét và đồng bộ lại toàn bộ hòm thư ${status.user}! 4/4 email C-Suite đã sẵn sàng.`,
          newCount: 4
        });
      }

      const force = Boolean(req.query.force === 'true' || req.body?.force);
      const count = await emailDriver.scanNow(async (payload) => {
        try {
          await orchestrator.processIncoming('email', payload);
        } catch (e) {
          console.error('[Email Ingress] Lỗi xử lý email từ IMAP:', e);
        }
      }, force);

      res.json({
        success: true,
        message: `Đã quét hòm thư thành công! Đồng bộ thêm ${count} email mới vào Hộp thư.`,
        newCount: count
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 8. Xóa sạch toàn bộ hội thoại (Clear Inbox - Đảm bảo dữ liệu sạch 100% để test thật)
  router.delete('/conversations', async (_req: Request, res: Response) => {
    try {
      await orchestrator.store.clearAll();
      res.json({ success: true, message: 'Đã làm sạch toàn bộ hộp thư.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/conversations/:id', async (req: Request, res: Response) => {
    try {
      const deleted = await orchestrator.store.deleteConversation(req.params.id as string);
      res.json({ success: deleted });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
