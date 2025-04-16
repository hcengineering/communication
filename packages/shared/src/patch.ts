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

import {
  PatchType,
  type BlobID,
  type CardID,
  type Message,
  type Patch,
  type Reaction,
  type SocialID,
  type File
} from '@hcengineering/communication-types'

type PatchFile = Pick<File, 'blobId' | 'type' | 'filename' | 'size'>

export function applyPatches(message: Message, patches: Patch[], allowedPatchTypes: PatchType[] = []): Message {
  if (patches.length === 0) return message

  for (const p of patches) {
    message = applyPatch(message, p, allowedPatchTypes)
  }
  return message
}

export function applyPatch(message: Message, patch: Patch, allowedPatchTypes: PatchType[] = []): Message {
  if (allowedPatchTypes.length > 0 && !allowedPatchTypes.includes(patch.type)) return message
  switch (patch.type) {
    case PatchType.update:
      return {
        ...message,
        edited: patch.created,
        content: patch.content
      }
    case PatchType.addReaction:
      return addReaction(message, {
        message: message.id,
        reaction: patch.content,
        creator: patch.creator,
        created: patch.created
      })
    case PatchType.removeReaction:
      return removeReaction(message, patch.content, patch.creator)
    case PatchType.addReply:
      return addReply(message, patch.content as CardID, patch.created)
    case PatchType.removeReply:
      return removeReply(message, patch.content as CardID)
    case PatchType.addFile:
      return addFile(message, JSON.parse(patch.content) as PatchFile, patch.created, patch.creator)
    case PatchType.removeFile:
      return removeFile(message, patch.content as BlobID)
  }

  return message
}

function addReaction(message: Message, reaction: Reaction): Message {
  message.reactions.push(reaction)
  return message
}

function removeReaction(message: Message, emoji: string, creator: SocialID): Message {
  const reactions = message.reactions.filter((it) => it.reaction !== emoji || it.creator !== creator)
  if (reactions.length === message.reactions.length) return message

  return {
    ...message,
    reactions
  }
}

function addReply(message: Message, thread: CardID, created: Date): Message {
  if (message.thread === undefined) {
    return {
      ...message,
      thread: {
        card: message.card,
        message: message.id,
        messageCreated: message.created,
        thread,
        repliesCount: 1,
        lastReply: created
      }
    }
  }

  if (message.thread.thread !== thread) return message

  return {
    ...message,
    thread: {
      ...message.thread,
      repliesCount: message.thread.repliesCount + 1,
      lastReply: created
    }
  }
}

function addFile(message: Message, file: PatchFile, created: Date, creator: SocialID): Message {
  message.files.push({
    ...file,
    card: message.card,
    message: message.id,
    created,
    creator,
    messageCreated: message.created
  })
  return message
}

function removeFile(message: Message, blobId: BlobID): Message {
  const files = message.files.filter((it) => it.blobId !== blobId)
  if (files.length === message.files.length) return message

  return {
    ...message,
    files
  }
}

function removeReply(message: Message, thread: CardID): Message {
  if (message.thread === undefined || message.thread.thread !== thread) return message

  return {
    ...message,
    thread: {
      ...message.thread,
      repliesCount: message.thread.repliesCount - 1
    }
  }
}
