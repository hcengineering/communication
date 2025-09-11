//
// Copyright © 2025 Hardcore Engineering Inc.
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
//  you may not use this file except in compliance with the License. You may
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
  AttachmentID,
  CardID,
  type Collaborator,
  type FindCollaboratorsParams,
  type FindLabelsParams,
  type FindMessagesGroupsParams,
  type FindMessagesParams,
  type FindNotificationContextParams,
  type FindNotificationsParams,
  FindPeersParams,
  FindThreadParams,
  type Label,
  type Message,
  MessageID,
  type MessagesGroup,
  type Notification,
  type NotificationContext,
  PatchType,
  Peer,
  SocialID,
  Thread,
  UpdatePatchData
} from '@hcengineering/communication-types'
import {
  type AddCollaboratorsEvent,
  CardEventType,
  type CreateLabelEvent,
  type CreateMessageEvent,
  type CreateMessagesGroupEvent,
  type CreateNotificationContextEvent,
  type CreateNotificationEvent,
  type DbAdapter,
  type Event,
  LabelEventType,
  MessageEventType,
  NotificationEventType,
  ReactionPatchEvent,
  type RemoveCardEvent,
  type RemoveCollaboratorsEvent,
  type RemoveLabelEvent,
  type RemoveMessagesGroupEvent,
  type RemoveNotificationContextEvent,
  type RemoveNotificationsEvent,
  RemovePatchEvent,
  type SessionData,
  type UpdateCardTypeEvent,
  type UpdateNotificationContextEvent,
  type UpdateNotificationEvent,
  UpdatePatchEvent,
  ThreadPatchEvent,
  EventResult,
  AttachmentPatchEvent,
  BlobPatchEvent,
  PeerEventType,
  CreatePeerEvent,
  RemovePeerEvent
} from '@hcengineering/communication-sdk-types'

import type { Enriched, Middleware, MiddlewareContext } from '../types'
import { BaseMiddleware } from './base'

interface Result {
  skipPropagate?: boolean
  result?: EventResult
}

export class StorageMiddleware extends BaseMiddleware implements Middleware {
  constructor (
    private readonly db: DbAdapter,
    readonly context: MiddlewareContext,
    next?: Middleware
  ) {
    super(context, next)
  }

  // TODO: remove
  async findMessages (_: SessionData, params: FindMessagesParams): Promise<Message[]> {
    // return await this.db.findMessages(params)
    return []
  }

  async findMessagesGroups (_: SessionData, params: FindMessagesGroupsParams): Promise<MessagesGroup[]> {
    return await this.db.findMessagesGroups(params)
  }

  async findNotificationContexts (
    _: SessionData,
    params: FindNotificationContextParams
  ): Promise<NotificationContext[]> {
    return await this.db.findNotificationContexts(params)
  }

  async findNotifications (_: SessionData, params: FindNotificationsParams): Promise<Notification[]> {
    return await this.db.findNotifications(params)
  }

  async findLabels (_: SessionData, params: FindLabelsParams): Promise<Label[]> {
    return await this.db.findLabels(params)
  }

  async findCollaborators (_: SessionData, params: FindCollaboratorsParams): Promise<Collaborator[]> {
    return await this.db.findCollaborators(params)
  }

  async findPeers (_: SessionData, params: FindPeersParams): Promise<Peer[]> {
    return await this.db.findPeers(params)
  }

  async findThreads (_: SessionData, params: FindThreadParams): Promise<Thread[]> {
    return await this.db.findThreads(params)
  }

  async event (session: SessionData, event: Enriched<Event>, derived: boolean): Promise<EventResult> {
    const result = await this.processEvent(session, event)

    if (result.skipPropagate === true) {
      event.skipPropagate = true
    } else {
      await this.provideEvent(session, event, derived)
    }

    return result.result ?? {}
  }

  private async processEvent (session: SessionData, event: Enriched<Event>): Promise<Result> {
    switch (event.type) {
      // Messages
      case MessageEventType.CreateMessage:
        return await this.createMessage(event)
      case MessageEventType.UpdatePatch:
        return await this.updatePatch(event)
      case MessageEventType.RemovePatch:
        return await this.removePatch(event)
      case MessageEventType.ReactionPatch:
        return await this.reactionPatch(event)
      case MessageEventType.BlobPatch:
        return await this.blobPatch(event)
      case MessageEventType.AttachmentPatch:
        return await this.attachmentPatch(event)
      case MessageEventType.ThreadPatch:
        return await this.threadPatch(event)
      case MessageEventType.CreateMessagesGroup:
        return await this.createMessagesGroup(event)
      case MessageEventType.RemoveMessagesGroup:
        return await this.removeMessagesGroup(event)

      // Labels
      case LabelEventType.CreateLabel:
        return await this.createLabel(event)
      case LabelEventType.RemoveLabel:
        return await this.removeLabel(event)

      // Cards
      case CardEventType.UpdateCardType:
        return await this.updateCardType(event)
      case CardEventType.RemoveCard:
        return await this.removeCard(event)

      // Peers
      case PeerEventType.RemovePeer:
        return await this.removePeer(event)
      case PeerEventType.CreatePeer:
        return await this.createPeer(event)

      // Collaborators
      case NotificationEventType.AddCollaborators:
        return await this.addCollaborators(event)
      case NotificationEventType.RemoveCollaborators:
        return await this.removeCollaborators(event)

      // Notifications
      case NotificationEventType.CreateNotification:
        return await this.createNotification(event)
      case NotificationEventType.RemoveNotifications:
        return await this.removeNotifications(event)
      case NotificationEventType.UpdateNotification:
        return await this.updateNotification(event)

      // Notification Contexts
      case NotificationEventType.CreateNotificationContext:
        return await this.createNotificationContext(event)
      case NotificationEventType.RemoveNotificationContext:
        return await this.removeNotificationContext(event)
      case NotificationEventType.UpdateNotificationContext:
        return await this.updateNotificationContext(event)
    }
  }

  private async addCollaborators (event: Enriched<AddCollaboratorsEvent>): Promise<Result> {
    const added = await this.db.addCollaborators(event.cardId, event.cardType, event.collaborators, event.date)

    if (added.length === 0) return { skipPropagate: true }
    return {}
  }

  private async removeCollaborators (event: Enriched<RemoveCollaboratorsEvent>): Promise<Result> {
    if (event.collaborators.length === 0) return { skipPropagate: true }
    await this.db.removeCollaborators({ cardId: event.cardId, account: event.collaborators })

    return {}
  }

  private async createMessage (event: Enriched<CreateMessageEvent>): Promise<Result> {
    // if (event.messageId == null) {
    //   throw new Error('Message id is required')
    // }
    //
    // const created = await this.db.createMessageMeta(
    //   event.cardId,
    //   event.messageId,
    //   event.messageType,
    //   event.content,
    //   event.extra,
    //   event.socialId,
    //   event.date
    // )
    //
    // if (!created) {
    //   return {
    //     skipPropagate: true,
    //     result: {
    //       messageId: event.messageId,
    //       created: event.date
    //     }
    //   }
    // }
    //
    // return {
    //   result: {
    //     messageId: event.messageId,
    //     created: event.date
    //   }
    // }
    return {}
  }

  private async createPatch (
    cardId: CardID,
    messageId: MessageID,
    type: PatchType,
    data: Record<string, any>,
    socialId: SocialID,
    date: Date
  ): Promise<void> {
    // await this.db.createPatch(cardId, messageId, type, data, socialId, date)
  }

  private async updatePatch (event: Enriched<UpdatePatchEvent>): Promise<Result> {
    const data: UpdatePatchData = {
      content: event.content,
      extra: event.extra
    }
    await this.createPatch(event.cardId, event.messageId, PatchType.update, data, event.socialId, event.date)

    return {}
  }

  private async removePatch (event: Enriched<RemovePatchEvent>): Promise<Result> {
    await this.createPatch(event.cardId, event.messageId, PatchType.remove, {}, event.socialId, event.date)
    return {}
  }

  private async reactionPatch (event: Enriched<ReactionPatchEvent>): Promise<Result> {
    // const { operation } = event
    //
    // if (operation.opcode === 'add') {
    //   await this.db.addReaction(event.cardId, event.messageId, operation.reaction, event.socialId, event.date)
    // } else if (operation.opcode === 'remove') {
    //   await this.db.removeReaction(event.cardId, event.messageId, operation.reaction, event.socialId, event.date)
    // }

    return {}
  }

  private async blobPatch (event: Enriched<BlobPatchEvent>): Promise<Result> {
    const { operations } = event

    for (const operation of operations) {
      if (operation.opcode === 'attach') {
        await this.db.addAttachments(
          event.cardId,
          event.messageId,
          operation.blobs.map((b) => ({
            id: b.blobId as any as AttachmentID,
            type: b.mimeType,
            params: b
          })),
          event.socialId,
          event.date
        )
      } else if (operation.opcode === 'detach') {
        await this.db.removeAttachments(event.cardId, event.messageId, operation.blobIds as any as AttachmentID[])
      } else if (operation.opcode === 'set') {
        await this.db.setAttachments(
          event.cardId,
          event.messageId,
          operation.blobs.map((b) => ({
            id: b.blobId as any as AttachmentID,
            type: b.mimeType,
            params: b
          })),
          event.socialId,
          event.date
        )
      } else if (operation.opcode === 'update') {
        await this.db.updateAttachments(
          event.cardId,
          event.messageId,
          operation.blobs.map((b) => ({
            id: b.blobId as any as AttachmentID,
            params: {
              ...b
            }
          })),
          event.date
        )
      }
    }

    return {}
  }

  private async attachmentPatch (event: Enriched<AttachmentPatchEvent>): Promise<Result> {
    const { operations } = event

    for (const operation of operations) {
      if (operation.opcode === 'add') {
        await this.db.addAttachments(event.cardId, event.messageId, operation.attachments, event.socialId, event.date)
      } else if (operation.opcode === 'remove') {
        await this.db.removeAttachments(event.cardId, event.messageId, operation.ids)
      } else if (operation.opcode === 'set') {
        await this.db.setAttachments(event.cardId, event.messageId, operation.attachments, event.socialId, event.date)
      } else if (operation.opcode === 'update') {
        await this.db.updateAttachments(event.cardId, event.messageId, operation.attachments, event.date)
      }
    }

    return {}
  }

  private async threadPatch (event: Enriched<ThreadPatchEvent>): Promise<Result> {
    if (event.operation.opcode === 'attach') {
      await this.db.attachThread(
        event.cardId,
        event.messageId,
        event.operation.threadId,
        event.operation.threadType,
        event.socialId,
        event.date
      )
    } else if (event.operation.opcode === 'update') {
      await this.db.updateThread(
        {
          cardId: event.cardId,
          messageId: event.messageId,
          threadId: event.operation.threadId
        },
        event.operation.updates
      )
    }

    return {}
  }

  private async createNotification (event: Enriched<CreateNotificationEvent>): Promise<Result> {
    const id = await this.db.createNotification(
      event.contextId,
      event.messageId,
      event.messageCreated,
      event.notificationType,
      event.read ?? false,
      event.content,
      event.date
    )

    event.notificationId = id

    return {}
  }

  private async updateNotification (event: Enriched<UpdateNotificationEvent>): Promise<Result> {
    const updated = await this.db.updateNotification(
      {
        contextId: event.contextId,
        account: event.account,
        ...event.query
      },
      event.updates
    )
    if (updated === 0) return { skipPropagate: true }
    event.updated = updated
    return {}
  }

  private async removeNotifications (event: Enriched<RemoveNotificationsEvent>): Promise<Result> {
    if (event.ids.length === 0) return { skipPropagate: true }
    const ids = await this.db.removeNotifications({
      contextId: event.contextId,
      account: event.account,
      id: event.ids
    })
    event.ids = ids
    return {
      result: {
        ids
      }
    }
  }

  private async createNotificationContext (event: Enriched<CreateNotificationContextEvent>): Promise<Result> {
    const id = await this.db.createNotificationContext(
      event.account,
      event.cardId,
      event.lastUpdate,
      event.lastView,
      event.lastNotify
    )

    event.contextId = id
    return {
      result: { id }
    }
  }

  private async removeNotificationContext (event: Enriched<RemoveNotificationContextEvent>): Promise<Result> {
    const context = (await this.db.findNotificationContexts({ id: event.contextId, account: event.account }))[0]
    if (context == null) return { skipPropagate: true }

    this.context.removedContexts.set(context.id, context)

    const id = await this.db.removeContext({
      id: context.id,
      account: context.account
    })
    if (id == null) return { skipPropagate: true }
    return {}
  }

  async updateNotificationContext (event: Enriched<UpdateNotificationContextEvent>): Promise<Result> {
    await this.db.updateContext(
      {
        id: event.contextId,
        account: event.account
      },
      event.updates
    )

    return {}
  }

  async createMessagesGroup (event: Enriched<CreateMessagesGroupEvent>): Promise<Result> {
    const { fromDate, toDate, count, cardId, blobId } = event.group
    await this.db.createMessagesGroup(cardId, blobId, fromDate, toDate, count)

    return {}
  }

  async removeMessagesGroup (event: Enriched<RemoveMessagesGroupEvent>): Promise<Result> {
    await this.db.removeMessagesGroup(event.cardId, event.blobId)

    return {}
  }

  private async createLabel (event: Enriched<CreateLabelEvent>): Promise<Result> {
    await this.db.createLabel(event.cardId, event.cardType, event.labelId, event.account, event.date)

    return {}
  }

  private async removeLabel (event: Enriched<RemoveLabelEvent>): Promise<Result> {
    await this.db.removeLabels({
      labelId: event.labelId,
      cardId: event.cardId,
      account: event.account
    })

    return {}
  }

  private async createPeer (event: Enriched<CreatePeerEvent>): Promise<Result> {
    await this.db.createPeer(event.workspaceId, event.cardId, event.kind, event.value, event.extra ?? {}, event.date)
    return {}
  }

  private async removePeer (event: Enriched<RemovePeerEvent>): Promise<Result> {
    await this.db.removePeer(event.workspaceId, event.cardId, event.kind, event.value)
    return {}
  }

  private async updateCardType (event: Enriched<UpdateCardTypeEvent>): Promise<Result> {
    return {}
  }

  private async removeCard (event: Enriched<RemoveCardEvent>): Promise<Result> {
    return {}
  }

  close (): void {
    this.db.close()
  }
}
