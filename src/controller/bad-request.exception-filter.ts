import { type ArgumentsHost, BadRequestException, Catch } from '@nestjs/common'
import { BaseExceptionFilter } from '@nestjs/core'

import { DuplicateLicensePlateError } from '../application/car/error'

@Catch(DuplicateLicensePlateError)
export class BadRequestExceptionFilter extends BaseExceptionFilter {
  public catch(
    exception: DuplicateLicensePlateError,
    host: ArgumentsHost,
  ): void {
    super.catch(new BadRequestException(exception.message), host)
  }
}
