import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sb, setAuthLostHandler } from "../App.jsx";

const res = (status, body = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

const isRefresh = (url) => String(url).includes("grant_type=refresh_token");
const isRest = (url) => String(url).includes("/rest/v1/");
const authOf = (init) => (init?.headers?.Authorization || "").replace("Bearer ", "");

let calls;

/** Queue-driven fetch: each entry gets (url, init) and returns a Response. */
function mockFetch(handlers) {
  calls = [];
  globalThis.fetch = vi.fn(async (url, init) => {
    calls.push({ url: String(url), auth: authOf(init), refresh: isRefresh(url), rest: isRest(url) });
    const h = handlers[calls.length - 1];
    if (!h) throw new Error("unexpected fetch #" + calls.length + " to " + url);
    return h(url, init);
  });
}

beforeEach(() => {
  sb._session = { access_token: "old", refresh_token: "rt" };
  setAuthLostHandler(null);
  localStorage.clear();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => { vi.restoreAllMocks(); });

describe("sb._fetch — 401 refresh-and-retry", () => {
  it("refreshes once and retries with the new token", async () => {
    mockFetch([
      () => res(401, { code: "PGRST303", message: "JWT expired" }),
      () => res(200, { access_token: "new", refresh_token: "rt2", expires_in: 3600 }),
      () => res(200, [{ id: "row1" }]),
    ]);

    const row = await sb.insert("food_log", { user_id: "u1" });

    expect(calls).toHaveLength(3);
    expect(calls[0].auth).toBe("old");
    expect(calls[1].refresh).toBe(true);
    expect(calls[2].auth).toBe("new"); // retry carries the rotated token
    expect(row).toEqual({ id: "row1" });
    expect(sb._session.access_token).toBe("new");
  });

  it("does not loop when the retry also 401s, and surfaces the failure", async () => {
    mockFetch([
      () => res(401, { code: "PGRST303" }),
      () => res(200, { access_token: "new", refresh_token: "rt2", expires_in: 3600 }),
      () => res(401, { code: "PGRST303" }), // retry rejected too
    ]);

    const row = await sb.insert("workout_sessions", { user_id: "u1" });

    // Exactly one retry. A fourth call would mean the retry recursed.
    expect(calls).toHaveLength(3);
    expect(calls.filter(c => c.refresh)).toHaveLength(1);
    expect(row).toBeNull(); // the insert contract: null on failure, never a silent success
  });

  it("signs out when the refresh itself fails", async () => {
    const onLost = vi.fn();
    setAuthLostHandler(onLost);
    localStorage.setItem("sb_session", "{}");
    mockFetch([
      () => res(401, { code: "PGRST303" }),
      () => res(400, { error: "invalid_grant" }), // rotated token already spent
    ]);

    const row = await sb.insert("food_log", { user_id: "u1" });

    expect(calls).toHaveLength(2); // no retry after a failed refresh
    expect(row).toBeNull();
    expect(onLost).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("sb_session")).toBeNull();
  });
});

describe("sb._fetch — the token-changed guard", () => {
  // The guard that stops a user being signed out mid-workout. refreshSession's
  // in-flight promise only coalesces requests that overlap in time; the writes
  // that finish a workout 401 in sequence. If a later one re-redeemed the
  // single-use refresh_token the first had already rotated, Supabase rejects it
  // and the session dies.
  it("skips the refresh when the live session already moved on", async () => {
    mockFetch([
      () => {
        // Simulate a sibling request having refreshed while this one was in flight.
        sb._session = { access_token: "newer", refresh_token: "rt2" };
        return res(401, { code: "PGRST303" });
      },
      () => res(200, [{ id: "row1" }]),
    ]);

    const row = await sb.insert("food_log", { user_id: "u1" });

    expect(calls).toHaveLength(2);
    expect(calls.some(c => c.refresh)).toBe(false); // the whole point
    expect(calls[1].auth).toBe("newer"); // retried on the sibling's token
    expect(row).toEqual({ id: "row1" });
  });

  it("does refresh when the token is unchanged — a genuine expiry", async () => {
    mockFetch([
      () => res(401, { code: "PGRST303" }),
      () => res(200, { access_token: "new", refresh_token: "rt2", expires_in: 3600 }),
      () => res(200, [{ id: "row1" }]),
    ]);
    await sb.insert("food_log", { user_id: "u1" });
    expect(calls.filter(c => c.refresh)).toHaveLength(1);
  });
});

describe("sb._fetch — statuses that must NOT trigger a refresh", () => {
  it("leaves a 403 alone — an RLS denial is not fixable by refreshing", async () => {
    mockFetch([() => res(403, { message: "row-level security" })]);
    const row = await sb.insert("food_log", { user_id: "u1" });
    expect(calls).toHaveLength(1);
    expect(calls.some(c => c.refresh)).toBe(false);
    expect(row).toBeNull();
  });

  it("leaves a 409 alone", async () => {
    mockFetch([() => res(409, { code: "23505" })]);
    const row = await sb.upsert("water_log", { user_id: "u1" }, { onConflict: "user_id,log_date" });
    expect(calls).toHaveLength(1);
    expect(row).toBeNull();
  });

  it("makes exactly one call on success", async () => {
    mockFetch([() => res(200, [{ id: "row1" }])]);
    const row = await sb.insert("food_log", { user_id: "u1" });
    expect(calls).toHaveLength(1);
    expect(row).toEqual({ id: "row1" });
  });
});

describe("sb — return contracts survive the retry path", () => {
  it("select still collapses any non-2xx to []", async () => {
    mockFetch([() => res(500, { message: "boom" })]);
    expect(await sb.select("food_log", "user_id=eq.u1")).toEqual([]);
  });

  it("selectAuth still reports authError on a 401 the retry could not fix", async () => {
    mockFetch([
      () => res(401, {}),
      () => res(200, { access_token: "new", refresh_token: "rt2", expires_in: 3600 }),
      () => res(401, {}),
    ]);
    const r = await sb.selectAuth("profiles", "id=eq.u1");
    expect(r).toEqual({ authError: true, rows: [] });
  });

  it("delete and update still return booleans", async () => {
    mockFetch([() => res(200, {})]);
    expect(await sb.delete("food_log", "id=eq.1")).toBe(true);
    mockFetch([() => res(500, {})]);
    expect(await sb.update("food_log", { grams: 1 }, { filter: "id=eq.1" })).toBe(false);
  });
});
