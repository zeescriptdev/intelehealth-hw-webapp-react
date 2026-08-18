import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AyuPhysicalExamOptions } from '../../../../../modules/ayu/components/common/ayu-physical-exam-options.component';
import type { AyuQuestion } from '../../../../../modules/ayu-library/types/ayu.types';
import {
  EXT_URL_DISPLAY_TEXT,
  EXT_URL_IS_EXCLUSIVE_OPTION,
  EXT_URL_MUTUALLY_EXCLUSIVE,
  EXT_URL_PE_CATEGORY_LABEL,
  EXT_URL_PE_OPTION_KIND,
  EXT_URL_PE_SECTION_KEY,
  PE_OPTION_KIND_CAMERA,
} from '../../../../../modules/ayu-library/utils/constants';

/* Camera-context mock with mutable handlers so tests can:
 *   - vary the images returned by cameraImagesFor
 *   - assert addCameraImage / removeCameraImage / clearCameraImages calls
 *   - control jobAidUrlFor / jobAidTypeFor return values per case */
const cameraState = {
  imagesByQ: {} as Record<string, string[]>,
  addCameraImage: vi.fn(),
  removeCameraImage: vi.fn(),
  clearCameraImages: vi.fn(),
  commitQuestionImages: vi.fn(),
  jobAidUrl: null as string | null,
  jobAidType: null as 'image' | 'video' | null,
  cameraReturnsNull: false,
};

vi.mock(
  '../../../../../modules/ayu/components/start-visit/physical-examination/physical-exam-camera-context',
  () => ({
    usePhysicalExamCamera: () =>
      cameraState.cameraReturnsNull
        ? null
        : {
            cameraImagesFor: (qId: string) => cameraState.imagesByQ[qId] ?? [],
            addCameraImage: cameraState.addCameraImage,
            removeCameraImage: cameraState.removeCameraImage,
            clearCameraImages: cameraState.clearCameraImages,
            commitQuestionImages: cameraState.commitQuestionImages,
            jobAidUrlFor: () => cameraState.jobAidUrl,
            jobAidTypeFor: () => cameraState.jobAidType,
          },
  })
);

/* PhysicalExamImageCapture mock exposes onAdd/onRemove via buttons so we can
 * verify the wiring without dragging in the real capture UI. */
vi.mock(
  '../../../../../modules/ayu/components/start-visit/physical-examination/physical-exam-image-capture.component',
  () => ({
    PhysicalExamImageCapture: ({
      onAdd,
      onRemove,
    }: {
      images: string[];
      onAdd: (f: File) => void;
      onRemove: (i: number) => void;
    }) => (
      <div>
        <button
          data-testid="image-capture-add"
          onClick={() => onAdd(new File([''], 'test.png'))}
        >
          add
        </button>
        <button
          data-testid="image-capture-remove"
          onClick={() => onRemove(0)}
        >
          remove
        </button>
      </div>
    ),
  })
);

/*
 * Shape produced by transformFhirPhysExamToAyu for the real physExam.json
 * wrapper pattern — the inner choice surfaced as the AyuQuestion with PE
 * section/category extensions, real Yes/No options, and a camera option
 * derived from the attachment child.
 */
const makePeQuestion = (overrides: Partial<AyuQuestion> = {}): AyuQuestion => ({
  linkId: 'inner-jaundice',
  text: 'Is there jaundice?',
  type: 'choice',
  required: true,
  extension: [
    { url: EXT_URL_PE_SECTION_KEY, valueString: 'General Exams' },
    { url: EXT_URL_PE_CATEGORY_LABEL, valueString: 'Eyes: Jaundice' },
  ],
  answerOption: [
    { valueCoding: { code: 'no', display: 'No' } },
    { valueCoding: { code: 'yes', display: 'Yes' } },
    {
      valueCoding: { code: 'cam', display: 'Take a picture' },
      extension: [
        { url: EXT_URL_PE_OPTION_KIND, valueString: PE_OPTION_KIND_CAMERA },
        { url: EXT_URL_IS_EXCLUSIVE_OPTION, valueString: 'true' },
      ],
    },
  ],
  ...overrides,
});

beforeEach(() => {
  cameraState.imagesByQ = {};
  cameraState.jobAidUrl = null;
  cameraState.jobAidType = null;
  cameraState.cameraReturnsNull = false;
  cameraState.addCameraImage.mockReset();
  cameraState.removeCameraImage.mockReset();
  cameraState.clearCameraImages.mockReset();
  cameraState.commitQuestionImages.mockReset();
});

describe('AyuPhysicalExamOptions', () => {
  describe('rendering', () => {
    it('renders regular Yes/No options alongside the camera tile', () => {
      render(
        <AyuPhysicalExamOptions
          question={makePeQuestion()}
          value={undefined}
          setAnswer={vi.fn()}
        />
      );
      expect(screen.getByRole('button', { name: /^No$/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Yes$/ })).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Take a Picture/ })
      ).toBeInTheDocument();
    });

    it('returns null when question prop is missing', () => {
      const { container } = render(
        <AyuPhysicalExamOptions value={undefined} setAnswer={vi.fn()} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders section and category labels from PE extensions', () => {
      render(
        <AyuPhysicalExamOptions
          question={makePeQuestion()}
          value={undefined}
          setAnswer={vi.fn()}
        />
      );
      expect(screen.getByText('General Exams')).toBeInTheDocument();
      expect(screen.getByText('Eyes: Jaundice')).toBeInTheDocument();
    });

    it('renders the required asterisk when question.required is true', () => {
      render(
        <AyuPhysicalExamOptions
          question={makePeQuestion()}
          value={undefined}
          setAnswer={vi.fn()}
        />
      );
      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('renders the question text as the label when no display extension is set', () => {
      render(
        <AyuPhysicalExamOptions
          question={makePeQuestion()}
          value={undefined}
          setAnswer={vi.fn()}
        />
      );
      expect(screen.getByText(/Is there jaundice\?/)).toBeInTheDocument();
    });

    it('prefers the display extension over text for the question label', () => {
      const question = makePeQuestion({
        text: 'Short text',
        extension: [
          { url: EXT_URL_PE_SECTION_KEY, valueString: 'General Exams' },
          { url: EXT_URL_PE_CATEGORY_LABEL, valueString: 'Eyes: Jaundice' },
          { url: EXT_URL_DISPLAY_TEXT, valueString: 'Long display label' },
        ],
      });
      render(
        <AyuPhysicalExamOptions
          question={question}
          value={undefined}
          setAnswer={vi.fn()}
        />
      );
      expect(screen.getByText(/Long display label/)).toBeInTheDocument();
      expect(screen.queryByText(/^Short text$/)).not.toBeInTheDocument();
    });

    it('renders an image job aid when jobAidType is image', () => {
      cameraState.jobAidUrl = 'http://example/aid.png';
      cameraState.jobAidType = 'image';
      render(
        <AyuPhysicalExamOptions
          question={makePeQuestion()}
          value={undefined}
          setAnswer={vi.fn()}
        />
      );
      expect(screen.getByText('References:')).toBeInTheDocument();
      const img = screen.getByAltText('Eyes: Jaundice') as HTMLImageElement;
      expect(img.src).toContain('aid.png');
    });

    it('renders a video job aid when jobAidType is video', () => {
      cameraState.jobAidUrl = 'http://example/aid.mp4';
      cameraState.jobAidType = 'video';
      const { container } = render(
        <AyuPhysicalExamOptions
          question={makePeQuestion()}
          value={undefined}
          setAnswer={vi.fn()}
        />
      );
      const video = container.querySelector('video');
      expect(video).not.toBeNull();
      expect(video?.getAttribute('src')).toContain('aid.mp4');
    });

    it('falls back to valueString when an option has no valueCoding.code', () => {
      const question: AyuQuestion = {
        linkId: 'q',
        text: 'Q',
        type: 'choice',
        extension: [
          { url: EXT_URL_PE_SECTION_KEY, valueString: 'General Exams' },
        ],
        answerOption: [
          { valueString: 'plain-string' },
          { valueCoding: { code: 'other', display: 'Other' } },
        ],
      };
      const setAnswer = vi.fn();
      render(
        <AyuPhysicalExamOptions
          question={question}
          value={undefined}
          setAnswer={setAnswer}
        />
      );
      expect(
        screen.getByRole('button', { name: 'plain-string' })
      ).toBeInTheDocument();
    });

    it('skips empty answerOption entries without a code or valueString', () => {
      const question: AyuQuestion = {
        linkId: 'q',
        text: 'Q',
        type: 'choice',
        extension: [
          { url: EXT_URL_PE_SECTION_KEY, valueString: 'General Exams' },
        ],
        answerOption: [{}, { valueCoding: { code: 'real', display: 'Real' } }],
      };
      render(
        <AyuPhysicalExamOptions
          question={question}
          value={undefined}
          setAnswer={vi.fn()}
        />
      );
      // Only the entry with a code should render
      expect(screen.getAllByRole('button')).toHaveLength(1);
    });

    it('renders fine when camera context is null (e.g. provider not mounted)', () => {
      cameraState.cameraReturnsNull = true;
      render(
        <AyuPhysicalExamOptions
          question={makePeQuestion()}
          value={undefined}
          setAnswer={vi.fn()}
        />
      );
      expect(screen.getByRole('button', { name: /^No$/ })).toBeInTheDocument();
    });

    it('renders nothing in the option row when answerOption is omitted entirely', () => {
      // Covers the `question.answerOption ?? []` fallback path.
      const question: AyuQuestion = {
        linkId: 'q',
        text: 'Q',
        type: 'choice',
        extension: [
          { url: EXT_URL_PE_SECTION_KEY, valueString: 'General Exams' },
        ],
      };
      render(
        <AyuPhysicalExamOptions
          question={question}
          value={undefined}
          setAnswer={vi.fn()}
        />
      );
      // No option buttons render
      expect(screen.queryAllByRole('button')).toHaveLength(0);
    });

    it('does not render the section/category label row when neither extension is present', () => {
      // Covers the false branch of `(sectionLabel || categoryLabel) && ...`.
      const question: AyuQuestion = {
        linkId: 'q',
        text: 'Q',
        type: 'choice',
        // No PE_SECTION_KEY or PE_CATEGORY_LABEL extension
        answerOption: [{ valueCoding: { code: 'yes', display: 'Yes' } }],
      };
      const { container } = render(
        <AyuPhysicalExamOptions
          question={question}
          value={undefined}
          setAnswer={vi.fn()}
        />
      );
      // The label row has class "pb-1"; absent when no labels present.
      expect(container.querySelector('.pb-1')).toBeNull();
    });

    it('renders the image job aid with empty alt when no category label is set', () => {
      // Covers the `categoryLabel ?? ''` fallback on the img alt attribute.
      cameraState.jobAidUrl = 'http://example/aid.png';
      cameraState.jobAidType = 'image';
      const question: AyuQuestion = {
        linkId: 'q',
        text: 'Q',
        type: 'choice',
        extension: [
          { url: EXT_URL_PE_SECTION_KEY, valueString: 'General Exams' },
        ],
        // no PE_CATEGORY_LABEL
        answerOption: [{ valueCoding: { code: 'yes', display: 'Yes' } }],
      };
      render(
        <AyuPhysicalExamOptions
          question={question}
          value={undefined}
          setAnswer={vi.fn()}
        />
      );
      // alt is empty string — query by other attributes
      const img = screen.getByAltText('') as HTMLImageElement;
      expect(img.src).toContain('aid.png');
    });

    it('falls back to optId for the option label and icon when display and valueString are absent', () => {
      /* Covers the `?? optId` and `?? ''` fallbacks in the regular options
         map (label resolution + getOptionIcon argument). */
      const question: AyuQuestion = {
        linkId: 'q',
        text: 'Q',
        type: 'choice',
        extension: [
          { url: EXT_URL_PE_SECTION_KEY, valueString: 'General Exams' },
        ],
        answerOption: [
          { valueCoding: { code: 'only-code' } },
          { valueCoding: { code: 'other', display: 'Other' } },
        ],
      };
      render(
        <AyuPhysicalExamOptions
          question={question}
          value={undefined}
          setAnswer={vi.fn()}
        />
      );
      // No display or valueString — the button label falls back to the code
      expect(
        screen.getByRole('button', { name: 'only-code' })
      ).toBeInTheDocument();
    });

    it('renders the camera tile with the hardcoded "Take a Picture" label regardless of the option display', () => {
      /*
       * The component intentionally ignores the option's display value because
       * physExam.json sometimes carries marker strings (e.g. "[picture taken]")
       * in that slot. The tile must always read "Take a Picture".
       */
      const question: AyuQuestion = {
        linkId: 'q',
        text: 'Q',
        type: 'choice',
        extension: [
          { url: EXT_URL_PE_SECTION_KEY, valueString: 'General Exams' },
        ],
        answerOption: [
          {
            valueCoding: { code: 'cam', display: '[picture taken]' },
            extension: [
              {
                url: EXT_URL_PE_OPTION_KIND,
                valueString: PE_OPTION_KIND_CAMERA,
              },
            ],
          },
        ],
      };
      render(
        <AyuPhysicalExamOptions
          question={question}
          value={undefined}
          setAnswer={vi.fn()}
        />
      );
      expect(
        screen.getByRole('button', { name: 'Take a Picture' })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /picture taken/i })
      ).not.toBeInTheDocument();
    });

    it('auto-selects and hides the tile when there is only one non-camera regular option', () => {
      const question: AyuQuestion = {
        linkId: 'bp',
        text: 'Blood Pressure',
        type: 'choice',
        extension: [
          { url: EXT_URL_PE_SECTION_KEY, valueString: 'General Exams' },
        ],
        answerOption: [
          {
            valueCoding: {
              code: 'lying-down',
              display: 'Take the patient\'s BP lying down',
            },
          },
        ],
      };
      const setAnswer = vi.fn();
      render(
        <AyuPhysicalExamOptions
          question={question}
          value={undefined}
          setAnswer={setAnswer}
        />
      );
      // The single option tile should NOT be visible
      expect(
        screen.queryByRole('button', { name: /lying down/i })
      ).not.toBeInTheDocument();
      // setAnswer should have been called to auto-select
      expect(setAnswer).toHaveBeenCalledWith(question, 'lying-down');
    });

    it('auto-selects using valueString fallback when valueCoding.code is absent', () => {
      const question: AyuQuestion = {
        linkId: 'bp2',
        text: 'Blood Pressure',
        type: 'choice',
        extension: [
          { url: EXT_URL_PE_SECTION_KEY, valueString: 'General Exams' },
        ],
        answerOption: [
          { valueString: 'lying-vs' },
        ],
      };
      const setAnswer = vi.fn();
      render(
        <AyuPhysicalExamOptions
          question={question}
          value={undefined}
          setAnswer={setAnswer}
        />
      );
      expect(setAnswer).toHaveBeenCalledWith(question, 'lying-vs');
    });

    it('shows camera tile when single regular option with camera option present', () => {
      const question: AyuQuestion = {
        linkId: 'bp-cam',
        text: 'Blood Pressure',
        type: 'choice',
        extension: [
          { url: EXT_URL_PE_SECTION_KEY, valueString: 'General Exams' },
        ],
        answerOption: [
          {
            valueCoding: { code: 'lying-down', display: 'Lying down' },
          },
          {
            valueCoding: { code: 'cam', display: 'Take a Picture' },
            extension: [
              { url: EXT_URL_PE_OPTION_KIND, valueString: PE_OPTION_KIND_CAMERA },
            ],
          },
        ],
      };
      const setAnswer = vi.fn();
      render(
        <AyuPhysicalExamOptions
          question={question}
          value={undefined}
          setAnswer={setAnswer}
        />
      );
      // Auto-selected single regular option
      expect(setAnswer).toHaveBeenCalledWith(question, 'lying-down');
      // Regular option tile hidden but camera tile visible
      expect(
        screen.queryByRole('button', { name: /Lying down/i })
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Take a Picture/i })
      ).toBeInTheDocument();
    });
  });

  describe('regular option click handling', () => {
    it('calls setAnswer with the option code when a single-choice option is clicked', async () => {
      const setAnswer = vi.fn();
      const question = makePeQuestion();
      render(
        <AyuPhysicalExamOptions
          question={question}
          value={undefined}
          setAnswer={setAnswer}
        />
      );
      await userEvent.click(screen.getByRole('button', { name: /^No$/ }));
      expect(setAnswer).toHaveBeenCalledTimes(1);
      expect(setAnswer).toHaveBeenCalledWith(question, 'no');
    });

    it('highlights the selected option when value matches', () => {
      render(
        <AyuPhysicalExamOptions
          question={makePeQuestion()}
          value="yes"
          setAnswer={vi.fn()}
        />
      );
      expect(screen.getByRole('button', { name: /^Yes$/ })).toHaveClass(
        'selected'
      );
      expect(screen.getByRole('button', { name: /^No$/ })).not.toHaveClass(
        'selected'
      );
    });

    it('pre-selects the camera tile when a committed answer holds the camera code (edit)', () => {
      /* On revisit/edit the saved answer carries the camera code; the tile must
         come back pre-selected instead of looking unanswered. */
      render(
        <AyuPhysicalExamOptions
          question={makePeQuestion()}
          value={['cam']}
          setAnswer={vi.fn()}
        />
      );
      expect(
        screen.getByRole('button', { name: /Take a Picture/ })
      ).toHaveClass('selected');
    });

    it('clears the committed camera answer when the pre-selected tile is deselected', async () => {
      const setAnswer = vi.fn();
      render(
        <AyuPhysicalExamOptions
          question={makePeQuestion()}
          value={['cam']}
          setAnswer={setAnswer}
        />
      );
      await userEvent.click(
        screen.getByRole('button', { name: /Take a Picture/ })
      );
      // single-choice → cleared to empty string
      expect(setAnswer).toHaveBeenCalledWith(makePeQuestion(), '');
    });

    it('shows uploaded pictures, add/remove and the Upload button on edit (no prior click)', () => {
      cameraState.imagesByQ['inner-jaundice'] = ['img-1', 'img-2'];
      render(
        <AyuPhysicalExamOptions
          question={makePeQuestion()}
          value={['cam']}
          setAnswer={vi.fn()}
        />
      );
      // capture panel + Upload button appear immediately in edit mode
      expect(screen.getByTestId('image-capture-add')).toBeInTheDocument();
      expect(screen.getByTestId('image-capture-remove')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Upload \(2\)/ })
      ).toBeInTheDocument();
    });

    it('shows the upload-required error on edit when the picture option is committed but has no images', () => {
      /* committed camera answer but no images (all removed / restore empty) is
         an invalid state — the user must add a picture before it can stand. */
      cameraState.imagesByQ = {};
      render(
        <AyuPhysicalExamOptions
          question={makePeQuestion()}
          value={['cam']}
          setAnswer={vi.fn()}
        />
      );
      expect(
        screen.getByText('Please upload at least one image')
      ).toBeInTheDocument();
    });

    it('does not show the upload-required error on edit while the committed picture still has images', () => {
      cameraState.imagesByQ['inner-jaundice'] = ['img-1'];
      render(
        <AyuPhysicalExamOptions
          question={makePeQuestion()}
          value={['cam']}
          setAnswer={vi.fn()}
        />
      );
      expect(
        screen.queryByText('Please upload at least one image')
      ).not.toBeInTheDocument();
    });

    it('removes an uploaded picture on edit via the capture panel', async () => {
      cameraState.imagesByQ['inner-jaundice'] = ['img-1'];
      render(
        <AyuPhysicalExamOptions
          question={makePeQuestion()}
          value={['cam']}
          setAnswer={vi.fn()}
        />
      );
      await userEvent.click(screen.getByTestId('image-capture-remove'));
      expect(cameraState.removeCameraImage).toHaveBeenCalledWith(
        'inner-jaundice',
        0
      );
    });

    it('adds a picture on edit via the capture panel', async () => {
      cameraState.imagesByQ['inner-jaundice'] = ['img-1'];
      render(
        <AyuPhysicalExamOptions
          question={makePeQuestion()}
          value={['cam']}
          setAnswer={vi.fn()}
        />
      );
      await userEvent.click(screen.getByTestId('image-capture-add'));
      expect(cameraState.addCameraImage).toHaveBeenCalledWith(
        'inner-jaundice',
        expect.any(File)
      );
    });

    it('toggles a new option into the array for multi-choice', async () => {
      const setAnswer = vi.fn();
      const question = makePeQuestion({ repeats: true });
      render(
        <AyuPhysicalExamOptions
          question={question}
          value={[]}
          setAnswer={setAnswer}
        />
      );
      await userEvent.click(screen.getByRole('button', { name: /^Yes$/ }));
      expect(setAnswer).toHaveBeenCalledWith(question, ['yes']);
    });

    it('removes an already-selected option from the array for multi-choice', async () => {
      const setAnswer = vi.fn();
      const question = makePeQuestion({ repeats: true });
      render(
        <AyuPhysicalExamOptions
          question={question}
          value={['yes', 'no']}
          setAnswer={setAnswer}
        />
      );
      await userEvent.click(screen.getByRole('button', { name: /^Yes$/ }));
      expect(setAnswer).toHaveBeenCalledWith(question, ['no']);
    });
  });

  describe('mutually-exclusive multi-choice handling', () => {
    /* A multi-choice PE question whose "None" option carries the
     * exclude-from-multi-choice marker (EXT_URL_MUTUALLY_EXCLUSIVE), as
     * produced by buildPhysExamQuestion when the protocol marks an option
     * exclusive. computeMultiSelectToggle must enforce the exclusivity. */
    const makeExclusiveQuestion = (): AyuQuestion => ({
      linkId: 'pe-multi',
      text: 'Any abnormal findings?',
      type: 'choice',
      required: true,
      repeats: true,
      extension: [
        { url: EXT_URL_PE_SECTION_KEY, valueString: 'General Exams' },
        { url: EXT_URL_PE_CATEGORY_LABEL, valueString: 'Skin' },
      ],
      answerOption: [
        {
          valueCoding: { code: 'none', display: 'None' },
          extension: [
            { url: EXT_URL_MUTUALLY_EXCLUSIVE, valueString: 'true' },
          ],
        },
        { valueCoding: { code: 'rash', display: 'Rash' } },
        { valueCoding: { code: 'pallor', display: 'Pallor' } },
      ],
    });

    it('clears existing selections when an exclusive option is chosen', async () => {
      const setAnswer = vi.fn();
      const question = makeExclusiveQuestion();
      render(
        <AyuPhysicalExamOptions
          question={question}
          value={['rash', 'pallor']}
          setAnswer={setAnswer}
        />
      );
      await userEvent.click(screen.getByRole('button', { name: /^None$/ }));
      // Selecting the exclusive option replaces all other selections.
      expect(setAnswer).toHaveBeenCalledWith(question, ['none']);
    });

    it('clears the exclusive option when a normal option is chosen', async () => {
      const setAnswer = vi.fn();
      const question = makeExclusiveQuestion();
      render(
        <AyuPhysicalExamOptions
          question={question}
          value={['none']}
          setAnswer={setAnswer}
        />
      );
      await userEvent.click(screen.getByRole('button', { name: /^Rash$/ }));
      // Picking a normal finding drops the previously-selected exclusive option.
      expect(setAnswer).toHaveBeenCalledWith(question, ['rash']);
    });

    it('deselects the exclusive option when it is clicked again', async () => {
      const setAnswer = vi.fn();
      const question = makeExclusiveQuestion();
      render(
        <AyuPhysicalExamOptions
          question={question}
          value={['none']}
          setAnswer={setAnswer}
        />
      );
      await userEvent.click(screen.getByRole('button', { name: /^None$/ }));
      expect(setAnswer).toHaveBeenCalledWith(question, []);
    });

    it('keeps adding normal options together (exclusivity does not affect them)', async () => {
      const setAnswer = vi.fn();
      const question = makeExclusiveQuestion();
      render(
        <AyuPhysicalExamOptions
          question={question}
          value={['rash']}
          setAnswer={setAnswer}
        />
      );
      await userEvent.click(screen.getByRole('button', { name: /^Pallor$/ }));
      expect(setAnswer).toHaveBeenCalledWith(question, ['rash', 'pallor']);
    });
  });

  describe('camera tile click handling', () => {
    it('selects the camera tile locally on first click (does not commit answer)', async () => {
      const setAnswer = vi.fn();
      render(
        <AyuPhysicalExamOptions
          question={makePeQuestion()}
          value={undefined}
          setAnswer={setAnswer}
        />
      );
      const camTile = screen.getByRole('button', { name: /Take a Picture/ });
      await userEvent.click(camTile);
      /* Tile becomes selected, but the answer hasn't been written yet — that
         happens on Submit (with images present). */
      expect(camTile).toHaveClass('selected');
      expect(setAnswer).not.toHaveBeenCalled();
    });

    it('clears images and deselects when the camera tile is clicked a second time', async () => {
      render(
        <AyuPhysicalExamOptions
          question={makePeQuestion()}
          value={undefined}
          setAnswer={vi.fn()}
        />
      );
      const camTile = screen.getByRole('button', { name: /Take a Picture/ });
      await userEvent.click(camTile);
      await userEvent.click(camTile);
      expect(cameraState.clearCameraImages).toHaveBeenCalledWith(
        'inner-jaundice'
      );
      expect(camTile).not.toHaveClass('selected');
    });

    it('does nothing when there is no camera option to identify a code', async () => {
      const question: AyuQuestion = {
        linkId: 'q',
        text: 'Q',
        type: 'choice',
        extension: [
          { url: EXT_URL_PE_SECTION_KEY, valueString: 'General Exams' },
        ],
        answerOption: [{ valueCoding: { code: 'no', display: 'No' } }],
      };
      /* No tile to click since no camera option — verify the component renders
         and doesn't throw. */
      render(
        <AyuPhysicalExamOptions
          question={question}
          value={undefined}
          setAnswer={vi.fn()}
        />
      );
      expect(
        screen.queryByRole('button', { name: /Take a Picture/ })
      ).not.toBeInTheDocument();
    });
  });

  describe('image capture wiring', () => {
    it('forwards add and remove image events to the camera context', async () => {
      render(
        <AyuPhysicalExamOptions
          question={makePeQuestion()}
          value={undefined}
          setAnswer={vi.fn()}
        />
      );
      await userEvent.click(
        screen.getByRole('button', { name: /Take a Picture/ })
      );
      await userEvent.click(screen.getByTestId('image-capture-add'));
      expect(cameraState.addCameraImage).toHaveBeenCalledWith(
        'inner-jaundice',
        expect.any(File)
      );
      await userEvent.click(screen.getByTestId('image-capture-remove'));
      expect(cameraState.removeCameraImage).toHaveBeenCalledWith(
        'inner-jaundice',
        0
      );
    });
  });

  describe('camera Submit behaviour', () => {
    it('shows Upload button with image count once images are captured', async () => {
      cameraState.imagesByQ['inner-jaundice'] = ['img-1', 'img-2'];
      render(
        <AyuPhysicalExamOptions
          question={makePeQuestion()}
          value={undefined}
          setAnswer={vi.fn()}
        />
      );
      await userEvent.click(
        screen.getByRole('button', { name: /Take a Picture/ })
      );
      // Submit button now visible, labelled with image count
      expect(
        screen.getByRole('button', { name: /Upload \(2\)/ })
      ).toBeInTheDocument();
    });

    it('commits the camera code as the answer for single-choice on Submit', async () => {
      cameraState.imagesByQ['inner-jaundice'] = ['img-1'];
      const setAnswer = vi.fn();
      const question = makePeQuestion();
      render(
        <AyuPhysicalExamOptions
          question={question}
          value={undefined}
          setAnswer={setAnswer}
        />
      );
      await userEvent.click(
        screen.getByRole('button', { name: /Take a Picture/ })
      );
      await userEvent.click(
        screen.getByRole('button', { name: /Upload \(1\)/ })
      );
      expect(setAnswer).toHaveBeenCalledWith(question, ['cam']);
    });

    it('calls commitQuestionImages on Upload click to move images to pending queue', async () => {
      cameraState.imagesByQ['inner-jaundice'] = ['img-1'];
      render(
        <AyuPhysicalExamOptions
          question={makePeQuestion()}
          value={undefined}
          setAnswer={vi.fn()}
        />
      );
      await userEvent.click(
        screen.getByRole('button', { name: /Take a Picture/ })
      );
      await userEvent.click(
        screen.getByRole('button', { name: /Upload \(1\)/ })
      );
      expect(cameraState.commitQuestionImages).toHaveBeenCalledWith(
        'inner-jaundice'
      );
    });

    it('does not call commitQuestionImages when Upload is clicked with no images', async () => {
      const images = ['img-1'];
      cameraState.imagesByQ['inner-jaundice'] = images;
      render(
        <AyuPhysicalExamOptions
          question={makePeQuestion()}
          value={undefined}
          setAnswer={vi.fn()}
        />
      );
      await userEvent.click(
        screen.getByRole('button', { name: /Take a Picture/ })
      );
      // Mutate array to empty before click
      images.length = 0;
      await userEvent.click(
        screen.getByRole('button', { name: /Upload \(1\)/ })
      );
      // Upload guard kicked in — commitQuestionImages was NOT called
      expect(cameraState.commitQuestionImages).not.toHaveBeenCalled();
    });

    it('lets a single-choice Yes/No be selected together with the camera tile and commits both on Submit', async () => {
      /*
       * Mobile parity: "Take a Picture" composes with the Yes/No finding instead
       * of replacing it. Selecting the camera tile first, then Yes, must keep
       * both highlighted and commit ['yes', 'cam'] on Upload.
       */
      cameraState.imagesByQ['inner-jaundice'] = ['img-1'];
      const setAnswer = vi.fn();
      const question = makePeQuestion();
      render(
        <AyuPhysicalExamOptions
          question={question}
          value={undefined}
          setAnswer={setAnswer}
        />
      );
      const camTile = screen.getByRole('button', { name: /Take a Picture/ });
      await userEvent.click(camTile);
      const yes = screen.getByRole('button', { name: /^Yes$/ });
      await userEvent.click(yes);
      // Both highlighted; picking Yes does NOT commit yet (no auto-advance).
      expect(camTile).toHaveClass('selected');
      expect(yes).toHaveClass('selected');
      expect(setAnswer).not.toHaveBeenCalled();
      // Upload commits the pair.
      await userEvent.click(
        screen.getByRole('button', { name: /Upload \(1\)/ })
      );
      expect(setAnswer).toHaveBeenCalledWith(question, ['yes', 'cam']);
    });

    it('toggles off the pending Yes/No when re-clicked while the camera is active', async () => {
      cameraState.imagesByQ['inner-jaundice'] = ['img-1'];
      const setAnswer = vi.fn();
      const question = makePeQuestion();
      render(
        <AyuPhysicalExamOptions
          question={question}
          value={undefined}
          setAnswer={setAnswer}
        />
      );
      await userEvent.click(
        screen.getByRole('button', { name: /Take a Picture/ })
      );
      const yes = screen.getByRole('button', { name: /^Yes$/ });
      await userEvent.click(yes);
      expect(yes).toHaveClass('selected');
      await userEvent.click(yes);
      expect(yes).not.toHaveClass('selected');
      await userEvent.click(
        screen.getByRole('button', { name: /Upload \(1\)/ })
      );
      // Yes was toggled off → camera-only answer.
      expect(setAnswer).toHaveBeenCalledWith(question, ['cam']);
    });

    it('keeps a committed Yes/No when deselecting an already-committed camera tile', async () => {
      // value holds both the finding and the picture marker (edit/revisit).
      cameraState.imagesByQ['inner-jaundice'] = ['img-1'];
      const setAnswer = vi.fn();
      const question = makePeQuestion();
      render(
        <AyuPhysicalExamOptions
          question={question}
          value={['yes', 'cam']}
          setAnswer={setAnswer}
        />
      );
      await userEvent.click(
        screen.getByRole('button', { name: /Take a Picture/ })
      );
      // Only the camera marker is stripped; the Yes finding survives.
      expect(setAnswer).toHaveBeenCalledWith(question, 'yes');
    });

    it('pre-selects both the Yes finding and the camera tile from a composed answer', () => {
      render(
        <AyuPhysicalExamOptions
          question={makePeQuestion()}
          value={['yes', 'cam']}
          setAnswer={vi.fn()}
        />
      );
      expect(screen.getByRole('button', { name: /^Yes$/ })).toHaveClass(
        'selected'
      );
      expect(
        screen.getByRole('button', { name: /Take a Picture/ })
      ).toHaveClass('selected');
    });

    it('appends the camera code to existing selections for multi-choice on Submit', async () => {
      cameraState.imagesByQ['inner-jaundice'] = ['img-1'];
      const setAnswer = vi.fn();
      const question = makePeQuestion({ repeats: true });
      render(
        <AyuPhysicalExamOptions
          question={question}
          value={['yes']}
          setAnswer={setAnswer}
        />
      );
      await userEvent.click(
        screen.getByRole('button', { name: /Take a Picture/ })
      );
      await userEvent.click(
        screen.getByRole('button', { name: /Upload \(1\)/ })
      );
      expect(setAnswer).toHaveBeenCalledWith(question, ['yes', 'cam']);
    });

    it('does not show Upload button when camera tile is selected but no images are captured', async () => {
      render(
        <AyuPhysicalExamOptions
          question={makePeQuestion()}
          value={undefined}
          setAnswer={vi.fn()}
        />
      );
      await userEvent.click(
        screen.getByRole('button', { name: /Take a Picture/ })
      );
      // Upload button hidden when no images — prevents premature submission
      expect(
        screen.queryByRole('button', { name: /Upload/ })
      ).not.toBeInTheDocument();
    });

    it('shows Upload button once an image is captured after selecting camera tile', async () => {
      cameraState.imagesByQ['inner-jaundice'] = ['img-1'];
      render(
        <AyuPhysicalExamOptions
          question={makePeQuestion()}
          value={undefined}
          setAnswer={vi.fn()}
        />
      );
      await userEvent.click(
        screen.getByRole('button', { name: /Take a Picture/ })
      );
      // Upload button appears now that images > 0
      expect(
        screen.getByRole('button', { name: /Upload \(1\)/ })
      ).toBeInTheDocument();
    });

    it('shows upload-required error when images are emptied between render and click', async () => {
      /*
       * Covers the defensive guard in handleSubmit (lines 125-128): if images
       * disappear after the Upload button was rendered but before the click
       * handler runs, the error state is set instead of committing.
       */
      const images = ['img-1'];
      cameraState.imagesByQ['inner-jaundice'] = images;
      render(
        <AyuPhysicalExamOptions
          question={makePeQuestion()}
          value={undefined}
          setAnswer={vi.fn()}
        />
      );
      // Select the camera tile → Upload button appears (images.length > 0)
      await userEvent.click(
        screen.getByRole('button', { name: /Take a Picture/ })
      );
      const uploadBtn = screen.getByRole('button', { name: /Upload \(1\)/ });
      // Mutate the SAME array reference to empty — the closure still holds it
      images.length = 0;
      // Click the Upload button — handleSubmit sees cameraImages.length === 0
      await userEvent.click(uploadBtn);
      expect(
        screen.getByText('Please upload at least one image')
      ).toBeInTheDocument();
    });

    it('does not render an inner Submit button for plain multi-choice (defers to outer stepper)', () => {
      render(
        <AyuPhysicalExamOptions
          question={makePeQuestion({ repeats: true })}
          value={['yes']}
          setAnswer={vi.fn()}
        />
      );
      expect(
        screen.queryByRole('button', { name: /Submit/i })
      ).not.toBeInTheDocument();
    });
  });

  describe('mutually-exclusive visual disabling', () => {
    const makeExclusiveQuestion = (): AyuQuestion => ({
      linkId: 'pe-multi',
      text: 'Any abnormal findings?',
      type: 'choice',
      required: true,
      repeats: true,
      extension: [
        { url: EXT_URL_PE_SECTION_KEY, valueString: 'General Exams' },
        { url: EXT_URL_PE_CATEGORY_LABEL, valueString: 'Skin' },
      ],
      answerOption: [
        {
          valueCoding: { code: 'none', display: 'None' },
          extension: [
            { url: EXT_URL_MUTUALLY_EXCLUSIVE, valueString: 'true' },
          ],
        },
        { valueCoding: { code: 'rash', display: 'Rash' } },
        { valueCoding: { code: 'pallor', display: 'Pallor' } },
      ],
    });

    it('applies disabled class to non-exclusive options when exclusive option is selected', () => {
      render(
        <AyuPhysicalExamOptions
          question={makeExclusiveQuestion()}
          value={['none']}
          setAnswer={vi.fn()}
        />
      );
      // Exclusive option "None" is selected → normal options get disabled class
      expect(screen.getByRole('button', { name: /^Rash$/ })).toHaveClass('disabled');
      expect(screen.getByRole('button', { name: /^Pallor$/ })).toHaveClass('disabled');
      // Exclusive option itself is NOT disabled
      expect(screen.getByRole('button', { name: /^None$/ })).not.toHaveClass('disabled');
    });

    it('applies disabled class to exclusive option when non-exclusive options are selected', () => {
      render(
        <AyuPhysicalExamOptions
          question={makeExclusiveQuestion()}
          value={['rash', 'pallor']}
          setAnswer={vi.fn()}
        />
      );
      // Non-exclusive options selected → exclusive option gets disabled class
      expect(screen.getByRole('button', { name: /^None$/ })).toHaveClass('disabled');
      // Non-exclusive options are NOT disabled
      expect(screen.getByRole('button', { name: /^Rash$/ })).not.toHaveClass('disabled');
      expect(screen.getByRole('button', { name: /^Pallor$/ })).not.toHaveClass('disabled');
    });

    it('does not apply disabled class when no options are selected', () => {
      render(
        <AyuPhysicalExamOptions
          question={makeExclusiveQuestion()}
          value={[]}
          setAnswer={vi.fn()}
        />
      );
      expect(screen.getByRole('button', { name: /^None$/ })).not.toHaveClass('disabled');
      expect(screen.getByRole('button', { name: /^Rash$/ })).not.toHaveClass('disabled');
      expect(screen.getByRole('button', { name: /^Pallor$/ })).not.toHaveClass('disabled');
    });

    it('does not apply disabled class for single-choice (non-repeats) questions', () => {
      const q: AyuQuestion = {
        ...makeExclusiveQuestion(),
        repeats: false,
      };
      render(
        <AyuPhysicalExamOptions
          question={q}
          value={'none'}
          setAnswer={vi.fn()}
        />
      );
      // Single-choice: no mutual exclusivity disabling
      expect(screen.getByRole('button', { name: /^Rash$/ })).not.toHaveClass('disabled');
      expect(screen.getByRole('button', { name: /^Pallor$/ })).not.toHaveClass('disabled');
    });

    it('disabled buttons are still clickable (visual-only) and toggle correctly', async () => {
      const setAnswer = vi.fn();
      render(
        <AyuPhysicalExamOptions
          question={makeExclusiveQuestion()}
          value={['rash']}
          setAnswer={setAnswer}
        />
      );
      // "None" is visually disabled but should still be clickable
      const noneButton = screen.getByRole('button', { name: /^None$/ });
      expect(noneButton).toHaveClass('disabled');
      await userEvent.click(noneButton);
      // computeMultiSelectToggle should replace 'rash' with 'none'
      expect(setAnswer).toHaveBeenCalledWith(
        expect.objectContaining({ linkId: 'pe-multi' }),
        ['none']
      );
    });
  });

  describe('multi-choice camera deselect with committed answer', () => {
    it('removes the camera code from the multi-choice answer array when deselecting a committed camera tile', async () => {
      const setAnswer = vi.fn();
      // repeats=true → multi-choice; value includes 'cam' → committed
      render(
        <AyuPhysicalExamOptions
          question={makePeQuestion({ repeats: true })}
          value={['yes', 'cam']}
          setAnswer={setAnswer}
        />
      );
      // Click the camera tile to deselect it
      await userEvent.click(
        screen.getByRole('button', { name: /Take a Picture/ })
      );
      // Should filter out 'cam' from the array, leaving ['yes']
      expect(setAnswer).toHaveBeenCalledWith(
        expect.objectContaining({ linkId: 'inner-jaundice' }),
        ['yes']
      );
    });
  });
});
