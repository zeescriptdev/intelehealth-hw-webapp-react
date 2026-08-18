import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AyuQuestion } from '../../../../../modules/ayu-library/types/ayu.types';
import {
  EXT_URL_PE_CATEGORY_LABEL,
  EXT_URL_PE_OPTION_KIND,
  EXT_URL_PE_SECTION_KEY,
  PE_OPTION_KIND_CAMERA,
} from '../../../../../modules/ayu-library/utils/constants';

/*
 * The new PhysicalExamination component is a thin orchestrator on top of
 * AyuStepperContainer. We mock the stepper to capture props and drive its
 * callbacks; that gives us clean assertions on the boundary the component
 * actually owns (modal sections, adapter output, review-mode toggles).
 */

const mockShowVitalConfirmationModal = vi.fn();
const mockSetPhysicalExamData = vi.fn();
const mockSetPhysExamPendingImages = vi.fn();
const mockSaveSectionToTemp = vi.fn().mockResolvedValue(undefined);
const mockStepperConfirm = vi.fn();
const mockStepperShowSummary = vi.fn();

let capturedStepperProps: any = {};

vi.mock(
  '../../../../../modules/ayu/components/start-visit/visit-reason/ayu-stepper-container.component',
  async () => {
    const ReactModule = await vi.importActual<typeof import('react')>('react');
    return {
      AyuStepperContainer: ReactModule.forwardRef((props: any, ref: any) => {
        capturedStepperProps = props;
        ReactModule.useImperativeHandle(ref, () => ({
          confirm: mockStepperConfirm,
          showSummary: mockStepperShowSummary,
        }));
        return (
          <div data-testid="ayu-stepper-container">
            <button
              data-testid="trigger-complete"
              onClick={() =>
                props.onComplete?.((capturedStepperProps._completeAnswers as
                  | Record<string, unknown>
                  | undefined) ?? {})
              }
            >
              Trigger Complete
            </button>
          </div>
        );
      }),
    };
  }
);

/*
 * Captures the props passed to PhysicalExamCameraProvider so tests can
 * invoke the resolver callbacks the orchestrator wires up
 * (sectionCommentFor, jobAidUrlFor, jobAidTypeFor).
 */
const capturedProviderProps: {
  current: Record<string, unknown> | null;
} = { current: null };
/* When set to true the mocked usePhysicalExamCamera hook returns null so
   CameraImagesForCapture exercises its `camera == null` fallback branch. */
const cameraConsumerReturnsNull = { value: false };

vi.mock(
  '../../../../../modules/ayu/components/start-visit/physical-examination/physical-exam-camera-context',
  () => {
    const cameraImagesFor = vi.fn((qId: string) =>
      qId === 'with-images' ? ['data:image/png;base64,xxx'] : []
    );
    return {
      PhysicalExamCameraProvider: (props: {
        children: React.ReactNode;
        [k: string]: unknown;
      }) => {
        capturedProviderProps.current = props;
        return <div data-testid="camera-provider">{props.children}</div>;
      },
      usePhysicalExamCamera: () =>
        cameraConsumerReturnsNull.value
          ? null
          : {
              cameraImagesFor,
              addCameraImage: vi.fn(),
              removeCameraImage: vi.fn(),
              clearCameraImages: vi.fn(),
              commitQuestionImages: vi.fn(),
              jobAidUrlFor: () => null,
              jobAidTypeFor: () => null,
            },
    };
  }
);

vi.mock('../../../../../modules/ayu/hooks/useVisitReasons.hook', () => ({
  usePatientDemographics: vi.fn(() => ({ age: 30, gender: 'M' })),
}));

vi.mock('../../../../../components/modal/global-modal-context', () => ({
  useGlobalModal: () => ({
    showVitalConfirmationModal: mockShowVitalConfirmationModal,
    showConfirmModal: vi.fn(),
    closeModal: vi.fn(),
  }),
}));

let mockContextData: {
  physicalExam: {
    answers: Record<string, string[]>;
    details: Array<{ label: string; value: string }>;
  } | null;
} = { physicalExam: null };
const mockVisitId: { value: string | null | undefined } = {
  value: 'test-visit-id',
};

vi.mock('../../../../../modules/ayu/context/start-visit.context', () => ({
  useStartVisitData: () => ({
    data: {
      vitals: null,
      visitReason: null,
      physicalExam: mockContextData.physicalExam,
      medicalHistory: null,
      medicalHistoryAnswers: null,
    },
    patientUuid: null,
    visitId: mockVisitId.value,
    tempRecordId: null,
    isRestoring: false,
    restoredSectionIndex: null,
    lastSectionIndex: 0,
    setLastSectionIndex: vi.fn(),
    setPatientUuid: vi.fn(),
    setVitalsData: vi.fn(),
    setVisitReasonData: vi.fn(),
    setPhysicalExamData: mockSetPhysicalExamData,
    setMedicalHistoryData: vi.fn(),
    setMedicalHistoryAnswers: vi.fn(),
    saveSectionToTemp: mockSaveSectionToTemp,
    clearVisitId: vi.fn(),
    physExamPendingImages: [],
    setPhysExamPendingImages: mockSetPhysExamPendingImages,
  }),
}));

/*
 * Stub getJobAidUrl so jobAidUrlFor returns a predictable URL when the
 * orchestrator wires it through the provider. Returns null for the magic
 * filename "missing" so we can exercise the `?? null` fallback branch.
 */
vi.mock('../../../../../modules/ayu/utils/physExamAssets', () => ({
  getJobAidUrl: (file: string) =>
    file === 'missing' ? null : `assets/${file}.png`,
  /* Derives type from the bundled asset: 'vidfile' → video, 'imgfile' → image,
     anything else → undefined (no bundled asset → fall back to FHIR type). */
  getJobAidType: (file: string) =>
    file === 'vidfile' ? 'video' : file === 'imgfile' ? 'image' : undefined,
}));

const mockGetPendingImages = vi.fn().mockReturnValue([]);
vi.mock('../../../../../modules/ayu/services/obs.service', () => ({
  getPendingImages: () => mockGetPendingImages(),
}));

vi.mock('../../../../../assets/icons/icon-physical-examination.svg', () => ({
  default: 'physical-exam-icon.svg',
}));

vi.mock('../../../../../assets/icons/icon-right-arrow.svg', () => ({
  default: 'right-arrow-icon.svg',
}));

vi.mock('../../../../../modules/ayu/components/common/ayu-button.component', () => ({
  default: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

import { PhysicalExamination } from '../../../../../modules/ayu/components/start-visit/physical-examination/physical-examination.component';

const makeQuestion = (
  linkId: string,
  sectionKey: string,
  categoryLabel: string,
  options: Array<{ code: string; display: string; camera?: boolean }>
): AyuQuestion => ({
  linkId,
  text: `${categoryLabel}?`,
  type: 'choice',
  required: true,
  repeats: false,
  extension: [
    { url: EXT_URL_PE_SECTION_KEY, valueString: sectionKey },
    { url: EXT_URL_PE_CATEGORY_LABEL, valueString: categoryLabel },
  ],
  answerOption: options.map(o => ({
    valueCoding: { code: o.code, display: o.display },
    extension: o.camera
      ? [{ url: EXT_URL_PE_OPTION_KIND, valueString: PE_OPTION_KIND_CAMERA }]
      : undefined,
  })),
});

const makeAyuConfigFiles = (questions: AyuQuestion[]) => [
  {
    id: 1,
    name: 'physExam.json',
    keyName: 'physExam',
    isActive: true,
    json: {
      resourceType: 'Questionnaire' as const,
      title: 'Physical exam',
      /*
       * We feed the transformed-shape directly under the section-group structure
       * expected by transformFhirPhysExamToAyu. Sections wrap choice items with
       * concept-tag answerOptions.
       */
      item: [
        {
          linkId: 'sec-general',
          text: 'General',
          type: 'group',
          answerOption: questions
            .filter(q => {
              const sk = q.extension?.find(
                e => e.url === EXT_URL_PE_SECTION_KEY
              )?.valueString;
              return sk === 'General';
            })
            .map(q => ({
              valueCoding: {
                code: q.linkId,
                display:
                  q.extension?.find(e => e.url === EXT_URL_PE_CATEGORY_LABEL)
                    ?.valueString ?? q.linkId,
              },
            })),
          item: questions
            .filter(q => {
              const sk = q.extension?.find(
                e => e.url === EXT_URL_PE_SECTION_KEY
              )?.valueString;
              return sk === 'General';
            })
            .map(q => ({
              linkId: q.linkId,
              text: q.text,
              type: 'choice',
              required: q.required,
              /*
               * Forward job-aid extensions so the orchestrator's resolver
               * callbacks (jobAidUrlFor / jobAidTypeFor) can find them on the
               * transformed AyuQuestion.
               */
              extension: q.extension?.filter(
                e =>
                  e.url ===
                    'https://intelehealth.org/fhir/StructureDefinition/job-aid-file' ||
                  e.url ===
                    'https://intelehealth.org/fhir/StructureDefinition/job-aid-type'
              ),
              answerOption: q.answerOption?.filter(
                o =>
                  !o.extension?.some(e => e.url === EXT_URL_PE_OPTION_KIND)
              ),
              item: [
                // Camera attachment items from camera-tagged answerOptions
                ...(q.answerOption
                  ?.filter(o =>
                    o.extension?.some(
                      e =>
                        e.url === EXT_URL_PE_OPTION_KIND &&
                        e.valueString === PE_OPTION_KIND_CAMERA
                    )
                  )
                  .map(o => ({
                    linkId: `${q.linkId}-cam`,
                    type: 'attachment',
                    enableWhen: [
                      {
                        question: q.linkId,
                        operator: '=',
                        answerCoding: { code: o.valueCoding?.code },
                      },
                    ],
                    text: o.valueCoding?.display,
                  })) ?? []),
                /*
                 * Preserve original children (string/integer sub-items
                 * like Systolic/Diastolic) so the transform attaches
                 * them as nested items on the AyuQuestion.
                 */
                ...(q.item ?? []),
              ],
            })),
        },
        {
          linkId: 'sec-head',
          text: 'Head',
          type: 'group',
          answerOption: questions
            .filter(q => {
              const sk = q.extension?.find(
                e => e.url === EXT_URL_PE_SECTION_KEY
              )?.valueString;
              return sk === 'Head';
            })
            .map(q => ({
              valueCoding: {
                code: q.linkId,
                display:
                  q.extension?.find(e => e.url === EXT_URL_PE_CATEGORY_LABEL)
                    ?.valueString ?? q.linkId,
              },
            })),
          item: questions
            .filter(q => {
              const sk = q.extension?.find(
                e => e.url === EXT_URL_PE_SECTION_KEY
              )?.valueString;
              return sk === 'Head';
            })
            .map(q => ({
              linkId: q.linkId,
              text: q.text,
              type: 'choice',
              required: q.required,
              answerOption: q.answerOption,
            })),
        },
      ],
    },
  },
];

const defaultProps = {
  questionIndex: 0,
  onNextQuestion: vi.fn(),
  onPrevQuestion: vi.fn(),
  onPrevSection: vi.fn(),
  onProgressUpdate: vi.fn(),
  physicalExamFilter: 'General:;Head:',
};

describe('PhysicalExamination (AyuStepperContainer rewrite)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedStepperProps = {};
    capturedProviderProps.current = null;
    cameraConsumerReturnsNull.value = false;
    mockContextData = { physicalExam: null };
    mockVisitId.value = 'test-visit-id';
  });

  it('renders a loading placeholder when physExam.json is missing', () => {
    render(<PhysicalExamination {...defaultProps} ayuConfigFiles={[]} />);
    expect(screen.getByText(/Loading physical exam/i)).toBeInTheDocument();
  });

  it('renders the stepper inside the camera provider when physExam.json is present', () => {
    const questions = [
      makeQuestion('q1', 'General', 'Jaundice', [
        { code: 'yes', display: 'Yes' },
        { code: 'no', display: 'No' },
      ]),
    ];
    render(
      <PhysicalExamination
        {...defaultProps}
        ayuConfigFiles={makeAyuConfigFiles(questions)}
      />
    );
    expect(screen.getByTestId('camera-provider')).toBeInTheDocument();
    expect(screen.getByTestId('ayu-stepper-container')).toBeInTheDocument();
  });

  it('passes skipSummary=true and the configured summaryTitle to the stepper', () => {
    const questions = [
      makeQuestion('q1', 'General', 'Jaundice', [
        { code: 'yes', display: 'Yes' },
        { code: 'no', display: 'No' },
      ]),
    ];
    render(
      <PhysicalExamination
        {...defaultProps}
        ayuConfigFiles={makeAyuConfigFiles(questions)}
      />
    );
    expect(capturedStepperProps.skipSummary).toBe(true);
    expect(capturedStepperProps.summaryTitle).toBe(
      '3/4. Physical examination summary'
    );
  });

  it('does not show Save & Next button initially when data.physicalExam is null', () => {
    const questions = [
      makeQuestion('q1', 'General', 'Jaundice', [
        { code: 'yes', display: 'Yes' },
      ]),
    ];
    render(
      <PhysicalExamination
        {...defaultProps}
        ayuConfigFiles={makeAyuConfigFiles(questions)}
      />
    );
    expect(screen.queryByText('Save & Next')).not.toBeInTheDocument();
  });

  it('shows Save & Next when data.physicalExam exists (review mode)', () => {
    mockContextData = {
      physicalExam: {
        answers: { q1: ['yes'] },
        details: [{ label: 'Jaundice', value: 'Yes' }],
      },
    };
    const questions = [
      makeQuestion('q1', 'General', 'Jaundice', [
        { code: 'yes', display: 'Yes' },
      ]),
    ];
    render(
      <PhysicalExamination
        {...defaultProps}
        ayuConfigFiles={makeAyuConfigFiles(questions)}
      />
    );
    expect(screen.getByText('Save & Next')).toBeInTheDocument();
  });

  it('forwards initialAnswers from data.physicalExam to the stepper', () => {
    mockContextData = {
      physicalExam: {
        answers: { q1: ['yes'], q2: ['normal'] },
        details: [],
      },
    };
    const questions = [
      makeQuestion('q1', 'General', 'Jaundice', [
        { code: 'yes', display: 'Yes' },
      ]),
      makeQuestion('q1', 'General', 'Pallor', [
        { code: 'normal', display: 'Normal' },
      ]),
    ];
    render(
      <PhysicalExamination
        {...defaultProps}
        ayuConfigFiles={makeAyuConfigFiles(questions)}
      />
    );
    expect(capturedStepperProps.initialAnswers).toEqual({
      q1: ['yes'],
      q2: ['normal'],
    });
  });

  it('calls onPrevSection when the Back button is clicked', async () => {
    const user = userEvent.setup();
    const onPrev = vi.fn();
    const questions = [
      makeQuestion('q1', 'General', 'Jaundice', [
        { code: 'yes', display: 'Yes' },
      ]),
    ];
    render(
      <PhysicalExamination
        {...defaultProps}
        onPrevSection={onPrev}
        ayuConfigFiles={makeAyuConfigFiles(questions)}
      />
    );
    await user.click(screen.getByText('Back'));
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it('Save & Next triggers the stepper.confirm() handle', async () => {
    const user = userEvent.setup();
    mockContextData = {
      physicalExam: {
        answers: { q1: ['yes'] },
        details: [],
      },
    };
    const questions = [
      makeQuestion('q1', 'General', 'Jaundice', [
        { code: 'yes', display: 'Yes' },
      ]),
    ];
    render(
      <PhysicalExamination
        {...defaultProps}
        ayuConfigFiles={makeAyuConfigFiles(questions)}
      />
    );
    await user.click(screen.getByText('Save & Next'));
    expect(mockStepperConfirm).toHaveBeenCalledTimes(1);
  });

  describe('handleStepperComplete -> summary modal', () => {
    it('shows the modal grouped by section key with display labels', async () => {
      const user = userEvent.setup();
      const questions = [
        makeQuestion('q1', 'General', 'Jaundice', [
          { code: 'yes', display: 'Yes' },
          { code: 'no', display: 'No' },
        ]),
        makeQuestion('q2', 'General', 'Pallor', [
          { code: 'normal', display: 'Normal' },
        ]),
        makeQuestion('q3', 'Head', 'Injury', [
          { code: 'yes', display: 'Yes' },
        ]),
      ];
      render(
        <PhysicalExamination
          {...defaultProps}
          ayuConfigFiles={makeAyuConfigFiles(questions)}
        />
      );
      capturedStepperProps._completeAnswers = {
        q1: ['yes'],
        q2: ['normal'],
        q3: ['yes'],
      };
      await user.click(screen.getByTestId('trigger-complete'));
      const modalConfig = mockShowVitalConfirmationModal.mock.calls[0][0];
      expect(modalConfig.title).toBe('3/4. Physical examination summary');
      expect(modalConfig.size).toBe('lg');
      expect(modalConfig.sections).toHaveLength(2);
      const general = modalConfig.sections.find(
        (s: { title: string }) => s.title === 'General'
      );
      expect(general.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ label: 'Jaundice', value: 'Yes' }),
          expect.objectContaining({ label: 'Pallor', value: 'Normal' }),
        ])
      );
      const head = modalConfig.sections.find(
        (s: { title: string }) => s.title === 'Head'
      );
      expect(head.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ label: 'Injury', value: 'Yes' }),
        ])
      );
    });

    it('skips questions with no committed answer', async () => {
      const user = userEvent.setup();
      const questions = [
        makeQuestion('q1', 'General', 'Jaundice', [
          { code: 'yes', display: 'Yes' },
        ]),
      ];
      render(
        <PhysicalExamination
          {...defaultProps}
          ayuConfigFiles={makeAyuConfigFiles(questions)}
        />
      );
      capturedStepperProps._completeAnswers = {};
      await user.click(screen.getByTestId('trigger-complete'));
      const modalConfig = mockShowVitalConfirmationModal.mock.calls[0][0];
      expect(modalConfig.sections).toEqual([]);
    });

    it('shows "Picture Taken" when a camera answer has captured images', async () => {
      const user = userEvent.setup();
      const questions = [
        makeQuestion('with-images', 'General', 'Skin', [
          { code: 'CAM', display: 'Take a picture', camera: true },
        ]),
      ];
      render(
        <PhysicalExamination
          {...defaultProps}
          ayuConfigFiles={makeAyuConfigFiles(questions)}
        />
      );
      // camera answer code = the attachment's linkId (`<question>-cam`)
      capturedStepperProps._completeAnswers = {
        'with-images': ['with-images-cam'],
      };
      await user.click(screen.getByTestId('trigger-complete'));
      const modalConfig = mockShowVitalConfirmationModal.mock.calls[0][0];
      expect(modalConfig.sections[0].items[0].value).toBe('Picture Taken');
    });

    it('omits camera answers when there are no captured images', async () => {
      const user = userEvent.setup();
      const questions = [
        makeQuestion('no-images', 'General', 'Skin', [
          { code: 'CAM', display: 'Take a picture', camera: true },
        ]),
      ];
      render(
        <PhysicalExamination
          {...defaultProps}
          ayuConfigFiles={makeAyuConfigFiles(questions)}
        />
      );
      capturedStepperProps._completeAnswers = { 'no-images': ['no-images-cam'] };
      await user.click(screen.getByTestId('trigger-complete'));
      const modalConfig = mockShowVitalConfirmationModal.mock.calls[0][0];
      expect(modalConfig.sections).toEqual([]);
    });

    it('on Confirm: calls setPhysicalExamData with PhysicalExamAnswers shape and originalOnNext', async () => {
      const user = userEvent.setup();
      const originalOnNext = vi.fn();
      const questions = [
        makeQuestion('q1', 'General', 'Jaundice', [
          { code: 'yes', display: 'Yes' },
        ]),
      ];
      render(
        <PhysicalExamination
          {...defaultProps}
          onNextQuestion={originalOnNext}
          ayuConfigFiles={makeAyuConfigFiles(questions)}
        />
      );
      capturedStepperProps._completeAnswers = { q1: ['yes'] };
      await user.click(screen.getByTestId('trigger-complete'));
      const modalConfig = mockShowVitalConfirmationModal.mock.calls[0][0];
      modalConfig.onConfirm();
      expect(mockSetPhysicalExamData).toHaveBeenCalledWith(
        { q1: ['yes'] },
        expect.arrayContaining([
          expect.objectContaining({ label: 'Jaundice', value: 'Yes' }),
        ]),
        expect.arrayContaining([
          expect.objectContaining({
            title: 'General',
            items: expect.arrayContaining([
              expect.objectContaining({ label: 'Jaundice', value: 'Yes' }),
            ]),
          }),
        ])
      );
      expect(originalOnNext).toHaveBeenCalledTimes(1);
    });

    it('persists answers to temp-storage on Confirm', async () => {
      const user = userEvent.setup();
      const questions = [
        makeQuestion('q1', 'General', 'Jaundice', [
          { code: 'yes', display: 'Yes' },
        ]),
      ];
      render(
        <PhysicalExamination
          {...defaultProps}
          ayuConfigFiles={makeAyuConfigFiles(questions)}
        />
      );
      capturedStepperProps._completeAnswers = { q1: ['yes'] };
      await user.click(screen.getByTestId('trigger-complete'));
      const modalConfig = mockShowVitalConfirmationModal.mock.calls[0][0];
      modalConfig.onConfirm();
      expect(mockSaveSectionToTemp).toHaveBeenCalledWith({
        physicalExam: {
          answers: { q1: ['yes'] },
          details: expect.any(Array),
          detailsSections: expect.any(Array),
        },
      });
    });

    it('on Confirm: snapshots pending images into context via setPhysExamPendingImages', async () => {
      const user = userEvent.setup();
      const pendingImages = [
        { file: new File(['img'], 'photo.jpg', { type: 'image/jpeg' }), comment: 'General' },
      ];
      mockGetPendingImages.mockReturnValue(pendingImages);

      const questions = [
        makeQuestion('q1', 'General', 'Jaundice', [
          { code: 'yes', display: 'Yes' },
        ]),
      ];
      render(
        <PhysicalExamination
          {...defaultProps}
          ayuConfigFiles={makeAyuConfigFiles(questions)}
        />
      );
      capturedStepperProps._completeAnswers = { q1: ['yes'] };
      await user.click(screen.getByTestId('trigger-complete'));
      const modalConfig = mockShowVitalConfirmationModal.mock.calls[0][0];
      modalConfig.onConfirm();
      expect(mockSetPhysExamPendingImages).toHaveBeenCalledWith(pendingImages);
    });

    it('coerces a single-string AyuAnswerValue into [string] for the upload-shaped output', async () => {
      const user = userEvent.setup();
      const questions = [
        makeQuestion('q1', 'General', 'Jaundice', [
          { code: 'yes', display: 'Yes' },
        ]),
      ];
      render(
        <PhysicalExamination
          {...defaultProps}
          ayuConfigFiles={makeAyuConfigFiles(questions)}
        />
      );
      capturedStepperProps._completeAnswers = { q1: 'yes' };
      await user.click(screen.getByTestId('trigger-complete'));
      const modalConfig = mockShowVitalConfirmationModal.mock.calls[0][0];
      modalConfig.onConfirm();
      expect(mockSetPhysicalExamData).toHaveBeenCalledWith(
        { q1: ['yes'] },
        expect.any(Array),
        expect.any(Array)
      );
    });

    it('first section.onChange flips the component into review mode (shows Save & Next)', async () => {
      const user = userEvent.setup();
      const questions = [
        makeQuestion('q1', 'General', 'Jaundice', [
          { code: 'yes', display: 'Yes' },
        ]),
      ];
      render(
        <PhysicalExamination
          {...defaultProps}
          ayuConfigFiles={makeAyuConfigFiles(questions)}
        />
      );
      capturedStepperProps._completeAnswers = { q1: ['yes'] };
      await user.click(screen.getByTestId('trigger-complete'));
      const modalConfig = mockShowVitalConfirmationModal.mock.calls[0][0];
      /*
       * wrappedOnNextQuestion already toggled review mode when the modal
       * opened, but exercising the per-section onChange callback should not
       * throw and should keep review mode on.
       */
      expect(typeof modalConfig.sections[0].onChange).toBe('function');
      modalConfig.sections[0].onChange();
      expect(screen.getByText('Save & Next')).toBeInTheDocument();
    });
  });

  describe('orchestrator resolver callbacks', () => {
    const renderForCallbacks = (questions = [
      makeQuestion('q1', 'General', 'Jaundice', [
        { code: 'yes', display: 'Yes' },
      ]),
    ]) =>
      render(
        <PhysicalExamination
          {...defaultProps}
          ayuConfigFiles={makeAyuConfigFiles(questions)}
        />
      );

    it('sectionCommentFor returns the question\'s PE_SECTION_KEY when known', () => {
      renderForCallbacks();
      const fn = capturedProviderProps.current?.sectionCommentFor as (
        id: string
      ) => string;
      expect(fn('q1')).toBe('General');
    });

    it('sectionCommentFor falls back to "General Exams" for unknown question ids', () => {
      renderForCallbacks();
      const fn = capturedProviderProps.current?.sectionCommentFor as (
        id: string
      ) => string;
      expect(fn('unknown')).toBe('General Exams');
    });

    it('jobAidUrlFor returns null when the question has no job-aid file extension', () => {
      renderForCallbacks();
      const fn = capturedProviderProps.current?.jobAidUrlFor as (
        id: string
      ) => string | null;
      expect(fn('q1')).toBeNull();
    });

    it('jobAidUrlFor returns null for unknown question ids', () => {
      renderForCallbacks();
      const fn = capturedProviderProps.current?.jobAidUrlFor as (
        id: string
      ) => string | null;
      expect(fn('unknown')).toBeNull();
    });

    it('jobAidUrlFor returns the resolved URL when the question has a job-aid file', () => {
      const q = makeQuestion('q1', 'General', 'Jaundice', [
        { code: 'yes', display: 'Yes' },
      ]);
      q.extension = [
        ...(q.extension ?? []),
        {
          url: 'https://intelehealth.org/fhir/StructureDefinition/job-aid-file',
          valueString: 'jaundiceexample',
        },
      ];
      renderForCallbacks([q]);
      const fn = capturedProviderProps.current?.jobAidUrlFor as (
        id: string
      ) => string | null;
      expect(fn('q1')).toBe('assets/jaundiceexample.png');
    });

    it('jobAidUrlFor returns null when getJobAidUrl yields no asset for the file', () => {
      const q = makeQuestion('q1', 'General', 'Jaundice', [
        { code: 'yes', display: 'Yes' },
      ]);
      q.extension = [
        ...(q.extension ?? []),
        {
          url: 'https://intelehealth.org/fhir/StructureDefinition/job-aid-file',
          valueString: 'missing', // the mock returns null for this filename
        },
      ];
      renderForCallbacks([q]);
      const fn = capturedProviderProps.current?.jobAidUrlFor as (
        id: string
      ) => string | null;
      expect(fn('q1')).toBeNull();
    });

    it('jobAidTypeFor returns null for unknown question ids', () => {
      renderForCallbacks();
      const fn = capturedProviderProps.current?.jobAidTypeFor as (
        id: string
      ) => 'image' | 'video' | null;
      expect(fn('unknown')).toBeNull();
    });

    it('jobAidTypeFor returns null when the type extension is missing or invalid', () => {
      const q = makeQuestion('q1', 'General', 'Jaundice', [
        { code: 'yes', display: 'Yes' },
      ]);
      // No job-aid-type extension at all
      renderForCallbacks([q]);
      const fn = capturedProviderProps.current?.jobAidTypeFor as (
        id: string
      ) => 'image' | 'video' | null;
      expect(fn('q1')).toBeNull();
    });

    it('jobAidTypeFor returns the valid type when set to "image" or "video"', () => {
      const qImage = makeQuestion('q-img', 'General', 'Eyes', [
        { code: 'yes', display: 'Yes' },
      ]);
      qImage.extension = [
        ...(qImage.extension ?? []),
        {
          url: 'https://intelehealth.org/fhir/StructureDefinition/job-aid-type',
          valueString: 'image',
        },
      ];
      const qVideo = makeQuestion('q-vid', 'General', 'Pallor', [
        { code: 'yes', display: 'Yes' },
      ]);
      qVideo.extension = [
        ...(qVideo.extension ?? []),
        {
          url: 'https://intelehealth.org/fhir/StructureDefinition/job-aid-type',
          valueString: 'video',
        },
      ];
      const qBad = makeQuestion('q-bad', 'General', 'Other', [
        { code: 'yes', display: 'Yes' },
      ]);
      qBad.extension = [
        ...(qBad.extension ?? []),
        {
          url: 'https://intelehealth.org/fhir/StructureDefinition/job-aid-type',
          valueString: 'audio', // not image/video → null
        },
      ];
      renderForCallbacks([qImage, qVideo, qBad]);
      const fn = capturedProviderProps.current?.jobAidTypeFor as (
        id: string
      ) => 'image' | 'video' | null;
      expect(fn('q-img')).toBe('image');
      expect(fn('q-vid')).toBe('video');
      expect(fn('q-bad')).toBeNull();
    });

    it('jobAidTypeFor prefers the actual bundled asset type over the FHIR job-aid-type', () => {
      /* job-aid-file resolves to an image asset even though the FHIR type
         (mislabelled) says "video" — the actual file wins. */
      const q = makeQuestion('q-file', 'General', 'Pallor', [
        { code: 'yes', display: 'Yes' },
      ]);
      q.extension = [
        ...(q.extension ?? []),
        {
          url: 'https://intelehealth.org/fhir/StructureDefinition/job-aid-file',
          valueString: 'imgfile',
        },
        {
          url: 'https://intelehealth.org/fhir/StructureDefinition/job-aid-type',
          valueString: 'video',
        },
      ];
      renderForCallbacks([q]);
      const fn = capturedProviderProps.current?.jobAidTypeFor as (
        id: string
      ) => 'image' | 'video' | null;
      expect(fn('q-file')).toBe('image');
    });

    it('jobAidTypeFor falls back to the FHIR job-aid-type when the file has no bundled asset', () => {
      // getJobAidType returns undefined for an unknown file → use FHIR type.
      const q = makeQuestion('q-fallback', 'General', 'Throat', [
        { code: 'yes', display: 'Yes' },
      ]);
      q.extension = [
        ...(q.extension ?? []),
        {
          url: 'https://intelehealth.org/fhir/StructureDefinition/job-aid-file',
          valueString: 'unbundled',
        },
        {
          url: 'https://intelehealth.org/fhir/StructureDefinition/job-aid-type',
          valueString: 'video',
        },
      ];
      renderForCallbacks([q]);
      const fn = capturedProviderProps.current?.jobAidTypeFor as (
        id: string
      ) => 'image' | 'video' | null;
      expect(fn('q-fallback')).toBe('video');
    });
  });

  describe('edge cases', () => {
    it('passes null visitId to the camera provider when no visit is in context', () => {
      mockVisitId.value = undefined;
      const questions = [
        makeQuestion('q1', 'General', 'Jaundice', [
          { code: 'yes', display: 'Yes' },
        ]),
      ];
      render(
        <PhysicalExamination
          {...defaultProps}
          ayuConfigFiles={makeAyuConfigFiles(questions)}
        />
      );
      expect(capturedProviderProps.current?.visitId).toBeNull();
    });

    it('renders the loading placeholder when transformFhirPhysExamToAyu yields no items', () => {
      /* physExam.json has the right shape but no section items → transform
         returns root with empty item[] → topLevelItems is empty → loader */
      render(
        <PhysicalExamination
          {...defaultProps}
          ayuConfigFiles={[
            {
              id: 1,
              name: 'physExam.json',
              keyName: 'physExam',
              isActive: true,
              json: {
                resourceType: 'Questionnaire' as const,
                title: 'Empty',
                item: [],
              },
            },
          ]}
        />
      );
      expect(screen.getByText(/Loading physical exam/i)).toBeInTheDocument();
    });

    it('forwards onProgressUpdate from the stepper to the parent', () => {
      const onProgressUpdate = vi.fn();
      const questions = [
        makeQuestion('q1', 'General', 'Jaundice', [
          { code: 'yes', display: 'Yes' },
        ]),
      ];
      render(
        <PhysicalExamination
          {...defaultProps}
          onProgressUpdate={onProgressUpdate}
          ayuConfigFiles={makeAyuConfigFiles(questions)}
        />
      );
      capturedStepperProps.onProgressUpdate?.(5, 2);
      expect(onProgressUpdate).toHaveBeenCalledWith(5, 2);
    });

    it('applies the protocol filter when physicalExamFilter is set', () => {
      const questions = [
        makeQuestion('q1', 'General', 'Jaundice', [
          { code: 'yes', display: 'Yes' },
        ]),
        makeQuestion('q2', 'Head', 'Injury', [{ code: 'yes', display: 'Yes' }]),
      ];
      render(
        <PhysicalExamination
          {...defaultProps}
          physicalExamFilter="Head:Injury"
          ayuConfigFiles={makeAyuConfigFiles(questions)}
        />
      );
      /*
       * Filter "Head:Injury" keeps q2 (matches) and drops q1 since its
       * section "General" isn't in the filter and isn't the always-included
       * section ("General Exams").
       */
      const items = (
        capturedStepperProps.questionnaire as { item: { linkId: string }[] }
      ).item;
      expect(items.map(i => i.linkId)).toEqual(['q2']);
    });

    it('falls back to an empty filter when physicalExamFilter is undefined', () => {
      const questions = [
        makeQuestion('q1', 'General', 'Jaundice', [
          { code: 'yes', display: 'Yes' },
        ]),
        makeQuestion('q2', 'Head', 'Injury', [{ code: 'yes', display: 'Yes' }]),
      ];
      render(
        <PhysicalExamination
          {...defaultProps}
          physicalExamFilter={undefined}
          ayuConfigFiles={makeAyuConfigFiles(questions)}
        />
      );
      /*
       * With no filter, `physicalExamFilter ?? ''` resolves to '' so only the
       * always-included "General Exams" section survives. These questions are
       * in "General"/"Head", so everything is pruned and the stepper isn't
       * rendered -> loading placeholder.
       */
      expect(
        screen.getByText(/Loading physical exam/i)
      ).toBeInTheDocument();
    });

    it('treats non-string, non-array answer values as empty arrays', async () => {
      const user = userEvent.setup();
      const questions = [
        makeQuestion('q1', 'General', 'Jaundice', [
          { code: 'yes', display: 'Yes' },
        ]),
      ];
      render(
        <PhysicalExamination
          {...defaultProps}
          ayuConfigFiles={makeAyuConfigFiles(questions)}
        />
      );
      // Numeric value isn't a string and isn't an array — should coerce to []
      capturedStepperProps._completeAnswers = {
        q1: 42 as unknown as string,
      };
      await user.click(screen.getByTestId('trigger-complete'));
      const modalConfig = mockShowVitalConfirmationModal.mock.calls[0][0];
      modalConfig.onConfirm();
      expect(mockSetPhysicalExamData).toHaveBeenCalledWith(
        { q1: [] },
        expect.any(Array),
        expect.any(Array)
      );
    });

    it('CameraImagesForCapture writes null to the ref when no camera provider is mounted', async () => {
      /*
       * Force the consumer hook to return null so the ref-bridge takes its
       * `?? null` fallback branch — and supply a camera answer so the
       * handleStepperComplete loop actually invokes the () => [] fallback
       * function (covers the fallback lambda body too).
       */
      cameraConsumerReturnsNull.value = true;
      const user = userEvent.setup();
      const questions = [
        makeQuestion('q1', 'General', 'Skin', [
          { code: 'CAM', display: 'Take a picture', camera: true },
        ]),
      ];
      render(
        <PhysicalExamination
          {...defaultProps}
          ayuConfigFiles={makeAyuConfigFiles(questions)}
        />
      );
      capturedStepperProps._completeAnswers = { q1: ['q1-cam'] };
      await user.click(screen.getByTestId('trigger-complete'));
      const modalConfig = mockShowVitalConfirmationModal.mock.calls[0][0];
      // Fallback returned []; no images, so the camera answer drops out.
      expect(modalConfig.sections).toEqual([]);
    });

    it('skips stored answer codes that are no longer in the question options', async () => {
      const user = userEvent.setup();
      const questions = [
        makeQuestion('q1', 'General', 'Jaundice', [
          { code: 'yes', display: 'Yes' },
        ]),
      ];
      render(
        <PhysicalExamination
          {...defaultProps}
          ayuConfigFiles={makeAyuConfigFiles(questions)}
        />
      );
      /* 'stale-code' isn't in q1's answerOption — orchestrator must `continue`
         past it without contributing to the summary. */
      capturedStepperProps._completeAnswers = { q1: ['stale-code'] };
      await user.click(screen.getByTestId('trigger-complete'));
      const modalConfig = mockShowVitalConfirmationModal.mock.calls[0][0];
      expect(modalConfig.sections).toEqual([]);
    });

    it('includes nested child values (e.g. Systolic/Diastolic) in the modal summary and details', async () => {
      const user = userEvent.setup();
      /*
       * Build a question that has nested string-type children like BP.
       * After transformFhirPhysExamToAyu the question should have `item`
       * children for Systolic and Diastolic.
       */
      const bpQuestion = makeQuestion('bp-q', 'General', 'Lying BP', [
        { code: 'take-bp', display: 'Take the patient\'s BP lying down' },
        { code: 'skip', display: 'Skip' },
      ]);
      // Attach string children so `collectNestedChildValues` is exercised
      bpQuestion.item = [
        { linkId: 'systolic', text: 'Enter systolic BP', type: 'string', required: false, repeats: false },
        { linkId: 'diastolic', text: 'Enter diastolic BP', type: 'string', required: false, repeats: false },
      ];
      render(
        <PhysicalExamination
          {...defaultProps}
          ayuConfigFiles={makeAyuConfigFiles([bpQuestion])}
        />
      );
      // Simulate answers: one option selected + child values
      capturedStepperProps._completeAnswers = {
        'bp-q': ['take-bp'],
        systolic: '96',
        diastolic: '82',
      };
      await user.click(screen.getByTestId('trigger-complete'));
      const modalConfig = mockShowVitalConfirmationModal.mock.calls[0][0];
      /* The nested values branch should have produced a labelValue entry with
         categoryLabel as label and concatenated nested display as value. */
      const section = modalConfig.sections.find(
        (s: { title: string }) => s.title === 'General'
      );
      expect(section).toBeDefined();
      // Parent answer shown as its own row, child values as separate rows below
      expect(section.items[0]).toEqual(
        expect.objectContaining({ label: 'Lying BP', value: "Take the patient's BP lying down" })
      );
      expect(section.items[1]).toEqual(
        expect.objectContaining({ label: 'systolic BP', value: '96', isChild: true })
      );
      expect(section.items[2]).toEqual(
        expect.objectContaining({ label: 'diastolic BP', value: '82', isChild: true })
      );
      // Parent item should NOT have isChild
      expect(section.items[0].isChild).toBeUndefined();
      // On Confirm, details should include the nested values with "Enter" stripped
      modalConfig.onConfirm();
      const detailsArg = mockSetPhysicalExamData.mock.calls[0][1];
      expect(detailsArg).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ label: 'systolic BP', value: '96' }),
          expect.objectContaining({ label: 'diastolic BP', value: '82' }),
        ])
      );
    });

    it('collectNestedChildValues recurses through deeply nested items', async () => {
      const user = userEvent.setup();
      /*
       * Need 2+ answerOptions so the FHIR transform doesn't treat this as a
       * concept-tag wrapper (single-option wrapper takes a different path that
       * requires enableWhen-gated children).
       */
      const nestedQuestion = makeQuestion('nq', 'General', 'Nested Q', [
        { code: 'opt', display: 'Option' },
        { code: 'skip', display: 'Skip' },
      ]);
      // Create a 2-level nested structure: child → grandchild
      nestedQuestion.item = [
        {
          linkId: 'child1',
          text: 'Enter level 1',
          type: 'string',
          required: false,
          repeats: false,
          item: [
            { linkId: 'grandchild1', text: 'Enter level 2', type: 'string', required: false, repeats: false },
          ],
        },
      ];
      render(
        <PhysicalExamination
          {...defaultProps}
          ayuConfigFiles={makeAyuConfigFiles([nestedQuestion])}
        />
      );
      capturedStepperProps._completeAnswers = {
        nq: ['opt'],
        child1: 'value1',
        grandchild1: 'value2',
      };
      await user.click(screen.getByTestId('trigger-complete'));
      const modalConfig = mockShowVitalConfirmationModal.mock.calls[0][0];
      const section = modalConfig.sections[0];
      // Parent as row 0, child and grandchild as separate rows below
      expect(section.items[0].value).toBe('Option');
      expect(section.items[0].isChild).toBeUndefined();
      expect(section.items[1]).toEqual(
        expect.objectContaining({ label: 'level 1', value: 'value1', isChild: true })
      );
      expect(section.items[2]).toEqual(
        expect.objectContaining({ label: 'level 2', value: 'value2', isChild: true })
      );
    });

    it('collectNestedChildValues includes children with no label using value as fallback, skips empty answers', async () => {
      const user = userEvent.setup();
      const question = makeQuestion('q-skip', 'General', 'Skip Test', [
        { code: 'opt', display: 'Option' },
        { code: 'skip', display: 'Skip' },
      ]);
      question.item = [
        // No text → uses display value as label fallback → included
        { linkId: 'no-label', text: '', type: 'string', required: false, repeats: false },
        // Has label but answer is empty string → skipped
        { linkId: 'empty-ans', text: 'Enter value', type: 'string', required: false, repeats: false },
        // Has label and value → included
        { linkId: 'good', text: 'Enter good', type: 'string', required: false, repeats: false },
      ];
      render(
        <PhysicalExamination
          {...defaultProps}
          ayuConfigFiles={makeAyuConfigFiles([question])}
        />
      );
      capturedStepperProps._completeAnswers = {
        'q-skip': ['opt'],
        'no-label': 'val',
        'empty-ans': '',
        good: 'yes',
      };
      await user.click(screen.getByTestId('trigger-complete'));
      const modalConfig = mockShowVitalConfirmationModal.mock.calls[0][0];
      const section = modalConfig.sections[0];
      /* Parent "Option" as row 0, then child values as separate rows:
         no-label included using its value as the label; empty-ans still skipped */
      expect(section.items[0].value).toBe('Option');
      expect(section.items[1]).toEqual(
        expect.objectContaining({ label: 'val', value: 'val' })
      );
      expect(section.items[2]).toEqual(
        expect.objectContaining({ label: 'good', value: 'yes' })
      );
    });

    it('collectNestedChildValues includes children with undefined text using value as label fallback', async () => {
      const user = userEvent.setup();
      const question = makeQuestion('q-notext', 'General', 'No Text Test', [
        { code: 'opt', display: 'Option' },
        { code: 'skip', display: 'Skip' },
      ]);
      question.item = [
        // text is explicitly undefined → falls back to display value as label
        { linkId: 'no-text', text: undefined as unknown as string, type: 'string', required: false, repeats: false },
        { linkId: 'has-text', text: 'Enter value', type: 'string', required: false, repeats: false },
      ];
      render(
        <PhysicalExamination
          {...defaultProps}
          ayuConfigFiles={makeAyuConfigFiles([question])}
        />
      );
      capturedStepperProps._completeAnswers = {
        'q-notext': ['opt'],
        'no-text': 'val',
        'has-text': 'ok',
      };
      await user.click(screen.getByTestId('trigger-complete'));
      const modalConfig = mockShowVitalConfirmationModal.mock.calls[0][0];
      const section = modalConfig.sections[0];
      // Parent "Option" as row 0, then both children as separate rows
      expect(section.items[0].value).toBe('Option');
      expect(section.items[1]).toEqual(
        expect.objectContaining({ label: 'val', value: 'val' })
      );
      expect(section.items[2]).toEqual(
        expect.objectContaining({ label: 'value', value: 'ok' })
      );
    });

    it('collectNestedChildValues coerces non-string answers via String()', async () => {
      const user = userEvent.setup();
      const question = makeQuestion('q-coerce', 'General', 'Coerce Test', [
        { code: 'opt', display: 'Option' },
        { code: 'skip', display: 'Skip' },
      ]);
      question.item = [
        { linkId: 'num-child', text: 'Enter number', type: 'integer', required: false, repeats: false },
      ];
      render(
        <PhysicalExamination
          {...defaultProps}
          ayuConfigFiles={makeAyuConfigFiles([question])}
        />
      );
      capturedStepperProps._completeAnswers = {
        'q-coerce': ['opt'],
        'num-child': 42 as unknown as string,
      };
      await user.click(screen.getByTestId('trigger-complete'));
      const modalConfig = mockShowVitalConfirmationModal.mock.calls[0][0];
      const section = modalConfig.sections[0];
      // Parent as row 0, coerced child as separate row
      expect(section.items[0].value).toBe('Option');
      expect(section.items[1]).toEqual(
        expect.objectContaining({ label: 'number', value: '42' })
      );
    });

    it('collectNestedChildValues resolves choice-type child answer codes to display text', async () => {
      const user = userEvent.setup();
      /* Build a question with a choice-type nested child that has answerOption.
       * The child stores answer codes (e.g. 'MOVES') and the summary should
       * show the display text (e.g. 'Moves normally') rather than the raw code. */
      const question = makeQuestion('q-choice-child', 'General', 'Movement', [
        { code: 'opt', display: 'Check' },
        { code: 'skip', display: 'Skip' },
      ]);
      question.item = [
        {
          linkId: 'child-choice',
          text: 'Enter movement type',
          type: 'choice',
          required: false,
          repeats: false,
          answerOption: [
            { valueCoding: { code: 'MOVES', display: 'Moves normally' } },
            { valueCoding: { code: 'STIFF', display: 'Stiff' } },
          ],
        },
      ];
      render(
        <PhysicalExamination
          {...defaultProps}
          ayuConfigFiles={makeAyuConfigFiles([question])}
        />
      );
      capturedStepperProps._completeAnswers = {
        'q-choice-child': ['opt'],
        'child-choice': 'MOVES',
      };
      await user.click(screen.getByTestId('trigger-complete'));
      const modalConfig = mockShowVitalConfirmationModal.mock.calls[0][0];
      const section = modalConfig.sections[0];
      // Parent answer row
      expect(section.items[0].value).toBe('Check');
      // Child choice answer should show resolved display text, not raw code
      expect(section.items[1]).toEqual(
        expect.objectContaining({ label: 'movement type', value: 'Moves normally', isChild: true })
      );
    });

    it('collectNestedChildValues resolves array answer codes for choice children', async () => {
      const user = userEvent.setup();
      /* When a child stores answers as an array of codes (multi-select),
       * codes should be resolved to display text and joined with ", ". */
      const question = makeQuestion('q-arr-child', 'General', 'Symptoms', [
        { code: 'opt', display: 'Assess' },
        { code: 'skip', display: 'Skip' },
      ]);
      question.item = [
        {
          linkId: 'arr-child',
          text: 'Enter symptom type',
          type: 'choice',
          required: false,
          repeats: true,
          answerOption: [
            { valueCoding: { code: 'FEVER', display: 'Fever' } },
            { valueCoding: { code: 'COUGH', display: 'Cough' } },
            { valueCoding: { code: 'HEADACHE', display: 'Headache' } },
          ],
        },
      ];
      render(
        <PhysicalExamination
          {...defaultProps}
          ayuConfigFiles={makeAyuConfigFiles([question])}
        />
      );
      capturedStepperProps._completeAnswers = {
        'q-arr-child': ['opt'],
        'arr-child': ['FEVER', 'COUGH'],
      };
      await user.click(screen.getByTestId('trigger-complete'));
      const modalConfig = mockShowVitalConfirmationModal.mock.calls[0][0];
      const section = modalConfig.sections[0];
      expect(section.items[0].value).toBe('Assess');
      // Array of codes resolved and joined
      expect(section.items[1]).toEqual(
        expect.objectContaining({ label: 'symptom type', value: 'Fever, Cough', isChild: true })
      );
    });

    it('collectNestedChildValues produces empty codes array for non-string non-array answer with answerOption', async () => {
      const user = userEvent.setup();
      /* When a choice-type child receives a numeric answer (neither string nor
       * array), the ternary falls through to the [] branch (line 115). The
       * resolved array is empty so displayValue stays as String(answer). */
      const question = makeQuestion('q-num-choice', 'General', 'Numeric', [
        { code: 'opt', display: 'Check' },
        { code: 'skip', display: 'Skip' },
      ]);
      question.item = [
        {
          linkId: 'child-num-choice',
          text: 'Enter level',
          type: 'choice',
          required: false,
          repeats: false,
          answerOption: [
            { valueCoding: { code: 'LOW', display: 'Low' } },
            { valueCoding: { code: 'HIGH', display: 'High' } },
          ],
        },
      ];
      render(
        <PhysicalExamination
          {...defaultProps}
          ayuConfigFiles={makeAyuConfigFiles([question])}
        />
      );
      capturedStepperProps._completeAnswers = {
        'q-num-choice': ['opt'],
        'child-num-choice': 42 as unknown as string,
      };
      await user.click(screen.getByTestId('trigger-complete'));
      const modalConfig = mockShowVitalConfirmationModal.mock.calls[0][0];
      const section = modalConfig.sections[0];
      expect(section.items[0].value).toBe('Check');
      // Numeric answer: codes = [] (empty), resolved is empty, displayValue = String(42) = '42'
      expect(section.items[1]).toEqual(
        expect.objectContaining({ label: 'level', value: '42', isChild: true })
      );
    });

    it('collectNestedChildValues falls back to raw code when answerOption has no matching display', async () => {
      const user = userEvent.setup();
      const question = makeQuestion('q-no-match', 'General', 'Check', [
        { code: 'opt', display: 'Yes' },
        { code: 'skip', display: 'No' },
      ]);
      question.item = [
        {
          linkId: 'child-no-match',
          text: 'Enter detail',
          type: 'choice',
          required: false,
          repeats: false,
          answerOption: [
            { valueCoding: { code: 'KNOWN', display: 'Known option' } },
          ],
        },
      ];
      render(
        <PhysicalExamination
          {...defaultProps}
          ayuConfigFiles={makeAyuConfigFiles([question])}
        />
      );
      capturedStepperProps._completeAnswers = {
        'q-no-match': ['opt'],
        'child-no-match': 'UNKNOWN_CODE',
      };
      await user.click(screen.getByTestId('trigger-complete'));
      const modalConfig = mockShowVitalConfirmationModal.mock.calls[0][0];
      const section = modalConfig.sections[0];
      // Falls back to raw code when no matching option found
      expect(section.items[1]).toEqual(
        expect.objectContaining({ label: 'detail', value: 'UNKNOWN_CODE', isChild: true })
      );
    });

    it('collectNestedChildValues skips gated children whose enableWhen is not met', async () => {
      const user = userEvent.setup();
      /* A nested child gated on a specific parent answer code should be
       * skipped when the parent answer doesn't satisfy its enableWhen. */
      const question = makeQuestion('q-gate', 'General', 'Check', [
        { code: 'opt-a', display: 'Option A' },
        { code: 'opt-b', display: 'Option B' },
      ]);
      question.item = [
        {
          linkId: 'child-gated-a',
          text: 'Enter detail for A',
          type: 'string',
          required: false,
          repeats: false,
          enableWhen: [
            { question: 'q-gate', operator: '=', answerCoding: { code: 'opt-a' } },
          ],
        },
        {
          linkId: 'child-gated-b',
          text: 'Enter detail for B',
          type: 'string',
          required: false,
          repeats: false,
          enableWhen: [
            { question: 'q-gate', operator: '=', answerCoding: { code: 'opt-b' } },
          ],
        },
      ];
      render(
        <PhysicalExamination
          {...defaultProps}
          ayuConfigFiles={makeAyuConfigFiles([question])}
        />
      );
      capturedStepperProps._completeAnswers = {
        'q-gate': ['opt-a'],
        'child-gated-a': 'visible value',
        'child-gated-b': 'stale hidden value',
      };
      await user.click(screen.getByTestId('trigger-complete'));
      const modalConfig = mockShowVitalConfirmationModal.mock.calls[0][0];
      const section = modalConfig.sections[0];
      // Parent row
      expect(section.items[0].value).toBe('Option A');
      // Only child-gated-a should appear (enableWhen satisfied)
      expect(section.items[1]).toEqual(
        expect.objectContaining({ label: 'detail for A', value: 'visible value', isChild: true })
      );
      // child-gated-b should NOT appear (enableWhen not satisfied)
      expect(section.items).toHaveLength(2);
    });

    it('collectNestedChildValues resolves valueString-based answerOption', async () => {
      const user = userEvent.setup();
      /* When an answerOption uses valueString instead of valueCoding,
       * the fallback path opt?.valueString should resolve the display. */
      const question = makeQuestion('q-vs', 'General', 'Level', [
        { code: 'opt', display: 'Check' },
        { code: 'skip', display: 'Skip' },
      ]);
      question.item = [
        {
          linkId: 'child-vs',
          text: 'Enter grade',
          type: 'choice',
          required: false,
          repeats: false,
          answerOption: [
            { valueString: 'grade-1' },
            { valueString: 'grade-2' },
          ],
        },
      ];
      render(
        <PhysicalExamination
          {...defaultProps}
          ayuConfigFiles={makeAyuConfigFiles([question])}
        />
      );
      capturedStepperProps._completeAnswers = {
        'q-vs': ['opt'],
        'child-vs': 'grade-1',
      };
      await user.click(screen.getByTestId('trigger-complete'));
      const modalConfig = mockShowVitalConfirmationModal.mock.calls[0][0];
      const section = modalConfig.sections[0];
      expect(section.items[0].value).toBe('Check');
      // Resolved via valueString match
      expect(section.items[1]).toEqual(
        expect.objectContaining({ label: 'grade', value: 'grade-1', isChild: true })
      );
    });

    it('treats an option without a display string as an empty value', async () => {
      const user = userEvent.setup();
      /* Option with a code but display=undefined — exercises the `?? ''`
         fallback. `?? ''` returns '' which is then dropped from the summary. */
      const questions = [
        makeQuestion('q1', 'General', 'Jaundice', [
          { code: 'yes', display: '' },
        ]),
      ];
      /* Strip the display property so it's undefined (not empty-string —
         `??` only falls back on null/undefined). */
      questions[0].answerOption![0].valueCoding!.display = undefined;
      render(
        <PhysicalExamination
          {...defaultProps}
          ayuConfigFiles={makeAyuConfigFiles(questions)}
        />
      );
      capturedStepperProps._completeAnswers = { q1: ['yes'] };
      await user.click(screen.getByTestId('trigger-complete'));
      const modalConfig = mockShowVitalConfirmationModal.mock.calls[0][0];
      // Display was undefined → fallback '' → not pushed → no section.
      expect(modalConfig.sections).toEqual([]);
    });
  });
});
