import { type Message, type Patch, type Reaction, type Attachment } from '@hcengineering/communication-types'
import {
  type CreateAttachmentEvent,
  type AttachmentCreatedEvent,
  type CreateMessageEvent,
  type MessageCreatedEvent,
  type CreatePatchEvent,
  type PatchCreatedEvent,
  type CreateReactionEvent,
  type ReactionCreatedEvent,
  type RemoveAttachmentEvent,
  type AttachmentRemovedEvent,
  type RemoveMessageEvent,
  type MessageRemovedEvent,
  type RemoveReactionEvent,
  type ReactionRemovedEvent,
  type EventResult,
  type DbAdapter,
  type CreateNotificationEvent,
  type RemoveNotificationEvent,
  type CreateNotificationContextEvent,
  type RemoveNotificationContextEvent,
  type UpdateNotificationContextEvent,
  type NotificationRemovedEvent,
  type NotificationContextCreatedEvent,
  type NotificationContextRemovedEvent,
  type NotificationContextUpdatedEvent,
  type ResponseEvent,
  RequestEventType,
  type RequestEvent,
  ResponseEventType
} from '@hcengineering/communication-sdk-types'

export type Result = {
  responseEvent?: ResponseEvent
  result: EventResult
}

export class EventProcessor {
  constructor(
    private readonly db: DbAdapter,
    private readonly workspace: string
  ) {}

  async process(personalWorkspace: string, event: RequestEvent): Promise<Result> {
    switch (event.type) {
      case RequestEventType.CreateMessage:
        return await this.createMessage(personalWorkspace, event)
      case RequestEventType.RemoveMessage:
        return await this.removeMessage(personalWorkspace, event)
      case RequestEventType.CreatePatch:
        return await this.createPatch(personalWorkspace, event)
      case RequestEventType.CreateReaction:
        return await this.createReaction(personalWorkspace, event)
      case RequestEventType.RemoveReaction:
        return await this.removeReaction(personalWorkspace, event)
      case RequestEventType.CreateAttachment:
        return await this.createAttachment(personalWorkspace, event)
      case RequestEventType.RemoveAttachment:
        return await this.removeAttachment(personalWorkspace, event)
      case RequestEventType.CreateNotification:
        return await this.createNotification(personalWorkspace, event)
      case RequestEventType.RemoveNotification:
        return await this.removeNotification(personalWorkspace, event)
      case RequestEventType.CreateNotificationContext:
        return await this.createNotificationContext(personalWorkspace, event)
      case RequestEventType.RemoveNotificationContext:
        return await this.removeNotificationContext(personalWorkspace, event)
      case RequestEventType.UpdateNotificationContext:
        return await this.updateNotificationContext(personalWorkspace, event)
      case RequestEventType.CreateMessagesGroup:
        // return await this.createMessagesGroup(personalWorkspace, event)
        return {
          responseEvent: undefined,
          result: {}
        }
      case RequestEventType.RemoveMessagesGroup:
        // return await this.removeMessagesGroup(personalWorkspace, event)
        return {
          responseEvent: undefined,
          result: {}
        }
    }
  }

  private async createMessage(_personalWorkspace: string, event: CreateMessageEvent): Promise<Result> {
    const created = new Date()
    const id = await this.db.createMessage(this.workspace, event.card, event.content, event.creator, created)
    const message: Message = {
      id,
      card: event.card,
      content: event.content,
      creator: event.creator,
      created: created,
      edited: created,
      reactions: [],
      attachments: []
    }
    const responseEvent: MessageCreatedEvent = {
      type: ResponseEventType.MessageCreated,
      message
    }
    return {
      responseEvent,
      result: { id }
    }
  }

  private async createPatch(_personalWorkspace: string, event: CreatePatchEvent): Promise<Result> {
    const created = new Date()
    await this.db.createPatch(event.message, event.content, event.creator, created)

    const patch: Patch = {
      message: event.message,
      content: event.content,
      creator: event.creator,
      created: created
    }
    const responseEvent: PatchCreatedEvent = {
      type: ResponseEventType.PatchCreated,
      card: event.card,
      patch
    }
    return {
      responseEvent,
      result: {}
    }
  }

  private async removeMessage(_personalWorkspace: string, event: RemoveMessageEvent): Promise<Result> {
    await this.db.removeMessage(event.message)

    const responseEvent: MessageRemovedEvent = {
      type: ResponseEventType.MessageRemoved,
      card: event.card,
      message: event.message
    }

    return {
      responseEvent,
      result: {}
    }
  }

  private async createReaction(_personalWorkspace: string, event: CreateReactionEvent): Promise<Result> {
    const created = new Date()
    await this.db.createReaction(event.message, event.reaction, event.creator, created)

    const reaction: Reaction = {
      message: event.message,
      reaction: event.reaction,
      creator: event.creator,
      created: created
    }
    const responseEvent: ReactionCreatedEvent = {
      type: ResponseEventType.ReactionCreated,
      card: event.card,
      reaction
    }
    return {
      responseEvent,
      result: {}
    }
  }

  private async removeReaction(_personalWorkspace: string, event: RemoveReactionEvent): Promise<Result> {
    await this.db.removeReaction(event.message, event.reaction, event.creator)
    const responseEvent: ReactionRemovedEvent = {
      type: ResponseEventType.ReactionRemoved,
      card: event.card,
      message: event.message,
      reaction: event.reaction,
      creator: event.creator
    }
    return {
      responseEvent,
      result: {}
    }
  }

  private async createAttachment(_personalWorkspace: string, event: CreateAttachmentEvent): Promise<Result> {
    const created = new Date()
    await this.db.createAttachment(event.message, event.card, event.creator, created)

    const attachment: Attachment = {
      message: event.message,
      card: event.card,
      creator: event.creator,
      created: created
    }
    const responseEvent: AttachmentCreatedEvent = {
      type: ResponseEventType.AttachmentCreated,
      card: event.card,
      attachment
    }

    return {
      responseEvent,
      result: {}
    }
  }

  private async removeAttachment(_personalWorkspace: string, event: RemoveAttachmentEvent): Promise<Result> {
    await this.db.removeAttachment(event.message, event.card)
    const responseEvent: AttachmentRemovedEvent = {
      type: ResponseEventType.AttachmentRemoved,
      card: event.card,
      message: event.message,
      attachment: event.attachment
    }
    return {
      responseEvent,
      result: {}
    }
  }

  private async createNotification(_personalWorkspace: string, event: CreateNotificationEvent): Promise<Result> {
    await this.db.createNotification(event.message, event.context)

    return {
      result: {}
    }
  }

  private async removeNotification(personalWorkspace: string, event: RemoveNotificationEvent): Promise<Result> {
    await this.db.removeNotification(event.message, event.context)

    const responseEvent: NotificationRemovedEvent = {
      type: ResponseEventType.NotificationRemoved,
      personalWorkspace: personalWorkspace,
      message: event.message,
      context: event.context
    }
    return {
      responseEvent,
      result: {}
    }
  }

  private async createNotificationContext(
    personalWorkspace: string,
    event: CreateNotificationContextEvent
  ): Promise<Result> {
    const id = await this.db.createContext(
      personalWorkspace,
      this.workspace,
      event.card,
      event.lastView,
      event.lastUpdate
    )
    const responseEvent: NotificationContextCreatedEvent = {
      type: ResponseEventType.NotificationContextCreated,
      context: {
        id,
        workspace: this.workspace,
        personalWorkspace: personalWorkspace,
        card: event.card,
        lastView: event.lastView,
        lastUpdate: event.lastUpdate
      }
    }
    return {
      responseEvent,
      result: { id }
    }
  }

  private async removeNotificationContext(
    personalWorkspace: string,
    event: RemoveNotificationContextEvent
  ): Promise<Result> {
    await this.db.removeContext(event.context)
    const responseEvent: NotificationContextRemovedEvent = {
      type: ResponseEventType.NotificationContextRemoved,
      personalWorkspace: personalWorkspace,
      context: event.context
    }
    return {
      responseEvent,
      result: {}
    }
  }

  async updateNotificationContext(personalWorkspace: string, event: UpdateNotificationContextEvent): Promise<Result> {
    await this.db.updateContext(event.context, event.update)

    const responseEvent: NotificationContextUpdatedEvent = {
      type: ResponseEventType.NotificationContextUpdated,
      personalWorkspace: personalWorkspace,
      context: event.context,
      update: event.update
    }
    return {
      responseEvent,
      result: {}
    }
  }
}
