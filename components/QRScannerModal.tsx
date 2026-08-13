'use client';

import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Scanner, setZXingModuleOverrides } from '@yudiel/react-qr-scanner';
import { useState } from 'react';
import { AlertCircle } from 'lucide-react';

// Next.js doesn't serve the WASM file from node_modules by default.
// We point the barcode-detector to fetch it from unpkg CDN to prevent "Failed to fetch" errors.
setZXingModuleOverrides({
  locateFile: (path: string, prefix: string) => {
    if (path.endsWith('.wasm')) {
      return `https://cdn.jsdelivr.net/npm/zxing-wasm@3.1.1/dist/reader/${path}`;
    }
    return prefix + path;
  }
});

interface QRScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResult: (url: string) => void;
}

export function QRScannerModal({ open, onOpenChange, onResult }: QRScannerModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);

  // Reset state when modal opens/closes
  if (!open && permissionGranted) {
    setPermissionGranted(false);
    setError(null);
  }

  const requestCamera = async () => {
    try {
      setError(null);
      if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
        throw new Error('HTTPS_REQUIRED');
      }
      // Request permission explicitly with a user gesture, using simple constraints 
      // so it doesn't fail on devices without a rear camera.
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Stop the stream immediately, we just wanted the permission. 
      // The Scanner component will request its own stream.
      stream.getTracks().forEach(track => track.stop());
      setPermissionGranted(true);
    } catch (err: any) {
      console.error('Camera permission error:', err);
      if (err.message === 'HTTPS_REQUIRED') {
        setError("Camera access requires HTTPS. If you are on a local network, you must serve the app over HTTPS.");
      } else if (err.name === 'NotAllowedError') {
        setError("Camera permission was denied. Please allow camera access in your browser settings and try again.");
      } else if (err.name === 'NotFoundError') {
        setError("No camera was found on your device.");
      } else {
        setError("Unable to access camera: " + (err.message || "Unknown error"));
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-black border-zinc-800" showCloseButton>
        <DialogTitle className="sr-only">Scan QR Code</DialogTitle>
        <DialogDescription className="sr-only">Scan a room QR code to join</DialogDescription>
        
        {error ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-red-500 min-h-[300px]">
            <AlertCircle size={48} className="mb-4" />
            <p className="font-medium">{error}</p>
            <button 
              onClick={requestCamera}
              className="mt-6 px-4 py-2 bg-zinc-800 text-white rounded-md hover:bg-zinc-700 transition"
            >
              Try Again
            </button>
          </div>
        ) : !permissionGranted ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-white min-h-[300px]">
            <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-3xl">photo_camera</span>
            </div>
            <h3 className="text-lg font-semibold mb-2">Camera Access Required</h3>
            <p className="text-zinc-400 mb-6 text-sm">
              We need access to your camera to scan the QR code.
            </p>
            <button 
              onClick={requestCamera}
              className="px-6 py-3 bg-[var(--cy-primary)] text-white rounded-md font-medium hover:opacity-90 transition"
            >
              Allow Camera Access
            </button>
          </div>
        ) : (
          <div className="relative w-full aspect-square bg-black">
            {open && (
              <Scanner
                onScan={(result) => {
                  if (result && result.length > 0 && result[0].rawValue) {
                    onResult(result[0].rawValue);
                  }
                }}
                onError={(e: any) => {
                  console.error('Scanner internal error:', e);
                  setError("Scanner encountered an error. Please try again.");
                }}
                styles={{
                  container: {
                    width: '100%',
                    height: '100%',
                  },
                }}
              />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
