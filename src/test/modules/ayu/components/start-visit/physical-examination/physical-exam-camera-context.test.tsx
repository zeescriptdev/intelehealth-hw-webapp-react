import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  PhysicalExamCameraProvider,
  usePhysicalExamCamera,
} from '../../../../../../modules/ayu/components/start-visit/physical-examination/physical-exam-camera-context';

// Stub the underlying camera-images hook to a fixed return so the context
// tests focus on the provider/consumer wiring, not the storage logic.
const hookReturn = {
  cameraImagesFor: vi.fn(() => ['preview-a']),
  addCameraImage: vi.fn(),
  removeCameraImage: vi.fn(),
  clearCameraImages: vi.fn(),
  commitQuestionImages: vi.fn(),
};

vi.mock(
  '../../../../../../modules/ayu/hooks/usePhysicalExamCameraImages',
  () => ({
    usePhysicalExamCameraImages: vi.fn(() => hookReturn),
  })
);

const Consumer = () => {
  const ctx = usePhysicalExamCamera();
  if (!ctx) return <div data-testid="no-ctx">no ctx</div>;
  return (
    <div>
      <div data-testid="images">{ctx.cameraImagesFor('q1').join(',')}</div>
      <div data-testid="job-aid-url">{ctx.jobAidUrlFor('q1') ?? 'null'}</div>
      <div data-testid="job-aid-type">{ctx.jobAidTypeFor('q1') ?? 'null'}</div>
    </div>
  );
};

describe('PhysicalExamCameraContext', () => {
  it('exposes the camera-images hook return plus the job-aid resolvers', () => {
    render(
      <PhysicalExamCameraProvider
        visitId="visit-1"
        sectionCommentFor={() => 'General'}
        jobAidUrlFor={() => 'http://example/aid.png'}
        jobAidTypeFor={() => 'image'}
      >
        <Consumer />
      </PhysicalExamCameraProvider>
    );
    expect(screen.getByTestId('images').textContent).toBe('preview-a');
    expect(screen.getByTestId('job-aid-url').textContent).toBe(
      'http://example/aid.png'
    );
    expect(screen.getByTestId('job-aid-type').textContent).toBe('image');
  });

  it('falls back to () => null for job-aid resolvers when none are passed', () => {
    render(
      <PhysicalExamCameraProvider
        visitId="visit-1"
        sectionCommentFor={() => 'General'}
      >
        <Consumer />
      </PhysicalExamCameraProvider>
    );
    expect(screen.getByTestId('job-aid-url').textContent).toBe('null');
    expect(screen.getByTestId('job-aid-type').textContent).toBe('null');
  });

  it('usePhysicalExamCamera returns null when used outside a provider', () => {
    render(<Consumer />);
    expect(screen.getByTestId('no-ctx')).toBeInTheDocument();
  });
});
