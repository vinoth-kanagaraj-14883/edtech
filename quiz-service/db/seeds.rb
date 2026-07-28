# Idempotent seed data for the quiz-service. Safe to run on every boot.
# Works both standalone (`ruby db/seeds.rb`) and when loaded from app.rb.
require 'bundler/setup'
require 'active_record'
require 'erb'
require 'yaml'

unless ActiveRecord::Base.connected?
  db_config_path = File.expand_path('config/database.yml', File.dirname(__dir__))
  db_config = YAML.safe_load(ERB.new(File.read(db_config_path)).result, aliases: true)
  env = ENV['RACK_ENV'] || ENV['APP_ENV'] || 'production'
  ActiveRecord::Base.establish_connection(db_config[env] || db_config['production'])
end

require_relative '../models/quiz'
require_relative '../models/question'

module QuizSeeds
  # Stable demo course IDs (shared with content-service / course-service seeds).
  INTRO_COURSE_ID = '11111111-1111-1111-1111-111111111111'.freeze
  WEB_COURSE_ID   = '22222222-2222-2222-2222-222222222222'.freeze

  def self.run!
    seed_quiz!(
      course_id: INTRO_COURSE_ID,
      title: 'Programming Fundamentals Quiz',
      description: 'Check your understanding of core programming concepts.',
      time_limit_minutes: 15,
      passing_score: 60,
      questions: [
        { text: 'Which keyword declares a constant in JavaScript?', question_type: 'multiple_choice',
          options: %w[var let const static], correct_answer: 'const', points: 1, order_index: 0 },
        { text: 'A boolean value can be either true or false.', question_type: 'true_false',
          options: %w[True False], correct_answer: 'True', points: 1, order_index: 1 },
        { text: 'What data structure uses FIFO ordering?', question_type: 'multiple_choice',
          options: ['Stack', 'Queue', 'Tree', 'Graph'], correct_answer: 'Queue', points: 2, order_index: 2 }
      ]
    )

    seed_quiz!(
      course_id: WEB_COURSE_ID,
      title: 'Web Development Basics Quiz',
      description: 'Test your knowledge of HTML, CSS, and HTTP.',
      time_limit_minutes: 10,
      passing_score: 50,
      questions: [
        { text: 'Which HTML tag creates a hyperlink?', question_type: 'multiple_choice',
          options: %w[<link> <a> <href> <nav>], correct_answer: '<a>', points: 1, order_index: 0 },
        { text: 'HTTP status code 404 means "Not Found".', question_type: 'true_false',
          options: %w[True False], correct_answer: 'True', points: 1, order_index: 1 }
      ]
    )
  end

  def self.seed_quiz!(course_id:, title:, description:, time_limit_minutes:, passing_score:, questions:)
    quiz = Quiz.find_or_initialize_by(course_id: course_id, title: title)
    quiz.description = description
    quiz.time_limit_minutes = time_limit_minutes
    quiz.passing_score = passing_score
    quiz.is_published = true
    quiz.save!

    questions.each do |attrs|
      question = quiz.questions.find_or_initialize_by(order_index: attrs[:order_index])
      question.text = attrs[:text]
      question.question_type = attrs[:question_type]
      question.options = attrs[:options]
      question.correct_answer = attrs[:correct_answer]
      question.points = attrs[:points]
      question.save!
    end
  end
end

QuizSeeds.run!
puts "[quiz-service] seed complete: #{Quiz.count} quizzes, #{Question.count} questions"
