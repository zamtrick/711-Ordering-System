// --------------------------------------------------
// SHARED PAGINATION HELPERS
// --------------------------------------------------
// List endpoints accept optional query params:
//   ?page=1&limit=10&search=foo
//
// When none of these params are present, controllers return the FULL list
// (backward compatible with mobile apps and other existing consumers).
// When pagination is requested, controllers add a `pagination` metadata
// object to the response built by buildPaginationMeta().
// --------------------------------------------------

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const parsePagination = (req, { defaultLimit = 10, maxLimit = 100 } = {}) => {
  const toPositiveInt = (value, fallback) => {
    const n = Number.parseInt(String(value ?? ""), 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };

  const page = toPositiveInt(req.query.page, 1);
  const limit = Math.min(toPositiveInt(req.query.limit, defaultLimit), maxLimit);
  const search = String(req.query.search ?? "").trim();
  const status = String(req.query.status ?? "").trim();

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    search,
    status,
    // Pagination (and server-side search) only kick in when the client asks
    // for it — legacy consumers keep receiving the full unfiltered list.
    paginated:
      req.query.page !== undefined ||
      req.query.limit !== undefined ||
      Boolean(search) ||
      Boolean(status),
  };
};

export const buildPaginationMeta = (total, page, limit) => ({
  total,
  page,
  limit,
  totalPages: Math.max(1, Math.ceil(total / limit)),
  hasNextPage: page * limit < total,
  hasPrevPage: page > 1,
});

export { escapeRegex };
