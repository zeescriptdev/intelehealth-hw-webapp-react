import type {
  AyuAnswerValue,
  AyuQuestion,
  DurationAnswer,
} from '../types/ayu.types';
import {
  EXT_URL_MUTUALLY_EXCLUSIVE,
  FHIR_TYPE_CHOICE,
  FHIR_TYPE_DATE,
  FHIR_TYPE_INTEGER,
  FHIR_TYPE_QUANTITY,
  FHIR_TYPE_STRING,
} from '../utils/constants';
import { findMatchingOptionCode } from '../utils/question.utils';
import {
  isPhysicalExamOptionsQuestion,
  isStrictAssociatedSymptoms,
} from './decision-matrix';
import { evaluateEnableWhen } from './enable-when.logic';

export const isDurationAnswer = (value: unknown): value is DurationAnswer => {
  return (
    typeof value === 'object' && value !== null && 'dropdownValues' in value
  );
};

/**
 * Check if an answer option is marked as mutually exclusive via FHIR extension.
 */
export const isMutuallyExclusiveOption = (
  question: AyuQuestion,
  optionCode: string
): boolean => {
  const option = question.answerOption?.find(
    opt => opt.valueCoding?.code === optionCode
  );

  return !!option?.extension?.some(
    ext =>
      ext.url === EXT_URL_MUTUALLY_EXCLUSIVE &&
      ext.valueString?.toLowerCase() === 'true'
  );
};

/**
 * Compute the new multi-select array after toggling an option,
 * respecting mutually exclusive rules.
 */
export const computeMultiSelectToggle = (
  question: AyuQuestion,
  currentArray: string[],
  selectedValue: string
): string[] => {
  const isExclusive = isMutuallyExclusiveOption(question, selectedValue);

  if (isExclusive) {
    // If already selected → unselect
    if (currentArray.includes(selectedValue)) {
      return [];
    }
    // Replace all with only this option
    return [selectedValue];
  }

  // Normal option clicked — remove any mutually exclusive options
  const filtered = currentArray.filter(
    code => !isMutuallyExclusiveOption(question, code)
  );

  if (filtered.includes(selectedValue)) {
    return filtered.filter(v => v !== selectedValue);
  }
  return [...filtered, selectedValue];
};

/**
 * Check whether a top-level question and all its visible nested children are complete.
 */
export const isTopLevelComplete = (
  question: AyuQuestion,
  updatedAnswers: Record<string, AyuAnswerValue>
): boolean => {
  // Parent must be answered
  const parentAnswer = updatedAnswers[question.linkId];

  if (
    question.repeats
      ? !Array.isArray(parentAnswer) || parentAnswer.length === 0
      : !parentAnswer
  ) {
    return false;
  }

  if (isStrictAssociatedSymptoms(question)) {
    if (!Array.isArray(parentAnswer) || parentAnswer.length === 0) return false;
    const codes = parentAnswer as string[];
    const hasExclusive = codes.some(code =>
      isMutuallyExclusiveOption(question, code)
    );
    const totalOptions = question.answerOption?.length ?? 0;
    if (!hasExclusive && codes.length < totalOptions) return false;
  }

  // Recursively check all nested children for incomplete duration structure
  if (question.type === FHIR_TYPE_CHOICE && question.item?.length) {
    const hasIncompleteDuration = (items: AyuQuestion[]): boolean => {
      for (const child of items) {
        if (!evaluateEnableWhen(child.enableWhen, updatedAnswers)) continue;
        const childAnswer = updatedAnswers[child.linkId];
        if (isDurationAnswer(childAnswer)) {
          const hasNumber = !!childAnswer.dropdownValues?.number;
          const hasDays = !!childAnswer.dropdownValues?.days;
          if (!hasNumber || !hasDays) return true;
        }
        if (child.item?.length && hasIncompleteDuration(child.item))
          return true;
      }
      return false;
    };
    if (hasIncompleteDuration(question.item)) return false;
  }

  // Also check top-level for duration structure
  const answer = updatedAnswers[question.linkId];
  if (question.type === FHIR_TYPE_CHOICE && isDurationAnswer(answer)) {
    const hasNumber = !!answer.dropdownValues?.number;
    const hasDays = !!answer.dropdownValues?.days;
    if (!hasNumber || !hasDays) return false;
  }

  if (!question.item?.length) return true;

  /**
   * PE branching questions: complete once Yes/No is selected UNLESS a gated
   * sub-question (e.g. Tenderness → Yes → "Select location") just became
   * visible and is unanswered.  Always-visible children (no enableWhen) keep
   * the original optional behaviour so other PE questions aren't affected.
   */
  if (isPhysicalExamOptionsQuestion(question)) {
    const hasGatedUnansweredChild = question.item?.some(child => {
      if (!child.enableWhen?.length) return false; // always-visible → optional
      if (!evaluateEnableWhen(child.enableWhen, updatedAnswers)) return false;
      return child.type === FHIR_TYPE_CHOICE && !updatedAnswers[child.linkId];
    });
    return !hasGatedUnansweredChild;
  }

  // Recursively check visible nested children at all depths
  const areNestedComplete = (
    items: AyuQuestion[],
    parent: AyuQuestion
  ): boolean => {
    for (const child of items) {
      if (!evaluateEnableWhen(child.enableWhen, updatedAnswers)) continue;

      // If child maps to a parent answerOption, only validate if that option is selected
      const matchedCode = findMatchingOptionCode(child, parent);
      if (matchedCode) {
        const parentAnswer = updatedAnswers[parent.linkId];
        const selectedCodes: string[] = Array.isArray(parentAnswer)
          ? parentAnswer
          : typeof parentAnswer === 'string'
            ? [parentAnswer]
            : [];
        if (!selectedCodes.includes(matchedCode)) continue;
      }

      // Input-type children must have a value
      if (
        (child.type === FHIR_TYPE_STRING ||
          child.type === FHIR_TYPE_INTEGER ||
          child.type === FHIR_TYPE_DATE ||
          child.type === FHIR_TYPE_QUANTITY) &&
        !updatedAnswers[child.linkId]
      ) {
        return false;
      }

      // Choice children must have a selection
      if (child.type === FHIR_TYPE_CHOICE && !updatedAnswers[child.linkId]) {
        return false;
      }

      // Recurse into deeper levels
      if (child.item?.length) {
        if (!areNestedComplete(child.item, child)) return false;
      }
    }
    return true;
  };

  return areNestedComplete(question.item, question);
};
