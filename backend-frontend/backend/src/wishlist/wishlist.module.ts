import { Module } from '@nestjs/common';
import { FxModule } from '@/fx/fx.module';
import { WishlistController } from './wishlist.controller';
import { WishlistService } from './wishlist.service';

@Module({
  imports: [FxModule],
  controllers: [WishlistController],
  providers: [WishlistService],
})
export class WishlistModule {}
