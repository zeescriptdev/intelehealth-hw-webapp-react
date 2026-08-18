import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type {
  CheckupReason,
  PhysicalExamination,
  Vitals,
} from '../../../assets/data/visit-summary.data';
import iconChevronDown from '../../../assets/icons/icon-chevron-down.svg';
import iconInfo from '../../../assets/icons/icon-info.svg';
import iconMedicalHistory from '../../../assets/icons/icon-medical-history-green-rounded-bordered.svg';
import iconPhysicalExam from '../../../assets/icons/icon-physical-examination.svg';
import iconVisitSummary from '../../../assets/icons/icon-visit-summery.svg';
import iconVisitReason from '../../../assets/icons/visit-reason.svg';
import iconVitals from '../../../assets/icons/vitals.svg';
import type { DropdownOption } from '../../../components/common';
import { Dropdown, Toggle } from '../../../components/common';
import { ConfirmationModal } from '../../../components/modal/confirmation.modal';
import type { ModalSectionItem } from '../../../components/modal/global-modal-context';
import { useProfileContext } from '../../../context/ProfileContext';
import { useBreadcrumb } from '../../../hooks/useBreadcrumb';
import { useConfig } from '../../../hooks/useConfig';
import ROUTES from '../../../routes/paths';
import { fetchConceptAnswers } from '../../../services/concept.service';
import { showToast } from '../../../services/toast';
import type { ConceptAnswer } from '../../../types/config.types';
import { storage } from '../../../utils/storage';
import { transformFhirPhysExamToAyu } from '../../ayu-library/utils/fhir-to-ayu.util';
import { patientService } from '../../patient/add/add-patient.service';
import CollapsedComponent from '../../visit-summary/visit-summary-collapsed.component';
import { ENCOUNTER_TYPES } from '../constants/visit-upload.constants';
import type { MedicalHistorySummary } from '../context/start-visit.context';
import { useStartVisitData } from '../context/start-visit.context';
import { useAyuJsonList } from '../hooks/useAyuJson.hook';
import {
  addPendingDocument,
  clearPendingDocuments,
  getLatestEncounterUuid,
  getLatestVisitUuid,
  getPendingImages,
  uploadAllAdditionalDocuments,
  uploadAllPhysicalExamImages,
} from '../services/obs.service';
import {
  bulkMarkSynced,
  clearCommittedQuestionIds,
  clearDeletedAssetIds,
  getChildResources,
  getCommittedQuestionIds,
  getDeletedAssetIds,
} from '../services/temp-storage.service';
import {
  buildFamilyHistoryData,
  buildMedicalHistoryData,
  buildPhysicalExamData,
  buildVisitReasonHtml,
  buildVisitUploadPayload,
  uploadVisit,
} from '../services/visit-upload.service';
import type { CapturedDocument } from '../types/obs.types';
import { ACCEPTED_DOCUMENT_TYPES } from '../types/obs.types';
import type { VitalField, VitalsFormValues } from '../types/vitals.types';
import {
  AYU_JSON_KEY_NAME,
  ITEM_TYPES,
  PATIENT_AGE_KEY,
  PATIENT_GENDER_KEY,
  PATIENT_NAME_KEY,
  PATIENT_UUID_KEY,
  PE_DEFAULT_IMAGE_LABEL,
  RESOURCE_TYPE_ASSET,
  RESOURCE_TYPE_VISIT,
} from '../utils/ayu.constants';
import { flattenAyuPhysExamQuestions } from '../utils/physical-exam.utils';

const PRIMARY_COLOR = '#0fd197';

const VITALS_PRIMARY_KEYS = new Set([
  'height_cm',
  'weight_kg',
  'bmi',
  'bp_systolic',
  'bp_diastolic',
  'pulse_bpm',
  'respiratory_rate',
  'temprature_f',
  'spo2',
]);

const buildAdditionalMeasurements = (
  config: VitalField[],
  formValues: VitalsFormValues,
  bloodGroupAnswers: { uuid: string; display: string }[] = []
): { label: string; value: string }[] => {
  return config
    .filter(field => !VITALS_PRIMARY_KEYS.has(field.key))
    .map(field => {
      const raw = (formValues as Record<string, unknown>)[field.key];
      let display = 'No information';
      if (raw != null && raw !== '') {
        if (field.key === 'blood_group') {
          const answers =
            field.answers && field.answers.length > 0
              ? field.answers
              : bloodGroupAnswers;
          const match = answers.find(a => a.uuid === String(raw));
          display = match?.display ?? String(raw);
        } else {
          display = String(raw);
        }
      }
      return { label: field.name, value: display };
    });
};

const AdditionalMeasurementsSection: React.FC<{
  items: { label: string; value: string }[];
}> = ({ items }) => {
  if (items.length === 0) return null;
  const mid = Math.ceil(items.length / 2);
  const leftItems = items.slice(0, mid);
  const rightItems = items.slice(mid);
  return (
    <div className="mt-4">
      <p className="text-sm font-semibold text-gray-500 mb-2">
        Additional Measurements
      </p>
      <div className="md:hidden">
        {items.map(({ label, value }) => (
          <LabelValueRow key={label} label={label} value={value} />
        ))}
      </div>
      <div className="hidden md:grid grid-cols-2 gap-x-10">
        {[leftItems, rightItems].map((column, colIdx) => (
          <div key={colIdx}>
            {column.map(({ label, value }) => (
              <LabelValueRow key={label} label={label} value={value} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

const LabelValueRow: React.FC<{
  label: string;
  value: string;
}> = ({ label, value }) => (
  <div className="flex items-center text-sm py-1">
    <span className="text-[#7F7B92] flex items-center gap-2 w-1/2 shrink-0">
      <span className="w-1 h-1 rounded-full bg-[#E5E5E9] shrink-0" />
      {label}
    </span>
    <span
      className={`font-medium ${value === 'No information' ? 'text-gray-400 italic' : 'text-gray-800'}`}
    >
      {value}
    </span>
  </div>
);

const mapVitals = (formValues: VitalsFormValues): Vitals => {
  const v = (val?: number) => ({
    value: val ?? null,
    note: val == null ? 'No information' : undefined,
  });

  return {
    height: v(formValues.height_cm),
    weight: v(formValues.weight_kg),
    bmi: { value: formValues.bmi ?? 0 },
    bp: {
      systolic: formValues.bp_systolic ?? 0,
      diastolic: formValues.bp_diastolic ?? 0,
    },
    pulse: v(formValues.pulse_bpm),
    temperature: v(formValues.temprature_f),
    spo2: v(formValues.spo2),
    respiratoryRate: v(formValues.respiratory_rate),
  };
};

const VitalsSection: React.FC<{ vitals: Vitals }> = ({ vitals }) => {
  const getVitalDisplay = (val: number | null, note = 'No information') =>
    val?.toString() ?? note;

  const items = [
    {
      label: 'Height(cm)',
      value: getVitalDisplay(vitals.height.value, vitals.height.note),
    },
    {
      label: 'Weight(kg)',
      value: getVitalDisplay(vitals.weight.value, vitals.weight.note),
    },
    { label: 'BMI', value: vitals.bmi.value.toString() },
    { label: 'BP', value: `${vitals.bp.systolic}/${vitals.bp.diastolic}` },
    {
      label: 'Pulse',
      value: getVitalDisplay(vitals.pulse.value, vitals.pulse.note),
    },
    {
      label: 'Temperature(F)',
      value: getVitalDisplay(vitals.temperature.value, vitals.temperature.note),
    },
    {
      label: 'SpO\u2082(%)',
      value: getVitalDisplay(vitals.spo2.value, vitals.spo2.note),
    },
    {
      label: 'Respiratory rate',
      value: getVitalDisplay(
        vitals.respiratoryRate.value,
        vitals.respiratoryRate.note
      ),
    },
  ];

  const leftItems = items.slice(0, 4);
  const rightItems = items.slice(4);

  return (
    <>
      <div className="md:hidden">
        {items.map(({ label, value }) => (
          <LabelValueRow key={label} label={label} value={value} />
        ))}
      </div>
      <div className="hidden md:grid grid-cols-2 gap-x-10">
        {[leftItems, rightItems].map((column, colIdx) => (
          <div key={colIdx}>
            {column.map(({ label, value }) => (
              <LabelValueRow key={label} label={label} value={value} />
            ))}
          </div>
        ))}
      </div>
    </>
  );
};

const CheckupReasonSection: React.FC<{
  checkupReason: CheckupReason;
  detailsSections?: MedicalHistorySummary[];
}> = ({ checkupReason, detailsSections }) => {
  const groupedSections = detailsSections?.filter(s => s.items.length > 0);
  const showSectionTitles = (groupedSections?.length ?? 0) > 1;

  return (
    <>
      <p className="text-sm font-semibold text-gray-500 mb-2 text-center">
        Chief complaint(s)
      </p>
      <div className="mb-2 flex flex-wrap gap-2">
        {checkupReason.chiefComplaints.map(complaint => (
          <span
            key={complaint}
            className="inline-flex items-center justify-center min-w-26.25 h-6.5 bg-[#2E1E91] text-white text-xs font-semibold rounded-sm gap-1 py-1 px-2 whitespace-nowrap"
          >
            {complaint}
          </span>
        ))}
      </div>
      {groupedSections && groupedSections.length > 0 ? (
        <div>
          {groupedSections.map((section, sIdx) => (
            <div key={section.title || sIdx} className="mb-2 last:mb-0">
              {showSectionTitles && section.title && (
                <p className="text-sm font-semibold text-[#2E1E91] mb-1">
                  {section.title}
                </p>
              )}
              {section.items.map((item: ModalSectionItem, iIdx: number) => {
                if (item.type === ITEM_TYPES.LABEL_VALUE) {
                  return (
                    <LabelValueRow
                      key={iIdx}
                      label={item.label}
                      value={String(item.value ?? '')}
                    />
                  );
                }
                if (item.type === ITEM_TYPES.SUBHEADING) {
                  return (
                    <p
                      key={iIdx}
                      className="text-sm font-semibold text-gray-500 mt-2 mb-1"
                    >
                      {item.heading}
                      {item.values.length > 0
                        ? `: ${item.values.join(', ')}`
                        : ''}
                    </p>
                  );
                }
                return null;
              })}
            </div>
          ))}
        </div>
      ) : (
        <div>
          {checkupReason.details.map(({ label, value }) => (
            <LabelValueRow key={label} label={label} value={value} />
          ))}
        </div>
      )}
    </>
  );
};

const PhysicalExaminationSection: React.FC<{
  physicalExamination: PhysicalExamination;
  detailsSections?: MedicalHistorySummary[];
  images?: Array<{ preview: string; name: string }>;
}> = ({ physicalExamination, detailsSections, images }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const imagesBySection = useMemo(() => {
    if (!images || images.length === 0) return {};
    return images.reduce<
      Record<string, Array<{ preview: string; name: string }>>
    >((acc, img) => {
      const key = img.name || 'Other';
      if (!acc[key]) acc[key] = [];
      acc[key].push(img);
      return acc;
    }, {});
  }, [images]);

  const renderImageThumbnails = (
    sectionImages: Array<{ preview: string; name: string }>
  ) => (
    <div className="flex items-start gap-3 flex-wrap mt-2 mb-1">
      {sectionImages.map((img, idx) => (
        <button
          key={idx}
          type="button"
          onClick={() => setPreviewUrl(img.preview)}
          className="w-16 h-16 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center cursor-pointer"
        >
          <img
            src={img.preview}
            alt={img.name}
            className="w-full h-full object-cover"
          />
        </button>
      ))}
    </div>
  );

  const previewModal = previewUrl && (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center"
      onClick={() => setPreviewUrl(null)}
    >
      <div
        className="relative max-w-[90vw] max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setPreviewUrl(null)}
          className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg text-gray-600 hover:text-gray-900 z-10"
        >
          <i className="fa-solid fa-xmark" />
        </button>
        <a
          href={previewUrl}
          download="physical-exam-image"
          className="absolute -top-3 -right-14 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg text-gray-600 hover:text-gray-900 z-10"
        >
          <i className="fa-solid fa-download" />
        </a>
        <img
          src={previewUrl}
          alt="Preview"
          className="max-w-full max-h-[85vh] rounded-lg"
        />
      </div>
    </div>
  );

  if (detailsSections && detailsSections.length > 0) {
    const matchedKeys = new Set<string>();
    return (
      <div>
        {detailsSections.map((section, sIdx) => {
          const sectionImages = section.title
            ? imagesBySection[section.title]
            : undefined;
          if (section.title && sectionImages) matchedKeys.add(section.title);
          return (
            <div key={sIdx} className="mb-2 last:mb-0">
              {section.title && (
                <p className="text-sm font-semibold text-[#2E1E91] mb-1">
                  {section.title}
                </p>
              )}
              {section.items.map((item: ModalSectionItem, iIdx: number) => {
                if (item.type === ITEM_TYPES.LABEL_VALUE) {
                  return (
                    <LabelValueRow
                      key={iIdx}
                      label={item.label}
                      value={String(item.value ?? 'No information')}
                    />
                  );
                }
                if (item.type === ITEM_TYPES.SUBHEADING) {
                  return (
                    <p
                      key={iIdx}
                      className="text-sm font-semibold text-gray-500 mt-3 mb-1"
                    >
                      {item.heading}
                    </p>
                  );
                }
                return null;
              })}
              {sectionImages && renderImageThumbnails(sectionImages)}
            </div>
          );
        })}
        {Object.entries(imagesBySection)
          .filter(([key]) => !matchedKeys.has(key))
          .map(([key, sectionImages]) => (
            <div key={key} className="mb-2">
              <p className="text-sm font-semibold text-[#2E1E91] mb-1">{key}</p>
              {renderImageThumbnails(sectionImages)}
            </div>
          ))}
        {previewModal}
      </div>
    );
  }

  return (
    <div>
      {physicalExamination.generalExams.map(({ label, value }, idx) => (
        <LabelValueRow key={idx} label={label} value={value} />
      ))}
      {Object.entries(imagesBySection).map(([key, sectionImages]) => (
        <div key={key} className="mt-3">
          <p className="text-sm font-semibold text-gray-500 mb-2">{key}</p>
          {renderImageThumbnails(sectionImages)}
        </div>
      ))}
      {previewModal}
    </div>
  );
};

const MedicalHistorySection: React.FC<{
  sections: MedicalHistorySummary[];
}> = ({ sections }) => (
  <div>
    {sections.map((section, sIdx) => (
      <div key={sIdx} className="mb-2 last:mb-0">
        {section.title && (
          <p className="text-sm font-semibold text-[#2E1E91] mb-1">
            {section.title}
          </p>
        )}
        {section.items.map((item: ModalSectionItem, iIdx: number) => {
          if (item.type === ITEM_TYPES.LABEL_VALUE) {
            return (
              <LabelValueRow
                key={iIdx}
                label={item.label}
                value={String(item.value ?? 'No information')}
              />
            );
          }
          if (item.type === ITEM_TYPES.SUBHEADING) {
            return (
              <p
                key={iIdx}
                className="text-sm font-semibold text-gray-500 mt-3 mb-1"
              >
                {item.heading}
              </p>
            );
          }
          return null;
        })}
      </div>
    ))}
  </div>
);

const VisitSummaryPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  useBreadcrumb([
    { label: 'Dashboard', path: ROUTES.DASHBOARD },
    { label: 'Start Visit', path: '/ayu' },
    { label: 'Visit Summary' },
  ]);
  const {
    data,
    patientUuid: ctxPatientUuid,
    visitId: ctxVisitId,
    tempRecordId,
    clearVisitId,
    setLastSectionIndex,
    markVisitUploaded,
    physExamPendingImages: ctxPendingImages,
  } = useStartVisitData();
  const { hwProfile } = useProfileContext();
  const ayuList = useAyuJsonList(AYU_JSON_KEY_NAME);
  const physicalExamQuestions = useMemo(() => {
    const item = ayuList.find(i => i.name === 'physExam.json');
    if (!item) return [];
    // Build the obs questions from the SAME transform the PE stepper uses, so
    // the question ids / option codes line up with the stored answers. Using a
    // separate parser here left the upload obs blank once the stepper started
    // unwrapping concept-tag wrappers and collapsing branching sub-forms.
    const root = transformFhirPhysExamToAyu(
      item.json as unknown as Parameters<typeof transformFhirPhysExamToAyu>[0]
    );
    return flattenAyuPhysExamQuestions(root);
  }, [ayuList]);
  const [allOpen, setAllOpen] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploaded, setIsUploaded] = useState(false);
  const [uploadedVisitUuid, setUploadedVisitUuid] = useState<string>('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [speciality, setSpeciality] = useState('');
  const [specialityError, setSpecialityError] = useState('');
  const [priorityVisit, setPriorityVisit] = useState(false);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [additionalDocuments, setAdditionalDocuments] = useState<
    CapturedDocument[]
  >([]);
  const [patientName, setPatientName] = useState<string>('');
  const [patientIdentifier, setPatientIdentifier] = useState<string>('');
  const [bloodGroupAnswers, setBloodGroupAnswers] = useState<ConceptAnswer[]>(
    []
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [physExamImagePreviews, setPhysExamImagePreviews] = useState<
    Array<{ preview: string; name: string }>
  >(() => {
    if (ctxPendingImages.length > 0) {
      return ctxPendingImages.map(img => ({
        preview: URL.createObjectURL(img.file),
        name: img.comment ?? PE_DEFAULT_IMAGE_LABEL,
      }));
    }
    const pending = getPendingImages();
    if (pending.length > 0) {
      return pending.map(img => ({
        preview: URL.createObjectURL(img.file),
        name: img.comment ?? PE_DEFAULT_IMAGE_LABEL,
      }));
    }
    return [];
  });

  useEffect(() => {
    const bgField = data.vitals?.config?.find(f => f.key === 'blood_group');
    if (!bgField || (bgField.answers && bgField.answers.length > 0)) return;
    let cancelled = false;
    fetchConceptAnswers(bgField.uuid)
      .then(answers => {
        if (!cancelled) setBloodGroupAnswers(answers);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [data.vitals]);

  useEffect(() => {
    const uuid = ctxPatientUuid || storage.get(PATIENT_UUID_KEY);
    if (!uuid) return;
    let cancelled = false;
    patientService
      .getPatient(uuid)
      .then(patient => {
        if (cancelled) return;
        const pn = patient.person?.preferredName;
        const fullName = pn
          ? [pn.givenName, pn.middleName, pn.familyName]
              .filter(Boolean)
              .join(' ')
              .trim()
          : '';
        const preferred =
          patient.identifiers?.find(i => i.preferred) ??
          patient.identifiers?.[0];
        setPatientName(fullName || storage.get(PATIENT_NAME_KEY) || '');
        setPatientIdentifier(preferred?.identifier ?? '');
      })
      .catch(() => {
        setPatientName(storage.get(PATIENT_NAME_KEY) ?? '');
      });
    return () => {
      cancelled = true;
    };
  }, [ctxPatientUuid]);

  useEffect(() => {
    if (ctxPendingImages.length > 0) {
      setPhysExamImagePreviews(
        ctxPendingImages.map(img => ({
          preview: URL.createObjectURL(img.file),
          name: img.comment ?? PE_DEFAULT_IMAGE_LABEL,
        }))
      );
      return;
    }

    const pending = getPendingImages();
    if (pending.length > 0) {
      setPhysExamImagePreviews(
        pending.map(img => ({
          preview: URL.createObjectURL(img.file),
          name: img.comment ?? PE_DEFAULT_IMAGE_LABEL,
        }))
      );
      return;
    }

    if (!ctxVisitId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getChildResources<{
          questionId: string;
          comment?: string;
        }>(RESOURCE_TYPE_VISIT, ctxVisitId, RESOURCE_TYPE_ASSET);
        if (cancelled || !res.data?.length) return;
        const deletedIds = getDeletedAssetIds();
        const committedIds = getCommittedQuestionIds();
        const previews = res.data
          .filter(
            r =>
              r.file_path &&
              !deletedIds.has(r.id) &&
              r.data?.questionId &&
              committedIds.has(r.data.questionId)
          )
          .map(r => ({
            preview: r.file_path!,
            name: r.data?.comment ?? PE_DEFAULT_IMAGE_LABEL,
          }));
        setPhysExamImagePreviews(previews);
        /* v8 ignore next */
      } catch {
        /* v8 ignore next */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ctxVisitId, ctxPendingImages]);

  const toggleAll = useCallback(() => setAllOpen(prev => !prev), []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setAdditionalDocuments(prev => [
            ...prev,
            { file, preview: reader.result as string, name: file.name },
          ]);
        };
        reader.readAsDataURL(file);
      });

      e.target.value = '';
    },
    []
  );

  const handleRemoveDocument = useCallback((index: number) => {
    setAdditionalDocuments(prev => prev.filter((_, i) => i !== index));
  }, []);
  const handleBackToEdit = useCallback(() => {
    setLastSectionIndex(3);
    const basePath = location.pathname.replace(/\/visit-summary\/?$/, '');
    navigate(basePath || '/ayu');
  }, [location.pathname, navigate, setLastSectionIndex]);

  const handleUploadVisit = useCallback(async () => {
    if (
      !data.vitals ||
      !data.visitReason ||
      !data.physicalExam ||
      !data.medicalHistory
    ) {
      showToast(
        'Error',
        'Please complete all sections before uploading',
        'error'
      );
      return;
    }

    const patientUuid = ctxPatientUuid || storage.get(PATIENT_UUID_KEY);
    const locationUuid = storage.getLocationUuid();
    const providerUuid = hwProfile?.providerUuid;

    if (!patientUuid || !locationUuid || !providerUuid) {
      showToast(
        'Error',
        'Missing patient, location, or provider information',
        'error'
      );
      return;
    }

    setIsUploading(true);
    try {
      const visitReason = buildVisitReasonHtml(
        data.visitReason.details,
        data.visitReason.reasonNames,
        data.visitReason.detailsSections
      );

      const physicalExam = buildPhysicalExamData(
        data.physicalExam.answers,
        physicalExamQuestions
      );

      const medicalHistory = buildMedicalHistoryData(
        data.medicalHistory.patHistSummary
      );
      const familyHistory = buildFamilyHistoryData(
        data.medicalHistory.famHistSummary
      );

      const payload = buildVisitUploadPayload({
        patientUuid,
        providerUuid,
        locationUuid,
        vitalsFormValues: data.vitals.formValues,
        vitalsConfig: data.vitals.config,
        visitReason,
        physicalExam,
        medicalHistory,
        familyHistory,
        speciality,
        priorityVisit,
        doctorNotes: additionalNotes,
      });

      const response = await uploadVisit(payload);

      const hasPendingImages = getPendingImages().length > 0;
      if (hasPendingImages || additionalDocuments.length > 0) {
        let encounterUuid: string | undefined;

        if (response?.encounters) {
          const adultInitialEnc = response.encounters.find(
            enc => enc.encounterType?.uuid === ENCOUNTER_TYPES.ADULT_INITIAL
          );
          encounterUuid = adultInitialEnc?.uuid ?? response.encounters[1]?.uuid;
        }

        if (!encounterUuid) {
          encounterUuid = await getLatestEncounterUuid(
            patientUuid,
            ENCOUNTER_TYPES.ADULT_INITIAL
          );
        }

        if (hasPendingImages && encounterUuid) {
          try {
            await uploadAllPhysicalExamImages(encounterUuid, patientUuid);
          } catch (imgError) {
            // Visit is already uploaded — don't fail the whole flow on image error
            console.error('Failed to upload physical exam images:', imgError);
          }
        }

        if (additionalDocuments.length > 0) {
          clearPendingDocuments();
          for (const doc of additionalDocuments) {
            addPendingDocument(doc.file, doc.name);
          }
          await uploadAllAdditionalDocuments(encounterUuid, patientUuid);
        }
      }

      if (tempRecordId) {
        bulkMarkSynced([tempRecordId]).catch(() => {});
      }
      clearVisitId();
      clearCommittedQuestionIds();
      clearDeletedAssetIds();
      storage.remove(PATIENT_NAME_KEY);
      storage.remove(PATIENT_AGE_KEY);
      storage.remove(PATIENT_GENDER_KEY);

      const visitUuid = (await getLatestVisitUuid(patientUuid)) ?? '';
      setUploadedVisitUuid(visitUuid);
      setIsUploaded(true);
      markVisitUploaded();
      showToast('Success', 'Visit uploaded successfully', 'success');
    } catch (error) {
      console.error('Failed to upload visit:', error);
      showToast('Error', 'Failed to upload visit. Please try again.', 'error');
    } finally {
      setIsUploading(false);
    }
  }, [
    data,
    hwProfile,
    ctxPatientUuid,
    speciality,
    priorityVisit,
    tempRecordId,
    clearVisitId,
    markVisitUploaded,
    additionalNotes,
    additionalDocuments,
    physicalExamQuestions,
  ]);

  const confirmAndUpload = useCallback(() => {
    if (!speciality) {
      setSpecialityError("Please select a doctor's specialty");
      return;
    }
    setShowConfirm(true);
  }, [speciality]);

  const vitals = useMemo(
    () => (data.vitals ? mapVitals(data.vitals.formValues) : null),
    [data.vitals]
  );

  const additionalMeasurements = useMemo(
    () =>
      data.vitals
        ? buildAdditionalMeasurements(
            data.vitals.config,
            data.vitals.formValues,
            bloodGroupAnswers
          )
        : [],
    [data.vitals, bloodGroupAnswers]
  );

  const checkupReason = useMemo(
    (): CheckupReason | null =>
      data.visitReason
        ? {
            chiefComplaints: data.visitReason.reasonNames,
            details: data.visitReason.details,
          }
        : null,
    [data.visitReason]
  );

  const physicalExamination = useMemo(
    (): PhysicalExamination | null =>
      data.physicalExam ? { generalExams: data.physicalExam.details } : null,
    [data.physicalExam]
  );

  const { config } = useConfig();
  const specializations = config?.specialization ?? [];

  return (
    <div className="w-full bg-white md:rounded-xl md:p-4">
      <div className="flex items-center gap-3 mb-2">
        <img src={iconVisitSummary} alt="icon" />
        <span className="text-sm font-medium text-[#2E1E91]">
          Visit Summary
        </span>
      </div>
      {(patientName || patientIdentifier) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 md:px-0 mt-1 mb-2">
          {patientName && (
            <span className="text-sm font-semibold text-gray-800">
              {patientName}
            </span>
          )}
          {patientIdentifier && (
            <span className="text-xs text-gray-500">
              OpenMRS ID: {patientIdentifier}
            </span>
          )}
        </div>
      )}
      <hr className="border-t border-gray-200 mt-2 mb-3 md:-mx-4" />

      <div className="px-4 md:px-0">
        <div className="flex justify-end py-2">
          <button
            className="flex items-center gap-1 text-xs text-gray-500"
            onClick={toggleAll}
          >
            {allOpen ? 'Close all' : 'Open all'}
            <img
              src={iconChevronDown}
              alt=""
              className={`w-3.5 h-3.5 transition-transform ${allOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
          <div className="md:col-span-2">
            <CollapsedComponent
              icon={iconVitals}
              title="Vitals"
              contentLabel="Details"
              defaultOpen={allOpen}
              key={`vitals-${allOpen}`}
            >
              {vitals ? (
                <>
                  <VitalsSection vitals={vitals} />
                  <AdditionalMeasurementsSection
                    items={additionalMeasurements}
                  />
                </>
              ) : (
                <p className="text-gray-400 italic text-sm">
                  No vitals recorded
                </p>
              )}
            </CollapsedComponent>
          </div>

          <CollapsedComponent
            icon={iconVisitReason}
            title="Check-up reason"
            defaultOpen={allOpen}
            key={`checkup-${allOpen}`}
          >
            {checkupReason ? (
              <CheckupReasonSection
                checkupReason={checkupReason}
                detailsSections={data.visitReason?.detailsSections}
              />
            ) : (
              <p className="text-gray-400 italic text-sm">
                No visit reason recorded
              </p>
            )}
          </CollapsedComponent>

          <CollapsedComponent
            icon={iconPhysicalExam}
            title="Physical examination"
            defaultOpen={allOpen}
            key={`physical-${allOpen}`}
          >
            {physicalExamination ? (
              <PhysicalExaminationSection
                physicalExamination={physicalExamination}
                detailsSections={data.physicalExam?.detailsSections}
                images={physExamImagePreviews}
              />
            ) : (
              <p className="text-gray-400 italic text-sm">
                No physical exam recorded
              </p>
            )}
          </CollapsedComponent>

          <div className="md:col-span-2">
            <CollapsedComponent
              icon={iconMedicalHistory}
              title="Medical History"
              defaultOpen={allOpen}
              key={`medical-${allOpen}`}
            >
              {data.medicalHistory ? (
                <MedicalHistorySection
                  sections={[
                    ...data.medicalHistory.patHistSummary,
                    ...data.medicalHistory.famHistSummary,
                  ]}
                />
              ) : (
                <p className="text-gray-400 italic text-sm">
                  No medical history recorded
                </p>
              )}
            </CollapsedComponent>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-start gap-4 mt-4 px-4 mb-4 md:px-0">
        <div className="w-full md:w-1/2">
          <p className="text-sm font-semibold text-[#2E1E91] mb-1.5">
            Additional notes
          </p>
          <textarea
            rows={2}
            placeholder="Leave a note for doctor"
            value={additionalNotes}
            onChange={e => setAdditionalNotes(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 placeholder-gray-400 resize-none outline-none focus:border-[#2E1E91]"
          />
        </div>
        <div className="w-full md:w-1/2">
          <p className="text-sm font-semibold text-[#2E1E91] mb-1.5">
            Add Additional document{' '}
            {additionalDocuments.length > 0 && (
              <span className="text-gray-500">
                ({additionalDocuments.length})
              </span>
            )}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_DOCUMENT_TYPES}
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="flex items-start gap-3 flex-wrap">
            {additionalDocuments.map((doc, index) => (
              <div
                key={index}
                className="flex flex-col items-center w-16 relative"
              >
                <div className="w-16 h-16 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
                  <img
                    src={doc.preview}
                    alt={doc.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveDocument(index)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] leading-none hover:bg-red-600"
                >
                  ✕
                </button>
                <span className="text-xs text-gray-600 mt-1 truncate w-full text-center">
                  {doc.name}
                </span>
              </div>
            ))}
            <div className="flex flex-col items-center w-16">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-16 h-16 rounded-lg bg-[#2E1E91] text-white flex items-center justify-center text-2xl hover:bg-[#241776] transition-colors"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col md:flex-row md:items-end gap-4 mt-4 px-4 mb-4 md:px-0">
        <div className="w-full md:w-1/2 border border-gray-200 rounded-xl p-4 md:border-0 md:p-0 md:rounded-none">
          <p className="text-sm font-semibold text-[#2E1E91] mb-1.5">
            Doctor's specialty
          </p>
          <Dropdown
            options={specializations.map(
              (s, idx): DropdownOption => ({
                value: String(s.name ?? ''),
                label: String(s.name ?? `Option ${idx + 1}`),
              })
            )}
            value={speciality}
            onChange={val => {
              setSpeciality(val as string);
              setSpecialityError('');
            }}
            placeholder="Select Doctor's specialty"
            size="sm"
            error={specialityError}
          />
        </div>

        <div className="w-full md:w-1/2 flex items-center justify-between gap-2 border border-gray-200 rounded-xl p-4 md:border-0 md:p-0 md:rounded-none md:mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[#2E1E91]">
              Priority Visit
            </span>
            <img src={iconInfo} alt="info" className="w-4 h-4 opacity-40" />
          </div>
          <div className="w-12">
            <Toggle
              checked={priorityVisit}
              onChange={e => setPriorityVisit(e.target.checked)}
              size="md"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-between gap-3 mt-6 px-4 md:px-0 pb-4">
        {!isUploaded && (
          <>
            <button
              type="button"
              onClick={handleBackToEdit}
              className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Back to Edit
            </button>
            <button
              type="button"
              onClick={confirmAndUpload}
              disabled={isUploading}
              className="rounded-lg px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: PRIMARY_COLOR }}
            >
              {isUploading ? 'Uploading...' : 'Upload Visit'}
            </button>
          </>
        )}
        {isUploaded && (
          <button
            type="button"
            onClick={() =>
              navigate(`/appointment-schedule/${uploadedVisitUuid}`, {
                state: { speciality },
              })
            }
            className="rounded-lg px-5 py-2 text-sm font-medium text-white hover:opacity-90"
            style={{ backgroundColor: PRIMARY_COLOR }}
          >
            Schedule Appointment
          </button>
        )}
      </div>

      {showConfirm && (
        <ConfirmationModal
          open={showConfirm}
          type="confirm"
          title="Send Visit"
          description="Are you sure you want to upload this visit?"
          confirmText="Yes"
          cancelText="No"
          onClose={() => setShowConfirm(false)}
          onConfirm={() => {
            setShowConfirm(false);
            handleUploadVisit();
          }}
        />
      )}
    </div>
  );
};

export default VisitSummaryPage;
