import type {
  Attachment,
  CardID,
  ContextID,
  Message,
  MessageID,
  NotificationContext,
  NotificationContextUpdate,
  Patch,
  Reaction,
  RichText,
  SocialID,
  Notification,
  ThreadID
} from '@hcengineering/communication-types'

export enum EventType {
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

  MessageCreated = 'messageCreated',
  MessageRemoved = 'messageRemoved',
  PatchCreated = 'patchCreated',
  ReactionCreated = 'reactionCreated',
  ReactionRemoved = 'reactionRemoved',
  AttachmentCreated = 'attachmentCreated',
  AttachmentRemoved = 'attachmentRemoved',
  NotificationCreated = 'notificationCreated',
  NotificationRemoved = 'notificationRemoved',
  NotificationContextCreated = 'notificationContextCreated',
  NotificationContextRemoved = 'notificationContextRemoved',
  NotificationContextUpdated = 'notificationContextUpdated'
}

export type Event =
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

export interface CreateMessageEvent {
  type: EventType.CreateMessage
  thread: ThreadID
  content: RichText
  creator: SocialID
}

export interface RemoveMessageEvent {
  type: EventType.RemoveMessage
  thread: ThreadID
  message: MessageID
}

export interface CreatePatchEvent {
  type: EventType.CreatePatch
  thread: ThreadID
  message: MessageID
  content: RichText
  creator: SocialID
}

export interface CreateReactionEvent {
  type: EventType.CreateReaction
  thread: ThreadID
  message: MessageID
  reaction: string
  creator: SocialID
}

export interface RemoveReactionEvent {
  type: EventType.RemoveReaction
  thread: ThreadID
  message: MessageID
  reaction: string
  creator: SocialID
}

export interface CreateAttachmentEvent {
  type: EventType.CreateAttachment
  thread: ThreadID
  message: MessageID
  card: CardID
  creator: SocialID
}

export interface RemoveAttachmentEvent {
  type: EventType.RemoveAttachment
  thread: ThreadID
  message: MessageID
  card: CardID
}

export interface CreateNotificationEvent {
  type: EventType.CreateNotification
  message: MessageID
  context: ContextID
}

export interface RemoveNotificationEvent {
  type: EventType.RemoveNotification
  message: MessageID
  context: ContextID
}

export interface CreateNotificationContextEvent {
  type: EventType.CreateNotificationContext
  card: CardID
  lastView?: Date
  lastUpdate?: Date
}

export interface RemoveNotificationContextEvent {
  type: EventType.RemoveNotificationContext
  context: ContextID
}

export interface UpdateNotificationContextEvent {
  type: EventType.UpdateNotificationContext
  context: ContextID
  update: NotificationContextUpdate
}

export type EventResult = CreateMessageResult | CreateNotificationContextResult | {}

export interface CreateMessageResult {
  id: MessageID
}

export interface CreateNotificationContextResult {
  id: ContextID
}

//TODO: THINK ABOUT BETTER NAMES
export type BroadcastEvent =
  | MessageCreatedEvent
  | MessageRemovedEvent
  | PatchCreatedEvent
  | ReactionCreatedEvent
  | ReactionRemovedEvent
  | AttachmentCreatedEvent
  | AttachmentRemovedEvent
  | NotificationCreatedEvent
  | NotificationRemovedEvent
  | NotificationContextCreatedEvent
  | NotificationContextRemovedEvent
  | NotificationContextUpdatedEvent

export interface MessageCreatedEvent {
  type: EventType.MessageCreated
  message: Message
}

export interface MessageRemovedEvent {
  type: EventType.MessageRemoved
  thread: ThreadID
  message: MessageID
}

export interface PatchCreatedEvent {
  type: EventType.PatchCreated
  thread: ThreadID
  patch: Patch
}

export interface ReactionCreatedEvent {
  type: EventType.ReactionCreated
  thread: ThreadID
  reaction: Reaction
}

export interface ReactionRemovedEvent {
  type: EventType.ReactionRemoved
  thread: ThreadID
  message: MessageID
  reaction: string
  creator: SocialID
}

export interface AttachmentCreatedEvent {
  type: EventType.AttachmentCreated
  thread: ThreadID
  attachment: Attachment
}

export interface AttachmentRemovedEvent {
  type: EventType.AttachmentRemoved
  thread: ThreadID
  message: MessageID
  card: CardID
}

export interface NotificationCreatedEvent {
  type: EventType.NotificationCreated
  personalWorkspace: string
  notification: Notification
}

export interface NotificationRemovedEvent {
  type: EventType.NotificationRemoved
  personalWorkspace: string
  message: MessageID
  context: ContextID
}

export interface NotificationContextCreatedEvent {
  type: EventType.NotificationContextCreated
  context: NotificationContext
}

export interface NotificationContextRemovedEvent {
  type: EventType.NotificationContextRemoved
  personalWorkspace: string
  context: ContextID
}

export interface NotificationContextUpdatedEvent {
  type: EventType.NotificationContextUpdated
  personalWorkspace: string
  context: ContextID
  update: NotificationContextUpdate
}
