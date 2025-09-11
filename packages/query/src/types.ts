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

import { EventResult, Event } from '@hcengineering/communication-sdk-types'
import {
  SortingOrder,
  type Window,
  type CardID,
  type MessageID,
  FindNotificationsParams
} from '@hcengineering/communication-types'

import { QueryResult } from './result'

export type QueryId = number

export const defaultQueryParams = {
  limit: 50,
  order: SortingOrder.Ascending
}

export enum Direction {
  Forward = 1,
  Backward = -1
}

export type FindParams = Partial<typeof defaultQueryParams>

interface BaseQuery<R = any, P = FindParams> {
  readonly id: QueryId
  readonly params: P

  onEvent: (event: Event) => Promise<void>
  onRequest: (event: Event, promise: Promise<EventResult>) => Promise<void>

  unsubscribe: () => Promise<void>

  removeCallback: () => void
  setCallback: (callback: (result: any) => void) => void
  copyResult: () => QueryResult<R> | undefined

  refresh: () => Promise<void>
}

export interface PagedQuery<R = any, P = FindParams> extends BaseQuery<R, P> {
  readonly id: QueryId
  readonly params: P
  nexLoadedPagesCount: number
  prevLoadedPagesCount: number

  requestLoadNextPage: (notify?: boolean) => Promise<{ isDone: boolean }>
  requestLoadPrevPage: (notify?: boolean) => Promise<{ isDone: boolean }>
  setCallback: (callback: (window: Window<R>) => void) => void
}

export interface Query<R = any, P = FindParams> extends BaseQuery<R, P> {
  setCallback: (callback: (result: R[]) => void) => void
}

export type AnyQuery = Query | PagedQuery

interface BaseMessageQueryParams {
  cardId: CardID

  limit?: number
  order?: SortingOrder

  // TODO: move to options
  attachments?: boolean
  reactions?: boolean
  replies?: boolean
}

export interface ManyMessagesQueryParams extends BaseMessageQueryParams {
  from?: Date
  strict?: boolean
}

export interface OneMessageQueryParams extends BaseMessageQueryParams {
  id: MessageID
  created: Date
  from?: never
  strict?: never
}

export type MessageQueryParams = OneMessageQueryParams | ManyMessagesQueryParams
export type NotificationQueryParams = FindNotificationsParams & { strict?: boolean }
