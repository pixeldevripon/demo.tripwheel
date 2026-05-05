import { Test, TestingModule } from '@nestjs/testing';
import { MediaGalleryService } from './media-gallery.service';

describe('MediaGalleryService', () => {
  let service: MediaGalleryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MediaGalleryService],
    }).compile();

    service = module.get<MediaGalleryService>(MediaGalleryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
