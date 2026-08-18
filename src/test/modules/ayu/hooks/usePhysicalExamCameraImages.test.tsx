import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usePhysicalExamCameraImages } from '../../../../modules/ayu/hooks/usePhysicalExamCameraImages';

const addPendingImage = vi.fn();
const removePendingImagesByQuestionId = vi.fn();
const getChildResources = vi.fn();
const upsertAssetResource = vi.fn();
const deleteAssetResource = vi.fn().mockResolvedValue(undefined);
const markQuestionCommitted = vi.fn();
const unmarkQuestionCommitted = vi.fn();
const getDeletedAssetIds = vi.fn().mockReturnValue(new Set<number>());
const getUser = vi.fn();

vi.mock('../../../../modules/ayu/services/obs.service', () => ({
  addPendingImage: (...args: unknown[]) => addPendingImage(...args),
  removePendingImagesByQuestionId: (...args: unknown[]) =>
    removePendingImagesByQuestionId(...args),
}));

vi.mock('../../../../modules/ayu/services/temp-storage.service', () => ({
  getChildResources: (...args: unknown[]) => getChildResources(...args),
  upsertAssetResource: (...args: unknown[]) => upsertAssetResource(...args),
  deleteAssetResource: (...args: unknown[]) => deleteAssetResource(...args),
  markQuestionCommitted: (...args: unknown[]) =>
    markQuestionCommitted(...args),
  unmarkQuestionCommitted: (...args: unknown[]) =>
    unmarkQuestionCommitted(...args),
  getDeletedAssetIds: (...args: unknown[]) => getDeletedAssetIds(...args),
}));

vi.mock('../../../../utils/storage', () => ({
  storage: { getUser: () => getUser() },
}));

const sectionCommentFor = vi.fn((qId: string) => `Section for ${qId}`);

let blobCounter = 0;

beforeEach(() => {
  addPendingImage.mockReset();
  removePendingImagesByQuestionId.mockReset();
  getChildResources.mockReset();
  upsertAssetResource.mockReset();
  deleteAssetResource.mockReset().mockResolvedValue(undefined);
  markQuestionCommitted.mockReset();
  unmarkQuestionCommitted.mockReset();
  getDeletedAssetIds.mockReset().mockReturnValue(new Set<number>());
  getUser.mockReset();
  sectionCommentFor.mockClear();
  blobCounter = 0;
  globalThis.URL.createObjectURL = vi.fn(() => `blob:mock-${++blobCounter}`);
  globalThis.URL.revokeObjectURL = vi.fn();
});

describe('usePhysicalExamCameraImages', () => {
  describe('restore on mount', () => {
    it('does nothing when visitId is null', () => {
      renderHook(() =>
        usePhysicalExamCameraImages({ visitId: null, sectionCommentFor })
      );
      expect(getChildResources).not.toHaveBeenCalled();
    });

    it('does nothing when visitId is an empty string', () => {
      renderHook(() =>
        usePhysicalExamCameraImages({ visitId: '', sectionCommentFor })
      );
      expect(getChildResources).not.toHaveBeenCalled();
    });

    it('rebuilds cameraImages from temp-storage asset records', async () => {
      getChildResources.mockResolvedValue({
        data: [
          {
            id: 11,
            file_path: 'http://cdn/a.png',
            data: { questionId: 'q1' },
          },
          {
            id: 12,
            file_path: 'http://cdn/b.png',
            data: { questionId: 'q1' },
          },
          // record missing file_path → skipped
          { id: 13, file_path: null, data: { questionId: 'q1' } },
          // record missing questionId → skipped
          { id: 14, file_path: 'http://cdn/c.png', data: {} },
        ],
      });
      const { result } = renderHook(() =>
        usePhysicalExamCameraImages({ visitId: 'visit-1', sectionCommentFor })
      );
      await waitFor(() =>
        expect(result.current.cameraImagesFor('q1')).toEqual([
          'http://cdn/a.png',
          'http://cdn/b.png',
        ])
      );
    });

    it('does nothing when temp-storage returns an empty list', async () => {
      getChildResources.mockResolvedValue({ data: [] });
      const { result } = renderHook(() =>
        usePhysicalExamCameraImages({ visitId: 'visit-1', sectionCommentFor })
      );
      await waitFor(() => expect(getChildResources).toHaveBeenCalled());
      expect(result.current.cameraImagesFor('q1')).toEqual([]);
    });

    it('does nothing when every record is filtered out by missing fields', async () => {
      getChildResources.mockResolvedValue({
        data: [{ id: 1, file_path: null, data: {} }],
      });
      const { result } = renderHook(() =>
        usePhysicalExamCameraImages({ visitId: 'visit-1', sectionCommentFor })
      );
      await waitFor(() => expect(getChildResources).toHaveBeenCalled());
      expect(result.current.cameraImagesFor('q1')).toEqual([]);
    });

    it('filters out assets that are in the deleted-asset set', async () => {
      getDeletedAssetIds.mockReturnValue(new Set([11]));
      getChildResources.mockResolvedValue({
        data: [
          { id: 11, file_path: 'http://cdn/a.png', data: { questionId: 'q1' } },
          { id: 12, file_path: 'http://cdn/b.png', data: { questionId: 'q1' } },
        ],
      });
      const { result } = renderHook(() =>
        usePhysicalExamCameraImages({ visitId: 'visit-1', sectionCommentFor })
      );
      await waitFor(() =>
        expect(result.current.cameraImagesFor('q1')).toEqual([
          'http://cdn/b.png',
        ])
      );
    });

    it('logs error and re-throws when temp-storage fails', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      getChildResources.mockRejectedValue(new Error('boom'));
      const { result } = renderHook(() =>
        usePhysicalExamCameraImages({ visitId: 'visit-1', sectionCommentFor })
      );
      await waitFor(() => expect(getChildResources).toHaveBeenCalled());
      expect(result.current.cameraImagesFor('q1')).toEqual([]);
      await waitFor(() =>
        expect(errorSpy).toHaveBeenCalledWith(
          'Failed to restore camera images from temp storage',
          expect.any(Error)
        )
      );
      errorSpy.mockRestore();
    });
  });

  describe('addCameraImage', () => {
    it('stores locally and does not upload when visitId is missing', async () => {
      const { result } = renderHook(() =>
        usePhysicalExamCameraImages({ visitId: null, sectionCommentFor })
      );
      const file = new File(['a'], 'a.png');
      await act(async () => {
        await result.current.addCameraImage('q1', file);
      });
      // addCameraImage no longer calls addPendingImage — that happens on commitQuestionImages
      expect(addPendingImage).not.toHaveBeenCalled();
      expect(upsertAssetResource).not.toHaveBeenCalled();
      // Preview is from URL.createObjectURL
      expect(result.current.cameraImagesFor('q1')).toEqual([
        'blob:mock-1',
      ]);
    });

    it('uploads via upsertAssetResource and stores assetRecordId when visitId is present', async () => {
      getChildResources.mockResolvedValue({ data: [] });
      getUser.mockReturnValue(JSON.stringify({ uuid: 'user-uuid' }));
      upsertAssetResource.mockResolvedValue({ data: { id: 99 } });

      const { result } = renderHook(() =>
        usePhysicalExamCameraImages({ visitId: 'visit-1', sectionCommentFor })
      );
      await act(async () => {
        await result.current.addCameraImage('q1', new File(['a'], 'a.png'));
      });

      expect(upsertAssetResource).toHaveBeenCalledTimes(1);
      const meta = upsertAssetResource.mock.calls[0][1];
      expect(meta).toMatchObject({
        parent_type: 'visit',
        parent_id: 'visit-1',
        created_by: 'user-uuid',
        data: { questionId: 'q1', comment: 'Section for q1' },
      });
      // Preview is from URL.createObjectURL
      expect(result.current.cameraImagesFor('q1')).toEqual([
        'blob:mock-1',
      ]);
    });

    it('uses "unknown" when getUser returns invalid JSON', async () => {
      getChildResources.mockResolvedValue({ data: [] });
      getUser.mockReturnValue('not-json');
      upsertAssetResource.mockResolvedValue({ data: { id: 1 } });

      const { result } = renderHook(() =>
        usePhysicalExamCameraImages({ visitId: 'visit-1', sectionCommentFor })
      );
      await act(async () => {
        await result.current.addCameraImage('q1', new File(['a'], 'a.png'));
      });
      expect(upsertAssetResource.mock.calls[0][1].created_by).toBe('unknown');
    });

    it('falls back to the raw string when getUser returns JSON without a uuid', async () => {
      getChildResources.mockResolvedValue({ data: [] });
      const raw = JSON.stringify({ name: 'Akki' });
      getUser.mockReturnValue(raw);
      upsertAssetResource.mockResolvedValue({ data: { id: 1 } });

      const { result } = renderHook(() =>
        usePhysicalExamCameraImages({ visitId: 'visit-1', sectionCommentFor })
      );
      await act(async () => {
        await result.current.addCameraImage('q1', new File(['a'], 'a.png'));
      });
      expect(upsertAssetResource.mock.calls[0][1].created_by).toBe(raw);
    });

    it('uses "unknown" when getUser returns null', async () => {
      getChildResources.mockResolvedValue({ data: [] });
      getUser.mockReturnValue(null);
      upsertAssetResource.mockResolvedValue({ data: { id: 1 } });

      const { result } = renderHook(() =>
        usePhysicalExamCameraImages({ visitId: 'visit-1', sectionCommentFor })
      );
      await act(async () => {
        await result.current.addCameraImage('q1', new File(['a'], 'a.png'));
      });
      expect(upsertAssetResource.mock.calls[0][1].created_by).toBe('unknown');
    });

    it('logs error when the upload fails', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      getChildResources.mockResolvedValue({ data: [] });
      getUser.mockReturnValue(null);
      upsertAssetResource.mockRejectedValue(new Error('upload failed'));

      const { result } = renderHook(() =>
        usePhysicalExamCameraImages({ visitId: 'visit-1', sectionCommentFor })
      );
      await act(async () => {
        await result.current.addCameraImage('q1', new File(['a'], 'a.png'));
      });
      expect(result.current.cameraImagesFor('q1')).toEqual([
        'blob:mock-1',
      ]);
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to upload camera image to temp storage',
        expect.any(Error)
      );
      errorSpy.mockRestore();
    });
  });

  describe('removeCameraImage', () => {
    it('removes the image at the given index and clears pending images for the question', async () => {
      getChildResources.mockResolvedValue({ data: [] });
      getUser.mockReturnValue(null);
      upsertAssetResource.mockResolvedValue({ data: { id: 1 } });

      const { result } = renderHook(() =>
        usePhysicalExamCameraImages({ visitId: 'visit-1', sectionCommentFor })
      );

      await act(async () => {
        await result.current.addCameraImage('q1', new File(['a'], 'a.png'));
        await result.current.addCameraImage('q1', new File(['b'], 'b.png'));
      });

      act(() => {
        result.current.removeCameraImage('q1', 1);
      });
      // Uses removePendingImagesByQuestionId instead of flat index
      expect(removePendingImagesByQuestionId).toHaveBeenCalledWith('q1');
      expect(result.current.cameraImagesFor('q1')).toHaveLength(1);
    });

    it('deletes the asset record when the removed image has an assetRecordId', async () => {
      getChildResources.mockResolvedValue({
        data: [
          { id: 42, file_path: 'http://cdn/a.png', data: { questionId: 'q1' } },
        ],
      });
      const { result } = renderHook(() =>
        usePhysicalExamCameraImages({ visitId: 'visit-1', sectionCommentFor })
      );
      await waitFor(() =>
        expect(result.current.cameraImagesFor('q1').length).toBe(1)
      );
      act(() => result.current.removeCameraImage('q1', 0));
      expect(deleteAssetResource).toHaveBeenCalledWith(42);
      expect(result.current.cameraImagesFor('q1')).toEqual([]);
    });

    it('handles removing from a question with no images gracefully', () => {
      getChildResources.mockResolvedValue({ data: [] });
      const { result } = renderHook(() =>
        usePhysicalExamCameraImages({ visitId: 'visit-1', sectionCommentFor })
      );
      act(() => result.current.removeCameraImage('nonexistent', 0));
      expect(removePendingImagesByQuestionId).toHaveBeenCalledWith('nonexistent');
      expect(result.current.cameraImagesFor('nonexistent')).toEqual([]);
    });

    it('unmarks the question as committed when all images are removed', async () => {
      getChildResources.mockResolvedValue({ data: [] });
      getUser.mockReturnValue(null);
      upsertAssetResource.mockResolvedValue({ data: { id: 1 } });

      const { result } = renderHook(() =>
        usePhysicalExamCameraImages({ visitId: 'visit-1', sectionCommentFor })
      );

      await act(async () => {
        await result.current.addCameraImage('q1', new File(['a'], 'a.png'));
      });

      act(() => result.current.removeCameraImage('q1', 0));
      expect(unmarkQuestionCommitted).toHaveBeenCalledWith('q1');
    });
  });

  describe('restore-once guard', () => {
    it('does not re-fetch from temp-storage when visitId changes after the first restore', async () => {
      getChildResources.mockResolvedValue({ data: [] });
      const { rerender } = renderHook(
        ({ visitId }) =>
          usePhysicalExamCameraImages({ visitId, sectionCommentFor }),
        { initialProps: { visitId: 'visit-1' as string | null } }
      );
      await waitFor(() => expect(getChildResources).toHaveBeenCalledTimes(1));

      rerender({ visitId: 'visit-2' });
      expect(getChildResources).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearCameraImages', () => {
    it('clears the question images and removes from pending queue by questionId', async () => {
      getChildResources.mockResolvedValue({ data: [] });
      getUser.mockReturnValue(null);
      upsertAssetResource.mockResolvedValue({ data: { id: 1 } });

      const { result } = renderHook(() =>
        usePhysicalExamCameraImages({ visitId: 'visit-1', sectionCommentFor })
      );
      await act(async () => {
        await result.current.addCameraImage('q1', new File(['a'], 'a.png'));
        await result.current.addCameraImage('q2', new File(['b'], 'b.png'));
      });

      act(() => result.current.clearCameraImages('q1'));

      expect(removePendingImagesByQuestionId).toHaveBeenCalledWith('q1');
      expect(unmarkQuestionCommitted).toHaveBeenCalledWith('q1');
      expect(result.current.cameraImagesFor('q1')).toEqual([]);
      // q2 is untouched
      expect(result.current.cameraImagesFor('q2')).toHaveLength(1);
    });

    it('handles clearing a question with no images gracefully', () => {
      getChildResources.mockResolvedValue({ data: [] });
      const { result } = renderHook(() =>
        usePhysicalExamCameraImages({ visitId: 'visit-1', sectionCommentFor })
      );
      act(() => result.current.clearCameraImages('nonexistent'));
      expect(removePendingImagesByQuestionId).toHaveBeenCalledWith('nonexistent');
      expect(unmarkQuestionCommitted).toHaveBeenCalledWith('nonexistent');
      expect(deleteAssetResource).not.toHaveBeenCalled();
    });

    it('deletes asset records for restored images when clearing', async () => {
      getChildResources.mockResolvedValue({
        data: [
          { id: 5, file_path: 'http://cdn/a.png', data: { questionId: 'q1' } },
        ],
      });
      const { result } = renderHook(() =>
        usePhysicalExamCameraImages({ visitId: 'visit-1', sectionCommentFor })
      );
      await waitFor(() =>
        expect(result.current.cameraImagesFor('q1').length).toBe(1)
      );

      act(() => result.current.clearCameraImages('q1'));
      expect(deleteAssetResource).toHaveBeenCalledWith(5);
      expect(result.current.cameraImagesFor('q1')).toEqual([]);
    });
  });

  describe('commitQuestionImages', () => {
    it('moves captured files from internal store to the pending queue', async () => {
      getChildResources.mockResolvedValue({ data: [] });
      getUser.mockReturnValue(null);
      upsertAssetResource.mockResolvedValue({ data: { id: 1 } });

      const { result } = renderHook(() =>
        usePhysicalExamCameraImages({ visitId: 'visit-1', sectionCommentFor })
      );
      const file = new File(['a'], 'a.png');
      await act(async () => {
        await result.current.addCameraImage('q1', file);
      });

      act(() => result.current.commitQuestionImages('q1'));

      // Clears any previously committed entries for the question
      expect(removePendingImagesByQuestionId).toHaveBeenCalledWith('q1');
      // Adds the file to the pending queue
      expect(addPendingImage).toHaveBeenCalledWith(
        file,
        'Section for q1',
        'q1'
      );
      expect(markQuestionCommitted).toHaveBeenCalledWith('q1');
    });

    it('re-commits when called multiple times (handles re-upload)', async () => {
      getChildResources.mockResolvedValue({ data: [] });
      getUser.mockReturnValue(null);
      upsertAssetResource.mockResolvedValue({ data: { id: 1 } });

      const { result } = renderHook(() =>
        usePhysicalExamCameraImages({ visitId: 'visit-1', sectionCommentFor })
      );
      await act(async () => {
        await result.current.addCameraImage('q1', new File(['a'], 'a.png'));
      });

      act(() => result.current.commitQuestionImages('q1'));
      act(() => result.current.commitQuestionImages('q1'));

      // removePendingImagesByQuestionId called twice (once per commit)
      expect(removePendingImagesByQuestionId).toHaveBeenCalledTimes(2);
      expect(addPendingImage).toHaveBeenCalledTimes(2);
    });

    it('does nothing when no files are captured for the question', () => {
      getChildResources.mockResolvedValue({ data: [] });
      const { result } = renderHook(() =>
        usePhysicalExamCameraImages({ visitId: 'visit-1', sectionCommentFor })
      );

      act(() => result.current.commitQuestionImages('q1'));

      expect(removePendingImagesByQuestionId).toHaveBeenCalledWith('q1');
      expect(addPendingImage).not.toHaveBeenCalled();
      expect(markQuestionCommitted).not.toHaveBeenCalled();
    });
  });
});
