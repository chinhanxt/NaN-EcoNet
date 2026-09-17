import { ChannelDriver, ChannelNormalizedResult, ChannelType, UnifiedMessage } from '../types.js';

export interface WebWidgetPayload {
  sessionToken: string;
  senderName?: string;
  email?: string;
  text: string;
  metadata?: Record<string, any>;
}

export class WebWidgetDriver implements ChannelDriver {
  public readonly channelType: ChannelType = 'web_widget';

  public async normalizeIncoming(rawPayload: WebWidgetPayload): Promise<ChannelNormalizedResult> {
    const contactId = `web_${rawPayload.sessionToken}`;
    const name = rawPayload.senderName || 'Khách truy cập Web';

    return {
      contact: {
        id: contactId,
        identifier: rawPayload.sessionToken,
        name,
        email: rawPayload.email,
        customAttributes: rawPayload.metadata || {}
      },
      content: rawPayload.text.trim(),
      senderName: name,
      metadata: {
        source: 'web_widget',
        sessionToken: rawPayload.sessionToken,
        ...rawPayload.metadata
      }
    };
  }

  public async sendOutgoing(message: UnifiedMessage, recipientMeta?: Record<string, any>): Promise<boolean> {
    // Không gửi private notes ra cho khách hàng
    if (message.isPrivate) {
      return false;
    }
    // Trong môi trường thực tế: Đẩy qua WebSocket tới browser của khách
    return true;
  }
}
