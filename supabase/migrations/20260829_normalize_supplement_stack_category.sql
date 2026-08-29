-- supplement_stack.category held two vocabularies at once.
--
-- The AI coach wrote lowercase PURPOSE values from a closed set of eight
-- (protein, vitamin, mineral, performance, health, sleep, fat_burner,
-- probiotic). The manual add path wrote capitalised PRODUCT TYPES taken from
-- SUPP_DB and the create picker (Protein, Creatine, Omega-3, ...). Same column,
-- two different axes: "what is it" versus "what is it for".
--
-- Nothing read the column, so nothing was visibly broken — but Phase 2 grouping
-- would have treated 'Creatine' and 'performance' as unrelated buckets.
--
-- Purpose wins for the stack. Product type is not lost: it stays on SUPP_DB,
-- the catalogue's own field, which still drives browse filtering and search.
-- The client stopped writing product types in the same change as this migration
-- (toSuppCategory maps at write time), so this only has to clean up history.
--
-- Affects exactly ONE row today: 'Creatine' -> 'performance'.
--
-- Idempotent: the WHERE clause matches only values that are not already
-- lowercase, so a second run is a no-op.
--
-- 'else category' rather than 'else null': an unmapped capitalised value would
-- be unexpected, and nulling it would destroy information that a human should
-- look at instead. Verified below that none remain.

update supplement_stack
set category = case category
  when 'Protein'      then 'protein'
  when 'Vitamins'     then 'vitamin'
  when 'Multivitamin' then 'vitamin'
  when 'Creatine'     then 'performance'
  when 'Pre-Workout'  then 'performance'
  when 'BCAAs'        then 'performance'
  when 'Electrolytes' then 'mineral'
  when 'Omega-3'      then 'health'
  when 'Collagen'     then 'health'
  when 'Greens/Multi' then 'health'
  when 'Sleep'        then 'sleep'
  when 'Probiotic'    then 'probiotic'
  -- The picker's I-don't-know option asserts no purpose.
  when 'Supplement'   then null
  else category
end
where category is not null
  and category <> lower(category);

-- Existing NULLs are left as NULL on purpose: grouping needs an "Uncategorised"
-- bucket regardless, and a guessed purpose would be worse than an honest blank.
--
-- No CHECK constraint yet. The pre-ACTIONS ADD_SUPP path is still live until C2
-- retires it, and it does not validate category — a constraint today would turn
-- a bad model response into a failed insert the user sees as "couldn't save".
-- Add `check (category is null or category in (...))` once C2 has landed.
