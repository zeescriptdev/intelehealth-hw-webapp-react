import { useEffect, useRef, useState } from 'react';
import { storage } from '../../../utils/storage';
import {
  addPendingImage,
  removePendingImagesByQuestionId,
} from '../services/obs.service';
import {
  deleteAssetResource,
  getChildResources,
  getDeletedAssetIds,
  markQuestionCommitted,
  unmarkQuestionCommitted,
  upsertAssetResource,
} from '../services/temp-storage.service';
import type { CapturedImage } from '../types/obs.types';
import {
  BLOB_URL_PREFIX,
  DEFAULT_CREATED_BY,
  RESOURCE_TYPE_ASSET,
  RESOURCE_TYPE_VISIT,
} from '../utils/ayu.constants';

export interface UsePhysicalExamCameraImagesParams {
  visitId: string | number | null | undefined;
  sectionCommentFor: (questionId: string) => string;
}

export interface UsePhysicalExamCameraImagesReturn {
  cameraImagesFor: (questionId: string) => string[];
  addCameraImage: (questionId: string, file: File) => Promise<void>;
  removeCameraImage: (questionId: string, index: number) => void;
  clearCameraImages: (questionId: string) => void;
  commitQuestionImages: (questionId: string) => void;
}

const capturedFileStore = new Map<
  string,
  Array<{ file: File; comment: string }>
>();

export const usePhysicalExamCameraImages = ({
  visitId,
  sectionCommentFor,
}: UsePhysicalExamCameraImagesParams): UsePhysicalExamCameraImagesReturn => {
  const [cameraImages, setCameraImages] = useState<
    Record<string, CapturedImage[]>
  >({});

  const cameraImagesRef = useRef(cameraImages);
  cameraImagesRef.current = cameraImages;

  const hasRestoredRef = useRef(false);
  useEffect(() => {
    capturedFileStore.clear();

    if (hasRestoredRef.current) return;
    if (visitId == null || visitId === '') return;
    hasRestoredRef.current = true;
    (async () => {
      const res = await getChildResources<{
        questionId: string;
        comment?: string;
      }>(RESOURCE_TYPE_VISIT, String(visitId), RESOURCE_TYPE_ASSET);
      if (!res.data?.length) return;
      const deletedIds = getDeletedAssetIds();
      const restored: Record<string, CapturedImage[]> = {};
      for (const record of res.data) {
        const qId = record.data?.questionId;
        if (!qId || !record.file_path) continue;
        if (deletedIds.has(record.id)) continue;
        if (!restored[qId]) restored[qId] = [];
        restored[qId].push({
          file: null,
          preview: record.file_path,
          assetRecordId: record.id,
        });
      }
      if (Object.keys(restored).length > 0) {
        setCameraImages(restored);
      }
    })().catch(err => {
      console.error('Failed to restore camera images from temp storage', err);
    });

    return () => {
      capturedFileStore.clear();
    };
  }, [visitId]);

  const cameraImagesFor = (questionId: string): string[] =>
    (cameraImages[questionId] ?? []).map(img => img.preview);

  const addCameraImage = async (questionId: string, file: File) => {
    const comment = sectionCommentFor(questionId);
    const preview = URL.createObjectURL(file);

    const bucket = capturedFileStore.get(questionId) ?? [];
    bucket.push({ file, comment });
    capturedFileStore.set(questionId, bucket);

    setCameraImages(prev => ({
      ...prev,
      [questionId]: [...(prev[questionId] ?? []), { file, preview }],
    }));

    if (visitId == null || visitId === '') return;

    const resourceId = `${visitId}_${questionId}_${Date.now()}`;
    try {
      let createdBy = DEFAULT_CREATED_BY;
      try {
        const u = storage.getUser();
        if (u) createdBy = JSON.parse(u).uuid ?? u;
      } catch {
        /* fallback */
      }
      const res = await upsertAssetResource<{
        questionId: string;
        comment: string;
      }>(file, {
        resource_id: resourceId,
        parent_type: RESOURCE_TYPE_VISIT,
        parent_id: String(visitId),
        created_by: createdBy,
        data: { questionId, comment },
      });
      const recordId = res.data.id;
      setCameraImages(prev => ({
        ...prev,
        /* v8 ignore next */
        [questionId]: (prev[questionId] ?? []).map(img =>
          img.file === file ? { ...img, assetRecordId: recordId } : img
        ),
      }));
      /* v8 ignore next 3 */
    } catch (err) {
      console.error('Failed to upload camera image to temp storage', err);
    }
  };

  /**
   * Remove a single camera image by index.
   * Clears pending images for the question and rebuilds the capturedFileStore
   * from the remaining images so the pending queue stays in sync with UI state.
   */
  const removeCameraImage = (questionId: string, index: number) => {
    const target = cameraImagesRef.current[questionId]?.[index];
    if (target?.assetRecordId) {
      deleteAssetResource(target.assetRecordId).catch(() => {});
    }
    if (target?.preview?.startsWith(BLOB_URL_PREFIX)) {
      URL.revokeObjectURL(target.preview);
    }
    removePendingImagesByQuestionId(questionId);
    setCameraImages(prev => {
      const updated = (prev[questionId] ?? []).filter((_, i) => i !== index);
      // Rebuild capturedFileStore from remaining images to keep pending queue in sync
      capturedFileStore.set(
        questionId,
        updated
          .filter(img => img.file != null)
          .map(img => ({
            file: img.file!,
            comment: sectionCommentFor(questionId),
          }))
      );
      if (updated.length === 0) {
        unmarkQuestionCommitted(questionId);
      }
      return { ...prev, [questionId]: updated };
    });
  };

  const clearCameraImages = (questionId: string) => {
    const imgs = cameraImagesRef.current[questionId] ?? [];
    for (const img of imgs) {
      if (img.assetRecordId) {
        deleteAssetResource(img.assetRecordId).catch(() => {});
      }
      if (img.preview?.startsWith(BLOB_URL_PREFIX)) {
        URL.revokeObjectURL(img.preview);
      }
    }
    capturedFileStore.delete(questionId);
    removePendingImagesByQuestionId(questionId);
    unmarkQuestionCommitted(questionId);
    setCameraImages(prev => ({ ...prev, [questionId]: [] }));
  };

  const commitQuestionImages = (questionId: string) => {
    const entries = capturedFileStore.get(questionId) ?? [];
    removePendingImagesByQuestionId(questionId);
    for (const entry of entries) {
      addPendingImage(entry.file, entry.comment, questionId);
    }
    if (entries.length > 0) {
      markQuestionCommitted(questionId);
    }
  };

  return {
    cameraImagesFor,
    addCameraImage,
    removeCameraImage,
    clearCameraImages,
    commitQuestionImages,
  };
};
