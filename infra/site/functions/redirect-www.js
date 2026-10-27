// CloudFront Function, JavaScript runtime 2.0.
// Terraform replaces the placeholder __DOMAIN__ with the apex domain before it uploads the function.
// A request for www.<domain> gets a 301 redirect to https://<domain>, with the same path and query string.
// Requests for any other host, or with no Host header, pass through unchanged.

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

  if (host !== 'www.__DOMAIN__') {
    return request;
  }

  const pairs = [];
  const params = request.querystring || {};
  Object.keys(params).forEach((key) => {
    const param = params[key];
    // A parameter that repeats has all its values in multiValue. The plain value is only the first one.
    const values = param.multiValue ? param.multiValue : [{ value: param.value }];
    values.forEach((item) => {
      pairs.push(encodeQueryPart(key) + '=' + encodeQueryPart(item.value));
    });
  });

  let location = 'https://__DOMAIN__' + request.uri;
  if (pairs.length > 0) {
    location += '?' + pairs.join('&');
  }

  return {
    statusCode: 301,
    statusDescription: 'Moved Permanently',
    headers: {
      location: { value: location },
    },
  };
}
