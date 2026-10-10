const { HttpError } = require('../lib/errors');

const PG_UNIQUE_VIOLATION = '23505';
const PG_FOREIGN_KEY_VIOLATION = '23503';

function notFoundRoute(req, _res, next) {
  next(new HttpError(404, 'ROUTE_NOT_FOUND', `Route ${req.method} ${req.path} not found`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  let error = err;

  if (err.code === PG_UNIQUE_VIOLATION) {
    error = new HttpError(409, 'DUPLICATE', 'A record with the same unique value already exists');
  } else if (err.code === PG_FOREIGN_KEY_VIOLATION) {
    error = new HttpError(422, 'INVALID_REFERENCE', 'A referenced record does not exist');
  } else if (err.type === 'entity.parse.failed') {
    error = new HttpError(400, 'INVALID_JSON', 'Request body is not valid JSON');
  }

  if (!(error instanceof HttpError)) {
    console.error(err);
    error = new HttpError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
  }

  const body = { error: { code: error.code, message: error.message } };
  if (error.details) body.error.details = error.details;
  res.status(error.status).json(body);
}

module.exports = { errorHandler, notFoundRoute };
