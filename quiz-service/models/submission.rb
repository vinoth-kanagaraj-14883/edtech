class Submission < ActiveRecord::Base
  belongs_to :quiz, inverse_of: :submissions

  validates :user_id, presence: true
  validates :score, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 }
  validates :passed, inclusion: { in: [true, false] }
  validates :started_at, presence: true
  validates :completed_at, presence: true
end
