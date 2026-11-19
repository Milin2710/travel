import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import {
  createBooking,
  getMyBookings,
  getBookingById,
  cancelBooking
} from './bookings.controller.js';

const router = express.Router();

// Every booking route belongs to the logged-in user.
router.use(authenticate);

router.post('/', createBooking);
router.get('/', getMyBookings);
router.get('/:id', getBookingById);
router.patch('/:id/cancel', cancelBooking);

export default router;
