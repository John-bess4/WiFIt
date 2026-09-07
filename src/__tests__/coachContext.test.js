import { describe, it, expect } from "vitest";
import { buildContextMessages, buildRequestMessages, summarizeActionCard } from "../App.jsx";

// Known issue #17: applied-action cards were dropped from the model's context,
// so it re-emitted the previous turn's water action with the next request.
describe("buildContextMessages", () => {
  const history = [
    { bot: true, text: "Welcome back!", isCheckin: true },
    { bot: false, text: "log 16 oz of water" },
    { bot: true, type: "water_logged", oz: 16, text: "Nice." },
    { bot: false, text: "I ate 100g of chicken" },
    { bot: true, type: "multi_food_logged", items: [{ name: "Chicken Breast", grams: 100 }], text: "" },
    { bot: true, isError: true, text: "I'm having trouble connecting" },
  ];

  it("replays applied actions as assistant lines so the model knows they happened", () => {
    const ctx = buildContextMessages(history);
    expect(ctx.map((t) => t.role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(ctx[1].content).toBe("[Logged 16 oz water] Nice.");
    expect(ctx[3].content).toBe("[Logged: Chicken Breast 100 g]");
  });

  it("drops check-ins and our own error bubbles, and starts with a user turn", () => {
    const ctx = buildContextMessages(history);
    expect(ctx.some((t) => /Welcome back|trouble connecting/.test(t.content))).toBe(false);
    expect(ctx[0].role).toBe("user");
  });

  it("merges consecutive same-role turns instead of sending two assistant messages in a row", () => {
    const ctx = buildContextMessages([
      { bot: false, text: "log water and chicken" },
      { bot: true, type: "water_logged", oz: 8, text: "" },
      { bot: true, type: "multi_food_logged", items: [{ name: "Chicken", grams: 50 }], text: "" },
    ]);
    expect(ctx).toHaveLength(2);
    expect(ctx[1].content).toBe("[Logged 8 oz water]\n[Logged: Chicken 50 g]");
  });

  it("summarises every card type without throwing on missing fields", () => {
    for (const type of ["water_logged", "multi_food_logged", "supp_added", "meal_suggestion", "recipe", "workout_plan"]) {
      expect(typeof summarizeActionCard({ type })).toBe("string");
    }
  });
});

describe("buildRequestMessages — the new user turn appears exactly once", () => {
  // The original bug: send() passed [...messages, userMsg] as history and
  // callClaude appended userMsg again, so the model was asked twice and
  // logged twice ("Logged both 16oz entries").
  const prior = [{ bot: false, text: "hi" }, { bot: true, text: "hello" }];
  const count = (msgs, text) => msgs.filter((m) => m.role === "user" && m.content === text).length;

  it("appends the user message once when history holds prior turns only", () => {
    const req = buildRequestMessages("log 16 oz of water", prior);
    expect(req[req.length - 1]).toEqual({ role: "user", content: "log 16 oz of water" });
    expect(count(req, "log 16 oz of water")).toBe(1);
  });

  it("does not duplicate it when a caller already put it at the end of history", () => {
    const req = buildRequestMessages("log 16 oz of water", [...prior, { bot: false, text: "log 16 oz of water" }]);
    expect(count(req, "log 16 oz of water")).toBe(1);
    expect(req[req.length - 1].content).toBe("log 16 oz of water");
    // and never merged into one user turn containing the text twice
    expect(req.some((m) => m.content.split("log 16 oz of water").length > 2)).toBe(false);
  });

  it("test-the-test: the old assembly would have failed this", () => {
    const old = [...buildContextMessages([...prior, { bot: false, text: "x" }]), { role: "user", content: "x" }];
    expect(old.filter((m) => m.role === "user" && m.content === "x").length).toBe(2);
  });
});
