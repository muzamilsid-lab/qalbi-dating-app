/**
 * ChatIndexedDB — offline-first message cache using the `idb` library.
 *
 * Stores:
 *   messages        — decrypted messages (never persists ciphertext)
 *   conversations   — conversation metadata + partner info
 *   queued_messages — outbound messages waiting to be sent
 */

import { openDB, IDBPDatabase, DBSchema } from 'idb';
import { DecryptedMessage, ConversationWithPartner, QueuedMessage } from '../types';

const DB_NAME    = 'qalbi-chat';
const DB_VERSION = 1;

interface ChatSchema extends DBSchema {
  messages: {
    key: string; // message id
    value: DecryptedMessage & { _conversationId: string };
    indexes: {
      by_conversation: [string, Date];   // [conversationId, sentAt]
    };
  };
  conversations: {
    key: string; // conversation id
    value: ConversationWithPartner & { _updatedAt: number };
    indexes: {
      by_activity: number; // lastActivityAt.getTime()
    };
  };
  queued_messages: {
    key: string; // localId
    value: QueuedMessage;
    indexes: {
      by_next_retry: number; // nextRetryAt.getTime()
    };
  };
}

async function getDB(): Promise<IDBPDatabase<ChatSchema>> {
  return openDB<ChatSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // messages
      const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
      msgStore.createIndex('by_conversation', ['_conversationId', 'sentAt']);

      // conversations
      const convStore = db.createObjectStore('conversations', { keyPath: 'id' });
      convStore.createIndex('by_activity', '_updatedAt');

      // queue
      const qStore = db.createObjectStore('queued_messages', { keyPath: 'localId' });
      qStore.createIndex('by_next_retry', ['nextRetryAt'] as any);
    },
  });
}

export class ChatIndexedDB {
  private static _instance: ChatIndexedDB | null = null;
  private db: IDBPDatabase<ChatSchema> | null = null;

  static getInstance(): ChatIndexedDB {
    if (!ChatIndexedDB._instance) ChatIndexedDB._instance = new ChatIndexedDB();
    return ChatIndexedDB._instance;
  }

  async init(): Promise<void> {
    this.db = await getDB();
  }

  // ─── Messages ──────────────────────────────────────────────────────────────

  async putMessage(msg: DecryptedMessage): Promise<void> {
    const db = this.requireDB();
    await db.put('messages', { ...msg, _conversationId: msg.conversationId });
  }

  async putMessages(msgs: DecryptedMessage[]): Promise<void> {
    const db = this.requireDB();
    const tx = db.transaction('messages', 'readwrite');
    await Promise.all([
      ...msgs.map(m => tx.store.put({ ...m, _conversationId: m.conversationId })),
      tx.done,
    ]);
  }

  async getMessage(id: string): Promise<DecryptedMessage | undefined> {
    return this.requireDB().get('messages', id);
  }

  async getMessages(
    conversationId: string,
    limit = 40,
    before?: Date,
  ): Promise<DecryptedMessage[]> {
    const db    = this.requireDB();
    const upper = before ?? new Date();
    const range = IDBKeyRange.bound(
      [conversationId, new Date(0)],
      [conversationId, upper],
    );
    const results = await db.getAllFromIndex('messages', 'by_conversation', range);
    // Sort descending, take last N, return ascending
    return results
      .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())
      .slice(0, limit)
      .reverse();
  }

  async deleteMessage(id: string): Promise<void> {
    await this.requireDB().delete('messages', id);
  }

  async updateMessageStatus(
    id: string,
    patch: Partial<Pick<DecryptedMessage, 'status' | 'deliveredAt' | 'readAt' | 'failReason'>>,
  ): Promise<void> {
    const db  = this.requireDB();
    const msg = await db.get('messages', id);
    if (!msg) return;
    await db.put('messages', { ...msg, ...patch });
  }

  // ─── Conversations ─────────────────────────────────────────────────────────

  async putConversation(conv: ConversationWithPartner): Promise<void> {
    await this.requireDB().put('conversations', {
      ...conv,
      _updatedAt: conv.lastActivityAt.getTime(),
    });
  }

  async getConversation(id: string): Promise<ConversationWithPartner | undefined> {
    return this.requireDB().get('conversations', id);
  }

  async getAllConversations(): Promise<ConversationWithPartner[]> {
    const db      = this.requireDB();
    const results = await db.getAllFromIndex('conversations', 'by_activity');
    return results.reverse(); // newest first
  }

  // ─── Message queue ─────────────────────────────────────────────────────────

  async enqueue(msg: QueuedMessage): Promise<void> {
    await this.requireDB().put('queued_messages', msg);
  }

  async dequeue(localId: string): Promise<void> {
    await this.requireDB().delete('queued_messages', localId);
  }

  async getPendingQueue(limit = 20): Promise<QueuedMessage[]> {
    const db    = this.requireDB();
    const now   = Date.now();
    // Get messages whose nextRetryAt <= now
    const all   = await db.getAll('queued_messages');
    return all
      .filter(m => m.nextRetryAt.getTime() <= now)
      .sort((a, b) => a.nextRetryAt.getTime() - b.nextRetryAt.getTime())
      .slice(0, limit);
  }

  async updateQueueItem(msg: QueuedMessage): Promise<void> {
    await this.requireDB().put('queued_messages', msg);
  }

  async getQueueSize(): Promise<number> {
    return this.requireDB().count('queued_messages');
  }

  // ─── Full wipe (logout) ────────────────────────────────────────────────────

  async clear(): Promise<void> {
    const db = this.requireDB();
    await Promise.all([
      db.clear('messages'),
      db.clear('conversations'),
      db.clear('queued_messages'),
    ]);
  }

  private requireDB(): IDBPDatabase<ChatSchema> {
    if (!this.db) throw new Error('ChatIndexedDB not initialised — call init() first');
    return this.db;
  }
}

export const chatDB = ChatIndexedDB.getInstance();
