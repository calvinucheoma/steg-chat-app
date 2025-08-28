/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import * as React from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { extractLSBFromImageURL } from '@/lib/stego';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';

type Props = {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
  className?: string;
};

const StegoImageMessage: React.FC<Props> = ({
  url,
  alt = 'image',
  width = 320,
  height = 240,
  className,
}) => {
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [secret, setSecret] = React.useState<string | null>(null);

  const onExtract = async () => {
    setLoading(true);
    try {
      const msg = await extractLSBFromImageURL(url);
      setSecret(msg);
      setOpen(true);
    } catch (e: any) {
      toast.error(e?.message || 'No hidden message found.');
    } finally {
      setLoading(false);
    }
  };

  const onCopy = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <div className={className}>
      <div className="rounded-xl overflow-hidden border">
        {/* Using next/image for performance; falls back to plain img if needed */}
        <Image
          src={url}
          alt={alt}
          width={width}
          height={height}
          className="object-cover"
          unoptimized
        />
      </div>

      <div className="mt-2">
        <Button onClick={onExtract} disabled={loading} variant="secondary">
          {loading ? 'Extracting…' : 'Extract hidden message'}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hidden message</DialogTitle>
            <DialogDescription>
              {secret?.length ? (
                <div className="mt-2 break-words whitespace-pre-wrap">
                  {secret}
                </div>
              ) : (
                <span>No message found.</span>
              )}
            </DialogDescription>
          </DialogHeader>
          {secret?.length ? (
            <div className="mt-3">
              <Button onClick={onCopy} size="sm" variant="outline">
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StegoImageMessage;
