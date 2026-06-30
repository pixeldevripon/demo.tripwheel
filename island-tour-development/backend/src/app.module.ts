import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { AuthModule } from '@/auth/auth.module';
import { MailModule } from '@/mail/mail.module';
import { UserModule } from '@/users/user.module';
import { SettingsModule } from './settings/settings.module';
import { OperatorsModule } from './operators/operators.module';
import { MediaGalleryModule } from './media-gallery/media-gallery.module';
import { CategoriesModule } from './categories/categories.module';
import { DestinationsModule } from './destinations/destinations.module';
import { HubsModule } from './hubs/hubs.module';
import { SlugRegistryModule } from './slug-registry/slug-registry.module';
import { ToursModule } from '@/tours/tours.module';
import { AttributesModule } from '@/attributes/attributes.module';
import { CollectionsModule } from '@/collections/collections.module';
import { SearchModule } from '@/search/search.module';
import { OctoModule } from '@/octo/octo.module';
import { AvailabilityModule } from '@/availability/availability.module';
import { TiersModule } from '@/tiers/tiers.module';
import { BookingsModule } from '@/bookings/bookings.module';
import { PaymentsModule } from '@/payments/payments.module';
import { TrackingModule } from '@/tracking/tracking.module';
import { ReviewsModule } from '@/reviews/reviews.module';
import { NotificationsModule } from '@/notifications/notifications.module';
import { WishlistModule } from '@/wishlist/wishlist.module';
import { WorkersModule } from '@/workers/workers.module';

// NOTE: ThrottlerModule and ThrottlerGuard live in AuthModule so the rate-limit
// guard fires before session validation on every request. See auth.module.ts.

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    MailModule,
    UserModule,
    SettingsModule,
    OperatorsModule,
    MediaGalleryModule,
    CategoriesModule,
    DestinationsModule,
    HubsModule,
    SlugRegistryModule,
    ToursModule,
    AttributesModule,
    CollectionsModule,
    SearchModule,
    OctoModule,
    AvailabilityModule,
    TiersModule,
    BookingsModule,
    PaymentsModule,
    TrackingModule,
    ReviewsModule,
    NotificationsModule,
    WishlistModule,
    WorkersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

