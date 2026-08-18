import React, { useEffect, useRef, useState } from 'react';
import {
  CAMERA_MAX_RETRIES,
  CAMERA_RETRY_DELAY_MS,
} from '../../utils/constant';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestIdRef = useRef(0);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      /*
       * Increment request ID so any in-flight getUserMedia from a previous
       * cycle (e.g. React Strict Mode double-mount) is discarded on resolve.
       */
      const currentRequestId = ++requestIdRef.current;
      stopCamera();
      startCamera(currentRequestId);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
      /* Invalidate any pending startCamera call */
      requestIdRef.current++;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const startCamera = async (requestId: number, retryCount = 0) => {
    try {
      if (retryCount === 0) {
        setError('');
        setIsCameraReady(false);
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera not supported on this device');
        return;
      }

      /*
       * Use relaxed constraints on final retry — some Windows drivers
       * struggle with specific facingMode / resolution constraints.
       */
      const videoConstraints: MediaTrackConstraints | boolean =
        retryCount < CAMERA_MAX_RETRIES - 1
          ? {
              facingMode: 'user',
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
          : true;

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });

      /*
       * If this request is no longer current (modal closed, or a newer
       * startCamera was triggered), stop the stream immediately.
       */
      if (requestId !== requestIdRef.current) {
        mediaStream.getTracks().forEach(track => track.stop());
        return;
      }

      streamRef.current = mediaStream;

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = async () => {
          if (!videoRef.current) return;
          try {
            await videoRef.current.play();
            setIsCameraReady(true);
          } catch {
            setError('Failed to start camera preview');
          }
        };
      }
    } catch (err) {
      if (err instanceof Error) {
        /*
         * Retry on hardware-release timing errors (camera driver hasn't
         * fully released yet from a previous session / rapid re-open).
         */
        const isHardwareError =
          err.name === 'NotReadableError' || err.name === 'TrackStartError';

        if (
          isHardwareError &&
          retryCount < CAMERA_MAX_RETRIES &&
          requestId === requestIdRef.current
        ) {
          await new Promise(resolve =>
            setTimeout(resolve, CAMERA_RETRY_DELAY_MS * (retryCount + 1))
          );
          /* Re-check after delay — modal may have closed during the wait */
          if (requestId === requestIdRef.current) {
            return startCamera(requestId, retryCount + 1);
          }
          return;
        }

        const errorMap: Record<string, string> = {
          NotAllowedError:
            'Camera permission denied. Please allow camera access.',
          PermissionDeniedError:
            'Camera permission denied. Please allow camera access.',
          NotFoundError: 'No camera found on this device.',
          DevicesNotFoundError: 'No camera found on this device.',
          NotReadableError:
            'Camera is already in use. Please close other apps using the camera and try again.',
          TrackStartError:
            'Camera is already in use. Please close other apps using the camera and try again.',
        };
        setError(
          errorMap[err.name] || 'Failed to access camera. Please try again.'
        );
      }
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0)
      return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    /* Mirror image for selfie mode */
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    canvas.toBlob(
      blob => {
        if (blob) {
          const file = new File([blob], `camera-${Date.now()}.jpg`, {
            type: 'image/jpeg',
          });
          stopCamera();
          onCapture(file);
        }
      },
      'image/jpeg',
      0.95
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-[#2e1e91] lg:bg-white/90"
        onClick={onClose}
      />

      <div
        className="relative bg-white rounded-2xl lg:rounded-lg shadow-xl mx-6 border border-gray-200 z-10 overflow-hidden"
        style={{ width: '600px', maxWidth: '90vw' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Take Photo</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors border"
            style={{ borderColor: '#7f7b92' }}
          >
            <i
              className="fa-solid fa-times"
              style={{ fontSize: '8px', color: '#7f7b92' }}
            ></i>
          </button>
        </div>

        {/* Camera Preview */}
        <div className="relative bg-black" style={{ height: '450px' }}>
          {/* Error State */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-white z-20">
              <div className="text-center px-6">
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                  <i className="fa-solid fa-exclamation-triangle text-red-500 text-2xl"></i>
                </div>
                <p className="text-gray-900 text-lg mb-2">Camera Error</p>
                <p className="text-gray-600 text-sm mb-6">{error}</p>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2 bg-[#2e1e91] text-white rounded-lg hover:bg-[#1e1070] transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Loading State */}
          {!isCameraReady && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-20">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-gray-300 border-t-[#2e1e91] rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-900 text-lg">Starting camera...</p>
              </div>
            </div>
          )}

          {/* Video Preview */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />

          {/* Capture Button */}
          {isCameraReady && !error && (
            <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center p-6 bg-gradient-to-t from-black/60 to-transparent">
              <button
                type="button"
                onClick={capturePhoto}
                className="px-8 py-3 bg-[#2e1e91] text-white rounded-lg hover:bg-[#1e1070] transition-colors font-medium text-lg shadow-lg"
              >
                <i className="fa-solid fa-camera mr-2"></i>
                Capture Photo
              </button>
            </div>
          )}
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default CameraCaptureModal;
