import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'

import {
  Car,
  CarState,
  type CarID,
  ICarService,
  type User,
} from '../../application'
import { CarAccessDeniedError, DuplicateLicensePlateError } from '../../application/car/error'
import { AuthenticationGuard } from '../authentication.guard'
import { CurrentUser } from '../current-user.decorator'

import { CarDTO, CreateCarDTO, PatchCarDTO } from './car.dto'

@ApiTags(Car.name)
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description:
    'The request was not authorized because the JWT was missing, expired or otherwise invalid.',
})
@ApiInternalServerErrorResponse({
  description: 'An internal server error occurred.',
})
@UseGuards(AuthenticationGuard)
@Controller('/cars')
export class CarController {
  private readonly carService: ICarService

  public constructor(carService: ICarService) {
    this.carService = carService
  }

  // Please remove the next line when implementing this file.
  /* eslint-disable @typescript-eslint/require-await */

  @ApiOperation({
    summary: 'Retrieve all cars.',
  })
  @ApiOkResponse({
    description: 'The request was successful.',
    type: [CarDTO],
  })
  @Get()
  public async getAll(): Promise<CarDTO[]> {
    const cars = await this.carService.getAll()

    return cars.map(car => CarDTO.fromModel(car))
  }

  @ApiOperation({
    summary: 'Retrieve a specific car.',
  })
  @ApiOkResponse({
    description: 'The request was successful.',
    type: CarDTO,
  })
  @ApiBadRequestResponse({
    description:
      'The request was malformed, e.g. missing or invalid parameter or property in the request body.',
  })
  @ApiNotFoundResponse({
    description: 'No car with the given id was found.',
  })
  @Get(':id')
  public async get(@Param('id', ParseIntPipe) id: CarID): Promise<CarDTO> {
    const car = await this.carService.get(id)

    return CarDTO.fromModel(car)
  }

  @ApiOperation({
    summary: 'Create a new car.',
  })
  @ApiCreatedResponse({
    description: 'A new car was created.',
    type: CarDTO,
  })
  @ApiBadRequestResponse({
    description:
      'The request was malformed, e.g. missing or invalid parameter or property in the request body, or a car with the given license plate already exists.',
  })
  @Post()
  public async create(
    @CurrentUser() owner: User,
    @Body() data: CreateCarDTO,
  ): Promise<CarDTO> {
    try {
      const car = await this.carService.create({
        ...data,
        ownerId: owner.id,
        state: CarState.LOCKED,
      })

      return CarDTO.fromModel(car)
    } catch (error) {
      if (error instanceof DuplicateLicensePlateError) {
        throw new BadRequestException(
          'A car with this license plate already exists'
        )
      }
      throw error
    }
  }

  @ApiOperation({
    summary: 'Update an existing car.',
  })
  @ApiOkResponse({
    description: 'The car was updated.',
    type: CarDTO,
  })
  @ApiBadRequestResponse({
    description:
      'The request was malformed, e.g. missing or invalid parameter or property in the request body, or another car already has the provided license plate.',
  })
  @ApiNotFoundResponse({
    description: 'No car with the given id was found.',
  })
  @ApiForbiddenResponse({
    description: 'You can only update cars that you own.',
  })
  @Patch(':id')
  public async patch(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) carId: CarID,
    @Body() data: PatchCarDTO,
  ): Promise<CarDTO> {
    try {
      const car = await this.carService.update(carId, data, user.id)
      return CarDTO.fromModel(car)
    } catch (error) {
      if (error instanceof CarAccessDeniedError) {
        throw new ForbiddenException('You can only update cars that you own')
      }
      if (error instanceof DuplicateLicensePlateError) {
        throw new BadRequestException(
          'Another car already has this license plate'
        )
      }
      throw error
    }
  }
}
