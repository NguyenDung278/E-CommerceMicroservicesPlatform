DROP TABLE IF EXISTS user_phone_signup_challenges;

DELETE FROM users
WHERE email IS NULL;

ALTER TABLE users
    ALTER COLUMN email SET NOT NULL;
