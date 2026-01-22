import { Opaque } from "type-fest";
import { CarID } from "../car";
import { UserID } from "../user";
import { BookingState } from "./booking-state";

export type BookingID = Opaque<number, 'booking-id'>

export type BookingProperties = {
    id: BookingID
    carId: CarID
    renterId: UserID
    state: BookingState
    startDate: Date
    endDate: Date
}