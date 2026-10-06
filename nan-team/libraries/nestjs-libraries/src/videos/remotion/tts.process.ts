import { spawn } from 'node:child_process';

/** No shell; bounded output, deadline, cancellation, and reaping before cleanup. */
export function runTtsProcess(command: string, args: string[], options: {
  stdin?: string; timeoutMs?: number; signal?: AbortSignal; stderr?: boolean;
} = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) return reject(new Error('Speech generation cancelled'));
    const child = spawn(command, args, { shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let failure: Error | undefined;
    const stop = (error: Error) => {
      failure ??= error;
      child.kill('SIGKILL');
    };
    const cancel = () => stop(new Error('Speech generation cancelled'));
    const timer = setTimeout(() => stop(new Error(`Speech tool ${command} timed out`)),
      options.timeoutMs ?? 90000);
    options.signal?.addEventListener('abort', cancel, { once: true });
    const cleanup = () => {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', cancel);
    };
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
      if (stdout.length > 2 * 1024 * 1024) stop(new Error('Speech tool output exceeded limit'));
    });
    child.stderr.on('data', (chunk: string) => {
      stderr = (stderr + chunk).slice(-4000);
    });
    child.on('error', (error) => { cleanup(); reject(error); });
    child.on('close', (code) => {
      cleanup();
      if (failure) reject(failure);
      else if (code !== 0) reject(new Error(`Speech tool ${command} failed (${code}): ${stderr}`));
      else resolve(options.stderr ? stderr : stdout);
    });
    child.stdin.on('error', () => { /* Early process exit is reported by close. */ });
    child.stdin.end(options.stdin ?? '');
  });
}
