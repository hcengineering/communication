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
  type FindCollaboratorsParams,
  type AccountUuid,
  type CardID,
  type Collaborator,
  type ContextID,
  type FindMessagesGroupsParams,
  type FindNotificationContextParams,
  type FindNotificationsParams,
  type MessageID,
  type MessagesGroup,
  type Notification,
  type NotificationContext,
  type SocialID,
  type Thread,
  type WorkspaceUuid,
  type NotificationID,
  type Label,
  type FindLabelsParams,
  type LabelID,
  type CardType,
  NotificationType,
  type NotificationContent,
  type BlobID,
  type AttachmentData,
  type AttachmentID,
  type AttachmentUpdateData,
  WithTotal,
  PeerKind,
  PeerExtra,
  FindPeersParams,
  Peer,
  FindThreadParams,
  FindMessageMetaParams,
  MessageMeta
} from '@hcengineering/communication-types'
import type {
  CollaboratorQuery,
  CollaboratorUpdate,
  DbAdapter,
  LabelQuery,
  LabelUpdate,
  NotificationContextQuery,
  NotificationContextUpdate,
  NotificationQuery,
  NotificationUpdate,
  ThreadQuery,
  ThreadUpdate
} from '@hcengineering/communication-sdk-types'

import { MessagesDb } from './db/message'
import { NotificationsDb } from './db/notification'
import { connect } from './connection'
import { type Logger, type Options } from './types'
import { formatName } from './utils'
import { initSchema } from './init'
import { LabelsDb } from './db/label'
import { SqlClient } from './client'
import { PeersDb } from './db/peer'

export class CockroachAdapter implements DbAdapter {
  private readonly message: MessagesDb
  private readonly notification: NotificationsDb
  private readonly label: LabelsDb
  private readonly peer: PeersDb

  constructor (
    private readonly sql: SqlClient,
    private readonly workspace: WorkspaceUuid,
    private readonly logger?: Logger,
    private readonly options?: Options
  ) {
    this.message = new MessagesDb(this.sql, this.workspace, logger, options)
    this.notification = new NotificationsDb(this.sql, this.workspace, logger, options)
    this.label = new LabelsDb(this.sql, this.workspace, logger, options)
    this.peer = new PeersDb(this.sql, this.workspace, logger, options)
  }

  // MessageMeta
  async createMessageMeta (
    cardId: CardID,
    id: MessageID,
    creator: SocialID,
    created: Date
  ): Promise<boolean> {
    return await this.message.createMessageMeta(cardId, id, creator, created)
  }

  async findMessageMeta (params: FindMessageMetaParams): Promise<MessageMeta[]> {
    return await this.message.findMessageMeta(params)
  }

  // MessagesGroup
  async createMessagesGroup (
    cardId: CardID,
    blobId: BlobID,
    fromDate: Date,
    toDate: Date,
    count: number
  ): Promise<void> {
    await this.message.createMessagesGroup(cardId, blobId, fromDate, toDate, count)
  }

  async removeMessagesGroup (card: CardID, blobId: BlobID): Promise<void> {
    await this.message.removeMessagesGroup(card, blobId)
  }

  async findMessagesGroups (params: FindMessagesGroupsParams): Promise<MessagesGroup[]> {
    return await this.message.findMessagesGroups(params)
  }

  // AttachmentsIndex
  async addAttachments (
    cardId: CardID,
    messageId: MessageID,
    data: AttachmentData[],
    socialId: SocialID,
    date: Date
  ): Promise<void> {
    await this.message.addAttachments(cardId, messageId, data, socialId, date)
  }

  async removeAttachments (cardId: CardID, messageId: MessageID, ids: AttachmentID[]): Promise<void> {
    await this.message.removeAttachments(cardId, messageId, ids)
  }

  async setAttachments (
    cardId: CardID,
    messageId: MessageID,
    data: AttachmentData[],
    socialId: SocialID,
    date: Date
  ): Promise<void> {
    await this.message.setAttachments(cardId, messageId, data, socialId, date)
  }

  async updateAttachments (
    cardId: CardID,
    messageId: MessageID,
    data: AttachmentUpdateData[],
    date: Date
  ): Promise<void> {
    await this.message.updateAttachments(cardId, messageId, data, date)
  }

  // ThreadsIndex
  async attachThread (
    cardId: CardID,
    messageId: MessageID,
    threadId: CardID,
    threadType: CardType,
    socialId: SocialID,
    date: Date
  ): Promise<void> {
    await this.message.attachThread(cardId, messageId, threadId, threadType, socialId, date)
  }

  async updateThread (query: ThreadQuery, update: ThreadUpdate): Promise<void> {
    await this.message.updateThread(query, update)
  }

  async removeThreads (query: ThreadQuery): Promise<void> {
    await this.message.removeThreads(query)
  }

  async findThreads (params: FindThreadParams): Promise<Thread[]> {
    return await this.message.findThreads(params)
  }

  // Collaborators
  async addCollaborators (
    card: CardID,
    cardType: CardType,
    collaborators: AccountUuid[],
    date: Date
  ): Promise<AccountUuid[]> {
    return await this.notification.addCollaborators(card, cardType, collaborators, date)
  }

  async removeCollaborators (query: CollaboratorQuery): Promise<void> {
    await this.notification.removeCollaborators(query)
  }

  async updateCollaborators (query: CollaboratorQuery, update: CollaboratorUpdate): Promise<void> {
    await this.notification.updateCollaborators(query, update)
  }

  getCollaboratorsCursor (card: CardID, date: Date, size?: number): AsyncIterable<Collaborator[]> {
    return this.notification.getCollaboratorsCursor(card, date, size)
  }

  async findCollaborators (params: FindCollaboratorsParams): Promise<Collaborator[]> {
    return await this.notification.findCollaborators(params)
  }

  // Notifications
  async createNotification (
    contextId: ContextID,
    messageId: MessageID,
    messageCreated: Date,
    type: NotificationType,
    read: boolean,
    content: NotificationContent,
    created: Date
  ): Promise<NotificationID> {
    return await this.notification.createNotification(
      contextId,
      messageId,
      messageCreated,
      type,
      read,
      content,
      created
    )
  }

  async updateNotification (query: NotificationQuery, update: NotificationUpdate): Promise<number> {
    return await this.notification.updateNotification(query, update)
  }

  async removeNotifications (
    query: NotificationQuery
  ): Promise<NotificationID[]> {
    return await this.notification.removeNotifications(query)
  }

  async removeNotificationsBlobId (cardId: CardID, blobId: string): Promise<void> {
    await this.notification.removeNotificationsBlobId(cardId, blobId)
  }

  async updateNotificationsBlobId (cardId: CardID, blobId: string, from: Date, to: Date): Promise<void> {
    await this.notification.updateNotificationsBlobId(cardId, blobId, from, to)
  }

  async findNotifications (params: FindNotificationsParams): Promise<WithTotal<Notification>> {
    return await this.notification.findNotifications(params)
  }

  // NotificationContext
  async createNotificationContext (
    account: AccountUuid,
    card: CardID,
    lastUpdate: Date,
    lastView: Date,
    lastNotify: Date
  ): Promise<ContextID> {
    return await this.notification.createContext(account, card, lastUpdate, lastView, lastNotify)
  }

  async updateContext (query: NotificationContextQuery, update: NotificationContextUpdate): Promise<void> {
    await this.notification.updateContext(query, update)
  }

  async removeContext (query: NotificationContextQuery): Promise<ContextID | undefined> {
    return await this.notification.removeContext(query)
  }

  async findNotificationContexts (params: FindNotificationContextParams): Promise<NotificationContext[]> {
    return await this.notification.findContexts(params)
  }

  // Labels
  createLabel (cardId: CardID, cardType: CardType, labelId: LabelID, account: AccountUuid, created: Date): Promise<void> {
    return this.label.createLabel(labelId, cardId, cardType, account, created)
  }

  removeLabels (query: LabelQuery): Promise<void> {
    return this.label.removeLabels(query)
  }

  updateLabels (query: LabelQuery, updates: LabelUpdate): Promise<void> {
    return this.label.updateLabels(query, updates)
  }

  findLabels (params: FindLabelsParams): Promise<Label[]> {
    return this.label.findLabels(params)
  }

  // Peers
  async createPeer (
    workspaceId: WorkspaceUuid,
    cardId: CardID,
    kind: PeerKind,
    value: string,
    extra: PeerExtra,
    date: Date
  ): Promise<void> {
    await this.peer.createPeer(workspaceId, cardId, kind, value, extra, date)
  }

  async removePeer (workspaceId: WorkspaceUuid,
    cardId: CardID,
    kind: PeerKind,
    value: string): Promise<void> {
    await this.peer.removePeer(workspaceId, cardId, kind, value)
  }

  findPeers (params: FindPeersParams): Promise<Peer[]> {
    return this.peer.findPeers(params)
  }

  async getAccountsByPersonIds (ids: string[]): Promise<AccountUuid[]> {
    if (ids.length === 0) return []
    const sql = `SELECT data ->> 'personUuid' AS "personUuid"
                 FROM public.contact
                 WHERE "workspaceId" = $1::uuid
                   AND _id = ANY($2::text[])`
    const result = await this.sql.execute(sql, [this.workspace, ids])

    return result?.map((it) => it.personUuid as AccountUuid).filter((it) => it != null) ?? []
  }

  async getNameByAccount (id: AccountUuid): Promise<string | undefined> {
    const sql = `SELECT data ->> 'name' AS name
                 FROM public.contact
                 WHERE "workspaceId" = $1::uuid
                   AND data ->> 'personUuid' = $2
                 LIMIT 1`
    const result = await this.sql.execute(sql, [this.workspace, id])
    const name: string | undefined = result[0]?.name

    return name != null ? formatName(name) : undefined
  }

  async getCardTitle (_id: CardID): Promise<string | undefined> {
    const sql = `SELECT data ->> 'title' AS title
                 FROM public.card
                 WHERE "workspaceId" = $1::uuid
                   AND "_id" = $2::text
                 LIMIT 1`
    const result = await this.sql.execute(sql, [this.workspace, _id])

    return result[0]?.title
  }

  async getCardSpaceMembers (cardId: CardID): Promise<AccountUuid[]> {
    const sql = `SELECT s.members
                 FROM public.space AS s
                 JOIN public.card AS c ON c."workspaceId" = s."workspaceId" AND c.space = s._id
                 WHERE c."workspaceId" = $1::uuid AND c."_id" = $2::text
                 LIMIT 1`

    const result = await this.sql.execute(sql, [this.workspace, cardId])
    return result[0]?.members ?? []
  }

  close (): void {
    this.sql.close()
  }
}

export async function createDbAdapter (
  connectionString: string,
  workspace: WorkspaceUuid,
  logger?: Logger,
  options?: Options
): Promise<DbAdapter> {
  const connection = connect(connectionString)
  const sql = await connection.getClient()
  await initSchema(sql)

  const client = new SqlClient(connection, sql)

  return new CockroachAdapter(client, workspace, logger, options)
}
