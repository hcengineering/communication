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

import type {AccountID, MessageID, SocialID} from '@hcengineering/communication-types'
import { generateToken } from '@hcengineering/server-token'
import { systemAccountUuid } from '@hcengineering/core'
import { getClient as getAccountClient } from '@hcengineering/account-client'

import type { TriggerCtx } from './types'

export async function findAccount (ctx: TriggerCtx, socialString: SocialID): Promise<AccountID | undefined> {
  if (ctx.account.socialIds.includes(socialString)) {
    return ctx.account.uuid
  }
  const cached = ctx.accountBySocialID.get(socialString)
  if (cached !== undefined) {
    return cached
  }

  const url = ctx.metadata.accountsUrl ?? ''
  if (url === '') return undefined

  const token = generateToken(systemAccountUuid, undefined, undefined, ctx.metadata.secret)
  const accountClient = getAccountClient(ctx.metadata.accountsUrl, token)

  try {
    const account = (await accountClient.findPersonBySocialId(socialString, true)) as AccountID | undefined

    if (account != null) {
      ctx.accountBySocialID.set(socialString, account)
    }

    return account
  } catch (err: any) {
    ctx.ctx.warn('Cannot find account', { socialString, err })
  }
}

export function isExternalMessageId(messageId: MessageID): boolean {
  return messageId.startsWith('e')
}

export function parseMessageIdDate(messageId: MessageID): Date | undefined {
  return isExternalMessageId(messageId) ? undefined : new Date(Number(messageId))
}