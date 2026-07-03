-- Reference only. Production provisioning is handled by Ansible tasks with vault vars.
CREATE DATABASE content_db;
CREATE DATABASE quiz_db;
CREATE USER 'content_service'@'%' IDENTIFIED BY 'replace-me';
CREATE USER 'quiz_service'@'%' IDENTIFIED BY 'replace-me';
GRANT ALL PRIVILEGES ON content_db.* TO 'content_service'@'%';
GRANT ALL PRIVILEGES ON quiz_db.* TO 'quiz_service'@'%';
FLUSH PRIVILEGES;
