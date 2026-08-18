import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AyuSelectableOption } from '../../../../../modules/ayu/components/common/ayu-selectable-option.component';

describe('AyuSelectableOption', () => {
  describe('Rendering', () => {
    it('should render button with label', () => {
      render(<AyuSelectableOption label="Option 1" value="opt-1" selected={false} />);
      expect(screen.getByRole('button', { name: 'Option 1' })).toBeInTheDocument();
    });

    it('should render button with undefined label', () => {
      render(<AyuSelectableOption label={undefined} value="opt-1" selected={false} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should have correct button type', () => {
      render(<AyuSelectableOption label="Option 1" value="opt-1" selected={false} />);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'button');
    });

    it('should have selectable-option class', () => {
      render(<AyuSelectableOption label="Option 1" value="opt-1" selected={false} />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('selectable-option');
    });
  });

  describe('Props Handling', () => {
    it('should accept value prop', () => {
      render(<AyuSelectableOption label="Option 1" value="opt-1" selected={false} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should accept undefined value', () => {
      render(<AyuSelectableOption label="Option 1" value={undefined} selected={false} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should accept selected prop as true', () => {
      render(<AyuSelectableOption label="Option 1" value="opt-1" selected={true} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should accept selected prop as false', () => {
      render(<AyuSelectableOption label="Option 1" value="opt-1" selected={false} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('Click Handling', () => {
    it('should call onClick when clicked', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();
      render(<AyuSelectableOption label="Option 1" value="opt-1" selected={false} onClick={handleClick} />);
      await user.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should handle no onClick prop without error', async () => {
      const user = userEvent.setup();
      render(<AyuSelectableOption label="Option 1" value="opt-1" selected={false} />);
      const button = screen.getByRole('button');
      await user.click(button);
      expect(button).toBeInTheDocument();
    });
  });

  describe('Label Display', () => {
    it('should display text label', () => {
      render(<AyuSelectableOption label="Test Option" value="test" selected={false} />);
      expect(screen.getByText('Test Option')).toBeInTheDocument();
    });

    it('should display empty label', () => {
      render(<AyuSelectableOption label="" value="test" selected={false} />);
      const button = screen.getByRole('button');
      expect(button.textContent).toBe('');
    });

    it('should display label with special characters', () => {
      render(<AyuSelectableOption label={"Option <1> & \"2\""} value="test" selected={false} />);
      expect(screen.getByText('Option <1> & "2"')).toBeInTheDocument();
    });

    it('should display long label', () => {
      const longLabel = 'This is a very long option label that might wrap to multiple lines';
      render(<AyuSelectableOption label={longLabel} value="test" selected={false} />);
      expect(screen.getByText(longLabel)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle all undefined props', () => {
      render(<AyuSelectableOption label={undefined} value={undefined} selected={false} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should handle numeric string value', () => {
      render(<AyuSelectableOption label="Number" value="123" selected={false} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should handle empty string value', () => {
      render(<AyuSelectableOption label="Empty" value="" selected={false} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should be accessible as button', () => {
      render(<AyuSelectableOption label="Accessible Option" value="acc" selected={false} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should have visible text content', () => {
      render(<AyuSelectableOption label="Visible Text" value="vis" selected={false} />);
      const button = screen.getByRole('button');
      expect(button).toBeVisible();
    });
  });

  describe('CSS Classes', () => {
    it('should apply selectable-option class', () => {
      const { container } = render(
        <AyuSelectableOption label="Option" value="opt" selected={false} />
      );
      const button = container.querySelector('.selectable-option');
      expect(button).toBeInTheDocument();
    });

    it('should apply selected class when selected is true', () => {
      render(<AyuSelectableOption label="Option" value="opt" selected={true} />);
      expect(screen.getByRole('button')).toHaveClass('selected');
    });

    it('should not apply selected class when selected is false', () => {
      render(<AyuSelectableOption label="Option" value="opt" selected={false} />);
      expect(screen.getByRole('button')).not.toHaveClass('selected');
    });
  });

  describe('Icons', () => {
    it('should render leftIcon when provided', () => {
      render(
        <AyuSelectableOption
          label="Option"
          value="opt"
          selected={false}
          leftIcon={<span data-testid="left-icon">L</span>}
        />
      );
      expect(screen.getByTestId('left-icon')).toBeInTheDocument();
      expect(screen.getByTestId('left-icon').parentElement).toHaveClass('option-icon');
    });

    it('should not render leftIcon wrapper when not provided', () => {
      const { container } = render(
        <AyuSelectableOption label="Option" value="opt" selected={false} />
      );
      expect(container.querySelector('.option-icon')).not.toBeInTheDocument();
    });

    it('should render rightIcon when provided', () => {
      render(
        <AyuSelectableOption
          label="Option"
          value="opt"
          selected={false}
          rightIcon={<span data-testid="right-icon">R</span>}
        />
      );
      expect(screen.getByTestId('right-icon')).toBeInTheDocument();
      expect(screen.getByTestId('right-icon').parentElement).toHaveClass('right-icon');
    });

    it('should not render rightIcon wrapper when not provided', () => {
      const { container } = render(
        <AyuSelectableOption label="Option" value="opt" selected={false} />
      );
      expect(container.querySelector('.right-icon')).not.toBeInTheDocument();
    });

    it('should render both icons together', () => {
      render(
        <AyuSelectableOption
          label="Option"
          value="opt"
          selected={false}
          leftIcon={<span data-testid="left">L</span>}
          rightIcon={<span data-testid="right">R</span>}
        />
      );
      expect(screen.getByTestId('left')).toBeInTheDocument();
      expect(screen.getByTestId('right')).toBeInTheDocument();
    });
  });

  describe('Button Type', () => {
    it('should prevent form submission', () => {
      render(<AyuSelectableOption label="Option" value="opt" selected={false} />);
      const button = screen.getByRole('button');
      expect(button.getAttribute('type')).toBe('button');
    });
  });

  describe('Disabled Prop', () => {
    it('should apply disabled CSS class when disabled is true', () => {
      render(
        <AyuSelectableOption label="Option" value="opt" selected={false} disabled={true} />
      );
      expect(screen.getByRole('button')).toHaveClass('disabled');
    });

    it('should not apply disabled CSS class when disabled is false', () => {
      render(
        <AyuSelectableOption label="Option" value="opt" selected={false} disabled={false} />
      );
      expect(screen.getByRole('button')).not.toHaveClass('disabled');
    });

    it('should not apply disabled CSS class when disabled is undefined', () => {
      render(
        <AyuSelectableOption label="Option" value="opt" selected={false} />
      );
      expect(screen.getByRole('button')).not.toHaveClass('disabled');
    });

    it('should NOT set the HTML disabled attribute (visual-only disabled)', () => {
      render(
        <AyuSelectableOption label="Option" value="opt" selected={false} disabled={true} />
      );
      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
    });

    it('should still fire onClick when disabled is true (visual-only)', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();
      render(
        <AyuSelectableOption
          label="Option"
          value="opt"
          selected={false}
          disabled={true}
          onClick={handleClick}
        />
      );
      await user.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should apply both disabled and selected classes together', () => {
      render(
        <AyuSelectableOption label="Option" value="opt" selected={true} disabled={true} />
      );
      const button = screen.getByRole('button');
      expect(button).toHaveClass('disabled');
      expect(button).toHaveClass('selected');
    });
  });
});
