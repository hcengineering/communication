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
  CreateMessageOptions,
  CreateMessageResult,
  EventResult,
  PatchMessageOptions,
  RequestEvent
} from '@hcengineering/communication-sdk-types'
import type {
  FindMessagesGroupsParams,
  FindMessagesParams,
  Message,
  MessagesGroup,
  FindNotificationsParams,
  FindNotificationContextParams,
  NotificationContext,
  Notification,
  MessageID,
  Markdown,
  SocialID,
  MessageType,
  BlobID,
  CardID,
  CardType,
  MessageExtra,
  BlobData
} from '@hcengineering/communication-types'

export interface RestClient {
  findMessages: (params: FindMessagesParams) => Promise<Message[]>
  findMessagesGroups: (params: FindMessagesGroupsParams) => Promise<MessagesGroup[]>
  findNotificationContexts: (params: FindNotificationContextParams) => Promise<NotificationContext[]>
  findNotifications: (params: FindNotificationsParams) => Promise<Notification[]>

  event: (event: RequestEvent) => Promise<EventResult>

  createMessage: (
    cardId: CardID,
    cardType: CardType,
    content: Markdown,
    type: MessageType,
    extra?: MessageExtra,
    socialId?: SocialID,
    date?: Date,
    messageId?: MessageID,
    options?: CreateMessageOptions
  ) => Promise<CreateMessageResult>
  updateMessage: (
    cardId: CardID,
    messageId: MessageID,
    content?: Markdown,
    extra?: MessageExtra,
    socialId?: SocialID,
    date?: Date,
    options?: PatchMessageOptions
  ) => Promise<void>
  removeMessage: (cardId: CardID, messageId: MessageID, socialId?: SocialID) => Promise<void>

  attachBlob: (cardId: CardID, messageId: MessageID, data: BlobData, socialId?: SocialID, date?: Date) => Promise<void>
  detachBlob: (cardId: CardID, messageId: MessageID, blobId: BlobID, socialId?: SocialID, date?: Date) => Promise<void>
}
