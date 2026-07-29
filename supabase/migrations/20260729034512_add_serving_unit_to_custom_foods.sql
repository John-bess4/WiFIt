-- The custom-food form offered a g/ml/oz/cup/tbsp/piece selector but discarded
-- the unit and stored the raw number as grams, so "4 oz" persisted as 4 g and
-- the derived per-100g macros were 28x too high.
--
-- serving_g remains the source of truth (per100_* means "per 100 grams"
-- everywhere in the app). These two columns record what the user actually typed
-- so a future edit screen can show "4 oz" instead of "113.4 g".
ALTER TABLE custom_foods
  ADD COLUMN serving_qty numeric,
  ADD COLUMN serving_unit text;
