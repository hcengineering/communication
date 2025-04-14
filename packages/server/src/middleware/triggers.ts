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

import type { DbAdapter, RequestEvent, ResponseEvent, SessionData } from '@hcengineering/communication-sdk-types'
import type { MeasureContext } from '@hcengineering/core'

import triggers from '../triggers/all'
import type { Middleware, MiddlewareContext, TriggerCtx, TriggersDb } from '../types'
import { BaseMiddleware } from './base'
import { notify } from '../notification/notification'

export class TriggersMiddleware extends BaseMiddleware implements Middleware {
  private readonly ctx: MeasureContext

  constructor(
    private readonly db: TriggersDb,
    context: MiddlewareContext,
    next?: Middleware
  ) {
    super(context, next)
    this.ctx = context.ctx.newChild('triggers', {})
  }

  async response(session: SessionData, event: ResponseEvent): Promise<void> {
    const matchedTriggers = triggers.filter(([_, type]) => type === event.type)
    if (matchedTriggers.length === 0) return

    const ctx: Omit<TriggerCtx, 'ctx'> = {
      metadata: this.context.metadata,
      db: this.db,
      workspace: this.context.workspace,
      account: session.account,
      registeredCards: this.context.registeredCards,
      execute: async (event: RequestEvent) => {
        return (await this.context.head?.event(session, event, true)) ?? {}
      }
    }

    const derived = (
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

    await Promise.all(derived.map((d) => this.context.head?.event(session, d, true)))
    void notify(
      {
        ...ctx,
        ctx: this.ctx.newChild('create-notifications', {})
      },
      event
    )
  }
}

export function createTriggersDb(db: DbAdapter): TriggersDb {
  return {
    findMessagesGroups: db.findMessagesGroups,
    findMessages: db.findMessages,
    findCollaborators: db.findCollaborators,
    findNotifications: db.findNotifications,
    findNotificationContexts: db.findNotificationContexts,
    findLabels: db.findLabels,
    findThread: db.findThread,
    getCollaboratorsCursor: db.getCollaboratorsCursor
  }
}
