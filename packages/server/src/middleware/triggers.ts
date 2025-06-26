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

import type { DbAdapter, Event, EventResult, SessionData } from '@hcengineering/communication-sdk-types'
import type { MeasureContext } from '@hcengineering/core'

import type { Enriched, Middleware, MiddlewareContext, TriggerCtx } from '../types'
import { BaseMiddleware } from './base'
import triggers from '../triggers/all'
import { notify } from '../notification/notification'

export class TriggersMiddleware extends BaseMiddleware implements Middleware {
  private ctx: MeasureContext

  constructor (
    private readonly db: DbAdapter,
    context: MiddlewareContext,
    next?: Middleware
  ) {
    super(context, next)
    this.ctx = context.ctx.newChild('triggers', {})
    setInterval(
      () => {
        this.context.registeredCards.clear()
      },
      60 * 60 * 1000
    ) // 1hour
  }

  async event (session: SessionData, event: Enriched<Event>, derived: boolean): Promise<EventResult> {
    const result = await this.provideEvent(session, event, derived)
    if (event.skipPropagate === true) {
      return result
    }

    await this.processDerived(session, [event], derived)

    return result
  }

  async processDerived (session: SessionData, events: Enriched<Event>[], derived: boolean): Promise<void> {
    const ctx: Omit<TriggerCtx, 'ctx'> = {
      metadata: this.context.metadata,
      db: this.db,
      workspace: this.context.workspace,
      account: session.account,
      registeredCards: this.context.registeredCards,
      accountBySocialID: this.context.accountBySocialID,
      removedContexts: this.context.removedContexts,
      derived,
      execute: async (event: Event) => {
        // Will be enriched in head
        return (await this.context.head?.event(session, event as Enriched<Event>, true)) ?? {}
      }
    }

    if (!derived && session.isAsyncContext !== true && session.contextData !== undefined) {
      session.isAsyncContext = true
      session.contextData.asyncRequests = [
        ...(session.contextData.asyncRequests ?? []),
        async (_ctx) => {
          this.ctx = _ctx
          await this.callAsyncTriggers({ ...ctx, ctx: this.ctx }, session, events)
          this.handleBroadcast(
            session,
            (session.asyncData as Enriched<Event>[]).sort((a, b) => a.date.getTime() - b.date.getTime()),
            true
          )
          session.asyncData = []
        }
      ]
    } else {
      await this.callAsyncTriggers({ ...ctx, ctx: this.ctx }, session, events)

      // Workaround for async events from triggers of core pipeline
      if (session.isAsyncContext !== true) {
        this.handleBroadcast(
          session,
          (session.asyncData as Enriched<Event>[]).sort((a, b) => a.date.getTime() - b.date.getTime()),
          true
        )
        session.asyncData = []
      }
    }
  }

  private async callAsyncTriggers (ctx: TriggerCtx, session: SessionData, events: Enriched<Event>[]): Promise<void> {
    const fromTriggers = await this.runTriggers({ ...ctx, ctx: this.ctx }, events)
    await Promise.all(fromTriggers.map((d) => this.context.head?.event(session, d as Enriched<Event>, true)))
    const triggersDerived = (fromTriggers as Enriched<Event>[]).filter((it) => it.skipPropagate !== true)
    session.asyncData = [...session.asyncData, ...triggersDerived]

    await this.callAsyncNotifications(ctx, session, events)
  }

  private async callAsyncNotifications (
    ctx: TriggerCtx,
    session: SessionData,
    events: Enriched<Event>[]
  ): Promise<void> {
    const notifications = (
      await Promise.all(
        events.map(async (event) => {
          return await notify(
            {
              ...ctx,
              ctx: this.ctx.newChild('create-notifications', {})
            },
            event
          )
        })
      )
    ).flat()
    await Promise.all(notifications.map((d) => this.context.head?.event(session, d as Enriched<Event>, true)))
    const notificationsDerived = (notifications as Enriched<Event>[]).filter((it) => it.skipPropagate !== true)
    session.asyncData = [...session.asyncData, ...notificationsDerived]
  }

  private async runTriggers (ctx: TriggerCtx, events: Enriched<Event>[]): Promise<Event[]> {
    return (
      await Promise.all(
        events.map(async (event) => {
          return await this.applyTriggers(event, ctx)
        })
      )
    ).flat()
  }

  private async applyTriggers (event: Enriched<Event>, ctx: Omit<TriggerCtx, 'ctx'>): Promise<Event[]> {
    const matchedTriggers = triggers.filter(([_, type]) => type === event.type)
    if (matchedTriggers.length === 0) return []

    return (
      await Promise.all(
        matchedTriggers.map(([name, _, fn]) =>
          fn(
            {
              ...ctx,
              ctx: this.ctx.newChild(name, {})
            },
            event
          )
        )
      )
    ).flat()
  }
}
