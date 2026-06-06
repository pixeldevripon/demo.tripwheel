-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('en', 'es', 'nl', 'pt', 'fr', 'de', 'zh');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'EDITOR', 'STAFF', 'GUIDE', 'TOUR_OPERATOR', 'USER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('VIEW_PERMISSIONS', 'MANAGE_SYSTEM', 'MANAGE_TRIPS', 'MANAGE_OPERATORS', 'MANAGE_SLOTS', 'VIEW_SLOT_ANALYTICS', 'CREATE_CONTENT', 'VIEW_CONTENT', 'EDIT_CONTENT', 'DELETE_CONTENT', 'VIEW_MEDIA', 'VIEW_ORDERS', 'EDIT_ORDER', 'DELETE_ORDER', 'MANAGE_USERS', 'VIEW_USERS', 'CREATE_USER', 'UPDATE_USER', 'DELETE_USER', 'CREATE_OPERATOR', 'VIEW_OPERATOR_PROFILE', 'EDIT_OPERATOR_PROFILE', 'MANAGE_OPERATOR_PAYMENTS', 'CREATE_TRIP', 'VIEW_TRIPS', 'EDIT_TRIP', 'DELETE_TRIP', 'CREATE_BLOG', 'VIEW_BLOGS', 'EDIT_BLOG', 'DELETE_BLOG', 'CREATE_DESTINATION', 'VIEW_DESTINATIONS', 'EDIT_DESTINATION', 'DELETE_DESTINATION', 'MANAGE_HUBS', 'CREATE_ACTIVITY', 'VIEW_ACTIVITIES', 'EDIT_ACTIVITY', 'DELETE_ACTIVITY', 'CREATE_PICKUP_DROP', 'VIEW_PICKUP_DROPS', 'EDIT_PICKUP_DROP', 'DELETE_PICKUP_DROP', 'CREATE_CATEGORY', 'VIEW_CATEGORIES', 'EDIT_CATEGORY', 'DELETE_CATEGORY', 'VIEW_BOOKINGS', 'EDIT_BOOKING', 'DELETE_BOOKING', 'VIEW_PAYMENTS', 'EDIT_PAYMENT', 'DELETE_PAYMENT', 'VIEW_ENQUIRIES', 'DELETE_ENQUIRY', 'REPLY_ENQUIRY', 'VIEW_LEADS', 'EDIT_LEAD', 'DELETE_LEAD', 'VIEW_REVIEWS', 'EDIT_REVIEW', 'DELETE_REVIEW', 'APPROVE_REVIEW', 'CREATE_PARTNER', 'VIEW_PARTNERS', 'EDIT_PARTNER', 'DELETE_PARTNER', 'UPLOAD_MEDIA', 'MANAGE_MEDIA', 'VIEW_PROFILE', 'EDIT_PROFILE', 'MANAGE_SETTINGS', 'VIEW_SETTINGS', 'VIEW_ANALYTICS', 'EXPORT_DATA', 'BULK_OPERATIONS');

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('DRAFT', 'LIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PricingModel" AS ENUM ('PER_PERSON', 'UNIT');

-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('GROUP', 'BOAT', 'VEHICLE', 'AIRCRAFT', 'PACKAGE');

-- CreateEnum
CREATE TYPE "PickupModel" AS ENUM ('INCLUDED', 'PAID_ADDON', 'NONE');

-- CreateEnum
CREATE TYPE "AgeBandType" AS ENUM ('ADULT', 'CHILD', 'INFANT');

-- CreateEnum
CREATE TYPE "AddOnUnit" AS ENUM ('PER_PERSON', 'FLAT');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('AVAILABLE', 'SOLD_OUT', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Region" AS ENUM ('CARIBBEAN', 'ATLANTIC', 'MEDITERRANEAN', 'ASIA', 'AFRICA');

-- CreateEnum
CREATE TYPE "HubType" AS ENUM ('LOCATION', 'HIGHLIGHT', 'AREA');

-- CreateEnum
CREATE TYPE "SlugEntityType" AS ENUM ('TOUR', 'CATEGORY', 'HUB', 'COLLECTION', 'RESERVED');

-- CreateEnum
CREATE TYPE "FeaturedEntityType" AS ENUM ('CATEGORY', 'HUB');

-- CreateEnum
CREATE TYPE "HubPickType" AS ENUM ('BEST_OVERALL', 'MOST_POPULAR', 'BEST_FOR_FAMILIES', 'BEST_VALUE');

-- CreateEnum
CREATE TYPE "SlotStatus" AS ENUM ('AVAILABLE', 'SOFT_LOCKED', 'HARD_RESERVED');

-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('WAITING', 'OFFERED', 'CLAIMED', 'PASSED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "OperatorVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "scheduleId" TEXT,
    "date" DATE NOT NULL,
    "time" TEXT,
    "partySize" INTEGER NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "depositAmount" DECIMAL(10,2) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "confirmationCode" TEXT NOT NULL,
    "selectedAddOns" JSONB DEFAULT '[]',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "heroImage" TEXT,
    "isSeeded" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "description" TEXT,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metaTitleTemplate" TEXT,
    "metaDescriptionTemplate" TEXT,
    "parentCategoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_page_content" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "aboutText" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,

    CONSTRAINT "category_page_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_translations" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT,
    "overview" TEXT,
    "h1Override" TEXT,
    "breadcrumbLabel" TEXT,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "destinations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "heroImage" TEXT,
    "isSeeded" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "region" "Region",
    "country" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "timezone" TEXT,
    "currency" TEXT,
    "language" TEXT,
    "galleryImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ogImage" TEXT,
    "parentDestinationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "destinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "destination_translations" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT,
    "overview" TEXT,
    "h1Override" TEXT,
    "breadcrumbLabel" TEXT,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "destination_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "destination_page_content" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "aboutText" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,

    CONSTRAINT "destination_page_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hubs" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "hubType" "HubType",
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "isSeeded" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hubs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hub_translations" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT,
    "overview" TEXT,
    "h1Override" TEXT,
    "breadcrumbLabel" TEXT,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hub_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hub_page_content" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "aboutText" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,

    CONSTRAINT "hub_page_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hub_allowed_categories" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "hub_allowed_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hub_our_picks" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "pickType" "HubPickType" NOT NULL,
    "description" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "hub_our_picks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hub_comparison_groups" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "hub_comparison_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hub_comparison_tours" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "hub_comparison_tours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "featured_experiences" (
    "id" TEXT NOT NULL,
    "entityType" "FeaturedEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "destinationId" TEXT,
    "videoUrl" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "featured_experiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faqs" (
    "id" TEXT NOT NULL,
    "pageType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "featured_slots" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "slotNumber" INTEGER NOT NULL,
    "status" "SlotStatus" NOT NULL DEFAULT 'AVAILABLE',
    "tripId" TEXT,
    "operatorId" TEXT,
    "acquiredAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "commissionRate" DOUBLE PRECISION,

    CONSTRAINT "featured_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slot_locks" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "bullJobId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slot_locks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slot_history" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "fromStatus" "SlotStatus",
    "toStatus" "SlotStatus" NOT NULL,
    "operatorId" TEXT,
    "tripId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slot_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_gallery" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_gallery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operators" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "verificationStatus" "OperatorVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "aggregateRating" DOUBLE PRECISION,
    "aggregateReviewCount" INTEGER NOT NULL DEFAULT 0,
    "aggregatesUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operator_company_info" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "companyName" TEXT,
    "companyCountry" TEXT,
    "companyCity" TEXT,
    "companyPhone" TEXT,
    "plannedTripCount" INTEGER,
    "yearlySalesTarget" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operator_company_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operator_social_media" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "facebookUrl" TEXT DEFAULT '',
    "instagramUrl" TEXT DEFAULT '',
    "twitterUrl" TEXT DEFAULT '',
    "linkedinUrl" TEXT DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operator_social_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operator_stripe_config" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "publishableKey" TEXT NOT NULL DEFAULT '',
    "secretKey" TEXT NOT NULL DEFAULT '',
    "webhookSecret" TEXT NOT NULL DEFAULT '',
    "paymentMethods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operator_stripe_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operator_mollie_config" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL DEFAULT '',
    "paymentMethods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operator_mollie_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_info" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "siteName" TEXT DEFAULT '',
    "siteTagline" TEXT DEFAULT '',
    "siteDescription" TEXT DEFAULT '',
    "bookingFormStyle" TEXT DEFAULT 'v2',
    "logo" TEXT DEFAULT '',
    "favicon" TEXT DEFAULT '',
    "enableWhatsappChat" BOOLEAN DEFAULT false,
    "whatsappNumber" TEXT DEFAULT '',
    "instagramWidgetId" TEXT DEFAULT '',
    "enableInstagram" BOOLEAN DEFAULT false,
    "faqs" JSONB DEFAULT '[]',

    CONSTRAINT "site_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_seo" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "metaTitle" TEXT DEFAULT '',
    "metaDescription" TEXT DEFAULT '',
    "metaKeywords" TEXT DEFAULT '',
    "canonicalUrl" TEXT DEFAULT '',
    "robotsMeta" TEXT DEFAULT '',
    "ogTitle" TEXT DEFAULT '',
    "ogDescription" TEXT DEFAULT '',
    "ogImage" TEXT DEFAULT '',
    "twitterTitle" TEXT DEFAULT '',
    "twitterDescription" TEXT DEFAULT '',
    "twitterImage" TEXT DEFAULT '',
    "googleAnalyticsId" TEXT DEFAULT '',
    "googleTagManagerId" TEXT DEFAULT '',
    "googleSearchConsole" TEXT DEFAULT '',
    "facebookPixelId" TEXT DEFAULT '',
    "schemaType" TEXT DEFAULT '',
    "customSchema" TEXT DEFAULT '',
    "autoGenerateSitemap" TEXT DEFAULT '',
    "robotsTxt" TEXT DEFAULT '',

    CONSTRAINT "site_seo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_media" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "facebookUrl" TEXT DEFAULT '',
    "twitterUrl" TEXT DEFAULT '',
    "linkedinUrl" TEXT DEFAULT '',
    "instagramUrl" TEXT DEFAULT '',

    CONSTRAINT "social_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "smtp_configuration" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "smtpHost" TEXT DEFAULT '',
    "smtpPort" TEXT DEFAULT '',
    "smtpUsername" TEXT DEFAULT '',
    "smtpPassword" TEXT DEFAULT '',
    "smtpSecure" BOOLEAN DEFAULT true,

    CONSTRAINT "smtp_configuration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mailchimp_configuration" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "apiKey" TEXT DEFAULT '',
    "audienceId" TEXT DEFAULT '',
    "serverPrefix" TEXT DEFAULT '',

    CONSTRAINT "mailchimp_configuration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_informations" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "companyName" TEXT,
    "companyEmail" TEXT,
    "companyPhone" TEXT,
    "companyWebsite" TEXT,
    "companyAddress" TEXT,
    "companyCity" TEXT,
    "companyState" TEXT,
    "companyZip" TEXT,
    "companyCountry" TEXT,
    "companyVat" TEXT,
    "companySize" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_informations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stripe_configuration" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "paymentLabel" TEXT NOT NULL DEFAULT 'Stripe',
    "publishableKey" TEXT NOT NULL DEFAULT '',
    "secretKey" TEXT NOT NULL DEFAULT '',
    "webhookSecret" TEXT NOT NULL DEFAULT '',
    "paymentMethods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stripe_configuration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mollie_configuration" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "paymentLabel" TEXT NOT NULL DEFAULT 'Mollie',
    "apiKey" TEXT NOT NULL DEFAULT '',
    "paymentMethods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mollie_configuration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slug_registry" (
    "id" TEXT NOT NULL,
    "destinationSlug" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "entityType" "SlugEntityType" NOT NULL,
    "entityId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slug_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "hubId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "TripStatus" NOT NULL DEFAULT 'DRAFT',
    "pricingModel" "PricingModel" NOT NULL DEFAULT 'PER_PERSON',
    "unitType" "UnitType",
    "basePrice" DECIMAL(10,2),
    "priceFrom" DECIMAL(10,2),
    "durationMinutes" INTEGER,
    "pickupModel" "PickupModel" NOT NULL DEFAULT 'NONE',
    "maxPartySize" INTEGER,
    "minPartySize" INTEGER NOT NULL DEFAULT 1,
    "bookingCutoffMinutes" INTEGER NOT NULL DEFAULT 120,
    "cancellationHours" INTEGER NOT NULL DEFAULT 24,
    "h1Override" TEXT,
    "breadcrumbLabel" TEXT,
    "aggregateRating" DOUBLE PRECISION,
    "aggregateReviewCount" INTEGER NOT NULL DEFAULT 0,
    "aggregatesUpdatedAt" TIMESTAMP(3),
    "isSponsored" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_images" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "urlAvif" TEXT,
    "urlWebp" TEXT,
    "isHero" BOOLEAN NOT NULL DEFAULT false,
    "focalX" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "focalY" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "altText" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,

    CONSTRAINT "tour_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_age_bands" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "bandType" "AgeBandType" NOT NULL,
    "label" TEXT NOT NULL,
    "minAge" INTEGER,
    "maxAge" INTEGER,
    "price" DECIMAL(10,2) NOT NULL,
    "minCount" INTEGER NOT NULL DEFAULT 0,
    "maxCount" INTEGER,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tour_age_bands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_addons" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "unit" "AddOnUnit" NOT NULL DEFAULT 'PER_PERSON',
    "maxQuantity" INTEGER NOT NULL DEFAULT 1,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tour_addons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_languages" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "language" TEXT NOT NULL,

    CONSTRAINT "tour_languages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_highlights" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,

    CONSTRAINT "tour_highlights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_highlight_translations" (
    "id" TEXT NOT NULL,
    "highlightId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "text" TEXT NOT NULL,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "tour_highlight_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_inclusions" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'check',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,

    CONSTRAINT "tour_inclusions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_inclusion_translations" (
    "id" TEXT NOT NULL,
    "inclusionId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "label" TEXT NOT NULL,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "tour_inclusion_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_translations" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "title" TEXT,
    "overview" TEXT,
    "description" TEXT,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trip_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_schedules" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "startTime" TEXT NOT NULL,
    "totalSpots" INTEGER NOT NULL,
    "availableSpots" INTEGER NOT NULL,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tour_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC+06:00',
    "phone" TEXT,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'TOUR_OPERATOR',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "hasPassword" BOOLEAN NOT NULL DEFAULT false,
    "passwordChangedAt" TIMESTAMP(3),

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "idToken" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waitlist_entries" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "tripId" TEXT,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'WAITING',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "offeredAt" TIMESTAMP(3),
    "offerExpiresAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "offerJobId" TEXT,

    CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhooks" (
    "id" TEXT NOT NULL DEFAULT 'default',

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_urls" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "webhooksId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_urls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlists" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bookings_confirmationCode_key" ON "bookings"("confirmationCode");

-- CreateIndex
CREATE INDEX "bookings_tripId_idx" ON "bookings"("tripId");

-- CreateIndex
CREATE INDEX "bookings_userId_idx" ON "bookings"("userId");

-- CreateIndex
CREATE INDEX "bookings_operatorId_idx" ON "bookings"("operatorId");

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

-- CreateIndex
CREATE INDEX "bookings_confirmationCode_idx" ON "bookings"("confirmationCode");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_slug_idx" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parentCategoryId_idx" ON "categories"("parentCategoryId");

-- CreateIndex
CREATE INDEX "category_page_content_categoryId_locale_idx" ON "category_page_content"("categoryId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "category_page_content_categoryId_locale_key" ON "category_page_content"("categoryId", "locale");

-- CreateIndex
CREATE INDEX "category_translations_categoryId_locale_idx" ON "category_translations"("categoryId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "category_translations_categoryId_locale_key" ON "category_translations"("categoryId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "destinations_slug_key" ON "destinations"("slug");

-- CreateIndex
CREATE INDEX "destinations_slug_idx" ON "destinations"("slug");

-- CreateIndex
CREATE INDEX "destinations_isActive_idx" ON "destinations"("isActive");

-- CreateIndex
CREATE INDEX "destinations_region_idx" ON "destinations"("region");

-- CreateIndex
CREATE INDEX "destinations_parentDestinationId_idx" ON "destinations"("parentDestinationId");

-- CreateIndex
CREATE INDEX "destination_translations_destinationId_locale_idx" ON "destination_translations"("destinationId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "destination_translations_destinationId_locale_key" ON "destination_translations"("destinationId", "locale");

-- CreateIndex
CREATE INDEX "destination_page_content_destinationId_locale_idx" ON "destination_page_content"("destinationId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "destination_page_content_destinationId_locale_key" ON "destination_page_content"("destinationId", "locale");

-- CreateIndex
CREATE INDEX "hubs_destinationId_idx" ON "hubs"("destinationId");

-- CreateIndex
CREATE UNIQUE INDEX "hubs_destinationId_slug_key" ON "hubs"("destinationId", "slug");

-- CreateIndex
CREATE INDEX "hub_translations_hubId_locale_idx" ON "hub_translations"("hubId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "hub_translations_hubId_locale_key" ON "hub_translations"("hubId", "locale");

-- CreateIndex
CREATE INDEX "hub_page_content_hubId_locale_idx" ON "hub_page_content"("hubId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "hub_page_content_hubId_locale_key" ON "hub_page_content"("hubId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "hub_allowed_categories_hubId_categoryId_key" ON "hub_allowed_categories"("hubId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "hub_our_picks_hubId_tourId_key" ON "hub_our_picks"("hubId", "tourId");

-- CreateIndex
CREATE UNIQUE INDEX "hub_comparison_tours_groupId_tourId_key" ON "hub_comparison_tours"("groupId", "tourId");

-- CreateIndex
CREATE INDEX "featured_experiences_entityType_entityId_idx" ON "featured_experiences"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "featured_experiences_destinationId_idx" ON "featured_experiences"("destinationId");

-- CreateIndex
CREATE INDEX "faqs_pageType_entityId_locale_idx" ON "faqs"("pageType", "entityId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "featured_slots_tripId_key" ON "featured_slots"("tripId");

-- CreateIndex
CREATE INDEX "featured_slots_categoryId_status_idx" ON "featured_slots"("categoryId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "featured_slots_categoryId_slotNumber_key" ON "featured_slots"("categoryId", "slotNumber");

-- CreateIndex
CREATE UNIQUE INDEX "slot_locks_tripId_key" ON "slot_locks"("tripId");

-- CreateIndex
CREATE INDEX "slot_locks_slotId_idx" ON "slot_locks"("slotId");

-- CreateIndex
CREATE INDEX "slot_locks_expiresAt_idx" ON "slot_locks"("expiresAt");

-- CreateIndex
CREATE INDEX "slot_history_slotId_idx" ON "slot_history"("slotId");

-- CreateIndex
CREATE UNIQUE INDEX "media_gallery_publicId_key" ON "media_gallery"("publicId");

-- CreateIndex
CREATE INDEX "media_gallery_id_idx" ON "media_gallery"("id");

-- CreateIndex
CREATE INDEX "media_gallery_publicId_idx" ON "media_gallery"("publicId");

-- CreateIndex
CREATE INDEX "media_gallery_url_idx" ON "media_gallery"("url");

-- CreateIndex
CREATE INDEX "media_gallery_userId_idx" ON "media_gallery"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "operators_userId_key" ON "operators"("userId");

-- CreateIndex
CREATE INDEX "operators_verificationStatus_idx" ON "operators"("verificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "operator_company_info_operatorId_key" ON "operator_company_info"("operatorId");

-- CreateIndex
CREATE UNIQUE INDEX "operator_social_media_operatorId_key" ON "operator_social_media"("operatorId");

-- CreateIndex
CREATE UNIQUE INDEX "operator_stripe_config_operatorId_key" ON "operator_stripe_config"("operatorId");

-- CreateIndex
CREATE UNIQUE INDEX "operator_mollie_config_operatorId_key" ON "operator_mollie_config"("operatorId");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_bookingId_key" ON "reviews"("bookingId");

-- CreateIndex
CREATE INDEX "reviews_tripId_isApproved_idx" ON "reviews"("tripId", "isApproved");

-- CreateIndex
CREATE INDEX "reviews_operatorId_isApproved_idx" ON "reviews"("operatorId", "isApproved");

-- CreateIndex
CREATE INDEX "mollie_configuration_id_idx" ON "mollie_configuration"("id");

-- CreateIndex
CREATE INDEX "slug_registry_destinationSlug_slug_isActive_idx" ON "slug_registry"("destinationSlug", "slug", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "slug_registry_destinationSlug_slug_key" ON "slug_registry"("destinationSlug", "slug");

-- CreateIndex
CREATE INDEX "trips_operatorId_idx" ON "trips"("operatorId");

-- CreateIndex
CREATE INDEX "trips_destinationId_idx" ON "trips"("destinationId");

-- CreateIndex
CREATE INDEX "trips_categoryId_idx" ON "trips"("categoryId");

-- CreateIndex
CREATE INDEX "trips_hubId_idx" ON "trips"("hubId");

-- CreateIndex
CREATE INDEX "trips_status_idx" ON "trips"("status");

-- CreateIndex
CREATE UNIQUE INDEX "trips_destinationId_slug_key" ON "trips"("destinationId", "slug");

-- CreateIndex
CREATE INDEX "tour_images_tripId_displayOrder_idx" ON "tour_images"("tripId", "displayOrder");

-- CreateIndex
CREATE INDEX "tour_age_bands_tripId_idx" ON "tour_age_bands"("tripId");

-- CreateIndex
CREATE INDEX "tour_addons_tripId_idx" ON "tour_addons"("tripId");

-- CreateIndex
CREATE UNIQUE INDEX "tour_languages_tripId_language_key" ON "tour_languages"("tripId", "language");

-- CreateIndex
CREATE INDEX "tour_highlights_tripId_displayOrder_idx" ON "tour_highlights"("tripId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "tour_highlight_translations_highlightId_locale_key" ON "tour_highlight_translations"("highlightId", "locale");

-- CreateIndex
CREATE INDEX "tour_inclusions_tripId_idx" ON "tour_inclusions"("tripId");

-- CreateIndex
CREATE UNIQUE INDEX "tour_inclusion_translations_inclusionId_locale_key" ON "tour_inclusion_translations"("inclusionId", "locale");

-- CreateIndex
CREATE INDEX "trip_translations_tripId_locale_idx" ON "trip_translations"("tripId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "trip_translations_tripId_locale_key" ON "trip_translations"("tripId", "locale");

-- CreateIndex
CREATE INDEX "tour_schedules_tripId_startDate_idx" ON "tour_schedules"("tripId", "startDate");

-- CreateIndex
CREATE INDEX "tour_schedules_tripId_status_idx" ON "tour_schedules"("tripId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_id_email_idx" ON "user"("id", "email");

-- CreateIndex
CREATE INDEX "user_role_idx" ON "user"("role");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_token_idx" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "waitlist_entries_slotId_status_idx" ON "waitlist_entries"("slotId", "status");

-- CreateIndex
CREATE INDEX "waitlist_entries_operatorId_idx" ON "waitlist_entries"("operatorId");

-- CreateIndex
CREATE INDEX "webhook_urls_id_idx" ON "webhook_urls"("id");

-- CreateIndex
CREATE INDEX "webhook_urls_webhooksId_idx" ON "webhook_urls"("webhooksId");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_urls_webhooksId_type_key" ON "webhook_urls"("webhooksId", "type");

-- CreateIndex
CREATE INDEX "wishlists_userId_idx" ON "wishlists"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "wishlists_userId_tripId_key" ON "wishlists"("userId", "tripId");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "tour_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentCategoryId_fkey" FOREIGN KEY ("parentCategoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_page_content" ADD CONSTRAINT "category_page_content_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_translations" ADD CONSTRAINT "category_translations_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "destinations" ADD CONSTRAINT "destinations_parentDestinationId_fkey" FOREIGN KEY ("parentDestinationId") REFERENCES "destinations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "destinations" ADD CONSTRAINT "destinations_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "destination_translations" ADD CONSTRAINT "destination_translations_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "destinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "destination_page_content" ADD CONSTRAINT "destination_page_content_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "destinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hubs" ADD CONSTRAINT "hubs_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hubs" ADD CONSTRAINT "hubs_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hub_translations" ADD CONSTRAINT "hub_translations_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "hubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hub_page_content" ADD CONSTRAINT "hub_page_content_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "hubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hub_allowed_categories" ADD CONSTRAINT "hub_allowed_categories_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "hubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hub_allowed_categories" ADD CONSTRAINT "hub_allowed_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hub_our_picks" ADD CONSTRAINT "hub_our_picks_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "hubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hub_our_picks" ADD CONSTRAINT "hub_our_picks_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hub_comparison_groups" ADD CONSTRAINT "hub_comparison_groups_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "hubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hub_comparison_tours" ADD CONSTRAINT "hub_comparison_tours_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "hub_comparison_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hub_comparison_tours" ADD CONSTRAINT "hub_comparison_tours_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "featured_slots" ADD CONSTRAINT "featured_slots_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "featured_slots" ADD CONSTRAINT "featured_slots_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "featured_slots" ADD CONSTRAINT "featured_slots_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_locks" ADD CONSTRAINT "slot_locks_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "featured_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_locks" ADD CONSTRAINT "slot_locks_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_locks" ADD CONSTRAINT "slot_locks_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_history" ADD CONSTRAINT "slot_history_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "featured_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_gallery" ADD CONSTRAINT "media_gallery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operators" ADD CONSTRAINT "operators_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_company_info" ADD CONSTRAINT "operator_company_info_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_social_media" ADD CONSTRAINT "operator_social_media_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_stripe_config" ADD CONSTRAINT "operator_stripe_config_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_mollie_config" ADD CONSTRAINT "operator_mollie_config_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "hubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_images" ADD CONSTRAINT "tour_images_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_age_bands" ADD CONSTRAINT "tour_age_bands_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_addons" ADD CONSTRAINT "tour_addons_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_languages" ADD CONSTRAINT "tour_languages_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_highlights" ADD CONSTRAINT "tour_highlights_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_highlight_translations" ADD CONSTRAINT "tour_highlight_translations_highlightId_fkey" FOREIGN KEY ("highlightId") REFERENCES "tour_highlights"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_inclusions" ADD CONSTRAINT "tour_inclusions_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_inclusion_translations" ADD CONSTRAINT "tour_inclusion_translations_inclusionId_fkey" FOREIGN KEY ("inclusionId") REFERENCES "tour_inclusions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_translations" ADD CONSTRAINT "trip_translations_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_schedules" ADD CONSTRAINT "tour_schedules_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "featured_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_urls" ADD CONSTRAINT "webhook_urls_webhooksId_fkey" FOREIGN KEY ("webhooksId") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
