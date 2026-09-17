import React from 'react';
import { 
  SquarePen, 
  ChevronLeft, 
  MessageSquare, 
  Trash2, 
  Settings, 
  Layers,
  Inbox,
  BarChart3,
  ShieldCheck
} from 'lucide-react';
import { CopilotAiSvg } from './SvgIcons';

export interface ChatThread {
  id: string;
  title: string;
  dateGroup: 'Hôm nay' | 'Hôm qua' | '7 ngày trước';
  updatedAt: string;
}

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  threads: ChatThread[];
  activeThreadId: string;
  onSelectThread: (id: string) => void;
  onNewChat: () => void;
  onDeleteThread: (id: string) => void;
  currentView?: 'copilot' | 'inbox';
  onSelectView?: (view: 'copilot' | 'inbox') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggle,
  threads,
  activeThreadId,
  onSelectThread,
  onNewChat,
  onDeleteThread,
  currentView = 'copilot',
  onSelectView
}) => {
  if (!isOpen) return null;

  const todayThreads = threads.filter(t => t.dateGroup === 'Hôm nay');
  const pastThreads = threads.filter(t => t.dateGroup !== 'Hôm nay');

  return (
    <aside className="w-[270px] h-screen bg-white border-r border-slate-200 flex flex-col shrink-0 select-none text-slate-900 font-sans z-30">
      {/* Brand Header: Logo & Collapsible Toggle */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-950 text-white flex items-center justify-center shadow-xs">
            <CopilotAiSvg size={18} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm tracking-tight text-slate-950">
                BI COPILOT
              </span>
              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                ENTERPRISE
              </span>
            </div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              C-Suite Intelligence
            </p>
          </div>
        </div>

        <button
          onClick={onToggle}
          title="Thu gọn menu"
          className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
        >
          <ChevronLeft size={18} strokeWidth={2.2} />
        </button>
      </div>

      {/* Main Workspace Navigation: BI Copilot vs Omnichannel Inbox (Compact 2-Icon Switcher) */}
      <div className="p-3 border-b border-slate-100 space-y-2">
        <div className="px-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Không Gian Làm Việc
        </div>

        {/* 2 Small Icon Buttons */}
        <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
          <button
            onClick={() => onSelectView?.('copilot')}
            title="Điều Hành AI & BI"
            aria-label="Điều Hành AI & BI"
            className={`flex items-center justify-center py-2 rounded-lg transition-all cursor-pointer btn-tactile ${
              currentView === 'copilot'
                ? 'bg-slate-950 text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <BarChart3 size={16} strokeWidth={2.4} />
          </button>

          <button
            onClick={() => onSelectView?.('inbox')}
            title="Hộp Thư Đa Kênh"
            aria-label="Hộp Thư Đa Kênh"
            className={`flex items-center justify-center py-2 rounded-lg transition-all cursor-pointer btn-tactile ${
              currentView === 'inbox'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Inbox size={16} strokeWidth={2.4} />
          </button>
        </div>
      </div>

      {/* New Conversation CTA (For BI Copilot) */}
      {currentView === 'copilot' && (
        <div className="px-3 pt-3 pb-1">
          <button
            onClick={onNewChat}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold bg-white hover:bg-slate-50 text-slate-900 rounded-xl border border-slate-300 shadow-2xs hover:border-slate-900 transition-all cursor-pointer whitespace-nowrap"
          >
            <SquarePen size={15} strokeWidth={2.2} className="text-slate-700" />
            <span>Khởi Tạo Hội Thoại Mới</span>
          </button>
        </div>
      )}

      {/* Chat Thread History */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
        {todayThreads.length > 0 && (
          <div>
            <div className="px-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
              Hôm nay
            </div>
            <div className="space-y-1">
              {todayThreads.map(thread => {
                const isActive = activeThreadId === thread.id && currentView === 'copilot';
                return (
                  <div
                    key={thread.id}
                    onClick={() => {
                      onSelectView?.('copilot');
                      onSelectThread(thread.id);
                    }}
                    className={`group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-slate-100 text-slate-950 font-bold border border-slate-200'
                        : 'text-slate-600 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <MessageSquare size={13} strokeWidth={2.2} className={`shrink-0 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                      <span className="truncate">{thread.title}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteThread(thread.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-600 rounded transition-opacity shrink-0"
                      title="Xóa đoạn chat"
                    >
                      <Trash2 size={12} strokeWidth={2.2} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {pastThreads.length > 0 && (
          <div>
            <div className="px-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
              Trước đó
            </div>
            <div className="space-y-1">
              {pastThreads.map(thread => {
                const isActive = activeThreadId === thread.id && currentView === 'copilot';
                return (
                  <div
                    key={thread.id}
                    onClick={() => {
                      onSelectView?.('copilot');
                      onSelectThread(thread.id);
                    }}
                    className={`group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-slate-100 text-slate-950 font-bold border border-slate-200'
                        : 'text-slate-600 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <MessageSquare size={13} strokeWidth={2.2} className={`shrink-0 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                      <span className="truncate">{thread.title}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteThread(thread.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-600 rounded transition-opacity shrink-0"
                      title="Xóa đoạn chat"
                    >
                      <Trash2 size={12} strokeWidth={2.2} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {threads.length === 0 && (
          <div className="px-3 py-8 text-center text-xs text-slate-400 font-medium">
            Chưa có hội thoại nào
          </div>
        )}
      </div>

      {/* Corporate User & System Status Strip */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/80">
        <div className="flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-slate-100 transition-colors">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-slate-950 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
              CN
            </div>
            <div className="flex flex-col text-left min-w-0">
              <span className="text-xs font-bold text-slate-950 truncate whitespace-nowrap">Chí Nhân</span>
              <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Zero-Mock Verified</span>
              </div>
            </div>
          </div>
          <Settings size={15} strokeWidth={2} className="text-slate-400 hover:text-slate-700 cursor-pointer shrink-0" />
        </div>
      </div>
    </aside>
  );
};
