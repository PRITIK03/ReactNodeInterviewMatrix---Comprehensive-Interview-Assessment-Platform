"""Run as python -m scripts.import_sqlite SOURCE.sqlite3 using DATABASE_URL for an empty target schema."""

import argparse
import os
import sqlite3
from pathlib import Path
import psycopg
from psycopg import sql
from backend.postgres import Connection, prepare
from backend.store import SCHEMA, FROZEN

# Insert the ordered membership before publishing its parent assessment_version.
ORDER = (
    "organization",
    "account",
    "profile",
    "candidate",
    "job",
    "job_version",
    "application",
    "application_event",
    "resume_consent",
    "assessment_template",
    "question",
    "question_version",
    "assessment_question",
    "assessment_version",
    "job_assessment",
    "invitation",
    "assessment_attempt",
    "answer",
    "code_submission",
    "execution_run",
    "test_case_result",
    "coaching",
    "code_followup",
    "explanation_review",
    "resume",
    "correction",
    "processing_event",
    "evaluation_permission",
    "evaluation",
    "evaluation_event",
    "provider_call",
)


def migrate(path):
    uri = Path(path).resolve(strict=True).as_uri() + "?mode=ro"
    with (
        sqlite3.connect(uri, uri=True) as source,
        psycopg.connect(os.environ["DATABASE_URL"]) as target,
    ):
        source.execute("BEGIN")
        if (
            source.execute("PRAGMA integrity_check").fetchone()[0] != "ok"
            or source.execute("PRAGMA foreign_key_check").fetchone()
        ):
            raise ValueError("Repair the source snapshot first")
        if source.execute(
            "SELECT 1 FROM assessment_attempt WHERE status='grading'"
        ).fetchone():
            raise ValueError("Finish outstanding grading before export")
        if source.execute(
            "SELECT 1 FROM resume WHERE status IN ('uploading','queued','retrying','processing','deleting')"
        ).fetchone():
            raise ValueError("Drain document jobs before export")
        present = {
            r[0]
            for r in source.execute("SELECT name FROM sqlite_master WHERE type='table'")
        }
        if not set(ORDER).issubset(present):
            raise ValueError(
                "Upgrade a copy of the SQLite database to the current schema first"
            )
        target.execute("SELECT pg_advisory_xact_lock(731591)")
        if target.execute(
            "SELECT 1 FROM information_schema.tables WHERE table_schema=current_schema() LIMIT 1"
        ).fetchone():
            raise ValueError("Destination schema must be empty")
        prepare(Connection(target), SCHEMA, FROZEN)
        counts = {}
        for table in ORDER:
            rows = source.execute('SELECT * FROM "' + table + '"')
            columns = [c[0] for c in rows.description]
            statement = sql.SQL("INSERT INTO {} ({}) VALUES ({})").format(
                sql.Identifier(table),
                sql.SQL(",").join(map(sql.Identifier, columns)),
                sql.SQL(",").join(sql.Placeholder() for _ in columns),
            )
            n = 0
            with target.cursor() as cursor:
                while batch := rows.fetchmany(500):
                    cursor.executemany(statement, batch)
                    n += len(batch)
            count = target.execute(
                sql.SQL("SELECT count(*) FROM {}").format(sql.Identifier(table))
            ).fetchone()[0]
            if count != n:
                raise ValueError("Row reconciliation failed")
            counts[table] = n
            if (
                table in ("application_event", "processing_event", "evaluation_event")
                and count
            ):
                target.execute(
                    sql.SQL(
                        "SELECT setval(pg_get_serial_sequence(%s,'id'),max(id)) FROM {}"
                    ).format(sql.Identifier(table)),
                    (table,),
                )
        target.execute("SET CONSTRAINTS ALL IMMEDIATE")
    return counts


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source")
    print(
        "Copied",
        sum(migrate(parser.parse_args().source).values()),
        "rows. Verify private objects before cutover.",
    )
