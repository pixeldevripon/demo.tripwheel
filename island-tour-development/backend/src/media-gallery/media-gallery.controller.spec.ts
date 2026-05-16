import { Test, TestingModule } from '@nestjs/testing';
import { MediaGalleryController } from './media-gallery.controller';
import { MediaGalleryService } from './media-gallery.service';
import { getQueueToken } from '@nestjs/bullmq';

const mockMediaGalleryService = {
  getAll: jest.fn(),
  uploadFiles: jest.fn(),
  getSignedUploadParams: jest.fn(),
  confirmUpload: jest.fn(),
  remove: jest.fn(),
};

const mockQueue = {
  add: jest.fn(),
  getJob: jest.fn(),
};

describe('MediaGalleryController', () => {
  let controller: MediaGalleryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaGalleryController],
      providers: [
        { provide: MediaGalleryService, useValue: mockMediaGalleryService },
        { provide: getQueueToken('media-upload'), useValue: mockQueue },
      ],
    }).compile();

    controller = module.get<MediaGalleryController>(MediaGalleryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
