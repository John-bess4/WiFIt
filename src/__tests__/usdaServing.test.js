import { describe, it, expect } from "vitest";
import { usdaServingGrams } from "../App.jsx";

// USDA reports servingSize with a unit that is not always grams. The number used
// to be taken regardless, which is how a 414 ml shake became 414 g and a 5000 IU
// vitamin D became "5000g/serving" in the supplement list.
describe("usdaServingGrams", () => {
  it("passes grams through, in every spelling USDA uses", () => {
    expect(usdaServingGrams({ servingSize: 85, servingSizeUnit: "g" })).toBe(85);
    expect(usdaServingGrams({ servingSize: 85, servingSizeUnit: "GRM" })).toBe(85);
    expect(usdaServingGrams({ servingSize: 30, servingSizeUnit: "Grams" })).toBe(30);
    expect(usdaServingGrams({ servingSize: 30, servingSizeUnit: " g " })).toBe(30);
  });

  it("converts ounces, because that is a conversion and not a guess", () => {
    expect(usdaServingGrams({ servingSize: 1, servingSizeUnit: "oz" })).toBe(28.3);
    expect(usdaServingGrams({ servingSize: 2, servingSizeUnit: "OZ" })).toBe(56.7);
  });

  it("refuses millilitres — ml→g needs a density, which is a property of the food", () => {
    expect(usdaServingGrams({ servingSize: 414, servingSizeUnit: "ml" })).toBeNull();
    expect(usdaServingGrams({ servingSize: 240, servingSizeUnit: "MLT" })).toBeNull();
  });

  it("refuses IU — the case that produced 5000g/serving vitamin D", () => {
    expect(usdaServingGrams({ servingSize: 5000, servingSizeUnit: "IU" })).toBeNull();
  });

  it("returns null for a missing, unknown, zero or negative serving", () => {
    expect(usdaServingGrams({ servingSize: 100 })).toBeNull();
    expect(usdaServingGrams({ servingSize: 100, servingSizeUnit: "tbsp" })).toBeNull();
    expect(usdaServingGrams({ servingSizeUnit: "g" })).toBeNull();
    expect(usdaServingGrams({ servingSize: 0, servingSizeUnit: "g" })).toBeNull();
    expect(usdaServingGrams({ servingSize: -5, servingSizeUnit: "g" })).toBeNull();
    expect(usdaServingGrams({})).toBeNull();
    expect(usdaServingGrams(null)).toBeNull();
  });

  it("accepts the string quantities the API sometimes returns", () => {
    expect(usdaServingGrams({ servingSize: "150", servingSizeUnit: "g" })).toBe(150);
  });
});
