import { LucideIcon } from 'lucide-react';

export type AgentId =
  | "triage"
  | "knowledge"
  | "billing"
  | "voice"
  | "policy"
  | "composer"
  | "human";

export type AgentState =
  | "idle"
  | "thinking"
  | "processing"
  | "waiting"
  | "escalated"
  | "resolved";

export type Tone = "violet" | "blue" | "amber" | "rose" | "sage" | "slate";

export interface AgentDef {
  id: AgentId;
  label: string;
  role: string;
  icon: LucideIcon;
  tone: Tone;
  x: number;
  y: number;
  memory: string[];
}

export interface Edge {
  from: AgentId;
  to: AgentId;
}

export interface LogEvent {
  ts: string;
  who: AgentId;
  message: string;
  tone: "info" | "ok" | "warn" | "err";
}
