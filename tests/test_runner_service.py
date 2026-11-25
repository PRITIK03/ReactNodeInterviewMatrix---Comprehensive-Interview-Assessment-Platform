from fastapi.testclient import TestClient
from runner.service import app as runner


def test_separate_runner_service(monkeypatch):
    import secrets

    token = secrets.token_urlsafe(32)
    monkeypatch.setenv("MATRIX_RUNNER_TOKEN", token)
    with TestClient(runner) as client:
        body = {"source": "print(int(input())+1)", "stdin": "6"}
        assert client.post("/case", json=body).status_code == 403
        answer = client.post("/case", json=body, headers={"X-Runner-Token": token})
        assert answer.status_code == 200
        assert (
            answer.json()["status"] == "finished"
            and answer.json()["stdout"].strip() == "7"
        )
        assert (
            client.post(
                "/case",
                json={**body, "source": "x" * 16001},
                headers={"X-Runner-Token": token},
            ).status_code
            == 422
        )
