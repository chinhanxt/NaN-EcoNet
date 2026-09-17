import { ChannelDriver, ChannelType, Conversation, ConversationStatus, MessageType, SenderType, UnifiedMessage } from './types.js';
import { ConversationStateMachine } from './state-machine.js';
import { OmnichannelDispatcher } from './dispatcher.js';
import { InboxStore } from './inbox-store.js';

export interface AiBrainHandlerResult {
  replyText?: string;
  needsHandoff: boolean;
  handoffReason?: string;
}

export type AiBrainHandler = (
  conversation: Conversation,
  message: UnifiedMessage
) => Promise<AiBrainHandlerResult>;

export class HandoffOrchestrator {
  private drivers: Map<ChannelType, ChannelDriver> = new Map();
  public readonly store: InboxStore;
  public readonly dispatcher: OmnichannelDispatcher;
  private aiHandler?: AiBrainHandler;

  constructor(store?: InboxStore, dispatcher?: OmnichannelDispatcher) {
    this.store = store || new InboxStore();
    this.dispatcher = dispatcher || new OmnichannelDispatcher();
  }

  public registerDriver(driver: ChannelDriver): void {
    this.drivers.set(driver.channelType, driver);
  }

  public getDriver(channelType: ChannelType): ChannelDriver | undefined {
    return this.drivers.get(channelType);
  }

  public setAiHandler(handler: AiBrainHandler): void {
    this.aiHandler = handler;
  }

  /**
   * Xử lý gói tin nhắn đến từ bất kỳ kênh nào (Web, Telegram, Email, Webhook)
   */
  public async processIncoming(
    channelType: ChannelType,
    rawPayload: any,
    inboxId: string = 'default_inbox'
  ): Promise<{ conversation: Conversation; message: UnifiedMessage; botReplied: boolean }> {
    const driver = this.drivers.get(channelType);
    if (!driver) {
      throw new Error(`No driver registered for channel type: ${channelType}`);
    }

    // 1. Chuẩn hóa payload từ kênh nguồn thành Unified format
    const normalized = await driver.normalizeIncoming(rawPayload);

    // 2. Tìm hoặc tạo cuộc trò chuyện
    const conversation = await this.store.findOrCreateConversation(inboxId, normalized.contact);
    // Ghi nhận kênh và thông tin người nhận vào metadata cuộc hội thoại
    conversation.metadata = {
      ...conversation.metadata,
      channelType,
      ...normalized.metadata,
      ...normalized.contact.customAttributes
    };

    // 3. Tạo UnifiedMessage dạng INCOMING
    const incomingMessage: UnifiedMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      conversationId: conversation.id,
      inboxId,
      senderType: 'CUSTOMER',
      senderId: normalized.contact.id,
      senderName: normalized.senderName,
      messageType: 'INCOMING',
      content: normalized.content,
      isPrivate: false,
      metadata: {
        channelType,
        ...normalized.metadata
      },
      createdAt: normalized.metadata?.date ? new Date(normalized.metadata.date) : new Date()
    };

    await this.store.appendMessage(incomingMessage);
    this.dispatcher.emit('message:created', { message: incomingMessage, conversation });

    // 4. Kiểm tra quyền của AI Bot (Kênh Email là luồng hồ sơ thông báo, không để bot tự chat spam)
    let botReplied = false;
    const isEmailChannel = channelType === 'email' || conversation.metadata?.channelType === 'email' || conversation.contact.id.startsWith('email_') || conversation.inboxId === 'email';
    if (!isEmailChannel && ConversationStateMachine.isBotAllowedToReply(conversation) && this.aiHandler) {
      const aiResult = await this.aiHandler(conversation, incomingMessage);

      if (aiResult.needsHandoff) {
        // AI chủ động kích hoạt Handoff
        const handoff = ConversationStateMachine.botHandoff(
          conversation,
          aiResult.handoffReason || 'AI yêu cầu chuyển giao sang nhân viên'
        );
        if (handoff.activityMessage) {
          await this.store.appendMessage(handoff.activityMessage);
          this.dispatcher.emit('message:created', { message: handoff.activityMessage, conversation });
        }
        this.dispatcher.emit('bot:handoff', {
          conversation,
          reason: aiResult.handoffReason || 'AI escalated to human'
        });
      } else if (aiResult.replyText) {
        // AI tự động sinh câu trả lời cho khách
        const botReply: UnifiedMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          conversationId: conversation.id,
          inboxId,
          senderType: 'AI_BOT',
          senderId: conversation.assignedBotId || 'copilot_ai_bot',
          senderName: 'Copilot AI Bot',
          messageType: 'OUTGOING',
          content: aiResult.replyText,
          isPrivate: false,
          metadata: {
            channelType,
            ...conversation.metadata
          },
          createdAt: new Date()
        };

        await this.store.appendMessage(botReply);
        this.dispatcher.emit('message:created', { message: botReply, conversation });
        await driver.sendOutgoing(botReply, conversation.metadata);
        botReplied = true;
      }
    }

    return { conversation, message: incomingMessage, botReplied };
  }

  /**
   * Cập nhật thủ công trạng thái cuộc hội thoại
   */
  public async updateConversationStatus(
    conversationId: string,
    status: ConversationStatus
  ): Promise<Conversation> {
    const conversation = await this.store.getConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    conversation.status = status;
    conversation.updatedAt = new Date();

    const activityMsg: UnifiedMessage = {
      id: `act_${Date.now()}`,
      conversationId,
      inboxId: conversation.inboxId,
      senderType: 'HUMAN_AGENT',
      senderId: 'system',
      senderName: 'Hệ thống',
      messageType: 'ACTIVITY',
      content: `Trạng thái hội thoại chuyển sang: ${status}`,
      isPrivate: true,
      createdAt: new Date()
    };
    await this.store.appendMessage(activityMsg);
    this.dispatcher.emit('message:created', { message: activityMsg, conversation });
    return conversation;
  }

  /**
   * Nhân viên (Con người) gửi tin nhắn phản hồi hoặc Private Note
   * Áp dụng quy tắc Interrupt-on-Human-Type: Lập tức gạt bỏ AI, chuyển quyền cho người!
   */
  public async sendHumanReply(
    conversationId: string,
    agentId: string,
    agentName: string,
    content: string,
    isPrivate: boolean = false,
    preferredChannelType?: ChannelType
  ): Promise<UnifiedMessage> {
    const conversation = await this.store.getConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    // Tự động nhận diện kênh nếu không truyền
    const channelType: ChannelType = preferredChannelType ||
      (conversation.metadata?.channelType as ChannelType) ||
      (conversation.contact.id.startsWith('tg_') ? 'telegram' :
       conversation.contact.id.startsWith('email_') ? 'email' : 'web_widget');

    // Nếu không phải tin nhắn riêng tư nội bộ -> Kích hoạt Human Takeover
    if (!isPrivate) {
      const handoff = ConversationStateMachine.onHumanMessageSent(conversation, agentId, agentName);
      if (handoff?.activityMessage) {
        await this.store.appendMessage(handoff.activityMessage);
        this.dispatcher.emit('message:created', { message: handoff.activityMessage, conversation });
        this.dispatcher.emit('human:takeover', { conversation, agentId, agentName });
      }
    }

    const humanMessage: UnifiedMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      conversationId,
      inboxId: conversation.inboxId,
      senderType: 'HUMAN_AGENT',
      senderId: agentId,
      senderName: agentName,
      messageType: 'OUTGOING',
      content,
      isPrivate,
      metadata: {
        channelType,
        ...conversation.metadata
      },
      createdAt: new Date()
    };

    await this.store.appendMessage(humanMessage);
    this.dispatcher.emit('message:created', { message: humanMessage, conversation });

    // Gửi ra khách hàng qua driver nếu không phải private note
    if (!isPrivate) {
      const driver = this.drivers.get(channelType);
      if (driver) {
        await driver.sendOutgoing(humanMessage, conversation.metadata);
      }
    }

    return humanMessage;
  }
}
