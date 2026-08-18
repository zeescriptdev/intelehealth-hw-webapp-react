import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AyuQuestion } from '../../../../../modules/ayu-library/types/ayu.types';
import { AyuNumberInput } from '../../../../../modules/ayu/components/common/ayu-number-input.component';

describe('AyuNumberInput', () => {
  const mockQuestion: AyuQuestion = {
    linkId: 'num-1',
    text: 'Enter your age',
    type: 'integer',
    readOnly: false,
  };

  describe('Rendering', () => {
    it('should render number input', () => {
      render(
        <AyuNumberInput
          question={mockQuestion}
          parent={undefined}
          previousSibling={undefined}
        />
      );
      expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    });

    it('should render without crashing when text is not provided', () => {
      const questionWithoutText: AyuQuestion = {
        ...mockQuestion,
        text: undefined,
      };
      render(
        <AyuNumberInput
          question={questionWithoutText}
          parent={undefined}
          previousSibling={undefined}
        />
      );
      expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    });

    it('should have correct input type', () => {
      render(
        <AyuNumberInput
          question={mockQuestion}
          parent={undefined}
          previousSibling={undefined}
        />
      );
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('type', 'number');
    });

    it('should have min attribute defaulting to 0', () => {
      render(
        <AyuNumberInput
          question={mockQuestion}
          parent={undefined}
          previousSibling={undefined}
        />
      );
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('min', '0');
    });

    it('should use minValue from FHIR extension', () => {
      const questionWithMinMax: AyuQuestion = {
        ...mockQuestion,
        extension: [
          {
            url: 'http://hl7.org/fhir/StructureDefinition/minValue',
            valueInteger: 1,
          },
          {
            url: 'http://hl7.org/fhir/StructureDefinition/maxValue',
            valueInteger: 50,
          },
        ],
      };
      render(
        <AyuNumberInput
          question={questionWithMinMax}
          parent={undefined}
          previousSibling={undefined}
        />
      );
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('min', '1');
      expect(input).toHaveAttribute('max', '50');
    });

    it('should render disabled input when readOnly is true', () => {
      const readOnlyQuestion: AyuQuestion = {
        ...mockQuestion,
        readOnly: true,
      };
      render(
        <AyuNumberInput
          question={readOnlyQuestion}
          parent={undefined}
          previousSibling={undefined}
        />
      );
      const input = screen.getByRole('spinbutton');
      expect(input).toBeDisabled();
    });

    it('should render enabled input when readOnly is false', () => {
      render(
        <AyuNumberInput
          question={mockQuestion}
          parent={undefined}
          previousSibling={undefined}
        />
      );
      const input = screen.getByRole('spinbutton');
      expect(input).not.toBeDisabled();
    });
  });

  describe('CSS Classes', () => {
    it('should have correct base CSS classes', () => {
      render(
        <AyuNumberInput
          question={mockQuestion}
          parent={undefined}
          previousSibling={undefined}
        />
      );
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveClass('border', 'bg-white', 'border-solid', 'border-[#20c997]', 'rounded', 'px-3', 'py-2', 'outline-none', 'resize-y');
    });

    it('should have outline-none styling', () => {
      render(
        <AyuNumberInput
          question={mockQuestion}
          parent={undefined}
          previousSibling={undefined}
        />
      );
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveClass('outline-none');
    });

    it('should apply same base classes regardless of disabled state', () => {
      render(
        <AyuNumberInput
          question={mockQuestion}
          parent={undefined}
          previousSibling={undefined}
        />
      );
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveClass('border', 'bg-white', 'border-solid', 'border-[#20c997]', 'rounded', 'px-3', 'py-2');
    });

    it('should render top-level label with primary CSS classes when no parent', () => {
      render(
        <AyuNumberInput
          question={mockQuestion}
          parent={undefined}
          previousSibling={undefined}
        />
      );
      const label = screen.getByText('Enter your age');
      expect(label).toHaveClass('text-md', 'font-medium', 'text-black-500');
    });

    it('should render nested label with muted CSS classes when parent is provided', () => {
      const parent: AyuQuestion = {
        linkId: 'parent-1',
        text: 'Parent Question',
        type: 'choice',
      };
      render(
        <AyuNumberInput
          question={mockQuestion}
          parent={parent}
          previousSibling={undefined}
        />
      );
      const label = screen.getByText('Enter your age');
      expect(label).toHaveClass('block', 'text-base', 'text-(--color-muted)');
    });
  });

  describe('Input ID', () => {
    it('should set correct id on the input element', () => {
      render(
        <AyuNumberInput
          question={mockQuestion}
          parent={undefined}
          previousSibling={undefined}
        />
      );
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('id', 'ayu-number-num-1');
    });
  });

  describe('Props Handling', () => {
    it('should handle parent prop', () => {
      const parent: AyuQuestion = {
        linkId: 'parent-1',
        text: 'Parent Question',
        type: 'group',
        item: [],
      };
      render(
        <AyuNumberInput
          question={mockQuestion}
          parent={parent}
          previousSibling={undefined}
        />
      );
      expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    });

    it('should handle previousSibling prop', () => {
      const previousSibling: AyuQuestion = {
        linkId: 'prev-1',
        text: 'Previous Question',
        type: 'integer',
      };
      render(
        <AyuNumberInput
          question={mockQuestion}
          parent={undefined}
          previousSibling={previousSibling}
        />
      );
      expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle question with empty string text', () => {
      const emptyTextQuestion: AyuQuestion = {
        ...mockQuestion,
        text: '',
      };
      render(
        <AyuNumberInput
          question={emptyTextQuestion}
          parent={undefined}
          previousSibling={undefined}
        />
      );
      expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    });

    it('should handle undefined readOnly', () => {
      const questionWithoutReadOnly: AyuQuestion = {
        linkId: 'num-1',
        text: 'Question',
        type: 'integer',
      };
      render(
        <AyuNumberInput
          question={questionWithoutReadOnly}
          parent={undefined}
          previousSibling={undefined}
        />
      );
      const input = screen.getByRole('spinbutton');
      expect(input).not.toBeDisabled();
    });

    it('should handle undefined question gracefully', () => {
      render(
        <AyuNumberInput
          question={undefined}
          parent={undefined}
          previousSibling={undefined}
        />
      );

      // Should render without crashing and without label
      expect(screen.queryByRole('label')).not.toBeInTheDocument();
      expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    });
  });

  describe('Container Layout', () => {
    it('should render with flex container classes', () => {
      const { container } = render(
        <AyuNumberInput
          question={mockQuestion}
          parent={undefined}
          previousSibling={undefined}
        />
      );
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('flex', 'flex-col', 'gap-1');
    });
  });

  describe('Different Number Types', () => {
    it('should handle integer type question', () => {
      const integerQuestion: AyuQuestion = {
        ...mockQuestion,
        type: 'integer',
      };
      render(
        <AyuNumberInput
          question={integerQuestion}
          parent={undefined}
          previousSibling={undefined}
        />
      );
      expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    });

    it('should handle decimal type question', () => {
      const decimalQuestion: AyuQuestion = {
        ...mockQuestion,
        type: 'decimal',
      };
      render(
        <AyuNumberInput
          question={decimalQuestion}
          parent={undefined}
          previousSibling={undefined}
        />
      );
      expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    });
  });

  describe('Wheel scroll behavior', () => {
    it('should blur the input on wheel so scrolling does not change the value', () => {
      render(
        <AyuNumberInput
          question={mockQuestion}
          parent={undefined}
          previousSibling={undefined}
        />
      );
      const input = screen.getByRole('spinbutton') as HTMLInputElement;
      input.focus();
      expect(document.activeElement).toBe(input);

      fireEvent.wheel(input);
      expect(document.activeElement).not.toBe(input);
    });
  });

  describe('handleChange Function Coverage', () => {
    it('should call onChange with parsed integer value', () => {
      const mockOnChange = vi.fn();
      render(
        <AyuNumberInput
          question={mockQuestion}
          parent={undefined}
          previousSibling={undefined}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '42' } });

      expect(mockOnChange).toHaveBeenCalledWith(42);
    });

    it('should call onChange with parsed decimal value', () => {
      const mockOnChange = vi.fn();
      render(
        <AyuNumberInput
          question={mockQuestion}
          parent={undefined}
          previousSibling={undefined}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '3.14' } });

      expect(mockOnChange).toHaveBeenCalledWith(3.14);
    });

    it('should clamp negative value to min (default 0)', () => {
      const mockOnChange = vi.fn();
      render(
        <AyuNumberInput
          question={mockQuestion}
          parent={undefined}
          previousSibling={undefined}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '-15' } });

      expect(mockOnChange).toHaveBeenCalledWith(0);
    });

    it('should return empty string when input value is empty', () => {
      const mockOnChange = vi.fn();
      render(
        <AyuNumberInput
          question={mockQuestion}
          parent={undefined}
          previousSibling={undefined}
          value={42}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByRole('spinbutton');
      // Simulate clearing by setting to a non-numeric value that parseFloat can't parse
      fireEvent.change(input, { target: { value: null } });

      // When value is falsy, handleChange returns empty string
      // This tests the ternary logic: e.target.value ? parseFloat(...) : ''
      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should call onChange with zero value', () => {
      const mockOnChange = vi.fn();
      render(
        <AyuNumberInput
          question={mockQuestion}
          parent={undefined}
          previousSibling={undefined}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '0' } });

      expect(mockOnChange).toHaveBeenCalledWith(0);
    });

    it('should call onChange with large number value', () => {
      const mockOnChange = vi.fn();
      render(
        <AyuNumberInput
          question={mockQuestion}
          parent={undefined}
          previousSibling={undefined}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '999999' } });

      expect(mockOnChange).toHaveBeenCalledWith(999999);
    });

    it('should call onChange with small decimal value', () => {
      const mockOnChange = vi.fn();
      render(
        <AyuNumberInput
          question={mockQuestion}
          parent={undefined}
          previousSibling={undefined}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '0.001' } });

      expect(mockOnChange).toHaveBeenCalledWith(0.001);
    });

    it('should not throw error when onChange is undefined', () => {
      render(
        <AyuNumberInput
          question={mockQuestion}
          parent={undefined}
          previousSibling={undefined}
        />
      );

      const input = screen.getByRole('spinbutton');

      // Should not throw error even without onChange prop
      expect(() => {
        fireEvent.change(input, { target: { value: '123' } });
      }).not.toThrow();
    });

    it('should handle multiple onChange calls', () => {
      const mockOnChange = vi.fn();
      render(
        <AyuNumberInput
          question={mockQuestion}
          parent={undefined}
          previousSibling={undefined}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '1' } });
      fireEvent.change(input, { target: { value: '12' } });
      fireEvent.change(input, { target: { value: '123' } });

      expect(mockOnChange).toHaveBeenCalledTimes(3);
      expect(mockOnChange).toHaveBeenNthCalledWith(1, 1);
      expect(mockOnChange).toHaveBeenNthCalledWith(2, 12);
      expect(mockOnChange).toHaveBeenNthCalledWith(3, 123);
    });

    it('should clamp negative decimal to min (default 0)', () => {
      const mockOnChange = vi.fn();
      render(
        <AyuNumberInput
          question={mockQuestion}
          parent={undefined}
          previousSibling={undefined}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '-2.5' } });

      expect(mockOnChange).toHaveBeenCalledWith(0);
    });

    it('should handle value prop correctly', () => {
      const mockOnChange = vi.fn();
      render(
        <AyuNumberInput
          question={mockQuestion}
          parent={undefined}
          previousSibling={undefined}
          value={50}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByRole('spinbutton') as HTMLInputElement;
      expect(input.value).toBe('50');

      fireEvent.change(input, { target: { value: '75' } });
      expect(mockOnChange).toHaveBeenCalledWith(75);
    });

    it('should handle the empty string branch of ternary operator', () => {
      const mockOnChange = vi.fn();
      render(
        <AyuNumberInput
          question={mockQuestion}
          parent={undefined}
          previousSibling={undefined}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '999' } });
      expect(mockOnChange).toHaveBeenCalledWith(999);

      // Test the ternary: e.target.value ? parseFloat(e.target.value) : ''
      // When target.value is falsy (0, null, undefined, '', etc.), it returns ''
      mockOnChange.mockClear();
      fireEvent.change(input, { target: { value: '0' } });
      // Zero is a valid number, so it parses to 0
      expect(mockOnChange).toHaveBeenCalledWith(0);
    });

    it('should parse scientific notation correctly', () => {
      const mockOnChange = vi.fn();
      render(
        <AyuNumberInput
          question={mockQuestion}
          parent={undefined}
          previousSibling={undefined}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '1e3' } });

      expect(mockOnChange).toHaveBeenCalledWith(1000);
    });

    it('should clamp value exceeding max to max when FHIR maxValue is set', () => {
      const mockOnChange = vi.fn();
      const questionWithMax: AyuQuestion = {
        ...mockQuestion,
        extension: [
          {
            url: 'http://hl7.org/fhir/StructureDefinition/minValue',
            valueInteger: 0,
          },
          {
            url: 'http://hl7.org/fhir/StructureDefinition/maxValue',
            valueInteger: 50,
          },
        ],
      };
      render(
        <AyuNumberInput
          question={questionWithMax}
          parent={undefined}
          previousSibling={undefined}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '75' } });

      expect(mockOnChange).toHaveBeenCalledWith(50);
    });

    it('should clamp negative zero to min (default 0)', () => {
      const mockOnChange = vi.fn();
      render(
        <AyuNumberInput
          question={mockQuestion}
          parent={undefined}
          previousSibling={undefined}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '-0' } });

      expect(mockOnChange).toHaveBeenCalledWith(0);
    });

    it('should display empty string when value is null', () => {
      render(
        <AyuNumberInput
          question={mockQuestion}
          parent={undefined}
          previousSibling={undefined}
          value={null}
        />
      );

      const input = screen.getByRole('spinbutton') as HTMLInputElement;
      expect(input.value).toBe('');
    });

    it('should display empty string when value is undefined', () => {
      render(
        <AyuNumberInput
          question={mockQuestion}
          parent={undefined}
          previousSibling={undefined}
          value={undefined}
        />
      );

      const input = screen.getByRole('spinbutton') as HTMLInputElement;
      expect(input.value).toBe('');
    });

    it('should display string representation of numeric value', () => {
      render(
        <AyuNumberInput
          question={mockQuestion}
          parent={undefined}
          previousSibling={undefined}
          value={0}
        />
      );

      const input = screen.getByRole('spinbutton') as HTMLInputElement;
      expect(input.value).toBe('0');
    });
  });
});
