'use client';

import React, {
  FC,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import clsx from 'clsx';
import {
  CopilotChat,
  CopilotKitCSSProperties,
  InputProps,
  UserMessageProps,
  AssistantMessage,
  AssistantMessageProps,
  Markdown,
} from '@copilotkit/react-ui';
import { useSWRConfig } from 'swr';
import { Input } from '@gitroom/frontend/components/agents/agent.input';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import {
  CopilotKit,
  useCopilotAction,
  useCopilotMessagesContext,
} from '@copilotkit/react-core';
import {
  MediaPortal,
  PropertiesContext,
} from '@gitroom/frontend/components/agents/agent';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useParams } from 'next/navigation';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import {
  Message as CopilotMessage,
  TextMessage,
} from '@copilotkit/runtime-client-gql';
import { AddEditModal } from '@gitroom/frontend/components/new-launch/add.edit.modal';
import dayjs from 'dayjs';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { ExistingDataContextProvider } from '@gitroom/frontend/components/launches/helpers/use.existing.data';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { hasExtension } from '@gitroom/helpers/utils/has.extension';

const ActionStatusIndicator: FC<{
  message?: any;
  messages?: any[];
}> = ({ message, messages }) => {
  const toolCalls = message?.toolCalls || [];
  const activeTool = toolCalls[0]?.function?.name || '';

  const userMessages = (messages || []).filter((m) => m?.role === 'user');
  const lastUserMsg = userMessages[userMessages.length - 1];
  const lastUserText = (
    typeof lastUserMsg?.content === 'string'
      ? lastUserMsg.content
      : Array.isArray(lastUserMsg?.content)
      ? lastUserMsg.content.map((p: any) => p?.text || '').join('')
      : ''
  ).toLowerCase();

  const isImageRequest = useMemo(() => {
    if (
      activeTool === 'generateImageTool' ||
      /image|picture|photo|draw|art/i.test(activeTool)
    ) {
      return true;
    }
    const t = lastUserText.trim();
    if (!t) return false;
    if (/xóa ảnh|xóa hình|delete image/i.test(t)) return false;

    // Checks action + noun
    const hasImageAction =
      /(tạo|vẽ|sinh|làm|render|thiết kế|chế|chụp|generate|create|draw|make|hãy vẽ)/i.test(
        t
      );
    const hasImageNoun =
      /(ảnh|hình|bức tranh|tấm hình|tấm ảnh|bức ảnh|hình ảnh|photo|picture|image|artwork|illustration|avatar|wallpaper|poster|banner)/i.test(
        t
      );
    if (hasImageAction && hasImageNoun) return true;

    // Direct phrases
    if (
      /(tấm ảnh|bức ảnh|hình ảnh|tạo ảnh|vẽ ảnh|vẽ hình|tạo hình|bức tranh|bức hoạ)/i.test(
        t
      )
    )
      return true;
    if (
      /(generate image|draw a |draw an |picture of|photo of|illustration of)/i.test(
        t
      )
    )
      return true;
    if (/(ảnh|hình)\s+về/i.test(t)) return true;
    if (/(vẽ|phác họa|minh họa)\s+/i.test(t)) return true;

    // Assistant message tool hints
    if (
      message?.toolCalls?.some((tc: any) =>
        /image|picture|photo/i.test(tc?.function?.name || '')
      )
    ) {
      return true;
    }

    return false;
  }, [activeTool, lastUserText, message]);

  const isVideoRequest = useMemo(() => {
    if (activeTool === 'generateVideoTool' || /video/i.test(activeTool))
      return true;
    return /tạo video|làm video|quay video|sinh video|generate video/i.test(
      lastUserText
    );
  }, [activeTool, lastUserText]);

  // Image percent simulation state
  const [percent, setPercent] = useState(12);
  const [stageText, setStageText] = useState(
    'Đang phân tích prompt & kết nối Agy Gateway...'
  );
  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    if (!isImageRequest) return;
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      let p = Math.min(
        97,
        Math.round(12 + 85 * (1 - Math.exp(-elapsed / 9000)))
      );
      if (elapsed > 24000) {
        p = Math.min(99, p + Math.floor((elapsed - 24000) / 3000));
      }
      setPercent(p);

      if (p < 25) {
        setCurrentStep(1);
        setStageText(
          'Đang phân tích prompt & tối ưu phong cách (Agy AI Gateway)...'
        );
      } else if (p < 55) {
        setCurrentStep(2);
        setStageText('Đang khởi tạo canvas & tạo khung bố cục hình ảnh...');
      } else if (p < 82) {
        setCurrentStep(3);
        setStageText('Đang kết xuất chi tiết sắc nét, ánh sáng & màu sắc...');
      } else {
        setCurrentStep(4);
        setStageText(
          'Đang hoàn thiện chất lượng cao & lưu vào thư viện media...'
        );
      }
    }, 200);

    return () => clearInterval(interval);
  }, [isImageRequest]);

  // Elapsed time for text thinking state
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    if (isImageRequest || isVideoRequest) return;
    const startTime = Date.now();
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - startTime);
    }, 100);
    return () => clearInterval(interval);
  }, [isImageRequest, isVideoRequest]);

  const elapsedSec = (elapsedMs / 1000).toFixed(1);

  if (isImageRequest) {
    return (
      <div className="my-3 p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#141824] border border-purple-200 dark:border-purple-500/30 shadow-[0_8px_30px_rgba(168,85,247,0.12)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.6)] text-gray-900 dark:text-white animate-in fade-in zoom-in-95 duration-200 max-w-[560px]">
        {/* Top row: Status Title + Percentage Pill */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-md shadow-purple-500/30 shrink-0">
              <svg
                className="w-5 h-5 animate-pulse"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-purple-900 dark:text-purple-200 tracking-tight">
                  Đang tạo ảnh AI...
                </span>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-600 dark:bg-purple-400"></span>
                </span>
              </div>
              <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                Agy Gateway · 6 Tài khoản hoạt động
              </span>
            </div>
          </div>

          {/* Percentage badge */}
          <div className="flex items-center gap-1.5 bg-purple-50 dark:bg-purple-950/70 border border-purple-300 dark:border-purple-500/40 px-3 py-1 rounded-full shadow-sm">
            <div className="w-2 h-2 rounded-full bg-purple-600 dark:bg-purple-400 animate-ping" />
            <span className="font-mono font-extrabold text-sm text-purple-700 dark:text-purple-300">
              {percent}%
            </span>
          </div>
        </div>

        {/* Progress bar container */}
        <div className="w-full bg-purple-100/70 dark:bg-black/50 rounded-full h-3 overflow-hidden p-0.5 border border-purple-200 dark:border-purple-500/20 mb-3 relative">
          <div
            className="h-full rounded-full transition-all duration-200 ease-out bg-gradient-to-r from-purple-600 via-pink-500 to-emerald-400 shadow-[0_0_14px_rgba(168,85,247,0.6)] relative overflow-hidden"
            style={{ width: `${percent}%` }}
          >
            {/* Shimmer sweep highlight */}
            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer-sweep" />
          </div>
        </div>

        {/* 4 Step Progress Pills */}
        <div className="grid grid-cols-4 gap-1.5 mb-3 text-[10px] font-medium text-center">
          <div
            className={clsx(
              'py-1 px-1.5 rounded-lg border transition-colors',
              currentStep >= 1
                ? 'bg-purple-100 dark:bg-purple-900/50 border-purple-300 dark:border-purple-500/50 text-purple-900 dark:text-purple-200 font-semibold'
                : 'bg-gray-50 dark:bg-white/[0.02] border-gray-200 dark:border-white/5 text-gray-400'
            )}
          >
            1. Prompt
          </div>
          <div
            className={clsx(
              'py-1 px-1.5 rounded-lg border transition-colors',
              currentStep >= 2
                ? 'bg-purple-100 dark:bg-purple-900/50 border-purple-300 dark:border-purple-500/50 text-purple-900 dark:text-purple-200 font-semibold'
                : 'bg-gray-50 dark:bg-white/[0.02] border-gray-200 dark:border-white/5 text-gray-400'
            )}
          >
            2. Bố cục
          </div>
          <div
            className={clsx(
              'py-1 px-1.5 rounded-lg border transition-colors',
              currentStep >= 3
                ? 'bg-purple-100 dark:bg-purple-900/50 border-purple-300 dark:border-purple-500/50 text-purple-900 dark:text-purple-200 font-semibold'
                : 'bg-gray-50 dark:bg-white/[0.02] border-gray-200 dark:border-white/5 text-gray-400'
            )}
          >
            3. Chi tiết
          </div>
          <div
            className={clsx(
              'py-1 px-1.5 rounded-lg border transition-colors',
              currentStep >= 4
                ? 'bg-purple-100 dark:bg-purple-900/50 border-purple-300 dark:border-purple-500/50 text-purple-900 dark:text-purple-200 font-semibold'
                : 'bg-gray-50 dark:bg-white/[0.02] border-gray-200 dark:border-white/5 text-gray-400'
            )}
          >
            4. Hoàn tất
          </div>
        </div>

        {/* Dynamic stage subtext */}
        <div className="flex items-center justify-between text-xs pt-1.5 border-t border-purple-100 dark:border-white/5">
          <span className="text-purple-900 dark:text-purple-300 font-medium truncate pr-2">
            {stageText}
          </span>
          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono shrink-0">
            NaN-Team AI
          </span>
        </div>
      </div>
    );
  }

  if (isVideoRequest) {
    return (
      <div className="my-3 p-4 rounded-2xl bg-white dark:bg-[#141824] border border-blue-200 dark:border-blue-500/30 shadow-[0_8px_30px_rgba(59,130,246,0.1)] dark:shadow-xl text-gray-900 dark:text-white max-w-[520px]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500 text-white shadow-sm shrink-0">
              <svg
                className="w-4 h-4 animate-pulse"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <span className="font-bold text-sm text-blue-900 dark:text-blue-300">
                Đang khởi tạo video AI...
              </span>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Đang phân tích kịch bản & kết nối mô hình sinh video...
              </p>
            </div>
          </div>
        </div>
        <div className="w-full bg-blue-100 dark:bg-blue-950/40 rounded-full h-1.5 overflow-hidden border border-blue-200/60 dark:border-blue-500/20 relative mt-2">
          <div className="h-full w-2/5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] animate-shimmer-sweep" />
        </div>
      </div>
    );
  }

  let actionTitle = 'Đang soạn câu trả lời...';
  let actionDetail =
    'NaN-Team AI đang tổng hợp thông tin và phản hồi cho bạn...';

  if (activeTool === 'postsListTool') {
    actionTitle = 'Đang tra cứu danh sách bài viết...';
    actionDetail =
      'Đang kiểm tra lịch đăng và trạng thái bài viết trên hệ thống...';
  } else if (activeTool === 'integrationSchemaTool') {
    actionTitle = 'Đang đọc thông số mạng xã hội...';
    actionDetail = 'Đang tải quy định định dạng và chính sách của các kênh...';
  } else if (activeTool === 'postSettingsTool') {
    actionTitle = 'Đang cập nhật cấu hình bài viết...';
    actionDetail = 'Đang lưu các tham số cài đặt đăng bài tùy chỉnh...';
  } else if (activeTool === 'schedulePostTool') {
    actionTitle = 'Đang lên lịch đăng bài...';
    actionDetail =
      'Đang truyền thông điệp tới hàng đợi xuất bản của NaN-Team...';
  } else if (activeTool === 'manualPosting') {
    actionTitle = 'Đang mở giao diện soạn thảo bài viết...';
    actionDetail = 'Đang chuẩn bị bảng xem trước cho từng kênh mạng xã hội...';
  } else if (activeTool) {
    actionTitle = `Đang thực hiện tác vụ (${activeTool})...`;
    actionDetail = 'Hệ thống NaN-Team đang xử lý yêu cầu...';
  }

  return (
    <div className="my-2.5 p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#141824] border border-emerald-300/90 dark:border-emerald-500/30 shadow-[0_6px_24px_rgba(16,185,129,0.08)] dark:shadow-[0_10px_35px_rgba(0,0,0,0.5)] text-gray-900 dark:text-white inline-flex flex-col gap-2 max-w-[540px] animate-in fade-in zoom-in-95 duration-200">
      {/* Top Header: Equalizer wave + Title + Timer */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {/* AI Thinking Wave Equalizer (3 dynamic bouncing bars) */}
          <div className="flex items-center gap-1 h-5 px-1.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-500/30">
            <span className="w-1 bg-emerald-600 dark:bg-emerald-400 rounded-full animate-eq-1 inline-block" />
            <span className="w-1 bg-emerald-500 dark:bg-emerald-300 rounded-full animate-eq-2 inline-block" />
            <span className="w-1 bg-teal-500 dark:bg-teal-400 rounded-full animate-eq-3 inline-block" />
          </div>
          <span className="font-bold text-sm text-emerald-900 dark:text-emerald-300 tracking-tight">
            {actionTitle}
          </span>
        </div>

        {/* Live Elapsed Timer */}
        <div className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-500/30 px-2.5 py-0.5 rounded-full text-emerald-800 dark:text-emerald-300 font-mono text-[11px] font-semibold shrink-0">
          <svg
            className="w-3 h-3 text-emerald-600 dark:text-emerald-400 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{elapsedSec}s</span>
        </div>
      </div>

      {/* Description / Detail - Crisp, high contrast text */}
      <div className="text-xs text-gray-800 dark:text-gray-200 font-medium pl-1">
        {actionDetail}
      </div>

      {/* Slim flowing shimmer progress line */}
      <div className="w-full bg-emerald-50 dark:bg-emerald-950/40 rounded-full h-1.5 overflow-hidden border border-emerald-200/60 dark:border-emerald-500/20 relative mt-0.5">
        <div className="h-full w-2/5 rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-shimmer-sweep" />
      </div>
    </div>
  );
};

const CustomAssistantMessage: FC<AssistantMessageProps> = (props) => {
  const { isLoading, message } = props;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 my-1">
        {props.subComponent}
        {message?.content && (
          <div className="copilotKitMessage copilotKitAssistantMessage">
            <Markdown
              content={message.content}
              components={props.markdownTagRenderers}
            />
          </div>
        )}
        <ActionStatusIndicator message={message} messages={props.messages} />
      </div>
    );
  }

  return <AssistantMessage {...props} />;
};

export const AgentChat: FC = () => {
  const { backendUrl } = useVariables();
  const params = useParams<{ id: string }>();
  const { properties } = useContext(PropertiesContext);
  const t = useT();

  const newIdRef = useRef<string | null>(null);
  if (!newIdRef.current) {
    newIdRef.current = makeId(12);
  }
  const isNew = params.id === 'new';
  const effectiveThreadId = isNew ? newIdRef.current : params.id;

  useEffect(() => {
    if (!isNew && params.id) {
      try {
        localStorage.setItem('active_agent_thread_id', params.id);
      } catch (e) {}
    }
  }, [isNew, params.id]);

  return (
    <CopilotKit
      threadId={effectiveThreadId}
      credentials="include"
      headers={() => {
        if (typeof document === 'undefined') return {};
        const auth = document.cookie
          .split(';')
          .find((p) => p.trim().startsWith('auth='))
          ?.split('=')[1];
        return auth ? { auth } : {};
      }}
      runtimeUrl={backendUrl + '/copilot/agent'}
      {...({ useSingleEndpoint: true } as any)}
      showDevConsole={false}
      enableInspector={false}
      agent="postiz"
      properties={{
        integrations: properties,
      }}
    >
      <Hooks />
      <LoadMessages id={params.id} />
      <div
        style={
          {
            '--copilot-kit-primary-color': 'var(--new-btn-text)',
            '--copilot-kit-background-color': 'var(--new-bg-color)',
          } as CopilotKitCSSProperties
        }
        className="trz agent bg-newBgColorInner flex flex-col gap-[15px] transition-all flex-1 items-center relative"
      >
        <div className="absolute left-0 w-full h-full pb-[20px]">
          <CopilotChat
            className="w-full h-full"
            labels={{
              title: t('your_assistant', 'Trợ lý AI (NaN-Team)'),
              placeholder: t('type_your_message', 'Nhập yêu cầu cho AI NaN-Team (ví dụ: lên lịch bài viết, tra cứu kênh)...'),
              initial: t(
                'agent_welcome_message',
                `Xin chào! Mình là trợ lý AI của NaN-Team 🙌🏻.

Mình có thể hỗ trợ bạn:
- Lên lịch bài viết tự động đến đồng thời nhiều kênh mạng xã hội
- Sáng tạo hình ảnh minh họa và video bằng AI
- Tự động định dạng văn bản chuẩn theo từng nền tảng (Facebook, X, LinkedIn, Threads, ...)
- Tra cứu và quản lý danh sách bài viết đã lên lịch

Bạn có thể chọn kênh tương tác từ menu bên trái.
Lịch sử phiên chat được lưu trữ ở menu bên phải.
`
              ),
            }}
            UserMessage={Message}
            AssistantMessage={CustomAssistantMessage}
            Input={(inputProps) => (
              <NewInput
                {...inputProps}
                effectiveThreadId={effectiveThreadId}
                isNew={isNew}
              />
            )}
          />
        </div>
      </div>
    </CopilotKit>
  );
};

const LoadMessages: FC<{ id: string }> = ({ id }) => {
  const { messages, setMessages } = useCopilotMessagesContext();
  const fetch = useFetch();
  const currentId = useRef<string | null>(null);
  const loaded = useRef<{ id: string; messages: CopilotMessage[] } | null>(
    null
  );

  const loadMessages = useCallback(async (idToSet: string) => {
    try {
      const res = await fetch(`/copilot/${idToSet}/list`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data?.messages || !Array.isArray(data.messages)) return;
      const list = data.messages.map((p: any) => {
        const textContent =
          typeof p?.content === 'string'
            ? p.content
            : p?.content?.content ||
              (p?.content?.parts || [])
                .map((part: any) => (part.type === 'text' ? part.text : ''))
                .join('');
        return new TextMessage({
          content: textContent,
          role: p.role,
        });
      });

      if (currentId.current !== idToSet) {
        return;
      }

      loaded.current = { id: idToSet, messages: list };
      setMessages(list);
    } catch (e) {}
  }, []);

  useEffect(() => {
    currentId.current = id;
    if (id === 'new') {
      loaded.current = { id, messages: [] };
      setMessages([]);
      return;
    }
    loaded.current = null;
    loadMessages(id);
  }, [id]);

  // CopilotKit resolves loadAgentState to an empty list for Mastra local agents
  // and can clobber the messages we hold, depending on which request resolves last
  useEffect(() => {
    if (loaded.current?.id !== id) {
      return;
    }

    if (messages.length) {
      loaded.current.messages = messages;
      return;
    }

    if (loaded.current.messages.length) {
      setMessages(loaded.current.messages);
    }
  }, [messages, id]);

  return null;
};

const Message: FC<UserMessageProps> = (props) => {
  const convertContentToImagesAndVideo = useMemo(() => {
    const content = props.message?.content || '';
    const text =
      typeof content === 'string'
        ? content
        : Array.isArray(content)
        ? (content as any[]).map((p: any) => (p.type === 'text' ? p.text : '')).join('')
        : '';

    return text
      .replace(/Video: (http.*mp4\n)/g, (match, p1) => {
        return `<video controls class="h-[150px] w-[150px] rounded-[8px] mb-[10px]"><source src="${p1.trim()}" type="video/mp4">Your browser does not support the video tag.</video>`;
      })
      .replace(/Image: (http.*\n)/g, (match, p1) => {
        return `<img src="${p1.trim()}" class="h-[150px] w-[150px] max-w-full border border-newBgColorInner" />`;
      })
      .replace(/\[\-\-Media\-\-\](.*)\[\-\-Media\-\-\]/g, (match, p1) => {
        return `<div class="flex justify-center mt-[20px]">${p1}</div>`;
      })
      .replace(
        /(\[--integrations--\][\s\S]*?\[--integrations--\])/g,
        (match, p1) => {
          return ``;
        }
      );
  }, [props.message?.content]);
  return (
    <div
      className="copilotKitMessage copilotKitUserMessage min-w-[300px]"
      dangerouslySetInnerHTML={{ __html: convertContentToImagesAndVideo }}
    />
  );
};
const NewInput: FC<
  InputProps & { effectiveThreadId?: string; isNew?: boolean }
> = (props) => {
  const [media, setMedia] = useState([] as { path: string; id: string }[]);
  const [value, setValue] = useState('');
  const { properties } = useContext(PropertiesContext);
  const { mutate } = useSWRConfig();

  return (
    <>
      <MediaPortal
        value={value}
        media={media}
        setMedia={(e) => setMedia(e.target.value)}
      />
      <Input
        {...props}
        onChange={setValue}
        onSend={(text) => {
          if (props.isNew && props.effectiveThreadId) {
            try {
              localStorage.setItem(
                'active_agent_thread_id',
                props.effectiveThreadId
              );
              window.history.replaceState(
                null,
                '',
                `/agents/${props.effectiveThreadId}`
              );
            } catch (e) {}
            setTimeout(() => {
              mutate('threads');
            }, 1200);
            setTimeout(() => {
              mutate('threads');
            }, 4500);
          }
          const send = props.onSend(
            text +
              (media && media.length > 0
                ? '\n[--Media--]' +
                  media
                    .map((m) =>
                      hasExtension(m?.path || '', 'mp4')
                        ? `Video: ${m.path}`
                        : `Image: ${m.path}`
                    )
                    .join('\n') +
                  '\n[--Media--]'
                : '') +
              `
${
  properties && Array.isArray(properties) && properties.length
    ? `[--integrations--]
Use the following social media platforms: ${JSON.stringify(
        properties.map((p) => ({
          id: p?.id,
          platform: p?.identifier,
          profilePicture: p?.picture,
          additionalSettings: p?.additionalSettings,
        }))
      )}
[--integrations--]`
    : ``
}`
          );
          setValue('');
          setMedia([]);
          return send;
        }}
      />
    </>
  );
};

export const Hooks: FC = () => {
  const modals = useModals();

  useCopilotAction({
    name: 'manualPosting',
    description:
      'This tool should be triggered when the user wants to manually add the generated post',
    parameters: [
      {
        name: 'list',
        type: 'object[]',
        description:
          'list of posts to schedule to different social media (integration ids)',
        attributes: [
          {
            name: 'integrationId',
            type: 'string',
            description: 'The integration id',
          },
          {
            name: 'date',
            type: 'string',
            description: 'UTC date of the scheduled post',
          },
          {
            name: 'settings',
            type: 'object',
            description: 'Settings for the integration [input:settings]',
          },
          {
            name: 'posts',
            type: 'object[]',
            description: 'list of posts / comments (one under another)',
            attributes: [
              {
                name: 'content',
                type: 'string',
                description: 'the content of the post',
              },
              {
                name: 'attachments',
                type: 'object[]',
                description: 'list of attachments',
                attributes: [
                  {
                    name: 'id',
                    type: 'string',
                    description: 'id of the attachment',
                  },
                  {
                    name: 'path',
                    type: 'string',
                    description: 'url of the attachment',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    renderAndWaitForResponse: ({ args, status, respond }) => {
      if (status === 'executing') {
        return <OpenModal args={args} respond={respond} />;
      }

      return null;
    },
  });
  return null;
};

const OpenModal: FC<{
  respond: (value: any) => void;
  args: {
    list: {
      integrationId: string;
      date: string;
      settings?: Record<string, any>;
      posts: { content: string; attachments: { id: string; path: string }[] }[];
    }[];
  };
}> = ({ args, respond }) => {
  const modals = useModals();
  const { properties } = useContext(PropertiesContext);
  const safeProperties = Array.isArray(properties) ? properties : [];
  const startModal = useCallback(async () => {
    for (const integration of args?.list || []) {
      await new Promise((res) => {
        const group = makeId(10);
        modals.openModal({
          id: 'add-edit-modal',
          closeOnClickOutside: false,
          removeLayout: true,
          closeOnEscape: false,
          withCloseButton: false,
          askClose: true,
          size: '80%',
          title: ``,
          classNames: {
            modal: 'w-[100%] max-w-[1400px] text-textColor',
          },
          children: (
            <ExistingDataContextProvider
              value={{
                group,
                integration: integration.integrationId,
                integrationPicture:
                  safeProperties.find((p) => p.id === integration.integrationId)
                    ?.picture || '',
                settings: integration.settings || {},
                posts: (integration.posts || []).map((p) => ({
                  approvedSubmitForOrder: 'NO',
                  content: p.content,
                  createdAt: new Date().toISOString(),
                  state: 'DRAFT',
                  id: makeId(10),
                  settings: JSON.stringify(integration.settings || {}),
                  group,
                  integrationId: integration.integrationId,
                  integration: safeProperties.find(
                    (p) => p.id === integration.integrationId
                  ),
                  publishDate: dayjs.utc(integration.date).toISOString(),
                  image: (p.attachments || []).map((a) => ({
                    id: a.id,
                    path: a.path,
                  })),
                })),
              }}
            >
              <AddEditModal
                date={dayjs.utc(integration.date)}
                allIntegrations={safeProperties}
                integrations={safeProperties.filter(
                  (p) => p.id === integration.integrationId
                )}
                onlyValues={(integration.posts || []).map((p) => ({
                  content: p.content,
                  id: makeId(10),
                  settings: integration.settings || {},
                  image: (p.attachments || []).map((a) => ({
                    id: a.id,
                    path: a.path,
                  })),
                }))}
                reopenModal={() => {}}
                mutate={() => res(true)}
              />
            </ExistingDataContextProvider>
          ),
        });
      });
    }

    respond('User scheduled all the posts');
  }, [args, respond, properties]);

  useEffect(() => {
    startModal();
  }, []);
  return (
    <div onClick={() => respond('continue')}>
      Opening manually ${JSON.stringify(args)}
    </div>
  );
};
