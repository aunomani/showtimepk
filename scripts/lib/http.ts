const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface RequestOptions {
  method?: 'GET' | 'POST';
  form?: Record<string, string>;
  headers?: Record<string, string>;
  cookies?: CookieJar;
  timeoutMs?: number;
  retries?: number;
}

/** Minimal cookie jar: enough for PHP session cookies. */
export class CookieJar {
  private cookies = new Map<string, string>();

  store(res: Response) {
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(';');
      const eq = pair.indexOf('=');
      if (eq > 0) this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }

  header(): string {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

export async function request(url: string, opts: RequestOptions = {}): Promise<string> {
  const { method = 'GET', form, cookies, timeoutMs = 20000, retries = 2 } = opts;
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    'Accept-Language': 'en-US,en;q=0.9',
    ...opts.headers,
  };
  if (form) headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (cookies) {
        const c = cookies.header();
        if (c) headers['Cookie'] = c;
      }
      const res = await fetch(url, {
        method,
        headers,
        body: form ? new URLSearchParams(form).toString() : undefined,
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'follow',
      });
      cookies?.store(res);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.text();
    } catch (err) {
      lastError = err;
      if (attempt < retries) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw lastError;
}

export async function requestJson<T = any>(url: string, opts: RequestOptions = {}): Promise<T> {
  const text = await request(url, { ...opts, headers: { Accept: 'application/json, text/plain, */*', ...opts.headers } });
  return JSON.parse(text) as T;
}
