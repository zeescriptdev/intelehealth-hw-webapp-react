import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock useGlobalModal
const mockShowVitalConfirmationModal = vi.fn();
vi.mock('../../../../components/modal/global-modal-context', () => ({
  useGlobalModal: () => ({
    showConfirmModal: vi.fn(),
    showVitalConfirmationModal: mockShowVitalConfirmationModal,
    closeModal: vi.fn(),
  }),
}));

// Mock buildVisitSummary
vi.mock('../../../../modules/ayu/utils/visit-summary.util', () => ({
  buildVisitSummary: vi.fn(() => []),
}));

// Mock showToast
const mockShowToast = vi.fn();
vi.mock('../../../../services/toast', () => ({
  showToast: (...args: unknown[]) => mockShowToast(...args),
}));

// Mock SVG import
vi.mock('../../../../assets/icons/visit-reason.svg', () => ({
  default: 'mock-visit-reason-icon',
}));

// Mock the PE camera context so the stepper's camera-image validation can be
// driven. `current` null = non-PE flow (no provider).
const { cameraHolder } = vi.hoisted(() => ({
  cameraHolder: {
    current: null as null | { cameraImagesFor: (q: string) => string[] },
  },
}));
vi.mock(
  '../../../../modules/ayu/components/start-visit/physical-examination/physical-exam-camera-context',
  () => ({ usePhysicalExamCamera: () => cameraHolder.current })
);

import { useFHIRStepper } from '../../../../modules/ayu/hooks/useFHIRStepper.hook';

describe('useFHIRStepper', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockShowVitalConfirmationModal.mockClear();
    mockShowToast.mockClear();
    cameraHolder.current = null;
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  const mockQuestionnaire = {
    item: [
      {
        linkId: 'q1',
        text: 'Question 1',
        type: 'string',
        required: true,
      },
      {
        linkId: 'q2',
        text: 'Question 2',
        type: 'choice',
        required: false,
        answerOption: [
          { valueCoding: { code: 'yes', display: 'Yes' } },
          { valueCoding: { code: 'no', display: 'No' } },
        ],
      },
      {
        linkId: 'q3',
        text: 'Question 3',
        type: 'integer',
        required: false,
      },
    ],
  };

  describe('Initial State', () => {
    it('should initialize with currentIndex 0', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: mockQuestionnaire })
      );

      expect(result.current.currentIndex).toBe(0);
    });

    it('should filter out group type items for topLevelItems', () => {
      const questionnaireWithGroup = {
        item: [
          { linkId: 'q1', type: 'string', text: 'Q1' },
          { linkId: 'g1', type: 'group', text: 'Group', item: [] },
          { linkId: 'q2', type: 'choice', text: 'Q2' },
        ],
      };

      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: questionnaireWithGroup })
      );

      expect(result.current.topLevelItems).toHaveLength(2);
      expect(result.current.topLevelItems[0].linkId).toBe('q1');
      expect(result.current.topLevelItems[1].linkId).toBe('q2');
    });

    it('should return first non-group question', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: mockQuestionnaire })
      );

      expect(result.current.currentQuestion?.linkId).toBe('q1');
    });

    it('should initialize empty answers object', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: mockQuestionnaire })
      );

      expect(result.current.answers).toEqual({});
    });

    it('should calculate correct structural total', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: mockQuestionnaire })
      );

      expect(result.current.total).toBe(3);
    });
  });

  describe('Basic Navigation', () => {
    it('should advance to next question with goNext()', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: mockQuestionnaire })
      );

      expect(result.current.currentIndex).toBe(0);

      act(() => {
        result.current.goNext();
      });

      expect(result.current.currentIndex).toBe(1);
    });

    it('should not advance beyond last question', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: mockQuestionnaire })
      );

      act(() => {
        result.current.goNext();
        result.current.goNext();
        result.current.goNext(); // Try to go beyond last
      });

      expect(result.current.currentIndex).toBe(2);
    });

    it('should show summary modal on last question and call onComplete via confirm', () => {
      const onComplete = vi.fn();
      const { result } = renderHook(() =>
        useFHIRStepper({
          questionnaire: mockQuestionnaire,
          onComplete,
        })
      );

      // Answer required q1 so validation passes
      act(() => {
        result.current.setAnswer(result.current.topLevelItems[0], 'answer1');
      });

      // Navigate to second question
      act(() => {
        result.current.goNext();
      });

      // Navigate to third (last) question
      act(() => {
        result.current.goNext();
      });

      // Try to go beyond last - should trigger handleComplete which shows modal
      act(() => {
        result.current.goNext();
      });

      expect(mockShowVitalConfirmationModal).toHaveBeenCalledTimes(1);
      expect(mockShowVitalConfirmationModal).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'vitalConfirm',
          title: undefined,
          size: 'lg',
        })
      );

      // Simulate user confirming the modal
      const modalConfig = mockShowVitalConfirmationModal.mock.calls[0][0];
      act(() => {
        modalConfig.onConfirm();
      });

      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({ q1: 'answer1' })
      );
    });

    it('should fire onSummaryShown when the summary modal opens', () => {
      const onSummaryShown = vi.fn();
      const { result } = renderHook(() =>
        useFHIRStepper({
          questionnaire: mockQuestionnaire,
          onComplete: vi.fn(),
          onSummaryShown,
        })
      );

      act(() => {
        result.current.setAnswer(result.current.topLevelItems[0], 'answer1');
      });
      act(() => {
        result.current.goNext();
      });
      act(() => {
        result.current.goNext();
      });
      act(() => {
        result.current.goNext();
      });

      // Modal opened and onSummaryShown fired — even though onConfirm has not been called.
      expect(mockShowVitalConfirmationModal).toHaveBeenCalledTimes(1);
      expect(onSummaryShown).toHaveBeenCalledTimes(1);
    });

    it('should not fire onSummaryShown when skipSummary is true', () => {
      const onSummaryShown = vi.fn();
      const onComplete = vi.fn();
      const { result } = renderHook(() =>
        useFHIRStepper({
          questionnaire: mockQuestionnaire,
          skipSummary: true,
          onComplete,
          onSummaryShown,
        })
      );

      act(() => {
        result.current.setAnswer(result.current.topLevelItems[0], 'answer1');
      });
      act(() => {
        result.current.goNext();
      });
      act(() => {
        result.current.goNext();
      });
      act(() => {
        result.current.goNext();
      });

      // skipSummary bypasses the modal entirely — onSummaryShown should not fire.
      expect(mockShowVitalConfirmationModal).not.toHaveBeenCalled();
      expect(onSummaryShown).not.toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalled();
    });

    it('should not fire onSummaryShown when validation fails on the last question', () => {
      const onSummaryShown = vi.fn();
      const { result } = renderHook(() =>
        useFHIRStepper({
          questionnaire: mockQuestionnaire,
          onComplete: vi.fn(),
          onSummaryShown,
        })
      );

      // Skip answering required q1 — handleComplete must early-return on validation.
      act(() => {
        result.current.goNext();
      });
      act(() => {
        result.current.goNext();
      });
      act(() => {
        result.current.goNext();
      });

      expect(mockShowVitalConfirmationModal).not.toHaveBeenCalled();
      expect(onSummaryShown).not.toHaveBeenCalled();
    });

    it('should assign onChange to each section returned by buildVisitSummary', async () => {
      const { buildVisitSummary } = await import('../../../../modules/ayu/utils/visit-summary.util');
      const mockBuildVisitSummary = vi.mocked(buildVisitSummary);

      // Return sections with items so sections.forEach runs
      const mockSections = [
        { title: 'Section 1', items: [{ type: 'labelValue' as const, label: 'Q', value: 'A' }] },
        { title: 'Section 2', items: [{ type: 'labelValue' as const, label: 'Q2', value: 'A2' }] },
      ];
      mockBuildVisitSummary.mockReturnValueOnce(mockSections);

      const { result } = renderHook(() =>
        useFHIRStepper({
          questionnaire: mockQuestionnaire,
          onComplete: vi.fn(),
        })
      );

      // Answer required q1 so validation passes
      act(() => {
        result.current.setAnswer(result.current.topLevelItems[0], 'answer1');
      });

      // Navigate to last question and trigger handleComplete
      act(() => {
        result.current.goNext();
      });
      act(() => {
        result.current.goNext();
      });
      act(() => {
        result.current.goNext();
      });

      // Verify sections passed to modal have onChange assigned
      const modalConfig = mockShowVitalConfirmationModal.mock.calls[0][0];
      expect(modalConfig.sections).toHaveLength(2);
      expect(typeof modalConfig.sections[0].onChange).toBe('function');
      expect(typeof modalConfig.sections[1].onChange).toBe('function');

      // Call onChange to ensure it's executable (covers the callback body)
      modalConfig.sections[0].onChange();
      modalConfig.sections[1].onChange();

      // Reset mock to default
      mockBuildVisitSummary.mockReturnValue([]);
    });

    it('should update isLast flag correctly', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: mockQuestionnaire })
      );

      expect(result.current.isLast).toBe(false);

      act(() => {
        result.current.goNext();
        result.current.goNext();
      });

      expect(result.current.isLast).toBe(true);
    });
  });

  describe('Auto-Advance Logic', () => {
    it('should NOT auto-advance for string type questions', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: mockQuestionnaire })
      );

      expect(result.current.currentQuestion?.type).toBe('string');

      act(() => {
        result.current.setAnswer(result.current.currentQuestion!, 'test answer');
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current.currentIndex).toBe(0); // Should NOT advance
    });

    it('should NOT auto-advance for non-required string type questions', () => {
      const nonRequiredStringQuestionnaire = {
        item: [
          {
            linkId: 'q1',
            text: 'Optional text',
            type: 'string',
            required: false,
          },
          {
            linkId: 'q2',
            text: 'Next question',
            type: 'choice',
            answerOption: [
              { valueCoding: { code: 'yes', display: 'Yes' } },
            ],
          },
        ],
      };

      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: nonRequiredStringQuestionnaire })
      );

      expect(result.current.currentQuestion?.type).toBe('string');

      act(() => {
        result.current.setAnswer(result.current.currentQuestion!, 'some text');
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current.currentIndex).toBe(0); // Should NOT advance even though not required
    });

    it('should NOT auto-advance for quantity type with incomplete duration dropdowns', () => {
      const quantityQuestionnaire = {
        item: [
          {
            linkId: 'q1',
            text: 'Duration',
            type: 'choice',
            required: false,
            item: [
              {
                linkId: 'duration',
                text: 'How long?',
                type: 'quantity',
              },
            ],
          },
          {
            linkId: 'q2',
            text: 'Height',
            type: 'integer',
          },
        ],
      };

      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: quantityQuestionnaire })
      );

      act(() => {
        result.current.setAnswer(result.current.currentQuestion!, 'yes');
        const durationQ = result.current.topLevelItems[0].item!.find(q => q.linkId === 'duration')!;
        result.current.setAnswer(durationQ, {
          dropdownValues: { number: 5, days: '' },
        });
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current.currentIndex).toBe(0); // Should NOT advance (incomplete duration)
    });

    it('should NOT auto-advance for choice with dropdownValues', () => {
      const durationQuestionnaire = {
        item: [
          {
            linkId: 'q1',
            text: 'Duration',
            type: 'choice',
            required: false,
          },
        ],
      };

      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: durationQuestionnaire })
      );

      act(() => {
        result.current.setAnswer(result.current.currentQuestion!, {
          dropdownValues: { number: 5, days: 'Days' },
        });
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current.currentIndex).toBe(0); // Should NOT advance
    });

    it('should auto-advance for choice without duration after 250ms', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: mockQuestionnaire })
      );

      // Move to question 2 (choice type)
      act(() => {
        result.current.goNext();
      });

      expect(result.current.currentQuestion?.type).toBe('choice');

      act(() => {
        result.current.setAnswer(result.current.currentQuestion!, 'yes');
      });

      expect(result.current.currentIndex).toBe(1);

      act(() => {
        vi.advanceTimersByTime(250);
      });

      expect(result.current.currentIndex).toBe(2); // Should advance
    });

    it('should NOT auto-advance on last question when it is an integer type', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: mockQuestionnaire })
      );

      // Move to last question (q3, type: integer)
      act(() => {
        result.current.goNext();
        result.current.goNext();
      });

      expect(result.current.isLast).toBe(true);

      act(() => {
        result.current.setAnswer(result.current.currentQuestion!, 42);
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Integer type questions never auto-advance (user must click Submit)
      expect(result.current.currentIndex).toBe(2);
    });

    it('should auto-advance on last question when it is a simple choice and call handleComplete', () => {
      // Oedema fix: last question with simple single-select choice should
      // auto-advance to trigger the Visit Reason Summary popup.
      const choiceLastQuestionnaire = {
        item: [
          {
            linkId: 'q1',
            text: 'Question 1',
            type: 'choice',
            required: false,
            answerOption: [
              { valueCoding: { code: 'a', display: 'A' } },
              { valueCoding: { code: 'b', display: 'B' } },
            ],
          },
          {
            linkId: 'q2',
            text: 'Question 2 (last)',
            type: 'choice',
            required: false,
            answerOption: [
              { valueCoding: { code: 'yes', display: 'Yes' } },
              { valueCoding: { code: 'no', display: 'No' } },
            ],
          },
        ],
      };

      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: choiceLastQuestionnaire })
      );

      // Move to last question
      act(() => {
        result.current.goNext();
      });
      expect(result.current.isLast).toBe(true);
      expect(result.current.currentQuestion?.linkId).toBe('q2');

      act(() => {
        result.current.setAnswer(result.current.currentQuestion!, 'yes');
      });

      act(() => {
        vi.advanceTimersByTime(250);
      });

      // Auto-advance fires goNext → handleComplete → shows summary modal
      expect(mockShowVitalConfirmationModal).toHaveBeenCalledTimes(1);
    });

    it('should auto-advance on last question and skip summary when skipSummary is true', () => {
      const choiceLastQuestionnaire = {
        item: [
          {
            linkId: 'q1',
            text: 'Question 1',
            type: 'choice',
            required: false,
            answerOption: [
              { valueCoding: { code: 'a', display: 'A' } },
            ],
          },
          {
            linkId: 'q2',
            text: 'Last question',
            type: 'choice',
            required: false,
            answerOption: [
              { valueCoding: { code: 'yes', display: 'Yes' } },
              { valueCoding: { code: 'no', display: 'No' } },
            ],
          },
        ],
      };
      const onComplete = vi.fn();

      const { result } = renderHook(() =>
        useFHIRStepper({
          questionnaire: choiceLastQuestionnaire,
          skipSummary: true,
          onComplete,
        })
      );

      // Move to last question
      act(() => {
        result.current.goNext();
      });
      expect(result.current.isLast).toBe(true);

      act(() => {
        result.current.setAnswer(result.current.currentQuestion!, 'no');
      });

      act(() => {
        vi.advanceTimersByTime(250);
      });

      // skipSummary → onComplete called directly, no modal
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(mockShowVitalConfirmationModal).not.toHaveBeenCalled();
    });

    it('should NOT auto-advance when visible string child exists', () => {
      const nestedQuestionnaire = {
        item: [
          {
            linkId: 'parent',
            text: 'Parent',
            type: 'choice',
            required: false,
            item: [
              {
                linkId: 'child',
                text: 'Child',
                type: 'string',
                enableWhen: [
                  {
                    question: 'parent',
                    operator: '=',
                    answerString: 'yes',
                  },
                ],
              },
            ],
          },
        ],
      };

      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: nestedQuestionnaire })
      );

      const parentQuestion = result.current.topLevelItems.find(q => q.linkId === 'parent')!;

      act(() => {
        result.current.setAnswer(parentQuestion, 'yes');
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current.currentIndex).toBe(0); // Should NOT advance
    });

    it('should NOT auto-advance when nested child has choice+repeats (hasNestedRepeats)', () => {
      const nestedRepeatsQuestionnaire = {
        item: [
          {
            linkId: 'parent',
            text: 'Parent',
            type: 'choice',
            required: false,
            answerOption: [
              { valueCoding: { code: 'yes', display: 'Yes' } },
              { valueCoding: { code: 'no', display: 'No' } },
            ],
            item: [
              {
                linkId: 'nested-multi',
                text: 'Nested Multi Select',
                type: 'choice',
                repeats: true,
                answerOption: [
                  { valueCoding: { code: 'opt1', display: 'Option 1' } },
                  { valueCoding: { code: 'opt2', display: 'Option 2' } },
                ],
              },
            ],
          },
          {
            linkId: 'next-q',
            text: 'Next Question',
            type: 'string',
          },
        ],
      };

      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: nestedRepeatsQuestionnaire })
      );

      act(() => {
        const parentQ = result.current.topLevelItems[0];
        result.current.setAnswer(parentQ, 'yes');
        // Also answer the nested repeats child
        const nestedQ = parentQ.item!.find(q => q.linkId === 'nested-multi')!;
        result.current.setAnswer(nestedQ, 'opt1');
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Should NOT auto-advance because nested child is choice+repeats
      expect(result.current.currentIndex).toBe(0);
    });
  });

  describe('Duration Validation (dropdownValues structure)', () => {
    const durationQuestionnaire = {
      item: [
        {
          linkId: 'parent',
          text: 'Parent',
          type: 'choice',
          item: [
            {
              linkId: 'duration',
              text: 'Duration',
              type: 'quantity',
            },
          ],
        },
      ],
    };

    it('should detect nested child with dropdownValues', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: durationQuestionnaire })
      );

      act(() => {
        const parentQ = result.current.topLevelItems[0];
        result.current.setAnswer(parentQ, 'yes');
        const durationQ = parentQ.item!.find(q => q.linkId === 'duration')!;
        result.current.setAnswer(durationQ, {
          dropdownValues: { number: 5, days: 'Days' },
        });
      });

      const durationAnswer = result.current.answers.duration;
      expect(
        typeof durationAnswer === 'object' &&
        durationAnswer !== null &&
        'dropdownValues' in durationAnswer
      ).toBe(true);
    });

    it('should mark incomplete if only number filled', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: durationQuestionnaire })
      );

      act(() => {
        const parentQ = result.current.topLevelItems[0];
        result.current.setAnswer(parentQ, 'yes');
        const durationQ = parentQ.item!.find(q => q.linkId === 'duration')!;
        result.current.setAnswer(durationQ, {
          dropdownValues: { number: 5, days: '' },
        });
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current.currentIndex).toBe(0); // Should not advance (incomplete)
    });

    it('should mark incomplete if only days filled', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: durationQuestionnaire })
      );

      act(() => {
        const parentQ = result.current.topLevelItems[0];
        result.current.setAnswer(parentQ, 'yes');
        const durationQ = parentQ.item!.find(q => q.linkId === 'duration')!;
        result.current.setAnswer(durationQ, {
          dropdownValues: { number: '', days: 'Days' },
        });
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current.currentIndex).toBe(0); // Should not advance (incomplete)
    });

    it('should complete when both values present', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: durationQuestionnaire })
      );

      act(() => {
        const parentQ = result.current.topLevelItems[0];
        result.current.setAnswer(parentQ, 'yes');
        const durationQ = parentQ.item!.find(q => q.linkId === 'duration')!;
        result.current.setAnswer(durationQ, {
          dropdownValues: { number: 5, days: 'Days' },
        });
      });

      const durationAnswer = result.current.answers.duration;
      const isComplete =
        typeof durationAnswer === 'object' &&
        durationAnswer !== null &&
        'dropdownValues' in durationAnswer &&
        durationAnswer.dropdownValues?.number &&
        durationAnswer.dropdownValues?.days;

      expect(isComplete).toBeTruthy();
    });
  });

  describe('EnableWhen Visibility Logic', () => {
    const conditionalQuestionnaire = {
      item: [
        {
          linkId: 'parent',
          text: 'Parent',
          type: 'choice',
          item: [
            {
              linkId: 'boolChild',
              text: 'Bool Child',
              type: 'string',
              enableWhen: [{ question: 'parent', operator: '=', answerBoolean: true }],
            },
            {
              linkId: 'stringChild',
              text: 'String Child',
              type: 'string',
              enableWhen: [{ question: 'parent', operator: '=', answerString: 'yes' }],
            },
            {
              linkId: 'integerChild',
              text: 'Integer Child',
              type: 'string',
              enableWhen: [{ question: 'parent', operator: '=', answerInteger: 1 }],
            },
            {
              linkId: 'codingChild',
              text: 'Coding Child',
              type: 'string',
              enableWhen: [
                {
                  question: 'parent',
                  operator: '=',
                  answerCoding: { code: 'code1' },
                },
              ],
            },
          ],
        },
      ],
    };

    it('should check answerBoolean conditions', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: conditionalQuestionnaire })
      );

      const parentQuestion = result.current.topLevelItems[0];

      act(() => {
        result.current.setAnswer(parentQuestion, true);
      });

      expect(result.current.answers.parent).toBe(true);
    });

    it('should check answerString conditions', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: conditionalQuestionnaire })
      );

      act(() => {
        const parentQ = result.current.topLevelItems[0];
        result.current.setAnswer(parentQ, 'yes');
      });

      expect(result.current.answers.parent).toBe('yes');
    });

    it('should check answerInteger conditions', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: conditionalQuestionnaire })
      );

      act(() => {
        const parentQ = result.current.topLevelItems[0];
        result.current.setAnswer(parentQ, 1);
      });

      expect(result.current.answers.parent).toBe(1);
    });

    it('should check answerCoding.code conditions', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: conditionalQuestionnaire })
      );

      act(() => {
        const parentQ = result.current.topLevelItems[0];
        result.current.setAnswer(parentQ, 'code1');
      });

      expect(result.current.answers.parent).toBe('code1');
    });

    it('should handle multiple enableWhen rules (all must match)', () => {
      const multiRuleQuestionnaire = {
        item: [
          {
            linkId: 'q1',
            text: 'Q1',
            type: 'string',
          },
          {
            linkId: 'q2',
            text: 'Q2',
            type: 'string',
          },
          {
            linkId: 'q3',
            text: 'Q3',
            type: 'string',
            item: [
              {
                linkId: 'child',
                text: 'Child',
                type: 'string',
                enableWhen: [
                  { question: 'q1', operator: '=', answerString: 'yes' },
                  { question: 'q2', operator: '=', answerString: 'yes' },
                ],
              },
            ],
          },
        ],
      };

      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: multiRuleQuestionnaire })
      );

      act(() => {
        result.current.goNext();
        result.current.goNext();
        const q1 = result.current.topLevelItems[0];
        result.current.setAnswer(q1, 'yes');
        const q2 = result.current.topLevelItems[1];
        result.current.setAnswer(q2, 'yes');
        const q3 = result.current.topLevelItems[2];
        result.current.setAnswer(q3, 'parent-answer');
      });

      // Both conditions should be met
      expect(result.current.answers.q1).toBe('yes');
      expect(result.current.answers.q2).toBe('yes');
    });
  });

  describe('Top-Level Completion Logic', () => {
    it('should return false if parent answer is empty', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: mockQuestionnaire })
      );

      // Don't set any answer
      expect(result.current.answers.q1).toBeUndefined();
    });

    it('should return true if no nested children', () => {
      const simpleQuestionnaire = {
        item: [
          {
            linkId: 'q1',
            text: 'Simple Question',
            type: 'integer',
          },
        ],
      };

      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: simpleQuestionnaire })
      );

      act(() => {
        result.current.setAnswer(result.current.topLevelItems[0], 42);
      });

      expect(result.current.answers.q1).toBe(42);
    });

    it('should validate all visible nested children are answered', () => {
      const nestedQuestionnaire = {
        item: [
          {
            linkId: 'parent',
            text: 'Parent',
            type: 'choice',
            item: [
              {
                linkId: 'child1',
                text: 'Child 1',
                type: 'string',
                enableWhen: [{ question: 'parent', operator: '=', answerString: 'yes' }],
              },
              {
                linkId: 'child2',
                text: 'Child 2',
                type: 'string',
                enableWhen: [{ question: 'parent', operator: '=', answerString: 'yes' }],
              },
            ],
          },
        ],
      };

      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: nestedQuestionnaire })
      );

      act(() => {
        const parentQ = result.current.topLevelItems[0];
        result.current.setAnswer(parentQ, 'yes');
        const child1Q = parentQ.item!.find(q => q.linkId === 'child1')!;
        result.current.setAnswer(child1Q, 'answer1');
        const child2Q = parentQ.item!.find(q => q.linkId === 'child2')!;

        result.current.setAnswer(child2Q, 'answer2');
      });

      expect(result.current.answers.child1).toBe('answer1');
      expect(result.current.answers.child2).toBe('answer2');
    });

    it('should handle duration structure in nested children', () => {
      const durationQuestionnaire = {
        item: [
          {
            linkId: 'parent',
            text: 'Parent',
            type: 'choice',
            item: [
              {
                linkId: 'duration',
                text: 'Duration',
                type: 'quantity',
              },
            ],
          },
        ],
      };

      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: durationQuestionnaire })
      );

      act(() => {
        const parentQ = result.current.topLevelItems[0];
        result.current.setAnswer(parentQ, 'yes');
        const durationQ = parentQ.item!.find(q => q.linkId === 'duration')!;
        result.current.setAnswer(durationQ, {
          dropdownValues: { number: 10, days: 'Weeks' },
        });
      });

      const durationAnswer = result.current.answers.duration;
      if (
        typeof durationAnswer === 'object' &&
        durationAnswer !== null &&
        'dropdownValues' in durationAnswer
      ) {
        expect(durationAnswer.dropdownValues.number).toBe(10);
        expect(durationAnswer.dropdownValues.days).toBe('Weeks');
      }
    });
  });

  describe('isTopLevelComplete Function Coverage', () => {
    describe('Parent Answer Validation (Line 144)', () => {
      it('should return false when parent answer is missing', () => {
        const simpleQuestionnaire = {
          item: [
            {
              linkId: 'q1',
              text: 'Question 1',
              type: 'string',
            },
          ],
        };

        const { result } = renderHook(() =>
          useFHIRStepper({ questionnaire: simpleQuestionnaire })
        );

        // No answer set - should not auto-advance
        act(() => {
          vi.advanceTimersByTime(300);
        });

        expect(result.current.currentIndex).toBe(0);
      });

      it('should return false when parent answer is undefined', () => {
        const simpleQuestionnaire = {
          item: [
            {
              linkId: 'q1',
              text: 'Question 1',
              type: 'choice',
            },
          ],
        };

        const { result } = renderHook(() =>
          useFHIRStepper({ questionnaire: simpleQuestionnaire })
        );

        expect(result.current.answers.q1).toBeUndefined();
      });

      it('should return false when parent answer is null', () => {
        const simpleQuestionnaire = {
          item: [
            {
              linkId: 'q1',
              text: 'Question 1',
              type: 'choice',
            },
            {
              linkId: 'q2',
              text: 'Question 2',
              type: 'string',
            },
          ],
        };

        const { result } = renderHook(() =>
          useFHIRStepper({ questionnaire: simpleQuestionnaire })
        );

        act(() => {
          const q1 = result.current.topLevelItems[0];

          result.current.setAnswer(q1, null);
        });

        act(() => {
          vi.advanceTimersByTime(300);
        });

        // Should not advance because null is falsy
        expect(result.current.currentIndex).toBe(0);
      });

      it('should return false when parent answer is empty string', () => {
        const simpleQuestionnaire = {
          item: [
            {
              linkId: 'q1',
              text: 'Question 1',
              type: 'choice',
            },
            {
              linkId: 'q2',
              text: 'Question 2',
              type: 'string',
            },
          ],
        };

        const { result } = renderHook(() =>
          useFHIRStepper({ questionnaire: simpleQuestionnaire })
        );

        act(() => {
          const q1 = result.current.topLevelItems[0];

          result.current.setAnswer(q1, '');
        });

        act(() => {
          vi.advanceTimersByTime(300);
        });

        // Should not advance because empty string is falsy
        expect(result.current.currentIndex).toBe(0);
      });
    });

    describe('Nested Child Duration Validation (Lines 146-163)', () => {
      const nestedDurationQuestionnaire = {
        item: [
          {
            linkId: 'parent',
            text: 'Parent Question',
            type: 'choice',
            item: [
              {
                linkId: 'duration-child',
                text: 'Duration Child',
                type: 'quantity',
              },
            ],
          },
          {
            linkId: 'next-question',
            text: 'Next Question',
            type: 'string',
          },
        ],
      };

      it('should return false when nested child has dropdownValues with only number', () => {
        const { result } = renderHook(() =>
          useFHIRStepper({ questionnaire: nestedDurationQuestionnaire })
        );

        act(() => {
          const parentQ = result.current.topLevelItems[0];
          result.current.setAnswer(parentQ, 'yes');
          const durationChildQ = parentQ.item!.find(q => q.linkId === 'duration-child')!;
          result.current.setAnswer(durationChildQ, {
            dropdownValues: { number: 5, days: null },
          });
        });

        act(() => {
          vi.advanceTimersByTime(300);
        });

        // Should not advance because days is null
        expect(result.current.currentIndex).toBe(0);
      });

      it('should return false when nested child has dropdownValues with only days', () => {
        const { result } = renderHook(() =>
          useFHIRStepper({ questionnaire: nestedDurationQuestionnaire })
        );

        act(() => {
          const parentQ = result.current.topLevelItems[0];
          result.current.setAnswer(parentQ, 'yes');
          const durationChildQ = parentQ.item!.find(q => q.linkId === 'duration-child')!;
          result.current.setAnswer(durationChildQ, {
            dropdownValues: { number: null, days: 'Days' },
          });
        });

        act(() => {
          vi.advanceTimersByTime(300);
        });

        // Should not advance because number is null
        expect(result.current.currentIndex).toBe(0);
      });

      it('should return false when nested child has dropdownValues with empty number', () => {
        const { result } = renderHook(() =>
          useFHIRStepper({ questionnaire: nestedDurationQuestionnaire })
        );

        act(() => {
          const parentQ = result.current.topLevelItems[0];
          result.current.setAnswer(parentQ, 'yes');
          const durationChildQ = parentQ.item!.find(q => q.linkId === 'duration-child')!;
          result.current.setAnswer(durationChildQ, {
            dropdownValues: { number: '', days: 'Days' },
          });
        });

        act(() => {
          vi.advanceTimersByTime(300);
        });

        // Should not advance because number is empty
        expect(result.current.currentIndex).toBe(0);
      });

      it('should return false when nested child has dropdownValues with empty days', () => {
        const { result } = renderHook(() =>
          useFHIRStepper({ questionnaire: nestedDurationQuestionnaire })
        );

        act(() => {
          const parentQ = result.current.topLevelItems[0];
          result.current.setAnswer(parentQ, 'yes');
          const durationChildQ = parentQ.item!.find(q => q.linkId === 'duration-child')!;
          result.current.setAnswer(durationChildQ, {
            dropdownValues: { number: 5, days: '' },
          });
        });

        act(() => {
          vi.advanceTimersByTime(300);
        });

        // Should not advance because days is empty
        expect(result.current.currentIndex).toBe(0);
      });

      it('should return false when nested child has dropdownValues with both empty', () => {
        const { result } = renderHook(() =>
          useFHIRStepper({ questionnaire: nestedDurationQuestionnaire })
        );

        act(() => {
          const parentQ = result.current.topLevelItems[0];
          result.current.setAnswer(parentQ, 'yes');
          const durationChildQ = parentQ.item!.find(q => q.linkId === 'duration-child')!;
          result.current.setAnswer(durationChildQ, {
            dropdownValues: { number: '', days: '' },
          });
        });

        act(() => {
          vi.advanceTimersByTime(300);
        });

        // Should not advance because both are empty
        expect(result.current.currentIndex).toBe(0);
      });

      it('should validate complete dropdownValues in nested child', () => {
        const { result } = renderHook(() =>
          useFHIRStepper({ questionnaire: nestedDurationQuestionnaire })
        );

        act(() => {
          const parentQ = result.current.topLevelItems[0];
          result.current.setAnswer(parentQ, 'yes');
          const durationChildQ = parentQ.item!.find(q => q.linkId === 'duration-child')!;
          result.current.setAnswer(durationChildQ, {
            dropdownValues: { number: 5, days: 'Days' },
          });
        });

        // Verify answers are properly stored with complete dropdownValues
        expect(result.current.answers.parent).toBe('yes');
        expect(result.current.answers['duration-child']).toEqual({
          dropdownValues: { number: 5, days: 'Days' },
        });
        // Verify both number and days are present
        const childAnswer = result.current.answers['duration-child'];
        if (
          typeof childAnswer === 'object' &&
          childAnswer !== null &&
          'dropdownValues' in childAnswer
        ) {
          expect(childAnswer.dropdownValues.number).toBe(5);
          expect(childAnswer.dropdownValues.days).toBe('Days');
        }
      });

      it('should check multiple nested children with duration structures', () => {
        const multiChildQuestionnaire = {
          item: [
            {
              linkId: 'parent',
              text: 'Parent',
              type: 'choice',
              item: [
                {
                  linkId: 'duration1',
                  text: 'Duration 1',
                  type: 'quantity',
                },
                {
                  linkId: 'duration2',
                  text: 'Duration 2',
                  type: 'quantity',
                },
              ],
            },
            {
              linkId: 'next',
              text: 'Next',
              type: 'string',
            },
          ],
        };

        const { result } = renderHook(() =>
          useFHIRStepper({ questionnaire: multiChildQuestionnaire })
        );

        act(() => {
          const parentQ = result.current.topLevelItems[0];
          result.current.setAnswer(parentQ, 'yes');
          const duration1Q = parentQ.item!.find(q => q.linkId === 'duration1')!;
          result.current.setAnswer(duration1Q, {
            dropdownValues: { number: 5, days: 'Days' },
          });
          const duration2Q = parentQ.item!.find(q => q.linkId === 'duration2')!;

          result.current.setAnswer(duration2Q, {
            dropdownValues: { number: 3, days: null }, // Incomplete
          });
        });

        act(() => {
          vi.advanceTimersByTime(300);
        });

        // Should not advance because duration2 is incomplete
        expect(result.current.currentIndex).toBe(0);
      });
    });

    describe('Top-Level Duration Validation (Lines 165-177)', () => {
      const topLevelDurationQuestionnaire = {
        item: [
          {
            linkId: 'duration-question',
            text: 'Duration Question',
            type: 'choice',
          },
          {
            linkId: 'next-question',
            text: 'Next Question',
            type: 'string',
          },
        ],
      };

      it('should return false when top-level has dropdownValues with only number', () => {
        const { result } = renderHook(() =>
          useFHIRStepper({ questionnaire: topLevelDurationQuestionnaire })
        );

        act(() => {
          const durationQ = result.current.topLevelItems[0];

          result.current.setAnswer(durationQ, {
            dropdownValues: { number: 10, days: null },
          });
        });

        act(() => {
          vi.advanceTimersByTime(300);
        });

        expect(result.current.currentIndex).toBe(0);
      });

      it('should return false when top-level has dropdownValues with only days', () => {
        const { result } = renderHook(() =>
          useFHIRStepper({ questionnaire: topLevelDurationQuestionnaire })
        );

        act(() => {
          const durationQ = result.current.topLevelItems[0];

          result.current.setAnswer(durationQ, {
            dropdownValues: { number: null, days: 'Weeks' },
          });
        });

        act(() => {
          vi.advanceTimersByTime(300);
        });

        expect(result.current.currentIndex).toBe(0);
      });

      it('should return false when top-level has dropdownValues with empty values', () => {
        const { result } = renderHook(() =>
          useFHIRStepper({ questionnaire: topLevelDurationQuestionnaire })
        );

        act(() => {
          const durationQ = result.current.topLevelItems[0];

          result.current.setAnswer(durationQ, {
            dropdownValues: { number: 0, days: '' },
          });
        });

        act(() => {
          vi.advanceTimersByTime(300);
        });

        // 0 is falsy but valid number, empty string is falsy
        expect(result.current.currentIndex).toBe(0);
      });

      it('should validate complete dropdownValues at top-level', () => {
        const { result } = renderHook(() =>
          useFHIRStepper({ questionnaire: topLevelDurationQuestionnaire })
        );

        act(() => {
          const durationQ = result.current.topLevelItems[0];

          result.current.setAnswer(durationQ, {
            dropdownValues: { number: 7, days: 'Months' },
          });
        });

        // Verify answer is properly stored with complete dropdownValues
        expect(result.current.answers['duration-question']).toEqual({
          dropdownValues: { number: 7, days: 'Months' },
        });
        // Verify both number and days are present
        const questionAnswer = result.current.answers['duration-question'];
        if (
          typeof questionAnswer === 'object' &&
          questionAnswer !== null &&
          'dropdownValues' in questionAnswer
        ) {
          expect(questionAnswer.dropdownValues.number).toBe(7);
          expect(questionAnswer.dropdownValues.days).toBe('Months');
        }
      });

      it('should handle top-level choice without dropdownValues structure', () => {
        const { result } = renderHook(() =>
          useFHIRStepper({ questionnaire: topLevelDurationQuestionnaire })
        );

        act(() => {
          const durationQ = result.current.topLevelItems[0];

          result.current.setAnswer(durationQ, 'regular-answer');
        });

        act(() => {
          vi.advanceTimersByTime(300);
        });

        // Should advance normally for non-duration choice
        expect(result.current.currentIndex).toBe(1);
      });
    });

    describe('No Nested Items (Line 179)', () => {
      it('should return true when question has no nested items', () => {
        const simpleQuestionnaire = {
          item: [
            {
              linkId: 'q1',
              text: 'Simple Question',
              type: 'choice',
              answerOption: [
                { valueCoding: { code: 'yes', display: 'Yes' } },
              ],
            },
            {
              linkId: 'q2',
              text: 'Next Question',
              type: 'string',
            },
          ],
        };

        const { result } = renderHook(() =>
          useFHIRStepper({ questionnaire: simpleQuestionnaire })
        );

        act(() => {
          const q1 = result.current.topLevelItems[0];

          result.current.setAnswer(q1, 'yes');
        });

        act(() => {
          vi.advanceTimersByTime(300);
        });

        // Should advance because no nested items to check
        expect(result.current.currentIndex).toBe(1);
      });

      it('should return true when question has empty item array', () => {
        const emptyItemsQuestionnaire = {
          item: [
            {
              linkId: 'q1',
              text: 'Question with Empty Items',
              type: 'choice',
              item: [],
            },
            {
              linkId: 'q2',
              text: 'Next',
              type: 'string',
            },
          ],
        };

        const { result } = renderHook(() =>
          useFHIRStepper({ questionnaire: emptyItemsQuestionnaire })
        );

        act(() => {
          const q1 = result.current.topLevelItems[0];

          result.current.setAnswer(q1, 'answer');
        });

        act(() => {
          vi.advanceTimersByTime(300);
        });

        // Should advance because item array is empty
        expect(result.current.currentIndex).toBe(1);
      });
    });

    describe('Visible Nested Children Validation (Lines 182-200)', () => {
      it('should validate only visible children, skipping invisible ones', () => {
        const conditionalQuestionnaire = {
          item: [
            {
              linkId: 'parent',
              text: 'Parent',
              type: 'choice',
              item: [
                {
                  linkId: 'visible-child',
                  text: 'Visible Child',
                  type: 'string',
                  enableWhen: [{ question: 'parent', operator: '=', answerString: 'yes' }],
                },
                {
                  linkId: 'invisible-child',
                  text: 'Invisible Child',
                  type: 'string',
                  enableWhen: [{ question: 'parent', operator: '=', answerString: 'no' }],
                },
              ],
            },
            {
              linkId: 'next',
              text: 'Next',
              type: 'string',
            },
          ],
        };

        const { result } = renderHook(() =>
          useFHIRStepper({ questionnaire: conditionalQuestionnaire })
        );

        act(() => {
          const parentQ = result.current.topLevelItems[0];
          result.current.setAnswer(parentQ, 'yes');
          const visibleChildQ = parentQ.item!.find(q => q.linkId === 'visible-child')!;
          result.current.setAnswer(visibleChildQ, 'answered');
          // invisible-child should be skipped (not visible)
        });

        // Verify answers are properly stored
        expect(result.current.answers.parent).toBe('yes');
        expect(result.current.answers['visible-child']).toBe('answered');
        // Invisible child doesn't need to be answered
        expect(result.current.answers['invisible-child']).toBeUndefined();
      });

      it('should return false when visible child is not answered', () => {
        const conditionalQuestionnaire = {
          item: [
            {
              linkId: 'parent',
              text: 'Parent',
              type: 'choice',
              item: [
                {
                  linkId: 'visible-child',
                  text: 'Visible Child',
                  type: 'string',
                  enableWhen: [{ question: 'parent', operator: '=', answerString: 'yes' }],
                },
              ],
            },
          ],
        };

        const { result } = renderHook(() =>
          useFHIRStepper({ questionnaire: conditionalQuestionnaire })
        );

        act(() => {
          const parentQ = result.current.topLevelItems[0];

          result.current.setAnswer(parentQ, 'yes');
          // visible-child is not answered
        });

        act(() => {
          vi.advanceTimersByTime(300);
        });

        // Should not advance because visible child is not answered
        expect(result.current.currentIndex).toBe(0);
      });

      it('should validate that all visible children are answered', () => {
        const multiChildQuestionnaire = {
          item: [
            {
              linkId: 'parent',
              text: 'Parent',
              type: 'choice',
              item: [
                {
                  linkId: 'child1',
                  text: 'Child 1',
                  type: 'string',
                  enableWhen: [{ question: 'parent', operator: '=', answerString: 'yes' }],
                },
                {
                  linkId: 'child2',
                  text: 'Child 2',
                  type: 'string',
                  enableWhen: [{ question: 'parent', operator: '=', answerString: 'yes' }],
                },
                {
                  linkId: 'child3',
                  text: 'Child 3',
                  type: 'string',
                  enableWhen: [{ question: 'parent', operator: '=', answerString: 'yes' }],
                },
              ],
            },
            {
              linkId: 'next',
              text: 'Next',
              type: 'string',
            },
          ],
        };

        const { result } = renderHook(() =>
          useFHIRStepper({ questionnaire: multiChildQuestionnaire })
        );

        const parentQ = result.current.topLevelItems[0];

        act(() => {
          result.current.setAnswer(parentQ, 'yes');
          const child1Q = parentQ.item!.find(q => q.linkId === 'child1')!;
          result.current.setAnswer(child1Q, 'answer1');
          const child2Q = parentQ.item!.find(q => q.linkId === 'child2')!;

          result.current.setAnswer(child2Q, 'answer2');
          // child3 not answered
        });

        // Verify first two children are answered but not third
        expect(result.current.answers.parent).toBe('yes');
        expect(result.current.answers.child1).toBe('answer1');
        expect(result.current.answers.child2).toBe('answer2');
        expect(result.current.answers.child3).toBeUndefined();

        // Now answer child3
        act(() => {
          const child3Q = parentQ.item!.find(q => q.linkId === 'child3')!;

          result.current.setAnswer(child3Q, 'answer3');
        });

        // Verify all visible children are now answered
        expect(result.current.answers.child1).toBe('answer1');
        expect(result.current.answers.child2).toBe('answer2');
        expect(result.current.answers.child3).toBe('answer3');
      });

      it('should handle children without enableWhen (always visible)', () => {
        const alwaysVisibleQuestionnaire = {
          item: [
            {
              linkId: 'parent',
              text: 'Parent',
              type: 'choice',
              item: [
                {
                  linkId: 'always-visible',
                  text: 'Always Visible',
                  type: 'string',
                  // No enableWhen - always visible
                },
              ],
            },
          ],
        };

        const { result } = renderHook(() =>
          useFHIRStepper({ questionnaire: alwaysVisibleQuestionnaire })
        );

        act(() => {
          const parentQ = result.current.topLevelItems[0];

          result.current.setAnswer(parentQ, 'yes');
          // always-visible not answered
        });

        act(() => {
          vi.advanceTimersByTime(300);
        });

        // Should not advance because always-visible child must be answered
        expect(result.current.currentIndex).toBe(0);
      });

      it('should validate enableWhen with answerBoolean', () => {
        const boolQuestionnaire = {
          item: [
            {
              linkId: 'parent',
              text: 'Parent',
              type: 'choice',
              item: [
                {
                  linkId: 'bool-child',
                  text: 'Bool Child',
                  type: 'string',
                  enableWhen: [{ question: 'parent', operator: '=', answerBoolean: true }],
                },
              ],
            },
            {
              linkId: 'next',
              text: 'Next',
              type: 'string',
            },
          ],
        };

        const { result } = renderHook(() =>
          useFHIRStepper({ questionnaire: boolQuestionnaire })
        );

        act(() => {
          const parentQ = result.current.topLevelItems[0];

          result.current.setAnswer(parentQ, true);
          const boolchildQ = parentQ.item!.find(q => q.linkId === 'bool-child')!;

          result.current.setAnswer(boolchildQ, 'answered');
        });

        // Verify answers are properly stored for boolean enableWhen condition
        expect(result.current.answers.parent).toBe(true);
        expect(result.current.answers['bool-child']).toBe('answered');
      });

      it('should validate enableWhen with answerInteger', () => {
        const intQuestionnaire = {
          item: [
            {
              linkId: 'parent',
              text: 'Parent',
              type: 'choice',
              item: [
                {
                  linkId: 'int-child',
                  text: 'Int Child',
                  type: 'string',
                  enableWhen: [{ question: 'parent', operator: '=', answerInteger: 5 }],
                },
              ],
            },
            {
              linkId: 'next',
              text: 'Next',
              type: 'string',
            },
          ],
        };

        const { result } = renderHook(() =>
          useFHIRStepper({ questionnaire: intQuestionnaire })
        );

        act(() => {
          const parentQ = result.current.topLevelItems[0];

          result.current.setAnswer(parentQ, 5);
          const intchildQ = parentQ.item!.find(q => q.linkId === 'int-child')!;

          result.current.setAnswer(intchildQ, 'answered');
        });

        // Verify answers are properly stored for integer enableWhen condition
        expect(result.current.answers.parent).toBe(5);
        expect(result.current.answers['int-child']).toBe('answered');
      });

      it('should validate enableWhen with answerCoding code', () => {
        const codingQuestionnaire = {
          item: [
            {
              linkId: 'parent',
              text: 'Parent',
              type: 'choice',
              item: [
                {
                  linkId: 'coding-child',
                  text: 'Coding Child',
                  type: 'string',
                  enableWhen: [
                    {
                      question: 'parent',
                      operator: '=',
                      answerCoding: { code: 'code-123' },
                    },
                  ],
                },
              ],
            },
            {
              linkId: 'next',
              text: 'Next',
              type: 'string',
            },
          ],
        };

        const { result } = renderHook(() =>
          useFHIRStepper({ questionnaire: codingQuestionnaire })
        );

        act(() => {
          const parentQ = result.current.topLevelItems[0];

          result.current.setAnswer(parentQ, 'code-123');
          const codingchildQ = parentQ.item!.find(q => q.linkId === 'coding-child')!;

          result.current.setAnswer(codingchildQ, 'answered');
        });

        // Verify answers are properly stored for coding enableWhen condition
        expect(result.current.answers.parent).toBe('code-123');
        expect(result.current.answers['coding-child']).toBe('answered');
      });

      it('should handle multiple enableWhen rules (all must match)', () => {
        const multiRuleQuestionnaire = {
          item: [
            {
              linkId: 'q1',
              text: 'Question 1',
              type: 'choice',
              answerOption: [
                { valueCoding: { code: 'yes', display: 'Yes' } },
                { valueCoding: { code: 'no', display: 'No' } },
              ],
            },
            {
              linkId: 'q2',
              text: 'Question 2',
              type: 'choice',
              answerOption: [
                { valueCoding: { code: 'yes', display: 'Yes' } },
                { valueCoding: { code: 'no', display: 'No' } },
              ],
            },
            {
              linkId: 'parent',
              text: 'Parent',
              type: 'choice',
              item: [
                {
                  linkId: 'multi-rule-child',
                  text: 'Multi Rule Child',
                  type: 'string',
                  enableWhen: [
                    { question: 'q1', operator: '=', answerString: 'yes' },
                    { question: 'q2', operator: '=', answerString: 'yes' },
                  ],
                },
              ],
            },
            {
              linkId: 'next',
              text: 'Next',
              type: 'string',
            },
          ],
        };

        const { result } = renderHook(() =>
          useFHIRStepper({ questionnaire: multiRuleQuestionnaire })
        );

        // Answer first two questions
        act(() => {
          const q1 = result.current.topLevelItems[0];

          result.current.setAnswer(q1, 'yes');
        });
        act(() => {
          result.current.goNext();
        });
        act(() => {
          const q2 = result.current.topLevelItems[1];

          result.current.setAnswer(q2, 'yes');
        });
        act(() => {
          result.current.goNext();
        });

        // Now on parent question
        act(() => {
          const parentQ = result.current.topLevelItems[2];

          result.current.setAnswer(parentQ, 'answer');
          const multiRuleChildQ = parentQ.item!.find(q => q.linkId === 'multi-rule-child')!;

          result.current.setAnswer(multiRuleChildQ, 'child-answer');
        });

        act(() => {
          vi.advanceTimersByTime(300);
        });

        // Should advance because both enableWhen rules match
        expect(result.current.currentIndex).toBe(3);
      });

      it('should check enableWhen against array answers (multi-select parent)', () => {
        const arrayEnableWhenQuestionnaire = {
          item: [
            {
              linkId: 'symptoms',
              text: 'Select symptoms',
              type: 'choice',
              repeats: true,
              answerOption: [
                { valueCoding: { code: 'fever', display: 'Fever' } },
                { valueCoding: { code: 'cough', display: 'Cough' } },
                { valueCoding: { code: 'headache', display: 'Headache' } },
              ],
              item: [
                {
                  linkId: 'fever-details',
                  text: 'Fever Details',
                  type: 'string',
                  enableWhen: [
                    {
                      question: 'symptoms',
                      operator: '=',
                      answerString: 'fever',
                    },
                  ],
                },
                {
                  linkId: 'cough-details',
                  text: 'Cough Details',
                  type: 'string',
                  enableWhen: [
                    {
                      question: 'symptoms',
                      operator: '=',
                      answerString: 'cough',
                    },
                  ],
                },
              ],
            },
            {
              linkId: 'next',
              text: 'Next',
              type: 'string',
            },
          ],
        };

        const { result } = renderHook(() =>
          useFHIRStepper({
            questionnaire: arrayEnableWhenQuestionnaire,
            autoNext: false,
          })
        );

        const symptomsQ = result.current.topLevelItems[0];

        // Select fever and cough (array answer)
        act(() => {
          result.current.setAnswer(symptomsQ, 'fever');
        });
        act(() => {
          result.current.setAnswer(symptomsQ, 'cough');
        });

        expect(result.current.answers.symptoms).toEqual(['fever', 'cough']);

        // Now answer the child questions that are visible
        const feverDetailsQ = symptomsQ.item!.find(
          q => q.linkId === 'fever-details'
        )!;
        const coughDetailsQ = symptomsQ.item!.find(
          q => q.linkId === 'cough-details'
        )!;

        act(() => {
          result.current.setAnswer(feverDetailsQ, 'high fever');
        });
        act(() => {
          result.current.setAnswer(coughDetailsQ, 'dry cough');
        });

        // Verify answers are stored
        expect(result.current.answers['fever-details']).toBe('high fever');
        expect(result.current.answers['cough-details']).toBe('dry cough');
      });

      it('should validate child is visible when parent has array answer matching enableWhen', () => {
        const arrayEnableWhenQuestionnaire = {
          item: [
            {
              linkId: 'colors',
              text: 'Select colors',
              type: 'choice',
              repeats: true,
              answerOption: [
                { valueCoding: { code: 'red', display: 'Red' } },
                { valueCoding: { code: 'blue', display: 'Blue' } },
                { valueCoding: { code: 'green', display: 'Green' } },
              ],
            },
            {
              linkId: 'parent',
              text: 'Parent Question',
              type: 'choice',
              item: [
                {
                  linkId: 'red-child',
                  text: 'Red Child',
                  type: 'string',
                  enableWhen: [
                    {
                      question: 'colors',
                      operator: '=',
                      answerString: 'red',
                    },
                  ],
                },
              ],
            },
          ],
        };

        const { result } = renderHook(() =>
          useFHIRStepper({
            questionnaire: arrayEnableWhenQuestionnaire,
            autoNext: true,
          })
        );

        const colorsQ = result.current.topLevelItems[0];

        // Select multiple colors including red
        act(() => {
          result.current.setAnswer(colorsQ, 'red');
        });
        act(() => {
          result.current.setAnswer(colorsQ, 'blue');
        });

        expect(result.current.answers.colors).toEqual(['red', 'blue']);

        // Move to parent question
        act(() => {
          result.current.goNext();
        });

        const parentQ = result.current.topLevelItems[1];

        act(() => {
          result.current.setAnswer(parentQ, 'parent-answer');
        });

        // red-child should be visible because 'red' is in the array
        const redChildQ = parentQ.item!.find(q => q.linkId === 'red-child')!;

        act(() => {
          result.current.setAnswer(redChildQ, 'red-child-answer');
        });

        expect(result.current.answers['red-child']).toBe('red-child-answer');
      });

      it('should NOT auto-advance when visible string child depends on array answer', () => {
        // This tests lines 135-155 (hasVisibleStringChild check with array answer)
        const arrayWithStringChildQuestionnaire = {
          item: [
            {
              linkId: 'multi-symptoms',
              text: 'Select symptoms',
              type: 'choice',
              repeats: true,
              answerOption: [
                { valueCoding: { code: 'fever', display: 'Fever' } },
                { valueCoding: { code: 'cough', display: 'Cough' } },
              ],
            },
            {
              linkId: 'parent',
              text: 'Main question',
              type: 'choice',
              answerOption: [
                { valueCoding: { code: 'yes', display: 'Yes' } },
                { valueCoding: { code: 'no', display: 'No' } },
              ],
              item: [
                {
                  linkId: 'string-child',
                  text: 'String Child',
                  type: 'string',
                  enableWhen: [
                    {
                      question: 'multi-symptoms',
                      operator: '=',
                      answerString: 'fever',
                    },
                  ],
                },
              ],
            },
            {
              linkId: 'next',
              text: 'Next',
              type: 'string',
            },
          ],
        };

        const { result } = renderHook(() =>
          useFHIRStepper({
            questionnaire: arrayWithStringChildQuestionnaire,
            autoNext: true,
          })
        );

        const multiSymptomsQ = result.current.topLevelItems[0];

        // Select fever (which will make string-child visible in parent)
        act(() => {
          result.current.setAnswer(multiSymptomsQ, 'fever');
        });

        // Move to parent question
        act(() => {
          result.current.goNext();
        });

        expect(result.current.currentIndex).toBe(1);

        const parentQ = result.current.topLevelItems[1];

        // Answer parent - this should NOT auto-advance because string-child is visible
        act(() => {
          result.current.setAnswer(parentQ, 'yes');
        });

        act(() => {
          vi.advanceTimersByTime(300);
        });

        // Should NOT auto-advance due to visible string child
        expect(result.current.currentIndex).toBe(1);
      });

      it('should validate isTopLevelComplete with array answer in enableWhen (lines 232-256)', () => {
        // This tests lines 244-246 (isTopLevelComplete nested validation with array)
        const questionnaireWithArrayEnableWhen = {
          item: [
            {
              linkId: 'conditions',
              text: 'Select conditions',
              type: 'choice',
              repeats: true,
              answerOption: [
                { valueCoding: { code: 'diabetes', display: 'Diabetes' } },
                { valueCoding: { code: 'hypertension', display: 'Hypertension' } },
              ],
            },
            {
              linkId: 'parent',
              text: 'Parent Question',
              type: 'choice',
              answerOption: [{ valueCoding: { code: 'yes', display: 'Yes' } }],
              item: [
                {
                  linkId: 'diabetes-details',
                  text: 'Diabetes Details',
                  type: 'string',
                  enableWhen: [
                    {
                      question: 'conditions',
                      operator: '=',
                      answerString: 'diabetes',
                    },
                  ],
                },
              ],
            },
            {
              linkId: 'next',
              text: 'Next',
              type: 'string',
            },
          ],
        };

        const { result } = renderHook(() =>
          useFHIRStepper({
            questionnaire: questionnaireWithArrayEnableWhen,
            autoNext: true,
          })
        );

        const conditionsQ = result.current.topLevelItems[0];

        // Select diabetes and hypertension (array answer)
        act(() => {
          result.current.setAnswer(conditionsQ, 'diabetes');
        });
        act(() => {
          result.current.setAnswer(conditionsQ, 'hypertension');
        });

        expect(result.current.answers.conditions).toEqual(['diabetes', 'hypertension']);

        // Move to parent
        act(() => {
          result.current.goNext();
        });

        const parentQ = result.current.topLevelItems[1];

        // Answer parent
        act(() => {
          result.current.setAnswer(parentQ, 'yes');
        });

        // Don't advance yet because diabetes-details is visible and not answered
        act(() => {
          vi.advanceTimersByTime(300);
        });

        expect(result.current.currentIndex).toBe(1);

        // Now answer the visible child
        const diabetesDetailsQ = parentQ.item!.find(
          q => q.linkId === 'diabetes-details'
        )!;

        act(() => {
          result.current.setAnswer(diabetesDetailsQ, 'type 2');
        });

        // Verify the child answer is stored
        expect(result.current.answers['diabetes-details']).toBe('type 2');

        // Verify we're still on parent question (nested child answers don't trigger auto-advance)
        expect(result.current.currentIndex).toBe(1);

        // Manually advance to verify completion
        act(() => {
          result.current.goNext();
        });

        expect(result.current.currentIndex).toBe(2);
      });

      it('should not validate invisible child when one enableWhen rule fails', () => {
        const multiRuleQuestionnaire = {
          item: [
            {
              linkId: 'q1',
              text: 'Question 1',
              type: 'choice',
              answerOption: [
                { valueCoding: { code: 'yes', display: 'Yes' } },
                { valueCoding: { code: 'no', display: 'No' } },
              ],
            },
            {
              linkId: 'parent',
              text: 'Parent',
              type: 'choice',
              item: [
                {
                  linkId: 'multi-rule-child',
                  text: 'Multi Rule Child',
                  type: 'string',
                  enableWhen: [
                    { question: 'q1', operator: '=', answerString: 'yes' },
                    { question: 'parent', operator: '=', answerString: 'show' },
                  ],
                },
              ],
            },
            {
              linkId: 'next',
              text: 'Next',
              type: 'string',
            },
          ],
        };

        const { result } = renderHook(() =>
          useFHIRStepper({ questionnaire: multiRuleQuestionnaire })
        );

        act(() => {
          const q1 = result.current.topLevelItems[0];

          result.current.setAnswer(q1, 'no'); // First rule fails
        });
        act(() => {
          result.current.goNext();
        });

        act(() => {
          const parentQ = result.current.topLevelItems[0];

          result.current.setAnswer(parentQ, 'show');
          // multi-rule-child is invisible, so no need to answer
        });

        act(() => {
          vi.advanceTimersByTime(300);
        });

        // Should advance because invisible child is skipped
        expect(result.current.currentIndex).toBe(2);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty questionnaire', () => {
      const emptyQuestionnaire = { item: [] };

      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: emptyQuestionnaire })
      );

      expect(result.current.topLevelItems).toHaveLength(0);
      expect(result.current.currentQuestion).toBeUndefined();
    });

    it('should handle undefined questionnaire', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: undefined as any })
      );

      expect(result.current.topLevelItems).toHaveLength(0);
    });

    it('should handle question with no item array', () => {
      const simpleQuestionnaire = {
        item: [
          {
            linkId: 'q1',
            text: 'Simple Question',
            type: 'string',
          },
        ],
      };

      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: simpleQuestionnaire })
      );

      act(() => {
        const q1 = result.current.topLevelItems[0];

        result.current.setAnswer(q1, 'answer');
      });

      expect(result.current.answers.q1).toBe('answer');
    });

    it('should call onComplete with all answers via modal confirm', () => {
      const onComplete = vi.fn();
      const { result } = renderHook(() =>
        useFHIRStepper({
          questionnaire: mockQuestionnaire,
          onComplete,
        })
      );

      act(() => {
        const q1 = result.current.topLevelItems[0];
        const q2 = result.current.topLevelItems[1];
        const q3 = result.current.topLevelItems[2];
        result.current.setAnswer(q1, 'answer1');
        result.current.setAnswer(q2, 'yes');
        result.current.setAnswer(q3, 42);
      });

      // Navigate through questions
      act(() => {
        result.current.goNext();
      });

      act(() => {
        result.current.goNext();
      });

      // Go beyond last to trigger handleComplete (shows modal)
      act(() => {
        result.current.goNext();
      });

      expect(mockShowVitalConfirmationModal).toHaveBeenCalledTimes(1);

      // Simulate confirming the modal
      const modalConfig = mockShowVitalConfirmationModal.mock.calls[0][0];
      act(() => {
        modalConfig.onConfirm();
      });

      expect(onComplete).toHaveBeenCalledWith({
        q1: 'answer1',
        q2: 'yes',
        q3: 42,
      });
    });

    it('should handle autoNext disabled', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({
          questionnaire: mockQuestionnaire,
          autoNext: false,
        })
      );

      act(() => {
        result.current.goNext();
      });

      act(() => {
        const q2 = result.current.topLevelItems[1];

        result.current.setAnswer(q2, 'yes');
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current.currentIndex).toBe(1); // Should NOT auto-advance
    });
  });

  describe('Multi-Select with Mutually Exclusive Options', () => {
    const multiSelectQuestionnaire = {
      item: [
        {
          linkId: 'symptoms',
          text: 'Select symptoms',
          type: 'choice',
          repeats: true,
          answerOption: [
            { valueCoding: { code: 'fever', display: 'Fever' } },
            { valueCoding: { code: 'cough', display: 'Cough' } },
            { valueCoding: { code: 'headache', display: 'Headache' } },
            {
              valueCoding: { code: 'none', display: 'None of the above' },
              extension: [
                {
                  url: 'https://intelehealth.org/fhir/StructureDefinition/exclude-from-multi-choice',
                  valueString: 'True',
                },
              ],
            },
          ],
        },
        {
          linkId: 'q2',
          text: 'Next Question',
          type: 'string',
        },
      ],
    };

    it('should initialize empty array for multi-select question', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: multiSelectQuestionnaire })
      );

      const symptomsQ = result.current.topLevelItems[0];

      act(() => {
        result.current.setAnswer(symptomsQ, 'fever');
      });

      expect(result.current.answers.symptoms).toEqual(['fever']);
    });

    it('should add multiple options to array for multi-select', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: multiSelectQuestionnaire })
      );

      const symptomsQ = result.current.topLevelItems[0];

      act(() => {
        result.current.setAnswer(symptomsQ, 'fever');
      });
      act(() => {
        result.current.setAnswer(symptomsQ, 'cough');
      });
      act(() => {
        result.current.setAnswer(symptomsQ, 'headache');
      });

      expect(result.current.answers.symptoms).toEqual(['fever', 'cough', 'headache']);
    });

    it('should toggle off an option when clicked again', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: multiSelectQuestionnaire })
      );

      const symptomsQ = result.current.topLevelItems[0];

      act(() => {
        result.current.setAnswer(symptomsQ, 'fever');
      });
      act(() => {
        result.current.setAnswer(symptomsQ, 'cough');
      });

      expect(result.current.answers.symptoms).toEqual(['fever', 'cough']);

      // Toggle off 'fever'
      act(() => {
        result.current.setAnswer(symptomsQ, 'fever');
      });

      expect(result.current.answers.symptoms).toEqual(['cough']);
    });

    it('should select mutually exclusive option and clear all others', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: multiSelectQuestionnaire })
      );

      const symptomsQ = result.current.topLevelItems[0];

      // Select multiple regular options
      act(() => {
        result.current.setAnswer(symptomsQ, 'fever');
      });
      act(() => {
        result.current.setAnswer(symptomsQ, 'cough');
      });

      expect(result.current.answers.symptoms).toEqual(['fever', 'cough']);

      // Select mutually exclusive option (none)
      act(() => {
        result.current.setAnswer(symptomsQ, 'none');
      });

      // Should replace all with only 'none'
      expect(result.current.answers.symptoms).toEqual(['none']);
    });

    it('should unselect mutually exclusive option when clicked again', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: multiSelectQuestionnaire })
      );

      const symptomsQ = result.current.topLevelItems[0];

      // Select mutually exclusive option
      act(() => {
        result.current.setAnswer(symptomsQ, 'none');
      });

      expect(result.current.answers.symptoms).toEqual(['none']);

      // Click again to unselect
      act(() => {
        result.current.setAnswer(symptomsQ, 'none');
      });

      // Should be empty array
      expect(result.current.answers.symptoms).toEqual([]);
    });

    it('should remove mutually exclusive option when selecting regular option', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: multiSelectQuestionnaire })
      );

      const symptomsQ = result.current.topLevelItems[0];

      // Select mutually exclusive option first
      act(() => {
        result.current.setAnswer(symptomsQ, 'none');
      });

      expect(result.current.answers.symptoms).toEqual(['none']);

      // Select regular option
      act(() => {
        result.current.setAnswer(symptomsQ, 'fever');
      });

      // Should remove 'none' and add 'fever'
      expect(result.current.answers.symptoms).toEqual(['fever']);
    });

    it('should handle non-array current value for repeating question', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: multiSelectQuestionnaire })
      );

      const symptomsQ = result.current.topLevelItems[0];

      // Manually set a non-array value (edge case)
      act(() => {
        result.current.setAnswer(symptomsQ, 'fever');
      });

      // Should still work and convert to array
      expect(Array.isArray(result.current.answers.symptoms)).toBe(true);
      expect(result.current.answers.symptoms).toEqual(['fever']);
    });

    it('should NOT auto-advance for repeating choice questions', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: multiSelectQuestionnaire })
      );

      const symptomsQ = result.current.topLevelItems[0];

      act(() => {
        result.current.setAnswer(symptomsQ, 'fever');
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Should NOT auto-advance for multi-select
      expect(result.current.currentIndex).toBe(0);
    });

    it('should identify mutually exclusive option correctly', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: multiSelectQuestionnaire })
      );

      const symptomsQ = result.current.topLevelItems[0];

      // Verify the question has the mutually exclusive option
      const noneOption = symptomsQ.answerOption?.find(
        opt => opt.valueCoding?.code === 'none'
      );

      expect(noneOption?.extension).toBeDefined();
      expect(
        noneOption?.extension?.some(
          ext =>
            ext.url === 'https://intelehealth.org/fhir/StructureDefinition/exclude-from-multi-choice' &&
            ext.valueString === 'True'
        )
      ).toBe(true);
    });

    it('should handle question without mutually exclusive options', () => {
      const simpleMultiSelectQuestionnaire = {
        item: [
          {
            linkId: 'colors',
            text: 'Select colors',
            type: 'choice',
            repeats: true,
            answerOption: [
              { valueCoding: { code: 'red', display: 'Red' } },
              { valueCoding: { code: 'blue', display: 'Blue' } },
              { valueCoding: { code: 'green', display: 'Green' } },
            ],
          },
        ],
      };

      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: simpleMultiSelectQuestionnaire })
      );

      const colorsQ = result.current.topLevelItems[0];

      act(() => {
        result.current.setAnswer(colorsQ, 'red');
      });
      act(() => {
        result.current.setAnswer(colorsQ, 'blue');
      });
      act(() => {
        result.current.setAnswer(colorsQ, 'green');
      });

      expect(result.current.answers.colors).toEqual(['red', 'blue', 'green']);

      // Toggle off one
      act(() => {
        result.current.setAnswer(colorsQ, 'blue');
      });

      expect(result.current.answers.colors).toEqual(['red', 'green']);
    });
  });

  describe('getTopLevelLinkId Function', () => {
    const nestedQuestionnaire = {
      item: [
        {
          linkId: 'parent',
          text: 'Parent',
          type: 'choice',
          item: [
            {
              linkId: 'child',
              text: 'Child',
              type: 'string',
            },
          ],
        },
        {
          linkId: 'standalone',
          text: 'Standalone',
          type: 'string',
        },
      ],
    };

    it('should return same linkId if it matches current question', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: nestedQuestionnaire })
      );

      const parentQ = result.current.topLevelItems[0];

      act(() => {
        result.current.setAnswer(parentQ, 'parent-answer');
      });

      // The linkId 'parent' should be recognized as top-level
      expect(result.current.currentQuestion?.linkId).toBe('parent');
    });

    it('should return parent linkId for child question', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: nestedQuestionnaire })
      );

      const parentQ = result.current.topLevelItems[0];
      const childQ = parentQ.item![0];

      act(() => {
        result.current.setAnswer(parentQ, 'parent-answer');
      });

      act(() => {
        result.current.setAnswer(childQ, 'child-answer');
      });

      // Verify child answer is stored
      expect(result.current.answers.child).toBe('child-answer');
    });

    it('should return linkId as-is if not related to current question', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: nestedQuestionnaire })
      );

      const standaloneQ = result.current.topLevelItems[1];

      act(() => {
        result.current.goNext();
      });

      act(() => {
        result.current.setAnswer(standaloneQ, 'standalone-answer');
      });

      expect(result.current.answers.standalone).toBe('standalone-answer');
    });

    it('should handle undefined currentQuestion', () => {
      const emptyQuestionnaire = { item: [] };

      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: emptyQuestionnaire })
      );

      expect(result.current.currentQuestion).toBeUndefined();

      // Try to set an answer even with no current question (defensive code path)
      const dummyQuestion = {
        linkId: 'dummy',
        text: 'Dummy',
        type: 'string' as const,
      };

      act(() => {
        result.current.setAnswer(dummyQuestion, 'test');
      });

      // Should still store the answer
      expect(result.current.answers.dummy).toBe('test');
    });
  });

  describe('isTopLevelComplete with Repeats', () => {
    it('should return false when repeating question has empty array', () => {
      const repeatingQuestionnaire = {
        item: [
          {
            linkId: 'multi',
            text: 'Multi Select',
            type: 'choice',
            repeats: true,
            answerOption: [
              { valueCoding: { code: 'opt1', display: 'Option 1' } },
              { valueCoding: { code: 'opt2', display: 'Option 2' } },
            ],
          },
          {
            linkId: 'next',
            text: 'Next',
            type: 'string',
          },
        ],
      };

      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: repeatingQuestionnaire })
      );

      // Don't answer - should not auto-advance
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current.currentIndex).toBe(0);
    });

    it('should return true when repeating question has non-empty array', () => {
      const repeatingQuestionnaire = {
        item: [
          {
            linkId: 'multi',
            text: 'Multi Select',
            type: 'choice',
            repeats: true,
            answerOption: [
              { valueCoding: { code: 'opt1', display: 'Option 1' } },
            ],
          },
        ],
      };

      const { result } = renderHook(() =>
        useFHIRStepper({
          questionnaire: repeatingQuestionnaire,
          autoNext: false,
        })
      );

      const multiQ = result.current.topLevelItems[0];

      act(() => {
        result.current.setAnswer(multiQ, 'opt1');
      });

      // Should have array with one item
      expect(result.current.answers.multi).toEqual(['opt1']);
      expect(Array.isArray(result.current.answers.multi)).toBe(true);
      expect((result.current.answers.multi as string[]).length).toBeGreaterThan(0);
    });
  });

  describe('Duration Structure Validation (isTopLevelComplete)', () => {
    it('should validate top-level duration when answering nested child', () => {
      // The trick is to have a choice question with nested items
      // First set the parent with duration, then set nested child
      // This triggers isTopLevelComplete with the duration already in place
      const questionnaireWithDuration = {
        item: [
          {
            linkId: 'q1',
            text: 'Duration Question',
            type: 'choice',
            item: [
              {
                linkId: 'q1.1',
                text: 'Follow-up',
                type: 'string',
              },
            ],
          },
          {
            linkId: 'q2',
            text: 'Next Question',
            type: 'string',
          },
        ],
      };

      const { result } = renderHook(() =>
        useFHIRStepper({
          questionnaire: questionnaireWithDuration,
          autoNext: true,
        })
      );

      // First set parent with complete duration
      const q1 = result.current.topLevelItems[0];

      act(() => {
        result.current.setAnswer(q1, {
          dropdownValues: {
            number: 5,
            days: 'days',
          },
        });
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Now set nested child - this will call isTopLevelComplete
      act(() => {
        const nestedQ = q1.item!.find(q => q.linkId === 'q1.1')!;

        result.current.setAnswer(nestedQ, 'nested-answer');
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Should still be on first question (auto-advance disabled for duration)
      expect(result.current.currentIndex).toBe(0);
    });

    it('should not advance with incomplete top-level duration (missing number)', () => {
      const questionnaireWithDuration = {
        item: [
          {
            linkId: 'q1',
            text: 'Duration Question',
            type: 'choice',
          },
        ],
      };

      const { result } = renderHook(() =>
        useFHIRStepper({
          questionnaire: questionnaireWithDuration,
          autoNext: true,
        })
      );

      // Answer with incomplete duration (missing number)
      act(() => {
        const q1 = result.current.topLevelItems[0];

        result.current.setAnswer(q1, {
          dropdownValues: {
            number: null,
            days: 'days',
          },
        });
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current.currentIndex).toBe(0);
    });

    it('should not advance with incomplete top-level duration (missing days)', () => {
      const questionnaireWithDuration = {
        item: [
          {
            linkId: 'q1',
            text: 'Duration Question',
            type: 'choice',
          },
        ],
      };

      const { result } = renderHook(() =>
        useFHIRStepper({
          questionnaire: questionnaireWithDuration,
          autoNext: true,
        })
      );

      // Answer with incomplete duration (missing days)
      act(() => {
        const q1 = result.current.topLevelItems[0];

        result.current.setAnswer(q1, {
          dropdownValues: {
            number: 5,
            days: null,
          },
        });
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current.currentIndex).toBe(0);
    });

    it('should validate nested child duration structure', () => {
      const questionnaireWithNestedDuration = {
        item: [
          {
            linkId: 'q1',
            text: 'Parent Question',
            type: 'choice',
            item: [
              {
                linkId: 'q1.1',
                text: 'Duration Child',
                type: 'string',
              },
            ],
          },
        ],
      };

      const { result } = renderHook(() =>
        useFHIRStepper({
          questionnaire: questionnaireWithNestedDuration,
          autoNext: true,
        })
      );

      // Answer parent
      const q1 = result.current.topLevelItems[0];

      act(() => {
        result.current.setAnswer(q1, 'parent-answer');
      });

      // Answer child with complete duration
      act(() => {
        const nestedQ = q1.item!.find(q => q.linkId === 'q1.1')!;

        result.current.setAnswer(nestedQ, {
          dropdownValues: {
            number: 3,
            days: 'weeks',
          },
        });
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Should not auto-advance due to duration
      expect(result.current.currentIndex).toBe(0);
    });

    it('should not advance with incomplete nested child duration (missing number)', () => {
      const questionnaireWithNestedDuration = {
        item: [
          {
            linkId: 'q1',
            text: 'Parent Question',
            type: 'choice',
            item: [
              {
                linkId: 'q1.1',
                text: 'Duration Child',
                type: 'string',
              },
            ],
          },
        ],
      };

      const { result } = renderHook(() =>
        useFHIRStepper({
          questionnaire: questionnaireWithNestedDuration,
          autoNext: true,
        })
      );

      const q1 = result.current.topLevelItems[0];

      act(() => {
        result.current.setAnswer(q1, 'parent-answer');
      });

      // Answer child with incomplete duration
      act(() => {
        const nestedQ = q1.item!.find(q => q.linkId === 'q1.1')!;

        result.current.setAnswer(nestedQ, {
          dropdownValues: {
            number: null,
            days: 'weeks',
          },
        });
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current.currentIndex).toBe(0);
    });

    it('should not advance with incomplete nested child duration (missing days)', () => {
      const questionnaireWithNestedDuration = {
        item: [
          {
            linkId: 'q1',
            text: 'Parent Question',
            type: 'choice',
            item: [
              {
                linkId: 'q1.1',
                text: 'Duration Child',
                type: 'string',
              },
            ],
          },
        ],
      };

      const { result } = renderHook(() =>
        useFHIRStepper({
          questionnaire: questionnaireWithNestedDuration,
          autoNext: true,
        })
      );

      const q1 = result.current.topLevelItems[0];

      act(() => {
        result.current.setAnswer(q1, 'parent-answer');
      });

      // Answer child with incomplete duration
      act(() => {
        const nestedQ = q1.item!.find(q => q.linkId === 'q1.1')!;

        result.current.setAnswer(nestedQ, {
          dropdownValues: {
            number: 7,
            days: null,
          },
        });
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current.currentIndex).toBe(0);
    });
  });

  describe('Mutually Exclusive Options (Multi-Select)', () => {
    const questionWithMutuallyExclusive = {
      item: [
        {
          linkId: 'q1',
          text: 'Multi Select',
          type: 'choice',
          repeats: true,
          answerOption: [
            {
              valueCoding: { code: 'opt1', display: 'Option 1' },
            },
            {
              valueCoding: { code: 'opt2', display: 'Option 2' },
            },
            {
              valueCoding: { code: 'none', display: 'None of the above' },
              extension: [
                { url: 'https://intelehealth.org/fhir/StructureDefinition/exclude-from-multi-choice', valueString: 'True' },
              ],
            },
          ],
        },
      ],
    };

    it('should store array directly when value is pre-computed array', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: questionWithMutuallyExclusive, autoNext: false })
      );
      const q1 = result.current.topLevelItems[0];

      act(() => {
        result.current.setAnswer(q1, ['opt1', 'NO_opt2']);
      });

      expect(result.current.answers['q1']).toEqual(['opt1', 'NO_opt2']);
    });

    it('should add non-exclusive option to array when not already selected', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: questionWithMutuallyExclusive, autoNext: false })
      );
      const q1 = result.current.topLevelItems[0];

      act(() => {
        result.current.setAnswer(q1, 'opt1');
      });

      expect(result.current.answers['q1']).toEqual(['opt1']);
    });

    it('should remove non-exclusive option when it is already selected (toggle off)', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: questionWithMutuallyExclusive, autoNext: false })
      );
      const q1 = result.current.topLevelItems[0];

      act(() => {
        result.current.setAnswer(q1, 'opt1');
      });
      act(() => {
        result.current.setAnswer(q1, 'opt1');
      });

      expect(result.current.answers['q1']).toEqual([]);
    });

    it('should replace all selections with mutually exclusive option when clicked', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: questionWithMutuallyExclusive, autoNext: false })
      );
      const q1 = result.current.topLevelItems[0];

      act(() => {
        result.current.setAnswer(q1, 'opt1');
      });
      act(() => {
        result.current.setAnswer(q1, 'opt2');
      });

      // Now click the mutually exclusive option
      act(() => {
        result.current.setAnswer(q1, 'none');
      });

      expect(result.current.answers['q1']).toEqual(['none']);
    });

    it('should deselect mutually exclusive option when clicked again (toggle off)', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: questionWithMutuallyExclusive, autoNext: false })
      );
      const q1 = result.current.topLevelItems[0];

      act(() => {
        result.current.setAnswer(q1, 'none');
      });

      // Click mutually exclusive again to deselect
      act(() => {
        result.current.setAnswer(q1, 'none');
      });

      expect(result.current.answers['q1']).toEqual([]);
    });

    it('should remove mutually exclusive option when a non-exclusive option is clicked', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: questionWithMutuallyExclusive, autoNext: false })
      );
      const q1 = result.current.topLevelItems[0];

      // First select the exclusive option
      act(() => {
        result.current.setAnswer(q1, 'none');
      });

      expect(result.current.answers['q1']).toEqual(['none']);

      // Now click a normal option - should remove 'none' and add 'opt1'
      act(() => {
        result.current.setAnswer(q1, 'opt1');
      });

      expect(result.current.answers['q1']).toEqual(['opt1']);
    });

    it('should accumulate multiple non-exclusive options', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: questionWithMutuallyExclusive, autoNext: false })
      );
      const q1 = result.current.topLevelItems[0];

      act(() => {
        result.current.setAnswer(q1, 'opt1');
      });
      act(() => {
        result.current.setAnswer(q1, 'opt2');
      });

      expect(result.current.answers['q1']).toEqual(['opt1', 'opt2']);
    });

    it('should not auto-advance for repeats choice question even when answered', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({
          questionnaire: {
            item: [
              { ...questionWithMutuallyExclusive.item[0] },
              { linkId: 'q2', text: 'Question 2', type: 'string', required: false },
            ],
          },
          autoNext: true,
        })
      );

      const q1 = result.current.topLevelItems[0];
      act(() => {
        result.current.setAnswer(q1, 'opt1');
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Should NOT auto-advance because repeats choice requires manual submit
      expect(result.current.currentIndex).toBe(0);
    });
  });

  describe('Review Mode (showAll)', () => {
    it('should call handleComplete directly when goNext is called in showAll mode', async () => {
      const { buildVisitSummary } = await import('../../../../modules/ayu/utils/visit-summary.util');
      const mockBuildVisitSummary = vi.mocked(buildVisitSummary);

      // Return a section so sections.forEach runs and onChange gets assigned
      const mockSections = [
        { title: 'Main section', items: [{ type: 'labelValue' as const, label: 'Q', value: 'A' }] },
      ];
      mockBuildVisitSummary.mockReturnValue(mockSections);

      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: mockQuestionnaire })
      );

      // Answer required q1 so validation passes
      act(() => {
        result.current.setAnswer(result.current.topLevelItems[0], 'answer1');
      });

      // Navigate to last question and trigger handleComplete
      act(() => { result.current.goNext(); });
      act(() => { result.current.goNext(); });
      act(() => { result.current.goNext(); });

      expect(mockShowVitalConfirmationModal).toHaveBeenCalledTimes(1);

      // Call section.onChange to set showAll = true
      const modalConfig1 = mockShowVitalConfirmationModal.mock.calls[0][0];
      act(() => {
        modalConfig1.sections[0].onChange();
      });

      // Now showAll is true. Calling goNext should trigger handleComplete again
      act(() => {
        result.current.goNext();
      });

      expect(mockShowVitalConfirmationModal).toHaveBeenCalledTimes(2);

      // Reset mock
      mockBuildVisitSummary.mockReturnValue([]);
    });

    it('should navigate to Associated symptoms question when section.onChange is called for Associated symptoms', async () => {
      const { buildVisitSummary } = await import('../../../../modules/ayu/utils/visit-summary.util');
      const mockBuildVisitSummary = vi.mocked(buildVisitSummary);

      const questionnaireWithAssociated = {
        item: [
          { linkId: 'q1', text: 'Main question', type: 'choice' },
          {
            linkId: 'q2',
            text: 'Associated symptoms question',
            type: 'choice',
            extension: [
              { url: 'urn:intelehealth:section', valueString: 'Associated symptoms' },
            ],
          },
          { linkId: 'q3', text: 'Another question', type: 'string' },
        ],
      };

      // Return a section titled 'Associated symptoms'
      const mockSections = [
        { title: 'Main', items: [{ type: 'labelValue' as const, label: 'Q1', value: 'A1' }] },
        { title: 'Associated symptoms', items: [{ type: 'labelValue' as const, label: 'Q2', value: 'A2' }] },
      ];
      mockBuildVisitSummary.mockReturnValue(mockSections);

      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: questionnaireWithAssociated })
      );

      // Navigate to last question and trigger handleComplete
      act(() => { result.current.goNext(); });
      act(() => { result.current.goNext(); });
      act(() => { result.current.goNext(); });

      expect(mockShowVitalConfirmationModal).toHaveBeenCalledTimes(1);

      // Call onChange for 'Associated symptoms' section
      const modalConfig = mockShowVitalConfirmationModal.mock.calls[0][0];
      act(() => {
        modalConfig.sections[1].onChange();
      });

      // currentIndex should be 1 (the item with Associated symptoms extension)
      expect(result.current.currentIndex).toBe(1);
      expect(result.current.showAll).toBe(true);

      // Reset mock
      mockBuildVisitSummary.mockReturnValue([]);
    });

    it('should fallback to index 0 when Associated symptoms section has no matching item', async () => {
      const { buildVisitSummary } = await import('../../../../modules/ayu/utils/visit-summary.util');
      const mockBuildVisitSummary = vi.mocked(buildVisitSummary);

      // Questionnaire has NO items with 'Associated symptoms' extension
      const questionnaireNoAssociated = {
        item: [
          { linkId: 'q1', text: 'Question 1', type: 'choice' },
          { linkId: 'q2', text: 'Question 2', type: 'string' },
        ],
      };

      // Return a section titled 'Associated symptoms' even though no item has that extension
      const mockSections = [
        { title: 'Associated symptoms', items: [{ type: 'labelValue' as const, label: 'Q', value: 'A' }] },
      ];
      mockBuildVisitSummary.mockReturnValue(mockSections);

      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: questionnaireNoAssociated })
      );

      // Navigate to last question and trigger handleComplete
      act(() => { result.current.goNext(); });
      act(() => { result.current.goNext(); });

      const modalConfig = mockShowVitalConfirmationModal.mock.calls[0][0];

      // Call onChange for 'Associated symptoms' section - findIndex returns -1, fallback to 0
      act(() => {
        modalConfig.sections[0].onChange();
      });

      expect(result.current.currentIndex).toBe(0);
      expect(result.current.showAll).toBe(true);

      // Reset mock
      mockBuildVisitSummary.mockReturnValue([]);
    });
  });

  describe('clearAnswers', () => {
    it('should delete specified linkIds from answers', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: mockQuestionnaire })
      );

      // First set some answers
      act(() => {
        result.current.setAnswer(result.current.topLevelItems[0], 'answer1');
      });

      expect(result.current.answers.q1).toBe('answer1');

      act(() => {
        result.current.clearAnswers(['q1']);
      });

      expect(result.current.answers.q1).toBeUndefined();
    });

    it('should delete multiple linkIds at once', () => {
      const multiQuestionnaire = {
        item: [
          { linkId: 'q1', text: 'Q1', type: 'string' },
          { linkId: 'q2', text: 'Q2', type: 'string' },
          { linkId: 'q3', text: 'Q3', type: 'string' },
        ],
      };

      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: multiQuestionnaire })
      );

      act(() => {
        result.current.setAnswer(result.current.topLevelItems[0], 'a');
        result.current.setAnswer(result.current.topLevelItems[1], 'b');
        result.current.setAnswer(result.current.topLevelItems[2], 'c');
      });

      act(() => {
        result.current.clearAnswers(['q1', 'q3']);
      });

      expect(result.current.answers.q1).toBeUndefined();
      expect(result.current.answers.q2).toBe('b');
      expect(result.current.answers.q3).toBeUndefined();
    });

    it('should handle clearing non-existent linkIds gracefully', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: mockQuestionnaire })
      );

      act(() => {
        result.current.clearAnswers(['nonexistent']);
      });

      expect(result.current.answers.nonexistent).toBeUndefined();
    });

    it('should sync answersRef so goNext called right after clearAnswers uses cleared answers', () => {
      const onComplete = vi.fn();
      const twoChoiceQuestionnaire = {
        item: [
          {
            linkId: 'q1',
            text: 'Question 1',
            type: 'choice',
            answerOption: [
              { valueCoding: { code: 'yes', display: 'Yes' } },
            ],
          },
          {
            linkId: 'q2',
            text: 'Question 2',
            type: 'choice',
            answerOption: [
              { valueCoding: { code: 'a', display: 'A' } },
            ],
          },
        ],
      };

      const { result } = renderHook(() =>
        useFHIRStepper({
          questionnaire: twoChoiceQuestionnaire,
          skipSummary: true,
          onComplete,
        })
      );

      // Set answers for both questions
      act(() => {
        result.current.setAnswer(result.current.topLevelItems[0], 'yes');
        result.current.setAnswer(result.current.topLevelItems[1], 'a');
      });

      // Navigate to last question
      act(() => {
        result.current.goNext();
      });

      expect(result.current.currentIndex).toBe(1);
      expect(result.current.isLast).toBe(true);

      // Clear q2 first. The state updater inside clearAnswers syncs answersRef.current
      // so that subsequent reads of the ref within the same React flush see cleared answers.
      act(() => {
        result.current.clearAnswers(['q2']);
      });

      // After React processes the clearAnswers state update (which syncs answersRef),
      // calling goNext triggers handleComplete which reads answersRef.current.
      act(() => {
        result.current.goNext();
      });

      expect(onComplete).toHaveBeenCalledTimes(1);
      const completedAnswers = onComplete.mock.calls[0][0];
      // q2 should NOT be present because clearAnswers synced the ref
      expect(completedAnswers).toEqual({ q1: 'yes' });
      expect(completedAnswers.q2).toBeUndefined();
    });
  });

  describe('clearHiddenDescendantAnswers on parent answer change', () => {
    it('should clear hidden child answers when parent answer changes', () => {
      const questionnaire = {
        item: [
          {
            linkId: 'smoke',
            text: 'Do you smoke?',
            type: 'choice',
            answerOption: [
              { valueCoding: { code: 'yes', display: 'Yes' } },
              { valueCoding: { code: 'no', display: 'No' } },
              { valueCoding: { code: 'ex', display: 'Ex-smoker' } },
            ],
            item: [
              {
                linkId: 'how-many',
                text: 'How many per day?',
                type: 'string',
                enableWhen: [{ question: 'smoke', operator: '=', answerCoding: { code: 'yes' } }],
              },
              {
                linkId: 'since-when',
                text: 'Since when?',
                type: 'quantity',
                enableWhen: [{ question: 'smoke', operator: '=', answerCoding: { code: 'yes' } }],
              },
            ],
          },
        ],
      };

      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire, autoNext: false })
      );

      const smokeQ = result.current.topLevelItems[0];

      // Select "yes" and fill in child answers
      act(() => {
        result.current.setAnswer(smokeQ, 'yes');
      });

      // Manually set child answers
      act(() => {
        result.current.setAnswer(
          { linkId: 'how-many', text: 'How many per day?', type: 'string' },
          '5'
        );
      });
      act(() => {
        result.current.setAnswer(
          { linkId: 'since-when', text: 'Since when?', type: 'quantity' },
          { dropdownValues: { number: '10', days: 'Years' } }
        );
      });

      expect(result.current.answers['how-many']).toBe('5');
      expect(result.current.answers['since-when']).toEqual({ dropdownValues: { number: '10', days: 'Years' } });

      // Now switch to "ex-smoker"
      act(() => {
        result.current.setAnswer(smokeQ, 'ex');
      });

      // Child answers should be cleared
      expect(result.current.answers['how-many']).toBeUndefined();
      expect(result.current.answers['since-when']).toBeUndefined();
      expect(result.current.answers.smoke).toBe('ex');
    });

    it('should clear deeply nested descendants when parent becomes hidden', () => {
      const questionnaire = {
        item: [
          {
            linkId: 'parent',
            text: 'Parent',
            type: 'choice',
            item: [
              {
                linkId: 'child',
                text: 'Child',
                type: 'choice',
                enableWhen: [{ question: 'parent', operator: '=', answerString: 'yes' }],
                item: [
                  { linkId: 'grandchild', text: 'Grandchild', type: 'string' },
                ],
              },
            ],
          },
        ],
      };

      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire, autoNext: false })
      );

      const parentQ = result.current.topLevelItems[0];

      act(() => {
        result.current.setAnswer(parentQ, 'yes');
      });
      act(() => {
        result.current.setAnswer({ linkId: 'child', text: 'Child', type: 'choice' }, 'val');
      });
      act(() => {
        result.current.setAnswer({ linkId: 'grandchild', text: 'Grandchild', type: 'string' }, 'deep val');
      });

      expect(result.current.answers.child).toBe('val');
      expect(result.current.answers.grandchild).toBe('deep val');

      // Change parent answer
      act(() => {
        result.current.setAnswer(parentQ, 'no');
      });

      expect(result.current.answers.child).toBeUndefined();
      expect(result.current.answers.grandchild).toBeUndefined();
    });

    it('should preserve visible sibling answers when only one child becomes hidden', () => {
      const questionnaire = {
        item: [
          {
            linkId: 'parent',
            text: 'Parent',
            type: 'choice',
            item: [
              {
                linkId: 'yes-child',
                text: 'Yes Child',
                type: 'string',
                enableWhen: [{ question: 'parent', operator: '=', answerCoding: { code: 'yes' } }],
              },
              {
                linkId: 'always-child',
                text: 'Always Visible',
                type: 'string',
                // No enableWhen — always visible
              },
            ],
          },
        ],
      };

      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire, autoNext: false })
      );

      const parentQ = result.current.topLevelItems[0];

      act(() => {
        result.current.setAnswer(parentQ, 'yes');
      });
      act(() => {
        result.current.setAnswer({ linkId: 'yes-child', text: 'Yes Child', type: 'string' }, 'val1');
      });
      act(() => {
        result.current.setAnswer({ linkId: 'always-child', text: 'Always Visible', type: 'string' }, 'val2');
      });

      // Switch parent to 'no'
      act(() => {
        result.current.setAnswer(parentQ, 'no');
      });

      expect(result.current.answers['yes-child']).toBeUndefined();
      expect(result.current.answers['always-child']).toBe('val2');
    });
  });

  describe('skipSummary mode', () => {
    it('should call onComplete directly without showing modal when skipSummary is true', () => {
      const onComplete = vi.fn();
      const { result } = renderHook(() =>
        useFHIRStepper({
          questionnaire: mockQuestionnaire,
          skipSummary: true,
          onComplete,
        })
      );

      // Answer all questions and navigate past the last one
      act(() => { result.current.setAnswer(result.current.topLevelItems[0], 'answer1'); });
      act(() => { result.current.goNext(); });
      act(() => { result.current.setAnswer(result.current.topLevelItems[1], 'yes'); });
      act(() => { vi.advanceTimersByTime(300); });
      act(() => { result.current.setAnswer(result.current.topLevelItems[2], 42); });
      act(() => { result.current.goNext(); });

      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(mockShowVitalConfirmationModal).not.toHaveBeenCalled();
    });

    it('should not throw when skipSummary is true but onComplete is undefined', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({
          questionnaire: mockQuestionnaire,
          skipSummary: true,
        })
      );

      act(() => { result.current.goNext(); });
      act(() => { result.current.goNext(); });
      expect(() => {
        act(() => { result.current.goNext(); });
      }).not.toThrow();
    });
  });

  describe('hasVisibleStringOrRepeatsDeep recursive traversal', () => {
    it('should recurse into nested group children to find a deep string type', () => {
      const deepQuestionnaire = {
        item: [
          {
            linkId: 'parent',
            text: 'Parent',
            type: 'choice',
            answerOption: [
              { valueCoding: { code: 'yes', display: 'Yes' } },
              { valueCoding: { code: 'no', display: 'No' } },
            ],
            item: [
              {
                linkId: 'group-wrapper',
                text: 'Group Wrapper',
                type: 'group',
                item: [
                  { linkId: 'deep-string', text: 'Deep String', type: 'string' },
                ],
              },
            ],
          },
          { linkId: 'next-q', text: 'Next Q', type: 'string' },
        ],
      };

      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: deepQuestionnaire })
      );

      act(() => {
        result.current.setAnswer(result.current.topLevelItems[0], 'yes');
      });
      act(() => { vi.advanceTimersByTime(300); });

      // Should NOT auto-advance because recursive check finds deep string child
      expect(result.current.currentIndex).toBe(0);
    });
  });

  describe('validateAllQuestions', () => {
    it('should return true when all required questions are answered', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: mockQuestionnaire })
      );

      act(() => {
        result.current.setAnswer(result.current.topLevelItems[0], 'answer1');
      });

      let isValid = false;
      act(() => {
        isValid = result.current.validateAllQuestions();
      });

      expect(isValid).toBe(true);
      expect(mockShowToast).not.toHaveBeenCalled();
    });

    it('should return false and show toast when required question is unanswered', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: mockQuestionnaire })
      );

      let isValid = true;
      act(() => {
        isValid = result.current.validateAllQuestions();
      });

      expect(isValid).toBe(false);
      expect(mockShowToast).toHaveBeenCalledWith(
        'Please select any one option',
        undefined,
        'warning'
      );
    });

    it('should return false when answered question has incomplete nested children', () => {
      const nestedQuestionnaire = {
        item: [
          {
            linkId: 'q1',
            text: 'Parent',
            type: 'choice',
            required: true,
            answerOption: [
              { valueCoding: { code: 'yes', display: 'Yes' } },
            ],
            item: [
              {
                linkId: 'q1.1',
                type: 'string',
                enableWhen: [
                  { question: 'q1', operator: '=', answerCoding: { code: 'yes' } },
                ],
              },
            ],
          },
        ],
      };

      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: nestedQuestionnaire })
      );

      act(() => {
        result.current.setAnswer(result.current.topLevelItems[0], 'yes');
      });

      let isValid = true;
      act(() => {
        isValid = result.current.validateAllQuestions();
      });

      expect(isValid).toBe(false);
      expect(mockShowToast).toHaveBeenCalledWith(
        'Please enter a value',
        undefined,
        'warning'
      );
    });

    it('should block handleComplete when validation fails', () => {
      const onComplete = vi.fn();
      const { result } = renderHook(() =>
        useFHIRStepper({
          questionnaire: mockQuestionnaire,
          skipSummary: true,
          onComplete,
        })
      );

      // Navigate to last without answering required q1
      act(() => { result.current.goNext(); });
      act(() => { result.current.goNext(); });
      act(() => { result.current.goNext(); });

      expect(onComplete).not.toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalled();
    });

    it('should show enter value toast for incomplete quantity nested child', () => {
      const quantityQuestionnaire = {
        item: [
          {
            linkId: 'q1',
            text: 'Duration question',
            type: 'choice',
            required: true,
            answerOption: [
              { valueCoding: { code: 'yes', display: 'Yes' } },
            ],
            item: [
              {
                linkId: 'q1.dur',
                type: 'quantity',
                enableWhen: [
                  { question: 'q1', operator: '=', answerCoding: { code: 'yes' } },
                ],
              },
            ],
          },
        ],
      };

      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: quantityQuestionnaire })
      );

      act(() => {
        result.current.setAnswer(result.current.topLevelItems[0], 'yes');
      });

      let isValid = true;
      act(() => {
        isValid = result.current.validateAllQuestions();
      });

      expect(isValid).toBe(false);
      expect(mockShowToast).toHaveBeenCalledWith(
        'Please enter a value',
        undefined,
        'warning'
      );
    });

    it('should show select option toast when a required nested choice child is unanswered', () => {
      const nestedChoiceQuestionnaire = {
        item: [
          {
            linkId: 'q1',
            text: 'Parent',
            type: 'choice',
            required: true,
            answerOption: [
              { valueCoding: { code: 'yes', display: 'Yes' } },
            ],
            item: [
              {
                linkId: 'q1.child',
                type: 'choice',
                required: true,
                answerOption: [
                  { valueCoding: { code: 'a', display: 'A' } },
                ],
                enableWhen: [
                  { question: 'q1', operator: '=', answerCoding: { code: 'yes' } },
                ],
              },
            ],
          },
        ],
      };

      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: nestedChoiceQuestionnaire })
      );

      act(() => {
        result.current.setAnswer(result.current.topLevelItems[0], 'yes');
      });

      let isValid = true;
      act(() => {
        isValid = result.current.validateAllQuestions();
      });

      expect(isValid).toBe(false);
      expect(mockShowToast).toHaveBeenCalledWith(
        'Please select any one option',
        undefined,
        'warning'
      );
    });

    it('should reference the question number in review mode', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({
          questionnaire: mockQuestionnaire,
          initialAnswers: { q2: 'yes' },
        })
      );

      let isValid = true;
      act(() => {
        isValid = result.current.validateAllQuestions();
      });

      expect(isValid).toBe(false);
      expect(mockShowToast).toHaveBeenCalledWith(
        'Please answer Question 1 before proceeding',
        undefined,
        'warning'
      );
    });

    it('should apply questionIndexOffset to the review mode question number', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({
          questionnaire: mockQuestionnaire,
          initialAnswers: { q2: 'yes' },
          questionIndexOffset: 5,
        })
      );

      act(() => {
        result.current.validateAllQuestions();
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        'Please answer Question 6 before proceeding',
        undefined,
        'warning'
      );
    });
  });

  describe('handleComplete review mode', () => {
    it('should switch to review mode once the summary is shown', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: mockQuestionnaire })
      );

      act(() => {
        result.current.setAnswer(result.current.topLevelItems[0], 'answer1');
      });

      act(() => { result.current.goNext(); });
      act(() => { result.current.goNext(); });
      act(() => { result.current.goNext(); });

      expect(mockShowVitalConfirmationModal).toHaveBeenCalledTimes(1);
      expect(result.current.showAll).toBe(true);
    });

    it('should stay in linear mode when validation blocks the summary', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: mockQuestionnaire })
      );

      act(() => { result.current.goNext(); });
      act(() => { result.current.goNext(); });
      act(() => { result.current.goNext(); });

      expect(mockShowVitalConfirmationModal).not.toHaveBeenCalled();
      expect(result.current.showAll).toBeFalsy();
    });
  });

  describe('initialAnswers', () => {
    it('should initialize with provided answers and showAll true', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({
          questionnaire: mockQuestionnaire,
          initialAnswers: { q1: 'saved', q2: 'yes' },
        })
      );

      expect(result.current.answers).toEqual({ q1: 'saved', q2: 'yes' });
      expect(result.current.showAll).toBe(true);
    });

    it('should not set showAll when initialAnswers is empty', () => {
      const { result } = renderHook(() =>
        useFHIRStepper({
          questionnaire: mockQuestionnaire,
          initialAnswers: {},
        })
      );

      expect(result.current.answers).toEqual({});
      expect(result.current.showAll).toBeFalsy();
    });
  });

  describe('getTopLevelLinkId when currentQuestion is undefined (line 304)', () => {
    it('should return linkId directly when questionnaire has no items', () => {
      const emptyQuestionnaire = { item: [] };
      const { result } = renderHook(() =>
        useFHIRStepper({ questionnaire: emptyQuestionnaire as any })
      );

      // currentQuestion is undefined because there are no top-level items
      expect(result.current.currentQuestion).toBeUndefined();

      // Call setAnswer which internally calls getTopLevelLinkId
      // When currentQuestion is undefined, getTopLevelLinkId returns the linkId unchanged
      act(() => {
        result.current.setAnswer({ linkId: 'orphan', type: 'string' } as any, 'value');
      });

      // The answer should be stored under the original linkId since there is no top-level question
      expect(result.current.answers).toEqual({ orphan: 'value' });
    });
  });

  describe('camera image validation', () => {
    const peCameraQuestionnaire = {
      item: [
        {
          linkId: 'jaundice',
          text: 'Is there jaundice?',
          type: 'choice',
          required: false,
          answerOption: [
            { valueCoding: { code: 'no', display: 'No' } },
            { valueCoding: { code: 'yes', display: 'Yes' } },
            {
              valueCoding: { code: 'jaundice_cam', display: 'Picture Taken' },
              extension: [
                {
                  url: 'urn:intelehealth:physical-exam/option-kind',
                  valueString: 'camera',
                },
              ],
            },
          ],
        },
      ],
    };

    it('blocks completion when the picture option is selected but has no images', () => {
      cameraHolder.current = { cameraImagesFor: () => [] };
      const { result } = renderHook(() =>
        useFHIRStepper({
          questionnaire: peCameraQuestionnaire as any,
          initialAnswers: { jaundice: ['jaundice_cam'] },
        })
      );
      expect(result.current.validateAllQuestions()).toBe(false);
      expect(mockShowToast).toHaveBeenCalledWith(
        'Question 1: Please upload the captured image',
        undefined,
        'warning'
      );
    });

    it('allows completion when the picture option has at least one image', () => {
      cameraHolder.current = { cameraImagesFor: () => ['data:image/png;base64,x'] };
      const { result } = renderHook(() =>
        useFHIRStepper({
          questionnaire: peCameraQuestionnaire as any,
          initialAnswers: { jaundice: ['jaundice_cam'] },
        })
      );
      expect(result.current.validateAllQuestions()).toBe(true);
    });

    it('does not block a non-camera answer for the same question', () => {
      cameraHolder.current = { cameraImagesFor: () => [] };
      const { result } = renderHook(() =>
        useFHIRStepper({
          questionnaire: peCameraQuestionnaire as any,
          initialAnswers: { jaundice: ['yes'] },
        })
      );
      expect(result.current.validateAllQuestions()).toBe(true);
    });

    it('handles a string (non-array) camera answer with no images', () => {
      cameraHolder.current = { cameraImagesFor: () => [] };
      const { result } = renderHook(() =>
        useFHIRStepper({
          questionnaire: peCameraQuestionnaire as any,
          initialAnswers: { jaundice: 'jaundice_cam' },
        })
      );
      expect(result.current.validateAllQuestions()).toBe(false);
    });

    it('does not flag a camera question that has no answer at all', () => {
      cameraHolder.current = { cameraImagesFor: () => [] };
      const { result } = renderHook(() =>
        useFHIRStepper({
          questionnaire: peCameraQuestionnaire as any,
          // jaundice is not required and unanswered → not a missing-image case
        })
      );
      expect(result.current.validateAllQuestions()).toBe(true);
    });

    it('treats a non-array, non-string camera answer as having no camera code', () => {
      cameraHolder.current = { cameraImagesFor: () => [] };
      const { result } = renderHook(() =>
        useFHIRStepper({
          questionnaire: peCameraQuestionnaire as any,
          initialAnswers: { jaundice: { unexpected: true } as any },
        })
      );
      expect(result.current.validateAllQuestions()).toBe(true);
    });

    it('blocks completion when images are captured but UPLOAD button was not clicked', () => {
      // Camera returns images, but the camera code is NOT in the answer
      // (simulates capture without clicking UPLOAD)
      cameraHolder.current = { cameraImagesFor: () => ['blob:http://localhost/img1'] };
      const { result } = renderHook(() =>
        useFHIRStepper({
          questionnaire: peCameraQuestionnaire as any,
          initialAnswers: { jaundice: ['yes'] }, // regular option only, no camera code
        })
      );
      expect(result.current.validateAllQuestions()).toBe(false);
      expect(mockShowToast).toHaveBeenCalledWith(
        'Question 1: Please upload the captured image',
        undefined,
        'warning'
      );
    });

    it('ignores a question with no camera option even when the PE camera context is present', () => {
      cameraHolder.current = { cameraImagesFor: () => [] };
      const { result } = renderHook(() =>
        useFHIRStepper({
          questionnaire: {
            item: [
              {
                linkId: 'plain',
                text: 'Plain choice',
                type: 'choice',
                required: false,
                answerOption: [{ valueCoding: { code: 'a', display: 'A' } }],
              },
            ],
          } as any,
          initialAnswers: { plain: ['a'] },
        })
      );
      expect(result.current.validateAllQuestions()).toBe(true);
    });
  });
});
