-- The AI Coach's ADD_SUPP items carry {category, note}, but category was
-- one-way-hashed into dot_color and note was rendered once in the chat card
-- and never saved. Persist both; dot_color derivation is unchanged.
ALTER TABLE supplement_stack
  ADD COLUMN category text,
  ADD COLUMN note text;
