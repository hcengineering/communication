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
  MigrateToCard = 'migrateToCard',
  RemoveMessage = 'removeMessage',

  SetReaction = 'setReaction',
  RemoveReaction = 'removeReaction',

  AttachFile = 'attachFile',
  RemoveFile = 'removeFile',

  CreateLinkPreview = 'createLinkPreview',
  RemoveLinkPreview = 'removeLinkPreview'
}

type CreateFlags = { createLinkPreviews?: boolean; ignoreDuplicateIds?: boolean }
type UpdateFlags = { updateLinkPreviews?: boolean; markAsUpdated: boolean }
type RemoveFlags = {}

/*
personId: 
    general user:  must be null or match caller
    system account: must be set

date: 
    general user: must be null
    system account: if not set - use current time
*/

// Message Operations
export interface CreateMessageEvent extends BaseRequestEvent {
  eventType: MessageRequestEventType.CreateMessage

  messageId: MessageID
  messageType: MessageType

  personId?: SocialID
  date?: Date

  cardId: CardID
  cardType: CardType

  content: RichText
  extra?: any

  flags?: CreateFlags
}

export interface UpdateMessageEvent extends BaseRequestEvent {
  eventType: MessageRequestEventType.UpdateMessage

  cardId: CardID
  messageId: MessageID

  personId: SocialID
  date?: Date

  content?: RichText
  extra?: any

  flags?: UpdateFlags
}

export interface RemoveMessageEvent extends BaseRequestEvent {
  eventType: MessageRequestEventType.RemoveMessage

  cardId: CardID
  messageId: MessageID

  flags?: RemoveFlags
}

export interface MigrateToCardEvent extends BaseRequestEvent {
  type: MessageRequestEventType.MigrateToCard

  cardId: CardID
  messageId: MessageID

  threadCardId: CardID
  threadcardType: CardType
}

// to be further defined
export interface SetReactionEvent extends BaseRequestEvent {
  type: MessageRequestEventType.SetReaction

  cardId: CardID
  messageId: MessageID

  personId?: SocialID
  date?: Date

  reaction: string
}

// to be further defined
export interface RemoveReactionEvent extends BaseRequestEvent {
  type: MessageRequestEventType.RemoveReaction

  cardId: CardID
  messageId: MessageID

  personId: SocialID
  date?: Date

  reaction: string
}

export interface Attachment {
  blobId: BlobID
  contentType: string
  name: string
  length: number // what for?
  extra?: any
}

export interface AttachFileEvent extends BaseRequestEvent {
  type: MessageRequestEventType.AttachFile

  cardId: CardID
  messageId: MessageID

  personId?: SocialID
  date?: Date

  attachment: Attachment
}

export interface DetachFileEvent extends BaseRequestEvent {
  type: MessageRequestEventType.RemoveFile

  cardId: CardID
  messageId: MessageID

  personId?: SocialID
  date?: Date

  blobId: BlobID
}

export interface LinkPreviewImage {
  url: string
  extra?: any
}

interface LinkPreview {
  url: string
  host: string // ??
  title?: string
  description?: string
  icon?: string
  hostname?: string //?
  image?: LinkPreviewImage
}

export interface CreateLinkPreviewEvent extends BaseRequestEvent {
  type: MessageRequestEventType.CreateLinkPreview

  cardId: CardID
  messageId: MessageID

  personId?: SocialID
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

export type MessageEventResult = CreateMessageResult

export interface CreateMessageResult {
  id: MessageID
  created: Date
}
