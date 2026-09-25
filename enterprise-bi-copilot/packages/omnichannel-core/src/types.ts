export type SenderType = 'CUSTOMER' | 'AI_BOT' | 'HUMAN_AGENT';

export type MessageType = 'INCOMING' | 'OUTGOING' | 'ACTIVITY' | 'TEMPLATE';

export type ConversationStatus = 'BOT_PENDING' | 'HUMAN_OPEN' | 'RESOLVED' | 'SNOOZED';

export type ChannelType = 'web_widget' | 'telegram' | 'email' | 'generic_webhook';

export interface UnifiedMessage {
  id: string;
  conversationId: string;
  inboxId: string;
  senderType: SenderType;
  senderId: string;
  senderName: string;
  messageType: MessageType;
  content: string;
  isPrivate: boolean; // Private Note (Chỉ nội bộ nhân viên và AI thấy)
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface Contact {
  id: string;
  name: string;
  identifier: string; // e.g. telegram chat id, web session token, or email
  email?: string;
  phone?: string;
  customAttributes?: Record<string, any>;
}

export interface Conversation {
  id: string;
  inboxId: string;
  contactId: string;
  contact: Contact;
  status: ConversationStatus;
  assignedAgentId?: string; // ID của nhân viên tiếp quản
  assignedBotId?: string;   // ID của AI Bot
  waitingSince?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChannelNormalizedResult {
  contact: Contact;
  content: string;
  senderName: string;
  rawMessageId?: string;
  metadata?: Record<string, any>;
}

export interface ChannelDriver {
  readonly channelType: ChannelType;
  normalizeIncoming(rawPayload: any): Promise<ChannelNormalizedResult>;
  sendOutgoing(message: UnifiedMessage, recipientMeta?: Record<string, any>): Promise<boolean>;
}
