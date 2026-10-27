// CloudFront Function, JavaScript runtime 2.0.
// Terraform replaces the placeholder __DOMAIN__ with the apex domain before it uploads the function.
// A request for any host other than <domain> (www.<domain>, or the default *.cloudfront.net host)
// gets a 301 redirect to https://<domain>, with the same path and query string.
// Requests for <domain>, or with no Host header, pass through unchanged.

// Encodes a query key or value. The result is the same whether CloudFront passes the
// value decoded or still encoded: existing %XX escapes are restored, and a plus sign stays a plus sign.
function encodeQueryPart(text) {
  return encodeURIComponent(text)
    .replace(/%25([0-9A-Fa-f]{2})/g, '%$1')
    .replace(/%2B/gi, '+');
}

function handler(event) {
  const request = event.request;
  const host = ((request.headers.host || {}).value || '').toLowerCase();

  if (host === '' || host === '__DOMAIN__') {
    return request;
  }

  // A parameter that repeats has all its values in multiValue. The plain value is only the first one.
  const params = request.querystring || {};
  let query = '';
  for (const key in params) {
    for (const item of params[key].multiValue || [params[key]]) {
      query += (query ? '&' : '?') + encodeQueryPart(key) + '=' + encodeQueryPart(item.value);
    }
  }

  return {
    statusCode: 301,
    statusDescription: 'Moved Permanently',
    headers: {
      location: { value: 'https://__DOMAIN__' + request.uri + query },
    },
  };
}
