import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  useCopilotChatInternal,
  useCopilotContext,
  useCopilotReadable,
} from '@copilotkit/react-core';
import AutoResizingTextarea from '@gitroom/frontend/components/agents/agent.textarea';
import { useMediaPaste } from '@gitroom/frontend/components/media/use.media.paste';
import { useChatContext, InputProps } from '@copilotkit/react-ui';
const MAX_NEWLINES = 6;

export const Input = ({
  inProgress,
  onSend,
  isVisible = false,
  onStop,
  onUpload,
  hideStopButton = false,
  onChange,
  prefill,
  onFiles,
  uploading = 0,
}: InputProps & {
  onChange: (value: string) => void;
  // Suggested text (e.g. an attached clip's post text); never replaces typed text
  prefill?: { text: string };
  // Image/video files pasted (Ctrl+V) or dropped on the input; text paste is untouched
  onFiles?: (files: File[]) => void;
  // Attachments still uploading: sending waits so the message carries them
  uploading?: number;
}) => {
  const context = useChatContext();
  const copilotContext = useCopilotContext();
  const showPoweredBy = !copilotContext.copilotApiConfig?.publicApiKey;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isComposing, setIsComposing] = useState(false);

  const handleDivClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;

    // If the user clicked a button or inside a button, don't focus the textarea
    if (target.closest('button')) return;

    // If the user clicked the textarea, do nothing (it's already focused)
    if (target.tagName === 'TEXTAREA') return;

    // Otherwise, focus the textarea
    textareaRef.current?.focus();
  };

  const [text, setText] = useState('');
  useEffect(() => {
    if (!prefill?.text || text.trim()) return;
    setText(prefill.text);
    onChange(prefill.text);
  }, [prefill]);

  const [dragging, setDragging] = useState(false);
  // Native capture-phase listeners: React's onPaste on this div did not receive pasted screenshots.
  const wrapperRef = useRef<HTMLDivElement>(null);
  useMediaPaste(wrapperRef, onFiles, setDragging);

  const send = () => {
    if (inProgress || uploading > 0) return;
    onSend(text);
    setText('');

    textareaRef.current?.focus();
  };

  const isInProgress = inProgress;
  const buttonIcon =
    isInProgress && !hideStopButton
      ? context.icons.stopIcon
      : context.icons.sendIcon;

  const { interrupt } = useCopilotChatInternal();
  const canSend = useMemo(() => {
    return !isInProgress && text.trim().length > 0 && !interrupt && uploading === 0;
  }, [interrupt, isInProgress, text, uploading]);

  const canStop = useMemo(() => {
    return isInProgress && !hideStopButton;
  }, [isInProgress, hideStopButton]);

  const sendDisabled = !canSend && !canStop;

  return (
    <div
      ref={wrapperRef}
      className={`copilotKitInputContainer ${
        showPoweredBy ? 'poweredByContainer' : ''
      }`}
    >
      {uploading > 0 && (
        <div role="status" className="px-[14px] pb-[6px] text-[12px] text-textColor/70">
          Đang tải lên {uploading} tệp đính kèm…
        </div>
      )}
      <div
        className={`copilotKitInput${dragging ? ' outline-dashed outline-2 outline-emerald-500/60' : ''}`}
        onClick={handleDivClick}
      >
        <AutoResizingTextarea
          ref={textareaRef}
          placeholder={context.labels.placeholder}
          autoFocus={false}
          maxRows={MAX_NEWLINES}
          value={text}
          onChange={(event) => {
            onChange(event.target.value);
            setText(event.target.value);
          }}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !isComposing) {
              event.preventDefault();
              if (canSend) {
                send();
              }
            }
          }}
        />
        <div className="copilotKitInputControls">
          {onUpload && (
            <button onClick={onUpload} className="copilotKitInputControlButton">
              {context.icons.uploadIcon}
            </button>
          )}

          <div style={{ flexGrow: 1 }} />
          <button
            disabled={sendDisabled}
            onClick={isInProgress && !hideStopButton ? onStop : send}
            data-copilotkit-in-progress={inProgress}
            data-test-id={
              inProgress
                ? 'copilot-chat-request-in-progress'
                : 'copilot-chat-ready'
            }
            className="copilotKitInputControlButton"
          >
            {buttonIcon}
          </button>
        </div>
      </div>
    </div>
  );
};
