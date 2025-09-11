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
  CardEventType,
  type Event,
  EventResult,
  LabelEventType,
  MessageEventType,
  NotificationEventType,
  PeerEventType,
  type SessionData
} from '@hcengineering/communication-sdk-types'
import type {
  AccountUuid,
  CardID,
  FindLabelsParams,
  FindMessagesGroupsParams,
  FindMessagesParams,
  FindNotificationContextParams,
  FindNotificationsParams,
  Label,
  Message,
  MessageID,
  MessagesGroup,
  Notification,
  NotificationContext
} from '@hcengineering/communication-types'

import type { CommunicationCallbacks, Enriched, Middleware, MiddlewareContext, QueryId } from '../types'
import { BaseMiddleware } from './base'

interface SessionInfo {
  account: AccountUuid
  messageQueries: Map<QueryId, FindMessagesParams>
  contextQueries: Map<QueryId, Set<CardID>>
}

export class BroadcastMiddleware extends BaseMiddleware implements Middleware {
  private readonly dataBySessionId = new Map<string, SessionInfo>()

  constructor (
    private readonly callbacks: CommunicationCallbacks,
    readonly context: MiddlewareContext,
    next?: Middleware
  ) {
    super(context, next)
  }

  async findMessages (session: SessionData, params: FindMessagesParams, queryId?: QueryId): Promise<Message[]> {
    this.createSession(session)

    const result = await this.provideFindMessages(session, params, queryId)
    if (queryId != null && session.sessionId != null && session.sessionId !== '') {
      this.subscribeMessageQuery(session, queryId, params)
    }
    return result
  }

  async findMessagesGroups (
    session: SessionData,
    params: FindMessagesGroupsParams,
    queryId?: QueryId
  ): Promise<MessagesGroup[]> {
    this.createSession(session)
    return await this.provideFindMessagesGroups(session, params, queryId)
  }

  async findNotificationContexts (
    session: SessionData,
    params: FindNotificationContextParams,
    queryId?: QueryId
  ): Promise<NotificationContext[]> {
    this.createSession(session)

    const result = await this.provideFindNotificationContexts(session, params, queryId)
    if (queryId != null && session.sessionId != null && session.sessionId !== '') {
      this.subscribeContextQuery(session, queryId, result)
    }
    return result
  }

  async findNotifications (
    session: SessionData,
    params: FindNotificationsParams,
    queryId?: QueryId
  ): Promise<Notification[]> {
    this.createSession(session)
    return await this.provideFindNotifications(session, params, queryId)
  }

  async findLabels (session: SessionData, params: FindLabelsParams, queryId?: QueryId): Promise<Label[]> {
    this.createSession(session)
    return await this.provideFindLabels(session, params, queryId)
  }

  async event (session: SessionData, event: Enriched<Event>, derived: boolean): Promise<EventResult> {
    this.createSession(session)
    return await this.provideEvent(session, event, derived)
  }

  unsubscribeQuery (session: SessionData, queryId: number): void {
    if (session.sessionId == null) return
    const data = this.dataBySessionId.get(session.sessionId)
    if (data == null) return

    data.messageQueries.delete(queryId)
    data.contextQueries.delete(queryId)
  }

  handleBroadcast (session: SessionData, events: Enriched<Event>[]): void {
    if (events.length === 0) return
    const sessionIds: Record<string, Enriched<Event>[]> = {}

    for (const [sessionId, session] of this.dataBySessionId.entries()) {
      sessionIds[sessionId] = events.filter((it) => this.match(it, session))
    }

    const ctx = this.context.ctx.newChild('enqueue', {})
    ctx.contextData = session.contextData

    if (Object.keys(sessionIds).length > 0) {
      try {
        this.callbacks.broadcast(ctx, sessionIds)
      } catch (e) {
        this.context.ctx.error('Failed to broadcast event', { error: e })
      }
    }

    try {
      this.callbacks.enqueue(ctx, events)
    } catch (e) {
      this.context.ctx.error('Failed to broadcast event', { error: e })
    }
  }

  closeSession (sessionId: string): void {
    this.dataBySessionId.delete(sessionId)
  }

  close (): void {
    this.dataBySessionId.clear()
  }

  private subscribeMessageQuery (session: SessionData, queryId: QueryId, params: Record<string, any>): void {
    const data = this.createSession(session)
    if (data == null) return

    data.messageQueries.set(queryId, params as FindMessagesParams)
  }

  private subscribeContextQuery (session: SessionData, queryId: QueryId, result: NotificationContext[]): void {
    const data = this.createSession(session)
    if (data == null) return

    const cards = new Set(result.map((it) => it.cardId))
    const current = data.contextQueries.get(queryId) ?? new Set()

    data.contextQueries.set(queryId, new Set([...current, ...cards]))
  }

  private createSession (session: SessionData): SessionInfo | undefined {
    const id = session.sessionId
    if (id == null) return
    if (!this.dataBySessionId.has(id)) {
      this.dataBySessionId.set(id, {
        account: session.account.uuid,
        messageQueries: new Map(),
        contextQueries: new Map()
      })
    }

    return this.dataBySessionId.get(id)
  }

  private match (event: Enriched<Event>, info: SessionInfo): boolean {
    switch (event.type) {
      case MessageEventType.CreateMessage:
        if (event.messageId == null) return false
        return this.matchMessagesQuery(
          { ids: [event.messageId], cardId: event.cardId },
          Array.from(info.messageQueries.values()),
          new Set(Array.from(info.contextQueries.values()).flatMap((it) => Array.from(it)))
        )
      case MessageEventType.ThreadPatch:
      case MessageEventType.ReactionPatch:
      case MessageEventType.BlobPatch:
      case MessageEventType.AttachmentPatch:
      case MessageEventType.RemovePatch:
      case MessageEventType.UpdatePatch:
        return this.matchMessagesQuery(
          { cardId: event.cardId, ids: [event.messageId] },
          Array.from(info.messageQueries.values()),
          new Set(Array.from(info.contextQueries.values()).flatMap((it) => Array.from(it)))
        )
      case NotificationEventType.RemoveNotifications:
      case NotificationEventType.CreateNotification:
      case NotificationEventType.UpdateNotification:
      case NotificationEventType.RemoveNotificationContext:
      case NotificationEventType.UpdateNotificationContext:
      case NotificationEventType.CreateNotificationContext:
        return info.account === event.account
      case MessageEventType.CreateMessagesGroup:
      case MessageEventType.RemoveMessagesGroup:
        return false
      case NotificationEventType.RemoveCollaborators:
      case NotificationEventType.AddCollaborators:
        return true
      case LabelEventType.CreateLabel:
      case LabelEventType.RemoveLabel:
        return info.account === event.account
      case CardEventType.UpdateCardType:
      case CardEventType.RemoveCard:
        return true
      case PeerEventType.RemovePeer:
      case PeerEventType.CreatePeer:
        return false
    }
  }

  private matchMessagesQuery (
    params: { ids: MessageID[], cardId: CardID },
    queries: FindMessagesParams[],
    cards: Set<CardID>
  ): boolean {
    if (cards.has(params.cardId)) return true
    if (queries.length === 0) return false

    for (const query of queries) {
      if (query.id != null && !params.ids.includes(query.id)) continue
      if (query.cardId != null && query.cardId !== params.cardId) continue
      return true
    }

    return false
  }
}
