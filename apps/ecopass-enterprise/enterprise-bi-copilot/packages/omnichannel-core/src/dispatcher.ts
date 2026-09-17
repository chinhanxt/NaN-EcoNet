import { EventEmitter } from 'node:events';
import { Conversation, UnifiedMessage } from './types.js';

export interface OmnichannelEventMap {
  'message:created': { message: UnifiedMessage; conversation: Conversation };
  'conversation:created': { conversation: Conversation };
  'conversation:status_changed': { conversation: Conversation; previousStatus: string; newStatus: string };
  'bot:handoff': { conversation: Conversation; reason: string };
  'human:takeover': { conversation: Conversation; agentId: string; agentName: string };
}

export class OmnichannelDispatcher {
  private emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50);
  }

  public on<K extends keyof OmnichannelEventMap>(
    event: K,
    listener: (data: OmnichannelEventMap[K]) => void | Promise<void>
  ): this {
    this.emitter.on(event, listener);
    return this;
  }

  public emit<K extends keyof OmnichannelEventMap>(
    event: K,
    data: OmnichannelEventMap[K]
  ): boolean {
    return this.emitter.emit(event, data);
  }

  public off<K extends keyof OmnichannelEventMap>(
    event: K,
    listener: (data: OmnichannelEventMap[K]) => void | Promise<void>
  ): this {
    this.emitter.off(event, listener);
    return this;
  }
}
