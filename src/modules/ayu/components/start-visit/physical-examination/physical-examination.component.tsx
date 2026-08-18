import { useCallback, useMemo, useRef, useState } from 'react';
import iconPhysicalExam from '../../../../../assets/icons/icon-physical-examination.svg';
import type { ModalSection } from '../../../../../components/modal/global-modal-context';
import { useGlobalModal } from '../../../../../components/modal/global-modal-context';
import type {
  AyuAnswerValue,
  AyuQuestion,
} from '../../../../ayu-library/types/ayu.types';
import { evaluateEnableWhen } from '../../../../ayu-library';
import type { SectionProps } from '../../../../ayu-library/types/start-visit.types';
import {
  EXT_URL_JOB_AID_FILE,
  EXT_URL_JOB_AID_TYPE,
  EXT_URL_PE_CATEGORY_LABEL,
  EXT_URL_PE_OPTION_KIND,
  EXT_URL_PE_QUESTION_KEY,
  EXT_URL_PE_SECTION_KEY,
  PE_OPTION_KIND_CAMERA,
} from '../../../../ayu-library/utils/constants';
import { transformFhirPhysExamToAyu } from '../../../../ayu-library/utils/fhir-to-ayu.util';
import { useStartVisitData } from '../../../context/start-visit.context';
import { usePatientDemographics } from '../../../hooks/useVisitReasons.hook';
import { getPendingImages } from '../../../services/obs.service';
import type { PhysicalExamAnswers } from '../../../types/physical-exam.types';
import {
  BUTTON_BACK,
  BUTTON_SAVE_NEXT,
  FHIR_RESOURCE_TYPE_QUESTIONNAIRE,
  JOB_AID_FALLBACK,
  PE_CONFIG_NAME,
  PE_DEFAULT_SECTION_LABEL,
  PE_LOADING_TEXT,
  PE_PICTURE_TAKEN_LABEL,
  PHYSICAL_EXAM_SUMMARY_TITLE,
  SUMMARY_CANCEL_TEXT,
  SUMMARY_CONFIRM_TEXT,
  SUMMARY_ITEM_TYPE_LABEL_VALUE,
} from '../../../utils/ayu.constants';
import {
  filterAyuQuestionsForPhysExam,
  parsePhysicalExamFilter,
} from '../../../utils/physical-exam.utils';
import { getJobAidType, getJobAidUrl } from '../../../utils/physExamAssets';
import AyuButton from '../../common/ayu-button.component';
import type { AyuStepperContainerHandle } from '../visit-reason/ayu-stepper-container.component';
import { AyuStepperContainer } from '../visit-reason/ayu-stepper-container.component';
import {
  PhysicalExamCameraProvider,
  usePhysicalExamCamera,
} from './physical-exam-camera-context';

interface AyuFhirShape {
  resourceType?: string;
  text?: string;
  item?: AyuQuestion[];
}

const ayuAnswersToPhysicalExamAnswers = (
  answers: Record<string, AyuAnswerValue>
): PhysicalExamAnswers => {
  const out: PhysicalExamAnswers = {};
  for (const [linkId, value] of Object.entries(answers)) {
    if (Array.isArray(value)) {
      out[linkId] = value.filter((v): v is string => typeof v === 'string');
    } else if (typeof value === 'string') {
      out[linkId] = [value];
    } else {
      out[linkId] = [];
    }
  }
  return out;
};

const readExt = (q: AyuQuestion, url: string): string | undefined =>
  q.extension?.find(e => e.url === url)?.valueString;

const isCameraOption = (
  opt: NonNullable<AyuQuestion['answerOption']>[number]
): boolean =>
  !!opt.extension?.some(
    ext =>
      ext.url === EXT_URL_PE_OPTION_KIND &&
      ext.valueString === PE_OPTION_KIND_CAMERA
  );

/** Recursively collect nested child answers (e.g. Systolic/Diastolic under BP).
 *  For choice-type children, resolves the stored answer code to the option's
 *  display text so the summary shows "Moves" instead of a raw code like
 *  "ID-123". When the child has no `text`, the resolved display value is used
 *  as the label so the row is not silently dropped.
 *  Gated children whose `enableWhen` condition is not met are skipped so that
 *  stale answers from previously-visible branches do not leak into the summary. */
const collectNestedChildValues = (
  items: AyuQuestion[] | undefined,
  answers: Record<string, AyuAnswerValue>
): { label: string; value: string }[] => {
  if (!items) return [];
  const rows: { label: string; value: string }[] = [];
  for (const child of items) {
    /* Skip gated children whose condition is not satisfied */
    if (!evaluateEnableWhen(child.enableWhen, answers)) continue;

    const answer = answers[child.linkId];
    if (answer != null && answer !== '') {
      const label = child.text ?? '';
      const rawValue = typeof answer === 'string' ? answer : String(answer);

      // For choice questions, resolve the answer code to display text
      let displayValue = rawValue;
      if (child.answerOption?.length) {
        const codes = Array.isArray(answer)
          ? answer.filter((v): v is string => typeof v === 'string')
          : typeof answer === 'string'
            ? [answer]
            : [];
        const resolved = codes.map(code => {
          const opt = child.answerOption?.find(
            o => o.valueCoding?.code === code || o.valueString === code
          );
          return opt?.valueCoding?.display ?? opt?.valueString ?? code;
        });
        if (resolved.length > 0) displayValue = resolved.join(', ');
      }

      if (displayValue) {
        rows.push({ label: label || displayValue, value: displayValue });
      }
    }
    rows.push(...collectNestedChildValues(child.item, answers));
  }
  return rows;
};

export const PhysicalExamination = (props: SectionProps) => {
  const {
    onNextQuestion: originalOnNext,
    onPrevSection,
    onProgressUpdate,
    physicalExamFilter,
    ayuConfigFiles,
  } = props;
  const {
    data,
    visitId,
    setPhysicalExamData,
    saveSectionToTemp,
    setPhysExamPendingImages,
  } = useStartVisitData();
  const { showVitalConfirmationModal } = useGlobalModal();
  const patientDemographics = usePatientDemographics();
  const stepperRef = useRef<AyuStepperContainerHandle>(null);
  const [isReviewMode, setIsReviewMode] = useState(() => !!data.physicalExam);

  const physExamJson = useMemo(
    () =>
      ayuConfigFiles?.find(
        f => f.name.replace(/\.json$/i, '').trim() === PE_CONFIG_NAME
      )?.json ?? null,
    [ayuConfigFiles]
  );

  const ayuRoot = useMemo<AyuFhirShape | null>(() => {
    if (!physExamJson) return null;
    const root = transformFhirPhysExamToAyu(
      physExamJson as unknown as Parameters<
        typeof transformFhirPhysExamToAyu
      >[0],
      patientDemographics
    );
    if (!root) return null;
    const filteredItems = filterAyuQuestionsForPhysExam(
      /* v8 ignore next */
      root.item ?? [],
      physicalExamFilter ?? ''
    );
    return {
      resourceType: FHIR_RESOURCE_TYPE_QUESTIONNAIRE,
      text: root.text,
      item: filteredItems,
    };
  }, [physExamJson, patientDemographics, physicalExamFilter]);

  const topLevelItems = useMemo(() => ayuRoot?.item ?? [], [ayuRoot]);

  const questionByLinkIdRef = useRef(new Map<string, AyuQuestion>());
  useMemo(() => {
    const map = new Map<string, AyuQuestion>();
    for (const q of topLevelItems) map.set(q.linkId, q);
    questionByLinkIdRef.current = map;
  }, [topLevelItems]);

  const sectionCommentFor = useCallback((questionId: string): string => {
    const q = questionByLinkIdRef.current.get(questionId);
    return (
      readExt(q ?? ({} as AyuQuestion), EXT_URL_PE_SECTION_KEY) ??
      PE_DEFAULT_SECTION_LABEL
    );
  }, []);

  const jobAidUrlFor = useCallback((questionId: string): string | null => {
    const q = questionByLinkIdRef.current.get(questionId);
    if (!q) return null;
    const file =
      readExt(q, EXT_URL_JOB_AID_FILE) ??
      /* Fallback branch: only reached when FHIR data lacks jobAidFile extension */
      /* v8 ignore next 3 */
      JOB_AID_FALLBACK[
        (readExt(q, EXT_URL_PE_QUESTION_KEY) ?? '').toLowerCase()
      ];
    if (!file) return null;
    return getJobAidUrl(file) ?? null;
  }, []);

  const jobAidTypeFor = useCallback(
    (questionId: string): 'image' | 'video' | null => {
      const q = questionByLinkIdRef.current.get(questionId);
      if (!q) return null;
      const file =
        readExt(q, EXT_URL_JOB_AID_FILE) ??
        /* Fallback branch: only reached when FHIR data lacks jobAidFile extension */
        /* v8 ignore next 3 */
        JOB_AID_FALLBACK[
          (readExt(q, EXT_URL_PE_QUESTION_KEY) ?? '').toLowerCase()
        ];
      if (file) {
        const actual = getJobAidType(file);
        if (actual) return actual;
      }
      const t = readExt(q, EXT_URL_JOB_AID_TYPE);
      if (t === 'image' || t === 'video') return t;
      return null;
    },
    []
  );

  const cameraImagesForRef = useRef<((qId: string) => string[]) | null>(null);

  const handleStepperComplete = useCallback(
    (answers: Record<string, AyuAnswerValue>) => {
      const physExamAnswers = ayuAnswersToPhysicalExamAnswers(answers);
      const cameraImagesFor = cameraImagesForRef.current ?? (() => []);

      const details: Array<{ label: string; value: string }> = [];
      const sectionMap = new Map<string, ModalSection>();

      for (const q of topLevelItems) {
        const selectedCodes = physExamAnswers[q.linkId] ?? [];
        if (selectedCodes.length === 0) continue;

        /* v8 ignore next */
        const sectionKey = readExt(q, EXT_URL_PE_SECTION_KEY) ?? '';
        const categoryLabel =
          /* v8 ignore next */
          readExt(q, EXT_URL_PE_CATEGORY_LABEL) ?? q.text ?? '';

        const selectedTexts: string[] = [];
        const summaryTexts: string[] = [];
        for (const code of selectedCodes) {
          const opt = q.answerOption?.find(o => o.valueCoding?.code === code);
          if (!opt) continue;
          const display = opt.valueCoding?.display ?? '';
          if (isCameraOption(opt)) {
            const hasImages = cameraImagesFor(q.linkId).length > 0;
            if (hasImages) summaryTexts.push(PE_PICTURE_TAKEN_LABEL);
          } else {
            if (display) {
              selectedTexts.push(display);
              summaryTexts.push(display);
            }
          }
        }

        /* Collect nested child values (e.g. Systolic/Diastolic under Blood Pressure) */
        const nestedValues = collectNestedChildValues(q.item, answers);

        /* Always include the parent's selected texts in the details. */
        if (selectedTexts.length > 0) {
          details.push({
            label: categoryLabel,
            value: selectedTexts.join(', '),
          });
        }

        if (summaryTexts.length === 0 && nestedValues.length === 0) continue;

        if (!sectionMap.has(sectionKey)) {
          sectionMap.set(sectionKey, {
            title: sectionKey,
            items: [],
            onChange: () => setIsReviewMode(true),
          });
        }

        if (nestedValues.length > 0) {
          /* Parent answer (e.g. "Yes") as its own row */
          if (summaryTexts.length > 0) {
            sectionMap.get(sectionKey)!.items.push({
              type: SUMMARY_ITEM_TYPE_LABEL_VALUE,
              label: categoryLabel,
              value: summaryTexts.join(', '),
            });
          }
          /* Each child answer as an indented row below the parent. */
          for (const nv of nestedValues) {
            const label = nv.label.replace(/^Enter\s+/i, '');
            details.push({ label, value: nv.value });
            sectionMap.get(sectionKey)!.items.push({
              type: SUMMARY_ITEM_TYPE_LABEL_VALUE,
              label,
              value: nv.value,
              isChild: true,
            });
          }
        } else {
          sectionMap.get(sectionKey)!.items.push({
            type: SUMMARY_ITEM_TYPE_LABEL_VALUE,
            label: categoryLabel,
            value: summaryTexts.join(', '),
          });
        }
      }

      const sections = Array.from(sectionMap.values());

      setIsReviewMode(true);
      showVitalConfirmationModal({
        open: true,
        type: 'vitalConfirm',
        icon: iconPhysicalExam,
        title: PHYSICAL_EXAM_SUMMARY_TITLE,
        sections,
        size: 'lg',
        confirmText: SUMMARY_CONFIRM_TEXT,
        cancelText: SUMMARY_CANCEL_TEXT,
        onConfirm: () => {
          const detailsSections = sections.map(s => ({
            title: s.title,
            items: s.items,
          }));
          setPhysicalExamData(physExamAnswers, details, detailsSections);
          setPhysExamPendingImages(getPendingImages());
          saveSectionToTemp({
            physicalExam: {
              answers: physExamAnswers,
              details,
              detailsSections,
            },
          });
          originalOnNext();
        },
      });
    },
    [
      topLevelItems,
      showVitalConfirmationModal,
      setPhysicalExamData,
      setPhysExamPendingImages,
      saveSectionToTemp,
      originalOnNext,
    ]
  );

  const handleProgressUpdate = useCallback(
    (total: number, answered: number) => {
      onProgressUpdate?.(total, answered);
    },
    [onProgressUpdate]
  );

  const initialAnswers = useMemo(() => {
    const raw = data.physicalExam?.answers;
    if (!raw) return undefined;
    return raw as unknown as Record<string, AyuAnswerValue>;
  }, [data.physicalExam]);

  if (!ayuRoot || topLevelItems.length === 0) {
    return <div>{PE_LOADING_TEXT}</div>;
  }

  return (
    <PhysicalExamCameraProvider
      visitId={visitId ?? null}
      sectionCommentFor={sectionCommentFor}
      jobAidUrlFor={jobAidUrlFor}
      jobAidTypeFor={jobAidTypeFor}
    >
      <CameraImagesForCapture cameraImagesForRef={cameraImagesForRef} />
      <div className="w-full flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-[996px]">
            <AyuStepperContainer
              ref={stepperRef}
              questionnaire={ayuRoot as never}
              summaryTitle={PHYSICAL_EXAM_SUMMARY_TITLE}
              skipSummary
              initialAnswers={initialAnswers}
              onComplete={handleStepperComplete}
              onProgressUpdate={handleProgressUpdate}
            />
          </div>
        </div>
        <div className="sticky bottom-0 z-40 bg-white border-t border-gray-200 pt-3">
          <div className="flex gap-3 md:justify-end">
            <AyuButton
              type="button"
              variant="primarylight"
              size="md"
              onClick={() => onPrevSection?.()}
              className="w-full md:w-[10%]"
            >
              <span className="mx-auto w-full text-base">{BUTTON_BACK}</span>
            </AyuButton>
            {isReviewMode && (
              <AyuButton
                type="button"
                variant="primary"
                size="md"
                onClick={() => stepperRef.current?.confirm()}
                className="w-full md:w-[10%]"
              >
                <span className="mx-auto w-full text-base">
                  {BUTTON_SAVE_NEXT}
                </span>
              </AyuButton>
            )}
          </div>
        </div>
      </div>
    </PhysicalExamCameraProvider>
  );
};

const CameraImagesForCapture = ({
  cameraImagesForRef,
}: {
  cameraImagesForRef: React.MutableRefObject<
    ((qId: string) => string[]) | null
  >;
}) => {
  const camera = usePhysicalExamCamera();
  cameraImagesForRef.current = camera?.cameraImagesFor ?? null;
  return null;
};

export { parsePhysicalExamFilter };
