// =============================================================================
// ENTERPRISE BI DIAGRAM & AGY ENGINE TYPES
// =============================================================================

export interface DiagramTemplate {
  id: string;
  anchor?: string;
  cover?: string;
  title: {
    en: string;
    vi?: string;
    zh?: string;
  };
  description?: {
    en?: string;
    vi?: string;
    zh?: string;
  };
  category: string;
  aspect_ratio?: string;
  styles?: string[];
  scenes?: string[];
  tags?: string[];
  useWhen?: {
    en?: string;
    vi?: string;
    zh?: string;
  };
  guidance?: {
    en?: string[];
    vi?: string[];
    zh?: string[];
  } | string[];
  pitfalls?: {
    en?: string[];
    vi?: string[];
    zh?: string[];
  } | string[];
  exampleCases?: number[];
}

export interface DiagramCategory {
  id: string;
  value: string;
  anchor?: string;
  cover?: string;
  title: {
    en: string;
    zh?: string;
    vi?: string;
  };
  description?: {
    en: string;
    zh?: string;
    vi?: string;
  };
}

export interface DiagramRequest {
  prompt: string;
  template_id?: string;
  aspect_ratio?: '16:9' | '3:4' | '1:1' | '4:3' | '9:16' | 'auto' | string;
  image_name?: string;
  storage_dir?: string;
}

export interface DiagramIntentResult {
  success: boolean;
  detection?: {
    category: string;
    template_id: string;
    template_title: string;
    aspect_ratio: string;
    art_direction_reasoning: string;
    master_prompt: string;
    guidance?: string[];
    pitfalls?: string[];
    reference_cases?: string[];
  };
  error?: string;
}

export interface DiagramResult {
  success: boolean;
  filename?: string;
  filePath?: string;
  relativeUrl?: string;
  aspectRatio?: string;
  durationSec?: number;
  category?: string;
  templateId?: string;
  templateTitle?: string;
  artDirectorReasoning?: string;
  originalPrompt?: string;
  masterPrompt?: string;
  guidance?: string[];
  referenceCases?: string[];
  error?: string;
}

export interface DiagramHealthStatus {
  status: 'OK' | 'ERROR';
  proxy: {
    running: boolean;
    pid?: number;
    port: number;
    accounts_ready: number;
  };
  accounts_count: number;
  active_account?: string;
  templates_count: number;
  categories_count?: number;
  storage_dir: string;
}
