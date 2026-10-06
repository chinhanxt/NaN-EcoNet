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
import { useToaster } from '@gitroom/react/toaster/toaster';
import { Input } from '@gitroom/frontend/components/agents/agent.input';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import {
  CopilotKit,
  useCopilotAction,
  useCopilotChatInternal,
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
import { isVideoPath } from '@gitroom/helpers/utils/media.kind';
import { AgentJobProgress, agentMessageJobs } from '@gitroom/frontend/components/agents/agent.job.progress';
import { AiWaitStream } from '@gitroom/frontend/components/ui/ai.wait.stream';
import { AgentMediaPreview, agentMessageMedia } from '@gitroom/frontend/components/agents/agent.media.preview';
import { useIntegrationList } from '@gitroom/frontend/components/launches/helpers/use.integration.list';
import ImageWithFallback from '@gitroom/react/helpers/image.with.fallback';
import SafeImage from '@gitroom/react/helpers/safe.image';

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
    // "tạo 1 video", "làm cho tôi một video ngắn", "dựng clip"...
    return /(tạo|làm|quay|sinh|dựng|edit|chỉnh|cắt)\s+(?:\S+\s+){0,3}(video|clip)|generate (a )?video/i.test(
      lastUserText
    );
  }, [activeTool, lastUserText]);

  // Elapsed time for text thinking state
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - startTime);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const elapsedSec = (elapsedMs / 1000).toFixed(1);

  if (isImageRequest) {
    const editing = /(chỉnh|sửa|xóa nền|tách nền|đổi màu|edit)/i.test(lastUserText);
    return <AiWaitStream kind={editing ? 'edit' : 'image'} title={editing ? 'AI đang chỉnh ảnh' : 'AI đang tạo ảnh'} className="my-3" />;
  }

  if (isVideoRequest) {
    return <AiWaitStream kind="video" title="Đang khởi tạo video AI" expectedSeconds={30} compact className="my-3" />;
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

/** Video jobs this message started or checked: from its text, tool calls and tool results. */
const messageJobs = (message: any) => {
  const text = typeof message?.content === 'string' ? message.content
    : Array.isArray(message?.content) ? message.content.map((part: any) => (part?.type === 'text' ? part.text : '')).join('') : '';
  const toolCalls: any[] = message?.toolCalls || [];
  const parts: any[] = Array.isArray(message?.parts) ? message.parts : [];
  const names = [...toolCalls.map((call) => call?.function?.name || ''), ...parts.map((part) => part?.toolInvocation?.toolName || '')];
  const args = JSON.stringify([toolCalls.map((call) => call?.function?.arguments), parts.map((part) => [part?.toolInvocation?.args, part?.toolInvocation?.result])]);
  return agentMessageJobs(text, names, args);
};

/** Whether the chat is still running (CopilotChat onInProgress), so turn-level UI waits for the end of the turn. */
const ChatInProgressContext = React.createContext(false);

/** The chat input's send function, so in-message UI (e.g. the channel picker under an old question) can post a user reply. */
const ChatSendContext = React.createContext<React.MutableRefObject<((text: string) => unknown) | null>>({ current: null });

/** Assistant text that asks the user which channel to post to (older turns asked in plain text instead of selectChannels). */
const CHANNEL_QUESTION = /kênh\s*(?:đăng\s*)?nào|chọn\s*kênh|kênh\s*đăng\s*\(channel\)|which\s+channel/i;

/** Shown by CopilotChat in place of its default "• • •" while the agent works between messages/tool calls. */
const AgentThinkingPill: FC = () => (
  <span
    role="status"
    aria-live="polite"
    className="my-2 flex w-fit items-center gap-2.5 rounded-full border border-emerald-300/80 dark:border-emerald-500/30 bg-white dark:bg-[#141824] py-1.5 ps-1.5 pe-3.5 shadow-[0_4px_16px_rgba(16,185,129,0.10)] dark:shadow-[0_6px_20px_rgba(0,0,0,0.45)] animate-in fade-in duration-200"
  >
    <span className="flex h-6 items-center gap-[3px] rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-500/30 px-2">
      <span className="w-[3px] bg-emerald-600 dark:bg-emerald-400 rounded-full animate-eq-1 inline-block" />
      <span className="w-[3px] bg-emerald-500 dark:bg-emerald-300 rounded-full animate-eq-2 inline-block" />
      <span className="w-[3px] bg-teal-500 dark:bg-teal-400 rounded-full animate-eq-3 inline-block" />
      <span className="w-[3px] bg-emerald-500 dark:bg-emerald-300 rounded-full animate-eq-1 inline-block" />
    </span>
    <span className="relative overflow-hidden whitespace-nowrap text-[13px] font-semibold tracking-tight text-emerald-800 dark:text-emerald-300">
      AI NaN-Team đang suy nghĩ
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 start-0 w-1/3 bg-gradient-to-r from-transparent via-white/80 dark:via-white/25 to-transparent animate-shimmer-sweep"
      />
    </span>
  </span>
);

const contentText = (content: any): string =>
  typeof content === 'string'
    ? content
    : Array.isArray(content)
    ? content.map((part: any) => (part?.type === 'text' ? part.text || '' : '')).join('')
    : content
    ? JSON.stringify(content)
    : '';

/** Tools that put a post on the calendar (backend schedulePostTool, frontend manualPosting action). */
const SCHEDULE_TOOLS = new Set(['schedulePostTool', 'integrationSchedulePostTool', 'manualPosting']);

/** A scheduling tool result counts only when it created a post: a postId and no errors (JSON may be string-escaped). */
const scheduleToolSucceeded = (name: string, result: string) =>
  name === 'manualPosting'
    ? /User scheduled all the posts/i.test(result)
    : /\\?"postId\\?"\s*:\s*\\?"[^"\\\s]+/.test(result) && !/\\?"errors\\?"\s*:/.test(result);

const SCHEDULE_SUCCESS_TEXT =
  /đã được lên lịch|lên lịch.*thành công|lên lịch đăng.*thành công|hoàn tất.*lên lịch|đã gửi yêu cầu đăng|đã tạo bài đăng|mã bài viết|bài viết đã được lên lịch/i;
const SCHEDULE_NOT_DONE_TEXT =
  /bạn có muốn.*lên lịch|hỗ trợ.*lên lịch.*không\?|chưa (được )?lên lịch|không thể (lên lịch|đăng)|lên lịch.*thất bại/i;

const sameMessage = (a: any, b: any) => a === b || (!!a?.id && a.id === b?.id);

/**
 * Turn = every message between two user messages. Returns whether `message` is the turn's last assistant
 * message, whether a later user message already closed the turn, and whether the turn scheduled a post.
 */
const scheduleTurn = (messages: any[], message: any) => {
  const index = messages.findIndex((item) => sameMessage(item, message));
  if (index < 0) return { isLast: false, closed: false, scheduled: false };
  let start = index;
  while (start > 0 && messages[start - 1]?.role !== 'user') start--;
  let end = index;
  while (end + 1 < messages.length && messages[end + 1]?.role !== 'user') end++;
  const turn = messages.slice(start, end + 1);
  const lastAssistant = [...turn].reverse().find((item) => item?.role === 'assistant');
  const isLast = sameMessage(lastAssistant, message);
  const closed = end < messages.length - 1;
  if (!isLast) return { isLast, closed, scheduled: false };

  const callNames = new Map<string, string>();
  turn.forEach((item) =>
    (item?.toolCalls || []).forEach((call: any) => call?.id && callNames.set(call.id, call?.function?.name || ''))
  );
  const toolScheduled = turn.some((item) => {
    if (item?.role === 'tool') {
      const name = callNames.get(item.toolCallId) || item.toolName || '';
      return SCHEDULE_TOOLS.has(name) && scheduleToolSucceeded(name, contentText(item.content));
    }
    return (Array.isArray(item?.parts) ? item.parts : []).some((part: any) => {
      const name = part?.toolInvocation?.toolName || '';
      return (
        SCHEDULE_TOOLS.has(name) &&
        part?.toolInvocation?.state === 'result' &&
        scheduleToolSucceeded(name, contentText(part.toolInvocation.result))
      );
    });
  });
  const text = contentText(message?.content);
  const textScheduled = SCHEDULE_SUCCESS_TEXT.test(text) && !SCHEDULE_NOT_DONE_TEXT.test(text);
  return { isLast, closed, scheduled: toolScheduled || textScheduled };
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Media URLs already shown by AgentMediaPreview: the first occurrence becomes a short link label,
 * repeats are dropped (and a line left as just "Hình ảnh:" goes with them).
 */
const compactMediaLinks = (text: string, urls: string[]) => {
  if (!text || !urls.length) return text;
  const alt = [...urls].sort((a, b) => b.length - a.length).map(escapeRegExp).join('|');
  const pattern = new RegExp(
    `!?\\[[^\\]\\n]*\\]\\(\\s*<?(${alt})>?(?:\\s+"[^"]*")?\\s*\\)|<(${alt})>|\`(${alt})\`|(${alt})(?![\\w/%=&#~+-])`,
    'g'
  );
  const seen = new Set<string>();
  return text
    .split('\n')
    .map((line) => {
      let removed = false;
      let kept = false;
      const next = line.replace(pattern, (_match, a, b, c, d) => {
        const url = a || b || c || d;
        if (seen.has(url)) {
          removed = true;
          return '';
        }
        seen.add(url);
        kept = true;
        return `[${isVideoPath(url) ? '🎬 Video đã tạo' : '🖼 Ảnh đã tạo'}](${url})`;
      });
      if (!removed) return next;
      const cleaned = next.replace(/\(\s*\)/g, '').replace(/[ \t]{2,}/g, ' ').trimEnd();
      const bare = cleaned.replace(/[()[\]*_`>#•\-\s]/g, '');
      return !kept && (!bare || bare.endsWith(':')) ? null : cleaned;
    })
    .filter((line): line is string => line !== null)
    .join('\n');
};

const CustomAssistantMessage: FC<AssistantMessageProps> = (props) => {
  const { isLoading, message } = props;
  const chatInProgress = useContext(ChatInProgressContext);
  const jobs = useMemo(() => messageJobs(message), [message]);
  const turn = useMemo(() => scheduleTurn((props as any).messages || [], message), [(props as any).messages, message]);
  const sendRef = useContext(ChatSendContext);
  const [pickerResult, setPickerResult] = useState<any>(null);

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
        {jobs.length ? <AgentJobProgress jobs={jobs} /> : <ActionStatusIndicator message={message} messages={props.messages} />}
      </div>
    );
  }

  const messageText = contentText(message?.content);
  const mediaUrls = agentMessageMedia(messageText);
  const displayText = compactMediaLinks(messageText, mediaUrls);
  const displayProps =
    message && displayText !== messageText
      ? { ...props, message: { ...message, content: displayText } as typeof message }
      : props;

  // Calendar card: once per turn, on its last assistant message, after the turn ended, and only if a post was really scheduled
  const turnFinished = turn.closed || (!chatInProgress && !props.isGenerating);
  const hasLaunchOrSchedule = turn.isLast && turnFinished && turn.scheduled;
  // Unanswered text question about the channel (also in reloaded old threads): offer the picker right under it.
  const showChannelPicker =
    turn.isLast && !turn.closed && turnFinished && !turn.scheduled && CHANNEL_QUESTION.test(messageText);
  const answerChannels = (value: any) => {
    setPickerResult(value);
    const picked: { id: string; name: string; platform: string }[] = Array.isArray(value?.selected) ? value.selected : [];
    if (!picked.length) return;
    // Visible bubble: just the channel names; ids + instruction ride in the hidden [--integrations--] block.
    sendRef.current?.(
      `Chọn ${picked.map((item) => item.name).join(', ')}\n[--integrations--]\n` +
        `Use the following social media platforms: ${JSON.stringify(picked.map((item) => ({ id: item.id, platform: item.platform })))}. ` +
        'Schedule it now with exactly the same content, media and time as above; do not ask again.\n[--integrations--]'
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <AssistantMessage {...displayProps} />
      <AgentMediaPreview urls={mediaUrls} />
      <AgentJobProgress jobs={jobs} />
      {showChannelPicker &&
        (pickerResult ? (
          <ChannelPickerSummary result={pickerResult} />
        ) : (
          <ChannelPicker args={{ reason: 'Chọn kênh để đăng bài', multiple: true }} respond={answerChannels} />
        ))}
      {hasLaunchOrSchedule && (
        <div className="mt-1 p-3.5 rounded-2xl bg-white dark:bg-[#141824] border border-emerald-300/80 dark:border-emerald-500/30 shadow-[0_4px_20px_rgba(16,185,129,0.08)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex items-center justify-between gap-3 max-w-lg transition-all animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-emerald-500/30">
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <div className="font-semibold text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                Lịch đăng bài trên hệ thống
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                Xem vị trí bài viết và thời gian xuất bản trên lịch
              </div>
            </div>
          </div>
          <a
            href="/launches"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-md shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95 no-underline shrink-0"
          >
            <span>Mở Lịch</span>
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14 5l7 7m0 0l-7 7m7-7H3"
              />
            </svg>
          </a>
        </div>
      )}
    </div>
  );
};

export const AgentChat: FC = () => {
  const { backendUrl } = useVariables();
  const params = useParams<{ id: string }>();
  const { properties } = useContext(PropertiesContext);
  const t = useT();

  const isNew = params.id === 'new';
  const [chatInProgress, setChatInProgress] = useState(false);
  const [newThreadId, setNewThreadId] = useState(() => makeId(12));

  useEffect(() => {
    if (isNew) {
      setNewThreadId(makeId(12));
    }
  }, [isNew]);

  useEffect(() => {
    const handleNewChat = () => {
      setNewThreadId(makeId(12));
    };
    window.addEventListener('nan-start-new-chat', handleNewChat);
    return () => window.removeEventListener('nan-start-new-chat', handleNewChat);
  }, []);

  const effectiveThreadId = isNew ? newThreadId : params.id;
  const sendRef = useRef<((text: string) => unknown) | null>(null);
  const ThreadInput = useMemo(() => function ThreadInput(inputProps: InputProps) {
    return <NewInput {...inputProps} effectiveThreadId={effectiveThreadId} isNew={isNew} />;
  }, [effectiveThreadId, isNew]);

  useEffect(() => {
    if (!isNew && params.id) {
      try {
        localStorage.setItem('active_agent_thread_id', params.id);
      } catch (e) {}
    }
  }, [isNew, params.id]);

  return (
    <CopilotKit
      key={effectiveThreadId}
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
          <ChatSendContext.Provider value={sendRef}>
          <ChatInProgressContext.Provider value={chatInProgress}>
            <CopilotChat
              className="w-full h-full"
              onInProgress={setChatInProgress}
              icons={{ activityIcon: <AgentThinkingPill /> }}
              labels={{
                title: t('your_assistant', 'Trợ lý AI (NaN-Team)'),
                placeholder: t(
                  'type_your_message',
                  'Nhập yêu cầu cho AI NaN-Team (ví dụ: lên lịch bài viết, tra cứu kênh)...'
                ),
                initial: isNew
                  ? t(
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
                    )
                  : undefined,
              }}
              UserMessage={Message}
              AssistantMessage={CustomAssistantMessage}
              Input={ThreadInput}
            />
          </ChatInProgressContext.Provider>
          </ChatSendContext.Provider>
        </div>
      </div>
    </CopilotKit>
  );
};

const LoadMessages: FC<{ id: string }> = ({ id }) => {
  const { messages, setMessages, agent } = useCopilotChatInternal();
  const { setMessages: setContextMessages } = useCopilotMessagesContext();
  const fetch = useFetch();
  const currentId = useRef<string | null>(null);
  const loaded = useRef<{ id: string; messages: any[] } | null>(null);

  const loadMessages = useCallback(
    async (idToSet: string) => {
      try {
        const res = await fetch(`/copilot/${idToSet}/list`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data?.messages || !Array.isArray(data.messages)) return;
        const list = data.messages.map((p: any) => {
          let contentObj = p?.content;
          if (
            typeof contentObj === 'string' &&
            (contentObj.startsWith('{') || contentObj.startsWith('['))
          ) {
            try {
              contentObj = JSON.parse(contentObj);
            } catch (e) {}
          }
          let textContent = '';
          if (typeof contentObj === 'string') {
            textContent = contentObj;
          } else if (typeof contentObj?.content === 'string') {
            textContent = contentObj.content;
          } else if (Array.isArray(contentObj?.parts)) {
            textContent = contentObj.parts
              .filter((part: any) => part.type === 'text')
              .map((part: any) => part.text || '')
              .join('');
          }

          return {
            id: p.id,
            role: p.role,
            content: textContent,
          };
        });

        if (currentId.current !== idToSet) {
          return;
        }

        loaded.current = { id: idToSet, messages: list };
        if (agent?.setMessages) {
          agent.setMessages(list);
        }
        setMessages(list);
        try {
          const textMessages = list.map(
            (m: any) =>
              new TextMessage({ id: m.id, content: m.content, role: m.role })
          );
          setContextMessages(textMessages);
        } catch (e) {}
      } catch (e) {}
    },
    [fetch, setMessages, setContextMessages, agent]
  );

  useEffect(() => {
    currentId.current = id;
    if (id === 'new') {
      loaded.current = { id, messages: [] };
      if (agent?.setMessages) {
        agent.setMessages([]);
      }
      setMessages([]);
      try {
        setContextMessages([]);
      } catch (e) {}
      return;
    }
    loaded.current = null;
    loadMessages(id);
  }, [id, loadMessages, setMessages, setContextMessages, agent]);

  // CopilotKit resolves loadAgentState to an empty list for Mastra local agents
  // and can clobber the messages we hold, depending on which request resolves last
  useEffect(() => {
    if (id === 'new') return;
    if (loaded.current?.id !== id) return;
    if (!loaded.current.messages.length) return;

    const currentCount = agent?.messages?.length ?? messages.length;
    if (currentCount === 0) {
      if (agent?.setMessages) {
        agent.setMessages(loaded.current.messages);
      }
      setMessages(loaded.current.messages);
      try {
        const textMessages = loaded.current.messages.map(
          (m: any) =>
            new TextMessage({ id: m.id, content: m.content, role: m.role })
        );
        setContextMessages(textMessages);
      } catch (e) {}
    } else if (messages.length > loaded.current.messages.length) {
      loaded.current.messages = messages;
    }
  }, [messages, id, agent, setMessages, setContextMessages]);

  return null;
};

/** User message: typed text plus the attached images/videos of its [--Media--] block (agent context dropped). */
const userMessageParts = (text: string) => {
  const urls: string[] = [];
  const body = text
    .replace(/\[--integrations--\][\s\S]*?\[--integrations--\]/g, '')
    .replace(/\[--Media--\]([\s\S]*?)\[--Media--\]/g, (_block: string, inner: string) => {
      inner.replace(/(?:Video|Image): (\S+)/g, (item: string, url: string) => { urls.push(url); return item; });
      return '';
    })
    // Older channel-picker replies spelled out ids + instruction; show them as the short "Chọn …" form.
    .replace(
      /Đăng lên kênh:\s*([\s\S]+?)\s*\[integration id:[^\]]*\]\.?\s*Lên lịch ngay[^\n]*/g,
      (_m: string, names: string) => `Chọn ${names.replace(/\s*\([^)]*\)/g, '')}`
    )
    .trim();
  return { body, urls };
};

const Message: FC<UserMessageProps> = (props) => {
  const { body, urls } = useMemo(() => {
    const content = props.message?.content || '';
    const text =
      typeof content === 'string'
        ? content
        : Array.isArray(content)
        ? (content as any[]).map((p: any) => (p.type === 'text' ? p.text : '')).join('')
        : '';
    return userMessageParts(text);
  }, [props.message?.content]);
  return (
    <div className="my-2 ms-auto flex w-full max-w-[78%] flex-col items-end gap-1.5">
      {!!urls.length && <AgentMediaPreview urls={urls} align="end" />}
      {!!body && (
        <div className="whitespace-pre-wrap break-words rounded-[20px] rounded-br-md bg-gradient-to-br from-emerald-500 to-teal-600 px-4 py-2.5 text-[14px] leading-relaxed text-white shadow-[0_6px_20px_rgba(16,185,129,0.25)]">
          {body}
        </div>
      )}
    </div>
  );
};
const NewInput: FC<
  InputProps & { effectiveThreadId?: string; isNew?: boolean }
> = (props) => {
  const [media, setMedia] = useState([] as { path: string; id: string }[]);
  const [value, setValue] = useState('');
  const [prefill, setPrefill] = useState<{ text: string }>();
  const { properties } = useContext(PropertiesContext);
  const sendRef = useContext(ChatSendContext);
  useEffect(() => {
    sendRef.current = (text: string) => props.onSend(text);
    return () => {
      sendRef.current = null;
    };
  }, [sendRef, props.onSend]);
  const { mutate } = useSWRConfig();
  const fetch = useFetch();
  const toaster = useToaster();
  const [uploading, setUploading] = useState(0);

  // Pasted/dropped files go through the same upload + media library as "Tải lên hình ảnh / Video"
  // and join the same attachment list, so the message carries them in the usual [--Media--] block.
  const uploadFiles = useCallback(async (files: File[]) => {
    const images = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    const videos = ['video/mp4', 'video/mpeg', 'video/quicktime'];
    await Promise.all(files.map(async (file) => {
      const isImage = images.includes(file.type), isVideo = videos.includes(file.type);
      if (!isImage && !isVideo) {
        toaster.show(`Định dạng "${file.type || file.name}" chưa được hỗ trợ (ảnh PNG/JPG/GIF/WebP hoặc video MP4/MOV).`, 'warning');
        return;
      }
      if (file.size > (isImage ? 30 : 1000) * 1024 * 1024) {
        toaster.show(isImage ? 'Ảnh quá lớn, tối đa 30MB.' : 'Video quá lớn, tối đa 1GB.', 'warning');
        return;
      }
      setUploading((count) => count + 1);
      try {
        const form = new FormData();
        const extension = file.type.split('/')[1]?.replace('quicktime', 'mov').replace('jpeg', 'jpg') || 'bin';
        form.append('file', file, file.name && file.name !== 'image.png' ? file.name : `dan-tu-clipboard-${Date.now()}.${extension}`);
        const response = await fetch('/media/upload-simple', { method: 'POST', body: form });
        const saved = response.ok ? await response.json().catch(() => null) : null;
        if (!saved?.id || !saved?.path) throw new Error('upload failed');
        setMedia((current) => [...current, { id: saved.id, path: saved.path }]);
      } catch {
        toaster.show(`Không tải lên được "${file.name || 'tệp dán'}". Vui lòng thử lại.`, 'warning');
      } finally {
        setUploading((count) => count - 1);
      }
    }));
  }, [fetch, toaster]);

  return (
    <>
      <MediaPortal
        value={value}
        media={media}
        setMedia={(e) => setMedia(e.target.value)}
        onPostText={(text) => setPrefill({ text })}
      />
      <Input
        {...props}
        prefill={prefill}
        onChange={setValue}
        onFiles={uploadFiles}
        uploading={uploading}
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
                      isVideoPath(m?.path)
                        ? `Video: ${m.path}\nMediaId: ${m.id}`
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

  useCopilotAction({
    name: 'selectChannels',
    description:
      'Show an interactive channel picker in the chat so the user chooses which channel(s) to post/schedule to. Use it instead of asking about channels in text. The result is { selected: [{ id, name, platform }] } or { cancelled: true }.',
    parameters: [
      {
        name: 'reason',
        type: 'string',
        description:
          'Short Vietnamese prompt shown as the picker title, with what and when (e.g. "Chọn kênh để lên lịch lúc 16:00 02/10")',
      },
      {
        name: 'multiple',
        type: 'boolean',
        description: 'true to allow several channels, false for exactly one',
      },
      {
        name: 'suggestedIds',
        type: 'string[]',
        description: 'Optional channel ids to pre-select',
        required: false,
      },
    ],
    renderAndWaitForResponse: ({ args, status, respond, result }) => {
      if (status === 'executing') {
        return <ChannelPicker args={args} respond={respond} />;
      }
      if (status === 'complete') {
        return <ChannelPickerSummary result={result} />;
      }
      return (
        <div className="my-1 text-[12px] text-gray-500 dark:text-gray-400">
          Đang chuẩn bị danh sách kênh…
        </div>
      );
    },
  });
  return null;
};

const PLATFORM_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  'instagram-standalone': 'Instagram',
  x: 'X',
  linkedin: 'LinkedIn',
  'linkedin-page': 'LinkedIn Page',
  threads: 'Threads',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  pinterest: 'Pinterest',
  bluesky: 'Bluesky',
  reddit: 'Reddit',
  telegram: 'Telegram',
  discord: 'Discord',
  mastodon: 'Mastodon',
  gmb: 'Google Business',
  dribbble: 'Dribbble',
  lemmy: 'Lemmy',
  slack: 'Slack',
  wrapcast: 'Warpcast',
  nostr: 'Nostr',
  vk: 'VK',
};

const platformLabel = (identifier = '') =>
  PLATFORM_LABELS[identifier] ||
  identifier
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

type PickedChannel = { id: string; name: string; platform: string };

const parsePickerResult = (
  result: any
): { selected?: PickedChannel[]; cancelled?: boolean } | null => {
  if (!result) return null;
  if (typeof result === 'object') return result;
  try {
    const parsed = JSON.parse(String(result));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const ChannelPickerSummary: FC<{ result: any }> = ({ result }) => {
  const parsed = parsePickerResult(result);
  const selected: PickedChannel[] = Array.isArray(parsed?.selected) ? (parsed?.selected as PickedChannel[]) : [];
  const cancelled = parsed?.cancelled || (parsed && !selected.length);
  return (
    <div
      className={clsx(
        'my-1 inline-flex max-w-full items-center gap-2 rounded-xl border px-3 py-1.5 text-[12.5px]',
        cancelled
          ? 'border-gray-200 bg-gray-50 text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400'
          : 'border-emerald-300/70 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
      )}
    >
      {cancelled ? (
        <span>Đã hủy chọn kênh</span>
      ) : (
        <>
          <span className="font-bold">✓</span>
          <span className="truncate">
            Đã chọn:{' '}
            {selected.length
              ? selected
                  .map((item) => `${item.name}${item.platform ? ` (${item.platform})` : ''}`)
                  .join(', ')
              : 'kênh đăng'}
          </span>
        </>
      )}
    </div>
  );
};

const ChannelPicker: FC<{
  args: { reason?: string; multiple?: boolean; suggestedIds?: string[] };
  respond: (value: any) => void;
}> = ({ args, respond }) => {
  const { data, isLoading } = useIntegrationList();
  const { properties } = useContext(PropertiesContext);
  const multiple = !!args?.multiple;
  const channels = useMemo(
    () =>
      (Array.isArray(data) ? data : []).filter(
        (item: any) => !item?.disabled && !item?.refreshNeeded && !item?.inBetweenSteps
      ),
    [data]
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [cursor, setCursor] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const answered = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Pre-check the channels chosen in the sidebar ([--integrations--]), else the agent's suggestions.
  useEffect(() => {
    if (initialized || !channels.length) return;
    const usable = new Set(channels.map((item: any) => item.id));
    const sidebar = (Array.isArray(properties) ? properties : [])
      .map((item: any) => item?.id)
      .filter((id: string) => usable.has(id));
    const suggested = (Array.isArray(args?.suggestedIds) ? args.suggestedIds : []).filter((id) =>
      usable.has(id)
    );
    const initial = sidebar.length ? sidebar : suggested;
    setSelected(multiple ? initial : initial.slice(0, 1));
    const first = channels.findIndex((item: any) => initial.includes(item.id));
    setCursor(first >= 0 ? first : 0);
    setInitialized(true);
  }, [channels, properties, args?.suggestedIds, multiple, initialized]);

  useEffect(() => {
    if (channels.length) containerRef.current?.focus({ preventScroll: true });
  }, [channels.length]);

  const send = useCallback(
    (value: any) => {
      if (answered.current) return;
      answered.current = true;
      respond(value);
    },
    [respond]
  );

  const toggle = useCallback(
    (id: string) =>
      setSelected((current) =>
        multiple
          ? current.includes(id)
            ? current.filter((item) => item !== id)
            : [...current, id]
          : [id]
      ),
    [multiple]
  );

  const confirm = useCallback(() => {
    if (!selected.length) return;
    send({
      selected: channels
        .filter((item: any) => selected.includes(item.id))
        .map((item: any) => ({
          id: item.id,
          name: item.name,
          platform: platformLabel(item.identifier),
        })),
    });
  }, [channels, selected, send]);

  const cancel = useCallback(() => send({ cancelled: true }), [send]);

  // Cursor positions: 0..n-1 = channels, n = "Xác nhận", n+1 = "Hủy".
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const total = channels.length + 2;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setCursor((value) => (value + 1) % total);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setCursor((value) => (value - 1 + total) % total);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        cancel();
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (cursor < channels.length) toggle(channels[cursor].id);
        else if (cursor === channels.length) confirm();
        else cancel();
      }
    },
    [channels, cursor, toggle, confirm, cancel]
  );

  const title = args?.reason || (multiple ? 'Chọn các kênh để đăng bài' : 'Chọn kênh để đăng bài');

  if (isLoading && !channels.length) {
    return (
      <div className="my-1 text-[12px] text-gray-500 dark:text-gray-400">
        Đang tải danh sách kênh…
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="my-1 w-full max-w-lg rounded-2xl border border-emerald-300/80 bg-white p-3 shadow-[0_4px_20px_rgba(16,185,129,0.08)] outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 dark:border-emerald-500/30 dark:bg-[#141824] dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] sm:p-3.5"
    >
      <div className="mb-2.5 flex items-start gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/30">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
            />
          </svg>
        </div>
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold leading-snug text-gray-900 dark:text-gray-100">
            {title}
          </div>
          {!!channels.length && (
            <div className="text-[11px] text-gray-500 dark:text-gray-400">
              {multiple ? 'Chọn một hoặc nhiều kênh' : 'Chọn một kênh'} · ↑/↓ di chuyển · Enter chọn
            </div>
          )}
        </div>
      </div>

      {!channels.length ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-gray-300 px-3 py-3 text-[12.5px] text-gray-600 dark:border-white/15 dark:text-gray-300">
          <span>Chưa có kênh nào khả dụng — hãy thêm kênh.</span>
          <div className="flex gap-2">
            <a
              href="/launches"
              className="inline-flex items-center rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-1.5 text-[12px] font-semibold text-white no-underline shadow-md shadow-emerald-500/20 hover:from-emerald-500 hover:to-teal-500"
            >
              Thêm kênh
            </a>
            <button
              type="button"
              onClick={cancel}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-[12px] font-medium text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
            >
              Hủy
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            role={multiple ? 'group' : 'radiogroup'}
            className="flex max-h-[280px] flex-col gap-1.5 overflow-y-auto pe-0.5"
          >
            {channels.map((item: any, index: number) => {
              const checked = selected.includes(item.id);
              const active = cursor === index;
              return (
                <button
                  key={item.id}
                  type="button"
                  role={multiple ? 'checkbox' : 'radio'}
                  aria-checked={checked}
                  tabIndex={-1}
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => {
                    setCursor(index);
                    toggle(item.id);
                    containerRef.current?.focus({ preventScroll: true });
                  }}
                  className={clsx(
                    'flex w-full items-center gap-3 rounded-xl border px-2.5 py-2 text-start transition-colors',
                    checked
                      ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-500/50 dark:bg-emerald-500/10'
                      : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.02] dark:hover:bg-white/5',
                    active && 'ring-2 ring-emerald-400/50'
                  )}
                >
                  <span
                    className={clsx(
                      'flex h-[18px] w-[18px] shrink-0 items-center justify-center border-2 transition-colors',
                      multiple ? 'rounded-[5px]' : 'rounded-full',
                      checked
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'border-gray-300 dark:border-gray-600'
                    )}
                  >
                    {checked &&
                      (multiple ? (
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      ))}
                  </span>
                  <span className="relative shrink-0">
                    <ImageWithFallback
                      fallbackSrc={`/icons/platforms/${item.identifier}.png`}
                      src={item.picture}
                      className="h-9 w-9 rounded-[8px] object-cover"
                      alt={item.identifier}
                      width={36}
                      height={36}
                    />
                    <SafeImage
                      src={`/icons/platforms/${item.identifier}.png`}
                      className="absolute -bottom-1 -end-1 h-[16px] w-[16px] rounded-[5px] border border-white dark:border-[#141824]"
                      alt={item.identifier}
                      width={16}
                      height={16}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-gray-900 dark:text-gray-100">
                      {item.name}
                    </span>
                    <span className="block truncate text-[11px] text-gray-500 dark:text-gray-400">
                      {platformLabel(item.identifier)}
                      {item.display ? ` · ${item.display}` : ''}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              tabIndex={-1}
              onMouseEnter={() => setCursor(channels.length + 1)}
              onClick={cancel}
              className={clsx(
                'rounded-xl border border-gray-200 px-3.5 py-1.5 text-[12.5px] font-medium text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5',
                cursor === channels.length + 1 && 'ring-2 ring-emerald-400/50'
              )}
            >
              Hủy
            </button>
            <button
              type="button"
              tabIndex={-1}
              disabled={!selected.length}
              onMouseEnter={() => setCursor(channels.length)}
              onClick={confirm}
              className={clsx(
                'rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-1.5 text-[12.5px] font-semibold text-white shadow-md shadow-emerald-500/20 transition-all hover:from-emerald-500 hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none',
                cursor === channels.length && 'ring-2 ring-emerald-400/60 ring-offset-1 dark:ring-offset-[#141824]'
              )}
            >
              Xác nhận{selected.length > 1 ? ` (${selected.length})` : ''}
            </button>
          </div>
        </>
      )}
    </div>
  );
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
