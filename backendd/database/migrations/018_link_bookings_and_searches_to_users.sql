-- Link bookings and recent searches to the user who owns them.
-- No new tables: the schema stays at 11 relational tables.

ALTER TABLE bookings
  ADD COLUMN user_id INT NULL AFTER id,
  ADD COLUMN cancelled_at TIMESTAMP NULL DEFAULT NULL,
  ADD COLUMN cancellation_reason VARCHAR(255) NULL DEFAULT NULL,
  ADD KEY idx_bookings_user (user_id),
  ADD CONSTRAINT fk_bookings_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE;

ALTER TABLE recent_searches
  ADD COLUMN user_id INT NULL AFTER id,
  ADD KEY idx_recent_searches_user (user_id),
  ADD CONSTRAINT fk_recent_searches_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE;
