import { Conversation, ConversationStatus, UnifiedMessage } from './types.js';

export interface HandoffResult {
  previousStatus: ConversationStatus;
  newStatus: ConversationStatus;
  activityMessage?: UnifiedMessage;
}

export class ConversationStateMachine {
  /**
   * Kiểm tra xem AI Bot có được phép trả lời trong hội thoại này không.
   * Chỉ được phép khi hội thoại đang ở trạng thái BOT_PENDING.
   * Một khi con người đã tiếp quản (HUMAN_OPEN), AI tuyệt đối im lặng.
   */
  public static isBotAllowedToReply(conversation: Conversation): boolean {
    return conversation.status === 'BOT_PENDING';
  }

  /**
   * Thực hiện Handoff: Chuyển quyền từ AI Bot sang Con người (Human-in-the-loop).
   * Kích hoạt khi AI tự phát hiện ca khó hoặc khách hàng yêu cầu gặp người thật.
   */
  public static botHandoff(
    conversation: Conversation,
    reason: string = 'Khách hàng yêu cầu hỗ trợ từ nhân viên trực tiếp.'
  ): HandoffResult {
    const prev = conversation.status;
    
    conversation.status = 'HUMAN_OPEN';
    conversation.assignedBotId = undefined;
    conversation.waitingSince = new Date();
    conversation.updatedAt = new Date();

    const activityMessage: UnifiedMessage = {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      conversationId: conversation.id,
      inboxId: conversation.inboxId,
      senderType: 'AI_BOT',
      senderId: 'system_bot',
      senderName: 'Cơ Chế Handoff Hệ Thống',
      messageType: 'ACTIVITY',
      content: `[Chuyển Giao Quyền Lực] AI đã chuyển cuộc trò chuyện sang cho Nhân viên. Lý do: ${reason}`,
      isPrivate: true, // Private Note: Chỉ nội bộ nhân viên thấy
      createdAt: new Date()
    };

    return {
      previousStatus: prev,
      newStatus: conversation.status,
      activityMessage
    };
  }

  /**
   * Quy tắc Can Thiệp Tức Thời (Interrupt-on-Human-Type):
   * Khi Nhân viên (Human Agent) gửi một tin nhắn ra:
   * Nếu cuộc hội thoại vẫn còn đang ở BOT_PENDING -> Tự động tước quyền AI và gán cho nhân viên này.
   */
  public static onHumanMessageSent(
    conversation: Conversation,
    agentId: string,
    agentName: string
  ): HandoffResult | null {
    conversation.assignedAgentId = agentId;
    conversation.waitingSince = undefined;
    conversation.updatedAt = new Date();

    if (conversation.status === 'BOT_PENDING') {
      const prev = conversation.status;
      conversation.status = 'HUMAN_OPEN';
      conversation.assignedBotId = undefined;

      const activityMessage: UnifiedMessage = {
        id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        conversationId: conversation.id,
        inboxId: conversation.inboxId,
        senderType: 'HUMAN_AGENT',
        senderId: agentId,
        senderName: agentName,
        messageType: 'ACTIVITY',
        content: `[Human Takeover] Nhân viên ${agentName} đã tham gia và tiếp quản cuộc trò chuyện từ AI.`,
        isPrivate: true,
        createdAt: new Date()
      };

      return {
        previousStatus: prev,
        newStatus: conversation.status,
        activityMessage
      };
    }

    return null;
  }

  /**
   * Đóng / Kết thúc phiên trò chuyện
   */
  public static resolve(conversation: Conversation): void {
    conversation.status = 'RESOLVED';
    conversation.updatedAt = new Date();
  }

  /**
   * Mở lại phiên trò chuyện (khi khách nhắn lại sau khi đã resolve)
   */
  public static reopen(conversation: Conversation, assignedToBot: boolean = true): void {
    conversation.status = assignedToBot ? 'BOT_PENDING' : 'HUMAN_OPEN';
    conversation.updatedAt = new Date();
  }
}
