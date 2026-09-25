import { ChannelDriver, ChannelNormalizedResult, ChannelType, UnifiedMessage } from '../types.js';

export interface GenericWebhookPayload {
  customerId: string;
  customerName?: string;
  email?: string;
  phone?: string;
  message: string;
  source?: string;
  customData?: Record<string, any>;
}

export class GenericWebhookDriver implements ChannelDriver {
  public readonly channelType: ChannelType = 'generic_webhook';

  public async normalizeIncoming(rawPayload: GenericWebhookPayload): Promise<ChannelNormalizedResult> {
    if (!rawPayload.message || !rawPayload.customerId) {
      throw new Error('Generic webhook requires customerId and message');
    }

    const name = rawPayload.customerName || `Khách hàng ${rawPayload.customerId.substring(0, 6)}`;
    const contactId = `webhook_${rawPayload.customerId}`;

    return {
      contact: {
        id: contactId,
        identifier: rawPayload.customerId,
        name,
        email: rawPayload.email,
        phone: rawPayload.phone,
        customAttributes: rawPayload.customData || {}
      },
      content: rawPayload.message.trim(),
      senderName: name,
      metadata: {
        source: rawPayload.source || 'generic_webhook',
        ...rawPayload.customData
      }
    };
  }

  public async sendOutgoing(message: UnifiedMessage, recipientMeta?: Record<string, any>): Promise<boolean> {
    if (message.isPrivate) {
      return false;
    }
    return true;
  }
}
