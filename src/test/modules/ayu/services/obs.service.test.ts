import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../services/openmrs', () => ({
  OpenMRSApi: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { OpenMRSApi } from '../../../../services/openmrs';
import {
  addPendingImage,
  clearPendingImages,
  getPendingImages,
  getObsByPatientAndConcept,
  removePendingImage,
  removePendingImagesByQuestionId,
  uploadAllPhysicalExamImages,
  addPendingDocument,
  clearPendingDocuments,
  getPendingDocuments,
  removePendingDocument,
  uploadAllAdditionalDocuments,
  getLatestEncounterUuid,
  getLatestVisitUuid,
} from '../../../../modules/ayu/services/obs.service';
import { OBS_CONCEPTS } from '../../../../modules/ayu/types/obs.types';

const mockPost = vi.mocked(OpenMRSApi.post);
const mockGet = vi.mocked(OpenMRSApi.get);

describe('obs.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearPendingImages();
    clearPendingDocuments();
  });

  // ── Pending image queue ─────────────────────────────────────────────────

  describe('pending image queue', () => {
    it('should start with empty queue', () => {
      expect(getPendingImages()).toHaveLength(0);
    });

    it('should add images to queue', () => {
      const file = new File(['test'], 'photo.png', { type: 'image/png' });
      addPendingImage(file, 'General exams');

      expect(getPendingImages()).toHaveLength(1);
      expect(getPendingImages()[0].file).toBe(file);
      expect(getPendingImages()[0].comment).toBe('General exams');
    });

    it('should add multiple images to queue', () => {
      const file1 = new File(['test1'], 'photo1.png', { type: 'image/png' });
      const file2 = new File(['test2'], 'photo2.png', { type: 'image/png' });

      addPendingImage(file1, 'General exams');
      addPendingImage(file2, 'Head');

      expect(getPendingImages()).toHaveLength(2);
    });

    it('should remove image at given index', () => {
      const file1 = new File(['test1'], 'photo1.png', { type: 'image/png' });
      const file2 = new File(['test2'], 'photo2.png', { type: 'image/png' });

      addPendingImage(file1, 'General exams');
      addPendingImage(file2, 'Head');

      removePendingImage(0);

      expect(getPendingImages()).toHaveLength(1);
      expect(getPendingImages()[0].comment).toBe('Head');
    });

    it('should store questionId when provided', () => {
      const file = new File(['test'], 'photo.png', { type: 'image/png' });
      addPendingImage(file, 'General exams', 'q1');

      expect(getPendingImages()[0].questionId).toBe('q1');
    });

    it('should leave questionId undefined when not provided', () => {
      const file = new File(['test'], 'photo.png', { type: 'image/png' });
      addPendingImage(file, 'General exams');

      expect(getPendingImages()[0].questionId).toBeUndefined();
    });

    it('should remove images by questionId', () => {
      const file1 = new File(['test1'], 'photo1.png', { type: 'image/png' });
      const file2 = new File(['test2'], 'photo2.png', { type: 'image/png' });
      const file3 = new File(['test3'], 'photo3.png', { type: 'image/png' });

      addPendingImage(file1, 'General exams', 'q1');
      addPendingImage(file2, 'Head', 'q2');
      addPendingImage(file3, 'Eyes', 'q1');

      removePendingImagesByQuestionId('q1');

      expect(getPendingImages()).toHaveLength(1);
      expect(getPendingImages()[0].comment).toBe('Head');
      expect(getPendingImages()[0].questionId).toBe('q2');
    });

    it('should not remove images without a matching questionId', () => {
      const file1 = new File(['test1'], 'photo1.png', { type: 'image/png' });
      const file2 = new File(['test2'], 'photo2.png', { type: 'image/png' });

      addPendingImage(file1, 'General exams');
      addPendingImage(file2, 'Head', 'q2');

      removePendingImagesByQuestionId('q1');

      // Neither removed: file1 has no questionId, file2 has 'q2'
      expect(getPendingImages()).toHaveLength(2);
    });

    it('should handle removePendingImagesByQuestionId on empty queue', () => {
      removePendingImagesByQuestionId('q1');
      expect(getPendingImages()).toHaveLength(0);
    });

    it('should clear all pending images', () => {
      const file = new File(['test'], 'photo.png', { type: 'image/png' });
      addPendingImage(file, 'General exams');
      addPendingImage(file, 'Head');

      clearPendingImages();

      expect(getPendingImages()).toHaveLength(0);
    });
  });

  // ── uploadAllPhysicalExamImages ────────────────────────────────────────

  describe('uploadAllPhysicalExamImages', () => {
    it('should do nothing when no pending images', async () => {
      await uploadAllPhysicalExamImages('enc-uuid', 'patient-uuid');
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('should upload each pending image via POST /obs with FormData', async () => {
      const file = new File(['test'], 'photo.png', { type: 'image/png' });
      addPendingImage(file, 'General exams');

      mockPost.mockResolvedValue({});

      await uploadAllPhysicalExamImages('enc-uuid', 'patient-uuid');

      expect(mockPost).toHaveBeenCalledTimes(1);
      const [endpoint, formData] = mockPost.mock.calls[0];
      expect(endpoint).toBe('/obs');
      expect(formData).toBeInstanceOf(FormData);
    });

    it('should include correct JSON metadata in FormData', async () => {
      const file = new File(['test'], 'photo.png', { type: 'image/png' });
      addPendingImage(file, 'General exams');

      mockPost.mockResolvedValue({});

      await uploadAllPhysicalExamImages('enc-uuid', 'patient-uuid');

      const formData = mockPost.mock.calls[0][1] as FormData;
      const jsonString = formData.get('json') as string;
      const json = JSON.parse(jsonString);

      expect(json.concept).toBe(OBS_CONCEPTS.PHYSICAL_EXAMINATION);
      expect(json.encounter).toBe('enc-uuid');
      expect(json.person).toBe('patient-uuid');
      expect(json.comment).toBe('General exams');
      expect(json.obsDatetime).toBeDefined();
    });

    it('should include file in FormData', async () => {
      const file = new File(['test'], 'photo.png', { type: 'image/png' });
      addPendingImage(file, 'General exams');

      mockPost.mockResolvedValue({});

      await uploadAllPhysicalExamImages('enc-uuid', 'patient-uuid');

      const formData = mockPost.mock.calls[0][1] as FormData;
      expect(formData.get('file')).toBe(file);
    });

    it('should upload multiple images in parallel', async () => {
      const file1 = new File(['test1'], 'photo1.png', { type: 'image/png' });
      const file2 = new File(['test2'], 'photo2.png', { type: 'image/png' });

      addPendingImage(file1, 'General exams');
      addPendingImage(file2, 'Head');

      mockPost.mockResolvedValue({});

      await uploadAllPhysicalExamImages('enc-uuid', 'patient-uuid');

      expect(mockPost).toHaveBeenCalledTimes(2);
    });

    it('should clear pending images after successful upload', async () => {
      const file = new File(['test'], 'photo.png', { type: 'image/png' });
      addPendingImage(file, 'General exams');

      mockPost.mockResolvedValue({});

      await uploadAllPhysicalExamImages('enc-uuid', 'patient-uuid');

      expect(getPendingImages()).toHaveLength(0);
    });

    it('should reject when an upload fails', async () => {
      const file = new File(['test'], 'photo.png', { type: 'image/png' });
      addPendingImage(file, 'General exams');

      mockPost.mockRejectedValue(new Error('Network error'));

      await expect(
        uploadAllPhysicalExamImages('enc-uuid', 'patient-uuid')
      ).rejects.toThrow('Network error');
    });
  });

  // ── getObsByPatientAndConcept ──────────────────────────────────────────

  describe('getObsByPatientAndConcept', () => {
    it('should call GET /obs with correct query params', async () => {
      const mockResponse = { results: [] };
      mockGet.mockResolvedValue(mockResponse);

      const result = await getObsByPatientAndConcept(
        'patient-uuid',
        'concept-uuid'
      );

      expect(mockGet).toHaveBeenCalledWith(
        '/obs?patient=patient-uuid&v=custom:(uuid,comment,value,encounter:(visit:(uuid)))&concept=concept-uuid'
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle API errors', async () => {
      mockGet.mockRejectedValue(new Error('Not found'));

      await expect(
        getObsByPatientAndConcept('patient-uuid', 'concept-uuid')
      ).rejects.toThrow('Not found');
    });
  });

  // ── Pending document queue ──────────────────────────────────────────────

  describe('pending document queue', () => {
    it('should start with empty queue', () => {
      expect(getPendingDocuments()).toHaveLength(0);
    });

    it('should add documents to queue', () => {
      const file = new File(['doc'], 'report.pdf', {
        type: 'application/pdf',
      });
      addPendingDocument(file, 'Lab report');

      expect(getPendingDocuments()).toHaveLength(1);
      expect(getPendingDocuments()[0].file).toBe(file);
      expect(getPendingDocuments()[0].comment).toBe('Lab report');
    });

    it('should add multiple documents to queue', () => {
      const file1 = new File(['doc1'], 'report1.pdf', {
        type: 'application/pdf',
      });
      const file2 = new File(['doc2'], 'report2.pdf', {
        type: 'application/pdf',
      });

      addPendingDocument(file1, 'Lab report');
      addPendingDocument(file2, 'X-ray');

      expect(getPendingDocuments()).toHaveLength(2);
    });

    it('should remove document at given index', () => {
      const file1 = new File(['doc1'], 'report1.pdf', {
        type: 'application/pdf',
      });
      const file2 = new File(['doc2'], 'report2.pdf', {
        type: 'application/pdf',
      });

      addPendingDocument(file1, 'Lab report');
      addPendingDocument(file2, 'X-ray');

      removePendingDocument(0);

      expect(getPendingDocuments()).toHaveLength(1);
      expect(getPendingDocuments()[0].comment).toBe('X-ray');
    });

    it('should clear all pending documents', () => {
      const file = new File(['doc'], 'report.pdf', {
        type: 'application/pdf',
      });
      addPendingDocument(file, 'Lab report');
      addPendingDocument(file, 'X-ray');

      clearPendingDocuments();

      expect(getPendingDocuments()).toHaveLength(0);
    });
  });

  // ── uploadAllAdditionalDocuments ────────────────────────────────────────

  describe('uploadAllAdditionalDocuments', () => {
    it('should do nothing when no pending documents', async () => {
      await uploadAllAdditionalDocuments('enc-uuid', 'patient-uuid');
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('should upload each pending document via POST /obs with FormData', async () => {
      const file = new File(['doc'], 'report.pdf', {
        type: 'application/pdf',
      });
      addPendingDocument(file, 'Lab report');

      mockPost.mockResolvedValue({});

      await uploadAllAdditionalDocuments('enc-uuid', 'patient-uuid');

      expect(mockPost).toHaveBeenCalledTimes(1);
      const [endpoint, formData] = mockPost.mock.calls[0];
      expect(endpoint).toBe('/obs');
      expect(formData).toBeInstanceOf(FormData);
    });

    it('should include correct JSON metadata in FormData', async () => {
      const file = new File(['doc'], 'report.pdf', {
        type: 'application/pdf',
      });
      addPendingDocument(file, 'Lab report');

      mockPost.mockResolvedValue({});

      await uploadAllAdditionalDocuments('enc-uuid', 'patient-uuid');

      const formData = mockPost.mock.calls[0][1] as FormData;
      const jsonString = formData.get('json') as string;
      const json = JSON.parse(jsonString);

      expect(json.concept).toBe(OBS_CONCEPTS.ADDITIONAL_DOCUMENT);
      expect(json.encounter).toBe('enc-uuid');
      expect(json.person).toBe('patient-uuid');
      expect(json.comment).toBe('Lab report');
      expect(json.obsDatetime).toBeDefined();
    });

    it('should include file in FormData', async () => {
      const file = new File(['doc'], 'report.pdf', {
        type: 'application/pdf',
      });
      addPendingDocument(file, 'Lab report');

      mockPost.mockResolvedValue({});

      await uploadAllAdditionalDocuments('enc-uuid', 'patient-uuid');

      const formData = mockPost.mock.calls[0][1] as FormData;
      expect(formData.get('file')).toBe(file);
    });

    it('should upload multiple documents in parallel', async () => {
      const file1 = new File(['doc1'], 'report1.pdf', {
        type: 'application/pdf',
      });
      const file2 = new File(['doc2'], 'report2.pdf', {
        type: 'application/pdf',
      });

      addPendingDocument(file1, 'Lab report');
      addPendingDocument(file2, 'X-ray');

      mockPost.mockResolvedValue({});

      await uploadAllAdditionalDocuments('enc-uuid', 'patient-uuid');

      expect(mockPost).toHaveBeenCalledTimes(2);
    });

    it('should clear pending documents after successful upload', async () => {
      const file = new File(['doc'], 'report.pdf', {
        type: 'application/pdf',
      });
      addPendingDocument(file, 'Lab report');

      mockPost.mockResolvedValue({});

      await uploadAllAdditionalDocuments('enc-uuid', 'patient-uuid');

      expect(getPendingDocuments()).toHaveLength(0);
    });

    it('should not reject when an individual upload fails', async () => {
      const file = new File(['doc'], 'report.png', {
        type: 'image/png',
      });
      addPendingDocument(file, 'Lab report');

      mockPost.mockRejectedValue(new Error('Network error'));

      await expect(
        uploadAllAdditionalDocuments('enc-uuid', 'patient-uuid')
      ).resolves.toBeUndefined();
      expect(getPendingDocuments()).toHaveLength(0);
    });

    it('should omit encounter from JSON when encounterUuid is undefined', async () => {
      const file = new File(['doc'], 'report.pdf', {
        type: 'application/pdf',
      });
      addPendingDocument(file, 'Lab report');

      mockPost.mockResolvedValue({});

      await uploadAllAdditionalDocuments(undefined, 'patient-uuid');

      const formData = mockPost.mock.calls[0][1] as FormData;
      const jsonString = formData.get('json') as string;
      const json = JSON.parse(jsonString);

      expect(json.encounter).toBeUndefined();
      expect(json.person).toBe('patient-uuid');
      expect(json.concept).toBe(OBS_CONCEPTS.ADDITIONAL_DOCUMENT);
    });

    it('should include encounter in JSON when encounterUuid is provided', async () => {
      const file = new File(['doc'], 'report.pdf', {
        type: 'application/pdf',
      });
      addPendingDocument(file, 'Lab report');

      mockPost.mockResolvedValue({});

      await uploadAllAdditionalDocuments('enc-uuid', 'patient-uuid');

      const formData = mockPost.mock.calls[0][1] as FormData;
      const jsonString = formData.get('json') as string;
      const json = JSON.parse(jsonString);

      expect(json.encounter).toBe('enc-uuid');
    });
  });

  // ── getLatestEncounterUuid ────────────────────────────────────────────

  describe('getLatestEncounterUuid', () => {
    it('should call GET /visit with correct query params', async () => {
      mockGet.mockResolvedValue({
        results: [
          {
            encounters: [
              { uuid: 'enc-1', encounterType: { uuid: 'type-a' } },
              { uuid: 'enc-2', encounterType: { uuid: 'type-b' } },
            ],
          },
        ],
      });

      const result = await getLatestEncounterUuid('patient-uuid', 'type-b');

      expect(mockGet).toHaveBeenCalledWith(
        '/visit?patient=patient-uuid&v=custom:(encounters:(uuid,encounterType:(uuid)))&limit=1&order=desc'
      );
      expect(result).toBe('enc-2');
    });

    it('should return matching encounter UUID', async () => {
      mockGet.mockResolvedValue({
        results: [
          {
            encounters: [
              { uuid: 'enc-1', encounterType: { uuid: 'type-a' } },
              { uuid: 'enc-2', encounterType: { uuid: 'type-b' } },
            ],
          },
        ],
      });

      const result = await getLatestEncounterUuid('patient-uuid', 'type-a');
      expect(result).toBe('enc-1');
    });

    it('should return undefined when no visit found', async () => {
      mockGet.mockResolvedValue({ results: [] });

      const result = await getLatestEncounterUuid('patient-uuid', 'type-a');
      expect(result).toBeUndefined();
    });

    it('should return undefined when results is undefined', async () => {
      mockGet.mockResolvedValue({});

      const result = await getLatestEncounterUuid('patient-uuid', 'type-a');
      expect(result).toBeUndefined();
    });

    it('should return undefined when no matching encounter type found', async () => {
      mockGet.mockResolvedValue({
        results: [
          {
            encounters: [
              { uuid: 'enc-1', encounterType: { uuid: 'type-a' } },
            ],
          },
        ],
      });

      const result = await getLatestEncounterUuid('patient-uuid', 'type-z');
      expect(result).toBeUndefined();
    });

    it('should return undefined when encounters array is empty', async () => {
      mockGet.mockResolvedValue({
        results: [{ encounters: [] }],
      });

      const result = await getLatestEncounterUuid('patient-uuid', 'type-a');
      expect(result).toBeUndefined();
    });

    it('should propagate API errors', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));

      await expect(
        getLatestEncounterUuid('patient-uuid', 'type-a')
      ).rejects.toThrow('Network error');
    });
  });

  // ── getLatestVisitUuid ──────────────────────────────────────────────

  describe('getLatestVisitUuid', () => {
    it('should call GET /visit with correct query params', async () => {
      mockGet.mockResolvedValue({
        results: [{ uuid: 'visit-uuid-1' }],
      });

      const result = await getLatestVisitUuid('patient-uuid');

      expect(mockGet).toHaveBeenCalledWith(
        '/visit?patient=patient-uuid&v=custom:(uuid)&limit=1&order=desc'
      );
      expect(result).toBe('visit-uuid-1');
    });

    it('should return undefined when no visit found', async () => {
      mockGet.mockResolvedValue({ results: [] });

      const result = await getLatestVisitUuid('patient-uuid');
      expect(result).toBeUndefined();
    });

    it('should return undefined when results is undefined', async () => {
      mockGet.mockResolvedValue({});

      const result = await getLatestVisitUuid('patient-uuid');
      expect(result).toBeUndefined();
    });

    it('should propagate API errors', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));

      await expect(
        getLatestVisitUuid('patient-uuid')
      ).rejects.toThrow('Network error');
    });
  });
});
