import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  UpdateSiteInfoDto,
  UpdateCompanyInformationsDto,
  FaqItemDto,
} from './settings.dto';

describe('Settings DTO Validation', () => {
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
