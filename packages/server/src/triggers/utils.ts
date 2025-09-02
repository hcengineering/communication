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
  type AccountUuid,
  type CardID,
  type Message,
  type MessageID,
  type Markdown,
  type SocialID,
  SortingOrder,
  type WorkspaceUuid,
  BlobID
} from '@hcengineering/communication-types'
import { loadGroupFile } from '@hcengineering/communication-yaml'
import type { DbAdapter } from '@hcengineering/communication-sdk-types'

import type { TriggerCtx } from '../types'
import { findAccount } from '../utils'

export async function findMessage (
  db: DbAdapter,
  filesUrl: string,
  workspace: WorkspaceUuid,
  card: CardID,
  id: MessageID
): Promise<{
    message?: Message
    blobId?: BlobID
  }> {
  return await findMessageInFiles(db, filesUrl, workspace, card, id)
}

export async function findMessageInFiles (
  db: DbAdapter,
  filesUrl: string,
  workspace: WorkspaceUuid,
  cardId: CardID,
  messageId: MessageID
): Promise<{
    message?: Message
    blobId?: BlobID
  }> {
  if (filesUrl === '') {
    return {}
  }

  const meta = (await db.findMessageMeta({ cardId, id: messageId, limit: 1 }))[0]

  if (meta == null) return {}
  const group = (
    await db.findMessagesGroups({
      cardId,
      fromDate: { lessOrEqual: meta.created },
      toDate: { greaterOrEqual: meta.created },
      limit: 1,
      order: SortingOrder.Ascending,
      orderBy: 'fromDate'
    })
  )[0]

  if (group === undefined) {
    return {}
  }

  try {
    const parsedFile = await loadGroupFile(workspace, filesUrl, group.blobId, { retries: 3 })
    const message = parsedFile.messages.find((it) => it.id === messageId)
    if (message === undefined) {
      return {}
    }

    return { message, blobId: group.blobId }
  } catch (e) {
    console.error('Failed to find message in files', { card: cardId, id: messageId, created: meta })
    console.error('Error:', { error: e })
  }

  return {}
}

export async function getNameBySocialID (ctx: TriggerCtx, id: SocialID): Promise<string> {
  const account = await findAccount(ctx, id)
  return account != null ? (await ctx.db.getNameByAccount(account)) ?? 'System' : 'System'
}

export async function getAddCollaboratorsMessageContent (
  ctx: TriggerCtx,
  sender: AccountUuid | undefined,
  collaborators: AccountUuid[]
): Promise<Markdown> {
  if (sender != null && collaborators.length === 1 && collaborators.includes(sender)) {
    return 'Joined card'
  }

  const collaboratorsNames = (await Promise.all(collaborators.map((it) => ctx.db.getNameByAccount(it)))).filter(
    (it): it is string => it != null && it !== ''
  )

  return `Added ${collaboratorsNames.join(', ')}`
}

export async function getRemoveCollaboratorsMessageContent (
  ctx: TriggerCtx,
  sender: AccountUuid | undefined,
  collaborators: AccountUuid[]
): Promise<Markdown> {
  if (sender != null && collaborators.length === 1 && collaborators.includes(sender)) {
    return 'Left card'
  }

  const collaboratorsNames = (await Promise.all(collaborators.map((it) => ctx.db.getNameByAccount(it)))).filter(
    (it): it is string => it != null && it !== ''
  )

  return `Removed ${collaboratorsNames.join(', ')}`
}
