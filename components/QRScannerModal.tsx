'use client';

import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

interface QRScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResult: (url: string) => void;
}

export function QRScannerModal({ open, onOpenChange, onResult }: QRScannerModalProps) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setError(null);
      return;
    }

    let html5QrCode: Html5Qrcode | null = null;
    let isComponentMounted = true;

    const startScanner = async () => {
      try {
        if (typeof navigator !== 'undefined' && !navigator.mediaDevices) {
          throw new Error('HTTPS_REQUIRED');
        }

        // Optimize performance by strictly telling the scanner to only look for QR_CODE.
        // This prevents the engine from parsing frames for every other barcode format.
        html5QrCode = new Html5Qrcode("qr-reader", {
          formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ],
          verbose: false
        });
        
        await html5QrCode.start(
          { facingMode: "environment" }, 
          {
            fps: 30, // Increased frame rate for instant scans
            qrbox: { width: 250, height: 250 },
            // Removed aspectRatio to prevent expensive browser cropping
          },
          (decodedText) => {
            if (isComponentMounted) {
              onResult(decodedText);
            }
          },
          (errorMessage) => {
            // Ignore expected parse errors (like no QR in frame)
          }
        );
      } catch (err: any) {
        if (!isComponentMounted) return;
        
        console.error('Camera permission/scanner error:', err);
        if (err.message === 'HTTPS_REQUIRED') {
          setError("Camera access requires HTTPS. If you are on a local network, you must serve the app over HTTPS.");
        } else if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) {
          setError("Camera permission was denied. Please allow camera access in your browser settings and try again.");
        } else if (err.name === 'NotFoundError') {
          setError("No camera was found on your device.");
        } else {
          setError("Unable to access camera: " + (err.message || String(err)));
        }
      }
    };

    // Small delay to ensure the DOM element is rendered before scanner attaches
    const timer = setTimeout(() => {
      startScanner();
    }, 100);

    return () => {
      isComponentMounted = false;
      clearTimeout(timer);
      if (html5QrCode?.isScanning) {
        html5QrCode.stop().catch(console.error);
      }
    };
  }, [open, onResult]);

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
              onClick={() => {
                setError(null);
                onOpenChange(false);
                setTimeout(() => onOpenChange(true), 100);
              }}
              className="mt-6 px-4 py-2 bg-zinc-800 text-white rounded-md hover:bg-zinc-700 transition"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="relative w-full aspect-square bg-black flex items-center justify-center">
            {/* The ID must match the one passed to Html5Qrcode constructor */}
            <div id="qr-reader" className="w-full h-full overflow-hidden [&_video]:object-cover [&_video]:w-full [&_video]:h-full"></div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
