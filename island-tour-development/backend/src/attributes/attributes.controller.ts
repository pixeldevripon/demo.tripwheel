import type { TypedAuthUser } from '@/auth/auth.types';
import { AuthenticatedUser } from '@/auth/decorators/authenticated-user.decorator';
import { Public } from '@/auth/decorators/public.decorator';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permission } from '@prisma/client';
import { AttributesService } from './attributes.service';
import {
  ApiCreateAttributeDefinitionDocs,
  ApiDeleteAttributeDefinitionDocs,
  ApiDeleteTourAttributeDocs,
  ApiGetAttributeDefinitionDocs,
  ApiGetAttributeDefinitionsDocs,
  ApiGetFiltersDocs,
  ApiGetTourAttributesDocs,
  ApiSetTourAttributesDocs,
  ApiUpdateAttributeDefinitionDocs,
} from './attributes.swagger';
import {
  AttributeDefinitionQueryDto,
  CreateAttributeDefinitionDto,
  SetTourAttributesDto,
  UpdateAttributeDefinitionDto,
} from './dto/attribute.dto';

/**
 * AttributeDictionaryController — the central attribute dictionary (V2 §7).
 * GET endpoints are public (filter UI + tour-creation wizard need them).
 * Writes are admin-only via MANAGE_SYSTEM.
 */
@ApiTags('Attributes')
@Controller('attributes')
export class AttributeDictionaryController {
  constructor(private readonly attributesService: AttributesService) {}

  @Get()
  @Public()
  @ApiGetAttributeDefinitionsDocs()
  getAll(@Query() query: AttributeDefinitionQueryDto) {
    return this.attributesService.getAllDefinitions(query);
  }

  @Get(':key')
  @Public()
  @ApiGetAttributeDefinitionDocs()
  getOne(@Param('key') key: string) {
    return this.attributesService.getDefinition(key);
  }

  @Post()
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  @ApiCreateAttributeDefinitionDocs()
  create(@Body() dto: CreateAttributeDefinitionDto, @AuthenticatedUser() user: TypedAuthUser) {
    return this.attributesService.createDefinition(dto, user.id);
  }

  @Patch(':key')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  @ApiUpdateAttributeDefinitionDocs()
  update(
    @Param('key') key: string,
    @Body() dto: UpdateAttributeDefinitionDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.attributesService.updateDefinition(key, dto, user.id);
  }

  @Delete(':key')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  @ApiDeleteAttributeDefinitionDocs()
  remove(@Param('key') key: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.attributesService.removeDefinition(key, user.id);
  }
}

/**
 * FiltersController — available filters for a destination + category page (public).
 */
@ApiTags('Attributes')
@Controller('filters')
export class FiltersController {
  constructor(private readonly attributesService: AttributesService) {}

  @Get(':destinationSlug/:categorySlug')
  @Public()
  @ApiGetFiltersDocs()
  getFilters(
    @Param('destinationSlug') destinationSlug: string,
    @Param('categorySlug') categorySlug: string,
  ) {
    return this.attributesService.getFilters(destinationSlug, categorySlug);
  }
}

/**
 * TourAttributesController — per-tour attribute values (nested under a trip).
 * Operators manage their own tour's attributes; admins manage any.
 */
@ApiTags('Attributes')
@Controller('trips/:tripId/attributes')
export class TourAttributesController {
  constructor(private readonly attributesService: AttributesService) {}

  @Get()
  @RequirePermissions(Permission.VIEW_TRIPS)
  @ApiGetTourAttributesDocs()
  getForTrip(@Param('tripId') tripId: string) {
    return this.attributesService.getTourAttributes(tripId);
  }

  @Post()
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiSetTourAttributesDocs()
  set(
    @Param('tripId') tripId: string,
    @Body() dto: SetTourAttributesDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.attributesService.setTourAttributes(tripId, dto, user.id, user.role);
  }

  @Delete(':key')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiDeleteTourAttributeDocs()
  remove(
    @Param('tripId') tripId: string,
    @Param('key') key: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.attributesService.deleteTourAttribute(tripId, key, user.id, user.role);
  }
}
