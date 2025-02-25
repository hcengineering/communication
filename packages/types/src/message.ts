import type { Ref, Blob, PersonId, WorkspaceUuid } from '@hcengineering/core'
import type { Card } from '@hcengineering/card'

export type BlobID = Ref<Blob>
export type CardID = Ref<Card>
export type SocialID = PersonId
export type WorkspaceID = WorkspaceUuid
export type RichText = string

export type ID = string | bigint
export type MessageID = bigint & { message: true }

interface Object {
  creator: SocialID
  created: Date
}

export interface Message extends Object {
  id: MessageID
  card: CardID
  content: RichText
  edited?: Date
  reactions: Reaction[]
  attachments: Attachment[]
}

export interface MessagesGroup {
  card: CardID
  blobId: BlobID
  fromDate: Date
  toDate: Date
  count: number
}

export interface Patch extends Object {
  message: MessageID
  type: PatchType
  content: string
}

export enum PatchType {
  update = 'update',
  addReaction = 'addReaction',
  removeReaction = 'removeReaction',
  threadUpdate = 'threadUpdate'
}

export interface Reaction extends Object {
  message: MessageID
  reaction: string
}

export interface Attachment extends Object {
  message: MessageID
  card: CardID
}

export interface Thread {
  card: CardID
  message: MessageID
  thread: CardID
  repliesCount: number
  replied: SocialID[]
  lastReply: Date
}
