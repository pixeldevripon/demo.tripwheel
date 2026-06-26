-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('en', 'es', 'nl', 'pt', 'fr', 'de', 'zh');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'EDITOR', 'STAFF', 'GUIDE', 'TOUR_OPERATOR', 'USER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('VIEW_PERMISSIONS', 'MANAGE_SYSTEM', 'MANAGE_TRIPS', 'MANAGE_OPERATORS', 'CREATE_CONTENT', 'VIEW_CONTENT', 'EDIT_CONTENT', 'DELETE_CONTENT', 'VIEW_MEDIA', 'VIEW_ORDERS', 'EDIT_ORDER', 'DELETE_ORDER', 'MANAGE_USERS', 'VIEW_USERS', 'CREATE_USER', 'UPDATE_USER', 'DELETE_USER', 'CREATE_OPERATOR', 'VIEW_OPERATOR_PROFILE', 'EDIT_OPERATOR_PROFILE', 'MANAGE_OPERATOR_PAYMENTS', 'DELETE_OPERATOR', 'CREATE_TRIP', 'VIEW_TRIPS', 'EDIT_TRIP', 'DELETE_TRIP', 'CREATE_BLOG', 'VIEW_BLOGS', 'EDIT_BLOG', 'DELETE_BLOG', 'CREATE_DESTINATION', 'VIEW_DESTINATIONS', 'EDIT_DESTINATION', 'DELETE_DESTINATION', 'MANAGE_HUBS', 'CREATE_ACTIVITY', 'VIEW_ACTIVITIES', 'EDIT_ACTIVITY', 'DELETE_ACTIVITY', 'CREATE_PICKUP_DROP', 'VIEW_PICKUP_DROPS', 'EDIT_PICKUP_DROP', 'DELETE_PICKUP_DROP', 'CREATE_CATEGORY', 'VIEW_CATEGORIES', 'EDIT_CATEGORY', 'DELETE_CATEGORY', 'CREATE_COLLECTION', 'VIEW_COLLECTIONS', 'EDIT_COLLECTION', 'DELETE_COLLECTION', 'MANAGE_AVAILABILITY', 'VIEW_BOOKINGS', 'EDIT_BOOKING', 'DELETE_BOOKING', 'MANAGE_BOOKINGS', 'VIEW_PAYMENTS', 'EDIT_PAYMENT', 'DELETE_PAYMENT', 'MANAGE_PAYMENTS', 'MANAGE_TIERS', 'APPROVE_SPOTLIGHT', 'VIEW_ENQUIRIES', 'DELETE_ENQUIRY', 'REPLY_ENQUIRY', 'VIEW_LEADS', 'EDIT_LEAD', 'DELETE_LEAD', 'VIEW_REVIEWS', 'EDIT_REVIEW', 'DELETE_REVIEW', 'APPROVE_REVIEW', 'UPLOAD_MEDIA', 'MANAGE_MEDIA', 'VIEW_PROFILE', 'EDIT_PROFILE', 'MANAGE_SETTINGS', 'VIEW_SETTINGS', 'VIEW_ANALYTICS', 'EXPORT_DATA', 'BULK_OPERATIONS');

-- CreateEnum
CREATE TYPE "TourStatus" AS ENUM ('DRAFT', 'LIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PricingModel" AS ENUM ('PER_PERSON', 'UNIT');

-- CreateEnum
CREATE TYPE "WholeUnitType" AS ENUM ('GROUP', 'BOAT', 'VEHICLE', 'AIRCRAFT', 'PACKAGE');

-- CreateEnum
CREATE TYPE "PickupModel" AS ENUM ('INCLUDED', 'PAID_ADDON', 'NONE');

-- CreateEnum
CREATE TYPE "AddOnUnit" AS ENUM ('PER_PERSON', 'FLAT');

-- CreateEnum
CREATE TYPE "ExclusionType" AS ENUM ('PAID_ADVANCE', 'PAID_ONSITE', 'UNAVAILABLE', 'NOT_PERMITTED');

-- CreateEnum
CREATE TYPE "FitnessLevel" AS ENUM ('EASY', 'MODERATE', 'CHALLENGING');

-- CreateEnum
CREATE TYPE "TourBookingType" AS ENUM ('PRIVATE', 'SHARED');

-- CreateEnum
CREATE TYPE "AgeBandType" AS ENUM ('ADULT', 'CHILD', 'INFANT', 'YOUTH', 'SENIOR');

-- CreateEnum
CREATE TYPE "BandParticipation" AS ENUM ('PARTICIPANT', 'SPECTATOR');

-- CreateEnum
CREATE TYPE "OctoAvailabilityType" AS ENUM ('START_TIME', 'OPENING_HOURS');

-- CreateEnum
CREATE TYPE "DeliveryFormat" AS ENUM ('PDF_URL', 'QRCODE', 'CODE128', 'PKPASS_URL');

-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('VOUCHER', 'TICKET');

-- CreateEnum
CREATE TYPE "RedemptionMethod" AS ENUM ('DIGITAL', 'PRINT', 'MANIFEST');

-- CreateEnum
CREATE TYPE "FeatureType" AS ENUM ('INCLUSION', 'EXCLUSION', 'HIGHLIGHT', 'PREBOOKING_INFORMATION', 'PREARRIVAL_INFORMATION', 'REDEMPTION_INSTRUCTION', 'ACCESSIBILITY_INFORMATION', 'ADDITIONAL_INFORMATION', 'BOOKING_TERM', 'CANCELLATION_TERM');

-- CreateEnum
CREATE TYPE "availability_schedule_status" AS ENUM ('active', 'paused');

-- CreateEnum
CREATE TYPE "availability_exception_type" AS ENUM ('close_date', 'close_slot', 'add_slot', 'set_capacity');

-- CreateEnum
CREATE TYPE "departure_status" AS ENUM ('open', 'closed', 'sold_out', 'cancelled');

-- CreateEnum
CREATE TYPE "departure_source" AS ENUM ('schedule', 'exception', 'api');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('ON_HOLD', 'CONFIRMED', 'EXPIRED', 'CANCELLED', 'REDEEMED', 'PENDING', 'REJECTED');

-- CreateEnum
CREATE TYPE "CancellationRefund" AS ENUM ('FULL', 'PARTIAL', 'NONE');

-- CreateEnum
CREATE TYPE "CancelledBy" AS ENUM ('CUSTOMER', 'OPERATOR', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "PaymentModel" AS ENUM ('OPERATOR_LINK', 'ON_ARRIVAL', 'PAID_IN_FULL', 'OPERATOR_FULL');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE', 'MOLLIE');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('DEPOSIT', 'BALANCE', 'FULL', 'REFUND');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('REQUIRES_PAYMENT', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TierKey" AS ENUM ('premium', 'featured', 'boosted', 'organic', 'standard');

-- CreateEnum
CREATE TYPE "EligibilityState" AS ENUM ('LOCKED', 'PROVISIONAL', 'ELIGIBLE', 'GRACE', 'DEMOTED');

-- CreateEnum
CREATE TYPE "SpotlightStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'ACTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ReviewModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('PRODUCT_UPDATE', 'AVAILABILITY_UPDATE', 'BOOKING_UPDATE');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'DEAD');

-- CreateEnum
CREATE TYPE "Region" AS ENUM ('CARIBBEAN', 'ATLANTIC', 'MEDITERRANEAN', 'ASIA', 'AFRICA');

-- CreateEnum
CREATE TYPE "HubType" AS ENUM ('LOCATION', 'HIGHLIGHT', 'AREA');

-- CreateEnum
CREATE TYPE "HubStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "HubSectionType" AS ENUM ('DISCOVER', 'LOCAL_TIP', 'FAST_FACT', 'EDITORIAL');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'EUR');

-- CreateEnum
CREATE TYPE "SlugEntityType" AS ENUM ('TOUR', 'CATEGORY', 'HUB', 'COLLECTION', 'RESERVED');

-- CreateEnum
CREATE TYPE "CollectionType" AS ENUM ('MANUAL', 'DYNAMIC');

-- CreateEnum
CREATE TYPE "CollectionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CollectionDisplayStyle" AS ENUM ('NUMBERED', 'PERSONA');

-- CreateEnum
CREATE TYPE "FeaturedEntityType" AS ENUM ('CATEGORY', 'HUB');

-- CreateEnum
CREATE TYPE "HubPickType" AS ENUM ('BEST_OVERALL', 'MOST_POPULAR', 'BEST_FOR_FAMILIES', 'BEST_VALUE');

-- CreateEnum
CREATE TYPE "AttributeDataType" AS ENUM ('BOOLEAN', 'ENUM', 'ENUM_MULTI', 'INTEGER', 'DECIMAL', 'TEXT');

-- CreateEnum
CREATE TYPE "FilterDisplayType" AS ENUM ('CHECKBOX', 'RANGE_SLIDER', 'RADIO', 'DROPDOWN');

-- CreateEnum
CREATE TYPE "OperatorVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "attribute_definitions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "dataType" "AttributeDataType" NOT NULL,
    "allowedValues" JSONB,
    "appliesToCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isFilterable" BOOLEAN NOT NULL DEFAULT true,
    "isSortable" BOOLEAN NOT NULL DEFAULT false,
    "filterDisplayType" "FilterDisplayType",
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attribute_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_attributes" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "attributeKey" TEXT NOT NULL,
    "attributeValue" VARCHAR(500) NOT NULL,

    CONSTRAINT "tour_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_schedules" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "weekday" SMALLINT NOT NULL,
    "startTime" TIME(0) NOT NULL,
    "capacityOverride" INTEGER,
    "validFrom" DATE NOT NULL,
    "validUntil" DATE,
    "status" "availability_schedule_status" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "availability_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_exceptions" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TIME(0),
    "type" "availability_exception_type" NOT NULL,
    "capacity" INTEGER,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "availability_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departures" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TIME(0) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "bookedCount" INTEGER NOT NULL DEFAULT 0,
    "status" "departure_status" NOT NULL DEFAULT 'open',
    "soldOutAt" TIMESTAMP(3),
    "source" "departure_source" NOT NULL DEFAULT 'schedule',
    "externalRef" TEXT,
    "manuallyEdited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
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
    "status" "BookingStatus" NOT NULL DEFAULT 'ON_HOLD',
    "freesale" BOOLEAN NOT NULL DEFAULT false,
    "testMode" BOOLEAN NOT NULL DEFAULT false,
    "utcExpiresAt" TIMESTAMP(3),
    "utcConfirmedAt" TIMESTAMP(3),
    "utcRedeemedAt" TIMESTAMP(3),
    "paymentModel" "PaymentModel" NOT NULL,
    "currency" "Currency" NOT NULL,
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
    "clickId" TEXT,
    "gbraid" TEXT,
    "wbraid" TEXT,
    "fbclid" TEXT,
    "affiliateId" TEXT,
    "island" TEXT NOT NULL DEFAULT 'Curaçao',
    "customerLocale" TEXT,
    "customerId" TEXT,
    "conversionFiredAt" TIMESTAMP(3),
    "billingCountry" TEXT,
    "billingPostalCode" TEXT,
    "billingCity" TEXT,
    "paymentMethodLast4" TEXT,
    "paymentMethodBrand" TEXT,
    "cancellationRefund" "CancellationRefund",
    "cancelledBy" "CancelledBy",
    "cancellationReason" TEXT,
    "utcCancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_unit_items" (
    "id" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "ageBandId" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'ON_HOLD',
    "utcRedeemedAt" TIMESTAMP(3),
    "contactFirstName" TEXT,
    "contactLastName" TEXT,
    "travelerAge" INTEGER,
    "priceRetail" DECIMAL(10,2) NOT NULL,
    "priceNet" DECIMAL(10,2),
    "ticketCode" TEXT,
    "ticketDeliveryFormat" "DeliveryFormat",
    "ticketUrl" TEXT,

    CONSTRAINT "booking_unit_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_addons" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "addOnId" TEXT,
    "name" TEXT NOT NULL,
    "unit" "AddOnUnit" NOT NULL DEFAULT 'PER_PERSON',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "booking_addons_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "collections" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "collectionType" "CollectionType" NOT NULL,
    "tourIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "filterQuery" JSONB,
    "heroImage" TEXT,
    "sortOrder" TEXT NOT NULL DEFAULT 'recommended',
    "status" "CollectionStatus" NOT NULL DEFAULT 'DRAFT',
    "displayStyle" "CollectionDisplayStyle" NOT NULL DEFAULT 'PERSONA',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSeeded" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_translations" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT,
    "overview" TEXT,
    "curationNote" TEXT,
    "eyebrowLabel" TEXT,
    "h1Override" TEXT,
    "breadcrumbLabel" TEXT,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collection_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_page_content" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "aboutText" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,

    CONSTRAINT "collection_page_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_tours" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "collection_tours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_tour_rationales" (
    "id" TEXT NOT NULL,
    "collectionTourId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "rationale" TEXT NOT NULL,

    CONSTRAINT "collection_tour_rationales_pkey" PRIMARY KEY ("id")
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
    "region" "Region" NOT NULL,
    "country" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "timezone" TEXT,
    "currency" "Currency",
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
    "heroImage" TEXT,
    "ogImage" TEXT,
    "hubType" "HubType",
    "status" "HubStatus" NOT NULL DEFAULT 'DRAFT',
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
    "heroTagline" TEXT,
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
CREATE TABLE "hub_our_pick_translations" (
    "id" TEXT NOT NULL,
    "ourPickId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "hub_our_pick_translations_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "hub_comparison_group_translations" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "groupName" TEXT NOT NULL,

    CONSTRAINT "hub_comparison_group_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hub_comparison_tours" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "standoutNote" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "hub_comparison_tours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hub_comparison_tour_translations" (
    "id" TEXT NOT NULL,
    "comparisonTourId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "standoutNote" TEXT NOT NULL,

    CONSTRAINT "hub_comparison_tour_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hub_content_sections" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "sectionType" "HubSectionType" NOT NULL,
    "heading" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "hub_content_sections_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "notification_subscriptions" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "notificationTypes" "NotificationType"[] DEFAULT ARRAY[]::"NotificationType"[],
    "headers" JSONB DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "notificationType" "NotificationType" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
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
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "cancellationRate90d" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "totalBookings" INTEGER NOT NULL DEFAULT 0,
    "forceMajeurePardons" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operator_company_info" (
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
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'STRIPE',
    "kind" "PaymentKind" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'REQUIRES_PAYMENT',
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" "Currency" NOT NULL,
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
CREATE TABLE "stripe_webhook_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3),
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mollie_webhook_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'payment',
    "processedAt" TIMESTAMP(3),
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mollie_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
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
    "moderationStatus" "ReviewModerationStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "operatorResponse" TEXT,
    "operatorRespondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_translations" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "comment" TEXT NOT NULL,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "review_translations_pkey" PRIMARY KEY ("id")
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
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slug_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slug_redirects" (
    "id" TEXT NOT NULL,
    "destinationSlug" TEXT NOT NULL,
    "fromSlug" TEXT NOT NULL,
    "toSlug" TEXT NOT NULL,
    "entityType" "SlugEntityType" NOT NULL,
    "statusCode" INTEGER NOT NULL DEFAULT 301,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slug_redirects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spotlight_requests" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "status" "SpotlightStatus" NOT NULL DEFAULT 'REQUESTED',
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
CREATE TABLE "force_majeure_pardons" (
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
CREATE TABLE "tours" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "TourStatus" NOT NULL DEFAULT 'DRAFT',
    "timeZone" TEXT NOT NULL DEFAULT 'America/Curacao',
    "availabilityType" "OctoAvailabilityType" NOT NULL DEFAULT 'START_TIME',
    "instantConfirmation" BOOLEAN NOT NULL DEFAULT true,
    "instantDelivery" BOOLEAN NOT NULL DEFAULT true,
    "availabilityRequired" BOOLEAN NOT NULL DEFAULT true,
    "allowFreesale" BOOLEAN NOT NULL DEFAULT false,
    "deliveryFormats" "DeliveryFormat"[] DEFAULT ARRAY['PDF_URL', 'QRCODE']::"DeliveryFormat"[],
    "deliveryMethods" "DeliveryMethod"[] DEFAULT ARRAY['VOUCHER']::"DeliveryMethod"[],
    "redemptionMethod" "RedemptionMethod" NOT NULL DEFAULT 'DIGITAL',
    "reference" TEXT,
    "pricingModel" "PricingModel" NOT NULL DEFAULT 'PER_PERSON',
    "wholeUnitType" "WholeUnitType",
    "defaultCurrency" "Currency" NOT NULL DEFAULT 'USD',
    "basePrice" DECIMAL(10,2),
    "priceFrom" DECIMAL(10,2),
    "durationMinutesFrom" INTEGER,
    "durationMinutesTo" INTEGER,
    "pickupModel" "PickupModel" NOT NULL DEFAULT 'NONE',
    "pickupRequired" BOOLEAN NOT NULL DEFAULT false,
    "minPartySize" INTEGER NOT NULL DEFAULT 1,
    "maxPartySize" INTEGER,
    "bookingCutoffMinutes" INTEGER NOT NULL DEFAULT 120,
    "cancellationHours" INTEGER NOT NULL DEFAULT 48,
    "startTimes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "paymentModel" "PaymentModel" NOT NULL DEFAULT 'OPERATOR_LINK',
    "depositPct" DECIMAL(4,1) NOT NULL DEFAULT 20.0,
    "commissionTier" DECIMAL(4,1) NOT NULL DEFAULT 20.0,
    "tierKey" "TierKey" NOT NULL DEFAULT 'standard',
    "tierRank" SMALLINT NOT NULL DEFAULT 5,
    "tierLockedUntil" TIMESTAMP(3),
    "qualityScore" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "eligibilityState" "EligibilityState" NOT NULL DEFAULT 'LOCKED',
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
    "fitnessLevel" "FitnessLevel",
    "bookingType" "TourBookingType",
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

    CONSTRAINT "tours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_age_bands" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "bandType" "AgeBandType" NOT NULL,
    "participation" "BandParticipation" NOT NULL DEFAULT 'PARTICIPANT',
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
CREATE TABLE "tour_categories" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "tour_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_hubs" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,

    CONSTRAINT "tour_hubs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_images" (
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
CREATE TABLE "tour_addons" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
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
    "tourId" TEXT NOT NULL,
    "language" TEXT NOT NULL,

    CONSTRAINT "tour_languages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_highlights" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
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
    "tourId" TEXT NOT NULL,
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
CREATE TABLE "tour_exclusions" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'x',
    "type" "ExclusionType",
    "priceText" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,

    CONSTRAINT "tour_exclusions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_exclusion_translations" (
    "id" TEXT NOT NULL,
    "exclusionId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "label" TEXT NOT NULL,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "tour_exclusion_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_features" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "type" "FeatureType" NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tour_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_feature_translations" (
    "id" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "text" TEXT NOT NULL,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "tour_feature_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_locations" (
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
CREATE TABLE "tour_location_translations" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "title" TEXT NOT NULL,
    "shortDescription" TEXT,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "tour_location_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pickup_locations" (
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

    CONSTRAINT "pickup_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pickup_location_translations" (
    "id" TEXT NOT NULL,
    "pickupLocationId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "title" TEXT NOT NULL,
    "directions" TEXT,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "pickup_location_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_translations" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "title" TEXT,
    "overview" TEXT,
    "description" TEXT,
    "shortDescription" TEXT,
    "whatToBring" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "knowBeforeYouGo" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notSuitableFor" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "whatToExpectIntro" TEXT,
    "categoryDisplay" TEXT,
    "localTip" TEXT,
    "meetingPointText" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tour_translations_pkey" PRIMARY KEY ("id")
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
    "tourId" TEXT NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attribute_definitions_key_key" ON "attribute_definitions"("key");

-- CreateIndex
CREATE INDEX "attribute_definitions_isFilterable_idx" ON "attribute_definitions"("isFilterable");

-- CreateIndex
CREATE INDEX "attribute_definitions_isActive_idx" ON "attribute_definitions"("isActive");

-- CreateIndex
CREATE INDEX "tour_attributes_attributeKey_attributeValue_idx" ON "tour_attributes"("attributeKey", "attributeValue");

-- CreateIndex
CREATE UNIQUE INDEX "tour_attributes_tourId_attributeKey_key" ON "tour_attributes"("tourId", "attributeKey");

-- CreateIndex
CREATE INDEX "availability_schedules_tourId_weekday_status_idx" ON "availability_schedules"("tourId", "weekday", "status");

-- CreateIndex
CREATE UNIQUE INDEX "availability_schedules_tourId_weekday_startTime_validFrom_key" ON "availability_schedules"("tourId", "weekday", "startTime", "validFrom");

-- CreateIndex
CREATE INDEX "availability_exceptions_tourId_date_idx" ON "availability_exceptions"("tourId", "date");

-- CreateIndex
CREATE INDEX "availability_exceptions_tourId_date_startTime_idx" ON "availability_exceptions"("tourId", "date", "startTime");

-- CreateIndex
CREATE INDEX "departures_tourId_date_idx" ON "departures"("tourId", "date");

-- CreateIndex
CREATE INDEX "departures_tourId_status_date_idx" ON "departures"("tourId", "status", "date");

-- CreateIndex
CREATE UNIQUE INDEX "departures_tourId_date_startTime_key" ON "departures"("tourId", "date", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_uuid_key" ON "bookings"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_publicRef_key" ON "bookings"("publicRef");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_displayRef_key" ON "bookings"("displayRef");

-- CreateIndex
CREATE INDEX "bookings_tourId_idx" ON "bookings"("tourId");

-- CreateIndex
CREATE INDEX "bookings_operatorId_idx" ON "bookings"("operatorId");

-- CreateIndex
CREATE INDEX "bookings_userId_idx" ON "bookings"("userId");

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

-- CreateIndex
CREATE INDEX "bookings_departureId_idx" ON "bookings"("departureId");

-- CreateIndex
CREATE INDEX "bookings_localDate_idx" ON "bookings"("localDate");

-- CreateIndex
CREATE UNIQUE INDEX "booking_unit_items_uuid_key" ON "booking_unit_items"("uuid");

-- CreateIndex
CREATE INDEX "booking_unit_items_bookingId_idx" ON "booking_unit_items"("bookingId");

-- CreateIndex
CREATE INDEX "booking_addons_bookingId_idx" ON "booking_addons"("bookingId");

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
CREATE INDEX "collections_destinationId_idx" ON "collections"("destinationId");

-- CreateIndex
CREATE INDEX "collections_destinationId_status_idx" ON "collections"("destinationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "collections_destinationId_slug_key" ON "collections"("destinationId", "slug");

-- CreateIndex
CREATE INDEX "collection_translations_collectionId_locale_idx" ON "collection_translations"("collectionId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "collection_translations_collectionId_locale_key" ON "collection_translations"("collectionId", "locale");

-- CreateIndex
CREATE INDEX "collection_page_content_collectionId_locale_idx" ON "collection_page_content"("collectionId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "collection_page_content_collectionId_locale_key" ON "collection_page_content"("collectionId", "locale");

-- CreateIndex
CREATE INDEX "collection_tours_collectionId_position_idx" ON "collection_tours"("collectionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "collection_tours_collectionId_tourId_key" ON "collection_tours"("collectionId", "tourId");

-- CreateIndex
CREATE UNIQUE INDEX "collection_tour_rationales_collectionTourId_locale_key" ON "collection_tour_rationales"("collectionTourId", "locale");

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
CREATE UNIQUE INDEX "hub_our_pick_translations_ourPickId_locale_key" ON "hub_our_pick_translations"("ourPickId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "hub_comparison_group_translations_groupId_locale_key" ON "hub_comparison_group_translations"("groupId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "hub_comparison_tours_groupId_tourId_key" ON "hub_comparison_tours"("groupId", "tourId");

-- CreateIndex
CREATE UNIQUE INDEX "hub_comparison_tour_translations_comparisonTourId_locale_key" ON "hub_comparison_tour_translations"("comparisonTourId", "locale");

-- CreateIndex
CREATE INDEX "hub_content_sections_hubId_locale_sectionType_displayOrder_idx" ON "hub_content_sections"("hubId", "locale", "sectionType", "displayOrder");

-- CreateIndex
CREATE INDEX "featured_experiences_entityType_entityId_idx" ON "featured_experiences"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "featured_experiences_destinationId_idx" ON "featured_experiences"("destinationId");

-- CreateIndex
CREATE INDEX "faqs_pageType_entityId_locale_idx" ON "faqs"("pageType", "entityId", "locale");

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
CREATE INDEX "notification_subscriptions_operatorId_idx" ON "notification_subscriptions"("operatorId");

-- CreateIndex
CREATE INDEX "notification_deliveries_subscriptionId_status_idx" ON "notification_deliveries"("subscriptionId", "status");

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
CREATE INDEX "payments_bookingId_idx" ON "payments"("bookingId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_intentId_idx" ON "payments"("intentId");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_bookingId_key" ON "reviews"("bookingId");

-- CreateIndex
CREATE INDEX "reviews_tourId_moderationStatus_createdAt_idx" ON "reviews"("tourId", "moderationStatus", "createdAt");

-- CreateIndex
CREATE INDEX "reviews_tourId_rating_idx" ON "reviews"("tourId", "rating");

-- CreateIndex
CREATE INDEX "reviews_operatorId_moderationStatus_idx" ON "reviews"("operatorId", "moderationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "review_translations_reviewId_locale_key" ON "review_translations"("reviewId", "locale");

-- CreateIndex
CREATE INDEX "mollie_configuration_id_idx" ON "mollie_configuration"("id");

-- CreateIndex
CREATE INDEX "slug_registry_destinationSlug_slug_isActive_idx" ON "slug_registry"("destinationSlug", "slug", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "slug_registry_destinationSlug_slug_key" ON "slug_registry"("destinationSlug", "slug");

-- CreateIndex
CREATE INDEX "slug_redirects_destinationSlug_fromSlug_idx" ON "slug_redirects"("destinationSlug", "fromSlug");

-- CreateIndex
CREATE UNIQUE INDEX "slug_redirects_destinationSlug_fromSlug_key" ON "slug_redirects"("destinationSlug", "fromSlug");

-- CreateIndex
CREATE INDEX "spotlight_requests_destinationId_status_idx" ON "spotlight_requests"("destinationId", "status");

-- CreateIndex
CREATE INDEX "spotlight_requests_tourId_idx" ON "spotlight_requests"("tourId");

-- CreateIndex
CREATE INDEX "force_majeure_pardons_destinationId_startDate_endDate_idx" ON "force_majeure_pardons"("destinationId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "tours_operatorId_idx" ON "tours"("operatorId");

-- CreateIndex
CREATE INDEX "tours_destinationId_idx" ON "tours"("destinationId");

-- CreateIndex
CREATE INDEX "tours_status_idx" ON "tours"("status");

-- CreateIndex
CREATE INDEX "tours_tierRank_qualityScore_idx" ON "tours"("tierRank", "qualityScore");

-- CreateIndex
CREATE INDEX "tours_isBookable_idx" ON "tours"("isBookable");

-- CreateIndex
CREATE UNIQUE INDEX "tours_destinationId_slug_key" ON "tours"("destinationId", "slug");

-- CreateIndex
CREATE INDEX "tour_age_bands_tourId_idx" ON "tour_age_bands"("tourId");

-- CreateIndex
CREATE INDEX "tour_categories_categoryId_idx" ON "tour_categories"("categoryId");

-- CreateIndex
CREATE INDEX "tour_categories_tourId_isPrimary_idx" ON "tour_categories"("tourId", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "tour_categories_tourId_categoryId_key" ON "tour_categories"("tourId", "categoryId");

-- CreateIndex
CREATE INDEX "tour_hubs_hubId_idx" ON "tour_hubs"("hubId");

-- CreateIndex
CREATE UNIQUE INDEX "tour_hubs_tourId_hubId_key" ON "tour_hubs"("tourId", "hubId");

-- CreateIndex
CREATE INDEX "tour_images_tourId_displayOrder_idx" ON "tour_images"("tourId", "displayOrder");

-- CreateIndex
CREATE INDEX "tour_addons_tourId_idx" ON "tour_addons"("tourId");

-- CreateIndex
CREATE UNIQUE INDEX "tour_languages_tourId_language_key" ON "tour_languages"("tourId", "language");

-- CreateIndex
CREATE INDEX "tour_highlights_tourId_displayOrder_idx" ON "tour_highlights"("tourId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "tour_highlight_translations_highlightId_locale_key" ON "tour_highlight_translations"("highlightId", "locale");

-- CreateIndex
CREATE INDEX "tour_inclusions_tourId_idx" ON "tour_inclusions"("tourId");

-- CreateIndex
CREATE UNIQUE INDEX "tour_inclusion_translations_inclusionId_locale_key" ON "tour_inclusion_translations"("inclusionId", "locale");

-- CreateIndex
CREATE INDEX "tour_exclusions_tourId_idx" ON "tour_exclusions"("tourId");

-- CreateIndex
CREATE UNIQUE INDEX "tour_exclusion_translations_exclusionId_locale_key" ON "tour_exclusion_translations"("exclusionId", "locale");

-- CreateIndex
CREATE INDEX "tour_features_tourId_type_idx" ON "tour_features"("tourId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "tour_feature_translations_featureId_locale_key" ON "tour_feature_translations"("featureId", "locale");

-- CreateIndex
CREATE INDEX "tour_locations_tourId_idx" ON "tour_locations"("tourId");

-- CreateIndex
CREATE UNIQUE INDEX "tour_location_translations_locationId_locale_key" ON "tour_location_translations"("locationId", "locale");

-- CreateIndex
CREATE INDEX "pickup_locations_tourId_idx" ON "pickup_locations"("tourId");

-- CreateIndex
CREATE UNIQUE INDEX "pickup_location_translations_pickupLocationId_locale_key" ON "pickup_location_translations"("pickupLocationId", "locale");

-- CreateIndex
CREATE INDEX "tour_translations_tourId_locale_idx" ON "tour_translations"("tourId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "tour_translations_tourId_locale_key" ON "tour_translations"("tourId", "locale");

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
CREATE INDEX "webhook_urls_id_idx" ON "webhook_urls"("id");

-- CreateIndex
CREATE INDEX "webhook_urls_webhooksId_idx" ON "webhook_urls"("webhooksId");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_urls_webhooksId_type_key" ON "webhook_urls"("webhooksId", "type");

-- CreateIndex
CREATE INDEX "wishlists_userId_idx" ON "wishlists"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "wishlists_userId_tourId_key" ON "wishlists"("userId", "tourId");

-- AddForeignKey
ALTER TABLE "tour_attributes" ADD CONSTRAINT "tour_attributes_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_schedules" ADD CONSTRAINT "availability_schedules_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_exceptions" ADD CONSTRAINT "availability_exceptions_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departures" ADD CONSTRAINT "departures_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_departureId_fkey" FOREIGN KEY ("departureId") REFERENCES "departures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_pickupLocationId_fkey" FOREIGN KEY ("pickupLocationId") REFERENCES "pickup_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_unit_items" ADD CONSTRAINT "booking_unit_items_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_unit_items" ADD CONSTRAINT "booking_unit_items_ageBandId_fkey" FOREIGN KEY ("ageBandId") REFERENCES "tour_age_bands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_addons" ADD CONSTRAINT "booking_addons_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_addons" ADD CONSTRAINT "booking_addons_addOnId_fkey" FOREIGN KEY ("addOnId") REFERENCES "tour_addons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentCategoryId_fkey" FOREIGN KEY ("parentCategoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_page_content" ADD CONSTRAINT "category_page_content_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_translations" ADD CONSTRAINT "category_translations_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_translations" ADD CONSTRAINT "collection_translations_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_page_content" ADD CONSTRAINT "collection_page_content_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_tours" ADD CONSTRAINT "collection_tours_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_tours" ADD CONSTRAINT "collection_tours_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_tour_rationales" ADD CONSTRAINT "collection_tour_rationales_collectionTourId_fkey" FOREIGN KEY ("collectionTourId") REFERENCES "collection_tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "hub_our_picks" ADD CONSTRAINT "hub_our_picks_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hub_our_pick_translations" ADD CONSTRAINT "hub_our_pick_translations_ourPickId_fkey" FOREIGN KEY ("ourPickId") REFERENCES "hub_our_picks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hub_comparison_groups" ADD CONSTRAINT "hub_comparison_groups_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "hubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hub_comparison_group_translations" ADD CONSTRAINT "hub_comparison_group_translations_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "hub_comparison_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hub_comparison_tours" ADD CONSTRAINT "hub_comparison_tours_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "hub_comparison_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hub_comparison_tours" ADD CONSTRAINT "hub_comparison_tours_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hub_comparison_tour_translations" ADD CONSTRAINT "hub_comparison_tour_translations_comparisonTourId_fkey" FOREIGN KEY ("comparisonTourId") REFERENCES "hub_comparison_tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hub_content_sections" ADD CONSTRAINT "hub_content_sections_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "hubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_gallery" ADD CONSTRAINT "media_gallery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_subscriptions" ADD CONSTRAINT "notification_subscriptions_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "notification_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "payments" ADD CONSTRAINT "payments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_translations" ADD CONSTRAINT "review_translations_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spotlight_requests" ADD CONSTRAINT "spotlight_requests_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spotlight_requests" ADD CONSTRAINT "spotlight_requests_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spotlight_requests" ADD CONSTRAINT "spotlight_requests_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "force_majeure_pardons" ADD CONSTRAINT "force_majeure_pardons_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tours" ADD CONSTRAINT "tours_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tours" ADD CONSTRAINT "tours_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_age_bands" ADD CONSTRAINT "tour_age_bands_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_categories" ADD CONSTRAINT "tour_categories_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_categories" ADD CONSTRAINT "tour_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_hubs" ADD CONSTRAINT "tour_hubs_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_hubs" ADD CONSTRAINT "tour_hubs_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "hubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_images" ADD CONSTRAINT "tour_images_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_addons" ADD CONSTRAINT "tour_addons_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_languages" ADD CONSTRAINT "tour_languages_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_highlights" ADD CONSTRAINT "tour_highlights_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_highlight_translations" ADD CONSTRAINT "tour_highlight_translations_highlightId_fkey" FOREIGN KEY ("highlightId") REFERENCES "tour_highlights"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_inclusions" ADD CONSTRAINT "tour_inclusions_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_inclusion_translations" ADD CONSTRAINT "tour_inclusion_translations_inclusionId_fkey" FOREIGN KEY ("inclusionId") REFERENCES "tour_inclusions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_exclusions" ADD CONSTRAINT "tour_exclusions_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_exclusion_translations" ADD CONSTRAINT "tour_exclusion_translations_exclusionId_fkey" FOREIGN KEY ("exclusionId") REFERENCES "tour_exclusions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_features" ADD CONSTRAINT "tour_features_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_feature_translations" ADD CONSTRAINT "tour_feature_translations_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "tour_features"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_locations" ADD CONSTRAINT "tour_locations_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_location_translations" ADD CONSTRAINT "tour_location_translations_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "tour_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_locations" ADD CONSTRAINT "pickup_locations_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_location_translations" ADD CONSTRAINT "pickup_location_translations_pickupLocationId_fkey" FOREIGN KEY ("pickupLocationId") REFERENCES "pickup_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_translations" ADD CONSTRAINT "tour_translations_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_urls" ADD CONSTRAINT "webhook_urls_webhooksId_fkey" FOREIGN KEY ("webhooksId") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;
