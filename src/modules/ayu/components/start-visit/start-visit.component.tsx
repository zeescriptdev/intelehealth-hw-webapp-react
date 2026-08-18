import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBreadcrumb } from '../../../../hooks/useBreadcrumb';
import ROUTES from '../../../../routes/paths';
import { storage } from '../../../../utils/storage';
import type { SectionState } from '../../../ayu-library/types/start-visit.types';
import {
  EXT_URL_PERFORM_PHYSICAL_EXAM,
  EXT_URL_PERFORM_PHYSICAL_EXAM_LEGACY,
} from '../../../ayu-library/utils/constants';
import iconStartVisit from '../../../ayu/assets/icon-start-visit.svg';
import { useStartVisitData } from '../../context/start-visit.context';
import { useVisitReasons } from '../../hooks/useVisitReasons.hook';
import { clearPendingImages } from '../../services/obs.service';
import {
  clearCommittedQuestionIds,
  clearDeletedAssetIds,
} from '../../services/temp-storage.service';
import {
  BREADCRUMB_STATUS_PENDING,
  PATIENT_AGE_KEY,
  PATIENT_GENDER_KEY,
  PATIENT_NAME_KEY,
  PATIENT_UUID_KEY,
  SECTION_MEDICAL_HISTORY,
  SECTION_PHYSICAL_EXAM,
  SECTION_VISIT_REASON,
  SECTION_VITALS,
} from '../../utils/ayu.constants';
import { SectionCompletionLoader } from '../loaders/section-completion-loader.component';
import { SideLoader } from '../loaders/side-loader.component';
import { MedicalHistory } from './medical-history/medical-history.component';
import { PhysicalExamination } from './physical-examination/physical-examination.component';
import { VisitReason } from './visit-reason/visit-reason.component';
import { Vitals } from './vitals/vitals.component';

export const getPhysicalExamFilter = (
  questionnaire:
    | { extension?: Array<{ url: string; valueString?: string }> }
    | null
    | undefined
): string => {
  const ext = questionnaire?.extension ?? [];
  return (
    ext.find(
      e =>
        e.url === EXT_URL_PERFORM_PHYSICAL_EXAM ||
        e.url === EXT_URL_PERFORM_PHYSICAL_EXAM_LEGACY
    )?.valueString ?? ''
  );
};

export const StartVisit = () => {
  const { lastSectionIndex, data } = useStartVisitData();
  const { state } = useLocation();
  const navigate = useNavigate();

  const patientName =
    state?.patientName ?? storage.get(PATIENT_NAME_KEY) ?? null;
  const patientAge = state?.patientAge ?? storage.get(PATIENT_AGE_KEY) ?? null;
  const patientGender =
    state?.patientGender ?? storage.get(PATIENT_GENDER_KEY) ?? null;

  useEffect(() => {
    if (state?.patientName) storage.set(PATIENT_NAME_KEY, state.patientName);
    if (state?.patientAge) storage.set(PATIENT_AGE_KEY, state.patientAge);
    if (state?.patientGender)
      storage.set(PATIENT_GENDER_KEY, state.patientGender);
    if (state?.patientUuid) storage.set(PATIENT_UUID_KEY, state.patientUuid);
  }, [
    state?.patientName,
    state?.patientAge,
    state?.patientGender,
    state?.patientUuid,
  ]);

  const {
    data: restoredData,
    isRestoring,
    restoredSectionIndex,
    saveSectionToTemp,
    clearPhysicalExamData,
    clearMedicalHistoryData,
  } = useStartVisitData();
  const visitReasons = useVisitReasons();
  const { ayuConfigFiles } = visitReasons;
  const [confirmedReasons, setConfirmedReasons] = useState<string[]>([]);
  const [medicalHistorySubtitle, setMedicalHistorySubtitle] = useState('');
  const [downstreamResetKey, setDownstreamResetKey] = useState(0);

  const handleReasonsConfirmed = useCallback((reasons: string[]) => {
    setConfirmedReasons(reasons);
  }, []);

  const handleProtocolCleared = useCallback(() => {
    clearPhysicalExamData();
    clearMedicalHistoryData();
    clearPendingImages();
    clearDeletedAssetIds();
    clearCommittedQuestionIds();
    saveSectionToTemp({
      physicalExam: null,
      medicalHistory: null,
      medicalHistoryAnswers: undefined,
    });
    setSections(prev =>
      prev.map(section =>
        section.name === SECTION_PHYSICAL_EXAM ||
        section.name === SECTION_MEDICAL_HISTORY
          ? { ...section, answeredQuestions: 0 }
          : section
      )
    );
    setDownstreamResetKey(key => key + 1);
  }, [clearPhysicalExamData, clearMedicalHistoryData, saveSectionToTemp]);

  const getSectionSubtitle = (sectionName: string): string => {
    switch (sectionName) {
      case SECTION_VISIT_REASON:
        return confirmedReasons.length > 0 ? confirmedReasons.join(', ') : '';
      case SECTION_PHYSICAL_EXAM: {
        const physExam = ayuConfigFiles.find(
          f => f.name.replace(/\.json$/i, '').trim() === 'physExam'
        );
        return physExam?.json?.title ?? '';
      }
      case SECTION_MEDICAL_HISTORY:
        return medicalHistorySubtitle;
      default:
        return '';
    }
  };

  const physicalExamFilter = useMemo(
    () =>
      visitReasons.selectedComplaints
        .map(item => getPhysicalExamFilter(item.json))
        .filter(Boolean)
        .join(';'),
    [visitReasons.selectedComplaints]
  );
  const [sections, setSections] = useState<SectionState[]>(() => {
    const vitalsTotal = 1;
    const visitReasonTotal = 1;
    const physExamTotal = 3;
    const medHistTotal = 5;
    return [
      {
        totalQuestions: vitalsTotal,
        answeredQuestions: data.vitals ? vitalsTotal : 1,
        name: SECTION_VITALS,
        currentStepIndex: 0,
      },
      {
        totalQuestions: visitReasonTotal,
        answeredQuestions: data.visitReason ? visitReasonTotal : 0,
        name: SECTION_VISIT_REASON,
        currentStepIndex: 0,
      },
      {
        totalQuestions: physExamTotal,
        answeredQuestions: data.physicalExam ? physExamTotal : 0,
        name: SECTION_PHYSICAL_EXAM,
        currentStepIndex: 0,
      },
      {
        totalQuestions: medHistTotal,
        answeredQuestions: data.medicalHistory ? medHistTotal : 0,
        name: SECTION_MEDICAL_HISTORY,
        currentStepIndex: 0,
      },
    ];
  });

  const [currentSectionIndex, setCurrentSectionIndex] =
    useState(lastSectionIndex);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [hasRestored, setHasRestored] = useState(false);
  const [isVisitReasonStepperActive, setIsVisitReasonStepperActive] =
    useState(false);

  const sectionNames = [
    SECTION_VITALS,
    SECTION_VISIT_REASON,
    SECTION_PHYSICAL_EXAM,
    SECTION_MEDICAL_HISTORY,
  ];
  const goToSection = useCallback(
    (targetIndex: number) => {
      setCurrentSectionIndex(targetIndex);
      saveSectionToTemp({ currentSectionIndex: targetIndex });
      setCurrentQuestionIndex(
        Math.max(sections[targetIndex].answeredQuestions - 1, 0)
      );
    },
    [saveSectionToTemp, sections]
  );

  useBreadcrumb([
    { label: 'Dashboard', path: ROUTES.DASHBOARD },
    {
      label: 'Add Patient',
      onClick: () =>
        navigate(`${ROUTES.PATIENT.BASE}/${ROUTES.PATIENT.ADD_PATIENT}`, {
          state: {
            fromStartVisit: true,
            patientUuid: state?.patientUuid ?? storage.get(PATIENT_UUID_KEY),
          },
        }),
    },
    {
      label: 'Patient Details',
      onClick: () =>
        navigate(`${ROUTES.PATIENT.BASE}/${ROUTES.PATIENT.ADD_PATIENT}`, {
          state: {
            resumePreview: true,
            patientUuid: state?.patientUuid ?? storage.get(PATIENT_UUID_KEY),
          },
        }),
    },
    { label: 'Start Visit', onClick: () => goToSection(0) },
    ...sectionNames
      .map((name, index) => ({
        label: name,
        status: (index < currentSectionIndex
          ? 'completed'
          : index === currentSectionIndex
            ? 'active'
            : BREADCRUMB_STATUS_PENDING) as 'completed' | 'active' | 'pending',
        ...(index < currentSectionIndex && {
          onClick: () => goToSection(index),
        }),
      }))
      .filter(item => item.status !== BREADCRUMB_STATUS_PENDING),
  ]);

  useEffect(() => {
    const mainContainerContent = document.getElementById(
      'main-container-content'
    );
    if (mainContainerContent) {
      mainContainerContent.scrollTo(0, 0);
    }
  }, [currentSectionIndex]);

  const showAssessmentProgress =
    currentSectionIndex > 1 ||
    (currentSectionIndex === 1 && isVisitReasonStepperActive);

  useEffect(() => {
    if (isRestoring || hasRestored) return;
    setHasRestored(true);

    let restoreIndex: number;
    if (lastSectionIndex > 0) {
      restoreIndex = lastSectionIndex;
    } else if (restoredSectionIndex != null) {
      restoreIndex = restoredSectionIndex;
    } else {
      restoreIndex = 0;
      if (restoredData.vitals) restoreIndex = 1;
      if (restoredData.visitReason) restoreIndex = 2;
      if (restoredData.physicalExam) restoreIndex = 3;
    }

    if (restoredData.visitReason?.reasonNames?.length) {
      setConfirmedReasons(restoredData.visitReason.reasonNames);
      restoredData.visitReason.reasonNames.forEach(name =>
        visitReasons.addReason(name)
      );
    }

    if (restoreIndex > 0) {
      setCurrentSectionIndex(restoreIndex);
    }

    setSections(prev =>
      prev.map(s => {
        const hasData =
          (s.name === SECTION_VITALS && !!restoredData.vitals) ||
          (s.name === SECTION_VISIT_REASON && !!restoredData.visitReason) ||
          (s.name === SECTION_PHYSICAL_EXAM && !!restoredData.physicalExam) ||
          (s.name === SECTION_MEDICAL_HISTORY && !!restoredData.medicalHistory);
        return hasData ? { ...s, answeredQuestions: s.totalQuestions } : s;
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRestoring, hasRestored, restoredData, restoredSectionIndex]);

  const isCurrentSectionCompleted = (): boolean => {
    const completedBySectionIndex = [
      !!data.vitals,
      !!data.visitReason,
      !!data.physicalExam,
      !!data.medicalHistory,
    ];
    return !!completedBySectionIndex[currentSectionIndex];
  };

  const goNextQuestion = () => {
    const section = sections[currentSectionIndex];
    const total = section.totalQuestions;

    if (isCurrentSectionCompleted()) {
      goNextSection();
      return;
    }

    if (section.answeredQuestions >= total) {
      goNextSection();
      return;
    }

    if (currentQuestionIndex < total - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      return;
    }

    setSections(prev => {
      const copy = [...prev];
      copy[currentSectionIndex].answeredQuestions =
        copy[currentSectionIndex].totalQuestions;
      return copy;
    });

    goNextSection();
  };

  const goPreviousQuestion = () => {
    setCurrentQuestionIndex(prev => Math.max(prev - 1, 0));
  };

  const goNextSection = () => {
    setCurrentSectionIndex(prev => {
      const next = Math.min(prev + 1, sections.length - 1);
      saveSectionToTemp({ currentSectionIndex: next });
      return next;
    });
    setCurrentQuestionIndex(0);
  };

  const goPreviousSection = () => {
    setCurrentSectionIndex(prev => {
      const newIndex = Math.max(prev - 1, 0);
      saveSectionToTemp({ currentSectionIndex: newIndex });

      setCurrentQuestionIndex(
        Math.max(sections[newIndex].answeredQuestions - 1, 0)
      );

      return newIndex;
    });
  };

  const updateSectionProgress = useCallback(
    (sectionName: string, total: number, answered: number) => {
      setSections(prev =>
        prev.map(section =>
          section.name === sectionName
            ? { ...section, totalQuestions: total, answeredQuestions: answered }
            : section
        )
      );
      setCurrentQuestionIndex(answered);
    },
    []
  );

  const handleVisitReasonProgress = useCallback(
    (total: number, answered: number) => {
      updateSectionProgress(SECTION_VISIT_REASON, total, answered);
    },
    [updateSectionProgress]
  );

  const handlePhysicalExamProgress = useCallback(
    (total: number, answered: number) => {
      updateSectionProgress(SECTION_PHYSICAL_EXAM, total, answered);
    },
    [updateSectionProgress]
  );

  const handleMedicalHistoryProgress = useCallback(
    (total: number, answered: number) => {
      updateSectionProgress(SECTION_MEDICAL_HISTORY, total, answered);
    },
    [updateSectionProgress]
  );

  const handleMedicalHistorySubtitleChange = useCallback((subtitle: string) => {
    setMedicalHistorySubtitle(subtitle);
  }, []);

  if (isRestoring) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-gray-500">Restoring visit data...</p>
      </div>
    );
  }

  return (
    <div className="bg-white">
      <div className="mx-auto">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-200 text-gray-700 font-semibold">
          <img
            src={iconStartVisit}
            className="object-cover rounded-full"
            alt="Ayu Loader"
          />
          Start Visit
        </div>
        <div className="mt-2 border-b border-gray-200">
          {patientName && (
            <span className="text-gray-700 font-medium text-lg">
              {patientName}
              <span className="text-[#7f7b92] text-sm font-medium ml-2">
                {patientAge}
                {patientGender ? ` • ${patientGender}` : ''}
              </span>
            </span>
          )}
          <div
            className="mb-2 font-medium text-lg md:text-sm"
            style={{ color: '#2e1e91' }}
          >
            {currentSectionIndex + 1}/{sections.length}{' '}
            {sections[currentSectionIndex].name}
            {getSectionSubtitle(sections[currentSectionIndex].name) && (
              <> : {getSectionSubtitle(sections[currentSectionIndex].name)}</>
            )}
          </div>
        </div>
        {showAssessmentProgress && (
          <div className="pt-3">
            <SectionCompletionLoader
              sections={sections}
              currentSectionIndex={currentSectionIndex}
            />
          </div>
        )}

        {showAssessmentProgress &&
          sections[currentSectionIndex]?.totalQuestions > 1 && (
            <div className="hidden md:block">
              <SideLoader
                sections={sections}
                currentSectionIndex={currentSectionIndex}
                currentQuestionIndex={currentQuestionIndex}
              />
            </div>
          )}

        {currentSectionIndex === 0 && (
          <Vitals
            questionIndex={currentQuestionIndex}
            onNextQuestion={goNextQuestion}
            onPrevQuestion={goPreviousQuestion}
          />
        )}

        <div style={{ display: currentSectionIndex === 1 ? 'block' : 'none' }}>
          <VisitReason
            questionIndex={currentQuestionIndex}
            onNextQuestion={goNextQuestion}
            onPrevQuestion={goPreviousQuestion}
            onPrevSection={goPreviousSection}
            onProgressUpdate={handleVisitReasonProgress}
            visitReasons={visitReasons}
            onReasonsConfirmed={handleReasonsConfirmed}
            onStepperActiveChange={setIsVisitReasonStepperActive}
            onProtocolCleared={handleProtocolCleared}
          />
        </div>

        <div style={{ display: currentSectionIndex === 2 ? 'block' : 'none' }}>
          <PhysicalExamination
            key={`physical-exam-${downstreamResetKey}`}
            questionIndex={currentQuestionIndex}
            onNextQuestion={goNextQuestion}
            onPrevQuestion={goPreviousQuestion}
            onPrevSection={goPreviousSection}
            onProgressUpdate={handlePhysicalExamProgress}
            physicalExamFilter={physicalExamFilter}
            ayuConfigFiles={ayuConfigFiles}
          />
        </div>

        <div style={{ display: currentSectionIndex === 3 ? 'block' : 'none' }}>
          <MedicalHistory
            key={`medical-history-${downstreamResetKey}`}
            questionIndex={currentQuestionIndex}
            onNextQuestion={goNextQuestion}
            onPrevQuestion={goPreviousQuestion}
            onPrevSection={goPreviousSection}
            onProgressUpdate={handleMedicalHistoryProgress}
            onSubtitleChange={handleMedicalHistorySubtitleChange}
            ayuConfigFiles={ayuConfigFiles}
          />
        </div>
      </div>
    </div>
  );
};
