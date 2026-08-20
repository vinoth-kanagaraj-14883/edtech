FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    VENV_PATH=/opt/venv

# NOTE: no apt-get here on purpose. This service talks to Postgres through
# asyncpg only (there is no psycopg2 dependency at all), and asyncpg ships
# manylinux wheels for cp311 — so neither a compiler nor libpq-dev is required.
# Dropping this removes a build-time dependency on the Debian mirrors, which
# fails behind a corporate proxy.
RUN python -m venv ${VENV_PATH}
ENV PATH="${VENV_PATH}/bin:${PATH}"

WORKDIR /app
COPY requirements.txt ./
# --only-binary=:all: fails loudly if a dependency ever stops shipping a wheel,
# rather than falling back to a compile that cannot succeed here.
RUN pip install --upgrade pip wheel \
    && pip install "setuptools<81" \
    && pip install --only-binary=:all: -r requirements.txt

FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    VENV_PATH=/opt/venv \
    PATH="/opt/venv/bin:${PATH}"

# No libpq5 needed at runtime — asyncpg speaks the Postgres wire protocol
# directly and links nothing from the system. groupadd/useradd already exist in
# python:3.11-slim.
RUN groupadd --system app \
    && useradd --system --gid app --create-home --home-dir /home/app app

WORKDIR /app
COPY --from=builder /opt/venv /opt/venv
COPY . .
RUN chown -R app:app /app /home/app

COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh && chown app:app /entrypoint.sh

USER app
EXPOSE 8009

CMD ["/entrypoint.sh"]
