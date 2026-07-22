'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useEmailCustomers } from '@/hooks/customers/use-customers';

/**
 * Compose one message to the selected customers.
 *
 * Deliberately plain text with a single `{firstName}` token: this reaches real
 * inboxes, and a rich editor here would invite marketing copy that nobody
 * reviewed. Sending is deduplicated by ADDRESS on the backend, so a person who
 * has booked with three operators receives one email rather than three.
 */
export function EmailCustomersDialog({
  open,
  onOpenChange,
  customerIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerIds: string[];
}) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const { mutate: send, isPending } = useEmailCustomers();

  const valid = subject.trim().length >= 3 && body.trim().length >= 10;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Email {customerIds.length} customer
            {customerIds.length === 1 ? '' : 's'}
          </DialogTitle>
          <DialogDescription>
            Plain text. Use <code>{'{firstName}'}</code> and it is replaced per
            recipient. Duplicate addresses are only emailed once.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customer-email-subject">Subject</Label>
            <Input
              id="customer-email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="How was your trip?"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer-email-body">Message</Label>
            <Textarea
              id="customer-email-body"
              rows={7}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Hi {firstName}, we would love to hear how your day went..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!valid || isPending}
            onClick={() =>
              send(
                { customerIds, subject: subject.trim(), body: body.trim() },
                {
                  onSuccess: () => {
                    onOpenChange(false);
                    setSubject('');
                    setBody('');
                  },
                },
              )
            }
          >
            {isPending ? 'Sending...' : 'Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
