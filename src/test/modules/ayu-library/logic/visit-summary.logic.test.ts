import { describe, expect, it } from 'vitest';
import { buildVisitSummary } from '../../../../modules/ayu-library/logic/visit-summary.logic';
import type {
  AyuAnswerValue,
  AyuQuestion,
} from '../../../../modules/ayu-library/types/ayu.types';

const makeQuestion = (overrides: Partial<AyuQuestion> = {}): AyuQuestion => ({
  linkId: 'q1',
  type: 'string',
  text: 'Question 1',
  extension: [
    {
      url: 'urn:intelehealth:original-question-text',
      valueString: 'Question 1',
    },
  ],
  ...overrides,
});

const makeChoiceQuestion = (
  overrides: Partial<AyuQuestion> = {}
): AyuQuestion => ({
  linkId: 'q1',
  type: 'choice',
  text: 'Select option',
  extension: [
    {
      url: 'urn:intelehealth:original-question-text',
      valueString: 'Select option',
    },
  ],
  answerOption: [
    { valueCoding: { code: 'CODE_A', display: 'Option A' } },
    { valueCoding: { code: 'CODE_B', display: 'Option B' } },
    { valueCoding: { code: 'CODE_C', display: 'Option C' } },
  ],
  ...overrides,
});

describe('buildVisitSummary', () => {
  describe('empty and basic cases', () => {
    it('should return empty array when no questions', () => {
      const result = buildVisitSummary([], new Map(), 'Visit');
      expect(result).toEqual([]);
    });

    it('should return empty array when questions have no answers', () => {
      const questions = [makeQuestion()];
      const result = buildVisitSummary(questions, new Map(), 'Visit');
      expect(result).toEqual([]);
    });

    it('should use provided section title', () => {
      const questions = [makeQuestion()];
      const answers = new Map<string, AyuAnswerValue>([['q1', 'My answer']]);
      const result = buildVisitSummary(questions, answers, 'Chief Complaint');
      expect(result[0].title).toBe('Chief Complaint');
    });
  });

  describe('simple types', () => {
    it('should handle string answer', () => {
      const questions = [makeQuestion({ type: 'string' })];
      const answers = new Map<string, AyuAnswerValue>([['q1', 'My answer']]);
      const result = buildVisitSummary(questions, answers, 'Visit');

      expect(result).toHaveLength(1);
      expect(result[0].items).toHaveLength(1);
      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Question 1',
        value: 'My answer',
      });
    });

    it('should handle integer answer', () => {
      const questions = [makeQuestion({ type: 'integer' })];
      const answers = new Map<string, AyuAnswerValue>([['q1', 42]]);
      const result = buildVisitSummary(questions, answers, 'Visit');

      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Question 1',
        value: '42',
      });
    });

    it('should format integer answer with both low and high as a range', () => {
      const questions = [makeQuestion({ type: 'integer' })];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', { low: 5, high: 10 } as unknown as AyuAnswerValue],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');

      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Question 1',
        value: '5 - 10',
      });
    });

    it('should format integer answer with only low value', () => {
      const questions = [makeQuestion({ type: 'integer' })];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', { low: 5 } as unknown as AyuAnswerValue],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');

      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Question 1',
        value: '5',
      });
    });

    it('should format integer answer with only high value', () => {
      const questions = [makeQuestion({ type: 'integer' })];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', { high: 10 } as unknown as AyuAnswerValue],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');

      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Question 1',
        value: '10',
      });
    });

    it('should skip integer range with both low and high null', () => {
      const questions = [makeQuestion({ type: 'integer' })];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', { low: null, high: null } as unknown as AyuAnswerValue],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');

      expect(result).toEqual([]);
    });

    it('should stringify a numeric string answer for integer type', () => {
      const questions = [makeQuestion({ type: 'integer' })];
      const answers = new Map<string, AyuAnswerValue>([['q1', '42']]);
      const result = buildVisitSummary(questions, answers, 'Visit');

      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Question 1',
        value: '42',
      });
    });

    it('should skip integer answer when value is an object without low/high', () => {
      const questions = [makeQuestion({ type: 'integer' })];

      const answers = new Map<string, AyuAnswerValue>([
        ['q1', { foo: 'bar' } as unknown as AyuAnswerValue],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');

      expect(result).toEqual([]);
    });

    it('should skip when string answer equals label (display-only)', () => {
      const questions = [makeQuestion({ type: 'string', text: 'Question 1' })];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', 'Question 1'],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      expect(result).toEqual([]);
    });
  });

  describe('quantity type', () => {
    it('should format duration answer (number + days)', () => {
      const questions = [
        makeQuestion({
          linkId: 'q1',
          type: 'quantity',
          text: 'Duration',
          extension: [
            {
              url: 'urn:intelehealth:original-question-text',
              valueString: 'Duration',
            },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', { dropdownValues: { number: 5, days: 'days' } }],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Duration',
        value: '5 days',
      });
    });

    it('should format quantity answer (value + unit)', () => {
      const questions = [
        makeQuestion({
          linkId: 'q1',
          type: 'quantity',
          text: 'Weight',
          extension: [
            {
              url: 'urn:intelehealth:original-question-text',
              valueString: 'Weight',
            },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', { value: 70, unit: 'kg' }],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Weight',
        value: '70 kg',
      });
    });
  });

  describe('single select (choice)', () => {
    it('should display the option display text', () => {
      const questions = [makeChoiceQuestion()];
      const answers = new Map<string, AyuAnswerValue>([['q1', 'CODE_A']]);
      const result = buildVisitSummary(questions, answers, 'Visit');

      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Select option',
        value: 'Option A',
      });
    });

    it('should handle nested children triggered by selected option', () => {
      const questions = [
        makeChoiceQuestion({
          item: [
            {
              linkId: 'q1.1',
              type: 'string',
              text: 'Details',
              extension: [
                {
                  url: 'urn:intelehealth:original-question-text',
                  valueString: 'Details',
                },
              ],
              enableWhen: [
                {
                  question: 'q1',
                  operator: '=',
                  answerCoding: { code: 'CODE_A' },
                },
              ],
            },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', 'CODE_A'],
        ['q1.1', 'Some details'],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Select option',
        value: 'Option A - Some details',
      });
    });
  });

  describe('multi-select (choice with array)', () => {
    it('should display comma-separated option displays', () => {
      const questions = [makeChoiceQuestion({ repeats: true })];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', ['CODE_A', 'CODE_B']],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');

      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Select option',
        value: 'Option A, Option B',
      });
    });
  });

  describe('associated symptoms', () => {
    const makeAssociatedSymptomsQuestion = (): AyuQuestion => ({
      linkId: 'assoc',
      type: 'choice',
      text: 'Associated symptoms',
      repeats: true,
      extension: [
        {
          url: 'urn:intelehealth:original-question-text',
          valueString: 'Associated symptoms',
        },
      ],
      answerOption: [
        { valueCoding: { code: 'ID_1', display: 'Headache' } },
        { valueCoding: { code: 'ID_2', display: 'Nausea' } },
        { valueCoding: { code: 'ID_3', display: 'Fatigue' } },
      ],
    });

    it('should separate reports and denies', () => {
      const questions = [makeAssociatedSymptomsQuestion()];
      const answers = new Map<string, AyuAnswerValue>([
        ['assoc', ['ID_1', 'NO_ID_2']],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');

      const assocSection = result.find(
        s => s.title === 'Associated symptoms'
      );
      expect(assocSection).toBeDefined();

      const reports = assocSection!.items.find(
        i => i.type === 'subheading' && i.heading === 'Patient reports'
      );
      expect(reports).toBeDefined();
      if (reports && reports.type === 'subheading') {
        expect(reports.values[0]).toContain('Headache');
      }

      const denies = assocSection!.items.find(
        i => i.type === 'subheading' && i.heading === 'Patient denies'
      );
      expect(denies).toBeDefined();
      if (denies && denies.type === 'subheading') {
        expect(denies.values[0]).toContain('Nausea');
      }
    });

    it('should fall back to bare display when a nested multi-select code has no matching child (collectNestedOwnValues line 160-161)', () => {
      const questions: AyuQuestion[] = [
        {
          linkId: 'assoc',
          type: 'choice',
          text: 'Associated symptoms',
          repeats: true,
          extension: [
            {
              url: 'urn:intelehealth:original-question-text',
              valueString: 'Associated symptoms',
            },
          ],
          answerOption: [
            { valueCoding: { code: 'HA', display: 'Headache' } },
          ],
          item: [
            {
              linkId: 'assoc.nested',
              type: 'choice',
              text: 'Nested multi',
              repeats: true,
              answerOption: [
                { valueCoding: { code: 'X', display: 'Option X' } },
                { valueCoding: { code: 'Y', display: 'Option Y' } },
              ],
              enableWhen: [
                { question: 'assoc', operator: '=', answerCoding: { code: 'HA' } },
              ],
            },
          ],
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['assoc', ['HA']],
        ['assoc.nested', ['X', 'Y']],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');

      const assocSection = result.find(
        s => s.title === 'Associated symptoms'
      );
      const reports = assocSection!.items.find(
        i => i.type === 'subheading' && i.heading === 'Patient reports'
      );
      expect(reports).toBeDefined();
      if (reports && reports.type === 'subheading') {
        expect(reports.values[0]).toContain('Headache');
        expect(reports.values[0]).toContain('Option X');
        expect(reports.values[0]).toContain('Option Y');
      }
    });

    it('collects grandchild descendant values under a reported symptom', () => {
      const questions: AyuQuestion[] = [
        {
          linkId: 'assoc',
          type: 'choice',
          text: 'Associated symptoms',
          repeats: true,
          extension: [
            {
              url: 'urn:intelehealth:original-question-text',
              valueString: 'Associated symptoms',
            },
          ],
          answerOption: [{ valueCoding: { code: 'HA', display: 'Headache' } }],
          item: [
            {
              linkId: 'assoc.detail',
              type: 'string',
              text: 'Detail',
              enableWhen: [
                { question: 'assoc', operator: '=', answerCoding: { code: 'HA' } },
              ],
              item: [
                {
                  linkId: 'assoc.detail.sub',
                  type: 'string',
                  text: 'Sub detail',
                },
              ],
            },
          ],
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['assoc', ['HA']],
        ['assoc.detail', 'throbbing'],
        ['assoc.detail.sub', 'left side'],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');

      const assocSection = result.find(
        s => s.title === 'Associated symptoms'
      );
      const reports = assocSection!.items.find(
        i => i.type === 'subheading' && i.heading === 'Patient reports'
      );
      expect(reports).toBeDefined();
      if (reports && reports.type === 'subheading') {
        expect(reports.values[0]).toContain('Headache');
        expect(reports.values[0]).toContain('throbbing');
        expect(reports.values[0]).toContain('left side');
      }
    });

    it('should only show reports when no denies', () => {
      const questions = [makeAssociatedSymptomsQuestion()];
      const answers = new Map<string, AyuAnswerValue>([
        ['assoc', ['ID_1', 'ID_3']],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');

      const assocSection = result.find(
        s => s.title === 'Associated symptoms'
      );
      expect(assocSection).toBeDefined();
      expect(
        assocSection!.items.every(
          i => i.type !== 'subheading' || i.heading !== 'Patient denies'
        )
      ).toBe(true);
    });

    it('should only show denies when no reports', () => {
      const questions = [makeAssociatedSymptomsQuestion()];
      const answers = new Map<string, AyuAnswerValue>([
        ['assoc', ['NO_ID_1', 'NO_ID_2']],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');

      const assocSection = result.find(
        s => s.title === 'Associated symptoms'
      );
      expect(assocSection).toBeDefined();
      expect(
        assocSection!.items.every(
          i => i.type !== 'subheading' || i.heading !== 'Patient reports'
        )
      ).toBe(true);
    });
  });

  describe('multiple questions', () => {
    it('should build summary for multiple questions', () => {
      const questions: AyuQuestion[] = [
        makeQuestion({
          linkId: 'q1',
          type: 'string',
          text: 'Complaint',
          extension: [
            {
              url: 'urn:intelehealth:original-question-text',
              valueString: 'Complaint',
            },
          ],
        }),
        makeChoiceQuestion({
          linkId: 'q2',
          text: 'Severity',
          extension: [
            {
              url: 'urn:intelehealth:original-question-text',
              valueString: 'Severity',
            },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', 'Headache'],
        ['q2', 'CODE_B'],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');

      expect(result[0].items).toHaveLength(2);
      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Complaint',
        value: 'Headache',
      });
      expect(result[0].items[1]).toEqual({
        type: 'labelValue',
        label: 'Severity',
        value: 'Option B',
      });
    });
  });

  describe('section structure', () => {
    it('should return SummarySection with title and items', () => {
      const questions = [makeQuestion()];
      const answers = new Map<string, AyuAnswerValue>([['q1', 'answer']]);
      const result = buildVisitSummary(questions, answers, 'Visit');

      expect(result[0]).toHaveProperty('title');
      expect(result[0]).toHaveProperty('items');
      expect(Array.isArray(result[0].items)).toBe(true);
    });

    it('should separate main items and associated symptoms into different sections', () => {
      const questions: AyuQuestion[] = [
        makeQuestion({
          linkId: 'q1',
          type: 'string',
        }),
        {
          linkId: 'assoc',
          type: 'choice',
          text: 'Associated symptoms',
          repeats: true,
          extension: [
            {
              url: 'urn:intelehealth:original-question-text',
              valueString: 'Associated symptoms',
            },
          ],
          answerOption: [
            { valueCoding: { code: 'ID_1', display: 'Headache' } },
          ],
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', 'My complaint'],
        ['assoc', ['ID_1']],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Visit');
      expect(result[1].title).toBe('Associated symptoms');
    });
  });

  describe('recursive children processing', () => {
    it('should process nested children of unanswered parents', () => {
      const questions: AyuQuestion[] = [
        {
          linkId: 'parent',
          type: 'group',
          text: 'Parent',
          item: [
            {
              linkId: 'child1',
              type: 'string',
              text: 'Child Question',
              extension: [
                {
                  url: 'urn:intelehealth:original-question-text',
                  valueString: 'Child Question',
                },
              ],
            },
          ],
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['child1', 'Child answer'],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');

      expect(result[0].items).toHaveLength(1);
      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Child Question',
        value: 'Child answer',
      });
    });
  });

  describe('quantity with value and unit', () => {
    it('should format quantity with value only (no unit)', () => {
      const questions = [
        makeQuestion({
          linkId: 'q1',
          type: 'quantity',
          text: 'Temperature',
          extension: [
            {
              url: 'urn:intelehealth:original-question-text',
              valueString: 'Temperature',
            },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', { value: 98.6 }],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Temperature',
        value: '98.6',
      });
    });

    it('should format duration with number only (no days)', () => {
      const questions = [
        makeQuestion({
          linkId: 'q1',
          type: 'quantity',
          text: 'Duration',
          extension: [
            {
              url: 'urn:intelehealth:original-question-text',
              valueString: 'Duration',
            },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', { dropdownValues: { number: 3 } }],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Duration',
        value: '3',
      });
    });
  });

  describe('single-select with nested labeled children', () => {
    it('should prefix each nested non-string field with its label so the summary matches the in-page card', () => {
      const menstrualHistory: AyuQuestion = {
        linkId: 'menses',
        type: 'choice',
        text: 'Menstrual history',
        extension: [
          {
            url: 'urn:intelehealth:original-question-text',
            valueString: 'Menstrual history',
          },
        ],
        answerOption: [
          { valueCoding: { code: 'YES', display: 'Is menstruating' } },
        ],
        item: [
          {
            linkId: 'menses.age',
            type: 'integer',
            text: 'Age at onset',
            enableWhen: [
              { question: 'menses', operator: '=', answerCoding: { code: 'YES' } },
            ],
          },
          {
            linkId: 'menses.lmp',
            type: 'date',
            text: 'Last menstruation period',
            enableWhen: [
              { question: 'menses', operator: '=', answerCoding: { code: 'YES' } },
            ],
          },
          {
            linkId: 'menses.regularity',
            type: 'choice',
            text: 'Regularity',
            answerOption: [
              { valueCoding: { code: 'REG', display: 'Regular' } },
            ],
            enableWhen: [
              { question: 'menses', operator: '=', answerCoding: { code: 'YES' } },
            ],
          },
          {
            linkId: 'menses.cycle',
            type: 'integer',
            text: 'Cycle length (weeks)',
            enableWhen: [
              { question: 'menses', operator: '=', answerCoding: { code: 'YES' } },
            ],
          },
          {
            linkId: 'menses.duration',
            type: 'choice',
            text: 'Duration',
            answerOption: [
              { valueCoding: { code: 'LE7', display: '<= 7days' } },
            ],
            enableWhen: [
              { question: 'menses', operator: '=', answerCoding: { code: 'YES' } },
            ],
          },
        ],
      };
      const answers = new Map<string, AyuAnswerValue>([
        ['menses', 'YES'],
        ['menses.age', 55],
        ['menses.lmp', '2026-04-30'],
        ['menses.regularity', 'REG'],
        ['menses.cycle', { low: 22, high: 42 }],
        ['menses.duration', 'LE7'],
      ]);

      const result = buildVisitSummary([menstrualHistory], answers, 'Visit');
      const item = result[0].items[0];
      expect(item.type).toBe('labelValue');
      if (item.type === 'labelValue') {
        expect(item.value).toBe(
          'Is menstruating - Age at onset – 55, Last menstruation period – 2026-04-30, Regularity – Regular, Cycle length (weeks) – 22 - 42, Duration – <= 7days'
        );
      }
    });

    it('should keep `string` nested children unlabeled (e.g. free-form describe field)', () => {
      const questions = [
        makeChoiceQuestion({
          item: [
            {
              linkId: 'q1.detail',
              type: 'string',
              text: 'Details',
              extension: [
                {
                  url: 'urn:intelehealth:original-question-text',
                  valueString: 'Details',
                },
              ],
              enableWhen: [
                {
                  question: 'q1',
                  operator: '=',
                  answerCoding: { code: 'CODE_A' },
                },
              ],
            },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', 'CODE_A'],
        ['q1.detail', 'Some details'],
      ]);

      const result = buildVisitSummary(questions, answers, 'Visit');
      const item = result[0].items[0];
      expect(item.type).toBe('labelValue');
      if (item.type === 'labelValue') {
        expect(item.value).toBe('Option A - Some details');
      }
    });
  });

  describe('nested choice option that enables a typed-input child', () => {
    it('should fold the typed child into the option display (no duplicated option text)', () => {
      const root: AyuQuestion = {
        linkId: 'weight-change',
        type: 'choice',
        text: 'Weight change (kg)',
        extension: [
          {
            url: 'urn:intelehealth:original-question-text',
            valueString: 'Weight change (kg)',
          },
        ],
        answerOption: [
          { valueCoding: { code: 'WL', display: 'Weight loss' } },
        ],
        item: [
          {
            linkId: 'weight-loss',
            type: 'choice',
            text: 'Weight loss',
            enableWhen: [
              { question: 'weight-change', operator: '=', answerCoding: { code: 'WL' } },
            ],
            answerOption: [
              {
                valueCoding: {
                  code: 'AMT',
                  display: '[Enter amount of weight lost in kgs]',
                },
              },
            ],
            item: [
              {
                linkId: 'weight-loss.kgs',
                type: 'integer',
                text: '[Enter amount of weight lost in kgs]',
                enableWhen: [
                  {
                    question: 'weight-loss',
                    operator: '=',
                    answerCoding: { code: 'AMT' },
                  },
                ],
              },
            ],
          },
        ],
      };
      const answers = new Map<string, AyuAnswerValue>([
        ['weight-change', 'WL'],
        ['weight-loss', 'AMT'],
        ['weight-loss.kgs', 3],
      ]);

      const result = buildVisitSummary([root], answers, 'Visit');
      const item = result[0].items[0];
      expect(item.type).toBe('labelValue');
      if (item.type === 'labelValue') {
        expect(item.value).toBe(
          'Weight loss - [Enter amount of weight lost in kgs] – 3'
        );
        const occurrences =
          String(item.value).split('[Enter amount of weight lost in kgs]')
            .length - 1;
        expect(occurrences).toBe(1);
      }
    });
  });

  describe('multi-select with nested children — duplicate-label dedup', () => {
    it('should not repeat the option display when the nested question text matches it', () => {
      const questions: AyuQuestion[] = [
        makeChoiceQuestion({
          linkId: 'q1',
          repeats: true,
          answerOption: [
            { valueCoding: { code: 'ULCER', display: 'Ulcer [Describe]' } },
          ],
          item: [
            {
              linkId: 'q1.ulcer',
              type: 'choice',
              text: 'Ulcer [Describe]',
              answerOption: [
                {
                  valueCoding: { code: 'SIMPLE', display: 'Simple ulcer' },
                },
              ],
              enableWhen: [
                {
                  question: 'q1',
                  operator: '=',
                  answerCoding: { code: 'ULCER' },
                },
              ],
            },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', ['ULCER']],
        ['q1.ulcer', 'SIMPLE'],
      ]);

      const result = buildVisitSummary(questions, answers, 'Visit');
      const item = result[0].items[0];
      expect(item.type).toBe('labelValue');
      if (item.type === 'labelValue') {
        expect(item.value).toBe('Ulcer [Describe] – Simple ulcer');
        expect(item.value).not.toContain(
          'Ulcer [Describe] – Ulcer [Describe]'
        );
      }
    });

    it('should still prepend the nested label when it differs from the parent option display', () => {
      const questions: AyuQuestion[] = [
        makeChoiceQuestion({
          linkId: 'q1',
          repeats: true,
          answerOption: [
            { valueCoding: { code: 'LUMP', display: 'Lump' } },
          ],
          item: [
            {
              linkId: 'q1.lump',
              type: 'choice',
              text: 'Lump details',
              answerOption: [
                { valueCoding: { code: 'HARD', display: 'Hard' } },
              ],
              enableWhen: [
                {
                  question: 'q1',
                  operator: '=',
                  answerCoding: { code: 'LUMP' },
                },
              ],
            },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', ['LUMP']],
        ['q1.lump', 'HARD'],
      ]);

      const result = buildVisitSummary(questions, answers, 'Visit');
      const item = result[0].items[0];
      expect(item.type).toBe('labelValue');
      if (item.type === 'labelValue') {
        expect(item.value).toBe('Lump – Lump details – Hard');
      }
    });

    it('should replace bracket placeholder in label with the formatted value', () => {
      /* When a non-string choice child has a label containing brackets like
       * "Weight lost [amount]", the placeholder should be replaced with the
       * actual answer value: "Weight lost 5 kgs". */
      const questions: AyuQuestion[] = [
        makeChoiceQuestion({
          linkId: 'q1',
          repeats: true,
          answerOption: [
            { valueCoding: { code: 'LOSS', display: 'Weight loss' } },
          ],
          item: [
            {
              linkId: 'q1.amount',
              type: 'choice',
              text: 'Lost [amount]',
              answerOption: [
                { valueCoding: { code: 'FIVE', display: '5 kgs' } },
              ],
              enableWhen: [
                {
                  question: 'q1',
                  operator: '=',
                  answerCoding: { code: 'LOSS' },
                },
              ],
            },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', ['LOSS']],
        ['q1.amount', 'FIVE'],
      ]);

      const result = buildVisitSummary(questions, answers, 'Visit');
      const item = result[0].items[0];
      expect(item.type).toBe('labelValue');
      if (item.type === 'labelValue') {
        // Bracket placeholder [amount] replaced with resolved display "5 kgs"
        expect(item.value).toBe('Weight loss – Lost 5 kgs');
      }
    });
  });

  describe('multi-select with nested children', () => {
    it('should process nested children for multi-select options', () => {
      const questions: AyuQuestion[] = [
        makeChoiceQuestion({
          linkId: 'q1',
          repeats: true,
          item: [
            {
              linkId: 'q1.nested',
              type: 'string',
              text: 'Details for A',
              extension: [
                {
                  url: 'urn:intelehealth:original-question-text',
                  valueString: 'Details for A',
                },
              ],
              enableWhen: [
                {
                  question: 'q1',
                  operator: '=',
                  answerCoding: { code: 'CODE_A' },
                },
              ],
            },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', ['CODE_A']],
        ['q1.nested', 'nested answer'],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      expect(result[0].items[0].type).toBe('labelValue');
      if (result[0].items[0].type === 'labelValue') {
        expect(result[0].items[0].value).toContain('nested answer');
      }
    });
  });

  describe('associated symptoms with nested children', () => {
    it('should include nested values in associated symptoms reports', () => {
      const questions: AyuQuestion[] = [
        {
          linkId: 'assoc',
          type: 'choice',
          text: 'Associated symptoms',
          repeats: true,
          extension: [
            {
              url: 'urn:intelehealth:original-question-text',
              valueString: 'Associated symptoms',
            },
          ],
          answerOption: [
            { valueCoding: { code: 'ID_1', display: 'Headache' } },
          ],
          item: [
            {
              linkId: 'assoc.child',
              type: 'string',
              text: 'Severity',
              extension: [
                {
                  url: 'urn:intelehealth:original-question-text',
                  valueString: 'Severity',
                },
              ],
              enableWhen: [
                {
                  question: 'assoc',
                  operator: '=',
                  answerCoding: { code: 'ID_1' },
                },
              ],
            },
          ],
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['assoc', ['ID_1']],
        ['assoc.child', 'Severe'],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');

      const assocSection = result.find(s => s.title === 'Associated symptoms');
      expect(assocSection).toBeDefined();
      const reports = assocSection!.items.find(
        i => i.type === 'subheading' && i.heading === 'Patient reports'
      );
      expect(reports).toBeDefined();
      if (reports && reports.type === 'subheading') {
        expect(reports.values[0]).toContain('Headache');
        expect(reports.values[0]).toContain('Severe');
      }
    });
  });

  describe('null and edge cases for formatAnswerByType', () => {
    it('should return empty result for null answer', () => {
      const questions = [makeQuestion({ type: 'string' })];
      const answers = new Map<string, AyuAnswerValue>([['q1', null]]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      expect(result).toEqual([]);
    });

    it('should handle choice answer with no matching display', () => {
      const questions = [makeChoiceQuestion()];
      const answers = new Map<string, AyuAnswerValue>([['q1', 'UNKNOWN_CODE']]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      expect(result).toEqual([]);
    });
  });

  describe('useLabeledFormat (patient/family history)', () => {
    const makePatientHistoryQuestion = (): AyuQuestion => ({
      linkId: 'patHist',
      type: 'choice',
      text: 'Do you have a history of any of the following?*',
      repeats: true,
      extension: [
        {
          url: 'urn:intelehealth:original-question-text',
          valueString: 'Do you have a history of any of the following?*',
        },
        {
          url: 'https://intelehealth.org/fhir/StructureDefinition/language',
          valueString: 'Medical history',
        },
      ],
      answerOption: [
        { valueCoding: { code: 'DIAB', display: 'Diabetes' } },
        { valueCoding: { code: 'HTN', display: 'Hypertension' } },
      ],
    });

    const makeFamilyHistoryQuestion = (): AyuQuestion => ({
      linkId: 'famHist',
      type: 'choice',
      text: 'Do you have a family history of any of the following?*',
      repeats: true,
      extension: [
        {
          url: 'urn:intelehealth:original-question-text',
          valueString: 'Do you have a family history of any of the following?*',
        },
        {
          url: 'https://intelehealth.org/fhir/StructureDefinition/language',
          valueString: '%',
        },
      ],
      answerOption: [
        { valueCoding: { code: 'DIAB', display: 'Diabetes' } },
        { valueCoding: { code: 'HTN', display: 'Hypertension' } },
      ],
    });

    it('should render patient history in labelValue format with useLabeledFormat', () => {
      const questions = [makePatientHistoryQuestion()];
      const answers = new Map<string, AyuAnswerValue>([
        ['patHist', ['DIAB']],
      ]);
      const result = buildVisitSummary(questions, answers, 'History', {
        useLabeledFormat: true,
      });

      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Medical history',
        value: 'Diabetes',
      });
    });

    it('should render patient history with nested labeled values', () => {
      const questions: AyuQuestion[] = [
        {
          ...makePatientHistoryQuestion(),
          item: [
            {
              linkId: 'patHist.date',
              type: 'string',
              text: 'Since when?',
              extension: [
                {
                  url: 'urn:intelehealth:original-question-text',
                  valueString: 'Since when?',
                },
              ],
              enableWhen: [
                {
                  question: 'patHist',
                  operator: '=',
                  answerCoding: { code: 'DIAB' },
                },
              ],
            },
          ],
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['patHist', ['DIAB']],
        ['patHist.date', '2020'],
      ]);
      const result = buildVisitSummary(questions, answers, 'History', {
        useLabeledFormat: true,
      });

      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Medical history',
        value: 'Diabetes – 2020',
      });
    });

    it('should render family history with percent label as subheading + labelValue items', () => {
      const questions = [makeFamilyHistoryQuestion()];
      const answers = new Map<string, AyuAnswerValue>([
        ['famHist', ['DIAB', 'HTN']],
      ]);
      const result = buildVisitSummary(questions, answers, 'History', {
        useLabeledFormat: true,
      });

      expect(result[0].items[0]).toEqual({
        type: 'subheading',
        heading: 'Do you have a family history of any of the following?',
        values: [],
      });
      expect(result[0].items[1]).toEqual({
        type: 'labelValue',
        label: 'Diabetes',
        value: ' ',
      });
      expect(result[0].items[2]).toEqual({
        type: 'labelValue',
        label: 'Hypertension',
        value: ' ',
      });
    });

    it('should filter out negated codes in labeled format', () => {
      const questions = [makePatientHistoryQuestion()];
      const answers = new Map<string, AyuAnswerValue>([
        ['patHist', ['DIAB', 'NO_ID_HTN']],
      ]);
      const result = buildVisitSummary(questions, answers, 'History', {
        useLabeledFormat: true,
      });

      expect(result[0].items).toHaveLength(1);
      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Medical history',
        value: 'Diabetes',
      });
    });

    it('should render family history with nested labeled values', () => {
      const questions: AyuQuestion[] = [
        {
          ...makeFamilyHistoryQuestion(),
          item: [
            {
              linkId: 'famHist.relation',
              type: 'choice',
              text: 'Relation',
              extension: [
                {
                  url: 'urn:intelehealth:original-question-text',
                  valueString: 'Relation',
                },
              ],
              answerOption: [
                { valueCoding: { code: 'MOTHER', display: 'Mother' } },
              ],
              enableWhen: [
                {
                  question: 'famHist',
                  operator: '=',
                  answerCoding: { code: 'DIAB' },
                },
              ],
            },
          ],
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['famHist', ['DIAB']],
        ['famHist.relation', 'MOTHER'],
      ]);
      const result = buildVisitSummary(questions, answers, 'History', {
        useLabeledFormat: true,
      });

      expect(result[0].items[1]).toEqual({
        type: 'labelValue',
        label: 'Diabetes',
        value: 'Relation – Mother',
      });
    });
  });

  describe('single select with nested but no nested values', () => {
    it('should show display with empty string when nested children have no answers', () => {
      const questions = [
        makeChoiceQuestion({
          item: [
            {
              linkId: 'q1.1',
              type: 'string',
              text: 'Details',
              extension: [
                {
                  url: 'urn:intelehealth:original-question-text',
                  valueString: 'Details',
                },
              ],
              enableWhen: [
                {
                  question: 'q1',
                  operator: '=',
                  answerCoding: { code: 'CODE_A' },
                },
              ],
            },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([['q1', 'CODE_A']]);
      const result = buildVisitSummary(questions, answers, 'Visit');

      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Select option',
        value: 'Option A',
      });
    });
  });

  describe('getDisplay with language extension', () => {
    it('should use language extension value when not percent', () => {
      const questions: AyuQuestion[] = [
        makeChoiceQuestion({
          answerOption: [
            {
              valueCoding: { code: 'CODE_A', display: 'Option A' },
              extension: [
                {
                  url: 'https://intelehealth.org/fhir/StructureDefinition/language',
                  valueString: 'Localized A',
                },
              ],
            },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([['q1', 'CODE_A']]);
      const result = buildVisitSummary(questions, answers, 'Visit');

      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Select option',
        value: 'Localized A',
      });
    });

    it('should fall back to display when language extension is percent', () => {
      const questions: AyuQuestion[] = [
        makeChoiceQuestion({
          answerOption: [
            {
              valueCoding: { code: 'CODE_A', display: 'Option A' },
              extension: [
                {
                  url: 'https://intelehealth.org/fhir/StructureDefinition/language',
                  valueString: '%',
                },
              ],
            },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([['q1', 'CODE_A']]);
      const result = buildVisitSummary(questions, answers, 'Visit');

      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Select option',
        value: 'Option A',
      });
    });
  });

  describe('getExtensionLabel with language extension', () => {
    it('should use item.text even when display extension is present', () => {
      const questions: AyuQuestion[] = [
        makeQuestion({
          type: 'string',
          text: 'Original text',
          extension: [
            {
              url: 'https://intelehealth.org/fhir/StructureDefinition/language',
              valueString: '%',
            },
            {
              url: 'https://intelehealth.org/fhir/StructureDefinition/display',
              valueString: 'Display Label',
            },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', 'some answer'],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');

      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Original text',
        value: 'some answer',
      });
    });

    it('should use item.text when language is not percent', () => {
      const questions: AyuQuestion[] = [
        makeQuestion({
          type: 'string',
          text: 'Question Text',
          extension: [
            {
              url: 'https://intelehealth.org/fhir/StructureDefinition/language',
              valueString: 'Localized Label',
            },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', 'some answer'],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');

      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Question Text',
        value: 'some answer',
      });
    });
  });

  describe('collectLabeledValues edge cases', () => {
    it('should handle nested array answers with child that has no answers', () => {
      const questions: AyuQuestion[] = [
        {
          linkId: 'patHist',
          type: 'choice',
          text: 'Do you have a history of any of the following?*',
          repeats: true,
          extension: [
            {
              url: 'urn:intelehealth:original-question-text',
              valueString: 'Do you have a history of any of the following?*',
            },
            {
              url: 'https://intelehealth.org/fhir/StructureDefinition/language',
              valueString: 'Medical history',
            },
          ],
          answerOption: [
            { valueCoding: { code: 'DIAB', display: 'Diabetes' } },
          ],
          item: [
            {
              linkId: 'patHist.child',
              type: 'choice',
              text: 'Sub question',
              extension: [
                {
                  url: 'urn:intelehealth:original-question-text',
                  valueString: 'Sub question',
                },
              ],
              answerOption: [
                { valueCoding: { code: 'OPT1', display: 'Option 1' } },
              ],
              enableWhen: [
                {
                  question: 'patHist',
                  operator: '=',
                  answerCoding: { code: 'DIAB' },
                },
              ],
              item: [
                {
                  linkId: 'patHist.child.nested',
                  type: 'string',
                  text: 'Describe',
                  extension: [
                    {
                      url: 'urn:intelehealth:original-question-text',
                      valueString: 'Describe',
                    },
                  ],
                  enableWhen: [
                    {
                      question: 'patHist.child',
                      operator: '=',
                      answerCoding: { code: 'OPT1' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['patHist', ['DIAB']],
        ['patHist.child', ['OPT1']],
        ['patHist.child.nested', 'details here'],
      ]);
      const result = buildVisitSummary(questions, answers, 'History', {
        useLabeledFormat: true,
      });

      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Medical history',
        value: expect.stringContaining('details here'),
      });
    });

    it('should handle collectLabeledValues with non-string type showing label', () => {
      const questions: AyuQuestion[] = [
        {
          linkId: 'patHist',
          type: 'choice',
          text: 'Do you have a history of any of the following?*',
          repeats: true,
          extension: [
            {
              url: 'urn:intelehealth:original-question-text',
              valueString: 'Do you have a history of any of the following?*',
            },
            {
              url: 'https://intelehealth.org/fhir/StructureDefinition/language',
              valueString: 'Medical history',
            },
          ],
          answerOption: [
            { valueCoding: { code: 'DIAB', display: 'Diabetes' } },
          ],
          item: [
            {
              linkId: 'patHist.age',
              type: 'integer',
              text: 'Age at diagnosis',
              extension: [
                {
                  url: 'urn:intelehealth:original-question-text',
                  valueString: 'Age at diagnosis',
                },
              ],
              enableWhen: [
                {
                  question: 'patHist',
                  operator: '=',
                  answerCoding: { code: 'DIAB' },
                },
              ],
            },
          ],
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['patHist', ['DIAB']],
        ['patHist.age', 45],
      ]);
      const result = buildVisitSummary(questions, answers, 'History', {
        useLabeledFormat: true,
      });

      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Medical history',
        value: 'Diabetes – Age at diagnosis – 45',
      });
    });

    it('should handle collectLabeledValues with string type (no label prefix)', () => {
      const questions: AyuQuestion[] = [
        {
          linkId: 'patHist',
          type: 'choice',
          text: 'Do you have a history of any of the following?*',
          repeats: true,
          extension: [
            {
              url: 'urn:intelehealth:original-question-text',
              valueString: 'Do you have a history of any of the following?*',
            },
            {
              url: 'https://intelehealth.org/fhir/StructureDefinition/language',
              valueString: 'Medical history',
            },
          ],
          answerOption: [
            { valueCoding: { code: 'DIAB', display: 'Diabetes' } },
          ],
          item: [
            {
              linkId: 'patHist.describe',
              type: 'string',
              text: 'Describe',
              extension: [
                {
                  url: 'urn:intelehealth:original-question-text',
                  valueString: 'Describe',
                },
              ],
              enableWhen: [
                {
                  question: 'patHist',
                  operator: '=',
                  answerCoding: { code: 'DIAB' },
                },
              ],
            },
          ],
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['patHist', ['DIAB']],
        ['patHist.describe', 'Some description'],
      ]);
      const result = buildVisitSummary(questions, answers, 'History', {
        useLabeledFormat: true,
      });

      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Medical history',
        value: 'Diabetes – Some description',
      });
    });

    it('should process remaining children in collectLabeledValues', () => {
      const questions: AyuQuestion[] = [
        {
          linkId: 'patHist',
          type: 'choice',
          text: 'Do you have a history of any of the following?*',
          repeats: true,
          extension: [
            {
              url: 'urn:intelehealth:original-question-text',
              valueString: 'Do you have a history of any of the following?*',
            },
            {
              url: 'https://intelehealth.org/fhir/StructureDefinition/language',
              valueString: 'Medical history',
            },
          ],
          answerOption: [
            { valueCoding: { code: 'DIAB', display: 'Diabetes' } },
          ],
          item: [
            {
              linkId: 'patHist.child',
              type: 'string',
              text: 'Medication',
              extension: [
                {
                  url: 'urn:intelehealth:original-question-text',
                  valueString: 'Medication',
                },
              ],
              enableWhen: [
                {
                  question: 'patHist',
                  operator: '=',
                  answerCoding: { code: 'DIAB' },
                },
              ],
              item: [
                {
                  linkId: 'patHist.child.extra',
                  type: 'integer',
                  text: 'Dosage',
                  extension: [
                    {
                      url: 'urn:intelehealth:original-question-text',
                      valueString: 'Dosage',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['patHist', ['DIAB']],
        ['patHist.child', 'Metformin'],
        ['patHist.child.extra', 500],
      ]);
      const result = buildVisitSummary(questions, answers, 'History', {
        useLabeledFormat: true,
      });

      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Medical history',
        value: expect.stringContaining('Metformin'),
      });
    });
  });

  describe('formatAnswerByType edge cases', () => {
    it('should return null for non-string answer on string type', () => {
      const questions = [makeQuestion({ type: 'string' })];
      const answers = new Map<string, AyuAnswerValue>([['q1', 42]]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      expect(result).toEqual([]);
    });

    it('should return null for quantity with no value or dropdownValues', () => {
      const questions = [makeQuestion({ type: 'quantity' })];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', { someOtherProp: true } as unknown as AyuAnswerValue],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      expect(result).toEqual([]);
    });

    it('should return null for choice with non-string answer', () => {
      const questions = [makeChoiceQuestion()];
      const answers = new Map<string, AyuAnswerValue>([['q1', 42]]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      expect(result).toEqual([]);
    });

    it('should handle default type as string fallback', () => {
      const questions = [makeQuestion({ type: 'date' as AyuQuestion['type'] })];
      const answers = new Map<string, AyuAnswerValue>([['q1', '2024-01-01']]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Question 1',
        value: '2024-01-01',
      });
    });

    it('should return null for default type with non-string answer', () => {
      const questions = [makeQuestion({ type: 'date' as AyuQuestion['type'] })];
      const answers = new Map<string, AyuAnswerValue>([['q1', 42]]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      expect(result).toEqual([]);
    });
  });

  describe('non-strict associated symptoms (labeled format without useLabeledFormat)', () => {
    it('should use labeled format for patient history question even without useLabeledFormat option', () => {
      const questions: AyuQuestion[] = [
        {
          linkId: 'patHist',
          type: 'choice',
          text: 'Do you have a history of any of the following?*',
          repeats: true,
          extension: [
            {
              url: 'urn:intelehealth:original-question-text',
              valueString: 'Do you have a history of any of the following?*',
            },
            {
              url: 'https://intelehealth.org/fhir/StructureDefinition/language',
              valueString: 'Medical history',
            },
          ],
          answerOption: [
            { valueCoding: { code: 'DIAB', display: 'Diabetes' } },
          ],
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['patHist', ['DIAB']],
      ]);
      const result = buildVisitSummary(questions, answers, 'History');

      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Medical history',
        value: 'Diabetes',
      });
    });
  });

  describe('exclusive None option answered No (lines 315-317, 371-385)', () => {
    it('should show exclusive None when answered No alongside other selected items in patient history', () => {
      const questions: AyuQuestion[] = [
        {
          linkId: 'patHist',
          type: 'choice',
          text: 'Do you have a history of any of the following?*',
          repeats: true,
          extension: [
            {
              url: 'urn:intelehealth:original-question-text',
              valueString: 'Do you have a history of any of the following?*',
            },
            {
              url: 'https://intelehealth.org/fhir/StructureDefinition/language',
              valueString: 'Medical history',
            },
          ],
          answerOption: [
            { valueCoding: { code: 'DIAB', display: 'Diabetes' } },
            {
              valueCoding: { code: 'NONE', display: 'None' },
              extension: [
                {
                  url: 'https://intelehealth.org/fhir/StructureDefinition/exclude-from-multi-choice',
                  valueString: 'True',
                },
              ],
            },
          ],
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['patHist', ['DIAB', 'NO_NONE']],
      ]);
      const result = buildVisitSummary(questions, answers, 'History', {
        useLabeledFormat: true,
      });

      const items = result[0].items;
      expect(items.some(i => i.type === 'labelValue' && i.label === 'Medical history' && (i.value as string).includes('Diabetes'))).toBe(true);
      expect(items.some(i => i.type === 'labelValue' && i.label === 'Medical history' && i.value === 'None')).toBe(true);
    });

    it('should show exclusive None alongside other items in percent-label question', () => {
      const questions: AyuQuestion[] = [
        {
          linkId: 'famHist',
          type: 'choice',
          text: 'Do you have a family history of any of the following?*',
          repeats: true,
          extension: [
            { url: 'urn:intelehealth:original-question-text', valueString: 'Do you have a family history of any of the following?*' },
            { url: 'https://intelehealth.org/fhir/StructureDefinition/language', valueString: '%' },
            { url: 'https://intelehealth.org/fhir/StructureDefinition/display', valueString: 'Mother' },
          ],
          answerOption: [
            { valueCoding: { code: 'DIAB', display: 'Diabetes' } },
            {
              valueCoding: { code: 'NONE', display: 'None' },
              extension: [{ url: 'https://intelehealth.org/fhir/StructureDefinition/exclude-from-multi-choice', valueString: 'True' }],
            },
          ],
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['famHist', ['DIAB', 'NO_NONE']],
      ]);
      const result = buildVisitSummary(questions, answers, 'History', { useLabeledFormat: true });

      expect(result.length).toBeGreaterThan(0);
      const items = result[0].items;
      expect(items.some(i => i.type === 'labelValue' && (i as any).label === 'Diabetes')).toBe(true);
      expect(items.some(i => i.type === 'labelValue' && (i as any).label === 'None')).toBe(true);
    });

    it('should show exclusive None when it is the only answer (no positive codes)', () => {
      const questions: AyuQuestion[] = [
        {
          linkId: 'patHist',
          type: 'choice',
          text: 'Do you have a history of any of the following?*',
          repeats: true,
          extension: [
            { url: 'urn:intelehealth:original-question-text', valueString: 'Do you have a history of any of the following?*' },
            { url: 'https://intelehealth.org/fhir/StructureDefinition/language', valueString: 'Medical history' },
          ],
          answerOption: [
            { valueCoding: { code: 'DIAB', display: 'Diabetes' } },
            {
              valueCoding: { code: 'NONE', display: 'None' },
              extension: [{ url: 'https://intelehealth.org/fhir/StructureDefinition/exclude-from-multi-choice', valueString: 'True' }],
            },
          ],
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['patHist', ['NO_NONE']],
      ]);
      const result = buildVisitSummary(questions, answers, 'History', { useLabeledFormat: true });

      expect(result.length).toBeGreaterThan(0);
      const items = result[0].items;
      expect(items.some(i => i.type === 'labelValue' && (i as any).label === 'Medical history' && (i as any).value === 'None')).toBe(true);
    });

    it('should fall back to exclusive None when user denied conditions without explicitly negating None (patient history)', () => {
      const questions: AyuQuestion[] = [
        {
          linkId: 'patHist',
          type: 'choice',
          text: 'Do you have a history of any of the following?*',
          repeats: true,
          extension: [
            { url: 'urn:intelehealth:original-question-text', valueString: 'Do you have a history of any of the following?*' },
            { url: 'https://intelehealth.org/fhir/StructureDefinition/language', valueString: 'Medical history' },
          ],
          answerOption: [
            { valueCoding: { code: 'DIAB', display: 'Diabetes' } },
            { valueCoding: { code: 'HTN', display: 'Hypertension' } },
            {
              valueCoding: { code: 'NONE', display: 'None' },
              extension: [{ url: 'https://intelehealth.org/fhir/StructureDefinition/exclude-from-multi-choice', valueString: 'True' }],
            },
          ],
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['patHist', ['NO_DIAB', 'NO_HTN']],
      ]);
      const result = buildVisitSummary(questions, answers, 'History', { useLabeledFormat: true });

      const items = result[0]?.items ?? [];
      expect(
        items.some(
          i =>
            i.type === 'labelValue' &&
            (i as any).label === 'Medical history' &&
            (i as any).value === 'None'
        )
      ).toBe(true);
    });

    it('should fall back to exclusive None for family-history (percent label) when only negated answers exist', () => {
      const questions: AyuQuestion[] = [
        {
          linkId: 'famHist',
          type: 'choice',
          text: 'Do you have a family history of any of the following?*',
          repeats: true,
          extension: [
            { url: 'urn:intelehealth:original-question-text', valueString: 'Do you have a family history of any of the following?*' },
            { url: 'https://intelehealth.org/fhir/StructureDefinition/language', valueString: '%' },
          ],
          answerOption: [
            { valueCoding: { code: 'DIAB', display: 'Diabetes' } },
            {
              valueCoding: { code: 'NONE', display: 'None' },
              extension: [{ url: 'https://intelehealth.org/fhir/StructureDefinition/exclude-from-multi-choice', valueString: 'True' }],
            },
          ],
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['famHist', ['NO_DIAB']],
      ]);
      const result = buildVisitSummary(questions, answers, 'History', { useLabeledFormat: true });

      const items = result[0]?.items ?? [];
      expect(
        items.some(
          i =>
            i.type === 'labelValue' &&
            (i as any).label === 'None' &&
            (i as any).value === ' '
        )
      ).toBe(true);
    });

    it('should NOT fall back to None when there are positive answers alongside negated ones', () => {
      const questions: AyuQuestion[] = [
        {
          linkId: 'patHist',
          type: 'choice',
          text: 'Do you have a history of any of the following?*',
          repeats: true,
          extension: [
            { url: 'urn:intelehealth:original-question-text', valueString: 'Do you have a history of any of the following?*' },
            { url: 'https://intelehealth.org/fhir/StructureDefinition/language', valueString: 'Medical history' },
          ],
          answerOption: [
            { valueCoding: { code: 'DIAB', display: 'Diabetes' } },
            { valueCoding: { code: 'HTN', display: 'Hypertension' } },
            {
              valueCoding: { code: 'NONE', display: 'None' },
              extension: [{ url: 'https://intelehealth.org/fhir/StructureDefinition/exclude-from-multi-choice', valueString: 'True' }],
            },
          ],
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['patHist', ['DIAB', 'NO_HTN']],
      ]);
      const result = buildVisitSummary(questions, answers, 'History', { useLabeledFormat: true });

      const items = result[0]?.items ?? [];
      expect(
        items.some(
          i =>
            i.type === 'labelValue' &&
            (i as any).label === 'Medical history' &&
            (i as any).value === 'None'
        )
      ).toBe(false);
    });

    it('should NOT fall back to None when the question has no exclusive option', () => {
      const questions: AyuQuestion[] = [
        {
          linkId: 'patHist',
          type: 'choice',
          text: 'Do you have a history of any of the following?*',
          repeats: true,
          extension: [
            { url: 'urn:intelehealth:original-question-text', valueString: 'Do you have a history of any of the following?*' },
            { url: 'https://intelehealth.org/fhir/StructureDefinition/language', valueString: 'Medical history' },
          ],
          answerOption: [
            { valueCoding: { code: 'DIAB', display: 'Diabetes' } },
            { valueCoding: { code: 'HTN', display: 'Hypertension' } },
          ],
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['patHist', ['NO_DIAB', 'NO_HTN']],
      ]);
      const result = buildVisitSummary(questions, answers, 'History', { useLabeledFormat: true });

      const items = result[0]?.items ?? [];
      expect(
        items.some(
          i => i.type === 'labelValue' && (i as any).value === 'None'
        )
      ).toBe(false);
    });
  });

  describe('single-select with nested multi-select medications', () => {
    it('should create one row with all medication entries comma-separated', () => {
      const questions: AyuQuestion[] = [
        makeChoiceQuestion({
          linkId: 'drug',
          text: 'Drug history',
          extension: [
            { url: 'urn:intelehealth:original-question-text', valueString: 'Drug history' },
          ],
          answerOption: [
            { valueCoding: { code: 'YES', display: 'Yes' } },
            { valueCoding: { code: 'NO', display: 'No' } },
          ],
          item: [
            {
              linkId: 'drug.meds',
              type: 'choice',
              text: 'Medications',
              repeats: true,
              answerOption: [
                { valueCoding: { code: 'MED1', display: 'Medication name 1' } },
                { valueCoding: { code: 'MED2', display: 'Medication name 2' } },
              ],
              enableWhen: [{ question: 'drug', operator: '=', answerCoding: { code: 'YES' } }],
              item: [
                {
                  linkId: 'drug.med1.name',
                  type: 'string',
                  text: 'Medicine name',
                  enableWhen: [{ question: 'drug.meds', operator: '=', answerCoding: { code: 'MED1' } }],
                },
                {
                  linkId: 'drug.med1.from',
                  type: 'date',
                  text: 'From Date',
                  enableWhen: [{ question: 'drug.meds', operator: '=', answerCoding: { code: 'MED1' } }],
                },
                {
                  linkId: 'drug.med1.to',
                  type: 'date',
                  text: 'To Date',
                  enableWhen: [{ question: 'drug.meds', operator: '=', answerCoding: { code: 'MED1' } }],
                },
                {
                  linkId: 'drug.med2.name',
                  type: 'string',
                  text: 'Medicine name',
                  enableWhen: [{ question: 'drug.meds', operator: '=', answerCoding: { code: 'MED2' } }],
                },
                {
                  linkId: 'drug.med2.from',
                  type: 'date',
                  text: 'From Date',
                  enableWhen: [{ question: 'drug.meds', operator: '=', answerCoding: { code: 'MED2' } }],
                },
                {
                  linkId: 'drug.med2.to',
                  type: 'date',
                  text: 'To Date',
                  enableWhen: [{ question: 'drug.meds', operator: '=', answerCoding: { code: 'MED2' } }],
                },
              ],
            },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['drug', 'YES'],
        ['drug.meds', ['MED1', 'MED2']],
        ['drug.med1.name', 'Aspirin'],
        ['drug.med1.from', '2026-01-01'],
        ['drug.med1.to', '2026-06-01'],
        ['drug.med2.name', 'Metformin'],
        ['drug.med2.from', '2026-03-01'],
        ['drug.med2.to', '2026-12-01'],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');

      expect(result[0].items).toHaveLength(1);
      const item = result[0].items[0];
      expect(item.type).toBe('labelValue');
      if (item.type === 'labelValue') {
        expect(item.value).toContain('Yes');
        expect(item.value).toContain('Medication name 1');
        expect(item.value).toContain('Aspirin');
        expect(item.value).toContain('From Date');
        expect(item.value).toContain('2026-01-01');
        expect(item.value).toContain('To Date');
        expect(item.value).toContain('Medication name 2');
        expect(item.value).toContain('Metformin');
      }
    });

    it('substitutes the date into a "From - [Enter Date]" placeholder label', () => {
      const questions: AyuQuestion[] = [
        makeChoiceQuestion({
          linkId: 'drug',
          text: 'Drug history',
          extension: [
            { url: 'urn:intelehealth:original-question-text', valueString: 'Drug history' },
          ],
          answerOption: [{ valueCoding: { code: 'YES', display: 'Yes' } }],
          item: [
            {
              linkId: 'drug.meds',
              type: 'choice',
              text: 'Medications',
              repeats: true,
              answerOption: [
                { valueCoding: { code: 'MED1', display: 'Medication name 1' } },
              ],
              enableWhen: [{ question: 'drug', operator: '=', answerCoding: { code: 'YES' } }],
              item: [
                {
                  linkId: 'drug.med1.name',
                  type: 'string',
                  text: 'Medication Name - [Enter Name]',
                  enableWhen: [{ question: 'drug.meds', operator: '=', answerCoding: { code: 'MED1' } }],
                },
                {
                  linkId: 'drug.med1.from',
                  type: 'date',
                  text: 'From - [Enter Date]',
                  enableWhen: [{ question: 'drug.meds', operator: '=', answerCoding: { code: 'MED1' } }],
                },
                {
                  linkId: 'drug.med1.to',
                  type: 'date',
                  text: 'To - [Enter Date]',
                  enableWhen: [{ question: 'drug.meds', operator: '=', answerCoding: { code: 'MED1' } }],
                },
              ],
            },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['drug', 'YES'],
        ['drug.meds', ['MED1']],
        ['drug.med1.name', 'dsad'],
        ['drug.med1.from', '2026-05-06'],
        ['drug.med1.to', '2026-06-02'],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');

      const item = result[0].items[0];
      expect(item.type).toBe('labelValue');
      if (item.type === 'labelValue') {
        expect(item.value).not.toContain('[Enter Date]');
        expect(item.value).toContain('From - 2026-05-06');
        expect(item.value).toContain('To - 2026-06-02');
        expect(item.value).toContain('Medication name 1 – dsad');
      }
    });

    it('should fall back to original path when nested child is not a multi-select', () => {
      const questions: AyuQuestion[] = [
        makeChoiceQuestion({
          linkId: 'q1',
          item: [
            {
              linkId: 'q1.detail',
              type: 'string',
              text: 'Details',
              extension: [{ url: 'urn:intelehealth:original-question-text', valueString: 'Details' }],
              enableWhen: [{ question: 'q1', operator: '=', answerCoding: { code: 'CODE_A' } }],
            },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', 'CODE_A'],
        ['q1.detail', 'Some details'],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Select option',
        value: 'Option A - Some details',
      });
    });
  });

  describe('collectLabeledValues with display extension labels', () => {
    it('should use item.text for date field labels and ignore display extension', () => {
      const questions: AyuQuestion[] = [
        {
          linkId: 'patHist',
          type: 'choice',
          text: 'Do you have a history of any of the following?*',
          repeats: true,
          extension: [
            { url: 'urn:intelehealth:original-question-text', valueString: 'Do you have a history of any of the following?*' },
            { url: 'https://intelehealth.org/fhir/StructureDefinition/language', valueString: 'Medical history' },
          ],
          answerOption: [
            { valueCoding: { code: 'DIAB', display: 'Diabetes' } },
          ],
          item: [
            {
              linkId: 'patHist.from',
              type: 'date',
              text: 'From',
              extension: [
                { url: 'https://intelehealth.org/fhir/StructureDefinition/display', valueString: 'From Date' },
              ],
              enableWhen: [{ question: 'patHist', operator: '=', answerCoding: { code: 'DIAB' } }],
            },
            {
              linkId: 'patHist.to',
              type: 'date',
              text: 'To',
              extension: [
                { url: 'https://intelehealth.org/fhir/StructureDefinition/display', valueString: 'To Date' },
              ],
              enableWhen: [{ question: 'patHist', operator: '=', answerCoding: { code: 'DIAB' } }],
            },
          ],
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['patHist', ['DIAB']],
        ['patHist.from', '2026-01-01'],
        ['patHist.to', '2026-06-01'],
      ]);
      const result = buildVisitSummary(questions, answers, 'History', { useLabeledFormat: true });

      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Medical history',
        value: 'Diabetes – From – 2026-01-01, To – 2026-06-01',
      });
    });

    it('should process children of group containers (no own answer)', () => {
      const questions: AyuQuestion[] = [
        {
          linkId: 'patHist',
          type: 'choice',
          text: 'Do you have a history of any of the following?*',
          repeats: true,
          extension: [
            { url: 'urn:intelehealth:original-question-text', valueString: 'Do you have a history of any of the following?*' },
            { url: 'https://intelehealth.org/fhir/StructureDefinition/language', valueString: 'Medical history' },
          ],
          answerOption: [
            { valueCoding: { code: 'DIAB', display: 'Diabetes' } },
          ],
          item: [
            {
              linkId: 'patHist.group',
              type: 'group',
              text: 'Details group',
              enableWhen: [{ question: 'patHist', operator: '=', answerCoding: { code: 'DIAB' } }],
              item: [
                {
                  linkId: 'patHist.group.name',
                  type: 'string',
                  text: 'Name',
                },
                {
                  linkId: 'patHist.group.date',
                  type: 'date',
                  text: 'Since',
                },
              ],
            },
          ],
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['patHist', ['DIAB']],
        ['patHist.group.name', 'Metformin'],
        ['patHist.group.date', '2020-01-01'],
      ]);
      const result = buildVisitSummary(questions, answers, 'History', { useLabeledFormat: true });

      const item = result[0].items[0];
      expect(item.type).toBe('labelValue');
      if (item.type === 'labelValue') {
        expect(item.value).toContain('Metformin');
        expect(item.value).toContain('2020-01-01');
      }
    });
  });

  describe('multi-select with nested answers creates per-option entries', () => {
    it('should create labeled entries when multi-select options have nested children', () => {
      const questions: AyuQuestion[] = [
        makeChoiceQuestion({
          linkId: 'q1',
          repeats: true,
          item: [
            {
              linkId: 'q1.a.detail',
              type: 'string',
              text: 'Detail A',
              enableWhen: [{ question: 'q1', operator: '=', answerCoding: { code: 'CODE_A' } }],
            },
            {
              linkId: 'q1.b.detail',
              type: 'string',
              text: 'Detail B',
              enableWhen: [{ question: 'q1', operator: '=', answerCoding: { code: 'CODE_B' } }],
            },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', ['CODE_A', 'CODE_B']],
        ['q1.a.detail', 'info A'],
        ['q1.b.detail', 'info B'],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');

      expect(result[0].items).toHaveLength(1);
      if (result[0].items[0].type === 'labelValue') {
        expect(result[0].items[0].value).toContain('Option A');
        expect(result[0].items[0].value).toContain('info A');
        expect(result[0].items[0].value).toContain('Option B');
        expect(result[0].items[0].value).toContain('info B');
      }
    });

    it('should use simple flat format when multi-select has no nested answers', () => {
      const questions = [makeChoiceQuestion({ repeats: true })];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', ['CODE_A', 'CODE_B']],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Select option',
        value: 'Option A, Option B',
      });
    });
  });

  describe('exclusive None with percent-label and no positive codes', () => {
    it('should show None as labelValue with percent-label when it is the only answer', () => {
      const questions: AyuQuestion[] = [
        {
          linkId: 'famHist',
          type: 'choice',
          text: 'Do you have a family history of any of the following?*',
          repeats: true,
          extension: [
            { url: 'urn:intelehealth:original-question-text', valueString: 'Do you have a family history of any of the following?*' },
            { url: 'https://intelehealth.org/fhir/StructureDefinition/language', valueString: '%' },
          ],
          answerOption: [
            { valueCoding: { code: 'DIAB', display: 'Diabetes' } },
            {
              valueCoding: { code: 'NONE', display: 'None' },
              extension: [{ url: 'https://intelehealth.org/fhir/StructureDefinition/exclude-from-multi-choice', valueString: 'True' }],
            },
          ],
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['famHist', ['NO_NONE']],
      ]);
      const result = buildVisitSummary(questions, answers, 'History', { useLabeledFormat: true });

      expect(result.length).toBeGreaterThan(0);
      const items = result[0].items;
      expect(items.some(i => i.type === 'labelValue' && (i as any).label === 'None' && (i as any).value === ' ')).toBe(true);
    });
  });

  describe('family history multiSelectChild with percent-label', () => {
    it('should display medication entries with percent-label format', () => {
      const questions: AyuQuestion[] = [
        {
          linkId: 'famHist',
          type: 'choice',
          text: 'Do you have a family history of any of the following?*',
          repeats: true,
          extension: [
            { url: 'urn:intelehealth:original-question-text', valueString: 'Do you have a family history of any of the following?*' },
            { url: 'https://intelehealth.org/fhir/StructureDefinition/language', valueString: '%' },
          ],
          answerOption: [
            { valueCoding: { code: 'MED', display: 'Medication' } },
          ],
          item: [
            {
              linkId: 'famHist.meds',
              type: 'choice',
              text: 'Medications',
              repeats: true,
              answerOption: [
                { valueCoding: { code: 'M1', display: 'Med 1' } },
              ],
              enableWhen: [{ question: 'famHist', operator: '=', answerCoding: { code: 'MED' } }],
              item: [
                {
                  linkId: 'famHist.meds.name',
                  type: 'string',
                  text: 'Name',
                  enableWhen: [{ question: 'famHist.meds', operator: '=', answerCoding: { code: 'M1' } }],
                },
              ],
            },
          ],
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['famHist', ['MED']],
        ['famHist.meds', ['M1']],
        ['famHist.meds.name', 'Aspirin'],
      ]);
      const result = buildVisitSummary(questions, answers, 'History', { useLabeledFormat: true });

      const item = result[0].items.find(i => i.type === 'labelValue' && (i as any).label === 'Medication');
      expect(item).toBeDefined();
      if (item && item.type === 'labelValue') {
        expect(item.value).toContain('Aspirin');
      }
    });
  });

  describe('associated symptoms multiSelectChild with extra matching children', () => {
    it('should mark remaining non-multi-select matching children as processed', () => {
      const questions: AyuQuestion[] = [
        {
          linkId: 'patHist',
          type: 'choice',
          text: 'Do you have a history of any of the following?*',
          repeats: true,
          extension: [
            { url: 'urn:intelehealth:original-question-text', valueString: 'Do you have a history of any of the following?*' },
            { url: 'https://intelehealth.org/fhir/StructureDefinition/language', valueString: 'Medical history' },
          ],
          answerOption: [
            { valueCoding: { code: 'MED', display: 'Medication' } },
          ],
          item: [
            {
              linkId: 'patHist.meds',
              type: 'choice',
              text: 'Medications',
              repeats: true,
              answerOption: [
                { valueCoding: { code: 'M1', display: 'Med 1' } },
              ],
              enableWhen: [{ question: 'patHist', operator: '=', answerCoding: { code: 'MED' } }],
              item: [
                {
                  linkId: 'patHist.meds.name',
                  type: 'string',
                  text: 'Name',
                  enableWhen: [{ question: 'patHist.meds', operator: '=', answerCoding: { code: 'M1' } }],
                },
              ],
            },
            {
              linkId: 'patHist.extra',
              type: 'string',
              text: 'Extra note',
              enableWhen: [{ question: 'patHist', operator: '=', answerCoding: { code: 'MED' } }],
            },
          ],
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['patHist', ['MED']],
        ['patHist.meds', ['M1']],
        ['patHist.meds.name', 'Aspirin'],
      ]);
      const result = buildVisitSummary(questions, answers, 'History', { useLabeledFormat: true });

      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Medical history',
        value: expect.stringContaining('Aspirin'),
      });
    });
  });

  describe('multi-select with nested children but empty labeled parts', () => {
    it('should use display text when nested children have no answers', () => {
      const questions: AyuQuestion[] = [
        makeChoiceQuestion({
          linkId: 'q1',
          repeats: true,
          item: [
            {
              linkId: 'q1.child',
              type: 'string',
              text: 'Detail',
              enableWhen: [{ question: 'q1', operator: '=', answerCoding: { code: 'CODE_A' } }],
            },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', ['CODE_A']],
        ['q1.child', 'detail value'],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      expect(result[0].items[0].type).toBe('labelValue');
      if (result[0].items[0].type === 'labelValue') {
        expect(result[0].items[0].value).toContain('Option A');
        expect(result[0].items[0].value).toContain('detail value');
      }
    });
  });

  describe('branch coverage for fallback paths', () => {
    it('should fall back to item.text when language is percent but no display ext', () => {
      const questions: AyuQuestion[] = [
        makeQuestion({
          type: 'string',
          text: 'Fallback text',
          extension: [
            {
              url: 'https://intelehealth.org/fhir/StructureDefinition/language',
              valueString: '%',
            },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([['q1', 'answer']]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      expect((result[0].items[0] as any).label).toBe('Fallback text');
    });

    it('should handle getDisplay when opt has no display and no valueString', () => {
      const questions: AyuQuestion[] = [
        makeChoiceQuestion({
          answerOption: [
            { valueCoding: { code: 'CODE_A' } },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([['q1', 'CODE_A']]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      expect(result).toEqual([]);
    });

    it('should handle quantity dropdownValues with number but no days', () => {
      const questions = [makeQuestion({ type: 'quantity' })];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', { dropdownValues: { number: 5, days: null } } as any],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      expect((result[0].items[0] as any).value).toBe('5');
    });

    it('should handle collectLabeledValues when item.text is empty', () => {
      const questions: AyuQuestion[] = [
        {
          linkId: 'patHist',
          type: 'choice',
          text: 'History',
          repeats: true,
          extension: [
            { url: 'urn:intelehealth:original-question-text', valueString: 'History' },
            { url: 'https://intelehealth.org/fhir/StructureDefinition/language', valueString: 'Medical history' },
          ],
          answerOption: [{ valueCoding: { code: 'DIAB', display: 'Diabetes' } }],
          item: [
            {
              linkId: 'patHist.child',
              type: 'integer',
              text: '',
              extension: [{ url: 'urn:intelehealth:original-question-text', valueString: '' }],
              enableWhen: [{ question: 'patHist', operator: '=', answerCoding: { code: 'DIAB' } }],
            },
          ],
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['patHist', ['DIAB']],
        ['patHist.child', 42],
      ]);
      const result = buildVisitSummary(questions, answers, 'History', { useLabeledFormat: true });
      expect((result[0].items[0] as any).value).toContain('42');
    });

    it('should handle associated symptoms code with no display (line 249)', () => {
      const questions: AyuQuestion[] = [
        {
          linkId: 'assoc',
          type: 'choice',
          text: 'Associated symptoms',
          repeats: true,
          extension: [
            { url: 'urn:intelehealth:original-question-text', valueString: 'Associated symptoms' },
          ],
          answerOption: [
            { valueCoding: { code: 'ID_1', display: 'Headache' } },
          ],
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['assoc', ['ID_1', 'UNKNOWN_CODE']],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      const assocSection = result.find(s => s.title === 'Associated symptoms');
      expect(assocSection).toBeDefined();
      const reports = assocSection!.items.find(i => i.type === 'subheading' && i.heading === 'Patient reports');
      expect(reports).toBeDefined();
      if (reports?.type === 'subheading') {
        expect(reports.values[0]).toContain('Headache');
      }
    });

    it('should handle single select display with no nested values (line 469)', () => {
      const questions = [
        makeChoiceQuestion({
          answerOption: [
            { valueCoding: { code: 'CODE_A' } },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([['q1', 'CODE_A']]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      expect(result).toEqual([]);
    });
  });

  describe('collectNestedOwnValues edge cases', () => {
    it('should handle nested multi-select with child that has matching children with values', () => {
      const questions: AyuQuestion[] = [
        {
          linkId: 'assoc',
          type: 'choice',
          text: 'Associated symptoms',
          repeats: true,
          extension: [
            {
              url: 'urn:intelehealth:original-question-text',
              valueString: 'Associated symptoms',
            },
          ],
          answerOption: [
            { valueCoding: { code: 'ID_1', display: 'Headache' } },
          ],
          item: [
            {
              linkId: 'assoc.severity',
              type: 'choice',
              text: 'Severity',
              repeats: true,
              extension: [
                {
                  url: 'urn:intelehealth:original-question-text',
                  valueString: 'Severity',
                },
              ],
              answerOption: [
                { valueCoding: { code: 'MILD', display: 'Mild' } },
                { valueCoding: { code: 'SEV', display: 'Severe' } },
              ],
              enableWhen: [
                {
                  question: 'assoc',
                  operator: '=',
                  answerCoding: { code: 'ID_1' },
                },
              ],
              item: [
                {
                  linkId: 'assoc.severity.detail',
                  type: 'string',
                  text: 'Detail',
                  extension: [
                    {
                      url: 'urn:intelehealth:original-question-text',
                      valueString: 'Detail',
                    },
                  ],
                  enableWhen: [
                    {
                      question: 'assoc.severity',
                      operator: '=',
                      answerCoding: { code: 'SEV' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['assoc', ['ID_1']],
        ['assoc.severity', ['SEV']],
        ['assoc.severity.detail', 'Very painful'],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');

      const assocSection = result.find(s => s.title === 'Associated symptoms');
      expect(assocSection).toBeDefined();
      const reports = assocSection!.items.find(
        i => i.type === 'subheading' && i.heading === 'Patient reports'
      );
      expect(reports).toBeDefined();
      if (reports && reports.type === 'subheading') {
        expect(reports.values[0]).toContain('Headache');
        expect(reports.values[0]).toContain('Severe');
        expect(reports.values[0]).toContain('Very painful');
      }
    });

    it('should skip nested answer when it equals label', () => {
      const questions: AyuQuestion[] = [
        makeChoiceQuestion({
          repeats: true,
          item: [
            {
              linkId: 'q1.nested',
              type: 'string',
              text: 'Details',
              extension: [
                {
                  url: 'urn:intelehealth:original-question-text',
                  valueString: 'Details',
                },
              ],
              enableWhen: [
                {
                  question: 'q1',
                  operator: '=',
                  answerCoding: { code: 'CODE_A' },
                },
              ],
            },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', ['CODE_A']],
        ['q1.nested', 'Details'],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');

      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Select option',
        value: 'Option A – Details',
      });
    });

    it('should handle collectLabeledValues array answer with child but no child answers', () => {
      const questions: AyuQuestion[] = [
        {
          linkId: 'patHist',
          type: 'choice',
          text: 'Do you have a history of any of the following?*',
          repeats: true,
          extension: [
            {
              url: 'urn:intelehealth:original-question-text',
              valueString: 'Do you have a history of any of the following?*',
            },
            {
              url: 'https://intelehealth.org/fhir/StructureDefinition/language',
              valueString: 'Medical history',
            },
          ],
          answerOption: [
            { valueCoding: { code: 'DIAB', display: 'Diabetes' } },
          ],
          item: [
            {
              linkId: 'patHist.sub',
              type: 'choice',
              text: 'Sub symptoms',
              repeats: true,
              extension: [
                {
                  url: 'urn:intelehealth:original-question-text',
                  valueString: 'Sub symptoms',
                },
              ],
              answerOption: [
                { valueCoding: { code: 'S1', display: 'Symptom 1' } },
                { valueCoding: { code: 'S2', display: 'Symptom 2' } },
              ],
              enableWhen: [
                {
                  question: 'patHist',
                  operator: '=',
                  answerCoding: { code: 'DIAB' },
                },
              ],
              item: [
                {
                  linkId: 'patHist.sub.detail',
                  type: 'string',
                  text: 'Detail',
                  extension: [
                    {
                      url: 'urn:intelehealth:original-question-text',
                      valueString: 'Detail',
                    },
                  ],
                  enableWhen: [
                    {
                      question: 'patHist.sub',
                      operator: '=',
                      answerCoding: { code: 'S1' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['patHist', ['DIAB']],
        ['patHist.sub', ['S1', 'S2']],
      ]);
      const result = buildVisitSummary(questions, answers, 'History', {
        useLabeledFormat: true,
      });

      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Medical history',
        value: expect.stringContaining('Symptom 1'),
      });
    });

    it('should handle collectNestedOwnValues multi-select with matching child but no child values', () => {
      const questions: AyuQuestion[] = [
        makeChoiceQuestion({
          repeats: true,
          item: [
            {
              linkId: 'q1.nested',
              type: 'choice',
              text: 'Nested multi',
              repeats: true,
              extension: [
                {
                  url: 'urn:intelehealth:original-question-text',
                  valueString: 'Nested multi',
                },
              ],
              answerOption: [
                { valueCoding: { code: 'N1', display: 'Nested 1' } },
                { valueCoding: { code: 'N2', display: 'Nested 2' } },
              ],
              enableWhen: [
                {
                  question: 'q1',
                  operator: '=',
                  answerCoding: { code: 'CODE_A' },
                },
              ],
              item: [
                {
                  linkId: 'q1.nested.grandchild',
                  type: 'string',
                  text: 'GC',
                  extension: [
                    {
                      url: 'urn:intelehealth:original-question-text',
                      valueString: 'GC',
                    },
                  ],
                  enableWhen: [
                    {
                      question: 'q1.nested',
                      operator: '=',
                      answerCoding: { code: 'N1' },
                    },
                  ],
                },
              ],
            },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', ['CODE_A']],
        ['q1.nested', ['N1', 'N2']],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');

      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Select option',
        value: 'Option A – Nested 1, Nested 2',
      });
    });

    it('should handle multi-select code with no display (skip it)', () => {
      const questions: AyuQuestion[] = [
        makeChoiceQuestion({
          repeats: true,
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', ['CODE_A', 'UNKNOWN']],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');

      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Select option',
        value: 'Option A',
      });
    });

    it('should collect descendant values from deeply nested unprocessed children', () => {
      const questions: AyuQuestion[] = [
        makeChoiceQuestion({
          repeats: true,
          item: [
            {
              linkId: 'q1.nested',
              type: 'choice',
              text: 'Nested',
              extension: [
                {
                  url: 'urn:intelehealth:original-question-text',
                  valueString: 'Nested',
                },
              ],
              answerOption: [
                { valueCoding: { code: 'N1', display: 'Nested 1' } },
              ],
              enableWhen: [
                {
                  question: 'q1',
                  operator: '=',
                  answerCoding: { code: 'CODE_A' },
                },
              ],
              item: [
                {
                  linkId: 'q1.nested.deep',
                  type: 'string',
                  text: 'Deep child',
                  extension: [
                    {
                      url: 'urn:intelehealth:original-question-text',
                      valueString: 'Deep child',
                    },
                  ],
                },
              ],
            },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', ['CODE_A']],
        ['q1.nested', 'N1'],
        ['q1.nested.deep', 'deep value'],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');

      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Select option',
        value: expect.stringContaining('deep value'),
      });
    });
  });

  describe('100% line coverage — empty child fallback branches', () => {
    it('line 144-145: collectNestedOwnValues matching child exists but has empty childValues', () => {
      const questions: AyuQuestion[] = [
        makeChoiceQuestion({
          item: [
            {
              linkId: 'q1.nested',
              type: 'choice',
              text: 'Nested',
              repeats: true,
              extension: [{ url: 'urn:intelehealth:original-question-text', valueString: 'Nested' }],
              answerOption: [
                { valueCoding: { code: 'N1', display: 'Nested 1' } },
              ],
              enableWhen: [{ question: 'q1', operator: '=', answerCoding: { code: 'CODE_A' } }],
              item: [
                {
                  linkId: 'q1.nested.gc',
                  type: 'string',
                  text: 'GC',
                  extension: [{ url: 'urn:intelehealth:original-question-text', valueString: 'GC' }],
                  enableWhen: [{ question: 'q1.nested', operator: '=', answerCoding: { code: 'N1' } }],
                },
              ],
            },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', 'CODE_A'],
        ['q1.nested', ['N1']],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      expect(result[0].items[0].type).toBe('labelValue');
      if (result[0].items[0].type === 'labelValue') {
        expect(result[0].items[0].value).toContain('Nested 1');
      }
    });

    it('line 144 via associated symptoms: matching child with no childValues in collectNestedOwnValues', () => {
      const questions: AyuQuestion[] = [
        {
          linkId: 'assoc',
          type: 'choice',
          text: 'Associated symptoms',
          repeats: true,
          extension: [{ url: 'urn:intelehealth:original-question-text', valueString: 'Associated symptoms' }],
          answerOption: [
            { valueCoding: { code: 'ID_1', display: 'Headache' } },
          ],
          item: [
            {
              linkId: 'assoc.child',
              type: 'choice',
              text: 'Severity',
              repeats: true,
              extension: [{ url: 'urn:intelehealth:original-question-text', valueString: 'Severity' }],
              answerOption: [
                { valueCoding: { code: 'S1', display: 'Mild' } },
              ],
              enableWhen: [{ question: 'assoc', operator: '=', answerCoding: { code: 'ID_1' } }],
              item: [
                {
                  linkId: 'assoc.child.detail',
                  type: 'string',
                  text: 'Detail',
                  extension: [{ url: 'urn:intelehealth:original-question-text', valueString: 'Detail' }],
                  enableWhen: [{ question: 'assoc.child', operator: '=', answerCoding: { code: 'S1' } }],
                },
              ],
            },
          ],
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['assoc', ['ID_1']],
        ['assoc.child', ['S1']],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      const assocSection = result.find(s => s.title === 'Associated symptoms');
      expect(assocSection).toBeDefined();
      const reports = assocSection!.items.find(i => i.type === 'subheading' && i.heading === 'Patient reports');
      expect(reports).toBeDefined();
      if (reports?.type === 'subheading') {
        expect(reports.values[0]).toContain('Mild');
      }
    });

    it('line 193: collectLabeledValues array answer with matching child but empty childParts', () => {
      const questions: AyuQuestion[] = [
        {
          linkId: 'patHist',
          type: 'choice',
          text: 'Do you have a history of any of the following?*',
          repeats: true,
          extension: [
            { url: 'urn:intelehealth:original-question-text', valueString: 'Do you have a history of any of the following?*' },
            { url: 'https://intelehealth.org/fhir/StructureDefinition/language', valueString: 'Medical history' },
          ],
          answerOption: [
            { valueCoding: { code: 'DIAB', display: 'Diabetes' } },
          ],
          item: [
            {
              linkId: 'patHist.sub',
              type: 'choice',
              text: 'Sub',
              repeats: true,
              extension: [{ url: 'urn:intelehealth:original-question-text', valueString: 'Sub' }],
              answerOption: [
                { valueCoding: { code: 'S1', display: 'Sub 1' } },
                { valueCoding: { code: 'S2', display: 'Sub 2' } },
              ],
              enableWhen: [{ question: 'patHist', operator: '=', answerCoding: { code: 'DIAB' } }],
              item: [
                {
                  linkId: 'patHist.sub.detail',
                  type: 'string',
                  text: 'Detail',
                  extension: [{ url: 'urn:intelehealth:original-question-text', valueString: 'Detail' }],
                  enableWhen: [{ question: 'patHist.sub', operator: '=', answerCoding: { code: 'S1' } }],
                },
              ],
            },
          ],
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['patHist', ['DIAB']],
        ['patHist.sub', ['S1', 'S2']],
      ]);
      const result = buildVisitSummary(questions, answers, 'History', { useLabeledFormat: true });
      expect(result[0].items[0].type).toBe('labelValue');
      if (result[0].items[0].type === 'labelValue') {
        expect(result[0].items[0].value).toContain('Sub 1');
        expect(result[0].items[0].value).toContain('Sub 2');
      }
    });

    it('line 193: collectLabeledValues array with child that HAS answers (true branch)', () => {
      const questions: AyuQuestion[] = [
        {
          linkId: 'patHist',
          type: 'choice',
          text: 'Do you have a history of any of the following?*',
          repeats: true,
          extension: [
            { url: 'urn:intelehealth:original-question-text', valueString: 'Do you have a history of any of the following?*' },
            { url: 'https://intelehealth.org/fhir/StructureDefinition/language', valueString: 'Medical history' },
          ],
          answerOption: [
            { valueCoding: { code: 'DIAB', display: 'Diabetes' } },
          ],
          item: [
            {
              linkId: 'patHist.sub',
              type: 'choice',
              text: 'Condition',
              repeats: true,
              extension: [{ url: 'urn:intelehealth:original-question-text', valueString: 'Condition' }],
              answerOption: [
                { valueCoding: { code: 'S1', display: 'Type 1' } },
              ],
              enableWhen: [{ question: 'patHist', operator: '=', answerCoding: { code: 'DIAB' } }],
              item: [
                {
                  linkId: 'patHist.sub.detail',
                  type: 'string',
                  text: 'Notes',
                  extension: [{ url: 'urn:intelehealth:original-question-text', valueString: 'Notes' }],
                  enableWhen: [{ question: 'patHist.sub', operator: '=', answerCoding: { code: 'S1' } }],
                },
              ],
            },
          ],
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['patHist', ['DIAB']],
        ['patHist.sub', ['S1']],
        ['patHist.sub.detail', 'insulin dependent'],
      ]);
      const result = buildVisitSummary(questions, answers, 'History', { useLabeledFormat: true });
      expect(result[0].items[0].type).toBe('labelValue');
      if (result[0].items[0].type === 'labelValue') {
        expect(result[0].items[0].value).toContain('Type 1');
        expect(result[0].items[0].value).toContain('insulin dependent');
      }
    });

    it('line 505: multi-select option with nested children but no labeled parts', () => {
      const questions: AyuQuestion[] = [
        makeChoiceQuestion({
          linkId: 'q1',
          repeats: true,
          item: [
            {
              linkId: 'q1.child',
              type: 'string',
              text: 'Detail',
              enableWhen: [{ question: 'q1', operator: '=', answerCoding: { code: 'CODE_A' } }],
            },
            {
              linkId: 'q1.child2',
              type: 'string',
              text: 'Detail2',
              enableWhen: [{ question: 'q1', operator: '=', answerCoding: { code: 'CODE_B' } }],
            },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', ['CODE_A', 'CODE_B']],
        ['q1.child2', 'some detail'],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      expect(result[0].items[0].type).toBe('labelValue');
      if (result[0].items[0].type === 'labelValue') {
        expect(result[0].items[0].value).toContain('Option A');
        expect(result[0].items[0].value).toContain('Option B');
        expect(result[0].items[0].value).toContain('some detail');
      }
    });

    it('line 394: associated symptoms multiSelectChild with empty medicationEntries', () => {
      const questions: AyuQuestion[] = [
        {
          linkId: 'patHist',
          type: 'choice',
          text: 'Do you have a history of any of the following?*',
          repeats: true,
          extension: [
            { url: 'urn:intelehealth:original-question-text', valueString: 'Do you have a history of any of the following?*' },
            { url: 'https://intelehealth.org/fhir/StructureDefinition/language', valueString: 'Medical history' },
          ],
          answerOption: [
            { valueCoding: { code: 'MED', display: 'Medication' } },
          ],
          item: [
            {
              linkId: 'patHist.meds',
              type: 'choice',
              repeats: true,
              text: 'Meds',
              answerOption: [
                { valueCoding: { code: 'M1', display: 'Med 1' } },
              ],
              enableWhen: [{ question: 'patHist', operator: '=', answerCoding: { code: 'MED' } }],
              item: [
                {
                  linkId: 'patHist.meds.name',
                  type: 'string',
                  text: 'Name',
                  enableWhen: [{ question: 'patHist.meds', operator: '=', answerCoding: { code: 'M1' } }],
                },
              ],
            },
          ],
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['patHist', ['MED']],
        ['patHist.meds', ['UNKNOWN_CODE']],
      ]);
      const result = buildVisitSummary(questions, answers, 'History', { useLabeledFormat: true });
      expect(result).toEqual([]);
    });

    it('line 575: single-select multiSelectChild with unknown code (no display)', () => {
      const questions: AyuQuestion[] = [
        makeChoiceQuestion({
          item: [
            {
              linkId: 'q1.meds',
              type: 'choice',
              repeats: true,
              text: 'Meds',
              answerOption: [
                { valueCoding: { code: 'M1', display: 'Med 1' } },
              ],
              enableWhen: [{ question: 'q1', operator: '=', answerCoding: { code: 'CODE_A' } }],
              item: [
                {
                  linkId: 'q1.meds.detail',
                  type: 'string',
                  text: 'Detail',
                  enableWhen: [{ question: 'q1.meds', operator: '=', answerCoding: { code: 'M1' } }],
                },
              ],
            },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', 'CODE_A'],
        ['q1.meds', ['UNKNOWN']],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      expect(result).toEqual([]);
    });

    it('line 478: hasNestedAnswers check when nested.item is explicitly undefined', () => {
      const questions: AyuQuestion[] = [
        makeChoiceQuestion({
          linkId: 'q1',
          repeats: true,
          item: [
            {
              linkId: 'q1.nested',
              type: 'string',
              text: 'Detail',
              item: undefined,
              enableWhen: [{ question: 'q1', operator: '=', answerCoding: { code: 'CODE_A' } }],
            },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', ['CODE_A']],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Select option',
        value: 'Option A',
      });
    });

    it('line 486: multi-select hasNestedAnswers path with unknown code (no display)', () => {
      const questions: AyuQuestion[] = [
        makeChoiceQuestion({
          linkId: 'q1',
          repeats: true,
          item: [
            {
              linkId: 'q1.child',
              type: 'string',
              text: 'Detail',
              enableWhen: [{ question: 'q1', operator: '=', answerCoding: { code: 'CODE_A' } }],
            },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', ['CODE_A', 'UNKNOWN']],
        ['q1.child', 'detail value'],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      expect(result[0].items[0].type).toBe('labelValue');
      if (result[0].items[0].type === 'labelValue') {
        expect(result[0].items[0].value).toContain('Option A');
        expect(result[0].items[0].value).not.toContain('UNKNOWN');
      }
    });

    it('line 494: multi-select hasNestedAnswers with item that has no .item children', () => {
      const questions: AyuQuestion[] = [
        makeChoiceQuestion({
          linkId: 'q1',
          repeats: true,
          item: [
            {
              linkId: 'q1.child',
              type: 'string',
              text: 'Detail',
              enableWhen: [{ question: 'q1', operator: '=', answerCoding: { code: 'CODE_A' } }],
            },
            {
              linkId: 'q1.child2',
              type: 'string',
              text: 'Detail2',
              enableWhen: [{ question: 'q1', operator: '=', answerCoding: { code: 'CODE_B' } }],
            },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', ['CODE_A', 'CODE_B']],
        ['q1.child', 'val A'],
        ['q1.child2', 'val B'],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      expect(result[0].items[0].type).toBe('labelValue');
    });

    it('line 583+628: single-select multiSelectChild with no .item on multiSelectChild', () => {
      const questions: AyuQuestion[] = [
        makeChoiceQuestion({
          item: [
            {
              linkId: 'q1.meds',
              type: 'choice',
              repeats: true,
              text: 'Meds',
              answerOption: [
                { valueCoding: { code: 'M1', display: 'Med 1' } },
              ],
              enableWhen: [{ question: 'q1', operator: '=', answerCoding: { code: 'CODE_A' } }],
            },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', 'CODE_A'],
        ['q1.meds', ['M1']],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      expect(result[0].items[0].type).toBe('labelValue');
      if (result[0].items[0].type === 'labelValue') {
        expect(result[0].items[0].value).toContain('Med 1');
      }
    });

    it('line 628: single-select with matching nested but no nested values', () => {
      const questions: AyuQuestion[] = [
        makeChoiceQuestion({
          item: [
            {
              linkId: 'q1.child',
              type: 'string',
              text: 'Detail',
              extension: [{ url: 'urn:intelehealth:original-question-text', valueString: 'Detail' }],
              enableWhen: [{ question: 'q1', operator: '=', answerCoding: { code: 'CODE_A' } }],
            },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', 'CODE_A'],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Select option',
        value: 'Option A',
      });
    });

    it('line 193: collectLabeledValues array branch via group container with nested multi-select', () => {
      const questions: AyuQuestion[] = [
        {
          linkId: 'patHist',
          type: 'choice',
          text: 'Do you have a history of any of the following?*',
          repeats: true,
          extension: [
            { url: 'urn:intelehealth:original-question-text', valueString: 'Do you have a history of any of the following?*' },
            { url: 'https://intelehealth.org/fhir/StructureDefinition/language', valueString: 'Medical history' },
          ],
          answerOption: [
            { valueCoding: { code: 'DIAB', display: 'Diabetes' } },
          ],
          item: [
            {
              linkId: 'patHist.group',
              type: 'group',
              text: 'Details',
              enableWhen: [{ question: 'patHist', operator: '=', answerCoding: { code: 'DIAB' } }],
              item: [
                {
                  linkId: 'patHist.group.name',
                  type: 'string',
                  text: 'Medicine name',
                },
                {
                  linkId: 'patHist.group.types',
                  type: 'choice',
                  repeats: true,
                  text: 'Types',
                  answerOption: [
                    { valueCoding: { code: 'T1', display: 'Type 1' } },
                  ],
                  item: [
                    {
                      linkId: 'patHist.group.types.detail',
                      type: 'string',
                      text: 'Notes',
                      enableWhen: [{ question: 'patHist.group.types', operator: '=', answerCoding: { code: 'T1' } }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['patHist', ['DIAB']],
        ['patHist.group.name', 'Metformin'],
        ['patHist.group.types', ['T1']],
        ['patHist.group.types.detail', 'insulin'],
      ]);
      const result = buildVisitSummary(questions, answers, 'History', { useLabeledFormat: true });

      expect(result[0].items[0].type).toBe('labelValue');
      if (result[0].items[0].type === 'labelValue') {
        expect(result[0].items[0].value).toContain('Metformin');
        expect(result[0].items[0].value).toContain('Type 1');
        expect(result[0].items[0].value).toContain('insulin');
      }
    });

    it('line 70: formatAnswerByType returns null for integer type with array answer', () => {
      const questions = [makeQuestion({ type: 'integer' })];
      const answers = new Map<string, AyuAnswerValue>([['q1', ['not', 'a', 'number'] as unknown as AyuAnswerValue]]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      expect(result).toEqual([]);
    });

    it('line 518: multi-select hasNestedAnswers with item.item undefined (itemChildren fallback)', () => {
      // The parent question has no .item property, forcing `item.item || []` to use the fallback
      const questions: AyuQuestion[] = [
        {
          linkId: 'q1',
          type: 'choice',
          text: 'Multi Q',
          repeats: true,
          extension: [{ url: 'urn:intelehealth:original-question-text', valueString: 'Multi Q' }],
          answerOption: [
            { valueCoding: { code: 'A', display: 'Option A' } },
            { valueCoding: { code: 'B', display: 'Option B' } },
          ],
          // item is intentionally undefined — triggers `item.item || []` fallback at line 518
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', ['A', 'B']],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Multi Q',
        value: 'Option A, Option B',
      });
    });

    it('line 603: single-select multiSelectChild.item undefined (msChildren fallback)', () => {
      // Single-select with nested multi-select child that has no .item property
      const questions: AyuQuestion[] = [
        makeChoiceQuestion({
          item: [
            {
              linkId: 'q1.meds',
              type: 'choice',
              repeats: true,
              text: 'Meds',
              answerOption: [
                { valueCoding: { code: 'M1', display: 'Med 1' } },
                { valueCoding: { code: 'M2', display: 'Med 2' } },
              ],
              enableWhen: [{ question: 'q1', operator: '=', answerCoding: { code: 'CODE_A' } }],
              // No item property — triggers `multiSelectChild.item || []` at line 603
            },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', 'CODE_A'],
        ['q1.meds', ['M1', 'M2']],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      expect(result[0].items[0].type).toBe('labelValue');
      if (result[0].items[0].type === 'labelValue') {
        expect(result[0].items[0].value).toContain('Med 1');
        expect(result[0].items[0].value).toContain('Med 2');
      }
    });

    it('line 409: labeled format multiSelectChild with no .item property (msChildren fallback)', () => {
      // Patient history with nested multi-select child where child has no .item
      const questions: AyuQuestion[] = [
        {
          linkId: 'patHist',
          type: 'choice',
          text: 'Do you have a history of any of the following?*',
          repeats: true,
          extension: [
            { url: 'urn:intelehealth:original-question-text', valueString: 'Do you have a history of any of the following?*' },
            { url: 'https://intelehealth.org/fhir/StructureDefinition/language', valueString: 'Medical history' },
          ],
          answerOption: [
            { valueCoding: { code: 'MED', display: 'Medication' } },
          ],
          item: [
            {
              linkId: 'patHist.meds',
              type: 'choice',
              repeats: true,
              text: 'Medications',
              answerOption: [
                { valueCoding: { code: 'M1', display: 'Med 1' } },
              ],
              enableWhen: [{ question: 'patHist', operator: '=', answerCoding: { code: 'MED' } }],
              // No item property — triggers the `|| []` fallback in the labeled format path
            },
          ],
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['patHist', ['MED']],
        ['patHist.meds', ['M1']],
      ]);
      const result = buildVisitSummary(questions, answers, 'History', { useLabeledFormat: true });
      expect(result[0].items[0].type).toBe('labelValue');
      if (result[0].items[0].type === 'labelValue') {
        expect(result[0].items[0].value).toContain('Med 1');
      }
    });
  });

  describe('collectDescendantValues processed.has branch (lines 124-128)', () => {
    it('should skip already-processed descendants when collectDescendantValues encounters them again', () => {
      // Single-select question with two sibling nested children matching the same answerCoding code.
      // Both nested children share a grandchild linkId. When `collectDescendantValues` is called
      // for the first nested child, the grandchild is processed. For the second nested child,
      // `collectDescendantValues` hits the `processed.has(child.linkId) continue` branch.
      const questions: AyuQuestion[] = [
        makeChoiceQuestion({
          linkId: 'q1',
          text: 'Main question',
          extension: [
            { url: 'urn:intelehealth:original-question-text', valueString: 'Main question' },
          ],
          answerOption: [
            { valueCoding: { code: 'CODE_A', display: 'Option A' } },
          ],
          item: [
            {
              linkId: 'q1.nested1',
              type: 'string',
              text: 'Nested 1',
              extension: [
                { url: 'urn:intelehealth:original-question-text', valueString: 'Nested 1' },
              ],
              enableWhen: [
                { question: 'q1', operator: '=', answerCoding: { code: 'CODE_A' } },
              ],
              item: [
                {
                  linkId: 'q1.shared.grandchild',
                  type: 'string',
                  text: 'Grandchild',
                  extension: [
                    { url: 'urn:intelehealth:original-question-text', valueString: 'Grandchild' },
                  ],
                },
              ],
            },
            {
              linkId: 'q1.nested2',
              type: 'string',
              text: 'Nested 2',
              extension: [
                { url: 'urn:intelehealth:original-question-text', valueString: 'Nested 2' },
              ],
              enableWhen: [
                { question: 'q1', operator: '=', answerCoding: { code: 'CODE_A' } },
              ],
              item: [
                {
                  linkId: 'q1.shared.grandchild',
                  type: 'string',
                  text: 'Grandchild',
                  extension: [
                    { url: 'urn:intelehealth:original-question-text', valueString: 'Grandchild' },
                  ],
                },
              ],
            },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', 'CODE_A'],
        ['q1.nested1', 'nested 1 value'],
        ['q1.nested2', 'nested 2 value'],
        ['q1.shared.grandchild', 'grandchild value'],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');

      // The function should process the shared grandchild once and skip it on the second
      // nested child via the `processed.has(child.linkId) continue` branch
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].items[0].type).toBe('labelValue');
      if (result[0].items[0].type === 'labelValue') {
        // Should contain values from nested items
        expect(result[0].items[0].value).toContain('nested 1 value');
      }
    });
  });

  describe('collectDescendantValues evaluateEnableWhen skip branch', () => {
    it('should skip gated grandchildren inside collectDescendantValues', () => {
      /* Associated symptoms path calls collectDescendantValues(nested.item)
       * at line 373. The nested child (assoc.child) has its own children
       * (grandchildren). One grandchild's enableWhen is met; the other's is not.
       * The one whose enableWhen is NOT met must be skipped at line 182. */
      const questions: AyuQuestion[] = [
        {
          linkId: 'assoc',
          type: 'choice',
          text: 'Associated symptoms',
          repeats: true,
          extension: [
            { url: 'urn:intelehealth:original-question-text', valueString: 'Associated symptoms' },
          ],
          answerOption: [
            { valueCoding: { code: 'ID_1', display: 'Headache' } },
          ],
          item: [
            {
              linkId: 'assoc.child',
              type: 'choice',
              text: 'Severity',
              extension: [
                { url: 'urn:intelehealth:original-question-text', valueString: 'Severity' },
              ],
              enableWhen: [
                { question: 'assoc', operator: '=', answerCoding: { code: 'ID_1' } },
              ],
              answerOption: [
                { valueCoding: { code: 'MILD', display: 'Mild' } },
                { valueCoding: { code: 'SEVERE', display: 'Severe' } },
              ],
              item: [
                {
                  linkId: 'assoc.grandchild.visible',
                  type: 'string',
                  text: 'Visible grandchild',
                  extension: [
                    { url: 'urn:intelehealth:original-question-text', valueString: 'Visible grandchild' },
                  ],
                  enableWhen: [
                    { question: 'assoc.child', operator: '=', answerCoding: { code: 'MILD' } },
                  ],
                },
                {
                  linkId: 'assoc.grandchild.hidden',
                  type: 'string',
                  text: 'Hidden grandchild',
                  extension: [
                    { url: 'urn:intelehealth:original-question-text', valueString: 'Hidden grandchild' },
                  ],
                  enableWhen: [
                    { question: 'assoc.child', operator: '=', answerCoding: { code: 'SEVERE' } },
                  ],
                },
              ],
            },
          ],
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['assoc', ['ID_1']],
        ['assoc.child', 'MILD'],
        ['assoc.grandchild.visible', 'shown detail'],
        ['assoc.grandchild.hidden', 'stale hidden detail'],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      const assocSection = result.find(s => s.title === 'Associated symptoms');
      expect(assocSection).toBeDefined();
      const reports = assocSection!.items.find(
        i => i.type === 'subheading' && i.heading === 'Patient reports'
      );
      expect(reports).toBeDefined();
      if (reports && reports.type === 'subheading') {
        // Visible grandchild's value should appear
        expect(reports.values[0]).toContain('shown detail');
        // Hidden grandchild's stale value should NOT appear (skipped by evaluateEnableWhen at line 182)
        expect(reports.values[0]).not.toContain('stale hidden detail');
      }
    });
  });

  describe('getExtensionLabel fallback to empty string (line 52)', () => {
    it('should return empty label when item has no text and no display extension', () => {
      const questions: AyuQuestion[] = [
        {
          linkId: 'q1',
          type: 'string',
          text: '', // empty text
          // no display extension
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([['q1', 'my answer']]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      // Should still produce output; the label will be '' but not undefined
      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: '',
        value: 'my answer',
      });
    });
  });

  describe('quantity dropdownValues null fallback (line 97)', () => {
    it('should handle quantity with dropdownValues: null using || {} fallback', () => {
      const questions = [makeQuestion({ type: 'quantity' })];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', { dropdownValues: null } as any],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      // dropdownValues is null, so || {} fires, number is undefined → returns null
      expect(result).toEqual([]);
    });
  });

  describe('collectNestedOwnValues answer equals label (line 135)', () => {
    it('should skip nested value when string answer equals its extension label in single-select', () => {
      // Single-select question with a nested child. The nested child's answer
      // equals its label, which triggers the skip at line 135 of collectNestedOwnValues.
      // This path goes through line 636 (single-select → collectNestedOwnValues).
      const questions: AyuQuestion[] = [
        makeChoiceQuestion({
          linkId: 'q1',
          // Single-select (no repeats)
          answerOption: [
            { valueCoding: { code: 'CODE_A', display: 'Option A' } },
          ],
          item: [
            {
              linkId: 'q1.nested',
              type: 'string',
              text: 'Describe',
              extension: [
                {
                  url: 'https://intelehealth.org/fhir/StructureDefinition/display',
                  valueString: 'Describe',
                },
              ],
              enableWhen: [
                { question: 'q1', operator: '=', answerCoding: { code: 'CODE_A' } },
              ],
            },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', 'CODE_A'],
        // The answer equals the extension label 'Describe'
        ['q1.nested', 'Describe'],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].items[0].type).toBe('labelValue');
      if (result[0].items[0].type === 'labelValue') {
        // Display should be shown but nested value skipped (answer === label)
        expect(result[0].items[0].value).toContain('Option A');
      }
    });
  });

  describe('collectNestedOwnValues getDisplay null (line 142)', () => {
    it('should skip display when getDisplay returns null for nested multi-select in single-select', () => {
      // Single-select question with nested multi-select child containing unknown codes.
      // Goes through single-select path (line 636) → collectNestedOwnValues (line 142).
      const questions: AyuQuestion[] = [
        makeChoiceQuestion({
          linkId: 'q1',
          answerOption: [
            { valueCoding: { code: 'CODE_A', display: 'Option A' } },
          ],
          item: [
            {
              linkId: 'q1.nested',
              type: 'choice',
              text: 'Sub',
              repeats: true,
              answerOption: [
                { valueCoding: { code: 'S1', display: 'Sub1' } },
              ],
              enableWhen: [
                { question: 'q1', operator: '=', answerCoding: { code: 'CODE_A' } },
              ],
            },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', 'CODE_A'],
        // UNKNOWN code won't match any answerOption → getDisplay returns null at line 142
        ['q1.nested', ['UNKNOWN_CODE']],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('collectNestedOwnValues formatAnswerByType returns null (line 168)', () => {
    it('should return empty when formatAnswerByType returns null for nested in single-select', () => {
      // Single-select question with nested string child whose answer is a number
      // (invalid for string type → formatAnswerByType returns null).
      // Goes through line 636 → collectNestedOwnValues → line 168.
      const questions: AyuQuestion[] = [
        makeChoiceQuestion({
          linkId: 'q1',
          answerOption: [
            { valueCoding: { code: 'CODE_A', display: 'Option A' } },
          ],
          item: [
            {
              linkId: 'q1.nested',
              type: 'string',
              text: 'Detail',
              extension: [
                { url: 'urn:intelehealth:original-question-text', valueString: 'Detail' },
              ],
              enableWhen: [
                { question: 'q1', operator: '=', answerCoding: { code: 'CODE_A' } },
              ],
            },
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', 'CODE_A'],
        // Non-string answer for string type → formatAnswerByType returns null at line 168
        ['q1.nested', 42],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].items[0].type).toBe('labelValue');
      if (result[0].items[0].type === 'labelValue') {
        expect(result[0].items[0].value).toContain('Option A');
      }
    });
  });

  describe('collectLabeledValues getDisplay null (line 192)', () => {
    it('should skip display when getDisplay returns null in collectLabeledValues', () => {
      const questions: AyuQuestion[] = [
        {
          linkId: 'patHist',
          type: 'choice',
          text: 'History',
          repeats: true,
          extension: [
            { url: 'urn:intelehealth:original-question-text', valueString: 'History' },
            { url: 'https://intelehealth.org/fhir/StructureDefinition/language', valueString: 'Medical history' },
          ],
          answerOption: [
            { valueCoding: { code: 'DIAB', display: 'Diabetes' } },
          ],
          item: [
            {
              linkId: 'patHist.meds',
              type: 'choice',
              text: 'Meds',
              repeats: true,
              answerOption: [
                { valueCoding: { code: 'M1', display: 'Med 1' } },
              ],
              enableWhen: [{ question: 'patHist', operator: '=', answerCoding: { code: 'DIAB' } }],
            },
          ],
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['patHist', ['DIAB']],
        // UNKNOWN code won't match any answerOption → getDisplay returns null
        ['patHist.meds', ['UNKNOWN_CODE']],
      ]);
      const result = buildVisitSummary(questions, answers, 'History', { useLabeledFormat: true });
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('labeled format summaryLabel fallback branches (line 325)', () => {
    it('should fall back to item.text when no language extension exists', () => {
      // Associated symptoms text triggers isAssociatedSymptoms; useLabeledFormat enters else branch.
      // NO language extension → langExt is undefined → langExt?.valueString is undefined → falls back to item.text
      const questions: AyuQuestion[] = [
        {
          linkId: 'hist',
          type: 'choice',
          text: 'Do you have a history of any of the following?*',
          repeats: true,
          extension: [
            { url: 'urn:intelehealth:original-question-text', valueString: 'Do you have a history of any of the following?*' },
            // Deliberately NO language extension
          ],
          answerOption: [
            { valueCoding: { code: 'A', display: 'Option A' } },
          ],
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([['hist', ['A']]]);
      const result = buildVisitSummary(questions, answers, 'History', { useLabeledFormat: true });
      // summaryLabel should be item.text since langExt is undefined
      expect(result[0].items[0]).toEqual({
        type: 'labelValue',
        label: 'Do you have a history of any of the following?*',
        value: 'Option A',
      });
    });
  });

  describe('getDisplay returns null for positive code in labeled format (line 367)', () => {
    it('should skip positive codes with no display in labeled format', () => {
      // Use associated symptoms text + useLabeledFormat to enter the else branch at line 316
      const questions: AyuQuestion[] = [
        {
          linkId: 'patHist',
          type: 'choice',
          text: 'Do you have a history of any of the following?*',
          repeats: true,
          extension: [
            { url: 'urn:intelehealth:original-question-text', valueString: 'Do you have a history of any of the following?*' },
            { url: 'https://intelehealth.org/fhir/StructureDefinition/language', valueString: 'Medical history' },
          ],
          answerOption: [
            { valueCoding: { code: 'DIAB', display: 'Diabetes' } },
          ],
        },
      ];
      const answers = new Map<string, AyuAnswerValue>([
        // UNKNOWN_CODE has no matching answerOption → getDisplay returns null → early return at line 367
        ['patHist', ['UNKNOWN_CODE', 'DIAB']],
      ]);
      const result = buildVisitSummary(questions, answers, 'History', { useLabeledFormat: true });
      const items = result[0]?.items ?? [];
      // DIAB should still appear, UNKNOWN_CODE should be skipped via the early return
      expect(items.some(i => i.type === 'labelValue' && (i as any).value === 'Diabetes')).toBe(true);
    });
  });

  describe('multi-select with hasNestedAnswers but option has no matching nestedChildren (line 535)', () => {
    it('should use display text directly when an option has no matching nested children', () => {
      // Multi-select where hasNestedAnswers is true (some children have answers)
      // but one selected code does NOT match any child's enableWhen condition
      const questions: AyuQuestion[] = [
        makeChoiceQuestion({
          linkId: 'q1',
          text: 'Multi question',
          repeats: true,
          extension: [
            { url: 'urn:intelehealth:original-question-text', valueString: 'Multi question' },
          ],
          answerOption: [
            { valueCoding: { code: 'CODE_A', display: 'Option A' } },
            { valueCoding: { code: 'CODE_B', display: 'Option B' } },
          ],
          item: [
            {
              linkId: 'q1.detail_a',
              type: 'string',
              text: 'Detail for A',
              extension: [
                { url: 'urn:intelehealth:original-question-text', valueString: 'Detail for A' },
              ],
              enableWhen: [
                { question: 'q1', operator: '=', answerCoding: { code: 'CODE_A' } },
              ],
            },
            // No child with enableWhen matching CODE_B
          ],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['q1', ['CODE_A', 'CODE_B']],
        ['q1.detail_a', 'detail for A'],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');

      expect(result[0].items[0].type).toBe('labelValue');
      if (result[0].items[0].type === 'labelValue') {
        // CODE_A has nested children with answers, so it gets "Option A – detail for A"
        expect(result[0].items[0].value).toContain('Option A');
        expect(result[0].items[0].value).toContain('detail for A');
        // CODE_B has no matching nested children, so it just gets "Option B" (line 535)
        expect(result[0].items[0].value).toContain('Option B');
      }
    });
  });

  describe('collectNestedOwnValues via associated symptoms path', () => {
    const makeAssocQuestion = (
      nestedItems: AyuQuestion[]
    ): AyuQuestion => ({
      linkId: 'assoc',
      type: 'choice',
      text: 'Associated symptoms',
      repeats: true,
      extension: [
        {
          url: 'urn:intelehealth:original-question-text',
          valueString: 'Associated symptoms',
        },
      ],
      answerOption: [
        { valueCoding: { code: 'ID_1', display: 'Headache' } },
      ],
      item: nestedItems,
    });

    it('line 134 false: includes nested string answer that differs from label', () => {
      const questions: AyuQuestion[] = [
        makeAssocQuestion([
          {
            linkId: 'assoc.detail',
            type: 'string',
            text: 'Describe symptom',
            extension: [
              {
                url: 'urn:intelehealth:original-question-text',
                valueString: 'Describe symptom',
              },
            ],
            enableWhen: [
              { question: 'assoc', operator: '=', answerCoding: { code: 'ID_1' } },
            ],
          },
        ]),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['assoc', ['ID_1']],
        // string answer differs from label 'Describe symptom'
        ['assoc.detail', 'Sharp pain behind eyes'],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      const assocSection = result.find(s => s.title === 'Associated symptoms');
      expect(assocSection).toBeDefined();
      const reports = assocSection!.items.find(
        i => i.type === 'subheading' && i.heading === 'Patient reports'
      );
      expect(reports).toBeDefined();
      if (reports && reports.type === 'subheading') {
        expect(reports.values[0]).toContain('Headache');
        expect(reports.values[0]).toContain('Sharp pain behind eyes');
      }
    });

    it('line 141: skips nested multi-select code with no matching answerOption', () => {
      const questions: AyuQuestion[] = [
        makeAssocQuestion([
          {
            linkId: 'assoc.severity',
            type: 'choice',
            text: 'Severity',
            repeats: true,
            answerOption: [
              { valueCoding: { code: 'MILD', display: 'Mild' } },
            ],
            enableWhen: [
              { question: 'assoc', operator: '=', answerCoding: { code: 'ID_1' } },
            ],
          },
        ]),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['assoc', ['ID_1']],
        // UNKNOWN_CODE has no matching answerOption → getDisplay returns null
        ['assoc.severity', ['MILD', 'UNKNOWN_CODE']],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      const assocSection = result.find(s => s.title === 'Associated symptoms');
      expect(assocSection).toBeDefined();
      const reports = assocSection!.items.find(
        i => i.type === 'subheading' && i.heading === 'Patient reports'
      );
      expect(reports).toBeDefined();
      if (reports && reports.type === 'subheading') {
        expect(reports.values[0]).toContain('Mild');
        expect(reports.values[0]).not.toContain('UNKNOWN_CODE');
      }
    });

    it('line 134 true: skips nested string answer that equals its label', () => {
      const questions: AyuQuestion[] = [
        makeAssocQuestion([
          {
            linkId: 'assoc.detail',
            type: 'string',
            text: 'Describe symptom',
            extension: [
              {
                url: 'urn:intelehealth:original-question-text',
                valueString: 'Describe symptom',
              },
            ],
            enableWhen: [
              { question: 'assoc', operator: '=', answerCoding: { code: 'ID_1' } },
            ],
          },
        ]),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['assoc', ['ID_1']],
        // answer equals label → skip at line 134
        ['assoc.detail', 'Describe symptom'],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      const assocSection = result.find(s => s.title === 'Associated symptoms');
      expect(assocSection).toBeDefined();
      const reports = assocSection!.items.find(
        i => i.type === 'subheading' && i.heading === 'Patient reports'
      );
      expect(reports).toBeDefined();
      if (reports && reports.type === 'subheading') {
        // Nested value was skipped because answer === label
        expect(reports.values[0]).toContain('Headache');
        expect(reports.values[0]).not.toContain('Describe symptom');
      }
    });

    it('line 167: returns empty when formatAnswerByType returns null for nested item', () => {
      const questions: AyuQuestion[] = [
        makeAssocQuestion([
          {
            linkId: 'assoc.detail',
            type: 'string',
            text: 'Detail',
            extension: [
              {
                url: 'urn:intelehealth:original-question-text',
                valueString: 'Detail',
              },
            ],
            enableWhen: [
              { question: 'assoc', operator: '=', answerCoding: { code: 'ID_1' } },
            ],
          },
        ]),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['assoc', ['ID_1']],
        // Non-string answer for string type → formatAnswerByType returns null
        ['assoc.detail', 42],
      ]);
      const result = buildVisitSummary(questions, answers, 'Visit');
      const assocSection = result.find(s => s.title === 'Associated symptoms');
      expect(assocSection).toBeDefined();
      const reports = assocSection!.items.find(
        i => i.type === 'subheading' && i.heading === 'Patient reports'
      );
      expect(reports).toBeDefined();
      if (reports && reports.type === 'subheading') {
        // Headache without nested detail (formatted was null)
        expect(reports.values[0]).toContain('Headache');
      }
    });
  });

  describe('protocol grouping (multi-protocol summaries)', () => {
    it('should emit one section per protocol titled by protocolCode', () => {
      const questions = [
        makeQuestion({
          linkId: 'Abdominal pain:q1',
          text: 'When did the pain start?',
          protocolCode: 'Abdominal pain',
          extension: [],
        }),
        makeQuestion({
          linkId: 'Burns:q1',
          text: 'Where did you get burned?',
          protocolCode: 'Burns',
          extension: [],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['Abdominal pain:q1', 'Last night'],
        ['Burns:q1', 'Hand'],
      ]);

      const result = buildVisitSummary(questions, answers, 'Visit reason');

      expect(result.map(s => s.title)).toEqual(['Abdominal pain', 'Burns']);
      expect(result[0].items).toEqual([
        {
          type: 'labelValue',
          label: 'When did the pain start?',
          value: 'Last night',
        },
      ]);
      expect(result[1].items).toEqual([
        {
          type: 'labelValue',
          label: 'Where did you get burned?',
          value: 'Hand',
        },
      ]);
    });

    it('should preserve first-seen protocol order and group all questions of a protocol together', () => {
      const questions = [
        makeQuestion({
          linkId: 'Abdominal pain:q1',
          text: 'Q1',
          protocolCode: 'Abdominal pain',
          extension: [],
        }),
        makeQuestion({
          linkId: 'Burns:q1',
          text: 'Q burns',
          protocolCode: 'Burns',
          extension: [],
        }),
        makeQuestion({
          linkId: 'Abdominal pain:q2',
          text: 'Q2',
          protocolCode: 'Abdominal pain',
          extension: [],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['Abdominal pain:q1', 'A1'],
        ['Burns:q1', 'B1'],
        ['Abdominal pain:q2', 'A2'],
      ]);

      const result = buildVisitSummary(questions, answers, 'Visit reason');

      expect(result.map(s => s.title)).toEqual(['Abdominal pain', 'Burns']);
      expect(result[0].items.map(i => i.type === 'labelValue' && i.value)).toEqual(
        ['A1', 'A2']
      );
    });

    it('should append ungrouped items (merged associated symptoms) after protocol sections', () => {
      const questions = [
        makeQuestion({
          linkId: 'Abdominal pain:q1',
          text: 'Q1',
          protocolCode: 'Abdominal pain',
          extension: [],
        }),
        makeChoiceQuestion({
          linkId: 'assoc',
          text: 'Associated symptoms',
          repeats: true,
          answerOption: [
            { valueCoding: { code: 'ID_1', display: 'Headache' } },
          ],
          extension: [],
        }),
      ];
      const answers = new Map<string, AyuAnswerValue>([
        ['Abdominal pain:q1', 'A1'],
        ['assoc', ['ID_1']],
      ]);

      const result = buildVisitSummary(questions, answers, 'Visit reason');

      expect(result[0].title).toBe('Abdominal pain');
      expect(result[result.length - 1].title).toBe('Associated symptoms');
    });

    it('should not group when no item carries a protocolCode', () => {
      const questions = [makeQuestion({ text: 'Q1', extension: [] })];
      const answers = new Map<string, AyuAnswerValue>([['q1', 'A1']]);

      const result = buildVisitSummary(questions, answers, 'Visit reason');

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Visit reason');
    });
  });
});
