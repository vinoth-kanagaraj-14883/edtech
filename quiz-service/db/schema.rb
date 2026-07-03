ActiveRecord::Schema[7.1].define(version: 3) do
  create_table 'quizzes', force: :cascade do |t|
    t.string 'course_id', null: false
    t.string 'title', null: false
    t.text 'description'
    t.integer 'time_limit_minutes'
    t.decimal 'passing_score', precision: 5, scale: 2, default: 0.0, null: false
    t.boolean 'is_published', default: false, null: false
    t.datetime 'created_at', null: false
    t.datetime 'updated_at', null: false
    t.index ['course_id'], name: 'index_quizzes_on_course_id'
    t.index ['is_published'], name: 'index_quizzes_on_is_published'
  end

  create_table 'questions', force: :cascade do |t|
    t.bigint 'quiz_id', null: false
    t.text 'text', null: false
    t.string 'question_type', null: false
    t.json 'options'
    t.text 'correct_answer', null: false
    t.integer 'points', default: 1, null: false
    t.integer 'order_index', default: 0, null: false
    t.datetime 'created_at', null: false
    t.datetime 'updated_at', null: false
    t.index ['quiz_id', 'order_index'], name: 'index_questions_on_quiz_id_and_order_index'
    t.index ['quiz_id'], name: 'index_questions_on_quiz_id'
  end

  create_table 'submissions', force: :cascade do |t|
    t.bigint 'quiz_id', null: false
    t.string 'user_id', null: false
    t.json 'answers', null: false
    t.decimal 'score', precision: 5, scale: 2, default: 0.0, null: false
    t.boolean 'passed', default: false, null: false
    t.datetime 'started_at', null: false
    t.datetime 'completed_at', null: false
    t.datetime 'created_at', null: false
    t.datetime 'updated_at', null: false
    t.index ['quiz_id'], name: 'index_submissions_on_quiz_id'
    t.index ['user_id', 'completed_at'], name: 'index_submissions_on_user_id_and_completed_at'
    t.index ['user_id'], name: 'index_submissions_on_user_id'
  end

  add_foreign_key 'questions', 'quizzes'
  add_foreign_key 'submissions', 'quizzes'
end
