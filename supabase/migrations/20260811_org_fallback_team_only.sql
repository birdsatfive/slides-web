-- Stop handing the default org to anyone holding a session.
--
-- slides.current_org_id() fell back to a hardcoded org UUID whenever the JWT
-- carried no org_id claim. No user has that claim (0 of 18 in auth.users), so
-- the fallback is how every real session resolves its org. The problem is that
-- the shared GoTrue accepts public self-signup with autoconfirm, so a stranger
-- could mint an `authenticated` JWT with only the anon key and inherit the same
-- default org: 18 decks and 12 share_links were readable straight from
-- /rest/v1, including the share_links.slug values that open a shared deck.
--
-- The app's middleware already restricts the UI to team domains; this makes the
-- data layer agree. Keep the fallback, but only for a team-domain session, so
-- real users are completely unaffected and a stranger resolves to NULL, which
-- matches no row.

CREATE OR REPLACE FUNCTION slides.current_org_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS $function$
  select coalesce(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'org_id')::uuid,
    (current_setting('request.jwt.claims', true)::jsonb ->> 'org_id')::uuid,
    case
      when split_part(
             lower(coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'email', '')),
             '@', 2
           ) in ('birdsatfive.dk', 'birdie.studio')
      then '9ea0efc9-9699-5c0a-9d71-c3338c2b7c40'::uuid
    end
  );
$function$;
