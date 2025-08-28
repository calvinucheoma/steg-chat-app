/* eslint-disable @typescript-eslint/no-explicit-any */

// import React from 'react';
// import { UploadDropzone } from '@/lib/uploadthing';
// import { UploadThingError } from 'uploadthing/server';
// import { Json } from '@uploadthing/shared';
// import { toast } from 'sonner';
// import { embedLSBIntoImageFile } from '@/lib/stego';
// import { Button } from '@/components/ui/button';

// type Props = {
//   onChange: (urls: string[]) => void;
//   type: 'image' | 'file';
//   enableStego?: boolean;
//   secretMessage?: string;
//   requireSecretForImage?: boolean; // NEW
// };

// const Uploader = ({
//   type,
//   onChange,
//   enableStego,
//   secretMessage,
//   requireSecretForImage,
// }: Props) => {
//   // If user chose stego, block uploads until a secret exists
//   if (
//     type === 'image' &&
//     enableStego &&
//     requireSecretForImage &&
//     !secretMessage?.trim()
//   ) {
//     return (
//       <div className="border rounded-md p-4 text-sm text-muted-foreground">
//         Enter a hidden message above before selecting an image.
//         <div className="mt-2">
//           <Button size="sm" variant="outline" disabled>
//             Upload disabled
//           </Button>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <UploadDropzone
//       endpoint={type}
//       onBeforeUploadBegin={async (files) => {
//         // Only embed when: image + stego ON + secret present
//         if (type !== 'image' || !enableStego || !secretMessage?.trim())
//           return files;

//         const processed: File[] = [];
//         for (const f of files) {
//           const isImage = /^image\//i.test(f.type);
//           if (!isImage) {
//             processed.push(f);
//             continue;
//           }
//           try {
//             const stego = await embedLSBIntoImageFile(f, secretMessage.trim());
//             processed.push(stego);
//           } catch (e: any) {
//             toast.error(
//               e?.message ||
//                 'Failed to embed hidden message. Uploading original image.'
//             );
//             processed.push(f); // fallback to original image if embedding fails
//           }
//         }
//         return processed;
//       }}
//       onClientUploadComplete={(res) => onChange(res.map((item) => item.url))}
//       onUploadError={(error: UploadThingError<Json>) => {
//         toast.error(error.message);
//       }}
//     />
//   );
// };

// export default Uploader;

import React from 'react';
import { UploadDropzone } from '@/lib/uploadthing';
import { UploadThingError } from 'uploadthing/server';
import { Json } from '@uploadthing/shared';
import { toast } from 'sonner';
import { embedLSBIntoImageFile } from '@/lib/stego';

// Small helper to read an image file and get its natural width/height
async function fileToImageDims(
  file: File
): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    return {
      width: (img.naturalWidth || img.width) ?? 0,
      height: (img.naturalHeight || img.height) ?? 0,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// LSB capacity in bytes for RGB (1 bit per channel): floor((W * H * 3) / 8) - 8
function maxPayloadBytes(width: number, height: number) {
  const totalBits = width * height * 3;
  const totalBytes = Math.floor(totalBits / 8);
  return Math.max(0, totalBytes - 8); // reserve 8 bytes for header
}

type CapacityInfo = {
  width: number;
  height: number;
  capacityBytes: number;
  messageBytes: number;
  remainingBytes: number;
};

type Props = {
  onChange: (urls: string[]) => void;
  type: 'image' | 'file';
  enableStego?: boolean;
  secretMessage?: string;
  requireSecretForImage?: boolean; // when stego is ON, block until secret present
  onCapacityUpdate?: (info: CapacityInfo | null) => void; // NEW: notify parent for UI
};

const Uploader = ({
  type,
  onChange,
  enableStego,
  secretMessage,
  requireSecretForImage,
  onCapacityUpdate,
}: Props) => {
  // If user chose stego, block uploads until a secret exists
  if (
    type === 'image' &&
    enableStego &&
    requireSecretForImage &&
    !secretMessage?.trim()
  ) {
    return (
      <div className="border rounded-md p-4 text-sm text-muted-foreground">
        Enter a hidden message above before selecting an image.
      </div>
    );
  }

  return (
    <UploadDropzone
      endpoint={type}
      onBeforeUploadBegin={async (files) => {
        // Reset capacity info on every new selection
        onCapacityUpdate?.(null);

        // If not doing stego, pass files through untouched.
        if (type !== 'image' || !enableStego || !secretMessage?.trim()) {
          return files;
        }

        const secret = secretMessage.trim();
        const msgBytes = new TextEncoder().encode(secret);
        const processed: File[] = [];

        for (const f of files) {
          const isImage = /^image\//i.test(f.type);
          if (!isImage) {
            processed.push(f);
            continue;
          }

          // Measure capacity before embedding
          try {
            const { width, height } = await fileToImageDims(f);
            const capacity = maxPayloadBytes(width, height);

            // Report capacity/remaining to parent so it can render a status line
            const remaining = capacity - msgBytes.length;
            onCapacityUpdate?.({
              width,
              height,
              capacityBytes: capacity,
              messageBytes: msgBytes.length,
              remainingBytes: remaining,
            });

            if (msgBytes.length > capacity) {
              toast.error(
                `Message too large for this image.\nCapacity: ${capacity} bytes, Message: ${msgBytes.length} bytes.`
              );
              // Cancel this file (don’t upload)
              continue;
            }

            // Embed now that we know it fits
            const stego = await embedLSBIntoImageFile(f, secret);
            processed.push(stego);
          } catch (e: any) {
            // If anything goes wrong, don’t block normal uploads — just pass original
            toast.error(
              e?.message || 'Failed to prepare image. Uploading original.'
            );
            processed.push(f);
          }
        }

        // If every image was rejected due to capacity, return an empty list to abort upload
        if (!processed.length) {
          // Let the user adjust their message or pick a bigger image
          return [];
        }

        return processed;
      }}
      onClientUploadComplete={(res) => onChange(res.map((item) => item.url))}
      onUploadError={(error: UploadThingError<Json>) => {
        // Keep this user-friendly
        toast.error(error.message);
      }}
    />
  );
};

export default Uploader;
