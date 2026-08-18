import type { QuestionValidationReason } from '../../ayu-library/logic/validation.logic';

// Visit Reason Constants

// --- Confirm Modal ---
export const CONFIRM_MODAL_TITLE = 'Confirm visit reason?';
export const CONFIRM_MODAL_DESCRIPTION =
  'Are you sure the patient has the following reasons for a visit?';
export const CONFIRM_MODAL_YES = 'Yes';
export const CONFIRM_MODAL_NO = 'No';

export const PHYSCAL_EXAM_DESCRIPTION = 'Please wash/sanitize your hands';
export const CONFIRM_MODAL_OK = 'Okay';

/**
 * Asset key for the abdominal region reference image shown alongside
 * the Tenderness question.
 */
export const JOB_AID_ABDOMINAL_REGIONS = 'abdominalregions9';

/** Asset key for the thyroid swelling reference image (Neck section). */
export const JOB_AID_THYROID_SWELLING = 'thyroidswelling';

/**
 * Fallback mapping from PE question key to job-aid asset filename.
 * Used when the FHIR questionnaire does not include a jobAidFile extension.
 * Keys must be **lowercase** — the lookup lowercases the PE_QUESTION_KEY.
 */
export const JOB_AID_FALLBACK: Record<string, string> = {
  tenderness: JOB_AID_ABDOMINAL_REGIONS,
  'thyroid swelling': JOB_AID_THYROID_SWELLING,
};

// --- Selected Reasons ---
export const SELECTED_REASONS_LABEL = 'Selected reasons';
export const REMOVE_REASON_CONFIRM_TITLE = 'Remove visit reason?';
export const REMOVE_REASON_CONFIRM_DESCRIPTION =
  'Removing this reason will clear all answered questions. Do you want to continue?';

// --- All Reasons Heading ---
export const ALL_REASONS_LABEL = 'All reasons';

// --- Search Input ---
export const VISIT_REASON_QUESTION = 'What is the reason for this visit?';
export const VISIT_REASON_HINT =
  'Search a symptom or pick from the most common reasons.';
export const SEARCH_PLACEHOLDER = 'Type or select reason eg. Fever';
export const NO_MATCHING_COMPLAINTS = 'No matching complaints found';
export const MAX_FILTERED_RESULTS = 8;

// --- Breadcrumb Status ---
export const BREADCRUMB_STATUS_PENDING = 'pending' as const;

// --- Footer ---
export const BUTTON_BACK = 'Back';
export const BUTTON_CONFIRM = 'Confirm';
export const BUTTON_START_ASSESSMENT = 'Start Assessment';
export const BUTTON_SAVE_NEXT = 'Save & Next';

// --- Stepper ---
export const BUTTON_SUBMIT = 'Submit';
export const BUTTON_UPLOAD = 'Upload';
export const BUTTON_SKIP = 'Skip';
export const VALIDATION_ALL_COMPULSORY =
  'All questions are compulsory, please answer';
export const VALIDATION_ENTER_VALUE = 'Please enter a value';
export const VALIDATION_SELECT_OPTION = 'Please select any one option';
export const VALIDATION_UPLOAD_IMAGE = 'Please upload at least one image';
export const VALIDATION_UPLOAD_CAPTURED_IMAGE =
  'Please upload the captured image';

export const validationMessageForReason = (
  reason: QuestionValidationReason | undefined,
  questionNumber?: number
): string => {
  let message: string;
  switch (reason) {
    case 'uploadImage':
    case 'uploadCapturedImage':
      message = VALIDATION_UPLOAD_CAPTURED_IMAGE;
      break;
    case 'allCompulsory':
      message = VALIDATION_ALL_COMPULSORY;
      break;
    case 'enterValue':
      message = VALIDATION_ENTER_VALUE;
      break;
    default:
      message = VALIDATION_SELECT_OPTION;
  }
  if (questionNumber) {
    if (reason === 'uploadCapturedImage' || reason === 'uploadImage') {
      return `Question ${questionNumber}: ${message}`;
    }
    return `Please answer Question ${questionNumber} before proceeding`;
  }
  return message;
};

// --- Physical Exam Camera ---
export const PE_CAMERA_TILE_LABEL = 'Take a Picture';
export const PE_PICTURE_TAKEN_LABEL = 'Picture Taken';
export const PE_DEFAULT_IMAGE_LABEL = 'Physical Exam';
export const PE_DEFAULT_SECTION_LABEL = 'General Exams';
export const PE_LOADING_TEXT = 'Loading physical exam...';
export const PE_CONFIG_NAME = 'physExam';

// --- Temp Storage Keys ---
export const RESOURCE_TYPE_VISIT = 'visit';
export const RESOURCE_TYPE_ASSET = 'asset';
export const BLOB_URL_PREFIX = 'blob:';
export const DEFAULT_CREATED_BY = 'unknown';

// --- Summary Modal ---
export const SUMMARY_ITEM_TYPE_LABEL_VALUE = 'labelValue';
export const FHIR_RESOURCE_TYPE_QUESTIONNAIRE = 'Questionnaire';
export const STEPPER_SKIPPED_LABEL = 'Skipped';

// FHIR Stepper Constants
export const DEFAULT_VISIT_REASON_TEXT = 'Visit reason';
export const ASSOCIATED_SYMPTOMS_LABEL = 'Associated symptoms';
export const VISIT_REASON_SUMMARY_TITLE = '2/4. Visit reason summary';
export const PHYSICAL_EXAM_SUMMARY_TITLE = '3/4. Physical examination summary';
export const MEDICAL_HISTORY_SUMMARY_TITLE = '4/4. Medical history summary';
export const SUMMARY_CONFIRM_TEXT = 'Confirm';
export const SUMMARY_CANCEL_TEXT = 'Back';

// Visit Reasons Hook
export const AYU_JSON_KEY_NAME = 'IDA6';

// Text Input
export const ADDITIONAL_INFORMATION_LABEL = 'Additional information';
export const TEXT_INPUT_DEFAULT_PLACEHOLDER = 'Describe...';
export const TEXT_INPUT_KEYWORD_DESCRIBE = 'describe';
export const TEXT_INPUT_KEYWORD_OTHER = 'other';
export const TEXT_INPUT_ENTER_PREFIX = 'Enter';
export const TEXT_INPUT_DEFAULT_KEYWORDS = [
  TEXT_INPUT_KEYWORD_DESCRIBE,
  TEXT_INPUT_KEYWORD_OTHER,
  ADDITIONAL_INFORMATION_LABEL.toLowerCase(),
];

// Validation
export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Item Types
export const ITEM_TYPES = {
  GROUP: 'group',
  LABEL_VALUE: 'labelValue',
  SUBHEADING: 'subheading',
} as const;

// Start Visit Section Names
export const SECTION_VITALS = 'Vitals';
export const SECTION_VISIT_REASON = 'Visit Reason';
export const SECTION_PHYSICAL_EXAM = 'Physical Examination';
export const SECTION_MEDICAL_HISTORY = 'Medical History';

// Patient Storage Keys
export const PATIENT_NAME_KEY = 'patientName';
export const PATIENT_AGE_KEY = 'patientAge';
export const PATIENT_GENDER_KEY = 'patientGender';
export const PATIENT_UUID_KEY = 'patientUuid';

// Frequency Input
export const FREQUENCY_DEFAULT_MIN = 0;
export const FREQUENCY_DEFAULT_MAX = 10;
export const FREQUENCY_HINT_TEMPLATE = 'Drag anywhere from {min} to {max}';
export const FREQUENCY_LEVEL_LABEL = 'Level';

/*
 * SVG mouth paths indexed 0 (happiest) → 9 (most distressed).
 * Each path is rendered inside the FaceIcon's 22x22 viewBox.
 */
export const FREQUENCY_FACE_MOUTH_PATHS = [
  'M7 13 Q11 17 15 13',
  'M7 13 Q11 16 15 13',
  'M7 13.5 Q11 15.5 15 13.5',
  'M7 13.5 Q11 14.5 15 13.5',
  'M7 14 H15',
  'M7 14 Q11 13.5 15 14',
  'M7 14.5 Q11 13 15 14.5',
  'M7 15 Q11 12 15 15',
  'M7 16 Q11 11 15 16',
  'M7 16.5 Q11 10.5 15 16.5',
] as const;

export type FrequencyEyeStyle = 'closed' | 'normal' | 'cross';

/*
 * Eye style for each face level. Aligned 1:1 with FREQUENCY_FACE_MOUTH_PATHS.
 * Level 0 squints with joy, level 9 has crossed-out eyes.
 */
export const FREQUENCY_FACE_EYE_VARIANTS: readonly FrequencyEyeStyle[] = [
  'closed',
  'normal',
  'normal',
  'normal',
  'normal',
  'normal',
  'normal',
  'normal',
  'normal',
  'cross',
];

// Number Input
export const NUMBER_INPUT_DEFAULT_MIN = 0;

// Range Input
export const RANGE_DEFAULT_MIN = 0;
export const RANGE_DEFAULT_MAX = 100;
export const RANGE_HINT_TEMPLATE = 'Drag two capture range from {min} to {max}';
export const RANGE_TO_LABEL = 'To';

// "Exit Assessment?" confirmation shown when leaving an in-progress visit.
export const EXIT_ASSESSMENT_MODAL = {
  TITLE: 'Exit Assessment?',
  DESCRIPTION: 'Your progress has been saved. You can continue later.',
  EXIT: 'Exit',
  CONTINUE: 'Continue Assessment',
} as const;
