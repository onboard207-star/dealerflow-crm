-- Better Auth uses a dedicated pool whose connections carry this immutable
-- startup setting. General application connections do not receive it.
CREATE POLICY "users_auth_runtime_select" ON "users" FOR SELECT
  USING (nullif(current_setting('app.auth_runtime', true), '') = 'enabled');

CREATE POLICY "users_auth_runtime_insert" ON "users" FOR INSERT
  WITH CHECK (nullif(current_setting('app.auth_runtime', true), '') = 'enabled');

CREATE POLICY "users_auth_runtime_update" ON "users" FOR UPDATE
  USING (nullif(current_setting('app.auth_runtime', true), '') = 'enabled')
  WITH CHECK (nullif(current_setting('app.auth_runtime', true), '') = 'enabled');
