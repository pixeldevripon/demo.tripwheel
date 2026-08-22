'use client';

import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon } from '@hugeicons/core-free-icons';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface AppGuide {
  app: string;
  /** Where these steps apply, when the app differs by platform. */
  platform?: string;
  steps: string[];
  /** How that provider actually behaves once subscribed. */
  note?: string;
}

/**
 * Menu paths verified against each vendor's own documentation on 2026-07-29
 * (Google Calendar Help 37100, Apple Calendar User Guide icl1022, Apple iPhone
 * User Guide ipha0d932e96, Microsoft Support cff1429c). They drift - re-check
 * against the vendor doc before editing, never from memory.
 */
const GUIDES: AppGuide[] = [
  {
    app: 'Google Calendar',
    platform: 'on a computer',
    steps: [
      'Open Google Calendar in a browser. This cannot be done from the mobile app - add it once on a computer and it appears on your phone afterwards.',
      'In the left sidebar, find "Other calendars" and click the + next to it.',
      'Choose "From URL".',
      'Paste the link and click "Add calendar".',
    ],
    note: 'Google decides how often it re-reads the link, and it is not immediate - expect several hours between a new booking and it appearing. Nothing is wrong if it lags.',
  },
  {
    app: 'Apple Calendar',
    platform: 'Mac',
    steps: [
      'Open the Calendar app.',
      'Choose File → New Calendar Subscription from the menu bar.',
      'Paste the link and click Subscribe.',
      'Name it, pick a colour, and set Auto-refresh to Every hour.',
      'Click OK.',
    ],
    note: 'Apple is the only one of the three that lets you choose the refresh interval, so this is the fastest-updating option.',
  },
  {
    app: 'Apple Calendar',
    platform: 'iPhone or iPad',
    steps: [
      'Open Settings, tap Apps, then Calendar. (On older iOS, tap Calendar directly in Settings.)',
      'Tap Calendar Accounts → Add Account.',
      'Tap Other, then "Add Subscribed Calendar".',
      'Paste the link in the Server field and tap Next, then Save.',
    ],
  },
  {
    app: 'Outlook',
    platform: 'outlook.com and Microsoft 365 on the web',
    steps: [
      'Open Calendar and click "Add calendar".',
      'Choose "Subscribe from web".',
      'Paste the link, give it a name and a colour.',
      'Click Import.',
    ],
    note: "Outlook is the slowest to pick up changes - Microsoft's own documentation says it can take more than 24 hours.",
  },
];

/**
 * In-product setup guide.
 *
 * It lives beside the URL rather than in a help centre because the moment an
 * operator has copied the link is the exact moment they need this, and every one
 * of these paths is buried several menus deep in an app we do not control.
 *
 * Collapsed by default: it is a once-per-device task, so it must not push the
 * thing people come back for (the URL, and whether it is still syncing) below
 * the fold.
 */
export function CalendarFeedInstructions() {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 rounded-md py-2 text-left text-sm font-medium transition-colors hover:text-foreground/70">
        How to add this to your calendar
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          className={`size-4 shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="pt-2">
        <div className="space-y-6">
          {GUIDES.map((guide) => (
            <div key={`${guide.app}-${guide.platform ?? ''}`}>
              <h4 className="text-sm font-medium">
                {guide.app}
                {guide.platform && (
                  <span className="ml-1.5 font-normal text-muted-foreground">
                    ({guide.platform})
                  </span>
                )}
              </h4>
              <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-sm font-light text-muted-foreground">
                {guide.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              {guide.note && (
                <p className="mt-2 pl-4 text-xs text-muted-foreground">
                  {guide.note}
                </p>
              )}
            </div>
          ))}

          {/*
            The four things people get wrong. Refresh lag is the top support
            question for every iCal integration ("it's broken" - it is not), and
            the read-only point stops an operator editing an event in Google and
            assuming they have changed their availability here.
          */}
          <div className="rounded-md bg-muted/50 p-4">
            <h4 className="text-sm font-medium">Good to know</h4>
            <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm font-light text-muted-foreground">
              <li>
                <strong className="font-medium">Treat the link like a password.</strong>{' '}
                Anyone who has it can see that calendar without signing in. Send
                it to your own team only, and generate a new link if it gets out.
              </li>
              <li>
                <strong className="font-medium">Updates are not instant.</strong>{' '}
                Your calendar app decides how often to check, and only Apple lets
                you set it. For the live picture, use your dashboard.
              </li>
              <li>
                <strong className="font-medium">It only reads.</strong> Editing or
                deleting an event in your calendar app changes nothing here.
                Availability is only ever changed from the tour&apos;s own calendar.
              </li>
              <li>
                <strong className="font-medium">
                  A new link means re-adding it everywhere.
                </strong>{' '}
                Generating a new link kills the old one on every device that was
                using it.
              </li>
            </ul>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
