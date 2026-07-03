class Question < ActiveRecord::Base
  QUESTION_TYPES = %w[multiple_choice true_false short_answer].freeze

  belongs_to :quiz, inverse_of: :questions

  validates :text, presence: true
  validates :question_type, presence: true, inclusion: { in: QUESTION_TYPES }
  validates :correct_answer, presence: true
  validates :points, numericality: { greater_than: 0 }
  validates :order_index, numericality: { greater_than_or_equal_to: 0 }
  validate :options_required_for_multiple_choice

  private

  def options_required_for_multiple_choice
    return unless question_type == 'multiple_choice'
    return if options.is_a?(Array) && options.any?

    errors.add(:options, 'must be a non-empty array for multiple choice questions')
  end
end
