class CreateSubmissions < ActiveRecord::Migration[7.1]
  def change
    create_table :submissions do |t|
      t.references :quiz, null: false, foreign_key: true
      t.string :user_id, null: false
      t.json :answers, null: false
      t.decimal :score, precision: 5, scale: 2, null: false, default: 0.0
      t.boolean :passed, null: false, default: false
      t.datetime :started_at, null: false
      t.datetime :completed_at, null: false

      t.timestamps
    end

    add_index :submissions, :user_id
    add_index :submissions, [:user_id, :completed_at]
  end
end
