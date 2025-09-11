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
  type CardID,
  type Collaborator,
  type ContextID,
  type Message,
  type MessageID,
  type MessagesGroup,
  type Notification,
  type NotificationContext,
  type NotificationID,
  type Reaction,
  type Thread,
  type Label,
  type AccountID,
  AttachmentID,
  Attachment,
  Peer,
  WorkspaceID,
  PeerExtra,
  MessageMeta
} from '@hcengineering/communication-types'
import { Domain } from '@hcengineering/communication-sdk-types'

import { DbModel } from '../schema'

interface RawNotification extends DbModel<Domain.Notification> {
  account: AccountID
}

type RawContext = DbModel<Domain.NotificationContext> & { id: ContextID, total?: number } & {
  notifications?: RawNotification[]
}

export function toMessage (raw: any): Message {
  return raw
}

export function toReaction (raw: any): Reaction {
  return {
    reaction: raw.reaction,
    creator: raw.creator,
    created: new Date(raw.created)
  }
}

export function toAttachment (raw: Omit<DbModel<Domain.AttachmentIndex>, 'workspace_id'>): Attachment {
  return {
    id: String(raw.id) as AttachmentID,
    type: raw.type,
    params: raw.params,
    creator: raw.creator,
    created: new Date(raw.created),
    modified: raw.modified != null ? new Date(raw.modified) : undefined
  } as any as Attachment
}

export function toMessagesGroup (raw: DbModel<Domain.MessagesGroup>): MessagesGroup {
  return {
    cardId: raw.card_id,
    blobId: raw.blob_id,
    fromDate: raw.from_date,
    toDate: raw.to_date,
    count: Number(raw.count)
  }
}

export function toThread (raw: DbModel<Domain.ThreadIndex>): Thread {
  return {
    cardId: raw.card_id,
    messageId: String(raw.message_id) as MessageID,
    threadId: raw.thread_id,
    threadType: raw.thread_type,
    repliesCount: Number(raw.replies_count),
    lastReply: new Date(raw.last_reply)
  }
}

export function toNotificationContext (raw: RawContext): NotificationContext {
  const lastView = new Date(raw.last_view)
  return {
    id: String(raw.id) as ContextID,
    cardId: raw.card_id,
    account: raw.account,
    lastView,
    lastUpdate: new Date(raw.last_update),
    lastNotify: raw.last_notify != null ? new Date(raw.last_notify) : undefined,
    notifications: (raw.notifications ?? [])
      .filter((it) => it.id != null)
      .map((it) => toNotificationRaw(raw.id, raw.card_id, { ...it, account: raw.account })),
    totalNotifications: Number(raw.total ?? 0)
  }
}

function toNotificationRaw (id: ContextID, card: CardID, raw: RawNotification): Notification {
  const created = new Date(raw.created)

  return {
    id: String(raw.id) as NotificationID,
    cardId: card,
    account: raw.account,
    type: raw.type,
    read: Boolean(raw.read),
    messageId: String(raw.message_id) as MessageID,
    messageCreated: new Date(raw.message_created),
    created,
    contextId: String(id) as ContextID,
    content: raw.content,
    blobId: raw.blob_id ?? undefined
  }
}

export function toNotification (raw: RawNotification & { card_id: CardID }): Notification {
  return toNotificationRaw(raw.context_id, raw.card_id, raw)
}

export function toCollaborator (raw: DbModel<Domain.Collaborator>): Collaborator {
  return {
    account: raw.account,
    cardType: raw.card_type,
    cardId: raw.card_id
  }
}

export function toLabel (raw: DbModel<Domain.Label>): Label {
  return {
    labelId: raw.label_id,
    cardId: raw.card_id,
    cardType: raw.card_type,
    account: raw.account,
    created: new Date(raw.created)
  }
}

export function toPeer (
  raw: DbModel<Domain.Peer> & { members?: { workspace_id: WorkspaceID, card_id: CardID, extra?: PeerExtra }[] }
): Peer {
  const peer: Peer = {
    workspaceId: raw.workspace_id,
    cardId: raw.card_id,
    kind: raw.kind,
    value: raw.value,
    extra: raw.extra,
    created: new Date(raw.created)
  }

  if (peer.kind === 'card') {
    return {
      ...peer,
      kind: 'card',
      members:
        raw.members?.map((it) => ({
          workspaceId: it.workspace_id,
          cardId: it.card_id,
          extra: it.extra ?? {}
        })) ?? []
    }
  }

  return peer
}

export function toMessageMeta (raw: DbModel<Domain.MessageIndex>): MessageMeta {
  return {
    id: String(raw.message_id) as MessageID,
    cardId: raw.card_id,
    created: new Date(raw.created),
    creator: raw.creator
  }
}
