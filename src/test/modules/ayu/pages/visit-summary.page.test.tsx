import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BreadcrumbProvider } from '../../../../context/BreadcrumbContext';

/* ── Mock navigation ─────────────────────────────────────────────────────── */

const mockNavigate = vi.fn();
const mockLocation = { pathname: '/ayu/visit-summary' };
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}));

/* ── Mock context: useStartVisitData ─────────────────────────────────────── */

const defaultData = {
  vitals: null as any,
  visitReason: null as any,
  physicalExam: null as any,
  medicalHistory: null as any,
};

const mockClearVisitId = vi.fn();
const mockSaveSectionToTemp = vi.fn().mockResolvedValue(undefined);
const mockUseStartVisitData = vi.fn(() => ({
  data: { ...defaultData },
  patientUuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  visitId: 'test-visit-id',
  tempRecordId: null as number | null,

  restoredSectionIndex: null,
  lastSectionIndex: 0,
  setLastSectionIndex: vi.fn(),
  setPatientUuid: vi.fn(),
  setVitalsData: vi.fn(),
  setVisitReasonData: vi.fn(),
  setPhysicalExamData: vi.fn(),
  setMedicalHistoryData: vi.fn(),
  setMedicalHistoryAnswers: vi.fn(),
  saveSectionToTemp: mockSaveSectionToTemp,
  clearVisitId: mockClearVisitId,
  markVisitUploaded: vi.fn(),
  physExamPendingImages: [] as Array<{ file: File; comment: string }>,
  setPhysExamPendingImages: vi.fn(),
}));

vi.mock('../../../../modules/ayu/context/start-visit.context', () => ({
  useStartVisitData: () => mockUseStartVisitData(),
}));

/* ── Mock ProfileContext ─────────────────────────────────────────────────── */

const mockHwProfile = {
  providerUuid: 'provider-uuid-1234',
  display: 'Test Provider',
};

vi.mock('../../../../context/ProfileContext', () => ({
  useProfileContext: () => ({
    hwProfile: mockHwProfile,
    profile: null,
    isLoading: false,
  }),
}));

/* ── Mock storage ────────────────────────────────────────────────────────── */

const mockStorageGet = vi.fn((_key: string): string | null => null);
const mockStorageGetLocationUuid = vi.fn(() => 'location-uuid-5678');

vi.mock('../../../../utils/storage', () => ({
  storage: {
    get: (key: string) => mockStorageGet(key),
    set: vi.fn(),
    remove: vi.fn(),
    getUser: vi.fn(() => JSON.stringify({ uuid: 'user-uuid' })),
    getLocationUuid: () => mockStorageGetLocationUuid(),
  },
}));

/* ── Mock toast ──────────────────────────────────────────────────────────── */

const mockShowToast = vi.fn();
vi.mock('../../../../services/toast', () => ({
  showToast: (...args: any[]) => mockShowToast(...args),
}));

/* ── Mock ConfirmationModal ──────────────────────────────────────────────── */

vi.mock('../../../../components/modal/confirmation.modal', () => ({
  ConfirmationModal: vi.fn(
    ({ open, title, onConfirm, onClose }: any) =>
      open ? (
        <div data-testid="confirmation-modal">
          <span>{title}</span>
          <button data-testid="modal-confirm" onClick={onConfirm}>
            Confirm
          </button>
          <button data-testid="modal-cancel" onClick={onClose}>
            Cancel
          </button>
        </div>
      ) : null
  ),
}));

/* ── Mock CollapsedComponent (render children directly) ──────────────────── */

vi.mock('../../../../modules/visit-summary/visit-summary-collapsed.component', () => ({
  default: vi.fn(({ title, children }: any) => (
    <div data-testid={`collapsed-${title}`}>
      <span>{title}</span>
      {children}
    </div>
  )),
}));

/* ── Mock visit-upload service functions ──────────────────────────────────── */

const mockBuildVisitReasonHtml = vi.fn((_a?: any, _b?: any) => '<p>visit reason</p>');
const mockBuildPhysicalExamData = vi.fn((_a?: any, _b?: any) => 'physical-exam-data');
const mockBuildMedicalHistoryData = vi.fn((_a?: any) => 'medical-history-data');
const mockBuildFamilyHistoryData = vi.fn((_a?: any) => 'family-history-data');
const mockBuildVisitUploadPayload = vi.fn((_a?: any) => ({ payload: true }));
const mockUploadVisit = vi.fn((_a?: any): Promise<any> => Promise.resolve());

vi.mock('../../../../modules/ayu/services/visit-upload.service', () => ({
  buildVisitReasonHtml: (...args: any[]) => mockBuildVisitReasonHtml(...args),
  buildPhysicalExamData: (...args: any[]) => mockBuildPhysicalExamData(...args),
  buildMedicalHistoryData: (...args: any[]) => mockBuildMedicalHistoryData(...args),
  buildFamilyHistoryData: (...args: any[]) => mockBuildFamilyHistoryData(...args),
  buildVisitUploadPayload: (...args: any[]) => mockBuildVisitUploadPayload(...args),
  uploadVisit: (...args: any[]) => mockUploadVisit(...args),
}));

/* ── Mock temp-storage service ──────────────────────────────────────────── */

const mockBulkMarkSynced = vi.fn();
const mockClearCommittedQuestionIds = vi.fn();
const mockClearDeletedAssetIds = vi.fn();
const mockGetChildResources = vi.fn().mockResolvedValue({ data: [] });
const mockGetCommittedQuestionIds = vi.fn().mockReturnValue(new Set<string>());
const mockGetDeletedAssetIds = vi.fn().mockReturnValue(new Set<number>());
vi.mock('../../../../modules/ayu/services/temp-storage.service', () => ({
  bulkMarkSynced: (...args: any[]) => mockBulkMarkSynced(...args),
  clearCommittedQuestionIds: (...args: any[]) => mockClearCommittedQuestionIds(...args),
  clearDeletedAssetIds: (...args: any[]) => mockClearDeletedAssetIds(...args),
  getChildResources: (...args: any[]) => mockGetChildResources(...args),
  getCommittedQuestionIds: (...args: any[]) => mockGetCommittedQuestionIds(...args),
  getDeletedAssetIds: (...args: any[]) => mockGetDeletedAssetIds(...args),
}));



const mockGetPatient = vi.fn();
vi.mock('../../../../modules/patient/add/add-patient.service', () => ({
  patientService: {
    getPatient: (...args: any[]) => mockGetPatient(...args),
  },
}));

const mockFetchConceptAnswers = vi.fn();
vi.mock('../../../../services/concept.service', () => ({
  fetchConceptAnswers: (...args: any[]) => mockFetchConceptAnswers(...args),
}));

/* ── Mock obs.service ──────────────────────────────────────────────────── */

const mockUploadAllAdditionalDocuments = vi.fn().mockResolvedValue(undefined);
const mockUploadAllPhysicalExamImages = vi.fn().mockResolvedValue(undefined);
const mockGetPendingImages = vi.fn().mockReturnValue([]);
const mockClearPendingDocuments = vi.fn();
const mockAddPendingDocument = vi.fn();
const mockGetLatestEncounterUuid = vi.fn().mockResolvedValue(undefined);
const mockGetLatestVisitUuid = vi.fn().mockResolvedValue('mock-visit-uuid');

vi.mock('../../../../modules/ayu/services/obs.service', () => ({
  uploadAllAdditionalDocuments: (...args: any[]) => mockUploadAllAdditionalDocuments(...args),
  uploadAllPhysicalExamImages: (...args: any[]) => mockUploadAllPhysicalExamImages(...args),
  getPendingImages: (...args: any[]) => mockGetPendingImages(...args),
  clearPendingDocuments: (...args: any[]) => mockClearPendingDocuments(...args),
  addPendingDocument: (...args: any[]) => mockAddPendingDocument(...args),
  getLatestEncounterUuid: (...args: any[]) => mockGetLatestEncounterUuid(...args),
  getLatestVisitUuid: (...args: any[]) => mockGetLatestVisitUuid(...args),
}));

/* ── Mock icon imports ───────────────────────────────────────────────────── */

vi.mock('../../../../assets/icons/icon-chevron-down.svg', () => ({
  default: 'icon-chevron-down.svg',
}));
vi.mock('../../../../assets/icons/icon-physical-examination.svg', () => ({
  default: 'icon-physical-examination.svg',
}));
vi.mock('../../../../assets/icons/icon-visit-summery.svg', () => ({
  default: 'icon-visit-summery.svg',
}));
vi.mock('../../../../assets/icons/visit-reason.svg', () => ({
  default: 'visit-reason.svg',
}));
vi.mock('../../../../assets/icons/vitals.svg', () => ({
  default: 'vitals.svg',
}));
vi.mock('../../../../assets/icons/icon-info.svg', () => ({
  default: 'icon-info.svg',
}));
vi.mock('../../../../assets/icons/icon-medical-history-green-rounded-bordered.svg', () => ({
  default: 'icon-medical-history.svg',
}));

/* ── Mock useConfig ────────────────────────────────────────────────────── */

const defaultMockConfig = {
  specialization: [
    { name: 'General Physician' },
    { name: 'Dermatology' },
    { name: 'Cardiology' },
  ],
};

const mockUseConfig = vi.fn(() => ({ config: defaultMockConfig }));

vi.mock('../../../../hooks/useConfig', () => ({
  useConfig: () => mockUseConfig(),
}));

/* ── Mock useAyuJsonList (provides physExam.json) ────────────────────────── */

let mockAyuJsonList: Array<{ name: string; json: unknown }> = [
  { name: 'physExam.json', json: {} },
];
vi.mock('../../../../modules/ayu/hooks/useAyuJson.hook', () => ({
  useAyuJsonList: () => mockAyuJsonList,
}));

vi.mock(
  '../../../../modules/ayu/utils/parseFhirPhysExamQuestionnaire',
  () => ({
    parseFhirPhysExamQuestionnaire: () => [],
  })
);

/* ── Import the component under test (after all mocks) ───────────────────── */

const { default: VisitSummaryPage } = await import(
  '../../../../modules/ayu/pages/visit-summary.page'
);

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const fullData = {
  vitals: {
    formValues: {
      height_cm: 170,
      weight_kg: 70,
      bmi: 24.2,
      bp_systolic: 120,
      bp_diastolic: 80,
      pulse_bpm: 72,
      temprature_f: 98.6,
      spo2: 98,
      respiratory_rate: 16,
    },
    config: [],
  },
  visitReason: {
    answers: {},
    reasonNames: ['Cough', 'Fever'],
    details: [{ label: 'Duration', value: '3 days' }],
    detailsSections: [
      {
        title: 'Cough',
        items: [{ type: 'labelValue' as const, label: 'Duration', value: '3 days' }],
      },
    ],
  },
  physicalExam: {
    answers: {
      pe1: ['opt1'],
    },
    details: [{ label: 'General Appearance', value: 'Normal' }],
  },
  medicalHistory: {
    patHistSummary: [
      {
        title: 'Past History',
        items: [{ type: 'labelValue' as const, label: 'Diabetes', value: 'Yes' }],
      },
    ],
    famHistSummary: [
      {
        title: 'Family History',
        items: [{ type: 'labelValue' as const, label: 'Hypertension', value: 'No' }],
      },
    ],
  },
};

function renderWithData(dataOverride?: Partial<typeof defaultData>) {
  const data = { ...defaultData, ...dataOverride };
  mockUseStartVisitData.mockReturnValue({
    data,
    patientUuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    visitId: 'test-visit-id',
    tempRecordId: null,
  
    restoredSectionIndex: null,
    lastSectionIndex: 0,
    setLastSectionIndex: vi.fn(),
    setPatientUuid: vi.fn(),
    setVitalsData: vi.fn(),
    setVisitReasonData: vi.fn(),
    setPhysicalExamData: vi.fn(),
    setMedicalHistoryData: vi.fn(),
    setMedicalHistoryAnswers: vi.fn(),
    saveSectionToTemp: mockSaveSectionToTemp,
    clearVisitId: mockClearVisitId,
    markVisitUploaded: vi.fn(),
    physExamPendingImages: [],
    setPhysExamPendingImages: vi.fn(),
  });
  return render(<BreadcrumbProvider><VisitSummaryPage /></BreadcrumbProvider>);
}

/** Select a doctor's specialty from the dropdown (required before Upload Visit). */
function selectSpeciality(name = 'General Physician') {
  const dropdownButton = screen.getByRole('button', { name: /select doctor's specialty/i });
  fireEvent.click(dropdownButton);
  fireEvent.click(screen.getByText(name));
}

/* ── Tests ────────────────────────────────────────────────────────────────── */

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  globalThis.URL.revokeObjectURL = vi.fn();
  mockStorageGet.mockReturnValue(null);
  mockStorageGetLocationUuid.mockReturnValue('location-uuid-5678');
  mockUploadVisit.mockResolvedValue(undefined);
  mockUseConfig.mockReturnValue({ config: defaultMockConfig });
  mockUploadAllAdditionalDocuments.mockResolvedValue(undefined);
  mockUploadAllPhysicalExamImages.mockResolvedValue(undefined);
  mockGetPendingImages.mockReturnValue([]);
  mockGetLatestVisitUuid.mockResolvedValue('mock-visit-uuid');
  mockGetPatient.mockResolvedValue({
    uuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    identifiers: [],
    person: { preferredName: null, attributes: [] },
  });
  mockFetchConceptAnswers.mockResolvedValue([]);
});

describe('VisitSummaryPage', () => {
  beforeEach(() => {
    mockAyuJsonList = [{ name: 'physExam.json', json: {} }];
  });

  /* ── Header ──────────────────────────────────────────────────────────── */

  it('should render the "Visit Summary" header', () => {
    renderWithData();
    expect(screen.getByText('Visit Summary')).toBeInTheDocument();
  });

  it('should render when ayuList has no physExam.json item', () => {
    mockAyuJsonList = [];
    renderWithData();
    expect(screen.getByText('Visit Summary')).toBeInTheDocument();
  });

  /* ── Empty-state messages ────────────────────────────────────────────── */

  it('should show "No vitals recorded" when data.vitals is null', () => {
    renderWithData({ vitals: null });
    expect(screen.getByText('No vitals recorded')).toBeInTheDocument();
  });

  it('should show "No visit reason recorded" when data.visitReason is null', () => {
    renderWithData({ visitReason: null });
    expect(screen.getByText('No visit reason recorded')).toBeInTheDocument();
  });

  it('should show "No physical exam recorded" when data.physicalExam is null', () => {
    renderWithData({ physicalExam: null });
    expect(screen.getByText('No physical exam recorded')).toBeInTheDocument();
  });

  it('should show "No medical history recorded" when data.medicalHistory is null', () => {
    renderWithData({ medicalHistory: null });
    expect(screen.getByText('No medical history recorded')).toBeInTheDocument();
  });

  /* ── Vitals data rendering ──────────────────────────────────────────── */

  it('should show vitals data when available', () => {
    renderWithData({ vitals: fullData.vitals });

    expect(screen.queryByText('No vitals recorded')).not.toBeInTheDocument();
    // Check a few representative vital labels/values
    expect(screen.getAllByText('Height(cm)').length).toBeGreaterThan(0);
    expect(screen.getAllByText('170').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Weight(kg)').length).toBeGreaterThan(0);
    expect(screen.getAllByText('70').length).toBeGreaterThan(0);
  });

  /* ── Confirmation modal ─────────────────────────────────────────────── */

  it('should show confirmation modal when upload button is clicked', () => {
    renderWithData(fullData);

    expect(screen.queryByTestId('confirmation-modal')).not.toBeInTheDocument();

    selectSpeciality();
    const uploadButton = screen.getByText('Upload Visit');
    fireEvent.click(uploadButton);

    expect(screen.getByTestId('confirmation-modal')).toBeInTheDocument();
    expect(screen.getByText('Send Visit')).toBeInTheDocument();
  });

  /* ── handleUploadVisit: validation ──────────────────────────────────── */

  it('should show error toast when required data is missing', async () => {
    // All sections null
    renderWithData();

    // Click Upload Visit to open modal
    selectSpeciality();
    fireEvent.click(screen.getByText('Upload Visit'));
    // Confirm in modal
    fireEvent.click(screen.getByTestId('modal-confirm'));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        'Error',
        'Please complete all sections before uploading',
        'error'
      );
    });
  });

  /* ── handleUploadVisit: success path ────────────────────────────────── */

  it('should call uploadVisit with correct payload when all data is present', async () => {
    renderWithData(fullData);

    // Open and confirm modal
    selectSpeciality();
    fireEvent.click(screen.getByText('Upload Visit'));
    fireEvent.click(screen.getByTestId('modal-confirm'));

    await waitFor(() => {
      expect(mockBuildVisitReasonHtml).toHaveBeenCalledWith(
        fullData.visitReason.details,
        fullData.visitReason.reasonNames,
        fullData.visitReason.detailsSections
      );
      expect(mockBuildPhysicalExamData).toHaveBeenCalled();
      expect(mockBuildMedicalHistoryData).toHaveBeenCalled();
      expect(mockBuildFamilyHistoryData).toHaveBeenCalled();
      expect(mockBuildVisitUploadPayload).toHaveBeenCalled();
      expect(mockUploadVisit).toHaveBeenCalledWith({ payload: true });
    });

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        'Success',
        'Visit uploaded successfully',
        'success'
      );
      expect(mockGetLatestVisitUuid).toHaveBeenCalledWith(
        'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
      );
    });
  });

  /* ── "Schedule Appointment" button after upload ───────────────────────── */

  it('should show Schedule Appointment button after successful upload and navigate on click', async () => {
    renderWithData(fullData);

    // Upload the visit
    selectSpeciality();
    fireEvent.click(screen.getByText('Upload Visit'));
    fireEvent.click(screen.getByTestId('modal-confirm'));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        'Success',
        'Visit uploaded successfully',
        'success'
      );
    });

    // Schedule Appointment button should appear after upload
    const scheduleBtn = await screen.findByText('Schedule Appointment');
    fireEvent.click(scheduleBtn);

    expect(mockNavigate).toHaveBeenCalledWith(
      '/appointment-schedule/mock-visit-uuid',
      { state: { speciality: 'General Physician' } }
    );
  });

  /* ── "Back to Edit" button ──────────────────────────────────────────── */

  it('should navigate to start-visit Medical History when "Back to Edit" button is clicked', () => {
    const setLastSectionIndex = vi.fn();
    mockUseStartVisitData.mockReturnValue({
      data: { ...fullData },
      patientUuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      visitId: 'test-visit-id',
      tempRecordId: null,

      restoredSectionIndex: null,
      lastSectionIndex: 0,
      setLastSectionIndex,
      setPatientUuid: vi.fn(),
      setVitalsData: vi.fn(),
      setVisitReasonData: vi.fn(),
      setPhysicalExamData: vi.fn(),
      setMedicalHistoryData: vi.fn(),
      setMedicalHistoryAnswers: vi.fn(),
      saveSectionToTemp: mockSaveSectionToTemp,
      clearVisitId: mockClearVisitId,
    markVisitUploaded: vi.fn(),
    physExamPendingImages: [],
    setPhysExamPendingImages: vi.fn(),
    });
    render(<BreadcrumbProvider><VisitSummaryPage /></BreadcrumbProvider>);

    const backButton = screen.getByText('Back to Edit');
    fireEvent.click(backButton);

    expect(setLastSectionIndex).toHaveBeenCalledWith(3);
    expect(mockNavigate).toHaveBeenCalledWith('/ayu');
  });

  it('should fall back to /ayu when pathname strips to empty string on Back to Edit', () => {
    const originalPathname = mockLocation.pathname;
    mockLocation.pathname = '/visit-summary';
    const setLastSectionIndex = vi.fn();
    mockUseStartVisitData.mockReturnValue({
      data: { ...fullData },
      patientUuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      visitId: 'test-visit-id',
      tempRecordId: null,

      restoredSectionIndex: null,
      lastSectionIndex: 0,
      setLastSectionIndex,
      setPatientUuid: vi.fn(),
      setVitalsData: vi.fn(),
      setVisitReasonData: vi.fn(),
      setPhysicalExamData: vi.fn(),
      setMedicalHistoryData: vi.fn(),
      setMedicalHistoryAnswers: vi.fn(),
      saveSectionToTemp: mockSaveSectionToTemp,
      clearVisitId: mockClearVisitId,
    markVisitUploaded: vi.fn(),
    physExamPendingImages: [],
    setPhysExamPendingImages: vi.fn(),
    });

    try {
      render(<BreadcrumbProvider><VisitSummaryPage /></BreadcrumbProvider>);
      fireEvent.click(screen.getByText('Back to Edit'));
      expect(setLastSectionIndex).toHaveBeenCalledWith(3);
      expect(mockNavigate).toHaveBeenCalledWith('/ayu');
    } finally {
      mockLocation.pathname = originalPathname;
    }
  });

  /* ── MedicalHistorySection: subheading items ──────────────────────── */

  it('should render subheading items in medical history', () => {
    renderWithData({
      ...fullData,
      medicalHistory: {
        patHistSummary: [
          {
            title: 'Past History',
            items: [
              { type: 'subheading' as const, heading: 'Chronic Conditions', values: ['Asthma'] },
              { type: 'labelValue' as const, label: 'Diabetes', value: 'Yes' },
            ],
          },
        ],
        famHistSummary: [],
      },
    });

    expect(screen.getByText('Chronic Conditions')).toBeInTheDocument();
    expect(screen.getByText('Diabetes')).toBeInTheDocument();
  });

  it('should render the title of each medical history section', () => {
    renderWithData({
      ...fullData,
      medicalHistory: {
        patHistSummary: [
          {
            title: 'Patient History',
            items: [
              { type: 'labelValue' as const, label: 'Diabetes', value: 'Yes' },
            ],
          },
        ],
        famHistSummary: [
          {
            title: 'Family History',
            items: [
              { type: 'labelValue' as const, label: 'Hypertension', value: 'No' },
            ],
          },
        ],
      },
    });

    expect(screen.getByText('Patient History')).toBeInTheDocument();
    expect(screen.getByText('Family History')).toBeInTheDocument();
    expect(screen.getByText('Diabetes')).toBeInTheDocument();
    expect(screen.getByText('Hypertension')).toBeInTheDocument();
  });

  it('should not render a section title when it is empty', () => {
    renderWithData({
      ...fullData,
      medicalHistory: {
        patHistSummary: [
          {
            title: '',
            items: [
              { type: 'labelValue' as const, label: 'Diabetes', value: 'Yes' },
            ],
          },
        ],
        famHistSummary: [],
      },
    });

    expect(screen.getByText('Diabetes')).toBeInTheDocument();
    // No section title should be rendered for the empty-title section
    expect(screen.queryByText('Patient History')).not.toBeInTheDocument();
  });

  it('should return null for unknown item types in medical history', () => {
    renderWithData({
      ...fullData,
      medicalHistory: {
        patHistSummary: [
          {
            title: 'Past History',
            items: [
              { type: 'unknownType' as any, label: 'X', value: 'Y' },
              { type: 'labelValue' as const, label: 'Known', value: 'Value' },
            ],
          },
        ],
        famHistSummary: [],
      },
    });

    // The known labelValue item should render, the unknown type should be skipped
    expect(screen.getByText('Known')).toBeInTheDocument();
  });

  it('should show "No information" for medical history item with null value', () => {
    renderWithData({
      ...fullData,
      medicalHistory: {
        patHistSummary: [
          {
            title: 'Past History',
            items: [
              { type: 'labelValue' as const, label: 'Diabetes', value: null },
            ],
          },
        ],
        famHistSummary: [],
      },
    });

    expect(screen.getByText('No information')).toBeInTheDocument();
  });

  /* ── Missing patient/location/provider shows error toast ──────────── */

  it('should show error toast when patient UUID is missing', async () => {
    mockUseStartVisitData.mockReturnValue({
      data: { ...fullData },
      patientUuid: null as any,
      visitId: 'test-visit-id',
      tempRecordId: null,
    
      restoredSectionIndex: null,
      lastSectionIndex: 0,
      setLastSectionIndex: vi.fn(),
      setPatientUuid: vi.fn(),
      setVitalsData: vi.fn(),
      setVisitReasonData: vi.fn(),
      setPhysicalExamData: vi.fn(),
      setMedicalHistoryData: vi.fn(),
      setMedicalHistoryAnswers: vi.fn(),
      saveSectionToTemp: mockSaveSectionToTemp,
      clearVisitId: mockClearVisitId,
    markVisitUploaded: vi.fn(),
    physExamPendingImages: [],
    setPhysExamPendingImages: vi.fn(),
    });
    mockStorageGet.mockReturnValue(null);

    render(<BreadcrumbProvider><VisitSummaryPage /></BreadcrumbProvider>);

    selectSpeciality();
    fireEvent.click(screen.getByText('Upload Visit'));
    fireEvent.click(screen.getByTestId('modal-confirm'));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        'Error',
        'Missing patient, location, or provider information',
        'error'
      );
    });
  });

  it('should show error toast when location UUID is missing', async () => {
    mockUseStartVisitData.mockReturnValue({
      data: { ...fullData },
      patientUuid: 'patient-uuid',
      visitId: 'test-visit-id',
      tempRecordId: null,
    
      restoredSectionIndex: null,
      lastSectionIndex: 0,
      setLastSectionIndex: vi.fn(),
      setPatientUuid: vi.fn(),
      setVitalsData: vi.fn(),
      setVisitReasonData: vi.fn(),
      setPhysicalExamData: vi.fn(),
      setMedicalHistoryData: vi.fn(),
      setMedicalHistoryAnswers: vi.fn(),
      saveSectionToTemp: mockSaveSectionToTemp,
      clearVisitId: mockClearVisitId,
    markVisitUploaded: vi.fn(),
    physExamPendingImages: [],
    setPhysExamPendingImages: vi.fn(),
    });
    mockStorageGetLocationUuid.mockReturnValue(null as any);

    render(<BreadcrumbProvider><VisitSummaryPage /></BreadcrumbProvider>);

    selectSpeciality();
    fireEvent.click(screen.getByText('Upload Visit'));
    fireEvent.click(screen.getByTestId('modal-confirm'));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        'Error',
        'Missing patient, location, or provider information',
        'error'
      );
    });
  });

  /* ── Upload failure shows error toast ─────────────────────────────── */

  it('should show error toast when upload fails', async () => {
    mockUploadVisit.mockRejectedValueOnce(new Error('Network error'));
    renderWithData(fullData);

    selectSpeciality();
    fireEvent.click(screen.getByText('Upload Visit'));
    fireEvent.click(screen.getByTestId('modal-confirm'));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        'Error',
        'Failed to upload visit. Please try again.',
        'error'
      );
    });
  });

  /* ── Storage fallback when ctxPatientUuid is null ──────────────────── */

  it('should use storage fallback when ctxPatientUuid is null', async () => {
    mockStorageGet.mockImplementation((key: string) =>
      key === 'patientUuid' ? 'storage-patient-uuid' : null
    );
    mockUseStartVisitData.mockReturnValue({
      data: { ...fullData },
      patientUuid: null as any,
      visitId: 'test-visit-id',
      tempRecordId: null,
    
      restoredSectionIndex: null,
      lastSectionIndex: 0,
      setLastSectionIndex: vi.fn(),
      setPatientUuid: vi.fn(),
      setVitalsData: vi.fn(),
      setVisitReasonData: vi.fn(),
      setPhysicalExamData: vi.fn(),
      setMedicalHistoryData: vi.fn(),
      setMedicalHistoryAnswers: vi.fn(),
      saveSectionToTemp: mockSaveSectionToTemp,
      clearVisitId: mockClearVisitId,
    markVisitUploaded: vi.fn(),
    physExamPendingImages: [],
    setPhysExamPendingImages: vi.fn(),
    });

    render(<BreadcrumbProvider><VisitSummaryPage /></BreadcrumbProvider>);

    selectSpeciality();
    fireEvent.click(screen.getByText('Upload Visit'));
    fireEvent.click(screen.getByTestId('modal-confirm'));

    await waitFor(() => {
      expect(mockUploadVisit).toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith(
        'Success',
        'Visit uploaded successfully',
        'success'
      );
    });
  });

  /* ── Toggle all button toggles allOpen state ──────────────────────── */

  it('should toggle between "Close all" and "Open all" when clicked', () => {
    renderWithData(fullData);

    // Initially allOpen is true, so button says "Close all"
    const toggleButton = screen.getByText('Close all');
    expect(toggleButton).toBeInTheDocument();

    fireEvent.click(toggleButton);

    // After click, allOpen is false, so button says "Open all"
    expect(screen.getByText('Open all')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Open all'));

    // After second click, back to "Close all"
    expect(screen.getByText('Close all')).toBeInTheDocument();
  });

  /* ── Modal cancel/close closes modal ──────────────────────────────── */

  it('should close the confirmation modal when cancel is clicked', () => {
    renderWithData(fullData);

    selectSpeciality();
    fireEvent.click(screen.getByText('Upload Visit'));
    expect(screen.getByTestId('confirmation-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('modal-cancel'));

    expect(screen.queryByTestId('confirmation-modal')).not.toBeInTheDocument();
  });

  /* ── Full vitals rendering (mapVitals, VitalsSection branches) ─────── */

  it('should render all vitals including BMI and BP from formValues', () => {
    renderWithData({ vitals: fullData.vitals });

    expect(screen.getAllByText('BMI').length).toBeGreaterThan(0);
    expect(screen.getAllByText('24.2').length).toBeGreaterThan(0);
    expect(screen.getAllByText('BP').length).toBeGreaterThan(0);
    expect(screen.getAllByText('120/80').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pulse').length).toBeGreaterThan(0);
    expect(screen.getAllByText('72').length).toBeGreaterThan(0);
  });

  it('should render "No information" for null vital values', () => {
    renderWithData({
      vitals: {
        formValues: {
          height_cm: undefined as any,
          weight_kg: undefined as any,
          bmi: undefined as any,
          bp_systolic: undefined as any,
          bp_diastolic: undefined as any,
          pulse_bpm: undefined as any,
          temprature_f: undefined as any,
          spo2: undefined as any,
          respiratory_rate: undefined as any,
        },
        config: [],
      },
    });

    // mapVitals v() with undefined => value null, note 'No information'
    // getVitalDisplay(null, 'No information') => 'No information'
    const noInfoElements = screen.getAllByText('No information');
    expect(noInfoElements.length).toBeGreaterThanOrEqual(1);
  });

  /* ── LabelValueRow compact prop branch ────────────────────────────── */

  it('should render LabelValueRow with compact styling when vitals use compact=false by default', () => {
    renderWithData({ vitals: fullData.vitals });
    // LabelValueRow renders with py-1 when compact is false (default)
    expect(screen.getAllByText('Height(cm)').length).toBeGreaterThan(0);
  });

  /* ── Physical exam data rendering ─────────────────────────────────── */

  it('should render physical examination data with answers', () => {
    renderWithData({
      ...fullData,
      physicalExam: {
        answers: {
          pe1: ['opt1'],
        },
        details: [{ label: 'General Appearance', value: 'Normal' }],
      },
    });

    expect(screen.getByText('General Appearance')).toBeInTheDocument();
    expect(screen.getByText('Normal')).toBeInTheDocument();
  });

  it('should handle physical exam with empty answers (details empty)', () => {
    renderWithData({
      ...fullData,
      physicalExam: {
        answers: {},
        details: [],
      },
    });

    // No physical exam items with answers, but section still renders (not null)
    expect(screen.queryByText('No physical exam recorded')).not.toBeInTheDocument();
  });

  it('should render physical exam detailsSections with section titles and labelValue items', () => {
    renderWithData({
      ...fullData,
      physicalExam: {
        answers: { pe1: ['opt1'] },
        details: [{ label: 'Jaundice', value: 'Present' }],
        detailsSections: [
          {
            title: 'General Exams',
            items: [
              { type: 'labelValue' as const, label: 'Jaundice', value: 'Present' },
            ],
          },
          {
            title: 'Throat',
            items: [
              { type: 'labelValue' as const, label: 'Tonsils', value: 'Swollen' },
              { type: 'labelValue' as const, label: 'Redness', value: null },
            ],
          },
        ],
      },
    });

    expect(screen.getByText('General Exams')).toBeInTheDocument();
    expect(screen.getAllByText('Jaundice').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Present').length).toBeGreaterThan(0);
    expect(screen.getByText('Throat')).toBeInTheDocument();
    expect(screen.getByText('Tonsils')).toBeInTheDocument();
    expect(screen.getByText('Swollen')).toBeInTheDocument();
    // null value falls back to 'No information'
    expect(screen.getByText('No information')).toBeInTheDocument();
  });

  it('should render physical exam detailsSections with subheading items', () => {
    renderWithData({
      ...fullData,
      physicalExam: {
        answers: { pe1: ['opt1'] },
        details: [],
        detailsSections: [
          {
            title: 'Hands',
            items: [
              { type: 'subheading' as const, heading: 'Nail Check' },
              { type: 'labelValue' as const, label: 'Pallor', value: 'Normal' },
            ],
          },
        ],
      },
    });

    expect(screen.getByText('Hands')).toBeInTheDocument();
    expect(screen.getByText('Nail Check')).toBeInTheDocument();
    expect(screen.getByText('Pallor')).toBeInTheDocument();
  });

  it('should render physical exam detailsSections without section title when title is empty', () => {
    renderWithData({
      ...fullData,
      physicalExam: {
        answers: { pe1: ['opt1'] },
        details: [],
        detailsSections: [
          {
            title: '',
            items: [
              { type: 'labelValue' as const, label: 'Eyes', value: 'Clear' },
            ],
          },
        ],
      },
    });

    expect(screen.getByText('Eyes')).toBeInTheDocument();
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('should skip unknown item types in physical exam detailsSections', () => {
    renderWithData({
      ...fullData,
      physicalExam: {
        answers: { pe1: ['opt1'] },
        details: [],
        detailsSections: [
          {
            title: 'Section',
            items: [
              { type: 'unknown' as any, label: 'X', value: 'Y' },
              { type: 'labelValue' as const, label: 'Known', value: 'Item' },
            ],
          },
        ],
      },
    });

    expect(screen.getByText('Known')).toBeInTheDocument();
    expect(screen.getByText('Item')).toBeInTheDocument();
  });

  /* ── Check-up reason section rendering ────────────────────────────── */

  it('should render check-up reason with chief complaint chips and details', () => {
    renderWithData({
      ...fullData,
      visitReason: {
        answers: {},
        reasonNames: ['Cough', 'Fever'],
        details: [{ label: 'Duration', value: '3 days' }],
      },
    });

    expect(screen.getByText('Chief complaint(s)')).toBeInTheDocument();
    expect(screen.getByText('Cough')).toBeInTheDocument();
    expect(screen.getByText('Fever')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('3 days')).toBeInTheDocument();
  });

  it('should segregate questions by protocol when multiple detailsSections exist', () => {
    renderWithData({
      ...fullData,
      visitReason: {
        answers: {},
        reasonNames: ['Cough', 'Fever'],
        details: [
          { label: 'Cough type', value: 'Dry' },
          { label: 'Temperature', value: 'High' },
        ],
        detailsSections: [
          {
            title: 'Cough',
            items: [
              { type: 'labelValue', label: 'Cough type', value: 'Dry' },
            ],
          },
          {
            title: 'Fever',
            items: [
              { type: 'labelValue', label: 'Temperature', value: 'High' },
              // Null value exercises the `?? ''` fallback in the grouped render.
              { type: 'labelValue', label: 'Notes', value: null },
            ],
          },
        ],
      },
    });

    // Protocol headings segregate the two complaints' questions.
    const coughHeadings = screen.getAllByText('Cough');
    const feverHeadings = screen.getAllByText('Fever');
    // One chip + one section heading each.
    expect(coughHeadings.length).toBeGreaterThanOrEqual(2);
    expect(feverHeadings.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Cough type')).toBeInTheDocument();
    expect(screen.getByText('Temperature')).toBeInTheDocument();
  });

  it('should render subheading items inside grouped sections', () => {
    renderWithData({
      ...fullData,
      visitReason: {
        answers: {},
        reasonNames: ['Cough', 'Fever'],
        details: [
          { label: 'Patient reports', value: 'Chills' },
          { label: 'Temperature', value: 'High' },
        ],
        detailsSections: [
          {
            title: 'Cough',
            items: [
              // Subheading with values -> "Patient reports: Chills, Sweating".
              {
                type: 'subheading',
                heading: 'Patient reports',
                values: ['Chills', 'Sweating'],
              },
              // Subheading with no values -> heading only (covers the ternary).
              { type: 'subheading', heading: 'Notes', values: [] },
            ],
          },
          {
            title: 'Fever',
            items: [
              { type: 'labelValue', label: 'Temperature', value: 'High' },
            ],
          },
        ],
      },
    });

    expect(
      screen.getByText('Patient reports: Chills, Sweating')
    ).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByText('Temperature')).toBeInTheDocument();
  });

  it('should skip unknown item types inside grouped checkup-reason sections', () => {
    renderWithData({
      ...fullData,
      visitReason: {
        answers: {},
        reasonNames: ['Cough', 'Fever'],
        details: [{ label: 'Known', value: 'Value' }],
        detailsSections: [
          {
            title: 'Cough',
            items: [
              { type: 'unknownType' as any, label: 'X', value: 'Y' },
              { type: 'labelValue' as const, label: 'Known', value: 'Value' },
            ],
          },
          {
            title: 'Fever',
            items: [
              { type: 'labelValue' as const, label: 'Temperature', value: 'High' },
            ],
          },
        ],
      },
    });

    // The known labelValue renders; the unknown type is skipped (return null).
    expect(screen.getByText('Known')).toBeInTheDocument();
    expect(screen.getByText('Temperature')).toBeInTheDocument();
  });

  it('should not show a section heading when there is a single protocol', () => {
    renderWithData({
      ...fullData,
      visitReason: {
        answers: {},
        reasonNames: ['Cough'],
        details: [{ label: 'Cough type', value: 'Dry' }],
        detailsSections: [
          {
            title: '',
            items: [
              { type: 'labelValue', label: 'Cough type', value: 'Dry' },
            ],
          },
        ],
      },
    });

    expect(screen.getAllByText('Cough')).toHaveLength(1);
    expect(screen.getByText('Cough type')).toBeInTheDocument();
    expect(screen.getByText('Dry')).toBeInTheDocument();
  });

  it('should fall back to flat details when detailsSections is absent', () => {
    renderWithData({
      ...fullData,
      visitReason: {
        answers: {},
        reasonNames: ['Cough'],
        details: [{ label: 'Duration', value: '3 days' }],
          },
    });

    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('3 days')).toBeInTheDocument();
  });

  /* ── Vitals with null values (note fallback path) ────────────────── */

  it('should show "No information" for vitals with null values via note fallback', () => {
    renderWithData({
      vitals: {
        formValues: {
          height_cm: undefined as any,
          weight_kg: undefined as any,
          bmi: undefined as any,
          bp_systolic: undefined as any,
          bp_diastolic: undefined as any,
          pulse_bpm: undefined as any,
          temprature_f: undefined as any,
          spo2: undefined as any,
          respiratory_rate: undefined as any,
        },
        config: [],
      },
    });

    // When val is null, note is 'No information' — covers val?.toString() ?? note ?? 'No information'
    const noInfoElements = screen.getAllByText('No information');
    expect(noInfoElements.length).toBeGreaterThan(0);
  });

  /* ── Physical exam with question having no answers (answers[q.id] ?? []) ── */

  it('should handle physical exam questions with no matching answers', () => {
    renderWithData({
      physicalExam: {
        answers: {
          // pe1 has no entry
        },
        details: [],
      },
    });

    // Should still render without crashing, no exam items shown
    expect(screen.queryByText('General Appearance')).not.toBeInTheDocument();
  });

  /* ── Doctor's Specialty Dropdown ──────────────────────────────────── */

  it('should render Doctor\'s specialty label and dropdown', () => {
    renderWithData(fullData);
    expect(screen.getByText("Doctor's specialty")).toBeInTheDocument();
    expect(screen.getByText("Select Doctor's specialty")).toBeInTheDocument();
  });

  it('should render specialization options from config in the dropdown', () => {
    renderWithData(fullData);

    // Click dropdown to open options
    const dropdownButton = screen.getByRole('button', { name: /select doctor's specialty/i });
    fireEvent.click(dropdownButton);

    expect(screen.getByText('Dermatology')).toBeInTheDocument();
    expect(screen.getByText('Cardiology')).toBeInTheDocument();
  });

  it('should update speciality when a dropdown option is selected', () => {
    renderWithData(fullData);

    // Open dropdown
    const dropdownButton = screen.getByRole('button', { name: /select doctor's specialty/i });
    fireEvent.click(dropdownButton);

    // Select Dermatology
    fireEvent.click(screen.getByText('Dermatology'));

    // Dropdown should now show Dermatology
    expect(screen.getByText('Dermatology')).toBeInTheDocument();
  });

  it('should show speciality error and not open modal when Upload Visit clicked without speciality', () => {
    renderWithData(fullData);

    // Click Upload Visit WITHOUT selecting a speciality first
    fireEvent.click(screen.getByText('Upload Visit'));

    // Modal should NOT appear
    expect(screen.queryByTestId('confirmation-modal')).not.toBeInTheDocument();
    // Error message should be shown
    expect(screen.getByText("Please select a doctor's specialty")).toBeInTheDocument();
  });

  /* ── Priority Visit Toggle ───────────────────────────────────────── */

  it('should render Priority Visit label and toggle', () => {
    renderWithData(fullData);
    expect(screen.getByText('Priority Visit')).toBeInTheDocument();
    // Toggle checkbox should be unchecked by default
    const toggle = screen.getByRole('checkbox');
    expect(toggle).not.toBeChecked();
  });

  it('should toggle priority visit when clicked', () => {
    renderWithData(fullData);

    const toggle = screen.getByRole('checkbox');
    expect(toggle).not.toBeChecked();

    fireEvent.click(toggle);
    expect(toggle).toBeChecked();
  });

  it('should pass speciality and priorityVisit to buildVisitUploadPayload', async () => {
    renderWithData(fullData);

    // Toggle priority visit on
    const toggle = screen.getByRole('checkbox');
    fireEvent.click(toggle);

    // Open and confirm upload
    selectSpeciality();
    fireEvent.click(screen.getByText('Upload Visit'));
    fireEvent.click(screen.getByTestId('modal-confirm'));

    await waitFor(() => {
      expect(mockBuildVisitUploadPayload).toHaveBeenCalledWith(
        expect.objectContaining({
          speciality: 'General Physician',
          priorityVisit: true,
        })
      );
    });
  });

  /* ── Config null/empty fallbacks ──────────────────────────────────── */

  it('should handle null config gracefully with empty specializations', () => {
    mockUseConfig.mockReturnValue({ config: null as any });
    renderWithData(fullData);

    // Dropdown should still render with placeholder
    expect(screen.getByText("Doctor's specialty")).toBeInTheDocument();
  });

  it('should handle specialization entries with null name', () => {
    mockUseConfig.mockReturnValue({
      config: {
        specialization: [
          { name: null as any },
          { name: 'Cardiology' },
        ],
      },
    });
    renderWithData(fullData);

    // Open dropdown to see options
    const dropdownButton = screen.getByRole('button', { name: /select doctor's specialty/i });
    fireEvent.click(dropdownButton);

    // Null name should fallback to "Option 1"
    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Cardiology')).toBeInTheDocument();
  });

  /* ── Physical exam with non-matching answer IDs ──────────────────── */

  it('should render empty value when physical exam answer IDs do not match any option', () => {
    renderWithData({
      ...fullData,
      physicalExam: {
        answers: {
          pe1: ['non_existent_option'],
        },
        details: [{ label: 'General Appearance', value: '' }],
      },
    });

    // details has the label but value is empty since answer IDs didn't match any option
    expect(screen.getByText('General Appearance')).toBeInTheDocument();
  });

  it('should call bulkMarkSynced when tempRecordId is set after successful upload', async () => {
    mockUploadVisit.mockResolvedValue({ success: true });
    mockBulkMarkSynced.mockResolvedValue({ data: { updatedCount: 1 } });
    mockUseStartVisitData.mockReturnValue({
      data: { ...fullData },
      patientUuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      visitId: 'test-visit-id',
      tempRecordId: 42, // Non-null → triggers bulkMarkSynced branch
    
      restoredSectionIndex: null,
      lastSectionIndex: 0,
      setLastSectionIndex: vi.fn(),
      setPatientUuid: vi.fn(),
      setVitalsData: vi.fn(),
      setVisitReasonData: vi.fn(),
      setPhysicalExamData: vi.fn(),
      setMedicalHistoryData: vi.fn(),
      setMedicalHistoryAnswers: vi.fn(),
      saveSectionToTemp: mockSaveSectionToTemp,
      clearVisitId: mockClearVisitId,
    markVisitUploaded: vi.fn(),
    physExamPendingImages: [],
    setPhysExamPendingImages: vi.fn(),
    });

    render(<BreadcrumbProvider><VisitSummaryPage /></BreadcrumbProvider>);

    selectSpeciality();
    fireEvent.click(screen.getByRole('button', { name: /Upload Visit/i }));
    fireEvent.click(screen.getByTestId('modal-confirm'));

    await waitFor(() => {
      expect(mockBulkMarkSynced).toHaveBeenCalledWith([42]);
    });
  });

  it('should swallow errors from bulkMarkSynced', async () => {
    mockUploadVisit.mockResolvedValue({ success: true });
    mockBulkMarkSynced.mockRejectedValue(new Error('sync failed'));
    mockUseStartVisitData.mockReturnValue({
      data: { ...fullData },
      patientUuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      visitId: 'test-visit-id',
      tempRecordId: 99,
    
      restoredSectionIndex: null,
      lastSectionIndex: 0,
      setLastSectionIndex: vi.fn(),
      setPatientUuid: vi.fn(),
      setVitalsData: vi.fn(),
      setVisitReasonData: vi.fn(),
      setPhysicalExamData: vi.fn(),
      setMedicalHistoryData: vi.fn(),
      setMedicalHistoryAnswers: vi.fn(),
      saveSectionToTemp: mockSaveSectionToTemp,
      clearVisitId: mockClearVisitId,
    markVisitUploaded: vi.fn(),
    physExamPendingImages: [],
    setPhysExamPendingImages: vi.fn(),
    });

    render(<BreadcrumbProvider><VisitSummaryPage /></BreadcrumbProvider>);

    selectSpeciality();
    fireEvent.click(screen.getByRole('button', { name: /Upload Visit/i }));
    fireEvent.click(screen.getByTestId('modal-confirm'));

    // Upload should still succeed even if mark-synced fails (caught silently)
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        'Success',
        'Visit uploaded successfully',
        'success'
      );
    });
  });

  /* ── Additional notes textarea ───────────────────────────────────── */

  it('should update additional notes when typing in the textarea', () => {
    renderWithData(fullData);

    const textarea = screen.getByPlaceholderText('Leave a note for doctor');
    fireEvent.change(textarea, { target: { value: 'Patient needs follow-up' } });

    expect(textarea).toHaveValue('Patient needs follow-up');
  });

  it('should pass additional notes to buildVisitUploadPayload', async () => {
    renderWithData(fullData);

    const textarea = screen.getByPlaceholderText('Leave a note for doctor');
    fireEvent.change(textarea, { target: { value: 'Test doctor note' } });

    selectSpeciality();
    fireEvent.click(screen.getByText('Upload Visit'));
    fireEvent.click(screen.getByTestId('modal-confirm'));

    await waitFor(() => {
      expect(mockBuildVisitUploadPayload).toHaveBeenCalledWith(
        expect.objectContaining({ doctorNotes: 'Test doctor note' })
      );
    });
  });

  /* ── Add document button ─────────────────────────────────────────── */

  it('should trigger file input when "+" button is clicked', () => {
    renderWithData(fullData);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, 'click');

    const addButton = screen.getByText('+');
    fireEvent.click(addButton);

    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  /* ── File selection: image file ──────────────────────────────────── */

  it('should add an image document with preview on file selection', async () => {
    const OriginalFileReader = globalThis.FileReader;
    const mockFileReader = {
      result: 'data:image/png;base64,testdata',
      onloadend: null as (() => void) | null,
      readAsDataURL: vi.fn(function (this: any) {
        this.onloadend?.();
      }),
    };
    globalThis.FileReader = vi.fn(() => mockFileReader) as any;

    renderWithData(fullData);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const imageFile = new File(['test'], 'photo.png', { type: 'image/png' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [imageFile] } });
    });

    expect(mockFileReader.readAsDataURL).toHaveBeenCalledWith(imageFile);
    expect(screen.getByText('photo.png')).toBeInTheDocument();
    expect(screen.getByAltText('photo.png')).toBeInTheDocument();

    globalThis.FileReader = OriginalFileReader;
  });

  /* ── File selection: non-image file ──────────────────────────────── */

  it('should add an image document with preview on file selection', async () => {
    const OriginalFileReader = globalThis.FileReader;
    const mockFileReader = {
      result: 'data:image/jpeg;base64,testjpeg',
      onloadend: null as (() => void) | null,
      readAsDataURL: vi.fn(function (this: any) {
        this.onloadend?.();
      }),
    };
    globalThis.FileReader = vi.fn(() => mockFileReader) as any;

    renderWithData(fullData);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const imgFile = new File(['test'], 'report.jpg', { type: 'image/jpeg' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [imgFile] } });
    });

    expect(screen.getByText('report.jpg')).toBeInTheDocument();
    expect(screen.getByAltText('report.jpg')).toBeInTheDocument();

    globalThis.FileReader = OriginalFileReader;
  });

  /* ── File selection: null files ──────────────────────────────────── */

  it('should handle file input change with null files', () => {
    renderWithData(fullData);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: null } });

    // No documents should be added
    expect(screen.queryByText('✕')).not.toBeInTheDocument();
  });

  /* ── Remove document ─────────────────────────────────────────────── */

  it('should remove a document when remove button is clicked', async () => {
    const OriginalFileReader = globalThis.FileReader;
    const mockFileReader = {
      result: 'data:image/png;base64,removetest',
      onloadend: null as (() => void) | null,
      readAsDataURL: vi.fn(function (this: any) {
        this.onloadend?.();
      }),
    };
    globalThis.FileReader = vi.fn(() => mockFileReader) as any;

    renderWithData(fullData);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const imgFile = new File(['test'], 'to-remove.png', { type: 'image/png' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [imgFile] } });
    });

    expect(screen.getByText('to-remove.png')).toBeInTheDocument();

    const removeButton = screen.getByText('✕');
    await act(async () => {
      fireEvent.click(removeButton);
    });

    expect(screen.queryByText('to-remove.png')).not.toBeInTheDocument();

    globalThis.FileReader = OriginalFileReader;
  });

  /* ── Document count display ──────────────────────────────────────── */

  it('should show document count when documents are added', async () => {
    const OriginalFileReader = globalThis.FileReader;
    const mockFileReader = {
      result: 'data:image/png;base64,counttest',
      onloadend: null as (() => void) | null,
      readAsDataURL: vi.fn(function (this: any) {
        this.onloadend?.();
      }),
    };
    globalThis.FileReader = vi.fn(() => mockFileReader) as any;

    renderWithData(fullData);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['test'], 'doc1.png', { type: 'image/png' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    expect(screen.getByText('(1)')).toBeInTheDocument();

    globalThis.FileReader = OriginalFileReader;
  });

  /* ── Additional documents upload during visit upload ─────────────── */

  it('should upload additional documents after successful visit upload', async () => {
    const OriginalFileReader = globalThis.FileReader;
    const mockFileReader = {
      result: 'data:image/png;base64,uploadtest',
      onloadend: null as (() => void) | null,
      readAsDataURL: vi.fn(function (this: any) {
        this.onloadend?.();
      }),
    };
    globalThis.FileReader = vi.fn(() => mockFileReader) as any;

    const ADULT_INITIAL_UUID = '8d5b27bc-c2cc-11de-8d13-0010c6dffd0f';
    mockUploadVisit.mockResolvedValue({
      encounters: [
        { uuid: 'enc-uuid-123', encounterType: { uuid: ADULT_INITIAL_UUID } },
      ],
    });

    renderWithData(fullData);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const imgFile = new File(['test'], 'upload-doc.png', { type: 'image/png' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [imgFile] } });
    });

    selectSpeciality();
    fireEvent.click(screen.getByText('Upload Visit'));
    fireEvent.click(screen.getByTestId('modal-confirm'));

    await waitFor(() => {
      expect(mockClearPendingDocuments).toHaveBeenCalled();
      expect(mockAddPendingDocument).toHaveBeenCalledWith(imgFile, 'upload-doc.png');
      expect(mockUploadAllAdditionalDocuments).toHaveBeenCalledWith(
        'enc-uuid-123',
        'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
      );
    });

    globalThis.FileReader = OriginalFileReader;
  });

  it('should upload documents with fallback encounter when no matching encounter type', async () => {
    const OriginalFileReader = globalThis.FileReader;
    const mockFileReader = {
      result: 'data:image/png;base64,skiptest',
      onloadend: null as (() => void) | null,
      readAsDataURL: vi.fn(function (this: any) {
        this.onloadend?.();
      }),
    };
    globalThis.FileReader = vi.fn(() => mockFileReader) as any;

    mockUploadVisit.mockResolvedValue({
      encounters: [
        { uuid: 'enc-uuid-456', encounterType: { uuid: 'some-other-type' } },
      ],
    });

    renderWithData(fullData);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const imgFile = new File(['test'], 'skip-doc.png', { type: 'image/png' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [imgFile] } });
    });

    selectSpeciality();
    fireEvent.click(screen.getByText('Upload Visit'));
    fireEvent.click(screen.getByTestId('modal-confirm'));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        'Success',
        'Visit uploaded successfully',
        'success'
      );
    });

    expect(mockClearPendingDocuments).toHaveBeenCalled();
    expect(mockUploadAllAdditionalDocuments).toHaveBeenCalled();

    globalThis.FileReader = OriginalFileReader;
  });

  it('should upload documents with fallback encounter when response has no encounters', async () => {
    const OriginalFileReader = globalThis.FileReader;
    const mockFileReader = {
      result: 'data:image/png;base64,noenctest',
      onloadend: null as (() => void) | null,
      readAsDataURL: vi.fn(function (this: any) {
        this.onloadend?.();
      }),
    };
    globalThis.FileReader = vi.fn(() => mockFileReader) as any;

    mockUploadVisit.mockResolvedValue({});

    renderWithData(fullData);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const imgFile = new File(['test'], 'no-enc.png', { type: 'image/png' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [imgFile] } });
    });

    selectSpeciality();
    fireEvent.click(screen.getByText('Upload Visit'));
    fireEvent.click(screen.getByTestId('modal-confirm'));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        'Success',
        'Visit uploaded successfully',
        'success'
      );
    });

    expect(mockClearPendingDocuments).toHaveBeenCalled();
    expect(mockUploadAllAdditionalDocuments).toHaveBeenCalled();

    globalThis.FileReader = OriginalFileReader;
  });

  /* ── Additional edge cases ──────────────────────────────────────────── */

  it('should render Uploading state on button during upload', async () => {
    let resolveUpload!: (value: any) => void;
    mockUploadVisit.mockReturnValue(
      new Promise(resolve => {
        resolveUpload = resolve;
      })
    );

    renderWithData(fullData);

    selectSpeciality();
    fireEvent.click(screen.getByText('Upload Visit'));
    fireEvent.click(screen.getByTestId('modal-confirm'));

    await waitFor(() => {
      expect(screen.getByText('Uploading...')).toBeInTheDocument();
    });

    // The upload button should be disabled during upload
    const uploadBtn = screen.getByText('Uploading...');
    expect(uploadBtn).toBeDisabled();

    resolveUpload({ success: true });

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Success', 'Visit uploaded successfully', 'success');
    });
  });

  it('should pass patient UUID from storage when ctxPatientUuid is falsy', async () => {
    mockStorageGet.mockImplementation((key: string) =>
      key === 'patientUuid' ? 'fallback-patient-uuid' : null
    );
    mockUseStartVisitData.mockReturnValue({
      data: { ...fullData },
      patientUuid: null as any,
      visitId: 'test-visit-id',
      tempRecordId: null,
    
      restoredSectionIndex: null,
      lastSectionIndex: 0,
      setLastSectionIndex: vi.fn(),
      setPatientUuid: vi.fn(),
      setVitalsData: vi.fn(),
      setVisitReasonData: vi.fn(),
      setPhysicalExamData: vi.fn(),
      setMedicalHistoryData: vi.fn(),
      setMedicalHistoryAnswers: vi.fn(),
      saveSectionToTemp: mockSaveSectionToTemp,
      clearVisitId: mockClearVisitId,
    markVisitUploaded: vi.fn(),
    physExamPendingImages: [],
    setPhysExamPendingImages: vi.fn(),
    });

    render(<BreadcrumbProvider><VisitSummaryPage /></BreadcrumbProvider>);

    selectSpeciality();
    fireEvent.click(screen.getByText('Upload Visit'));
    fireEvent.click(screen.getByTestId('modal-confirm'));

    await waitFor(() => {
      expect(mockBuildVisitUploadPayload).toHaveBeenCalledWith(
        expect.objectContaining({
          patientUuid: 'fallback-patient-uuid',
        })
      );
    });
  });

  it('should show error toast when provider UUID is missing', async () => {
    vi.mocked(mockHwProfile as any).providerUuid = undefined;

    renderWithData(fullData);

    selectSpeciality();
    fireEvent.click(screen.getByText('Upload Visit'));
    fireEvent.click(screen.getByTestId('modal-confirm'));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        'Error',
        'Missing patient, location, or provider information',
        'error'
      );
    });

    // Restore
    (mockHwProfile as any).providerUuid = 'provider-uuid-1234';
  });

  it('should upload documents using getLatestEncounterUuid fallback when response encounters is undefined', async () => {
    const OriginalFileReader = globalThis.FileReader;
    const mockFileReader = {
      result: 'data:image/png;base64,fallbacktest',
      onloadend: null as (() => void) | null,
      readAsDataURL: vi.fn(function (this: any) {
        this.onloadend?.();
      }),
    };
    globalThis.FileReader = vi.fn(() => mockFileReader) as any;

    mockUploadVisit.mockResolvedValue(undefined);
    mockGetLatestEncounterUuid.mockResolvedValue('latest-enc-uuid');

    renderWithData(fullData);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const imgFile = new File(['test'], 'fallback.png', { type: 'image/png' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [imgFile] } });
    });

    selectSpeciality();
    fireEvent.click(screen.getByText('Upload Visit'));
    fireEvent.click(screen.getByTestId('modal-confirm'));

    await waitFor(() => {
      expect(mockGetLatestEncounterUuid).toHaveBeenCalledWith(
        'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        '8d5b27bc-c2cc-11de-8d13-0010c6dffd0f'
      );
      expect(mockUploadAllAdditionalDocuments).toHaveBeenCalledWith(
        'latest-enc-uuid',
        'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
      );
    });

    globalThis.FileReader = OriginalFileReader;
  });

  it('should not upload documents when additionalDocuments is empty', async () => {
    renderWithData(fullData);

    selectSpeciality();
    fireEvent.click(screen.getByText('Upload Visit'));
    fireEvent.click(screen.getByTestId('modal-confirm'));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Success', 'Visit uploaded successfully', 'success');
    });

    expect(mockClearPendingDocuments).not.toHaveBeenCalled();
    expect(mockAddPendingDocument).not.toHaveBeenCalled();
    expect(mockUploadAllAdditionalDocuments).not.toHaveBeenCalled();
  });

  it('should upload pending physical exam images after visit upload', async () => {
    const ADULT_INITIAL_UUID = '8d5b27bc-c2cc-11de-8d13-0010c6dffd0f';
    const imgFile = new File(['pe'], 'pe-image.png', { type: 'image/png' });
    mockGetPendingImages.mockReturnValue([
      { file: imgFile, comment: 'General exams' },
    ]);
    mockUploadVisit.mockResolvedValue({
      encounters: [
        { uuid: 'pe-enc-uuid', encounterType: { uuid: ADULT_INITIAL_UUID } },
      ],
    });

    renderWithData(fullData);

    selectSpeciality();
    fireEvent.click(screen.getByText('Upload Visit'));
    fireEvent.click(screen.getByTestId('modal-confirm'));

    await waitFor(() => {
      expect(mockUploadAllPhysicalExamImages).toHaveBeenCalledWith(
        'pe-enc-uuid',
        'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
      );
    });
  });

  it('should not fail the visit when physical exam image upload throws', async () => {
    mockGetPendingImages.mockReturnValue([
      { file: new File(['pe'], 'pe.png', { type: 'image/png' }), comment: 'x' },
    ]);
    mockUploadAllPhysicalExamImages.mockRejectedValueOnce(new Error('boom'));
    mockUploadVisit.mockResolvedValue({
      encounters: [
        {
          uuid: 'pe-enc-uuid',
          encounterType: { uuid: '8d5b27bc-c2cc-11de-8d13-0010c6dffd0f' },
        },
      ],
    });

    renderWithData(fullData);

    selectSpeciality();
    fireEvent.click(screen.getByText('Upload Visit'));
    fireEvent.click(screen.getByTestId('modal-confirm'));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        'Success',
        'Visit uploaded successfully',
        'success'
      );
    });
  });

  it('should not upload physical exam images when there are none pending', async () => {
    mockGetPendingImages.mockReturnValue([]);
    renderWithData(fullData);

    selectSpeciality();
    fireEvent.click(screen.getByText('Upload Visit'));
    fireEvent.click(screen.getByTestId('modal-confirm'));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        'Success',
        'Visit uploaded successfully',
        'success'
      );
    });

    expect(mockUploadAllPhysicalExamImages).not.toHaveBeenCalled();
  });

  it('should render file input with correct accept attribute for images only', () => {
    renderWithData(fullData);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();
    expect(fileInput.getAttribute('accept')).toBeTruthy();
    expect(fileInput.getAttribute('multiple')).not.toBeNull();
  });

  it('should use encounters[1] as fallback when adultInitialEnc is not found but other encounters exist', async () => {
    const OriginalFileReader = globalThis.FileReader;
    const mockFileReader = {
      result: 'data:image/png;base64,enc1test',
      onloadend: null as (() => void) | null,
      readAsDataURL: vi.fn(function (this: any) {
        this.onloadend?.();
      }),
    };
    globalThis.FileReader = vi.fn(() => mockFileReader) as any;

    // Two encounters, neither matches ADULT_INITIAL
    mockUploadVisit.mockResolvedValue({
      encounters: [
        { uuid: 'enc-0-uuid', encounterType: { uuid: 'other-type-1' } },
        { uuid: 'enc-1-uuid', encounterType: { uuid: 'other-type-2' } },
      ],
    });

    renderWithData(fullData);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const imgFile = new File(['test'], 'enc1-test.png', { type: 'image/png' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [imgFile] } });
    });

    selectSpeciality();
    fireEvent.click(screen.getByText('Upload Visit'));
    fireEvent.click(screen.getByTestId('modal-confirm'));

    await waitFor(() => {
      // encounters[1].uuid should be used as fallback
      expect(mockUploadAllAdditionalDocuments).toHaveBeenCalledWith(
        'enc-1-uuid',
        'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
      );
    });

    globalThis.FileReader = OriginalFileReader;
  });

  /* ── getLatestVisitUuid returns null (line 387 ?? '' branch) ────────── */

  it('should handle getLatestVisitUuid returning null by using empty string fallback', async () => {
    mockGetLatestVisitUuid.mockResolvedValueOnce(null);
    renderWithData(fullData);

    selectSpeciality();
    fireEvent.click(screen.getByText('Upload Visit'));
    fireEvent.click(screen.getByTestId('modal-confirm'));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        'Success',
        'Visit uploaded successfully',
        'success'
      );
    });
  });


  describe('Additional Measurements', () => {
    it('should not render the heading when config has no additional fields', () => {
      renderWithData({ vitals: fullData.vitals });
      expect(
        screen.queryByText('Additional Measurements')
      ).not.toBeInTheDocument();
    });

    it('should render additional measurement labels and values from config', () => {
      renderWithData({
        vitals: {
          formValues: {
            ...fullData.vitals.formValues,
            fbs_mg_per_dl: 89,
            hba1c: 6,
          },
          config: [
            {
              name: 'Fasting Blood Sugar (FBS) (mg/dl)',
              key: 'fbs_mg_per_dl',
              uuid: 'fbs-uuid',
              is_mandatory: false,
              lang: null,
              is_enabled: true,
            },
            {
              name: 'HbA1c',
              key: 'hba1c',
              uuid: 'hba1c-uuid',
              is_mandatory: false,
              lang: null,
              is_enabled: true,
            },
          ],
        },
      });
      expect(screen.getByText('Additional Measurements')).toBeInTheDocument();
      expect(
        screen.getAllByText('Fasting Blood Sugar (FBS) (mg/dl)').length
      ).toBeGreaterThan(0);
      expect(screen.getAllByText('89').length).toBeGreaterThan(0);
      expect(screen.getAllByText('HbA1c').length).toBeGreaterThan(0);
      expect(screen.getAllByText('6').length).toBeGreaterThan(0);
    });

    it('should show "No information" when value is missing for an additional field', () => {
      renderWithData({
        vitals: {
          formValues: { ...fullData.vitals.formValues },
          config: [
            {
              name: 'HbA1c',
              key: 'hba1c',
              uuid: 'hba1c-uuid',
              is_mandatory: false,
              lang: null,
              is_enabled: true,
            },
          ],
        },
      });
      expect(screen.getByText('Additional Measurements')).toBeInTheDocument();
      expect(screen.getAllByText('HbA1c').length).toBeGreaterThan(0);
      expect(screen.getAllByText('No information').length).toBeGreaterThan(0);
    });

    it('should resolve blood_group uuid to its display name via config answers', () => {
      renderWithData({
        vitals: {
          formValues: {
            ...fullData.vitals.formValues,
            blood_group: 'bg-uuid-bpos',
          },
          config: [
            {
              name: 'Blood Group',
              key: 'blood_group',
              uuid: 'blood-group-concept-uuid',
              is_mandatory: false,
              lang: null,
              is_enabled: true,
              datatype: 'Coded',
              answers: [
                { uuid: 'bg-uuid-bpos', display: 'B POSITIVE' },
                { uuid: 'bg-uuid-apos', display: 'A POSITIVE' },
              ],
            },
          ],
        },
      });
      expect(screen.getByText('Additional Measurements')).toBeInTheDocument();
      expect(screen.getAllByText('Blood Group').length).toBeGreaterThan(0);
      expect(screen.getAllByText('B POSITIVE').length).toBeGreaterThan(0);
    });

    it('should fall back to raw uuid when blood_group has no matching answer', () => {
      renderWithData({
        vitals: {
          formValues: {
            ...fullData.vitals.formValues,
            blood_group: 'unknown-uuid',
          },
          config: [
            {
              name: 'Blood Group',
              key: 'blood_group',
              uuid: 'blood-group-concept-uuid',
              is_mandatory: false,
              lang: null,
              is_enabled: true,
              datatype: 'Coded',
              answers: [{ uuid: 'bg-uuid-bpos', display: 'B POSITIVE' }],
            },
          ],
        },
      });
      expect(screen.getAllByText('unknown-uuid').length).toBeGreaterThan(0);
    });

    it('should fall back to raw uuid when blood_group config has no answers', () => {
      renderWithData({
        vitals: {
          formValues: {
            ...fullData.vitals.formValues,
            blood_group: 'orphan-uuid',
          },
          config: [
            {
              name: 'Blood Group',
              key: 'blood_group',
              uuid: 'blood-group-concept-uuid',
              is_mandatory: false,
              lang: null,
              is_enabled: true,
              datatype: 'Coded',
            },
          ],
        },
      });
      expect(screen.getAllByText('orphan-uuid').length).toBeGreaterThan(0);
    });

    it('should treat empty-string value as missing', () => {
      renderWithData({
        vitals: {
          formValues: {
            ...fullData.vitals.formValues,
            hba1c: '' as unknown as number,
          },
          config: [
            {
              name: 'HbA1c',
              key: 'hba1c',
              uuid: 'hba1c-uuid',
              is_mandatory: false,
              lang: null,
              is_enabled: true,
            },
          ],
        },
      });
      expect(screen.getAllByText('No information').length).toBeGreaterThan(0);
    });

    it('should exclude primary vitals fields from Additional Measurements', () => {
      renderWithData({
        vitals: {
          formValues: fullData.vitals.formValues,
          config: [
            {
              name: 'Height (cm)',
              key: 'height_cm',
              uuid: 'height-uuid',
              is_mandatory: true,
              lang: null,
              is_enabled: true,
            },
            {
              name: 'HbA1c',
              key: 'hba1c',
              uuid: 'hba1c-uuid',
              is_mandatory: false,
              lang: null,
              is_enabled: true,
            },
          ],
        },
      });
      
      expect(screen.getByText('Additional Measurements')).toBeInTheDocument();
      expect(screen.getAllByText('HbA1c').length).toBeGreaterThan(0);
    });

    it('should fetch concept answers and resolve blood_group display when config lacks answers', async () => {
      mockFetchConceptAnswers.mockResolvedValueOnce([
        { uuid: 'bg-bpos-uuid', display: 'B POSITIVE' },
        { uuid: 'bg-apos-uuid', display: 'A POSITIVE' },
      ]);
      renderWithData({
        vitals: {
          formValues: {
            ...fullData.vitals.formValues,
            blood_group: 'bg-bpos-uuid',
          },
          config: [
            {
              name: 'Blood Group',
              key: 'blood_group',
              uuid: 'bg-concept-uuid',
              is_mandatory: false,
              lang: null,
              is_enabled: true,
              datatype: 'Coded',
            },
          ],
        },
      });
      await waitFor(() => {
        expect(mockFetchConceptAnswers).toHaveBeenCalledWith('bg-concept-uuid');
        expect(screen.getAllByText('B POSITIVE').length).toBeGreaterThan(0);
      });
    });

    it('should not fetch concept answers when config already has blood_group answers', () => {
      renderWithData({
        vitals: {
          formValues: {
            ...fullData.vitals.formValues,
            blood_group: 'bg-bpos-uuid',
          },
          config: [
            {
              name: 'Blood Group',
              key: 'blood_group',
              uuid: 'bg-concept-uuid',
              is_mandatory: false,
              lang: null,
              is_enabled: true,
              datatype: 'Coded',
              answers: [{ uuid: 'bg-bpos-uuid', display: 'B POSITIVE' }],
            },
          ],
        },
      });
      expect(mockFetchConceptAnswers).not.toHaveBeenCalled();
      expect(screen.getAllByText('B POSITIVE').length).toBeGreaterThan(0);
    });

    it('should swallow fetchConceptAnswers errors and show the raw uuid', async () => {
      mockFetchConceptAnswers.mockRejectedValueOnce(new Error('network'));
      renderWithData({
        vitals: {
          formValues: {
            ...fullData.vitals.formValues,
            blood_group: 'bg-unknown',
          },
          config: [
            {
              name: 'Blood Group',
              key: 'blood_group',
              uuid: 'bg-concept-uuid',
              is_mandatory: false,
              lang: null,
              is_enabled: true,
              datatype: 'Coded',
            },
          ],
        },
      });
      await waitFor(() => {
        expect(mockFetchConceptAnswers).toHaveBeenCalled();
      });
      expect(screen.getAllByText('bg-unknown').length).toBeGreaterThan(0);
    });
  });



  describe('Patient header (name + OpenMRS ID)', () => {
    it('should fetch and display patient name and OpenMRS ID', async () => {
      mockGetPatient.mockResolvedValueOnce({
        uuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        identifiers: [
          { identifier: 'AB123', preferred: false },
          { identifier: 'OMRS-001', preferred: true },
        ],
        person: {
          preferredName: {
            givenName: 'Jane',
            middleName: 'M',
            familyName: 'Smith',
          },
          attributes: [],
        },
      });
      renderWithData();
      await waitFor(() => {
        expect(screen.getByText('Jane M Smith')).toBeInTheDocument();
        expect(
          screen.getByText('OpenMRS ID: OMRS-001')
        ).toBeInTheDocument();
      });
      expect(mockGetPatient).toHaveBeenCalledWith(
        'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
      );
    });

    it('should fall back to first identifier when no preferred flag is set', async () => {
      mockGetPatient.mockResolvedValueOnce({
        uuid: 'patient-uuid',
        identifiers: [
          { identifier: 'FIRST-ID', preferred: false },
          { identifier: 'SECOND-ID', preferred: false },
        ],
        person: {
          preferredName: { givenName: 'John', middleName: null, familyName: 'Doe' },
          attributes: [],
        },
      });
      renderWithData();
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('OpenMRS ID: FIRST-ID')).toBeInTheDocument();
      });
    });

    it('should skip fetch and render no header when patient uuid is absent', async () => {
      mockUseStartVisitData.mockReturnValue({
        data: { ...defaultData },
        patientUuid: null as unknown as string,
        visitId: 'test-visit-id',
        tempRecordId: null,
        restoredSectionIndex: null,
        lastSectionIndex: 0,
        setLastSectionIndex: vi.fn(),
        setPatientUuid: vi.fn(),
        setVitalsData: vi.fn(),
        setVisitReasonData: vi.fn(),
        setPhysicalExamData: vi.fn(),
        setMedicalHistoryData: vi.fn(),
        setMedicalHistoryAnswers: vi.fn(),
        saveSectionToTemp: mockSaveSectionToTemp,
        clearVisitId: mockClearVisitId,
        markVisitUploaded: vi.fn(),
        physExamPendingImages: [],
        setPhysExamPendingImages: vi.fn(),
      });
      mockStorageGet.mockReturnValue(null);
      render(<BreadcrumbProvider><VisitSummaryPage /></BreadcrumbProvider>);
      expect(mockGetPatient).not.toHaveBeenCalled();
      expect(screen.queryByText(/OpenMRS ID:/)).not.toBeInTheDocument();
    });

    it('should fall back to storage name when getPatient fails', async () => {
      mockGetPatient.mockRejectedValueOnce(new Error('network'));
      mockStorageGet.mockImplementation((key: string) =>
        key === 'patientName' ? 'Cached Patient' : null
      );
      renderWithData();
      await waitFor(() => {
        expect(screen.getByText('Cached Patient')).toBeInTheDocument();
      });
      // No identifier known on fallback
      expect(screen.queryByText(/OpenMRS ID:/)).not.toBeInTheDocument();
    });

    it('should render no header when getPatient fails and storage has no name', async () => {
      mockGetPatient.mockRejectedValueOnce(new Error('network'));
      mockStorageGet.mockReturnValue(null);
      renderWithData();
      await waitFor(() => {
        expect(mockGetPatient).toHaveBeenCalled();
      });
      expect(screen.queryByText(/OpenMRS ID:/)).not.toBeInTheDocument();
    });

    it('should fall back to storage name when preferredName is null', async () => {
      mockGetPatient.mockResolvedValueOnce({
        uuid: 'patient-uuid',
        identifiers: [{ identifier: 'OMRS-XYZ', preferred: true }],
        person: { preferredName: null, attributes: [] },
      });
      mockStorageGet.mockImplementation((key: string) =>
        key === 'patientName' ? 'Stored Name' : null
      );
      renderWithData();
      await waitFor(() => {
        expect(screen.getByText('Stored Name')).toBeInTheDocument();
        expect(screen.getByText('OpenMRS ID: OMRS-XYZ')).toBeInTheDocument();
      });
    });

    it('should render nothing when name and identifier are both empty', async () => {
      mockGetPatient.mockResolvedValueOnce({
        uuid: 'patient-uuid',
        identifiers: [],
        person: { preferredName: null, attributes: [] },
      });
      renderWithData();
      await waitFor(() => {
        expect(mockGetPatient).toHaveBeenCalled();
      });
      expect(screen.queryByText(/OpenMRS ID:/)).not.toBeInTheDocument();
    });

    it('should not call setState after unmount when fetch resolves', async () => {
      let resolveFn: (v: unknown) => void = () => {};
      mockGetPatient.mockReturnValueOnce(
        new Promise(resolve => {
          resolveFn = resolve;
        })
      );
      const { unmount } = renderWithData();
      unmount();
      resolveFn({
        uuid: 'patient-uuid',
        identifiers: [{ identifier: 'OMRS-001', preferred: true }],
        person: {
          preferredName: { givenName: 'Late', middleName: null, familyName: 'Patient' },
          attributes: [],
        },
      });
     
      await new Promise(r => setTimeout(r, 0));
      expect(screen.queryByText(/Late Patient/)).not.toBeInTheDocument();
    });

    it('should fall back to PATIENT_UUID_KEY from storage when ctx patientUuid is absent', async () => {
      mockUseStartVisitData.mockReturnValue({
        data: { ...defaultData },
        patientUuid: null as any,
        visitId: 'test-visit-id',
        tempRecordId: null,
        restoredSectionIndex: null,
        lastSectionIndex: 0,
        setLastSectionIndex: vi.fn(),
        setPatientUuid: vi.fn(),
        setVitalsData: vi.fn(),
        setVisitReasonData: vi.fn(),
        setPhysicalExamData: vi.fn(),
        setMedicalHistoryData: vi.fn(),
        setMedicalHistoryAnswers: vi.fn(),
        saveSectionToTemp: mockSaveSectionToTemp,
        clearVisitId: mockClearVisitId,
        markVisitUploaded: vi.fn(),
        physExamPendingImages: [],
        setPhysExamPendingImages: vi.fn(),
      });
      mockStorageGet.mockImplementation((key: string) =>
        key === 'patientUuid' ? 'storage-patient-uuid' : null
      );
      mockGetPatient.mockResolvedValueOnce({
        uuid: 'storage-patient-uuid',
        identifiers: [{ identifier: 'STO-001', preferred: true }],
        person: {
          preferredName: { givenName: 'From', middleName: null, familyName: 'Storage' },
          attributes: [],
        },
      });
      render(<BreadcrumbProvider><VisitSummaryPage /></BreadcrumbProvider>);
      await waitFor(() => {
        expect(mockGetPatient).toHaveBeenCalledWith('storage-patient-uuid');
        expect(screen.getByText('From Storage')).toBeInTheDocument();
        expect(screen.getByText('OpenMRS ID: STO-001')).toBeInTheDocument();
      });
    });
  });

  /* ── Physical exam image thumbnails and preview modal ────────────── */

  describe('Physical exam image thumbnails', () => {
    let urlCounter: number;

    beforeEach(() => {
      urlCounter = 0;
      globalThis.URL.createObjectURL = vi.fn(() => `blob:mock-url-${urlCounter++}`);
    });

    it('should group images under "Other" when image comment is empty (flat mode)', async () => {
      mockGetPendingImages.mockReturnValue([
        { file: new File(['img1'], 'unknown.png', { type: 'image/png' }), comment: '' },
      ]);

      renderWithData({
        ...fullData,
        physicalExam: {
          answers: { pe1: ['opt1'] },
          details: [{ label: 'General Appearance', value: 'Normal' }],
        },
      });

      await waitFor(() => {
        expect(screen.getByText('Other')).toBeInTheDocument();
      });
    });

    it('should render physical exam image thumbnails when pending images exist (flat mode)', async () => {
      mockGetPendingImages.mockReturnValue([
        { file: new File(['img1'], 'eyes.png', { type: 'image/png' }), comment: 'Eyes' },
      ]);

      renderWithData({
        ...fullData,
        physicalExam: {
          answers: { pe1: ['opt1'] },
          details: [{ label: 'General Appearance', value: 'Normal' }],
          // No detailsSections — flat mode
        },
      });

      await waitFor(() => {
        // The section heading for the image group should appear
        expect(screen.getByText('Eyes')).toBeInTheDocument();
      });

      // Thumbnail button should be rendered with the blob URL image
      const thumbnailImg = screen.getByAltText('Eyes');
      expect(thumbnailImg).toBeInTheDocument();
      expect(thumbnailImg.closest('button')).toBeTruthy();
    });

    it('should render physical exam image thumbnails matched to detailsSections (structured mode)', async () => {
      mockGetPendingImages.mockReturnValue([
        { file: new File(['img1'], 'throat.png', { type: 'image/png' }), comment: 'Throat' },
      ]);

      renderWithData({
        ...fullData,
        physicalExam: {
          answers: { pe1: ['opt1'] },
          details: [{ label: 'Tonsils', value: 'Swollen' }],
          detailsSections: [
            {
              title: 'Throat',
              items: [
                { type: 'labelValue' as const, label: 'Tonsils', value: 'Swollen' },
              ],
            },
          ],
        },
      });

      await waitFor(() => {
        // Section title should render
        expect(screen.getByText('Throat')).toBeInTheDocument();
      });

      // The image thumbnail should appear within the structured section
      const thumbnailImg = screen.getByAltText('Throat');
      expect(thumbnailImg).toBeInTheDocument();
      expect(thumbnailImg.closest('button')).toBeTruthy();
    });

    it('should render unmatched images as fallback section (structured mode)', async () => {
      mockGetPendingImages.mockReturnValue([
        { file: new File(['img1'], 'unmatched.png', { type: 'image/png' }), comment: 'Unmatched Section' },
      ]);

      renderWithData({
        ...fullData,
        physicalExam: {
          answers: { pe1: ['opt1'] },
          details: [{ label: 'Eyes', value: 'Clear' }],
          detailsSections: [
            {
              title: 'General Exams',
              items: [
                { type: 'labelValue' as const, label: 'Eyes', value: 'Clear' },
              ],
            },
          ],
        },
      });

      await waitFor(() => {
        // The unmatched image heading should appear as a fallback section
        expect(screen.getByText('Unmatched Section')).toBeInTheDocument();
      });

      // Thumbnail for the unmatched image should be rendered
      const thumbnailImg = screen.getByAltText('Unmatched Section');
      expect(thumbnailImg).toBeInTheDocument();
      expect(thumbnailImg.closest('button')).toBeTruthy();
    });

    it('should open preview modal when image thumbnail is clicked', async () => {
      mockGetPendingImages.mockReturnValue([
        { file: new File(['img1'], 'eyes.png', { type: 'image/png' }), comment: 'Eyes' },
      ]);

      renderWithData({
        ...fullData,
        physicalExam: {
          answers: { pe1: ['opt1'] },
          details: [{ label: 'General Appearance', value: 'Normal' }],
        },
      });

      await waitFor(() => {
        expect(screen.getByAltText('Eyes')).toBeInTheDocument();
      });

      // Click the thumbnail button to open the preview modal
      const thumbnailButton = screen.getByAltText('Eyes').closest('button')!;
      fireEvent.click(thumbnailButton);

      // Preview modal should appear with alt="Preview"
      expect(screen.getByAltText('Preview')).toBeInTheDocument();
    });

    it('should close preview modal when close button is clicked', async () => {
      mockGetPendingImages.mockReturnValue([
        { file: new File(['img1'], 'eyes.png', { type: 'image/png' }), comment: 'Eyes' },
      ]);

      renderWithData({
        ...fullData,
        physicalExam: {
          answers: { pe1: ['opt1'] },
          details: [{ label: 'General Appearance', value: 'Normal' }],
        },
      });

      await waitFor(() => {
        expect(screen.getByAltText('Eyes')).toBeInTheDocument();
      });

      // Open modal
      const thumbnailButton = screen.getByAltText('Eyes').closest('button')!;
      fireEvent.click(thumbnailButton);
      expect(screen.getByAltText('Preview')).toBeInTheDocument();

      // Click close button (fa-xmark icon's parent button)
      const closeIcon = document.querySelector('.fa-solid.fa-xmark')!;
      const closeButton = closeIcon.closest('button')!;
      fireEvent.click(closeButton);

      // Modal should be closed
      expect(screen.queryByAltText('Preview')).not.toBeInTheDocument();
    });

    it('should close preview modal when clicking backdrop', async () => {
      mockGetPendingImages.mockReturnValue([
        { file: new File(['img1'], 'eyes.png', { type: 'image/png' }), comment: 'Eyes' },
      ]);

      renderWithData({
        ...fullData,
        physicalExam: {
          answers: { pe1: ['opt1'] },
          details: [{ label: 'General Appearance', value: 'Normal' }],
        },
      });

      await waitFor(() => {
        expect(screen.getByAltText('Eyes')).toBeInTheDocument();
      });

      // Open modal
      const thumbnailButton = screen.getByAltText('Eyes').closest('button')!;
      fireEvent.click(thumbnailButton);
      expect(screen.getByAltText('Preview')).toBeInTheDocument();

      // Click the backdrop (the outermost fixed div of the modal)
      const previewImg = screen.getByAltText('Preview');
      const backdrop = previewImg.closest('.fixed')!;
      fireEvent.click(backdrop);

      // Modal should be closed
      expect(screen.queryByAltText('Preview')).not.toBeInTheDocument();
    });

    it('should render download link in preview modal', async () => {
      mockGetPendingImages.mockReturnValue([
        { file: new File(['img1'], 'eyes.png', { type: 'image/png' }), comment: 'Eyes' },
      ]);

      renderWithData({
        ...fullData,
        physicalExam: {
          answers: { pe1: ['opt1'] },
          details: [{ label: 'General Appearance', value: 'Normal' }],
        },
      });

      await waitFor(() => {
        expect(screen.getByAltText('Eyes')).toBeInTheDocument();
      });

      // Open modal
      const thumbnailButton = screen.getByAltText('Eyes').closest('button')!;
      fireEvent.click(thumbnailButton);
      expect(screen.getByAltText('Preview')).toBeInTheDocument();

      // Verify download link exists with the correct download attribute
      const downloadLink = document.querySelector('a[download="physical-exam-image"]') as HTMLAnchorElement;
      expect(downloadLink).toBeTruthy();
      expect(downloadLink.href).toContain('blob:mock-url-');

      // Verify the download icon is inside the link
      const downloadIcon = downloadLink.querySelector('.fa-solid.fa-download');
      expect(downloadIcon).toBeTruthy();
    });

    it('should prefer context pending images over module-level getPendingImages', async () => {
      const ctxFile = new File(['ctx-img'], 'ctx.png', { type: 'image/png' });
      // Module-level getPendingImages returns different data — should NOT be used
      mockGetPendingImages.mockReturnValue([
        { file: new File(['module-img'], 'module.png', { type: 'image/png' }), comment: 'Module' },
      ]);

      mockUseStartVisitData.mockReturnValue({
        data: { ...fullData },
        patientUuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        visitId: 'test-visit-id',
        tempRecordId: null,
        restoredSectionIndex: null,
        lastSectionIndex: 0,
        setLastSectionIndex: vi.fn(),
        setPatientUuid: vi.fn(),
        setVitalsData: vi.fn(),
        setVisitReasonData: vi.fn(),
        setPhysicalExamData: vi.fn(),
        setMedicalHistoryData: vi.fn(),
        setMedicalHistoryAnswers: vi.fn(),
        saveSectionToTemp: mockSaveSectionToTemp,
        clearVisitId: mockClearVisitId,
        markVisitUploaded: vi.fn(),
        physExamPendingImages: [{ file: ctxFile, comment: 'ContextSection' }],
        setPhysExamPendingImages: vi.fn(),
      });

      render(<BreadcrumbProvider><VisitSummaryPage /></BreadcrumbProvider>);

      await waitFor(() => {
        // Context image comment used as section heading
        expect(screen.getByText('ContextSection')).toBeInTheDocument();
      });

      // URL.createObjectURL should have been called with the context file
      expect(globalThis.URL.createObjectURL).toHaveBeenCalledWith(ctxFile);
    });

    it('should fall back to getPendingImages when context has no images', async () => {
      const moduleFile = new File(['mod-img'], 'mod.png', { type: 'image/png' });
      mockGetPendingImages.mockReturnValue([
        { file: moduleFile, comment: 'ModuleSection' },
      ]);

      mockUseStartVisitData.mockReturnValue({
        data: { ...fullData },
        patientUuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        visitId: 'test-visit-id',
        tempRecordId: null,
        restoredSectionIndex: null,
        lastSectionIndex: 0,
        setLastSectionIndex: vi.fn(),
        setPatientUuid: vi.fn(),
        setVitalsData: vi.fn(),
        setVisitReasonData: vi.fn(),
        setPhysicalExamData: vi.fn(),
        setMedicalHistoryData: vi.fn(),
        setMedicalHistoryAnswers: vi.fn(),
        saveSectionToTemp: mockSaveSectionToTemp,
        clearVisitId: mockClearVisitId,
        markVisitUploaded: vi.fn(),
        physExamPendingImages: [],
        setPhysExamPendingImages: vi.fn(),
      });

      render(<BreadcrumbProvider><VisitSummaryPage /></BreadcrumbProvider>);

      await waitFor(() => {
        expect(screen.getByText('ModuleSection')).toBeInTheDocument();
      });

      expect(globalThis.URL.createObjectURL).toHaveBeenCalledWith(moduleFile);
    });

    it('should load images from temp-storage when both context and module-level are empty', async () => {
      mockGetPendingImages.mockReturnValue([]);
      mockGetCommittedQuestionIds.mockReturnValue(new Set(['q1']));
      mockGetDeletedAssetIds.mockReturnValue(new Set<number>());
      mockGetChildResources.mockResolvedValue({
        data: [
          { id: 1, file_path: 'http://cdn/img1.png', data: { questionId: 'q1', comment: 'TempStorageSection' } },
          { id: 2, file_path: 'http://cdn/img2.png', data: { questionId: 'q2', comment: 'Uncommitted' } },
        ],
      });

      mockUseStartVisitData.mockReturnValue({
        data: { ...fullData },
        patientUuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        visitId: 'test-visit-id',
        tempRecordId: null,
        restoredSectionIndex: null,
        lastSectionIndex: 0,
        setLastSectionIndex: vi.fn(),
        setPatientUuid: vi.fn(),
        setVitalsData: vi.fn(),
        setVisitReasonData: vi.fn(),
        setPhysicalExamData: vi.fn(),
        setMedicalHistoryData: vi.fn(),
        setMedicalHistoryAnswers: vi.fn(),
        saveSectionToTemp: mockSaveSectionToTemp,
        clearVisitId: mockClearVisitId,
        markVisitUploaded: vi.fn(),
        physExamPendingImages: [],
        setPhysExamPendingImages: vi.fn(),
      });

      render(<BreadcrumbProvider><VisitSummaryPage /></BreadcrumbProvider>);

      await waitFor(() => {
        expect(screen.getByText('TempStorageSection')).toBeInTheDocument();
      });
      expect(mockGetChildResources).toHaveBeenCalledWith('visit', 'test-visit-id', 'asset');
      expect(screen.queryByText('Uncommitted')).not.toBeInTheDocument();
    });

    it('should filter out deleted assets in temp-storage fallback', async () => {
      mockGetPendingImages.mockReturnValue([]);
      mockGetCommittedQuestionIds.mockReturnValue(new Set(['q1']));
      mockGetDeletedAssetIds.mockReturnValue(new Set([1]));
      mockGetChildResources.mockResolvedValue({
        data: [
          { id: 1, file_path: 'http://cdn/deleted.png', data: { questionId: 'q1', comment: 'DeletedAsset' } },
          { id: 2, file_path: 'http://cdn/kept.png', data: { questionId: 'q1', comment: 'KeptAsset' } },
        ],
      });

      mockUseStartVisitData.mockReturnValue({
        data: { ...fullData },
        patientUuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        visitId: 'test-visit-id',
        tempRecordId: null,
        restoredSectionIndex: null,
        lastSectionIndex: 0,
        setLastSectionIndex: vi.fn(),
        setPatientUuid: vi.fn(),
        setVitalsData: vi.fn(),
        setVisitReasonData: vi.fn(),
        setPhysicalExamData: vi.fn(),
        setMedicalHistoryData: vi.fn(),
        setMedicalHistoryAnswers: vi.fn(),
        saveSectionToTemp: mockSaveSectionToTemp,
        clearVisitId: mockClearVisitId,
        markVisitUploaded: vi.fn(),
        physExamPendingImages: [],
        setPhysExamPendingImages: vi.fn(),
      });

      render(<BreadcrumbProvider><VisitSummaryPage /></BreadcrumbProvider>);

      await waitFor(() => {
        expect(screen.getByText('KeptAsset')).toBeInTheDocument();
      });
      expect(screen.queryByText('DeletedAsset')).not.toBeInTheDocument();
    });

    it('should swallow errors from temp-storage image loading', async () => {
      mockGetPendingImages.mockReturnValue([]);
      mockGetChildResources.mockRejectedValue(new Error('temp-storage down'));

      mockUseStartVisitData.mockReturnValue({
        data: { ...fullData },
        patientUuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        visitId: 'test-visit-id',
        tempRecordId: null,
        restoredSectionIndex: null,
        lastSectionIndex: 0,
        setLastSectionIndex: vi.fn(),
        setPatientUuid: vi.fn(),
        setVitalsData: vi.fn(),
        setVisitReasonData: vi.fn(),
        setPhysicalExamData: vi.fn(),
        setMedicalHistoryData: vi.fn(),
        setMedicalHistoryAnswers: vi.fn(),
        saveSectionToTemp: mockSaveSectionToTemp,
        clearVisitId: mockClearVisitId,
        markVisitUploaded: vi.fn(),
        physExamPendingImages: [],
        setPhysExamPendingImages: vi.fn(),
      });

      render(<BreadcrumbProvider><VisitSummaryPage /></BreadcrumbProvider>);

      await waitFor(() => {
        expect(mockGetChildResources).toHaveBeenCalled();
      });

      // Should render without crashing — no image previews shown
      expect(screen.getByText('Visit Summary')).toBeInTheDocument();
    });

    it('should use "Physical Exam" as default name when context image comment is missing', async () => {
      const ctxFile = new File(['img'], 'pic.png', { type: 'image/png' });

      mockUseStartVisitData.mockReturnValue({
        data: {
          ...fullData,
          physicalExam: {
            answers: { pe1: ['opt1'] },
            details: [{ label: 'General Appearance', value: 'Normal' }],
          },
        },
        patientUuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        visitId: 'test-visit-id',
        tempRecordId: null,
        restoredSectionIndex: null,
        lastSectionIndex: 0,
        setLastSectionIndex: vi.fn(),
        setPatientUuid: vi.fn(),
        setVitalsData: vi.fn(),
        setVisitReasonData: vi.fn(),
        setPhysicalExamData: vi.fn(),
        setMedicalHistoryData: vi.fn(),
        setMedicalHistoryAnswers: vi.fn(),
        saveSectionToTemp: mockSaveSectionToTemp,
        clearVisitId: mockClearVisitId,
        markVisitUploaded: vi.fn(),
        physExamPendingImages: [{ file: ctxFile, comment: undefined as unknown as string }],
        setPhysExamPendingImages: vi.fn(),
      });

      render(<BreadcrumbProvider><VisitSummaryPage /></BreadcrumbProvider>);

      await waitFor(() => {
        // Falls back to 'Physical Exam' when comment is falsy
        expect(screen.getByAltText('Physical Exam')).toBeInTheDocument();
      });
    });

    it('should use "Physical Exam" fallback when getPendingImages returns images with undefined comment', () => {
      const moduleFile = new File(['mod-img'], 'mod.png', { type: 'image/png' });
      mockGetPendingImages.mockReturnValue([
        { file: moduleFile, comment: undefined },
      ]);

      mockUseStartVisitData.mockReturnValue({
        data: { ...fullData },
        patientUuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        visitId: 'test-visit-id',
        tempRecordId: null,
        restoredSectionIndex: null,
        lastSectionIndex: 0,
        setLastSectionIndex: vi.fn(),
        setPatientUuid: vi.fn(),
        setVitalsData: vi.fn(),
        setVisitReasonData: vi.fn(),
        setPhysicalExamData: vi.fn(),
        setMedicalHistoryData: vi.fn(),
        setMedicalHistoryAnswers: vi.fn(),
        saveSectionToTemp: mockSaveSectionToTemp,
        clearVisitId: mockClearVisitId,
        markVisitUploaded: vi.fn(),
        physExamPendingImages: [],
        setPhysExamPendingImages: vi.fn(),
      });

      render(<BreadcrumbProvider><VisitSummaryPage /></BreadcrumbProvider>);

      expect(screen.getByAltText('Physical Exam')).toBeInTheDocument();
    });

    it('should not load temp-storage images when visitId is falsy and no pending images exist', () => {
      mockGetPendingImages.mockReturnValue([]);

      mockUseStartVisitData.mockReturnValue({
        data: { ...fullData },
        patientUuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        visitId: null as any,
        tempRecordId: null,
        restoredSectionIndex: null,
        lastSectionIndex: 0,
        setLastSectionIndex: vi.fn(),
        setPatientUuid: vi.fn(),
        setVitalsData: vi.fn(),
        setVisitReasonData: vi.fn(),
        setPhysicalExamData: vi.fn(),
        setMedicalHistoryData: vi.fn(),
        setMedicalHistoryAnswers: vi.fn(),
        saveSectionToTemp: mockSaveSectionToTemp,
        clearVisitId: mockClearVisitId,
        markVisitUploaded: vi.fn(),
        physExamPendingImages: [],
        setPhysExamPendingImages: vi.fn(),
      });

      render(<BreadcrumbProvider><VisitSummaryPage /></BreadcrumbProvider>);

      // Should not call getChildResources since visitId is null
      expect(mockGetChildResources).not.toHaveBeenCalled();
      expect(screen.getByText('Visit Summary')).toBeInTheDocument();
    });

    it('should use "Physical Exam" fallback when temp-storage record has no comment', async () => {
      mockGetPendingImages.mockReturnValue([]);
      mockGetCommittedQuestionIds.mockReturnValue(new Set(['q1']));
      mockGetDeletedAssetIds.mockReturnValue(new Set<number>());
      mockGetChildResources.mockResolvedValue({
        data: [
          { id: 1, file_path: 'http://cdn/img1.png', data: { questionId: 'q1' } },
        ],
      });

      mockUseStartVisitData.mockReturnValue({
        data: { ...fullData },
        patientUuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        visitId: 'test-visit-id',
        tempRecordId: null,
        restoredSectionIndex: null,
        lastSectionIndex: 0,
        setLastSectionIndex: vi.fn(),
        setPatientUuid: vi.fn(),
        setVitalsData: vi.fn(),
        setVisitReasonData: vi.fn(),
        setPhysicalExamData: vi.fn(),
        setMedicalHistoryData: vi.fn(),
        setMedicalHistoryAnswers: vi.fn(),
        saveSectionToTemp: mockSaveSectionToTemp,
        clearVisitId: mockClearVisitId,
        markVisitUploaded: vi.fn(),
        physExamPendingImages: [],
        setPhysExamPendingImages: vi.fn(),
      });

      render(<BreadcrumbProvider><VisitSummaryPage /></BreadcrumbProvider>);

      await waitFor(() => {
        expect(screen.getByAltText('Physical Exam')).toBeInTheDocument();
      });
    });
  });
});
