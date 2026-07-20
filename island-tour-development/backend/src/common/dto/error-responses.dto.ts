import { ApiProperty } from '@nestjs/swagger';

class ErrorResponseDto {
  @ApiProperty({ example: false })
  success!: boolean;

  @ApiProperty({ example: 'Error message description' })
  message!: string;

  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: 'Bad Request' })
  error!: string;
}

export class BadRequestErrorDto extends ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode: number = 400;

  @ApiProperty({ example: 'Bad Request' })
  error: string = 'Bad Request';
}

export class UnauthorizedErrorDto extends ErrorResponseDto {
  @ApiProperty({ example: 401 })
  statusCode: number = 401;

  @ApiProperty({ example: 'Unauthorized' })
  error: string = 'Unauthorized';
}

export class ForbiddenErrorDto extends ErrorResponseDto {
  @ApiProperty({ example: 403 })
  statusCode: number = 403;

  @ApiProperty({ example: 'Forbidden' })
  error: string = 'Forbidden';
}

export class NotFoundErrorDto extends ErrorResponseDto {
  @ApiProperty({ example: 404 })
  statusCode: number = 404;

  @ApiProperty({ example: 'Not Found' })
  error: string = 'Not Found';
}

export class ConflictErrorDto extends ErrorResponseDto {
  @ApiProperty({ example: 409 })
  statusCode: number = 409;

  @ApiProperty({ example: 'Conflict' })
  error: string = 'Conflict';
}

export class PaymentRequiredErrorDto extends ErrorResponseDto {
  @ApiProperty({ example: 402 })
  statusCode: number = 402;

  @ApiProperty({ example: 'Payment Required' })
  error: string = 'Payment Required';
}

export class InternalServerErrorDto extends ErrorResponseDto {
  @ApiProperty({ example: 500 })
  statusCode: number = 500;

  @ApiProperty({ example: 'Internal Server Error' })
  error: string = 'Internal Server Error';
}
