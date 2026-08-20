import type { ReactNode } from 'react'

export type AgentActivityStatus = 'working' | 'complete'
export type AgentStepStatus = 'pending' | 'active' | 'complete'

export interface AgentActivityStep {
  id: string
  type: 'step'
  label: ReactNode
  status?: AgentStepStatus
  meta?: ReactNode
}

export interface AgentActivityText {
  id: string
  type: 'text'
  content: ReactNode
}

export interface AgentSearchResult {
  id: string
  title: ReactNode
  domain?: ReactNode
  url?: string
  icon?: ReactNode
}

export interface AgentActivitySearch {
  id: string
  type: 'search'
  query: ReactNode
  results?: AgentSearchResult[]
  moreCount?: number
}

export interface AgentActivityTool {
  id: string
  type: 'tool'
  /** `read` consulta, `run` ejecuta, `edit` escribe. */
  action: 'read' | 'edit' | 'run' | (string & {})
  target: ReactNode
  /** Cuántas filas devolvió la consulta, cuando la herramienta lo reporta. */
  count?: number
  status?: AgentStepStatus
}

export type AgentTraceKind = 'thinking' | 'message' | 'write' | 'run' | 'read' | (string & {})

export interface AgentActivityTrace {
  id: string
  type: 'trace'
  kind: AgentTraceKind
  label: ReactNode
  detail?: ReactNode
  icon?: ReactNode
}

export type AgentActivityItem =
  | AgentActivityStep
  | AgentActivityText
  | AgentActivitySearch
  | AgentActivityTool
  | AgentActivityTrace

export type AgentActivityContentType = AgentActivityItem['type'] | 'mixed'
