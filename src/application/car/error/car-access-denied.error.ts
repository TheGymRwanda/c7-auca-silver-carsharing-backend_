import { AccessDeniedError } from '../../access-denied.error'
import { type CarID } from '../car'

export class CarAccessDeniedError extends AccessDeniedError<CarID> {
  public constructor(carId: CarID) {
    super('Car', carId)
  }
}