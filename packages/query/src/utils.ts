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

import { applyPatches } from '@hcengineering/communication-shared'
import type {
  BlobID,
  CardID,
  CardType,
  File,
  Message,
  MessageID,
  MessagesGroup,
  Patch,
  Reaction,
  SocialID,
  WorkspaceID
} from '@hcengineering/communication-types'
import { loadGroupFile } from '@hcengineering/communication-yaml'

export async function loadMessageFromGroup(
  id: MessageID,
  workspace: WorkspaceID,
  filesUrl: string,
  group?: MessagesGroup,
  patches: Patch[] = []
): Promise<Message | undefined> {
  if (group == null) return

  const parsedFile = await loadGroupFile(workspace, filesUrl, group, { retries: 5 })

  const message = parsedFile.messages.find((it) => it.id === id)
  if (message == null) return

  return applyPatches(message, patches)
}

export function addFile(message: Message, file: File): Message {
  if (!message.files.some((it) => it.blobId === file.blobId)) {
    message.files.push(file)
  }
  return message
}

export function removeFile(message: Message, blobId: BlobID): Message {
  const files = message.files.filter((it) => it.blobId !== blobId)
  if (files.length === message.files.length) return message

  return {
    ...message,
    files
  }
}

export function addReaction(message: Message, reaction: Reaction): Message {
  const current = message.reactions.find((it) => it.reaction === reaction.reaction && it.creator === reaction.creator)
  if (current === undefined) {
    message.reactions.push(reaction)
  }
  return message
}

export function removeReaction(message: Message, emoji: string, creator: SocialID): Message {
  const reactions = message.reactions.filter((it) => it.reaction !== emoji || it.creator !== creator)
  if (reactions.length === message.reactions.length) return message

  return {
    ...message,
    reactions
  }
}

export function createThread(
  message: Message,
  threadId: CardID,
  threadType: CardType,
  repliesCount: number,
  lastReply: Date
): Message {
  if (message.thread !== undefined) {
    return message
  }

  message.thread = {
    card: message.card,
    message: message.id,
    messageCreated: message.created,
    thread: threadId,
    threadType,
    repliesCount,
    lastReply
  }
  return message
}

export function updateThread(
  message: Message,
  thread: CardID,
  replies: 'increment' | 'decrement',
  lastReply?: Date
): Message {
  if (message.thread === undefined || message.thread.thread !== thread) {
    return message
  }

  message.thread.repliesCount =
    replies === 'increment' ? message.thread.repliesCount + 1 : Math.max(message.thread.repliesCount - 1, 0)
  message.thread.lastReply = lastReply ?? message.thread.lastReply
  return message
}
