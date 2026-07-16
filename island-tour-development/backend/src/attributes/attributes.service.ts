import { PrismaService } from '@/prisma/prisma.service';
import { ToursService } from '@/tours/tours.service';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AttributeDataType, Prisma, Role, TourStatus } from '@prisma/client';
import {
  AttributeDefinitionQueryDto,
  CreateAttributeDefinitionDto,
  SetTourAttributesDto,
  UpdateAttributeDefinitionDto,
} from './dto/attribute.dto';
import {
  DERIVED_ATTRIBUTE_KEYS,
  deriveTourAttributes,
  derivedAttributeTourSelect,
  type DerivedAttributeTour,
} from './derived-attributes';

@Injectable()
export class AttributesService {
  private readonly logger = new Logger(AttributesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly toursService: ToursService,
  ) {}

  private readonly definitionSelect = {
    id: true,
    key: true,
    displayName: true,
    dataType: true,
    allowedValues: true,
    appliesToCategories: true,
    isFilterable: true,
    isSortable: true,
    filterDisplayType: true,
    sortOrder: true,
    isActive: true,
  } as const;

  // ── Dictionary (admin) ────────────────────────────────────────────────────────

  async getAllDefinitions(query: AttributeDefinitionQueryDto) {
    const where: Prisma.AttributeDefinitionWhereInput = { isActive: true };
    if (query.filterableOnly) where.isFilterable = true;
    if (query.globalOnly) where.appliesToCategories = { isEmpty: true };
    else if (query.category) {
      // global (empty) OR applies to the requested category slug
      where.OR = [
        { appliesToCategories: { isEmpty: true } },
        { appliesToCategories: { has: query.category } },
      ];
    }
    return this.prisma.attributeDefinition.findMany({
      where,
      select: this.definitionSelect,
      orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
    });
  }

  async getDefinition(key: string) {
    const def = await this.prisma.attributeDefinition.findUnique({
      where: { key },
      select: this.definitionSelect,
    });
    if (!def) throw new NotFoundException(`Attribute "${key}" not found`);
    return def;
  }

  async createDefinition(dto: CreateAttributeDefinitionDto, adminId: string) {
    this.assertEnumHasValues(dto.dataType, dto.allowedValues);
    const def = await this.prisma.attributeDefinition
      .create({
        data: {
          key: dto.key,
          displayName: dto.displayName,
          dataType: dto.dataType,
          allowedValues: dto.allowedValues ?? Prisma.JsonNull,
          appliesToCategories: dto.appliesToCategories ?? [],
          isFilterable: dto.isFilterable ?? true,
          isSortable: dto.isSortable ?? false,
          filterDisplayType: dto.filterDisplayType ?? null,
          sortOrder: dto.sortOrder ?? 0,
        },
        select: this.definitionSelect,
      })
      .catch((err: any) => {
        if (err?.code === 'P2002')
          throw new ConflictException(
            `Attribute key "${dto.key}" already exists`,
          );
        throw err;
      });
    this.logger.log(
      `Admin ${adminId} created attribute definition "${dto.key}"`,
    );
    return def;
  }

  async updateDefinition(
    key: string,
    dto: UpdateAttributeDefinitionDto,
    adminId: string,
  ) {
    const existing = await this.getDefinition(key);
    if (dto.allowedValues !== undefined) {
      this.assertEnumHasValues(existing.dataType, dto.allowedValues);
    }
    const def = await this.prisma.attributeDefinition.update({
      where: { key },
      data: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.allowedValues !== undefined && {
          allowedValues: dto.allowedValues,
        }),
        ...(dto.appliesToCategories !== undefined && {
          appliesToCategories: dto.appliesToCategories,
        }),
        ...(dto.isFilterable !== undefined && {
          isFilterable: dto.isFilterable,
        }),
        ...(dto.isSortable !== undefined && { isSortable: dto.isSortable }),
        ...(dto.filterDisplayType !== undefined && {
          filterDisplayType: dto.filterDisplayType,
        }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: this.definitionSelect,
    });
    this.logger.log(`Admin ${adminId} updated attribute definition "${key}"`);
    return def;
  }

  async removeDefinition(key: string, adminId: string) {
    await this.getDefinition(key);
    // Soft-deactivate - keeps existing tour_attributes rows intact and the key reserved.
    await this.prisma.attributeDefinition.update({
      where: { key },
      data: { isActive: false },
    });
    this.logger.log(
      `Admin ${adminId} deactivated attribute definition "${key}"`,
    );
    return { message: `Attribute "${key}" deactivated` };
  }

  // ── Available filters for a category page (V2 §7) ───────────────────────────

  /**
   * Filters for a category page (destination + category): filterable attributes
   * scoped to the category, plus price/duration ranges. Powers the category page
   * filter modal.
   */
  async getFilters(destinationSlug: string, categorySlug: string) {
    return this.buildFilters(destinationSlug, categorySlug);
  }

  /**
   * Destination-wide filters (no category): price/duration ranges + attribute
   * value counts across EVERY live tour in the destination. Powers the All Tours
   * page filter modal (dynamic price bounds + attribute sections).
   */
  async getDestinationFilters(destinationSlug: string) {
    return this.buildFilters(destinationSlug);
  }

  /**
   * Shared builder: filterable attributes (+ value counts), price and duration
   * ranges over the destination's published-tour set. With `categorySlug` the set
   * is narrowed to that category and the attribute list is scoped to it; without
   * it, the whole destination is covered.
   */
  private async buildFilters(destinationSlug: string, categorySlug?: string) {
    const destination = await this.prisma.destination.findUnique({
      where: { slug: destinationSlug },
      select: { id: true, isActive: true },
    });
    if (!destination || !destination.isActive)
      throw new NotFoundException(`Destination "${destinationSlug}" not found`);

    let category: { id: string; slug: string } | null = null;
    if (categorySlug !== undefined) {
      const found = await this.prisma.category.findUnique({
        where: { slug: categorySlug },
        select: { id: true, slug: true, isActive: true },
      });
      if (!found || !found.isActive)
        throw new NotFoundException(`Category "${categorySlug}" not found`);
      category = { id: found.id, slug: found.slug };
    }

    const defs = await this.prisma.attributeDefinition.findMany({
      where: {
        isActive: true,
        isFilterable: true,
        // Category page: scope to attributes global or applicable to the category.
        // Destination-wide: include every filterable attribute (empty-value ones
        // are simply returned with no values for the client to skip).
        ...(category && {
          OR: [
            { appliesToCategories: { isEmpty: true } },
            { appliesToCategories: { has: category.slug } },
          ],
        }),
      },
      select: this.definitionSelect,
      orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
    });

    const tours = await this.prisma.tour.findMany({
      where: {
        destinationId: destination.id,
        status: TourStatus.LIVE,
        isActive: true,
        ...(category && { categories: { some: { categoryId: category.id } } }),
      },
      // `basePrice` for the price range; the derived-attribute columns power the
      // facet counts for derived keys (computed, never read from tour_attributes).
      select: { id: true, basePrice: true, ...derivedAttributeTourSelect },
    });
    const tourIds = tours.map((t) => t.id);

    // Price / duration ranges (from Tour columns).
    const prices = tours
      .map((t) => (t.basePrice == null ? null : Number(t.basePrice)))
      .filter((n): n is number => n != null);
    const durations = tours
      .map((t) => t.durationMinutesFrom)
      .filter((n): n is number => n != null);
    const priceRange = prices.length
      ? { min: Math.min(...prices), max: Math.max(...prices) }
      : null;
    const durationRange = durations.length
      ? { min: Math.min(...durations), max: Math.max(...durations) }
      : null;

    const defByKey = new Map(defs.map((d) => [d.key, d]));
    const counts = new Map<string, Map<string, number>>();
    const addMembers = (key: string, members: string[]) => {
      const byValue = counts.get(key) ?? new Map<string, number>();
      for (const m of members) byValue.set(m, (byValue.get(m) ?? 0) + 1);
      counts.set(key, byValue);
    };
    const membersOf = (
      dataType: AttributeDataType,
      value: string,
    ): string[] => {
      if (dataType !== AttributeDataType.ENUM_MULTI) return [value];
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map(String) : [value];
      } catch {
        return [value];
      }
    };

    // Value counts for STORED (non-derived) attributes from tour_attributes.
    // Derived keys are excluded here and counted from Tour columns below.
    if (tourIds.length) {
      const storedKeys = defs
        .map((d) => d.key)
        .filter((k) => !DERIVED_ATTRIBUTE_KEYS.has(k));
      if (storedKeys.length) {
        const rows = await this.prisma.tourAttribute.findMany({
          where: { tourId: { in: tourIds }, attributeKey: { in: storedKeys } },
          select: { attributeKey: true, attributeValue: true },
        });
        for (const row of rows) {
          const def = defByKey.get(row.attributeKey);
          if (!def) continue;
          addMembers(
            row.attributeKey,
            membersOf(def.dataType, row.attributeValue),
          );
        }
      }
    }

    // Value counts for DERIVED attributes, computed from each tour's first-class
    // fields (single source of truth) rather than tour_attributes.
    for (const tour of tours) {
      for (const d of deriveTourAttributes(tour)) {
        const def = defByKey.get(d.key);
        if (!def) continue; // only surface derived keys that are in the (filterable) dictionary
        addMembers(d.key, membersOf(def.dataType, d.value));
      }
    }

    const valueTypes = new Set<AttributeDataType>([
      AttributeDataType.ENUM,
      AttributeDataType.ENUM_MULTI,
      AttributeDataType.BOOLEAN,
    ]);

    const filters = defs.map((d) => ({
      key: d.key,
      displayName: d.displayName,
      dataType: d.dataType,
      filterDisplayType: d.filterDisplayType,
      isSortable: d.isSortable,
      sortOrder: d.sortOrder,
      values: valueTypes.has(d.dataType)
        ? [...(counts.get(d.key) ?? new Map())]
            .map(([value, count]) => ({ value, count }))
            .sort((a, b) => b.count - a.count)
        : [],
    }));

    return {
      destination: destinationSlug,
      category: categorySlug ?? null,
      total: tours.length,
      priceRange,
      durationRange,
      filters,
    };
  }

  // ── Per-tour assignment ─────────────────────────────────────────────────────

  async getTourAttributes(tourId: string) {
    await this.toursService.findTourOrThrow(tourId);
    const [tour, rows, defs] = await Promise.all([
      this.prisma.tour.findUniqueOrThrow({
        where: { id: tourId },
        select: derivedAttributeTourSelect,
      }),
      this.prisma.tourAttribute.findMany({
        where: { tourId: tourId },
        select: { attributeKey: true, attributeValue: true },
      }),
      this.prisma.attributeDefinition.findMany({
        select: { key: true, displayName: true, dataType: true },
      }),
    ]);
    const defByKey = new Map(defs.map((d) => [d.key, d]));

    // Stored rows, minus any derived key (those are computed below - single source
    // of truth is the tour's Details, so ignore stale stored copies).
    const stored = rows
      .filter((r) => !DERIVED_ATTRIBUTE_KEYS.has(r.attributeKey))
      .map((r) => ({
        key: r.attributeKey,
        value: r.attributeValue,
        displayName: defByKey.get(r.attributeKey)?.displayName ?? null,
        dataType: defByKey.get(r.attributeKey)?.dataType ?? null,
        derived: false,
      }));

    // Derived (read-only) attributes computed from first-class Tour fields.
    const derived = deriveTourAttributes(tour).map((d) => ({
      key: d.key,
      value: d.value,
      displayName: defByKey.get(d.key)?.displayName ?? null,
      dataType: defByKey.get(d.key)?.dataType ?? null,
      derived: true,
    }));

    return [...stored, ...derived];
  }

  /**
   * Upserts the supplied attribute values for a tour. Every key must exist in the
   * (active) dictionary and every value is validated/normalized against its dataType +
   * allowedValues. Unknown keys or invalid values are rejected (V2 §7).
   */
  async setTourAttributes(
    tourId: string,
    dto: SetTourAttributesDto,
    userId: string,
    role: Role,
  ) {
    const tour = await this.toursService.findTourOrThrow(tourId);
    await this.toursService.assertOwnership(tour, userId, role);

    const keys = dto.attributes.map((a) => a.key);
    if (new Set(keys).size !== keys.length) {
      throw new BadRequestException('Duplicate attribute keys in payload');
    }

    // Derived attributes are the single source of truth of the tour's Details and
    // cannot be set here (they are computed on read from first-class fields).
    const derivedInPayload = keys.filter((k) => DERIVED_ATTRIBUTE_KEYS.has(k));
    if (derivedInPayload.length) {
      throw new BadRequestException(
        `These attributes are derived from the tour's details and cannot be set here: ` +
          `${derivedInPayload.join(', ')}. Update them in the tour's Details tab.`,
      );
    }

    const defs = await this.prisma.attributeDefinition.findMany({
      where: { key: { in: keys }, isActive: true },
      select: { key: true, dataType: true, allowedValues: true },
    });
    const defByKey = new Map(defs.map((d) => [d.key, d]));

    // Validate + normalize every value before writing anything.
    const normalized = dto.attributes.map((item) => {
      const def = defByKey.get(item.key);
      if (!def)
        throw new BadRequestException(
          `Unknown attribute "${item.key}" - not in the dictionary`,
        );
      return {
        key: item.key,
        value: this.normalizeValue(
          def.dataType,
          def.allowedValues,
          item.key,
          item.value,
        ),
      };
    });

    await this.prisma.$transaction(
      normalized.map((n) =>
        this.prisma.tourAttribute.upsert({
          where: {
            tourId_attributeKey: { tourId: tourId, attributeKey: n.key },
          },
          create: {
            tourId: tourId,
            attributeKey: n.key,
            attributeValue: n.value,
          },
          update: { attributeValue: n.value },
        }),
      ),
    );

    this.logger.log(
      `User ${userId} set ${normalized.length} attribute(s) on tour ${tourId}`,
    );
    return this.getTourAttributes(tourId);
  }

  async deleteTourAttribute(
    tourId: string,
    key: string,
    userId: string,
    role: Role,
  ) {
    const tour = await this.toursService.findTourOrThrow(tourId);
    await this.toursService.assertOwnership(tour, userId, role);
    await this.prisma.tourAttribute
      .delete({
        where: { tourId_attributeKey: { tourId: tourId, attributeKey: key } },
      })
      .catch((err: any) => {
        if (err?.code === 'P2025')
          throw new NotFoundException(
            `Attribute "${key}" not set on this tour`,
          );
        throw err;
      });
    return { message: `Attribute "${key}" removed from tour` };
  }

  // ── Validation helpers ────────────────────────────────────────────────────────

  private assertEnumHasValues(
    dataType: AttributeDataType,
    allowedValues?: string[],
  ) {
    if (
      (dataType === AttributeDataType.ENUM ||
        dataType === AttributeDataType.ENUM_MULTI) &&
      (!allowedValues || allowedValues.length === 0)
    ) {
      throw new BadRequestException(
        `allowedValues is required for ${dataType} attributes`,
      );
    }
  }

  /** Validates a raw input value against its definition and returns the canonical stored string. */
  private normalizeValue(
    dataType: AttributeDataType,
    allowedValues: unknown,
    key: string,
    raw: string,
  ): string {
    const allowed = Array.isArray(allowedValues)
      ? (allowedValues as string[])
      : [];
    const value = raw.trim();

    switch (dataType) {
      case AttributeDataType.BOOLEAN:
        if (value !== 'true' && value !== 'false') {
          throw new BadRequestException(`"${key}" must be "true" or "false"`);
        }
        return value;
      case AttributeDataType.INTEGER:
        if (!/^-?\d+$/.test(value))
          throw new BadRequestException(`"${key}" must be an integer`);
        return value;
      case AttributeDataType.DECIMAL:
        if (!/^-?\d+(\.\d+)?$/.test(value))
          throw new BadRequestException(`"${key}" must be a number`);
        return value;
      case AttributeDataType.TEXT:
        return value;
      case AttributeDataType.ENUM:
        if (!allowed.includes(value)) {
          throw new BadRequestException(
            `"${key}" must be one of: ${allowed.join(', ')}`,
          );
        }
        return value;
      case AttributeDataType.ENUM_MULTI: {
        const parts = value
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean);
        if (parts.length === 0)
          throw new BadRequestException(`"${key}" requires at least one value`);
        const invalid = parts.filter((p) => !allowed.includes(p));
        if (invalid.length) {
          throw new BadRequestException(
            `"${key}" has invalid value(s): ${invalid.join(', ')}. Allowed: ${allowed.join(', ')}`,
          );
        }
        return JSON.stringify(parts);
      }
      default:
        throw new BadRequestException(
          `Unsupported attribute data type for "${key}"`,
        );
    }
  }
}
