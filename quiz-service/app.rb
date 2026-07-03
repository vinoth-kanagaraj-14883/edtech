require 'bundler/setup'
require 'json'
require 'logger'
require 'time'
require 'sinatra/base'
require 'sinatra/json'
require 'sinatra/activerecord'
require 'rack/cors'
require 'prometheus/client'
require 'prometheus/client/formats/text'
require 'opentelemetry/sdk'
require 'opentelemetry/exporter/otlp'
require 'opentelemetry/instrumentation/sinatra'
require 'opentelemetry/instrumentation/active_record'

require_relative 'models/quiz'
require_relative 'models/question'
require_relative 'models/submission'

module QuizService
  SERVICE_NAME = 'quiz-service'.freeze

  APP_LOGGER = Logger.new($stdout)
  APP_LOGGER.formatter = proc do |_severity, _datetime, _progname, msg|
    "#{msg}
"
  end

  PROMETHEUS = Prometheus::Client.registry
  HTTP_REQUESTS_TOTAL = PROMETHEUS.counter(
    :quiz_service_http_requests_total,
    docstring: 'Total number of HTTP requests received by the quiz service',
    labels: %i[method route status]
  )
  HTTP_REQUEST_DURATION = PROMETHEUS.histogram(
    :quiz_service_http_request_duration_seconds,
    docstring: 'HTTP request duration in seconds for the quiz service',
    labels: %i[method route status],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
  )

  OpenTelemetry::SDK.configure do |config|
    config.service_name = SERVICE_NAME
    config.add_span_processor(
      OpenTelemetry::SDK::Trace::Export::BatchSpanProcessor.new(
        OpenTelemetry::Exporter::OTLP::Exporter.new(
          endpoint: ENV.fetch('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://otel-collector:4317')
        )
      )
    )
    config.use 'OpenTelemetry::Instrumentation::Sinatra'
    config.use 'OpenTelemetry::Instrumentation::ActiveRecord'
  end

  class App < Sinatra::Base
    register Sinatra::ActiveRecordExtension
    helpers Sinatra::JSON

    set :bind, '0.0.0.0'
    set :port, ENV.fetch('PORT', 8004)
    set :show_exceptions, false
    set :logging, false
    set :server, :puma
    set :database_file, File.expand_path('config/database.yml', __dir__)

    use Rack::Cors do
      allow do
        origins '*'
        resource '*',
                 headers: :any,
                 methods: %i[get post put patch delete options head],
                 expose: ['traceparent']
      end
    end

    before do
      env['quiz_service.request_started_at'] = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      content_type :json unless request.path_info == '/metrics'
    end

    after do
      route = matched_route
      status_code = response.status.to_s
      method = request.request_method
      duration = Process.clock_gettime(Process::CLOCK_MONOTONIC) - env.fetch('quiz_service.request_started_at')

      HTTP_REQUESTS_TOTAL.increment(labels: { method: method, route: route, status: status_code })
      HTTP_REQUEST_DURATION.observe(duration, labels: { method: method, route: route, status: status_code })

      log_event(
        level: 'info',
        message: 'request completed',
        method: method,
        path: request.path,
        route: route,
        status: response.status,
        duration_ms: (duration * 1000).round(2)
      )
    end

    error ActiveRecord::RecordNotFound do
      halt_json 404, error: 'resource_not_found', message: env['sinatra.error'].message
    end

    error ActiveRecord::RecordInvalid do
      record = env['sinatra.error'].record
      halt_json 422, error: 'validation_failed', message: record.errors.full_messages.join(', ')
    end

    error JSON::ParserError do
      halt_json 400, error: 'invalid_json', message: env['sinatra.error'].message
    end

    error KeyError do
      halt_json 422, error: 'validation_failed', message: env['sinatra.error'].message
    end

    error do
      exception = env['sinatra.error']
      log_event(level: 'error', message: exception.message, backtrace: exception.backtrace&.first(10))
      halt_json 500, error: 'internal_server_error', message: 'An unexpected error occurred'
    end

    options '*' do
      204
    end

    get '/health' do
      json status: 'ok', service: SERVICE_NAME, timestamp: Time.now.utc.iso8601
    end

    get '/ready' do
      ActiveRecord::Base.connection.execute('SELECT 1')
      json status: 'ready', service: SERVICE_NAME
    rescue StandardError => e
      status 503
      json status: 'not_ready', service: SERVICE_NAME, error: e.message
    end

    get '/metrics' do
      content_type 'text/plain'
      Prometheus::Client::Formats::Text.marshal(PROMETHEUS)
    end

    get '/quizzes' do
      quizzes = Quiz.order(created_at: :desc)
      quizzes = quizzes.where(course_id: params[:courseId]) if params[:courseId]&.strip&.length&.positive?

      json quizzes: quizzes.map { |quiz| serialize_quiz(quiz) }
    end

    post '/quizzes' do
      payload = parsed_request_body
      quiz = Quiz.create!(quiz_attributes(payload))
      status 201
      json quiz: serialize_quiz(quiz)
    end

    get '/quizzes/:id' do
      quiz = Quiz.includes(:questions).find(params[:id])
      json quiz: serialize_quiz(quiz, include_questions: true)
    end

    put '/quizzes/:id' do
      quiz = Quiz.find(params[:id])
      quiz.update!(quiz_attributes(parsed_request_body))
      json quiz: serialize_quiz(quiz.reload, include_questions: true)
    end

    delete '/quizzes/:id' do
      quiz = Quiz.find(params[:id])
      quiz.destroy
      status 204
      body nil
    end

    get '/quizzes/:id/questions' do
      quiz = Quiz.find(params[:id])
      json questions: quiz.questions.order(:order_index, :id).map { |question| serialize_question(question) }
    end

    post '/quizzes/:id/questions' do
      quiz = Quiz.find(params[:id])
      question = quiz.questions.create!(question_attributes(parsed_request_body))
      status 201
      json question: serialize_question(question)
    end

    post '/quizzes/:id/submit' do
      quiz = Quiz.includes(:questions).find(params[:id])
      payload = parsed_request_body
      answers = normalize_answers(payload.fetch('answers'))
      score_result = calculate_score(quiz, answers)

      submission = quiz.submissions.create!(
        user_id: fetch_value(payload, 'user_id', 'userId').to_s,
        answers: answers,
        score: score_result[:score],
        passed: score_result[:passed],
        started_at: parse_time(optional_value(payload, 'started_at', 'startedAt')) || Time.now.utc,
        completed_at: Time.now.utc
      )

      status 201
      json(
        submission: serialize_submission(submission),
        result: {
          earned_points: score_result[:earned_points],
          total_points: score_result[:total_points],
          score: score_result[:score],
          passed: score_result[:passed]
        }
      )
    end

    get '/submissions/:id' do
      submission = Submission.find(params[:id])
      json submission: serialize_submission(submission)
    end

    get '/users/:user_id/submissions' do
      submissions = Submission.where(user_id: params[:user_id]).order(completed_at: :desc, created_at: :desc)
      json submissions: submissions.map { |submission| serialize_submission(submission) }
    end

    private

    def parsed_request_body
      request.body.rewind
      raw_body = request.body.read
      return {} if raw_body.nil? || raw_body.strip.empty?

      JSON.parse(raw_body)
    end

    def quiz_attributes(payload)
      {
        course_id: fetch_value(payload, 'course_id', 'courseId'),
        title: fetch_value(payload, 'title'),
        description: optional_value(payload, 'description'),
        time_limit_minutes: optional_value(payload, 'time_limit_minutes', 'timeLimitMinutes'),
        passing_score: optional_value(payload, 'passing_score', 'passingScore') || 0,
        is_published: payload.key?('is_published') ? payload['is_published'] : payload.fetch('isPublished', false)
      }.compact
    end

    def question_attributes(payload)
      {
        text: fetch_value(payload, 'text'),
        question_type: fetch_value(payload, 'question_type', 'questionType'),
        options: optional_value(payload, 'options'),
        correct_answer: normalized_correct_answer(fetch_value(payload, 'correct_answer', 'correctAnswer')),
        points: optional_value(payload, 'points') || 1,
        order_index: optional_value(payload, 'order_index', 'orderIndex') || 0
      }
    end

    def normalize_answers(answers)
      halt_json 422, error: 'validation_failed', message: 'answers must be an object keyed by question id' unless answers.is_a?(Hash)

      answers.each_with_object({}) do |(key, value), normalized|
        normalized[key.to_s] = value
      end
    end

    def fetch_value(payload, *keys)
      value = optional_value(payload, *keys)
      return value unless value.nil?

      raise KeyError, "missing required parameter: #{keys.join(' or ')}"
    end

    def optional_value(payload, *keys)
      keys.each do |key|
        return payload[key] if payload.key?(key)
      end
      nil
    end

    def calculate_score(quiz, answers)
      total_points = quiz.questions.sum(&:points)
      earned_points = quiz.questions.inject(0) do |memo, question|
        submitted_answer = answers[question.id.to_s] || answers[question.id]
        memo + (answer_correct?(question, submitted_answer) ? question.points : 0)
      end
      score = total_points.zero? ? 0.0 : ((earned_points.to_f / total_points) * 100).round(2)

      {
        earned_points: earned_points,
        total_points: total_points,
        score: score,
        passed: score >= quiz.passing_score.to_f
      }
    end

    def answer_correct?(question, submitted_answer)
      expected = parse_stored_answer(question.correct_answer)
      case question.question_type
      when 'multiple_choice'
        compare_values(expected, submitted_answer)
      when 'true_false'
        normalize_scalar(expected) == normalize_scalar(submitted_answer)
      when 'short_answer'
        normalize_scalar(expected) == normalize_scalar(submitted_answer)
      else
        false
      end
    end

    def compare_values(expected, actual)
      if expected.is_a?(Array) || actual.is_a?(Array)
        Array(expected).map { |item| normalize_scalar(item) }.sort == Array(actual).map { |item| normalize_scalar(item) }.sort
      else
        normalize_scalar(expected) == normalize_scalar(actual)
      end
    end

    def parse_stored_answer(value)
      return value unless value.is_a?(String)
      return value unless value.strip.start_with?('[', '{', '"')

      JSON.parse(value)
    rescue JSON::ParserError
      value
    end

    def normalized_correct_answer(value)
      value.is_a?(Array) || value.is_a?(Hash) ? JSON.generate(value) : value.to_s
    end

    def normalize_scalar(value)
      value.to_s.strip.downcase
    end

    def parse_time(value)
      return if value.nil? || value.to_s.strip.empty?

      Time.parse(value.to_s).utc
    rescue ArgumentError
      nil
    end

    def matched_route
      route = env['sinatra.route']
      route ? route.split(' ', 2).last : request.path_info
    end

    def halt_json(code, payload)
      halt code, JSON.generate(payload)
    end

    def serialize_quiz(quiz, include_questions: false)
      data = {
        id: quiz.id,
        course_id: quiz.course_id,
        title: quiz.title,
        description: quiz.description,
        time_limit_minutes: quiz.time_limit_minutes,
        passing_score: quiz.passing_score,
        is_published: quiz.is_published,
        created_at: quiz.created_at&.utc&.iso8601,
        updated_at: quiz.updated_at&.utc&.iso8601
      }
      data[:questions] = quiz.questions.order(:order_index, :id).map { |question| serialize_question(question) } if include_questions
      data
    end

    def serialize_question(question)
      {
        id: question.id,
        quiz_id: question.quiz_id,
        text: question.text,
        question_type: question.question_type,
        options: question.options,
        correct_answer: question.correct_answer,
        points: question.points,
        order_index: question.order_index,
        created_at: question.created_at&.utc&.iso8601,
        updated_at: question.updated_at&.utc&.iso8601
      }
    end

    def serialize_submission(submission)
      {
        id: submission.id,
        quiz_id: submission.quiz_id,
        user_id: submission.user_id,
        answers: submission.answers,
        score: submission.score,
        passed: submission.passed,
        started_at: submission.started_at&.utc&.iso8601,
        completed_at: submission.completed_at&.utc&.iso8601,
        created_at: submission.created_at&.utc&.iso8601,
        updated_at: submission.updated_at&.utc&.iso8601
      }
    end

    def log_event(level:, message:, **fields)
      span_context = OpenTelemetry::Trace.current_span.context
      payload = {
        timestamp: Time.now.utc.iso8601(6),
        level: level.upcase,
        service: SERVICE_NAME,
        trace_id: span_context.valid? ? span_context.hex_trace_id : nil,
        span_id: span_context.valid? ? span_context.hex_span_id : nil,
        message: message
      }.merge(fields)

      APP_LOGGER.public_send(level, payload.to_json)
    end
  end
end
