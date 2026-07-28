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

  # A generic course id bucket for the large generated quiz catalog below.
  # Real course_ids aren't required to exist in course-service for the quiz
  # catalog/browse experience to work -- quizzes are addressable standalone.
  GENERATED_COURSE_ID = '33333333-3333-3333-3333-333333333333'.freeze

  # Topic bank used to generate a large, varied quiz catalog. Each topic
  # yields several quizzes ("Level 1", "Level 2", ...) with procedurally
  # varied questions so students have 100+ real quizzes to browse and
  # instructors have a realistic multi-subject catalog to manage.
  TOPICS = [
    'JavaScript Fundamentals', 'Python Basics', 'Ruby Essentials', 'Java Core Concepts',
    'Go Programming', 'SQL & Databases', 'HTML & CSS', 'React Fundamentals',
    'Data Structures', 'Algorithms', 'Object-Oriented Design', 'Git & Version Control',
    'Linux Command Line', 'Networking Basics', 'Cloud Computing', 'Docker & Containers',
    'Kubernetes Essentials', 'REST API Design', 'Cybersecurity Basics', 'Machine Learning Intro',
    'Data Science with Python', 'Testing & QA', 'Agile & Scrum', 'System Design Basics',
    'TypeScript Essentials', 'Node.js Fundamentals', 'Web Accessibility', 'Mobile Development',
    'DevOps Practices', 'Software Architecture'
  ].freeze

  QUIZZES_PER_TOPIC = 4
  QUESTIONS_PER_QUIZ = 5

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

    generate_catalog!
  end

  # Procedurally builds QUIZZES_PER_TOPIC quizzes for each topic in TOPICS
  # (30 topics x 4 levels = 120 quizzes), each with QUESTIONS_PER_QUIZ varied
  # questions. Deterministic (no randomness) so re-running seeds is a no-op
  # after the first boot.
  def self.generate_catalog!
    TOPICS.each do |topic|
      (1..QUIZZES_PER_TOPIC).each do |level|
        seed_quiz!(
          course_id: GENERATED_COURSE_ID,
          title: "#{topic} - Level #{level}",
          description: "#{level_label(level)} assessment covering key #{topic} concepts.",
          time_limit_minutes: 10 + (level * 5),
          passing_score: 50 + (level * 5),
          questions: build_questions(topic, level)
        )
      end
    end
  end

  def self.level_label(level)
    { 1 => 'Beginner', 2 => 'Intermediate', 3 => 'Advanced', 4 => 'Expert' }.fetch(level, 'Practice')
  end

  def self.build_questions(topic, level)
    (0...QUESTIONS_PER_QUIZ).map do |index|
      case index % 3
      when 0
        {
          text: "In #{topic}, which of the following best describes concept ##{(level * 10) + index + 1}?",
          question_type: 'multiple_choice',
          options: [
            "Correct approach for #{topic}",
            "Common misconception about #{topic}",
            "Unrelated concept",
            "Deprecated technique"
          ],
          correct_answer: "Correct approach for #{topic}",
          points: level,
          order_index: index
        }
      when 1
        {
          text: "True or false: #{topic} concept ##{(level * 10) + index + 1} is considered a best practice.",
          question_type: 'true_false',
          options: %w[True False],
          correct_answer: index.even? ? 'True' : 'False',
          points: level,
          order_index: index
        }
      else
        {
          text: "Briefly, what is the primary benefit of applying #{topic} technique ##{(level * 10) + index + 1}?",
          question_type: 'short_answer',
          options: nil,
          correct_answer: 'improved reliability',
          points: level + 1,
          order_index: index
        }
      end
    end
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
