'use client';

/**
 * Test-send (H-15): pick any of the 18 templates, confirm, and the backend
 * renders it with fixed sample data and mails it to YOUR OWN address — the
 * request body carries no recipient, so this can never email anyone else.
 * The resulting `test:<userId>#<n>` row appears in the Activity table via
 * the mutation's list invalidation.
 */

import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTestSend } from '@/hooks/email-centre/use-email-centre';
import {
    EMAIL_TEMPLATE_LABELS,
    emailTemplateLabel,
} from '@/lib/emails/template-labels';
import { EMAIL_TEMPLATE_KEYS } from '@/types/email';

export function TestSendDialog() {
    const [open, setOpen] = useState(false);
    const [templateKey, setTemplateKey] = useState<string>('');
    const { mutate: testSend, isPending } = useTestSend();

    function handleSend() {
        if (!templateKey) return;
        testSend(templateKey, {
            onSuccess: (row) => {
                toast.success(
                    `Test "${emailTemplateLabel(row.templateKey)}" sent to ${row.toEmail}.`,
                );
                setOpen(false);
                setTemplateKey('');
            },
            onError: (err) =>
                toast.error(
                    err instanceof Error
                        ? err.message
                        : 'Failed to send the test email.',
                ),
        });
    }

    return (
        <>
            <Button variant='outline' onClick={() => setOpen(true)}>
                Send test email
            </Button>
            <Dialog
                open={open}
                onOpenChange={(o) => {
                    if (!isPending) setOpen(o);
                }}>
                <DialogContent className='sm:max-w-md'>
                    <DialogHeader>
                        <DialogTitle>Send a test email</DialogTitle>
                        <DialogDescription>
                            Renders the chosen template with fixed sample data
                            and sends it to YOUR address — the one you are
                            signed in with. No customer or operator is
                            emailed, and no switch is flipped.
                        </DialogDescription>
                    </DialogHeader>
                    <Select value={templateKey} onValueChange={setTemplateKey}>
                        <SelectTrigger className='w-full'>
                            <SelectValue placeholder='Choose a template…' />
                        </SelectTrigger>
                        <SelectContent>
                            {EMAIL_TEMPLATE_KEYS.map((key) => (
                                <SelectItem key={key} value={key}>
                                    {EMAIL_TEMPLATE_LABELS[key]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <DialogFooter>
                        <Button
                            variant='outline'
                            disabled={isPending}
                            onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            disabled={!templateKey || isPending}
                            onClick={handleSend}>
                            {isPending
                                ? 'Sending...'
                                : 'Send sample to my address'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
