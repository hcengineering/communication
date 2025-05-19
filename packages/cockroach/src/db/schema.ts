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

import {
  type AccountID,
  type BlobID,
  type CardID,
  type ContextID,
  type MessageID,
  type MessageType,
  type PatchType,
  type RichText,
  type SocialID,
  type WorkspaceID,
  type NotificationID,
  type LabelID,
  type CardType,
  type BlobMetadata
} from '@hcengineering/communication-types'
import type { NotificationContent, NotificationType } from '@hcengineering/communication-types'

export enum TableName {
  File = 'communication.files',
  Message = 'communication.messages',
  MessagesGroup = 'communication.messages_groups',
  Notification = 'communication.notifications',
  NotificationContext = 'communication.notification_context',
  Patch = 'communication.patch',
  Reaction = 'communication.reactions',
  Thread = 'communication.thread',
  Collaborators = 'communication.collaborators',
  Label = 'communication.label'
}

export interface MessageDb {
  id: MessageID
  type: MessageType
  workspace_id: WorkspaceID
  card_id: CardID
  content: RichText
  creator: SocialID
  created: Date
  data?: Record<string, any>
  external_id?: string
}

export const messageSchema: Record<keyof MessageDb, string> = {
  id: 'int8',
  workspace_id: 'uuid',
  card_id: 'varchar',
  content: 'text',
  creator: 'varchar',
  created: 'timestamptz',
  type: 'varchar',
  data: 'jsonb',
  external_id: 'varchar'
}

export interface MessagesGroupDb {
  workspace_id: WorkspaceID
  card_id: CardID
  blob_id: BlobID
  from_date: Date
  to_date: Date
  count: number
  patches?: PatchDb[]
}

export interface PatchDb {
  workspace_id: WorkspaceID
  card_id: CardID
  message_id: MessageID
  type: PatchType
  data: Record<string, any>
  creator: SocialID
  created: Date
  message_created: Date
}

export interface ReactionDb {
  workspace_id: WorkspaceID
  card_id: CardID
  message_id: MessageID
  reaction: string
  creator: SocialID
  created: Date
}

export interface FileDb {
  workspace_id: WorkspaceID
  card_id: CardID
  message_id: MessageID
  blob_id: BlobID
  filename: string
  size: number
  type: string
  meta?: BlobMetadata
  creator: SocialID
  created: Date
  message_created: Date
}

export interface ThreadDb {
  workspace_id: WorkspaceID
  card_id: CardID
  message_id: MessageID
  message_created: Date
  thread_id: CardID
  thread_type: CardType
  replies_count: number
  last_reply: Date
}

export interface NotificationDb {
  id: NotificationID
  type: NotificationType
  read: boolean
  message_id: MessageID | null
  message_created: Date
  context_id: ContextID
  created: Date
  content: NotificationContent
}

export interface ContextDb {
  workspace_id: WorkspaceID
  card_id: CardID
  account: AccountID
  last_update: Date
  last_view: Date
  last_notify?: Date
}

export interface CollaboratorDb {
  workspace_id: WorkspaceID
  card_id: CardID
  card_type: CardType
  account: AccountID
  date: Date
}

export interface LabelDb {
  workspace_id: WorkspaceID
  label_id: LabelID
  card_id: CardID
  card_type: CardType
  account: AccountID
  created: Date
}
