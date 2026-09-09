-- Targeted rollback for trainerhq_client_timezone_targets; restore the prior lookup behavior.
-- TrainerHQ-only lookup correction; no table, policy, grant, user or stored record changes.
-- Preserve every other byte of the installed function. Abort if the expected contract differs.
do $patch$
declare original text; patched text; old_text text; new_text text; item text[];
begin
 select pg_get_functiondef('trainerhq_private.later_command(uuid,text,jsonb)'::regprocedure) into original;
 patched:=original;
 foreach item slice 1 in array array[
  array['where user_id=rel.client_id and effective_from<=(now() at time zone coalesce((select cp.timezone from public.client_tracking_preferences cp where cp.user_id=rel.client_id),''UTC''))::date','where user_id=rel.client_id and effective_from<=current_date'],
  array['where user_id=actor and effective_from<=(now() at time zone coalesce((select cp.timezone from public.client_tracking_preferences cp where cp.user_id=actor),''UTC''))::date','where user_id=actor and effective_from<=current_date']
 ] loop
  old_text:=item[1];new_text:=item[2];
  if (length(patched)-length(replace(patched,old_text,'')))/length(old_text) <> 1 then
   raise exception 'Unexpected TrainerHQ target lookup; no change applied';
  end if;
  patched:=replace(patched,old_text,new_text);
 end loop;
 execute patched;
end $patch$;
