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
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permission } from '@prisma/client';
import {
  OperatorQueryDto,
  UpdateUserByAdminDto,
  UpdateUserProfileDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
  UserQueryDto,
} from './dto/user.dto';
import { UserService } from './user.service';
import {
  ApiDeleteUserDocs,
  ApiGetAllOperatorsDocs,
  ApiGetAllUsersDocs,
  ApiGetCurrentUserDocs,
  ApiGetCurrentUserPermissionsDocs,
  ApiGetUserByIdDocs,
  ApiGetUserPermissionsDocs,
  ApiUpdateUserByAdminDocs,
  ApiUpdateUserProfileDocs,
  ApiUpdateUserRoleDocs,
  ApiUpdateUserStatusDocs,
} from './user.swagger';

@ApiTags('Users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * Static routes must be declared before :id to prevent NestJS from treating
   * "me" and "operators" as dynamic id segments.
   */

  @Get('me')
  @ApiGetCurrentUserDocs()
  getCurrentUser(@AuthenticatedUser() user: TypedAuthUser) {
    return this.userService.getCurrentUser(user.id);
  }

  @Get('me/permissions')
  @ApiGetCurrentUserPermissionsDocs()
  getCurrentUserPermissions(@AuthenticatedUser() user: TypedAuthUser) {
    return this.userService.getUserPermissions(user.id);
  }

  @Get('operators')
  @RequirePermissions(Permission.VIEW_USERS)
  @ApiGetAllOperatorsDocs()
  getAllOperators(@Query() query: OperatorQueryDto) {
    return this.userService.getAllOperators(query);
  }

  @Get()
  @RequirePermissions(Permission.VIEW_USERS)
  @ApiGetAllUsersDocs()
  getAllUsers(@Query() query: UserQueryDto) {
    return this.userService.getAllUsers(query);
  }

  @Get(':id')
  @RequirePermissions(Permission.VIEW_USERS)
  @ApiGetUserByIdDocs()
  getUserById(@Param('id') id: string) {
    return this.userService.getUserById(id);
  }

  @Get(':id/permissions')
  @ApiGetUserPermissionsDocs()
  getUserPermissions(@Param('id') id: string) {
    return this.userService.getUserPermissions(id);
  }

  @Patch('me')
  @ApiUpdateUserProfileDocs()
  updateProfile(
    @AuthenticatedUser() user: TypedAuthUser,
    @Body() dto: UpdateUserProfileDto,
  ) {
    return this.userService.updateUserProfile(user.id, dto);
  }

  @Patch(':id/role')
  @RequirePermissions(Permission.MANAGE_USERS)
  @ApiUpdateUserRoleDocs()
  updateUserRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.userService.updateUserRole(id, dto, user.id);
  }

  @Patch(':id/status')
  @RequirePermissions(Permission.MANAGE_USERS)
  @ApiUpdateUserStatusDocs()
  updateUserStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.userService.updateUserStatus(id, dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.UPDATE_USER)
  @ApiUpdateUserByAdminDocs()
  updateUserByAdmin(
    @Param('id') id: string,
    @Body() dto: UpdateUserByAdminDto,
  ) {
    return this.userService.updateUserByAdmin(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.DELETE_USER)
  @ApiDeleteUserDocs()
  deleteUser(
    @Param('id') id: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.userService.deleteUser(id, user.id);
  }
}
