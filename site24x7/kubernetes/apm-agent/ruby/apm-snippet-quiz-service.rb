# site24x7/kubernetes/apm-agent/ruby/apm-snippet-quiz-service.rb
#
# Site24x7 APM initialization for quiz-service (Ruby/Sinatra).
#
# USAGE:
#   1. Add the site24x7 gem to your Gemfile (see Gemfile.site24x7)
#   2. Run: bundle install
#   3. Add this snippet at the top of config.ru (before requiring Sinatra)
#   4. Set SITE24X7_APM_KEY env var via Kubernetes patch (see patch-examples/)
#
# The K8s patch in patch-examples/quiz-service-patch.yaml injects the
# required environment variables without any code changes.

# frozen_string_literal: true

module Site24x7APM
  # Initialize Site24x7 APM for the quiz-service.
  # Call this method at the top of config.ru, before loading the Sinatra app.
  #
  # @return [Boolean] true if APM was initialized, false if skipped
  def self.init
    apm_key = ENV['SITE24X7_APM_KEY']
    unless apm_key
      puts '[site24x7] SITE24X7_APM_KEY not set — APM disabled'
      return false
    end

    service_name = ENV.fetch('SITE24X7_SERVICE_NAME', 'edtech-quiz-service')
    log_level    = ENV.fetch('SITE24X7_LOG_LEVEL', 'info')
    endpoint     = ENV.fetch('SITE24X7_APM_ENDPOINT', 'https://apmcollector.site24x7.com')

    begin
      require 'site24x7'

      Site24x7::APM.init(
        license_key:   apm_key,
        app_name:      service_name,
        log_level:     log_level,
        collector_host: endpoint,

        # Auto-instrumentation options
        sinatra:    { enabled: true },
        mysql2:     { enabled: true },   # MySQL database queries
        redis:      { enabled: true },   # Redis operations
        net_http:   { enabled: true },   # Outbound HTTP calls
        rack:       { enabled: true },   # Rack middleware tracing
      )

      puts "[site24x7] APM initialized for service=#{service_name}"
      true
    rescue LoadError
      warn '[site24x7] site24x7 gem not installed. Add to Gemfile: gem "site24x7"'
      false
    rescue => e
      warn "[site24x7] APM initialization failed: #{e.message}"
      false
    end
  end
end

# Invoke APM initialization
Site24x7APM.init

# ── config.ru integration example ─────────────────────────────────────────────
#
# # config.ru
# require_relative 'site24x7_apm'  # Must be first — before Sinatra
# Site24x7APM.init
#
# require 'sinatra/base'
# require_relative 'app'
#
# run QuizService
#
# ── Custom transaction tracking ───────────────────────────────────────────────
#
# Inside Sinatra routes:
#
#   post '/quizzes/:id/submit' do
#     Site24x7::APM.transaction('quiz.submit') do
#       result = QuizService.submit(params[:id], request.body.read)
#       Site24x7::APM.add_attribute('quiz.id', params[:id])
#       json result
#     end
#   end
