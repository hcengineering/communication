//
// Copyright © 2025 Hardcore Engineering Inc.
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
//

import type {
  CardID,
  MessageID,
  RichText,
  SocialID,
  BlobID,
  MessageType,
  CardType,
  LinkPreviewID
} from '@hcengineering/communication-types'

import type { BaseRequestEvent } from './common'

export enum MessageRequestEventType {
  CreateMessage = 'createMessage',
  UpdateMessage = 'updateMessage',
  RemoveMessage = 'removeMessage',

  AttachThread = 'attachThread',

  SetReaction = 'setReaction',
  RemoveReaction = 'removeReaction',

  AttachBlob = 'attachBlob',
  RemoveBlob = 'removeBlob',

  CreateLinkPreview = 'createLinkPreview',
  RemoveLinkPreview = 'removeLinkPreview'
}

type CreateOptions = { createLinkPreviews?: boolean; ignoreDuplicateIds?: boolean }
type UpdateOptions = { updateLinkPreviews?: boolean; markAsUpdated: boolean }
type RemoveOptions = {}

type Markdown = string

type Extra = Record<string, any>

/*
socialId: 
    general user:  must be null or match caller
    system account: must be set

date: 
    general user: must be null
    system account: if not set - use current time

cardType: may become optional in the future
*/

// Message Operations
export interface CreateMessageEvent extends BaseRequestEvent {
  eventType: MessageRequestEventType.CreateMessage

  messageId: MessageID
  messageType: MessageType

  socialId?: SocialID
  date?: Date

  cardId: CardID
  cardType: CardType

  content: Markdown
  extra?: Extra

  options?: CreateOptions
}

export interface UpdateMessageEvent extends BaseRequestEvent {
  eventType: MessageRequestEventType.UpdateMessage

  cardId: CardID
  messageId: MessageID

  socialId?: SocialID
  date?: Date

  content?: Markdown
  extra?: Extra

  options?: UpdateOptions
}

export interface RemoveMessageEvent extends BaseRequestEvent {
  eventType: MessageRequestEventType.RemoveMessage

  cardId: CardID
  messageId: MessageID

  socialId?: SocialID
  date?: Date

  options?: RemoveOptions
}

export interface AttachThread extends BaseRequestEvent {
  type: MessageRequestEventType.AttachThread

  cardId: CardID
  messageId: MessageID

  socialId?: SocialID
  date?: Date

  threadCardId: CardID
  threadcardType: CardType
}

// idempotent
// to be further defined
export interface SetReactionEvent extends BaseRequestEvent {
  type: MessageRequestEventType.SetReaction

  cardId: CardID
  messageId: MessageID

  socialId?: SocialID
  date?: Date

  reaction: string
}

// to be further defined
export interface RemoveReactionEvent extends BaseRequestEvent {
  type: MessageRequestEventType.RemoveReaction

  cardId: CardID
  messageId: MessageID

  socialId?: SocialID
  date?: Date

  reaction: string
}

export interface Attachment {
  blobId: BlobID
  contentType: string
  fileName: string
  length: number
  extra?: Extra
}

// idempotent, ignore duplicate blobs
export interface AttachBlobEvent extends BaseRequestEvent {
  type: MessageRequestEventType.AttachBlob

  cardId: CardID
  messageId: MessageID

  socialId?: SocialID
  date?: Date

  attachment: Attachment
}

export interface DetachBlobEvent extends BaseRequestEvent {
  type: MessageRequestEventType.RemoveBlob

  cardId: CardID
  messageId: MessageID

  socialId?: SocialID
  date?: Date

  blobId: BlobID
}

export interface LinkPreviewImage {
  url: string

  width?: number
  height?: number
}

interface LinkPreview {
  url: string
  host?: string // url part, may be removed in the future

  siteName?: string

  title?: string
  description?: string

  // favicon url (fixed size)
  favicon?: string

  previewImage?: LinkPreviewImage
}

export interface CreateLinkPreviewEvent extends BaseRequestEvent {
  previewId?: string
  type: MessageRequestEventType.CreateLinkPreview

  cardId: CardID
  messageId: MessageID

  socialId?: SocialID
  date?: Date

  preview: LinkPreview
}

export interface RemoveLinkPreviewEvent extends BaseRequestEvent {
  type: MessageRequestEventType.RemoveLinkPreview

  cardId: CardID
  messageId: MessageID

  personId?: SocialID
  date?: Date

  previewId: LinkPreviewID
}

export interface CreateMessageResult {
  messageId: MessageID
  created: Date
}

export interface CreateLinkResult {
  previewId: MessageID
  created: Date
}
