import {
    type CardID,
    SortingOrder,
    type BlobID,
    type MessagesGroup,
    type FindMessagesGroupsParams
} from '@hcengineering/communication-types'

import {BaseDb} from './base.ts'
import {
    TableName,
    type MessagesGroupDb,
    toMessagesGroup
} from './schema.ts'
import {getCondition} from './utils.ts';

export class MessagesGroupsDb extends BaseDb {
    //MessagesGroup
    async createMessagesGroup(card: CardID, blobId: BlobID, from_date: Date, to_date: Date, count: number): Promise<void> {
        const dbData: MessagesGroupDb = {
            workspace_id: this.workspace,
            card_id: card,
            blob_id: blobId,
            from_date,
            to_date,
            count
        }
        await this.insert(TableName.MessagesGroup, dbData)
    }

    //Find messages groups
    async find(params: FindMessagesGroupsParams): Promise<MessagesGroup[]> {
        const select = `SELECT mg.card_id,
                               mg.blob_id,
                               mg.from_date,
                               mg.to_date,
                               mg.count
                        FROM ${TableName.MessagesGroup} mg`

        const {where, values} = this.buildMessagesGroupWhere(this.workspace, params)
        const orderBy = params.orderBy === 'toDate'
            ? `ORDER BY mg.to_date ${params.order === SortingOrder.Ascending ? 'ASC' : 'DESC'}`
            : `ORDER BY mg.from_date ${params.order === SortingOrder.Ascending ? 'ASC' : 'DESC'}`

        const limit = params.limit ? ` LIMIT ${params.limit}` : ''
        const sql = [select, where, orderBy, limit].join(' ')

        console.log(sql)
        console.log(values)
        const result = await this.client.unsafe(sql, values)

        console.log("raw result", result)
        return result.map((it: any) => toMessagesGroup(it))
    }

    buildMessagesGroupWhere(workspace: string, params: FindMessagesGroupsParams): {
        where: string,
        values: any[]
    } {
        const where: string[] = ['mg.workspace_id = $1']
        const values: any[] = [workspace]

        let index = 2

        if (params.card != null) {
            where.push(`mg.card_id = $${index++}`)
            values.push(params.card)
        }

        if (params.blobId != null) {
            where.push(`mg.blob_id = $${index++}`)
            values.push(params.blobId)
        }

        const fromDateCondition = getCondition("mg", "from_date", index, params.fromDate);
        if (fromDateCondition != null) {
            where.push(fromDateCondition.where);
            values.push(fromDateCondition.value);
            index++;
        }

        const toDateCondition = getCondition("mg", "to_date", index, params.toDate);
        if (toDateCondition != null) {
            where.push(toDateCondition.where);
            values.push(toDateCondition.value);
            index++;
        }

        return {where: `WHERE ${where.join(' AND ')}`, values}
    }
}

