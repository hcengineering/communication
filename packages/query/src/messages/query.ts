import {
    type FindMessagesParams,
    type Message,
    type MessagesGroup,
    type WorkspaceID,
    type MessageID,
    SortingOrder,
    type Patch
} from '@hcengineering/communication-types'
import {
    ResponseEventType,
    type AttachmentCreatedEvent,
    type AttachmentRemovedEvent,
    type MessageCreatedEvent,
    type MessageRemovedEvent,
    type PatchCreatedEvent,
    type QueryCallback,
    type QueryClient,
    type ReactionCreatedEvent,
    type ReactionRemovedEvent,
    type ResponseEvent
} from '@hcengineering/communication-sdk-types'
import {loadGroupFile} from "@hcengineering/communication-shared";

import { QueryResult } from '../result'
import { defaultQueryParams, Direction, type QueryId, type PagedQuery } from '../types'
import { WindowImpl } from '../window'


const GROUPS_LIMIT = 20

export class MessagesQuery  implements PagedQuery<Message, FindMessagesParams> {
    protected result: Promise<QueryResult<Message>> | QueryResult<Message>

    private readonly messagesFromFiles: Message[] = []

    private readonly groupsBuffer: MessagesGroup[] = []

    private firstGroup?: MessagesGroup
    private lastGroup?: MessagesGroup

    private readonly limit: number

    private readonly next = {
        hasMessages: true,
        hasGroups: true
    }

    private readonly prev = {
        hasMessages: true,
        hasGroups: true
    }

    constructor (
        protected readonly client: QueryClient,
        private readonly workspace: WorkspaceID,
        private readonly filesUrl: string,
        public readonly id: QueryId,
        public readonly params: FindMessagesParams,
        private callback?: QueryCallback<Message>
    ) {
        this.limit = (this.params.limit ?? defaultQueryParams.limit) + 1
        this.params = {
            ...params,
            order: params.order ?? defaultQueryParams.order
        }

        this.result = new QueryResult([] as Message[], x => x.id)

        if (this.isInitLoadingForward()) {
            this.result.setHead(true)
            void this.requestLoadNextPage()
        } else {
            this.result.setTail(true)
            void this.requestLoadPrevPage()
        }
    }

    getObjectId (object: Message): MessageID {
        return object.id
    }

    getObjectDate (object: Message): Date {
        return object.created
    }

    setCallback (callback: QueryCallback<Message>): void {
        this.callback = callback
        void this.notify()
    }

    removeCallback (): void {
        this.callback = () => {}
    }

    async requestLoadNextPage (): Promise<void> {
        if (this.result instanceof Promise) this.result = await this.result
        if (!this.result.isTail()) {
            this.result = this.loadPage(Direction.Forward)
            this.result.then(() => this.notify())
        }
    }

    async requestLoadPrevPage (): Promise<void> {
        if (this.result instanceof Promise) this.result = await this.result
        if (!this.result.isHead()) {
            this.result = this.loadPage(Direction.Backward)
            this.result.then(() => this.notify())
        }
    }

    private isInitLoadingForward (): boolean {
        const { order, created} = this.params

        if(created == null) return order === SortingOrder.Ascending
        if(created instanceof Date) return order === SortingOrder.Ascending
        //TODO: fix me
        if(created.less != null) return order !== SortingOrder.Ascending
        if(created.lessOrEqual != null) return order !== SortingOrder.Ascending
        if(created.greater != null) return order === SortingOrder.Ascending
        if(created.greaterOrEqual != null) return order === SortingOrder.Ascending

        return false
    }

    private async loadPage (direction: Direction): Promise<QueryResult<Message>> {
        if (this.result instanceof Promise) this.result = await this.result
        const { messages, fromDb } = direction === Direction.Forward
            ? await this.loadNextMessages()
            : await this.loadPrevMessages()

        if (!this.result.isHead() && direction === Direction.Backward) {
            this.result.setHead(messages.length < this.limit)
        }
        if (!this.result.isTail() && direction === Direction.Forward) {
            this.result.setTail(messages.length < this.limit)
        }

        if (messages.length === this.limit) {
            const lastMessage = messages.pop()
            if (lastMessage != null && !fromDb) {
                direction === Direction.Forward
                    ? this.messagesFromFiles.unshift(lastMessage)
                    : this.messagesFromFiles.push(lastMessage)
            }
        }

        this.result.append(messages)
        return this.result
    }

    // Load next
    private async loadNextMessages (): Promise<{ messages: Message[], fromDb: boolean }> {
        const messages: Message[] = this.messagesFromFiles.splice(0, this.limit)

        if (messages.length >= this.limit) return { messages, fromDb: false }

        await this.loadGroups(Direction.Forward)

        console.log([...this.messagesFromFiles])
        messages.push(...this.messagesFromFiles.splice(0, this.limit - messages.length))

        if (messages.length >= this.limit) return { messages, fromDb: false }

        const dbMessages = await this.findNextMessages(this.limit - messages.length)
        this.next.hasMessages = dbMessages.length > 0
        messages.push(...dbMessages)
        return { messages, fromDb: dbMessages.length > 0 }
    }

    private async findNextMessages (limit: number): Promise<Message[]> {
        if (this.result instanceof Promise) this.result = await this.result
        if (this.next.hasGroups) {
            return []
        }

        if (this.result.isTail()) return []

        const last = this.result.getLast()

        return await this.find({
            ...this.params,
            created: last ? {
                greater: last?.created
            } : undefined,
            limit,
            order: SortingOrder.Ascending
        })
    }

    // Load prev
    private async loadPrevMessages (): Promise<{ messages: Message[], fromDb: boolean }> {
        const messages: Message[] = []

        if (this.prev.hasMessages) {
            const result = await this.findPrevMessages(this.limit)
            this.prev.hasMessages = result.length > 0
            messages.push(...result)
        }

        if (messages.length >= this.limit) return { messages, fromDb: true }

        const restLimit = this.limit - messages.length
        const fromBuffer = this.messagesFromFiles.splice(-restLimit, restLimit).reverse()
        messages.push(...fromBuffer)

        if (messages.length >= this.limit) return { messages, fromDb: false }

        await this.loadGroups(Direction.Backward)

        const rest = this.limit - messages.length
        const fromBuffer2 = this.messagesFromFiles.splice(-rest, rest).reverse()

        messages.push(...fromBuffer2)

        return { messages, fromDb: false }
    }

    private async findPrevMessages (limit: number): Promise<Message[]> {
        if (this.result instanceof Promise) this.result = await this.result
        if (!this.prev.hasMessages || this.result.isHead()) return []

        const first = this.result.getLast()

        return await this.find({
            ...this.params,
            created: first ? {
                less: first?.created
            } : undefined,
            limit,
            order: SortingOrder.Descending
        })
    }

    private async loadGroups (direction: Direction): Promise<void> {
        let messagesCount = 0
        const toLoad: MessagesGroup[] = []
        const toBuffer: MessagesGroup[] = []

        while (messagesCount < this.limit) {
            const currentGroups = this.groupsBuffer.splice(direction === Direction.Forward ? 0 : -GROUPS_LIMIT, GROUPS_LIMIT)
            const hasGroups = direction === Direction.Forward ? this.next.hasGroups : this.prev.hasGroups
            if (currentGroups.length === 0 && !hasGroups) break

            const groups = currentGroups.length > 0
                ? currentGroups
                : await this.findGroups(direction, direction === Direction.Forward ? this.lastGroup?.fromDate : this.firstGroup?.fromDate)

            if (currentGroups.length === 0) {
                this.firstGroup = direction === Direction.Forward ? this.firstGroup ?? groups[0] : groups[groups.length - 1]
                this.lastGroup = direction === Direction.Forward ? groups[groups.length - 1] ?? this.lastGroup : this.lastGroup ?? groups[0]

                if (direction === Direction.Forward) {
                    this.next.hasGroups = groups.length >= GROUPS_LIMIT
                } else {
                    this.prev.hasGroups = groups.length >= GROUPS_LIMIT
                }
            }

            const orderedGroups = direction === Direction.Forward ? groups : groups.reverse()
            while (messagesCount < this.limit && orderedGroups.length > 0) {
                const group = direction === Direction.Forward ? orderedGroups.shift() : orderedGroups.pop()
                if (group == null) break
                toLoad.push(group)
                messagesCount += group.count
            }

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

        const parsedFiles = await Promise.all(toLoad.map(group => loadGroupFile(this.workspace, this.filesUrl, group, {retries: 5})))

        for (const file of parsedFiles) {
            // TODO: match query
            if (direction === Direction.Forward) {
                this.messagesFromFiles.push(...file.messages)
            } else {
                this.messagesFromFiles.unshift(...file.messages)
            }
        }
    }

    private async findGroups (direction: Direction, date?: Date): Promise<MessagesGroup[]> {
        if (date == null) {
            return await this.client.findMessagesGroups({
                card: this.params.card as any,
                limit: GROUPS_LIMIT,
                order: direction === Direction.Forward ? SortingOrder.Ascending : SortingOrder.Descending,
                orderBy: 'fromDate'
            })
        }

        return await this.client.findMessagesGroups({
            card: this.params.card as any,
            limit: GROUPS_LIMIT,
            order: direction === Direction.Forward ? SortingOrder.Ascending : SortingOrder.Descending,
            orderBy: 'fromDate',
            fromDate: direction === Direction.Forward
                ? {
                    greater: date
                }
                : {
                    less: date
                }
        })
    }

    private async find (params: FindMessagesParams): Promise<Message[]> {
        return await this.client.findMessages(params, this.id)
    }

    private async notify (): Promise<void> {
        if (this.callback == null) return
        if (this.result instanceof Promise) this.result = await this.result
        const result = this.result.getResult()
        // TODO: fix types
        this.callback(new WindowImpl(result, this.result.isTail(), this.result.isHead(), this as any))
    }

    async unsubscribe(): Promise<void> {
        await this.client.unsubscribeQuery(this.id)
    }


    async onEvent(event: ResponseEvent): Promise<void> {
        switch (event.type) {
            case ResponseEventType.MessageCreated:
                return await this.onCreateMessageEvent(event)
            case ResponseEventType.MessageRemoved:
                return await this.onRemoveMessageEvent(event)
            case ResponseEventType.PatchCreated:
                return await this.onCreatePatchEvent(event)
            case ResponseEventType.ReactionCreated:
                return await this.onCreateReactionEvent(event)
            case ResponseEventType.ReactionRemoved:
                return await this.onRemoveReactionEvent(event)
            case ResponseEventType.AttachmentCreated:
                return await this.onCreateAttachmentEvent(event)
            case ResponseEventType.AttachmentRemoved:
                return await this.onRemoveAttachmentEvent(event)
        }
    }

    async onCreateMessageEvent(event: MessageCreatedEvent): Promise<void> {
        if (this.result instanceof Promise) this.result = await this.result

        const message = {
            ...event.message,
            edited: event.message.edited,
            created: event.message.created
        }
        const exists = this.result.get(message.id)

        if (exists !== undefined) return
        if (!this.match(message)) return

        if (this.result.isTail()) {
            if (this.params.order === SortingOrder.Ascending) {
                this.result.push(message)
            } else {
                this.result.unshift(message)
            }
            await this.notify()
        }
    }

    private match(message: Message): boolean {
        if (this.params.id != null && this.params.id !== message.id) {
            return false
        }
        if (this.params.card != null && this.params.card !== message.card) {
            return false
        }
        return true
    }

    private async onCreatePatchEvent(event: PatchCreatedEvent): Promise<void> {
        if (this.result instanceof Promise) this.result = await this.result

        const patch = {
            ...event.patch,
            created: event.patch.created
        }

        const message = this.result.get(patch.message)

        if (message === undefined) return

        if (message.created < patch.created) {
            this.result.update(this.applyPatch(message, patch))
            await this.notify()
        }
    }

    private async onRemoveMessageEvent(event: MessageRemovedEvent): Promise<void> {
        if (this.result instanceof Promise) this.result = await this.result

        const deleted = this.result.delete(event.message)

        if (deleted !== undefined) {
            await this.notify()
        }
    }

    private async onCreateReactionEvent(event: ReactionCreatedEvent): Promise<void> {
        if (this.result instanceof Promise) this.result = await this.result

        const reaction = {
            ...event.reaction,
            created: event.reaction.created
        }
        const message = this.result.get(reaction.message)
        if (message === undefined) return

        message.reactions.push(reaction)
        this.result.update(message)
        await this.notify()
    }

    private async onRemoveReactionEvent(event: ReactionRemovedEvent): Promise<void> {
        if (this.result instanceof Promise) this.result = await this.result

        const message = this.result.get(event.message)
        if (message === undefined) return

        const reactions = message.reactions.filter((it) => it.reaction !== event.reaction && it.creator !== event.creator)
        if (reactions.length === message.reactions.length) return

        const updated = {
            ...message,
            reactions
        }
        this.result.update(updated)
        await this.notify()
    }

    private async onCreateAttachmentEvent(event: AttachmentCreatedEvent): Promise<void> {
        if (this.result instanceof Promise) this.result = await this.result

        const attachment = {
            ...event.attachment,
            created: event.attachment.created
        }
        const message = this.result.get(attachment.message)
        if (message === undefined) return

        message.attachments.push(attachment)
        this.result.update(message)
        await this.notify()
    }

    private async onRemoveAttachmentEvent(event: AttachmentRemovedEvent): Promise<void> {
        if (this.result instanceof Promise) this.result = await this.result

        const message = this.result.get(event.message)
        if (message === undefined) return

        const attachments = message.attachments.filter((it) => it.card !== event.card)
        if (attachments.length === message.attachments.length) return

        const updated = {
            ...message,
            attachments
        }
        this.result.update(updated)
        await this.notify()
    }

    private applyPatch(message: Message, patch: Patch): Message {
        return {
            ...message,
            content: patch.content,
            creator: patch.creator,
            created: patch.created
        }
    }

    copyResult(): QueryResult<Message> | undefined {
        // if (this.result instanceof Promise) {
        //     return undefined
        // }
        //
        // return this.result.copy()
        return undefined
    }
}