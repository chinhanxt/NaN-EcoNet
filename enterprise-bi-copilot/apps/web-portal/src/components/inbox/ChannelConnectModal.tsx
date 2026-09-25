import React, { useState, useEffect } from 'react';
import { Radio, RefreshCw, X, Trash2, KeyRound, Sparkles } from 'lucide-react';
import { 
  TelegramSvg, 
  EmailSvg, 
  WebWidgetSvg, 
  CopySvg, 
  CheckSvg 
} from '../chatgpt/SvgIcons';

interface ChannelConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshInbox: () => void;
  onEmailConnected?: (emailUser: string) => void;
}

export const ChannelConnectModal: React.FC<ChannelConnectModalProps> = ({
  isOpen,
  onClose,
  onRefreshInbox,
  onEmailConnected
}) => {
  const [activeTab, setActiveTab] = useState<'telegram' | 'email' | 'web'>('telegram');

  // Telegram state
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramStatus, setTelegramStatus] = useState<{ connected: boolean; bot?: any }>({ connected: false });
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramError, setTelegramError] = useState<string | null>(null);
  const [telegramSuccess, setTelegramSuccess] = useState<string | null>(null);

  // IMAP Email state
  const [imapUser, setImapUser] = useState('');
  const [imapPass, setImapPass] = useState('');
  const [imapHost, setImapHost] = useState('imap.gmail.com');
  const [imapPort, setImapPort] = useState('993');
  const [imapStatus, setImapStatus] = useState<{ connected: boolean; user?: string; host?: string }>({ connected: false });
  const [imapLoading, setImapLoading] = useState(false);
  const [imapError, setImapError] = useState<string | null>(null);
  const [imapSuccess, setImapSuccess] = useState<string | null>(null);

  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Fetch Status
  const fetchChannelStatus = async () => {
    try {
      const [tgRes, emRes] = await Promise.all([
        fetch('/api/omnichannel/telegram/status'),
        fetch('/api/omnichannel/email/status')
      ]);
      if (tgRes.ok) {
        const tgData = await tgRes.json();
        setTelegramStatus(tgData);
      }
      if (emRes.ok) {
        const emData = await emRes.json();
        if (emData.imap) setImapStatus(emData.imap);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchChannelStatus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Connect Telegram Token
  const handleConnectTelegram = async () => {
    if (!telegramToken.trim()) {
      setTelegramError('Vui lòng nhập Telegram Bot Token');
      return;
    }

    setTelegramLoading(true);
    setTelegramError(null);
    setTelegramSuccess(null);

    try {
      const res = await fetch('/api/omnichannel/telegram/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: telegramToken.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Không thể kết nối Telegram Bot');
      }

      setTelegramSuccess(`Đã kết nối thành công Bot @${data.bot?.username}! Hệ thống đang lắng nghe tin nhắn realtime.`);
      setTelegramStatus({ connected: true, bot: data.bot });
      setTelegramToken('');
      onRefreshInbox();
    } catch (err: any) {
      setTelegramError(err.message);
    } finally {
      setTelegramLoading(false);
    }
  };

  // Disconnect Telegram
  const handleDisconnectTelegram = async () => {
    setTelegramLoading(true);
    try {
      await fetch('/api/omnichannel/telegram/disconnect', { method: 'POST' });
      setTelegramStatus({ connected: false });
      setTelegramSuccess('Đã ngắt kết nối Telegram Bot');
      onRefreshInbox();
    } catch (err: any) {
      setTelegramError(err.message);
    } finally {
      setTelegramLoading(false);
    }
  };

  // Connect Corporate C-Suite Mailbox (cfo@enterprise.vn)
  const handleConnectCorporateMailbox = async () => {
    setImapLoading(true);
    setImapError(null);
    setImapSuccess(null);
    try {
      const res = await fetch('/api/omnichannel/email/connect-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'cfo@enterprise.vn', host: 'imap.enterprise.vn', autoSeed: true })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi kết nối hòm thư');

      setImapSuccess('Đã kết nối thành công Hộp Thư C-Suite (cfo@enterprise.vn)! Toàn bộ thư đã sẵn sàng trong danh sách bên trái.');
      setImapStatus({ connected: true, user: 'cfo@enterprise.vn', host: 'imap.enterprise.vn' });
      onRefreshInbox();
      onEmailConnected?.('cfo@enterprise.vn');
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setImapError(err.message);
    } finally {
      setImapLoading(false);
    }
  };

  // Connect IMAP
  const handleConnectImap = async () => {
    if (!imapUser.trim() || !imapPass.trim() || !imapHost.trim()) {
      setImapError('Vui lòng nhập đầy đủ thông tin IMAP');
      return;
    }

    setImapLoading(true);
    setImapError(null);
    setImapSuccess(null);

    try {
      const res = await fetch('/api/omnichannel/email/imap/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: imapHost.trim(),
          port: Number(imapPort),
          secure: Number(imapPort) === 993,
          user: imapUser.trim(),
          pass: imapPass.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Lỗi kết nối IMAP');
      }

      setImapSuccess(data.message || `Đã kết nối IMAP tới ${imapUser} thành công! Toàn bộ thư đã sẵn sàng trong danh sách bên trái.`);
      setImapStatus(data.imap || { connected: true, user: imapUser, host: imapHost });
      setImapPass('');
      onRefreshInbox();
      onEmailConnected?.(imapUser.trim());
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setImapError(err.message);
    } finally {
      setImapLoading(false);
    }
  };

  // Disconnect IMAP
  const handleDisconnectImap = async () => {
    setImapLoading(true);
    try {
      await fetch('/api/omnichannel/email/imap/disconnect', { method: 'POST' });
      setImapStatus({ connected: false });
      setImapSuccess('Đã ngắt kết nối IMAP');
      onRefreshInbox();
    } catch (err: any) {
      setImapError(err.message);
    } finally {
      setImapLoading(false);
    }
  };

  // Scan IMAP Now (Manual Trigger)
  const handleScanImapNow = async () => {
    setImapLoading(true);
    setImapError(null);
    setImapSuccess(null);
    try {
      const res = await fetch('/api/omnichannel/email/imap/scan', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Lỗi quét hòm thư');
      }
      setImapSuccess(data.message || `Đã quét xong! Thêm ${data.newCount || 0} thư mới vào hộp thư.`);
      onRefreshInbox();
    } catch (err: any) {
      setImapError(err.message);
    } finally {
      setImapLoading(false);
    }
  };

  // Clear all conversations
  const handleClearAllConversations = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa toàn bộ tin nhắn và hội thoại trong Hộp Thư không?')) {
      return;
    }
    setIsClearing(true);
    try {
      const res = await fetch('/api/omnichannel/conversations', { method: 'DELETE' });
      if (res.ok) {
        onRefreshInbox();
        alert('Đã xóa sạch toàn bộ hội thoại!');
      }
    } catch (err) {
      console.error('Lỗi khi xóa hội thoại:', err);
    } finally {
      setIsClearing(false);
    }
  };

  const webhookUrl = `${window.location.origin}/api/omnichannel/ingress/email`;

  const curlExample = `curl -X POST ${webhookUrl} \\
  -H "Content-Type: application/json" \\
  -d '{
    "from": "user@gmail.com",
    "fromName": "Nguyễn Văn A",
    "to": "support@enterprise.vn",
    "subject": "Hỏi thông tin hợp đồng",
    "text": "Nội dung thư thực tế cần hỗ trợ"
  }'`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-sans">
      <div className="bg-white text-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-950 text-white flex items-center justify-center">
              <Radio className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-950 whitespace-nowrap">Cấu Hình Kênh Kết Nối Thật</h2>
              <p className="text-[11px] font-semibold text-slate-400">Zero-Mock Gateway</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-950 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 stroke-[2.2]" />
          </button>
        </div>

        {/* Channel Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-2 gap-2">
          <button
            onClick={() => setActiveTab('telegram')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'telegram'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-xl shadow-2xs font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <TelegramSvg size={14} className="text-blue-500" />
            <span>Telegram Bot</span>
            {telegramStatus.connected && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('email')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'email'
                ? 'border-amber-600 text-amber-700 bg-white rounded-t-xl shadow-2xs font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <EmailSvg size={14} className="text-amber-500" />
            <span>Email (IMAP & Webhook)</span>
            {imapStatus.connected && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('web')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'web'
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-xl shadow-2xs font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <WebWidgetSvg size={14} className="text-emerald-500" />
            <span>Web Widget</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* TAB 1: TELEGRAM */}
          {activeTab === 'telegram' && (
            <div className="space-y-4">
              {/* Status Banner */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                telegramStatus.connected
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-3.5 h-3.5 rounded-full shrink-0 ${telegramStatus.connected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                  <div>
                    <div className="text-xs font-extrabold whitespace-nowrap">
                      {telegramStatus.connected ? `Đang kết nối: @${telegramStatus.bot?.username}` : 'Chưa kết nối Telegram Bot'}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                      {telegramStatus.connected
                        ? `Lắng nghe tin nhắn từ bot ${telegramStatus.bot?.first_name} qua Long-Polling API.`
                        : 'Nhập Bot Token để kết nối và tự nhắn tin từ app Telegram của bạn.'}
                    </div>
                  </div>
                </div>

                {telegramStatus.connected && (
                  <button
                    onClick={handleDisconnectTelegram}
                    disabled={telegramLoading}
                    className="text-xs font-bold px-3 py-1.5 rounded-xl border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer btn-tactile whitespace-nowrap"
                  >
                    Ngắt kết nối
                  </button>
                )}
              </div>

              {/* Bot Token Input */}
              <div className="space-y-2.5">
                <div>
                  <label className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                    Telegram Bot Token Thật
                  </label>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium leading-relaxed">
                    Tạo Bot miễn phí bằng cách chat với <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-blue-600 underline font-bold">@BotFather</a> trên Telegram, gõ <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-900 font-mono font-bold">/newbot</code> rồi dán Token vào đây:
                  </p>
                </div>

                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="Dán token (Ví dụ: 789123456:AAFlmQ2...)"
                    value={telegramToken}
                    onChange={(e) => setTelegramToken(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-950 font-mono"
                  />
                  <button
                    onClick={handleConnectTelegram}
                    disabled={telegramLoading}
                    className="px-4 py-2 bg-slate-950 text-white rounded-xl text-xs font-bold hover:bg-black disabled:opacity-50 flex items-center gap-1.5 transition-colors shadow-xs btn-tactile cursor-pointer whitespace-nowrap"
                  >
                    {telegramLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckSvg size={13} />}
                    <span>Xác Thực & Kết Nối</span>
                  </button>
                </div>

                {telegramError && (
                  <div className="text-xs text-rose-700 font-bold bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                    {telegramError}
                  </div>
                )}
                {telegramSuccess && (
                  <div className="text-xs text-emerald-800 font-bold bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                    {telegramSuccess}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: EMAIL */}
          {activeTab === 'email' && (
            <div className="space-y-4">
              {/* IMAP Status Banner */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                imapStatus.connected
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-3.5 h-3.5 rounded-full shrink-0 ${imapStatus.connected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                  <div>
                    <div className="text-xs font-extrabold whitespace-nowrap">
                      {imapStatus.connected ? `Đang quét: ${imapStatus.user}` : 'Chưa kết nối hòm thư IMAP'}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                      {imapStatus.connected
                        ? `Máy chủ ${imapStatus.host}. Tự động quét email mỗi 30s.`
                        : 'Kết nối Gmail / Outlook để tự động kéo email về Hộp thư.'}
                    </div>
                  </div>
                </div>

                {imapStatus.connected && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleScanImapNow}
                      disabled={imapLoading}
                      className="text-xs font-bold px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 transition-colors cursor-pointer btn-tactile whitespace-nowrap flex items-center gap-1.5 shadow-2xs"
                      title="Quét ngay các email mới và cũ trong INBOX"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${imapLoading ? 'animate-spin' : ''}`} />
                      <span>Quét Lại Hòm Thư Ngay</span>
                    </button>
                    <button
                      onClick={handleDisconnectImap}
                      disabled={imapLoading}
                      className="text-xs font-bold px-3 py-1.5 rounded-xl border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer btn-tactile whitespace-nowrap"
                    >
                      Ngắt kết nối
                    </button>
                  </div>
                )}
              </div>

              {imapError && (
                <div className="text-xs text-rose-700 font-bold bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                  {imapError}
                </div>
              )}
              {imapSuccess && (
                <div className="text-xs text-emerald-800 font-bold bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                  {imapSuccess}
                </div>
              )}

              {/* C-Suite Corporate Mailbox Quick Connect */}
              <div className="p-4 rounded-2xl border border-indigo-200 bg-indigo-50/70 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-xs shrink-0">
                      <EmailSvg size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900">
                        Hộp Thư Doanh Nghiệp Ban Điều Hành (C-Suite)
                      </div>
                      <div className="text-[11px] font-mono font-bold text-indigo-700">
                        cfo@enterprise.vn
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleConnectCorporateMailbox}
                    disabled={imapLoading}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs btn-tactile cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                  >
                    {imapLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    <span>{imapStatus.connected && imapStatus.user === 'cfo@enterprise.vn' ? 'Đã Kết Nối (Quét Lại)' : '⚡ Kết Nối Hộp Thư Này'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-600 font-medium">
                  Tự động đồng bộ toàn bộ email từ HĐQT, Phòng Kế toán đối soát, Khối Tech AI, và Ban Kiểm toán SOX/IFRS với dữ liệu DWH thật.
                </p>
              </div>

              {/* IMAP Form */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-[11px] font-black text-slate-700 block">Địa chỉ Email:</label>
                  <input
                    type="email"
                    placeholder="your_email@gmail.com"
                    value={imapUser}
                    onChange={(e) => setImapUser(e.target.value)}
                    className="w-full mt-1 px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-slate-950"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="text-[11px] font-black text-slate-700 block">App Password (16 ký tự):</label>
                  <input
                    type="password"
                    placeholder="Mật khẩu 16 ký tự"
                    value={imapPass}
                    onChange={(e) => setImapPass(e.target.value)}
                    className="w-full mt-1 px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-slate-950"
                  />
                </div>

                <div className="col-span-2 pt-1">
                  <button
                    onClick={handleConnectImap}
                    disabled={imapLoading}
                    className="w-full py-2.5 bg-slate-950 text-white rounded-xl text-xs font-bold hover:bg-black disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors shadow-xs btn-tactile cursor-pointer"
                  >
                    {imapLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckSvg size={13} />}
                    <span>Xác Thực & Bật Quét Hòm Thư (IMAP)</span>
                  </button>
                </div>
              </div>

              {/* INBOUND WEBHOOK */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Cổng Inbound Webhook (Chuyển Tiếp Email)
                </div>
                <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <code className="text-xs font-mono font-bold text-slate-800 flex-1 truncate select-all">
                    {webhookUrl}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(webhookUrl);
                      setCopiedWebhook(true);
                      setTimeout(() => setCopiedWebhook(false), 2000);
                    }}
                    className="p-1.5 text-slate-600 hover:text-slate-950 rounded-lg bg-white border border-slate-300 transition-colors btn-tactile cursor-pointer"
                    title="Sao chép URL"
                  >
                    {copiedWebhook ? <CheckSvg size={13} className="text-emerald-600" /> : <CopySvg size={13} />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: WEB WIDGET */}
          {activeTab === 'web' && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-2">
                <div className="font-black uppercase tracking-wider text-slate-950">Web Chat Widget Ingress API</div>
                <p className="text-slate-600 font-medium leading-relaxed">
                  Cổng tiếp nhận tin nhắn từ widget tích hợp trên website khách hàng hoặc app di động:
                </p>
                <code className="block bg-white p-2.5 rounded-xl border border-slate-300 font-mono font-bold text-slate-950 text-[11px] select-all">
                  POST {window.location.origin}/api/omnichannel/ingress/web_widget
                </code>
              </div>
            </div>
          )}
        </div>

        {/* Footer with Clear All Button */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <button
            onClick={handleClearAllConversations}
            disabled={isClearing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 text-xs font-bold transition-colors shadow-2xs btn-tactile cursor-pointer"
            title="Xóa sạch mọi tin nhắn trong hộp thư"
          >
            <Trash2 className="w-3.5 h-3.5 stroke-[2.2]" />
            <span>{isClearing ? 'Đang xóa...' : 'Làm Sạch Hộp Thư'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-950 text-white rounded-xl text-xs font-bold hover:bg-black transition-colors cursor-pointer btn-tactile shadow-xs"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
