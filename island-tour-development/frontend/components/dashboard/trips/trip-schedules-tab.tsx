'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldError } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Resolver } from 'react-hook-form';
import {
  useSchedules,
  useCreateSchedule,
  useUpdateSchedule,
  useRemoveSchedule,
} from '@/hooks/trips/use-trips';
import { formateDate } from '@/lib/utils';
import type { ScheduleStatus, TourSchedule } from '@/types/trip';

const scheduleStatusVariant: Record<ScheduleStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  AVAILABLE: 'default',
  SOLD_OUT: 'destructive',
  CLOSED: 'secondary',
  CANCELLED: 'destructive',
};

const addScheduleSchema = z.object({
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional().or(z.literal('')),
  startTime: z.string().min(1, 'Start time is required').regex(/^\d{2}:\d{2}$/, 'Must be HH:MM format'),
  totalSpots: z.coerce.number().int().min(1, 'At least 1 spot required'),
});

type AddScheduleFormValues = {
  startDate: string;
  endDate: string;
  startTime: string;
  totalSpots: string;
};

interface ScheduleRowProps {
  schedule: TourSchedule;
  tripId: string;
}

function ScheduleRow({ schedule, tripId }: ScheduleRowProps) {
  const { mutate: updateSchedule, isPending: isUpdating } = useUpdateSchedule();
  const { mutate: removeSchedule, isPending: isRemoving } = useRemoveSchedule();

  function handleStatusChange(status: ScheduleStatus) {
    updateSchedule(
      { tripId, scheduleId: schedule.id, payload: { status } },
      {
        onSuccess: () => toast.success('Schedule updated.'),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to update.'),
      }
    );
  }

  function handleDelete() {
    removeSchedule(
      { tripId, scheduleId: schedule.id },
      {
        onSuccess: () => toast.success('Schedule removed.'),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to remove.'),
      }
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 ring-1 ring-foreground/10 px-3 py-3">
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {formateDate(schedule.startDate)}
            {schedule.endDate && ` → ${formateDate(schedule.endDate)}`}
          </p>
          <p className="text-xs text-muted-foreground">{schedule.startTime}</p>
        </div>
        <div className="text-xs text-muted-foreground shrink-0">
          <span className="font-medium text-foreground">{schedule.availableSpots}</span>
          /{schedule.totalSpots} spots
        </div>
        <Badge variant={scheduleStatusVariant[schedule.status]}>
          {schedule.status === 'CANCELLED' ? (
            <span className="line-through">{schedule.status}</span>
          ) : (
            schedule.status
          )}
        </Badge>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Select
          value={schedule.status}
          onValueChange={(val) => handleStatusChange(val as ScheduleStatus)}
          disabled={isUpdating}
        >
          <SelectTrigger className="w-32 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AVAILABLE">Available</SelectItem>
            <SelectItem value="SOLD_OUT">Sold Out</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={handleDelete}
          disabled={isRemoving}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2Icon className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

interface TripSchedulesTabProps {
  tripId: string;
}

export function TripSchedulesTab({ tripId }: TripSchedulesTabProps) {
  const { data: schedules, isLoading } = useSchedules(tripId);
  const { mutate: createSchedule, isPending: isCreating } = useCreateSchedule();

  const sorted = [...(schedules ?? [])].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<AddScheduleFormValues>({
    resolver: zodResolver(addScheduleSchema) as unknown as Resolver<AddScheduleFormValues>,
    defaultValues: { startDate: '', endDate: '', startTime: '09:00', totalSpots: '20' },
  });

  function onSubmit(values: AddScheduleFormValues) {
    createSchedule(
      {
        tripId,
        payload: {
          startDate: values.startDate,
          endDate: values.endDate || undefined,
          startTime: values.startTime,
          totalSpots: Number(values.totalSpots),
        },
      },
      {
        onSuccess: () => {
          toast.success('Schedule added.');
          reset({ startDate: '', endDate: '', startTime: '09:00', totalSpots: '20' });
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to add schedule.'),
      }
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-base">Departure Schedules</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-none" />
              ))}
            </div>
          ) : sorted.length > 0 ? (
            <div className="space-y-2">
              {sorted.map((schedule) => (
                <ScheduleRow key={schedule.id} schedule={schedule} tripId={tripId} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">No schedules yet.</p>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4 border-t">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Add Schedule</p>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label className="text-xs font-semibold uppercase">
                  Start Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  {...register('startDate')}
                  type="date"
                  aria-invalid={!!errors.startDate}
                />
                <FieldError>{errors.startDate?.message}</FieldError>
              </Field>

              <Field>
                <Label className="text-xs font-semibold uppercase">End Date (optional)</Label>
                <Input {...register('endDate')} type="date" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label className="text-xs font-semibold uppercase">
                  Start Time <span className="text-destructive">*</span>
                </Label>
                <Input
                  {...register('startTime')}
                  type="time"
                  aria-invalid={!!errors.startTime}
                />
                <FieldError>{errors.startTime?.message}</FieldError>
              </Field>

              <Field>
                <Label className="text-xs font-semibold uppercase">
                  Total Spots <span className="text-destructive">*</span>
                </Label>
                <Input
                  {...register('totalSpots')}
                  type="number"
                  min={1}
                  aria-invalid={!!errors.totalSpots}
                />
                <FieldError>{errors.totalSpots?.message}</FieldError>
              </Field>
            </div>

            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={isCreating}>
                {isCreating ? 'Adding...' : 'Add Schedule'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
