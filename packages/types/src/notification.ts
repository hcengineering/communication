import type { Message, CardID } from './message'

export type ContextID = string & { context: true }

export interface Notification {
  message: Message
  context: ContextID
  read: boolean
  archived: boolean
}

export interface NotificationContext {
  id: ContextID
  card: CardID
  workspace: string
  personalWorkspace: string
  archivedFrom?: Date
  lastView?: Date
  lastUpdate?: Date
}

export interface NotificationContextUpdate {
  archivedFrom?: Date
  lastView?: Date
  lastUpdate?: Date
}
