var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// node_modules/.pnpm/hono@4.9.4/node_modules/hono/dist/compose.js
var compose = /* @__PURE__ */ __name((middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || void 0;
      }
      if (handler) {
        try {
          res = await handler(context, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
    __name(dispatch, "dispatch");
  };
}, "compose");

// node_modules/.pnpm/hono@4.9.4/node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = Symbol();

// node_modules/.pnpm/hono@4.9.4/node_modules/hono/dist/utils/body.js
var parseBody = /* @__PURE__ */ __name(async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = request instanceof HonoRequest ? request.raw.headers : request.headers;
  const contentType = headers.get("Content-Type");
  if (contentType?.startsWith("multipart/form-data") || contentType?.startsWith("application/x-www-form-urlencoded")) {
    return parseFormData(request, { all, dot });
  }
  return {};
}, "parseBody");
async function parseFormData(request, options) {
  const formData = await request.formData();
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
__name(parseFormData, "parseFormData");
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
__name(convertFormDataToBodyData, "convertFormDataToBodyData");
var handleParsingAllValues = /* @__PURE__ */ __name((form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      ;
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
}, "handleParsingAllValues");
var handleParsingNestedValues = /* @__PURE__ */ __name((form, key, value) => {
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
}, "handleParsingNestedValues");

// node_modules/.pnpm/hono@4.9.4/node_modules/hono/dist/utils/url.js
var splitPath = /* @__PURE__ */ __name((path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
}, "splitPath");
var splitRoutingPath = /* @__PURE__ */ __name((routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
}, "splitRoutingPath");
var extractGroupsFromPath = /* @__PURE__ */ __name((path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match, index) => {
    const mark = `@${index}`;
    groups.push([mark, match]);
    return mark;
  });
  return { groups, path };
}, "extractGroupsFromPath");
var replaceGroupMarks = /* @__PURE__ */ __name((paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
}, "replaceGroupMarks");
var patternCache = {};
var getPattern = /* @__PURE__ */ __name((label, next) => {
  if (label === "*") {
    return "*";
  }
  const match = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match[1], new RegExp(`^${match[2]}(?=/${next})`)] : [label, match[1], new RegExp(`^${match[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
}, "getPattern");
var tryDecode = /* @__PURE__ */ __name((str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match) => {
      try {
        return decoder(match);
      } catch {
        return match;
      }
    });
  }
}, "tryDecode");
var tryDecodeURI = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURI), "tryDecodeURI");
var getPath = /* @__PURE__ */ __name((request) => {
  const url = request.url;
  const start = url.indexOf(
    "/",
    url.charCodeAt(9) === 58 ? 13 : 8
  );
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const path = url.slice(start, queryIndex === -1 ? void 0 : queryIndex);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63) {
      break;
    }
  }
  return url.slice(start, i);
}, "getPath");
var getPathNoStrict = /* @__PURE__ */ __name((request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
}, "getPathNoStrict");
var mergePath = /* @__PURE__ */ __name((base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
}, "mergePath");
var checkOptionalParameter = /* @__PURE__ */ __name((path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (/\?/.test(segment)) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.replace("?", "");
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
}, "checkOptionalParameter");
var _decodeURI = /* @__PURE__ */ __name((value) => {
  if (!/[%+]/.test(value)) {
    return value;
  }
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return value.indexOf("%") !== -1 ? tryDecode(value, decodeURIComponent_) : value;
}, "_decodeURI");
var _getQueryParam = /* @__PURE__ */ __name((url, key, multiple) => {
  let encoded;
  if (!multiple && key && !/[%+]/.test(key)) {
    let keyIndex2 = url.indexOf(`?${key}`, 8);
    if (keyIndex2 === -1) {
      keyIndex2 = url.indexOf(`&${key}`, 8);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = {};
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      ;
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
}, "_getQueryParam");
var getQueryParam = _getQueryParam;
var getQueryParams = /* @__PURE__ */ __name((url, key) => {
  return _getQueryParam(url, key, true);
}, "getQueryParams");
var decodeURIComponent_ = decodeURIComponent;

// node_modules/.pnpm/hono@4.9.4/node_modules/hono/dist/request.js
var tryDecodeURIComponent = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURIComponent_), "tryDecodeURIComponent");
var HonoRequest = class {
  static {
    __name(this, "HonoRequest");
  }
  raw;
  #validatedData;
  #matchResult;
  routeIndex = 0;
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
    this.#validatedData = {};
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param ? /\%/.test(param) ? tryDecodeURIComponent(param) : param : void 0;
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value && typeof value === "string") {
        decoded[key] = /\%/.test(value) ? tryDecodeURIComponent(value) : value;
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = {};
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return this.bodyCache.parsedBody ??= await parseBody(this, options);
  }
  #cachedBody = /* @__PURE__ */ __name((key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    const anyCachedKey = Object.keys(bodyCache)[0];
    if (anyCachedKey) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw2[key]();
  }, "#cachedBody");
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  text() {
    return this.#cachedBody("text");
  }
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  blob() {
    return this.#cachedBody("blob");
  }
  formData() {
    return this.#cachedBody("formData");
  }
  addValidatedData(target, data) {
    this.#validatedData[target] = data;
  }
  valid(target) {
    return this.#validatedData[target];
  }
  get url() {
    return this.raw.url;
  }
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};

// node_modules/.pnpm/hono@4.9.4/node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = /* @__PURE__ */ __name((value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
}, "raw");
var resolveCallback = /* @__PURE__ */ __name(async (str, phase, preserveCallbacks, context, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
}, "resolveCallback");

// node_modules/.pnpm/hono@4.9.4/node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = /* @__PURE__ */ __name((contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
}, "setDefaultContentType");
var Context = class {
  static {
    __name(this, "Context");
  }
  #rawRequest;
  #req;
  env = {};
  #var;
  finalized = false;
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  get res() {
    return this.#res ||= new Response(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  set res(_res) {
    if (this.#res && _res) {
      _res = new Response(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  render = /* @__PURE__ */ __name((...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  }, "render");
  setLayout = /* @__PURE__ */ __name((layout) => this.#layout = layout, "setLayout");
  getLayout = /* @__PURE__ */ __name(() => this.#layout, "getLayout");
  setRenderer = /* @__PURE__ */ __name((renderer) => {
    this.#renderer = renderer;
  }, "setRenderer");
  header = /* @__PURE__ */ __name((name, value, options) => {
    if (this.finalized) {
      this.#res = new Response(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  }, "header");
  status = /* @__PURE__ */ __name((status) => {
    this.#status = status;
  }, "status");
  set = /* @__PURE__ */ __name((key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  }, "set");
  get = /* @__PURE__ */ __name((key) => {
    return this.#var ? this.#var.get(key) : void 0;
  }, "get");
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    const responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders ?? new Headers();
    if (typeof arg === "object" && "headers" in arg) {
      const argHeaders = arg.headers instanceof Headers ? arg.headers : new Headers(arg.headers);
      for (const [key, value] of argHeaders) {
        if (key.toLowerCase() === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        if (typeof v === "string") {
          responseHeaders.set(k, v);
        } else {
          responseHeaders.delete(k);
          for (const v2 of v) {
            responseHeaders.append(k, v2);
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return new Response(data, { status, headers: responseHeaders });
  }
  newResponse = /* @__PURE__ */ __name((...args) => this.#newResponse(...args), "newResponse");
  body = /* @__PURE__ */ __name((data, arg, headers) => this.#newResponse(data, arg, headers), "body");
  text = /* @__PURE__ */ __name((text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(
      text,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  }, "text");
  json = /* @__PURE__ */ __name((object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  }, "json");
  html = /* @__PURE__ */ __name((html, arg, headers) => {
    const res = /* @__PURE__ */ __name((html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers)), "res");
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  }, "html");
  redirect = /* @__PURE__ */ __name((location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  }, "redirect");
  notFound = /* @__PURE__ */ __name(() => {
    this.#notFoundHandler ??= () => new Response();
    return this.#notFoundHandler(this);
  }, "notFound");
};

// node_modules/.pnpm/hono@4.9.4/node_modules/hono/dist/router.js
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
  static {
    __name(this, "UnsupportedPathError");
  }
};

// node_modules/.pnpm/hono@4.9.4/node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// node_modules/.pnpm/hono@4.9.4/node_modules/hono/dist/hono-base.js
var notFoundHandler = /* @__PURE__ */ __name((c) => {
  return c.text("404 Not Found", 404);
}, "notFoundHandler");
var errorHandler = /* @__PURE__ */ __name((err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
}, "errorHandler");
var Hono = class {
  static {
    __name(this, "Hono");
  }
  get;
  post;
  put;
  delete;
  options;
  patch;
  all;
  on;
  use;
  router;
  getPath;
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(method, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          handlers.map((handler) => {
            this.#addRoute(m.toUpperCase(), this.#path, handler);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  errorHandler = errorHandler;
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r) => {
      let handler;
      if (app2.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = /* @__PURE__ */ __name(async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res, "handler");
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler);
    });
    return this;
  }
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  onError = /* @__PURE__ */ __name((handler) => {
    this.errorHandler = handler;
    return this;
  }, "onError");
  notFound = /* @__PURE__ */ __name((handler) => {
    this.#notFoundHandler = handler;
    return this;
  }, "notFound");
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = /* @__PURE__ */ __name((request) => request, "replaceRequest");
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = url.pathname.slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = /* @__PURE__ */ __name(async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    }, "handler");
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = { basePath: this._basePath, path, method, handler };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))
      ).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  fetch = /* @__PURE__ */ __name((request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  }, "fetch");
  request = /* @__PURE__ */ __name((input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  }, "request");
  fire = /* @__PURE__ */ __name(() => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  }, "fire");
};

// node_modules/.pnpm/hono@4.9.4/node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
__name(compareKey, "compareKey");
var Node = class {
  static {
    __name(this, "Node");
  }
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index, paramMap, context, pathErrorCheckOnly) {
    if (tokens.length === 0) {
      if (this.#index !== void 0) {
        throw PATH_ERROR;
      }
      if (pathErrorCheckOnly) {
        return;
      }
      this.#index = index;
      return;
    }
    const [token, ...restTokens] = tokens;
    const pattern = token === "*" ? restTokens.length === 0 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let node;
    if (pattern) {
      const name = pattern[1];
      let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
      if (name && pattern[2]) {
        if (regexpStr === ".*") {
          throw PATH_ERROR;
        }
        regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
        if (/\((?!\?:)/.test(regexpStr)) {
          throw PATH_ERROR;
        }
      }
      node = this.#children[regexpStr];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[regexpStr] = new Node();
        if (name !== "") {
          node.#varIndex = context.varIndex++;
        }
      }
      if (!pathErrorCheckOnly && name !== "") {
        paramMap.push([name, node.#varIndex]);
      }
    } else {
      node = this.#children[token];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[token] = new Node();
      }
    }
    node.insert(restTokens, index, paramMap, context, pathErrorCheckOnly);
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      return (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + c.buildRegExpStr();
    });
    if (typeof this.#index === "number") {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
};

// node_modules/.pnpm/hono@4.9.4/node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
  static {
    __name(this, "Trie");
  }
  #context = { varIndex: 0 };
  #root = new Node();
  insert(path, index, pathErrorCheckOnly) {
    const paramAssoc = [];
    const groups = [];
    for (let i = 0; ; ) {
      let replaced = false;
      path = path.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = path.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, index, paramAssoc, this.#context, pathErrorCheckOnly);
    return paramAssoc;
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
};

// node_modules/.pnpm/hono@4.9.4/node_modules/hono/dist/router/reg-exp-router/router.js
var emptyParam = [];
var nullMatcher = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    path === "*" ? "" : `^${path.replace(
      /\/\*$|([.\\+*[^\]$()])/g,
      (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)"
    )}$`
  );
}
__name(buildWildcardRegExp, "buildWildcardRegExp");
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
__name(clearWildcardRegExpCache, "clearWildcardRegExpCache");
function buildMatcherFromPreprocessedRoutes(routes) {
  const trie = new Trie();
  const handlerData = [];
  if (routes.length === 0) {
    return nullMatcher;
  }
  const routesWithStaticPathFlag = routes.map(
    (route) => [!/\*|\/:/.test(route[0]), ...route]
  ).sort(
    ([isStaticA, pathA], [isStaticB, pathB]) => isStaticA ? 1 : isStaticB ? -1 : pathA.length - pathB.length
  );
  const staticMap = /* @__PURE__ */ Object.create(null);
  for (let i = 0, j = -1, len = routesWithStaticPathFlag.length; i < len; i++) {
    const [pathErrorCheckOnly, path, handlers] = routesWithStaticPathFlag[i];
    if (pathErrorCheckOnly) {
      staticMap[path] = [handlers.map(([h]) => [h, /* @__PURE__ */ Object.create(null)]), emptyParam];
    } else {
      j++;
    }
    let paramAssoc;
    try {
      paramAssoc = trie.insert(path, j, pathErrorCheckOnly);
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
    if (pathErrorCheckOnly) {
      continue;
    }
    handlerData[j] = handlers.map(([h, paramCount]) => {
      const paramIndexMap = /* @__PURE__ */ Object.create(null);
      paramCount -= 1;
      for (; paramCount >= 0; paramCount--) {
        const [key, value] = paramAssoc[paramCount];
        paramIndexMap[key] = value;
      }
      return [h, paramIndexMap];
    });
  }
  const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
  for (let i = 0, len = handlerData.length; i < len; i++) {
    for (let j = 0, len2 = handlerData[i].length; j < len2; j++) {
      const map = handlerData[i][j]?.[1];
      if (!map) {
        continue;
      }
      const keys = Object.keys(map);
      for (let k = 0, len3 = keys.length; k < len3; k++) {
        map[keys[k]] = paramReplacementMap[map[keys[k]]];
      }
    }
  }
  const handlerMap = [];
  for (const i in indexReplacementMap) {
    handlerMap[i] = handlerData[indexReplacementMap[i]];
  }
  return [regexp, handlerMap, staticMap];
}
__name(buildMatcherFromPreprocessedRoutes, "buildMatcherFromPreprocessedRoutes");
function findMiddleware(middleware, path) {
  if (!middleware) {
    return void 0;
  }
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
__name(findMiddleware, "findMiddleware");
var RegExpRouter = class {
  static {
    __name(this, "RegExpRouter");
  }
  name = "RegExpRouter";
  #middleware;
  #routes;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      ;
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p) => {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      if (method === METHOD_NAME_ALL) {
        Object.keys(middleware).forEach((m) => {
          middleware[m][path] ||= findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        });
      } else {
        middleware[method][path] ||= findMiddleware(middleware[method], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
      }
      Object.keys(middleware).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(middleware[m]).forEach((p) => {
            re.test(p) && middleware[m][p].push([handler, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(routes[m]).forEach(
            (p) => re.test(p) && routes[m][p].push([handler, paramCount])
          );
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i = 0, len = paths.length; i < len; i++) {
      const path2 = paths[i];
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          routes[m][path2] ||= [
            ...findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
          ];
          routes[m][path2].push([handler, paramCount - len + i + 1]);
        }
      });
    }
  }
  match(method, path) {
    clearWildcardRegExpCache();
    const matchers = this.#buildAllMatchers();
    this.match = (method2, path2) => {
      const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
      const staticMatch = matcher[2][path2];
      if (staticMatch) {
        return staticMatch;
      }
      const match = path2.match(matcher[0]);
      if (!match) {
        return [[], emptyParam];
      }
      const index = match.indexOf("", 1);
      return [matcher[1][index], match];
    };
    return this.match(method, path);
  }
  #buildAllMatchers() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = void 0;
    return matchers;
  }
  #buildMatcher(method) {
    const routes = [];
    let hasOwnRoute = method === METHOD_NAME_ALL;
    [this.#middleware, this.#routes].forEach((r) => {
      const ownRoute = r[method] ? Object.keys(r[method]).map((path) => [path, r[method][path]]) : [];
      if (ownRoute.length !== 0) {
        hasOwnRoute ||= true;
        routes.push(...ownRoute);
      } else if (method !== METHOD_NAME_ALL) {
        routes.push(
          ...Object.keys(r[METHOD_NAME_ALL]).map((path) => [path, r[METHOD_NAME_ALL][path]])
        );
      }
    });
    if (!hasOwnRoute) {
      return null;
    } else {
      return buildMatcherFromPreprocessedRoutes(routes);
    }
  }
};

// node_modules/.pnpm/hono@4.9.4/node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
  static {
    __name(this, "SmartRouter");
  }
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
};

// node_modules/.pnpm/hono@4.9.4/node_modules/hono/dist/router/trie-router/node.js
var emptyParams = /* @__PURE__ */ Object.create(null);
var Node2 = class {
  static {
    __name(this, "Node");
  }
  #methods;
  #children;
  #patterns;
  #order = 0;
  #params = emptyParams;
  constructor(method, handler, children) {
    this.#children = children || /* @__PURE__ */ Object.create(null);
    this.#methods = [];
    if (method && handler) {
      const m = /* @__PURE__ */ Object.create(null);
      m[method] = { handler, possibleKeys: [], score: 0 };
      this.#methods = [m];
    }
    this.#patterns = [];
  }
  insert(method, path, handler) {
    this.#order = ++this.#order;
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const p = parts[i];
      const nextP = parts[i + 1];
      const pattern = getPattern(p, nextP);
      const key = Array.isArray(pattern) ? pattern[0] : p;
      if (key in curNode.#children) {
        curNode = curNode.#children[key];
        if (pattern) {
          possibleKeys.push(pattern[1]);
        }
        continue;
      }
      curNode.#children[key] = new Node2();
      if (pattern) {
        curNode.#patterns.push(pattern);
        possibleKeys.push(pattern[1]);
      }
      curNode = curNode.#children[key];
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: possibleKeys.filter((v, i, a) => a.indexOf(v) === i),
        score: this.#order
      }
    });
    return curNode;
  }
  #getHandlerSets(node, method, nodeParams, params) {
    const handlerSets = [];
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      const processedSet = {};
      if (handlerSet !== void 0) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        if (nodeParams !== emptyParams || params && params !== emptyParams) {
          for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
            const key = handlerSet.possibleKeys[i2];
            const processed = processedSet[handlerSet.score];
            handlerSet.params[key] = params?.[key] && !processed ? params[key] : nodeParams[key] ?? params?.[key];
            processedSet[handlerSet.score] = true;
          }
        }
      }
    }
    return handlerSets;
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              handlerSets.push(
                ...this.#getHandlerSets(nextNode.#children["*"], method, node.#params)
              );
            }
            handlerSets.push(...this.#getHandlerSets(nextNode, method, node.#params));
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (let k = 0, len3 = node.#patterns.length; k < len3; k++) {
          const pattern = node.#patterns[k];
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (pattern === "*") {
            const astNode = node.#children["*"];
            if (astNode) {
              handlerSets.push(...this.#getHandlerSets(astNode, method, node.#params));
              astNode.#params = params;
              tempNodes.push(astNode);
            }
            continue;
          }
          const [key, name, matcher] = pattern;
          if (!part && !(matcher instanceof RegExp)) {
            continue;
          }
          const child = node.#children[key];
          const restPathString = parts.slice(i).join("/");
          if (matcher instanceof RegExp) {
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              handlerSets.push(...this.#getHandlerSets(child, method, node.#params, params));
              if (Object.keys(child.#children).length) {
                child.#params = params;
                const componentCount = m[0].match(/\//)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              handlerSets.push(...this.#getHandlerSets(child, method, params, node.#params));
              if (child.#children["*"]) {
                handlerSets.push(
                  ...this.#getHandlerSets(child.#children["*"], method, params, node.#params)
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      curNodes = tempNodes.concat(curNodesQueue.shift() ?? []);
    }
    if (handlerSets.length > 1) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};

// node_modules/.pnpm/hono@4.9.4/node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  static {
    __name(this, "TrieRouter");
  }
  name = "TrieRouter";
  #node;
  constructor() {
    this.#node = new Node2();
  }
  add(method, path, handler) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (let i = 0, len = results.length; i < len; i++) {
        this.#node.insert(method, results[i], handler);
      }
      return;
    }
    this.#node.insert(method, path, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};

// node_modules/.pnpm/hono@4.9.4/node_modules/hono/dist/hono.js
var Hono2 = class extends Hono {
  static {
    __name(this, "Hono");
  }
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
};

// src/lib/logger.ts
var currentLevel = 0 /* DEBUG */;
function shouldLog(level) {
  return level >= currentLevel;
}
__name(shouldLog, "shouldLog");
function formatLevel(level) {
  const levelNames = {
    [0 /* DEBUG */]: "DEBUG",
    [1 /* INFO */]: "INFO",
    [2 /* WARN */]: "WARN",
    [3 /* ERROR */]: "ERROR"
  };
  return levelNames[level] || "LOG";
}
__name(formatLevel, "formatLevel");
function log(level, ...args) {
  if (!shouldLog(level)) {
    return;
  }
  const prefix = `[${formatLevel(level)}]`;
  const consoleMethods = {
    [0 /* DEBUG */]: console.debug,
    [1 /* INFO */]: console.info,
    [2 /* WARN */]: console.warn,
    [3 /* ERROR */]: console.error
  };
  const logMethod = consoleMethods[level] || console.log;
  logMethod(prefix, ...args);
}
__name(log, "log");
var logger = {
  /**
   * Sets the minimum log level for messages to be displayed.
   * @param {LogLevel} level - The new minimum log level.
   */
  setLevel(level) {
    currentLevel = level;
  },
  /**
   * Logs a message at the DEBUG level.
   * @param {unknown[]} args - The content of the log message.
   */
  debug: /* @__PURE__ */ __name((...args) => log(0 /* DEBUG */, ...args), "debug"),
  /**
   * Logs a message at the INFO level.
   * @param {unknown[]} args - The content of the log message.
   */
  info: /* @__PURE__ */ __name((...args) => log(1 /* INFO */, ...args), "info"),
  /**
   * Logs a message at the WARN level.
   * @param {unknown[]} args - The content of the log message.
   */
  warn: /* @__PURE__ */ __name((...args) => log(2 /* WARN */, ...args), "warn"),
  /**
   * Logs a message at the ERROR level.
   * @param {unknown[]} args - The content of the log message.
   */
  error: /* @__PURE__ */ __name((...args) => log(3 /* ERROR */, ...args), "error")
};

// src/lib/brain.ts
async function brainSweep(db) {
  logger.info("\u{1F9E0} Brain sweep starting...");
  const unbrained = await selectUnbrainedEntities(db);
  logger.debug(`Found ${unbrained.length} unbrained entities`);
  let normalized = 0;
  let intentsCreated = 0;
  for (const entity of unbrained) {
    try {
      const normed = await upsertNormalization(db, entity);
      if (normed) normalized++;
      const added = await ensureIntents(db, entity);
      intentsCreated += added;
      logger.debug(`Processed ${entity.id}: normalized=${normed}, intents_added=${added}`);
    } catch (error) {
      logger.error(`Failed to process entity ${entity.id}:`, error);
    }
  }
  const result = {
    ran_at_utc: (/* @__PURE__ */ new Date()).toISOString(),
    scanned: unbrained.length,
    normalized,
    intentsCreated
  };
  try {
    await db.prepare(`
			INSERT INTO brain_runs (ran_at_utc, scanned, normalized, intents_created)
			VALUES (?, ?, ?, ?)
		`).bind(result.ran_at_utc, result.scanned, result.normalized, result.intentsCreated).run();
    logger.debug("Brain run recorded to database");
  } catch (error) {
    logger.error("Failed to record brain run:", error);
  }
  logger.info(`\u{1F9E0} Brain sweep complete:`, result);
  return result;
}
__name(brainSweep, "brainSweep");
async function selectUnbrainedEntities(db) {
  const sql = `
    SELECT e.id, e.domain, e.object_id, e.friendly_name
    FROM entities e
    LEFT JOIN entity_normalization n ON n.entity_id = e.id
    LEFT JOIN intent_candidates i ON i.entity_id = e.id AND i.enabled = 1
    GROUP BY e.id, e.domain, e.object_id, e.friendly_name
    HAVING n.entity_id IS NULL OR COUNT(i.id) < 5
  `;
  const res = await db.prepare(sql).all();
  return res.results ?? [];
}
__name(selectUnbrainedEntities, "selectUnbrainedEntities");
async function upsertNormalization(db, entity) {
  const name = (entity.friendly_name ?? entity.object_id).toLowerCase();
  const looksLikeLight = entity.domain === "switch" && /(light|lamp|bulb)/.test(name);
  const looksLikeFan = entity.domain === "switch" && /(fan|ventilation)/.test(name);
  let canonical_type = entity.domain;
  let confidence = 0.9;
  let reasoning = "Default canonicalization equals HA domain.";
  if (looksLikeLight) {
    canonical_type = "light";
    confidence = 0.95;
    reasoning = "Name heuristic indicates a light; HA domain must remain 'switch' for service calls.";
  } else if (looksLikeFan) {
    canonical_type = "fan";
    confidence = 0.9;
    reasoning = "Name heuristic indicates a fan; HA domain must remain 'switch' for service calls.";
  }
  const canonical_domain = entity.domain;
  const upsert = `
    INSERT INTO entity_normalization (entity_id, canonical_type, canonical_domain, confidence, reasoning)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(entity_id) DO UPDATE SET
      canonical_type=excluded.canonical_type,
      canonical_domain=excluded.canonical_domain,
      confidence=excluded.confidence,
      reasoning=excluded.reasoning,
      updated_at=CURRENT_TIMESTAMP
  `;
  try {
    const result = await db.prepare(upsert).bind(
      entity.id,
      canonical_type,
      canonical_domain,
      confidence,
      reasoning
    ).run();
    return result.success === true;
  } catch (error) {
    logger.error(`Failed to upsert normalization for ${entity.id}:`, error);
    return false;
  }
}
__name(upsertNormalization, "upsertNormalization");
async function ensureIntents(db, entity) {
  const countRes = await db.prepare(`SELECT COUNT(*) AS c FROM intent_candidates WHERE entity_id=? AND enabled=1`).bind(entity.id).first();
  if ((countRes?.c ?? 0) >= 5) {
    logger.debug(`Entity ${entity.id} already has ${countRes?.c} intents, skipping`);
    return 0;
  }
  const caps = await loadEntityCapabilities(db, entity.id);
  const intents = generateIntents(entity, caps);
  let created = 0;
  const insert = `
    INSERT INTO intent_candidates
      (entity_id, label, intent_kind, action_domain, action_service, action_data_json, requires_caps, confidence, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `;
  for (const intent of intents) {
    try {
      await db.prepare(insert).bind(
        entity.id,
        intent.label,
        intent.intent_kind,
        intent.action_domain,
        intent.action_service,
        JSON.stringify(intent.action_data),
        intent.requires_caps?.length ? JSON.stringify(intent.requires_caps) : null,
        intent.confidence ?? 0.75
      ).run();
      created++;
    } catch (error) {
      logger.error(`Failed to insert intent for ${entity.id}:`, error);
    }
  }
  return created;
}
__name(ensureIntents, "ensureIntents");
async function loadEntityCapabilities(db, entityId) {
  try {
    const rows = await db.prepare(`SELECT name, COALESCE(value_text, CAST(value_num AS TEXT)) AS v FROM entity_capabilities WHERE entity_id=?`).bind(entityId).all();
    const caps = {};
    for (const row of rows.results ?? []) {
      if (row.v === "true" || row.v === "false") {
        caps[row.name] = row.v === "true";
      } else if (!Number.isNaN(Number(row.v))) {
        caps[row.name] = Number(row.v);
      } else {
        caps[row.name] = row.v;
      }
    }
    return caps;
  } catch (error) {
    logger.error(`Failed to load capabilities for ${entityId}:`, error);
    return {};
  }
}
__name(loadEntityCapabilities, "loadEntityCapabilities");
function generateIntents(entity, caps) {
  const labelName = entity.friendly_name ?? entity.object_id.replace(/_/g, " ");
  const entityId = entity.id;
  const intents = [];
  const add = /* @__PURE__ */ __name((label, kind, service, data, requires_caps, confidence = 0.8) => {
    intents.push({
      label,
      intent_kind: kind,
      action_domain: entity.domain,
      // always keep actual HA domain
      action_service: service,
      action_data: { entity_id: entityId, ...data },
      requires_caps,
      confidence
    });
  }, "add");
  switch (entity.domain) {
    case "switch":
      add(`turn on ${labelName}`, "control", "turn_on", {});
      add(`turn off ${labelName}`, "control", "turn_off", {});
      add(`toggle ${labelName}`, "control", "toggle", {});
      add(`turn off ${labelName} in 15 minutes`, "schedule", "turn_off", { delay: "PT15M" }, void 0, 0.75);
      add(`turn on ${labelName} at dusk daily`, "schedule", "turn_on", { schedule: "sunset_daily" }, void 0, 0.72);
      add(`check ${labelName} status`, "query", "get_state", {}, void 0, 0.7);
      break;
    case "light":
      add(`turn on ${labelName}`, "control", "turn_on", {});
      add(`turn off ${labelName}`, "control", "turn_off", {});
      add(`toggle ${labelName}`, "control", "toggle", {});
      if (caps.supports_brightness) {
        add(`dim ${labelName} to 30%`, "control", "turn_on", { brightness_pct: 30 }, ["supports_brightness"]);
        add(`set ${labelName} to 75%`, "control", "turn_on", { brightness_pct: 75 }, ["supports_brightness"]);
        add(`brighten ${labelName}`, "control", "turn_on", { brightness_pct: 100 }, ["supports_brightness"]);
      }
      if (caps.supports_color) {
        add(`set ${labelName} to red`, "control", "turn_on", { color_name: "red" }, ["supports_color"]);
        add(`set ${labelName} to blue`, "control", "turn_on", { color_name: "blue" }, ["supports_color"]);
      }
      add(`turn off ${labelName} in 15 minutes`, "schedule", "turn_off", { delay: "PT15M" }, void 0, 0.75);
      add(`turn on ${labelName} at dusk daily`, "schedule", "turn_on", { schedule: "sunset_daily" }, void 0, 0.72);
      break;
    case "lock":
      add(`lock ${labelName}`, "control", "lock", {});
      add(`unlock ${labelName}`, "control", "unlock", {});
      add(`auto-lock ${labelName} after 5 minutes`, "schedule", "lock", { delay: "PT5M" }, void 0, 0.7);
      add(`check ${labelName} lock status`, "query", "get_state", {}, void 0, 0.8);
      break;
    case "camera":
      add(`show live stream for ${labelName}`, "query", "play_stream", { format: "hls" });
      add(`snapshot ${labelName} now`, "control", "snapshot", { filename: `/tmp/${entity.object_id}_${Date.now()}.jpg` });
      add(`notify me on motion for ${labelName}`, "schedule", "automation_stub", { template: "camera_motion_notify" }, void 0, 0.7);
      add(`record ${labelName} for 30 seconds`, "control", "record", { duration: 30 }, void 0, 0.75);
      add(`check ${labelName} status`, "diagnostic", "get_state", {}, void 0, 0.8);
      break;
    case "sensor":
      add(`check ${labelName} reading`, "query", "get_state", {}, void 0, 0.9);
      add(`show ${labelName} history`, "query", "get_history", { hours: 24 }, void 0, 0.8);
      add(`alert me if ${labelName} exceeds threshold`, "schedule", "automation_stub", { template: "sensor_threshold_alert" }, void 0, 0.7);
      break;
    case "climate":
      add(`set ${labelName} to 72\xB0F`, "control", "set_temperature", { temperature: 72 });
      add(`turn on ${labelName}`, "control", "turn_on", {});
      add(`turn off ${labelName}`, "control", "turn_off", {});
      add(`set ${labelName} to heat mode`, "control", "set_hvac_mode", { hvac_mode: "heat" });
      add(`set ${labelName} to cool mode`, "control", "set_hvac_mode", { hvac_mode: "cool" });
      add(`check ${labelName} temperature`, "query", "get_state", {}, void 0, 0.8);
      break;
    case "fan":
      add(`turn on ${labelName}`, "control", "turn_on", {});
      add(`turn off ${labelName}`, "control", "turn_off", {});
      add(`set ${labelName} speed to low`, "control", "set_percentage", { percentage: 33 });
      add(`set ${labelName} speed to high`, "control", "set_percentage", { percentage: 100 });
      add(`oscillate ${labelName}`, "control", "oscillate", { oscillating: true });
      break;
    case "cover":
      add(`open ${labelName}`, "control", "open_cover", {});
      add(`close ${labelName}`, "control", "close_cover", {});
      add(`stop ${labelName}`, "control", "stop_cover", {});
      add(`set ${labelName} to 50%`, "control", "set_cover_position", { position: 50 });
      add(`check ${labelName} position`, "query", "get_state", {}, void 0, 0.8);
      break;
    default:
      add(`turn on ${labelName}`, "control", "turn_on", {}, void 0, 0.6);
      add(`turn off ${labelName}`, "control", "turn_off", {}, void 0, 0.6);
      add(`check ${labelName} status`, "query", "get_state", {}, void 0, 0.7);
      add(`toggle ${labelName}`, "control", "toggle", {}, void 0, 0.5);
      add(`restart ${labelName}`, "diagnostic", "reload", {}, void 0, 0.4);
      break;
  }
  const minIntents = 5;
  const maxIntents = 15;
  while (intents.length < minIntents) {
    const remaining = minIntents - intents.length;
    if (remaining >= 1) add(`activate ${labelName}`, "control", "turn_on", {}, void 0, 0.5);
    if (remaining >= 2) add(`deactivate ${labelName}`, "control", "turn_off", {}, void 0, 0.5);
    if (remaining >= 3) add(`get ${labelName} info`, "diagnostic", "get_state", {}, void 0, 0.6);
    if (remaining >= 4) add(`reset ${labelName}`, "diagnostic", "reload", {}, void 0, 0.4);
    if (remaining >= 5) add(`monitor ${labelName}`, "schedule", "automation_stub", { template: "entity_monitor" }, void 0, 0.5);
    break;
  }
  return intents.slice(0, maxIntents);
}
__name(generateIntents, "generateIntents");

// src/lib/homeAssistantWs.ts
var HaWebSocketClient = class {
  constructor(url, token) {
    this.url = url;
    this.token = token;
  }
  static {
    __name(this, "HaWebSocketClient");
  }
  socket;
  nextId = 1;
  pending = /* @__PURE__ */ new Map();
  authPromise;
  /**
   * Connects to the Home Assistant WebSocket API if not already connected.
   * The returned promise resolves once authentication succeeds.
   */
  async connect() {
    if (this.socket && this.socket.readyState <= 1) {
      return this.authPromise;
    }
    const wsUrl = `${this.url.replace(/^http/, "ws")}/api/websocket`;
    this.socket = new WebSocket(wsUrl);
    logger.debug("Connecting to HA WebSocket", wsUrl);
    this.authPromise = new Promise((resolve, reject) => {
      const sock = this.socket;
      if (!sock) {
        reject(new Error("WebSocket not initialized"));
        return;
      }
      sock.addEventListener("open", () => {
        logger.debug("HA WebSocket open, sending auth");
        sock.send(JSON.stringify({ type: "auth", access_token: this.token }));
      });
      sock.addEventListener("message", (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "auth_ok") {
            logger.debug("HA WebSocket authenticated");
            resolve();
            return;
          }
          if (typeof msg.id === "number" && this.pending.has(msg.id)) {
            logger.debug("HA WebSocket response", msg.id);
            const pendingRequest = this.pending.get(msg.id);
            if (pendingRequest) {
              pendingRequest.resolve(msg);
              this.pending.delete(msg.id);
            }
          }
        } catch {
        }
      });
      const fail = /* @__PURE__ */ __name((err) => {
        reject(err);
        this.socket = void 0;
        this.authPromise = void 0;
        for (const p of this.pending.values()) {
          p.reject(err);
        }
        this.pending.clear();
        logger.error("HA WebSocket failure", err);
      }, "fail");
      sock.addEventListener("close", () => fail(new Error("socket closed")));
      sock.addEventListener("error", (ev) => fail(ev));
    });
    return this.authPromise;
  }
  /**
   * Sends an arbitrary command over the WebSocket connection.
   *
   * @param command Partial Home Assistant command object. The `id` field will
   *   be added automatically.
   * @returns The parsed response message from Home Assistant.
   */
  async send(command) {
    await this.connect();
    const id = this.nextId++;
    const payload = { ...command, id };
    logger.debug("HA WebSocket send", payload);
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error("socket not connected"));
        return;
      }
      this.pending.set(id, {
        resolve,
        reject
      });
      try {
        this.socket.send(JSON.stringify(payload));
      } catch (err) {
        this.pending.delete(id);
        reject(err);
        logger.error("HA WebSocket send error", err);
      }
    });
  }
  /** Convenience wrapper for `call_service` commands. */
  callService(domain, service, serviceData) {
    return this.send({
      type: "call_service",
      domain,
      service,
      service_data: serviceData
    });
  }
  /** Convenience wrapper for `get_states` command. */
  getStates() {
    return this.send({ type: "get_states" });
  }
  /** Convenience wrapper for `get_services` command. */
  getServices() {
    return this.send({ type: "get_services" });
  }
  /** Convenience wrapper for `get_config` command. */
  getConfig() {
    return this.send({ type: "get_config" });
  }
  /** Subscribe to Home Assistant events */
  subscribeEvents(eventType) {
    const command = { type: "subscribe_events" };
    if (eventType) {
      command.event_type = eventType;
    }
    return this.send(command);
  }
  /** Get Home Assistant logs */
  async getLogs() {
    return this.send({ type: "get_logs" });
  }
  /** Get error logs specifically */
  async getErrorLogs() {
    return this.send({
      type: "get_logs",
      level: "ERROR"
    });
  }
};
var client;
function getHaClient(env) {
  if (!client) {
    client = new HaWebSocketClient(env.HASSIO_ENDPOINT_URI, env.HASSIO_TOKEN);
  }
  return client;
}
__name(getHaClient, "getHaClient");

// src/lib/homeAssistant.ts
async function getInstanceConfig(env, instanceId) {
  const raw2 = await env.CONFIG_KV.get(`instance:${instanceId}`);
  if (raw2) {
    logger.debug("Instance config loaded", instanceId);
  } else {
    logger.warn("Instance config missing", instanceId);
  }
  return raw2 ? JSON.parse(raw2) : null;
}
__name(getInstanceConfig, "getInstanceConfig");
async function haFetch(env, instanceId, path, init = {}) {
  const config = await getInstanceConfig(env, instanceId);
  if (!config) {
    logger.error("Instance not configured", instanceId);
    return new Response("instance not configured", { status: 404 });
  }
  const url = `${config.baseUrl}${path}`;
  const headers = {
    ...init.headers || {},
    Authorization: `Bearer ${config.token}`
  };
  logger.debug("haFetch", url, init.method || "GET");
  return fetch(url, { ...init, headers });
}
__name(haFetch, "haFetch");

// src/lib/logProcessor.ts
function processHomeLogs(logs) {
  if (!Array.isArray(logs) || logs.length === 0) {
    return {
      errorCount: 0,
      warningCount: 0,
      uniqueErrors: [],
      recentErrors: [],
      summary: "No logs available for processing",
      timeRange: {}
    };
  }
  const errorLogs = logs.filter((log2) => log2.level?.toUpperCase() === "ERROR");
  const warningLogs = logs.filter(
    (log2) => log2.level?.toUpperCase() === "WARNING"
  );
  const uniqueErrorsMap = /* @__PURE__ */ new Map();
  const recentErrors = [];
  const sortedLogs = [...logs].sort((a, b) => {
    if (!a.timestamp || !b.timestamp) return 0;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
  for (const log2 of sortedLogs) {
    if (log2.level?.toUpperCase() === "ERROR" && log2.message) {
      const messageKey = simplifyErrorMessage(log2.message);
      if (!uniqueErrorsMap.has(messageKey)) {
        uniqueErrorsMap.set(messageKey, log2);
      }
      if (recentErrors.length < 10) {
        recentErrors.push(log2);
      }
    }
  }
  const uniqueErrors = Array.from(uniqueErrorsMap.values());
  const timestamps = logs.map((log2) => log2.timestamp).filter(Boolean).sort();
  const timeRange = {
    start: timestamps[0],
    end: timestamps[timestamps.length - 1]
  };
  const summary = createLogSummary(
    logs.length,
    errorLogs.length,
    warningLogs.length,
    uniqueErrors.length
  );
  return {
    errorCount: errorLogs.length,
    warningCount: warningLogs.length,
    uniqueErrors,
    recentErrors,
    summary,
    timeRange
  };
}
__name(processHomeLogs, "processHomeLogs");
function simplifyErrorMessage(message) {
  return message.replace(
    /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.\d]*[Z]?/g,
    "[TIMESTAMP]"
  ).replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[IP]").replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    "[UUID]"
  ).replace(/\/[a-zA-Z0-9_\-./]+/g, "[PATH]").replace(/https?:\/\/[^\s]+/g, "[URL]").replace(/\s+/g, " ").trim().toLowerCase();
}
__name(simplifyErrorMessage, "simplifyErrorMessage");
function createLogSummary(totalLogs, errors, warnings, uniqueErrors) {
  const parts = [`Processed ${totalLogs} log entries`];
  if (errors > 0) {
    parts.push(`${errors} errors (${uniqueErrors} unique)`);
  }
  if (warnings > 0) {
    parts.push(`${warnings} warnings`);
  }
  if (errors === 0 && warnings === 0) {
    parts.push("no errors or warnings found");
  }
  return parts.join(", ");
}
__name(createLogSummary, "createLogSummary");
function formatLogsForAI(processedLogs) {
  const sections = [];
  sections.push(`## Home Assistant Log Analysis Summary`);
  sections.push(`${processedLogs.summary}`);
  if (processedLogs.timeRange.start && processedLogs.timeRange.end) {
    sections.push(
      `Time range: ${processedLogs.timeRange.start} to ${processedLogs.timeRange.end}`
    );
  }
  if (processedLogs.uniqueErrors.length > 0) {
    sections.push(
      `
## Unique Error Types (${processedLogs.uniqueErrors.length}):`
    );
    processedLogs.uniqueErrors.slice(0, 5).forEach((error, index) => {
      sections.push(
        `${index + 1}. ${error.logger || "Unknown"}: ${error.message || "No message"}`
      );
      if (error.exception) {
        sections.push(`   Exception: ${error.exception}`);
      }
    });
  }
  if (processedLogs.recentErrors.length > 0) {
    sections.push(
      `
## Recent Errors (${Math.min(3, processedLogs.recentErrors.length)}):`
    );
    processedLogs.recentErrors.slice(0, 3).forEach((error, index) => {
      sections.push(
        `${index + 1}. [${error.timestamp || "Unknown time"}] ${error.message || "No message"}`
      );
    });
  }
  return sections.join("\n");
}
__name(formatLogsForAI, "formatLogsForAI");

// src/lib/response.ts
var ok = /* @__PURE__ */ __name((speech, data, card) => ({
  ok: true,
  speech,
  card,
  data
}), "ok");

// src/routes/v1.ts
var v1 = new Hono2();
v1.use("*", async (c, next) => {
  logger.debug("[v1]", c.req.method, c.req.path);
  await next();
});
v1.get("/brain/run", async (c) => {
  logger.debug("Manual brain sweep requested");
  try {
    let syncResult = { synced: 0, errors: 0 };
    if (c.env.HASSIO_ENDPOINT_URI && c.env.HASSIO_TOKEN) {
      const entityCount = await c.env.D1_DB.prepare(
        "SELECT COUNT(*) as count FROM entities"
      ).first();
      if (!entityCount || entityCount.count < 10) {
        logger.debug("Syncing entities before brain sweep");
        syncResult = await syncEntitiesFromHA(
          c.env.D1_DB,
          c.env.HASSIO_ENDPOINT_URI,
          c.env.HASSIO_TOKEN
        );
      }
    }
    const result = await brainSweep(c.env.D1_DB);
    return c.json(ok("brain sweep completed", {
      ...result,
      entitiesSynced: syncResult.synced,
      syncErrors: syncResult.errors
    }));
  } catch (error) {
    logger.error("Brain sweep failed:", error);
    return c.json(
      {
        ok: false,
        error: `Brain sweep failed: ${error instanceof Error ? error.message : "Unknown error"}`
      },
      500
    );
  }
});
v1.get("/brain/status", async (c) => {
  logger.debug("Brain status requested");
  try {
    const normalizedCount = await c.env.D1_DB.prepare(
      "SELECT COUNT(*) as count FROM entity_normalization"
    ).first();
    const intentCount = await c.env.D1_DB.prepare(
      "SELECT COUNT(*) as count FROM intent_candidates WHERE enabled = 1"
    ).first();
    const entityCount = await c.env.D1_DB.prepare(
      "SELECT COUNT(*) as count FROM entities"
    ).first();
    const unbrainedCount = await c.env.D1_DB.prepare(`
				SELECT COUNT(DISTINCT e.id) as count
				FROM entities e
				LEFT JOIN entity_normalization n ON n.entity_id = e.id
				LEFT JOIN intent_candidates i ON i.entity_id = e.id AND i.enabled = 1
				GROUP BY e.id
				HAVING n.entity_id IS NULL OR COUNT(i.id) < 5
			`).first();
    const lastRun = await c.env.D1_DB.prepare(`
			SELECT ran_at_utc, scanned, normalized, intents_created
			FROM brain_runs
			ORDER BY ran_at_utc DESC
			LIMIT 1
		`).first();
    return c.json(
      ok("brain status", {
        entities: {
          total: entityCount?.count || 0,
          normalized: normalizedCount?.count || 0,
          unbrained: unbrainedCount?.count || 0
        },
        intents: {
          total: intentCount?.count || 0,
          averagePerEntity: entityCount?.count ? Math.round(
            (intentCount?.count || 0) / entityCount.count * 100
          ) / 100 : 0
        },
        lastRun: lastRun ? {
          ranAt: lastRun.ran_at_utc,
          scanned: lastRun.scanned,
          normalized: lastRun.normalized,
          intentsCreated: lastRun.intents_created
        } : null
      })
    );
  } catch (error) {
    logger.error("Brain status failed:", error);
    return c.json(
      {
        ok: false,
        error: `Brain status failed: ${error instanceof Error ? error.message : "Unknown error"}`
      },
      500
    );
  }
});
v1.post("/devices/scan", async (c) => {
  logger.debug("devices/scan invoked");
  if (!c.env.HASSIO_ENDPOINT_URI || !c.env.HASSIO_TOKEN) {
    return c.json(
      {
        ok: false,
        error: "Home Assistant not configured. Please set HASSIO_ENDPOINT_URI and HASSIO_TOKEN."
      },
      400
    );
  }
  try {
    const syncResult = await syncEntitiesFromHA(
      c.env.D1_DB,
      c.env.HASSIO_ENDPOINT_URI,
      c.env.HASSIO_TOKEN
    );
    const statesRes = await fetch(`${c.env.HASSIO_ENDPOINT_URI}/api/states`, {
      headers: {
        Authorization: `Bearer ${c.env.HASSIO_TOKEN}`,
        "Content-Type": "application/json"
      }
    });
    if (!statesRes.ok) {
      throw new Error(`States fetch failed: ${statesRes.status}`);
    }
    const states = await statesRes.json();
    const entityCount = Array.isArray(states) ? states.length : 0;
    const entityByDomain = {};
    const devices = [];
    if (Array.isArray(states)) {
      for (const entity of states) {
        if (entity.entity_id) {
          const domain = entity.entity_id.split(".")[0];
          entityByDomain[domain] = (entityByDomain[domain] || 0) + 1;
          if (entity.attributes?.device_id || entity.attributes?.unique_id) {
            const deviceId = entity.attributes.device_id || entity.attributes.unique_id;
            if (deviceId && !devices.includes(deviceId)) {
              devices.push(deviceId);
            }
          }
        }
      }
    }
    const deviceCount = devices.length;
    logger.debug("device scan complete", {
      entityCount,
      deviceCount,
      domains: Object.keys(entityByDomain).length,
      syncedEntities: syncResult.synced,
      syncErrors: syncResult.errors,
      topDomains: Object.entries(entityByDomain).sort(([, a], [, b]) => b - a).slice(0, 5)
    });
    return c.json(
      ok("device scan completed", {
        added: syncResult.synced,
        // Entities synced to database
        updated: deviceCount,
        total: deviceCount,
        entities: entityCount,
        entitiesSynced: syncResult.synced,
        syncErrors: syncResult.errors,
        domains: entityByDomain,
        summary: `Found ${entityCount} entities across ${Object.keys(entityByDomain).length} domains, synced ${syncResult.synced} to database`,
        reportUrl: null
      })
    );
  } catch (error) {
    logger.error("Device scan failed:", error);
    return c.json(
      {
        ok: false,
        error: `Device scan failed: ${error instanceof Error ? error.message : "Unknown error"}`
      },
      500
    );
  }
});
v1.get("/devices", async (c) => {
  logger.debug("devices list requested");
  return c.json(ok("stub: list devices", { items: [], total: 0 }));
});
v1.get("/devices/:id", async (c) => {
  const { id } = c.req.param();
  logger.debug("device detail requested", id);
  return c.json(
    ok(`stub: device detail for ${id}`, {
      id,
      mac: null,
      ip: null,
      lastSeenTs: null
    })
  );
});
v1.get("/cameras", async (c) => {
  logger.debug("cameras list requested");
  if (!c.env.HASSIO_ENDPOINT_URI || !c.env.HASSIO_TOKEN) {
    return c.json(
      {
        ok: false,
        error: "Home Assistant not configured. Please set HASSIO_ENDPOINT_URI and HASSIO_TOKEN."
      },
      400
    );
  }
  try {
    const statesRes = await fetch(`${c.env.HASSIO_ENDPOINT_URI}/api/states`, {
      headers: {
        Authorization: `Bearer ${c.env.HASSIO_TOKEN}`,
        "Content-Type": "application/json"
      }
    });
    if (!statesRes.ok) {
      throw new Error(`States fetch failed: ${statesRes.status}`);
    }
    const entities = await statesRes.json();
    const cameras = entities.filter(
      (entity) => entity.entity_id.startsWith("camera.")
    ).map((camera) => ({
      entity_id: camera.entity_id,
      friendly_name: camera.attributes?.friendly_name || camera.entity_id,
      state: camera.state,
      brand: camera.attributes?.brand || "Unknown",
      device_class: camera.attributes?.device_class || "camera",
      entity_picture: camera.attributes?.entity_picture,
      access_token: camera.attributes?.access_token,
      // Use our local proxy for camera images to avoid CORS issues
      stream_url: `/api/camera_proxy/${camera.entity_id}`,
      // Add live stream capability check and endpoint
      has_live_stream: !!(camera.attributes?.access_token || camera.attributes?.entity_picture),
      live_stream_endpoint: camera.attributes?.entity_picture && camera.attributes?.access_token ? `${c.env.HASSIO_ENDPOINT_URI}${camera.attributes.entity_picture}?token=${camera.attributes.access_token}` : `/v1/cameras/${camera.entity_id}/stream`
    }));
    const onlineCameras = cameras.filter(
      (camera) => camera.state !== "unavailable" && camera.state !== "unknown" && camera.state !== "error"
    );
    const offlineCameras = cameras.filter(
      (camera) => camera.state === "unavailable" || camera.state === "unknown" || camera.state === "error"
    );
    const cameraStates = cameras.reduce((acc, camera) => {
      acc[camera.state] = (acc[camera.state] || 0) + 1;
      return acc;
    }, {});
    logger.debug("cameras found", {
      total: cameras.length,
      online: onlineCameras.length,
      offline: offlineCameras.length,
      states: cameraStates
    });
    return c.json(
      ok("cameras retrieved", {
        cameras,
        summary: {
          total: cameras.length,
          online: onlineCameras.length,
          offline: offlineCameras.length
        }
      })
    );
  } catch (error) {
    logger.error("Camera fetch failed:", error);
    return c.json(
      {
        ok: false,
        error: `Camera fetch failed: ${error instanceof Error ? error.message : "Unknown error"}`
      },
      500
    );
  }
});
v1.get("/cameras/:entity_id/stream", async (c) => {
  const { entity_id } = c.req.param();
  logger.debug("Live stream URL requested for", entity_id);
  if (!c.env.HASSIO_ENDPOINT_URI || !c.env.HASSIO_TOKEN) {
    return c.json(
      {
        ok: false,
        error: "Home Assistant not configured"
      },
      400
    );
  }
  try {
    const streamRes = await fetch(
      `${c.env.HASSIO_ENDPOINT_URI}/api/camera_proxy_stream/${entity_id}`,
      {
        headers: {
          Authorization: `Bearer ${c.env.HASSIO_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );
    if (!streamRes.ok) {
      const entityRes = await fetch(
        `${c.env.HASSIO_ENDPOINT_URI}/api/states/${entity_id}`,
        {
          headers: {
            Authorization: `Bearer ${c.env.HASSIO_TOKEN}`,
            "Content-Type": "application/json"
          }
        }
      );
      if (entityRes.ok) {
        const entity = await entityRes.json();
        const accessToken = entity.attributes?.access_token;
        const entityPicture = entity.attributes?.entity_picture;
        if (entityPicture && accessToken) {
          const streamUrl2 = `${c.env.HASSIO_ENDPOINT_URI}${entityPicture}?token=${accessToken}`;
          return c.json(
            ok("camera stream URL", {
              entity_id,
              stream_url: streamUrl2,
              stream_type: "mjpeg",
              fallback_url: `/api/camera_proxy/${entity_id}`
            })
          );
        }
      }
      throw new Error(`Stream not available for ${entity_id}`);
    }
    const streamUrl = `${c.env.HASSIO_ENDPOINT_URI}/api/camera_proxy_stream/${entity_id}`;
    return c.json(
      ok("camera stream URL", {
        entity_id,
        stream_url: streamUrl,
        stream_type: "stream",
        fallback_url: `/api/camera_proxy/${entity_id}`
      })
    );
  } catch (error) {
    logger.error("Camera stream URL fetch failed:", error);
    return c.json(
      {
        ok: false,
        error: `Camera stream failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        fallback_url: `/api/camera_proxy/${entity_id}`
      },
      500
    );
  }
});
v1.post("/cameras/:entity_id/refresh", async (c) => {
  const { entity_id } = c.req.param();
  logger.debug("Camera refresh requested for", entity_id);
  if (!c.env.HASSIO_ENDPOINT_URI || !c.env.HASSIO_TOKEN) {
    return c.json(
      {
        ok: false,
        error: "Home Assistant not configured"
      },
      400
    );
  }
  try {
    const entityRes = await fetch(
      `${c.env.HASSIO_ENDPOINT_URI}/api/states/${entity_id}`,
      {
        headers: {
          Authorization: `Bearer ${c.env.HASSIO_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );
    if (!entityRes.ok) {
      throw new Error(`Entity fetch failed: ${entityRes.status}`);
    }
    const entity = await entityRes.json();
    let refreshResult = null;
    let refreshMethod = "";
    if (entity.attributes?.device_id) {
      try {
        const deviceRes = await fetch(
          `${c.env.HASSIO_ENDPOINT_URI}/api/config/device_registry`,
          {
            headers: {
              Authorization: `Bearer ${c.env.HASSIO_TOKEN}`,
              "Content-Type": "application/json"
            }
          }
        );
        if (deviceRes.ok) {
          const devices = await deviceRes.json();
          const device = devices.find((d) => d.id === entity.attributes?.device_id);
          if (device && device.config_entries.length > 0) {
            const reloadRes = await fetch(
              `${c.env.HASSIO_ENDPOINT_URI}/api/services/homeassistant/reload_config_entry`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${c.env.HASSIO_TOKEN}`,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  entry_id: device.config_entries[0]
                })
              }
            );
            if (reloadRes.ok) {
              refreshResult = await reloadRes.json();
              refreshMethod = "config_entry_reload";
            }
          }
        }
      } catch (configError) {
        logger.debug("Config entry reload failed, trying alternative methods", configError);
      }
    }
    if (!refreshResult) {
      try {
        const updateRes = await fetch(
          `${c.env.HASSIO_ENDPOINT_URI}/api/services/homeassistant/update_entity`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${c.env.HASSIO_TOKEN}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              entity_id
            })
          }
        );
        if (updateRes.ok) {
          refreshResult = await updateRes.json();
          refreshMethod = "update_entity";
        }
      } catch (updateError) {
        logger.debug("Update entity failed, trying final method", updateError);
      }
    }
    if (!refreshResult) {
      try {
        const snapshotRes = await fetch(
          `${c.env.HASSIO_ENDPOINT_URI}/api/services/camera/snapshot`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${c.env.HASSIO_TOKEN}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              entity_id,
              filename: `/tmp/camera_refresh_${entity_id.replace(".", "_")}.jpg`
            })
          }
        );
        if (snapshotRes.ok) {
          refreshResult = await snapshotRes.json();
          refreshMethod = "snapshot_trigger";
        }
      } catch (snapshotError) {
        logger.debug("Snapshot trigger failed", snapshotError);
      }
    }
    if (refreshResult) {
      return c.json(
        ok("camera refreshed", {
          entity_id,
          method: refreshMethod,
          friendly_name: entity.attributes?.friendly_name || entity_id,
          result: refreshResult
        })
      );
    } else {
      return c.json(
        ok("camera refresh attempted", {
          entity_id,
          method: "attempted_multiple",
          friendly_name: entity.attributes?.friendly_name || entity_id,
          note: "Refresh was attempted but specific result unavailable"
        })
      );
    }
  } catch (error) {
    logger.error("Camera refresh failed:", error);
    return c.json(
      {
        ok: false,
        error: `Camera refresh failed: ${error instanceof Error ? error.message : "Unknown error"}`
      },
      500
    );
  }
});
v1.post("/protect/sync", async (c) => {
  logger.debug("protect sync invoked");
  try {
    const entitiesRes = await fetch(`${c.env.HASSIO_ENDPOINT_URI}/api/states`, {
      headers: {
        Authorization: `Bearer ${c.env.HASSIO_TOKEN}`,
        "Content-Type": "application/json"
      }
    });
    if (!entitiesRes.ok) {
      throw new Error(`States fetch failed: ${entitiesRes.status}`);
    }
    const entities = await entitiesRes.json();
    const protectCameras = entities.filter(
      (entity) => entity.entity_id.startsWith("camera.") && (entity.attributes?.brand === "Ubiquiti Inc." || entity.entity_id.includes("unifi") || entity.attributes?.device_class === "camera")
    );
    const onlineCameras = protectCameras.filter(
      (camera) => camera.state === "idle" || camera.state === "streaming"
    );
    const offlineCameras = protectCameras.filter(
      (camera) => camera.state === "unavailable" || camera.state === "unknown"
    );
    let snapshotCount = 0;
    try {
      const snapshotRes = await fetch(
        `${c.env.HASSIO_ENDPOINT_URI}/api/services/unifiprotect/get_snapshot_url`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${c.env.HASSIO_TOKEN}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            entity_id: protectCameras.map((c2) => c2.entity_id)
          })
        }
      );
      if (snapshotRes.ok) {
        const snapshots = await snapshotRes.json();
        snapshotCount = Array.isArray(snapshots) ? snapshots.length : protectCameras.length;
      }
    } catch (snapshotError) {
      logger.debug("Snapshot count failed, using camera count", snapshotError);
      snapshotCount = protectCameras.length;
    }
    logger.debug("protect sync complete", {
      total: protectCameras.length,
      online: onlineCameras.length,
      offline: offlineCameras.length,
      snapshotCount
    });
    return c.json(
      ok("protect sync completed", {
        total: protectCameras.length,
        online: onlineCameras.length,
        updated: onlineCameras.length,
        // Cameras that were successfully synced
        snapshotCount,
        offline: offlineCameras.map((c2) => c2.entity_id)
      })
    );
  } catch (error) {
    logger.error("Protect sync failed:", error);
    return c.json(
      {
        ok: false,
        error: `Protect sync failed: ${error instanceof Error ? error.message : "Unknown error"}`
      },
      500
    );
  }
});
v1.get("/protect/cameras", async (c) => {
  logger.debug("protect cameras list requested");
  return c.json(
    ok("stub: list cameras", { total: 0, online: 0, offline: [], items: [] })
  );
});
v1.post("/protect/cameras/:id/snapshot", async (c) => {
  const { id } = c.req.param();
  logger.debug("camera snapshot requested", id);
  return c.json(
    ok(`stub: camera snapshot for ${id}`, { imageUrl: null, camera: id })
  );
});
v1.post("/ai/summary", async (c) => {
  logger.debug("ai summary requested - pulling Home Assistant logs");
  if (!c.env.HASSIO_ENDPOINT_URI || !c.env.HASSIO_TOKEN) {
    return c.json(
      {
        ok: false,
        error: "Home Assistant not configured. Cannot retrieve logs."
      },
      400
    );
  }
  try {
    let logs = [];
    let logSource = "none";
    try {
      const wsClient = getHaClient(c.env);
      const wsLogs = await Promise.race([
        wsClient.getLogs(),
        new Promise(
          (_, reject) => setTimeout(() => reject(new Error("Timeout")), 1e4)
        )
      ]);
      if (wsLogs && typeof wsLogs === "object" && "result" in wsLogs && Array.isArray(wsLogs.result)) {
        logs = wsLogs.result;
        logSource = "websocket";
      }
    } catch (wsError) {
      logger.debug("WebSocket log fetch failed, trying REST API", wsError);
      try {
        const errorLogRes = await fetch(
          `${c.env.HASSIO_ENDPOINT_URI}/api/error_log`,
          {
            headers: {
              Authorization: `Bearer ${c.env.HASSIO_TOKEN}`,
              "Content-Type": "application/json"
            },
            signal: AbortSignal.timeout(1e4)
          }
        );
        if (errorLogRes.ok) {
          const errorLogText = await errorLogRes.text();
          logs = parseErrorLogText(errorLogText);
          logSource = "error_log_api";
        }
      } catch (restError) {
        logger.debug("REST API log fetch also failed", restError);
      }
    }
    if (logs.length === 0) {
      try {
        const statesRes = await fetch(
          `${c.env.HASSIO_ENDPOINT_URI}/api/states`,
          {
            headers: {
              Authorization: `Bearer ${c.env.HASSIO_TOKEN}`,
              "Content-Type": "application/json"
            }
          }
        );
        if (statesRes.ok) {
          const states = await statesRes.json();
          logs = extractErrorsFromStates(states);
          logSource = "states_api";
        }
      } catch (statesError) {
        logger.debug("States API also failed", statesError);
      }
    }
    const processedLogs = processHomeLogs(logs);
    logger.debug(
      `Log processing complete: ${processedLogs.summary}, source: ${logSource}`
    );
    const prompt = `You are analyzing Home Assistant logs. Please provide a concise diagnostic summary and recommendations.

${formatLogsForAI(processedLogs)}

Please provide:
1. Overall system health assessment
2. Priority issues that need attention
3. Recommended actions
4. Any patterns or recurring problems

Keep the response concise and actionable.`;
    let responseText = "No response generated";
    try {
      const result = await c.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
        prompt,
        max_tokens: 512
      });
      responseText = result.response || result.text || "No response generated";
    } catch (aiError) {
      logger.debug("AI inference failed, using fallback analysis", aiError);
      responseText = `**System Health Assessment** (Generated without AI inference)

**Overall Status**: ${processedLogs.errorCount > 0 ? "Issues Detected" : "System Appears Healthy"}

**Key Findings**:
- ${processedLogs.errorCount} error(s) found
- ${processedLogs.warningCount} warning(s) detected
- ${processedLogs.uniqueErrors.length} unique error type(s)
- Log source: ${logSource}

**Priority Issues**:
${processedLogs.uniqueErrors.slice(0, 3).map((error) => `- ${error}`).join("\n") || "- No critical errors detected"}

**Recommendations**:
- Monitor entities showing 'unavailable' status
- Check network connectivity for offline devices
- Review Home Assistant logs for detailed error information
- Consider restarting services if issues persist

**Note**: This analysis was generated without AI inference due to local development limitations.`;
    }
    logger.debug("ai summary response generated");
    return c.json(
      ok("ai summary", {
        text: responseText,
        logAnalysis: {
          source: logSource,
          summary: processedLogs.summary,
          errorCount: processedLogs.errorCount,
          warningCount: processedLogs.warningCount,
          uniqueErrorTypes: processedLogs.uniqueErrors.length,
          timeRange: processedLogs.timeRange
        }
      })
    );
  } catch (error) {
    logger.error("AI summary error:", error);
    return c.json(
      {
        ok: false,
        error: `AI summary failed: ${error instanceof Error ? error.message : "Unknown error"}`
      },
      500
    );
  }
});
function parseErrorLogText(logText) {
  const lines = logText.split("\n").filter((line) => line.trim());
  const logs = [];
  for (const line of lines) {
    const match = line.match(
      /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+(\w+)\s+([^:]+):\s*(.+)$/
    );
    if (match) {
      logs.push({
        timestamp: match[1],
        level: match[2],
        logger: match[3].trim(),
        message: match[4].trim()
      });
    } else if (line.trim()) {
      logs.push({
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        level: "INFO",
        logger: "unknown",
        message: line.trim()
      });
    }
  }
  return logs;
}
__name(parseErrorLogText, "parseErrorLogText");
function extractErrorsFromStates(states) {
  const logs = [];
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (Array.isArray(states)) {
    for (const state of states) {
      if (typeof state === "object" && state !== null && "state" in state && "entity_id" in state) {
        const stateObj = state;
        if (stateObj.state === "unavailable" || stateObj.state === "unknown") {
          logs.push({
            timestamp: stateObj.last_changed || now,
            level: "WARNING",
            logger: "entity_state",
            message: `Entity ${stateObj.entity_id} is ${stateObj.state}`,
            source: "state_analysis"
          });
        }
      }
    }
  }
  return logs;
}
__name(extractErrorsFromStates, "extractErrorsFromStates");
v1.post("/webhooks/logs", async (c) => {
  const log2 = await c.req.json();
  const key = `logs/${Date.now()}-${crypto.randomUUID()}.json`;
  await c.env.LOGS_BUCKET.put(key, JSON.stringify(log2));
  if (typeof log2?.level === "string" && log2.level.toUpperCase() === "ERROR") {
    try {
      const analysis = await c.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
        prompt: `Analyze Home Assistant log and provide diagnostics:
${JSON.stringify(log2)}`,
        max_tokens: 256
      });
      const id = crypto.randomUUID();
      await c.env.D1_DB.prepare(
        "INSERT INTO log_diagnostics (id, log_key, analysis, created_at) VALUES (?, ?, ?, ?)"
      ).bind(id, key, analysis.response, Date.now()).run();
    } catch (err) {
      logger.error("Error during log analysis:", err);
    }
  }
  logger.debug("log stored", key);
  return c.json(ok("log stored", { key }));
});
v1.get("/worker/state/:key", async (c) => {
  const { key } = c.req.param();
  const value = await c.env.CONFIG_KV.get(key);
  logger.debug("state retrieved", key);
  return c.json(ok("state retrieved", { key, value }));
});
v1.put("/worker/state/:key", async (c) => {
  const { key } = c.req.param();
  const value = await c.req.text();
  await c.env.CONFIG_KV.put(key, value);
  logger.debug("state stored", key);
  return c.json(ok("state stored", { key }));
});
v1.get("/ha/:instanceId/states/:entityId", async (c) => {
  const { instanceId, entityId } = c.req.param();
  logger.debug("HA state fetch", instanceId, entityId);
  const res = await haFetch(c.env, instanceId, `/api/states/${entityId}`);
  const data = await res.json();
  return c.json(ok("state", data));
});
v1.put("/ha/:instanceId/states/:entityId", async (c) => {
  const { instanceId, entityId } = c.req.param();
  const body = await c.req.json();
  logger.debug("HA state update", instanceId, entityId, body);
  const res = await haFetch(c.env, instanceId, `/api/states/${entityId}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" }
  });
  const data = await res.json();
  return c.json(ok("state updated", data));
});
v1.post("/ha/:instanceId/services/:domain/:service", async (c) => {
  const { instanceId, domain, service } = c.req.param();
  const body = await c.req.json();
  logger.debug("HA service call", instanceId, domain, service, body);
  const res = await haFetch(
    c.env,
    instanceId,
    `/api/services/${domain}/${service}`,
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" }
    }
  );
  const data = await res.json();
  return c.json(ok("service called", data));
});
v1.post("/ha/ws", async (c) => {
  const command = await c.req.json();
  logger.debug("HA WS command", command);
  if (typeof command !== "object" || command === null || Array.isArray(command)) {
    return c.json(
      { ok: false, error: "Request body must be a JSON object" },
      400
    );
  }
  const data = await getHaClient(c.env).send(command);
  logger.debug("HA WS response", data);
  return c.json(ok("ws response", data));
});
v1.post("/ha/diagnostics", async (c) => {
  logger.debug("ha/diagnostics invoked");
  if (!c.env.HASSIO_ENDPOINT_URI || !c.env.HASSIO_TOKEN) {
    return c.json({ ok: false, error: "Home Assistant not configured." }, 400);
  }
  const results = {
    baseUrl: c.env.HASSIO_ENDPOINT_URI,
    endpoints: {}
  };
  const endpointsToTest = [
    { name: "api", path: "/api/" },
    { name: "config", path: "/api/config" },
    { name: "states", path: "/api/states" },
    { name: "device_registry", path: "/api/config/device_registry/list" },
    { name: "entity_registry", path: "/api/config/entity_registry/list" },
    { name: "services", path: "/api/services" },
    { name: "events", path: "/api/events" }
  ];
  for (const endpoint of endpointsToTest) {
    try {
      const response = await fetch(
        `${c.env.HASSIO_ENDPOINT_URI}${endpoint.path}`,
        {
          headers: {
            Authorization: `Bearer ${c.env.HASSIO_TOKEN}`,
            "Content-Type": "application/json"
          },
          signal: AbortSignal.timeout(5e3)
        }
      );
      results.endpoints[endpoint.name] = {
        status: response.status,
        available: response.ok,
        contentType: response.headers.get("content-type")
      };
      if (response.ok && endpoint.name === "states") {
        try {
          const data = await response.json();
          results.endpoints[endpoint.name].sampleCount = Array.isArray(data) ? data.length : 0;
        } catch {
        }
      }
    } catch (error) {
      results.endpoints[endpoint.name] = {
        status: "error",
        available: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
  return c.json(ok("Home Assistant API diagnostics completed", results));
});
v1.post("/ha/events/subscribe", async (c) => {
  logger.debug("ha events subscribe requested");
  if (!c.env.HASSIO_ENDPOINT_URI || !c.env.HASSIO_TOKEN) {
    return c.json({ ok: false, error: "Home Assistant not configured." }, 400);
  }
  try {
    const { event_type } = await c.req.json();
    const wsClient = getHaClient(c.env);
    const subscription = await wsClient.subscribeEvents(event_type);
    logger.debug(`Subscribed to Home Assistant events: ${event_type || "all"}`);
    return c.json(
      ok("event subscription created", {
        event_type: event_type || "all",
        subscription_id: typeof subscription === "object" && subscription && "id" in subscription ? subscription.id : "unknown"
      })
    );
  } catch (error) {
    logger.error("Event subscription error:", error);
    return c.json(
      {
        ok: false,
        error: `Event subscription failed: ${error instanceof Error ? error.message : "Unknown error"}`
      },
      500
    );
  }
});
v1.get("/websocket/events", async (c) => {
  logger.debug("WebSocket events requested");
  if (!c.env.HASSIO_ENDPOINT_URI || !c.env.HASSIO_TOKEN) {
    return c.json(
      {
        ok: false,
        error: "Home Assistant not configured"
      },
      400
    );
  }
  try {
    const statesRes = await fetch(`${c.env.HASSIO_ENDPOINT_URI}/api/states`, {
      headers: {
        Authorization: `Bearer ${c.env.HASSIO_TOKEN}`,
        "Content-Type": "application/json"
      }
    });
    if (!statesRes.ok) {
      throw new Error(`States fetch failed: ${statesRes.status}`);
    }
    const states = await statesRes.json();
    const recentEvents = [];
    if (Array.isArray(states)) {
      const now = /* @__PURE__ */ new Date();
      states.filter((state) => state.last_changed || state.last_updated).sort((a, b) => {
        const aTime = new Date(a.last_changed || a.last_updated).getTime();
        const bTime = new Date(b.last_changed || b.last_updated).getTime();
        return bTime - aTime;
      }).slice(0, 10).forEach((state) => {
        const lastChanged = new Date(state.last_changed || state.last_updated);
        const ageMinutes = Math.round((now.getTime() - lastChanged.getTime()) / 1e3 / 60);
        if (ageMinutes < 60) {
          recentEvents.push({
            time: lastChanged.toISOString(),
            entity_id: state.entity_id,
            event_type: "state_changed",
            old_state: null,
            // We don't have old state from this endpoint
            new_state: state.state,
            friendly_name: state.attributes?.friendly_name || state.entity_id,
            domain: state.entity_id.split(".")[0],
            age_minutes: ageMinutes
          });
        }
      });
    }
    return c.json(
      ok("recent events", {
        events: recentEvents,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        count: recentEvents.length
      })
    );
  } catch (error) {
    logger.error("WebSocket events fetch failed:", error);
    return c.json(
      {
        ok: false,
        error: `WebSocket events failed: ${error instanceof Error ? error.message : "Unknown error"}`
      },
      500
    );
  }
});
async function syncEntitiesFromHA(db, hassioEndpoint, hassioToken) {
  logger.debug("Syncing entities from Home Assistant to database");
  try {
    const statesRes = await fetch(`${hassioEndpoint}/api/states`, {
      headers: {
        Authorization: `Bearer ${hassioToken}`,
        "Content-Type": "application/json"
      }
    });
    if (!statesRes.ok) {
      throw new Error(`States fetch failed: ${statesRes.status}`);
    }
    const states = await statesRes.json();
    if (!Array.isArray(states)) {
      throw new Error("Invalid states response from Home Assistant");
    }
    await db.prepare(`
			INSERT OR IGNORE INTO sources (id, kind, base_ws_url, created_at, updated_at)
			VALUES ('default', 'home_assistant', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		`).bind(hassioEndpoint.replace(/^http/, "ws") + "/api/websocket").run();
    let synced = 0;
    let errors = 0;
    for (const state of states) {
      try {
        if (!state.entity_id) continue;
        const [domain, object_id] = state.entity_id.split(".", 2);
        if (!domain || !object_id) continue;
        const friendlyName = state.attributes?.friendly_name || null;
        const icon = state.attributes?.icon || null;
        const unitOfMeasure = state.attributes?.unit_of_measurement || null;
        const area = state.attributes?.area_id || null;
        await db.prepare(`
					INSERT OR REPLACE INTO entities (
						id, source_id, domain, object_id, friendly_name, icon,
						unit_of_measure, area, is_enabled, last_seen_at,
						metadata_json, updated_at
					) VALUES (?, 'default', ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP)
				`).bind(
          state.entity_id,
          domain,
          object_id,
          friendlyName,
          icon,
          unitOfMeasure,
          area,
          JSON.stringify({
            unique_id: state.attributes?.unique_id,
            device_id: state.attributes?.device_id,
            device_class: state.attributes?.device_class,
            entity_category: state.attributes?.entity_category
          })
        ).run();
        synced++;
      } catch (entityError) {
        logger.error(`Failed to sync entity ${state.entity_id}:`, entityError);
        errors++;
      }
    }
    logger.debug(`Entity sync complete: ${synced} synced, ${errors} errors`);
    return { synced, errors };
  } catch (error) {
    logger.error("Entity sync failed:", error);
    throw error;
  }
}
__name(syncEntitiesFromHA, "syncEntitiesFromHA");

// src/durable-objects/homeAssistant.ts
var HomeAssistantWebSocket = class {
  static {
    __name(this, "HomeAssistantWebSocket");
  }
  env;
  haSocket;
  clients = /* @__PURE__ */ new Set();
  constructor(env) {
    this.env = env;
  }
  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      logger.warn("Non-websocket request to HomeAssistantWebSocket");
      return new Response("Expected websocket", { status: 400 });
    }
    const url = new URL(request.url);
    const instanceId = url.pathname.split("/").pop() || "default";
    logger.debug("HomeAssistantWebSocket fetch for", instanceId);
    await this.ensureHaSocket(instanceId);
    const pair = new WebSocketPair();
    const { 0: client2, 1: server } = pair;
    server.accept?.();
    this.clients.add(server);
    server.addEventListener("message", (ev) => {
      try {
        this.haSocket?.send(ev.data);
      } catch {
      }
    });
    const remove = /* @__PURE__ */ __name(() => {
      this.clients.delete(server);
    }, "remove");
    server.addEventListener("close", remove);
    server.addEventListener("error", remove);
    return new Response(null, { status: 101, webSocket: client2 });
  }
  async ensureHaSocket(instanceId) {
    if (this.haSocket && this.haSocket.readyState <= 1) return;
    const config = this.env.HASSIO_ENDPOINT_URI && this.env.HASSIO_TOKEN ? { baseUrl: this.env.HASSIO_ENDPOINT_URI, token: this.env.HASSIO_TOKEN } : await getInstanceConfig(this.env, instanceId);
    if (!config) {
      logger.warn("No HA config found for instance", instanceId);
      return;
    }
    const wsUrl = `${config.baseUrl.replace(/^http/, "ws")}/api/websocket`;
    this.haSocket = new WebSocket(wsUrl);
    logger.debug("Opening HA socket", wsUrl);
    this.haSocket.addEventListener("open", () => {
      if (this.haSocket) {
        this.haSocket.send(
          JSON.stringify({ type: "auth", access_token: config.token })
        );
      }
    });
    this.haSocket.addEventListener("message", (ev) => {
      for (const client2 of this.clients) {
        try {
          client2.send(ev.data);
        } catch {
        }
      }
    });
    this.haSocket.addEventListener("close", () => {
      logger.warn("HA socket closed");
      this.haSocket = void 0;
    });
    this.haSocket.addEventListener("error", () => {
      logger.error("HA socket error");
      this.haSocket = void 0;
    });
  }
};

// src/index.ts
var startTime = Date.now();
var app = new Hono2();
app.use("*", async (c, next) => {
  logger.debug("Request:", c.req.method, c.req.path);
  await next();
});
app.get("/health", async (c) => {
  logger.debug("Handling /health");
  const uptime = (Date.now() - startTime) / 1e3;
  const hasCredentials = !!(c.env.HASSIO_ENDPOINT_URI && c.env.HASSIO_TOKEN);
  let restApiStatus = false;
  if (hasCredentials) {
    try {
      const restResponse = await fetch(`${c.env.HASSIO_ENDPOINT_URI}/api/`, {
        headers: {
          Authorization: `Bearer ${c.env.HASSIO_TOKEN}`,
          "Content-Type": "application/json"
        },
        signal: AbortSignal.timeout(5e3)
        // 5 second timeout
      });
      restApiStatus = restResponse.ok;
    } catch (error) {
      logger.debug("Home Assistant REST API check failed:", error);
      restApiStatus = false;
    }
  }
  let websocketApiStatus = false;
  if (hasCredentials) {
    try {
      const healthCheckClient = new HaWebSocketClient(
        c.env.HASSIO_ENDPOINT_URI,
        c.env.HASSIO_TOKEN
      );
      const configResponse = await Promise.race([
        healthCheckClient.getConfig(),
        new Promise(
          (_, reject) => setTimeout(() => reject(new Error("WebSocket timeout")), 3e3)
        )
      ]);
      websocketApiStatus = !!configResponse;
    } catch (error) {
      logger.debug("Home Assistant WebSocket API check failed:", error);
      websocketApiStatus = false;
    }
  }
  return c.json({
    ok: true,
    uptime,
    env: { ready: true },
    homeAssistant: {
      restApi: restApiStatus,
      websocketApi: websocketApiStatus,
      configured: hasCredentials
    }
  });
});
app.get("/", async (c) => {
  logger.debug("Handling root path");
  try {
    return await c.env.ASSETS.fetch(
      new Request(new URL("/index.html", c.req.url))
    );
  } catch (error) {
    logger.warn(`Failed to fetch index.html, returning default text`, error);
    return c.text(
      `hassio-proxy-worker up. See /openapi.json and /v1/* for API documentation. Error details: ${error}`
    );
  }
});
app.get("/openapi.json", async (c) => {
  logger.debug("Serving OpenAPI spec from ASSETS");
  try {
    return await c.env.ASSETS.fetch(
      new Request(new URL("/openapi.json", c.req.url))
    );
  } catch (error) {
    logger.error("Failed to fetch openapi.json from ASSETS", error);
    return c.json(
      { ok: false, error: "Failed to load OpenAPI specification." },
      500
    );
  }
});
app.get("/api/camera_proxy/:entity_id", async (c) => {
  const { entity_id } = c.req.param();
  logger.debug("Proxying camera image for", entity_id);
  if (!c.env.HASSIO_ENDPOINT_URI || !c.env.HASSIO_TOKEN) {
    return c.json({ ok: false, error: "Home Assistant not configured" }, 400);
  }
  try {
    const response = await fetch(
      `${c.env.HASSIO_ENDPOINT_URI}/api/camera_proxy/${entity_id}`,
      {
        headers: {
          Authorization: `Bearer ${c.env.HASSIO_TOKEN}`
        }
      }
    );
    if (!response.ok) {
      logger.debug(`Camera proxy failed for ${entity_id}: ${response.status}`);
      return new Response("Camera unavailable", { status: 404 });
    }
    return new Response(response.body, {
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "image/jpeg",
        "Cache-Control": "no-cache"
      }
    });
  } catch (error) {
    logger.error("Camera proxy error:", error);
    return new Response("Camera error", { status: 500 });
  }
});
app.route("/v1", v1);
app.get("/ws/:instanceId", (c) => {
  const { instanceId } = c.req.param();
  logger.debug("Proxying WebSocket for instance", instanceId);
  const id = c.env.WEBSOCKET_SERVER.idFromName(instanceId);
  const stub = c.env.WEBSOCKET_SERVER.get(id);
  return stub.fetch(c.req.raw);
});
var src_default = {
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
  async scheduled(controller, env, ctx) {
    logger.info("\u{1F9E0} Scheduled brain sweep triggered", {
      cron: controller.cron,
      scheduledTime: controller.scheduledTime
    });
    ctx.waitUntil(
      brainSweep(env.D1_DB).then((result) => {
        logger.info("\u{1F9E0} Scheduled brain sweep completed", result);
      }).catch((error) => {
        logger.error("\u{1F9E0} Scheduled brain sweep failed", error);
      })
    );
  }
};

// node_modules/.pnpm/wrangler@4.32.0_@cloudflare+workers-types@4.20250823.0/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/.pnpm/wrangler@4.32.0_@cloudflare+workers-types@4.20250823.0/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-QAtZyj/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/.pnpm/wrangler@4.32.0_@cloudflare+workers-types@4.20250823.0/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-QAtZyj/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  HomeAssistantWebSocket,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
