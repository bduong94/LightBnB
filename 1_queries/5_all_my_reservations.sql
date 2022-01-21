SELECT reservations.id, title, cost_per_night, start_date
FROM reservations 
JOIN properties ON properties.id = property_id
WHERE reservations.guest_id = 4 
-- And title IN (SELECT AVG(rating)
-- FROM property_reviews
-- JOIN properties ON properties.id = property_reviews.property_id
-- GROUP BY title) AS average_rating
ORDER BY start_date
LIMIT 10;


