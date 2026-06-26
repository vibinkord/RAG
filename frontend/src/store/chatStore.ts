import { ChatSession } from '../types';

const STORAGE_KEY = 'ragbot_chat_history';

export const chatStore = {
  getSessions(): Record<number, ChatSession> {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    try {
      return JSON.parse(stored);
    } catch {
      return {};
    }
  },

  getSession(websiteId: number): ChatSession | undefined {
    return this.getSessions()[websiteId];
  },

  saveSession(websiteId: number, session: ChatSession): void {
    const sessions = this.getSessions();
    sessions[websiteId] = session;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  },

  clearSession(websiteId: number): void {
    const sessions = this.getSessions();
    delete sessions[websiteId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }
};
