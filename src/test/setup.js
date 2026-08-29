// App.jsx persists the auth session to localStorage, which Node does not have.
// A Map-backed stub is enough: the code only ever does getItem/setItem/removeItem,
// and every call site is already wrapped in try/catch.
class MemoryStorage {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  clear() { this.m.clear(); }
}

globalThis.localStorage = new MemoryStorage();

// No test may reach the network. Anything that does gets a loud failure rather
// than a confusing timeout — a test that silently hit real Supabase would be
// worse than no test.
globalThis.fetch = () => {
  throw new Error("fetch was not mocked in this test");
};
