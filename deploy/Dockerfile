FROM python:3.12-slim-bookworm AS python
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY deploy/requirements.lock /tmp/dependencies
RUN pip install --no-cache-dir --require-hashes -r /tmp/dependencies && useradd --uid 10001 --create-home matrix && mkdir -p runtime && chown matrix runtime
COPY backend/*.py backend/
COPY backend/utils/*.py backend/utils/
COPY data/aptitude/*.json data/aptitude/
COPY data/coding/*.json data/coding/
USER matrix
FROM python AS api
CMD ["python","-m","uvicorn","backend.main:app","--host","0.0.0.0","--no-access-log"]
FROM python AS worker
USER root
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr-eng tesseract-ocr && rm -rf /var/lib/apt/lists/*
USER matrix
CMD ["celery","-A","backend.documents:celery","worker","--concurrency=1","--loglevel=WARNING"]
FROM python AS runner
COPY scripts/fetch-guest.py scripts/
RUN python scripts/fetch-guest.py
COPY runner/*.py runner/
CMD ["python","-m","uvicorn","runner.service:app","--host","0.0.0.0","--port","8001","--limit-concurrency","8","--no-access-log"]
FROM node:24-bookworm-slim AS web-build
WORKDIR /web
COPY frontend/my-react-app/package*.json ./
RUN npm ci --no-fund
COPY frontend/my-react-app/index.html frontend/my-react-app/vite.config.js ./
COPY frontend/my-react-app/src/ src/
COPY frontend/my-react-app/public/logos/*.png public/logos/
RUN npm run build
FROM nginxinc/nginx-unprivileged:stable-alpine AS web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /web/dist /usr/share/nginx/html
