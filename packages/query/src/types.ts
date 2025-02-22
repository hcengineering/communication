import { type ResponseEvent } from '@hcengineering/communication-sdk-types'
import { SortingOrder, type Window } from '@hcengineering/communication-types'

import { QueryResult } from './result.ts'

export type QueryId = number

export const defaultQueryParams = {
  limit: 50,
  order: SortingOrder.Ascending
}

//TODO???????
export type FindParams = Partial<typeof defaultQueryParams>

export interface PagedQuery<R = any, P = FindParams> {
  readonly id: QueryId
  readonly params: P

  onEvent(event: ResponseEvent): Promise<void>

  loadForward(): Promise<void>
  loadBackward(): Promise<void>

  unsubscribe(): Promise<void>

  setCallback(callback: (window: Window<R>) => void): void
  removeCallback(): void
  copyResult(): QueryResult<R> | undefined
}
