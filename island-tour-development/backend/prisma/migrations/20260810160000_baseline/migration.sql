-- ═══════════════════════════════════════════════════════════════════════════
-- SQUASHED BASELINE (2026-08-10) - replaces the previous 117-migration
-- history. See prisma/MIGRATION-BASELINE.md for why, how it was verified,
-- and what to do with databases that predate it.
--
-- PROVENANCE, mechanically verified:
--   1. Generated with `prisma migrate diff --from-empty --to-migrations`
--      (the shadow-DB replay of the real history - NOT from schema.prisma,
--      so enum value order and every migrated nuance match production).
--   2. Hand-carried raw SQL the Prisma DSL cannot express (see the marked
--      section near the end): the unaccent extension + immutable wrapper,
--      the departures seat-invariant CHECK, and one NOT NULL the diff
--      engine drops on enum-array columns.
--   3. EQUIVALENCE GATE: a database built from the old 117-migration history
--      and one built from this file produce IDENTICAL
--      `pg_dump --schema-only` output (empty diff, 2026-08-10).
--
-- Existing databases NEVER run this file - they are re-pointed with
-- `prisma migrate resolve --applied 20260810160000_baseline` (runbook in
-- prisma/MIGRATION-BASELINE.md). Only fresh databases execute it.
-- ═══════════════════════════════════════════════════════════════════════════

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."AddOnUnit" AS ENUM ('PER_PERSON', 'FLAT');

-- CreateEnum
CREATE TYPE "public"."AgeBandType" AS ENUM ('ADULT', 'CHILD', 'INFANT', 'YOUTH', 'SENIOR');

-- CreateEnum
CREATE TYPE "public"."AttributeDataType" AS ENUM ('BOOLEAN', 'ENUM', 'ENUM_MULTI', 'INTEGER', 'DECIMAL', 'TEXT');

-- CreateEnum
CREATE TYPE "public"."BandParticipation" AS ENUM ('PARTICIPANT', 'SPECTATOR');

-- CreateEnum
CREATE TYPE "public"."BookingStatus" AS ENUM ('ON_HOLD', 'CONFIRMED', 'EXPIRED', 'CANCELLED', 'REDEEMED', 'PENDING', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."CancellationRefund" AS ENUM ('FULL', 'PARTIAL', 'NONE');

-- CreateEnum
CREATE TYPE "public"."CancelledBy" AS ENUM ('CUSTOMER', 'OPERATOR', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "public"."CollectionDisplayStyle" AS ENUM ('NUMBERED', 'PERSONA');

-- CreateEnum
CREATE TYPE "public"."CollectionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."CollectionType" AS ENUM ('MANUAL', 'DYNAMIC');

-- CreateEnum
CREATE TYPE "public"."Currency" AS ENUM ('USD', 'EUR');

-- CreateEnum
CREATE TYPE "public"."CustomScriptPosition" AS ENUM ('HEAD', 'BODY_END');

-- CreateEnum
CREATE TYPE "public"."DeliveryFormat" AS ENUM ('PDF_URL', 'QRCODE', 'CODE128', 'PKPASS_URL');

-- CreateEnum
CREATE TYPE "public"."DeliveryMethod" AS ENUM ('VOUCHER', 'TICKET');

-- CreateEnum
CREATE TYPE "public"."EligibilityState" AS ENUM ('LOCKED', 'PROVISIONAL', 'ELIGIBLE', 'GRACE', 'DEMOTED');

-- CreateEnum
CREATE TYPE "public"."ExclusionType" AS ENUM ('PAID_ADVANCE', 'PAID_ONSITE', 'UNAVAILABLE', 'NOT_PERMITTED');

-- CreateEnum
CREATE TYPE "public"."FaqPageType" AS ENUM ('category', 'hub', 'destination', 'tour', 'collection', 'homepage');

-- CreateEnum
CREATE TYPE "public"."FeatureType" AS ENUM ('INCLUSION', 'EXCLUSION', 'PREBOOKING_INFORMATION', 'PREARRIVAL_INFORMATION', 'REDEMPTION_INSTRUCTION', 'ACCESSIBILITY_INFORMATION', 'ADDITIONAL_INFORMATION', 'BOOKING_TERM', 'CANCELLATION_TERM', 'HIGHLIGHT');

-- CreateEnum
CREATE TYPE "public"."FilterDisplayType" AS ENUM ('CHECKBOX', 'RANGE_SLIDER', 'RADIO', 'DROPDOWN');

-- CreateEnum
CREATE TYPE "public"."FitnessLevel" AS ENUM ('EASY', 'MODERATE', 'CHALLENGING');

-- CreateEnum
CREATE TYPE "public"."HubPickType" AS ENUM ('BEST_OVERALL', 'MOST_POPULAR', 'BEST_FOR_FAMILIES', 'BEST_VALUE');

-- CreateEnum
CREATE TYPE "public"."HubSectionType" AS ENUM ('DISCOVER', 'LOCAL_TIP', 'FAST_FACT', 'EDITORIAL', 'HIGHLIGHT');

-- CreateEnum
CREATE TYPE "public"."HubStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."HubType" AS ENUM ('LOCATION', 'HIGHLIGHT', 'AREA');

-- CreateEnum
CREATE TYPE "public"."InboxCategory" AS ENUM ('TOURS', 'BOOKINGS', 'CANCELLATIONS', 'PAYMENTS', 'REVIEWS', 'SETTLEMENTS', 'PROMOTION', 'TEAM', 'SYSTEM');

-- CreateEnum
CREATE TYPE "public"."InboxEvent" AS ENUM ('TOUR_SUBMITTED_FOR_REVIEW', 'TOUR_APPROVED', 'TOUR_CHANGES_REQUESTED', 'TOUR_PUBLISHED', 'TOUR_UNLISTED_NO_DEPARTURES', 'SPOTLIGHT_REQUESTED', 'SPOTLIGHT_APPROVED', 'SPOTLIGHT_REJECTED', 'TIER_DEMOTED', 'BOOKING_CONFIRMED', 'BOOKING_CANCELLATION_REQUESTED', 'BOOKING_OPERATOR_REPORTED_CANCELLATION', 'BOOKING_OPERATOR_REPORTED_NON_PAYMENT', 'BOOKING_CANCELLED', 'REVIEW_SUBMITTED', 'REVIEW_PUBLISHED', 'SETTLEMENT_STATEMENT_READY', 'TEAM_SEAT_INVITED', 'BOOKING_CANCELLATION_WITHDRAWN', 'BOOKING_RESTORED', 'CALENDAR_SYNC_CONFLICT', 'CALENDAR_SYNC_FAILED');

-- CreateEnum
CREATE TYPE "public"."InstagramLayout" AS ENUM ('GRID', 'GALLERY');

-- CreateEnum
CREATE TYPE "public"."InstagramMediaType" AS ENUM ('IMAGE', 'VIDEO', 'CAROUSEL_ALBUM');

-- CreateEnum
CREATE TYPE "public"."InstagramSource" AS ENUM ('MANUAL', 'API');

-- CreateEnum
CREATE TYPE "public"."InstagramSyncStatus" AS ENUM ('OK', 'PARTIAL', 'FAILED', 'EXPIRING');

-- CreateEnum
CREATE TYPE "public"."Locale" AS ENUM ('en', 'es', 'nl', 'pt', 'fr', 'de', 'zh');

-- CreateEnum
CREATE TYPE "public"."NotificationDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'DEAD');

-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('PRODUCT_UPDATE', 'AVAILABILITY_UPDATE', 'BOOKING_UPDATE');

-- CreateEnum
CREATE TYPE "public"."OctoAvailabilityType" AS ENUM ('START_TIME', 'OPENING_HOURS');

-- CreateEnum
CREATE TYPE "public"."OnArrivalPayment" AS ENUM ('CARD_OR_CASH', 'CASH_ONLY');

-- CreateEnum
CREATE TYPE "public"."OperatorVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."PageStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."PaymentKind" AS ENUM ('DEPOSIT', 'BALANCE', 'FULL', 'REFUND');

-- CreateEnum
CREATE TYPE "public"."PaymentModel" AS ENUM ('OPERATOR_LINK', 'ON_ARRIVAL', 'PAID_IN_FULL', 'OPERATOR_FULL');

-- CreateEnum
CREATE TYPE "public"."PaymentProvider" AS ENUM ('STRIPE', 'MOLLIE');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('REQUIRES_PAYMENT', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."Permission" AS ENUM ('VIEW_PERMISSIONS', 'MANAGE_SYSTEM', 'MANAGE_TRIPS', 'MANAGE_OPERATORS', 'CREATE_CONTENT', 'VIEW_CONTENT', 'EDIT_CONTENT', 'DELETE_CONTENT', 'VIEW_MEDIA', 'VIEW_ORDERS', 'EDIT_ORDER', 'DELETE_ORDER', 'MANAGE_USERS', 'VIEW_USERS', 'CREATE_USER', 'UPDATE_USER', 'DELETE_USER', 'CREATE_OPERATOR', 'VIEW_OPERATOR_PROFILE', 'EDIT_OPERATOR_PROFILE', 'MANAGE_OPERATOR_PAYMENTS', 'DELETE_OPERATOR', 'CREATE_TRIP', 'VIEW_TRIPS', 'EDIT_TRIP', 'DELETE_TRIP', 'CREATE_BLOG', 'VIEW_BLOGS', 'EDIT_BLOG', 'DELETE_BLOG', 'CREATE_DESTINATION', 'VIEW_DESTINATIONS', 'EDIT_DESTINATION', 'DELETE_DESTINATION', 'MANAGE_HUBS', 'CREATE_ACTIVITY', 'VIEW_ACTIVITIES', 'EDIT_ACTIVITY', 'DELETE_ACTIVITY', 'CREATE_PICKUP_DROP', 'VIEW_PICKUP_DROPS', 'EDIT_PICKUP_DROP', 'DELETE_PICKUP_DROP', 'CREATE_CATEGORY', 'VIEW_CATEGORIES', 'EDIT_CATEGORY', 'DELETE_CATEGORY', 'CREATE_COLLECTION', 'VIEW_COLLECTIONS', 'EDIT_COLLECTION', 'DELETE_COLLECTION', 'MANAGE_AVAILABILITY', 'VIEW_BOOKINGS', 'EDIT_BOOKING', 'DELETE_BOOKING', 'MANAGE_BOOKINGS', 'VIEW_PAYMENTS', 'EDIT_PAYMENT', 'DELETE_PAYMENT', 'MANAGE_PAYMENTS', 'MANAGE_TIERS', 'APPROVE_SPOTLIGHT', 'VIEW_ENQUIRIES', 'DELETE_ENQUIRY', 'REPLY_ENQUIRY', 'VIEW_LEADS', 'EDIT_LEAD', 'DELETE_LEAD', 'VIEW_REVIEWS', 'EDIT_REVIEW', 'DELETE_REVIEW', 'APPROVE_REVIEW', 'UPLOAD_MEDIA', 'MANAGE_MEDIA', 'VIEW_PROFILE', 'EDIT_PROFILE', 'MANAGE_SETTINGS', 'VIEW_SETTINGS', 'VIEW_ANALYTICS', 'EXPORT_DATA', 'BULK_OPERATIONS', 'MANAGE_EDITORIAL', 'MANAGE_STAFF', 'MANAGE_TEAM', 'VIEW_BOOKING_FINANCIALS', 'STOP_SELL');

-- CreateEnum
CREATE TYPE "public"."PickupModel" AS ENUM ('INCLUDED', 'PAID_ADDON', 'NONE');

-- CreateEnum
CREATE TYPE "public"."PopularLinkPlacement" AS ENUM ('HERO_POPULAR', 'SEARCH_PANEL');

-- CreateEnum
CREATE TYPE "public"."PricingModel" AS ENUM ('PER_PERSON', 'UNIT');

-- CreateEnum
CREATE TYPE "public"."RecommendationCategory" AS ENUM ('HOTEL', 'APARTMENT', 'VILLA', 'RESTAURANT', 'BAR', 'CAFE', 'CAR_RENTAL', 'TRANSFER', 'SHOP', 'SPA', 'BEACH_CLUB', 'ATTRACTION', 'ACTIVITY', 'NIGHTLIFE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."RecommendationPlacement" AS ENUM ('THANK_YOU_PAGE', 'CONFIRMATION_EMAIL');

-- CreateEnum
CREATE TYPE "public"."RecommendationRefType" AS ENUM ('TOUR', 'DESTINATION', 'COLLECTION', 'HUB');

-- CreateEnum
CREATE TYPE "public"."RecommendationSource" AS ENUM ('INTERNAL', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "public"."RedemptionMethod" AS ENUM ('DIGITAL', 'PRINT', 'MANIFEST');

-- CreateEnum
CREATE TYPE "public"."Region" AS ENUM ('CARIBBEAN', 'ATLANTIC', 'MEDITERRANEAN', 'ASIA', 'AFRICA');

-- CreateEnum
CREATE TYPE "public"."ReviewFlagReason" AS ENUM ('FAKE', 'ABUSIVE', 'OFF_TOPIC', 'PERSONAL_DATA', 'NOT_A_CUSTOMER');

-- CreateEnum
CREATE TYPE "public"."ReviewFlagStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "public"."ReviewModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'HELD');

-- CreateEnum
CREATE TYPE "public"."ReviewResponseAuthor" AS ENUM ('PLATFORM', 'OPERATOR');

-- CreateEnum
CREATE TYPE "public"."ReviewSource" AS ENUM ('NATIVE', 'IMPORTED_OPERATOR', 'IMPORTED_THIRD_PARTY');

-- CreateEnum
CREATE TYPE "public"."ReviewerType" AS ENUM ('COUPLE', 'FAMILY', 'FRIENDS', 'SOLO');

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('ADMIN', 'EDITOR', 'STAFF', 'GUIDE', 'TOUR_OPERATOR', 'USER');

-- CreateEnum
CREATE TYPE "public"."SettlementStatus" AS ENUM ('RECORDED', 'PAID_OUT', 'INVOICED', 'SETTLED', 'REVERSED');

-- CreateEnum
CREATE TYPE "public"."SlugEntityType" AS ENUM ('TOUR', 'CATEGORY', 'HUB', 'COLLECTION', 'RESERVED');

-- CreateEnum
CREATE TYPE "public"."SpotlightStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'ACTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."StaffSeatRole" AS ENUM ('OWNER', 'MANAGER', 'STAFF');

-- CreateEnum
CREATE TYPE "public"."StaffStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "public"."TierKey" AS ENUM ('premium', 'featured', 'boosted', 'organic', 'standard');

-- CreateEnum
CREATE TYPE "public"."TourApprovalStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."TourBookingType" AS ENUM ('PRIVATE', 'SHARED');

-- CreateEnum
CREATE TYPE "public"."TourStatus" AS ENUM ('DRAFT', 'LIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "public"."WholeUnitType" AS ENUM ('GROUP', 'BOAT', 'VEHICLE', 'AIRCRAFT', 'PACKAGE');

-- CreateEnum
CREATE TYPE "public"."availability_exception_type" AS ENUM ('close_date', 'close_slot', 'add_slot', 'set_capacity');

-- CreateEnum
CREATE TYPE "public"."availability_schedule_status" AS ENUM ('active', 'paused');

-- CreateEnum
CREATE TYPE "public"."calendar_feed_kind" AS ENUM ('bookings', 'departures', 'channel');

-- CreateEnum
CREATE TYPE "public"."closure_reason" AS ENUM ('sold_out', 'not_running');

-- CreateEnum
CREATE TYPE "public"."departure_source" AS ENUM ('schedule', 'exception', 'api');

-- CreateEnum
CREATE TYPE "public"."departure_status" AS ENUM ('open', 'closed', 'sold_out', 'cancelled');

-- CreateTable
CREATE TABLE "public"."account" (
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
CREATE TABLE "public"."attribute_definitions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "dataType" "public"."AttributeDataType" NOT NULL,
    "allowedValues" JSONB,
    "appliesToCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isFilterable" BOOLEAN NOT NULL DEFAULT true,
    "isSortable" BOOLEAN NOT NULL DEFAULT false,
    "filterDisplayType" "public"."FilterDisplayType",
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attribute_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."availability_exceptions" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TIME(0),
    "type" "public"."availability_exception_type" NOT NULL,
    "capacity" INTEGER,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closureBatchId" TEXT,
    "closureReason" "public"."closure_reason",

    CONSTRAINT "availability_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."availability_schedules" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "weekday" SMALLINT NOT NULL,
    "startTime" TIME(0) NOT NULL,
    "capacityOverride" INTEGER,
    "validFrom" DATE NOT NULL,
    "validUntil" DATE,
    "status" "public"."availability_schedule_status" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "availability_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."booking_addons" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "addOnId" TEXT,
    "name" TEXT NOT NULL,
    "unit" "public"."AddOnUnit" NOT NULL DEFAULT 'PER_PERSON',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "booking_addons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."booking_unit_items" (
    "id" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "ageBandId" TEXT,
    "status" "public"."BookingStatus" NOT NULL DEFAULT 'ON_HOLD',
    "utcRedeemedAt" TIMESTAMP(3),
    "contactFirstName" TEXT,
    "contactLastName" TEXT,
    "travelerAge" INTEGER,
    "priceRetail" DECIMAL(10,2) NOT NULL,
    "priceNet" DECIMAL(10,2),
    "ticketCode" TEXT,
    "ticketDeliveryFormat" "public"."DeliveryFormat",
    "ticketUrl" TEXT,

    CONSTRAINT "booking_unit_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bookings" (
    "id" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "departureId" TEXT,
    "operatorId" TEXT NOT NULL,
    "userId" TEXT,
    "resellerReference" TEXT,
    "supplierReference" TEXT,
    "publicRef" TEXT NOT NULL,
    "displayRef" TEXT NOT NULL,
    "status" "public"."BookingStatus" NOT NULL DEFAULT 'ON_HOLD',
    "freesale" BOOLEAN NOT NULL DEFAULT false,
    "testMode" BOOLEAN NOT NULL DEFAULT false,
    "utcExpiresAt" TIMESTAMP(3),
    "utcConfirmedAt" TIMESTAMP(3),
    "utcRedeemedAt" TIMESTAMP(3),
    "paymentModel" "public"."PaymentModel" NOT NULL,
    "currency" "public"."Currency" NOT NULL,
    "localDate" DATE NOT NULL,
    "startTime" TEXT,
    "tourStartDateTime" TIMESTAMP(3),
    "tourEndDateTime" TIMESTAMP(3),
    "pickupRequested" BOOLEAN NOT NULL DEFAULT false,
    "pickupLocationId" TEXT,
    "pickupAddress" TEXT,
    "totalRetail" DECIMAL(10,2) NOT NULL,
    "totalNet" DECIMAL(10,2),
    "commissionRate" DECIMAL(5,4),
    "commissionAmount" DECIMAL(10,2),
    "depositAmount" DECIMAL(10,2) NOT NULL,
    "balanceAmount" DECIMAL(10,2) NOT NULL,
    "taxes" JSONB DEFAULT '[]',
    "couponCode" TEXT,
    "discountAmount" DECIMAL(10,2),
    "totalEur" DECIMAL(10,2),
    "fxRateToEur" DECIMAL(12,6),
    "contactFirstName" TEXT,
    "contactLastName" TEXT,
    "contactFullName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "contactPostalCode" TEXT,
    "contactCountry" TEXT,
    "contactLocales" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "newsletterOptIn" BOOLEAN NOT NULL DEFAULT false,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmTerm" TEXT,
    "utmContent" TEXT,
    "gclid" TEXT,
    "gbraid" TEXT,
    "wbraid" TEXT,
    "fbclid" TEXT,
    "affiliateId" TEXT,
    "island" TEXT NOT NULL,
    "customerLocale" TEXT,
    "customerId" TEXT,
    "conversionFiredAt" TIMESTAMP(3),
    "billingCountry" TEXT,
    "billingPostalCode" TEXT,
    "billingCity" TEXT,
    "paymentMethodLast4" TEXT,
    "paymentMethodBrand" TEXT,
    "cancellationRefund" "public"."CancellationRefund",
    "cancelledBy" "public"."CancelledBy",
    "cancellationReason" TEXT,
    "utcCancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tourTimeZone" TEXT,
    "utcCancellationRequestedAt" TIMESTAMP(3),
    "exclusiveDeparture" BOOLEAN NOT NULL DEFAULT false,
    "eurFxProvider" TEXT,
    "eurFxProviderAsOf" TIMESTAMP(3),
    "sourceBalanceAmount" DECIMAL(10,2),
    "sourceCurrency" "public"."Currency",
    "sourceDepositAmount" DECIMAL(10,2),
    "sourceFxProvider" TEXT,
    "sourceFxProviderAsOf" TIMESTAMP(3),
    "sourceFxRateToBooking" DECIMAL(12,6),
    "sourceTotalRetail" DECIMAL(10,2),
    "onArrivalPayment" "public"."OnArrivalPayment",
    "pickupMinutesPrior" INTEGER,
    "pickupWindowEnd" TEXT,
    "pickupWindowStart" TEXT,
    "reviewWhatsappOptIn" BOOLEAN NOT NULL DEFAULT false,
    "conversionPushedAt" TIMESTAMP(3),
    "pickupTotalPrice" DECIMAL(10,2),
    "pickupUnitPrice" DECIMAL(10,2),
    "utcForfeitedAt" TIMESTAMP(3),
    "utcNonPaymentReportedAt" TIMESTAMP(3),
    "utcConfirmationEmailSentAt" TIMESTAMP(3),
    "utcOperatorNoticeSentAt" TIMESTAMP(3),
    "utcReminderSentAt" TIMESTAMP(3),
    "operatorCancellationReason" TEXT,
    "utcOperatorCancellationReportedAt" TIMESTAMP(3),

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."calendar_feeds" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "kind" "public"."calendar_feed_kind" NOT NULL,
    "token" TEXT NOT NULL,
    "label" TEXT,
    "revokedAt" TIMESTAMP(3),
    "lastFetchedAt" TIMESTAMP(3),
    "fetchCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "calendar_feeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."categories" (
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
    "parentCategoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ogImage" TEXT,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."category_page_content" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "locale" "public"."Locale" NOT NULL,
    "aboutText" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
    "sourceHash" TEXT,

    CONSTRAINT "category_page_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."category_translations" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "locale" "public"."Locale" NOT NULL,
    "name" TEXT,
    "overview" TEXT,
    "h1Override" TEXT,
    "breadcrumbLabel" TEXT,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sourceHash" TEXT,

    CONSTRAINT "category_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."collection_page_content" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "locale" "public"."Locale" NOT NULL,
    "aboutText" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
    "sourceHash" TEXT,

    CONSTRAINT "collection_page_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."collection_tour_rationales" (
    "id" TEXT NOT NULL,
    "collectionTourId" TEXT NOT NULL,
    "locale" "public"."Locale" NOT NULL,
    "rationale" TEXT NOT NULL,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
    "sourceHash" TEXT,

    CONSTRAINT "collection_tour_rationales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."collection_tours" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "collection_tours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."collection_translations" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "locale" "public"."Locale" NOT NULL,
    "name" TEXT,
    "overview" TEXT,
    "curationNote" TEXT,
    "eyebrowLabel" TEXT,
    "h1Override" TEXT,
    "breadcrumbLabel" TEXT,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sourceHash" TEXT,

    CONSTRAINT "collection_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."collections" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "collectionType" "public"."CollectionType" NOT NULL,
    "tourIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "filterQuery" JSONB,
    "heroImage" TEXT,
    "sortOrder" TEXT NOT NULL DEFAULT 'recommended',
    "status" "public"."CollectionStatus" NOT NULL DEFAULT 'DRAFT',
    "displayStyle" "public"."CollectionDisplayStyle" NOT NULL DEFAULT 'PERSONA',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSeeded" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ogImage" TEXT,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."company_informations" (
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
CREATE TABLE "public"."custom_scripts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "position" "public"."CustomScriptPosition" NOT NULL DEFAULT 'BODY_END',
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_scripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."customers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "firstBookingAt" TIMESTAMP(3),
    "lastBookingAt" TIMESTAMP(3),
    "bookingsCount" INTEGER NOT NULL DEFAULT 0,
    "totalSpendEur" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."departures" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TIME(0) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "bookedCount" INTEGER NOT NULL DEFAULT 0,
    "status" "public"."departure_status" NOT NULL DEFAULT 'open',
    "soldOutAt" TIMESTAMP(3),
    "source" "public"."departure_source" NOT NULL DEFAULT 'schedule',
    "externalRef" TEXT,
    "manuallyEdited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closureReason" "public"."closure_reason",

    CONSTRAINT "departures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."destination_page_content" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "locale" "public"."Locale" NOT NULL,
    "aboutText" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
    "sourceHash" TEXT,

    CONSTRAINT "destination_page_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."destination_popular_links" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "categoryId" TEXT,
    "hubId" TEXT,
    "collectionId" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "placement" "public"."PopularLinkPlacement" NOT NULL DEFAULT 'HERO_POPULAR',

    CONSTRAINT "destination_popular_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."destination_translations" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "locale" "public"."Locale" NOT NULL,
    "name" TEXT,
    "overview" TEXT,
    "h1Override" TEXT,
    "breadcrumbLabel" TEXT,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sourceHash" TEXT,

    CONSTRAINT "destination_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."destinations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "heroImage" TEXT,
    "isSeeded" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "region" "public"."Region" NOT NULL,
    "country" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "timezone" TEXT,
    "currency" "public"."Currency",
    "language" TEXT,
    "galleryImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ogImage" TEXT,
    "parentDestinationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "displayOrder" INTEGER,

    CONSTRAINT "destinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."faqs" (
    "id" TEXT NOT NULL,
    "pageType" "public"."FaqPageType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "locale" "public"."Locale" NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "faqGroupId" TEXT,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
    "sourceHash" TEXT,

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."featured_experiences" (
    "id" TEXT NOT NULL,
    "videoUrl" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "posterUrl" TEXT,
    "title" TEXT NOT NULL,

    CONSTRAINT "featured_experiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."force_majeure_pardons" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "force_majeure_pardons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fx_rates" (
    "id" TEXT NOT NULL,
    "baseCurrency" "public"."Currency" NOT NULL,
    "quoteCurrency" "public"."Currency" NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAsOf" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "fx_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."home_page" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "heroImage" TEXT,
    "editorialDestinationId" TEXT,
    "ogImage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."home_page_editorial_cards" (
    "id" TEXT NOT NULL,
    "homeId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "isLink" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "categoryId" TEXT,
    "hubId" TEXT,

    CONSTRAINT "home_page_editorial_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."home_page_translations" (
    "id" TEXT NOT NULL,
    "homeId" TEXT NOT NULL,
    "locale" "public"."Locale" NOT NULL,
    "heroTitle" TEXT,
    "heroSubtitle" TEXT,
    "experiencesTitle" TEXT,
    "editorialTitleLine1" TEXT,
    "editorialTitleLine2" TEXT,
    "editorialBody" TEXT,
    "editorialCta" TEXT,
    "faqTitle" TEXT,
    "faqSubtitle" TEXT,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "metaDescription" TEXT,
    "metaTitle" TEXT,
    "sourceHash" TEXT,

    CONSTRAINT "home_page_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."hub_allowed_categories" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "hub_allowed_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."hub_comparison_group_translations" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "locale" "public"."Locale" NOT NULL,
    "groupName" TEXT NOT NULL,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
    "sourceHash" TEXT,

    CONSTRAINT "hub_comparison_group_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."hub_comparison_groups" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "hub_comparison_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."hub_comparison_tour_translations" (
    "id" TEXT NOT NULL,
    "comparisonTourId" TEXT NOT NULL,
    "locale" "public"."Locale" NOT NULL,
    "standoutNote" TEXT NOT NULL,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
    "sourceHash" TEXT,

    CONSTRAINT "hub_comparison_tour_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."hub_comparison_tours" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "standoutNote" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "hub_comparison_tours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."hub_content_sections" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "locale" "public"."Locale" NOT NULL,
    "sectionType" "public"."HubSectionType" NOT NULL,
    "heading" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "image" TEXT,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
    "sourceHash" TEXT,

    CONSTRAINT "hub_content_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."hub_our_pick_translations" (
    "id" TEXT NOT NULL,
    "ourPickId" TEXT NOT NULL,
    "locale" "public"."Locale" NOT NULL,
    "description" TEXT NOT NULL,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
    "sourceHash" TEXT,

    CONSTRAINT "hub_our_pick_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."hub_our_picks" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "pickType" "public"."HubPickType" NOT NULL,
    "description" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "hub_our_picks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."hub_page_content" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "locale" "public"."Locale" NOT NULL,
    "aboutText" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
    "sourceHash" TEXT,

    CONSTRAINT "hub_page_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."hub_translations" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "locale" "public"."Locale" NOT NULL,
    "name" TEXT,
    "overview" TEXT,
    "heroTagline" TEXT,
    "h1Override" TEXT,
    "breadcrumbLabel" TEXT,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sourceHash" TEXT,

    CONSTRAINT "hub_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."hubs" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "heroImage" TEXT,
    "ogImage" TEXT,
    "hubType" "public"."HubType",
    "status" "public"."HubStatus" NOT NULL DEFAULT 'DRAFT',
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
CREATE TABLE "public"."inbox_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "operatorId" TEXT,
    "category" "public"."InboxCategory" NOT NULL,
    "event" "public"."InboxEvent" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "url" TEXT NOT NULL,
    "actorUserId" TEXT,
    "readAt" TIMESTAMP(3),
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbox_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."instagram_account" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "username" TEXT DEFAULT '',
    "profileUrl" TEXT DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "layout" "public"."InstagramLayout" NOT NULL DEFAULT 'GALLERY',
    "accessToken" TEXT,
    "igUserId" TEXT,
    "lastSyncError" TEXT,
    "lastSyncStatus" "public"."InstagramSyncStatus",
    "lastSyncedAt" TIMESTAMP(3),
    "tokenExpiresAt" TIMESTAMP(3),
    "configAccessToken" TEXT,
    "syncFetchLimit" INTEGER NOT NULL DEFAULT 24,
    "syncIntervalMinutes" INTEGER NOT NULL DEFAULT 1440,

    CONSTRAINT "instagram_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."instagram_posts" (
    "id" TEXT NOT NULL,
    "source" "public"."InstagramSource" NOT NULL DEFAULT 'MANUAL',
    "igMediaId" TEXT,
    "mediaType" "public"."InstagramMediaType" NOT NULL DEFAULT 'IMAGE',
    "permalink" TEXT DEFAULT '',
    "caption" TEXT,
    "imageUrl" TEXT NOT NULL,
    "imagePublicId" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "altText" TEXT,
    "postedAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3),
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "destinationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "videoUrl" TEXT,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "videoPublicId" TEXT,

    CONSTRAINT "instagram_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."integrations_configuration" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "metaCapiToken" TEXT,
    "metaCapiTestCode" TEXT DEFAULT '',
    "googleTranslateApiKey" TEXT,
    "googleTranslateProjectId" TEXT DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "translationProvider" TEXT DEFAULT '',
    "translationApiKey" TEXT,
    "translationModel" TEXT DEFAULT '',
    "translationBaseUrl" TEXT DEFAULT '',

    CONSTRAINT "integrations_configuration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."mailchimp_configuration" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "apiKey" TEXT DEFAULT '',
    "audienceId" TEXT DEFAULT '',
    "serverPrefix" TEXT DEFAULT '',

    CONSTRAINT "mailchimp_configuration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."media_gallery" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "bytes" INTEGER,
    "format" TEXT,
    "mimeType" TEXT,
    "originalName" TEXT,
    "altText" TEXT,
    "description" TEXT,
    "excludeFromIndexing" BOOLEAN NOT NULL DEFAULT false,
    "fileName" TEXT,
    "title" TEXT,
    "height" INTEGER,
    "width" INTEGER,
    "operatorId" TEXT,

    CONSTRAINT "media_gallery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."media_translations" (
    "id" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "locale" "public"."Locale" NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "altText" TEXT,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
    "sourceHash" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."mollie_configuration" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "paymentLabel" TEXT NOT NULL DEFAULT 'Mollie',
    "apiKey" TEXT NOT NULL DEFAULT '',
    "paymentMethods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "profileId" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "mollie_configuration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."mollie_webhook_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'payment',
    "processedAt" TIMESTAMP(3),
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mollie_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notification_deliveries" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "notificationType" "public"."NotificationType" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "public"."NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notification_subscriptions" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "notificationTypes" "public"."NotificationType"[] DEFAULT ARRAY[]::"public"."NotificationType"[],
    "headers" JSONB DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."operator_company_info" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "companyName" TEXT,
    "companyEmail" TEXT,
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
CREATE TABLE "public"."operator_mollie_config" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL DEFAULT '',
    "paymentMethods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operator_mollie_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."operator_social_media" (
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
CREATE TABLE "public"."operator_stripe_config" (
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
CREATE TABLE "public"."operators" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "verificationStatus" "public"."OperatorVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "aggregateRating" DOUBLE PRECISION,
    "aggregateReviewCount" INTEGER NOT NULL DEFAULT 0,
    "aggregatesUpdatedAt" TIMESTAMP(3),
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "cancellationRate90d" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "totalBookings" INTEGER NOT NULL DEFAULT 0,
    "forceMajeurePardons" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "activePaymentProvider" "public"."PaymentProvider" NOT NULL DEFAULT 'STRIPE',

    CONSTRAINT "operators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."outbox_events" (
    "id" TEXT NOT NULL,
    "aggregate" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "dispatchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."page_content_sections" (
    "id" TEXT NOT NULL,
    "pageType" "public"."FaqPageType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "sectionGroupId" TEXT NOT NULL,
    "locale" "public"."Locale" NOT NULL,
    "sectionKey" TEXT,
    "heading" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
    "sourceHash" TEXT,

    CONSTRAINT "page_content_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."page_redirects" (
    "id" TEXT NOT NULL,
    "fromSlug" TEXT NOT NULL,
    "toPageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_redirects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."page_translations" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "locale" "public"."Locale" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pages" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "public"."PageStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "ogImage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."password_change_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "newPasswordHash" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "requestedIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payment_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "activeProvider" "public"."PaymentProvider" NOT NULL DEFAULT 'STRIPE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payments" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "provider" "public"."PaymentProvider" NOT NULL DEFAULT 'STRIPE',
    "kind" "public"."PaymentKind" NOT NULL,
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'REQUIRES_PAYMENT',
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" "public"."Currency" NOT NULL,
    "intentId" TEXT,
    "chargeId" TEXT,
    "refundId" TEXT,
    "methodType" TEXT,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pickup_location_translations" (
    "id" TEXT NOT NULL,
    "pickupLocationId" TEXT NOT NULL,
    "locale" "public"."Locale" NOT NULL,
    "title" TEXT NOT NULL,
    "directions" TEXT,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
    "sourceHash" TEXT,

    CONSTRAINT "pickup_location_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pickup_locations" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "address" TEXT,
    "minutesPrior" INTEGER,
    "windowStart" TEXT,
    "windowEnd" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "price" DECIMAL(10,2),

    CONSTRAINT "pickup_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."platform_reviews_config" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "provider" TEXT,
    "apiKey" TEXT DEFAULT '',
    "businessId" TEXT DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "displayPages" JSONB NOT NULL DEFAULT '["homepage"]',
    "cachedPayload" JSONB,
    "fetchedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_reviews_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."recommendation_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "thankYouPageLimit" INTEGER NOT NULL DEFAULT 3,
    "confirmationEmailLimit" INTEGER NOT NULL DEFAULT 2,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendation_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."recommendation_translations" (
    "id" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "locale" "public"."Locale" NOT NULL,
    "eyebrow" TEXT,
    "areaLabel" TEXT,
    "title" TEXT,
    "description" TEXT,
    "ctaLabel" TEXT,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
    "sourceHash" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendation_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."recommendations" (
    "id" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "imageUrl" TEXT,
    "linkUrl" TEXT,
    "rating" DECIMAL(2,1),
    "reviewCount" INTEGER,
    "sleeps" INTEGER,
    "priceAmount" DECIMAL(10,2),
    "currency" "public"."Currency" NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isSeeded" BOOLEAN NOT NULL DEFAULT false,
    "source" "public"."RecommendationSource" NOT NULL DEFAULT 'EXTERNAL',
    "placements" "public"."RecommendationPlacement"[] DEFAULT ARRAY[]::"public"."RecommendationPlacement"[],
    "refType" "public"."RecommendationRefType",
    "refId" TEXT,
    "category" "public"."RecommendationCategory" NOT NULL DEFAULT 'OTHER',

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."review_flags" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "flaggedByUserId" TEXT NOT NULL,
    "reason" "public"."ReviewFlagReason" NOT NULL,
    "note" TEXT,
    "status" "public"."ReviewFlagStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."review_invitations" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "reviewId" TEXT,
    "sentAt" TIMESTAMP(3),
    "remindedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "suppressedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."review_moderation_logs" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "actorId" TEXT,
    "fromStatus" "public"."ReviewModerationStatus",
    "toStatus" "public"."ReviewModerationStatus",
    "isDeletion" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_moderation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."review_request_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "firstSendLocalHour" INTEGER NOT NULL DEFAULT 10,
    "firstSendDelayDays" INTEGER NOT NULL DEFAULT 1,
    "reminderAfterDays" INTEGER NOT NULL DEFAULT 5,
    "reminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "giveUpAfterDays" INTEGER NOT NULL DEFAULT 30,
    "batchSize" INTEGER NOT NULL DEFAULT 200,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_request_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."review_translations" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "locale" "public"."Locale" NOT NULL,
    "comment" TEXT NOT NULL,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
    "sourceHash" TEXT,

    CONSTRAINT "review_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."reviews" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "ratingValue" INTEGER,
    "ratingGuide" INTEGER,
    "ratingSafety" INTEGER,
    "title" TEXT,
    "reviewerFirstName" TEXT,
    "reviewerInitial" TEXT,
    "reviewerCountry" TEXT,
    "travelMonth" INTEGER,
    "travelYear" INTEGER,
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isVerified" BOOLEAN NOT NULL DEFAULT true,
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "moderationStatus" "public"."ReviewModerationStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "responseText" TEXT,
    "responseAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "departureId" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "responseAuthor" "public"."ReviewResponseAuthor",
    "reviewerType" "public"."ReviewerType",
    "source" "public"."ReviewSource" NOT NULL DEFAULT 'NATIVE',
    "themeTags" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "surface" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."settlements" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "paymentModel" "public"."PaymentModel" NOT NULL,
    "amountCollected" DECIMAL(10,2) NOT NULL,
    "commissionOwed" DECIMAL(10,2) NOT NULL,
    "netPosition" DECIMAL(10,2) NOT NULL,
    "currency" "public"."Currency" NOT NULL DEFAULT 'EUR',
    "operatorPayout" DECIMAL(10,2),
    "status" "public"."SettlementStatus" NOT NULL DEFAULT 'RECORDED',
    "settledAt" TIMESTAMP(3),
    "externalRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."site_info" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "siteName" TEXT DEFAULT '',
    "siteTagline" TEXT DEFAULT '',
    "siteDescription" TEXT DEFAULT '',
    "bookingFormStyle" TEXT DEFAULT 'v2',
    "logo" TEXT DEFAULT '',
    "favicon" TEXT DEFAULT '',
    "enableWhatsappChat" BOOLEAN DEFAULT false,
    "whatsappNumber" TEXT DEFAULT '',
    "enableInstagram" BOOLEAN NOT NULL DEFAULT true,
    "faqs" JSONB DEFAULT '[]',
    "faqHostImage" TEXT,
    "faqHostVideo" TEXT,

    CONSTRAINT "site_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."site_seo" (
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
    "cookiebotCbid" TEXT DEFAULT '',

    CONSTRAINT "site_seo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."slug_redirects" (
    "id" TEXT NOT NULL,
    "destinationSlug" TEXT NOT NULL,
    "fromSlug" TEXT NOT NULL,
    "toSlug" TEXT NOT NULL,
    "entityType" "public"."SlugEntityType" NOT NULL,
    "statusCode" INTEGER NOT NULL DEFAULT 301,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slug_redirects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."slug_registry" (
    "id" TEXT NOT NULL,
    "destinationSlug" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "entityType" "public"."SlugEntityType" NOT NULL,
    "entityId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slug_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."social_media" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "facebookUrl" TEXT DEFAULT '',
    "twitterUrl" TEXT DEFAULT '',
    "linkedinUrl" TEXT DEFAULT '',
    "instagramUrl" TEXT DEFAULT '',
    "tiktokUrl" TEXT DEFAULT '',
    "youtubeUrl" TEXT DEFAULT '',

    CONSTRAINT "social_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."spotlight_requests" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "status" "public"."SpotlightStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "note" TEXT,
    "requestedStartsAt" TIMESTAMP(3),
    "requestedDurationDays" INTEGER,
    "rejectionReason" TEXT,
    "requestedBy" TEXT,

    CONSTRAINT "spotlight_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."staff_designations" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" "public"."Permission"[],
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_designations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."staff_members" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "operatorId" TEXT,
    "seatRole" "public"."StaffSeatRole" NOT NULL DEFAULT 'STAFF',
    "designationId" TEXT,
    "extraPermissions" "public"."Permission"[],
    "revokedPermissions" "public"."Permission"[],
    "status" "public"."StaffStatus" NOT NULL DEFAULT 'INVITED',
    "invitedById" TEXT,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."stripe_configuration" (
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
CREATE TABLE "public"."stripe_webhook_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3),
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tour_addons" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "unit" "public"."AddOnUnit" NOT NULL DEFAULT 'PER_PERSON',
    "maxQuantity" INTEGER NOT NULL DEFAULT 1,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tour_addons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tour_age_bands" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "bandType" "public"."AgeBandType" NOT NULL,
    "participation" "public"."BandParticipation" NOT NULL DEFAULT 'PARTICIPANT',
    "label" TEXT NOT NULL,
    "minAge" INTEGER,
    "maxAge" INTEGER,
    "price" DECIMAL(10,2) NOT NULL,
    "priceOriginal" DECIMAL(10,2),
    "priceNet" DECIMAL(10,2),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tour_age_bands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tour_attributes" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "attributeKey" TEXT NOT NULL,
    "attributeValue" VARCHAR(500) NOT NULL,

    CONSTRAINT "tour_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tour_categories" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "tour_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tour_exclusion_translations" (
    "id" TEXT NOT NULL,
    "exclusionId" TEXT NOT NULL,
    "locale" "public"."Locale" NOT NULL,
    "label" TEXT NOT NULL,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
    "sourceHash" TEXT,

    CONSTRAINT "tour_exclusion_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tour_exclusions" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'x',
    "type" "public"."ExclusionType",
    "priceText" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,

    CONSTRAINT "tour_exclusions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tour_feature_translations" (
    "id" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "locale" "public"."Locale" NOT NULL,
    "text" TEXT NOT NULL,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
    "sourceHash" TEXT,

    CONSTRAINT "tour_feature_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tour_features" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "type" "public"."FeatureType" NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tour_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tour_highlight_translations" (
    "id" TEXT NOT NULL,
    "highlightId" TEXT NOT NULL,
    "locale" "public"."Locale" NOT NULL,
    "text" TEXT NOT NULL,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
    "sourceHash" TEXT,

    CONSTRAINT "tour_highlight_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tour_highlights" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,

    CONSTRAINT "tour_highlights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tour_hubs" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,

    CONSTRAINT "tour_hubs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tour_images" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
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
CREATE TABLE "public"."tour_inclusion_translations" (
    "id" TEXT NOT NULL,
    "inclusionId" TEXT NOT NULL,
    "locale" "public"."Locale" NOT NULL,
    "label" TEXT NOT NULL,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
    "sourceHash" TEXT,

    CONSTRAINT "tour_inclusion_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tour_inclusions" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'check',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,

    CONSTRAINT "tour_inclusions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tour_languages" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "language" TEXT NOT NULL,

    CONSTRAINT "tour_languages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tour_location_translations" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "locale" "public"."Locale" NOT NULL,
    "title" TEXT NOT NULL,
    "shortDescription" TEXT,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
    "sourceHash" TEXT,

    CONSTRAINT "tour_location_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tour_locations" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "streetAddress" TEXT,
    "addressLocality" TEXT,
    "addressRegion" TEXT,
    "postalCode" TEXT,
    "addressCountry" TEXT,
    "minutesTo" INTEGER,
    "minutesAt" INTEGER,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tour_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tour_translations" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "locale" "public"."Locale" NOT NULL,
    "title" TEXT,
    "overview" TEXT,
    "description" TEXT,
    "shortDescription" TEXT,
    "whatToBring" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "knowBeforeYouGo" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notSuitableFor" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "whatToExpectIntro" TEXT,
    "categoryDisplay" TEXT,
    "meetingPointText" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "localTipTitle" TEXT,
    "localTipBody" TEXT,
    "operatorNote" TEXT,
    "sourceHash" TEXT,

    CONSTRAINT "tour_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tours" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "public"."TourStatus" NOT NULL DEFAULT 'DRAFT',
    "timeZone" TEXT NOT NULL,
    "availabilityType" "public"."OctoAvailabilityType" NOT NULL DEFAULT 'START_TIME',
    "instantConfirmation" BOOLEAN NOT NULL DEFAULT true,
    "instantDelivery" BOOLEAN NOT NULL DEFAULT true,
    "availabilityRequired" BOOLEAN NOT NULL DEFAULT true,
    "allowFreesale" BOOLEAN NOT NULL DEFAULT false,
    "deliveryFormats" "public"."DeliveryFormat"[] DEFAULT ARRAY['PDF_URL', 'QRCODE']::"public"."DeliveryFormat"[],
    "deliveryMethods" "public"."DeliveryMethod"[] DEFAULT ARRAY['VOUCHER']::"public"."DeliveryMethod"[],
    "redemptionMethod" "public"."RedemptionMethod" NOT NULL DEFAULT 'DIGITAL',
    "reference" TEXT,
    "pricingModel" "public"."PricingModel" NOT NULL DEFAULT 'PER_PERSON',
    "wholeUnitType" "public"."WholeUnitType",
    "defaultCurrency" "public"."Currency" NOT NULL DEFAULT 'USD',
    "basePrice" DECIMAL(10,2),
    "priceFrom" DECIMAL(10,2),
    "durationMinutesFrom" INTEGER,
    "durationMinutesTo" INTEGER,
    "pickupModel" "public"."PickupModel" NOT NULL DEFAULT 'NONE',
    "pickupRequired" BOOLEAN NOT NULL DEFAULT false,
    "minPartySize" INTEGER NOT NULL DEFAULT 1,
    "maxPartySize" INTEGER NOT NULL DEFAULT 10,
    "bookingCutoffMinutes" INTEGER NOT NULL DEFAULT 120,
    "cancellationHours" INTEGER NOT NULL DEFAULT 48,
    "startTimes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "paymentModel" "public"."PaymentModel" NOT NULL DEFAULT 'OPERATOR_LINK',
    "depositPct" DECIMAL(4,1) NOT NULL DEFAULT 20.0,
    "commissionTier" DECIMAL(4,1) NOT NULL DEFAULT 20.0,
    "tierKey" "public"."TierKey" NOT NULL DEFAULT 'standard',
    "tierRank" SMALLINT NOT NULL DEFAULT 5,
    "tierLockedUntil" TIMESTAMP(3),
    "qualityScore" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "eligibilityState" "public"."EligibilityState" NOT NULL DEFAULT 'LOCKED',
    "graceStartedAt" TIMESTAMP(3),
    "graceMetric" TEXT,
    "isBookable" BOOLEAN NOT NULL DEFAULT false,
    "availabilityConfirmedAt" TIMESTAMP(3),
    "firstPublishedAt" TIMESTAMP(3),
    "h1Override" TEXT,
    "breadcrumbLabel" TEXT,
    "ogImage" TEXT,
    "meetingPointLat" DOUBLE PRECISION,
    "meetingPointLng" DOUBLE PRECISION,
    "departureCity" TEXT,
    "checkInMinutesBefore" INTEGER DEFAULT 30,
    "minAgeYears" INTEGER,
    "fitnessLevel" "public"."FitnessLevel",
    "bookingType" "public"."TourBookingType",
    "weatherDependent" BOOLEAN NOT NULL DEFAULT false,
    "wheelchairAccessible" BOOLEAN NOT NULL DEFAULT true,
    "familyFriendly" BOOLEAN NOT NULL DEFAULT false,
    "suitableForBeginners" BOOLEAN NOT NULL DEFAULT false,
    "isLocalsFavourite" BOOLEAN NOT NULL DEFAULT false,
    "aggregateRating" DOUBLE PRECISION,
    "aggregateReviewCount" INTEGER NOT NULL DEFAULT 0,
    "aggregatesUpdatedAt" TIMESTAMP(3),
    "ratingDistribution" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "photoReviewCount" INTEGER NOT NULL DEFAULT 0,
    "bookingCount" INTEGER NOT NULL DEFAULT 0,
    "bookingCountToday" INTEGER NOT NULL DEFAULT 0,
    "spotsRemaining" INTEGER,
    "lastBookedAt" TIMESTAMP(3),
    "isSponsored" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "likelyToSellOut" BOOLEAN NOT NULL DEFAULT false,
    "likelyToSellOutOverride" BOOLEAN,
    "unitIncludedGuests" INTEGER,
    "extraPersonPrice" DECIMAL(10,2),
    "onArrivalPayment" "public"."OnArrivalPayment" NOT NULL DEFAULT 'CARD_OR_CASH',
    "approvalStatus" "public"."TourApprovalStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "reviewNote" TEXT,
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "tours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."translation_clear_marks" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "unitKey" TEXT NOT NULL,
    "locale" "public"."Locale" NOT NULL,
    "clearedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "translation_clear_marks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."traveler_login_codes" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "traveler_login_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user" (
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
    "role" "public"."Role" NOT NULL DEFAULT 'TOUR_OPERATOR',
    "status" "public"."UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "hasPassword" BOOLEAN NOT NULL DEFAULT false,
    "passwordChangedAt" TIMESTAMP(3),
    "isSystemAccount" BOOLEAN NOT NULL DEFAULT false,
    "inboxDigestShownAt" TIMESTAMP(3),

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."webhook_urls" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "webhooksId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_urls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."webhooks" (
    "id" TEXT NOT NULL DEFAULT 'default',

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."wishlists" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attribute_definitions_isActive_idx" ON "public"."attribute_definitions"("isActive" ASC);

-- CreateIndex
CREATE INDEX "attribute_definitions_isFilterable_idx" ON "public"."attribute_definitions"("isFilterable" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "attribute_definitions_key_key" ON "public"."attribute_definitions"("key" ASC);

-- CreateIndex
CREATE INDEX "availability_exceptions_tourId_date_idx" ON "public"."availability_exceptions"("tourId" ASC, "date" ASC);

-- CreateIndex
CREATE INDEX "availability_exceptions_tourId_date_startTime_idx" ON "public"."availability_exceptions"("tourId" ASC, "date" ASC, "startTime" ASC);

-- CreateIndex
CREATE INDEX "availability_exceptions_tourId_type_createdAt_idx" ON "public"."availability_exceptions"("tourId" ASC, "type" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "availability_schedules_tourId_weekday_startTime_validFrom_key" ON "public"."availability_schedules"("tourId" ASC, "weekday" ASC, "startTime" ASC, "validFrom" ASC);

-- CreateIndex
CREATE INDEX "availability_schedules_tourId_weekday_status_idx" ON "public"."availability_schedules"("tourId" ASC, "weekday" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "booking_addons_bookingId_idx" ON "public"."booking_addons"("bookingId" ASC);

-- CreateIndex
CREATE INDEX "booking_unit_items_bookingId_idx" ON "public"."booking_unit_items"("bookingId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "booking_unit_items_uuid_key" ON "public"."booking_unit_items"("uuid" ASC);

-- CreateIndex
CREATE INDEX "bookings_departureId_idx" ON "public"."bookings"("departureId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "bookings_displayRef_key" ON "public"."bookings"("displayRef" ASC);

-- CreateIndex
CREATE INDEX "bookings_localDate_idx" ON "public"."bookings"("localDate" ASC);

-- CreateIndex
CREATE INDEX "bookings_operatorId_idx" ON "public"."bookings"("operatorId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "bookings_publicRef_key" ON "public"."bookings"("publicRef" ASC);

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "public"."bookings"("status" ASC);

-- CreateIndex
CREATE INDEX "bookings_tourId_idx" ON "public"."bookings"("tourId" ASC);

-- CreateIndex
CREATE INDEX "bookings_userId_idx" ON "public"."bookings"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "bookings_uuid_key" ON "public"."bookings"("uuid" ASC);

-- CreateIndex
CREATE INDEX "calendar_feeds_operatorId_idx" ON "public"."calendar_feeds"("operatorId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "calendar_feeds_operatorId_kind_key" ON "public"."calendar_feeds"("operatorId" ASC, "kind" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "calendar_feeds_token_key" ON "public"."calendar_feeds"("token" ASC);

-- CreateIndex
CREATE INDEX "categories_parentCategoryId_idx" ON "public"."categories"("parentCategoryId" ASC);

-- CreateIndex
CREATE INDEX "categories_slug_idx" ON "public"."categories"("slug" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "public"."categories"("slug" ASC);

-- CreateIndex
CREATE INDEX "category_page_content_categoryId_locale_idx" ON "public"."category_page_content"("categoryId" ASC, "locale" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "category_page_content_categoryId_locale_key" ON "public"."category_page_content"("categoryId" ASC, "locale" ASC);

-- CreateIndex
CREATE INDEX "category_translations_categoryId_locale_idx" ON "public"."category_translations"("categoryId" ASC, "locale" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "category_translations_categoryId_locale_key" ON "public"."category_translations"("categoryId" ASC, "locale" ASC);

-- CreateIndex
CREATE INDEX "collection_page_content_collectionId_locale_idx" ON "public"."collection_page_content"("collectionId" ASC, "locale" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "collection_page_content_collectionId_locale_key" ON "public"."collection_page_content"("collectionId" ASC, "locale" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "collection_tour_rationales_collectionTourId_locale_key" ON "public"."collection_tour_rationales"("collectionTourId" ASC, "locale" ASC);

-- CreateIndex
CREATE INDEX "collection_tours_collectionId_position_idx" ON "public"."collection_tours"("collectionId" ASC, "position" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "collection_tours_collectionId_tourId_key" ON "public"."collection_tours"("collectionId" ASC, "tourId" ASC);

-- CreateIndex
CREATE INDEX "collection_translations_collectionId_locale_idx" ON "public"."collection_translations"("collectionId" ASC, "locale" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "collection_translations_collectionId_locale_key" ON "public"."collection_translations"("collectionId" ASC, "locale" ASC);

-- CreateIndex
CREATE INDEX "collections_destinationId_idx" ON "public"."collections"("destinationId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "collections_destinationId_slug_key" ON "public"."collections"("destinationId" ASC, "slug" ASC);

-- CreateIndex
CREATE INDEX "collections_destinationId_status_idx" ON "public"."collections"("destinationId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "custom_scripts_isActive_position_displayOrder_idx" ON "public"."custom_scripts"("isActive" ASC, "position" ASC, "displayOrder" ASC);

-- CreateIndex
CREATE INDEX "customers_operatorId_idx" ON "public"."customers"("operatorId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "customers_userId_operatorId_key" ON "public"."customers"("userId" ASC, "operatorId" ASC);

-- CreateIndex
CREATE INDEX "departures_tourId_date_idx" ON "public"."departures"("tourId" ASC, "date" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "departures_tourId_date_startTime_key" ON "public"."departures"("tourId" ASC, "date" ASC, "startTime" ASC);

-- CreateIndex
CREATE INDEX "departures_tourId_status_date_idx" ON "public"."departures"("tourId" ASC, "status" ASC, "date" ASC);

-- CreateIndex
CREATE INDEX "destination_page_content_destinationId_locale_idx" ON "public"."destination_page_content"("destinationId" ASC, "locale" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "destination_page_content_destinationId_locale_key" ON "public"."destination_page_content"("destinationId" ASC, "locale" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "destination_popular_links_destinationId_placement_displayOr_key" ON "public"."destination_popular_links"("destinationId" ASC, "placement" ASC, "displayOrder" ASC);

-- CreateIndex
CREATE INDEX "destination_popular_links_destinationId_placement_idx" ON "public"."destination_popular_links"("destinationId" ASC, "placement" ASC);

-- CreateIndex
CREATE INDEX "destination_translations_destinationId_locale_idx" ON "public"."destination_translations"("destinationId" ASC, "locale" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "destination_translations_destinationId_locale_key" ON "public"."destination_translations"("destinationId" ASC, "locale" ASC);

-- CreateIndex
CREATE INDEX "destinations_isActive_idx" ON "public"."destinations"("isActive" ASC);

-- CreateIndex
CREATE INDEX "destinations_parentDestinationId_idx" ON "public"."destinations"("parentDestinationId" ASC);

-- CreateIndex
CREATE INDEX "destinations_region_idx" ON "public"."destinations"("region" ASC);

-- CreateIndex
CREATE INDEX "destinations_slug_idx" ON "public"."destinations"("slug" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "destinations_slug_key" ON "public"."destinations"("slug" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "faqs_pageType_entityId_faqGroupId_locale_key" ON "public"."faqs"("pageType" ASC, "entityId" ASC, "faqGroupId" ASC, "locale" ASC);

-- CreateIndex
CREATE INDEX "faqs_pageType_entityId_locale_idx" ON "public"."faqs"("pageType" ASC, "entityId" ASC, "locale" ASC);

-- CreateIndex
CREATE INDEX "force_majeure_pardons_destinationId_startDate_endDate_idx" ON "public"."force_majeure_pardons"("destinationId" ASC, "startDate" ASC, "endDate" ASC);

-- CreateIndex
CREATE INDEX "fx_rates_baseCurrency_quoteCurrency_isActive_idx" ON "public"."fx_rates"("baseCurrency" ASC, "quoteCurrency" ASC, "isActive" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "fx_rates_baseCurrency_quoteCurrency_providerAsOf_provider_key" ON "public"."fx_rates"("baseCurrency" ASC, "quoteCurrency" ASC, "providerAsOf" ASC, "provider" ASC);

-- CreateIndex
CREATE INDEX "fx_rates_expiresAt_idx" ON "public"."fx_rates"("expiresAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "home_page_editorial_cards_homeId_displayOrder_key" ON "public"."home_page_editorial_cards"("homeId" ASC, "displayOrder" ASC);

-- CreateIndex
CREATE INDEX "home_page_translations_homeId_locale_idx" ON "public"."home_page_translations"("homeId" ASC, "locale" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "home_page_translations_homeId_locale_key" ON "public"."home_page_translations"("homeId" ASC, "locale" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "hub_allowed_categories_hubId_categoryId_key" ON "public"."hub_allowed_categories"("hubId" ASC, "categoryId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "hub_comparison_group_translations_groupId_locale_key" ON "public"."hub_comparison_group_translations"("groupId" ASC, "locale" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "hub_comparison_tour_translations_comparisonTourId_locale_key" ON "public"."hub_comparison_tour_translations"("comparisonTourId" ASC, "locale" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "hub_comparison_tours_groupId_tourId_key" ON "public"."hub_comparison_tours"("groupId" ASC, "tourId" ASC);

-- CreateIndex
CREATE INDEX "hub_content_sections_hubId_locale_sectionType_displayOrder_idx" ON "public"."hub_content_sections"("hubId" ASC, "locale" ASC, "sectionType" ASC, "displayOrder" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "hub_content_sections_hubId_locale_sectionType_displayOrder_key" ON "public"."hub_content_sections"("hubId" ASC, "locale" ASC, "sectionType" ASC, "displayOrder" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "hub_our_pick_translations_ourPickId_locale_key" ON "public"."hub_our_pick_translations"("ourPickId" ASC, "locale" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "hub_our_picks_hubId_tourId_key" ON "public"."hub_our_picks"("hubId" ASC, "tourId" ASC);

-- CreateIndex
CREATE INDEX "hub_page_content_hubId_locale_idx" ON "public"."hub_page_content"("hubId" ASC, "locale" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "hub_page_content_hubId_locale_key" ON "public"."hub_page_content"("hubId" ASC, "locale" ASC);

-- CreateIndex
CREATE INDEX "hub_translations_hubId_locale_idx" ON "public"."hub_translations"("hubId" ASC, "locale" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "hub_translations_hubId_locale_key" ON "public"."hub_translations"("hubId" ASC, "locale" ASC);

-- CreateIndex
CREATE INDEX "hubs_destinationId_idx" ON "public"."hubs"("destinationId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "hubs_destinationId_slug_key" ON "public"."hubs"("destinationId" ASC, "slug" ASC);

-- CreateIndex
CREATE INDEX "inbox_notifications_userId_createdAt_idx" ON "public"."inbox_notifications"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "inbox_notifications_userId_dedupeKey_key" ON "public"."inbox_notifications"("userId" ASC, "dedupeKey" ASC);

-- CreateIndex
CREATE INDEX "inbox_notifications_userId_readAt_idx" ON "public"."inbox_notifications"("userId" ASC, "readAt" ASC);

-- CreateIndex
CREATE INDEX "instagram_posts_destinationId_idx" ON "public"."instagram_posts"("destinationId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "instagram_posts_igMediaId_key" ON "public"."instagram_posts"("igMediaId" ASC);

-- CreateIndex
CREATE INDEX "instagram_posts_isActive_displayOrder_idx" ON "public"."instagram_posts"("isActive" ASC, "displayOrder" ASC);

-- CreateIndex
CREATE INDEX "media_gallery_id_idx" ON "public"."media_gallery"("id" ASC);

-- CreateIndex
CREATE INDEX "media_gallery_operatorId_idx" ON "public"."media_gallery"("operatorId" ASC);

-- CreateIndex
CREATE INDEX "media_gallery_publicId_idx" ON "public"."media_gallery"("publicId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "media_gallery_publicId_key" ON "public"."media_gallery"("publicId" ASC);

-- CreateIndex
CREATE INDEX "media_gallery_url_idx" ON "public"."media_gallery"("url" ASC);

-- CreateIndex
CREATE INDEX "media_gallery_userId_idx" ON "public"."media_gallery"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "media_translations_mediaId_locale_key" ON "public"."media_translations"("mediaId" ASC, "locale" ASC);

-- CreateIndex
CREATE INDEX "mollie_configuration_id_idx" ON "public"."mollie_configuration"("id" ASC);

-- CreateIndex
CREATE INDEX "notification_deliveries_subscriptionId_status_idx" ON "public"."notification_deliveries"("subscriptionId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "notification_subscriptions_operatorId_idx" ON "public"."notification_subscriptions"("operatorId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "operator_company_info_operatorId_key" ON "public"."operator_company_info"("operatorId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "operator_mollie_config_operatorId_key" ON "public"."operator_mollie_config"("operatorId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "operator_social_media_operatorId_key" ON "public"."operator_social_media"("operatorId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "operator_stripe_config_operatorId_key" ON "public"."operator_stripe_config"("operatorId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "operators_userId_key" ON "public"."operators"("userId" ASC);

-- CreateIndex
CREATE INDEX "operators_verificationStatus_idx" ON "public"."operators"("verificationStatus" ASC);

-- CreateIndex
CREATE INDEX "outbox_events_dispatchedAt_idx" ON "public"."outbox_events"("dispatchedAt" ASC);

-- CreateIndex
CREATE INDEX "page_content_sections_pageType_entityId_locale_displayOrder_idx" ON "public"."page_content_sections"("pageType" ASC, "entityId" ASC, "locale" ASC, "displayOrder" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "page_content_sections_pageType_entityId_sectionGroupId_loca_key" ON "public"."page_content_sections"("pageType" ASC, "entityId" ASC, "sectionGroupId" ASC, "locale" ASC);

-- CreateIndex
CREATE INDEX "page_redirects_fromSlug_idx" ON "public"."page_redirects"("fromSlug" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "page_redirects_fromSlug_key" ON "public"."page_redirects"("fromSlug" ASC);

-- CreateIndex
CREATE INDEX "page_translations_pageId_locale_idx" ON "public"."page_translations"("pageId" ASC, "locale" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "page_translations_pageId_locale_key" ON "public"."page_translations"("pageId" ASC, "locale" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "pages_slug_key" ON "public"."pages"("slug" ASC);

-- CreateIndex
CREATE INDEX "pages_status_idx" ON "public"."pages"("status" ASC);

-- CreateIndex
CREATE INDEX "password_change_requests_expiresAt_idx" ON "public"."password_change_requests"("expiresAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "password_change_requests_tokenHash_key" ON "public"."password_change_requests"("tokenHash" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "password_change_requests_userId_key" ON "public"."password_change_requests"("userId" ASC);

-- CreateIndex
CREATE INDEX "payments_bookingId_idx" ON "public"."payments"("bookingId" ASC);

-- CreateIndex
CREATE INDEX "payments_intentId_idx" ON "public"."payments"("intentId" ASC);

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "public"."payments"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "pickup_location_translations_pickupLocationId_locale_key" ON "public"."pickup_location_translations"("pickupLocationId" ASC, "locale" ASC);

-- CreateIndex
CREATE INDEX "pickup_locations_tourId_idx" ON "public"."pickup_locations"("tourId" ASC);

-- CreateIndex
CREATE INDEX "recommendation_translations_recommendationId_locale_idx" ON "public"."recommendation_translations"("recommendationId" ASC, "locale" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "recommendation_translations_recommendationId_locale_key" ON "public"."recommendation_translations"("recommendationId" ASC, "locale" ASC);

-- CreateIndex
CREATE INDEX "recommendations_isEnabled_displayOrder_id_idx" ON "public"."recommendations"("isEnabled" ASC, "displayOrder" ASC, "id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "review_flags_reviewId_flaggedByUserId_key" ON "public"."review_flags"("reviewId" ASC, "flaggedByUserId" ASC);

-- CreateIndex
CREATE INDEX "review_flags_status_createdAt_idx" ON "public"."review_flags"("status" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "review_invitations_bookingId_key" ON "public"."review_invitations"("bookingId" ASC);

-- CreateIndex
CREATE INDEX "review_invitations_remindedAt_sentAt_completedAt_idx" ON "public"."review_invitations"("remindedAt" ASC, "sentAt" ASC, "completedAt" ASC);

-- CreateIndex
CREATE INDEX "review_invitations_sentAt_completedAt_idx" ON "public"."review_invitations"("sentAt" ASC, "completedAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "review_invitations_token_key" ON "public"."review_invitations"("token" ASC);

-- CreateIndex
CREATE INDEX "review_moderation_logs_actorId_idx" ON "public"."review_moderation_logs"("actorId" ASC);

-- CreateIndex
CREATE INDEX "review_moderation_logs_reviewId_createdAt_idx" ON "public"."review_moderation_logs"("reviewId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "review_translations_reviewId_locale_key" ON "public"."review_translations"("reviewId" ASC, "locale" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "reviews_bookingId_key" ON "public"."reviews"("bookingId" ASC);

-- CreateIndex
CREATE INDEX "reviews_departureId_idx" ON "public"."reviews"("departureId" ASC);

-- CreateIndex
CREATE INDEX "reviews_moderationStatus_createdAt_idx" ON "public"."reviews"("moderationStatus" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "reviews_operatorId_moderationStatus_idx" ON "public"."reviews"("operatorId" ASC, "moderationStatus" ASC);

-- CreateIndex
CREATE INDEX "reviews_tourId_moderationStatus_createdAt_idx" ON "public"."reviews"("tourId" ASC, "moderationStatus" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "reviews_tourId_rating_idx" ON "public"."reviews"("tourId" ASC, "rating" ASC);

-- CreateIndex
CREATE INDEX "session_token_idx" ON "public"."session"("token" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "public"."session"("token" ASC);

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "public"."session"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "settlements_bookingId_key" ON "public"."settlements"("bookingId" ASC);

-- CreateIndex
CREATE INDEX "settlements_operatorId_status_idx" ON "public"."settlements"("operatorId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "settlements_status_idx" ON "public"."settlements"("status" ASC);

-- CreateIndex
CREATE INDEX "slug_redirects_destinationSlug_fromSlug_idx" ON "public"."slug_redirects"("destinationSlug" ASC, "fromSlug" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "slug_redirects_destinationSlug_fromSlug_key" ON "public"."slug_redirects"("destinationSlug" ASC, "fromSlug" ASC);

-- CreateIndex
CREATE INDEX "slug_registry_destinationSlug_slug_isActive_idx" ON "public"."slug_registry"("destinationSlug" ASC, "slug" ASC, "isActive" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "slug_registry_destinationSlug_slug_key" ON "public"."slug_registry"("destinationSlug" ASC, "slug" ASC);

-- CreateIndex
CREATE INDEX "spotlight_requests_destinationId_status_idx" ON "public"."spotlight_requests"("destinationId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "spotlight_requests_tourId_idx" ON "public"."spotlight_requests"("tourId" ASC);

-- CreateIndex
CREATE INDEX "staff_designations_operatorId_idx" ON "public"."staff_designations"("operatorId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "staff_designations_operatorId_name_key" ON "public"."staff_designations"("operatorId" ASC, "name" ASC);

-- CreateIndex
CREATE INDEX "staff_members_designationId_idx" ON "public"."staff_members"("designationId" ASC);

-- CreateIndex
CREATE INDEX "staff_members_operatorId_idx" ON "public"."staff_members"("operatorId" ASC);

-- CreateIndex
CREATE INDEX "staff_members_status_idx" ON "public"."staff_members"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "staff_members_userId_key" ON "public"."staff_members"("userId" ASC);

-- CreateIndex
CREATE INDEX "tour_addons_tourId_idx" ON "public"."tour_addons"("tourId" ASC);

-- CreateIndex
CREATE INDEX "tour_age_bands_tourId_idx" ON "public"."tour_age_bands"("tourId" ASC);

-- CreateIndex
CREATE INDEX "tour_attributes_attributeKey_attributeValue_idx" ON "public"."tour_attributes"("attributeKey" ASC, "attributeValue" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "tour_attributes_tourId_attributeKey_key" ON "public"."tour_attributes"("tourId" ASC, "attributeKey" ASC);

-- CreateIndex
CREATE INDEX "tour_categories_categoryId_idx" ON "public"."tour_categories"("categoryId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "tour_categories_tourId_categoryId_key" ON "public"."tour_categories"("tourId" ASC, "categoryId" ASC);

-- CreateIndex
CREATE INDEX "tour_categories_tourId_isPrimary_idx" ON "public"."tour_categories"("tourId" ASC, "isPrimary" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "tour_exclusion_translations_exclusionId_locale_key" ON "public"."tour_exclusion_translations"("exclusionId" ASC, "locale" ASC);

-- CreateIndex
CREATE INDEX "tour_exclusions_tourId_idx" ON "public"."tour_exclusions"("tourId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "tour_feature_translations_featureId_locale_key" ON "public"."tour_feature_translations"("featureId" ASC, "locale" ASC);

-- CreateIndex
CREATE INDEX "tour_features_tourId_type_idx" ON "public"."tour_features"("tourId" ASC, "type" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "tour_highlight_translations_highlightId_locale_key" ON "public"."tour_highlight_translations"("highlightId" ASC, "locale" ASC);

-- CreateIndex
CREATE INDEX "tour_highlights_tourId_displayOrder_idx" ON "public"."tour_highlights"("tourId" ASC, "displayOrder" ASC);

-- CreateIndex
CREATE INDEX "tour_hubs_hubId_idx" ON "public"."tour_hubs"("hubId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "tour_hubs_tourId_hubId_key" ON "public"."tour_hubs"("tourId" ASC, "hubId" ASC);

-- CreateIndex
CREATE INDEX "tour_images_tourId_displayOrder_idx" ON "public"."tour_images"("tourId" ASC, "displayOrder" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "tour_inclusion_translations_inclusionId_locale_key" ON "public"."tour_inclusion_translations"("inclusionId" ASC, "locale" ASC);

-- CreateIndex
CREATE INDEX "tour_inclusions_tourId_idx" ON "public"."tour_inclusions"("tourId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "tour_languages_tourId_language_key" ON "public"."tour_languages"("tourId" ASC, "language" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "tour_location_translations_locationId_locale_key" ON "public"."tour_location_translations"("locationId" ASC, "locale" ASC);

-- CreateIndex
CREATE INDEX "tour_locations_tourId_idx" ON "public"."tour_locations"("tourId" ASC);

-- CreateIndex
CREATE INDEX "tour_translations_tourId_locale_idx" ON "public"."tour_translations"("tourId" ASC, "locale" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "tour_translations_tourId_locale_key" ON "public"."tour_translations"("tourId" ASC, "locale" ASC);

-- CreateIndex
CREATE INDEX "tours_destinationId_idx" ON "public"."tours"("destinationId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "tours_destinationId_slug_key" ON "public"."tours"("destinationId" ASC, "slug" ASC);

-- CreateIndex
CREATE INDEX "tours_isBookable_idx" ON "public"."tours"("isBookable" ASC);

-- CreateIndex
CREATE INDEX "tours_operatorId_idx" ON "public"."tours"("operatorId" ASC);

-- CreateIndex
CREATE INDEX "tours_ranking_idx" ON "public"."tours"("destinationId" ASC, "status" ASC, "isActive" ASC, "isBookable" ASC, "isSponsored" DESC, "tierRank" ASC, "qualityScore" DESC, "id" ASC);

-- CreateIndex
CREATE INDEX "tours_status_idx" ON "public"."tours"("status" ASC);

-- CreateIndex
CREATE INDEX "tours_tierRank_qualityScore_idx" ON "public"."tours"("tierRank" ASC, "qualityScore" ASC);

-- CreateIndex
CREATE INDEX "translation_clear_marks_entityType_entityId_idx" ON "public"."translation_clear_marks"("entityType" ASC, "entityId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "translation_clear_marks_entityType_entityId_unitKey_locale_key" ON "public"."translation_clear_marks"("entityType" ASC, "entityId" ASC, "unitKey" ASC, "locale" ASC);

-- CreateIndex
CREATE INDEX "traveler_login_codes_email_createdAt_idx" ON "public"."traveler_login_codes"("email" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "public"."user"("email" ASC);

-- CreateIndex
CREATE INDEX "user_id_email_idx" ON "public"."user"("id" ASC, "email" ASC);

-- CreateIndex
CREATE INDEX "user_role_idx" ON "public"."user"("role" ASC);

-- CreateIndex
CREATE INDEX "webhook_urls_id_idx" ON "public"."webhook_urls"("id" ASC);

-- CreateIndex
CREATE INDEX "webhook_urls_webhooksId_idx" ON "public"."webhook_urls"("webhooksId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "webhook_urls_webhooksId_type_key" ON "public"."webhook_urls"("webhooksId" ASC, "type" ASC);

-- CreateIndex
CREATE INDEX "wishlists_userId_idx" ON "public"."wishlists"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "wishlists_userId_tourId_key" ON "public"."wishlists"("userId" ASC, "tourId" ASC);

-- AddForeignKey
ALTER TABLE "public"."account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."availability_exceptions" ADD CONSTRAINT "availability_exceptions_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "public"."tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."availability_schedules" ADD CONSTRAINT "availability_schedules_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "public"."tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."booking_addons" ADD CONSTRAINT "booking_addons_addOnId_fkey" FOREIGN KEY ("addOnId") REFERENCES "public"."tour_addons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."booking_addons" ADD CONSTRAINT "booking_addons_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."booking_unit_items" ADD CONSTRAINT "booking_unit_items_ageBandId_fkey" FOREIGN KEY ("ageBandId") REFERENCES "public"."tour_age_bands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."booking_unit_items" ADD CONSTRAINT "booking_unit_items_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bookings" ADD CONSTRAINT "bookings_departureId_fkey" FOREIGN KEY ("departureId") REFERENCES "public"."departures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bookings" ADD CONSTRAINT "bookings_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "public"."operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bookings" ADD CONSTRAINT "bookings_pickupLocationId_fkey" FOREIGN KEY ("pickupLocationId") REFERENCES "public"."pickup_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bookings" ADD CONSTRAINT "bookings_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "public"."tours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bookings" ADD CONSTRAINT "bookings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."calendar_feeds" ADD CONSTRAINT "calendar_feeds_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "public"."operators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."categories" ADD CONSTRAINT "categories_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."categories" ADD CONSTRAINT "categories_parentCategoryId_fkey" FOREIGN KEY ("parentCategoryId") REFERENCES "public"."categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."category_page_content" ADD CONSTRAINT "category_page_content_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."category_translations" ADD CONSTRAINT "category_translations_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."collection_page_content" ADD CONSTRAINT "collection_page_content_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "public"."collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."collection_tour_rationales" ADD CONSTRAINT "collection_tour_rationales_collectionTourId_fkey" FOREIGN KEY ("collectionTourId") REFERENCES "public"."collection_tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."collection_tours" ADD CONSTRAINT "collection_tours_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "public"."collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."collection_tours" ADD CONSTRAINT "collection_tours_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "public"."tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."collection_translations" ADD CONSTRAINT "collection_translations_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "public"."collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."collections" ADD CONSTRAINT "collections_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."collections" ADD CONSTRAINT "collections_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "public"."destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "public"."operators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."departures" ADD CONSTRAINT "departures_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "public"."tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."destination_page_content" ADD CONSTRAINT "destination_page_content_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "public"."destinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."destination_popular_links" ADD CONSTRAINT "destination_popular_links_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."destination_popular_links" ADD CONSTRAINT "destination_popular_links_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "public"."collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."destination_popular_links" ADD CONSTRAINT "destination_popular_links_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "public"."destinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."destination_popular_links" ADD CONSTRAINT "destination_popular_links_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "public"."hubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."destination_translations" ADD CONSTRAINT "destination_translations_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "public"."destinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."destinations" ADD CONSTRAINT "destinations_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."destinations" ADD CONSTRAINT "destinations_parentDestinationId_fkey" FOREIGN KEY ("parentDestinationId") REFERENCES "public"."destinations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."force_majeure_pardons" ADD CONSTRAINT "force_majeure_pardons_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "public"."destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."home_page" ADD CONSTRAINT "home_page_editorialDestinationId_fkey" FOREIGN KEY ("editorialDestinationId") REFERENCES "public"."destinations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."home_page_editorial_cards" ADD CONSTRAINT "home_page_editorial_cards_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."home_page_editorial_cards" ADD CONSTRAINT "home_page_editorial_cards_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "public"."home_page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."home_page_editorial_cards" ADD CONSTRAINT "home_page_editorial_cards_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "public"."hubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."home_page_translations" ADD CONSTRAINT "home_page_translations_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "public"."home_page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."hub_allowed_categories" ADD CONSTRAINT "hub_allowed_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."hub_allowed_categories" ADD CONSTRAINT "hub_allowed_categories_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "public"."hubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."hub_comparison_group_translations" ADD CONSTRAINT "hub_comparison_group_translations_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."hub_comparison_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."hub_comparison_groups" ADD CONSTRAINT "hub_comparison_groups_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "public"."hubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."hub_comparison_tour_translations" ADD CONSTRAINT "hub_comparison_tour_translations_comparisonTourId_fkey" FOREIGN KEY ("comparisonTourId") REFERENCES "public"."hub_comparison_tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."hub_comparison_tours" ADD CONSTRAINT "hub_comparison_tours_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."hub_comparison_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."hub_comparison_tours" ADD CONSTRAINT "hub_comparison_tours_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "public"."tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."hub_content_sections" ADD CONSTRAINT "hub_content_sections_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "public"."hubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."hub_our_pick_translations" ADD CONSTRAINT "hub_our_pick_translations_ourPickId_fkey" FOREIGN KEY ("ourPickId") REFERENCES "public"."hub_our_picks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."hub_our_picks" ADD CONSTRAINT "hub_our_picks_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "public"."hubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."hub_our_picks" ADD CONSTRAINT "hub_our_picks_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "public"."tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."hub_page_content" ADD CONSTRAINT "hub_page_content_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "public"."hubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."hub_translations" ADD CONSTRAINT "hub_translations_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "public"."hubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."hubs" ADD CONSTRAINT "hubs_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."hubs" ADD CONSTRAINT "hubs_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "public"."destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inbox_notifications" ADD CONSTRAINT "inbox_notifications_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inbox_notifications" ADD CONSTRAINT "inbox_notifications_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "public"."operators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inbox_notifications" ADD CONSTRAINT "inbox_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."instagram_posts" ADD CONSTRAINT "instagram_posts_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "public"."destinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."media_gallery" ADD CONSTRAINT "media_gallery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."media_translations" ADD CONSTRAINT "media_translations_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "public"."media_gallery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notification_deliveries" ADD CONSTRAINT "notification_deliveries_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "public"."notification_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notification_subscriptions" ADD CONSTRAINT "notification_subscriptions_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "public"."operators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."operator_company_info" ADD CONSTRAINT "operator_company_info_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "public"."operators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."operator_mollie_config" ADD CONSTRAINT "operator_mollie_config_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "public"."operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."operator_social_media" ADD CONSTRAINT "operator_social_media_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "public"."operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."operator_stripe_config" ADD CONSTRAINT "operator_stripe_config_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "public"."operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."operators" ADD CONSTRAINT "operators_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."page_redirects" ADD CONSTRAINT "page_redirects_toPageId_fkey" FOREIGN KEY ("toPageId") REFERENCES "public"."pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."page_translations" ADD CONSTRAINT "page_translations_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "public"."pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."password_change_requests" ADD CONSTRAINT "password_change_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pickup_location_translations" ADD CONSTRAINT "pickup_location_translations_pickupLocationId_fkey" FOREIGN KEY ("pickupLocationId") REFERENCES "public"."pickup_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pickup_locations" ADD CONSTRAINT "pickup_locations_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "public"."tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."recommendation_translations" ADD CONSTRAINT "recommendation_translations_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "public"."recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."review_flags" ADD CONSTRAINT "review_flags_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "public"."reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."review_invitations" ADD CONSTRAINT "review_invitations_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."review_translations" ADD CONSTRAINT "review_translations_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "public"."reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reviews" ADD CONSTRAINT "reviews_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reviews" ADD CONSTRAINT "reviews_departureId_fkey" FOREIGN KEY ("departureId") REFERENCES "public"."departures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reviews" ADD CONSTRAINT "reviews_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "public"."operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reviews" ADD CONSTRAINT "reviews_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "public"."tours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reviews" ADD CONSTRAINT "reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."settlements" ADD CONSTRAINT "settlements_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."spotlight_requests" ADD CONSTRAINT "spotlight_requests_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "public"."destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."spotlight_requests" ADD CONSTRAINT "spotlight_requests_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "public"."operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."spotlight_requests" ADD CONSTRAINT "spotlight_requests_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "public"."tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."staff_designations" ADD CONSTRAINT "staff_designations_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "public"."operators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."staff_members" ADD CONSTRAINT "staff_members_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "public"."staff_designations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."staff_members" ADD CONSTRAINT "staff_members_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."staff_members" ADD CONSTRAINT "staff_members_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "public"."operators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."staff_members" ADD CONSTRAINT "staff_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tour_addons" ADD CONSTRAINT "tour_addons_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "public"."tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tour_age_bands" ADD CONSTRAINT "tour_age_bands_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "public"."tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tour_attributes" ADD CONSTRAINT "tour_attributes_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "public"."tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tour_categories" ADD CONSTRAINT "tour_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tour_categories" ADD CONSTRAINT "tour_categories_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "public"."tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tour_exclusion_translations" ADD CONSTRAINT "tour_exclusion_translations_exclusionId_fkey" FOREIGN KEY ("exclusionId") REFERENCES "public"."tour_exclusions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tour_exclusions" ADD CONSTRAINT "tour_exclusions_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "public"."tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tour_feature_translations" ADD CONSTRAINT "tour_feature_translations_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "public"."tour_features"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tour_features" ADD CONSTRAINT "tour_features_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "public"."tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tour_highlight_translations" ADD CONSTRAINT "tour_highlight_translations_highlightId_fkey" FOREIGN KEY ("highlightId") REFERENCES "public"."tour_highlights"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tour_highlights" ADD CONSTRAINT "tour_highlights_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "public"."tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tour_hubs" ADD CONSTRAINT "tour_hubs_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "public"."hubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tour_hubs" ADD CONSTRAINT "tour_hubs_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "public"."tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tour_images" ADD CONSTRAINT "tour_images_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "public"."tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tour_inclusion_translations" ADD CONSTRAINT "tour_inclusion_translations_inclusionId_fkey" FOREIGN KEY ("inclusionId") REFERENCES "public"."tour_inclusions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tour_inclusions" ADD CONSTRAINT "tour_inclusions_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "public"."tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tour_languages" ADD CONSTRAINT "tour_languages_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "public"."tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tour_location_translations" ADD CONSTRAINT "tour_location_translations_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."tour_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tour_locations" ADD CONSTRAINT "tour_locations_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "public"."tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tour_translations" ADD CONSTRAINT "tour_translations_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "public"."tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tours" ADD CONSTRAINT "tours_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "public"."destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tours" ADD CONSTRAINT "tours_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "public"."operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."webhook_urls" ADD CONSTRAINT "webhook_urls_webhooksId_fkey" FOREIGN KEY ("webhooksId") REFERENCES "public"."webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."wishlists" ADD CONSTRAINT "wishlists_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "public"."tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."wishlists" ADD CONSTRAINT "wishlists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ═══════════════════════════════════════════════════════════════════════════
-- HAND-CARRIED RAW SQL - everything the Prisma schema DSL cannot express.
-- A regenerated baseline LOSES these silently; they are re-appended by hand
-- on every re-baseline, per the rule in BOOKING-CONCURRENCY-HARDENING.md F5.
-- Carried from: 20260805140000_search_unaccent, 20260810120000_departures_
-- booked_within_capacity. Data repairs from the old history are deliberately
-- NOT carried - a fresh database has nothing to repair, and existing
-- databases never run this baseline (they are re-pointed with
-- `prisma migrate resolve --applied`).
-- ═══════════════════════════════════════════════════════════════════════════

-- Accent-insensitive search (master 5.10). `unaccent` is IMMUTABLE-wrapped so
-- it can be indexed on; the shipped extension function is STABLE.
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION immutable_unaccent(text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
  STRICT
AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

-- The seat invariant as a DATABASE guarantee (hardening F5): app code cannot
-- express CHECK in the DSL. On a fresh, empty table a plain ADD validates
-- instantly - the NOT VALID/VALIDATE split is only needed on populated
-- tables (the original migration).
ALTER TABLE "departures"
  ADD CONSTRAINT "departures_booked_within_capacity"
  CHECK ("bookedCount" >= 0 AND "bookedCount" <= "capacity");

-- Prisma's diff engine emits enum-ARRAY columns with a default but WITHOUT
-- their NOT NULL (verified against the migrated state 2026-08-10) - restore
-- it so the baseline is byte-identical to the history's schema.
ALTER TABLE "recommendations" ALTER COLUMN "placements" SET NOT NULL;
