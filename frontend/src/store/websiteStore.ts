import { Website } from '../types';

const STORAGE_KEY = 'ragbot_websites';

const DEFAULT_WEBSITES: Website[] = [
  {
    id: 1,
    url: "https://spring.io",
    status: "CRAWLED",
    pagesCrawled: 5,
    chunksCreated: 15
  }
];

export const websiteStore = {
  getWebsites(): Website[] {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_WEBSITES));
      return DEFAULT_WEBSITES;
    }
    try {
      return JSON.parse(stored);
    } catch (e) {
      return DEFAULT_WEBSITES;
    }
  },

  addWebsite(url: string, id: number): Website {
    const websites = this.getWebsites();
    const newWebsite: Website = {
      id,
      url,
      status: 'PENDING',
      pagesCrawled: 0,
      chunksCreated: 0
    };
    websites.push(newWebsite);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(websites));
    return newWebsite;
  },

  updateWebsite(id: number, updates: Partial<Website>): Website | null {
    const websites = this.getWebsites();
    const index = websites.findIndex(w => w.id === id);
    if (index === -1) return null;

    websites[index] = { ...websites[index], ...updates };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(websites));
    return websites[index];
  },

  deleteWebsite(id: number): void {
    const websites = this.getWebsites();
    const filtered = websites.filter(w => w.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  }
};
