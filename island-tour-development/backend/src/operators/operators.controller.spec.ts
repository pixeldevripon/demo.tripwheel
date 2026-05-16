import { Test, TestingModule } from '@nestjs/testing';
import { OperatorsController } from './operators.controller';
import { OperatorsService } from './operators.service';

const mockOperatorsService = {
  create: jest.fn(),
  onboard: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  getCompanyInfo: jest.fn(),
  updateCompanyInfo: jest.fn(),
  getSocialMedia: jest.fn(),
  updateSocialMedia: jest.fn(),
  getStripeConfig: jest.fn(),
  updateStripeConfig: jest.fn(),
  getMollieConfig: jest.fn(),
  updateMollieConfig: jest.fn(),
};

describe('OperatorsController', () => {
  let controller: OperatorsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OperatorsController],
      providers: [{ provide: OperatorsService, useValue: mockOperatorsService }],
    }).compile();

    controller = module.get<OperatorsController>(OperatorsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
