import type { DropdownOption } from '../types/dropdown.types';

// ========================
// FHIR Extension URLs
// ========================
export const EXT_URL_ORIGINAL_QUESTION_TEXT =
  'urn:intelehealth:original-question-text';
export const EXT_URL_MUTUALLY_EXCLUSIVE =
  'https://intelehealth.org/fhir/StructureDefinition/exclude-from-multi-choice';

export const EXT_URL_DISPLAY_TEXT =
  'https://intelehealth.org/fhir/StructureDefinition/display';

export const EXT_URL_LANGUGAE_TEXT =
  'https://intelehealth.org/fhir/StructureDefinition/language';

/**
 * As discussed with Priya, There is no standard data element available for these attributes in HL7. These URLs will be generated in our IG (implementation guide) when we create for interoperability with other systems.
 */
export const EXT_URL_GENDER =
  'https://intelehealth.org/fhir/StructureDefinition/gender';
export const EXT_URL_AGE_MIN =
  'https://intelehealth.org/fhir/StructureDefinition/age-min';
export const EXT_URL_AGE_MAX =
  'https://intelehealth.org/fhir/StructureDefinition/age-max';

export const EXT_URL_MIN_VALUE =
  'http://hl7.org/fhir/StructureDefinition/minValue';
export const EXT_URL_MAX_VALUE =
  'http://hl7.org/fhir/StructureDefinition/maxValue';

// FHIR core itemControl extension (e.g. check-box = multi-choice in PE)
export const EXT_URL_ITEM_CONTROL =
  'http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl';

// Physical Examination FHIR extensions
export const EXT_URL_JOB_AID_TYPE =
  'https://intelehealth.org/fhir/StructureDefinition/job-aid-type';
export const EXT_URL_JOB_AID_FILE =
  'https://intelehealth.org/fhir/StructureDefinition/job-aid-file';
export const EXT_URL_IS_EXCLUSIVE_OPTION =
  'https://intelehealth.org/fhir/StructureDefinition/is-exclusive-option';

/*
 * Protocol-level extension that carries the perform-physical-exam filter string
 * ("Section:Question;Section:Question;..."). Protocols served from the API use
 * the canonical https form; the legacy urn form is still accepted for backward
 * compatibility with older protocol JSON.
 */
export const EXT_URL_PERFORM_PHYSICAL_EXAM =
  'https://intelehealth.org/fhir/StructureDefinition/performPhysicalExam';
export const EXT_URL_PERFORM_PHYSICAL_EXAM_LEGACY =
  'urn:intelehealth:perform-physical-exam';

// Physical Examination markers attached by transformFhirPhysExamToAyu so the
// resolver/renderer can tell PE questions apart from Visit Reason ones.
export const EXT_URL_PE_SECTION_KEY =
  'urn:intelehealth:physical-exam/section-key';
export const EXT_URL_PE_CATEGORY_LABEL =
  'urn:intelehealth:physical-exam/category-label';
export const EXT_URL_PE_QUESTION_KEY =
  'urn:intelehealth:physical-exam/question-key';
export const EXT_URL_PE_OPTION_KIND =
  'urn:intelehealth:physical-exam/option-kind';
export const PE_OPTION_KIND_CAMERA = 'camera';

/* physExam.json sometimes carries a sentinel answerOption whose `language`
 * extension equals this marker. It is NOT a user-facing choice — it is a
 * proxy that pairs with an attachment child for image capture. The
 * transform drops these so the camera tile (built from the attachment)
 * is the only rendering surface for that semantic. */
export const PE_OPTION_LANG_MARKER_PICTURE_TAKEN = '[picture taken]';

/*
 * Threshold that distinguishes a Frequency (occurrences) from a Range
 * component when both share the same FHIR shape (integer + minValue/maxValue).
 */
export const FREQUENCY_MAX_VALUE = 10;

// Gender extension valueString codes
export const GENDER_CODE_FEMALE = '0';
export const GENDER_CODE_MALE = '1';
export const GENDER_CODE_OTHER = 'other';

// ========================
// FHIR Question Types
// ========================
export const FHIR_TYPE_CHOICE = 'choice';
export const FHIR_TYPE_STRING = 'string';
export const FHIR_TYPE_INTEGER = 'integer';
export const FHIR_TYPE_DATE = 'date';
export const FHIR_TYPE_QUANTITY = 'quantity';
export const FHIR_TYPE_ATTACHMENT = 'attachment';
export const FHIR_TYPE_DISPLAY = 'display';
export const FHIR_TYPE_GROUP = 'group';

// ========================
// Associated Symptoms
// ========================
export const ASSOCIATED_SYMPTOMS_TEXT = 'Associated symptoms';
export const NEGATED_PREFIX = 'NO_';
export const NEGATED_ID_PREFIX = 'NO_ID_';

// ========================
// Visit Summary Labels
// ========================
export const PATIENT_REPORTS_LABEL = 'Patient reports';
export const PATIENT_DENIES_LABEL = 'Patient denies';

// Nested question helper text
export const SELECT_ONE_OR_MORE = 'Select one or more';
export const SELECT_ANY_ONE = 'Select any one';
export const SELECT_YES_OR_NO = 'Select yes or no';

//JSON name list to exclude to display on visit reason selection
export const EXCLUDED_JSON_NAMES = ['famHist', 'physExam', 'patHist'];
export interface AyuDurationConfig {
  dropdowns?: {
    id: string;
    placeholder?: string;
    options: DropdownOption[];
  }[];
}

// Generate number options from 1 to 100
const generateNumberOptions = (
  start: number,
  end: number
): DropdownOption[] => {
  return Array.from({ length: end - start + 1 }, (_, i) => ({
    label: String(start + i),
    value: start + i,
  }));
};

export const DURATION_DROPDOWN_CONFIGS: AyuDurationConfig['dropdowns'] = [
  {
    id: 'number',
    placeholder: 'Number',
    options: generateNumberOptions(1, 100),
  },
  {
    id: 'days',
    placeholder: 'Duration Type',
    options: [
      { label: 'Hours', value: 'hours' },
      { label: 'Days', value: 'days' },
      { label: 'Weeks', value: 'weeks' },
      { label: 'Months', value: 'months' },
      { label: 'Years', value: 'years' },
    ],
  },
];
