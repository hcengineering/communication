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

import type { FindClient } from '@hcengineering/communication-sdk-types'
import {
  type CardID,
  type Message,
  type MessageID,
  type MessagesGroup,
  SortingOrder,
  type WorkspaceUuid
} from '@hcengineering/communication-types'
import { loadGroupFile } from './parse'

export async function findMessage (
  id: MessageID,
  cardId: CardID,
  created: Date,
  client: FindClient,
  workspace: WorkspaceUuid,
  filesUrl: string
): Promise<Message | undefined> {
  const message = (
    await client.findMessages({
      cardId,
      id,
      limit: 1
    })
  )[0]

  if (message !== undefined) {
    return message
  }

  const group = await findGroupByDate(client, cardId, created)
  if (group === undefined) return undefined
  const parsedFile = await loadGroupFile(workspace, filesUrl, group.blobId, { retries: 5 })

  return parsedFile.messages.find((it) => it.id === id)
}

async function findGroupByDate (client: FindClient, cardId: CardID, created: Date): Promise<MessagesGroup | undefined> {
  const groups = await client.findMessagesGroups({
    cardId,
    fromDate: { lessOrEqual: created },
    toDate: { greaterOrEqual: created },
    limit: 1,
    order: SortingOrder.Ascending,
    orderBy: 'fromDate'
  })

  return groups[0]
}
