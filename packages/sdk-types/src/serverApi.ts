import type {
  FindMessagesGroupsParams,
  FindMessagesParams,
  FindPatchesParams,
  Message,
  MessagesGroup,
  SocialID,
  WorkspaceID,
  Patch
} from '@hcengineering/communication-types'

import type { EventResult, RequestEvent } from './requestEvent.ts'

export interface ConnectionInfo {
  sessionId: string
  personalWorkspace: WorkspaceID
  socialIds: SocialID[]
}

export interface ServerApi {
  findMessages(info: ConnectionInfo, params: FindMessagesParams, queryId?: number): Promise<Message[]>
  findMessagesGroups(info: ConnectionInfo, params: FindMessagesGroupsParams): Promise<MessagesGroup[]>
  findPatches(info: ConnectionInfo, params: FindPatchesParams): Promise<Patch[]>

  event(info: ConnectionInfo, event: RequestEvent): Promise<EventResult>

  closeSession(sessionId: string): Promise<void>
  unsubscribeQuery(info: ConnectionInfo, id: number): Promise<void>

  close(): Promise<void>
}
