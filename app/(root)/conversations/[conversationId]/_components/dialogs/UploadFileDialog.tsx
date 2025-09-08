'use client';

import Uploader from '@/components/shared/uploader';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { api } from '@/convex/_generated/api';
import { useConversation } from '@/hooks/useConversation';
import { useMutationState } from '@/hooks/useMutationState';
import { zodResolver } from '@hookform/resolvers/zod';
import { ConvexError } from 'convex/values';
import { File, Image } from 'lucide-react';
import React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

type Props = {
  open: boolean;
  toggle: (newState: boolean) => void;
  type: 'image' | 'file';
};

const uploadFileSchema = z.object({
  files: z
    .string()
    .array()
    .min(1, { message: 'You must select at least 1 file' }),
  secret: z.string().optional(),
});

type CapacityInfo = {
  width: number;
  height: number;
  capacityBytes: number;
  messageBytes: number;
  remainingBytes: number;
};

const UploadFileDialog = ({ open, toggle, type }: Props) => {
  const form = useForm<z.infer<typeof uploadFileSchema>>({
    resolver: zodResolver(uploadFileSchema),
    defaultValues: { files: [], secret: '' },
  });

  const { conversationId } = useConversation();
  const files = form.watch('files');
  // const secret = (form.watch('secret') || '').trim();
  const secretRaw = form.watch('secret') || ''; // ← raw, untrimmed for UI
  const secretForEmbed = secretRaw.trim(); // ← use this only for checks/embedding

  const msgBytesLen = new TextEncoder().encode(secretRaw).length;

  // User chooses whether to embed
  const [stegoEnabled, setStegoEnabled] = React.useState(false);
  const mustTypeSecret = type === 'image' && stegoEnabled;

  // Capacity info reported by the Uploader after an image is picked
  const [capacityInfo, setCapacityInfo] = React.useState<CapacityInfo | null>(
    null
  );

  const { mutate: createMessage, pending } = useMutationState(
    api.message.create
  );

  const handleSubmit = async (values: z.infer<typeof uploadFileSchema>) => {
    const willEmbed = type === 'image' && stegoEnabled && !!secretForEmbed;

    createMessage({
      content: values.files,
      type,
      conversationId,
      hasSecret: !!willEmbed,
    })
      .then(() => {
        form.reset();
        setStegoEnabled(false);
        setCapacityInfo(null);
        toggle(false);
      })
      .catch((error) => {
        toast.error(
          error instanceof ConvexError
            ? error.data
            : 'Unexpected error occurred'
        );
      });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => toggle(o)}>
      <DialogTrigger asChild>
        <Button size="icon" variant="outline">
          {type === 'image' ? <Image /> : <File />}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Upload files</DialogTitle>
          <DialogDescription>
            {type === 'image'
              ? 'Upload images normally, or toggle on to hide a secret message.'
              : 'Upload image, video, audio, and PDFs.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            {type === 'image' && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="stego-toggle">
                    Hide a message in this image
                  </Label>
                  <Switch
                    id="stego-toggle"
                    checked={stegoEnabled}
                    onCheckedChange={(checked) => {
                      setStegoEnabled(checked);
                      setCapacityInfo(null); // reset any old capacity readout
                      form.setValue('files', []); // clear previously selected files
                    }}
                  />
                </div>
                {stegoEnabled && !secretRaw && (
                  <p className="text-xs text-muted-foreground">
                    You must type a message before you can upload an image.
                  </p>
                )}
              </div>
            )}

            {type === 'image' && stegoEnabled && (
              <div className="space-y-2">
                <Label htmlFor="secret">Hidden message</Label>
                <Input
                  id="secret"
                  placeholder="Type the secret message before choosing an image"
                  autoComplete="off"
                  value={secretRaw}
                  onChange={(e) => {
                    setCapacityInfo(null); // secret changed → capacity status may change
                    form.setValue('secret', e.target.value);
                  }}
                />
                {/* Live message length; capacity/remaining appear after image selection */}
                <p className="text-xs text-muted-foreground">
                  Message length:{' '}
                  <span className="font-medium">{msgBytesLen}</span> bytes
                  {capacityInfo && (
                    <>
                      {' · '}Capacity:{' '}
                      <span className="font-medium">
                        {capacityInfo.capacityBytes}
                      </span>{' '}
                      bytes
                      {' · '}Remaining:{' '}
                      <span
                        className={
                          capacityInfo.remainingBytes >= 0
                            ? 'text-green-600 font-medium'
                            : 'text-red-600 font-medium'
                        }
                      >
                        {capacityInfo.remainingBytes}
                      </span>{' '}
                      bytes
                    </>
                  )}
                </p>
              </div>
            )}

            <FormField
              control={form.control}
              name="files"
              render={() => (
                <FormItem>
                  <FormControl>
                    <div className="py-2">
                      <Uploader
                        type={type}
                        enableStego={type === 'image' && stegoEnabled}
                        secretMessage={secretForEmbed}
                        requireSecretForImage={mustTypeSecret}
                        onCapacityUpdate={setCapacityInfo}
                        onChange={(urls) =>
                          form.setValue('files', [...files, ...urls])
                        }
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                disabled={
                  !files.length || pending || (mustTypeSecret && !secretRaw)
                }
                type="submit"
              >
                Send
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default UploadFileDialog;
