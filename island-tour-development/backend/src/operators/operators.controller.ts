import type { TypedAuthUser } from '@/auth/auth.types';
import { AuthenticatedUser } from '@/auth/decorators/authenticated-user.decorator';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permission, Role } from '@prisma/client';
import {
  CreateOperatorDto,
  OnboardOperatorDto,
  OperatorQueryDto,
  UpdateOperatorCompanyInfoDto,
  UpdateOperatorDto,
  UpdateOperatorMollieConfigDto,
  UpdateOperatorSocialMediaDto,
  UpdateOperatorStripeConfigDto,
} from './dto/operator.dto';
import { OperatorsService } from './operators.service';
import {
  ApiCreateOperatorDocs,
  ApiDeleteOperatorDocs,
  ApiGetAllOperatorsDocs,
  ApiGetOperatorByIdDocs,
  ApiGetOperatorCompanyInfoDocs,
  ApiGetOperatorMollieConfigDocs,
  ApiGetOperatorSocialMediaDocs,
  ApiGetOperatorStripeConfigDocs,
  ApiOnboardOperatorDocs,
  ApiUpdateOperatorCompanyInfoDocs,
  ApiUpdateOperatorDocs,
  ApiUpdateOperatorMollieConfigDocs,
  ApiUpdateOperatorSocialMediaDocs,
  ApiUpdateOperatorStripeConfigDocs,
} from './operators.swagger';


@ApiTags('Operators')
@Controller('operators')
export class OperatorsController {
  constructor(private readonly operatorsService: OperatorsService) {}

  // ── Core Operator CRUD ─────────────────────────────────────────────────────

  @Post()
  @RequirePermissions(Permission.MANAGE_OPERATORS)
  @ApiCreateOperatorDocs()
  create(@Body() dto: CreateOperatorDto) {
    return this.operatorsService.create(dto);
  }

  @Post('onboarding')
  @RequirePermissions(Permission.EDIT_OPERATOR_PROFILE)
  @ApiOnboardOperatorDocs()
  onboard(
    @Body() dto: OnboardOperatorDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.operatorsService.onboard(user.id, dto);
  }


  @Get()
  @RequirePermissions(Permission.MANAGE_OPERATORS)
  @ApiGetAllOperatorsDocs()
  findAll(@Query() query: OperatorQueryDto) {
    return this.operatorsService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions(Permission.VIEW_OPERATOR_PROFILE)
  @ApiGetOperatorByIdDocs()
  findOne(
    @Param('id') id: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.operatorsService.findOne(id, user.id, user.role as Role);
  }

  @Patch(':id')
  @RequirePermissions(Permission.MANAGE_OPERATORS)
  @ApiUpdateOperatorDocs()
  update(@Param('id') id: string, @Body() dto: UpdateOperatorDto) {
    return this.operatorsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_OPERATORS)
  @ApiDeleteOperatorDocs()
  remove(@Param('id') id: string) {
    return this.operatorsService.remove(id);
  }

  // ── Company Information ────────────────────────────────────────────────────

  @Get(':id/company-info')
  @RequirePermissions(Permission.VIEW_OPERATOR_PROFILE)
  @ApiGetOperatorCompanyInfoDocs()
  getCompanyInfo(
    @Param('id') id: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.operatorsService.getCompanyInfo(
      id,
      user.id,
      user.role as Role,
    );
  }

  @Patch(':id/company-info')
  @RequirePermissions(Permission.EDIT_OPERATOR_PROFILE)
  @ApiUpdateOperatorCompanyInfoDocs()
  updateCompanyInfo(
    @Param('id') id: string,
    @Body() dto: UpdateOperatorCompanyInfoDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.operatorsService.updateCompanyInfo(
      id,
      user.id,
      user.role as Role,
      dto,
    );
  }

  // ── Social Media ───────────────────────────────────────────────────────────

  @Get(':id/social-media')
  @RequirePermissions(Permission.VIEW_OPERATOR_PROFILE)
  @ApiGetOperatorSocialMediaDocs()
  getSocialMedia(
    @Param('id') id: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.operatorsService.getSocialMedia(
      id,
      user.id,
      user.role as Role,
    );
  }

  @Patch(':id/social-media')
  @RequirePermissions(Permission.EDIT_OPERATOR_PROFILE)
  @ApiUpdateOperatorSocialMediaDocs()
  updateSocialMedia(
    @Param('id') id: string,
    @Body() dto: UpdateOperatorSocialMediaDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.operatorsService.updateSocialMedia(
      id,
      user.id,
      user.role as Role,
      dto,
    );
  }

  // ── Stripe Configuration ───────────────────────────────────────────────────

  @Get(':id/stripe-config')
  @RequirePermissions(Permission.MANAGE_OPERATOR_PAYMENTS)
  @ApiGetOperatorStripeConfigDocs()
  getStripeConfig(
    @Param('id') id: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.operatorsService.getStripeConfig(
      id,
      user.id,
      user.role as Role,
    );
  }

  @Patch(':id/stripe-config')
  @RequirePermissions(Permission.MANAGE_OPERATOR_PAYMENTS)
  @ApiUpdateOperatorStripeConfigDocs()
  updateStripeConfig(
    @Param('id') id: string,
    @Body() dto: UpdateOperatorStripeConfigDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.operatorsService.updateStripeConfig(
      id,
      user.id,
      user.role as Role,
      dto,
    );
  }

  // ── Mollie Configuration ───────────────────────────────────────────────────

  @Get(':id/mollie-config')
  @RequirePermissions(Permission.MANAGE_OPERATOR_PAYMENTS)
  @ApiGetOperatorMollieConfigDocs()
  getMollieConfig(
    @Param('id') id: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.operatorsService.getMollieConfig(
      id,
      user.id,
      user.role as Role,
    );
  }

  @Patch(':id/mollie-config')
  @RequirePermissions(Permission.MANAGE_OPERATOR_PAYMENTS)
  @ApiUpdateOperatorMollieConfigDocs()
  updateMollieConfig(
    @Param('id') id: string,
    @Body() dto: UpdateOperatorMollieConfigDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.operatorsService.updateMollieConfig(
      id,
      user.id,
      user.role as Role,
      dto,
    );
  }
}
