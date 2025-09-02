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
  type AccountUuid,
  type BlobID,
  type CardID,
  type ContextID,
  type MessageID,
  type SocialID,
  type WorkspaceUuid,
  type NotificationID,
  type LabelID,
  type CardType,
  NotificationContent,
  NotificationType, AttachmentID,
  PeerKind, PeerExtra
} from '@hcengineering/communication-types'
import { Domain } from '@hcengineering/communication-sdk-types'

export const schemas = {
  [Domain.MessagesGroup]: {
    workspace_id: 'uuid',
    card_id: 'varchar',
    blob_id: 'uuid',
    from_date: 'timestamptz',
    to_date: 'timestamptz',
    count: 'int8'
  },
  [Domain.MessageIndex]: {
    workspace_id: 'uuid',
    card_id: 'varchar',
    message_id: 'varchar',
    created: 'timestamptz',
    creator: 'varchar'
  },
  [Domain.ThreadIndex]: {
    workspace_id: 'uuid',
    card_id: 'varchar',
    message_id: 'varchar',
    thread_id: 'varchar',
    thread_type: 'varchar',
    replies_count: 'int',
    last_reply: 'timestamptz'
  },
  [Domain.AttachmentIndex]: {
    workspace_id: 'uuid',
    card_id: 'varchar',
    message_id: 'varchar',
    id: 'uuid',
    type: 'text',
    params: 'jsonb',
    creator: 'varchar',
    created: 'timestamptz',
    modified: 'timestamptz'
  },
  [Domain.Notification]: {
    id: 'int8',
    context_id: 'int8',
    message_created: 'timestamptz',
    message_id: 'varchar',
    blob_id: 'uuid',
    created: 'timestamptz',
    content: 'jsonb',
    type: 'varchar',
    read: 'bool'
  },
  [Domain.Collaborator]: {
    workspace_id: 'uuid',
    card_id: 'varchar',
    account: 'uuid',
    date: 'timestamptz',
    card_type: 'varchar'
  },
  [Domain.Label]: {
    workspace_id: 'uuid',
    card_id: 'varchar',
    card_type: 'varchar',
    label_id: 'varchar',
    account: 'uuid',
    created: 'timestamptz'
  },
  [Domain.NotificationContext]: {
    workspace_id: 'uuid',
    card_id: 'varchar',
    id: 'int8',
    account: 'uuid',
    last_view: 'timestamptz',
    last_update: 'timestamptz',
    last_notify: 'timestamptz'
  },
  [Domain.Peer]: {
    workspace_id: 'uuid',
    card_id: 'varchar',
    kind: 'varchar',
    value: 'varchar',
    extra: 'jsonb',
    created: 'timestamptz'
  }
} as const

export interface DomainDbModel {
  [Domain.MessagesGroup]: MessagesGroupDbModel
  [Domain.MessageIndex]: MessageCreatedDbModel
  [Domain.ThreadIndex]: ThreadDbModel
  [Domain.AttachmentIndex]: AttachmentDbModel

  [Domain.Notification]: NotificationDbModel
  [Domain.NotificationContext]: ContextDbModel
  [Domain.Collaborator]: CollaboratorDbModel

  [Domain.Label]: LabelDbModel
  [Domain.Peer]: PeerDbModel
}

export type DbModel<D extends keyof DomainDbModel> = DomainDbModel[D]

export type DbModelColumn<D extends Domain> = keyof DomainDbModel[D] & string

export type DbModelColumnType<D extends Domain> = DomainDbModel[D][DbModelColumn<D>]

export interface DbModelFilterRow<D extends Domain> { column: DbModelColumn<D>, value: DbModelColumnType<D> | DbModelColumnType<D>[] }
export type DbModelFilter<D extends Domain> = Array<DbModelFilterRow<D>>
export type DbModelUpdate<D extends Domain> = Array<{
  column: DbModelColumn<D>
  innerKey?: string
  value: any
}>
export type DbModelBatchUpdate<D extends Domain> = Array<{
  key: DbModelColumnType<D>
  column: DbModelColumn<D>
  innerKey?: string
  value: any
}>

interface MessageCreatedDbModel {
  workspace_id: WorkspaceUuid
  card_id: CardID
  message_id: MessageID
  created: Date
  creator: SocialID
}

interface MessagesGroupDbModel {
  workspace_id: WorkspaceUuid
  card_id: CardID
  blob_id: BlobID
  from_date: Date
  to_date: Date
  count: number
}

interface AttachmentDbModel {
  workspace_id: WorkspaceUuid
  card_id: CardID
  message_id: MessageID
  id: AttachmentID
  type: string
  params: Record<string, any>
  creator: SocialID
  created: Date
  modified?: Date
}

interface ThreadDbModel {
  workspace_id: WorkspaceUuid
  card_id: CardID
  message_id: MessageID
  thread_id: CardID
  thread_type: CardType
  replies_count: number
  last_reply: Date
}

interface NotificationDbModel {
  id: NotificationID
  type: NotificationType
  read: boolean
  message_id: MessageID | null
  message_created: Date
  blob_id?: BlobID
  context_id: ContextID
  created: Date
  content: NotificationContent
}

interface ContextDbModel {
  id: ContextID
  workspace_id: WorkspaceUuid
  card_id: CardID
  account: AccountUuid
  last_update: Date
  last_view: Date
  last_notify: Date
}

interface CollaboratorDbModel {
  workspace_id: WorkspaceUuid
  card_id: CardID
  card_type: CardType
  account: AccountUuid
  date: Date
}

interface LabelDbModel {
  workspace_id: WorkspaceUuid
  label_id: LabelID
  card_id: CardID
  card_type: CardType
  account: AccountUuid
  created: Date
}

interface PeerDbModel {
  workspace_id: WorkspaceUuid
  card_id: CardID
  kind: PeerKind
  value: string
  extra: PeerExtra
  created: Date
}
