class CreateQuestions < ActiveRecord::Migration[7.1]
  def change
    create_table :questions do |t|
      t.references :quiz, null: false, foreign_key: true
      t.text :text, null: false
      t.string :question_type, null: false
      t.json :options
      t.text :correct_answer, null: false
      t.integer :points, null: false, default: 1
      t.integer :order_index, null: false, default: 0

      t.timestamps
    end

    add_index :questions, [:quiz_id, :order_index]
  end
end
