import { describe, expect, it } from 'vitest';
import { resolveAyuComponent } from '../../../../modules/ayu-library/logic/decision-matrix';
import { isMutuallyExclusiveOption } from '../../../../modules/ayu-library/logic/stepper.logic';
import type { AyuQuestion } from '../../../../modules/ayu-library/types/ayu.types';
import type {
  FhirItem,
  FhirQuestionnaire,
} from '../../../../modules/ayu-library/types/fhir-raw.types';
import {
  EXT_URL_AGE_MAX as EXT_AGE_MAX,
  EXT_URL_AGE_MIN as EXT_AGE_MIN,
  EXT_URL_GENDER as EXT_GENDER,
  EXT_URL_IS_EXCLUSIVE_OPTION,
  EXT_URL_ITEM_CONTROL,
  EXT_URL_JOB_AID_FILE,
  EXT_URL_JOB_AID_TYPE,
  EXT_URL_LANGUGAE_TEXT,
  EXT_URL_MUTUALLY_EXCLUSIVE,
  EXT_URL_PE_CATEGORY_LABEL,
  EXT_URL_PE_OPTION_KIND,
  EXT_URL_PE_QUESTION_KEY,
  EXT_URL_PE_SECTION_KEY,
  PE_OPTION_KIND_CAMERA,
} from '../../../../modules/ayu-library/utils/constants';
import {
  matchesDemographics,
  normalizePatientGenderCode,
  normalizeType,
  parsePatientAgeYears,
  questionnaireMatchesDemographics,
  resolveLabel,
  transformFhirPhysExamToAyu,
  transformFhirToAyu,
} from '../../../../modules/ayu-library/utils/fhir-to-ayu.util';

describe('fhir-to-ayu.util', () => {
  describe('normalizeType', () => {
    describe('Valid Types', () => {
      it('should accept group type', () => {
        expect(normalizeType('group')).toBe('group');
      });

      it('should accept display type', () => {
        expect(normalizeType('display')).toBe('display');
      });

      it('should accept string type', () => {
        expect(normalizeType('string')).toBe('string');
      });

      it('should accept integer type', () => {
        expect(normalizeType('integer')).toBe('integer');
      });

      it('should accept decimal type', () => {
        expect(normalizeType('decimal')).toBe('decimal');
      });

      it('should accept date type', () => {
        expect(normalizeType('date')).toBe('date');
      });

      it('should accept choice type', () => {
        expect(normalizeType('choice')).toBe('choice');
      });

      it('should accept quantity type', () => {
        expect(normalizeType('quantity')).toBe('quantity');
      });

      it('should return correct type for all valid types', () => {
        const validTypes = ['group', 'display', 'string', 'integer', 'decimal', 'date', 'choice', 'quantity'];
        validTypes.forEach(type => {
          expect(normalizeType(type)).toBe(type);
        });
      });
    });

    describe('Invalid Types', () => {
      it('should throw error for unsupported type', () => {
        expect(() => normalizeType('unsupported')).toThrow('Unsupported FHIR item type: unsupported');
      });

      it('should throw error for boolean type', () => {
        expect(() => normalizeType('boolean')).toThrow('Unsupported FHIR item type: boolean');
      });

      it('should throw error for text type', () => {
        expect(() => normalizeType('text')).toThrow('Unsupported FHIR item type: text');
      });

      it('should throw error for url type', () => {
        expect(() => normalizeType('url')).toThrow('Unsupported FHIR item type: url');
      });

      it('should throw error for empty string', () => {
        expect(() => normalizeType('')).toThrow('Unsupported FHIR item type: ');
      });

      it('should throw error for numeric string', () => {
        expect(() => normalizeType('123')).toThrow('Unsupported FHIR item type: 123');
      });

      it('should be case-sensitive', () => {
        expect(() => normalizeType('STRING')).toThrow('Unsupported FHIR item type: STRING');
        expect(() => normalizeType('Group')).toThrow('Unsupported FHIR item type: Group');
      });
    });

    describe('Edge Cases', () => {
      it('should handle whitespace in type name', () => {
        expect(() => normalizeType(' string ')).toThrow('Unsupported FHIR item type:  string ');
      });

      it('should handle special characters', () => {
        expect(() => normalizeType('string!')).toThrow('Unsupported FHIR item type: string!');
      });
    });
  });

  describe('transformFhirToAyu', () => {
    describe('Basic Transformation', () => {
      it('should transform single root item (wrapped in root group)', () => {
        const questionnaire = {
          resourceType: 'Questionnaire',
          item: [
            {
              linkId: 'q1',
              text: 'Question 1',
              type: 'string',
            },
          ],
        };

        const result = transformFhirToAyu(questionnaire as unknown as FhirQuestionnaire);

        expect(result).not.toBeNull();

        expect(result?.linkId).toBe('root');
        expect(result?.type).toBe('group');
        expect(result?.item).toHaveLength(1);
        expect(result?.item?.[0].linkId).toBe('q1');
        expect(result?.item?.[0].text).toBe('Question 1');
        expect(result?.item?.[0].type).toBe('string');
      });

      it('should transform with all properties', () => {
        const questionnaire = {
          resourceType: 'Questionnaire',
          item: [
            {
              linkId: 'q1',
              text: 'Question 1',
              type: 'string',
              required: true,
              readOnly: false,
              repeats: false,
            },
          ],
        };

        const result = transformFhirToAyu(questionnaire as unknown as FhirQuestionnaire);

        expect(result).not.toBeNull();
        const child = result?.item?.[0];
        expect(child?.required).toBe(true);
        expect(child?.readOnly).toBe(false);
        expect(child?.repeats).toBe(false);
      });

      it('should preserve answerOption', () => {
        const questionnaire = {
          resourceType: 'Questionnaire',
          item: [
            {
              linkId: 'q1',
              text: 'Select one',
              type: 'choice',
              answerOption: [
                { valueString: 'Option 1' },
                { valueString: 'Option 2' },
              ],
            },
          ],
        };

        const result = transformFhirToAyu(questionnaire as unknown as FhirQuestionnaire);

        const child = result?.item?.[0];
        expect(child?.answerOption).toHaveLength(2);
        expect(child?.answerOption?.[0].valueString).toBe('Option 1');
      });

      it('should preserve extension data', () => {
        const questionnaire = {
          resourceType: 'Questionnaire',
          item: [
            {
              linkId: 'q1',
              text: 'Question',
              type: 'string',
              extension: [{ url: 'test', valueString: 'test-value' }],
            },
          ],
        };

        const result = transformFhirToAyu(questionnaire as unknown as FhirQuestionnaire);

        const child = result?.item?.[0];
        expect(child?.extension).toHaveLength(1);
        expect(child?.extension?.[0].url).toBe('test');
      });
    });

    describe('Multiple Root Items', () => {
      it('should wrap multiple root items in a group', () => {
        const questionnaire = {
          resourceType: 'Questionnaire',
          item: [
            { linkId: 'q1', text: 'Question 1', type: 'string' },
            { linkId: 'q2', text: 'Question 2', type: 'integer' },
          ],
        };

        const result = transformFhirToAyu(questionnaire as unknown as FhirQuestionnaire);

        expect(result).not.toBeNull();
        expect(result?.linkId).toBe('root');
        expect(result?.type).toBe('group');
        expect(result?.item).toHaveLength(2);
      });

      it('should set title as group text', () => {
        const questionnaire = {
          resourceType: 'Questionnaire',
          title: 'My Questionnaire Title',
          item: [
            { linkId: 'q1', text: 'Q1', type: 'string' },
            { linkId: 'q2', text: 'Q2', type: 'string' },
          ],
        };

        const result = transformFhirToAyu(questionnaire as unknown as FhirQuestionnaire);

        expect(result?.text).toBe('My Questionnaire Title');
      });

      it('should set undefined group text when title is not provided', () => {
        const questionnaire = {
          resourceType: 'Questionnaire',
          item: [
            { linkId: 'q1', text: 'Q1', type: 'string' },
            { linkId: 'q2', text: 'Q2', type: 'string' },
          ],
        };

        const result = transformFhirToAyu(questionnaire as unknown as FhirQuestionnaire);

        expect(result?.text).toBeUndefined();
      });

      it('should transform all items in multiple root scenario', () => {
        const questionnaire = {
          resourceType: 'Questionnaire',
          item: [
            { linkId: 'q1', text: 'Q1', type: 'string' },
            { linkId: 'q2', text: 'Q2', type: 'integer' },
            { linkId: 'q3', text: 'Q3', type: 'date' },
          ],
        };

        const result = transformFhirToAyu(questionnaire as unknown as FhirQuestionnaire);

        expect(result?.item).toHaveLength(3);
        expect(result?.item?.[0].linkId).toBe('q1');
        expect(result?.item?.[1].linkId).toBe('q2');
        expect(result?.item?.[2].linkId).toBe('q3');
      });
    });

    describe('Nested Items', () => {
      it('should transform nested group items', () => {
        const questionnaire = {
          resourceType: 'Questionnaire',
          item: [
            {
              linkId: 'group1',
              text: 'Group 1',
              type: 'group',
              item: [
                { linkId: 'q1', text: 'Question 1', type: 'string' },
                { linkId: 'q2', text: 'Question 2', type: 'integer' },
              ],
            },
          ],
        };

        const result = transformFhirToAyu(questionnaire as unknown as FhirQuestionnaire);

        expect(result?.type).toBe('group');
        expect(result?.linkId).toBe('root');

        const innerGroup = result?.item?.[0];
        expect(innerGroup?.type).toBe('group');
        expect(innerGroup?.item).toHaveLength(2);
        expect(innerGroup?.item?.[0].linkId).toBe('q1');
        expect(innerGroup?.item?.[1].linkId).toBe('q2');
      });

      it('should handle deeply nested structures', () => {
        const questionnaire = {
          resourceType: 'Questionnaire',
          item: [
            {
              linkId: 'group1',
              type: 'group',
              text: 'Level 1',
              item: [
                {
                  linkId: 'group2',
                  type: 'group',
                  text: 'Level 2',
                  item: [
                    { linkId: 'q1', text: 'Deep Question', type: 'string' },
                  ],
                },
              ],
            },
          ],
        };

        const result = transformFhirToAyu(questionnaire as unknown as FhirQuestionnaire);

        expect(result?.item?.[0].item?.[0].item?.[0].linkId).toBe('q1');
      });

      it('should transform all nested items recursively', () => {
        const questionnaire = {
          resourceType: 'Questionnaire',
          item: [
            {
              linkId: 'root-item',
              type: 'group',
              item: [
                { linkId: 'q1', type: 'string' },
                {
                  linkId: 'nested',
                  type: 'group',
                  item: [{ linkId: 'q2', type: 'integer' }],
                },
              ],
            },
          ],
        };

        const result = transformFhirToAyu(questionnaire as unknown as FhirQuestionnaire);

        const innerGroup = result?.item?.[0];
        expect(innerGroup?.item).toHaveLength(2);
        expect(innerGroup?.item?.[1].item).toHaveLength(1);
      });
    });

    describe('EnableWhen Conditions', () => {
      it('should normalize enableWhen with = operator', () => {
        const questionnaire = {
          resourceType: 'Questionnaire',
          item: [
            {
              linkId: 'q1',
              type: 'string',
              enableWhen: [
                {
                  question: 'q0',
                  operator: '=',
                  answerString: 'yes',
                },
              ],
            },
          ],
        };

        const result = transformFhirToAyu(questionnaire as unknown as FhirQuestionnaire);

        const child = result?.item?.[0];
        expect(child?.enableWhen).toHaveLength(1);
        expect(child?.enableWhen?.[0].operator).toBe('=');
        expect(child?.enableWhen?.[0].answerString).toBe('yes');
      });

      it('should normalize enableWhen with != operator', () => {
        const questionnaire = {
          resourceType: 'Questionnaire',
          item: [
            {
              linkId: 'q1',
              type: 'string',
              enableWhen: [
                {
                  question: 'q0',
                  operator: '!=',
                  answerString: 'no',
                },
              ],
            },
          ],
        };

        const result = transformFhirToAyu(questionnaire as unknown as FhirQuestionnaire);

        expect(result?.item?.[0]?.enableWhen?.[0].operator).toBe('!=');
      });

      it('should normalize enableWhen with exists operator', () => {
        const questionnaire = {
          resourceType: 'Questionnaire',
          item: [
            {
              linkId: 'q1',
              type: 'string',
              enableWhen: [
                {
                  question: 'q0',
                  operator: 'exists',
                  answerBoolean: true,
                },
              ],
            },
          ],
        };

        const result = transformFhirToAyu(questionnaire as unknown as FhirQuestionnaire);

        const child = result?.item?.[0];
        expect(child?.enableWhen?.[0].operator).toBe('exists');
        expect(child?.enableWhen?.[0].answerBoolean).toBe(true);
      });

      it('should throw error for unsupported operator', () => {
        const questionnaire = {
          resourceType: 'Questionnaire',
          item: [
            {
              linkId: 'q1',
              type: 'string',
              enableWhen: [
                {
                  question: 'q0',
                  operator: '>' as any,
                  answerString: 'test',
                },
              ],
            },
          ],
        };

        expect(() => transformFhirToAyu(questionnaire as unknown as FhirQuestionnaire)).toThrow(
          'Unsupported enableWhen operator: >'
        );
      });

      it('should handle multiple enableWhen conditions', () => {
        const questionnaire = {
          resourceType: 'Questionnaire',
          item: [
            {
              linkId: 'q1',
              type: 'string',
              enableWhen: [
                { question: 'q0', operator: '=', answerString: 'yes' },
                { question: 'q2', operator: '!=', answerString: 'no' },
              ],
            },
          ],
        };

        const result = transformFhirToAyu(questionnaire as unknown as FhirQuestionnaire);

        expect(result?.item?.[0]?.enableWhen).toHaveLength(2);
      });

      it('should handle undefined enableWhen', () => {
        const questionnaire = {
          resourceType: 'Questionnaire',
          item: [
            {
              linkId: 'q1',
              type: 'string',
            },
          ],
        };

        const result = transformFhirToAyu(questionnaire as unknown as FhirQuestionnaire);

        expect(result?.item?.[0]?.enableWhen).toBeUndefined();
      });

      it('should preserve answerCoding in enableWhen', () => {
        const questionnaire = {
          resourceType: 'Questionnaire',
          item: [
            {
              linkId: 'q1',
              type: 'string',
              enableWhen: [
                {
                  question: 'q0',
                  operator: '=',
                  answerCoding: { system: 'test', code: 'code1', display: 'Display' },
                },
              ],
            },
          ],
        };

        const result = transformFhirToAyu(questionnaire as unknown as FhirQuestionnaire);

        expect(result?.item?.[0]?.enableWhen?.[0].answerCoding).toEqual({
          system: 'test',
          code: 'code1',
          display: 'Display',
        });
      });
    });

    describe('Empty and Null Cases', () => {
      it('should return null for empty item array', () => {
        const questionnaire = {
          resourceType: 'Questionnaire',
          item: [],
        };

        const result = transformFhirToAyu(questionnaire as unknown as FhirQuestionnaire);

        expect(result).toBeNull();
      });

      it('should return null for undefined items', () => {
        const questionnaire = {
          resourceType: 'Questionnaire',
        };

        const result = transformFhirToAyu(questionnaire as unknown as FhirQuestionnaire);

        expect(result).toBeNull();
      });

      it('should handle empty nested items', () => {
        const questionnaire = {
          resourceType: 'Questionnaire',
          item: [
            {
              linkId: 'group1',
              type: 'group',
              item: [],
            },
          ],
        };

        const result = transformFhirToAyu(questionnaire as unknown as FhirQuestionnaire);

        expect(result?.item?.[0]?.item).toEqual([]);
      });
    });

    describe('Special Properties', () => {
      it('should preserve _text property', () => {
        const questionnaire = {
          resourceType: 'Questionnaire',
          item: [
            {
              linkId: 'q1',
              type: 'string',
              _text: { extension: [{ url: 'test', valueString: 'value' }] },
            },
          ],
        };

        const result = transformFhirToAyu(questionnaire as unknown as FhirQuestionnaire);

        const child = result?.item?.[0];
        expect(child?._text).toBeDefined();
        expect(child?._text?.extension).toHaveLength(1);
      });

      it('should handle all question types', () => {
        const types = ['group', 'display', 'string', 'integer', 'decimal', 'date', 'choice', 'quantity'];

        types.forEach((type, index) => {
          const questionnaire = {
            resourceType: 'Questionnaire',
            item: [{ linkId: `q${index}`, type: type }],
          };

          const result = transformFhirToAyu(questionnaire as unknown as FhirQuestionnaire);

          expect(result?.item?.[0]?.type).toBe(type);
        });
      });
    });

    describe('Error Handling', () => {
      it('should throw error for invalid type in single root', () => {
        const questionnaire = {
          resourceType: 'Questionnaire',
          item: [{ linkId: 'q1', type: 'invalid' as any }],
        };

        expect(() => transformFhirToAyu(questionnaire as unknown as FhirQuestionnaire)).toThrow(
          'Unsupported FHIR item type: invalid'
        );
      });

      it('should throw error for invalid type in multiple roots', () => {
        const questionnaire = {
          resourceType: 'Questionnaire',
          item: [
            { linkId: 'q1', type: 'string' },
            { linkId: 'q2', type: 'invalid' as any },
          ],
        };

        expect(() => transformFhirToAyu(questionnaire as unknown as FhirQuestionnaire)).toThrow(
          'Unsupported FHIR item type: invalid'
        );
      });

      it('should throw error for invalid type in nested items', () => {
        const questionnaire = {
          resourceType: 'Questionnaire',
          item: [
            {
              linkId: 'group',
              type: 'group',
              item: [{ linkId: 'q1', type: 'invalid' as any }],
            },
          ],
        };

        expect(() => transformFhirToAyu(questionnaire as unknown as FhirQuestionnaire)).toThrow(
          'Unsupported FHIR item type: invalid'
        );
      });
    });
  });

  describe('resolveLabel', () => {
    describe('Direct Question Text', () => {
      it('should return question text when available', () => {
        const question: AyuQuestion = {
          linkId: 'q1',
          text: 'Question Text',
          type: 'string',
        };

        const label = resolveLabel(question);

        expect(label).toBe('Question Text');
      });

      it('should prioritize question text over other sources', () => {
        const question: AyuQuestion = {
          linkId: 'q1',
          text: 'Question Text',
          type: 'string',
        };
        const parent: AyuQuestion = {
          linkId: 'parent',
          text: 'Parent Text',
          type: 'group',
        };
        const previousSibling: AyuQuestion = {
          linkId: 'prev',
          text: 'Previous Text',
          type: 'display',
        };

        const label = resolveLabel(question, parent, previousSibling);

        expect(label).toBe('Question Text');
      });

      it('should handle empty string text', () => {
        const question: AyuQuestion = {
          linkId: 'q1',
          text: '',
          type: 'string',
        };

        const label = resolveLabel(question);

        expect(label).toBe('');
      });

      it('falls back to question.text when extension list has no display-text entry', () => {
        const question: AyuQuestion = {
          linkId: 'q1',
          text: 'Fallback Text',
          type: 'string',
          extension: [
            { url: 'https://example.com/other-extension', valueString: 'ignored' },
          ],
        };

        expect(resolveLabel(question)).toBe('Fallback Text');
      });

      it('prefers the display-text extension over question.text when both are present', () => {

        const question: AyuQuestion = {
          linkId: 'q1',
          text: 'Raw Text',
          type: 'string',
          extension: [
            {
              url: 'https://intelehealth.org/fhir/StructureDefinition/display',
              valueString: 'Display Override',
            },
          ],
        };

        expect(resolveLabel(question)).toBe('Display Override');
      });

      it('returns the display-text extension valueString when question.text is absent', () => {
        const question: AyuQuestion = {
          linkId: 'q1',
          type: 'string',
          extension: [
            {
              url: 'https://intelehealth.org/fhir/StructureDefinition/display',
              valueString: 'Display Override',
            },
          ],
        };

        expect(resolveLabel(question)).toBe('Display Override');
      });

      it('falls back to question.text when display-text extension has no valueString', () => {
        const question: AyuQuestion = {
          linkId: 'q1',
          text: 'Fallback Text',
          type: 'string',
          extension: [
            {
              url: 'https://intelehealth.org/fhir/StructureDefinition/display',
            },
          ],
        };

        expect(resolveLabel(question)).toBe('Fallback Text');
      });
    });

    describe('Previous Display Sibling', () => {
      it('should return question text when previous display sibling has extension', () => {
        const question: AyuQuestion = {
          linkId: 'q1',
          text: 'Question Text',
          type: 'string',
        };
        const previousSibling: AyuQuestion = {
          linkId: 'prev',
          text: 'Display Text',
          type: 'display',
          extension: [{ url: 'some-ext', valueString: 'ext-val' }],
        };

        const label = resolveLabel(question, undefined, previousSibling);

        expect(label).toBe('Question Text');
      });

      it('should not use previous sibling if not display type', () => {
        const question: AyuQuestion = {
          linkId: 'q1',
          type: 'string',
        };
        const previousSibling: AyuQuestion = {
          linkId: 'prev',
          text: 'String Text',
          type: 'string',
        };

        const label = resolveLabel(question, undefined, previousSibling);

        expect(label).toBeUndefined();
      });

      it('should not use previous sibling if it has no extension', () => {
        const question: AyuQuestion = {
          linkId: 'q1',
          type: 'string',
        };
        const previousSibling: AyuQuestion = {
          linkId: 'prev',
          text: 'Display Text',
          type: 'display',
        };

        const label = resolveLabel(question, undefined, previousSibling);

        expect(label).toBeUndefined();
      });

      it('should prioritize previous display over parent when both have extensions', () => {
        const question: AyuQuestion = {
          linkId: 'q1',
          text: 'Question Text',
          type: 'string',
        };
        const parent: AyuQuestion = {
          linkId: 'parent',
          text: 'Parent Text',
          type: 'group',
          extension: [{ url: 'ext', valueString: 'val' }],
        };
        const previousSibling: AyuQuestion = {
          linkId: 'prev',
          text: 'Display Text',
          type: 'display',
          extension: [{ url: 'ext', valueString: 'val' }],
        };

        const label = resolveLabel(question, parent, previousSibling);

        expect(label).toBe('Question Text');
      });
    });

    describe('Parent Group Text', () => {
      it('should return question text via getLabel when parent group has extension', () => {
        const question: AyuQuestion = {
          linkId: 'q1',
          text: 'My Question',
          type: 'string',
        };
        const parent: AyuQuestion = {
          linkId: 'parent',
          text: 'Parent Group',
          type: 'group',
          extension: [{ url: 'ext', valueString: 'val' }],
        };

        const label = resolveLabel(question, parent);

        expect(label).toBe('My Question');
      });

      it('should not use parent if not group type', () => {
        const question: AyuQuestion = {
          linkId: 'q1',
          type: 'string',
        };
        const parent: AyuQuestion = {
          linkId: 'parent',
          text: 'Parent Text',
          type: 'string',
        };

        const label = resolveLabel(question, parent);

        expect(label).toBeUndefined();
      });

      it('should not use parent if it has no extension', () => {
        const question: AyuQuestion = {
          linkId: 'q1',
          type: 'string',
        };
        const parent: AyuQuestion = {
          linkId: 'parent',
          text: 'Parent Group',
          type: 'group',
        };

        const label = resolveLabel(question, parent);

        expect(label).toBeUndefined();
      });
    });

    describe('No Label Available', () => {
      it('should return undefined when no label sources available', () => {
        const question: AyuQuestion = {
          linkId: 'q1',
          type: 'string',
        };

        const label = resolveLabel(question);

        expect(label).toBeUndefined();
      });

      it('should return undefined with undefined parent and sibling', () => {
        const question: AyuQuestion = {
          linkId: 'q1',
          type: 'string',
        };

        const label = resolveLabel(question, undefined, undefined);

        expect(label).toBeUndefined();
      });

      it('should return undefined with non-matching parent and sibling types', () => {
        const question: AyuQuestion = {
          linkId: 'q1',
          type: 'string',
        };
        const parent: AyuQuestion = {
          linkId: 'parent',
          text: 'Parent',
          type: 'string',
        };
        const previousSibling: AyuQuestion = {
          linkId: 'prev',
          text: 'Previous',
          type: 'string',
        };

        const label = resolveLabel(question, parent, previousSibling);

        expect(label).toBeUndefined();
      });
    });

    describe('Edge Cases', () => {
      it('should handle question with only linkId', () => {
        const question: AyuQuestion = {
          linkId: 'q1',
          type: 'string',
        };

        const label = resolveLabel(question);

        expect(label).toBeUndefined();
      });

      it('should handle complex nested scenario with parent extension', () => {
        const question: AyuQuestion = {
          linkId: 'q1',
          text: 'Integer Q',
          type: 'integer',
        };
        const parent: AyuQuestion = {
          linkId: 'group',
          text: 'Section Title',
          type: 'group',
          item: [],
          extension: [{ url: 'ext', valueString: 'val' }],
        };

        const label = resolveLabel(question, parent);

        expect(label).toBe('Integer Q');
      });

      it('should handle display sibling with empty text but no extension', () => {
        const question: AyuQuestion = {
          linkId: 'q1',
          type: 'string',
        };
        const previousSibling: AyuQuestion = {
          linkId: 'prev',
          text: '',
          type: 'display',
        };

        const label = resolveLabel(question, undefined, previousSibling);

        expect(label).toBeUndefined();
      });

      it('should handle all question types', () => {
        const types: Array<AyuQuestion['type']> = [
          'string',
          'integer',
          'decimal',
          'date',
          'choice',
          'display',
          'group',
          'quantity',
        ];

        types.forEach(type => {
          const question: AyuQuestion = {
            linkId: 'q1',
            text: `${type} question`,
            type,
          };

          const label = resolveLabel(question);
          expect(label).toBe(`${type} question`);
        });
      });
    });

    describe('Label Resolution Priority', () => {
      it('should follow correct priority order', () => {

        const q1: AyuQuestion = { linkId: 'q1', text: 'Q Text', type: 'string', extension: [{ url: 'ext', valueString: 'val' }] };
        const parent: AyuQuestion = { linkId: 'p', text: 'P Text', type: 'group', extension: [{ url: 'ext', valueString: 'val' }] };
        const sibling: AyuQuestion = { linkId: 's', text: 'S Text', type: 'display', extension: [{ url: 'ext', valueString: 'val' }] };

        expect(resolveLabel(q1, parent, sibling)).toBe('Q Text');

        const q2: AyuQuestion = { linkId: 'q2', text: 'Q2 Text', type: 'string' };
        expect(resolveLabel(q2, parent, sibling)).toBe('Q2 Text');

        const q3: AyuQuestion = { linkId: 'q3', text: 'Q3 Text', type: 'string' };
        expect(resolveLabel(q3, parent, undefined)).toBe('Q3 Text');

        const q4: AyuQuestion = { linkId: 'q4', type: 'string' };
        expect(resolveLabel(q4)).toBeUndefined();
      });
    });
  });

  describe('parsePatientAgeYears', () => {
    it('returns null for nullish / empty', () => {
      expect(parsePatientAgeYears(null)).toBeNull();
      expect(parsePatientAgeYears(undefined)).toBeNull();
      expect(parsePatientAgeYears('')).toBeNull();
    });

    it('parses numeric strings', () => {
      expect(parsePatientAgeYears('34')).toBe(34);
      expect(parsePatientAgeYears('0')).toBe(0);
    });

    it('parses "N years" style strings', () => {
      expect(parsePatientAgeYears('30 years')).toBe(30);
      expect(parsePatientAgeYears('5 yr')).toBe(5);
    });

    it('computes age from ISO date of birth', () => {
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - 25);
      const iso = dob.toISOString().slice(0, 10);
      expect(parsePatientAgeYears(iso)).toBe(25);
    });

    it('returns null for nonsense strings', () => {
      expect(parsePatientAgeYears('not-an-age')).toBeNull();
    });

    it('returns finite numbers as-is and null for non-finite numbers', () => {
      expect(parsePatientAgeYears(42)).toBe(42);
      expect(parsePatientAgeYears(NaN)).toBeNull();
      expect(parsePatientAgeYears(Infinity)).toBeNull();
    });

    it('returns null when the date-of-birth is in the future', () => {
      const future = new Date();
      future.setFullYear(future.getFullYear() + 5);
      const iso = future.toISOString().slice(0, 10);
      expect(parsePatientAgeYears(iso)).toBeNull();
    });

    it('decrements age when the birthday has not yet occurred this year', () => {
      const now = new Date();
      const dob = new Date(now);
      dob.setFullYear(now.getFullYear() - 25);
      dob.setMonth(now.getMonth() + 1);
      if (dob.getFullYear() !== now.getFullYear() - 25) {
        dob.setFullYear(now.getFullYear() - 25);
        dob.setMonth(now.getMonth() - 1);
        expect(parsePatientAgeYears(dob.toISOString().slice(0, 10))).toBe(25);
        return;
      }
      expect(parsePatientAgeYears(dob.toISOString().slice(0, 10))).toBe(24);
    });

    it('decrements age when same month but birthday is later this month', () => {
      const now = new Date();
      if (now.getDate() === 31) {
        expect(true).toBe(true);
        return;
      }
      const dob = new Date(now);
      dob.setFullYear(now.getFullYear() - 30);
      dob.setDate(now.getDate() + 1);
      expect(parsePatientAgeYears(dob.toISOString().slice(0, 10))).toBe(29);
    });

    it('returns null for whitespace-only strings', () => {
      expect(parsePatientAgeYears('   ')).toBeNull();
    });
  });

  describe('normalizePatientGenderCode', () => {
    it('maps female aliases to "0"', () => {
      expect(normalizePatientGenderCode('F')).toBe('0');
      expect(normalizePatientGenderCode('female')).toBe('0');
      expect(normalizePatientGenderCode('Female')).toBe('0');
      expect(normalizePatientGenderCode('0')).toBe('0');
    });

    it('maps male aliases to "1"', () => {
      expect(normalizePatientGenderCode('M')).toBe('1');
      expect(normalizePatientGenderCode('male')).toBe('1');
      expect(normalizePatientGenderCode('1')).toBe('1');
    });

    it('maps other aliases to "other"', () => {
      expect(normalizePatientGenderCode('O')).toBe('other');
      expect(normalizePatientGenderCode('Other')).toBe('other');
    });

    it('returns null when unknown', () => {
      expect(normalizePatientGenderCode('xyz')).toBeNull();
      expect(normalizePatientGenderCode(null)).toBeNull();
      expect(normalizePatientGenderCode(undefined)).toBeNull();
    });

    it('returns null for whitespace-only strings', () => {
      expect(normalizePatientGenderCode('   ')).toBeNull();
    });
  });

  describe('matchesDemographics', () => {
    it('keeps items with no extensions', () => {
      expect(matchesDemographics(undefined, { age: 30, gender: 'F' })).toBe(
        true
      );
      expect(matchesDemographics([], { age: 30, gender: 'F' })).toBe(true);
    });

    it('keeps items when demographics are missing', () => {
      expect(
        matchesDemographics([{ url: EXT_GENDER, valueString: '1' }], undefined)
      ).toBe(true);
    });

    it('filters by gender (female-only item vs male patient)', () => {
      const ext = [{ url: EXT_GENDER, valueString: '0' }];
      expect(matchesDemographics(ext, { gender: 'M' })).toBe(false);
      expect(matchesDemographics(ext, { gender: 'F' })).toBe(true);
    });

    it('enforces inclusive age-min/age-max range', () => {
      const ext = [
        { url: EXT_AGE_MIN, valueString: '14' },
        { url: EXT_AGE_MAX, valueString: '49' },
      ];
      expect(matchesDemographics(ext, { age: 13 })).toBe(false);
      expect(matchesDemographics(ext, { age: 14 })).toBe(true);
      expect(matchesDemographics(ext, { age: 49 })).toBe(true);
      expect(matchesDemographics(ext, { age: 50 })).toBe(false);
    });

    it('combines gender and age constraints (pregnancy-style question)', () => {
      const ext = [
        { url: EXT_GENDER, valueString: '0' },
        { url: EXT_AGE_MIN, valueString: '14' },
        { url: EXT_AGE_MAX, valueString: '49' },
      ];
      expect(matchesDemographics(ext, { age: 30, gender: 'F' })).toBe(true);
      expect(matchesDemographics(ext, { age: 30, gender: 'M' })).toBe(false);
      expect(matchesDemographics(ext, { age: 12, gender: 'F' })).toBe(false);
    });

    it('fails open for gender when patient gender is unknown', () => {
      const ext = [{ url: EXT_GENDER, valueString: '0' }];
      expect(matchesDemographics(ext, { gender: null })).toBe(true);
    });

    it('treats missing age-min as negative infinity (only age-max enforced)', () => {

      const ext = [{ url: EXT_AGE_MAX, valueString: '10' }];
      expect(matchesDemographics(ext, { age: 0 })).toBe(true);
      expect(matchesDemographics(ext, { age: 10 })).toBe(true);
      expect(matchesDemographics(ext, { age: 11 })).toBe(false);
    });

    it('treats missing age-max as positive infinity (only age-min enforced)', () => {

      const ext = [{ url: EXT_AGE_MIN, valueString: '18' }];
      expect(matchesDemographics(ext, { age: 17 })).toBe(false);
      expect(matchesDemographics(ext, { age: 18 })).toBe(true);
      expect(matchesDemographics(ext, { age: 999 })).toBe(true);
    });
  });

  describe('questionnaireMatchesDemographics', () => {
    it('returns true for nullish questionnaires (nothing to check against)', () => {
      expect(questionnaireMatchesDemographics(null)).toBe(true);
      expect(questionnaireMatchesDemographics(undefined)).toBe(true);
    });

    it('honours the questionnaire top-level extensions', () => {
      const q: FhirQuestionnaire = {
        resourceType: 'Questionnaire',
        extension: [{ url: EXT_GENDER, valueString: '0' }],
        item: [],
      };
      expect(questionnaireMatchesDemographics(q, { gender: 'F' })).toBe(true);
      expect(questionnaireMatchesDemographics(q, { gender: 'M' })).toBe(false);
    });
  });

  describe('transformFhirToAyu with demographics', () => {
    const buildQuestionnaire = (): FhirQuestionnaire => ({
      resourceType: 'Questionnaire',
      item: [
        {
          linkId: 'general',
          type: 'string',
          text: 'General question',
        },
        {
          linkId: 'pregnancy',
          type: 'choice',
          text: 'Pregnancy-only question',
          extension: [
            { url: EXT_GENDER, valueString: '0' },
            { url: EXT_AGE_MIN, valueString: '14' },
            { url: EXT_AGE_MAX, valueString: '49' },
          ],
        },
        {
          linkId: 'prostate',
          type: 'choice',
          text: 'Male-only question',
          extension: [{ url: EXT_GENDER, valueString: '1' }],
        },
      ],
    });

    it('drops questions that do not match the patient', () => {
      const schema = transformFhirToAyu(buildQuestionnaire(), {
        age: 30,
        gender: 'M',
      });
      const linkIds = schema?.item?.map(q => q.linkId);
      expect(linkIds).toEqual(['general', 'prostate']);
    });

    it('keeps all questions when demographics are not provided', () => {
      const schema = transformFhirToAyu(buildQuestionnaire());
      expect(schema?.item?.map(q => q.linkId)).toEqual([
        'general',
        'pregnancy',
        'prostate',
      ]);
    });

    it('filters individual answerOption entries by demographics', () => {
      const questionnaire: FhirQuestionnaire = {
        resourceType: 'Questionnaire',
        item: [
          {
            linkId: 'assoc',
            type: 'choice',
            repeats: true,
            answerOption: [
              { valueCoding: { code: 'fever', display: 'Fever' } },
              {
                valueCoding: { code: 'preg', display: 'Pregnancy symptoms' },
                extension: [
                  { url: EXT_GENDER, valueString: '0' },
                  { url: EXT_AGE_MIN, valueString: '14' },
                  { url: EXT_AGE_MAX, valueString: '49' },
                ],
              },
              {
                valueCoding: { code: 'prostate', display: 'Prostate issues' },
                extension: [{ url: EXT_GENDER, valueString: '1' }],
              },
            ],
          },
        ],
      };

      const male30 = transformFhirToAyu(questionnaire, {
        age: 30,
        gender: 'M',
      });
      expect(
        male30?.item?.[0].answerOption?.map(o => o.valueCoding?.code)
      ).toEqual(['fever', 'prostate']);

      const female30 = transformFhirToAyu(questionnaire, {
        age: 30,
        gender: 'F',
      });
      expect(
        female30?.item?.[0].answerOption?.map(o => o.valueCoding?.code)
      ).toEqual(['fever', 'preg']);

      const female10 = transformFhirToAyu(questionnaire, {
        age: 10,
        gender: 'F',
      });
      expect(
        female10?.item?.[0].answerOption?.map(o => o.valueCoding?.code)
      ).toEqual(['fever']);
    });

    it('hides an option when its only enabled child is demographically excluded', () => {
      const questionnaire: FhirQuestionnaire = {
        resourceType: 'Questionnaire',
        item: [
          {
            linkId: 'assoc',
            type: 'choice',
            repeats: true,
            answerOption: [
              { valueCoding: { code: 'fever', display: 'Fever' } },
              {
                valueCoding: {
                  code: 'vag',
                  display: 'Vaginal discharge [describe]',
                },
              },
            ],
            item: [
              {
                linkId: 'vag-describe',
                type: 'string',
                text: 'Vaginal discharge [describe]',
                enableWhen: [
                  {
                    question: 'assoc',
                    operator: '=',
                    answerCoding: { code: 'vag' },
                  },
                ],
                extension: [
                  { url: EXT_GENDER, valueString: '0' },
                  { url: EXT_AGE_MIN, valueString: '8' },
                  { url: EXT_AGE_MAX, valueString: '120' },
                ],
              },
            ],
          },
        ],
      };

      const male = transformFhirToAyu(questionnaire, {
        age: 30,
        gender: 'M',
      });
      expect(
        male?.item?.[0].answerOption?.map(o => o.valueCoding?.code)
      ).toEqual(['fever']);

      const female = transformFhirToAyu(questionnaire, {
        age: 30,
        gender: 'F',
      });
      expect(
        female?.item?.[0].answerOption?.map(o => o.valueCoding?.code)
      ).toEqual(['fever', 'vag']);
    });

    it('keeps an option when at least one of its enabled children passes demographics', () => {
      const questionnaire: FhirQuestionnaire = {
        resourceType: 'Questionnaire',
        item: [
          {
            linkId: 'assoc',
            type: 'choice',
            repeats: true,
            answerOption: [
              { valueCoding: { code: 'pain', display: 'Pain' } },
            ],
            item: [
              {
                linkId: 'pain-female-detail',
                type: 'string',
                text: 'Female-only follow-up',
                enableWhen: [
                  {
                    question: 'assoc',
                    operator: '=',
                    answerCoding: { code: 'pain' },
                  },
                ],
                extension: [{ url: EXT_GENDER, valueString: '0' }],
              },
              {
                linkId: 'pain-general',
                type: 'string',
                text: 'General follow-up',
                enableWhen: [
                  {
                    question: 'assoc',
                    operator: '=',
                    answerCoding: { code: 'pain' },
                  },
                ],
              },
            ],
          },
        ],
      };

      const male = transformFhirToAyu(questionnaire, { gender: 'M' });
      expect(
        male?.item?.[0].answerOption?.map(o => o.valueCoding?.code)
      ).toEqual(['pain']);
      // Only the gendered child got filtered out.
      expect(male?.item?.[0].item?.map(c => c.linkId)).toEqual([
        'pain-general',
      ]);
    });

    it('keeps an option with no enabled children even when other options have demographic gates', () => {
      const questionnaire: FhirQuestionnaire = {
        resourceType: 'Questionnaire',
        item: [
          {
            linkId: 'assoc',
            type: 'choice',
            repeats: true,
            answerOption: [
              { valueCoding: { code: 'fever', display: 'Fever' } },
            ],
            // No item children at all.
          },
        ],
      };

      const male = transformFhirToAyu(questionnaire, { gender: 'M' });
      expect(
        male?.item?.[0].answerOption?.map(o => o.valueCoding?.code)
      ).toEqual(['fever']);
    });

    it('keeps all answerOption entries when demographics are not provided', () => {
      const questionnaire: FhirQuestionnaire = {
        resourceType: 'Questionnaire',
        item: [
          {
            linkId: 'assoc',
            type: 'choice',
            answerOption: [
              { valueCoding: { code: 'fever', display: 'Fever' } },
              {
                valueCoding: { code: 'preg', display: 'Pregnancy symptoms' },
                extension: [{ url: EXT_GENDER, valueString: '0' }],
              },
            ],
          },
        ],
      };
      const schema = transformFhirToAyu(questionnaire);
      expect(
        schema?.item?.[0].answerOption?.map(o => o.valueCoding?.code)
      ).toEqual(['fever', 'preg']);
    });

    it('filters nested child items recursively', () => {
      const questionnaire: FhirQuestionnaire = {
        resourceType: 'Questionnaire',
        item: [
          {
            linkId: 'parent',
            type: 'group',
            item: [
              {
                linkId: 'female-child',
                type: 'string',
                extension: [{ url: EXT_GENDER, valueString: '0' }],
              },
              {
                linkId: 'any-child',
                type: 'string',
              },
            ],
          },
        ],
      };
      const schema = transformFhirToAyu(questionnaire, { gender: 'M' });
      const parent = schema?.item?.[0];
      expect(parent?.item?.map(q => q.linkId)).toEqual(['any-child']);
    });
  });
});

describe('transformFhirPhysExamToAyu', () => {
  const makeSection = (
    sectionText: string,
    conceptTags: string[],
    children: FhirItem[]
  ): FhirItem => ({
    linkId: `sec-${sectionText.toLowerCase()}`,
    text: sectionText,
    type: 'group',
    answerOption: conceptTags.map(tag => ({
      valueCoding: { code: tag.toLowerCase().replace(/\s+/g, '-'), display: tag },
    })),
    item: children,
  });

  const makeChoiceQuestion = (overrides: Partial<FhirItem> = {}): FhirItem => ({
    linkId: 'q-jaundice',
    text: 'Is there jaundice?*',
    type: 'choice',
    required: true,
    answerOption: [
      { valueCoding: { code: 'yes', display: 'Yes' } },
      { valueCoding: { code: 'no', display: 'No' } },
    ],
    ...overrides,
  });

  it('returns null for an empty questionnaire', () => {
    expect(transformFhirPhysExamToAyu({ resourceType: 'Questionnaire' })).toBeNull();
    expect(
      transformFhirPhysExamToAyu({ resourceType: 'Questionnaire', item: [] })
    ).toBeNull();
  });

  it('flattens sections into a single root group of choice questions', () => {
    const root = transformFhirPhysExamToAyu({
      resourceType: 'Questionnaire',
      title: 'Physical exam',
      item: [
        makeSection('Hands', ['Jaundice', 'Pallor'], [
          makeChoiceQuestion({ linkId: 'q1', text: 'Jaundice?' }),
          makeChoiceQuestion({ linkId: 'q2', text: 'Pallor?' }),
        ]),
        makeSection('Throat', ['Tonsils'], [
          makeChoiceQuestion({ linkId: 'q3', text: 'Tonsils swollen?' }),
        ]),
      ],
    });

    expect(root).not.toBeNull();
    expect(root?.linkId).toBe('root');
    expect(root?.type).toBe('group');
    expect(root?.text).toBe('Physical exam');
    expect(root?.item?.map(q => q.linkId)).toEqual(['q1', 'q2', 'q3']);
  });

  it('attaches PE section/category/question key extensions to each question', () => {
    const root = transformFhirPhysExamToAyu({
      resourceType: 'Questionnaire',
      item: [
        makeSection('Hands', ['Jaundice'], [
          makeChoiceQuestion({ linkId: 'q1' }),
        ]),
      ],
    });
    const q = root?.item?.[0];
    expect(q?.extension).toEqual(
      expect.arrayContaining([
        { url: EXT_URL_PE_SECTION_KEY, valueString: 'Hands' },
        { url: EXT_URL_PE_CATEGORY_LABEL, valueString: 'Jaundice' },
        { url: EXT_URL_PE_QUESTION_KEY, valueString: 'Jaundice' },
      ])
    );
  });

  it('title-cases multi-word section names', () => {
    const root = transformFhirPhysExamToAyu({
      resourceType: 'Questionnaire',
      item: [
        makeSection('general exams', ['Jaundice'], [makeChoiceQuestion()]),
      ],
    });
    const sectionExt = root?.item?.[0]?.extension?.find(
      e => e.url === EXT_URL_PE_SECTION_KEY
    );
    expect(sectionExt?.valueString).toBe('General Exams');
  });

  it('falls back to question text when concept tags run out', () => {
    const root = transformFhirPhysExamToAyu({
      resourceType: 'Questionnaire',
      item: [
        makeSection('Hands', ['Jaundice'], [
          makeChoiceQuestion({ linkId: 'q1', text: 'Jaundice?' }),
          makeChoiceQuestion({ linkId: 'q2', text: 'Pallor?' }),
        ]),
      ],
    });
    const q2 = root?.item?.find(q => q.linkId === 'q2');
    const categoryExt = q2?.extension?.find(
      e => e.url === EXT_URL_PE_CATEGORY_LABEL
    );
    expect(categoryExt?.valueString).toBe('Pallor?');
  });

  it('strips trailing asterisks from question text', () => {
    const root = transformFhirPhysExamToAyu({
      resourceType: 'Questionnaire',
      item: [
        makeSection('Hands', ['Jaundice'], [
          makeChoiceQuestion({ text: 'Jaundice?**' }),
        ]),
      ],
    });
    expect(root?.item?.[0]?.text).toBe('Jaundice?');
  });

  it('translates check-box itemControl to repeats=true', () => {
    const root = transformFhirPhysExamToAyu({
      resourceType: 'Questionnaire',
      item: [
        makeSection('Hands', ['Pallor'], [
          makeChoiceQuestion({
            extension: [
              {
                url: EXT_URL_ITEM_CONTROL,
                valueCodeableConcept: {
                  coding: [{ code: 'check-box' }],
                },
              },
            ],
          }),
        ]),
      ],
    });
    expect(root?.item?.[0]?.repeats).toBe(true);
  });

  it('leaves repeats unset for non-check-box questions', () => {
    const root = transformFhirPhysExamToAyu({
      resourceType: 'Questionnaire',
      item: [
        makeSection('Hands', ['Jaundice'], [makeChoiceQuestion()]),
      ],
    });
    expect(root?.item?.[0]?.repeats).toBe(false);
  });

  it('appends an attachment child as a camera-marked answerOption', () => {
    const root = transformFhirPhysExamToAyu({
      resourceType: 'Questionnaire',
      item: [
        makeSection('Hands', ['Jaundice'], [
          makeChoiceQuestion({
            item: [
              {
                linkId: 'attach-1',
                type: 'attachment',
                enableWhen: [
                  {
                    question: 'q-jaundice',
                    operator: '=',
                    answerCoding: { code: 'CAMERA' },
                  },
                ],
                extension: [
                  { url: EXT_URL_LANGUGAE_TEXT, valueString: 'Take a picture' },
                ],
              },
            ],
          }),
        ]),
      ],
    });
    const camera = root?.item?.[0]?.answerOption?.find(o =>
      o.extension?.some(e => e.url === EXT_URL_PE_OPTION_KIND)
    );
    // Camera answer code is the attachment's own linkId (unique), NOT the
    // enableWhen trigger code — so it can never collide with a Yes/No choice.
    expect(camera?.valueCoding?.code).toBe('attach-1');
    // The stored display is "Picture Taken" so the stepper's answered card
    // reads back the post-capture label. The tile renders a hardcoded
    // "Take a Picture" label and ignores this field.
    expect(camera?.valueCoding?.display).toBe('Picture Taken');
    expect(camera?.extension).toEqual(
      expect.arrayContaining([
        { url: EXT_URL_PE_OPTION_KIND, valueString: PE_OPTION_KIND_CAMERA },
      ])
    );
  });

  it('falls back to attachment linkId as camera code when enableWhen is missing', () => {
    const root = transformFhirPhysExamToAyu({
      resourceType: 'Questionnaire',
      item: [
        makeSection('Hands', ['Jaundice'], [
          makeChoiceQuestion({
            item: [
              { linkId: 'attach-fallback', type: 'attachment' },
            ],
          }),
        ]),
      ],
    });
    const camera = root?.item?.[0]?.answerOption?.find(
      o =>
        !!o.extension?.some(
          e => e.url === EXT_URL_PE_OPTION_KIND
        )
    );
    expect(camera?.valueCoding?.code).toBe('attach-fallback');
  });

  it('marks the camera option as exclusive when is-exclusive-option=true', () => {
    const root = transformFhirPhysExamToAyu({
      resourceType: 'Questionnaire',
      item: [
        makeSection('Hands', ['Jaundice'], [
          makeChoiceQuestion({
            item: [
              {
                linkId: 'attach-x',
                type: 'attachment',
                extension: [
                  { url: EXT_URL_IS_EXCLUSIVE_OPTION, valueString: 'true' },
                ],
              },
            ],
          }),
        ]),
      ],
    });
    const camera = root?.item?.[0]?.answerOption?.find(
      o =>
        !!o.extension?.some(
          e => e.url === EXT_URL_PE_OPTION_KIND
        )
    );
    expect(camera?.extension).toEqual(
      expect.arrayContaining([
        { url: EXT_URL_IS_EXCLUSIVE_OPTION, valueString: 'true' },
      ])
    );
  });

  it('drops "[picture taken]" marker answerOptions so the camera tile is not duplicated', () => {
    // Mirrors a question in physExam.json (e.g. linkId "1afo09f1e5ijjoum5sb3utlter")
    // that carries a sentinel answerOption with display="Take a picture" and
    // language extension "[picture taken]" alongside an attachment child.
    // Without the filter, the FHIR option renders as a regular tile next to
    // the real camera tile built from the attachment.
    const root = transformFhirPhysExamToAyu({
      resourceType: 'Questionnaire',
      item: [
        makeSection('Hands', ['Nails'], [
          {
            linkId: 'q-marker',
            text: 'Nails',
            type: 'choice',
            answerOption: [
              { valueCoding: { code: 'real-yes', display: 'Yes' } },
              {
                valueCoding: { code: 'marker', display: 'Take a picture' },
                extension: [
                  {
                    url: EXT_URL_LANGUGAE_TEXT,
                    valueString: '[picture taken]',
                  },
                ],
              },
            ],
            item: [
              {
                linkId: 'q-marker_attach',
                type: 'attachment',
                enableWhen: [
                  {
                    question: 'q-marker',
                    operator: '=',
                    answerCoding: { code: 'marker' },
                  },
                ],
              },
            ],
          },
        ]),
      ],
    });
    const codes = root?.item?.[0]?.answerOption?.map(
      o => o.valueCoding?.code
    );
    // marker option is dropped; real Yes survives; camera option built from
    // the attachment is appended, coded by the attachment's linkId.
    expect(codes).toEqual(['real-yes', 'q-marker_attach']);
    // The appended option is the camera-marked option (PE_OPTION_KIND
    // extension), NOT the original sentinel.
    const camera = root?.item?.[0]?.answerOption?.find(
      o => o.valueCoding?.code === 'q-marker_attach'
    );
    expect(camera?.extension).toEqual(
      expect.arrayContaining([
        { url: EXT_URL_PE_OPTION_KIND, valueString: PE_OPTION_KIND_CAMERA },
      ])
    );
  });

  it('drops "Take a picture" proxy option even without the language marker when an attachment child exists', () => {
    // Some FHIR data has a "Take a picture" answerOption without the
    // "[picture taken]" language extension. When the question also has an
    // attachment child (generating the camera tile), this proxy must still
    // be filtered out to avoid a duplicate tile.
    const root = transformFhirPhysExamToAyu({
      resourceType: 'Questionnaire',
      item: [
        makeSection('Hands', ['Nails'], [
          {
            linkId: 'q-nails',
            text: 'Nails',
            type: 'choice',
            answerOption: [
              { valueCoding: { code: 'normal', display: 'Normal' } },
              { valueCoding: { code: 'camera-proxy', display: 'Take a picture' } },
            ],
            item: [
              { linkId: 'q-nails_attach', type: 'attachment' },
            ],
          },
        ]),
      ],
    });
    const codes = root?.item?.[0]?.answerOption?.map(
      o => o.valueCoding?.code
    );
    // The unmarked proxy is dropped; real "Normal" survives; camera option
    // is built from the attachment child.
    expect(codes).toEqual(['normal', 'q-nails_attach']);
  });

  it('drops proxy option that uses valueString instead of valueCoding.display for "Take a picture"', () => {
    // Covers the `opt.valueCoding?.display ?? opt.valueString ?? ''` fallback:
    // when valueCoding is absent, the filter must fall through to valueString.
    const root = transformFhirPhysExamToAyu({
      resourceType: 'Questionnaire',
      item: [
        makeSection('Hands', ['Nails'], [
          {
            linkId: 'q-nails-vs',
            text: 'Nails',
            type: 'choice',
            answerOption: [
              { valueCoding: { code: 'normal', display: 'Normal' } },
              // proxy with valueString only (no valueCoding)
              { valueString: 'Take a picture' },
              // option with neither valueCoding.display nor valueString
              // (covers the final ?? '' fallback)
              { valueInteger: 99 },
            ],
            item: [
              { linkId: 'q-nails-vs_attach', type: 'attachment' },
            ],
          },
        ]),
      ],
    });
    const opts = root?.item?.[0]?.answerOption ?? [];
    // 'Normal' survives, 'Take a picture' (valueString) is dropped,
    // valueInteger option survives (display='' ≠ 'take a picture'),
    // camera tile is appended from the attachment child.
    expect(opts.map(o => o.valueCoding?.code ?? o.valueInteger ?? o.valueCoding?.code)).toEqual([
      'normal', 99, 'q-nails-vs_attach',
    ]);
  });

  it('preserves Yes/No answerOptions when the attachment enables on those codes (no false dedup)', () => {
    // Mirrors the 1st jaundice question: enableWhen entries on the
    // attachment reference the real Yes/No answer codes. Those codes must
    // NOT be filtered out — they are real user choices, not "[picture taken]"
    // markers.
    const root = transformFhirPhysExamToAyu({
      resourceType: 'Questionnaire',
      item: [
        makeSection('Eyes', ['Jaundice'], [
          {
            linkId: 'q-jaundice',
            text: 'Is there jaundice?',
            type: 'choice',
            answerOption: [
              { valueCoding: { code: 'no', display: 'No' } },
              { valueCoding: { code: 'yes', display: 'Yes' } },
            ],
            item: [
              {
                linkId: 'q-jaundice_attach',
                type: 'attachment',
                enableWhen: [
                  {
                    question: 'q-jaundice',
                    operator: '=',
                    answerCoding: { code: 'no' },
                  },
                  {
                    question: 'q-jaundice',
                    operator: '=',
                    answerCoding: { code: 'yes' },
                  },
                ],
              },
            ],
          },
        ]),
      ],
    });
    const codes = root?.item?.[0]?.answerOption?.map(
      o => o.valueCoding?.code
    );
    // Both real choices survive; the camera option is appended with the
    // attachment's linkId as its code — crucially NOT 'no'. (The old behavior
    // reused enableWhen[0].code='no', so capturing a picture saved "No".)
    expect(codes).toEqual(['no', 'yes', 'q-jaundice_attach']);
  });

  it('passes job-aid extensions through to the question', () => {
    const root = transformFhirPhysExamToAyu({
      resourceType: 'Questionnaire',
      item: [
        makeSection('Hands', ['Jaundice'], [
          makeChoiceQuestion({
            extension: [
              { url: EXT_URL_JOB_AID_TYPE, valueString: 'image' },
              { url: EXT_URL_JOB_AID_FILE, valueString: 'jaundice.png' },
            ],
          }),
        ]),
      ],
    });
    expect(root?.item?.[0]?.extension).toEqual(
      expect.arrayContaining([
        { url: EXT_URL_JOB_AID_TYPE, valueString: 'image' },
        { url: EXT_URL_JOB_AID_FILE, valueString: 'jaundice.png' },
      ])
    );
  });

  it('skips section items whose type is not choice', () => {
    const root = transformFhirPhysExamToAyu({
      resourceType: 'Questionnaire',
      item: [
        {
          linkId: 'sec1',
          text: 'Hands',
          type: 'group',
          answerOption: [
            { valueCoding: { code: 'jaundice', display: 'Jaundice' } },
          ],
          item: [
            { linkId: 'note', type: 'display', text: 'A note' },
            makeChoiceQuestion({ linkId: 'q1' }),
          ],
        },
      ],
    });
    expect(root?.item?.map(q => q.linkId)).toEqual(['q1']);
  });

  it('filters out questions whose demographics do not match the patient', () => {
    const root = transformFhirPhysExamToAyu(
      {
        resourceType: 'Questionnaire',
        item: [
          makeSection('Pelvis', ['Pelvic exam'], [
            makeChoiceQuestion({
              linkId: 'q1',
              extension: [
                {
                  url: 'https://intelehealth.org/fhir/StructureDefinition/gender',
                  valueString: '0',
                },
              ],
            }),
          ]),
        ],
      },
      { gender: 'M' }
    );
    expect(root?.item).toEqual([]);
  });

  it('returns required=true only for required questions', () => {
    const root = transformFhirPhysExamToAyu({
      resourceType: 'Questionnaire',
      item: [
        makeSection('Hands', ['Jaundice', 'Pallor'], [
          makeChoiceQuestion({ linkId: 'r', required: true }),
          makeChoiceQuestion({ linkId: 'nr', required: false }),
        ]),
      ],
    });
    expect(root?.item?.[0]?.required).toBe(true);
    expect(root?.item?.[1]?.required).toBe(false);
  });

  /* The real physExam.json wraps each question one level deep: a "concept-tag"
   * choice (text = "Eyes: Jaundice") whose single answerOption matches the
   * linkId of an inner choice (the real question, with real Yes/No options
   * and an attachment camera child). The transform must drill into the inner
   * choice or only the wrapper's concept-tag option will be shown to users. */
  describe('wrapped-question pattern (matches physExam.json shape)', () => {
    const makeWrappedQuestion = (
      wrapperLinkId: string,
      wrapperText: string,
      innerLinkId: string,
      innerText: string,
      innerOverrides: Partial<FhirItem> = {}
    ): FhirItem => ({
      linkId: wrapperLinkId,
      text: wrapperText,
      type: 'choice',
      answerOption: [
        { valueCoding: { code: innerLinkId, display: innerText } },
      ],
      item: [
        {
          linkId: innerLinkId,
          text: innerText,
          type: 'choice',
          required: true,
          enableWhen: [
            {
              question: wrapperLinkId,
              operator: '=',
              answerCoding: { code: innerLinkId },
            },
          ],
          answerOption: [
            { valueCoding: { code: 'no', display: 'No' } },
            { valueCoding: { code: 'yes', display: 'Yes' } },
          ],
          ...innerOverrides,
        },
      ],
    });

    it('unwraps the wrapper and uses the inner choice as the real question', () => {
      const root = transformFhirPhysExamToAyu({
        resourceType: 'Questionnaire',
        item: [
          {
            linkId: 'sec-general',
            text: 'General exams',
            type: 'group',
            item: [
              makeWrappedQuestion(
                'wrap-jaundice',
                'Eyes: Jaundice',
                'inner-jaundice',
                'Is there jaundice?*'
              ),
            ],
          },
        ],
      });
      // linkId is the inner question's, not the wrapper's
      expect(root?.item?.[0]?.linkId).toBe('inner-jaundice');
      // text comes from the inner choice (asterisk stripped)
      expect(root?.item?.[0]?.text).toBe('Is there jaundice?');
      // real Yes/No options are surfaced — the wrapper's single concept-tag
      // answerOption is NOT what users select against
      const codes = root?.item?.[0]?.answerOption?.map(
        o => o.valueCoding?.code
      );
      expect(codes).toEqual(['no', 'yes']);
    });

    /* Real "Abdomen → Tenderness" shape: the wrapper nests TWO levels deep —
     * "Tenderness" (1 concept-tag option) → "No tenderness" (string) + "Yes"
     * (choice with concept-tag) → "Select the location" (3 location options).
     *
     * Because the outer wrapper has TWO real gated children ("No tenderness"
     * and "Yes"), it is a *branching* question — not a simple wrapper to unwrap
     * through. The transform collapses it into a single question with
     * "No tenderness" / "Yes" options, and lifts the "Yes" branch's
     * sub-question (location) so picking "Yes" reveals the location selector,
     * matching the mobile app's display. */
    it('collapses a double-nested Tenderness wrapper into a branching question with lifted location sub-question', () => {
      const root = transformFhirPhysExamToAyu({
        resourceType: 'Questionnaire',
        item: [
          {
            linkId: 'sec-abdomen',
            text: 'Abdomen',
            type: 'group',
            item: [
              {
                linkId: 'wrap-tenderness',
                text: 'Tenderness',
                type: 'choice',
                answerOption: [
                  {
                    valueCoding: {
                      code: 'tenderness-cc',
                      display: 'Is there abdominal tenderness?*',
                    },
                  },
                ],
                item: [
                  // string sibling — a terminal branch (No tenderness)
                  {
                    linkId: 'no-tenderness',
                    text: 'No tenderness',
                    type: 'string',
                    enableWhen: [
                      {
                        question: 'wrap-tenderness',
                        operator: '=',
                        answerCoding: { code: 'tenderness-cc' },
                      },
                    ],
                  },
                  // inner wrapper "Yes" — single concept-tag option pointing at
                  // the real location question nested one level deeper
                  {
                    linkId: 'tenderness-yes',
                    text: 'Yes',
                    type: 'choice',
                    enableWhen: [
                      {
                        question: 'wrap-tenderness',
                        operator: '=',
                        answerCoding: { code: 'tenderness-cc' },
                      },
                    ],
                    answerOption: [
                      {
                        valueCoding: {
                          code: 'location-cc',
                          display: 'Select the location where there is tenderness',
                        },
                      },
                    ],
                    item: [
                      {
                        linkId: 'tenderness-location',
                        text: 'Select the location where there is tenderness',
                        type: 'choice',
                        enableWhen: [
                          {
                            question: 'tenderness-yes',
                            operator: '=',
                            answerCoding: { code: 'location-cc' },
                          },
                        ],
                        answerOption: [
                          { valueCoding: { code: 'upper-l', display: 'Upper(L)' } },
                          { valueCoding: { code: 'middle-c', display: 'Middle(C)' } },
                          { valueCoding: { code: 'all-over', display: 'All Over' } },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });

      const q = root?.item?.[0];
      // Collapsed into a branching question with the concept-tag as question text
      expect(q?.linkId).toBe('wrap-tenderness');
      expect(q?.text).toBe('Is there abdominal tenderness?');
      // Options come from branches: No tenderness / Yes (coded by branch linkId)
      expect(q?.answerOption?.map(o => o.valueCoding)).toEqual([
        { code: 'no-tenderness', display: 'No tenderness' },
        { code: 'tenderness-yes', display: 'Yes' },
      ]);
      // The "Yes" branch's sub-question (location) is lifted and re-gated
      // so selecting "Yes" reveals the location picker with its label text
      expect(q?.item).toHaveLength(1);
      const locationSub = q?.item?.[0];
      expect(locationSub?.linkId).toBe('tenderness-location');
      expect(locationSub?.text).toBe('Select the location where there is tenderness');
      expect(locationSub?.answerOption?.map(o => o.valueCoding?.code)).toEqual([
        'upper-l',
        'middle-c',
        'all-over',
      ]);
      expect(locationSub?.enableWhen).toEqual([
        {
          question: 'wrap-tenderness',
          operator: '=',
          answerCoding: { code: 'tenderness-yes' },
        },
      ]);
      // category/question key stay the OUTERMOST wrapper's text ("Tenderness")
      // so the protocol filter "Abdomen:Tenderness" still matches this question
      expect(q?.extension).toEqual(
        expect.arrayContaining([
          { url: EXT_URL_PE_SECTION_KEY, valueString: 'Abdomen' },
          { url: EXT_URL_PE_CATEGORY_LABEL, valueString: 'Tenderness' },
          { url: EXT_URL_PE_QUESTION_KEY, valueString: 'Tenderness' },
        ])
      );
    });

    /* Camera attachment nested inside the "Yes" branch of a double-nested
     * wrapper (e.g. Tenderness with a camera under the inner "Yes" concept-tag).
     * The recursive findFirstAttachment picks it up and surfaces it alongside
     * the No/Yes options so the user can select "Yes" AND take a picture. */
    it('discovers a camera attachment nested inside a double-nested branching wrapper', () => {
      const root = transformFhirPhysExamToAyu({
        resourceType: 'Questionnaire',
        item: [
          {
            linkId: 'sec-abdomen',
            text: 'Abdomen',
            type: 'group',
            item: [
              {
                linkId: 'wrap-tenderness',
                text: 'Tenderness',
                type: 'choice',
                answerOption: [
                  {
                    valueCoding: {
                      code: 'tenderness-cc',
                      display: 'Is there abdominal tenderness?*',
                    },
                  },
                ],
                item: [
                  {
                    linkId: 'no-tenderness',
                    text: 'No tenderness',
                    type: 'string',
                    enableWhen: [
                      {
                        question: 'wrap-tenderness',
                        operator: '=',
                        answerCoding: { code: 'tenderness-cc' },
                      },
                    ],
                  },
                  {
                    linkId: 'tenderness-yes',
                    text: 'Yes',
                    type: 'choice',
                    enableWhen: [
                      {
                        question: 'wrap-tenderness',
                        operator: '=',
                        answerCoding: { code: 'tenderness-cc' },
                      },
                    ],
                    answerOption: [
                      {
                        valueCoding: {
                          code: 'location-cc',
                          display: 'Select the location',
                        },
                      },
                    ],
                    item: [
                      {
                        linkId: 'tenderness-location',
                        text: 'Select the location',
                        type: 'choice',
                        enableWhen: [
                          {
                            question: 'tenderness-yes',
                            operator: '=',
                            answerCoding: { code: 'location-cc' },
                          },
                        ],
                        answerOption: [
                          { valueCoding: { code: 'upper-l', display: 'Upper(L)' } },
                        ],
                      },
                      // Camera nested inside the "Yes" branch
                      {
                        linkId: 'tenderness-camera',
                        text: 'Take a picture of the area',
                        type: 'attachment',
                        enableWhen: [
                          {
                            question: 'tenderness-yes',
                            operator: '=',
                            answerCoding: { code: 'location-cc' },
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });

      const q = root?.item?.[0];
      expect(q?.linkId).toBe('wrap-tenderness');
      // Options: No tenderness / Yes / camera tile (discovered recursively)
      const codes = q?.answerOption?.map(o => o.valueCoding?.code);
      expect(codes).toEqual(['no-tenderness', 'tenderness-yes', 'tenderness-camera']);
      // Camera option carries the PE_OPTION_KIND_CAMERA marker
      const cameraOpt = q?.answerOption?.find(
        o => o.valueCoding?.code === 'tenderness-camera'
      );
      expect(cameraOpt?.extension).toEqual([
        { url: EXT_URL_PE_OPTION_KIND, valueString: PE_OPTION_KIND_CAMERA },
      ]);
    });

    it('discovers job-aid extensions on inner branches of a double-nested wrapper', () => {
      const root = transformFhirPhysExamToAyu({
        resourceType: 'Questionnaire',
        item: [
          {
            linkId: 'sec-abdomen',
            text: 'Abdomen',
            type: 'group',
            answerOption: [
              { valueCoding: { code: 'tag-1', display: 'Tenderness' } },
            ],
            item: [
              {
                linkId: 'wrap-tenderness',
                text: 'Tenderness',
                type: 'choice',
                // No job-aid extensions on the outer wrapper
                answerOption: [
                  {
                    valueCoding: {
                      code: 'tenderness-cc',
                      display: 'Is there abdominal tenderness?*',
                    },
                  },
                ],
                item: [
                  {
                    linkId: 'no-tenderness',
                    text: 'No tenderness',
                    type: 'string',
                    enableWhen: [
                      {
                        question: 'wrap-tenderness',
                        operator: '=',
                        answerCoding: { code: 'tenderness-cc' },
                      },
                    ],
                  },
                  {
                    linkId: 'tenderness-yes',
                    text: 'Yes',
                    type: 'choice',
                    // Job-aid extensions on the inner branch
                    extension: [
                      { url: EXT_URL_JOB_AID_TYPE, valueString: 'image' },
                      { url: EXT_URL_JOB_AID_FILE, valueString: 'abdominalregions9' },
                    ],
                    enableWhen: [
                      {
                        question: 'wrap-tenderness',
                        operator: '=',
                        answerCoding: { code: 'tenderness-cc' },
                      },
                    ],
                    answerOption: [
                      {
                        valueCoding: {
                          code: 'tenderness-loc',
                          display: 'Select the location where there is tenderness',
                        },
                      },
                    ],
                    item: [
                      {
                        linkId: 'tenderness-location',
                        text: 'Select the location where there is tenderness',
                        type: 'choice',
                        enableWhen: [
                          {
                            question: 'tenderness-yes',
                            operator: '=',
                            answerCoding: { code: 'tenderness-cc' },
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });

      const q = root?.item?.[0];
      expect(q?.linkId).toBe('wrap-tenderness');
      // Job-aid extensions should be discovered from the inner branch
      const jobAidExt = q?.extension?.filter(
        e => e.url === EXT_URL_JOB_AID_TYPE || e.url === EXT_URL_JOB_AID_FILE
      );
      expect(jobAidExt).toEqual([
        { url: EXT_URL_JOB_AID_TYPE, valueString: 'image' },
        { url: EXT_URL_JOB_AID_FILE, valueString: 'abdominalregions9' },
      ]);
    });

    it('preserves job-aid extensions on the outer wrapper of a branching question', () => {
      const root = transformFhirPhysExamToAyu({
        resourceType: 'Questionnaire',
        item: [
          {
            linkId: 'sec-abdomen',
            text: 'Abdomen',
            type: 'group',
            answerOption: [
              { valueCoding: { code: 'tag-1', display: 'Tenderness' } },
            ],
            item: [
              {
                linkId: 'wrap-tenderness',
                text: 'Tenderness',
                type: 'choice',
                // Job-aid extensions on the outer wrapper (common case)
                extension: [
                  { url: EXT_URL_JOB_AID_TYPE, valueString: 'image' },
                  { url: EXT_URL_JOB_AID_FILE, valueString: 'abdominalregions9' },
                ],
                answerOption: [
                  {
                    valueCoding: {
                      code: 'tenderness-cc',
                      display: 'Is there abdominal tenderness?*',
                    },
                  },
                ],
                item: [
                  {
                    linkId: 'no-tenderness',
                    text: 'No tenderness',
                    type: 'string',
                    enableWhen: [
                      {
                        question: 'wrap-tenderness',
                        operator: '=',
                        answerCoding: { code: 'tenderness-cc' },
                      },
                    ],
                  },
                  {
                    linkId: 'tenderness-yes',
                    text: 'Yes',
                    type: 'choice',
                    enableWhen: [
                      {
                        question: 'wrap-tenderness',
                        operator: '=',
                        answerCoding: { code: 'tenderness-cc' },
                      },
                    ],
                    answerOption: [
                      {
                        valueCoding: {
                          code: 'tenderness-loc',
                          display: 'Select the location where there is tenderness',
                        },
                      },
                    ],
                    item: [
                      {
                        linkId: 'tenderness-location',
                        text: 'Select the location where there is tenderness',
                        type: 'choice',
                        enableWhen: [
                          {
                            question: 'tenderness-yes',
                            operator: '=',
                            answerCoding: { code: 'tenderness-cc' },
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });

      const q = root?.item?.[0];
      expect(q?.linkId).toBe('wrap-tenderness');
      // Job-aid extensions from the outer wrapper should be preserved
      const jobAidExt = q?.extension?.filter(
        e => e.url === EXT_URL_JOB_AID_TYPE || e.url === EXT_URL_JOB_AID_FILE
      );
      expect(jobAidExt).toEqual([
        { url: EXT_URL_JOB_AID_TYPE, valueString: 'image' },
        { url: EXT_URL_JOB_AID_FILE, valueString: 'abdominalregions9' },
      ]);
    });

    it('propagates job-aid found via subtree search when simple wrapper is unwrapped', () => {
      /* Simple wrapper (1 gated choice child) where neither the wrapper nor the
       * inner target has direct job-aid, but a display child of the inner
       * target carries the extensions. findJobAidInTree(q.item) discovers
       * them and copies to the effective target (lines 886-890). */
      const root = transformFhirPhysExamToAyu({
        resourceType: 'Questionnaire',
        item: [
          {
            linkId: 'sec-eyes',
            text: 'Eyes',
            type: 'group',
            item: [
              {
                linkId: 'wrap-jaundice',
                text: 'Eyes: Jaundice',
                type: 'choice',
                // No job-aid on wrapper
                answerOption: [
                  {
                    valueCoding: {
                      code: 'inner-jaundice',
                      display: 'Is there jaundice?*',
                    },
                  },
                ],
                item: [
                  {
                    linkId: 'inner-jaundice',
                    text: 'Is there jaundice?*',
                    type: 'choice',
                    // No job-aid on inner target
                    enableWhen: [
                      {
                        question: 'wrap-jaundice',
                        operator: '=',
                        answerCoding: { code: 'inner-jaundice' },
                      },
                    ],
                    answerOption: [
                      { valueCoding: { code: 'no', display: 'No' } },
                      { valueCoding: { code: 'yes', display: 'Yes' } },
                    ],
                    item: [
                      // Display child carries job-aid (not a sub-question)
                      {
                        linkId: 'jaundice-ref',
                        text: 'Reference image',
                        type: 'display',
                        extension: [
                          { url: EXT_URL_JOB_AID_TYPE, valueString: 'image' },
                          { url: EXT_URL_JOB_AID_FILE, valueString: 'jaundice-ref-img' },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });

      const q = root?.item?.[0];
      expect(q?.linkId).toBe('inner-jaundice');
      // Job-aid should be propagated from the subtree display child
      const jobAidExt = q?.extension?.filter(
        e => e.url === EXT_URL_JOB_AID_TYPE || e.url === EXT_URL_JOB_AID_FILE
      );
      expect(jobAidExt).toEqual([
        { url: EXT_URL_JOB_AID_TYPE, valueString: 'image' },
        { url: EXT_URL_JOB_AID_FILE, valueString: 'jaundice-ref-img' },
      ]);
    });

    it('reads job-aid from legacy direct properties when FHIR extensions are absent', () => {
      const root = transformFhirPhysExamToAyu({
        resourceType: 'Questionnaire',
        item: [
          {
            linkId: 'sec-abdomen',
            text: 'Abdomen',
            type: 'group',
            answerOption: [
              { valueCoding: { code: 'tag-1', display: 'Tenderness' } },
            ],
            item: [
              {
                linkId: 'wrap-tenderness',
                text: 'Tenderness',
                type: 'choice',
                // Legacy direct properties instead of FHIR extensions
                'job-aid-type': 'image',
                'job-aid-file': 'abdominalregions9',
                answerOption: [
                  {
                    valueCoding: {
                      code: 'tenderness-cc',
                      display: 'Is there abdominal tenderness?*',
                    },
                  },
                ],
                item: [
                  {
                    linkId: 'no-tenderness',
                    text: 'No tenderness',
                    type: 'string',
                    enableWhen: [
                      {
                        question: 'wrap-tenderness',
                        operator: '=',
                        answerCoding: { code: 'tenderness-cc' },
                      },
                    ],
                  },
                  {
                    linkId: 'tenderness-yes',
                    text: 'Yes',
                    type: 'choice',
                    enableWhen: [
                      {
                        question: 'wrap-tenderness',
                        operator: '=',
                        answerCoding: { code: 'tenderness-cc' },
                      },
                    ],
                  },
                ],
              } as never, // `as never` — the TS type doesn't declare legacy keys
            ],
          },
        ],
      });

      const q = root?.item?.[0];
      expect(q?.linkId).toBe('wrap-tenderness');
      const jobAidExt = q?.extension?.filter(
        e => e.url === EXT_URL_JOB_AID_TYPE || e.url === EXT_URL_JOB_AID_FILE
      );
      expect(jobAidExt).toEqual([
        { url: EXT_URL_JOB_AID_TYPE, valueString: 'image' },
        { url: EXT_URL_JOB_AID_FILE, valueString: 'abdominalregions9' },
      ]);
    });

    it('reads job-aid from legacy properties on non-branching questions', () => {
      const root = transformFhirPhysExamToAyu({
        resourceType: 'Questionnaire',
        item: [
          {
            linkId: 'sec-hands',
            text: 'Hands',
            type: 'group',
            answerOption: [
              { valueCoding: { code: 'tag-nail', display: 'Nails' } },
            ],
            item: [
              {
                linkId: 'q-nails',
                text: 'Are the nails normal?',
                type: 'choice',
                'job-aid-type': 'image',
                'job-aid-file': 'abnormalnails',
                answerOption: [
                  { valueCoding: { code: 'yes', display: 'Yes' } },
                  { valueCoding: { code: 'no', display: 'No' } },
                ],
              } as never,
            ],
          },
        ],
      });

      const q = root?.item?.[0];
      expect(q?.linkId).toBe('q-nails');
      const jobAidExt = q?.extension?.filter(
        e => e.url === EXT_URL_JOB_AID_TYPE || e.url === EXT_URL_JOB_AID_FILE
      );
      expect(jobAidExt).toEqual([
        { url: EXT_URL_JOB_AID_TYPE, valueString: 'image' },
        { url: EXT_URL_JOB_AID_FILE, valueString: 'abnormalnails' },
      ]);
    });

    /* Real "Any Location → Skin Rash" shape: a branching sub-form. It is
     * collapsed into a single "Is there any rash?" question with No/Yes
     * options; the affirmative branch's follow-ups (mixed integer/choice/…)
     * are lifted and re-gated so picking "Yes" reveals all of them, rendered
     * by the same Visit-Reason AyuNestedRenderer. */
    it('collapses a branching sub-form into a Yes/No question with lifted follow-ups', () => {
      const root = transformFhirPhysExamToAyu({
        resourceType: 'Questionnaire',
        item: [
          {
            linkId: 'sec-any-location',
            text: 'Any Location',
            type: 'group',
            item: [
              {
                linkId: 'wrap-rash',
                text: 'Skin Rash',
                type: 'choice',
                answerOption: [
                  {
                    valueCoding: { code: 'rash-cc', display: 'Is there any rash?' },
                  },
                ],
                item: [
                  {
                    linkId: 'rash-no',
                    text: 'No',
                    type: 'string',
                    enableWhen: [
                      {
                        question: 'wrap-rash',
                        operator: '=',
                        answerCoding: { code: 'rash-cc' },
                      },
                    ],
                  },
                  {
                    linkId: 'rash-yes',
                    text: 'Yes',
                    type: 'choice',
                    enableWhen: [
                      {
                        question: 'wrap-rash',
                        operator: '=',
                        answerCoding: { code: 'rash-cc' },
                      },
                    ],
                    answerOption: [
                      { valueCoding: { code: 'howmany', display: 'How many rashes?' } },
                      { valueCoding: { code: 'surface', display: 'How is the surface?' } },
                    ],
                    item: [
                      {
                        linkId: 'howmany',
                        text: 'How many rashes? - Enter number',
                        type: 'integer',
                        enableWhen: [
                          {
                            question: 'rash-yes',
                            operator: '=',
                            answerCoding: { code: 'howmany' },
                          },
                        ],
                      },
                      {
                        linkId: 'surface',
                        text: 'How is the surface?',
                        type: 'choice',
                        enableWhen: [
                          {
                            question: 'rash-yes',
                            operator: '=',
                            answerCoding: { code: 'surface' },
                          },
                        ],
                        answerOption: [
                          { valueCoding: { code: 'smooth', display: 'Smooth' } },
                          { valueCoding: { code: 'rough', display: 'Rough' } },
                        ],
                      },
                    ],
                  },
                  // camera child (like the real "Put a ruler … take a picture").
                  // normalizeType throws on 'attachment', so the transform must
                  // strip it before walking the branching subtree.
                  {
                    linkId: 'rash-camera',
                    text: 'Put a ruler next to the rash and take a picture',
                    type: 'attachment',
                    enableWhen: [
                      {
                        question: 'wrap-rash',
                        operator: '=',
                        answerCoding: { code: 'rash-cc' },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });

      const q = root?.item?.[0];
      // Collapsed into the concept-tag question with PE metadata kept.
      expect(q?.linkId).toBe('wrap-rash');
      expect(q?.text).toBe('Is there any rash?');
      expect(q?.type).toBe('choice');
      expect(q?.extension).toEqual(
        expect.arrayContaining([
          { url: EXT_URL_PE_SECTION_KEY, valueString: 'Any Location' },
          { url: EXT_URL_PE_CATEGORY_LABEL, valueString: 'Skin Rash' },
          { url: EXT_URL_PE_QUESTION_KEY, valueString: 'Skin Rash' },
        ])
      );
      // Options come from the branch children: No / Yes (coded by linkId),
      // plus a camera tile from the attachment child.
      expect(q?.answerOption?.map(o => o.valueCoding)).toEqual([
        { code: 'rash-no', display: 'No' },
        { code: 'rash-yes', display: 'Yes' },
        { code: 'rash-camera', display: 'Picture Taken' },
      ]);
      const cameraOpt = q?.answerOption?.find(
        o => o.valueCoding?.code === 'rash-camera'
      );
      expect(cameraOpt?.extension).toEqual([
        { url: EXT_URL_PE_OPTION_KIND, valueString: PE_OPTION_KIND_CAMERA },
      ]);
      // The "Yes" follow-ups are lifted to the top question and re-gated so
      // they all show when the answer is "Yes" (= the rash-yes branch).
      const subIds = q?.item?.map(c => c.linkId);
      expect(subIds).toEqual(['howmany', 'surface']);
      for (const sub of q?.item ?? []) {
        expect(sub.enableWhen).toEqual([
          {
            question: 'wrap-rash',
            operator: '=',
            answerCoding: { code: 'rash-yes' },
          },
        ]);
      }
      const howMany = q?.item?.find(c => c.linkId === 'howmany');
      expect(howMany?.type).toBe('integer');
      // Non-wrapper branches (2+ answerOptions) preserve sub-question text
      expect(howMany?.text).toBe('How many rashes? - Enter number');
      const surface = q?.item?.find(c => c.linkId === 'surface');
      expect(surface?.type).toBe('choice');
      expect(surface?.text).toBe('How is the surface?');
      expect(surface?.answerOption?.map(o => o.valueCoding?.code)).toEqual([
        'smooth',
        'rough',
      ]);
      // the attachment (camera) child is dropped (deferred; would otherwise
      // throw in normalizeType and render as a stray text box).
      const allIds = [q?.linkId, ...(q?.item?.map(c => c.linkId) ?? [])];
      expect(allIds).not.toContain('rash-camera');
    });

    it('returns null for a branching question whose wrapper fails demographics', () => {
      const root = transformFhirPhysExamToAyu(
        {
          resourceType: 'Questionnaire',
          item: [
            {
              linkId: 'sec',
              text: 'Section',
              type: 'group',
              item: [
                {
                  linkId: 'wrap-female',
                  text: 'Female Question',
                  type: 'choice',
                  extension: [
                    { url: 'https://intelehealth.org/fhir/StructureDefinition/gender', valueString: '0' },
                  ],
                  answerOption: [
                    { valueCoding: { code: 'cc', display: 'Concept' } },
                  ],
                  item: [
                    {
                      linkId: 'branch-no',
                      text: 'No',
                      type: 'string',
                      enableWhen: [{ question: 'wrap-female', operator: '=', answerCoding: { code: 'cc' } }],
                    },
                    {
                      linkId: 'branch-yes',
                      text: 'Yes',
                      type: 'string',
                      enableWhen: [{ question: 'wrap-female', operator: '=', answerCoding: { code: 'cc' } }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        { gender: 'M' }
      );
      // Wrapper fails demographics → buildBranchingPhysExamQuestion returns null → no items
      expect(root?.item).toEqual([]);
    });

    it('returns null for a branching question when all branches are filtered out by demographics', () => {
      const root = transformFhirPhysExamToAyu(
        {
          resourceType: 'Questionnaire',
          item: [
            {
              linkId: 'sec',
              text: 'Section',
              type: 'group',
              item: [
                {
                  linkId: 'wrap-q',
                  text: 'Branching Q',
                  type: 'choice',
                  answerOption: [
                    { valueCoding: { code: 'cc', display: 'Check' } },
                  ],
                  item: [
                    {
                      linkId: 'b-no',
                      text: 'No',
                      type: 'string',
                      extension: [
                        { url: 'https://intelehealth.org/fhir/StructureDefinition/gender', valueString: '0' },
                      ],
                      enableWhen: [{ question: 'wrap-q', operator: '=', answerCoding: { code: 'cc' } }],
                    },
                    {
                      linkId: 'b-yes',
                      text: 'Yes',
                      type: 'string',
                      extension: [
                        { url: 'https://intelehealth.org/fhir/StructureDefinition/gender', valueString: '0' },
                      ],
                      enableWhen: [{ question: 'wrap-q', operator: '=', answerCoding: { code: 'cc' } }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        { gender: 'M' }
      );
      // All branch children fail demographics (female-only) → branches.length === 0 → null
      expect(root?.item).toEqual([]);
    });

    it('filters some branches by demographics while keeping others', () => {
      const root = transformFhirPhysExamToAyu(
        {
          resourceType: 'Questionnaire',
          item: [
            {
              linkId: 'sec',
              text: 'Section',
              type: 'group',
              item: [
                {
                  linkId: 'wrap-q',
                  text: 'Mixed',
                  type: 'choice',
                  answerOption: [
                    { valueCoding: { code: 'cc', display: 'Check' } },
                  ],
                  item: [
                    {
                      linkId: 'branch-male',
                      text: 'Male branch',
                      type: 'string',
                      extension: [
                        { url: 'https://intelehealth.org/fhir/StructureDefinition/gender', valueString: '1' },
                      ],
                      enableWhen: [{ question: 'wrap-q', operator: '=', answerCoding: { code: 'cc' } }],
                    },
                    {
                      linkId: 'branch-all',
                      text: 'All genders',
                      type: 'string',
                      enableWhen: [{ question: 'wrap-q', operator: '=', answerCoding: { code: 'cc' } }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        { gender: 'F' }
      );
      const q = root?.item?.[0];
      // Only 'branch-all' survives; 'branch-male' is filtered by demographics
      expect(q?.answerOption?.map(o => o.valueCoding?.code)).toEqual(['branch-all']);
    });

    it('uses empty string when both answerOption display and q.text are missing in branching question', () => {
      /* Concept-tag wrapper (1 answerOption) whose valueCoding has no display
       * AND no q.text → conceptDisplay ?? q.text ?? '' yields ''.
       * The wrapper unwraps to an inner choice with sub-question children,
       * triggering buildBranchingPhysExamQuestion. */
      const root = transformFhirPhysExamToAyu({
        resourceType: 'Questionnaire',
        item: [
          {
            linkId: 'sec',
            text: 'Section',
            type: 'group',
            item: [
              {
                linkId: 'wrap-q',
                // no text
                type: 'choice',
                answerOption: [
                  { valueCoding: { code: 'tag1' } }, // no display
                ],
                item: [
                  {
                    linkId: 'inner-q',
                    type: 'choice',
                    text: 'Inner Question',
                    enableWhen: [{ question: 'wrap-q', operator: '=', answerCoding: { code: 'tag1' } }],
                    answerOption: [
                      { valueCoding: { code: 'opt-no', display: 'No' } },
                      { valueCoding: { code: 'opt-yes', display: 'Yes' } },
                    ],
                    item: [
                      {
                        linkId: 'follow-up',
                        type: 'string',
                        text: 'Details',
                        enableWhen: [{ question: 'inner-q', operator: '=', answerCoding: { code: 'opt-yes' } }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });
      const q = root?.item?.[0];
      expect(q?.text).toBe('');
    });

    it('falls back to q.text when answerOption display is missing in branching question', () => {
      /* Concept-tag wrapper (1 answerOption) whose valueCoding has no display
       * but q.text is present → conceptDisplay ?? q.text ?? '' yields q.text.
       * The wrapper unwraps to an inner choice with sub-question children,
       * triggering buildBranchingPhysExamQuestion. */
      const root = transformFhirPhysExamToAyu({
        resourceType: 'Questionnaire',
        item: [
          {
            linkId: 'sec',
            text: 'Section',
            type: 'group',
            item: [
              {
                linkId: 'wrap-q',
                text: 'Fallback Text',
                type: 'choice',
                answerOption: [
                  { valueCoding: { code: 'tag1' } }, // no display
                ],
                item: [
                  {
                    linkId: 'inner-q',
                    type: 'choice',
                    text: 'Inner Question',
                    enableWhen: [{ question: 'wrap-q', operator: '=', answerCoding: { code: 'tag1' } }],
                    answerOption: [
                      { valueCoding: { code: 'opt-no', display: 'No' } },
                      { valueCoding: { code: 'opt-yes', display: 'Yes' } },
                    ],
                    item: [
                      {
                        linkId: 'follow-up',
                        type: 'string',
                        text: 'Details',
                        enableWhen: [{ question: 'inner-q', operator: '=', answerCoding: { code: 'opt-yes' } }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });
      const q = root?.item?.[0];
      expect(q?.text).toBe('Fallback Text');
    });

    it('handles a branch with no sub-items (empty item array)', () => {
      const root = transformFhirPhysExamToAyu({
        resourceType: 'Questionnaire',
        item: [
          {
            linkId: 'sec',
            text: 'Section',
            type: 'group',
            item: [
              {
                linkId: 'wrap-q',
                text: 'Q',
                type: 'choice',
                answerOption: [
                  { valueCoding: { code: 'cc', display: 'Check' } },
                ],
                item: [
                  {
                    linkId: 'b-no',
                    text: 'No',
                    type: 'string',
                    enableWhen: [{ question: 'wrap-q', operator: '=', answerCoding: { code: 'cc' } }],
                    // no item array → subTree.item ?? [] yields empty
                  },
                  {
                    linkId: 'b-yes',
                    text: 'Yes',
                    type: 'string',
                    enableWhen: [{ question: 'wrap-q', operator: '=', answerCoding: { code: 'cc' } }],
                    // no sub-items either
                  },
                ],
              },
            ],
          },
        ],
      });
      const q = root?.item?.[0];
      expect(q?.answerOption?.map(o => o.valueCoding?.code)).toEqual(['b-no', 'b-yes']);
      // No sub-items are lifted
      expect(q?.item).toEqual([]);
    });

    it('uses empty string for branch text when text is undefined', () => {
      const root = transformFhirPhysExamToAyu({
        resourceType: 'Questionnaire',
        item: [
          {
            linkId: 'sec',
            text: 'Section',
            type: 'group',
            item: [
              {
                linkId: 'wrap-q',
                text: 'Q',
                type: 'choice',
                answerOption: [
                  { valueCoding: { code: 'cc', display: 'Check' } },
                ],
                item: [
                  {
                    linkId: 'b-no',
                    // no text → b.text ?? '' yields ''
                    type: 'string',
                    enableWhen: [{ question: 'wrap-q', operator: '=', answerCoding: { code: 'cc' } }],
                  },
                ],
              },
            ],
          },
        ],
      });
      const q = root?.item?.[0];
      expect(q?.answerOption?.[0]?.valueCoding?.display).toBe('');
    });

    it('uses the wrapper text as the category label for the summary', () => {
      const root = transformFhirPhysExamToAyu({
        resourceType: 'Questionnaire',
        item: [
          {
            linkId: 'sec-general',
            text: 'General exams',
            type: 'group',
            item: [
              makeWrappedQuestion(
                'wrap-jaundice',
                'Eyes: Jaundice',
                'inner-jaundice',
                'Is there jaundice?*'
              ),
            ],
          },
        ],
      });
      expect(root?.item?.[0]?.extension).toEqual(
        expect.arrayContaining([
          { url: EXT_URL_PE_SECTION_KEY, valueString: 'General Exams' },
          { url: EXT_URL_PE_CATEGORY_LABEL, valueString: 'Eyes: Jaundice' },
          { url: EXT_URL_PE_QUESTION_KEY, valueString: 'Eyes: Jaundice' },
        ])
      );
    });

    it('appends the inner attachment child as a camera answerOption', () => {
      const root = transformFhirPhysExamToAyu({
        resourceType: 'Questionnaire',
        item: [
          {
            linkId: 'sec-general',
            text: 'General exams',
            type: 'group',
            item: [
              makeWrappedQuestion(
                'wrap-jaundice',
                'Eyes: Jaundice',
                'inner-jaundice',
                'Is there jaundice?*',
                {
                  item: [
                    {
                      linkId: 'inner-jaundice_ID_cam',
                      type: 'attachment',
                      enableWhen: [
                        {
                          question: 'inner-jaundice',
                          operator: '=',
                          answerCoding: { code: 'CAM' },
                        },
                      ],
                    },
                  ],
                }
              ),
            ],
          },
        ],
      });
      const camera = root?.item?.[0]?.answerOption?.find(o =>
        o.extension?.some(e => e.url === EXT_URL_PE_OPTION_KIND)
      );
      expect(camera).toBeDefined();
      expect(camera?.extension).toEqual(
        expect.arrayContaining([
          { url: EXT_URL_PE_OPTION_KIND, valueString: PE_OPTION_KIND_CAMERA },
        ])
      );
    });

    it('honors check-box itemControl on the inner question (repeats=true)', () => {
      const root = transformFhirPhysExamToAyu({
        resourceType: 'Questionnaire',
        item: [
          {
            linkId: 'sec-general',
            text: 'General exams',
            type: 'group',
            item: [
              makeWrappedQuestion(
                'wrap-nails',
                'Nail abnormality',
                'inner-nails',
                'Is there any nail abnormality?*',
                {
                  repeats: true,
                  extension: [
                    {
                      url: EXT_URL_ITEM_CONTROL,
                      valueCodeableConcept: {
                        coding: [{ code: 'check-box' }],
                      },
                    },
                  ],
                }
              ),
            ],
          },
        ],
      });
      expect(root?.item?.[0]?.repeats).toBe(true);
    });

    it('unwraps even when the wrapper code uses underscores and the inner linkId uses hyphens (real physExam.json shape — "Nail anemia")', () => {
      // Real data has wrapper.answerOption[0].code="ID_1109515145" vs.
      // inner.linkId="ID-1109515145" — a literal-string match misses this,
      // so detection must use the inner's enableWhen back-reference instead.
      const root = transformFhirPhysExamToAyu({
        resourceType: 'Questionnaire',
        item: [
          {
            linkId: 'sec-general',
            text: 'General exams',
            type: 'group',
            item: [
              {
                linkId: 'ID-888899761',
                text: 'Nail anemia',
                type: 'choice',
                answerOption: [
                  {
                    valueCoding: {
                      code: 'ID_1109515145', // underscore
                      display: 'Are the nails pale?*',
                    },
                  },
                ],
                item: [
                  {
                    linkId: 'ID-1109515145', // hyphen — does NOT match the code above
                    text: 'Are the nails pale?*',
                    type: 'choice',
                    required: true,
                    enableWhen: [
                      {
                        question: 'ID-888899761',
                        operator: '=',
                        answerCoding: { code: 'ID_1109515145' },
                      },
                    ],
                    answerOption: [
                      { valueCoding: { code: 'normal', display: 'Nails are normal' } },
                      { valueCoding: { code: 'pale', display: 'Nails are pale' } },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });
      expect(root?.item?.[0]?.linkId).toBe('ID-1109515145');
      expect(root?.item?.[0]?.answerOption?.map(o => o.valueCoding?.code)).toEqual([
        'normal',
        'pale',
      ]);
      expect(root?.item?.[0]?.extension).toEqual(
        expect.arrayContaining([
          { url: EXT_URL_PE_CATEGORY_LABEL, valueString: 'Nail anemia' },
        ])
      );
    });

    it('treats a single-answerOption choice without a matching inner child as a plain question (no unwrap)', () => {
      const root = transformFhirPhysExamToAyu({
        resourceType: 'Questionnaire',
        item: [
          {
            linkId: 'sec-general',
            text: 'General exams',
            type: 'group',
            item: [
              {
                linkId: 'plain',
                text: 'Plain question',
                type: 'choice',
                answerOption: [
                  { valueCoding: { code: 'only', display: 'Only option' } },
                ],
                // no nested choice item whose linkId matches 'only'
              },
            ],
          },
        ],
      });
      expect(root?.item?.[0]?.linkId).toBe('plain');
      expect(root?.item?.[0]?.answerOption?.map(o => o.valueCoding?.code)).toEqual([
        'only',
      ]);
    });

    it('uses an empty category label when the wrapper has no text', () => {
      // Covers the `q.text ?? ''` fallback inside the forEach when unwrapping.
      const root = transformFhirPhysExamToAyu({
        resourceType: 'Questionnaire',
        item: [
          {
            linkId: 'sec-general',
            text: 'General exams',
            type: 'group',
            item: [
              {
                linkId: 'wrap-no-text',
                // wrapper has NO text — falls through to '' for categoryLabel
                type: 'choice',
                answerOption: [
                  { valueCoding: { code: 'inner-x', display: 'prompt' } },
                ],
                item: [
                  {
                    linkId: 'inner-x',
                    text: 'Inner question',
                    type: 'choice',
                    enableWhen: [
                      {
                        question: 'wrap-no-text',
                        operator: '=',
                        answerCoding: { code: 'inner-x' },
                      },
                    ],
                    answerOption: [
                      { valueCoding: { code: 'a', display: 'A' } },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });
      expect(root?.item?.[0]?.extension).toEqual(
        expect.arrayContaining([
          { url: EXT_URL_PE_CATEGORY_LABEL, valueString: '' },
        ])
      );
    });

    it('uses an empty question text when the (non-wrapped) target has no text', () => {
      // Covers the `target.text ?? ''` fallback path.
      const root = transformFhirPhysExamToAyu({
        resourceType: 'Questionnaire',
        item: [
          {
            linkId: 'sec',
            text: 'Hands',
            type: 'group',
            answerOption: [
              { valueCoding: { code: 'tag', display: 'Jaundice' } },
            ],
            item: [
              {
                linkId: 'q-no-text',
                // no text on the question itself
                type: 'choice',
                answerOption: [
                  { valueCoding: { code: 'a', display: 'A' } },
                  { valueCoding: { code: 'b', display: 'B' } },
                ],
              },
            ],
          },
        ],
      });
      expect(root?.item?.[0]?.text).toBe('');
    });

    it('skips sections whose demographic extensions do not match the patient', () => {
      // Covers the truthy branch of `!matchesDemographics(section.extension, demographics)`
      // → continue. Section-level filtering, distinct from question-level filtering.
      const root = transformFhirPhysExamToAyu(
        {
          resourceType: 'Questionnaire',
          item: [
            {
              linkId: 'sec-female-only',
              text: 'Pelvis',
              type: 'group',
              extension: [
                {
                  url: 'https://intelehealth.org/fhir/StructureDefinition/gender',
                  valueString: '0', // female-only
                },
              ],
              item: [makeChoiceQuestion({ linkId: 'q1' })],
            },
          ],
        },
        { gender: 'M' }
      );
      expect(root?.item).toEqual([]);
    });

    it('survives a choice question with no answerOption (uses [] fallback)', () => {
      // Covers the `q.answerOption ?? []` fallback in buildPhysExamQuestion
      // when an inner question has no answerOption.
      const root = transformFhirPhysExamToAyu({
        resourceType: 'Questionnaire',
        item: [
          {
            linkId: 'sec',
            text: 'Hands',
            type: 'group',
            item: [
              {
                linkId: 'q-no-options',
                text: 'Bare question',
                type: 'choice',
                // no answerOption
              },
            ],
          },
        ],
      });
      expect(root?.item?.[0]?.answerOption).toEqual([]);
    });

    it('handles a section with no text and no item array', () => {
      // Covers `section.text ?? ''` (titleCasePhysExam(""))
      // and `section.item ?? []` fallback paths inside the for-loop.
      const root = transformFhirPhysExamToAyu({
        resourceType: 'Questionnaire',
        item: [
          {
            linkId: 'sec-bare',
            // no text, no item
            type: 'group',
          },
        ],
      });
      expect(root?.item).toEqual([]);
    });

    /* Flat-sibling pattern: when Tenderness parent and child are section-level
     * siblings (child gated on parent via enableWhen) rather than nested inside
     * a wrapper, nestGatedSiblings groups them so only ONE question is produced
     * with the child attached as a nested item, matching the mobile behaviour. */
    it('groups flat-sibling gated questions into a single question with nested children', () => {
      const root = transformFhirPhysExamToAyu({
        resourceType: 'Questionnaire',
        item: [
          {
            linkId: 'sec-abdomen',
            text: 'Abdomen',
            type: 'group',
            answerOption: [
              { valueCoding: { code: 'tag-1', display: 'Tenderness' } },
              // No concept tag for the gated child — it's not independent
            ],
            item: [
              // Parent question at section level
              {
                linkId: 'tenderness-parent',
                text: 'Is there abdominal tenderness?',
                type: 'choice',
                answerOption: [
                  { valueCoding: { code: 'yes', display: 'Yes' } },
                  { valueCoding: { code: 'no', display: 'No' } },
                ],
              },
              // Child question at section level, gated on the parent
              {
                linkId: 'tenderness-location',
                text: 'Select the location where there is tenderness',
                type: 'choice',
                enableWhen: [
                  {
                    question: 'tenderness-parent',
                    operator: '=',
                    answerCoding: { code: 'yes' },
                  },
                ],
                answerOption: [
                  { valueCoding: { code: 'upper-l', display: 'Upper(L)' } },
                  { valueCoding: { code: 'middle-c', display: 'Middle(C)' } },
                  { valueCoding: { code: 'all-over', display: 'All Over' } },
                ],
              },
            ],
          },
        ],
      });

      // Only ONE top-level question should be produced (not two)
      expect(root?.item).toHaveLength(1);

      const q = root?.item?.[0];
      // The parent's own linkId, text, and options are preserved
      expect(q?.linkId).toBe('tenderness-parent');
      expect(q?.text).toBe('Is there abdominal tenderness?');
      expect(q?.answerOption?.map(o => o.valueCoding?.code)).toEqual([
        'yes',
        'no',
      ]);

      // The gated child is attached as a nested item with enableWhen preserved
      expect(q?.item).toHaveLength(1);
      const child = q?.item?.[0];
      expect(child?.linkId).toBe('tenderness-location');
      expect(child?.text).toBe('Select the location where there is tenderness');
      expect(child?.answerOption?.map(o => o.valueCoding?.code)).toEqual([
        'upper-l',
        'middle-c',
        'all-over',
      ]);
      expect(child?.enableWhen).toEqual([
        {
          question: 'tenderness-parent',
          operator: '=',
          answerCoding: { code: 'yes' },
        },
      ]);

      // Category label uses the concept tag from the parent
      expect(q?.extension).toEqual(
        expect.arrayContaining([
          { url: EXT_URL_PE_SECTION_KEY, valueString: 'Abdomen' },
          { url: EXT_URL_PE_CATEGORY_LABEL, valueString: 'Tenderness' },
          { url: EXT_URL_PE_QUESTION_KEY, valueString: 'Tenderness' },
        ])
      );
    });

    it('nestGatedSiblings is a no-op when all items are already nested (wrapper pattern)', () => {
      // nestGatedSiblings only restructures flat section-level siblings; items
      // already nested inside a wrapper are untouched. The branching detection
      // in findWrappedInnerChoice handles the nested Tenderness shape directly.
      const root = transformFhirPhysExamToAyu({
        resourceType: 'Questionnaire',
        item: [
          {
            linkId: 'sec-abdomen',
            text: 'Abdomen',
            type: 'group',
            item: [
              {
                linkId: 'wrap-tenderness',
                text: 'Tenderness',
                type: 'choice',
                answerOption: [
                  {
                    valueCoding: {
                      code: 'tenderness-cc',
                      display: 'Is there abdominal tenderness?*',
                    },
                  },
                ],
                item: [
                  {
                    linkId: 'no-tenderness',
                    text: 'No tenderness',
                    type: 'string',
                    enableWhen: [
                      {
                        question: 'wrap-tenderness',
                        operator: '=',
                        answerCoding: { code: 'tenderness-cc' },
                      },
                    ],
                  },
                  {
                    linkId: 'tenderness-yes',
                    text: 'Yes',
                    type: 'choice',
                    enableWhen: [
                      {
                        question: 'wrap-tenderness',
                        operator: '=',
                        answerCoding: { code: 'tenderness-cc' },
                      },
                    ],
                    answerOption: [
                      {
                        valueCoding: {
                          code: 'location-cc',
                          display:
                            'Select the location where there is tenderness',
                        },
                      },
                    ],
                    item: [
                      {
                        linkId: 'tenderness-location',
                        text: 'Select the location where there is tenderness',
                        type: 'choice',
                        enableWhen: [
                          {
                            question: 'tenderness-yes',
                            operator: '=',
                            answerCoding: { code: 'location-cc' },
                          },
                        ],
                        answerOption: [
                          {
                            valueCoding: {
                              code: 'upper-l',
                              display: 'Upper(L)',
                            },
                          },
                          {
                            valueCoding: {
                              code: 'middle-c',
                              display: 'Middle(C)',
                            },
                          },
                          {
                            valueCoding: {
                              code: 'all-over',
                              display: 'All Over',
                            },
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });
      // Produces a branching question (same as the primary Tenderness test)
      expect(root?.item).toHaveLength(1);
      expect(root?.item?.[0]?.linkId).toBe('wrap-tenderness');
      expect(root?.item?.[0]?.answerOption?.map(o => o.valueCoding?.code)).toEqual([
        'no-tenderness',
        'tenderness-yes',
      ]);
    });

    it('skips non-attachment children inside the inner question (does not produce a camera option for them)', () => {
      // Covers buildPhysExamCameraOption's `child.type !== 'attachment'` early
      // return path: the inner choice's item[] contains both an attachment
      // (becomes camera) and a non-attachment display child (skipped).
      const root = transformFhirPhysExamToAyu({
        resourceType: 'Questionnaire',
        item: [
          {
            linkId: 'sec-general',
            text: 'General exams',
            type: 'group',
            item: [
              {
                linkId: 'wrap',
                text: 'Wrap',
                type: 'choice',
                answerOption: [
                  { valueCoding: { code: 'inner', display: 'prompt' } },
                ],
                item: [
                  {
                    linkId: 'inner',
                    text: 'Inner',
                    type: 'choice',
                    enableWhen: [
                      {
                        question: 'wrap',
                        operator: '=',
                        answerCoding: { code: 'inner' },
                      },
                    ],
                    answerOption: [
                      { valueCoding: { code: 'yes', display: 'Yes' } },
                    ],
                    item: [
                      // non-attachment FIRST → must NOT contribute a camera option
                      // (covers the `child.type !== 'attachment'` early-return path)
                      {
                        linkId: 'inner_note',
                        type: 'display',
                        text: 'A note',
                      },
                      // attachment → becomes the camera answer option
                      {
                        linkId: 'inner_cam',
                        type: 'attachment',
                        enableWhen: [
                          {
                            question: 'inner',
                            operator: '=',
                            answerCoding: { code: 'CAM' },
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });
      const cameraOptions = root?.item?.[0]?.answerOption?.filter(o =>
        o.extension?.some(e => e.url === EXT_URL_PE_OPTION_KIND)
      );
      // Exactly one camera option — the attachment — and nothing for the
      // display sibling.
      expect(cameraOptions).toHaveLength(1);
    });
  });
});

describe('resolveAyuComponent - physicalExamOptions', () => {
  it('resolves choice questions with PE section-key marker to physicalExamOptions', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      text: 'Jaundice?',
      extension: [{ url: EXT_URL_PE_SECTION_KEY, valueString: 'Hands' }],
    };
    expect(resolveAyuComponent(q)).toBe('physicalExamOptions');
  });

  it('does not trigger physicalExamOptions for plain choice questions', () => {
    const q: AyuQuestion = {
      linkId: 'q1',
      type: 'choice',
      text: 'Jaundice?',
    };
    expect(resolveAyuComponent(q)).toBe('selectableOptionGroup');
  });
});

describe('isMutuallyExclusiveOption - case insensitivity', () => {
  const makeQuestion = (valueString: string): AyuQuestion => ({
    linkId: 'q1',
    type: 'choice',
    answerOption: [
      {
        valueCoding: { code: 'none' },
        extension: [{ url: EXT_URL_MUTUALLY_EXCLUSIVE, valueString }],
      },
    ],
  });

  it('treats valueString="True" as mutually exclusive', () => {
    expect(isMutuallyExclusiveOption(makeQuestion('True'), 'none')).toBe(true);
  });

  it('treats valueString="true" as mutually exclusive (PE FHIR)', () => {
    expect(isMutuallyExclusiveOption(makeQuestion('true'), 'none')).toBe(true);
  });

  it('does not treat valueString="false" as mutually exclusive', () => {
    expect(isMutuallyExclusiveOption(makeQuestion('false'), 'none')).toBe(false);
  });
});
