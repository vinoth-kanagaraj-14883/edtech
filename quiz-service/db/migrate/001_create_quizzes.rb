class CreateQuizzes < ActiveRecord::Migration[7.1]
  def change
    create_table :quizzes do |t|
      t.string :course_id, null: false
      t.string :title, null: false
      t.text :description
      t.integer :time_limit_minutes
      t.decimal :passing_score, precision: 5, scale: 2, null: false, default: 0.0
      t.boolean :is_published, null: false, default: false

      t.timestamps
    end

    add_index :quizzes, :course_id
    add_index :quizzes, :is_published
  end
end
