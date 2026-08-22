import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  UpdateSiteInfoDto,
  UpdateCompanyInformationsDto,
  UpdateMollieConfigurationDto,
  UpdateStripeConfigurationDto,
  FaqItemDto,
} from './settings.dto';

describe('Settings DTO Validation', () => {
  // ── paymentMethods: closed per-PSP vocabularies ────────────────────────────
  // A typo'd key would not fail loudly downstream: Stripe's offer-intersection
  // silently resolves to ZERO checkout methods, Mollie 500s at payments.create.

  describe('paymentMethods @IsIn guard', () => {
    it('accepts the canonical Stripe keys', async () => {
      const dto = plainToInstance(UpdateStripeConfigurationDto, {
        paymentMethods: ['card', 'ideal', 'paypal', 'klarna'],
      });
      expect((await validate(dto)).length).toBe(0);
    });

    it('rejects a Mollie-vocabulary key on the Stripe DTO (and any typo)', async () => {
      const dto = plainToInstance(UpdateStripeConfigurationDto, {
        paymentMethods: ['card', 'creditcard'],
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('paymentMethods');
    });

    it('accepts Mollie keys incl. legacy Klarna flavours and hosted-only methods', async () => {
      const dto = plainToInstance(UpdateMollieConfigurationDto, {
        paymentMethods: ['creditcard', 'klarnapaylater', 'bancontact'],
      });
      expect((await validate(dto)).length).toBe(0);
    });

    it('rejects a Stripe-vocabulary key on the Mollie DTO', async () => {
      const dto = plainToInstance(UpdateMollieConfigurationDto, {
        paymentMethods: ['card'],
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('paymentMethods');
    });
  });

  // ── UpdateSiteInfoDto ──────────────────────────────────────────────────────

  describe('UpdateSiteInfoDto', () => {
    it('should pass with valid data', async () => {
      const data = { siteName: 'Island Tour', bookingFormStyle: 'v2' };
      const dto = plainToInstance(UpdateSiteInfoDto, data);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with invalid bookingFormStyle type', async () => {
      const data = { bookingFormStyle: 123 }; // Should be string
      const dto = plainToInstance(UpdateSiteInfoDto, data);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('bookingFormStyle');
    });

    it('should validate nested faqs', async () => {
      const data = {
        faqs: [{ question: 'Q1', answer: 'A1' }, { question: 123 }], // Second FAQ is invalid
      };
      const dto = plainToInstance(UpdateSiteInfoDto, data);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('faqs');
    });
  });

  // ── UpdateCompanyInformationsDto ───────────────────────────────────────────

  describe('UpdateCompanyInformationsDto', () => {
    it('should pass with valid email', async () => {
      const data = { companyEmail: 'info@example.com' };
      const dto = plainToInstance(UpdateCompanyInformationsDto, data);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with invalid email', async () => {
      const data = { companyEmail: 'not-an-email' };
      const dto = plainToInstance(UpdateCompanyInformationsDto, data);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('companyEmail');
    });
  });

  // ── FaqItemDto ─────────────────────────────────────────────────────────────

  describe('FaqItemDto', () => {
    it('should validate string fields', async () => {
      const data = { question: 123 };
      const dto = plainToInstance(FaqItemDto, data);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
