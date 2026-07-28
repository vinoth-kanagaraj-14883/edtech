FROM ruby:3.2-alpine AS builder

RUN apk add --no-cache build-base git mariadb-connector-c-dev tzdata

WORKDIR /app

COPY Gemfile Gemfile.lock* ./
RUN bundle config set without 'development test'     && bundle config set deployment 'true'     && bundle install --jobs 4 --retry 3

COPY . .

FROM ruby:3.2-alpine AS runtime

RUN apk add --no-cache mariadb-connector-c tzdata     && addgroup -S app     && adduser -S -G app app

WORKDIR /app

COPY --from=builder /usr/local/bundle /usr/local/bundle
COPY --from=builder /app /app

COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

RUN chown -R app:app /app

ENV APP_ENV=production     RACK_ENV=production     PORT=8004

EXPOSE 8004

USER app

ENTRYPOINT ["/entrypoint.sh"]
