import { ChannelDriver, ChannelNormalizedResult, ChannelType, UnifiedMessage } from '../types.js';

export interface TelegramUpdatePayload {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    text?: string;
    date: number;
  };
}

export class TelegramDriver implements ChannelDriver {
  public readonly channelType: ChannelType = 'telegram';
  private botToken?: string;
  private pollingActive: boolean = false;
  private lastUpdateId: number = 0;
  private pollAbortController?: AbortController;
  private botInfo?: { id: number; username: string; first_name: string };

  constructor(botToken?: string) {
    if (botToken) {
      this.botToken = botToken;
    }
  }

  public setBotToken(token: string): void {
    this.botToken = token.trim();
  }

  public getBotToken(): string | undefined {
    return this.botToken;
  }

  public isPolling(): boolean {
    return this.pollingActive;
  }

  public getBotInfo() {
    return this.botInfo;
  }

  /**
   * Kiểm tra tính hợp lệ của Telegram Bot Token và lấy thông tin Bot
   */
  public async verifyToken(token?: string): Promise<{ ok: boolean; bot?: any; error?: string }> {
    const t = token || this.botToken;
    if (!t) {
      return { ok: false, error: 'Chưa cung cấp Telegram Bot Token' };
    }

    try {
      const res = await fetch(`https://api.telegram.org/bot${t}/getMe`);
      const data = await res.json() as any;
      if (data.ok) {
        this.botToken = t;
        this.botInfo = data.result;
        return { ok: true, bot: data.result };
      }
      return { ok: false, error: data.description || 'Token không hợp lệ' };
    } catch (err: any) {
      return { ok: false, error: `Lỗi kết nối tới Telegram API: ${err.message}` };
    }
  }

  /**
   * Bắt đầu lắng nghe tin nhắn đến qua Long-Polling
   */
  public async startPolling(
    onUpdate: (payload: TelegramUpdatePayload) => Promise<void>
  ): Promise<void> {
    if (!this.botToken) {
      throw new Error('Cần cấu hình Bot Token trước khi bật Polling.');
    }
    if (this.pollingActive) {
      return;
    }

    this.pollingActive = true;
    this.pollAbortController = new AbortController();

    // Chạy vòng lặp polling ngầm
    (async () => {
      console.log(`[TelegramDriver] Bắt đầu lắng nghe tin nhắn từ Telegram Bot (@${this.botInfo?.username || 'bot'})...`);
      while (this.pollingActive) {
        try {
          const url = `https://api.telegram.org/bot${this.botToken}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=10`;
          const res = await fetch(url, { signal: this.pollAbortController?.signal });
          const json = await res.json() as any;

          if (json.ok && Array.isArray(json.result)) {
            for (const update of json.result) {
              this.lastUpdateId = Math.max(this.lastUpdateId, update.update_id);
              if (update.message?.text) {
                await onUpdate(update);
              }
            }
          }
        } catch (err: any) {
          if (err.name === 'AbortError') {
            break;
          }
          // Chờ 3s nếu lỗi mạng rồi retry
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    })();
  }

  /**
   * Dừng lắng nghe Polling
   */
  public stopPolling(): void {
    this.pollingActive = false;
    if (this.pollAbortController) {
      this.pollAbortController.abort();
      this.pollAbortController = undefined;
    }
    console.log('[TelegramDriver] Đã dừng Telegram Polling.');
  }

  public async normalizeIncoming(rawPayload: TelegramUpdatePayload): Promise<ChannelNormalizedResult> {
    const msg = rawPayload.message;
    if (!msg || !msg.text) {
      throw new Error('Telegram payload does not contain a text message');
    }

    const senderName = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ') || msg.from.username || 'Telegram User';
    const contactId = `tg_${msg.from.id}`;

    return {
      contact: {
        id: contactId,
        identifier: String(msg.from.id),
        name: senderName,
        customAttributes: {
          telegramUsername: msg.from.username,
          chatId: msg.chat.id
        }
      },
      content: msg.text.trim(),
      senderName,
      rawMessageId: String(msg.message_id),
      metadata: {
        source: 'telegram',
        chatId: msg.chat.id,
        telegramMessageId: msg.message_id
      }
    };
  }

  public async sendOutgoing(message: UnifiedMessage, recipientMeta?: Record<string, any>): Promise<boolean> {
    if (message.isPrivate) {
      return false; // Private note không gửi ra khách
    }

    const chatId = recipientMeta?.chatId || message.metadata?.chatId;
    if (!chatId) {
      console.warn('[TelegramDriver] Không tìm thấy chatId để gửi tin nhắn Telegram');
      return false;
    }

    if (!this.botToken) {
      console.log(`[TelegramDriver (Mô phỏng)] Gửi tin tới Telegram Chat ID ${chatId}: "${message.content}"`);
      return true;
    }

    try {
      const res = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message.content
        })
      });
      const data = await res.json() as any;
      return Boolean(data.ok);
    } catch (err) {
      console.error('[TelegramDriver] Lỗi gửi tin nhắn Telegram:', err);
      return false;
    }
  }
}
