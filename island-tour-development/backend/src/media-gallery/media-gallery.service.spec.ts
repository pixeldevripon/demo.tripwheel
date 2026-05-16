import { Test, TestingModule } from '@nestjs/testing';
import { MediaGalleryService } from './media-gallery.service';
import { PrismaService } from '@/prisma/prisma.service';
import { CloudinaryService } from './cloudinary.service';

const mockPrismaService = {
  mediaGallery: {
    findMany: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
};

const mockCloudinaryService = {
  uploadFile: jest.fn(),
  deleteFile: jest.fn(),
  generateSignedParams: jest.fn(),
};

describe('MediaGalleryService', () => {
  let service: MediaGalleryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaGalleryService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CloudinaryService, useValue: mockCloudinaryService },
      ],
    }).compile();

    service = module.get<MediaGalleryService>(MediaGalleryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
