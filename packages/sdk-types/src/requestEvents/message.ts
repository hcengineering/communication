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
  MessagesGroup,
  BlobID,
  PatchType,
  MessageType,
  MessageData,
  CardType,
  PatchData,
  LinkPreviewID,
  FileData,
  LinkPreviewData
} from '@hcengineering/communication-types'

import type { BaseRequestEvent } from './common'

export enum MessageRequestEventType {
  CreateMessage = 'createMessage',
  CreatePatch = 'createPatch',

  CreateReaction = 'createReaction',
  RemoveReaction = 'removeReaction',

  CreateFile = 'createFile',
  RemoveFile = 'removeFile',

  CreateLinkPreview = 'createLinkPreview',
  RemoveLinkPreview = 'removeLinkPreview',

  CreateThread = 'createThread',
  UpdateThread = 'updateThread',

  CreateMessagesGroup = 'createMessagesGroup',
  RemoveMessagesGroup = 'removeMessagesGroup'
}

export type MessageRequestEvent =
  | CreateFileEvent
  | CreateMessageEvent
  | CreateMessagesGroupEvent
  | CreatePatchEvent
  | CreateReactionEvent
  | CreateThreadEvent
  | RemoveFileEvent
  | RemoveMessagesGroupEvent
  | RemoveReactionEvent
  | UpdateThreadEvent
  | CreateLinkPreviewEvent
  | RemoveLinkPreviewEvent

export interface CreateMessageEvent extends BaseRequestEvent {
  type: MessageRequestEventType.CreateMessage
  messageType: MessageType
  card: CardID
  cardType: CardType
  content: RichText
  creator: SocialID
  data?: MessageData
  externalId?: string
  created?: Date
  id?: MessageID
}

export interface CreatePatchEvent extends BaseRequestEvent {
  type: MessageRequestEventType.CreatePatch
  patchType: PatchType
  card: CardID
  message: MessageID
  messageCreated: Date
  data: PatchData
  creator: SocialID
  created?: Date
}

export interface CreateReactionEvent extends BaseRequestEvent {
  type: MessageRequestEventType.CreateReaction
  card: CardID
  message: MessageID
  messageCreated: Date
  reaction: string
  creator: SocialID
}

export interface RemoveReactionEvent extends BaseRequestEvent {
  type: MessageRequestEventType.RemoveReaction
  card: CardID
  message: MessageID
  messageCreated: Date
  reaction: string
  creator: SocialID
}

export interface CreateFileEvent extends BaseRequestEvent {
  type: MessageRequestEventType.CreateFile
  card: CardID
  message: MessageID
  messageCreated: Date
  data: FileData
  creator: SocialID
  created?: Date
}

export interface RemoveFileEvent extends BaseRequestEvent {
  type: MessageRequestEventType.RemoveFile
  card: CardID
  message: MessageID
  messageCreated: Date
  blobId: BlobID
  creator: SocialID
}

export interface CreateLinkPreviewEvent extends BaseRequestEvent {
  type: MessageRequestEventType.CreateLinkPreview
  card: CardID
  message: MessageID
  messageCreated: Date
  data: LinkPreviewData
  creator: SocialID
}

export interface RemoveLinkPreviewEvent extends BaseRequestEvent {
  type: MessageRequestEventType.RemoveLinkPreview
  card: CardID
  message: MessageID
  messageCreated: Date
  id: LinkPreviewID
  creator: SocialID
}

export interface CreateThreadEvent extends BaseRequestEvent {
  type: MessageRequestEventType.CreateThread
  card: CardID
  message: MessageID
  messageCreated: Date
  thread: CardID
  threadType: CardType
}

export interface UpdateThreadEvent extends BaseRequestEvent {
  type: MessageRequestEventType.UpdateThread
  card: CardID
  message: MessageID
  thread: CardID
  updates: {
    replies: 'increment' | 'decrement'
    lastReply?: Date
  }
}

export interface CreateMessagesGroupEvent extends BaseRequestEvent {
  type: MessageRequestEventType.CreateMessagesGroup
  group: MessagesGroup
}

export interface RemoveMessagesGroupEvent extends BaseRequestEvent {
  type: MessageRequestEventType.RemoveMessagesGroup
  card: CardID
  blobId: BlobID
}

export type MessageEventResult = CreateMessageResult

export interface CreateMessageResult {
  id: MessageID
  created: Date
}
