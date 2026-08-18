import { describe, expect, it } from 'vitest';
import {
  JOB_AID_ABDOMINAL_REGIONS,
  JOB_AID_FALLBACK,
  JOB_AID_THYROID_SWELLING,
  validationMessageForReason,
  VALIDATION_ALL_COMPULSORY,
  VALIDATION_ENTER_VALUE,
  VALIDATION_SELECT_OPTION,
  VALIDATION_UPLOAD_CAPTURED_IMAGE,
} from '../../../../modules/ayu/utils/ayu.constants';

describe('ayu.constants', () => {
  describe('JOB_AID_FALLBACK', () => {
    it('maps "tenderness" to abdominal regions asset key', () => {
      expect(JOB_AID_FALLBACK['tenderness']).toBe(JOB_AID_ABDOMINAL_REGIONS);
      expect(JOB_AID_FALLBACK['tenderness']).toBe('abdominalregions9');
    });

    it('maps "thyroid swelling" to thyroid swelling asset key', () => {
      expect(JOB_AID_FALLBACK['thyroid swelling']).toBe(JOB_AID_THYROID_SWELLING);
      expect(JOB_AID_FALLBACK['thyroid swelling']).toBe('thyroidswelling');
    });

    it('returns undefined for unmapped keys', () => {
      expect(JOB_AID_FALLBACK['jaundice']).toBeUndefined();
    });

    it('has exactly 2 entries', () => {
      expect(Object.keys(JOB_AID_FALLBACK)).toHaveLength(2);
    });

    it('uses lowercase keys for case-insensitive lookup', () => {
      Object.keys(JOB_AID_FALLBACK).forEach(key => {
        expect(key).toBe(key.toLowerCase());
      });
    });
  });

  describe('validationMessageForReason', () => {
    it('returns upload captured image message for "uploadImage" reason', () => {
      expect(validationMessageForReason('uploadImage')).toBe(
        VALIDATION_UPLOAD_CAPTURED_IMAGE
      );
    });

    it('returns upload captured image message for "uploadCapturedImage" reason', () => {
      expect(validationMessageForReason('uploadCapturedImage')).toBe(
        VALIDATION_UPLOAD_CAPTURED_IMAGE
      );
    });

    it('returns all compulsory message for "allCompulsory" reason', () => {
      expect(validationMessageForReason('allCompulsory')).toBe(
        VALIDATION_ALL_COMPULSORY
      );
    });

    it('returns enter value message for "enterValue" reason', () => {
      expect(validationMessageForReason('enterValue')).toBe(
        VALIDATION_ENTER_VALUE
      );
    });

    it('returns select option message for undefined reason (default)', () => {
      expect(validationMessageForReason(undefined)).toBe(
        VALIDATION_SELECT_OPTION
      );
    });

    it('prepends "Question N:" for uploadImage with questionNumber', () => {
      const result = validationMessageForReason('uploadImage', 3);
      expect(result).toBe(`Question 3: ${VALIDATION_UPLOAD_CAPTURED_IMAGE}`);
    });

    it('prepends "Question N:" for uploadCapturedImage with questionNumber', () => {
      const result = validationMessageForReason('uploadCapturedImage', 5);
      expect(result).toBe(`Question 5: ${VALIDATION_UPLOAD_CAPTURED_IMAGE}`);
    });

    it('returns "Please answer Question N before proceeding" for allCompulsory with questionNumber', () => {
      const result = validationMessageForReason('allCompulsory', 2);
      expect(result).toBe('Please answer Question 2 before proceeding');
    });

    it('returns "Please answer Question N before proceeding" for enterValue with questionNumber', () => {
      const result = validationMessageForReason('enterValue', 4);
      expect(result).toBe('Please answer Question 4 before proceeding');
    });

    it('returns "Please answer Question N before proceeding" for default reason with questionNumber', () => {
      const result = validationMessageForReason(undefined, 1);
      expect(result).toBe('Please answer Question 1 before proceeding');
    });

    it('does not prepend question number when questionNumber is 0 (falsy)', () => {
      const result = validationMessageForReason('allCompulsory', 0);
      expect(result).toBe(VALIDATION_ALL_COMPULSORY);
    });
  });
});
