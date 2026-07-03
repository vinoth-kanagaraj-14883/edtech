class Quiz < ActiveRecord::Base
  has_many :questions, -> { order(:order_index, :id) }, dependent: :destroy, inverse_of: :quiz
  has_many :submissions, dependent: :destroy, inverse_of: :quiz

  validates :course_id, presence: true
  validates :title, presence: true, length: { maximum: 255 }
  validates :time_limit_minutes, numericality: { greater_than: 0, allow_nil: true }
  validates :passing_score, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 }
  validates :is_published, inclusion: { in: [true, false] }
end
