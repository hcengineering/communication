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

import type { AccountID, CardID, CardType, ID, SocialID } from './core'
import type { Message, MessageID, MessagesGroup, Patch } from './message'

export type ContextID = ID & { context: true }
export type NotificationID = ID & { notification: true }

export interface Collaborator {
  card: CardID
  cardType: CardType
  account: AccountID
}

export interface Notification {
  id: NotificationID
  context: ContextID
  type: NotificationType
  read: boolean
  created: Date
  content: NotificationContent
  messageId?: MessageID
  message?: Message
  messageGroup?: MessagesGroup
  patches?: Patch[]
}

export enum NotificationType {
  Message = 'message',
  Reaction = 'reaction'
}

export interface ReactionNotificationContent {
  emoji: string
  creator: SocialID
}

export type NotificationContent = Record<string, any>

export interface NotificationContext {
  id: ContextID
  card: CardID
  account: AccountID
  lastUpdate: Date
  lastView: Date
  notifications?: Notification[]
}
