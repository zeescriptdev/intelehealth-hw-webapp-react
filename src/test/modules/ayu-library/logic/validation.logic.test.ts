import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AyuQuestion } from '../../../../modules/ayu-library/types/ayu.types';
// Mock decision-matrix and associated-symptoms — only used by validateQuestion
vi.mock('../../../../modules/ayu-library/logic/decision-matrix', () => ({
  ASSOCIATED_SYMPTOMS_COMPONENT: 'associatedSymptoms',
  resolveAyuComponent: vi.fn(() => 'select'),
  isStrictAssociatedSymptoms: vi.fn(() => false),
  isPhysicalExamOptionsQuestion: vi.fn(() => false),
}));

vi.mock(
  '../../../../modules/ayu-library/logic/associated-symptoms.logic',
  async importOriginal => ({
    ...(await importOriginal<
      typeof import('../../../../modules/ayu-library/logic/associated-symptoms.logic')
    >()),
    hasExclusiveSelected: vi.fn(() => false),
  })
);

import {
  isEmpty,
  hasVisibleRequiredNestedString,
  hasUnansweredRequiredNestedChild,
  isNestedInputValueMissing,
  isQuantityInvalid,
  validateQuestion,
} from '../../../../modules/ayu-library/logic/validation.logic';
import {
  resolveAyuComponent,
  isStrictAssociatedSymptoms,
  isPhysicalExamOptionsQuestion,
} from '../../../../modules/ayu-library/logic/decision-matrix';
import { hasExclusiveSelected } from '../../../../modules/ayu-library/logic/associated-symptoms.logic';

describe('isEmpty', () => {
  it('should return true for undefined', () => {
    expect(isEmpty(undefined)).toBe(true);
  });

  it('should return true for null', () => {
    expect(isEmpty(null)).toBe(true);
  });

  it('should return true for empty string', () => {
    expect(isEmpty('')).toBe(true);
  });

  it('should return true for whitespace-only string', () => {
    expect(isEmpty('   ')).toBe(true);
    expect(isEmpty('\t\n')).toBe(true);
  });

  it('should return true for empty array', () => {
    expect(isEmpty([])).toBe(true);
  });

  it('should return false for non-empty string', () => {
    expect(isEmpty('hello')).toBe(false);
  });

  it('should return false for non-empty array', () => {
    expect(isEmpty(['a'])).toBe(false);
  });

  it('should return false for numbers', () => {
    expect(isEmpty(0)).toBe(false);
    expect(isEmpty(42)).toBe(false);
  });

  it('should return false for boolean false', () => {
    expect(isEmpty(false)).toBe(false);
  });

  it('should return false for objects', () => {
    expect(isEmpty({})).toBe(false);
  });
});

describe('hasVisibleRequiredNestedString', () => {
  it('should return false for question with no children', () => {
    const q: AyuQuestion = { linkId: 'q1', type: 'choice' };
    expect(hasVisibleRequiredNestedString(q, {})).toBe(false);
  });

  it('should return false when child is not a string type', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [{ linkId: 'q1.1', type: 'integer' }],
    };
    expect(hasVisibleRequiredNestedString(q, {})).toBe(false);
  });

  it('should return true when visible string child has no answer', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [{ linkId: 'q1.1', type: 'string' }],
    };
    expect(hasVisibleRequiredNestedString(q, { q1: 'yes' })).toBe(true);
  });

  it('should return false when visible string child has an answer', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [{ linkId: 'q1.1', type: 'string' }],
    };
    expect(hasVisibleRequiredNestedString(q, { q1: 'yes', 'q1.1': 'filled' })).toBe(false);
  });

  it('should return false when string child is hidden by enableWhen', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [
        {
          linkId: 'q1.1',
          type: 'string',
          enableWhen: [
            { question: 'q1', operator: '=', answerCoding: { code: 'yes' } },
          ],
        },
      ],
    };
    // parent answer is 'no', child is hidden
    expect(hasVisibleRequiredNestedString(q, { q1: 'no' })).toBe(false);
  });

  it('should return true when string child is visible and empty', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [
        {
          linkId: 'q1.1',
          type: 'string',
          enableWhen: [
            { question: 'q1', operator: '=', answerCoding: { code: 'yes' } },
          ],
        },
      ],
    };
    expect(hasVisibleRequiredNestedString(q, { q1: 'yes' })).toBe(true);
  });
});

describe('hasUnansweredRequiredNestedChild', () => {
  it('should return false for question with no children', () => {
    const q: AyuQuestion = { linkId: 'q1', type: 'choice' };
    expect(hasUnansweredRequiredNestedChild(q, {})).toBe(false);
  });

  it('should return true when required child has no answer', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [{ linkId: 'q1.1', type: 'string', required: true }],
    };
    expect(hasUnansweredRequiredNestedChild(q, { q1: 'yes' })).toBe(true);
  });

  it('should return false when required child has an answer', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [{ linkId: 'q1.1', type: 'string', required: true }],
    };
    expect(hasUnansweredRequiredNestedChild(q, { q1: 'yes', 'q1.1': 'filled' })).toBe(false);
  });

  it('should return true when repeats child has no answer', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [{ linkId: 'q1.1', type: 'choice', repeats: true }],
    };
    expect(hasUnansweredRequiredNestedChild(q, { q1: 'yes' })).toBe(true);
  });

  it('should return false when repeats child has an answer', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [{ linkId: 'q1.1', type: 'choice', repeats: true }],
    };
    expect(hasUnansweredRequiredNestedChild(q, { q1: 'yes', 'q1.1': ['opt1'] })).toBe(false);
  });

  it('should return false when hidden child has no answer', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [
        {
          linkId: 'q1.1',
          type: 'string',
          required: true,
          enableWhen: [
            { question: 'q1', operator: '=', answerCoding: { code: 'yes' } },
          ],
        },
      ],
    };
    expect(hasUnansweredRequiredNestedChild(q, { q1: 'no' })).toBe(false);
  });

  it('should return true when visible input-type child (integer) has no answer', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [{ linkId: 'q1.1', type: 'integer' }],
    };
    expect(hasUnansweredRequiredNestedChild(q, { q1: 'yes' })).toBe(true);
  });

  it('should return true when visible input-type child (quantity) has no answer', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [{ linkId: 'q1.1', type: 'quantity' }],
    };
    expect(hasUnansweredRequiredNestedChild(q, { q1: 'yes' })).toBe(true);
  });

  it('should return true when visible input-type child (date) has no answer', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [{ linkId: 'q1.1', type: 'date' }],
    };
    expect(hasUnansweredRequiredNestedChild(q, { q1: 'yes' })).toBe(true);
  });

  it('should recurse into grandchildren and return true when unanswered', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [
        {
          linkId: 'q1.1',
          type: 'choice',
          answerOption: [
            { valueCoding: { code: 'opt1', display: 'Option 1' } },
          ],
          item: [
            { linkId: 'opt1-detail', type: 'string' },
          ],
        },
      ],
    };
    // q1.1 is answered with 'opt1', grandchild 'opt1-detail' is unanswered
    expect(hasUnansweredRequiredNestedChild(q, { q1: 'yes', 'q1.1': 'opt1' })).toBe(true);
  });

  it('should not check grandchild when its matching answerOption is not selected', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [
        {
          linkId: 'q1.1',
          type: 'choice',
          answerOption: [
            { valueCoding: { code: 'opt1', display: 'Option 1' } },
            { valueCoding: { code: 'opt2', display: 'Option 2' } },
          ],
          item: [
            { linkId: 'opt1-detail', type: 'string' },
          ],
        },
      ],
    };
    // opt2 is selected, grandchild 'opt1-detail' maps to opt1, so should not validate
    expect(hasUnansweredRequiredNestedChild(q, { q1: 'yes', 'q1.1': 'opt2' })).toBe(false);
  });

  it('should handle array answer for selectedCodes in grandchild check', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [
        {
          linkId: 'q1.1',
          type: 'choice',
          answerOption: [
            { valueCoding: { code: 'opt1', display: 'Option 1' } },
          ],
          item: [
            { linkId: 'opt1-detail', type: 'string' },
          ],
        },
      ],
    };
    // Array answer - covers the Array.isArray branch
    expect(hasUnansweredRequiredNestedChild(q, { q1: 'yes', 'q1.1': ['opt1'] })).toBe(true);
  });

  it('should handle undefined/non-string answer for selectedCodes (empty array fallback)', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [
        {
          linkId: 'q1.1',
          type: 'choice',
          answerOption: [
            { valueCoding: { code: 'opt1', display: 'Option 1' } },
          ],
          item: [
            { linkId: 'opt1-detail', type: 'string' },
          ],
        },
      ],
    };
    // No answer for q1.1 — selectedCodes is [], grandchild's matching option not selected, so skipped
    expect(hasUnansweredRequiredNestedChild(q, { q1: 'yes' })).toBe(false);
  });

  it('should validate grandchild with no matching answerOption', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [
        {
          linkId: 'q1.1',
          type: 'choice',
          // No answerOption defined, so matchingOption is undefined
          item: [
            { linkId: 'detail', type: 'integer' },
          ],
        },
      ],
    };
    // Grandchild has no matching answerOption, so it is always validated
    expect(hasUnansweredRequiredNestedChild(q, { q1: 'yes', 'q1.1': 'val' })).toBe(true);
  });

  it('should return false when grandchild is answered', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [
        {
          linkId: 'q1.1',
          type: 'choice',
          answerOption: [
            { valueCoding: { code: 'opt1', display: 'Option 1' } },
          ],
          item: [
            { linkId: 'opt1-detail', type: 'string' },
          ],
        },
      ],
    };
    expect(hasUnansweredRequiredNestedChild(q, {
      q1: 'yes',
      'q1.1': 'opt1',
      'opt1-detail': 'filled',
    })).toBe(false);
  });

  it('should return false for grandchild that is not an input type', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [
        {
          linkId: 'q1.1',
          type: 'choice',
          item: [
            { linkId: 'q1.1.1', type: 'choice' }, // Not an input type
          ],
        },
      ],
    };
    expect(hasUnansweredRequiredNestedChild(q, { q1: 'yes', 'q1.1': 'val' })).toBe(false);
  });
});

describe('isNestedInputValueMissing', () => {
  it('should return false for question with no children', () => {
    const q: AyuQuestion = { linkId: 'q1', type: 'choice' };
    expect(isNestedInputValueMissing(q, {})).toBe(false);
  });

  it('should return true when visible string child has no answer', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [{ linkId: 'q1.1', type: 'string' }],
    };
    expect(isNestedInputValueMissing(q, { q1: 'yes' })).toBe(true);
  });

  it('should return true when visible integer child has no answer', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [{ linkId: 'q1.1', type: 'integer' }],
    };
    expect(isNestedInputValueMissing(q, { q1: 'yes' })).toBe(true);
  });

  it('should return true when visible date child has no answer', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [{ linkId: 'q1.1', type: 'date' }],
    };
    expect(isNestedInputValueMissing(q, { q1: 'yes' })).toBe(true);
  });

  it('should return false when hidden child has no answer', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [
        {
          linkId: 'q1.1',
          type: 'string',
          enableWhen: [
            { question: 'q1', operator: '=', answerCoding: { code: 'yes' } },
          ],
        },
      ],
    };
    expect(isNestedInputValueMissing(q, { q1: 'no' })).toBe(false);
  });

  it('should check grandchildren for missing input values', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [
        {
          linkId: 'q1.1',
          type: 'choice',
          answerOption: [
            { valueCoding: { code: 'opt1', display: 'Option 1' } },
          ],
          item: [
            { linkId: 'opt1-detail', type: 'string' },
          ],
        },
      ],
    };
    expect(isNestedInputValueMissing(q, { q1: 'yes', 'q1.1': 'opt1' })).toBe(true);
  });

  it('should not check grandchild when matching answerOption is not selected', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [
        {
          linkId: 'q1.1',
          type: 'choice',
          answerOption: [
            { valueCoding: { code: 'opt1', display: 'Option 1' } },
          ],
          item: [
            { linkId: 'opt1-detail', type: 'string' },
          ],
        },
      ],
    };
    expect(isNestedInputValueMissing(q, { q1: 'yes', 'q1.1': 'opt2' })).toBe(false);
  });

  it('should handle array answer for selectedCodes in grandchild check', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [
        {
          linkId: 'q1.1',
          type: 'choice',
          answerOption: [
            { valueCoding: { code: 'opt1', display: 'Option 1' } },
          ],
          item: [
            { linkId: 'opt1-detail', type: 'string' },
          ],
        },
      ],
    };
    // Array answer - covers Array.isArray branch
    expect(isNestedInputValueMissing(q, { q1: 'yes', 'q1.1': ['opt1'] })).toBe(true);
  });

  it('should handle undefined answer for selectedCodes (empty array fallback)', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [
        {
          linkId: 'q1.1',
          type: 'choice',
          answerOption: [
            { valueCoding: { code: 'opt1', display: 'Option 1' } },
          ],
          item: [
            { linkId: 'opt1-detail', type: 'string' },
          ],
        },
      ],
    };
    // No answer for q1.1 — selectedCodes is [], grandchild's matching option not selected, so skipped
    expect(isNestedInputValueMissing(q, { q1: 'yes' })).toBe(false);
  });

  it('should validate grandchild with no matching answerOption', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [
        {
          linkId: 'q1.1',
          type: 'choice',
          // No answerOption — matchingOption is undefined, grandchild always validated
          item: [
            { linkId: 'detail', type: 'quantity' },
          ],
        },
      ],
    };
    expect(isNestedInputValueMissing(q, { q1: 'yes', 'q1.1': 'val' })).toBe(true);
  });

  it('should return false when grandchild is answered', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [
        {
          linkId: 'q1.1',
          type: 'choice',
          answerOption: [
            { valueCoding: { code: 'opt1', display: 'Option 1' } },
          ],
          item: [
            { linkId: 'opt1-detail', type: 'string' },
          ],
        },
      ],
    };
    expect(isNestedInputValueMissing(q, {
      q1: 'yes',
      'q1.1': 'opt1',
      'opt1-detail': 'filled',
    })).toBe(false);
  });

  it('should return false for grandchild that is not an input type', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [
        {
          linkId: 'q1.1',
          type: 'choice',
          item: [
            { linkId: 'q1.1.1', type: 'choice' }, // Not an input type
          ],
        },
      ],
    };
    expect(isNestedInputValueMissing(q, { q1: 'yes', 'q1.1': 'val' })).toBe(false);
  });

  it('should return false when child has no nested items', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [
        {
          linkId: 'q1.1',
          type: 'choice', // Not an input type, no child.item
        },
      ],
    };
    expect(isNestedInputValueMissing(q, { q1: 'yes', 'q1.1': 'val' })).toBe(false);
  });
});

describe('isQuantityInvalid', () => {
  it('should return false for non-quantity/choice types', () => {
    const q: AyuQuestion = { linkId: 'q1', type: 'string' };
    expect(isQuantityInvalid(q, { q1: 'text' })).toBe(false);
  });

  it('should return true when quantity has no answer', () => {
    const q: AyuQuestion = { linkId: 'q1', type: 'quantity' };
    expect(isQuantityInvalid(q, {})).toBe(true);
  });

  it('should return false for choice with no answer', () => {
    const q: AyuQuestion = { linkId: 'q1', type: 'choice' };
    expect(isQuantityInvalid(q, {})).toBe(false);
  });

  it('should return false for choice with plain string answer', () => {
    const q: AyuQuestion = { linkId: 'q1', type: 'choice' };
    expect(isQuantityInvalid(q, { q1: 'code1' })).toBe(false);
  });

  it('should return true when duration is missing days', () => {
    const q: AyuQuestion = { linkId: 'q1', type: 'quantity' };
    expect(
      isQuantityInvalid(q, {
        q1: { dropdownValues: { number: 5 } },
      })
    ).toBe(true);
  });

  it('should return true when duration is missing number', () => {
    const q: AyuQuestion = { linkId: 'q1', type: 'quantity' };
    expect(
      isQuantityInvalid(q, {
        q1: { dropdownValues: { days: 'days' } },
      })
    ).toBe(true);
  });

  it('should return false when duration has both number and days', () => {
    const q: AyuQuestion = { linkId: 'q1', type: 'quantity' };
    expect(
      isQuantityInvalid(q, {
        q1: { dropdownValues: { number: 5, days: 'days' } },
      })
    ).toBe(false);
  });

  it('should check nested child duration validity for choice type', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [{ linkId: 'q1.1', type: 'choice' }],
    };
    expect(
      isQuantityInvalid(q, {
        q1: 'yes',
        'q1.1': { dropdownValues: { number: 5 } },
      })
    ).toBe(true);
  });

  it('should skip hidden nested children in checkDurationDeep', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [
        {
          linkId: 'q1.1',
          type: 'quantity',
          enableWhen: [
            { question: 'q1', operator: '=', answerCoding: { code: 'yes' } },
          ],
        },
      ],
    };
    // Answer is 'no', so child is hidden → should not flag as invalid
    expect(
      isQuantityInvalid(q, {
        q1: 'no',
        'q1.1': { dropdownValues: { number: 5 } },
      })
    ).toBe(false);
  });

  it('should check grandchild duration validity', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [
        {
          linkId: 'q1.1',
          type: 'choice',
          item: [{ linkId: 'q1.1.1', type: 'choice' }],
        },
      ],
    };
    expect(
      isQuantityInvalid(q, {
        q1: 'yes',
        'q1.1.1': { dropdownValues: { number: 5 } },
      })
    ).toBe(true);
  });

  it('should return false when nested child has sub-items with no invalid duration', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [
        {
          linkId: 'q1.1',
          type: 'choice',
          item: [{ linkId: 'q1.1.1', type: 'string' }],
        },
      ],
    };
    expect(
      isQuantityInvalid(q, {
        q1: 'yes',
        'q1.1.1': 'some text value',
      })
    ).toBe(false);
  });

  it('should return false when nested child has valid duration with both number and days', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [{ linkId: 'q1.1', type: 'choice' }],
    };
    expect(
      isQuantityInvalid(q, {
        q1: 'yes',
        'q1.1': { dropdownValues: { number: 5, days: 'days' } },
      })
    ).toBe(false);
  });

  it('should return true when nested child duration is missing number', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [{ linkId: 'q1.1', type: 'choice' }],
    };
    expect(
      isQuantityInvalid(q, {
        q1: 'yes',
        'q1.1': { dropdownValues: { days: 'days' } },
      })
    ).toBe(true);
  });
});

describe('validateQuestion', () => {
  beforeEach(() => {
    vi.mocked(resolveAyuComponent).mockReturnValue('select' as never);
    vi.mocked(isStrictAssociatedSymptoms).mockReturnValue(false);
    vi.mocked(hasExclusiveSelected).mockReturnValue(false);
  });

  it('should return valid when no validation issues exist', () => {
    const q: AyuQuestion = { linkId: 'q1', type: 'choice' };
    expect(validateQuestion(q, { q1: 'answer' })).toEqual({ valid: true });
  });

  it('should return valid with array answer when all conditions pass', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      answerOption: [{ valueCoding: { code: 'a', display: 'A' } }],
    };
    expect(validateQuestion(q, { q1: ['a'] })).toEqual({ valid: true });
  });

  it('should return valid for repeats choice with answer codes', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      repeats: true,
      answerOption: [{ valueCoding: { code: 'a', display: 'A' } }],
    };
    expect(validateQuestion(q, { q1: ['a'] })).toEqual({ valid: true });
  });

  it('should return uploadImage when camera answer is missing images', () => {
    const q: AyuQuestion = { linkId: 'q1', type: 'choice' };
    const cameraCheck = vi.fn(() => true);
    expect(validateQuestion(q, { q1: 'answer' }, cameraCheck)).toEqual({
      valid: false,
      reason: 'uploadImage',
    });
  });

  it('should not flag camera when check returns false', () => {
    const q: AyuQuestion = { linkId: 'q1', type: 'choice' };
    const cameraCheck = vi.fn(() => false);
    expect(validateQuestion(q, { q1: 'answer' }, cameraCheck)).toEqual({
      valid: true,
    });
  });

  it('should return uploadCapturedImage when images captured but not uploaded', () => {
    const q: AyuQuestion = { linkId: 'q1', type: 'choice' };
    const cameraCheck = vi.fn(() => false);
    const notUploadedCheck = vi.fn(() => true);
    expect(
      validateQuestion(q, { q1: 'answer' }, cameraCheck, notUploadedCheck)
    ).toEqual({
      valid: false,
      reason: 'uploadCapturedImage',
    });
  });

  it('should prioritize uploadCapturedImage over uploadImage when both fire', () => {
    const q: AyuQuestion = { linkId: 'q1', type: 'choice' };
    const cameraCheck = vi.fn(() => true);
    const notUploadedCheck = vi.fn(() => true);
    expect(
      validateQuestion(q, { q1: 'answer' }, cameraCheck, notUploadedCheck)
    ).toEqual({
      valid: false,
      reason: 'uploadCapturedImage',
    });
  });

  it('should not flag uploadCapturedImage when check returns false', () => {
    const q: AyuQuestion = { linkId: 'q1', type: 'choice' };
    const cameraCheck = vi.fn(() => false);
    const notUploadedCheck = vi.fn(() => false);
    expect(
      validateQuestion(q, { q1: 'answer' }, cameraCheck, notUploadedCheck)
    ).toEqual({ valid: true });
  });

  it('should return enterValue when nested string child is unanswered', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [{ linkId: 'q1.1', type: 'string' }],
    };
    expect(validateQuestion(q, { q1: 'yes' })).toEqual({
      valid: false,
      reason: 'enterValue',
    });
  });

  it('should return enterValue when nested integer child is unanswered', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      item: [{ linkId: 'q1.1', type: 'integer' }],
    };
    expect(validateQuestion(q, { q1: 'yes' })).toEqual({
      valid: false,
      reason: 'enterValue',
    });
  });

  it('should return enterValue when quantity is invalid', () => {
    const q: AyuQuestion = { linkId: 'q1', type: 'quantity' };
    expect(validateQuestion(q, {})).toEqual({
      valid: false,
      reason: 'enterValue',
    });
  });

  it('should return selectOption for unanswered repeats choice', () => {
    const q: AyuQuestion = { linkId: 'q1', type: 'choice', repeats: true };
    expect(validateQuestion(q, {})).toEqual({
      valid: false,
      reason: 'selectOption',
    });
  });

  it('should return selectOption for unanswered non-strict associated', () => {
    vi.mocked(resolveAyuComponent).mockReturnValue('associatedSymptoms' as never);
    vi.mocked(isStrictAssociatedSymptoms).mockReturnValue(false);
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      answerOption: [
        { valueCoding: { code: 'a', display: 'A' } },
        { valueCoding: { code: 'b', display: 'B' } },
      ],
    };
    expect(validateQuestion(q, {})).toEqual({
      valid: false,
      reason: 'selectOption',
    });
  });

  it('should not use repeats validation for associated symptoms', () => {
    vi.mocked(resolveAyuComponent).mockReturnValue('associatedSymptoms' as never);
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      repeats: true,
      answerOption: [
        { valueCoding: { code: 'a', display: 'A' } },
        { valueCoding: { code: 'b', display: 'B' } },
      ],
    };
    expect(validateQuestion(q, {})).toEqual({
      valid: false,
      reason: 'selectOption',
    });
  });

  it('should return allCompulsory for strict associated with partial answers', () => {
    vi.mocked(resolveAyuComponent).mockReturnValue('associatedSymptoms' as never);
    vi.mocked(isStrictAssociatedSymptoms).mockReturnValue(true);
    vi.mocked(hasExclusiveSelected).mockReturnValue(false);
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      answerOption: [
        { valueCoding: { code: 'a', display: 'A' } },
        { valueCoding: { code: 'b', display: 'B' } },
        { valueCoding: { code: 'c', display: 'C' } },
      ],
    };
    expect(validateQuestion(q, { q1: ['a'] })).toEqual({
      valid: false,
      reason: 'allCompulsory',
    });
  });

  it('should return valid when strict associated is fully answered', () => {
    vi.mocked(resolveAyuComponent).mockReturnValue('associatedSymptoms' as never);
    vi.mocked(isStrictAssociatedSymptoms).mockReturnValue(true);
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      answerOption: [
        { valueCoding: { code: 'a', display: 'A' } },
        { valueCoding: { code: 'b', display: 'B' } },
      ],
    };
    expect(validateQuestion(q, { q1: ['a', 'b'] })).toEqual({ valid: true });
  });

  it('should return valid when every strict associated row is answered with mixed Yes/No', () => {
    vi.mocked(resolveAyuComponent).mockReturnValue('associatedSymptoms' as never);
    vi.mocked(isStrictAssociatedSymptoms).mockReturnValue(true);
    vi.mocked(hasExclusiveSelected).mockReturnValue(false);
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      answerOption: [
        { valueCoding: { code: 'a', display: 'A' } },
        { valueCoding: { code: 'b', display: 'B' } },
        { valueCoding: { code: 'c', display: 'C' } },
      ],
    };
    expect(validateQuestion(q, { q1: ['a', 'NO_b', 'NO_c'] })).toEqual({
      valid: true,
    });
  });

  it('should not flag strict associated as incomplete when option codes are duplicated', () => {
    vi.mocked(resolveAyuComponent).mockReturnValue('associatedSymptoms' as never);
    vi.mocked(isStrictAssociatedSymptoms).mockReturnValue(true);
    vi.mocked(hasExclusiveSelected).mockReturnValue(false);
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      answerOption: [
        { valueCoding: { code: 'a', display: 'A' } },
        { valueCoding: { code: 'a', display: 'A again' } },
        { valueCoding: { code: 'b', display: 'B' } },
      ],
    };
    expect(validateQuestion(q, { q1: ['a', 'NO_b'] })).toEqual({ valid: true });
  });

  it('should not require strict associated rows that have an empty code', () => {
    vi.mocked(resolveAyuComponent).mockReturnValue('associatedSymptoms' as never);
    vi.mocked(isStrictAssociatedSymptoms).mockReturnValue(true);
    vi.mocked(hasExclusiveSelected).mockReturnValue(false);
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      answerOption: [
        { valueCoding: { code: 'a', display: 'A' } },
        { valueCoding: { code: '', display: 'Unstorable' } },
      ],
    };
    expect(validateQuestion(q, { q1: ['a'] })).toEqual({ valid: true });
  });

  it('should return valid when associated has exclusive option selected', () => {
    vi.mocked(resolveAyuComponent).mockReturnValue('associatedSymptoms' as never);
    vi.mocked(isStrictAssociatedSymptoms).mockReturnValue(true);
    vi.mocked(hasExclusiveSelected).mockReturnValue(true);
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      answerOption: [
        { valueCoding: { code: 'a', display: 'A' } },
        { valueCoding: { code: 'none', display: 'None' } },
      ],
    };
    expect(validateQuestion(q, { q1: ['none'] })).toEqual({ valid: true });
  });

  it('should handle answerOption being undefined for associated', () => {
    vi.mocked(resolveAyuComponent).mockReturnValue('associatedSymptoms' as never);
    const q: AyuQuestion = { linkId: 'q1', type: 'choice' };
    expect(validateQuestion(q, {})).toEqual({
      valid: false,
      reason: 'selectOption',
    });
  });

  describe('Physical Exam question validation skip', () => {
    beforeEach(() => {
      vi.mocked(isPhysicalExamOptionsQuestion).mockReturnValue(true);
    });

    afterEach(() => {
      vi.mocked(isPhysicalExamOptionsQuestion).mockReturnValue(false);
    });

    it('should return valid for PE question with unanswered nested string child', () => {
      const q: AyuQuestion = {
        linkId: 'pe1',
        type: 'choice',
        item: [{ linkId: 'pe1.1', type: 'string' }],
      };
      expect(validateQuestion(q, { pe1: 'yes' })).toEqual({ valid: true });
    });

    it('should return valid for PE question with unanswered nested integer child', () => {
      const q: AyuQuestion = {
        linkId: 'pe1',
        type: 'choice',
        item: [{ linkId: 'pe1.1', type: 'integer' }],
      };
      expect(validateQuestion(q, { pe1: 'yes' })).toEqual({ valid: true });
    });

    it('should return valid for PE question with unanswered nested required child', () => {
      const q: AyuQuestion = {
        linkId: 'pe1',
        type: 'choice',
        item: [{ linkId: 'pe1.1', type: 'string', required: true }],
      };
      expect(validateQuestion(q, { pe1: 'yes' })).toEqual({ valid: true });
    });

    it('should return valid for PE question with unanswered nested date child', () => {
      const q: AyuQuestion = {
        linkId: 'pe1',
        type: 'choice',
        item: [{ linkId: 'pe1.1', type: 'date' }],
      };
      expect(validateQuestion(q, { pe1: 'yes' })).toEqual({ valid: true });
    });

    it('should return valid for PE question with unanswered nested quantity child', () => {
      const q: AyuQuestion = {
        linkId: 'pe1',
        type: 'choice',
        item: [{ linkId: 'pe1.1', type: 'quantity' }],
      };
      expect(validateQuestion(q, { pe1: 'yes' })).toEqual({ valid: true });
    });

    it('should still check quantity validity at top level for PE questions', () => {
      const q: AyuQuestion = { linkId: 'pe1', type: 'quantity' };
      vi.mocked(isPhysicalExamOptionsQuestion).mockReturnValue(true);
      expect(validateQuestion(q, {})).toEqual({
        valid: false,
        reason: 'enterValue',
      });
    });

    it('should still check camera missing images for PE questions', () => {
      const q: AyuQuestion = {
        linkId: 'pe1',
        type: 'choice',
        item: [{ linkId: 'pe1.1', type: 'string' }],
      };
      const cameraCheck = vi.fn(() => true);
      expect(validateQuestion(q, { pe1: 'yes' }, cameraCheck)).toEqual({
        valid: false,
        reason: 'uploadImage',
      });
    });

    it('should return valid for PE question with deeply nested unanswered children', () => {
      const q: AyuQuestion = {
        linkId: 'pe1',
        type: 'choice',
        item: [
          {
            linkId: 'pe1.1',
            type: 'choice',
            item: [{ linkId: 'pe1.1.1', type: 'string' }],
          },
        ],
      };
      expect(validateQuestion(q, { pe1: 'yes' })).toEqual({ valid: true });
    });

    it('should still flag invalid repeats for PE questions with no answer', () => {
      const q: AyuQuestion = {
        linkId: 'pe1',
        type: 'choice',
        repeats: true,
      };
      expect(validateQuestion(q, {})).toEqual({
        valid: false,
        reason: 'selectOption',
      });
    });
  });

  describe('non-PE question validation (isPE=false)', () => {
    it('should still return enterValue for non-PE with unanswered nested string', () => {
      vi.mocked(isPhysicalExamOptionsQuestion).mockReturnValue(false);
      const q: AyuQuestion = {
        linkId: 'q1',
        type: 'choice',
        item: [{ linkId: 'q1.1', type: 'string' }],
      };
      expect(validateQuestion(q, { q1: 'yes' })).toEqual({
        valid: false,
        reason: 'enterValue',
      });
    });
  });
});
