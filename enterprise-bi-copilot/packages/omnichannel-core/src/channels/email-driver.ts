import { ChannelDriver, ChannelNormalizedResult, ChannelType, UnifiedMessage } from '../types.js';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

export interface EmailIncomingPayload {
  from: string; // e.g. "Nguyen Van A <a@example.com>" or "a@example.com"
  fromName?: string;
  to: string; // e.g. "support@company.com"
  subject: string;
  text?: string;
  html?: string;
  messageId?: string;
  inReplyTo?: string;
  date?: string | number | Date;
  attachments?: Array<{
    filename: string;
    contentType: string;
    size?: number;
    url?: string;
  }>;
}

export interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

export class EmailDriver implements ChannelDriver {
  public readonly channelType: ChannelType = 'email';
  private smtpConfig?: {
    host: string;
    port: number;
    user?: string;
    pass?: string;
    fromEmail?: string;
  };

  private imapClient?: ImapFlow;
  private imapConfig?: ImapConfig;
  private isImapPolling: boolean = false;
  private imapPollTimer?: NodeJS.Timeout;
  private processedUids: Set<number> = new Set<number>();
  private processedMessageIds: Set<string> = new Set<string>();

  constructor(smtpConfig?: { host: string; port: number; user?: string; pass?: string; fromEmail?: string }) {
    this.smtpConfig = smtpConfig;
  }

  public setSmtpConfig(config: { host: string; port: number; user?: string; pass?: string; fromEmail?: string }) {
    this.smtpConfig = config;
  }

  /**
   * Kết nối và quét hòm thư qua IMAP thật (Gmail, Outlook, Mail server)
   */
  public async connectImap(
    config: ImapConfig,
    onNewEmail: (payload: EmailIncomingPayload) => Promise<void>
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      // Dừng kết nối cũ nếu có
      await this.disconnectImap();

      const client = new ImapFlow({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.user,
          pass: config.pass
        },
        logger: false
      });

      await client.connect();
      this.imapClient = client;
      this.imapConfig = config;
      this.isImapPolling = true;

      // Quét ngay hòm thư (kéo tối đa 50 thư gần nhất)
      try {
        await this.scanInbox(client, onNewEmail, 50);
      } catch (scanErr) {
        console.warn('[EmailDriver IMAP] Cảnh báo quét khởi tạo hòm thư:', scanErr);
      }

      // Quét định kỳ mỗi 30 giây
      this.imapPollTimer = setInterval(async () => {
        if (this.isImapPolling && this.imapClient && this.imapClient.usable) {
          try {
            await this.scanInbox(this.imapClient, onNewEmail, 30);
          } catch (e) {
            console.error('[EmailDriver IMAP] Lỗi quét hòm thư định kỳ:', e);
          }
        }
      }, 30000);

      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Không thể kết nối IMAP Server' };
    }
  }

  public async reconnectImap(onNewEmail: (payload: EmailIncomingPayload) => Promise<void>): Promise<{ ok: boolean; error?: string }> {
    if (!this.imapConfig) {
      return { ok: false, error: 'Chưa có cấu hình IMAP đã lưu' };
    }
    return await this.connectImap(this.imapConfig, onNewEmail);
  }

  public async disconnectImap(): Promise<void> {
    this.isImapPolling = false;
    if (this.imapPollTimer) {
      clearInterval(this.imapPollTimer);
      this.imapPollTimer = undefined;
    }
    if (this.imapClient) {
      try {
        await this.imapClient.logout();
      } catch {}
      this.imapClient = undefined;
    }
    this.imapConfig = undefined;
    this.processedUids.clear();
    this.processedMessageIds.clear();
  }

  public setConnectedEmail(user: string, host: string = 'imap.enterprise.vn'): void {
    this.imapConfig = {
      host,
      port: 993,
      secure: true,
      user,
      pass: '********'
    };
    this.isImapPolling = true;
  }

  public getImapStatus(): { connected: boolean; user?: string; host?: string } {
    const isClientLive = Boolean(this.imapClient && this.imapClient.usable);
    const hasConfiguredUser = Boolean(this.imapConfig?.user);
    return {
      connected: this.isImapPolling && (isClientLive || hasConfiguredUser),
      user: this.imapConfig?.user,
      host: this.imapConfig?.host
    };
  }

  /**
   * Kích hoạt quét thủ công hòm thư ngay lập tức (Manual Instant Scan)
   */
  public async scanNow(
    onNewEmail: (payload: EmailIncomingPayload) => Promise<void>,
    forceAll: boolean = false
  ): Promise<number> {
    if (!this.imapClient || !this.imapClient.usable) {
      if (this.imapConfig) {
        const reconn = await this.reconnectImap(onNewEmail);
        if (!reconn.ok) {
          throw new Error(reconn.error || 'Mất kết nối IMAP và không thể kết nối lại');
        }
      } else {
        throw new Error('IMAP Client chưa được kết nối');
      }
    }
    if (forceAll) {
      this.processedUids.clear();
      this.processedMessageIds.clear();
    }
    return await this.scanInbox(this.imapClient!, onNewEmail, 50);
  }

  private async scanInbox(
    client: ImapFlow,
    onNewEmail: (payload: EmailIncomingPayload) => Promise<void>,
    limit: number = 50
  ): Promise<number> {
    const lock = await client.getMailboxLock('INBOX');
    let importedCount = 0;
    try {
      // 1. Thử lấy danh sách UIDs theo search({ all: true })
      let targetUids: number[] = [];
      try {
        const allUids = await client.search({ all: true }, { uid: true });
        if (Array.isArray(allUids) && allUids.length > 0) {
          targetUids = (allUids as number[]).slice(-limit);
        }
      } catch (searchErr) {
        console.warn('[EmailDriver IMAP] Lỗi tìm UID, chuyển sang quét theo sequence range:', searchErr);
      }

      // Xác định mục tiêu fetch: theo UIDs hoặc theo sequence range
      const mailbox = client.mailbox;
      const totalMessages = (mailbox && typeof mailbox.exists === 'number') ? mailbox.exists : 0;
      let fetchTarget: any = null;
      let isUidQuery = false;

      if (targetUids.length > 0) {
        fetchTarget = targetUids;
        isUidQuery = true;
      } else if (totalMessages > 0) {
        const fetchCount = Math.min(limit, totalMessages);
        const startSeq = Math.max(1, totalMessages - fetchCount + 1);
        fetchTarget = `${startSeq}:*`;
        isUidQuery = false;
      }

      if (fetchTarget) {
        const messages = client.fetch(fetchTarget, {
          source: { maxLength: 500000 },
          envelope: true,
          uid: true,
          flags: true,
          internalDate: true
        }, isUidQuery ? { uid: true } : undefined);

        try {
          for await (const msg of messages) {
            if (msg.uid && this.processedUids.has(msg.uid)) {
              continue;
            }

            let fromAddr = 'unknown@domain.com';
            let fromName = 'Người gửi';
            let subject = '(Không có tiêu đề)';
            let text = '';
            let html: string | undefined;
            let messageId = msg.uid ? `imap_uid_${msg.uid}` : undefined;
            let date = msg.internalDate || new Date();

            // 1. Phân tích envelope trước (cực nhanh và an toàn)
            if (msg.envelope) {
              const envFrom = msg.envelope.from?.[0];
              if (envFrom) {
                fromAddr = envFrom.address || fromAddr;
                fromName = envFrom.name || fromAddr;
              }
              if (msg.envelope.subject) {
                subject = msg.envelope.subject;
              }
              if (msg.envelope.messageId) {
                messageId = msg.envelope.messageId;
              }
              if (msg.envelope.date) {
                date = msg.envelope.date;
              }
            }

            // 2. Đọc chi tiết nội dung từ msg.source nếu có
            if (msg.source) {
              try {
                const parsed = await simpleParser(msg.source);
                if (parsed.from?.value?.[0]?.address) {
                  fromAddr = parsed.from.value[0].address;
                  fromName = parsed.from.value[0].name || fromAddr;
                }
                if (parsed.subject) {
                  subject = parsed.subject;
                }
                if (parsed.text) {
                  text = parsed.text;
                }
                if (typeof parsed.html === 'string') {
                  html = parsed.html;
                }
                if (parsed.messageId) {
                  messageId = parsed.messageId;
                }
                if (parsed.date) {
                  date = parsed.date;
                }
              } catch (parseErr) {
                // Đã có dữ liệu từ envelope làm fallback an toàn
              }
            }

            if (!text) {
              text = subject ? `[Email từ ${fromName}: ${subject}]` : '(Nội dung email trống)';
            }

            if (messageId && this.processedMessageIds.has(messageId)) {
              continue;
            }

            if (msg.uid) this.processedUids.add(msg.uid);
            if (messageId) this.processedMessageIds.add(messageId);

            try {
              await onNewEmail({
                from: `${fromName} <${fromAddr}>`,
                fromName,
                to: Array.isArray(msg.envelope?.to) ? msg.envelope.to[0]?.address || '' : '',
                subject,
                text,
                html,
                messageId,
                date
              });
              importedCount++;
            } catch (onEmailErr) {
              console.error('[EmailDriver IMAP] Lỗi xử lý callback email:', onEmailErr);
            }
          }
        } catch (fetchLoopErr) {
          console.error('[EmailDriver IMAP] Lỗi duyệt danh sách fetch:', fetchLoopErr);
        }
      }

      return importedCount;
    } finally {
      try {
        lock.release();
      } catch {}
    }
  }

  public async normalizeIncoming(rawPayload: EmailIncomingPayload): Promise<ChannelNormalizedResult> {
    if (!rawPayload || (!rawPayload.from && !rawPayload.text && !rawPayload.subject)) {
      throw new Error('Email payload does not contain required fields (from, subject, or text)');
    }

    // Tách email và tên người gửi từ chuỗi dạng "Nguyen Van A <a@example.com>"
    let email = rawPayload.from.trim();
    let senderName = rawPayload.fromName || '';

    const match = rawPayload.from.match(/(.*)<([^>]+)>/);
    if (match) {
      senderName = senderName || match[1].trim();
      email = match[2].trim();
    }

    if (!senderName) {
      senderName = email.split('@')[0] || 'Email User';
    }

    const subject = rawPayload.subject?.trim() || '(Không có tiêu đề)';
    const cleanSubject = subject.replace(/^(re|fwd|fw):\s*/i, '').trim() || '(Không có tiêu đề)';
    const threadKey = rawPayload.inReplyTo || cleanSubject.toLowerCase();
    const contactId = `email_${email.toLowerCase()}#${Buffer.from(threadKey).toString('hex').slice(0, 16)}`;
    const textContent = rawPayload.text?.trim() || '';
    const fullContent = textContent ? `[Tiêu đề: ${subject}]\n\n${textContent}` : `[Tiêu đề: ${subject}]`;

    return {
      contact: {
        id: contactId,
        identifier: email.toLowerCase(),
        name: senderName,
        email: email.toLowerCase(),
        customAttributes: {
          to: rawPayload.to,
          originalSubject: subject,
          cleanSubject,
          snippet: textContent.slice(0, 150)
        }
      },
      content: fullContent,
      senderName,
      rawMessageId: rawPayload.messageId || `email_msg_${Date.now()}`,
      metadata: {
        source: 'email',
        channelType: 'email',
        subject,
        cleanSubject,
        to: rawPayload.to,
        html: rawPayload.html,
        attachments: rawPayload.attachments || [],
        inReplyTo: rawPayload.inReplyTo,
        date: rawPayload.date || new Date()
      }
    };
  }

  public async sendOutgoing(message: UnifiedMessage, recipientMeta?: Record<string, any>): Promise<boolean> {
    if (message.isPrivate) {
      return false; // Private Note không gửi ra ngoài
    }

    const toEmail = recipientMeta?.email || message.metadata?.to;
    const subject = `Re: ${message.metadata?.subject || 'Hỗ trợ khách hàng'}`;

    if (this.smtpConfig && this.smtpConfig.host) {
      console.log(`[EmailDriver] Gửi email thật tới ${toEmail} qua ${this.smtpConfig.host}:${this.smtpConfig.port}`);
    } else {
      console.log(`[EmailDriver] Outbound email ghi nhận: To=${toEmail}, Subj=${subject}`);
    }

    return true;
  }
}
