import { describe, expect, it } from 'vitest';
import {
  parseFhirPhysExamQuestionnaire,
  type FhirQuestionnaire,
} from '../../../../modules/ayu/utils/parseFhirPhysExamQuestionnaire';

const IH_EXT = 'https://intelehealth.org/fhir/StructureDefinition';

describe('parseFhirPhysExamQuestionnaire', () => {
  it('returns empty array when item is missing', () => {
    expect(parseFhirPhysExamQuestionnaire({})).toEqual([]);
  });

  it('returns empty array when section has no questions', () => {
    const raw: FhirQuestionnaire = {
      resourceType: 'Questionnaire',
      item: [{ linkId: 's1', text: 'Hands', type: 'group' }],
    };
    expect(parseFhirPhysExamQuestionnaire(raw)).toEqual([]);
  });

  it('flattens a section + question into a PhysicalExamQuestion', () => {
    const raw: FhirQuestionnaire = {
      resourceType: 'Questionnaire',
      item: [
        {
          linkId: 's1',
          text: 'general exams',
          type: 'group',
          extension: [{ url: `${IH_EXT}/language`, valueString: 'General Exams:' }],
          answerOption: [
            {
              valueCoding: { code: 'jaundice-tag', display: 'Eyes: Jaundice' },
            },
          ],
          item: [
            {
              linkId: 'q1',
              text: 'Is there jaundice?*',
              type: 'choice',
              required: true,
              answerOption: [
                { valueCoding: { code: 'no', display: 'No' } },
                { valueCoding: { code: 'yes', display: 'Yes' } },
              ],
            },
          ],
        },
      ],
    };
    const result = parseFhirPhysExamQuestionnaire(raw);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'q1',
      sectionLabel: 'General Exams:',
      categoryLabel: 'Eyes: Jaundice',
      questionText: 'Is there jaundice?',
      isRequired: true,
      isMultiChoice: false,
      options: [
        { id: 'no', text: 'No' },
        { id: 'yes', text: 'Yes' },
      ],
      sectionKey: 'General Exams',
      questionKey: 'Eyes: Jaundice',
    });
  });

  it('falls back to question text when section has no concept-tag answerOption[]', () => {
    const raw: FhirQuestionnaire = {
      resourceType: 'Questionnaire',
      item: [
        {
          linkId: 's1',
          text: 'Hands',
          type: 'group',
          item: [
            {
              linkId: 'q1',
              text: 'Are nails cyanotic?*',
              type: 'choice',
              answerOption: [{ valueCoding: { code: 'no', display: 'No' } }],
            },
          ],
        },
      ],
    };
    const result = parseFhirPhysExamQuestionnaire(raw);
    expect(result[0].sectionKey).toBe('Hands');
    expect(result[0].sectionLabel).toBe('Hands:');
    expect(result[0].categoryLabel).toBe('Are nails cyanotic?');
    expect(result[0].questionKey).toBe('Are nails cyanotic?');
  });

  it('matches concept tags to questions by index', () => {
    const raw: FhirQuestionnaire = {
      resourceType: 'Questionnaire',
      item: [
        {
          linkId: 's1',
          text: 'Hands',
          type: 'group',
          answerOption: [
            { valueCoding: { code: 't1', display: 'Nails cyanosis' } },
            { valueCoding: { code: 't2', display: 'Nails clubbing' } },
          ],
          item: [
            {
              linkId: 'q1',
              text: 'Cyanosis check?',
              type: 'choice',
              answerOption: [{ valueCoding: { code: 'a', display: 'No' } }],
            },
            {
              linkId: 'q2',
              text: 'Clubbing check?',
              type: 'choice',
              answerOption: [{ valueCoding: { code: 'b', display: 'No' } }],
            },
          ],
        },
      ],
    };
    const result = parseFhirPhysExamQuestionnaire(raw);
    expect(result.map(q => q.questionKey)).toEqual([
      'Nails cyanosis',
      'Nails clubbing',
    ]);
  });

  it('detects check-box itemControl as multi-choice', () => {
    const raw: FhirQuestionnaire = {
      resourceType: 'Questionnaire',
      item: [
        {
          linkId: 's1',
          text: 'Hands',
          type: 'group',
          item: [
            {
              linkId: 'q1',
              text: 'Multi check',
              type: 'choice',
              extension: [
                {
                  url: 'http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl',
                  valueCodeableConcept: {
                    coding: [
                      {
                        system: 'http://hl7.org/fhir/questionnaire-item-control',
                        code: 'check-box',
                      },
                    ],
                  },
                },
              ],
              answerOption: [{ valueCoding: { code: 'a', display: 'A' } }],
            },
          ],
        },
      ],
    };
    expect(parseFhirPhysExamQuestionnaire(raw)[0].isMultiChoice).toBe(true);
  });

  it('extracts job aid extensions on the question', () => {
    const raw: FhirQuestionnaire = {
      resourceType: 'Questionnaire',
      item: [
        {
          linkId: 's1',
          text: 'Hands',
          type: 'group',
          item: [
            {
              linkId: 'q1',
              text: 'With aid',
              type: 'choice',
              extension: [
                { url: `${IH_EXT}/job-aid-type`, valueString: 'video' },
                { url: `${IH_EXT}/job-aid-file`, valueString: 'demo' },
              ],
              answerOption: [{ valueCoding: { code: 'a', display: 'A' } }],
            },
          ],
        },
      ],
    };
    const q = parseFhirPhysExamQuestionnaire(raw)[0];
    expect(q.jobAidType).toBe('video');
    expect(q.jobAidFile).toBe('demo');
  });

  it('reads job-aid from legacy direct properties when extensions are absent', () => {
    const raw: FhirQuestionnaire = {
      resourceType: 'Questionnaire',
      item: [
        {
          linkId: 's1',
          text: 'Abdomen',
          type: 'group',
          item: [
            {
              linkId: 'q1',
              text: 'Tenderness',
              type: 'choice',
              // Legacy direct properties instead of FHIR extensions
              'job-aid-type': 'image',
              'job-aid-file': 'abdominalregions9',
              answerOption: [{ valueCoding: { code: 'a', display: 'A' } }],
            } as never,
          ],
        },
      ],
    };
    const q = parseFhirPhysExamQuestionnaire(raw)[0];
    expect(q.jobAidType).toBe('image');
    expect(q.jobAidFile).toBe('abdominalregions9');
  });

  it('ignores invalid job-aid-type values', () => {
    const raw: FhirQuestionnaire = {
      resourceType: 'Questionnaire',
      item: [
        {
          linkId: 's1',
          text: 'Hands',
          type: 'group',
          item: [
            {
              linkId: 'q1',
              text: 'X',
              type: 'choice',
              extension: [
                { url: `${IH_EXT}/job-aid-type`, valueString: 'pdf' },
              ],
              answerOption: [{ valueCoding: { code: 'a', display: 'A' } }],
            },
          ],
        },
      ],
    };
    expect(parseFhirPhysExamQuestionnaire(raw)[0].jobAidType).toBeUndefined();
  });

  it('appends a camera option from a nested attachment item', () => {
    const raw: FhirQuestionnaire = {
      resourceType: 'Questionnaire',
      item: [
        {
          linkId: 's1',
          text: 'Hands',
          type: 'group',
          item: [
            {
              linkId: 'q1',
              text: 'Q',
              type: 'choice',
              answerOption: [{ valueCoding: { code: 'no', display: 'No' } }],
              item: [
                {
                  linkId: 'q1_cam',
                  text: 'Take a picture',
                  type: 'attachment',
                  enableWhen: [
                    {
                      question: 'q1',
                      operator: '=',
                      answerCoding: { code: 'cam-trigger' },
                    },
                  ],
                  extension: [
                    {
                      url: `${IH_EXT}/is-exclusive-option`,
                      valueString: 'true',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const q = parseFhirPhysExamQuestionnaire(raw)[0];
    // Camera id is the attachment's linkId (unique), not the enableWhen
    // trigger code — so it can't collide with a real Yes/No option code.
    expect(q.options).toEqual([
      { id: 'no', text: 'No' },
      {
        id: 'q1_cam',
        text: 'Take a picture',
        isCamera: true,
        isExclusiveOption: true,
      },
    ]);
  });

  it('skips non-choice items inside a section', () => {
    const raw: FhirQuestionnaire = {
      resourceType: 'Questionnaire',
      item: [
        {
          linkId: 's1',
          text: 'Hands',
          type: 'group',
          item: [
            { linkId: 'note', text: 'Note', type: 'display' },
            {
              linkId: 'q1',
              text: 'Real',
              type: 'choice',
              answerOption: [{ valueCoding: { code: 'a', display: 'A' } }],
            },
          ],
        },
      ],
    };
    const result = parseFhirPhysExamQuestionnaire(raw);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('q1');
  });

  it('reads exclusive/exclude flags off individual answerOption extensions', () => {
    const raw: FhirQuestionnaire = {
      resourceType: 'Questionnaire',
      item: [
        {
          linkId: 's1',
          text: 'Hands',
          type: 'group',
          item: [
            {
              linkId: 'q1',
              text: 'Q',
              type: 'choice',
              answerOption: [
                {
                  valueCoding: { code: 'normal', display: 'Normal' },
                  extension: [
                    {
                      url: `${IH_EXT}/exclude-from-multi-choice`,
                      valueString: 'true',
                    },
                  ],
                },
                {
                  valueCoding: { code: 'none', display: 'None of the above' },
                  extension: [
                    {
                      url: `${IH_EXT}/is-exclusive-option`,
                      valueString: 'true',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(parseFhirPhysExamQuestionnaire(raw)[0].options).toEqual([
      { id: 'normal', text: 'Normal', excludeFromMulti: true },
      { id: 'none', text: 'None of the above', isExclusiveOption: true },
    ]);
  });

  it('falls back to "${sectionKey}:" when language extension is "%" or missing', () => {
    const raw: FhirQuestionnaire = {
      resourceType: 'Questionnaire',
      item: [
        {
          linkId: 's1',
          text: 'hands',
          type: 'group',
          extension: [{ url: `${IH_EXT}/language`, valueString: '%' }],
          item: [
            {
              linkId: 'q1',
              text: 'Q',
              type: 'choice',
              answerOption: [{ valueCoding: { code: 'a', display: 'A' } }],
            },
          ],
        },
      ],
    };
    expect(parseFhirPhysExamQuestionnaire(raw)[0].sectionLabel).toBe('Hands:');
    expect(parseFhirPhysExamQuestionnaire(raw)[0].sectionKey).toBe('Hands');
  });

  it('preserves empty words from consecutive spaces when title-casing section text', () => {
    const raw: FhirQuestionnaire = {
      resourceType: 'Questionnaire',
      item: [
        {
          linkId: 's1',
          text: 'general  exams',
          type: 'group',
          item: [
            {
              linkId: 'q1',
              text: 'Q',
              type: 'choice',
              answerOption: [{ valueCoding: { code: 'a', display: 'A' } }],
            },
          ],
        },
      ],
    };
    expect(parseFhirPhysExamQuestionnaire(raw)[0].sectionKey).toBe(
      'General  Exams'
    );
  });

  it('drops answerOption entries that have no code', () => {
    const raw: FhirQuestionnaire = {
      resourceType: 'Questionnaire',
      item: [
        {
          linkId: 's1',
          text: 'Hands',
          type: 'group',
          item: [
            {
              linkId: 'q1',
              text: 'Q',
              type: 'choice',
              answerOption: [
                { valueCoding: { code: '', display: 'Empty' } },
                { valueCoding: { code: 'ok', display: 'OK' } },
              ],
            },
          ],
        },
      ],
    };
    expect(parseFhirPhysExamQuestionnaire(raw)[0].options).toEqual([
      { id: 'ok', text: 'OK' },
    ]);
  });

  it('uses empty string when answerOption has no display', () => {
    const raw: FhirQuestionnaire = {
      resourceType: 'Questionnaire',
      item: [
        {
          linkId: 's1',
          text: 'Hands',
          type: 'group',
          item: [
            {
              linkId: 'q1',
              text: 'Q',
              type: 'choice',
              answerOption: [{ valueCoding: { code: 'x' } }],
            },
          ],
        },
      ],
    };
    expect(parseFhirPhysExamQuestionnaire(raw)[0].options).toEqual([
      { id: 'x', text: '' },
    ]);
  });

  it('skips non-attachment items inside a question', () => {
    const raw: FhirQuestionnaire = {
      resourceType: 'Questionnaire',
      item: [
        {
          linkId: 's1',
          text: 'Hands',
          type: 'group',
          item: [
            {
              linkId: 'q1',
              text: 'Q',
              type: 'choice',
              answerOption: [{ valueCoding: { code: 'a', display: 'A' } }],
              item: [
                { linkId: 'q1_note', text: 'Note', type: 'display' },
              ],
            },
          ],
        },
      ],
    };
    expect(parseFhirPhysExamQuestionnaire(raw)[0].options).toEqual([
      { id: 'a', text: 'A' },
    ]);
  });

  it('uses camera language extension as text when present and not "%"', () => {
    const raw: FhirQuestionnaire = {
      resourceType: 'Questionnaire',
      item: [
        {
          linkId: 's1',
          text: 'Hands',
          type: 'group',
          item: [
            {
              linkId: 'q1',
              text: 'Q',
              type: 'choice',
              answerOption: [{ valueCoding: { code: 'a', display: 'A' } }],
              item: [
                {
                  linkId: 'cam',
                  text: 'Take a picture',
                  type: 'attachment',
                  extension: [
                    {
                      url: `${IH_EXT}/language`,
                      valueString: '[picture taken]',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const cam = parseFhirPhysExamQuestionnaire(raw)[0].options.find(
      o => o.isCamera
    );
    expect(cam?.text).toBe('[picture taken]');
    expect(cam?.id).toBe('cam');
    expect(cam?.isExclusiveOption).toBeUndefined();
  });

  it('falls back to camera item.text when language extension is "%"', () => {
    const raw: FhirQuestionnaire = {
      resourceType: 'Questionnaire',
      item: [
        {
          linkId: 's1',
          text: 'Hands',
          type: 'group',
          item: [
            {
              linkId: 'q1',
              text: 'Q',
              type: 'choice',
              answerOption: [{ valueCoding: { code: 'a', display: 'A' } }],
              item: [
                {
                  linkId: 'cam',
                  text: 'Take a picture',
                  type: 'attachment',
                  extension: [
                    { url: `${IH_EXT}/language`, valueString: '%' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(
      parseFhirPhysExamQuestionnaire(raw)[0].options.find(o => o.isCamera)
        ?.text
    ).toBe('Take a picture');
  });

  it('falls back to "Take a picture" when camera has no text and no language', () => {
    const raw: FhirQuestionnaire = {
      resourceType: 'Questionnaire',
      item: [
        {
          linkId: 's1',
          text: 'Hands',
          type: 'group',
          item: [
            {
              linkId: 'q1',
              text: 'Q',
              type: 'choice',
              answerOption: [{ valueCoding: { code: 'a', display: 'A' } }],
              item: [{ linkId: 'cam', type: 'attachment' }],
            },
          ],
        },
      ],
    };
    const cam = parseFhirPhysExamQuestionnaire(raw)[0].options.find(
      o => o.isCamera
    );
    expect(cam?.text).toBe('Take a picture');
    expect(cam?.id).toBe('cam');
  });

  it('handles section with no text and question with no text', () => {
    const raw: FhirQuestionnaire = {
      resourceType: 'Questionnaire',
      item: [
        {
          linkId: 's1',
          type: 'group',
          item: [
            {
              linkId: 'q1',
              type: 'choice',
              answerOption: [{ valueCoding: { code: 'a', display: 'A' } }],
            },
          ],
        },
      ],
    };
    const q = parseFhirPhysExamQuestionnaire(raw)[0];
    expect(q.sectionKey).toBe('');
    expect(q.sectionLabel).toBe(':');
    expect(q.questionText).toBe('');
    expect(q.questionKey).toBe('');
  });

  it('handles question without answerOption', () => {
    const raw: FhirQuestionnaire = {
      resourceType: 'Questionnaire',
      item: [
        {
          linkId: 's1',
          text: 'Hands',
          type: 'group',
          item: [{ linkId: 'q1', text: 'Q', type: 'choice' }],
        },
      ],
    };
    expect(parseFhirPhysExamQuestionnaire(raw)[0].options).toEqual([]);
  });
});
