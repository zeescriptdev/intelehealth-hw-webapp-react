import { MindmapPortalApi } from '../../../services/mindmap';
import type {
  PendingResources,
  TempStorageApiResponse,
  TempStorageRecord,
  TempStorageResourceType,
  UpsertAssetMeta,
  UpsertResourcePayload,
} from '../types/temp-storage.types';

export const TEMP_STORAGE_ENDPOINTS = Object.freeze({
  ROOT: '/temp-storage',
  UPLOAD: '/temp-storage/upload',
  PENDING: '/temp-storage/pending',
  SYNC: '/temp-storage/sync',
  byResource: (type: TempStorageResourceType, id: string) =>
    `/temp-storage/${type}/${id}`,
  children: (type: TempStorageResourceType, id: string) =>
    `/temp-storage/${type}/${id}/children`,
} as const);

export function upsertResource<TData = unknown>(
  payload: UpsertResourcePayload<TData>
): Promise<TempStorageApiResponse<TempStorageRecord<TData>>> {
  return MindmapPortalApi.post<
    TempStorageApiResponse<TempStorageRecord<TData>>
  >(TEMP_STORAGE_ENDPOINTS.ROOT, payload);
}

export function upsertAssetResource<TData = Record<string, unknown>>(
  file: File,
  meta: UpsertAssetMeta<TData>
): Promise<TempStorageApiResponse<TempStorageRecord<TData>>> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('resource_type', 'asset');
  formData.append('resource_id', meta.resource_id);
  formData.append('created_by', meta.created_by);
  if (meta.parent_type) formData.append('parent_type', meta.parent_type);
  if (meta.parent_id) formData.append('parent_id', meta.parent_id);
  if (meta.data) formData.append('data', JSON.stringify(meta.data));

  return MindmapPortalApi.post<
    TempStorageApiResponse<TempStorageRecord<TData>>
  >(TEMP_STORAGE_ENDPOINTS.UPLOAD, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export async function getResource<TData = unknown>(
  resourceType: TempStorageResourceType,
  resourceId: string
): Promise<TempStorageApiResponse<TempStorageRecord<TData>>> {
  try {
    return await MindmapPortalApi.get<
      TempStorageApiResponse<TempStorageRecord<TData>>
    >(TEMP_STORAGE_ENDPOINTS.byResource(resourceType, resourceId));
  } catch (error: unknown) {
    if (
      error != null &&
      typeof error === 'object' &&
      'response' in error &&
      (error as { response?: { status?: number } }).response?.status === 404
    ) {
      return {
        success: false,
        message: 'Not found',
        data: null,
      } as unknown as TempStorageApiResponse<TempStorageRecord<TData>>;
    }
    throw error;
  }
}

export function getChildResources<TData = unknown>(
  resourceType: TempStorageResourceType,
  resourceId: string,
  childType?: TempStorageResourceType
): Promise<TempStorageApiResponse<TempStorageRecord<TData>[]>> {
  return MindmapPortalApi.get<
    TempStorageApiResponse<TempStorageRecord<TData>[]>
  >(TEMP_STORAGE_ENDPOINTS.children(resourceType, resourceId), {
    params: childType ? { type: childType } : undefined,
  });
}

export function getPendingResources<TData = unknown>(
  query: PendingResources = {}
): Promise<TempStorageApiResponse<TempStorageRecord<TData>[]>> {
  return MindmapPortalApi.get<
    TempStorageApiResponse<TempStorageRecord<TData>[]>
  >(TEMP_STORAGE_ENDPOINTS.PENDING, { params: query });
}

export function bulkMarkSynced(
  ids: number[]
): Promise<TempStorageApiResponse<{ updatedCount: number }>> {
  return MindmapPortalApi.patch<
    TempStorageApiResponse<{ updatedCount: number }>
  >(TEMP_STORAGE_ENDPOINTS.SYNC, { ids });
}

export function deleteAssetResource(
  recordId: number
): Promise<TempStorageApiResponse<null>> {
  markAssetDeleted(recordId);
  return MindmapPortalApi.delete<TempStorageApiResponse<null>>(
    `${TEMP_STORAGE_ENDPOINTS.ROOT}/${recordId}`
  );
}

const DELETED_ASSETS_KEY = 'pe_deleted_asset_ids';

function markAssetDeleted(id: number): void {
  const ids = getDeletedAssetIds();
  ids.add(id);
  try {
    sessionStorage.setItem(DELETED_ASSETS_KEY, JSON.stringify([...ids]));
    /* v8 ignore next */
  } catch {
    /* v8 ignore next */
  }
}

export function getDeletedAssetIds(): Set<number> {
  try {
    const raw = sessionStorage.getItem(DELETED_ASSETS_KEY);
    return raw ? new Set(JSON.parse(raw) as number[]) : new Set();
    /* v8 ignore next 3 */
  } catch {
    return new Set();
  }
}

export function clearDeletedAssetIds(): void {
  try {
    sessionStorage.removeItem(DELETED_ASSETS_KEY);
    /* v8 ignore next */
  } catch {
    /* v8 ignore next */
  }
}

const COMMITTED_QUESTIONS_KEY = 'pe_committed_question_ids';

export function markQuestionCommitted(questionId: string): void {
  const ids = getCommittedQuestionIds();
  ids.add(questionId);
  try {
    sessionStorage.setItem(COMMITTED_QUESTIONS_KEY, JSON.stringify([...ids]));
    /* v8 ignore next */
  } catch {
    /* v8 ignore next */
  }
}

export function unmarkQuestionCommitted(questionId: string): void {
  const ids = getCommittedQuestionIds();
  ids.delete(questionId);
  try {
    sessionStorage.setItem(COMMITTED_QUESTIONS_KEY, JSON.stringify([...ids]));
    /* v8 ignore next */
  } catch {
    /* v8 ignore next */
  }
}

export function getCommittedQuestionIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(COMMITTED_QUESTIONS_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    /* v8 ignore next 3 */
  } catch {
    return new Set();
  }
}

export function clearCommittedQuestionIds(): void {
  try {
    sessionStorage.removeItem(COMMITTED_QUESTIONS_KEY);
    /* v8 ignore next */
  } catch {
    /* v8 ignore next */
  }
}
