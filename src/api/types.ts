// Wire types mirroring remai-central-specs/docs/api/openapi.yaml (normative).

export type BlockType =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'todo'
  | 'bulleted'
  | 'numbered'
  | 'quote'
  | 'code'
  | 'divider'

export interface Block {
  id: string
  type: BlockType
  text: string
  checked: boolean
}

export interface User {
  id: string
  email: string
  name: string
  createdAt: string
}

export interface AuthResponse {
  token: string
  user: User
}

export interface Page {
  id: string
  parentId: string | null
  title: string
  icon: string
  createdAt: string
  updatedAt: string
}

export interface PageWithBlocks extends Page {
  blocks: Block[]
}

export interface SaveBlocksResponse {
  blocks: Block[]
  updatedAt: string
}

export interface TrashedPage {
  id: string
  title: string
  icon: string
  trashedAt: string
}

export interface SearchResult {
  id: string
  parentId: string | null
  title: string
  icon: string
  snippet: string
}

export interface CreatePageInput {
  title?: string
  icon?: string
  parentId?: string | null
}

/** Omitted fields stay unchanged; `parentId: null` moves the page to the top level. */
export interface UpdatePageInput {
  title?: string
  icon?: string
  parentId?: string | null
}

export type ErrorCode =
  | 'validation_error'
  | 'email_taken'
  | 'invalid_credentials'
  | 'unauthorized'
  | 'not_found'
  | 'invalid_parent'
  | 'payload_too_large'
  | 'internal_error'
  // Client-side only: the request never got an HTTP response.
  | 'network_error'

/** Limits from the contract, enforced in the UI as well. */
export const LIMITS = {
  titleMax: 200,
  iconMax: 16,
  blockTextMax: 10000,
  blocksMax: 1000,
  searchMax: 100,
  nameMax: 80,
  passwordMin: 8,
  passwordMax: 72,
} as const
