import React, { useState, useEffect, useRef } from 'react';
import { 
  Conversation, 
  UnifiedMessage, 
  ConversationStatus, 
  ChannelType 
} from './types';
import { ChannelConnectModal } from './ChannelConnectModal';
import { 
  Send, 
  Search, 
  RefreshCw, 
  Radio, 
  Lock, 
  Bot, 
  User, 
  Clock, 
  Sparkles, 
  MessageSquare,
  Filter
} from 'lucide-react';
import { 
  TelegramSvg, 
  EmailSvg, 
  WebWidgetSvg, 
  CheckSvg,
  JourneyStageSvg
} from '../chatgpt/SvgIcons';

export const OmnichannelInbox: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UnifiedMessage[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'ALL' | ConversationStatus>('ALL');
  const [channelFilter, setChannelFilter] = useState<'ALL' | ChannelType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Reply Input
  const [replyText, setReplyText] = useState('');
  const [isPrivateNote, setIsPrivateNote] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Auto-refresh interval
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Connect & Sim Modal
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Telegram status
  const [telegramStatus, setTelegramStatus] = useState<{ connected: boolean; bot?: any }>({ connected: false });

  // Email status (Hộp Thư All)
  const [emailStatus, setEmailStatus] = useState<{
    active: boolean;
    imap?: { connected: boolean; user?: string; host?: string };
  }>({ active: true, imap: { connected: false } });
  const [isScanningMailbox, setIsScanningMailbox] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isInitialConvLoadRef = useRef<boolean>(true);

  // Fetch Telegram Status
  const checkTelegramStatus = async () => {
    try {
      const res = await fetch('/api/omnichannel/telegram/status');
      if (res.ok) {
        const data = await res.json();
        setTelegramStatus(data);
      }
    } catch {
      // ignore
    }
  };

  // Fetch Email Status
  const checkEmailStatus = async () => {
    try {
      const res = await fetch('/api/omnichannel/email/status');
      if (res.ok) {
        const data = await res.json();
        setEmailStatus(data);
      }
    } catch {
      // ignore
    }
  };

  // Quick Scan Mailbox
  const handleQuickScanMailbox = async () => {
    setIsScanningMailbox(true);
    try {
      const res = await fetch('/api/omnichannel/email/imap/scan', { method: 'POST' });
      if (res.ok) {
        await fetchConversations();
        if (activeConvId) await fetchMessages(activeConvId, true);
      }
    } catch (err) {
      console.error('Lỗi quét hòm thư:', err);
    } finally {
      setIsScanningMailbox(false);
    }
  };

  // Fetch Conversation List
  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/omnichannel/conversations');
      if (res.ok) {
        const data = await res.json();
        const convList: Conversation[] = data.conversations || [];
        setConversations(prev => {
          if (
            prev.length === convList.length &&
            prev.every((c, i) => c.id === convList[i]?.id && c.status === convList[i]?.status && c.updatedAt === convList[i]?.updatedAt)
          ) {
            return prev;
          }
          return convList;
        });

        // Auto select first conversation if none selected
        if (!activeConvId && convList.length > 0) {
          setActiveConvId(convList[0].id);
        }
      }
    } catch (err) {
      console.error('Lỗi tải danh sách hội thoại:', err);
    }
  };

  // Fetch Messages for Active Conversation (Silent mode for polling to avoid flicker and scroll reset)
  const fetchMessages = async (convId: string, isSilent: boolean = false) => {
    if (!isSilent) setIsLoadingMessages(true);
    try {
      const res = await fetch(`/api/omnichannel/conversations/${convId}/messages?includePrivate=true`);
      if (res.ok) {
        const data = await res.json();
        const newMsgs: UnifiedMessage[] = data.messages || [];
        setMessages(prev => {
          if (
            prev.length === newMsgs.length &&
            prev.every((m, idx) => m.id === newMsgs[idx]?.id && m.content === newMsgs[idx]?.content && m.isPrivate === newMsgs[idx]?.isPrivate)
          ) {
            return prev;
          }
          return newMsgs;
        });
      }
    } catch (err) {
      console.error('Lỗi tải tin nhắn:', err);
    } finally {
      if (!isSilent) setIsLoadingMessages(false);
    }
  };

  // Initial Load
  useEffect(() => {
    setIsLoadingList(true);
    Promise.all([fetchConversations(), checkTelegramStatus(), checkEmailStatus()]).finally(() => {
      setIsLoadingList(false);
    });
  }, []);

  // Poll conversation updates quietly in background
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      fetchConversations();
      checkEmailStatus();
      if (activeConvId) {
        fetchMessages(activeConvId, true); // Silent polling: không hiện spinner, không giật màn hình
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [autoRefresh, activeConvId]);

  // When activeConvId changes, fetch messages
  useEffect(() => {
    if (activeConvId) {
      isInitialConvLoadRef.current = true;
      fetchMessages(activeConvId, false);
    } else {
      setMessages([]);
    }
  }, [activeConvId]);

  // Active Conversation Object
  const activeConversation = conversations.find(c => c.id === activeConvId);

  // Handle smart scrolling:
  // 1. Khi vừa mở một hội thoại:
  //    - Kênh Email: cuộn lên đầu trang (scrollTop = 0) để người dùng đọc thư từ tốn, đứng yên hoàn toàn
  //    - Kênh Chat: cuộn xuống đáy để xem tin nhắn mới nhất
  // 2. Trong quá trình cập nhật tin: KHÔNG tự động giật màn hình, email luôn đứng yên
  useEffect(() => {
    if (!activeConvId || messages.length === 0) return;

    const isEmail = activeConversation?.metadata?.channelType === 'email' || 
                    activeConversation?.contact.id.startsWith('email_') ||
                    activeConversation?.inboxId === 'email';

    if (isInitialConvLoadRef.current) {
      isInitialConvLoadRef.current = false;
      if (isEmail) {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = 0;
        }
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      }
      return;
    }

    // Với Email: tuyệt đối đứng yên cho người dùng đọc và thao tác
    if (isEmail) return;

    // Với Chat: chỉ cuộn nếu người dùng đang ở gần đáy
    if (messagesContainerRef.current) {
      const c = messagesContainerRef.current;
      const isNearBottom = c.scrollHeight - c.scrollTop - c.clientHeight < 120;
      if (isNearBottom) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages, activeConvId, activeConversation]);

  // Handle Send Reply
  const handleSendReply = async () => {
    if (!activeConvId || !replyText.trim()) return;

    setIsSending(true);
    try {
      const res = await fetch(`/api/omnichannel/conversations/${activeConvId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: 'admin_chinhan',
          agentName: 'Chí Nhân (Quản trị viên)',
          content: replyText.trim(),
          isPrivate: isPrivateNote
        })
      });

      if (res.ok) {
        setReplyText('');
        await fetchMessages(activeConvId, true);
        await fetchConversations();
        // Sau khi nhân viên chủ động gửi phản hồi, cuộn xuống xem tin nhắn vừa gửi
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 50);
      }
    } catch (err) {
      console.error('Lỗi gửi phản hồi:', err);
    } finally {
      setIsSending(false);
    }
  };

  // Handle Change Conversation Status
  const handleStatusChange = async (status: ConversationStatus) => {
    if (!activeConvId) return;
    try {
      const res = await fetch(`/api/omnichannel/conversations/${activeConvId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        await fetchMessages(activeConvId);
        await fetchConversations();
      }
    } catch (err) {
      console.error('Lỗi cập nhật trạng thái:', err);
    }
  };

  // Filtered Conversations
  const filteredConversations = conversations.filter(c => {
    if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
    const channel = c.metadata?.channelType || (c.contact.id.startsWith('tg_') ? 'telegram' : c.contact.id.startsWith('email_') ? 'email' : 'web_widget');
    if (channelFilter !== 'ALL' && channel !== channelFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.contact.name?.toLowerCase().includes(q);
      const matchId = c.contact.identifier?.toLowerCase().includes(q);
      if (!matchName && !matchId) return false;
    }
    return true;
  });

  // Danh sách toàn bộ email trong hộp thư (All Inbox)
  const emailConversations = conversations.filter(c => {
    const channel = c.metadata?.channelType || (c.contact.id.startsWith('tg_') ? 'telegram' : c.contact.id.startsWith('email_') ? 'email' : 'web_widget');
    return channel === 'email';
  });

  const getChannelBadge = (channel: string) => {
    switch (channel) {
      case 'telegram':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200 whitespace-nowrap">
            <TelegramSvg size={13} className="text-blue-600" />
            <span>Telegram</span>
          </span>
        );
      case 'email':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
            <EmailSvg size={13} className="text-amber-600" />
            <span>Email</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap">
            <WebWidgetSvg size={13} className="text-emerald-600" />
            <span>Web Widget</span>
          </span>
        );
    }
  };

  const getStatusBadge = (status: ConversationStatus) => {
    switch (status) {
      case 'BOT_PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 whitespace-nowrap">
            <Sparkles className="w-3 h-3 text-indigo-600 stroke-[2.2]" />
            <span>AI Đang Xử Lý</span>
          </span>
        );
      case 'HUMAN_OPEN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap">
            <User className="w-3 h-3 text-emerald-600 stroke-[2.2]" />
            <span>Người Tiếp Quản</span>
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200 whitespace-nowrap">
            <CheckSvg size={12} className="text-slate-700" />
            <span>Đã Giải Quyết</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
            <Clock className="w-3 h-3 text-amber-600 stroke-[2.2]" />
            <span>Tạm Hoãn</span>
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#F8FAFC] text-slate-900 font-sans overflow-hidden">
      {/* Top Banner & Omnichannel Health Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between shadow-2xs z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-950 flex items-center justify-center text-white shadow-xs">
            <MessageSquare className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black text-slate-950 tracking-tight whitespace-nowrap">
                Hộp Thư Hợp Nhất Đa Kênh
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 rounded-md border border-slate-200 uppercase whitespace-nowrap">
                Omnichannel Core
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-500 whitespace-nowrap">
              Gom toàn bộ tin nhắn từ Telegram, Email, Web Chat về một giao diện điều phối duy nhất
            </p>
          </div>
        </div>

        {/* Channels Health Strip */}
        <div className="flex items-center gap-3">
          {/* Telegram status */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <TelegramSvg size={14} className="text-blue-500 shrink-0" />
            <span className="font-bold text-slate-700">Telegram:</span>
            {telegramStatus.connected ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1 whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                @{telegramStatus.bot?.username || 'Active'}
              </span>
            ) : (
              <span className="text-slate-400 font-semibold whitespace-nowrap">Chưa kết nối</span>
            )}
          </div>

          {/* Email status */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <EmailSvg size={14} className="text-amber-500 shrink-0" />
            <span className="font-bold text-slate-700">Email:</span>
            {emailStatus.imap?.connected ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1 whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {emailStatus.imap.user}
              </span>
            ) : (
              <span className="text-slate-400 font-semibold whitespace-nowrap">Chưa kết nối</span>
            )}
          </div>

          {/* Connect CTA Button */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-950 text-white text-xs font-bold hover:bg-black transition-all shadow-xs btn-tactile whitespace-nowrap"
          >
            <Radio className="w-3.5 h-3.5 stroke-[2.2]" />
            <span>Cấu Hình Kênh</span>
          </button>

          {/* Refresh button */}
          <button
            onClick={() => {
              fetchConversations();
              if (activeConvId) fetchMessages(activeConvId);
            }}
            className="p-2 text-slate-500 hover:text-slate-900 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors btn-tactile"
            title="Làm mới"
          >
            <RefreshCw className={`w-3.5 h-3.5 stroke-[2.2] ${isLoadingList ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main 2-Column Split: Inbox List & Chat Thread */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT COLUMN: Conversation List & Filters */}
        <div className="w-96 bg-white border-r border-slate-200 flex flex-col shrink-0">
          {/* Search Box */}
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 stroke-[2.2]" />
              <input
                type="text"
                placeholder="Tìm hội thoại theo tên, số, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-950 placeholder-slate-400"
              />
            </div>
          </div>

          {/* Hộp Thư ALL Banner: Hiển thị trạng thái và thông tin hòm thư email đã kết nối */}
          {emailStatus.imap?.connected ? (
            <div className="p-3 bg-gradient-to-r from-amber-500/10 via-amber-50/70 to-white border-b border-amber-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <EmailSvg size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-slate-950 uppercase tracking-tight whitespace-nowrap">
                        HỘP THƯ ALL ({emailConversations.length})
                      </span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Đang đồng bộ IMAP realtime" />
                    </div>
                    <div className="text-[11px] font-mono font-bold text-amber-900 truncate">
                      {emailStatus.imap.user}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={handleQuickScanMailbox}
                    disabled={isScanningMailbox}
                    className="p-1.5 text-amber-800 hover:text-amber-950 hover:bg-amber-100 rounded-lg transition-colors btn-tactile cursor-pointer"
                    title="Quét & đồng bộ lại hộp thư ngay"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isScanningMailbox ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              <div className="mt-2.5 flex items-center justify-between text-[11px] pt-2 border-t border-amber-200/60">
                <span className="text-slate-600 font-bold flex items-center gap-1">
                  <span className="text-emerald-700">● IMAP Đồng bộ</span> • {emailConversations.length} thư trong hộp
                </span>
                <button
                  onClick={() => setChannelFilter(channelFilter === 'email' ? 'ALL' : 'email')}
                  className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                    channelFilter === 'email'
                      ? 'bg-amber-600 text-white shadow-2xs font-extrabold'
                      : 'bg-white text-amber-800 border border-amber-300 hover:bg-amber-50'
                  }`}
                >
                  {channelFilter === 'email' ? '✓ Đang lọc: Hộp thư' : 'Chỉ xem Email'}
                </button>
              </div>
            </div>
          ) : (
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[11px]">
                <EmailSvg size={13} className="text-slate-400" />
                <span>Chưa kết nối Hộp Thư Email</span>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="text-[10px] font-bold px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-all shadow-2xs cursor-pointer btn-tactile"
              >
                + Kết Nối Ngay
              </button>
            </div>
          )}

          {/* Status Filter Tabs */}
          <div className="flex border-b border-slate-100 bg-slate-50/80 p-1.5 gap-1 text-[11px]">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`flex-1 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap btn-tactile ${
                statusFilter === 'ALL' ? 'bg-white shadow-2xs text-slate-950 font-extrabold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Tất cả ({conversations.length})
            </button>
            <button
              onClick={() => setStatusFilter('BOT_PENDING')}
              className={`flex-1 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap btn-tactile ${
                statusFilter === 'BOT_PENDING' ? 'bg-white shadow-2xs text-indigo-700 font-extrabold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              AI xử lý
            </button>
            <button
              onClick={() => setStatusFilter('HUMAN_OPEN')}
              className={`flex-1 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap btn-tactile ${
                statusFilter === 'HUMAN_OPEN' ? 'bg-white shadow-2xs text-emerald-700 font-extrabold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Người hỗ trợ
            </button>
            <button
              onClick={() => setStatusFilter('RESOLVED')}
              className={`flex-1 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap btn-tactile ${
                statusFilter === 'RESOLVED' ? 'bg-white shadow-2xs text-slate-700 font-extrabold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Đã xong
            </button>
          </div>

          {/* Channel Filter Pills */}
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-100 overflow-x-auto text-[11px]">
            <span className="text-slate-400 mr-1 flex items-center gap-1 font-bold whitespace-nowrap">
              <Filter className="w-3 h-3 stroke-[2.2]" /> Kênh:
            </span>
            <button
              onClick={() => setChannelFilter('ALL')}
              className={`px-2.5 py-0.5 rounded-full border transition-colors font-bold whitespace-nowrap ${
                channelFilter === 'ALL' ? 'bg-slate-950 text-white border-slate-950' : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setChannelFilter('telegram')}
              className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full border transition-colors font-bold whitespace-nowrap ${
                channelFilter === 'telegram' ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}
            >
              <TelegramSvg size={11} />
              <span>Telegram</span>
            </button>
            <button
              onClick={() => setChannelFilter('email')}
              className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full border transition-colors font-bold whitespace-nowrap ${
                channelFilter === 'email' ? 'bg-amber-600 text-white border-amber-600' : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              <EmailSvg size={11} />
              <span>Email</span>
            </button>
            <button
              onClick={() => setChannelFilter('web_widget')}
              className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full border transition-colors font-bold whitespace-nowrap ${
                channelFilter === 'web_widget' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
            >
              <WebWidgetSvg size={11} />
              <span>Web</span>
            </button>
          </div>

          {/* Conversations Scrollable List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  <MessageSquare className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div className="text-xs text-slate-500 font-semibold">Hộp thư chưa có tin nhắn nào</div>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-900 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors"
                >
                  Cấu hình Telegram / Email
                </button>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const channel = conv.metadata?.channelType || (conv.contact.id.startsWith('tg_') ? 'telegram' : conv.contact.id.startsWith('email_') ? 'email' : 'web_widget');
                const isSelected = conv.id === activeConvId;

                if (channel === 'email') {
                  const subject = conv.metadata?.originalSubject || conv.metadata?.subject || conv.contact.customAttributes?.originalSubject || conv.metadata?.cleanSubject;
                  const snippet = conv.metadata?.snippet || conv.contact.customAttributes?.snippet;

                  return (
                    <div
                      key={conv.id}
                      onClick={() => setActiveConvId(conv.id)}
                      className={`p-3.5 cursor-pointer transition-all border-l-4 ${
                        isSelected
                          ? 'bg-amber-50/80 border-l-amber-600 shadow-2xs'
                          : 'border-l-transparent hover:bg-slate-50/90'
                      }`}
                    >
                      {/* Top line: Sender name + Timestamp */}
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-amber-500 text-white font-black flex items-center justify-center text-xs shrink-0 shadow-2xs">
                            {conv.contact.name?.[0] || 'E'}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-black text-slate-900 truncate">
                              {conv.contact.name || conv.contact.email}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono truncate">
                              {conv.contact.email || conv.contact.identifier}
                            </div>
                          </div>
                        </div>
                        <div className="shrink-0 text-[10px] text-slate-400 font-mono font-bold">
                          {new Date(conv.updatedAt || conv.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      {/* Subject line: bold and clear */}
                      <div className="mt-1.5 text-xs font-extrabold text-slate-950 line-clamp-1 leading-snug">
                        {subject || '(Không có tiêu đề)'}
                      </div>

                      {/* Snippet preview */}
                      {snippet && (
                        <p className="text-[11px] text-slate-500 font-medium line-clamp-2 mt-1 leading-relaxed">
                          {snippet}
                        </p>
                      )}

                      {/* Bottom tags */}
                      <div className="flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-slate-100">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded-md">
                          <EmailSvg size={11} className="text-amber-700" />
                          <span>Hộp Thư Đến</span>
                        </span>
                        <div className="shrink-0">
                          {getStatusBadge(conv.status)}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={conv.id}
                    onClick={() => setActiveConvId(conv.id)}
                    className={`p-3.5 cursor-pointer transition-all border-l-4 ${
                      isSelected
                        ? 'bg-slate-100/70 border-l-slate-950 shadow-2xs'
                        : 'border-l-transparent hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="relative shrink-0">
                          <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-800 font-black flex items-center justify-center text-xs">
                            {conv.contact.name?.[0] || 'K'}
                          </div>
                          <span className="absolute -bottom-1 -right-1 text-xs">
                            {channel === 'telegram' ? (
                              <TelegramSvg size={12} className="text-blue-600 bg-white rounded-full" />
                            ) : channel === 'email' ? (
                              <EmailSvg size={12} className="text-amber-600 bg-white rounded-full" />
                            ) : (
                              <WebWidgetSvg size={12} className="text-emerald-600 bg-white rounded-full" />
                            )}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-black text-slate-950 truncate whitespace-nowrap">
                            {conv.contact.name || 'Khách hàng'}
                          </div>
                          <div className="text-[10px] text-slate-400 font-semibold truncate whitespace-nowrap">
                            {conv.contact.identifier || conv.contact.email}
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 text-[10px] text-slate-400 font-mono font-bold whitespace-nowrap">
                        {new Date(conv.updatedAt || conv.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-2">
                      <div className="text-[11px] text-slate-500 font-medium truncate flex-1 whitespace-nowrap">
                        {conv.metadata?.originalSubject ? `[${conv.metadata.originalSubject}] ` : ''}
                        Hội thoại #{conv.id.slice(-6)}
                      </div>
                      <div className="shrink-0">
                        {getStatusBadge(conv.status)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Active Conversation Chat & Controls */}
        <div className="flex-1 flex flex-col bg-[#F8FAFC] overflow-hidden">
          {activeConversation ? (
            <>
              {/* Conversation Top Header */}
              <div className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between shadow-2xs shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-900 text-white font-black flex items-center justify-center text-sm shadow-xs shrink-0">
                    {activeConversation.contact.name?.[0] || 'K'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-black text-slate-950 whitespace-nowrap">
                        {activeConversation.contact.name}
                      </h2>
                      {getChannelBadge(activeConversation.metadata?.channelType || (activeConversation.contact.id.startsWith('tg_') ? 'telegram' : activeConversation.contact.id.startsWith('email_') ? 'email' : 'web_widget'))}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-2 font-medium">
                      <span>Định danh: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono text-[11px] font-bold">{activeConversation.contact.identifier}</code></span>
                      {activeConversation.contact.email && (
                        <span>Email: <b className="text-slate-900 font-bold">{activeConversation.contact.email}</b></span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Handoff State Management Actions */}
                <div className="flex items-center gap-2">
                  <div className="mr-2">
                    {getStatusBadge(activeConversation.status)}
                  </div>

                  {activeConversation.status === 'BOT_PENDING' && (
                    <button
                      onClick={() => handleStatusChange('HUMAN_OPEN')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition-colors shadow-xs btn-tactile whitespace-nowrap"
                      title="Chuyển sang chế độ người thật trả lời, ngắt quyền AI Bot"
                    >
                      <User className="w-3.5 h-3.5 stroke-[2.2]" />
                      <span>Tiếp Quản (Tước quyền AI)</span>
                    </button>
                  )}

                  {activeConversation.status === 'HUMAN_OPEN' && (
                    <button
                      onClick={() => handleStatusChange('BOT_PENDING')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-700 text-white text-xs font-bold hover:bg-indigo-800 transition-colors shadow-xs btn-tactile whitespace-nowrap"
                      title="Giao lại cuộc hội thoại cho AI Bot tự động trả lời"
                    >
                      <Sparkles className="w-3.5 h-3.5 stroke-[2.2]" />
                      <span>Giao Lại Cho AI Bot</span>
                    </button>
                  )}

                  {activeConversation.status !== 'RESOLVED' ? (
                    <button
                      onClick={() => handleStatusChange('RESOLVED')}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors btn-tactile whitespace-nowrap"
                    >
                      <CheckSvg size={12} className="text-slate-500" />
                      <span>Đóng Hội Thoại</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStatusChange('HUMAN_OPEN')}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors btn-tactile whitespace-nowrap"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-slate-500 stroke-[2.2]" />
                      <span>Mở Lại</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Messages Thread */}
              <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-6 space-y-4">
                {isLoadingMessages ? (
                  <div className="flex items-center justify-center h-48 text-slate-400 gap-2 text-xs font-bold">
                    <RefreshCw className="w-4 h-4 animate-spin stroke-[2.2]" /> Đang tải lịch sử tin nhắn...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-slate-400 text-xs py-12 font-semibold">
                    Chưa có tin nhắn trong cuộc hội thoại này
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isCustomer = msg.senderType === 'CUSTOMER';
                    const isBot = msg.senderType === 'AI_BOT';
                    const isHuman = msg.senderType === 'HUMAN_AGENT';
                    const isActivity = msg.messageType === 'ACTIVITY';
                    const isEmailMsg = msg.metadata?.channelType === 'email' || 
                                       msg.metadata?.source === 'email' || 
                                       activeConversation?.metadata?.channelType === 'email' ||
                                       activeConversation?.contact.id.startsWith('email_') ||
                                       activeConversation?.inboxId === 'email';

                    if (isActivity) {
                      return (
                        <div key={msg.id} className="flex justify-center my-2">
                          <div className="px-3 py-1 rounded-full bg-slate-200 text-[11px] text-slate-700 font-bold flex items-center gap-1.5 shadow-2xs whitespace-nowrap">
                            <Clock className="w-3 h-3 text-slate-500 stroke-[2.2]" />
                            <span>{msg.content}</span>
                          </div>
                        </div>
                      );
                    }

                    if (msg.isPrivate) {
                      return (
                        <div key={msg.id} className="flex justify-center my-3">
                          <div className="w-full max-w-lg bg-amber-50 border border-amber-300 rounded-2xl p-3.5 shadow-2xs text-xs space-y-1">
                            <div className="flex items-center justify-between text-amber-950 font-bold">
                              <span className="flex items-center gap-1.5">
                                <Lock className="w-3.5 h-3.5 text-amber-700 stroke-[2.2]" />
                                <span>Ghi chú nội bộ (Khách hàng không thấy)</span>
                              </span>
                              <span className="text-[10px] text-amber-700 font-mono">
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-amber-950 font-medium leading-relaxed whitespace-pre-wrap">
                              {msg.content}
                            </p>
                            <div className="text-[10px] text-amber-800 font-bold">
                              Người ghi: <b>{msg.senderName}</b>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // Render giao diện thông báo Email chuyên nghiệp (không bị co cụm chat bubble, hiển thị đầy đủ tiêu đề & nội dung)
                    if (isEmailMsg && isCustomer) {
                      const subject = msg.metadata?.subject || activeConversation?.contact.customAttributes?.originalSubject || '(Không có tiêu đề)';
                      return (
                        <div key={msg.id} className="flex justify-start w-full">
                          <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                            {/* Email Header */}
                            <div className="bg-slate-50 border-b border-slate-200 p-4 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 text-xs font-black">
                                  <EmailSvg size={13} className="text-amber-600" />
                                  <span>Thông Báo Hòm Thư Đến</span>
                                </span>
                                <span className="text-[11px] text-slate-500 font-mono">
                                  {new Date(msg.createdAt).toLocaleString('vi-VN')}
                                </span>
                              </div>
                              <h3 className="text-sm font-black text-slate-900 leading-snug">
                                {subject}
                              </h3>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                                <div>
                                  <span className="font-bold text-slate-500">Từ: </span>
                                  <span className="font-bold text-slate-900">{msg.senderName}</span>
                                  {activeConversation?.contact.email && (
                                    <span className="text-slate-500 ml-1 font-mono">&lt;{activeConversation.contact.email}&gt;</span>
                                  )}
                                </div>
                                {msg.metadata?.to && (
                                  <div>
                                    <span className="font-bold text-slate-500">Đến: </span>
                                    <span className="text-slate-700 font-mono">{msg.metadata.to}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            {/* Email Content Body */}
                            <div className="p-5 text-[13px] text-slate-800 leading-relaxed font-medium whitespace-pre-wrap selection:bg-amber-100">
                              {msg.content}
                            </div>
                            {/* Email Footer Note */}
                            <div className="bg-slate-50/60 border-t border-slate-100 px-5 py-2 flex items-center justify-between text-[11px] text-slate-500">
                              <span className="flex items-center gap-1.5 font-semibold">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Lưu trữ an toàn từ Mailbox • Người dùng toàn quyền thao tác & phản hồi
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-3 ${isCustomer ? 'justify-start' : 'justify-end'}`}
                      >
                        {isCustomer && (
                          <div className="w-8 h-8 rounded-full bg-slate-300 text-slate-800 font-bold flex items-center justify-center text-xs shrink-0 mt-1">
                            {msg.senderName?.[0] || 'K'}
                          </div>
                        )}

                        <div className={`max-w-md rounded-2xl p-4 text-xs shadow-xs space-y-1.5 ${
                          isCustomer
                            ? 'bg-white border border-slate-200 text-slate-900 rounded-tl-xs'
                            : isBot
                            ? 'bg-slate-900 text-white rounded-tr-xs'
                            : 'bg-emerald-800 text-white rounded-tr-xs'
                        }`}>
                          <div className="flex items-center justify-between gap-3 text-[10px] opacity-80 border-b pb-1 border-white/20">
                            <span className="font-bold flex items-center gap-1">
                              {isBot && <Sparkles className="w-3 h-3 text-slate-300 stroke-[2.2]" />}
                              {isHuman && <User className="w-3 h-3 text-emerald-200 stroke-[2.2]" />}
                              <span>{msg.senderName}</span>
                            </span>
                            <span className="font-mono">
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <div className="leading-relaxed whitespace-pre-wrap font-semibold text-[13px]">
                            {msg.content}
                          </div>
                        </div>

                        {!isCustomer && (
                          <div className={`w-8 h-8 rounded-full text-white font-bold flex items-center justify-center text-xs shrink-0 mt-1 shadow-2xs ${
                            isBot ? 'bg-slate-900' : 'bg-emerald-800'
                          }`}>
                            {isBot ? <Bot className="w-4 h-4 stroke-[2.2]" /> : <User className="w-4 h-4 stroke-[2.2]" />}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Box with Outbound / Private Note Switch */}
              <div className="bg-white border-t border-slate-200 p-4 space-y-3 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsPrivateNote(false)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors btn-tactile whitespace-nowrap ${
                        !isPrivateNote
                          ? 'bg-slate-950 text-white shadow-2xs font-extrabold'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {activeConversation?.contact.email || activeConversation?.metadata?.channelType === 'email'
                        ? '✉️ Phản hồi Email'
                        : '💬 Trả lời khách hàng'}
                    </button>
                    <button
                      onClick={() => setIsPrivateNote(true)}
                      className={`flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold transition-colors btn-tactile whitespace-nowrap ${
                        isPrivateNote
                          ? 'bg-amber-600 text-white shadow-2xs font-extrabold'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Lock className="w-3 h-3 stroke-[2.2]" />
                      <span>Ghi chú nội bộ (Private Note)</span>
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-400 font-semibold whitespace-nowrap">
                    Nhấn <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-slate-700 font-mono text-[10px] font-bold">Ctrl+Enter</kbd> để gửi
                  </div>
                </div>

                <div className="relative">
                  <textarea
                    rows={3}
                    placeholder={
                      isPrivateNote
                        ? 'Nhập ghi chú nội bộ (khách hàng không thấy)...'
                        : activeConversation?.contact.email || activeConversation?.metadata?.channelType === 'email'
                        ? `Soạn thư phản hồi gửi tới ${activeConversation?.contact.email || 'người gửi'}...`
                        : 'Nhập tin nhắn phản hồi tới khách hàng qua kênh kết nối...'
                    }
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        handleSendReply();
                      }
                    }}
                    className={`w-full p-3.5 text-xs font-semibold border rounded-2xl focus:outline-none focus:ring-1 resize-none transition-all ${
                      isPrivateNote
                        ? 'border-amber-300 bg-amber-50/40 focus:ring-amber-600 text-slate-950'
                        : 'border-slate-300 bg-white focus:ring-slate-950 text-slate-950'
                    }`}
                  />
                  <button
                    onClick={handleSendReply}
                    disabled={isSending || !replyText.trim()}
                    className={`absolute right-3 bottom-3 p-2.5 rounded-xl text-white disabled:opacity-40 transition-colors shadow-xs btn-tactile cursor-pointer ${
                      isPrivateNote ? 'bg-amber-600 hover:bg-amber-700' : 'bg-slate-950 hover:bg-black'
                    }`}
                  >
                    {isSending ? <RefreshCw className="w-4 h-4 animate-spin stroke-[2.2]" /> : <Send className="w-4 h-4 stroke-[2.2]" />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-950 flex items-center justify-center shadow-xs border border-slate-200">
                <Radio className="w-8 h-8 animate-pulse stroke-[2.2]" />
              </div>
              <div className="max-w-md space-y-2">
                <h3 className="text-base font-black text-slate-950">
                  Hộp Thư Đang Chờ Tin Nhắn Thật
                </h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Hộp thư hiện đang trống (Zero Mock). Bấm nút bên dưới để kết nối Telegram Bot thật hoặc lấy Webhook Email để tự gửi tin nhắn kiểm tra.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2 bg-slate-950 text-white text-xs font-bold rounded-xl hover:bg-black transition-colors shadow-xs flex items-center gap-1.5 btn-tactile"
              >
                <Radio className="w-4 h-4 stroke-[2.2]" />
                <span>Cấu Hình Kênh Kết Nối</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Real Channel Connect Modal */}
      <ChannelConnectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onRefreshInbox={() => {
          fetchConversations();
          checkTelegramStatus();
          checkEmailStatus();
        }}
        onEmailConnected={(_emailUser) => {
          setChannelFilter('email');
          fetchConversations();
          checkEmailStatus();
          setIsModalOpen(false);
        }}
      />
    </div>
  );
};
