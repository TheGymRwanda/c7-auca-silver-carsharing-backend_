import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotImplementedException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
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
  @Get()
  public async getAll(): Promise<CarDTO[]> {
    throw new NotImplementedException()
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
  public async get(@Param('id', ParseIntPipe) _id: CarID): Promise<CarDTO> {
    throw new NotImplementedException()
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
      'The request was malformed, e.g. missing or invalid parameter or property in the request body.',
  })
  @ApiConflictResponse({
    description: 'A car with the given license plate already exists.',
  })
  @Post()
  public async create(
    @CurrentUser() owner: User,
    @Body() data: CreateCarDTO,
  ): Promise<CarDTO> {
    const car = await this.carService.create({
      ...data,
      ownerId: owner.id,
      state: CarState.LOCKED,
    })

    return CarDTO.fromModel(car)
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
      'The request was malformed, e.g. missing or invalid parameter or property in the request body.',
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
    const car = await this.carService.update(carId, data, user.id)
    return CarDTO.fromModel(car)
  }
}
