-- Toast is no longer a template type (owner decision 2026-11-11): Show Toast is a native action,
-- and templates gain the Modal and Bottom Sheet types. Toast templates and their action flows go
-- (action_flows rows cascade with their template).
DELETE FROM "templates" WHERE "type" = 'toast';
