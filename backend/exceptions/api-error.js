module.exports = class ApiError extends Error {
  status;
  errors;

  constructor(status, errors = []) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }

  static UnauthorizedError(message = 'User is not authorized') {
    return new ApiError(401, message);
  }

  static BadRequest(message, errors = []) {
    return new ApiError(400, message, errors);
  }

  static InternalServerError(message = 'Internal server error', errors = []) {
    return new ApiError(500, message, errors);
  }

  toJSON() {
    return {
      status: this.status,
      message: this.message,
      errors: this.errors,
    };
  }
};
