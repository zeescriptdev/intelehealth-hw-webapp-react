/*
 * Camera capture retry settings — used by CameraCaptureModal to recover
 * from NotReadableError / TrackStartError when the OS camera driver has
 * not fully released the device yet.
 */
export const CAMERA_MAX_RETRIES = 3;
export const CAMERA_RETRY_DELAY_MS = 600;
export const ADD_PATIENT_LABEL = 'Add Patient';
export const PATIENT_DETAILS_LABEL = 'Patient Details';

/** "Continue or Start Over?" confirmation shown before reopening a saved visit. */
export const RESUME_VISIT_MODAL = {
  TITLE: 'Continue or Start Over?',
  DESCRIPTION:
    'Continue the visit from where you left off, or begin a new assessment.',
  RESUME: 'Resume Visit',
  START_OVER: 'Start over',
} as const;

export const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिंदी' },
  { value: 'mr', label: 'मराठी' },
  { value: 'ta', label: 'தமிழ்' },
  { value: 'te', label: 'తెలుగు' },
  { value: 'bn', label: 'বাংলা' },
];
