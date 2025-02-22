import type { CardID, Message, MessageID, RichText, SocialID } from './message'

export interface FileMetadata {
  card: CardID
  title: string
  fromDate: Date
  toDate: Date
}

export interface FileMessage {
  id: MessageID
  content: RichText
  edited?: Date
  creator: SocialID
  created: Date
  reactions: FileReaction[]
}

export interface FileReaction {
  reaction: string
  creator: SocialID
  created: Date
}

export interface ParsedFile {
  metadata: FileMetadata
  messages: Message[]
}
