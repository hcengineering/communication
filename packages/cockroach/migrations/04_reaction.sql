CREATE TABLE IF NOT EXISTS communication.reaction
(
    message_id INT8         NOT NULL,
    reaction   VARCHAR(100) NOT NULL,
    creator    VARCHAR(255) NOT NULL,
    created    TIMESTAMPTZ  NOT NULL DEFAULT now(),

    PRIMARY KEY (message_id, creator, reaction)
);

CREATE INDEX IF NOT EXISTS reaction_message_idx ON communication.reaction (message_id);
