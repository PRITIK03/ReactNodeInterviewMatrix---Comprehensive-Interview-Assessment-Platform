"""Project-local, transactional storage. Published content is append-only."""

import hashlib
import json
import os
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / "runtime"


def uid():
    return uuid4().hex


def now():
    return int(time.time())


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


@contextmanager
def db(write=False):
    if os.getenv("DATABASE_URL"):
        from .postgres import connect

        with connect(write) as connection:
            yield connection
        return
    path = Path(os.getenv("MATRIX_DB", RUNTIME / "matrix.sqlite3"))
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=15)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA recursive_triggers=ON")
    try:
        conn.execute("BEGIN IMMEDIATE" if write else "BEGIN")
        yield conn
        conn.commit()
    finally:
        conn.close()


SCHEMA = """
CREATE TABLE IF NOT EXISTS worker_status(id INTEGER PRIMARY KEY,at INTEGER);
CREATE TABLE IF NOT EXISTS organization(id TEXT PRIMARY KEY,name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS account(id TEXT PRIMARY KEY,email TEXT UNIQUE,secret TEXT,role TEXT,org TEXT REFERENCES organization);
CREATE TABLE IF NOT EXISTS session(token TEXT PRIMARY KEY,user TEXT REFERENCES account,expires INTEGER);
CREATE TABLE IF NOT EXISTS profile(owner TEXT PRIMARY KEY REFERENCES account,name TEXT NOT NULL,headline TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS auth_window(client TEXT PRIMARY KEY,until INTEGER,hits INTEGER);
CREATE TABLE IF NOT EXISTS candidate(id TEXT PRIMARY KEY,org TEXT REFERENCES organization,email TEXT,name TEXT,owner TEXT REFERENCES account,UNIQUE(org,email));
CREATE TABLE IF NOT EXISTS job(id TEXT PRIMARY KEY,org TEXT REFERENCES organization);
CREATE TABLE IF NOT EXISTS job_version(id TEXT PRIMARY KEY,job TEXT REFERENCES job,revision INTEGER,title TEXT,description TEXT,criteria TEXT,status TEXT,UNIQUE(job,revision));
CREATE TABLE IF NOT EXISTS application(id TEXT PRIMARY KEY,job_version TEXT REFERENCES job_version,candidate TEXT REFERENCES candidate,stage TEXT,UNIQUE(job_version,candidate));
CREATE TABLE IF NOT EXISTS application_event(id INTEGER PRIMARY KEY,application TEXT REFERENCES application,stage TEXT,at INTEGER);
CREATE TABLE IF NOT EXISTS resume_consent(application TEXT PRIMARY KEY REFERENCES application,actor TEXT REFERENCES account,at INTEGER);
CREATE TABLE IF NOT EXISTS assessment_template(id TEXT PRIMARY KEY,company TEXT,level TEXT,kind TEXT);
CREATE TABLE IF NOT EXISTS assessment_version(id TEXT PRIMARY KEY,template TEXT REFERENCES assessment_template,minutes INTEGER,published INTEGER);
CREATE TABLE IF NOT EXISTS job_assessment(job_version TEXT REFERENCES job_version,assessment TEXT REFERENCES assessment_version,PRIMARY KEY(job_version,assessment));
CREATE TABLE IF NOT EXISTS question(id TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS question_version(id TEXT PRIMARY KEY,question TEXT REFERENCES question,body TEXT);
CREATE TABLE IF NOT EXISTS assessment_question(version TEXT REFERENCES assessment_version,position INTEGER,question TEXT REFERENCES question_version,PRIMARY KEY(version,position),UNIQUE(version,question));
CREATE TABLE IF NOT EXISTS invitation(id TEXT PRIMARY KEY,application TEXT REFERENCES application,version TEXT REFERENCES assessment_version,token TEXT UNIQUE,expires INTEGER,accepted INTEGER);
CREATE TABLE IF NOT EXISTS assessment_attempt(id TEXT PRIMARY KEY,owner TEXT REFERENCES account,version TEXT REFERENCES assessment_version,invitation TEXT UNIQUE REFERENCES invitation,request_key TEXT,started INTEGER,expires INTEGER,status TEXT,submitted INTEGER,score INTEGER,total INTEGER,UNIQUE(owner,request_key));
CREATE INDEX IF NOT EXISTS attempt_owner_history ON assessment_attempt(owner,started DESC,id DESC);
CREATE TABLE IF NOT EXISTS answer(attempt TEXT REFERENCES assessment_attempt,question TEXT REFERENCES question_version,value TEXT,PRIMARY KEY(attempt,question));
CREATE TABLE IF NOT EXISTS code_followup(
    attempt TEXT REFERENCES assessment_attempt ON DELETE CASCADE,question TEXT REFERENCES question_version,
    turn INTEGER NOT NULL CHECK(turn BETWEEN 1 AND 4),source_hash TEXT NOT NULL,line INTEGER NOT NULL,
    excerpt TEXT NOT NULL,prompt TEXT NOT NULL,provider TEXT NOT NULL,reply TEXT,created INTEGER NOT NULL,answered INTEGER,
    PRIMARY KEY(attempt,question,turn));
CREATE TABLE IF NOT EXISTS grading_lease(attempt TEXT PRIMARY KEY REFERENCES assessment_attempt,nonce TEXT,expires INTEGER);
CREATE TABLE IF NOT EXISTS code_submission(id TEXT PRIMARY KEY,attempt TEXT REFERENCES assessment_attempt,question TEXT REFERENCES question_version,source TEXT,UNIQUE(attempt,question));
CREATE TABLE IF NOT EXISTS execution_run(id TEXT PRIMARY KEY,submission TEXT REFERENCES code_submission,engine TEXT,at INTEGER);
CREATE TABLE IF NOT EXISTS coaching(attempt TEXT PRIMARY KEY REFERENCES assessment_attempt,model TEXT,at INTEGER,result TEXT);
CREATE TABLE IF NOT EXISTS test_case_result(run TEXT REFERENCES execution_run,position INTEGER,hidden INTEGER,status TEXT,output_hash TEXT,PRIMARY KEY(run,position));
CREATE TABLE IF NOT EXISTS resume(id TEXT PRIMARY KEY,application TEXT REFERENCES application,object_key TEXT UNIQUE,checksum TEXT,format TEXT,consent TEXT,created INTEGER,expires INTEGER,status TEXT,generation INTEGER DEFAULT 1,facts TEXT,warnings TEXT,UNIQUE(application,checksum));
CREATE TABLE IF NOT EXISTS evaluation(id TEXT PRIMARY KEY,application TEXT REFERENCES application,version TEXT REFERENCES job_version,scope TEXT,provider TEXT,model TEXT,prompt TEXT,fingerprint TEXT,created INTEGER,result TEXT,expires INTEGER,correlation TEXT);
CREATE TABLE IF NOT EXISTS evaluation_event(id INTEGER PRIMARY KEY,evaluation TEXT REFERENCES evaluation ON DELETE CASCADE,actor TEXT REFERENCES account,at INTEGER,criterion TEXT,action TEXT,original INTEGER,revised INTEGER,reason TEXT);
CREATE TABLE IF NOT EXISTS evaluation_permission(application TEXT PRIMARY KEY REFERENCES application,actor TEXT REFERENCES account,at INTEGER);
CREATE TABLE IF NOT EXISTS provider_call(id TEXT PRIMARY KEY,org TEXT REFERENCES organization,at INTEGER,status TEXT,latency_ms INTEGER,input_tokens INTEGER,output_tokens INTEGER,cost_usd TEXT);
CREATE TABLE IF NOT EXISTS correction(id TEXT PRIMARY KEY,resume TEXT REFERENCES resume ON DELETE CASCADE,generation INTEGER,actor TEXT REFERENCES account,field TEXT,value TEXT,reason TEXT,at INTEGER);
CREATE TABLE IF NOT EXISTS processing_event(id INTEGER PRIMARY KEY,resume TEXT REFERENCES resume ON DELETE CASCADE,generation INTEGER,status TEXT,at INTEGER);
"""


FROZEN = (
    "question",
    "question_version",
    "assessment_version",
    "assessment_question",
    "assessment_template",
    "job_version",
)


def initialize():
    with db(True) as c:
        if os.getenv("DATABASE_URL"):
            from .postgres import prepare

            prepare(c, SCHEMA, FROZEN)
            seed(c)
            return
        c.executescript(SCHEMA)
        c.execute("BEGIN IMMEDIATE")
        if "engine" not in {
            row[1] for row in c.execute("PRAGMA table_info(test_case_result)")
        }:
            c.execute("ALTER TABLE test_case_result ADD COLUMN engine TEXT")
            c.execute(
                "UPDATE test_case_result SET engine=(SELECT engine FROM execution_run WHERE execution_run.id=test_case_result.run)"
            )
        for table in FROZEN:
            for op in ("UPDATE", "DELETE"):
                c.execute(
                    f"CREATE TRIGGER IF NOT EXISTS freeze_{table}_{op} BEFORE {op} ON {table} BEGIN SELECT RAISE(ABORT,'immutable version'); END"
                )
        for table in ("evaluation", "evaluation_event"):
            c.execute(
                f"CREATE TRIGGER IF NOT EXISTS immutable_{table} BEFORE UPDATE ON {table} BEGIN SELECT RAISE(ABORT,'immutable review record'); END"
            )
        seed(c)
        c.execute("""CREATE TRIGGER IF NOT EXISTS lock_members BEFORE INSERT ON assessment_question
          WHEN EXISTS(SELECT 1 FROM assessment_version WHERE id=NEW.version)
          BEGIN SELECT RAISE(ABORT,'published membership'); END""")


def seed(c):
    # A manifest digest fixes membership, ordering and item bodies on publication.
    for kind in ("aptitude", "coding"):
        for path in sorted((ROOT / "data" / kind).glob("*.json")):
            for level, items in json.loads(path.read_text(encoding="utf8")).items():
                template = f"{path.stem}-{level}-{kind}"
                bodies = [
                    json.dumps(i, sort_keys=True, ensure_ascii=False) for i in items
                ]
                version = digest(json.dumps([template, bodies, 30]))
                if c.execute(
                    "SELECT 1 FROM assessment_version WHERE id=?", (version,)
                ).fetchone():
                    continue
                c.execute(
                    "INSERT INTO assessment_template VALUES(?,?,?,?) ON CONFLICT DO NOTHING",
                    (template, path.stem, level, kind),
                )
                # Membership may only be inserted before the parent version exists.
                if not os.getenv("DATABASE_URL"):
                    c.execute("PRAGMA defer_foreign_keys=ON")
                for index, body in enumerate(bodies):
                    qid = f"{template}-{index}"
                    vid = digest(qid + body)
                    c.execute(
                        "INSERT INTO question VALUES(?) ON CONFLICT DO NOTHING", (qid,)
                    )
                    c.execute(
                        "INSERT INTO question_version VALUES(?,?,?) ON CONFLICT DO NOTHING",
                        (vid, qid, body),
                    )
                    c.execute(
                        "INSERT INTO assessment_question VALUES(?,?,?)",
                        (version, index, vid),
                    )
                c.execute(
                    "INSERT INTO assessment_version VALUES(?,?,30,?)",
                    (version, template, now()),
                )
