import type { ServerSession } from "./auth.js";

export type SessionStore = {
  create(session: ServerSession): void;
  get(sessionId: string): ServerSession | null;
  delete(sessionId: string): void;
  clear(): void;
};

class MemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, ServerSession>();

  create(session: ServerSession) {
    this.sessions.set(session.id, session);
  }

  get(sessionId: string) {
    return this.sessions.get(sessionId) ?? null;
  }

  delete(sessionId: string) {
    this.sessions.delete(sessionId);
  }

  clear() {
    this.sessions.clear();
  }
}

const defaultSessionStore = new MemorySessionStore();
let sessionStore: SessionStore = defaultSessionStore;

export function getSessionStore() {
  return sessionStore;
}

export function setSessionStore(store: SessionStore) {
  sessionStore = store;
  return () => {
    sessionStore = defaultSessionStore;
  };
}

export function resetDefaultSessionStore() {
  defaultSessionStore.clear();
}
