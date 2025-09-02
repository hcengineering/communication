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
  AttachmentData,
  AttachmentID,
  AttachmentUpdateData,
  type BlobID,
  type CardID,
  type CardType,
  FindMessageMetaParams,
  type FindMessagesGroupsParams,
  FindThreadParams,
  type MessageID,
  MessageMeta,
  type MessagesGroup,
  type SocialID,
  type Thread
} from '@hcengineering/communication-types'
import { Domain, ThreadUpdate, type ThreadQuery } from '@hcengineering/communication-sdk-types'

import { BaseDb } from './base'
import { DbModel, DbModelColumn, DbModelFilter, schemas } from '../schema'
import { getCondition } from './utils'
import { toMessageMeta, toMessagesGroup, toThread } from './mapping'

export class MessagesDb extends BaseDb {
  // Message
  public async createMessageMeta (
    cardId: CardID,
    messageId: MessageID,
    creator: SocialID,
    created: Date
  ): Promise<boolean> {
    const model: DbModel<Domain.MessageIndex> = {
      workspace_id: this.workspace,
      card_id: cardId,
      message_id: messageId,
      created,
      creator
    }
    const insertSql = this.getInsertSql(Domain.MessageIndex, model, [], {
      conflictColumns: ['workspace_id', 'card_id', 'message_id'],
      conflictAction: 'DO NOTHING'
    })

    const result = await this.execute(insertSql.sql, insertSql.values, 'insert message meta')

    return result.count !== 0
  }

  public async findMessageMeta (params: FindMessageMetaParams): Promise<MessageMeta[]> {
    const select = `SELECT *
                      FROM ${Domain.MessageIndex} mi
                      `
    const limit = this.buildLimit(params.limit)
    const orderBy = this.buildOrderBy(params.order, 'mi.created')
    const { where, values } = this.buildMessageMetaWhere(params)

    const sql = [select, where, orderBy, limit].join(' ')
    const result = await this.execute(sql, values, 'find message index')
    return result.map((it: any) => toMessageMeta(it))
  }

  private buildMessageMetaWhere (params: FindMessageMetaParams): { where: string, values: any[] } {
    const where: string[] = []
    const values: any[] = []
    const schema = schemas[Domain.MessageIndex]

    let index = 1

    where.push(`mi.workspace_id = $${index++}::${schema.workspace_id}`)
    values.push(this.workspace)

    if (params.cardId != null) {
      where.push(`mi.card_id = $${index++}::${schema.card_id}`)
      values.push(params.cardId)
    }

    if (params.id != null) {
      where.push(`mi.message_id = $${index++}::${schema.message_id}`)
      values.push(params.id)
    }

    if (params.creator != null) {
      where.push(`mi.creator = $${index++}::${schema.creator}`)
      values.push(params.creator)
    }

    if (params.created != null) {
      const createdCondition = getCondition('mi', 'created', index, params.created, schema.created)
      if (createdCondition != null) {
        where.push(createdCondition.where)
        values.push(...createdCondition.values)
        index = createdCondition.index
      }
    }

    return { where: `WHERE ${where.join(' AND ')}`, values }
  }

  // MessagesGroup
  async createMessagesGroup (card: CardID, blobId: BlobID, fromDate: Date, toDate: Date, count: number): Promise<void> {
    const db: DbModel<Domain.MessagesGroup> = {
      workspace_id: this.workspace,
      card_id: card,
      blob_id: blobId,
      from_date: fromDate,
      to_date: toDate,
      count
    }

    const { sql, values } = this.getInsertSql(Domain.MessagesGroup, db)
    await this.execute(sql, values, 'insert messages group')
  }

  async removeMessagesGroup (card: CardID, blobId: BlobID): Promise<void> {
    const { sql, values } = this.getDeleteSql(Domain.MessagesGroup, [
      {
        column: 'workspace_id',
        value: this.workspace
      },
      {
        column: 'card_id',
        value: card
      },
      {
        column: 'blob_id',
        value: blobId
      }
    ])
    await this.execute(sql, values, 'remove messages group')
  }

  async findMessagesGroups (params: FindMessagesGroupsParams): Promise<MessagesGroup[]> {
    const useMessageMetaCte = params.messageId != null
    const values: any[] = [this.workspace]
    if (useMessageMetaCte) values.push(params.messageId)

    const cte = useMessageMetaCte
      ? `
      WITH msg_meta AS (
        SELECT card_id, created
        FROM ${Domain.MessageIndex}
        WHERE workspace_id = $1::uuid
          AND message_id = $2::varchar
      )
    `
      : ''

    const select = `
    ${cte}
    SELECT mg.card_id,
           mg.blob_id,
           mg.from_date,
           mg.to_date,
           mg.count
    FROM ${Domain.MessagesGroup} mg
    ${useMessageMetaCte ? 'JOIN msg_meta mc ON mg.card_id = mc.card_id AND mc.created BETWEEN mg.from_date AND mg.to_date' : ''}
  `

    const { where, values: additionalValues } = this.buildMessagesGroupWhere(params, values.length + 1)
    values.push(...additionalValues)

    const orderBy =
      params.orderBy === 'toDate'
        ? this.buildOrderBy(params.order, 'mg.to_date')
        : this.buildOrderBy(params.order, 'mg.from_date')
    const limit = this.buildLimit(params.limit)

    const sql = [select, where, orderBy, limit].join(' ')
    const result = await this.execute(sql, values, 'find messages groups')

    return result.map((it: any) => toMessagesGroup(it))
  }

  buildMessagesGroupWhere (
    params: FindMessagesGroupsParams,
    startIndex = 1
  ): {
      where: string
      values: any[]
    } {
    const where: string[] = ['mg.workspace_id = $1::uuid']
    const values: any[] = []

    let index = startIndex

    if (params.cardId != null) {
      where.push(`mg.card_id = $${index++}::varchar`)
      values.push(params.cardId)
    }

    if (params.blobId != null) {
      where.push(`mg.blob_id = $${index++}`)
      values.push(params.blobId)
    }

    const fromDateCondition = getCondition('mg', 'from_date', index, params.fromDate, 'timestamptz')
    if (fromDateCondition != null) {
      where.push(fromDateCondition.where)
      values.push(...fromDateCondition.values)
      index = fromDateCondition.index
    }

    const toDateCondition = getCondition('mg', 'to_date', index, params.toDate, 'timestamptz')
    if (toDateCondition != null) {
      where.push(toDateCondition.where)
      values.push(...toDateCondition.values)
      index = toDateCondition.index
    }

    return {
      where: where.length > 0 ? `WHERE ${where.join(' AND ')}` : '',
      values
    }
  }

  // Attachment
  async addAttachments (
    cardId: CardID,
    messageId: MessageID,
    attachments: AttachmentData[],
    socialId: SocialID,
    date: Date
  ): Promise<void> {
    if (attachments.length === 0) return

    const models: DbModel<Domain.AttachmentIndex>[] = attachments.map((att) => ({
      workspace_id: this.workspace,
      card_id: cardId,
      message_id: messageId,
      id: att.id,
      type: att.type,
      params: att.params,
      creator: socialId,
      created: date
    }))

    const { sql, values } = this.getBatchInsertSql(Domain.AttachmentIndex, models)

    await this.execute(sql, values, 'insert attachments')
  }

  async removeAttachments (cardId: CardID, messageId: MessageID, ids: AttachmentID[]): Promise<void> {
    if (ids.length === 0) return

    const { sql, values } = this.getDeleteSql(Domain.AttachmentIndex, [
      { column: 'workspace_id', value: this.workspace },
      { column: 'card_id', value: cardId },
      { column: 'message_id', value: messageId },
      { column: 'id', value: ids.length === 1 ? ids[0] : ids }
    ])

    await this.execute(sql, values, 'remove attachments')
  }

  async setAttachments (
    cardId: CardID,
    messageId: MessageID,
    attachments: AttachmentData[],
    socialId: SocialID,
    date: Date
  ): Promise<void> {
    if (attachments.length === 0) return
    const { sql: deleteSql, values: deleteValues } = this.getDeleteSql(Domain.AttachmentIndex, [
      { column: 'workspace_id', value: this.workspace },
      { column: 'card_id', value: cardId },
      { column: 'message_id', value: messageId }
    ])

    const models: DbModel<Domain.AttachmentIndex>[] = attachments.map((att) => ({
      workspace_id: this.workspace,
      card_id: cardId,
      message_id: messageId,
      id: att.id,
      type: att.type,
      params: att.params,
      creator: socialId,
      created: date
    }))

    const { sql: insertSql, values: insertValues } = this.getBatchInsertSql(Domain.AttachmentIndex, models)

    await this.getRowClient().begin(async (s) => {
      await this.execute(deleteSql, deleteValues, 'delete attachments', s)
      await this.execute(insertSql, insertValues, 'insert attachments', s)
    })
  }

  async updateAttachments (
    cardId: CardID,
    messageId: MessageID,
    attachments: AttachmentUpdateData[],
    date: Date
  ): Promise<void> {
    if (attachments.length === 0) return

    const filter: DbModelFilter<Domain.AttachmentIndex> = [
      { column: 'workspace_id', value: this.workspace },
      { column: 'card_id', value: cardId },
      { column: 'message_id', value: messageId }
    ]

    const updates: Array<{
      key: AttachmentID
      column: DbModelColumn<Domain.AttachmentIndex>
      innerKey?: string
      value: any
    }> = []

    for (const att of attachments) {
      if (Object.keys(att.params).length > 0) {
        const attachmentUpdates: Array<{
          key: AttachmentID
          column: DbModelColumn<Domain.AttachmentIndex>
          innerKey?: string
          value: any
        }> = []
        for (const [innerKey, val] of Object.entries(att.params)) {
          attachmentUpdates.push({
            key: att.id,
            column: 'params',
            innerKey,
            value: val
          })
        }

        if (attachmentUpdates.length > 0) {
          attachmentUpdates.push({
            key: att.id,
            column: 'modified',
            value: date
          })
          updates.push(...attachmentUpdates)
        }
      }
    }

    if (updates.length === 0) return

    const { sql, values } = this.getBatchUpdateSql(Domain.AttachmentIndex, 'id', filter, updates)

    await this.execute(sql, values, 'update attachments')
  }

  // Thread
  async attachThread (
    cardId: CardID,
    messageId: MessageID,
    threadId: CardID,
    threadType: CardType,
    socialId: SocialID,
    date: Date
  ): Promise<void> {
    const db: DbModel<Domain.ThreadIndex> = {
      workspace_id: this.workspace,
      card_id: cardId,
      message_id: messageId,
      thread_id: threadId,
      thread_type: threadType,
      replies_count: 0,
      last_reply: date
    }

    const { sql, values } = this.getInsertSql(Domain.ThreadIndex, db)

    await this.execute(sql, values, 'insert thread')
  }

  async updateThread (query: ThreadQuery, update: ThreadUpdate): Promise<void> {
    const set: string[] = []
    const values: any[] = []

    let index = 1
    if (update.lastReply != null) {
      set.push(`last_reply = $${index++}::timestamptz`)
      values.push(update.lastReply)
    }

    if (update.repliesCountOp === 'increment') {
      set.push('replies_count = replies_count + 1')
    } else if (update.repliesCountOp === 'decrement') {
      set.push('replies_count = GREATEST(replies_count - 1, 0)')
    }

    if (update.threadType != null) {
      set.push(`thread_type = $${index++}::varchar`)
      values.push(update.threadType)
    }

    if (set.length === 0) return

    const updateSql = `UPDATE ${Domain.ThreadIndex}`
    const setSql = 'SET ' + set.join(', ')
    let where = `WHERE workspace_id = $${index++}::uuid`

    values.push(this.workspace)
    if (query.cardId != null) {
      where += ` AND card_id = $${index++}::varchar`
      values.push(query.cardId)
    }
    if (query.messageId != null) {
      where += ` AND message_id = $${index++}::varchar`
      values.push(query.messageId)
    }
    if (query.threadId != null) {
      where += ` AND thread_id = $${index++}::varchar`
      values.push(query.threadId)
    }

    const sql = [updateSql, setSql, where].join(' ')

    await this.execute(sql, values, 'update thread')
  }

  async removeThreads (query: ThreadQuery): Promise<void> {
    const filter: DbModelFilter<Domain.ThreadIndex> = [
      {
        column: 'workspace_id',
        value: this.workspace
      }
    ]

    if (query.cardId != null) filter.push({ column: 'card_id', value: query.cardId })
    if (query.messageId != null) filter.push({ column: 'message_id', value: query.messageId })
    if (query.threadId != null) filter.push({ column: 'thread_id', value: query.threadId })

    const { sql, values } = this.getDeleteSql(Domain.ThreadIndex, filter)

    await this.execute(sql, values, 'remove threads')
  }

  // Find threads
  async findThreads (params: FindThreadParams): Promise<Thread[]> {
    const { where, values } = this.buildThreadWhere(params)
    const select = `
            SELECT *
            FROM ${Domain.ThreadIndex} t
        `

    const limit = this.buildLimit(params.limit)
    const orderBy = this.buildOrderBy(params.order, 't.date')

    const sql = [select, where, orderBy, limit].join(' ')
    const result = await this.execute(sql, values, 'find threads')

    return result.map((it: any) => toThread(it))
  }

  private buildThreadWhere (
    params: FindThreadParams,
    startIndex: number = 0,
    prefix: string = 't.'
  ): { where: string, values: any[] } {
    const where: string[] = []
    const values: any[] = []
    let index = startIndex + 1

    where.push(`${prefix}workspace_id = $${index++}::uuid`)
    values.push(this.workspace)

    if (params.cardId != null) {
      where.push(`${prefix}card_id = $${index++}::varchar`)
      values.push(params.cardId)
    }

    if (params.messageId != null) {
      where.push(`${prefix}message_id = $${index++}::varchar`)
      values.push(params.messageId)
    }

    if (params.threadId != null) {
      where.push(`${prefix}thread_id = $${index++}::varchar`)
      values.push(params.threadId)
    }

    return { where: `WHERE ${where.join(' AND ')}`, values }
  }
}
