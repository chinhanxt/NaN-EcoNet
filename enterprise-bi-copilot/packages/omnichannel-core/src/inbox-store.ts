import { Contact, Conversation, ConversationStatus, UnifiedMessage } from './types.js';

export class InboxStore {
  private contacts: Map<string, Contact> = new Map();
  private conversations: Map<string, Conversation> = new Map();
  private messages: Map<string, UnifiedMessage[]> = new Map();

  public async findOrCreateContact(contact: Contact): Promise<Contact> {
    const existing = this.contacts.get(contact.id);
    if (existing) {
      const merged = { ...existing, ...contact, customAttributes: { ...existing.customAttributes, ...contact.customAttributes } };
      this.contacts.set(contact.id, merged);
      return merged;
    }
    this.contacts.set(contact.id, contact);
    return contact;
  }

  public async findOrCreateConversation(inboxId: string, contact: Contact): Promise<Conversation> {
    await this.findOrCreateContact(contact);

    // Tìm xem đã có cuộc trò chuyện nào của contact này trong inbox chưa resolved không
    for (const conv of this.conversations.values()) {
      if (conv.inboxId === inboxId && conv.contactId === contact.id && conv.status !== 'RESOLVED') {
        return conv;
      }
    }

    // Kênh Email là luồng thông báo / hồ sơ lưu trữ (Records/Notifications), mặc định chuyển thẳng cho Nhân viên kiểm tra (HUMAN_OPEN), không để AI tự động chat
    const isEmail = inboxId === 'email' || inboxId === 'mail' || contact.id.startsWith('email_') || (Boolean(contact.email) && inboxId.includes('email'));
    const initialStatus: ConversationStatus = isEmail ? 'HUMAN_OPEN' : 'BOT_PENDING';
    const assignedBotId = isEmail ? undefined : 'copilot_ai_bot';

    const newConv: Conversation = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      inboxId,
      contactId: contact.id,
      contact,
      status: initialStatus,
      assignedBotId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.conversations.set(newConv.id, newConv);
    this.messages.set(newConv.id, []);
    return newConv;
  }

  public async getConversation(id: string): Promise<Conversation | null> {
    return this.conversations.get(id) || null;
  }

  public async listConversations(filter?: { status?: ConversationStatus; inboxId?: string }): Promise<Conversation[]> {
    let result = Array.from(this.conversations.values());
    if (filter?.status) {
      result = result.filter(c => c.status === filter.status);
    }
    if (filter?.inboxId) {
      result = result.filter(c => c.inboxId === filter.inboxId);
    }
    return result.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  public async appendMessage(msg: UnifiedMessage): Promise<UnifiedMessage> {
    const list = this.messages.get(msg.conversationId) || [];
    list.push(msg);
    this.messages.set(msg.conversationId, list);

    const conv = this.conversations.get(msg.conversationId);
    if (conv) {
      conv.updatedAt = new Date();
    }
    return msg;
  }

  public async getMessages(conversationId: string, includePrivate: boolean = false): Promise<UnifiedMessage[]> {
    const list = this.messages.get(conversationId) || [];
    if (includePrivate) {
      return list;
    }
    return list.filter(m => !m.isPrivate);
  }

  public async deleteConversation(id: string): Promise<boolean> {
    this.messages.delete(id);
    return this.conversations.delete(id);
  }

  public async clearAll(): Promise<void> {
    this.contacts.clear();
    this.conversations.clear();
    this.messages.clear();
  }
}
