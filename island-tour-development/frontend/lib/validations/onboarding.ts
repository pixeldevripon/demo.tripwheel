import * as z from 'zod';

export const onboardingSchema = z.object({
  // Step 1: Business Identity
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
  companyCountry: z.string().optional(),
  companyCity: z.string().optional(),
  companyPhone: z.string().optional(),

  // Step 2: Business Intent
  plannedTripCount: z.preprocess(
    (val) => (val === '' || val === undefined || val === null ? undefined : Number(val)),
    z.number().min(1, 'Please select a trip count')
  ),
  yearlySalesTarget: z.preprocess(
    (val) => (val === '' || val === undefined || val === null ? undefined : Number(val)),
    z.number().min(1, 'Please select a sales target')
  ),
});



export type OnboardingData = z.infer<typeof onboardingSchema>;

