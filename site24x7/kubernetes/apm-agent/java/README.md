# Site24x7 APM — Java Services (course-service)

## Overview

The `course-service` runs Java with Spring Boot. Site24x7 provides a Java APM agent
as a JAR file that attaches to the JVM via the `-javaagent` flag. It auto-instruments
Spring Boot, JDBC, HTTP clients, and more — **zero code changes required**.

## Approach: JVM Agent

The Java agent is attached at JVM startup via:

```bash
java -javaagent:/opt/site24x7/apm-agent.jar \
     -Dsite24x7.apm.agent.key=$SITE24X7_APM_KEY \
     -jar course-service.jar
```

In Kubernetes, this is done by:
1. An **init container** that downloads the agent JAR into a shared emptyDir volume
2. The `JAVA_TOOL_OPTIONS` environment variable pointing to the JAR

## Files

| File | Purpose |
|------|---------|
| `apm-javaagent-download.sh` | Script to download the Site24x7 Java APM agent JAR |
| `jvm-args.env` | JVM options with the `-javaagent` flag |
| `README.md` | This file |

## Kubernetes Integration

The `patch-examples/course-service-patch.yaml` adds:
1. An init container that downloads the JAR to `/opt/site24x7/`
2. An `emptyDir` volume shared between init and app containers
3. `JAVA_TOOL_OPTIONS=-javaagent:/opt/site24x7/apm-agent.jar`
4. `SITE24X7_APM_KEY` from the Kubernetes Secret

## Auto-Instrumented Frameworks

- Spring Boot / Spring MVC (all HTTP endpoints)
- JDBC / JPA / Hibernate (database queries)
- RestTemplate / WebClient (outbound HTTP)
- Kafka / RabbitMQ (if used)
- Redis (Lettuce/Jedis)
- Log4j2 / Logback (error correlation)

## Manual Download (bare-metal / testing)

```bash
chmod +x apm-javaagent-download.sh
./apm-javaagent-download.sh /opt/site24x7
```
