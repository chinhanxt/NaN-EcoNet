import { Injectable } from '@nestjs/common';
import { Activity, ActivityMethod } from 'nestjs-temporal-core';
import { Context } from '@temporalio/activity';
import { AutopostService } from '@gitroom/nestjs-libraries/database/prisma/autopost/autopost.service';

@Injectable()
@Activity()
export class AutopostActivity {
  constructor(private _autoPostService: AutopostService) {}

  @ActivityMethod()
  async autoPost(id: string) {
    const context = Context.current();
    const { info } = context;
    // The SDK exposes the attempt's scheduled time, not its start time. Using
    // it conservatively also counts queue time, and leaves time to roll back.
    const deadline = Math.min(
      Date.now() + 9 * 60_000,
      info.currentAttemptScheduledTimestampMs +
        info.startToCloseTimeoutMs -
        15_000,
      info.scheduleToCloseTimeoutMs > 0
        ? info.scheduledTimestampMs + info.scheduleToCloseTimeoutMs - 15_000
        : Infinity
    );
    const timeout = new AbortController();
    const expire = () =>
      timeout.abort(new Error('Autopost activity deadline exceeded'));
    const timer = setTimeout(expire, Math.max(0, deadline - Date.now()));
    const signal = AbortSignal.any([
      context.cancellationSignal,
      timeout.signal,
    ]);
    try {
      if (Date.now() >= deadline) expire();
      signal.throwIfAborted();
      return await this._autoPostService.startAutopost(id, signal);
    } finally {
      clearTimeout(timer);
    }
  }
}
