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

import type { LabelRequestEvent, LabelRequestEventType } from './requestEvents/label'
import type { MessageEventResult, MessageRequestEvent, MessageRequestEventType } from './requestEvents/message'
import type {
  NotificationEventResult,
  NotificationRequestEvent,
  NotificationRequestEventType
} from './requestEvents/notification'
import { type LabelResponseEvent, LabelResponseEventType } from './responseEvents/label'
import type { MessageResponseEvent, MessageResponseEventType } from './responseEvents/message'
import type { NotificationResponseEvent, NotificationResponseEventType } from './responseEvents/notification'

export * from './requestEvents/message'
export * from './requestEvents/notification'
export * from './requestEvents/label'
export * from './responseEvents/message'
export * from './responseEvents/notification'
export * from './responseEvents/label'

export type RequestEventType = MessageRequestEventType | NotificationRequestEventType | LabelRequestEventType
export type RequestEvent = MessageRequestEvent | NotificationRequestEvent | LabelRequestEvent
export type EventResult = MessageEventResult | NotificationEventResult | {}

export type ResponseEventType = MessageResponseEventType | NotificationResponseEventType | LabelResponseEventType
export type ResponseEvent = MessageResponseEvent | NotificationResponseEvent | LabelResponseEvent
