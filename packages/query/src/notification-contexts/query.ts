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
  type CardID,
  type FindNotificationContextParams,
  type Message,
  type MessageID,
  type Notification,
  type NotificationContext,
  PatchType,
  SortingOrder,
  type WorkspaceID
} from '@hcengineering/communication-types'
import {
  type CardRemovedEvent,
  CardResponseEventType,
  type FileCreatedEvent,
  type FileRemovedEvent,
  type FindClient,
  MessageResponseEventType,
  type MessagesRemovedEvent,
  type NotificationContextCreatedEvent,
  type NotificationContextRemovedEvent,
  type NotificationContextUpdatedEvent,
  type NotificationCreatedEvent,
  NotificationResponseEventType,
  type NotificationsRemovedEvent,
  type PagedQueryCallback,
  type PatchCreatedEvent,
  type RequestEvent,
  type ResponseEvent,
  type ThreadCreatedEvent,
  type ThreadUpdatedEvent
} from '@hcengineering/communication-sdk-types'
import { applyPatch } from '@hcengineering/communication-shared'

import { defaultQueryParams, type PagedQuery, type QueryId } from '../types'
import { QueryResult } from '../result'
import { WindowImpl } from '../window'
import { addFile, createThread, loadMessageFromGroup, removeFile, updateThread } from '../utils'

const allowedPatchTypes = [PatchType.update, PatchType.addFile, PatchType.removeFile, PatchType.updateThread]
export class NotificationContextsQuery implements PagedQuery<NotificationContext, FindNotificationContextParams> {
  private result: QueryResult<NotificationContext> | Promise<QueryResult<NotificationContext>>
  private forward: Promise<NotificationContext[]> | NotificationContext[] = []
  private backward: Promise<NotificationContext[]> | NotificationContext[] = []

  constructor(
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
    const limit = params.limit != null ? params.limit + 1 : undefined
    const findParams: FindNotificationContextParams = {
      ...this.params,
      order: this.params.order ?? defaultQueryParams.order,
      limit
    }

    if (initialResult !== undefined) {
      this.result = initialResult
      void this.notify()
    } else {
      const findPromise = this.find(findParams)
      this.result = findPromise.then((res) => {
        const allLoaded = limit == null || res.length < limit
        const isTail = allLoaded || (params.lastUpdate == null && params.order === SortingOrder.Descending)
        const isHead = allLoaded || (params.lastUpdate == null && params.order === SortingOrder.Ascending)

        if (limit != null && res.length >= limit) {
          res.pop()
        }
        const qResult = new QueryResult(res, (x) => x.id)
        qResult.setTail(isTail)
        qResult.setHead(isHead)

        return qResult
      })
      this.result
        .then(async () => {
          await this.notify()
        })
        .catch((err: any) => {
          console.error('Failed to update Live query: ', err)
        })
    }
  }

  async onEvent(event: ResponseEvent): Promise<void> {
    switch (event.type) {
      case MessageResponseEventType.PatchCreated: {
        await this.onCreatePatchEvent(event)
        break
      }
      case MessageResponseEventType.MessagesRemoved: {
        await this.onMessagesRemovedEvent(event)
        break
      }
      case NotificationResponseEventType.NotificationCreated: {
        await this.onCreateNotificationEvent(event)
        break
      }
      case NotificationResponseEventType.NotificationsRemoved: {
        await this.onRemoveNotificationEvent(event)
        break
      }
      case NotificationResponseEventType.NotificationContextCreated: {
        await this.onCreateNotificationContextEvent(event)
        break
      }
      case NotificationResponseEventType.NotificationContextUpdated: {
        await this.onUpdateNotificationContextEvent(event)
        break
      }
      case NotificationResponseEventType.NotificationContextRemoved: {
        await this.onRemoveNotificationContextEvent(event)
        break
      }
      case CardResponseEventType.CardRemoved:
        await this.onCardRemoved(event)
        break
      case MessageResponseEventType.FileCreated:
        await this.onFileCreated(event)
        break
      case MessageResponseEventType.FileRemoved:
        await this.onFileRemoved(event)
        break
      case MessageResponseEventType.ThreadCreated:
        await this.onThreadCreated(event)
        break
      case MessageResponseEventType.ThreadUpdated:
        await this.onThreadUpdated(event)
    }
  }

  async onRequest(event: RequestEvent): Promise<void> {}

  async unsubscribe(): Promise<void> {
    await this.client.unsubscribeQuery(this.id)
  }

  async requestLoadNextPage(): Promise<void> {
    if (this.result instanceof Promise) {
      this.result = await this.result
    }
    if (this.forward instanceof Promise) {
      this.forward = await this.forward
    }

    if (this.result.isTail()) return

    const last = this.result.getLast()
    if (last === undefined) return

    const limit = this.params.limit ?? defaultQueryParams.limit
    const findParams: FindNotificationContextParams = {
      ...this.params,
      lastUpdate: {
        greater: last.lastUpdate
      },
      limit: limit + 1,
      order: SortingOrder.Ascending
    }

    const forward = this.find(findParams)

    this.forward = forward.then(async (res) => {
      if (this.result instanceof Promise) {
        this.result = await this.result
      }
      const isTail = res.length <= limit
      if (!isTail) {
        res.pop()
      }
      this.result.append(res)
      this.result.setTail(isTail)
      await this.notify()
      return res
    })
  }

  async requestLoadPrevPage(): Promise<void> {
    if (this.result instanceof Promise) {
      this.result = await this.result
    }
    if (this.backward instanceof Promise) {
      this.backward = await this.backward
    }

    if (this.result.isHead()) return

    const first = this.params.order === SortingOrder.Ascending ? this.result.getFirst() : this.result.getLast()
    if (first === undefined) return

    const limit = this.params.limit ?? defaultQueryParams.limit
    const findParams: FindNotificationContextParams = {
      ...this.params,
      lastUpdate: {
        less: first.lastUpdate
      },
      limit: limit + 1,
      order: SortingOrder.Descending
    }

    const backward = this.find(findParams)
    this.backward = backward.then(async (res) => {
      if (this.result instanceof Promise) {
        this.result = await this.result
      }
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
      await this.notify()
      return res
    })
  }

  removeCallback(): void {
    this.callback = () => {}
  }

  setCallback(callback: PagedQueryCallback<NotificationContext>): void {
    this.callback = callback
    void this.notify()
  }

  copyResult(): QueryResult<NotificationContext> | undefined {
    if (this.result instanceof Promise) {
      return undefined
    }

    return this.result.copy()
  }

  private async find(params: FindNotificationContextParams): Promise<NotificationContext[]> {
    const contexts = await this.client.findNotificationContexts(params, this.id)
    if (params.notifications?.message !== true) return contexts

    await Promise.all(
      contexts.map(async (context) => {
        const notifications = context.notifications ?? []

        context.notifications = await Promise.all(
          notifications.map(async (notification) => {
            if (notification.message != null || notification.messageId == null) return notification

            const message = await loadMessageFromGroup(
              notification.messageId,
              this.workspace,
              this.filesUrl,
              notification.messageGroup,
              notification.patches
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

    return contexts
  }

  private async onCreateNotificationContextEvent(event: NotificationContextCreatedEvent): Promise<void> {
    if (this.forward instanceof Promise) this.forward = await this.forward
    if (this.backward instanceof Promise) this.backward = await this.backward
    if (this.result instanceof Promise) this.result = await this.result

    const context = event.context

    if (this.result.get(context.id) !== undefined) {
      return
    }

    if (!this.match(context)) {
      return
    }

    await this.addContext(context)
    void this.notify()
  }

  private async onCreatePatchEvent(event: PatchCreatedEvent): Promise<void> {
    const isUpdated = await this.updateMessage(event.card, event.patch.message, (message) =>
      applyPatch(message, event.patch, allowedPatchTypes)
    )
    if (isUpdated) {
      void this.notify()
    }
  }

  private async onFileCreated(event: FileCreatedEvent): Promise<void> {
    const isUpdated = await this.updateMessage(event.card, event.file.message, (message) =>
      addFile(message, event.file)
    )
    if (isUpdated) {
      void this.notify()
    }
  }

  private async onFileRemoved(event: FileRemovedEvent): Promise<void> {
    const isUpdated = await this.updateMessage(event.card, event.message, (message) =>
      removeFile(message, event.blobId)
    )
    if (isUpdated) {
      void this.notify()
    }
  }

  private async onThreadCreated(event: ThreadCreatedEvent): Promise<void> {
    const isUpdated = await this.updateMessage(event.thread.card, event.thread.message, (message) =>
      createThread(
        message,
        event.thread.thread,
        event.thread.threadType,
        event.thread.repliesCount,
        event.thread.lastReply
      )
    )
    if (isUpdated) {
      void this.notify()
    }
  }

  private async onThreadUpdated(event: ThreadUpdatedEvent): Promise<void> {
    const isUpdated = await this.updateMessage(event.card, event.message, (message) =>
      updateThread(message, event.thread, event.replies, event.lastReply)
    )
    if (isUpdated) {
      void this.notify()
    }
  }
  private async onMessagesRemovedEvent(event: MessagesRemovedEvent): Promise<void> {
    if (this.params.notifications == null) return
    if (this.forward instanceof Promise) this.forward = await this.forward
    if (this.backward instanceof Promise) this.backward = await this.backward
    if (this.result instanceof Promise) this.result = await this.result

    const context = this.result.getResult().find((it) => it.card === event.card)

    if (context === undefined) return
    const filtered = (context.notifications ?? []).filter(
      (it) => it.messageId == null || !event.messages.includes(it.messageId)
    )
    if (filtered.length === (context.notifications?.length ?? 0)) return
    const contextUpdated = (await this.find({ id: context.id, limit: 1, notifications: this.params.notifications }))[0]
    if (contextUpdated !== undefined) {
      this.result.update(contextUpdated)
    } else {
      this.result.update({
        ...context,
        notifications: filtered
      })
    }
    void this.notify()
  }

  private async onRemoveNotificationEvent(event: NotificationsRemovedEvent): Promise<void> {
    if (this.params.notifications == null) return
    if (this.forward instanceof Promise) this.forward = await this.forward
    if (this.backward instanceof Promise) this.backward = await this.backward
    if (this.result instanceof Promise) this.result = await this.result

    const context = this.result.get(event.context)
    if (context === undefined) return

    const filtered = (context.notifications ?? []).filter((it) => it.created > event.untilDate)
    if (filtered.length === (context.notifications?.length ?? 0)) return

    const contextUpdated = (await this.find({ id: context.id, limit: 1, notifications: this.params.notifications }))[0]
    if (contextUpdated !== undefined) {
      this.result.update(contextUpdated)
    } else {
      this.result.update({
        ...context,
        notifications: filtered
      })
    }
    void this.notify()
  }

  private async onCreateNotificationEvent(event: NotificationCreatedEvent): Promise<void> {
    if (this.params.notifications == null) return
    if (this.forward instanceof Promise) this.forward = await this.forward
    if (this.backward instanceof Promise) this.backward = await this.backward
    if (this.result instanceof Promise) this.result = await this.result

    const match = this.matchNotification(event.notification)
    if (!match) return
    const context = this.result.get(event.notification.context)
    if (context !== undefined) {
      const message =
        this.params.notifications.message === true
          ? (
              await this.client.findMessages({
                card: context.card,
                id: event.notification.messageId
              })
            )[0]
          : undefined

      const notifications = [
        {
          ...event.notification,
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
        await this.find({ id: event.notification.context, notifications: this.params.notifications, limit: 1 })
      )[0]
      if (newContext !== undefined) {
        await this.addContext(newContext)
        void this.notify()
      }
    }
  }

  private async onRemoveNotificationContextEvent(event: NotificationContextRemovedEvent): Promise<void> {
    if (this.forward instanceof Promise) this.forward = await this.forward
    if (this.backward instanceof Promise) this.backward = await this.backward
    if (this.result instanceof Promise) this.result = await this.result

    const length = this.result.length
    const deleted = this.result.delete(event.context)

    if (deleted != null) {
      if (this.params.limit && length >= this.params.limit && this.result.length < this.params.limit) {
        await this.reinit(length)
      } else {
        void this.notify()
      }
    }
  }

  private async reinit(limit: number): Promise<void> {
    if (this.forward instanceof Promise) this.forward = await this.forward
    if (this.backward instanceof Promise) this.backward = await this.backward
    if (this.result instanceof Promise) this.result = await this.result
    this.result = this.find({ ...this.params, limit: limit + 1 }).then((res) => {
      const isTail =
        res.length <= limit || (this.params.order === SortingOrder.Descending && this.params.lastUpdate == null)
      const isHead =
        res.length <= limit || (this.params.order === SortingOrder.Ascending && this.params.lastUpdate == null)
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

  private async onUpdateNotificationContextEvent(event: NotificationContextUpdatedEvent): Promise<void> {
    if (this.forward instanceof Promise) this.forward = await this.forward
    if (this.backward instanceof Promise) this.backward = await this.backward
    if (this.result instanceof Promise) this.result = await this.result

    const toUpdate = this.result.get(event.context)

    if (toUpdate !== undefined) {
      const notifications = this.filterNotifications(
        event.lastView != null
          ? (toUpdate.notifications ?? []).map((it) => ({
              ...it,
              read: event.lastView != null && event.lastView >= it.created
            }))
          : (toUpdate.notifications ?? [])
      )

      if (
        notifications.length < (toUpdate.notifications?.length ?? 0) &&
        this.params.notifications?.order !== SortingOrder.Descending
      ) {
        const updated: NotificationContext = (
          await this.find({ id: event.context, limit: 1, notifications: this.params.notifications })
        )[0]
        if (updated !== undefined) {
          this.result.update(updated)
        } else {
          const updated: NotificationContext = {
            ...toUpdate,
            lastUpdate: event.lastUpdate ?? toUpdate.lastUpdate,
            lastView: event.lastView ?? toUpdate.lastView,
            notifications
          }
          this.result.update(updated)
        }
      } else {
        const updated: NotificationContext = {
          ...toUpdate,
          lastUpdate: event.lastUpdate ?? toUpdate.lastUpdate,
          lastView: event.lastView ?? toUpdate.lastView,
          notifications
        }
        this.result.update(updated)
      }
      if (event.lastUpdate != null) {
        this.result.sort((a, b) =>
          this.params.order === SortingOrder.Descending
            ? b.lastUpdate.getTime() - a.lastUpdate.getTime()
            : a.lastUpdate.getTime() - b.lastUpdate.getTime()
        )
      }
      void this.notify()
    }
  }

  async onCardRemoved(event: CardRemovedEvent): Promise<void> {
    if (this.result instanceof Promise) this.result = await this.result
    let deleted = false
    const result = this.result.getResult()
    for (const context of result) {
      if (context.card == event.card) {
        this.result.delete(context.id)
        deleted = true
      }
    }

    if (deleted) {
      if (this.params.limit && this.result.length < this.params.limit && result.length >= this.params.limit) {
        const contexts = await this.find(this.params)
        this.result = new QueryResult(contexts, (x) => x.id)
      }
      void this.notify()
    }
  }

  private filterNotifications(notifications: Notification[]): Notification[] {
    if (this.params.notifications == null) return notifications
    const read = this.params.notifications.read
    if (read == null) return notifications

    return notifications.filter((it) => it.read === read)
  }

  private async addContext(context: NotificationContext): Promise<void> {
    if (this.result instanceof Promise) this.result = await this.result
    if (this.result.get(context.id) !== undefined) return
    if (this.result.isTail()) {
      if (this.params.order === SortingOrder.Ascending) {
        this.result.push(context)
      } else {
        this.result.unshift(context)
      }
    }

    if (this.params.limit != null && this.result.length > this.params.limit) {
      this.result.pop()
    }
  }

  private match(context: NotificationContext): boolean {
    if (this.params.card !== undefined) {
      const cards = Array.isArray(this.params.card) ? this.params.card : [this.params.card]
      if (!cards.includes(context.card)) return false
    }

    if (this.params.id !== undefined && context.id !== this.params.id) {
      return false
    }

    if (this.params.lastUpdate !== undefined) {
      if (
        'greater' in this.params.lastUpdate &&
        this.params.lastUpdate.greater != null &&
        context.lastUpdate <= this.params.lastUpdate.greater
      ) {
        return false
      }
      if (
        'less' in this.params.lastUpdate &&
        this.params.lastUpdate.less != null &&
        context.lastUpdate >= this.params.lastUpdate.less
      ) {
        return false
      }
      if (
        'greaterOrEqual' in this.params.lastUpdate &&
        this.params.lastUpdate.greaterOrEqual != null &&
        context.lastUpdate < this.params.lastUpdate.greaterOrEqual
      ) {
        return false
      }
      if (
        'lessOrEqual' in this.params.lastUpdate &&
        this.params.lastUpdate.lessOrEqual != null &&
        context.lastUpdate > this.params.lastUpdate.lessOrEqual
      ) {
        return false
      }

      if (this.params.lastUpdate instanceof Date && this.params.lastUpdate !== context.lastUpdate) {
        return false
      }
    }

    return true
  }

  private matchNotification(notification: Notification): boolean {
    if (this.params.notifications === undefined) return false
    if (this.params.notifications.type !== undefined && this.params.notifications.type !== notification.type)
      return false
    if (this.params.notifications.read !== undefined && this.params.notifications.read !== notification.read)
      return false
    return true
  }

  private async notify(): Promise<void> {
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

  private async updateMessage(
    card: CardID,
    messageId: MessageID,
    updater: (message: Message) => Message
  ): Promise<boolean> {
    if (this.params.notifications == null || this.params.notifications.message !== true) return false
    if (this.forward instanceof Promise) this.forward = await this.forward
    if (this.backward instanceof Promise) this.backward = await this.backward
    if (this.result instanceof Promise) this.result = await this.result
    const context = this.result.getResult().find((it) => it.card === card)
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
}
