-- Outreach is connect-first (Nov 9, 2026): found -> pending (connection request sent) -> accepted
-- -> messaged (full note sent in the DMs) -> call. Old drafted/sent/replied/shadow rows are remapped.
alter table career_contact drop constraint career_contact_stage_check;
update career_contact set stage = case stage
  when 'drafted' then 'found' when 'sent' then 'pending' when 'replied' then 'accepted' when 'shadow' then 'call' else stage end;
alter table career_contact add constraint career_contact_stage_check
  check (stage in ('found', 'pending', 'accepted', 'messaged', 'call'));
