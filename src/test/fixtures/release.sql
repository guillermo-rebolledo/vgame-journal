-- Synthetic records only. Run on a fresh disposable nonproduction target.
-- psql variable release_user_id must name an existing controlled, verified account.
insert into game (id, title, slug, genres, platforms, synced_at)
  values (1, 'Synthetic Game', 'synthetic-game', '{}', '{PC}', now());
insert into journal_entry (user_id, game_id, status, rating, rated_at, updated_at)
  values (:'release_user_id', 1, 'playing', 8, now(), now());
insert into status_event (user_id, game_id, status, at)
  values (:'release_user_id', 1, 'playing', now());
insert into playthrough (user_id, game_id, platform, started_on, hours, notes)
  values (:'release_user_id', 1, 'PC', '2026-01-01', 2.5, 'Synthetic private note');
insert into custom_list (id, user_id, title, submission_id)
  values ('00000000-0000-4000-8000-000000000001', :'release_user_id', 'Synthetic List', '00000000-0000-4000-8000-000000000002');
insert into list_entry (list_id, game_id, position)
  values ('00000000-0000-4000-8000-000000000001', 1, 0);
