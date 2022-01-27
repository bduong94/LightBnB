const properties = require("./json/properties.json");
const users = require("./json/users.json");
const { Pool } = require("pg");
const { get } = require("express/lib/response");

const pool = new Pool({
  user: "vagrant",
  password: "123",
  host: "localhost",
  database: "lightbnb",
});

//Connect to database
pool.connect();

/// Users

/**
 * Get a single user from the database given their email.
 * @param {String} email The email of the user.
 * @return {Promise<{}>} A promise to the user.
 */

const getUserWithEmail = function (email) {
  return pool
    .query(
      `
  SELECT id, name, email, password
  FROM users
  WHERE email = '${email}';
  `
    )
    .then((res) => {
      if (res.rows !== []) {
        return res["rows"][0];
      }
      return null;
    })
    .catch((err) => console.error("query error", err.stack));
};

exports.getUserWithEmail = getUserWithEmail;

/**
 * Get a single user from the database given their id.
 * @param {string} id The id of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithId = function (id) {
  return pool
    .query(
      `SELECT *
  FROM users
  WHERE id = ${id}`
    )
    .then((res) => {
      return res["rows"][0];
    })
    .catch((err) => console.error("query error", err.stack));
};
exports.getUserWithId = getUserWithId;

/**
 * Add a new user to the database.
 * @param {{name: string, password: string, email: string}} user
 * @return {Promise<{}>} A promise to the user.
 */
const addUser = function (user) {
  const { name, email, password } = user;

  return pool
    .query(
      `INSERT INTO users (name, email, password)
  VALUES ('${name}', '${email}', '${password}')  
  RETURNING *`
    )
    .then((res) => {
      return res.rows[0];
    })
    .catch((err) => console.error("query error", err.stack));
};
exports.addUser = addUser;

/// Reservations

/**
 * Get all reservations for a single user.
 * @param {string} guest_id The id of the user.
 * @return {Promise<[{}]>} A promise to the reservations.
 */
const getAllReservations = function (guest_id, limit = 10) {
  return pool
    .query(
      `SELECT reservations.id, properties.*, reservations.start_date, avg(rating) as average_rating
  FROM reservations
  JOIN properties ON reservations.property_id = properties.id
  JOIN property_reviews ON properties.id = property_reviews.property_id
  WHERE reservations.guest_id = $1
  GROUP BY properties.id, reservations.id
  ORDER BY reservations.start_date
  LIMIT $2;`,
      [guest_id, limit]
    )
    .then((res) => {
      return res.rows;
    })
    .catch((err) => console.error("query error", err.stack));
};
exports.getAllReservations = getAllReservations;

/// Properties

/**
 * Get all properties.
 * @param {{}} options An object containing query options.
 * @param {*} limit The number of results to return.
 * @return {Promise<[{}]>}  A promise to the properties.
 */
const getAllProperties = function (options, limit = 10) {
  const {
    city,
    owner_id,
    minimum_price_per_night,
    maximum_price_per_night,
    minimum_rating,
  } = options;

  const queryParams = [];

  let queryString = `
  SELECT properties.*, avg(property_reviews.rating) as average_rating
  FROM properties
  JOIN property_reviews ON properties.id = property_id 
  `;

  if (city) {
    queryParams.push(`%${city}%`);
    queryString += `WHERE city LIKE $${queryParams.length}`;
  }

  if (owner_id) {
    if (queryParams.length > 0) {
      queryParams.push(owner_id);
      queryString += ` AND owner_id = $${queryParams.length}`;
    } else {
      queryParams.push(owner_id);
      queryString += `
      WHERE owner_id = $${queryParams.length}`;
    }
  }

  if (!maximum_price_per_night && minimum_price_per_night) {
    if (queryParams.length > 0) {
      queryParams.push(parseInt(minimum_price_per_night) * 100);
      queryString += ` AND cost_per_night > $${queryParams.length}`;
    } else {
      queryParams.push(parseInt(minimum_price_per_night) * 100);
      queryString += `WHERE cost_per_night > $${queryParams.length}`;
    }
  }

  if (maximum_price_per_night && !minimum_price_per_night) {
    if (queryParams.length > 0) {
      queryParams.push(parseInt(maximum_price_per_night) * 100);
      queryString += ` AND cost_per_night < $${queryParams.length}`;
    } else {
      queryParams.push(parseInt(maximum_price_per_night) * 100);
      queryString += `WHERE cost_per_night < $${queryParams.length}`;
    }
  }

  if (maximum_price_per_night && minimum_price_per_night) {
    if (queryParams.length > 0) {
      queryParams.push(parseInt(minimum_price_per_night) * 100);
      queryString += ` AND cost_per_night BETWEEN $${queryParams.length}`;
      queryParams.push(parseInt(maximum_price_per_night) * 100);
      queryString += ` AND $${queryParams.length}`;
    } else {
      queryParams.push(parseInt(minimum_price_per_night) * 100);
      queryString += `WHERE cost_per_night BETWEEN $${queryParams.length}`;
      queryParams.push(parseInt(maximum_price_per_night) * 100);
      queryString += ` AND $${queryParams.length}`;
    }
  }

  if (minimum_rating) {
    queryParams.push(parseInt(minimum_rating));
    queryString += `
    GROUP BY properties.id
    HAVING avg(property_reviews.rating) >= $${queryParams.length}`;

    queryParams.push(limit);
    queryString += `
    ORDER BY cost_per_night
    LIMIT $${queryParams.length};`;
  } else {
    queryParams.push(limit);
    queryString += `
    GROUP BY properties.id
    ORDER BY cost_per_night
    LIMIT $${queryParams.length};`;
  }

  return pool
    .query(queryString, queryParams)
    .then((res) => {
      return res.rows;
    })
    .catch((err) => {
      console.error(err.message);
    });
};
exports.getAllProperties = getAllProperties;

/**
 * Add a property to the database
 * @param {{}} property An object containing all of the property details.
 * @return {Promise<{}>} A promise to the property.
 */
const addProperty = function (property) {
  return pool
    .query(
      `INSERT INTO properties (owner_id, title, description, thumbnail_photo_url, cover_photo_url, cost_per_night, street, city, province, post_code, country, parking_spaces, number_of_bathrooms, number_of_bedrooms)
  VALUES (${property.owner_id}, '${property.title}', '${property.description}', '${property.thumbnail_photo_url}', '${property.cover_photo_url}', ${property.cost_per_night}, '${property.street}', '${property.city}', '${property.province}', '${property.post_code}', '${property.country}', ${property.parking_spaces}, ${property.number_of_bathrooms}, ${property.number_of_bedrooms}) 
  RETURNING *`
    )
    .then((res) => {
      return res.rows[0];
    })
    .catch((err) => console.error("query error", err.stack));
};
exports.addProperty = addProperty;
