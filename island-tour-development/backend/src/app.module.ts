import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { FaqModule } from '@/common/faq/faq.module';
import { PageContentSectionModule } from '@/common/page-content-sections/page-content-section.module';
import { AuthModule } from '@/auth/auth.module';
import { StaffPermissionsModule } from '@/staff/staff-permissions.module';
import { StaffModule } from '@/staff/staff.module';
import { MailModule } from '@/mail/mail.module';
import { UserModule } from '@/users/user.module';
import { SettingsModule } from './settings/settings.module';
import { HomePageModule } from './home-page/home-page.module';
import { FeaturedExperiencesModule } from './featured-experiences/featured-experiences.module';
import { PlatformReviewsModule } from './platform-reviews/platform-reviews.module';
import { InstagramModule } from './instagram/instagram.module';
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
import { FxModule } from '@/fx/fx.module';
import { TiersModule } from '@/tiers/tiers.module';
import { BookingsModule } from '@/bookings/bookings.module';
import { CustomersModule } from '@/customers/customers.module';
import { PaymentsModule } from '@/payments/payments.module';
import { SettlementsModule } from '@/settlements/settlements.module';
import { TrackingModule } from '@/tracking/tracking.module';
import { ReviewsModule } from '@/reviews/reviews.module';
import { NotificationsModule } from '@/notifications/notifications.module';
import { WishlistModule } from '@/wishlist/wishlist.module';
import { WorkersModule } from '@/workers/workers.module';
import { AnalyticsModule } from '@/analytics/analytics.module';

// NOTE: ThrottlerModule and ThrottlerGuard live in AuthModule so the rate-limit
// guard fires before session validation on every request. See auth.module.ts.

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    FaqModule,
    PageContentSectionModule,
    // Global effective-permission resolver - must precede AuthModule's guards
    // conceptually, but being @Global the order here does not matter.
    StaffPermissionsModule,
    AuthModule,
    StaffModule,
    MailModule,
    UserModule,
    SettingsModule,
    HomePageModule,
    FeaturedExperiencesModule,
    PlatformReviewsModule,
    InstagramModule,
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
    FxModule,
    TiersModule,
    BookingsModule,
    CustomersModule,
    PaymentsModule,
    SettlementsModule,
    TrackingModule,
    ReviewsModule,
    NotificationsModule,
    WishlistModule,
    WorkersModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
