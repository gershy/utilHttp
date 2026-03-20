import '@gershy/clearing';

export type NetProc = { proto: 'ws' | 'wss' | 'http' | 'https', addr: string, port: number };

type Built<T> = T | { [k: string]: Built<T> };
export type HttpReq = {
  
  // Defines an http request, but is agnostic of the NetProc (no proto, addr, etc. included)
  
  path:    string[],
  method:  'head' | 'get' | 'post' | 'put' | 'patch' | 'delete' | 'sokt',
  // headers: Obs<string[]>, // Currently considering not exposing headers - just "cookies", parsed separately...
  cookies: Obj<Built<string>>,
  query?:  Obj<Built<string>>, // Consider eliminating arrays; user could do "?args.0=a&args.1=b&args.2=c" -> { args: { 0: 'a', 1: 'b', 2: 'c' } }
  body?:   Json
  
};
export type HttpRes = {
  code: number,
  headers?: { [key: string]: string | string[] },
  body: Json | Buffer
};
export type HttpArgs<Req extends HttpReq, Res extends HttpRes> = {}
  & { $req: Req, $res: Res }
  & { netProc: NetProc }
  & Omit<Req, 'cookies'>       // We omit the "cookies" arg as it's provided automatically/statefully by `fetch` (not explicitly by the consumer)
  & { headers?: Obj<string> };
export type HttpResult<Res extends HttpRes> = {
  reqArgs: { url: string, method: string, headers: [string, string][], body: string | null }
  code: number,
  body: Res['body']
};
export type HttpRet<Res extends HttpRes> = Promise<HttpResult<Res>> & { end: () => void };

export default <Args extends HttpArgs<HttpReq, HttpRes>>(args: Args, params: Pick<Args, 'query' | 'body'>) => {
  
  // Note this function is sovereign - can't reference jargon/http for `formatNetProc` :(
  
  const { netProc, path, headers={} } = args;
  const { query = {}, body: reqBody = null } = params;
  
  const defPorts = { http: 80, https: 443 };
  const url = [
    
    // E.g. "http://pasta.com"
    `${netProc.proto}:/${''}/${netProc.addr}`,
    
    // E.g. "http://pasta.com:3000"
    netProc.port !== defPorts[netProc.proto] ? `:${netProc.port.toString(10)}` : null,
    
    // E.g. "http://pasta.com:3000/path/to/resource"
    path ? `/${path.join('/')}` : null,
    
    (() => {
      
      if (query[cl.empty]()) return null;
      
      const chains = function*(val: any, chain: string[] = []): Generator<{ chain: string[], val }> {
        if (!cl.isCls(val, Object)) return yield { chain, val };
        for (const [ k, v ] of val[cl.walk]()) yield* chains(v, [ ...chain, k ]);
      };
      
      // E.g. "http://pasta.com:3000/path/to/resource?query=spaghetti&offset=10"
      return [ ...chains(query) ]
        [cl.map](({ chain, val }) => `${encodeURIComponent(chain.join('.'))}=${encodeURIComponent(val)}`)
        .join('&')
      
    })()
    
  ].filter(Boolean).join('');
  
  const reqArgs = {
    method: args.method[cl.upper](),
    headers: headers
      [cl.toArr]((v, k) => [ k.replace(/([A-Z])/g, '-$1')[cl.lower](), v ] as [ string, string ]), // Avoid `camelCase` util - want to keep this sovereign
    body: [ Object, Array ].some(C => cl.isCls(reqBody, C)) ? JSON.stringify(reqBody) : reqBody !== null ? `${reqBody}` : null
  };
  
  const abort = new AbortController();
  const prm = fetch(url, { ...reqArgs, signal: abort.signal }).then(
    async res => {
      
      const resBody = await (async () => {
        const t = await res.text();
        try { return JSON.parse(t); } catch(err) {}
        return t;
      })();
      
      const http = {
        reqArgs: Object.assign(reqArgs, { url, body: reqBody }) as (typeof reqArgs & { url: string }),
        code: res.status,
        body: resBody as Args['$res']['body']
      };
      
      if (res.status >= 500) throw Error('http glitch')[cl.mod](http);
      if (res.status >= 400) throw Error('http reject')[cl.mod](http);
      return http; // TODO: Return something like `{ ...http.body, http: { status: res.status } }`? Works as long as `http.body` is Json and not a Buffer
      
    },
    err => {
      while (cl.isCls(err.cause, Error)) err = err.cause; // `fetch` natively wraps errors - pretty annoying; unwrap them
      if (err.code === 'ENOTFOUND') return err[cl.fire]({ retry: false }) as never;
      throw err;
    }
  );
  
  // Note that fetch abortion errors are suppressed!! By default we short-circuit any logic
  // which depended on the http return value.
  return Object.assign(prm, { end: () => abort.abort(Error('fetch aborted')[cl.suppress]()) });
  
};