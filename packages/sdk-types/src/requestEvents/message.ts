import type {
  CardID,
  MessageID,
  Markdown,
  SocialID,
  BlobID,
  MessageType,
  CardType,
  LinkPreviewID,
  MessagesGroup,
  MessageExtra,
  BlobData,
  LinkPreviewData
} from '@hcengineering/communication-types'

import type { BaseRequestEvent } from './common'

export enum MessageEventType {
  // Public events
  CreateMessage = 'createMessage',
  CreateUpdatePatch = 'createUpdatePatch',
  CreateRemovePatch = 'createRemovePatch',
  CreateReactionPatch = 'createReactionPatch',
  CreateBlobPatch = 'createBlobPatch',
  CreateThreadPatch = 'createThreadPatch',
  CreateLinkPreviewPatch = 'createLinkPreviewPatch',

  // Internal events
  UpdateThread = 'updateThread',

  CreateMessagesGroup = 'createMessagesGroup',
  RemoveMessagesGroup = 'removeMessagesGroup'
}

export type MessageEvent =
  | CreateMessageEvent
  | UpdateMessagePatchEvent
  | RemoveMessagePatchEvent
  | AddReactionPatchEvent
  | RemoveReactionPatchEvent
  | AttachBlobPatchEvent
  | DetachBlobPatchEvent
  | AttachLinkPreviewPatchEvent
  | DetachLinkPreviewPatchEvent
  | AttachThreadPatchEvent
  | UpdateThreadPatchEvent
  | CreateMessagesGroupEvent
  | RemoveMessagesGroupEvent

export interface CreateMessageOptions {
  // Available for regular users (Not implemented yet)
  skipLinkPreviews?: boolean
  // Available only for system
  noNotify?: boolean
}
export interface UpdatePatchOptions {
  // Available for regular users (Not implemented yet)
  skipLinkPreviewsUpdate?: boolean
  // Available only for system (Not implemented yet)
  markAsUpdated?: boolean
}

export interface CreateMessageEvent extends BaseRequestEvent {
  type: MessageEventType.CreateMessage

  cardId: CardID
  cardType: CardType

  messageId?: MessageID
  messageType: MessageType

  content: Markdown
  extra?: MessageExtra

  socialId: SocialID
  date: Date

  options?: CreateMessageOptions
}

// Available for author and system
export interface UpdateMessagePatchEvent extends BaseRequestEvent {
  type: MessageEventType.CreateUpdatePatch

  cardId: CardID
  messageId: MessageID

  content?: Markdown
  extra?: MessageExtra

  socialId: SocialID
  date: Date

  options?: UpdatePatchOptions
}

// Available for author and system
export interface RemoveMessagePatchEvent extends BaseRequestEvent {
  type: MessageEventType.CreateRemovePatch

  cardId: CardID
  messageId: MessageID

  socialId: SocialID
  date: Date
}

// For  any user
export interface AddReactionPatchEvent extends BaseRequestEvent {
  type: MessageEventType.CreateReactionPatch

  cardId: CardID
  messageId: MessageID

  reaction: string

  operation: 'add'

  socialId: SocialID
  date: Date
}

// for system and reaction author
export interface RemoveReactionPatchEvent extends BaseRequestEvent {
  type: MessageEventType.CreateReactionPatch

  cardId: CardID
  messageId: MessageID

  reaction: string

  operation: 'remove'

  socialId: SocialID
  date: Date
}

// For system and message author
export interface AttachBlobPatchEvent extends BaseRequestEvent {
  type: MessageEventType.CreateBlobPatch

  cardId: CardID
  messageId: MessageID

  data: BlobData
  operation: 'attach'

  socialId: SocialID
  date: Date
}

// For system and message author
export interface DetachBlobPatchEvent extends BaseRequestEvent {
  type: MessageEventType.CreateBlobPatch

  cardId: CardID
  messageId: MessageID

  blobId: BlobID
  operation: 'detach'

  socialId: SocialID
  date: Date
}

// For any user
interface AttachThreadPatchEvent extends BaseRequestEvent {
  type: MessageEventType.CreateThreadPatch

  cardId: CardID
  messageId: MessageID

  threadId: CardID
  threadType: CardType

  socialId: SocialID
  date: Date
}

// For system and message author
export interface AttachLinkPreviewPatchEvent extends BaseRequestEvent {
  type: MessageEventType.CreateLinkPreviewPatch
  cardId: CardID
  messageId: MessageID

  linkPreviewId?: LinkPreviewID
  linkPreviewData: LinkPreviewData
  operation: 'attach'

  socialId: SocialID
  date: Date
}

// For system and message author
export interface DetachLinkPreviewPatchEvent extends BaseRequestEvent {
  type: MessageEventType.CreateLinkPreviewPatch

  cardId: CardID
  messageId: MessageID

  linkPreviewId: LinkPreviewID
  operation: 'detach'

  socialId: SocialID
  date: Date
}

export interface CreateMessageResult {
  messageId: MessageID
  created: Date
}

export interface CreateLinkPreviewResult {
  previewId: MessageID
  created: Date
}

export type MessageEventResult = CreateMessageResult | CreateLinkPreviewResult

// Internal

// Only for system
export interface UpdateThreadPatchEvent extends BaseRequestEvent {
  type: MessageEventType.CreateThreadPatch
  cardId: CardID
  messageId: MessageID

  operation: 'update'
  threadId: CardID
  updates: {
    repliesCountOp: 'increment' | 'decrement'
    lastReply?: Date
  }

  socialId: SocialID
  date: Date
}

export interface CreateMessagesGroupEvent extends BaseRequestEvent {
  type: MessageEventType.CreateMessagesGroup
  group: MessagesGroup
  socialId: SocialID
  date?: Date
}

export interface RemoveMessagesGroupEvent extends BaseRequestEvent {
  type: MessageEventType.RemoveMessagesGroup
  cardId: CardID
  blobId: BlobID
  socialId: SocialID
  date?: Date
}
