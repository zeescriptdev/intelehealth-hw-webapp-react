import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AyuAnswerValue, AyuQuestion } from '../../../../../../modules/ayu-library/types/ayu.types';
import type { AyuStepperContainerHandle } from '../../../../../../modules/ayu/components/start-visit/visit-reason/ayu-stepper-container.component';
import { AyuStepperContainer } from '../../../../../../modules/ayu/components/start-visit/visit-reason/ayu-stepper-container.component';

vi.mock('../../../../../../modules/ayu/components/loaders/question-loader.component', () => ({
  QuestionLoader: vi.fn(({ children, question, questionIndex, totalQuestions, isAnswered, onEdit }) => (
    <div data-testid={`question-loader-${questionIndex}`} data-is-answered={isAnswered ? 'true' : 'false'}>
      <div data-testid="question-text">{question}</div>
      <div data-testid="question-index">{questionIndex}</div>
      <div data-testid="total-questions">{totalQuestions}</div>
      {onEdit && (
        <button data-testid={`edit-${questionIndex}`} onClick={onEdit}>edit</button>
      )}
      {children}
    </div>
  )),
}));

vi.mock('../../../../../../modules/ayu/components/start-visit/visit-reason/ayu-renderer.component', () => ({
  AyuRenderer: vi.fn(({ question, value, onChange }) => (
    <div data-testid={`renderer-${question.linkId}`}>
      <div>{question.text}</div>
      <input
        data-testid={`input-${question.linkId}`}
        value={value || ''}
        onChange={e => onChange?.(e.target.value)}
      />
    </div>
  )),
}));

vi.mock('../../../../../../modules/ayu/components/start-visit/visit-reason/ayu-nested-renderer.component', () => ({
  AyuNestedRenderer: vi.fn(({ items, answers, setAnswer, selectable }) => (
    <div data-testid="nested-renderer" data-selectable={String(!!selectable)}>
      {items?.map((item: AyuQuestion) => (
        <div key={item.linkId} data-testid={`nested-item-${item.linkId}`}>
          <input
            data-testid={`nested-input-${item.linkId}`}
            value={answers[item.linkId] || ''}
            onChange={e => setAnswer(item, e.target.value)}
          />
        </div>
      ))}
    </div>
  )),
}));

vi.mock('../../../../../../modules/ayu/components/common/ayu-button.component', () => ({
  default: vi.fn(({ children, onClick, disabled, className, rightIcon }) => (
    <button
      data-testid={`button-${children.toLowerCase()}`}
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {children}
      {rightIcon && <span data-testid={`right-icon-${children.toLowerCase()}`}>{rightIcon}</span>}
    </button>
  )),
}));

vi.mock('../../../../../../modules/ayu/hooks/useFHIRStepper.hook', () => ({
  useFHIRStepper: vi.fn(),
}));

vi.mock('../../../../../../modules/ayu-library/logic/decision-matrix', () => ({
  resolveAyuComponent: vi.fn(),
  isStrictAssociatedSymptoms: vi.fn(),
  isPhysicalExamOptionsQuestion: vi.fn(() => false),
  ASSOCIATED_SYMPTOMS_COMPONENT: 'associatedSymptoms',
}));

vi.mock('../../../../../../modules/ayu/pages/decision-matrix', () => ({
  resolveAyuComponent: vi.fn(),
  isStrictAssociatedSymptoms: vi.fn(),
  ASSOCIATED_SYMPTOMS_COMPONENT: 'associatedSymptoms',
  PHYSICAL_EXAM_OPTIONS_COMPONENT: 'physicalExamOptions',
}));

vi.mock('../../../../../../services/toast', () => ({
  showToast: vi.fn(),
}));

vi.mock('../../../../../../modules/ayu/assets/yes.svg', () => ({
  default: 'yes-icon.svg',
}));

vi.mock('../../../../../../modules/ayu/utils/visit-summary.util', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../../../modules/ayu/utils/visit-summary.util')>();
  return {
    ...actual,
    buildVisitSummary: vi.fn(actual.buildVisitSummary),
  };
});

import {
  isStrictAssociatedSymptoms as isStrictAssociatedSymptomsLogic,
  resolveAyuComponent as resolveAyuComponentLogic,
} from '../../../../../../modules/ayu-library/logic/decision-matrix';
import { useFHIRStepper } from '../../../../../../modules/ayu/hooks/useFHIRStepper.hook';
import { isStrictAssociatedSymptoms, resolveAyuComponent } from '../../../../../../modules/ayu/pages/decision-matrix';
import { buildVisitSummary } from '../../../../../../modules/ayu/utils/visit-summary.util';
import { showToast } from '../../../../../../services/toast';
const _mockUseFHIRStepper = vi.mocked(useFHIRStepper);

const mockValidateAllQuestions = vi.fn(() => true);
const mockUseFHIRStepper = {
  mockReturnValue: (val: Record<string, unknown>) => {
    _mockUseFHIRStepper.mockReturnValue({
      validateAllQuestions: mockValidateAllQuestions,
      isCameraAnswerMissingImages: () => false,
      ...val,
    } as unknown as ReturnType<typeof useFHIRStepper>);
  },
};
const mockResolveAyuComponent = vi.mocked(resolveAyuComponent);
const mockIsStrictAssociatedSymptoms = vi.mocked(isStrictAssociatedSymptoms);

const mockResolveAyuComponentLogic = vi.mocked(resolveAyuComponentLogic);
const mockIsStrictAssociatedSymptomsLogic = vi.mocked(isStrictAssociatedSymptomsLogic);
const mockShowToast = vi.mocked(showToast);
const mockBuildVisitSummary = vi.mocked(buildVisitSummary);

describe('AyuStepperContainer', () => {
  const mockOnComplete = vi.fn();
  const mockOnProgressUpdate = vi.fn();
  const mockGoNext = vi.fn();
  const mockSetAnswer = vi.fn();
  const mockClearAnswers = vi.fn();

  const createMockQuestionnaire = (items: AyuQuestion[]): { item: AyuQuestion[] } => ({
    item: items,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateAllQuestions.mockReturnValue(true);

    Element.prototype.scrollIntoView = vi.fn();

    mockResolveAyuComponent.mockReturnValue('selectableOptionGroup');
    mockIsStrictAssociatedSymptoms.mockReturnValue(false);
    mockResolveAyuComponentLogic.mockReturnValue('selectableOptionGroup');
    mockIsStrictAssociatedSymptomsLogic.mockReturnValue(false);
  });

  describe('Basic Rendering', () => {
    it('should return null when currentQuestion is null', () => {
      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: undefined,
        currentIndex: 0,
        total: 0,
        answers: {},
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [],
        isLast: false,
      });

      const questionnaire = createMockQuestionnaire([]);
      const { container } = render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render current question', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'First Question',
        type: 'string',
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: {},
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByTestId('question-loader-0')).toBeInTheDocument();
      expect(screen.getByTestId('renderer-q1')).toBeInTheDocument();
    });

    it('should render multiple questions up to current index', () => {
      const questions: AyuQuestion[] = [
        { linkId: 'q1', text: 'Question 1', type: 'string' },
        { linkId: 'q2', text: 'Question 2', type: 'string' },
        { linkId: 'q3', text: 'Question 3', type: 'string' },
      ];

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: questions[1],
        currentIndex: 1,
        total: 3,
        answers: {},
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: questions,
        isLast: false,
      });

      const questionnaire = createMockQuestionnaire(questions);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByTestId('question-loader-0')).toBeInTheDocument();
      expect(screen.getByTestId('question-loader-1')).toBeInTheDocument();
      expect(screen.queryByTestId('question-loader-2')).not.toBeInTheDocument();
    });
  });

  describe('Progress Updates', () => {
    it('should call onProgressUpdate on mount', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Question 1',
        type: 'string',
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 2,
        answers: {},
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question, { linkId: 'q2', text: 'Q2', type: 'string' }],
        isLast: false,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(mockOnProgressUpdate).toHaveBeenCalledWith(2, 0);
    });

    it('should update progress when currentIndex changes', () => {
      const questions: AyuQuestion[] = [
        { linkId: 'q1', text: 'Question 1', type: 'string' },
        { linkId: 'q2', text: 'Question 2', type: 'string' },
      ];

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: questions[0],
        currentIndex: 0,
        total: 2,
        answers: {},
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: questions,
        isLast: false,
      });

      const questionnaire = createMockQuestionnaire(questions);
      const { rerender } = render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(mockOnProgressUpdate).toHaveBeenCalledWith(2, 0);

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: questions[1],
        currentIndex: 1,
        total: 2,
        answers: {},
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: questions,
        isLast: true,
      });

      rerender(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(mockOnProgressUpdate).toHaveBeenCalledWith(2, 1);
    });

    it('should report 100% when the section completes (last question auto-advance)', () => {
      const questions: AyuQuestion[] = [
        { linkId: 'q1', text: 'Question 1', type: 'choice' },
        { linkId: 'q2', text: 'Question 2', type: 'choice' },
      ];

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: questions[1],
        currentIndex: 1,
        total: 2,
        answers: { q1: 'a', q2: 'b' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: questions,
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire(questions);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          skipSummary
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

     const hookOnComplete = _mockUseFHIRStepper.mock.calls.at(-1)?.[0]
        ?.onComplete;
      mockOnProgressUpdate.mockClear();
      hookOnComplete?.({ q1: 'a', q2: 'b' });

      expect(mockOnProgressUpdate).toHaveBeenCalledWith(2, 2);
      expect(mockOnComplete).toHaveBeenCalledWith({ q1: 'a', q2: 'b' });
    });

    it('should not report progress on completion when the questionnaire has no items', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Question 1',
        type: 'choice',
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 0,
        answers: {},
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      /* Questionnaire without an `item` array exercises the `?.item || []`
         fallback, so completeTotal is 0 and progress is left untouched. */
      render(
        <AyuStepperContainer
          questionnaire={{} as any}
          skipSummary
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      const hookOnComplete = _mockUseFHIRStepper.mock.calls.at(-1)?.[0]
        ?.onComplete;
      mockOnProgressUpdate.mockClear();
      hookOnComplete?.({ q1: 'a' });

      expect(mockOnProgressUpdate).not.toHaveBeenCalled();
      expect(mockOnComplete).toHaveBeenCalledWith({ q1: 'a' });
    });
  });

  describe('Scroll Behavior', () => {
    it('should scroll to current question when index changes', async () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Question 1',
        type: 'string',
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: {},
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      await waitFor(() => {
        expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
          behavior: 'smooth',
          block: 'start',
        });
      });
    });
  });

  describe('Submit Button', () => {
    it('should show submit button for string type with answer', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Question 1',
        type: 'string',
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: 'test answer' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByTestId('button-submit')).toBeInTheDocument();
    });

    it('should show submit button for quantity type with answer', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Quantity Question',
        type: 'quantity',
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: 5 },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByTestId('button-submit')).toBeInTheDocument();
    });

    it('should call goNext when submit is clicked on non-last question', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Question 1',
        type: 'string',
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 2,
        answers: { q1: 'answer' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question, { linkId: 'q2', text: 'Q2', type: 'string' }],
        isLast: false,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      const submitButton = screen.getByTestId('button-submit');
      fireEvent.click(submitButton);

      expect(mockGoNext).toHaveBeenCalled();
      expect(mockOnComplete).not.toHaveBeenCalled();
    });

    it('should call goNext when submit is clicked on last question', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Last Question',
        type: 'string',
      };

      const answers = { q1: 'final answer' };
      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: answers,
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      const submitButton = screen.getByTestId('button-submit');
      fireEvent.click(submitButton);

      expect(mockGoNext).toHaveBeenCalled();
      expect(mockOnProgressUpdate).toHaveBeenCalledWith(1, 1);
    });

    it('should show skip button for choice question with nested empty string', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Parent Question',
        type: 'choice',
        item: [
          {
            linkId: 'q1.1',
            text: 'Nested String',
            type: 'string',
            enableWhen: [
              {
                question: 'q1',
                operator: '=',
                answerString: 'yes',
              },
            ],
          },
        ],
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: 'yes' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByTestId('button-submit')).toBeInTheDocument();
      expect(screen.getByTestId('button-skip')).toBeInTheDocument();
    });

    it('should show toast when submit clicked with invalid quantity (duration) with incomplete dropdowns', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Duration Question',
        type: 'quantity',
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: {
          q1: {
            dropdownValues: {
              number: 5,
              days: undefined,
            },
          },
        },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      const submitButton = screen.getByTestId('button-submit');
      fireEvent.click(submitButton);

      expect(mockShowToast).toHaveBeenCalledWith('Please enter a value', undefined, 'warning');
      expect(mockGoNext).not.toHaveBeenCalled();
    });

    it('should call goNext for valid quantity (duration) with complete dropdowns', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Duration Question',
        type: 'quantity',
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: {
          q1: {
            dropdownValues: {
              number: 5,
              days: 'days',
            },
          },
        },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      const submitButton = screen.getByTestId('button-submit');
      fireEvent.click(submitButton);

      expect(mockShowToast).not.toHaveBeenCalled();
      expect(mockGoNext).toHaveBeenCalled();
    });

    it('should show submit button for choice type with duration in nested child', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Choice Question',
        type: 'choice',
        item: [
          {
            linkId: 'q1.1',
            text: 'Duration',
            type: 'string',
          },
        ],
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: {
          'q1.1': {
            dropdownValues: {
              number: 3,
              days: 'weeks',
            },
          },
        },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByTestId('button-submit')).toBeInTheDocument();
    });

    it('should show submit button for associated symptoms (Yes/No grid) even when repeats is false', () => {
      const question: AyuQuestion = {
        linkId: 'as1',
        text: 'Associated symptoms',
        type: 'choice',
        answerOption: [
          { valueCoding: { code: 'fever', display: 'Fever' } },
          { valueCoding: { code: 'cough', display: 'Cough' } },
        ],
      };

      mockResolveAyuComponent.mockReturnValue('associatedSymptoms');
      mockIsStrictAssociatedSymptoms.mockReturnValue(true);

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { as1: ['fever'] },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByTestId('button-submit')).toBeInTheDocument();
    });
  });

  describe('Skip Button', () => {
    it('should show skip button for non-required questions', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Optional Question',
        type: 'string',
        required: false,
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: {},
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByTestId('button-skip')).toBeInTheDocument();
    });

    it('should not show skip button for required questions', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Required Question',
        type: 'string',
        required: true,
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: 'answer' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.queryByTestId('button-skip')).not.toBeInTheDocument();
    });

    it('should call goNext when skip is clicked on non-last question', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Question 1',
        type: 'string',
        required: false,
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 2,
        answers: {},
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question, { linkId: 'q2', text: 'Q2', type: 'string' }],
        isLast: false,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      const skipButton = screen.getByTestId('button-skip');
      fireEvent.click(skipButton);

      expect(mockGoNext).toHaveBeenCalled();
    });

    it('should call goNext when skip is clicked on last question', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Last Question',
        type: 'string',
        required: false,
      };

      const answers = {};
      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: answers,
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      const skipButton = screen.getByTestId('button-skip');
      fireEvent.click(skipButton);

      expect(mockGoNext).toHaveBeenCalled();
      expect(mockOnProgressUpdate).toHaveBeenCalledWith(1, 1);
    });

    it('should hide skip button for past questions that have been submitted', () => {
      const questions: AyuQuestion[] = [
        { linkId: 'q1', text: 'Question 1', type: 'string', required: false },
        { linkId: 'q2', text: 'Question 2', type: 'string' },
      ];

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: questions[1],
        currentIndex: 1,
        total: 2,
        answers: { q1: 'answered', q2: 'current' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: questions,
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire(questions);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      const submitButtons = screen.getAllByTestId('button-submit');
      fireEvent.click(submitButtons[0]);

      expect(screen.getByTestId('question-loader-0')).toHaveAttribute('data-is-answered', 'true');

      expect(screen.getAllByTestId('button-skip')).toHaveLength(1);
    });
  });

  describe('Nested Items', () => {
    it('should render nested items when present', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Parent Question',
        type: 'choice',
        item: [
          { linkId: 'q1.1', text: 'Child 1', type: 'string' },
          { linkId: 'q1.2', text: 'Child 2', type: 'string' },
        ],
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: {},
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByTestId('nested-renderer')).toBeInTheDocument();
    });

    it('should not render nested items when not present', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Simple Question',
        type: 'string',
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: {},
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.queryByTestId('nested-renderer')).not.toBeInTheDocument();
    });
  });

  describe('Question Navigation', () => {
    it('should show action buttons for both active and past questions', () => {
      const questions: AyuQuestion[] = [
        { linkId: 'q1', text: 'Question 1', type: 'string' },
        { linkId: 'q2', text: 'Question 2', type: 'string' },
      ];

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: questions[1],
        currentIndex: 1,
        total: 2,
        answers: { q1: 'answer 1', q2: 'answer 2' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: questions,
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire(questions);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByTestId('question-loader-0')).toBeInTheDocument();
      expect(screen.getByTestId('question-loader-1')).toBeInTheDocument();

      const submitButtons = screen.getAllByTestId('button-submit');
      expect(submitButtons).toHaveLength(2);
    });

    it('should not call goNext when re-submitting a past question', () => {
      const questions: AyuQuestion[] = [
        { linkId: 'q1', text: 'Question 1', type: 'string' },
        { linkId: 'q2', text: 'Question 2', type: 'string' },
      ];

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: questions[1],
        currentIndex: 1,
        total: 2,
        answers: { q1: 'answer 1', q2: 'answer 2' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: questions,
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire(questions);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      const submitButtons = screen.getAllByTestId('button-submit');
      fireEvent.click(submitButtons[0]);

      expect(mockGoNext).not.toHaveBeenCalled();
    });
  });

  describe('Answer Management', () => {
    it('should pass setAnswer to AyuRenderer', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Question 1',
        type: 'string',
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: {},
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      const input = screen.getByTestId('input-q1');
      fireEvent.change(input, { target: { value: 'new answer' } });

      expect(mockSetAnswer).toHaveBeenCalledWith(question, 'new answer');
    });

    it('should pass setAnswer to AyuNestedRenderer', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Parent Question',
        type: 'choice',
        item: [{ linkId: 'q1.1', text: 'Child', type: 'string' }],
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: {},
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      const input = screen.getByTestId('nested-input-q1.1');
      fireEvent.change(input, { target: { value: 'nested answer' } });

      expect(mockSetAnswer).toHaveBeenCalledWith(question.item![0], 'nested answer');
    });
  });

  describe('Edge Cases', () => {
    it('should handle questionnaire with no items', () => {
      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: undefined,
        currentIndex: 0,
        total: 0,
        answers: {},
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [],
        isLast: false,
      });

      const questionnaire = createMockQuestionnaire([]);
      const { container } = render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should handle onComplete being undefined', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Question',
        type: 'string',
        required: false,
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: {},
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      const skipButton = screen.getByTestId('button-skip');
      expect(() => fireEvent.click(skipButton)).not.toThrow();
    });

    it('should handle onProgressUpdate being undefined', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Question',
        type: 'string',
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: {},
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      expect(() => {
        render(
          <AyuStepperContainer
            questionnaire={questionnaire}
            onComplete={mockOnComplete}
          />
        );
      }).not.toThrow();
    });

    it('should handle empty string value correctly', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Question',
        type: 'string',
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: '' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByTestId('button-submit')).toBeInTheDocument();
    });

    it('should handle array value correctly', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Multi Question',
        type: 'choice',
        repeats: true,
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: [] },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByTestId('renderer-q1')).toBeInTheDocument();
    });
  });

  describe('CSS Classes', () => {
    it('should have correct container classes', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Question',
        type: 'string',
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: {},
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      const { container } = render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('flex', 'flex-col', 'gap-6');
    });

    it('should apply correct button classes', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Question',
        type: 'string',
        required: false,
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: {},
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      const skipButton = screen.getByTestId('button-skip');
      expect(skipButton).toHaveClass('w-full', 'md:w-[10%]');
    });
  });

  describe('EnableWhen with Different Answer Types', () => {
    it('should handle enableWhen with answerInteger', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Parent Question',
        type: 'choice',
        item: [
          {
            linkId: 'q1.1',
            text: 'Nested String',
            type: 'string',
            enableWhen: [
              {
                question: 'q1',
                operator: '=',
                answerInteger: 5,
              },
            ],
          },
        ],
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: 5 },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByTestId('nested-renderer')).toBeInTheDocument();
    });

    it('should handle enableWhen with answerBoolean', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Parent Question',
        type: 'choice',
        item: [
          {
            linkId: 'q1.1',
            text: 'Nested String',
            type: 'string',
            enableWhen: [
              {
                question: 'q1',
                operator: '=',
                answerBoolean: true,
              },
            ],
          },
        ],
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: true },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByTestId('nested-renderer')).toBeInTheDocument();
    });

    it('should handle enableWhen with answerCoding', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Parent Question',
        type: 'choice',
        item: [
          {
            linkId: 'q1.1',
            text: 'Nested String',
            type: 'string',
            enableWhen: [
              {
                question: 'q1',
                operator: '=',
                answerCoding: { code: 'option-1', display: 'Option 1' },
              },
            ],
          },
        ],
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: 'option-1' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByTestId('nested-renderer')).toBeInTheDocument();
    });

    it('should not show submit when nested string is empty but visible', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Parent Question',
        type: 'choice',
        item: [
          {
            linkId: 'q1.1',
            text: 'Nested String',
            type: 'string',
            enableWhen: [
              {
                question: 'q1',
                operator: '=',
                answerInteger: 10,
              },
            ],
          },
        ],
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: 10 },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByTestId('button-submit')).toBeInTheDocument();
      expect(screen.getByTestId('button-skip')).toBeInTheDocument();
    });
  });

  describe('Toast Validation Messages', () => {
    it('should show "Please enter a value" toast for invalid quantity', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Duration Question',
        type: 'quantity',
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: {
          q1: {
            dropdownValues: {
              number: 5,
              days: undefined,
            },
          },
        },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      fireEvent.click(screen.getByTestId('button-submit'));
      expect(mockShowToast).toHaveBeenCalledWith('Please enter a value', undefined, 'warning');
    });

    it('should show "Please select any one option" toast for empty repeats choice', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Multi Select',
        type: 'choice',
        repeats: true,
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: [] },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      fireEvent.click(screen.getByTestId('button-submit'));
      expect(mockShowToast).toHaveBeenCalledWith('Please select any one option', undefined, 'warning');
    });

    it('should block Submit with an upload-image toast when the camera answer has no images', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Is there jaundice?',
        type: 'choice',
        repeats: true,
        answerOption: [
          {
            valueCoding: { code: 'cam', display: 'Picture Taken' },
            extension: [
              {
                url: 'urn:intelehealth:physical-exam/option-kind',
                valueString: 'camera',
              },
            ],
          },
        ],
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: ['cam'] },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
        isCameraAnswerMissingImages: () => true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      fireEvent.click(screen.getByTestId('button-submit'));
      expect(mockShowToast).toHaveBeenCalledWith(
        'Please upload the captured image',
        undefined,
        'warning'
      );
      expect(mockGoNext).not.toHaveBeenCalled();
    });

    it('should show "All questions are compulsory" toast for incomplete associated symptoms', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Associated symptoms',
        type: 'choice',
        repeats: true,
        answerOption: [
          { valueCoding: { code: 'fever', display: 'Fever' } },
          { valueCoding: { code: 'cough', display: 'Cough' } },
        ],
      };

      mockResolveAyuComponent.mockReturnValue('associatedSymptoms');
      mockIsStrictAssociatedSymptoms.mockReturnValue(true);
      mockResolveAyuComponentLogic.mockReturnValue('associatedSymptoms');
      mockIsStrictAssociatedSymptomsLogic.mockReturnValue(true);
      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: ['fever'] },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      fireEvent.click(screen.getByTestId('button-submit'));
      expect(mockShowToast).toHaveBeenCalledWith(
        'All questions are compulsory, please answer',
        undefined,
        'warning'
      );
      expect(mockGoNext).not.toHaveBeenCalled();
    });

    it('should show "Please enter a value" toast for visible required nested string', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Parent',
        type: 'choice',
        item: [
          {
            linkId: 'q1.1',
            text: 'Child String',
            type: 'string',
          },
        ],
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { 'q1.1': 'some-val' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      fireEvent.click(screen.getByTestId('button-submit'));

      expect(mockShowToast).not.toHaveBeenCalled();
      expect(mockGoNext).toHaveBeenCalled();
    });
  });

  describe('Question number in validation toast', () => {
    const invalidQuantityQuestion: AyuQuestion = {
      linkId: 'q1',
      text: 'Duration Question',
      type: 'quantity',
    };

    const invalidQuantityAnswers = {
      q1: { dropdownValues: { number: 5, days: undefined } },
    };

    it('should reference the question number in review mode', () => {
      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: invalidQuantityQuestion,
        currentIndex: 0,
        total: 1,
        answers: invalidQuantityAnswers,
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [invalidQuantityQuestion],
        isLast: true,
        showAll: true,
      });

      const questionnaire = createMockQuestionnaire([invalidQuantityQuestion]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      fireEvent.click(screen.getByTestId('button-submit'));
      expect(mockShowToast).toHaveBeenCalledWith(
        'Please answer Question 1 before proceeding',
        undefined,
        'warning'
      );
      expect(mockGoNext).not.toHaveBeenCalled();
    });

    it('should apply questionIndexOffset to the review mode question number', () => {
      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: invalidQuantityQuestion,
        currentIndex: 0,
        total: 1,
        answers: invalidQuantityAnswers,
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [invalidQuantityQuestion],
        isLast: true,
        showAll: true,
      });

      const questionnaire = createMockQuestionnaire([invalidQuantityQuestion]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          questionIndexOffset={3}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      fireEvent.click(screen.getByTestId('button-submit'));
      expect(mockShowToast).toHaveBeenCalledWith(
        'Please answer Question 4 before proceeding',
        undefined,
        'warning'
      );
    });

    it('should not reference the question number in linear mode', () => {
      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: invalidQuantityQuestion,
        currentIndex: 0,
        total: 1,
        answers: invalidQuantityAnswers,
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [invalidQuantityQuestion],
        isLast: true,
        showAll: false,
      });

      const questionnaire = createMockQuestionnaire([invalidQuantityQuestion]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      fireEvent.click(screen.getByTestId('button-submit'));
      expect(mockShowToast).toHaveBeenCalledWith(
        'Please enter a value',
        undefined,
        'warning'
      );
    });
  });

  describe('RightIcon Behavior', () => {
    it('should not show rightIcon on submit before clicking', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Question',
        type: 'string',
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: 'answer' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.queryByTestId('right-icon-submit')).not.toBeInTheDocument();
    });

    it('should mark question as answered after successful submit', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Question',
        type: 'string',
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: 'answer' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByTestId('question-loader-0')).toHaveAttribute('data-is-answered', 'false');
      fireEvent.click(screen.getByTestId('button-submit'));

      expect(screen.getByTestId('question-loader-0')).toHaveAttribute('data-is-answered', 'true');
    });

    it('should not show rightIcon on submit after failed validation', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Multi Select',
        type: 'choice',
        repeats: true,
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: [] },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      fireEvent.click(screen.getByTestId('button-submit'));

      expect(screen.queryByTestId('right-icon-submit')).not.toBeInTheDocument();
    });
  });

  describe('isQuantityInvalid - Additional Cases', () => {
    it('should not show toast for non-quantity and non-choice types', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'String Question',
        type: 'string',
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: 'some answer' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      fireEvent.click(screen.getByTestId('button-submit'));

      expect(mockShowToast).not.toHaveBeenCalled();
      expect(mockGoNext).toHaveBeenCalled();
    });

    it('should not show submit for choice question with regular string value (no repeats)', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Choice Question',
        type: 'choice',
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: 'regular-string-answer' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.queryByTestId('button-submit')).not.toBeInTheDocument();
      expect(screen.getByTestId('button-skip')).toBeInTheDocument();
    });

    it('should show toast for choice with nested invalid duration on submit click', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Choice Question',
        type: 'choice',
        item: [
          {
            linkId: 'q1.1',
            text: 'Duration Child',
            type: 'string',
          },
        ],
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: {
          'q1.1': {
            dropdownValues: {
              number: 5,
              days: undefined,
            },
          },
        },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      const submitButton = screen.getByTestId('button-submit');
      fireEvent.click(submitButton);
      expect(mockShowToast).toHaveBeenCalledWith('Please enter a value', undefined, 'warning');
    });

    it('should not show toast for choice with nested valid duration', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Choice Question',
        type: 'choice',
        item: [
          {
            linkId: 'q1.1',
            text: 'Duration Child',
            type: 'string',
          },
        ],
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: {
          'q1.1': {
            dropdownValues: {
              number: 5,
              days: 'weeks',
            },
          },
        },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      const submitButton = screen.getByTestId('button-submit');
      fireEvent.click(submitButton);
      expect(mockShowToast).not.toHaveBeenCalled();
      expect(mockGoNext).toHaveBeenCalled();
    });

    it('should show submit button for choice with top-level duration answer', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Choice Question',
        type: 'choice',
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: {
          q1: {
            dropdownValues: {
              number: 7,
              days: 'days',
            },
          },
        },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByTestId('button-submit')).toBeInTheDocument();
    });

    it('should show submit button for nested string child with answer', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Parent Question',
        type: 'choice',
        item: [
          {
            linkId: 'q1.1',
            text: 'Child String',
            type: 'string',
          },
        ],
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: {
          'q1.1': 'child answer',
        },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByTestId('button-submit')).toBeInTheDocument();
    });
  });

  describe('isEmpty helper function coverage', () => {
    it('should handle null values in nested items', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Parent Question',
        type: 'choice',
        item: [
          {
            linkId: 'q1.1',
            text: 'Child String',
            type: 'string',
          },
        ],
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { 'q1.1': null },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByTestId('button-skip')).toBeInTheDocument();
    });

    it('should handle whitespace-only string as empty', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Question',
        type: 'string',
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: '   ' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByTestId('button-submit')).toBeInTheDocument();
    });
  });

  describe('Associated Symptoms Question Type', () => {
    it('should show submit button for associatedSymptoms question', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Associated Symptoms',
        type: 'choice',
        repeats: true,
        answerOption: [
          { valueCoding: { code: 'fever', display: 'Fever' } },
          { valueCoding: { code: 'cough', display: 'Cough' } },
        ],
      };

      mockResolveAyuComponent.mockReturnValue('associatedSymptoms');
      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: ['fever', 'NO_cough'] },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByTestId('button-submit')).toBeInTheDocument();
    });

    it('should show toast when not all associatedSymptoms options answered', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Associated symptoms',
        type: 'choice',
        repeats: true,
        answerOption: [
          { valueCoding: { code: 'fever', display: 'Fever' } },
          { valueCoding: { code: 'cough', display: 'Cough' } },
        ],
      };

      mockResolveAyuComponent.mockReturnValue('associatedSymptoms');
      mockIsStrictAssociatedSymptoms.mockReturnValue(true);
      mockResolveAyuComponentLogic.mockReturnValue('associatedSymptoms');
      mockIsStrictAssociatedSymptomsLogic.mockReturnValue(true);
      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,

        answers: { q1: ['fever'] },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      const submitButton = screen.getByTestId('button-submit');
      fireEvent.click(submitButton);

      expect(mockShowToast).toHaveBeenCalledWith(
        'All questions are compulsory, please answer',
        undefined,
        'warning'
      );
      expect(mockGoNext).not.toHaveBeenCalled();
    });

    it('should call goNext when all associatedSymptoms options are answered', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Associated symptoms',
        type: 'choice',
        repeats: true,
        answerOption: [
          { valueCoding: { code: 'fever', display: 'Fever' } },
          { valueCoding: { code: 'cough', display: 'Cough' } },
        ],
      };

      mockResolveAyuComponent.mockReturnValue('associatedSymptoms');
      mockIsStrictAssociatedSymptoms.mockReturnValue(true);
      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,

        answers: { q1: ['fever', 'NO_cough'] },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      const submitButton = screen.getByTestId('button-submit');
      fireEvent.click(submitButton);

      expect(mockShowToast).not.toHaveBeenCalled();
      expect(mockGoNext).toHaveBeenCalled();
    });

    it('should NOT render nested renderer for associatedSymptoms question', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Associated Symptoms',
        type: 'choice',
        repeats: true,
        item: [{ linkId: 'nested-q', text: 'Duration', type: 'string' }],
      };

      mockResolveAyuComponent.mockReturnValue('associatedSymptoms');
      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: {},
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.queryByTestId('nested-renderer')).not.toBeInTheDocument();
    });

    it('should show toast for associatedSymptoms when answer is not an array (non-strict)', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Associated Symptoms',
        type: 'choice',
        repeats: true,
        answerOption: [
          { valueCoding: { code: 'fever', display: 'Fever' } },
        ],
      };

      mockResolveAyuComponent.mockReturnValue('associatedSymptoms');
      mockIsStrictAssociatedSymptoms.mockReturnValue(false);
      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: 'not-an-array' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      const submitButton = screen.getByTestId('button-submit');
      fireEvent.click(submitButton);

      expect(mockShowToast).toHaveBeenCalledWith(
        'Please select any one option',
        undefined,
        'warning'
      );
    });

    it('should show compulsory toast for strict associatedSymptoms when answer is not an array', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Associated symptoms',
        type: 'choice',
        repeats: true,
        answerOption: [
          { valueCoding: { code: 'fever', display: 'Fever' } },
        ],
      };

      mockResolveAyuComponent.mockReturnValue('associatedSymptoms');
      mockIsStrictAssociatedSymptoms.mockReturnValue(true);
      mockResolveAyuComponentLogic.mockReturnValue('associatedSymptoms');
      mockIsStrictAssociatedSymptomsLogic.mockReturnValue(true);
      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: 'not-an-array' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      const submitButton = screen.getByTestId('button-submit');
      fireEvent.click(submitButton);

      expect(mockShowToast).toHaveBeenCalledWith(
        'All questions are compulsory, please answer',
        undefined,
        'warning'
      );
    });

    it('should not call goNext for associatedSymptoms when not active', () => {
      const questions: AyuQuestion[] = [
        {
          linkId: 'q1',
          text: 'Associated symptoms',
          type: 'choice',
          repeats: true,
          answerOption: [
            { valueCoding: { code: 'fever', display: 'Fever' } },
          ],
        },
        { linkId: 'q2', text: 'Question 2', type: 'string' },
      ];

      mockResolveAyuComponent.mockReturnValue('associatedSymptoms');
      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: questions[1],
        currentIndex: 1,
        total: 2,
        answers: { q1: ['fever'] },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: questions,
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire(questions);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      const submitButtons = screen.getAllByTestId('button-submit');
      fireEvent.click(submitButtons[0]);

      expect(mockGoNext).not.toHaveBeenCalled();
    });
  });

  describe('Associated symptoms with no answerOption (line 380 ?? 0 fallback)', () => {
    it('should use 0 as fallback when question.answerOption is undefined', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Associated symptoms',
        type: 'choice',
        repeats: true,

      };

      mockResolveAyuComponent.mockReturnValue('associatedSymptoms');
      mockIsStrictAssociatedSymptoms.mockReturnValue(true);
      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: ['some-code'] },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      fireEvent.click(screen.getByTestId('button-submit'));

      expect(mockGoNext).toHaveBeenCalled();
    });
  });

  describe('Choice with Repeats Submit Button', () => {
    it('should show submit button for choice type with repeats even without answer', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Multi Select Question',
        type: 'choice',
        repeats: true,
        answerOption: [
          { valueCoding: { code: 'opt1', display: 'Option 1' } },
          { valueCoding: { code: 'opt2', display: 'Option 2' } },
        ],
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: {},
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByTestId('button-submit')).toBeInTheDocument();
    });

    it('should show toast for choice with repeats when no options selected', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Multi Select Question',
        type: 'choice',
        repeats: true,
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: [] },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      const submitButton = screen.getByTestId('button-submit');
      fireEvent.click(submitButton);

      expect(mockShowToast).toHaveBeenCalledWith('Please select any one option', undefined, 'warning');
      expect(mockGoNext).not.toHaveBeenCalled();
    });

    it('should call goNext for choice with repeats when at least one option selected', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Multi Select Question',
        type: 'choice',
        repeats: true,
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: ['opt1'] },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      const submitButton = screen.getByTestId('button-submit');
      fireEvent.click(submitButton);

      expect(mockShowToast).not.toHaveBeenCalled();
      expect(mockGoNext).toHaveBeenCalled();
    });

    it('should NOT show submit for choice without repeats and no duration', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Single Select Question',
        type: 'choice',
        repeats: false,
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: 'opt1' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.queryByTestId('button-submit')).not.toBeInTheDocument();
    });
  });

  describe('Grandchildren Duration Validation', () => {
    it('should show toast for choice with grandchild invalid duration', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Choice Question',
        type: 'choice',
        repeats: true,
        item: [
          {
            linkId: 'q1.1',
            text: 'Child Level',
            type: 'choice',
            item: [
              {
                linkId: 'q1.1.1',
                text: 'Grandchild Duration',
                type: 'quantity',
              },
            ],
          },
        ],
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: {
          q1: ['some-option'],
          'q1.1.1': {
            dropdownValues: {
              number: 5,
              days: undefined,
            },
          },
        },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      const submitButton = screen.getByTestId('button-submit');
      fireEvent.click(submitButton);

      expect(mockShowToast).toHaveBeenCalledWith('Please enter a value', undefined, 'warning');
      expect(mockGoNext).not.toHaveBeenCalled();
    });

    it('should call goNext for choice with valid grandchild duration', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Choice Question',
        type: 'choice',
        repeats: true,
        item: [
          {
            linkId: 'q1.1',
            text: 'Child Level',
            type: 'choice',
            item: [
              {
                linkId: 'q1.1.1',
                text: 'Grandchild Duration',
                type: 'quantity',
              },
            ],
          },
        ],
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: {
          q1: ['some-option'],
          'q1.1.1': {
            dropdownValues: {
              number: 5,
              days: 'weeks',
            },
          },
        },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      const submitButton = screen.getByTestId('button-submit');
      fireEvent.click(submitButton);

      expect(mockShowToast).not.toHaveBeenCalled();
      expect(mockGoNext).toHaveBeenCalled();
    });
  });

  describe('hasNestedRepeats Submit Button', () => {
    it('should show submit button when child has repeats', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Parent Question',
        type: 'choice',
        item: [
          {
            linkId: 'q1.1',
            text: 'Repeating Child',
            type: 'choice',
            repeats: true,
          },
        ],
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: {},
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByTestId('button-submit')).toBeInTheDocument();
    });

    it('should not show submit for nested repeats when hidden by enableWhen', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Parent Question',
        type: 'choice',
        item: [
          {
            linkId: 'q1.1',
            text: 'Repeating Child',
            type: 'choice',
            repeats: true,
            enableWhen: [
              {
                question: 'q1',
                operator: '=',
                answerCoding: { code: 'yes' },
              },
            ],
          },
        ],
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: 'no' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.queryByTestId('button-submit')).not.toBeInTheDocument();
    });
  });

  describe('Nested integer and quantity child with answer', () => {
    it('should show submit for nested integer child with answer', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Parent',
        type: 'choice',
        item: [
          {
            linkId: 'q1.1',
            text: 'Integer Child',
            type: 'integer',
          },
        ],
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { 'q1.1': 42 },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByTestId('button-submit')).toBeInTheDocument();
    });

    it('should show submit for nested quantity child with answer', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Parent',
        type: 'choice',
        item: [
          {
            linkId: 'q1.1',
            text: 'Quantity Child',
            type: 'quantity',
          },
        ],
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { 'q1.1': { dropdownValues: { number: 3, days: 'days' } } },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByTestId('button-submit')).toBeInTheDocument();
    });
  });

  describe('isEmpty Additional Coverage', () => {
    it('should handle empty array as empty value in nested string check', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Parent Question',
        type: 'choice',
        item: [
          {
            linkId: 'q1.1',
            text: 'Nested String',
            type: 'string',
          },
        ],
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { 'q1.1': [] },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      const submitButton = screen.getByTestId('button-submit');
      expect(submitButton).not.toBeDisabled();
    });

    it('should handle non-string child type in hasVisibleRequiredNestedString', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Parent Question',
        type: 'choice',
        item: [
          {
            linkId: 'q1.1',
            text: 'Choice Child',
            type: 'choice',
          },
        ],
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: 'selected' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByTestId('button-skip')).toBeInTheDocument();
    });

    it('should handle invisible nested string child (enableWhen not met)', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Parent Question',
        type: 'choice',
        item: [
          {
            linkId: 'q1.1',
            text: 'Nested String',
            type: 'string',
            enableWhen: [
              {
                question: 'q1',
                operator: '=',
                answerString: 'no',
              },
            ],
          },
        ],
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: 'yes' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByTestId('button-skip')).toBeInTheDocument();
    });
  });

  describe('Progress Update Same Value', () => {
    it('should not call onProgressUpdate when completedSteps has not changed', () => {
      const questions: AyuQuestion[] = [
        { linkId: 'q1', text: 'Question 1', type: 'string' },
        { linkId: 'q2', text: 'Question 2', type: 'string' },
      ];

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: questions[0],
        currentIndex: 0,
        total: 2,
        answers: {},
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: questions,
        isLast: false,
      });

      const questionnaire = createMockQuestionnaire(questions);
      const { rerender } = render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(mockOnProgressUpdate).toHaveBeenCalledTimes(1);

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: questions[0],
        currentIndex: 0,
        total: 3,
        answers: {},
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [...questions, { linkId: 'q3', text: 'Question 3', type: 'string' }],
        isLast: false,
      });

      rerender(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(mockOnProgressUpdate).toHaveBeenCalledTimes(1);
    });
  });

  describe('associatedSymptoms answerOption fallback', () => {
    it('should show toast for associatedSymptoms when answerOption is undefined and array is empty', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Associated symptoms',
        type: 'choice',
        repeats: true,

      };

      mockResolveAyuComponent.mockReturnValue('associatedSymptoms');
      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: [] },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      const submitButton = screen.getByTestId('button-submit');
      fireEvent.click(submitButton);

      expect(mockShowToast).toHaveBeenCalled();
      expect(mockGoNext).not.toHaveBeenCalled();
    });
  });

  describe('Review Mode (showAll)', () => {
    it('should NOT show Submit button in review mode for pure single-choice question', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Choice Question',
        type: 'choice',
        answerOption: [
          { valueCoding: { code: 'yes', display: 'Yes' } },
          { valueCoding: { code: 'no', display: 'No' } },
        ],
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: 'yes' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
        showAll: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.queryByTestId('button-submit')).not.toBeInTheDocument();
    });

    it('should show Submit button in review mode for string type question', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'String Question',
        type: 'string',
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: 'some answer' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
        showAll: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByTestId('button-submit')).toBeInTheDocument();
    });

    it('should show Submit in review mode for choice with repeats', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Multi Select',
        type: 'choice',
        repeats: true,
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: ['opt1'] },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
        showAll: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByTestId('button-submit')).toBeInTheDocument();
    });

    it('should show Submit in review mode for single-choice with visible nested repeats', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Choice Question',
        type: 'choice',
        item: [
          {
            linkId: 'q1.1',
            text: 'Nested Repeats',
            type: 'choice',
            repeats: true,
          },
        ],
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: 'yes' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
        showAll: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByTestId('button-submit')).toBeInTheDocument();
    });

    it('should show all questions in review mode', () => {
      const questions: AyuQuestion[] = [
        { linkId: 'q1', text: 'Question 1', type: 'string' },
        { linkId: 'q2', text: 'Question 2', type: 'string' },
        { linkId: 'q3', text: 'Question 3', type: 'string' },
      ];

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: questions[0],
        currentIndex: 0,
        total: 3,
        answers: { q1: 'a1', q2: 'a2', q3: 'a3' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: questions,
        isLast: false,
        showAll: true,
      });

      const questionnaire = createMockQuestionnaire(questions);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByTestId('question-loader-0')).toBeInTheDocument();
      expect(screen.getByTestId('question-loader-1')).toBeInTheDocument();
      expect(screen.getByTestId('question-loader-2')).toBeInTheDocument();
    });
  });

  describe('useImperativeHandle confirm', () => {
    it('should call onComplete with current answers when confirm is invoked via ref', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Question 1',
        type: 'string',
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: 'hello' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const ref = createRef<AyuStepperContainerHandle>();
      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          ref={ref}
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      ref.current!.confirm();
      expect(mockOnComplete).toHaveBeenCalledWith({ q1: 'hello' });
    });

    it('should not throw when onComplete is undefined and confirm is called', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Question 1',
        type: 'string',
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: 'hello' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const ref = createRef<AyuStepperContainerHandle>();
      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          ref={ref}
          questionnaire={questionnaire}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(() => ref.current!.confirm()).not.toThrow();
    });
  });

  describe('Strict associated symptoms with non-array answer', () => {
    it('should use empty array fallback when answer is not an array for strict associated symptoms', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Associated Symptoms',
        type: 'choice',
        repeats: true,
        answerOption: [
          { valueCoding: { code: 'opt1', display: 'Option 1' } },
          { valueCoding: { code: 'opt2', display: 'Option 2' } },
        ],
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: 'not-an-array' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      mockResolveAyuComponent.mockReturnValue('associatedSymptoms');
      mockIsStrictAssociatedSymptoms.mockReturnValue(true);

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      const submitButton = screen.getByTestId('button-submit');
      fireEvent.click(submitButton);

      expect(mockShowToast).toHaveBeenCalled();
      expect(mockGoNext).not.toHaveBeenCalled();
    });
  });

  describe('handleSetAnswer clears submitted/skipped state', () => {
    it('should clear submitted state when answer is edited after submit', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Question',
        type: 'string',
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: 'answer' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      fireEvent.click(screen.getByTestId('button-submit'));
      expect(screen.getByTestId('question-loader-0')).toHaveAttribute('data-is-answered', 'true');

      fireEvent.click(screen.getByTestId('edit-0'));
      expect(screen.getByTestId('question-loader-0')).toHaveAttribute('data-is-answered', 'false');

      fireEvent.change(screen.getByTestId('input-q1'), { target: { value: 'new answer' } });

      expect(screen.getByTestId('question-loader-0')).toHaveAttribute('data-is-answered', 'false');
    });

    it('should clear skipped state when answer is edited after skip', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Question',
        type: 'string',
        required: false,
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: {},
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      fireEvent.click(screen.getByTestId('button-skip'));
      expect(screen.getByTestId('question-loader-0')).toHaveAttribute('data-is-answered', 'true');

      fireEvent.click(screen.getByTestId('edit-0'));
      expect(screen.getByTestId('question-loader-0')).toHaveAttribute('data-is-answered', 'false');

      fireEvent.change(screen.getByTestId('input-q1'), { target: { value: 'new answer' } });
      expect(screen.getByTestId('question-loader-0')).toHaveAttribute('data-is-answered', 'false');
    });
  });

  describe('useImperativeHandle showSummary', () => {
    it('should call goNext when showSummary is invoked via ref', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Question 1',
        type: 'string',
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: 'hello' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const ref = createRef<AyuStepperContainerHandle>();
      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          ref={ref}
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      ref.current!.showSummary();
      expect(mockGoNext).toHaveBeenCalled();

      expect(mockOnComplete).not.toHaveBeenCalled();
    });

    it('should not throw when showSummary is called without onComplete', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Question 1',
        type: 'string',
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: 'hello' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const ref = createRef<AyuStepperContainerHandle>();
      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          ref={ref}
          questionnaire={questionnaire}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(() => ref.current!.showSummary()).not.toThrow();
      expect(mockGoNext).toHaveBeenCalled();
    });

    it('should expose both confirm and showSummary on the ref handle', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Question 1',
        type: 'string',
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: 'val' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const ref = createRef<AyuStepperContainerHandle>();
      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          ref={ref}
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(ref.current).toBeDefined();
      expect(typeof ref.current!.confirm).toBe('function');
      expect(typeof ref.current!.showSummary).toBe('function');
      expect(typeof ref.current!.getAnswers).toBe('function');
    });
  });

  describe('useImperativeHandle getAnswers', () => {
    it('should return the current in-progress answers map', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Question 1',
        type: 'string',
      };

      const answers: Record<string, AyuAnswerValue> = {
        q1: 'in-progress',
        q2: 42,
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers,
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const ref = createRef<AyuStepperContainerHandle>();
      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          ref={ref}
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      // Snapshot does NOT trigger completion or validation — pure read.
      expect(ref.current!.getAnswers()).toEqual(answers);
      expect(mockOnComplete).not.toHaveBeenCalled();
      expect(mockGoNext).not.toHaveBeenCalled();
    });

    it('should return an empty object when no answers have been entered', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Question 1',
        type: 'string',
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: {},
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: false,
      });

      const ref = createRef<AyuStepperContainerHandle>();
      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          ref={ref}
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(ref.current!.getAnswers()).toEqual({});
    });
  });

  describe('onSummaryShown prop wiring', () => {
    it('should pass onSummaryShown through to useFHIRStepper', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Question 1',
        type: 'string',
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: 'a' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const onSummaryShown = vi.fn();
      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
          onSummaryShown={onSummaryShown}
        />
      );

      /* The container forwards the prop verbatim; the actual firing is covered
         in useFHIRStepper's own tests. */
      expect(_mockUseFHIRStepper).toHaveBeenCalledWith(
        expect.objectContaining({ onSummaryShown })
      );
    });
  });

  describe('Mount-time progress announcement (review mode)', () => {
    it('should announce totalSteps and totalSteps as completed on mount when showAll is true', () => {
      const questions: AyuQuestion[] = [
        { linkId: 'q1', text: 'Question 1', type: 'string' },
        { linkId: 'q2', text: 'Question 2', type: 'string' },
      ];

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: questions[0],
        currentIndex: 0,
        total: 2,
        answers: { q1: 'a', q2: 'b' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: questions,
        isLast: true,
        showAll: true,
      });

      const questionnaire = createMockQuestionnaire(questions);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          initialAnswers={{ q1: 'a', q2: 'b' }}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      /* The mount-only effect must still announce in review mode so the
         parent's SideLoader denominator is correct after returning from Back. */
      expect(mockOnProgressUpdate).toHaveBeenCalledWith(2, 2);
    });

    it('should not double-announce on mount when showAll is false (change-driven effect handles it)', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Question 1',
        type: 'string',
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 3,
        answers: {},
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [
          question,
          { linkId: 'q2', text: 'Q2', type: 'string' },
          { linkId: 'q3', text: 'Q3', type: 'string' },
        ],
        isLast: false,
        showAll: false,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      // Non-review mount → only the existing change-driven effect should fire (once).
      expect(mockOnProgressUpdate).toHaveBeenCalledTimes(1);
      expect(mockOnProgressUpdate).toHaveBeenCalledWith(3, 0);
    });

    it('should not announce in review mode when totalSteps is 0', () => {
      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: undefined,
        currentIndex: 0,
        total: 0,
        answers: {},
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [],
        isLast: false,
        showAll: true,
      });

      const questionnaire = createMockQuestionnaire([]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      /* showAll + empty questionnaire: mount-effect guard skips, and the
         change-driven effect is suppressed by showAll → nothing fires. */
      expect(mockOnProgressUpdate).not.toHaveBeenCalled();
    });
  });

  describe('submittedQuestions initialization from initialAnswers', () => {
    it('should mark questions with answers in initialAnswers as answered', () => {
      const questions: AyuQuestion[] = [
        { linkId: 'q1', text: 'Question 1', type: 'string' },
        { linkId: 'q2', text: 'Question 2', type: 'string' },
      ];

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: questions[1],
        currentIndex: 1,
        total: 2,
        answers: { q1: 'answer1', q2: 'answer2' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: questions,
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire(questions);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          initialAnswers={{ q1: 'answer1', q2: 'answer2' }}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByTestId('question-loader-0')).toHaveAttribute('data-is-answered', 'true');
      expect(screen.getByTestId('question-loader-1')).toHaveAttribute('data-is-answered', 'true');
    });

    it('should NOT show submit tick marks when initialAnswers is empty', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Question 1',
        type: 'string',
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: 'answer' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          initialAnswers={{}}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.queryByTestId('right-icon-submit')).not.toBeInTheDocument();
    });

    it('should NOT show submit tick marks when initialAnswers is undefined', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Question 1',
        type: 'string',
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: 'answer' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.queryByTestId('right-icon-submit')).not.toBeInTheDocument();
    });

    it('should only mark questions whose linkId has a value in initialAnswers', () => {
      const questions: AyuQuestion[] = [
        { linkId: 'q1', text: 'Question 1', type: 'string' },

        { linkId: 'q2', text: 'Question 2', type: 'string', required: true },
      ];

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: questions[1],
        currentIndex: 1,
        total: 2,
        answers: { q1: 'answer1', q2: 'answer2' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: questions,
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire(questions);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          initialAnswers={{ q1: 'answer1' }}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByTestId('question-loader-0')).toHaveAttribute('data-is-answered', 'true');
      expect(screen.getByTestId('question-loader-1')).toHaveAttribute('data-is-answered', 'false');
    });
  });

  describe('skippedQuestions initialization from initialAnswers', () => {
    it('should mark non-required questions without answers in initialAnswers as answered (skipped)', () => {
      const questions: AyuQuestion[] = [
        { linkId: 'q1', text: 'Question 1', type: 'string', required: false },
        { linkId: 'q2', text: 'Question 2', type: 'string', required: false },
      ];

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: questions[1],
        currentIndex: 1,
        total: 2,
        answers: { q2: 'answer2' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: questions,
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire(questions);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          initialAnswers={{ q2: 'answer2' }}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByTestId('question-loader-0')).toHaveAttribute('data-is-answered', 'true');
      expect(screen.getByTestId('question-loader-1')).toHaveAttribute('data-is-answered', 'true');
    });

    it('should NOT mark required questions as skipped even without answers in initialAnswers', () => {
      const questions: AyuQuestion[] = [
        { linkId: 'q1', text: 'Question 1', type: 'string', required: true },
        { linkId: 'q2', text: 'Question 2', type: 'string', required: false },
      ];

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: questions[1],
        currentIndex: 1,
        total: 2,
        answers: { q2: 'answer2' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: questions,
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire(questions);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          initialAnswers={{ q2: 'answer2' }}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByTestId('question-loader-0')).toHaveAttribute('data-is-answered', 'false');
      expect(screen.getByTestId('question-loader-1')).toHaveAttribute('data-is-answered', 'true');
    });

    it('should hide submit button when question is in skippedQuestions from initialAnswers', () => {
      const questions: AyuQuestion[] = [
        { linkId: 'q1', text: 'Question 1', type: 'string', required: false },
        { linkId: 'q2', text: 'Question 2', type: 'string' },
      ];

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: questions[1],
        currentIndex: 1,
        total: 2,
        answers: { q1: 'val', q2: 'answer2' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: questions,
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire(questions);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          initialAnswers={{ q2: 'answer2' }}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.queryByTestId('button-submit')).not.toBeInTheDocument();
    });
  });

  describe('Skip on last question calls goNext', () => {
    it('should call goNext when skip is clicked on the last question', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Last Question',
        type: 'string',
        required: false,
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: {},
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      const skipButton = screen.getByTestId('button-skip');
      fireEvent.click(skipButton);

      expect(mockGoNext).toHaveBeenCalled();

      expect(mockOnProgressUpdate).toHaveBeenCalledWith(1, 1);
    });

    it('should call both onProgressUpdate and goNext for last question skip', () => {
      const questions: AyuQuestion[] = [
        { linkId: 'q1', text: 'Question 1', type: 'string' },
        { linkId: 'q2', text: 'Last Question', type: 'string', required: false },
      ];

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: questions[1],
        currentIndex: 1,
        total: 2,
        answers: { q1: 'answer1' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: questions,
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire(questions);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      const skipButtons = screen.getAllByTestId('button-skip');

      fireEvent.click(skipButtons[skipButtons.length - 1]);

      expect(mockOnProgressUpdate).toHaveBeenCalledWith(2, 2);
      expect(mockGoNext).toHaveBeenCalled();
    });
  });

  describe('confirm validates before calling onComplete', () => {
    it('should not call onComplete when validateAllQuestions returns false', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Question 1',
        type: 'string',
        required: true,
      };

      mockValidateAllQuestions.mockReturnValue(false);

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: {},
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const ref = createRef<AyuStepperContainerHandle>();
      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          ref={ref}
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      ref.current!.confirm();
      expect(mockValidateAllQuestions).toHaveBeenCalled();
      expect(mockOnComplete).not.toHaveBeenCalled();
    });

    it('should call onComplete when validateAllQuestions returns true', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Question 1',
        type: 'string',
      };

      mockValidateAllQuestions.mockReturnValue(true);

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: 'hello' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const ref = createRef<AyuStepperContainerHandle>();
      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          ref={ref}
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      ref.current!.confirm();
      expect(mockValidateAllQuestions).toHaveBeenCalled();
      expect(mockOnComplete).toHaveBeenCalledWith({ q1: 'hello' });
    });
  });

  describe('getOptionDisplay branches via answered display', () => {
    const renderAnswered = (
      question: AyuQuestion,
      initialAnswers: Record<string, AyuAnswerValue>
    ) => {
      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: initialAnswers,
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });
      return render(
        <AyuStepperContainer
          questionnaire={createMockQuestionnaire([question])}
          initialAnswers={initialAnswers}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );
    };

    it('should resolve valueCoding.display when answer matches a coded option', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Pick a fruit',
        type: 'choice',
        answerOption: [
          { valueCoding: { code: 'A', display: 'Apple' } },
          { valueCoding: { code: 'B', display: 'Banana' } },
        ],
      };
      renderAnswered(question, { q1: 'A' });
      expect(screen.getByText('Apple')).toBeInTheDocument();
    });

    it('should resolve valueString when option uses valueString instead of valueCoding', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Pick a fruit',
        type: 'choice',
        answerOption: [{ valueString: 'Foo' }, { valueString: 'Bar' }],
      };
      renderAnswered(question, { q1: 'Foo' });
      expect(screen.getByText('Foo')).toBeInTheDocument();
    });

    it('should fall back to the raw code when valueCoding has no display and no valueString', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Pick a fruit',
        type: 'choice',
        answerOption: [{ valueCoding: { code: 'A' } }],
      };
      renderAnswered(question, { q1: 'A' });

      expect(screen.getByText('A')).toBeInTheDocument();
    });

    it('should fall back to the raw code when no option matches', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Pick a fruit',
        type: 'choice',
        answerOption: [{ valueCoding: { code: 'A', display: 'Apple' } }],
      };
      renderAnswered(question, { q1: 'Z' });

      expect(screen.getByText('Z')).toBeInTheDocument();
    });

    it('should join displays for an array (repeats) answer', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Pick fruits',
        type: 'choice',
        repeats: true,
        answerOption: [
          { valueCoding: { code: 'A', display: 'Apple' } },
          { valueCoding: { code: 'B', display: 'Banana' } },
        ],
      };
      renderAnswered(question, { q1: ['A', 'B'] });
      expect(screen.getByText('Apple, Banana')).toBeInTheDocument();
    });
  });

  describe('AyuAnsweredDisplay subheading branch (associated symptoms)', () => {
    it('should render the subheading + values block when summaryItems contains subheading items', () => {

      mockResolveAyuComponent.mockReturnValue('associatedSymptoms');
      mockIsStrictAssociatedSymptoms.mockReturnValue(true);

      mockResolveAyuComponentLogic.mockReturnValue('associatedSymptoms');
      mockIsStrictAssociatedSymptomsLogic.mockReturnValue(true);

      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Associated symptoms',
        type: 'choice',
        repeats: true,
        answerOption: [
          { valueCoding: { code: 'HEAD', display: 'Headache' } },
          { valueCoding: { code: 'NAUS', display: 'Nausea' } },
        ],
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: ['HEAD', 'NAUS'] },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      render(
        <AyuStepperContainer
          questionnaire={createMockQuestionnaire([question])}
          initialAnswers={{ q1: ['HEAD', 'NAUS'] }}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByText('Patient reports')).toBeInTheDocument();
      expect(screen.getByText('Headache, Nausea.')).toBeInTheDocument();
    });
  });

  describe('auto-advance backfill effect', () => {
    it('should add answered, non-skipped questions to submittedQuestions when currentIndex moves forward', () => {

      const questions: AyuQuestion[] = [
        { linkId: 'q1', text: 'Question 1', type: 'string', required: true },
        { linkId: 'q2', text: 'Question 2', type: 'string', required: true },
      ];

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: questions[0],
        currentIndex: 0,
        total: 2,
        answers: { q1: 'a1' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: questions,
        isLast: false,
      });

      const questionnaire = createMockQuestionnaire(questions);
      const { rerender } = render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByTestId('question-loader-0')).toHaveAttribute('data-is-answered', 'false');

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: questions[1],
        currentIndex: 1,
        total: 2,
        answers: { q1: 'a1' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: questions,
        isLast: true,
      });

      rerender(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByTestId('question-loader-0')).toHaveAttribute('data-is-answered', 'true');
    });
  });

  describe('Skip clears editing state', () => {
    it('should remove the question from editingQuestions when Skip is clicked while editing', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Question',
        type: 'string',
        required: false,
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: {},
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      render(
        <AyuStepperContainer
          questionnaire={createMockQuestionnaire([question])}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      fireEvent.click(screen.getByTestId('button-skip'));
      expect(screen.getByTestId('question-loader-0')).toHaveAttribute('data-is-answered', 'true');

      fireEvent.click(screen.getByTestId('edit-0'));
      expect(screen.getByTestId('question-loader-0')).toHaveAttribute('data-is-answered', 'false');

      fireEvent.click(screen.getByTestId('button-skip'));

      expect(screen.getByTestId('question-loader-0')).toHaveAttribute('data-is-answered', 'true');
    });
  });

  describe('Submit clears editing state', () => {
    it('should remove the question from editingQuestions when Submit is clicked while editing', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Question',
        type: 'string',
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: { q1: 'answer' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      render(
        <AyuStepperContainer
          questionnaire={createMockQuestionnaire([question])}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      fireEvent.click(screen.getByTestId('button-submit'));
      expect(screen.getByTestId('question-loader-0')).toHaveAttribute('data-is-answered', 'true');

      fireEvent.click(screen.getByTestId('edit-0'));
      expect(screen.getByTestId('question-loader-0')).toHaveAttribute('data-is-answered', 'false');

      fireEvent.click(screen.getByTestId('button-submit'));

      expect(screen.getByTestId('question-loader-0')).toHaveAttribute('data-is-answered', 'true');
    });
  });

  describe('formatAnswerValue object/number branches via answered display', () => {
    const renderAnswered = (
      question: AyuQuestion,
      initialAnswers: Record<string, AyuAnswerValue>
    ) => {
      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: initialAnswers,
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });
      return render(
        <AyuStepperContainer
          questionnaire={createMockQuestionnaire([question])}
          initialAnswers={initialAnswers}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );
    };

    it('should format dropdownValues with number + days as "<number> <days>"', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Duration',
        type: 'quantity',
      };
      renderAnswered(question, {
        q1: { dropdownValues: { number: '5', days: 'days' } } as unknown as AyuAnswerValue,
      });
      expect(screen.getByText('5 days')).toBeInTheDocument();
    });

    it('should format dropdownValues with number only as String(number)', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Duration',
        type: 'quantity',
      };
      renderAnswered(question, {
        q1: { dropdownValues: { number: '7' } } as unknown as AyuAnswerValue,
      });
      expect(screen.getByText('7')).toBeInTheDocument();
    });

    it('should return null primary value when dropdownValues has no number', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Duration',
        type: 'quantity',
      };
      const { container } = renderAnswered(question, {
        q1: { dropdownValues: {} } as unknown as AyuAnswerValue,
      });
      expect(container.querySelectorAll('p.text-sm.font-semibold')).toHaveLength(0);
    });

    it('should format value + unit object as "<value> <unit>"', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Weight',
        type: 'quantity',
      };
      renderAnswered(question, {
        q1: { value: 70, unit: 'kg' } as unknown as AyuAnswerValue,
      });
      expect(screen.getByText('70 kg')).toBeInTheDocument();
    });

    it('should format value-only object as String(value)', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Weight',
        type: 'quantity',
      };
      renderAnswered(question, {
        q1: { value: 70 } as unknown as AyuAnswerValue,
      });
      expect(screen.getByText('70')).toBeInTheDocument();
    });

    it('should return null primary value when value object has empty value', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Weight',
        type: 'quantity',
      };
      const { container } = renderAnswered(question, {
        q1: { value: '', unit: 'kg' } as unknown as AyuAnswerValue,
      });
      expect(container.querySelectorAll('p.text-sm.font-semibold')).toHaveLength(0);
    });

    it('should stringify a numeric answer for non-choice types', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Age',
        type: 'integer',
      };
      renderAnswered(question, { q1: 42 as unknown as AyuAnswerValue });
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('should treat an object whose dropdownValues is null via the nullish-coalescing fallback', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Duration',
        type: 'quantity',
      };
      const { container } = renderAnswered(question, {
        q1: { dropdownValues: null } as unknown as AyuAnswerValue,
      });

      expect(container.querySelectorAll('p.text-sm.font-semibold')).toHaveLength(0);
    });

    it('should return null primary value for a non-array, non-object, non-string, non-number answer', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Flag',
        type: 'string',
      };

      const { container } = renderAnswered(question, {
        q1: true as unknown as AyuAnswerValue,
      });

      expect(container.querySelectorAll('p.text-sm.font-semibold')).toHaveLength(0);
    });

    it('should format a range answer with both low and high as "<low> - <high>"', () => {
      /* ayu-range-input emits { low, high } — the four branches below cover
         every return path in the range branch of formatAnswerValue. */
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Cycle length (weeks)',
        type: 'integer',
      };
      renderAnswered(question, {
        q1: { low: 2, high: 6 } as unknown as AyuAnswerValue,
      });
      expect(screen.getByText('2 - 6')).toBeInTheDocument();
    });

    it('should format a range answer with only low set as String(low)', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Cycle length (weeks)',
        type: 'integer',
      };
      renderAnswered(question, {
        q1: { low: 4 } as unknown as AyuAnswerValue,
      });
      expect(screen.getByText('4')).toBeInTheDocument();
    });

    it('should format a range answer with only high set as String(high)', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Cycle length (weeks)',
        type: 'integer',
      };
      renderAnswered(question, {
        q1: { high: 9 } as unknown as AyuAnswerValue,
      });
      expect(screen.getByText('9')).toBeInTheDocument();
    });

    it('should return null primary value when range keys are present but values are null', () => {
      /* Outer guard ('low' in answer || 'high' in answer) passes because the
         keys exist; all three numeric returns are skipped → return null path. */
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Cycle length (weeks)',
        type: 'integer',
      };
      const { container } = renderAnswered(question, {
        q1: { low: null, high: null } as unknown as AyuAnswerValue,
      });
      expect(container.querySelectorAll('p.text-sm.font-semibold')).toHaveLength(0);
    });
  });

  describe('collectAnsweredRows nested row without label', () => {
    it('should render a row without a label when the nested item has neither text nor display extension', () => {
      const child: AyuQuestion = {
        linkId: 'child',
        type: 'string',
      };
      const parent: AyuQuestion = {
        linkId: 'q1',
        text: 'Parent question',
        type: 'choice',
        answerOption: [{ valueCoding: { code: 'A', display: 'Option A' } }],
        item: [child],
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: parent,
        currentIndex: 0,
        total: 1,
        answers: { q1: 'A', child: 'child-value' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [parent],
        isLast: true,
      });

      const { container } = render(
        <AyuStepperContainer
          questionnaire={createMockQuestionnaire([parent])}
          initialAnswers={{ q1: 'A', child: 'child-value' }}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByText('child-value')).toBeInTheDocument();
      const labelEls = container.querySelectorAll('p.text-sm.text-\\[\\#7F7B92\\]');
      const labelTexts = [...labelEls].map(el => el.textContent);
      expect(labelTexts).not.toContain('child');
    });
  });

  describe('collectAnsweredRows placeholder wrapper rows', () => {
    it('skips placeholder wrapper rows and placeholder labels (Weight change)', () => {
      const integerChild: AyuQuestion = {
        linkId: 'wl_amount',
        type: 'integer',
        text: '[Enter amount of weight lost in kgs]',
        enableWhen: [
          { question: 'wl', operator: '=', answerCoding: { code: 'amount' } },
        ],
      };
      const weightLoss: AyuQuestion = {
        linkId: 'wl',
        type: 'choice',
        text: 'Weight loss',
        answerOption: [
          {
            valueCoding: {
              code: 'amount',
              display: '[Enter amount of weight lost in kgs]',
            },
          },
        ],
        enableWhen: [
          {
            question: 'weight',
            operator: '=',
            answerCoding: { code: 'loss' },
          },
        ],
        item: [integerChild],
      };
      const weightChange: AyuQuestion = {
        linkId: 'weight',
        type: 'choice',
        text: 'Weight change (kg)*',
        answerOption: [{ valueCoding: { code: 'loss', display: 'Weight loss' } }],
        item: [weightLoss],
      };

      const answers = {
        weight: 'loss',
        wl: 'amount',
        wl_amount: 34,
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: weightChange,
        currentIndex: 0,
        total: 1,
        answers,
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [weightChange],
        isLast: true,
      });

      render(
        <AyuStepperContainer
          questionnaire={createMockQuestionnaire([weightChange])}
          initialAnswers={answers}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByText('34')).toBeInTheDocument();
      expect(
        screen.getAllByText('[Enter amount of weight lost in kgs]')
      ).toHaveLength(1);
      expect(screen.getAllByText('Weight loss')).toHaveLength(1);
    });
  });

  describe('Auto-advance backfill effect (lines 367, 373)', () => {
    it('line 367: should skip undefined items in topLevelItems during backfill', () => {
      const questions: AyuQuestion[] = [
        { linkId: 'q1', text: 'Q1', type: 'string' },
        { linkId: 'q2', text: 'Q2', type: 'string' },
      ];

      // First render at index 0 with a short topLevelItems array (only 1 item)
      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: questions[0],
        currentIndex: 0,
        total: 2,
        answers: { q1: 'val1' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: questions,
        isLast: false,
      });

      const questionnaire = createMockQuestionnaire(questions);
      const { rerender } = render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      /*
       * Auto-advance to index 3 with topLevelItems only having 2 items.
       * The backfill loops from prev=0 to currentIndex=3 (i=0,1,2).
       * topLevelItems[2] is undefined — triggers `if (!q) continue;` at line 367.
       * The render slice(0, 4) on a 2-item array just renders [q1, q2] safely.
       */
      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: questions[1],
        currentIndex: 3,
        total: 2,
        answers: { q1: 'val1', q2: 'val2' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: questions,
        isLast: true,
      });

      rerender(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      // Should not throw — the undefined entry was safely skipped
      expect(screen.getByTestId('question-loader-0')).toBeInTheDocument();
    });

    it('line 373: should not duplicate submittedQuestions when backfilling already-submitted question', () => {
      const questions: AyuQuestion[] = [
        { linkId: 'q1', text: 'Q1', type: 'string' },
        { linkId: 'q2', text: 'Q2', type: 'string' },
        { linkId: 'q3', text: 'Q3', type: 'string' },
      ];

      // Start at index 0
      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: questions[0],
        currentIndex: 0,
        total: 3,
        answers: { q1: 'val1' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: questions,
        isLast: false,
      });

      const questionnaire = createMockQuestionnaire(questions);
      const { rerender } = render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      // Submit q1 normally
      fireEvent.click(screen.getByTestId('button-submit'));

      // Auto-advance to index 2 with q1 already submitted
      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: questions[2],
        currentIndex: 2,
        total: 3,
        answers: { q1: 'val1', q2: 'val2', q3: 'val3' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: questions,
        isLast: true,
      });

      rerender(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      /* Should not throw, backfill loops over q1 (already submitted — early return)
         and q2 (newly submitted) */
      expect(screen.getByTestId('question-loader-0')).toBeInTheDocument();
    });
  });

  describe('getRowLabel fallback to display extension (lines 54-56)', () => {
    it('should use display extension when item.text is empty', () => {
      const child: AyuQuestion = {
        linkId: 'child1',
        type: 'string',
        text: '', // empty text — triggers fallback to extension
        extension: [
          {
            url: 'https://intelehealth.org/fhir/StructureDefinition/display',
            valueString: 'Display Label',
          },
        ],
      };
      const parent: AyuQuestion = {
        linkId: 'q1',
        text: 'Parent',
        type: 'choice',
        answerOption: [{ valueCoding: { code: 'A', display: 'Option A' } }],
        item: [child],
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: { linkId: 'q2', text: 'Next', type: 'string' },
        currentIndex: 1,
        total: 2,
        answers: { q1: 'A', child1: 'child-answer' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [parent, { linkId: 'q2', text: 'Next', type: 'string' }],
        isLast: true,
      });

      render(
        <AyuStepperContainer
          questionnaire={createMockQuestionnaire([parent, { linkId: 'q2', text: 'Next', type: 'string' }])}
          initialAnswers={{ q1: 'A', child1: 'child-answer' }}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      /* getRowLabel returns 'Display Label' from extension (text is empty)
         The component renders label and value as separate elements */
      expect(screen.getByText('Display Label')).toBeInTheDocument();
      expect(screen.getByText('child-answer')).toBeInTheDocument();
    });
  });

  describe('formatAnswerValue array with non-string elements (lines 69, 71)', () => {
    it('should return null when all array elements are non-string', () => {
      const parent: AyuQuestion = {
        linkId: 'q1',
        text: 'Multi-select',
        type: 'choice',
        repeats: true,
        answerOption: [{ valueCoding: { code: 'A', display: 'Option A' } }],
        item: [
          {
            linkId: 'child1',
            type: 'choice',
            text: 'Child',
            repeats: true,
            answerOption: [{ valueCoding: { code: 'X', display: 'X opt' } }],
          },
        ],
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: { linkId: 'q2', text: 'Next', type: 'string' },
        currentIndex: 1,
        total: 2,
        // Child answer is array with non-string elements (numbers)
        answers: { q1: ['A'], child1: [42, 99] as unknown as AyuAnswerValue },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [parent, { linkId: 'q2', text: 'Next', type: 'string' }],
        isLast: true,
      });

      render(
        <AyuStepperContainer
          questionnaire={createMockQuestionnaire([parent, { linkId: 'q2', text: 'Next', type: 'string' }])}
          initialAnswers={{ q1: ['A'], child1: [42, 99] as unknown as AyuAnswerValue }}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      /* The child with all non-string array elements should not render a value row
         (formatAnswerValue returns null for values.length === 0) */
      expect(screen.queryByText('42')).not.toBeInTheDocument();
    });
  });

  describe('collectAnsweredRows enableWhen continue branch (line 110)', () => {
    it('should skip children where enableWhen evaluates to false', () => {
      const parent: AyuQuestion = {
        linkId: 'q1',
        text: 'Parent',
        type: 'choice',
        answerOption: [
          { valueCoding: { code: 'A', display: 'Option A' } },
          { valueCoding: { code: 'B', display: 'Option B' } },
        ],
        item: [
          {
            linkId: 'visible-child',
            type: 'string',
            text: 'Visible Child',
            enableWhen: [{ question: 'q1', operator: '=', answerCoding: { code: 'A' } }],
          },
          {
            linkId: 'hidden-child',
            type: 'string',
            text: 'Hidden Child',
            enableWhen: [{ question: 'q1', operator: '=', answerCoding: { code: 'B' } }],
          },
        ],
      };

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: { linkId: 'q2', text: 'Next', type: 'string' },
        currentIndex: 1,
        total: 2,
        // Parent answered 'A' so hidden-child's enableWhen (code 'B') is false
        answers: { q1: 'A', 'visible-child': 'visible-value', 'hidden-child': 'hidden-value' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [parent, { linkId: 'q2', text: 'Next', type: 'string' }],
        isLast: true,
      });

      render(
        <AyuStepperContainer
          questionnaire={createMockQuestionnaire([parent, { linkId: 'q2', text: 'Next', type: 'string' }])}
          initialAnswers={{ q1: 'A', 'visible-child': 'visible-value', 'hidden-child': 'hidden-value' }}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      // Visible child should render (label and value are in separate elements)
      expect(screen.getByText('Visible Child')).toBeInTheDocument();
      expect(screen.getByText('visible-value')).toBeInTheDocument();
      // Hidden child should be skipped (enableWhen evaluates to false)
      expect(screen.queryByText('hidden-value')).not.toBeInTheDocument();
    });
  });

  describe('AyuAnsweredDisplay labelValue without label (line 188)', () => {
    it('should render just the value when labelValue item has empty label', () => {
      const question: AyuQuestion = {
        linkId: 'as1',
        text: 'Associated symptoms',
        type: 'choice',
        repeats: true,
      };

      // Mock resolveAyuComponent to identify this as associated symptoms
      mockResolveAyuComponent.mockReturnValue('associatedSymptoms');
      mockResolveAyuComponentLogic.mockReturnValue('associatedSymptoms');
      mockIsStrictAssociatedSymptoms.mockReturnValue(false);
      mockIsStrictAssociatedSymptomsLogic.mockReturnValue(false);

      // Mock buildVisitSummary to return a labelValue item with empty label
      mockBuildVisitSummary.mockReturnValue([
        {
          title: 'Associated symptoms',
          items: [
            { type: 'labelValue' as const, label: '', value: 'Fever' },
            { type: 'labelValue' as const, label: 'Duration', value: '3 days' },
          ],
        },
      ]);

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: { linkId: 'q2', text: 'Next', type: 'string' },
        currentIndex: 1,
        total: 2,
        answers: { as1: ['fever'] },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question, { linkId: 'q2', text: 'Next', type: 'string' }],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          initialAnswers={{ as1: ['fever'] }}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      // Line 188: empty label renders just the value without colon separator
      expect(screen.getByText('Fever')).toBeInTheDocument();
      // Non-empty label renders "label: value"
      expect(screen.getByText('Duration: 3 days')).toBeInTheDocument();
    });

    it('renders a blank-value labelValue (e.g. family-history "None") without a trailing colon', () => {
      const question: AyuQuestion = {
        linkId: 'fam1',
        text: 'Do you have a family history of any of the following?',
        type: 'choice',
        repeats: true,
      };

      mockResolveAyuComponent.mockReturnValue('associatedSymptoms');
      mockResolveAyuComponentLogic.mockReturnValue('associatedSymptoms');
      mockIsStrictAssociatedSymptoms.mockReturnValue(false);
      mockIsStrictAssociatedSymptomsLogic.mockReturnValue(false);

      mockBuildVisitSummary.mockReturnValue([
        {
          title: 'Family history',
          items: [{ type: 'labelValue' as const, label: 'None', value: ' ' }],
        },
      ]);

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: { linkId: 'q2', text: 'Next', type: 'string' },
        currentIndex: 1,
        total: 2,
        answers: { fam1: ['none'] },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question, { linkId: 'q2', text: 'Next', type: 'string' }],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          initialAnswers={{ fam1: ['none'] }}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      expect(screen.getByText('None')).toBeInTheDocument();
      expect(screen.queryByText(/None\s*:/)).not.toBeInTheDocument();
    });
  });

  describe('isSingleOptionPE hides primary value for single-option PE questions', () => {
    it('should hide primary value when PE question has one regular option and one camera option', () => {
      const question: AyuQuestion = {
        linkId: 'bp-pe',
        text: 'Blood Pressure',
        type: 'choice',
        answerOption: [
          { valueCoding: { code: 'lying', display: 'Lying down' } },
          {
            valueCoding: { code: 'cam', display: 'Camera' },
            extension: [
              {
                url: 'urn:intelehealth:physical-exam/option-kind',
                valueString: 'camera',
              },
            ],
          },
        ],
        item: [
          { linkId: 'systolic', text: 'Systolic', type: 'integer' },
        ],
      };

      mockResolveAyuComponent.mockReturnValue('physicalExamOptions');
      mockResolveAyuComponentLogic.mockReturnValue('physicalExamOptions' as never);

      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: { linkId: 'q2', text: 'Next', type: 'string' },
        currentIndex: 1,
        total: 2,
        answers: { 'bp-pe': 'lying', systolic: '120' },
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question, { linkId: 'q2', text: 'Next', type: 'string' }],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          initialAnswers={{ 'bp-pe': 'lying', systolic: '120' }}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      // Primary value ("Lying down") should be hidden for single-option PE
      expect(screen.queryByText('Lying down')).not.toBeInTheDocument();
      // Nested value should still appear
      expect(screen.getByText('120')).toBeInTheDocument();
    });
  });

  describe('PE question selectable prop', () => {
    it('should pass selectable=true to AyuNestedRenderer for physicalExamOptions questions', () => {
      const question: AyuQuestion = {
        linkId: 'pe-q1',
        text: 'Lumps',
        type: 'choice',
        item: [{ linkId: 'pe-q1.child', text: 'Where', type: 'choice' }],
      };

      mockResolveAyuComponent.mockReturnValue('physicalExamOptions');
      mockResolveAyuComponentLogic.mockReturnValue('physicalExamOptions' as never);
      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: {},
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      const nestedRenderer = screen.getByTestId('nested-renderer');
      expect(nestedRenderer).toHaveAttribute('data-selectable', 'true');
    });

    it('should pass selectable=false to AyuNestedRenderer for non-PE questions', () => {
      const question: AyuQuestion = {
        linkId: 'q1',
        text: 'Normal question',
        type: 'choice',
        item: [{ linkId: 'q1.child', text: 'Detail', type: 'string' }],
      };

      mockResolveAyuComponent.mockReturnValue('selectableOptionGroup');
      mockResolveAyuComponentLogic.mockReturnValue('selectableOptionGroup');
      mockUseFHIRStepper.mockReturnValue({
        currentQuestion: question,
        currentIndex: 0,
        total: 1,
        answers: {},
        setAnswer: mockSetAnswer,
        clearAnswers: mockClearAnswers,
        goNext: mockGoNext,
        topLevelItems: [question],
        isLast: true,
      });

      const questionnaire = createMockQuestionnaire([question]);
      render(
        <AyuStepperContainer
          questionnaire={questionnaire}
          onComplete={mockOnComplete}
          onProgressUpdate={mockOnProgressUpdate}
        />
      );

      const nestedRenderer = screen.getByTestId('nested-renderer');
      expect(nestedRenderer).toHaveAttribute('data-selectable', 'false');
    });
  });
});
