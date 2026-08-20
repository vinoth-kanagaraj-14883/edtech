FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    VENV_PATH=/opt/venv

# NOTE: no apt-get here on purpose. Every pinned dependency ships a manylinux
# wheel for cp311 — psycopg2-binary statically bundles libpq, and asyncpg /
# uvloop / httptools / pydantic-core all publish prebuilt wheels. Installing
# build-essential + libpq-dev was therefore unnecessary, and it made the image
# depend on reaching the Debian mirrors at build time (which fails behind a
# corporate proxy and added ~200MB plus minutes to every build).
RUN python -m venv ${VENV_PATH}
ENV PATH="${VENV_PATH}/bin:${PATH}"

WORKDIR /app
COPY requirements.txt ./
# --only-binary=:all: makes the wheel assumption explicit: if a dependency ever
# stops publishing a wheel this fails loudly here instead of silently trying to
# compile and erroring out with a missing-compiler message.
RUN pip install --upgrade pip wheel \
    && pip install "setuptools<81" \
    && pip install --only-binary=:all: -r requirements.txt

FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    VENV_PATH=/opt/venv \
    PATH="/opt/venv/bin:${PATH}"

# libpq5 is not needed at runtime either: psycopg2-binary carries its own copy of
# libpq. groupadd/useradd are already present in python:3.11-slim, so the user can
# be created without installing anything.
RUN groupadd --system app \
    && useradd --system --gid app --create-home --home-dir /home/app app

WORKDIR /app
COPY --from=builder /opt/venv /opt/venv
COPY . .
RUN chown -R app:app /app /home/app

USER app
EXPOSE 8007

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8007"]
