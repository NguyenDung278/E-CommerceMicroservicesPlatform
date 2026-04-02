DROP INDEX IF EXISTS idx_inbox_messages_created_at;
DROP TABLE IF EXISTS inbox_messages;

DROP INDEX IF EXISTS idx_outbox_events_pending;
DROP TABLE IF EXISTS outbox_events;
