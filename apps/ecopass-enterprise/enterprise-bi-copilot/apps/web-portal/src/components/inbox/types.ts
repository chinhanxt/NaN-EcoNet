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
  isPrivate: boolean;
  metadata?: Record<string, any>;
  createdAt: string | Date;
}

export interface Contact {
  id: string;
  name: string;
  identifier: string;
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
  assignedAgentId?: string;
  assignedBotId?: string;
  waitingSince?: string | Date;
  metadata?: Record<string, any>;
  createdAt: string | Date;
  updatedAt: string | Date;
}
