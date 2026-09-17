import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  ArrowUp, 
  Paperclip, 
  Zap,
  Server,
  Layers,
  Sparkles
} from 'lucide-react';
import { ChatChart } from './ChatChart';
import { ConversationalStatusEnvelope } from './ConversationalStatusEnvelope';
import { InteractiveActionPanel } from './InteractiveActionPanel';
import type { ExecutiveRole } from './ExecutiveWelcomeCard';
import { KpiMetricGrid } from './KpiMetricGrid';
import { RiskAlertCallout } from './RiskAlertCallout';
import { ExecutiveBriefingCard } from './ExecutiveBriefingCard';
import { InteractiveDataTable, ContractRecord } from './InteractiveDataTable';
import { VarianceMatrixGrid, BudgetItemVariance } from './VarianceMatrixGrid';
import { SchemaCatalogViewer, TableCatalog } from './SchemaCatalogViewer';
import { NaturalMarkdownMessage } from './NaturalMarkdownMessage';
import { SingleDaySpotlight } from './SingleDaySpotlight';
import { DynamicLeaderboardTable } from './DynamicLeaderboardTable';
import { CompanyOrgCard } from './CompanyOrgCard';
import { CompanyStatusBriefing } from './CompanyStatusBriefing';
import { DiagramViewerCard, DiagramData } from './DiagramViewerCard';
import { InteractiveWorkflowChart, WorkflowChartData } from './InteractiveWorkflowChart';
import { ExecutiveSankeyChart, SankeyChartData } from './ExecutiveSankeyChart';
import { ExecutiveGaugeChart, GaugeChartData } from './ExecutiveGaugeChart';
import { ExecutiveWaterfallChart, WaterfallChartData } from './ExecutiveWaterfallChart';
import { ExecutiveRadarChart, RadarChartData } from './ExecutiveRadarChart';
import { ExecutiveSunburstChart, SunburstChartData } from './ExecutiveSunburstChart';
import { ThinkingAccordion } from './ThinkingAccordion';
import { ThinkingIndicator } from './ThinkingIndicator';
import { 
  CopilotAiSvg, 
  UserAvatarSvg, 
  DoubleDiamondSvg, 
  CeoPersonaSvg, 
  CfoPersonaSvg, 
  CooPersonaSvg 
} from './SvgIcons';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  uiType?: 'chart' | 'data_table' | 'variance_matrix' | 'schema_catalog' | 'kpi_grid' | 'risk_alert' | 'single_day_spotlight' | 'leaderboard' | 'company_org' | 'company_status' | 'briefing' | 'greeting' | 'text' | 'workflow_chart' | 'diagram_image' | 'sankey_chart' | 'gauge_chart' | 'waterfall_chart' | 'radar_chart' | 'sunburst_chart';
  chartData?: {
    chartConfig?: any;
    records: any[];
    audit?: any;
    varianceData?: any;
  };
  tableData?: ContractRecord[];
  varianceData?: any;
  varianceItems?: BudgetItemVariance[];
  schemaData?: TableCatalog[];
  kpiData?: any[];
  riskData?: any;
  spotlightData?: any;
  leaderboardData?: any;
  orgData?: any;
  statusBriefingData?: any;
  briefingData?: any;
  greetingData?: any;
  diagramData?: DiagramData;
  workflowData?: WorkflowChartData;
  sankeyData?: SankeyChartData;
  gaugeData?: GaugeChartData;
  waterfallData?: WaterfallChartData;
  radarData?: RadarChartData;
  sunburstData?: SunburstChartData;
  audit?: any;
  thinkingDurationSec?: number;
  thinkingSteps?: string[];
}

interface ChatAreaProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  selectedModel: string;
  onSelectModel: (model: string) => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  sidebarOpen,
  onToggleSidebar,
  messages,
  onSendMessage,
  isLoading,
  selectedModel,
  onSelectModel
}) => {
  const [inputText, setInputText] = useState('');
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [mcpPopoverOpen, setMcpPopoverOpen] = useState(false);
  const [executiveRole, setExecutiveRole] = useState<ExecutiveRole>('CEO');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const models = [
    { id: 'agy-gemini', name: 'Antigravity Gemini (Proxy 8899)', provider: 'Google DeepMind • 6 Accounts (Zero-Mock)' },
    { id: 'gpt-4o', name: 'GPT-4o Enterprise', provider: 'OpenAI Enterprise Gateway' },
    { id: 'claude-3-5', name: 'Claude 3.5 Sonnet', provider: 'Anthropic Sovereign' },
  ];

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Auto adjust textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [inputText]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (!inputText.trim() || isLoading) return;
    onSendMessage(inputText.trim());
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] relative overflow-hidden font-sans">
      {/* Top Header Bar */}
      <header className="h-14 border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 shrink-0 bg-white/95 backdrop-blur z-20">
        <div className="flex items-center gap-3">
          {!sidebarOpen && (
            <button
              onClick={onToggleSidebar}
              title="Mở thanh bên"
              className="p-1.5 text-slate-500 hover:text-slate-950 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              <ChevronRight size={20} strokeWidth={2.4} />
            </button>
          )}

          {/* Model Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-black text-slate-950 hover:bg-slate-50 rounded-xl border border-slate-300 transition-all cursor-pointer whitespace-nowrap shadow-2xs btn-tactile"
            >
              <Sparkles size={13} className="text-slate-700" />
              <span>{models.find(m => m.id === selectedModel)?.name || 'Enterprise Copilot'}</span>
              <ChevronDown size={14} className="text-slate-400 stroke-[2.2]" />
            </button>

            {modelDropdownOpen && (
              <div className="absolute left-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl p-1.5 z-50 space-y-1">
                <div className="px-3 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Chọn LLM Provider
                </div>
                {models.map(m => (
                  <div
                    key={m.id}
                    onClick={() => {
                      onSelectModel(m.id);
                      setModelDropdownOpen(false);
                    }}
                    className={`px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors flex flex-col ${
                      selectedModel === m.id 
                        ? 'bg-slate-950 text-white font-bold' 
                        : 'text-slate-800 hover:bg-slate-100 font-semibold'
                    }`}
                  >
                    <span className="font-extrabold">{m.name}</span>
                    <span className={`text-[10px] ${selectedModel === m.id ? 'opacity-85' : 'text-slate-400'}`}>{m.provider}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Persona Pill in Header */}
          <div className="hidden md:flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button
              onClick={() => setExecutiveRole('CEO')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                executiveRole === 'CEO' ? 'bg-white text-slate-950 shadow-2xs font-extrabold' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <CeoPersonaSvg size={12} className={executiveRole === 'CEO' ? 'text-slate-950' : 'text-slate-400'} />
              <span>CEO</span>
            </button>
            <button
              onClick={() => setExecutiveRole('CFO')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                executiveRole === 'CFO' ? 'bg-white text-slate-950 shadow-2xs font-extrabold' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <CfoPersonaSvg size={12} className={executiveRole === 'CFO' ? 'text-slate-950' : 'text-slate-400'} />
              <span>CFO</span>
            </button>
            <button
              onClick={() => setExecutiveRole('COO')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                executiveRole === 'COO' ? 'bg-white text-slate-950 shadow-2xs font-extrabold' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <CooPersonaSvg size={12} className={executiveRole === 'COO' ? 'text-slate-950' : 'text-slate-400'} />
              <span>COO</span>
            </button>
          </div>
        </div>

        {/* Right Action & MCP Protocol Indicator */}
        <div className="flex items-center gap-2">
          {/* Double Diamond Badge */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold whitespace-nowrap">
            <DoubleDiamondSvg size={14} className="text-slate-900" />
            <span className="text-[11px]">Iterative Process</span>
          </div>

          {/* MCP Popover Button */}
          <div className="relative">
            <button
              onClick={() => setMcpPopoverOpen(!mcpPopoverOpen)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-black text-slate-950 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-all cursor-pointer whitespace-nowrap shadow-2xs btn-tactile"
              title="Model Context Protocol (MCP) Server Active"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-mono">MCP Protocol</span>
              <span className="text-[10px] bg-slate-950 text-white px-1.5 py-0.5 rounded-md font-mono font-bold">4 Tools</span>
            </button>

            {mcpPopoverOpen && (
              <div className="absolute right-0 top-full mt-2 w-84 bg-white border border-slate-200 rounded-2xl shadow-xl p-3.5 z-50">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                  <div className="font-black text-xs text-slate-950">
                    ⚡ MCP Protocol (Port 5435 Live)
                  </div>
                  <span className="text-[10px] px-2 py-0.5 bg-slate-950 text-white rounded font-mono font-bold">ACTIVE</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="font-bold text-slate-400 text-[10px] uppercase tracking-wider">4 Công Cụ Kích Hoạt (Zero-Mock):</div>
                  <div className="space-y-1.5">
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="font-mono text-xs font-black text-slate-950">query_enterprise_dwh</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 font-medium">PostgreSQL 16 • AST Guard • SHA-256</div>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="font-mono text-xs font-black text-slate-950">inspect_database_schema</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 font-medium">Catalog bảng & view hệ thống</div>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="font-mono text-xs font-black text-slate-950">analyze_budget_variance</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 font-medium">Đối soát Excel Q3/2026 vs PostgreSQL</div>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="font-mono text-xs font-black text-slate-950">get_executive_kpis</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 font-medium">KPI vĩ mô Ban Giám đốc</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area: Widescreen Max-W-5XL for High Signal & No Awkward Text Wraps */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        {messages.length === 0 ? (
          /* Minimalist Copilot Workspace */
          <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-12 my-auto text-center select-none animate-in fade-in duration-300">
            <div className="w-14 h-14 rounded-2xl bg-slate-950 flex items-center justify-center shadow-lg shadow-slate-950/10 mb-6 text-white">
              <CopilotAiSvg size={30} className="text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">
              Hôm nay bạn muốn làm gì?
            </h1>
          </div>
        ) : (
          /* Active Chat Messages Stream */
          <div className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className="w-full">
                {msg.role === 'assistant' ? (
                  (msg.uiType === 'sankey_chart' || msg.sankeyData ||
                   msg.uiType === 'gauge_chart' || msg.gaugeData ||
                   msg.uiType === 'waterfall_chart' || msg.waterfallData ||
                   msg.uiType === 'radar_chart' || msg.radarData ||
                   msg.uiType === 'sunburst_chart' || msg.sunburstData ||
                   msg.uiType === 'workflow_chart' || msg.workflowData ||
                   msg.uiType === 'diagram_image' || msg.diagramData ||
                   msg.uiType === 'company_org' || msg.orgData ||
                   msg.uiType === 'company_status' || msg.statusBriefingData ||
                   msg.uiType === 'single_day_spotlight' || msg.spotlightData ||
                   msg.uiType === 'leaderboard' || msg.leaderboardData ||
                   msg.uiType === 'kpi_grid' || (msg.kpiData && msg.kpiData.length > 0) ||
                   msg.uiType === 'variance_matrix' || (msg.varianceItems && msg.varianceItems.length > 0) ||
                   msg.uiType === 'data_table' || (msg.tableData && msg.tableData.length > 0) ||
                   msg.uiType === 'schema_catalog' || (msg.schemaData && msg.schemaData.length > 0) ||
                   msg.uiType === 'risk_alert' || msg.riskData ||
                   msg.uiType === 'briefing' || msg.briefingData ||
                   (msg.chartData && msg.chartData.records && msg.chartData.records.length > 0)) ? (
                    /* Generative UI Assistant Message Envelope for DATA / METRICS / CHARTS / ORG / DIAGRAMS */
                    <div className="w-full">
                      <ConversationalStatusEnvelope
                        assistantName="Enterprise Copilot"
                        personaTitle={
                          executiveRole === 'CEO' 
                            ? 'CEO Persona' 
                            : executiveRole === 'CFO' 
                            ? 'CFO Persona' 
                            : 'COO Persona'
                        }
                        modelBadge={selectedModel === 'agy-gemini' ? 'Antigravity' : selectedModel.toUpperCase()}
                        responseTimeMs={14}
                        actionPanelSlot={
                          <InteractiveActionPanel
                            summaryText={msg.content}
                            sha256Hash={msg.audit?.sha256Checksum || "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}
                            onExportExcel={() => alert("Đang xuất báo cáo kiểm toán Excel...")}
                            onSignVerification={(hash) => alert(`Đã bảo chứng chữ ký số SHA-256:\n${hash}`)}
                          />
                        }
                      >
                        {/* Collapsible Deep-Thinking Trace */}
                        <ThinkingAccordion 
                          durationSec={msg.thinkingDurationSec || 1.6} 
                          steps={msg.thinkingSteps} 
                        />

                        {/* Executive commentary text */}
                        {msg.content && (
                          <div className="text-[14px] text-slate-800 leading-relaxed font-medium bg-slate-50/80 p-3.5 rounded-xl border border-slate-100">
                            {msg.content}
                          </div>
                        )}

                        {msg.uiType === 'sankey_chart' || msg.sankeyData ? (
                          <div className="space-y-2">
                            <ExecutiveSankeyChart data={msg.sankeyData} />
                          </div>
                        ) : msg.uiType === 'gauge_chart' || msg.gaugeData ? (
                          <div className="space-y-2">
                            <ExecutiveGaugeChart data={msg.gaugeData} />
                          </div>
                        ) : msg.uiType === 'waterfall_chart' || msg.waterfallData ? (
                          <div className="space-y-2">
                            <ExecutiveWaterfallChart data={msg.waterfallData} />
                          </div>
                        ) : msg.uiType === 'radar_chart' || msg.radarData ? (
                          <div className="space-y-2">
                            <ExecutiveRadarChart data={msg.radarData} />
                          </div>
                        ) : msg.uiType === 'sunburst_chart' || msg.sunburstData ? (
                          <div className="space-y-2">
                            <ExecutiveSunburstChart data={msg.sunburstData} />
                          </div>
                        ) : msg.uiType === 'workflow_chart' || msg.workflowData ? (
                          <div className="space-y-2">
                            <InteractiveWorkflowChart workflowData={msg.workflowData} />
                          </div>
                        ) : msg.uiType === 'diagram_image' || msg.diagramData ? (
                          <div className="space-y-2">
                            <DiagramViewerCard {...(msg.diagramData as any)} />
                          </div>
                        ) : msg.uiType === 'company_org' || msg.orgData ? (
                          <div className="space-y-2">
                            <CompanyOrgCard {...msg.orgData} />
                          </div>
                        ) : msg.uiType === 'company_status' || msg.statusBriefingData ? (
                          <div className="space-y-2">
                            <CompanyStatusBriefing {...msg.statusBriefingData} />
                          </div>
                        ) : msg.uiType === 'single_day_spotlight' || msg.spotlightData ? (
                          <div className="space-y-2">
                            <SingleDaySpotlight {...msg.spotlightData} />
                          </div>
                        ) : msg.uiType === 'leaderboard' || msg.leaderboardData ? (
                          <div className="space-y-2">
                            <DynamicLeaderboardTable {...msg.leaderboardData} />
                          </div>
                        ) : msg.uiType === 'kpi_grid' || (msg.kpiData && msg.kpiData.length > 0) ? (
                          <div className="space-y-2">
                            <KpiMetricGrid metrics={msg.kpiData} />
                          </div>
                        ) : msg.uiType === 'variance_matrix' || (msg.varianceItems && msg.varianceItems.length > 0) ? (
                          <div className="space-y-2">
                            <VarianceMatrixGrid items={msg.varianceItems || []} />
                          </div>
                        ) : msg.uiType === 'data_table' || (msg.tableData && msg.tableData.length > 0) ? (
                          <div className="space-y-2">
                            <InteractiveDataTable data={msg.tableData || []} />
                          </div>
                        ) : msg.uiType === 'schema_catalog' || (msg.schemaData && msg.schemaData.length > 0) ? (
                          <div className="space-y-2">
                            <SchemaCatalogViewer catalog={msg.schemaData || []} />
                          </div>
                        ) : msg.uiType === 'risk_alert' || msg.riskData ? (
                          <div className="space-y-2">
                            <RiskAlertCallout {...msg.riskData} />
                          </div>
                        ) : msg.uiType === 'briefing' || msg.briefingData ? (
                          <ExecutiveBriefingCard {...msg.briefingData} onAskFollowup={onSendMessage} />
                        ) : msg.chartData && msg.chartData.records && msg.chartData.records.length > 0 ? (
                          <div className="space-y-2">
                            <ChatChart
                              chartConfig={msg.chartData.chartConfig}
                              records={msg.chartData.records}
                              audit={msg.chartData.audit}
                              varianceData={msg.chartData.varianceData}
                            />
                          </div>
                        ) : null}
                      </ConversationalStatusEnvelope>
                    </div>
                  ) : (
                    /* Natural Conversational AI Chat Message */
                    <NaturalMarkdownMessage
                      content={msg.content}
                      modelName={selectedModel === 'agy-gemini' ? 'Antigravity Gemini (Proxy 8899)' : selectedModel.toUpperCase()}
                      thinkingDurationSec={msg.thinkingDurationSec}
                      thinkingSteps={msg.thinkingSteps}
                    />
                  )
                ) : (
                  /* User Prompt Pill */
                  <div className="flex gap-3 justify-end w-full">
                    <div className="px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed break-words bg-slate-900 text-white font-bold rounded-tr-sm max-w-[80%] shadow-2xs">
                      {msg.content}
                    </div>
                    <div className="w-8 h-8 rounded-full bg-slate-950 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      <UserAvatarSvg size={16} />
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <ThinkingIndicator />
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* Floating Bottom Composer */}
      <footer className="w-full shrink-0 bg-gradient-to-t from-white via-white/95 to-transparent pt-3 pb-4 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex flex-col">
          {/* Rounded Floating Box */}
          <div className="relative flex items-end gap-2 bg-white border border-slate-300 rounded-3xl p-2 pl-3.5 focus-within:border-slate-950 focus-within:shadow-[0_2px_14px_rgba(0,0,0,0.06)] transition-all">
            {/* Attachment Button */}
            <button
              type="button"
              className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors shrink-0 mb-0.5 cursor-pointer"
              title="Đính kèm tài liệu"
            >
              <Paperclip size={18} strokeWidth={2.2} />
            </button>

            {/* Input Textarea */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Hỏi về doanh thu, đối soát ngân sách, hợp đồng, schema DWH..."
              className="flex-1 bg-transparent border-none outline-none resize-none text-[14px] font-bold text-slate-950 placeholder:text-slate-400 py-2 max-h-40 leading-relaxed"
            />

            {/* Send Button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!inputText.trim() || isLoading}
              className={`p-2.5 rounded-full transition-all shrink-0 mb-0.5 cursor-pointer btn-tactile ${
                inputText.trim() && !isLoading
                  ? 'bg-slate-950 text-white hover:bg-black shadow-xs'
                  : 'bg-slate-100 text-slate-400 opacity-50 cursor-not-allowed'
              }`}
              title="Gửi tin nhắn"
            >
              <ArrowUp size={18} strokeWidth={2.6} />
            </button>
          </div>

          {/* Disclaimer text */}
          <div className="text-center text-[11px] font-bold text-slate-400 mt-2 whitespace-nowrap">
            C-Suite Intelligence • Zero-Mock Architecture • PostgreSQL 16 & MCP Server Active
          </div>
        </div>
      </footer>
    </div>
  );
};
