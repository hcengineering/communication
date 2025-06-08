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
  type BlobAttachedEvent,
  type BlobDetachedEvent,
  type MessageCreatedEvent,
  MessageRequestEventType,
  MessageResponseEventType,
  type MessagesGroupCreatedEvent,
  NotificationRequestEventType,
  type PatchCreatedEvent,
  type RequestEvent,
  type ThreadAttachedEvent
} from '@hcengineering/communication-sdk-types'
import {
  type AttachBlobPatchData,
  type CardID,
  type Message,
  MessageType,
  PatchType
} from '@hcengineering/communication-types'
import { generateToken } from '@hcengineering/server-token'
import { type AccountUuid, concatLink, systemAccountUuid } from '@hcengineering/core'
import { generateMessageId } from '@hcengineering/communication-shared'
import { extractReferences } from '@hcengineering/text-core'
import { markdownToMarkup } from '@hcengineering/text-markdown'

import type { TriggerCtx, TriggerFn, Triggers } from '../types'
import { findAccount } from '../utils'
import { findMessageInFiles } from './utils'

async function onMessagesGroupCreated(ctx: TriggerCtx, event: MessagesGroupCreatedEvent): Promise<RequestEvent[]> {
  ctx.registeredCards.delete(event.group.cardId)
  return []
}

async function onMessagesRemoved(ctx: TriggerCtx, event: PatchCreatedEvent): Promise<RequestEvent[]> {
  const { cardId, patch } = event
  if (patch.type !== PatchType.remove) return []
  const thread = await ctx.db.findThread(cardId)
  if (thread === undefined) return []

  const socialId = ctx.account.primarySocialId
  const result: RequestEvent[] = []

  result.push({
    type: MessageRequestEventType.CreatePatch,
    patchType: PatchType.updateThread,
    cardId: thread.cardId,
    messageId: thread.messageId,
    data: { thread: thread.threadId, threadType: thread.threadType, replies: 'decrement' },
    socialId,
    date: new Date()
  })

  result.push({
    type: MessageRequestEventType.UpdateThread,
    cardId: thread.cardId,
    messageId: thread.messageId,
    threadId: thread.threadId,
    updates: {
      repliesCountOp: 'decrement'
    },
    date: new Date(),
    socialId
  })

  return result
}

// async function onBlobAttached(ctx: TriggerCtx, event: BlobAttachedEvent): Promise<RequestEvent[]> {
//   const message = (await ctx.db.findMessages({ card: event.cardId, id: event.messageId, limit: 1 }))[0]
//   if (message !== undefined) return []
//
//   const { blob } = event
//   const patchData: AttachBlobPatchData = {
//     blobId: file.blobId,
//     type: file.type,
//     filename: file.filename,
//     size: file.size
//   }
//
//   return [
//     {
//       type: MessageRequestEventType.CreatePatch,
//       patchType: PatchType.addFile,
//       card: event.card,
//       message: event.message,
//       messageCreated: event.messageCreated,
//       data: patchData,
//       creator: file.creator
//     }
//   ]
// }

// async function onFileRemoved(ctx: TriggerCtx, event: BlobDetachedEvent): Promise<RequestEvent[]> {
//   const message = (await ctx.db.findMessages({ card: event.card, id: event.message, limit: 1 }))[0]
//   if (message !== undefined) return []
//   const { blobId } = event
//
//   return [
//     {
//       type: MessageRequestEventType.CreatePatch,
//       patchType: PatchType.removeFile,
//       card: event.card,
//       message: event.message,
//       messageCreated: event.messageCreated,
//       data: { blobId },
//       creator: event.creator
//     }
//   ]
// }

async function registerCard (ctx: TriggerCtx, event: MessageCreatedEvent | PatchCreatedEvent): Promise<RequestEvent[]> {
  const { workspace, metadata } = ctx
  let card: CardID = event.cardId

  if (ctx.registeredCards.has(card) || metadata.msg2fileUrl === '') return []

  try {
    const token = generateToken(systemAccountUuid, workspace, undefined, ctx.metadata.secret)
    await fetch(concatLink(metadata.msg2fileUrl, '/register/:card').replaceAll(':card', card), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      }
    })
    ctx.registeredCards.add(card)
  } catch (e) {
    ctx.ctx.error('Failed to register card', { error: e })
  }

  return []
}

async function addCollaborators (ctx: TriggerCtx, event: MessageCreatedEvent): Promise<RequestEvent[]> {
  const { creator, type } = event.message
  if (type === MessageType.Activity) return []
  const account = await findAccount(ctx, creator)
  const collaborators: AccountUuid[] = []

  if (account !== undefined) {
    collaborators.push(account)
  }

  const markup = markdownToMarkup(event.message.content)
  const references = extractReferences(markup)
  const personIds = references
    .filter((it) => ['contact:class:Person', 'contact:mixin:Employee'].includes(it.objectClass))
    .map((it) => it.objectId)
    .filter((it) => it != null) as string[]
  const accounts = await ctx.db.getAccountsByPersonIds(personIds)

  collaborators.push(...accounts)

  if (collaborators.length === 0) {
    return []
  }

  return [
    {
      type: NotificationRequestEventType.AddCollaborators,
      cardId: event.message.cardId,
      cardType: event.cardType,
      collaborators,
      socialId: event.message.creator,
      date: new Date(event.message.created.getTime() - 1)
    }
  ]
}

async function addThreadReply (ctx: TriggerCtx, event: MessageCreatedEvent): Promise<RequestEvent[]> {
  if (event.message.type !== MessageType.Message || ctx.derived) return []
  const { message } = event
  const thread = await ctx.db.findThread(message.cardId)
  if (thread === undefined) return []

  return [
    // {
    //   type: MessageRequestEventType.CreatePatch,
    //   patchType: PatchType.updateThread,
    //   cardId: thread.cardId,
    //   messageId: thread.messageId,
    //   messageCreated: thread.messageCreated,
    //   data: { thread: thread.thread, threadType: thread.threadType, replies: 'increment' },
    //   creator: message.creator
    // },
    {
      type: MessageRequestEventType.UpdateThread,
      cardId: thread.cardId,
      messageId: thread.messageId,
      threadId: thread.threadId,
      updates: {
        lastReply: message.created,
        repliesCountOp: 'increment'
      },
      socialId: event.message.creator,
      date: message.created
    }
  ]
}

async function onThreadCreated(ctx: TriggerCtx, event: ThreadAttachedEvent): Promise<RequestEvent[]> {
  let message: Message | undefined = (
    await ctx.db.findMessages({
      card: event.thread.cardId,
      id: event.thread.messageId,
      limit: 1,
      files: true,
      reactions: true
    })
  )[0]

  const result: RequestEvent[] = []

  // if (message === undefined) {
  //   message = await findMessageInFiles(
  //     ctx.db,
  //     ctx.metadata.filesUrl,
  //     ctx.workspace,
  //     event.thread.cardId,
  //     event.thread.messageId,
  //     event.thread.messageCreated
  //   )
  //
  //   if (message !== undefined) {
  //     result.push({
  //       type: MessageRequestEventType.CreatePatch,
  //       patchType: PatchType.updateThread,
  //       card: event.thread.card,
  //       message: event.thread.message,
  //       messageCreated: event.thread.messageCreated,
  //       data: { thread: event.thread.thread, threadType: event.thread.threadType },
  //       creator: message.creator
  //     })
  //   }
  // }

  if (message === undefined || message.type === MessageType.Message) {
    return []
  }

  // result.push({
  //   type: MessageRequestEventType.CreatePatch,
  //   patchType: PatchType.update,
  //   cardId: event.thread.cardId,
  //   messageId: event.thread.messageId,
  //   messageCreated: event.thread.messageCreated,
  //   data: { type: MessageType.Thread },
  //   creator: message.creator
  // })

  // const messageId = generateMessageId()
  // result.push({
  //   type: MessageRequestEventType.CreateMessage,
  //   messageType: MessageType.ThreadRoot,
  //   card: event.thread.thread,
  //   cardType: event.thread.threadType,
  //   content: message.content,
  //   creator: message.creator,
  //   data: message.data,
  //   externalId: message.externalId,
  //   created: message.created,
  //   id: messageId
  // })
  //
  // for (const file of message.files) {
  //   result.push({
  //     type: MessageRequestEventType.CreateFile,
  //     card: event.thread.thread,
  //     message: messageId,
  //     messageCreated: message.created,
  //     data: {
  //       blobId: file.blobId,
  //       type: file.type,
  //       filename: file.filename,
  //       size: file.size,
  //       meta: file.meta
  //     },
  //     creator: file.creator
  //   })
  // }

  return result
}

const triggers: Triggers = [
  ['add_collaborators_on_message_created', MessageResponseEventType.MessageCreated, addCollaborators as TriggerFn],
  ['add_thread_reply_on_message_created', MessageResponseEventType.MessageCreated, addThreadReply as TriggerFn],
  ['register_card_on_message_created', MessageResponseEventType.MessageCreated, registerCard as TriggerFn],
  ['register_card_on_patch_created', MessageResponseEventType.PatchCreated, registerCard as TriggerFn],
  ['on_messages_group_created', MessageResponseEventType.MessagesGroupCreated, onMessagesGroupCreated as TriggerFn],
  ['remove_reply_on_messages_removed', MessageResponseEventType.PatchCreated, onMessagesRemoved as TriggerFn]
  // ['on_file_created', MessageResponseEventType.FileCreated, onBlobAttached as TriggerFn],
  // ['on_file_removed', MessageResponseEventType.FileRemoved, onFileRemoved as TriggerFn],
  // ['on_thread_created', MessageResponseEventType.ThreadCreated, onThreadCreated as TriggerFn]
]

export default triggers
