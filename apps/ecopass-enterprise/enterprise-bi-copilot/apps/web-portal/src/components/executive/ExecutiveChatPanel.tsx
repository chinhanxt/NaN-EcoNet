import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
  Zap,
  BarChart3,
  ShieldCheck,
  TrendingUp,
  Building2,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Terminal,
  RefreshCw
} from 'lucide-react';
import type { ChatMessage, ChartRenderOptions } from '../../types';

interface ExecutiveChatPanelProps {
  onExecuteChartAction: (options: ChartRenderOptions) => void;
  fiscalPeriod?: string;
  role?: string;
}

const STRATEGIC_CHIPS = [
  {
    label: '📊 Phân tích doanh thu & biên LN',
    prompt: 'Phân tích tổng quan doanh thu và biên lợi nhuận Tháng 9/2026',
    action: { chartType: 'combination', metricHighlight: 'all' } as ChartRenderOptions
  },
  {
    label: '🏢 Tiến độ phòng ban Q3',
    prompt: 'Đánh giá tiến độ hoàn thành chỉ tiêu doanh thu các phòng ban',
    action: { chartType: 'bar', metricHighlight: 'department' } as ChartRenderOptions
  },
  {
    label: '⚠️ Chi phí COGS & chiết khấu',
    prompt: 'Rà soát chi phí vốn COGS và chiết khấu thương mại các deal',
    action: { chartType: 'line', metricHighlight: 'margin' } as ChartRenderOptions
  },
  {
    label: '📈 Chỉ xem Đường Biên LN (%)',
    prompt: 'Vẽ lại biểu đồ tập trung vào tỷ suất biên lợi nhuận',
    action: { chartType: 'line', metricHighlight: 'margin' } as ChartRenderOptions
  },
  {
    label: '📊 Chỉ xem Cột Doanh thu',
    prompt: 'Vẽ lại biểu đồ chế độ Cột doanh thu thuần',
    action: { chartType: 'bar', metricHighlight: 'revenue' } as ChartRenderOptions
  }
];

export const ExecutiveChatPanel: React.FC<ExecutiveChatPanelProps> = ({
  onExecuteChartAction,
  fiscalPeriod = 'Tháng 9/2026',
  role = 'executive'
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'copilot',
      content: `Kính chào Sếp! Tôi là **Enterprise Executive Copilot (C-Suite Assistant)**.
Hệ thống đang hoạt động với **Kỷ luật Zero-Mock**: Toàn bộ dữ liệu hiển thị trên Canvas được đối soát thời gian thực từ **PostgreSQL Replica (Port 5435)** và ký số SHA-256.

Sếp có thể đặt câu hỏi phân tích tài chính hoặc bấm các lệnh chiến lược bên dưới để tôi tự động cập nhật và vẽ lại Canvas điều hành.`,
      timestamp: '11:30'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing]);

  const handleSendMessage = async (textToSend?: string, actionToTrigger?: ChartRenderOptions) => {
    const text = textToSend || inputText;
    if (!text.trim() || isProcessing) return;

    const userMsgId = `usr_${Date.now()}`;
    const newMessages: ChatMessage[] = [
      ...messages,
      {
        id: userMsgId,
        sender: 'user',
        content: text,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      }
    ];

    setMessages(newMessages);
    if (!textToSend) setInputText('');
    setIsProcessing(true);

    try {
      // Send to /api/copilotkit backend
      const res = await fetch('/api/copilotkit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({
            role: m.sender === 'copilot' ? 'assistant' : 'user',
            content: m.content
          }))
        })
      });

      const data = await res.json();
      const choice = data.choices?.[0]?.message;
      const content = choice?.content || 'Đã ghi nhận yêu cầu điều hành từ Sếp.';
      const toolCalls = choice?.tool_calls;

      let toolActionRecord: ChatMessage['toolAction'] = undefined;

      // If Copilot triggers render_dashboard_chart action
      if (toolCalls && toolCalls.length > 0) {
        for (const tc of toolCalls) {
          if (tc.function?.name === 'render_dashboard_chart') {
            try {
              const args = JSON.parse(tc.function.arguments);
              onExecuteChartAction(args);
              toolActionRecord = {
                name: 'render_dashboard_chart',
                status: 'completed',
                summary: `Cập nhật Canvas: Dạng ${args.chartType || 'combination'}, Trọng tâm ${args.metricHighlight || 'all'}`
              };
            } catch (err) {
              console.error('Error applying tool call args:', err);
            }
          }
        }
      } else if (actionToTrigger) {
        onExecuteChartAction(actionToTrigger);
        toolActionRecord = {
          name: 'render_dashboard_chart',
          status: 'completed',
          summary: `Thực thi lệnh chip: Dạng ${actionToTrigger.chartType}`
        };
      }

      setMessages(prev => [
        ...prev,
        {
          id: `ai_${Date.now()}`,
          sender: 'copilot',
          content,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          toolAction: toolActionRecord
        }
      ]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `ai_err_${Date.now()}`,
          sender: 'copilot',
          content: `⚠️ [Lỗi kết nối Copilot Runtime] ${err.message}. Hệ thống tuân thủ Zero-Mock không sử dụng phản hồi giả.`,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleChipClick = (chip: typeof STRATEGIC_CHIPS[0]) => {
    handleSendMessage(chip.prompt, chip.action);
  };

  return (
    <div className="flex flex-col h-full bg-titanium-950/80 border-r border-titanium-800 relative">
      {/* Header bar of Chat Panel */}
      <div className="p-4 border-b border-titanium-800 bg-titanium-900/60 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-bold text-titanium-100 uppercase tracking-wide">
                  Executive AI Agent
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              </div>
              <p className="text-[10px] text-titanium-400 font-mono">
                Assistant-UI Engine • CopilotKit Action Enabled
              </p>
            </div>
          </div>

          <div className="text-[11px] font-mono text-cyan-400 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">
            AUTO-CANVAS
          </div>
        </div>
      </div>

      {/* Strategic CEO/CFO Chips Strip */}
      <div className="p-3 bg-titanium-900/30 border-b border-titanium-800/80">
        <div className="text-[11px] font-mono font-semibold uppercase text-titanium-400 mb-2 flex items-center space-x-1">
          <Zap className="w-3 h-3 text-amber-400" />
          <span>Gợi ý Chiến lược CEO/CFO:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STRATEGIC_CHIPS.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleChipClick(chip)}
              disabled={isProcessing}
              className="text-[11px] font-sans px-2.5 py-1 rounded-full bg-titanium-850 hover:bg-cyan-500/15 text-titanium-300 hover:text-cyan-200 border border-titanium-700/60 hover:border-cyan-500/40 transition-all text-left disabled:opacity-50 active:scale-95"
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation Thread */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => {
          const isUser = msg.sender === 'user';

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center space-x-1.5 mb-1 text-[10px] font-mono text-titanium-500">
                <span>{isUser ? 'C-Suite Executive' : 'Copilot AI'}</span>
                <span>•</span>
                <span>{msg.timestamp}</span>
              </div>

              <div
                className={`max-w-[92%] rounded-xl p-3.5 text-xs leading-relaxed ${
                  isUser
                    ? 'bg-cyan-950/40 border border-cyan-500/30 text-cyan-100 shadow-sm'
                    : 'titanium-panel border border-titanium-700/80 text-titanium-200 shadow-titanium-card'
                }`}
              >
                {/* Render Markdown-like content */}
                <div className="space-y-1.5 whitespace-pre-line font-sans">
                  {msg.content.split('\n').map((line, i) => {
                    if (line.startsWith('### ')) {
                      return (
                        <div key={i} className="font-bold text-titanium-100 text-xs uppercase tracking-wide text-cyan-300 mt-2 mb-1">
                          {line.replace('### ', '')}
                        </div>
                      );
                    }
                    if (line.startsWith('- ')) {
                      return (
                        <div key={i} className="flex items-start space-x-1.5 pl-1 text-[11.5px]">
                          <span className="text-cyan-400 mt-0.5">•</span>
                          <span>
                            {line.replace('- ', '').split('**').map((chunk, j) =>
                              j % 2 === 1 ? <strong key={j} className="text-titanium-100 font-semibold">{chunk}</strong> : chunk
                            )}
                          </span>
                        </div>
                      );
                    }
                    if (/^\d+\.\s/.test(line)) {
                      return (
                        <div key={i} className="flex items-start space-x-1.5 pl-1 text-[11.5px]">
                          <span className="text-amber-400 font-mono">{line.slice(0, 3)}</span>
                          <span>
                            {line.slice(3).split('**').map((chunk, j) =>
                              j % 2 === 1 ? <strong key={j} className="text-titanium-100 font-semibold">{chunk}</strong> : chunk
                            )}
                          </span>
                        </div>
                      );
                    }
                    return (
                      <div key={i}>
                        {line.split('**').map((chunk, j) =>
                          j % 2 === 1 ? <strong key={j} className="text-titanium-100 font-semibold">{chunk}</strong> : chunk
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* AI Action Execution Receipt */}
                {msg.toolAction && (
                  <div className="mt-3 pt-2.5 border-t border-titanium-800 flex items-center space-x-2 text-[11px] font-mono text-emerald-400 bg-emerald-950/20 px-2 py-1 rounded border border-emerald-500/20">
                    <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Action: <code>{msg.toolAction.name}</code> executed</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Thinking Indicator */}
        {isProcessing && (
          <div className="flex items-center space-x-2 p-3 rounded-xl titanium-panel border border-cyan-500/30 max-w-[80%] text-xs font-mono text-cyan-300 animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
            <span>Executive Copilot đang phân tích số liệu DWH và tính toán action...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input box */}
      <div className="p-3 border-t border-titanium-800 bg-titanium-900/60 backdrop-blur-md">
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center space-x-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            disabled={isProcessing}
            placeholder="Nhập chỉ thị điều hành... (VD: Vẽ lại biểu đồ theo dạng Cột)"
            className="flex-1 px-3.5 py-2 rounded-xl bg-titanium-950 border border-titanium-700 text-xs text-titanium-100 placeholder-titanium-500 focus:outline-none focus:border-cyan-500 transition-colors font-sans"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isProcessing}
            className="p-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-all disabled:opacity-40 disabled:hover:bg-cyan-500 shadow-titanium-glow shrink-0"
            title="Gửi chỉ thị điều hành"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <div className="mt-1.5 flex items-center justify-between text-[10px] text-titanium-500 font-mono">
          <span>Kỳ đối soát: {fiscalPeriod}</span>
          <span className="text-emerald-400 flex items-center space-x-0.5">
            <ShieldCheck className="w-3 h-3 inline" />
            <span>Zero-Mock Verified</span>
          </span>
        </div>
      </div>
    </div>
  );
};
