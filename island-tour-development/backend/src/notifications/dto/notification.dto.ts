import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';
import { NotificationDeliveryStatus, NotificationType } from '@prisma/client';

// ════════════════════════════════════════════════════════════════════════════
// Response
// ════════════════════════════════════════════════════════════════════════════

export class NotificationSubscriptionResponseDto {
  @ApiProperty({ example: 'b3f1c2d4-0000-4000-8000-000000000001' })
  id!: string;

  @ApiPropertyOptional({
    example: 'op_123',
    description: 'Owning operator; null for a platform-level subscription.',
    nullable: true,
  })
  operatorId!: string | null;

  @ApiProperty({ example: 'https://reseller.example.com/octo/webhook' })
  url!: string;

  @ApiProperty({
    enum: NotificationType,
    isArray: true,
    example: ['AVAILABILITY_UPDATE', 'PRODUCT_UPDATE'],
  })
  notificationTypes!: NotificationType[];

  @ApiPropertyOptional({
    example: { 'X-Custom': 'abc' },
    description: 'Custom headers echoed on every delivery to this subscription.',
  })
  headers!: Record<string, string> | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2026-06-21T10:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-06-21T10:00:00.000Z' })
  updatedAt!: Date;
}

/**
 * Create-only response: the plaintext signing `secret` is returned EXACTLY ONCE here
 * (it is stored encrypted at rest and never echoed again).
 */
export class NotificationSubscriptionWithSecretDto extends NotificationSubscriptionResponseDto {
  @ApiProperty({
    example: 'a1b2c3…',
    description:
      'HMAC signing secret - shown once on create. Use it to verify the `Octo-Signature` header.',
  })
  secret!: string;
}

export class NotificationDeliveryResponseDto {
  @ApiProperty({ example: 'b3f1c2d4-0000-4000-8000-000000000002' })
  id!: string;

  @ApiProperty({ example: 'b3f1c2d4-0000-4000-8000-000000000001' })
  subscriptionId!: string;

  @ApiProperty({ enum: NotificationType, example: 'AVAILABILITY_UPDATE' })
  notificationType!: NotificationType;

  @ApiProperty({ enum: NotificationDeliveryStatus, example: 'DELIVERED' })
  status!: NotificationDeliveryStatus;

  @ApiProperty({ example: 1 })
  attempts!: number;

  @ApiPropertyOptional({ example: 'HTTP 503', nullable: true })
  lastError!: string | null;

  @ApiPropertyOptional({ example: '2026-06-21T10:00:01.000Z', nullable: true })
  deliveredAt!: Date | null;

  @ApiProperty({ example: '2026-06-21T10:00:00.000Z' })
  createdAt!: Date;
}

// ════════════════════════════════════════════════════════════════════════════
// Query
// ════════════════════════════════════════════════════════════════════════════

export class ListDeliveriesQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ enum: NotificationDeliveryStatus })
  @IsOptional()
  @IsEnum(NotificationDeliveryStatus)
  status?: NotificationDeliveryStatus;
}

// ════════════════════════════════════════════════════════════════════════════
// Request
// ════════════════════════════════════════════════════════════════════════════

export class CreateNotificationSubscriptionDto {
  @ApiProperty({ example: 'https://reseller.example.com/octo/webhook' })
  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  @MaxLength(2048)
  url!: string;

  @ApiProperty({
    enum: NotificationType,
    isArray: true,
    example: ['AVAILABILITY_UPDATE', 'PRODUCT_UPDATE', 'BOOKING_UPDATE'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(NotificationType, { each: true })
  notificationTypes!: NotificationType[];

  @ApiPropertyOptional({
    example: { 'X-Custom': 'abc' },
    description: 'Optional custom headers echoed verbatim on every delivery.',
  })
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @ApiPropertyOptional({
    example: 'a1b2c3…',
    description:
      'Optional caller-supplied signing secret. Omit to have one generated and returned once.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  secret?: string;
}

export class UpdateNotificationSubscriptionDto {
  @ApiPropertyOptional({ example: 'https://reseller.example.com/octo/webhook' })
  @IsOptional()
  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  @MaxLength(2048)
  url?: string;

  @ApiPropertyOptional({ enum: NotificationType, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(NotificationType, { each: true })
  notificationTypes?: NotificationType[];

  @ApiPropertyOptional({ example: { 'X-Custom': 'abc' } })
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
