import React from 'react';
import { cn } from '../../utils/cn';
import './selectable-option.css';

interface SelectableOptionProps {
  label: string | undefined;
  value: string | undefined;
  selected: boolean;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onClick?: () => void;
}

export const AyuSelectableOption: React.FC<SelectableOptionProps> = ({
  label,
  leftIcon,
  rightIcon,
  selected,
  disabled,
  onClick,
}) => {
  return (
    <button
      type="button"
      className={cn(
        'selectable-option',
        selected && 'selected',
        disabled && 'disabled'
      )}
      onClick={onClick}
    >
      {leftIcon && (
        <span className={cn('flex-shrink-0 option-icon')}>{leftIcon}</span>
      )}

      {label && <span className="label">{label}</span>}

      {rightIcon && <span className="icon right-icon">{rightIcon}</span>}
    </button>
  );
};
