import { z } from 'zod';

export interface Config {
  port: number;
  host: string;
  frontendOrigins: string[];
  supabaseUrl: string;
  supabasePublishableKey: string;
  supabaseSecretKey?: string;
  ollamaBaseUrl: string;
  gemmaModel: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const values = z.object({
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    HOST: z.string().default('127.0.0.1'),
    FRONTEND_ORIGIN: z.string().default('http://localhost:3000'),
    SUPABASE_URL: z.url(), SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
    SUPABASE_SECRET_KEY: z.string().min(1).optional(),
    OLLAMA_BASE_URL: z.url().default('http://127.0.0.1:11434'),
    GEMMA_MODEL: z.string().default('gemma4:e2b'),
  }).safeParse(env);
  if (!values.success) throw new Error('Missing or invalid backend configuration. Check backend/.env against .env.example.');
  const v = values.data;
  const origins = v.FRONTEND_ORIGIN.split(',').map(value => value.trim()).filter(Boolean);
  if (!origins.length || origins.some(origin => { try { return new URL(origin).origin !== origin; } catch { return true; } })) {
    throw new Error('FRONTEND_ORIGIN must contain comma-separated exact URL origins.');
  }
  return { port: v.PORT, host: v.HOST, frontendOrigins: origins, supabaseUrl: v.SUPABASE_URL,
    supabasePublishableKey: v.SUPABASE_PUBLISHABLE_KEY, supabaseSecretKey: v.SUPABASE_SECRET_KEY, ollamaBaseUrl: v.OLLAMA_BASE_URL, gemmaModel: v.GEMMA_MODEL };
}
