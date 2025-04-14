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

import type { MeasureContext } from '@hcengineering/core'
import type { DbAdapter, EventResult, RequestEvent, SessionData } from '@hcengineering/communication-sdk-types'
import type {
  FindLabelsParams,
  FindMessagesGroupsParams,
  FindMessagesParams,
  FindNotificationContextParams,
  FindNotificationsParams,
  Label,
  Message,
  MessagesGroup,
  Notification,
  NotificationContext,
  WorkspaceID
} from '@hcengineering/communication-types'

import type {
  BroadcastSessionsFunc,
  Metadata,
  Middleware,
  MiddlewareContext,
  MiddlewareCreateFn,
  QueryId
} from './types'
import { PermissionsMiddleware } from './middleware/permissions'
import { DatabaseMiddleware } from './middleware/db'
import { BroadcastMiddleware } from './middleware/broadcast'
import { createTriggersDb, TriggersMiddleware } from './middleware/triggers'
import { ValidateMiddleware } from './middleware/validate'

export async function buildMiddlewares(
  ctx: MeasureContext,
  workspace: WorkspaceID,
  metadata: Metadata,
  db: DbAdapter,
  broadcast: BroadcastSessionsFunc
): Promise<Middlewares> {
  const createFns: MiddlewareCreateFn[] = [
    async (context, next) => new ValidateMiddleware(context, next),
    async (context, next) => new PermissionsMiddleware(context, next),
    async (context, next) => new BroadcastMiddleware(broadcast, context, next),
    async (context, next) => new DatabaseMiddleware(db, context, next),
    async (context, next) => new TriggersMiddleware(createTriggersDb(db), context, next)
  ]

  const context: MiddlewareContext = {
    ctx,
    metadata,
    workspace,
    registeredCards: new Set()
  }

  return await Middlewares.create(ctx, context, createFns)
}

export class Middlewares {
  private head: Middleware | undefined

  private readonly middlewares: Middleware[] = []

  private constructor(
    private readonly ctx: MeasureContext,
    private readonly context: MiddlewareContext
  ) {}

  static async create(
    ctx: MeasureContext,
    context: MiddlewareContext,
    createFns: MiddlewareCreateFn[]
  ): Promise<Middlewares> {
    const pipeline = new Middlewares(ctx, context)

    pipeline.head = await pipeline.buildChain(ctx, createFns, pipeline.context)
    context.head = pipeline.head
    return pipeline
  }

  private async buildChain(
    ctx: MeasureContext,
    createFns: MiddlewareCreateFn[],
    context: MiddlewareContext
  ): Promise<Middleware | undefined> {
    let current: Middleware | undefined = undefined
    for (let index = createFns.length - 1; index >= 0; index--) {
      const createFn = createFns[index]
      try {
        const nextCurrent = await createFn(context, current)
        this.middlewares.push(nextCurrent)
        current = nextCurrent
      } catch (err: any) {
        ctx.error('failed to initialize middlewares', { err, workspace: context.workspace })
        await this.close()
        throw err
      }
    }
    this.middlewares.reverse()

    return current
  }

  async findMessages(session: SessionData, params: FindMessagesParams, queryId?: QueryId): Promise<Message[]> {
    if (this.head === undefined) return []
    return await this.head.findMessages(session, params, queryId)
  }

  async findMessagesGroups(session: SessionData, params: FindMessagesGroupsParams): Promise<MessagesGroup[]> {
    if (this.head === undefined) return []
    return await this.head.findMessagesGroups(session, params)
  }

  async findNotificationContexts(
    session: SessionData,
    params: FindNotificationContextParams,
    queryId?: QueryId
  ): Promise<NotificationContext[]> {
    if (this.head === undefined) return []
    return await this.head.findNotificationContexts(session, params, queryId)
  }

  async findNotifications(
    session: SessionData,
    params: FindNotificationsParams,
    queryId?: QueryId
  ): Promise<Notification[]> {
    if (this.head === undefined) return []
    return await this.head.findNotifications(session, params, queryId)
  }

  async findLabels(session: SessionData, params: FindLabelsParams): Promise<Label[]> {
    if (this.head === undefined) return []
    return await this.head.findLabels(session, params)
  }

  async unsubscribeQuery(session: SessionData, id: number): Promise<void> {
    if (this.head === undefined) return
    this.head?.unsubscribeQuery(session, id)
  }

  async event(session: SessionData, event: RequestEvent): Promise<EventResult> {
    if (this.head === undefined) return {}
    return (await this.head?.event(session, event, false)) ?? {}
  }

  async closeSession(sessionId: string): Promise<void> {
    if (this.head === undefined) return
    this.head.closeSession(sessionId)
  }

  async close(): Promise<void> {
    for (const mw of this.middlewares) {
      try {
        mw.close()
      } catch (err: any) {
        this.ctx.error('Failed to close middleware', { err, workspace: this.context.workspace })
      }
    }
  }
}
