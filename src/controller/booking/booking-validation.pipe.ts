import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common'
import { BookingState } from '../../application'

interface Options {
  isPatch?: boolean
}

@Injectable()
export class BookingValidationPipe implements PipeTransform {
  public constructor(private readonly options: Options = {}) {}

  public transform(value: any) {
    if (!value) return value

    const body = value as any

    if (!this.options.isPatch) {
      if (body.carId === undefined || body.carId === null) {
        throw new BadRequestException('carId is required')
      }

      if (!body.startDate) {
        throw new BadRequestException('startDate is required')
      }

      if (!body.endDate) {
        throw new BadRequestException('endDate is required')
      }
    }

    if (body.startDate) {
      const start = body.startDate instanceof Date ? body.startDate : new Date(body.startDate)
      if (isNaN(start.getTime())) {
        throw new BadRequestException('startDate is not a valid date')
      }
      body.startDate = start
    }

    if (body.endDate) {
      const end = body.endDate instanceof Date ? body.endDate : new Date(body.endDate)
      if (isNaN(end.getTime())) {
        throw new BadRequestException('endDate is not a valid date')
      }
      body.endDate = end
    }

    if (body.startDate && body.endDate && body.startDate >= body.endDate) {
      throw new BadRequestException('endDate must be after startDate')
    }

    if (body.state !== undefined && body.state !== null) {
      const vals = Object.values(BookingState)
      if (!vals.includes(body.state)) {
        throw new BadRequestException('state is not a valid BookingState')
      }
    }

    return body
  }
}
