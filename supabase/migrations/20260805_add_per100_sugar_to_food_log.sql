-- Sugar was collected by the custom-food form, shown in the preview, computed
-- into per100.sugar by saveCustomFood — and then dropped by both inserts and
-- both read mappers. custom_foods.per100_sugar already existed (never written);
-- food_log had no sugar column at all, so per-entry sugar could not be logged.
ALTER TABLE food_log ADD COLUMN per100_sugar numeric;
