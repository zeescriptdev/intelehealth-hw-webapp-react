import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CameraCaptureModal from '../../../components/common/camera-capture-modal.component';
import {
  CAMERA_MAX_RETRIES,
  CAMERA_RETRY_DELAY_MS,
} from '../../../utils/constant';

const mockOnClose = vi.fn();
const mockOnCapture = vi.fn();

const baseProps = {
  isOpen: true,
  onClose: mockOnClose,
  onCapture: mockOnCapture,
};

function makeNamedError(name: string, message = '') {
  const err = new Error(message);
  err.name = name;
  return err;
}

describe('CameraCaptureModal', () => {
  let mockStream: MediaStream;
  let mockTrack: MediaStreamTrack;
  let mockGetUserMedia: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    document.body.style.overflow = '';

    mockTrack = { stop: vi.fn() } as unknown as MediaStreamTrack;
    mockStream = {
      getTracks: vi.fn(() => [mockTrack]),
    } as unknown as MediaStream;

    mockGetUserMedia = vi.fn().mockResolvedValue(mockStream);

    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: mockGetUserMedia },
      configurable: true,
      writable: true,
    });
  });

  it('returns null when isOpen is false', () => {
    const { container } = render(
      <CameraCaptureModal {...baseProps} isOpen={false} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders modal with header when isOpen is true', async () => {
    await act(async () => {
      render(<CameraCaptureModal {...baseProps} />);
    });
    expect(screen.getByText('Take Photo')).toBeInTheDocument();
  });

  it('shows loading state before camera is ready', () => {
    // Use a never-resolving promise so camera never becomes ready
    mockGetUserMedia.mockReturnValue(new Promise(() => {}));
    render(<CameraCaptureModal {...baseProps} />);
    expect(screen.getByText('Starting camera...')).toBeInTheDocument();
  });

  it('calls onClose when header close button is clicked', async () => {
    await act(async () => {
      render(<CameraCaptureModal {...baseProps} />);
    });
    const buttons = screen
      .getByText('Take Photo')
      .parentElement!.querySelectorAll('button');
    fireEvent.click(buttons[0]);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose when backdrop is clicked', async () => {
    await act(async () => {
      render(<CameraCaptureModal {...baseProps} />);
    });
    const { container } = render(<CameraCaptureModal {...baseProps} />);
    const backdrop = container.querySelector('.absolute.inset-0');
    fireEvent.click(backdrop!);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('sets body overflow to hidden when open', async () => {
    await act(async () => {
      render(<CameraCaptureModal {...baseProps} />);
    });
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('resets body overflow on unmount', async () => {
    let unmount: () => void;
    await act(async () => {
      const result = render(<CameraCaptureModal {...baseProps} />);
      unmount = result.unmount;
    });
    act(() => {
      unmount!();
    });
    expect(document.body.style.overflow).toBe('unset');
  });

  it('shows capture button when camera is ready', async () => {
    // Mock play on the prototype before rendering
    const playMock = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(HTMLVideoElement.prototype, 'play').mockImplementation(playMock);

    await act(async () => {
      render(<CameraCaptureModal {...baseProps} />);
    });

    // getUserMedia resolved, onloadedmetadata was set on the video
    const video = document.querySelector('video')!;
    Object.defineProperty(video, 'videoWidth', { value: 640, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: 480, configurable: true });

    // Manually invoke onloadedmetadata since jsdom doesn't fire it
    await act(async () => {
      if (video.onloadedmetadata) {
        await (video.onloadedmetadata as (e: Event) => void).call(video, new Event('loadedmetadata'));
      }
    });

    expect(screen.getByText('Capture Photo')).toBeInTheDocument();
  });

  it('shows error when camera is not supported', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: undefined },
      configurable: true,
      writable: true,
    });

    await act(async () => {
      render(<CameraCaptureModal {...baseProps} />);
    });

    expect(
      screen.getByText('Camera not supported on this device')
    ).toBeInTheDocument();
  });

  it('shows error when camera permission is denied (NotAllowedError)', async () => {
    mockGetUserMedia.mockRejectedValue(makeNamedError('NotAllowedError', 'denied'));

    await act(async () => {
      render(<CameraCaptureModal {...baseProps} />);
    });

    expect(
      screen.getByText('Camera permission denied. Please allow camera access.')
    ).toBeInTheDocument();
  });

  it('shows error for PermissionDeniedError', async () => {
    mockGetUserMedia.mockRejectedValue(makeNamedError('PermissionDeniedError', 'denied'));

    await act(async () => {
      render(<CameraCaptureModal {...baseProps} />);
    });

    expect(
      screen.getByText('Camera permission denied. Please allow camera access.')
    ).toBeInTheDocument();
  });

  it('shows error when no camera found (NotFoundError)', async () => {
    mockGetUserMedia.mockRejectedValue(makeNamedError('NotFoundError', 'not found'));

    await act(async () => {
      render(<CameraCaptureModal {...baseProps} />);
    });

    expect(
      screen.getByText('No camera found on this device.')
    ).toBeInTheDocument();
  });

  it('shows error for DevicesNotFoundError', async () => {
    mockGetUserMedia.mockRejectedValue(makeNamedError('DevicesNotFoundError', 'not found'));

    await act(async () => {
      render(<CameraCaptureModal {...baseProps} />);
    });

    expect(
      screen.getByText('No camera found on this device.')
    ).toBeInTheDocument();
  });

  it('shows error when camera is in use (NotReadableError) after retries', async () => {
    vi.useFakeTimers();
    mockGetUserMedia.mockRejectedValue(makeNamedError('NotReadableError', 'in use'));

    await act(async () => {
      render(<CameraCaptureModal {...baseProps} />);
    });

    // Advance through all retries
    for (let i = 1; i <= CAMERA_MAX_RETRIES; i++) {
      await act(async () => {
        vi.advanceTimersByTime(CAMERA_RETRY_DELAY_MS * i + 100);
      });
    }

    expect(
      screen.getByText('Camera is already in use. Please close other apps using the camera and try again.')
    ).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('shows error for TrackStartError after retries', async () => {
    vi.useFakeTimers();
    mockGetUserMedia.mockRejectedValue(makeNamedError('TrackStartError', 'in use'));

    await act(async () => {
      render(<CameraCaptureModal {...baseProps} />);
    });

    // Advance through all retries
    for (let i = 1; i <= CAMERA_MAX_RETRIES; i++) {
      await act(async () => {
        vi.advanceTimersByTime(CAMERA_RETRY_DELAY_MS * i + 100);
      });
    }

    expect(
      screen.getByText('Camera is already in use. Please close other apps using the camera and try again.')
    ).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('shows generic error for unknown camera errors', async () => {
    mockGetUserMedia.mockRejectedValue(makeNamedError('SomeOtherError', 'unknown'));

    await act(async () => {
      render(<CameraCaptureModal {...baseProps} />);
    });

    expect(
      screen.getByText('Failed to access camera. Please try again.')
    ).toBeInTheDocument();
  });

  it('shows close button in error state and calls onClose', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: undefined },
      configurable: true,
      writable: true,
    });

    await act(async () => {
      render(<CameraCaptureModal {...baseProps} />);
    });

    expect(screen.getByText('Camera Error')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Close'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('captures photo and calls onCapture with File', async () => {
    const mockCtx = {
      save: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(),
      restore: vi.fn(),
    };

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx as unknown as CanvasRenderingContext2D
    );
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
      value: vi.fn((cb: (blob: Blob | null) => void) =>
        cb(new Blob(['img'], { type: 'image/jpeg' }))
      ),
      configurable: true,
    });
    vi.spyOn(HTMLVideoElement.prototype, 'play').mockResolvedValue(undefined);

    await act(async () => {
      render(<CameraCaptureModal {...baseProps} />);
    });

    const video = document.querySelector('video')!;
    Object.defineProperty(video, 'videoWidth', { value: 640, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: 480, configurable: true });

    await act(async () => {
      if (video.onloadedmetadata) {
        await (video.onloadedmetadata as (e: Event) => void).call(video, new Event('loadedmetadata'));
      }
    });

    expect(screen.getByText('Capture Photo')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText('Capture Photo'));
    });

    expect(mockOnCapture).toHaveBeenCalledWith(expect.any(File));
  });

  it('does not capture when video dimensions are zero', async () => {
    vi.spyOn(HTMLVideoElement.prototype, 'play').mockResolvedValue(undefined);

    await act(async () => {
      render(<CameraCaptureModal {...baseProps} />);
    });

    const video = document.querySelector('video')!;
    Object.defineProperty(video, 'videoWidth', { value: 0, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: 0, configurable: true });

    await act(async () => {
      if (video.onloadedmetadata) {
        await (video.onloadedmetadata as (e: Event) => void).call(video, new Event('loadedmetadata'));
      }
    });

    fireEvent.click(screen.getByText('Capture Photo'));
    expect(mockOnCapture).not.toHaveBeenCalled();
  });

  it('does not capture when canvas context is null', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    vi.spyOn(HTMLVideoElement.prototype, 'play').mockResolvedValue(undefined);

    await act(async () => {
      render(<CameraCaptureModal {...baseProps} />);
    });

    const video = document.querySelector('video')!;
    Object.defineProperty(video, 'videoWidth', { value: 640, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: 480, configurable: true });

    await act(async () => {
      if (video.onloadedmetadata) {
        await (video.onloadedmetadata as (e: Event) => void).call(video, new Event('loadedmetadata'));
      }
    });

    fireEvent.click(screen.getByText('Capture Photo'));
    expect(mockOnCapture).not.toHaveBeenCalled();
  });

  it('stops camera tracks on unmount', async () => {
    let unmountFn: () => void;
    await act(async () => {
      const { unmount } = render(<CameraCaptureModal {...baseProps} />);
      unmountFn = unmount;
    });

    // Wait for getUserMedia to resolve and stream to be assigned
    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalled();
    });

    // Unmount the component — cleanup should stop the stream via ref
    act(() => {
      unmountFn!();
    });

    expect(mockTrack.stop).toHaveBeenCalled();
  });

  it('shows error when video.play() fails', async () => {
    vi.spyOn(HTMLVideoElement.prototype, 'play').mockRejectedValue(new Error('play failed'));

    await act(async () => {
      render(<CameraCaptureModal {...baseProps} />);
    });

    const video = document.querySelector('video')!;

    await act(async () => {
      if (video.onloadedmetadata) {
        await (video.onloadedmetadata as (e: Event) => void).call(video, new Event('loadedmetadata'));
      }
    });

    expect(
      screen.getByText('Failed to start camera preview')
    ).toBeInTheDocument();
  });

  it('early returns from onloadedmetadata when component unmounts before it fires', async () => {
    const playSpy = vi.spyOn(HTMLVideoElement.prototype, 'play').mockResolvedValue(undefined);

    let unmountFn: () => void;
    await act(async () => {
      const { unmount } = render(<CameraCaptureModal {...baseProps} />);
      unmountFn = unmount;
    });

    const video = document.querySelector('video')!;

    // Wait for getUserMedia to resolve and onloadedmetadata to be set
    await waitFor(() => {
      expect(video.onloadedmetadata).toBeTruthy();
    });

    // Capture the handler before unmounting
    const savedHandler = video.onloadedmetadata!;

    // Reset play spy to track only post-unmount calls
    playSpy.mockClear();

    // Unmount: React sets videoRef.current = null
    act(() => {
      unmountFn!();
    });

    // Call the captured handler after unmount — triggers `if (!videoRef.current) return;`
    await (savedHandler as (e: Event) => void).call(video, new Event('loadedmetadata'));

    // play() should NOT have been called because the handler returned early
    expect(playSpy).not.toHaveBeenCalled();
  });

  it('stops the stream immediately when modal closes before getUserMedia resolves', async () => {
    // Simulate a slow getUserMedia — resolve is held until we trigger it
    let resolveGetUserMedia!: (stream: MediaStream) => void;
    mockGetUserMedia.mockReturnValue(
      new Promise<MediaStream>(resolve => {
        resolveGetUserMedia = resolve;
      })
    );

    let unmountFn: () => void;
    await act(async () => {
      const { unmount } = render(<CameraCaptureModal {...baseProps} />);
      unmountFn = unmount;
    });

    // getUserMedia is pending — modal closes (unmount) before it resolves
    act(() => {
      unmountFn!();
    });

    // Now getUserMedia resolves AFTER cleanup ran
    await act(async () => {
      resolveGetUserMedia(mockStream);
    });

    // The stream should be stopped immediately because requestId is stale
    expect(mockTrack.stop).toHaveBeenCalled();
  });

  it('discards stale stream when component is quickly unmounted and remounted', async () => {
    // Simulate rapid close/reopen: first getUserMedia resolves AFTER the second
    const firstTrack = { stop: vi.fn() } as unknown as MediaStreamTrack;
    const firstStream = { getTracks: vi.fn(() => [firstTrack]) } as unknown as MediaStream;
    const secondTrack = { stop: vi.fn() } as unknown as MediaStreamTrack;
    const secondStream = { getTracks: vi.fn(() => [secondTrack]) } as unknown as MediaStream;

    let resolveFirst!: (s: MediaStream) => void;
    let resolveSecond!: (s: MediaStream) => void;

    mockGetUserMedia
      .mockReturnValueOnce(new Promise<MediaStream>(r => { resolveFirst = r; }))
      .mockReturnValueOnce(new Promise<MediaStream>(r => { resolveSecond = r; }));

    // First mount → startCamera → getUserMedia #1 starts (deferred)
    const { unmount } = render(<CameraCaptureModal {...baseProps} />);

    await act(async () => {});
    expect(mockGetUserMedia).toHaveBeenCalledTimes(1);

    // Unmount → cleanup increments requestIdRef, stopCamera
    act(() => { unmount(); });

    // Remount → new startCamera → getUserMedia #2 starts (deferred)
    await act(async () => {
      render(<CameraCaptureModal {...baseProps} />);
    });
    expect(mockGetUserMedia).toHaveBeenCalledTimes(2);

    // Resolve second (current) first — should be kept
    await act(async () => {
      resolveSecond(secondStream);
    });
    expect(secondTrack.stop).not.toHaveBeenCalled();

    // Now resolve first (stale) — requestId is outdated, stream should be stopped
    await act(async () => {
      resolveFirst(firstStream);
    });
    expect(firstTrack.stop).toHaveBeenCalled();
  });

  it('ignores non-Error exceptions from getUserMedia', async () => {
    mockGetUserMedia.mockRejectedValue('string error');

    await act(async () => {
      render(<CameraCaptureModal {...baseProps} />);
    });

    // Non-Error exceptions are caught but no error message is set
    // so the loading state remains visible
    expect(screen.getByText('Starting camera...')).toBeInTheDocument();
  });

  it('retries on NotReadableError and succeeds on second attempt', async () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLVideoElement.prototype, 'play').mockResolvedValue(undefined);

    // First call fails with NotReadableError, second succeeds
    mockGetUserMedia
      .mockRejectedValueOnce(makeNamedError('NotReadableError', 'in use'))
      .mockResolvedValueOnce(mockStream);

    await act(async () => {
      render(<CameraCaptureModal {...baseProps} />);
    });

    // First attempt failed — retry is scheduled
    expect(mockGetUserMedia).toHaveBeenCalledTimes(1);

    // Advance past the retry delay
    await act(async () => {
      vi.advanceTimersByTime(CAMERA_RETRY_DELAY_MS + 100);
    });

    // Second attempt should succeed
    expect(mockGetUserMedia).toHaveBeenCalledTimes(2);

    // Camera should become ready after loadedmetadata fires
    const video = document.querySelector('video')!;
    Object.defineProperty(video, 'videoWidth', { value: 640, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: 480, configurable: true });

    await act(async () => {
      if (video.onloadedmetadata) {
        await (video.onloadedmetadata as (e: Event) => void).call(video, new Event('loadedmetadata'));
      }
    });

    expect(screen.getByText('Capture Photo')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('shows error after exhausting all retries for NotReadableError', async () => {
    vi.useFakeTimers();

    // All attempts fail
    mockGetUserMedia.mockRejectedValue(makeNamedError('NotReadableError', 'in use'));

    await act(async () => {
      render(<CameraCaptureModal {...baseProps} />);
    });

    // Attempt 1 failed, advance through all retries
    for (let i = 1; i <= CAMERA_MAX_RETRIES; i++) {
      await act(async () => {
        vi.advanceTimersByTime(CAMERA_RETRY_DELAY_MS * i + 100);
      });
    }

    // Total calls: 1 initial + CAMERA_MAX_RETRIES retries
    expect(mockGetUserMedia).toHaveBeenCalledTimes(1 + CAMERA_MAX_RETRIES);

    expect(
      screen.getByText('Camera is already in use. Please close other apps using the camera and try again.')
    ).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('does not retry after component unmounts during retry delay', async () => {
    vi.useFakeTimers();

    mockGetUserMedia.mockRejectedValue(makeNamedError('NotReadableError', 'in use'));

    let unmountFn: () => void;
    await act(async () => {
      const { unmount } = render(<CameraCaptureModal {...baseProps} />);
      unmountFn = unmount;
    });

    // First attempt failed, retry is scheduled
    expect(mockGetUserMedia).toHaveBeenCalledTimes(1);

    // Unmount before retry fires
    act(() => {
      unmountFn!();
    });

    // Advance past the retry delay
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // Should NOT have retried because requestId was invalidated on unmount
    expect(mockGetUserMedia).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('uses relaxed video constraints on final retry', async () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLVideoElement.prototype, 'play').mockResolvedValue(undefined);

    // First attempts fail, final retry succeeds with relaxed constraints
    mockGetUserMedia
      .mockRejectedValueOnce(makeNamedError('NotReadableError', 'in use'))
      .mockRejectedValueOnce(makeNamedError('NotReadableError', 'in use'))
      .mockResolvedValueOnce(mockStream);

    await act(async () => {
      render(<CameraCaptureModal {...baseProps} />);
    });

    // Advance through retry 1
    await act(async () => {
      vi.advanceTimersByTime(CAMERA_RETRY_DELAY_MS + 100);
    });

    // Advance through retry 2
    await act(async () => {
      vi.advanceTimersByTime(CAMERA_RETRY_DELAY_MS * 2 + 100);
    });

    // Third call (retryCount = CAMERA_MAX_RETRIES - 1) should use relaxed constraints
    expect(mockGetUserMedia).toHaveBeenCalledTimes(3);
    const lastCall = mockGetUserMedia.mock.calls[2][0];
    expect(lastCall.video).toBe(true);
    expect(lastCall.audio).toBe(false);

    vi.useRealTimers();
  });
});
