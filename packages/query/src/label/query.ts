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

import type {FindLabelsParams, Label, WorkspaceID} from '@hcengineering/communication-types'
import {
  type EventResult,
  type LabelCreatedEvent,
  type LabelRemovedEvent,
  LabelResponseEventType,
  type QueryCallback,
  type RequestEvent,
  type ResponseEvent,
} from '@hcengineering/communication-sdk-types'

import {QueryResult} from '../result'
import {type Query, type QueryClient, type QueryId} from '../types'


function getId (label: Label): string {
  return `${label.label}:${label.card}:${label.account}`
}

export class LabelsQuery implements Query<Label, FindLabelsParams> {
  private result: Promise<QueryResult<Label>> | QueryResult<Label>


  constructor (
    private readonly client: QueryClient,
    private readonly workspace: WorkspaceID,
    private readonly filesUrl: string,
    public readonly id: QueryId,
    public readonly params: FindLabelsParams,
    private callback?: QueryCallback<Label>,
    initialResult?: QueryResult<Label>
  ) {
    if (initialResult !== undefined) {
      this.result = initialResult
      void this.notify()
    } else {
      this.result = this.initResult()
    }
  }

  async onEvent (event: ResponseEvent): Promise<void> {
    switch (event.type) {
      case LabelResponseEventType.LabelCreated:
        await this.onLabelCreated(event)
        break
      case LabelResponseEventType.LabelRemoved:
        await this.onLabelRemoved(event)
        break
    }
  }

  async onLabelCreated (event: LabelCreatedEvent): Promise<void> {
    if(this.result instanceof Promise) this.result = await this.result
    if(this.params.limit && this.result.length >= this.params.limit) return

    const match = this.match(event.label)
    if(!match) return
    const existing = this.result.get(getId(event.label))
    if(existing) return
    this.result.push(event.label)
    void this.notify()
  }

  async onLabelRemoved (event: LabelRemovedEvent): Promise<void> {
    if(this.result instanceof Promise) this.result = await this.result

    const existing = this.result.getResult().find((it) => it.account === event.account && it.card === event.card && it.label === event.label)
    if(existing === undefined) return
    const prevLength = this.result.length
    this.result.delete(getId(existing))

    if(this.params.limit && this.result.length < this.params.limit && prevLength >= this.params.limit) {
      const labels =await this.find(this.params)
      this.result = new QueryResult(labels, getId)
    }

    void this.notify()
  }

  async onRequest (event: RequestEvent, promise: Promise<EventResult>): Promise<void> {}

  private async initResult (): Promise<QueryResult<Label>> {
    try {
      const res = await this.find(this.params)
      const result = new QueryResult(res, getId)

      void this.notify()
      return result
    } catch (error) {
      console.error('Failed to initialize query:', error)
      return new QueryResult([] as Label[], getId)
    }
  }


  async unsubscribe (): Promise<void> {
    await this.client.unsubscribeQuery(this.id)
  }


  removeCallback (): void {
    this.callback = () => {}
  }

  setCallback (callback: QueryCallback<Label>): void {
    this.callback = callback
    void this.notify()
  }

  copyResult (): QueryResult<Label> | undefined {
    if (this.result instanceof Promise) {
      return undefined
    }

    return this.result.copy()
  }


  private async find (params: FindLabelsParams): Promise<Label[]> {
    return await this.client.findLabels(params, this.id)
  }

  private async notify (): Promise<void> {
    if (this.callback == null) return
    if (this.result instanceof Promise) this.result = await this.result
    const result = this.result.getResult()
    this.callback(result)
  }

  private match (label: Label): boolean {
    if (this.params.account != null && this.params.account !== label.account) {
      return false
    }
    if (this.params.card != null && this.params.card !== label.card) {
      return false
    }
    if (this.params.label != null && this.params.label !== label.label) {
      return false
    }
    if (this.params.cardType != null) {
      const types = Array.isArray(this.params.cardType) ? this.params.cardType : [this.params.cardType]
      if(!types.includes(label.cardType)) {
        return false
      }
    }
    return true
  }
}
