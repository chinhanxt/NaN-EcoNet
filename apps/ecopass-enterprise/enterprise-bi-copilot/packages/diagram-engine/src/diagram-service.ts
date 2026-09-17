// =============================================================================
// ENTERPRISE BI DIAGRAM & AGY LLM ENGINE SERVICE
// =============================================================================

import { execFile } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type {
  DiagramRequest,
  DiagramResult,
  DiagramTemplate,
  DiagramCategory,
  DiagramIntentResult,
  DiagramHealthStatus
} from './types.js';

export class EnterpriseDiagramEngine {
  private static runnerScriptPath: string = (() => {
    // Resolve absolute path to python runner
    try {
      const currentDir = typeof __dirname !== 'undefined'
        ? __dirname
        : path.dirname(fileURLToPath(import.meta.url));
      
      const candidate1 = path.resolve(currentDir, '../python/runner.py');
      if (fs.existsSync(candidate1)) return candidate1;

      const candidate2 = path.resolve(currentDir, '../../python/runner.py');
      if (fs.existsSync(candidate2)) return candidate2;
    } catch {
      // Fallback
    }

    return '/home/chinhan/enterprise-bi-copilot/packages/diagram-engine/python/runner.py';
  })();

  private static runPython(command: string, payload: any, timeoutMs: number = 180000): Promise<any> {
    return new Promise((resolve, reject) => {
      const runner = this.runnerScriptPath;
      if (!fs.existsSync(runner)) {
        return reject(new Error(`Runner script not found at ${runner}`));
      }

      const inputJson = JSON.stringify(payload);
      execFile('python3', [runner, command, inputJson], { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) {
          return reject(new Error(`Python runner error [${command}]: ${err.message}. Stderr: ${stderr}`));
        }

        try {
          const parsed = JSON.parse(stdout.trim());
          resolve(parsed);
        } catch (e: any) {
          reject(new Error(`Failed to parse Python JSON output: ${e.message}. Output was: ${stdout}`));
        }
      });
    });
  }

  /**
   * Health check for Agy proxy and accounts
   */
  public static async health(): Promise<DiagramHealthStatus> {
    try {
      return await this.runPython('health', {}, 10000);
    } catch (e: any) {
      return {
        status: 'ERROR',
        proxy: { running: false, port: 8899, accounts_ready: 0 },
        accounts_count: 0,
        templates_count: 0,
        storage_dir: ''
      };
    }
  }

  /**
   * Get all diagram templates (Enterprise blueprints + awesome-gpt-image-2 catalog)
   */
  public static async listTemplates(): Promise<DiagramTemplate[]> {
    try {
      const res = await this.runPython('list_templates', {}, 10000);
      return res.templates || [];
    } catch (err: any) {
      console.warn('[EnterpriseDiagramEngine] listTemplates error:', err.message);
      return [];
    }
  }

  /**
   * Get all categories from awesome-gpt-image-2
   */
  public static async listCategories(): Promise<DiagramCategory[]> {
    try {
      const res = await this.runPython('list_categories', {}, 10000);
      return res.categories || [];
    } catch (err: any) {
      console.warn('[EnterpriseDiagramEngine] listCategories error:', err.message);
      return [];
    }
  }

  /**
   * Stage 1 AI Detection: Detect user visual intent via agy CLI using awesome-gpt-image-2 taxonomy
   */
  public static async detectIntent(prompt: string, template_id?: string, aspect_ratio?: string): Promise<DiagramIntentResult> {
    try {
      const res = await this.runPython('detect_intent', { prompt, template_id, aspect_ratio }, 60000);
      return res as DiagramIntentResult;
    } catch (err: any) {
      console.error('[EnterpriseDiagramEngine] detectIntent failed:', err.message);
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Full 2-Stage Pipeline: Detect intent & generate diagram/image via agy CLI with session purge
   */
  public static async generateDiagram(request: DiagramRequest): Promise<DiagramResult> {
    try {
      const res = await this.runPython('generate_diagram', request, 180000);
      return res as DiagramResult;
    } catch (err: any) {
      console.error('[EnterpriseDiagramEngine] generateDiagram failed:', err.message);
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Real Neural C-Suite Financial Commentary (Antigravity Gemini via proxy 8899)
   */
  public static async generateExecutiveCommentary(prompt: string, context: string): Promise<string | null> {
    try {
      const res = await this.runPython('generate_commentary', { prompt, context }, 40000);
      if (res.success && res.commentary && res.commentary.length > 10) {
        return res.commentary.trim();
      }
    } catch (err: any) {
      console.warn('[EnterpriseDiagramEngine] generateExecutiveCommentary error:', err.message);
    }
    return null;
  }

  /**
   * Real Neural Conversational Chat (Antigravity Gemini via proxy 8899)
   */
  public static async generateConversationalResponse(prompt: string): Promise<string | null> {
    try {
      const res = await this.runPython('generate_chat', { prompt }, 45000);
      if (res.success && res.reply && res.reply.length > 10) {
        return res.reply.trim();
      }
    } catch (err: any) {
      console.warn('[EnterpriseDiagramEngine] generateConversationalResponse error:', err.message);
    }
    return null;
  }

  /**
   * Real Neural Intent Classification (Antigravity Gemini via agy CLI)
   */
  public static async classifyIntent(prompt: string): Promise<any | null> {
    try {
      const res = await this.runPython('classify_intent', { prompt }, 45000);
      if (res.success && res.decision) {
        return res.decision;
      }
    } catch (err: any) {
      console.warn('[EnterpriseDiagramEngine] classifyIntent error:', err.message);
    }
    return null;
  }

  /**
   * Tự động quét và xóa sạch các session rác / tạm thời từ CLI trong background
   */
  public static async autoPurgeSessions(): Promise<any> {
    try {
      const res = await this.runPython('auto_purge', {}, 15000);
      return res;
    } catch {
      return null;
    }
  }
}
