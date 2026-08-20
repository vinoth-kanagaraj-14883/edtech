FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1     PYTHONUNBUFFERED=1     PIP_NO_CACHE_DIR=1     VENV_PATH=/opt/venv

# NOTE: no apt-get here on purpose. psycopg2-binary bundles libpq, and
# cryptography / bcrypt==4.0.1 / pydantic-core / uvloop all ship manylinux wheels
# for cp311 — so no compiler or libpq-dev is required. Dropping this removes a
# build-time dependency on the Debian mirrors, which fails behind a proxy.
RUN python -m venv ${VENV_PATH}
ENV PATH="${VENV_PATH}/bin:${PATH}"

WORKDIR /app
COPY requirements.txt ./
# --only-binary=:all: fails loudly if a dependency ever stops shipping a wheel.
RUN pip install --upgrade pip wheel     && pip install "setuptools<81"     && pip install --only-binary=:all: -r requirements.txt     && pip install --only-binary=:all: asyncpg==0.29.0

FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1     PYTHONUNBUFFERED=1     VENV_PATH=/opt/venv     PATH="/opt/venv/bin:${PATH}"

# No libpq5 needed at runtime — psycopg2-binary carries its own libpq.
# groupadd/useradd already exist in python:3.11-slim.
RUN groupadd --system app     && useradd --system --gid app --create-home --home-dir /home/app app

WORKDIR /app
COPY --from=builder /opt/venv /opt/venv
COPY . .
RUN chown -R app:app /app /home/app

COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh && chown app:app /entrypoint.sh

USER app
EXPOSE 8001

CMD ["/entrypoint.sh"]
