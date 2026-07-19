import { assertEqual, testRunner } from '../build/utils.test.ts';
import http from './main.ts';

// Type testing
(async () => {
  
  type Assert<V extends true> = V;
  type Equal<A, B> = A extends B ? B extends A ? true : false : false;
  
  type Tests = {
    1: Assert<Equal<{ x: 'y' }, { x: 'y' }>>
  };
  if (0) ((v?: Tests) => void 0)();
  
})();

const mockFetcher = (code: number, json: Json) => (async (url: string, args: any) => ({
  status: code,
  arrayBuffer: async () => JSON.stringify(json)[cl.toBin](),
})) as any as typeof fetch;

testRunner([
  
  { name: 'basic', fn: async () => {
    
    const result = await http({
      
      fetch: mockFetcher(200, { x: 'x', y: 'y', z: 'z' }),
      
      $req: null as any as { path: any, method: any, cookies: any, query: { a: string }, body: { b: string } },
      $res: null as any as { code: any, body: { x: string, y: string, z: string } },
      netProc: { proto: 'http', addr: 'test.com', port: 80 },
      path: [ 'a', 'b', 'c' ],
      method: 'get'
      
    }, {
      query: { a: 'a' },
      body: { b: 'b' }
    });
    
    assertEqual(result, {
      reqArgs: {
        url: 'http://test.com/a/b/c?a=a',
        method: 'GET',
        headers: [],
        body: { b: 'b' }
      },
      code: 200,
      body: { x: 'x', y: 'y', z: 'z' }
    });
    
  }}
  
]);