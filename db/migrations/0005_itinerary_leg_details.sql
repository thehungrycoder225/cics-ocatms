ALTER TABLE itinerary_stop
  ADD COLUMN departure_location text
    CHECK (departure_location IS NULL OR length(trim(departure_location)) BETWEEN 1 AND 300);

ALTER TABLE itinerary_stop DROP CONSTRAINT itinerary_stop_travel_mode_check;
ALTER TABLE itinerary_stop ADD CONSTRAINT itinerary_stop_travel_mode_check
  CHECK (travel_mode IN ('DRIVE', 'WALK', 'BICYCLE', 'TWO_WHEELER', 'VAN', 'SHIP'));
