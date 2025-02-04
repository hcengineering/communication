import type { SocialID } from '@hcengineering/communication-types'

export interface ConnectionInfo {
  sessionId: string
  personalWorkspace: string
  socialId: SocialID
}
