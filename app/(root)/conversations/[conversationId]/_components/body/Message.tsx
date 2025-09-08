/* eslint-disable @typescript-eslint/no-explicit-any */
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import React from 'react';
import { format } from 'date-fns';
import FilePreview from './FilePreview';
import { Badge } from '@/components/ui/badge';

import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Copy, Lock } from 'lucide-react';
import { extractLSBFromImageURL } from '@/lib/stego';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type Props = {
  fromCurrentUser: boolean;
  senderImage: string;
  senderName: string;
  lastByUser: boolean;
  content: string[];
  createdAt: number;
  seen?: React.ReactNode;
  type: string;
  hasSecret?: boolean; // NEW
  stegoMessage?: string | null; // NEW (fallback)
};

const ClickableStegoThumb = ({
  url,
  fallbackSecret,
}: {
  url: string;
  fallbackSecret?: string | null;
}) => {
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [secret, setSecret] = React.useState<string | null>(null);

  const onExtract = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const msg = await extractLSBFromImageURL(url);
      setSecret(msg);
      setOpen(true);
    } catch (e: any) {
      // Fallback to DB value if available
      if (fallbackSecret && fallbackSecret.length) {
        setSecret(fallbackSecret);
        setOpen(true);
      } else {
        toast.error(e?.message || 'No hidden message found.');
      }
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
    <div className="max-w-sm">
      <div
        className={cn(
          'relative rounded-xl overflow-hidden border cursor-pointer group select-none',
          { 'opacity-80': loading }
        )}
        onClick={onExtract}
        role="button"
        aria-label="View image"
      >
        <Image
          src={url}
          alt="image"
          width={320}
          height={240}
          className="object-cover transition-transform duration-200 group-hover:scale-[1.01]"
          draggable={false}
        />
        {/* Subtle padlock hint */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="absolute top-2 right-2 pointer-events-none">
                <Badge
                  variant="secondary"
                  className="flex items-center gap-1 bg-black/60 text-white backdrop-blur px-2 py-1"
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span className="text-xs">Secure</span>
                </Badge>
              </div>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs">
              Click image to view hidden message
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
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
              <button
                onClick={onCopy}
                className="inline-flex items-center rounded-md border px-3 py-1 text-sm hover:bg-muted"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const PlainThumb = ({ url }: { url: string }) => (
  <div className="max-w-sm">
    <div className="rounded-xl overflow-hidden border">
      <Image
        src={url}
        alt="image"
        width={320}
        height={240}
        className="object-cover"
        unoptimized
      />
    </div>
  </div>
);

const Message = ({
  fromCurrentUser,
  senderImage,
  senderName,
  lastByUser,
  content,
  createdAt,
  seen,
  type,
  hasSecret = false,
  stegoMessage = null,
}: Props) => {
  const formatTime = (timestamp: number) => format(timestamp, 'HH:mm');

  return (
    <div className={cn('flex items-end', { 'justify-end': fromCurrentUser })}>
      <div
        className={cn('flex flex-col w-full mx-2', {
          'order-1 items-end': fromCurrentUser,
          'order-2 items-start': !fromCurrentUser,
        })}
      >
        <div
          className={cn('px-4 py-2 rounded-lg max-w-[70%]', {
            'bg-primary text-primary-foreground': fromCurrentUser,
            'bg-secondary text-secondary-foreground': !fromCurrentUser,
            'rounded-br-none': !lastByUser && fromCurrentUser,
            'rounded-bl-none': !lastByUser && !fromCurrentUser,
          })}
        >
          {type === 'text' ? (
            <p className="text-wrap break-words whitespace-pre-wrap break-all">
              {content}
            </p>
          ) : null}

          {type === 'file' ? <FilePreview url={content[0]} /> : null}

          {type === 'image' ? (
            <div className="flex flex-wrap gap-3">
              {content.map((url) => {
                if (fromCurrentUser) return <PlainThumb key={url} url={url} />;

                // Receiver: clickable only when we either expect a secret
                // or have a DB fallback
                if (hasSecret || (stegoMessage && stegoMessage.length)) {
                  return (
                    <ClickableStegoThumb
                      key={url}
                      url={url}
                      fallbackSecret={stegoMessage}
                    />
                  );
                }
                return <PlainThumb key={url} url={url} />;
              })}
            </div>
          ) : null}

          {type === 'call' ? (
            <Badge variant="secondary">Joined Call</Badge>
          ) : null}

          <p
            className={cn(`text-xs flex w-full my-1`, {
              'text-primary-foreground justify-end': fromCurrentUser,
              'text-secondary-foreground justify-start': !fromCurrentUser,
            })}
          >
            {formatTime(createdAt)}
          </p>
        </div>
        {seen}
      </div>

      <Avatar
        className={cn('relative w-8 h-8', {
          'order-2': fromCurrentUser,
          'order-1': !fromCurrentUser,
          invisible: lastByUser,
        })}
      >
        <AvatarImage src={senderImage} />
        <AvatarFallback>{senderName.substring(0, 1)}</AvatarFallback>
      </Avatar>
    </div>
  );
};

export default Message;
