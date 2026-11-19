import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import {
  searchAirports,
  getPopularAirports,
  getRecentSearches,
  saveRecentSearch,
  searchFlights
} from './flights.controller.js';

const router = express.Router();

// Airport discovery
router.get('/airports/search', searchAirports);
router.get('/airports/popular', getPopularAirports);
// Recent searches belong to the logged-in user.
router.get('/airports/recent', authenticate, getRecentSearches);
router.post('/airports/recent', authenticate, saveRecentSearch);

// Flight search
router.get('/search', searchFlights);

export default router;
