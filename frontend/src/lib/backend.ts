"use client";
import { createClient } from "@supabase/supabase-js";

// Talks to the MultiGrizz backend (contracts/backend-api.md). Supabase Auth only issues the
// session; every data call goes through the backend with that bearer token.
const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export const backendConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);
export const supabase = backendConfigured ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

export type ApiTeam = { id: string; name: string; invite_code: string };
export type ApiSquad = { id: string; name: string; goal: string };
export type ApiAgent = { id: string; name: string; role: string; instructions: string };
export type ApiRun = { id: string; squad_id: string; status: "queued" | "running" | "completed" | "failed"; goal: string; error: string | null; created_at: string; updated_at: string };
export type ApiEntry = { id: string; squad_id: string; kind: "note" | "result" | "handoff"; content: string; source_squad_id: string | null; run_id: string | null; created_at: string };

export async function api<T>(path: string, method = "GET", body?: object): Promise<T> {
  const session = (await supabase?.auth.getSession())?.data.session;
  if (!session) throw new Error("Sign in first.");
  const response = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error?.message ?? `Request failed (${response.status}).`);
  return json.data as T;
}
