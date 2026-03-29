DROP INDEX IF EXISTS idx_phone_verification_status_updated_at;
DROP INDEX IF EXISTS idx_phone_verification_expires_at;
DROP INDEX IF EXISTS idx_phone_verification_phone_candidate;
DROP INDEX IF EXISTS idx_phone_verification_pending_user_purpose;
DROP TABLE IF EXISTS user_phone_verification_challenges;
DROP INDEX IF EXISTS idx_users_phone_verified;

ALTER TABLE users
    DROP COLUMN IF EXISTS phone_last_changed_at,
    DROP COLUMN IF EXISTS phone_verified_at,
    DROP COLUMN IF EXISTS phone_verified;
