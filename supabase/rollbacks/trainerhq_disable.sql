-- Emergency compatibility rollback: disable TrainerHQ authorization without
-- dropping data, users, tables, functions, columns, policies or Storage objects.
-- A failed transactional migration normally leaves no changes. This is also
-- safe before the first migration exists. Existing WiFit owner-only RLS is untouched.
do $$ begin
  if to_regclass('trainerhq_private.integration_control') is not null then
    execute 'update trainerhq_private.integration_control set enabled=false where singleton';
  end if;
end $$;
