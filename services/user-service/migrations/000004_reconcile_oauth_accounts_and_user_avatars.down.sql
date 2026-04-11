ALTER TABLE IF EXISTS user_oauth_accounts
    DROP COLUMN IF EXISTS access_token_expires_at,
    DROP COLUMN IF EXISTS id_token,
    DROP COLUMN IF EXISTS scope,
    DROP COLUMN IF EXISTS token_type,
    DROP COLUMN IF EXISTS refresh_token,
    DROP COLUMN IF EXISTS access_token,
    DROP COLUMN IF EXISTS provider_email;

DROP INDEX IF EXISTS idx_user_avatars_updated_at;
DROP TABLE IF EXISTS user_avatars;
