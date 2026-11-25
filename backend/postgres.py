"""PostgreSQL binding for the application's parameterized SQL repositories."""

from contextlib import contextmanager
import os
import psycopg
from psycopg.rows import dict_row


class Row(dict):
    def __getitem__(self, key):
        if isinstance(key, int):
            return tuple(self.values())[key]
        return super().__getitem__(key)


def rows(cursor):
    factory = dict_row(cursor)
    return lambda values: Row(factory(values))


class Connection:
    def __init__(self, connection):
        self.connection = connection

    def execute(self, sql, params=()):
        return self.connection.execute(sql.replace("?", "%s"), params)

    def executemany(self, sql, records):
        with self.connection.cursor() as cur:
            cur.executemany(sql.replace("?", "%s"), records)


@contextmanager
def connect(write):
    with psycopg.connect(
        os.environ["DATABASE_URL"], row_factory=rows, connect_timeout=5
    ) as conn:
        if write:
            conn.execute("SELECT pg_advisory_xact_lock(731591)")
        else:
            conn.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        yield Connection(conn)


def prepare(c, schema, frozen):
    schema = schema.replace(
        "id INTEGER PRIMARY KEY", "id BIGSERIAL PRIMARY KEY"
    ).replace(",user TEXT REFERENCES", ', "user" TEXT REFERENCES')
    schema = schema.replace(
        "version TEXT REFERENCES assessment_version,position",
        "version TEXT REFERENCES assessment_version DEFERRABLE INITIALLY DEFERRED,position",
    )
    for statement in schema.split(";"):
        if statement.strip():
            c.execute(statement)
    c.execute("ALTER TABLE test_case_result ADD COLUMN IF NOT EXISTS engine TEXT")
    c.execute("""CREATE OR REPLACE FUNCTION matrix_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'immutable published content'; END; $$""")
    for table in ("evaluation", "evaluation_event"):
        c.execute(
            f"CREATE OR REPLACE TRIGGER immutable_review BEFORE UPDATE ON {table} FOR EACH ROW EXECUTE FUNCTION matrix_immutable()"
        )
    for table in frozen:
        c.execute(
            f"CREATE OR REPLACE TRIGGER freeze_published BEFORE UPDATE OR DELETE ON {table} FOR EACH ROW EXECUTE FUNCTION matrix_immutable()"
        )
    c.execute("""CREATE OR REPLACE FUNCTION matrix_members() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF EXISTS(SELECT 1 FROM assessment_version WHERE id=NEW.version) THEN RAISE EXCEPTION 'immutable membership'; END IF; RETURN NEW; END; $$""")
    c.execute(
        "CREATE OR REPLACE TRIGGER lock_members BEFORE INSERT ON assessment_question FOR EACH ROW EXECUTE FUNCTION matrix_members()"
    )
    c.execute(
        "CREATE OR REPLACE FUNCTION instr(text,text) RETURNS integer LANGUAGE sql IMMUTABLE AS 'SELECT strpos($1,$2)'"
    )
