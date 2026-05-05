import { Test, TestingModule } from '@nestjs/testing';
import { MediaGalleryController } from './media-gallery.controller';

describe('MediaGalleryController', () => {
  let controller: MediaGalleryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaGalleryController],
    }).compile();

    controller = module.get<MediaGalleryController>(MediaGalleryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
