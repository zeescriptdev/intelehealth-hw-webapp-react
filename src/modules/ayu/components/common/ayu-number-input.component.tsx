import type { AyuRendererBaseProps } from '../../../ayu-library/types/ayu-renderer-props.types';
import {
  EXT_URL_MAX_VALUE,
  EXT_URL_MIN_VALUE,
} from '../../../ayu-library/utils/constants';
import { resolveLabel } from '../../../ayu-library/utils/fhir-to-ayu.util';
import { NUMBER_INPUT_DEFAULT_MIN } from '../../utils/ayu.constants';

export function AyuNumberInput({
  question,
  parent,
  value,
  onChange,
}: AyuRendererBaseProps) {
  const inputId = `ayu-number-${question?.linkId}`;

  const min =
    question?.extension?.find(e => e.url === EXT_URL_MIN_VALUE)?.valueInteger ??
    NUMBER_INPUT_DEFAULT_MIN;
  const max = question?.extension?.find(
    e => e.url === EXT_URL_MAX_VALUE
  )?.valueInteger;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) {
      onChange?.('' as unknown as number);
      return;
    }
    let parsed = parseFloat(e.target.value);
    parsed = Math.max(parsed, min);
    if (max !== undefined) parsed = Math.min(parsed, max);
    onChange?.(parsed);
  };

  const label = question
    ? resolveLabel(question, question, question)
    : undefined;
  const inputValue = value !== null && value !== undefined ? String(value) : '';

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          className={
            parent
              ? 'block text-base text-(--color-muted)'
              : 'text-md font-medium text-black-500'
          }
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        type="number"
        min={min}
        {...(max !== undefined && { max })}
        value={inputValue}
        onChange={handleChange}
        onWheel={e => (e.target as HTMLInputElement).blur()}
        disabled={question?.readOnly}
        className="border bg-white border-solid border-[#20c997] rounded px-3 py-2 outline-none resize-y"
      />
    </div>
  );
}
