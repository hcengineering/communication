import {
    type Message,
    type MessageID,
    type CardID,
    type FindMessagesParams,
    type SocialID,
    type RichText,
    SortingOrder,
    type FindPatchesParams,
    type Patch
} from '@hcengineering/communication-types';
import { generateMessageId } from '@hcengineering/communication-shared';

import {BaseDb} from './base.ts'
import {
    TableName,
    type MessageDb,
    type AttachmentDb,
    type ReactionDb,
    type PatchDb,
    toMessage,
} from './schema.ts'
import {getCondition} from "./utils.ts";

export class MessagesDb extends BaseDb {
    //Message
    async createMessage(card: CardID, content: RichText, creator: SocialID, created: Date): Promise<MessageID> {
        const dbData: MessageDb = {
            id: generateMessageId(),
            workspace_id: this.workspace,
            card_id: card,
            content: content,
            creator: creator,
            created: created,
        }

        const sql= `INSERT INTO ${TableName.Message} (workspace_id, card_id, id, content, creator, created)
            VALUES ($1::uuid, $2, $3::bigint, $4, $5, $6::timestamptz)`

        console.log(sql)
        console.log(dbData)
        await this.client.unsafe(sql, [dbData.workspace_id, dbData.card_id, dbData.id.toString() , dbData.content, dbData.creator, dbData.created])

        return dbData.id as MessageID
    }

    async removeMessage(card: CardID, message: MessageID): Promise<MessageID | undefined> {
        const result = await this.removeWithReturn(TableName.Message, {id: message, workspace_id: this.workspace, card_id: card}, "id")
        return result[0] as MessageID | undefined
    }

    async removeMessages(card: CardID, ids: MessageID[]): Promise<MessageID[]> {
        const result = await this.removeWithReturn(TableName.Message, {
            workspace_id: this.workspace,
            card_id: card,
            id: ids
        }, "id")
        return result.map((it: any) => it.id)
    }

    async createPatch(card: CardID, message: MessageID, content: RichText, creator: SocialID, created: Date): Promise<void> {
        const dbData: PatchDb = {
            workspace_id: this.workspace,
            card_id: card,
            message_id: message,
            content: content,
            creator: creator,
            created: created
        }

        await this.insert(TableName.Patch, dbData)
    }


    //Attachment
    async createAttachment(message: MessageID, card: CardID, creator: SocialID, created: Date): Promise<void> {
        const dbData: AttachmentDb = {
            message_id: message,
            card_id: card,
            creator: creator,
            created: created
        }
        await this.insert(TableName.Attachment, dbData)
    }

    async removeAttachment(message: MessageID, card: CardID): Promise<void> {
        await this.remove(TableName.Attachment, {
            message_id: message,
            card_id: card
        })
    }

    //Reaction
    async createReaction(card: CardID, message: MessageID, reaction: string, creator: SocialID, created: Date): Promise<void> {
        const dbData: ReactionDb = {
            workspace_id: this.workspace,
            card_id: card,
            message_id: message,
            reaction: reaction,
            creator: creator,
            created: created
        }
        await this.insert(TableName.Reaction, dbData)
    }

    async removeReaction( card: CardID, message: MessageID, reaction: string, creator: SocialID): Promise<void> {
        await this.remove(TableName.Reaction, {
            workspace_id: this.workspace,
            card_id: card,
            message_id: message,
            reaction: reaction,
            creator: creator
        })
    }

    //Find messages
    async find(params: FindMessagesParams): Promise<Message[]> {
        //TODO: experiment with select to improve performance
        const select = `SELECT m.id,
                               m.card_id,
                               m.content,
                               m.creator,
                               m.created,
                               ${this.subSelectPatches()},
                               ${this.subSelectAttachments()},
                               ${this.subSelectReactions()}
                        FROM ${TableName.Message} m`

        const {where, values} = this.buildMessageWhere( params)
        const orderBy = params.order ? `ORDER BY m.created ${params.order === SortingOrder.Ascending ? 'ASC' : 'DESC'}` : ''
        const limit = params.limit ? ` LIMIT ${params.limit}` : ''
        const sql = [select, where, orderBy, limit].join(' ')

        console.log(sql)
        console.log(values)
        const result = await this.client.unsafe(sql, values)
        console.log(result)
        return result.map((it: any) => toMessage(it))
    }

    buildMessageWhere(params: FindMessagesParams): { where: string, values: any[] } {
        const where: string[] = ['m.workspace_id = $1']
        const values: any[] = [this.workspace]

        let index = 2

        if (params.id != null) {
            where.push(`m.id = $${index++}`)
            values.push(params.id)
        }

        if (params.card != null) {
            where.push(`m.card_id = $${index++}`)
            values.push(params.card)
        }

        const createdCondition = getCondition("m", "created", index, params.created);

        if (createdCondition != null) {
            where.push(createdCondition.where);
            values.push(createdCondition.value);
            index++;
        }

        return {where: `WHERE ${where.join(' AND ')}`, values}
    }

    subSelectPatches(): string {
        return `COALESCE(
                (SELECT jsonb_agg(jsonb_build_object(
                    'content', p.content,
                    'creator', p.creator,
                    'created', p.created
                ))
                FROM ${TableName.Patch} p
                WHERE p.message_id = m.id 
                  AND p.workspace_id = m.workspace_id 
                  AND p.card_id = m.card_id
                ), '[]'::jsonb) AS patches`
    }

    subSelectAttachments(): string {
        return `COALESCE(
                (SELECT jsonb_agg(jsonb_build_object(
                    'card_id', a.card_id,
                    'message_id', a.message_id,
                    'creator', a.creator,
                    'created', a.created
                ))
                FROM ${TableName.Attachment} a
                WHERE a.message_id = m.id
                ), '[]'::jsonb) AS attachments`
    }

    subSelectReactions(): string {
        return `COALESCE(
                (SELECT jsonb_agg(jsonb_build_object(
                    'message_id', r.message_id,
                    'reaction', r.reaction,
                    'creator', r.creator,
                    'created', r.created
                ))
                FROM ${TableName.Reaction} r
                WHERE r.message_id = m.id 
                  AND r.workspace_id = m.workspace_id 
                  AND r.card_id = m.card_id
                ), '[]'::jsonb) AS reactions`
    }

    // Find patches
    async findPatches (params: FindPatchesParams): Promise<Patch[]> {
        //TODO: implement
        return []
    }
}

