-- Reference only. Production provisioning is handled by Ansible tasks with vault vars.
CREATE DATABASE user_db;
CREATE DATABASE course_db;
CREATE USER user_service WITH ENCRYPTED PASSWORD 'replace-me';
CREATE USER course_service WITH ENCRYPTED PASSWORD 'replace-me';
GRANT ALL PRIVILEGES ON DATABASE user_db TO user_service;
GRANT ALL PRIVILEGES ON DATABASE course_db TO course_service;
