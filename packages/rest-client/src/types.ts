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

import type { EventResult, RequestEvent } from '@hcengineering/communication-sdk-types'
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
  RichText,
  SocialID,
  MessageType,
  MessageData,
  BlobID,
  CardID,
  CardType
} from '@hcengineering/communication-types'

export interface RestClient {
  findMessages: (params: FindMessagesParams) => Promise<Message[]>
  findMessagesGroups: (params: FindMessagesGroupsParams) => Promise<MessagesGroup[]>
  findNotificationContexts: (params: FindNotificationContextParams) => Promise<NotificationContext[]>
  findNotifications: (params: FindNotificationsParams) => Promise<Notification[]>

  event: (event: RequestEvent) => Promise<EventResult>

  createMessage: (
    card: CardID,
    cardType: CardType,
    content: RichText,
    creator: SocialID,
    type: MessageType,
    data?: MessageData
  ) => Promise<MessageID>
  updateMessage: (card: CardID, message: MessageID, content: RichText, creator: SocialID) => Promise<void>
  removeMessage: (card: CardID, message: MessageID) => Promise<MessageID | undefined>
  removeMessages: (card: CardID, messages: MessageID[]) => Promise<MessageID[]>

  createFile: (
    card: CardID,
    message: MessageID,
    blobId: BlobID,
    fileType: string,
    filename: string,
    size: number,
    creator: SocialID
  ) => Promise<void>
  removeFile: (card: CardID, message: MessageID, blobId: BlobID, creator: SocialID) => Promise<void>
}
