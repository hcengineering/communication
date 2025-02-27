import type postgres from 'postgres'
import {
  type Message,
  type FindMessagesParams,
  type CardID,
  type RichText,
  type SocialID,
  type MessageID,
  type ContextID,
  type NotificationContextUpdate,
  type FindNotificationContextParams,
  type NotificationContext,
  type FindNotificationsParams,
  type Notification,
  type BlobID,
  type MessagesGroup,
  type FindMessagesGroupsParams,
  type WorkspaceID,
  PatchType,
  type Thread
} from '@hcengineering/communication-types'
import type { DbAdapter } from '@hcengineering/communication-sdk-types'

import { MessagesDb } from './db/message'
import { NotificationsDb } from './db/notification'
import { connect, type PostgresClientReference } from './connection'
import { MessagesGroupsDb } from './db/messagesGroups.ts'

export class CockroachAdapter implements DbAdapter {
  private readonly message: MessagesDb
  private readonly messageGroups: MessagesGroupsDb
  private readonly notification: NotificationsDb

  constructor(
    private readonly db: PostgresClientReference,
    private readonly sqlClient: postgres.Sql,
    private readonly workspace: WorkspaceID
  ) {
    this.message = new MessagesDb(this.sqlClient, this.workspace)
    this.messageGroups = new MessagesGroupsDb(this.sqlClient, this.workspace)
    this.notification = new NotificationsDb(this.sqlClient, this.workspace)
  }

  async createMessage(card: CardID, content: RichText, creator: SocialID, created: Date): Promise<MessageID> {
    return await this.message.createMessage(card, content, creator, created)
  }

  async createPatch(
    card: CardID,
    message: MessageID,
    type: PatchType,
    content: RichText,
    creator: SocialID,
    created: Date
  ): Promise<void> {
    return await this.message.createPatch(card, message, content, creator, created)
  }

  async removeMessage(card: CardID, message: MessageID): Promise<void> {
    await this.message.removeMessage(card, message)
  }

  async removeMessages(card: CardID, fromId: MessageID, toId: MessageID): Promise<void> {
    await this.message.removeMessages(card, fromId, toId)
  }

  async createMessagesGroup(
    card: CardID,
    blobId: BlobID,
    fromDate: Date,
    toDate: Date,
    fromID: MessageID,
    toID: MessageID,
    count: number
  ): Promise<void> {
    return await this.messageGroups.createMessagesGroup(card, blobId, fromDate, toDate, fromID, toID, count)
  }

  async createReaction(
    card: CardID,
    message: MessageID,
    reaction: string,
    creator: SocialID,
    created: Date
  ): Promise<void> {
    return await this.message.createReaction(card, message, reaction, creator, created)
  }

  async removeReaction(card: CardID, message: MessageID, reaction: string, creator: SocialID): Promise<void> {
    return await this.message.removeReaction(card, message, reaction, creator)
  }

  async createAttachment(message: MessageID, attachment: CardID, creator: SocialID, created: Date): Promise<void> {
    return await this.message.createAttachment(message, attachment, creator, created)
  }

  async removeAttachment(message: MessageID, attachment: CardID): Promise<void> {
    return await this.message.removeAttachment(message, attachment)
  }

  async findMessages(params: FindMessagesParams): Promise<Message[]> {
    return await this.message.find(params)
  }

  async findMessagesGroups(params: FindMessagesGroupsParams): Promise<MessagesGroup[]> {
    return await this.messageGroups.find(params)
  }

  async createNotification(message: MessageID, context: ContextID): Promise<void> {
    return await this.notification.createNotification(message, context)
  }

  async removeNotification(message: MessageID, context: ContextID): Promise<void> {
    return await this.notification.removeNotification(message, context)
  }

  async createContext(
    personalWorkspace: WorkspaceID,
    card: CardID,
    lastView?: Date,
    lastUpdate?: Date
  ): Promise<ContextID> {
    return await this.notification.createContext(personalWorkspace, card, lastView, lastUpdate)
  }

  async updateContext(context: ContextID, update: NotificationContextUpdate): Promise<void> {
    return await this.notification.updateContext(context, update)
  }

  async removeContext(context: ContextID): Promise<void> {
    return await this.notification.removeContext(context)
  }

  async findContexts(
    params: FindNotificationContextParams,
    personalWorkspaces: WorkspaceID[],
    workspace?: WorkspaceID
  ): Promise<NotificationContext[]> {
    return await this.notification.findContexts(params, personalWorkspaces, workspace)
  }

  async findNotifications(
    params: FindNotificationsParams,
    personalWorkspace: WorkspaceID,
    workspace?: WorkspaceID
  ): Promise<Notification[]> {
    return await this.notification.findNotifications(params, personalWorkspace, workspace)
  }

  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  async findThread(thread: CardID): Promise<Thread | undefined> {
    //TODO: implement
    return undefined
  }
  close(): void {
    this.db.close()
  }

  async createThread(card: CardID, message: MessageID, thread: CardID, created: Date): Promise<void> {
    //TODO: implement
  }

  async updateThread(thread: CardID, lastReply: Date, op: 'increment' | 'decrement'): Promise<void> {
    //TODO: implement
  }

  async removeMessagesGroup(card: CardID, blob: BlobID): Promise<void> {
    //TODO: implement
  }

  async removePatches(card: CardID, fromId: MessageID, toId: MessageID): Promise<void> {
    //TODO: implement
  }
}

export async function createDbAdapter(connectionString: string, workspace: WorkspaceID): Promise<DbAdapter> {
  const db = connect(connectionString)
  const sqlClient = await db.getClient()

  return new CockroachAdapter(db, sqlClient, workspace)
}
