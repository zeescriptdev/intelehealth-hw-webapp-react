import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBreadcrumb } from '../../../hooks/useBreadcrumb';
import ROUTES from '../../../routes/paths';
import iconClose from '../../../assets/icons/close.svg';
import iconEdit from '../../../assets/icons/edit.svg';
import iconAddress from '../../../assets/icons/icon-location-green-rounded-bordered.svg';
import iconRight from '../../../assets/icons/icon-right-arrow.svg';
import iconVisit from '../../../assets/icons/icon-summary-list.svg';
import iconSync from '../../../assets/icons/icon-sync.svg';
import iconOther from '../../../assets/icons/icon-three-dot-green-rounded-bordered.svg';
import iconPersonal from '../../../assets/icons/icon-user-green-rounded-bordered.svg';
import iconVisitSummary from '../../../assets/icons/icon-visit-summery.svg';
import defaultUserImg from '../../../assets/images/default-user-img.svg';
import { Button } from '../../../components/common';
import { ConfirmationModal } from '../../../components/modal/confirmation.modal';
import { showToast } from '../../../services/toast';
import {
  clearVisitForPatient,
  hasInProgressVisit,
} from '../../ayu/utils/visit-id.util';
import { RESUME_VISIT_MODAL } from '../../../utils/constant';
import CollapsedComponent from '../../visit-summary/visit-summary-collapsed.component';
import {
  getVisitTitle,
  mapRawPatientToFormData,
  maskVisitId,
  usePatientProfile,
} from './patient-profile.hooks';

const na = 'Not provided';
const fmt = (v: string | null | undefined, fallback = na) =>
  v?.trim() ? v.trim() : fallback;

const Row = ({ label, value }: { label: string; value: string }) => (
  <li className="flex py-1">
    <span className="w-44 shrink-0 text-gray-400 text-sm">{label}</span>
    <span className="text-sm font-medium text-gray-800">{value}</span>
  </li>
);

const PatientProfileComponent: React.FC = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const navigate = useNavigate();

  const {
    patientData,
    rawPatient,
    visits,
    loading,
    refreshing,
    error,
    refresh,
  } = usePatientProfile(uuid);
  useBreadcrumb([
    { label: 'Dashboard', path: ROUTES.DASHBOARD },
    { label: patientData?.fullName ?? 'Patient Details' },
  ]);

  const [imgError, setImgError] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const patientImgSrc = uuid
    ? `${import.meta.env.VITE_OPENMRS_API_URL}/personimage/${uuid}`
    : '';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="spinner" />
      </div>
    );
  }

  if (error || !patientData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-red-500">{error ?? 'Patient not found.'}</p>
      </div>
    );
  }

  const {
    fullName,
    patientId,
    gender,
    dob,
    age,
    phone,
    contactType,
    emergencyName,
    emergencyNumber,
    occupation,
    caste,
    education,
    economicStatus,
    address,
  } = patientData;

  const goToVisit = () =>
    navigate('/ayu', {
      state: {
        patientName: fullName,
        patientAge: age || dob,
        patientGender: gender,
        patientUuid: uuid,
      },
    });

  const handleStartVisitClick = async () => {
    if (await hasInProgressVisit(uuid ?? null)) {
      setShowResumeModal(true);
    } else {
      goToVisit();
    }
  };

  const handleResume = () => {
    setShowResumeModal(false);
    goToVisit();
  };

  const handleStartOver = () => {
    clearVisitForPatient(uuid ?? null);
    setShowResumeModal(false);
    goToVisit();
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 shrink-0">
        <h1 className="text-lg font-bold text-gray-900">Patient Details</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={refresh}
            className="p-1.5 rounded-full hover:bg-gray-100"
            disabled={refreshing}
          >
            <img
              src={iconSync}
              alt="Refresh"
              className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`}
            />
          </button>
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-full hover:bg-gray-100"
          >
            <img src={iconClose} alt="Close" className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3 flex items-center gap-4">
          <img
            src={!imgError && patientImgSrc ? patientImgSrc : defaultUserImg}
            alt={fullName}
            className="w-14 h-14 rounded-full object-cover border border-gray-200"
            onError={() => setImgError(true)}
          />
          <div className="flex-1">
            <p className="font-bold text-gray-900 text-base">{fullName}</p>
            <p className="text-sm text-gray-500">{patientId}</p>
          </div>
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs text-[#2F1E91] font-medium cursor-pointer border border-[#E1DCFF] rounded-md px-3 py-1 hover:bg-[#E1DCFF] transition-colors"
            onClick={() => {
              try {
                navigate('/patient/edit', {
                  state: {
                    editFormData: rawPatient
                      ? mapRawPatientToFormData(rawPatient)
                      : null,
                    patientUuid: uuid,
                    editSource: 'profile',
                  },
                });
              } catch {
                showToast(
                  'Edit Failed',
                  'Could not open edit form. Please try again.',
                  'error'
                );
              }
            }}
          >
            <img src={iconEdit} alt="Edit" className="w-3.5 h-3.5" />
            Edit
          </button>
        </div>

        <CollapsedComponent
          icon={iconPersonal}
          title="Personal"
          contentLabel="Details"
        >
          <ul className="space-y-0.5">
            <Row label="Name" value={fmt(fullName)} />
            <Row label="Gender" value={fmt(gender)} />
            <Row label="Date of birth" value={fmt(dob)} />
            <Row label="Age" value={fmt(age)} />
            <Row label="Phone number" value={fmt(phone)} />
            <Row label="Contact Type" value={fmt(contactType)} />
            <Row label="Emergency Contact Name" value={fmt(emergencyName)} />
            <Row
              label="Emergency Contact number"
              value={fmt(emergencyNumber)}
            />
          </ul>
        </CollapsedComponent>

        <CollapsedComponent
          icon={iconAddress}
          title="Address"
          contentLabel="Details"
        >
          <ul className="space-y-0.5">
            <Row
              label="Postal code"
              value={fmt(address?.postalCode, 'No postal code added')}
            />
            <Row
              label="Country"
              value={fmt(address?.country, 'No country added')}
            />
            <Row
              label="State"
              value={fmt(address?.stateProvince, 'No state added')}
            />
            <Row label="District" value={fmt(address?.countyDistrict, 'NA')} />
            <Row
              label="Village/Town/City"
              value={fmt(address?.cityVillage, 'No city added')}
            />
            <Row
              label="Corresponding Address 1"
              value={fmt(address?.address1, 'No address added')}
            />
            <Row
              label="Corresponding Address 2"
              value={fmt(address?.address2, 'No address added')}
            />
          </ul>
        </CollapsedComponent>

        <CollapsedComponent
          icon={iconOther}
          title="Other details"
          contentLabel="Details"
        >
          <ul className="space-y-0.5">
            <Row label="Occupation" value={fmt(occupation)} />
            <Row label="Social Category" value={fmt(caste)} />
            <Row label="Education" value={fmt(education)} />
            <Row label="Economic Category" value={fmt(economicStatus)} />
          </ul>
        </CollapsedComponent>

        {visits.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-4">
            <Button
              variant="primary"
              className="w-auto px-8"
              type="button"
              onClick={handleStartVisitClick}
            >
              Start Visit
            </Button>
          </div>
        )}

        {visits.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
              <img src={iconVisit} alt="" className="w-9 h-9" />
              <span className="font-semibold text-gray-800 text-base">
                Open Visit
              </span>
            </div>
            <div className="px-4 pb-3 pt-2 space-y-2">
              {visits.map(visit => (
                <button
                  key={visit.uuid}
                  className="w-full flex items-center justify-between bg-gray-50 rounded-xl px-3 py-3 hover:bg-gray-100 text-left"
                  onClick={() =>
                    navigate(`/visit-summary/${visit.uuid}`, {
                      state: { visitUuid: visit.uuid },
                    })
                  }
                >
                  <div>
                    {getVisitTitle(visit) && (
                      <p className="font-semibold text-gray-800 text-sm">
                        {getVisitTitle(visit)}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      Visit ID: {maskVisitId(visit.uuid)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Visit Date:{' '}
                      {visit.startDatetime
                        ? new Date(visit.startDatetime)
                            .toISOString()
                            .split('T')[0]
                        : ''}
                    </p>
                  </div>
                  <img src={iconRight} alt="" className="w-4 h-4 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {showResumeModal && (
        <ConfirmationModal
          open
          type="confirm"
          icon={iconVisitSummary}
          title={RESUME_VISIT_MODAL.TITLE}
          description={RESUME_VISIT_MODAL.DESCRIPTION}
          cancelText={RESUME_VISIT_MODAL.START_OVER}
          confirmText={RESUME_VISIT_MODAL.RESUME}
          onClose={handleStartOver}
          onConfirm={handleResume}
        />
      )}
    </div>
  );
};

export default PatientProfileComponent;
