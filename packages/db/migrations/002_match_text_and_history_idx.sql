alter table profiles add column if not exists match_text text;

update profiles
set match_text = sanitized_summary
where match_text is null;

alter table profiles
alter column match_text set not null;

create index if not exists matches_pair_history_idx
on matches (least(user_a_id, user_b_id), greatest(user_a_id, user_b_id));
