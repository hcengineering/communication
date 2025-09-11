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
  type EventResult,
  MessageEventType,
  NotificationEventType,
  type Event,
  type SessionData,
  PeerEventType
} from '@hcengineering/communication-sdk-types'
import {
  type Collaborator,
  type FindCollaboratorsParams,
  type FindLabelsParams,
  type FindMessagesGroupsParams,
  type FindMessagesParams,
  type FindNotificationContextParams,
  type FindNotificationsParams,
  type Label,
  type Message,
  type MessagesGroup,
  type Notification,
  type NotificationContext,
  SortingOrder
} from '@hcengineering/communication-types'
import { z } from 'zod'

import type { Enriched, Middleware, QueryId } from '../types'
import { BaseMiddleware } from './base'
import { ApiError } from '../error'
import { isBlobAttachmentType, isLinkPreviewAttachmentType } from '@hcengineering/communication-shared'

export class ValidateMiddleware extends BaseMiddleware implements Middleware {
  private validate<T>(data: unknown, schema: z.ZodType<T>): T {
    const validationResult = schema.safeParse(data)
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => err.message)
      this.context.ctx.error(validationResult.error.message, data as any)
      throw ApiError.badRequest(errors.join(', '))
    }
    return validationResult.data
  }

  async findMessages (session: SessionData, params: FindMessagesParams, queryId?: QueryId): Promise<Message[]> {
    this.validate(params, FindMessagesParamsSchema)
    return await this.provideFindMessages(session, params, queryId)
  }

  async findMessagesGroups (
    session: SessionData,
    params: FindMessagesGroupsParams,
    queryId?: QueryId
  ): Promise<MessagesGroup[]> {
    this.validate(params, FindMessagesGroupsParamsSchema)
    return await this.provideFindMessagesGroups(session, params, queryId)
  }

  async findNotificationContexts (
    session: SessionData,
    params: FindNotificationContextParams,
    queryId?: QueryId
  ): Promise<NotificationContext[]> {
    this.validate(params, FindNotificationContextParamsSchema)
    return await this.provideFindNotificationContexts(session, params, queryId)
  }

  async findNotifications (
    session: SessionData,
    params: FindNotificationsParams,
    queryId?: QueryId
  ): Promise<Notification[]> {
    this.validate(params, FindNotificationsParamsSchema)
    return await this.provideFindNotifications(session, params, queryId)
  }

  async findLabels (session: SessionData, params: FindLabelsParams, queryId?: QueryId): Promise<Label[]> {
    this.validate(params, FindLabelsParamsSchema)
    return await this.provideFindLabels(session, params, queryId)
  }

  async findCollaborators (session: SessionData, params: FindCollaboratorsParams): Promise<Collaborator[]> {
    this.validate(params, FindCollaboratorsParamsSchema)
    return await this.provideFindCollaborators(session, params)
  }

  async event (session: SessionData, event: Enriched<Event>, derived: boolean): Promise<EventResult> {
    if (derived) return await this.provideEvent(session, event, derived)
    switch (event.type) {
      case MessageEventType.CreateMessage:
        this.validate(event, CreateMessageEventSchema)
        break
      case MessageEventType.UpdatePatch:
        this.validate(event, UpdatePatchEventSchema)
        break
      case MessageEventType.RemovePatch:
        this.validate(event, RemovePatchEventSchema)
        break
      case MessageEventType.ReactionPatch:
        this.validate(event, ReactionPatchEventSchema)
        break
      case MessageEventType.BlobPatch:
        this.validate(event, BlobPatchEventSchema)
        break
      case MessageEventType.AttachmentPatch:
        this.validate(event, AttachmentPatchEventSchema)
        event.operations.forEach((op) => {
          if (op.opcode === 'add' || op.opcode === 'set') {
            op.attachments.forEach((att) => {
              if (isLinkPreviewAttachmentType(att.type)) {
                this.validate(att.params, LinkPreviewParamsSchema)
              } else if (isBlobAttachmentType(att.type)) {
                this.validate(att.params, BlobParamsSchema)
              }
            })
          }
        })
        break
      case MessageEventType.ThreadPatch:
        this.validate(event, ThreadPatchEventSchema)
        break
      case MessageEventType.CreateMessagesGroup:
        this.validate(event, CreateMessagesGroupEventSchema)
        break
      case MessageEventType.RemoveMessagesGroup:
        this.validate(event, RemoveMessagesGroupEventSchema)
        break
      case NotificationEventType.AddCollaborators:
        this.validate(event, AddCollaboratorsEventSchema)
        break
      case NotificationEventType.RemoveCollaborators:
        this.validate(event, RemoveCollaboratorsEventSchema)
        break
      case NotificationEventType.UpdateNotification:
        this.validate(event, UpdateNotificationsEventSchema)
        break
      case NotificationEventType.RemoveNotificationContext:
        this.validate(event, RemoveNotificationContextEventSchema)
        break
      case NotificationEventType.UpdateNotificationContext:
        this.validate(event, UpdateNotificationContextEventSchema)
        break
      case PeerEventType.CreatePeer:
        this.validate(event, CreatePeerEventSchema)
        break
      case PeerEventType.RemovePeer:
        this.validate(event, RemovePeerEventSchema)
        break
    }
    return await this.provideEvent(session, deserializeEvent(event), derived)
  }
}

const WorkspaceUuidSchema = z.string().uuid()
const AccountUuidSchema = z.string()
const BlobIDSchema = z.string().uuid()
const AttachmentIDSchema = z.string().uuid()
const CardIDSchema = z.string()
const CardTypeSchema = z.string()
const ContextIDSchema = z.string()
const DateSchema = z.coerce.date()
const LabelIDSchema = z.string()
const MarkdownSchema = z.string()
const MessageExtraSchema = z.any()
const MessageIDSchema = z.string()
const MessageTypeSchema = z.string()
const SocialIDSchema = z.string()
const SortingOrderSchema = z.union([z.literal(SortingOrder.Ascending), z.literal(SortingOrder.Descending)])

const BlobParamsSchema = z.object({
  blobId: BlobIDSchema,
  mimeType: z.string(),
  fileName: z.string(),
  size: z.number(),
  metadata: z.record(z.string(), z.any()).optional()
})

const LinkPreviewParamsSchema = z
  .object({
    url: z.string(),
    host: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
    siteName: z.string().optional(),
    iconUrl: z.string().optional(),
    previewImage: z
      .object({
        url: z.string(),
        width: z.number().optional(),
        height: z.number().optional()
      })
      .optional()
  })
  .strict()

const UpdateBlobDataSchema = z.object({
  blobId: BlobIDSchema,
  mimeType: z.string().optional(),
  fileName: z.string().optional(),
  size: z.number().optional(),
  metadata: z.record(z.string(), z.any()).optional()
})

const AttachmentDataSchema = z.object({
  id: AttachmentIDSchema,
  type: z.string(),
  params: z.record(z.string(), z.any())
})

const AttachmentUpdateDataSchema = z.object({
  id: AttachmentIDSchema,
  params: z.record(z.string(), z.any())
})

// Find params
const DateOrRecordSchema = z.union([DateSchema, z.record(DateSchema)])

const FindParamsSchema = z
  .object({
    order: SortingOrderSchema.optional(),
    limit: z.number().optional()
  })
  .strict()

const FindMessagesParamsSchema = FindParamsSchema.extend({
  id: MessageIDSchema.optional(),
  cardId: CardIDSchema.optional(),
  created: DateOrRecordSchema.optional()
}).strict()

const FindMessagesGroupsParamsSchema = FindParamsSchema.extend({
  messageId: MessageIDSchema.optional(),
  cardId: CardIDSchema.optional(),
  blobId: BlobIDSchema.optional(),
  fromDate: DateOrRecordSchema.optional(),
  toDate: DateOrRecordSchema.optional(),
  orderBy: z.enum(['fromDate', 'toDate']).optional()
}).strict()

const FindNotificationContextParamsSchema = FindParamsSchema.extend({
  id: ContextIDSchema.optional(),
  cardId: z.union([CardIDSchema, z.array(CardIDSchema)]).optional(),
  lastNotify: DateOrRecordSchema.optional(),
  account: z.union([AccountUuidSchema, z.array(AccountUuidSchema)]).optional(),
  notifications: z
    .object({
      type: z.string().optional(),
      message: z.boolean().optional(), // TODO: remove ??
      limit: z.number(),
      order: SortingOrderSchema,
      read: z.boolean().optional(),
      total: z.boolean().optional()
    })
    .optional()
}).strict()

const FindNotificationsParamsSchema = FindParamsSchema.extend({
  contextId: ContextIDSchema.optional(),
  type: z.string().optional(),
  read: z.boolean().optional(),
  created: DateOrRecordSchema.optional(),
  account: z.union([AccountUuidSchema, z.array(AccountUuidSchema)]).optional(),
  message: z.boolean().optional(), // TODO: remove ??
  cardId: CardIDSchema.optional(),
  total: z.boolean().optional()
}).strict()

const FindLabelsParamsSchema = FindParamsSchema.extend({
  labelId: z.union([LabelIDSchema, z.array(LabelIDSchema)]).optional(),
  cardId: CardIDSchema.optional(),
  cardType: z.union([CardTypeSchema, z.array(CardTypeSchema)]).optional(),
  account: AccountUuidSchema.optional()
}).strict()

const FindCollaboratorsParamsSchema = FindParamsSchema.extend({
  cardId: CardIDSchema.optional(),
  account: z.union([AccountUuidSchema, z.array(AccountUuidSchema)]).optional()
}).strict()

// Events

const BaseEventSchema = z
  .object({
    _id: z.string().optional(),
    _eventExtra: z.record(z.any()).optional()
  })
  .strict()

// Message events
const CreateMessageEventSchema = BaseEventSchema.extend({
  type: z.literal(MessageEventType.CreateMessage),

  cardId: CardIDSchema,
  cardType: CardTypeSchema,

  messageId: MessageIDSchema.max(22).optional(),
  messageType: MessageTypeSchema,

  content: MarkdownSchema,
  extra: MessageExtraSchema.optional(),

  socialId: SocialIDSchema,
  date: DateSchema,

  options: z
    .object({
      skipLinkPreviews: z.boolean().optional(),
      noNotify: z.boolean().optional()
    })
    .optional()
}).strict()

const UpdatePatchEventSchema = BaseEventSchema.extend({
  type: z.literal(MessageEventType.UpdatePatch),
  cardId: CardIDSchema,
  messageId: MessageIDSchema.optional(),

  content: MarkdownSchema.optional(),
  extra: z.record(z.any()).optional(),

  socialId: SocialIDSchema,
  date: DateSchema,

  options: z
    .object({
      skipLinkPreviewsUpdate: z.boolean().optional()
    })
    .optional()
}).strict()

const RemovePatchEventSchema = BaseEventSchema.extend({
  type: z.literal(MessageEventType.RemovePatch),
  cardId: CardIDSchema,
  messageId: MessageIDSchema.optional(),

  socialId: SocialIDSchema,
  date: DateSchema
}).strict()

const ReactionOperationSchema = z.union([
  z.object({ opcode: z.literal('add'), reaction: z.string() }),
  z.object({ opcode: z.literal('remove'), reaction: z.string() })
])

const ReactionPatchEventSchema = BaseEventSchema.extend({
  type: z.literal(MessageEventType.ReactionPatch),
  cardId: CardIDSchema,
  messageId: MessageIDSchema,
  operation: ReactionOperationSchema,
  socialId: SocialIDSchema,
  date: DateSchema
}).strict()

/**
 * @deprecated
 */
const BlobOperationSchema = z.union([
  z.object({ opcode: z.literal('attach'), blobs: z.array(BlobParamsSchema).nonempty() }),
  z.object({ opcode: z.literal('detach'), blobIds: z.array(BlobIDSchema).nonempty() }),
  z.object({ opcode: z.literal('set'), blobs: z.array(BlobParamsSchema).nonempty() }),
  z.object({ opcode: z.literal('update'), blobs: z.array(UpdateBlobDataSchema).nonempty() })
])

/**
 * @deprecated
 */
const BlobPatchEventSchema = BaseEventSchema.extend({
  type: z.literal(MessageEventType.BlobPatch),
  cardId: CardIDSchema,
  messageId: MessageIDSchema,
  operations: z.array(BlobOperationSchema).nonempty(),
  socialId: SocialIDSchema,
  date: DateSchema
}).strict()

const AttachmentOperationSchema = z.union([
  z.object({ opcode: z.literal('add'), attachments: z.array(AttachmentDataSchema).nonempty() }),
  z.object({ opcode: z.literal('remove'), ids: z.array(AttachmentIDSchema).nonempty() }),
  z.object({ opcode: z.literal('set'), attachments: z.array(AttachmentDataSchema).nonempty() }),
  z.object({ opcode: z.literal('update'), attachments: z.array(AttachmentUpdateDataSchema).nonempty() })
])

const AttachmentPatchEventSchema = BaseEventSchema.extend({
  type: z.literal(MessageEventType.AttachmentPatch),
  cardId: CardIDSchema,
  messageId: MessageIDSchema,
  operations: z.array(AttachmentOperationSchema).nonempty(),
  socialId: SocialIDSchema,
  date: DateSchema
}).strict()

const ThreadPatchEventSchema = BaseEventSchema.extend({
  type: z.literal(MessageEventType.ThreadPatch),
  cardId: CardIDSchema,
  messageId: MessageIDSchema,
  operation: z.object({ opcode: z.literal('attach'), threadId: CardIDSchema, threadType: CardTypeSchema }),
  socialId: SocialIDSchema,
  date: DateSchema
}).strict()

const CreateMessagesGroupEventSchema = BaseEventSchema.extend({
  type: z.literal(MessageEventType.CreateMessagesGroup),
  group: z.any(), // TODO: MessagesGroupSchema
  socialId: SocialIDSchema,
  date: DateSchema
}).strict()

const RemoveMessagesGroupEventSchema = BaseEventSchema.extend({
  type: z.literal(MessageEventType.RemoveMessagesGroup),
  cardId: CardIDSchema,
  blobId: BlobIDSchema,
  socialId: SocialIDSchema,
  date: DateSchema
}).strict()

// Notification events
const UpdateNotificationsEventSchema = BaseEventSchema.extend({
  type: z.literal(NotificationEventType.UpdateNotification),
  contextId: ContextIDSchema,
  account: AccountUuidSchema,
  query: z.object({
    id: z.string().optional(),
    type: z.string().optional(),
    untilDate: DateSchema.optional()
  }),
  updates: z.object({
    read: z.boolean()
  }),
  date: DateSchema
}).strict()

const RemoveNotificationContextEventSchema = BaseEventSchema.extend({
  type: z.literal(NotificationEventType.RemoveNotificationContext),
  contextId: ContextIDSchema,
  account: AccountUuidSchema,
  date: DateSchema
}).strict()

const UpdateNotificationContextEventSchema = BaseEventSchema.extend({
  type: z.literal(NotificationEventType.UpdateNotificationContext),
  contextId: ContextIDSchema,
  account: AccountUuidSchema,
  updates: z.object({
    lastView: DateSchema.optional()
  }),
  date: DateSchema
}).strict()

const AddCollaboratorsEventSchema = BaseEventSchema.extend({
  type: z.literal(NotificationEventType.AddCollaborators),
  cardId: CardIDSchema,
  cardType: CardTypeSchema,
  collaborators: z.array(AccountUuidSchema).nonempty(),
  socialId: SocialIDSchema,
  date: DateSchema
}).strict()

const RemoveCollaboratorsEventSchema = BaseEventSchema.extend({
  type: z.literal(NotificationEventType.RemoveCollaborators),
  cardId: CardIDSchema,
  cardType: CardTypeSchema,
  collaborators: z.array(AccountUuidSchema).nonempty(),
  socialId: SocialIDSchema,
  date: DateSchema
}).strict()

const CreatePeerEventSchema = BaseEventSchema.extend({
  type: z.literal(PeerEventType.CreatePeer),
  workspaceId: WorkspaceUuidSchema,
  cardId: CardIDSchema,
  kind: z.string().nonempty(),
  value: z.string().nonempty(),
  extra: z.record(z.any()).optional(),
  date: DateSchema
}).strict()

const RemovePeerEventSchema = BaseEventSchema.extend({
  type: z.literal(PeerEventType.RemovePeer),
  workspaceId: WorkspaceUuidSchema,
  cardId: CardIDSchema,
  kind: z.string().nonempty(),
  value: z.string().nonempty(),
  date: DateSchema
}).strict()

function deserializeEvent (event: Enriched<Event>): Enriched<Event> {
  switch (event.type) {
    case MessageEventType.CreateMessagesGroup:
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      event.group.fromDate = deserializeDate(event.group.fromDate)!
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      event.group.toDate = deserializeDate(event.group.toDate)!
      break
    case NotificationEventType.UpdateNotificationContext:
      event.updates.lastView = deserializeDate(event.updates.lastView)
      break
    case NotificationEventType.UpdateNotification:
      event.query.untilDate = deserializeDate(event.query.untilDate)
      break
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  event.date = deserializeDate(event.date)!
  return event
}

function deserializeDate (date?: Date | string | undefined | null): Date | undefined {
  if (date == null) return undefined
  if (date instanceof Date) return date
  return new Date(date)
}
