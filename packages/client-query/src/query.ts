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

import { MessageQueryParams } from '@hcengineering/communication-query'
import type { PagedQueryCallback, QueryCallback } from '@hcengineering/communication-sdk-types'
import {
  type FindLabelsParams,
  type FindNotificationContextParams,
  type FindNotificationsParams,
  type Label,
  type Message,
  type NotificationContext,
  type Notification,
  FindCollaboratorsParams,
  Collaborator
} from '@hcengineering/communication-types'
import { deepEqual } from 'fast-equals'
import { getLiveQueries, getOnDestroy } from './init'

class BaseQuery<P extends Record<string, any>, C extends (r: any) => void> {
  private oldQuery: P | undefined
  private oldCallback: C | undefined

  constructor (dontDestroy?: boolean) {
    if (dontDestroy !== true) {
      const destroyFn = getOnDestroy()
      destroyFn(() => {
        this.unsubscribe()
      })
    }
  }

  unsubscribe: () => void = () => {}

  query (params: P, callback: C): boolean {
    if (!this.needUpdate(params, callback)) {
      return false
    }
    this.doQuery(params, callback)
    return true
  }

  private doQuery (query: P, callback: C): void {
    this.unsubscribe()
    this.oldCallback = callback
    this.oldQuery = query

    const { unsubscribe } = this.createQuery(query, callback)
    this.unsubscribe = () => {
      unsubscribe()
      this.oldCallback = undefined
      this.oldQuery = undefined
      this.unsubscribe = () => {}
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createQuery (params: P, callback: C): { unsubscribe: () => void } {
    return {
      unsubscribe: () => {}
    }
  }

  private needUpdate (params: P, callback: C): boolean {
    if (!deepEqual(params, this.oldQuery)) return true
    if (!deepEqual(callback.toString(), this.oldCallback?.toString())) return true
    return false
  }
}

export class MessagesQuery extends BaseQuery<MessageQueryParams, PagedQueryCallback<Message>> {
  override createQuery (params: MessageQueryParams, callback: PagedQueryCallback<Message>): { unsubscribe: () => void } {
    return getLiveQueries().queryMessages(params, callback)
  }
}

export class NotificationsQuery extends BaseQuery<FindNotificationsParams, PagedQueryCallback<Notification>> {
  override createQuery (
    params: FindNotificationsParams,
    callback: PagedQueryCallback<Notification>
  ): {
      unsubscribe: () => void
    } {
    return getLiveQueries().queryNotifications(params, callback)
  }
}

export class NotificationContextsQuery extends BaseQuery<
FindNotificationContextParams,
PagedQueryCallback<NotificationContext>
> {
  override createQuery (
    params: FindNotificationContextParams,
    callback: PagedQueryCallback<NotificationContext>
  ): {
      unsubscribe: () => void
    } {
    return getLiveQueries().queryNotificationContexts(params, callback)
  }
}

export class LabelsQuery extends BaseQuery<FindLabelsParams, QueryCallback<Label>> {
  override createQuery (
    params: FindLabelsParams,
    callback: QueryCallback<Label>
  ): {
      unsubscribe: () => void
    } {
    return getLiveQueries().queryLabels(params, callback)
  }
}

export class CollaboratorsQuery extends BaseQuery<FindCollaboratorsParams, QueryCallback<Collaborator>> {
  override createQuery (
    params: FindCollaboratorsParams,
    callback: QueryCallback<Collaborator>
  ): {
      unsubscribe: () => void
    } {
    return getLiveQueries().queryCollaborators(params, callback)
  }
}
