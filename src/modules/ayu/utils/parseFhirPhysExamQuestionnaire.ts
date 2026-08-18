import type {
  PhysicalExamOption,
  PhysicalExamQuestion,
} from '../types/physical-exam.types';

const IH_EXT = 'https://intelehealth.org/fhir/StructureDefinition';
const IH_EXT_LANGUAGE = `${IH_EXT}/language`;
const IH_EXT_JOB_AID_TYPE = `${IH_EXT}/job-aid-type`;
const IH_EXT_JOB_AID_FILE = `${IH_EXT}/job-aid-file`;
const IH_EXT_IS_EXCLUSIVE = `${IH_EXT}/is-exclusive-option`;
const IH_EXT_EXCLUDE_FROM_MULTI = `${IH_EXT}/exclude-from-multi-choice`;
const FHIR_ITEM_CONTROL_EXT =
  'http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl';

interface FhirCoding {
  system?: string;
  code: string;
  display?: string;
}

interface FhirExtension {
  url: string;
  valueString?: string;
  valueCode?: string;
  valueBoolean?: boolean;
  valueCodeableConcept?: { coding?: FhirCoding[] };
  extension?: FhirExtension[];
}

interface FhirAnswerOption {
  linkId?: string;
  valueCoding?: FhirCoding;
  extension?: FhirExtension[];
}

interface FhirEnableWhen {
  question: string;
  operator: string;
  answerCoding?: FhirCoding;
}

interface FhirItem {
  linkId: string;
  text?: string;
  type?: string;
  required?: boolean;
  repeats?: boolean;
  extension?: FhirExtension[];
  _text?: { extension?: FhirExtension[] };
  answerOption?: FhirAnswerOption[];
  item?: FhirItem[];
  enableWhen?: FhirEnableWhen[];
}

export interface FhirQuestionnaire {
  resourceType?: string;
  id?: string;
  title?: string;
  item?: FhirItem[];
}

const findExt = (
  exts: FhirExtension[] | undefined,
  url: string
): FhirExtension | undefined => exts?.find(e => e.url === url);

const titleCase = (s: string): string =>
  s
    .split(' ')
    .map(w => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');

const isCheckBox = (item: FhirItem): boolean => {
  const ext = findExt(item.extension, FHIR_ITEM_CONTROL_EXT);
  return (
    ext?.valueCodeableConcept?.coding?.some(c => c.code === 'check-box') ??
    false
  );
};

const stripTrailingAsterisk = (s: string): string =>
  s.replace(/\*+$/, '').trim();

const buildAnswerOption = (
  opt: FhirAnswerOption
): PhysicalExamOption | null => {
  if (!opt.valueCoding?.code) return null;
  const isExclusive =
    findExt(opt.extension, IH_EXT_IS_EXCLUSIVE)?.valueString === 'true';
  const excludeFromMulti =
    findExt(opt.extension, IH_EXT_EXCLUDE_FROM_MULTI)?.valueString === 'true';
  return {
    id: opt.valueCoding.code,
    text: opt.valueCoding.display ?? '',
    ...(isExclusive ? { isExclusiveOption: true } : {}),
    ...(excludeFromMulti ? { excludeFromMulti: true } : {}),
  };
};

const buildCameraOption = (item: FhirItem): PhysicalExamOption | null => {
  if (item.type !== 'attachment') return null;
  const langExt = findExt(item.extension, IH_EXT_LANGUAGE);
  const isExclusive =
    findExt(item.extension, IH_EXT_IS_EXCLUSIVE)?.valueString === 'true';
  /* Camera answer code = the attachment's own linkId. The former
   * `enableWhen[0].answerCoding.code` collided with the Yes/No option codes
   * (cameras are gated on those via enableBehavior "any"), so a captured
   * picture saved "No" instead of "Picture Taken". Must match the render-side
   * `buildPhysExamCameraOption`. */
  const id = item.linkId;
  const text =
    langExt?.valueString && langExt.valueString !== '%'
      ? langExt.valueString
      : (item.text ?? 'Take a picture');
  return {
    id,
    text,
    isCamera: true,
    ...(isExclusive ? { isExclusiveOption: true } : {}),
  };
};

/**
 * Convert a FHIR Questionnaire describing the physical exam into the flat
 * PhysicalExamQuestion[] shape the app consumes.
 *
 * Tree structure (FHIR):
 *   Questionnaire.item[]                  → sections (top-level groups)
 *     section.answerOption[]              → concept-tag index for the section
 *                                           (display becomes questionKey, matched
 *                                            against the protocol perform-physical-exam
 *                                            filter, e.g. "Hands:Nails cyanosis")
 *     section.item[] (type=choice)        → individual questions
 *       question.answerOption[]           → answer options
 *       question.item[] (type=attachment) → optional camera option
 */
export function parseFhirPhysExamQuestionnaire(
  raw: FhirQuestionnaire
): PhysicalExamQuestion[] {
  const questions: PhysicalExamQuestion[] = [];

  for (const section of raw.item ?? []) {
    const sectionText = section.text ?? '';
    const sectionKey = titleCase(sectionText);
    const langExt = findExt(section.extension, IH_EXT_LANGUAGE);
    const sectionLabel =
      langExt?.valueString && langExt.valueString !== '%'
        ? langExt.valueString
        : `${sectionKey}:`;

    const conceptTags = (section.answerOption ?? [])
      .map(o => o.valueCoding?.display)
      .filter((d): d is string => typeof d === 'string');

    const choiceItems = (section.item ?? []).filter(i => i.type === 'choice');

    choiceItems.forEach((q, idx) => {
      const questionText = stripTrailingAsterisk(q.text ?? '');
      const conceptTag = conceptTags[idx];
      const categoryLabel = conceptTag ?? questionText;
      const questionKey = conceptTag ?? questionText;

      const isRequired = q.required === true;
      const isMultiChoice = isCheckBox(q);

      // Check FHIR extensions first, then fall back to legacy direct
      // properties (`job-aid-type`, `job-aid-file`) that some server builds
      // still emit as top-level JSON keys instead of FHIR extensions.
      const raw = q as unknown as Record<string, unknown>;
      const jobAidTypeRaw =
        findExt(q.extension, IH_EXT_JOB_AID_TYPE)?.valueString ??
        (typeof raw['job-aid-type'] === 'string'
          ? raw['job-aid-type']
          : undefined);
      const jobAidType =
        jobAidTypeRaw === 'image' || jobAidTypeRaw === 'video'
          ? jobAidTypeRaw
          : undefined;
      const jobAidFile =
        findExt(q.extension, IH_EXT_JOB_AID_FILE)?.valueString ??
        (typeof raw['job-aid-file'] === 'string'
          ? raw['job-aid-file']
          : undefined);

      const options: PhysicalExamOption[] = [];
      for (const ao of q.answerOption ?? []) {
        const opt = buildAnswerOption(ao);
        if (opt) options.push(opt);
      }
      for (const child of q.item ?? []) {
        const cam = buildCameraOption(child);
        if (cam) options.push(cam);
      }

      questions.push({
        id: q.linkId,
        sectionLabel,
        categoryLabel,
        questionText,
        isRequired,
        isMultiChoice,
        ...(jobAidType ? { jobAidType } : {}),
        ...(jobAidFile ? { jobAidFile } : {}),
        options,
        sectionKey,
        questionKey,
      });
    });
  }

  return questions;
}
