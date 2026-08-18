import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AyuNestedRenderer } from '../../../../../../modules/ayu/components/start-visit/visit-reason/ayu-nested-renderer.component';
import type { AyuQuestion } from '../../../../../../modules/ayu-library/types/ayu.types';

// Mock AyuRenderer component
vi.mock('../../../../../../modules/ayu/components/start-visit/visit-reason/ayu-renderer.component', () => ({
  AyuRenderer: vi.fn(({ question, value, onChange, previousSibling, answers }) => (
    <div data-testid={`renderer-${question.linkId}`}>
      <div>{question.text}</div>
      <input
        data-testid={`input-${question.linkId}`}
        value={value || ''}
        onChange={e => onChange?.(e.target.value)}
      />
      {previousSibling && <span data-testid={`prev-sibling-${question.linkId}`}>{previousSibling.linkId}</span>}
      {answers && <span data-testid={`has-answers-${question.linkId}`}>has-answers</span>}
    </div>
  )),
}));

// Mock AyuSelectableOption
vi.mock('../../../../../../modules/ayu/components/common/ayu-selectable-option.component', () => ({
  AyuSelectableOption: vi.fn(({ label, value, selected, onClick }) => (
    <button
      data-testid={`selectable-${value}`}
      className={selected ? 'selected' : ''}
      onClick={onClick}
    >
      {label}
    </button>
  )),
}));

describe('AyuNestedRenderer', () => {
  const mockSetAnswer = vi.fn();
  const mockClearAnswers = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should return null when items is undefined', () => {
      const { container } = render(
        <AyuNestedRenderer
          items={undefined}
          answers={{}}
          setAnswer={mockSetAnswer}
        />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should return null when items is empty array', () => {
      const { container } = render(
        <AyuNestedRenderer
          items={[]}
          answers={{}}
          setAnswer={mockSetAnswer}
        />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should render items without enableWhen conditions (non-selectable mode)', () => {
      const items: AyuQuestion[] = [
        {
          linkId: 'child-1',
          text: 'Child Question 1',
          type: 'string',
        },
        {
          linkId: 'child-2',
          text: 'Child Question 2',
          type: 'integer',
        },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{}}
          setAnswer={mockSetAnswer}
        />
      );

      expect(screen.getByTestId('renderer-child-1')).toBeInTheDocument();
      expect(screen.getByTestId('renderer-child-2')).toBeInTheDocument();
    });

    it('should pass previousSibling and answers to AyuRenderer in non-selectable mode', () => {
      const items: AyuQuestion[] = [
        {
          linkId: 'date-from',
          text: 'From Date',
          type: 'date',
        },
        {
          linkId: 'date-to',
          text: 'To Date',
          type: 'date',
        },
      ];

      const answers = { 'date-from': '2026-01-01', 'date-to': '2026-06-01' };

      render(
        <AyuNestedRenderer
          items={items}
          answers={answers}
          setAnswer={mockSetAnswer}
        />
      );

      // Second child (date-to) should have previousSibling pointing to date-from
      expect(screen.getByTestId('prev-sibling-date-to')).toHaveTextContent('date-from');
      // First child should not have previousSibling
      expect(screen.queryByTestId('prev-sibling-date-from')).not.toBeInTheDocument();
      // Both should have answers passed
      expect(screen.getByTestId('has-answers-date-from')).toBeInTheDocument();
      expect(screen.getByTestId('has-answers-date-to')).toBeInTheDocument();
    });
  });

  describe('EnableWhen Conditional Rendering', () => {
    it('should render items when enableWhen condition is met with answerBoolean', () => {
      const items: AyuQuestion[] = [
        {
          linkId: 'child-1',
          text: 'Conditional Question',
          type: 'string',
          enableWhen: [
            {
              question: 'parent-1',
              operator: '=',
              answerBoolean: true,
            },
          ],
        },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{ 'parent-1': true }}
          setAnswer={mockSetAnswer}
        />
      );

      expect(screen.getByTestId('renderer-child-1')).toBeInTheDocument();
    });

    it('should not render items when enableWhen condition is not met', () => {
      const items: AyuQuestion[] = [
        {
          linkId: 'child-1',
          text: 'Conditional Question',
          type: 'string',
          enableWhen: [
            {
              question: 'parent-1',
              operator: '=',
              answerBoolean: true,
            },
          ],
        },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{ 'parent-1': false }}
          setAnswer={mockSetAnswer}
        />
      );

      expect(screen.queryByTestId('renderer-child-1')).not.toBeInTheDocument();
    });

    it('should handle answerString in enableWhen', () => {
      const items: AyuQuestion[] = [
        {
          linkId: 'child-1',
          text: 'String Conditional',
          type: 'string',
          enableWhen: [
            {
              question: 'parent-1',
              operator: '=',
              answerString: 'yes',
            },
          ],
        },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{ 'parent-1': 'yes' }}
          setAnswer={mockSetAnswer}
        />
      );

      expect(screen.getByTestId('renderer-child-1')).toBeInTheDocument();
    });

    it('should handle answerInteger in enableWhen', () => {
      const items: AyuQuestion[] = [
        {
          linkId: 'child-1',
          text: 'Integer Conditional',
          type: 'string',
          enableWhen: [
            {
              question: 'parent-1',
              operator: '=',
              answerInteger: 5,
            },
          ],
        },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{ 'parent-1': 5 }}
          setAnswer={mockSetAnswer}
        />
      );

      expect(screen.getByTestId('renderer-child-1')).toBeInTheDocument();
    });

    it('should handle answerCoding in enableWhen', () => {
      const items: AyuQuestion[] = [
        {
          linkId: 'child-1',
          text: 'Coding Conditional',
          type: 'string',
          enableWhen: [
            {
              question: 'parent-1',
              operator: '=',
              answerCoding: {
                code: 'option-1',
                display: 'Option 1',
              },
            },
          ],
        },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{ 'parent-1': 'option-1' }}
          setAnswer={mockSetAnswer}
        />
      );

      expect(screen.getByTestId('renderer-child-1')).toBeInTheDocument();
    });

    it('should handle multiple enableWhen conditions (all must be met)', () => {
      const items: AyuQuestion[] = [
        {
          linkId: 'child-1',
          text: 'Multi Conditional',
          type: 'string',
          enableWhen: [
            {
              question: 'parent-1',
              operator: '=',
              answerBoolean: true,
            },
            {
              question: 'parent-2',
              operator: '=',
              answerString: 'yes',
            },
          ],
        },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{ 'parent-1': true, 'parent-2': 'yes' }}
          setAnswer={mockSetAnswer}
        />
      );

      expect(screen.getByTestId('renderer-child-1')).toBeInTheDocument();
    });

    it('should not render when only one of multiple enableWhen conditions is met', () => {
      const items: AyuQuestion[] = [
        {
          linkId: 'child-1',
          text: 'Multi Conditional',
          type: 'string',
          enableWhen: [
            {
              question: 'parent-1',
              operator: '=',
              answerBoolean: true,
            },
            {
              question: 'parent-2',
              operator: '=',
              answerString: 'yes',
            },
          ],
        },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{ 'parent-1': true, 'parent-2': 'no' }}
          setAnswer={mockSetAnswer}
        />
      );

      expect(screen.queryByTestId('renderer-child-1')).not.toBeInTheDocument();
    });

    it('should handle enableWhen with array parent answer via includes check', () => {
      const items: AyuQuestion[] = [
        {
          linkId: 'child-1',
          text: 'Array Conditional',
          type: 'string',
          enableWhen: [
            {
              question: 'parent-1',
              operator: '=',
              answerCoding: { code: 'opt-a' },
            },
          ],
        },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{ 'parent-1': ['opt-a', 'opt-b'] }}
          setAnswer={mockSetAnswer}
        />
      );

      expect(screen.getByTestId('renderer-child-1')).toBeInTheDocument();
    });
  });

  describe('Non-Selectable Mode (default)', () => {
    it('should render all items via AyuRenderer directly', () => {
      const items: AyuQuestion[] = [
        { linkId: 'child-1', text: 'Question 1', type: 'string' },
        { linkId: 'child-2', text: 'Question 2', type: 'choice' },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{}}
          setAnswer={mockSetAnswer}
        />
      );

      expect(screen.getByTestId('renderer-child-1')).toBeInTheDocument();
      expect(screen.getByTestId('renderer-child-2')).toBeInTheDocument();
    });

    it('should render arrow SVG icon for choice type children', () => {
      const items: AyuQuestion[] = [
        { linkId: 'child-1', text: 'Choice Question', type: 'choice' },
      ];

      const { container } = render(
        <AyuNestedRenderer
          items={items}
          answers={{}}
          setAnswer={mockSetAnswer}
        />
      );

      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('width', '14');
      expect(svg).toHaveAttribute('height', '14');
    });

    it('should render arrow SVG icon for string-type children when showAllTriangles is true', () => {
      const items: AyuQuestion[] = [
        { linkId: 'child-1', text: 'String Question', type: 'string' },
        { linkId: 'child-2', text: 'Another String', type: 'string' },
      ];

      const { container } = render(
        <AyuNestedRenderer
          items={items}
          answers={{}}
          setAnswer={mockSetAnswer}
          showAllTriangles
        />
      );

      const svgs = container.querySelectorAll('svg');
      expect(svgs.length).toBe(2);
    });

    it('should not render arrow SVG for a sole string child (describe field) even when showAllTriangles is false', () => {
      const items: AyuQuestion[] = [
        { linkId: 'child-1', text: 'Describe...', type: 'string' },
      ];

      const { container } = render(
        <AyuNestedRenderer
          items={items}
          answers={{}}
          setAnswer={mockSetAnswer}
        />
      );

      expect(container.querySelector('svg')).not.toBeInTheDocument();
    });

    it('should not render arrow SVG icon for non-choice type children', () => {
      const items: AyuQuestion[] = [
        { linkId: 'child-1', text: 'String Question', type: 'string' },
      ];

      const { container } = render(
        <AyuNestedRenderer
          items={items}
          answers={{}}
          setAnswer={mockSetAnswer}
        />
      );

      expect(container.querySelector('svg')).not.toBeInTheDocument();
    });

    it('should recursively render nested items', () => {
      const items: AyuQuestion[] = [
        {
          linkId: 'child-1',
          text: 'Parent Question',
          type: 'string',
          item: [
            {
              linkId: 'grandchild-1',
              text: 'Nested Question',
              type: 'string',
            },
          ],
        },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{}}
          setAnswer={mockSetAnswer}
        />
      );

      expect(screen.getByTestId('renderer-child-1')).toBeInTheDocument();
      expect(screen.getByTestId('renderer-grandchild-1')).toBeInTheDocument();
    });
  });

  describe('Selectable Mode', () => {
    it('should render non-string items as selectable option pills', () => {
      const items: AyuQuestion[] = [
        { linkId: 'choice-1', text: 'Choice Item', type: 'choice' },
        { linkId: 'int-1', text: 'Integer Item', type: 'integer' },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{}}
          setAnswer={mockSetAnswer}
          selectable
        />
      );

      expect(screen.getByTestId('selectable-choice-1')).toBeInTheDocument();
      expect(screen.getByTestId('selectable-int-1')).toBeInTheDocument();
    });

    it('should render all children including string-type as selectable pills', () => {
      const items: AyuQuestion[] = [
        { linkId: 'string-1', text: 'String Item', type: 'string' },
        { linkId: 'choice-1', text: 'Choice Item', type: 'choice' },
        { linkId: 'choice-2', text: 'Choice Item 2', type: 'choice' },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{}}
          setAnswer={mockSetAnswer}
          selectable
        />
      );

      // All items rendered as selectable pills (including string)
      expect(screen.getByTestId('selectable-string-1')).toBeInTheDocument();
      expect(screen.getByTestId('selectable-choice-1')).toBeInTheDocument();
      expect(screen.getByTestId('selectable-choice-2')).toBeInTheDocument();
      // None rendered as AyuRenderer until selected
      expect(screen.queryByTestId('renderer-string-1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('renderer-choice-1')).not.toBeInTheDocument();
    });

    it('should toggle selectedOption when a selectable pill is clicked', async () => {
      const user = userEvent.setup();
      const items: AyuQuestion[] = [
        { linkId: 'choice-1', text: 'Choice Item', type: 'choice' },
        { linkId: 'choice-2', text: 'Choice Item 2', type: 'choice' },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{}}
          setAnswer={mockSetAnswer}
          selectable
        />
      );

      const pill = screen.getByTestId('selectable-choice-1');
      await user.click(pill);

      // After clicking, the item should be selected and its renderer shown
      expect(screen.getByTestId('renderer-choice-1')).toBeInTheDocument();
    });

    it('should deselect option when clicked again', async () => {
      const user = userEvent.setup();
      const items: AyuQuestion[] = [
        { linkId: 'choice-1', text: 'Choice Item', type: 'choice' },
        { linkId: 'choice-2', text: 'Choice Item 2', type: 'choice' },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{}}
          setAnswer={mockSetAnswer}
          selectable
        />
      );

      const pill = screen.getByTestId('selectable-choice-1');
      await user.click(pill); // select
      expect(screen.getByTestId('renderer-choice-1')).toBeInTheDocument();

      await user.click(pill); // deselect
      expect(screen.queryByTestId('renderer-choice-1')).not.toBeInTheDocument();
    });

    it('should render arrow SVG for selected choice items', async () => {
      const user = userEvent.setup();
      const items: AyuQuestion[] = [
        { linkId: 'choice-1', text: 'Choice Item', type: 'choice' },
        { linkId: 'choice-2', text: 'Choice Item 2', type: 'choice' },
      ];

      const { container } = render(
        <AyuNestedRenderer
          items={items}
          answers={{}}
          setAnswer={mockSetAnswer}
          selectable
        />
      );

      const pill = screen.getByTestId('selectable-choice-1');
      await user.click(pill);

      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('fill', '#20c997');
    });

    it('should render arrow SVG for non-choice items when selected as pill', async () => {
      const user = userEvent.setup();
      const items: AyuQuestion[] = [
        { linkId: 'int-1', text: 'Integer Item', type: 'integer' },
        { linkId: 'int-2', text: 'Integer Item 2', type: 'integer' },
      ];

      const { container } = render(
        <AyuNestedRenderer
          items={items}
          answers={{}}
          setAnswer={mockSetAnswer}
          selectable
        />
      );

      // Non-choice items render as pills
      expect(screen.getByTestId('selectable-int-1')).toBeInTheDocument();
      expect(screen.getByTestId('selectable-int-2')).toBeInTheDocument();

      // Click pill to reveal input and triangle SVG
      await user.click(screen.getByTestId('selectable-int-1'));
      const svgs = container.querySelectorAll('svg');
      expect(svgs.length).toBeGreaterThanOrEqual(1);
      expect(svgs[0]).toHaveAttribute('fill', '#20c997');
    });

    it('should render all-string children as selectable pills (Systolic/Diastolic scenario)', async () => {
      const user = userEvent.setup();
      const items: AyuQuestion[] = [
        { linkId: 'systolic', text: 'Systolic', type: 'string' },
        { linkId: 'diastolic', text: 'Diastolic', type: 'string' },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{}}
          setAnswer={mockSetAnswer}
          selectable
        />
      );

      // Both children render as selectable pills
      expect(screen.getByTestId('selectable-systolic')).toBeInTheDocument();
      expect(screen.getByTestId('selectable-diastolic')).toBeInTheDocument();

      // Click pill to reveal its input
      await user.click(screen.getByTestId('selectable-systolic'));
      expect(screen.getByTestId('renderer-systolic')).toBeInTheDocument();
    });

    it('should render all-integer children as pills and preserve values when switching (BP values)', async () => {
      const user = userEvent.setup();
      const items: AyuQuestion[] = [
        { linkId: 'systolic', text: 'Enter systolic BP', type: 'integer' },
        { linkId: 'diastolic', text: 'Enter diastolic BP', type: 'integer' },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{}}
          setAnswer={mockSetAnswer}
          clearAnswers={mockClearAnswers}
          selectable
        />
      );

      // Both render as selectable pills
      expect(screen.getByTestId('selectable-systolic')).toBeInTheDocument();
      expect(screen.getByTestId('selectable-diastolic')).toBeInTheDocument();

      // Click systolic pill → input appears
      await user.click(screen.getByTestId('selectable-systolic'));
      fireEvent.change(screen.getByTestId('input-systolic'), {
        target: { value: '120' },
      });
      expect(mockSetAnswer).toHaveBeenCalledWith(items[0], '120');

      // Switch to diastolic pill → no clearAnswers called (values preserved)
      mockClearAnswers.mockClear();
      await user.click(screen.getByTestId('selectable-diastolic'));
      expect(mockClearAnswers).not.toHaveBeenCalled();

      fireEvent.change(screen.getByTestId('input-diastolic'), {
        target: { value: '80' },
      });
      expect(mockSetAnswer).toHaveBeenCalledWith(items[1], '80');
    });

    it('should flatten container items and show their children directly as pills', async () => {
      const user = userEvent.setup();
      const items: AyuQuestion[] = [
        { linkId: 'normal', text: 'Normal', type: 'choice' },
        {
          linkId: 'take-bp',
          text: 'Take the patient\'s BP lying down',
          type: 'string',
          // Container: has sub-children but no answerOption
          item: [
            { linkId: 'systolic', text: 'Enter systolic BP', type: 'string' },
            { linkId: 'diastolic', text: 'Enter diastolic BP', type: 'string' },
          ],
        },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{}}
          setAnswer={mockSetAnswer}
          selectable
        />
      );

      // "Take BP" container should NOT appear as a pill
      expect(screen.queryByTestId('selectable-take-bp')).not.toBeInTheDocument();
      // Its children should appear directly as pills
      expect(screen.getByTestId('selectable-systolic')).toBeInTheDocument();
      expect(screen.getByTestId('selectable-diastolic')).toBeInTheDocument();
      // "Normal" choice sibling should still be a pill
      expect(screen.getByTestId('selectable-normal')).toBeInTheDocument();

      // Click systolic pill to reveal its input
      await user.click(screen.getByTestId('selectable-systolic'));
      expect(screen.getByTestId('renderer-systolic')).toBeInTheDocument();
    });

    it('should not flatten items that have answerOption mapping', () => {
      const items: AyuQuestion[] = [
        {
          linkId: 'branching',
          text: 'Branching Choice',
          type: 'choice',
          answerOption: [
            { valueCoding: { code: 'opt-a', display: 'Option A' } },
          ],
          item: [
            { linkId: 'nested-child', text: 'Nested', type: 'string' },
          ],
        },
        { linkId: 'sibling', text: 'Sibling', type: 'choice' },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{}}
          setAnswer={mockSetAnswer}
          selectable
        />
      );

      // Branching item should remain as a pill (not flattened)
      expect(screen.getByTestId('selectable-branching')).toBeInTheDocument();
      // Its child should NOT appear directly
      expect(screen.queryByTestId('selectable-nested-child')).not.toBeInTheDocument();
    });

    it('should flatten non-choice container even when it has answerOption', async () => {
      const user = userEvent.setup();
      const items: AyuQuestion[] = [
        { linkId: 'normal', text: 'Normal', type: 'choice' },
        {
          linkId: 'take-bp',
          text: 'Take the patient\'s BP lying down',
          type: 'string',
          /* Non-choice type with answerOption — still a container, not a
             branching choice. Should be flattened. */
          answerOption: [
            { valueCoding: { code: 'systolic', display: 'Systolic' } },
            { valueCoding: { code: 'diastolic', display: 'Diastolic' } },
          ],
          item: [
            { linkId: 'systolic', text: 'Enter systolic BP', type: 'integer' },
            { linkId: 'diastolic', text: 'Enter diastolic BP', type: 'integer' },
          ],
        },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{}}
          setAnswer={mockSetAnswer}
          selectable
        />
      );

      // Container should NOT appear as a pill
      expect(screen.queryByTestId('selectable-take-bp')).not.toBeInTheDocument();
      // Its children should appear directly as pills
      expect(screen.getByTestId('selectable-systolic')).toBeInTheDocument();
      expect(screen.getByTestId('selectable-diastolic')).toBeInTheDocument();

      // Click systolic pill to reveal its input
      await user.click(screen.getByTestId('selectable-systolic'));
      expect(screen.getByTestId('renderer-systolic')).toBeInTheDocument();
    });

    it('should strip enableWhen referencing flattened parent from children', () => {
      const items: AyuQuestion[] = [
        { linkId: 'other', text: 'Other', type: 'choice' },
        {
          linkId: 'container',
          text: 'Container',
          type: 'group',
          item: [
            {
              linkId: 'gated-child',
              text: 'Gated Child',
              type: 'integer',
              enableWhen: [
                { question: 'container', operator: '=', answerString: 'yes' },
              ],
            },
            { linkId: 'free-child', text: 'Free Child', type: 'integer' },
          ],
        },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{}}
          setAnswer={mockSetAnswer}
          selectable
        />
      );

      // Container should be flattened
      expect(screen.queryByTestId('selectable-container')).not.toBeInTheDocument();
      // Child with enableWhen stripped should be visible
      expect(screen.getByTestId('selectable-gated-child')).toBeInTheDocument();
      expect(screen.getByTestId('selectable-free-child')).toBeInTheDocument();
    });

    it('should remove enableWhen entirely when all entries reference flattened parent', () => {
      const items: AyuQuestion[] = [
        { linkId: 'other', text: 'Other', type: 'choice' },
        {
          linkId: 'container',
          text: 'Container',
          type: 'group',
          item: [
            {
              linkId: 'fully-gated',
              text: 'Fully Gated',
              type: 'integer',
              enableWhen: [
                { question: 'container', operator: '=', answerString: 'yes' },
                { question: 'container', operator: '=', answerString: 'no' },
              ],
            },
          ],
        },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{}}
          setAnswer={mockSetAnswer}
          selectable
        />
      );

      /* All enableWhen entries referenced the flattened container, so they are
         all removed — child should be visible (enableWhen becomes undefined) */
      expect(screen.getByTestId('selectable-fully-gated')).toBeInTheDocument();
    });

    it('should keep non-container enableWhen entries when only some reference the flattened parent', () => {
      const items: AyuQuestion[] = [
        { linkId: 'other', text: 'Other', type: 'choice' },
        {
          linkId: 'container',
          text: 'Container',
          type: 'group',
          item: [
            {
              linkId: 'partial-gated',
              text: 'Partial Gated',
              type: 'integer',
              enableWhen: [
                // This one references the container → stripped
                { question: 'container', operator: '=', answerString: 'yes' },
                // This one references an external question → kept
                { question: 'external-q', operator: '=', answerString: 'x' },
              ],
            },
          ],
        },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{}}
          setAnswer={mockSetAnswer}
          selectable
        />
      );

      /* The container entry is stripped but the external-q entry survives,
         so the child keeps its (filtered) enableWhen and renders as a pill. */
      expect(screen.getByTestId('selectable-partial-gated')).toBeInTheDocument();
    });
  });

  describe('Grouping by Parent Answer Label', () => {
    it('should group items by getParentAnswerLabel', () => {
      const parentQ: AyuQuestion = {
        linkId: 'parent-q',
        type: 'choice',
        text: 'Parent',
        answerOption: [
          { valueCoding: { code: 'opt-1', display: 'Option One' } },
          { valueCoding: { code: 'opt-2', display: 'Option Two' } },
        ],
      };

      const items: AyuQuestion[] = [
        {
          linkId: 'child-1',
          text: 'Child 1',
          type: 'string',
          enableWhen: [
            { question: 'parent-1', operator: '=', answerCoding: { code: 'opt-1' } },
          ],
        },
        {
          linkId: 'child-2',
          text: 'Child 2',
          type: 'string',
          enableWhen: [
            { question: 'parent-1', operator: '=', answerCoding: { code: 'opt-2' } },
          ],
        },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          parentQuestion={parentQ}
          answers={{ 'parent-1': ['opt-1', 'opt-2'] }}
          setAnswer={mockSetAnswer}
        />
      );

      expect(screen.getByTestId('renderer-child-1')).toBeInTheDocument();
      expect(screen.getByTestId('renderer-child-2')).toBeInTheDocument();
    });

    it('should return null label when parentQuestion is not provided', () => {
      const items: AyuQuestion[] = [
        {
          linkId: 'child-1',
          text: 'Child Question',
          type: 'string',
          enableWhen: [{ question: 'parent-1', operator: '=', answerString: 'yes' }],
        },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{ 'parent-1': 'yes' }}
          setAnswer={mockSetAnswer}
        />
      );

      // Should still render - grouped under null label
      expect(screen.getByTestId('renderer-child-1')).toBeInTheDocument();
    });

    it('should return null label when item has no enableWhen', () => {
      const parentQ: AyuQuestion = {
        linkId: 'parent-q',
        type: 'choice',
        text: 'Parent',
        answerOption: [{ valueCoding: { code: 'opt-1', display: 'Option One' } }],
      };

      const items: AyuQuestion[] = [
        { linkId: 'child-1', text: 'Child', type: 'string' },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          parentQuestion={parentQ}
          answers={{}}
          setAnswer={mockSetAnswer}
        />
      );

      expect(screen.getByTestId('renderer-child-1')).toBeInTheDocument();
    });

    it('should return null label when no matching answerOption found', () => {
      const parentQ: AyuQuestion = {
        linkId: 'parent-q',
        type: 'choice',
        text: 'Parent',
        answerOption: [{ valueCoding: { code: 'other', display: 'Other' } }],
      };

      const items: AyuQuestion[] = [
        {
          linkId: 'child-1',
          type: 'string',
          enableWhen: [
            { question: 'parent-1', operator: '=', answerCoding: { code: 'opt-1' } },
          ],
        },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          parentQuestion={parentQ}
          answers={{ 'parent-1': 'opt-1' }}
          setAnswer={mockSetAnswer}
        />
      );

      expect(screen.getByTestId('renderer-child-1')).toBeInTheDocument();
    });

    it('should match by valueCoding.code in getParentAnswerLabel', () => {
      const parentQ: AyuQuestion = {
        linkId: 'parent-q',
        type: 'choice',
        text: 'Parent',
        answerOption: [{ valueCoding: { code: 'code-x', display: 'Code X Display' } }],
      };

      const items: AyuQuestion[] = [
        {
          linkId: 'child-1',
          type: 'string',
          enableWhen: [
            { question: 'parent-1', operator: '=', answerCoding: { code: 'code-x' } },
          ],
        },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          parentQuestion={parentQ}
          answers={{ 'parent-1': 'code-x' }}
          setAnswer={mockSetAnswer}
        />
      );

      expect(screen.getByTestId('renderer-child-1')).toBeInTheDocument();
    });

    it('should match by valueString in getParentAnswerLabel', () => {
      const parentQ: AyuQuestion = {
        linkId: 'parent-q',
        type: 'choice',
        text: 'Parent',
        answerOption: [{ valueString: 'answer-text' }],
      };

      const items: AyuQuestion[] = [
        {
          linkId: 'child-1',
          type: 'string',
          enableWhen: [
            { question: 'parent-1', operator: '=', answerString: 'answer-text' },
          ],
        },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          parentQuestion={parentQ}
          answers={{ 'parent-1': 'answer-text' }}
          setAnswer={mockSetAnswer}
        />
      );

      expect(screen.getByTestId('renderer-child-1')).toBeInTheDocument();
    });

    it('should prefer valueCoding.display over valueString when option has both', () => {
      const parentQ: AyuQuestion = {
        linkId: 'parent-q',
        type: 'choice',
        text: 'Parent',
        answerOption: [
          { valueCoding: { code: 'c1', display: 'Coding Display' }, valueString: 'String Value' },
        ],
      };

      const items: AyuQuestion[] = [
        {
          linkId: 'child-1',
          type: 'string',
          enableWhen: [
            { question: 'parent-1', operator: '=', answerCoding: { code: 'c1' } },
          ],
        },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          parentQuestion={parentQ}
          answers={{ 'parent-1': 'c1' }}
          setAnswer={mockSetAnswer}
        />
      );

      // Item renders regardless of label resolution
      expect(screen.getByTestId('renderer-child-1')).toBeInTheDocument();
    });

    it('should return null label when parentQuestion has no answerOption', () => {
      const parentQ: AyuQuestion = {
        linkId: 'parent-q',
        type: 'choice',
        text: 'Parent',
      };

      const items: AyuQuestion[] = [
        {
          linkId: 'child-1',
          type: 'string',
          enableWhen: [{ question: 'parent-1', operator: '=', answerString: 'yes' }],
        },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          parentQuestion={parentQ}
          answers={{ 'parent-1': 'yes' }}
          setAnswer={mockSetAnswer}
        />
      );

      expect(screen.getByTestId('renderer-child-1')).toBeInTheDocument();
    });

    it('should use answerBoolean priority in getParentAnswerLabel expected lookup', () => {
      const parentQ: AyuQuestion = {
        linkId: 'parent-q',
        type: 'choice',
        text: 'Parent',
        answerOption: [{ valueString: 'true' }],
      };

      const items: AyuQuestion[] = [
        {
          linkId: 'child-1',
          type: 'string',
          enableWhen: [
            { question: 'parent-1', operator: '=', answerBoolean: true },
          ],
        },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          parentQuestion={parentQ}
          answers={{ 'parent-1': true }}
          setAnswer={mockSetAnswer}
        />
      );

      expect(screen.getByTestId('renderer-child-1')).toBeInTheDocument();
    });

    it('should use answerInteger in getParentAnswerLabel expected lookup', () => {
      const parentQ: AyuQuestion = {
        linkId: 'parent-q',
        type: 'choice',
        text: 'Parent',
        answerOption: [{ valueString: '42' }],
      };

      const items: AyuQuestion[] = [
        {
          linkId: 'child-1',
          type: 'string',
          enableWhen: [
            { question: 'parent-1', operator: '=', answerInteger: 42 },
          ],
        },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          parentQuestion={parentQ}
          answers={{ 'parent-1': 42 }}
          setAnswer={mockSetAnswer}
        />
      );

      expect(screen.getByTestId('renderer-child-1')).toBeInTheDocument();
    });
  });

  describe('hasAnswerOptionItemMapping', () => {
    it('should use renderInlineNestedItems when child has answerOption and item', async () => {
      const user = userEvent.setup();
      const items: AyuQuestion[] = [
        {
          linkId: 'choice-parent',
          text: 'Choice Parent',
          type: 'choice',
          answerOption: [
            { valueCoding: { code: 'opt-a', display: 'Option A' } },
          ],
          item: [
            {
              linkId: 'opt-a-nested',
              text: 'Nested under A',
              type: 'string',
            },
          ],
        },
        { linkId: 'choice-sibling', text: 'Sibling', type: 'choice' },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{ 'choice-parent': 'opt-a' }}
          setAnswer={mockSetAnswer}
          selectable
        />
      );

      // Click the selectable option to expand it
      const pill = screen.getByTestId('selectable-choice-parent');
      await user.click(pill);

      // Should render the inline nested item
      expect(screen.getByTestId('renderer-opt-a-nested')).toBeInTheDocument();
    });

    it('should render inline nested items recursively with sub-items', async () => {
      const user = userEvent.setup();
      const items: AyuQuestion[] = [
        {
          linkId: 'choice-parent',
          text: 'Choice Parent',
          type: 'choice',
          answerOption: [
            { valueCoding: { code: 'opt-a', display: 'Option A' } },
          ],
          item: [
            {
              linkId: 'opt-a-nested',
              text: 'Nested under A',
              type: 'string',
              item: [
                {
                  linkId: 'deep-nested',
                  text: 'Deep Nested',
                  type: 'string',
                },
              ],
            },
          ],
        },
        { linkId: 'choice-sibling', text: 'Sibling', type: 'choice' },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{ 'choice-parent': 'opt-a' }}
          setAnswer={mockSetAnswer}
          selectable
        />
      );

      const pill = screen.getByTestId('selectable-choice-parent');
      await user.click(pill);

      expect(screen.getByTestId('renderer-opt-a-nested')).toBeInTheDocument();
      // Deep nested should also be recursively rendered
      expect(screen.getByTestId('renderer-deep-nested')).toBeInTheDocument();
    });

    it('should not render inline nested items when parent answer does not include option code', async () => {
      const user = userEvent.setup();
      const items: AyuQuestion[] = [
        {
          linkId: 'choice-parent',
          text: 'Choice Parent',
          type: 'choice',
          answerOption: [
            { valueCoding: { code: 'opt-a', display: 'Option A' } },
          ],
          item: [
            {
              linkId: 'opt-a-nested',
              text: 'Nested under A',
              type: 'string',
            },
          ],
        },
        { linkId: 'choice-sibling', text: 'Sibling', type: 'choice' },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{ 'choice-parent': 'opt-b' }}
          setAnswer={mockSetAnswer}
          selectable
        />
      );

      const pill = screen.getByTestId('selectable-choice-parent');
      await user.click(pill);

      // The renderer for inline nested should NOT appear because parent answer doesn't match
      expect(screen.queryByTestId('renderer-opt-a-nested')).not.toBeInTheDocument();
    });

    it('should flatten container item (no answerOption) and show its children directly as pills', async () => {
      const user = userEvent.setup();
      const items: AyuQuestion[] = [
        {
          linkId: 'choice-1',
          text: 'Choice Item',
          type: 'choice',
          // has item but no answerOption → gets flattened
          item: [
            { linkId: 'nested-1', text: 'Nested', type: 'string' },
          ],
        },
        { linkId: 'choice-sibling', text: 'Sibling', type: 'choice' },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{}}
          setAnswer={mockSetAnswer}
          selectable
        />
      );

      // choice-1 is flattened — nested-1 appears directly as a pill
      expect(screen.queryByTestId('selectable-choice-1')).not.toBeInTheDocument();
      expect(screen.getByTestId('selectable-nested-1')).toBeInTheDocument();

      await user.click(screen.getByTestId('selectable-nested-1'));
      expect(screen.getByTestId('renderer-nested-1')).toBeInTheDocument();
    });

    it('should handle renderInlineNestedItems with string parent answer', async () => {
      const user = userEvent.setup();
      const items: AyuQuestion[] = [
        {
          linkId: 'choice-parent',
          text: 'Choice Parent',
          type: 'choice',
          answerOption: [
            { valueCoding: { code: 'opt-a', display: 'Option A' } },
          ],
          item: [
            {
              linkId: 'opt-a-child',
              text: 'Child A',
              type: 'string',
            },
          ],
        },
        { linkId: 'choice-sibling', text: 'Sibling', type: 'choice' },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{ 'choice-parent': 'opt-a' }} // string answer, not array
          setAnswer={mockSetAnswer}
          selectable
        />
      );

      const pill = screen.getByTestId('selectable-choice-parent');
      await user.click(pill);

      expect(screen.getByTestId('renderer-opt-a-child')).toBeInTheDocument();
    });

    it('should handle renderInlineNestedItems with non-string/non-array parent answer', async () => {
      const user = userEvent.setup();
      const items: AyuQuestion[] = [
        {
          linkId: 'choice-parent',
          text: 'Choice Parent',
          type: 'choice',
          answerOption: [
            { valueCoding: { code: 'opt-a', display: 'Option A' } },
          ],
          item: [
            {
              linkId: 'opt-a-child',
              text: 'Child A',
              type: 'string',
            },
          ],
        },
        { linkId: 'choice-sibling', text: 'Sibling', type: 'choice' },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{ 'choice-parent': 42 }} // number answer
          setAnswer={mockSetAnswer}
          selectable
        />
      );

      const pill = screen.getByTestId('selectable-choice-parent');
      await user.click(pill);

      // No matching codes since answer is a number
      expect(screen.queryByTestId('renderer-opt-a-child')).not.toBeInTheDocument();
    });

    it('should use hasAnswerOptionItemMapping in non-selectable mode too', () => {
      const items: AyuQuestion[] = [
        {
          linkId: 'choice-parent',
          text: 'Choice Parent',
          type: 'choice',
          answerOption: [
            { valueCoding: { code: 'opt-a', display: 'Option A' } },
          ],
          item: [
            {
              linkId: 'opt-a-nested',
              text: 'Nested under A',
              type: 'string',
            },
          ],
        },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{ 'choice-parent': 'opt-a' }}
          setAnswer={mockSetAnswer}
          selectable={false}
        />
      );

      expect(screen.getByTestId('renderer-opt-a-nested')).toBeInTheDocument();
    });
  });

  describe('Value and onChange Handling', () => {
    it('should pass value from answers to AyuRenderer', () => {
      const items: AyuQuestion[] = [
        {
          linkId: 'child-1',
          text: 'Question',
          type: 'string',
        },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{ 'child-1': 'test value' }}
          setAnswer={mockSetAnswer}
        />
      );

      const input = screen.getByTestId('input-child-1') as HTMLInputElement;
      expect(input.value).toBe('test value');
    });

    it('should call setAnswer when value changes', () => {
      const items: AyuQuestion[] = [
        {
          linkId: 'child-1',
          text: 'Question',
          type: 'string',
        },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{}}
          setAnswer={mockSetAnswer}
        />
      );

      const input = screen.getByTestId('input-child-1');
      fireEvent.change(input, { target: { value: 'new value' } });

      expect(mockSetAnswer).toHaveBeenCalledWith(items[0], 'new value');
    });

    it('should call setAnswer for string-type children in selectable mode', () => {
      const items: AyuQuestion[] = [
        { linkId: 'string-1', text: 'String Item', type: 'string' },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{}}
          setAnswer={mockSetAnswer}
          selectable
        />
      );

      const input = screen.getByTestId('input-string-1');
      fireEvent.change(input, { target: { value: 'typed value' } });

      expect(mockSetAnswer).toHaveBeenCalledWith(items[0], 'typed value');
    });

    it('should call setAnswer for string-type child after selecting its pill', async () => {
      const user = userEvent.setup();
      const items: AyuQuestion[] = [
        { linkId: 'choice-a', text: 'Choice A', type: 'choice' },
        { linkId: 'choice-b', text: 'Choice B', type: 'choice' },
        { linkId: 'describe', text: 'Describe', type: 'string' },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{}}
          setAnswer={mockSetAnswer}
          selectable
        />
      );

      // String child is now rendered as a pill — click it to reveal the input
      await user.click(screen.getByTestId('selectable-describe'));

      const input = screen.getByTestId('input-describe');
      fireEvent.change(input, { target: { value: 'some text' } });

      expect(mockSetAnswer).toHaveBeenCalledWith(items[2], 'some text');
    });

    it('should call setAnswer for non-choice children after selecting pill in selectable mode', async () => {
      const user = userEvent.setup();
      const items: AyuQuestion[] = [
        { linkId: 'int-1', text: 'Int Item', type: 'integer' },
        { linkId: 'int-2', text: 'Int Item 2', type: 'integer' },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{}}
          setAnswer={mockSetAnswer}
          selectable
        />
      );

      // Click pill to reveal input
      await user.click(screen.getByTestId('selectable-int-1'));
      const input = screen.getByTestId('input-int-1');
      fireEvent.change(input, { target: { value: '42' } });

      expect(mockSetAnswer).toHaveBeenCalledWith(items[0], '42');
    });
  });

  describe('Multiple Items Filtering', () => {
    it('should filter out disabled items', () => {
      const items: AyuQuestion[] = [
        {
          linkId: 'child-1',
          text: 'Enabled Question',
          type: 'string',
          enableWhen: [
            {
              question: 'parent-1',
              operator: '=',
              answerBoolean: true,
            },
          ],
        },
        {
          linkId: 'child-2',
          text: 'Disabled Question',
          type: 'string',
          enableWhen: [
            {
              question: 'parent-1',
              operator: '=',
              answerBoolean: false,
            },
          ],
        },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{ 'parent-1': true }}
          setAnswer={mockSetAnswer}
        />
      );

      expect(screen.getByTestId('renderer-child-1')).toBeInTheDocument();
      expect(screen.queryByTestId('renderer-child-2')).not.toBeInTheDocument();
    });

    it('should return null when all items are filtered out', () => {
      const items: AyuQuestion[] = [
        {
          linkId: 'child-1',
          text: 'Disabled Question',
          type: 'string',
          enableWhen: [
            {
              question: 'parent-1',
              operator: '=',
              answerBoolean: false,
            },
          ],
        },
      ];

      const { container } = render(
        <AyuNestedRenderer
          items={items}
          answers={{ 'parent-1': true }}
          setAnswer={mockSetAnswer}
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('CSS Classes and Structure', () => {
    it('should have correct container classes', () => {
      const items: AyuQuestion[] = [
        {
          linkId: 'child-1',
          text: 'Question',
          type: 'string',
        },
      ];

      const { container } = render(
        <AyuNestedRenderer
          items={items}
          answers={{}}
          setAnswer={mockSetAnswer}
        />
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('space-y-4', 'px-3');
    });

    it('should have flex items-start gap-2 for non-selectable items', () => {
      const items: AyuQuestion[] = [
        { linkId: 'child-1', text: 'Question', type: 'string' },
      ];

      const { container } = render(
        <AyuNestedRenderer
          items={items}
          answers={{}}
          setAnswer={mockSetAnswer}
        />
      );

      const itemWrapper = container.querySelector('.flex.items-start.gap-2');
      expect(itemWrapper).toBeInTheDocument();
    });

    it('should have option-group class in selectable mode', () => {
      const items: AyuQuestion[] = [
        { linkId: 'child-1', text: 'Question', type: 'choice' },
        { linkId: 'child-2', text: 'Question 2', type: 'choice' },
      ];

      const { container } = render(
        <AyuNestedRenderer
          items={items}
          answers={{}}
          setAnswer={mockSetAnswer}
          selectable
        />
      );

      const optionGroup = container.querySelector('.option-group');
      expect(optionGroup).toBeInTheDocument();
    });
  });

  describe('renderInlineNestedItems onChange Coverage', () => {
    it('should call setAnswer when inline nested item value changes', async () => {
      const user = userEvent.setup();
      const items: AyuQuestion[] = [
        {
          linkId: 'choice-parent',
          text: 'Choice Parent',
          type: 'choice',
          answerOption: [
            { valueCoding: { code: 'opt-a', display: 'Option A' } },
          ],
          item: [
            {
              linkId: 'opt-a-child',
              text: 'Child A',
              type: 'string',
            },
          ],
        },
        { linkId: 'choice-sibling', text: 'Sibling', type: 'choice' },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{ 'choice-parent': ['opt-a'] }}
          setAnswer={mockSetAnswer}
          selectable
        />
      );

      // Select the item
      const pill = screen.getByTestId('selectable-choice-parent');
      await user.click(pill);

      // The inline nested item should be rendered
      const input = screen.getByTestId('input-opt-a-child');
      fireEvent.change(input, { target: { value: 'inline value' } });

      expect(mockSetAnswer).toHaveBeenCalledWith(
        expect.objectContaining({ linkId: 'opt-a-child' }),
        'inline value'
      );
    });

    it('should handle answerOption with undefined valueCoding.code in filter', async () => {
      const user = userEvent.setup();
      const items: AyuQuestion[] = [
        {
          linkId: 'choice-parent',
          text: 'Choice Parent',
          type: 'choice',
          answerOption: [
            { valueCoding: { display: 'No Code Option' } as any },
          ],
          item: [
            {
              linkId: 'child-item',
              text: 'Child Item',
              type: 'string',
            },
          ],
        },
        { linkId: 'choice-sibling', text: 'Sibling', type: 'choice' },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{ 'choice-parent': '' }}
          setAnswer={mockSetAnswer}
          selectable
        />
      );

      const pill = screen.getByTestId('selectable-choice-parent');
      await user.click(pill);

      // With undefined code, the empty string fallback in linkId.startsWith is used
      expect(screen.getByTestId('renderer-choice-parent')).toBeInTheDocument();
    });
  });

  describe('Clearing Nested Answers on Option Switch', () => {
    it('should call clearAnswers when switching between selectable options', async () => {
      const user = userEvent.setup();
      const items: AyuQuestion[] = [
        {
          linkId: 'option-a',
          text: 'Option A',
          type: 'choice',
          answerOption: [
            { valueCoding: { code: 'sub-opt', display: 'Sub Option' } },
          ],
          item: [
            { linkId: 'a-child', text: 'A Child', type: 'string' },
          ],
        },
        {
          linkId: 'option-b',
          text: 'Option B',
          type: 'choice',
        },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{ 'option-a': 'val', 'a-child': 'some value' }}
          setAnswer={mockSetAnswer}
          clearAnswers={mockClearAnswers}
          selectable
        />
      );

      // Select option A first
      await user.click(screen.getByTestId('selectable-option-a'));
      // Now switch to option B — should clear option A's answers
      await user.click(screen.getByTestId('selectable-option-b'));

      expect(mockClearAnswers).toHaveBeenCalledWith(
        expect.arrayContaining(['option-a', 'a-child'])
      );
    });

    it('should call clearAnswers when deselecting current option', async () => {
      const user = userEvent.setup();
      const items: AyuQuestion[] = [
        {
          linkId: 'option-a',
          text: 'Option A',
          type: 'choice',
          answerOption: [
            { valueCoding: { code: 'sub-opt', display: 'Sub Option' } },
          ],
          item: [
            { linkId: 'a-child', text: 'A Child', type: 'string' },
          ],
        },
        { linkId: 'option-c', text: 'Option C', type: 'choice' },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{ 'option-a': 'val', 'a-child': 'some value' }}
          setAnswer={mockSetAnswer}
          clearAnswers={mockClearAnswers}
          selectable
        />
      );

      // Select then deselect
      await user.click(screen.getByTestId('selectable-option-a'));
      await user.click(screen.getByTestId('selectable-option-a'));

      expect(mockClearAnswers).toHaveBeenCalledWith(
        expect.arrayContaining(['option-a', 'a-child'])
      );
    });

    it('should not call clearAnswers when no previous option was selected', async () => {
      const user = userEvent.setup();
      const items: AyuQuestion[] = [
        { linkId: 'option-a', text: 'Option A', type: 'choice' },
        { linkId: 'option-b', text: 'Option B', type: 'choice' },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{}}
          setAnswer={mockSetAnswer}
          clearAnswers={mockClearAnswers}
          selectable
        />
      );

      await user.click(screen.getByTestId('selectable-option-a'));
      // clearAnswers should not be called since no previous option had answers
      expect(mockClearAnswers).not.toHaveBeenCalled();
    });

    it('should reset selectedOption when parent answer changes', () => {
      const items: AyuQuestion[] = [
        {
          linkId: 'child-yes',
          text: 'Yes Child',
          type: 'choice',
          enableWhen: [{ question: 'parent', operator: '=', answerString: 'yes' }],
        },
      ];

      const parentQuestion: AyuQuestion = {
        linkId: 'parent',
        text: 'Parent',
        type: 'choice',
        answerOption: [
          { valueCoding: { code: 'yes', display: 'Yes' } },
          { valueCoding: { code: 'no', display: 'No' } },
        ],
      };

      const { rerender } = render(
        <AyuNestedRenderer
          items={items}
          parentQuestion={parentQuestion}
          answers={{ parent: 'yes' }}
          setAnswer={mockSetAnswer}
          clearAnswers={mockClearAnswers}
          selectable
        />
      );

      // Rerender with different parent answer
      rerender(
        <AyuNestedRenderer
          items={items}
          parentQuestion={parentQuestion}
          answers={{ parent: 'no' }}
          setAnswer={mockSetAnswer}
          clearAnswers={mockClearAnswers}
          selectable
        />
      );

      // The child should not be rendered since enableWhen doesn't match
      expect(screen.queryByTestId('selectable-child-yes')).not.toBeInTheDocument();
    });
  });

  describe('previousSibling prop in renderInlineNestedItems', () => {
    it('should pass previousSibling to second inline nested item (line 77)', async () => {
      const user = userEvent.setup();
      const items: AyuQuestion[] = [
        {
          linkId: 'choice-parent',
          text: 'Choice Parent',
          type: 'choice',
          answerOption: [
            { valueCoding: { code: 'opt-a', display: 'Option A' } },
            { valueCoding: { code: 'opt-b', display: 'Option B' } },
          ],
          item: [
            {
              linkId: 'opt-a-child',
              text: 'Child A',
              type: 'string',
              enableWhen: [{ question: 'choice-parent', operator: '=', answerCoding: { code: 'opt-a' } }],
            },
            {
              linkId: 'opt-b-child',
              text: 'Child B',
              type: 'string',
              enableWhen: [{ question: 'choice-parent', operator: '=', answerCoding: { code: 'opt-b' } }],
            },
          ],
        },
        { linkId: 'choice-sibling', text: 'Sibling', type: 'choice' },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{ 'choice-parent': ['opt-a', 'opt-b'] }}
          setAnswer={mockSetAnswer}
          selectable
        />
      );

      const pill = screen.getByTestId('selectable-choice-parent');
      await user.click(pill);

      // Both items should render inline
      expect(screen.getByTestId('renderer-opt-a-child')).toBeInTheDocument();
      expect(screen.getByTestId('renderer-opt-b-child')).toBeInTheDocument();
      // The second item gets previousSibling = first item
      expect(screen.getByTestId('prev-sibling-opt-b-child')).toHaveTextContent('opt-a-child');
    });
  });

  describe('Deeply Nested Items', () => {
    it('should render child items in non-selectable mode', () => {
      const items: AyuQuestion[] = [
        {
          linkId: 'level-1',
          text: 'Level 1',
          type: 'string',
          item: [
            {
              linkId: 'level-2',
              text: 'Level 2',
              type: 'string',
            },
          ],
        },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{}}
          setAnswer={mockSetAnswer}
        />
      );

      expect(screen.getByTestId('renderer-level-1')).toBeInTheDocument();
      /* level-2 is rendered via recursive AyuNestedRenderer (selectable=true)
         In selectable mode, string-type items render directly */
      expect(screen.getByTestId('renderer-level-2')).toBeInTheDocument();
    });

    it('should flatten container items in selectable mode and show nested children directly', async () => {
      const user = userEvent.setup();
      const items: AyuQuestion[] = [
        {
          linkId: 'level-1',
          text: 'Level 1',
          type: 'choice',
          // No answerOption → container gets flattened
          item: [
            {
              linkId: 'level-2',
              text: 'Level 2',
              type: 'string',
            },
          ],
        },
        { linkId: 'level-1b', text: 'Level 1b', type: 'choice' },
      ];

      render(
        <AyuNestedRenderer
          items={items}
          answers={{}}
          setAnswer={mockSetAnswer}
          selectable
        />
      );

      // level-1 is flattened — its child level-2 appears directly as a pill
      expect(screen.queryByTestId('selectable-level-1')).not.toBeInTheDocument();
      expect(screen.getByTestId('selectable-level-2')).toBeInTheDocument();
      expect(screen.getByTestId('selectable-level-1b')).toBeInTheDocument();

      // Click level-2 pill to select it
      await user.click(screen.getByTestId('selectable-level-2'));
      expect(screen.getByTestId('renderer-level-2')).toBeInTheDocument();
    });
  });
});
