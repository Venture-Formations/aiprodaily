import type { FeedbackModuleWithBlocks, FeedbackBlock } from '@/types/database'

export interface FeedbackModuleSettingsProps {
  module: FeedbackModuleWithBlocks
  publicationId: string
  onUpdate: (updates: Partial<FeedbackModuleWithBlocks>) => Promise<void>
  onUpdateBlock: (blockId: string, updates: Partial<FeedbackBlock>) => Promise<void>
  onReorderBlocks: (blockIds: string[]) => Promise<void>
  onAddBlock?: (blockType: FeedbackBlock['block_type']) => Promise<void>
  onDeleteBlock?: (blockId: string) => Promise<void>
  onDelete: () => Promise<void>
}

export interface ResultsConfig {
  confirmation_message: string
  results_header: string
  first_vote_message: string
  feedback_label: string
  feedback_placeholder: string
  feedback_success_message: string
  continue_button_text: string
  submit_button_text: string
  footer_text: string
}

export const defaultResultsConfig: ResultsConfig = {
  confirmation_message: 'Your response has been recorded.',
  results_header: 'Results',
  first_vote_message: "You're the first to vote!",
  feedback_label: 'Additional feedback',
  feedback_placeholder: 'Elaborate on your answer, or just leave some general feedback...',
  feedback_success_message: 'Thank you for your feedback!',
  continue_button_text: 'Continue',
  submit_button_text: 'Submit Feedback',
  footer_text: 'You can close this window at any time.'
}
