-- New booking states. In its own file, because a new enum value can't be used in the transaction
-- that adds it.
alter type booking_status add value if not exists 'pending_approval';
alter type booking_status add value if not exists 'declined';
alter type booking_status add value if not exists 'contested';
