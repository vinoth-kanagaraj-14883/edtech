CREATE DATABASE IF NOT EXISTS contentdb;
CREATE DATABASE IF NOT EXISTS quizdb;

-- Use native password auth so clients are not forced into TLS negotiation
-- (MySQL 8.4's default caching_sha2_password requires a secure transport,
-- which fails against the server's self-signed certificate).
ALTER USER 'edtech'@'%' IDENTIFIED WITH mysql_native_password BY 'edtech_password';

GRANT ALL PRIVILEGES ON contentdb.* TO 'edtech'@'%';
GRANT ALL PRIVILEGES ON quizdb.* TO 'edtech'@'%';
FLUSH PRIVILEGES;
