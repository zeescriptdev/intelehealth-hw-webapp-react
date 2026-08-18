import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { VitalConfirmationModal } from '../../../components/modal/vitals-confirmation.modal';

describe('VitalConfirmationModal', () => {
  const defaultProps = {
    open: true,
    title: 'Confirm Vitals',
    onClose: vi.fn(),
    onConfirm: vi.fn(),
  };

  it('renders nothing when open is false', () => {
    const { container } = render(
      <VitalConfirmationModal {...defaultProps} open={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal with title when open is true', () => {
    render(<VitalConfirmationModal {...defaultProps} />);
    expect(screen.getByText('Confirm Vitals')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(
      <VitalConfirmationModal
        {...defaultProps}
        description="Patient Vitals Summary"
      />
    );
    expect(screen.getByText('Patient Vitals Summary')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(<VitalConfirmationModal {...defaultProps} icon="/vitals-icon.svg" />);
    const modalIcon = screen.getByAltText('Modal Icon');
    expect(modalIcon).toBeInTheDocument();
    expect(modalIcon).toHaveAttribute('src', '/vitals-icon.svg');

    // Check wrapper divs and classes
    const iconWrapper = modalIcon.parentElement;
    expect(iconWrapper).toHaveClass(
      'w-12',
      'h-12',
      'flex',
      'items-center',
      'justify-center'
    );

    const outerWrapper = iconWrapper?.parentElement;
    expect(outerWrapper).toHaveClass('flex', 'justify-center', 'mb-3');
  });

  it('renders items list correctly', () => {
    const items = [
      { label: 'Blood Pressure', value: '120/80' },
      { label: 'Heart Rate', value: 72 },
      { label: 'Temperature', value: '98.6°F' },
    ];

    render(<VitalConfirmationModal {...defaultProps} items={items} />);

    expect(screen.getByText('Blood Pressure')).toBeInTheDocument();
    expect(screen.getByText('120/80')).toBeInTheDocument();
    expect(screen.getByText('Heart Rate')).toBeInTheDocument();
    expect(screen.getByText('72')).toBeInTheDocument();
    expect(screen.getByText('Temperature')).toBeInTheDocument();
    expect(screen.getByText('98.6°F')).toBeInTheDocument();
  });

  it('renders "No information" for null values', () => {
    const items = [
      { label: 'Blood Pressure', value: null },
      { label: 'Heart Rate', value: null },
    ];

    render(<VitalConfirmationModal {...defaultProps} items={items} />);

    const noInfoElements = screen.getAllByText('No information');
    expect(noInfoElements).toHaveLength(2);

    // Check that "No information" has correct styling class
    noInfoElements.forEach((element) => {
      expect(element).toHaveClass('text-gray-500');
    });
  });

  it('renders without items (empty array)', () => {
    render(<VitalConfirmationModal {...defaultProps} items={[]} />);
    expect(screen.getByText('Confirm Vitals')).toBeInTheDocument();
  });

  it('renders default button text', () => {
    render(<VitalConfirmationModal {...defaultProps} />);
    expect(screen.getByText('Back')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
  });

  it('renders custom button text when provided', () => {
    render(
      <VitalConfirmationModal
        {...defaultProps}
        cancelText="Cancel"
        confirmText="Submit"
      />
    );
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Submit')).toBeInTheDocument();
  });

  it('calls onClose when close icon is clicked (mobile)', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<VitalConfirmationModal {...defaultProps} onClose={onClose} />);
    const closeButton = screen.getByRole('button', { name: /close icon/i });
    await user.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when back button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<VitalConfirmationModal {...defaultProps} onClose={onClose} />);
    await user.click(screen.getByText('Back'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm when confirm button is clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(<VitalConfirmationModal {...defaultProps} onConfirm={onConfirm} />);
    await user.click(screen.getByText('Confirm'));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('renders Change button when onChange is provided in legacy mode', () => {
    const onChange = vi.fn();
    render(<VitalConfirmationModal {...defaultProps} onChange={onChange} />);

    expect(screen.getByText('Change')).toBeInTheDocument();
  });

  it('does not render Change button when onChange is not provided', () => {
    render(<VitalConfirmationModal {...defaultProps} />);

    expect(screen.queryByText('Change')).not.toBeInTheDocument();
  });

  it('calls onChange when Change button is clicked in legacy mode', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <VitalConfirmationModal
        {...defaultProps}
        onChange={onChange}
        description="Patient Info"
      />
    );

    await user.click(screen.getByText('Change'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('renders with correct modal structure and responsive classes', () => {
    const { container } = render(<VitalConfirmationModal {...defaultProps} />);
    const modal = container.querySelector('.fixed.inset-0.z-50');
    const modalBox = container.querySelector('.bg-white');

    expect(modal).toBeInTheDocument();
    expect(modalBox).toBeInTheDocument();
    expect(modalBox).toHaveClass('max-sm:w-full', 'max-sm:h-full');
  });

  it('renders all items with bullet points', () => {
    const items = [
      { label: 'Item 1', value: 'Value 1' },
      { label: 'Item 2', value: 'Value 2' },
    ];

    const { container } = render(
      <VitalConfirmationModal {...defaultProps} items={items} />
    );
    const bullets = container.querySelectorAll('.text-gray-500.font-bold');
    expect(bullets.length).toBeGreaterThanOrEqual(2);
  });

  it('converts number values to strings correctly', () => {
    const items = [{ label: 'Age', value: 25 }];

    render(<VitalConfirmationModal {...defaultProps} items={items} />);
    expect(screen.getByText('25')).toBeInTheDocument();
  });

  it('handles mixed value types (string, number, null)', () => {
    const items = [
      { label: 'Name', value: 'John Doe' },
      { label: 'Age', value: 30 },
      { label: 'Address', value: null },
    ];

    render(<VitalConfirmationModal {...defaultProps} items={items} />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('No information')).toBeInTheDocument();
  });

  it('renders scrollable content area', () => {
    const { container } = render(<VitalConfirmationModal {...defaultProps} />);
    const scrollableArea = container.querySelector('.flex-1.overflow-y-auto');
    expect(scrollableArea).toBeInTheDocument();
  });

  it('applies scroll styles when items length exceeds 7', () => {
    const items = [
      { label: 'Blood Pressure', value: '120/80' },
      { label: 'Heart Rate', value: 72 },
      { label: 'Temperature', value: '98.6°F' },
      { label: 'Oxygen Saturation', value: '98%' },
      { label: 'Respiratory Rate', value: 16 },
      { label: 'Weight', value: '70 kg' },
      { label: 'Height', value: '170 cm' },
      { label: 'BMI', value: 24.2 },
    ];

    const { container } = render(
      <VitalConfirmationModal {...defaultProps} items={items} />
    );

    const itemsContainer = container.querySelector('.mt-4.space-y-3');
    expect(itemsContainer).toHaveClass('sm:max-h-[250px]');
    expect(itemsContainer).toHaveClass('sm:overflow-y-auto');
    expect(itemsContainer).toHaveClass('sm:pr-2');
  });

  it('does not apply scroll styles when items length is 7 or less', () => {
    const items = [
      { label: 'Blood Pressure', value: '120/80' },
      { label: 'Heart Rate', value: 72 },
      { label: 'Temperature', value: '98.6°F' },
      { label: 'Oxygen Saturation', value: '98%' },
      { label: 'Respiratory Rate', value: 16 },
      { label: 'Weight', value: '70 kg' },
      { label: 'Height', value: '170 cm' },
    ];

    const { container } = render(
      <VitalConfirmationModal {...defaultProps} items={items} />
    );

    const itemsContainer = container.querySelector('.mt-4.space-y-3');
    expect(itemsContainer).not.toHaveClass('sm:max-h-[250px]');
    expect(itemsContainer).not.toHaveClass('sm:overflow-y-auto');
    expect(itemsContainer).not.toHaveClass('sm:pr-2');
  });

  describe('Size Prop', () => {
    it('applies sm size classes by default', () => {
      const { container } = render(<VitalConfirmationModal {...defaultProps} />);
      const modalBox = container.querySelector('.bg-white');
      expect(modalBox).toHaveClass('w-[420px]');
    });

    it('applies lg size classes when size is lg', () => {
      const { container } = render(<VitalConfirmationModal {...defaultProps} size="lg" />);
      const modalBox = container.querySelector('.bg-white');
      expect(modalBox).toHaveClass('w-[700px]');
    });
  });

  describe('Sections Mode', () => {
    const sectionProps = {
      ...defaultProps,
      sections: [
        {
          title: 'Vitals Section',
          items: [
            { type: 'labelValue' as const, label: 'BP', value: '120/80' },
            { type: 'labelValue' as const, label: 'HR', value: 72 },
          ],
        },
      ],
    };

    it('renders sections mode when sections prop is provided', () => {
      render(<VitalConfirmationModal {...sectionProps} />);

      expect(screen.getByText('Vitals Section')).toBeInTheDocument();
      expect(screen.getByText('BP')).toBeInTheDocument();
      expect(screen.getByText('120/80')).toBeInTheDocument();
      expect(screen.getByText('HR')).toBeInTheDocument();
      expect(screen.getByText('72')).toBeInTheDocument();
    });

    it('does not render legacy flat mode when sections are provided', () => {
      render(
        <VitalConfirmationModal
          {...sectionProps}
          description="Should not appear"
        />
      );

      expect(screen.queryByText('Should not appear')).not.toBeInTheDocument();
    });

    it('renders multiple sections', () => {
      const multiSectionProps = {
        ...defaultProps,
        sections: [
          {
            title: 'Section A',
            items: [{ type: 'labelValue' as const, label: 'Field A', value: 'Val A' }],
          },
          {
            title: 'Section B',
            items: [{ type: 'labelValue' as const, label: 'Field B', value: 'Val B' }],
          },
        ],
      };

      render(<VitalConfirmationModal {...multiSectionProps} />);

      expect(screen.getByText('Section A')).toBeInTheDocument();
      expect(screen.getByText('Field A')).toBeInTheDocument();
      expect(screen.getByText('Section B')).toBeInTheDocument();
      expect(screen.getByText('Field B')).toBeInTheDocument();
    });

    it('renders subheading items in sections mode', () => {
      const subheadingSectionProps = {
        ...defaultProps,
        sections: [
          {
            title: 'Symptoms',
            items: [
              {
                type: 'subheading' as const,
                heading: 'Patient reports',
                values: ['Fever, Cough.'],
              },
              {
                type: 'subheading' as const,
                heading: 'Patient denies',
                values: ['Headache.'],
              },
            ],
          },
        ],
      };

      render(<VitalConfirmationModal {...subheadingSectionProps} />);

      expect(screen.getByText('Patient reports:')).toBeInTheDocument();
      expect(screen.getByText('Fever, Cough.')).toBeInTheDocument();
      expect(screen.getByText('Patient denies:')).toBeInTheDocument();
      expect(screen.getByText('Headache.')).toBeInTheDocument();
    });

    it('renders "No information" for null values in section labelValue items', () => {
      const nullValueSectionProps = {
        ...defaultProps,
        sections: [
          {
            title: 'Section',
            items: [
              { type: 'labelValue' as const, label: 'Empty Field', value: null },
            ],
          },
        ],
      };

      render(<VitalConfirmationModal {...nullValueSectionProps} />);

      expect(screen.getByText('No information')).toBeInTheDocument();
    });

    it('renders Change button per section when section has onChange', async () => {
      const user = userEvent.setup();
      const sectionOnChange = vi.fn();
      const onClose = vi.fn();

      const sectionWithChangeProps = {
        ...defaultProps,
        onClose,
        sections: [
          {
            title: 'Editable Section',
            items: [{ type: 'labelValue' as const, label: 'F', value: 'V' }],
            onChange: sectionOnChange,
          },
          {
            title: 'Read Only Section',
            items: [{ type: 'labelValue' as const, label: 'F2', value: 'V2' }],
          },
        ],
      };

      render(<VitalConfirmationModal {...sectionWithChangeProps} />);

      const changeButtons = screen.getAllByText('Change');
      expect(changeButtons).toHaveLength(1);

      await user.click(changeButtons[0]);
      expect(sectionOnChange).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('falls back to legacy mode when sections is empty array', () => {
      render(
        <VitalConfirmationModal
          {...defaultProps}
          sections={[]}
          description="Legacy Description"
        />
      );

      expect(screen.getByText('Legacy Description')).toBeInTheDocument();
    });

    it('renders mixed labelValue and subheading items in a section', () => {
      const mixedSectionProps = {
        ...defaultProps,
        sections: [
          {
            title: 'Mixed Section',
            items: [
              { type: 'labelValue' as const, label: 'Duration', value: '5 days' },
              {
                type: 'subheading' as const,
                heading: 'Reports',
                values: ['Symptom A', 'Symptom B'],
              },
            ],
          },
        ],
      };

      render(<VitalConfirmationModal {...mixedSectionProps} />);

      expect(screen.getByText('Duration')).toBeInTheDocument();
      expect(screen.getByText('5 days')).toBeInTheDocument();
      expect(screen.getByText('Reports:')).toBeInTheDocument();
      expect(screen.getByText('Symptom A')).toBeInTheDocument();
      expect(screen.getByText('Symptom B')).toBeInTheDocument();
    });

    it('renders isChild labelValue items with ml-6 indent (sm size)', () => {
      const childSectionProps = {
        ...defaultProps,
        sections: [
          {
            title: 'Parent Section',
            items: [
              { type: 'labelValue' as const, label: 'Parent', value: 'PVal' },
              { type: 'labelValue' as const, label: 'Child', value: 'CVal', isChild: true },
            ],
          },
        ],
      };

      const { container } = render(<VitalConfirmationModal {...childSectionProps} />);

      expect(screen.getByText('Parent')).toBeInTheDocument();
      expect(screen.getByText('PVal')).toBeInTheDocument();
      expect(screen.getByText('Child')).toBeInTheDocument();
      expect(screen.getByText('CVal')).toBeInTheDocument();

      // Child row should have ml-6 class
      const sectionItemsContainer = container.querySelector('.mt-2.space-y-2');
      const gridItems = sectionItemsContainer?.querySelectorAll('[class*="grid"]');
      expect(gridItems).toHaveLength(2);

      // Parent row should NOT have ml-6
      expect(gridItems![0]).not.toHaveClass('ml-6');
      expect(gridItems![0]).toHaveClass('grid-cols-[0px_150px_1fr]');

      // Child row should have ml-6 and different grid columns
      expect(gridItems![1]).toHaveClass('ml-6');
      expect(gridItems![1]).toHaveClass('grid-cols-[0px_120px_1fr]');
    });

    it('renders isChild labelValue items with ml-6 indent (lg size)', () => {
      const childSectionProps = {
        ...defaultProps,
        size: 'lg' as const,
        sections: [
          {
            title: 'Parent Section',
            items: [
              { type: 'labelValue' as const, label: 'Parent', value: 'PVal' },
              { type: 'labelValue' as const, label: 'Child', value: 'CVal', isChild: true },
            ],
          },
        ],
      };

      const { container } = render(<VitalConfirmationModal {...childSectionProps} />);

      const sectionItemsContainer = container.querySelector('.mt-2.space-y-2');
      const gridItems = sectionItemsContainer?.querySelectorAll('[class*="grid"]');
      expect(gridItems).toHaveLength(2);

      // Parent row (lg) should use lg grid columns
      expect(gridItems![0]).not.toHaveClass('ml-6');
      expect(gridItems![0]).toHaveClass('grid-cols-[0px_240px_260px]');

      // Child row (lg) should have ml-6 and lg child grid columns
      expect(gridItems![1]).toHaveClass('ml-6');
      expect(gridItems![1]).toHaveClass('grid-cols-[0px_200px_1fr]');
    });

    it('renders isChild=false same as no isChild property', () => {
      const sectionProps = {
        ...defaultProps,
        sections: [
          {
            title: 'Section',
            items: [
              { type: 'labelValue' as const, label: 'Normal', value: 'V1' },
              { type: 'labelValue' as const, label: 'Explicit', value: 'V2', isChild: false },
            ],
          },
        ],
      };

      const { container } = render(<VitalConfirmationModal {...sectionProps} />);

      const sectionItemsContainer = container.querySelector('.mt-2.space-y-2');
      const gridItems = sectionItemsContainer?.querySelectorAll('[class*="grid"]');
      expect(gridItems).toHaveLength(2);

      // Both should have the same parent-style columns and no ml-6
      expect(gridItems![0]).not.toHaveClass('ml-6');
      expect(gridItems![1]).not.toHaveClass('ml-6');
      expect(gridItems![0]).toHaveClass('grid-cols-[0px_150px_1fr]');
      expect(gridItems![1]).toHaveClass('grid-cols-[0px_150px_1fr]');
    });

    it('renders null value in isChild items as "No information"', () => {
      const childNullProps = {
        ...defaultProps,
        sections: [
          {
            title: 'Section',
            items: [
              { type: 'labelValue' as const, label: 'Child Null', value: null, isChild: true },
            ],
          },
        ],
      };

      render(<VitalConfirmationModal {...childNullProps} />);

      expect(screen.getByText('No information')).toBeInTheDocument();
      expect(screen.getByText('Child Null')).toBeInTheDocument();
    });

    it('returns null for unknown item types in sections', () => {
      const unknownTypeSectionProps = {
        ...defaultProps,
        sections: [
          {
            title: 'Section With Unknown',
            items: [
              { type: 'labelValue' as const, label: 'Known', value: 'Val' },
              { type: 'unknownType' as any, label: 'X', value: 'Y' },
            ],
          },
        ],
      };

      const { container } = render(<VitalConfirmationModal {...unknownTypeSectionProps} />);

      expect(screen.getByText('Known')).toBeInTheDocument();
      expect(screen.getByText('Val')).toBeInTheDocument();
      // The unknown item type renders null, so only 1 grid row should exist
      const sectionItemsContainer = container.querySelector('.mt-2.space-y-2');
      const gridItems = sectionItemsContainer?.querySelectorAll('[class*="grid"]');
      expect(gridItems).toHaveLength(1);
    });
  });
});
