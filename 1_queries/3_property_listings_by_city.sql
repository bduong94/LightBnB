SELECT properties.id AS id, properties.title AS title, properties.cost_per_night AS cost_per_night, AVG(property_reviews.rating) AS average_rating
FROM properties
JOIN property_reviews ON properties.id = property_id
WHERE city like '%ancouve%'
GROUP BY properties.id
HAVING AVG(property_reviews.rating) >= 4
ORDER BY cost_per_night
LIMIT 10;