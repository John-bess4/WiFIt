import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolveSession, refreshSession, sb } from "../App.jsx";

const res = (status, body = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

const nowSec = () => Math.floor(Date.now() / 1000);
const store = (s) => localStorage.setItem("sb_session", JSON.stringify(s));

beforeEach(() => {
  localStorage.clear();
  sb._session = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => { vi.restoreAllMocks(); });

describe("resolveSession", () => {
  it("returns valid without a network call when the token is fresh", async () => {
    globalThis.fetch = vi.fn();
    store({ access_token: "good", refresh_token: "rt", expires_at: nowSec() + 3600, user: { id: "u1" } });

    const r = await resolveSession();

    expect(r.status).toBe("valid");
    expect(r.session.user.id).toBe("u1");
    expect(sb._session.access_token).toBe("good");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("refreshes a token inside the skew window", async () => {
    // 30s of life left, inside the 60s REFRESH_SKEW_MS buffer.
    store({ access_token: "stale", refresh_token: "rt", expires_at: nowSec() + 30, user: { id: "u1" } });
    globalThis.fetch = vi.fn(async () => res(200, { access_token: "fresh", refresh_token: "rt2", expires_in: 3600 }));

    const r = await resolveSession();

    expect(r.status).toBe("refreshed");
    expect(r.session.access_token).toBe("fresh");
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("carries the user forward when the refresh response omits it", async () => {
    store({ access_token: "stale", refresh_token: "rt", expires_at: nowSec() - 10, user: { id: "u1", email: "t@t.t" } });
    globalThis.fetch = vi.fn(async () => res(200, { access_token: "fresh", refresh_token: "rt2", expires_in: 3600 }));

    const r = await resolveSession();

    // loadUserData and getUser both need user.id; losing it would route a
    // returning user to sign-in.
    expect(r.session.user.id).toBe("u1");
  });

  it("derives expires_at when the refresh returns only expires_in", async () => {
    store({ access_token: "stale", refresh_token: "rt", expires_at: nowSec() - 10, user: { id: "u1" } });
    globalThis.fetch = vi.fn(async () => res(200, { access_token: "fresh", refresh_token: "rt2", expires_in: 3600 }));

    await resolveSession();

    const saved = JSON.parse(localStorage.getItem("sb_session"));
    expect(saved.expires_at).toBeGreaterThan(nowSec() + 3500);
  });

  it("is logged-out with no stored session", async () => {
    globalThis.fetch = vi.fn();
    expect((await resolveSession()).status).toBe("logged-out");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("is logged-out when the stored blob is corrupt", async () => {
    localStorage.setItem("sb_session", "not json");
    expect((await resolveSession()).status).toBe("logged-out");
  });

  it("is logged-out, and clears storage, when the refresh fails", async () => {
    store({ access_token: "stale", refresh_token: "rt", expires_at: nowSec() - 10, user: { id: "u1" } });
    globalThis.fetch = vi.fn(async () => res(400, { error: "invalid_grant" }));

    expect((await resolveSession()).status).toBe("logged-out");
    expect(localStorage.getItem("sb_session")).toBeNull();
  });

  it("is logged-out when expired with no refresh_token to spend", async () => {
    globalThis.fetch = vi.fn();
    store({ access_token: "stale", expires_at: nowSec() - 10, user: { id: "u1" } });

    expect((await resolveSession()).status).toBe("logged-out");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe("refreshSession — the in-flight guard", () => {
  it("coalesces concurrent callers onto ONE network call", async () => {
    let resolveFetch;
    globalThis.fetch = vi.fn(() => new Promise(r => { resolveFetch = r; }));

    // Both start before either settles — StrictMode's double-mount, or the
    // several writes that finish a workout.
    const a = refreshSession("rt");
    const b = refreshSession("rt");
    resolveFetch(res(200, { access_token: "fresh", refresh_token: "rt2", expires_in: 3600 }));
    const [ra, rb] = await Promise.all([a, b]);

    // One call means the single-use refresh_token is redeemed exactly once.
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(ra).toBe(rb);
    expect(ra.access_token).toBe("fresh");
  });

  it("allows a new refresh after the previous one settles", async () => {
    globalThis.fetch = vi.fn(async () => res(200, { access_token: "fresh", refresh_token: "rt2", expires_in: 3600 }));

    await refreshSession("rt");
    await refreshSession("rt2");

    // The guard must not latch — a later genuine expiry still needs a refresh.
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("returns null on a non-2xx and on a network throw", async () => {
    globalThis.fetch = vi.fn(async () => res(400, { error: "invalid_grant" }));
    expect(await refreshSession("rt")).toBeNull();

    globalThis.fetch = vi.fn(async () => { throw new Error("offline"); });
    expect(await refreshSession("rt")).toBeNull();
  });

  it("returns null when the response carries no access_token", async () => {
    globalThis.fetch = vi.fn(async () => res(200, { token_type: "bearer" }));
    expect(await refreshSession("rt")).toBeNull();
  });
});
