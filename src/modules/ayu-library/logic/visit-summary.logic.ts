import type { AyuAnswerValue, AyuQuestion } from '../types/ayu.types';
import {
  ASSOCIATED_SYMPTOMS_TEXT,
  EXT_URL_LANGUGAE_TEXT,
  NEGATED_ID_PREFIX,
  NEGATED_PREFIX,
  PATIENT_DENIES_LABEL,
  PATIENT_REPORTS_LABEL,
} from '../utils/constants';
import {
  isStrictAssociatedSymptoms,
  resolveAyuComponent,
} from './decision-matrix';
import { evaluateEnableWhen } from './enable-when.logic';
import { isMutuallyExclusiveOption } from './stepper.logic';

const LABEL_PLACEHOLDER_RE = /\[[^\]]*\]/;

/** Portable summary item — platform-agnostic equivalent of ModalSectionItem */
export type SummaryItem =
  | { type: 'labelValue'; label: string; value: string | number | null }
  | { type: 'subheading'; heading: string; values: string[] };

/** Portable summary section — platform-agnostic equivalent of ModalSection */
export interface SummarySection {
  title: string;
  items: SummaryItem[];
  onChange?: () => void;
}

export interface BuildSummaryOptions {
  /** When true, all associated symptoms are displayed as labelValue items
   *  instead of the "Patient reports/denies" format. Used for medical history. */
  useLabeledFormat?: boolean;
}

export function buildVisitSummary(
  questionnaire: AyuQuestion[],
  answersMap: Map<string, AyuAnswerValue>,
  sectionTitle: string,
  options?: BuildSummaryOptions
): SummarySection[] {
  if (questionnaire.some(item => item.protocolCode)) {
    return buildGroupedSummary(
      questionnaire,
      answersMap,
      sectionTitle,
      options
    );
  }
  return buildSummaryForItems(questionnaire, answersMap, sectionTitle, options);
}

function buildGroupedSummary(
  questionnaire: AyuQuestion[],
  answersMap: Map<string, AyuAnswerValue>,
  sectionTitle: string,
  options?: BuildSummaryOptions
): SummarySection[] {
  const order: string[] = [];
  const groups = new Map<string, AyuQuestion[]>();
  const ungrouped: AyuQuestion[] = [];

  for (const item of questionnaire) {
    const code = item.protocolCode;
    if (!code) {
      ungrouped.push(item);
      continue;
    }
    if (!groups.has(code)) {
      groups.set(code, []);
      order.push(code);
    }
    groups.get(code)!.push(item);
  }

  const sections: SummarySection[] = [];
  for (const code of order) {
    sections.push(
      ...buildSummaryForItems(groups.get(code)!, answersMap, code, options)
    );
  }
  if (ungrouped.length) {
    sections.push(
      ...buildSummaryForItems(ungrouped, answersMap, sectionTitle, options)
    );
  }
  return sections;
}

function buildSummaryForItems(
  questionnaire: AyuQuestion[],
  answersMap: Map<string, AyuAnswerValue>,
  sectionTitle: string,
  options?: BuildSummaryOptions
): SummarySection[] {
  const useLabeledFormat = options?.useLabeledFormat ?? false;
  const mainItems: SummaryItem[] = [];
  const associatedItems: SummaryItem[] = [];
  const processed = new Set<string>();
  const answersObj = Object.fromEntries(answersMap);

  function getExtensionLabel(item: AyuQuestion): string {
    return item.text || '';
  }

  function getAnswerValue(item: AyuQuestion) {
    return answersMap.get(item.linkId);
  }

  function getDisplay(item: AyuQuestion, code: string): string | null {
    const opt = item.answerOption?.find(
      o => o.valueCoding?.code === code || o.valueString === code
    );
    const langValue = opt?.extension?.find(
      ext => ext.url === EXT_URL_LANGUGAE_TEXT
    )?.valueString;
    if (langValue && langValue !== '%') return langValue;
    return opt?.valueCoding?.display || opt?.valueString || null;
  }

  function formatAnswerByType(
    item: AyuQuestion,
    answer: AyuAnswerValue
  ): string | null {
    switch (item.type) {
      case 'integer':
        if (
          typeof answer === 'object' &&
          answer !== null &&
          !Array.isArray(answer) &&
          ('low' in answer || 'high' in answer)
        ) {
          const { low, high } = answer as { low?: number; high?: number };
          if (low != null && high != null) return `${low} - ${high}`;
          if (low != null) return String(low);
          if (high != null) return String(high);
          return null;
        }
        return typeof answer === 'number' || typeof answer === 'string'
          ? String(answer)
          : null;

      case 'string':
        return typeof answer === 'string' ? answer : null;

      case 'quantity':
        if (
          typeof answer === 'object' &&
          answer !== null &&
          !Array.isArray(answer)
        ) {
          if ('dropdownValues' in answer) {
            const { number, days } = answer.dropdownValues || {};
            if (number) return days ? `${number} ${days}` : String(number);
          }
          if ('value' in answer) {
            const { value, unit } = answer;
            if (value != null) {
              return unit ? `${value} ${unit}` : String(value);
            }
          }
        }
        return null;

      case 'choice':
        return typeof answer === 'string' ? getDisplay(item, answer) : null;

      default:
        return typeof answer === 'string' ? answer : null;
    }
  }

  /** Recursively collect display values from all descendants of a question.
   *  Skips gated children whose `enableWhen` condition is not met so that
   *  stale answers from hidden branches do not appear in the summary. */
  function collectDescendantValues(items: AyuQuestion[] | undefined): string[] {
    if (!items) return [];
    const values: string[] = [];
    for (const child of items) {
      if (processed.has(child.linkId)) continue;
      if (!evaluateEnableWhen(child.enableWhen, answersObj)) continue;
      values.push(...collectNestedOwnValues(child));
      processed.add(child.linkId);
      values.push(...collectDescendantValues(child.item));
    }
    return values;
  }

  function collectNestedOwnValues(nestedItem: AyuQuestion): string[] {
    const answer = getAnswerValue(nestedItem);
    if (!answer) return [];

    const itemLabel = getExtensionLabel(nestedItem);
    if (typeof answer === 'string' && answer === itemLabel) return [];

    if (Array.isArray(answer) && nestedItem.answerOption) {
      const values: string[] = [];

      answer.forEach((code: string) => {
        const display = getDisplay(nestedItem, code);
        if (!display) return;

        // Check if this selected code has matching child items with their own answers
        const matchingChild = nestedItem.item?.find((child: AyuQuestion) =>
          child.enableWhen?.some(cond => cond.answerCoding?.code === code)
        );

        if (matchingChild) {
          const childValues = collectNestedOwnValues(matchingChild);
          childValues.push(...collectDescendantValues(matchingChild.item));

          if (childValues.length) {
            values.push(`${display} - ${childValues.join(', ')}`);
          } else {
            values.push(display);
          }
          processed.add(matchingChild.linkId);
        } else {
          values.push(display);
        }
      });

      return values;
    }

    const formatted = formatAnswerByType(nestedItem, answer);
    return formatted ? [formatted] : [];
  }

  /**
   * Collect nested values including their question labels.
   * Used for patient/family history summary formatting.
   * Format: "label – value" for each nested field.
   */
  function collectLabeledValues(
    item: AyuQuestion,
    parts: string[],
    parentDisplay?: string | null,
    skipEchoedLabel = false
  ) {
    const answer = getAnswerValue(item);

    if (answer) {
      const itemLabel = item.text || '';

      if (
        skipEchoedLabel &&
        typeof answer === 'string' &&
        answer === itemLabel
      ) {
        return;
      }

      if (Array.isArray(answer) && item.answerOption) {
        const displayValues: string[] = [];

        answer.forEach((code: string) => {
          const display = getDisplay(item, code);
          if (!display) return;

          // Check if this option has a nested child with answers
          const child = item.item?.find((c: AyuQuestion) =>
            c.enableWhen?.some(cond => cond.answerCoding?.code === code)
          );

          if (child && !processed.has(child.linkId)) {
            const childParts: string[] = [];
            collectLabeledValues(child, childParts, display);
            processed.add(child.linkId);

            if (childParts.length) {
              displayValues.push(`${display} – ${childParts.join(', ')}`);
            } else {
              displayValues.push(display);
            }
          } else {
            displayValues.push(display);
          }
        });

        if (displayValues.length) {
          parts.push(displayValues.join(', '));
        }
      } else {
        const formatted = formatAnswerByType(item, answer);
        if (formatted) {
          const matchingChild =
            typeof answer === 'string' &&
            item.type === 'choice' &&
            item.answerOption
              ? item.item?.find(c =>
                  c.enableWhen?.some(cond => cond.answerCoding?.code === answer)
                )
              : null;

          let combinedValue = formatted;
          if (
            matchingChild &&
            !processed.has(matchingChild.linkId) &&
            getAnswerValue(matchingChild) !== null
          ) {
            const childParts: string[] = [];
            collectLabeledValues(matchingChild, childParts, formatted);
            processed.add(matchingChild.linkId);
            if (childParts.length) {
              combinedValue = `${formatted} – ${childParts.join(', ')}`;
            }
          }
          const omitLabel =
            item.type === 'string' || !itemLabel || itemLabel === parentDisplay;
          if (omitLabel) {
            parts.push(combinedValue);
          } else if (LABEL_PLACEHOLDER_RE.test(itemLabel)) {
            parts.push(itemLabel.replace(LABEL_PLACEHOLDER_RE, combinedValue));
          } else {
            parts.push(`${itemLabel} – ${combinedValue}`);
          }
        }
      }
    }

    item.item?.forEach((child: AyuQuestion) => {
      if (processed.has(child.linkId)) return;
      const childAnswer = getAnswerValue(child);
      if (childAnswer !== undefined) {
        collectLabeledValues(child, parts, parentDisplay, skipEchoedLabel);
        processed.add(child.linkId);
      }
    });
  }

  function processItems(items: AyuQuestion[]) {
    items?.forEach(item => {
      if (processed.has(item.linkId)) return;

      const answerValue = getAnswerValue(item);
      const label = getExtensionLabel(item);

      // Associated Symptoms Special Handling
      const isAssociatedSymptoms =
        resolveAyuComponent(item) === 'associatedSymptoms';

      if (isAssociatedSymptoms) {
        if (!useLabeledFormat && isStrictAssociatedSymptoms(item)) {
          // True associated symptoms → Patient reports/denies format
          if (Array.isArray(answerValue)) {
            const reports: string[] = [];
            const denies: string[] = [];

            answerValue.forEach(code => {
              const isNegated = code.startsWith(NEGATED_ID_PREFIX);
              const lookupCode = isNegated
                ? code.replace(NEGATED_PREFIX, '')
                : code;
              const display = getDisplay(item, lookupCode);
              if (!display) return;

              let displayValue = display;

              const matchingChildren =
                item.item?.filter((child: AyuQuestion) =>
                  child.enableWhen?.some(
                    cond => cond.answerCoding?.code === code
                  )
                ) || [];

              if (matchingChildren.length > 0) {
                const nestedValues: string[] = [];

                matchingChildren.forEach((nested: AyuQuestion) => {
                  nestedValues.push(...collectNestedOwnValues(nested));
                  nestedValues.push(...collectDescendantValues(nested.item));
                  processed.add(nested.linkId);
                });

                if (nestedValues.length) {
                  displayValue += ` - ${nestedValues.join(' - ')}`;
                }
              }

              if (isNegated) {
                denies.push(displayValue);
              } else {
                reports.push(displayValue);
              }
            });

            if (reports.length) {
              associatedItems.push({
                type: 'subheading',
                heading: PATIENT_REPORTS_LABEL,
                values: [reports.join(', ') + '.'],
              });
            }

            if (denies.length) {
              associatedItems.push({
                type: 'subheading',
                heading: PATIENT_DENIES_LABEL,
                values: [denies.join(', ') + '.'],
              });
            }
          }
        } else {
          // Patient history / Family history → labelValue format
          if (Array.isArray(answerValue)) {
            const langExt = item.extension?.find(
              e => e.url === EXT_URL_LANGUGAE_TEXT
            );
            const isPercentLabel = langExt?.valueString === '%';
            const summaryLabel = isPercentLabel
              ? ''
              : ((langExt?.valueString || item.text) as string);

            // Separate positive codes and negated "None" (exclusive) option
            const positiveCodes: string[] = [];
            let exclusiveNoDisplay: string | null = null;
            answerValue.forEach(code => {
              if (code.startsWith(NEGATED_PREFIX)) {
                // Show the mutually exclusive (None) option even when answered "No"
                const lookupCode = code.slice(NEGATED_PREFIX.length);
                if (isMutuallyExclusiveOption(item, lookupCode)) {
                  exclusiveNoDisplay = getDisplay(item, lookupCode);
                }
              } else {
                positiveCodes.push(code);
              }
            });
            if (
              !exclusiveNoDisplay &&
              positiveCodes.length === 0 &&
              answerValue.length > 0
            ) {
              const exclusiveOpt = item.answerOption?.find(opt => {
                const c = opt.valueCoding?.code;
                return !!c && isMutuallyExclusiveOption(item, c);
              });
              const exclusiveCode = exclusiveOpt?.valueCoding?.code;
              if (exclusiveCode) {
                exclusiveNoDisplay = getDisplay(item, exclusiveCode);
              }
            }

            // Family history: show question text as subheading
            if (isPercentLabel && item.text) {
              mainItems.push({
                type: 'subheading',
                heading: item.text.replace(/\*$/, ''),
                values: [],
              });
            }

            positiveCodes.forEach(code => {
              const display = getDisplay(item, code);
              if (!display) return;

              // Collect nested values with their labels
              const matchingChildren =
                item.item?.filter((child: AyuQuestion) =>
                  child.enableWhen?.some(
                    cond => cond.answerCoding?.code === code
                  )
                ) || [];

              // Check if a matching child is a multi-select with nested items
              // (e.g. "Current medication" → multiple medicine entries each with dates)
              const multiSelectChild = matchingChildren.find(child => {
                const childAnswer = getAnswerValue(child);
                return (
                  Array.isArray(childAnswer) &&
                  child.answerOption &&
                  child.item?.length
                );
              });

              if (multiSelectChild) {
                // Collect each medication's details and combine into one value
                const childAnswer = getAnswerValue(
                  multiSelectChild
                ) as string[];
                processed.add(multiSelectChild.linkId);

                const medicationEntries: string[] = [];
                childAnswer.forEach(childCode => {
                  const childDisplay = getDisplay(multiSelectChild, childCode);
                  if (!childDisplay) return;

                  // Use filter — date fields are siblings with the same enableWhen code
                  // multiSelectChild.item is guaranteed non-empty by the .item?.length guard above
                  const nestedChildren = multiSelectChild.item!.filter(
                    (c: AyuQuestion) =>
                      c.enableWhen?.some(
                        cond => cond.answerCoding?.code === childCode
                      )
                  );

                  const childParts: string[] = [];
                  nestedChildren.forEach(nestedChild => {
                    collectLabeledValues(nestedChild, childParts, childDisplay);
                    processed.add(nestedChild.linkId);
                  });

                  const entry = childParts.length
                    ? `${childDisplay} – ${childParts.join(', ')}`
                    : childDisplay;
                  medicationEntries.push(entry);
                });

                if (medicationEntries.length) {
                  if (isPercentLabel) {
                    mainItems.push({
                      type: 'labelValue',
                      label: display,
                      value: medicationEntries.join(', '),
                    });
                  } else {
                    mainItems.push({
                      type: 'labelValue',
                      label: summaryLabel,
                      value: medicationEntries.join(', '),
                    });
                  }
                }

                // Process any remaining non-multi-select matching children
                matchingChildren.forEach(c => {
                  if (c.linkId !== multiSelectChild.linkId) {
                    processed.add(c.linkId);
                  }
                });
              } else {
                const labeledParts: string[] = [];
                matchingChildren.forEach((nested: AyuQuestion) => {
                  collectLabeledValues(nested, labeledParts, display);
                  processed.add(nested.linkId);
                });

                if (isPercentLabel) {
                  // Family history: each condition as its own labelValue
                  mainItems.push({
                    type: 'labelValue',
                    label: display,
                    value: labeledParts.length ? labeledParts.join(', ') : ' ',
                  });
                } else {
                  // Patient history: "Medical history" → "Diabetes – date, Current medication – value, ..."
                  const valueStr = labeledParts.length
                    ? `${display} – ${labeledParts.join(', ')}`
                    : display;
                  mainItems.push({
                    type: 'labelValue',
                    label: summaryLabel,
                    value: valueStr,
                  });
                }
              }
            });

            if (exclusiveNoDisplay) {
              if (isPercentLabel) {
                mainItems.push({
                  type: 'labelValue',
                  label: exclusiveNoDisplay,
                  value: ' ',
                });
              } else {
                mainItems.push({
                  type: 'labelValue',
                  label: summaryLabel,
                  value: exclusiveNoDisplay,
                });
              }
            }
          }
        }

        processed.add(item.linkId);
        return;
      }

      // Multi Select
      if (Array.isArray(answerValue) && item.answerOption) {
        // Check if any selected option has nested children with answers —
        // if so, display each option as its own summary row for readability.
        const hasNestedAnswers = answerValue.some(code => {
          const nested = item.item?.find((child: AyuQuestion) =>
            child.enableWhen?.some(cond => cond.answerCoding?.code === code)
          );
          if (!nested) return false;
          // Check if the nested item itself or any of its children have answers
          if (answersMap.has(nested.linkId)) return true;
          const nestedItems = nested.item || [];
          return nestedItems.some(c => answersMap.has(c.linkId));
        });

        if (hasNestedAnswers) {
          // Collect each option's nested values with labels
          const optionEntries: string[] = [];
          answerValue.forEach(code => {
            const display = getDisplay(item, code);
            if (!display) return;

            // Use filter — sibling fields (name, from date, to date) share the same enableWhen
            // item.item is guaranteed non-empty because hasNestedAnswers requires it
            const nestedChildren = item.item!.filter((child: AyuQuestion) =>
              child.enableWhen?.some(cond => cond.answerCoding?.code === code)
            );

            if (nestedChildren.length) {
              const labeledParts: string[] = [];
              nestedChildren.forEach(nested => {
                collectLabeledValues(nested, labeledParts, display);
                processed.add(nested.linkId);
              });

              const entry = labeledParts.length
                ? `${display} – ${labeledParts.join(', ')}`
                : display;
              optionEntries.push(entry);
            } else {
              optionEntries.push(display);
            }
          });

          if (optionEntries.length) {
            mainItems.push({
              type: 'labelValue',
              label,
              value: optionEntries.join(', '),
            });
          }
        } else {
          // Simple multi-select without nested values — single row
          const flatValues: string[] = answerValue
            .map(code => getDisplay(item, code))
            .filter((d): d is string => !!d);

          if (flatValues.length) {
            mainItems.push({
              type: 'labelValue',
              label,
              value: flatValues.join(', '),
            });
          }
        }

        processed.add(item.linkId);
      }

      // Single Select
      else if (
        answerValue &&
        typeof answerValue === 'string' &&
        item.answerOption
      ) {
        const display = getDisplay(item, answerValue);

        const matchingNested =
          item.item?.filter((child: AyuQuestion) =>
            child.enableWhen?.some(
              cond => cond.answerCoding?.code === answerValue
            )
          ) || [];

        if (matchingNested.length > 0) {
          // Check if a matching nested child is a multi-select with its own nested items
          // (e.g. Drug history → Yes → multiple medications each with dates)
          const multiSelectChild = matchingNested.find(nested => {
            const nestedAnswer = getAnswerValue(nested);
            return (
              Array.isArray(nestedAnswer) &&
              nested.answerOption &&
              nested.item?.length
            );
          });

          if (multiSelectChild) {
            const childAnswer = getAnswerValue(multiSelectChild) as string[];
            processed.add(multiSelectChild.linkId);

            // Collect each medication's details (name, from date, to date)
            // and combine into one comma-separated value
            const medicationEntries: string[] = [];
            childAnswer.forEach(childCode => {
              const childDisplay = getDisplay(multiSelectChild, childCode);
              if (!childDisplay) return;

              // Use filter (not find) — date fields are siblings with the same enableWhen code
              // multiSelectChild.item is guaranteed non-empty by the .item?.length guard above
              const nestedChildren = multiSelectChild.item!.filter(
                (c: AyuQuestion) =>
                  c.enableWhen?.some(
                    cond => cond.answerCoding?.code === childCode
                  )
              );

              const childParts: string[] = [];
              nestedChildren.forEach(nestedChild => {
                collectLabeledValues(nestedChild, childParts, childDisplay);
                processed.add(nestedChild.linkId);
              });

              const entry = childParts.length
                ? `${childDisplay} – ${childParts.join(', ')}`
                : childDisplay;
              medicationEntries.push(entry);
            });

            if (medicationEntries.length) {
              mainItems.push({
                type: 'labelValue',
                label,
                value: `${display} – ${medicationEntries.join(', ')}`,
              });
            }

            // Mark remaining matching children as processed
            matchingNested.forEach(c => processed.add(c.linkId));
          } else {
            const labeledParts: string[] = [];

            matchingNested.forEach((nested: AyuQuestion) => {
              /* skipEchoedLabel=true mirrors the legacy collectNestedOwnValues
               behaviour for single-select paths (skip "Same Label – Same Label").*/
              collectLabeledValues(nested, labeledParts, display, true);
              processed.add(nested.linkId);
            });

            if (labeledParts.length) {
              mainItems.push({
                type: 'labelValue',
                label,
                value: `${display} - ${labeledParts.join(', ')}`,
              });
            } else if (display) {
              mainItems.push({
                type: 'labelValue',
                label,
                value: display,
              });
            }
          }
        } else if (display) {
          mainItems.push({
            type: 'labelValue',
            label,
            value: display,
          });
        }

        processed.add(item.linkId);
      }

      // Simple Types (string, integer, quantity)
      else if (answerValue) {
        if (typeof answerValue === 'string' && answerValue === label) {
          processed.add(item.linkId);
        } else {
          const formatted = formatAnswerByType(item, answerValue);
          if (formatted) {
            mainItems.push({
              type: 'labelValue',
              label,
              value: formatted,
            });
          }

          processed.add(item.linkId);
        }
      }

      // Process children recursively
      if (item.item?.length) {
        processItems(item.item);
      }
    });
  }

  processItems(questionnaire);

  const sections: SummarySection[] = [];

  if (mainItems.length > 0) {
    sections.push({ title: sectionTitle, items: mainItems });
  }

  if (associatedItems.length > 0) {
    sections.push({ title: ASSOCIATED_SYMPTOMS_TEXT, items: associatedItems });
  }

  return sections;
}
