import type {
  CardID,
  ContextID,
  MessageID,
  NotificationContextUpdate,
  RichText,
  SocialID,
  MessagesGroup,
  BlobID
} from '@hcengineering/communication-types'

export enum RequestEventType {
  CreateMessage = 'createMessage',
  RemoveMessage = 'removeMessage',
  CreatePatch = 'createPatch',
  CreateReaction = 'createReaction',
  RemoveReaction = 'removeReaction',
  CreateAttachment = 'createAttachment',
  RemoveAttachment = 'removeAttachment',
  CreateNotification = 'createNotification',
  RemoveNotification = 'removeNotification',
  CreateNotificationContext = 'createNotificationContext',
  RemoveNotificationContext = 'removeNotificationContext',
  UpdateNotificationContext = 'updateNotificationContext',
  CreateMessagesGroup = 'createMessagesGroup',
  RemoveMessagesGroup = 'removeMessagesGroup'
}

export type RequestEvent =
  | CreateMessageEvent
  | RemoveMessageEvent
  | CreatePatchEvent
  | CreateReactionEvent
  | RemoveReactionEvent
  | CreateAttachmentEvent
  | RemoveAttachmentEvent
  | CreateNotificationEvent
  | RemoveNotificationEvent
  | CreateNotificationContextEvent
  | RemoveNotificationContextEvent
  | UpdateNotificationContextEvent
  | CreateMessagesGroupEvent
  | RemoveMessagesGroupEvent

export interface CreateMessageEvent {
  type: RequestEventType.CreateMessage
  card: CardID
  content: RichText
  creator: SocialID
}

export interface RemoveMessageEvent {
  type: RequestEventType.RemoveMessage
  card: CardID
  message: MessageID
}

export interface CreatePatchEvent {
  type: RequestEventType.CreatePatch
  card: CardID
  message: MessageID
  content: RichText
  creator: SocialID
}

export interface CreateReactionEvent {
  type: RequestEventType.CreateReaction
  card: CardID
  message: MessageID
  reaction: string
  creator: SocialID
}

export interface RemoveReactionEvent {
  type: RequestEventType.RemoveReaction
  card: CardID
  message: MessageID
  reaction: string
  creator: SocialID
}

export interface CreateAttachmentEvent {
  type: RequestEventType.CreateAttachment
  card: CardID
  message: MessageID
  attachment: CardID
  creator: SocialID
}

export interface RemoveAttachmentEvent {
  type: RequestEventType.RemoveAttachment
  card: CardID
  message: MessageID
  attachment: CardID
}

export interface CreateNotificationEvent {
  type: RequestEventType.CreateNotification
  message: MessageID
  context: ContextID
}

export interface RemoveNotificationEvent {
  type: RequestEventType.RemoveNotification
  message: MessageID
  context: ContextID
}

export interface CreateNotificationContextEvent {
  type: RequestEventType.CreateNotificationContext
  card: CardID
  lastView?: Date
  lastUpdate?: Date
}

export interface RemoveNotificationContextEvent {
  type: RequestEventType.RemoveNotificationContext
  context: ContextID
}

export interface UpdateNotificationContextEvent {
  type: RequestEventType.UpdateNotificationContext
  context: ContextID
  update: NotificationContextUpdate
}

export interface CreateMessagesGroupEvent {
  type: RequestEventType.CreateMessagesGroup
  group: MessagesGroup
}

export interface RemoveMessagesGroupEvent {
  type: RequestEventType.RemoveMessagesGroup
  card: CardID
  blobId: BlobID
}

export type EventResult = CreateMessageResult | CreateNotificationContextResult | {}

export interface CreateMessageResult {
  id: MessageID
}

export interface CreateNotificationContextResult {
  id: ContextID
}
