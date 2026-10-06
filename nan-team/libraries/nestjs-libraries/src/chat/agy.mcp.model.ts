import { Injectable } from '@nestjs/common';
import type {
  LanguageModelV2, LanguageModelV2CallOptions, LanguageModelV2Content,
  LanguageModelV2StreamPart, LanguageModelV2Usage,
} from '@ai-sdk/provider';
import { randomUUID } from 'node:crypto';
import { AgyMcpService } from '../videos/agy-mcp/agy.mcp.service';
import { runWithContext } from './async.storage';

type Tools = Record<string, {
  execute?: (input: any, context: any) => Promise<unknown>;
  inputSchema?: { parse?: (input: unknown) => unknown };
}>;
type RequestContext = { get: (key: string) => unknown };
const usage: LanguageModelV2Usage = { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined };
/** Video jobs outlive a chat turn: at most this many waiting status calls per turn, then report and end the turn. */
const VIDEO_STATUS_TOOLS = new Set(['aiVideoStatusTool', 'sourceVideoStatusTool']);
/** CopilotKit browser actions (frontend useCopilotAction): the user answers them in the chat after the turn. */
const BROWSER_ACTIONS = new Set(['manualPosting', 'selectChannels']);
const MAX_VIDEO_STATUS_WAITS = 2;
type ChatTool = {
  name: string; description: string; inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>, taskSignal?: AbortSignal) => Promise<unknown>;
};
const videoStatusStop = () => 'Status polling budget for this chat turn is used up. Do not call status tools again in this turn: '
  + 'reply now in ONE short Vietnamese sentence with the jobId in backticks; the chat shows a live progress card for it.';

/**
 * Thread titles without an AI job: the first user message, trimmed (Mastra's generateTitle otherwise runs a
 * whole extra AGY chat job, ~30 s and one account slot, after every new conversation).
 */
export const firstMessageTitleModel = (): LanguageModelV2 => {
  const title = (options: LanguageModelV2CallOptions) => {
    const user = [...options.prompt].reverse().find((message) => message.role === 'user');
    const raw = Array.isArray(user?.content)
      ? user!.content.map((part: any) => (part?.type === 'text' ? part.text : '')).join(' ')
      : String(user?.content ?? '');
    const text = raw.replace(/\[--(Media|integrations)--\][\s\S]*?\[--\1--\]/g, ' ').replace(/\s+/g, ' ').trim();
    return text.length > 60 ? `${text.slice(0, 57).trimEnd()}…` : text || 'Cuộc trò chuyện mới';
  };
  return {
    specificationVersion: 'v2', provider: 'local', modelId: 'first-message-title', supportedUrls: {},
    doGenerate: async (options) => ({ content: [{ type: 'text', text: title(options) }], finishReason: 'stop', usage, warnings: [] }),
    doStream: async (options) => ({ stream: new ReadableStream<LanguageModelV2StreamPart>({
      start(controller) {
        const id = randomUUID();
        controller.enqueue({ type: 'stream-start', warnings: [] });
        controller.enqueue({ type: 'text-start', id });
        controller.enqueue({ type: 'text-delta', id, delta: title(options) });
        controller.enqueue({ type: 'text-end', id });
        controller.enqueue({ type: 'finish', usage, finishReason: 'stop' });
        controller.close();
      },
    }) }),
  };
};

/** Native AGY executes authenticated MCP tools; Mastra receives their actual results once. */
@Injectable()
export class AgyMcpModelFactory {
  constructor(private readonly agy: AgyMcpService) {}

  create(tools: Tools, requestContext?: RequestContext): LanguageModelV2 {
    const generate = async (options: LanguageModelV2CallOptions,
      emit?: (part: LanguageModelV2StreamPart) => void) => {
      const content: LanguageModelV2Content[] = [];
      let hasDeferredTool = false;
      // Streaming: AGY text deltas open a text block per model response step; a tool part closes the open
      // block. Text streamed after the last tool part is the final answer, so it is not sent again.
      let textId: string | undefined, textBlock: string | undefined, answerStreamed = false;
      const closeText = () => { if (textId) emit?.({ type: 'text-end', id: textId }); textId = undefined; };
      const onText = emit ? (delta: string, block: string) => {
        if (textId && block !== textBlock) closeText();
        if (!textId) { textId = randomUUID(); textBlock = block; emit?.({ type: 'text-start', id: textId }); }
        emit?.({ type: 'text-delta', id: textId, delta });
        answerStreamed = true;
      } : undefined;
      const emitTool = (part: LanguageModelV2Content) => { closeText(); answerStreamed = false; emit?.(part as LanguageModelV2StreamPart); };
      let count = 0;
      let videoStatusCalls = 0;
      const configuredLimit = Number(process.env.AGY_MCP_CHAT_TOOL_LIMIT || 30);
      const limit = Number.isInteger(configuredLimit) && configuredLimit > 0 && configuredLimit <= 100
        ? configuredLimit : 30;
      let organization: { id: string } | undefined;
      const raw = requestContext?.get('organization');
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          if (typeof parsed?.id === 'string' && parsed.id) organization = parsed;
        } catch { /* A tool call will reject missing authenticated context. */ }
      }
      // Sample images on the latest user message reach tools (generateImageTool uses them as references).
      const referenceImages = AgyMcpService.latestUserImages(
        options.prompt.map((message) => ({ role: message.role, content: message.content })));
      const offered = (options.tools || []).filter((tool) => tool.type === 'function');
      const mcpTools: ChatTool[] = offered.map((tool) => ({
        name: tool.name,
        description: tool.description || tool.name,
        inputSchema: tool.inputSchema as Record<string, unknown>,
        execute: async (input: Record<string, unknown>, taskSignal?: AbortSignal) => {
          const abortSignal = taskSignal && options.abortSignal
            ? AbortSignal.any([taskSignal, options.abortSignal]) : taskSignal || options.abortSignal;
          abortSignal?.throwIfAborted();
          if (++count > limit) throw new Error('The agent reached the tool limit for this turn; do not call more tools, report the latest actual results to the user');
          const id = randomUUID();
          const backend = tools[tool.name];
          if (!backend?.execute) {
            // Browser actions go to CopilotKit; SDK injected tools go to Mastra.
            const call: LanguageModelV2Content = { type: 'tool-call', toolCallId: id,
              toolName: tool.name, input: JSON.stringify(input), providerExecuted: false };
            content.push(call); emitTool(call); hasDeferredTool = true;
            return { deferred: true, message: BROWSER_ACTIONS.has(tool.name) ? 'The browser will execute this action after the turn and its result arrives in the next turn. Do not claim it has completed and do not call other tools now.' : 'Mastra will execute this internal tool after the turn. Do not claim it has completed.' };
          }
          if (hasDeferredTool) throw new Error('Wait for the deferred tool result before executing another backend tool');
          if (!organization) throw new Error('An authenticated organization is required for MCP tools');
          const statusCall = VIDEO_STATUS_TOOLS.has(tool.name) ? ++videoStatusCalls : 0;
          if (statusCall > MAX_VIDEO_STATUS_WAITS + 1) throw new Error(videoStatusStop());
          // Past the budget: one immediate snapshot (no server-side wait) so the reply carries the real stage.
          if (statusCall > MAX_VIDEO_STATUS_WAITS) input = { ...input, waitSeconds: undefined };
          let validated: unknown;
          try {
            validated = backend.inputSchema?.parse ? backend.inputSchema.parse(input) : input;
          } catch (error) {
            // Invalid arguments go back to the model as a failed result (nothing executed), never as a silent drop.
            const issues = (error as { issues?: { path: (string | number)[]; message: string }[] })?.issues;
            const detail = issues?.length
              ? issues.slice(0, 10).map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`).join('; ')
              : error instanceof Error ? error.message : 'invalid input';
            const call: LanguageModelV2Content = { type: 'tool-call', toolCallId: id,
              toolName: tool.name, input: JSON.stringify(input), providerExecuted: true };
            const result = { error: `Invalid ${tool.name} input, the tool did NOT run: ${detail}` };
            const answer: LanguageModelV2Content = { type: 'tool-result', toolCallId: id,
              toolName: tool.name, result, providerExecuted: true, isError: true };
            content.push(call, answer); emitTool(call); emitTool(answer);
            return result;
          }
          const call: LanguageModelV2Content = { type: 'tool-call', toolCallId: id,
            toolName: tool.name, input: JSON.stringify(validated), providerExecuted: true };
          content.push(call); emitTool(call);
          let result: unknown;
          let isError = false;
          try {
            result = await runWithContext({ requestId: id, auth: organization, referenceImages }, () =>
              backend.execute!(validated, { requestContext, abortSignal }));
          } catch (error) {
            isError = true;
            result = { error: error instanceof Error ? error.message : 'The tool failed' };
          }
          // Serialization catches accidental return of streams, cycles or undefined values.
          result = JSON.parse(JSON.stringify(result ?? null));
          if (statusCall > MAX_VIDEO_STATUS_WAITS && result && typeof result === 'object' && !Array.isArray(result))
            result = { ...(result as Record<string, unknown>), instruction: videoStatusStop() };
          const answer: LanguageModelV2Content = { type: 'tool-result', toolCallId: id,
            toolName: tool.name, result, providerExecuted: true, ...(isError ? { isError } : {}) };
          content.push(answer); emitTool(answer);
          return result;
        },
      }));
      let text: string;
      try {
        text = await this.agy.chat({
          messages: options.prompt.map((message) => ({ role: message.role, content: message.content })),
          tools: mcpTools, signal: options.abortSignal, onText,
        });
      } finally { closeText(); }
      // Nothing streamed after the last tool (the model only submitted its answer): send the final text once.
      if (emit && !answerStreamed && text) {
        const id = randomUUID();
        emit({ type: 'text-start', id });
        emit({ type: 'text-delta', id, delta: text });
        emit({ type: 'text-end', id });
      }
      const answer: LanguageModelV2Content = { type: 'text', text };
      content.push(answer);
      return { content, finishReason: hasDeferredTool ? 'tool-calls' as const : 'stop' as const,
        usage, warnings: [] as [] };
    };
    return {
      specificationVersion: 'v2', provider: 'agy-mcp',
      modelId: process.env.AGY_MCP_MODEL || 'configured-agy-model', supportedUrls: {},
      doGenerate: (options) => generate(options),
      doStream: async (options) => {
        const cancelled = new AbortController();
        const abortSignal = options.abortSignal
          ? AbortSignal.any([options.abortSignal, cancelled.signal]) : cancelled.signal;
        let closed = false;
        return { stream: new ReadableStream<LanguageModelV2StreamPart>({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            void generate({ ...options, abortSignal }, (part) => {
              if (!closed) controller.enqueue(part);
            }).then((result) => {
              if (closed) return;
              // Text parts were already emitted live by generate().
              controller.enqueue({ type: 'finish', usage: result.usage, finishReason: result.finishReason });
              closed = true; controller.close();
            }).catch((error) => {
              if (closed) return;
              controller.enqueue({ type: 'error', error }); closed = true; controller.close();
            });
          },
          cancel() { closed = true; cancelled.abort(new Error('Agent stream cancelled')); },
        }) };
      },
    };
  }
}
