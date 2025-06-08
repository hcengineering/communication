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
  type FindMessagesGroupsParams,
  type FindMessagesParams,
  type LinkPreview,
  type Message,
  type MessageID,
  type MessagesGroup,
  MessageType,
  type ParsedFile,
  type Patch,
  PatchType,
  type Reaction,
  SortingOrder,
  type WorkspaceID,
  type AttachedBlob
} from '@hcengineering/communication-types'
import {
  type CardRemovedEvent,
  CardResponseEventType,
  type CreateMessageEvent,
  type CreateMessageResult,
  type EventResult,
  type BlobAttachedEvent,
  type BlobDetachedEvent,
  type FindClient,
  type LinkPreviewCreatedEvent,
  type LinkPreviewRemovedEvent,
  type MessageCreatedEvent,
  MessageRequestEventType,
  MessageResponseEventType,
  type PagedQueryCallback,
  type PatchCreatedEvent,
  type ReactionSetEvent,
  type ReactionRemovedEvent,
  type RequestEvent,
  type ResponseEvent,
  type ThreadAttachedEvent
} from '@hcengineering/communication-sdk-types'
import { applyPatches } from '@hcengineering/communication-shared'
import { loadGroupFile } from '@hcengineering/communication-yaml'
import { v4 as uuid } from 'uuid'

import { QueryResult } from '../result'
import {
  defaultQueryParams,
  Direction,
  type MessageQueryParams,
  type OneMessageQueryParams,
  type PagedQuery,
  type QueryId
} from '../types'
import { WindowImpl } from '../window'
import { attachBlob, addLinkPreview, addReaction, detachBlob, removeLinkPreview, removeReaction } from '../utils.ts'

const GROUPS_LIMIT = 4

export class MessagesQuery implements PagedQuery<Message, MessageQueryParams> {
  private result: Promise<QueryResult<Message>> | QueryResult<Message>

  private readonly groupsBuffer: MessagesGroup[] = []

  private firstGroup?: MessagesGroup
  private lastGroup?: MessagesGroup
  private firstLoadedGroup?: MessagesGroup
  private lastLoadedGroup?: MessagesGroup

  private lastGroupsDirection?: Direction

  private readonly limit: number
  private initialized = false

  private readonly next = {
    hasMessages: true,
    hasGroups: true,
    buffer: [] as Message[]
  }

  private readonly prev = {
    hasMessages: true,
    hasGroups: true,
    buffer: [] as Message[]
  }

  private attachedBlobs: Map<MessageID, AttachedBlob[]> = new Map()
  private createdReactions: Map<MessageID, Reaction[]> = new Map()
  private createdLinkPreviews: Map<MessageID, LinkPreview[]> = new Map()
  private createdPatches: Map<MessageID, Patch[]> = new Map()

  private readonly tmpMessages = new Map<string, MessageID>()
  private isCardRemoved = false

  constructor (
    private readonly client: FindClient,
    private readonly workspace: WorkspaceID,
    private readonly filesUrl: string,
    public readonly id: QueryId,
    public readonly params: MessageQueryParams,
    private callback?: PagedQueryCallback<Message>,
    initialResult?: QueryResult<Message>
  ) {
    const baseLimit = 'id' in params && params.id != null ? 1 : (this.params.limit ?? defaultQueryParams.limit)
    this.limit = baseLimit + 1
    this.params = {
      ...params,
      order: params.order ?? defaultQueryParams.order
    }
    if (initialResult !== undefined) {
      const messages = initialResult.getResult()
      const count = messages.length

      if (count < this.limit) {
        this.result = initialResult
        this.initialized = true
      } else {
        if (this.params.order === SortingOrder.Ascending) {
          this.result = new QueryResult(messages.slice(0, baseLimit), (x) => x.id)
          this.result.setHead(true)
          this.result.setTail(false)
        } else {
          this.result = new QueryResult(messages.slice(0, baseLimit), (x) => x.id)
          this.result.setHead(false)
          this.result.setTail(true)
        }
      }
      this.initialized = true
      void this.notify()
    } else {
      this.result = new QueryResult([] as Message[], (x) => x.id)

      if (this.isInitLoadingForward()) {
        this.result.setHead(this.params.from == null)
        void this.requestLoadNextPage()
      } else {
        this.result.setTail(this.params.from == null)
        void this.requestLoadPrevPage()
      }
    }
  }

  async onEvent (event: ResponseEvent): Promise<void> {
    if (this.isCardRemoved) return
    switch (event.type) {
      case MessageResponseEventType.MessageCreated: {
        await this.onMessageCreatedEvent(event)
        break
      }
      case MessageResponseEventType.PatchCreated: {
        await this.onPatchCreatedEvent(event)
        break
      }
      case MessageResponseEventType.ReactionSet: {
        await this.onReactionSetEvent(event)
        break
      }
      case MessageResponseEventType.ReactionRemoved: {
        await this.onReactionRemovedEvent(event)
        break
      }
      case MessageResponseEventType.BlobAttached: {
        await this.onBlobAttachedEvent(event)
        break
      }
      case MessageResponseEventType.BlobDetached: {
        await this.onBlobDetachedEvent(event)
        break
      }
      case MessageResponseEventType.LinkPreviewCreated: {
        await this.onLinkPreviewCreatedEvent(event)
        break
      }
      case MessageResponseEventType.LinkPreviewRemoved: {
        await this.onLinkPreviewRemovedEvent(event)
        break
      }
      case MessageResponseEventType.ThreadAttached:
        await this.onThreadAttachedEvent(event)
        break
      case CardResponseEventType.CardRemoved:
        await this.onCardRemoved(event)
        break
    }
  }

  async onCardRemoved (event: CardRemovedEvent): Promise<void> {
    if (this.result instanceof Promise) this.result = await this.result
    if (this.params.card === event.cardId) {
      this.isCardRemoved = true
      this.result.deleteAll()
      this.result.setHead(true)
      this.result.setTail(true)
      void this.notify()
      return
    }

    if (this.params.replies === true) {
      const result = this.result.getResult()
      for (const message of result) {
        if (message.thread != null && message.thread.threadId === event.cardId) {
          this.result.update({
            ...message,
            thread: undefined
          })
        }
      }
    }
  }

  async onRequest (event: RequestEvent, promise: Promise<EventResult>): Promise<void> {
    if (this.isCardRemoved) return
    switch (event.type) {
      case MessageRequestEventType.CreateMessage: {
        await this.onCreateMessageRequest(event, promise as Promise<CreateMessageResult>)
        break
      }
    }
  }

  async onCreateMessageRequest(event: CreateMessageEvent, promise: Promise<CreateMessageResult>): Promise<void> {
    if (this.params.card !== event.cardId) return
    const eventId = event._id
    if (eventId == null || event.socialId == null) return

    const tmpId = uuid() as MessageID
    let resultId: MessageID | undefined
    const tmpMessage: Message = {
      id: tmpId,
      type: MessageType.Message,
      removed: false,
      cardId: event.cardId,
      content: event.content,
      creator: event.socialId,
      created: new Date(),
      extra: event.extra,
      edited: undefined,
      thread: undefined,
      reactions: [],
      blobs: [],
      linkPreviews: []
    }

    if (!this.match(tmpMessage)) return

    promise
      .then(async (result) => {
        this.tmpMessages.delete(eventId)
        resultId = result.messageId
        if (this.result instanceof Promise) this.result = await this.result

        if (this.result.get(resultId) != null) {
          if (this.result.delete(tmpId) != null) {
            await this.notify()
          }
        } else {
          const updatedMessage = this.fillMessage({ ...tmpMessage, id: resultId })
          this.result.delete(tmpId)

          this.insertMessage(this.result, updatedMessage)

          void this.notify()
        }
      })
      .catch(async () => {
        if (this.result instanceof Promise) this.result = await this.result
        this.tmpMessages.delete(eventId)
        if (this.result.delete(tmpId) != null) {
          void this.notify()
        }
      })

    if (this.result instanceof Promise) this.result = await this.result

    if (resultId === undefined && this.result.isTail()) {
      this.tmpMessages.set(eventId, tmpId)
      this.insertMessage(this.result, tmpMessage)
      void this.notify()
    }
  }

  private insertMessage (result: QueryResult<Message>, message: Message): void {
    if (this.params.order === SortingOrder.Ascending) {
      result.push(message)
    } else {
      result.unshift(message)
    }
  }

  async unsubscribe (): Promise<void> {
    await this.client.unsubscribeQuery(this.id)
  }

  async requestLoadNextPage (): Promise<void> {
    if (this.isCardRemoved) return
    if (this.result instanceof Promise) this.result = await this.result

    if (!this.result.isTail()) {
      this.result = this.loadPage(Direction.Forward, this.result)
      void this.result
        .then(() => this.notify())
        .catch((error) => {
          console.error('Failed to load messages', error)
          void this.notify()
        })
    }
  }

  async requestLoadPrevPage (): Promise<void> {
    if (this.isCardRemoved) return
    if (this.result instanceof Promise) this.result = await this.result
    if (!this.result.isHead()) {
      this.result = this.loadPage(Direction.Backward, this.result)
      void this.result
        .then(() => this.notify())
        .catch((error) => {
          console.error('Failed to load messages', error)
          void this.notify()
        })
    }
  }

  removeCallback (): void {
    this.callback = () => {}
  }

  setCallback (callback: PagedQueryCallback<Message>): void {
    this.callback = callback
    void this.notify()
  }

  copyResult (): QueryResult<Message> | undefined {
    if (this.result instanceof Promise) {
      return undefined
    }

    return this.result.copy()
  }

  private isInitLoadingForward (): boolean {
    const { order } = this.params

    if (this.isOneMessageQuery(this.params)) {
      return true
    }

    return order === SortingOrder.Ascending
  }

  private async loadPage (direction: Direction, result: QueryResult<Message>): Promise<QueryResult<Message>> {
    const { messages, fromDb } =
      direction === Direction.Forward ? await this.loadNextMessages(result) : await this.loadPrevMessages(result)

    if (!result.isHead() && direction === Direction.Backward) {
      result.setHead(messages.length < this.limit)
    }
    if (!result.isTail() && direction === Direction.Forward) {
      result.setTail(messages.length < this.limit)
    }

    if (messages.length === this.limit && this.limit > 1) {
      const lastMessage = messages.pop()
      if (lastMessage != null && !fromDb) {
        if (direction === Direction.Forward) {
          this.next.buffer.unshift(lastMessage)
        } else {
          this.prev.buffer.push(lastMessage)
        }
      }
    }

    if (this.params.order === SortingOrder.Ascending && direction === Direction.Backward) {
      result.prepend(messages.reverse())
    } else if (this.params.order === SortingOrder.Descending && direction === Direction.Forward) {
      result.prepend(messages.reverse())
    } else {
      result.append(messages)
    }

    return result
  }

  // Load next
  private async loadNextMessages (result: QueryResult<Message>): Promise<{ messages: Message[], fromDb: boolean }> {
    const messages: Message[] = this.next.buffer.splice(0, this.limit)
    if (messages.length >= this.limit) return { messages, fromDb: false }

    while (this.next.hasGroups || this.groupsBuffer.length > 0) {
      await this.loadGroups(Direction.Forward, result)

      messages.push(...this.next.buffer.splice(0, this.limit - messages.length))

      if (messages.length >= this.limit) return { messages, fromDb: false }
    }

    const dbMessages = await this.findNextMessages(this.limit - messages.length, result)
    this.next.hasMessages = dbMessages.length > 0
    messages.push(...dbMessages)
    return { messages, fromDb: dbMessages.length > 0 }
  }

  private async findNextMessages (limit: number, result: QueryResult<Message>): Promise<Message[]> {
    if (this.next.hasGroups) {
      return []
    }

    if (result.isTail()) return []

    const last = this.params.order === SortingOrder.Ascending ? result.getLast() : result.getFirst()

    return await this.find({
      ...this.params,
      created:
        last != null
          ? {
              greater: last.created
            }
          : this.params.from != null
            ? { greaterOrEqual: this.params.from }
            : undefined,
      limit,
      order: SortingOrder.Ascending
    })
  }

  // Load prev
  private async loadPrevMessages (
    result: QueryResult<Message>
  ): Promise<{ messages: Message[], fromDb: boolean, hasNext?: boolean }> {
    const messages: Message[] = []
    const prevBuffer = this.prev.buffer
    const last = prevBuffer[prevBuffer.length - 1]

    let fromDb = false

    if (this.prev.hasMessages) {
      const prevMessages = await this.findPrevMessages(this.limit, result)
      const first = prevMessages[0]
      this.prev.hasMessages = prevMessages.length > 0

      if (last == null) {
        messages.push(...prevMessages)
        fromDb = true
      } else if (first != null && first.created < last.created) {
        messages.push(...prevMessages)
        fromDb = true
      } else {
        const toPush = this.prev.buffer.splice(-this.limit).reverse()
        messages.push(...toPush)
      }
    }

    if (messages.length >= this.limit) return { messages, fromDb }

    const restLimit = this.limit - messages.length
    const fromBuffer = this.prev.buffer.splice(-restLimit).reverse()
    messages.push(...fromBuffer)

    if (messages.length >= this.limit) return { messages, fromDb: false }
    while (this.prev.hasGroups || this.groupsBuffer.length > 0) {
      await this.loadGroups(Direction.Backward, result)

      const rest = this.limit - messages.length
      const fromBuffer2 = this.prev.buffer.splice(-rest).reverse()

      messages.push(...fromBuffer2)
      if (messages.length >= this.limit) return { messages, fromDb: false }
    }

    return { messages, fromDb: false }
  }

  private async findPrevMessages (limit: number, result: QueryResult<Message>): Promise<Message[]> {
    if (!this.prev.hasMessages || result.isHead()) return []

    const first = this.params.order === SortingOrder.Ascending ? result.getFirst() : result.getLast()

    return await this.find({
      ...this.params,
      created:
        first != null
          ? {
              less: first?.created
            }
          : this.params.from != null
            ? { lessOrEqual: this.params.from }
            : undefined,
      limit,
      order: SortingOrder.Descending
    })
  }

  getLoadGroupsParams (direction: Direction): Pick<FindMessagesGroupsParams, 'fromDate' | 'toDate'> | undefined {
    if (direction === Direction.Forward) {
      if (this.lastGroup != null) {
        return {
          fromDate: {
            greater: this.lastGroup.fromDate
          }
        }
      }

      if (this.params.from instanceof Date) {
        return {
          toDate: {
            greaterOrEqual: this.params.from
          }
        }
      }
    }

    if (direction === Direction.Backward) {
      if (this.firstGroup != null) {
        return {
          fromDate: {
            less: this.firstGroup.fromDate
          }
        }
      }

      if (this.params.from instanceof Date) {
        return {
          fromDate: {
            lessOrEqual: this.params.from
          }
        }
      }
    }

    return undefined
  }

  private async loadGroups (direction: Direction, result: QueryResult<Message>): Promise<void> {
    let messagesCount = 0
    const lastResult = result.getLast()
    const toLoad: MessagesGroup[] = []
    const toBuffer: MessagesGroup[] = []

    while (messagesCount < this.limit) {
      if (this.lastGroupsDirection !== direction && this.groupsBuffer.length > 0) {
        this.groupsBuffer.length = 0
        this.lastGroup = this.lastLoadedGroup
        this.firstGroup = this.firstLoadedGroup

        if (this.lastGroupsDirection === Direction.Backward) {
          this.prev.hasGroups = true
        } else if (this.lastGroupsDirection === Direction.Forward) {
          this.next.hasGroups = true
        }
      }
      this.lastGroupsDirection = direction
      const currentGroups = this.groupsBuffer.splice(direction === Direction.Forward ? 0 : -GROUPS_LIMIT, GROUPS_LIMIT)
      const hasGroups = direction === Direction.Forward ? this.next.hasGroups : this.prev.hasGroups
      if (currentGroups.length === 0 && !hasGroups) break

      const groups =
        currentGroups.length > 0 ? currentGroups : await this.findGroups(direction, this.getLoadGroupsParams(direction))

      if (currentGroups.length === 0) {
        this.firstGroup = direction === Direction.Forward ? (this.firstGroup ?? groups[0]) : groups[groups.length - 1]
        this.lastGroup =
          direction === Direction.Forward
            ? (groups[groups.length - 1] ?? this.lastGroup)
            : (this.lastGroup ?? groups[0])

        if (direction === Direction.Forward) {
          this.next.hasGroups = groups.length >= GROUPS_LIMIT
        } else {
          this.prev.hasGroups = groups.length >= GROUPS_LIMIT
        }
        if (this.isOneMessageQuery(this.params)) {
          this.next.hasGroups = false
          this.prev.hasGroups = false
        }
      }

      const orderedGroups = direction === Direction.Forward ? groups : groups.reverse()

      while (messagesCount < this.limit && orderedGroups.length > 0) {
        const group = direction === Direction.Forward ? orderedGroups.shift() : orderedGroups.pop()
        if (group == null) break
        toLoad.push(group)
        messagesCount += group.count
      }

      this.firstLoadedGroup =
        direction === Direction.Forward ? (this.firstLoadedGroup ?? toLoad[0]) : toLoad[toLoad.length - 1]
      this.lastLoadedGroup =
        direction === Direction.Forward
          ? (toLoad[toLoad.length - 1] ?? this.lastLoadedGroup)
          : (this.lastLoadedGroup ?? toLoad[0])

      while (orderedGroups.length > 0) {
        const group = direction === Direction.Forward ? orderedGroups.shift() : orderedGroups.pop()
        if (group == null) break
        toBuffer.push(group)
        messagesCount += group.count
      }
    }

    if (direction === Direction.Forward) {
      this.groupsBuffer.push(...toBuffer)
    } else {
      this.groupsBuffer.unshift(...toBuffer)
    }

    const parsedFiles = await Promise.all(toLoad.map((group) => this.loadMessagesFromFiles(group)))

    for (const file of parsedFiles) {
      if (file.messages.length === 0) continue
      if (direction === Direction.Forward) {
        const firstInFile = file.messages[0]
        const queryDate =
          lastResult != null && firstInFile.created < lastResult?.created ? lastResult?.created : undefined
        const { next, prev } = this.matchFileMessages(file, direction, result, queryDate)
        this.next.buffer.push(...next)
        this.prev.buffer.push(...prev)
      } else {
        const lastInFile = file.messages[file.messages.length - 1]
        const queryDate =
          lastResult != null && lastInFile.created > lastResult?.created ? lastResult?.created : undefined
        const matched = this.matchFileMessages(file, direction, result, queryDate)
        this.prev.buffer.unshift(...matched.prev)
        this.next.buffer.push(...matched.next)
      }
    }
  }

  private matchFileMessages (
    file: ParsedFile,
    direction: Direction,
    queryResult: QueryResult<Message>,
    filterDate?: Date
  ): { next: Message[], prev: Message[] } {
    let result: Message[] = file.messages
    const params = this.params
    if (this.isOneMessageQuery(params)) {
      const msg = file.messages.find((it) => it.id === params.id)
      result = msg != null ? [msg] : []
    }

    if (filterDate != null) {
      result =
        this.params.order === SortingOrder.Ascending
          ? result.filter((it) => it.created > filterDate)
          : result.filter((it) => it.created < filterDate)
    }

    let prevResult: Message[] = []
    let nextResult: Message[] = []
    const from = this.initialized ? undefined : this.params.from

    const firstFromQueryResult =
      params.order === SortingOrder.Ascending ? queryResult.getFirst() : queryResult.getLast()
    const lastFromFile = result[result.length - 1]
    if (from instanceof Date) {
      for (const message of result) {
        const isNext = params.order === SortingOrder.Ascending ? message.created >= from : message.created > from

        if (isNext) {
          nextResult.push(message)
        } else {
          prevResult.push(message)
        }
      }
    } else if (
      direction === Direction.Backward &&
      (firstFromQueryResult == null || lastFromFile.created < firstFromQueryResult.created)
    ) {
      prevResult = result
    } else {
      nextResult = result
    }

    return { next: nextResult, prev: prevResult }
  }

  private async loadMessagesFromFiles (group: MessagesGroup): Promise<ParsedFile> {
    const parsedFile = await loadGroupFile(this.workspace, this.filesUrl, group, { retries: 5 })
    const patches = group.patches ?? []

    const patchesMap = new Map<MessageID, Patch[]>()
    for (const patch of patches) {
      patchesMap.set(patch.messageId, [...(patchesMap.get(patch.messageId) ?? []), patch])
    }

    return {
      ...parsedFile,
      messages:
        patches.length > 0
          ? parsedFile.messages.map((message) =>
            applyPatches(message, patchesMap.get(message.id) ?? [], this.allowedPatches())
          )
          : parsedFile.messages
    }
  }

  private async findGroupByDate (params: Date): Promise<MessagesGroup | undefined> {
    const groups = await this.client.findMessagesGroups({
      card: this.params.card,
      fromDate: { lessOrEqual: params },
      toDate: { greaterOrEqual: params },
      limit: 1,
      order: SortingOrder.Ascending,
      orderBy: 'fromDate'
    })

    return groups[0]
  }

  private async findGroups (
    direction: Direction,
    date?: Pick<FindMessagesGroupsParams, 'fromDate' | 'toDate'>
  ): Promise<MessagesGroup[]> {
    if (this.isOneMessageQuery(this.params)) {
      const group = await this.findGroupByDate(this.params.created)
      return group !== undefined ? [group] : []
    }

    if (date == null) {
      return await this.client.findMessagesGroups({
        card: this.params.card,
        limit: GROUPS_LIMIT,
        order: direction === Direction.Forward ? SortingOrder.Ascending : SortingOrder.Descending,
        orderBy: 'fromDate'
      })
    }

    return await this.client.findMessagesGroups({
      card: this.params.card,
      limit: GROUPS_LIMIT,
      order: direction === Direction.Forward ? SortingOrder.Ascending : SortingOrder.Descending,
      orderBy: 'fromDate',
      ...date
    })
  }

  private async find (params: FindMessagesParams): Promise<Message[]> {
    delete (params as any).from
    return await this.client.findMessages(params, this.id)
  }

  private isOneMessageQuery (params: MessageQueryParams): params is OneMessageQueryParams {
    return 'id' in this.params && this.params.id != null
  }

  private async notify (): Promise<void> {
    this.initialized = true
    if (this.callback == null) return
    if (this.result instanceof Promise) this.result = await this.result
    const result = this.result.getResult()
    this.callback(new WindowImpl(result, this.result.isTail(), this.result.isHead(), this))
  }

  private match (message: Message): boolean {
    if (this.isOneMessageQuery(this.params) && this.params.id !== message.id) {
      return false
    }
    if (this.params.card !== message.cardId) {
      return false
    }
    return true
  }

  private async onThreadAttachedEvent(event: ThreadAttachedEvent): Promise<void> {
    if (this.params.replies !== true) return
    if (this.params.card !== event.thread.cardId) return
    if (this.result instanceof Promise) this.result = await this.result

    const message = this.result.get(event.thread.messageId)
    if (message !== undefined) {
      const updated: Message = {
        ...message,
        thread: event.thread
      }

      this.result.update(updated)
      void this.notify()
    }

    this.next.buffer = this.next.buffer.map((it) => {
      if (it.id === event.thread.messageId) {
        return {
          ...it,
          thread: event.thread
        }
      }
      return it
    })
    this.prev.buffer = this.next.buffer.map((it) => {
      if (it.id === event.thread.messageId) {
        return {
          ...it,
          thread: event.thread
        }
      }
      return it
    })
  }

  private fillMessage (origin: Message): Message {
    let message = origin
    if (this.params.files === true) {
      message.blobs = this.attachedBlobs.get(message.id) ?? []
    }
    if (this.params.reactions === true) {
      message.reactions = this.createdReactions.get(message.id) ?? []
    }
    if (this.params.links === true) {
      message.linkPreviews = this.createdLinkPreviews.get(message.id) ?? []
    }
    const patches = this.createdPatches.get(message.id) ?? []
    message = applyPatches(message, patches)
    return message
  }

  private async onMessageCreatedEvent (event: MessageCreatedEvent): Promise<void> {
    if (this.result instanceof Promise) this.result = await this.result
    if (this.params.card !== event.message.cardId) return
    let message = event.message
    const exists = this.result.get(message.id)

    if (exists !== undefined) {
      this.cleanCache(message.id)
      return
    }
    if (!this.match(message)) return

    message = this.fillMessage(message)

    if (this.result.isTail()) {
      const eventId = event._id
      if (eventId != null) {
        const tmp = this.tmpMessages.get(eventId)
        if (tmp != null) this.result.delete(tmp)
        this.tmpMessages.delete(eventId)
      }
      const lastMessage = this.result.getLast()
      const firstMessage = this.result.getFirst()

      function shouldResort (order: SortingOrder): boolean {
        if (firstMessage == null || lastMessage == null) return false
        if (order === SortingOrder.Ascending) {
          return lastMessage.created > message.created
        }
        return firstMessage.created > message.created
      }
      if (this.params.order === SortingOrder.Ascending) {
        this.result.push(message)
      } else {
        this.result.unshift(message)
      }

      if (shouldResort(this.params.order ?? SortingOrder.Ascending)) {
        this.result.sort((a, b) =>
          this.params.order === SortingOrder.Ascending
            ? a.created.getTime() - b.created.getTime()
            : b.created.getTime() - a.created.getTime()
        )
      }
      await this.notify()
    }
    this.cleanCache(message.id)
  }

  private cleanCache(message: MessageID): void {
    this.attachedBlobs.delete(message)
    this.createdReactions.delete(message)
    this.createdLinkPreviews.delete(message)
    this.createdPatches.delete(message)
  }

  private async onPatchCreatedEvent(event: PatchCreatedEvent): Promise<void> {
    //TODO???
    // if (this.params.card !== event.cardId) return
    // if (!this.isAllowedPatch(event.patch.type)) return
    // const current = this.createdPatches.get(event.patch.messageId) ?? []
    // this.createdPatches.set(event.patch.messageId, [...current, event.patch])
    // if (this.result instanceof Promise) this.result = await this.result
    //
    // const { patch } = event
    // const { messageCreated } = patch
    // const groups = this.groupsBuffer.filter((it) => it.fromDate <= messageCreated && it.toDate >= messageCreated)
    //
    // for (const group of groups) {
    //   if (group.patches != null) {
    //     group.patches.push(patch)
    //   }
    // }
    //
    // const message = this.result.get(patch.message)
    // if (message === undefined) return
    //
    // if (message.created < patch.created) {
    //   this.result.update(applyPatch(message, patch, this.allowedPatches()))
    //   await this.notify()
    // }
  }

  private async onReactionSetEvent(event: ReactionSetEvent): Promise<void> {
    if (this.params.reactions !== true || this.params.card !== event.cardId) return
    const current = this.createdReactions.get(event.messageId) ?? []
    this.createdReactions.set(event.messageId, [...current, event.reaction])
    if (this.result instanceof Promise) this.result = await this.result

    const reaction = {
      ...event.reaction,
      created: event.reaction.created
    }

    const message = this.result.get(event.messageId)
    if (message !== undefined) {
      this.result.update(addReaction(message, reaction))
      void this.notify()
    }

    const fromNextBuffer = this.next.buffer.find((it) => it.id === event.messageId)
    if (fromNextBuffer !== undefined) {
      addReaction(fromNextBuffer, reaction)
    }
    const fromPrevBuffer = this.prev.buffer.find((it) => it.id === event.messageId)
    if (fromPrevBuffer !== undefined) {
      addReaction(fromPrevBuffer, reaction)
    }
  }

  private async onReactionRemovedEvent(event: ReactionRemovedEvent): Promise<void> {
    if (this.params.reactions !== true || this.params.card !== event.cardId) return
    const current = this.createdReactions.get(event.messageId) ?? []

    const reactions = current.filter((it) => it.reaction !== event.reaction || it.creator !== event.creator)
    this.createdReactions.set(event.messageId, reactions)
    if (this.result instanceof Promise) this.result = await this.result

    const message = this.result.get(event.messageId)
    if (message !== undefined) {
      const updated = removeReaction(message, event.reaction, event.creator)
      if (updated.reactions.length !== message.reactions.length) {
        this.result.update(updated)
        void this.notify()
      }
    }
    this.next.buffer = this.next.buffer.map((it) =>
      it.id === event.messageId ? removeReaction(it, event.reaction, event.creator) : it
    )
    this.prev.buffer = this.prev.buffer.map((it) =>
      it.id === event.messageId ? removeReaction(it, event.reaction, event.creator) : it
    )
  }

  private updateFilesCache(message: MessageID, blobs: AttachedBlob[]): void {
    const blobsCache = this.attachedBlobs.get(message) ?? []
    this.attachedBlobs.set(message, blobsCache)
    for (const blob of blobs) {
      const current = blobsCache.find((it) => it.blobId === blob.blobId)
      if (current === undefined) {
        blobsCache.push(blob)
      }
    }
  }

  private async onBlobAttachedEvent(event: BlobAttachedEvent): Promise<void> {
    if (this.params.files !== true || event.cardId !== this.params.card) return
    this.updateFilesCache(event.messageId, [event.blob])
    if (this.result instanceof Promise) this.result = await this.result

    const { blob } = event
    const message = this.result.get(event.messageId)
    if (message !== undefined) {
      if (!message.blobs.some((it) => it.blobId === blob.blobId)) {
        message.blobs.push(blob)
        this.result.update(message)
        await this.notify()
      }
    }

    const fromNextBuffer = this.next.buffer.find((it) => it.id === event.messageId)
    if (fromNextBuffer !== undefined) {
      attachBlob(fromNextBuffer, blob)
    }
    const fromPrevBuffer = this.prev.buffer.find((it) => it.id === event.messageId)
    if (fromPrevBuffer !== undefined) {
      attachBlob(fromPrevBuffer, blob)
    }
  }

  private async onLinkPreviewCreatedEvent(event: LinkPreviewCreatedEvent): Promise<void> {
    if (this.params.links !== true || this.params.card !== event.cardId) return
    const current = this.createdLinkPreviews.get(event.messageId) ?? []
    this.createdLinkPreviews.set(event.messageId, [...current, event.linkPreview])

    if (this.result instanceof Promise) this.result = await this.result
    const message = this.result.get(event.messageId)
    const { linkPreview } = event
    if (message !== undefined) {
      if (!message.linkPreviews.some((it) => it.id === linkPreview.id)) {
        message.linkPreviews.push(linkPreview)
        this.result.update(message)
        await this.notify()
      }
    }

    const fromNextBuffer = this.next.buffer.find((it) => it.id === event.messageId)
    if (fromNextBuffer !== undefined) {
      addLinkPreview(fromNextBuffer, linkPreview)
    }
    const fromPrevBuffer = this.prev.buffer.find((it) => it.id === event.messageId)
    if (fromPrevBuffer !== undefined) {
      addLinkPreview(fromPrevBuffer, linkPreview)
    }
  }

  private async onLinkPreviewRemovedEvent(event: LinkPreviewRemovedEvent): Promise<void> {
    if (this.params.links !== true || this.params.card !== event.cardId) return
    const current = this.createdLinkPreviews.get(event.messageId) ?? []
    const linkPreviews = current.filter((it) => it.id !== event.previewId)
    this.createdLinkPreviews.set(event.messageId, linkPreviews)

    if (this.result instanceof Promise) this.result = await this.result
    const message = this.result.get(event.messageId)
    if (message !== undefined) {
      const links = message.linkPreviews.filter((it) => it.id !== event.previewId)
      if (links.length === message.linkPreviews.length) return

      const updated = {
        ...message,
        links
      }
      this.result.update(updated)
      await this.notify()
    }

    this.next.buffer = this.next.buffer.map((it) =>
      it.id === event.messageId ? removeLinkPreview(it, event.previewId) : it
    )
    this.prev.buffer = this.prev.buffer.map((it) =>
      it.id === event.messageId ? removeLinkPreview(it, event.previewId) : it
    )
  }

  private async onBlobDetachedEvent(event: BlobDetachedEvent): Promise<void> {
    if (this.params.files !== true) return
    if (this.params.card !== event.cardId) return
    const current = this.attachedBlobs.get(event.messageId) ?? []
    const files = current.filter((it) => it.blobId !== event.blobId)
    this.attachedBlobs.set(event.messageId, files)
    if (this.result instanceof Promise) this.result = await this.result

    const message = this.result.get(event.messageId)
    if (message !== undefined) {
      const files = message.blobs.filter((it) => it.blobId !== event.blobId)
      if (files.length === message.blobs.length) return

      const updated = {
        ...message,
        files
      }
      this.result.update(updated)
      await this.notify()
    }

    this.next.buffer = this.next.buffer.map((it) => (it.id === event.messageId ? detachBlob(it, event.blobId) : it))
    this.prev.buffer = this.prev.buffer.map((it) => (it.id === event.messageId ? detachBlob(it, event.blobId) : it))
  }

  private allowedPatches (): PatchType[] {
    const result = [PatchType.update, PatchType.remove]

    if (this.params.reactions === true) {
      result.push(PatchType.setReaction, PatchType.removeReaction)
    }
    if (this.params.files === true) {
      result.push(PatchType.attachBlob, PatchType.detachBlob)
    }
    if (this.params.replies === true) {
      result.push(PatchType.updateThread)
    }
    return result
  }

  private isAllowedPatch (type: PatchType): boolean {
    return this.allowedPatches().includes(type)
  }
}
