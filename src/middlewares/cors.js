/**
 * Lightweight CORS middleware to avoid relying on the external `cors` package
 * during CI builds. Provides the default behaviour previously configured.
 */
function createCorsMiddleware(options = {}) {
  const {
    origin = '*',
    methods = 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders = 'Content-Type, Authorization'
  } = options;

  return function corsMiddleware(req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', methods);
    res.setHeader('Access-Control-Allow-Headers', allowedHeaders);

    if (req.method === 'OPTIONS') {
      // Preflight requests should return quickly with no body
      res.statusCode = 204;
      return res.end();
    }

    return next();
  };
}

module.exports = createCorsMiddleware;
