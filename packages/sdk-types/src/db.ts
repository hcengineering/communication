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
  CardID,
  ContextID,
  FindNotificationContextParams,
  FindNotificationsParams,
  MessageID,
  NotificationContext,
  SocialID,
  Notification,
  BlobID,
  FindMessagesGroupsParams,
  MessagesGroup,
  Thread,
  AccountID,
  Collaborator,
  FindCollaboratorsParams,
  NotificationID,
  Label,
  FindLabelsParams,
  LabelID,
  CardType,
  NotificationContent,
  NotificationType,
  AttachmentData,
  AttachmentID,
  AttachmentUpdateData,
  WithTotal,
  WorkspaceID,
  PeerKind,
  PeerExtra,
  FindPeersParams,
  Peer,
  FindThreadParams,
  FindMessageMetaParams,
  MessageMeta
} from '@hcengineering/communication-types'

export interface DbAdapter {
  // MessageMeta
  createMessageMeta: (
    cardId: CardID,
    id: MessageID,
    creator: SocialID,
    created: Date
  ) => Promise<boolean>
  findMessageMeta: (params: FindMessageMetaParams) => Promise<MessageMeta[]>

  // MessagesGroup
  createMessagesGroup: (cardId: CardID, blobId: BlobID, fromDate: Date, toDate: Date, count: number) => Promise<void>
  removeMessagesGroup: (cardId: CardID, blobId: BlobID) => Promise<void>
  findMessagesGroups: (params: FindMessagesGroupsParams) => Promise<MessagesGroup[]>

  // AttachmentsIndex
  addAttachments: (cardId: CardID, messageId: MessageID, data: AttachmentData[], socialId: SocialID, date: Date) => Promise<void>
  setAttachments: (cardId: CardID, messageId: MessageID, data: AttachmentData[], socialId: SocialID, date: Date) => Promise<void>
  removeAttachments: (card: CardID, messageId: MessageID, ids: AttachmentID[]) => Promise<void>
  updateAttachments: (cardId: CardID, messageId: MessageID, data: AttachmentUpdateData[], date: Date) => Promise<void>

  // ThreadsIndex
  attachThread: (cardId: CardID, messageId: MessageID, threadId: CardID, threadType: CardType, socialId: SocialID, date: Date) => Promise<void>
  removeThreads: (query: ThreadQuery) => Promise<void>
  updateThread: (query: ThreadQuery, update: ThreadUpdate) => Promise<void>
  findThreads: (params: FindThreadParams) => Promise<Thread[]>

  // Peers
  createPeer: (
    workspaceId: WorkspaceID,
    cardId: CardID,
    kind: PeerKind,
    value: string,
    extra: PeerExtra,
    date: Date
  ) => Promise<void>
  removePeer: (workspaceId: WorkspaceID,
    cardId: CardID,
    kind: PeerKind,
    value: string) => Promise<void>
  findPeers: (params: FindPeersParams) => Promise<Peer[]>

  // Collaborators
  addCollaborators: (cardId: CardID, cardType: CardType, collaborators: AccountID[], date: Date) => Promise<AccountID[]>
  removeCollaborators: (query: CollaboratorQuery) => Promise<void>
  updateCollaborators: (query: CollaboratorQuery, update: CollaboratorUpdate) => Promise<void>
  getCollaboratorsCursor: (cardId: CardID, date: Date, size?: number) => AsyncIterable<Collaborator[]>
  findCollaborators: (params: FindCollaboratorsParams) => Promise<Collaborator[]>

  // Notifications
  createNotification: (
    contextId: ContextID,
    message: MessageID,
    messageCreated: Date,
    type: NotificationType,
    read: boolean,
    content: NotificationContent,
    created: Date
  ) => Promise<NotificationID>
  updateNotification: (query: NotificationQuery, updates: NotificationUpdate) => Promise<number>
  removeNotifications: (query: NotificationQuery) => Promise<NotificationID[]>
  removeNotificationsBlobId: (cardId: CardID, blobId: string) => Promise<void>
  updateNotificationsBlobId: (cardId: CardID, blobId: string, from: Date, to: Date) => Promise<void>
  findNotifications: (params: FindNotificationsParams) => Promise<WithTotal<Notification>>

  // NotificationContext
  createNotificationContext: (
    account: AccountID,
    cardId: CardID,
    lastUpdate: Date,
    lastView: Date,
    lastNotify: Date
  ) => Promise<ContextID>
  updateContext: (query: NotificationContextQuery, updates: NotificationContextUpdate) => Promise<void>
  removeContext: (query: NotificationContextQuery) => Promise<ContextID | undefined>
  findNotificationContexts: (params: FindNotificationContextParams) => Promise<NotificationContext[]>

  // Labels
  createLabel: (cardId: CardID, cardType: CardType, labelId: LabelID, account: AccountID, created: Date) => Promise<void>
  removeLabels: (query: LabelQuery) => Promise<void>
  updateLabels: (query: LabelQuery, update: LabelUpdate) => Promise<void>
  findLabels: (params: FindLabelsParams) => Promise<Label[]>

  // Other
  getCardTitle: (cardId: CardID) => Promise<string | undefined>
  getCardSpaceMembers: (cardId: CardID) => Promise<AccountID[]>
  getAccountsByPersonIds: (ids: string[]) => Promise<AccountID[]>
  getNameByAccount: (id: AccountID) => Promise<string | undefined>

  close: () => void
}

export type ThreadQuery = Partial<Pick<Thread, 'cardId' | 'threadId' | 'messageId'>>
export type ThreadUpdate = Partial<Pick<Thread, | 'threadType' | 'lastReply'>> & { repliesCountOp?: 'increment' | 'decrement' }

export type LabelQuery = Partial<Pick<Label, 'cardId' | 'labelId' | 'account'>>
export type LabelUpdate = Partial<Pick<Label, 'cardType'>>

export type NotificationContextQuery = Partial<Pick<NotificationContext, 'account' | 'id'>>
export type NotificationContextUpdate = Partial<Pick<NotificationContext, 'lastView' | 'lastUpdate' | 'lastNotify'>>

export type NotificationQuery = Partial<Pick<Notification, 'contextId' | 'account' | 'type'>> & {
  id?: NotificationID | NotificationID[]
  untilDate?: Date
}
export type NotificationUpdate = Pick<Notification, 'read'>

export type CollaboratorQuery = Pick<Collaborator, 'cardId'> & { account?: AccountID | AccountID[] }
export type CollaboratorUpdate = Partial<Collaborator>
