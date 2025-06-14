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

import type { AccountID, CardID, CardType } from './core'

export type LabelID = string & { __label: true }

export const SubscriptionLabelID = 'card:label:Subscribed' as LabelID
export const NewMessageLabelID = 'card:label:NewMessages' as LabelID

export interface Label {
  labelId: LabelID
  cardId: CardID
  cardType: CardType
  account: AccountID
  created: Date
}
