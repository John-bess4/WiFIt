import { describe, it, expect } from "vitest";
import { hasDbId, withDbId, foodDeleteFilter } from "../App.jsx";

// Log then delete in one session. Before the fix the item kept its local id
// (Date.now()), the delete filter was id=eq.<number> against a uuid column,
// and the row survived. The contract: after insert the item carries the
// uuid, and a delete filter exists only for an item that has one.
describe("food_log identity across log -> delete in one session", () => {
  const uid = "50bc7457-c7be-46a2-bacd-c467283a11e6";
  const local = { id: Date.now(), name: "Milk", grams: 100 };
  const row = { id: "774ac6a1-0fe5-4bdf-8af9-fbd48cd76b0f" };

  it("a freshly logged item has no database id and therefore no delete filter", () => {
    expect(hasDbId(local)).toBe(false);
    expect(foodDeleteFilter(local, uid)).toBeNull();
  });

  it("after the insert returns, the item carries the row's uuid and the delete filter targets exactly that row", () => {
    const slot = [{ id: 1, name: "Eggs" }, local];
    const after = withDbId(slot, local, row);
    const mine = after[1];
    expect(mine.id).toBe(row.id);
    expect(after[0]).toBe(slot[0]); // other items untouched, by reference
    expect(foodDeleteFilter(mine, uid)).toBe("id=eq." + row.id + "&user_id=eq." + uid);
  });

  it("test-the-test: the old code's filter would have been a number against a uuid column", () => {
    const oldFilter = "id=eq." + local.id + "&user_id=eq." + uid;
    expect(oldFilter).toMatch(/id=eq\.\d+&/);
    expect(hasDbId({ id: local.id })).toBe(false);
  });
});
