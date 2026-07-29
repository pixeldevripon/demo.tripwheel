import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CustomScriptPosition, type Prisma } from '@prisma/client';

import {
  checkCustomScripts,
  parseCustomScript,
} from '@/common/utils/custom-scripts.util';
import { PrismaService } from '@/prisma/prisma.service';

import {
  CreateCustomScriptDto,
  CustomScriptResponseDto,
  PublicCustomScriptsResponseDto,
  ReorderCustomScriptsDto,
  UpdateCustomScriptDto,
} from './dto/custom-script.dto';

const SCRIPT_SELECT = {
  id: true,
  name: true,
  description: true,
  position: true,
  code: true,
  isActive: true,
  displayOrder: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CustomScriptSelect;

type ScriptRow = Prisma.CustomScriptGetPayload<{
  select: typeof SCRIPT_SELECT;
}>;

/** Curated order, then a stable tiebreak so two equal orders never swap. */
const ORDER_BY: Prisma.CustomScriptOrderByWithRelationInput[] = [
  { displayOrder: 'asc' },
  { createdAt: 'asc' },
  { id: 'asc' },
];

/**
 * Admin-pasted vendor snippets injected into every public page.
 *
 * ## Why every write is logged
 * These rows execute JavaScript on every visitor's browser, including the
 * checkout. When something starts exfiltrating or breaking, the first question
 * is always "what changed and who changed it", and the answer has to exist
 * BEFORE it is needed. Every mutating method here logs the admin id, the script
 * name and what happened - never the code itself, which would put a vendor's
 * (or an attacker's) payload into the log pipeline.
 *
 * ## Why the code is stored verbatim
 * An admin pastes a vendor's exact snippet. Reformatting or "cleaning" it would
 * break subresource-integrity hashes and make vendor support impossible ("we
 * don't recognise this code"). Safety comes from the write path instead:
 * `MANAGE_SETTINGS` on the controller, and the structural allowlist that the
 * DTO applies through `@IsSafeCustomScript()`.
 */
@Injectable()
export class CustomScriptsService {
  private readonly logger = new Logger(CustomScriptsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Public read ─────────────────────────────────────────────────────────────

  /**
   * What the public site renders, already split by injection point.
   *
   * Inactive rows are filtered in the QUERY, not in the response shape: an
   * "off" snippet must never reach the payload at all, or a switched-off
   * vendor's code would still be sitting in the HTML of every page.
   */
  async getPublicScripts(): Promise<PublicCustomScriptsResponseDto> {
    const rows = await this.prisma.customScript.findMany({
      where: { isActive: true },
      select: { id: true, code: true, position: true },
      orderBy: ORDER_BY,
    });

    // Parsed here rather than shipped raw: the site renders a closed set of
    // known tags instead of interpolating a string, and a <head> has nowhere to
    // put the wrapper element raw interpolation would need. See
    // `parseCustomScript` for why this is also the last defence-in-depth step.
    const forPosition = (position: CustomScriptPosition) =>
      rows
        .filter((row) => row.position === position)
        .map((row) => ({ id: row.id, nodes: parseCustomScript(row.code) }))
        .filter((script) => script.nodes.length > 0);

    return {
      head: forPosition(CustomScriptPosition.HEAD),
      bodyEnd: forPosition(CustomScriptPosition.BODY_END),
    };
  }

  // ── Admin ───────────────────────────────────────────────────────────────────

  /** Every snippet, active or not, in render order. */
  async findAll(): Promise<CustomScriptResponseDto[]> {
    const rows = await this.prisma.customScript.findMany({
      select: SCRIPT_SELECT,
      orderBy: ORDER_BY,
    });
    return rows.map(toResponse);
  }

  async findOne(id: string): Promise<CustomScriptResponseDto> {
    return toResponse(await this.findOrThrow(id));
  }

  /**
   * New snippets land at the END of their position, so adding one can never
   * silently jump ahead of a consent manager that is already there.
   */
  async create(
    dto: CreateCustomScriptDto,
    adminId: string,
  ): Promise<CustomScriptResponseDto> {
    const position = dto.position ?? CustomScriptPosition.BODY_END;
    this.assertValidForPosition(dto.code, position);

    const tail = await this.prisma.customScript.aggregate({
      where: { position },
      _max: { displayOrder: true },
    });

    const row = await this.prisma.customScript.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        position,
        code: dto.code,
        isActive: dto.isActive ?? true,
        displayOrder: (tail._max.displayOrder ?? -1) + 1,
      },
      select: SCRIPT_SELECT,
    });

    this.logger.log(
      `Admin ${adminId} ADDED custom script "${row.name}" (${row.id}) at ${row.position}, active=${row.isActive}`,
    );
    return toResponse(row);
  }

  async update(
    id: string,
    dto: UpdateCustomScriptDto,
    adminId: string,
  ): Promise<CustomScriptResponseDto> {
    const existing = await this.findOrThrow(id);

    // Cross-field rule, so it cannot live on the DTO: <noscript> is legal in
    // BODY_END and illegal in HEAD, and either field can be the one that moves.
    // Checking the EFFECTIVE pair catches "change position only", which would
    // otherwise slip a <noscript> into the head that was valid where it was.
    const position = dto.position ?? existing.position;
    const code = dto.code ?? existing.code;
    if (dto.code !== undefined || dto.position !== undefined) {
      this.assertValidForPosition(code, position);
    }

    const row = await this.prisma.customScript.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.description !== undefined && {
          description: dto.description.trim() || null,
        }),
        ...(dto.position !== undefined && { position: dto.position }),
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: SCRIPT_SELECT,
    });

    // Spell out WHICH of the two dangerous changes happened. "updated" is not
    // enough when the question is whether live code changed or someone just
    // fixed a typo in the name.
    const changed: string[] = [];
    if (dto.code !== undefined && dto.code !== existing.code) {
      changed.push('CODE CHANGED');
    }
    if (dto.isActive !== undefined && dto.isActive !== existing.isActive) {
      changed.push(dto.isActive ? 'ENABLED' : 'DISABLED');
    }
    if (dto.position !== undefined && dto.position !== existing.position) {
      changed.push(`moved to ${dto.position}`);
    }
    this.logger.log(
      `Admin ${adminId} updated custom script "${row.name}" (${id})${
        changed.length ? ` - ${changed.join(', ')}` : ''
      }`,
    );
    return toResponse(row);
  }

  async remove(id: string, adminId: string): Promise<{ message: string }> {
    const existing = await this.findOrThrow(id);
    await this.prisma.customScript.delete({ where: { id } });

    this.logger.log(
      `Admin ${adminId} DELETED custom script "${existing.name}" (${id})`,
    );
    return { message: 'Custom script removed' };
  }

  /**
   * Persist a reorder. One transaction: order decides execution order, so a
   * half-applied reorder can leave a tag firing before the consent manager that
   * is supposed to gate it.
   */
  async reorder(
    dto: ReorderCustomScriptsDto,
    adminId: string,
  ): Promise<CustomScriptResponseDto[]> {
    const ids = dto.items.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException(
        'Duplicate script id in the reorder payload',
      );
    }

    const found = await this.prisma.customScript.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (found.length !== ids.length) {
      throw new BadRequestException(
        'Reorder payload references a script that no longer exists',
      );
    }

    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.customScript.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder },
        }),
      ),
    );

    this.logger.log(`Admin ${adminId} reordered ${ids.length} custom scripts`);
    return this.findAll();
  }

  // ── Guards ──────────────────────────────────────────────────────────────────

  /**
   * The position-dependent half of the structural check. `@IsSafeCustomScript()`
   * on the DTO validates the snippet on its own; only the service knows which
   * position it is being stored at, and one rule depends on it.
   */
  private assertValidForPosition(
    code: string,
    position: CustomScriptPosition,
  ): void {
    const check = checkCustomScripts(code, position);
    if (!check.ok) {
      throw new BadRequestException(check.reason ?? 'Invalid script block');
    }
  }

  private async findOrThrow(id: string): Promise<ScriptRow> {
    const row = await this.prisma.customScript.findUnique({
      where: { id },
      select: SCRIPT_SELECT,
    });
    if (!row) throw new NotFoundException('Custom script not found');
    return row;
  }
}

function toResponse(row: ScriptRow): CustomScriptResponseDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    position: row.position,
    code: row.code,
    isActive: row.isActive,
    displayOrder: row.displayOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
