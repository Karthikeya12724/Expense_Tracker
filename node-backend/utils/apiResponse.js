// Mirrors com.fullStack.expenseTracker.dto.reponses.ApiResponseDto
function success(res, httpStatus, response) {
  return res.status(httpStatus).json({
    status: 'SUCCESS',
    httpStatus: httpStatusName(httpStatus),
    response,
  });
}

function failed(res, httpStatus, message) {
  return res.status(httpStatus).json({
    status: 'FAILED',
    httpStatus: httpStatusName(httpStatus),
    response: message,
  });
}

function httpStatusName(code) {
  const map = {
    200: 'OK',
    201: 'CREATED',
    202: 'ACCEPTED',
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    500: 'INTERNAL_SERVER_ERROR',
  };
  return map[code] || String(code);
}

module.exports = { success, failed };
