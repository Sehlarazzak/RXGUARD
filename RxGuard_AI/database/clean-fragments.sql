-- Remove typed-fragment pollution ("br", "bru") from the admin's search
-- history; these were logged by the old per-keystroke logging and are not
-- real medicine lookups.
DELETE FROM rxguard.search_history
WHERE query IN ('br', 'bru')
  AND user_id = (SELECT user_id FROM mediverify.users WHERE email = 'tania@gmail.com');
