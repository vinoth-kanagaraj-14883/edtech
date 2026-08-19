SELECT 'CREATE DATABASE userdb' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'userdb')\gexec
SELECT 'CREATE DATABASE coursedb' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'coursedb')\gexec
SELECT 'CREATE DATABASE paymentdb' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'paymentdb')\gexec
SELECT 'CREATE DATABASE certificationdb' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'certificationdb')\gexec
