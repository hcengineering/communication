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

import type { Ref, Blob, AccountUuid, WorkspaceUuid, PersonId, BlobMetadata } from '@hcengineering/core'
import type { Card, MasterTag } from '@hcengineering/card'

export type { BlobMetadata }

export type BlobID = Ref<Blob>
export type CardID = Ref<Card>
export type CardType = Ref<MasterTag>
export type SocialID = PersonId
export type WorkspaceID = WorkspaceUuid
export type Markdown = string
export type AccountID = AccountUuid

export type ID = string
