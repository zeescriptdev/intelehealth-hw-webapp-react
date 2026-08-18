import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock MindmapPortalApi ──────────────────────────────────────────────────

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();
const mockDelete = vi.fn();

vi.mock('../../../../services/mindmap', () => ({
  MindmapPortalApi: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

import {
  upsertResource,
  upsertAssetResource,
  getResource,
  getChildResources,
  getPendingResources,
  bulkMarkSynced,
  deleteAssetResource,
  getDeletedAssetIds,
  clearDeletedAssetIds,
  markQuestionCommitted,
  unmarkQuestionCommitted,
  getCommittedQuestionIds,
  clearCommittedQuestionIds,
  TEMP_STORAGE_ENDPOINTS,
} from '../../../../modules/ayu/services/temp-storage.service';

// ── Tests ──────────────────────────────────────────────────────────────────

describe('temp-storage.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('TEMP_STORAGE_ENDPOINTS', () => {
    it('should have correct static paths', () => {
      expect(TEMP_STORAGE_ENDPOINTS.ROOT).toBe('/temp-storage');
      expect(TEMP_STORAGE_ENDPOINTS.UPLOAD).toBe('/temp-storage/upload');
      expect(TEMP_STORAGE_ENDPOINTS.PENDING).toBe('/temp-storage/pending');
      expect(TEMP_STORAGE_ENDPOINTS.SYNC).toBe('/temp-storage/sync');
    });

    it('should generate correct byResource path', () => {
      expect(TEMP_STORAGE_ENDPOINTS.byResource('visit', 'abc')).toBe('/temp-storage/visit/abc');
      expect(TEMP_STORAGE_ENDPOINTS.byResource('patient', 'xyz')).toBe('/temp-storage/patient/xyz');
    });

    it('should generate correct children path', () => {
      expect(TEMP_STORAGE_ENDPOINTS.children('visit', 'abc')).toBe('/temp-storage/visit/abc/children');
    });
  });

  describe('upsertResource', () => {
    it('should POST to /temp-storage with payload', async () => {
      const mockResponse = { success: true, data: { id: 1 } };
      mockPost.mockResolvedValue(mockResponse);

      const payload = {
        resource_type: 'visit' as const,
        resource_id: 'visit-123',
        data: { vitals: { height: 170 } },
        created_by: 'user-uuid',
      };

      const result = await upsertResource(payload);

      expect(mockPost).toHaveBeenCalledWith('/temp-storage', payload);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('upsertAssetResource', () => {
    it('should POST multipart FormData to /temp-storage/upload', async () => {
      const mockResponse = { success: true, data: { id: 2, file_path: 'https://s3.example.com/img.jpg' } };
      mockPost.mockResolvedValue(mockResponse);

      const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
      const meta = {
        resource_id: 'asset-1',
        parent_type: 'visit' as const,
        parent_id: 'visit-123',
        created_by: 'user-uuid',
        data: { questionId: 'q1' },
      };

      const result = await upsertAssetResource(file, meta);

      expect(mockPost).toHaveBeenCalledWith(
        '/temp-storage/upload',
        expect.any(FormData),
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      expect(result).toEqual(mockResponse);

      // Verify FormData contents
      const formData = mockPost.mock.calls[0][1] as FormData;
      expect(formData.get('file')).toBe(file);
      expect(formData.get('resource_type')).toBe('asset');
      expect(formData.get('resource_id')).toBe('asset-1');
      expect(formData.get('parent_type')).toBe('visit');
      expect(formData.get('parent_id')).toBe('visit-123');
      expect(formData.get('created_by')).toBe('user-uuid');
      expect(formData.get('data')).toBe(JSON.stringify({ questionId: 'q1' }));
    });

    it('should omit optional fields when not provided', async () => {
      mockPost.mockResolvedValue({ success: true, data: { id: 3 } });

      const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
      const meta = {
        resource_id: 'asset-2',
        created_by: 'user-uuid',
      };

      await upsertAssetResource(file, meta);

      const formData = mockPost.mock.calls[0][1] as FormData;
      expect(formData.get('parent_type')).toBeNull();
      expect(formData.get('parent_id')).toBeNull();
      expect(formData.get('data')).toBeNull();
    });
  });

  describe('getResource', () => {
    it('should GET /temp-storage/:type/:id', async () => {
      const mockResponse = { success: true, data: { id: 1, data: { vitals: {} } } };
      mockGet.mockResolvedValue(mockResponse);

      const result = await getResource('visit', 'visit-123');

      expect(mockGet).toHaveBeenCalledWith('/temp-storage/visit/visit-123');
      expect(result).toEqual(mockResponse);
    });

    it('should return fallback response on 404 error', async () => {
      const axiosError = { response: { status: 404 } };
      mockGet.mockRejectedValue(axiosError);

      const result = await getResource('patient', 'non-existent-id');

      expect(mockGet).toHaveBeenCalledWith('/temp-storage/patient/non-existent-id');
      expect(result).toEqual({
        success: false,
        message: 'Not found',
        data: null,
      });
    });

    it('should re-throw non-404 errors', async () => {
      const axiosError = { response: { status: 500 } };
      mockGet.mockRejectedValue(axiosError);

      await expect(getResource('visit', 'visit-123')).rejects.toEqual(axiosError);
    });

    it('should re-throw errors without response property', async () => {
      const networkError = new Error('Network Error');
      mockGet.mockRejectedValue(networkError);

      await expect(getResource('visit', 'visit-123')).rejects.toThrow('Network Error');
    });

    it('should re-throw when error is null', async () => {
      mockGet.mockRejectedValue(null);

      await expect(getResource('visit', 'visit-123')).rejects.toBeNull();
    });
  });

  describe('getChildResources', () => {
    it('should GET children without type filter', async () => {
      const mockResponse = { success: true, data: [] };
      mockGet.mockResolvedValue(mockResponse);

      await getChildResources('visit', 'visit-123');

      expect(mockGet).toHaveBeenCalledWith(
        '/temp-storage/visit/visit-123/children',
        { params: undefined }
      );
    });

    it('should GET children with type filter', async () => {
      const mockResponse = { success: true, data: [{ id: 1 }] };
      mockGet.mockResolvedValue(mockResponse);

      await getChildResources('visit', 'visit-123', 'asset');

      expect(mockGet).toHaveBeenCalledWith(
        '/temp-storage/visit/visit-123/children',
        { params: { type: 'asset' } }
      );
    });
  });

  describe('getPendingResources', () => {
    it('should GET /temp-storage/pending with query params', async () => {
      const mockResponse = { success: true, data: [] };
      mockGet.mockResolvedValue(mockResponse);

      await getPendingResources({ resourceType: 'visit', createdBy: 'user-1' });

      expect(mockGet).toHaveBeenCalledWith(
        '/temp-storage/pending',
        { params: { resourceType: 'visit', createdBy: 'user-1' } }
      );
    });

    it('should GET /temp-storage/pending with empty query', async () => {
      mockGet.mockResolvedValue({ success: true, data: [] });

      await getPendingResources();

      expect(mockGet).toHaveBeenCalledWith(
        '/temp-storage/pending',
        { params: {} }
      );
    });
  });

  describe('bulkMarkSynced', () => {
    it('should PATCH /temp-storage/sync with ids', async () => {
      const mockResponse = { success: true, data: { updatedCount: 2 } };
      mockPatch.mockResolvedValue(mockResponse);

      const result = await bulkMarkSynced([1, 2]);

      expect(mockPatch).toHaveBeenCalledWith('/temp-storage/sync', { ids: [1, 2] });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('deleteAssetResource', () => {
    it('should DELETE /temp-storage/:id and mark asset as deleted', async () => {
      mockDelete.mockResolvedValue({ success: true, data: null });

      const result = await deleteAssetResource(42);

      expect(mockDelete).toHaveBeenCalledWith('/temp-storage/42');
      expect(result).toEqual({ success: true, data: null });
      // Should be tracked as deleted
      expect(getDeletedAssetIds().has(42)).toBe(true);
    });

    it('should mark asset as deleted even before the API call resolves', () => {
      mockDelete.mockReturnValue(new Promise(() => {})); // never resolves

      deleteAssetResource(99);

      // Already tracked synchronously
      expect(getDeletedAssetIds().has(99)).toBe(true);
    });
  });

  describe('deleted-asset tracking (sessionStorage)', () => {
    beforeEach(() => {
      clearDeletedAssetIds();
    });

    it('should return empty set when no assets have been deleted', () => {
      expect(getDeletedAssetIds().size).toBe(0);
    });

    it('should track multiple deleted asset IDs', () => {
      mockDelete.mockResolvedValue({ success: true, data: null });

      deleteAssetResource(1);
      deleteAssetResource(2);
      deleteAssetResource(3);

      const ids = getDeletedAssetIds();
      expect(ids.size).toBe(3);
      expect(ids.has(1)).toBe(true);
      expect(ids.has(2)).toBe(true);
      expect(ids.has(3)).toBe(true);
    });

    it('should not duplicate IDs when the same asset is deleted twice', () => {
      mockDelete.mockResolvedValue({ success: true, data: null });

      deleteAssetResource(5);
      deleteAssetResource(5);

      expect(getDeletedAssetIds().size).toBe(1);
    });

    it('should clear all deleted asset IDs', () => {
      mockDelete.mockResolvedValue({ success: true, data: null });

      deleteAssetResource(10);
      deleteAssetResource(20);
      clearDeletedAssetIds();

      expect(getDeletedAssetIds().size).toBe(0);
    });

    it('should persist across calls (sessionStorage-backed)', () => {
      mockDelete.mockResolvedValue({ success: true, data: null });

      deleteAssetResource(7);

      // Reading again should return the same set
      const ids1 = getDeletedAssetIds();
      const ids2 = getDeletedAssetIds();
      expect(ids1.has(7)).toBe(true);
      expect(ids2.has(7)).toBe(true);
    });
  });

  describe('committed-question tracking (sessionStorage)', () => {
    beforeEach(() => {
      clearCommittedQuestionIds();
    });

    it('should return empty set when no questions have been committed', () => {
      expect(getCommittedQuestionIds().size).toBe(0);
    });

    it('should mark a question as committed', () => {
      markQuestionCommitted('q1');

      expect(getCommittedQuestionIds().has('q1')).toBe(true);
    });

    it('should track multiple committed question IDs', () => {
      markQuestionCommitted('q1');
      markQuestionCommitted('q2');
      markQuestionCommitted('q3');

      const ids = getCommittedQuestionIds();
      expect(ids.size).toBe(3);
      expect(ids.has('q1')).toBe(true);
      expect(ids.has('q2')).toBe(true);
      expect(ids.has('q3')).toBe(true);
    });

    it('should not duplicate IDs when the same question is committed twice', () => {
      markQuestionCommitted('q1');
      markQuestionCommitted('q1');

      expect(getCommittedQuestionIds().size).toBe(1);
    });

    it('should unmark a question as committed', () => {
      markQuestionCommitted('q1');
      markQuestionCommitted('q2');

      unmarkQuestionCommitted('q1');

      const ids = getCommittedQuestionIds();
      expect(ids.size).toBe(1);
      expect(ids.has('q1')).toBe(false);
      expect(ids.has('q2')).toBe(true);
    });

    it('should handle unmarking a question that was never committed', () => {
      unmarkQuestionCommitted('nonexistent');

      expect(getCommittedQuestionIds().size).toBe(0);
    });

    it('should clear all committed question IDs', () => {
      markQuestionCommitted('q1');
      markQuestionCommitted('q2');
      clearCommittedQuestionIds();

      expect(getCommittedQuestionIds().size).toBe(0);
    });

    it('should persist across calls (sessionStorage-backed)', () => {
      markQuestionCommitted('q5');

      const ids1 = getCommittedQuestionIds();
      const ids2 = getCommittedQuestionIds();
      expect(ids1.has('q5')).toBe(true);
      expect(ids2.has('q5')).toBe(true);
    });
  });

  describe('sessionStorage error handling', () => {
    beforeEach(() => {
      clearCommittedQuestionIds();
      clearDeletedAssetIds();
    });

    it('getCommittedQuestionIds returns empty set when sessionStorage.getItem throws', () => {
      const spy = vi.spyOn(sessionStorage, 'getItem').mockImplementation(() => {
        throw new Error('storage error');
      });
      expect(getCommittedQuestionIds().size).toBe(0);
      spy.mockRestore();
    });

    it('clearCommittedQuestionIds does not throw when sessionStorage.removeItem throws', () => {
      const spy = vi.spyOn(sessionStorage, 'removeItem').mockImplementation(() => {
        throw new Error('storage error');
      });
      expect(() => clearCommittedQuestionIds()).not.toThrow();
      spy.mockRestore();
    });

    it('unmarkQuestionCommitted does not throw when sessionStorage.setItem throws', () => {
      markQuestionCommitted('q1');
      const spy = vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => {
        throw new Error('storage full');
      });
      expect(() => unmarkQuestionCommitted('q1')).not.toThrow();
      spy.mockRestore();
    });

    it('markQuestionCommitted does not throw when sessionStorage.setItem throws', () => {
      const spy = vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => {
        throw new Error('storage full');
      });
      expect(() => markQuestionCommitted('q1')).not.toThrow();
      spy.mockRestore();
    });

    it('getDeletedAssetIds returns empty set when sessionStorage.getItem throws', () => {
      const spy = vi.spyOn(sessionStorage, 'getItem').mockImplementation(() => {
        throw new Error('storage error');
      });
      expect(getDeletedAssetIds().size).toBe(0);
      spy.mockRestore();
    });

    it('clearDeletedAssetIds does not throw when sessionStorage.removeItem throws', () => {
      const spy = vi.spyOn(sessionStorage, 'removeItem').mockImplementation(() => {
        throw new Error('storage error');
      });
      expect(() => clearDeletedAssetIds()).not.toThrow();
      spy.mockRestore();
    });

    it('deleteAssetResource does not throw when sessionStorage.setItem throws', () => {
      mockDelete.mockResolvedValue({ success: true, data: null });
      const spy = vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => {
        throw new Error('storage full');
      });
      expect(() => deleteAssetResource(100)).not.toThrow();
      spy.mockRestore();
    });
  });
});
