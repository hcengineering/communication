import type {
  CardID,
  ContextID,
  FindMessagesParams,
  FindNotificationContextParams,
  FindNotificationsParams,
  Message,
  MessageID,
  NotificationContext,
  NotificationContextUpdate,
  RichText,
  SocialID,
  Notification
} from '@hcengineering/communication-types'

export interface DbAdapter {
  createMessage(
    workspace: string,
    card: CardID,
    content: RichText,
    creator: SocialID,
    created: Date
  ): Promise<MessageID>
  removeMessage(id: MessageID): Promise<void>
  createPatch(message: MessageID, content: RichText, creator: SocialID, created: Date): Promise<void>

  createReaction(message: MessageID, reaction: string, creator: SocialID, created: Date): Promise<void>
  removeReaction(message: MessageID, reaction: string, creator: SocialID): Promise<void>

  createAttachment(message: MessageID, attachment: CardID, creator: SocialID, created: Date): Promise<void>
  removeAttachment(message: MessageID, attachment: CardID): Promise<void>

  findMessages(workspace: string, query: FindMessagesParams): Promise<Message[]>

  createNotification(message: MessageID, context: ContextID): Promise<void>
  removeNotification(message: MessageID, context: ContextID): Promise<void>
  createContext(
    personalWorkspace: string,
    workspace: string,
    card: CardID,
    lastView?: Date,
    lastUpdate?: Date
  ): Promise<ContextID>
  updateContext(context: ContextID, update: NotificationContextUpdate): Promise<void>
  removeContext(context: ContextID): Promise<void>
  findContexts(
    params: FindNotificationContextParams,
    personalWorkspaces: string[],
    workspace?: string
  ): Promise<NotificationContext[]>
  findNotifications(
    params: FindNotificationsParams,
    personalWorkspace: string,
    workspace?: string
  ): Promise<Notification[]>

  close(): void
}
