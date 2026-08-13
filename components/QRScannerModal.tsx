'use client';

import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Scanner } from '@yudiel/react-qr-scanner';
import { useState } from 'react';
import { AlertCircle } from 'lucide-react';

interface QRScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResult: (url: string) => void;
}

export function QRScannerModal({ open, onOpenChange, onResult }: QRScannerModalProps) {
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-black border-zinc-800" showCloseButton>
        <DialogTitle className="sr-only">Scan QR Code</DialogTitle>
        <DialogDescription className="sr-only">Scan a room QR code to join</DialogDescription>
        
        {error ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-red-500 h-[300px]">
            <AlertCircle size={48} className="mb-4" />
            <p className="font-medium">{error}</p>
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
                onError={(e) => {
                  console.error(e);
                  if (typeof navigator !== 'undefined' && !navigator.mediaDevices) {
                    setError("Camera access requires HTTPS. If you are on a local network, you must serve the app over HTTPS.");
                  } else {
                    setError("Unable to access camera. Please ensure you have granted camera permissions.");
                  }
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
