import { FxModule } from '@/fx/fx.module';
import { Module } from '@nestjs/common';
import { HomePageController } from './home-page.controller';
import { HomePageService } from './home-page.service';

@Module({
  // FxModule supplies the display-rate service that converts each editorial
  // card's starting price into the shopper's currency.
  imports: [FxModule],
  controllers: [HomePageController],
  providers: [HomePageService],
})
export class HomePageModule {}
