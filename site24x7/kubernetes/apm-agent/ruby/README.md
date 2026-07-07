# Site24x7 APM — Ruby Services (quiz-service)

## Overview

The `quiz-service` runs Ruby with Sinatra. Site24x7 provides a Ruby APM gem that
auto-instruments Sinatra, Rails, Rack, database adapters, and Redis clients.

## Installation

```bash
gem install site24x7
# Or add to Gemfile (see Gemfile.site24x7)
```

## Usage

Add the Site24x7 require as the **very first line** in `config.ru`:

```ruby
require 'site24x7'
Site24x7::APM.init(
  license_key: ENV['SITE24X7_APM_KEY'],
  app_name: ENV.fetch('SITE24X7_SERVICE_NAME', 'edtech-quiz-service')
)
```

The `apm-snippet-quiz-service.rb` file shows the complete integration.

## Files

| File | Purpose |
|------|---------|
| `apm-snippet-quiz-service.rb` | Complete APM init snippet for Sinatra quiz-service |
| `Gemfile.site24x7` | Gemfile additions for Site24x7 APM |

## Auto-Instrumented Libraries

- Sinatra (all routes)
- MySQL2 (database queries)
- Redis (redis-rb client)
- Net::HTTP (outbound calls)
- ActiveRecord (if used)

## Environment Variables (injected via K8s patch)

```yaml
- name: SITE24X7_APM_KEY
  valueFrom:
    secretKeyRef:
      name: site24x7-device-key
      key: device-key
- name: SITE24X7_SERVICE_NAME
  value: "edtech-quiz-service"
```
