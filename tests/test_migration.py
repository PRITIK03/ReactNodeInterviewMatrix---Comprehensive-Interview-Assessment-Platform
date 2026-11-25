import os
import pytest
from backend.store import db, initialize
from scripts.import_sqlite import migrate


@pytest.mark.skipif(
    not os.getenv("MATRIX_TEST_POSTGRES"),
    reason="requires an isolated PostgreSQL schema",
)
def test_import_and_refusal_to_overwrite(isolate_test_database, monkeypatch, tmp_path):
    source = tmp_path / "migration.sqlite3"
    with monkeypatch.context() as m:
        m.delenv("DATABASE_URL")
        m.setenv("MATRIX_DB", str(source))
        initialize()
        with db(True) as c:
            c.execute("INSERT INTO organization VALUES('workspace','Synthetic demo')")
            n = c.execute("SELECT count(*) FROM assessment_question").fetchone()[0]
    counts = migrate(source)
    assert counts["organization"] == 1 and counts["assessment_question"] == n
    initialize()
    with db() as c:
        assert (
            c.execute("SELECT name FROM organization").fetchone()[0] == "Synthetic demo"
        )
    with pytest.raises(ValueError, match="empty"):
        migrate(source)
