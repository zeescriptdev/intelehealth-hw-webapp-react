import { useMemo, useRef, useState } from 'react';
import iconVisitReasonSummary from '../../../assets/icons/visit-reason.svg';
import { useGlobalModal } from '../../../components/modal/global-modal-context';
import { showToast } from '../../../services/toast';
import { evaluateEnableWhen } from '../../ayu-library/logic/enable-when.logic';
import {
  computeMultiSelectToggle,
  isTopLevelComplete,
} from '../../ayu-library/logic/stepper.logic';
import {
  isEmpty,
  validateQuestion,
} from '../../ayu-library/logic/validation.logic';
import type {
  AyuAnswerValue,
  AyuQuestion,
  FhirQuestionnaire,
} from '../../ayu-library/types/ayu.types';
import {
  EXT_URL_PE_OPTION_KIND,
  FHIR_TYPE_CHOICE,
  FHIR_TYPE_DATE,
  FHIR_TYPE_GROUP,
  FHIR_TYPE_INTEGER,
  FHIR_TYPE_QUANTITY,
  FHIR_TYPE_STRING,
  PE_OPTION_KIND_CAMERA,
} from '../../ayu-library/utils/constants';
import {
  clearHiddenDescendantAnswers,
  isDescendantLinkId,
} from '../../ayu-library/utils/question.utils';
import { usePhysicalExamCamera } from '../components/start-visit/physical-examination/physical-exam-camera-context';
import {
  ASSOCIATED_SYMPTOMS_LABEL,
  DEFAULT_VISIT_REASON_TEXT,
  SUMMARY_CANCEL_TEXT,
  SUMMARY_CONFIRM_TEXT,
  validationMessageForReason,
} from '../utils/ayu.constants';
import { buildVisitSummary } from '../utils/visit-summary.util';

interface UseFHIRStepperProps {
  questionnaire: FhirQuestionnaire;
  autoNext?: boolean;
  summaryTitle?: string;
  skipSummary?: boolean;
  initialAnswers?: Record<string, AyuAnswerValue>;
  questionIndexOffset?: number;
  onComplete?: (answers: Record<string, AyuAnswerValue>) => void;
  onSummaryShown?: () => void;
}

interface UseFHIRStepperReturn {
  currentQuestion: AyuQuestion | undefined;
  currentIndex: number;
  total: number;
  answers: Record<string, AyuAnswerValue>;
  setAnswer: (question: AyuQuestion, value: AyuAnswerValue) => void;
  clearAnswers: (linkIds: string[]) => void;
  goNext: () => void;
  topLevelItems: AyuQuestion[];
  isLast: boolean;
  showAll?: boolean;
  /** Validate all questions; returns true if valid, shows toast and returns false otherwise. */
  validateAllQuestions: () => boolean;
  /** True when a PE question's answer holds the camera option but has no images. */
  isCameraAnswerMissingImages: (
    question: AyuQuestion,
    questionAnswers: Record<string, AyuAnswerValue>
  ) => boolean;
  /** True when images are captured but the UPLOAD button was not clicked. */
  isCameraNotUploaded: (
    question: AyuQuestion,
    questionAnswers: Record<string, AyuAnswerValue>
  ) => boolean;
}

export const useFHIRStepper = (
  props: UseFHIRStepperProps
): UseFHIRStepperReturn => {
  const {
    questionnaire,
    autoNext = true,
    summaryTitle,
    skipSummary,
    initialAnswers,
    questionIndexOffset = 0,
    onComplete,
    onSummaryShown,
  } = props;
  const hasInitialAnswers =
    initialAnswers && Object.keys(initialAnswers).length > 0;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AyuAnswerValue>>(
    initialAnswers ?? {}
  );
  const [showAll, setShowAll] = useState(!!hasInitialAnswers);
  const isAdvancingRef = useRef(false);
  // Ref to always access latest answers (avoids stale closure in setTimeout auto-advance)
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const { showVitalConfirmationModal } = useGlobalModal();
  // PE-only: null for Visit Reason and other non-PE flows (no provider mounted).
  const peCamera = usePhysicalExamCamera();
  const topLevelItems = useMemo(() => {
    const items = questionnaire?.item || [];
    return items.filter((item: AyuQuestion) => item.type !== FHIR_TYPE_GROUP);
  }, [questionnaire]);

  const structuralTotal = topLevelItems.length;

  const currentQuestion = topLevelItems[currentIndex];

  /**
   * A physical-exam question whose answer includes the camera ("picture")
   * option but has no captured images is invalid — the user picked "take a
   * picture" but never provided one (e.g. removed every image on edit). The
   * camera answer is only ever committed with images, so this fires on the
   * edit-removed case; non-PE flows return false (no camera provider).
   */
  const isCameraAnswerMissingImages = (
    question: AyuQuestion,
    questionAnswers: Record<string, AyuAnswerValue>
  ): boolean => {
    if (!peCamera) return false;
    const cameraCode = question.answerOption?.find(o =>
      o.extension?.some(
        e =>
          e.url === EXT_URL_PE_OPTION_KIND &&
          e.valueString === PE_OPTION_KIND_CAMERA
      )
    )?.valueCoding?.code;
    if (!cameraCode) return false;
    const answer = questionAnswers[question.linkId];
    const codes = Array.isArray(answer)
      ? answer
      : typeof answer === 'string'
        ? [answer]
        : [];
    if (!codes.includes(cameraCode)) return false;
    return peCamera.cameraImagesFor(question.linkId).length === 0;
  };

  /**
   * Images were captured in the camera UI but the user never clicked the
   * UPLOAD button, so cameraCode is NOT in the committed answer yet.
   */
  const isCameraNotUploaded = (
    question: AyuQuestion,
    questionAnswers: Record<string, AyuAnswerValue>
  ): boolean => {
    if (!peCamera) return false;
    const cameraCode = question.answerOption?.find(o =>
      o.extension?.some(
        e =>
          e.url === EXT_URL_PE_OPTION_KIND &&
          e.valueString === PE_OPTION_KIND_CAMERA
      )
    )?.valueCoding?.code;
    if (!cameraCode) return false;
    const answer = questionAnswers[question.linkId];
    const codes = Array.isArray(answer)
      ? answer
      : typeof answer === 'string'
        ? [answer]
        : [];
    if (codes.includes(cameraCode)) return false;
    return peCamera.cameraImagesFor(question.linkId).length > 0;
  };

  const goNext = () => {
    if (showAll) {
      handleComplete();
      return;
    }
    if (currentIndex < structuralTotal - 1) {
      setCurrentIndex(prev => {
        if (prev < structuralTotal - 1) {
          return prev + 1;
        }
        return prev;
      });
    } else {
      handleComplete();
    }
  };

  const validateAllQuestions = (): boolean => {
    const latestAnswers = answersRef.current;
    for (let index = 0; index < topLevelItems.length; index++) {
      const question = topLevelItems[index];
      const answer = latestAnswers[question.linkId];
      const questionNumber = showAll
        ? index + questionIndexOffset + 1
        : undefined;

      // Images captured but UPLOAD button not clicked — show specific message
      if (isCameraNotUploaded(question, latestAnswers)) {
        showToast(
          validationMessageForReason('uploadCapturedImage', questionNumber),
          undefined,
          'warning'
        );
        return false;
      }

      // Required questions must have an answer
      if (question.required && isEmpty(answer)) {
        showToast(
          validationMessageForReason('selectOption', questionNumber),
          undefined,
          'warning'
        );
        return false;
      }

      if (!isEmpty(answer) || question.required) {
        const result = validateQuestion(
          question,
          latestAnswers,
          isCameraAnswerMissingImages,
          isCameraNotUploaded
        );
        if (!result.valid) {
          showToast(
            validationMessageForReason(result.reason, questionNumber),
            undefined,
            'warning'
          );
          return false;
        }
      }
    }
    return true;
  };

  const handleComplete = () => {
    if (!validateAllQuestions()) return;

    const latestAnswers = answersRef.current;

    if (skipSummary) {
      onComplete?.(latestAnswers);
      return;
    }
    setShowAll(true);

    const answersMap = new Map(Object.entries(latestAnswers));
    const sections = buildVisitSummary(
      topLevelItems,
      answersMap,
      questionnaire?.text || DEFAULT_VISIT_REASON_TEXT
    );

    // Add per-section onChange callbacks
    sections.forEach(section => {
      section.onChange = () => {
        const targetIndex = topLevelItems.findIndex(item => {
          if (section.title === ASSOCIATED_SYMPTOMS_LABEL) {
            return item.extension?.some(
              ext => ext.valueString === ASSOCIATED_SYMPTOMS_LABEL
            );
          }
          return true; // main section → first question
        });
        setCurrentIndex(targetIndex >= 0 ? targetIndex : 0);
        setShowAll(true);
      };
    });

    showVitalConfirmationModal({
      icon: iconVisitReasonSummary,
      title: summaryTitle || sections[0]?.title,
      sections,
      confirmText: SUMMARY_CONFIRM_TEXT,
      cancelText: SUMMARY_CANCEL_TEXT,
      open: false,
      type: 'vitalConfirm',
      size: 'lg',
      onConfirm: () => {
        setShowAll(true);
        onComplete?.(answersRef.current);
      },
    });

    onSummaryShown?.();
  };

  const clearAnswers = (linkIds: string[]) => {
    setAnswers(prev => {
      const updated = { ...prev };
      for (const id of linkIds) {
        delete updated[id];
      }
      // Keep ref in sync so handleComplete reads cleared answers
      // when called in the same event tick (e.g. skip on last question)
      answersRef.current = updated;
      return updated;
    });
  };

  const setAnswer = (question: AyuQuestion, value: AyuAnswerValue) => {
    const linkId = question.linkId;

    setAnswers(prev => {
      let finalValue: AyuAnswerValue = value;

      // Handle repeats (multi-select toggle)
      if (question.type === FHIR_TYPE_CHOICE && question.repeats) {
        if (Array.isArray(value)) {
          // Value is a pre-computed array (e.g. from AyuAssociatedSymptoms) — store directly.
          finalValue = value;
        } else {
          const currentValue = prev[linkId];
          const currentArray: string[] = Array.isArray(currentValue)
            ? currentValue
            : [];

          finalValue = computeMultiSelectToggle(
            question,
            currentArray,
            value as string
          );
        }
      }

      const updated: Record<string, AyuAnswerValue> = {
        ...prev,
        [linkId]: finalValue,
      };

      // When a parent answer changes, clear answers for children that are no longer visible
      if (question.item?.length) {
        clearHiddenDescendantAnswers(question.item, updated);
      }

      if (!autoNext || !currentQuestion) return updated;

      // Disable autoNext for input-based questions — user must explicitly submit
      if (
        currentQuestion.type === FHIR_TYPE_STRING ||
        currentQuestion.type === FHIR_TYPE_DATE ||
        currentQuestion.type === FHIR_TYPE_INTEGER ||
        currentQuestion.type === FHIR_TYPE_QUANTITY
      ) {
        return updated;
      }

      // If changed question is not current top-level, don't auto advance
      if (currentQuestion.linkId !== getTopLevelLinkId(linkId)) {
        return updated;
      }

      const shouldMoveNext = isTopLevelComplete(currentQuestion, updated);

      const hasVisibleStringOrRepeatsDeep = (
        items: AyuQuestion[] | undefined,
        answers: Record<string, AyuAnswerValue>
      ): { hasString: boolean; hasRepeats: boolean } => {
        if (!items) return { hasString: false, hasRepeats: false };
        for (const child of items) {
          if (!evaluateEnableWhen(child.enableWhen, answers)) continue;
          if (
            child.type === FHIR_TYPE_STRING ||
            child.type === FHIR_TYPE_DATE ||
            child.type === FHIR_TYPE_INTEGER ||
            child.type === FHIR_TYPE_QUANTITY
          )
            return { hasString: true, hasRepeats: false };
          if (child.type === FHIR_TYPE_CHOICE && child.repeats)
            return { hasString: false, hasRepeats: true };
          const deep = hasVisibleStringOrRepeatsDeep(child.item, answers);
          if (deep.hasString || deep.hasRepeats) return deep;
        }
        return { hasString: false, hasRepeats: false };
      };

      const deepCheck = hasVisibleStringOrRepeatsDeep(
        currentQuestion.item,
        updated
      );
      const hasVisibleStringChild = deepCheck.hasString;

      const hasNestedRepeats = deepCheck.hasRepeats;

      if (
        shouldMoveNext &&
        !hasVisibleStringChild &&
        !isAdvancingRef.current &&
        !(
          currentQuestion.type === FHIR_TYPE_CHOICE && currentQuestion.repeats
        ) &&
        !hasNestedRepeats &&
        !showAll
      ) {
        isAdvancingRef.current = true;

        setTimeout(() => {
          goNext();
          isAdvancingRef.current = false;
        }, 250);
      }

      return updated;
    });
  };

  const getTopLevelLinkId = (linkId: string) => {
    if (currentQuestion?.linkId === linkId) return linkId;

    // Recursively check all descendants, not just immediate children
    if (currentQuestion && isDescendantLinkId(currentQuestion, linkId)) {
      return currentQuestion.linkId;
    }

    return linkId;
  };

  return {
    currentQuestion,
    currentIndex,
    total: structuralTotal,
    answers,
    setAnswer,
    clearAnswers,
    goNext,
    topLevelItems,
    isLast: currentIndex === structuralTotal - 1,
    showAll,
    validateAllQuestions,
    isCameraAnswerMissingImages,
    isCameraNotUploaded,
  };
};
