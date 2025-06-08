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

import {
  type EventResult,
  MessageRequestEventType,
  type RequestEvent,
  type SessionData
} from '@hcengineering/communication-sdk-types'
import { systemAccountUuid } from '@hcengineering/core'

import type { Enriched, Middleware, MiddlewareContext } from '../types'
import { BaseMiddleware } from './base'
import {MonotonicTimestamp} from "../monotonic.ts";
import type {MessageID} from "@hcengineering/communication-types";
import {isExternalMessageId} from "../utils.ts";
import {ApiError} from "../error.ts";

export class DateMiddleware extends BaseMiddleware implements Middleware {
  constructor (
    readonly context: MiddlewareContext,
    next?: Middleware
  ) {
    super(context, next)
  }

  async event(session: SessionData, event: Enriched<RequestEvent>, derived: boolean): Promise<EventResult> {
    const canSetDate = derived || this.isSystem(session)

    if (event.type === MessageRequestEventType.CreateMessage) {
      if(event.messageId != null  && !derived && !event.messageId.startsWith('e')) {
        throw ApiError.badRequest('External message id must start with "e"')
      }
      if(event.messageId == null && (event.date == null || !canSetDate)) {
        const timestamp = MonotonicTimestamp.now()
        event.messageId = timestamp.toString() as MessageID
        event.date = new Date(timestamp)
      }else if(event.messageId != null && event.date == null) {
        event.date = isExternalMessageId(event.messageId) ? new Date() : new Date(Number(event.messageId))
      }else if(event.messageId == null && event.date != null) {
        event.messageId =`e${MonotonicTimestamp.now()}` as MessageID
      }
    }else if(!canSetDate || event.date == null) {
      event.date = new Date()
    }

    return await this.provideEvent(session, event, derived)
  }

  private isSystem (session: SessionData): boolean {
    const account = session.account
    return systemAccountUuid === account.uuid
  }
}
