//
// Copyright © 2025 Hardcore Engineering Inc.
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// You may not use this file except in compliance with the License. You may
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
  type CardID,
  type FindNotificationsParams,
  type Message,
  type MessageID,
  type Notification,
  NotificationType,
  PatchType,
  SortingOrder,
  type WorkspaceID
} from '@hcengineering/communication-types'
import {
  CardEventType,
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
import { applyPatches, MessageProcessor, NotificationProcessor } from '@hcengineering/communication-shared'

import { defaultQueryParams, NotificationQueryParams, type PagedQuery, type QueryId } from '../types'
import { QueryResult } from '../result'
import { WindowImpl } from '../window'
import { loadMessageFromGroup, matchNotification } from '../utils'

const allowedPatchTypes = [PatchType.update, PatchType.remove, PatchType.blob]

export class NotificationQuery implements PagedQuery<Notification, NotificationQueryParams> {
  private result: QueryResult<Notification> | Promise<QueryResult<Notification>>

  nexLoadedPagesCount = 0
  prevLoadedPagesCount = 0

  constructor (
    private readonly client: FindClient,
    private readonly workspace: WorkspaceID,
    private readonly filesUrl: string,
    public readonly id: QueryId,
    public readonly params: NotificationQueryParams,
    private callback?: PagedQueryCallback<Notification>,
    initialResult?: QueryResult<Notification>
  ) {
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

  private async rawInitResult (): Promise<QueryResult<Notification>> {
    const limit = this.params.limit != null ? this.params.limit + 1 : undefined
    const findParams: FindNotificationsParams = {
      ...this.params,
      order: this.params.order ?? defaultQueryParams.order,
      limit: this.params.strict === true ? this.params.limit : limit
    }

    const res = await this.find(findParams)
    const isComplete = this.params.limit == null || this.params.strict === true || res.length <= this.params.limit
    if (!isComplete) res.pop()

    const result = new QueryResult(res, (it) => it.id)
    result.setTail(isComplete)
    result.setHead(isComplete)

    return result
  }

  private async initResult (): Promise<QueryResult<Notification>> {
    try {
      return await this.rawInitResult()
    } catch (error) {
      console.error('Failed to initialize query:', error)
      return new QueryResult([] as Notification[], (it) => it.id)
    }
  }

  async onEvent (event: Event): Promise<void> {
    switch (event.type) {
      case NotificationEventType.CreateNotification: {
        await this.onCreateNotificationEvent(event)
        break
      }
      case NotificationEventType.RemoveNotifications: {
        await this.onRemoveNotificationsEvent(event)
        break
      }
      case NotificationEventType.UpdateNotification: {
        await this.onUpdateNotificationEvent(event)
        break
      }
      case NotificationEventType.UpdateNotificationContext: {
        await this.onUpdateNotificationContextEvent(event)
        break
      }
      case NotificationEventType.RemoveNotificationContext:
        await this.onRemoveNotificationContextEvent(event)
        break
      case MessageEventType.UpdatePatch:
      case MessageEventType.RemovePatch:
      case MessageEventType.BlobPatch:
        await this.onCreatePatchEvent(event)
        break
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
    if (this.params.strict === true) return { isDone: true }
    if (this.result instanceof Promise) this.result = await this.result
    if (this.result.isTail()) return { isDone: true }

    const result = await this.loadPage(SortingOrder.Ascending, this.result.getLast()?.created, notify)
    this.nexLoadedPagesCount++

    return result
  }

  async requestLoadPrevPage (notify = true): Promise<{ isDone: boolean }> {
    if (this.params.strict === true) return { isDone: true }
    if (this.result instanceof Promise) this.result = await this.result
    if (this.result.isHead()) return { isDone: true }
    const result = await this.loadPage(SortingOrder.Descending, this.result.getFirst()?.created, notify)
    this.prevLoadedPagesCount++

    return result
  }

  private async loadPage (order: SortingOrder, created?: Date, notify = true): Promise<{ isDone: boolean }> {
    if (created == null) return { isDone: false }
    if (this.params.limit == null) return { isDone: true }
    if (this.result instanceof Promise) this.result = await this.result

    const limit = this.params.limit
    const findParams: FindNotificationsParams = {
      ...this.params,
      created: order === SortingOrder.Ascending ? { greater: created } : { less: created },
      limit: limit + 1,
      order
    }

    try {
      const res = await this.find(findParams)
      const isDone = res.length <= limit
      if (!isDone) res.pop()

      if (order === SortingOrder.Ascending) {
        this.result.append(res)
        this.result.setTail(isDone)
      } else {
        this.result.prepend(res)
        this.result.setHead(isDone)
      }

      if (notify) {
        await this.notify()
      }

      return { isDone }
    } catch (error) {
      console.error(`Failed to load ${order === SortingOrder.Ascending ? 'next' : 'previous'} page:`, error)
    }

    return { isDone: false }
  }

  removeCallback (): void {
    this.callback = () => {}
  }

  setCallback (callback: PagedQueryCallback<Notification>): void {
    this.callback = callback
    void this.notify()
  }

  copyResult (): QueryResult<Notification> | undefined {
    return this.result instanceof Promise ? undefined : this.result.copy()
  }

  private async find (params: NotificationQueryParams): Promise<Notification[]> {
    delete params.strict
    const notifications = await this.client.findNotifications(params, this.id)
    if (params.message !== true) return notifications

    return await Promise.all(
      notifications.map(async (notification) => {
        if (notification.message != null || notification.blobId == null) return notification
        const message = await loadMessageFromGroup(
          notification.messageId,
          this.workspace,
          this.filesUrl,
          notification.blobId,
          notification.patches
        )
        return message != null ? { ...notification, message } : notification
      })
    )
  }

  private async onCreateNotificationEvent (event: CreateNotificationEvent): Promise<void> {
    if (event.notificationId == null) return
    if (this.result instanceof Promise) this.result = await this.result
    if (this.result.get(event.notificationId) != null) return
    if (!this.result.isTail()) return

    const notification = NotificationProcessor.createFromEvent(event)
    const match = matchNotification(notification, { ...this.params, created: undefined })
    if (!match) return

    if (this.params.message === true) {
      const message = await this.client.findMessages({
        card: notification.cardId,
        id: notification.messageId,
        limit: 1,
        files: true
      })
      notification.message = message[0]
    }

    if (this.params.order === SortingOrder.Ascending) {
      if (this.params.limit !== undefined && this.result.length === this.params.limit && this.params.strict === true) {
        this.result.setTail(false)
        return
      }
      this.result.push(notification)
    } else {
      if (this.params.limit !== undefined && this.result.length === this.params.limit && this.params.strict === true) {
        this.result.pop()
        this.result.setHead(false)
      }
      this.result.unshift(notification)
    }

    await this.notify()
  }

  private async onUpdateNotificationContextEvent (event: UpdateNotificationContextEvent): Promise<void> {
    if (this.result instanceof Promise) this.result = await this.result
    if (this.params.context != null && this.params.context !== event.contextId) return

    const lastView = event.updates.lastView
    if (lastView === undefined) return

    const toUpdate = this.result.getResult().filter((it) => it.contextId === event.contextId)
    if (toUpdate.length === 0) return

    const updated: Notification[] = toUpdate.map((it) => ({
      ...it,
      read: it.type === NotificationType.Message ? lastView >= it.created : it.read
    }))

    await this.updateNotificationRead(this.result, updated)
  }

  private async updateNotificationRead (result: QueryResult<Notification>, updated: Notification[]): Promise<void> {
    const isAllowed = (n: Notification): boolean => {
      if (this.params.read == null) return true
      return n.read === this.params.read
    }
    const currentLength = result.length
    for (const notification of updated) {
      if (isAllowed(notification)) {
        result.update(notification)
      } else {
        result.delete(notification.id)
      }
    }

    const newLength = result.length
    const { limit } = this.params

    if (limit != null && currentLength !== newLength && currentLength >= limit && newLength < limit) {
      await this.reinit(currentLength)
    } else {
      void this.notify()
    }
  }

  private async onUpdateNotificationEvent (event: UpdateNotificationEvent): Promise<void> {
    if (this.result instanceof Promise) this.result = await this.result

    const toUpdate = (
      event.query.id != null
        ? [this.result.get(event.query.id)].filter((it): it is Notification => it != null)
        : this.result.getResult().filter((it) => matchNotification(it, event.query))
    ).filter((it) => it.read !== event.updates.read)
    if (toUpdate === undefined || toUpdate.length === 0) return
    const updated = toUpdate.map((it) => ({ ...it, ...event.updates }))
    await this.updateNotificationRead(this.result, updated)
  }

  private async onRemoveNotificationsEvent (event: RemoveNotificationsEvent): Promise<void> {
    if (this.params.context !== undefined && this.params.context !== event.contextId) return
    if (this.result instanceof Promise) this.result = await this.result

    const currentLength = this.result.length
    let isDeleted = false

    for (const id of event.ids) {
      const deleted = this.result.delete(id)
      isDeleted = isDeleted || deleted !== undefined
    }

    const newLength = this.result.length
    const { limit } = this.params

    if (limit != null && currentLength >= limit && newLength < limit) {
      void this.reinit(currentLength)
    } else if (isDeleted) {
      void this.notify()
    }
  }

  private async onRemoveNotificationContextEvent (event: RemoveNotificationContextEvent): Promise<void> {
    if (this.params.context != null && this.params.context !== event.contextId) return
    if (this.result instanceof Promise) this.result = await this.result

    if (event.contextId === this.params.context) {
      if (this.result.length === 0) return
      this.result.deleteAll()
      this.result.setHead(true)
      this.result.setTail(true)
      void this.notify()
    } else {
      const toRemove = this.result.getResult().filter((it) => it.contextId === event.contextId)
      if (toRemove.length === 0) return
      const length = this.result.length

      for (const notification of toRemove) {
        this.result.delete(notification.id)
      }

      const { limit } = this.params
      if (limit != null && length >= limit && this.result.length < limit) {
        void this.reinit(this.result.length)
      } else {
        void this.notify()
      }
    }
  }

  private async onCreatePatchEvent (event: PatchEvent): Promise<void> {
    if (this.params.message !== true) return
    const patches = MessageProcessor.eventToPatches(event).filter((it) => allowedPatchTypes.includes(it.type))
    if (patches.length === 0) return
    const isUpdated = await this.updateMessage(
      (it) => this.matchNotificationByMessage(it, event.cardId, event.messageId),
      (message) => applyPatches(message, patches, allowedPatchTypes)
    )
    if (isUpdated) {
      void this.notify()
    }
  }

  private async onCardRemoved (event: RemoveCardEvent): Promise<void> {
    if (this.params.message !== true) return
    if (this.result instanceof Promise) this.result = await this.result
    const isUpdated = await this.updateMessage(
      (it) => it.message != null && it.message.thread?.threadId === event.cardId,
      (message) => ({ ...message, thread: undefined })
    )
    if (isUpdated) {
      void this.notify()
    }
  }

  private async notify (): Promise<void> {
    if (this.callback == null) return
    if (this.result instanceof Promise) this.result = await this.result

    const window = new WindowImpl(this.result.getResult(), this.result.isTail(), this.result.isHead(), this)
    this.callback(window)
  }

  private async reinit (limit: number): Promise<void> {
    if (this.result instanceof Promise) this.result = await this.result
    this.result = this.find({ ...this.params, limit: limit + 1 }).then((res) => {
      const isTail = res.length <= limit
      const isHead = res.length <= limit
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

  private matchNotificationByMessage (notification: Notification, card: CardID, messageId: MessageID): boolean {
    return notification.messageId === messageId && notification.message != null && notification.message.cardId === card
  }

  private async updateMessage (
    matchFn: (notification: Notification) => boolean,
    updater: (message: Message) => Message
  ): Promise<boolean> {
    if (this.params.message !== true) return false
    if (this.result instanceof Promise) this.result = await this.result

    const result = this.result.getResult()
    let isUpdated = false
    for (const notification of result) {
      const isMatched = matchFn(notification)
      if (!isMatched) continue
      isUpdated = true
      this.result.update({
        ...notification,
        message: notification.message != null ? updater(notification.message) : notification.message
      })
    }

    return isUpdated
  }

  async refresh (): Promise<void> {
    const nextPagesCount = this.nexLoadedPagesCount
    const prevPagesCount = this.prevLoadedPagesCount

    this.result = new QueryResult([] as Notification[], (it) => it.id)
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
