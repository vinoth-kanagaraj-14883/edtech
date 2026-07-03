FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1     PYTHONUNBUFFERED=1     PIP_NO_CACHE_DIR=1     VENV_PATH=/opt/venv

RUN apt-get update     && apt-get install --yes --no-install-recommends build-essential libpq-dev     && rm -rf /var/lib/apt/lists/*

RUN python -m venv ${VENV_PATH}
ENV PATH="${VENV_PATH}/bin:${PATH}"

WORKDIR /app
COPY requirements.txt ./
RUN pip install --upgrade pip setuptools wheel     && pip install -r requirements.txt     && pip install asyncpg==0.29.0

FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1     PYTHONUNBUFFERED=1     VENV_PATH=/opt/venv     PATH="/opt/venv/bin:${PATH}"

RUN apt-get update     && apt-get install --yes --no-install-recommends libpq5     && rm -rf /var/lib/apt/lists/*     && groupadd --system app     && useradd --system --gid app --create-home --home-dir /home/app app

WORKDIR /app
COPY --from=builder /opt/venv /opt/venv
COPY . .
RUN chown -R app:app /app /home/app

USER app
EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
