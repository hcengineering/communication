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
  BlobID,
  type CardID,
  type FindNotificationContextParams,
  FindNotificationsParams,
  type Message,
  type MessageID,
  type Notification,
  type NotificationContext,
  NotificationType,
  ParsedFile,
  PatchType,
  SortingOrder,
  type WorkspaceID
} from '@hcengineering/communication-types'
import {
  CardEventType,
  CreateNotificationContextEvent,
  CreateNotificationEvent,
  type Event,
  type FindClient,
  MessageEventType,
  NotificationEventType,
  type PagedQueryCallback,
  PatchEvent,
  RemoveCardEvent,
  RemoveNotificationContextEvent,
  RemoveNotificationsEvent,
  UpdateNotificationContextEvent,
  UpdateNotificationEvent
} from '@hcengineering/communication-sdk-types'
import {
  applyPatches,
  MessageProcessor,
  NotificationContextProcessor,
  NotificationProcessor
} from '@hcengineering/communication-shared'

import { defaultQueryParams, type PagedQuery, type QueryId } from '../types'
import { QueryResult } from '../result'
import { WindowImpl } from '../window'
import { findMessage, loadMessageFromGroup, matchNotification } from '../utils'

const allowedPatchTypes = [PatchType.update, PatchType.remove, PatchType.blob]
export class NotificationContextsQuery implements PagedQuery<NotificationContext, FindNotificationContextParams> {
  private result: QueryResult<NotificationContext> | Promise<QueryResult<NotificationContext>>
  private forward: Promise<{ isDone: boolean }> | { isDone: boolean } = { isDone: false }
  private backward: Promise<{ isDone: boolean }> | { isDone: boolean } = { isDone: false }

  nexLoadedPagesCount = 0
  prevLoadedPagesCount = 0

  constructor (
    private readonly client: FindClient,
    private readonly workspace: WorkspaceID,
    private readonly filesUrl: string,
    public readonly id: QueryId,
    public readonly params: FindNotificationContextParams,
    private callback?: PagedQueryCallback<NotificationContext>,
    initialResult?: QueryResult<NotificationContext>
  ) {
    this.params = {
      ...params,
      limit: params.limit,
      order: params.order ?? defaultQueryParams.order
    }

    if (initialResult !== undefined) {
      this.result = initialResult
      void this.notify()
    } else {
      this.result = this.initResult()
      void this.result.then(() => {
        void this.notify()
      })
    }
  }

  private async rawInitResult (): Promise<QueryResult<NotificationContext>> {
    const limit = this.params.limit != null ? this.params.limit + 1 : undefined
    const findParams: FindNotificationContextParams = {
      ...this.params,
      order: this.params.order ?? defaultQueryParams.order,
      limit
    }

    const res = await this.find(findParams)
    const isComplete = limit == null || res.length < limit
    if (!isComplete) res.pop()

    const isTail = isComplete || (this.params.lastNotify == null && this.params.order === SortingOrder.Descending)
    const isHead = isComplete || (this.params.lastNotify == null && this.params.order === SortingOrder.Ascending)

    const result = new QueryResult(res, (it) => it.id)
    result.setTail(isTail)
    result.setHead(isHead)

    return result
  }

  private async initResult (): Promise<QueryResult<NotificationContext>> {
    try {
      return await this.rawInitResult()
    } catch (error) {
      console.error('Failed to initialize query:', error)
      return new QueryResult([] as NotificationContext[], (it) => it.id)
    }
  }

  async onEvent (event: Event): Promise<void> {
    switch (event.type) {
      case MessageEventType.BlobPatch:
      case MessageEventType.RemovePatch:
      case MessageEventType.UpdatePatch: {
        await this.onCreatePatchEvent(event)
        break
      }
      case NotificationEventType.CreateNotificationContext: {
        await this.onCreateNotificationContextEvent(event)
        break
      }
      case NotificationEventType.UpdateNotificationContext: {
        await this.onUpdateNotificationContextEvent(event)
        break
      }
      case NotificationEventType.RemoveNotificationContext: {
        await this.onRemoveNotificationContextEvent(event)
        break
      }
      case NotificationEventType.CreateNotification: {
        await this.onCreateNotificationEvent(event)
        break
      }
      case NotificationEventType.RemoveNotifications: {
        await this.onRemoveNotificationEvent(event)
        break
      }
      case NotificationEventType.UpdateNotification: {
        await this.onUpdateNotificationEvent(event)
        break
      }
      case CardEventType.RemoveCard:
        await this.onCardRemoved(event)
        break
    }
  }

  async onRequest (event: Event): Promise<void> {}

  async unsubscribe (): Promise<void> {
    await this.client.unsubscribeQuery(this.id)
  }

  async requestLoadNextPage (notify = true): Promise<{ isDone: boolean }> {
    if (this.result instanceof Promise) this.result = await this.result
    if (this.forward instanceof Promise) this.forward = await this.forward

    if (this.result.isTail()) return { isDone: true }

    const last = this.result.getLast()
    if (last === undefined) return { isDone: false }

    const limit = this.params.limit ?? defaultQueryParams.limit
    const findParams: FindNotificationContextParams = {
      ...this.params,
      lastNotify: {
        greater: last.lastNotify
      },
      limit: limit + 1,
      order: SortingOrder.Ascending
    }

    const forward = this.find(findParams)
    const forwardPromise = forward.then(async (res) => {
      if (this.result instanceof Promise) {
        this.result = await this.result
      }
      const isTail = res.length <= limit
      if (!isTail) {
        res.pop()
      }
      this.result.append(res)
      this.result.setTail(isTail)
      this.nexLoadedPagesCount++

      if (notify) {
        await this.notify()
      }

      return { isDone: isTail }
    })

    this.forward = forwardPromise

    return await forwardPromise
  }

  async requestLoadPrevPage (notify = true): Promise<{ isDone: boolean }> {
    if (this.result instanceof Promise) this.result = await this.result
    if (this.backward instanceof Promise) this.backward = await this.backward

    if (this.result.isHead()) return { isDone: true }

    const first = this.params.order === SortingOrder.Ascending ? this.result.getFirst() : this.result.getLast()
    if (first === undefined) return { isDone: false }

    const limit = this.params.limit ?? defaultQueryParams.limit
    const findParams: FindNotificationContextParams = {
      ...this.params,
      lastNotify: {
        less: first.lastNotify
      },
      limit: limit + 1,
      order: SortingOrder.Descending
    }

    const backward = this.find(findParams)
    const backwardPromise = backward.then(async (res) => {
      if (this.result instanceof Promise) this.result = await this.result

      const isHead = res.length <= limit
      if (!isHead) {
        res.pop()
      }

      if (this.params.order === SortingOrder.Ascending) {
        const reversed = res.reverse()
        this.result.prepend(reversed)
      } else {
        this.result.append(res)
      }
      this.result.setHead(isHead)
      this.prevLoadedPagesCount++
      if (notify) {
        await this.notify()
      }
      return { isDone: isHead }
    })

    this.backward = backwardPromise

    return await backwardPromise
  }

  removeCallback (): void {
    this.callback = () => {}
  }

  setCallback (callback: PagedQueryCallback<NotificationContext>): void {
    this.callback = callback
    void this.notify()
  }

  copyResult (): QueryResult<NotificationContext> | undefined {
    if (this.result instanceof Promise) {
      return undefined
    }

    return this.result.copy()
  }

  async loadGroups (contexts: NotificationContext[]): Promise<NotificationContext[]> {
    const cache = new Map<BlobID, Promise<ParsedFile>>()
    const newContexts = await Promise.all(
      contexts.map(async (context) => {
        const notifications = context.notifications ?? []

        context.notifications = await Promise.all(
          notifications.map(async (notification) => {
            if (notification.message != null || notification.messageId == null || notification.blobId == null) {
              return notification
            }
            const { blobId } = notification
            const message = await loadMessageFromGroup(
              notification.messageId,
              this.workspace,
              this.filesUrl,
              blobId,
              notification.patches,
              cache
            )
            if (message !== undefined) {
              return {
                ...notification,
                message
              }
            }

            return notification
          })
        )
        return context
      })
    )
    cache.clear()
    return newContexts
  }

  private async find (params: FindNotificationContextParams): Promise<NotificationContext[]> {
    const contexts = await this.client.findNotificationContexts(params, this.id)
    if (params.notifications?.message !== true) return contexts

    return await this.loadGroups(contexts)
  }

  private async onCreateNotificationContextEvent (event: CreateNotificationContextEvent): Promise<void> {
    if (event.contextId === undefined) return
    if (this.forward instanceof Promise) this.forward = await this.forward
    if (this.backward instanceof Promise) this.backward = await this.backward
    if (this.result instanceof Promise) this.result = await this.result

    if (this.result.get(event.contextId) !== undefined) {
      return
    }

    const context = NotificationContextProcessor.createFromEvent(event)

    if (!this.match(context)) {
      return
    }

    this.addContext(context, this.result)
    void this.notify()
  }

  private async onCreatePatchEvent (event: PatchEvent): Promise<void> {
    const patches = MessageProcessor.eventToPatches(event).filter((it) => allowedPatchTypes.includes(it.type))
    if (patches.length === 0) return
    const isUpdated = await this.updateMessage(event.cardId, event.messageId, (message) =>
      applyPatches(message, patches, allowedPatchTypes)
    )
    if (isUpdated) {
      void this.notify()
    }
  }

  private async onRemoveNotificationEvent (event: RemoveNotificationsEvent): Promise<void> {
    if (this.params.notifications == null) return
    if (this.forward instanceof Promise) this.forward = await this.forward
    if (this.backward instanceof Promise) this.backward = await this.backward
    if (this.result instanceof Promise) this.result = await this.result

    const context = this.result.get(event.contextId)
    if (context?.notifications === undefined) return

    const filtered = context.notifications.filter((it) => !event.ids.includes(it.id))
    if (filtered.length === context.notifications.length) return
    const limit = this.params.notifications.limit ?? 0

    if (filtered.length < limit && context.notifications.length >= limit) {
      const contextUpdated = (
        await this.find({ id: context.id, limit: 1, notifications: this.params.notifications })
      )[0]
      if (contextUpdated !== undefined) {
        this.result.update(contextUpdated)
      } else {
        this.result.delete(context.id)
      }
    } else {
      this.result.update({
        ...context,
        notifications: filtered
      })
    }
    void this.notify()
  }

  private async onUpdateNotificationEvent (event: UpdateNotificationEvent): Promise<void> {
    if (this.params.notifications == null) return
    if (this.forward instanceof Promise) this.forward = await this.forward
    if (this.backward instanceof Promise) this.backward = await this.backward
    if (this.result instanceof Promise) this.result = await this.result

    const context = this.result.get(event.contextId)
    if (context?.notifications === undefined) return

    let matchQuery: FindNotificationsParams = { ...event.query, context: event.contextId, account: event.account }
    if (event.query.untilDate != null) {
      matchQuery = { ...matchQuery, created: { lessOrEqual: event.query.untilDate } }
    }
    const toUpdate = context.notifications.filter(
      (it) => matchNotification(it, matchQuery) && it.read !== event.updates.read
    )
    if (toUpdate === undefined || (toUpdate?.length ?? 0) === 0) return
    const toUpdateMap = new Map(toUpdate.map((it) => [it.id, it]))
    const currentLength = context.notifications.length ?? 0
    const newNotifications = context.notifications.map((it) =>
      toUpdateMap.has(it.id) ? { ...it, ...event.updates } : it
    )
    const newLength = newNotifications.length

    if (newLength < currentLength && newLength < this.params.notifications.limit) {
      const updated: NotificationContext = (
        await this.find({ id: context.id, limit: 1, notifications: this.params.notifications })
      )[0]
      if (updated !== undefined) {
        this.result.update(updated)
      } else {
        this.result.delete(context.id)
      }
    } else {
      this.result.update({
        ...context,
        notifications: newNotifications
      })
    }
    void this.notify()
  }

  private async onCreateNotificationEvent (event: CreateNotificationEvent): Promise<void> {
    if (this.params.notifications == null || event.notificationId == null) return
    if (this.forward instanceof Promise) this.forward = await this.forward
    if (this.backward instanceof Promise) this.backward = await this.backward
    if (this.result instanceof Promise) this.result = await this.result

    const notification = NotificationProcessor.createFromEvent(event)
    const match = matchNotification(notification, {
      type: this.params.notifications.type,
      read: this.params.notifications.read
    })
    if (!match) return

    const context = this.result.get(notification.contextId)
    if ((context?.notifications ?? []).some((it) => it.id === notification.id)) return
    if (context !== undefined) {
      const message =
        this.params.notifications.message === true
          ? await findMessage(
            this.client,
            this.workspace,
            this.filesUrl,
            context.cardId,
            notification.messageId,
            notification.messageCreated,
            false,
            true,
            false
          )
          : undefined

      const notifications = [
        {
          ...notification,
          message
        },
        ...(context.notifications ?? [])
      ]
      if (notifications.length > this.params.notifications.limit) {
        notifications.pop()
      }
      this.result.update({
        ...context,
        notifications
      })
      void this.notify()
    } else {
      const newContext = (
        await this.find({ id: notification.contextId, notifications: this.params.notifications, limit: 1 })
      )[0]
      if (newContext !== undefined) {
        this.addContext(newContext, this.result)
        void this.notify()
      }
    }
  }

  private async onRemoveNotificationContextEvent (event: RemoveNotificationContextEvent): Promise<void> {
    if (this.forward instanceof Promise) this.forward = await this.forward
    if (this.backward instanceof Promise) this.backward = await this.backward
    if (this.result instanceof Promise) this.result = await this.result

    const length = this.result.length
    const deleted = this.result.delete(event.contextId)

    if (deleted != null) {
      if (this.params.limit != null && length >= this.params.limit && this.result.length < this.params.limit) {
        await this.reinit(length)
      } else {
        void this.notify()
      }
    }
  }

  private async reinit (limit: number): Promise<void> {
    if (this.forward instanceof Promise) this.forward = await this.forward
    if (this.backward instanceof Promise) this.backward = await this.backward
    if (this.result instanceof Promise) this.result = await this.result
    this.result = this.find({ ...this.params, limit: limit + 1 }).then((res) => {
      const isTail =
        res.length <= limit || (this.params.order === SortingOrder.Descending && this.params.lastNotify == null)
      const isHead =
        res.length <= limit || (this.params.order === SortingOrder.Ascending && this.params.lastNotify == null)
      if (res.length > limit) {
        res.pop()
      }

      const result = new QueryResult(res, (it) => it.id)
      result.setHead(isHead)
      result.setTail(isTail)
      return result
    })
    void this.result.then((res) => {
      void this.notify()
      return res
    })
  }

  private async onUpdateNotificationContextEvent (event: UpdateNotificationContextEvent): Promise<void> {
    if (this.forward instanceof Promise) this.forward = await this.forward
    if (this.backward instanceof Promise) this.backward = await this.backward
    if (this.result instanceof Promise) this.result = await this.result

    const contextToUpdate = this.result.get(event.contextId)
    if (contextToUpdate === undefined) return

    const currentNotifications = contextToUpdate.notifications ?? []
    const newNotifications =
      event.updates.lastView != null
        ? this.filterNotifications(
          currentNotifications.map((it) => ({
            ...it,
            read:
                it.type === NotificationType.Message
                  ? event.updates.lastView != null && event.updates.lastView >= it.created
                  : it.read
          }))
        )
        : currentNotifications

    if (
      this.params.notifications != null &&
      newNotifications.length < currentNotifications.length &&
      newNotifications.length < this.params.notifications.limit &&
      this.params.notifications.order !== SortingOrder.Descending
    ) {
      const updated: NotificationContext = (
        await this.find({ id: event.contextId, limit: 1, notifications: this.params.notifications })
      )[0]
      if (updated !== undefined) {
        this.result.update(updated)
      } else {
        this.result.delete(contextToUpdate.id)
      }
    } else {
      const updated: NotificationContext = {
        ...contextToUpdate,
        lastUpdate: event.updates.lastUpdate ?? contextToUpdate.lastUpdate,
        lastView: event.updates.lastView ?? contextToUpdate.lastView,
        lastNotify: event.updates.lastNotify ?? contextToUpdate.lastNotify,
        notifications: newNotifications
      }
      this.result.update(updated)
    }

    if (event.updates.lastNotify != null) {
      this.sort(this.result)
    }

    void this.notify()
  }

  async onCardRemoved (event: RemoveCardEvent): Promise<void> {
    if (this.result instanceof Promise) this.result = await this.result
    let updated = false
    const result = this.result.getResult()
    for (const context of result) {
      if (context.cardId === event.cardId) {
        this.result.delete(context.id)
        updated = true
      }
    }

    if (this.params.notifications?.message === true) {
      const result = updated ? this.result.getResult() : []
      for (const context of result) {
        const notifications = context.notifications ?? []
        for (const notification of notifications) {
          if (notification.message != null && notification.message.thread?.threadId === event.cardId) {
            updated = true
            notification.message.thread = undefined
          }
        }
      }
    }

    if (updated) {
      if (this.params.limit != null && this.result.length < this.params.limit && result.length >= this.params.limit) {
        const contexts = await this.find(this.params)
        this.result = new QueryResult(contexts, (x) => x.id)
      }
      void this.notify()
    }
  }

  private filterNotifications (notifications: Notification[]): Notification[] {
    if (this.params.notifications == null) return notifications
    const read = this.params.notifications.read
    if (read == null) return notifications

    return notifications.filter((it) => it.read === read)
  }

  private addContext (context: NotificationContext, result: QueryResult<NotificationContext>): void {
    if (result.get(context.id) !== undefined) return
    if (result.isTail()) {
      if (this.params.order === SortingOrder.Ascending) {
        result.push(context)
      } else {
        result.unshift(context)
      }
    }

    if (this.params.limit != null && result.length > this.params.limit) {
      result.pop()
    }

    this.sort(result)
  }

  private sort (result: QueryResult<NotificationContext>): void {
    result.sort((a, b) =>
      this.params.order === SortingOrder.Descending
        ? (b.lastNotify?.getTime() ?? 0) - (a.lastNotify?.getTime() ?? 0)
        : (a.lastNotify?.getTime() ?? 0) - (b.lastNotify?.getTime() ?? 0)
    )
  }

  private match (context: NotificationContext): boolean {
    if (this.params.card !== undefined) {
      const cards = Array.isArray(this.params.card) ? this.params.card : [this.params.card]
      if (!cards.includes(context.cardId)) return false
    }

    if (this.params.id !== undefined && context.id !== this.params.id) {
      return false
    }

    if (this.params.lastNotify !== undefined) {
      if (
        'greater' in this.params.lastNotify &&
        this.params.lastNotify.greater != null &&
        (context.lastNotify?.getTime() ?? 0) <= this.params.lastNotify.greater.getTime()
      ) {
        return false
      }
      if (
        'less' in this.params.lastNotify &&
        this.params.lastNotify.less != null &&
        (context.lastNotify?.getTime() ?? 0) >= this.params.lastNotify.less.getTime()
      ) {
        return false
      }
      if (
        'greaterOrEqual' in this.params.lastNotify &&
        this.params.lastNotify.greaterOrEqual != null &&
        (context.lastNotify?.getTime() ?? 0) < this.params.lastNotify.greaterOrEqual.getTime()
      ) {
        return false
      }
      if (
        'lessOrEqual' in this.params.lastNotify &&
        this.params.lastNotify.lessOrEqual != null &&
        (context.lastNotify?.getTime() ?? 0) > this.params.lastNotify.lessOrEqual.getTime()
      ) {
        return false
      }

      if (this.params.lastNotify instanceof Date && this.params.lastNotify !== context.lastNotify) {
        return false
      }
    }

    return true
  }

  private async notify (): Promise<void> {
    if (this.callback === undefined) return
    if (this.result instanceof Promise) {
      this.result = await this.result
    }

    const result = this.result.getResult()
    const isTail = this.result.isTail()
    const isHead = this.result.isHead()

    const window = new WindowImpl(result, isTail, isHead, this)
    this.callback(window)
  }

  private async updateMessage (
    card: CardID,
    messageId: MessageID,
    updater: (message: Message) => Message
  ): Promise<boolean> {
    if (this.params.notifications == null || this.params.notifications.message !== true) return false
    if (this.forward instanceof Promise) this.forward = await this.forward
    if (this.backward instanceof Promise) this.backward = await this.backward
    if (this.result instanceof Promise) this.result = await this.result
    const context = this.result.getResult().find((it) => it.cardId === card)
    if (context === undefined || (context.notifications ?? []).length === 0) return false

    const hasMessage = context.notifications?.some((it) => it.messageId === messageId) ?? false
    if (!hasMessage) return false

    this.result.update({
      ...context,
      notifications: context.notifications?.map((it) => ({
        ...it,
        message: it.messageId === messageId && it.message != null ? updater(it.message) : it.message
      }))
    })

    return true
  }

  async refresh (): Promise<void> {
    const nextPagesCount = this.nexLoadedPagesCount
    const prevPagesCount = this.prevLoadedPagesCount

    this.result = new QueryResult([] as NotificationContext[], (it) => it.id)
    this.nexLoadedPagesCount = 0
    this.prevLoadedPagesCount = 0

    this.result = await this.rawInitResult()

    for (let i = 0; i < nextPagesCount; i++) {
      const { isDone } = await this.requestLoadNextPage(false)
      if (!isDone) break
    }

    for (let i = 0; i < prevPagesCount; i++) {
      const { isDone } = await this.requestLoadPrevPage(false)
      if (!isDone) break
    }

    await this.notify()
  }
}
